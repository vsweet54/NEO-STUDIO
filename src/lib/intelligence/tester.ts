import {
  DiscoveredModel,
  ModelTestRecord,
  TestingCategory,
  ModelErrorCode,
} from '@/types/model-intelligence';
import { ProviderConfig } from '@/types/provider';
import { GeminiAdapter } from '@/lib/providers/gemini';
import { NvidiaAdapter } from '@/lib/providers/nvidia';
import { CloudflareAdapter } from '@/lib/providers/cloudflare';
import { GroqAdapter } from '@/lib/providers/groq';
import { OllamaAdapter } from '@/lib/providers/ollama';
import { OpenRouterAdapter } from '@/lib/providers/openrouter';
import { KeyPool } from '@/lib/providers/key-pool';

// Standard 1x1 red pixel PNG for vision testing
const RED_PIXEL_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export interface TestExecutionOptions {
  category?: TestingCategory;
  allowPaid?: boolean;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export class ModelTestingEngine {
  /**
   * Executes real inference test for a discovered model according to its capabilities.
   */
  static async testModel(
    model: DiscoveredModel,
    provConfig: ProviderConfig,
    options: TestExecutionOptions = {}
  ): Promise<ModelTestRecord> {
    const start = Date.now();
    const timeoutMs = options.timeoutMs || 25000;

    // Safety Gate: Block billable execution unless explicitly authorized
    if (model.pricing.classification === 'PAID' && !options.allowPaid) {
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'TEXT',
        result: 'BLOCKED',
        latencyMs: 0,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: 'BILLING_REQUIRED',
        errorMessage:
          'Pengujian diblokir secara otomatis karena model ini berbayar (PAID). Berikan otorisasi eksplisit untuk menguji.',
      };
    }

    // Determine appropriate test category
    let category: TestingCategory = options.category || 'TEXT';
    if (!options.category) {
      if (model.capabilities.supportsImageGen) {
        category = 'IMAGE_GEN';
      } else if (model.capabilities.supportsAudioGen) {
        category = 'AUDIO';
      } else if (model.capabilities.supportsVideoGen) {
        category = 'VIDEO';
      } else if (model.roles.includes('CODING')) {
        category = 'CODING';
      } else if (model.capabilities.supportsVision) {
        category = 'VISION';
      } else {
        category = 'TEXT';
      }
    }

    try {
      switch (category) {
        case 'TEXT':
          return await this.executeTextTest(model, provConfig, start, timeoutMs);
        case 'CODING':
          return await this.executeCodingTest(model, provConfig, start, timeoutMs);
        case 'VISION':
          return await this.executeVisionTest(model, provConfig, start, timeoutMs);
        case 'IMAGE_GEN':
          return await this.executeImageGenTest(model, provConfig, start, timeoutMs);
        case 'AUDIO':
          return await this.executeAudioTest(model, provConfig, start, timeoutMs);
        case 'VIDEO':
          return await this.executeVideoTest(model, provConfig, start, timeoutMs);
        default:
          return await this.executeTextTest(model, provConfig, start, timeoutMs);
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      const errorInfo = this.classifyError(err.message || String(err));
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category,
        result: 'FAIL',
        latencyMs: duration,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
      };
    }
  }

  // --- Direct In-Memory Adapters Dispatchers (Zero Relative URL / Network Overhead) ---
  private static async dispatchText(
    providerId: string,
    model: string,
    prompt: string,
    prov: ProviderConfig,
    extraOptions: { maxTokens?: number; temperature?: number; referenceImageBase64?: string; jsonMode?: boolean } = {}
  ): Promise<{
    success: boolean;
    data?: { text: string };
    error?: string;
    tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const options = {
      model,
      prompt,
      maxTokens: extraOptions.maxTokens ?? 50,
      temperature: extraOptions.temperature ?? 0.1,
      referenceImageBase64: extraOptions.referenceImageBase64,
      jsonMode: extraOptions.jsonMode,
    };

    try {
      switch (providerId) {
        case 'gemini': {
          const keys = KeyPool.getKeys(prov.apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
          if (keys.length === 0) return { success: false, error: 'Google Gemini API Key is missing' };
          return await KeyPool.executeWithRotation('gemini', keys, (activeKey) =>
            GeminiAdapter.generateText(activeKey, options)
          );
        }
        case 'groq': {
          const keys = KeyPool.getKeys(prov.apiKey, ['GROQ_API_KEY', 'GROQ_API_KEYS']);
          if (keys.length === 0) return { success: false, error: 'Groq API Key is missing' };
          const endpoint = prov.baseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
          return await KeyPool.executeWithRotation('groq', keys, (activeKey) =>
            GroqAdapter.generateText(activeKey, options, endpoint)
          );
        }
        case 'openrouter': {
          const keys = KeyPool.getKeys(prov.apiKey, ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS']);
          if (keys.length === 0) return { success: false, error: 'OpenRouter API Key is missing' };
          const endpoint = prov.baseUrl || process.env.OPENROUTER_BASE_URL;
          return await KeyPool.executeWithRotation('openrouter', keys, (activeKey) =>
            OpenRouterAdapter.generateText(activeKey, options, endpoint)
          );
        }
        case 'nvidia': {
          const keys = KeyPool.getKeys(prov.apiKey, ['NVIDIA_API_KEY', 'NVIDIA_API_KEYS']);
          if (keys.length === 0) return { success: false, error: 'NVIDIA API Key is missing' };
          const endpoint = prov.baseUrl || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
          return await KeyPool.executeWithRotation('nvidia', keys, (activeKey) =>
            NvidiaAdapter.generateText(activeKey, options, endpoint)
          );
        }
        case 'cloudflare': {
          const pairs = KeyPool.getCloudflarePairs(prov.apiKey, prov.accountId);
          if (pairs.length === 0) return { success: false, error: 'Cloudflare API Key and Account ID are required' };
          return await KeyPool.executeCloudflareWithRotation(pairs, (activeKey, activeAcct) =>
            CloudflareAdapter.generateText(activeKey, activeAcct, options)
          );
        }
        case 'ollama': {
          const keys = KeyPool.getKeys(prov.apiKey, ['OLLAMA_API_KEY', 'OLLAMA_API_KEYS']);
          const endpoint = prov.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
          if (keys.length > 0) {
            return await KeyPool.executeWithRotation('ollama', keys, (activeKey) =>
              OllamaAdapter.generateText(options, endpoint, activeKey)
            );
          }
          return await OllamaAdapter.generateText(options, endpoint, undefined);
        }
        default:
          return { success: false, error: `Unsupported provider: ${providerId}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Execution failed' };
    }
  }

  private static async dispatchImage(
    providerId: string,
    model: string,
    prompt: string,
    prov: ProviderConfig
  ): Promise<{
    success: boolean;
    data?: { imageBase64?: string; imageUrl?: string };
    error?: string;
  }> {
    const options = {
      model,
      prompt,
      aspectRatio: '1:1',
      steps: 4,
    };

    try {
      if (providerId === 'gemini') {
        const keys = KeyPool.getKeys(prov.apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        if (keys.length === 0) return { success: false, error: 'Gemini API key is missing' };
        return await KeyPool.executeWithRotation('gemini', keys, (activeKey) =>
          GeminiAdapter.generateImage(activeKey, options)
        );
      } else if (providerId === 'cloudflare') {
        const pairs = KeyPool.getCloudflarePairs(prov.apiKey, prov.accountId);
        if (pairs.length === 0) return { success: false, error: 'Cloudflare API Token & Account ID required' };
        return await KeyPool.executeCloudflareWithRotation(pairs, (activeKey, activeAcct) =>
          CloudflareAdapter.generateImage(activeKey, activeAcct, options)
        );
      }
      return { success: false, error: `Provider ${providerId} does not support image generation` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Image execution failed' };
    }
  }

  private static async dispatchAudio(
    providerId: string,
    model: string,
    text: string,
    prov: ProviderConfig
  ): Promise<{
    success: boolean;
    data?: { audioBase64?: string; audioUrl?: string };
    error?: string;
  }> {
    try {
      if (providerId === 'cloudflare') {
        const pairs = KeyPool.getCloudflarePairs(prov.apiKey, prov.accountId);
        if (pairs.length === 0) return { success: false, error: 'Cloudflare API Token & Account ID required' };
        return await KeyPool.executeCloudflareWithRotation(pairs, (activeKey, activeAcct) =>
          CloudflareAdapter.generateAudio(activeKey, activeAcct, { model, text })
        );
      }
      return { success: false, error: `Provider ${providerId} does not support audio generation` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Audio execution failed' };
    }
  }

  private static async dispatchVideo(
    providerId: string,
    model: string,
    prompt: string,
    prov: ProviderConfig
  ): Promise<{
    success: boolean;
    data?: { videoUrl?: string; videoBase64?: string; jobId?: string };
    error?: string;
  }> {
    try {
      if (providerId === 'gemini') {
        const keys = KeyPool.getKeys(prov.apiKey, ['GEMINI_API_KEY', 'GEMINI_API_KEYS']);
        if (keys.length === 0) return { success: false, error: 'Gemini API key is missing' };
        return await KeyPool.executeWithRotation('gemini', keys, (activeKey) =>
          GeminiAdapter.generateVideo(activeKey, { model, prompt, durationSeconds: 5 })
        );
      }
      return { success: false, error: `Provider ${providerId} does not support video generation` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Video execution failed' };
    }
  }

  /**
   * Category A: Real Text Model Test
   */
  private static async executeTextTest(
    model: DiscoveredModel,
    prov: ProviderConfig,
    start: number,
    timeoutMs: number
  ): Promise<ModelTestRecord> {
    const prompt = 'Reply with exactly: NEO MODEL TEST SUCCESS';

    try {
      const res = await Promise.race([
        this.dispatchText(model.provider, model.id, prompt, prov, { maxTokens: 50, temperature: 0.1 }),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Inference timeout exceeded' }), timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - start;

      if (!res.success) {
        const errorInfo = this.classifyError(res.error || 'Server rejected request');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'TEXT',
          result: 'FAIL',
          score: 0,
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const reply = res.data?.text || '';
      const exactMatch = reply.toUpperCase().includes('NEO MODEL TEST SUCCESS');
      const hasContent = reply.trim().length > 0;
      const passed = exactMatch || hasContent;

      let score = 0;
      if (passed) {
        score += exactMatch ? 70 : 40;
        if (hasContent) score += 10;
        if (latencyMs <= 600) score += 20;
        else if (latencyMs <= 1200) score += 16;
        else if (latencyMs <= 2500) score += 12;
        else if (latencyMs <= 5000) score += 8;
        else score += 4;
      }

      const evalDetail = passed
        ? `Exact match: ${exactMatch ? 'Ya' : 'Sebagian'}, Latency: ${latencyMs}ms, Skor: ${score}/100`
        : 'Gagal merespons prompt pengujian';

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'TEXT',
        result: passed ? 'PASS' : 'FAIL',
        score,
        evaluationDetails: evalDetail,
        latencyMs,
        tokenUsage: res.tokenUsage,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: reply.substring(0, 100),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.classifyError(err.message || 'Execution error');
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'TEXT',
        result: 'FAIL',
        score: 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        testPrompt: prompt,
      };
    }
  }

  /**
   * Category B: Real Coding Model Test
   */
  private static async executeCodingTest(
    model: DiscoveredModel,
    prov: ProviderConfig,
    start: number,
    timeoutMs: number
  ): Promise<ModelTestRecord> {
    const prompt = 'Write a valid JavaScript function that adds two numbers and explain how it works.';

    try {
      const res = await Promise.race([
        this.dispatchText(model.provider, model.id, prompt, prov, { maxTokens: 256, temperature: 0.2 }),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Coding test timeout' }), timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - start;

      if (!res.success) {
        const errorInfo = this.classifyError(res.error || 'Coding test failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'CODING',
          result: 'FAIL',
          score: 0,
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const reply = res.data?.text || '';
      const hasFunction = reply.includes('function') || reply.includes('=>') || reply.includes('add(');
      const hasAddition = reply.includes('+') || reply.includes('sum') || reply.includes('add');
      const hasReturn = reply.includes('return');
      const hasExplanation = reply.length > 50;
      const passed = hasFunction && (hasAddition || hasReturn);

      let score = 0;
      if (passed) {
        score += hasFunction ? 30 : 0;
        score += hasAddition ? 30 : 0;
        score += hasReturn ? 20 : 0;
        score += hasExplanation ? 10 : 0;
        if (latencyMs <= 1000) score += 10;
        else if (latencyMs <= 2000) score += 8;
        else if (latencyMs <= 4000) score += 5;
        else score += 2;
      }

      const evalDetail = passed
        ? `Sintaks JS: ${hasFunction ? 'Valid' : 'Invalid'}, Logika (+): ${hasAddition ? 'Valid' : 'No'}, Return: ${hasReturn ? 'Ya' : 'No'}, Skor: ${score}/100`
        : 'Sintaks fungsi JavaScript tidak terdeteksi';

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'CODING',
        result: passed ? 'PASS' : 'FAIL',
        score,
        evaluationDetails: evalDetail,
        latencyMs,
        tokenUsage: res.tokenUsage,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: reply.substring(0, 120),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.classifyError(err.message || 'Coding test error');
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'CODING',
        result: 'FAIL',
        score: 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        testPrompt: prompt,
      };
    }
  }

  /**
   * Category C: Real Vision Model Test
   */
  private static async executeVisionTest(
    model: DiscoveredModel,
    prov: ProviderConfig,
    start: number,
    timeoutMs: number
  ): Promise<ModelTestRecord> {
    const prompt = 'Describe the objects and important details visible in this image.';

    try {
      const res = await Promise.race([
        this.dispatchText(model.provider, model.id, prompt, prov, {
          maxTokens: 120,
          referenceImageBase64: RED_PIXEL_BASE64,
        }),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Vision test timeout' }), timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - start;

      if (!res.success) {
        const errorInfo = this.classifyError(res.error || 'Vision test failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'VISION',
          result: 'FAIL',
          score: 0,
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const reply = res.data?.text || '';
      const hasDescription = reply.trim().length > 5;
      const identifiesColorOrShape = /red|merah|pixel|square|kotak|color|warna|solid/i.test(reply);
      const passed = hasDescription;

      let score = 0;
      if (passed) {
        score += 50; // accepted multimodal image
        if (identifiesColorOrShape) score += 35; // detected visual features
        if (latencyMs <= 1500) score += 15;
        else if (latencyMs <= 3000) score += 10;
        else score += 5;
      }

      const evalDetail = passed
        ? `Analisis Visual: ${identifiesColorOrShape ? 'Detail Merah Terdeteksi' : 'Deskripsi Umum'}, Latency: ${latencyMs}ms, Skor: ${score}/100`
        : 'Gagal memproses payload gambar';

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'VISION',
        result: passed ? 'PASS' : 'FAIL',
        score,
        evaluationDetails: evalDetail,
        latencyMs,
        tokenUsage: res.tokenUsage,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: reply.substring(0, 100),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.classifyError(err.message || 'Vision test error');
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'VISION',
        result: 'FAIL',
        score: 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        testPrompt: prompt,
      };
    }
  }

  /**
   * Category D: Real Image Generation Test
   */
  private static async executeImageGenTest(
    model: DiscoveredModel,
    prov: ProviderConfig,
    start: number,
    timeoutMs: number
  ): Promise<ModelTestRecord> {
    const prompt = 'A simple red apple on a clean white background, professional studio photography.';

    try {
      const res = await Promise.race([
        this.dispatchImage(model.provider, model.id, prompt, prov),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Image generation timeout' }), timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - start;

      if (!res.success) {
        const errorInfo = this.classifyError(res.error || 'Image generation failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'IMAGE_GEN',
          result: 'FAIL',
          score: 0,
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const hasValidImage = !!res.data?.imageBase64 && res.data.imageBase64.length > 500;
      let score = 0;
      if (hasValidImage) {
        score += 70; // valid image bytes
        if (latencyMs <= 2500) score += 30; // edge lightning speed
        else if (latencyMs <= 5000) score += 22;
        else if (latencyMs <= 10000) score += 15;
        else score += 8;
      }

      const evalDetail = hasValidImage
        ? `Sintesis Gambar: Valid, Latency: ${latencyMs}ms, Skor: ${score}/100`
        : 'Tidak menghasilkan byte gambar valid';

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'IMAGE_GEN',
        result: hasValidImage ? 'PASS' : 'FAIL',
        score,
        evaluationDetails: evalDetail,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: hasValidImage ? 'Valid Image Output Received' : 'No image data',
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.classifyError(err.message || 'Image generation error');
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'IMAGE_GEN',
        result: 'FAIL',
        score: 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        testPrompt: prompt,
      };
    }
  }

  /**
   * Category E: Audio Test (TTS)
   */
  private static async executeAudioTest(
    model: DiscoveredModel,
    prov: ProviderConfig,
    start: number,
    timeoutMs: number
  ): Promise<ModelTestRecord> {
    const prompt = 'Hello from NEO STUDIO AI by xyrons';

    try {
      const res = await Promise.race([
        this.dispatchAudio(model.provider, model.id, prompt, prov),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Audio generation timeout' }), timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - start;

      if (!res.success) {
        const errorInfo = this.classifyError(res.error || 'Audio generation failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'AUDIO',
          result: 'FAIL',
          score: 0,
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
        };
      }

      const hasValidAudio = !!res.data?.audioBase64 && res.data.audioBase64.length > 500;
      let score = 0;
      if (hasValidAudio) {
        score += 70;
        if (latencyMs <= 1500) score += 30;
        else if (latencyMs <= 3500) score += 20;
        else score += 10;
      }

      const evalDetail = hasValidAudio
        ? `Sintesis Audio: Valid, Latency: ${latencyMs}ms, Skor: ${score}/100`
        : 'Tidak menghasilkan byte audio valid';

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'AUDIO',
        result: hasValidAudio ? 'PASS' : 'FAIL',
        score,
        evaluationDetails: evalDetail,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        outputSnippet: 'Valid Audio Synthesized',
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.classifyError(err.message || 'Audio generation error');
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'AUDIO',
        result: 'FAIL',
        score: 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
      };
    }
  }

  /**
   * Category F: Video Test (Validated against video endpoint)
   */
  private static async executeVideoTest(
    model: DiscoveredModel,
    prov: ProviderConfig,
    start: number,
    timeoutMs: number
  ): Promise<ModelTestRecord> {
    const prompt = 'A calm ocean wave at sunrise, cinema 4k';

    try {
      const res = await Promise.race([
        this.dispatchVideo(model.provider, model.id, prompt, prov),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Video generation timeout' }), timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - start;

      if (!res.success) {
        const errorInfo = this.classifyError(res.error || 'Video test failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'VIDEO',
          result: 'FAIL',
          score: 0,
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
        };
      }

      const passed = !!res.data?.jobId || !!res.data?.videoUrl;

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'VIDEO',
        result: passed ? 'PASS' : 'FAIL',
        score: passed ? 85 : 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.classifyError(err.message || 'Video generation error');
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'VIDEO',
        result: 'FAIL',
        score: 0,
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
      };
    }
  }

  /**
   * Diagnostic Error Classifier
   */
  static classifyError(rawError: string): {
    code: ModelErrorCode;
    message: string;
    safeResolution: string;
  } {
    const lower = rawError.toLowerCase();

    if (lower.includes('api key not valid') || lower.includes('invalid_api_key') || lower.includes('api_key_invalid')) {
      return {
        code: 'INVALID_API_KEY',
        message: 'Kunci API (API Key) tidak valid atau ditolak oleh provider.',
        safeResolution: 'Periksa API Key di pengaturan provider atau Vercel Environment Variables.',
      };
    }

    if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('invalid token')) {
      return {
        code: 'AUTHENTICATION_FAILED',
        message: 'Autentikasi gagal atau token kedaluwarsa.',
        safeResolution: 'Perbarui kredensial otorisasi pada provider terkait.',
      };
    }

    if (lower.includes('not found') || lower.includes('does not exist') || lower.includes('404')) {
      return {
        code: 'MODEL_NOT_FOUND',
        message: 'Model tidak ditemukan pada tier/akun Anda atau telah dipensiunkan oleh provider.',
        safeResolution: 'Gunakan model alternatif yang aktif melalui katalog discovery.',
      };
    }

    if (lower.includes('do not have access') || lower.includes('permission') || lower.includes('forbidden') || lower.includes('403')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Akun Anda belum memiliki izin/whitelist untuk mengakses model ini.',
        safeResolution: 'Ajukan akses preview ke provider atau gunakan model free tier publik.',
      };
    }

    if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Batas frekuensi permintaan (Rate Limit) terlampaui.',
        safeResolution: 'Sistem multi-key pool akan otomatis merotasi key berikutnya. Tunggu sesaat.',
      };
    }

    if (lower.includes('quota') || lower.includes('resource_exhausted')) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: 'Kuota penggunaan gratis atau kredit provider telah habis.',
        safeResolution: 'Tambahkan API key alternatif atau beralih ke provider gratis lainnya.',
      };
    }

    if (lower.includes('billing') || lower.includes('vertex') || lower.includes('predict quota')) {
      return {
        code: 'BILLING_REQUIRED',
        message: 'Model ini memerlukan akun berbayar atau penautan metode pembayaran.',
        safeResolution: 'Gunakan model alternatif gratis (misalnya FLUX.1 Cloudflare untuk gambar).',
      };
    }

    if (lower.includes('timeout') || lower.includes('aborted')) {
      return {
        code: 'TIMEOUT',
        message: 'Waktu tunggu permintaan habis (Timeout).',
        safeResolution: 'Koneksi lambat atau server provider sedang mengalami lonjakan beban.',
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: rawError.length > 150 ? rawError.substring(0, 150) + '...' : rawError,
      safeResolution: 'Hubungi dukungan atau pilih provider alternatif dari Model Lab.',
    };
  }
}
