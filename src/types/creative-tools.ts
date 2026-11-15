import { AspectRatio } from './project';
import { ProviderId } from './provider';

export type CreativeToolId =
  | 'photo'
  | 'thumbnail'
  | 'infographic'
  | 'ugc'
  | 'product-ad'
  | 'character-sheet'
  | 'product-sheet'
  | 'poster'
  | 'social-media'
  | 'cinematic';

export interface CreativeToolMeta {
  id: CreativeToolId;
  name: string;
  category: string;
  description: string;
  iconName: string;
  defaultAspect: AspectRatio;
  supportedAspects: AspectRatio[];
  styles: { id: string; label: string; promptModifier: string }[];
  platforms?: string[];
}

export interface CreativeToolRunParams {
  toolId: CreativeToolId;
  prompt: string;
  negativePrompt?: string;
  styleId?: string;
  aspectRatio: AspectRatio;
  providerId: ProviderId;
  modelId: string;
  referenceImageBase64?: string;
  options: Record<string, any>;
}
