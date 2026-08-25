import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { physicPaintStore, physicPaintVersion, _setPhysicPaintMarkDirtyCallback } from './physicPaintStore';
import { _setEfxPaintMarkDirtyCallback, addTrack, registerDocument, reset as resetEfxPaint, serializeRuntimeIntoDocument } from './efxPaintStore';
import { projectStore } from './projectStore';
import { sequenceStore } from './sequenceStore';
import { layerStore } from './layerStore';

const TEST_TRACK_ID = 'track-1';

const ipcProjectSave = vi.hoisted(() => vi.fn());
const ipcScriptLibraryBindSavedProject = vi.hoisted(() => vi.fn());
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
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
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
  width: 100,
  height: 50,
});

const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

const rotoRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: { frameIndex: appFrame, appFrame, dataUrl: pngDataUrl(keyId), width: 10, height: 10 },
});

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
    publishPhysicPaintCacheGeneration.mockResolvedValue({ ok: true, data: { transactionId: 'tx-1' } });
    settlePhysicPaintCacheGeneration.mockResolvedValue({ ok: true, data: null });
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

    // PARENT saves — the .mce must keep Track 1's keys AND the new track's keys.
    await projectStore.saveProject();

    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    const payload = ipcProjectSave.mock.calls[0][0] as Record<string, unknown>;
    const documents = payload.efx_paint_documents as Record<string, unknown>;
    const document = documents[LAYER_ID] as { tracks: Array<{ id: string; rotoPhysical: { realKeyRecords: Array<{ keyId: string }> } | null }> };
    expect(document.tracks).toHaveLength(2);
    const track1 = document.tracks.find((track) => track.id === TEST_TRACK_ID)!;
    expect(track1.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['t1-key-1', 't1-key-2']);
    const newTrack = document.tracks.find((track) => track.id === newTrackId)!;
    expect(newTrack.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['new-key-1']);
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
