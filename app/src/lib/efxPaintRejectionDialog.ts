/**
 * Clean-break rejection dialog (Phase 45-05 Task 1, D-05/D-07).
 *
 * v1.0.0 intentionally does not open, migrate, or render pre-v1.0 EFX Physic
 * Paint data. When the 45-03 gate (`findLegacyPhysicPaintRejection`) rejects
 * a project, openProject shows this blocking native dialog and returns with
 * zero store mutation.
 *
 * The UX is deliberately no-recourse (D-07): a single acknowledge action, no
 * partial open, no continue-anyway, no converter offer, no stripped-copy
 * option. The copy names EFX Physic Paint, the pre-v1.0 format, and the
 * impossibility of opening.
 */

import { message } from '@tauri-apps/plugin-dialog';
import type { LegacyPhysicPaintRejection } from '../efx-paint/document/efxPaintCleanBreak';

/** Explicit no-recourse copy shown for every rejection reason (D-07). */
export const LEGACY_PHYSIC_PAINT_REJECTED_COPY =
  'This project contains pre-v1.0 EFX Physic Paint data, which EFX Motion Editor v1.0.0 does not support. The project cannot be opened.';

/**
 * Show the blocking rejection dialog. Native modal `message()` with kind
 * 'error' and a single OK button — no backdrop-dismiss ambiguity, no recourse
 * actions (T-45-17). The reason is intentionally unused by the copy: every
 * rejection is terminal and identical to the user.
 */
export async function showLegacyPhysicPaintRejectionDialog(
  _reason: LegacyPhysicPaintRejection,
): Promise<void> {
  await message(LEGACY_PHYSIC_PAINT_REJECTED_COPY, {
    title: 'EFX Motion Editor',
    kind: 'error',
    buttons: 'Ok',
  });
}
