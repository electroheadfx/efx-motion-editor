// ============================================================
//  Phase 64 (MED-09 / MED-10 / MED-11 / MED-12) — one-write
//  medium application in the live params bag.
//
//  Laws pinned here:
//   1. viscosity, body and emboss join the interface, the key list
//      and the defaults (0), so the record loop and the selection
//      write allowlist both gain them.
//   2. applyAquarelleMedium is ONE spread assignment plus one id
//      write — never a per-key setter cascade, never the
//      selection-edit path, never size, never lift.
//   3. A re-pick re-applies a drifted record; an identical re-pick
//      writes nothing; an unknown id is a no-op.
//   4. A medium switch never touches an already-recorded stroke.
//
//  Assertion style: scalar predicates so diagnostics stay compact.
// ============================================================

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MEDIUM_ID, toEngineParams } from '@efxlab/efx-watercolor';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  AQUARELLE_GLOBAL_KEYS,
  DEFAULT_AQUARELLE_PARAMS,
  aquarelleParams,
  aquarelleSelectedMediumId,
  applyAquarelleMedium,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  setAquarelleParam,
  snapshotAquarelleRecord,
  updateAquarelleStrokesInScript,
} from './aquarelleRecordState';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORE_SOURCE = readFileSync(resolve(HERE, 'aquarelleRecordState.ts'), 'utf8');

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(options: {
  points: readonly AquarellePoint[];
  playFrame: number;
  size?: number;
}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: options.size ?? 12 },
    brushId: 'round',
    points: options.points,
    timestamp: 0,
  };
}

/** Count effective writes to a signal (subscribe fires once on attach, then per change). */
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

/** The production source of `applyAquarelleMedium`, sliced to its own body. */
function applierSource(): string {
  const start = STORE_SOURCE.indexOf('export function applyAquarelleMedium(');
  expect(start, 'applyAquarelleMedium must exist in the store').toBeGreaterThanOrEqual(0);
  const end = STORE_SOURCE.indexOf('\n}', start);
  expect(end, 'applyAquarelleMedium must have a recognizable body').toBeGreaterThan(start);
  return STORE_SOURCE.slice(start, end);
}

beforeEach(() => {
  resetAquarelleRecordState();
  aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
  aquarelleSelectedMediumId.value = DEFAULT_MEDIUM_ID;
});

describe('the medium keys in the live bag', () => {
  it('carries viscosity, body and emboss in the key list and the defaults', () => {
    expect(AQUARELLE_GLOBAL_KEYS).toContain('viscosity');
    expect(AQUARELLE_GLOBAL_KEYS).toContain('body');
    expect(AQUARELLE_GLOBAL_KEYS).toContain('emboss');
    expect(DEFAULT_AQUARELLE_PARAMS.viscosity).toBe(0);
    expect(DEFAULT_AQUARELLE_PARAMS.body).toBe(0);
    expect(DEFAULT_AQUARELLE_PARAMS.emboss).toBe(0);
    expect(aquarelleParams.value.viscosity).toBe(0);
    expect(aquarelleParams.value.body).toBe(0);
    expect(aquarelleParams.value.emboss).toBe(0);
  });

  it('keeps the bag at exactly the twelve canonical keys', () => {
    expect(Object.keys(aquarelleParams.value).sort()).toEqual([
      'bleed',
      'body',
      'dry',
      'edge',
      'emboss',
      'flow',
      'granulation',
      'lift',
      'load',
      'size',
      'viscosity',
      'water',
    ]);
  });

  it('records all three keys in the per-stroke snapshot', () => {
    const fresh = snapshotAquarelleRecord();
    expect(fresh.params.viscosity).toBe(0);
    expect(fresh.params.body).toBe(0);
    expect(fresh.params.emboss).toBe(0);
    setAquarelleParam('viscosity', 40);
    setAquarelleParam('body', 60);
    setAquarelleParam('emboss', 20);
    const snapped = snapshotAquarelleRecord();
    expect(snapped.params.viscosity).toBe(40);
    expect(snapped.params.body).toBe(60);
    expect(snapped.params.emboss).toBe(20);
  });

  it('maps a pre-milestone recorded bag to the neutral defaults', () => {
    const legacy = {
      size: 12,
      water: 50,
      load: 50,
      flow: 50,
      bleed: 50,
      dry: 50,
      edge: 50,
      granulation: 50,
      lift: 22,
    };
    expect(toEngineParams(legacy).viscosity).toBe(0);
    expect(toEngineParams(legacy).body).toBe(0);
    expect(toEngineParams(legacy).emboss).toBe(0);
  });

  it('accepts a medium-key patch in the selection-edit allowlist', () => {
    recordAquarelleStroke(8101, stroke({ points: [point(0.2, 0.6)], playFrame: 71, size: 12 }));
    expect(updateAquarelleStrokesInScript([8101], { params: { viscosity: 40 } })).toBe(1);
    expect(getRecordedAquarelleStroke(8101)!.params.viscosity).toBe(40);
    expect(updateAquarelleStrokesInScript([8101], { params: { body: 55 } })).toBe(1);
    expect(getRecordedAquarelleStroke(8101)!.params.body).toBe(55);
    expect(updateAquarelleStrokesInScript([8101], { params: { emboss: 20 } })).toBe(1);
    expect(getRecordedAquarelleStroke(8101)!.params.emboss).toBe(20);
  });
});

describe('applyAquarelleMedium', () => {
  it('opens on the neutral medium', () => {
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('applies a whole record in exactly one bag write', () => {
    setAquarelleParam('size', 77);
    setAquarelleParam('lift', 33);
    const bag = countBagWrites();
    applyAquarelleMedium('pastel');
    expect(bag.count(), 'one spread assignment, not a per-key cascade').toBe(1);
    bag.stop();
    expect(aquarelleParams.value.water).toBe(0);
    expect(aquarelleParams.value.load).toBe(65);
    expect(aquarelleParams.value.flow).toBe(30);
    expect(aquarelleParams.value.bleed).toBe(0);
    expect(aquarelleParams.value.dry).toBe(80);
    expect(aquarelleParams.value.edge).toBe(70);
    expect(aquarelleParams.value.granulation).toBe(60);
    expect(aquarelleParams.value.viscosity).toBe(85);
    expect(aquarelleParams.value.body).toBe(25);
    expect(aquarelleParams.value.emboss).toBe(0);
    expect(aquarelleParams.value.size, 'a medium never resizes the brush').toBe(77);
    expect(aquarelleParams.value.lift, 'a medium never changes the eraser').toBe(33);
    expect(aquarelleSelectedMediumId.value).toBe('pastel');
  });

  it('writes the selected id once per switch', () => {
    const ids = countIdWrites();
    applyAquarelleMedium('gouache');
    expect(ids.count()).toBe(1);
    ids.stop();
    expect(aquarelleSelectedMediumId.value).toBe('gouache');
  });

  it('restores a drifted bag when the same medium is re-picked', () => {
    applyAquarelleMedium('gouache');
    setAquarelleParam('water', 90);
    expect(aquarelleParams.value.water).toBe(90);
    const bag = countBagWrites();
    applyAquarelleMedium('gouache');
    expect(bag.count()).toBe(1);
    bag.stop();
    expect(aquarelleParams.value.water).toBe(35);
    expect(aquarelleSelectedMediumId.value).toBe('gouache');
  });

  it('writes nothing when the record already is the whole bag', () => {
    // A fresh bag IS the neutral record: nothing to write.
    const neutral = countBagWrites();
    applyAquarelleMedium('watercolor');
    expect(neutral.count()).toBe(0);
    neutral.stop();

    applyAquarelleMedium('acrylic');
    expect(aquarelleParams.value.body, 'acrylic landed').toBe(90);
    const bag = countBagWrites();
    const ids = countIdWrites();
    applyAquarelleMedium('acrylic');
    expect(bag.count(), 'an identical re-pick writes nothing').toBe(0);
    expect(ids.count(), 'the id compare-then-write stays closed').toBe(0);
    bag.stop();
    ids.stop();
  });

  it('is a total no-op for an unknown id', () => {
    applyAquarelleMedium('pastel');
    expect(aquarelleParams.value.dry, 'pastel landed').toBe(80);
    const before = aquarelleParams.value;
    const bag = countBagWrites();
    const ids = countIdWrites();
    expect(() => applyAquarelleMedium('oil')).not.toThrow();
    expect(bag.count()).toBe(0);
    expect(ids.count()).toBe(0);
    bag.stop();
    ids.stop();
    expect(aquarelleParams.value).toBe(before);
    expect(aquarelleSelectedMediumId.value).toBe('pastel');
  });

  it('settles two rapid picks on the last id with one bag write each', () => {
    const bag = countBagWrites();
    applyAquarelleMedium('pastel');
    applyAquarelleMedium('acrylic');
    expect(bag.count()).toBe(2);
    bag.stop();
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleParams.value.body).toBe(90);
  });

  it('keeps the medium selected after a manual global tweak', () => {
    applyAquarelleMedium('acrylic');
    setAquarelleParam('water', 91);
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleParams.value.water).toBe(91);
    // D-03: the next re-pick restores the record, and the tweak is gone.
    applyAquarelleMedium('acrylic');
    expect(aquarelleParams.value.water).toBe(8);
  });

  it('leaves every recorded stroke byte-identical', () => {
    recordAquarelleStroke(8102, stroke({ points: [point(0.1, 0.5)], playFrame: 72, size: 12 }));
    const before = JSON.stringify(getRecordedAquarelleStroke(8102));
    applyAquarelleMedium('acrylic');
    expect(JSON.stringify(getRecordedAquarelleStroke(8102))).toBe(before);
    // The medium id is advisory: it never writes itself into a stroke.
    expect(getRecordedAquarelleStroke(8102)!.params.viscosity).toBeUndefined();
    expect(getRecordedAquarelleStroke(8102)!.params.body).toBeUndefined();
  });

  it('is one spread assignment and never a per-key or selection path', () => {
    const body = applierSource();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain('aquarelleParams.value =');
    expect(body).not.toContain('setAquarelleParam');
    expect(body).not.toContain('commitAquarelleSelectionParams');
    expect(body).not.toContain("'size'");
    expect(body).not.toContain("'lift'");
    const assignments = body.match(/aquarelleParams\.value\s*=/g) ?? [];
    expect(assignments).toHaveLength(1);
  });
});
