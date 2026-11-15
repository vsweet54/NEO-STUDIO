export interface StorageQuotaInfo {
  supported: boolean;
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  formattedUsed: string;
  formattedTotal: string;
  isWarning: boolean; // true if > 80% used
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return {
      supported: false,
      usedBytes: 0,
      totalBytes: 0,
      percentUsed: 0,
      formattedUsed: 'N/A',
      formattedTotal: 'N/A',
      isWarning: false,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usedBytes = estimate.usage || 0;
    const totalBytes = estimate.quota || 0;
    const percentUsed = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return {
      supported: true,
      usedBytes,
      totalBytes,
      percentUsed: Math.min(100, Math.round(percentUsed * 10) / 10),
      formattedUsed: formatBytes(usedBytes),
      formattedTotal: formatBytes(totalBytes),
      isWarning: percentUsed > 80,
    };
  } catch (err) {
    console.error('Error estimating storage:', err);
    return {
      supported: false,
      usedBytes: 0,
      totalBytes: 0,
      percentUsed: 0,
      formattedUsed: 'Error',
      formattedTotal: 'Error',
      isWarning: false,
    };
  }
}
