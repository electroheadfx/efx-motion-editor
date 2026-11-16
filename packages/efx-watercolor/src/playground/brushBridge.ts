// ============================================================
//  brushBridge — the ONE live/bake mapping between a stored stroke
//  and a vendor Brush, under the two-axis law (quick-261115-oh9).
//
//  A stroke carries TWO independent ids:
//    - `brushId`   the RESPONSE: a preset id that owns every Brush
//                  field — physics, size, spacing, rotation, grain…
//    - `textureId` the TEXTURE: an optional mask id that replaces the
//                  footprint (`tip`) and nothing else.
//
//  The law (supersedes the 63-01 TIP-05 "mask wins" rule):
//    base  = presetFor(brushId)
//    tip   = textureId ? resolveMask(textureId) ?? base.tip : base.tip
//    brush = buildBrush({ ...base, tip }, seed)
//
//  A texture therefore can never turn a fixed-rotation response into
//  a follow tip, and never changes a response scalar. `CUSTOM_BASE`
//  is no longer reachable from any texture path.
//
//  Silent fallback: an unknown, unregistered or dropped texture id
//  paints the response's own procedural tip — never throws, never
//  blanks. `strokeTipData` shares this ONE resolution, so a chip can
//  only ever show what the engine actually stamps.
//
//  Accepted loss (declared, no migration, no recovery): a phase-63
//  project stroke whose `brushId` IS a texture id replays through
//  `presetFor` → `round`. The texture id used to be the carrier; the
//  new law reads `textureId`, which such a stroke does not have.
// ============================================================

import { BRUSH_PRESETS, buildBrush, type Brush, type BrushPreset } from './brushes'
import { resolveMask } from '../brushes/maskRegistry'

/** Response id → vendor preset id. Unknown ids fall back to 'round'. */
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

/** Options for {@link buildBrushForStroke} — omit for the plain response brush. */
export interface BrushStrokeOptions {
  /** Mask id replacing the footprint; absent/null keeps the response tip. */
  textureId?: string | null
  /**
   * quick 261116-inu: projected-texture orientation in integer DEGREES
   * (-180..180). The STROKE snapshot is the authority at replay; absent means
   * the library row's default. Ignored when no mask supplied the bytes.
   */
  textureRotation?: number | null
  /** D-08 multiplier bag snapshot at record time. */
  overrides?: BrushMultiplierOverrides | null
  /** Tip-noise seed; the bake path must pass the same seed as the live path. */
  seed?: number
}

function mult(v: number | undefined, fallback = 1): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}

function presetFor(brushId: string): BrushPreset {
  const presetId = TIP_TO_PRESET[brushId] ?? (BRUSH_PRESETS.some((b) => b.id === brushId) ? brushId : 'round')
  return BRUSH_PRESETS.find((b) => b.id === presetId) ?? BRUSH_PRESETS[0]!
}

/**
 * The ONE resolution both public readers share: response preset base,
 * texture mask as the footprint when it resolves, `buildBrush` seed.
 */
function resolveStrokeBrush(
  brushId: string,
  textureId: string | null,
  seed: number,
  textureRotation: number | null = null,
): Brush {
  const base = presetFor(brushId)
  const mask = textureId ? resolveMask(textureId) : null
  // `textureId` rides the brush ONLY when the mask supplied the bytes: the
  // engine's GPU tip cache keys on (id, textureId), so an unknown texture must
  // resolve to the same key as no texture at all.
  return {
    ...buildBrush({ ...base, tip: mask ?? base.tip }, seed),
    textureId: mask ? textureId : null,
    // quick 261116-inu: same law for the rotation — it only means something
    // on a textured tip. A textured rotationless stroke carries 0 degrees
    // (the library default); an untextured/unknown one carries null.
    textureRotation: mask ? textureRotation ?? 0 : null,
  }
}

/**
 * Build the vendor Brush for a recorded stroke. `brushId` is the
 * RESPONSE id; `textureId` only replaces the tip; `overrides` are the
 * D-08 multipliers from the same snapshot. Same call on the live path
 * and the bake path.
 */
export function buildBrushForStroke(brushId: string, options?: BrushStrokeOptions | null): Brush {
  const base = resolveStrokeBrush(
    brushId,
    options?.textureId ?? null,
    options?.seed ?? 7,
    options?.textureRotation ?? null,
  )
  const overrides = options?.overrides
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

/**
 * The exact tip bytes {@link buildBrushForStroke} would stamp for the
 * same response + texture + seed. Catalog chips render these, so a
 * chip can never show a footprint the engine would not stamp.
 */
export function strokeTipData(brushId: string, textureId: string | null = null, seed = 7): Uint8Array {
  return resolveStrokeBrush(brushId, textureId, seed).tipData
}
