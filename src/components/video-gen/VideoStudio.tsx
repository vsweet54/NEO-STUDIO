import React, { useState } from 'react';
import {
  Video,
  Sparkles,
  Play,
  Pause,
  Download,
  AlertCircle,
  Clock,
  Camera,
  Film,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/Input';
import { queueManager } from '@/lib/queue/generation-queue';
import { AspectRatio } from '@/types/project';

interface VideoStudioProps {
  projectId?: string;
}

export const VideoStudio: React.FC<VideoStudioProps> = ({ projectId }) => {
  const [prompt, setPrompt] = useState(
    '[VIDEO FRAME ZERO CONTRACT - ABSOLUTE, NON-NEGOTIABLE] Cinematic tracking shot through bustling night market, steady camera following character, warm ambient steam, cinematic 24fps motion blur, high dynamic range.'
  );
  const [cameraMovement, setCameraMovement] = useState('Steady Tracking Shot / Dolly In');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedModel, setSelectedModel] = useState('veo-2.0-generate-001');

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Mengirim request video generation ke Google Veo API...');

    try {
      await queueManager.addJob({
        projectId,
        taskType: 'video',
        prompt,
        params: {
          durationSeconds: duration,
          aspectRatio,
          cameraMovement,
          model: selectedModel,
        },
        onComplete: (job) => {
          setIsGenerating(false);
          if (job.resultUrl) {
            setVideoUrl(job.resultUrl);
            setStatusMessage('Video AI berhasil di-generate!');
          } else {
            setStatusMessage('Job selesai.');
          }
        },
        onError: (err) => {
          setIsGenerating(false);
          setStatusMessage(null);
          alert(`Video Generation: ${err}`);
        },
      });
    } catch (err: any) {
      setIsGenerating(false);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-amber-400" />
            Video Generator Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Produksi video AI beresolusi tinggi menggunakan model sinematik Google Veo 2 / Video Provider.
          </p>
        </div>

        <Badge variant="cyan" size="sm" className="font-mono">
          Google Veo 2 API Ready
        </Badge>
      </div>

      {/* Info notice about genuine AI video */}
      <div className="p-3.5 bg-secondary/60 border border-border rounded-xl text-xs text-gray-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
        <p>
          NEO STUDIO AI menggunakan API Video Provider sungguhan (Google Veo). Jika API key Google Anda belum memiliki whitelist akses Veo, sistem akan melaporkan status izin secara transparan tanpa animasi simulasi palsu.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Parameter Video Sinematik
            </h3>

            <Select
              label="Model Video AI"
              options={[
                { value: 'veo-2.0-generate-001', label: 'Google Veo 2 (Cinematic 1080p/4K)' },
              ]}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            />

            <Textarea
              label="Video Motion Prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan pergerakan kamera, subjek, dan fisika visual..."
            />

            <Input
              label="Pergerakan Kamera (Camera Movement)"
              value={cameraMovement}
              onChange={(e) => setCameraMovement(e.target.value)}
              placeholder="Tracking shot, slow dolly in, crane up, pan right"
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Durasi Video"
                options={[
                  { value: '5', label: '5 Detik' },
                  { value: '8', label: '8 Detik' },
                  { value: '10', label: '10 Detik' },
                ]}
                value={duration.toString()}
                onChange={(e) => setDuration(parseInt(e.target.value))}
              />

              <Select
                label="Aspek Rasio"
                options={[
                  { value: '16:9', label: '16:9 (Landscape)' },
                  { value: '9:16', label: '9:16 (Vertical)' },
                ]}
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
              />
            </div>

            <Button
              variant="cyan"
              size="lg"
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full mt-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Video AI
            </Button>
          </div>
        </div>

        {/* Video Player / Monitor Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0D0E1A] border border-border rounded-2xl overflow-hidden shadow-2xl min-h-[380px] flex items-center justify-center relative">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full h-auto max-h-[480px] object-contain bg-black"
              />
            ) : isGenerating ? (
              <div className="text-center p-8 space-y-3">
                <RefreshCw className="w-10 h-10 mx-auto text-accent-cyan animate-spin" />
                <p className="text-sm font-semibold text-gray-200">Merender Video Frame demi Frame...</p>
                <p className="text-xs text-gray-400 font-mono">{statusMessage}</p>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500 space-y-2">
                <Film className="w-12 h-12 mx-auto text-gray-600 opacity-40" />
                <p className="text-sm font-medium">Layar Monitor Video Kosong</p>
                <p className="text-xs text-gray-400">
                  Hasil render video AI akan ditampilkan di monitor ini dan dapat diunduh ke format MP4.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
