import {
  TextGenerationOptions,
  ImageGenerationOptions,
  AudioGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export class CloudflareAdapter {
  static async testConnection(apiKey: string, accountId?: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const cleanAccountId = (accountId || '').split(',')[0].trim();
    const cleanApiKey = (apiKey || '').split(',')[0].trim();

    if (!cleanAccountId) {
      return {
        success: false,
        message: 'Cloudflare Account ID wajib diisi di pengaturan provider.',
        latencyMs: 0,
        modelsFound: 0,
      };
    }

    try {
      // Test running a lightweight prompt on Llama 3.1 8b
      const testModel = '@cf/meta/llama-3.1-8b-instruct';
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/run/${testModel}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: 'Ping', max_tokens: 5 }),
        }
      );

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.errors?.[0]?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          message: `Koneksi Cloudflare Workers AI gagal: ${msg}`,
          latencyMs,
          modelsFound: 0,
        };
      }

      return {
        success: true,
        message: `Terhubung ke Cloudflare Workers AI (${latencyMs}ms). Edge serverless siap.`,
        latencyMs,
        modelsFound: 4,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Koneksi Cloudflare gagal: ${err.message}`,
        latencyMs: Date.now() - start,
        modelsFound: 0,
      };
    }
  }

  static async generateText(
    apiKey: string,
    accountId: string,
    options: TextGenerationOptions
  ): Promise<ProviderExecutionResult<{ text: string }>> {
    const start = Date.now();
    const cleanAccountId = (accountId || '').split(',')[0].trim();
    const cleanApiKey = (apiKey || '').split(',')[0].trim();
    const model = (options.model && options.model.startsWith('@cf/'))
      ? options.model
      : '@cf/meta/llama-3.1-8b-instruct';

    try {
      const messages = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, max_tokens: options.maxTokens ?? 2048 }),
        }
      );

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.errors?.[0]?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `Cloudflare Workers AI Error: ${msg}`,
          durationMs,
        };
      }

      const data = await res.json();
      const text = data.result?.response || '';

      return {
        success: true,
        data: { text },
        durationMs,
        estimatedCost: 0.00001,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Cloudflare text generation error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  static async generateImage(
    apiKey: string,
    accountId: string,
    options: ImageGenerationOptions
  ): Promise<ProviderExecutionResult<{ imageBase64: string; mimeType: string }>> {
    const start = Date.now();
    const cleanAccountId = (accountId || '').split(',')[0].trim();
    const cleanApiKey = (apiKey || '').split(',')[0].trim();
    const model = (options.model && options.model.startsWith('@cf/'))
      ? options.model
      : '@cf/black-forest-labs/flux-1-schnell';

    try {
      // Map dimensions according to aspect ratio
      let width = 1024;
      let height = 576; // 16:9 default
      if (options.aspectRatio === '9:16') {
        width = 576;
        height = 1024;
      } else if (options.aspectRatio === '1:1') {
        width = 768;
        height = 768;
      } else if (options.aspectRatio === '4:5') {
        width = 640;
        height = 800;
      }

      const payload: any = {
        prompt: options.prompt,
        num_steps: options.steps || 4,
        width,
        height,
      };

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.errors?.[0]?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `Cloudflare Image Error: ${msg}`,
          durationMs,
        };
      }

      const contentType = res.headers.get('content-type') || '';
      let base64 = '';
      let mimeType = 'image/png';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        base64 = data.result?.image || '';
      } else {
        // Direct binary image stream
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64 = buffer.toString('base64');
        mimeType = contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';
      }

      if (!base64) {
        return {
          success: false,
          error: 'Cloudflare AI tidak menghasilkan output gambar valid.',
          durationMs,
        };
      }

      return {
        success: true,
        data: {
          imageBase64: base64,
          mimeType,
        },
        durationMs,
        estimatedCost: 0.005,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Cloudflare image generation error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  static async generateAudio(
    apiKey: string,
    accountId: string,
    options: AudioGenerationOptions
  ): Promise<ProviderExecutionResult<{ audioBase64: string; mimeType: string }>> {
    const start = Date.now();
    const cleanAccountId = (accountId || '').split(',')[0].trim();
    const cleanApiKey = (apiKey || '').split(',')[0].trim();
    const model = (options.model && options.model.startsWith('@cf/'))
      ? options.model
      : '@cf/deepgram/aura-tts';

    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: options.text }),
        }
      );

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.errors?.[0]?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `Cloudflare Audio Error: ${msg}`,
          durationMs,
        };
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const audioBase64 = buffer.toString('base64');

      return {
        success: true,
        data: {
          audioBase64,
          mimeType: 'audio/mpeg',
        },
        durationMs,
        estimatedCost: 0.001,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Cloudflare audio generation error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
