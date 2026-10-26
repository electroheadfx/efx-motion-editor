// ============================================================
//  quick-261025-awl Task 1 (D-01) — frame script ownership.
//
//  A frame is owned by ONE module: Brush, Water color, both or none.
//  The resolver reads the REAL stores (no mocks) plus an optional
//  live brush ledger sample, and it never reads or writes a signal.
//
//  quick-261026-odd (empty-script gate): ownership is KEY-bound. A
//  Brush entry only owns a frame when it is stamped with the CURRENT
//  real cell's key id; legacy null-keyId rows and replaced keys
//  resolve NO owner. Completeness gates HYDRATION only — a partial
//  arrival-base row is still the key's live Brush script (261027).
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { BrushOpts, PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  captureBrushScriptForFrame,
  configureBrushScriptKeyProvider,
  noteBrushScriptArrivalBase,
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
  resolveFrameScriptOwner,
  type FrameScriptCell,
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

/** The live key provider stamps `key-<frame>` on every capture. */
function captureBrush(frame: number, mutationId = 1): void {
  captureBrushScriptForFrame(frame, [
    { primary: brushStroke(mutationId), continuations: [] },
  ]);
}

function cellFor(frame: number, keyId: string | null = `key-${frame}`): FrameScriptCell {
  return { kind: 'real', keyId };
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
  configureBrushScriptKeyProvider((frame) => `key-${frame}`);
});

describe('resolveFrameScriptOwner', () => {
  it('returns null for an empty frame', () => {
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
    expect(resolveFrameScriptOwner(10, cellFor(10), null)).toBeNull();
    expect(resolveFrameScriptOwner(10, cellFor(10), { active: false, strokeCount: 0 })).toBeNull();
  });

  it('returns brush for a key-bound captured brush entry', () => {
    captureBrush(10);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('brush');
  });

  it('returns watercolor for a recorded aquarelle stroke on a real cell', () => {
    recordAquarelleStroke(101, aquarelleStroke(101, 10));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('watercolor');
  });

  it('returns both when both stores hold a script for the frame', () => {
    captureBrush(10);
    recordAquarelleStroke(102, aquarelleStroke(102, 10));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('both');
  });

  it('counts an active live brush ledger with strokes and no stored entry', () => {
    expect(resolveFrameScriptOwner(10, cellFor(10), { active: true, strokeCount: 2 })).toBe('brush');
  });

  it('ignores an inactive or empty live brush sample', () => {
    expect(resolveFrameScriptOwner(10, cellFor(10), { active: false, strokeCount: 4 })).toBeNull();
    expect(resolveFrameScriptOwner(10, cellFor(10), { active: true, strokeCount: 0 })).toBeNull();
  });

  it('ignores a stale live sample on a purged frame', () => {
    purgeBrushScriptFrame(10);
    expect(resolveFrameScriptOwner(10, cellFor(10), LIVE)).toBeNull();
  });

  it('never counts a Dry event as a script', () => {
    emitAquarelleDry(4242);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  it('never counts a deleted-stroke tombstone', () => {
    recordAquarelleStroke(103, aquarelleStroke(103, 10));
    markAquarelleStrokeDeleted(103);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  it('never counts another frame or another key', () => {
    captureBrush(11);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
    expect(resolveFrameScriptOwner(11, cellFor(11))).toBe('brush');
    // The script belongs to key-11 — a different key at the same frame is foreign.
    expect(resolveFrameScriptOwner(11, cellFor(11, 'key-replaced'))).toBeNull();
  });

  it('drops back to null after the aquarelle frame script is purged', () => {
    recordAquarelleStroke(105, aquarelleStroke(105, 10));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('watercolor');
    expect(purgeAquarelleFrameScript(10)).toBe(1);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  // quick-261026-odd (empty-script gate, legacy-row Option A — fail closed):
  // a v1 row carries no key identity, so it is not an editable script on the
  // current key. Cached pixels still render; the owner stays null.
  it('never blesses a legacy null-keyId row with the current key', () => {
    configureBrushScriptKeyProvider(null);
    captureBrush(10);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  // 261027 (studio-strokes-lost-redraw): a rasterized arrival-base capture is
  // PARTIAL — hydration refuses it (edit cost), but it is still the CURRENT
  // key's live Brush script. Ownership must count it: otherwise a leftover
  // aquarelle registry script stays the sole owner, the Studio auto-switches to
  // Water color after a Brush stroke, and the Brush stroke is never editable.
  it('counts a key-matched partial (arrival-base) row as the Brush script', () => {
    noteBrushScriptArrivalBase(10, true);
    captureBrush(10);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('brush');
  });

  it('returns both for a partial Brush row alongside an aquarelle script (no single-owner switch)', () => {
    noteBrushScriptArrivalBase(10, true);
    captureBrush(10);
    recordAquarelleStroke(107, aquarelleStroke(107, 10));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('both');
  });

  it('never counts a script on a derived or empty cell', () => {
    captureBrush(10);
    recordAquarelleStroke(106, aquarelleStroke(106, 10));
    expect(resolveFrameScriptOwner(10, { kind: 'generated', keyId: null })).toBeNull();
    expect(resolveFrameScriptOwner(10, { kind: 'empty', keyId: null })).toBeNull();
    expect(resolveFrameScriptOwner(10, null)).toBeNull();
  });
});
