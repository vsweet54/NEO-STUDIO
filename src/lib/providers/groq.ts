import {
  TextGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export class GroqAdapter {
  static async testConnection(apiKey: string, baseUrl?: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const endpoint = baseUrl || 'https://api.groq.com/openai/v1';

    try {
      const res = await fetch(`${endpoint}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          message: `Koneksi Groq gagal: ${msg}`,
          latencyMs,
          modelsFound: 0,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.data) ? data.data : [];

      return {
        success: true,
        message: `Terhubung ke Groq LPU API (${latencyMs}ms). Ditemukan ${models.length} model aktif.`,
        latencyMs,
        modelsFound: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Koneksi Groq gagal: ${err.message}`,
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
    const endpoint = baseUrl || 'https://api.groq.com/openai/v1';
    const model = options.model || 'llama-3.3-70b-versatile';

    try {
      const messages: any[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });

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
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;

        // If 70B model is not available or restricted on this Groq tier, auto retry with 8B instant
        if ((msg.includes('does not exist') || msg.includes('do not have access')) && model !== 'llama-3.1-8b-instant') {
          console.warn(`[Groq] Model ${model} not available on account tier. Retrying with llama-3.1-8b-instant...`);
          return this.generateText(apiKey, { ...options, model: 'llama-3.1-8b-instant' }, baseUrl);
        }

        return {
          success: false,
          error: `Groq LPU Error: ${msg}`,
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

      const estimatedCost = tokenUsage ? (tokenUsage.totalTokens / 1000) * 0.00059 : undefined;

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
        error: `Groq execution error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
