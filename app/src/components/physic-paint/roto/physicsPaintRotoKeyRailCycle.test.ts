import { describe, expect, it } from 'vitest';
import {
  buildKeyRailStandardLoopClip,
  isStandardMergedLoopClip,
  type RunScriptStackLifecycle,
} from './physicsPaintRotoRunScriptStacking';
import {
  isPhysicPaintRotoLoopClip,
  parsePhysicPaintRotoLoopClips,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { derivePhysicPaintRotoLoopRanges } from './physicsPaintRotoPhysicalResolver';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import { classifyLoopClipRailKind } from '../view/physicsPaintWorkflowPresentation';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

/**
 * Phase 58-02 (RAIL-03/RAIL-07): the PURE spec for a Key Rail → Standard cycle
 * conversion.
 *
 * Pins the durable record shape (provenance-free, parser-legal, Standard-kind),
 * the SPAN-based cycle law (lastKeyFrame - firstKeyFrame + 1 — never the key
 * count), the single-key 1-frame rule (D-08), the lifecycle-less infinity
 * record, and the segment-disappearance consequence once the keys are loop
 * owned. No DOM, no controller, no store: the controller path is pinned by
 * physicsPaintRotoPlayScriptController.test.ts (58-02 Task 1).
 */

const CAPACITY = 600;

function record(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes(`rail-${keyId}`),
      width: 2,
      height: 2,
    },
  };
}

const GAPPED_IDS = ['A', 'C', 'F'] as const;
const GAPPED_FRAMES = [10, 12, 15] as const;
const GAPPED_RECORDS = (): PhysicPaintRotoRealKeyRecord[] =>
  GAPPED_IDS.map((keyId, index) => record(keyId, GAPPED_FRAMES[index]!));

/**
 * Mirrors the private buildNewLoopLifecycle formula (controller
 * :3895-3911): a finite repeat clamps the extent to the physical capacity;
 * infinity stays lifecycle-less. The production helper itself is pinned by
 * the controller spec's committed-extent assertions.
 */
function lifecycleFor(
  firstKeyFrame: number,
  cycleFrameCount: number,
  repeat: number | 'infinity',
  capacity = CAPACITY,
): RunScriptStackLifecycle | null {
  if (repeat === 'infinity') return null;
  const endExclusive = Math.min(firstKeyFrame + cycleFrameCount * repeat, capacity);
  return {
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: firstKeyFrame,
    originalEndExclusive: endExclusive,
    visibleRanges: Object.freeze([Object.freeze({ start: firstKeyFrame, endExclusive })]),
    frameOverrides: Object.freeze([]),
  };
}

function deriveCycleLength(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
): { readonly cycleLength: number; readonly effectiveEnd: number } {
  const ranges = derivePhysicPaintRotoLoopRanges({
    identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    loopClips,
    capacity: CAPACITY,
    interpolationEnabled: false,
  }).ranges;
  const range = ranges[0];
  if (!range) throw new Error('Expected one derived loop range.');
  return { cycleLength: range.cycleLength, effectiveEnd: range.effectiveEnd };
}

describe('Key Rail → Standard cycle record (58-02)', () => {
  it('builds a parser-legal Standard record classified as standard', () => {
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-gap',
      placementStart: 10,
      sourceKeyIds: [...GAPPED_IDS],
      repeat: 1,
      mode: 'progressive',
      lifecycle: lifecycleFor(10, 6, 1),
    });

    expect(isPhysicPaintRotoLoopClip(clip)).toBe(true);
    expect(isStandardMergedLoopClip(clip)).toBe(true);
    expect(classifyLoopClipRailKind(clip)).toBe('standard');
    expect(clip).toMatchObject({
      loopId: 'rail-gap',
      placementStart: 10,
      sourceKeyIds: ['A', 'C', 'F'],
      repeat: 1,
      mode: 'progressive',
    });
    expect(parsePhysicPaintRotoLoopClips([clip])[0]).toEqual(clip);
  });

  it('omits every provenance and Reveal identity member — absence, never undefined-valued', () => {
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-gap',
      placementStart: 10,
      sourceKeyIds: [...GAPPED_IDS],
      repeat: 1,
      mode: 'progressive',
      lifecycle: lifecycleFor(10, 6, 1),
    });

    expect('scriptId' in clip).toBe(false);
    expect('motion' in clip).toBe(false);
    expect('overrideColor' in clip).toBe(false);
    expect('railKind' in clip).toBe(false);
    expect('colorize' in clip).toBe(false);
    expect('colorizeMix' in clip).toBe(false);
    expect('photoWiggle' in clip).toBe(false);
  });

  it('freezes the source cycle in segment order so mutating the input cannot change the record', () => {
    const inputKeyIds = ['A', 'C', 'F'];
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-gap',
      placementStart: 10,
      sourceKeyIds: inputKeyIds,
      repeat: 2,
      mode: 'progressive',
      lifecycle: lifecycleFor(10, 6, 2),
    });

    expect(Object.isFrozen(clip.sourceKeyIds)).toBe(true);
    expect(clip.sourceKeyIds).toEqual(['A', 'C', 'F']);
    inputKeyIds.push('Z');
    inputKeyIds[0] = 'Z';
    expect(clip.sourceKeyIds).toEqual(['A', 'C', 'F']);
  });

  it('keeps the GAPPED span: keys at 10, 12, 15 derive a 6-frame cycle and a repeat-2 extent of 22', () => {
    const records = GAPPED_RECORDS();
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-gap',
      placementStart: 10,
      sourceKeyIds: [...GAPPED_IDS],
      repeat: 2,
      mode: 'progressive',
      lifecycle: lifecycleFor(10, 15 - 10 + 1, 2),
    });

    const derived = deriveCycleLength(records, [clip]);
    // The resolver's span law and the controller's lifecycle arithmetic agree:
    // 6 frames (never the 3-key count), so repeat 2 ends at 10 + 12 = 22.
    expect(derived.cycleLength).toBe(6);
    expect(derived.effectiveEnd).toBe(22);
    expect(clip.originalEndExclusive).toBe(22);
    expect(clip.visibleRanges).toEqual([{ start: 10, endExclusive: 22 }]);
    expect(clip.phaseOrigin).toBe(10);
  });

  it('keeps the repeat-1 GAPPED extent at 16', () => {
    const records = GAPPED_RECORDS();
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-gap',
      placementStart: 10,
      sourceKeyIds: [...GAPPED_IDS],
      repeat: 1,
      mode: 'progressive',
      lifecycle: lifecycleFor(10, 15 - 10 + 1, 1),
    });

    expect(deriveCycleLength(records, [clip]).cycleLength).toBe(6);
    expect(clip.originalEndExclusive).toBe(16);
    expect(clip.visibleRanges).toEqual([{ start: 10, endExclusive: 16 }]);
  });

  it('converts a SINGLE key into a 1-frame cycle (D-08)', () => {
    const records = [record('K', 10)];
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-single',
      placementStart: 10,
      sourceKeyIds: ['K'],
      repeat: 1,
      mode: 'progressive',
      lifecycle: lifecycleFor(10, 1, 1),
    });

    const derived = deriveCycleLength(records, [clip]);
    expect(derived.cycleLength).toBe(1);
    expect(derived.effectiveEnd).toBe(11);
    expect(clip.originalEndExclusive).toBe(11);
    expect(isStandardMergedLoopClip(clip)).toBe(true);
  });

  it('stamps NO lifecycle for infinity and still parses as a Standard record', () => {
    const clip = buildKeyRailStandardLoopClip({
      loopId: 'rail-infinity',
      placementStart: 10,
      sourceKeyIds: [...GAPPED_IDS],
      repeat: 'infinity',
      mode: 'progressive',
      lifecycle: null,
    });

    expect(isPhysicPaintRotoLoopClip(clip)).toBe(true);
    expect(isStandardMergedLoopClip(clip)).toBe(true);
    expect(parsePhysicPaintRotoLoopClips([clip])[0]).toEqual(clip);
    expect('syncState' in clip).toBe(false);
    expect('provenanceState' in clip).toBe(false);
    expect('phaseOrigin' in clip).toBe(false);
    expect('originalEndExclusive' in clip).toBe(false);
    expect('visibleRanges' in clip).toBe(false);
    expect('frameOverrides' in clip).toBe(false);
  });

  it('makes the converted segment disappear once its keys are loop owned', () => {
    const orderedRealKeys = GAPPED_RECORDS().map(({ keyId, appFrame }) => ({ keyId, appFrame }));

    const before = deriveKeyRailSegments({
      orderedRealKeys,
      incomingInterpolationBreakKeyIds: new Set(),
      groupOwnedKeyIds: new Set(),
    });
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({
      firstKeyId: 'A',
      keyIds: ['A', 'C', 'F'],
      firstKeyFrame: 10,
      lastKeyFrame: 15,
    });

    const after = deriveKeyRailSegments({
      orderedRealKeys,
      incomingInterpolationBreakKeyIds: new Set(),
      groupOwnedKeyIds: new Set([...GAPPED_IDS]),
    });
    expect(after).toEqual([]);
  });
});
