import { NextRequest, NextResponse } from 'next/server';
import { GeminiAdapter } from '@/lib/providers/gemini';
import { CloudflareAdapter } from '@/lib/providers/cloudflare';
import { KeyPool } from '@/lib/providers/key-pool';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      model,
      prompt,
      negativePrompt,
      aspectRatio,
      width,
      height,
      steps,
      seed,
      referenceImageBase64,
      apiKey,
      accountId,
    } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const options = {
      model,
      prompt,
      negativePrompt,
      aspectRatio: aspectRatio || '16:9',
      width,
      height,
      steps,
      seed,
      referenceImageBase64,
    };

    let result;

    switch (providerId) {
      case 'gemini': {
        const keys = KeyPool.getKeys(apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        result = await KeyPool.executeWithRotation('gemini', keys, (activeKey) =>
          GeminiAdapter.generateImage(activeKey, options)
        );

        // If Gemini Imagen fails (e.g. 404 predict not available for free AI Studio keys), auto-fallback to Cloudflare FLUX.1 if available
        if (!result.success) {
          const cfPairs = KeyPool.getCloudflarePairs(apiKey, accountId);
          if (cfPairs.length > 0) {
            console.warn(`[Image Route] Gemini Imagen error (${result.error}). Auto-fallbacking to Cloudflare FLUX.1...`);
            result = await KeyPool.executeCloudflareWithRotation(cfPairs, (activeKey, activeAcct) =>
              CloudflareAdapter.generateImage(activeKey, activeAcct, {
                ...options,
                model: '@cf/black-forest-labs/flux-1-schnell',
              })
            );
          }
        }
        break;
      }

      case 'cloudflare': {
        const pairs = KeyPool.getCloudflarePairs(apiKey, accountId);
        if (pairs.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Cloudflare API Key and Account ID are required (set in settings or env)' },
            { status: 400 }
          );
        }
        result = await KeyPool.executeCloudflareWithRotation(pairs, (activeKey, activeAcct) =>
          CloudflareAdapter.generateImage(activeKey, activeAcct, options)
        );
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Provider ${providerId} belum mendukung image generation secara native. Gunakan Google Gemini (Imagen 3) atau Cloudflare Workers AI (FLUX.1).`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Server image generation error: ${err.message || 'Internal error'}`,
      },
      { status: 500 }
    );
  }
}
