import { NextRequest, NextResponse } from 'next/server';
import { GeminiAdapter } from '@/lib/providers/gemini';
import { NvidiaAdapter } from '@/lib/providers/nvidia';
import { CloudflareAdapter } from '@/lib/providers/cloudflare';
import { GroqAdapter } from '@/lib/providers/groq';
import { OllamaAdapter } from '@/lib/providers/ollama';
import { OpenRouterAdapter } from '@/lib/providers/openrouter';
import { KeyPool } from '@/lib/providers/key-pool';
import { validateProviderBaseUrl } from '@/lib/security/provider-url';

const TEST_PROMPT = 'Reply with exactly this text and nothing else: NEO_MODEL_TEST_OK';
const MAX_MODEL_ID_LENGTH = 180;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function enforceLocalRateLimit(ip: string): boolean {
  const now = Date.now();
  const current = requestBuckets.get(ip);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ success: false, error: 'Cross-origin request ditolak.' }, { status: 403 });
  }
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!enforceLocalRateLimit(forwardedFor)) {
    return NextResponse.json({ success: false, error: 'Batas tes model tercapai. Coba lagi satu menit.' }, { status: 429 });
  }
  try {
    const body = await req.json();
    const { providerId, modelId, apiKey, accountId } = body ?? {};
    if (typeof providerId !== 'string' || !['gemini', 'nvidia', 'cloudflare', 'groq', 'ollama', 'openrouter'].includes(providerId)) {
      return NextResponse.json({ success: false, error: 'Provider tidak didukung.' }, { status: 400 });
    }
    if (typeof modelId !== 'string' || !modelId.trim() || modelId.length > MAX_MODEL_ID_LENGTH || !/^[A-Za-z0-9@._:/-]+$/.test(modelId) || modelId.includes('..')) {
      return NextResponse.json({ success: false, error: 'Model ID tidak valid.' }, { status: 400 });
    }
    if (providerId === 'cloudflare' && !modelId.startsWith('@cf/')) {
      return NextResponse.json({ success: false, error: 'Cloudflare model ID harus menggunakan prefix @cf/.' }, { status: 400 });
    }
    const baseUrl = validateProviderBaseUrl(providerId, body.baseUrl);
    const options = { model: modelId.trim(), prompt: TEST_PROMPT, temperature: 0, maxTokens: 48 };
    let result: any;

    switch (providerId) {
      case 'gemini': {
        const keys = KeyPool.getKeys(apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        if (!keys.length) return NextResponse.json({ success: false, error: 'gemini API key tidak ditemukan.' }, { status: 400 });
        result = await GeminiAdapter.generateText(keys[0], options);
        break;
      }
      case 'groq': {
        const keys = KeyPool.getKeys(apiKey, ['GROQ_API_KEY', 'GROQ_API_KEYS']);
        if (!keys.length) return NextResponse.json({ success: false, error: 'groq API key tidak ditemukan.' }, { status: 400 });
        result = await GroqAdapter.generateText(keys[0], options, baseUrl);
        break;
      }
      case 'nvidia': {
        const keys = KeyPool.getKeys(apiKey, ['NVIDIA_API_KEY', 'NVIDIA_API_KEYS']);
        if (!keys.length) return NextResponse.json({ success: false, error: 'nvidia API key tidak ditemukan.' }, { status: 400 });
        result = await NvidiaAdapter.generateText(keys[0], options, baseUrl);
        break;
      }
      case 'openrouter': {
        const keys = KeyPool.getKeys(apiKey, ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS']);
        if (!keys.length) return NextResponse.json({ success: false, error: 'openrouter API key tidak ditemukan.' }, { status: 400 });
        result = await OpenRouterAdapter.generateText(keys[0], options, baseUrl);
        break;
      }
      case 'cloudflare': {
        const pairs = KeyPool.getCloudflarePairs(apiKey, accountId);
        if (!pairs.length) return NextResponse.json({ success: false, error: 'Cloudflare API key dan Account ID wajib diisi.' }, { status: 400 });
        result = await CloudflareAdapter.generateText(pairs[0].apiKey, pairs[0].accountId, options);
        break;
      }
      case 'ollama': {
        const keys = KeyPool.getKeys(apiKey, ['OLLAMA_API_KEY', 'OLLAMA_API_KEYS']);
        result = await OllamaAdapter.generateText(options, baseUrl, keys[0]);
        break;
      }
    }

    const responseText = result?.data?.text;
    const nonEmpty = typeof responseText === 'string' && responseText.trim().length > 0;
    const exactMatch = nonEmpty && responseText.trim().includes('NEO_MODEL_TEST_OK');
    const success = Boolean(result?.success && nonEmpty);
    return NextResponse.json({
      success,
      providerId,
      modelId: modelId.trim(),
      capabilityTested: 'text-generation',
      capabilityVerified: success,
      checks: { requestSucceeded: Boolean(result?.success), nonEmptyOutput: nonEmpty, instructionMatch: Boolean(exactMatch) },
      score: success ? (exactMatch ? 100 : 70) : 0,
      latencyMs: result?.durationMs ?? Date.now() - startedAt,
      tokenUsage: result?.tokenUsage,
      estimatedCost: result?.estimatedCost,
      outputPreview: nonEmpty ? responseText.slice(0, 240) : undefined,
      error: result?.error,
      testedAt: new Date().toISOString(),
      note: 'Skor ini hanya smoke-test kemampuan text dan bukan benchmark kualitas menyeluruh. Harga tidak disimpulkan dari tes ini.'
    }, { status: success ? 200 : 502 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Model test failed.', latencyMs: Date.now() - startedAt }, { status: 400 });
  }
}
