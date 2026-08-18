import { describe, expect, it } from 'vitest';
import {
  deriveSoloPlaybackWindow,
  type DeriveSoloPlaybackWindowInput,
} from './physicsPaintRotoSoloWindow';
import type { KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoLoopRange } from './physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoPhysicalCell } from './physicsPaintRotoPhysicalResolver';
import type { RailSetIdentity } from './physicsPaintRotoRailSetSelection';

/**
 * Solo playback window derivation (D-19, A3, Open Question 4). The derivation
 * consumes ONLY the accepted physical cells + loopResolutionContext.ranges +
 * deriveKeyRailSegments — the same authorities the timeline paint uses — and
 * fails closed to null on empty/unknown member sets and malformed inputs.
 */

function segment(
  firstKeyId: string,
  keyIds: string[],
  firstKeyFrame: number,
  lastKeyFrame: number,
): KeyRailSegment {
  return { firstKeyId, keyIds, firstKeyFrame, lastKeyFrame };
}

function loopRange(
  loopId: string,
  placementStart: number,
  effectiveEnd: number,
  sourceKeyIds: string[],
): PhysicPaintRotoLoopRange {
  return {
    loopId,
    placementStart,
    phaseOrigin: placementStart,
    cycleLength: 1,
    sourceFrameCount: sourceKeyIds.length,
    sourceKeyIds,
    sourceCycleId: `cycle-${loopId}`,
    sourceOffsets: sourceKeyIds.map((_, index) => index),
    strictInteriorPolicy: 'generate',
    repeat: 1,
    requestedEnd: effectiveEnd,
    effectiveEnd,
    boundary: { kind: 'parent-end', frame: effectiveEnd },
    truncated: false,
    partialCycle: false,
    unresolved: null,
  };
}

function realCell(appFrame: number, keyId: string): PhysicPaintRotoPhysicalCell {
  return { kind: 'real', appFrame, keyId };
}

function generatedCell(
  appFrame: number,
  leftKeyId: string,
  rightKeyId: string,
): PhysicPaintRotoPhysicalCell {
  return { kind: 'generated', appFrame, leftKeyId, rightKeyId };
}

function emptyCell(appFrame: number): PhysicPaintRotoPhysicalCell {
  return { kind: 'empty', appFrame };
}

/** Dense physical cell array (one cell per frame 0..capacity-1, resolver L3471-3487). */
function denseCells(capacity: number, cells: PhysicPaintRotoPhysicalCell[]): PhysicPaintRotoPhysicalCell[] {
  const byFrame = new Map(cells.map((cell) => [cell.appFrame, cell]));
  return Array.from({ length: capacity }, (_, frame) => byFrame.get(frame) ?? emptyCell(frame));
}

function keyRail(firstKeyId: string): RailSetIdentity {
  return { kind: 'key-rail', firstKeyId };
}

function loop(loopId: string): RailSetIdentity {
  return { kind: 'loop', loopId };
}

function derive(
  input: Partial<DeriveSoloPlaybackWindowInput> & Pick<DeriveSoloPlaybackWindowInput, 'members'>,
) {
  return deriveSoloPlaybackWindow({
    keyRailSegments: [],
    loopRanges: [],
    cells: [],
    capacity: 24,
    ...input,
  });
}

describe('deriveSoloPlaybackWindow — fail-closed nulls', () => {
  it('returns null for an empty member set', () => {
    expect(derive({ members: [] })).toBeNull();
  });

  it('returns null when a key-rail member is unknown (stale identity, T-43.6-02)', () => {
    const segments = [segment('k1', ['k1', 'k2'], 0, 4)];
    expect(derive({ members: [keyRail('ghost')], keyRailSegments: segments })).toBeNull();
  });

  it('returns null when a loop member is unknown (stale identity, T-43.6-02)', () => {
    const ranges = [loopRange('g1', 5, 20, ['s1'])];
    expect(derive({ members: [loop('ghost')], loopRanges: ranges })).toBeNull();
  });

  it('returns null for malformed capacity', () => {
    const segments = [segment('k1', ['k1'], 0, 0)];
    expect(derive({ members: [keyRail('k1')], keyRailSegments: segments, capacity: 0 })).toBeNull();
  });

  it('returns null for malformed cells', () => {
    const segments = [segment('k1', ['k1'], 0, 0)];
    expect(
      derive({ members: [keyRail('k1')], keyRailSegments: segments, cells: 'nope' as never }),
    ).toBeNull();
  });

  it('returns null for malformed keyRailSegments', () => {
    expect(derive({ members: [keyRail('k1')], keyRailSegments: 'nope' as never })).toBeNull();
  });

  it('returns null for malformed loopRanges', () => {
    expect(derive({ members: [loop('g1')], loopRanges: 'nope' as never })).toBeNull();
  });

  it('returns null when the clamped window is degenerate (start >= endExclusive)', () => {
    // Single key at frame 5 with capacity 5: endExclusive clamps to 5 == start.
    const segments = [segment('k1', ['k1'], 5, 5)];
    expect(derive({ members: [keyRail('k1')], keyRailSegments: segments, capacity: 5 })).toBeNull();
  });
});

describe('deriveSoloPlaybackWindow — window range from effective boundaries (D-19)', () => {
  it('derives a single Key Rail window as [firstKeyFrame, lastKeyFrame + 1)', () => {
    const segments = [segment('k1', ['k1', 'k2', 'k3'], 3, 10)];
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments });
    expect(window).not.toBeNull();
    expect(window!.start).toBe(3);
    expect(window!.endExclusive).toBe(11);
  });

  it('derives a single loop window as [placementStart, effectiveEnd)', () => {
    const ranges = [loopRange('g1', 5, 20, ['s1', 's2'])];
    const window = derive({ members: [loop('g1')], loopRanges: ranges });
    expect(window).not.toBeNull();
    expect(window!.start).toBe(5);
    expect(window!.endExclusive).toBe(20);
  });

  it('derives a mixed set window from the first placement start to the last effective end', () => {
    const segments = [segment('k1', ['k1', 'k2'], 0, 3)];
    const ranges = [loopRange('g1', 5, 20, ['s1'])];
    const window = derive({
      members: [loop('g1'), keyRail('k1')],
      keyRailSegments: segments,
      loopRanges: ranges,
    });
    expect(window).not.toBeNull();
    expect(window!.start).toBe(0);
    expect(window!.endExclusive).toBe(20);
  });

  it('clamps endExclusive to capacity', () => {
    const ranges = [loopRange('g1', 5, 30, ['s1'])];
    const window = derive({ members: [loop('g1')], loopRanges: ranges, capacity: 24 });
    expect(window).not.toBeNull();
    expect(window!.start).toBe(5);
    expect(window!.endExclusive).toBe(24);
  });

  it('includes generated/linked occurrences: multiple fragments of one loop extend the end', () => {
    const ranges = [
      loopRange('g1', 5, 10, ['s1', 's2']),
      loopRange('g1', 12, 18, ['s1', 's2']),
    ];
    const window = derive({ members: [loop('g1')], loopRanges: ranges });
    expect(window).not.toBeNull();
    expect(window!.start).toBe(5);
    expect(window!.endExclusive).toBe(18);
  });
});

describe('deriveSoloPlaybackWindow — frame attribution', () => {
  const segments = [segment('k1', ['k1', 'k2'], 3, 10)];
  const ranges = [loopRange('g1', 5, 20, ['s1', 's2'])];
  const cells = denseCells(24, [
    realCell(3, 'k1'),
    realCell(7, 's1'),
    realCell(8, 'k2'),
    realCell(9, 'other'), // real key of an unselected rail inside the window
    generatedCell(4, 'k1', 'k2'),
    generatedCell(6, 's1', 's2'),
    generatedCell(12, 's1', 's2'),
    emptyCell(5),
    emptyCell(13),
    emptyCell(21),
  ]);

  it('includes a real cell whose keyId belongs to a selected Key Rail', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(3)).toBe(true);
    expect(window!.includesFrame(8)).toBe(true);
  });

  it('includes a real cell whose keyId is a selected Group source key', () => {
    const window = derive({ members: [loop('g1')], loopRanges: ranges, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(7)).toBe(true);
  });

  it('excludes a real cell of an unselected rail even inside the window (A3 single-owner)', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(9)).toBe(false);
  });

  it('excludes a selected Group source key when the Group is not selected', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(7)).toBe(false);
  });

  it('includes a generated cell between selected Key Rail keys', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(4)).toBe(true);
  });

  it('excludes a generated cell of an unselected segment', () => {
    const otherSegments = [segment('k9', ['k9', 'k10'], 0, 2)];
    const otherCells = denseCells(24, [generatedCell(1, 'k9', 'k10')]);
    const window = derive({
      members: [keyRail('k1')],
      keyRailSegments: [...otherSegments, ...segments],
      cells: otherCells,
    });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(1)).toBe(false);
  });

  it('includes a generated cell projected from a selected loop source cycle', () => {
    const window = derive({ members: [loop('g1')], loopRanges: ranges, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(6)).toBe(true);
    expect(window!.includesFrame(12)).toBe(true);
  });

  it('includes an empty cell inside a selected rail span (gap transparency, Open Question 4)', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(5)).toBe(true);
  });

  it('excludes an empty cell outside every selected rail span', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(21)).toBe(false);
  });

  it('includes a real override key (group-owned, not in segments, not a source key) inside a selected loop span', () => {
    const overrideCells = denseCells(24, [realCell(9, 'ov1')]);
    const window = derive({ members: [loop('g1')], loopRanges: ranges, cells: overrideCells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(9)).toBe(true);
  });

  it('excludes a real override key when its owning loop is not selected', () => {
    const overrideCells = denseCells(24, [realCell(9, 'ov1')]);
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells: overrideCells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(9)).toBe(false);
  });

  it('returns false outside the window bounds', () => {
    const window = derive({ members: [keyRail('k1')], keyRailSegments: segments, cells });
    expect(window).not.toBeNull();
    expect(window!.includesFrame(2)).toBe(false);
    expect(window!.includesFrame(11)).toBe(false);
  });
});

describe('deriveSoloPlaybackWindow — A3 single-attribution fixtures', () => {
  it('mixed timeline: adjacent Groups with a Key Rail between them, all selected', () => {
    const capacity = 24;
    const segments = [
      segment('k1', ['k1', 'k2', 'k3'], 0, 4),
      segment('k4', ['k4', 'k5'], 15, 17),
    ];
    const ranges = [
      loopRange('g1', 6, 15, ['s1', 's2']),
      loopRange('g2', 18, 24, ['t1', 't2']),
    ];
    const cells = denseCells(capacity, [
      realCell(0, 'k1'),
      realCell(2, 'k2'),
      realCell(4, 'k3'),
      realCell(6, 's1'),
      generatedCell(7, 's1', 's2'),
      realCell(8, 's2'),
      generatedCell(9, 's1', 's2'),
      generatedCell(10, 's1', 's2'),
      generatedCell(11, 's1', 's2'),
      generatedCell(12, 's1', 's2'),
      generatedCell(13, 's1', 's2'),
      generatedCell(14, 's1', 's2'),
      realCell(15, 'k4'),
      realCell(17, 'k5'),
      realCell(18, 't1'),
      generatedCell(19, 't1', 't2'),
      realCell(20, 't2'),
      generatedCell(21, 't1', 't2'),
      generatedCell(22, 't1', 't2'),
      generatedCell(23, 't1', 't2'),
    ]);
    const members: RailSetIdentity[] = [keyRail('k1'), loop('g1'), keyRail('k4'), loop('g2')];

    // All rails selected: every frame in the union window is included.
    const all = derive({ members, keyRailSegments: segments, loopRanges: ranges, cells, capacity });
    expect(all).not.toBeNull();
    expect(all!.start).toBe(0);
    expect(all!.endExclusive).toBe(24);
    for (let frame = 0; frame < capacity; frame += 1) {
      expect(all!.includesFrame(frame), `frame ${frame} with all rails selected`).toBe(true);
    }

    // Per-rail windows: every content-bearing frame attributes to at most one
    // rail (A3) — the predicate matches the timeline paint's inputs (cells +
    // ranges + segments), so solo hiding is exact.
    const perRail = [
      derive({ members: [keyRail('k1')], keyRailSegments: segments, loopRanges: ranges, cells, capacity }),
      derive({ members: [loop('g1')], keyRailSegments: segments, loopRanges: ranges, cells, capacity }),
      derive({ members: [keyRail('k4')], keyRailSegments: segments, loopRanges: ranges, cells, capacity }),
      derive({ members: [loop('g2')], keyRailSegments: segments, loopRanges: ranges, cells, capacity }),
    ];
    for (let frame = 0; frame < capacity; frame += 1) {
      const cell = cells[frame]!;
      if (cell.kind === 'empty') continue; // transparent by construction
      const owners = perRail.filter((window) => window !== null && window.includesFrame(frame)).length;
      expect(owners, `frame ${frame} (${cell.kind}) attributes to at most one rail`).toBeLessThanOrEqual(1);
    }
  });

  it('placement overlap: a Group span inside a Key Rail span keeps content single-attributed', () => {
    const capacity = 8;
    const segments = [segment('k1', ['k1', 'k2'], 0, 4)];
    const ranges = [loopRange('g1', 1, 4, ['s1'])];
    const cells = denseCells(capacity, [
      realCell(0, 'k1'),
      realCell(1, 's1'),
      realCell(4, 'k2'),
    ]);

    const keyRailWindow = derive({ members: [keyRail('k1')], keyRailSegments: segments, loopRanges: ranges, cells, capacity });
    const groupWindow = derive({ members: [loop('g1')], keyRailSegments: segments, loopRanges: ranges, cells, capacity });
    expect(keyRailWindow).not.toBeNull();
    expect(groupWindow).not.toBeNull();

    // Content frames stay single-owned: k1@0 and k2@4 belong to the Key Rail,
    // s1@1 belongs to the Group — even though the Group span [1, 4) sits inside
    // the Key Rail span [0, 5).
    expect(keyRailWindow!.includesFrame(0)).toBe(true);
    expect(keyRailWindow!.includesFrame(1)).toBe(false);
    expect(keyRailWindow!.includesFrame(4)).toBe(true);
    expect(groupWindow!.includesFrame(0)).toBe(false);
    expect(groupWindow!.includesFrame(1)).toBe(true);
    expect(groupWindow!.includesFrame(4)).toBe(false);

    // Empty frames inside both spans are transparent in both windows (no
    // content conflict — Open Question 4).
    expect(keyRailWindow!.includesFrame(2)).toBe(true);
    expect(groupWindow!.includesFrame(2)).toBe(true);
    expect(keyRailWindow!.includesFrame(3)).toBe(true);
    expect(groupWindow!.includesFrame(3)).toBe(true);
  });
});
