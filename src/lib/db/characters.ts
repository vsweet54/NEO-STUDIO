import { getDB } from './index';
import { Character } from '@/types/character';

export async function getCharactersByProject(projectId: string): Promise<Character[]> {
  const db = await getDB();
  return db.getAllFromIndex('characters', 'by-project', projectId);
}

export async function getCharacterById(characterId: string): Promise<Character | undefined> {
  const db = await getDB();
  return db.get('characters', characterId);
}

export async function saveCharacter(character: Character): Promise<void> {
  const db = await getDB();
  await db.put('characters', {
    ...character,
    updatedAt: Date.now(),
  });
}

export async function deleteCharacter(characterId: string): Promise<void> {
  const db = await getDB();
  await db.delete('characters', characterId);
}
