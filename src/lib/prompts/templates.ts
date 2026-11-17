import { Project, Scene } from '@/types/project';
import { Character } from '@/types/character';

export class PromptEngine {
  /**
   * Generates the system prompt and user prompt for generating a complete Storyboard & Project breakdown.
   */
  static buildStoryboardGenerationPrompt(params: {
    storyIdea: string;
    category: string;
    genre: string;
    language: string;
    visualStyle: string;
    storyTone: string;
    targetAudience: string;
    episodesCount: number;
    scenesCount: number;
    sceneDuration: number;
    aspectRatio: string;
    videoPlatform: string;
  }) {
    const systemPrompt = `You are a world-class AI Film Director, Executive Storyboard Artist, and Master Scriptwriter inspired by high-end studio workflows like SUTRADARA AI V5.3.
Your mission is to generate a comprehensive, highly cinematic, production-ready script and storyboard breakdown.
You MUST output ONLY valid JSON matching the exact schema requested, with zero conversational commentary or markdown wraps outside the JSON.`;

    const userPrompt = `Generate a complete production storyboard and script package for the following project:

PROJECT SPECIFICATIONS:
- Story Idea / Brief: "${params.storyIdea}"
- Category: ${params.category}
- Genre: ${params.genre}
- Language: ${params.language}
- Visual Style: ${params.visualStyle}
- Story Tone: ${params.storyTone}
- Target Audience: ${params.targetAudience}
- Target Platform: ${params.videoPlatform}
- Number of Episodes: ${params.episodesCount}
- Number of Scenes per Episode: ${params.scenesCount}
- Target Duration per Scene: ${params.sceneDuration} seconds
- Aspect Ratio: ${params.aspectRatio}

STRICT JSON OUTPUT FORMAT REQUIREMENTS:
{
  "title": "Compelling Project Title",
  "synopsis": "Engaging logline and full synopsis (2-3 paragraphs)",
  "outline": "Act-by-act story outline with key plot milestones",
  "characters": [
    {
      "name": "Character Name",
      "role": "protagonist" | "antagonist" | "supporting",
      "physicalAppearance": "Detailed physique and visual presence",
      "faceDescription": "Distinctive facial traits, eye color, jawline",
      "hairStyle": "Hair color, texture, length, styling",
      "clothing": "Signature outfit and wardrobe textures",
      "bodyType": "e.g. Athletic, slim, towering",
      "ageAppearance": "e.g. 24 years old",
      "personality": "Key behavioral traits and motivations",
      "emotionProfile": {
        "primary": "Primary disposition",
        "intensity": "moderate",
        "expressions": ["focused", "determined", "warm smile"]
      },
      "voiceProfile": {
        "voiceName": "Voice identifier",
        "gender": "male" | "female",
        "pitch": 0.0,
        "speed": 1.0,
        "timbreDescription": "Warm, confident, cinematic resonance"
      },
      "consistencyPromptToken": "Unique visual identifier token to enforce appearance continuity across scenes"
    }
  ],
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "Episode 1 Title",
      "synopsis": "Episode synopsis"
    }
  ],
  "scenes": [
    {
      "episodeNumber": 1,
      "sceneNumber": 1,
      "title": "Scene 1 Title",
      "description": "Rich cinematic scene description detailing setting, atmosphere, and action",
      "characterNames": ["Character 1", "Character 2"],
      "dialogue": [
        {
          "characterName": "Character Name",
          "emotionTag": "[antusias]" or "[bersemangat]" or "[tegang]" or "[berbisik]",
          "text": "Actual dialogue line in ${params.language}"
        }
      ],
      "imagePrompt": "STORYBOARD GRID LOCK - MANDATORY. Violating any rule below = grid failure. LAYOUT - render EXACTLY 3 or 5 panels showing sequential shots. P1: [Shot 1], P2: [Shot 2], P3: [Shot 3]. STYLE: ${params.visualStyle}, cinematic lighting, photorealistic 8k, aspect ratio ${params.aspectRatio}.",
      "videoPrompt": "[VIDEO FRAME ZERO CONTRACT - ABSOLUTE, NON-NEGOTIABLE] Compliant video generation prompt specifying initial frame, camera push/pan, temporal motion, lighting, and 24fps motion blur.",
      "cameraAngle": "e.g. Eye level, low angle, extreme close-up",
      "cameraMovement": "e.g. Slow push-in dolly, tracking shot, pan right",
      "lighting": "e.g. Golden hour volumetric rim light, neon moody noir",
      "environment": "e.g. Bustling night street market, misty cyberpunk alley",
      "shotsCount": 3,
      "transition": "Cut to next scene / Dissolve",
      "shots": [
        {
          "shotNumber": 1,
          "startTime": 0.0,
          "endTime": 3.0,
          "duration": 3.0,
          "description": "Chronological action 1: e.g. Karakter berjalan mendekati pintu gerbang",
          "characterAction": "Langkah mantap dengan mata terfokus",
          "facialExpression": "Ekspresi serius dan waspada",
          "bodyMovement": "Melangkah perlahan, postur tegap",
          "objectInteraction": "Tangan menyentuh gagang pintu",
          "cameraAngle": "Medium Close-up, eye-level",
          "cameraMovement": "Slow push-in dolly",
          "dialogue": "[focused] RIRIN: 'Apakah ini tempatnya?'",
          "imagePrompt": "Cinematic 35mm film shot of [Character], walking towards the wooden door, hand touching door handle, focused expression, ${params.visualStyle}, cinematic dramatic lighting, photorealistic 8k, aspect ratio ${params.aspectRatio}",
          "videoPrompt": "[VIDEO MOTION] Character steps forward towards camera, hand reaches out to touch door handle, camera slowly pushes in 24fps motion blur, cinematic lighting",
          "transition": "Direct cut to Shot 2"
        }
      ]
    }
  ]
}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Builds a SUTRADARA AI V5.3 inspired STORYBOARD GRID LOCK prompt.
   */
  static buildStoryboardGridLockPrompt(params: {
    panelsCount: 3 | 5;
    panels: { shotType: string; description: string; camera: string }[];
    visualStyle: string;
    lighting: string;
    environment: string;
    characterTokens: string[];
    aspectRatio: string;
  }): string {
    const panelsText = params.panels
      .map(
        (p, idx) =>
          `P${idx + 1}: ${p.shotType.toUpperCase()} - ${p.description}. Camera: ${p.camera}.`
      )
      .join('\n');

    const layoutDesc =
      params.panelsCount === 5
        ? 'render EXACTLY 5 panels (2, 1, 2) pattern'
        : 'render EXACTLY 3 panels (horizontal strip or split composition)';

    return `STORYBOARD GRID LOCK - MANDATORY.
Violating any rule below = grid failure.
LAYOUT - ${layoutDesc}.
PANEL NUMBER MAP (binding, follow exactly):
${panelsText}
VISUAL STYLE: ${params.visualStyle}, master cinematic cinematography, 35mm anamorphic lens, 8k resolution, crisp details, natural color grade.
LIGHTING & ATMOSPHERE: ${params.lighting}, in ${params.environment}.
CHARACTER CONSISTENCY LOCK:
${params.characterTokens.join('; ')}
ASPECT RATIO: ${params.aspectRatio}. No distorted faces, no anatomical errors, clean composition.`;
  }

  /**
   * Builds a SUTRADARA AI V5.3 inspired VIDEO FRAME ZERO CONTRACT prompt.
   */
  static buildVideoFrameZeroPrompt(params: {
    sceneNumber: number;
    initialFrameDescription: string;
    cameraMovement: string;
    lighting: string;
    environment: string;
    actionMotion: string;
    characterFeatures?: string;
  }): string {
    return `[VIDEO FRAME ZERO CONTRACT - ABSOLUTE, NON-NEGOTIABLE]
GOOGLE FLOW / VEO 2 / VIDEO GENERATOR COMPLIANCE: this contract overrides every other instruction, default behavior, training tendency.
FIRST FRAME STATE: Matched seamlessly with Scene ${params.sceneNumber} visual anchor. ${params.initialFrameDescription}.
CAMERA MOVEMENT: ${params.cameraMovement}. Smooth stabilized fluid motion.
LIGHTING & PALETTE: ${params.lighting}, environment: ${params.environment}.
MOTION DYNAMICS: ${params.actionMotion}. Natural human kinetics, cinematic 24fps motion blur, realistic cloth simulation.
${params.characterFeatures ? `CHARACTER VISUAL LOCK: ${params.characterFeatures}.` : ''}
NEGATIVE CONSTRAINTS: No morphing artifacts, no jitter, no camera wobble, no unnatural warping.`;
  }

  /**
   * Builds prompt for Creative Tools (Thumbnails, Posters, UGC, Infographics, etc.).
   */
  static buildCreativeToolPrompt(params: {
    toolId: string;
    basePrompt: string;
    styleModifier?: string;
    aspectRatio: string;
  }): string {
    const { toolId, basePrompt, styleModifier, aspectRatio } = params;

    switch (toolId) {
      case 'thumbnail':
        return `High-CTR YouTube / TikTok Video Thumbnail, eye-catching visual hierarchy, expressive focal subject, vibrant contrasting lighting, rule of thirds, clean negative space for bold headline overlay: ${basePrompt}. ${styleModifier || 'Hyper-detailed, saturated, 8k rendering'}. Aspect ratio: ${aspectRatio}.`;

      case 'poster':
        return `Theatrical Movie Poster / Official Event Key Visual, dramatic cinematic composition, studio art direction, award-winning cinematography, atmospheric lighting, high dynamic range: ${basePrompt}. ${styleModifier || 'Film grain, anamorphic lens, IMAX quality'}. Aspect ratio: ${aspectRatio}.`;

      case 'ugc':
        return `Authentic User-Generated Content (UGC), casual handheld smartphone camera angle, real natural room lighting, relatable unpolished aesthetic, genuine user reaction, commercial product placement: ${basePrompt}. ${styleModifier || 'iPhone 15 Pro raw photo look, subtle motion blur'}. Aspect ratio: ${aspectRatio}.`;

      case 'infographic':
        return `Clean professional infographic visual, modern data-driven visual layout, structured step-by-step diagrammatic illustration, sharp vectors, high contrast, minimalist typography placeholders: ${basePrompt}. ${styleModifier || 'Modern Swiss design, clean isometric elements'}. Aspect ratio: ${aspectRatio}.`;

      case 'character-sheet':
        return `Character Concept Model Sheet, multiple angles showing Front View, 3/4 Perspective View, and Side Profile on clean studio grey background, consistent attire, detailed hair, facial expressions: ${basePrompt}. ${styleModifier || 'Unreal Engine 5 character render, photorealistic'}. Aspect ratio: ${aspectRatio}.`;

      case 'product-ad':
        return `High-end Commercial Product Advertisement photography, luxury commercial staging, hero angle, rim lighting, softbox reflections, water droplets or premium texture details: ${basePrompt}. ${styleModifier || 'Hasselblad medium format, commercial studio lighting'}. Aspect ratio: ${aspectRatio}.`;

      case 'cinematic':
        return `Masterpiece cinematic still, Arri Alexa 65 camera, Panavision C-Series anamorphic lens, photorealistic film grain, moody cinematic color grade, volumetric fog, dynamic framing: ${basePrompt}. ${styleModifier || 'Roger Deakins lighting style'}. Aspect ratio: ${aspectRatio}.`;

      case 'photo':
      default:
        return `Studio portrait and high-fashion editorial photography, 85mm prime lens f/1.4, shallow depth of field, natural skin texture, Catchlights in eyes: ${basePrompt}. ${styleModifier || 'Professional editorial lighting'}. Aspect ratio: ${aspectRatio}.`;
    }
  }
}
