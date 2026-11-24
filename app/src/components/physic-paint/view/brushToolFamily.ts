// ============================================================
//  quick 261121-mtu (rev 2) — which brush RESPONSES a tool exposes.
//
//  The response library is not one flat catalog under every tool:
//  the paint tools select a brush FAMILY, and the lists follow it.
//    · Brush      → every group except Watercolor (the Gouache group,
//                   i.e. the acrylic medium)
//    · Watercolor → the Watercolor group only
//    · Water / Pen / Eraser → the whole table: these tools carry no
//                   family of their own (Water is a wet blend, the
//                   Eraser owns a separate lift tip), so a pick from
//                   them is a family pick — `selectAquarelleTip`
//                   flips the paint tool from the picked group.
//
//  Pure: no Preact, no DOM, no signals. The grid and the top-bar
//  popover both read these functions, so the two surfaces cannot
//  disagree about which responses a tool shows.
// ============================================================

import {
  BRUSH_PRESETS,
  brushGroupOf,
  brushGroupOrder,
  brushSections,
  type BrushGroupSection,
  type BrushPreset,
  type MediumId,
} from '@efxlab/efx-watercolor';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';

/** The groups a tool's response lists render, in `brushGroupOrder` order. */
export function brushGroupsForTool(tool: AquarelleTool): readonly MediumId[] {
  if (tool === 'watercolor') return Object.freeze(['watercolor'] as const);
  if (tool === 'brush') {
    return brushGroupOrder.filter((group) => group !== 'watercolor');
  }
  return brushGroupOrder;
}

/** The response presets a tool exposes, in shipped table order. */
export function brushPresetsForTool(tool: AquarelleTool): readonly BrushPreset[] {
  const allowed = new Set(brushGroupsForTool(tool));
  return BRUSH_PRESETS.filter((preset) => allowed.has(brushGroupOf(preset)));
}

/** The library's sectioned view of `brushPresetsForTool`, fixed order. */
export function brushSectionsForTool(tool: AquarelleTool): BrushGroupSection[] {
  return brushSections(brushPresetsForTool(tool));
}

/**
 * The family's first response — the landing brush when a tool pick leaves the
 * active tip in another family. Derived from `brushGroupOrder` (never a
 * hardcoded id): the only non-watercolor group today is acrylic, so the
 * Brush tool lands on `bristle-round`.
 */
export function firstBrushPresetForTool(tool: AquarelleTool): BrushPreset | null {
  const groups = brushGroupsForTool(tool);
  const presets = BRUSH_PRESETS.filter((preset) => groups.includes(brushGroupOf(preset)));
  if (presets.length === 0) return null;
  const order = new Map(groups.map((group, index) => [group, index]));
  return [...presets].sort(
    (a, b) => (order.get(brushGroupOf(a)) ?? 0) - (order.get(brushGroupOf(b)) ?? 0),
  )[0] ?? null;
}
