import { NextRequest, NextResponse } from 'next/server';
import { CloudflareAdapter } from '@/lib/providers/cloudflare';
import { KeyPool } from '@/lib/providers/key-pool';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, model, text, apiKey, accountId, voice, speed, pitch } = body;

    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required for TTS' }, { status: 400 });
    }

    const options = {
      model: model || '@cf/deepgram/aura-tts',
      text,
      voice,
      speed,
      pitch,
    };

    let result;

    switch (providerId) {
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
          CloudflareAdapter.generateAudio(activeKey, acctId, options)
        );
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Provider ${providerId} belum mendukung audio TTS secara native. Gunakan Cloudflare Workers AI.`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Server audio generation error: ${err.message || 'Internal error'}`,
      },
      { status: 500 }
    );
  }
}
