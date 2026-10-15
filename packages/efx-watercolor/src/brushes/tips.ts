// ============================================================
//  Aquarelle brush tips (R1.7 / D-07). Categories are part of
//  the data model, not just display — the 14-tip pack (56-04)
//  extends this file in place. Per-brush multipliers ride the
//  stroke as toolOverrides (see payload/toStudioStroke.ts).
// ============================================================

/** Tip category grouping (D-07). Custom imports land in a user category. */
export type AquarelleTipCategory = 'round' | 'flat' | 'texture' | 'experimental' | 'user'

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

/** One brush tip record in the project brush pack. */
export interface AquarelleTip {
  /** Stable id — referenced by strokes, travels in the .mce brush-pack snapshot. */
  id: string
  category: AquarelleTipCategory
  name: string
  /** Default per-brush multipliers loaded when the tip is selected. */
  defaults: AquarelleToolOverrides
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

/**
 * The base tip pack. 56-04 grows this to 14 tips across
 * round / flat / texture / experimental — categories already
 * exist in the model so the Krita-style picker (D-07) has its
 * grouping key from day one.
 */
export const TIPS: readonly AquarelleTip[] = Object.freeze([
  Object.freeze({
    id: 'wc/round-medium',
    category: 'round' as const,
    name: 'Round medium',
    defaults: NEUTRAL_TOOL_OVERRIDES,
  }),
])

/** Look up a tip by id. Returns undefined for unknown ids (fail-closed callers). */
export function findTip(tipId: string): AquarelleTip | undefined {
  return TIPS.find((tip) => tip.id === tipId)
}
