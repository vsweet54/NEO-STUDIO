import { ProviderId } from './provider';

export type ModelPricingClassification =
  | 'FREE'
  | 'FREE_LIMITED'
  | 'FREE_TRIAL'
  | 'PAID'
  | 'UNKNOWN'
  | 'UNAVAILABLE';

export type ModelRole =
  | 'GENERAL_CHAT'
  | 'REASONING'
  | 'CODING'
  | 'DEBUGGING'
  | 'VISION'
  | 'IMAGE_UNDERSTANDING'
  | 'WEB_RESEARCH'
  | 'WRITING'
  | 'SUMMARIZATION'
  | 'TRANSLATION'
  | 'STORYBOARD'
  | 'IMAGE_GENERATION'
  | 'IMAGE_EDITING'
  | 'AUDIO_TRANSCRIPTION'
  | 'TEXT_TO_SPEECH'
  | 'AUDIO_UNDERSTANDING'
  | 'AUDIO_GENERATION'
  | 'VIDEO_GENERATION'
  | 'VIDEO_UNDERSTANDING'
  | 'EMBEDDINGS';

export type ModelTestStatus =
  | 'NOT_TESTED'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'READY'
  | 'UNAVAILABLE'
  | 'DEPRECATED';

export type ModelErrorCode =
  | 'INVALID_API_KEY'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_RETIRED'
  | 'MODEL_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'BILLING_REQUIRED'
  | 'UNSUPPORTED_MODALITY'
  | 'INVALID_REQUEST'
  | 'ENDPOINT_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN_ERROR';

export type TestingCategory =
  | 'TEXT'
  | 'CODING'
  | 'VISION'
  | 'IMAGE_GEN'
  | 'AUDIO'
  | 'VIDEO';

export interface ModelPricing {
  classification: ModelPricingClassification;
  verified: boolean;
  promptCostPer1k?: number;
  completionCostPer1k?: number;
  imageCost?: number;
  videoCostPerSecond?: number;
  source?: string;
  notes?: string;
  lastChecked: number;
}

export interface ModelCapabilities {
  supportsText: boolean;
  supportsImageGen: boolean;
  supportsVideoGen: boolean;
  supportsAudioGen: boolean;
  supportsVision: boolean;
  supportsAudioInput: boolean;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
  maxContextTokens: number;
  maxOutputTokens?: number;
  isLocal: boolean;
}

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: ProviderId;
  description: string;
  capabilities: ModelCapabilities;
  roles: ModelRole[];
  pricing: ModelPricing;
  availability: 'available' | 'deprecated' | 'restricted' | 'unavailable';
  authentication: 'passed' | 'failed' | 'untested';
  testStatus: ModelTestStatus;
  lastTestedAt?: number;
  latencyMs?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  errorInfo?: {
    code: ModelErrorCode;
    message: string;
    safeResolution: string;
    httpStatus?: number;
  };
  performance?: {
    latencyScore?: number; // 0-100
    qualityScore?: number; // 0-100
    reliabilityScore?: number; // 0-100
  };
  assignment?: {
    primary?: boolean;
    secondary?: boolean;
    backup?: boolean;
    fast?: boolean;
    bestFree?: boolean;
    assignedTasks?: string[];
  };
  isCustomManual?: boolean;
  rawMetadata?: Record<string, any>;
}

export interface TaskSpecializationConfig {
  task: string;
  label: string;
  requiredRole: ModelRole;
  primaryModelId: string;
  secondaryModelId?: string;
  fastModelId?: string;
  bestFreeModelId?: string;
  backupModelId?: string;
  isManualOverride: boolean;
  updatedAt: number;
}

export interface ModelTestRecord {
  id: string;
  timestamp: number;
  provider: ProviderId;
  modelId: string;
  category: TestingCategory;
  result: 'PASS' | 'FAIL' | 'BLOCKED';
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  pricingStatus: ModelPricingClassification;
  assignedRoles: ModelRole[];
  errorCode?: ModelErrorCode;
  errorMessage?: string;
  testPrompt?: string;
  outputSnippet?: string;
}

export interface DiscoverySummary {
  timestamp: number;
  totalDiscovered: number;
  byProvider: Record<ProviderId, number>;
  byPricing: Record<ModelPricingClassification, number>;
  byStatus: Record<ModelTestStatus, number>;
}
