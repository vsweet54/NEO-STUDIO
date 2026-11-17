import {
  TextGenerationOptions,
  ImageGenerationOptions,
  VideoGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export class GeminiAdapter {
  static async testConnection(apiKey: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          message: `Koneksi Gemini gagal: ${errMsg}`,
          latencyMs,
          modelsFound: 0,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models : [];

      return {
        success: true,
        message: `Terhubung ke Google Gemini API (${latencyMs}ms). Ditemukan ${models.length} model.`,
        latencyMs,
        modelsFound: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Koneksi gagal: ${err.message || 'Network error'}`,
        latencyMs: Date.now() - start,
        modelsFound: 0,
      };
    }
  }

  static async generateText(
    apiKey: string,
    options: TextGenerationOptions
  ): Promise<ProviderExecutionResult<{ text: string; rawResponse?: any }>> {
    const start = Date.now();
    const model = options.model || 'gemini-2.0-flash';

    try {
      const bodyPayload: any = {
        contents: [
          {
            parts: [{ text: options.prompt }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 4096,
        },
      };

      if (options.systemPrompt) {
        bodyPayload.systemInstruction = {
          parts: [{ text: options.systemPrompt }],
        };
      }

      if (options.jsonMode) {
        bodyPayload.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        }
      );

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `Gemini API Error: ${msg}`,
          durationMs,
        };
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';

      const usage = data.usageMetadata;
      const tokenUsage = usage
        ? {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0,
          }
        : undefined;

      // Estimate cost ($0.0001 per 1k tokens for Flash)
      const estimatedCost = tokenUsage ? (tokenUsage.totalTokens / 1000) * 0.0001 : undefined;

      return {
        success: true,
        data: { text, rawResponse: data },
        durationMs,
        tokenUsage,
        estimatedCost,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Gemini execution error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  static async generateImage(
    apiKey: string,
    options: ImageGenerationOptions
  ): Promise<ProviderExecutionResult<{ imageBase64: string; mimeType: string }>> {
    const start = Date.now();
    const model = options.model || 'imagen-3.0-generate-002';

    try {
      // Map aspect ratio for Imagen 3: "1:1", "3:4", "4:3", "9:16", "16:9"
      let formattedRatio = '16:9';
      if (options.aspectRatio === '9:16') formattedRatio = '9:16';
      else if (options.aspectRatio === '1:1') formattedRatio = '1:1';
      else if (options.aspectRatio === '4:5') formattedRatio = '3:4';
      else if (options.aspectRatio === '21:9' || options.aspectRatio === '2.39:1') formattedRatio = '16:9';

      const payload = {
        instances: [{ prompt: options.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: formattedRatio,
          personGeneration: 'ALLOW_ADULT',
          safetySetting: 'block_medium_and_above',
        },
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `Imagen 3 Error: ${msg}`,
          durationMs,
        };
      }

      const data = await res.json();
      const base64Data = data.predictions?.[0]?.bytesBase64Encoded;

      if (!base64Data) {
        return {
          success: false,
          error: 'Imagen 3 tidak mengembalikan data gambar yang valid.',
          durationMs,
        };
      }

      return {
        success: true,
        data: {
          imageBase64: base64Data,
          mimeType: 'image/png',
        },
        durationMs,
        estimatedCost: 0.03, // Standard Imagen 3 image cost
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Imagen generation error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  static async generateVideo(
    apiKey: string,
    options: VideoGenerationOptions
  ): Promise<ProviderExecutionResult<{ videoUrl?: string; jobId?: string; status: string }>> {
    const start = Date.now();
    const model = options.model || 'veo-2.0-generate-001';

    try {
      // Veo 2 uses predict / long running operation
      const payload: any = {
        instances: [{ prompt: options.prompt }],
        parameters: {
          aspectRatio: options.aspectRatio === '9:16' ? '9:16' : '16:9',
          durationSeconds: options.durationSeconds || 5,
        },
      };

      if (options.firstFrameBase64) {
        payload.instances[0].image = {
          bytesBase64Encoded: options.firstFrameBase64,
        };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `Google Veo Error: ${msg}. Pastikan project GCP / API Key Anda memiliki akses ke model Veo preview.`,
          durationMs,
        };
      }

      const data = await res.json();
      return {
        success: true,
        data: {
          status: 'completed',
          videoUrl: data.predictions?.[0]?.videoUri || data.predictions?.[0]?.bytesBase64Encoded,
        },
        durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Veo Video Generation Error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
