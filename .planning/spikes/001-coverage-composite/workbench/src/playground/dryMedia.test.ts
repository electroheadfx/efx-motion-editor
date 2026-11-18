// ============================================================
//  261027-gh9f — Dry media stamp law.
//
//  The chalk preset must render as a dry stick, not a felt pen:
//  the stamp shader re-thresholds the tip into a hard, crumbly
//  mask and every dab reads a different slice of the tip, while
//  every watercolour brush keeps the smooth alpha path untouched.
//
//  Phase 64 (MED-29): the spec's dry-media table extends the dry
//  path beyond chalk to the gouache, pastel, graphite and acrylic
//  responses; the legacy "only chalk" pin is repointed, never
//  deleted, and the smooth-path law is now scoped to watercolour.
// ============================================================

import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, buildBrush } from './brushes';
import { stampFS } from './shaders';

// The preset table's order, restated: the chalk stick plus the eight
// spec-table responses whose roughness is above zero (graphite-6b is the one
// new response that keeps a smooth stamp path).
const DRY_IDS = [
  'chalk',
  'gouache-round',
  'gouache-flat',
  'pastel-soft',
  'conte-hard',
  'graphite-pencil',
  'bristle-flat',
  'bristle-round',
];

describe('261027-gh9f dry media stamp law', () => {
  it('the stamp shader carries the per-dab dry threshold and tip jitter', () => {
    expect(stampFS).toContain('uniform float uRough, uJitter;');
    expect(stampFS).toContain('float sharp = mix(t, dry, step(0.0001, uRough));');
    // quick 261116-inu / Task 10: the per-dab jitter now lands on the ROTATED
    // tip-space coordinate (tq); the discard and silhouette keep the unrotated q.
    expect(stampFS).toContain('vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);');
  });

  it('only the dry-media responses opt into the dry path, and buildBrush keeps the fields for replay', () => {
    const dry = BRUSH_PRESETS.filter((preset) => preset.roughness > 0);
    expect(dry.map((preset) => preset.id)).toEqual(DRY_IDS);
    const chalk = BRUSH_PRESETS.find((preset) => preset.id === 'chalk')!;
    expect(chalk.stampJitter).toBeGreaterThan(0);
    const brush = buildBrush(chalk);
    expect(brush.roughness).toBe(chalk.roughness);
    expect(brush.stampJitter).toBe(chalk.stampJitter);
  });

  it('every preset outside the dry list keeps the smooth stamp path', () => {
    for (const preset of BRUSH_PRESETS) {
      if (DRY_IDS.includes(preset.id)) continue;
      expect(preset.roughness, preset.id).toBe(0);
      expect(preset.stampJitter, preset.id).toBe(0);
    }
  });
});
