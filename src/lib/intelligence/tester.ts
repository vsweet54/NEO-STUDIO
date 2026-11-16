import {
  DiscoveredModel,
  ModelTestRecord,
  TestingCategory,
  ModelErrorCode,
} from '@/types/model-intelligence';
import { ProviderConfig } from '@/types/provider';

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: model.provider,
          model: model.id,
          prompt,
          apiKey: prov.apiKey,
          accountId: prov.accountId,
          baseUrl: prov.baseUrl,
          maxTokens: 50,
          temperature: 0.1,
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json = await res.json();

      if (!json.success) {
        const errorInfo = this.classifyError(json.error || 'Server rejected request');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'TEXT',
          result: 'FAIL',
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const reply = json.data?.text || '';
      const passed = reply.toUpperCase().includes('NEO MODEL TEST SUCCESS') || reply.length > 0;

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'TEXT',
        result: passed ? 'PASS' : 'FAIL',
        latencyMs,
        tokenUsage: json.tokenUsage,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: reply.substring(0, 100),
      };
    } finally {
      clearTimeout(timeout);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: model.provider,
          model: model.id,
          prompt,
          apiKey: prov.apiKey,
          accountId: prov.accountId,
          baseUrl: prov.baseUrl,
          maxTokens: 256,
          temperature: 0.2,
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json = await res.json();

      if (!json.success) {
        const errorInfo = this.classifyError(json.error || 'Coding test failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'CODING',
          result: 'FAIL',
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const reply = json.data?.text || '';
      const containsFunction = reply.includes('function') || reply.includes('=>') || reply.includes('return');

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'CODING',
        result: containsFunction ? 'PASS' : 'FAIL',
        latencyMs,
        tokenUsage: json.tokenUsage,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: reply.substring(0, 120),
      };
    } finally {
      clearTimeout(timeout);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: model.provider,
          model: model.id,
          prompt,
          referenceImageBase64: RED_PIXEL_BASE64,
          apiKey: prov.apiKey,
          accountId: prov.accountId,
          baseUrl: prov.baseUrl,
          maxTokens: 120,
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json = await res.json();

      if (!json.success) {
        const errorInfo = this.classifyError(json.error || 'Vision test failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'VISION',
          result: 'FAIL',
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const reply = json.data?.text || '';
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'VISION',
        result: reply.length > 5 ? 'PASS' : 'FAIL',
        latencyMs,
        tokenUsage: json.tokenUsage,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: reply.substring(0, 100),
      };
    } finally {
      clearTimeout(timeout);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: model.provider,
          model: model.id,
          prompt,
          apiKey: prov.apiKey,
          accountId: prov.accountId,
          steps: 4,
          aspectRatio: '1:1',
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json = await res.json();

      if (!json.success) {
        const errorInfo = this.classifyError(json.error || 'Image generation failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'IMAGE_GEN',
          result: 'FAIL',
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          testPrompt: prompt,
        };
      }

      const hasValidImage = !!json.data?.imageBase64;
      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'IMAGE_GEN',
        result: hasValidImage ? 'PASS' : 'FAIL',
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        testPrompt: prompt,
        outputSnippet: hasValidImage ? 'Valid Image Output Received' : 'No image data',
      };
    } finally {
      clearTimeout(timeout);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: model.provider,
          model: model.id,
          text: prompt,
          apiKey: prov.apiKey,
          accountId: prov.accountId,
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json = await res.json();

      if (!json.success) {
        const errorInfo = this.classifyError(json.error || 'Audio generation failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'AUDIO',
          result: 'FAIL',
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
        };
      }

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'AUDIO',
        result: json.data?.audioBase64 ? 'PASS' : 'FAIL',
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
        outputSnippet: 'Valid Audio Synthesized',
      };
    } finally {
      clearTimeout(timeout);
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
    // Check video availability
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: model.provider,
          model: model.id,
          prompt: 'A calm ocean wave at sunrise, cinema 4k',
          apiKey: prov.apiKey,
          durationSeconds: 3,
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json = await res.json();

      if (!json.success) {
        const errorInfo = this.classifyError(json.error || 'Video test failed');
        return {
          id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: Date.now(),
          provider: model.provider,
          modelId: model.id,
          category: 'VIDEO',
          result: 'FAIL',
          latencyMs,
          pricingStatus: model.pricing.classification,
          assignedRoles: model.roles,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
        };
      }

      return {
        id: 'test_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: Date.now(),
        provider: model.provider,
        modelId: model.id,
        category: 'VIDEO',
        result: json.data?.jobId || json.data?.videoUrl ? 'PASS' : 'FAIL',
        latencyMs,
        pricingStatus: model.pricing.classification,
        assignedRoles: model.roles,
      };
    } finally {
      clearTimeout(timeout);
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
