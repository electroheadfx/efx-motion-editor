/**
 * Phase 45-05 cutover test suite: the v1.0 EFX Paint document funnel.
 *
 * Task 1 (gate): openProject refuses pre-v1.0 projects end-to-end with a
 * blocking no-recourse dialog and zero store mutation (D-05/D-07, Pitfall F4).
 * Task 2 (save/load): both save paths persist efx_paint_documents through the
 * v1.0 two-resource transaction; open hydrates documents into efxPaintStore;
 * closeProject resets the store (DOC-05).
 * Task 3 (creation): AddFxMenu registers one spec-shaped document per
 * physic-paint layer (DOC-01/DOC-02).
 *
 * The ipc / persistence / dialog / fs modules are fully mocked; the real
 * stores run so hydration effects are observable.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { findLegacyPhysicPaintRejection } from '../efx-paint/document/efxPaintCleanBreak';
import { LEGACY_PHYSIC_PAINT_REJECTED_COPY } from '../lib/efxPaintRejectionDialog';
import type { EfxPaintDocumentSaveInput, EfxPaintLoadedDocument } from '../lib/efxPaintPersistence';
import type { MceProject } from '../types/project';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import * as efxPaintStoreModule from './efxPaintStore';
import { physicPaintStore } from './physicPaintStore';
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
const loadPhysicPaintData = vi.hoisted(() => vi.fn());
const saveEfxPaintDocumentsWithProjectWrite = vi.hoisted(() => vi.fn());
const loadEfxPaintDocuments = vi.hoisted(() => vi.fn());
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
}));

// Keep the real module (efxPaintStore needs the real buildEfxPaintFrameCachePath)
// and override only the two funnel functions exercised by projectStore.
vi.mock('../lib/efxPaintPersistence', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/efxPaintPersistence')>()),
  saveEfxPaintDocumentsWithProjectWrite,
  loadEfxPaintDocuments,
}));

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
}));

// --- Fixtures ---

/** Pre-v1.0 project: non-empty physic_paint_outputs triggers the gate (D-06). */
function makeLegacyProject(): MceProject {
  const legacyOutputsKey = 'physic_paint_' + 'outputs';
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
    [legacyOutputsKey]: [{ layer_id: 'layer-1', frames: [] }],
  };
}

/** v1.0 project: no legacy outputs, no cache refs, no physic-paint layers. */
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
  };
}

describe('45-05 Task 1: clean-break rejection gate in openProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    sequenceStore.reset();
    ipcProjectOpen.mockResolvedValue({ ok: true, data: makeCleanProject() });
    loadPhysicPaintData.mockResolvedValue([]);
    loadEfxPaintDocuments.mockResolvedValue(new Map());
    prepareRotoPhysicalDocumentPngs.mockImplementation(async (value: unknown) => value);
    ipcScriptLibraryBindSavedProject.mockResolvedValue({ ok: true, data: 'authority' });
    ipcScriptLibraryClearActiveProject.mockResolvedValue({ ok: true, data: null });
    addRecentProject.mockResolvedValue(undefined);
    setLastProjectPath.mockResolvedValue(undefined);
    dialogMessage.mockResolvedValue('Ok');
    fsReadFile.mockRejectedValue(new Error('unexpected readFile in test'));
    vi.spyOn(projectStore, 'closeProject');
  });

  it('rejects a legacy project with a blocking dialog and zero downstream invocation', async () => {
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
  });

  it('opens a clean project through the normal hydration path exactly as today', async () => {
    await projectStore.openProject('/project/clean.mce');

    expect(dialogMessage).not.toHaveBeenCalled();
    expect(projectStore.closeProject).toHaveBeenCalledTimes(1);
    expect(loadEfxPaintDocuments).toHaveBeenCalledTimes(1);
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

  it('the gate predicate itself is the pure scan from 45-03 (structure-discriminated)', () => {
    expect(findLegacyPhysicPaintRejection(makeLegacyProject())).toEqual({ kind: 'legacy-physic-paint-outputs' });
    expect(findLegacyPhysicPaintRejection(makeCleanProject())).toBeNull();
  });
});

// --- Task 2 helpers ---

const makeFrame = (frameIndex: number, appFrame: number): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
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

describe('45-05 Task 2: v1.0 document save/load funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    sequenceStore.reset();
    physicPaintStore.reset();
    efxPaintStoreModule.reset();
    projectStore.filePath.value = null;
    projectStore.dirPath.value = null;
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
    // Mirror the real two-resource transaction: empty documents → no
    // publication (null transaction id); otherwise a bound transaction id.
    saveEfxPaintDocumentsWithProjectWrite.mockImplementation(
      async (
        _projectDir: string,
        documents: ReadonlyMap<string, EfxPaintDocumentSaveInput>,
        writeProject: (payload: Record<string, unknown>, transactionId: string | null) => Promise<void>,
      ) => {
        const persisted: Record<string, unknown> = {};
        for (const [layerId, input] of documents) persisted[layerId] = input.document;
        await writeProject(persisted, documents.size === 0 ? null : 'txn-45-05');
        return persisted;
      },
    );
    loadEfxPaintDocuments.mockImplementation(
      async (_projectId: string, persistedMap: Record<string, unknown> | undefined) => {
        const loaded = new Map<string, EfxPaintLoadedDocument>();
        if (!persistedMap) return loaded;
        for (const [layerId, value] of Object.entries(persistedMap)) {
          const document = value as EfxPaintDocument;
          loaded.set(layerId, {
            document,
            // 46-02: the load carrier is per-track (trackId → appFrame → frame).
            frames: new Map([[document.activeTrackId, new Map([[0, makeFrame(0, 0)]])]]),
          });
        }
        return loaded;
      },
    );
    vi.spyOn(projectStore, 'closeProject');
  });

  it('saveProject persists efx_paint_documents keyed by layer id and never emits the legacy outputs field', async () => {
    addPhysicPaintLayer('layer-1');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    expect(saveEfxPaintDocumentsWithProjectWrite).toHaveBeenCalledTimes(1);
    const [projectDir, documents] = saveEfxPaintDocumentsWithProjectWrite.mock.calls[0] as [
      string,
      ReadonlyMap<string, EfxPaintDocumentSaveInput>,
    ];
    expect(projectDir).toBe('/project');
    expect(documents.size).toBe(1);
    const input = documents.get('layer-1');
    expect(input).toBeDefined();
    // The runtime frame was projected into the document's default track.
    expect(input!.document.tracks[0].frames[0].cachePath).toMatch(/^cache\/efx-paint\//);
    expect(ipcProjectSave).toHaveBeenCalledTimes(1);
    const [savedProject, , transactionId] = ipcProjectSave.mock.calls[0] as [MceProject, string, string | null];
    expect(savedProject.efx_paint_documents?.['layer-1']).toBeDefined();
    expect(('physic_paint_' + 'outputs') in savedProject).toBe(false);
    expect(transactionId).toBe('txn-45-05');
  });

  it('saveProjectAs performs the identical v1.0 switch on its call path', async () => {
    addPhysicPaintLayer('layer-1');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    projectStore.filePath.value = '/project/old.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProjectAs('/project/new.mce');

    expect(saveEfxPaintDocumentsWithProjectWrite).toHaveBeenCalledTimes(1);
    expect(ipcProjectSaveAsWithScriptLibrary).toHaveBeenCalledTimes(1);
    const [projectForSave, source, destination, transactionId] = ipcProjectSaveAsWithScriptLibrary.mock.calls[0] as [
      MceProject,
      string,
      string,
      string | null,
    ];
    expect(source).toBe('/project/old.mce');
    expect(destination).toBe('/project/new.mce');
    expect(transactionId).toBe('txn-45-05');
    expect(projectForSave.efx_paint_documents?.['layer-1']).toBeDefined();
    expect(('physic_paint_' + 'outputs') in projectForSave).toBe(false);
    // A freshly saved v1.0 project must surface in Recents (R4).
    expect(addRecentProject).toHaveBeenCalledTimes(1);
    expect(addRecentProject).toHaveBeenCalledWith(expect.objectContaining({ path: '/project/new.mce' }));
    expect(setLastProjectPath).toHaveBeenCalledWith('/project/new.mce');
  });

  it('buildMceProject writes version 16', () => {
    expect(projectStore.buildMceProject().version).toBe(16);
  });

  it('openProject hydrates efxPaintStore and projects the default track into the runtime', async () => {
    const document = makeTrackDocument('layer-1');
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{
        ...track,
        frames: { 0: { cachePath: 'cache/efx-paint/layer-1/frame-000000-0000.png', width: 100, height: 50 } },
      }],
    };
    ipcProjectOpen.mockResolvedValue({
      ok: true,
      data: { ...makeCleanProject(), efx_paint_documents: { 'layer-1': withFrame } },
    });

    await projectStore.openProject('/project/v1.mce');

    expect(loadEfxPaintDocuments).toHaveBeenCalledTimes(1);
    expect(efxPaintStoreModule.getDocument('layer-1')).toBeDefined();
    expect(physicPaintStore.getFrames('layer-1', TEST_TRACK_ID).get(0)?.dataUrl).toBe(makeFrame(0, 0).dataUrl);
  });

  it('closeProject resets efxPaintStore so no document leaks across projects', () => {
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-1'));
    const resetSpy = vi.spyOn(efxPaintStoreModule, 'reset');

    projectStore.closeProject();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(efxPaintStoreModule.hasDocument('layer-1')).toBe(false);
  });

  it('a save with no physic-paint layers passes an empty document map and skips staging', async () => {
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    expect(saveEfxPaintDocumentsWithProjectWrite).toHaveBeenCalledTimes(1);
    const [, documents] = saveEfxPaintDocumentsWithProjectWrite.mock.calls[0] as [
      string,
      ReadonlyMap<string, EfxPaintDocumentSaveInput>,
    ];
    expect(documents.size).toBe(0);
    const [savedProject, , transactionId] = ipcProjectSave.mock.calls[0] as [MceProject, string, string | null];
    expect(savedProject.efx_paint_documents).toEqual({});
    expect(transactionId).toBeNull();
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
    saveEfxPaintDocumentsWithProjectWrite.mockImplementation(
      async (
        _projectDir: string,
        documents: ReadonlyMap<string, EfxPaintDocumentSaveInput>,
        writeProject: (payload: Record<string, unknown>, transactionId: string | null) => Promise<void>,
      ) => {
        const persisted: Record<string, unknown> = {};
        for (const [layerId, input] of documents) persisted[layerId] = input.document;
        await writeProject(persisted, documents.size === 0 ? null : 'txn-46-02');
        return persisted;
      },
    );
    loadEfxPaintDocuments.mockImplementation(
      async (_projectId: string, persistedMap: Record<string, unknown> | undefined) => {
        const loaded = new Map<string, EfxPaintLoadedDocument>();
        if (!persistedMap) return loaded;
        for (const [layerId, value] of Object.entries(persistedMap)) {
          const document = value as EfxPaintDocument;
          loaded.set(layerId, { document, frames: new Map([[document.activeTrackId, new Map([[0, makeFrame(0, 0)]])]]) });
        }
        return loaded;
      },
    );
    vi.spyOn(projectStore, 'closeProject');
  });

  it('builds per-track save input frames for a multi-track document (TRK-03)', async () => {
    addPhysicPaintLayer('layer-2t');
    efxPaintStoreModule.registerDocument(makeMultiTrackDocument('layer-2t'));
    const frameA = makeFrame(0, 1);
    const frameB = { ...makeFrame(0, 1), dataUrl: `data:image/png;base64,${btoa('track-b-bytes')}` };
    physicPaintStore.setFrame('layer-2t', TRACK_A, 1, frameA);
    physicPaintStore.setFrame('layer-2t', TRACK_B, 1, frameB);
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    expect(saveEfxPaintDocumentsWithProjectWrite).toHaveBeenCalledTimes(1);
    const [, documents] = saveEfxPaintDocumentsWithProjectWrite.mock.calls[0] as [
      string,
      ReadonlyMap<string, EfxPaintDocumentSaveInput>,
    ];
    const input = documents.get('layer-2t');
    expect(input).toBeDefined();
    // 46-02: the frame carrier is per-track (trackId → appFrame → frame);
    // both tracks own a frame at the same appFrame without collision.
    expect(input!.frames.size).toBe(2);
    expect(input!.frames.get(TRACK_A)?.get(1)?.dataUrl).toBe(frameA.dataUrl);
    expect(input!.frames.get(TRACK_B)?.get(1)?.dataUrl).toBe(frameB.dataUrl);
  });

  it('hydrates per-track frames into their own runtime maps on open', async () => {
    const document = makeMultiTrackDocument('layer-h');
    const trackA = document.tracks[0];
    const trackB = document.tracks[1];
    const withFrames = {
      ...document,
      tracks: [
        {
          ...trackA,
          frames: { 5: { cachePath: `cache/efx-paint/seg-a/${TRACK_A}/frame-000005-0000.png`, width: 10, height: 10 } },
        },
        {
          ...trackB,
          frames: { 5: { cachePath: `cache/efx-paint/seg-b/${TRACK_B}/frame-000005-0000.png`, width: 20, height: 20 } },
        },
      ],
    };
    const frameA = { ...makeFrame(0, 5), dataUrl: `data:image/png;base64,${btoa('hydrate-a')}` };
    const frameB = { ...makeFrame(0, 5), dataUrl: `data:image/png;base64,${btoa('hydrate-b')}` };
    loadEfxPaintDocuments.mockResolvedValue(new Map([['layer-h', {
      document: withFrames,
      frames: new Map([
        [TRACK_A, new Map([[5, frameA]])],
        [TRACK_B, new Map([[5, frameB]])],
      ]),
    }]]));
    ipcProjectOpen.mockResolvedValue({
      ok: true,
      data: { ...makeCleanProject(), efx_paint_documents: { 'layer-h': withFrames } },
    });

    await projectStore.openProject('/project/multi.mce');

    expect(efxPaintStoreModule.getDocument('layer-h')).toBeDefined();
    expect(physicPaintStore.getFrames('layer-h', TRACK_A).get(5)?.dataUrl).toBe(frameA.dataUrl);
    expect(physicPaintStore.getFrames('layer-h', TRACK_B).get(5)?.dataUrl).toBe(frameB.dataUrl);
  });

  it('regression: a single-track document keys the save input frames under the single track id', async () => {
    addPhysicPaintLayer('layer-s');
    efxPaintStoreModule.registerDocument(makeTrackDocument('layer-s'));
    physicPaintStore.setFrame('layer-s', TEST_TRACK_ID, 3, makeFrame(1, 3));
    projectStore.filePath.value = '/project/file.mce';
    projectStore.dirPath.value = '/project';

    await projectStore.saveProject();

    const [, documents] = saveEfxPaintDocumentsWithProjectWrite.mock.calls[0] as [
      string,
      ReadonlyMap<string, EfxPaintDocumentSaveInput>,
    ];
    const input = documents.get('layer-s');
    expect(input).toBeDefined();
    expect(input!.frames.size).toBe(1);
    expect(input!.frames.get(TEST_TRACK_ID)?.get(3)?.dataUrl).toBe(makeFrame(1, 3).dataUrl);
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
    const isolatedBranch = source.indexOf("createFxSequence('Physic Paint', physicPaintLayer, totalFrames.peek(), { inFrame: isolatedInFrame, outFrame: isolatedOutFrame })");
    const standardBranch = source.indexOf("createFxSequence('Physic Paint', physicPaintLayer, totalFrames.peek())");
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
    expect(source).toContain("name: 'Physic Paint'");
  });
});
