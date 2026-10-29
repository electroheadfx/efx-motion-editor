// ============================================================
//  Standing-water truth — the host-visible "the Water tool can
//  act here" predicate.
//
//  Water only blends live standing water. Offering the tool on
//  a settled sheet (or on baked pixels) is a dead control, so
//  the host greys it unless this predicate holds for the live
//  engine.
// ============================================================

/** Below this the water is too thin to move pigment, so the sim can sleep. */
export const WET_THRESHOLD = 0.004;   // below this nothing moves, so the sim can sleep

export interface WetState {
  /** Highest water amount anywhere on the sheet (engine wetPeak). */
  wetPeak: number;
  /** Timestamp (ms, engine clock) at which standing water is gone. */
  wetUntilMs: number;
  /** Engine clock "now", ms. */
  nowMs: number;
  /** True while the Dry fix bake is running. */
  fixing: boolean;
}

/**
 * True while the sheet holds standing water the Water tool can act on — the
 * host-visible truth behind the Water gate.
 *
 * `Engine.isAwake` is deliberately NOT reused here: it also reports the Dry fix
 * bake (`fixTimer > 0`), the post-stroke min-awake window and an in-flight
 * stroke. Those answer "does the simulation still need frames", not "is there
 * water to blend".
 */
export function isSheetWet(state: WetState): boolean {
  return !state.fixing && state.wetPeak > WET_THRESHOLD && state.nowMs < state.wetUntilMs;
}
