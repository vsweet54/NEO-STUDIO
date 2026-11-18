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

    // Sanitize prompt for diffusion models (FLUX.1 Schnell, SDXL, Imagen):
    // Strip out robot meta-instructions, contracts, and grid-lock boilerplate that confuse diffusion models
    const cleanedPrompt = prompt
      .replace(/STORYBOARD\s+GRID\s+LOCK\s*-\s*MANDATORY\.?/gi, '')
      .replace(/Violating any rule below\s*=\s*grid failure\.?/gi, '')
      .replace(/LAYOUT\s*-\s*render EXACTLY\s*\d+\s*panels[^\n.]*[.\n]?/gi, '')
      .replace(/PANEL NUMBER MAP[^\n:]*:\s*/gi, '')
      .replace(/\[VIDEO FRAME ZERO CONTRACT[^\]]*\]/gi, '')
      .replace(/GOOGLE FLOW \/ VEO 2[^\n.]*[.\n]?/gi, '')
      .replace(/FIRST FRAME STATE:\s*/gi, '')
      .replace(/MOTION DYNAMICS:\s*/gi, '')
      .replace(/NEGATIVE CONSTRAINTS:\s*/gi, '')
      .replace(/binding, follow exactly:?\s*/gi, '')
      .replace(/\[Character\]/gi, 'a focused cinematic character')
      .replace(/\[Shot \d+\]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,;.\s]+/, '')
      .replace(/[,;.\s]+$/, '')
      .trim();

    // Translate & Enrich prompt to English visual description for diffusion models (FLUX.1 Schnell / SDXL):
    // Diffusion models ONLY understand English. Non-English or Indonesian prompts produce random, off-topic images.
    let finalPrompt = cleanedPrompt || prompt;

    const indonesianPattern = /\b(adegan|karakter|sedang|berjalan|melihat|membuka|menutup|memegang|duduk|berdiri|tersenyum|tertawa|menangis|marah|takut|kaget|ekspresi|wajah|pintu|meja|kursi|ruangan|gerobak|jalan|pinggir|malam|siang|sore|pagi|lampu|baju|celana|rambut|dengan|di dalam|di luar|pada|saat|menuju|mengambil|meminum|makan|tangan|mata|bicara|warung|makanan|pedagang|cilok|bakso|kopi|minum|masuk|keluar|toko|sekolah|kantor|rumah)\b/i;

    if (indonesianPattern.test(finalPrompt)) {
      try {
        const textKeys = KeyPool.getKeys(apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        if (textKeys.length > 0) {
          const transRes = await GeminiAdapter.generateText(textKeys[0], {
            model: 'gemini-2.0-flash',
            prompt: `You are an expert cinematic storyboard prompt engineer for FLUX.1.
Translate this Indonesian storyboard scene description into an extremely accurate, photorealistic 8K cinematic image prompt in ENGLISH.
Must clearly describe:
- The character's physical traits, pose, and emotion
- The exact action occurring
- The specific props, setting, and environment
- Cinematic lighting and camera framing
Output ONLY the final English prompt. No commentary.

Scene: "${finalPrompt}"`,
            maxTokens: 250,
            temperature: 0.3,
          });

          if (transRes.success && transRes.data?.text) {
            const enriched = transRes.data.text.trim().replace(/^["']|["']$/g, '');
            if (enriched.length > 15) {
              finalPrompt = enriched;
            }
          }
        }
      } catch (err) {
        console.warn('[Image Route] AI prompt translation skipped:', err);
      }

      // Fallback dictionary translation if AI call wasn't available
      if (indonesianPattern.test(finalPrompt)) {
        finalPrompt = finalPrompt
          .replace(/\b(adegan|shot)\s*\d*:?\s*/gi, '')
          .replace(/\bkarakter\b/gi, 'character')
          .replace(/\bsedang berjalan menuju\b/gi, 'walking towards')
          .replace(/\bsedang berjalan\b/gi, 'walking')
          .replace(/\bberjalan\b/gi, 'walking')
          .replace(/\bmelihat ke arah\b/gi, 'looking towards')
          .replace(/\bmelihat\b/gi, 'looking at')
          .replace(/\bmembuka pintu\b/gi, 'opening the door')
          .replace(/\bmelangkah masuk\b/gi, 'stepping inside')
          .replace(/\btersenyum\b/gi, 'smiling warmly')
          .replace(/\bekspresi senang\b/gi, 'cheerful expression')
          .replace(/\bekspresi fokus\b/gi, 'focused expression')
          .replace(/\bdi pinggir jalan\b/gi, 'on an Asian roadside street')
          .replace(/\bgerobak dorong\b/gi, 'traditional street food cart')
          .replace(/\bgerobak cilok\b/gi, 'traditional Indonesian street food cart with steaming pots')
          .replace(/\bpedagang cilok\b/gi, 'Indonesian street food vendor at a cart')
          .replace(/\bwarung\b/gi, 'traditional street-side food stall')
          .replace(/\bpencahayaan sore\b/gi, 'golden hour sunset lighting')
          .replace(/\bmalam hari\b/gi, 'night scene with moody ambient lighting')
          .replace(/\bsiang hari\b/gi, 'bright daylight')
          .replace(/\bdi dalam ruangan\b/gi, 'indoor room interior');
        finalPrompt = `Cinematic 35mm film photograph, ${finalPrompt}, cinematic lighting, photorealistic 8k, highly detailed, masterwork composition`;
      }
    }

    const options = {
      model,
      prompt: finalPrompt,
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
