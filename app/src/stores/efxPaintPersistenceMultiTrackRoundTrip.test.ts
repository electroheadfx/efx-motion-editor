import { beforeEach, describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { _setPhysicPaintMarkDirtyCallback, physicPaintStore } from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  addTrack,
  getDocument,
  hydrateRuntimeFromDocument,
  registerDocument,
  reset,
  serializeRuntimeIntoDocument,
  setPhotoReferenceOpacity,
  setPhotoReferenceSource,
  setPhotoReferenceTransform,
  setPhotoReferenceTransformLocked,
  setPhotoReferenceVisible,
} from './efxPaintStore';

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

describe('47-01: multi-track persistence round-trip (user scenario — added track + paint survive save/load)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    reset();
  });

  it('addTrack + painted frames survive serialize → parse → hydrate', () => {
    const document = makeTrackDocument('layer-L');
    registerDocument(document);

    const added = addTrack('layer-L');
    expect(added.ok).toBe(true);
    const newTrackId = added.ok ? added.trackId : '';
    expect(getDocument('layer-L')?.tracks).toHaveLength(2);

    // Paint on the new track: one frame + one real key record.
    physicPaintStore.setFrame('layer-L', newTrackId, 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-L', newTrackId, 4, makeFrame(1, 4));
    const replaced = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-L', newTrackId,
      [rotoRecord('new-key-1', 0), rotoRecord('new-key-2', 4)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    expect(replaced.ok).toBe(true);

    // Paint on the ORIGINAL track too (both must survive).
    physicPaintStore.setFrame('layer-L', TEST_TRACK_ID, 2, makeFrame(1, 2));

    const projected = serializeRuntimeIntoDocument('layer-L');
    expect(projected.tracks).toHaveLength(2);

    // Load boundary: the fail-closed parser must accept the multi-track doc.
    const parsed = parseEfxPaintDocument(projected);
    expect(parsed.tracks).toHaveLength(2);

    const newTrack = parsed.tracks.find((track) => track.id === newTrackId);
    expect(newTrack).toBeDefined();
    expect(Object.keys(newTrack!.frames).map(Number).sort()).toEqual([0, 4]);
    expect(newTrack!.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['new-key-1', 'new-key-2']);

    // Runtime rehydration (open path): hydrate with per-track frames.
    const frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
    for (const track of parsed.tracks) {
      const trackFrames = new Map<number, PhysicPaintRenderedFrame>();
      for (const [appFrame, ref] of Object.entries(track.frames)) {
        const n = Number(appFrame);
        trackFrames.set(n, {
          frameIndex: 0,
          appFrame: n,
          dataUrl: pngDataUrl(`${track.id}-${n}`),
          width: ref.width,
          height: ref.height,
        });
      }
      frames.set(track.id, trackFrames);
    }
    physicPaintStore.reset();
    hydrateRuntimeFromDocument(parsed, frames);

    expect(physicPaintStore.getFrames('layer-L', newTrackId).size).toBe(2);
    expect(physicPaintStore.getRotoRealKeyRecords('layer-L', newTrackId).map((record) => record.keyId))
      .toEqual(['new-key-1', 'new-key-2']);
    expect(physicPaintStore.getFrames('layer-L', TEST_TRACK_ID).size).toBe(1);
  });
});

describe('50-06: photo reference track round-trip (REF-05 — save/reopen preserves all fields)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    reset();
  });

  it('photo reference track survives serialize → parse → hydrate with all six fields intact and idempotent', () => {
    const document = makeTrackDocument('layer-L');
    registerDocument(document);

    // Establish a full photo/reference track via the Plan 50-02 setters: the
    // source cycle (natural filename sort order) and the four display
    // preferences (visibleInStudio, opacity, transform, transformLocked). The
    // Phase 50 `mode` field is REMOVED (52-02, D-15 clean break).
    expect(setPhotoReferenceSource('layer-L', ['shot_1', 'shot_2', 'shot_10']).ok).toBe(true);
    expect(setPhotoReferenceOpacity('layer-L', 0.8).ok).toBe(true);
    expect(setPhotoReferenceVisible('layer-L', false).ok).toBe(true);
    expect(setPhotoReferenceTransform('layer-L', { x: 12, y: 34, scaleX: 1.5, scaleY: 0.75, rotation: 0.3 }).ok).toBe(true);
    expect(setPhotoReferenceTransformLocked('layer-L', false).ok).toBe(true);

    const preSave = getDocument('layer-L')?.photoReference;
    expect(preSave).toBeDefined();

    // Serialize → parse → hydrate (the reopen path).
    const projected = serializeRuntimeIntoDocument('layer-L');
    const parsed = parseEfxPaintDocument(projected);
    physicPaintStore.reset();
    hydrateRuntimeFromDocument(parsed, new Map<string, Map<number, PhysicPaintRenderedFrame>>());

    // The hydrated document's photoReference deep-equals the pre-save track on
    // ALL fields (id, sourceFrameRefs, revision, visibleInStudio, opacity,
    // transform, transformLocked).
    expect(parsed.photoReference).toEqual(preSave);

    // Explicit per-field contract (REF-05 success criterion 5 + D-11/D-12/D-13):
    // the display-preference fields survive alongside the mutation fields.
    expect(parsed.photoReference?.sourceFrameRefs).toEqual(['shot_1', 'shot_2', 'shot_10']);
    expect(parsed.photoReference?.visibleInStudio).toBe(false);
    expect(parsed.photoReference?.opacity).toBe(0.8);
    expect(parsed.photoReference?.transform).toEqual({ x: 12, y: 34, scaleX: 1.5, scaleY: 0.75, rotation: 0.3 });
    expect(parsed.photoReference?.transformLocked).toBe(false);
    // The track revision stays 0 — the Phase 50 mode mutation (the only other
    // revision-bumping photo-reference op) is removed (52-02, D-15).
    expect(parsed.photoReference?.revision).toBe(0);

    // Idempotency: serialize → hydrate → serialize is stable (REF-05 probe).
    const reserialized = serializeRuntimeIntoDocument('layer-L');
    expect(reserialized.photoReference).toEqual(parsed.photoReference);
  });
});
