/**
 * Phase 45-05 cutover test suite: the v1.0 EFX Paint document funnel, run
 * end-to-end through the 52.2-07 package save.
 *
 * Task 1 (gate): openProject refuses pre-52.2 projects end-to-end with a
 * blocking no-recourse dialog and zero store mutation (D-08, Pitfall F4).
 * Task 2 (save/load): both save paths drive the REAL `savePackage` — the
 * manifest, the layer sub-files and the media reach their canonical paths
 * through one package transaction — and open hydrates documents into
 * efxPaintStore; closeProject resets the store (DOC-05).
 * Task 3 (creation): AddFxMenu registers one spec-shaped document per
 * physic-paint layer (DOC-01/DOC-02).
 *
 * The ipc / dialog / fs modules are mocked at their Tauri boundary; the real
 * persistence funnel (save AND the 52.2-09 package loader) and the real stores
 * run, so what this suite asserts is what the app writes and reads back.
 */

import { createHash } from 'node:crypto';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { findPackageFormatRejection } from '../efx-paint/document/efxPaintCleanBreak';
import { LEGACY_PHYSIC_PAINT_REJECTED_COPY } from '../lib/efxPaintRejectionDialog';
import { settlePackageFileTokens } from '../lib/efxPaintPersistence';
import { buildFrameMediaRelativePath, buildLayerFileRelativePath, buildMachineCacheRelativePath } from '../lib/efxPaintPackage';
import type { EfxPaintPackageManifest } from '../lib/efxPaintPackage';
import type { MceProject } from '../types/project';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import * as efxPaintStoreModule from './efxPaintStore';
import { mountTrackRuntime, physicPaintStore } from './physicPaintStore';
import { projectStore } from './projectStore';
import { sequenceStore } from './sequenceStore';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

function makeMultiTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const base = document.tracks[0];
  return {
    ...document,
    activeTrackId: TRACK_A,
    tracks: [
      { ...base, id: TRACK_A, frames: {}, rotoPhysical: null, loopClips: [] },
      { ...base, id: TRACK_B, order: 1, frames: {}, rotoPhysical: null, loopClips: [] },
    ],
  };
}

// --- Hoisted mocks (module graph is imported before the test body runs) ---

const ipcProjectOpen = vi.hoisted(() => vi.fn());
const ipcProjectSave = vi.hoisted(() => vi.fn());
const ipcProjectSaveAsWithScriptLibrary = vi.hoisted(() => vi.fn());
const ipcProjectCreate = vi.hoisted(() => vi.fn());
const ipcProjectMigrateTempImages = vi.hoisted(() => vi.fn());
const ipcScriptLibraryBindSavedProject = vi.hoisted(() => vi.fn());
const ipcScriptLibraryClearActiveProject = vi.hoisted(() => vi.fn());
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const hardlinkPhysicPaintCacheFrames = vi.hoisted(() => vi.fn());
const ipcResolvePhysicPaintCacheRoot = vi.hoisted(() => vi.fn());
const ipcEfxPaintWriteFrameMedia = vi.hoisted(() => vi.fn());
// quick-260913-52r (G): the open leg materializes roto media references by
// reading each frame file through this command.
const ipcEfxPaintReadFrameMedia = vi.hoisted(() => vi.fn());
// quick-260913-05k: the package-IO boundary — the layer sub-file write/read
// and the staging discard are app commands, not fs-plugin calls.
const ipcEfxPaintWritePackageLayerFile = vi.hoisted(() => vi.fn());
const ipcEfxPaintReadPackageLayerFile = vi.hoisted(() => vi.fn());
const discardEfxPaintPackageStaging = vi.hoisted(() => vi.fn());
// quick-260913-05k (cache extension): the staging lifecycle + the commit-arm
// removal travel as app commands — the plugin refuses cache paths live.
const preparePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const stagePhysicPaintCacheFrame = vi.hoisted(() => vi.fn());
const discardPhysicPaintCacheStaging = vi.hoisted(() => vi.fn());
const removePhysicPaintCacheEntry = vi.hoisted(() => vi.fn());
const bindEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const settleEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const loadPhysicPaintData = vi.hoisted(() => vi.fn());
const prepareRotoPhysicalDocumentPngs = vi.hoisted(() => vi.fn());
const startAutoSave = vi.hoisted(() => vi.fn());
const stopAutoSave = vi.hoisted(() => vi.fn());
const addRecentProject = vi.hoisted(() => vi.fn());
const setLastProjectPath = vi.hoisted(() => vi.fn());
const savePaintData = vi.hoisted(() => vi.fn());
const loadPaintData = vi.hoisted(() => vi.fn());
const cleanupOrphanedPaintFiles = vi.hoisted(() => vi.fn());
const dialogMessage = vi.hoisted(() => vi.fn());
const fsReadFile = vi.hoisted(() => vi.fn());

/** The in-memory package filesystem the fs mock owns. */
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();
/** Every write the save performed, in order — the staging generation is gone
 *  by the time a case asserts, so the journal is the only witness. */
const writeJournal: Array<{ readonly path: string; readonly bytes: Uint8Array }> = [];
/** The machine-local derived-frame cache root (D-05/D-14). */
const CACHE_ROOT = '/machine/frame-cache/cutover-project';

vi.mock('../lib/ipc', () => ({
  projectCreate: ipcProjectCreate,
  projectSave: ipcProjectSave,
  projectSaveAsWithScriptLibrary: ipcProjectSaveAsWithScriptLibrary,
  projectOpen: ipcProjectOpen,
  projectMigrateTempImages: ipcProjectMigrateTempImages,
  scriptLibraryBindSavedProject: ipcScriptLibraryBindSavedProject,
  scriptLibraryClearActiveProject: ipcScriptLibraryClearActiveProject,
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
  hardlinkPhysicPaintCacheFrames,
  resolvePhysicPaintCacheRoot: ipcResolvePhysicPaintCacheRoot,
  ipcEfxPaintWriteFrameMedia,
  ipcEfxPaintReadFrameMedia,
  ipcEfxPaintWritePackageLayerFile,
  ipcEfxPaintReadPackageLayerFile,
  discardEfxPaintPackageStaging,
  preparePhysicPaintCacheGeneration,
  stagePhysicPaintCacheFrame,
  discardPhysicPaintCacheStaging,
  removePhysicPaintCacheEntry,
  bindEfxPaintPackageTransaction,
  publishEfxPaintPackageTransaction,
  settleEfxPaintPackageTransaction,
}));

// Keep the real module: 52.2-07 Task 3 exercises the REAL `savePackage`, and
// since 52.2-09 the open leg takes the REAL `loadEfxPaintPackage` over the same
// in-memory package filesystem.
vi.mock('../components/physic-paint/roto/rotoCanvasFrames', () => ({
  prepareRotoPhysicalDocumentPngs,
}));

vi.mock('../lib/autoSave', () => ({
  startAutoSave,
  stopAutoSave,
}));

vi.mock('../lib/appConfig', () => ({
  addRecentProject,
  setLastProjectPath,
}));

vi.mock('../lib/paintPersistence', () => ({
  savePaintData,
  loadPaintData,
  cleanupOrphanedPaintFiles,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  message: dialogMessage,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: fsReadFile,
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
  remove: vi.fn(async (path: string) => {
    for (const key of Array.from(files.keys())) {
      if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs.keys())) {
      if (key === path || key.startsWith(`${path}/`)) dirs.delete(key);
    }
  }),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    writeJournal.push({ path, bytes: contents });
    files.set(path, contents);
  }),
}));

// --- The package transaction surface, over the same in-memory filesystem ---

const activePackageTransactions = new Map<
  string,
  { readonly packageRoot: string; readonly stagingBasename: string; readonly paths: readonly string[] }
>();

function registerActivePackageTransaction(
  transactionId: string,
  packageRoot: string,
  stagingBasename: string,
  paths: readonly string[],
): void {
  activePackageTransactions.set(transactionId, { packageRoot, stagingBasename, paths });
}

function installPackageTransactionMocks(): void {
  activePackageTransactions.clear();
  // `mockClear` (the shared beforeEach) drops calls but keeps implementations
  // AND the one-shot queue, so a `mockResolvedValueOnce` from a previous case
  // would leak into this one. Reset first, then install.
  ipcEfxPaintWriteFrameMedia.mockReset();
  ipcProjectSave.mockReset();
  bindEfxPaintPackageTransaction.mockReset();
  publishEfxPaintPackageTransaction.mockReset();
  settleEfxPaintPackageTransaction.mockReset();
  ipcEfxPaintWritePackageLayerFile.mockReset();
  ipcEfxPaintReadPackageLayerFile.mockReset();
  discardEfxPaintPackageStaging.mockReset();
  ipcEfxPaintWritePackageLayerFile.mockImplementation(
    async (packageDir: string, stagingBasename: string, layerFile: string, contents: string) => {
      const path = `${packageDir}/${stagingBasename}/${layerFile}`;
      const bytes = new TextEncoder().encode(contents);
      writeJournal.push({ path, bytes });
      files.set(path, bytes);
      dirs.add(`${packageDir}/${stagingBasename}`);
      return { ok: true, data: null };
    },
  );
  ipcEfxPaintReadPackageLayerFile.mockImplementation(async (packageDir: string, layerFile: string) => {
    const bytes = files.get(`${packageDir}/${layerFile}`);
    if (bytes === undefined) return { ok: false, error: { kind: 'missing' } };
    return { ok: true, data: new TextDecoder().decode(bytes) };
  });
  discardEfxPaintPackageStaging.mockImplementation(async (packageDir: string, stagingBasename: string) => {
    const root = `${packageDir}/${stagingBasename}`;
    for (const key of Array.from(files.keys())) {
      if (key === root || key.startsWith(`${root}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs)) {
      if (key === root || key.startsWith(`${root}/`)) dirs.delete(key);
    }
    return { ok: true, data: null };
  });
  ipcEfxPaintWriteFrameMedia.mockImplementation(
    async (packageDir: string, layerId: string, keyId: string, bytes: Uint8Array, stagingBasename?: string) => {
      const relativePath = buildFrameMediaRelativePath(layerId, keyId);
      const root = stagingBasename === undefined ? packageDir : `${packageDir}/${stagingBasename}`;
      writeJournal.push({ path: `${root}/${relativePath}`, bytes });
      files.set(`${root}/${relativePath}`, bytes);
      return {
        ok: true,
        data: {
          relativePath,
          digest: createHash('sha256').update(bytes).digest('hex'),
          byteLength: bytes.length,
        },
      };
    },
  );
  ipcProjectSave.mockImplementation(async (project: MceProject, path: string) => {
    writeJournal.push({ path, bytes: new TextEncoder().encode(JSON.stringify(project)) });
    files.set(path, new TextEncoder().encode(JSON.stringify(project)));
    return { ok: true, data: null };
  });
  bindEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, stagingBasename: string, paths: string[]) => {
      const transactionId = crypto.randomUUID();
      registerActivePackageTransaction(transactionId, packageRoot, stagingBasename, paths);
      return {
        ok: true,
        data: {
          transactionId,
          aggregateDigest: createHash('sha256').update(paths.join(' ')).digest('hex'),
          entries: [],
        },
      };
    },
  );
  publishEfxPaintPackageTransaction.mockImplementation(async (packageRoot: string, transactionId: string) => {
    const transaction = activePackageTransactions.get(transactionId);
    if (!transaction) return { ok: false, error: 'inactive transaction' };
    let published = 0;
    for (const path of transaction.paths) {
      const staged = files.get(`${transaction.packageRoot}/${transaction.stagingBasename}/${path}`);
      if (staged === undefined) continue;
      files.set(`${packageRoot}/${path}`, staged);
      published += 1;
    }
    return { ok: true, data: { transactionId, published } };
  });
  settleEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, transactionId: string, _action: 'commit' | 'rollback') => {
      const transaction = activePackageTransactions.get(transactionId);
      if (!transaction) return { ok: false, error: 'inactive transaction' };
      activePackageTransactions.delete(transactionId);
      const stagingRoot = `${packageRoot}/${transaction.stagingBasename}`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(`${stagingRoot}/`)) files.delete(key);
      }
      for (const key of Array.from(dirs)) {
        if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) dirs.delete(key);
      }
      return { ok: true, data: { cleanupDeferred: false } };
    },
  );
}

/**
 * The machine-local derived-frame cache leg (D-05/D-14), over the same
 * in-memory filesystem: a resolve, an atomic generation swap, and the
 * hardlink of unchanged sidecars. It never rides the authoritative set.
 */
function installCacheLegMocks(): void {
  const activeTransactions = new Map<string, string>();
  publishPhysicPaintCacheGeneration.mockReset();
  settlePhysicPaintCacheGeneration.mockReset();
  hardlinkPhysicPaintCacheFrames.mockReset();
  preparePhysicPaintCacheGeneration.mockReset();
  stagePhysicPaintCacheFrame.mockReset();
  discardPhysicPaintCacheStaging.mockReset();
  removePhysicPaintCacheEntry.mockReset();
  ipcResolvePhysicPaintCacheRoot.mockReset();
  ipcResolvePhysicPaintCacheRoot.mockResolvedValue({ ok: true, data: CACHE_ROOT });
  publishPhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    const replacedExisting = dirs.has(`${cacheRoot}/efx-paint`);
    const transactionId = crypto.randomUUID();
    activeTransactions.set(transactionId, stagingBasename);
    exchangeGeneration(cacheRoot, stagingBasename);
    return { ok: true, data: { accepted: true, transactionId, replacedExisting } };
  });
  settlePhysicPaintCacheGeneration.mockImplementation(
    async (cacheRoot: string, transactionId: string, action: 'commit' | 'rollback') => {
      const stagingBasename = activeTransactions.get(transactionId);
      if (!stagingBasename) return { ok: false, error: 'inactive transaction' };
      if (action === 'rollback') exchangeGeneration(cacheRoot, stagingBasename);
      const stagingRoot = `${cacheRoot}/${stagingBasename}`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(`${stagingRoot}/`)) files.delete(key);
      }
      activeTransactions.delete(transactionId);
      return { ok: true, data: { accepted: true, cleanupStatus: 'complete' } };
    },
  );
  hardlinkPhysicPaintCacheFrames.mockImplementation(
    async (cacheRoot: string, stagingBasename: string, unchangedPaths: string[]) => {
      const canonicalRoot = `${cacheRoot}/efx-paint`;
      const stagingRoot = `${cacheRoot}/${stagingBasename}`;
      const missing: string[] = [];
      for (const relative of unchangedPaths) {
        const bytes = files.get(`${canonicalRoot}/${relative}`);
        if (bytes === undefined) missing.push(relative);
        else files.set(`${stagingRoot}/${relative}`, bytes);
      }
      return { ok: true, data: { accepted: true, missing } };
    },
  );
  // quick-260913-05k (cache extension): the staging lifecycle over the same
  // in-memory filesystem; stage writes join the journal like the plugin-fs
  // writes they replace.
  preparePhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    dirs.add(cacheRoot);
    dirs.add(`${cacheRoot}/${stagingBasename}`);
    return { ok: true, data: { accepted: true } };
  });
  stagePhysicPaintCacheFrame.mockImplementation(
    async (cacheRoot: string, stagingBasename: string, relativePath: string, bytes: Uint8Array) => {
      const path = `${cacheRoot}/${stagingBasename}/${relativePath}`;
      writeJournal.push({ path, bytes });
      files.set(path, bytes);
      return { ok: true, data: { accepted: true } };
    },
  );
  discardPhysicPaintCacheStaging.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    const root = `${cacheRoot}/${stagingBasename}`;
    for (const key of Array.from(files.keys())) {
      if (key.startsWith(`${root}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs)) {
      if (key === root || key.startsWith(`${root}/`)) dirs.delete(key);
    }
    return { ok: true, data: null };
  });
  removePhysicPaintCacheEntry.mockImplementation(async (cacheRoot: string, relative: string) => {
    const target = `${cacheRoot}/${relative}`;
    for (const key of Array.from(files.keys())) {
      if (key === target || key.startsWith(`${target}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs)) {
      if (key === target || key.startsWith(`${target}/`)) dirs.delete(key);
    }
    return { ok: true, data: null };
  });
}

/**
 * Every per-test piece of package state: the in-memory disk and the module's
 * committed token baseline. The baseline is process state, so a stale map from
 * the previous case would make this case's save look unchanged and skip its
 * writes.
 */
function clearPackageDisk(): void {
  files.clear();
  dirs.clear();
  writeJournal.length = 0;
  settlePackageFileTokens('commit', new Map());
}

/** Read one JSON file out of the in-memory package. */
function readJson(path: string): Record<string, unknown> {
  const bytes = files.get(path);
  if (bytes === undefined) throw new Error(`missing file: ${path}`);
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

/** The bytes of the last staged write whose path ends with `suffix`. */
function lastWrite(suffix: string): string {
  const entry = [...writeJournal].reverse().find((write) => write.path.endsWith(suffix));
  if (entry === undefined) throw new Error(`no write ends with ${suffix}`);
  return new TextDecoder().decode(entry.bytes);
}

function exchangeGeneration(cacheRoot: string, stagingBasename: string): void {
  const stagingRoot = `${cacheRoot}/${stagingBasename}`;
  const canonicalRoot = `${cacheRoot}/efx-paint`;
  const stagingFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${stagingRoot}/`))
    .map(([key, value]) => [`${canonicalRoot}${key.slice(stagingRoot.length)}`, value] as const);
  const canonicalFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${canonicalRoot}/`))
    .map(([key, value]) => [`${stagingRoot}${key.slice(canonicalRoot.length)}`, value] as const);
  for (const key of Array.from(files.keys())) {
    if (key.startsWith(`${stagingRoot}/`) || key.startsWith(`${canonicalRoot}/`)) files.delete(key);
  }
  for (const [key, value] of [...stagingFiles, ...canonicalFiles]) files.set(key, value);
}

// --- Fixtures ---

/**
 * A pre-52.2 project (D-08 clean break): the last main-editor version with no
 * `formatVersion`, so the gate refuses it as an older format whatever else the
 * file carries.
 */
function makeLegacyProject(): MceProject {
  return {
    version: 15,
    name: 'Legacy Project',
    fps: 24,
    width: 1920,
    height: 1080,
    created_at: '2026-01-01',
    modified_at: '2026-01-01',
    sequences: [],
    images: [],
  };
}

const CLEAN_PROJECT_ID = '3f2b7c1e-9a4d-4c8b-8f0e-2d6a5b4c3d2e';

/** A v1.0 package manifest: the current `formatVersion` + the package identity. */
function makeCleanProject(): MceProject {
  return {
    version: 16,
    name: 'Clean Project',
    fps: 24,
    width: 1920,
    height: 1080,
    created_at: '2026-01-01',
    modified_at: '2026-01-01',
    sequences: [],
    images: [],
    formatVersion: 1,
    projectId: CLEAN_PROJECT_ID,
    efxPaint: {},
  };
}

/**
 * A deep snapshot of every store an open can touch. A refused open that had
 * half-applied anything would show up here as a diff — the Phase 45
 * hybrid-state failure this gate exists to prevent (T-52.2-25).
 */
function openStateSnapshot(): unknown {
  return structuredClone({
    name: projectStore.name.value,
    fps: projectStore.fps.value,
    width: projectStore.width.value,
    height: projectStore.height.value,
    filePath: projectStore.filePath.value,
    dirPath: projectStore.dirPath.value,
    isDirty: projectStore.isDirty.value,
    scriptLibraryAuthority: projectStore.scriptLibraryAuthority.value,
    projectContextId: projectStore.projectContextId.value,
    sequences: sequenceStore.sequences.value,
  });
}

describe('45-05 Task 1: clean-break rejection gate in openProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    sequenceStore.reset();
    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeCleanProject() });
    loadPhysicPaintData.mockResolvedValue([]);
    ipcResolvePhysicPaintCacheRoot.mockResolvedValue({ ok: true, data: CACHE_ROOT });
    prepareRotoPhysicalDocumentPngs.mockImplementation(async (value: unknown) => value);
    ipcScriptLibraryBindSavedProject.mockResolvedValue({ ok: true, data: 'authority' });
    ipcScriptLibraryClearActiveProject.mockResolvedValue({ ok: true, data: null });
    addRecentProject.mockResolvedValue(undefined);
    setLastProjectPath.mockResolvedValue(undefined);
    dialogMessage.mockResolvedValue('Ok');
    fsReadFile.mockRejectedValue(new Error('unexpected readFile in test'));
    vi.spyOn(projectStore, 'closeProject');
  });

  it('rejects a pre-52.2 project with a blocking dialog and zero downstream invocation', async () => {
    const before = openStateSnapshot();
    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeLegacyProject() });

    await projectStore.openProject('/project/legacy.mce');

    expect(dialogMessage).toHaveBeenCalledTimes(1);
    expect(dialogMessage).toHaveBeenCalledWith(LEGACY_PHYSIC_PAINT_REJECTED_COPY, {
      title: 'EFX Motion Editor',
      kind: 'error',
      buttons: 'Ok',
    });
    // Zero mutation: nothing downstream of the gate runs.
    expect(projectStore.closeProject).not.toHaveBeenCalled();
    expect(loadPhysicPaintData).not.toHaveBeenCalled();
    expect(startAutoSave).not.toHaveBeenCalled();
    expect(ipcScriptLibraryBindSavedProject).not.toHaveBeenCalled();
    expect(addRecentProject).not.toHaveBeenCalled();
    expect(setLastProjectPath).not.toHaveBeenCalled();
    // The previously open project state is untouched (no hydration).
    expect(projectStore.name.value).toBe('Untitled Project');
    expect(sequenceStore.sequences.value).toHaveLength(0);
    // ...and the whole state is DEEP-equal to its pre-call value: a refusal
    // that half-applied anything would fail here (T-52.2-25).
    expect(openStateSnapshot()).toStrictEqual(before);
  });

  it('a refused open leaves an already-open project deep-unchanged (T-52.2-25)', async () => {
    // A live project first: the refused open must not half-overwrite it.
    await projectStore.openProject('/project/clean.mce');
    const live = openStateSnapshot();
    expect(projectStore.name.value).toBe('Clean Project');

    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeLegacyProject() });
    await projectStore.openProject('/project/legacy.mce');

    expect(dialogMessage).toHaveBeenCalledTimes(1);
    // Same live project, byte for byte: no partial load, no hybrid state.
    expect(openStateSnapshot()).toStrictEqual(live);
  });

  it('opens a clean project through the normal hydration path exactly as today', async () => {
    await projectStore.openProject('/project/clean.mce');

    expect(dialogMessage).not.toHaveBeenCalled();
    expect(projectStore.closeProject).toHaveBeenCalledTimes(1);
    // A manifest with an empty `efxPaint` index reads no layer sub-file at all
    // (52.2-09): the open installs zero documents rather than probing disk.
    expect(fsReadFile).not.toHaveBeenCalled();
    expect(startAutoSave).toHaveBeenCalledTimes(1);
    expect(ipcScriptLibraryBindSavedProject).toHaveBeenCalledTimes(1);
    expect(addRecentProject).toHaveBeenCalledTimes(1);
    expect(setLastProjectPath).toHaveBeenCalledTimes(1);
    // Hydration ran: the project name is live in the store.
    expect(projectStore.name.value).toBe('Clean Project');
  });

  it('exports an explicit no-recourse copy naming EFX Physic Paint, pre-v1.0, and the impossibility of opening', () => {
    expect(typeof LEGACY_PHYSIC_PAINT_REJECTED_COPY).toBe('string');
    expect(LEGACY_PHYSIC_PAINT_REJECTED_COPY).toMatch(/EFX Physic Paint/i);
    expect(LEGACY_PHYSIC_PAINT_REJECTED_COPY).toMatch(/pre-v1\.0/i);
    expect(LEGACY_PHYSIC_PAINT_REJECTED_COPY).toMatch(/cannot be opened|cannot open/i);
  });

  it('behaves identically on a second open attempt of a rejected file (stateless gate)', async () => {
    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeLegacyProject() });

    await projectStore.openProject('/project/legacy.mce');
    await projectStore.openProject('/project/legacy.mce');

    expect(dialogMessage).toHaveBeenCalledTimes(2);
    expect(projectStore.closeProject).not.toHaveBeenCalled();
    expect(loadPhysicPaintData).not.toHaveBeenCalled();
    expect(startAutoSave).not.toHaveBeenCalled();
    expect(projectStore.name.value).toBe('Untitled Project');
  });

  it('the gate predicate itself is the pure formatVersion scan (52.2-08 D-08)', () => {
    expect(findPackageFormatRejection(makeLegacyProject(), { pathKind: 'directory' }))
      .toEqual({ kind: 'missing-format-version' });
    expect(findPackageFormatRejection(makeCleanProject(), { pathKind: 'directory' })).toBeNull();
    // The other half of the contract: a plain file is the pre-52.2 layout, and
    // the layout decides before the content is judged — `openProject` passes
    // 'directory' because a package open reads a directory (plan 11).
    expect(findPackageFormatRejection(makeCleanProject(), { pathKind: 'file' }))
      .toEqual({ kind: 'old-project-layout' });
  });
});

// --- Task 2 helpers ---

const makeFrame = (frameIndex: number, appFrame: number): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  bytes: testWebpBytes(btoa(`frame-${frameIndex}`)),
  width: 100,
  height: 50,
});

/** Add one fx sequence carrying a physic-paint layer keyed by layerId. */
function addPhysicPaintLayer(layerId: string): void {
  sequenceStore.add({
    id: 'seq-1',
    kind: 'fx',
    name: 'Physics Paint',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [{
      id: `layer-${layerId}`,
      name: 'Physics Paint',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'physic-paint', layerId },
    }],
    inFrame: 0,
    outFrame: 24,
  });
}

/**
 * Register a document on `layerId` and seed one REAL roto key carrying raster
 * bytes — the authoritative media the package save writes. A document with no
 * roto records has no authoritative media at all (its frames are derived-frame
 * cache references), which is exactly the D-09 split this fixture exercises on
 * both sides.
 */
function seedRotoKeyWithMedia(layerId: string, keyId: string, tag: string, appFrame = 0): void {
  addPhysicPaintLayer(layerId);
  efxPaintStoreModule.registerDocument(makeTrackDocument(layerId));
  mountTrackRuntime(layerId, TEST_TRACK_ID);
  const seeded = physicPaintStore.replaceRotoPhysicalRecords(
    layerId,
    TEST_TRACK_ID,
    [{
      kind: 'real-key',
      keyId,
      appFrame,
      payload: { frameIndex: 0, appFrame, bytes: testWebpBytes(btoa(tag)), width: 4, height: 4 },
    }],
    { enabled: false, mode: 'duplicate' },
    24,
  );
  if (!seeded.ok) throw new Error(`Seed failed for ${layerId}: ${seeded.error}`);
}

describe('45-05 Task 2: v1.0 document save/load funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    sequenceStore.reset();
    physicPaintStore.reset();
    efxPaintStoreModule.reset();
    projectStore.filePath.value = null;
    projectStore.dirPath.value = null;
    clearPackageDisk();
    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeCleanProject() });
    ipcProjectSave.mockResolvedValue({ ok: true, data: null });
    ipcProjectSaveAsWithScriptLibrary.mockResolvedValue({ ok: true, data: { diagnostics: [] } });
    ipcScriptLibraryBindSavedProject.mockResolvedValue({ ok: true, data: 'authority' });
    ipcScriptLibraryClearActiveProject.mockResolvedValue({ ok: true, data: null });
    addRecentProject.mockResolvedValue(undefined);
    setLastProjectPath.mockResolvedValue(undefined);
    savePaintData.mockResolvedValue(undefined);
    cleanupOrphanedPaintFiles.mockResolvedValue(undefined);
    loadPhysicPaintData.mockResolvedValue([]);
    prepareRotoPhysicalDocumentPngs.mockImplementation(async (value: unknown) => value);
    installPackageTransactionMocks();
    installCacheLegMocks();
    fsReadFile.mockImplementation(async (path: string) => {
      const bytes = files.get(String(path));
      if (bytes === undefined) throw new Error(`missing file: ${String(path)}`);
      return bytes;
    });
    vi.spyOn(projectStore, 'closeProject');
  });

  it('saveProject stages the package and commits manifest + layer sub-file through one transaction', async () => {
    addPhysicPaintLayer('layer-1');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    // The manifest write takes the project and the PATH ONLY — the dead cache
    // transaction id plan 05 left behind is gone from both call sites
    // (52.2-07 Task 3; the assertion at ipcProjectSave.mock.calls[0] below is
    // the retarget of the three-argument destructuring).
    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    const saveCall = ipcProjectSave.mock.calls[0] as unknown[];
    expect(saveCall).toHaveLength(2);
    const [savedProject, stagedManifestPath] = saveCall as [EfxPaintPackageManifest, string];
    expect(stagedManifestPath).toMatch(/^\/project\/\.efx-paint-package-staging-[^/]+\/project\.mce$/);
    // D-04: the manifest is a pure index — the layer content lives in its own
    // sub-file, never in the project file.
    expect(savedProject.efx_paint_documents).toBeUndefined();
    expect(savedProject.formatVersion).toBe(1);
    expect(savedProject.projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(savedProject.efxPaint).toEqual({ 'layer-1': expect.objectContaining({ layerFile: 'layers/layer-1.json' }) });

    // The staged set reached its canonical paths only through the transaction:
    // bound once, published, committed.
    expect(bindEfxPaintPackageTransaction).toHaveBeenCalledTimes(1);
    const [, stagingBasename, boundPaths] = bindEfxPaintPackageTransaction.mock.calls[0] as [string, string, string[]];
    expect(stagingBasename).toMatch(/^\.efx-paint-package-staging-/);
    expect(boundPaths).toContain('project.mce');
    expect(boundPaths).toContain('layers/layer-1.json');
    expect(publishEfxPaintPackageTransaction).toHaveBeenCalledTimes(1);
    expect(settleEfxPaintPackageTransaction.mock.calls[0]?.[2]).toBe('commit');
    expect(readJson('/project/project.mce')).toMatchObject({ formatVersion: 1 });
    const publishedLayer = readJson('/project/layers/layer-1.json');
    expect(publishedLayer).toMatchObject({ parentLayerId: 'layer-1' });
    // 52.2-07 Task 2: the runtime frame was projected into the document's
    // default track as a MACHINE-RELATIVE reference — never the legacy
    // package-relative `cache/efx-paint/...` shape (T-52.2-56).
    const publishedTracks = publishedLayer.tracks as Array<{ frames: Record<string, { cachePath: string }> }>;
    const cachePath = Object.values(publishedTracks[0].frames)[0].cachePath;
    expect(cachePath).toMatch(/^efx-paint\//);
    expect(cachePath.startsWith('/')).toBe(false);
    // Nothing canonical is written outside the transaction: the canonical
    // package root holds no staging generation.
    for (const path of files.keys()) expect(path).not.toContain('/.efx-paint-package-staging-');
  });

  it('saveProjectAs performs the identical package switch on its call path', async () => {
    addPhysicPaintLayer('layer-1');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    projectStore.filePath.value = '/project/old.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProjectAs('/project/new.mce');

    expect(ipcProjectSaveAsWithScriptLibrary).toHaveBeenCalledTimes(1);
    // Retargeted from the four-tuple: the cache transaction id is gone.
    const saveAsCall = ipcProjectSaveAsWithScriptLibrary.mock.calls[0] as unknown[];
    expect(saveAsCall).toHaveLength(3);
    const [manifest, source, destination] = saveAsCall as [EfxPaintPackageManifest, string, string];
    expect(source).toBe('/project/old.mce');
    expect(destination).toBe('/project/new.mce');
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.efx_paint_documents).toBeUndefined();
    // The destination package published the same files the manifest indexes.
    expect(Object.keys(readJson('/project/layers/layer-1.json')).length).toBeGreaterThan(0);
    // A freshly saved v1.0 project must surface in Recents (R4).
    expect(addRecentProject).toHaveBeenCalledTimes(1);
    expect(addRecentProject).toHaveBeenCalledWith(expect.objectContaining({ path: '/project/new.mce' }));
    expect(setLastProjectPath).toHaveBeenCalledWith('/project/new.mce');
  });

  it('buildMceProject writes version 16', () => {
    expect(projectStore.buildMceProject().version).toBe(16);
  });

  it('openProject hydrates efxPaintStore from the layer sub-file the manifest indexes, reference-only', async () => {
    const document = makeTrackDocument('layer-1');
    const track = document.tracks[0];
    const cachePath = buildMachineCacheRelativePath('layer-1', TEST_TRACK_ID, 0);
    const withFrame = {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath, width: 100, height: 50 } } }],
    };
    // The package the open reads: the layer document lives in its own sub-file
    // and the manifest only INDEXES it (D-04). The frame value is the D-05/D-14
    // machine-RELATIVE derived-frame reference — never a raster, and never the
    // legacy package-relative `cache/efx-paint/...` shape.
    files.set(
      `/project/${buildLayerFileRelativePath('layer-1')}`,
      new TextEncoder().encode(JSON.stringify(withFrame)),
    );
    ipcProjectOpen.mockResolvedValue({
      ok: true,
      data: {
        ...makeCleanProject(),
        efxPaint: {
          'layer-1': {
            layerFile: buildLayerFileRelativePath('layer-1'),
            documentRevision: '0',
            compositeRevision: '0',
          },
        },
      },
    });

    await projectStore.openProject('/project/v1.mce');

    expect(efxPaintStoreModule.getDocument('layer-1')).toBeDefined();
    // The reference survives the round trip verbatim — the open recomputes its
    // machine-local location, it never rewrites the persisted reference.
    expect(efxPaintStoreModule.getDocument('layer-1')?.tracks[0].frames[0]?.cachePath).toBe(cachePath);
    // Reference-only (D-06/D-14): the runtime holds NO frame bytes after an
    // open. The derived frames re-derive from the cache when the Studio asks
    // for them, so an open prefetching raster would be a leak, not a speedup.
    expect(physicPaintStore.getFrames('layer-1', TEST_TRACK_ID).size).toBe(0);
  });

  it('openProject materializes roto media references into the runtime while the registered document stays reference-only (quick-260913-52r G)', async () => {
    const bytes = testWebpBytes('reopen-g');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const relativePath = buildFrameMediaRelativePath('layer-1', 'key-r');
    const realKeyRecords = [{
      kind: 'real-key' as const,
      keyId: 'key-r',
      appFrame: 0,
      payload: {
        frameIndex: 0,
        appFrame: 0,
        media: { relativePath, digest, width: 8, height: 8 },
        width: 8,
        height: 8,
      },
    }];
    const document = makeTrackDocument('layer-1');
    const track = document.tracks[0];
    const withRoto = {
      ...document,
      tracks: [{
        ...track,
        rotoPhysical: {
          capacity: 24,
          realKeyRecords,
          groupOverrideRecords: [],
          interpolation: { enabled: false, mode: 'duplicate' as const },
          scriptMotion: { deformation: 0, position: 0 },
          background: null,
          selectedKeyId: null,
          cursorAppFrame: 0,
          loopClips: [],
          incomingInterpolationBreakKeyIds: [],
          revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, { enabled: false, mode: 'duplicate' }, [], [], []),
        },
      }],
    };
    files.set(
      `/project/${buildLayerFileRelativePath('layer-1')}`,
      new TextEncoder().encode(JSON.stringify(withRoto)),
    );
    ipcProjectOpen.mockResolvedValue({
      ok: true,
      data: {
        ...makeCleanProject(),
        efxPaint: {
          'layer-1': {
            layerFile: buildLayerFileRelativePath('layer-1'),
            documentRevision: '0',
            compositeRevision: '0',
          },
        },
      },
    });
    ipcEfxPaintReadFrameMedia.mockResolvedValue({ ok: true, data: { bytes, digest } });

    await projectStore.openProject('/project/v1.mce');

    // G: the runtime carries the verified bytes — the authority frames
    // projection, the launch pack and the engine all require inline bytes.
    expect(ipcEfxPaintReadFrameMedia).toHaveBeenCalledWith('/project', relativePath);
    const runtimeRecords = physicPaintStore.getRotoRealKeyRecords('layer-1', TEST_TRACK_ID);
    expect(runtimeRecords).toHaveLength(1);
    expect(runtimeRecords[0]!.payload.bytes).toBe(bytes);
    expect(runtimeRecords[0]!.payload.media).toBeUndefined();
    // The registered DOCUMENT keeps the persisted reference-only shape — the
    // materialization is a runtime projection, never a document rewrite.
    const registered = efxPaintStoreModule.getDocument('layer-1')!;
    const registeredPayload = registered.tracks[0]!.rotoPhysical!.realKeyRecords[0]!.payload;
    expect(registeredPayload.media).toBeDefined();
    expect((registeredPayload as { bytes?: unknown }).bytes).toBeUndefined();
  });

  it('openProject reports an unreadable frame media reference loudly and keeps the record reference-only (quick-260913-52r G)', async () => {
    const digest = createHash('sha256').update(testWebpBytes('lost')).digest('hex');
    const relativePath = buildFrameMediaRelativePath('layer-1', 'key-lost');
    const realKeyRecords = [{
      kind: 'real-key' as const,
      keyId: 'key-lost',
      appFrame: 0,
      payload: {
        frameIndex: 0,
        appFrame: 0,
        media: { relativePath, digest, width: 8, height: 8 },
        width: 8,
        height: 8,
      },
    }];
    const document = makeTrackDocument('layer-1');
    const track = document.tracks[0];
    const withRoto = {
      ...document,
      tracks: [{
        ...track,
        rotoPhysical: {
          capacity: 24,
          realKeyRecords,
          groupOverrideRecords: [],
          interpolation: { enabled: false, mode: 'duplicate' as const },
          scriptMotion: { deformation: 0, position: 0 },
          background: null,
          selectedKeyId: null,
          cursorAppFrame: 0,
          loopClips: [],
          incomingInterpolationBreakKeyIds: [],
          revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, { enabled: false, mode: 'duplicate' }, [], [], []),
        },
      }],
    };
    files.set(
      `/project/${buildLayerFileRelativePath('layer-1')}`,
      new TextEncoder().encode(JSON.stringify(withRoto)),
    );
    ipcProjectOpen.mockResolvedValue({
      ok: true,
      data: {
        ...makeCleanProject(),
        efxPaint: {
          'layer-1': {
            layerFile: buildLayerFileRelativePath('layer-1'),
            documentRevision: '0',
            compositeRevision: '0',
          },
        },
      },
    });
    ipcEfxPaintReadFrameMedia.mockResolvedValue({ ok: false, error: { kind: 'missing' } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await projectStore.openProject('/project/v1.mce');

    // The failure is surfaced by name — never silent — and the open proceeds.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(relativePath));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('missing'));
    const runtimeRecords = physicPaintStore.getRotoRealKeyRecords('layer-1', TEST_TRACK_ID);
    expect(runtimeRecords[0]!.payload.media).toBeDefined();
    expect(runtimeRecords[0]!.payload.bytes).toBeUndefined();
    errorSpy.mockRestore();
  });

  it('closeProject resets efxPaintStore so no document leaks across projects', () => {
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    const resetSpy = vi.spyOn(efxPaintStoreModule, 'reset');

    projectStore.closeProject();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(efxPaintStoreModule.hasDocument('layer-1')).toBe(false);
  });

  it('a save with no physic-paint layers still commits a manifest with an empty layer index', async () => {
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    // The manifest is still staged (its own token changed), but it indexes no
    // layer and carries no layer content — not even an empty carrier object.
    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    const [savedProject] = ipcProjectSave.mock.calls[0] as [EfxPaintPackageManifest, string];
    expect(savedProject.efxPaint).toEqual({});
    expect(savedProject.efx_paint_documents).toBeUndefined();
    // No layer sub-file is staged or published for a layer-less project.
    expect([...files.keys()].some((path) => path.includes('/layers/'))).toBe(false);
  });

  it('a second identical save is a true no-op: no bind, no publish, no manifest write (D-11/T-52.2-23)', async () => {
    addPhysicPaintLayer('layer-1');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();
    const canonicalBefore = files.get('/project/layers/layer-1.json');
    ipcProjectSave.mockClear();
    bindEfxPaintPackageTransaction.mockClear();
    publishEfxPaintPackageTransaction.mockClear();
    settleEfxPaintPackageTransaction.mockClear();
    writeJournal.length = 0;

    await projectStore.saveProject();

    expect(ipcProjectSave).not.toHaveBeenCalled();
    expect(bindEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(publishEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(settleEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(writeJournal).toHaveLength(0);
    expect(files.get('/project/layers/layer-1.json')).toEqual(canonicalBefore);
  });

  it('every media write carries the staging basename and no request targets a canonical frames/ path', async () => {
    seedRotoKeyWithMedia('layer-1', 'key-1', 'media@0');
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    const writeCalls = ipcEfxPaintWriteFrameMedia.mock.calls as unknown as unknown[][];
    expect(writeCalls).toHaveLength(1);
    const [packageDir, layerId, keyId, bytes, stagingBasename] = writeCalls[0] as [
      string,
      string,
      string,
      Uint8Array,
      string,
    ];
    expect(packageDir).toBe('/project');
    expect(layerId).toBe('layer-1');
    expect(keyId).toBe('key-1');
    expect(bytes.length).toBeGreaterThan(0);
    // The write is addressed AT THE STAGING GENERATION: the basename rides the
    // call, so no request can land on a canonical frames/ path (D-10).
    expect(stagingBasename).toMatch(/^\.efx-paint-package-staging-/);
    // No write in the whole save targeted a canonical frames/ path: the media
    // bytes landed inside the staging generation and nowhere else.
    const mediaWrite = writeJournal.find((write) => write.path.includes('/frames/layer-1/key-1.webp'));
    expect(mediaWrite?.path).toMatch(
      /^\/project\/\.efx-paint-package-staging-[^/]+\/frames\/layer-1\/key-1\.webp$/,
    );
    // The media reached its canonical path only through the publish step.
    expect(files.has('/project/frames/layer-1/key-1.webp')).toBe(true);
    expect(writeJournal.filter((write) => write.path.startsWith('/project/frames/'))).toHaveLength(0);
  });

  it('the declared package surface carries no payload or machine-local path (the staged strings this save produced)', async () => {
    addPhysicPaintLayer('layer-1');
    const document = makeTrackDocument('layer-1');
    efxPaintStoreModule.registerDocument(document);
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    const stagedSubFile = lastWrite('/layers/layer-1.json');
    // T-52.2-22: no raster payload rides emitted JSON — a base64 run of 512+
    // characters is the shape a leaked raster takes.
    expect(stagedSubFile).not.toMatch(/[A-Za-z0-9+/]{512,}={0,2}/);
    // No absolute, backslash or drive-letter path survives into the package.
    expect(stagedSubFile).not.toMatch(/"\/[^"]*"/);
    expect(stagedSubFile).not.toContain('\\\\');
    expect(stagedSubFile).not.toMatch(/[A-Za-z]:[\\/]/);
    // The persisted sub-file is what the read-back leg reopens: media
    // references only, both roto collections.
    const persisted = JSON.parse(stagedSubFile) as Record<string, unknown>;
    expect(persisted.parentLayerId).toBe('layer-1');
  });

  it('a refused package publish leaves the canonical package byte-identical (T-52.2-21)', async () => {
    seedRotoKeyWithMedia('layer-1', 'key-1', 'first@0');
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    // First save commits the package.
    await projectStore.saveProject();
    const packageSnapshot = new Map(
      [...files.entries()].filter(([path]) => path.startsWith('/project/')),
    );
    expect(packageSnapshot.size).toBeGreaterThan(0);

    // The second save changes an authoritative key (new bytes → new token),
    // then the publish refuses.
    seedRotoKeyWithMedia('layer-1', 'key-1', 'second@0');
    const writesBefore = writeJournal.length;
    publishEfxPaintPackageTransaction.mockImplementationOnce(async () => ({ ok: false, error: 'publish refused' }));

    await expect(projectStore.saveProject()).rejects.toThrow('publish refused');

    // Byte-identical: the staged writes never reached a canonical path, and
    // the staging generation was cleaned up.
    const packageAfter = new Map([...files.entries()].filter(([path]) => path.startsWith('/project/')));
    expect(packageAfter).toEqual(packageSnapshot);
    expect(writeJournal.length).toBeGreaterThan(writesBefore);
    for (const path of files.keys()) expect(path).not.toContain('/.efx-paint-package-staging-');
    const settleCalls = settleEfxPaintPackageTransaction.mock.calls as unknown as unknown[][];
    expect(settleCalls[settleCalls.length - 1]?.[2]).toBe('rollback');
  });
});

describe('46-02 Task 3: per-track frame carriers in the projectStore funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    sequenceStore.reset();
    physicPaintStore.reset();
    efxPaintStoreModule.reset();
    projectStore.filePath.value = null;
    projectStore.dirPath.value = null;
    clearPackageDisk();
    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeCleanProject() });
    ipcProjectSave.mockResolvedValue({ ok: true, data: null });
    ipcProjectSaveAsWithScriptLibrary.mockResolvedValue({ ok: true, data: { diagnostics: [] } });
    ipcScriptLibraryBindSavedProject.mockResolvedValue({ ok: true, data: 'authority' });
    ipcScriptLibraryClearActiveProject.mockResolvedValue({ ok: true, data: null });
    addRecentProject.mockResolvedValue(undefined);
    setLastProjectPath.mockResolvedValue(undefined);
    savePaintData.mockResolvedValue(undefined);
    cleanupOrphanedPaintFiles.mockResolvedValue(undefined);
    loadPhysicPaintData.mockResolvedValue([]);
    prepareRotoPhysicalDocumentPngs.mockImplementation(async (value: unknown) => value);
    installPackageTransactionMocks();
    installCacheLegMocks();
    fsReadFile.mockImplementation(async (path: string) => {
      const bytes = files.get(String(path));
      if (bytes === undefined) throw new Error(`missing file: ${String(path)}`);
      return bytes;
    });
    vi.spyOn(projectStore, 'closeProject');
  });

  it('builds per-track save input frames for a multi-track document (TRK-03)', async () => {
    addPhysicPaintLayer('layer-2t');
    efxPaintStoreModule.registerDocument(makeMultiTrackDocument('layer-2t'));
    const frameA = makeFrame(0, 1);
    const frameB = { ...makeFrame(0, 1), bytes: testWebpBytes(btoa('track-b-bytes')) };
    physicPaintStore.setFrame('layer-2t', TRACK_A, 1, frameA);
    physicPaintStore.setFrame('layer-2t', TRACK_B, 1, frameB);
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    // 46-02: both tracks own a frame at the same appFrame, and the package
    // save writes each one against its own track-keyed machine-relative
    // reference — never against a shared or colliding path.
    const publishedLayer = readJson('/project/layers/layer-2t.json');
    const tracks = publishedLayer.tracks as Array<{ id: string; frames: Record<string, { cachePath: string }> }>;
    expect(tracks).toHaveLength(2);
    expect(Object.values(tracks[0].frames)[0].cachePath).toMatch(
      new RegExp(`^efx-paint/layer-2t-[0-9a-f]+/${TRACK_A}/frame-0001\\.webp$`),
    );
    expect(Object.values(tracks[1].frames)[0].cachePath).toContain(`/${TRACK_B}/`);
    // The derived-frame bytes never reach the package (D-05: the package
    // carries references, never rendered sidecars).
    expect([...files.keys()].some((path) => path.includes('/project/frames/'))).toBe(false);
    // The runtime carriers themselves are per-track (TRACK-03).
    const runtimeA = physicPaintStore.getFrames('layer-2t', TRACK_A).get(1);
    const runtimeB = physicPaintStore.getFrames('layer-2t', TRACK_B).get(1);
    expect(runtimeA?.bytes).toBe(frameA.bytes);
    expect(runtimeB?.bytes).toBe(frameB.bytes);
  });

  it('hydrates per-track references into their own runtime maps on open, with no raster read', async () => {
    const document = makeMultiTrackDocument('layer-h');
    const trackA = document.tracks[0];
    const trackB = document.tracks[1];
    const refA = buildMachineCacheRelativePath('layer-h', TRACK_A, 5);
    const refB = buildMachineCacheRelativePath('layer-h', TRACK_B, 5);
    const withFrames = {
      ...document,
      tracks: [
        { ...trackA, frames: { 5: { cachePath: refA, width: 10, height: 10 } } },
        { ...trackB, frames: { 5: { cachePath: refB, width: 20, height: 20 } } },
      ],
    };
    files.set(
      `/project/${buildLayerFileRelativePath('layer-h')}`,
      new TextEncoder().encode(JSON.stringify(withFrames)),
    );
    ipcProjectOpen.mockResolvedValue({
      ok: true,
      data: {
        ...makeCleanProject(),
        efxPaint: {
          'layer-h': {
            layerFile: buildLayerFileRelativePath('layer-h'),
            documentRevision: '0',
            compositeRevision: '0',
          },
        },
      },
    });

    await projectStore.openProject('/project/multi.mce');

    expect(efxPaintStoreModule.getDocument('layer-h')).toBeDefined();
    // 46-01/46-02 per-track: each track keeps its OWN reference, and the two
    // parked at the same appFrame never collide on a shared carrier.
    const installed = efxPaintStoreModule.getDocument('layer-h');
    expect(installed?.tracks[0].frames[5]?.cachePath).toBe(refA);
    expect(installed?.tracks[1].frames[5]?.cachePath).toBe(refB);
    // Reference-only (D-05): neither track's runtime map received prefetched
    // bytes — the derived frames re-derive from the machine cache on demand.
    expect(physicPaintStore.getFrames('layer-h', TRACK_A).size).toBe(0);
    expect(physicPaintStore.getFrames('layer-h', TRACK_B).size).toBe(0);
    // The layer sub-file is the ONLY file an open reads: no media path and no
    // machine-cache path is ever touched (the package carries no raster).
    for (const call of fsReadFile.mock.calls) {
      expect(String(call[0])).toBe(`/project/${buildLayerFileRelativePath('layer-h')}`);
    }
  });

  it('regression: a single-track document is written under its single track id', async () => {
    addPhysicPaintLayer('layer-s');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-s'));
    physicPaintStore.setFrame('layer-s', TEST_TRACK_ID, 3, makeFrame(1, 3));
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    const publishedLayer = readJson('/project/layers/layer-s.json');
    const tracks = publishedLayer.tracks as Array<{ id: string; frames: Record<string, { cachePath: string }> }>;
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe(TEST_TRACK_ID);
    expect(Object.keys(tracks[0].frames)).toEqual(['3']);
    expect(physicPaintStore.getFrames('layer-s', TEST_TRACK_ID).get(3)?.bytes).toEqual(makeFrame(1, 3).bytes);
  });
});

describe('45-05 Task 3: AddFxMenu registers the v1.0 document at layer creation', () => {
  const addFxMenuSource = () => readFileSync(
    fileURLToPath(new URL('../components/timeline/AddFxMenu.tsx', import.meta.url)),
    'utf8',
  );
  const handlerSource = () => {
    const source = addFxMenuSource();
    const start = source.indexOf('const handleAddPhysicPaintLayer = () => {');
    return source.slice(start, source.indexOf('return (', start));
  };

  it('handleAddPhysicPaintLayer registers exactly one document keyed by the new layer id', () => {
    const source = handlerSource();
    const registrations = source.match(/registerDocument\(createEfxPaintDocument\(layerId\)\)/g) ?? [];
    expect(registrations).toHaveLength(1);
    // The registration follows both layer-creation branches (isolated-range
    // and standard), so every creation path registers the document.
    const registration = source.indexOf('registerDocument(createEfxPaintDocument(layerId))');
    // 260923-kcs: both creation branches now pass the next free `Layer N` stack
    // name and position:'top' — keep the registration-after-creation ordering pin.
    const isolatedBranch = source.indexOf("createFxSequence(stackName, physicPaintLayer, totalFrames.peek(), { position: 'top', inFrame: isolatedInFrame, outFrame: isolatedOutFrame })");
    const standardBranch = source.indexOf("createFxSequence(stackName, physicPaintLayer, totalFrames.peek(), { position: 'top' })");
    expect(registration).toBeGreaterThan(isolatedBranch);
    expect(registration).toBeGreaterThan(standardBranch);
  });

  it('the registered document has the DOC-02 shape: one default Paint track, fixed Background fallback, version 1, revision 0', () => {
    const document = makeTrackDocument('layer-new');
    expect(document.version).toBe(1);
    expect(document.documentRevision).toBe(0);
    expect(document.parentLayerId).toBe('layer-new');
    expect(document.activeTrackId).toBe(document.tracks[0].id);
    expect(document.tracks).toHaveLength(1);
    expect(document.tracks[0].id).toBe(document.activeTrackId);
    expect(document.background.fallback).toEqual({ mode: 'transparent' });
    expect(document.background.clips).toEqual([]);
    // registerDocument keys the store by parentLayerId (DOC-01: one parent
    // layer owns exactly one document).
    efxPaintStoreModule.registerDocument(document);
    expect(efxPaintStoreModule.getDocument('layer-new')).toBe(document);
  });

  it('the layer object itself is unchanged: type physic-paint, source.layerId === layer id, defaultTransform', () => {
    const source = handlerSource();
    expect(source).toContain("type: 'physic-paint'");
    expect(source).toContain("source: { type: 'physic-paint', layerId } as LayerSourceData");
    expect(source).toContain('transform: defaultTransform()');
    // 260923-kcs: stack names are identity (next free `Layer N`), not a fixed
    // menu string — the old `name: 'Physic Paint'` law is dead.
    expect(source).toContain('name: stackName');
  });
});

describe('quick-260913-05k round 3: a created project owns its chosen package path (UAT defect A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    sequenceStore.reset();
    physicPaintStore.reset();
    efxPaintStoreModule.reset();
    projectStore.filePath.value = null;
    projectStore.dirPath.value = null;
    clearPackageDisk();
    ipcProjectSave.mockResolvedValue({ ok: true, data: null });
    ipcProjectSaveAsWithScriptLibrary.mockResolvedValue({ ok: true, data: { diagnostics: [] } });
    ipcScriptLibraryBindSavedProject.mockResolvedValue({ ok: true, data: 'authority' });
    ipcScriptLibraryClearActiveProject.mockResolvedValue({ ok: true, data: null });
    addRecentProject.mockResolvedValue(undefined);
    setLastProjectPath.mockResolvedValue(undefined);
    savePaintData.mockResolvedValue(undefined);
    cleanupOrphanedPaintFiles.mockResolvedValue(undefined);
    loadPhysicPaintData.mockResolvedValue([]);
    prepareRotoPhysicalDocumentPngs.mockImplementation(async (value: unknown) => value);
    installPackageTransactionMocks();
    installCacheLegMocks();
    fsReadFile.mockImplementation(async (path: string) => {
      const bytes = files.get(String(path));
      if (bytes === undefined) throw new Error(`missing file: ${String(path)}`);
      return bytes;
    });
    ipcProjectCreate.mockResolvedValue({ ok: true, data: { width: 1920, height: 1080 } });
    ipcProjectMigrateTempImages.mockResolvedValue({ ok: true, data: [] });
    vi.spyOn(projectStore, 'closeProject');
  });

  it('createProject registers the chosen package path — the first Cmd+S saves instead of falling into Save As', async () => {
    await projectStore.createProject('Fresh', 24, '/projects/Fresh.mce', 1920, 1080);

    // The reported defect: after Create, the plain-save leg found no path and
    // opened the Save As picker over the just-created package. The project was
    // given its location in the dialog, so the store must own it from birth.
    expect(!projectStore.filePath.value).toBe(false);
    expect(projectStore.filePath.value).toBe('/projects/Fresh.mce/project.mce');
    expect(projectStore.dirPath.value).toBe('/projects/Fresh.mce');
  });

  it('a failed initial save keeps the registered path — never stranded as never-saved', async () => {
    await projectStore.createProject('Fresh', 24, '/projects/Fresh.mce', 1920, 1080);
    bindEfxPaintPackageTransaction.mockResolvedValueOnce({ ok: false, error: 'bind refused' });

    await expect(projectStore.saveProjectAs('/projects/Fresh.mce/project.mce')).rejects.toThrow('bind refused');

    // The rollback restores the CREATE-registered path, not `null`: a refused
    // initial save must never send the next Cmd+S back into the Save As picker.
    expect(projectStore.filePath.value).toBe('/projects/Fresh.mce/project.mce');
    expect(projectStore.dirPath.value).toBe('/projects/Fresh.mce');
  });

  it('the next save after a failed initial save heals into the chosen package', async () => {
    await projectStore.createProject('Fresh', 24, '/projects/Fresh.mce', 1920, 1080);
    bindEfxPaintPackageTransaction.mockResolvedValueOnce({ ok: false, error: 'bind refused' });
    await expect(projectStore.saveProjectAs('/projects/Fresh.mce/project.mce')).rejects.toThrow('bind refused');

    await projectStore.saveProjectAs('/projects/Fresh.mce/project.mce');

    const manifestBytes = files.get('/projects/Fresh.mce/project.mce');
    expect(manifestBytes).toBeDefined();
    expect((JSON.parse(new TextDecoder().decode(manifestBytes)) as { formatVersion?: unknown }).formatVersion).toBe(1);
    expect(projectStore.filePath.value).toBe('/projects/Fresh.mce/project.mce');
  });

  it('the New Project dialog surfaces a create/initial-save failure through the blocking modal', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../components/project/NewProjectDialog.tsx', import.meta.url)),
      'utf8',
    );
    // `createProject` resets the UI store (closeProject), so the dialog is
    // already unmounted by the time the initial save can fail — an inline
    // setError renders nowhere. The failure takes the same blocking-modal
    // surface every other save site uses.
    const catchStart = source.indexOf('} catch (err) {');
    expect(catchStart).toBeGreaterThan(-1);
    const catchBlock = source.slice(catchStart, source.indexOf('} finally {', catchStart));
    expect(catchBlock).toContain("showProjectIoFailureDialog('save', err)");
    expect(catchBlock).not.toContain('setError(');
  });
});
