import type { RotoScriptOperationError } from './physicsPaintRotoScriptClipboard';

/**
 * quick-260922-al1 (Task 3): the human-readable refusal that a failed Action
 * apply publishes to the existing status capsule.
 *
 * Before this, a refused apply only reached `setLastError`, whose value the
 * Studio destructures away (`const [, setLastError] = useState(...)`) — the user
 * saw nothing. This mapper is the SURFACING change only: the clipboard keeps its
 * codes, its operation errors and its `Failed` status untouched.
 *
 * Two codes carry their refusal in the error's own message and are reused
 * verbatim, because the count they report is the whole point:
 * `apply-partial-failure` (physicsPaintRotoScriptClipboard.ts:561/:575/:548) and
 * `apply-cancelled` (:573), which is reachable with `completed > 0` — a copy
 * claiming "nothing changed" there would be false, so it mirrors its sibling.
 * `apply-invalidated` (:576) is only reachable with `completed === 0`, so there
 * "nothing changed" holds.
 *
 * `apply-empty-target-failed` is set on several paths whose only shared
 * observable is the refusal (:666 `prepareTarget` threw — a shape that appends
 * `: ${cause}` to the message, :688 it resolved null, and :688 again it resolved
 * but stopped being current across the await). A code-keyed mapper cannot tell
 * them apart, so this copy is built from the code alone and claims no internal
 * cause. The plan's shared observable is stated as written: the destination was
 * not accepted as a physical Roto key on the current layer at the playhead.
 *
 * Every other code, and a null error, maps to null: an unaffected path keeps the
 * clipboard's own message and never gets an invented one.
 */
export const ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET =
  'Apply rejected — the destination was not accepted as a physical Roto key on the current layer at the playhead. Nothing changed.';

export const ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED =
  'Apply rejected — the target changed while applying. Nothing changed; try again.';

function usableMessage(message: unknown): string | null {
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

/**
 * Pure and total: takes the clipboard's operation error (or null/undefined) and
 * returns a user-facing English line, or null when this code has no refusal of
 * its own. No signals, no store, no IO — safe to call from anywhere.
 */
export function buildRotoScriptApplyRefusalMessage(
  error: RotoScriptOperationError | null | undefined,
): string | null {
  if (!error) return null;
  switch (error.code) {
    case 'apply-empty-target-failed':
      return ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET;
    case 'apply-partial-failure':
    case 'apply-cancelled':
      return usableMessage(error.message);
    case 'apply-invalidated':
      return ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED;
    default:
      return null;
  }
}
