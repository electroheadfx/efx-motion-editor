// ============================================================
//  Aquarelle brush tips (R1.7 / D-07). Categories are part of
//  the data model, not just display — the 14-tip pack ships
//  grouped round / flat / texture / experimental, and custom
//  PNG/JPG imports land in `custom`. Per-brush multipliers ride
//  the stroke as toolOverrides (see payload/toStudioStroke.ts).
//
//  The tip record IS the per-brush property surface: the eight
//  numeric multipliers are flat fields on AquarelleTip so the
//  brush-pack snapshot (56-04 / D-23) carries them as plain
//  serializable numbers.
// ============================================================

/**
 * Tip category grouping (D-07). Custom imports land in `custom`.
 * UI-SPEC display names: Round / Flat / Texture / Experimental / Custom.
 */
export type AquarelleTipCategory = 'round' | 'flat' | 'texture' | 'experimental' | 'custom'

/** The 8 numeric multipliers snapshotted onto a stroke at record time (D-08). */
export interface AquarelleToolOverrides {
  /** Tip size multiplier. */
  tip: number
  /** Aspect ratio multiplier. */
  aspect: number
  /** Rotation multiplier. */
  rotation: number
  /** Size-curve multiplier. */
  sizeCurve: number
  /** Scatter multiplier. */
  scatter: number
  /** Capacity multiplier. */
  capacity: number
  /** Grain multiplier. */
  grain: number
  /** Wet-round multiplier. */
  wetRound: number
}

/**
 * One brush tip record in the project brush pack. Extends the
 * toolOverrides surface so the tip itself carries the eight
 * per-brush multipliers (AQUA-03 / R1.7).
 */
export interface AquarelleTip extends AquarelleToolOverrides {
  /** Stable id — referenced by strokes, travels in the .mce brush-pack snapshot. */
  id: string
  category: AquarelleTipCategory
  name: string
}

/** Neutral multipliers (global value × 1 = global value). */
export const NEUTRAL_TOOL_OVERRIDES: AquarelleToolOverrides = Object.freeze({
  tip: 1,
  aspect: 1,
  rotation: 1,
  sizeCurve: 1,
  scatter: 1,
  capacity: 1,
  grain: 1,
  wetRound: 1,
})

/** The eight multiplier field names, in declaration order. */
export const TOOL_OVERRIDE_FIELDS: ReadonlyArray<keyof AquarelleToolOverrides> = Object.freeze([
  'tip',
  'aspect',
  'rotation',
  'sizeCurve',
  'scatter',
  'capacity',
  'grain',
  'wetRound',
])

function tip(
  id: string,
  category: AquarelleTipCategory,
  name: string,
  props: Partial<AquarelleToolOverrides>,
): AquarelleTip {
  return Object.freeze({
    id,
    category,
    name,
    ...NEUTRAL_TOOL_OVERRIDES,
    ...props,
  })
}

/**
 * The base tip pack — 14 tips across round / flat / texture /
 * experimental (D-07 categories live in the data model so the
 * Krita-style picker has its grouping key from day one).
 */
export const TIPS: readonly AquarelleTip[] = Object.freeze([
  // round (4)
  tip('wc/round-small', 'round', 'Round small', {
    tip: 0.6,
    scatter: 0.8,
    capacity: 0.9,
    wetRound: 1.2,
  }),
  tip('wc/round-medium', 'round', 'Round medium', {}),
  tip('wc/round-large', 'round', 'Round large', {
    tip: 1.8,
    scatter: 1.1,
    capacity: 1.2,
    wetRound: 0.9,
  }),
  tip('wc/round-detail', 'round', 'Round detail', {
    tip: 0.45,
    aspect: 0.9,
    sizeCurve: 1.2,
    scatter: 0.6,
    grain: 1.1,
  }),

  // flat (3)
  tip('wc/flat-wash', 'flat', 'Flat wash', {
    tip: 1.6,
    aspect: 2.0,
    rotation: 0.7,
    capacity: 1.4,
    wetRound: 1.3,
  }),
  tip('wc/flat-angle', 'flat', 'Flat angle', {
    tip: 1.1,
    aspect: 1.8,
    rotation: 1.5,
    sizeCurve: 0.85,
    scatter: 0.7,
  }),
  tip('wc/flat-dry', 'flat', 'Flat dry', {
    tip: 1.3,
    aspect: 1.6,
    capacity: 0.6,
    grain: 1.5,
    wetRound: 0.5,
  }),

  // texture (4)
  tip('wc/texture-grain', 'texture', 'Texture grain', {
    tip: 1.2,
    scatter: 1.4,
    capacity: 0.8,
    grain: 1.8,
    wetRound: 0.8,
  }),
  tip('wc/texture-sponge', 'texture', 'Texture sponge', {
    tip: 1.4,
    scatter: 1.7,
    capacity: 1.1,
    grain: 1.4,
    wetRound: 0.7,
  }),
  tip('wc/texture-salt', 'texture', 'Texture salt', {
    tip: 0.9,
    scatter: 1.9,
    capacity: 0.7,
    grain: 1.6,
    wetRound: 1.1,
  }),
  tip('wc/texture-stipple', 'texture', 'Texture stipple', {
    tip: 0.8,
    aspect: 1.1,
    sizeCurve: 1.3,
    scatter: 1.5,
    grain: 1.3,
  }),

  // experimental (3)
  tip('wc/experimental-bloom', 'experimental', 'Experimental bloom', {
    tip: 1.5,
    scatter: 1.2,
    capacity: 1.6,
    wetRound: 1.9,
  }),
  tip('wc/experimental-bleed', 'experimental', 'Experimental bleed', {
    tip: 1.7,
    aspect: 1.3,
    capacity: 1.8,
    grain: 0.6,
    wetRound: 2.0,
  }),
  tip('wc/experimental-granulate', 'experimental', 'Experimental granulate', {
    tip: 1.1,
    scatter: 1.3,
    capacity: 1.2,
    grain: 2.0,
    wetRound: 0.6,
  }),
])

/** Look up a tip by id. Returns undefined for unknown ids (fail-closed callers). */
export function findTip(tipId: string): AquarelleTip | undefined {
  return TIPS.find((t) => t.id === tipId)
}

/**
 * Project a tip onto the stroke-level toolOverrides shape. The tip
 * already extends the surface, so this is a destructure that drops
 * the identity fields — kept as the one named seam so callers never
 * hand a whole tip record to a consumer expecting only multipliers.
 */
export function toolOverridesFromTip(tip: AquarelleTip): AquarelleToolOverrides {
  return {
    tip: tip.tip,
    aspect: tip.aspect,
    rotation: tip.rotation,
    sizeCurve: tip.sizeCurve,
    scatter: tip.scatter,
    capacity: tip.capacity,
    grain: tip.grain,
    wetRound: tip.wetRound,
  }
}
