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
import { ModelSpecializationEngine } from '@/lib/intelligence/specialization';
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
  Table as TableIcon,
  LayoutGrid,
  BarChart3,
  Award,
} from 'lucide-react';

export const ModelLabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'specializations'>('models');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testingCategory, setTestingCategory] = useState<TestingCategory | null>(null);
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

  // Test single model on a specific category
  const handleTestSingleModel = async (model: DiscoveredModel, category?: TestingCategory) => {
    setTestingModelId(model.id);
    setTestingCategory(category || null);
    try {
      const providerConfigs = await getProviderConfigs();
      const provConfig = providerConfigs.find((p) => p.id === model.provider);

      const res = await fetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          providerConfig: provConfig,
          options: { allowPaid, category },
        }),
      });

      const data = await res.json();
      if (data.success && data.model && data.record) {
        // Update local state and IndexedDB
        setModels((prev) => {
          const updated = prev.map((m) => (m.id === data.model.id ? data.model : m));
          // Also update specializations matrix automatically based on new benchmark scores
          const matrix = ModelSpecializationEngine.generateMatrix(updated);
          saveSpecializations(Object.values(matrix.configs));
          return updated;
        });
        await saveDiscoveredModels([data.model]);
        await saveTestRecord(data.record);
      } else {
        alert(`Uji coba gagal: ${data.error || 'Gagal'}`);
      }
    } catch (err: any) {
      alert(`Kesalahan pengujian: ${err.message}`);
    } finally {
      setTestingModelId(null);
      setTestingCategory(null);
    }
  };

  // Run comprehensive multi-category benchmark for a single model
  const handleRunBenchmarkForModel = async (model: DiscoveredModel) => {
    setTestingModelId(model.id);
    try {
      const providerConfigs = await getProviderConfigs();
      const provConfig = providerConfigs.find((p) => p.id === model.provider);

      const categoriesToTest: TestingCategory[] = [];
      if (model.capabilities.supportsImageGen) {
        categoriesToTest.push('IMAGE_GEN');
      } else if (model.capabilities.supportsAudioGen) {
        categoriesToTest.push('AUDIO');
      } else {
        if (model.capabilities.supportsText) categoriesToTest.push('TEXT');
        if (model.roles.includes('CODING')) categoriesToTest.push('CODING');
        if (model.capabilities.supportsVision) categoriesToTest.push('VISION');
      }

      let currentModel = model;
      for (const cat of categoriesToTest) {
        setTestingCategory(cat);
        const res = await fetch('/api/models/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: currentModel,
            providerConfig: provConfig,
            options: { allowPaid, category: cat },
          }),
        });
        const data = await res.json();
        if (data.success && data.model && data.record) {
          currentModel = data.model;
          await saveTestRecord(data.record);
        }
      }

      setModels((prev) => {
        const updated = prev.map((m) => (m.id === currentModel.id ? currentModel : m));
        const matrix = ModelSpecializationEngine.generateMatrix(updated);
        saveSpecializations(Object.values(matrix.configs));
        return updated;
      });
      await saveDiscoveredModels([currentModel]);
    } catch (err: any) {
      alert(`Kesalahan pengujian benchmark: ${err.message}`);
    } finally {
      setTestingModelId(null);
      setTestingCategory(null);
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
      if (stopTestingRef.current) break;

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

  // Run full multi-category benchmark across all discovered models
  const handleRunFullBenchmarkSuite = async () => {
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
      if (stopTestingRef.current) break;

      setTestingModelId(model.id);
      try {
        const provConfig = providerConfigs.find((p) => p.id === model.provider);
        const categoriesToTest: TestingCategory[] = [];
        if (model.capabilities.supportsImageGen) {
          categoriesToTest.push('IMAGE_GEN');
        } else if (model.capabilities.supportsAudioGen) {
          categoriesToTest.push('AUDIO');
        } else {
          if (model.capabilities.supportsText) categoriesToTest.push('TEXT');
          if (model.roles.includes('CODING')) categoriesToTest.push('CODING');
          if (model.capabilities.supportsVision) categoriesToTest.push('VISION');
        }

        let cur = model;
        for (const cat of categoriesToTest) {
          if (stopTestingRef.current) break;
          setTestingCategory(cat);
          const res = await fetch('/api/models/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: cur,
              providerConfig: provConfig,
              options: { allowPaid, category: cat },
            }),
          });
          const data = await res.json();
          if (data.success && data.model && data.record) {
            cur = data.model;
            await saveTestRecord(data.record);
          }
        }

        setModels((prev) => prev.map((m) => (m.id === cur.id ? cur : m)));
        await saveDiscoveredModels([cur]);
      } catch (err) {
        console.warn(`[Model Lab] Benchmark error for ${model.id}:`, err);
      }
    }

    // Refresh specialization matrix with new benchmark scores
    const currentList = await getDiscoveredModels();
    const matrix = ModelSpecializationEngine.generateMatrix(currentList);
    await saveSpecializations(Object.values(matrix.configs));

    setTestingModelId(null);
    setTestingCategory(null);
    setIsTestingAll(false);
  };

  const handleStopTesting = () => {
    stopTestingRef.current = true;
    setIsTestingAll(false);
    setTestingModelId(null);
    setTestingCategory(null);
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchId = m.id.toLowerCase().includes(q);
      const matchDesc = m.description.toLowerCase().includes(q);
      const matchRole = m.roles.some((r) => r.toLowerCase().includes(q));
      if (!matchName && !matchId && !matchDesc && !matchRole) return false;
    }

    if (providerFilter !== 'all' && m.provider !== providerFilter) return false;

    if (pricingFilter !== 'all') {
      if (pricingFilter === 'free' && m.pricing.classification !== 'FREE' && m.pricing.classification !== 'FREE_LIMITED') {
        return false;
      }
      if (pricingFilter === 'paid' && m.pricing.classification !== 'PAID') return false;
      if (pricingFilter === 'unknown' && m.pricing.classification !== 'UNKNOWN') return false;
    }

    if (capabilityFilter !== 'all') {
      if (capabilityFilter === 'coding' && !m.roles.includes('CODING')) return false;
      if (capabilityFilter === 'vision' && !m.capabilities.supportsVision) return false;
      if (capabilityFilter === 'image_gen' && !m.capabilities.supportsImageGen) return false;
      if (capabilityFilter === 'audio' && !m.capabilities.supportsAudioGen) return false;
      if (capabilityFilter === 'video' && !m.capabilities.supportsVideoGen) return false;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'pass' && m.testStatus !== 'PASS') return false;
      if (statusFilter === 'fail' && m.testStatus !== 'FAIL') return false;
      if (statusFilter === 'blocked' && m.testStatus !== 'BLOCKED') return false;
      if (statusFilter === 'untested' && m.testStatus !== 'NOT_TESTED') return false;
    }

    return true;
  });

  // Render score badge with color thresholds
  const renderScoreCell = (score?: number, isSupported = true) => {
    if (!isSupported) {
      return <span className="text-gray-600 font-mono select-none">—</span>;
    }
    if (score === undefined) {
      return <span className="text-gray-500 text-[11px] font-mono">Belum Diuji</span>;
    }
    let colorClass = 'text-gray-300';
    if (score >= 90) colorClass = 'text-emerald-400 font-bold';
    else if (score >= 75) colorClass = 'text-cyan-400 font-semibold';
    else if (score >= 50) colorClass = 'text-amber-400 font-medium';
    else colorClass = 'text-red-400';

    return <span className={`font-mono text-xs ${colorClass}`}>{score}</span>;
  };

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
              Sistem benchmark inferensi objektif otomatis multi-provider untuk Google Gemini, Groq, NVIDIA, OpenRouter, Ollama, dan Cloudflare.
              Menghitung skor coding, vision, gambar, teks, dan kecepatan untuk menentukan penugasan model terbaik secara objektif.
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
              <BarChart3 className="w-3.5 h-3.5" />
              Papan Skor & Pengujian ({totalCount})
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
                <>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRunFullBenchmarkSuite}
                    disabled={isDiscovering || models.length === 0}
                    className="text-xs gap-1.5 border-cyan-800 text-cyan-300 hover:bg-cyan-950/40"
                  >
                    <Award className="w-3.5 h-3.5 text-cyan-400" />
                    Jalankan Benchmark Penuh
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleStopTesting}
                  className="text-xs gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Testing {testingCategory ? `(${testingCategory})` : ''}
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

          {/* Search, Filters & View Mode Switcher */}
          <div className="p-4 rounded-xl bg-[#0C0E1B] border border-border/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search input */}
              <div className="relative min-w-[200px] flex-1 max-w-sm">
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
                <option value="ollama">Ollama (Lokal & Cloud)</option>
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

            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#14172B] p-0.5 rounded-lg border border-border shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-accent-purple text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Papan Skor Benchmark Tabel"
              >
                <TableIcon className="w-3.5 h-3.5" />
                Papan Skor Tabel
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-accent-purple text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Tampilan Kartu Detail"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Kartu Detail
              </button>
            </div>
          </div>

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
          ) : viewMode === 'table' ? (
            /* =========================================================================
               TABEL PAPAN SKOR BENCHMARK OBJEKTIF (OBJECTIVE BENCHMARK SCOREBOARD)
               Format: Provider | Model | Coding | Vision | Image | Chat/Text | Speed | Overall
               ========================================================================= */
            <div className="overflow-x-auto rounded-xl border border-border bg-[#0C0E1B] shadow-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-[#101328] text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Provider</th>
                    <th className="py-3 px-3">Model</th>
                    <th className="py-3 px-2 text-center">Biaya</th>
                    <th className="py-3 px-2 text-center">Coding</th>
                    <th className="py-3 px-2 text-center">Vision</th>
                    <th className="py-3 px-2 text-center">Image</th>
                    <th className="py-3 px-2 text-center">Chat / Teks</th>
                    <th className="py-3 px-2 text-center">Audio</th>
                    <th className="py-3 px-2 text-center">Kecepatan</th>
                    <th className="py-3 px-2 text-center">Skor Objektif</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Aksi Benchmark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredModels.map((model) => {
                    const isTestingThis = testingModelId === model.id;
                    const b = model.benchmarkScores || {};

                    // Biaya label & style
                    let pricingBadgeVariant: 'success' | 'cyan' | 'warning' | 'neutral' = 'neutral';
                    let pricingShort: string = model.pricing.classification;
                    if (model.pricing.classification === 'FREE') {
                      pricingBadgeVariant = 'success';
                      pricingShort = 'FREE';
                    } else if (model.pricing.classification === 'FREE_LIMITED') {
                      pricingBadgeVariant = 'cyan';
                      pricingShort = 'LIMITED';
                    } else if (model.pricing.classification === 'PAID') {
                      pricingBadgeVariant = 'warning';
                      pricingShort = 'PAID';
                    }

                    // Test Status Badge
                    let statusBadge = (
                      <Badge variant="neutral" size="sm">
                        UNTESTED
                      </Badge>
                    );
                    if (model.testStatus === 'PASS') {
                      statusBadge = (
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="w-2.5 h-2.5" /> PASS
                        </Badge>
                      );
                    } else if (model.testStatus === 'FAIL') {
                      statusBadge = (
                        <Badge variant="danger" size="sm">
                          <XCircle className="w-2.5 h-2.5" /> FAIL
                        </Badge>
                      );
                    } else if (model.testStatus === 'BLOCKED') {
                      statusBadge = (
                        <Badge variant="warning" size="sm">
                          <ShieldAlert className="w-2.5 h-2.5" /> BLOCKED
                        </Badge>
                      );
                    }

                    return (
                      <tr
                        key={model.id}
                        className="hover:bg-[#14172E]/60 transition-colors group"
                      >
                        {/* Provider */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary font-bold text-gray-300 uppercase">
                            {model.provider}
                          </span>
                        </td>

                        {/* Model Name & ID */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white max-w-[200px] truncate" title={model.name}>
                            {model.name}
                          </div>
                          <div className="font-mono text-[10px] text-gray-500 truncate max-w-[200px]" title={model.id}>
                            {model.id}
                          </div>
                        </td>

                        {/* Biaya */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <Badge variant={pricingBadgeVariant} size="sm">
                            {pricingShort}
                          </Badge>
                        </td>

                        {/* Coding Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {renderScoreCell(
                            b.coding,
                            model.roles.includes('CODING') || model.capabilities.supportsText
                          )}
                        </td>

                        {/* Vision Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {renderScoreCell(b.vision, model.capabilities.supportsVision)}
                        </td>

                        {/* Image Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {renderScoreCell(b.imageGen, model.capabilities.supportsImageGen)}
                        </td>

                        {/* Chat / Teks Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {renderScoreCell(b.generalChat, model.capabilities.supportsText)}
                        </td>

                        {/* Audio Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {renderScoreCell(
                            b.audio,
                            model.capabilities.supportsAudioGen || model.capabilities.supportsAudioInput
                          )}
                        </td>

                        {/* Kecepatan (Latency) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap font-mono text-gray-400">
                          {model.latencyMs && model.latencyMs > 0 ? (
                            <span className="text-[11px] flex items-center justify-center gap-0.5 text-gray-300">
                              <Clock className="w-3 h-3 text-gray-500" />
                              {model.latencyMs}ms
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>

                        {/* Skor Objektif (Overall) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {b.overallScore !== undefined ? (
                            <span className="px-2 py-0.5 rounded-full font-mono font-bold text-xs bg-accent-purple/20 text-purple-300 border border-accent-purple/40">
                              {b.overallScore}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {statusBadge}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRunBenchmarkForModel(model)}
                              disabled={isTestingThis || isTestingAll}
                              className="text-[11px] gap-1 px-2 py-0.5 h-7 border-border hover:border-accent-purple"
                              title="Jalankan pengujian benchmark multi-kategori"
                            >
                              {isTestingThis ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-accent-purple" />
                              ) : (
                                <Award className="w-3 h-3 text-accent-cyan" />
                              )}
                              {isTestingThis ? (testingCategory || 'Menguji...') : 'Benchmark'}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTestSingleModel(model)}
                              disabled={isTestingThis || isTestingAll}
                              className="text-[11px] gap-1 px-2 py-0.5 h-7 text-gray-300 hover:text-white"
                              title="Uji coba cepat single inference"
                            >
                              <Play className="w-3 h-3 text-emerald-400" />
                              Uji
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* =========================================================================
               TAMPILAN KARTU DETAIL MODEL
               ========================================================================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((model) => {
                const isCurrentlyTesting = testingModelId === model.id;
                const isDiagnosticsOpen = !!expandedDiagnostics[model.id];

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

                      {/* Benchmark Scores Preview Bar */}
                      {model.benchmarkScores && (
                        <div className="mt-3 p-2 rounded-lg bg-[#14172B] border border-border/60">
                          <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1 flex items-center justify-between">
                            <span>Skor Benchmark:</span>
                            {model.benchmarkScores.overallScore !== undefined && (
                              <span className="font-mono text-emerald-400 font-bold">
                                Rata-rata: {model.benchmarkScores.overallScore}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                            {model.benchmarkScores.coding !== undefined && (
                              <div className="p-1 rounded bg-[#1B203B]">
                                <span className="text-gray-400 block text-[9px]">Code</span>
                                <span className="text-emerald-400 font-bold">{model.benchmarkScores.coding}</span>
                              </div>
                            )}
                            {model.benchmarkScores.vision !== undefined && (
                              <div className="p-1 rounded bg-[#1B203B]">
                                <span className="text-gray-400 block text-[9px]">Vision</span>
                                <span className="text-pink-400 font-bold">{model.benchmarkScores.vision}</span>
                              </div>
                            )}
                            {model.benchmarkScores.imageGen !== undefined && (
                              <div className="p-1 rounded bg-[#1B203B]">
                                <span className="text-gray-400 block text-[9px]">Image</span>
                                <span className="text-amber-400 font-bold">{model.benchmarkScores.imageGen}</span>
                              </div>
                            )}
                            {model.benchmarkScores.generalChat !== undefined && (
                              <div className="p-1 rounded bg-[#1B203B]">
                                <span className="text-gray-400 block text-[9px]">Chat</span>
                                <span className="text-purple-400 font-bold">{model.benchmarkScores.generalChat}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

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

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRunBenchmarkForModel(model)}
                          disabled={isCurrentlyTesting || isTestingAll}
                          className="text-xs gap-1 px-2.5 py-1 border-accent-purple/40"
                          title="Jalankan pengujian benchmark multi-kategori"
                        >
                          <Award className="w-3 h-3 text-cyan-400" />
                          Benchmark
                        </Button>

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
                          {isCurrentlyTesting ? 'Menguji...' : 'Uji'}
                        </Button>
                      </div>
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
