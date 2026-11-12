// ============================================================
//  What each top-bar popover lists.
//
//  Both the Brush popover and the Eraser (lift) popover pick a TIP
//  SHAPE from the same shipped preset list. Pure: no signals, no DOM,
//  no component imports — a plain node-env test pins the law.
// ============================================================

import { BRUSH_PRESETS, type BrushPreset } from '@efxlab/efx-watercolor';

/** Which popover is asking: the brush pick or the eraser shape pick. */
export type BrushMenuTarget = 'brush' | 'lift';

/** The presets a menu branch renders, in shipped order. */
export function brushMenuPresets(_target: BrushMenuTarget): readonly BrushPreset[] {
  return BRUSH_PRESETS;
}
