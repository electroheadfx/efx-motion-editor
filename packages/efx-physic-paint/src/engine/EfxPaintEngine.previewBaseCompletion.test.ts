import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from './EfxPaintEngine';

// regression-refresh-multi-paint: the multi-stroke completion paint is a single
// cache-miss decode whose onload can be superseded before it lands. The current
// engine drops that decode BEFORE caching it and never retries, so the canvas
// keeps the pre-apply image until an unrelated repaint. The completion contract
// requires: (1) a dropped decode is still cached so a repair re-request is a
// synchronous cache-hit apply, (2) the engine exposes the applied dataUrl, and
// (3) the engine notifies request settlement so a caller-side guard can repair.

type StubImage = { onload: (() => void) | null; onerror: (() => void) | null; src: string };

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
    appliedPreviewBaseDataUrl: null,
    previewBaseSettledListeners: null,
    previewBaseGenerationCounter: 0,
    appliedPreviewBaseGeneration: null,
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

describe('EfxPaintEngine preview base completion contract (regression-refresh-multi-paint)', () => {
  it('caches a superseded decode so the repair re-request applies synchronously with zero new decodes', () => {
    const engine = makeEngine();

    engine.setPreviewBaseImageUrl('data:image/png;base64,committed');
    expect(images.length).toBe(1);

    // The production race: an invalidation lands inside the decode window.
    engine.clearPreviewBaseImage();
    images[0].onload!();

    // RED target: the dropped decode must still be cached...
    engine.setPreviewBaseImageUrl('data:image/png;base64,committed');
    expect(images.length, 'the repair re-request must not decode again').toBe(1);
    // ...and the cached apply lands synchronously.
    expect(engine.previewBaseEnabled).toBe(true);
    expect(engine.previewBaseImage).toBe(images[0]);
  });

  it('tracks the applied preview base dataUrl across apply and clear', () => {
    const engine = makeEngine();
    expect(engine.getAppliedPreviewBaseDataUrl()).toBeNull();

    engine.setPreviewBaseImageUrl('data:image/png;base64,committed');
    expect(engine.getAppliedPreviewBaseDataUrl(), 'not applied while the decode is in flight').toBeNull();

    images[0].onload!();
    expect(engine.getAppliedPreviewBaseDataUrl()).toBe('data:image/png;base64,committed');

    engine.clearPreviewBaseImage();
    expect(engine.getAppliedPreviewBaseDataUrl()).toBeNull();
  });

  it('tracks the applied dataUrl on the synchronous cache-hit path', () => {
    const engine = makeEngine();
    engine.setPreviewBaseImageUrl('data:image/png;base64,committed');
    images[0].onload!();

    engine.clearPreviewBaseImage();
    engine.setPreviewBaseImageUrl('data:image/png;base64,committed');
    expect(images.length, 'cache hit performs no new decode').toBe(1);
    expect(engine.getAppliedPreviewBaseDataUrl()).toBe('data:image/png;base64,committed');
  });

  it('notifies settle outcomes for applied, superseded, and flag-dropped requests', () => {
    const engine = makeEngine();
    const settled: Array<[string, string]> = [];
    const unsubscribe = engine.onPreviewBaseSettled((dataUrl, outcome) => { settled.push([dataUrl, outcome]); });

    engine.setPreviewBaseImageUrl('data:image/png;base64,first');
    engine.setPreviewBaseImageUrl('data:image/png;base64,second');
    images[0].onload!();
    expect(settled).toEqual([['data:image/png;base64,first', 'dropped']]);

    images[1].onload!();
    expect(settled).toEqual([
      ['data:image/png;base64,first', 'dropped'],
      ['data:image/png;base64,second', 'applied'],
    ]);

    engine.animationMode = true;
    engine.setPreviewBaseImageUrl('data:image/png;base64,third');
    images[2].onload!();
    expect(settled).toEqual([
      ['data:image/png;base64,first', 'dropped'],
      ['data:image/png;base64,second', 'applied'],
      ['data:image/png;base64,third', 'dropped'],
    ]);

    unsubscribe();
    engine.animationMode = false;
    engine.setPreviewBaseImageUrl('data:image/png;base64,fourth');
    images[3].onload!();
    expect(settled.length, 'unsubscribed listeners stop receiving settles').toBe(3);
  });

  it('notifies a dropped settle when the decode fails', () => {
    const engine = makeEngine();
    const settled: Array<[string, string]> = [];
    engine.onPreviewBaseSettled((dataUrl, outcome) => { settled.push([dataUrl, outcome]); });

    engine.setPreviewBaseImageUrl('data:image/png;base64,broken');
    images[0].onerror!();
    expect(settled).toEqual([['data:image/png;base64,broken', 'dropped']]);
    expect(engine.getAppliedPreviewBaseDataUrl()).toBeNull();
  });

  it('does not cache a decode that settles after destroy', () => {
    const engine = makeEngine();
    engine.setPreviewBaseImageUrl('data:image/png;base64,committed');
    engine.destroyed = true;
    images[0].onload!();
    expect(engine.previewBaseImageCache.size, 'destroyed engines never retain dropped decodes').toBe(0);
  });

  it('never paints an OLDER generation over a newer settled paint (late onload with current requestId)', () => {
    const engine = makeEngine();
    const settled: Array<[string, string, number | undefined]> = [];
    engine.onPreviewBaseSettled((dataUrl, outcome, generation) => { settled.push([dataUrl, outcome, generation]); });

    // New-generation B lands first.
    engine.setPreviewBaseImageUrl('data:image/png;base64,B', 2);
    images[0].onload!();
    expect(engine.getAppliedPreviewBaseDataUrl()).toBe('data:image/png;base64,B');
    expect(engine.getAppliedPreviewBaseGeneration()).toBe(2);

    // The stale writer re-issues OLD generation A AFTER B: A's requestId is now
    // CURRENT when its (uncached) decode completes, but its generation is older.
    engine.setPreviewBaseImageUrl('data:image/png;base64,A', 1);
    images[1].onload!();
    expect(
      engine.getAppliedPreviewBaseDataUrl(),
      'a stale-generation decode must never paint over the newer settled paint',
    ).toBe('data:image/png;base64,B');
    expect(engine.getAppliedPreviewBaseGeneration()).toBe(2);
    expect(settled).toContainEqual(['data:image/png;base64,A', 'dropped', 1]);
  });

  it('never paints a stale-generation cache-hit re-issue over a newer settled paint', () => {
    const engine = makeEngine();
    engine.setPreviewBaseImageUrl('data:image/png;base64,A', 1);
    images[0].onload!();
    engine.setPreviewBaseImageUrl('data:image/png;base64,B', 2);
    images[1].onload!();
    expect(engine.getAppliedPreviewBaseDataUrl()).toBe('data:image/png;base64,B');

    // The inverted-race writer: the repair re-issues the STALE image A as a
    // synchronous cache-hit. Generation 1 < applied generation 2 → no-op.
    engine.setPreviewBaseImageUrl('data:image/png;base64,A', 1);
    expect(
      engine.getAppliedPreviewBaseDataUrl(),
      'a stale-generation cache-hit re-issue must not paint over B',
    ).toBe('data:image/png;base64,B');
    expect(engine.getAppliedPreviewBaseGeneration()).toBe(2);
  });

  it('interleaves explicit and auto-assigned generations monotonically', () => {
    const engine = makeEngine();
    // Auto-assigned paint (navigation) lands first.
    engine.setPreviewBaseImageUrl('data:image/png;base64,nav');
    images[0].onload!();
    expect(engine.getAppliedPreviewBaseGeneration()).toBe(1);
    // A completion reconcile passes an explicit generation above the applied one.
    engine.setPreviewBaseImageUrl('data:image/png;base64,reconcile', 2);
    images[1].onload!();
    expect(engine.getAppliedPreviewBaseDataUrl()).toBe('data:image/png;base64,reconcile');
    expect(engine.getAppliedPreviewBaseGeneration()).toBe(2);
    // A later auto-issued paint must still be above the explicit generation.
    engine.setPreviewBaseImageUrl('data:image/png;base64,next');
    images[2].onload!();
    expect(engine.getAppliedPreviewBaseGeneration()).toBe(3);
  });

  it('treats a paint after clearPreviewBaseImage as a fresh generation', () => {
    const engine = makeEngine();
    engine.setPreviewBaseImageUrl('data:image/png;base64,A', 1);
    images[0].onload!();
    engine.setPreviewBaseImageUrl('data:image/png;base64,B', 2);
    images[1].onload!();
    engine.clearPreviewBaseImage();
    expect(engine.getAppliedPreviewBaseGeneration()).toBeNull();

    // A cleared canvas holds no preview base — the next paint applies.
    engine.setPreviewBaseImageUrl('data:image/png;base64,B', 2);
    expect(engine.getAppliedPreviewBaseDataUrl()).toBe('data:image/png;base64,B');
  });
});
