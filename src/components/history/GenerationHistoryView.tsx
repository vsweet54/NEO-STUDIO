import React, { useState, useEffect } from 'react';
import {
  History,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Clock,
  Trash2,
  DollarSign,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getAllHistory, clearHistory, deleteHistoryItem } from '@/lib/db/history';
import { getMediaBlobUrl } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';
import { GenerationHistoryItem } from '@/types/generation';
import { ModalityType } from '@/types/provider';

export const GenerationHistoryView: React.FC = () => {
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      const list = await getAllHistory();
      setHistory(list);

      const urls: Record<string, string> = {};
      for (const item of list) {
        if (item.outputBlobId && item.type === 'image') {
          const u = await getMediaBlobUrl(item.outputBlobId);
          if (u) urls[item.outputBlobId] = u;
        }
      }
      setBlobUrls(urls);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearAll = async () => {
    if (!confirm('Hapus seluruh riwayat generasi dari IndexedDB?')) return;
    await clearHistory();
    await loadHistory();
  };

  const handleDelete = async (id: string) => {
    await deleteHistoryItem(id);
    await loadHistory();
  };

  const filtered = history.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-gray-400" />
            Generation History & Cost Audit
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Audit transparan riwayat eksekusi prompt, penggunaan token, latensi, dan estimasi biaya per provider.
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAll}
            className="text-xs self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Bersihkan Riwayat
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', 'image', 'video', 'audio', 'text'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${
              filterType === type
                ? 'bg-accent-purple text-white border-accent-purple'
                : 'bg-surface text-gray-400 border-border hover:text-white'
            }`}
          >
            {type === 'all' ? 'Semua Riwayat' : type}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center space-y-2 bg-[#0C0E1B]">
          <History className="w-10 h-10 mx-auto text-gray-600 opacity-40" />
          <p className="text-sm font-medium text-gray-300">Belum ada riwayat untuk kategori ini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-surface border border-border rounded-xl space-y-3 shadow-sm hover:border-gray-600 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      item.type === 'image'
                        ? 'purple'
                        : item.type === 'video'
                        ? 'warning'
                        : item.type === 'audio'
                        ? 'success'
                        : 'cyan'
                    }
                    size="sm"
                    className="uppercase font-mono text-[10px]"
                  >
                    {item.type}
                  </Badge>

                  <Badge
                    variant={item.status === 'completed' ? 'success' : 'danger'}
                    size="sm"
                    className="text-[10px]"
                  >
                    {item.status}
                  </Badge>

                  <span className="text-xs font-mono text-gray-300">
                    {item.provider} / {item.model}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {(item.durationMs / 1000).toFixed(1)}s
                  </span>
                  {item.tokenUsage && <span>{item.tokenUsage.totalTokens} tokens</span>}
                  {item.estimatedCost !== undefined && (
                    <span className="text-emerald-400 font-semibold">
                      ${item.estimatedCost.toFixed(4)}
                    </span>
                  )}
                  <span className="text-gray-500">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-gray-500 hover:text-red-400 p-1"
                    title="Hapus baris ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Prompt Text */}
              <p className="text-xs text-gray-200 font-mono bg-[#0D0E1A] p-2.5 rounded-lg border border-border/80 break-words">
                {item.prompt}
              </p>

              {/* Image Preview if available */}
              {item.outputBlobId && blobUrls[item.outputBlobId] && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={blobUrls[item.outputBlobId]}
                    alt="Output thumb"
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadMediaBlobFile(item.outputBlobId!, `output_${item.id}.png`)}
                    className="text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              )}

              {item.error && (
                <p className="text-xs text-red-400 font-mono bg-red-950/40 p-2 rounded-lg">
                  {item.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
