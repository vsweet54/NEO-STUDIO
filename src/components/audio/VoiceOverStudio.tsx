import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Play,
  Pause,
  Download,
  Sparkles,
  Save,
  Radio,
  FileAudio,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/Input';
import { queueManager } from '@/lib/queue/generation-queue';
import { getMediaBlobUrl } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';

interface VoiceOverStudioProps {
  projectId?: string;
}

export const VoiceOverStudio: React.FC<VoiceOverStudioProps> = ({ projectId }) => {
  const [text, setText] = useState(
    'Wah, lihat keramaian pasar malam ini! Tapi perjuanganku mencari cilok viral paling lezat harus tetap lanjut.'
  );
  const [voice, setVoice] = useState('thoma');
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlobId, setAudioBlobId] = useState<string | null>(null);

  const voiceOptions = [
    { value: 'thoma', label: 'Thoma (Natural Bahasa Indonesia)' },
    { value: 'luna', label: 'Luna (Warm & Expressive Female)' },
    { value: 'orion', label: 'Orion (Deep Cinematic Narrator)' },
    { value: 'arcas', label: 'Arcas (Youthful Commercial Male)' },
  ];

  const handleGenerateTTS = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);

    try {
      await queueManager.addJob({
        projectId,
        taskType: 'tts',
        prompt: text,
        params: {
          voice,
          speed,
        },
        onComplete: async (job) => {
          setIsGenerating(false);
          if (job.resultBlobId) {
            setAudioBlobId(job.resultBlobId);
            const url = await getMediaBlobUrl(job.resultBlobId);
            setAudioUrl(url);
          } else {
            // Fallback to Web Speech API
            playBrowserSpeech();
          }
        },
        onError: (err) => {
          setIsGenerating(false);
          console.warn('TTS provider failed, falling back to browser synthesis:', err);
          playBrowserSpeech();
        },
      });
    } catch (err: any) {
      setIsGenerating(false);
      playBrowserSpeech();
    }
  };

  const playBrowserSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = speed;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('SpeechSynthesis API tidak didukung pada browser ini.');
    }
  };

  const handleDownload = async () => {
    if (audioBlobId) {
      await downloadMediaBlobFile(audioBlobId, `voiceover_${Date.now()}.mp3`);
    } else {
      alert('File audio belum tersedia untuk diunduh.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Mic className="w-6 h-6 text-emerald-400" />
            Voice Over & Audio Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Sintesis suara narator dan dialog karakter dengan Cloudflare Aura TTS & Web Speech engine.
          </p>
        </div>

        <Badge variant="cyan" size="sm" className="font-mono">
          TTS Engine Ready
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Konfigurasi Vokal & Narasi
            </h3>

            <Select
              label="Pilihan Suara (Voice Timbre)"
              options={voiceOptions}
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            />

            <Textarea
              label="Teks Narasi / Dialog"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ketik teks yang akan diucapkan oleh karakter atau narator..."
            />

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-300">
                <label>Kecepatan Bicara (Speech Rate)</label>
                <span className="font-mono text-accent-cyan">{speed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-accent-purple"
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerateTTS}
              isLoading={isGenerating}
              className="w-full mt-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Voice Over
            </Button>
          </div>
        </div>

        {/* Player & Preview Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0D0E1A] border border-border rounded-2xl p-6 shadow-2xl min-h-[320px] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                  Audio Monitor Output
                </span>
              </div>
              {audioBlobId && (
                <Button variant="cyan" size="sm" onClick={handleDownload} className="text-xs">
                  <Download className="w-3.5 h-3.5" /> Download Audio
                </Button>
              )}
            </div>

            {/* Audio Wave Visualizer Simulation */}
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center gap-1.5 h-16">
                {[40, 65, 30, 85, 95, 55, 75, 45, 90, 60, 80, 50, 70, 35, 60, 90, 45, 65].map(
                  (height, i) => (
                    <div
                      key={i}
                      className={`w-1.5 rounded-full transition-all duration-200 ${
                        isPlaying
                          ? 'bg-gradient-to-t from-accent-purple to-accent-cyan animate-pulse'
                          : 'bg-secondary'
                      }`}
                      style={{ height: isPlaying ? `${height}%` : '20%' }}
                    />
                  )
                )}
              </div>

              <p className="text-xs text-gray-400 font-mono text-center max-w-sm">
                {audioUrl ? 'Audio siap diputar atau dihubungkan ke adegan' : 'Siap melakukan render suara'}
              </p>
            </div>

            {/* Audio Element or Browser Playback Trigger */}
            <div className="pt-4 border-t border-border flex items-center justify-center gap-3">
              {audioUrl ? (
                <audio src={audioUrl} controls className="w-full max-w-md accent-accent-purple" />
              ) : (
                <Button variant="secondary" size="md" onClick={playBrowserSpeech} className="gap-2">
                  <Play className="w-4 h-4 text-accent-cyan" /> Putar Preview Suara
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
