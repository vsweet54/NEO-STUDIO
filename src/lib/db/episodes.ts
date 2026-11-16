import { getDB } from './index';
import { Episode } from '@/types/project';

export async function getEpisodesByProject(projectId: string): Promise<Episode[]> {
  const db = await getDB();
  const episodes = await db.getAllFromIndex('episodes', 'by-project', projectId);
  return episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
}

export async function saveEpisode(episode: Episode): Promise<void> {
  const db = await getDB();
  await db.put('episodes', {
    ...episode,
    updatedAt: Date.now(),
  });
}

export async function deleteEpisode(episodeId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['episodes', 'scenes'], 'readwrite');

  // Delete all scenes in this episode
  const sceneKeys = await tx.objectStore('scenes').index('by-episode').getAllKeys(episodeId);
  for (const key of sceneKeys) {
    await tx.objectStore('scenes').delete(key);
  }

  await tx.objectStore('episodes').delete(episodeId);
  await tx.done;
}
