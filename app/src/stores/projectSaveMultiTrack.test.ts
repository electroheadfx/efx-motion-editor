import { createHash } from 'node:crypto';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { settlePackageFileTokens } from '../lib/efxPaintPersistence';
import { buildFrameMediaRelativePath } from '../lib/efxPaintPackage';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from './physicPaintStore';
import { _setEfxPaintMarkDirtyCallback, addTrack, registerDocument, reset as resetEfxPaint } from './efxPaintStore';
import { projectStore } from './projectStore';
import { sequenceStore } from './sequenceStore';
import { layerStore } from './layerStore';

const TEST_TRACK_ID = 'track-1';

const ipcProjectSave = vi.hoisted(() => vi.fn());
const ipcScriptLibraryBindSavedProject = vi.hoisted(() => vi.fn());
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const hardlinkPhysicPaintCacheFrames = vi.hoisted(() => vi.fn());
// 52.2-07 Task 3: the real save now drives the package funnel, so the mocked
// ipc surface owns its whole transaction + cache-root resolution.
const ipcResolvePhysicPaintCacheRoot = vi.hoisted(() => vi.fn());
const ipcEfxPaintWriteFrameMedia = vi.hoisted(() => vi.fn());
// quick-260913-05k: the package-IO boundary — the layer sub-file write/read
// and the staging discard are app commands, not fs-plugin calls.
const ipcEfxPaintWritePackageLayerFile = vi.hoisted(() => vi.fn());
const ipcEfxPaintReadPackageLayerFile = vi.hoisted(() => vi.fn());
const discardEfxPaintPackageStaging = vi.hoisted(() => vi.fn());
// quick-260913-05k (cache extension): the staging lifecycle commands.
const preparePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const stagePhysicPaintCacheFrame = vi.hoisted(() => vi.fn());
const discardPhysicPaintCacheStaging = vi.hoisted(() => vi.fn());
const removePhysicPaintCacheEntry = vi.hoisted(() => vi.fn());
const bindEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const settleEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishPhysicPaintProjectContext = vi.hoisted(() => vi.fn());
const addRecentProject = vi.hoisted(() => vi.fn());
const setLastProjectPath = vi.hoisted(() => vi.fn());
const savePaintData = vi.hoisted(() => vi.fn());
const loadPaintData = vi.hoisted(() => vi.fn());
const cleanupOrphanedPaintFiles = vi.hoisted(() => vi.fn());
const fsWriteFile = vi.hoisted(() => vi.fn());
const fsMkdir = vi.hoisted(() => vi.fn());
const fsExists = vi.hoisted(() => vi.fn());
const fsRemove = vi.hoisted(() => vi.fn());
const startAutoSave = vi.hoisted(() => vi.fn());
const stopAutoSave = vi.hoisted(() => vi.fn());

vi.mock('../lib/ipc', () => ({
  projectCreate: vi.fn(),
  projectSave: ipcProjectSave,
  projectSaveAsWithScriptLibrary: vi.fn(),
  projectOpen: vi.fn(),
  projectMigrateTempImages: vi.fn(),
  scriptLibraryBindSavedProject: ipcScriptLibraryBindSavedProject,
  scriptLibraryClearActiveProject: vi.fn(),
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
  hardlinkPhysicPaintCacheFrames,
  resolvePhysicPaintCacheRoot: ipcResolvePhysicPaintCacheRoot,
  ipcEfxPaintWriteFrameMedia,
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

vi.mock('../lib/physicPaintBridge', () => ({
  publishPhysicPaintProjectContext,
}));

vi.mock('../lib/autoSave', () => ({ startAutoSave, stopAutoSave }));

vi.mock('../lib/appConfig', () => ({ addRecentProject, setLastProjectPath }));

vi.mock('../lib/paintPersistence', () => ({
  savePaintData,
  loadPaintData,
  cleanupOrphanedPaintFiles,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: fsWriteFile,
  mkdir: fsMkdir,
  exists: fsExists,
  remove: fsRemove,
}));

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

const makeFrame = (frameIndex: number, appFrame: number): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  bytes: testWebpBytes(btoa(`frame-${frameIndex}`)),
  width: 100,
  height: 50,
});

/** The machine-local derived-frame cache root (D-05/D-14). */
const MACHINE_CACHE_ROOT = '/machine/frame-cache/multi-track-project';

/**
 * The document the package save staged for one layer's sub-file (52.2-07
 * D-04/D-09: the layer content lives in `layers/<layerId>.json`, never in the
 * manifest). Since quick-260913-05k the sub-file reaches the package through
 * the Rust command wrapper, so the IPC arguments are the witness.
 */
function stagedLayerDocument(layerId: string): Record<string, unknown> {
  const layerFile = `layers/${layerId}.json`;
  const writes = ipcEfxPaintWritePackageLayerFile.mock.calls as unknown as [string, string, string, string][];
  const write = [...writes].reverse().find((call) => call[2] === layerFile);
  if (write === undefined) throw new Error(`no staged write for ${layerFile}`);
  return JSON.parse(write[3]) as Record<string, unknown>;
}

/**
 * The package transaction + cache surface of the mocked ipc module. `mockClear`
 * alone would keep a previous case's one-shot queue, so each mock is reset
 * before its implementation is installed.
 */
function installPackageSaveMocks(): void {
  ipcResolvePhysicPaintCacheRoot.mockReset();
  ipcEfxPaintWriteFrameMedia.mockReset();
  ipcEfxPaintWritePackageLayerFile.mockReset();
  ipcEfxPaintReadPackageLayerFile.mockReset();
  discardEfxPaintPackageStaging.mockReset();
  preparePhysicPaintCacheGeneration.mockReset();
  stagePhysicPaintCacheFrame.mockReset();
  discardPhysicPaintCacheStaging.mockReset();
  removePhysicPaintCacheEntry.mockReset();
  bindEfxPaintPackageTransaction.mockReset();
  publishEfxPaintPackageTransaction.mockReset();
  settleEfxPaintPackageTransaction.mockReset();
  hardlinkPhysicPaintCacheFrames.mockReset();
  ipcResolvePhysicPaintCacheRoot.mockResolvedValue({ ok: true, data: MACHINE_CACHE_ROOT });
  ipcEfxPaintWritePackageLayerFile.mockResolvedValue({ ok: true, data: null });
  ipcEfxPaintReadPackageLayerFile.mockResolvedValue({ ok: false, error: { kind: 'missing' } });
  discardEfxPaintPackageStaging.mockResolvedValue({ ok: true, data: null });
  preparePhysicPaintCacheGeneration.mockResolvedValue({ ok: true, data: { accepted: true } });
  stagePhysicPaintCacheFrame.mockResolvedValue({ ok: true, data: { accepted: true } });
  discardPhysicPaintCacheStaging.mockResolvedValue({ ok: true, data: null });
  removePhysicPaintCacheEntry.mockResolvedValue({ ok: true, data: null });
  ipcEfxPaintWriteFrameMedia.mockImplementation(
    async (_packageDir: string, layerId: string, keyId: string, bytes: Uint8Array) => ({
      ok: true,
      data: {
        relativePath: buildFrameMediaRelativePath(layerId, keyId),
        digest: createHash('sha256').update(bytes).digest('hex'),
        byteLength: bytes.length,
      },
    }),
  );
  bindEfxPaintPackageTransaction.mockResolvedValue({
    ok: true,
    data: { transactionId: 'pkg-tx-1', aggregateDigest: 'aggregate-digest', entries: [] },
  });
  publishEfxPaintPackageTransaction.mockResolvedValue({
    ok: true,
    data: { transactionId: 'pkg-tx-1', published: 2 },
  });
  settleEfxPaintPackageTransaction.mockResolvedValue({ ok: true, data: { cleanupDeferred: false } });
  hardlinkPhysicPaintCacheFrames.mockResolvedValue({ ok: true, data: { accepted: true, missing: [] } });
}

describe('47-01: real saveProject persists a child-added track (main-window document sync surface)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    physicPaintStore.reset();
    resetEfxPaint();
    sequenceStore.reset();
    layerStore.reset();
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    projectStore.reset();
    projectStore.dirPath.value = '/project';
    projectStore.filePath.value = '/project/test.mce';
    fsExists.mockResolvedValue(true);
    fsMkdir.mockResolvedValue(undefined);
    fsWriteFile.mockResolvedValue(undefined);
    fsRemove.mockResolvedValue(undefined);
    publishPhysicPaintCacheGeneration.mockResolvedValue({
      ok: true,
      data: { accepted: true, transactionId: 'tx-1', replacedExisting: false },
    });
    settlePhysicPaintCacheGeneration.mockResolvedValue({ ok: true, data: null });
    installPackageSaveMocks();
    // The committed change baseline is process state: a stale map from a
    // previous case would make this case's save look unchanged and skip it.
    settlePackageFileTokens('commit', new Map());
    ipcScriptLibraryBindSavedProject.mockResolvedValue({ ok: true, data: 'authority' });
    addRecentProject.mockResolvedValue(undefined);
    setLastProjectPath.mockResolvedValue(undefined);
    savePaintData.mockResolvedValue(undefined);
    loadPaintData.mockResolvedValue([]);
    cleanupOrphanedPaintFiles.mockResolvedValue(undefined);
    ipcProjectSave.mockImplementation(async (_project: unknown, _path: string) => ({ ok: true, data: null }));
  });

  it('persists the newly added track with its painted frames', async () => {
    const LAYER_ID = 'layer-1';
    const layer = {
      id: LAYER_ID,
      name: 'Physics Paint',
      type: 'physic-paint' as const,
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      source: { type: 'physic-paint' as const, layerId: LAYER_ID },
    };
    sequenceStore.sequences.value = [{
      id: 'parent-seq',
      kind: 'fx',
      name: 'Parent sequence',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer as never],
      inFrame: 0,
      outFrame: 100,
    } as never];

    registerDocument(makeTrackDocument(LAYER_ID));
    const added = addTrack(LAYER_ID);
    expect(added.ok).toBe(true);
    const newTrackId = (added as { ok: true; trackId: string }).trackId;
    physicPaintStore.setFrame(LAYER_ID, newTrackId, 0, makeFrame(0, 0));
    physicPaintStore.setFrame(LAYER_ID, newTrackId, 4, makeFrame(1, 4));

    await projectStore.saveProject();

    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    // The manifest write takes the manifest and the staged path only; the
    // layer content moved into its own sub-file (D-04: a pure index).
    const saveCall = ipcProjectSave.mock.calls[0] as unknown[];
    expect(saveCall).toHaveLength(2);
    const [manifest, stagedManifestPath] = saveCall as [Record<string, unknown>, string];
    expect(stagedManifestPath).toMatch(
      /^\/project\/\.efx-paint-package-staging-[^/]+\/project\.mce$/,
    );
    expect(manifest.efx_paint_documents).toBeUndefined();
    const document = stagedLayerDocument(LAYER_ID) as {
      tracks: Array<{ id: string; frames: Record<string, unknown> }>;
    };
    expect(document.tracks).toHaveLength(2);
    const trackIds = document.tracks.map((track) => track.id);
    expect(trackIds).toContain(TEST_TRACK_ID);
    expect(trackIds).toContain(newTrackId);
    const persistedNew = document.tracks.find((track) => track.id === newTrackId)!;
    expect(Object.keys(persistedNew.frames).map(Number).sort()).toEqual([0, 4]);
  });
});
