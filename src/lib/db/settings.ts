import { getDB } from './index';
import { ProviderConfig, RouterConfig, ProviderId } from '@/types/provider';

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini API',
    enabled: true,
    status: 'unconfigured',
    defaultTextModel: 'gemini-2.5-flash',
    defaultImageModel: 'imagen-3.0-generate-002',
    defaultVideoModel: 'veo-2.0-generate-001',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM API',
    enabled: true,
    status: 'unconfigured',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultTextModel: 'meta/llama-3.3-70b-instruct',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    enabled: true,
    status: 'unconfigured',
    defaultTextModel: '@cf/meta/llama-3.1-8b-instruct',
    defaultImageModel: '@cf/black-forest-labs/flux-1-schnell',
    defaultAudioModel: '@cf/deepgram/aura-tts',
  },
  {
    id: 'groq',
    name: 'Groq API',
    enabled: true,
    status: 'unconfigured',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultTextModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'ollama',
    name: 'Ollama (Cloud)',
    enabled: false,
    status: 'unconfigured',
    baseUrl: 'https://ollama.com',
    defaultTextModel: 'gpt-oss:120b',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter API',
    enabled: true,
    status: 'unconfigured',
    defaultTextModel: 'deepseek/deepseek-r1',
  },
];

const DEFAULT_ROUTER: RouterConfig = {
  mode: 'auto',
  manualAssignments: {
    story: { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
    script: { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
    storyboard: { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
    dialogue: { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' },
    'character-analysis': { providerId: 'nvidia', modelId: 'meta/llama-3.3-70b-instruct' },
    'prompt-engineering': { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' },
    image: { providerId: 'gemini', modelId: 'imagen-3.0-generate-002' },
    video: { providerId: 'gemini', modelId: 'veo-2.0-generate-001' },
    tts: { providerId: 'cloudflare', modelId: '@cf/deepgram/aura-tts' },
    stt: { providerId: 'groq', modelId: 'whisper-large-v3' },
  },
  autoFallbackEnabled: true,
  maxRetries: 2,
};

export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record ? (record.value as T) : defaultValue;
}

export async function setSetting<T = any>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('settings', {
    key,
    value,
    updatedAt: Date.now(),
  });
}

export async function getProviderConfigs(): Promise<ProviderConfig[]> {
  const stored = await getSetting<ProviderConfig[]>('providers_config');
  if (!stored || stored.length === 0) {
    await setSetting('providers_config', DEFAULT_PROVIDERS);
    return DEFAULT_PROVIDERS;
  }
  // Migrasi: config Ollama lama (lokal) -> Ollama Cloud
  let migrated = false;
  const fixed = stored.map((p) => {
    if (p.id !== 'ollama') return p;
    const isLocalUrl = !p.baseUrl || /localhost|127\.0\.0\.1|^http:/i.test(p.baseUrl);
    const oldModel = !p.defaultTextModel || p.defaultTextModel === 'llama3.2' || p.defaultTextModel === 'qwen2.5';
    if (!isLocalUrl && !oldModel && p.name === 'Ollama (Cloud)') return p;
    migrated = true;
    return {
      ...p,
      name: 'Ollama (Cloud)',
      baseUrl: isLocalUrl ? 'https://ollama.com' : p.baseUrl,
      defaultTextModel: oldModel ? 'gpt-oss:120b' : p.defaultTextModel,
      status: p.apiKey ? p.status : 'unconfigured',
    } as ProviderConfig;
  });
  if (migrated) await setSetting('providers_config', fixed);
  return fixed;
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  const all = await getProviderConfigs();
  const index = all.findIndex((p) => p.id === config.id);
  if (index >= 0) {
    all[index] = config;
  } else {
    all.push(config);
  }
  await setSetting('providers_config', all);
}

export async function getRouterConfig(): Promise<RouterConfig> {
  const stored = await getSetting<RouterConfig>('router_config');
  if (!stored) {
    await setSetting('router_config', DEFAULT_ROUTER);
    return DEFAULT_ROUTER;
  }
  return stored;
}

export async function saveRouterConfig(config: RouterConfig): Promise<void> {
  await setSetting('router_config', config);
}
