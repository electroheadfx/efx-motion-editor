import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from './EfxPaintEngine';

// 38.1-07: decoded-Image cache in setPreviewBaseImageUrl (revisiting a frame
// whose dataUrl was already painted performs ZERO new Image decodes and
// applies the cached decoded image synchronously under the identical
// requestId/destroyed/animationMode/drawing guards) + input/identity-guarded
// early-return in resetBackground (unchanged background inputs perform no
// drawBg/redraw work; the previewBackgroundRequestId bump is unconditional).

type StubImage = { onload: (() => void) | null; src: string };

let images: StubImage[];

function makeBgCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  };
}

function makeEngine(overrides: Record<string, unknown> = {}) {
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
    bgData: null,
    lastResetBackgroundData: null,
    lastResetBackgroundInputs: null,
    paperTextures: new Map(),
    userPhoto: null,
    bgCtx: makeBgCtx(),
    dualCanvas: {
      dryCanvas: { removeEventListener: vi.fn() },
      previewBaseCtx: { clearRect: vi.fn() },
    },
    redrawPreviewBase: vi.fn(),
    redrawAll: vi.fn(),
    ...overrides,
  });
  return engine;
}

function mockCounts(engine: ReturnType<typeof makeEngine>) {
  return engine as unknown as {
    redrawPreviewBase: ReturnType<typeof vi.fn>;
    redrawAll: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  images = [];
  vi.stubGlobal('Image', vi.fn(() => {
    const image: StubImage = { onload: null, src: '' };
    images.push(image);
    return image;
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EfxPaintEngine preview base image decode cache (38.1-07)', () => {
  it('caches the decoded image and applies synchronously on revisit under the same guards', () => {
    const engine = makeEngine();
    const mocks = mockCounts(engine);

    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length).toBe(1);
    expect(mocks.redrawPreviewBase).not.toHaveBeenCalled();

    images[0].onload!();
    expect(engine.previewBaseEnabled).toBe(true);
    expect(engine.previewBackgroundSeparated).toBe(true);
    expect(engine.previewBaseImage).toBe(images[0]);
    expect(mocks.redrawPreviewBase).toHaveBeenCalledTimes(1);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(1);

    mocks.redrawPreviewBase.mockClear();
    mocks.redrawAll.mockClear();

    // Revisit: ZERO new Image constructions, synchronous apply.
    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length).toBe(1);
    expect(mocks.redrawPreviewBase).toHaveBeenCalledTimes(1);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(1);
    expect(engine.previewBaseImage).toBe(images[0]);
    expect(engine.previewBaseEnabled).toBe(true);
  });

  it('keeps requestId supersession and clearPreviewBaseImage behavior verbatim', () => {
    const engine = makeEngine();
    const mocks = mockCounts(engine);

    engine.setPreviewBaseImageUrl('data:image/png;base64,first');
    engine.setPreviewBaseImageUrl('data:image/png;base64,second');
    expect(images.length).toBe(2);

    // Stale load: the superseded requestId guard rejects it exactly as today.
    images[0].onload!();
    expect(engine.previewBaseEnabled).toBe(false);
    expect(mocks.redrawAll).not.toHaveBeenCalled();

    images[1].onload!();
    expect(engine.previewBaseEnabled).toBe(true);
    expect(engine.previewBaseImage).toBe(images[1]);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(1);

    engine.clearPreviewBaseImage();
    expect(engine.previewBaseEnabled).toBe(false);
    expect(engine.previewBackgroundSeparated).toBe(false);
    expect(engine.previewBaseImage).toBeNull();
  });

  it('applies the cached image under the identical destroyed/animationMode/drawing guards', () => {
    const engine = makeEngine();
    const mocks = mockCounts(engine);

    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    images[0].onload!();
    expect(engine.previewBaseEnabled).toBe(true);
    mocks.redrawPreviewBase.mockClear();
    mocks.redrawAll.mockClear();

    engine.destroyed = true;
    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length).toBe(1);
    expect(mocks.redrawAll).not.toHaveBeenCalled();

    engine.destroyed = false;
    engine.animationMode = true;
    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length).toBe(1);
    expect(mocks.redrawAll).not.toHaveBeenCalled();

    engine.animationMode = false;
    engine.state.drawing = true;
    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length).toBe(1);
    expect(mocks.redrawAll).not.toHaveBeenCalled();

    engine.state.drawing = false;
    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length).toBe(1);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest decoded image beyond the FIFO cap of 32', () => {
    const engine = makeEngine();

    for (let index = 0; index < 33; index += 1) {
      engine.setPreviewBaseImageUrl(`data:image/png;base64,frame-${index}`);
      images[images.length - 1].onload!();
    }
    expect(images.length).toBe(33);

    // The oldest entry (frame-0) was evicted: revisiting it decodes again.
    engine.setPreviewBaseImageUrl('data:image/png;base64,frame-0');
    expect(images.length).toBe(34);

    // A retained entry still hits the cache.
    engine.setPreviewBaseImageUrl('data:image/png;base64,frame-32');
    expect(images.length).toBe(34);
  });

  it('clears the decoded-image cache on destroy', () => {
    const engine = makeEngine({
      flushPendingStrokeFinalizations: vi.fn(),
      stopNaturalDrying: vi.fn(),
      rafId: 0,
      strokeFinalizationScheduled: false,
      physicsInterval: null,
      boundPointerDown: vi.fn(),
      boundPointerMove: vi.fn(),
      boundPointerUp: vi.fn(),
      boundPointerLeave: vi.fn(),
      boundTouchStart: vi.fn(),
    });

    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    images[0].onload!();
    expect(images.length).toBe(1);

    engine.destroy();

    engine.setPreviewBaseImageUrl('data:image/png;base64,alpha');
    expect(images.length, 'destroy clears the decode cache — the revisit decodes again').toBe(2);
  });
});

describe('EfxPaintEngine resetBackground skip (38.1-07)', () => {
  it('skips drawBg/redraw work when background inputs are unchanged, bumping the request id unconditionally', () => {
    const engine = makeEngine();
    const mocks = mockCounts(engine);

    engine.resetBackground();
    expect(engine.bgCtx.getImageData).toHaveBeenCalledTimes(1);
    expect(mocks.redrawPreviewBase).toHaveBeenCalledTimes(1);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(1);
    expect(engine.previewBackgroundRequestId).toBe(1);

    engine.resetBackground();
    expect(engine.previewBackgroundRequestId, 'the request id bump is unconditional').toBe(2);
    expect(engine.bgCtx.getImageData, 'unchanged inputs perform no drawBg work').toHaveBeenCalledTimes(1);
    expect(mocks.redrawPreviewBase, 'unchanged inputs perform no redraw work').toHaveBeenCalledTimes(1);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(1);
  });

  it('re-executes resetBackground after any other background writer replaces bgData', () => {
    const engine = makeEngine();
    const mocks = mockCounts(engine);

    engine.resetBackground();
    expect(engine.bgCtx.getImageData).toHaveBeenCalledTimes(1);

    // Every other background writer (setBgMode, setBackgroundImageUrl apply,
    // hard reset, replay reset) REPLACES this.bgData — simulate that identity
    // change directly.
    engine.bgData = { data: new Uint8ClampedArray(4) };
    engine.resetBackground();

    expect(engine.bgCtx.getImageData).toHaveBeenCalledTimes(2);
    expect(mocks.redrawPreviewBase).toHaveBeenCalledTimes(2);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(2);
    expect(engine.previewBackgroundRequestId).toBe(2);
  });

  it('re-executes resetBackground when a background input changes', () => {
    const engine = makeEngine();

    engine.resetBackground();
    expect(engine.bgCtx.getImageData).toHaveBeenCalledTimes(1);

    engine.state.bgMode = 'transparent';
    engine.resetBackground();
    expect(engine.bgCtx.getImageData, 'bgMode change re-executes').toHaveBeenCalledTimes(2);

    engine.userPhoto = { __photo: true };
    engine.resetBackground();
    expect(engine.bgCtx.getImageData, 'userPhoto reference change re-executes').toHaveBeenCalledTimes(3);
  });

  it('navigate-away-and-back skips the redundant decode and redraw work', () => {
    const engine = makeEngine();
    const mocks = mockCounts(engine);

    // Paint frame A.
    engine.setPreviewBaseImageUrl('data:image/png;base64,frame-a');
    images[0].onload!();
    engine.resetBackground();
    expect(images.length).toBe(1);
    expect(engine.bgCtx.getImageData).toHaveBeenCalledTimes(1);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(2); // apply + resetBackground

    // Navigate away.
    engine.clearPreviewBaseImage();

    // Navigate back to A: unchanged-background reset is free, the revisit
    // applies the cached decode synchronously — the uncached baseline call
    // sequence minus the redundant decode/drawBg work.
    engine.resetBackground();
    engine.setPreviewBaseImageUrl('data:image/png;base64,frame-a');

    expect(images.length, 'revisit performs zero new Image decodes').toBe(1);
    expect(engine.bgCtx.getImageData, 'unchanged-background reset performs no drawBg work').toHaveBeenCalledTimes(1);
    expect(engine.previewBaseImage).toBe(images[0]);
    expect(engine.previewBaseEnabled).toBe(true);
    expect(mocks.redrawAll).toHaveBeenCalledTimes(4); // apply + resetBackground + clearPreviewBaseImage + cached apply (skipped reset adds none)
  });
});
