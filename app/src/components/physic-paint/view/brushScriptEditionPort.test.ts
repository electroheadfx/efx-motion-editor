// ============================================================
//  brushScriptEditionPort — contract of record (quick 261023-g4p
//  Task 3).
//
//  The brush side of the ONE script-edition seam: the store's
//  per-frame groups map to SelectableScriptStroke rows (serial from
//  the engine badge map, stack position from the TOP of the paint
//  order), the hit test walks topmost-first, and every edit op is
//  lock-gated, calls the engine exactly once, then refreshes the
//  store for the frame it changed.
//
//  These cells drive the REAL store (brushScriptRecordState) so the
//  flush-after-op law is pinned end-to-end, with a fake engine that
//  records calls.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effect } from '@preact/signals';
import type { PaintRenderSettings, PaintStroke } from '@efxlab/efx-physic-paint';
import {
  captureBrushScriptForFrame,
  getBrushScriptFrameEntry,
  markBrushScriptFrameDirty,
  noteBrushScriptArrivalBase,
  resetBrushScriptStore,
} from './brushScriptRecordState';
import { normalizeLogicalBrushes } from './recordedStrokeGroups';
import {
  applyBrushScriptStrokeAppearance,
  configureBrushScriptEdition,
  listBrushScriptStrokes,
  hitTestBrushScriptStroke,
  moveBrushScriptStroke,
  moveBrushScriptStrokes,
  deleteBrushScriptStroke,
  deleteBrushScriptStrokes,
  readBrushScriptStrokeAppearance,
  transformBrushScriptStrokes,
  stepBrushScriptStroke,
  placeBrushScriptStroke,
  brushScriptEditionPort,
} from './brushScriptEditionPort';
import {
  clearScriptStrokeSelection,
  scriptSelectedStrokeId,
  scriptSelectedStrokeIds,
  scriptSelectMode,
  selectScriptStroke,
  setScriptSelectMode,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';

const OPTIONS = {
  size: 12,
  opacity: 100,
  pressure: 100,
  waterAmount: 0,
  dryAmount: 100,
  edgeDetail: 50,
  pickup: 0,
  eraseStrength: 100,
  antiAlias: 0,
};

function point(x: number, y: number) {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 };
}

function stroke(mutationId: number, points: Array<{ x: number; y: number }>, color?: string): PaintStroke {
  return {
    tool: 'paint',
    points: points.map((p) => point(p.x, p.y)),
    ...(color === undefined ? {} : { color }),
    params: { ...OPTIONS },
    timestamp: mutationId,
    mutationId,
  } as PaintStroke;
}

function capture(frame: number, strokes: PaintStroke[]): void {
  captureBrushScriptForFrame(frame, normalizeLogicalBrushes(strokes));
}

function createFakeEngine(overrides: Record<string, unknown> = {}) {
  return {
    getStrokes: vi.fn(() => [] as PaintStroke[]),
    getStrokeSerials: vi.fn(() => new Map<number, number>()),
    getStrokeAppearance: vi.fn(() => [] as Array<{
      mutationId: number;
      params: Record<string, number>;
      color: string | null;
    }>),
    setStrokeAppearance: vi.fn(() => 0),
    moveStroke: vi.fn(() => true),
    moveStrokes: vi.fn(() => 1),
    deleteStroke: vi.fn(() => true),
    deleteStrokes: vi.fn(() => 1),
    transformStrokes: vi.fn(() => 1),
    sendStrokeBackward: vi.fn(() => true),
    sendStrokeForward: vi.fn(() => true),
    moveStrokeToStackPosition: vi.fn(() => true),
    setStrokeLabelsSuppressed: vi.fn(),
    setCursorVisible: vi.fn(),
    setScriptBaseClearPending: vi.fn(),
    getFramePaintSettings: vi.fn(() => null as PaintRenderSettings | null),
    getPaintRenderSettings: vi.fn((): PaintRenderSettings => ({
      localSpreadStrength: 65,
      wetPaper: true,
      physicsStrength: 0.2,
      paperGrain: '',
    })),
    ...overrides,
  };
}

function configure(
  engine: ReturnType<typeof createFakeEngine>,
  options: { active?: boolean; locked?: boolean; frame?: number } = {},
): void {
  configureBrushScriptEdition({
    getEngine: () => engine,
    getPlayFrame: () => options.frame ?? 3,
    isActive: () => options.active ?? true,
    isLocked: () => options.locked ?? false,
  });
}

const SIZE = { width: 200, height: 120 };

/** The SAME object identity must reach the engine (one gesture, one transform). */
const TRANSFORM = {
  kind: 'rotate' as const,
  centerX: 100,
  centerY: 100,
  anchorX: 100,
  anchorY: 100,
  angleRad: Math.PI / 4,
  scaleX: 1,
  scaleY: 1,
};

beforeEach(() => {
  resetBrushScriptStore();
  configureBrushScriptEdition(null);
  setScriptSelectMode(false);
  clearScriptStrokeSelection();
});

describe('listing: store groups become selectable rows', () => {
  it('maps paint order bottom -> top with the engine serial, top-relative stack positions and the stroke colour', () => {
    const groups = normalizeLogicalBrushes([
      stroke(7, [{ x: 20, y: 30 }, { x: 80, y: 30 }], '#ff0000'),
      stroke(9, [{ x: 20, y: 60 }, { x: 80, y: 60 }]),
    ]);
    captureBrushScriptForFrame(3, groups);
    const engine = createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[7, 1], [9, 2]])),
    });
    configure(engine);

    const rows = listBrushScriptStrokes(3, SIZE);

    expect(rows.map((row) => row.mutationId)).toEqual([7, 9]);
    // Bottom of the paint stack is position 2/2, top is 1/2.
    expect(rows.map((row) => row.stackPosition)).toEqual([2, 1]);
    expect(rows.map((row) => row.stackTotal)).toEqual([2, 2]);
    expect(rows.map((row) => row.serial)).toEqual([1, 2]);
    expect(rows[0].color).toBe('#ff0000');
    expect(rows[1].color).toBe('#111827');
    expect(rows[0].pointsPx).toHaveLength(2);
    expect(rows[0].bounds.width).toBeGreaterThan(60);
  });

  it('decimates long polylines while bounds keep every point', () => {
    const longPoints = Array.from({ length: 200 }, (_, index) => ({ x: index, y: 40 }));
    capture(3, [stroke(42, longPoints)]);
    const engine = createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[42, 1]])),
    });
    configure(engine);

    const [row] = listBrushScriptStrokes(3, SIZE);

    expect(row!.serial).toBe(1);
    expect(row!.pointsPx).toHaveLength(96);
    // Bounds span the FULL polyline (0..199), padded by max(6, size/2).
    expect(row!.bounds.x).toBe(0 - 6);
    expect(row!.bounds.width).toBe(199 + 12);
  });

  it('returns an empty list for an absent frame and for no context', () => {
    configure(createFakeEngine());
    expect(listBrushScriptStrokes(99, SIZE)).toEqual([]);

    configureBrushScriptEdition(null);
    expect(listBrushScriptStrokes(3, SIZE)).toEqual([]);
  });

  // 261023-h9v: a store entry that survived navigation without hydration (a
  // stale/other-track entry) must never render dead Move outlines.
  it('returns [] when the engine does not hold every stored primary mutationId', () => {
    capture(3, [stroke(7, [{ x: 20, y: 30 }]), stroke(9, [{ x: 20, y: 60 }])]);
    configure(createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[7, 1]])),
    }));
    expect(listBrushScriptStrokes(3, SIZE)).toEqual([]);

    configure(createFakeEngine({ getStrokeSerials: vi.fn(() => new Map()) }));
    expect(listBrushScriptStrokes(3, SIZE)).toEqual([]);
  });

  it('still lists a PARTIAL entry whose strokes are live in the current engine', () => {
    noteBrushScriptArrivalBase(3, true);
    capture(3, [stroke(7, [{ x: 20, y: 30 }])]);
    configure(createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[7, 1]])),
    }));

    expect(getBrushScriptFrameEntry(3)?.complete).toBe(false);
    expect(listBrushScriptStrokes(3, SIZE).map((row) => row.mutationId)).toEqual([7]);
  });
});

describe('hit test: topmost painted stroke wins', () => {
  it('returns the topmost overlapping primary, null off-stroke, null for an absent frame', () => {
    capture(3, [
      stroke(5, [{ x: 20, y: 30 }, { x: 80, y: 30 }]),
      stroke(6, [{ x: 20, y: 30 }, { x: 80, y: 30 }]),
    ]);
    configure(createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[5, 1], [6, 2]])),
    }));

    // Both ribbons overlap at (50,30) — the later painted stroke is on top.
    expect(hitTestBrushScriptStroke({ x: 50, y: 30 }, 3, SIZE)).toBe(6);
    expect(hitTestBrushScriptStroke({ x: 50, y: 100 }, 3, SIZE)).toBeNull();
    expect(hitTestBrushScriptStroke({ x: 50, y: 30 }, 99, SIZE)).toBeNull();
  });

  it('returns null when the engine does not hold the stored strokes', () => {
    capture(3, [stroke(5, [{ x: 20, y: 30 }, { x: 80, y: 30 }])]);
    configure(createFakeEngine({ getStrokeSerials: vi.fn(() => new Map()) }));
    expect(hitTestBrushScriptStroke({ x: 50, y: 30 }, 3, SIZE)).toBeNull();
  });
});

describe('edits: lock gate, one engine call, store refresh', () => {
  it('move calls the engine once and flushes the changed frame into the store', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(7, [{ x: 30, y: 35 }])]),
    });
    configure(engine, { frame: 3 });

    expect(moveBrushScriptStroke(7, 10, 5)).toBe(true);

    // The singular wrapper is a one-element batch: ONE engine commit + ONE flush.
    expect(engine.moveStrokes).toHaveBeenCalledTimes(1);
    expect(engine.moveStrokes).toHaveBeenCalledWith([7], 10, 5);
    expect(engine.setScriptBaseClearPending).toHaveBeenCalledWith(true);
    expect(getBrushScriptFrameEntry(3)?.strokes).toBe(1);
  });

  it('a partial visit declares that its cached base must survive the edit', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(7, [{ x: 30, y: 35 }])]),
    });
    configure(engine, { frame: 3 });
    noteBrushScriptArrivalBase(3, true);
    capture(3, [stroke(7, [{ x: 30, y: 35 }])]);

    expect(moveBrushScriptStroke(7, 10, 5)).toBe(true);

    expect(engine.setScriptBaseClearPending).toHaveBeenCalledWith(false);
  });

  it('delete calls the engine once, refreshes the store and clears a matching selection', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(9, [{ x: 30, y: 35 }])]),
    });
    configure(engine, { frame: 3 });
    setScriptSelectMode(true);
    selectScriptStroke(7);

    expect(deleteBrushScriptStroke(7)).toBe(true);

    expect(engine.deleteStrokes).toHaveBeenCalledTimes(1);
    expect(engine.deleteStrokes).toHaveBeenCalledWith([7]);
    expect(scriptSelectedStrokeId.value).toBeNull();
    expect(scriptSelectMode.value).toBe(true);
    expect(getBrushScriptFrameEntry(3)?.strokes).toBe(1);
  });

  it('delete keeps a different selection untouched', () => {
    const engine = createFakeEngine();
    configure(engine, { frame: 3 });
    setScriptSelectMode(true);
    selectScriptStroke(9);

    expect(deleteBrushScriptStroke(7)).toBe(true);

    expect(scriptSelectedStrokeId.value).toBe(9);
  });

  it('step forwards the direction and flushes only when the engine accepts the step', () => {
    capture(3, [stroke(7, [{ x: 30, y: 35 }])]);
    const entryBefore = getBrushScriptFrameEntry(3);
    markBrushScriptFrameDirty(3);
    const engine = createFakeEngine({
      sendStrokeBackward: vi.fn(() => false),
      getStrokes: vi.fn(() => [stroke(7, [{ x: 30, y: 35 }])]),
    });
    configure(engine, { frame: 3 });

    // Refused at the bottom: no flush — the captured entry keeps its identity.
    expect(stepBrushScriptStroke(7, 'back')).toBe(false);
    expect(engine.sendStrokeBackward).toHaveBeenCalledWith(7);
    expect(getBrushScriptFrameEntry(3)).toBe(entryBefore);

    // Accepted: the dirty mark is projected.
    expect(stepBrushScriptStroke(7, 'forward')).toBe(true);
    expect(engine.sendStrokeForward).toHaveBeenCalledWith(7);
    expect(getBrushScriptFrameEntry(3)).not.toBe(entryBefore);
  });

  // 261023-j5b: an edit-triggered flush carries the visit's paint globals so
  // the first faithful rebake replays with the painted look, never whatever
  // the sliders read now.
  it("carries the visit's captured paint settings into the refreshed entry", () => {
    const settings: PaintRenderSettings = {
      localSpreadStrength: 42,
      wetPaper: true,
      physicsStrength: 0.75,
      paperGrain: 'grainB',
    };
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(7, [{ x: 30, y: 35 }])]),
      getFramePaintSettings: vi.fn(() => settings),
    });
    configure(engine, { frame: 3 });

    expect(moveBrushScriptStroke(7, 10, 5)).toBe(true);

    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(settings);
    // The captured snapshot wins — the live globals are not consulted.
    expect(engine.getPaintRenderSettings).not.toHaveBeenCalled();
  });

  it('falls back to the live engine globals when the visit captured none, on every op', () => {
    const live: PaintRenderSettings = {
      localSpreadStrength: 12,
      wetPaper: false,
      physicsStrength: 0.3,
      paperGrain: 'grainA',
    };
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(9, [{ x: 30, y: 35 }])]),
      getFramePaintSettings: vi.fn(() => null),
      getPaintRenderSettings: vi.fn(() => live),
    });
    configure(engine, { frame: 3 });

    expect(deleteBrushScriptStroke(9)).toBe(true);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(live);

    expect(stepBrushScriptStroke(9, 'forward')).toBe(true);
    expect(getBrushScriptFrameEntry(3)?.paintSettings).toEqual(live);
  });

  it('every op refuses while the physical mutation lock is held and never touches the engine', () => {
    const engine = createFakeEngine();
    configure(engine, { locked: true });

    expect(moveBrushScriptStroke(7, 10, 5)).toBe(false);
    expect(moveBrushScriptStrokes([7, 9], 10, 5)).toBe(false);
    expect(deleteBrushScriptStroke(7)).toBe(false);
    expect(deleteBrushScriptStrokes([7, 9])).toBe(false);
    expect(transformBrushScriptStrokes([7, 9], TRANSFORM)).toBe(false);
    expect(stepBrushScriptStroke(7, 'back')).toBe(false);

    expect(engine.moveStrokes).not.toHaveBeenCalled();
    expect(engine.deleteStrokes).not.toHaveBeenCalled();
    expect(engine.transformStrokes).not.toHaveBeenCalled();
    expect(engine.sendStrokeBackward).not.toHaveBeenCalled();
    expect(engine.sendStrokeForward).not.toHaveBeenCalled();
  });

  it('ops refuse with no context and with no engine', () => {
    expect(moveBrushScriptStroke(7, 10, 5)).toBe(false);
    expect(deleteBrushScriptStroke(7)).toBe(false);
    expect(transformBrushScriptStrokes([7], TRANSFORM)).toBe(false);
    expect(stepBrushScriptStroke(7, 'forward')).toBe(false);

    configureBrushScriptEdition({
      getEngine: () => null,
      getPlayFrame: () => 3,
      isActive: () => true,
      isLocked: () => false,
    });
    expect(moveBrushScriptStroke(7, 10, 5)).toBe(false);
    expect(transformBrushScriptStrokes([7], TRANSFORM)).toBe(false);
  });
});

describe('port: delegates through the registration', () => {
  it('isActive follows the context and the list/hit functions delegate', () => {
    capture(3, [stroke(5, [{ x: 20, y: 30 }, { x: 80, y: 30 }])]);
    expect(brushScriptEditionPort.isActive()).toBe(false);

    configure(createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[5, 1]])),
    }), { active: true });
    expect(brushScriptEditionPort.isActive()).toBe(true);
    expect(brushScriptEditionPort.listStrokes(3, SIZE).map((row) => row.mutationId)).toEqual([5]);
    expect(brushScriptEditionPort.hitTestStroke({ x: 50, y: 30 }, 3, SIZE)).toBe(5);

    const engine = createFakeEngine();
    configure(engine, { active: false });
    expect(brushScriptEditionPort.isActive()).toBe(false);
  });

  it('the port edit callbacks route through the lock-gated ops', () => {
    const engine = createFakeEngine();
    configure(engine, { frame: 3 });

    brushScriptEditionPort.moveStrokes([7, 9], 10, 5);
    brushScriptEditionPort.deleteStrokes([7]);
    brushScriptEditionPort.transformStrokes([7], TRANSFORM);
    brushScriptEditionPort.stepStroke(7, 'forward');

    expect(engine.moveStrokes).toHaveBeenCalledWith([7, 9], 10, 5);
    expect(engine.deleteStrokes).toHaveBeenCalledWith([7]);
    expect(engine.transformStrokes).toHaveBeenCalledWith([7], TRANSFORM);
    expect(engine.sendStrokeForward).toHaveBeenCalledWith(7);
  });
});

// 261024-mz5: one gesture edits the WHOLE selection — one engine commit,
// one retained-script flush, and the selection pruned by identity.
describe('261024-mz5 batch edits: one commit, one flush, selection pruned', () => {
  it('moveBrushScriptStrokes sends both ids in ONE engine call and flushes once', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [
        stroke(7, [{ x: 30, y: 35 }]),
        stroke(9, [{ x: 60, y: 35 }]),
      ]),
    });
    configure(engine, { frame: 3 });
    setScriptSelectMode(true);
    setScriptStrokeSelection([7, 9]);

    expect(moveBrushScriptStrokes([7, 9], 10, 5)).toBe(true);

    expect(engine.moveStrokes).toHaveBeenCalledTimes(1);
    expect(engine.moveStrokes).toHaveBeenCalledWith([7, 9], 10, 5);
    // One flush: the flush reads the engine's live strokes exactly once.
    expect(engine.getStrokes).toHaveBeenCalledTimes(1);
    expect(getBrushScriptFrameEntry(3)?.strokes).toBe(2);
    // A move keeps the selection.
    expect([...scriptSelectedStrokeIds.value].sort()).toEqual([7, 9]);
  });

  it('deleteBrushScriptStrokes removes every deleted id from the selection in one edit', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(9, [{ x: 60, y: 35 }])]),
    });
    configure(engine, { frame: 3 });
    setScriptSelectMode(true);
    setScriptStrokeSelection([7, 9, 11]);

    expect(deleteBrushScriptStrokes([7, 9])).toBe(true);

    expect(engine.deleteStrokes).toHaveBeenCalledTimes(1);
    expect(engine.deleteStrokes).toHaveBeenCalledWith([7, 9]);
    expect([...scriptSelectedStrokeIds.value]).toEqual([11]);
    expect(scriptSelectMode.value).toBe(true);
  });

  it('a refused batch (unknown ids) does not flush', () => {
    const engine = createFakeEngine({
      moveStrokes: vi.fn(() => 0),
      deleteStrokes: vi.fn(() => 0),
      transformStrokes: vi.fn(() => 0),
    });
    configure(engine, { frame: 3 });

    expect(moveBrushScriptStrokes([7, 9], 10, 5)).toBe(false);
    expect(deleteBrushScriptStrokes([7, 9])).toBe(false);
    expect(transformBrushScriptStrokes([7, 9], TRANSFORM)).toBe(false);
    expect(engine.getStrokes).not.toHaveBeenCalled();
  });

  it('transformBrushScriptStrokes sends both ids and the SAME transform in ONE engine call, then flushes once', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [
        stroke(7, [{ x: 30, y: 35 }]),
        stroke(9, [{ x: 60, y: 35 }]),
      ]),
    });
    configure(engine, { frame: 3 });
    setScriptSelectMode(true);
    setScriptStrokeSelection([7, 9]);

    expect(transformBrushScriptStrokes([7, 9], TRANSFORM)).toBe(true);

    expect(engine.transformStrokes).toHaveBeenCalledTimes(1);
    expect(engine.transformStrokes).toHaveBeenCalledWith([7, 9], TRANSFORM);
    // One flush: the retained script reads the engine's live strokes once.
    expect(engine.getStrokes).toHaveBeenCalledTimes(1);
    expect(getBrushScriptFrameEntry(3)?.strokes).toBe(2);
    // A transform keeps the selection, exactly like a move.
    expect([...scriptSelectedStrokeIds.value].sort()).toEqual([7, 9]);
  });
});

// 261024-p5q: the Stroke Settings dialog reads per-stroke appearance and
// writes it through ONE engine commit + ONE retained-script flush.
describe('261024-p5q appearance: held-frame read, one commit + one flush', () => {
  it('reads only the held frame and subscribes the store revision', () => {
    capture(3, [stroke(7, [{ x: 20, y: 30 }])]);
    const engine = createFakeEngine({
      getStrokeSerials: vi.fn(() => new Map([[7, 1]])),
      getStrokeAppearance: vi.fn(() => [
        { mutationId: 7, params: { ...OPTIONS, size: 33 }, color: '#ff0000' },
      ]),
    });
    configure(engine, { frame: 3 });

    let runs = 0;
    const dispose = effect(() => {
      void readBrushScriptStrokeAppearance([7], 3);
      runs += 1;
    });
    try {
      const before = runs;
      markBrushScriptFrameDirty(3);
      capture(3, [stroke(7, [{ x: 20, y: 30 }])]);
      expect(runs).toBe(before + 1);

      expect(readBrushScriptStrokeAppearance([7], 3)).toEqual([
        { mutationId: 7, params: { ...OPTIONS, size: 33 }, color: '#ff0000' },
      ]);
      expect(engine.getStrokeAppearance).toHaveBeenCalledWith([7]);
    } finally {
      dispose();
    }

    // Another frame holds nothing — the engine liveness gate refuses.
    expect(readBrushScriptStrokeAppearance([7], 4)).toEqual([]);
    // No context -> empty (the narrow-leaf read never throws).
    configureBrushScriptEdition(null);
    expect(readBrushScriptStrokeAppearance([7], 3)).toEqual([]);
  });

  it('applies through ONE engine call and flushes the frame ONCE', () => {
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [
        stroke(7, [{ x: 30, y: 35 }], '#abcdef'),
        stroke(9, [{ x: 60, y: 35 }], '#abcdef'),
      ]),
      setStrokeAppearance: vi.fn(() => 2),
    });
    configure(engine, { frame: 3 });

    expect(applyBrushScriptStrokeAppearance(
      [7, 9],
      { params: { size: 42 }, color: '#abcdef' },
    )).toBe(true);

    expect(engine.setStrokeAppearance).toHaveBeenCalledTimes(1);
    expect(engine.setStrokeAppearance).toHaveBeenCalledWith(
      [7, 9],
      { params: { size: 42 }, color: '#abcdef' },
    );
    expect(engine.setScriptBaseClearPending).toHaveBeenCalledWith(true);
    expect(engine.getStrokes).toHaveBeenCalledTimes(1);
    expect(getBrushScriptFrameEntry(3)?.strokes).toBe(2);
  });

  it('a locked context or a zero-change result performs no flush and returns false', () => {
    const engine = createFakeEngine({ setStrokeAppearance: vi.fn(() => 0) });
    configure(engine, { frame: 3 });

    expect(applyBrushScriptStrokeAppearance([7], { params: { size: 42 } })).toBe(false);
    expect(engine.setStrokeAppearance).toHaveBeenCalledTimes(1);
    expect(engine.getStrokes).not.toHaveBeenCalled();

    const locked = createFakeEngine();
    configure(locked, { frame: 3, locked: true });
    expect(applyBrushScriptStrokeAppearance([7], { color: '#abcdef' })).toBe(false);
    expect(locked.setStrokeAppearance).not.toHaveBeenCalled();
    expect(locked.setScriptBaseClearPending).not.toHaveBeenCalled();

    configureBrushScriptEdition(null);
    expect(applyBrushScriptStrokeAppearance([7], { color: '#abcdef' })).toBe(false);
  });

  it('refuses an empty id list or an empty patch before touching the engine', () => {
    const engine = createFakeEngine();
    configure(engine, { frame: 3 });

    expect(applyBrushScriptStrokeAppearance([], { params: { size: 42 } })).toBe(false);
    expect(applyBrushScriptStrokeAppearance([7], {})).toBe(false);
    expect(applyBrushScriptStrokeAppearance([7], { params: {} })).toBe(false);

    expect(engine.setStrokeAppearance).not.toHaveBeenCalled();
    expect(engine.setScriptBaseClearPending).not.toHaveBeenCalled();
  });
});

// ============================================================
//  quick 261024-vga Task 2 — exact stack placement through the
//  ONE script-edition seam. The boolean is the whole refusal
//  channel: the dialog's ref-held sync nonce re-syncs the
//  readout, so the port adds no extra signal or callback.
// ============================================================

describe('261024-vga placeBrushScriptStroke', () => {
  it('calls the engine ONCE with (mutationId, positionFromTop), declares the base and flushes ONCE', () => {
    capture(3, [stroke(7, [{ x: 30, y: 35 }])]);
    const entryBefore = getBrushScriptFrameEntry(3);
    markBrushScriptFrameDirty(3);
    const engine = createFakeEngine({
      getStrokes: vi.fn(() => [stroke(7, [{ x: 30, y: 35 }])]),
    });
    configure(engine, { frame: 3 });

    expect(placeBrushScriptStroke(7, 1)).toBe(true);

    expect(engine.moveStrokeToStackPosition).toHaveBeenCalledTimes(1);
    expect(engine.moveStrokeToStackPosition).toHaveBeenCalledWith(7, 1);
    expect(engine.setScriptBaseClearPending).toHaveBeenCalledWith(true);
    expect(engine.getStrokes).toHaveBeenCalledTimes(1);
    expect(getBrushScriptFrameEntry(3)).not.toBe(entryBefore);
  });

  it('a refused placement performs no flush and returns false', () => {
    capture(3, [stroke(7, [{ x: 30, y: 35 }])]);
    const entryBefore = getBrushScriptFrameEntry(3);
    const engine = createFakeEngine({
      moveStrokeToStackPosition: vi.fn(() => false),
      getStrokes: vi.fn(() => [stroke(7, [{ x: 30, y: 35 }])]),
    });
    configure(engine, { frame: 3 });

    expect(placeBrushScriptStroke(7, 3)).toBe(false);

    expect(engine.moveStrokeToStackPosition).toHaveBeenCalledWith(7, 3);
    expect(engine.getStrokes).not.toHaveBeenCalled();
    expect(getBrushScriptFrameEntry(3)).toBe(entryBefore);
  });

  it('a locked context performs no engine call and no flush', () => {
    const engine = createFakeEngine();
    configure(engine, { frame: 3, locked: true });

    expect(placeBrushScriptStroke(7, 1)).toBe(false);

    expect(engine.moveStrokeToStackPosition).not.toHaveBeenCalled();
    expect(engine.setScriptBaseClearPending).not.toHaveBeenCalled();
    expect(engine.getStrokes).not.toHaveBeenCalled();
  });

  it('no context and no engine return false without touching anything', () => {
    expect(placeBrushScriptStroke(7, 1)).toBe(false);

    configureBrushScriptEdition({
      getEngine: () => null,
      getPlayFrame: () => 3,
      isActive: () => true,
      isLocked: () => false,
    });
    expect(placeBrushScriptStroke(7, 1)).toBe(false);
  });
});
