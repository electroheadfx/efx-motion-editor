// ============================================================
//  261027-gh9f — Dry media stamp law.
//
//  The chalk preset must render as a dry stick, not a felt pen:
//  the stamp shader re-thresholds the tip into a hard, crumbly
//  mask and every dab reads a different slice of the tip, while
//  every wet brush keeps the smooth alpha path untouched.
// ============================================================

import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, buildBrush } from './brushes';
import { stampFS } from './shaders';

describe('261027-gh9f dry media stamp law', () => {
  it('the stamp shader carries the per-dab dry threshold and tip jitter', () => {
    expect(stampFS).toContain('uniform float uRough, uJitter;');
    expect(stampFS).toContain('float sharp = mix(t, dry, step(0.0001, uRough));');
    expect(stampFS).toContain('vec2 uv = clamp(q * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);');
  });

  it('only chalk opts into the dry path, and buildBrush keeps the fields for replay', () => {
    const dry = BRUSH_PRESETS.filter((preset) => preset.roughness > 0);
    expect(dry.map((preset) => preset.id)).toEqual(['chalk']);
    const chalk = dry[0]!;
    expect(chalk.stampJitter).toBeGreaterThan(0);
    const brush = buildBrush(chalk);
    expect(brush.roughness).toBe(chalk.roughness);
    expect(brush.stampJitter).toBe(chalk.stampJitter);
  });

  it('every other preset keeps the smooth stamp path', () => {
    for (const preset of BRUSH_PRESETS) {
      if (preset.id === 'chalk') continue;
      expect(preset.roughness, preset.id).toBe(0);
      expect(preset.stampJitter, preset.id).toBe(0);
    }
  });
});
