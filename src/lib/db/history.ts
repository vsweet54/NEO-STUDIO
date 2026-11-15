import { getDB } from './index';
import { GenerationHistoryItem } from '@/types/generation';

export async function addHistoryItem(item: GenerationHistoryItem): Promise<void> {
  const db = await getDB();
  await db.put('generation_history', item);
}

export async function getAllHistory(): Promise<GenerationHistoryItem[]> {
  const db = await getDB();
  const history = await db.getAllFromIndex('generation_history', 'by-created');
  return history.reverse(); // Newest first
}

export async function getHistoryByProject(projectId: string): Promise<GenerationHistoryItem[]> {
  const db = await getDB();
  const history = await db.getAllFromIndex('generation_history', 'by-project', projectId);
  return history.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getGenerationStats(): Promise<{
  totalImages: number;
  totalVideos: number;
  totalAudio: number;
  totalText: number;
  totalCost: number;
}> {
  const db = await getDB();
  const all = await db.getAll('generation_history');

  let totalImages = 0;
  let totalVideos = 0;
  let totalAudio = 0;
  let totalText = 0;
  let totalCost = 0;

  for (const item of all) {
    if (item.type === 'image') totalImages++;
    else if (item.type === 'video') totalVideos++;
    else if (item.type === 'audio') totalAudio++;
    else if (item.type === 'text') totalText++;

    if (item.estimatedCost) {
      totalCost += item.estimatedCost;
    }
  }

  return { totalImages, totalVideos, totalAudio, totalText, totalCost };
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('generation_history');
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('generation_history', id);
}
