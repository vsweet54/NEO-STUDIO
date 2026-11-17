import { ProviderId, TaskType, ModalityType, ModelDefinition } from '@/types/provider';

export interface TextGenerationOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  referenceImageBase64?: string;
}

export interface ImageGenerationOptions {
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  referenceImageBase64?: string;
}

export interface VideoGenerationOptions {
  model: string;
  prompt: string;
  negativePrompt?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  firstFrameBase64?: string;
  cameraMovement?: string;
}

export interface AudioGenerationOptions {
  model: string;
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface ProviderExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCost?: number;
}

export interface ProviderConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  modelsFound: number;
}
