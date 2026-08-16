import {describe, it, expect, beforeEach} from 'vitest';
import {sequenceStore} from '../stores/sequenceStore';
import {defaultTransform, type Layer} from '../types/layer';
import {frameMap, fxTrackLayouts, resolveSequenceTimelineRange, trackLayouts} from './frameMap';
import {physicPaintStore} from '../stores/physicPaintStore';
import {buildPhysicPaintRotoPhysicalRevision} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type {Sequence} from '../types/sequence';
import type {PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

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

function makePhysicPaintLayer(layerId: string): Layer {
  return {
    id: layerId,
    name: 'Physic Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId },
  };
}

function makeRotoRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    keyId,
    appFrame,
    kind: 'real-key',
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: `data:image/png;base64,${String(appFrame).padStart(4, 'A')}`,
    },
  };
}

function makeLoopClip(
  loopId: string,
  placementStart: number,
  repeat: number | 'infinity',
  mode: PhysicPaintRotoLoopClip['mode'] = 'progressive',
): PhysicPaintRotoLoopClip {
  return {
    loopId,
    placementStart,
    sourceKeyIds: ['key-0', 'key-1', 'key-2', 'key-3', 'key-4'],
    repeat,
    mode,
  };
}

function makeLifecycleGroup(
  visibleRanges: PhysicPaintRotoLoopClip['visibleRanges'],
): PhysicPaintRotoLoopClip {
  return {
    ...makeLoopClip('group-lifecycle', 10, 4),
    syncState: 'modified',
    provenanceState: 'detached',
    phaseOrigin: 10,
    originalEndExclusive: 30,
    visibleRanges,
    frameOverrides: [],
  };
}

function installRotoDocument(
  layerId: string,
  recordFrames: readonly number[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
): void {
  const records = recordFrames.map((appFrame) => makeRotoRecord(`key-${appFrame}`, appFrame));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, {
    capacity: 120,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
  });
  if (!result.ok) throw new Error(result.error);
}

describe('frameMap solid/transparent entries', () => {
  beforeEach(() => {
    sequenceStore.reset();
    physicPaintStore.reset();
  });

  it('resolves a 30-frame content Sequence at global F100 from one validated track layout', () => {
    const sequence = makeSequence({
      id: 'content-at-100',
      keyPhotos: [
        { id: 'kp-a', imageId: 'a', holdFrames: 10 },
        { id: 'kp-b', imageId: 'b', holdFrames: 20 },
      ],
    });

    expect(resolveSequenceTimelineRange(sequence, [{
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      startFrame: 100,
      endFrame: 130,
      keyPhotoRanges: [],
    }])).toEqual({
      globalStart: 100,
      globalEndExclusive: 130,
      localEndExclusive: 30,
    });
  });

  it('fails closed on missing, duplicate, malformed, or timing-divergent content layouts', () => {
    const sequence = makeSequence({
      id: 'content-at-100',
      keyPhotos: [{ id: 'kp', imageId: 'a', holdFrames: 30 }],
    });
    const validLayout = {
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      startFrame: 100,
      endFrame: 130,
      keyPhotoRanges: [],
    };

    expect(resolveSequenceTimelineRange(sequence, [])).toBeNull();
    expect(resolveSequenceTimelineRange(sequence, [validLayout, { ...validLayout }])).toBeNull();
    expect(resolveSequenceTimelineRange(sequence, [{ ...validLayout, startFrame: -1, endFrame: 29 }])).toBeNull();
    expect(resolveSequenceTimelineRange(sequence, [{ ...validLayout, endFrame: 131 }])).toBeNull();
    expect(resolveSequenceTimelineRange({ ...sequence, keyPhotos: [{ id: 'kp', imageId: 'a', holdFrames: 0 }] }, [validLayout])).toBeNull();
  });

  it('retains validated FX in/out duration semantics without track layouts', () => {
    const sequence = makeFxSequence('fx-range', 'FX range', makePhysicPaintLayer('fx-layer'));
    sequence.inFrame = 7;
    sequence.outFrame = 39;

    expect(resolveSequenceTimelineRange(sequence, [])).toEqual({
      globalStart: 7,
      globalEndExclusive: 39,
      localEndExclusive: 32,
    });
    expect(resolveSequenceTimelineRange({ ...sequence, outFrame: 7 }, [])).toBeNull();
    expect(resolveSequenceTimelineRange({ ...sequence, inFrame: undefined }, [])).toBeNull();
  });

  it('keeps a second content Infinity Group extending to the child document capacity at global F100 (43.4 defect 1)', () => {
    const layerId = 'content-infinity-layer';
    const leading = makeSequence({
      id: 'leading-content',
      keyPhotos: [{ id: 'leading-key', imageId: 'leading', holdFrames: 100 }],
    });
    const sequence = makeSequence({
      id: 'content-at-100',
      layers: [makePhysicPaintLayer(layerId)],
      keyPhotos: [{ id: 'local-key', imageId: 'local', holdFrames: 30 }],
    });
    sequenceStore.sequences.value = [leading, sequence];
    installRotoDocument(layerId, [0, 1, 2, 3, 4], [makeLoopClip('content-infinity', 10, 'infinity')]);

    const layout = trackLayouts.value.find((candidate) => candidate.sequenceId === sequence.id);
    expect(layout).toEqual(expect.objectContaining({ startFrame: 100, endFrame: 130 }));
    expect(resolveSequenceTimelineRange(sequence, trackLayouts.value)).toEqual({
      globalStart: 100,
      globalEndExclusive: 130,
      localEndExclusive: 30,
    });
    expect(frameMap.value).toHaveLength(220);
    expect(frameMap.value[100]).toEqual(expect.objectContaining({
      globalFrame: 100,
      sequenceId: sequence.id,
      localFrame: 0,
    }));
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

  it('extends the parent timeline and FX range to generated Roto interpolation physical frames', () => {
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
    // Physical real keys at direct appFrames 0, 4, 8 with interpolation enabled:
    // gap-derived interiors fill 1-3 and 5-7, so the physical end frame is 9.
    const records = [
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,Y2lyY2xl' },
      { keyId: 'key-4', appFrame: 4, dataUrl: 'data:image/png;base64,c3F1YXJl' },
      { keyId: 'key-8', appFrame: 8, dataUrl: 'data:image/png;base64,Y3Jvc3NlZA==' },
    ].map((key) => ({
      keyId: key.keyId,
      appFrame: key.appFrame,
      kind: 'real-key' as const,
      payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl },
    }));
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument('roto-layer', {
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
    });
    if (!seeded.ok) throw new Error(seeded.error);

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

describe('Motion Editor passive Loop Clip markers (D-33R)', () => {
  it('projects only passive Loop Clip intervals to the Motion Editor frame map', () => {
    const layerId = 'passive-loop-layer';
    const sequence = {
      ...makeFxSequence('passive-loop-sequence', 'Passive Loop', makePhysicPaintLayer(layerId)),
      outFrame: 40,
    };
    sequenceStore.sequences.value = [sequence];
    installRotoDocument(layerId, [0, 1, 2, 3, 4], [makeLoopClip('loop-private', 10, 5)]);

    const layout = fxTrackLayouts.value[0];
    expect(layout.repeatDurationMarkers).toEqual([{ startFrame: 10, frameCount: 25, mode: 'progressive' }]);
    expect(Object.keys(layout.repeatDurationMarkers![0])).toEqual(['startFrame', 'frameCount', 'mode']);
    expect(JSON.stringify(layout.repeatDurationMarkers)).not.toContain('loop-private');
  });

  it('reacts to accepted fragmented Group ranges without deriving a second marker authority', () => {
    const layerId = 'lifecycle-group-layer';
    const sequence = {
      ...makeFxSequence('lifecycle-group-sequence', 'Lifecycle Group', makePhysicPaintLayer(layerId)),
      outFrame: 40,
    };
    sequenceStore.sequences.value = [sequence];
    installRotoDocument(
      layerId,
      [0, 1, 2, 3, 4],
      [makeLifecycleGroup([
        { start: 10, endExclusive: 14 },
        { start: 16, endExclusive: 30 },
      ])],
    );

    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toEqual([
      { startFrame: 10, frameCount: 4, mode: 'progressive' },
      { startFrame: 16, frameCount: 14, mode: 'progressive' },
    ]);

    const regenerated = physicPaintStore.replaceRotoPhysicalLoopClips(layerId, [makeLifecycleGroup([
      { start: 10, endExclusive: 30 },
    ])]);
    if (!regenerated.ok) throw new Error(regenerated.error);

    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toEqual([
      { startFrame: 10, frameCount: 20, mode: 'progressive' },
    ]);
  });

  it('uses resolver effective ends for real-key truncation and later-loop priority', () => {
    const layerId = 'bounded-loop-layer';
    const sequence = {
      ...makeFxSequence('bounded-loop-sequence', 'Bounded Loop', makePhysicPaintLayer(layerId)),
      outFrame: 40,
    };
    sequenceStore.sequences.value = [sequence];
    installRotoDocument(
      layerId,
      [0, 1, 2, 3, 4, 22],
      [makeLoopClip('loop-a', 10, 5), makeLoopClip('loop-b', 20, 2, 'static')],
    );

    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toEqual([
      { startFrame: 10, frameCount: 10, mode: 'progressive' },
      { startFrame: 20, frameCount: 2, mode: 'static' },
    ]);
  });

  it('keeps Infinity capacity-bounded and marker frames layer-local (43.4 defect 1)', () => {
    const layerId = 'infinity-loop-layer';
    const sequence = {
      ...makeFxSequence('infinity-loop-sequence', 'Infinity Loop', makePhysicPaintLayer(layerId)),
      inFrame: 7,
      outFrame: 39,
    };
    sequenceStore.sequences.value = [sequence];
    installRotoDocument(layerId, [0, 1, 2, 3, 4], [makeLoopClip('loop-infinity', 10, 'infinity')]);

    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toEqual([
      { startFrame: 10, frameCount: 110, mode: 'progressive' },
    ]);
  });

  it('omits zero-effective, empty, and non-Physic-Paint marker projections', () => {
    const layerId = 'zero-loop-layer';
    const physicsSequence = {
      ...makeFxSequence('zero-loop-sequence', 'Zero Loop', makePhysicPaintLayer(layerId)),
      outFrame: 40,
    };
    sequenceStore.sequences.value = [physicsSequence];
    installRotoDocument(layerId, [0, 1, 2, 3, 4, 10], [makeLoopClip('loop-zero', 10, 5)]);
    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toBeUndefined();

    installRotoDocument(layerId, [0, 1, 2, 3, 4], []);
    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toBeUndefined();

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
    sequenceStore.sequences.value = [makeFxSequence('paint-sequence', 'Paint', paintLayer)];
    expect(fxTrackLayouts.value[0].repeatDurationMarkers).toBeUndefined();
  });
});
