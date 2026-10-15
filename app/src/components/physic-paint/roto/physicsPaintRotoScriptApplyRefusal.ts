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
 * 55-06 (HOST-05 / DATA-02 / D-09..D-11): the four named cross-engine refusal
 * codes the host yields (55-05) each map to their own visible English line on
 * this SAME surface. Host supplies codes; this mapper names them (D-09). There
 * is no second error channel (D-10).
 *
 * Every other code, and a null error, maps to null: an unaffected path keeps the
 * clipboard's own message and never gets an invented one.
 */

/** Structural shape of a host refusal (55-05 HostScriptRefusal). */
interface HostRefusalInput {
  code: string;
  detail?: string;
}

export const ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET =
  'Apply rejected — the destination was not accepted as a physical Roto key on the current layer at the playhead. Nothing changed.';

export const ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED =
  'Apply rejected — the target changed while applying. Nothing changed; try again.';

export const ROTO_SCRIPT_APPLY_REFUSAL_UNKNOWN_ENGINE =
  'Apply rejected — this script names an unknown paint module. Nothing changed.';

export const ROTO_SCRIPT_APPLY_REFUSAL_MALFORMED_PAYLOAD =
  'Apply rejected — this script could not be read. Nothing changed.';

export const ROTO_SCRIPT_APPLY_REFUSAL_UNREADABLE_LEGACY =
  'Apply rejected — this script is from an older version. Nothing changed.';

export const ROTO_SCRIPT_APPLY_REFUSAL_ENGINE_MISMATCH_GENERIC =
  'Apply rejected — this script is for a different paint module. Nothing changed.';

/**
 * D-15: package ids on disk, display names in the visible line. A module
 * rename must never break the discriminator; the line never leaks the raw id.
 */
const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  'efx-physic-paint': 'Brush',
  'efx-watercolor': 'Water color',
  'efx-krita': 'Krita',
};

function usableMessage(message: unknown): string | null {
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

/**
 * D-11 engine-mismatch line: "this script is for Water color, not Brush" —
 * display names mapped from package ids. `detail` carries
 * "<scriptEngineId>:<targetEngineId>". Without a resolvable pair the generic
 * mismatch line still names the refusal (never a shared fallback with the
 * other three cases).
 */
function buildEngineMismatchLine(detail: string | undefined): string {
  if (typeof detail === 'string' && detail.includes(':')) {
    const [scriptEngineId, targetEngineId] = detail.split(':');
    const scriptName = ENGINE_DISPLAY_NAMES[scriptEngineId ?? ''] ?? 'another module';
    const targetName = ENGINE_DISPLAY_NAMES[targetEngineId ?? ''] ?? 'this module';
    return `Apply rejected — this script is for ${scriptName}, not ${targetName}. Nothing changed.`;
  }
  return ROTO_SCRIPT_APPLY_REFUSAL_ENGINE_MISMATCH_GENERIC;
}

/**
 * Pure and total: takes the clipboard's operation error, a host refusal, or
 * null/undefined, and returns a user-facing English line, or null when this
 * code has no refusal of its own. No signals, no store, no IO — safe to call
 * from anywhere.
 */
export function buildRotoScriptApplyRefusalMessage(
  error: RotoScriptOperationError | HostRefusalInput | null | undefined,
): string | null {
  if (!error) return null;
  switch (error.code) {
    case 'apply-empty-target-failed':
      return ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET;
    case 'apply-partial-failure':
    case 'apply-cancelled':
      return 'message' in error ? usableMessage(error.message) : null;
    case 'apply-invalidated':
      return ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED;
    // 55-06 host codes (D-11) — host yields codes, Studio names them (D-09).
    case 'unknown-engine-id':
      return ROTO_SCRIPT_APPLY_REFUSAL_UNKNOWN_ENGINE;
    case 'malformed-engine-payload':
      return ROTO_SCRIPT_APPLY_REFUSAL_MALFORMED_PAYLOAD;
    case 'engine-mismatch':
      return buildEngineMismatchLine('detail' in error ? error.detail : undefined);
    case 'unreadable-legacy-script':
      return ROTO_SCRIPT_APPLY_REFUSAL_UNREADABLE_LEGACY;
    default:
      return null;
  }
}
