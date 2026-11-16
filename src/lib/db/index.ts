import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, Episode, Scene } from '@/types/project';
import { Character } from '@/types/character';
import { GenerationHistoryItem, MediaBlobRecord } from '@/types/generation';
import { ProviderConfig, RouterConfig } from '@/types/provider';

export interface NeoStudioDBSchema extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: {
      'by-updated': number;
      'by-category': string;
    };
  };
  episodes: {
    key: string;
    value: Episode;
    indexes: {
      'by-project': string;
      'by-number': number;
    };
  };
  scenes: {
    key: string;
    value: Scene;
    indexes: {
      'by-project': string;
      'by-episode': string;
      'by-scene-number': [string, number];
    };
  };
  characters: {
    key: string;
    value: Character;
    indexes: {
      'by-project': string;
    };
  };
  media_blobs: {
    key: string;
    value: MediaBlobRecord;
    indexes: {
      'by-project': string;
      'by-type': string;
      'by-created': number;
    };
  };
  generation_history: {
    key: string;
    value: GenerationHistoryItem;
    indexes: {
      'by-project': string;
      'by-created': number;
      'by-type': string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: any;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'neo_studio_ai_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NeoStudioDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<NeoStudioDBSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only accessible in browser environment'));
  }

  if (!dbPromise) {
    dbPromise = openDB<NeoStudioDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Projects Store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-updated', 'updatedAt');
          projectStore.createIndex('by-category', 'category');
        }

        // Episodes Store
        if (!db.objectStoreNames.contains('episodes')) {
          const episodeStore = db.createObjectStore('episodes', { keyPath: 'id' });
          episodeStore.createIndex('by-project', 'projectId');
          episodeStore.createIndex('by-number', 'episodeNumber');
        }

        // Scenes Store
        if (!db.objectStoreNames.contains('scenes')) {
          const sceneStore = db.createObjectStore('scenes', { keyPath: 'id' });
          sceneStore.createIndex('by-project', 'projectId');
          sceneStore.createIndex('by-episode', 'episodeId');
          sceneStore.createIndex('by-scene-number', ['episodeId', 'sceneNumber']);
        }

        // Characters Store
        if (!db.objectStoreNames.contains('characters')) {
          const charStore = db.createObjectStore('characters', { keyPath: 'id' });
          charStore.createIndex('by-project', 'projectId');
        }

        // Media Blobs Store
        if (!db.objectStoreNames.contains('media_blobs')) {
          const blobStore = db.createObjectStore('media_blobs', { keyPath: 'id' });
          blobStore.createIndex('by-project', 'projectId');
          blobStore.createIndex('by-type', 'type');
          blobStore.createIndex('by-created', 'createdAt');
        }

        // Generation History Store
        if (!db.objectStoreNames.contains('generation_history')) {
          const histStore = db.createObjectStore('generation_history', { keyPath: 'id' });
          histStore.createIndex('by-project', 'projectId');
          histStore.createIndex('by-created', 'createdAt');
          histStore.createIndex('by-type', 'type');
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
      blocked() {
        console.warn('Database upgrade blocked. Please close other open tabs with NEO Studio AI.');
      },
      blocking() {
        console.warn('Database connection is blocking a new version upgrade.');
      },
      terminated() {
        console.error('Database connection terminated abnormally.');
        dbPromise = null;
      },
    });
  }

  return dbPromise;
}
