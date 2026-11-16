import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Trash2,
  Sliders,
  Maximize2,
  Copy,
  Layers,
  Check,
  Columns,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { queueManager } from '@/lib/queue/generation-queue';
import { getAllHistory } from '@/lib/db/history';
import { getMediaBlobUrl } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';
import { AspectRatio } from '@/types/project';
import { GenerationHistoryItem } from '@/types/generation';

interface ImageStudioProps {
  projectId?: string;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({ projectId }) => {
  const [prompt, setPrompt] = useState(
    'Cinematic 35mm photograph of Indonesian culinary street market at twilight, warm golden neon lights, bokeh, 8k resolution, photorealistic'
  );
  const [negativePrompt, setNegativePrompt] = useState(
    'blurry, deformed, bad anatomy, duplicate, low quality, oversaturated'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedModel, setSelectedModel] = useState('@cf/black-forest-labs/flux-1-schnell');
  const [isGenerating, setIsGenerating] = useState(false);

  // Gallery of generated images
  const [generatedImages, setGeneratedImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<string[]>([]);

  const loadGeneratedImages = async () => {
    try {
      const history = await getAllHistory();
      const imageHist = history.filter((h) => h.type === 'image' && h.outputBlobId);

      const items: { id: string; url: string; prompt: string }[] = [];
      for (const h of imageHist.slice(0, 12)) {
        if (h.outputBlobId) {
          const url = await getMediaBlobUrl(h.outputBlobId);
          if (url) {
            items.push({ id: h.id, url, prompt: h.prompt });
          }
        }
      }
      setGeneratedImages(items);
      if (items.length > 0 && !activePreviewImage) {
        setActivePreviewImage(items[0].url);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadGeneratedImages();
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      await queueManager.addJob({
        projectId,
        taskType: 'image',
        prompt,
        negativePrompt,
        params: {
          aspectRatio,
          model: selectedModel,
        },
        onComplete: async (job) => {
          setIsGenerating(false);
          await loadGeneratedImages();
        },
        onError: (err) => {
          setIsGenerating(false);
          alert(`Gagal generate gambar: ${err}`);
        },
      });
    } catch (err: any) {
      setIsGenerating(false);
      alert(`Error: ${err.message}`);
    }
  };

  const toggleCompareImage = (url: string) => {
    setCompareImages((prev) => {
      if (prev.includes(url)) {
        return prev.filter((u) => u !== url);
      }
      if (prev.length >= 2) {
        return [prev[1], url];
      }
      return [...prev, url];
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-pink-400" />
            Image Generator Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Render gambar fotorealistis menggunakan Google Imagen 3 atau Cloudflare FLUX.1 dengan penyimpanan Blob lokal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? 'cyan' : 'outline'}
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
            className="text-xs"
          >
            <Columns className="w-3.5 h-3.5" />
            {compareMode ? 'Mode Banding Aktif' : 'Bandingkan Hasil'}
          </Button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (Lg: 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Pengaturan Generasi Visual
            </h3>

            {/* Model Selector */}
            <Select
              label="Model & Provider AI"
              options={[
                { value: '@cf/black-forest-labs/flux-1-schnell', label: 'FLUX.1 Schnell — Cloudflare GPU (Recommended / Instant)' },
                { value: '@cf/stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base 1.0 — Cloudflare GPU' },
                { value: 'imagen-3.0-generate-002', label: 'Google Imagen 3 (Perlu GCP Vertex Predict Access)' },
              ]}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            />

            {/* Prompt Editor */}
            <Textarea
              label="Visual Prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan gambar dengan detail estetika, pencahayaan, dan kamera..."
            />

            {/* Negative Prompt */}
            <Textarea
              label="Negative Prompt (Hindari)"
              rows={2}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="blurry, distorted, low quality..."
            />

            {/* Aspect Ratio Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-300">Aspek Rasio</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(['16:9', '9:16', '1:1', '4:5', '21:9'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 px-1 text-xs font-mono font-semibold rounded-lg border transition-all ${
                      aspectRatio === ratio
                        ? 'bg-accent-purple text-white border-accent-purple shadow-md'
                        : 'bg-[#0D0E1A] text-gray-400 border-border hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full mt-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Gambar Sekarang
            </Button>
          </div>
        </div>

        {/* Preview & Gallery Column (Lg: 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Stage Preview */}
          <div className="bg-[#0D0E1A] border border-border rounded-2xl overflow-hidden shadow-2xl min-h-[350px] flex items-center justify-center relative group">
            {compareMode && compareImages.length >= 2 ? (
              <div className="grid grid-cols-2 gap-2 w-full h-full p-2">
                <div className="relative rounded-xl overflow-hidden border border-border bg-black">
                  <img src={compareImages[0]} alt="Compare 1" className="w-full h-full object-cover" />
                  <Badge variant="cyan" size="sm" className="absolute top-2 left-2">Hasil A</Badge>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-border bg-black">
                  <img src={compareImages[1]} alt="Compare 2" className="w-full h-full object-cover" />
                  <Badge variant="purple" size="sm" className="absolute top-2 left-2">Hasil B</Badge>
                </div>
              </div>
            ) : activePreviewImage ? (
              <div className="relative w-full h-full bg-black flex items-center justify-center">
                <img
                  src={activePreviewImage}
                  alt="Active preview"
                  className="max-h-[480px] w-auto object-contain mx-auto"
                />
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-600 opacity-40" />
                <p className="text-sm">Belum ada preview visual</p>
              </div>
            )}
          </div>

          {/* Gallery Filmstrip */}
          {generatedImages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400">
                Koleksi Hasil ({generatedImages.length})
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {generatedImages.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => {
                      if (compareMode) {
                        toggleCompareImage(img.url);
                      } else {
                        setActivePreviewImage(img.url);
                      }
                    }}
                    className={`aspect-square rounded-xl overflow-hidden border cursor-pointer transition-all relative group bg-black ${
                      activePreviewImage === img.url || compareImages.includes(img.url)
                        ? 'border-accent-cyan ring-2 ring-accent-cyan/30'
                        : 'border-border hover:border-gray-500'
                    }`}
                  >
                    <img src={img.url} alt="Thumb" className="w-full h-full object-cover" />
                    {compareMode && compareImages.includes(img.url) && (
                      <div className="absolute inset-0 bg-accent-cyan/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-accent-cyan font-bold" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
