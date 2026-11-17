export type ProjectCategory =
  | 'video-ad'
  | 'creative-content'
  | 'animation'
  | 'drama'
  | 'film'
  | 'horror'
  | 'comedy'
  | 'podcast'
  | 'educational'
  | 'product-promo'
  | 'cinematic-story'
  | 'social-media';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '2.39:1' | '21:9';

export type VisualStyle =
  | 'cinematic-film'
  | 'photorealistic'
  | 'anime-japanese'
  | '3d-pixar-style'
  | 'dark-cyberpunk'
  | 'retro-vintage'
  | 'documentary-raw'
  | 'hyperreal-commercial'
  | 'moody-noir'
  | 'watercolor-art';

export type StoryTone =
  | 'dramatic'
  | 'emotional'
  | 'humorous'
  | 'suspenseful'
  | 'inspirational'
  | 'mysterious'
  | 'high-energy'
  | 'dark-gritty'
  | 'whimsical'
  | 'luxurious';

export type TargetAudience =
  | 'general-public'
  | 'gen-z-tiktok'
  | 'young-adults'
  | 'professionals'
  | 'kids-family'
  | 'film-buffs'
  | 'tech-enthusiasts'
  | 'shoppers-consumers';

export interface Project {
  id: string;
  title: string;
  category: ProjectCategory;
  synopsis: string;
  outline: string;
  genre: string;
  language: string;
  visualStyle: VisualStyle;
  storyTone: StoryTone;
  targetAudience: TargetAudience;
  aspectRatio: AspectRatio;
  videoPlatform: string;
  sceneDuration: number; // in seconds
  episodesCount: number;
  scenesCount: number;
  thumbnailBlobId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Episode {
  id: string;
  projectId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  status: 'draft' | 'in-progress' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface DialogueLine {
  id: string;
  characterName: string;
  emotionTag?: string; // e.g. [bersemangat], [antusias], [bisik-bisik]
  text: string;
  audioBlobId?: string;
  audioDuration?: number;
}

export type SceneGenerationStatus =
  | 'idle'
  | 'prompts-ready'
  | 'generating-image'
  | 'generating-video'
  | 'completed'
  | 'failed';

export interface Shot {
  id: string;
  shotNumber: number;
  startTime: number; // e.g. 0.0 (in seconds)
  endTime: number; // e.g. 2.5 (in seconds)
  duration: number; // in seconds
  description: string;
  characterAction: string;
  facialExpression: string;
  bodyMovement: string;
  objectInteraction?: string;
  cameraAngle: string;
  cameraMovement: string;
  dialogue?: string;
  imagePrompt: string;
  videoPrompt: string;
  transition: string;
  generatedImageBlobId?: string;
  generatedVideoBlobId?: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
}

export interface Scene {
  id: string;
  projectId: string;
  episodeId: string;
  sceneNumber: number;
  title: string;
  description: string;
  characterIds: string[];
  dialogue: DialogueLine[];
  imagePrompt: string; // The strict storyboard grid lock prompt
  videoPrompt: string; // The strict video frame zero contract prompt
  cameraAngle: string;
  cameraMovement: string;
  lighting: string;
  environment: string;
  duration: number; // in seconds
  aspectRatio: AspectRatio;
  shotsCount: number;
  transition: string;
  referenceImageBlobIds: string[];
  generatedImageBlobId?: string;
  generatedVideoBlobId?: string;
  generatedAudioBlobId?: string;
  generationStatus: SceneGenerationStatus;
  shots?: Shot[]; // Professional multi-shot breakdown
  createdAt: number;
  updatedAt: number;
}
