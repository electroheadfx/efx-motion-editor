// ============================================================
//  61-12 Task 3 (D-13) — the ribbon preset's wet-global pick law.
//
//  Picking `simple-ribbon` is a RENDER-MODE pick: it zeroes the
//  seven wet globals (one bag write, one render) so a plain ribbon
//  genuinely deposits with no wet term, and it remembers the
//  pre-ribbon values. Any later non-ribbon pick restores them.
//  The memory is session state — it never reaches a recorded
//  stroke, and a re-pick of the ribbon re-establishes the zeros.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  AQUARELLE_WET_KEYS,
  DEFAULT_AQUARELLE_PARAMS,
  aquarelleParams,
  aquarelleSelectedTipId,
  aquarelleSimpleRibbonWetMemory,
  resetAquarelleRecordState,
  selectAquarelleTip,
  setAquarelleWetGlobals,
  snapshotAquarelleRecord,
  type AquarelleWetKey,
} from './aquarelleRecordState';

/** The shipped default for every wet key, in canonical order. */
const DEFAULT_WET: Readonly<Record<AquarelleWetKey, number>> = Object.freeze({
  load: DEFAULT_AQUARELLE_PARAMS.load,
  water: DEFAULT_AQUARELLE_PARAMS.water,
  flow: DEFAULT_AQUARELLE_PARAMS.flow,
  bleed: DEFAULT_AQUARELLE_PARAMS.bleed,
  edge: DEFAULT_AQUARELLE_PARAMS.edge,
  granulation: DEFAULT_AQUARELLE_PARAMS.granulation,
  dry: DEFAULT_AQUARELLE_PARAMS.dry,
});

/**
 * Count REAL bag writes (preact signals notify its subscriber once on
 * subscribe, so the first callback is not a write).
 */
function bagWrites(run: () => void): number {
  let writes = 0;
  let primed = false;
  const unsubscribe = aquarelleParams.subscribe(() => {
    if (!primed) {
      primed = true;
      return;
    }
    writes += 1;
  });
  try {
    run();
  } finally {
    unsubscribe();
  }
  return writes;
}

function expectAllWet(expected: number): void {
  for (const key of AQUARELLE_WET_KEYS) {
    expect(aquarelleParams.value[key], `${key} should read ${expected}`).toBe(expected);
  }
}

describe('61-12 simple-ribbon wet-global pick law', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
    aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
    aquarelleSimpleRibbonWetMemory.value = null;
    aquarelleSelectedTipId.value = 'filbert';
  });

  it('zeroes all seven wet keys in exactly ONE bag write when the ribbon is picked', () => {
    expect(aquarelleParams.value.water).toBe(DEFAULT_AQUARELLE_PARAMS.water);

    const writes = bagWrites(() => selectAquarelleTip('simple-ribbon'));

    expect(writes).toBe(1);
    expect(aquarelleSelectedTipId.value).toBe('simple-ribbon');
    expectAllWet(0);
    // Size and Lift are NOT wet terms — the pick never touches them.
    expect(aquarelleParams.value.size).toBe(DEFAULT_AQUARELLE_PARAMS.size);
    expect(aquarelleParams.value.lift).toBe(DEFAULT_AQUARELLE_PARAMS.lift);
    // The pre-ribbon values are remembered, not discarded.
    expect(aquarelleSimpleRibbonWetMemory.value).toEqual(DEFAULT_WET);
  });

  it('records genuine zeros: the snapshot reports 0 for every wet key', () => {
    selectAquarelleTip('simple-ribbon');

    const snap = snapshotAquarelleRecord();

    for (const key of AQUARELLE_WET_KEYS) {
      expect(snap.params[key], `recorded ${key}`).toBe(0);
    }
    expect(snap.brushId).toBe('simple-ribbon');
    // The memory holds the ORIGINAL values — it is never the recorded bag.
    expect(aquarelleSimpleRibbonWetMemory.value).toEqual(DEFAULT_WET);
  });

  it('restores the seven pre-ribbon values on the next non-ribbon pick', () => {
    // No prior pick: the SHIPPED defaults are what gets remembered.
    selectAquarelleTip('simple-ribbon');
    expect(aquarelleSimpleRibbonWetMemory.value).toEqual(DEFAULT_WET);

    const writes = bagWrites(() => selectAquarelleTip('filbert'));

    expect(writes).toBe(1);
    expectAllWet(DEFAULT_AQUARELLE_PARAMS.water);
    expect(aquarelleSimpleRibbonWetMemory.value).toBeNull();
    expect(aquarelleSelectedTipId.value).toBe('filbert');
  });

  it('re-picking the ribbon re-establishes the zeros instead of returning early', () => {
    selectAquarelleTip('simple-ribbon');
    // A raised wet term while the ribbon is active.
    expect(setAquarelleWetGlobals({ water: 70 })).toBe(true);
    expect(aquarelleParams.value.water).toBe(70);

    const writes = bagWrites(() => selectAquarelleTip('simple-ribbon'));

    expect(writes).toBe(1);
    expectAllWet(0);
    // The memory is NOT re-snapshotted (0/70 must never overwrite the origin).
    expect(aquarelleSimpleRibbonWetMemory.value).toEqual(DEFAULT_WET);
  });

  it('restores the memory on a null pick and never writes it into a stroke', () => {
    selectAquarelleTip('simple-ribbon');
    // The stroke created NOW carries the zeros, never the remembered bag.
    expect(snapshotAquarelleRecord().params.water).toBe(0);

    const writes = bagWrites(() => selectAquarelleTip(null));

    expect(writes).toBe(1);
    expectAllWet(DEFAULT_AQUARELLE_PARAMS.water);
    expect(aquarelleSimpleRibbonWetMemory.value).toBeNull();
    expect(aquarelleSelectedTipId.value).toBeNull();
  });

  it('setAquarelleWetGlobals writes the bag at most once and refuses a no-op', () => {
    const writes = bagWrites(() => {
      expect(setAquarelleWetGlobals({ water: 0, load: 0 })).toBe(true);
    });
    expect(writes).toBe(1);
    expect(aquarelleParams.value.water).toBe(0);
    expect(aquarelleParams.value.load).toBe(0);
    // Untouched wet keys keep their values.
    expect(aquarelleParams.value.flow).toBe(DEFAULT_AQUARELLE_PARAMS.flow);

    // An identical patch is a refused no-op: no write, no render.
    expect(bagWrites(() => {
      expect(setAquarelleWetGlobals({ water: 0, load: 0 })).toBe(false);
    })).toBe(0);
    // A non-finite value is ignored, never written into the document.
    expect(setAquarelleWetGlobals({ water: Number.NaN })).toBe(false);
    expect(aquarelleParams.value.water).toBe(0);
  });
});
