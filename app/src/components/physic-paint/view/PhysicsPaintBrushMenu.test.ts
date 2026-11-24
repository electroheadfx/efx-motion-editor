// ============================================================
//  61-07 (D-12) — the two popovers list different slices.
//
//  The Brush popover shows every preset (picking the ribbon row
//  selects the clean sweep); the Eraser popover picks a tip shape,
//  not a render mode, so the ribbon row is filtered out there. Both
//  branches read brushMenuPresets, so the lists cannot drift.
//  Plain node-env test: the pure helper carries the law and the
//  source pins prove the component actually calls it in each branch.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, brushGroupOf } from '@efxlab/efx-watercolor';
import { brushMenuPresets } from './brushMenuPresets';

const SOURCE = readFileSync(resolve(__dirname, './PhysicsPaintBrushMenu.tsx'), 'utf8');

function sourceRegion(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  expect(start, `missing marker: ${startMarker}`).toBeGreaterThan(-1);
  const end = SOURCE.indexOf(endMarker, start + startMarker.length);
  expect(end, `missing marker: ${endMarker}`).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('brushMenuPresets', () => {
  // quick 261121-mtu (rev 2): the brush branch lists the ACTIVE TOOL's brush
  // family — Brush = every non-watercolor group, Watercolor = its own group,
  // utility tools = the whole table. The eraser branch picks a SHAPE and is
  // never filtered.
  it('the brush branch follows the active tool family; the lift branch lists every shape', () => {
    const shipped = BRUSH_PRESETS.map((preset) => preset.id);
    expect(brushMenuPresets('lift', 'watercolor').map((preset) => preset.id)).toEqual(shipped);

    const watercolorIds = brushMenuPresets('brush', 'watercolor').map((preset) => preset.id);
    expect(watercolorIds).toEqual(
      BRUSH_PRESETS.filter((preset) => brushGroupOf(preset) === 'watercolor').map((preset) => preset.id),
    );

    const brushIds = brushMenuPresets('brush', 'brush').map((preset) => preset.id);
    expect(brushIds).not.toContain('round');
    // quick 261124-tje: the Gouache (acrylic) group now has two members.
    expect(brushIds).toEqual(['bristle-round', 'pen']);

    // The utility tools carry no family of their own.
    for (const tool of ['water', 'pen', 'lift'] as const) {
      expect(brushMenuPresets('brush', tool).map((preset) => preset.id)).toEqual(shipped);
    }
  });
});

describe('PhysicsPaintBrushMenu wiring (61-07)', () => {
  it('the lift branch lists tip shapes and the brush branch lists the tool family', () => {
    const lift = sourceRegion("menuTarget === 'lift' ? (", '\n      ) : (');
    expect(lift).toContain("brushMenuPresets('lift', activeTool)");
    expect(lift).not.toContain("brushMenuPresets('brush'");

    const brush = sourceRegion('\n      ) : (', '\n      )}\n    </div>');
    expect(brush).toContain("brushMenuPresets('brush', activeTool)");
    expect(brush).not.toContain("brushMenuPresets('lift'");
  });

  it('never maps the raw preset list directly', () => {
    expect(SOURCE).not.toContain('BRUSH_PRESETS');
    expect(SOURCE).not.toContain('BRUSH_PRESETS.map');
  });

  it('both rows render the shipped name and hint grammar', () => {
    const lift = sourceRegion("menuTarget === 'lift' ? (", '\n      ) : (');
    const brush = sourceRegion('\n      ) : (', '\n      )}\n    </div>');
    for (const branch of [lift, brush]) {
      expect(branch).toContain('title={preset.hint}');
      expect(branch).toContain('{preset.name}');
    }
  });
});

// quick 261111-ucf — the brush branch is the first tenant of the ONE
// paint-control seam; the lift branch keeps the raw eraser setter.
describe('quick 261111-ucf brush pick wiring', () => {
  it('routes the brush branch through the paint-control seam and never the lift branch', () => {
    const lift = sourceRegion("menuTarget === 'lift' ? (", '\n      ) : (');
    expect(countOf(lift, 'setAquarelleLiftTipId('), 'lift branch keeps its raw setter').toBe(1);
    expect(lift, 'lift branch never commits a paint pick').not.toContain('pickAquarelleBrush(');

    const brush = sourceRegion('\n      ) : (', '\n      )}\n    </div>');
    expect(countOf(brush, 'pickAquarelleBrush('), 'brush branch picks through the seam').toBe(1);

    const imports = SOURCE.match(/from '\.\/aquarellePaintControls'/g) ?? [];
    expect(imports, 'one paint-controls import').toHaveLength(1);
  });
});
