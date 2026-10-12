import {describe,it, expect, beforeEach} from 'vitest';
import {sequenceStore} from '../stores/sequenceStore';
import {defaultTransform, type Layer} from '../types/layer';
import {frameMap, fxTrackLayouts, resolveSequenceTimelineRange, totalFrames, trackLayouts, resolveOverlaySample, getOverlaySkipRange, type OverlaySampleClip} from './frameMap';
import {physicPaintStore} from '../stores/physicPaintStore';
import {registerDocument, reset as resetEfxPaintStore} from '../stores/efxPaintStore';
import {createEfxPaintDocument} from '../efx-paint/document/efxPaintDocument';
import type {EfxPaintDocument} from '../efx-paint/document/efxPaintDocument';
import {buildPhysicPaintRotoPhysicalRevision} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type {Sequence} from '../types/sequence';
import type {PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import type {ContentFrameEntry, FrameEntry} from '../types/timeline';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

/** 52.3-01 (D-01): narrow a FrameEntry to its content arm — throws unless
 *  e.kind === 'content'. Preferred over scattering `as any` for the file's
 *  keyPhotoId/imageId assertions (the `as any` escape stays the accepted idiom
 *  for the optional solidColor/isTransparent fields). */
function asContent(e: FrameEntry): ContentFrameEntry {
  if (e.kind !== 'content') throw new Error(`expected content entry, got kind '${e.kind}'`);
  return e;
}

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

/** Build a test sequence with `as any` for solidColor/isTransparent fields
 *  that don't exist on KeyPhoto yet (Plan 01 will add them). */
function makeSequence(overrides: Partial<Sequence> & { keyPhotos: any[] }): Sequence {
  return {
    id: 'seq-1',
    name: 'Test',
    kind: 'content',
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
      bytes: testWebpBytes(String(appFrame).padStart(4, 'A')),
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
  registerDocument(makeTrackDocument(layerId));
  const records = recordFrames.map((appFrame) => makeRotoRecord(`key-${appFrame}`, appFrame));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, TEST_TRACK_ID, {
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
    resetEfxPaintStore();
    registerDocument(makeTrackDocument('roto-layer'));
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
    expect(asContent(entries[0]).imageId).toBe('');
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
    expect(asContent(entries[0]).imageId).toBe('img-1');
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
    expect(asContent(entries[0]).imageId).toBe('img-1');
    expect((entries[0] as any).solidColor).toBeUndefined();
    expect((entries[1] as any).solidColor).toBe('#0000FF');
    expect((entries[2] as any).solidColor).toBe('#0000FF');
    expect(asContent(entries[3]).imageId).toBe('img-2');
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
      { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('Y2lyY2xl') },
      { keyId: 'key-4', appFrame: 4, bytes: testWebpBytes('c3F1YXJl') },
      { keyId: 'key-8', appFrame: 8, bytes: testWebpBytes('Y3Jvc3NlZA==') },
    ].map((key) => ({
      keyId: key.keyId,
      appFrame: key.appFrame,
      kind: 'real-key' as const,
      payload: { frameIndex: 0, appFrame: key.appFrame, bytes: key.bytes },
    }));
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument('roto-layer', TEST_TRACK_ID, {
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
    expect(entries.slice(0, 3).map((entry) => asContent(entry).imageId)).toEqual(['circle', 'square', 'crossed']);
    expect(entries.slice(3).every((entry) => asContent(entry).imageId === 'crossed')).toBe(true);
    expect(fxTrackLayouts.value[0]).toEqual(expect.objectContaining({ sequenceId: 'fx-roto', inFrame: 0, outFrame: 9 }));
  });

  it('keeps Physics Paint FX header labels identity-stable across reorder and deletion', () => {
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

    // Identity law (260923-kcs): every header shows its OWN stored name —
    // no positional PPaint #N renumbering exists in any arrangement.
    sequenceStore.sequences.value = [physicsA, grain, physicsB, paint, physicsC];
    expect(fxTrackLayouts.value.map(({ sequenceId, sequenceName, headerLabel }) => ({ sequenceId, sequenceName, headerLabel }))).toEqual([
      { sequenceId: 'physics-a', sequenceName: 'Persisted Physics A', headerLabel: 'Persisted Physics A' },
      { sequenceId: 'grain', sequenceName: 'Film Grain Sequence', headerLabel: 'Film Grain Sequence' },
      { sequenceId: 'physics-b', sequenceName: 'Persisted Physics B', headerLabel: 'Persisted Physics B' },
      { sequenceId: 'paint', sequenceName: 'Paint Sequence', headerLabel: 'Paint Sequence' },
      { sequenceId: 'physics-c', sequenceName: 'Persisted Physics C', headerLabel: 'Persisted Physics C' },
    ]);

    sequenceStore.sequences.value = [physicsC, grain, physicsA, paint, physicsB];
    expect(fxTrackLayouts.value.map(({ sequenceId, sequenceName, headerLabel }) => ({ sequenceId, sequenceName, headerLabel }))).toEqual([
      { sequenceId: 'physics-c', sequenceName: 'Persisted Physics C', headerLabel: 'Persisted Physics C' },
      { sequenceId: 'grain', sequenceName: 'Film Grain Sequence', headerLabel: 'Film Grain Sequence' },
      { sequenceId: 'physics-a', sequenceName: 'Persisted Physics A', headerLabel: 'Persisted Physics A' },
      { sequenceId: 'paint', sequenceName: 'Paint Sequence', headerLabel: 'Paint Sequence' },
      { sequenceId: 'physics-b', sequenceName: 'Persisted Physics B', headerLabel: 'Persisted Physics B' },
    ]);

    sequenceStore.sequences.value = [physicsC, grain, paint, physicsB];
    expect(fxTrackLayouts.value.map(({ sequenceId, sequenceName, headerLabel }) => ({ sequenceId, sequenceName, headerLabel }))).toEqual([
      { sequenceId: 'physics-c', sequenceName: 'Persisted Physics C', headerLabel: 'Persisted Physics C' },
      { sequenceId: 'grain', sequenceName: 'Film Grain Sequence', headerLabel: 'Film Grain Sequence' },
      { sequenceId: 'paint', sequenceName: 'Paint Sequence', headerLabel: 'Paint Sequence' },
      { sequenceId: 'physics-b', sequenceName: 'Persisted Physics B', headerLabel: 'Persisted Physics B' },
    ]);
  });
});

describe('FX stack header labels are identity, not position (260923-kcs)', () => {
  beforeEach(() => {
    sequenceStore.reset();
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument('roto-layer'));
  });

  it('keeps each FX stack header label equal to its own sequence name through reverse and deletion', () => {
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

    const physicsA = makeFxSequence('physics-a', 'Physics A', physicLayer('physics-layer-a'));
    const physicsB = makeFxSequence('physics-b', 'Physics B', physicLayer('physics-layer-b'));
    const grain = makeFxSequence('grain', 'Grain Stack', grainLayer);

    // Initial arrangement: every header shows its OWN stored name.
    sequenceStore.sequences.value = [physicsA, physicsB, grain];
    for (const row of fxTrackLayouts.value) {
      expect(row.headerLabel).toBe(row.sequenceName);
    }

    // Reversed arrangement: the identity of each sequenceId's label is unchanged
    // (the old positional law renumbered the physic rows to PPaint #1/#2).
    sequenceStore.sequences.value = [grain, physicsB, physicsA];
    const reversed = new Map(fxTrackLayouts.value.map((row) => [row.sequenceId, row]));
    expect(reversed.get('physics-a')?.headerLabel).toBe('Physics A');
    expect(reversed.get('physics-b')?.headerLabel).toBe('Physics B');
    expect(reversed.get('grain')?.headerLabel).toBe('Grain Stack');
    for (const row of fxTrackLayouts.value) {
      expect(row.headerLabel).toBe(row.sequenceName);
    }

    // After deleting the first physic sequence, the survivor keeps its own name
    // (the old positional law shifted it from PPaint #2 to PPaint #1).
    sequenceStore.sequences.value = [grain, physicsB];
    const survivor = fxTrackLayouts.value.find((row) => row.sequenceId === 'physics-b');
    expect(survivor?.headerLabel).toBe('Physics B');
    expect(survivor?.headerLabel).toBe(survivor?.sequenceName);
  });
});

describe('paint enumeration (D-04/D-05)', () => {
  beforeEach(() => {
    sequenceStore.reset();
    physicPaintStore.reset();
    resetEfxPaintStore();
  });

  it('enumerates one dense paint entry per frame for a paint-only fx sequence at inFrame 0', () => {
    sequenceStore.sequences.value = [
      { ...makeFxSequence('fx-paint-only', 'Paint Only', makePhysicPaintLayer('paint-only-layer')), inFrame: 0, outFrame: 5 },
    ];
    installRotoDocument('paint-only-layer', [0, 1, 2, 3, 4], []);

    const entries = frameMap.value;
    expect(entries).toHaveLength(5);
    for (let f = 0; f < 5; f++) {
      expect(entries[f]).toEqual({
        kind: 'paint',
        globalFrame: f,
        sequenceId: 'fx-paint-only',
        layerId: 'paint-only-layer',
      });
    }
  });

  it('fills frames before the fx inFrame with ownerless gap entries', () => {
    sequenceStore.sequences.value = [
      { ...makeFxSequence('fx-offset', 'Offset Paint', makePhysicPaintLayer('offset-layer')), inFrame: 3, outFrame: 8 },
    ];
    installRotoDocument('offset-layer', [0, 1, 2, 3, 4], []);

    const entries = frameMap.value;
    expect(entries).toHaveLength(8);
    expect(entries[0]).toEqual({ kind: 'gap', globalFrame: 0, sequenceId: '' });
    expect(entries[1]).toEqual({ kind: 'gap', globalFrame: 1, sequenceId: '' });
    expect(entries[2]).toEqual({ kind: 'gap', globalFrame: 2, sequenceId: '' });
    expect(entries[3]).toEqual({ kind: 'paint', globalFrame: 3, sequenceId: 'fx-offset', layerId: 'offset-layer' });
    expect(entries[7]).toEqual({ kind: 'paint', globalFrame: 7, sequenceId: 'fx-offset', layerId: 'offset-layer' });
  });

  it('skips a hidden fx sequence entirely (visible: false -> no enumeration)', () => {
    sequenceStore.sequences.value = [
      { ...makeFxSequence('fx-hidden', 'Hidden Paint', makePhysicPaintLayer('hidden-layer')), visible: false },
    ];
    installRotoDocument('hidden-layer', [0, 1, 2, 3, 4], []);

    // The N law skips hidden sequences (frameMap.ts getTimelineRequiredFrameCount),
    // so targetLength is 0 and the enumeration branch produces nothing.
    expect(frameMap.value).toHaveLength(0);
  });

  it('extends N through a loop clip reaching beyond the last real key', () => {
    sequenceStore.sequences.value = [
      { ...makeFxSequence('fx-loop', 'Loop Paint', makePhysicPaintLayer('loop-layer')), inFrame: 0, outFrame: 5 },
    ];
    // Real keys 0..4 (end 5) plus a loop at placementStart 10, 5 source frames,
    // repeat 3 -> effectiveEnd 25. N must follow the loop extent (D-04).
    installRotoDocument('loop-layer', [0, 1, 2, 3, 4], [makeLoopClip('loop-hold', 10, 3)]);

    const entries = frameMap.value;
    expect(entries).toHaveLength(25);
    expect(entries[24]).toEqual({ kind: 'paint', globalFrame: 24, sequenceId: 'fx-loop', layerId: 'loop-layer' });
  });

  it('produces gap entries across the authored span of an fx sequence with no physic-paint layer (side-effect pin)', () => {
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
    sequenceStore.sequences.value = [makeFxSequence('fx-grain', 'Grain', grainLayer)];

    // N law includes the authored span (0..24); no paint owner exists, so every
    // frame is an ownerless gap entry. Documented side effect of the dense fill.
    const entries = frameMap.value;
    expect(entries).toHaveLength(24);
    expect(entries.every((entry) => entry.kind === 'gap' && entry.sequenceId === '')).toBe(true);
  });

  it('enumerates nothing for an empty timeline', () => {
    sequenceStore.sequences.value = [];

    expect(frameMap.value).toHaveLength(0);
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

    const regenerated = physicPaintStore.replaceRotoPhysicalLoopClips(layerId, TEST_TRACK_ID, [makeLifecycleGroup([
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

describe('derived timeline span growth (260918-o0n)', () => {
  beforeEach(() => {
    sequenceStore.reset();
    physicPaintStore.reset();
    resetEfxPaintStore();
  });

  const paintLayer = (layerId: string): Layer => ({
    id: layerId,
    name: 'Paint',
    type: 'paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'paint', layerId },
  });

  const staticImageOverlayLayer = (layerId: string): Layer => ({
    id: layerId,
    name: 'Overlay',
    type: 'static-image',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'static-image', imageId: 'img-overlay' },
  });

  const content20 = () => makeSequence({
    id: 'content-20',
    keyPhotos: [{ id: 'kp-20', imageId: 'img-20', holdFrames: 20 }],
  });

  it('the derived timeline follows a span extension in both directions', () => {
    sequenceStore.sequences.value = [
      content20(),
      { ...makeFxSequence('fx-span', 'Paint span', paintLayer('paint-span')), inFrame: 0, outFrame: 100 },
    ] as Sequence[];

    expect(totalFrames.value).toBe(100);
    expect(fxTrackLayouts.value[0]).toEqual(expect.objectContaining({ sequenceId: 'fx-span', outFrame: 100 }));

    // The user shrinks the span: the derived total follows the span down...
    sequenceStore.updateFxSequenceRange('fx-span', 0, 60);
    expect(totalFrames.value).toBe(60);
    expect(fxTrackLayouts.value[0].outFrame).toBe(60);

    // ...and back up when the span is dragged out again. No clamp anywhere.
    sequenceStore.updateFxSequenceRange('fx-span', 0, 140);
    expect(totalFrames.value).toBe(140);
    expect(fxTrackLayouts.value[0].outFrame).toBe(140);
  });

  it('the derived timeline follows a content-overlay span extension in both directions', () => {
    sequenceStore.sequences.value = [
      content20(),
      {
        ...makeFxSequence('overlay-span', 'Overlay span', staticImageOverlayLayer('overlay-layer')),
        kind: 'content-overlay',
        inFrame: 0,
        outFrame: 100,
      },
    ] as Sequence[];

    expect(totalFrames.value).toBe(100);
    expect(fxTrackLayouts.value[0]).toEqual(expect.objectContaining({ sequenceId: 'overlay-span', outFrame: 100 }));

    sequenceStore.updateFxSequenceRange('overlay-span', 0, 60);
    expect(totalFrames.value).toBe(60);
    expect(fxTrackLayouts.value[0].outFrame).toBe(60);

    sequenceStore.updateFxSequenceRange('overlay-span', 0, 140);
    expect(totalFrames.value).toBe(140);
    expect(fxTrackLayouts.value[0].outFrame).toBe(140);
  });
});

// 53.1-02 (D-03): single tail-policy resolver truth table. Pure calls, no
// canvas, real types. The clip view is what callers already have; the resolver
// is the only hold/loop/skip branch (I-1/I-2/I-5 divergence class dies here).
describe('resolveOverlaySample (D-03 tail policy)', () => {
  // 16-frame source at project fps (the repro's .mov). N = 17 (paint grows the timeline).
  const SOURCE_FRAME_COUNT = 16;
  const N = 17;

  const clip = (overrides: Partial<OverlaySampleClip> = {}): OverlaySampleClip => ({
    inFrame: 0,
    extrapolation: 'hold',
    sourceFrameCount: SOURCE_FRAME_COUNT,
    ...overrides,
  });

  it('inside range returns kind sample with the local frame', () => {
    // in=0, out=16 authoritative: frames 0..15 are in range with local 0..15.
    const trimmed = clip({ outFrame: 16 });
    expect(resolveOverlaySample(trimmed, 0, N).kind).toBe('sample');
    expect((resolveOverlaySample(trimmed, 15, N) as { localFrame: number }).localFrame).toBe(15);

    // Non-zero in: global 5 at in=3 is local 2.
    const shifted = resolveOverlaySample(clip({ inFrame: 3, outFrame: 10 }), 5, N);
    expect(shifted.kind).toBe('sample');
    expect((shifted as { localFrame: number }).localFrame).toBe(2);
  });

  it('globalFrame before inFrame returns kind skip', () => {
    expect(resolveOverlaySample(clip({ inFrame: 3, outFrame: 10 }), 2, N).kind).toBe('skip');
    expect(resolveOverlaySample(clip({ inFrame: 5 }), 0, N).kind).toBe('skip');
  });

  it('globalFrame past an authoritative outFrame returns kind skip (exclusive [in, out))', () => {
    // out=16 exclusive: frame 16 is the first past-out frame.
    const trimmed = clip({ outFrame: 16 });
    expect(resolveOverlaySample(trimmed, 16, N).kind).toBe('skip');
    expect(resolveOverlaySample(trimmed, 20, N).kind).toBe('skip');
  });

  it('untrimmed clip (absent outFrame) never skips inside 0..N; effective out is N', () => {
    const untrimmed = clip(); // no outFrame
    for (let f = 0; f < N; f++) {
      const sample = resolveOverlaySample(untrimmed, f, N);
      expect(sample.kind, `untrimmed must not skip at frame ${f}`).not.toBe('skip');
    }
    // Past N is outside the composition — skip.
    expect(resolveOverlaySample(untrimmed, N, N).kind).toBe('skip');
  });

  it('past sourceFrameCount with hold returns kind hold-last at sourceFrameCount - 1', () => {
    // Clip spans [0, 17) so frame 16 is IN RANGE but past the 16-frame source.
    const holding = clip({ outFrame: 17, extrapolation: 'hold' });
    expect(resolveOverlaySample(holding, 15, N).kind).toBe('sample');
    const pastSource = resolveOverlaySample(holding, 16, N);
    expect(pastSource.kind).toBe('hold-last');
    expect((pastSource as { localFrame: number }).localFrame).toBe(SOURCE_FRAME_COUNT - 1);
  });

  it('past sourceFrameCount with loop returns kind loop with the wrapped local frame', () => {
    const looping = clip({ outFrame: 17, extrapolation: 'loop' });
    // 16 mod 16 = 0.
    const wrapped = resolveOverlaySample(looping, 16, N);
    expect(wrapped.kind).toBe('loop');
    expect((wrapped as { localFrame: number }).localFrame).toBe(0);
    // Longer clip: local 17 wraps to 1 (17 mod 16).
    const longerLoop = clip({ outFrame: 20, extrapolation: 'loop' });
    const wrapped2 = resolveOverlaySample(longerLoop, 17, 20);
    expect(wrapped2.kind).toBe('loop');
    expect((wrapped2 as { localFrame: number }).localFrame).toBe(1);
  });

  it('fail-closed on malformed input returns skip / null, never throws', () => {
    expect(resolveOverlaySample(clip({ sourceFrameCount: 0 }), 0, N).kind).toBe('skip');
    expect(resolveOverlaySample(clip({ sourceFrameCount: -1 }), 0, N).kind).toBe('skip');
    expect(resolveOverlaySample(clip(), Number.NaN, N).kind).toBe('skip');
  });
});

// 53.1-02 Task 3 (D-05/D-06/D-12 one-coverage-truth): getOverlaySkipRange is
// the ONLY exported definition of a coverage gap. The timeline hatch (D-05),
// export warning (D-06) and inspector tail line (D-12) all read this helper —
// never a second computation. This describe locks the contract before 53.1-05
// draws any of those surfaces.
describe('getOverlaySkipRange (single coverage-gap definition)', () => {
  const SOURCE_FRAME_COUNT = 16;
  const N = 17;

  const clip = (overrides: Partial<OverlaySampleClip> = {}): OverlaySampleClip => ({
    inFrame: 0,
    extrapolation: 'hold',
    sourceFrameCount: SOURCE_FRAME_COUNT,
    ...overrides,
  });

  it('returns the past-out interval [out, N) when out is present and out < N', () => {
    const gap16 = getOverlaySkipRange(clip({ outFrame: 16 }), N);
    expect(gap16).not.toBeNull();
    expect(gap16!.start).toBe(16);
    expect(gap16!.endExclusive).toBe(17);

    const gap10 = getOverlaySkipRange(clip({ outFrame: 10 }), N);
    expect(gap10).not.toBeNull();
    expect(gap10!.start).toBe(10);
    expect(gap10!.endExclusive).toBe(17);
  });

  it('returns null when out is absent (untrimmed never gaps) or out >= N', () => {
    expect(getOverlaySkipRange(clip(), N)).toBeNull();
    expect(getOverlaySkipRange(clip({ outFrame: 17 }), N)).toBeNull();
    expect(getOverlaySkipRange(clip({ outFrame: 20 }), N)).toBeNull();
  });

  it('helper range agrees with the resolver skip region for a trimmed clip with N past out', () => {
    const trimmed = clip({ outFrame: 16 });
    const range = getOverlaySkipRange(trimmed, N);
    expect(range).not.toBeNull();

    // Every frame inside the helper range resolves to skip…
    for (let f = range!.start; f < range!.endExclusive; f++) {
      expect(resolveOverlaySample(trimmed, f, N).kind, `frame ${f} in skip range must skip`).toBe('skip');
    }
    // …and every skip past out lies inside that range.
    for (let f = 0; f < N; f++) {
      const sample = resolveOverlaySample(trimmed, f, N);
      if (sample.kind === 'skip') {
        expect(f, `skip at ${f} must lie inside [${range!.start}, ${range!.endExclusive})`)
          .toBeGreaterThanOrEqual(range!.start);
        expect(f).toBeLessThan(range!.endExclusive);
      }
    }
  });

  it('names only the past-out gap — a before-in region is not part of the coverage-gap range (D-05/D-06/D-12)', () => {
    // in=3, out=10, N=17: skips are [0, 3) before-in AND [10, 17) past-out.
    // The helper must name ONLY the past-out gap — the single range the timeline
    // hatch (D-05), export warning (D-06) and inspector tail line (D-12) draw.
    const shifted = clip({ inFrame: 3, outFrame: 10 });
    const range = getOverlaySkipRange(shifted, N);
    expect(range).not.toBeNull();
    expect(range!.start).toBe(10);
    expect(range!.endExclusive).toBe(17);

    // Before-in frames skip but are NOT in the coverage-gap range.
    expect(resolveOverlaySample(shifted, 0, N).kind).toBe('skip');
    expect(resolveOverlaySample(shifted, 2, N).kind).toBe('skip');
    expect(0).toBeLessThan(range!.start);
  });

  it('untrimmed clip yields a null skip range and no skips inside 0..N', () => {
    const untrimmed = clip();
    expect(getOverlaySkipRange(untrimmed, N)).toBeNull();
    for (let f = 0; f < N; f++) {
      expect(resolveOverlaySample(untrimmed, f, N).kind, `untrimmed must not skip at ${f}`).not.toBe('skip');
    }
  });
});
