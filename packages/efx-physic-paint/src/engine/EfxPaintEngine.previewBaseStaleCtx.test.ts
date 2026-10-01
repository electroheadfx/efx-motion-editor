import { describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from './EfxPaintEngine';

// 260930-wm6 R3 — the "come back on the key and it looks faded" hole.
// clear()/clearPreviewBaseImage() empty previewBaseCtx. A cache-hit apply
// (returning to a previously-visited key) lands synchronously inside
// PAINT_TRAIN_BASE_DRAW_MS of the navigation click, so the 52.1 paint-train
// skip used to drop redrawPreviewBase() and the cached paint never reached
// the ctx the monitor reads (getBakedCanvas). A stale ctx must draw the base
// even mid-train; only the stroke replay stays skippable.

function makeImage() {
  return { width: 8, height: 6 } as HTMLImageElement;
}

function makeEngine(overrides: Record<string, unknown> = {}) {
  const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine & Record<string, any>;
  Object.assign(engine, {
    width: 8,
    height: 6,
    destroyed: false,
    animationMode: false,
    state: { drawing: false },
    previewBaseRequestId: 1,
    inFlightExplicitPreviewBase: false,
    appliedPreviewBaseGeneration: null,
    previewBaseGenerationCounter: 0,
    previewBaseEnabled: false,
    previewBaseImage: null,
    previewBackgroundSeparated: false,
    appliedPreviewBaseDataUrl: null,
    appliedPreviewBaseAppFrame: null,
    appliedPreviewBaseExplicit: false,
    lastPointerInputTime: performance.now(),
    redrawPreviewBase: vi.fn(),
    redrawAll: vi.fn(),
    notifyPreviewBaseSettled: vi.fn(),
    ...overrides,
  });
  return engine;
}

function apply(engine: ReturnType<typeof makeEngine>, opts: { skipFullReplay?: boolean } = {}) {
  return (engine as any).applyPreviewBaseImage(
    makeImage(),
    engine.previewBaseRequestId,
    'blob:test',
    1,
    7,
    false,
    opts.skipFullReplay ?? false,
  );
}

describe('applyPreviewBaseImage — stale previewBaseCtx must land even inside the paint-train skip', () => {
  it('draws the base after clearPreviewBaseImage, even with a just-clicked pointer', () => {
    const engine = makeEngine({
      // Navigation: clearPreviewBaseImage emptied the ctx; the click that
      // triggered the navigation is the last pointer input.
      previewBaseEnabled: false,
      previewBaseImage: null,
      lastPointerInputTime: performance.now(),
    });

    apply(engine);

    expect(
      engine.redrawPreviewBase,
      'a stale previewBaseCtx must be redrawn or the cached paint never reaches the monitor',
    ).toHaveBeenCalledOnce();
    // The stroke replay still yields to the paint train (52.1).
    expect(engine.redrawAll).not.toHaveBeenCalled();
  });

  it('keeps the 52.1 skip when the ctx already shows a base (paint train, no re-upload)', () => {
    const engine = makeEngine({
      previewBaseEnabled: true,
      previewBaseImage: makeImage(),
      lastPointerInputTime: performance.now(),
    });

    apply(engine);

    expect(engine.redrawPreviewBase).not.toHaveBeenCalled();
    expect(engine.redrawAll).not.toHaveBeenCalled();
  });

  it('redraws base + replay outside the paint train', () => {
    const engine = makeEngine({
      previewBaseEnabled: true,
      previewBaseImage: makeImage(),
      lastPointerInputTime: performance.now() - 10_000,
    });

    apply(engine);

    expect(engine.redrawPreviewBase).toHaveBeenCalledOnce();
    expect(engine.redrawAll).toHaveBeenCalledOnce();
  });

  it('skipFullReplay still skips the replay but lands a stale base', () => {
    const engine = makeEngine({
      previewBaseEnabled: false,
      previewBaseImage: null,
      lastPointerInputTime: performance.now(),
    });

    apply(engine, { skipFullReplay: true });

    expect(engine.redrawPreviewBase).toHaveBeenCalledOnce();
    expect(engine.redrawAll).not.toHaveBeenCalled();
  });
});
