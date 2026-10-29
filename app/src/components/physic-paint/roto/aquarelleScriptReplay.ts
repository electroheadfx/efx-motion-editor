// ============================================================
//  261029-lsr — the ONE script-replay orchestration.
//
//  A recorded-script undo/redo (a `paint` stroke undo, or any
//  `aquarelle-script` edit) is: invalidate any in-flight live-pixel
//  capture for the frame, recover the durable base, resolve (or
//  build) the edit, swap the script snapshot, reset the live sheet,
//  re-bake through the shared Apply path, and only then notify the
//  source revision and republish the frame's owner.
//
//  Pure and injectable on purpose (D-05): the Studio supplies the
//  ports; `aquarelleScriptReplay.test.ts` pins the order, the
//  display-digest == bake-digest invariant and every fail-closed
//  path without a WebGL context. No signals, no DOM, no imports.
//
//  Two ordering laws live here:
//   1. `invalidate` is the FIRST step and runs synchronously, before
//      any await — `applyAquarelleTimeline` force-flushes pending
//      live-pixel captures at its own first await, so a capture that
//      was queued before the undo must already be dead by then.
//   2. `ensure-base` precedes `prepare`: durable-base recovery can
//      bump `aquarelleStrokesRevision`, so an edit built before it
//      would carry a stale `after.revision` and fail the guard on
//      every undo (R-1).
// ============================================================

export type AquarelleReplayDirection = 'undo' | 'redo';

export type AquarelleReplayStep =
  | 'invalidate'
  | 'ensure-base'
  | 'prepare'
  | 'restore'
  | 'reset'
  | 'rebake';

export interface AquarelleReplayPorts<Revert> {
  /** Layer A capture guard: synchronous, first, before any await. */
  invalidate: () => void;
  /** Durable-base recovery; a rejection is swallowed (the bake refuses). */
  ensureBase: () => Promise<boolean>;
  /** Build the edit when the caller has no id yet (omit for pre-built ids). */
  prepare?: () => number | null;
  /** Revision-authoritative snapshot swap; null = fail closed. */
  restore: (editId: number, direction: AquarelleReplayDirection) => Revert | null;
  /** Reset the live sheet so the bake republishes the only authority. */
  resetSheet: () => void;
  /** Re-bake through the shared Apply path; false/rejection = fail closed. */
  rebake: () => Promise<boolean>;
  /** Undo the snapshot swap after a failed reset or bake (raw rollback). */
  rollback: (revert: Revert) => void;
  notify: () => void;
  publishOwner: () => void;
}

export interface AquarelleScriptReplayInput<Revert> {
  direction: AquarelleReplayDirection;
  /** A pre-built edit id: `prepare` is never called when it is present. */
  editId?: number;
  ports: AquarelleReplayPorts<Revert>;
  onStep?: (step: AquarelleReplayStep) => void;
}

/**
 * Run one script replay. Never throws to the caller and never reorders the
 * steps; returns true only when the snapshot swap AND the re-bake succeeded
 * (the sheet is reset and the owner republished in that case).
 */
export async function runAquarelleScriptReplay<Revert>(
  input: AquarelleScriptReplayInput<Revert>,
): Promise<boolean> {
  const { direction, ports, onStep } = input;

  // (1) Synchronous, before ANY await: kill queued pre-undo captures.
  onStep?.('invalidate');
  ports.invalidate();

  // (2) Base recovery precedes the build (R-1). A rejection is swallowed —
  // the publish below refuses on its own when the base is still unknown.
  onStep?.('ensure-base');
  try {
    await ports.ensureBase();
  } catch {
    // Intentionally ignored: the bake is the single authority on that.
  }

  // (3) Resolve the edit id: a pre-built id skips the build entirely.
  let editId = input.editId;
  if (editId === undefined) {
    onStep?.('prepare');
    editId = ports.prepare?.() ?? undefined;
  }
  if (editId === undefined) return false;

  // (4) Revision-authoritative swap; null fails closed, nothing done. A throw
  // here is still BEFORE any swap was installed, so there is nothing to revert.
  onStep?.('restore');
  let revert: Revert | null = null;
  try {
    revert = ports.restore(editId, direction);
  } catch {
    return false;
  }
  if (revert === null) return false;

  // (5) The live sheet must be gone before the bake publishes. The swap is
  // installed now, so a throw here must put the script back exactly once.
  onStep?.('reset');
  try {
    ports.resetSheet();
  } catch {
    try {
      ports.rollback(revert);
    } catch {
      // The raw restore itself failed; nothing else can be done here.
    }
    return false;
  }

  // (6) One shared Apply; a false or rejected bake rolls the script back.
  onStep?.('rebake');
  let ok = false;
  try {
    ok = await ports.rebake();
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      ports.rollback(revert);
    } catch {
      // The raw restore itself failed; nothing else can be done here.
    }
    return false;
  }

  // (7) Notify, then let the single owner resolver republish the frame. Both
  // are publish-side effects: a throw must never roll back a successful bake
  // (the sheet already IS the post-undo truth).
  try {
    ports.notify();
  } catch {
    // Best effort: the bake committed, so the undo still succeeded.
  }
  try {
    ports.publishOwner();
  } catch {
    // Best effort: the bake committed, so the undo still succeeded.
  }
  return true;
}
