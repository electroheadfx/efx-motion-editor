// ============================================================
//  quick 261024-vga — app-facing re-export of the ONE stack-position
//  law. The implementation lives in the engine package (the brush
//  stack consumes it too); both adapters must share one law, so the
//  app never re-derives the arithmetic.
// ============================================================

export {
  clampStackPosition,
  reorderForStackPosition,
  targetIndexForStackPosition,
} from '@efxlab/efx-physic-paint'
export type { StackReorderResult } from '@efxlab/efx-physic-paint'
