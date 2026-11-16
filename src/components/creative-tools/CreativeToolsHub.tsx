import React, { useState } from 'react';
import {
  Wand2,
  Camera,
  Image as ImageIcon,
  BarChart3,
  Smartphone,
  ShoppingBag,
  Users,
  Box,
  Film,
  Share2,
  Clapperboard,
  Sparkles,
  Download,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/Input';
import { PromptEngine } from '@/lib/prompts/templates';
import { queueManager } from '@/lib/queue/generation-queue';
import { getMediaBlobUrl } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';
import { AspectRatio } from '@/types/project';
import { CreativeToolId } from '@/types/creative-tools';

interface ToolMeta {
  id: CreativeToolId;
  name: string;
  category: string;
  description: string;
  icon: any;
  defaultAspect: AspectRatio;
  defaultPrompt: string;
  styles: { label: string; modifier: string }[];
}

const TOOLS_CATALOG: ToolMeta[] = [
  {
    id: 'thumbnail',
    name: 'Thumbnail Generator',
    category: 'Video Production',
    description: 'High-CTR YouTube & TikTok thumbnails dengan focal subject ekspresif dan ruang teks.',
    icon: ImageIcon,
    defaultAspect: '16:9',
    defaultPrompt: 'Shocked reaction expression, holding golden glowing burger, blurred neon restaurant background',
    styles: [
      { label: 'YouTube Viral High-Contrast', modifier: 'Hyper-vibrant, 3D rim light, dramatic expressions, 8k' },
      { label: 'TikTok Clean Minimal', modifier: 'Clean editorial lighting, bold subject, modern minimal' },
      { label: 'Gaming Cyberpunk Neon', modifier: 'Neon violet and cyan highlights, particle effects' },
    ],
  },
  {
    id: 'photo',
    name: 'Photo Generator',
    category: 'Photography',
    description: 'Fotografi studio dan potret profesional berkualitas tinggi dengan lensa prime.',
    icon: Camera,
    defaultAspect: '1:1',
    defaultPrompt: 'Studio portrait of an Indonesian fashion model, elegant black silk attire, soft golden hour rim light',
    styles: [
      { label: 'Studio Editorial 85mm', modifier: '85mm f/1.4 lens, shallow depth of field, natural skin texture' },
      { label: 'Outdoor Natural Light', modifier: 'Golden hour sunlight, gentle bokeh, warm tones' },
      { label: 'High Fashion Monochrome', modifier: 'Black and white, high contrast chiaroscuro, sharp focus' },
    ],
  },
  {
    id: 'infographic',
    name: 'Infographic Generator',
    category: 'Information & Marketing',
    description: 'Visual data, diagram, dan panduan langkah-demi-langkah dengan gaya Swiss modern.',
    icon: BarChart3,
    defaultAspect: '9:16',
    defaultPrompt: '5 Steps to launch a successful online culinary business, modern vector iconography, clean hierarchy',
    styles: [
      { label: 'Modern Swiss Minimal', modifier: 'Clean geometric layout, bold high contrast, flat color scheme' },
      { label: 'Isometric 3D Infographic', modifier: 'Isometric 3D clay render, vibrant color accents, clean diagrams' },
    ],
  },
  {
    id: 'ugc',
    name: 'UGC Content Generator',
    category: 'Social Media',
    description: 'Foto otentik gaya pengguna kasual dengan kamera smartphone untuk iklan conversion tinggi.',
    icon: Smartphone,
    defaultAspect: '9:16',
    defaultPrompt: 'Young customer smiling taking selfie while showing tasty street food box, authentic daylight',
    styles: [
      { label: 'iPhone Raw Photo Look', modifier: 'Handheld smartphone camera angle, authentic slight motion blur' },
      { label: 'POV Unboxing', modifier: 'First-person perspective hands opening delivery package, natural room light' },
    ],
  },
  {
    id: 'product-ad',
    name: 'Product Advertisement',
    category: 'Commercial',
    description: 'Foto komersial staging mewah dengan pencahayaan softbox dan refleksi tajam.',
    icon: ShoppingBag,
    defaultAspect: '1:1',
    defaultPrompt: 'Luxury skincare serum bottle on wet stone pedestal, water splash, floating green botanical leaves',
    styles: [
      { label: 'Commercial Hero Lighting', modifier: 'Commercial studio softbox reflections, crisp caustic water highlights' },
      { label: 'Dark Moody Luxury', modifier: 'Matte black stone background, dramatic edge rim light' },
    ],
  },
  {
    id: 'character-sheet',
    name: 'Character Sheet',
    category: 'Pre-Production',
    description: 'Model sheet karakter tampak depan, 3/4, dan samping untuk menjaga konsistensi visual.',
    icon: Users,
    defaultAspect: '16:9',
    defaultPrompt: 'Indonesian culinary girl character, front view, 3/4 angle, side profile, denim jacket, casual jeans',
    styles: [
      { label: 'Concept Model Sheet', modifier: 'Neutral grey studio background, turnaround view, detailed proportions' },
      { label: 'Anime Model Sheet', modifier: 'Japanese animation production model sheet, crisp line art, color flats' },
    ],
  },
  {
    id: 'product-sheet',
    name: 'Product Sheet',
    category: 'Commercial',
    description: 'Sheet detail produk dengan berbagai sudut dan rincian material.',
    icon: Box,
    defaultAspect: '16:9',
    defaultPrompt: 'Premium artisan ceramic coffee mug, exploded view, material texture close-up, handle detail',
    styles: [
      { label: 'Industrial Design Sheet', modifier: 'CAD layout style, orthographic views, studio neutral background' },
    ],
  },
  {
    id: 'poster',
    name: 'Poster Generator',
    category: 'Key Visual',
    description: 'Poster film teatrikal dan poster acara promosi dengan komposisi dramatis.',
    icon: Film,
    defaultAspect: '9:16',
    defaultPrompt: 'Theatrical film poster of twilight mystery in ancient Indonesian forest, silhouette of adventurer',
    styles: [
      { label: 'Blockbuster Cinematic', modifier: 'IMAX quality, anamorphic flare, intense atmospheric fog, film grain' },
      { label: 'Retro Indie Festival', modifier: 'Screenprint texture, vintage 70s typography layout space, bold palette' },
    ],
  },
  {
    id: 'social-media',
    name: 'Social Media Content',
    category: 'Social Media',
    description: 'Desain feed dan story Instagram/Reels yang siap menarik perhatian audiens.',
    icon: Share2,
    defaultAspect: '4:5',
    defaultPrompt: 'Weekend special promo banner for artisan bakery, freshly baked sourdough on rustic wooden table',
    styles: [
      { label: 'Instagram Aesthetic', modifier: 'Warm beige tones, clean negative space for captions, soft natural light' },
    ],
  },
  {
    id: 'cinematic',
    name: 'Cinematic Image Generator',
    category: 'Cinematography',
    description: 'Visual bergaya film layar lebar Arri Alexa dengan lensa anamorphic Panavision.',
    icon: Clapperboard,
    defaultAspect: '2.39:1',
    defaultPrompt: 'Night city pursuit through rain-slicked neon street, wet pavement reflections, silhouette in rain',
    styles: [
      { label: 'Panavision Anamorphic', modifier: 'Arri Alexa 65, Panavision C-Series anamorphic lens flare, Kodak 5219 grain' },
      { label: 'Moody Noir Chiaroscuro', modifier: 'Hard light contrasts, deep shadows, volumetric smoke' },
    ],
  },
];

interface CreativeToolsHubProps {
  projectId?: string;
  initialToolId?: string;
}

export const CreativeToolsHub: React.FC<CreativeToolsHubProps> = ({
  projectId,
  initialToolId = 'thumbnail',
}) => {
  const [activeToolId, setActiveToolId] = useState<CreativeToolId>(
    (initialToolId as CreativeToolId) || 'thumbnail'
  );

  const currentTool = TOOLS_CATALOG.find((t) => t.id === activeToolId) || TOOLS_CATALOG[0];

  const [prompt, setPrompt] = useState(currentTool.defaultPrompt);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(currentTool.defaultAspect);
  const [selectedModel, setSelectedModel] = useState('@cf/black-forest-labs/flux-1-schnell');
  const [isGenerating, setIsGenerating] = useState(false);

  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultBlobId, setResultBlobId] = useState<string | null>(null);

  // Switch tool and update defaults
  const handleSelectTool = (tool: ToolMeta) => {
    setActiveToolId(tool.id);
    setPrompt(tool.defaultPrompt);
    setSelectedStyleIndex(0);
    setAspectRatio(tool.defaultAspect);
    setResultImageUrl(null);
    setResultBlobId(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    const styleModifier = currentTool.styles[selectedStyleIndex]?.modifier || '';
    const fullPrompt = PromptEngine.buildCreativeToolPrompt({
      toolId: currentTool.id,
      basePrompt: prompt,
      styleModifier,
      aspectRatio,
    });

    try {
      await queueManager.addJob({
        projectId,
        taskType: 'image',
        prompt: fullPrompt,
        params: {
          aspectRatio,
          model: selectedModel,
        },
        onComplete: async (job) => {
          setIsGenerating(false);
          if (job.resultBlobId) {
            setResultBlobId(job.resultBlobId);
            const url = await getMediaBlobUrl(job.resultBlobId);
            setResultImageUrl(url);
          }
        },
        onError: (err) => {
          setIsGenerating(false);
          alert(`Gagal generate asset: ${err}`);
        },
      });
    } catch (err: any) {
      setIsGenerating(false);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDownload = async () => {
    if (resultBlobId) {
      await downloadMediaBlobFile(resultBlobId, `${currentTool.id}_${Date.now()}.png`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-accent-purple" />
            Creative Tools Studio (10 Tools)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Rangkaian alat produksi konten visual profesional terintegrasi dengan template dan preset AI.
          </p>
        </div>
      </div>

      {/* Tool Selector Horizontal Scroll Rail */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/80">
        {TOOLS_CATALOG.map((tool) => {
          const isActive = tool.id === activeToolId;
          const IconComponent = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => handleSelectTool(tool)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                isActive
                  ? 'bg-accent-purple text-white border-accent-purple shadow-md shadow-purple-950/40'
                  : 'bg-surface hover:bg-surface-light text-gray-400 border-border hover:text-gray-200'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5" />
              <span>{tool.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Generator Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-white">{currentTool.name}</h3>
                <p className="text-[11px] text-gray-400">{currentTool.description}</p>
              </div>
            </div>

            {/* Model Selector */}
            <Select
              label="Model Generator"
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
              label="Deskripsi Konten / Subjek"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan ide visual..."
            />

            {/* Style Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-300">Preset Gaya Visual</label>
              <div className="grid grid-cols-1 gap-1.5">
                {currentTool.styles.map((style, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedStyleIndex(idx)}
                    className={`p-2 rounded-lg text-left text-xs transition-all border ${
                      selectedStyleIndex === idx
                        ? 'bg-accent-purple/20 border-accent-purple text-accent-purple-light font-medium'
                        : 'bg-[#0D0E1A] border-border text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="font-semibold">{style.label}</div>
                    <div className="text-[10px] text-gray-400 truncate mt-0.5">{style.modifier}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-300">Aspek Rasio</label>
              <div className="grid grid-cols-4 gap-2">
                {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAspectRatio(r)}
                    className={`py-1.5 px-2 text-xs font-mono font-semibold rounded-lg border transition-all text-center ${
                      aspectRatio === r
                        ? 'bg-accent-cyan text-black font-bold border-accent-cyan'
                        : 'bg-[#0D0E1A] text-gray-400 border-border'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full mt-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate {currentTool.name}
            </Button>
          </div>
        </div>

        {/* Right Column: Result Output */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0D0E1A] border border-border rounded-2xl overflow-hidden shadow-2xl min-h-[420px] flex items-center justify-center relative group">
            {resultImageUrl ? (
              <div className="relative w-full h-full bg-black flex items-center justify-center">
                <img
                  src={resultImageUrl}
                  alt={currentTool.name}
                  className="max-h-[500px] w-auto object-contain mx-auto"
                />
              </div>
            ) : isGenerating ? (
              <div className="text-center p-8 space-y-3">
                <RefreshCw className="w-10 h-10 mx-auto text-accent-purple animate-spin" />
                <p className="text-sm font-semibold text-gray-200">Menghasilkan asset kreatif...</p>
                <p className="text-xs text-gray-400">Model sedang merender komposisi pencahayaan dan framing.</p>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500 space-y-2">
                <currentTool.icon className="w-12 h-12 mx-auto text-gray-600 opacity-40" />
                <p className="text-sm font-medium">Output Belum Tersedia</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Atur deskripsi subjek dan klik tombol generate untuk melihat karya Anda di sini.
                </p>
              </div>
            )}
          </div>

          {resultImageUrl && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="cyan" size="sm" onClick={handleDownload} className="text-xs">
                <Download className="w-3.5 h-3.5" /> Download Gambar
              </Button>
              <Button variant="secondary" size="sm" onClick={handleGenerate} className="text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Generate Ulang
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
