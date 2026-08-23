import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument, type EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import type { PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  EFX_PAINT_CACHE_DIR,
  saveEfxPaintDocumentsWithProjectWrite,
  stableSegment,
  type EfxPaintDocumentSaveInput,
} from '../lib/efxPaintPersistence';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import {
  commitDeleteTrack,
  getDocument,
  registerDocument,
  requestDeleteTrack,
  reset as resetEfxPaintStore,
  takePendingTrackDeletions,
  _setEfxPaintMarkDirtyCallback,
} from './efxPaintStore';
import {
  getTrackPaintVersion,
  mountTrackRuntime,
  physicPaintStore,
  severTrackHoldReferences,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';

// 46-05 track deletion laws: requestDeleteTrack/commitDeleteTrack delete
// exactly one internal track — preview, explicit acknowledgement (D-14),
// last-track refusal (D-17), full 46-01 runtime teardown, Hold reference
// severing (D-16), nearest-adjacent active-track re-point (D-18), and sidecar
// removal inside the save cache transaction (D-15).
// Node env, vitest run only; no jsdom, no config changes.

// Task 3 (D-15) needs the same in-memory fs/ipc doubles as
// efxPaintPersistence.test.ts — the sidecar transaction is asserted through
// the actual `remove` calls, never through on-disk state.
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();
const PROJECT_DIR = '/project/root';

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

// Same absolute module id as efxPaintPersistence's './ipc' import.
vi.mock('../lib/ipc', () => ({
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
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
    files.set(path, contents);
  }),
}));

const LAYER = 'layer-delete-laws';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';
const TRACK_C = 'track-c';
const CAPACITY = 24;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

const makeFrame = (frameIndex: number, appFrame: number, tag: string) => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 1000,
  height: 650,
});

const makeRecord = (keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId,
  appFrame,
  payload: { frameIndex: 0, appFrame, dataUrl: `data:image/png;base64,${btoa(tag)}`, width: 4, height: 4 },
});

/** A Hold (static-mode) Loop Clip whose source frames live on a track. */
const makeLoop = (loopId: string, placementStart: number, sourceKeyIds: readonly string[]): PhysicPaintRotoLoopClip => ({
  loopId,
  placementStart,
  sourceKeyIds,
  repeat: 1,
  mode: 'static',
});

/** Multi-track document fixture with canonical shape (tracks keep stable order). */
function makeMultiTrackDocument(layerId: string, trackIds: readonly string[], activeTrackId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const base = document.tracks[0];
  return {
    ...document,
    activeTrackId,
    tracks: trackIds.map((id, index) => ({
      ...base,
      id,
      name: `Track ${index + 1}`,
      order: index,
      frames: {},
      rotoPhysical: null,
      loopClips: [],
    })),
  };
}

/** Seed one track with records + loops + runtime frames (records first). */
function seedTrack(
  trackId: string,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loops: readonly PhysicPaintRotoLoopClip[] = [],
): void {
  const seeded = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, CAPACITY);
  if (!seeded.ok) throw new Error(`Seed failed for ${trackId}: ${seeded.error}`);
  const loopsResult = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, trackId, loops);
  if (!loopsResult.ok) throw new Error(`Seed loops failed for ${trackId}: ${loopsResult.error}`);
  for (const record of records) {
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, trackId, record.appFrame, makeFrame(0, record.appFrame, `frame-${record.keyId}`));
  }
}

/** Install loop clips directly through the document-install port (bypasses the
 *  46-06 Task 3 creation gate — legitimate for D-31 dangling/cross-track
 *  fixtures; the same seam hydration and Hold severing use). */
function installTrackLoops(trackId: string, loops: readonly PhysicPaintRotoLoopClip[]): void {
  const current = physicPaintStore.getRotoPhysicalDocument(LAYER, trackId);
  if (!current) throw new Error(`No runtime for ${trackId}`);
  const installed = physicPaintStore.replaceRotoPhysicalDocument(LAYER, trackId, { ...current, loopClips: loops });
  if (!installed.ok) throw new Error(`Install loops failed for ${trackId}: ${installed.error}`);
}

function seedDocument(
  trackIds: readonly string[],
  activeTrackId: string,
  seeding: (trackId: string) => void = () => {},
): void {
  registerDocument(makeMultiTrackDocument(LAYER, trackIds, activeTrackId));
  for (const trackId of trackIds) {
    mountTrackRuntime(LAYER, trackId);
    seeding(trackId);
  }
}

describe('requestDeleteTrack preview (46-05 D-14)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('returns a complete preview (frames, clips, hold references, isLastTrack) without mutating anything', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) {
        seedTrack(trackId, [makeRecord('key-a-1', 1, 'a@1')]);
        installTrackLoops(trackId, [
          makeLoop('loop-a-1', 0, ['key-a-1']),
          // One Hold clip on surviving track A referencing B's key (D-16 surface).
          makeLoop('loop-a-hold', 2, ['key-b-1']),
        ]);
      } else {
        seedTrack(trackId, [makeRecord('key-b-1', 1, 'b@1'), makeRecord('key-b-2', 5, 'b@2')], [makeLoop('loop-b-1', 0, ['key-b-1'])]);
      }
    });

    const documentBefore = getDocument(LAYER);
    const preview = requestDeleteTrack(LAYER, TRACK_B);

    expect(preview).not.toBeNull();
    expect(preview!.layerId).toBe(LAYER);
    expect(preview!.trackId).toBe(TRACK_B);
    expect(preview!.frameCount).toBe(2); // B's real-key runtime frames
    expect(preview!.loopClipCount).toBe(1); // B's own clip count
    expect(preview!.holdReferenceCount).toBe(1); // A's Hold clip referencing B
    expect(preview!.isLastTrack).toBe(false);
    // The document and the runtime are untouched by the preview.
    expect(getDocument(LAYER)).toBe(documentBefore);
    expect(physicPaintStore.getFrames(LAYER, TRACK_B).size).toBe(2);
  });

  it('returns null for an unknown track or absent document', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A);
    expect(requestDeleteTrack(LAYER, 'ghost-track')).toBeNull();
    expect(requestDeleteTrack('no-such-layer', TRACK_A)).toBeNull();
  });
});

describe('commitDeleteTrack acknowledge gate (46-05 D-14)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('fails closed without acknowledgement and succeeds with it', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
      else seedTrack(trackId, [makeRecord('key-b', 10, 'b')]);
    });
    const documentBefore = getDocument(LAYER);
    const revisionBefore = buildEfxPaintDocumentRevision(documentBefore);

    const refused = commitDeleteTrack(LAYER, TRACK_B, false);
    expect(refused).toEqual({ ok: false, error: 'delete not acknowledged' });
    expect(getDocument(LAYER)).toBe(documentBefore);
    expect(buildEfxPaintDocumentRevision(getDocument(LAYER))).toBe(revisionBefore);
    expect(physicPaintStore.getFrames(LAYER, TRACK_B).size).toBe(1);

    const committed = commitDeleteTrack(LAYER, TRACK_B, true);
    expect(committed).toEqual({ ok: true });
    expect(getDocument(LAYER)!.tracks.some((track) => track.id === TRACK_B)).toBe(false);
    expect(physicPaintStore.getFrames(LAYER, TRACK_B).size).toBe(0);
  });

  it('refuses to delete the last surviving Paint track and writes nothing', () => {
    seedDocument([TRACK_A], TRACK_A, (trackId) => seedTrack(trackId, [makeRecord('key-a', 10, 'a')]));
    const documentBefore = getDocument(LAYER);
    const revisionBefore = buildEfxPaintDocumentRevision(documentBefore);

    const result = commitDeleteTrack(LAYER, TRACK_A, true);
    expect(result).toEqual({ ok: false, error: 'last-track' });
    expect(getDocument(LAYER)).toBe(documentBefore);
    expect(getDocument(LAYER)!.activeTrackId).toBe(TRACK_A);
    expect(buildEfxPaintDocumentRevision(getDocument(LAYER))).toBe(revisionBefore);
    expect(physicPaintStore.getFrames(LAYER, TRACK_A).size).toBe(1);
  });

  it('fails closed for an unknown track with no mutation', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
    });
    const documentBefore = getDocument(LAYER);
    const revisionBefore = buildEfxPaintDocumentRevision(documentBefore);

    const result = commitDeleteTrack(LAYER, 'ghost-track', true);
    expect(result.ok).toBe(false);
    expect(getDocument(LAYER)).toBe(documentBefore);
    expect(buildEfxPaintDocumentRevision(getDocument(LAYER))).toBe(revisionBefore);
    expect(getDocument(LAYER)!.tracks.length).toBe(2);
    expect(physicPaintStore.getFrames(LAYER, TRACK_A).size).toBe(1);
  });
});

describe('commitDeleteTrack full per-track teardown (46-05 D-16)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('tears down exactly the deleted track; the survivor is byte-identical', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) {
        seedTrack(trackId, [makeRecord('key-a-1', 1, 'a@1')]);
        installTrackLoops(trackId, [makeLoop('loop-a-hold', 2, ['key-b-1'])]);
      } else {
        seedTrack(trackId, [makeRecord('key-b-1', 1, 'b@1'), makeRecord('key-b-2', 5, 'b@2')], [makeLoop('loop-b-1', 0, ['key-b-1'])]);
      }
    });
    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_B, 'key-b-1', 1);
    const lease = physicPaintStore.acquireRotoPhysicalOperationLease('ctx-delete', LAYER, TRACK_B);
    expect(lease).not.toBeNull();

    const framesA = physicPaintStore.getFrames(LAYER, TRACK_A);
    const recordsA = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A);
    const versionA = getTrackPaintVersion(LAYER, TRACK_A).value;

    const committed = commitDeleteTrack(LAYER, TRACK_B, true);
    expect(committed).toEqual({ ok: true });

    // B's complete runtime is gone: frames, records, clips, projection
    // (structural memo key), selection, and leases are all settled.
    expect(physicPaintStore.hasTrackRuntime(LAYER, TRACK_B)).toBe(false);
    expect(physicPaintStore.getFrames(LAYER, TRACK_B).size).toBe(0);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_B)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK_B)).toBeNull();
    expect(physicPaintStore.isRotoPhysicalOperationAvailable('ctx-delete', LAYER, TRACK_B)).toBe(true);
    expect(physicPaintStore.validateRotoPhysicalOperationLease('ctx-delete', LAYER, TRACK_B, lease))
      .toEqual({ ok: false, reason: 'replayed-token' });
    expect(getDocument(LAYER)!.tracks.some((track) => track.id === TRACK_B)).toBe(false);

    // A's runtime is untouched by the teardown.
    expect(physicPaintStore.getFrames(LAYER, TRACK_A)).toEqual(framesA);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toEqual(recordsA);
    expect(getTrackPaintVersion(LAYER, TRACK_A).value).toBe(versionA);
  });
});

describe('commitDeleteTrack hold severing (46-05 D-16 / T-46-14)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('severs every surviving Hold referencing the deleted track; the resolver answers linked-unresolved', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) {
        seedTrack(trackId, [makeRecord('key-a-1', 1, 'a@1')]);
        installTrackLoops(trackId, [
          makeLoop('loop-a-hold', 2, ['key-b-1']),
          makeLoop('loop-a-own', 4, ['key-a-1']),
        ]);
      } else {
        seedTrack(trackId, [makeRecord('key-b-1', 1, 'b@1')]);
      }
    });

    // Only the cross-track Hold is severed; own-track Hold and B's own clips
    // are untouched.
    const severed = severTrackHoldReferences(LAYER, TRACK_B);
    expect(severed).toBe(1);

    const committed = commitDeleteTrack(LAYER, TRACK_B, true);
    expect(committed).toEqual({ ok: true });

    // The severed Hold answers 'linked-unresolved' (D-13 fail-closed), never
    // a dangling or foreign-track reference.
    const unresolved = physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, TRACK_A, 0, CAPACITY);
    expect(unresolved.some((loop) => loop.loopId === 'loop-a-hold' && loop.missingSourceKeyIds.includes('key-b-1'))).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, 2)?.kind).toBe('loop-placeholder');

    // The rebuilt document carries the severed Hold verbatim (D-31 dangling
    // refs are legal and preserved) and the survivor's own Hold is intact.
    const rotoA = getDocument(LAYER)!.tracks.find((track) => track.id === TRACK_A)!.rotoPhysical!;
    const hold = rotoA.loopClips.find((clip) => clip.loopId === 'loop-a-hold');
    expect(hold).toBeDefined();
    expect(hold!.sourceKeyIds).toEqual(['key-b-1']);
    expect(rotoA.loopClips.some((clip) => clip.loopId === 'loop-a-own')).toBe(true);
  });
});

describe('commitDeleteTrack nearest-adjacent activation (46-05 D-18)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('re-points activeTrackId to the next survivor when the deleted track is not last', () => {
    seedDocument([TRACK_A, TRACK_B, TRACK_C], TRACK_B, (trackId) => {
      if (trackId === TRACK_B) seedTrack(trackId, [makeRecord('key-b', 10, 'b')]);
    });
    expect(commitDeleteTrack(LAYER, TRACK_B, true)).toEqual({ ok: true });
    expect(getDocument(LAYER)!.activeTrackId).toBe(TRACK_C);
  });

  it('re-points to the first survivor when the deleted track is first', () => {
    seedDocument([TRACK_A, TRACK_B, TRACK_C], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
    });
    expect(commitDeleteTrack(LAYER, TRACK_A, true)).toEqual({ ok: true });
    expect(getDocument(LAYER)!.activeTrackId).toBe(TRACK_B);
  });

  it('re-points to the previous survivor when the deleted track is last', () => {
    seedDocument([TRACK_A, TRACK_B, TRACK_C], TRACK_B, (trackId) => {
      if (trackId === TRACK_C) seedTrack(trackId, [makeRecord('key-c', 10, 'c')]);
    });
    expect(commitDeleteTrack(LAYER, TRACK_C, true)).toEqual({ ok: true });
    expect(getDocument(LAYER)!.activeTrackId).toBe(TRACK_B);
  });

  it('keeps the active track when a non-active track is deleted', () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
    });
    expect(commitDeleteTrack(LAYER, TRACK_B, true)).toEqual({ ok: true });
    expect(getDocument(LAYER)!.activeTrackId).toBe(TRACK_A);
  });
});

describe('commitDeleteTrack revision and dirty signaling (46-05)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('bumps the document revision and fires the dirty callback exactly once', () => {
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
      else seedTrack(trackId, [makeRecord('key-b', 10, 'b')]);
    });
    const revisionBefore = buildEfxPaintDocumentRevision(getDocument(LAYER)!);
    dirty.mockClear();

    const committed = commitDeleteTrack(LAYER, TRACK_B, true);
    expect(committed).toEqual({ ok: true });
    expect(buildEfxPaintDocumentRevision(getDocument(LAYER)!)).not.toBe(revisionBefore);
    expect(dirty).toHaveBeenCalledTimes(1);
  });
});

describe('commitDeleteTrack sidecar deletion through the cache transaction (46-05 D-15)', () => {
  beforeEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
    files.clear();
    dirs.clear();
    vi.clearAllMocks();
    const activeTransactions = new Map<string, string>();
    publishPhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, stagingBasename: string) => {
      const transactionId = crypto.randomUUID();
      activeTransactions.set(transactionId, stagingBasename);
      exchangeGeneration(projectDir, stagingBasename);
      return { ok: true, data: { accepted: true, transactionId, replacedExisting: true } };
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

  /** The post-delete save input the way projectStore.buildEfxPaintDocuments merges it. */
  function buildSaveInput(): Map<string, EfxPaintDocumentSaveInput> {
    const document = getDocument(LAYER)!;
    const framesPerTrack = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
    for (const track of document.tracks) {
      framesPerTrack.set(track.id, physicPaintStore.getFrames(LAYER, track.id));
    }
    return new Map([[LAYER, { document, frames: framesPerTrack, deletions: takePendingTrackDeletions(LAYER) }]]);
  }

  it('removes the deleted track sidecar directory at commit; no survivor directory is touched', async () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
      else seedTrack(trackId, [makeRecord('key-b', 10, 'b')]);
    });
    const deletedDir = `${EFX_PAINT_CACHE_DIR}/${stableSegment(LAYER)}/${TRACK_B}`;
    const survivorDir = `${EFX_PAINT_CACHE_DIR}/${stableSegment(LAYER)}/${TRACK_A}`;

    expect(commitDeleteTrack(LAYER, TRACK_B, true)).toEqual({ ok: true });
    const { remove } = await import('@tauri-apps/plugin-fs');
    const removeMock = vi.mocked(remove);
    removeMock.mockClear();

    // The sidecar dirs exist on disk when the transaction commits — the
    // publish mock's generation exchange wipes the canonical root, so they
    // are (re)seeded in the writeProject callback that runs between prepare
    // and the commit arm, which is exactly when the fs remove() must fire.
    const persisted = await saveEfxPaintDocumentsWithProjectWrite(PROJECT_DIR, buildSaveInput(), async () => {
      dirs.add(`${PROJECT_DIR}/${deletedDir}`);
      dirs.add(`${PROJECT_DIR}/${survivorDir}`);
      files.set(`${PROJECT_DIR}/${deletedDir}/frame-000000-0000.png`, new Uint8Array([1]));
    });
    expect(persisted).toBeDefined();
    expect(removeMock).toHaveBeenCalledWith(`${PROJECT_DIR}/${deletedDir}`, { recursive: true });
    expect(removeMock).not.toHaveBeenCalledWith(`${PROJECT_DIR}/${survivorDir}`, { recursive: true });
    expect(dirs.has(`${PROJECT_DIR}/${deletedDir}`)).toBe(false);
    expect(files.has(`${PROJECT_DIR}/${deletedDir}/frame-000000-0000.png`)).toBe(false);
    expect(dirs.has(`${PROJECT_DIR}/${survivorDir}`)).toBe(true);
  });

  it('rollback keeps the deleted track sidecar directory (nothing removed outside the committed transaction)', async () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
      else seedTrack(trackId, [makeRecord('key-b', 10, 'b')]);
    });
    const deletedDir = `${EFX_PAINT_CACHE_DIR}/${stableSegment(LAYER)}/${TRACK_B}`;

    expect(commitDeleteTrack(LAYER, TRACK_B, true)).toEqual({ ok: true });
    const { remove } = await import('@tauri-apps/plugin-fs');
    const removeMock = vi.mocked(remove);
    removeMock.mockClear();

    await expect(
      saveEfxPaintDocumentsWithProjectWrite(PROJECT_DIR, buildSaveInput(), async () => {
        // The sidecar dir exists on disk when the failing write happens.
        dirs.add(`${PROJECT_DIR}/${deletedDir}`);
        files.set(`${PROJECT_DIR}/${deletedDir}/frame-000000-0000.png`, new Uint8Array([1]));
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');
    // Rollback never removes: the deletion list is settled only by the
    // commit arm (the mock generation exchange wipes on-disk state, so the
    // fs remove() call contract is the authoritative assertion).
    expect(removeMock).not.toHaveBeenCalledWith(`${PROJECT_DIR}/${deletedDir}`, { recursive: true });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('clears the pending deletion list on read — a second save is a no-op deletion-wise', async () => {
    seedDocument([TRACK_A, TRACK_B], TRACK_A, (trackId) => {
      if (trackId === TRACK_A) seedTrack(trackId, [makeRecord('key-a', 10, 'a')]);
      else seedTrack(trackId, [makeRecord('key-b', 10, 'b')]);
    });
    const deletedDir = `${EFX_PAINT_CACHE_DIR}/${stableSegment(LAYER)}/${TRACK_B}`;
    dirs.add(`${PROJECT_DIR}/${deletedDir}`);

    expect(commitDeleteTrack(LAYER, TRACK_B, true)).toEqual({ ok: true });
    expect(takePendingTrackDeletions(LAYER)).toEqual([deletedDir]);
    // Cleared on read; the committed save's input is built before it runs.
    expect(takePendingTrackDeletions(LAYER)).toEqual([]);

    const { remove } = await import('@tauri-apps/plugin-fs');
    const removeMock = vi.mocked(remove);
    removeMock.mockClear();
    const persisted = await saveEfxPaintDocumentsWithProjectWrite(PROJECT_DIR, buildSaveInput(), async () => {});
    expect(persisted).toBeDefined();
    expect(removeMock).not.toHaveBeenCalled();
    expect(takePendingTrackDeletions(LAYER)).toEqual([]);
  });
});
