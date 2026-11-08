// ============================================================
//  quick 261108-kvw — the authored canvas route.
//
//  The overlay draws the AUTHORED Position route: every sample is the
//  59-05 evaluator's translateX/translateY taken through a wiggle-zeroed
//  probe, so the polyline is stable while the box shakes.
//
//  Laws pinned here:
//    linear keys 0 -> 100 over [0,10] sample frame 5 as 50 on x
//    key frames land exactly on their authored values
//    zeroRailMotionWiggle returns the record BY REFERENCE when it is
//      already wiggle-free, else a frozen all-zero probe
//    a span under two frames, an identity route or a missing Position
//      channel yields null
//    placeRailMotionPathPoint mirrors getRailMotionBounds(...).center
//    the one-entry cache returns the SAME frozen bundle on a hit and a
//      NEW one when only the pivot changes
//    stop motion repeats a pose between snaps and steps ONLY at a snap
//      frame; every snap in the span is in the sample-frame set
//    the 2000-sample cap holds for every input: a 5001-frame span keeps
//      frame 0 and the 5000 tail, and an over-cap authored set is
//      decimated to EXACTLY 2000 authored frames (never truncated)
//    a wiggle-bearing record samples exactly like its wiggle-free twin
//      while the raw evaluator differs at the same frames
// ============================================================

import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionEasing,
  PhysicPaintRotoRailMotionKey,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  RAIL_MOTION_PATH_DISTINCT_EPSILON,
  RAIL_MOTION_PATH_MAX_SAMPLES,
  buildRailMotionPathD,
  evaluateRailMotionPathCursor,
  placeRailMotionPathPoint,
  sampleRailMotionPath,
  sampleRailMotionPathCached,
  zeroRailMotionWiggle,
  type RailMotionPathSampleInput,
} from './railMotionPath';
import { evaluateRailMotion } from './railMotionEvaluator';
import { getRailMotionBounds } from '../view/PhysicsPaintReferenceTransform';

function key(
  frame: number,
  value: number,
  easing: PhysicPaintRotoRailMotionEasing = 'linear',
  wiggle = 0,
): PhysicPaintRotoRailMotionKey {
  return { frame, value, easing, wiggle };
}

function channel(
  id: PhysicPaintRotoRailMotionChannelId,
  keys: readonly PhysicPaintRotoRailMotionKey[],
  wiggle = 0,
  wiggleGlobal = true,
): PhysicPaintRotoRailMotionChannel {
  return { id, keys, wiggle, wiggleGlobal };
}

function record(
  railId: string,
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): PhysicPaintRotoRailMotionRecord {
  return { railId, anchorKeyId: `anchor-${railId}`, channels };
}

/** The canonical sample input: 11 frames from app frame 100, pivot centred. */
function sampleInput(overrides: Partial<RailMotionPathSampleInput> = {}): RailMotionPathSampleInput {
  return {
    railId: 'rail-kvw',
    startFrame: 100,
    frameCount: 11,
    snapFrames: [] as readonly number[],
    pivotX: 0.5,
    pivotY: 0.5,
    ...overrides,
  };
}

/** x: 0 -> 100 over [0,10]; y holds at 0. */
function linearPositionRecord(): PhysicPaintRotoRailMotionRecord {
  return record('rail-kvw', [
    channel('position-x', [key(0, 0), key(10, 100)]),
    channel('position-y', [key(0, 0), key(10, 0)]),
  ]);
}

function sampleAt(
  input: RailMotionPathSampleInput,
  frame: number,
): { readonly x: number; readonly y: number } | null {
  const bundle = sampleRailMotionPath(linearPositionRecord(), input);
  if (bundle === null) return null;
  const sample = bundle.path.samples.find((entry) => entry.frame === frame);
  return sample === undefined ? null : { x: sample.x, y: sample.y };
}

describe('261108-kvw authored rail-motion path sampling', () => {
  it('samples the linear route at the evaluator value and lands keys on their authored values', () => {
    const bundle = sampleRailMotionPath(linearPositionRecord(), sampleInput());
    expect(bundle).not.toBeNull();
    if (bundle === null) return;

    expect(sampleAt(sampleInput(), 5)).toEqual({ x: 50, y: 0 });
    expect(sampleAt(sampleInput(), 0)).toEqual({ x: 0, y: 0 });
    expect(sampleAt(sampleInput(), 10)).toEqual({ x: 100, y: 0 });
    // A raw linear ramp: frame 2 is 20, never the smoothstep's 10.4.
    expect(sampleAt(sampleInput(), 2)).toEqual({ x: 20, y: 0 });

    expect(bundle.path.keyFrames).toEqual([0, 10]);
    const byFrame = new Map(bundle.path.samples.map((sample) => [sample.frame, sample]));
    expect(byFrame.get(0)?.x).toBe(0);
    expect(byFrame.get(10)?.x).toBe(100);
  });

  it('returns the record by reference when wiggle-free and a frozen all-zero probe otherwise', () => {
    const clean = linearPositionRecord();
    expect(zeroRailMotionWiggle(clean)).toBe(clean);

    const wiggled = record('rail-kvw', [
      channel('position-x', [key(0, 0, 'linear', 3), key(10, 100, 'linear', 4)], 12, false),
      channel('position-y', [key(0, 0, 'linear', 5)], 0, true),
    ]);
    const probe = zeroRailMotionWiggle(wiggled);
    expect(probe).not.toBe(wiggled);
    expect(Object.isFrozen(probe)).toBe(true);
    for (const entry of probe.channels) {
      expect(entry.wiggle).toBe(0);
      for (const entryKey of entry.keys) expect(entryKey.wiggle).toBe(0);
    }
    // The global flag is stored, not rewritten: it is irrelevant at zero.
    expect(probe.channels[0]?.wiggleGlobal).toBe(false);
    expect(probe.channels[1]?.wiggleGlobal).toBe(true);
    // The source record is never mutated.
    expect(wiggled.channels[0]?.wiggle).toBe(12);
    expect(wiggled.channels[0]?.keys[0]?.wiggle).toBe(3);
  });

  it('returns null for a short span, an identity route or a missing Position channel', () => {
    const rec = linearPositionRecord();
    expect(sampleRailMotionPath(rec, { ...sampleInput(), frameCount: 1 })).toBeNull();
    expect(sampleRailMotionPath(rec, { ...sampleInput(), frameCount: Number.NaN })).toBeNull();
    expect(sampleRailMotionPath(null, sampleInput())).toBeNull();

    const identity = record('rail-kvw', [
      channel('position-x', [key(0, 7), key(10, 7)]),
      channel('position-y', [key(0, -3), key(10, -3)]),
    ]);
    expect(sampleRailMotionPath(identity, sampleInput())).toBeNull();

    const scaleOnly = record('rail-kvw', [
      channel('scale', [key(0, 1), key(10, 2)]),
    ]);
    expect(sampleRailMotionPath(scaleOnly, sampleInput())).toBeNull();

    const almostIdentity = record('rail-kvw', [
      channel('position-x', [key(0, 0), key(10, RAIL_MOTION_PATH_DISTINCT_EPSILON / 2)]),
    ]);
    expect(sampleRailMotionPath(almostIdentity, sampleInput())).toBeNull();
  });

  it('places points with the handles ONE convention (getRailMotionBounds center)', () => {
    const transform = { x: 12, y: -7, scaleX: 1, scaleY: 1, rotation: 0 };
    const bounds = getRailMotionBounds(
      transform,
      { x: 0, y: 0, width: 1, height: 1 },
      0.3,
      0.7,
      1920,
      1080,
      0.5,
    );
    const placed = placeRailMotionPathPoint(12, -7, 0.3, 0.7, 1920, 1080, 0.5);
    expect(placed.x).toBe(bounds.center.x);
    expect(placed.y).toBe(bounds.center.y);
    expect(placed.x).toBe(0.5 * (0.3 * 1920 + 12));
    expect(placed.y).toBe(0.5 * (0.7 * 1080 - 7));
  });

  it('builds the polyline in project-to-working space with the lane formatter', () => {
    const bundle = sampleRailMotionPath(linearPositionRecord(), sampleInput({
      pivotX: 0.5,
      pivotY: 0.5,
    }));
    if (bundle === null) throw new Error('expected a sampled bundle');
    const d = buildRailMotionPathD(bundle.path, 1000, 800, 1);
    // M at frame 0 (pivot only), L at the tail: 0.5 * 1000 + 100 = 600.
    expect(d.startsWith('M500,400 L')).toBe(true);
    expect(d.endsWith('600,400')).toBe(true);
    expect(d.split(' L').length - 1).toBe(bundle.path.samples.length - 1);
    // The 1-decimal formatter drops a trailing .0.
    expect(d).not.toContain('.0');
  });

  it('carries the caller pivot verbatim and re-bundles when only the pivot changes', () => {
    const input = sampleInput({ pivotX: 0.25, pivotY: 0.75 });
    const sourceRecord = linearPositionRecord();
    const first = sampleRailMotionPathCached({ ...input, record: sourceRecord });
    expect(first).not.toBeNull();
    if (first === null) return;
    expect(first.path.pivotX).toBe(0.25);
    expect(first.path.pivotY).toBe(0.75);
    // A wiggle-free record passes through by reference (zeroRailMotionWiggle).
    expect(first.authoredRecord).toBe(sourceRecord);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.path)).toBe(true);
    expect(Object.isFrozen(first.path.samples)).toBe(true);
    expect(Object.isFrozen(first.path.keyFrames)).toBe(true);

    // The same record reference is a cache hit.
    expect(sampleRailMotionPathCached({ ...input, record: sourceRecord })).toBe(first);

    const repivoted = sampleRailMotionPathCached({
      ...input,
      record: sourceRecord,
      pivotX: 0.4,
    });
    expect(repivoted).not.toBe(first);
    expect(repivoted?.path.pivotX).toBe(0.4);
    expect(repivoted?.path.signature).not.toBe(first.path.signature);

    // A different record object with identical content is a cache miss.
    expect(
      sampleRailMotionPathCached({ ...input, record: linearPositionRecord() }),
      'a different record object is a cache miss',
    ).not.toBe(first);
  });

  it('places the cursor marker from the same probe and refuses frames outside the span', () => {
    const bundle = sampleRailMotionPath(linearPositionRecord(), sampleInput());
    if (bundle === null) throw new Error('expected a sampled bundle');
    expect(evaluateRailMotionPathCursor(bundle, 5)).toEqual({ frame: 5, x: 50, y: 0 });
    expect(evaluateRailMotionPathCursor(bundle, 11)).toBeNull();
    expect(evaluateRailMotionPathCursor(bundle, -1)).toBeNull();
    expect(evaluateRailMotionPathCursor(bundle, Number.NaN)).toBeNull();
  });

  it('exposes a hard sample cap constant', () => {
    expect(RAIL_MOTION_PATH_MAX_SAMPLES).toBe(2000);
  });
});

// railMotionModel keeps this cap module-private; the over-cap row below only
// needs the number to build a legal authored channel.
const RAIL_MOTION_MAX_KEYS_PER_CHANNEL = 4096;

function sampleMap(
  input: RailMotionPathSampleInput,
  rec: PhysicPaintRotoRailMotionRecord,
): Map<number, { readonly x: number; readonly y: number }> {
  const bundle = sampleRailMotionPath(rec, input);
  if (bundle === null) throw new Error('expected a sampled bundle');
  return new Map(bundle.path.samples.map((sample) => [
    sample.frame,
    { x: sample.x, y: sample.y },
  ]));
}

describe('261108-kvw authored sampling law: key frames, snaps and the hard cap', () => {
  it('keeps every position key frame and lands each channel on its authored value', () => {
    // x keys 0 -> 0 and 10 -> 100; y adds a key at frame 7 -> 30 that is NOT
    // mirrored by an x key, so the union key set is [0, 7, 10].
    const rec = record('rail-kvw-keys', [
      channel('position-x', [key(0, 0), key(10, 100)]),
      channel('position-y', [key(0, 0), key(7, 30), key(10, 0)]),
    ]);
    const input = sampleInput();
    const bundle = sampleRailMotionPath(rec, input);
    if (bundle === null) throw new Error('expected a sampled bundle');

    expect(bundle.path.keyFrames).toEqual([0, 7, 10]);
    expect([...sampleMap(input, rec).keys()]).toEqual(
      Array.from({ length: 11 }, (_, frame) => frame),
    );
    const byFrame = sampleMap(input, rec);
    expect(byFrame.get(0)).toEqual({ x: 0, y: 0 });
    expect(byFrame.get(7)).toEqual({ x: 70, y: 30 });
    expect(byFrame.get(10)).toEqual({ x: 100, y: 0 });
  });

  it('represents stop motion as repeated poses that step ONLY at a snap frame', () => {
    // Proven d5o fixture: keys 0 -> 0 and 6 -> 6, both stop-motion, snaps
    // [0,2,4,6]; the sampled channel reads 0,0,2,2,4,4,6.
    const rec = record('rail-kvw-stop', [
      channel('position-x', [key(0, 0, 'stop-motion'), key(6, 6, 'stop-motion')]),
      channel('position-y', [key(0, 0), key(6, 0)]),
    ]);
    const snaps = Object.freeze([0, 2, 4, 6]) as readonly number[];
    const input = sampleInput({ frameCount: 7, snapFrames: snaps });
    const byFrame = sampleMap(input, rec);

    const frames = [...byFrame.keys()].sort((left, right) => left - right);
    expect(frames).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(frames.map((frame) => byFrame.get(frame)?.x)).toEqual([0, 0, 2, 2, 4, 4, 6]);
    for (const snap of snaps) expect(byFrame.has(snap)).toBe(true);

    // A step exists exactly where a snap lands, never between snaps.
    for (let frame = 1; frame <= 6; frame += 1) {
      const stepped = byFrame.get(frame)?.x !== byFrame.get(frame - 1)?.x;
      expect(stepped, `frame ${frame} step`).toBe(snaps.includes(frame));
    }
  });

  it('caps a 5001-frame span at 2000 samples and never truncates the tail', () => {
    const rec = record('rail-kvw-long', [
      channel('position-x', [key(0, 0), key(5000, 5000)]),
      channel('position-y', [key(0, 0)]),
    ]);
    const input = sampleInput({ frameCount: 5001 });
    const bundle = sampleRailMotionPath(rec, input);
    if (bundle === null) throw new Error('expected a sampled bundle');

    const frames = bundle.path.samples.map((sample) => sample.frame);
    expect(frames.length).toBeLessThanOrEqual(RAIL_MOTION_PATH_MAX_SAMPLES);
    expect(frames[0]).toBe(0);
    expect(frames[frames.length - 1]).toBe(5000);
    expect(frames).toContain(0);
    expect(frames).toContain(5000);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index]).toBeGreaterThan(frames[index - 1]);
    }
  });

  it('samples a wiggle-bearing record exactly like its wiggle-free twin', () => {
    const clean = linearPositionRecord();
    const wiggled = record('rail-kvw', [
      channel('position-x', [key(0, 0, 'linear', 3), key(10, 100, 'linear', 4)], 12, false),
      channel('position-y', [key(0, 0, 'linear', 5)], 0, true),
    ]);
    const input = sampleInput();

    const cleanBundle = sampleRailMotionPath(clean, input);
    const wiggledBundle = sampleRailMotionPath(wiggled, input);
    if (cleanBundle === null || wiggledBundle === null) {
      throw new Error('expected sampled bundles');
    }
    expect(JSON.stringify(wiggledBundle.path.samples))
      .toBe(JSON.stringify(cleanBundle.path.samples));

    const rawX = cleanBundle.path.samples.map((sample) => (
      evaluateRailMotion(wiggled, sample.frame, input.snapFrames).translateX
    ));
    const cleanX = cleanBundle.path.samples.map((sample) => sample.x);
    expect(rawX).not.toEqual(cleanX);
  });

  it('reuses the cached bundle by input identity and rebuilds on any change', () => {
    const snaps = Object.freeze([]) as readonly number[];
    const base = { ...sampleInput(), snapFrames: snaps };
    const recA = linearPositionRecord();
    const first = sampleRailMotionPathCached({ ...base, record: recA });
    if (first === null) throw new Error('expected a sampled bundle');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.path.samples)).toBe(true);
    expect(sampleRailMotionPathCached({ ...base, record: recA })).toBe(first);

    const recB = linearPositionRecord();
    const otherRecord = sampleRailMotionPathCached({ ...base, record: recB });
    expect(otherRecord).not.toBe(first);

    const longerSpan = sampleRailMotionPathCached({
      ...base,
      record: recB,
      startFrame: 200,
      frameCount: 21,
    });
    expect(longerSpan).not.toBe(otherRecord);
    expect(longerSpan?.path.startFrame).toBe(200);
    expect(longerSpan?.path.frameCount).toBe(21);

    const snapB = Object.freeze([5]) as readonly number[];
    const resnapped = sampleRailMotionPathCached({
      ...base,
      record: recB,
      startFrame: 200,
      frameCount: 21,
      snapFrames: snapB,
    });
    expect(resnapped).not.toBe(longerSpan);
    expect(sampleRailMotionPathCached({
      ...base,
      record: recB,
      startFrame: 200,
      frameCount: 21,
      snapFrames: snapB,
    })).toBe(resnapped);
  });

  it('decimates an over-cap authored set to exactly 2000 authored frames', () => {
    // 4096 consecutive linear keys plus the span tail 4999 = 4097 required
    // frames, one more than the budget. The route moves 0 -> 4095 over the
    // keyed head so the distinct-point gate passes.
    const keys = Array.from(
      { length: RAIL_MOTION_MAX_KEYS_PER_CHANNEL },
      (_, frame) => key(frame, frame),
    );
    const rec = record('rail-kvw-cap', [
      channel('position-x', keys),
      channel('position-y', [key(0, 0)]),
    ]);
    const input = sampleInput({ frameCount: 5000 });
    const bundle = sampleRailMotionPath(rec, input);
    if (bundle === null) throw new Error('expected a sampled bundle');

    const frames = bundle.path.samples.map((sample) => sample.frame);
    expect(frames.length).toBe(RAIL_MOTION_PATH_MAX_SAMPLES);
    expect(frames[0]).toBe(0);
    expect(frames[frames.length - 1]).toBe(4999);
    for (const frame of frames) {
      // Authored frames only: either a key frame or the span tail.
      expect(frame === 4999 || (frame >= 0 && frame <= RAIL_MOTION_MAX_KEYS_PER_CHANNEL - 1))
        .toBe(true);
    }
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index]).toBeGreaterThan(frames[index - 1]);
    }

    const again = sampleRailMotionPath(rec, input);
    expect(again?.path.samples.map((sample) => sample.frame)).toEqual(frames);
  });
});
