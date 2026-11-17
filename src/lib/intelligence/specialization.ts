import {
  DiscoveredModel,
  TaskSpecializationConfig,
  ModelRole,
} from '@/types/model-intelligence';

export interface SpecializationMatrix {
  configs: Record<string, TaskSpecializationConfig>;
  updatedAt: number;
}

export const SUPPORTED_TASK_SPECS: {
  task: string;
  label: string;
  requiredRole: ModelRole;
  description: string;
}[] = [
  {
    task: 'general-chat',
    label: 'Percakapan Umum (General Chat)',
    requiredRole: 'GENERAL_CHAT',
    description: 'Percakapan harian, tanya-jawab umum, dan asisten AI responsif.',
  },
  {
    task: 'reasoning',
    label: 'Analisis Mendalam & Logika (Reasoning)',
    requiredRole: 'REASONING',
    description: 'Rantai penalaran mendalam (Chain-of-Thought) untuk plot rumit dan problem solving.',
  },
  {
    task: 'coding',
    label: 'Pemrograman & Coding',
    requiredRole: 'CODING',
    description: 'Penulisan kode program, algoritma, dan arsitektur software.',
  },
  {
    task: 'debugging',
    label: 'Analisis Bug & Debugging',
    requiredRole: 'DEBUGGING',
    description: 'Isolasi root cause error, stacktrace inspection, dan penambalan kode.',
  },
  {
    task: 'vision',
    label: 'Pemahaman Visual & Vision',
    requiredRole: 'VISION',
    description: 'Menganalisis gambar input, poster acuan, dan foto referensi karakter.',
  },
  {
    task: 'writing',
    label: 'Penulisan Narasi & Kreatif (Writing)',
    requiredRole: 'WRITING',
    description: 'Pembuatan artikel, sinopsis kreatif, dan deskripsi dunia cerita.',
  },
  {
    task: 'storyboard',
    label: 'Sutradara & Storyboard Studio',
    requiredRole: 'STORYBOARD',
    description: 'Breakdown adegan sinematik, grid lock multi-panel, dan kontinuitas frame.',
  },
  {
    task: 'dialogue',
    label: 'Dialog Karakter Bernada Emosi',
    requiredRole: 'GENERAL_CHAT',
    description: 'Penulisan percakapan antar karakter dengan cue emosi natural.',
  },
  {
    task: 'image-generation',
    label: 'Generasi Gambar Sinematik (Image Gen)',
    requiredRole: 'IMAGE_GENERATION',
    description: 'Sintesis visual fotorealistis dari teks (FLUX.1 Schnell, SDXL, Imagen 3).',
  },
  {
    task: 'video-generation',
    label: 'Generasi Video AI (Video Gen)',
    requiredRole: 'VIDEO_GENERATION',
    description: 'Produksi klip video asinkron (Google Veo 2 preview).',
  },
  {
    task: 'tts',
    label: 'Sintesis Suara (Text-to-Speech)',
    requiredRole: 'TEXT_TO_SPEECH',
    description: 'Voice over narasi dan sulih suara dialog (Cloudflare Aura TTS).',
  },
  {
    task: 'stt',
    label: 'Transkripsi Audio (Speech-to-Text)',
    requiredRole: 'AUDIO_TRANSCRIPTION',
    description: 'Pengenalan suara otomatis ultra cepat (Groq Whisper v3).',
  },
];

export class ModelSpecializationEngine {
  static generateMatrix(
    models: DiscoveredModel[],
    existingMatrix?: SpecializationMatrix
  ): SpecializationMatrix {
    return this.buildSpecializationMatrix(models, existingMatrix);
  }

  /**
   * Generates or updates the specialization rankings from all discovered models.
   * Strictly preserves existing manual user overrides.
   */
  static buildSpecializationMatrix(
    models: DiscoveredModel[],
    existingMatrix?: SpecializationMatrix
  ): SpecializationMatrix {
    const existingConfigs = existingMatrix?.configs || {};
    const updatedConfigs: Record<string, TaskSpecializationConfig> = {};

    for (const spec of SUPPORTED_TASK_SPECS) {
      const existing = existingConfigs[spec.task];

      // If user has a manual override, preserve it
      if (existing && existing.isManualOverride) {
        // Verify that the manually assigned model still exists in discovered models
        const stillExists = models.some((m) => m.id === existing.primaryModelId);
        if (stillExists) {
          updatedConfigs[spec.task] = existing;
          continue;
        }
      }

      // Filter compatible models that have the required role or modality
      const candidateModels = models.filter((m) => {
        if (spec.task === 'image-generation') return m.capabilities.supportsImageGen;
        if (spec.task === 'video-generation') return m.capabilities.supportsVideoGen;
        if (spec.task === 'tts') return m.capabilities.supportsAudioGen;
        if (spec.task === 'stt') return m.capabilities.supportsAudioInput;
        if (spec.task === 'vision') return m.capabilities.supportsVision;
        return m.roles.includes(spec.requiredRole) || m.capabilities.supportsText;
      });

      if (candidateModels.length === 0) {
        updatedConfigs[spec.task] = {
          task: spec.task,
          label: spec.label,
          requiredRole: spec.requiredRole,
          primaryModelId: '',
          isManualOverride: false,
          updatedAt: Date.now(),
        };
        continue;
      }

      // Helper to compute objective task score based on actual benchmark scores and test status
      const getObjectiveScore = (m: DiscoveredModel): number => {
        const scores = m.benchmarkScores || {};
        let score = 0;

        if (spec.task === 'coding' || spec.task === 'debugging') {
          score = scores.coding ?? (m.roles.includes('CODING') ? 70 : 20);
        } else if (spec.task === 'vision') {
          score = scores.vision ?? (m.capabilities.supportsVision ? 70 : 20);
        } else if (spec.task === 'image-generation') {
          score = scores.imageGen ?? (m.capabilities.supportsImageGen ? 70 : 20);
        } else if (spec.task === 'tts' || spec.task === 'stt') {
          score = scores.audio ?? (m.capabilities.supportsAudioGen || m.capabilities.supportsAudioInput ? 70 : 20);
        } else if (spec.task === 'reasoning') {
          score = scores.reasoning ?? (m.roles.includes('REASONING') ? 75 : 40);
        } else {
          score = scores.generalChat ?? scores.overallScore ?? (m.roles.includes(spec.requiredRole) ? 70 : 50);
        }

        // Test status modifier
        if (m.testStatus === 'PASS') score += 15;
        else if (m.testStatus === 'FAIL') score -= 40;
        else if (m.testStatus === 'BLOCKED') score -= 20;

        return score;
      };

      // Sort candidate models by objective score descending
      const rankedCandidates = [...candidateModels].sort((a, b) => {
        return getObjectiveScore(b) - getObjectiveScore(a);
      });

      // 1. Primary Model: Top ranked candidate
      const primary = rankedCandidates[0]?.id || candidateModels[0]?.id;

      // 2. Secondary Model: Second highest candidate or alternate provider
      const secondaryCandidates = rankedCandidates.filter((m) => m.id !== primary);
      const secondaryAlternate = secondaryCandidates.find(
        (m) => m.provider !== rankedCandidates[0]?.provider
      );
      const secondary = secondaryAlternate?.id || secondaryCandidates[0]?.id || primary;

      // 3. Fast Model: Passing candidate with lowest latency
      const passingCandidates = candidateModels.filter((m) => m.testStatus === 'PASS');
      const poolForFast = passingCandidates.length > 0 ? passingCandidates : candidateModels;
      const fastCandidates = [...poolForFast].sort((a, b) => {
        const latA = a.latencyMs || 9999;
        const latB = b.latencyMs || 9999;
        return latA - latB;
      });
      const fastModel = fastCandidates[0]?.id || primary;

      // 4. Best Free Model: Highest ranked free or free-limited model
      const freeCandidates = rankedCandidates.filter(
        (m) =>
          m.pricing.classification === 'FREE' ||
          m.pricing.classification === 'FREE_LIMITED'
      );
      const bestFree = freeCandidates[0]?.id || primary;

      // 5. Backup Model: Alternate provider backup
      const backupCandidate = rankedCandidates.find(
        (m) => m.id !== primary && m.id !== secondary && m.provider !== rankedCandidates[0]?.provider
      );
      const backup = backupCandidate?.id || bestFree;

      updatedConfigs[spec.task] = {
        task: spec.task,
        label: spec.label,
        requiredRole: spec.requiredRole,
        primaryModelId: primary,
        secondaryModelId: secondary,
        fastModelId: fastModel,
        bestFreeModelId: bestFree,
        backupModelId: backup,
        isManualOverride: false,
        updatedAt: Date.now(),
      };
    }

    return {
      configs: updatedConfigs,
      updatedAt: Date.now(),
    };
  }
}
