import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocumentSaveInput } from './efxPaintPersistence';
import { loadEfxPaintDocuments, saveEfxPaintDocumentsWithProjectWrite } from './efxPaintPersistence';

const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

function exchangeGeneration(projectDir: string, stagingBasename: string): void {
  const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
  const canonicalRoot = `${projectDir}/cache/efx-paint`;
  const stagingFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${stagingRoot}/`))
    .map(([key, value]) => [`${canonicalRoot}${key.slice(stagingRoot.length)}`, value] as const);
  const canonicalFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${canonicalRoot}/`))
    .map(([key, value]) => [`${stagingRoot}${key.slice(canonicalRoot.length)}`, value] as const);
  const stagingDirs = Array.from(dirs)
    .filter((key) => key === stagingRoot || key.startsWith(`${stagingRoot}/`))
    .map((key) => `${canonicalRoot}${key.slice(stagingRoot.length)}`);
  const canonicalDirs = Array.from(dirs)
    .filter((key) => key === canonicalRoot || key.startsWith(`${canonicalRoot}/`))
    .map((key) => `${stagingRoot}${key.slice(canonicalRoot.length)}`);
  for (const key of Array.from(files.keys())) {
    if (key.startsWith(`${stagingRoot}/`) || key.startsWith(`${canonicalRoot}/`)) files.delete(key);
  }
  for (const key of Array.from(dirs)) {
    if (key === stagingRoot || key.startsWith(`${stagingRoot}/`) || key === canonicalRoot || key.startsWith(`${canonicalRoot}/`)) dirs.delete(key);
  }
  for (const [key, value] of [...stagingFiles, ...canonicalFiles]) files.set(key, value);
  for (const key of [...stagingDirs, ...canonicalDirs]) dirs.add(key);
}

vi.mock('./ipc', () => ({
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
  readDir: vi.fn(async (path: string) => Array.from(dirs)
    .filter((candidate) => candidate.startsWith(`${path}/`))
    .map((candidate) => candidate.slice(path.length + 1).split('/')[0])
    .filter((name, index, names) => name.length > 0 && names.indexOf(name) === index)
    .map((name) => ({ name, isDirectory: true, isFile: false, isSymlink: false }))),
  remove: vi.fn(async (path: string) => {
    for (const key of Array.from(files.keys())) {
      if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs.keys())) {
      if (key === path || key.startsWith(`${path}/`)) dirs.delete(key);
    }
  }),
  readFile: vi.fn(async (path: string) => {
    const file = files.get(path);
    if (!file) throw new Error(`missing file: ${path}`);
    return file;
  }),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    files.set(path, contents);
  }),
}));

function saveDocuments(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput>,
) {
  return saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, async () => {});
}

describe('saveEfxPaintDocumentsWithProjectWrite / loadEfxPaintDocuments', () => {
  beforeEach(async () => {
    files.clear();
    dirs.clear();
    vi.clearAllMocks();
    const { exists } = await import('@tauri-apps/plugin-fs');
    vi.mocked(exists).mockImplementation(async (path) => dirs.has(String(path)) || files.has(String(path)));
    const activeTransactions = new Map<string, string>();
    publishPhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, stagingBasename: string) => {
      const replacedExisting = dirs.has(`${projectDir}/cache/efx-paint`);
      const transactionId = crypto.randomUUID();
      activeTransactions.set(transactionId, stagingBasename);
      exchangeGeneration(projectDir, stagingBasename);
      return {
        ok: true,
        data: { accepted: true, transactionId, replacedExisting },
      };
    });
    settlePhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, transactionId: string, action: 'commit' | 'rollback') => {
      const stagingBasename = activeTransactions.get(transactionId);
      if (!stagingBasename) return { ok: false, error: 'inactive transaction' };
      if (action === 'rollback') exchangeGeneration(projectDir, stagingBasename);
      const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(`${stagingRoot}/`)) files.delete(key);
      }
      for (const key of Array.from(dirs)) {
        if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) dirs.delete(key);
      }
      activeTransactions.delete(transactionId);
      return { ok: true, data: { accepted: true, cleanupStatus: 'complete' } };
    });
  });

  it('round-trips a document through staging/commit and restores identity on load', async () => {
    const document = createEfxPaintDocument('layer-x');
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-x', { document, frames: new Map() }]]);
    const writeProject = vi.fn(async () => {});

    const persisted = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);

    // Staging writes occur under cache/.efx-paint-staging-<uuid>.
    expect(Array.from(dirs).some((path) => path.includes('/cache/.efx-paint-staging-'))).toBe(true);
    // writeProject receives the efx_paint_documents payload + transaction id.
    expect(writeProject).toHaveBeenCalledOnce();
    const [payload, transactionId] = writeProject.mock.calls[0] as [Record<string, unknown>, string | null];
    expect(transactionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload['layer-x']).toBeDefined();
    // Settle commit fires.
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith('/project', transactionId, 'commit');
    // The persisted payload is the document payload.
    expect(persisted['layer-x']).toBeDefined();

    // Load restores a document deep-equal on identity fields.
    const loaded = await loadEfxPaintDocuments('/project', payload);
    const restored = loaded.get('layer-x')!.document;
    expect(restored.version).toBe(document.version);
    expect(restored.parentLayerId).toBe(document.parentLayerId);
    expect(restored.documentRevision).toBe(document.documentRevision);
    expect(restored.activeTrackId).toBe(document.activeTrackId);
    expect(restored.tracks.map((track) => track.id)).toEqual(document.tracks.map((track) => track.id));
    expect(restored.background).toEqual(document.background);
  });

  it('fails closed when the persisted document has unknown members', async () => {
    const bad = { ...createEfxPaintDocument('layer-x'), extra: true };
    await expect(loadEfxPaintDocuments('/project', { 'layer-x': bad })).rejects.toThrow(/EfxPaintDocument: unknown members/);
  });

  it('returns an empty map when no documents are persisted', async () => {
    const loaded = await loadEfxPaintDocuments('/project', undefined);
    expect(loaded.size).toBe(0);
  });
});
