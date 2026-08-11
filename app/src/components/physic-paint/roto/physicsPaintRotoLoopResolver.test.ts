import { describe, expect, it } from 'vitest';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
} from './physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoKeyIdentity } from './physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopClip } from './physicsPaintRotoPhysicalModel';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';
import { getPhysicsPaintRotoSourceCycleId } from './physicsPaintRotoSpacingSelection';

/**
 * Phase 43-02 RED spec — linked Loop Clip resolution (HOLD-05).
 *
 * Locks the two canonical loop layers on the physical resolver:
 *  (a) a compact per-loop interval derivation — ONE record per Loop Clip,
 *      never duration-proportional (D-32, audit finding 2);
 *  (b) a lazy per-frame resolution query returning the single typed contract
 *      'real' | 'linked' | 'linked-unresolved' | 'empty' (audit finding 3).
 *
 * Locked algebra under test: D-24 boundary candidates (non-owned real key,
 * another loop's placementStart, parentEndExclusive — a loop never truncates
 * itself), D-14 loop-loop priority (later loop starts at its placementStart,
 * earlier loop truncates, never pushed), D-08/D-22 zero-effective survival,
 * D-25 infinity parent-end tracking bounded by PHYSIC_PAINT_MAX_APPLY_FRAMES
 * (Q4), D-21 partial-cycle detection, D-30 pure re-derivation, D-31 verbatim
 * unresolved records with exact missing source lists.
 */

const CAPACITY = PHYSIC_PAINT_MAX_APPLY_FRAMES;

function ids(entries: readonly (readonly [string, number])[]): PhysicPaintRotoKeyIdentity[] {
  return entries.map(([keyId, appFrame]) => ({ keyId, appFrame }));
}

function loop(
  loopId: string,
  placementStart: number,
  sourceKeyIds: readonly string[],
  repeat: number | 'infinity',
): PhysicPaintRotoLoopClip {
  return { loopId, placementStart, sourceKeyIds, repeat, mode: 'static' };
}

/** Source-cycle keys A..E at frames 10..14 — the shared 5-frame cycle baseline. */
const SOURCE_KEYS = ids([
  ['A', 10],
  ['B', 11],
  ['C', 12],
  ['D', 13],
  ['E', 14],
]);
const SOURCE_KEY_IDS = ['A', 'B', 'C', 'D', 'E'] as const;

function deriveBaseline(
  loopClips: readonly PhysicPaintRotoLoopClip[],
  identities: readonly PhysicPaintRotoKeyIdentity[] = SOURCE_KEYS,
  parentEndExclusive = CAPACITY,
  interpolationEnabled = false,
) {
  return derivePhysicPaintRotoLoopRanges({
    identities,
    loopClips,
    parentEndExclusive,
    capacity: CAPACITY,
    interpolationEnabled,
  });
}

describe('derivePhysicPaintRotoLoopRanges — compact interval derivation (D-32)', () => {
  it('derives ONE compact interval record per Loop Clip with requested/effective ends and boundary', () => {
    const { ranges } = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 5)]);

    expect(ranges).toHaveLength(1);
    const range = ranges[0];
    expect(range).toMatchObject({
      loopId: 'L1',
      placementStart: 10,
      cycleLength: 5,
      repeat: 5,
      requestedEnd: 35,
      effectiveEnd: 35,
      truncated: false,
      partialCycle: false,
      unresolved: null,
    });
    expect(range.sourceKeyIds).toEqual([...SOURCE_KEY_IDS]);
    expect(range.sourceFrameCount).toBe(5);
    expect(range.sourceOffsets).toEqual([0, 1, 2, 3, 4]);
    expect(range.boundary).toEqual({ kind: 'parent-end', frame: CAPACITY });
  });

  it('derives physical cadence from ordered source-key timing and uses it for finite, infinity, and partial-cycle math', () => {
    const spaced = ids([
      ['A', 10],
      ['B', 13],
      ['C', 16],
    ]);
    const finite = deriveBaseline([loop('LS', 20, ['A', 'B', 'C'], 3)], spaced, 100, true);

    expect(finite.ranges[0]).toMatchObject({
      sourceFrameCount: 3,
      sourceOffsets: [0, 3, 6],
      cycleLength: 7,
      requestedEnd: 41,
      effectiveEnd: 41,
      partialCycle: false,
    });

    const infinity = deriveBaseline([loop('LI', 20, ['A', 'B', 'C'], 'infinity')], spaced, 39, true);
    expect(infinity.ranges[0]).toMatchObject({
      cycleLength: 7,
      requestedEnd: 'infinity',
      effectiveEnd: 39,
      partialCycle: true,
    });

    const truncated = deriveBaseline(
      [loop('LT', 20, ['A', 'B', 'C'], 4)],
      [...spaced, { keyId: 'X', appFrame: 35 }],
      100,
      true,
    );
    expect(truncated.ranges[0]).toMatchObject({
      requestedEnd: 48,
      effectiveEnd: 35,
      truncated: true,
      partialCycle: true,
    });
  });

  it('never materializes duration-proportional collections for a huge finite repeat or an Infinity loop', () => {
    const hugeFinite = derivePhysicPaintRotoLoopRanges({
      identities: SOURCE_KEYS,
      loopClips: [loop('LH', 10, SOURCE_KEY_IDS, 100000)],
      parentEndExclusive: 500010,
      capacity: CAPACITY,
      interpolationEnabled: false,
    });
    expect(hugeFinite.ranges).toHaveLength(1);
    expect(hugeFinite.ranges[0]).toMatchObject({
      loopId: 'LH',
      requestedEnd: 500010,
      effectiveEnd: 500010,
      truncated: false,
    });

    const infinite = deriveBaseline([loop('LI', 10, SOURCE_KEY_IDS, 'infinity')], SOURCE_KEYS, 300);
    expect(infinite.ranges).toHaveLength(1);

    const combined = deriveBaseline(
      [loop('L1', 10, SOURCE_KEY_IDS, 100000), loop('L2', 40, SOURCE_KEY_IDS, 'infinity'), loop('L3', 60, SOURCE_KEY_IDS, 2)],
      SOURCE_KEYS,
      500010,
    );
    expect(combined.ranges).toHaveLength(3);

    // Each interval record is a fixed-shape compact record: no frame lists,
    // no per-repetition entries, no raster/projection payloads.
    const expectedKeys = [
      'boundary',
      'cycleLength',
      'effectiveEnd',
      'loopId',
      'partialCycle',
      'phaseOrigin',
      'placementStart',
      'repeat',
      'requestedEnd',
      'sourceCycleId',
      'sourceFrameCount',
      'sourceKeyIds',
      'sourceOffsets',
      'truncated',
      'unresolved',
    ];
    for (const range of combined.ranges) {
      expect(Object.keys(range).sort()).toEqual(expectedKeys);
    }

    // A distant frame deep inside the huge repeat resolves correctly without
    // materializing intermediate frames.
    const distant = resolvePhysicPaintRotoLoopFrame(hugeFinite, 499995);
    expect(distant).toEqual({
      kind: 'linked',
      loopId: 'LH',
      appFrame: 499995,
      sourceKeyId: 'A',
      sourceIndex: 0,
      cycleOffset: 0,
      repeatInstance: 99997,
    });
  });

  it('resolving the same document twice yields identical interval records and per-frame results (D-30)', () => {
    const clips = [loop('L1', 10, SOURCE_KEY_IDS, 5)];
    const first = deriveBaseline(clips);
    const second = deriveBaseline(clips);
    expect(second.ranges).toEqual(first.ranges);

    expect(resolvePhysicPaintRotoLoopFrame(second, 18)).toEqual(resolvePhysicPaintRotoLoopFrame(first, 18));
  });
});

describe('resolvePhysicPaintRotoLoopFrame — lazy per-frame typed contract (D-26, audit finding 3)', () => {
  it('maps frames 10..34 of a 5-frame cycle repeated 5 times by modulo, with real keys winning the first cycle', () => {
    const context = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 5)]);

    // First cycle coincides with the source keys: real keys always win (D-26).
    for (let frame = 10; frame <= 14; frame += 1) {
      expect(resolvePhysicPaintRotoLoopFrame(context, frame)).toEqual({
        kind: 'real',
        keyId: SOURCE_KEY_IDS[frame - 10],
        appFrame: frame,
      });
    }

    // Linked repetition region: sourceIndex = (frame - placementStart) % 5,
    // repeatInstance = floor((frame - placementStart) / 5).
    expect(resolvePhysicPaintRotoLoopFrame(context, 15)).toEqual({
      kind: 'linked',
      loopId: 'L1',
      appFrame: 15,
      sourceKeyId: 'A',
      sourceIndex: 0,
      cycleOffset: 0,
      repeatInstance: 1,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 34)).toEqual({
      kind: 'linked',
      loopId: 'L1',
      appFrame: 34,
      sourceKeyId: 'E',
      sourceIndex: 4,
      cycleOffset: 4,
      repeatInstance: 4,
    });

    // Half-open [start, end): the requested end frame itself is outside.
    expect(resolvePhysicPaintRotoLoopFrame(context, 35)).toEqual({ kind: 'empty' });
    expect(resolvePhysicPaintRotoLoopFrame(context, 9)).toEqual({ kind: 'empty' });
  });

  it('binary-searches physical source offsets across repeats and distinguishes generated from disabled gaps', () => {
    const spaced = ids([
      ['A', 0],
      ['B', 3],
      ['C', 6],
    ]);
    const generated = deriveBaseline([loop('LG', 10, ['A', 'B', 'C'], 2)], spaced, 100, true);

    expect(resolvePhysicPaintRotoLoopFrame(generated, 13)).toEqual({
      kind: 'linked',
      loopId: 'LG',
      appFrame: 13,
      sourceKeyId: 'B',
      sourceIndex: 1,
      cycleOffset: 3,
      repeatInstance: 0,
    });
    expect(resolvePhysicPaintRotoLoopFrame(generated, 18)).toEqual({
      kind: 'linked-generated',
      loopId: 'LG',
      appFrame: 18,
      leftSourceKeyId: 'A',
      rightSourceKeyId: 'B',
      leftSourceIndex: 0,
      rightSourceIndex: 1,
      progress: 1 / 3,
      sourceCycleId: getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C']),
      cycleOffset: 1,
      repeatInstance: 1,
    });

    const gaps = deriveBaseline([loop('LP', 10, ['A', 'B', 'C'], 2)], spaced, 100, false);
    expect(resolvePhysicPaintRotoLoopFrame(gaps, 18)).toEqual({
      kind: 'linked-gap',
      loopId: 'LP',
      appFrame: 18,
      leftSourceKeyId: 'A',
      rightSourceKeyId: 'B',
      leftSourceIndex: 0,
      rightSourceIndex: 1,
      cycleOffset: 1,
      repeatInstance: 1,
    });
  });

  it('resolves a duplicated loop from its own placementStart while the source location stays key-derived', () => {
    const context = deriveBaseline([
      loop('L1', 10, SOURCE_KEY_IDS, 5),
      loop('L2', 40, SOURCE_KEY_IDS, 2),
    ]);

    // The duplicate presents the shared source cycle at frame 40 even though
    // the real source keys live at 10..14 (placement/source correction).
    expect(resolvePhysicPaintRotoLoopFrame(context, 40)).toEqual({
      kind: 'linked',
      loopId: 'L2',
      appFrame: 40,
      sourceKeyId: 'A',
      sourceIndex: 0,
      cycleOffset: 0,
      repeatInstance: 0,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 49)).toEqual({
      kind: 'linked',
      loopId: 'L2',
      appFrame: 49,
      sourceKeyId: 'E',
      sourceIndex: 4,
      cycleOffset: 4,
      repeatInstance: 1,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 50)).toEqual({ kind: 'empty' });

    // The original loop is unaffected: its requested end (35) precedes the
    // duplicate's placement start (40), so nothing truncates it.
    const original = context.ranges.find((range) => range.loopId === 'L1');
    expect(original).toMatchObject({ effectiveEnd: 35, truncated: false });
  });

  it('resolves a single-frame cycle (cycleLength 1, repeat 1) over exactly one frame', () => {
    const context = deriveBaseline([loop('L1', 30, ['S'], 1)], ids([['S', 5]]));

    expect(context.ranges[0]).toMatchObject({ requestedEnd: 31, effectiveEnd: 31, cycleLength: 1 });
    expect(resolvePhysicPaintRotoLoopFrame(context, 30)).toEqual({
      kind: 'linked',
      loopId: 'L1',
      appFrame: 30,
      sourceKeyId: 'S',
      sourceIndex: 0,
      cycleOffset: 0,
      repeatInstance: 0,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 31)).toEqual({ kind: 'empty' });
  });

  it('repeat 1 equals one bare cycle with no repetition region', () => {
    const context = deriveBaseline([loop('L1', 40, SOURCE_KEY_IDS, 1)]);

    expect(context.ranges[0]).toMatchObject({ requestedEnd: 45, effectiveEnd: 45, truncated: false });
    for (let frame = 40; frame <= 44; frame += 1) {
      const resolution = resolvePhysicPaintRotoLoopFrame(context, frame);
      expect(resolution).toEqual({
        kind: 'linked',
        loopId: 'L1',
        appFrame: frame,
        sourceKeyId: SOURCE_KEY_IDS[frame - 40],
        sourceIndex: frame - 40,
        cycleOffset: frame - 40,
        repeatInstance: 0,
      });
    }
    expect(resolvePhysicPaintRotoLoopFrame(context, 45)).toEqual({ kind: 'empty' });
  });
});

describe('derivePhysicPaintRotoLoopRanges — D-24 boundary algebra', () => {
  it('a non-owned real key inside the requested range truncates the effective end; removing it re-expands', () => {
    const blocking = [...SOURCE_KEYS, { keyId: 'X', appFrame: 22 }];
    const truncated = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 5)], blocking);

    expect(truncated.ranges[0]).toMatchObject({
      effectiveEnd: 22,
      truncated: true,
      partialCycle: true, // (22 - 10) % 5 !== 0 — mid-cycle truncation (D-21)
      boundary: { kind: 'real-key', frame: 22 },
    });

    // The blocking frame itself resolves real (real always wins); frames past
    // the new effective end are empty even though they are inside Requested.
    expect(resolvePhysicPaintRotoLoopFrame(truncated, 21)).toMatchObject({ kind: 'linked', sourceKeyId: 'B' });
    expect(resolvePhysicPaintRotoLoopFrame(truncated, 22)).toEqual({ kind: 'real', keyId: 'X', appFrame: 22 });
    expect(resolvePhysicPaintRotoLoopFrame(truncated, 23)).toEqual({ kind: 'empty' });

    // Re-expansion: removing the blocking key restores the full requested
    // range with no regeneration (D-08/D-14/D-25) — a pure re-derivation.
    const reExpanded = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 5)], SOURCE_KEYS);
    expect(reExpanded.ranges[0]).toMatchObject({ effectiveEnd: 35, truncated: false });
  });

  it('distinguishes a truncation landing exactly on a cycle boundary from a partial one (D-21)', () => {
    const blocking = [...SOURCE_KEYS, { keyId: 'X', appFrame: 25 }];
    const context = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 5)], blocking);

    expect(context.ranges[0]).toMatchObject({
      effectiveEnd: 25,
      truncated: true,
      partialCycle: false, // (25 - 10) % 5 === 0 — complete cycles
      boundary: { kind: 'real-key', frame: 25 },
    });
  });

  it('excludes the loop itself from its boundary candidates — own start, own occurrences, own source keys (D-24)', () => {
    // Without self-exclusion the loop's own first source key at frame 10 would
    // land exactly on placementStart and collapse the effective range to 0f.
    const context = deriveBaseline(
      [loop('L1', 10, SOURCE_KEY_IDS, 5)],
      [...SOURCE_KEYS, { keyId: 'X', appFrame: 50 }],
    );

    expect(context.ranges[0]).toMatchObject({
      effectiveEnd: 35,
      truncated: false,
      boundary: { kind: 'real-key', frame: 50 },
    });
  });

  it('a loop whose requested end is below every boundary is untruncated', () => {
    const context = deriveBaseline(
      [loop('L1', 10, SOURCE_KEY_IDS, 5)],
      [...SOURCE_KEYS, { keyId: 'X', appFrame: 100 }],
    );

    expect(context.ranges[0]).toMatchObject({
      effectiveEnd: 35,
      truncated: false,
      boundary: { kind: 'real-key', frame: 100 },
    });
  });

  it('a boundary landing exactly at placementStart yields Effective = 0f and the loop survives (D-08/D-22)', () => {
    // A non-owned real key cannot share a frame with the loop's own source
    // keys (one key per physical frame), so the realizable zero-effective
    // case is a duplicated placement identity: source keys live at 10..14,
    // this Loop Clip presents at 40, and a blocker sits exactly at 40.
    const duplicated = deriveBaseline(
      [loop('L2', 40, SOURCE_KEY_IDS, 5)],
      [...SOURCE_KEYS, { keyId: 'X', appFrame: 40 }],
    );
    expect(duplicated.ranges).toHaveLength(1);
    expect(duplicated.ranges[0]).toMatchObject({
      loopId: 'L2',
      placementStart: 40,
      effectiveEnd: 40,
      truncated: true,
      boundary: { kind: 'real-key', frame: 40 },
    });
    expect(resolvePhysicPaintRotoLoopFrame(duplicated, 40)).toEqual({ kind: 'real', keyId: 'X', appFrame: 40 });
  });
});

describe('derivePhysicPaintRotoLoopRanges — D-14 loop-loop priority', () => {
  it('loop B begins at its placementStart and is NOT pushed after loop A; A truncates at B start', () => {
    const laterKeys = ids([
      ['F', 20],
      ['G', 21],
      ['H', 22],
      ['I', 23],
      ['J', 24],
    ]);
    const context = deriveBaseline(
      [loop('LA', 10, SOURCE_KEY_IDS, 5), loop('LB', 20, ['F', 'G', 'H', 'I', 'J'], 2)],
      [...SOURCE_KEYS, ...laterKeys],
    );

    const a = context.ranges.find((range) => range.loopId === 'LA');
    const b = context.ranges.find((range) => range.loopId === 'LB');
    expect(a).toMatchObject({
      effectiveEnd: 20,
      truncated: true,
      partialCycle: false,
      boundary: { kind: 'loop-start', frame: 20 },
    });
    // B is anchored at its own placementStart, never pushed past A's end.
    expect(b).toMatchObject({
      placementStart: 20,
      requestedEnd: 30,
      effectiveEnd: 30,
      truncated: false,
    });

    // Frame 19 still resolves through A; frame 25 resolves through B from B's
    // own placement start.
    expect(resolvePhysicPaintRotoLoopFrame(context, 19)).toMatchObject({
      kind: 'linked',
      loopId: 'LA',
      sourceKeyId: 'E',
      repeatInstance: 1,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 25)).toEqual({
      kind: 'linked',
      loopId: 'LB',
      appFrame: 25,
      sourceKeyId: 'F',
      sourceIndex: 0,
      cycleOffset: 0,
      repeatInstance: 1,
    });
  });

  it('removing the later loop re-expands the earlier loop automatically (D-14)', () => {
    const clips = [loop('LA', 10, SOURCE_KEY_IDS, 5), loop('LB', 20, SOURCE_KEY_IDS, 2)];
    const withB = deriveBaseline(clips);
    expect(withB.ranges.find((range) => range.loopId === 'LA')).toMatchObject({ effectiveEnd: 20 });

    const withoutB = deriveBaseline([clips[0]]);
    expect(withoutB.ranges[0]).toMatchObject({ effectiveEnd: 35, truncated: false });
  });
});

describe('derivePhysicPaintRotoLoopRanges — Infinity loops (D-25, Q4)', () => {
  it('tracks parentEndExclusive dynamically and reports requestedEnd as infinity', () => {
    const clips = [loop('L1', 10, SOURCE_KEY_IDS, 'infinity')];

    const at300 = deriveBaseline(clips, SOURCE_KEYS, 300);
    expect(at300.ranges[0]).toMatchObject({
      requestedEnd: 'infinity',
      effectiveEnd: 300,
      truncated: false,
      boundary: { kind: 'parent-end', frame: 300 },
    });

    // Extending the parent grows the effective range; shrinking shortens it —
    // pure re-derivation, no regeneration (D-25).
    const at100 = deriveBaseline(clips, SOURCE_KEYS, 100);
    expect(at100.ranges[0]).toMatchObject({ effectiveEnd: 100 });
  });

  it('bounds the effective range at min(parent end, PHYSIC_PAINT_MAX_APPLY_FRAMES)', () => {
    const context = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 'infinity')], SOURCE_KEYS, 5000);

    expect(context.ranges[0]).toMatchObject({
      effectiveEnd: CAPACITY,
      boundary: { kind: 'parent-end', frame: CAPACITY },
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 599)).toMatchObject({
      kind: 'linked',
      sourceKeyId: 'E',
      sourceIndex: 4,
      cycleOffset: 4,
      repeatInstance: 117,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 600)).toEqual({ kind: 'empty' });
  });

  it('a later loop still truncates an infinity loop (D-14)', () => {
    const context = deriveBaseline(
      [loop('LA', 10, SOURCE_KEY_IDS, 'infinity'), loop('LB', 40, SOURCE_KEY_IDS, 2)],
      SOURCE_KEYS,
      300,
    );

    expect(context.ranges.find((range) => range.loopId === 'LA')).toMatchObject({
      effectiveEnd: 40,
      truncated: true,
      boundary: { kind: 'loop-start', frame: 40 },
    });
    expect(context.ranges.find((range) => range.loopId === 'LB')).toMatchObject({
      effectiveEnd: 50,
      truncated: false,
    });
  });
});

describe('resolvePhysicPaintRotoLoopFrame — typed unresolved contract (D-31, audit finding 3)', () => {
  it('keeps the interval record with the exact missing list when a strict subset of sources is missing', () => {
    const partialKeys = ids([
      ['A', 10],
      ['B', 11],
      ['C', 12],
    ]);
    const context = deriveBaseline([loop('L1', 10, SOURCE_KEY_IDS, 5)], partialKeys);

    expect(context.ranges).toHaveLength(1);
    expect(context.ranges[0]).toMatchObject({
      effectiveEnd: 35,
      unresolved: { missingSourceKeyIds: ['D', 'E'] },
    });
  });

  it('returns linked-unresolved per frame inside the unresolved range — never a throw, never a global failure', () => {
    const partialKeys = ids([
      ['A', 10],
      ['B', 11],
      ['C', 12],
      ['X', 50],
    ]);
    const context = deriveBaseline(
      [loop('L1', 10, SOURCE_KEY_IDS, 5), loop('L2', 60, ['A', 'B', 'C'], 1)],
      partialKeys,
    );

    // Unresolved loop: virtual frames report the typed per-frame contract.
    expect(resolvePhysicPaintRotoLoopFrame(context, 15)).toEqual({
      kind: 'linked-unresolved',
      loopId: 'L1',
      appFrame: 15,
      placementStart: 10,
      sourceKeyIds: [...SOURCE_KEY_IDS],
      missingSourceKeyIds: ['D', 'E'],
    });

    // Unrelated frames are unaffected: real keys still resolve real, far
    // frames still resolve empty, and a resolved sibling loop still links.
    expect(resolvePhysicPaintRotoLoopFrame(context, 50)).toEqual({ kind: 'real', keyId: 'X', appFrame: 50 });
    expect(resolvePhysicPaintRotoLoopFrame(context, 45)).toEqual({ kind: 'empty' });
    expect(resolvePhysicPaintRotoLoopFrame(context, 60)).toEqual({
      kind: 'linked',
      loopId: 'L2',
      appFrame: 60,
      sourceKeyId: 'A',
      sourceIndex: 0,
      cycleOffset: 0,
      repeatInstance: 0,
    });
  });

  it('fails closed when ordered source positions are not strictly increasing without poisoning sibling loops', () => {
    const spaced = ids([
      ['A', 0],
      ['B', 3],
      ['C', 6],
    ]);
    const context = deriveBaseline([
      loop('invalid-order', 10, ['A', 'C', 'B'], 2),
      loop('valid-sibling', 30, ['A', 'B', 'C'], 1),
    ], spaced, 100, true);

    expect(context.ranges.find((range) => range.loopId === 'invalid-order')).toMatchObject({
      sourceFrameCount: 3,
      sourceOffsets: [],
      cycleLength: 3,
      unresolved: { missingSourceKeyIds: [], invalidSourceTiming: true },
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 11)).toMatchObject({
      kind: 'linked-unresolved',
      loopId: 'invalid-order',
      missingSourceKeyIds: [],
      invalidSourceTiming: true,
    });
    expect(context.ranges.find((range) => range.loopId === 'valid-sibling')).toMatchObject({
      sourceOffsets: [0, 3, 6],
      cycleLength: 7,
      unresolved: null,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 31)).toMatchObject({ kind: 'linked-generated', progress: 1 / 3 });
  });

  it('preserves a fully unresolved loop verbatim — every source keyId missing', () => {
    const context = deriveBaseline([loop('L1', 40, ['M', 'N'], 3)], []);

    expect(context.ranges).toHaveLength(1);
    expect(context.ranges[0]).toMatchObject({
      loopId: 'L1',
      requestedEnd: 46,
      effectiveEnd: 46,
      unresolved: { missingSourceKeyIds: ['M', 'N'] },
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 42)).toEqual({
      kind: 'linked-unresolved',
      loopId: 'L1',
      appFrame: 42,
      placementStart: 40,
      sourceKeyIds: ['M', 'N'],
      missingSourceKeyIds: ['M', 'N'],
    });
  });
});
