import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Key,
  Globe,
  HardDrive,
  Info,
  ShieldCheck,
  Save,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select } from '../ui/Input';
import { ProviderConfig, ProviderId } from '@/types/provider';
import { getProviderConfigs, saveProviderConfig } from '@/lib/db/settings';

export const ProviderManager: React.FC = () => {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Active edit state
  const [editStates, setEditStates] = useState<Record<string, { apiKey: string; accountId?: string; baseUrl?: string }>>({});

  const loadProviders = async () => {
    try {
      const list = await getProviderConfigs();
      setProviders(list);

      const edits: Record<string, any> = {};
      list.forEach((p) => {
        edits[p.id] = {
          apiKey: p.apiKey || '',
          accountId: p.accountId || '',
          baseUrl: p.baseUrl || '',
        };
      });
      setEditStates(edits);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleFieldChange = (providerId: string, field: string, value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: value,
      },
    }));
  };

  const handleSaveProvider = async (provider: ProviderConfig) => {
    const edit = editStates[provider.id] || {};
    const updated: ProviderConfig = {
      ...provider,
      apiKey: edit.apiKey,
      accountId: edit.accountId,
      baseUrl: edit.baseUrl,
      status: edit.apiKey || provider.id === 'ollama' ? 'ready' : 'unconfigured',
    };

    await saveProviderConfig(updated);
    await loadProviders();
    setSaveNotice(`Konfigurasi ${provider.name} tersimpan lokal di browser!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleTestConnection = async (provider: ProviderConfig) => {
    const edit = editStates[provider.id] || {};
    setTestingId(provider.id);

    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          apiKey: edit.apiKey,
          accountId: edit.accountId,
          baseUrl: edit.baseUrl,
        }),
      });

      const json = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          success: json.success,
          message: json.message,
          latencyMs: json.latencyMs,
        },
      }));

      // Update provider status in DB
      const updated: ProviderConfig = {
        ...provider,
        apiKey: edit.apiKey,
        accountId: edit.accountId,
        baseUrl: edit.baseUrl,
        status: json.success ? 'ready' : 'error',
        lastTestedAt: Date.now(),
        latencyMs: json.latencyMs,
        errorMessage: json.success ? undefined : json.message,
      };
      await saveProviderConfig(updated);
      await loadProviders();
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          success: false,
          message: `Network failure: ${err.message}`,
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnable = async (provider: ProviderConfig) => {
    const updated = { ...provider, enabled: !provider.enabled };
    await saveProviderConfig(updated);
    await loadProviders();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-accent-cyan" />
            AI Provider Manager
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Konfigurasi 5 ekosistem AI terintegrasi (Google Gemini, NVIDIA NIM, Cloudflare Workers AI, Groq, dan Ollama).
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero Secret Leakage — Local-First Encryption</span>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium animate-in fade-in">
          {saveNotice}
        </div>
      )}

      {/* Security Architecture Callout */}
      <div className="p-4 bg-[#0D0E1A] border border-border rounded-xl text-xs text-gray-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          <ShieldCheck className="w-4 h-4 text-accent-purple" />
          Arsitektur Keamanan API Key:
        </div>
        <p className="text-gray-400 leading-relaxed">
          Semua API Key hanya tersimpan di perangkat lokal browser Anda (IndexedDB) dan tidak pernah dikirim ke database pihak ketiga.
          Saat melakukan inferensi, API Key diteruskan melalui Next.js server-side proxy aman di memori, sehingga aman dari paparan publik.
        </p>
      </div>

      {/* Providers Cards Grid */}
      <div className="space-y-4">
        {providers.map((prov) => {
          const edit = editStates[prov.id] || { apiKey: '', accountId: '', baseUrl: '' };
          const test = testResults[prov.id];
          const isTesting = testingId === prov.id;

          return (
            <div
              key={prov.id}
              className={`p-5 rounded-2xl border transition-all ${
                prov.enabled
                  ? 'bg-surface border-border shadow-lg'
                  : 'bg-surface/50 border-border/50 opacity-70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
                    <Cpu className="w-5 h-5 text-accent-cyan" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{prov.name}</h3>
                      <Badge
                        variant={
                          prov.status === 'ready'
                            ? 'success'
                            : prov.status === 'error'
                            ? 'danger'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {prov.status.toUpperCase()}
                      </Badge>
                      {prov.latencyMs && (
                        <span className="text-[11px] font-mono text-gray-400">
                          {prov.latencyMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {prov.id === 'gemini' && 'Story, Script, Characters, Imagen 3, Google Veo'}
                      {prov.id === 'nvidia' && 'Enterprise Deep Reasoning, Mixtral, Llama 3.1 70B'}
                      {prov.id === 'cloudflare' && 'Serverless Edge AI, FLUX.1 Schnell, Aura TTS'}
                      {prov.id === 'groq' && 'Ultra-Fast LPU Inference >300 tps, Dialogue, Whisper'}
                      {prov.id === 'ollama' && 'Inference AI Lokal 100% Offline (Llama 3.2, Qwen)'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={prov.enabled ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleEnable(prov)}
                    className="text-xs"
                  >
                    {prov.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>

                  <Button
                    variant="cyan"
                    size="sm"
                    onClick={() => handleTestConnection(prov)}
                    isLoading={isTesting}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Test Koneksi
                  </Button>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-300">
                      {prov.id === 'ollama'
                        ? 'API Key / Bearer Token'
                        : 'API Key (Multi-Key Pool)'}
                    </label>
                    {edit.apiKey && edit.apiKey.includes(',') && (
                      <span className="text-[10px] text-accent-cyan font-mono font-semibold">
                        {edit.apiKey.split(',').filter((k) => k.trim().length > 0).length} Keys Terdeteksi
                      </span>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={edit.apiKey}
                    onChange={(e) => handleFieldChange(prov.id, 'apiKey', e.target.value)}
                    placeholder="key1, key2, key3 (rotasi otomatis bila 429)..."
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Gunakan koma (,) untuk memasukkan beberapa key. Sistem otomatis melakukan rotasi anti-limit.
                  </p>
                </div>

                {prov.id === 'cloudflare' && (
                  <Input
                    label="Cloudflare Account ID"
                    value={edit.accountId || ''}
                    onChange={(e) => handleFieldChange(prov.id, 'accountId', e.target.value)}
                    placeholder="Contoh: a1b2c3d4..."
                  />
                )}

                {(prov.id === 'ollama' || prov.id === 'nvidia' || prov.id === 'groq') && (
                  <Input
                    label="Base URL Endpoint"
                    value={edit.baseUrl || ''}
                    onChange={(e) => handleFieldChange(prov.id, 'baseUrl', e.target.value)}
                    placeholder={
                      prov.id === 'ollama'
                        ? 'http://localhost:11434'
                        : prov.id === 'nvidia'
                        ? 'https://integrate.api.nvidia.com/v1'
                        : 'https://api.groq.com/openai/v1'
                    }
                  />
                )}

                <div className="flex items-end">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleSaveProvider(prov)}
                    className="w-full text-xs"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan Konfigurasi
                  </Button>
                </div>
              </div>

              {/* Ollama local CORS guidance */}
              {prov.id === 'ollama' && (
                <div className="mt-3 p-3 bg-secondary/50 rounded-lg text-[11px] text-gray-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
                  <p>
                    <strong>Panduan Ollama (Lokal & Remote):</strong> Dukung endpoint lokal (<code className="bg-black/50 px-1 py-0.5 rounded text-accent-cyan">http://localhost:11434</code>) maupun remote server / cloud proxy (<code className="bg-black/50 px-1 py-0.5 rounded text-accent-cyan">https://ollama.domain.com</code>). Masukkan <strong>API Key / Bearer Token</strong> jika remote server Anda diproteksi autentikasi (Reverse Proxy, NGINX, Cloudflare Access, atau VPN). Untuk server lokal, jalankan dengan <code className="bg-black/50 px-1 py-0.5 rounded text-accent-cyan">OLLAMA_ORIGINS="*" ollama serve</code>.
                  </p>
                </div>
              )}

              {/* Test Result Feedback */}
              {test && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
                    test.success
                      ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                      : 'bg-red-950/40 border border-red-800 text-red-300'
                  }`}
                >
                  {test.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{test.message}</p>
                    {test.latencyMs && (
                      <p className="text-[10px] opacity-80 mt-0.5 font-mono">
                        Latency: {test.latencyMs}ms
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
