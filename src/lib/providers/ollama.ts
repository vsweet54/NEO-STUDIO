import {
  TextGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export class OllamaAdapter {
  static async testConnection(baseUrl?: string, apiKey?: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const endpoint = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

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

      const authNote = apiKey ? ' (Terautentikasi API Key)' : '';

      return {
        success: true,
        message: `Terhubung ke Ollama${authNote} di ${endpoint} (${latencyMs}ms). Ditemukan ${models.length} model aktif.`,
        latencyMs,
        modelsFound: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Tidak dapat menghubungi Ollama di ${endpoint}. Jika menggunakan remote server, pastikan URL dan API Key valid. Jika lokal, pastikan daemon aktif dan OLLAMA_ORIGINS="*" telah diatur. Error: ${err.message}`,
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
    const endpoint = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    const model = options.model || 'llama3.2';

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
