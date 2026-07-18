import {describe, it, expect, beforeEach} from 'vitest';
import {sequenceStore} from '../stores/sequenceStore';
import {defaultTransform, type Layer} from '../types/layer';
import {frameMap, fxTrackLayouts} from './frameMap';
import {physicPaintStore} from '../stores/physicPaintStore';
import type {Sequence} from '../types/sequence';

/** Build a test sequence with `as any` for solidColor/isTransparent fields
 *  that don't exist on KeyPhoto yet (Plan 01 will add them). */
function makeSequence(overrides: Partial<Sequence> & { keyPhotos: any[] }): Sequence {
  return {
    id: 'seq-1',
    name: 'Test',
    kind: 'content',
    fps: 24,
    width: 1920,
    height: 1080,
    layers: [],
    ...overrides,
  } as Sequence;
}

function makeFxSequence(id: string, name: string, layer: Layer): Sequence {
  return {
    id,
    name,
    kind: 'fx',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [layer],
    inFrame: 0,
    outFrame: 24,
  };
}

describe('frameMap solid/transparent entries', () => {
  beforeEach(() => {
    sequenceStore.reset();
    physicPaintStore.reset();
  });

  it('produces FrameEntry with solidColor for key solid entries', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: '', holdFrames: 2, solidColor: '#FF0000'} as any,
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(2);
    expect((entries[0] as any).solidColor).toBe('#FF0000');
    expect(entries[0].imageId).toBe('');
    expect((entries[1] as any).solidColor).toBe('#FF0000');
  });

  it('produces FrameEntry with isTransparent for transparent entries', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: '', holdFrames: 1, solidColor: '#000000', isTransparent: true} as any,
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).isTransparent).toBe(true);
  });

  it('produces FrameEntry without solidColor for regular key photos', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: 'img-1', holdFrames: 1},
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).solidColor).toBeUndefined();
    expect((entries[0] as any).isTransparent).toBeUndefined();
    expect(entries[0].imageId).toBe('img-1');
  });

  it('interleaves solid and photo FrameEntry correctly', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: 'img-1', holdFrames: 1},
        {id: 'kp-2', imageId: '', holdFrames: 2, solidColor: '#0000FF'} as any,
        {id: 'kp-3', imageId: 'img-2', holdFrames: 1},
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(4);
    expect(entries[0].imageId).toBe('img-1');
    expect((entries[0] as any).solidColor).toBeUndefined();
    expect((entries[1] as any).solidColor).toBe('#0000FF');
    expect((entries[2] as any).solidColor).toBe('#0000FF');
    expect(entries[3].imageId).toBe('img-2');
    expect((entries[3] as any).solidColor).toBeUndefined();
  });

  it('extends the parent timeline and FX range to generated Roto interpolation display frames', () => {
    sequenceStore.sequences.value = [
      makeSequence({
        keyPhotos: [
          {id: 'kp-0', imageId: 'circle', holdFrames: 1},
          {id: 'kp-1', imageId: 'square', holdFrames: 1},
          {id: 'kp-2', imageId: 'crossed', holdFrames: 1},
        ],
      }),
      {
        id: 'fx-roto',
        kind: 'fx',
        name: 'Roto FX',
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: [],
        layers: [{
          id: 'roto-layer',
          name: 'Roto',
          type: 'physic-paint',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          transform: defaultTransform(),
          source: { type: 'physic-paint', layerId: 'roto-layer' },
        }],
        inFrame: 0,
        outFrame: 3,
      },
    ] as Sequence[];
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 0, { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,Y2lyY2xl' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 1, { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,c3F1YXJl' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,Y3Jvc3NlZA==' });
    physicPaintStore.setRotoInterpolationSettings('roto-layer', { enabled: true, inBetweenCount: 3, mode: 'duplicate' });

    const entries = frameMap.value;
    expect(entries).toHaveLength(9);
    expect(entries.slice(0, 3).map((entry) => entry.imageId)).toEqual(['circle', 'square', 'crossed']);
    expect(entries.slice(3).every((entry) => entry.imageId === 'crossed')).toBe(true);
    expect(fxTrackLayouts.value[0]).toEqual(expect.objectContaining({ sequenceId: 'fx-roto', inFrame: 0, outFrame: 9 }));
  });

  it('renumbers only Physics Paint FX tracks after mixed-order reorder and deletion without changing sequence names', () => {
    const physicLayer = (id: string): Layer => ({
      id,
      name: 'Physic Paint',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'physic-paint', layerId: id },
    });
    const grainLayer: Layer = {
      id: 'grain-layer',
      name: 'Film Grain',
      type: 'generator-grain',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'generator-grain', density: 0.3, size: 1, intensity: 0.5, lockSeed: true, seed: 42 },
    };
    const paintLayer: Layer = {
      id: 'paint-layer',
      name: 'Paint',
      type: 'paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'paint', layerId: 'paint-layer' },
    };
    const physicsA = makeFxSequence('physics-a', 'Persisted Physics A', physicLayer('physics-layer-a'));
    const grain = makeFxSequence('grain', 'Film Grain Sequence', grainLayer);
    const physicsB = makeFxSequence('physics-b', 'Persisted Physics B', physicLayer('physics-layer-b'));
    const paint = makeFxSequence('paint', 'Paint Sequence', paintLayer);
    const physicsC = makeFxSequence('physics-c', 'Persisted Physics C', physicLayer('physics-layer-c'));

    sequenceStore.sequences.value = [physicsA, grain, physicsB, paint, physicsC];
    expect(fxTrackLayouts.value.map(({ sequenceId, sequenceName, headerLabel }) => ({ sequenceId, sequenceName, headerLabel }))).toEqual([
      { sequenceId: 'physics-a', sequenceName: 'Persisted Physics A', headerLabel: 'PPaint #1' },
      { sequenceId: 'grain', sequenceName: 'Film Grain Sequence', headerLabel: 'Film Grain Sequence' },
      { sequenceId: 'physics-b', sequenceName: 'Persisted Physics B', headerLabel: 'PPaint #2' },
      { sequenceId: 'paint', sequenceName: 'Paint Sequence', headerLabel: 'Paint Sequence' },
      { sequenceId: 'physics-c', sequenceName: 'Persisted Physics C', headerLabel: 'PPaint #3' },
    ]);

    sequenceStore.sequences.value = [physicsC, grain, physicsA, paint, physicsB];
    expect(fxTrackLayouts.value.map(({ sequenceId, sequenceName, headerLabel }) => ({ sequenceId, sequenceName, headerLabel }))).toEqual([
      { sequenceId: 'physics-c', sequenceName: 'Persisted Physics C', headerLabel: 'PPaint #1' },
      { sequenceId: 'grain', sequenceName: 'Film Grain Sequence', headerLabel: 'Film Grain Sequence' },
      { sequenceId: 'physics-a', sequenceName: 'Persisted Physics A', headerLabel: 'PPaint #2' },
      { sequenceId: 'paint', sequenceName: 'Paint Sequence', headerLabel: 'Paint Sequence' },
      { sequenceId: 'physics-b', sequenceName: 'Persisted Physics B', headerLabel: 'PPaint #3' },
    ]);

    sequenceStore.sequences.value = [physicsC, grain, paint, physicsB];
    expect(fxTrackLayouts.value.map(({ sequenceId, sequenceName, headerLabel }) => ({ sequenceId, sequenceName, headerLabel }))).toEqual([
      { sequenceId: 'physics-c', sequenceName: 'Persisted Physics C', headerLabel: 'PPaint #1' },
      { sequenceId: 'grain', sequenceName: 'Film Grain Sequence', headerLabel: 'Film Grain Sequence' },
      { sequenceId: 'paint', sequenceName: 'Paint Sequence', headerLabel: 'Paint Sequence' },
      { sequenceId: 'physics-b', sequenceName: 'Persisted Physics B', headerLabel: 'PPaint #2' },
    ]);
  });
});
