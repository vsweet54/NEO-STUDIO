import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Sparkles, Film, Clapperboard, CheckCircle2, AlertCircle } from 'lucide-react';
import { PromptEngine } from '@/lib/prompts/templates';
import { queueManager } from '@/lib/queue/generation-queue';
import { saveProject } from '@/lib/db/projects';
import { saveEpisode } from '@/lib/db/episodes';
import { saveScene } from '@/lib/db/scenes';
import { saveCharacter } from '@/lib/db/characters';
import { Project, Episode, Scene, ProjectCategory, AspectRatio, VisualStyle, StoryTone, TargetAudience } from '@/types/project';
import { Character } from '@/types/character';

interface StoryboardWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
  defaultCategory?: ProjectCategory;
}

export const StoryboardWizardModal: React.FC<StoryboardWizardModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  defaultCategory = 'video-ad',
}) => {
  const [storyIdea, setStoryIdea] = useState('');
  const [category, setCategory] = useState<ProjectCategory>(defaultCategory);
  const [genre, setGenre] = useState('Commercial Comedy');
  const [language, setLanguage] = useState('Bahasa Indonesia');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cinematic-film');
  const [storyTone, setStoryTone] = useState<StoryTone>('humorous');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('general-public');
  const [episodesCount, setEpisodesCount] = useState(1);
  const [scenesCount, setScenesCount] = useState(3);
  const [sceneDuration, setSceneDuration] = useState(10);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [videoPlatform, setVideoPlatform] = useState('TikTok & Instagram Reels');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoryOptions = [
    { value: 'video-ad', label: 'Video Advertisement (Komersial/Iklan)' },
    { value: 'creative-content', label: 'Creative Content (Konten Kreatif)' },
    { value: 'animation', label: 'Animation (Animasi 2D/3D)' },
    { value: 'drama', label: 'Drama' },
    { value: 'film', label: 'Film Pendek / Sinematik' },
    { value: 'horror', label: 'Horror / Thriller' },
    { value: 'comedy', label: 'Comedy (Komedi)' },
    { value: 'podcast', label: 'Podcast & Visual Talk' },
    { value: 'educational', label: 'Educational Video (Edukasi)' },
    { value: 'product-promo', label: 'Product Promotion (Promosi Produk)' },
    { value: 'cinematic-story', label: 'Cinematic Story (Kisah Sinematik)' },
    { value: 'social-media', label: 'Social Media Content (Shorts/Reels)' },
  ];

  const visualStyleOptions = [
    { value: 'cinematic-film', label: 'Cinematic 35mm Film (Sinematik Teatrikal)' },
    { value: 'photorealistic', label: 'Photorealistic Hyperreal (Fotorealistis)' },
    { value: 'anime-japanese', label: 'Anime Makoto Shinkai Style' },
    { value: '3d-pixar-style', label: '3D Pixar/Disney Animation' },
    { value: 'dark-cyberpunk', label: 'Dark Cyberpunk Neon' },
    { value: 'retro-vintage', label: 'Retro 80s/90s Film Grain' },
    { value: 'documentary-raw', label: 'Documentary Raw Handheld' },
    { value: 'hyperreal-commercial', label: 'Commercial Studio Clean' },
  ];

  const toneOptions = [
    { value: 'humorous', label: 'Humorous (Lucu & Menghibur)' },
    { value: 'dramatic', label: 'Dramatic (Dramatis & Mendalam)' },
    { value: 'high-energy', label: 'High Energy (Cepat & Viral)' },
    { value: 'emotional', label: 'Emotional & Touching (Mengharukan)' },
    { value: 'suspenseful', label: 'Suspenseful & Tegang' },
    { value: 'luxurious', label: 'Luxurious & Premium' },
    { value: 'inspirational', label: 'Inspirational & Memotivasi' },
  ];

  const handleGenerate = async () => {
    if (!storyIdea.trim()) {
      setErrorMessage('Harap masukkan ide atau konsep cerita Anda terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep('Menganalisis konsep dan menyiapkan AI Router...');

    try {
      const { systemPrompt, userPrompt } = PromptEngine.buildStoryboardGenerationPrompt({
        storyIdea,
        category,
        genre,
        language,
        visualStyle,
        storyTone,
        targetAudience,
        episodesCount,
        scenesCount,
        sceneDuration,
        aspectRatio,
        videoPlatform,
      });

      setGenerationStep('Menghubungi AI Model untuk breakdown naskah & storyboard...');

      await queueManager.addJob({
        taskType: 'storyboard',
        prompt: userPrompt,
        params: {
          systemPrompt,
          jsonMode: true,
          temperature: 0.7,
        },
        onComplete: async (job) => {
          try {
            setGenerationStep('Memproses output JSON dan menyusun IndexedDB...');
            let data: any = job.resultData;

            if (typeof job.resultText === 'string') {
              try {
                // Strip markdown code fences if model returned them
                const cleanJson = job.resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                data = JSON.parse(cleanJson);
              } catch (e) {
                console.warn('Direct parse failed, trying substring...', e);
                const firstBrace = job.resultText.indexOf('{');
                const lastBrace = job.resultText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                  data = JSON.parse(job.resultText.substring(firstBrace, lastBrace + 1));
                }
              }
            }

            if (!data || !data.title || !data.scenes) {
              throw new Error('Format output JSON dari AI tidak lengkap. Silakan coba kembali.');
            }

            const now = Date.now();
            const projectId = 'proj_' + Math.random().toString(36).substring(2, 9) + now;

            const newProject: Project = {
              id: projectId,
              title: data.title,
              category,
              synopsis: data.synopsis || storyIdea,
              outline: data.outline || '',
              genre,
              language,
              visualStyle,
              storyTone,
              targetAudience,
              aspectRatio,
              videoPlatform,
              sceneDuration,
              episodesCount,
              scenesCount: data.scenes.length,
              createdAt: now,
              updatedAt: now,
            };

            await saveProject(newProject);

            // Save Episodes - ensure all requested episodesCount exist
            const episodeMap = new Map<number, string>();
            const rawEpList = Array.isArray(data.episodes) && data.episodes.length > 0 ? data.episodes : [];
            const epList: any[] = [...rawEpList];

            for (let eNum = 1; eNum <= episodesCount; eNum++) {
              if (!epList.some((e: any) => e.episodeNumber === eNum)) {
                epList.push({
                  episodeNumber: eNum,
                  title: `Episode ${eNum}: Kelanjutan Cerita`,
                  synopsis: `Kelanjutan cerita episode ${eNum} untuk proyek ${newProject.title}`,
                });
              }
            }

            for (const ep of epList) {
              const epId = 'ep_' + Math.random().toString(36).substring(2, 9) + now + '_' + ep.episodeNumber;
              episodeMap.set(ep.episodeNumber, epId);
              await saveEpisode({
                id: epId,
                projectId,
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                synopsis: ep.synopsis || '',
                status: 'draft',
                createdAt: now,
                updatedAt: now,
              });
            }

            // Save Characters
            const charIdMap = new Map<string, string>();
            for (const ch of data.characters || []) {
              const charId = 'char_' + Math.random().toString(36).substring(2, 9) + now;
              charIdMap.set(ch.name, charId);
              const charRecord: Character = {
                id: charId,
                projectId,
                name: ch.name,
                role: ch.role || 'protagonist',
                physicalAppearance: ch.physicalAppearance || '',
                faceDescription: ch.faceDescription || '',
                hairStyle: ch.hairStyle || '',
                clothing: ch.clothing || '',
                bodyType: ch.bodyType || '',
                ageAppearance: ch.ageAppearance || '25',
                personality: ch.personality || '',
                emotionProfile: ch.emotionProfile || { primary: 'neutral', intensity: 'moderate', expressions: [] },
                voiceProfile: ch.voiceProfile || { voiceName: ch.name, gender: 'neutral', pitch: 0, speed: 1, timbreDescription: '' },
                referenceImageBlobIds: [],
                consistencyPromptToken: ch.consistencyPromptToken || `[CHAR_TOKEN_${ch.name.toUpperCase().replace(/\s+/g, '_')}]`,
                createdAt: now,
                updatedAt: now,
              };
              await saveCharacter(charRecord);
            }

            // Save Scenes - distribute accurately across episodes
            for (let i = 0; i < data.scenes.length; i++) {
              const sc = data.scenes[i];
              const sceneId = 'sc_' + Math.random().toString(36).substring(2, 9) + now + '_' + i;
              
              let targetEpNum = sc.episodeNumber;
              if (!targetEpNum || !episodeMap.has(targetEpNum)) {
                targetEpNum = Math.min(Math.floor(i / scenesCount) + 1, episodesCount);
              }
              const epId = episodeMap.get(targetEpNum) || Array.from(episodeMap.values())[0];

              const charIds = (sc.characterNames || []).map((name: string) => charIdMap.get(name) || '').filter(Boolean);

              // Parse or synthesize hierarchical shots
              const rawShots = Array.isArray(sc.shots) && sc.shots.length > 0 ? sc.shots : [];
              const targetShotsCount = sc.shotsCount || (rawShots.length > 0 ? rawShots.length : 3);
              const shotDuration = Number((sceneDuration / targetShotsCount).toFixed(1));

              const parsedShots: any[] = [];
              if (rawShots.length > 0) {
                let currentStart = 0;
                for (let sIdx = 0; sIdx < rawShots.length; sIdx++) {
                  const s = rawShots[sIdx];
                  const dur = s.duration || shotDuration;
                  parsedShots.push({
                    id: 'shot_' + Math.random().toString(36).substring(2, 9) + now + sIdx,
                    shotNumber: s.shotNumber || sIdx + 1,
                    startTime: Number(currentStart.toFixed(1)),
                    endTime: Number((currentStart + dur).toFixed(1)),
                    duration: dur,
                    description: s.description || `Kejadian shot ${sIdx + 1}`,
                    characterAction: s.characterAction || 'Aksi karakter dalam shot',
                    facialExpression: s.facialExpression || 'Ekspresi natural',
                    bodyMovement: s.bodyMovement || 'Gerakan tubuh alami',
                    objectInteraction: s.objectInteraction || '',
                    cameraAngle: s.cameraAngle || sc.cameraAngle || 'Medium Shot',
                    cameraMovement: s.cameraMovement || sc.cameraMovement || 'Static / Slow Push',
                    dialogue: s.dialogue || '',
                    imagePrompt: s.imagePrompt || `${sc.imagePrompt}, Shot ${sIdx + 1}: ${s.description || ''}`,
                    videoPrompt: s.videoPrompt || `${sc.videoPrompt}, 24fps motion for Shot ${sIdx + 1}`,
                    transition: s.transition || (sIdx === rawShots.length - 1 ? sc.transition || 'Cut' : 'Direct Cut'),
                    status: 'idle',
                  });
                  currentStart += dur;
                }
              } else {
                // Synthesize 3-5 chronological shots if AI only returned scene-level
                let currentStart = 0;
                for (let sIdx = 0; sIdx < targetShotsCount; sIdx++) {
                  parsedShots.push({
                    id: 'shot_' + Math.random().toString(36).substring(2, 9) + now + sIdx,
                    shotNumber: sIdx + 1,
                    startTime: Number(currentStart.toFixed(1)),
                    endTime: Number((currentStart + shotDuration).toFixed(1)),
                    duration: shotDuration,
                    description: `Kejadian shot ${sIdx + 1}: Kronologi visual adegan ${i + 1}`,
                    characterAction: `Aksi shot ke-${sIdx + 1}`,
                    facialExpression: 'Fokus dan ekspresif',
                    bodyMovement: 'Postur natural sesuai situasi adegan',
                    objectInteraction: '',
                    cameraAngle: sIdx === 0 ? 'Establishing / Wide' : sIdx === 1 ? 'Medium Close-Up' : 'Close-Up Reaction',
                    cameraMovement: sIdx === 0 ? 'Slow Push-in' : 'Tracking Shot',
                    dialogue: (sc.dialogue && sc.dialogue[sIdx]?.text) ? `[${sc.dialogue[sIdx].emotionTag || 'bicara'}] ${sc.dialogue[sIdx].characterName}: "${sc.dialogue[sIdx].text}"` : '',
                    imagePrompt: sc.imagePrompt
                      ? `${sc.imagePrompt}, shot ${sIdx + 1} specific perspective, cinematic framing, 8k resolution`
                      : `Cinematic 35mm film shot of ${sc.title}, ${visualStyle}, cinematic lighting, photorealistic 8k, aspect ratio ${aspectRatio}`,
                    videoPrompt: `[VIDEO MOTION] Shot ${sIdx + 1} continuity: Camera moves smoothly, character performs action naturally, 24fps film motion blur`,
                    transition: sIdx === targetShotsCount - 1 ? sc.transition || 'Cut' : 'Direct Cut',
                    status: 'idle',
                  });
                  currentStart += shotDuration;
                }
              }

              const sceneRecord: Scene = {
                id: sceneId,
                projectId,
                episodeId: epId,
                sceneNumber: sc.sceneNumber || i + 1,
                title: sc.title || `Adegan ${i + 1}`,
                description: sc.description || '',
                characterIds: charIds,
                dialogue: (sc.dialogue || []).map((d: any, idx: number) => ({
                  id: `d_${idx}_${Date.now()}`,
                  characterName: d.characterName || 'NARRATOR',
                  emotionTag: d.emotionTag || '[bicara]',
                  text: d.text || '',
                })),
                imagePrompt: sc.imagePrompt || '',
                videoPrompt: sc.videoPrompt || '',
                cameraAngle: sc.cameraAngle || 'Eye-level',
                cameraMovement: sc.cameraMovement || 'Static / Slow Push',
                lighting: sc.lighting || 'Cinematic Lighting',
                environment: sc.environment || 'Studio Setting',
                duration: sceneDuration,
                aspectRatio,
                shotsCount: parsedShots.length,
                transition: sc.transition || 'Cut',
                referenceImageBlobIds: [],
                generationStatus: 'prompts-ready',
                shots: parsedShots,
                createdAt: now,
                updatedAt: now,
              };

              await saveScene(sceneRecord);
            }

            setIsGenerating(false);
            onProjectCreated(projectId);
            onClose();
          } catch (err: any) {
            console.error('Error saving generated project:', err);
            setErrorMessage(`Gagal memproses struktur storyboard: ${err.message}`);
            setIsGenerating(false);
          }
        },
        onError: (err) => {
          setErrorMessage(err);
          setIsGenerating(false);
        },
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memulai job pembuatan storyboard');
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Storyboard Director Generator"
      description="Buat skrip, karakter, dan storyboard profesional terintegrasi menggunakan AI."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isGenerating ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
            <div>
              <h4 className="text-base font-bold text-gray-100">AI Director Sedang Bekerja</h4>
              <p className="text-xs text-accent-cyan mt-1 font-mono">{generationStep}</p>
            </div>
            <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
              Membuat plot cerita, mendesain karakter, menyusun breakdown adegan, serta mengunci prompt Storyboard Grid Lock & Video Frame Zero...
            </p>
          </div>
        ) : (
          <>
            {/* Story Idea */}
            <Textarea
              label="Ide Cerita / Konsep Konten (Story Brief)"
              placeholder="Contoh: Ririn yang bersemangat berburu cilok viral di pasar malam yang ramai dan aromanya menggoda..."
              rows={3}
              value={storyIdea}
              onChange={(e) => setStoryIdea(e.target.value)}
              hint="Semakin detail ide Anda, semakin hidup karakter dan storyboard yang dihasilkan."
            />

            {/* Category and Genre Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Kategori Proyek"
                options={categoryOptions}
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectCategory)}
              />

              <Input
                label="Genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="misal: Komersial Kuliner, Drama Misteri"
              />
            </div>

            {/* Visual Style and Tone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Gaya Visual (Visual Style)"
                options={visualStyleOptions}
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
              />

              <Select
                label="Tone Cerita (Story Tone)"
                options={toneOptions}
                value={storyTone}
                onChange={(e) => setStoryTone(e.target.value as StoryTone)}
              />
            </div>

            {/* Specs Row: Episodes, Scenes, Duration, Aspect Ratio */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-secondary/40 p-3 rounded-xl border border-border">
              <Input
                label="Episode"
                type="number"
                min={1}
                max={5}
                value={episodesCount}
                onChange={(e) => setEpisodesCount(parseInt(e.target.value) || 1)}
              />

              <Input
                label="Jml Adegan"
                type="number"
                min={1}
                max={10}
                value={scenesCount}
                onChange={(e) => setScenesCount(parseInt(e.target.value) || 3)}
              />

              <Input
                label="Durasi (detik)"
                type="number"
                min={5}
                max={60}
                value={sceneDuration}
                onChange={(e) => setSceneDuration(parseInt(e.target.value) || 10)}
              />

              <Select
                label="Aspek Rasio"
                options={[
                  { value: '16:9', label: '16:9 (Landscape / YouTube)' },
                  { value: '9:16', label: '9:16 (Vertical / Reels / TikTok)' },
                  { value: '1:1', label: '1:1 (Square / Feed)' },
                  { value: '4:5', label: '4:5 (Social Media)' },
                  { value: '2.39:1', label: '2.39:1 (Cinemascope)' },
                ]}
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
              />
            </div>

            {/* Language & Platform */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Bahasa Naskah & Dialog"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="Bahasa Indonesia / English"
              />

              <Input
                label="Target Platform"
                value={videoPlatform}
                onChange={(e) => setVideoPlatform(e.target.value)}
                placeholder="TikTok, YouTube, Cinema, Web"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={onClose}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleGenerate}>
                <Sparkles className="w-4 h-4" />
                Generate Storyboard AI
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
