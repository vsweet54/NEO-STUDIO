import { getDB } from './index';
import { Project, Episode, Scene } from '@/types/project';
import { Character } from '@/types/character';

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex('projects', 'by-updated');
  return projects.reverse(); // Newest first
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  const updatedProject = {
    ...project,
    updatedAt: Date.now(),
  };
  await db.put('projects', updatedProject);
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['projects', 'episodes', 'scenes', 'characters', 'media_blobs', 'generation_history'],
    'readwrite'
  );

  // 1. Delete all scenes belonging to this project
  const sceneKeys = await tx.objectStore('scenes').index('by-project').getAllKeys(projectId);
  for (const key of sceneKeys) {
    await tx.objectStore('scenes').delete(key);
  }

  // 2. Delete all episodes belonging to this project
  const epKeys = await tx.objectStore('episodes').index('by-project').getAllKeys(projectId);
  for (const key of epKeys) {
    await tx.objectStore('episodes').delete(key);
  }

  // 3. Delete all characters
  const charKeys = await tx.objectStore('characters').index('by-project').getAllKeys(projectId);
  for (const key of charKeys) {
    await tx.objectStore('characters').delete(key);
  }

  // 4. Delete all media blobs associated with this project
  const blobKeys = await tx.objectStore('media_blobs').index('by-project').getAllKeys(projectId);
  for (const key of blobKeys) {
    await tx.objectStore('media_blobs').delete(key);
  }

  // 5. Delete generation history
  const histKeys = await tx.objectStore('generation_history').index('by-project').getAllKeys(projectId);
  for (const key of histKeys) {
    await tx.objectStore('generation_history').delete(key);
  }

  // 6. Delete project record
  await tx.objectStore('projects').delete(projectId);

  await tx.done;
}

export async function duplicateProject(projectId: string, newTitle?: string): Promise<Project> {
  const db = await getDB();
  const original = await db.get('projects', projectId);
  if (!original) throw new Error('Project not found');

  const newProjectId = 'proj_' + Math.random().toString(36).substring(2, 9) + Date.now();
  const now = Date.now();

  const newProject: Project = {
    ...original,
    id: newProjectId,
    title: newTitle || `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  const tx = db.transaction(['projects', 'episodes', 'scenes', 'characters'], 'readwrite');
  await tx.objectStore('projects').add(newProject);

  // Copy episodes & keep mapping
  const episodeMap = new Map<string, string>();
  const episodes = await tx.objectStore('episodes').index('by-project').getAll(projectId);
  for (const ep of episodes) {
    const newEpId = 'ep_' + Math.random().toString(36).substring(2, 9) + Date.now();
    episodeMap.set(ep.id, newEpId);
    await tx.objectStore('episodes').add({
      ...ep,
      id: newEpId,
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Copy scenes
  const scenes = await tx.objectStore('scenes').index('by-project').getAll(projectId);
  for (const sc of scenes) {
    const newSceneId = 'sc_' + Math.random().toString(36).substring(2, 9) + Date.now();
    const mappedEpId = episodeMap.get(sc.episodeId) || sc.episodeId;
    await tx.objectStore('scenes').add({
      ...sc,
      id: newSceneId,
      projectId: newProjectId,
      episodeId: mappedEpId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Copy characters
  const characters = await tx.objectStore('characters').index('by-project').getAll(projectId);
  for (const ch of characters) {
    const newCharId = 'char_' + Math.random().toString(36).substring(2, 9) + Date.now();
    await tx.objectStore('characters').add({
      ...ch,
      id: newCharId,
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    });
  }

  await tx.done;
  return newProject;
}
