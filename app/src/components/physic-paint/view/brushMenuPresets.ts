// ============================================================
//  What each top-bar popover lists.
//
//  quick 261121-mtu (rev 2): the BRUSH branch lists the active
//  tool's brush FAMILY — the same law the response grid uses, so
//  the two surfaces cannot disagree. Brush → every non-watercolor
//  group; Watercolor → the watercolor group; Water / Pen / Eraser
//  → the whole table (a pick there is a family pick).
//
//  The ERASER (lift) branch is not a family picker: it picks a tip
//  SHAPE, so every preset stays reachable there.
//
//  Pure: no signals, no DOM, no component imports — a plain
//  node-env test pins the law.
// ============================================================

import { BRUSH_PRESETS, type BrushPreset } from '@efxlab/efx-watercolor';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';
import { brushPresetsForTool } from './brushToolFamily';

/** Which popover is asking: the brush pick or the eraser shape pick. */
export type BrushMenuTarget = 'brush' | 'lift';

/** The presets a menu branch renders, in shipped order. */
export function brushMenuPresets(
  target: BrushMenuTarget,
  tool: AquarelleTool,
): readonly BrushPreset[] {
  if (target === 'lift') return BRUSH_PRESETS;
  return brushPresetsForTool(tool);
}
