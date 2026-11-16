import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getProjectById, saveProject, getAllProjects } from '../db/projects';
import { getEpisodesByProject, saveEpisode } from '../db/episodes';
import { getScenesByProject, saveScene } from '../db/scenes';
import { getCharactersByProject, saveCharacter } from '../db/characters';
import { getDB } from '../db';
import { getMediaBlob, saveMediaBlob } from '../db/media';
import { Project, Episode, Scene } from '@/types/project';
import { Character } from '@/types/character';

export interface ProjectExportPackage {
  version: string;
  exportedAt: number;
  project: Project;
  episodes: Episode[];
  scenes: Scene[];
  characters: Character[];
  mediaManifest: {
    blobId: string;
    path: string;
    mimeType: string;
    size: number;
    type: 'image' | 'video' | 'audio';
  }[];
}

/**
 * Downloads a single media blob directly as a file.
 */
export async function downloadMediaBlobFile(blobId: string, defaultFileName: string): Promise<void> {
  const record = await getMediaBlob(blobId);
  if (!record || !record.data) {
    throw new Error('Media asset not found in local storage');
  }

  const fileName = record.fileName || defaultFileName;
  saveAs(record.data, fileName);
}

/**
 * Exports a full project as a standalone ZIP archive containing JSON metadata and all binary assets.
 */
export async function exportProjectToZip(projectId: string): Promise<void> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error('Project not found');

  const episodes = await getEpisodesByProject(projectId);
  const scenes = await getScenesByProject(projectId);
  const characters = await getCharactersByProject(projectId);

  const zip = new JSZip();
  const mediaFolder = zip.folder('media');
  const mediaManifest: ProjectExportPackage['mediaManifest'] = [];

  // Collect all referenced blob IDs
  const blobIdsToCollect = new Set<string>();

  if (project.thumbnailBlobId) blobIdsToCollect.add(project.thumbnailBlobId);

  characters.forEach((char) => {
    if (char.avatarBlobId) blobIdsToCollect.add(char.avatarBlobId);
    if (char.characterSheetBlobId) blobIdsToCollect.add(char.characterSheetBlobId);
    char.referenceImageBlobIds.forEach((id) => blobIdsToCollect.add(id));
  });

  scenes.forEach((scene) => {
    if (scene.generatedImageBlobId) blobIdsToCollect.add(scene.generatedImageBlobId);
    if (scene.generatedVideoBlobId) blobIdsToCollect.add(scene.generatedVideoBlobId);
    if (scene.generatedAudioBlobId) blobIdsToCollect.add(scene.generatedAudioBlobId);
    scene.referenceImageBlobIds.forEach((id) => blobIdsToCollect.add(id));
    scene.dialogue.forEach((d) => {
      if (d.audioBlobId) blobIdsToCollect.add(d.audioBlobId);
    });
  });

  // Fetch blobs and write into zip folder
  for (const blobId of blobIdsToCollect) {
    const record = await getMediaBlob(blobId);
    if (record && record.data && mediaFolder) {
      const extension = record.mimeType.includes('png')
        ? 'png'
        : record.mimeType.includes('jpeg')
        ? 'jpg'
        : record.mimeType.includes('mp4')
        ? 'mp4'
        : record.mimeType.includes('wav')
        ? 'wav'
        : 'bin';

      const pathInZip = `${record.type}s/${record.id}.${extension}`;
      mediaFolder.file(pathInZip, record.data);

      mediaManifest.push({
        blobId: record.id,
        path: `media/${pathInZip}`,
        mimeType: record.mimeType,
        size: record.size,
        type: record.type,
      });
    }
  }

  const exportPackage: ProjectExportPackage = {
    version: '1.0.0',
    exportedAt: Date.now(),
    project,
    episodes,
    scenes,
    characters,
    mediaManifest,
  };

  zip.file('project.json', JSON.stringify(exportPackage, null, 2));

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const safeTitle = project.title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  saveAs(content, `neo_studio_${safeTitle}_${Date.now()}.zip`);
}

/**
 * Imports a project from a ZIP file into IndexedDB with new UUIDs to prevent ID collisions.
 */
export async function importProjectFromZip(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const projectJsonFile = zip.file('project.json');

  if (!projectJsonFile) {
    throw new Error('Invalid project ZIP: project.json missing');
  }

  const jsonText = await projectJsonFile.async('string');
  const pkg: ProjectExportPackage = JSON.parse(jsonText);

  if (!pkg.project || !pkg.episodes || !pkg.scenes) {
    throw new Error('Corrupt project data inside archive');
  }

  const oldToNewBlobMap = new Map<string, string>();

  // Extract all media files
  for (const manifestItem of pkg.mediaManifest || []) {
    const mediaZipFile = zip.file(manifestItem.path);
    if (mediaZipFile) {
      const blobData = await mediaZipFile.async('blob');
      const typedBlob = new Blob([blobData], { type: manifestItem.mimeType });
      const newBlobId = await saveMediaBlob(
        typedBlob,
        manifestItem.type,
        `imported_${manifestItem.path.split('/').pop()}`,
        pkg.project.id
      );
      oldToNewBlobMap.set(manifestItem.blobId, newBlobId);
    }
  }

  // Generate new IDs
  const now = Date.now();
  const newProjectId = 'proj_' + Math.random().toString(36).substring(2, 9) + now;

  const newProject: Project = {
    ...pkg.project,
    id: newProjectId,
    title: `${pkg.project.title} (Imported)`,
    thumbnailBlobId: pkg.project.thumbnailBlobId
      ? oldToNewBlobMap.get(pkg.project.thumbnailBlobId)
      : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(newProject);

  // Map Episodes
  const oldToNewEpMap = new Map<string, string>();
  for (const ep of pkg.episodes) {
    const newEpId = 'ep_' + Math.random().toString(36).substring(2, 9) + now;
    oldToNewEpMap.set(ep.id, newEpId);
    await saveEpisode({
      ...ep,
      id: newEpId,
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Map Characters
  const oldToNewCharMap = new Map<string, string>();
  for (const ch of pkg.characters || []) {
    const newCharId = 'char_' + Math.random().toString(36).substring(2, 9) + now;
    oldToNewCharMap.set(ch.id, newCharId);
    await saveCharacter({
      ...ch,
      id: newCharId,
      projectId: newProjectId,
      avatarBlobId: ch.avatarBlobId ? oldToNewBlobMap.get(ch.avatarBlobId) : undefined,
      characterSheetBlobId: ch.characterSheetBlobId
        ? oldToNewBlobMap.get(ch.characterSheetBlobId)
        : undefined,
      referenceImageBlobIds: (ch.referenceImageBlobIds || []).map(
        (id) => oldToNewBlobMap.get(id) || id
      ),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Map Scenes
  for (const sc of pkg.scenes) {
    const newSceneId = 'sc_' + Math.random().toString(36).substring(2, 9) + now;
    const mappedEpisodeId = oldToNewEpMap.get(sc.episodeId) || sc.episodeId;

    const mappedDialogue = (sc.dialogue || []).map((d) => ({
      ...d,
      audioBlobId: d.audioBlobId ? oldToNewBlobMap.get(d.audioBlobId) : undefined,
    }));

    await saveScene({
      ...sc,
      id: newSceneId,
      projectId: newProjectId,
      episodeId: mappedEpisodeId,
      characterIds: (sc.characterIds || []).map((id) => oldToNewCharMap.get(id) || id),
      dialogue: mappedDialogue,
      generatedImageBlobId: sc.generatedImageBlobId
        ? oldToNewBlobMap.get(sc.generatedImageBlobId)
        : undefined,
      generatedVideoBlobId: sc.generatedVideoBlobId
        ? oldToNewBlobMap.get(sc.generatedVideoBlobId)
        : undefined,
      generatedAudioBlobId: sc.generatedAudioBlobId
        ? oldToNewBlobMap.get(sc.generatedAudioBlobId)
        : undefined,
      referenceImageBlobIds: (sc.referenceImageBlobIds || []).map(
        (id) => oldToNewBlobMap.get(id) || id
      ),
      createdAt: now,
      updatedAt: now,
    });
  }

  return newProjectId;
}

/**
 * Creates a complete backup of all projects in IndexedDB as a single ZIP.
 */
export async function backupAllProjects(): Promise<void> {
  const projects = await getAllProjects();
  const zip = new JSZip();

  const manifest = {
    exportedAt: Date.now(),
    projectCount: projects.length,
    version: '1.0.0',
  };

  zip.file('backup_manifest.json', JSON.stringify(manifest, null, 2));

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const episodes = await getEpisodesByProject(p.id);
    const scenes = await getScenesByProject(p.id);
    const characters = await getCharactersByProject(p.id);

    const projectData = {
      project: p,
      episodes,
      scenes,
      characters,
    };

    zip.file(`project_${p.id}.json`, JSON.stringify(projectData, null, 2));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `neo_studio_full_backup_${Date.now()}.zip`);
}
