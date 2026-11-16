import React, { useState, useEffect } from 'react';
import {
  DiscoveredModel,
  TaskSpecializationConfig,
  ModelRole,
} from '@/types/model-intelligence';
import { SUPPORTED_TASK_SPECS, ModelSpecializationEngine } from '@/lib/intelligence/specialization';
import { getSpecializations, saveSpecializations } from '@/lib/db/model-intelligence';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Sparkles,
  RotateCcw,
  Save,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Zap,
  Gift,
  ArrowRight,
} from 'lucide-react';

interface ModelSpecializationViewProps {
  discoveredModels: DiscoveredModel[];
  onSpecializationsUpdated?: () => void;
}

export const ModelSpecializationView: React.FC<ModelSpecializationViewProps> = ({
  discoveredModels,
  onSpecializationsUpdated,
}) => {
  const [configs, setConfigs] = useState<Record<string, TaskSpecializationConfig>>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const saved = await getSpecializations();
      if (saved && saved.length > 0) {
        const map: Record<string, TaskSpecializationConfig> = {};
        saved.forEach((s) => {
          map[s.task] = s;
        });
        setConfigs(map);
      } else if (discoveredModels.length > 0) {
        const matrix = ModelSpecializationEngine.generateMatrix(discoveredModels);
        setConfigs(matrix.configs);
      }
    }
    load();
  }, [discoveredModels]);

  const handleSelectModel = (
    taskKey: string,
    tier: 'primaryModelId' | 'secondaryModelId' | 'fastModelId' | 'bestFreeModelId' | 'backupModelId',
    modelId: string
  ) => {
    setConfigs((prev) => {
      const existing = prev[taskKey];
      if (!existing) return prev;
      return {
        ...prev,
        [taskKey]: {
          ...existing,
          [tier]: modelId,
          isManualOverride: true,
          updatedAt: Date.now(),
        },
      };
    });
  };

  const handleResetTask = (taskKey: string) => {
    const fresh = ModelSpecializationEngine.generateMatrix(discoveredModels);
    if (fresh.configs[taskKey]) {
      setConfigs((prev) => ({
        ...prev,
        [taskKey]: fresh.configs[taskKey],
      }));
    }
  };

  const handleResetAll = () => {
    const fresh = ModelSpecializationEngine.generateMatrix(discoveredModels);
    setConfigs(fresh.configs);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await saveSpecializations(Object.values(configs));
      setSaveNotice('Semua spesialisasi model berhasil disimpan ke database lokal!');
      if (onSpecializationsUpdated) onSpecializationsUpdated();
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err: any) {
      alert(`Gagal menyimpan spesialisasi: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#0C0E1B] border border-border">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent-cyan" />
            Matriks Spesialisasi & Penugasan Tugas AI
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Setiap model AI ditugaskan secara otomatis berdasarkan validasi kapabilitas, peran, dan pengujian riil.
            Anda dapat menyesuaikan model untuk setiap tingkatan kapan saja.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleResetAll} className="text-xs gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke Otomatis
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="text-xs gap-1.5 bg-gradient-to-r from-accent-purple to-accent-cyan"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Menyimpan...' : 'Simpan Matriks'}
          </Button>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Task Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUPPORTED_TASK_SPECS.map((spec) => {
          const current = configs[spec.task];
          const primary = current?.primaryModelId || '';
          const secondary = current?.secondaryModelId || '';
          const fast = current?.fastModelId || '';
          const bestFree = current?.bestFreeModelId || '';
          const backup = current?.backupModelId || '';
          const isManual = current?.isManualOverride;

          // Filter models matching role or capability
          const compatibleModels = discoveredModels.filter(
            (m) =>
              m.roles.includes(spec.requiredRole) ||
              (spec.requiredRole === 'IMAGE_GENERATION' && m.capabilities.supportsImageGen) ||
              (spec.requiredRole === 'VIDEO_GENERATION' && m.capabilities.supportsVideoGen) ||
              (spec.requiredRole === 'AUDIO_GENERATION' && m.capabilities.supportsAudioGen) ||
              (spec.requiredRole === 'TEXT_TO_SPEECH' && m.capabilities.supportsAudioGen) ||
              (spec.requiredRole === 'VISION' && m.capabilities.supportsVision) ||
              m.capabilities.supportsText
          );

          return (
            <div
              key={spec.task}
              className="p-4 rounded-xl bg-[#0C0E1B] border border-border/80 flex flex-col justify-between space-y-4 hover:border-accent-purple/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                      {spec.label}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">{spec.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="cyan" size="sm">
                      {spec.requiredRole}
                    </Badge>
                    {isManual && (
                      <Badge variant="warning" size="sm">
                        Manual
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Slots */}
                <div className="space-y-2 mt-4 text-xs">
                  {/* Primary Slot */}
                  <div>
                    <label className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Model Utama (Primary)
                    </label>
                    <select
                      value={primary}
                      onChange={(e) => handleSelectModel(spec.task, 'primaryModelId', e.target.value)}
                      className="w-full bg-[#14172B] border border-emerald-900/60 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Model Utama --</option>
                      {compatibleModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.provider.toUpperCase()}] {m.name} ({m.pricing.classification})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Secondary & Fast Slots */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">
                        Model Sekunder
                      </label>
                      <select
                        value={secondary}
                        onChange={(e) => handleSelectModel(spec.task, 'secondaryModelId', e.target.value)}
                        className="w-full bg-[#14172B] border border-border rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-accent-purple"
                      >
                        <option value="">-- Kosong --</option>
                        {compatibleModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.provider}] {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        Model Cepat (Fast)
                      </label>
                      <select
                        value={fast}
                        onChange={(e) => handleSelectModel(spec.task, 'fastModelId', e.target.value)}
                        className="w-full bg-[#14172B] border border-border rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-accent-purple"
                      >
                        <option value="">-- Kosong --</option>
                        {compatibleModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.provider}] {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Best Free & Backup Slots */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-emerald-400 block mb-1 flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        Model Gratis Terbaik
                      </label>
                      <select
                        value={bestFree}
                        onChange={(e) => handleSelectModel(spec.task, 'bestFreeModelId', e.target.value)}
                        className="w-full bg-[#14172B] border border-emerald-950/80 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Kosong --</option>
                        {compatibleModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.provider}] {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">
                        Model Cadangan (Backup)
                      </label>
                      <select
                        value={backup}
                        onChange={(e) => handleSelectModel(spec.task, 'backupModelId', e.target.value)}
                        className="w-full bg-[#14172B] border border-border rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-accent-purple"
                      >
                        <option value="">-- Kosong --</option>
                        {compatibleModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.provider}] {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => handleResetTask(spec.task)}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Tugas Ini
                </button>
                <span className="text-gray-500 font-mono text-[10px]">
                  {compatibleModels.length} model kompatibel
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
