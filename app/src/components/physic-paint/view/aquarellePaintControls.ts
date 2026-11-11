// ============================================================
//  quick 261111-ucf — the ONE paint-control seam.
//
//  These four functions are the ONLY selection-edit entry points
//  for a brush pick and for every paint-control release. The live
//  setters are the caller's job on `onChange` and are never called
//  here (except the live tip inside the pick).
//
//  Every commit rides `commitAquarelleSelectionAppearance` with
//  filter 'paint', so a lift (eraser) stroke is never addressed by
//  a paint control, and the Studio's ONE appearance door still
//  owns the undo entry, the revision bump and the seed re-roll.
//  No selection / Select mode off stays a no-attempt no-op.
// ============================================================

import type { AquarelleToolOverrides } from '@efxlab/efx-watercolor/brushes';
import {
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  aquarelleToolOverrides,
  selectAquarelleTip,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';
import { commitAquarelleSelectionAppearance } from './aquarelleStrokeSelection';
import type { AquarelleSelectionEditOptions } from './aquarelleStrokeSelection';

/** The one filter every paint control uses: never a lift stroke. */
const PAINT_ONLY: AquarelleSelectionEditOptions = { filter: 'paint' };

/**
 * Pick a brush: the LIVE tip changes first, then the selection commit
 * forwards the bag the live brush NOW carries.
 *
 * The order is the law. `selectAquarelleTip` loads the incoming brush's
 * remembered response bag into `aquarelleToolOverrides`, so committing before
 * the pick would stamp the OUTGOING bag onto the strokes. The bag is spread
 * into a snapshot: a later live write can never rewrite the patch in flight.
 *
 * An unknown id still updates the live surface exactly as today — the record
 * door refuses the patch, and this returns its refusal.
 */
export function pickAquarelleBrush(presetId: string): Promise<boolean> | null {
  selectAquarelleTip(presetId);
  return commitAquarelleSelectionAppearance(
    {
      brushId: presetId,
      toolOverrides: { ...aquarelleToolOverrides.peek() },
    },
    PAINT_ONLY,
  );
}

/** One global slider release → one params patch on the selected paint strokes. */
export function commitAquarelleSelectionParam(
  key: AquarelleGlobalKey,
  value: number,
): Promise<boolean> | null {
  return commitAquarelleSelectionAppearance({ params: { [key]: value } }, PAINT_ONLY);
}

/**
 * The Reset batch's ONE call: all seven defaults travel in a single patch, so
 * the selection receives one undo entry. An empty batch is a no-attempt.
 */
export function commitAquarelleSelectionParams(
  params: Readonly<Record<string, number>>,
): Promise<boolean> | null {
  if (Object.keys(params).length === 0) return null;
  return commitAquarelleSelectionAppearance({ params }, PAINT_ONLY);
}

/**
 * One brush-response release → one clamped multiplier field. The clamp and the
 * non-finite refusal mirror `setAquarelleMultiplier`, so a release can never
 * store a value the live setter would have rejected.
 */
export function commitAquarelleSelectionMultiplier(
  field: keyof AquarelleToolOverrides,
  value: number,
): Promise<boolean> | null {
  if (!Number.isFinite(value)) return null;
  const clamped = Math.max(MULTIPLIER_MIN, Math.min(MULTIPLIER_MAX, value));
  const toolOverrides: Partial<AquarelleToolOverrides> = { [field]: clamped };
  return commitAquarelleSelectionAppearance({ toolOverrides }, PAINT_ONLY);
}
