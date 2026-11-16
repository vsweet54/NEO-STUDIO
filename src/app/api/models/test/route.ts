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
      provConfig.baseUrl = provConfig.baseUrl || process.env.OLLAMA_BASE_URL || 'https://ollama.com';
    }

    const record: ModelTestRecord = await ModelTestingEngine.testModel(model, provConfig, options);

    // Update model state reflecting test outcome
    const updatedModel: DiscoveredModel = {
      ...model,
      testStatus: record.result === 'PASS' ? 'PASS' : record.result === 'BLOCKED' ? 'BLOCKED' : 'FAIL',
      authentication: record.result === 'PASS' ? 'passed' : 'failed',
      lastTestedAt: record.timestamp,
      latencyMs: record.latencyMs,
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
