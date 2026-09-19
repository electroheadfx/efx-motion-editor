import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { FrameMediaReference } from '../lib/efxPaintPackage';
import { buildFrameMediaRelativePath } from '../lib/efxPaintPackage';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
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

// 52.2-06: the package-side media references the save funnel hands the
// projection (plan 07 supplies the same shape from the native write).
const RESOLVED_MEDIA: Readonly<Record<string, FrameMediaReference>> = Object.fromEntries(
  ['key-1', 'key-2', 'override-phase-1', 'new-key-1', 'new-key-2'].map((keyId, index) => [
    keyId,
    {
      relativePath: buildFrameMediaRelativePath('layer-L', keyId),
      digest: String(index + 1).repeat(64),
      width: 10,
      height: 10,
    } satisfies FrameMediaReference,
  ]),
);

const resolveMedia = (keyId: string): FrameMediaReference | undefined => RESOLVED_MEDIA[keyId];

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
          bytes: pngDataUrl(`${track.id}-${n}`),
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

describe('52.2-06: reference-only multi-track round trip (D-06/D-07)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    reset();
  });

  it('preserves keyId, appFrame and track attribution for real keys AND group overrides', () => {
    const document = makeTrackDocument('layer-L');
    registerDocument(document);
    const added = addTrack('layer-L');
    expect(added.ok).toBe(true);
    const newTrackId = added.ok ? added.trackId : '';

    // Track 1: two real keys plus a canonical finite Group carrying one override.
    const trackOneRecords = [rotoRecord('key-1', 0), rotoRecord('key-2', 3)];
    const overrideRecord = rotoRecord('override-phase-1', 11);
    const groupLoop = {
      loopId: 'loop-phase',
      placementStart: 10,
      sourceKeyIds: ['key-1', 'key-2'],
      repeat: 3,
      mode: 'progressive' as const,
      syncState: 'modified' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 10,
      originalEndExclusive: 16,
      visibleRanges: [{ start: 10, endExclusive: 16 }],
      frameOverrides: [{ appFrame: 11, keyId: 'override-phase-1' }],
    };
    const trackOne = physicPaintStore.replaceRotoPhysicalDocument('layer-L', TEST_TRACK_ID, {
      capacity: 32,
      realKeyRecords: trackOneRecords,
      groupOverrideRecords: [overrideRecord],
      interpolation: { enabled: false, mode: 'duplicate' },
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      loopClips: [groupLoop],
      incomingInterpolationBreakKeyIds: [],
      revision: buildPhysicPaintRotoPhysicalRevision(
        trackOneRecords,
        { enabled: false, mode: 'duplicate' },
        [groupLoop],
        [],
        [overrideRecord],
      ),
    });
    expect(trackOne.ok).toBe(true);

    // Track 2: two real keys, no overrides.
    physicPaintStore.setFrame('layer-L', newTrackId, 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-L', newTrackId, 4, makeFrame(1, 4));
    const replaced = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-L', newTrackId,
      [rotoRecord('new-key-1', 0), rotoRecord('new-key-2', 4)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    expect(replaced.ok).toBe(true);

    // Save boundary: the resolver-driven projection, then the on-disk door.
    const projected = serializeRuntimeIntoDocument('layer-L', resolveMedia);
    const parsed = parseEfxPaintDocument(projected, 'reference-only');
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.tracks.every((track) => track.rotoPhysical?.realKeyRecords.every((record) => !('bytes' in record.payload)))).toBe(true);

    // Reopen boundary: hydrate the reference-only document back into runtime.
    const frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
    for (const track of parsed.tracks) {
      const trackFrames = new Map<number, PhysicPaintRenderedFrame>();
      for (const appFrame of Object.keys(track.frames).map(Number)) {
        trackFrames.set(appFrame, { frameIndex: 0, appFrame, bytes: pngDataUrl(`${track.id}-${appFrame}`), width: 10, height: 10 });
      }
      frames.set(track.id, trackFrames);
    }
    physicPaintStore.reset();
    hydrateRuntimeFromDocument(parsed, frames);

    expect(physicPaintStore.getRotoRealKeyRecords('layer-L', TEST_TRACK_ID).map((record) => [record.keyId, record.appFrame]))
      .toEqual([['key-1', 0], ['key-2', 3]]);
    expect(physicPaintStore.getRotoGroupOverrideRecords('layer-L', TEST_TRACK_ID).map((record) => [record.keyId, record.appFrame]))
      .toEqual([['override-phase-1', 11]]);
    expect(physicPaintStore.getRotoRealKeyRecords('layer-L', newTrackId).map((record) => [record.keyId, record.appFrame]))
      .toEqual([['new-key-1', 0], ['new-key-2', 4]]);
    const hydratedPayloads = [
      ...physicPaintStore.getRotoRealKeyRecords('layer-L', TEST_TRACK_ID),
      ...physicPaintStore.getRotoGroupOverrideRecords('layer-L', TEST_TRACK_ID),
      ...physicPaintStore.getRotoRealKeyRecords('layer-L', newTrackId),
    ].map((record) => record.payload);
    expect(hydratedPayloads.every((payload) => !('bytes' in payload))).toBe(true);
    expect(physicPaintStore.getRotoPhysicalContentRevision('layer-L', TEST_TRACK_ID)).toBeTruthy();
  });
});
