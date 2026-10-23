// ============================================================
//  brushScriptRecordState.test.ts — RED-first suite for the
//  session-level, per-frame Brush script store (quick 261023-g4p).
//
//  Contract pinned here:
//    - empty store read API;
//    - capture immutability + paint order;
//    - flush projects through ONE normalizeLogicalBrushes and is
//      a no-op (same entry identity) when the frame is clean;
//    - approxBytes is the UTF-8 JSON byte length of the groups;
//    - fail-closed prune from the first divergent key record;
//    - delete / reset / totals.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import type { BrushOpts, PaintRenderSettings, PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import {
  adoptBrushScriptFrameAsComplete,
  brushScriptRevision,
  captureBrushScriptForFrame,
  clearBrushScriptFrame,
  computeBrushScriptPruneFrame,
  deleteBrushScriptFrame,
  flushBrushScriptFrame,
  getBrushScriptForFrame,
  getBrushScriptFrameEntry,
  getBrushScriptReport,
  getBrushScriptTotals,
  isBrushScriptFrameComplete,
  isBrushScriptLedgerComplete,
  markBrushScriptFrameDirty,
  noteBrushScriptArrivalBase,
  pruneBrushScriptsFromFrame,
  resetBrushScriptStore,
} from './brushScriptRecordState';

const encoder = new TextEncoder();
const jsonBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).byteLength;

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

function point(x: number, y: number): PenPoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 };
}

function stroke(mutationId: number, points: PenPoint[] = [point(10, 10), point(20, 20)]): PaintStroke {
  return {
    tool: 'paint',
    points,
    color: '#123456',
    params: { ...PARAMS },
    timestamp: mutationId,
    mutationId,
  };
}

function continuation(mutationId: number, diffusionFrames = 4): PaintStroke {
  return {
    tool: 'paint',
    points: [],
    color: '#123456',
    params: { ...PARAMS },
    timestamp: mutationId,
    mutationId,
    diffusionFrames,
  };
}

beforeEach(() => {
  resetBrushScriptStore();
});

describe('empty store', () => {
  it('returns empty groups, zero totals and an empty report', () => {
    expect(getBrushScriptForFrame(3)).toEqual([]);
    expect(Object.isFrozen(getBrushScriptForFrame(3))).toBe(true);
    expect(getBrushScriptTotals()).toEqual({ strokes: 0, points: 0, approxBytes: 0 });
    expect(getBrushScriptReport()).toEqual({
      frames: [],
      totals: { strokes: 0, points: 0, approxBytes: 0 },
    });
    expect(getBrushScriptFrameEntry(3)).toBeUndefined();
  });
});

describe('capture immutability and order', () => {
  it('stores an immutable entry and preserves paint order', () => {
    const groups = [
      { primary: stroke(2, [point(1, 1)]), continuations: [] },
      { primary: stroke(1, [point(2, 2), point(3, 3)]), continuations: [] },
    ];
    const entry = captureBrushScriptForFrame(3, groups);

    expect(entry.frame).toBe(3);
    expect(entry.strokes).toBe(2);
    expect(entry.points).toBe(3);
    expect(getBrushScriptForFrame(3).map((group) => group.primary.mutationId)).toEqual([2, 1]);

    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.groups)).toBe(true);
    for (const group of entry.groups) {
      expect(Object.isFrozen(group)).toBe(true);
      expect(Object.isFrozen(group.primary)).toBe(true);
      expect(Object.isFrozen(group.primary.points)).toBe(true);
      expect(Object.isFrozen(group.primary.params)).toBe(true);
      for (const p of group.primary.points) expect(Object.isFrozen(p)).toBe(true);
    }
  });

  it('ignores later mutation of the input array and its strokes', () => {
    const source = [point(10, 10)];
    const groups = [{ primary: stroke(7, source), continuations: [] }];
    captureBrushScriptForFrame(4, groups);

    // The retained groups array is a different array than the caller's.
    groups.push({ primary: stroke(8), continuations: [] });
    expect(getBrushScriptForFrame(4)).toHaveLength(1);
    expect(getBrushScriptForFrame(4)[0]!.primary.points[0]).toEqual(point(10, 10));
    // The retained stroke objects are frozen in place.
    expect(() => {
      (getBrushScriptForFrame(4)[0]!.primary.points[0] as PenPoint).x = 999;
    }).toThrow();
    expect(getBrushScriptForFrame(4)[0]!.primary.points[0]!.x).toBe(10);
    void source;
  });
});

describe('flush', () => {
  it('projects through normalizeLogicalBrushes: continuations join, zero-point strokes drop', () => {
    const strokes = [
      stroke(1),
      continuation(1),
      stroke(2),
      stroke(3, []), // zero-point with NO positive diffusion → dropped
      continuation(3, 0), // zero → dropped
    ];

    expect(flushBrushScriptFrame(5, strokes)).toBe(true);

    const groups = getBrushScriptForFrame(5);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.primary.mutationId).toBe(1);
    expect(groups[0]!.continuations?.map((s) => s.mutationId)).toEqual([1]);
    expect(groups[1]!.primary.mutationId).toBe(2);
    expect(groups[1]!.continuations).toEqual([]);
    expect(getBrushScriptFrameEntry(5)?.points).toBe(4);
  });

  it('is a no-op for a clean, already-captured frame (same entry identity)', () => {
    const strokes = [stroke(1)];
    expect(flushBrushScriptFrame(5, strokes)).toBe(true);
    const first = getBrushScriptFrameEntry(5);

    expect(flushBrushScriptFrame(5, [stroke(2)])).toBe(false);
    expect(getBrushScriptFrameEntry(5)).toBe(first);

    markBrushScriptFrameDirty(5);
    expect(flushBrushScriptFrame(5, [stroke(2)])).toBe(true);
    expect(getBrushScriptFrameEntry(5)).not.toBe(first);
    expect(getBrushScriptForFrame(5)[0]!.primary.mutationId).toBe(2);
  });

  it('refuses a null engine result and keeps the previous entry', () => {
    flushBrushScriptFrame(5, [stroke(1)]);
    const entry = getBrushScriptFrameEntry(5);
    expect(flushBrushScriptFrame(5, null)).toBe(false);
    expect(getBrushScriptFrameEntry(5)).toBe(entry);
  });

  it('drops an emptied frame instead of storing a zero row', () => {
    captureBrushScriptForFrame(5, [{ primary: stroke(1), continuations: [] }]);
    markBrushScriptFrameDirty(5);
    expect(flushBrushScriptFrame(5, [])).toBe(false);
    expect(getBrushScriptFrameEntry(5)).toBeUndefined();
    expect(getBrushScriptReport().frames).toEqual([]);
  });
});

describe('approxBytes method', () => {
  it('equals the UTF-8 JSON length of the retained groups array', () => {
    flushBrushScriptFrame(2, [stroke(1), stroke(2)]);
    const entry = getBrushScriptFrameEntry(2)!;

    expect(entry.approxBytes).toBe(jsonBytes(entry.groups));
    expect(entry.approxBytes).toBeGreaterThan(0);
    expect(getBrushScriptTotals().approxBytes).toBe(entry.approxBytes);
  });

  it('totals sum entries only', () => {
    flushBrushScriptFrame(2, [stroke(1)]);
    flushBrushScriptFrame(6, [stroke(2), stroke(3)]);
    const two = getBrushScriptFrameEntry(2)!;
    const six = getBrushScriptFrameEntry(6)!;
    const report = getBrushScriptReport();

    expect(report.frames.map((row) => row.frame)).toEqual([2, 6]);
    expect(report.totals).toEqual({
      strokes: two.strokes + six.strokes,
      points: two.points + six.points,
      approxBytes: two.approxBytes + six.approxBytes,
    });
    expect(getBrushScriptTotals()).toEqual(report.totals);
  });
});

describe('prune law (fail closed)', () => {
  it('computeBrushScriptPruneFrame returns null for identical records', () => {
    const records = [
      { keyId: 'b', appFrame: 5 },
      { keyId: 'a', appFrame: 0 },
    ];
    expect(computeBrushScriptPruneFrame(records, [...records].reverse())).toBeNull();
    expect(computeBrushScriptPruneFrame([], [])).toBeNull();
  });

  it('returns the first divergent appFrame for a deleted record', () => {
    const before = [
      { keyId: 'a', appFrame: 0 },
      { keyId: 'b', appFrame: 5 },
      { keyId: 'c', appFrame: 10 },
    ];
    const after = [
      { keyId: 'a', appFrame: 0 },
      { keyId: 'c', appFrame: 10 },
    ];
    expect(computeBrushScriptPruneFrame(before, after)).toBe(5);
  });

  it('returns the first divergent appFrame for an inserted/rippled record', () => {
    const before = [
      { keyId: 'a', appFrame: 0 },
      { keyId: 'b', appFrame: 10 },
    ];
    const after = [
      { keyId: 'a', appFrame: 0 },
      { keyId: 'e', appFrame: 5 },
      { keyId: 'b', appFrame: 15 },
    ];
    expect(computeBrushScriptPruneFrame(before, after)).toBe(5);
  });

  it('returns the tail boundary for a tail append or delete', () => {
    const before = [
      { keyId: 'a', appFrame: 0 },
      { keyId: 'b', appFrame: 10 },
    ];
    expect(computeBrushScriptPruneFrame(before, [...before, { keyId: 'c', appFrame: 20 }])).toBe(20);
    expect(computeBrushScriptPruneFrame([...before, { keyId: 'c', appFrame: 20 }], before)).toBe(20);
  });

  it('drops every captured frame at or after the prune frame and keeps earlier ones', () => {
    captureBrushScriptForFrame(2, [{ primary: stroke(1), continuations: [] }]);
    captureBrushScriptForFrame(5, [{ primary: stroke(2), continuations: [] }]);
    captureBrushScriptForFrame(9, [{ primary: stroke(3), continuations: [] }]);

    expect(pruneBrushScriptsFromFrame(5)).toBe(2);
    expect(getBrushScriptReport().frames.map((row) => row.frame)).toEqual([2]);
    expect(pruneBrushScriptsFromFrame(5)).toBe(0);
  });

  it('a prune drops a stale dirty mark too', () => {
    markBrushScriptFrameDirty(7);
    pruneBrushScriptsFromFrame(0);
    flushBrushScriptFrame(7, [stroke(1)]);
    // Never captured before → the flush captures regardless of dirty.
    expect(getBrushScriptFrameEntry(7)).toBeDefined();
  });
});

// ============================================================
//  261023-h9v — explicit per-frame completeness.
//
//  complete means the stored groups are the WHOLE frame content: the
//  frame arrived with no cached pixel base this session (or was itself
//  hydrated from a complete entry). partial means a pre-existing cached
//  base sits under the session's strokes — hydration must never replace
//  those base pixels with a strokes-only script (paint loss).
// ============================================================
describe('completeness law (261023-h9v)', () => {
  it('declares the ledger complete for a fresh uncaptured frame and a complete entry, partial otherwise', () => {
    // No entry, no cached base: a fresh frame's session ledger is complete.
    expect(isBrushScriptLedgerComplete(4)).toBe(true);
    // No entry, but a cached base arrived: the ledger is partial.
    noteBrushScriptArrivalBase(5, true);
    expect(isBrushScriptLedgerComplete(5)).toBe(false);
    // Captured complete stays complete; captured partial stays partial.
    captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    expect(isBrushScriptLedgerComplete(4)).toBe(true);
    noteBrushScriptArrivalBase(6, true);
    captureBrushScriptForFrame(6, [{ primary: stroke(2), continuations: [] }]);
    expect(isBrushScriptLedgerComplete(6)).toBe(false);
  });

  it('captures a frame with no arrival-base record as complete', () => {
    const entry = captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    expect(entry.complete).toBe(true);
    expect(isBrushScriptFrameComplete(4)).toBe(true);
    expect(getBrushScriptReport().frames[0]).toMatchObject({ frame: 4, complete: true });
  });

  it('captures a frame that arrived with a cached base as partial', () => {
    noteBrushScriptArrivalBase(4, true);
    const entry = captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    expect(entry.complete).toBe(false);
    expect(isBrushScriptFrameComplete(4)).toBe(false);
    // A false arrival note records nothing — a fresh frame stays complete.
    noteBrushScriptArrivalBase(6, false);
    expect(captureBrushScriptForFrame(6, [{ primary: stroke(2), continuations: [] }]).complete).toBe(true);
  });

  it('keeps completeness sticky across recapture and ignores later arrival records', () => {
    captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    const first = getBrushScriptFrameEntry(4);
    noteBrushScriptArrivalBase(4, true);
    markBrushScriptFrameDirty(4);
    expect(flushBrushScriptFrame(4, [stroke(5)])).toBe(true);
    expect(getBrushScriptFrameEntry(4)).not.toBe(first);
    expect(getBrushScriptFrameEntry(4)?.complete).toBe(true);

    noteBrushScriptArrivalBase(8, true);
    captureBrushScriptForFrame(8, [{ primary: stroke(2), continuations: [] }]);
    captureBrushScriptForFrame(8, [{ primary: stroke(3), continuations: [] }]);
    expect(getBrushScriptFrameEntry(8)?.complete).toBe(false);
  });

  it('clearBrushScriptFrame drops the entry and its arrival-base record', () => {
    noteBrushScriptArrivalBase(4, true);
    captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    expect(getBrushScriptFrameEntry(4)?.complete).toBe(false);

    expect(clearBrushScriptFrame(4)).toBe(true);
    expect(clearBrushScriptFrame(4)).toBe(false);
    expect(getBrushScriptFrameEntry(4)).toBeUndefined();
    // The base knowledge is gone: a reused frame captures as complete.
    expect(captureBrushScriptForFrame(4, [{ primary: stroke(2), continuations: [] }]).complete).toBe(true);
  });

  it('deleteBrushScriptFrame keeps arrival-base knowledge (internal empty projection)', () => {
    noteBrushScriptArrivalBase(4, true);
    captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    expect(deleteBrushScriptFrame(4)).toBe(true);
    expect(captureBrushScriptForFrame(4, [{ primary: stroke(2), continuations: [] }]).complete).toBe(false);
  });

  it('prune drops arrival-base records at or after the pruned frame only', () => {
    noteBrushScriptArrivalBase(2, true);
    noteBrushScriptArrivalBase(5, true);
    captureBrushScriptForFrame(2, [{ primary: stroke(1), continuations: [] }]);
    captureBrushScriptForFrame(5, [{ primary: stroke(2), continuations: [] }]);

    expect(pruneBrushScriptsFromFrame(5)).toBe(1);
    expect(captureBrushScriptForFrame(5, [{ primary: stroke(3), continuations: [] }]).complete).toBe(true);
    // The earlier frame's knowledge survives the prune.
    markBrushScriptFrameDirty(2);
    flushBrushScriptFrame(2, [stroke(4)]);
    expect(getBrushScriptFrameEntry(2)?.complete).toBe(false);
  });

  it('reset clears arrival-base records with the frames', () => {
    noteBrushScriptArrivalBase(3, true);
    captureBrushScriptForFrame(3, [{ primary: stroke(1), continuations: [] }]);
    resetBrushScriptStore();
    expect(captureBrushScriptForFrame(3, [{ primary: stroke(2), continuations: [] }]).complete).toBe(true);
  });

  it('report rows expose complete and diffusion totals; totals stay byte/point sums', () => {
    noteBrushScriptArrivalBase(2, true);
    flushBrushScriptFrame(2, [stroke(1), continuation(1, 8)]);
    flushBrushScriptFrame(6, [stroke(2), continuation(2, 4)]);

    const report = getBrushScriptReport();
    expect(report.frames.map((row) => row.frame)).toEqual([2, 6]);
    expect(report.frames[0]).toMatchObject({ frame: 2, complete: false, diffusionFrames: 8 });
    expect(report.frames[1]).toMatchObject({ frame: 6, complete: true, diffusionFrames: 4 });
    expect(report.totals).toEqual({
      strokes: 2,
      points: 4,
      approxBytes: report.frames[0]!.approxBytes + report.frames[1]!.approxBytes,
    });
  });

  it('caps each continuation diffusion contribution at 600 frames', () => {
    flushBrushScriptFrame(7, [stroke(1), continuation(1, 5000), continuation(1, 4)]);
    expect(getBrushScriptReport().frames[0]).toMatchObject({ diffusionFrames: 604 });
  });
});

// ============================================================
//  261023-j5b follow-up — Duplicate adoption. A Duplicate
//  destination was an EMPTY cell, so the promoted key is blank and
//  the applied script is the whole frame BY CONSTRUCTION. This is
//  the one sanctioned override of sticky completeness: an earlier
//  arrival observation of the promoted BLANK base must not leave
//  the frame partial.
// ============================================================
describe('duplicate adoption (261023-j5b follow-up)', () => {
  it('adopts a blank-born destination as complete even after an arrival-base note', () => {
    noteBrushScriptArrivalBase(4, true);
    expect(isBrushScriptLedgerComplete(4)).toBe(false);

    const entry = adoptBrushScriptFrameAsComplete(4, [stroke(1)]);

    expect(entry?.complete).toBe(true);
    expect(isBrushScriptFrameComplete(4)).toBe(true);
    expect(isBrushScriptLedgerComplete(4)).toBe(true);
    expect(getBrushScriptForFrame(4)).toHaveLength(1);
  });

  it('upgrades an existing partial entry (the promoted blank base held no content)', () => {
    noteBrushScriptArrivalBase(4, true);
    captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);
    expect(getBrushScriptFrameEntry(4)?.complete).toBe(false);

    expect(adoptBrushScriptFrameAsComplete(4, [stroke(2), stroke(3)])?.complete).toBe(true);
    expect(getBrushScriptForFrame(4)).toHaveLength(2);
  });

  it('refuses an empty ledger and keeps the previous entry', () => {
    captureBrushScriptForFrame(4, [{ primary: stroke(1), continuations: [] }]);

    expect(adoptBrushScriptFrameAsComplete(4, [])).toBeNull();
    expect(adoptBrushScriptFrameAsComplete(4, null)).toBeNull();
    expect(getBrushScriptForFrame(4)).toHaveLength(1);
  });

  it('clears the dirty mark and carries the paint settings snapshot', () => {
    const settings: PaintRenderSettings = {
      localSpreadStrength: 42,
      wetPaper: true,
      physicsStrength: 0.6,
      paperGrain: 'grainC',
    };
    markBrushScriptFrameDirty(4);

    const entry = adoptBrushScriptFrameAsComplete(4, [stroke(1)], settings);

    expect(entry?.paintSettings).toEqual(settings);
    expect(entry?.complete).toBe(true);
    // A clean, captured frame keeps its identity across a redundant flush.
    const identity = getBrushScriptFrameEntry(4);
    expect(flushBrushScriptFrame(4, [stroke(1)])).toBe(false);
    expect(getBrushScriptFrameEntry(4)).toBe(identity);
  });
});

// ============================================================
//  261023-j5b — the frame's captured paint globals. The faithful
//  rebake replays with the look the strokes were painted under, so
//  the snapshot must survive recaptures (STICKY: first non-null
//  wins) and be carried by every flush/capture point.
// ============================================================
describe('paint settings snapshot (261023-j5b)', () => {
  const FIRST: PaintRenderSettings = {
    localSpreadStrength: 30,
    wetPaper: true,
    physicsStrength: 0.6,
    paperGrain: 'grainA',
  };
  const SECOND: PaintRenderSettings = {
    localSpreadStrength: 90,
    wetPaper: false,
    physicsStrength: 0.1,
    paperGrain: 'grainB',
  };

  it('captures the settings and keeps the FIRST non-null snapshot across recaptures', () => {
    const entry = captureBrushScriptForFrame(3, [{ primary: stroke(1), continuations: [] }], undefined, FIRST);
    expect(entry.paintSettings).toEqual(FIRST);

    const recaptured = captureBrushScriptForFrame(3, [{ primary: stroke(2), continuations: [] }], undefined, SECOND);
    expect(recaptured.paintSettings).toEqual(FIRST);
  });

  it('a null/absent snapshot never overwrites; the first later non-null snapshot sticks', () => {
    captureBrushScriptForFrame(3, [{ primary: stroke(1), continuations: [] }]);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toBeNull();

    captureBrushScriptForFrame(3, [{ primary: stroke(2), continuations: [] }], undefined, SECOND);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(SECOND);

    captureBrushScriptForFrame(3, [{ primary: stroke(3), continuations: [] }]);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(SECOND);
  });

  it('flush carries the settings into a fresh entry', () => {
    expect(flushBrushScriptFrame(3, [stroke(1)], FIRST)).toBe(true);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(FIRST);
  });

  it('an empty projection (entry dropped) forgets the settings with the frame', () => {
    captureBrushScriptForFrame(3, [{ primary: stroke(1), continuations: [] }], undefined, FIRST);
    // A dirty empty flush drops the ghost row (a clean capture is a no-op).
    markBrushScriptFrameDirty(3);
    expect(flushBrushScriptFrame(3, [])).toBe(false);
    expect(getBrushScriptFrameEntry(3)).toBeUndefined();

    captureBrushScriptForFrame(3, [{ primary: stroke(2), continuations: [] }], undefined, SECOND);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(SECOND);
  });
});

describe('delete and reset', () => {
  it('deleteBrushScriptFrame removes one frame only', () => {
    captureBrushScriptForFrame(2, [{ primary: stroke(1), continuations: [] }]);
    captureBrushScriptForFrame(6, [{ primary: stroke(2), continuations: [] }]);
    expect(deleteBrushScriptFrame(2)).toBe(true);
    expect(deleteBrushScriptFrame(2)).toBe(false);
    expect(getBrushScriptReport().frames.map((row) => row.frame)).toEqual([6]);
  });

  it('resetBrushScriptStore empties everything and bumps only when needed', () => {
    captureBrushScriptForFrame(2, [{ primary: stroke(1), continuations: [] }]);
    let runs = 0;
    const dispose = effect(() => {
      void brushScriptRevision.value;
      runs += 1;
    });
    try {
      runs = 0;
      resetBrushScriptStore();
      expect(runs).toBe(1);
      expect(getBrushScriptReport().frames).toEqual([]);
      resetBrushScriptStore();
      expect(runs).toBe(1);
    } finally {
      dispose();
    }
  });
});
