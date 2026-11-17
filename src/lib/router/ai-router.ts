import { ProviderConfig, RouterConfig, TaskType, ProviderId, FallbackEvent, ModelDefinition } from '@/types/provider';
import { TaskSpecializationConfig } from '@/types/model-intelligence';
import { VERIFIED_MODELS } from '../providers/registry';

export interface RouteResolution {
  providerId: ProviderId;
  modelId: string;
  providerConfig: ProviderConfig;
  modelDefinition: ModelDefinition;
  isFallback: boolean;
  fallbackEvent?: FallbackEvent;
}

const TASK_TO_SPEC_KEY: Record<string, string> = {
  storyboard: 'storyboard',
  screenplay: 'writing',
  dialogue: 'writing',
  character_profile: 'writing',
  image: 'image-generation',
  video: 'video-generation',
  tts: 'text-to-speech',
  stt: 'audio-transcription',
  coding: 'coding',
  reasoning: 'reasoning',
  vision: 'vision',
};

export class AIRouter {
  /**
   * Resolves the best provider and model for a given task.
   */
  static resolveRoute(
    task: TaskType,
    routerConfig: RouterConfig,
    providerConfigs: ProviderConfig[],
    excludeProviderIds: ProviderId[] = [],
    preferredModelId?: string,
    specializations?: TaskSpecializationConfig[] | Record<string, TaskSpecializationConfig>
  ): RouteResolution {
    const enabledProviders = providerConfigs.filter(
      (p) => p.enabled && !excludeProviderIds.includes(p.id)
    );

    if (enabledProviders.length === 0) {
      throw new Error(`Tidak ada AI Provider yang aktif untuk task: ${task}. Harap aktifkan provider di menu AI Provider Manager.`);
    }

    // 0. Honor user's explicitly selected model from UI dropdown (if provider is enabled and not excluded)
    if (preferredModelId && excludeProviderIds.length === 0) {
      const explicitDef = VERIFIED_MODELS.find((m) => m.id === preferredModelId);
      if (explicitDef) {
        const matchingProv = enabledProviders.find((p) => p.id === explicitDef.providerId);
        if (matchingProv) {
          return {
            providerId: matchingProv.id,
            modelId: explicitDef.id,
            providerConfig: matchingProv,
            modelDefinition: explicitDef,
            isFallback: false,
          };
        }
      }
    }

    // 1. Check MANUAL MODE in Router Config
    if (routerConfig.mode === 'manual' && excludeProviderIds.length === 0) {
      const assignment = routerConfig.manualAssignments[task];
      if (assignment) {
        const prov = enabledProviders.find((p) => p.id === assignment.providerId);
        if (prov) {
          const modelDef =
            VERIFIED_MODELS.find((m) => m.id === assignment.modelId) ||
            ({
              id: assignment.modelId,
              name: assignment.modelId,
              providerId: prov.id,
              capabilities: {
                supportsText: true,
                supportsImageGen: task === 'image',
                supportsVideoGen: task === 'video',
                supportsAudioGen: task === 'tts',
                supportsVision: false,
                maxContextTokens: 32000,
                isLocal:
                  prov.id === 'ollama' &&
                  (!prov.baseUrl ||
                    prov.baseUrl.includes('localhost') ||
                    prov.baseUrl.includes('127.0.0.1')),
              },
              description: 'Custom selected model',
              recommendedFor: [task],
            } as ModelDefinition);

          return {
            providerId: prov.id,
            modelId: assignment.modelId,
            providerConfig: prov,
            modelDefinition: modelDef,
            isFallback: false,
          };
        }
      }
    }

    // 2. TASK SPECIALIZATION MATRIX ROUTING (Universal Model Intelligence)
    if (specializations) {
      const specKey = TASK_TO_SPEC_KEY[task] || task;
      const specConfig: TaskSpecializationConfig | undefined = Array.isArray(specializations)
        ? specializations.find((s) => s.task === specKey)
        : specializations[specKey];

      if (specConfig) {
        // Try models in ranked order: Primary -> Secondary -> Fast -> Best Free -> Backup
        const candidateModelIds = [
          specConfig.primaryModelId,
          specConfig.secondaryModelId,
          specConfig.fastModelId,
          specConfig.bestFreeModelId,
          specConfig.backupModelId,
        ].filter(Boolean) as string[];

        for (const candidateId of candidateModelIds) {
          const modelDef = VERIFIED_MODELS.find((m) => m.id === candidateId);
          if (modelDef) {
            const prov = enabledProviders.find((p) => p.id === modelDef.providerId);
            if (prov) {
              return {
                providerId: prov.id,
                modelId: modelDef.id,
                providerConfig: prov,
                modelDefinition: modelDef,
                isFallback: excludeProviderIds.length > 0,
              };
            }
          }
        }
      }
    }

    // 3. AUTOMATIC MODE / Fallback Selection
    // Find candidate models matching task modality
    const candidateModels = VERIFIED_MODELS.filter((m) => {
      // Must belong to an enabled provider that is not excluded
      const prov = enabledProviders.find((p) => p.id === m.providerId);
      if (!prov) return false;

      // Filter by modality capability
      if (task === 'image') return m.capabilities.supportsImageGen;
      if (task === 'video') return m.capabilities.supportsVideoGen;
      if (task === 'tts') return m.capabilities.supportsAudioGen;
      if (task === 'stt') return m.recommendedFor.includes('stt');

      // For text-based tasks
      return m.capabilities.supportsText;
    });

    if (candidateModels.length === 0) {
      throw new Error(
        `Tidak ada model yang kompatibel untuk tugas "${task}" pada provider yang sedang aktif.`
      );
    }

    // Prioritize models explicitly recommended for this task
    let selectedModel: ModelDefinition | undefined;
    if (task === 'image') {
      // Prioritize available configured image model
      const cfConfigured = enabledProviders.some(
        (p) => p.id === 'cloudflare' && (p.apiKey || process.env.CLOUDFLARE_API_KEY) && (p.accountId || process.env.CLOUDFLARE_ACCOUNT_ID)
      );
      const geminiConfigured = enabledProviders.some(
        (p) => p.id === 'gemini' && (p.apiKey || process.env.GEMINI_API_KEY)
      );

      if (cfConfigured) {
        selectedModel =
          candidateModels.find((m) => m.id === '@cf/black-forest-labs/flux-1-schnell') ||
          candidateModels.find((m) => m.providerId === 'cloudflare' && m.capabilities.supportsImageGen);
      } else if (geminiConfigured) {
        selectedModel = candidateModels.find((m) => m.providerId === 'gemini' && m.capabilities.supportsImageGen);
      }

      if (!selectedModel) {
        selectedModel = candidateModels.find((m) => m.capabilities.supportsImageGen);
      }
    } else {
      selectedModel = candidateModels.find((m) => m.recommendedFor.includes(task));
    }

    if (!selectedModel) {
      selectedModel = candidateModels[0];
    }

    const providerConfig = enabledProviders.find((p) => p.id === selectedModel.providerId)!;

    return {
      providerId: providerConfig.id,
      modelId: selectedModel.id,
      providerConfig,
      modelDefinition: selectedModel,
      isFallback: excludeProviderIds.length > 0,
    };
  }

  /**
   * Attempts automatic fallback when a generation fails with a recoverable error.
   */
  static getFallbackRoute(
    task: TaskType,
    failedProviderId: ProviderId,
    failedModelId: string,
    errorReason: string,
    routerConfig: RouterConfig,
    providerConfigs: ProviderConfig[],
    triedProviders: ProviderId[],
    specializations?: TaskSpecializationConfig[] | Record<string, TaskSpecializationConfig>
  ): RouteResolution | null {
    if (!routerConfig.autoFallbackEnabled) {
      return null;
    }

    const allExcluded = [...triedProviders, failedProviderId];
    try {
      const resolution = this.resolveRoute(
        task,
        routerConfig,
        providerConfigs,
        allExcluded,
        undefined,
        specializations
      );

      const fallbackEvent: FallbackEvent = {
        id: 'fb_' + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        task,
        originalProvider: failedProviderId,
        originalModel: failedModelId,
        fallbackProvider: resolution.providerId,
        fallbackModel: resolution.modelId,
        reason: errorReason,
      };

      resolution.fallbackEvent = fallbackEvent;
      return resolution;
    } catch {
      // No suitable fallback available
      return null;
    }
  }
}
