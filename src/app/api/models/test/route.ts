import { NextRequest, NextResponse } from 'next/server';
import { ModelTestingEngine, TestExecutionOptions } from '@/lib/intelligence/tester';
import { DiscoveredModel, ModelTestRecord } from '@/types/model-intelligence';
import { ProviderConfig } from '@/types/provider';
import { KeyPool } from '@/lib/providers/key-pool';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const model: DiscoveredModel = body.model;
    let provConfig: ProviderConfig = body.providerConfig;
    const options: TestExecutionOptions = body.options || {};

    if (!model || !model.id || !model.provider) {
      return NextResponse.json(
        { success: false, error: 'Model payload (id, provider) is required' },
        { status: 400 }
      );
    }

    if (!provConfig) {
      provConfig = {
        id: model.provider,
        name: model.provider.toUpperCase(),
        enabled: true,
        apiKey: '',
        status: 'ready',
      };
    }

    // Populate credentials from server env if not present
    if (model.provider === 'gemini' && !provConfig.apiKey) {
      provConfig.apiKey = KeyPool.getKeys('', ['GEMINI_API_KEY', 'GEMINI_API_KEYS']).join(',');
    } else if (model.provider === 'groq' && !provConfig.apiKey) {
      provConfig.apiKey = KeyPool.getKeys('', ['GROQ_API_KEY', 'GROQ_API_KEYS']).join(',');
    } else if (model.provider === 'openrouter' && !provConfig.apiKey) {
      provConfig.apiKey = KeyPool.getKeys('', ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS']).join(',');
      provConfig.baseUrl = provConfig.baseUrl || process.env.OPENROUTER_BASE_URL;
    } else if (model.provider === 'nvidia' && !provConfig.apiKey) {
      provConfig.apiKey = KeyPool.getKeys('', ['NVIDIA_API_KEY', 'NVIDIA_API_KEYS']).join(',');
      provConfig.baseUrl = provConfig.baseUrl || process.env.NVIDIA_BASE_URL;
    } else if (model.provider === 'cloudflare') {
      const pairs = KeyPool.getCloudflarePairs(provConfig.apiKey || '', provConfig.accountId || '');
      if (pairs.length > 0) {
        provConfig.apiKey = pairs.map((p) => p.apiKey).join(',');
        provConfig.accountId = pairs.map((p) => p.accountId).join(',');
      }
    } else if (model.provider === 'ollama') {
      if (!provConfig.apiKey) {
        provConfig.apiKey = KeyPool.getKeys('', ['OLLAMA_API_KEY', 'OLLAMA_API_KEYS']).join(',');
      }
      provConfig.baseUrl = provConfig.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    }

    const record: ModelTestRecord = await ModelTestingEngine.testModel(model, provConfig, options);

    // Compute updated benchmarkScores
    const currentScores = model.benchmarkScores || {};
    const updatedScores = { ...currentScores };

    if (record.category === 'TEXT') {
      updatedScores.generalChat = record.score;
      if (model.roles.includes('REASONING')) {
        updatedScores.reasoning = record.score;
      }
    } else if (record.category === 'CODING') {
      updatedScores.coding = record.score;
    } else if (record.category === 'VISION') {
      updatedScores.vision = record.score;
    } else if (record.category === 'IMAGE_GEN') {
      updatedScores.imageGen = record.score;
    } else if (record.category === 'AUDIO') {
      updatedScores.audio = record.score;
    }

    const scoreValues = [
      updatedScores.generalChat,
      updatedScores.reasoning,
      updatedScores.coding,
      updatedScores.vision,
      updatedScores.imageGen,
      updatedScores.audio,
    ].filter((v): v is number => typeof v === 'number');

    if (scoreValues.length > 0) {
      updatedScores.overallScore = Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length);
    }
    updatedScores.lastEvaluatedAt = Date.now();

    // Update model state reflecting test outcome & objective benchmark scores
    const updatedModel: DiscoveredModel = {
      ...model,
      testStatus: record.result === 'PASS' ? 'PASS' : record.result === 'BLOCKED' ? 'BLOCKED' : 'FAIL',
      authentication: record.result === 'PASS' ? 'passed' : 'failed',
      lastTestedAt: record.timestamp,
      latencyMs: record.latencyMs,
      benchmarkScores: updatedScores,
      performance: {
        qualityScore: updatedScores.overallScore || record.score || 0,
        latencyScore: Math.max(10, Math.min(100, Math.round(100 - record.latencyMs / 50))),
        reliabilityScore: record.result === 'PASS' ? 100 : 0,
      },
      tokenUsage: record.tokenUsage,
      errorInfo:
        record.result !== 'PASS'
          ? {
              code: record.errorCode || 'UNKNOWN_ERROR',
              message: record.errorMessage || 'Test failed without explicit error details',
              safeResolution:
                record.errorCode === 'BILLING_REQUIRED'
                  ? 'Aktifkan izin berbayar (allowPaid: true) atau upgrade paket provider.'
                  : record.errorCode === 'QUOTA_EXCEEDED' || record.errorCode === 'RATE_LIMIT_EXCEEDED'
                  ? 'Batas kuota gratis habis. Tunggu reset limit atau gunakan model free alternatif.'
                  : 'Periksa API key dan parameter model di pengaturan provider.',
            }
          : undefined,
    };

    return NextResponse.json({
      success: true,
      branding: 'NEO STUDIO AI by xyrons',
      record,
      model: updatedModel,
    });
  } catch (error: any) {
    console.error('[API /api/models/test] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error during model testing',
      },
      { status: 500 }
    );
  }
}
