import React, { useState, useEffect } from 'react';
import {
  Film,
  Sparkles,
  RefreshCw,
  Download,
  Copy,
  Check,
  Volume2,
  Video,
  Image as ImageIcon,
  Plus,
  Trash2,
  Clock,
  Camera,
  Edit3,
  Save,
  MessageSquare,
  Clapperboard,
  ArrowRight,
  Eye,
  Move,
  Layers,
  AlertCircle,
  Lock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea, Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Project, Episode, Scene, DialogueLine, Shot } from '@/types/project';
import { Character } from '@/types/character';
import { getProjectById } from '@/lib/db/projects';
import { getEpisodesByProject, saveEpisode } from '@/lib/db/episodes';
import { getScenesByEpisode, saveScene, duplicateScene, deleteScene } from '@/lib/db/scenes';
import { getCharactersByProject } from '@/lib/db/characters';
import { getMediaBlobUrl } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';
import { queueManager } from '@/lib/queue/generation-queue';
import { enrichPromptWithCharacterDNA } from '@/lib/prompts/character-anchor';

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

  // Shot-specific states
  const [shotImageUrls, setShotImageUrls] = useState<Record<string, string>>({});
  const [selectedEditingShot, setSelectedEditingShot] = useState<Shot | null>(null);
  const [isEditingShotModalOpen, setIsEditingShotModalOpen] = useState(false);
  const [copiedShotPrompt, setCopiedShotPrompt] = useState<{ id: string; type: 'image' | 'video' } | null>(null);
  const [generatingShotIds, setGeneratingShotIds] = useState<Record<string, boolean>>({});

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
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isAutoRenderingEpisode, setIsAutoRenderingEpisode] = useState(false);
  const [autoRenderProgress, setAutoRenderProgress] = useState<{
    current: number;
    total: number;
    currentSceneTitle: string;
  } | null>(null);

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

  const handleSelectEpisode = async (epId: string) => {
    setSelectedEpisodeId(epId);
    const scList = await getScenesByEpisode(epId);
    setScenes(scList);
    if (scList.length > 0) {
      setSelectedSceneId(scList[0].id);
    } else {
      setSelectedSceneId('');
      setActiveScene(null);
    }
  };

  const handleAddNewEpisode = async () => {
    if (!project) return;
    const newEpNum = episodes.length + 1;
    const epId = 'ep_' + Math.random().toString(36).substring(2, 9) + Date.now();
    const newEp: Episode = {
      id: epId,
      projectId: project.id,
      episodeNumber: newEpNum,
      title: `Episode ${newEpNum}`,
      synopsis: `Sinopsis Episode ${newEpNum}`,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveEpisode(newEp);
    const updatedEps = await getEpisodesByProject(project.id);
    setEpisodes(updatedEps);

    // Create initial scene for new episode
    const newScene: Scene = {
      id: 'sc_' + Math.random().toString(36).substring(2, 9) + Date.now(),
      projectId: project.id,
      episodeId: epId,
      sceneNumber: 1,
      title: 'Adegan Pembuka',
      description: `Adegan pembuka episode ${newEpNum}`,
      characterIds: characters.map((c) => c.id).slice(0, 2),
      dialogue: [],
      imagePrompt: `Cinematic 35mm film opening scene for Episode ${newEpNum}, photorealistic 8k`,
      videoPrompt: '[VIDEO MOTION] Smooth opening camera motion',
      cameraAngle: 'Wide Establishing Shot',
      cameraMovement: 'Slow Cinematic Push-in',
      lighting: 'Dramatic Atmospheric Lighting',
      environment: 'Cinematic Setting',
      duration: 10,
      aspectRatio: project.aspectRatio || '16:9',
      shotsCount: 3,
      transition: 'Cut to next scene',
      referenceImageBlobIds: [],
      generationStatus: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveScene(newScene);

    await handleSelectEpisode(epId);
    setSaveNotice(`Episode ${newEpNum} berhasil dibuat!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Sync active scene when selectedSceneId changes
  useEffect(() => {
    async function syncScene() {
      const found = scenes.find((s) => s.id === selectedSceneId);
      if (found) {
        // If scene has no shots yet, synthesize initial shots so the user always has a multi-shot director breakdown
        let currentShots = found.shots;
        if (!currentShots || currentShots.length === 0) {
          const count = found.shotsCount || 3;
          const totalDur = found.duration || 10;
          const shotDur = Math.round((totalDur / count) * 10) / 10;

          currentShots = Array.from({ length: count }, (_, idx) => {
            const start = Math.round(idx * shotDur * 10) / 10;
            const end = idx === count - 1 ? totalDur : Math.round((start + shotDur) * 10) / 10;
            return {
              id: `shot_${found.id}_${idx + 1}_${Date.now()}`,
              shotNumber: idx + 1,
              startTime: start,
              endTime: end,
              duration: Math.round((end - start) * 10) / 10,
              description: `Shot ${idx + 1}: Kronologi kejadian dalam adegan "${found.title}"`,
              characterAction: `Aksi karakter shot ${idx + 1}`,
              facialExpression: 'Ekspresif dan terfokus',
              bodyMovement: 'Gerakan tubuh alami',
              cameraAngle: found.cameraAngle || 'Eye-level Medium Shot',
              cameraMovement: found.cameraMovement || 'Slow cinematic push-in',
              dialogue: found.dialogue?.[idx]
                ? `[${found.dialogue[idx].emotionTag || 'bicara'}] ${found.dialogue[idx].characterName}: "${found.dialogue[idx].text}"`
                : '',
              imagePrompt: `${found.imagePrompt || ''}, shot ${idx + 1} specific event, cinematic framing, 8k resolution`,
              videoPrompt: `${found.videoPrompt || ''}, smooth motion 24fps for shot ${idx + 1}`,
              transition: idx === count - 1 ? (found.transition || 'Cut to next scene') : 'Cut to next shot',
              status: 'idle' as const,
            };
          });

          found.shots = currentShots;
          await saveScene(found);
        }

        setActiveScene({ ...found, shots: currentShots });
        setImagePrompt(found.imagePrompt || '');
        setVideoPrompt(found.videoPrompt || '');
        setDialogueLines(found.dialogue || []);
        setCameraAngle(found.cameraAngle || 'Eye-level');
        setCameraMovement(found.cameraMovement || 'Slow push-in');
        setLighting(found.lighting || 'Cinematic Lighting');
        setSceneDuration(found.duration || 10);

        // Load scene overview image
        if (found.generatedImageBlobId) {
          const url = await getMediaBlobUrl(found.generatedImageBlobId);
          setSceneImageUrl(url);
        } else {
          setSceneImageUrl(null);
        }

        // Load individual shot image blob URLs
        const shotUrlMap: Record<string, string> = {};
        for (const shot of currentShots) {
          if (shot.generatedImageBlobId) {
            const shotUrl = await getMediaBlobUrl(shot.generatedImageBlobId);
            if (shotUrl) {
              shotUrlMap[shot.id] = shotUrl;
            }
          }
        }
        setShotImageUrls(shotUrlMap);
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

  const handleCopyShotPrompt = (shotId: string, type: 'image' | 'video', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedShotPrompt({ id: shotId, type });
    setTimeout(() => setCopiedShotPrompt(null), 2000);
  };

  // Generate visual image for an individual shot
  const handleGenerateShotImage = async (shot: Shot) => {
    if (!activeScene) return;

    setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: true }));

    const rawPrompt = shot.imagePrompt || activeScene.imagePrompt;
    const finalPrompt = enrichPromptWithCharacterDNA(rawPrompt, activeScene, characters);

    try {
      await queueManager.addJob({
        projectId: activeScene.projectId,
        sceneId: activeScene.id,
        taskType: 'image',
        prompt: finalPrompt,
        params: {
          aspectRatio: activeScene.aspectRatio || '16:9',
        },
        onComplete: async (job) => {
          setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
          if (job.resultBlobId) {
            // Update shot in current scene
            const updatedShots = (activeScene.shots || []).map((s) =>
              s.id === shot.id
                ? { ...s, generatedImageBlobId: job.resultBlobId, status: 'completed' as const }
                : s
            );

            // If scene doesn't have an overview image yet, use shot 1 image
            const updatedScene: Scene = {
              ...activeScene,
              shots: updatedShots,
              generatedImageBlobId: activeScene.generatedImageBlobId || job.resultBlobId,
              generationStatus: 'completed',
              updatedAt: Date.now(),
            };

            await saveScene(updatedScene);
            setActiveScene(updatedScene);
            setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));

            const url = await getMediaBlobUrl(job.resultBlobId);
            if (url) {
              setShotImageUrls((prev) => ({ ...prev, [shot.id]: url }));
              if (!sceneImageUrl) {
                setSceneImageUrl(url);
              }
            }
          }
        },
        onError: (err) => {
          setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
          alert(`Gagal generate gambar shot ${shot.shotNumber}: ${err}`);
        },
      });
    } catch (err: any) {
      setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
      alert(`Error: ${err.message}`);
    }
  };

  // Generate all shots in current scene sequentially / parallel in queue
  const handleGenerateAllShots = async () => {
    if (!activeScene || !activeScene.shots || activeScene.shots.length === 0) return;
    setIsBatchGenerating(true);

    try {
      for (const shot of activeScene.shots) {
        await handleGenerateShotImage(shot);
      }
      setSaveNotice('Seluruh antrean shot berhasil dijadwalkan ke generator AI!');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: any) {
      alert(`Gagal memulai antrean shot: ${err.message}`);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Generate overview scene image (traditional single grid prompt)
  const handleGenerateImage = async () => {
    if (!activeScene || !imagePrompt) return;

    const finalPrompt = enrichPromptWithCharacterDNA(imagePrompt, activeScene, characters);

    try {
      await queueManager.addJob({
        projectId: activeScene.projectId,
        sceneId: activeScene.id,
        taskType: 'image',
        prompt: finalPrompt,
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

  const handleDownloadShotImage = async (shot: Shot) => {
    if (!shot.generatedImageBlobId) return;
    try {
      await downloadMediaBlobFile(
        shot.generatedImageBlobId,
        `storyboard_${project?.title || 'project'}_adegan_${activeScene?.sceneNumber}_shot_${shot.shotNumber}.png`
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add a new shot to the active scene
  const handleAddNewShot = async () => {
    if (!activeScene) return;

    const existingShots = activeScene.shots || [];
    const newShotNumber = existingShots.length + 1;
    const lastShot = existingShots[existingShots.length - 1];
    const startTime = lastShot ? lastShot.endTime : 0;
    const duration = 2.5;
    const endTime = Math.round((startTime + duration) * 10) / 10;

    const newShot: Shot = {
      id: `shot_${activeScene.id}_${newShotNumber}_${Date.now()}`,
      shotNumber: newShotNumber,
      startTime,
      endTime,
      duration,
      description: `Shot ${newShotNumber}: Aksi baru dalam adegan`,
      characterAction: 'Karakter melakukan aksi lanjutan',
      facialExpression: 'Fokus dan natural',
      bodyMovement: 'Gerakan tubuh terkoordinasi',
      cameraAngle: activeScene.cameraAngle || 'Eye-level Medium Shot',
      cameraMovement: activeScene.cameraMovement || 'Steady static',
      dialogue: '',
      imagePrompt: `${activeScene.imagePrompt}, shot ${newShotNumber} dynamic perspective, photorealistic 8k`,
      videoPrompt: `${activeScene.videoPrompt}, 24fps motion for shot ${newShotNumber}`,
      transition: 'Cut to next shot',
      status: 'idle',
    };

    const updatedShots = [...existingShots, newShot];
    const updatedScene: Scene = {
      ...activeScene,
      shots: updatedShots,
      shotsCount: updatedShots.length,
      duration: Math.max(activeScene.duration, endTime),
      updatedAt: Date.now(),
    };

    await saveScene(updatedScene);
    setActiveScene(updatedScene);
    setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));
    setSceneDuration(updatedScene.duration);
  };

  // Delete a shot from the active scene and renumber
  const handleDeleteShot = async (shotId: string) => {
    if (!activeScene || !activeScene.shots) return;
    if (activeScene.shots.length <= 1) {
      alert('Adegan harus memiliki minimal 1 shot.');
      return;
    }

    if (!confirm('Hapus shot ini dari adegan?')) return;

    const filtered = activeScene.shots.filter((s) => s.id !== shotId);
    let cumulativeTime = 0;
    const renumberedShots: Shot[] = filtered.map((s, idx) => {
      const dur = s.duration || 2.5;
      const start = Math.round(cumulativeTime * 10) / 10;
      const end = Math.round((start + dur) * 10) / 10;
      cumulativeTime = end;
      return {
        ...s,
        shotNumber: idx + 1,
        startTime: start,
        endTime: end,
      };
    });

    const updatedScene: Scene = {
      ...activeScene,
      shots: renumberedShots,
      shotsCount: renumberedShots.length,
      duration: Math.round(cumulativeTime * 10) / 10,
      updatedAt: Date.now(),
    };

    await saveScene(updatedScene);
    setActiveScene(updatedScene);
    setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));
    setSceneDuration(updatedScene.duration);
  };

  // Save changes from Shot Detail Modal
  const handleSaveEditingShot = async () => {
    if (!activeScene || !selectedEditingShot) return;

    const updatedShots = (activeScene.shots || []).map((s) =>
      s.id === selectedEditingShot.id ? selectedEditingShot : s
    );

    const updatedScene: Scene = {
      ...activeScene,
      shots: updatedShots,
      updatedAt: Date.now(),
    };

    await saveScene(updatedScene);
    setActiveScene(updatedScene);
    setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));
    setIsEditingShotModalOpen(false);
    setSelectedEditingShot(null);

    setSaveNotice(`Perubahan Shot ${selectedEditingShot.shotNumber} berhasil disimpan!`);
    setTimeout(() => setSaveNotice(null), 3000);
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

  // Auto Generate Visuals for all scenes & shots in the active episode
  const handleAutoGenerateFullEpisode = async () => {
    if (!project || !selectedEpisodeId) return;
    const episodeScenes = await getScenesByEpisode(selectedEpisodeId);
    if (!episodeScenes || episodeScenes.length === 0) {
      alert('Tidak ada adegan dalam episode ini untuk di-generate.');
      return;
    }

    let totalTasks = 0;
    for (const sc of episodeScenes) {
      const scShots = sc.shots && sc.shots.length > 0 ? sc.shots : [null];
      totalTasks += scShots.length;
    }

    if (
      !confirm(
        `Mulai Auto Full Episode Render untuk ${episodeScenes.length} adegan (~${totalTasks} visual shot)? Semua pekerjaan akan dijadwalkan otomatis.`
      )
    ) {
      return;
    }

    setIsAutoRenderingEpisode(true);
    setAutoRenderProgress({ current: 0, total: totalTasks, currentSceneTitle: 'Mempersiapkan antrean...' });

    let completedTasks = 0;

    try {
      for (const sc of episodeScenes) {
        setAutoRenderProgress({
          current: completedTasks,
          total: totalTasks,
          currentSceneTitle: sc.title,
        });

        if (sc.shots && sc.shots.length > 0) {
          for (const shot of sc.shots) {
            const rawPrompt = shot.imagePrompt || sc.imagePrompt;
            const finalPrompt = enrichPromptWithCharacterDNA(rawPrompt, sc, characters);

            await queueManager.addJob({
              projectId: sc.projectId,
              sceneId: sc.id,
              taskType: 'image',
              prompt: finalPrompt,
              params: {
                aspectRatio: sc.aspectRatio || '16:9',
              },
              onComplete: async (job) => {
                completedTasks++;
                setAutoRenderProgress({
                  current: completedTasks,
                  total: totalTasks,
                  currentSceneTitle: `Adegan #${sc.sceneNumber} - Shot #${shot.shotNumber}`,
                });

                if (job.resultBlobId) {
                  const freshScenes = await getScenesByEpisode(sc.episodeId);
                  const targetScene = freshScenes.find((s) => s.id === sc.id);
                  if (targetScene) {
                    const updatedShots = (targetScene.shots || []).map((s) =>
                      s.id === shot.id
                        ? { ...s, generatedImageBlobId: job.resultBlobId, status: 'completed' as const }
                        : s
                    );
                    const updatedScene: Scene = {
                      ...targetScene,
                      shots: updatedShots,
                      generatedImageBlobId: targetScene.generatedImageBlobId || job.resultBlobId,
                      generationStatus: 'completed',
                      updatedAt: Date.now(),
                    };
                    await saveScene(updatedScene);
                    if (targetScene.id === selectedSceneId) {
                      setActiveScene(updatedScene);
                      const url = await getMediaBlobUrl(job.resultBlobId);
                      if (url) {
                        setShotImageUrls((prev) => ({ ...prev, [shot.id]: url }));
                      }
                    }
                  }
                }
              },
              onError: (err) => {
                console.error(`Gagal render shot ${shot.shotNumber}:`, err);
              },
            });
          }
        } else {
          // Scene without individual shots
          const finalPrompt = enrichPromptWithCharacterDNA(sc.imagePrompt, sc, characters);
          await queueManager.addJob({
            projectId: sc.projectId,
            sceneId: sc.id,
            taskType: 'image',
            prompt: finalPrompt,
            params: {
              aspectRatio: sc.aspectRatio || '16:9',
            },
            onComplete: async (job) => {
              completedTasks++;
              setAutoRenderProgress({
                current: completedTasks,
                total: totalTasks,
                currentSceneTitle: `Adegan #${sc.sceneNumber}`,
              });

              if (job.resultBlobId) {
                const freshScenes = await getScenesByEpisode(sc.episodeId);
                const targetScene = freshScenes.find((s) => s.id === sc.id);
                if (targetScene) {
                  const updatedScene: Scene = {
                    ...targetScene,
                    generatedImageBlobId: job.resultBlobId,
                    generationStatus: 'completed',
                    updatedAt: Date.now(),
                  };
                  await saveScene(updatedScene);
                  if (targetScene.id === selectedSceneId) {
                    setActiveScene(updatedScene);
                    const url = await getMediaBlobUrl(job.resultBlobId);
                    if (url) setSceneImageUrl(url);
                  }
                }
              }
            },
            onError: (err) => {
              console.error(`Gagal render adegan ${sc.sceneNumber}:`, err);
            },
          });
        }
      }

      setSaveNotice(`Semua ${totalTasks} visual dalam episode berhasil dijadwalkan ke generator!`);
      setTimeout(() => setSaveNotice(null), 5000);
    } catch (err: any) {
      alert(`Terjadi kesalahan saat memulai auto render: ${err.message}`);
    } finally {
      setIsAutoRenderingEpisode(false);
    }
  };

  const activeEpisode = episodes.find((e) => e.id === selectedEpisodeId) || episodes[0];
  const currentSceneIndex = scenes.findIndex((s) => s.id === selectedSceneId);
  const prevScene = currentSceneIndex > 0 ? scenes[currentSceneIndex - 1] : null;
  const nextScene = currentSceneIndex >= 0 && currentSceneIndex < scenes.length - 1 ? scenes[currentSceneIndex + 1] : null;

  const currentEpisodeIndex = episodes.findIndex((e) => e.id === selectedEpisodeId);
  const prevEpisode = currentEpisodeIndex > 0 ? episodes[currentEpisodeIndex - 1] : null;
  const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1 ? episodes[currentEpisodeIndex + 1] : null;

  const handleGoNextScene = async () => {
    if (nextScene) {
      setSelectedSceneId(nextScene.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (nextEpisode) {
      await handleSelectEpisode(nextEpisode.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('Selamat! Anda telah mencapai akhir seluruh episode dan adegan storyboard.');
    }
  };

  const handleGoPrevScene = async () => {
    if (prevScene) {
      setSelectedSceneId(prevScene.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (prevEpisode) {
      await handleSelectEpisode(prevEpisode.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const activeShots = activeScene?.shots || [];

  return (
    <div className="space-y-6 pb-20">
      {/* TOP BAR: EPISODE SWITCHER & MASTER CONTROLS */}
      <div className="bg-[#121424] border border-border/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-border/60">
            <Clapperboard className="w-4 h-4 text-accent-purple" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              EPISODE
            </span>
          </div>

          {/* Episode Pills */}
          <div className="flex items-center gap-1.5">
            {episodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => handleSelectEpisode(ep.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 border ${
                  ep.id === selectedEpisodeId
                    ? 'bg-gradient-to-r from-accent-purple to-purple-800 text-white border-purple-500 shadow-md shadow-purple-950/60'
                    : 'bg-secondary/60 text-gray-400 border-border/60 hover:text-gray-200 hover:border-gray-500'
                }`}
              >
                <span>Ep {ep.episodeNumber}</span>
                <span className="text-[10px] opacity-75 font-normal truncate max-w-[80px]">
                  {ep.title.replace(/^Episode \d+[:\s]*/i, '')}
                </span>
              </button>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNewEpisode}
              className="h-7 text-xs px-2 py-1 flex items-center gap-1 border-dashed text-gray-400 hover:text-white"
              title="Tambah Episode Baru"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Episode Baru</span>
            </Button>
          </div>
        </div>

        {/* Auto Full Episode Render Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={handleAutoGenerateFullEpisode}
            disabled={isAutoRenderingEpisode || scenes.length === 0}
            className="text-xs font-semibold px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/40 shadow-lg shadow-purple-950/40"
            title="Generate seluruh visual adegan & shot di episode ini secara otomatis"
          >
            <PlayCircle className={`w-3.5 h-3.5 ${isAutoRenderingEpisode ? 'animate-spin' : ''}`} />
            <span>{isAutoRenderingEpisode ? 'Rendering Episode...' : 'Auto Full Episode Render'}</span>
          </Button>
        </div>
      </div>

      {/* Auto Render Progress Notification Banner */}
      {autoRenderProgress && (
        <div className="p-3 bg-purple-950/50 border border-purple-800/80 rounded-xl text-xs text-purple-200 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>
              Auto Render Episode: <strong>{autoRenderProgress.currentSceneTitle}</strong> ({autoRenderProgress.current}/{autoRenderProgress.total})
            </span>
          </div>
          <span className="font-mono text-purple-300 font-bold">
            {Math.round((autoRenderProgress.current / Math.max(autoRenderProgress.total, 1)) * 100)}%
          </span>
        </div>
      )}

      {/* Top Scene Director Bar (Identical to MasTon / SUTRADARA AI Visual Reference) */}
      <div className="bg-[#101222] border border-border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Adegan Number Badge */}
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
                {sceneDuration}s Total
              </span>
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-accent-purple" />
                {activeShots.length} Shot Berurutan
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-300 truncate max-w-[260px]">
                Transisi: {activeScene?.transition || 'Cut to next scene'}
              </span>
            </div>
          </div>
        </div>

        {/* Scene Navigation Selector & Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Prev / Next Scene Buttons */}
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoPrevScene}
              disabled={!prevScene && !prevEpisode}
              className="h-7 w-7 p-0 text-gray-300 hover:text-white"
              title="Adegan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-[11px] font-mono text-gray-400 px-1">
              {currentSceneIndex + 1}/{scenes.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoNextScene}
              disabled={!nextScene && !nextEpisode}
              className="h-7 w-7 p-0 text-gray-300 hover:text-white"
              title="Adegan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

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
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium animate-in fade-in flex items-center justify-between">
          <span>{saveNotice}</span>
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
      )}

      {/* SECTION 1: SHOT DIRECTOR WORKSPACE (Visual Grid of Consecutive Event Shots) */}
      <div className="bg-[#0D0E1A] border border-border rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-accent-cyan" />
            <div>
              <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider">
                GRID STORYBOARD SHOT — SUTRADARA AI
              </h3>
              <p className="text-xs text-gray-400">
                Setiap kejadian visual dipecah secara kronologis dengan gambar, pergerakan kamera, dan aksi mandiri.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddNewShot}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 text-accent-cyan" />
              Tambah Shot
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateAllShots}
              disabled={isBatchGenerating}
              className="text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isBatchGenerating ? 'Menjadwalkan...' : 'Generate Seluruh Shot'}
            </Button>
          </div>
        </div>

        {/* CHARACTER CONSISTENCY LOCK BANNER */}
        {characters.length > 0 && (
          <div className="bg-[#121426] border border-accent-purple/40 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-purple/20 border border-purple-500/40 flex items-center justify-center text-accent-purple shrink-0 shadow-sm shadow-purple-950/40">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-100">Kunci Konsistensi Karakter (Active Lock)</span>
                  <Badge variant="purple" size="sm" className="text-[10px] font-mono">
                    DNA Locked
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Ciri fisik wajah, warna kulit, model rambut, dan busana signature karakter otomatis dikunci ke seluruh shot.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {characters.map((c) => (
                <div
                  key={c.id}
                  className="px-2.5 py-1 rounded-lg bg-secondary/80 border border-border flex items-center gap-1.5 text-[11px] font-mono text-gray-200"
                  title={`${c.name}: ${c.physicalAppearance || ''} | Pakaian: ${c.clothing || ''}`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-accent-cyan" />
                  <span className="font-bold text-white">{c.name}</span>
                  {c.clothing && (
                    <span className="text-[10px] text-purple-300 max-w-[130px] truncate">
                      ({c.clothing})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Responsive Multi-Shot Grid (2 to 4 columns matching professional storyboard boards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeShots.map((shot) => {
            const shotImg = shotImageUrls[shot.id];
            const isGeneratingThisShot = generatingShotIds[shot.id];

            return (
              <div
                key={shot.id}
                className="bg-[#111321] border border-border/90 hover:border-accent-purple/50 rounded-xl overflow-hidden shadow-lg transition-all flex flex-col group"
              >
                {/* Shot Header Bar */}
                <div className="px-3 py-2 bg-[#17192D] border-b border-border/80 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-accent-purple/30 border border-purple-500/40 text-purple-200 font-bold text-[11px]">
                      SHOT {shot.shotNumber}
                    </span>
                    <span className="text-gray-400 text-[11px]">
                      {shot.startTime.toFixed(1)}s - {shot.endTime.toFixed(1)}s
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    ({shot.duration.toFixed(1)}s)
                  </span>
                </div>

                {/* Shot Image Container */}
                <div className="relative aspect-video bg-black/60 overflow-hidden flex items-center justify-center">
                  {shotImg ? (
                    <>
                      <img
                        src={shotImg}
                        alt={`Shot ${shot.shotNumber} - Adegan ${activeScene?.sceneNumber}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                      />
                      {/* Hover Overlay with Quick Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleGenerateShotImage(shot)}
                          disabled={isGeneratingThisShot}
                          className="h-8 px-2 text-xs"
                          title="Generate Ulang Visual Shot Ini"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingThisShot ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="cyan"
                          size="sm"
                          onClick={() => handleDownloadShotImage(shot)}
                          className="h-8 px-2 text-xs"
                          title="Download Gambar Shot Ini"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEditingShot(shot);
                            setIsEditingShotModalOpen(true);
                          }}
                          className="h-8 px-2 text-xs"
                          title="Edit Detail Shot"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <Camera className="w-6 h-6 mx-auto text-gray-600" />
                      <p className="text-[11px] text-gray-400 leading-tight line-clamp-2">
                        {shot.description || 'Visual belum di-generate'}
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleGenerateShotImage(shot)}
                        disabled={isGeneratingThisShot}
                        className="h-7 text-[11px] px-2.5 mx-auto"
                      >
                        {isGeneratingThisShot ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" /> Render...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" /> Generate Shot
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Shot Meta & Action Narrative */}
                <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <p className="text-gray-200 font-medium line-clamp-2 text-[12px] leading-snug">
                      {shot.description || shot.characterAction}
                    </p>

                    <div className="flex flex-wrap gap-1 text-[10px] font-mono text-gray-400">
                      <span className="px-1.5 py-0.5 rounded bg-secondary/80 border border-border">
                        {shot.cameraAngle}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary/80 border border-border">
                        {shot.cameraMovement}
                      </span>
                    </div>

                    {shot.dialogue && (
                      <div className="p-1.5 rounded bg-black/40 border border-border/60 text-[11px] text-gray-300 italic line-clamp-2">
                        {shot.dialogue}
                      </div>
                    )}
                  </div>

                  {/* Shot Action Bar */}
                  <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyShotPrompt(shot.id, 'image', shot.imagePrompt)}
                        className="px-1.5 py-1 rounded bg-secondary/60 hover:bg-secondary text-gray-300 hover:text-white transition-colors"
                        title="Salin Prompt Gambar Shot"
                      >
                        {copiedShotPrompt?.id === shot.id && copiedShotPrompt?.type === 'image' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] font-mono">IMG</span>
                        )}
                      </button>

                      <button
                        onClick={() => handleCopyShotPrompt(shot.id, 'video', shot.videoPrompt)}
                        className="px-1.5 py-1 rounded bg-secondary/60 hover:bg-secondary text-gray-300 hover:text-white transition-colors"
                        title="Salin Prompt Video Shot"
                      >
                        {copiedShotPrompt?.id === shot.id && copiedShotPrompt?.type === 'video' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] font-mono">VID</span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedEditingShot(shot);
                          setIsEditingShotModalOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-secondary/80 hover:bg-accent-purple hover:text-white text-gray-300 transition-colors flex items-center gap-1 text-[11px]"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>

                      <button
                        onClick={() => handleDeleteShot(shot.id)}
                        className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
                        title="Hapus Shot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: SCENE OVERVIEW & EDITING (Matching exact MasTon Sutradara AI layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Full Scene Preview Image & Dialogue Card (Lg: 7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main Storyboard Visual Container */}
          <div className="bg-[#0D0E1A] border border-border rounded-2xl overflow-hidden shadow-2xl">
            {sceneImageUrl ? (
              <div className="relative group bg-black">
                <img
                  src={sceneImageUrl}
                  alt={`Storyboard Adegan ${activeScene?.sceneNumber}`}
                  className="w-full h-auto object-cover max-h-[480px]"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button variant="cyan" size="sm" onClick={handleDownloadImage}>
                    <Download className="w-4 h-4" /> Download Gambar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-16 px-6 text-center space-y-4 bg-gradient-to-b from-[#111322] to-[#0A0B14]">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary/80 border border-border flex items-center justify-center">
                  <Film className="w-8 h-8 text-gray-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">
                    Storyboard Ikhtisar Adegan Belum Di-generate
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Anda dapat merender masing-masing shot pada grid di atas atau render poster ikhtisar adegan di sini.
                  </p>
                </div>
              </div>
            )}

            {/* Action Bar Below Image (Identical to reference screenshot) */}
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

            {/* Dialogue Lines Display / Audio Synthesizer */}
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
                  IMAGE PROMPT (SCENE OVERVIEW)
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
                  VIDEO PROMPT (SCENE DYNAMICS)
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

      {/* CONTINUOUS SCENE & EPISODE PROGRESSION BAR */}
      <div className="bg-[#101222] border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Kontinuitas Cerita:</span>
            <Badge variant="purple" size="sm" className="font-mono text-[10px]">
              {activeEpisode?.title || 'Episode'} &bull; Adegan {activeScene?.sceneNumber || 1} dari {scenes.length}
            </Badge>
          </div>
          <p className="text-xs text-gray-300">
            {nextScene
              ? `Lanjutan alur berikutnya: Adegan #${nextScene.sceneNumber} (${nextScene.title})`
              : nextEpisode
              ? `Episode ini selesai! Lanjut ke ${nextEpisode.title}`
              : 'Seluruh adegan dan episode telah selesai disusun.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {prevScene && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGoPrevScene}
              className="text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Adegan Sebelumnya (#{prevScene.sceneNumber})
            </Button>
          )}

          {nextScene ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGoNextScene}
              className="text-xs bg-gradient-to-r from-accent-purple to-purple-700 hover:from-accent-purple/90 hover:to-purple-600 shadow-md shadow-purple-950/50"
            >
              <span>Lanjut ke Adegan #{nextScene.sceneNumber}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : nextEpisode ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGoNextScene}
              className="text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-teal-950/50"
            >
              <span>Lanjut ke {nextEpisode.title}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Badge variant="success" size="md" className="font-semibold text-xs py-1.5 px-3">
              <Check className="w-4 h-4 mr-1" /> Cerita Lengkap Selesai
            </Badge>
          )}
        </div>
      </div>

      {/* SHOT DETAIL & EDITING MODAL */}
      {selectedEditingShot && (
        <Modal
          isOpen={isEditingShotModalOpen}
          onClose={() => {
            setIsEditingShotModalOpen(false);
            setSelectedEditingShot(null);
          }}
          title={`Edit Shot ${selectedEditingShot.shotNumber} — Adegan ${activeScene?.sceneNumber}`}
          description="Atur deskripsi kejadian, aksi karakter, sudut kamera, dan prompt gambar serta video secara mandiri."
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Waktu Mulai (detik)"
                type="number"
                step="0.1"
                value={selectedEditingShot.startTime}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    startTime: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <Input
                label="Waktu Selesai (detik)"
                type="number"
                step="0.1"
                value={selectedEditingShot.endTime}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    endTime: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <Input
                label="Durasi (detik)"
                type="number"
                step="0.1"
                value={selectedEditingShot.duration}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    duration: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <Input
              label="Deskripsi Kejadian"
              value={selectedEditingShot.description}
              onChange={(e) =>
                setSelectedEditingShot({
                  ...selectedEditingShot,
                  description: e.target.value,
                })
              }
              placeholder="Apa yang terjadi di shot ini..."
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Aksi Karakter"
                value={selectedEditingShot.characterAction}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    characterAction: e.target.value,
                  })
                }
              />
              <Input
                label="Ekspresi Wajah"
                value={selectedEditingShot.facialExpression}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    facialExpression: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Sudut Kamera"
                value={selectedEditingShot.cameraAngle}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    cameraAngle: e.target.value,
                  })
                }
              />
              <Input
                label="Pergerakan Kamera"
                value={selectedEditingShot.cameraMovement}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    cameraMovement: e.target.value,
                  })
                }
              />
            </div>

            <Input
              label="Dialog Shot (Opsional)"
              value={selectedEditingShot.dialogue || ''}
              onChange={(e) =>
                setSelectedEditingShot({
                  ...selectedEditingShot,
                  dialogue: e.target.value,
                })
              }
              placeholder='[emosi] NAMA: "Dialog..."'
            />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Image Prompt (Visual Shot)</label>
              <Textarea
                rows={3}
                value={selectedEditingShot.imagePrompt}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    imagePrompt: e.target.value,
                  })
                }
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Video Prompt (Gerakan Shot)</label>
              <Textarea
                rows={3}
                value={selectedEditingShot.videoPrompt}
                onChange={(e) =>
                  setSelectedEditingShot({
                    ...selectedEditingShot,
                    videoPrompt: e.target.value,
                  })
                }
                className="text-xs font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsEditingShotModalOpen(false);
                  setSelectedEditingShot(null);
                }}
              >
                Batal
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEditingShot}>
                <Save className="w-3.5 h-3.5" /> Simpan Perubahan Shot
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
