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
    const { providerId, apiKey, baseUrl, accountId } = body;
    const safeBaseUrl = validateProviderBaseUrl(providerId, baseUrl);

    let result;

    switch (providerId) {
      case 'gemini': {
        const keys = KeyPool.getKeys(apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        if (keys.length === 0) {
          return NextResponse.json({ success: false, message: 'Google Gemini API key is missing' }, { status: 400 });
        }
        result = await GeminiAdapter.testConnection(keys[0]);
        if (result.success && keys.length > 1) {
          result.message += ` [Multi-Key Active: ${keys.length} API Keys terdeteksi dengan auto-rotation]`;
        }
        break;
      }

      case 'openrouter': {
        const keys = KeyPool.getKeys(apiKey, ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS']);
        if (keys.length === 0) {
          return NextResponse.json({ success: false, message: 'OpenRouter API key is missing' }, { status: 400 });
        }
        const endpoint = safeBaseUrl || process.env.OPENROUTER_BASE_URL;
        result = await OpenRouterAdapter.testConnection(keys[0], endpoint);
        if (result.success && keys.length > 1) {
          result.message += ` [Multi-Key Active: ${keys.length} API Keys terdeteksi dengan auto-rotation]`;
        }
        break;
      }

      case 'nvidia': {
        const keys = KeyPool.getKeys(apiKey, ['NVIDIA_API_KEY', 'NVIDIA_API_KEYS']);
        if (keys.length === 0) {
          return NextResponse.json({ success: false, message: 'NVIDIA API key is missing' }, { status: 400 });
        }
        const endpoint = safeBaseUrl || process.env.NVIDIA_BASE_URL;
        result = await NvidiaAdapter.testConnection(keys[0], endpoint);
        if (result.success && keys.length > 1) {
          result.message += ` [Multi-Key Active: ${keys.length} API Keys terdeteksi dengan auto-rotation]`;
        }
        break;
      }

      case 'cloudflare': {
        const pairs = KeyPool.getCloudflarePairs(apiKey, accountId);
        if (pairs.length === 0) {
          return NextResponse.json(
            { success: false, message: 'Cloudflare API Token dan Account ID wajib diisi.' },
            { status: 400 }
          );
        }
        result = await CloudflareAdapter.testConnection(pairs[0].apiKey, pairs[0].accountId);
        if (result.success && pairs.length > 1) {
          result.message += ` [Multi-Key Active: ${pairs.length} Cloudflare (Key, Account ID) pairs terdeteksi dengan auto-rotation urut]`;
        }
        break;
      }

      case 'groq': {
        const keys = KeyPool.getKeys(apiKey, ['GROQ_API_KEY', 'GROQ_API_KEYS']);
        if (keys.length === 0) {
          return NextResponse.json({ success: false, message: 'Groq API key is missing' }, { status: 400 });
        }
        const endpoint = safeBaseUrl || process.env.GROQ_BASE_URL;
        result = await GroqAdapter.testConnection(keys[0], endpoint);
        if (result.success && keys.length > 1) {
          result.message += ` [Multi-Key Active: ${keys.length} API Keys terdeteksi dengan auto-rotation]`;
        }
        break;
      }

      case 'ollama': {
        const keys = KeyPool.getKeys(apiKey, ['OLLAMA_API_KEY', 'OLLAMA_API_KEYS']);
        const endpoint = safeBaseUrl || process.env.OLLAMA_BASE_URL;
        result = await OllamaAdapter.testConnection(endpoint, keys.length > 0 ? keys[0] : undefined);
        if (result.success && keys.length > 1) {
          result.message += ` [Multi-Key Active: ${keys.length} API Keys terdeteksi]`;
        }
        break;
      }

      default:
        return NextResponse.json({ success: false, message: `Unknown provider: ${providerId}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Error testing provider connection: ${err.message}`,
        latencyMs: 0,
        modelsFound: 0,
      },
      { status: 500 }
    );
  }
}
