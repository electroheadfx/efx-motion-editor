// ============================================================
//  quick 261121-mtu (rev 2) — the brush RESPONSE family per tool.
//
//  Laws pinned here:
//   · Brush      → every group except Watercolor, in brushGroupOrder
//   · Watercolor → the Watercolor group only
//   · Water / Pen / Eraser → the whole table (no family of their own)
//   · the two list surfaces (grid + top-bar popover) call this law,
//     so they cannot disagree
//   · the family's first preset is derived from brushGroupOrder
//
//  Assertion style: scalar predicates so diagnostics stay one-line.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, brushGroupOf, brushGroupOrder } from '@efxlab/efx-watercolor';
import {
  brushGroupsForTool,
  brushPresetsForTool,
  brushSectionsForTool,
  firstBrushPresetForTool,
} from './brushToolFamily';

const LIBRARY_SOURCE = readFileSync(resolve(__dirname, './WatercolorBrushLibrary.tsx'), 'utf8');
const MENU_SOURCE = readFileSync(resolve(__dirname, './PhysicsPaintBrushMenu.tsx'), 'utf8');
const MENU_PRESETS_SOURCE = readFileSync(resolve(__dirname, './brushMenuPresets.ts'), 'utf8');

describe('brushGroupsForTool', () => {
  it('Brush exposes every non-watercolor group in the fixed order', () => {
    expect(brushGroupsForTool('brush')).toEqual(
      brushGroupOrder.filter((group) => group !== 'watercolor'),
    );
    expect(brushGroupsForTool('brush')).toEqual(['gouache', 'pastel', 'graphite', 'acrylic']);
  });

  it('Watercolor exposes its own group alone', () => {
    expect(brushGroupsForTool('watercolor')).toEqual(['watercolor']);
  });

  it('the utility tools expose the whole table', () => {
    for (const tool of ['water', 'pen', 'lift'] as const) {
      expect(brushGroupsForTool(tool), tool).toEqual(brushGroupOrder);
    }
  });
});

describe('brushPresetsForTool', () => {
  it('Brush never lists a watercolor preset and does list every other preset', () => {
    const ids = brushPresetsForTool('brush').map((preset) => preset.id);
    for (const preset of BRUSH_PRESETS) {
      const expected = brushGroupOf(preset) !== 'watercolor';
      expect(ids.includes(preset.id), preset.id).toBe(expected);
    }
  });

  it('Watercolor lists exactly the watercolor group, in table order', () => {
    const watercolorIds = BRUSH_PRESETS
      .filter((preset) => brushGroupOf(preset) === 'watercolor')
      .map((preset) => preset.id);
    expect(brushPresetsForTool('watercolor').map((preset) => preset.id)).toEqual(watercolorIds);
    expect(brushPresetsForTool('watercolor').length).toBeGreaterThan(0);
  });

  it('the utility tools keep the shipped table intact', () => {
    const shipped = BRUSH_PRESETS.map((preset) => preset.id);
    for (const tool of ['water', 'pen', 'lift'] as const) {
      expect(brushPresetsForTool(tool).map((preset) => preset.id), tool).toEqual(shipped);
    }
  });
});

describe('brushSectionsForTool', () => {
  it('Watercolor renders one section and Brush renders the other four', () => {
    expect(brushSectionsForTool('watercolor').map((section) => section.group)).toEqual([
      'watercolor',
    ]);
    expect(brushSectionsForTool('brush').map((section) => section.group)).toEqual([
      'gouache',
      'pastel',
      'graphite',
      'acrylic',
    ]);
  });

  it('every shipped preset appears under exactly one tool family', () => {
    const watercolorIds = new Set(
      brushSectionsForTool('watercolor').flatMap((section) => section.presets.map((p) => p.id)),
    );
    const brushIds = new Set(
      brushSectionsForTool('brush').flatMap((section) => section.presets.map((p) => p.id)),
    );
    for (const preset of BRUSH_PRESETS) {
      const inWatercolor = watercolorIds.has(preset.id);
      const inBrush = brushIds.has(preset.id);
      expect(inWatercolor !== inBrush, `${preset.id} appears in exactly one paint family`).toBe(true);
    }
  });
});

describe('firstBrushPresetForTool', () => {
  it('Watercolor lands on the group first preset (round)', () => {
    expect(firstBrushPresetForTool('watercolor')?.id).toBe('round');
  });

  it('Brush lands on the first non-watercolor group preset (gouache-round)', () => {
    expect(firstBrushPresetForTool('brush')?.id).toBe('gouache-round');
  });
});

describe('both list surfaces read the one law', () => {
  it('the grid maps brushSectionsForTool(activeTool)', () => {
    expect(LIBRARY_SOURCE).toContain('brushSectionsForTool(activeTool)');
    expect(LIBRARY_SOURCE).not.toContain('brushSections(BRUSH_PRESETS)');
  });

  it('the top-bar popover passes the active tool into the brush branch', () => {
    expect(MENU_SOURCE).toContain("brushMenuPresets('brush', activeTool)");
    expect(MENU_SOURCE).toContain("brushMenuPresets('lift', activeTool)");
    expect(MENU_PRESETS_SOURCE).toContain('brushPresetsForTool(tool)');
  });
});
