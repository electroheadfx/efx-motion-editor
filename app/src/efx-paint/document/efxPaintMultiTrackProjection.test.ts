/**
 * Phase 46-02 multi-track projection boundary tests (TRK-01/TRK-03).
 *
 * The Phase 45 serializer threw on any second Paint track
 * (`efxPaintStore.ts:82,118`); this suite proves the relaxed boundary:
 * `serializeRuntimeIntoDocument` / `hydrateRuntimeFromDocument` iterate the
 * document's tracks by stable id (never tracks[0], Pitfall 1) and project each
 * track's runtime payload into that exact track. Two tracks may persist frames
 * at the same appFrame without collision, and empty tracks project without
 * error (edge TRK-01 empty/adjacency and TRK-03 ordering, resolved explicit).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { _setPhysicPaintMarkDirtyCallback, physicPaintStore } from '../../stores/physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  getDocument,
  hydrateRuntimeFromDocument,
  registerDocument,
  reset,
  serializeRuntimeIntoDocument,
} from '../../stores/efxPaintStore';
import { createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import type { EfxPaintDocument, InternalPaintTrack } from './efxPaintDocument';

const TRACK_A = 'track-a';
const TRACK_B = 'track-b';

function makeMultiTrackDocument(layerId: string, trackA = TRACK_A, trackB = TRACK_B): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const base = document.tracks[0];
  const trackAObj: InternalPaintTrack = { ...base, id: trackA, frames: {}, rotoPhysical: null, loopClips: [] };
  const trackBObj: InternalPaintTrack = { ...base, id: trackB, order: 1, frames: {}, rotoPhysical: null, loopClips: [] };
  return { ...document, activeTrackId: trackA, tracks: [trackAObj, trackBObj] };
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
  payload: { frameIndex: 0, appFrame, dataUrl: pngDataUrl(keyId), width: 10, height: 10 },
});

const rotoPhysicalFor = (records: ReturnType<typeof rotoRecord>[]) => ({
  capacity: 10,
  realKeyRecords: records,
  interpolation: PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  background: null,
  selectedKeyId: null,
  cursorAppFrame: 0,
  revision: buildPhysicPaintRotoPhysicalRevision(
    records,
    PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
    PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
    [],
  ),
  loopClips: PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  incomingInterpolationBreakKeyIds: PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
});

function seedTwo(layerId: string, trackId: string, frames: Array<[number, number]>, records: ReturnType<typeof rotoRecord>[]): void {
  for (const [frameIndex, appFrame] of frames) physicPaintStore.setFrame(layerId, trackId, appFrame, makeFrame(frameIndex, appFrame));
  const result = physicPaintStore.replaceRotoPhysicalRecords(layerId, trackId, records, { enabled: false, mode: 'duplicate' }, 10);
  expect(result.ok).toBe(true);
}

describe('efxPaintMultiTrackProjection', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    reset();
  });

  it('projects a multi-track runtime into the SAME two document tracks by id (never tracks[0])', () => {
    const layerId = 'layer-MT';
    const document = makeMultiTrackDocument(layerId);
    registerDocument(document);
    seedTwo(layerId, TRACK_A, [[0, 1]], [rotoRecord('key-A', 1)]);
    seedTwo(layerId, TRACK_B, [[1, 2]], [rotoRecord('key-B', 2)]);

    const projected = serializeRuntimeIntoDocument(layerId);

    expect(projected.tracks.map((track) => track.id)).toEqual([TRACK_A, TRACK_B]);
    const projectedA = projected.tracks.find((track) => track.id === TRACK_A)!;
    const projectedB = projected.tracks.find((track) => track.id === TRACK_B)!;
    expect(Object.keys(projectedA.frames).map(Number)).toEqual([1]);
    expect(Object.keys(projectedB.frames).map(Number)).toEqual([2]);
    expect(projectedA.frames[1].cachePath).toContain(`/${TRACK_A}/frame-`);
    expect(projectedB.frames[2].cachePath).toContain(`/${TRACK_B}/frame-`);
    expect(projectedA.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['key-A']);
    expect(projectedB.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['key-B']);
  });

  it('installs a two-track document into each track under its own trackId', () => {
    const layerId = 'layer-MT';
    const document = makeMultiTrackDocument(layerId);
    const withPayload = {
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          frames: { 5: { cachePath: `cache/efx-paint/seg-a/${TRACK_A}/frame-000005-0000.png`, width: 10, height: 10 } },
          rotoPhysical: rotoPhysicalFor([rotoRecord('key-A', 5)]),
        },
        {
          ...document.tracks[1],
          frames: { 5: { cachePath: `cache/efx-paint/seg-b/${TRACK_B}/frame-000005-0000.png`, width: 20, height: 20 } },
          rotoPhysical: rotoPhysicalFor([rotoRecord('key-B', 5)]),
        },
      ],
    };
    const perTrackFrames = new Map([
      [TRACK_A, new Map([[5, makeFrame(0, 5)]])],
      [TRACK_B, new Map([[5, makeFrame(1, 5)]])],
    ]);

    hydrateRuntimeFromDocument(withPayload, perTrackFrames);

    expect(physicPaintStore.getFrame(layerId, TRACK_A, 5)?.dataUrl).toBe(makeFrame(0, 5).dataUrl);
    expect(physicPaintStore.getFrame(layerId, TRACK_B, 5)?.dataUrl).toBe(makeFrame(1, 5).dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TRACK_A).map((record) => record.keyId)).toEqual(['key-A']);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TRACK_B).map((record) => record.keyId)).toEqual(['key-B']);
  });

  it('round-trips track ids, frame keys, roto key ids, and revisions per track', () => {
    const layerId = 'layer-MT';
    const document = makeMultiTrackDocument(layerId);
    registerDocument(document);
    seedTwo(layerId, TRACK_A, [[0, 1], [1, 3]], [rotoRecord('key-A', 1)]);
    seedTwo(layerId, TRACK_B, [[0, 2]], [rotoRecord('key-B', 2)]);
    const originalA = physicPaintStore.extractRuntimeStateForDocument(layerId, TRACK_A);
    const originalB = physicPaintStore.extractRuntimeStateForDocument(layerId, TRACK_B);

    const projected = serializeRuntimeIntoDocument(layerId);
    expect(projected.tracks.map((track) => track.id)).toEqual([TRACK_A, TRACK_B]);
    const projectedA = projected.tracks.find((track) => track.id === TRACK_A)!;
    const projectedB = projected.tracks.find((track) => track.id === TRACK_B)!;
    expect(projectedA.revision).toBe(document.tracks[0].revision);
    expect(projectedB.revision).toBe(document.tracks[1].revision);

    hydrateRuntimeFromDocument(projected, new Map([
      [TRACK_A, originalA.frames],
      [TRACK_B, originalB.frames],
    ]));

    const restoredA = physicPaintStore.getFrames(layerId, TRACK_A);
    const restoredB = physicPaintStore.getFrames(layerId, TRACK_B);
    expect(Array.from(restoredA.keys()).sort()).toEqual([1, 3]);
    expect(Array.from(restoredB.keys()).sort()).toEqual([2]);
    expect(restoredA.get(1)?.dataUrl).toBe(originalA.frames.get(1)?.dataUrl);
    expect(restoredB.get(2)?.dataUrl).toBe(originalB.frames.get(2)?.dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TRACK_A).map((record) => record.keyId)).toEqual(['key-A']);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, TRACK_B).map((record) => record.keyId)).toEqual(['key-B']);
  });

  it('keeps frames at the same appFrame on two tracks distinct through serialize + hydrate', () => {
    const layerId = 'layer-MT';
    const document = makeMultiTrackDocument(layerId);
    registerDocument(document);
    seedTwo(layerId, TRACK_A, [[0, 5]], [rotoRecord('key-A', 5)]);
    seedTwo(layerId, TRACK_B, [[1, 5]], [rotoRecord('key-B', 5)]);
    const originalA = physicPaintStore.extractRuntimeStateForDocument(layerId, TRACK_A);
    const originalB = physicPaintStore.extractRuntimeStateForDocument(layerId, TRACK_B);

    const projected = serializeRuntimeIntoDocument(layerId);
    expect(() => parseEfxPaintDocument(projected)).not.toThrow();
    hydrateRuntimeFromDocument(projected, new Map([
      [TRACK_A, originalA.frames],
      [TRACK_B, originalB.frames],
    ]));

    expect(physicPaintStore.getFrame(layerId, TRACK_A, 5)?.dataUrl).toBe(makeFrame(0, 5).dataUrl);
    expect(physicPaintStore.getFrame(layerId, TRACK_B, 5)?.dataUrl).toBe(makeFrame(1, 5).dataUrl);
  });

  it('projects a document with one empty and one populated Paint track without error', () => {
    const layerId = 'layer-MT';
    const document = makeMultiTrackDocument(layerId);
    registerDocument(document);
    seedTwo(layerId, TRACK_B, [[0, 2]], [rotoRecord('key-B', 2)]);

    const projected = serializeRuntimeIntoDocument(layerId);

    expect(projected.tracks).toHaveLength(2);
    const projectedA = projected.tracks.find((track) => track.id === TRACK_A)!;
    const projectedB = projected.tracks.find((track) => track.id === TRACK_B)!;
    expect(projectedA.frames).toEqual({});
    expect(projectedA.rotoPhysical).toBeNull();
    expect(Object.keys(projectedB.frames).map(Number)).toEqual([2]);
    expect(projectedB.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['key-B']);
  });
});
