import { Character } from '@/types/character';
import { Scene } from '@/types/project';

/**
 * Builds a deterministic, locked visual DNA string for a character.
 * This exact string is injected into diffusion prompts across all scenes and shots
 * to guarantee that face, skin tone, hair, age, and clothing stay 100% consistent.
 */
export function buildCharacterDNAString(char: Character): string {
  const traits: string[] = [];
  if (char.ageAppearance) traits.push(`${char.ageAppearance} years old`);
  if (char.bodyType) traits.push(`${char.bodyType} build`);
  if (char.physicalAppearance) traits.push(char.physicalAppearance);
  if (char.faceDescription) traits.push(`face: ${char.faceDescription}`);
  if (char.hairStyle) traits.push(`hair: ${char.hairStyle}`);
  if (char.clothing) traits.push(`signature outfit: ${char.clothing}`);

  return traits.filter(Boolean).join(', ');
}

/**
 * Injects the character visual DNA lock into the storyboard/shot prompt.
 */
export function enrichPromptWithCharacterDNA(
  prompt: string,
  scene: Scene,
  characters: Character[]
): string {
  if (!prompt || !characters || characters.length === 0) return prompt;

  // 1. Identify which characters belong to this scene
  let targetChars = characters.filter((c) => scene.characterIds?.includes(c.id));

  // If none matched by ID, match by character name in prompt or scene description
  if (targetChars.length === 0) {
    const textPool = `${prompt} ${scene.title} ${scene.description}`.toLowerCase();
    targetChars = characters.filter((c) => textPool.includes(c.name.toLowerCase()));
  }

  // If still none matched, fallback to the main character (protagonist)
  if (targetChars.length === 0 && characters.length > 0) {
    targetChars = [characters[0]];
  }

  let enrichedPrompt = prompt;

  for (const char of targetChars) {
    const dna = buildCharacterDNAString(char);
    if (!dna) continue;

    // Check if prompt already contains detailed clothing/hair to avoid redundant doubling
    const alreadyHasDNA =
      (char.clothing && enrichedPrompt.toLowerCase().includes(char.clothing.toLowerCase().slice(0, 15))) ||
      enrichedPrompt.includes('CHARACTER VISUAL LOCK');

    if (alreadyHasDNA) {
      continue;
    }

    const nameRegex = new RegExp(`\\b${char.name}\\b`, 'i');
    if (nameRegex.test(enrichedPrompt)) {
      enrichedPrompt = enrichedPrompt.replace(
        nameRegex,
        `${char.name} [CHARACTER VISUAL LOCK: ${dna}]`
      );
    } else {
      enrichedPrompt = `[CHARACTER VISUAL LOCK: ${char.name} (${dna})], ${enrichedPrompt}`;
    }
  }

  return enrichedPrompt;
}
