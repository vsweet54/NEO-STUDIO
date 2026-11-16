"use client";

import React, { useState, useEffect } from "react";
import { VERIFIED_MODELS, PROVIDERS } from "@/lib/providers/registry"; 

// ⭐️ PERBAIKAN: Menggunakan Named Export (bukan export default) ⭐️
export function ProviderManager() {
  const [editStates, setEditStates] = useState<Record<string, any>>({});
  const [modelTestResults, setModelTestResults] = useState<Record<string, any>>({});
  const [modelTestingId, setModelTestingId] = useState<string | null>(null);
  const [selectedModelIds, setSelectedModelIds] = useState<Record<string, string>>({});
  
  const [dynamicModels, setDynamicModels] = useState<Record<string, {id: string, name: string}[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState<Record<string, boolean>>({});
  
  const [providerStatus, setProviderStatus] = useState<Record<string, string>>({});
  const [savedMessage, setSavedMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedConfigs = localStorage.getItem("neo_studio_configs");
    if (savedConfigs) {
      const parsed = JSON.parse(savedConfigs);
      setEditStates(parsed);
      
      const newStatus: Record<string, string> = {};
      Object.keys(parsed).forEach(key => {
        if (parsed[key].apiKey) newStatus[key] = "READY";
      });
      setProviderStatus(newStatus);
    }
  }, []);

  const handleInputChange = (providerId: string, field: string, value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], [field]: value }
    }));
  };

  const handleSaveConfig = (providerId: string) => {
    const currentData = editStates[providerId] || {};
    const allConfigs = JSON.parse(localStorage.getItem("neo_studio_configs") || "{}");
    allConfigs[providerId] = currentData;
    localStorage.setItem("neo_studio_configs", JSON.stringify(allConfigs));

    setProviderStatus(prev => ({ ...prev, [providerId]: "READY" }));
    setSavedMessage(prev => ({ ...prev, [providerId]: "✅ Konfigurasi tersimpan!" }));
    
    setTimeout(() => {
      setSavedMessage(prev => ({ ...prev, [providerId]: "" }));
    }, 3000);
  };

  const handleFetchModels = async (providerId: string) => {
    const edit = editStates[providerId] || {};
    if (!edit.apiKey) {
      alert("Masukkan API Key terlebih dahulu.");
      return;
    }

    setIsFetchingModels(prev => ({ ...prev, [providerId]: true }));
    try {
      const res = await fetch('/api/providers/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey: edit.apiKey, accountId: edit.accountId, baseUrl: edit.baseUrl }),
      });
      const data = await res.json();
      
      if (data.success) {
        setDynamicModels(prev => ({ ...prev, [providerId]: data.models }));
      } else {
        alert(data.error || "Gagal mengambil model");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFetchingModels(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestModel = async (providerId: string) => {
    const edit = editStates[providerId] || {};
    const selectedId = selectedModelIds[providerId];
    
    if (!selectedId) {
      setModelTestResults((prev) => ({
        ...prev,
        [providerId]: { success: false, message: 'Pilih model terlebih dahulu.' },
      }));
      return;
    }

    setModelTestingId(providerId);
    setModelTestResults((prev) => ({ ...prev, [providerId]: null }));

    try {
      const res = await fetch('/api/providers/model-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: providerId,
          modelId: selectedId, 
          apiKey: edit.apiKey,
          accountId: edit.accountId,
          baseUrl: edit.baseUrl,
        }),
      });

      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Gagal terhubung');
      }
      
      setModelTestResults((prev) => ({
        ...prev,
        [providerId]: { success: true, message: data.message, latency: data.latency },
      }));
    } catch (error: any) {
      setModelTestResults((prev) => ({
        ...prev,
        [providerId]: { success: false, message: error.message },
      }));
    } finally {
      setModelTestingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {PROVIDERS.map((prov) => {
        const edit = editStates[prov.id] || {};
        const testResult = modelTestResults[prov.id];
        const status = providerStatus[prov.id] || "UNCONFIGURED";
        
        const staticModels = VERIFIED_MODELS.filter((m) => m.providerId === prov.id);
        const fetchedModels = dynamicModels[prov.id] || [];
        
        const allAvailableModels = [...staticModels];
        fetchedModels.forEach(fm => {
          if (!allAvailableModels.find(sm => sm.id === fm.id)) {
            allAvailableModels.push({ id: fm.id, name: fm.name, providerId: prov.id, capabilities: { supportsText: true, supportsVision: false, supportsAudio: false } });
          }
        });

        return (
          <div key={prov.id} className="border border-gray-800 rounded-xl p-6 bg-[#0f111a] text-white">
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">{prov.name} API</h3>
                <p className="text-sm text-gray-400">{prov.description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${status === 'READY' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                {status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={() => handleFetchModels(prov.id)}
                disabled={isFetchingModels[prov.id]}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {isFetchingModels[prov.id] ? 'Memuat...' : '🔄 Ambil Model'}
              </button>

              <select
                value={selectedModelIds[prov.id] || ''}
                onChange={(e) => setSelectedModelIds((prev) => ({ ...prev, [prov.id]: e.target.value }))}
                className="bg-[#1a1b26] border border-gray-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:border-cyan-500 max-w-xs truncate"
              >
                <option value="">-- Pilih Model ({allAvailableModels.length}) --</option>
                {allAvailableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <button 
                onClick={() => handleTestModel(prov.id)} 
                disabled={modelTestingId === prov.id || !selectedModelIds[prov.id]}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold px-4 py-2 rounded-md disabled:opacity-50"
              >
                {modelTestingId === prov.id ? 'Menguji...' : 'Test Koneksi'}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key (Multi-Key Pool)</label>
                <input 
                  type="password"
                  placeholder="Masukkan API Key..."
                  value={edit.apiKey || ''}
                  onChange={(e) => handleInputChange(prov.id, 'apiKey', e.target.value)}
                  className="w-full bg-[#1a1b26] border border-gray-700 text-white rounded-md px-3 py-2 outline-none"
                />
              </div>

              {prov.id === 'cloudflare' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Cloudflare Account ID</label>
                  <input 
                    type="text"
                    placeholder="Account ID"
                    value={edit.accountId || ''}
                    onChange={(e) => handleInputChange(prov.id, 'accountId', e.target.value)}
                    className="w-full bg-[#1a1b26] border border-gray-700 text-white rounded-md px-3 py-2 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Base URL Endpoint (Opsional)</label>
                <input 
                  type="text"
                  placeholder={prov.id === 'ollama' ? 'https://ollama.com' : 'Biarkan kosong jika default'}
                  value={edit.baseUrl || ''}
                  onChange={(e) => handleInputChange(prov.id, 'baseUrl', e.target.value)}
                  className="w-full bg-[#1a1b26] border border-gray-700 text-white rounded-md px-3 py-2 outline-none"
                />
              </div>

              <button 
                onClick={() => handleSaveConfig(prov.id)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-md transition-colors"
              >
                Simpan Konfigurasi
              </button>
              {savedMessage[prov.id] && <p className="text-green-400 text-sm text-center mt-2">{savedMessage[prov.id]}</p>}
            </div>

            {testResult && (
              <div className={`mt-6 p-4 rounded-lg border ${testResult.success ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                <p className="font-medium">{testResult.success ? '✅ Tes Berhasil' : '❌ Tes Gagal'}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{testResult.message}</p>
                {testResult.latency && <p className="text-xs mt-2 opacity-70">Latency: {testResult.latency}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}