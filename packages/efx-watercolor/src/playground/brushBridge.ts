// ============================================================
//  brushBridge — canonical tip id + toolOverrides → vendor Brush.
//
//  The payload stores the brush-pack tip id (`wc/round-medium`)
//  and the D-08 multiplier bag. The vendor engine paints with a
//  `Brush` built from a BRUSH_PRESETS entry. This is the ONE
//  mapping both live and bake use so they cannot drift (A1/A2).
// ============================================================

import { BRUSH_PRESETS, buildBrush, type Brush, type BrushPreset } from './brushes'

/** Tip id → vendor preset id. Unknown ids fall back to 'round'. */
const TIP_TO_PRESET: Record<string, string> = {
  'wc/round-small': 'round',
  'wc/round-medium': 'round',
  'wc/round-large': 'round',
  'wc/round-detail': 'detail',
  'wc/flat-wash': 'flat',
  'wc/flat-angle': 'dagger',
  'wc/flat-dry': 'dry',
  'wc/texture-grain': 'dry',
  'wc/texture-sponge': 'sponge',
  'wc/texture-salt': 'spatter',
  'wc/texture-stipple': 'stipple',
  'wc/experimental-bloom': 'mop',
  'wc/experimental-bleed': 'mop',
  'wc/experimental-granulate': 'dry',
}

/** D-08 multiplier bag (neutral = all 1). */
export interface BrushMultiplierOverrides {
  tip?: number
  aspect?: number
  rotation?: number
  sizeCurve?: number
  scatter?: number
  capacity?: number
  grain?: number
  wetRound?: number
}

function mult(v: number | undefined, fallback = 1): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}

function presetFor(brushId: string): BrushPreset {
  const presetId = TIP_TO_PRESET[brushId] ?? (BRUSH_PRESETS.some((b) => b.id === brushId) ? brushId : 'round')
  return BRUSH_PRESETS.find((b) => b.id === presetId) ?? BRUSH_PRESETS[0]!
}

/**
 * Build the vendor Brush for a recorded stroke. `brushId` is the
 * canonical tip id; `overrides` are the D-08 multipliers snapshot
 * at record time. Same call on the live path and the bake path.
 */
export function buildBrushForStroke(
  brushId: string,
  overrides?: BrushMultiplierOverrides | null,
  seed = 7,
): Brush {
  const base = buildBrush(presetFor(brushId), seed)
  if (!overrides) return base
  return {
    ...base,
    aspect: base.aspect * mult(overrides.aspect),
    angle: base.angle * mult(overrides.rotation),
    pressureSize: base.pressureSize * mult(overrides.sizeCurve),
    spacing: base.spacing / mult(overrides.tip),
    scatter: base.scatter * mult(overrides.scatter),
    capacity: base.capacity * mult(overrides.capacity),
    grain: base.grain * mult(overrides.grain),
    wetRound: base.wetRound * mult(overrides.wetRound),
  }
}
