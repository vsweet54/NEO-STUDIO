export type ProviderId = 'gemini' | 'nvidia' | 'cloudflare' | 'groq' | 'ollama' | 'openrouter' | string;

export type ModalityType = 'text' | 'image' | 'video' | 'audio' | 'vision';

export type TaskType =
  | 'story'
  | 'script'
  | 'storyboard'
  | 'dialogue'
  | 'character-analysis'
  | 'prompt-engineering'
  | 'image'
  | 'video'
  | 'tts'
  | 'stt';

export interface ModelCapability {
  supportsText: boolean;
  supportsImageGen: boolean;
  supportsVideoGen: boolean;
  supportsAudioGen: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
  isLocal: boolean;
  costPer1kTokens?: number;
  costPerImage?: number;
  costPerSecondVideo?: number;
}

export interface ModelDefinition {
  id: string;
  name: string;
  providerId: ProviderId;
  capabilities: ModelCapability;
  description: string;
  recommendedFor: TaskType[];
  isDefault?: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  accountId?: string; // For Cloudflare Workers AI
  defaultTextModel?: string;
  defaultImageModel?: string;
  defaultVideoModel?: string;
  defaultAudioModel?: string;
  status: 'unconfigured' | 'ready' | 'error' | 'testing';
  lastTestedAt?: number;
  errorMessage?: string;
  latencyMs?: number;
  availableModels?: ModelDefinition[];
}

export type RouterMode = 'manual' | 'auto';

export interface TaskRouteAssignment {
  task: TaskType;
  providerId: ProviderId;
  modelId: string;
}

export interface RouterConfig {
  mode: RouterMode;
  manualAssignments: Record<TaskType, { providerId: ProviderId; modelId: string }>;
  autoFallbackEnabled: boolean;
  maxRetries: number;
}

export interface FallbackEvent {
  id: string;
  timestamp: number;
  task: TaskType;
  originalProvider: ProviderId;
  originalModel: string;
  fallbackProvider: ProviderId;
  fallbackModel: string;
  reason: string;
}
