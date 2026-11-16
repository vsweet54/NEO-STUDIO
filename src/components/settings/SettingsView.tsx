import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  HardDrive,
  Download,
  Upload,
  AlertTriangle,
  FileArchive,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Input';
import { getStorageQuotaInfo, StorageQuotaInfo } from '@/lib/storage/quota';
import { backupAllProjects, importProjectFromZip } from '@/lib/storage/export-import';
import { getRouterConfig, saveRouterConfig } from '@/lib/db/settings';
import { RouterConfig, RouterMode } from '@/types/provider';

export const SettingsView: React.FC = () => {
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [routerConfig, setRouterConfig] = useState<RouterConfig | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [q, r] = await Promise.all([getStorageQuotaInfo(), getRouterConfig()]);
      setQuota(q);
      setRouterConfig(r);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBackup = async () => {
    try {
      setActionLoading('backup');
      await backupAllProjects();
      setNotice('Backup seluruh proyek berhasil diunduh dalam file ZIP!');
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(`Gagal membuat backup: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setActionLoading('restore');
      await importProjectFromZip(file);
      await loadData();
      setNotice('Proyek berhasil dipulihkan dari file backup ZIP!');
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(`Gagal memulihkan backup: ${err.message}`);
    } finally {
      setActionLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleAutoFallback = async () => {
    if (!routerConfig) return;
    const updated: RouterConfig = {
      ...routerConfig,
      autoFallbackEnabled: !routerConfig.autoFallbackEnabled,
    };
    await saveRouterConfig(updated);
    setRouterConfig(updated);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-gray-400" />
            Application Settings & Storage
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manajemen penyimpanan lokal IndexedDB, pencadangan (backup/restore), dan pengaturan AI Router.
          </p>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium animate-in fade-in">
          {notice}
        </div>
      )}

      {/* Storage Quota Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-accent-cyan" />
            <h3 className="text-sm font-bold text-white">Status Penyimpanan Lokal Browser</h3>
          </div>
          {quota?.isWarning && (
            <Badge variant="warning" size="sm">
              <AlertTriangle className="w-3 h-3" /> Kuota Hampir Penuh (&gt;80%)
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-gray-300">
            <span>Terpakai: {quota?.formattedUsed || '0 B'}</span>
            <span>Total Kuota Tersedia: {quota?.formattedTotal || 'N/A'}</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                quota?.isWarning
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-accent-purple to-accent-cyan'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, quota?.percentUsed || 0))}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Data tersimpan 100% di browser Anda (IndexedDB & Blob). Data tidak akan hilang setelah browser ditutup, namun pastikan untuk melakukan ekspor ZIP cadangan secara berkala.
          </p>
        </div>
      </div>

      {/* Backup and Restore Section */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <FileArchive className="w-5 h-5 text-accent-purple" />
          <h3 className="text-sm font-bold text-white">Backup & Restore Seluruh Data</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Unduh master arsip ZIP yang memuat seluruh proyek, karakter, episode, adegan, dialog, dan file biner gambar/audio/video secara utuh.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestoreFile}
            accept=".zip"
            className="hidden"
          />

          <Button
            variant="cyan"
            size="md"
            onClick={handleBackup}
            isLoading={actionLoading === 'backup'}
          >
            <Download className="w-4 h-4" /> Download Full Backup ZIP
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            isLoading={actionLoading === 'restore'}
          >
            <Upload className="w-4 h-4" /> Pulihkan Proyek dari ZIP
          </Button>
        </div>
      </div>

      {/* Hybrid AI Router Preferences */}
      {routerConfig && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent-cyan" />
            <h3 className="text-sm font-bold text-white">Konfigurasi Hybrid AI Router</h3>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#0D0E1A] rounded-xl border border-border">
            <div>
              <h4 className="text-xs font-semibold text-gray-200">
                Automatic Transparent Fallback
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Bila provider utama mengalami rate limit (429) atau downtime, otomatis beralih ke provider cadangan tanpa biaya tersembunyi.
              </p>
            </div>
            <button
              onClick={handleToggleAutoFallback}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                routerConfig.autoFallbackEnabled ? 'bg-accent-purple' : 'bg-secondary'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  routerConfig.autoFallbackEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
