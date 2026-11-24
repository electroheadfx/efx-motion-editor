// ============================================================
//  quick 261111-ucf — the ONE paint-control seam.
//
//  A brush pick and every paint-control release edit the SELECTED
//  strokes of their own family through the registered appearance
//  port, while the live brush/sliders keep their shipped behaviour:
//   - the pick selects the live tip FIRST, so the forwarded
//     multiplier bag is the bag the live brush now carries;
//   - brush picks, multiplier releases and the Reset batch use the
//     'paint' filter, so a lift (eraser) stroke is never addressed;
//   - quick 261121-mtu: the Lift row's release (the Eraser context's
//     only row) uses the 'lift' filter — it edits lift strokes and
//     never a paint stroke;
//   - no selection / Select mode off is a no-attempt no-op.
//
//  Node env, real signals, real record state. Id band 10601+.
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  aquarelleBrushResponseMemory,
  aquarelleParams,
  aquarelleSelectedMediumId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  applyAquarelleMedium,
  recordAquarelleStroke,
  selectAquarelleTip,
} from './aquarelleRecordState';
import {
  commitAquarelleSelectionAppearance,
  setAquarelleSelectionEditPort,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import {
  clearScriptStrokeSelection,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';
import {
  commitAquarelleSelectionMultiplier,
  commitAquarelleSelectionParam,
  commitAquarelleSelectionParams,
  pickAquarelleBrush,
} from './aquarellePaintControls';
import type { ScriptStrokeAppearancePatch } from './strokeSettingsModel';

interface PortCall {
  ids: readonly number[];
  patch: ScriptStrokeAppearancePatch;
}

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(options: {
  points: readonly AquarellePoint[];
  playFrame?: number;
  tool?: 'brush' | 'lift';
  brushId?: string;
}): AquarelleStroke {
  return {
    tool: options.tool ?? 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: options.brushId ?? 'round',
    points: options.points,
    timestamp: 0,
    playFrame: options.playFrame ?? 801,
  };
}

/** Register a fake port that records every (ids, patch) call. */
function installPort(): { calls: PortCall[]; promise: Promise<boolean> } {
  const calls: PortCall[] = [];
  const promise = Promise.resolve(true);
  setAquarelleSelectionEditPort({
    applyAppearance: (ids, patch) => {
      calls.push({ ids, patch });
      return promise;
    },
  });
  return { calls, promise };
}

beforeEach(() => {
  aquarelleBrushResponseMemory.value = {};
});

afterEach(() => {
  // The port is a plain module variable: a leaked fake would forward the
  // NEXT case's commit. Clear it before the mode reset.
  setAquarelleSelectionEditPort(null);
  setAquarelleSelectMode(false);
  clearScriptStrokeSelection();
  selectAquarelleTip(null);
});

describe('pickAquarelleBrush — live pick first, selection commit second', () => {
  it('commits the picked id and the POST-pick bag to the selected paint strokes', async () => {
    recordAquarelleStroke(10601, stroke({ points: [point(0.2, 0.5)], brushId: 'round' }));
    selectAquarelleTip('round');
    const prePickBag = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 1.7 };
    aquarelleToolOverrides.value = prePickBag;
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10601]);
    const { calls, promise } = installPort();

    const result = pickAquarelleBrush('bristle-round');
    expect(result).toBe(promise);
    await result;

    expect(aquarelleSelectedTipId.value, 'the live tip changed first').toBe('bristle-round');
    const postPickBag = aquarelleToolOverrides.peek();
    expect(postPickBag, 'the pick loaded a different bag').not.toEqual(prePickBag);
    expect(calls, 'exactly one port call').toHaveLength(1);
    expect(calls[0]!.ids).toEqual([10601]);
    expect(calls[0]!.patch.brushId).toBe('bristle-round');
    // The forwarded bag is the bag the live brush carries AFTER the pick.
    expect(calls[0]!.patch.toolOverrides).toEqual(postPickBag);
    expect(calls[0]!.patch.toolOverrides).not.toEqual(prePickBag);
  });

  it('captures the bag as a snapshot — a later bag write cannot rewrite the patch', async () => {
    recordAquarelleStroke(10606, stroke({ points: [point(0.2, 0.5)] }));
    selectAquarelleTip('round');
    aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES, grain: 1.6 };
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10606]);
    const { calls } = installPort();

    await pickAquarelleBrush('bristle-round');
    const committedBag = calls[0]!.patch.toolOverrides!;
    const captured = { ...committedBag };
    aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 };

    expect(calls[0]!.patch.toolOverrides).toEqual(captured);
    expect(calls[0]!.patch.toolOverrides).not.toBe(aquarelleToolOverrides.peek());
  });

  it('returns the port promise, and null after the live tip update when no port exists', async () => {
    recordAquarelleStroke(10607, stroke({ points: [point(0.3, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10607]);
    const { promise } = installPort();

    const result = pickAquarelleBrush('bristle-round');
    expect(result).toBe(promise);
    await result;

    setAquarelleSelectionEditPort(null);
    expect(pickAquarelleBrush('round')).toBeNull();
    expect(aquarelleSelectedTipId.value).toBe('round');
  });

  it('forwards only the paint ids of a mixed selection', async () => {
    recordAquarelleStroke(10602, stroke({ points: [point(0.1, 0.5)] }));
    recordAquarelleStroke(10603, stroke({ points: [point(0.2, 0.5)], tool: 'lift' }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10602, 10603]);
    const { calls } = installPort();

    await pickAquarelleBrush('bristle-round');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.ids).toEqual([10602]);
  });

  it('a lift-only selection is a no-attempt no-op while the live brush still changes', async () => {
    recordAquarelleStroke(10608, stroke({ points: [point(0.4, 0.5)], tool: 'lift' }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10608]);
    const { calls } = installPort();

    expect(pickAquarelleBrush('round')).toBeNull();

    expect(calls).toHaveLength(0);
    expect(aquarelleSelectedTipId.value).toBe('round');
  });

  it('is a no-attempt no-op with Select mode off, and with an empty selection', async () => {
    recordAquarelleStroke(10609, stroke({ points: [point(0.5, 0.5)] }));
    // Select mode off, non-empty selection.
    setAquarelleSelectMode(false);
    setScriptStrokeSelection([10609]);
    const { calls } = installPort();

    expect(pickAquarelleBrush('bristle-round')).toBeNull();
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');

    // Select mode on, empty selection.
    setAquarelleSelectMode(true);
    clearScriptStrokeSelection();
    expect(pickAquarelleBrush('round')).toBeNull();
    expect(aquarelleSelectedTipId.value).toBe('round');
    expect(calls).toHaveLength(0);
  });
});

describe('commitAquarelleSelectionParam(s) — event-time params patches', () => {
  it('commits one params patch and leaves the live bag to the caller', async () => {
    recordAquarelleStroke(10604, stroke({ points: [point(0.6, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10604]);
    const { calls } = installPort();
    aquarelleParams.value = { ...aquarelleParams.value, water: 42 };

    const result = commitAquarelleSelectionParam('water', 55);
    expect(result).not.toBeNull();
    await result;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.patch).toEqual({ params: { water: 55 } });
    // The caller owns the live write — this seam never touches the live bag.
    expect(aquarelleParams.value.water).toBe(42);
  });

  // quick 261121-mtu: the Lift row renders only in the Eraser context, so its
  // release must edit LIFT strokes — the filter is chosen from the key.
  it('edits lift strokes for a lift-key release and paint strokes for a paint key', async () => {
    recordAquarelleStroke(10613, stroke({ points: [point(0.1, 0.5)] }));
    recordAquarelleStroke(10614, stroke({ points: [point(0.2, 0.5)], tool: 'lift' }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10613, 10614]);
    const { calls } = installPort();

    await commitAquarelleSelectionParam('lift', 40);
    expect(calls, 'the lift release addressed exactly one stroke').toHaveLength(1);
    expect(calls[0]!.ids, 'the lift stroke, never the paint stroke').toEqual([10614]);
    expect(calls[0]!.patch).toEqual({ params: { lift: 40 } });

    await commitAquarelleSelectionParam('water', 55);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.ids, 'the paint key keeps the paint filter').toEqual([10613]);
  });

  // quick 261121-mtu (decision B): a same-group acrylic pick writes no record,
  // so the acrylic Refill 0 survives the pick instead of reverting to 60.
  // quick 261124-iq9: the acrylic group has exactly one member, so the
  // pre-pick tip is written directly — the seam compares the SELECTED MEDIUM
  // with the incoming group, never the tip.
  it('a same-group acrylic brush pick leaves the acrylic Refill at 0', () => {
    applyAquarelleMedium('acrylic');
    aquarelleSelectedTipId.value = 'round';
    expect(aquarelleParams.value.refill, 'acrylic landed with Refill 0').toBe(0);
    const bag = aquarelleParams.value;

    pickAquarelleBrush('bristle-round');

    expect(aquarelleSelectedMediumId.value, 'the group did not change').toBe('acrylic');
    expect(aquarelleParams.value, 'the pick wrote no record').toBe(bag);
    expect(aquarelleParams.value.refill, 'Refill stays 0').toBe(0);
  });

  it('sends the Reset batch as ONE call, and an empty batch is no attempt', async () => {
    recordAquarelleStroke(10610, stroke({ points: [point(0.7, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10610]);
    const { calls } = installPort();

    expect(commitAquarelleSelectionParams({})).toBeNull();
    expect(calls).toHaveLength(0);

    const reset = {
      water: 60,
      load: 50,
      flow: 45,
      bleed: 50,
      edge: 50,
      granulation: 45,
      dry: 40,
    };
    await commitAquarelleSelectionParams(reset);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.patch).toEqual({ params: reset });
  });
});

describe('commitAquarelleSelectionMultiplier — one clamped field per release', () => {
  it('clamps into the band and leaves the live bag untouched', async () => {
    recordAquarelleStroke(10605, stroke({ points: [point(0.8, 0.5)] }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10605]);
    const { calls } = installPort();
    const liveAspect = aquarelleToolOverrides.value.aspect;

    await commitAquarelleSelectionMultiplier('aspect', 2.4);
    await commitAquarelleSelectionMultiplier('aspect', 0.4);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.patch).toEqual({ toolOverrides: { aspect: MULTIPLIER_MAX } });
    expect(calls[1]!.patch).toEqual({ toolOverrides: { aspect: MULTIPLIER_MIN } });
    expect(aquarelleToolOverrides.value.aspect).toBe(liveAspect);
  });
});

describe('the direct appearance door keeps the t74 contract', () => {
  it('defaults to the whole selection — paint AND lift ids, in selection order', async () => {
    recordAquarelleStroke(10611, stroke({ points: [point(0.1, 0.5)] }));
    recordAquarelleStroke(10612, stroke({ points: [point(0.2, 0.5)], tool: 'lift' }));
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10611, 10612]);
    const { calls } = installPort();

    const patch: ScriptStrokeAppearancePatch = { brushId: 'bristle-round' };
    await commitAquarelleSelectionAppearance(patch);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.ids).toEqual([10611, 10612]);
    expect(calls[0]!.patch).toBe(patch);
  });
});
