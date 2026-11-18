import { getDB } from './index';
import { MediaBlobRecord } from '@/types/generation';

// In-memory cache for Object URLs to avoid repeatedly converting blobs
const objectUrlCache = new Map<string, string>();

export async function saveMediaBlob(
  blob: Blob,
  type: 'image' | 'video' | 'audio',
  fileName: string,
  projectId?: string
): Promise<string> {
  const db = await getDB();
  const id = 'blob_' + Math.random().toString(36).substring(2, 9) + Date.now();

  const record: MediaBlobRecord = {
    id,
    projectId,
    type,
    mimeType: blob.type || (type === 'image' ? 'image/png' : type === 'video' ? 'video/mp4' : 'audio/mp3'),
    data: blob,
    fileName,
    size: blob.size,
    createdAt: Date.now(),
  };

  try {
    await db.put('media_blobs', record);
    return id;
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      throw new Error('Penyimpanan lokal penuh (Quota Exceeded). Harap bersihkan riwayat atau ekspor proyek Anda.');
    }
    throw error;
  }
}

export async function getMediaBlob(id: string): Promise<MediaBlobRecord | undefined> {
  const db = await getDB();
  return db.get('media_blobs', id);
}

export async function getMediaBlobUrl(id: string): Promise<string | null> {
  if (!id) return null;

  if (objectUrlCache.has(id)) {
    return objectUrlCache.get(id)!;
  }

  const record = await getMediaBlob(id);
  if (!record || !record.data) return null;

  const url = URL.createObjectURL(record.data);
  objectUrlCache.set(id, url);
  return url;
}

export async function getMediaBlobBase64(id: string): Promise<string | null> {
  if (!id) return null;
  const record = await getMediaBlob(id);
  if (!record || !record.data) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || res;
      resolve(base64);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(record.data);
  });
}

export async function deleteMediaBlob(id: string): Promise<void> {
  if (objectUrlCache.has(id)) {
    URL.revokeObjectURL(objectUrlCache.get(id)!);
    objectUrlCache.delete(id);
  }

  const db = await getDB();
  await db.delete('media_blobs', id);
}

export async function getTotalMediaSize(): Promise<number> {
  const db = await getDB();
  const blobs = await db.getAll('media_blobs');
  return blobs.reduce((total, b) => total + (b.size || 0), 0);
}
