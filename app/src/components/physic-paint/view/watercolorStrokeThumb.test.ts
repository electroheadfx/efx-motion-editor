// ============================================================
//  61-07 (D-12) — the thumb preview law (E8 error backstop).
//
//  The ribbon row must not misrepresent its mode: its thumb paints the
//  crisp sweep it deposits, while every wet preset keeps the bloom.
//  The branch is a pure function of the preset's `renderMode`, chosen
//  exactly like the engine's stamp branch — never from a zeroed
//  parameter. Plain node-env test: `getStrokeThumb` and `drawStroke`
//  need a DOM canvas, so this pins the resolver plus the branch's
//  source contract and never touches a real canvas.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, type BrushPreset } from '@efxlab/efx-watercolor';
import { resolveThumbMode } from './watercolorStrokeThumb';

const RIBBON_ID = 'simple-ribbon';
const SOURCE = readFileSync(resolve(__dirname, './watercolorStrokeThumb.ts'), 'utf8');

function preset(id: string): BrushPreset {
  const found = BRUSH_PRESETS.find((entry) => entry.id === id);
  expect(found, `missing preset ${id}`).toBeDefined();
  return found!;
}

function sourceRegion(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  expect(start, `missing marker: ${startMarker}`).toBeGreaterThan(-1);
  const end = SOURCE.indexOf(endMarker, start + startMarker.length);
  expect(end, `missing marker: ${endMarker}`).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe('resolveThumbMode (61-07)', () => {
  it('selects the crisp sweep for the ribbon preset only', () => {
    expect(resolveThumbMode(preset(RIBBON_ID))).toBe('crisp-sweep');
    for (const entry of BRUSH_PRESETS) {
      if (entry.id === RIBBON_ID) continue;
      expect(resolveThumbMode(entry), `${entry.id} keeps the wet bloom`).toBe('wet');
    }
  });

  it('is a pure function of renderMode, never of a zeroed parameter', () => {
    expect(resolveThumbMode({ renderMode: 'simple-ribbon' })).toBe('crisp-sweep');
    expect(resolveThumbMode({ renderMode: undefined })).toBe('wet');
    expect(resolveThumbMode({})).toBe('wet');
    // The ribbon preset's grain/scatter are zero, and the chalk preset's are
    // not — neither value may steer the branch (only the mode does).
    expect(preset(RIBBON_ID).grain).toBe(0);
    expect(preset(RIBBON_ID).scatter).toBe(0);
    expect(resolveThumbMode(preset(RIBBON_ID))).toBe('crisp-sweep');
  });

  it('the crisp branch serves exactly the one ribbon preset', () => {
    const crisp = BRUSH_PRESETS.filter((entry) => resolveThumbMode(entry) === 'crisp-sweep');
    expect(crisp.map((entry) => entry.id)).toEqual([RIBBON_ID]);
  });
});

describe('crisp-sweep source contract (61-07)', () => {
  it('drawStroke dispatches through resolveThumbMode', () => {
    const draw = sourceRegion('export function drawStroke', 'function drawCrispSweep');
    expect(draw).toContain('resolveThumbMode(b)');
    expect(draw).toContain('drawCrispSweep(');
  });

  it('paints one full-alpha rim with no grain, scatter or seeded dabs', () => {
    const crisp = sourceRegion('function drawCrispSweep', 'Spyable paint seam');
    expect(crisp).not.toMatch(/\bb\.scatter\b/);
    expect(crisp).not.toMatch(/\bb\.grain\b/);
    expect(crisp).not.toMatch(/\brnd\(/);
    expect(crisp).not.toMatch(/Math\.random/);
    expect(crisp).not.toMatch(/\btipImage\b/);
    expect(crisp).toContain('ctx.globalAlpha = 1');
    expect(crisp).toContain('ctx.stroke()');
  });

  it('keeps the thumb cache keyed by the preset id alone', () => {
    // The mode is a property of the preset, so no cache key changes.
    expect(SOURCE).toContain('const cached = thumbCache.get(presetId)');
    expect(SOURCE).toContain('thumbCache.set(presetId, canvas)');
    expect(SOURCE).not.toMatch(/thumbCache\.(get|set)\([^)]*renderMode/);
  });
});
