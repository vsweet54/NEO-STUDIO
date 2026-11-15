import { getDB } from './index';
import { ProviderConfig, RouterConfig, ProviderId } from '@/types/provider';

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini API',
    enabled: true,
    status: 'unconfigured',
    defaultTextModel: 'gemini-2.0-flash',
    defaultImageModel: 'imagen-3.0-generate-002',
    defaultVideoModel: 'veo-2.0-generate-001',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM API',
    enabled: true,
    status: 'unconfigured',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultTextModel: 'meta/llama-3.1-70b-instruct',
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
    name: 'Ollama (Local AI)',
    enabled: false,
    status: 'unconfigured',
    baseUrl: 'http://localhost:11434',
    defaultTextModel: 'llama3.2',
  },
];

const DEFAULT_ROUTER: RouterConfig = {
  mode: 'auto',
  manualAssignments: {
    story: { providerId: 'gemini', modelId: 'gemini-2.0-flash' },
    script: { providerId: 'gemini', modelId: 'gemini-2.0-flash' },
    storyboard: { providerId: 'gemini', modelId: 'gemini-2.0-flash' },
    dialogue: { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' },
    'character-analysis': { providerId: 'nvidia', modelId: 'meta/llama-3.1-70b-instruct' },
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
  return stored;
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
