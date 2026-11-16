import { getDB } from './index';
import { Scene } from '@/types/project';

export async function getScenesByEpisode(episodeId: string): Promise<Scene[]> {
  const db = await getDB();
  const scenes = await db.getAllFromIndex('scenes', 'by-episode', episodeId);
  return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export async function getScenesByProject(projectId: string): Promise<Scene[]> {
  const db = await getDB();
  const scenes = await db.getAllFromIndex('scenes', 'by-project', projectId);
  return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export async function getSceneById(sceneId: string): Promise<Scene | undefined> {
  const db = await getDB();
  return db.get('scenes', sceneId);
}

export async function saveScene(scene: Scene): Promise<void> {
  const db = await getDB();
  await db.put('scenes', {
    ...scene,
    updatedAt: Date.now(),
  });
}

export async function deleteScene(sceneId: string): Promise<void> {
  const db = await getDB();
  await db.delete('scenes', sceneId);
}

export async function duplicateScene(sceneId: string): Promise<Scene> {
  const db = await getDB();
  const original = await db.get('scenes', sceneId);
  if (!original) throw new Error('Scene not found');

  const siblings = await getScenesByEpisode(original.episodeId);
  const maxSceneNum = siblings.reduce((max, s) => Math.max(max, s.sceneNumber), 0);

  const newScene: Scene = {
    ...original,
    id: 'sc_' + Math.random().toString(36).substring(2, 9) + Date.now(),
    sceneNumber: maxSceneNum + 1,
    title: `${original.title} (Copy)`,
    // Reset generation outputs for the copy
    generatedImageBlobId: undefined,
    generatedVideoBlobId: undefined,
    generatedAudioBlobId: undefined,
    generationStatus: 'prompts-ready',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.add('scenes', newScene);
  return newScene;
}

export async function reorderScenes(sceneIdsInOrder: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('scenes', 'readwrite');
  const store = tx.objectStore('scenes');

  for (let i = 0; i < sceneIdsInOrder.length; i++) {
    const scene = await store.get(sceneIdsInOrder[i]);
    if (scene) {
      scene.sceneNumber = i + 1;
      scene.updatedAt = Date.now();
      await store.put(scene);
    }
  }

  await tx.done;
}
