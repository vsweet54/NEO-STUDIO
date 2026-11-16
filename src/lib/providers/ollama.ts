import {
  TextGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export const OLLAMA_CLOUD_URL = 'https://ollama.com';
export const OLLAMA_DEFAULT_MODEL = 'gpt-oss:120b';

export class OllamaAdapter {
  static async testConnection(baseUrl?: string, apiKey?: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const endpoint = (baseUrl || OLLAMA_CLOUD_URL).replace(/\/$/, '');

    if (!apiKey || !apiKey.trim()) {
      return {
        success: false,
        message: 'API Key Ollama Cloud belum diisi. Buat di https://ollama.com/settings/keys lalu tempel di kolom API Key.',
        latencyMs: Date.now() - start,
        modelsFound: 0,
      };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;

      const res = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        headers,
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          success: false,
          message: `Ollama merespons HTTP ${res.status}: ${res.statusText}`,
          latencyMs,
          modelsFound: 0,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models : [];

      const authNote = ' (Ollama Cloud, API Key valid)';

      return {
        success: true,
        message: `Terhubung ke Ollama${authNote} di ${endpoint} (${latencyMs}ms). Ditemukan ${models.length} model aktif.`,
        latencyMs,
        modelsFound: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Tidak dapat menghubungi Ollama Cloud di ${endpoint}. Pastikan API Key valid. Error: ${err.message}`,
        latencyMs: Date.now() - start,
        modelsFound: 0,
      };
    }
  }

  static async generateText(
    options: TextGenerationOptions,
    baseUrl?: string,
    apiKey?: string
  ): Promise<ProviderExecutionResult<{ text: string; rawResponse?: any }>> {
    const start = Date.now();
    const endpoint = (baseUrl || OLLAMA_CLOUD_URL).replace(/\/$/, '');
    let model = options.model || OLLAMA_DEFAULT_MODEL;
    // model lokal lama tidak ada di cloud -> pakai default cloud
    if (model === 'llama3.2' || model === 'qwen2.5') model = OLLAMA_DEFAULT_MODEL;

    if (!apiKey || !apiKey.trim()) {
      return {
        success: false,
        error: 'API Key Ollama Cloud belum diisi (https://ollama.com/settings/keys).',
        durationMs: Date.now() - start,
      };
    }

    try {
      const payload: any = {
        model,
        prompt: options.prompt,
        system: options.systemPrompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      };

      if (options.jsonMode) {
        payload.format = 'json';
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const res = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          success: false,
          error: `Ollama HTTP ${res.status}: ${errText}`,
          durationMs,
        };
      }

      const data = await res.json();
      const text = data.response || '';

      const tokenUsage = data.prompt_eval_count || data.eval_count
        ? {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          }
        : undefined;

      return {
        success: true,
        data: { text, rawResponse: data },
        durationMs,
        tokenUsage,
        estimatedCost: 0.0,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Ollama execution error: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
