import { NextRequest, NextResponse } from 'next/server';
import { GeminiAdapter } from '@/lib/providers/gemini';
import { NvidiaAdapter } from '@/lib/providers/nvidia';
import { CloudflareAdapter } from '@/lib/providers/cloudflare';
import { GroqAdapter } from '@/lib/providers/groq';
import { OllamaAdapter } from '@/lib/providers/ollama';
import { OpenRouterAdapter } from '@/lib/providers/openrouter';
import { KeyPool } from '@/lib/providers/key-pool';
import { validateProviderBaseUrl } from '@/lib/security/provider-url';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      model,
      prompt,
      systemPrompt,
      temperature,
      maxTokens,
      jsonMode,
      apiKey,
      baseUrl,
      accountId,
    } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const safeBaseUrl = validateProviderBaseUrl(providerId, baseUrl);

    const options = {
      model,
      prompt,
      systemPrompt,
      temperature,
      maxTokens,
      jsonMode,
    };

    let result;

    switch (providerId) {
      case 'gemini': {
        const keys = KeyPool.getKeys(apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        result = await KeyPool.executeWithRotation('gemini', keys, (activeKey) =>
          GeminiAdapter.generateText(activeKey, options)
        );
        break;
      }

      case 'nvidia': {
        const keys = KeyPool.getKeys(apiKey, ['NVIDIA_API_KEY', 'NVIDIA_API_KEYS']);
        const endpoint = safeBaseUrl || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
        result = await KeyPool.executeWithRotation('nvidia', keys, (activeKey) =>
          NvidiaAdapter.generateText(activeKey, options, endpoint)
        );
        break;
      }

      case 'cloudflare': {
        const pairs = KeyPool.getCloudflarePairs(apiKey, accountId);
        if (pairs.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Cloudflare API Key dan Account ID wajib diisi. Masukkan key1, key2... dan idakun1, idakun2...' },
            { status: 400 }
          );
        }
        result = await KeyPool.executeCloudflareWithRotation(pairs, (activeKey, activeAcct) =>
          CloudflareAdapter.generateText(activeKey, activeAcct, options)
        );
        break;
      }

      case 'groq': {
        const keys = KeyPool.getKeys(apiKey, ['GROQ_API_KEY', 'GROQ_API_KEYS']);
        const endpoint = safeBaseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
        result = await KeyPool.executeWithRotation('groq', keys, (activeKey) =>
          GroqAdapter.generateText(activeKey, options, endpoint)
        );
        break;
      }

      case 'openrouter': {
        const keys = KeyPool.getKeys(apiKey, ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS']);
        const endpoint = safeBaseUrl || process.env.OPENROUTER_BASE_URL;
        result = await KeyPool.executeWithRotation('openrouter', keys, (activeKey) =>
          OpenRouterAdapter.generateText(activeKey, options, endpoint)
        );
        break;
      }

      case 'ollama': {
        const keys = KeyPool.getKeys(apiKey, ['OLLAMA_API_KEY', 'OLLAMA_API_KEYS']);
        const endpoint = safeBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const activeKey = keys.length > 0 ? keys[0] : undefined;
        result = await OllamaAdapter.generateText(options, endpoint, activeKey);
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported text provider: ${providerId}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Server text generation error: ${err.message || 'Internal error'}`,
      },
      { status: 500 }
    );
  }
}
