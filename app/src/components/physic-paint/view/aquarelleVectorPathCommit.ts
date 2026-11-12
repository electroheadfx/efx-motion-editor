// ============================================================
//  61-15 — the vector commit bake seam (G-1/G-2).
//
//  A vector stroke paints no engine dabs: its only pixels come from
//  replaying the recorded script. This module owns the ONE route
//  decision (defer the pixels vs re-bake them) and the ONE single-
//  flight sequence around reset + apply. It never records, restores
//  or publishes — it only sequences. No Studio import: the leaf is
//  unit-testable without mounting the Studio.
// ============================================================

export const VECTOR_PATH_SCRIPT_OFF_MESSAGE =
  'Vector path rejected — Script is off, so the path would not be recorded. Turn Script on and draw it again.';

/**
 * 261112-i6d: the status line published while a path edit re-bakes the script.
 * An edit is silent for as long as the whole script takes to replay, which
 * reads as a dead click; this line is the ONE statement that the click landed
 * and the sheet is being rebuilt.
 */
export const VECTOR_PATH_REBUILDING_MESSAGE = 'Rebuilding path…';

/**
 * A stroke is a vector commit only when it carries anchors. The list is
 * the ONE signal — a missing or empty list is an ordinary dabs stroke.
 */
export function isVectorAquarelleStroke(stroke: { anchors?: readonly unknown[] }): boolean {
  return Array.isArray(stroke.anchors) && stroke.anchors.length > 0;
}

/**
 * Draft and wireframe both defer the engine re-render: the committed sheet
 * keeps its last rendered pixels until the ONE settle runs. Any other
 * state re-bakes immediately.
 */
export function resolveVectorCommitRoute(latches: { draft: boolean; wireframe: boolean }): 'defer-pixels' | 'rebake' {
  return latches.draft || latches.wireframe ? 'defer-pixels' : 'rebake';
}

export interface AquarelleScriptRebakeSequence {
  readonly isInFlight: () => boolean;
  readonly beginInFlight: () => void;
  readonly endInFlight: () => void;
  readonly resetSheet: () => void;
  readonly applyTimeline: () => Promise<boolean>;
  readonly onSuccess?: () => void;
  readonly onFailure?: () => void;
}

/**
 * ONE in-flight latch per rebake. Already in flight → return false without
 * touching anything (fail closed). Otherwise reset, apply, then exactly one
 * terminal callback: `onSuccess` on true, `onFailure` on false or a rejected
 * apply. The latch is cleared in `finally`, before the callback runs.
 */
export async function runAquarelleScriptRebake(sequence: AquarelleScriptRebakeSequence): Promise<boolean> {
  if (sequence.isInFlight()) return false;
  sequence.beginInFlight();
  let ok = false;
  try {
    sequence.resetSheet();
    ok = await sequence.applyTimeline();
  } catch {
    ok = false;
  } finally {
    sequence.endInFlight();
  }
  if (ok) sequence.onSuccess?.();
  else sequence.onFailure?.();
  return ok;
}
