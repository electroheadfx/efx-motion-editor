/**
 * quick-261115-oh9 — the texture-row chip is the ENGINE'S tip.
 *
 * Laws pinned here:
 *   the canvas edge comes from the mask's OWN bytes (512 for a machine-
 *     library texture, 192 for a procedural response tip) — never TIP_SIZE
 *   one ImageData pixel per mask byte as (v, v, v, 255) — white
 *     footprint on black ground
 *   the bytes come from strokeTipData(), the SAME resolution the
 *     engine stamps (never a second tip generator, never a decode)
 *   the cache key carries the response id: ('chalk', null) and
 *     ('flat', null) never share a canvas
 *   a texture replaces the footprint identically for any response
 *   the cache key carries the mask-registry generation: a registry
 *     write under the same ids can never serve stale bytes
 *   the cache key carries the rotation, and a rotated chip draws
 *     through translate/rotate with smoothing (quick 261116-inu / Task 10)
 *   clearMaskChipCache() empties the map
 *   never toDataURL / toBlob (52.1 D-19)
 *
 * Render tests materialize the minimal canvas stub (no DOM env; the
 * app's vitest config sets no `environment` by project law).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TIP_MASK_BYTES,
  TIP_MASK_EDGE,
  strokeTipData,
} from '@efxlab/efx-watercolor';
import { registerMask, resetMaskRegistry } from '@efxlab/efx-watercolor/brushes';
import {
  blitMaskChip,
  clearMaskChipCache,
  getMaskChipCanvas,
} from './watercolorMaskChip';

/** A machine-library row's id — the only texture id space left. */
const TEXTURE_ID = 'wc/custom-chip01234567';

interface StubImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface StubCanvas {
  width: number;
  height: number;
  image: StubImage | null;
  ops: {
    clearRect: unknown[][];
    drawImage: unknown[][];
    translate: unknown[][];
    rotate: unknown[][];
  };
  context: Record<string, unknown>;
  getContext: () => Record<string, unknown>;
}

/** A canvas stub that records the putImageData payload and the draw ops. */
function makeChipCanvas(): StubCanvas {
  const canvas: StubCanvas = {
    width: 0,
    height: 0,
    image: null,
    ops: { clearRect: [], drawImage: [], translate: [], rotate: [] },
    context: {},
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
    translate(...args: unknown[]) {
      canvas.ops.translate.push([...args]);
    },
    rotate(...args: unknown[]) {
      canvas.ops.rotate.push([...args]);
    },
    imageSmoothingEnabled: false,
    globalAlpha: 1,
  };
  canvas.context = context;
  return canvas;
}

let originalDocument: typeof globalThis.document;

/**
 * The chip's source pixels. The visible chip never holds the ImageData itself:
 * it blits a painted source canvas (the rotation step), so follow that one hop.
 */
function imageOf(chip: HTMLCanvasElement): StubImage {
  const stub = chip as unknown as StubCanvas;
  const source = stub.ops.drawImage[0]?.[0] as StubCanvas | undefined;
  expect(source?.image, 'chip must have painted an ImageData').toBeTruthy();
  return source!.image!;
}

/** A 512 mask with a deterministic ink/ground split. */
function mask512(): Uint8Array {
  const mask = new Uint8Array(TIP_MASK_BYTES);
  for (let i = 0; i < mask.length; i += 1) mask[i] = i % 251;
  return mask;
}

function differingPixels(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let differing = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) differing += 1;
  }
  return differing;
}

beforeEach(() => {
  originalDocument = globalThis.document;
  clearMaskChipCache();
  resetMaskRegistry();
  Object.assign(globalThis, {
    document: {
      createElement: () => makeChipCanvas(),
    },
  });
});

afterEach(() => {
  Object.assign(globalThis, { document: originalDocument });
  clearMaskChipCache();
  resetMaskRegistry();
});

describe('watercolorMaskChip — the engine tip as a grayscale chip (quick-261115-oh9)', () => {
  it('uses the mask’s own edge: 512 for a machine texture, 192 for a response tip', () => {
    registerMask(TEXTURE_ID, mask512());
    const textured = getMaskChipCanvas('round', TEXTURE_ID);
    expect(textured.width).toBe(TIP_MASK_EDGE);
    expect(textured.height).toBe(TIP_MASK_EDGE);

    const procedural = getMaskChipCanvas('chalk', null);
    expect(procedural.width, 'a procedural tip stays 192').toBe(192);
    expect(procedural.height).toBe(192);
  });

  it('writes each mask byte as (v, v, v, 255)', () => {
    const mask = mask512();
    registerMask(TEXTURE_ID, mask);
    const canvas = getMaskChipCanvas('round', TEXTURE_ID);
    expect(canvas.width).toBe(TIP_MASK_EDGE);
    const pixels = imageOf(canvas).data;
    expect(strokeTipData('round', TEXTURE_ID).length).toBe(TIP_MASK_BYTES);

    const inkIndex = mask.findIndex((value) => value > 0);
    expect(inkIndex, 'the fixture mask has ink').toBeGreaterThanOrEqual(0);
    const ink = mask[inkIndex]!;
    expect([pixels[inkIndex * 4], pixels[inkIndex * 4 + 1], pixels[inkIndex * 4 + 2], pixels[inkIndex * 4 + 3]]).toEqual([
      ink,
      ink,
      ink,
      255,
    ]);

    const zeroIndex = mask.findIndex((value) => value === 0);
    expect(zeroIndex, 'the fixture mask has ground').toBeGreaterThanOrEqual(0);
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
    expect(differingPixels(imageOf(chalk).data, imageOf(flat).data)).toBeGreaterThan(0);
  });

  it('a texture replaces the footprint identically for any response', () => {
    const mask = mask512();
    registerMask(TEXTURE_ID, mask);
    const round = getMaskChipCanvas('round', TEXTURE_ID);
    const chalk = getMaskChipCanvas('chalk', TEXTURE_ID);
    // The chip is the engine's tip: one byte → one grayscale pixel.
    const pixels = imageOf(round).data;
    let mismatched = 0;
    for (let i = 0; i < mask.length; i += 1) {
      if (pixels[i * 4] !== mask[i] || pixels[i * 4 + 1] !== mask[i] || pixels[i * 4 + 2] !== mask[i]) {
        mismatched += 1;
      }
    }
    expect(mismatched, 'every chip pixel equals the engine tip byte').toBe(0);
    expect(differingPixels(pixels, imageOf(chalk).data), 'the texture wins over the response').toBe(0);
  });

  it('a registry write under the same ids repaints instead of serving stale bytes', () => {
    registerMask(TEXTURE_ID, new Uint8Array(TIP_MASK_BYTES).fill(10));
    const before = getMaskChipCanvas('round', TEXTURE_ID);
    expect(imageOf(before).data[0]).toBe(10);

    registerMask(TEXTURE_ID, new Uint8Array(TIP_MASK_BYTES).fill(200));
    const after = getMaskChipCanvas('round', TEXTURE_ID);
    expect(after).not.toBe(before);
    expect(imageOf(after).data[0]).toBe(200);
  });

  it('keys the cache on the rotation and draws the mask rotated about its centre', () => {
    registerMask(TEXTURE_ID, mask512());
    const flat = getMaskChipCanvas('round', TEXTURE_ID, 0);
    const rotated = getMaskChipCanvas('round', TEXTURE_ID, 37);
    expect(rotated).not.toBe(flat);
    expect(getMaskChipCanvas('round', TEXTURE_ID, 0), 'a repeated tuple reuses the canvas').toBe(flat);
    expect(getMaskChipCanvas('round', TEXTURE_ID, 37)).toBe(rotated);

    const stub = rotated as unknown as StubCanvas;
    expect(stub.width).toBe(TIP_MASK_EDGE);
    // About the mask centre, by exactly 37°, smoothed, then blitted.
    expect(stub.ops.translate[0]).toEqual([TIP_MASK_EDGE / 2, TIP_MASK_EDGE / 2]);
    expect(stub.ops.rotate[0]![0] as number).toBeCloseTo((37 * Math.PI) / 180, 9);
    expect(stub.ops.translate[1]).toEqual([-TIP_MASK_EDGE / 2, -TIP_MASK_EDGE / 2]);
    expect(stub.ops.drawImage.length, 'one source blit').toBe(1);
    expect(stub.context.imageSmoothingEnabled, 'rotated masks stay continuous').toBe(true);
  });

  it('clearMaskChipCache() empties the map', () => {
    const first = getMaskChipCanvas('chalk', null);
    expect(getMaskChipCanvas('chalk', null)).toBe(first);
    clearMaskChipCache();
    expect(getMaskChipCanvas('chalk', null)).not.toBe(first);
  });

  it('never serializes the chip bitmap', () => {
    const source = readFileSync(resolve(__dirname, 'watercolorMaskChip.ts'), 'utf8');
    expect(source, 'no bitmap serialization').not.toMatch(/toDataURL|toBlob/);
    expect(source, 'the edge comes from the bytes, never TIP_SIZE').not.toContain('TIP_SIZE');
  });

  it('blits the cached chip onto a visible canvas, rotation included', () => {
    registerMask(TEXTURE_ID, mask512());
    const chip = getMaskChipCanvas('round', TEXTURE_ID, 45);
    const target = makeChipCanvas();
    blitMaskChip(target as unknown as HTMLCanvasElement, 'round', TEXTURE_ID, 45);
    expect(target.width, 'visible bitmap matches the chip').toBe(chip.width);
    expect(target.height, 'visible bitmap matches the chip').toBe(chip.height);
    expect(target.ops.clearRect.length, 'one clear').toBe(1);
    expect(target.ops.drawImage.length, 'one draw').toBe(1);
    expect(target.ops.drawImage[0]![0], 'draws the rotated cached chip').toBe(chip);
  });
});
