/**
 * quick 261121-mtu — the paint tool's brush-family law.
 *
 * Laws pinned here:
 *   a watercolor-group brush pick selects the Watercolor tool
 *   an acrylic / gouache / pastel / graphite pick selects the Brush tool
 *   an unknown id clears the selection and never flips the tool (the shipped
 *     `nextId !== null` guard — an unknown pick is a clear, not a family pick)
 *   the Watercolor tool applies the Watercolor medium and selects the
 *     group's first preset (`round`) only when the tip is outside the group
 *   the Brush tool changes neither the selected tip nor the medium
 *   the Water tool is a plain tool write (no family or medium change)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, brushGroupOf, mediumById } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleActiveTool,
  aquarelleBrushResponseMemory,
  aquarelleParams,
  aquarelleSelectedMediumId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  applyAquarelleMedium,
  paintToolForTip,
  selectAquarellePaintTool,
  selectAquarelleTip,
} from './aquarelleRecordState';

const WATERCOLOR_FIRST = BRUSH_PRESETS.find((preset) => brushGroupOf(preset) === 'watercolor')!;
const STORE_SOURCE = readFileSync(resolve(__dirname, './aquarelleRecordState.ts'), 'utf8');

describe('the opening tool follows the default brush (rev 3)', () => {
  it('the default brush is filbert and its family tool is Watercolor', () => {
    expect(paintToolForTip('filbert')).toBe('watercolor');
    expect(brushGroupOf(BRUSH_PRESETS.find((preset) => preset.id === 'filbert')!)).toBe(
      'watercolor',
    );
  });

  it('the active-tool signal is derived from the default tip, never hardcoded', () => {
    expect(STORE_SOURCE).toContain(
      'export const aquarelleActiveTool = signal<AquarelleTool>(paintToolForTip(DEFAULT_TIP_ID));',
    );
    expect(STORE_SOURCE).toContain("const DEFAULT_TIP_ID = 'filbert';");
  });
});

function resetFamily(): void {
  aquarelleSelectedTipId.value = null;
  aquarelleActiveTool.value = 'brush';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  aquarelleBrushResponseMemory.value = {};
  aquarelleSelectedMediumId.value = null;
}

describe('brush pick → paint tool family (quick 261121-mtu)', () => {
  beforeEach(() => {
    resetFamily();
  });

  it('a watercolor-group pick selects the Watercolor tool', () => {
    for (const preset of BRUSH_PRESETS.filter((entry) => brushGroupOf(entry) === 'watercolor')) {
      aquarelleActiveTool.value = 'lift';
      selectAquarelleTip(preset.id);
      expect(aquarelleActiveTool.value, preset.id).toBe('watercolor');
    }
  });

  it('an acrylic / gouache / pastel / graphite pick selects the Brush tool', () => {
    for (const preset of BRUSH_PRESETS.filter((entry) => brushGroupOf(entry) !== 'watercolor')) {
      aquarelleActiveTool.value = 'watercolor';
      selectAquarelleTip(preset.id);
      expect(aquarelleActiveTool.value, preset.id).toBe('brush');
    }
  });

  it('an unknown id clears the selection and never flips the tool (the shipped guard)', () => {
    // An unknown id normalizes to null, and the tool write stays behind the
    // `nextId !== null` guard — a clear is not a family pick. Unchanged by
    // quick 261121-mtu (the old blanket write had the same guard).
    aquarelleActiveTool.value = 'watercolor';
    selectAquarelleTip('wc/custom-does-not-exist');
    expect(aquarelleSelectedTipId.value).toBeNull();
    expect(aquarelleActiveTool.value).toBe('watercolor');
  });
});

describe('selectAquarellePaintTool (quick 261121-mtu)', () => {
  beforeEach(() => {
    resetFamily();
    applyAquarelleMedium('acrylic');
  });

  it('the Watercolor tool applies the Watercolor medium and selects the first watercolor preset when the tip is outside the group', () => {
    aquarelleSelectedTipId.value = 'bristle-flat';
    selectAquarellePaintTool('watercolor');
    // The law, not a hardcoded id: the group's first preset is `round` today.
    expect(WATERCOLOR_FIRST.id).toBe('round');
    expect(aquarelleSelectedTipId.value).toBe(WATERCOLOR_FIRST.id);
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    expect(aquarelleActiveTool.value).toBe('watercolor');
    const record = mediumById('watercolor')!;
    for (const [key, value] of Object.entries(record.params)) {
      expect(aquarelleParams.value[key as keyof typeof record.params], key).toBe(value);
    }
  });

  it('the Watercolor tool keeps a tip already inside the watercolor group', () => {
    aquarelleSelectedTipId.value = 'hake';
    selectAquarellePaintTool('watercolor');
    expect(aquarelleSelectedTipId.value).toBe('hake');
    expect(aquarelleActiveTool.value).toBe('watercolor');
  });

  // quick 261121-mtu (rev 2): the Brush tool exposes the NON-watercolor family.
  // A non-watercolor tip is left alone (mid-pick on a family brush is not a
  // family change); a watercolor tip lands on the family's first preset —
  // derived from brushGroupOrder, never a hardcoded id — and the medium is
  // untouched in both cases.
  it('the Brush tool leaves a non-watercolor tip alone and never touches the medium', () => {
    aquarelleSelectedTipId.value = 'chalk';
    const medium = aquarelleSelectedMediumId.value;
    selectAquarellePaintTool('brush');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectedTipId.value).toBe('chalk');
    expect(aquarelleSelectedMediumId.value).toBe(medium);
  });

  it('the Brush tool moves a watercolor tip into the brush family', () => {
    aquarelleSelectedTipId.value = 'hake';
    const medium = aquarelleSelectedMediumId.value;
    selectAquarellePaintTool('brush');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectedTipId.value).toBe('gouache-round');
    expect(aquarelleSelectedMediumId.value).toBe(medium);
  });

  it('the Water tool is a plain tool write (no family or medium change)', () => {
    aquarelleSelectedTipId.value = 'hake';
    const medium = aquarelleSelectedMediumId.value;
    selectAquarellePaintTool('water');
    expect(aquarelleActiveTool.value).toBe('water');
    expect(aquarelleSelectedTipId.value).toBe('hake');
    expect(aquarelleSelectedMediumId.value).toBe(medium);
  });

  it('is idempotent: re-picking Watercolor keeps the same family and medium', () => {
    selectAquarellePaintTool('watercolor');
    const tip = aquarelleSelectedTipId.value;
    selectAquarellePaintTool('watercolor');
    expect(aquarelleActiveTool.value).toBe('watercolor');
    expect(aquarelleSelectedTipId.value).toBe(tip);
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });
});
