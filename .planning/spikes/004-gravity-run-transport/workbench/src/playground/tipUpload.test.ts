// ============================================================
//  tipUpload — a mask-backed tip is uploaded bottom-up
//  (quick 261116-inu).
//
//  The stamp samples `t = 1` as the TOP of the dab (`vUv.y = 1` is
//  up), while `texImage2D` maps the first data row to `t = 0`. A
//  stored mask keeps image order — row 0 is the picture's top, which
//  is why the library's `.webp` opens the right way up in any viewer
//  and the chip preview reads correctly — so the upload must reverse
//  the rows or every texture paints vertically inverted. Abstract
//  grain hides the mistake; lettering does not.
//
//  Procedural tips never pass through this: they are generated in
//  engine order, and flipping them would change the appearance of
//  every stroke recorded before textures existed.
// ============================================================

import { describe, expect, it } from 'vitest';
import { tipRowsForUpload } from './brushes';

/** Each row holds its own index, so a row reversal is directly visible. */
function ramp(size: number): Uint8Array {
  const data = new Uint8Array(size * size);
  for (let row = 0; row < size; row++) data.fill(row, row * size, (row + 1) * size);
  return data;
}

describe('tipRowsForUpload', () => {
  it('reverses the row order and leaves columns untouched', () => {
    const out = tipRowsForUpload(ramp(4), 4);
    expect([...out.subarray(0, 4)], 'the top row becomes the old bottom row').toEqual([3, 3, 3, 3]);
    expect([...out.subarray(12, 16)], 'the bottom row becomes the old top row').toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('is its own inverse', () => {
    const original = ramp(8);
    expect(tipRowsForUpload(tipRowsForUpload(original, 8), 8)).toEqual(original);
  });

  it('returns the input untouched for a 1-row tip or a mis-sized buffer', () => {
    const single = new Uint8Array([7]);
    expect(tipRowsForUpload(single, 1)).toBe(single);

    const misSized = new Uint8Array(10);
    expect(tipRowsForUpload(misSized, 4)).toBe(misSized);
  });

  it('does not mutate its input', () => {
    const original = ramp(4);
    const copy = original.slice();
    tipRowsForUpload(original, 4);
    expect(original).toEqual(copy);
  });
});
