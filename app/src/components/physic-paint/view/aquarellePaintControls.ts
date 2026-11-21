// ============================================================
//  quick 261111-ucf — the ONE paint-control seam.
//
//  These four functions are the ONLY selection-edit entry points
//  for a brush pick and for every paint-control release. The live
//  setters are the caller's job on `onChange` and are never called
//  here (except the live tip and the group's medium inside the pick).
//
//  Every commit rides `commitAquarelleSelectionAppearance`, and the
//  Studio's ONE appearance door still owns the undo entry, the
//  revision bump and the seed re-roll. The filter is the row's own
//  family: brush picks, the multiplier releases and the Reset batch
//  use 'paint', so a lift (eraser) stroke is never addressed by a
//  paint control; quick 261121-mtu's Lift row (the Eraser context's
//  only row) uses 'lift', so its release edits exactly the strokes
//  it describes and never a paint stroke.
//  No selection / Select mode off stays a no-attempt no-op.
// ============================================================

import type { AquarelleToolOverrides } from '@efxlab/efx-watercolor/brushes';
import {
  BRUSH_PRESETS,
  DEFAULT_MEDIUM_ID,
  brushGroupOf,
  type MediumId,
} from '@efxlab/efx-watercolor';
import {
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  applyAquarelleMedium,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  selectAquarelleTip,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';
import { commitAquarelleSelectionAppearance } from './aquarelleStrokeSelection';
import type { AquarelleSelectionEditOptions } from './aquarelleStrokeSelection';

/** The filter every paint control uses: never a lift stroke. */
const PAINT_ONLY: AquarelleSelectionEditOptions = { filter: 'paint' };

/** quick 261121-mtu: the Lift row's own family. The row renders only in the
 *  Eraser context, so its release must edit lift strokes — and ONLY the
 *  Reset batch and the paint controls keep the 'paint' filter. */
const LIFT_ONLY: AquarelleSelectionEditOptions = { filter: 'lift' };

/**
 * The group of a response id, resolved from the ONE preset table (64-11's
 * `brushGroupOf`). The group value IS the medium id — no second mapping
 * table — and an id the table does not contain (a catalog or unknown tip)
 * has no group, so it can never acquire a medium (T-64-32).
 */
function groupOfPreset(presetId: string | null): MediumId | null {
  if (presetId === null) return null;
  const preset = BRUSH_PRESETS.find((candidate) => candidate.id === presetId);
  return preset ? brushGroupOf(preset) : null;
}

/**
 * Pick a brush: the LIVE tip changes first, then the selection commit
 * forwards the bag the live brush NOW carries.
 *
 * The order is the law. `selectAquarelleTip` loads the incoming brush's
 * remembered response bag into `aquarelleToolOverrides`, so committing before
 * the pick would stamp the OUTGOING bag onto the strokes. The bag is spread
 * into a snapshot: a later live write can never rewrite the patch in flight.
 *
 * MED-28: the response group IS the medium. The outgoing group is read BEFORE
 * the live pick, because the pick rewrites `aquarelleSelectedTipId`; a
 * no-preset selection reads as the neutral medium (the same law that makes an
 * untagged preset watercolor). A pick whose group differs applies that
 * group's record through the SAME `applyAquarelleMedium` the Paint-tab
 * dropdown uses — one spread write plus the id, never `size`/`lift`, never
 * the selection-edit path. A pick inside the same group writes nothing, so
 * the artist's manual global tweaks survive (MED-13). The committed patch
 * stays `{ brushId, toolOverrides }`: a card pick never edits an
 * already-recorded stroke's params (MED-11).
 *
 * An unknown id still updates the live surface exactly as today — the record
 * door refuses the patch, and this returns its refusal.
 */
export function pickAquarelleBrush(presetId: string): Promise<boolean> | null {
  const outgoingGroup = groupOfPreset(aquarelleSelectedTipId.peek()) ?? DEFAULT_MEDIUM_ID;
  selectAquarelleTip(presetId);
  const incomingGroup = groupOfPreset(presetId);
  if (incomingGroup !== null && incomingGroup !== outgoingGroup) {
    applyAquarelleMedium(incomingGroup);
  }
  return commitAquarelleSelectionAppearance(
    {
      brushId: presetId,
      toolOverrides: { ...aquarelleToolOverrides.peek() },
    },
    PAINT_ONLY,
  );
}

/** One global slider release → one params patch on the selected strokes of the
 *  row's own family (quick 261121-mtu: the Lift row edits lift strokes; every
 *  other row edits paint strokes). */
export function commitAquarelleSelectionParam(
  key: AquarelleGlobalKey,
  value: number,
): Promise<boolean> | null {
  return commitAquarelleSelectionAppearance(
    { params: { [key]: value } },
    key === 'lift' ? LIFT_ONLY : PAINT_ONLY,
  );
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
