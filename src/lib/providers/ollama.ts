import {
  TextGenerationOptions,
  ProviderExecutionResult,
  ProviderConnectionTestResult,
} from './types';

export class OllamaAdapter {
  private static cachedActiveModel?: { endpoint: string; model: string; timestamp: number };

  /**
   * Helper to query available active models from /api/tags
   */
  static async getAvailableModels(baseUrl?: string, apiKey?: string): Promise<string[]> {
    const endpoint = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }
      const res = await fetch(`${endpoint}/api/tags`, { method: 'GET', headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          return data.models.map((m: any) => m.name || m.model).filter(Boolean);
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  static async testConnection(baseUrl?: string, apiKey?: string): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const endpoint = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    const isRemote = Boolean(
      endpoint &&
      !endpoint.includes('localhost') &&
      !endpoint.includes('127.0.0.1') &&
      !endpoint.includes('0.0.0.0')
    );

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

      if (models.length > 0) {
        this.cachedActiveModel = {
          endpoint,
          model: models[0].name || models[0].model,
          timestamp: Date.now(),
        };
      }

      const modeLabel = isRemote ? 'Cloud / Remote' : 'Lokal Offline';
      const authNote = apiKey ? ' (Terautentikasi API Key)' : '';

      return {
        success: true,
        message: `Terhubung ke Ollama [${modeLabel}]${authNote} di ${endpoint} (${latencyMs}ms). Ditemukan ${models.length} model aktif.`,
        latencyMs,
        modelsFound: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Tidak dapat menghubungi Ollama di ${endpoint}. Jika menggunakan cloud / remote server, pastikan URL dan API Key valid. Jika lokal, pastikan daemon aktif dan OLLAMA_ORIGINS="*" telah diatur. Error: ${err.message}`,
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

    let model = options.model;
    if (!model) {
      if (
        this.cachedActiveModel &&
        this.cachedActiveModel.endpoint === endpoint &&
        Date.now() - this.cachedActiveModel.timestamp < 300000
      ) {
        model = this.cachedActiveModel.model;
      } else {
        const available = await this.getAvailableModels(endpoint, apiKey);
        if (available.length > 0) {
          model = available[0];
          this.cachedActiveModel = { endpoint, model, timestamp: Date.now() };
        } else {
          model = 'llama3.2';
        }
      }
    }

    const tryExecute = async (
      targetModel: string
    ): Promise<{ success: boolean; res?: Response; errText?: string }> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const payload: any = {
        model: targetModel,
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

      try {
        const res = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          return { success: true, res };
        }

        const errText = await res.text().catch(() => '');

        // Fallback to /api/chat if /api/generate returns 404 or 405
        if (res.status === 404 || res.status === 405) {
          const chatPayload: any = {
            model: targetModel,
            messages: [
              ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
              { role: 'user', content: options.prompt },
            ],
            stream: false,
            options: {
              temperature: options.temperature ?? 0.7,
              num_predict: options.maxTokens ?? 2048,
            },
          };
          if (options.jsonMode) {
            chatPayload.format = 'json';
          }

          const chatRes = await fetch(`${endpoint}/api/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify(chatPayload),
          });

          if (chatRes.ok) {
            return { success: true, res: chatRes };
          }
        }

        return { success: false, res, errText };
      } catch (fetchErr: any) {
        return { success: false, errText: fetchErr.message };
      }
    };

    try {
      let outcome = await tryExecute(model);

      // Auto-recovery: If model not found (404), check error string for suggestions (e.g. "Try glm-5.3-flash:cloud.")
      if (!outcome.success && outcome.errText) {
        const match = outcome.errText.match(/try\s+([a-zA-Z0-9\.\-\:\_\/]+)/i);
        let alternativeModel: string | undefined;

        if (match && match[1]) {
          const suggested = match[1].replace(/^['"]|['"]|[.,;:]+$/g, '').trim();
          if (suggested && suggested !== model && !suggested.includes('pulling')) {
            alternativeModel = suggested;
          }
        }

        // If no suggestion in error text, query available models from /api/tags
        if (!alternativeModel) {
          const available = await this.getAvailableModels(endpoint, apiKey);
          alternativeModel = available.find((m) => m !== model) || (available.length > 0 ? available[0] : undefined);
        }

        if (alternativeModel && alternativeModel !== model) {
          const retryOutcome = await tryExecute(alternativeModel);
          if (retryOutcome.success) {
            outcome = retryOutcome;
            model = alternativeModel;
            this.cachedActiveModel = { endpoint, model: alternativeModel, timestamp: Date.now() };
          }
        }
      }

      const durationMs = Date.now() - start;

      if (!outcome.success || !outcome.res) {
        return {
          success: false,
          error: `Ollama HTTP error: ${outcome.errText || 'Inference failed'}`,
          durationMs,
        };
      }

      const data = await outcome.res.json();
      const text = data.response || data.message?.content || '';

      const tokenUsage =
        data.prompt_eval_count || data.eval_count
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
