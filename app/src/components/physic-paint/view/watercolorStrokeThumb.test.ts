// ============================================================
//  The brush-thumb cache contract.
//
//  `getStrokeThumb` and `drawStroke` need a DOM canvas, so this
//  node-env test pins the cache-key law from the source.
//
//  63-06 / D-05 / T-63-18: the key is the tip id PLUS the
//  mask-registry generation, a mask-backed tip paints through
//  `buildBrushForStroke` (never a preset lookup, never a throw),
//  and the reset drops BOTH maps — the stroke thumb and the
//  tinted tip canvas it blits.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(resolve(__dirname, './watercolorStrokeThumb.ts'), 'utf8');

describe('stroke thumb cache (63-06 D-05 / T-63-18)', () => {
  it('keys the cache by tip id plus the mask generation', () => {
    expect(SOURCE).toContain('`${tipId}|g${maskGeneration()}`');
    expect(SOURCE).toContain('const cached = thumbCache.get(key)');
    expect(SOURCE).toContain('thumbCache.set(key, canvas)');
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
