/**
 * quick-261115-oh9 — the texture-row chip is the ENGINE'S tip.
 *
 * Laws pinned here:
 *   a chip canvas is 192x192, one ImageData pixel per mask byte as
 *     (v, v, v, 255) — white footprint on black ground
 *   the bytes come from strokeTipData(), the SAME resolution the
 *     engine stamps (never a second tip generator, never a decode)
 *   the cache key carries the response id: ('chalk', null) and
 *     ('flat', null) never share a canvas
 *   a texture replaces the footprint identically for any response
 *   the cache key carries the mask-registry generation: a registry
 *     write under the same ids can never serve stale bytes
 *   clearMaskChipCache() empties the map
 *   never toDataURL / toBlob (52.1 D-19)
 *
 * Render tests materialize the minimal canvas stub (no DOM env; the
 * app's vitest config sets no `environment` by project law).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIP_MASK_BYTES, strokeTipData } from '@efxlab/efx-watercolor';
import { registerMask, resetMaskRegistry } from '@efxlab/efx-watercolor/brushes';
import {
  blitMaskChip,
  clearMaskChipCache,
  getMaskChipCanvas,
} from './watercolorMaskChip';

interface StubImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface StubCanvas {
  width: number;
  height: number;
  image: StubImage | null;
  ops: { clearRect: unknown[][]; drawImage: unknown[][] };
  getContext: () => Record<string, unknown>;
}

/** A canvas stub that records the putImageData payload and the blit ops. */
function makeChipCanvas(): StubCanvas {
  const canvas: StubCanvas = {
    width: 0,
    height: 0,
    image: null,
    ops: { clearRect: [], drawImage: [] },
    getContext: () => context,
  };
  const context: Record<string, unknown> = {
    createImageData: (w: number, h: number): StubImage => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData(image: StubImage) {
      canvas.image = image;
    },
    clearRect(...args: unknown[]) {
      canvas.ops.clearRect.push([...args]);
    },
    drawImage(...args: unknown[]) {
      canvas.ops.drawImage.push([...args]);
    },
    setTransform() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    globalAlpha: 1,
  };
  return canvas;
}

let originalDocument: typeof globalThis.document;

beforeEach(() => {
  originalDocument = globalThis.document;
  clearMaskChipCache();
  resetMaskRegistry();
  Object.assign(globalThis, {
    document: { createElement: () => makeChipCanvas() },
  });
});

afterEach(() => {
  Object.assign(globalThis, { document: originalDocument });
  clearMaskChipCache();
  resetMaskRegistry();
});

function pixelsOf(canvas: ReturnType<typeof getMaskChipCanvas>): Uint8ClampedArray {
  const image = (canvas as unknown as StubCanvas).image;
  expect(image, 'chip must have painted an ImageData').toBeTruthy();
  return image!.data;
}

function differingPixels(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let differing = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) differing += 1;
  }
  return differing;
}

describe('watercolorMaskChip — the engine tip as a grayscale chip (quick-261115-oh9)', () => {
  it('is 192x192 and writes each mask byte as (v, v, v, 255)', () => {
    const canvas = getMaskChipCanvas('chalk', 'wc/builtin-chalk');
    expect(canvas.width).toBe(192);
    expect(canvas.height).toBe(192);
    const pixels = pixelsOf(canvas);
    const data = strokeTipData('chalk', 'wc/builtin-chalk');
    expect(data.length, 'mask is exactly TIP_MASK_BYTES').toBe(TIP_MASK_BYTES);

    const inkIndex = data.findIndex((v) => v > 0);
    expect(inkIndex, 'chalk mask has ink').toBeGreaterThanOrEqual(0);
    const ink = data[inkIndex]!;
    expect([pixels[inkIndex * 4], pixels[inkIndex * 4 + 1], pixels[inkIndex * 4 + 2], pixels[inkIndex * 4 + 3]]).toEqual([
      ink,
      ink,
      ink,
      255,
    ]);

    const zeroIndex = data.findIndex((v) => v === 0);
    expect(zeroIndex, 'chalk mask has ground').toBeGreaterThanOrEqual(0);
    expect([
      pixels[zeroIndex * 4],
      pixels[zeroIndex * 4 + 1],
      pixels[zeroIndex * 4 + 2],
      pixels[zeroIndex * 4 + 3],
    ]).toEqual([0, 0, 0, 255]);
  });

  it('keys the cache on the response: chalk and flat never share bytes', () => {
    const chalk = getMaskChipCanvas('chalk', null);
    const flat = getMaskChipCanvas('flat', null);
    expect(flat).not.toBe(chalk);
    expect(differingPixels(pixelsOf(chalk), pixelsOf(flat))).toBeGreaterThan(0);
  });

  it('a texture replaces the footprint identically for any response', () => {
    const round = getMaskChipCanvas('round', 'wc/builtin-chalk');
    const chalk = getMaskChipCanvas('chalk', 'wc/builtin-chalk');
    // The chip is the engine's tip: one byte → one grayscale pixel.
    const mask = strokeTipData('round', 'wc/builtin-chalk');
    const pixels = pixelsOf(round);
    let mismatched = 0;
    for (let i = 0; i < mask.length; i += 1) {
      if (pixels[i * 4] !== mask[i] || pixels[i * 4 + 1] !== mask[i] || pixels[i * 4 + 2] !== mask[i]) {
        mismatched += 1;
      }
    }
    expect(mismatched, 'every chip pixel equals the engine tip byte').toBe(0);
    expect(differingPixels(pixels, pixelsOf(chalk)), 'the texture wins over the response').toBe(0);
  });

  it('a registry write under the same ids repaints instead of serving stale bytes', () => {
    const id = 'wc/custom-chip-generation';
    registerMask(id, new Uint8Array(TIP_MASK_BYTES).fill(10));
    const before = getMaskChipCanvas('round', id);
    expect(pixelsOf(before)[0]).toBe(10);

    registerMask(id, new Uint8Array(TIP_MASK_BYTES).fill(200));
    const after = getMaskChipCanvas('round', id);
    expect(after).not.toBe(before);
    expect(pixelsOf(after)[0]).toBe(200);
  });

  it('clearMaskChipCache() empties the map', () => {
    const first = getMaskChipCanvas('chalk', 'wc/builtin-chalk');
    expect(getMaskChipCanvas('chalk', 'wc/builtin-chalk')).toBe(first);
    clearMaskChipCache();
    expect(getMaskChipCanvas('chalk', 'wc/builtin-chalk')).not.toBe(first);
  });

  it('never serializes the chip bitmap', () => {
    const source = readFileSync(resolve(__dirname, 'watercolorMaskChip.ts'), 'utf8');
    expect(source, 'no bitmap serialization').not.toMatch(/toDataURL|toBlob/);
  });

  it('blits the cached chip onto a visible canvas', () => {
    const chip = getMaskChipCanvas('chalk', 'wc/builtin-chalk');
    const target = makeChipCanvas();
    blitMaskChip(target as unknown as HTMLCanvasElement, 'chalk', 'wc/builtin-chalk');
    expect(target.width, 'visible bitmap matches the chip').toBe(chip.width);
    expect(target.height, 'visible bitmap matches the chip').toBe(chip.height);
    expect(target.ops.clearRect.length, 'one clear').toBe(1);
    expect(target.ops.drawImage.length, 'one draw').toBe(1);
    expect(target.ops.drawImage[0]![0], 'draws the cached chip').toBe(chip);
  });
});
