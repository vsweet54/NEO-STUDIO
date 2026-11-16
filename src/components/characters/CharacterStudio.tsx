import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Sparkles,
  Camera,
  Trash2,
  Edit,
  Save,
  Download,
  Image as ImageIcon,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Character } from '@/types/character';
import { getCharactersByProject, saveCharacter, deleteCharacter } from '@/lib/db/characters';
import { getMediaBlobUrl, saveMediaBlob } from '@/lib/db/media';
import { downloadMediaBlobFile } from '@/lib/storage/export-import';
import { queueManager } from '@/lib/queue/generation-queue';
import { PromptEngine } from '@/lib/prompts/templates';

interface CharacterStudioProps {
  projectId: string;
}

export const CharacterStudio: React.FC<CharacterStudioProps> = ({ projectId }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState<'protagonist' | 'antagonist' | 'supporting' | 'narrator'>('protagonist');
  const [age, setAge] = useState('24');
  const [appearance, setAppearance] = useState('');
  const [face, setFace] = useState('');
  const [hair, setHair] = useState('');
  const [clothing, setClothing] = useState('');
  const [personality, setPersonality] = useState('');
  const [token, setToken] = useState('');

  const refImageInputRef = useRef<HTMLInputElement>(null);

  const loadCharacters = async () => {
    if (!projectId) return;
    try {
      const list = await getCharactersByProject(projectId);
      setCharacters(list);
      if (list.length > 0 && !selectedChar) {
        setSelectedChar(list[0]);
      }

      // Load avatar urls
      const urls: Record<string, string> = {};
      for (const ch of list) {
        if (ch.avatarBlobId) {
          const url = await getMediaBlobUrl(ch.avatarBlobId);
          if (url) urls[ch.id] = url;
        }
      }
      setAvatarUrls(urls);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, [projectId]);

  const openNewCharacterModal = () => {
    setName('');
    setRole('protagonist');
    setAge('24');
    setAppearance('');
    setFace('');
    setHair('');
    setClothing('');
    setPersonality('');
    setToken(`[CHAR_${Date.now()}]`);
    setIsModalOpen(true);
  };

  const openEditCharacterModal = (char: Character) => {
    setName(char.name);
    setRole(char.role as any);
    setAge(char.ageAppearance);
    setAppearance(char.physicalAppearance);
    setFace(char.faceDescription);
    setHair(char.hairStyle);
    setClothing(char.clothing);
    setPersonality(char.personality);
    setToken(char.consistencyPromptToken);
    setSelectedChar(char);
    setIsModalOpen(true);
  };

  const handleSaveCharacter = async () => {
    if (!name.trim()) {
      alert('Nama karakter wajib diisi.');
      return;
    }

    const now = Date.now();
    const charId = selectedChar?.id || 'char_' + Math.random().toString(36).substring(2, 9) + now;

    const charRecord: Character = {
      id: charId,
      projectId,
      name,
      role,
      physicalAppearance: appearance,
      faceDescription: face,
      hairStyle: hair,
      clothing,
      bodyType: 'Proporsional',
      ageAppearance: age,
      personality,
      emotionProfile: selectedChar?.emotionProfile || {
        primary: 'confident',
        intensity: 'moderate',
        expressions: ['focused', 'determined', 'warm'],
      },
      voiceProfile: selectedChar?.voiceProfile || {
        voiceName: name,
        gender: 'female',
        pitch: 0,
        speed: 1,
        timbreDescription: 'Natural tone',
      },
      referenceImageBlobIds: selectedChar?.referenceImageBlobIds || [],
      avatarBlobId: selectedChar?.avatarBlobId,
      characterSheetBlobId: selectedChar?.characterSheetBlobId,
      consistencyPromptToken: token || `[CHAR_${name.toUpperCase().replace(/\s+/g, '_')}]`,
      createdAt: selectedChar?.createdAt || now,
      updatedAt: now,
    };

    await saveCharacter(charRecord);
    setIsModalOpen(false);
    await loadCharacters();
    setSelectedChar(charRecord);
  };

  const handleGeneratePortrait = async (char: Character) => {
    const prompt = `Character portrait concept art: ${char.name}, ${char.ageAppearance} years old, ${char.physicalAppearance}, face: ${char.faceDescription}, hair: ${char.hairStyle}, attire: ${char.clothing}. Cinematic studio lighting, sharp 8k resolution, photorealistic character key visual.`;

    try {
      await queueManager.addJob({
        projectId,
        characterId: char.id,
        taskType: 'image',
        prompt,
        params: { aspectRatio: '1:1' },
        onComplete: async (job) => {
          if (job.resultBlobId) {
            const updated = { ...char, avatarBlobId: job.resultBlobId };
            await saveCharacter(updated);
            await loadCharacters();
            setSelectedChar(updated);
          }
        },
      });
    } catch (err: any) {
      alert(`Gagal generate portrait: ${err.message}`);
    }
  };

  const handleGenerateCharacterSheet = async (char: Character) => {
    setIsGeneratingSheet(true);
    const sheetPrompt = PromptEngine.buildCreativeToolPrompt({
      toolId: 'character-sheet',
      basePrompt: `${char.name}, ${char.ageAppearance} years old, ${char.physicalAppearance}, facial features: ${char.faceDescription}, hair: ${char.hairStyle}, wearing ${char.clothing}`,
      aspectRatio: '16:9',
    });

    try {
      await queueManager.addJob({
        projectId,
        characterId: char.id,
        taskType: 'image',
        prompt: sheetPrompt,
        params: { aspectRatio: '16:9' },
        onComplete: async (job) => {
          if (job.resultBlobId) {
            const updated = { ...char, characterSheetBlobId: job.resultBlobId };
            await saveCharacter(updated);
            await loadCharacters();
            setSelectedChar(updated);
          }
          setIsGeneratingSheet(false);
        },
        onError: () => setIsGeneratingSheet(false),
      });
    } catch (err: any) {
      alert(`Gagal generate character sheet: ${err.message}`);
      setIsGeneratingSheet(false);
    }
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChar) return;

    try {
      const blobId = await saveMediaBlob(file, 'image', file.name, projectId);
      const updated = {
        ...selectedChar,
        referenceImageBlobIds: [...(selectedChar.referenceImageBlobIds || []), blobId],
        avatarBlobId: selectedChar.avatarBlobId || blobId,
      };
      await saveCharacter(updated);
      await loadCharacters();
      setSelectedChar(updated);
    } catch (err: any) {
      alert(`Gagal upload referensi: ${err.message}`);
    }
  };

  const handleDeleteChar = async (char: Character) => {
    if (!confirm(`Hapus karakter ${char.name}?`)) return;
    await deleteCharacter(char.id);
    setSelectedChar(null);
    await loadCharacters();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-accent-cyan" />
            Character Consistency Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Kunci identitas visual, gaya rambut, busana, dan tokens konsistensi karakter antar adegan.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openNewCharacterModal}>
          <Plus className="w-4 h-4" /> Karakter Baru
        </Button>
      </div>

      {characters.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center space-y-4 bg-[#0C0E1B]">
          <Users className="w-12 h-12 mx-auto text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-300">Belum Ada Karakter</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Buat karakter baru atau jalankan Storyboard Studio untuk menghasilkan ensemble karakter otomatis.
          </p>
          <Button variant="primary" onClick={openNewCharacterModal}>
            <Plus className="w-4 h-4" /> Tambah Karakter
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Character List Column */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
              Daftar Karakter ({characters.length})
            </h3>
            <div className="space-y-2">
              {characters.map((char) => {
                const isSelected = selectedChar?.id === char.id;
                const avatar = avatarUrls[char.id];

                return (
                  <div
                    key={char.id}
                    onClick={() => setSelectedChar(char)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                      isSelected
                        ? 'bg-accent-purple/20 border-accent-purple shadow-lg shadow-purple-950/40'
                        : 'bg-surface hover:bg-surface-light border-border'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {avatar ? (
                        <img src={avatar} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-gray-500" />
                      )}
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-bold text-gray-100 truncate">{char.name}</h4>
                        <Badge variant="cyan" size="sm" className="capitalize text-[10px]">
                          {char.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{char.ageAppearance} th • {char.personality || 'Neutral'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character Detail & Sheet Preview Column */}
          <div className="lg:col-span-8">
            {selectedChar && (
              <div className="bg-surface border border-border rounded-2xl p-6 space-y-6 shadow-2xl">
                {/* Header Profile */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#0D0E1A] border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {avatarUrls[selectedChar.id] ? (
                        <img
                          src={avatarUrls[selectedChar.id]}
                          alt={selectedChar.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-8 h-8 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold text-white">{selectedChar.name}</h2>
                        <Badge variant="purple" size="sm" className="capitalize">
                          {selectedChar.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Consistency Token: <span className="text-accent-cyan">{selectedChar.consistencyPromptToken}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditCharacterModal(selectedChar)}
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGeneratePortrait(selectedChar)}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Portrait AI
                    </Button>
                    <button
                      onClick={() => handleDeleteChar(selectedChar)}
                      className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/40 transition-colors"
                      title="Hapus Karakter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Character Traits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-[#0D0E1A] border border-border rounded-xl space-y-1">
                    <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                      Wajah & Fitur Muka
                    </span>
                    <p className="text-gray-200">{selectedChar.faceDescription || 'Belum diatur'}</p>
                  </div>

                  <div className="p-3.5 bg-[#0D0E1A] border border-border rounded-xl space-y-1">
                    <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                      Gaya Rambut
                    </span>
                    <p className="text-gray-200">{selectedChar.hairStyle || 'Belum diatur'}</p>
                  </div>

                  <div className="p-3.5 bg-[#0D0E1A] border border-border rounded-xl space-y-1">
                    <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                      Pakaian & Aksesoris
                    </span>
                    <p className="text-gray-200">{selectedChar.clothing || 'Belum diatur'}</p>
                  </div>

                  <div className="p-3.5 bg-[#0D0E1A] border border-border rounded-xl space-y-1">
                    <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                      Postur Tubuh & Penampilan
                    </span>
                    <p className="text-gray-200">{selectedChar.physicalAppearance || 'Belum diatur'}</p>
                  </div>
                </div>

                {/* Character Model Sheet Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-200">Multi-Angle Model Sheet</h4>
                      <p className="text-xs text-gray-400">
                        Render 3 sudut (Depan, 3/4 View, Samping) untuk menjaga referensi wajah.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateCharacterSheet(selectedChar)}
                      isLoading={isGeneratingSheet}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
                      Generate Model Sheet
                    </Button>
                  </div>

                  {selectedChar.characterSheetBlobId ? (
                    <div className="relative rounded-xl overflow-hidden border border-border group bg-black">
                      <img
                        src={avatarUrls[selectedChar.id] || ''}
                        alt="Character Sheet"
                        className="w-full h-auto max-h-72 object-cover"
                      />
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-border rounded-xl text-center bg-[#0D0E1A] space-y-2">
                      <Camera className="w-8 h-8 mx-auto text-gray-600" />
                      <p className="text-xs text-gray-400">Belum ada character sheet yang di-generate</p>
                    </div>
                  )}
                </div>

                {/* Reference Images Upload */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      Foto Referensi Karakter ({selectedChar.referenceImageBlobIds?.length || 0})
                    </h4>
                    <input
                      type="file"
                      ref={refImageInputRef}
                      onChange={handleReferenceUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refImageInputRef.current?.click()}
                      className="text-xs"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Upload Referensi
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit / Create Character Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedChar ? `Edit Karakter: ${name}` : 'Tambah Karakter Baru'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nama Karakter" value={name} onChange={(e) => setName(e.target.value)} />
            <Select
              label="Peran Karakter"
              options={[
                { value: 'protagonist', label: 'Protagonist (Tokoh Utama)' },
                { value: 'antagonist', label: 'Antagonist' },
                { value: 'supporting', label: 'Supporting Character' },
                { value: 'narrator', label: 'Narrator' },
              ]}
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Usia Penampilan" value={age} onChange={(e) => setAge(e.target.value)} />
            <Input
              label="Consistency Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="[CHAR_TOKEN]"
            />
          </div>

          <Input
            label="Deskripsi Wajah"
            value={face}
            onChange={(e) => setFace(e.target.value)}
            placeholder="Mata tajam cokelat, hidung mancung, senyum ramah"
          />

          <Input
            label="Gaya & Warna Rambut"
            value={hair}
            onChange={(e) => setHair(e.target.value)}
            placeholder="Rambut hitam sebahu bergelombang rapi"
          />

          <Input
            label="Pakaian & Signature Outfit"
            value={clothing}
            onChange={(e) => setClothing(e.target.value)}
            placeholder="Jaket denim vintage, kaos putih kasual, sneakers"
          />

          <Textarea
            label="Kepribadian & Penampilan Umum"
            rows={2}
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="Energik, ramah, suka petualangan kuliner..."
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveCharacter}>
              <Save className="w-4 h-4" /> Simpan Karakter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
