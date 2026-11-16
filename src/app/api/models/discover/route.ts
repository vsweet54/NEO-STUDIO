import { NextRequest, NextResponse } from 'next/server';
import { ModelDiscoveryEngine } from '@/lib/intelligence/discovery';
import { ModelSpecializationEngine } from '@/lib/intelligence/specialization';
import { ProviderConfig, ProviderId } from '@/types/provider';
import { DiscoverySummary, ModelPricingClassification, ModelTestStatus } from '@/types/model-intelligence';
import { KeyPool } from '@/lib/providers/key-pool';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty or non-JSON body is acceptable, fallback to server environment
    }

    let providerConfigs: ProviderConfig[] = body.providerConfigs || [];

    // If client didn't supply provider configs or some are missing, construct from server env
    if (!providerConfigs || providerConfigs.length === 0) {
      const allProviders: ProviderId[] = ['gemini', 'groq', 'openrouter', 'nvidia', 'cloudflare', 'ollama'];
      providerConfigs = allProviders.map((pid) => {
        let apiKey = '';
        let baseUrl: string | undefined = undefined;
        let accountId: string | undefined = undefined;

        if (pid === 'gemini') {
          apiKey = KeyPool.getKeys('', ['GEMINI_API_KEY', 'GEMINI_API_KEYS']).join(',');
        } else if (pid === 'groq') {
          apiKey = KeyPool.getKeys('', ['GROQ_API_KEY', 'GROQ_API_KEYS']).join(',');
        } else if (pid === 'openrouter') {
          apiKey = KeyPool.getKeys('', ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS']).join(',');
          baseUrl = process.env.OPENROUTER_BASE_URL;
        } else if (pid === 'nvidia') {
          apiKey = KeyPool.getKeys('', ['NVIDIA_API_KEY', 'NVIDIA_API_KEYS']).join(',');
          baseUrl = process.env.NVIDIA_BASE_URL;
        } else if (pid === 'cloudflare') {
          const pairs = KeyPool.getCloudflarePairs('', '');
          apiKey = pairs.map((p) => p.apiKey).join(',');
          accountId = pairs.map((p) => p.accountId).join(',');
        } else if (pid === 'ollama') {
          baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        }

        return {
          id: pid,
          name: pid.toUpperCase(),
          enabled: true,
          apiKey,
          baseUrl,
          accountId,
          status: 'ready',
        } as ProviderConfig;
      });
    }

    const discoveredModels = await ModelDiscoveryEngine.discoverAll(providerConfigs, true);

    // Compute summary
    const summary: DiscoverySummary = {
      timestamp: Date.now(),
      totalDiscovered: discoveredModels.length,
      byProvider: {
        gemini: 0,
        groq: 0,
        openrouter: 0,
        nvidia: 0,
        cloudflare: 0,
        ollama: 0,
      },
      byPricing: {
        FREE: 0,
        FREE_LIMITED: 0,
        FREE_TRIAL: 0,
        PAID: 0,
        UNKNOWN: 0,
        UNAVAILABLE: 0,
      },
      byStatus: {
        NOT_TESTED: 0,
        PASS: 0,
        FAIL: 0,
        BLOCKED: 0,
        READY: 0,
        UNAVAILABLE: 0,
        DEPRECATED: 0,
      },
    };

    for (const m of discoveredModels) {
      if (summary.byProvider[m.provider] !== undefined) {
        summary.byProvider[m.provider]++;
      }
      if (summary.byPricing[m.pricing.classification] !== undefined) {
        summary.byPricing[m.pricing.classification]++;
      }
      if (summary.byStatus[m.testStatus] !== undefined) {
        summary.byStatus[m.testStatus]++;
      }
    }

    const specializations = ModelSpecializationEngine.generateMatrix(discoveredModels).configs;

    return NextResponse.json({
      success: true,
      branding: 'NEO STUDIO AI by xyrons',
      models: discoveredModels,
      summary,
      specializations,
    });
  } catch (error: any) {
    console.error('[API /api/models/discover] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error during model discovery',
      },
      { status: 500 }
    );
  }
}
