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
        break;
      }

      case 'cloudflare': {
        const keys = KeyPool.getKeys(apiKey, ['CLOUDFLARE_API_KEY', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEYS']);
        const acctId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
        if (!acctId) {
          return NextResponse.json(
            { success: false, error: 'Cloudflare Account ID is required (set in settings or CLOUDFLARE_ACCOUNT_ID env)' },
            { status: 400 }
          );
        }
        result = await KeyPool.executeWithRotation('cloudflare', keys, (activeKey) =>
          CloudflareAdapter.generateImage(activeKey, acctId, options)
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
