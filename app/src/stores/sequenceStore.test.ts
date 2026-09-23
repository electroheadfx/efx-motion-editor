import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {redo, resetHistory, undo} from '../lib/history';
import type {Layer} from '../types/layer';
import {physicPaintStore} from './physicPaintStore';
import {sequenceStore, _setSequenceProjectDimensionsProvider} from './sequenceStore';
import * as sequenceStoreModule from './sequenceStore';
import {registerDocument, reset as resetEfxPaintStore} from './efxPaintStore';
import {createEfxPaintDocument} from '../efx-paint/document/efxPaintDocument';
import type {EfxPaintDocument} from '../efx-paint/document/efxPaintDocument';
import { testWebpBytes } from '../testUtils/testWebpBytes';
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

// Use `as any` so TypeScript compiles even before Plan 01 adds the new methods.
// After Plan 01 extends the store, the `as any` can be removed.
const store = sequenceStore as any;

/** Helper: create a minimal content sequence and return its id */
function seedSequence(): string {
  const seq = sequenceStore.createSequence('Test');
  return seq.id;
}

function makePhysicPaintLayer(id: string, layerId: string): Layer {
  return {
    id,
    name: id,
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
    source: { type: 'physic-paint', layerId },
    isBase: false,
  };
}

describe('sequenceStore solid/transparent', () => {
  beforeEach(() => {
    sequenceStore.reset();
  });

  describe('addKeySolid (SOLID-01, D-04, D-06)', () => {
    it('adds a key solid with default black color to the sequence', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId);
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = seq.keyPhotos[seq.keyPhotos.length - 1];
      expect(kp.solidColor).toBe('#000000');
      expect(kp.imageId).toBe('');
      expect(kp.holdFrames).toBe(4);
      expect(kp.isTransparent).toBeUndefined();
    });

    it('adds a key solid with custom color', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#FF0000', 8);
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = seq.keyPhotos[seq.keyPhotos.length - 1];
      expect(kp.solidColor).toBe('#FF0000');
      expect(kp.holdFrames).toBe(8);
    });
  });

  describe('updateKeySolidColor (SOLID-04, D-14)', () => {
    it('changes the solidColor of an existing key solid', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#000000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      store.updateKeySolidColor(seqId, kpId, '#00FF00');
      const updated = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      expect(updated.keyPhotos.find((kp: any) => kp.id === kpId)!.solidColor).toBe('#00FF00');
    });
  });

  describe('toggleKeyEntryTransparent (SOLID-03, D-11, D-12)', () => {
    it('toggles a key solid to transparent mode', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#FF0000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      store.toggleKeyEntryTransparent(seqId, kpId);
      const toggled = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = toggled.keyPhotos.find((k: any) => k.id === kpId)!;
      expect(kp.isTransparent).toBe(true);
    });

    it('round-trips transparent back to solid, restoring the original solidColor', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#FF0000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      // Toggle to transparent
      store.toggleKeyEntryTransparent(seqId, kpId);
      // Toggle back to solid
      store.toggleKeyEntryTransparent(seqId, kpId);

      const restored = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = restored.keyPhotos.find((k: any) => k.id === kpId)!;
      expect(kp.isTransparent).toBeUndefined();
      expect(kp.solidColor).toBe('#FF0000');
    });

    it('defaults to #000000 when toggling from transparent to solid with no prior color', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#000000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      // Toggle to transparent then back
      store.toggleKeyEntryTransparent(seqId, kpId);
      store.toggleKeyEntryTransparent(seqId, kpId);

      const restored = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = restored.keyPhotos.find((k: any) => k.id === kpId)!;
      expect(kp.solidColor).toBe('#000000');
    });
  });
});

describe('sequenceStore addLayerToSequence (UXP-02)', () => {
  beforeEach(() => {
    sequenceStore.reset();
  });

  it('adds a layer to the specified sequence', () => {
    const seqId = seedSequence();
    const layer = {
      id: 'layer-1',
      name: 'Test Layer',
      type: 'paint' as const,
      visible: true,
      opacity: 1,
      blendMode: 'normal' as const,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'paint' as const, layerId: 'layer-1' },
      isBase: false,
    };
    sequenceStore.addLayerToSequence(seqId, layer);
    const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
    expect(seq.layers).toHaveLength(2); // base + new layer
    expect(seq.layers[1].id).toBe('layer-1');
    expect(seq.layers[1].name).toBe('Test Layer');
  });

  it('does nothing if sequence ID does not exist', () => {
    seedSequence();
    const before = sequenceStore.sequences.value.map(s => ({ ...s }));
    const layer = {
      id: 'layer-1',
      name: 'Test Layer',
      type: 'paint' as const,
      visible: true,
      opacity: 1,
      blendMode: 'normal' as const,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'paint' as const, layerId: 'layer-1' },
      isBase: false,
    };
    sequenceStore.addLayerToSequence('nonexistent-id', layer);
    const after = sequenceStore.sequences.value;
    expect(after).toHaveLength(before.length);
    // Layers should be unchanged
    expect(after[0].layers).toHaveLength(before[0].layers.length);
  });
});

describe('sequenceStore Physics Paint deletion lifecycle', () => {
  beforeEach(() => {
    resetHistory();
    sequenceStore.reset();
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument('canonical-target'));
    registerDocument(makeTrackDocument('canonical-survivor'));
  });

  it('clears the canonical Physics Paint state and restores it through Undo/Redo', () => {
    sequenceStore.add({
      id: 'target-sequence',
      kind: 'fx',
      name: 'Target Physics Paint',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [makePhysicPaintLayer('timeline-target', 'canonical-target')],
      inFrame: 0,
      outFrame: 24,
    });
    sequenceStore.add({
      id: 'survivor-sequence',
      kind: 'fx',
      name: 'Surviving Physics Paint',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [makePhysicPaintLayer('timeline-survivor', 'canonical-survivor')],
      inFrame: 0,
      outFrame: 24,
    });
    physicPaintStore.upsertRealRotoKeyFrame('canonical-target', TEST_TRACK_ID, 0, {
      frameIndex: 0,
      appFrame: 0,
      bytes: testWebpBytes('dGFyZ2V0LTA='),
      width: 100,
      height: 50,
    });
    physicPaintStore.upsertRealRotoKeyFrame('canonical-target', TEST_TRACK_ID, 2, {
      frameIndex: 0,
      appFrame: 2,
      bytes: testWebpBytes('dGFyZ2V0LTI='),
      width: 100,
      height: 50,
    });
    physicPaintStore.setRotoInterpolationSettings('canonical-target', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 1,
      mode: 'duplicate',
      position: 0,
      deform: 0,
    });
    physicPaintStore.setRotoBackgroundMetadata('canonical-target', TEST_TRACK_ID, {
      background: 'canvas2',
      paperGrain: 'canvas3',
      grainStrength: 0.65,
    });
    physicPaintStore.setFrame('canonical-survivor', TEST_TRACK_ID, 4, {
      frameIndex: 0,
      appFrame: 4,
      bytes: testWebpBytes('c3Vydml2b3I='),
      width: 100,
      height: 50,
    });
    const targetOutputBefore = physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID);
    const targetCacheBefore = physicPaintStore.getRotoCacheFrames('canonical-target', TEST_TRACK_ID);

    sequenceStore.removeLayerFromSequence('timeline-target');

    expect(sequenceStore.getById('target-sequence')).toBeNull();
    expect(physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });
    expect(physicPaintStore.getRotoCacheFrames('canonical-target', TEST_TRACK_ID)).toEqual([]);
    expect(physicPaintStore.getFrame('canonical-survivor', TEST_TRACK_ID, 4)?.bytes).toEqual(testWebpBytes('c3Vydml2b3I='));

    undo();

    expect(sequenceStore.getById('target-sequence')?.layers[0].source).toEqual({ type: 'physic-paint', layerId: 'canonical-target' });
    expect(physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID)).toEqual(targetOutputBefore);
    expect(physicPaintStore.getRotoCacheFrames('canonical-target', TEST_TRACK_ID)).toEqual(targetCacheBefore);
    expect(physicPaintStore.getFrame('canonical-survivor', TEST_TRACK_ID, 4)?.bytes).toEqual(testWebpBytes('c3Vydml2b3I='));

    redo();

    expect(sequenceStore.getById('target-sequence')).toBeNull();
    expect(physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });
    expect(physicPaintStore.getFrame('canonical-survivor', TEST_TRACK_ID, 4)?.bytes).toEqual(testWebpBytes('c3Vydml2b3I='));
  });

  it.each([
    {
      label: 'sequence deletion',
      remove: () => sequenceStore.remove('target-sequence'),
    },
    {
      label: 'active-layer deletion',
      remove: () => {
        sequenceStore.setActive('target-sequence');
        sequenceStore.removeLayer('timeline-target');
      },
    },
  ])('$label clears and restores canonical Physics Paint state', ({ remove }) => {
    sequenceStore.add({
      id: 'target-sequence',
      kind: 'fx',
      name: 'Target Physics Paint',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [makePhysicPaintLayer('timeline-target', 'canonical-target')],
      inFrame: 0,
      outFrame: 24,
    });
    physicPaintStore.setFrame('canonical-target', TEST_TRACK_ID, 3, {
      frameIndex: 0,
      appFrame: 3,
      bytes: testWebpBytes('dGFyZ2V0LTM='),
      width: 100,
      height: 50,
    });
    const outputBefore = physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID);

    remove();
    expect(physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });

    undo();
    expect(physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID)).toEqual(outputBefore);

    redo();
    expect(physicPaintStore.extractRuntimeStateForDocument('canonical-target', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });
  });

  it('keeps shared canonical state until the final timeline owner is removed', () => {
    for (const sequenceId of ['first-owner', 'second-owner']) {
      sequenceStore.add({
        id: sequenceId,
        kind: 'fx',
        name: sequenceId,
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: [],
        layers: [makePhysicPaintLayer(`${sequenceId}-layer`, 'shared-canonical')],
        inFrame: 0,
        outFrame: 24,
      });
    }
    physicPaintStore.setFrame('shared-canonical', TEST_TRACK_ID, 5, {
      frameIndex: 0,
      appFrame: 5,
      bytes: testWebpBytes('c2hhcmVk'),
      width: 100,
      height: 50,
    });

    sequenceStore.remove('first-owner');
    expect(physicPaintStore.getFrame('shared-canonical', TEST_TRACK_ID, 5)?.bytes).toEqual(testWebpBytes('c2hhcmVk'));

    undo();
    expect(physicPaintStore.getFrame('shared-canonical', TEST_TRACK_ID, 5)?.bytes).toEqual(testWebpBytes('c2hhcmVk'));

    redo();
    expect(physicPaintStore.getFrame('shared-canonical', TEST_TRACK_ID, 5)?.bytes).toEqual(testWebpBytes('c2hhcmVk'));

    sequenceStore.remove('second-owner');
    expect(physicPaintStore.getFrame('shared-canonical', TEST_TRACK_ID, 5)).toBeNull();
  });
});

describe('sequenceStore GL transitions (GLT-05)', () => {
  beforeEach(() => {
    sequenceStore.reset();
  });

  describe('setGlTransition', () => {
    it.todo('sets glTransition on the specified sequence');
    it.todo('clears crossDissolve when setting glTransition (D-02 mutual exclusion)');
    it.todo('marks project dirty');
    it.todo('pushes undo action');
  });

  describe('removeGlTransition', () => {
    it.todo('removes glTransition from the specified sequence');
    it.todo('marks project dirty');
    it.todo('pushes undo action');
  });

  describe('updateGlTransitionParams', () => {
    it.todo('updates shader params on existing glTransition');
    it.todo('no-ops if sequence has no glTransition');
  });

  describe('updateGlTransition', () => {
    it.todo('merges partial updates into existing glTransition');
    it.todo('can update duration and curve independently');
  });

  describe('addTransition mutual exclusion', () => {
    it.todo('clears glTransition when adding cross-dissolve (D-02)');
  });
});

describe('sequence factory project dims (260918-ovi)', () => {
  const DEFAULT_DIMS = { width: 1920, height: 1080 };

  beforeEach(() => {
    resetHistory();
    sequenceStore.reset();
  });

  afterEach(() => {
    // Restore the default provider so sibling describes are not polluted.
    _setSequenceProjectDimensionsProvider(() => DEFAULT_DIMS);
  });

  it('createSequence stamps the provider dims onto the new record', () => {
    _setSequenceProjectDimensionsProvider(() => ({ width: 1080, height: 1920 }));
    const seq = sequenceStore.createSequence('S');
    expect(seq.width).toBe(1080);
    expect(seq.height).toBe(1920);
  });

  it('createFxSequence stamps the provider dims onto the new record', () => {
    _setSequenceProjectDimensionsProvider(() => ({ width: 1080, height: 1920 }));
    const layer = makePhysicPaintLayer('fx-layer', 'fx-canonical');
    const seq = sequenceStore.createFxSequence('F', layer, 100);
    expect(seq.width).toBe(1080);
    expect(seq.height).toBe(1920);
  });

  it('createContentOverlaySequence stamps the provider dims onto the new record', () => {
    _setSequenceProjectDimensionsProvider(() => ({ width: 1080, height: 1920 }));
    const layer: Layer = {
      id: 'overlay-layer',
      name: 'overlay-layer',
      type: 'paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'paint', layerId: 'overlay-layer' },
      isBase: false,
    };
    const seq = sequenceStore.createContentOverlaySequence('O', layer, 100);
    expect(seq.width).toBe(1080);
    expect(seq.height).toBe(1920);
  });

  it('falls back to 1920x1080 when no provider is wired', () => {
    // Reset to a state where the provider is the default (matches boot).
    _setSequenceProjectDimensionsProvider(() => DEFAULT_DIMS);
    const seq = sequenceStore.createSequence('Default');
    expect(seq.width).toBe(1920);
    expect(seq.height).toBe(1080);
  });
});

describe('layer stack naming and placement (260923-kcs)', () => {
  beforeEach(() => {
    resetHistory();
    sequenceStore.reset();
  });

  function makeStackLayer(id: string): Layer {
    return {
      id,
      name: id,
      type: 'paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'paint', layerId: id },
      isBase: false,
    };
  }

  describe('nextFreeLayerName — first free Layer N index', () => {
    // Namespace access so a missing export fails each pin as a named test
    // failure instead of a module-load crash (RED evidence requires real tests).
    const nextFreeLayerName = (sequenceStoreModule as Record<string, unknown>).nextFreeLayerName as
      (sequences: ReadonlyArray<{ name: string }>) => string;

    it('returns Layer 1 for an empty stack', () => {
      expect(nextFreeLayerName([])).toBe('Layer 1');
    });

    it('returns the index after a dense Layer run (spec example)', () => {
      expect(
        nextFreeLayerName([{ name: 'Layer 1' }, { name: 'Layer 2' }, { name: 'Layer 3' }]),
      ).toBe('Layer 4');
    });

    it('returns the first FREE index, not max+1', () => {
      expect(nextFreeLayerName([{ name: 'Layer 1' }, { name: 'Layer 3' }])).toBe('Layer 2');
    });

    it('ignores names that do not match the Layer N pattern', () => {
      expect(
        nextFreeLayerName([{ name: 'Film Grain' }, { name: 'Sequence 3' }]),
      ).toBe('Layer 1');
    });
  });

  describe('top insert (position: top / content overlay)', () => {
    it('createFxSequence with position top lands the new sequence at the head of the stack', () => {
      const existing = sequenceStore.createFxSequence('Existing FX', makeStackLayer('existing-layer'), 100);
      const created = sequenceStore.createFxSequence('New Top FX', makeStackLayer('new-layer'), 100, { position: 'top' });
      const overlays = sequenceStore.getOverlaySequences();
      expect(overlays[0].id).toBe(created.id);
      expect(overlays[1].id).toBe(existing.id);
    });

    it('createContentOverlaySequence always lands at the head of the stack', () => {
      const existing = sequenceStore.createFxSequence('Existing FX', makeStackLayer('existing-layer'), 100);
      const created = sequenceStore.createContentOverlaySequence('overlay.png', makeStackLayer('overlay-layer'), 100);
      const overlays = sequenceStore.getOverlaySequences();
      expect(overlays[0].id).toBe(created.id);
      expect(overlays[1].id).toBe(existing.id);
    });
  });

  describe('rename hardening', () => {
    it('rejects control characters fail-closed without changing the name or pushing undo', () => {
      const seq = sequenceStore.createFxSequence('Original', makeStackLayer('layer-r'), 100);
      sequenceStore.rename(seq.id, 'bad\x07name');
      expect(sequenceStore.getById(seq.id)?.name).toBe('Original');
      // No undo entry was pushed for the rejected rename: undo must still land
      // on the sequence creation (which removes the sequence).
      undo();
      expect(sequenceStore.getById(seq.id)).toBeNull();
    });

    it('CONTROL: a renamed stack keeps its name across an FX reorder (green at base)', () => {
      const a = sequenceStore.createFxSequence('Stack A', makeStackLayer('layer-a'), 100);
      sequenceStore.createFxSequence('Stack B', makeStackLayer('layer-b'), 100);
      sequenceStore.rename(a.id, 'Renamed');
      sequenceStore.reorderFxSequences(0, 1);
      expect(sequenceStore.getById(a.id)?.name).toBe('Renamed');
    });
  });
});
