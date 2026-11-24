import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/**
 * Quick 261124-gfy: the Script-mode clipboard paths.
 *
 * The Roto key-actions row grew a Raster|Script toggle. Raster is today's
 * session raster clipboard; Script re-points the four clipboard actions at the
 * shipped Living Script seams (261023-cxc Duplicate, handleCopyScript,
 * handleApplyScript). Copy and Cut refuse a 2+ key selection explicitly, and
 * Cut is the ONE new irreducible flow:
 *
 *   multi-key refusal -> delete availability -> copy availability ->
 *   snapshot the script clipboard -> copy the key's script -> delete the key.
 *
 * The snapshot is taken BEFORE the copy because a failed copy or delete must
 * hand the artist back the clipboard they had: `copyScript()` replaces the
 * clipboard on success, so the only way to restore the previous script after a
 * failed delete is to capture the reference first. A failed delete restores the
 * snapshot and says so; a successful cut never restores.
 *
 * The module owns no store, DOM, or IPC state — every side effect crosses a
 * port, and the caller owns the published copy.
 */

/** Script-mode Copy refuses a multi-key selection (the clipboard is single-key). */
export const ROTO_SCRIPT_COPY_MULTI_KEY_REFUSAL = 'Copy script copies one key at a time — select a single key.';
/** Script-mode Cut refuses a multi-key selection for the same reason. */
export const ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL = 'Cut script works on one key at a time — select a single key.';
/** The copy half failed: nothing was deleted and the clipboard is untouched. */
export const ROTO_SCRIPT_CUT_COPY_FAILED = 'Cut canceled — the script could not be copied. Nothing was deleted.';
/** The delete half failed: the pre-cut script clipboard was put back. */
export const ROTO_SCRIPT_CUT_DELETE_FAILED = 'Cut canceled — the selected key could not be deleted. The previous script clipboard was restored.';

/** Ports the Studio fills; the orchestrator never touches a controller directly. */
export interface RotoScriptCutPorts {
  /** The current exact key selection size (rail-set scopes never reach here). */
  getSelectedKeyCount: () => number;
  canCopy: () => boolean;
  copyDisabledReason: () => string | null;
  /** The controller's last copy failure message, when it exposes one. */
  copyErrorMessage?: () => string | null;
  /** The clipboard value captured BEFORE `copyScript` replaces it. */
  snapshotScriptClipboard: () => RotoPaintScript | null;
  copyScript: () => Promise<boolean>;
  canDelete: () => boolean;
  deleteDisabledReason: () => string | null;
  deleteKey: () => Promise<boolean>;
  restoreScriptClipboard: (snapshot: RotoPaintScript | null) => void;
}

export type RotoScriptCutOutcome =
  | { readonly outcome: 'handled' }
  | { readonly outcome: 'refused'; readonly message: string }
  | { readonly outcome: 'restored'; readonly message: string }
  | { readonly outcome: 'aborted'; readonly message: string; readonly detail?: string };

/**
 * Orchestrate one Script-mode Cut.
 *
 * Order (locked): a 2+ key selection refuses first (the script clipboard is
 * single-key), then the delete availability, then the copy availability —
 * neither side effect may run when the other is already known to be
 * unavailable. Only then does the snapshot/copy/delete sequence run, with the
 * snapshot restored on a false delete or a throw.
 */
export async function runRotoCutWithScript(ports: RotoScriptCutPorts): Promise<RotoScriptCutOutcome> {
  if (ports.getSelectedKeyCount() >= 2) {
    return { outcome: 'refused', message: ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL };
  }
  if (!ports.canDelete()) {
    return {
      outcome: 'refused',
      message: ports.deleteDisabledReason() ?? 'Deleting the selected Roto key is unavailable.',
    };
  }
  if (!ports.canCopy()) {
    return {
      outcome: 'refused',
      message: ports.copyDisabledReason() ?? 'Copying the key script is unavailable.',
    };
  }
  const snapshot = ports.snapshotScriptClipboard();
  const copied = await ports.copyScript();
  if (!copied) {
    return {
      outcome: 'aborted',
      message: ports.copyErrorMessage?.() ?? ROTO_SCRIPT_CUT_COPY_FAILED,
    };
  }
  try {
    const deleted = await ports.deleteKey();
    if (!deleted) {
      ports.restoreScriptClipboard(snapshot);
      return { outcome: 'restored', message: ROTO_SCRIPT_CUT_DELETE_FAILED };
    }
  } catch (error) {
    ports.restoreScriptClipboard(snapshot);
    return {
      outcome: 'aborted',
      message: ROTO_SCRIPT_CUT_DELETE_FAILED,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  return { outcome: 'handled' };
}
