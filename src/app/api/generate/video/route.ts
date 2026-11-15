import { NextRequest, NextResponse } from 'next/server';
import { GeminiAdapter } from '@/lib/providers/gemini';
import { KeyPool } from '@/lib/providers/key-pool';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      model,
      prompt,
      durationSeconds,
      aspectRatio,
      firstFrameBase64,
      cameraMovement,
      apiKey,
    } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const options = {
      model: model || 'veo-2.0-generate-001',
      prompt,
      durationSeconds: durationSeconds || 5,
      aspectRatio: aspectRatio || '16:9',
      firstFrameBase64,
      cameraMovement,
    };

    let result;

    switch (providerId) {
      case 'gemini': {
        const keys = KeyPool.getKeys(apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        result = await KeyPool.executeWithRotation('gemini', keys, (activeKey) =>
          GeminiAdapter.generateVideo(activeKey, options)
        );
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Provider ${providerId} belum menyediakan API video generation terintegrasi. Gunakan Google Gemini (Veo 2 preview).`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Server video generation error: ${err.message || 'Internal error'}`,
      },
      { status: 500 }
    );
  }
}
