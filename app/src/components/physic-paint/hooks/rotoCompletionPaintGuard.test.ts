import { describe, expect, it, vi } from 'vitest';
import type { CompletedPaintMutation, PaintStroke } from '../types/paintCore';
import type { RotoPreviewBasePort } from '../roto/rotoCoordinatorPorts';
import { armRotoCompletionPaintGuard } from './rotoCompletionPaintGuard';
import { createRotoReferenceLoader } from './useRotoReferenceController';
import { getFrameBlobUrl } from './useRotoReferenceController';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

// regression-refresh-multi-paint: the acceptance reconcile paint is the FINAL
// preview-base paint of a multi-stroke completion. When its cache-miss decode
// is superseded inside the decode window, the engine drops it and no later
// paint is issued — the canvas keeps the pre-apply image until an unrelated
// repaint. The completion guard watches the settle outcome and repairs exactly
// once via a reload that lands as a synchronous cache-hit apply.

interface MockEngine {
  applied: string | null;
  appliedGeneration: number | null;
  listeners: Array<(dataUrl: string, outcome: 'applied' | 'dropped', generation?: number) => void>;
  getAppliedPreviewBaseDataUrl: () => string | null;
  getAppliedPreviewBaseGeneration: () => number | null;
  onPreviewBaseSettled: (listener: (dataUrl: string, outcome: 'applied' | 'dropped', generation?: number) => void) => () => void;
  settle: (dataUrl: string, outcome: 'applied' | 'dropped') => void;
}

function makeMockEngine(applied: string | null = null, appliedGeneration: number | null = null): MockEngine {
  const engine: MockEngine = {
    applied,
    appliedGeneration,
    listeners: [],
    getAppliedPreviewBaseDataUrl() { return engine.applied; },
    getAppliedPreviewBaseGeneration() { return engine.appliedGeneration; },
    onPreviewBaseSettled(listener) {
      engine.listeners.push(listener);
      return () => { engine.listeners = engine.listeners.filter((entry) => entry !== listener); };
    },
    settle(dataUrl, outcome) {
      if (outcome === 'applied') { engine.applied = dataUrl; }
      for (const listener of [...engine.listeners]) listener(dataUrl, outcome);
    },
  };
  return engine;
}

const INTENDED = 'data:image/png;base64,committed';

/** An accepted stroke under the app-owned paint-core contract (engine-1 gone). */
const PAINT_STROKE: PaintStroke = {
  tool: 'paint',
  points: [{ x: 0.1, y: 0.2, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 }],
  color: '#000000',
  params: {
    size: 8,
    opacity: 80,
    pressure: 100,
    waterAmount: 30,
    dryAmount: 20,
    edgeDetail: 50,
    pickup: 10,
    eraseStrength: 0,
    antiAlias: 2,
  },
  timestamp: 10,
};

describe('armRotoCompletionPaintGuard', () => {
  it('does nothing when the intended paint already landed (cache-hit apply)', () => {
    const engine = makeMockEngine(INTENDED);
    const reload = vi.fn();
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => 8,
      reload,
    });
    expect(engine.listeners.length).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing without an engine, an intended dataUrl, or the engine settle APIs', () => {
    const reload = vi.fn();
    armRotoCompletionPaintGuard({ engine: null, appFrame: 8, intendedDataUrl: INTENDED, intendedBytes: testWebpBytes('guard'), getCurrentAppFrame: () => 8, reload });
    armRotoCompletionPaintGuard({ engine: makeMockEngine(), appFrame: 8, intendedDataUrl: null, intendedBytes: testWebpBytes('guard'), getCurrentAppFrame: () => 8, reload });
    armRotoCompletionPaintGuard({ engine: {}, appFrame: 8, intendedDataUrl: INTENDED, intendedBytes: testWebpBytes('guard'), getCurrentAppFrame: () => 8, reload });
    expect(reload).not.toHaveBeenCalled();
  });

  it('repairs once when the completion decode is dropped and stops after the repair lands', () => {
    const engine = makeMockEngine();
    const log = vi.fn();
    const reload = vi.fn(() => {
      // The repair reload lands as a synchronous cache-hit apply.
      engine.applied = INTENDED;
    });
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => 8,
      reload,
      log,
    });
    expect(engine.listeners.length).toBe(1);

    engine.settle(INTENDED, 'dropped');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith(8, testWebpBytes('guard'), 0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(engine.listeners.length, 'the guard disarms after the repair lands').toBe(0);

    engine.settle(INTENDED, 'applied');
    expect(reload, 'no further repairs after convergence').toHaveBeenCalledTimes(1);
  });

  it('stands down when the applied base matches the intent at settle time', () => {
    const engine = makeMockEngine();
    const reload = vi.fn();
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => 8,
      reload,
    });
    engine.applied = INTENDED; // a concurrent same-dataUrl paint landed first
    engine.settle(INTENDED, 'dropped');
    expect(reload).not.toHaveBeenCalled();
    expect(engine.listeners.length).toBe(0);
  });

  it('stands down when the cursor moved — navigation owns the canvas', () => {
    const engine = makeMockEngine();
    const reload = vi.fn();
    let currentFrame = 8;
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => currentFrame,
      reload,
    });
    currentFrame = 3;
    engine.settle(INTENDED, 'dropped');
    expect(reload).not.toHaveBeenCalled();
    expect(engine.listeners.length).toBe(0);
  });

  it('ignores dropped settles for unrelated requests', () => {
    const engine = makeMockEngine();
    const reload = vi.fn();
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => 8,
      reload,
    });
    engine.settle('data:image/png;base64,other', 'dropped');
    expect(reload).not.toHaveBeenCalled();
    expect(engine.listeners.length, 'still armed for the intended settle').toBe(1);
  });

  it('repairs when a different frame is applied over the guarded frame while the cursor holds', () => {
    const engine = makeMockEngine();
    const reload = vi.fn(() => { engine.applied = INTENDED; });
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => 8,
      reload,
    });
    engine.settle('data:image/png;base64,stale-frame', 'applied');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not repair when a NEWER generation already settled over the guard (inverted-race smoking gun)', () => {
    // The correct (newest-generation) completion paint is VISIBLE — the
    // applied generation (12) is newer than the guarded intent (7). A dropped
    // settle of the guarded dataUrl must NOT fire the repair: the repair would
    // re-apply a stale cache-hit over the correct paint.
    const engine = makeMockEngine('data:image/png;base64,newest-render', 12);
    const log = vi.fn();
    const reload = vi.fn();
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      intendedGeneration: 7,
      getCurrentAppFrame: () => 8,
      reload,
      log,
    });
    engine.settle(INTENDED, 'dropped');
    expect(reload).not.toHaveBeenCalled();
    expect(log, 'the repair log must not fire while the newest paint is visible').not.toHaveBeenCalled();
    expect(engine.listeners.length).toBe(0);
  });

  it('bounds repairs and logs when the paint cannot converge', () => {
    const engine = makeMockEngine();
    const log = vi.fn();
    const reload = vi.fn(); // never lands
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
    intendedBytes: testWebpBytes('guard'),
      getCurrentAppFrame: () => 8,
      reload,
      log,
      maxAttempts: 2,
    });
    engine.settle(INTENDED, 'dropped');
    engine.settle(INTENDED, 'dropped');
    engine.settle(INTENDED, 'dropped');
    expect(reload).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(3); // two repairs + one give-up
    expect(engine.listeners.length).toBe(0);
  });
});

type SettleListener = (
  dataUrl: string,
  outcome: 'applied' | 'dropped',
  generation?: number,
) => void;

/**
 * The surviving preview-base seam (engine-1 removed): a cache hit applies
 * SYNCHRONOUSLY; a cache miss decodes asynchronously and a clear inside the
 * decode window drops the apply. Generation ordering is monotonic — an older
 * token is a canvas no-op. Completions are recorded under the app-owned
 * paint-core contract (`PaintStroke` -> `CompletedPaintMutation`).
 */
interface PaintSeam extends RotoPreviewBasePort {
  readonly pendingDecodes: number;
  readonly completions: readonly CompletedPaintMutation[];
  // The guard's settle seam is not part of `RotoPreviewBasePort` (the app-owned
  // preview base has nothing to decode) — the double adds it for the race rows.
  onPreviewBaseSettled: (listener: SettleListener) => () => void;
  decodeNext: () => void;
  recordStroke: (stroke: PaintStroke) => CompletedPaintMutation;
}

function createPaintSeam(): PaintSeam {
  let appliedDataUrl: string | null = null;
  let appliedAppFrame: number | null = null;
  let appliedExplicit = false;
  let appliedGeneration: number | null = null;
  let generationCounter = 0;
  let mutationCounter = 0;
  const decoded = new Set<string>();
  const listeners = new Set<SettleListener>();
  const pending: Array<{ dataUrl: string; generation: number; appFrame: number; invalidated: boolean }> = [];
  const completions: CompletedPaintMutation[] = [];

  const settle = (dataUrl: string, outcome: 'applied' | 'dropped', generation: number) => {
    for (const listener of [...listeners]) listener(dataUrl, outcome, generation);
  };

  const seam: PaintSeam = {
    get pendingDecodes() { return pending.length; },
    get completions() { return completions; },
    setBgMode: vi.fn(),
    clear: vi.fn(),
    resetBackground: vi.fn(),
    setPreviewBaseImageUrl(dataUrl, generation, appFrame) {
      const token = generation ?? (generationCounter += 1);
      generationCounter = Math.max(generationCounter, token);
      if (appliedGeneration !== null && token < appliedGeneration) {
        // Engine-enforced monotonic gate: a stale generation never repaints.
        settle(dataUrl, 'dropped', token);
        return;
      }
      if (decoded.has(dataUrl)) {
        // Synchronous cache-hit apply — the repair path converges on this.
        appliedDataUrl = dataUrl;
        appliedAppFrame = appFrame ?? null;
        appliedExplicit = generation !== undefined;
        appliedGeneration = token;
        settle(dataUrl, 'applied', token);
        return;
      }
      pending.push({ dataUrl, generation: token, appFrame: appFrame ?? 0, invalidated: false });
    },
    clearPreviewBaseImage() {
      appliedDataUrl = null;
      appliedAppFrame = null;
      appliedExplicit = false;
      // Any in-flight decode is superseded: it lands as a dropped settle.
      for (const entry of pending) entry.invalidated = true;
    },
    getAppliedPreviewBaseDataUrl: () => appliedDataUrl,
    getAppliedPreviewBaseAppFrame: () => appliedAppFrame,
    getAppliedPreviewBaseExplicit: () => appliedExplicit,
    getAppliedPreviewBaseGeneration: () => appliedGeneration,
    getAppliedPreviewBaseContentToken: () => appliedGeneration,
    onPreviewBaseSettled(listener: SettleListener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    decodeNext() {
      const entry = pending.shift();
      if (!entry) throw new Error('no pending preview-base decode');
      // The decode itself succeeded, so the bytes are cached either way.
      decoded.add(entry.dataUrl);
      if (entry.invalidated) {
        settle(entry.dataUrl, 'dropped', entry.generation);
        return;
      }
      appliedDataUrl = entry.dataUrl;
      appliedAppFrame = entry.appFrame;
      appliedGeneration = entry.generation;
      settle(entry.dataUrl, 'applied', entry.generation);
    },
    recordStroke() {
      mutationCounter += 1;
      const completion: CompletedPaintMutation = {
        kind: 'paint',
        isEmpty: false,
        mutationId: mutationCounter,
      };
      completions.push(completion);
      return completion;
    },
  };
  return seam;
}

describe('completion paint through the reference loader (integration)', () => {
  function makeLoader(frame: { appFrame: number; bytes: Uint8Array }) {
    return createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames: new Set(),
      liveOverlayActionCounts: new Map(),
      getReferenceFrame: (appFrame) => appFrame === frame.appFrame
        ? { frameIndex: 0, appFrame: frame.appFrame, bytes: frame.bytes, width: 8, height: 6 }
        : null,
      setReferenceUrl: () => {},
      setRepaintBaseFrame: () => {},
      syncPending: () => {},
      setApplyMessage: () => {},
      replaceDirtyFrame: true,
    });
  }

  it('converges to the committed frame when an invalidation lands inside the completion decode window', () => {
    const committed = { appFrame: 8, bytes: testWebpBytes('committed-many-stroke-frame') };
    const seam = createPaintSeam();
    const loader = makeLoader(committed);
    const log = vi.fn();

    // The Studio reconcile wiring: paint + guard.
    const reconcile = (appFrame: number) => {
      loader.load(appFrame, seam);
      armRotoCompletionPaintGuard({
        engine: seam,
        appFrame,
        intendedDataUrl: getFrameBlobUrl(committed.bytes),
        intendedBytes: committed.bytes,
        getCurrentAppFrame: () => 8,
        reload: (frame) => { loader.load(frame, seam); },
        log,
      });
    };

    reconcile(8);
    expect(seam.pendingDecodes, 'the completion paint starts one decode').toBe(1);

    // The production race: an invalidation lands before the decode completes.
    seam.clearPreviewBaseImage();
    seam.decodeNext();

    expect(
      seam.getAppliedPreviewBaseDataUrl(),
      'the committed frame must be the applied preview base after completion settles',
    ).toBe(getFrameBlobUrl(committed.bytes));
    expect(seam.pendingDecodes, 'the repair lands as a synchronous cache hit').toBe(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(seam.recordStroke(PAINT_STROKE)).toEqual({ kind: 'paint', isEmpty: false, mutationId: 1 });
    expect(seam.completions, 'one completion per accepted stroke, no second from the repair').toHaveLength(1);
  });

  it('applies the completion paint without repair when no invalidation lands (control)', () => {
    const committed = { appFrame: 8, bytes: testWebpBytes('committed-two-stroke-frame') };
    const seam = createPaintSeam();
    const loader = makeLoader(committed);
    const log = vi.fn();

    loader.load(8, seam);
    armRotoCompletionPaintGuard({
      engine: seam,
      appFrame: 8,
      intendedDataUrl: getFrameBlobUrl(committed.bytes),
      intendedBytes: committed.bytes,
      getCurrentAppFrame: () => 8,
      reload: (frame) => { loader.load(frame, seam); },
      log,
    });
    seam.decodeNext();

    expect(seam.getAppliedPreviewBaseDataUrl()).toBe(getFrameBlobUrl(committed.bytes));
    expect(seam.pendingDecodes).toBe(0);
    expect(log, 'no repair when the paint lands cleanly').not.toHaveBeenCalled();
  });
});
