// Bake host — ported finalizationQueue pattern (D-21 / HOST-04)
// Phase 56 consumer API: createBakeHost is exported but no app/ bake path is
// rewired to it in phase 55 (R1.3 no-behavior-change-at-seam).
export { createBakeHost, BAKE_TURN_CONCURRENCY } from './bakeHost';
export type {
  BakeHost,
  BakeHostOptions,
  BakeHostTurn,
  BakeTurnMode,
  BakeTurnOutcome,
  BakeTurnStage,
} from './bakeHost';
