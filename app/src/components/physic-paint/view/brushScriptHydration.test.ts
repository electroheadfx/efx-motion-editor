// ============================================================
//  brushScriptHydration.test.ts — RED-first contract for the
//  navigation rehydration policy (quick 261023-h9v).
//
//  LAW: only a COMPLETE retained script may replace the engine's
//  strokes, and only on a real-key arrival, in Brush mode, while
//  idle (not playing, not scrubbing), and within the documented
//  serialized-cost budget. Every refusal is fail-closed: the caller
//  keeps today's cached-pixel path and the engine is never touched.
//
//  A structural fake engine stands in for EfxPaintEngine — this
//  module is DOM-free and must stay that way.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrushOpts, PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import {
  captureBrushScriptForFrame,
  getBrushScriptFrameEntry,
  markBrushScriptFrameDirty,
  noteBrushScriptArrivalBase,
  resetBrushScriptStore,
} from './brushScriptRecordState';
import {
  applyCompletedBrushMutation,
  attemptBrushScriptHydration,
  engineHoldsBrushScriptFrame,
  isBrushScriptFrameHydratable,
  MAX_HYDRATION_DIFFUSION_FRAMES,
  MAX_HYDRATION_POINTS,
  MAX_HYDRATION_STROKES,
  planBrushScriptHydration,
  type BrushHydrationRequest,
} from './brushScriptHydration';

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

function stroke(mutationId: number, pointCount = 2): PaintStroke {
  return {
    tool: 'paint',
    points: Array.from({ length: pointCount }, (_, index) => point(index, index)),
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

const IDLE_REQUEST: BrushHydrationRequest = {
  frame: 3,
  destinationKind: 'real',
  brushModuleActive: true,
  wasPlaying: false,
  scrubActive: false,
};

function request(overrides: Partial<BrushHydrationRequest> = {}): BrushHydrationRequest {
  return { ...IDLE_REQUEST, ...overrides };
}

function createFakeEngine(options: {
  restoreResult?: number;
  serials?: Map<number, number>;
  strokes?: PaintStroke[];
} = {}) {
  const strokes = options.strokes ?? [];
  return {
    restoreStrokesBaseline: vi.fn(() => options.restoreResult ?? 1),
    getStrokeSerials: vi.fn(() => options.serials ?? new Map<number, number>()),
    getStrokes: vi.fn(() => strokes),
  };
}

function captureComplete(frame: number, strokes: PaintStroke[] = [stroke(1)]): void {
  captureBrushScriptForFrame(
    frame,
    strokes.map((entry) => ({ primary: entry, continuations: [] })),
  );
}

beforeEach(() => {
  resetBrushScriptStore();
});

describe('plan: the happy path', () => {
  it('hydrates a complete real-key entry while idle in Brush mode', () => {
    captureComplete(3);
    const decision = planBrushScriptHydration(request());

    expect(decision.hydrate).toBe(true);
    if (decision.hydrate) {
      expect(decision.entry.frame).toBe(3);
      expect(decision.entry.complete).toBe(true);
    }
  });

  it('attempt calls restoreStrokesBaseline exactly once with the stored groups', () => {
    captureComplete(3);
    const engine = createFakeEngine({ restoreResult: 1 });
    const stored = getBrushScriptFrameEntry(3)!;

    expect(attemptBrushScriptHydration(engine, request())).toBe(true);
    expect(engine.restoreStrokesBaseline).toHaveBeenCalledTimes(1);
    expect(engine.restoreStrokesBaseline).toHaveBeenCalledWith(stored.groups);
  });
});

describe('plan: every refusal is fail-closed', () => {
  it('refuses a missing entry', () => {
    const engine = createFakeEngine();
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'no-entry' });
    expect(attemptBrushScriptHydration(engine, request())).toBe(false);
    expect(engine.restoreStrokesBaseline).not.toHaveBeenCalled();
  });

  it('refuses a partial entry (never replace cached pixels with a partial script)', () => {
    noteBrushScriptArrivalBase(3, true);
    captureComplete(3);
    const engine = createFakeEngine();
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'partial' });
    expect(attemptBrushScriptHydration(engine, request())).toBe(false);
    expect(engine.restoreStrokesBaseline).not.toHaveBeenCalled();
  });

  it('refuses an empty projection even when the entry says complete', () => {
    captureBrushScriptForFrame(3, []);
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'empty' });
  });

  it('refuses generated, none and no-launch destinations', () => {
    captureComplete(3);
    const engine = createFakeEngine();
    for (const destinationKind of ['generated', 'none', 'no-launch']) {
      expect(planBrushScriptHydration(request({ destinationKind }))).toEqual({ hydrate: false, reason: 'generated' });
      expect(attemptBrushScriptHydration(engine, request({ destinationKind }))).toBe(false);
    }
    expect(engine.restoreStrokesBaseline).not.toHaveBeenCalled();
  });

  it('refuses Water color mode', () => {
    captureComplete(3);
    expect(planBrushScriptHydration(request({ brushModuleActive: false }))).toEqual({ hydrate: false, reason: 'watercolor' });
  });

  it('refuses during playback and during a ruler scrub', () => {
    captureComplete(3);
    expect(planBrushScriptHydration(request({ wasPlaying: true }))).toEqual({ hydrate: false, reason: 'playback' });
    expect(planBrushScriptHydration(request({ scrubActive: true }))).toEqual({ hydrate: false, reason: 'scrub' });
  });

  it('refuses over the points budget', () => {
    captureComplete(3, [stroke(1, MAX_HYDRATION_POINTS + 1)]);
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'budget' });
  });

  it('refuses over the stroke budget (the per-stroke replay cost driver)', () => {
    captureComplete(
      3,
      Array.from({ length: MAX_HYDRATION_STROKES + 1 }, (_, index) => stroke(index + 1, 1)),
    );
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'budget' });
  });

  it('refuses any diffusion run (the measured cap is zero at HD)', () => {
    captureBrushScriptForFrame(3, [{
      primary: stroke(1),
      continuations: [continuation(1, MAX_HYDRATION_DIFFUSION_FRAMES + 1)],
    }]);
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'budget' });
  });

  it('accepts exactly at the documented budget boundary', () => {
    captureComplete(
      3,
      Array.from({ length: MAX_HYDRATION_STROKES }, (_, index) =>
        stroke(index + 1, MAX_HYDRATION_POINTS / MAX_HYDRATION_STROKES),
      ),
    );
    // 10 strokes x 60 points is the measured light fixture (~200-233 ms at HD).
    expect(getBrushScriptFrameEntry(3)?.points).toBe(MAX_HYDRATION_POINTS);
    expect(getBrushScriptFrameEntry(3)?.diffusionFrames).toBe(0);
    expect(planBrushScriptHydration(request()).hydrate).toBe(true);
  });

  it('reports hydrated false when the engine refuses the restore (validation refusal)', () => {
    captureComplete(3);
    const engine = createFakeEngine({ restoreResult: 0 });
    expect(attemptBrushScriptHydration(engine, request())).toBe(false);
    expect(engine.restoreStrokesBaseline).toHaveBeenCalledTimes(1);
  });
});

describe('isBrushScriptFrameHydratable — the probe verdict', () => {
  const within = { strokes: 1, points: 10, diffusionFrames: 0 };

  it('is true only for a complete row within every ceiling', () => {
    expect(isBrushScriptFrameHydratable({ ...within, complete: true })).toBe(true);
    expect(isBrushScriptFrameHydratable({ ...within, complete: false })).toBe(false);
  });

  it('is false when any measured ceiling is exceeded', () => {
    expect(isBrushScriptFrameHydratable({
      complete: true,
      ...within,
      strokes: MAX_HYDRATION_STROKES + 1,
    })).toBe(false);
    expect(isBrushScriptFrameHydratable({
      complete: true,
      ...within,
      points: MAX_HYDRATION_POINTS + 1,
    })).toBe(false);
    expect(isBrushScriptFrameHydratable({
      complete: true,
      ...within,
      diffusionFrames: MAX_HYDRATION_DIFFUSION_FRAMES + 1,
    })).toBe(false);
  });

  it('accepts the boundary values exactly', () => {
    expect(isBrushScriptFrameHydratable({
      complete: true,
      strokes: MAX_HYDRATION_STROKES,
      points: MAX_HYDRATION_POINTS,
      diffusionFrames: MAX_HYDRATION_DIFFUSION_FRAMES,
    })).toBe(true);
  });
});

describe('engineHoldsBrushScriptFrame', () => {
  it('is true only when every stored primary mutationId is live in the engine', () => {
    captureComplete(3, [stroke(7), stroke(9)]);
    const engine = createFakeEngine({ serials: new Map([[7, 1], [9, 2]]) });
    expect(engineHoldsBrushScriptFrame(engine, 3)).toBe(true);

    const missingOne = createFakeEngine({ serials: new Map([[7, 1]]) });
    expect(engineHoldsBrushScriptFrame(missingOne, 3)).toBe(false);

    const clearedEngine = createFakeEngine({ serials: new Map() });
    expect(engineHoldsBrushScriptFrame(clearedEngine, 3)).toBe(false);
  });

  it('is independent of completeness (a live partial entry still holds its strokes)', () => {
    noteBrushScriptArrivalBase(3, true);
    captureComplete(3);
    const engine = createFakeEngine({ serials: new Map([[1, 1]]) });
    expect(engineHoldsBrushScriptFrame(engine, 3)).toBe(true);
  });

  it('is false for an absent frame or a missing engine', () => {
    captureComplete(3);
    expect(engineHoldsBrushScriptFrame(createFakeEngine({ serials: new Map([[1, 1]]) }), 4)).toBe(false);
    expect(engineHoldsBrushScriptFrame(null, 3)).toBe(false);
  });
});

describe('applyCompletedBrushMutation — the completion-listener law', () => {
  it('never writes or deletes on an engine clear', () => {
    captureComplete(3);
    const entry = getBrushScriptFrameEntry(3);
    const engine = createFakeEngine({ strokes: [] });

    applyCompletedBrushMutation('clear', 3, engine);

    expect(getBrushScriptFrameEntry(3)).toBe(entry);
    expect(engine.getStrokes).not.toHaveBeenCalled();
  });

  it('only marks the frame for paint/move/erase/physics completions', () => {
    captureComplete(3);
    const entry = getBrushScriptFrameEntry(3);
    const engine = createFakeEngine({ strokes: [stroke(2)] });

    for (const kind of ['paint', 'move', 'erase', 'physics'] as const) {
      applyCompletedBrushMutation(kind, 3, engine);
    }

    // No projection yet: the captured entry identity is untouched.
    expect(getBrushScriptFrameEntry(3)).toBe(entry);
    expect(engine.getStrokes).not.toHaveBeenCalled();
  });

  it('marks and flushes from the completing engine for undo and redo', () => {
    captureComplete(3);
    const first = getBrushScriptFrameEntry(3);
    const undoEngine = createFakeEngine({ strokes: [stroke(8)] });

    applyCompletedBrushMutation('undo', 3, undoEngine);
    expect(undoEngine.getStrokes).toHaveBeenCalledTimes(1);
    expect(getBrushScriptFrameEntry(3)).not.toBe(first);
    expect(getBrushScriptFrameEntry(3)?.groups.map((group) => group.primary.mutationId)).toEqual([8]);

    const redoEngine = createFakeEngine({ strokes: [stroke(9)] });
    applyCompletedBrushMutation('redo', 3, redoEngine);
    expect(redoEngine.getStrokes).toHaveBeenCalledTimes(1);
    expect(getBrushScriptFrameEntry(3)?.groups.map((group) => group.primary.mutationId)).toEqual([9]);
  });

  it('an emptied engine projects an empty script (the entry is dropped)', () => {
    captureComplete(3);
    markBrushScriptFrameDirty(3);
    applyCompletedBrushMutation('undo', 3, createFakeEngine({ strokes: [] }));
    expect(getBrushScriptFrameEntry(3)).toBeUndefined();
  });
});
