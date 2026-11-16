import React, { useState, useEffect, useRef } from 'react';
import {
  DiscoveredModel,
  ModelPricingClassification,
  ModelTestStatus,
  TestingCategory,
} from '@/types/model-intelligence';
import { ProviderId } from '@/types/provider';
import {
  getDiscoveredModels,
  saveDiscoveredModels,
  saveTestRecord,
  getSpecializations,
  saveSpecializations,
  exportIntelligenceJSON,
  exportModelsCSV,
} from '@/lib/db/model-intelligence';
import { getProviderConfigs } from '@/lib/db/settings';
import { ModelSpecializationView } from './ModelSpecializationView';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Cpu,
  Sparkles,
  Search,
  Filter,
  Play,
  Square,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Gift,
  Coins,
  FileCode,
  Eye,
  Image as ImageIcon,
  Mic,
  Video,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';

export const ModelLabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'specializations'>('models');
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [allowPaid, setAllowPaid] = useState(false);
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Record<string, boolean>>({});

  // Stop testing control
  const stopTestingRef = useRef(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');
  const [pricingFilter, setPricingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load from IndexedDB
  const loadModelsFromDB = async () => {
    setLoading(true);
    try {
      const stored = await getDiscoveredModels();
      if (stored && stored.length > 0) {
        setModels(stored);
      } else {
        // If empty, auto-trigger first discovery
        await handleDiscoverAll();
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModelsFromDB();
  }, []);

  // Trigger Discovery API
  const handleDiscoverAll = async () => {
    setIsDiscovering(true);
    try {
      const providerConfigs = await getProviderConfigs();
      const res = await fetch('/api/models/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerConfigs }),
      });
      const data = await res.json();
      if (data.success && data.models) {
        setModels(data.models);
        await saveDiscoveredModels(data.models);
        if (data.specializations) {
          await saveSpecializations(Object.values(data.specializations));
        }
      } else {
        alert(`Gagal mengambil katalog model: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Kesalahan koneksi saat discovery: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Test single model
  const handleTestSingleModel = async (model: DiscoveredModel) => {
    setTestingModelId(model.id);
    try {
      const providerConfigs = await getProviderConfigs();
      const provConfig = providerConfigs.find((p) => p.id === model.provider);

      const res = await fetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          providerConfig: provConfig,
          options: { allowPaid },
        }),
      });

      const data = await res.json();
      if (data.success && data.model && data.record) {
        // Update local state and IndexedDB
        setModels((prev) =>
          prev.map((m) => (m.id === data.model.id ? data.model : m))
        );
        await saveDiscoveredModels([data.model]);
        await saveTestRecord(data.record);
      } else {
        alert(`Uji coba gagal: ${data.error || 'Gagal'}`);
      }
    } catch (err: any) {
      alert(`Kesalahan pengujian: ${err.message}`);
    } finally {
      setTestingModelId(null);
    }
  };

  // Test all free models sequentially
  const handleTestAllFreeModels = async () => {
    setIsTestingAll(true);
    stopTestingRef.current = false;

    const candidateModels = models.filter((m) => {
      const isFree =
        m.pricing.classification === 'FREE' ||
        m.pricing.classification === 'FREE_LIMITED' ||
        m.pricing.classification === 'FREE_TRIAL';
      return isFree || allowPaid;
    });

    const providerConfigs = await getProviderConfigs();

    for (const model of candidateModels) {
      if (stopTestingRef.current) {
        console.log('[Model Lab] Pengujian dihentikan oleh pengguna.');
        break;
      }

      setTestingModelId(model.id);
      try {
        const provConfig = providerConfigs.find((p) => p.id === model.provider);
        const res = await fetch('/api/models/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            providerConfig: provConfig,
            options: { allowPaid },
          }),
        });
        const data = await res.json();
        if (data.success && data.model && data.record) {
          setModels((prev) =>
            prev.map((m) => (m.id === data.model.id ? data.model : m))
          );
          await saveDiscoveredModels([data.model]);
          await saveTestRecord(data.record);
        }
      } catch (err) {
        console.warn(`[Model Lab] Gagal menguji model ${model.id}:`, err);
      }
    }

    setTestingModelId(null);
    setIsTestingAll(false);
  };

  const handleStopTesting = () => {
    stopTestingRef.current = true;
    setIsTestingAll(false);
    setTestingModelId(null);
  };

  const handleExportJSON = async () => {
    const jsonStr = await exportIntelligenceJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neo_ai_model_intelligence_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    const csvStr = await exportModelsCSV();
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neo_ai_models_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Metrics calculations
  const totalCount = models.length;
  const passCount = models.filter((m) => m.testStatus === 'PASS').length;
  const failCount = models.filter((m) => m.testStatus === 'FAIL').length;
  const blockedCount = models.filter((m) => m.testStatus === 'BLOCKED').length;
  const freeCount = models.filter(
    (m) => m.pricing.classification === 'FREE' || m.pricing.classification === 'FREE_LIMITED'
  ).length;
  const paidCount = models.filter((m) => m.pricing.classification === 'PAID').length;

  // Filtered models
  const filteredModels = models.filter((m) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchId = m.id.toLowerCase().includes(q);
      const matchDesc = m.description.toLowerCase().includes(q);
      const matchRole = m.roles.some((r) => r.toLowerCase().includes(q));
      if (!matchName && !matchId && !matchDesc && !matchRole) return false;
    }

    // Provider filter
    if (providerFilter !== 'all' && m.provider !== providerFilter) return false;

    // Pricing filter
    if (pricingFilter !== 'all') {
      if (pricingFilter === 'free' && m.pricing.classification !== 'FREE' && m.pricing.classification !== 'FREE_LIMITED') {
        return false;
      }
      if (pricingFilter === 'paid' && m.pricing.classification !== 'PAID') return false;
      if (pricingFilter === 'unknown' && m.pricing.classification !== 'UNKNOWN') return false;
    }

    // Capability filter
    if (capabilityFilter !== 'all') {
      if (capabilityFilter === 'coding' && !m.roles.includes('CODING')) return false;
      if (capabilityFilter === 'vision' && !m.capabilities.supportsVision) return false;
      if (capabilityFilter === 'image_gen' && !m.capabilities.supportsImageGen) return false;
      if (capabilityFilter === 'audio' && !m.capabilities.supportsAudioGen) return false;
      if (capabilityFilter === 'video' && !m.capabilities.supportsVideoGen) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pass' && m.testStatus !== 'PASS') return false;
      if (statusFilter === 'fail' && m.testStatus !== 'FAIL') return false;
      if (statusFilter === 'blocked' && m.testStatus !== 'BLOCKED') return false;
      if (statusFilter === 'untested' && m.testStatus !== 'NOT_TESTED') return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0C0E1B] via-[#121630] to-[#080910] border border-border p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="purple" size="md" className="font-mono">
                UNIVERSAL MODEL INTELLIGENCE
              </Badge>
              <Badge variant="cyan" size="md" className="font-mono">
                by xyrons
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide flex items-center gap-2.5">
              <Cpu className="w-6 h-6 text-accent-cyan" />
              NEO AI Model Intelligence Lab
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl">
              Sistem penemuan mandiri, pengujian inferensi nyata, deteksi model gratis, klasifikasi kapabilitas,
              dan routing tugas multi-provider otomatis untuk Google Gemini, Groq, NVIDIA, OpenRouter, Ollama, dan Cloudflare.
            </p>
          </div>

          {/* Sub-tab navigation */}
          <div className="flex items-center bg-[#07080E] p-1 rounded-xl border border-border/80 shrink-0">
            <button
              onClick={() => setActiveTab('models')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'models'
                  ? 'bg-accent-purple text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Katalog & Pengujian ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('specializations')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'specializations'
                  ? 'bg-accent-purple text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Matriks Penugasan Tugas
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'specializations' ? (
        <ModelSpecializationView discoveredModels={models} />
      ) : (
        <>
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0C0E1B] border border-border/80 flex flex-col justify-between">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                Total Model
              </span>
              <div className="text-xl font-bold text-white mt-1">{totalCount}</div>
              <span className="text-[10px] text-gray-500 mt-0.5">6 AI Providers</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0C0E1B] border border-emerald-900/40 flex flex-col justify-between">
              <span className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <Gift className="w-3 h-3" />
                Model Gratis
              </span>
              <div className="text-xl font-bold text-emerald-300 mt-1">{freeCount}</div>
              <span className="text-[10px] text-emerald-500/80 mt-0.5">Free & Free Limited</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0C0E1B] border border-amber-900/40 flex flex-col justify-between">
              <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <Coins className="w-3 h-3" />
                Model Berbayar
              </span>
              <div className="text-xl font-bold text-amber-300 mt-1">{paidCount}</div>
              <span className="text-[10px] text-amber-500/80 mt-0.5">Perlu Billing/Credits</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0C0E1B] border border-emerald-900/50 flex flex-col justify-between">
              <span className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Lolos Uji (PASS)
              </span>
              <div className="text-xl font-bold text-emerald-300 mt-1">{passCount}</div>
              <span className="text-[10px] text-emerald-500/80 mt-0.5">Siap digunakan</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0C0E1B] border border-red-900/40 flex flex-col justify-between">
              <span className="text-[11px] text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Gagal Uji (FAIL)
              </span>
              <div className="text-xl font-bold text-red-300 mt-1">{failCount}</div>
              <span className="text-[10px] text-red-500/80 mt-0.5">Perlu perbaikan</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0C0E1B] border border-purple-900/40 flex flex-col justify-between">
              <span className="text-[11px] text-purple-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Diblokir (Safety)
              </span>
              <div className="text-xl font-bold text-purple-300 mt-1">{blockedCount}</div>
              <span className="text-[10px] text-purple-400/80 mt-0.5">Billing Guard Active</span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="p-4 rounded-xl bg-[#0C0E1B] border border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleDiscoverAll}
                disabled={isDiscovering || isTestingAll}
                className="text-xs gap-1.5 bg-gradient-to-r from-accent-purple to-accent-cyan"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                {isDiscovering ? 'Menemukan Model...' : 'Discover All Models'}
              </Button>

              {!isTestingAll ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestAllFreeModels}
                  disabled={isDiscovering || models.length === 0}
                  className="text-xs gap-1.5 border-emerald-800 text-emerald-300 hover:bg-emerald-950/40"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Test All Free Models
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleStopTesting}
                  className="text-xs gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Testing
                </Button>
              )}

              {/* Safety Gate Checkbox */}
              <label className="flex items-center gap-2 ml-2 text-xs text-gray-300 cursor-pointer bg-secondary/60 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-secondary">
                <input
                  type="checkbox"
                  checked={allowPaid}
                  onChange={(e) => setAllowPaid(e.target.checked)}
                  className="rounded text-accent-purple focus:ring-accent-purple"
                />
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  Izinkan Pengujian Model Berbayar (PAID)
                </span>
              </label>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportJSON}
                className="text-xs gap-1.5 text-gray-300 hover:text-white"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Export JSON
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCSV}
                className="text-xs gap-1.5 text-gray-300 hover:text-white"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="p-4 rounded-xl bg-[#0C0E1B] border border-border/80 flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari model berdasarkan nama, id, peran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#14172B] border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple"
              />
            </div>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="bg-[#14172B] border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent-purple"
            >
              <option value="all">Semua Provider</option>
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq LPU</option>
              <option value="nvidia">NVIDIA NIM</option>
              <option value="openrouter">OpenRouter</option>
              <option value="cloudflare">Cloudflare Workers AI</option>
              <option value="ollama">Ollama (Lokal)</option>
            </select>

            {/* Capability Filter */}
            <select
              value={capabilityFilter}
              onChange={(e) => setCapabilityFilter(e.target.value)}
              className="bg-[#14172B] border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent-purple"
            >
              <option value="all">Semua Kapabilitas</option>
              <option value="coding">Coding & Pemrograman</option>
              <option value="vision">Vision / Input Gambar</option>
              <option value="image_gen">Image Generation</option>
              <option value="audio">Audio / Suara</option>
              <option value="video">Video Generation</option>
            </select>

            {/* Pricing Filter */}
            <select
              value={pricingFilter}
              onChange={(e) => setPricingFilter(e.target.value)}
              className="bg-[#14172B] border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent-purple"
            >
              <option value="all">Semua Biaya</option>
              <option value="free">Gratis (Free / Limited)</option>
              <option value="paid">Berbayar (PAID)</option>
              <option value="unknown">Tidak Diketahui</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#14172B] border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent-purple"
            >
              <option value="all">Semua Status Uji</option>
              <option value="pass">Lolos Uji (PASS)</option>
              <option value="fail">Gagal Uji (FAIL)</option>
              <option value="blocked">Diblokir (BLOCKED)</option>
              <option value="untested">Belum Diuji</option>
            </select>
          </div>

          {/* Model Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-purple" />
              Memuat katalog model dari database lokal...
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-[#0C0E1B] border border-border text-gray-400">
              <Cpu className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-sm font-semibold text-gray-300">Tidak ada model yang cocok dengan filter.</p>
              <p className="text-xs text-gray-500 mt-1">Coba sesuaikan kata kunci pencarian atau bersihkan filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((model) => {
                const isCurrentlyTesting = testingModelId === model.id;
                const isDiagnosticsOpen = !!expandedDiagnostics[model.id];

                // Pricing Badge Variant
                let pricingVariant: 'success' | 'cyan' | 'warning' | 'danger' | 'neutral' = 'neutral';
                let pricingLabel: string = model.pricing.classification;
                if (model.pricing.classification === 'FREE') {
                  pricingVariant = 'success';
                  pricingLabel = 'FREE (100% Gratis)';
                } else if (model.pricing.classification === 'FREE_LIMITED') {
                  pricingVariant = 'cyan';
                  pricingLabel = 'FREE LIMITED (Batas Kuota)';
                } else if (model.pricing.classification === 'PAID') {
                  pricingVariant = 'warning';
                  pricingLabel = 'PAID (Perlu Billing)';
                }

                // Test Status Badge
                let statusBadge = (
                  <Badge variant="neutral" size="sm">
                    NOT TESTED
                  </Badge>
                );
                if (model.testStatus === 'PASS') {
                  statusBadge = (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3" /> PASS
                    </Badge>
                  );
                } else if (model.testStatus === 'FAIL') {
                  statusBadge = (
                    <Badge variant="danger" size="sm">
                      <XCircle className="w-3 h-3" /> FAIL
                    </Badge>
                  );
                } else if (model.testStatus === 'BLOCKED') {
                  statusBadge = (
                    <Badge variant="warning" size="sm">
                      <ShieldAlert className="w-3 h-3" /> BLOCKED
                    </Badge>
                  );
                }

                return (
                  <div
                    key={model.id}
                    className="p-4 rounded-xl bg-[#0C0E1B] border border-border/80 flex flex-col justify-between space-y-3 hover:border-accent-purple/50 transition-colors"
                  >
                    <div>
                      {/* Top bar: Provider & Pricing */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary font-bold text-gray-300 uppercase">
                          {model.provider}
                        </span>
                        <Badge variant={pricingVariant} size="sm">
                          {pricingLabel}
                        </Badge>
                      </div>

                      {/* Model Name & ID */}
                      <h3 className="text-sm font-bold text-white truncate" title={model.name}>
                        {model.name}
                      </h3>
                      <p className="text-[11px] font-mono text-gray-400 truncate mt-0.5" title={model.id}>
                        {model.id}
                      </p>

                      <p className="text-xs text-gray-400 mt-2 line-clamp-2" title={model.description}>
                        {model.description || 'Model kecerdasan buatan terverifikasi untuk tugas kreatif.'}
                      </p>

                      {/* Capabilities pills */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {model.capabilities.supportsText && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161A35] text-purple-300 border border-purple-900/60 flex items-center gap-1">
                            <FileCode className="w-2.5 h-2.5" /> Text
                          </span>
                        )}
                        {model.roles.includes('CODING') && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#162A35] text-cyan-300 border border-cyan-900/60 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> Coding
                          </span>
                        )}
                        {model.capabilities.supportsVision && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A1635] text-pink-300 border border-pink-900/60 flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" /> Vision
                          </span>
                        )}
                        {model.capabilities.supportsImageGen && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#352516] text-amber-300 border border-amber-900/60 flex items-center gap-1">
                            <ImageIcon className="w-2.5 h-2.5" /> Image
                          </span>
                        )}
                        {model.capabilities.supportsAudioGen && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#163523] text-emerald-300 border border-emerald-900/60 flex items-center gap-1">
                            <Mic className="w-2.5 h-2.5" /> Audio
                          </span>
                        )}
                        {model.capabilities.supportsVideoGen && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#351616] text-red-300 border border-red-900/60 flex items-center gap-1">
                            <Video className="w-2.5 h-2.5" /> Video
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-gray-400">
                          {model.capabilities.maxContextTokens.toLocaleString()} ctx
                        </span>
                      </div>

                      {/* Assigned Roles */}
                      <div className="mt-3 pt-2 border-t border-border/50">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                          Tugas / Peran Khusus:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {model.roles.slice(0, 4).map((role) => (
                            <span
                              key={role}
                              className="text-[9px] px-1 py-0.5 rounded bg-[#121422] text-gray-300 border border-border"
                            >
                              {role}
                            </span>
                          ))}
                          {model.roles.length > 4 && (
                            <span className="text-[9px] px-1 py-0.5 text-gray-500">
                              +{model.roles.length - 4} lainnya
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Diagnostics Alert Box (if error exists) */}
                    {model.errorInfo && (
                      <div className="rounded-lg bg-red-950/40 border border-red-900/60 p-2.5 text-xs text-red-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold flex items-center gap-1 text-[11px] text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            {model.errorInfo.code}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDiagnostics((prev) => ({
                                ...prev,
                                [model.id]: !prev[model.id],
                              }))
                            }
                            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-0.5"
                          >
                            {isDiagnosticsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>

                        {isDiagnosticsOpen ? (
                          <div className="pt-1 space-y-1 text-[11px] border-t border-red-900/40 animate-in fade-in">
                            <p className="text-gray-300 font-mono text-[10px]">{model.errorInfo.message}</p>
                            <p className="text-emerald-400 font-medium">
                              💡 Solusi: {model.errorInfo.safeResolution}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 truncate">
                            {model.errorInfo.safeResolution}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Bottom Status & Action Bar */}
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusBadge}
                        {model.latencyMs && model.latencyMs > 0 && (
                          <span className="text-[10px] text-gray-400 font-mono flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-gray-500" />
                            {model.latencyMs}ms
                          </span>
                        )}
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestSingleModel(model)}
                        disabled={isCurrentlyTesting || isTestingAll}
                        className="text-xs gap-1 px-2.5 py-1"
                      >
                        {isCurrentlyTesting ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-accent-purple" />
                        ) : (
                          <Play className="w-3 h-3 text-emerald-400" />
                        )}
                        {isCurrentlyTesting ? 'Menguji...' : 'Uji Model'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
