// ============================================================
//  The brush-thumb cache contract.
//
//  `getStrokeThumb` and `drawStroke` need a DOM canvas, so this
//  node-env test pins the cache key law from the source: one canvas
//  per preset id, never serialized and never re-keyed by a mode.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(resolve(__dirname, './watercolorStrokeThumb.ts'), 'utf8');

describe('stroke thumb cache', () => {
  it('keeps the cache keyed by the preset id alone', () => {
    expect(SOURCE).toContain('const cached = thumbCache.get(presetId)');
    expect(SOURCE).toContain('thumbCache.set(presetId, canvas)');
  });
});
