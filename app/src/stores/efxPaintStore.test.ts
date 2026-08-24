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
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import {
  _setPhysicPaintMarkDirtyCallback,
  getTrackPaintVersion,
  getTrackRotorRevision,
  physicPaintStore,
  physicPaintVersion,
} from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  addTrack,
  duplicateTrack,
  efxPaintVersion,
  getDocument,
  hasDocument,
  hydrateRuntimeFromDocument,
  registerDocument,
  removeDocument,
  renameTrack,
  reorderTrack,
  reset,
  serializeRuntimeIntoDocument,
  setTrackBlend,
  setTrackOpacity,
  setTrackSolo,
  setTrackVisible,
} from './efxPaintStore';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
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

describe('efxPaintStore', () => {
  beforeEach(() => {
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
  });

  it('registers a document and returns it by layer id', () => {
    const document = makeTrackDocument('layer-x');
    registerDocument(document);
    expect(getDocument('layer-x')).toBe(document);
    expect(hasDocument('layer-x')).toBe(true);
    expect(hasDocument('layer-other')).toBe(false);
  });

  it('bumps efxPaintVersion and fires the injected dirty callback on every mutation', () => {
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);
    const before = efxPaintVersion.value;
    registerDocument(makeTrackDocument('layer-x'));
    expect(efxPaintVersion.value).toBe(before + 1);
    expect(dirty).toHaveBeenCalledTimes(1);
    registerDocument(makeTrackDocument('layer-y'));
    expect(efxPaintVersion.value).toBe(before + 2);
    expect(dirty).toHaveBeenCalledTimes(2);
    expect(removeDocument('layer-x')).toBe(true);
    expect(efxPaintVersion.value).toBe(before + 3);
    expect(dirty).toHaveBeenCalledTimes(3);
    expect(removeDocument('layer-x')).toBe(false);
    expect(efxPaintVersion.value).toBe(before + 3);
  });

  it('reset empties the map and bumps the version signal', () => {
    registerDocument(makeTrackDocument('layer-x'));
    registerDocument(makeTrackDocument('layer-y'));
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
    const document = makeTrackDocument('layer-L');
    registerDocument(document);
    physicPaintStore.setFrame('layer-L', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-L', TEST_TRACK_ID, 3, makeFrame(1, 3));
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-L', TEST_TRACK_ID,
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
    const document = makeTrackDocument('layer-L');
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

    // 46-02: the hydrate carrier is per-track (trackId → appFrame → frame).
    hydrateRuntimeFromDocument(withPayload, new Map([[TEST_TRACK_ID, frames]]));

    expect(physicPaintStore.getFrames('layer-L', TEST_TRACK_ID).get(0)?.dataUrl).toBe(makeFrame(0, 0).dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords('layer-L', TEST_TRACK_ID).map((record) => record.keyId)).toEqual(['key-1']);
  });

  it('round-trips runtime → document → runtime with reference-stable identity', () => {
    const document = makeTrackDocument('layer-L');
    registerDocument(document);
    physicPaintStore.setFrame('layer-L', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-L', TEST_TRACK_ID, 3, makeFrame(1, 3));
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-L', TEST_TRACK_ID,
      [rotoRecord('key-1', 0)],
      { enabled: false, mode: 'duplicate' },
      10,
    );
    expect(result.ok).toBe(true);
    const originalFrames = physicPaintStore.getFrames('layer-L', TEST_TRACK_ID);
    const originalRoto = physicPaintStore.getRotoRealKeyRecords('layer-L', TEST_TRACK_ID);

    const projected = serializeRuntimeIntoDocument('layer-L');
    hydrateRuntimeFromDocument(projected, new Map([[TEST_TRACK_ID, originalFrames]]));

    const restoredFrames = physicPaintStore.getFrames('layer-L', TEST_TRACK_ID);
    expect(Array.from(restoredFrames.keys()).sort()).toEqual([0, 3]);
    expect(restoredFrames.get(0)?.dataUrl).toBe(originalFrames.get(0)?.dataUrl);
    expect(restoredFrames.get(3)?.dataUrl).toBe(originalFrames.get(3)?.dataUrl);
    const restoredRoto = physicPaintStore.getRotoRealKeyRecords('layer-L', TEST_TRACK_ID);
    expect(restoredRoto.map((record) => record.keyId)).toEqual(originalRoto.map((record) => record.keyId));
    expect(restoredRoto[0]?.payload.dataUrl).toBe(originalRoto[0]?.payload.dataUrl);
  });

  it('projects an empty runtime into a schema-valid document with an empty default-track payload', () => {
    const document = makeTrackDocument('layer-L');
    registerDocument(document);

    const projected = serializeRuntimeIntoDocument('layer-L');

    expect(() => parseEfxPaintDocument(projected)).not.toThrow();
    expect(projected.tracks[0].frames).toEqual({});
    expect(projected.tracks[0].rotoPhysical).toBeNull();
    expect(projected.documentRevision).toBe(document.documentRevision);
  });

  it('never reads or writes another layer runtime maps when projecting layer A', () => {
    const documentA = makeTrackDocument('layer-A');
    registerDocument(documentA);
    physicPaintStore.setFrame('layer-A', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-B', TEST_TRACK_ID, 7, makeFrame(0, 7));

    const projected = serializeRuntimeIntoDocument('layer-A');

    expect(Object.keys(projected.tracks[0].frames).map(Number)).toEqual([0]);
    expect(physicPaintStore.getFrames('layer-B', TEST_TRACK_ID).get(7)?.dataUrl).toBe(makeFrame(0, 7).dataUrl);
    hydrateRuntimeFromDocument(projected, new Map([[TEST_TRACK_ID, physicPaintStore.getFrames('layer-A', TEST_TRACK_ID)]]));
    expect(physicPaintStore.getFrames('layer-B', TEST_TRACK_ID).get(7)?.dataUrl).toBe(makeFrame(0, 7).dataUrl);
  });
});

describe('track CRUD store ops (47-01 Task 2)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('addTrack creates a Paint 1 track with fresh id, order 1, defaults, and bumps documentRevision once', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    const before = efxPaintVersion.value;
    const result = addTrack('layer-crud');
    expect(result.ok).toBe(true);
    const addedId = (result as { ok: true; trackId: string }).trackId;
    const doc = getDocument('layer-crud')!;
    expect(doc.tracks).toHaveLength(2);
    const added = doc.tracks.find((track) => track.id === addedId);
    expect(added).toBeDefined();
    expect(added?.id).not.toBe(TEST_TRACK_ID);
    expect(added?.name).toBe('Paint 1');
    expect(added?.order).toBe(1);
    expect(added?.visible).toBe(true);
    expect(added?.solo).toBe(false);
    expect(added?.opacity).toBe(1);
    expect(added?.blendMode).toBe('normal');
    expect(doc.documentRevision).toBe(document.documentRevision + 1);
    expect(efxPaintVersion.value).toBe(before + 1);
    expect(physicPaintStore.hasTrackRuntime('layer-crud', addedId)).toBe(true);
  });

  it('addTrack names successive tracks Paint 2, Paint 3 at the next free number', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    const first = addTrack('layer-crud');
    const second = addTrack('layer-crud');
    const doc = getDocument('layer-crud')!;
    const firstTrack = doc.tracks.find((track) => track.id === (first as { ok: true; trackId: string }).trackId);
    const secondTrack = doc.tracks.find((track) => track.id === (second as { ok: true; trackId: string }).trackId);
    expect(firstTrack?.name).toBe('Paint 1');
    expect(secondTrack?.name).toBe('Paint 2');
    expect(doc.tracks).toHaveLength(3);
  });

  it('addTrack fails closed on an absent document', () => {
    const result = addTrack('layer-missing');
    expect(result.ok).toBe(false);
    expect(hasDocument('layer-missing')).toBe(false);
  });

  it('renameTrack trims and caps the name and bumps documentRevision exactly once', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    const result = renameTrack('layer-crud', TEST_TRACK_ID, '  My Track  ');
    expect(result.ok).toBe(true);
    const doc = getDocument('layer-crud')!;
    expect(doc.tracks.find((track) => track.id === TEST_TRACK_ID)?.name).toBe('My Track');
    expect(doc.documentRevision).toBe(document.documentRevision + 1);

    const long = 'x'.repeat(200);
    const capped = renameTrack('layer-crud', TEST_TRACK_ID, long);
    expect(capped.ok).toBe(true);
    expect(getDocument('layer-crud')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.name).toBe('x'.repeat(64));
  });

  it('renameTrack rejects empty, whitespace-only, and control-char names fail-closed', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    expect(renameTrack('layer-crud', TEST_TRACK_ID, '   ').ok).toBe(false);
    expect(renameTrack('layer-crud', TEST_TRACK_ID, '').ok).toBe(false);
    expect(renameTrack('layer-crud', TEST_TRACK_ID, 'a\u0000b').ok).toBe(false);
    expect(renameTrack('layer-crud', TEST_TRACK_ID, 'a\u001fb').ok).toBe(false);
    expect(getDocument('layer-crud')).toBe(document);
  });

  it('renameTrack to the same name is a no-op (no revision bump, no dirty)', () => {
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    const dirtyBefore = dirty.mock.calls.length;
    const result = renameTrack('layer-crud', TEST_TRACK_ID, 'Track 1');
    expect(result.ok).toBe(true);
    expect(getDocument('layer-crud')!.documentRevision).toBe(document.documentRevision);
    expect(dirty).toHaveBeenCalledTimes(dirtyBefore);
  });

  it('duplicateTrack deep-copies frames and keys with fresh identities and the Copy suffix', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    physicPaintStore.setFrame('layer-crud', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setFrame('layer-crud', TEST_TRACK_ID, 3, makeFrame(1, 3));
    const replace = physicPaintStore.replaceRotoPhysicalRecords(
      'layer-crud', TEST_TRACK_ID,
      [rotoRecord('key-1', 0), rotoRecord('key-2', 3)],
      { enabled: false, mode: 'duplicate' },
      10,
    );
    expect(replace.ok).toBe(true);

    const result = duplicateTrack('layer-crud', TEST_TRACK_ID);
    expect(result.ok).toBe(true);
    const copyId = (result as { ok: true; trackId: string }).trackId;
    const doc = getDocument('layer-crud')!;
    const copy = doc.tracks.find((track) => track.id === copyId);
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe(TEST_TRACK_ID);
    expect(copy?.name).toBe('Track 1 Copy');
    expect(copy?.order).toBe(1);
    expect(Object.keys(copy?.frames ?? {}).map(Number).sort()).toEqual([0, 3]);
    expect(copy?.blendMode).toBe('normal');

    const copyKeyIds = physicPaintStore.getRotoRealKeyRecords('layer-crud', copyId).map((record) => record.keyId);
    const sourceKeyIds = physicPaintStore.getRotoRealKeyRecords('layer-crud', TEST_TRACK_ID).map((record) => record.keyId);
    expect(copyKeyIds).toHaveLength(2);
    expect(copyKeyIds.some((keyId) => sourceKeyIds.includes(keyId))).toBe(false);
    // The copy's frame bytes are byte-identical to the source's real-key payloads.
    const sourceRecords = physicPaintStore.getRotoRealKeyRecords('layer-crud', TEST_TRACK_ID);
    expect(physicPaintStore.getFrames('layer-crud', copyId).get(0)?.dataUrl)
      .toBe(sourceRecords.find((record) => record.appFrame === 0)?.payload.dataUrl);
    expect(physicPaintStore.getFrames('layer-crud', copyId).get(3)?.dataUrl)
      .toBe(sourceRecords.find((record) => record.appFrame === 3)?.payload.dataUrl);
    // The copy is independently editable — mutating it leaves the source untouched.
    const sourceFrameCount = physicPaintStore.getFrames('layer-crud', TEST_TRACK_ID).size;
    physicPaintStore.setFrame('layer-crud', copyId, 9, makeFrame(2, 9));
    expect(physicPaintStore.getFrames('layer-crud', TEST_TRACK_ID).size).toBe(sourceFrameCount);
    expect(doc.documentRevision).toBe(document.documentRevision + 1);
  });

  it('duplicateTrack names a second duplicate of the same source "Copy 2"', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    const first = duplicateTrack('layer-crud', TEST_TRACK_ID);
    const second = duplicateTrack('layer-crud', TEST_TRACK_ID);
    const doc = getDocument('layer-crud')!;
    const firstCopy = doc.tracks.find((track) => track.id === (first as { ok: true; trackId: string }).trackId);
    const secondCopy = doc.tracks.find((track) => track.id === (second as { ok: true; trackId: string }).trackId);
    expect(firstCopy?.name).toBe('Track 1 Copy');
    expect(secondCopy?.name).toBe('Track 1 Copy 2');
  });

  it('duplicateTrack fails closed on absent document or unknown track', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    expect(duplicateTrack('layer-missing', TEST_TRACK_ID).ok).toBe(false);
    expect(duplicateTrack('layer-crud', 'unknown-track').ok).toBe(false);
    expect(getDocument('layer-crud')).toBe(document);
  });

  it('reorderTrack rewrites only order fields and re-sorts the array with byte-identical ids', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    addTrack('layer-crud');
    addTrack('layer-crud');
    const docBefore = getDocument('layer-crud')!;
    const [a, b, c] = docBefore.tracks;
    const idsBefore = docBefore.tracks.map((track) => track.id);
    const before = docBefore.documentRevision;

    const result = reorderTrack('layer-crud', c.id, 0);
    expect(result.ok).toBe(true);
    const doc = getDocument('layer-crud')!;
    expect(doc.tracks.map((track) => track.id)).toEqual([c.id, a.id, b.id]);
    expect(doc.tracks.map((track) => track.id).sort()).toEqual([...idsBefore].sort());
    expect(doc.tracks.map((track) => track.order)).toEqual([0, 1, 2]);
    expect(doc.documentRevision).toBe(before + 1);
  });

  it('reorderTrack to the same order is a no-op (no revision bump)', () => {
    const document = makeTrackDocument('layer-crud');
    registerDocument(document);
    addTrack('layer-crud');
    const before = getDocument('layer-crud')!;
    const second = before.tracks[1];
    const result = reorderTrack('layer-crud', second.id, second.order);
    expect(result.ok).toBe(true);
    expect(getDocument('layer-crud')).toBe(before);
    expect(getDocument('layer-crud')!.documentRevision).toBe(before.documentRevision);
  });

  it('round-trips add+rename+duplicate+reorder through serialize/hydrate with the same N tracks in the same order', () => {
    const document = makeTrackDocument('layer-rt');
    registerDocument(document);
    physicPaintStore.setFrame('layer-rt', TEST_TRACK_ID, 0, makeFrame(0, 0));
    const added = addTrack('layer-rt') as { ok: true; trackId: string };
    renameTrack('layer-rt', added.trackId, 'Renamed');
    const duplicated = duplicateTrack('layer-rt', TEST_TRACK_ID) as { ok: true; trackId: string };
    reorderTrack('layer-rt', duplicated.trackId, 0);

    const projected = serializeRuntimeIntoDocument('layer-rt');
    expect(projected.tracks).toHaveLength(3);
    const ids = projected.tracks.map((track) => track.id);
    const orders = projected.tracks.map((track) => track.order);
    const names = projected.tracks.map((track) => track.name);

    hydrateRuntimeFromDocument(
      projected,
      new Map(projected.tracks.map((track) => [track.id, physicPaintStore.getFrames('layer-rt', track.id)])),
    );

    const restored = getDocument('layer-rt')!;
    expect(restored.tracks).toHaveLength(3);
    expect(restored.tracks.map((track) => track.id)).toEqual(ids);
    expect(restored.tracks.map((track) => track.order)).toEqual(orders);
    expect(restored.tracks.map((track) => track.name)).toEqual(names);
  });
});

describe('hide/solo/opacity/blend track setters (47-01 Task 3)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('setTrackVisible flips visible and bumps the per-track revision; same value is a no-op', () => {
    const document = makeTrackDocument('layer-set');
    registerDocument(document);
    const paintRev = getTrackPaintVersion('layer-set', TEST_TRACK_ID).value;
    const rotoRev = getTrackRotorRevision('layer-set', TEST_TRACK_ID).value;
    const clock = physicPaintVersion.value;

    const result = setTrackVisible('layer-set', TEST_TRACK_ID, false);
    expect(result.ok).toBe(true);
    expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.visible).toBe(false);
    expect(getTrackPaintVersion('layer-set', TEST_TRACK_ID).value).toBe(paintRev + 1);
    expect(getTrackRotorRevision('layer-set', TEST_TRACK_ID).value).toBe(rotoRev + 1);
    expect(physicPaintVersion.value).toBe(clock + 1);

    const noOp = setTrackVisible('layer-set', TEST_TRACK_ID, false);
    expect(noOp.ok).toBe(true);
    expect(getTrackPaintVersion('layer-set', TEST_TRACK_ID).value).toBe(paintRev + 1);
    expect(physicPaintVersion.value).toBe(clock + 1);
  });

  it('setTrackSolo arms and disarms solo, bumping the per-track revision each change', () => {
    const document = makeTrackDocument('layer-set');
    registerDocument(document);
    const base = physicPaintVersion.value;

    const armed = setTrackSolo('layer-set', TEST_TRACK_ID, true);
    expect(armed.ok).toBe(true);
    expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.solo).toBe(true);
    expect(physicPaintVersion.value).toBe(base + 1);

    const disarmed = setTrackSolo('layer-set', TEST_TRACK_ID, false);
    expect(disarmed.ok).toBe(true);
    expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.solo).toBe(false);
    expect(physicPaintVersion.value).toBe(base + 2);
  });

  it('setTrackOpacity stores 0..1 floats exactly and clamps out-of-range values into 0..1', () => {
    const document = makeTrackDocument('layer-set');
    registerDocument(document);

    const exact = setTrackOpacity('layer-set', TEST_TRACK_ID, 0.5);
    expect(exact.ok).toBe(true);
    expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.opacity).toBe(0.5);

    const high = setTrackOpacity('layer-set', TEST_TRACK_ID, 1.5);
    expect(high.ok).toBe(true);
    expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.opacity).toBe(1);

    const low = setTrackOpacity('layer-set', TEST_TRACK_ID, -0.25);
    expect(low.ok).toBe(true);
    expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.opacity).toBe(0);
  });

  it('setTrackBlend accepts exactly the BlendMode union members and rejects anything else', () => {
    const document = makeTrackDocument('layer-set');
    registerDocument(document);
    for (const mode of ['normal', 'screen', 'multiply', 'overlay', 'add'] as const) {
      const result = setTrackBlend('layer-set', TEST_TRACK_ID, mode);
      expect(result.ok).toBe(true);
      expect(getDocument('layer-set')!.tracks.find((track) => track.id === TEST_TRACK_ID)?.blendMode).toBe(mode);
    }
    const rejected = setTrackBlend('layer-set', TEST_TRACK_ID, 'burn' as never);
    expect(rejected.ok).toBe(false);
    expect(getDocument('layer-set')).not.toBeNull();
  });

  it('each accepted setter bumps the per-track revision, global clock, and dirty exactly once without bumping documentRevision', () => {
    const document = makeTrackDocument('layer-set');
    registerDocument(document);
    const efxDirty = vi.fn();
    const physicDirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(efxDirty);
    _setPhysicPaintMarkDirtyCallback(physicDirty);
    const clockBefore = physicPaintVersion.value;
    const paintRevBefore = getTrackPaintVersion('layer-set', TEST_TRACK_ID).value;
    const rotoRevBefore = getTrackRotorRevision('layer-set', TEST_TRACK_ID).value;
    const docRevBefore = getDocument('layer-set')!.documentRevision;

    const result = setTrackVisible('layer-set', TEST_TRACK_ID, false);
    expect(result.ok).toBe(true);

    expect(getDocument('layer-set')!.documentRevision).toBe(docRevBefore);
    expect(physicPaintVersion.value).toBe(clockBefore + 1);
    expect(getTrackPaintVersion('layer-set', TEST_TRACK_ID).value).toBe(paintRevBefore + 1);
    expect(getTrackRotorRevision('layer-set', TEST_TRACK_ID).value).toBe(rotoRevBefore + 1);
    expect(efxDirty).toHaveBeenCalledTimes(1);
    expect(physicDirty).toHaveBeenCalledTimes(1);
  });

  it('setters fail closed on absent document and unknown track', () => {
    const document = makeTrackDocument('layer-set');
    registerDocument(document);
    expect(setTrackVisible('layer-missing', TEST_TRACK_ID, false).ok).toBe(false);
    expect(setTrackSolo('layer-set', 'unknown-track', true).ok).toBe(false);
    expect(setTrackOpacity('layer-set', 'unknown-track', 0.5).ok).toBe(false);
    expect(setTrackBlend('layer-set', 'unknown-track', 'normal').ok).toBe(false);
    expect(getDocument('layer-set')).toBe(document);
  });
});
