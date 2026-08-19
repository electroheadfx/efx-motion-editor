import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { armRotoCompletionPaintGuard } from './rotoCompletionPaintGuard';
import { createRotoReferenceLoader } from './useRotoReferenceController';

// regression-refresh-multi-paint: the acceptance reconcile paint is the FINAL
// preview-base paint of a multi-stroke completion. When its cache-miss decode
// is superseded inside the decode window, the engine drops it and no later
// paint is issued — the canvas keeps the pre-apply image until an unrelated
// repaint. The completion guard watches the settle outcome and repairs exactly
// once via a reload that lands as a synchronous cache-hit apply.

interface MockEngine {
  applied: string | null;
  listeners: Array<(dataUrl: string, outcome: 'applied' | 'dropped') => void>;
  getAppliedPreviewBaseDataUrl: () => string | null;
  onPreviewBaseSettled: (listener: (dataUrl: string, outcome: 'applied' | 'dropped') => void) => () => void;
  settle: (dataUrl: string, outcome: 'applied' | 'dropped') => void;
}

function makeMockEngine(applied: string | null = null): MockEngine {
  const engine: MockEngine = {
    applied,
    listeners: [],
    getAppliedPreviewBaseDataUrl() { return engine.applied; },
    onPreviewBaseSettled(listener) {
      engine.listeners.push(listener);
      return () => { engine.listeners = engine.listeners.filter((entry) => entry !== listener); };
    },
    settle(dataUrl, outcome) {
      if (outcome === 'applied') engine.applied = dataUrl;
      for (const listener of [...engine.listeners]) listener(dataUrl, outcome);
    },
  };
  return engine;
}

const INTENDED = 'data:image/png;base64,committed';

describe('armRotoCompletionPaintGuard', () => {
  it('does nothing when the intended paint already landed (cache-hit apply)', () => {
    const engine = makeMockEngine(INTENDED);
    const reload = vi.fn();
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
      getCurrentAppFrame: () => 8,
      reload,
    });
    expect(engine.listeners.length).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing without an engine, an intended dataUrl, or the engine settle APIs', () => {
    const reload = vi.fn();
    armRotoCompletionPaintGuard({ engine: null, appFrame: 8, intendedDataUrl: INTENDED, getCurrentAppFrame: () => 8, reload });
    armRotoCompletionPaintGuard({ engine: makeMockEngine(), appFrame: 8, intendedDataUrl: null, getCurrentAppFrame: () => 8, reload });
    armRotoCompletionPaintGuard({ engine: {}, appFrame: 8, intendedDataUrl: INTENDED, getCurrentAppFrame: () => 8, reload });
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
      getCurrentAppFrame: () => 8,
      reload,
      log,
    });
    expect(engine.listeners.length).toBe(1);

    engine.settle(INTENDED, 'dropped');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith(8);
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
      getCurrentAppFrame: () => 8,
      reload,
    });
    engine.settle('data:image/png;base64,stale-frame', 'applied');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('bounds repairs and logs when the paint cannot converge', () => {
    const engine = makeMockEngine();
    const log = vi.fn();
    const reload = vi.fn(); // never lands
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: INTENDED,
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

describe('completion paint through the reference loader (integration)', () => {
  type StubImage = { onload: (() => void) | null; onerror: (() => void) | null; src: string };
  let images: StubImage[];

  function makeEngine() {
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine & Record<string, any>;
    Object.assign(engine, {
      width: 8,
      height: 6,
      destroyed: false,
      animationMode: false,
      state: { drawing: false, bgMode: 'white' },
      previewBaseRequestId: 0,
      previewBaseEnabled: false,
      previewBackgroundSeparated: false,
      previewBaseImage: null,
      previewBaseImageCache: new Map<string, unknown>(),
      previewBackgroundRequestId: 0,
      appliedPreviewBaseDataUrl: null,
      previewBaseSettledListeners: null,
      bgData: null,
      lastResetBackgroundData: null,
      lastResetBackgroundInputs: null,
      paperTextures: new Map(),
      userPhoto: null,
      bgCtx: { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })) },
      dualCanvas: { dryCanvas: { removeEventListener: vi.fn() }, previewBaseCtx: { clearRect: vi.fn() } },
      redrawPreviewBase: vi.fn(),
      redrawAll: vi.fn(),
      setBgMode: vi.fn(),
      clear: vi.fn(),
      resetBackground: vi.fn(),
    });
    return engine;
  }

  beforeEach(() => {
    images = [];
    vi.stubGlobal('Image', vi.fn(() => {
      const image: StubImage = { onload: null, onerror: null, src: '' };
      images.push(image);
      return image;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeLoader(frame: { appFrame: number; dataUrl: string }) {
    return createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames: new Set(),
      liveOverlayActionCounts: new Map(),
      getReferenceFrame: (appFrame) => appFrame === frame.appFrame
        ? { frameIndex: 0, appFrame: frame.appFrame, dataUrl: frame.dataUrl, width: 8, height: 6 }
        : null,
      setReferenceUrl: () => {},
      setRepaintBaseFrame: () => {},
      syncPending: () => {},
      setApplyMessage: () => {},
      replaceDirtyFrame: true,
    });
  }

  it('converges to the committed frame when an invalidation lands inside the completion decode window', () => {
    const committed = { appFrame: 8, dataUrl: 'data:image/png;base64,committed-many-stroke-frame' };
    const engine = makeEngine();
    const loader = makeLoader(committed);
    const log = vi.fn();

    // The Studio reconcile wiring (what the fix adds): paint + guard.
    const reconcile = (appFrame: number) => {
      loader.load(appFrame, engine);
      armRotoCompletionPaintGuard({
        engine,
        appFrame,
        intendedDataUrl: committed.dataUrl,
        getCurrentAppFrame: () => 8,
        reload: (frame) => { loader.load(frame, engine); },
        log,
      });
    };

    reconcile(8);
    expect(images.length, 'the completion paint starts one decode').toBe(1);

    // The production race: an invalidation lands before the large-PNG decode completes.
    engine.clearPreviewBaseImage();
    images[0].onload!();

    expect(
      engine.getAppliedPreviewBaseDataUrl(),
      'the committed frame must be the applied preview base after completion settles',
    ).toBe(committed.dataUrl);
    expect((engine as unknown as Record<string, unknown>).previewBaseImage).toBe(images[0]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('applies the completion paint without repair when no invalidation lands (control)', () => {
    const committed = { appFrame: 8, dataUrl: 'data:image/png;base64,committed-two-stroke-frame' };
    const engine = makeEngine();
    const loader = makeLoader(committed);
    const log = vi.fn();

    loader.load(8, engine);
    armRotoCompletionPaintGuard({
      engine,
      appFrame: 8,
      intendedDataUrl: committed.dataUrl,
      getCurrentAppFrame: () => 8,
      reload: (frame) => { loader.load(frame, engine); },
      log,
    });
    images[0].onload!();

    expect(engine.getAppliedPreviewBaseDataUrl()).toBe(committed.dataUrl);
    expect(log, 'no repair when the paint lands cleanly').not.toHaveBeenCalled();
  });
});
