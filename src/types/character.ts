export interface EmotionProfile {
  primary: string;
  intensity: 'subtle' | 'moderate' | 'dramatic' | 'extreme';
  expressions: string[];
}

export interface VoiceProfile {
  provider?: string;
  voiceId?: string;
  voiceName: string;
  gender: 'male' | 'female' | 'neutral';
  pitch: number; // -1.0 to 1.0
  speed: number; // 0.5 to 2.0
  timbreDescription: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'narrator' | 'extra';
  physicalAppearance: string;
  faceDescription: string;
  hairStyle: string;
  clothing: string;
  bodyType: string;
  ageAppearance: string;
  personality: string;
  emotionProfile: EmotionProfile;
  voiceProfile: VoiceProfile;
  referenceImageBlobIds: string[];
  avatarBlobId?: string;
  characterSheetBlobId?: string;
  consistencyPromptToken: string; // Token used in prompt to condition generation
  createdAt: number;
  updatedAt: number;
}
