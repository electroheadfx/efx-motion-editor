/**
 * quick 261121-mtu — the paint tool's brush-family law.
 * quick 261122-gys — supersedes part of it: the paint family is now an
 * IDENTITY, not a one-way filter. The selected medium equals the selected
 * preset's group, and Brush <-> Watercolor land on the family's last brush.
 *
 * Laws pinned here:
 *   a watercolor-group brush pick selects the Watercolor tool
 *   an acrylic (displayed Gouache) pick selects the Brush tool — quick
 *     261124-iq9: the acrylic group is the only non-watercolor group
 *   an unknown id clears the selection and never flips the tool (the shipped
 *     `nextId !== null` guard — an unknown pick is a clear, not a family pick)
 *   the Watercolor tool applies the Watercolor medium and lands on the
 *     family's last picked tip (`round` on a fresh session)
 *   the Brush tool keeps a non-watercolor tip and repairs a disagreeing
 *     medium label; a watercolor tip crosses to the family's last picked tip
 *     (`bristle-round` / acrylic by default) and applies that record
 *   a no-group tip (catalog / TIPS / unknown) keeps the current medium
 *   a second press of the active paint tool writes no signal at all
 *   quick 261124-tje: every bag-carrying pick lands the brush's own landing
 *     bag LAST — the record's ten keys survive, the four bag keys win
 *   the Water tool is a plain tool write (no family or medium change)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, brushGroupOf, mediumById, type MediumId } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleActiveTool,
  aquarelleBrushResponseMemory,
  aquarelleLastBrushFamilyTipId,
  aquarelleLastTipByGroup,
  aquarelleParams,
  aquarelleSelectedMediumId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  applyAquarelleMedium,
  paintToolForTip,
  selectAquarellePaintTool,
  selectAquarelleTip,
  setAquarelleParam,
} from './aquarelleRecordState';

const WATERCOLOR_FIRST = BRUSH_PRESETS.find((preset) => brushGroupOf(preset) === 'watercolor')!;
const STORE_SOURCE = readFileSync(resolve(__dirname, './aquarelleRecordState.ts'), 'utf8');

/** The identity law's assertion: all fourteen medium keys equal the record. */
function expectRecordApplied(group: MediumId): void {
  const record = mediumById(group)!;
  for (const [key, value] of Object.entries(record.params)) {
    expect(aquarelleParams.value[key as keyof typeof record.params], `${group}.${key}`).toBe(value);
  }
}

// quick 261124-tje: the acrylic family's landing bags. The Gouache bag
// overwrites four of the record's fourteen keys, so a bag-carrying pick is
// pinned as record-minus-bag PLUS the bag — the record's other ten keys
// survive, proving the medium landed first and the bag last.
const ACRYLIC_BAG_KEYS: readonly string[] = ['load', 'pickup', 'dry', 'feather'];
const ACRYLIC_RECORD_ONLY_KEYS = Object.keys(mediumById('acrylic')!.params).filter(
  (key) => !ACRYLIC_BAG_KEYS.includes(key),
);

/** The ten acrylic record keys the brush bag never overwrites. */
function expectAcrylicRecordMinusBag(): void {
  const record = mediumById('acrylic')!;
  for (const key of ACRYLIC_RECORD_ONLY_KEYS) {
    expect(
      aquarelleParams.value[key as keyof typeof record.params],
      `acrylic.${key} is the record's`,
    ).toBe(record.params[key as keyof typeof record.params]);
  }
}

/** The four Gouache bag keys (they land LAST, after the record). */
function expectBrushBagApplied(): void {
  expect(aquarelleParams.value.load, 'Gouache bag load').toBe(100);
  expect(aquarelleParams.value.pickup, 'Gouache bag pickup').toBe(100);
  expect(aquarelleParams.value.dry, 'Gouache bag dry').toBe(0);
  expect(aquarelleParams.value.feather, 'Gouache bag feather').toBe(100);
}

describe('the opening tool follows the default brush (2026-11-22)', () => {
  it('the default brush is Bristle Round and its family tool is Brush', () => {
    // Artist decision 2026-11-22: a fresh Studio opens on the ACRYLIC family,
    // not the watercolor Filbert (the old default).
    expect(paintToolForTip('bristle-round')).toBe('brush');
    expect(
      brushGroupOf(BRUSH_PRESETS.find((preset) => preset.id === 'bristle-round')!),
    ).toBe('acrylic');
  });

  it('the active-tool signal is derived from the default tip, never hardcoded', () => {
    expect(STORE_SOURCE).toContain(
      'export const aquarelleActiveTool = signal<AquarelleTool>(paintToolForTip(DEFAULT_TIP_ID));',
    );
    expect(STORE_SOURCE).toContain("const DEFAULT_TIP_ID = 'bristle-round';");
    // The fresh session's medium matches the default brush's family: the
    // initial selection IS the acrylic record (a watercolor label over an
    // acrylic brush would show the fluid rows for a bristle brush).
    expect(STORE_SOURCE).toContain("const INITIAL_MEDIUM_ID: MediumId = 'acrylic';");
    expect(STORE_SOURCE).toContain(
      'export const aquarelleSelectedMediumId = signal<MediumId | null>(INITIAL_MEDIUM_ID);',
    );
    expect(STORE_SOURCE).toContain('...mediumById(INITIAL_MEDIUM_ID)!.params,');
  });

  it('a fresh Studio is unchanged: Brush, Bristle Round, Acrylic, the acrylic record', () => {
    // quick 261122-gys must_haves row 1 — runs before any case mutates state.
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expectRecordApplied('acrylic');
    // Session memory starts empty; the Brush family defaults to Bristle Round
    // (quick 261124-iq9: the acrylic group has exactly one member).
    expect(aquarelleLastTipByGroup.value).toEqual({});
    expect(aquarelleLastBrushFamilyTipId.value).toBe('bristle-round');
  });
});

function resetFamily(): void {
  aquarelleSelectedTipId.value = null;
  aquarelleActiveTool.value = 'brush';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  aquarelleBrushResponseMemory.value = {};
  aquarelleSelectedMediumId.value = null;
  aquarelleLastTipByGroup.value = {};
  aquarelleLastBrushFamilyTipId.value = 'bristle-round';
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

  it('an acrylic (Gouache) pick selects the Brush tool', () => {
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

// quick 261122-gys supersedes quick 261121-mtu's rev-2 Brush law ("the Brush
// tool changes neither the selected tip nor the medium"): that law produced
// the artist's gouache brush carrying watercolor params.
describe('selectAquarellePaintTool — the identity law (quick 261122-gys)', () => {
  beforeEach(() => {
    resetFamily();
  });

  it('A -> W -> B lands Bristle Round with the Acrylic record (the artist report)', () => {
    // Start from the acrylic family, as a fresh Studio does.
    selectAquarelleTip('bristle-round');
    applyAquarelleMedium('acrylic');

    selectAquarellePaintTool('watercolor');
    expect(aquarelleActiveTool.value).toBe('watercolor');
    expect(aquarelleSelectedTipId.value).toBe('round');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    expectRecordApplied('watercolor');

    selectAquarellePaintTool('brush');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    // quick 261124-tje: the record lands first, the Gouache bag last.
    expectAcrylicRecordMinusBag();
    expectBrushBagApplied();
    // The artist-named values, at their source: the record's body / viscosity /
    // water / wetSeconds, the bag's feather 100 and dry 0.
    expect(aquarelleParams.value.body).toBe(100);
    expect(aquarelleParams.value.feather).toBe(100);
    expect(aquarelleParams.value.dry).toBe(0);
    expect(aquarelleParams.value.viscosity).toBe(90);
    expect(aquarelleParams.value.water).toBe(26);
    expect(aquarelleParams.value.wetSeconds).toBe(12);
  });

  it('the Watercolor tool applies the Watercolor medium and lands on the family default when the tip is outside the group', () => {
    aquarelleSelectedTipId.value = 'bristle-round';
    selectAquarellePaintTool('watercolor');
    // The law, not a hardcoded id: the group's first preset is `round` today.
    expect(WATERCOLOR_FIRST.id).toBe('round');
    expect(aquarelleSelectedTipId.value).toBe(WATERCOLOR_FIRST.id);
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    expect(aquarelleActiveTool.value).toBe('watercolor');
    expectRecordApplied('watercolor');
  });

  it('the Watercolor tool keeps a tip already inside the watercolor group', () => {
    aquarelleSelectedTipId.value = 'hake';
    selectAquarellePaintTool('watercolor');
    expect(aquarelleSelectedTipId.value).toBe('hake');
    expect(aquarelleActiveTool.value).toBe('watercolor');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('the Watercolor tool lands on the family\'s remembered pick (hake)', () => {
    selectAquarelleTip('hake');
    selectAquarelleTip('bristle-round');
    selectAquarellePaintTool('watercolor');
    expect(aquarelleSelectedTipId.value).toBe('hake');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    expectRecordApplied('watercolor');
  });

  // Supersedes quick 261121-mtu rev 2: "the Brush tool leaves a non-watercolor
  // tip alone and never touches the medium".
  it('the Brush tool keeps a non-watercolor tip and repairs a disagreeing label', () => {
    applyAquarelleMedium('watercolor');
    aquarelleSelectedTipId.value = 'bristle-round';
    expect(aquarelleSelectedMediumId.value, 'the label disagrees before the press').toBe('watercolor');
    selectAquarellePaintTool('brush');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectedTipId.value, 'the tip is kept').toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value, 'the label is repaired').toBe('acrylic');
    expectAcrylicRecordMinusBag();
    expectBrushBagApplied();
  });

  it('a staying Brush press never wipes a manual global tweak (MED-13)', () => {
    selectAquarelleTip('bristle-round');
    applyAquarelleMedium('acrylic');
    setAquarelleParam('water', 71);
    const bag = aquarelleParams.value;
    selectAquarellePaintTool('brush');
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleParams.value, 'the bag reference is untouched').toBe(bag);
    expect(aquarelleParams.value.water).toBe(71);
  });

  // Supersedes quick 261121-mtu rev 2: "the Brush tool moves a watercolor tip
  // into the brush family" and "never touches the medium".
  it('the Brush tool crosses a watercolor tip to Bristle Round and the Acrylic record', () => {
    applyAquarelleMedium('watercolor');
    aquarelleSelectedTipId.value = 'hake';
    aquarelleActiveTool.value = 'watercolor';
    selectAquarellePaintTool('brush');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expectAcrylicRecordMinusBag();
    expectBrushBagApplied();
  });

  it('the Brush tool lands on the family\'s remembered pick (bristle-round)', () => {
    selectAquarelleTip('hake');
    selectAquarelleTip('bristle-round');
    selectAquarellePaintTool('watercolor');
    selectAquarellePaintTool('brush');
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expectAcrylicRecordMinusBag();
    expectBrushBagApplied();
  });

  it('a no-group tip keeps the medium on a Brush press and crosses on a Watercolor press', () => {
    selectAquarelleTip('bristle-round');
    applyAquarelleMedium('acrylic');
    selectAquarelleTip('wc/texture-sponge');
    expect(aquarelleSelectedTipId.value, 'the TIPS id resolves as a pick').toBe('wc/texture-sponge');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    selectAquarellePaintTool('brush');
    expect(aquarelleSelectedTipId.value, 'a no-group tip is kept').toBe('wc/texture-sponge');
    expect(aquarelleSelectedMediumId.value, 'and its medium is kept too').toBe('acrylic');
    selectAquarellePaintTool('watercolor');
    expect(aquarelleSelectedTipId.value).toBe('round');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('a second press of the active paint tool writes no signal at all', () => {
    selectAquarellePaintTool('watercolor');
    const params = aquarelleParams.value;
    const tip = aquarelleSelectedTipId.value;
    const medium = aquarelleSelectedMediumId.value;
    const tool = aquarelleActiveTool.value;
    let writes = 0;
    const stops = [
      aquarelleParams.subscribe(() => { writes += 1; }),
      aquarelleSelectedTipId.subscribe(() => { writes += 1; }),
      aquarelleSelectedMediumId.subscribe(() => { writes += 1; }),
      aquarelleActiveTool.subscribe(() => { writes += 1; }),
      aquarelleLastTipByGroup.subscribe(() => { writes += 1; }),
      aquarelleLastBrushFamilyTipId.subscribe(() => { writes += 1; }),
    ];
    writes = 0;
    selectAquarellePaintTool('watercolor');
    for (const stop of stops) stop();
    expect(writes, 'a no-op press wakes no subscriber').toBe(0);
    expect(aquarelleParams.value).toBe(params);
    expect(aquarelleSelectedTipId.value).toBe(tip);
    expect(aquarelleSelectedMediumId.value).toBe(medium);
    expect(aquarelleActiveTool.value).toBe(tool);
  });

  // quick 261124-tje: the bag reload is gated by the SAME condition as the
  // medium repair (MED-13) — a staying Brush press whose label already agrees
  // must not reload the bag over the artist's manual tweaks.
  it('a staying Brush press writes no signal at all (the bag is gated like the record)', () => {
    selectAquarelleTip('bristle-round');
    applyAquarelleMedium('acrylic');
    // The first press settles the family memory; the second is the no-op.
    selectAquarellePaintTool('brush');
    const params = aquarelleParams.value;
    const tip = aquarelleSelectedTipId.value;
    const medium = aquarelleSelectedMediumId.value;
    const tool = aquarelleActiveTool.value;
    let writes = 0;
    const stops = [
      aquarelleParams.subscribe(() => { writes += 1; }),
      aquarelleSelectedTipId.subscribe(() => { writes += 1; }),
      aquarelleSelectedMediumId.subscribe(() => { writes += 1; }),
      aquarelleActiveTool.subscribe(() => { writes += 1; }),
      aquarelleLastTipByGroup.subscribe(() => { writes += 1; }),
      aquarelleLastBrushFamilyTipId.subscribe(() => { writes += 1; }),
    ];
    writes = 0;
    selectAquarellePaintTool('brush');
    for (const stop of stops) stop();
    expect(writes, 'a staying Brush press wakes no subscriber').toBe(0);
    expect(aquarelleParams.value, 'the bag reference is untouched').toBe(params);
    expect(aquarelleSelectedTipId.value).toBe(tip);
    expect(aquarelleSelectedMediumId.value).toBe(medium);
    expect(aquarelleActiveTool.value).toBe(tool);
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
