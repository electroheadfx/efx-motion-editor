import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
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
    const payload = ipcProjectSave.mock.calls[0][0] as Record<string, unknown>;
    const documents = payload.efx_paint_documents as Record<string, unknown>;
    const document = documents[LAYER_ID] as { tracks: Array<{ id: string; frames: Record<string, unknown> }> };
    expect(document.tracks).toHaveLength(2);
    const trackIds = document.tracks.map((track) => track.id);
    expect(trackIds).toContain(TEST_TRACK_ID);
    expect(trackIds).toContain(newTrackId);
    const persistedNew = document.tracks.find((track) => track.id === newTrackId)!;
    expect(Object.keys(persistedNew.frames).map(Number).sort()).toEqual([0, 4]);
  });
});
