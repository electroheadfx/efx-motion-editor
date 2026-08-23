import { beforeEach, describe, expect, it } from 'vitest';
import { createEfxPaintDocument, type EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import type { PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  commitDeleteTrack,
  getDocument,
  registerDocument,
  requestDeleteTrack,
  reset as resetEfxPaintStore,
  _setEfxPaintMarkDirtyCallback,
} from './efxPaintStore';
import {
  mountTrackRuntime,
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';

// 46-05 TRK-07 deletion laws: requestDeleteTrack/commitDeleteTrack delete
// exactly one internal track — preview, explicit acknowledgement (D-14),
// last-track refusal (D-17), full 46-01 runtime teardown, Hold reference
// severing (D-16), nearest-adjacent active-track re-point (D-18), and sidecar
// removal inside the save cache transaction (D-15).
// Node env, vitest run only; no jsdom, no config changes.

const LAYER = 'layer-delete-laws';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';
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
        seedTrack(trackId, [makeRecord('key-a-1', 1, 'a@1')], [
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
