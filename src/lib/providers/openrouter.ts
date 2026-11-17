import {
  TextGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export class OpenRouterAdapter {
  static async testConnection(apiKey: string, baseUrl?: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const endpoint = (baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    try {
      const res = await fetch(`${endpoint}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        // Fallback test to models endpoint
        const modelsRes = await fetch(`${endpoint}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
          },
        });

        if (!modelsRes.ok) {
          const errJson = await modelsRes.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
          return {
            success: false,
            message: `Koneksi OpenRouter gagal: ${errMsg}`,
            latencyMs,
            modelsFound: 0,
          };
        }

        const modelsData = await modelsRes.json();
        return {
          success: true,
          message: `Terhubung ke OpenRouter API (${latencyMs}ms). Ditemukan ${modelsData.data?.length || 100}+ model aktif.`,
          latencyMs,
          modelsFound: modelsData.data?.length || 100,
        };
      }

      const keyData = await res.json();
      const label = keyData.data?.label || 'Active Key';
      const limit = keyData.data?.limit ? `$${keyData.data.limit}` : 'Unlimited';

      return {
        success: true,
        message: `Terhubung ke OpenRouter API (${latencyMs}ms). Key: "${label}", Limit: ${limit}.`,
        latencyMs,
        modelsFound: 200,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Koneksi OpenRouter gagal: ${err.message || 'Network error'}`,
        latencyMs: Date.now() - start,
        modelsFound: 0,
      };
    }
  }

  static async generateText(
    apiKey: string,
    options: TextGenerationOptions,
    baseUrl?: string
  ): Promise<ProviderExecutionResult<{ text: string; rawResponse?: any }>> {
    const start = Date.now();
    const model = options.model || 'deepseek/deepseek-r1';
    const endpoint = (baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

    try {
      const messages: any[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      if (options.referenceImageBase64) {
        const imgUrl = options.referenceImageBase64.startsWith('data:')
          ? options.referenceImageBase64
          : `data:image/png;base64,${options.referenceImageBase64}`;
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: options.prompt },
            { type: 'image_url', image_url: { url: imgUrl } },
          ],
        });
      } else {
        messages.push({ role: 'user', content: options.prompt });
      }

      const payload: any = {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
      };

      if (options.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://neostudio.ai',
          'X-Title': 'NEO STUDIO AI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          error: `OpenRouter Error: ${msg}`,
          durationMs,
        };
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';

      const usage = data.usage;
      const tokenUsage = usage
        ? {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          }
        : undefined;

      return {
        success: true,
        data: { text, rawResponse: data },
        durationMs,
        tokenUsage,
        estimatedCost: tokenUsage ? (tokenUsage.totalTokens / 1000) * 0.0005 : undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `OpenRouter execution error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
