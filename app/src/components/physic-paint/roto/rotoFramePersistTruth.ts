// ============================================================
//  quick 261027-klx — the Roto frame-persistence TRUTH TABLE.
//
//  Today `shouldPersistRotoFrame` reads the engine-1 document mirror
//  (`state.tracks[].strokes`). Those arrays stop being populated the
//  moment stroke acceptance routes through the app-owned ledger, so a
//  painted watercolor frame would classify as EMPTY and Roto
//  persistence would silently drop real paint.
//
//  This module states the same law over an explicit truth input, so
//  Wave 3 can re-point the source without changing the law. The
//  payload count is intentionally NOT in the disjunction: payload
//  events can outlive their live strokes (all deleted), and such a
//  frame must stay "empty". `recordedStrokeCount` is the live truth.
// ============================================================

export interface RotoFramePersistTruthInput {
  /** Live recorded strokes for the frame (the watercolor truth source). */
  readonly recordedStrokeCount: number;
  /** Recorded payload events — evidence only, never a persist reason by itself. */
  readonly payloadEventCount: number;
  /** The surviving settings background mode ('transparent' = no fond). */
  readonly bgMode: string;
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * EXACTLY the current semantics (`strokes.length > 0 || bgMode !== 'transparent'`)
 * over an explicit truth input.
 */
export function shouldPersistRotoFrameFromTruth(input: RotoFramePersistTruthInput): boolean {
  return normalizeCount(input.recordedStrokeCount) > 0 || input.bgMode !== 'transparent';
}
