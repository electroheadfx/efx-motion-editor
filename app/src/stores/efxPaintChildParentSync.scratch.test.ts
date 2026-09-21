import { createHash } from 'node:crypto';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import { settlePackageFileTokens } from '../lib/efxPaintPersistence';
import { buildFrameMediaRelativePath } from '../lib/efxPaintPackage';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { physicPaintStore, physicPaintVersion, _setPhysicPaintMarkDirtyCallback } from './physicPaintStore';
import { _setEfxPaintMarkDirtyCallback, addBackgroundClip, addTrack, registerDocument, reset as resetEfxPaint, serializeRuntimeIntoDocument, setPhotoReferenceSource } from './efxPaintStore';
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

// The package save only indexes a Physics Paint layer that belongs to a live
// sequence; a layer outside every sequence never reaches the manifest's
// efxPaint index and writes no layer sub-file.
function installParentSequence(layerId: string): void {
  sequenceStore.sequences.value = [{
    id: 'parent-seq',
    kind: 'fx',
    name: 'Parent sequence',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [{
      id: layerId,
      name: 'Physics Paint',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      source: { type: 'physic-paint', layerId },
    } as never],
    inFrame: 0,
    outFrame: 100,
  } as never];
}

const makeFrame = (frameIndex: number, appFrame: number): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  bytes: testWebpBytes(btoa(`frame-${frameIndex}`)),
  width: 100,
  height: 50,
});

const pngDataUrl = (label: string) => testWebpBytes(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`);

const rotoRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: { frameIndex: appFrame, appFrame, bytes: pngDataUrl(keyId), width: 10, height: 10 },
});

/** The machine-local derived-frame cache root (D-05/D-14). */
const MACHINE_CACHE_ROOT = '/machine/frame-cache/scratch-project';

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

describe('SCRATCH: child document push + parent save preserves Track 1 keys', () => {
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
    settlePhysicPaintCacheGeneration.mockResolvedValue({
    ok: true,
    data: { accepted: true, cleanupStatus: 'complete' },
  });
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

  it('keeps Track 1 keys when the child pushes its document and the parent saves', async () => {
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

    // PARENT: document with Track 1 carrying keys + runtime hydrated.
    const parentDocument = makeTrackDocument(LAYER_ID);
    registerDocument(parentDocument);
    physicPaintStore.setFrame(LAYER_ID, TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setFrame(LAYER_ID, TEST_TRACK_ID, 4, makeFrame(1, 4));
    const replaced = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, TEST_TRACK_ID,
      [rotoRecord('t1-key-1', 0), rotoRecord('t1-key-2', 4)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    expect(replaced.ok).toBe(true);

    // CHILD: adds a track and paints on it (child-side store).
    const added = addTrack(LAYER_ID);
    expect(added.ok).toBe(true);
    const newTrackId = (added as { ok: true; trackId: string }).trackId;
    physicPaintStore.setFrame(LAYER_ID, newTrackId, 2, makeFrame(0, 2));
    physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, newTrackId,
      [rotoRecord('new-key-1', 2)],
      { enabled: false, mode: 'duplicate' },
      600,
    );

    // CHILD pushes its document to the parent (the new sync channel).
    const childDocument = serializeRuntimeIntoDocument(LAYER_ID);
    const pushed = parseEfxPaintDocument(childDocument);
    registerDocument(pushed);

    // PARENT saves — the package must keep Track 1's keys AND the new track's
    // keys in the layer sub-file the manifest indexes (52.2-07 D-04/D-09).
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
    expect(manifest.efxPaint).toEqual({
      [LAYER_ID]: expect.objectContaining({ layerFile: `layers/${LAYER_ID}.json` }),
    });
    const document = stagedLayerDocument(LAYER_ID) as {
      tracks: Array<{ id: string; rotoPhysical: { realKeyRecords: Array<{ keyId: string }> } | null }>;
    };
    expect(document.tracks).toHaveLength(2);
    const track1 = document.tracks.find((track) => track.id === TEST_TRACK_ID)!;
    expect(track1.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['t1-key-1', 't1-key-2']);
    const newTrack = document.tracks.find((track) => track.id === newTrackId)!;
    expect(newTrack.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['new-key-1']);
  });

  // 260921-e21: the same seam, extended from tracks to the other two
  // Studio-origin surfaces. The child push wiring is the diagnosed link (see
  // 260921-e21-RED-EVIDENCE.json); these two cases lock the half that was
  // already green — once the parent HAS the child's document, the .mce layer
  // sub-file the manifest indexes must carry the background clip and the photo
  // reference, or the fix would only move the loss one link downstream.
  it('keeps a child-placed background clip, at its frame with its source refs, when the child pushes and the parent saves', async () => {
    const LAYER_ID = 'layer-1';
    installParentSequence(LAYER_ID);
    registerDocument(makeTrackDocument(LAYER_ID));

    // CHILD: places a background image clip at frame 4 with a source cycle.
    const placed = addBackgroundClip(LAYER_ID, {
      startFrame: 4,
      sourceFrameRefs: ['bg-ref-1', 'bg-ref-2'],
      repeat: { mode: 'finite', count: 1 },
    });
    expect(placed.ok).toBe(true);

    // CHILD pushes its document to the parent.
    registerDocument(parseEfxPaintDocument(serializeRuntimeIntoDocument(LAYER_ID)));

    // PARENT saves — the layer sub-file must carry the clip and its frame.
    await projectStore.saveProject();

    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    const document = stagedLayerDocument(LAYER_ID) as {
      background: { clips: Array<{ id: string; startFrame: number; sourceFrameRefs: string[] }> };
    };
    expect(document.background.clips).toHaveLength(1);
    expect(document.background.clips[0].startFrame).toBe(4);
    expect(document.background.clips[0].sourceFrameRefs).toEqual(['bg-ref-1', 'bg-ref-2']);
  });

  it('keeps a child-selected reference source, with its refs, when the child pushes and the parent saves', async () => {
    const LAYER_ID = 'layer-1';
    installParentSequence(LAYER_ID);
    registerDocument(makeTrackDocument(LAYER_ID));

    // CHILD: selects the reference source image(s).
    const selected = setPhotoReferenceSource(LAYER_ID, ['ref-photo-1', 'ref-photo-2']);
    expect(selected.ok).toBe(true);

    // CHILD pushes its document to the parent.
    registerDocument(parseEfxPaintDocument(serializeRuntimeIntoDocument(LAYER_ID)));

    // PARENT saves — the layer sub-file must carry the reference source.
    await projectStore.saveProject();

    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    const document = stagedLayerDocument(LAYER_ID) as {
      photoReference: { sourceFrameRefs: string[] } | null;
    };
    expect(document.photoReference?.sourceFrameRefs).toEqual(['ref-photo-1', 'ref-photo-2']);
  });

  it('re-hydrates the parent runtime from the pushed LIVE projection when the parent runtime is stale', () => {
    const LAYER_ID = 'layer-1';
    const parentDocument = makeTrackDocument(LAYER_ID);
    registerDocument(parentDocument);
    physicPaintStore.setFrame(LAYER_ID, TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, TEST_TRACK_ID,
      [rotoRecord('t1-key-1', 0)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    // The parent's ORIGINAL document carries Track 1's rotoPhysical (projected
    // from the runtime — the raw makeTrackDocument has rotoPhysical: null).
    const originalDocument = parseEfxPaintDocument(serializeRuntimeIntoDocument(LAYER_ID));

    // CHILD paints on Track 1 — the child runtime now carries a NEW key the
    // parent runtime does not know about yet.
    physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, TEST_TRACK_ID,
      [rotoRecord('t1-key-1', 0), rotoRecord('t1-key-2', 4)],
      { enabled: false, mode: 'duplicate' },
      600,
    );

    // CHILD pushes its LIVE projection (round-7 fix: serializeRuntimeIntoDocument,
    // not the raw document).
    const pushed = parseEfxPaintDocument(serializeRuntimeIntoDocument(LAYER_ID));

    // Simulate the PARENT's stale runtime: the parent opened the project with
    // the ORIGINAL document and never saw the child's new key.
    resetEfxPaint();
    physicPaintStore.reset();
    registerDocument(originalDocument);
    physicPaintStore.installRuntimeStateFromDocument(LAYER_ID, TEST_TRACK_ID, {
      trackId: TEST_TRACK_ID,
      frames: new Map([[0, makeFrame(0, 0)]]),
      rotoPhysical: originalDocument.tracks[0].rotoPhysical,
    });
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER_ID, TEST_TRACK_ID).map((record) => record.keyId))
      .toEqual(['t1-key-1']);

    // PARENT receives the push: registers the document AND mirrors the pushed
    // rotoPhysical into its runtime (the round-8 listener behavior — silent
    // mirror, revision-guarded).
    const versionBefore = physicPaintVersion.value;
    const dirtySpy = vi.fn();
    _setPhysicPaintMarkDirtyCallback(dirtySpy);
    registerDocument(pushed);
    for (const track of pushed.tracks) {
      if (!track.rotoPhysical) continue;
      if (physicPaintStore.getRotoPhysicalContentRevision(LAYER_ID, track.id) === track.rotoPhysical.revision) continue;
      const result = physicPaintStore.mirrorRotoPhysicalDocument(LAYER_ID, track.id, track.rotoPhysical);
      expect(result.ok).toBe(true);
    }

    // The parent runtime now matches the child's live state — the delete
    // apply's currentRevision equals the child's expectedRevision.
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER_ID, TEST_TRACK_ID).map((record) => record.keyId))
      .toEqual(['t1-key-1', 't1-key-2']);
    // Frames are preserved by the mirror (mirrorRotoPhysicalDocument never
    // touches the frame maps).
    expect(physicPaintStore.getFrames(LAYER_ID, TEST_TRACK_ID).size).toBe(1);
    // The mirror is SILENT: no project-dirty callback, no version bumps —
    // a document sync can never trigger an auto-save (round-7 regression).
    expect(dirtySpy).not.toHaveBeenCalled();
    expect(physicPaintVersion.value).toBe(versionBefore);
  });

  it('mirror is a no-op when the pushed revision equals the parent current revision', () => {
    const LAYER_ID = 'layer-1';
    const parentDocument = makeTrackDocument(LAYER_ID);
    registerDocument(parentDocument);
    physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, TEST_TRACK_ID,
      [rotoRecord('t1-key-1', 0)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    const pushed = parseEfxPaintDocument(serializeRuntimeIntoDocument(LAYER_ID));
    const pushedTrack = pushed.tracks[0];
    expect(pushedTrack.rotoPhysical).not.toBeNull();
    const versionBefore = physicPaintVersion.value;
    const dirtySpy = vi.fn();
    _setPhysicPaintMarkDirtyCallback(dirtySpy);

    // The parent's current content revision already equals the pushed
    // revision — the bridge guard skips the mirror entirely.
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER_ID, TEST_TRACK_ID))
      .toBe(pushedTrack.rotoPhysical!.revision);
    const result = physicPaintStore.mirrorRotoPhysicalDocument(LAYER_ID, TEST_TRACK_ID, pushedTrack.rotoPhysical);
    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER_ID, TEST_TRACK_ID).map((record) => record.keyId))
      .toEqual(['t1-key-1']);
    expect(dirtySpy).not.toHaveBeenCalled();
    expect(physicPaintVersion.value).toBe(versionBefore);
  });
});
