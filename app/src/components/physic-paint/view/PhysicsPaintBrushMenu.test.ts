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
import { BRUSH_PRESETS, type BrushPreset } from '@efxlab/efx-watercolor';
import { brushMenuPresets, filterLiftPresets } from './brushMenuPresets';

const RIBBON_ID = 'simple-ribbon';
const SOURCE = readFileSync(resolve(__dirname, './PhysicsPaintBrushMenu.tsx'), 'utf8');

function sourceRegion(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  expect(start, `missing marker: ${startMarker}`).toBeGreaterThan(-1);
  const end = SOURCE.indexOf(endMarker, start + startMarker.length);
  expect(end, `missing marker: ${endMarker}`).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe('brushMenuPresets (61-07)', () => {
  it('the brush list is the complete shipped preset list, in order', () => {
    expect(brushMenuPresets('brush').map((preset) => preset.id)).toEqual(
      BRUSH_PRESETS.map((preset) => preset.id),
    );
  });

  it('the ribbon preset appears exactly once in the brush list', () => {
    const ribbons = brushMenuPresets('brush').filter((preset) => preset.id === RIBBON_ID);
    expect(ribbons).toHaveLength(1);
    expect(ribbons[0]!.renderMode).toBe('simple-ribbon');
    expect(ribbons[0]!.name).toBe('Simple ribbon');
  });

  it('the lift list excludes the ribbon preset and keeps every shipped tip shape', () => {
    const lift = brushMenuPresets('lift');
    expect(lift.some((preset) => preset.id === RIBBON_ID)).toBe(false);
    expect(lift.every((preset) => preset.renderMode === undefined)).toBe(true);
    expect(lift.map((preset) => preset.id)).toEqual(
      BRUSH_PRESETS.filter((preset) => preset.renderMode === undefined).map((preset) => preset.id),
    );
    for (const id of ['filbert', 'round', 'chalk']) {
      expect(lift.some((preset) => preset.id === id), `${id} stays in the lift list`).toBe(true);
    }
    // The filter removes exactly one shipped row — nothing else moves.
    expect(lift).toHaveLength(BRUSH_PRESETS.length - 1);
  });

  it('a filter that empties the list returns an empty list — no new copy', () => {
    // The shipped no-match state is unchanged: the menu renders the empty
    // list itself and carries no count-dependent copy or badge.
    const allRibbon: Array<Pick<BrushPreset, 'id' | 'renderMode'>> = [
      { id: 'a', renderMode: 'simple-ribbon' },
      { id: 'b', renderMode: 'simple-ribbon' },
    ];
    expect(filterLiftPresets(allRibbon)).toEqual([]);
    expect(SOURCE).not.toContain('presets.length');
    expect(SOURCE).not.toContain('badge');
  });
});

describe('PhysicsPaintBrushMenu wiring (61-07)', () => {
  it('the lift branch lists tip shapes and the brush branch lists every preset', () => {
    const lift = sourceRegion("menuTarget === 'lift' ? (", '\n      ) : (');
    expect(lift).toContain("brushMenuPresets('lift')");
    expect(lift).not.toContain("brushMenuPresets('brush')");
    expect(lift).toContain('tip shape, not a render mode');

    const brush = sourceRegion('\n      ) : (', '\n      )}\n    </div>');
    expect(brush).toContain("brushMenuPresets('brush')");
    expect(brush).not.toContain("brushMenuPresets('lift')");
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
