import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { _setPhysicPaintMarkDirtyCallback, physicPaintStore } from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  efxPaintVersion,
  getDocument,
  hasDocument,
  hydrateRuntimeFromDocument,
  registerDocument,
  removeDocument,
  reset,
  serializeRuntimeIntoDocument,
} from './efxPaintStore';

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

describe('efxPaintStore', () => {
  beforeEach(() => {
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
  });

  it('registers a document and returns it by layer id', () => {
    const document = createEfxPaintDocument('layer-x');
    registerDocument(document);
    expect(getDocument('layer-x')).toBe(document);
    expect(hasDocument('layer-x')).toBe(true);
    expect(hasDocument('layer-other')).toBe(false);
  });

  it('bumps efxPaintVersion and fires the injected dirty callback on every mutation', () => {
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);
    const before = efxPaintVersion.value;
    registerDocument(createEfxPaintDocument('layer-x'));
    expect(efxPaintVersion.value).toBe(before + 1);
    expect(dirty).toHaveBeenCalledTimes(1);
    registerDocument(createEfxPaintDocument('layer-y'));
    expect(efxPaintVersion.value).toBe(before + 2);
    expect(dirty).toHaveBeenCalledTimes(2);
    expect(removeDocument('layer-x')).toBe(true);
    expect(efxPaintVersion.value).toBe(before + 3);
    expect(dirty).toHaveBeenCalledTimes(3);
    expect(removeDocument('layer-x')).toBe(false);
    expect(efxPaintVersion.value).toBe(before + 3);
  });

  it('reset empties the map and bumps the version signal', () => {
    registerDocument(createEfxPaintDocument('layer-x'));
    registerDocument(createEfxPaintDocument('layer-y'));
    const before = efxPaintVersion.value;
    reset();
    expect(hasDocument('layer-x')).toBe(false);
    expect(hasDocument('layer-y')).toBe(false);
    expect(efxPaintVersion.value).toBe(before + 1);
  });
});

describe('serializeRuntimeIntoDocument / hydrateRuntimeFromDocument', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    reset();
  });

  it('projects runtime state into the single default track and increments documentRevision', () => {
    const document = createEfxPaintDocument('layer-L');
    registerDocument(document);
    physicPaintStore.setFrame('layer-L', 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-L', 3, makeFrame(1, 3));
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-L',
      [rotoRecord('key-1', 0)],
      { enabled: false, mode: 'duplicate' },
      10,
    );
    expect(result.ok).toBe(true);

    const projected = serializeRuntimeIntoDocument('layer-L');

    expect(projected.tracks).toHaveLength(1);
    const track = projected.tracks[0];
    expect(track.id).toBe(document.activeTrackId);
    expect(Object.keys(track.frames).map(Number).sort()).toEqual([0, 3]);
    expect(track.frames[0].cachePath).toMatch(/^cache\/efx-paint\//);
    expect(track.frames[0].width).toBe(100);
    expect(track.frames[0].height).toBe(50);
    expect(track.rotoPhysical?.realKeyRecords.map((record) => record.keyId)).toEqual(['key-1']);
    expect(projected.documentRevision).toBe(document.documentRevision + 1);
    expect(getDocument('layer-L')?.documentRevision).toBe(document.documentRevision + 1);
  });

  it('hydrates a document whose default track carries frames/rotoPhysical into the runtime maps', () => {
    const document = createEfxPaintDocument('layer-L');
    const track = document.tracks[0];
    const records = [rotoRecord('key-1', 0)];
    const withPayload = {
      ...document,
      tracks: [{
        ...track,
        frames: { 0: { cachePath: 'cache/efx-paint/layer_L-abc/frame-000000-0000.png', width: 100, height: 50 } },
        rotoPhysical: {
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
        },
      }],
    };
    const frames = new Map<number, PhysicPaintRenderedFrame>([[0, makeFrame(0, 0)]]);

    hydrateRuntimeFromDocument(withPayload, frames);

    expect(physicPaintStore.getFrames('layer-L').get(0)?.dataUrl).toBe(makeFrame(0, 0).dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords('layer-L').map((record) => record.keyId)).toEqual(['key-1']);
  });

  it('round-trips runtime → document → runtime with reference-stable identity', () => {
    const document = createEfxPaintDocument('layer-L');
    registerDocument(document);
    physicPaintStore.setFrame('layer-L', 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-L', 3, makeFrame(1, 3));
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-L',
      [rotoRecord('key-1', 0)],
      { enabled: false, mode: 'duplicate' },
      10,
    );
    expect(result.ok).toBe(true);
    const originalFrames = physicPaintStore.getFrames('layer-L');
    const originalRoto = physicPaintStore.getRotoRealKeyRecords('layer-L');

    const projected = serializeRuntimeIntoDocument('layer-L');
    hydrateRuntimeFromDocument(projected, originalFrames);

    const restoredFrames = physicPaintStore.getFrames('layer-L');
    expect(Array.from(restoredFrames.keys()).sort()).toEqual([0, 3]);
    expect(restoredFrames.get(0)?.dataUrl).toBe(originalFrames.get(0)?.dataUrl);
    expect(restoredFrames.get(3)?.dataUrl).toBe(originalFrames.get(3)?.dataUrl);
    const restoredRoto = physicPaintStore.getRotoRealKeyRecords('layer-L');
    expect(restoredRoto.map((record) => record.keyId)).toEqual(originalRoto.map((record) => record.keyId));
    expect(restoredRoto[0]?.payload.dataUrl).toBe(originalRoto[0]?.payload.dataUrl);
  });

  it('projects an empty runtime into a schema-valid document with an empty default-track payload', () => {
    const document = createEfxPaintDocument('layer-L');
    registerDocument(document);

    const projected = serializeRuntimeIntoDocument('layer-L');

    expect(() => parseEfxPaintDocument(projected)).not.toThrow();
    expect(projected.tracks[0].frames).toEqual({});
    expect(projected.tracks[0].rotoPhysical).toBeNull();
    expect(projected.documentRevision).toBe(document.documentRevision);
  });

  it('never reads or writes another layer runtime maps when projecting layer A', () => {
    const documentA = createEfxPaintDocument('layer-A');
    registerDocument(documentA);
    physicPaintStore.setFrame('layer-A', 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-B', 7, makeFrame(0, 7));

    const projected = serializeRuntimeIntoDocument('layer-A');

    expect(Object.keys(projected.tracks[0].frames).map(Number)).toEqual([0]);
    expect(physicPaintStore.getFrames('layer-B').get(7)?.dataUrl).toBe(makeFrame(0, 7).dataUrl);
    hydrateRuntimeFromDocument(projected, physicPaintStore.getFrames('layer-A'));
    expect(physicPaintStore.getFrames('layer-B').get(7)?.dataUrl).toBe(makeFrame(0, 7).dataUrl);
  });

  it('throws on outbound projection when the document has more than one Paint track', () => {
    const document = createEfxPaintDocument('layer-L');
    const secondTrack = { ...document.tracks[0], id: 'track-2' };
    const multiTrack = { ...document, tracks: [document.tracks[0], secondTrack] };
    registerDocument(multiTrack);

    expect(() => serializeRuntimeIntoDocument('layer-L')).toThrow(/exactly one default Paint track/);
  });
});
