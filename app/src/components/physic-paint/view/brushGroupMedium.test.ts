// ============================================================
//  64-12 (MED-28) — the response group IS the medium.
//
//  Laws pinned here:
//   1. A pick whose group differs applies that group's medium
//      through applyAquarelleMedium: ONE bag write plus the id,
//      never size, never lift, never a selection params patch.
//   2. A pick inside the same group writes nothing, so a manual
//      global tweak survives (MED-13).
//   3. The committed selection patch stays { brushId, toolOverrides }
//      with no params key, so a card pick never rewrites a recorded
//      stroke (MED-11).
//   4. A non-preset id has no group, writes no medium, still updates
//      the live surface, and returns the record door's refusal
//      instead of throwing.
//   5. The Paint tab agrees after a cross-group pick — the selected
//      medium id and the ten globals — and a texture selection
//      changes neither.
//   6. One seam: every response surface calls pickAquarelleBrush, and
//      only the Paint-tab dropdown and the seam call the medium
//      handler.
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
  aquarelleParams,
  aquarelleSelectedMediumId,
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  applyAquarelleMedium,
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
];

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
  it('applies the pastel record once and still commits one selection patch', async () => {
    recordAquarelleStroke(10901, stroke({ points: [point(0.2, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10901]);
    const { calls } = installPort();
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('chalk');

    expect(bag.count(), 'one spread assignment, not a per-key cascade').toBe(1);
    bag.stop();
    expect(ids.count(), 'the medium id moves once').toBe(1);
    ids.stop();
    expect(aquarelleSelectedMediumId.value).toBe('pastel');
    const pastel = mediumById('pastel')!;
    for (const key of MEDIUM_KEYS) {
      expect(aquarelleParams.value[key], key).toBe(pastel.params[key]);
    }
    expect(calls, 'exactly one selection patch').toHaveLength(1);
    expect(calls[0]!.patch.brushId).toBe('chalk');
  });

  it('writes nothing inside the group and keeps a manual tweak', async () => {
    await pickAquarelleBrush('chalk');
    expect(aquarelleSelectedMediumId.value, 'chalk landed on pastel').toBe('pastel');
    setAquarelleParam('water', 71);
    const tweaked = aquarelleParams.value;
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('conte-hard');

    expect(bag.count(), 'same group, no medium write').toBe(0);
    expect(ids.count(), 'the medium id is untouched').toBe(0);
    bag.stop();
    ids.stop();
    expect(aquarelleParams.value, 'the bag reference is untouched').toBe(tweaked);
    expect(aquarelleParams.value.water, 'the manual tweak survives').toBe(71);
    expect(aquarelleSelectedMediumId.value).toBe('pastel');
    expect(aquarelleSelectedTipId.value).toBe('conte-hard');
  });

  it('restores the watercolor record when the pick returns to its group', async () => {
    setAquarelleParam('size', 77);
    setAquarelleParam('lift', 33);
    await pickAquarelleBrush('chalk');
    expect(aquarelleParams.value.dry, 'pastel landed').toBe(80);

    await pickAquarelleBrush('round');

    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
    const neutral = mediumById(DEFAULT_MEDIUM_ID)!;
    for (const key of MEDIUM_KEYS) {
      expect(aquarelleParams.value[key], `${key} is neutral again`).toBe(neutral.params[key]);
    }
    expect(aquarelleParams.value.size, 'a medium never resizes the brush').toBe(77);
    expect(aquarelleParams.value.lift, 'a medium never changes the eraser').toBe(33);
  });

  it('writes nothing when the dropdown already selected the pick group', async () => {
    // The Paint-tab dropdown's own handler, before a single response pick.
    applyAquarelleMedium('pastel');
    const applied = aquarelleParams.value;
    const bag = countBagWrites();
    const ids = countIdWrites();

    await pickAquarelleBrush('chalk');

    expect(bag.count(), 'the record is already the bag').toBe(0);
    expect(ids.count(), 'the id compare-then-write stays closed').toBe(0);
    bag.stop();
    ids.stop();
    expect(aquarelleParams.value, 'the bag reference is untouched').toBe(applied);
    expect(aquarelleSelectedMediumId.value, 'the dropdown and the params agree').toBe('pastel');
  });

  it('forwards the post-pick bag and no params key in the committed patch', async () => {
    recordAquarelleStroke(10902, stroke({ points: [point(0.4, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10902]);
    const { calls } = installPort();
    const before = JSON.stringify(getRecordedAquarelleStroke(10902));

    await pickAquarelleBrush('chalk');

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

  it('keeps size and lift across every cross-group pick', async () => {
    setAquarelleParam('size', 64);
    setAquarelleParam('lift', 31);

    await pickAquarelleBrush('bristle-flat');
    await pickAquarelleBrush('graphite-6b');
    await pickAquarelleBrush('chalk');

    expect(aquarelleSelectedMediumId.value).toBe('pastel');
    expect(aquarelleParams.value.size, 'size is not a medium key').toBe(64);
    expect(aquarelleParams.value.lift, 'lift is not a medium key').toBe(31);
  });

  it('gives a non-preset id no group, no medium write, and the door refusal', async () => {
    recordAquarelleStroke(10903, stroke({ points: [point(0.6, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10903]);
    const refusal = Promise.resolve(false);
    const { calls } = installPort(refusal);
    applyAquarelleMedium('pastel');
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
    expect(aquarelleSelectedMediumId.value).toBe('pastel');
    expect(aquarelleSelectedTipId.value, 'the live surface still follows the pick').toBeNull();
    expect(calls, 'the patch still reaches the door, which refuses it').toHaveLength(1);
    expect(calls[0]!.patch.brushId).toBe('wc/unknown-catalog-tip');
  });
});

describe('the Paint tab agrees after a cross-group pick (64-12 MED-28)', () => {
  it('moves the selected medium id and the ten globals with the group', async () => {
    setAquarelleParam('size', 55);
    setAquarelleParam('lift', 27);
    const sizeBefore = aquarelleParams.value.size;
    const liftBefore = aquarelleParams.value.lift;
    const group = presetGroup('graphite-pencil');
    expect(group, 'graphite-pencil is tagged').not.toBeNull();

    await pickAquarelleBrush('graphite-pencil');

    expect(aquarelleSelectedMediumId.value, 'the dropdown renders this id').toBe(group);
    const record = mediumById(group!)!;
    const globals = Object.fromEntries(
      MEDIUM_KEYS.map((key) => [key, aquarelleParams.value[key]]),
    );
    expect(Object.keys(globals), 'exactly the ten keys D-02 names').toHaveLength(10);
    expect(globals, 'the ten globals equal the record').toEqual(record.params);
    expect(Object.keys(aquarelleParams.value).sort(), 'the bag keeps its twelve keys').toEqual(
      [...MEDIUM_KEYS, 'size', 'lift'].sort(),
    );
    expect(aquarelleParams.value.size, 'size is reference-equal to its prior value').toBe(
      sizeBefore,
    );
    expect(aquarelleParams.value.lift, 'lift is reference-equal to its prior value').toBe(
      liftBefore,
    );
  });

  it('changes neither the medium id nor the bag when a texture is selected', async () => {
    await pickAquarelleBrush('bristle-flat');
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

  it('keeps one tip-pick caller and two medium-handler callers', () => {
    const sources = viewSources();
    expect(filesMatching(sources, 'selectAquarelleTip('), 'the definition and the one seam').toEqual([
      'aquarellePaintControls.ts',
      'aquarelleRecordState.ts',
    ]);
    expect(
      filesMatching(sources, 'applyAquarelleMedium('),
      'the definition, the seam and the Paint-tab dropdown',
    ).toEqual(['AquarelleGlobalsPanel.tsx', 'aquarellePaintControls.ts', 'aquarelleRecordState.ts']);
    expect(
      filesMatching(sources, 'setAquarelleParam('),
      'no view writes medium keys outside the record module and the shipped globals surfaces',
    ).toEqual([
      'AquarelleGlobalsPanel.tsx',
      'PhysicsPaintTopBar.tsx',
      'aquarelleRecordState.ts',
    ]);
    // "Each beside its definition": one definition, one seam call, one
    // dropdown call — never a second pathway.
    expect(countOf(sources, 'aquarelleRecordState.ts', 'selectAquarelleTip(')).toBe(1);
    expect(countOf(sources, 'aquarellePaintControls.ts', 'selectAquarelleTip(')).toBe(1);
    expect(countOf(sources, 'aquarelleRecordState.ts', 'applyAquarelleMedium(')).toBe(1);
    expect(countOf(sources, 'aquarellePaintControls.ts', 'applyAquarelleMedium(')).toBe(1);
    expect(countOf(sources, 'AquarelleGlobalsPanel.tsx', 'applyAquarelleMedium(')).toBe(1);
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
