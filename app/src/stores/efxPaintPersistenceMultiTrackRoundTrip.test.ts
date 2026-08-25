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
