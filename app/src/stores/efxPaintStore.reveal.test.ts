import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
  _setPhysicPaintCompositorSizeProvider,
  registerReferenceSourceImage,
} from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  _setEfxPaintRevealScriptLoader,
  createRevealRail,
  deleteRevealRail,
  getDocument,
  registerDocument,
  replayRevealRail,
  reset,
  resizeRevealRail,
  resyncRuntimeForBackgroundEdit,
  serializeRuntimeIntoDocument,
  setPhotoReferenceSource,
} from './efxPaintStore';
import type { BackgroundEditDescriptor } from './efxPaintStore';

/**
 * 52-01 (RVL-06): the reveal rail undo-by-reference semantics. Every committed
 * reveal mutation (create/replay/delete/span-shrink) emits a
 * `BackgroundEditDescriptor` with a distinct `'reveal-*'` operation kind and
 * `before`/`after` by reference — undo restores the prior document object,
 * redo re-applies the next one, never raster-byte snapshots.
 *
 * 52 CR-01: the reveal mutations ALSO write the runtime store (baked records
 * via commitRevealBake, rail clip via replaceRotoPhysicalLoopClips). The
 * shared 'background' undo/redo path restores the document by reference and
 * calls `resyncRuntimeForBackgroundEdit` to re-install the affected track's
 * runtime from the restored document. These tests mirror that exact seam and
 * assert the runtime (`physicPaintStore.getRotoPhysicalLoopClips` /
 * `getRotoRealKeyRecords`) as well as the document object.
 */

const harness = vi.hoisted(() => ({
  renderReveal: vi.fn(),
}));

vi.mock('../components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer', () => ({
  renderRotoRevealFrames: harness.renderReveal,
}));

const TEST_TRACK_ID = 'track-1';

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

const script = {
  provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
  sourceFrame: 0,
  sourceDisplayFrame: 0,
  sourceRevision: 1,
  brushes: [],
};

type OkRevealMutation = { ok: true; descriptor: BackgroundEditDescriptor | null };

/** A valid 1x1 transparent PNG data URL — the canonical payload guard requires a real PNG signature. */
const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function stagedFrames(start: number, count: number, dataUrl = PNG_1X1): Array<{ frameIndex: number; appFrame: number; dataUrl: string; width: number; height: number; source: 'real-key' }> {
  return Array.from({ length: count }, (_, index) => ({
    frameIndex: index,
    appFrame: start + index,
    dataUrl,
    width: 4,
    height: 3,
    source: 'real-key' as const,
  }));
}

async function createRail(layerId: string, startFrame = 10, frameCount = 2, variant: 'progressive' | 'static' = 'progressive'): Promise<BackgroundEditDescriptor> {
  harness.renderReveal.mockResolvedValue(stagedFrames(startFrame, frameCount));
  const result = await createRevealRail(layerId, {
    trackId: TEST_TRACK_ID,
    scriptId: 'script-1',
    variant,
    startFrame,
    frameCount,
  });
  expect(result.ok).toBe(true);
  return (result as OkRevealMutation).descriptor!;
}

describe('reveal rail create + bake + flattened + undo (52-01 Task 1)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
    _setEfxPaintRevealScriptLoader(async () => script);
    harness.renderReveal.mockReset();
  });

  afterEach(() => {
    _setPhysicPaintCompositorSizeProvider(null);
    _setEfxPaintRevealScriptLoader(null);
  });

  it('createRevealRail creates the rail AND bakes it in one action (D-11)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const preCreate = getDocument(layerId)!;

    const descriptor = await createRail(layerId);
    expect(descriptor.operationKind).toBe('reveal-create');
    expect(descriptor.before).toBe(preCreate);
    expect(descriptor.after).toBe(getDocument(layerId));

    const after = getDocument(layerId)!;
    const track = after.tracks.find((candidate) => candidate.id === TEST_TRACK_ID)!;
    const loopClips = track.rotoPhysical!.loopClips;
    expect(loopClips).toHaveLength(1);
    expect(loopClips[0].railKind).toBe('reveal');
    expect(loopClips[0].mode).toBe('progressive');
    expect(loopClips[0].scriptId).toBe('script-1');
    expect(loopClips[0].placementStart).toBe(10);
    expect(loopClips[0].sourceKeyIds).toHaveLength(2);

    // The baked keys are ordinary real track content.
    const records = physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID);
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.appFrame)).toEqual([10, 11]);
    expect(records.map((record) => record.payload.dataUrl)).toEqual([PNG_1X1, PNG_1X1]);

    expect(after.documentRevision).toBe(preCreate.documentRevision + 1);
  });

  it('fail-closes when the photo reference is absent (D-12 creation guard)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    const result = await createRevealRail(layerId, {
      trackId: TEST_TRACK_ID,
      scriptId: 'script-1',
      variant: 'progressive',
      startFrame: 10,
      frameCount: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-photo-reference');
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(0);
  });

  it('fail-closes when the library script is deleted (D-13)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    _setEfxPaintRevealScriptLoader(async () => null);
    const result = await createRevealRail(layerId, {
      trackId: TEST_TRACK_ID,
      scriptId: 'missing-script',
      variant: 'progressive',
      startFrame: 10,
      frameCount: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('script-not-found');
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(0);
  });

  it('baked keys appear in flattened output through the unchanged compositor (D-02)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    await createRail(layerId);

    // The baked keys are ordinary track content: the flattened seam resolves
    // them like any real key (D-02 — one track pipeline, no second compositor).
    // The compositor decodes the key dataUrls via `new Image()` — stub the
    // decode surface like the photo-reference exclusion test does.
    class FlatImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 4;
      height = 3;
      private currentSrc = '';
      set src(value: string) { this.currentSrc = value; this.onload?.(); }
      get src(): string { return this.currentSrc; }
    }
    class FlatCanvas {
      width = 0;
      height = 0;
      getContext(): { drawImage(): void; clearRect(): void; save(): void; restore(): void; globalAlpha: number; globalCompositeOperation: string } | null {
        return { drawImage() {}, clearRect() {}, save() {}, restore() {}, globalAlpha: 1, globalCompositeOperation: 'source-over' };
      }
      toDataURL(): string { return PNG_1X1; }
    }
    vi.stubGlobal('Image', FlatImage);
    vi.stubGlobal('HTMLImageElement', FlatImage);
    vi.stubGlobal('HTMLCanvasElement', FlatCanvas);
    vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? new FlatCanvas() : {}) });

    const flattened = physicPaintStore.getFlattenedFrame(layerId, 10);
    expect(flattened).not.toBeNull();
    expect(flattened!.renderedFrame).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('bakes at the WORKING canvas size with the project→working zoom, matching the PlayScript size authority (G-52-2a)', async () => {
    _setPhysicPaintCompositorSizeProvider(() => ({ width: 1920, height: 1080 }));
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');

    await createRail(layerId);
    // Script strokes live in working coordinates: the bake must render at
    // getPhysicsPaintWorkingSize(1920×1080) = 1000×563 — never the project
    // size — and hand the mask composite the ghost zoom (1000/1920).
    expect(harness.renderReveal).toHaveBeenCalledWith(expect.objectContaining({
      size: { width: 1000, height: 563 },
      reference: expect.objectContaining({ zoom: 1000 / 1920 }),
    }));
  });

  it('stamps the full 43-06 lifecycle at creation so the reveal rail is a first-class Group for every tool (G-52-4)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');

    await createRail(layerId, 10, 2);
    const track = getDocument(layerId)!.tracks.find((candidate) => candidate.id === TEST_TRACK_ID)!;
    const clip = track.rotoPhysical!.loopClips[0];
    // The lifecycle-less split-brain shape poisoned every classifier/consumer
    // (paint-COW, drag, spacing). The reveal clip is born lifecycle-complete.
    expect(clip.syncState).toBe('synchronized');
    expect(clip.provenanceState).toBe('attached');
    expect(clip.phaseOrigin).toBe(10);
    expect(clip.originalEndExclusive).toBe(12);
    expect(clip.visibleRanges).toEqual([{ start: 10, endExclusive: 12 }]);
    expect(clip.frameOverrides).toEqual([]);
  });

  it('keeps the live document identity stable under serializeRuntimeIntoDocument after a reveal create (G-52-5)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');

    const descriptor = await createRail(layerId);
    // The Studio pushes the live runtime projection on every efxPaintVersion
    // bump (pushLiveProjection). If that projection diverges from the recorded
    // `after` document, serializeRuntimeIntoDocument installs an UNRECORDED
    // replacement and the undo live-authority guard (getDocument !== after)
    // fails closed forever — Cmd+Z dies. The projection must be a revision
    // no-op so the live object stays the recorded `after` by identity.
    serializeRuntimeIntoDocument(layerId);
    expect(getDocument(layerId)).toBe(descriptor.after);
  });

  it('pins an Infinity reveal rail lifecycle to one cycle (the resolver extends it to capacity) (G-52-4)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    harness.renderReveal.mockResolvedValue(stagedFrames(10, 2));

    const result = await createRevealRail(layerId, {
      trackId: TEST_TRACK_ID,
      scriptId: 'script-1',
      variant: 'progressive',
      startFrame: 10,
      frameCount: 2,
      repeat: 'infinity',
    });
    expect(result.ok).toBe(true);
    const track = getDocument(layerId)!.tracks.find((candidate) => candidate.id === TEST_TRACK_ID)!;
    const clip = track.rotoPhysical!.loopClips[0];
    expect(clip.repeat).toBe('infinity');
    expect(clip.syncState).toBe('synchronized');
    expect(clip.originalEndExclusive).toBe(12); // one cycle pinned; never lifecycle-less
    expect(clip.visibleRanges).toEqual([{ start: 10, endExclusive: 12 }]);
  });

  it('carries the creation-time repeat law and motion wiggle into the bake and the rail record (G-52-3, D-08/D-09)', async () => {    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    harness.renderReveal.mockResolvedValue(stagedFrames(10, 2));

    const result = await createRevealRail(layerId, {
      trackId: TEST_TRACK_ID,
      scriptId: 'script-1',
      variant: 'static',
      startFrame: 10,
      frameCount: 2,
      repeat: 'infinity',
      motion: { deformation: 10, position: 20 },
    });
    expect(result.ok).toBe(true);
    expect(harness.renderReveal).toHaveBeenCalledWith(expect.objectContaining({
      motion: { deformation: 10, position: 20 },
      mode: 'static',
    }));
    const track = getDocument(layerId)!.tracks.find((candidate) => candidate.id === TEST_TRACK_ID)!;
    expect(track.rotoPhysical!.loopClips[0].repeat).toBe('infinity');
    expect(track.rotoPhysical!.loopClips[0].motion).toEqual({ deformation: 10, position: 20 });

    // An invalid finite repeat fails closed before any bake.
    const rejected = await createRevealRail(layerId, {
      trackId: TEST_TRACK_ID,
      scriptId: 'script-1',
      variant: 'progressive',
      startFrame: 20,
      frameCount: 1,
      repeat: 0,
    });
    expect(rejected).toEqual({ ok: false, reason: 'invalid-span' });
  });

  it('undo restores the pre-rail document by reference (RVL-06)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const preCreate = getDocument(layerId)!;
    const descriptor = await createRail(layerId);

    // The reveal mutation wrote the runtime too — the rail clip + baked keys
    // are live (CR-01 baseline for the undo assertions below).
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)).toHaveLength(1);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(2);

    // Undo mirrors the real path (useRotoPhysicalEditHistory.ts 'background'
    // branch): resync the affected track's runtime from the `before` document,
    // then restore the exact prior document object by reference — the pre-rail
    // document carries no rail and no baked keys (RVL-06).
    expect(resyncRuntimeForBackgroundEdit(descriptor, 'undo')).toBe(true);
    registerDocument(descriptor.before);
    expect(getDocument(layerId)).toBe(preCreate);
    expect(getDocument(layerId)!.tracks[0].rotoPhysical).toBeNull();
    // CR-01: the runtime is re-synced too — no orphaned rail clip, no orphaned
    // baked key records (previously they survived undo and were re-projected by
    // the next serializeRuntimeIntoDocument).
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)).toHaveLength(0);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(0);

    // Redo: re-apply the exact post-create document object by reference and
    // re-sync the runtime back to the created rail + keys.
    expect(resyncRuntimeForBackgroundEdit(descriptor, 'redo')).toBe(true);
    registerDocument(descriptor.after);
    expect(getDocument(layerId)).toBe(descriptor.after);
    expect(getDocument(layerId)!.tracks[0].rotoPhysical!.loopClips).toHaveLength(1);
    expect(getDocument(layerId)!.tracks[0].rotoPhysical!.realKeyRecords).toHaveLength(2);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)).toHaveLength(1);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(2);
  });
});

describe('reveal rail undo-by-reference — replay/delete/span (52-01 Task 3, RVL-06)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
    _setEfxPaintRevealScriptLoader(async () => script);
    harness.renderReveal.mockReset();
  });

  afterEach(() => {
    _setPhysicPaintCompositorSizeProvider(null);
    _setEfxPaintRevealScriptLoader(null);
  });

  it('replay (overwrite) is one undo-ledger entry; undo restores the prior baked keys including hand edits (D-05)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const createDescriptor = await createRail(layerId);
    const loopId = createDescriptor.after.tracks[0].rotoPhysical!.loopClips[0].loopId;

    // A hand edit inside the span (an ordinary key eraser / paint) is replaced
    // on replay — the replay overwrites every baked key in the span (D-05).
    const preReplay = getDocument(layerId)!;
    const replayedPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    harness.renderReveal.mockResolvedValue(stagedFrames(10, 2, replayedPng));
    const replayResult = await replayRevealRail(layerId, loopId);
    expect(replayResult.ok).toBe(true);
    const replayDescriptor = (replayResult as OkRevealMutation).descriptor!;
    expect(replayDescriptor.operationKind).toBe('reveal-replay');
    expect(replayDescriptor.before).toBe(preReplay);
    expect(replayDescriptor.after).toBe(getDocument(layerId));

    const records = physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID);
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.payload.dataUrl === replayedPng)).toBe(true);
    // The rail clip survives replay (its span is re-baked, D-05).
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)).toHaveLength(1);

    // Undo mirrors the real path: resync the runtime from the pre-replay
    // document, then restore the prior baked keys by reference (D-05 — the
    // pre-replay PNG_1X1 keys, not the replayedPng overwrite, return).
    expect(resyncRuntimeForBackgroundEdit(replayDescriptor, 'undo')).toBe(true);
    registerDocument(replayDescriptor.before);
    expect(getDocument(layerId)).toBe(preReplay);
    const restored = getDocument(layerId)!.tracks[0].rotoPhysical!.realKeyRecords;
    expect(restored.map((record) => record.payload.dataUrl)).toEqual([PNG_1X1, PNG_1X1]);
    // CR-01: the RUNTIME is re-synced too — the replayedPng records are gone
    // (previously the runtime kept them and the next serialize re-projected the
    // overwritten keys back into the document).
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID).map((record) => record.payload.dataUrl)).toEqual([PNG_1X1, PNG_1X1]);
  });

  it('delete reveal rail is one undo-ledger entry; undo restores the whole rail + keys unit (D-06)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const createDescriptor = await createRail(layerId);
    const loopId = createDescriptor.after.tracks[0].rotoPhysical!.loopClips[0].loopId;

    const preDelete = getDocument(layerId)!;
    const deleteResult = deleteRevealRail(layerId, loopId);
    expect(deleteResult.ok).toBe(true);
    const deleteDescriptor = (deleteResult as OkRevealMutation).descriptor!;
    expect(deleteDescriptor.operationKind).toBe('reveal-delete');
    expect(deleteDescriptor.before).toBe(preDelete);
    expect(deleteDescriptor.after).toBe(getDocument(layerId));

    // The rail + baked keys are gone as one unit (document AND runtime).
    const afterDelete = getDocument(layerId)!;
    expect(afterDelete.tracks[0].rotoPhysical!.loopClips).toHaveLength(0);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)).toHaveLength(0);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(0);

    // Undo mirrors the real path: resync the runtime from the pre-delete
    // document, then restore the whole rail + keys unit by reference.
    expect(resyncRuntimeForBackgroundEdit(deleteDescriptor, 'undo')).toBe(true);
    registerDocument(deleteDescriptor.before);
    expect(getDocument(layerId)).toBe(preDelete);
    expect(getDocument(layerId)!.tracks[0].rotoPhysical!.loopClips).toHaveLength(1);
    expect(getDocument(layerId)!.tracks[0].rotoPhysical!.realKeyRecords).toHaveLength(2);
    // CR-01: the runtime is re-synced too — the rail clip and its baked keys
    // are restored for rendering / strip display.
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)).toHaveLength(1);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID)).toHaveLength(2);
  });

  it('span shrink is one undo-ledger entry; undo recovers the deleted keys (D-07)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const createDescriptor = await createRail(layerId, 10, 3);
    const loopId = createDescriptor.after.tracks[0].rotoPhysical!.loopClips[0].loopId;

    const preShrink = getDocument(layerId)!;
    const shrinkResult = resizeRevealRail(layerId, loopId, 12);
    expect(shrinkResult.ok).toBe(true);
    const shrinkDescriptor = (shrinkResult as OkRevealMutation).descriptor!;
    expect(shrinkDescriptor.operationKind).toBe('reveal-span');
    expect(shrinkDescriptor.before).toBe(preShrink);
    expect(shrinkDescriptor.after).toBe(getDocument(layerId));

    // Shrink deletes the baked key now outside the span (frame 12 is gone).
    const afterShrink = getDocument(layerId)!;
    const records = physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID);
    expect(records.map((record) => record.appFrame)).toEqual([10, 11]);
    expect(afterShrink.tracks[0].rotoPhysical!.loopClips[0].sourceKeyIds).toHaveLength(2);
    // G-52-4: the stamped lifecycle follows the surviving cycle so the derived
    // extent matches the span law exactly.
    const shrunkClip = afterShrink.tracks[0].rotoPhysical!.loopClips[0];
    expect(shrunkClip.originalEndExclusive).toBe(12);
    expect(shrunkClip.visibleRanges).toEqual([{ start: 10, endExclusive: 12 }]);

    // Undo mirrors the real path: resync the runtime from the pre-shrink
    // document, then recover the deleted key by reference.
    expect(resyncRuntimeForBackgroundEdit(shrinkDescriptor, 'undo')).toBe(true);
    registerDocument(shrinkDescriptor.before);
    expect(getDocument(layerId)).toBe(preShrink);
    expect(getDocument(layerId)!.tracks[0].rotoPhysical!.realKeyRecords.map((record) => record.appFrame)).toEqual([10, 11, 12]);
    // CR-01: the runtime is re-synced too — frame 12's baked key is back in
    // both the record set and the rail clip source cycle.
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TEST_TRACK_ID).map((record) => record.appFrame)).toEqual([10, 11, 12]);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, TEST_TRACK_ID)[0].sourceKeyIds).toHaveLength(3);
  });

  it('undo/redo operate by reference — before/after are the exact document objects (RVL-06)', async () => {
    const layerId = 'layer-reveal';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const preCreate = getDocument(layerId)!;
    const descriptor = await createRail(layerId);

    expect(descriptor.before).toBe(preCreate);
    expect(descriptor.after).toBe(getDocument(layerId));
    // The descriptor carries no raster bytes — the document carries sidecar
    // refs, never raster-byte snapshots (RVL-06).
    expect(JSON.stringify(descriptor)).not.toContain('baked-');
  });
});
