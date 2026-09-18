import { describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from './EfxPaintEngine';

// 52.1 first-open double apply ([da52] trace): on first Studio open the
// reference/preview-base decode lands mid-burst and applyPreviewBaseImage →
// redrawAll replayed the WHOLE scripted burst synchronously (~14s blocked,
// all-at-once), then the scheduled drain rendered the same 35 strokes again
// live. Strokes still queued for finalization belong to the drain — redrawAll
// must replay only the finalized prefix of allActions. The one in-flight
// stroke stays in the replay: the surface reset wipes its partial wet pixels,
// so skipping it would orphan its continuation state (pre-existing quirk).

function makeStroke(tool: string, mutationId: number) {
  return { tool, points: [{ x: 1, y: 1 }], color: '#000', params: {}, mutationId };
}

function makePending(mutationId: number, actionCount: number) {
  return {
    tool: 'paint',
    points: [],
    color: '#000',
    opts: {},
    hasPenInput: false,
    physicsMode: null,
    continuationFrames: 0,
    mutationId,
    queuedAt: 0,
    actionCount,
    isScripted: true,
  };
}

function makeEngine(overrides: Record<string, unknown> = {}) {
  const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine & Record<string, any>;
  Object.assign(engine, {
    width: 8,
    height: 6,
    paperHeight: new Float32Array(64),
    allActions: [],
    pendingStrokeFinalizations: [],
    activeStrokeFinalization: null,
    resetReplaySurface: vi.fn(),
    applyStrokeToEngine: vi.fn(),
    replayDiffusion: vi.fn(),
    renderVisibleWetLayer: vi.fn(),
    strokeHasPenInput: vi.fn(() => false),
    ...overrides,
  });
  return engine;
}

describe('EfxPaintEngine redrawAll queued-finalization skip (52.1 first-open double apply)', () => {
  it('replays only the finalized prefix — queued strokes stay owned by the drain', () => {
    const finalized = makeStroke('paint', 1);
    const queuedPrimary = makeStroke('erase', 2);
    // A scripted group can cover TWO allActions slots (primary + zero-point
    // diffusion continuation) — the skip counts actions, not pendings.
    const queuedContinuation = makeStroke('erase', 2);
    const engine = makeEngine({
      allActions: [finalized, queuedPrimary, queuedContinuation],
      pendingStrokeFinalizations: [makePending(2, 2)],
    });

    engine.redrawAll();

    expect(engine.applyStrokeToEngine).toHaveBeenCalledTimes(1);
    expect(engine.applyStrokeToEngine.mock.calls[0][0]).toBe('paint');
    expect(engine.applyStrokeToEngine.mock.calls[0][1]).toBe(finalized.points);
    expect(engine.pendingStrokeFinalizations).toHaveLength(1);
    expect(engine.renderVisibleWetLayer).toHaveBeenCalledTimes(1);
  });

  it('keeps the in-flight stroke in the replay (continuation state would orphan)', () => {
    const finalized = makeStroke('paint', 1);
    const activeStroke = makeStroke('erase', 2);
    const activePending = makePending(2, 1);
    const engine = makeEngine({
      allActions: [finalized, activeStroke],
      pendingStrokeFinalizations: [activePending],
      activeStrokeFinalization: { pending: activePending },
    });

    engine.redrawAll();

    expect(engine.applyStrokeToEngine).toHaveBeenCalledTimes(2);
  });

  it('replays everything when nothing is queued (normal path unchanged)', () => {
    const engine = makeEngine({
      allActions: [makeStroke('paint', 1), makeStroke('erase', 2)],
    });

    engine.redrawAll();

    expect(engine.applyStrokeToEngine).toHaveBeenCalledTimes(2);
  });

  it('replays nothing when every stroke is still queued (the full scripted burst)', () => {
    const engine = makeEngine({
      allActions: [makeStroke('paint', 1), makeStroke('erase', 2)],
      pendingStrokeFinalizations: [makePending(1, 1), makePending(2, 1)],
    });

    engine.redrawAll();

    expect(engine.applyStrokeToEngine).not.toHaveBeenCalled();
    expect(engine.renderVisibleWetLayer).toHaveBeenCalledTimes(1);
  });
});
