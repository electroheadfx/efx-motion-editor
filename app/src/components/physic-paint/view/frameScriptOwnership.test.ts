// ============================================================
//  quick-261025-awl Task 1 (D-01) — frame script ownership.
//
//  A frame is owned by ONE module: Brush, Water color, both or none.
//  The resolver reads the REAL stores (no mocks) plus an optional
//  live brush ledger sample, and it never reads or writes a signal.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { BrushOpts, PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  captureBrushScriptForFrame,
  purgeBrushScriptFrame,
  resetBrushScriptStore,
} from './brushScriptRecordState';
import {
  emitAquarelleDry,
  markAquarelleStrokeDeleted,
  purgeAquarelleFrameScript,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from './aquarelleRecordState';
import {
  isRotoLoopRailFrame,
  resolveFrameScriptOwner,
  type LiveBrushScriptSample,
} from './frameScriptOwnership';

const PARAMS: BrushOpts = {
  size: 8,
  opacity: 80,
  pressure: 100,
  waterAmount: 30,
  dryAmount: 20,
  edgeDetail: 50,
  pickup: 10,
  eraseStrength: 0,
  antiAlias: 2,
};

function penPoint(x: number, y: number): PenPoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 };
}

function brushStroke(mutationId: number): PaintStroke {
  return {
    tool: 'paint',
    points: [penPoint(10, 10), penPoint(20, 20)],
    color: '#123456',
    params: { ...PARAMS },
    timestamp: mutationId,
    mutationId,
  };
}

function captureBrush(frame: number, mutationId = 1): void {
  captureBrushScriptForFrame(frame, [
    { primary: brushStroke(mutationId), continuations: [] },
  ]);
}

function aquarellePoint(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function aquarelleStroke(mutationId: number, playFrame: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: [aquarellePoint(0.1, 0.5), aquarellePoint(0.2, 0.5)],
    mutationId,
    timestamp: mutationId,
    playFrame,
  };
}

const LIVE: LiveBrushScriptSample = { active: true, strokeCount: 1 };

beforeEach(() => {
  resetBrushScriptStore();
  resetAquarelleRecordState();
});

describe('resolveFrameScriptOwner', () => {
  it('returns null for an empty frame', () => {
    expect(resolveFrameScriptOwner(10)).toBeNull();
    expect(resolveFrameScriptOwner(10, null)).toBeNull();
    expect(resolveFrameScriptOwner(10, { active: false, strokeCount: 0 })).toBeNull();
  });

  it('returns brush for a captured brush entry', () => {
    captureBrush(10);
    expect(resolveFrameScriptOwner(10)).toBe('brush');
  });

  it('returns watercolor for a recorded aquarelle stroke', () => {
    recordAquarelleStroke(101, aquarelleStroke(101, 10));
    expect(resolveFrameScriptOwner(10)).toBe('watercolor');
  });

  it('returns both when both stores hold a script for the frame', () => {
    captureBrush(10);
    recordAquarelleStroke(102, aquarelleStroke(102, 10));
    expect(resolveFrameScriptOwner(10)).toBe('both');
  });

  it('counts an active live brush ledger with strokes and no stored entry', () => {
    expect(resolveFrameScriptOwner(10, { active: true, strokeCount: 2 })).toBe('brush');
  });

  it('ignores an inactive or empty live brush sample', () => {
    expect(resolveFrameScriptOwner(10, { active: false, strokeCount: 4 })).toBeNull();
    expect(resolveFrameScriptOwner(10, { active: true, strokeCount: 0 })).toBeNull();
  });

  it('ignores a stale live sample on a purged frame', () => {
    purgeBrushScriptFrame(10);
    expect(resolveFrameScriptOwner(10, LIVE)).toBeNull();
  });

  it('never counts a Dry event as a script', () => {
    emitAquarelleDry(4242);
    expect(resolveFrameScriptOwner(10)).toBeNull();
  });

  it('never counts a deleted-stroke tombstone', () => {
    recordAquarelleStroke(103, aquarelleStroke(103, 10));
    markAquarelleStrokeDeleted(103);
    expect(resolveFrameScriptOwner(10)).toBeNull();
  });

  it('never counts another frame', () => {
    captureBrush(11);
    recordAquarelleStroke(104, aquarelleStroke(104, 11));
    expect(resolveFrameScriptOwner(10)).toBeNull();
    expect(resolveFrameScriptOwner(11)).toBe('both');
  });

  it('drops back to null after the aquarelle frame script is purged', () => {
    recordAquarelleStroke(105, aquarelleStroke(105, 10));
    expect(resolveFrameScriptOwner(10)).toBe('watercolor');
    expect(purgeAquarelleFrameScript(10)).toBe(1);
    expect(resolveFrameScriptOwner(10)).toBeNull();
  });
});

describe('isRotoLoopRailFrame', () => {
  const RANGES = [
    { placementStart: 4, effectiveEnd: 8 },
    { placementStart: 12, effectiveEnd: 20 },
  ];

  it('marks every frame inside a loop range, including its start', () => {
    expect(isRotoLoopRailFrame(RANGES, 4)).toBe(true);
    expect(isRotoLoopRailFrame(RANGES, 6)).toBe(true);
    expect(isRotoLoopRailFrame(RANGES, 7)).toBe(true);
    expect(isRotoLoopRailFrame(RANGES, 12)).toBe(true);
    expect(isRotoLoopRailFrame(RANGES, 19)).toBe(true);
  });

  it('treats the effective end as half-open and the gap as outside', () => {
    expect(isRotoLoopRailFrame(RANGES, 3)).toBe(false);
    expect(isRotoLoopRailFrame(RANGES, 8)).toBe(false);
    expect(isRotoLoopRailFrame(RANGES, 11)).toBe(false);
    expect(isRotoLoopRailFrame(RANGES, 20)).toBe(false);
  });

  it('never marks anything without ranges', () => {
    expect(isRotoLoopRailFrame(null, 6)).toBe(false);
    expect(isRotoLoopRailFrame(undefined, 6)).toBe(false);
    expect(isRotoLoopRailFrame([], 6)).toBe(false);
  });
});
