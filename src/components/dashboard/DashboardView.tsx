import React, { useEffect, useState } from 'react';
import {
  Film,
  Image as ImageIcon,
  Video,
  Mic,
  FolderKanban,
  HardDrive,
  Sparkles,
  ArrowRight,
  Plus,
  Play,
  Cpu,
  Clock,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getAllProjects } from '@/lib/db/projects';
import { getGenerationStats, getAllHistory } from '@/lib/db/history';
import { getStorageQuotaInfo, StorageQuotaInfo } from '@/lib/storage/quota';
import { Project } from '@/types/project';
import { GenerationHistoryItem } from '@/types/generation';
import { NavigationTab } from '../layout/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: NavigationTab, param?: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectProject,
  onCreateNewProject,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [stats, setStats] = useState({
    totalImages: 0,
    totalVideos: 0,
    totalAudio: 0,
    totalText: 0,
    totalCost: 0,
  });
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projList, genStats, histList, quotaInfo] = await Promise.all([
          getAllProjects(),
          getGenerationStats(),
          getAllHistory(),
          getStorageQuotaInfo(),
        ]);

        setProjects(projList);
        setStats(genStats);
        setHistory(histList.slice(0, 5));
        setQuota(quotaInfo);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#14162B] via-[#101224] to-[#0A0B14] border border-border p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/20 border border-accent-purple/40 text-accent-purple text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Complete AI Production Platform
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            NEO STUDIO AI <span className="text-accent-cyan font-normal text-xl sm:text-2xl">— Director Console</span>
          </h1>
          <p className="text-sm text-gray-300 leading-relaxed">
            Platform produksi konten sinematik berbasis AI lokal. Ciptakan cerita, karakter konsisten,
            storyboard multi-panel, video AI, dialog bernada emosi, dan creative assets tanpa database cloud.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary" onClick={onCreateNewProject}>
              <Plus className="w-4 h-4" />
              Buat Proyek Baru
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('storyboard')}>
              <Film className="w-4 h-4 text-accent-purple" />
              Buka Storyboard Studio
            </Button>
            <Button variant="outline" onClick={() => onNavigate('providers')}>
              <Cpu className="w-4 h-4 text-accent-cyan" />
              AI Provider Manager
            </Button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-accent-purple/10 to-transparent pointer-events-none" />
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="p-4 bg-surface border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Total Proyek</span>
            <FolderKanban className="w-4 h-4 text-accent-purple" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{projects.length}</div>
          <p className="text-[11px] text-gray-500">Tersimpan di IndexedDB</p>
        </div>

        {/* Generated Images */}
        <div className="p-4 bg-surface border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Gambar AI</span>
            <ImageIcon className="w-4 h-4 text-accent-cyan" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalImages}</div>
          <p className="text-[11px] text-gray-500">Imagen 3 & FLUX.1</p>
        </div>

        {/* Generated Videos */}
        <div className="p-4 bg-surface border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Video AI</span>
            <Video className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalVideos}</div>
          <p className="text-[11px] text-gray-500">Google Veo 2 / Native</p>
        </div>

        {/* Generated Audio & TTS */}
        <div className="p-4 bg-surface border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Audio & Dialog</span>
            <Mic className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalAudio}</div>
          <p className="text-[11px] text-gray-500">Aura TTS & Whisper</p>
        </div>
      </div>

      {/* Storage and Quick Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Usage Card */}
        <div className="p-5 bg-surface border border-border rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-accent-cyan" />
              <h3 className="text-sm font-semibold text-gray-200">Kapasitas Penyimpanan</h3>
            </div>
            {quota?.isWarning && (
              <Badge variant="warning" size="sm">
                <AlertTriangle className="w-3 h-3" /> Hampir Penuh
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
              <span>Terpakai: {quota?.formattedUsed || '0 B'}</span>
              <span>Total: {quota?.formattedTotal || 'N/A'}</span>
            </div>
            <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  quota?.isWarning
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-accent-purple to-accent-cyan'
                }`}
                style={{ width: `${Math.min(100, Math.max(3, quota?.percentUsed || 0))}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Semua data disimpan di browser Anda (IndexedDB) dan tetap ada setelah browser ditutup.
            </p>
          </div>

          <div className="pt-2 border-t border-border/80 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('settings')}
              className="text-xs w-full"
            >
              Kelola Penyimpanan & Backup
            </Button>
          </div>
        </div>

        {/* Quick Launchpad */}
        <div className="lg:col-span-2 p-5 bg-surface border border-border rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-gray-200">Creative Quick Launch</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('storyboard', 'video-ad')}
              className="p-3 bg-secondary/60 hover:bg-secondary border border-border rounded-lg text-left transition-all hover:border-accent-purple/50 group"
            >
              <Film className="w-5 h-5 text-accent-purple mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-gray-200">Video Iklan</div>
              <p className="text-[10px] text-gray-400 mt-0.5">Storyboard komersial & produk</p>
            </button>

            <button
              onClick={() => onNavigate('creative-tools', 'thumbnail')}
              className="p-3 bg-secondary/60 hover:bg-secondary border border-border rounded-lg text-left transition-all hover:border-accent-cyan/50 group"
            >
              <ImageIcon className="w-5 h-5 text-accent-cyan mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-gray-200">Thumbnail Studio</div>
              <p className="text-[10px] text-gray-400 mt-0.5">High CTR YouTube & TikTok</p>
            </button>

            <button
              onClick={() => onNavigate('characters')}
              className="p-3 bg-secondary/60 hover:bg-secondary border border-border rounded-lg text-left transition-all hover:border-pink-500/50 group"
            >
              <Sparkles className="w-5 h-5 text-pink-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-gray-200">Character Studio</div>
              <p className="text-[10px] text-gray-400 mt-0.5">Konsistensi visual multi-angle</p>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-accent-purple" />
            Proyek Terbaru
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('projects')}
            className="text-xs text-accent-purple hover:text-accent-purple-light"
          >
            Lihat Semua Proyek <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center space-y-3 bg-[#0C0E1B]">
            <Film className="w-8 h-8 mx-auto text-gray-600" />
            <p className="text-sm text-gray-400">Belum ada proyek yang dibuat</p>
            <Button variant="primary" size="sm" onClick={onCreateNewProject}>
              <Plus className="w-4 h-4" /> Mulai Proyek Pertama Anda
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((proj) => (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj.id)}
                className="p-4 bg-surface hover:bg-surface-light border border-border hover:border-accent-purple/50 rounded-xl transition-all cursor-pointer group space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="purple" size="sm" className="uppercase font-mono">
                    {proj.category}
                  </Badge>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {new Date(proj.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-100 group-hover:text-accent-cyan transition-colors truncate">
                    {proj.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2 mt-1">{proj.synopsis}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-border/80">
                  <span className="font-mono">{proj.aspectRatio}</span>
                  <span className="flex items-center gap-1 text-accent-cyan text-xs font-medium group-hover:translate-x-1 transition-transform">
                    Buka Studio <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
