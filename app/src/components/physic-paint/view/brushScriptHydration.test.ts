// ============================================================
//  brushScriptHydration.test.ts — RED-first contract for the
//  navigation rehydration policy (quick 261023-h9v, reworked by
//  261023-j5b).
//
//  LAW: only a COMPLETE retained script may attach to the engine's
//  ledger, and only on a real-key arrival, in Brush mode, while
//  idle (not playing, not scrubbing), and within the generous
//  attach (clone) sanity cap. Navigation ATTACHES SILENTLY — no
//  stroke replay. Every refusal is fail-closed: the caller keeps
//  today's cached-pixel path and the engine is never touched.
//
//  A structural fake engine stands in for EfxPaintEngine — this
//  module is DOM-free and must stay that way.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrushOpts, PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import {
  captureBrushScriptForFrame,
  configureBrushScriptKeyProvider,
  getBrushScriptFrameEntry,
  markBrushScriptFrameDirty,
  noteBrushScriptArrivalBase,
  resetBrushScriptStore,
} from './brushScriptRecordState';
import {
  applyCompletedBrushMutation,
  attemptBrushScriptHydration,
  attemptBrushScriptHydrationOverBase,
  engineHoldsBrushScriptFrame,
  isBrushScriptFrameHydratable,
  MAX_ATTACH_POINTS,
  MAX_ATTACH_STROKES,
  MAX_EDITABLE_DIFFUSION_FRAMES,
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
  keyId: 'key-3',
  brushModuleActive: true,
  wasPlaying: false,
  scrubActive: false,
};

function request(overrides: Partial<BrushHydrationRequest> = {}): BrushHydrationRequest {
  return { ...IDLE_REQUEST, ...overrides };
}

function createFakeEngine(options: {
  attachResult?: number;
  serials?: Map<number, number>;
  strokes?: PaintStroke[];
} = {}) {
  const strokes = options.strokes ?? [];
  return {
    attachStrokesBaseline: vi.fn(() => options.attachResult ?? 1),
    getStrokeSerials: vi.fn(() => options.serials ?? new Map<number, number>()),
    getStrokes: vi.fn(() => strokes),
    setScriptBaseClearPending: vi.fn(),
    rebakeStrokesFaithfully: vi.fn(() => options.attachResult ?? 1),
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
  configureBrushScriptKeyProvider((frame) => `key-${frame}`);
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

  it('attempt ATTACHES the stored groups silently — it never calls restoreStrokesBaseline', () => {
    captureComplete(3);
    const engine = createFakeEngine({ attachResult: 1 });
    const stored = getBrushScriptFrameEntry(3)!;

    expect(attemptBrushScriptHydration(engine, request())).toBe(true);
    expect(engine.attachStrokesBaseline).toHaveBeenCalledTimes(1);
    expect(engine.attachStrokesBaseline).toHaveBeenCalledWith(stored.groups, null);
    expect((engine as unknown as Record<string, unknown>).restoreStrokesBaseline).toBeUndefined();
  });

  // 261023-j5b: the attach carries the frame's captured paint globals so the
  // first faithful edit rebake replays with the painted look.
  it("forwards the entry's paintSettings snapshot to the attach", () => {
    const settings = {
      localSpreadStrength: 30,
      wetPaper: true,
      physicsStrength: 0.6,
      paperGrain: 'grainA',
    };
    captureBrushScriptForFrame(
      3,
      [{ primary: stroke(1), continuations: [] }],
      undefined,
      settings,
    );
    const engine = createFakeEngine({ attachResult: 1 });

    expect(attemptBrushScriptHydration(engine, request())).toBe(true);
    expect(engine.attachStrokesBaseline).toHaveBeenCalledWith(getBrushScriptFrameEntry(3)!.groups, settings);
  });
});

describe('plan: every refusal is fail-closed', () => {
  it('refuses a missing entry', () => {
    const engine = createFakeEngine();
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'no-entry' });
    expect(attemptBrushScriptHydration(engine, request())).toBe(false);
    expect(engine.attachStrokesBaseline).not.toHaveBeenCalled();
  });

  it('refuses a partial entry without a carried base (never replace cached pixels with a partial script)', () => {
    noteBrushScriptArrivalBase(3, true);
    captureComplete(3);
    const engine = createFakeEngine();
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'partial' });
    expect(attemptBrushScriptHydration(engine, request())).toBe(false);
    expect(engine.attachStrokesBaseline).not.toHaveBeenCalled();
  });

describe('plan: a partial ledger over a carried durable base (261027 UAT round 11)', () => {
  const BASE = new Uint8Array([1, 2, 3]);

  function capturePartial(): void {
    noteBrushScriptArrivalBase(3, true);
    captureComplete(3);
  }

  it('hydrates a partial entry when the key carries its pre-script base', () => {
    capturePartial();
    const decision = planBrushScriptHydration(request({ durableBaseBytes: BASE }));
    expect(decision.hydrate).toBe(true);
    if (decision.hydrate) expect(decision.preserveBase).toBe(true);
  });

  it('keeps the plain attach for a complete entry (never preserves a base)', () => {
    captureComplete(3);
    const engine = createFakeEngine({ attachResult: 1 });
    const decision = planBrushScriptHydration(request({ durableBaseBytes: BASE }));
    expect(decision.hydrate).toBe(true);
    if (decision.hydrate) expect(decision.preserveBase).toBe(false);
    expect(attemptBrushScriptHydration(engine, request({ durableBaseBytes: BASE }))).toBe(true);
    expect(attemptBrushScriptHydrationOverBase(engine, request({ durableBaseBytes: BASE }))).toBe(false);
  });

  it('refuses the over-base seam without a base and never attaches', () => {
    capturePartial();
    const engine = createFakeEngine({ attachResult: 1 });
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'partial' });
    expect(attemptBrushScriptHydrationOverBase(engine, request())).toBe(false);
    expect(engine.attachStrokesBaseline).not.toHaveBeenCalled();
  });

  it('attaches over the base, keeps it through the first rebake, and replays the strokes', () => {
    capturePartial();
    const engine = {
      ...createFakeEngine({ attachResult: 2 }),
      setScriptBaseClearPending: vi.fn(),
      rebakeStrokesFaithfully: vi.fn(() => 2),
    };
    expect(attemptBrushScriptHydrationOverBase(engine, request({ durableBaseBytes: BASE }))).toBe(true);
    expect(engine.attachStrokesBaseline).toHaveBeenCalledTimes(1);
    expect(engine.setScriptBaseClearPending).toHaveBeenCalledWith(false);
    expect(engine.rebakeStrokesFaithfully).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the engine refuses the baseline', () => {
    capturePartial();
    const engine = {
      ...createFakeEngine({ attachResult: 0 }),
      setScriptBaseClearPending: vi.fn(),
      rebakeStrokesFaithfully: vi.fn(() => 0),
    };
    expect(attemptBrushScriptHydrationOverBase(engine, request({ durableBaseBytes: BASE }))).toBe(false);
    expect(engine.setScriptBaseClearPending).not.toHaveBeenCalled();
    expect(engine.rebakeStrokesFaithfully).not.toHaveBeenCalled();
  });
});

  // quick-261026-odd (empty-script gate): a script follows KEY identity. A
  // legacy null-keyId row and a row captured on a replaced key both refuse —
  // the engine stays empty and the cached pixels keep rendering (no dead
  // Move outlines over content the cell does not own).
  it('refuses an entry with no key identity (legacy v1 row)', () => {
    configureBrushScriptKeyProvider(null);
    captureComplete(3);
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'foreign-key' });
  });

  it('refuses an entry captured on a different key', () => {
    captureComplete(3);
    const engine = createFakeEngine();
    expect(planBrushScriptHydration(request({ keyId: 'key-replaced' }))).toEqual({ hydrate: false, reason: 'foreign-key' });
    expect(planBrushScriptHydration(request({ keyId: null }))).toEqual({ hydrate: false, reason: 'foreign-key' });
    expect(attemptBrushScriptHydration(engine, request({ keyId: 'key-replaced' }))).toBe(false);
    expect(engine.attachStrokesBaseline).not.toHaveBeenCalled();
  });

  it('an empty capture stores no entry, so hydration refuses with no-entry', () => {
    captureBrushScriptForFrame(3, []);
    expect(getBrushScriptFrameEntry(3)).toBeUndefined();
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'no-entry' });
  });

  it('refuses generated, none and no-launch destinations', () => {
    captureComplete(3);
    const engine = createFakeEngine();
    for (const destinationKind of ['generated', 'none', 'no-launch']) {
      expect(planBrushScriptHydration(request({ destinationKind }))).toEqual({ hydrate: false, reason: 'generated' });
      expect(attemptBrushScriptHydration(engine, request({ destinationKind }))).toBe(false);
    }
    expect(engine.attachStrokesBaseline).not.toHaveBeenCalled();
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

  it('attaches a frame with MANY strokes — navigation is no longer replay-budgeted', () => {
    // h9v refused anything above 10 strokes / 600 points. Navigation now only
    // clones; the old "over-budget" frame must attach.
    captureComplete(
      3,
      Array.from({ length: 40 }, (_, index) => stroke(index + 1, 180)),
    );
    expect(planBrushScriptHydration(request()).hydrate).toBe(true);
  });

  it('refuses over the attach sanity cap (clone cost only)', () => {
    captureComplete(3, [stroke(1, MAX_ATTACH_POINTS + 1)]);
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'edit-cost' });

    captureComplete(
      3,
      Array.from({ length: MAX_ATTACH_STROKES + 1 }, (_, index) => stroke(index + 1, 1)),
    );
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'edit-cost' });
  });

  // 261023-j5b Task 3: a physics-run frame's faithful rebake replays solver
  // frames (~700 ms each at HD) — it stays fail-closed on cached pixels.
  it('refuses a frame carrying any diffusion continuation (unaffordable rebake)', () => {
    captureBrushScriptForFrame(3, [
      { primary: stroke(1), continuations: [continuation(1, 1)] },
    ]);
    expect(getBrushScriptFrameEntry(3)?.diffusionFrames).toBe(1);
    expect(planBrushScriptHydration(request())).toEqual({ hydrate: false, reason: 'edit-cost' });
    expect(attemptBrushScriptHydration(createFakeEngine(), request())).toBe(false);
  });

  it('accepts exactly at the attach sanity boundary', () => {
    captureComplete(
      3,
      Array.from({ length: MAX_ATTACH_STROKES }, (_, index) =>
        stroke(index + 1, MAX_ATTACH_POINTS / MAX_ATTACH_STROKES),
      ),
    );
    expect(getBrushScriptFrameEntry(3)?.points).toBe(MAX_ATTACH_POINTS);
    expect(planBrushScriptHydration(request()).hydrate).toBe(true);
  });

  it('reports hydrated false when the engine refuses the attach (validation refusal)', () => {
    captureComplete(3);
    const engine = createFakeEngine({ attachResult: 0 });
    expect(attemptBrushScriptHydration(engine, request())).toBe(false);
    expect(engine.attachStrokesBaseline).toHaveBeenCalledTimes(1);
  });
});

describe('isBrushScriptFrameHydratable — the probe verdict', () => {
  const within = { strokes: 1, points: 10, diffusionFrames: 0 };

  it('is true only for a complete row within every ceiling', () => {
    expect(isBrushScriptFrameHydratable({ ...within, complete: true })).toBe(true);
    expect(isBrushScriptFrameHydratable({ ...within, complete: false })).toBe(false);
  });

  it('is false when any attach sanity ceiling is exceeded', () => {
    expect(isBrushScriptFrameHydratable({
      complete: true,
      ...within,
      strokes: MAX_ATTACH_STROKES + 1,
    })).toBe(false);
    expect(isBrushScriptFrameHydratable({
      complete: true,
      ...within,
      points: MAX_ATTACH_POINTS + 1,
    })).toBe(false);
  });

  it('accepts the boundary values exactly', () => {
    expect(isBrushScriptFrameHydratable({
      complete: true,
      strokes: MAX_ATTACH_STROKES,
      points: MAX_ATTACH_POINTS,
      diffusionFrames: 0,
    })).toBe(true);
  });

  it('is false for any diffusion frame — the SAME gate the live policy applies', () => {
    expect(isBrushScriptFrameHydratable({
      ...within,
      complete: true,
      diffusionFrames: MAX_EDITABLE_DIFFUSION_FRAMES + 1,
    })).toBe(false);
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
