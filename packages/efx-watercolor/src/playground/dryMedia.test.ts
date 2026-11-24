// ============================================================
//  261027-gh9f — Dry media stamp law.
//
//  A dry-bristle preset must render as a dry stick, not a felt pen:
//  the stamp shader re-thresholds the tip into a hard, crumbly
//  mask and every dab reads a different slice of the tip, while
//  every watercolour brush keeps the smooth alpha path untouched.
//
//  Phase 64 (MED-29) extended the dry path beyond the legacy chalk
//  stick to the gouache, pastel, graphite and acrylic responses;
//  quick 261124-iq9 retires all but the acrylic one (`bristle-round`),
//  so this file scopes the dry path to the one surviving bristle
//  response and the smooth-path law to the eleven watercolour ones.
// ============================================================

import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, buildBrush } from './brushes';
import { stampFS } from './shaders';

// The preset table's order, restated: the one surviving dry-bristle response
// whose roughness is above zero.
const DRY_IDS = ['bristle-round'];

describe('261027-gh9f dry media stamp law', () => {
  it('the stamp shader carries the per-dab dry threshold and tip jitter', () => {
    expect(stampFS).toContain('uniform float uRough, uJitter;');
    expect(stampFS).toContain('float sharp = mix(t, dry, step(0.0001, uRough));');
    // quick 261116-inu / Task 10: the per-dab jitter now lands on the ROTATED
    // tip-space coordinate (tq); the discard and silhouette keep the unrotated q.
    expect(stampFS).toContain('vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);');
  });

  it('only the dry-bristle response opts into the dry path, and buildBrush keeps the fields for replay', () => {
    const dry = BRUSH_PRESETS.filter((preset) => preset.roughness > 0);
    expect(dry.map((preset) => preset.id)).toEqual(DRY_IDS);
    // quick 261124-iq9: no surviving preset declares stampJitter > 0 — the
    // bristle response states roughness 0.4 and inherits the base jitter 0.
    // The shader's jitter SUPPORT stays pinned by the source assertions above.
    const bristle = BRUSH_PRESETS.find((preset) => preset.id === 'bristle-round')!;
    expect(bristle.roughness).toBeGreaterThan(0);
    expect(bristle.stampJitter).toBe(0);
    const brush = buildBrush(bristle);
    expect(brush.roughness).toBe(bristle.roughness);
    expect(brush.stampJitter).toBe(bristle.stampJitter);
  });

  it('every preset outside the dry list keeps the smooth stamp path', () => {
    for (const preset of BRUSH_PRESETS) {
      if (DRY_IDS.includes(preset.id)) continue;
      expect(preset.roughness, preset.id).toBe(0);
      expect(preset.stampJitter, preset.id).toBe(0);
    }
  });
});
