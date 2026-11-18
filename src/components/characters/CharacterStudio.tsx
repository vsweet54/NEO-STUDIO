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
  Star,
  UploadCloud,
  Eye,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Character } from '@/types/character';
import { getCharactersByProject, saveCharacter, deleteCharacter } from '@/lib/db/characters';
import { getMediaBlobUrl, saveMediaBlob, deleteMediaBlob } from '@/lib/db/media';
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Blob URL Maps
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [sheetUrls, setSheetUrls] = useState<Record<string, string>>({});
  const [refImageUrls, setRefImageUrls] = useState<Record<string, string>>({});

  // Form states for modal
  const [name, setName] = useState('');
  const [role, setRole] = useState<'protagonist' | 'antagonist' | 'supporting' | 'narrator'>('protagonist');
  const [age, setAge] = useState('24');
  const [appearance, setAppearance] = useState('');
  const [face, setFace] = useState('');
  const [hair, setHair] = useState('');
  const [clothing, setClothing] = useState('');
  const [personality, setPersonality] = useState('');
  const [token, setToken] = useState('');
  const [modalAvatarBlobId, setModalAvatarBlobId] = useState<string | undefined>(undefined);
  const [modalAvatarUrl, setModalAvatarUrl] = useState<string | null>(null);

  const refImageInputRef = useRef<HTMLInputElement>(null);
  const avatarImageInputRef = useRef<HTMLInputElement>(null);
  const modalAvatarInputRef = useRef<HTMLInputElement>(null);

  const loadCharacters = async () => {
    if (!projectId) return;
    try {
      const list = await getCharactersByProject(projectId);
      setCharacters(list);

      const currentChar = selectedChar
        ? list.find((c) => c.id === selectedChar.id) || list[0] || null
        : list[0] || null;
      setSelectedChar(currentChar);

      // Load avatar and sheet URLs
      const aUrls: Record<string, string> = {};
      const sUrls: Record<string, string> = {};
      const rUrls: Record<string, string> = {};

      for (const ch of list) {
        if (ch.avatarBlobId) {
          const url = await getMediaBlobUrl(ch.avatarBlobId);
          if (url) aUrls[ch.id] = url;
        }
        if (ch.characterSheetBlobId) {
          const url = await getMediaBlobUrl(ch.characterSheetBlobId);
          if (url) sUrls[ch.id] = url;
        }
        if (ch.referenceImageBlobIds && ch.referenceImageBlobIds.length > 0) {
          for (const bId of ch.referenceImageBlobIds) {
            const url = await getMediaBlobUrl(bId);
            if (url) rUrls[bId] = url;
          }
        }
      }

      setAvatarUrls(aUrls);
      setSheetUrls(sUrls);
      setRefImageUrls(rUrls);
    } catch (err) {
      console.error('Error loading characters:', err);
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
    setModalAvatarBlobId(undefined);
    setModalAvatarUrl(null);
    setSelectedChar(null);
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
    setModalAvatarBlobId(char.avatarBlobId);
    setModalAvatarUrl(avatarUrls[char.id] || null);
    setSelectedChar(char);
    setIsModalOpen(true);
  };

  const handleModalAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const blobId = await saveMediaBlob(file, 'image', file.name, projectId);
      const url = await getMediaBlobUrl(blobId);
      setModalAvatarBlobId(blobId);
      setModalAvatarUrl(url);
    } catch (err: any) {
      alert(`Gagal upload avatar: ${err.message}`);
    } finally {
      if (modalAvatarInputRef.current) modalAvatarInputRef.current.value = '';
    }
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
      referenceImageBlobIds: modalAvatarBlobId
        ? Array.from(new Set([...(selectedChar?.referenceImageBlobIds || []), modalAvatarBlobId]))
        : selectedChar?.referenceImageBlobIds || [],
      avatarBlobId: modalAvatarBlobId || selectedChar?.avatarBlobId,
      characterSheetBlobId: selectedChar?.characterSheetBlobId,
      consistencyPromptToken: token || `[CHAR_${name.toUpperCase().replace(/\s+/g, '_')}]`,
      createdAt: selectedChar?.createdAt || now,
      updatedAt: now,
    };

    await saveCharacter(charRecord);
    setIsModalOpen(false);
    await loadCharacters();
    setSelectedChar(charRecord);
    setUploadNotice(`Karakter ${name} berhasil disimpan!`);
    setTimeout(() => setUploadNotice(null), 3000);
  };

  const handleGeneratePortrait = async (char: Character) => {
    const prompt = `Cinematic 35mm film character portrait concept: ${char.name}, ${char.ageAppearance} years old, ${char.physicalAppearance}, facial features: ${char.faceDescription}, hairstyle: ${char.hairStyle}, wearing signature outfit: ${char.clothing}. Soft studio catchlights in eyes, cinematic key lighting, sharp 8k resolution, photorealistic character key visual.`;

    try {
      await queueManager.addJob({
        projectId,
        characterId: char.id,
        taskType: 'image',
        prompt,
        params: { aspectRatio: '1:1' },
        onComplete: async (job) => {
          if (job.resultBlobId) {
            const updated = {
              ...char,
              avatarBlobId: job.resultBlobId,
              referenceImageBlobIds: Array.from(
                new Set([...(char.referenceImageBlobIds || []), job.resultBlobId])
              ),
            };
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
            const updated = {
              ...char,
              characterSheetBlobId: job.resultBlobId,
              referenceImageBlobIds: Array.from(
                new Set([...(char.referenceImageBlobIds || []), job.resultBlobId])
              ),
            };
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

  // Upload Reference Photo for Character
  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedChar) return;

    setIsUploading(true);
    try {
      const newBlobIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const blobId = await saveMediaBlob(file, 'image', file.name, projectId);
        newBlobIds.push(blobId);
      }

      const existingIds = selectedChar.referenceImageBlobIds || [];
      const updatedIds = Array.from(new Set([...existingIds, ...newBlobIds]));

      const updated: Character = {
        ...selectedChar,
        referenceImageBlobIds: updatedIds,
        avatarBlobId: selectedChar.avatarBlobId || newBlobIds[0],
        updatedAt: Date.now(),
      };

      await saveCharacter(updated);
      await loadCharacters();
      setSelectedChar(updated);

      setUploadNotice(`${newBlobIds.length} foto referensi berhasil diunggah!`);
      setTimeout(() => setUploadNotice(null), 3000);
    } catch (err: any) {
      alert(`Gagal upload referensi: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (refImageInputRef.current) refImageInputRef.current.value = '';
      if (avatarImageInputRef.current) avatarImageInputRef.current.value = '';
    }
  };

  const handleSetAsAvatar = async (blobId: string) => {
    if (!selectedChar) return;
    try {
      const updated: Character = {
        ...selectedChar,
        avatarBlobId: blobId,
        updatedAt: Date.now(),
      };
      await saveCharacter(updated);
      await loadCharacters();
      setSelectedChar(updated);
      setUploadNotice(`Foto berhasil dijadikan Avatar Utama ${selectedChar.name}!`);
      setTimeout(() => setUploadNotice(null), 3000);
    } catch (err: any) {
      alert(`Gagal mengatur avatar: ${err.message}`);
    }
  };

  const handleDeleteReferencePhoto = async (blobId: string) => {
    if (!selectedChar) return;
    if (!confirm('Hapus foto referensi ini?')) return;

    try {
      const updatedIds = (selectedChar.referenceImageBlobIds || []).filter((id) => id !== blobId);
      const newAvatarId = selectedChar.avatarBlobId === blobId ? updatedIds[0] || undefined : selectedChar.avatarBlobId;

      const updated: Character = {
        ...selectedChar,
        referenceImageBlobIds: updatedIds,
        avatarBlobId: newAvatarId,
        updatedAt: Date.now(),
      };

      await saveCharacter(updated);
      await deleteMediaBlob(blobId);
      await loadCharacters();
      setSelectedChar(updated);
    } catch (err: any) {
      alert(`Gagal menghapus foto: ${err.message}`);
    }
  };

  const handleDeleteChar = async (char: Character) => {
    if (!confirm(`Hapus karakter ${char.name}?`)) return;
    await deleteCharacter(char.id);
    setSelectedChar(null);
    await loadCharacters();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-accent-cyan" />
            Character Consistency Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Kunci identitas visual, upload foto referensi, dan jaga wajah serta busana karakter 100% konsisten antar adegan.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openNewCharacterModal}>
          <Plus className="w-4 h-4" /> Karakter Baru
        </Button>
      </div>

      {uploadNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-medium animate-in fade-in flex items-center justify-between">
          <span>{uploadNotice}</span>
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
      )}

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
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {char.ageAppearance} th • {char.personality || 'Neutral'}
                      </p>
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
                {/* Header Profile with Interactive Avatar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border">
                  <div className="flex items-center gap-4">
                    {/* Clickable Avatar Photo */}
                    <div
                      onClick={() => avatarImageInputRef.current?.click()}
                      className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-[#0D0E1A] border-2 border-accent-purple/50 overflow-hidden shrink-0 flex items-center justify-center group cursor-pointer shadow-lg shadow-purple-950/50"
                      title="Klik untuk upload avatar baru"
                    >
                      {avatarUrls[selectedChar.id] ? (
                        <img
                          src={avatarUrls[selectedChar.id]}
                          alt={selectedChar.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                        />
                      ) : (
                        <Users className="w-10 h-10 text-gray-500" />
                      )}
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-1">
                        <Camera className="w-5 h-5 text-accent-cyan" />
                        <span className="text-[9px] font-semibold mt-1">Ubah Foto</span>
                      </div>
                    </div>

                    {/* Hidden Avatar Input */}
                    <input
                      type="file"
                      ref={avatarImageInputRef}
                      onChange={handleReferenceUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold text-white">{selectedChar.name}</h2>
                        <Badge variant="purple" size="sm" className="capitalize">
                          {selectedChar.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Consistency Token: <span className="text-accent-cyan font-bold">{selectedChar.consistencyPromptToken}</span>
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3" /> Visual DNA otomatis dikunci pada Storyboard
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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
                      Pakaian & Signature Outfit
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
                        Render 3 sudut (Depan, 3/4 View, Samping) untuk menjaga referensi wajah di seluruh cerita.
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

                  {selectedChar.characterSheetBlobId && sheetUrls[selectedChar.id] ? (
                    <div className="relative rounded-xl overflow-hidden border border-border group bg-black">
                      <img
                        src={sheetUrls[selectedChar.id]}
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

                {/* REFERENCE IMAGES GALLERY SECTION */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-accent-purple" />
                        Foto Referensi Karakter ({selectedChar.referenceImageBlobIds?.length || 0})
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Upload foto wajah atau busana asli untuk menjaga kemiripan karakter di setiap adegan.
                      </p>
                    </div>

                    <input
                      type="file"
                      ref={refImageInputRef}
                      onChange={handleReferenceUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => refImageInputRef.current?.click()}
                      disabled={isUploading}
                      className="text-xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      {isUploading ? 'Mengunggah...' : 'Upload Foto Referensi'}
                    </Button>
                  </div>

                  {/* Upload Drop Zone / Display Grid */}
                  {selectedChar.referenceImageBlobIds && selectedChar.referenceImageBlobIds.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {selectedChar.referenceImageBlobIds.map((blobId, idx) => {
                        const imgUrl = refImageUrls[blobId];
                        const isMainAvatar = selectedChar.avatarBlobId === blobId;

                        return (
                          <div
                            key={blobId}
                            className={`relative aspect-square rounded-xl overflow-hidden border transition-all group bg-black/60 ${
                              isMainAvatar ? 'border-accent-purple ring-2 ring-accent-purple/40' : 'border-border'
                            }`}
                          >
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={`Referensi ${selectedChar.name} ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <Camera className="w-6 h-6 animate-pulse" />
                              </div>
                            )}

                            {/* Main Avatar Badge */}
                            {isMainAvatar && (
                              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-accent-purple text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                                <Star className="w-3 h-3 fill-white" /> Avatar Utama
                              </div>
                            )}

                            {/* Hover Actions */}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                              {!isMainAvatar && (
                                <button
                                  onClick={() => handleSetAsAvatar(blobId)}
                                  className="p-1.5 rounded-lg bg-accent-purple/80 hover:bg-accent-purple text-white text-xs transition-colors"
                                  title="Jadikan Avatar Utama"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  await downloadMediaBlobFile(
                                    blobId,
                                    `referensi_${selectedChar.name.toLowerCase()}_${idx + 1}.png`
                                  );
                                }}
                                className="p-1.5 rounded-lg bg-secondary/80 hover:bg-secondary text-gray-200 transition-colors"
                                title="Download Foto"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteReferencePhoto(blobId)}
                                className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 transition-colors"
                                title="Hapus Foto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      onClick={() => refImageInputRef.current?.click()}
                      className="p-8 border-2 border-dashed border-border/80 hover:border-accent-purple/60 rounded-xl text-center bg-[#0D0E1A]/80 cursor-pointer space-y-2 transition-all group"
                    >
                      <UploadCloud className="w-8 h-8 mx-auto text-gray-500 group-hover:text-accent-cyan transition-colors" />
                      <p className="text-xs font-semibold text-gray-300">
                        Klik di sini untuk upload foto referensi karakter
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Format PNG, JPG, WebP didukung. Foto ini akan mengunci fitur visual karakter.
                      </p>
                    </div>
                  )}
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
          {/* Avatar Upload in Modal */}
          <div className="flex items-center gap-4 p-3 bg-[#0D0E1A] rounded-xl border border-border">
            <div
              onClick={() => modalAvatarInputRef.current?.click()}
              className="w-16 h-16 rounded-xl bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center cursor-pointer group relative"
              title="Upload foto avatar"
            >
              {modalAvatarUrl ? (
                <img src={modalAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-7 h-7 text-gray-500" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-4 h-4 text-accent-cyan" />
              </div>
            </div>

            <input
              type="file"
              ref={modalAvatarInputRef}
              onChange={handleModalAvatarUpload}
              accept="image/*"
              className="hidden"
            />

            <div>
              <h4 className="text-xs font-bold text-gray-200">Foto Avatar Karakter</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Upload foto profil atau biarkan kosong untuk di-generate AI.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => modalAvatarInputRef.current?.click()}
                className="h-6 text-[10px] mt-1.5 px-2"
              >
                Pilih Foto
              </Button>
            </div>
          </div>

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
