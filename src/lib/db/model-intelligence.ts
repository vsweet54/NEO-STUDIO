import { getDB } from './index';
import { DiscoveredModel, ModelTestRecord, TaskSpecializationConfig } from '@/types/model-intelligence';

export async function saveDiscoveredModels(models: DiscoveredModel[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('discovered_models', 'readwrite');
  for (const model of models) {
    await tx.store.put(model);
  }
  await tx.done;
}

export async function getDiscoveredModels(): Promise<DiscoveredModel[]> {
  try {
    const db = await getDB();
    return await db.getAll('discovered_models');
  } catch (err) {
    console.error('Failed to get discovered models from IndexedDB:', err);
    return [];
  }
}

export async function getDiscoveredModelById(id: string): Promise<DiscoveredModel | undefined> {
  try {
    const db = await getDB();
    return await db.get('discovered_models', id);
  } catch (err) {
    console.error(`Failed to get model ${id} from IndexedDB:`, err);
    return undefined;
  }
}

export async function updateDiscoveredModel(
  partial: Partial<DiscoveredModel> & { id: string }
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('discovered_models', partial.id);
  if (existing) {
    const updated = { ...existing, ...partial };
    await db.put('discovered_models', updated);
  }
}

export async function saveTestRecord(record: ModelTestRecord): Promise<void> {
  const db = await getDB();
  await db.put('test_history', record);
}

export async function getTestHistory(limit = 100): Promise<ModelTestRecord[]> {
  try {
    const db = await getDB();
    const records = await db.getAllFromIndex('test_history', 'by-timestamp');
    return records.reverse().slice(0, limit);
  } catch (err) {
    console.error('Failed to get test history from IndexedDB:', err);
    return [];
  }
}

export async function saveSpecializations(configs: TaskSpecializationConfig[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('specializations', 'readwrite');
  for (const config of configs) {
    await tx.store.put(config);
  }
  await tx.done;
}

export async function getSpecializations(): Promise<TaskSpecializationConfig[]> {
  try {
    const db = await getDB();
    return await db.getAll('specializations');
  } catch (err) {
    console.error('Failed to get specializations from IndexedDB:', err);
    return [];
  }
}

export async function updateSpecialization(
  task: string,
  partial: Partial<TaskSpecializationConfig>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('specializations', task);
  if (existing) {
    const updated = { ...existing, ...partial, updatedAt: Date.now() };
    await db.put('specializations', updated);
  }
}

export async function exportIntelligenceJSON(): Promise<string> {
  const models = await getDiscoveredModels();
  const history = await getTestHistory(500);
  const specs = await getSpecializations();

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      branding: 'NEO STUDIO AI by xyrons',
      models,
      specializations: specs,
      testHistory: history,
    },
    null,
    2
  );
}

export async function exportModelsCSV(): Promise<string> {
  const models = await getDiscoveredModels();
  const headers = [
    'Model ID',
    'Provider',
    'Name',
    'Pricing',
    'Status',
    'Latency (ms)',
    'Context Tokens',
    'Roles',
    'Error Code',
  ];

  const rows = models.map((m) => [
    `"${m.id}"`,
    `"${m.provider}"`,
    `"${m.name.replace(/"/g, '""')}"`,
    `"${m.pricing.classification}"`,
    `"${m.testStatus}"`,
    m.latencyMs || 0,
    m.capabilities.maxContextTokens || 0,
    `"${m.roles.join(', ')}"`,
    `"${m.errorInfo?.code || ''}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
