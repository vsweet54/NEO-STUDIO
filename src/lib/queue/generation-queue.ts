import { GenerationJob, JobStatus } from '@/types/generation';
import { TaskType, ProviderId } from '@/types/provider';
import { getProviderConfigs, getRouterConfig } from '../db/settings';
import { getSpecializations } from '../db/model-intelligence';
import { AIRouter } from '../router/ai-router';
import { saveMediaBlob } from '../db/media';
import { addHistoryItem } from '../db/history';

type QueueListener = (jobs: GenerationJob[]) => void;

class JobQueueManager {
  private jobs: GenerationJob[] = [];
  private listeners: Set<QueueListener> = new Set();
  private isProcessing = false;

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.jobs]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const copy = [...this.jobs];
    this.listeners.forEach((l) => l(copy));
  }

  getJobs(): GenerationJob[] {
    return [...this.jobs];
  }

  getActiveJobCount(): number {
    return this.jobs.filter((j) => j.status === 'processing' || j.status === 'queued').length;
  }

  cancelJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job && (job.status === 'queued' || job.status === 'processing')) {
      job.status = 'cancelled';
      job.progress = 0;
      this.notify();
    }
  }

  async addJob(params: {
    projectId?: string;
    sceneId?: string;
    characterId?: string;
    taskType: TaskType;
    prompt: string;
    negativePrompt?: string;
    params?: Record<string, any>;
    onComplete?: (result: any) => void;
    onError?: (err: string) => void;
  }): Promise<string> {
    const providerConfigs = await getProviderConfigs();
    const routerConfig = await getRouterConfig();
    const specializations = await getSpecializations();

    const modality =
      params.taskType === 'image'
        ? 'image'
        : params.taskType === 'video'
        ? 'video'
        : params.taskType === 'tts'
        ? 'audio'
        : 'text';

    const preferredModel = params.params?.model;
    const route = AIRouter.resolveRoute(
      params.taskType,
      routerConfig,
      providerConfigs,
      [],
      preferredModel,
      specializations
    );

    const jobId = 'job_' + Math.random().toString(36).substring(2, 9) + Date.now();
    const job: GenerationJob = {
      id: jobId,
      projectId: params.projectId,
      sceneId: params.sceneId,
      characterId: params.characterId,
      taskType: params.taskType,
      modality,
      providerId: route.providerId,
      modelId: route.modelId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      params: params.params || {},
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
    };

    this.jobs.unshift(job);
    this.notify();

    // Trigger process queue
    this.processNext(job, route, params.onComplete, params.onError);

    return jobId;
  }

  private async processNext(
    job: GenerationJob,
    route: any,
    onComplete?: (result: any) => void,
    onError?: (err: string) => void
  ) {
    job.status = 'processing';
    job.startedAt = Date.now();
    job.progress = 20;
    this.notify();

    const providerConfigs = await getProviderConfigs();
    const routerConfig = await getRouterConfig();
    const triedProviders: ProviderId[] = [];

    let currentRoute = route;
    let attemptSucceeded = false;
    let lastError = '';

    while (!attemptSucceeded && currentRoute) {
      triedProviders.push(currentRoute.providerId);
      const prov = currentRoute.providerConfig;

      try {
        job.providerId = currentRoute.providerId;
        job.modelId = currentRoute.modelId;
        job.progress = 40;
        this.notify();

        const { model: _ignored, ...otherParams } = job.params || {};

        let apiEndpoint = '/api/generate/text';
        let payload: any = {
          providerId: currentRoute.providerId,
          model: currentRoute.modelId,
          prompt: job.prompt,
          apiKey: prov.apiKey,
          baseUrl: prov.baseUrl,
          accountId: prov.accountId,
          ...otherParams,
        };

        if (job.modality === 'image') {
          apiEndpoint = '/api/generate/image';
          payload = {
            ...payload,
            negativePrompt: job.negativePrompt,
            aspectRatio: job.params.aspectRatio || '16:9',
            steps: job.params.steps,
            referenceImageBase64: job.params.referenceImageBase64,
          };
        } else if (job.modality === 'video') {
          apiEndpoint = '/api/generate/video';
          payload = {
            ...payload,
            durationSeconds: job.params.durationSeconds || 5,
            aspectRatio: job.params.aspectRatio || '16:9',
            firstFrameBase64: job.params.firstFrameBase64,
            cameraMovement: job.params.cameraMovement,
          };
        } else if (job.modality === 'audio') {
          apiEndpoint = '/api/generate/audio';
          payload = {
            ...payload,
            text: job.prompt,
          };
        }

        job.progress = 60;
        this.notify();

        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Provider request failed');
        }

        // Job succeeded
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = Date.now();
        job.durationMs = job.completedAt - (job.startedAt || job.createdAt);
        job.tokenUsage = json.tokenUsage;
        job.estimatedCost = json.estimatedCost;

        // Process output according to modality
        if (job.modality === 'image' && json.data?.imageBase64) {
          // Convert base64 to Blob & save in IndexedDB
          const byteCharacters = atob(json.data.imageBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: json.data.mimeType || 'image/png' });

          const blobId = await saveMediaBlob(
            blob,
            'image',
            `gen_${Date.now()}.png`,
            job.projectId
          );
          job.resultBlobId = blobId;
        } else if (job.modality === 'audio' && json.data?.audioBase64) {
          const byteCharacters = atob(json.data.audioBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: json.data.mimeType || 'audio/mpeg' });

          const blobId = await saveMediaBlob(
            blob,
            'audio',
            `audio_${Date.now()}.mp3`,
            job.projectId
          );
          job.resultBlobId = blobId;
        } else if (job.modality === 'text') {
          job.resultText = json.data?.text || '';
          job.resultData = json.data;
        } else if (job.modality === 'video') {
          job.resultUrl = json.data?.videoUrl;
        }

        // Save to generation history
        await addHistoryItem({
          id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          projectId: job.projectId,
          sceneId: job.sceneId,
          type: job.modality,
          taskType: job.taskType,
          provider: currentRoute.providerId,
          model: currentRoute.modelId,
          prompt: job.prompt,
          negativePrompt: job.negativePrompt,
          status: 'completed',
          durationMs: job.durationMs,
          tokenUsage: job.tokenUsage,
          estimatedCost: job.estimatedCost,
          outputBlobId: job.resultBlobId,
          outputText: job.resultText,
          createdAt: Date.now(),
        });

        attemptSucceeded = true;
        this.notify();

        if (onComplete) {
          onComplete(job);
        }
        return;
      } catch (err: any) {
        lastError = err.message || 'Execution error';
        console.warn(`Provider ${currentRoute.providerId} failed: ${lastError}. Checking fallback...`);

        // Attempt fallback routing
        const specializations = await getSpecializations();
        const fallback = AIRouter.getFallbackRoute(
          job.taskType,
          currentRoute.providerId,
          currentRoute.modelId,
          lastError,
          routerConfig,
          providerConfigs,
          triedProviders,
          specializations
        );

        if (fallback) {
          currentRoute = fallback;
          job.progress = 30;
          this.notify();
        } else {
          currentRoute = null; // No more fallbacks
        }
      }
    }

    // If reached here, all attempts failed
    job.status = 'failed';
    job.progress = 0;
    job.error = lastError;
    this.notify();

    await addHistoryItem({
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now(),
      projectId: job.projectId,
      sceneId: job.sceneId,
      type: job.modality,
      taskType: job.taskType,
      provider: job.providerId,
      model: job.modelId,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      status: 'failed',
      durationMs: Date.now() - (job.startedAt || job.createdAt),
      error: lastError,
      createdAt: Date.now(),
    });

    if (onError) {
      onError(lastError);
    }
  }
}

export const queueManager = new JobQueueManager();
