import React, { useState, useEffect } from 'react';
import {
  Film,
  Sparkles,
  RefreshCw,
  Download,
  Copy,
  Check,
  Play,
  Volume2,
  Video,
  Image as ImageIcon,
  Plus,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Clock,
  Camera,
  Sun,
  Edit3,
  Save,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/Input';
import { Project, Episode, Scene, DialogueLine } from '@/types/project';
import { Character } from '@/types/character';
import { getProjectById } from '@/lib/db/projects';
import { getEpisodesByProject } from '@/lib/db/episodes';
import { getScenesByEpisode, saveScene, duplicateScene, deleteScene } from '@/lib/db/scenes';
import { getCharactersByProject } from '@/lib/db/characters';
import { getMediaBlobUrl, saveMediaBlob } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';
import { queueManager } from '@/lib/queue/generation-queue';
import { PromptEngine } from '@/lib/prompts/templates';

interface StoryboardStudioProps {
  projectId: string;
  onOpenWizard: () => void;
  onOpenProjects: () => void;
}

export const StoryboardStudio: React.FC<StoryboardStudioProps> = ({
  projectId,
  onOpenWizard,
  onOpenProjects,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [characters, setCharacters] = useState<Character[]>([]);

  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);

  // Editable fields for current scene
  const [imagePrompt, setImagePrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [cameraAngle, setCameraAngle] = useState('');
  const [cameraMovement, setCameraMovement] = useState('');
  const [lighting, setLighting] = useState('');
  const [sceneDuration, setSceneDuration] = useState(10);

  const [copiedPrompt, setCopiedPrompt] = useState<'image' | 'video' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [ttsPlayingLineId, setTtsPlayingLineId] = useState<string | null>(null);

  // Load project details and scenes
  useEffect(() => {
    async function loadProjectData() {
      if (!projectId) return;
      try {
        const proj = await getProjectById(projectId);
        if (!proj) return;
        setProject(proj);

        const [epList, charList] = await Promise.all([
          getEpisodesByProject(projectId),
          getCharactersByProject(projectId),
        ]);

        setEpisodes(epList);
        setCharacters(charList);

        if (epList.length > 0) {
          const firstEp = epList[0];
          setSelectedEpisodeId(firstEp.id);
          const scList = await getScenesByEpisode(firstEp.id);
          setScenes(scList);
          if (scList.length > 0) {
            setSelectedSceneId(scList[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading storyboard studio:', err);
      }
    }

    loadProjectData();
  }, [projectId]);

  // Sync active scene when selectedSceneId changes
  useEffect(() => {
    async function syncScene() {
      const found = scenes.find((s) => s.id === selectedSceneId);
      if (found) {
        setActiveScene(found);
        setImagePrompt(found.imagePrompt || '');
        setVideoPrompt(found.videoPrompt || '');
        setDialogueLines(found.dialogue || []);
        setCameraAngle(found.cameraAngle || 'Eye-level');
        setCameraMovement(found.cameraMovement || 'Slow push-in');
        setLighting(found.lighting || 'Cinematic Lighting');
        setSceneDuration(found.duration || 10);

        if (found.generatedImageBlobId) {
          const url = await getMediaBlobUrl(found.generatedImageBlobId);
          setSceneImageUrl(url);
        } else {
          setSceneImageUrl(null);
        }
      }
    }

    syncScene();
  }, [selectedSceneId, scenes]);

  const handleSaveScene = async () => {
    if (!activeScene) return;
    setIsSaving(true);
    try {
      const updated: Scene = {
        ...activeScene,
        imagePrompt,
        videoPrompt,
        dialogue: dialogueLines,
        cameraAngle,
        cameraMovement,
        lighting,
        duration: sceneDuration,
        updatedAt: Date.now(),
      };

      await saveScene(updated);
      setActiveScene(updated);
      setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      setSaveNotice('Perubahan adegan berhasil disimpan!');
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrompt = (type: 'image' | 'video', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(type);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const handleGenerateImage = async () => {
    if (!activeScene || !imagePrompt) return;

    try {
      await queueManager.addJob({
        projectId: activeScene.projectId,
        sceneId: activeScene.id,
        taskType: 'image',
        prompt: imagePrompt,
        params: {
          aspectRatio: activeScene.aspectRatio || '16:9',
        },
        onComplete: async (job) => {
          if (job.resultBlobId) {
            const updatedScene: Scene = {
              ...activeScene,
              generatedImageBlobId: job.resultBlobId,
              generationStatus: 'completed',
              updatedAt: Date.now(),
            };
            await saveScene(updatedScene);
            setActiveScene(updatedScene);
            setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));

            const url = await getMediaBlobUrl(job.resultBlobId);
            setSceneImageUrl(url);
          }
        },
        onError: (err) => {
          alert(`Gagal generate gambar adegan: ${err}`);
        },
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleGenerateVideo = async () => {
    if (!activeScene || !videoPrompt) return;

    let firstFrameBase64: string | undefined = undefined;
    // If scene already has generated image, we can condition first frame
    if (sceneImageUrl && sceneImageUrl.startsWith('data:image')) {
      firstFrameBase64 = sceneImageUrl.split(',')[1];
    }

    try {
      await queueManager.addJob({
        projectId: activeScene.projectId,
        sceneId: activeScene.id,
        taskType: 'video',
        prompt: videoPrompt,
        params: {
          durationSeconds: sceneDuration,
          aspectRatio: activeScene.aspectRatio || '16:9',
          firstFrameBase64,
          cameraMovement,
        },
        onComplete: async (job) => {
          const updatedScene: Scene = {
            ...activeScene,
            generatedVideoBlobId: job.resultBlobId,
            generationStatus: 'completed',
            updatedAt: Date.now(),
          };
          await saveScene(updatedScene);
          setActiveScene(updatedScene);
          setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));
        },
        onError: (err) => {
          alert(`Gagal generate video adegan: ${err}`);
        },
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDownloadImage = async () => {
    if (!activeScene?.generatedImageBlobId) return;
    try {
      await downloadMediaBlobFile(
        activeScene.generatedImageBlobId,
        `storyboard_${project?.title || 'scene'}_adegan_${activeScene.sceneNumber}.png`
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePlayTtsLine = (line: DialogueLine) => {
    if (!line.text) return;
    setTtsPlayingLineId(line.id);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
      utterance.onend = () => setTtsPlayingLineId(null);
      utterance.onerror = () => setTtsPlayingLineId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTtsPlayingLineId(null);
      alert('SpeechSynthesis API tidak didukung pada browser ini.');
    }
  };

  const handleRegenerateDialogue = async () => {
    if (!activeScene) return;

    const charListPrompt = characters.map((c) => `${c.name} (${c.role}): ${c.personality}`).join('\n');
    const prompt = `Tulis ulang dialog bahasa Indonesia yang sangat natural, ekspresif, dan sinematik untuk adegan ini:
Judul Adegan: ${activeScene.title}
Deskripsi: ${activeScene.description}
Karakter yang terlibat:\n${charListPrompt}

Format output JSON array:
[
  { "characterName": "RIRIN", "emotionTag": "[bersemangat]", "text": "Kalimat dialog..." }
]`;

    try {
      await queueManager.addJob({
        projectId: activeScene.projectId,
        sceneId: activeScene.id,
        taskType: 'dialogue',
        prompt,
        params: { jsonMode: true },
        onComplete: async (job) => {
          try {
            const parsed = JSON.parse(
              job.resultText?.replace(/```json/g, '').replace(/```/g, '').trim() || '[]'
            );
            if (Array.isArray(parsed) && parsed.length > 0) {
              const newLines: DialogueLine[] = parsed.map((item, idx) => ({
                id: `d_${idx}_${Date.now()}`,
                characterName: item.characterName || 'NARRATOR',
                emotionTag: item.emotionTag || '[bicara]',
                text: item.text || '',
              }));
              setDialogueLines(newLines);
              const updatedScene = { ...activeScene, dialogue: newLines };
              await saveScene(updatedScene);
              setActiveScene(updatedScene);
            }
          } catch (e) {
            console.error('Parse dialogue error:', e);
          }
        },
      });
    } catch (err: any) {
      alert(`Gagal generate dialog: ${err.message}`);
    }
  };

  if (!project) {
    return (
      <div className="py-20 text-center space-y-4">
        <Film className="w-12 h-12 mx-auto text-gray-600" />
        <h3 className="text-base font-semibold text-gray-300">Pilih atau Buat Proyek Storyboard</h3>
        <div className="flex justify-center gap-3">
          <Button variant="primary" onClick={onOpenWizard}>
            <Plus className="w-4 h-4" /> Buat Proyek Baru
          </Button>
          <Button variant="secondary" onClick={onOpenProjects}>
            Daftar Proyek
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      {/* Top Scene Bar (Identical in aesthetic to SUTRADARA AI Screenshot) */}
      <div className="bg-[#101222] border border-border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Adegan Number Block */}
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-purple to-purple-900 border border-purple-500/40 flex flex-col items-center justify-center text-white shrink-0 shadow-lg shadow-purple-950/60">
            <span className="text-2xl font-black font-mono leading-none">
              {activeScene ? activeScene.sceneNumber : '1'}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-200 mt-0.5">
              ADEGAN
            </span>
          </div>

          {/* Scene Title & Meta */}
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">
                {activeScene ? activeScene.title : 'Pilih Adegan'}
              </h2>
              {activeScene?.generatedImageBlobId && (
                <Badge variant="success" size="sm" className="font-mono text-[10px]">
                  <Check className="w-3 h-3" /> Generated
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-400 mt-1 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                {sceneDuration}s
              </span>
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-accent-purple" />
                {activeScene?.shotsCount || 3} Shot
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-300 truncate max-w-[200px]">
                {activeScene?.transition || 'End of episode'}
              </span>
            </div>
          </div>
        </div>

        {/* Scene Navigation Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {scenes.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setSelectedSceneId(sc.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono whitespace-nowrap transition-all border ${
                sc.id === selectedSceneId
                  ? 'bg-accent-purple text-white border-accent-purple shadow-md shadow-purple-950/50'
                  : 'bg-secondary/70 text-gray-400 border-border hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              #{sc.sceneNumber} {sc.title.slice(0, 12)}
            </button>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (activeScene) {
                const dup = await duplicateScene(activeScene.id);
                const updatedList = await getScenesByEpisode(activeScene.episodeId);
                setScenes(updatedList);
                setSelectedSceneId(dup.id);
              }
            }}
            title="Duplikasi Adegan Ini"
            className="p-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium animate-in fade-in">
          {saveNotice}
        </div>
      )}

      {/* Main Studio Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Storyboard Visual Frame (Lg: 7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Storyboard Multi-panel Image Container */}
          <div className="bg-[#0D0E1A] border border-border rounded-2xl overflow-hidden shadow-2xl">
            {sceneImageUrl ? (
              <div className="relative group bg-black">
                <img
                  src={sceneImageUrl}
                  alt={`Storyboard Adegan ${activeScene?.sceneNumber}`}
                  className="w-full h-auto object-cover max-h-[500px]"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button variant="cyan" size="sm" onClick={handleDownloadImage}>
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-20 px-6 text-center space-y-4 bg-gradient-to-b from-[#111322] to-[#0A0B14]">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary/80 border border-border flex items-center justify-center">
                  <Film className="w-8 h-8 text-gray-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">
                    Storyboard Gambar Belum Di-generate
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Klik tombol "Generate Ulang" atau gunakan tombol pada kartu Image Prompt di bawah untuk merender visual adegan.
                  </p>
                </div>
              </div>
            )}

            {/* Action Bar Below Image (Matching screenshot buttons) */}
            <div className="p-3 sm:p-4 bg-[#111321] border-t border-border flex flex-wrap items-center justify-between gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const target = document.getElementById('image-prompt-section');
                  target?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-accent-purple" />
                Edit Gambar Adegan
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateImage}
                  className="text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Generate Ulang
                </Button>

                {sceneImageUrl && (
                  <Button
                    variant="cyan"
                    size="sm"
                    onClick={handleDownloadImage}
                    className="text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Gambar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* DIALOG SCENE Card (Matching screenshot) */}
          <div className="bg-[#111321] border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent-cyan" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                  DIALOG SCENE
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateDialogue}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveScene}
                  className="h-7 text-xs bg-emerald-950/60 hover:bg-emerald-900 border-emerald-800 text-emerald-300"
                >
                  <Save className="w-3 h-3" /> Simpan Dialog
                </Button>
              </div>
            </div>

            {/* Dialogue Lines Display / Editor */}
            <div className="space-y-2.5 bg-[#0A0B14] p-3.5 rounded-xl border border-border/80">
              {dialogueLines.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Tidak ada dialog pada adegan ini.</p>
              ) : (
                dialogueLines.map((line, idx) => (
                  <div key={line.id || idx} className="flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5 leading-relaxed">
                      <span className="text-red-400 font-bold uppercase mr-1">
                        {line.emotionTag || '[bicara]'}
                      </span>
                      <span className="font-bold text-gray-100">{line.characterName}: </span>
                      <span className="text-gray-300">"{line.text}"</span>
                    </div>

                    <button
                      onClick={() => handlePlayTtsLine(line)}
                      disabled={ttsPlayingLineId === line.id}
                      className="p-1 rounded text-gray-400 hover:text-accent-cyan transition-colors shrink-0"
                      title="Dengarkan Suara Dialog"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${ttsPlayingLineId === line.id ? 'text-accent-cyan animate-pulse' : ''}`} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <p className="text-[11px] text-emerald-400 font-mono">
              Dialog sudah dibuat dan prompt video siap digunakan.
            </p>
          </div>
        </div>

        {/* Right Column: Prompts, Controls & Directions (Lg: 5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* IMAGE PROMPT Card (Matching screenshot) */}
          <div
            id="image-prompt-section"
            className="bg-[#111321] border border-border rounded-2xl p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent-purple" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                  IMAGE PROMPT
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyPrompt('image', imagePrompt)}
                className="h-7 text-xs"
              >
                {copiedPrompt === 'image' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" /> Disalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </Button>
            </div>

            <Textarea
              rows={6}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              className="text-xs font-mono bg-[#0A0B14] leading-relaxed"
              placeholder="STORYBOARD GRID LOCK - MANDATORY..."
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={handleGenerateImage} className="w-full text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                Generate Gambar AI
              </Button>
            </div>
          </div>

          {/* VIDEO PROMPT Card (Matching screenshot) */}
          <div className="bg-[#111321] border border-border rounded-2xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-accent-cyan" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                  VIDEO PROMPT
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyPrompt('video', videoPrompt)}
                className="h-7 text-xs"
              >
                {copiedPrompt === 'video' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" /> Disalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </Button>
            </div>

            <Textarea
              rows={6}
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              className="text-xs font-mono bg-[#0A0B14] leading-relaxed"
              placeholder="[VIDEO FRAME ZERO CONTRACT - ABSOLUTE, NON-NEGOTIABLE]..."
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="cyan" size="sm" onClick={handleGenerateVideo} className="w-full text-xs">
                <Video className="w-3.5 h-3.5" />
                Generate Video AI
              </Button>
            </div>
          </div>

          {/* Camera, Lighting & Scene Controls */}
          <div className="bg-[#111321] border border-border rounded-2xl p-5 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Camera & Lighting Direction
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Input
                label="Camera Angle"
                value={cameraAngle}
                onChange={(e) => setCameraAngle(e.target.value)}
                placeholder="misal: Low-Angle Closeup"
              />
              <Input
                label="Camera Movement"
                value={cameraMovement}
                onChange={(e) => setCameraMovement(e.target.value)}
                placeholder="misal: Slow Push-In Dolly"
              />
            </div>

            <Input
              label="Lighting Setup"
              value={lighting}
              onChange={(e) => setLighting(e.target.value)}
              placeholder="misal: Golden hour volumetric, neon rim"
            />

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={handleSaveScene} isLoading={isSaving} className="text-xs">
                <Save className="w-3.5 h-3.5" />
                Simpan Konfigurasi Adegan
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
