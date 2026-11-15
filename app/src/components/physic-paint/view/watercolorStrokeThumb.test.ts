// ============================================================
//  The brush-thumb cache contract.
//
//  `getStrokeThumb` and `drawStroke` need a DOM canvas, so these
//  tests install a minimal stub and exercise the cache paths for
//  real instead of inferring them from the source.
//
//  63-06 / D-05 / T-63-18: the key is the tip id PLUS the
//  mask-registry generation, a mask-backed tip paints through
//  `buildBrushForStroke` (never a preset lookup, never a throw),
//  and the reset drops BOTH maps — the stroke thumb and the
//  tinted tip canvas it blits.
//
//  The tinted tip canvas is rasterized from `brush.tipData`, so
//  its cache key must carry the generation too: a mask replaced
//  under an unchanged id would otherwise keep serving the old
//  mask even when the stroke thumb and the footprint rebuild.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBrushForStroke,
  registerMask,
  resetMaskRegistry,
  TIP_MASK_BYTES,
} from '@efxlab/efx-watercolor';
import {
  clearStrokeThumbCache,
  getStrokeThumb,
  strokeThumbPainter,
  tipImage,
} from './watercolorStrokeThumb';

const SOURCE = readFileSync(resolve(__dirname, './watercolorStrokeThumb.ts'), 'utf8');

/** Minimal canvas stub so the cache paths run under node (no DOM env). */
function makeStubCanvas(): Record<string, unknown> {
  return {
    width: 0,
    height: 0,
    dataset: {} as Record<string, string>,
    clientWidth: 0,
    clientHeight: 0,
    getContext: () => ({
      setTransform() {},
      clearRect() {},
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData() {},
      drawImage() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      globalAlpha: 1,
    }),
  };
}

const uniformMask = (value: number) => new Uint8Array(TIP_MASK_BYTES).fill(value);

describe('stroke thumb cache (63-06 D-05 / T-63-18)', () => {
  it('keys the cache by tip id plus the mask generation', () => {
    expect(SOURCE).toContain('`${tipId}|g${maskGeneration()}`');
    expect(SOURCE).toContain('const cached = thumbCache.get(key)');
    expect(SOURCE).toContain('thumbCache.set(key, canvas)');
  });

  it('keys the tinted tip canvas by id, hex and the mask generation', () => {
    // Boolean form keeps the failure diagnostic one line (TAP-red parseable).
    expect(
      SOURCE.includes('`${b.id}|${hex}|g${maskGeneration()}`'),
      'tipImage key carries the mask generation',
    ).toBe(true);
  });

  it('paints a mask-backed tip through buildBrushForStroke and never throws', () => {
    expect(SOURCE).toContain('resolveMask(tipId)');
    expect(SOURCE).toContain('buildBrushForStroke(tipId)');
    // The old unknown-preset throw is gone: a catalog id is always paintable.
    expect(SOURCE).not.toContain('unknown preset id');
  });

  it('clears both the thumb cache and the tinted-tip cache', () => {
    expect(SOURCE).toContain('thumbCache.clear()');
    expect(SOURCE).toContain('tipCache.clear()');
  });
});

describe('thumbnail caches observe mask generation (63-06 / T-63-18)', () => {
  const MASKED = 'wc/custom-thumb-generation';
  let originalDocument: Document | undefined;

  beforeEach(() => {
    originalDocument = globalThis.document;
    Object.assign(globalThis, { document: { createElement: () => makeStubCanvas() } });
    clearStrokeThumbCache();
    resetMaskRegistry();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
    resetMaskRegistry();
  });

  it('returns a new tinted tip canvas after a mask replacement under the same id', () => {
    registerMask(MASKED, uniformMask(30));
    const first = tipImage(buildBrushForStroke(MASKED), '#2338a8');

    registerMask(MASKED, uniformMask(210));
    const second = tipImage(buildBrushForStroke(MASKED), '#2338a8');

    // Boolean identity: an object `.not.toBe` diagnostic prints both canvases
    // across many lines, which breaks the TAP-red evidence parser.
    expect(second === first, 'a replaced mask must not reuse the old tip canvas').toBe(false);
  });

  it('paints one thumb per tip id at an unchanged generation', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      const first = getStrokeThumb(MASKED);
      const second = getStrokeThumb(MASKED);
      expect(second, 'a second mount reuses the painted thumb').toBe(first);
      expect(paintSpy.mock.calls.length, 'one paint across two reads').toBe(1);
    } finally {
      paintSpy.mockRestore();
    }
  });

  it('repaints the stroke thumb after a mask replacement under the same id', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      registerMask(MASKED, uniformMask(30));
      const first = getStrokeThumb(MASKED);

      registerMask(MASKED, uniformMask(210));
      const second = getStrokeThumb(MASKED);

      expect(second, 'the new generation paints a new canvas').not.toBe(first);
      expect(paintSpy.mock.calls.length, 'exactly one repaint for the new generation').toBe(2);
    } finally {
      paintSpy.mockRestore();
    }
  });

  it('clearStrokeThumbCache drops both the thumb and the tinted tip canvas', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      registerMask(MASKED, uniformMask(60));
      const thumb = getStrokeThumb(MASKED);
      const tip = tipImage(buildBrushForStroke(MASKED), '#2338a8');

      clearStrokeThumbCache();

      expect(getStrokeThumb(MASKED), 'the stroke thumb repaints').not.toBe(thumb);
      expect(
        tipImage(buildBrushForStroke(MASKED), '#2338a8'),
        'the tinted tip canvas repaints',
      ).not.toBe(tip);
      expect(paintSpy.mock.calls.length, 'both reads repaint after the reset').toBe(2);
    } finally {
      paintSpy.mockRestore();
    }
  });
});
