import { ModalityType, ProviderId, TaskType } from './provider';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  projectId?: string;
  sceneId?: string;
  characterId?: string;
  taskType: TaskType;
  modality: ModalityType;
  providerId: ProviderId;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  params: Record<string, any>;
  status: JobStatus;
  progress: number; // 0 - 100
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  resultBlobId?: string;
  resultUrl?: string;
  resultText?: string;
  resultData?: any;
  error?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCost?: number;
}

export interface GenerationHistoryItem {
  id: string;
  projectId?: string;
  sceneId?: string;
  type: ModalityType;
  taskType: TaskType;
  provider: ProviderId;
  model: string;
  prompt: string;
  negativePrompt?: string;
  status: 'completed' | 'failed';
  durationMs: number;
  tokenUsage?: {
    totalTokens: number;
  };
  estimatedCost?: number;
  outputBlobId?: string;
  thumbnailUrl?: string;
  outputText?: string;
  error?: string;
  createdAt: number;
}

export interface MediaBlobRecord {
  id: string;
  projectId?: string;
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  data: Blob;
  fileName: string;
  size: number;
  createdAt: number;
}
