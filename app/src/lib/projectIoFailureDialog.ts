/**
 * Save/open failure surface (quick-260913-05k, T-260913-05k-04).
 *
 * The live P0 was a SILENT failure: a package save died on a plugin-fs
 * capability refusal while the only feedback was a console line the user never
 * sees. Every save/open failure path now ends in a blocking native modal that
 * carries the raw error text — "forbidden path …" reaches the user verbatim —
 * so a refused package write can never look like a successful save.
 *
 * Two entry points, by caller intent:
 * - `showProjectIoFailureDialog` — user-initiated actions (menu, toolbar,
 *   welcome screen, OS-delivered packages). Every failure shows.
 * - `reportLatchedIoFailure` — the unattended autosave path, which retries
 *   every tick and would otherwise stack one modal per attempt. One dialog per
 *   action per failure streak; `clearIoFailureLatch` re-arms it from
 *   `recordSaved` — the only place a save is known to have succeeded.
 */

import { message } from '@tauri-apps/plugin-dialog';

/** The two package operations whose failure reaches the user as a modal. */
export type ProjectIoAction = 'save' | 'open';

/** Per-action copy naming the operation and the state the user is left in. */
const ACTION_COPY: Record<ProjectIoAction, string> = {
  save: 'Could not save the project. The project is still marked as unsaved — fix the problem and save again.',
  open: 'Could not open the project.',
};

/** Human-readable detail for anything a failure can be: Error, string, or thrown value. */
export function projectIoFailureDetail(error: unknown): string {
  if (typeof error === 'string' && error.length > 0) return error;
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error
    && typeof (error as { message: unknown }).message === 'string'
    && (error as { message: string }).message.length > 0) {
    return (error as { message: string }).message;
  }
  const fallback = String(error);
  return fallback.trim().length > 0 ? fallback : 'Unknown error';
}

/** Actions currently latched (a modal is showing or owed for this streak). */
const latchedActions = new Set<ProjectIoAction>();

/**
 * Show the blocking failure modal. Native `message()` with kind 'error' — the
 * same no-recourse surface as the clean-break rejection dialog, so the user
 * cannot dismiss past a failed save without seeing what failed.
 */
export async function showProjectIoFailureDialog(action: ProjectIoAction, error: unknown): Promise<void> {
  const body = `${ACTION_COPY[action]}\n\n${projectIoFailureDetail(error)}`;
  try {
    await message(body, {
      title: 'EFX Motion Editor',
      kind: 'error',
      buttons: 'Ok',
    });
  } catch (dialogError) {
    // Fail-soft: the call site already logged to the console, and this function
    // is called from catch blocks and fire-and-forget handlers — a dialog that
    // cannot be shown must not escape as a NEW unhandled rejection.
    console.error('Failed to show the project IO failure dialog:', dialogError);
  }
}

/**
 * Latched report for the unattended autosave path: the first failure of a
 * streak shows the modal, later retries stay silent until a recorded save (or
 * an explicit `clearIoFailureLatch`) re-arms it.
 */
export function reportLatchedIoFailure(action: ProjectIoAction, error: unknown): void {
  if (latchedActions.has(action)) return;
  latchedActions.add(action);
  void showProjectIoFailureDialog(action, error);
}

/** Re-arm an action's latch after recovery (called from `recordSaved`). */
export function clearIoFailureLatch(action: ProjectIoAction): void {
  latchedActions.delete(action);
}
