// ============================================================
//  settleCap — the ONE visible settle window (261019c, 261123-vkb).
//
//  The sheet force-dries after this VISIBLE settle window instead of
//  cooking through the engine's full awake window — the fully settled
//  wash diffuses until it looks washed out. Three consumers share this
//  cap so they keep the denser look the artist sees while painting:
//
//    - the aquarelle bake (`bake/aquarelleBake.ts`, which re-exports this
//      module's function — the `./bake` barrel and the main entry resolve
//      the same binding);
//    - the live layer's recorded cuisson (`AquarelleCanvasLayer.tsx`);
//    - the engine's held awake window (`Engine.awakeUntil()`, 261123-vkb:
//      while the Studio sheet is held, the sim sleeps at this cap after
//      the last wet input instead of running its full natural window).
//
//  ZERO imports by design: the bake must not pull the playground (and the
//  engine must not pull the bake) — this neutral module is the one home
//  the import graph allows.
// ============================================================

/** One 60 Hz host tick in ms — the unit `aquarelleVisibleSettleTicks` returns. */
export const SETTLE_TICK_MS = 1000 / 60;

/**
 * The visible settle window in 60 Hz ticks.
 *
 * UNIT LAW: the argument is Dry Speed in PERCENT 0..100 (the engine's own
 * `params.dry` is 0..1 — multiply by 100 before calling); the return is
 * 60 Hz ticks. Dry Speed still scales it: 0 → 300, 50 → 165, 100 → 30
 * (≈ 5 s / 2.75 s / 0.5 s). A non-finite argument falls through the guard
 * to the 50 percent default.
 */
export function aquarelleVisibleSettleTicks(dryPercent: number): number {
  const dry = typeof dryPercent === 'number' && Number.isFinite(dryPercent)
    ? Math.max(0, Math.min(100, dryPercent))
    : 50
  return Math.round(30 + 270 * (1 - dry / 100))
}
