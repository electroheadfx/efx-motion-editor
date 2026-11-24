// ============================================================
//  64-12 (MED-28) — the response group IS the medium.
//
//  Laws pinned here:
//   1. A pick whose group differs applies that group's medium
//      through applyAquarelleMedium: ONE bag write plus the id,
//      never size, never lift, never a selection params patch —
//      then the brush's own landing bag (quick 261124-tje) as a
//      SECOND spread write, so the bag always wins over the record.
//   2. A pick inside the same group writes nothing, so a manual
//      global tweak survives (MED-13).
//   3. The committed selection patch stays { brushId, toolOverrides }
//      with no params key, so a card pick never rewrites a recorded
//      stroke (MED-11).
//   4. A non-preset id has no group, writes no medium, still updates
//      the live surface, and returns the record door's refusal
//      instead of throwing.
//   5. The Paint tab agrees after a cross-group pick — the selected
//      medium id and the fourteen globals — and a texture selection
//      changes neither.
//   6. One seam: every response surface calls pickAquarelleBrush, and
//      only the pick seam and the store's own `pickAquarelleMedium`
//      (the Paint-tab dropdown's handler) call the medium handler.
//
//  quick 261122-gys supersedes the outgoing-group comparison this file
//  originally pinned: the seam now compares the SELECTED MEDIUM with the
//  incoming preset's group, so a no-group tip in between cannot suppress a
//  needed apply. Law 6's audit counts follow that shape.
//
//  Node env, real signals, fake selection port. Id band 10901+.
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  BRUSH_PRESETS,
  DEFAULT_MEDIUM_ID,
  MEDIUM_IDS,
  brushGroupOf,
  mediumById,
  type MediumId,
  type MediumParamKey,
} from '@efxlab/efx-watercolor';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  DEFAULT_AQUARELLE_PARAMS,
  aquarelleBrushResponseMemory,
  aquarelleLastBrushFamilyTipId,
  aquarelleLastTipByGroup,
  aquarelleParams,
  aquarelleSelectedMediumId,
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  applyAquarelleMedium,
  aquarellePaintCanonicalFromPx,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  setAquarelleParam,
  setAquarelleSelectedTextureId,
} from './aquarelleRecordState';
import {
  setAquarelleSelectionEditPort,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import {
  clearScriptStrokeSelection,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';
import { pickAquarelleBrush } from './aquarellePaintControls';
import type { ScriptStrokeAppearancePatch } from './strokeSettingsModel';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The ten keys a medium may set — never size, never lift (D-02). */
const MEDIUM_KEYS: readonly MediumParamKey[] = [
  'water',
  'load',
  'flow',
  'bleed',
  'dry',
  'edge',
  'granulation',
  'viscosity',
  'body',
  'emboss',
  'feather',
  'pickup',
  'refill',
  'wetSeconds',
];

/** quick 261124-tje: the Gouache (acrylic) landing bag — the four medium
 *  keys the bag overwrites last, on the record's own 0..100 scale. */
const ACRYLIC_BAG_KEYS: readonly MediumParamKey[] = ['load', 'pickup', 'dry', 'feather'];
const ACRYLIC_BAG: Readonly<Partial<Record<MediumParamKey, number>>> = {
  load: 100,
  pickup: 100,
  dry: 0,
  feather: 100,
};
/** The record keys the bag never touches (ten of the fourteen). */
const RECORD_ONLY_KEYS = MEDIUM_KEYS.filter((key) => !ACRYLIC_BAG_KEYS.includes(key));

/** The ten record-only keys still equal the acrylic record. */
function expectAcrylicRecordMinusBag(): void {
  const record = mediumById('acrylic')!;
  for (const key of RECORD_ONLY_KEYS) {
    expect(aquarelleParams.value[key], `acrylic.${key} is the record's`).toBe(record.params[key]);
  }
}

/** The four bag keys carry the Gouache bag (they land LAST). */
function expectAcrylicBag(): void {
  for (const key of ACRYLIC_BAG_KEYS) {
    expect(aquarelleParams.value[key], `bag.${key}`).toBe(ACRYLIC_BAG[key]);
  }
}

interface PortCall {
  ids: readonly number[];
  patch: ScriptStrokeAppearancePatch;
}

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(options: { points: readonly AquarellePoint[] }): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: options.points,
    timestamp: 0,
    playFrame: 9001,
  };
}

/** Register a fake port that records every (ids, patch) call. */
function installPort(
  result: Promise<boolean> = Promise.resolve(true),
): { calls: PortCall[]; promise: Promise<boolean> } {
  const calls: PortCall[] = [];
  setAquarelleSelectionEditPort({
    applyAppearance: (ids, patch) => {
      calls.push({ ids, patch });
      return result;
    },
  });
  return { calls, promise: result };
}

/** Count effective writes to the live bag (subscribe fires once on attach). */
function countBagWrites(): { count: () => number; stop: () => void } {
  let count = 0;
  const dispose = aquarelleParams.subscribe(() => {
    count += 1;
  });
  count = 0;
  return { count: () => count, stop: dispose };
}

function countIdWrites(): { count: () => number; stop: () => void } {
  let count = 0;
  const dispose = aquarelleSelectedMediumId.subscribe(() => {
    count += 1;
  });
  count = 0;
  return { count: () => count, stop: dispose };
}

/** The group resolver contract for a response id — null outside the table. */
function presetGroup(id: string): MediumId | null {
  const preset = BRUSH_PRESETS.find((candidate) => candidate.id === id);
  return preset ? brushGroupOf(preset) : null;
}

function resetState(): void {
  resetAquarelleRecordState();
  aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
  aquarelleSelectedMediumId.value = DEFAULT_MEDIUM_ID;
  aquarelleSelectedTextureId.value = null;
  aquarelleSelectedTipId.value = 'filbert';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  aquarelleBrushResponseMemory.value = {};
  // quick 261122-gys: the session family memory must not leak across cases.
  aquarelleLastTipByGroup.value = {};
  aquarelleLastBrushFamilyTipId.value = 'bristle-round';
  setAquarelleSelectionEditPort(null);
  setAquarelleSelectMode(false);
  clearScriptStrokeSelection();
}

beforeEach(() => {
  resetState();
});

afterEach(() => {
  // The port is a plain module variable: a leaked fake would forward the next
  // case's commit, and a leaked medium write would poison the next case.
  setAquarelleSelectionEditPort(null);
  setAquarelleSelectMode(false);
  clearScriptStrokeSelection();
});

describe('a cross-group pick applies the group medium (64-12 MED-28)', () => {
  // quick 261124-iq9: two medium groups only — Watercolor and Gouache (the
  // acrylic record). The cross-group pick goes watercolor → acrylic on
  // `bristle-round`, the acrylic group's only member.
  it('applies the acrylic record once and still commits one selection patch', async () => {
    recordAquarelleStroke(10901, stroke({ points: [point(0.2, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10901]);
    const { calls } = installPort();
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('bristle-round');

    expect(bag.count(), 'the record is one spread assignment, the brush bag a second').toBe(2);
    bag.stop();
    expect(ids.count(), 'the medium id moves once').toBe(1);
    ids.stop();
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    // quick 261124-tje: the record lands FIRST, the Gouache bag LAST — so the
    // ten non-bag medium keys equal the record and the four bag keys the bag.
    expectAcrylicRecordMinusBag();
    expectAcrylicBag();
    expect(calls, 'exactly one selection patch').toHaveLength(1);
    expect(calls[0]!.patch.brushId).toBe('bristle-round');
  });

  it('writes nothing inside the group and keeps a manual tweak', async () => {
    // The acrylic group has exactly one member, so the same-group case rides
    // two watercolor responses (round, then flat).
    await pickAquarelleBrush('round');
    expect(aquarelleSelectedMediumId.value, 'round is watercolor').toBe('watercolor');
    setAquarelleParam('water', 71);
    const tweaked = aquarelleParams.value;
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('flat');

    expect(bag.count(), 'same group, no medium write').toBe(0);
    expect(ids.count(), 'the medium id is untouched').toBe(0);
    bag.stop();
    ids.stop();
    expect(aquarelleParams.value, 'the bag reference is untouched').toBe(tweaked);
    expect(aquarelleParams.value.water, 'the manual tweak survives').toBe(71);
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    expect(aquarelleSelectedTipId.value).toBe('flat');
  });

  it('restores the watercolor record when the pick returns to its group', async () => {
    setAquarelleParam('size', 77);
    setAquarelleParam('lift', 33);
    await pickAquarelleBrush('bristle-round');
    expect(aquarelleParams.value.dry, 'the Gouache bag landed last').toBe(0);
    // quick 261124-tje: the brush bag owns size — capture the landed canonical
    // and re-prove the MEDIUM law below with a medium-only call.
    const bagSize = aquarelleParams.value.size;
    expect(bagSize, 'the bag stores the 40 px conversion').toBe(aquarellePaintCanonicalFromPx(40));

    await pickAquarelleBrush('round');

    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    const neutral = mediumById(DEFAULT_MEDIUM_ID)!;
    for (const key of MEDIUM_KEYS) {
      expect(aquarelleParams.value[key], `${key} is neutral again`).toBe(neutral.params[key]);
    }
    applyAquarelleMedium('watercolor');
    expect(aquarelleParams.value.size, 'a medium never resizes the brush').toBe(bagSize);
    expect(aquarelleParams.value.lift, 'a medium never changes the eraser').toBe(33);
  });

  it('lands only the brush bag when the record is already applied', async () => {
    // The Paint-tab dropdown's own handler, before a single response pick.
    applyAquarelleMedium('acrylic');
    const applied = aquarelleParams.value;
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('bristle-round');

    expect(bag.count(), 'only the brush bag writes — a pick is a pick').toBe(1);
    expect(ids.count(), 'the id compare-then-write stays closed').toBe(0);
    bag.stop();
    ids.stop();
    expect(aquarelleParams.value, 'the landing is a new reference').not.toBe(applied);
    expectAcrylicRecordMinusBag();
    expectAcrylicBag();
    expect(aquarelleSelectedMediumId.value, 'the dropdown and the params agree').toBe('acrylic');
  });

  it('forwards the post-pick bag and no params key in the committed patch', async () => {
    recordAquarelleStroke(10902, stroke({ points: [point(0.4, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10902]);
    const { calls } = installPort();
    const before = JSON.stringify(getRecordedAquarelleStroke(10902));

    await pickAquarelleBrush('bristle-round');

    expect(calls).toHaveLength(1);
    const patch = calls[0]!.patch;
    expect(Object.keys(patch).sort(), 'the patch is exactly two keys').toEqual([
      'brushId',
      'toolOverrides',
    ]);
    expect(patch.toolOverrides, 'the forwarded bag is the post-pick live bag').toEqual(
      aquarelleToolOverrides.peek(),
    );
    expect(JSON.stringify(getRecordedAquarelleStroke(10902)), 'the stroke is untouched').toBe(
      before,
    );
  });

  it('the medium never resizes or moves lift; the brush bag owns size', async () => {
    setAquarelleParam('size', 64);
    setAquarelleParam('lift', 31);

    await pickAquarelleBrush('bristle-round');
    const bagSize = aquarellePaintCanonicalFromPx(40);
    expect(aquarelleParams.value.size, 'the Gouache bag landed its 40 px').toBe(bagSize);
    await pickAquarelleBrush('flat');
    expect(aquarelleParams.value.size, 'a watercolor pick carries no bag').toBe(bagSize);
    await pickAquarelleBrush('bristle-round');

    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleParams.value.size, 'the brush bag owns size').toBe(bagSize);
    expect(aquarelleParams.value.lift, 'lift is not a medium key').toBe(31);
    // The MEDIUM law alone: a record apply never resizes and never moves lift.
    applyAquarelleMedium('acrylic');
    expect(aquarelleParams.value.size).toBe(bagSize);
    expect(aquarelleParams.value.lift).toBe(31);
  });

  it('a cross-group pick of Pen lands the acrylic record then the Pen bag', async () => {
    recordAquarelleStroke(10904, stroke({ points: [point(0.3, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10904]);
    const { calls } = installPort();
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('pen');

    expect(bag.count(), 'the record plus the bag, two spread writes').toBe(2);
    bag.stop();
    expect(ids.count(), 'the medium id moves once').toBe(1);
    ids.stop();
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(calls, 'exactly one selection patch').toHaveLength(1);
    expect(calls[0]!.patch.brushId).toBe('pen');
    expectAcrylicRecordMinusBag();
    expect(aquarelleParams.value.size, 'the Pen bag size, via the live response').toBe(
      aquarellePaintCanonicalFromPx(10),
    );
    expect(aquarelleParams.value.load).toBe(100);
    expect(aquarelleParams.value.pickup).toBe(0);
    expect(aquarelleParams.value.dry).toBe(0);
    expect(aquarelleParams.value.feather).toBe(85);
  });

  it('gives a non-preset id no group, no medium write, and the door refusal', async () => {
    recordAquarelleStroke(10903, stroke({ points: [point(0.6, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10903]);
    const refusal = Promise.resolve(false);
    const { calls } = installPort(refusal);
    applyAquarelleMedium('acrylic');
    const bagBefore = aquarelleParams.value;
    const bag = countBagWrites();
    const ids = countIdWrites();

    const result = pickAquarelleBrush('wc/unknown-catalog-tip');
    expect(result, 'the door refusal is returned, never thrown').toBe(refusal);
    await result;

    expect(bag.count(), 'an unknown tip never acquires a group').toBe(0);
    expect(ids.count()).toBe(0);
    bag.stop();
    ids.stop();
    expect(aquarelleParams.value, 'the bag reference is untouched').toBe(bagBefore);
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleSelectedTipId.value, 'the live surface still follows the pick').toBeNull();
    expect(calls, 'the patch still reaches the door, which refuses it').toHaveLength(1);
    expect(calls[0]!.patch.brushId).toBe('wc/unknown-catalog-tip');
  });
});

describe('the Paint tab agrees after a cross-group pick (64-12 MED-28)', () => {
  it('moves the selected medium id and the ten record globals with the group', async () => {
    setAquarelleParam('size', 55);
    setAquarelleParam('lift', 27);
    const liftBefore = aquarelleParams.value.lift;
    const group = presetGroup('bristle-round');
    expect(group, 'bristle-round is tagged').not.toBeNull();

    await pickAquarelleBrush('bristle-round');

    expect(aquarelleSelectedMediumId.value, 'the dropdown renders this id').toBe(group);
    // quick 261124-tje: the record lands first, the Gouache bag last — the
    // record-only keys equal the record, the four bag keys equal the bag.
    expectAcrylicRecordMinusBag();
    expectAcrylicBag();
    expect(Object.keys(aquarelleParams.value).sort(), 'the bag keeps its sixteen keys').toEqual(
      [...MEDIUM_KEYS, 'size', 'lift'].sort(),
    );
    expect(aquarelleParams.value.size, 'the brush bag owns size').toBe(
      aquarellePaintCanonicalFromPx(40),
    );
    expect(aquarelleParams.value.lift, 'lift is reference-equal to its prior value').toBe(
      liftBefore,
    );
  });

  it('changes neither the medium id nor the bag when a texture is selected', async () => {
    await pickAquarelleBrush('bristle-round');
    const bag = aquarelleParams.value;
    const mediumId = aquarelleSelectedMediumId.value;
    const bagWrites = countBagWrites();
    const idWrites = countIdWrites();

    setAquarelleSelectedTextureId('wc/synthetic-texture');

    expect(aquarelleSelectedTextureId.value).toBe('wc/synthetic-texture');
    expect(aquarelleParams.value, 'the bag reference is unchanged').toBe(bag);
    expect(aquarelleSelectedMediumId.value).toBe(mediumId);
    expect(bagWrites.count()).toBe(0);
    expect(idWrites.count()).toBe(0);
    bagWrites.stop();
    idWrites.stop();
  });

  it('maps every preset group to a real medium record', () => {
    const groups = new Set<MediumId>();
    for (const preset of BRUSH_PRESETS) groups.add(brushGroupOf(preset));
    for (const group of groups) {
      expect(MEDIUM_IDS, `${group} is a medium id`).toContain(group);
      const record = mediumById(group);
      expect(record, `record for ${group}`).not.toBeNull();
      expect(record!.id, 'the group IS the medium id').toBe(group);
      expect(Object.keys(record!.params).sort()).toEqual([...MEDIUM_KEYS].sort());
    }
    for (const id of MEDIUM_IDS) {
      expect(mediumById(id), `record for ${id}`).not.toBeNull();
    }
  });
});

// quick 261122-gys — the invariant: the selected medium equals the selected
// preset's group. The seam compares the selected MEDIUM with the incoming
// group, so a no-group tip (catalog / TIPS) can no longer masquerade as the
// neutral medium and suppress a needed apply.
describe('the pick seam holds the identity invariant (quick 261122-gys)', () => {
  it('a no-group TIPS pick between two groups no longer suppresses the needed apply', async () => {
    await pickAquarelleBrush('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');

    await pickAquarelleBrush('wc/texture-sponge');
    expect(aquarelleSelectedTipId.value, 'the TIPS pick lands').toBe('wc/texture-sponge');
    expect(aquarelleSelectedMediumId.value, 'a no-group tip keeps the medium').toBe('acrylic');

    await pickAquarelleBrush('round');
    expect(aquarelleSelectedMediumId.value, 'the watercolor pick applies its record').toBe(
      'watercolor',
    );
    const watercolor = mediumById('watercolor')!;
    for (const key of MEDIUM_KEYS) {
      expect(aquarelleParams.value[key], key).toBe(watercolor.params[key]);
    }
  });

  it('the selected medium equals the selected preset\'s group after every pick', async () => {
    for (const preset of BRUSH_PRESETS) {
      await pickAquarelleBrush(preset.id);
      expect(aquarelleSelectedMediumId.value, preset.id).toBe(brushGroupOf(preset));
      expect(aquarelleSelectedTipId.value, `tip ${preset.id}`).toBe(preset.id);
    }
  });
});

describe('the seam audit (64-12 MED-28)', () => {
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  function viewSources(): Map<string, string> {
    const sources = new Map<string, string>();
    for (const entry of readdirSync(HERE, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
      sources.set(
        entry.name,
        stripComments(readFileSync(resolve(HERE, entry.name), 'utf8')),
      );
    }
    return sources;
  }

  function filesMatching(sources: Map<string, string>, needle: string): string[] {
    return [...sources.entries()]
      .filter(([, source]) => source.includes(needle))
      .map(([name]) => name)
      .sort();
  }

  function countOf(sources: Map<string, string>, file: string, needle: string): number {
    const source = sources.get(file);
    expect(source, `${file} is a view source`).toBeDefined();
    return source!.split(needle).length - 1;
  }

  it('keeps one tip-pick caller and one medium-handler caller per surface', () => {
    const sources = viewSources();
    expect(filesMatching(sources, 'selectAquarelleTip('), 'the definition and the one seam').toEqual([
      'aquarellePaintControls.ts',
      'aquarelleRecordState.ts',
    ]);
    // quick 261122-gys: the Paint-tab dropdown no longer calls the medium
    // handler directly — it calls `pickAquarelleMedium`, which binds a preset
    // of the picked group and then applies the record in the store.
    expect(
      filesMatching(sources, 'applyAquarelleMedium('),
      'the definition and the pick seam only (no panel)',
    ).toEqual(['aquarellePaintControls.ts', 'aquarelleRecordState.ts']);
    expect(
      filesMatching(sources, 'pickAquarelleMedium('),
      'the definition and exactly one dropdown caller',
    ).toEqual(['AquarelleGlobalsPanel.tsx', 'aquarelleRecordState.ts']);
    expect(
      filesMatching(sources, 'setAquarelleParam('),
      'no view writes medium keys outside the record module and the shipped globals surfaces',
    ).toEqual([
      'AquarelleGlobalsPanel.tsx',
      'PhysicsPaintTopBar.tsx',
      'aquarelleRecordState.ts',
    ]);
    // "Each beside its definition": one definition, the ONE tool-pick seam
    // (selectAquarellePaintTool calls it from BOTH branches — a Watercolor
    // press binds the family's remembered tip, a crossing Brush press the
    // non-watercolor family's), plus the dropdown handler — never a second
    // pathway. quick 261122-gys: 4 = definition + Watercolor branch + Brush
    // branch + pickAquarelleMedium.
    expect(countOf(sources, 'aquarelleRecordState.ts', 'selectAquarelleTip(')).toBe(4);
    expect(countOf(sources, 'aquarellePaintControls.ts', 'selectAquarelleTip(')).toBe(1);
    // 4 = definition + Watercolor branch + Brush branch + pickAquarelleMedium.
    expect(countOf(sources, 'aquarelleRecordState.ts', 'applyAquarelleMedium(')).toBe(4);
    expect(countOf(sources, 'aquarellePaintControls.ts', 'applyAquarelleMedium(')).toBe(1);
    expect(countOf(sources, 'AquarelleGlobalsPanel.tsx', 'applyAquarelleMedium(')).toBe(0);
    expect(countOf(sources, 'aquarelleRecordState.ts', 'pickAquarelleMedium(')).toBe(1);
    expect(countOf(sources, 'AquarelleGlobalsPanel.tsx', 'pickAquarelleMedium(')).toBe(1);
  });

  it('routes every response surface through the one pick seam', () => {
    const sources = viewSources();
    const surfaces: ReadonlyArray<[string, number]> = [
      ['WatercolorBrushLibrary.tsx', 1],
      ['PhysicsPaintBrushMenu.tsx', 1],
      ['BrushesDocker.tsx', 2],
    ];
    for (const [file, callSites] of surfaces) {
      const source = sources.get(file);
      expect(source, `${file} is a view source`).toBeDefined();
      expect(source!, `${file} imports the seam from aquarellePaintControls`).toMatch(
        /pickAquarelleBrush[^;]*from '\.\/aquarellePaintControls'/,
      );
      expect(source!.split('pickAquarelleBrush(').length - 1, `${file} call sites`).toBe(
        callSites,
      );
      expect(source!, `${file} never calls the medium handler itself`).not.toContain(
        'applyAquarelleMedium',
      );
    }
  });

  it('keeps the texture strip orthogonal to the seam and the medium handler', () => {
    const strip = viewSources().get('WatercolorTextureStrip.tsx');
    expect(strip, 'the texture strip is a view source').toBeDefined();
    expect(strip!).not.toContain('pickAquarelleBrush');
    expect(strip!).not.toContain('applyAquarelleMedium');
    expect(strip!).toContain('setAquarelleSelectedTextureId');
  });
});
