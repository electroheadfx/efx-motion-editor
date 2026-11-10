// ============================================================
//  61-07 (D-12) — what each top-bar popover lists.
//
//  The Brush popover shows EVERY shipped preset: picking the ribbon
//  row selects the clean sweep for the next stroke. The Eraser (lift)
//  popover picks a TIP SHAPE, not a render mode — a ribbon row there
//  would erase with a mode the eraser cannot honour — so it lists only
//  presets whose `renderMode` is undefined.
//
//  Both branches read these helpers, so the two lists can never drift
//  from each other or from the preset data. Pure: no signals, no DOM,
//  no component imports — a plain node-env test pins the law.
// ============================================================

import { BRUSH_PRESETS, type BrushPreset } from '@efxlab/efx-watercolor';

/** Which popover is asking: the brush pick or the eraser shape pick. */
export type BrushMenuTarget = 'brush' | 'lift';

/**
 * Drop every preset that carries a render mode. Shared by the menu
 * helper and pinned directly so a synthetic all-ribbon list can prove
 * the filtered branch can be empty (the menu renders the empty list
 * itself — no new no-match copy).
 */
export function filterLiftPresets<T extends Pick<BrushPreset, 'renderMode'>>(
  presets: readonly T[],
): readonly T[] {
  return presets.filter((preset) => preset.renderMode === undefined);
}

/**
 * The presets a menu branch renders, in shipped order.
 * `brush` = the complete list; `lift` = tip shapes only.
 */
export function brushMenuPresets(target: BrushMenuTarget): readonly BrushPreset[] {
  return target === 'lift' ? filterLiftPresets(BRUSH_PRESETS) : BRUSH_PRESETS;
}
