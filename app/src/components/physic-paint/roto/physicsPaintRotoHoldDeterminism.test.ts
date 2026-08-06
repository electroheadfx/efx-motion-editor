import { describe, expect, it } from 'vitest';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import {
  buildStaticStrokeSchedule,
  getStaticFrameStrokes,
  transformRecordedStrokeForHeldPose,
} from '@efxlab/efx-physic-paint/animation';

// 43-04 Task 1 (HOLD-02): byte-identical determinism proof for the shipped static/hold
// machinery. This spec exercises the REAL animation modules (no mocks): the hash-seeded
// held-pose transform is the ONLY variation source for hold frames, so identical
// script + destination + options must produce byte-identical output across
// regeneration, save/reopen (serialize/deserialize), and cache regeneration.
// Hardening spec against shipped machinery — expected to PASS on first run; a RED
// result is a genuine Phase 42 regression and routes through the bounded deviation
// protocol (never asserted away, never fixed under this test-only plan).

const point = (x: number, y: number) => ({ x, y, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 1 });

const stroke = (tool: 'paint' | 'erase', color: string | null, pointCount: number, timestamp: number): PaintStroke => ({
  tool,
  color,
  timestamp,
  points: Array.from({ length: pointCount }, (_, index) => point(index * 3 + 1, index * 5 + 2)),
  params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
});

function scriptStrokes(): PaintStroke[] {
  return [
    stroke('paint', '#123456', 4, 111),
    stroke('erase', null, 2, 222),
    stroke('paint', '#654321', 3, 333),
  ];
}

/** Byte-level fingerprint: the deterministic substrate every dataUrl encode consumes. */
function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

describe('buildStaticStrokeSchedule complete-stroke-set mapping (HOLD-01)', () => {
  it('maps every stroke to startFrame 0 and endFrame usableFrames - 1 with full pointsPerFrame', () => {
    const strokes = scriptStrokes();
    const schedule = buildStaticStrokeSchedule(strokes, 5);
    expect(schedule).toHaveLength(strokes.length);
    for (const [index, entry] of schedule.entries()) {
      expect(entry.stroke).toBe(strokes[index]);
      expect(entry.startFrame).toBe(0);
      expect(entry.endFrame).toBe(4);
      expect(entry.pointsPerFrame).toBe(strokes[index].points.length);
    }
  });

  it('truncates and floors the frame count into the usable-frames bound', () => {
    const [entry] = buildStaticStrokeSchedule(scriptStrokes(), 3.9);
    expect(entry.endFrame).toBe(2);
    const [clamped] = buildStaticStrokeSchedule(scriptStrokes(), 0);
    expect(clamped.endFrame).toBe(0); // Math.max(1, trunc(0)) → one usable frame
  });

  it('returns an empty schedule for an empty stroke list', () => {
    expect(buildStaticStrokeSchedule([], 7)).toEqual([]);
  });

  it('reveals the complete stroke set at full pointCount on every destination frame', () => {
    const strokes = scriptStrokes();
    const schedule = buildStaticStrokeSchedule(strokes, 4);
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      const revealed = getStaticFrameStrokes(schedule, frameIndex);
      expect(revealed).toHaveLength(strokes.length);
      for (const [strokeIndex, entry] of revealed.entries()) {
        expect(entry.stroke).toBe(strokes[strokeIndex]);
        expect(entry.pointCount).toBe(strokes[strokeIndex].points.length);
      }
    }
  });

  it('a single-stroke script held over 3 frames yields 3 frames each containing exactly that stroke', () => {
    const only = stroke('paint', '#abcdef', 5, 42);
    const schedule = buildStaticStrokeSchedule([only], 3);
    for (let frameIndex = 0; frameIndex < 3; frameIndex += 1) {
      const revealed = getStaticFrameStrokes(schedule, frameIndex);
      expect(revealed).toHaveLength(1);
      expect(revealed[0].stroke).toBe(only);
      expect(revealed[0].pointCount).toBe(5);
    }
  });
});

describe('transformRecordedStrokeForHeldPose determinism (HOLD-02)', () => {
  it('zero variation (deformation 0, position 0) returns the input stroke object unchanged', () => {
    const input = stroke('paint', '#123456', 4, 111);
    for (const destinationSourceFrame of [0, 1, 2, 17]) {
      const result = transformRecordedStrokeForHeldPose(input, {
        destinationSourceFrame,
        strokeIndex: 0,
        deformation: 0,
        position: 0,
      });
      expect(result).toBe(input); // identity — no copy, no jitter
    }
  });

  it('double application with identical inputs produces byte-identical output at nonzero position Motion', () => {
    const input = stroke('paint', '#123456', 4, 111);
    const pose = { destinationSourceFrame: 9, strokeIndex: 1, deformation: 0, position: 60 };
    const first = transformRecordedStrokeForHeldPose(input, pose);
    const second = transformRecordedStrokeForHeldPose(input, pose);
    expect(fingerprint(first)).toBe(fingerprint(second));
    expect(first).not.toBe(input);
    expect(first.points.some((candidate, index) => candidate.x !== input.points[index].x || candidate.y !== input.points[index].y)).toBe(true);
  });

  it('double application with identical inputs produces byte-identical output at nonzero deformation Motion', () => {
    const input = stroke('paint', '#123456', 4, 111);
    const pose = { destinationSourceFrame: 3, strokeIndex: 2, deformation: 75, position: 0 };
    const first = transformRecordedStrokeForHeldPose(input, pose);
    const second = transformRecordedStrokeForHeldPose(input, pose);
    expect(fingerprint(first)).toBe(fingerprint(second));
  });

  it('double application with identical inputs produces byte-identical output at combined position + deformation Motion', () => {
    const input = stroke('erase', null, 6, 222);
    const pose = { destinationSourceFrame: 12, strokeIndex: 0, deformation: 33, position: 88 };
    const first = transformRecordedStrokeForHeldPose(input, pose);
    const second = transformRecordedStrokeForHeldPose(input, pose);
    expect(fingerprint(first)).toBe(fingerprint(second));
  });

  it('never mutates the input stroke, its points, or its params', () => {
    const input = stroke('paint', '#123456', 4, 111);
    const snapshot = fingerprint(input);
    transformRecordedStrokeForHeldPose(input, { destinationSourceFrame: 5, strokeIndex: 0, deformation: 100, position: 100 });
    expect(fingerprint(input)).toBe(snapshot);
  });

  it('save/reopen round-trip: serialized schedule inputs re-render to byte-identical output', () => {
    const strokes = scriptStrokes();
    const pose = { destinationSourceFrame: 7, strokeIndex: 1, deformation: 40, position: 55 };
    const before = strokes.map((entry, strokeIndex) => transformRecordedStrokeForHeldPose(entry, { ...pose, strokeIndex }));

    // Simulate save/reopen: the persisted document crosses a JSON boundary.
    const reopened = JSON.parse(JSON.stringify(strokes)) as PaintStroke[];
    const reopenedPose = JSON.parse(JSON.stringify(pose)) as typeof pose;
    const after = reopened.map((entry, strokeIndex) => transformRecordedStrokeForHeldPose(entry, { ...reopenedPose, strokeIndex }));

    expect(fingerprint(after)).toBe(fingerprint(before));
  });

  it('cache regeneration: a freshly rebuilt schedule from deserialized strokes reveals byte-identical frames', () => {
    const strokes = scriptStrokes();
    const schedule = buildStaticStrokeSchedule(strokes, 3);
    const transform = (entry: PaintStroke, frameIndex: number, strokeIndex: number) =>
      transformRecordedStrokeForHeldPose(entry, { destinationSourceFrame: frameIndex, strokeIndex, deformation: 50, position: 25 });
    const firstPass = [0, 1, 2].map((frameIndex) => getStaticFrameStrokes(schedule, frameIndex, transform));

    // Cache-regeneration path: rebuild the schedule from a JSON round-trip and re-reveal.
    const rebuilt = buildStaticStrokeSchedule(JSON.parse(JSON.stringify(strokes)) as PaintStroke[], 3);
    const secondPass = [0, 1, 2].map((frameIndex) => getStaticFrameStrokes(rebuilt, frameIndex, transform));

    expect(fingerprint(secondPass)).toBe(fingerprint(firstPass));
  });

  it('stop-motion hold quantization: adjacent frames inside one hold step are byte-identical', () => {
    const input = stroke('paint', '#123456', 4, 111);
    const at = (destinationSourceFrame: number) => transformRecordedStrokeForHeldPose(input, {
      destinationSourceFrame,
      strokeIndex: 0,
      deformation: 60,
      position: 60,
    });
    // STOP_MOTION_HOLD_FRAMES = 2: frames 0/1 share pose frame 0, frames 2/3 share pose frame 1.
    expect(fingerprint(at(1))).toBe(fingerprint(at(0)));
    expect(fingerprint(at(3))).toBe(fingerprint(at(2)));
  });

  it.each([
    ['deformation above 100', { deformation: 1_000_000, position: 0 }],
    ['position below 0', { deformation: 0, position: -500 }],
    ['NaN deformation', { deformation: Number.NaN, position: 40 }],
    ['infinite position', { deformation: 30, position: Number.POSITIVE_INFINITY }],
    ['non-finite destination frame', { deformation: 30, position: 30 }],
  ])('clamps adversarial input — %s — without NaN output or identity drift (T-43-04-01)', (_name, motion) => {
    const input = stroke('paint', '#123456', 4, 111);
    const pose = {
      destinationSourceFrame: _name === 'non-finite destination frame' ? Number.NaN : 6,
      strokeIndex: 0,
      ...motion,
    };
    const result = transformRecordedStrokeForHeldPose(input, pose);
    const rerun = transformRecordedStrokeForHeldPose(input, pose);
    expect(fingerprint(result)).toBe(fingerprint(rerun));
    for (const candidate of result.points) {
      expect(Number.isFinite(candidate.x)).toBe(true);
      expect(Number.isFinite(candidate.y)).toBe(true);
    }
    // clampPercent semantics: non-finite → 0, finite → [0, 100]. The adversarial
    // input must produce byte-identical output to the explicitly clamped pose.
    const clamp = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0);
    const clamped = transformRecordedStrokeForHeldPose(input, {
      destinationSourceFrame: Number.isFinite(pose.destinationSourceFrame) ? pose.destinationSourceFrame : 0,
      strokeIndex: 0,
      deformation: clamp(motion.deformation),
      position: clamp(motion.position),
    });
    expect(fingerprint(result)).toBe(fingerprint(clamped));
    if (clamp(motion.deformation) === 0 && clamp(motion.position) === 0) {
      expect(result).toBe(input); // zero effective variation returns the input unchanged
    }
  });

  it('per-frame Motion is deterministic per destination: the same frame always re-renders identically', () => {
    const input = stroke('paint', '#123456', 4, 111);
    for (const destinationSourceFrame of [0, 2, 4, 6, 8]) {
      const first = transformRecordedStrokeForHeldPose(input, { destinationSourceFrame, strokeIndex: 0, deformation: 45, position: 70 });
      const second = transformRecordedStrokeForHeldPose(input, { destinationSourceFrame, strokeIndex: 0, deformation: 45, position: 70 });
      expect(fingerprint(first)).toBe(fingerprint(second));
    }
  });
});
