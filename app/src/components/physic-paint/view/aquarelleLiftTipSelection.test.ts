/**
 * 261028-k03c D1 — the Lift (eraser) tool owns its own tip selection.
 *
 * Laws pinned here:
 *   aquarelleLiftTipId defaults to 'filbert' (the new Lift default)
 *   aquarelleSelectedTipId defaults to 'filbert' (new Brush strokes only —
 *   existing strokes keep their recorded brushId)
 *   setAquarelleLiftTipId never flips the active tool and never mutates the
 *   Brush selection, the live override bag or the response memory
 *   setAquarelleLiftTipId normalizes an unknown id to null (same findTip /
 *   BRUSH_PRESETS lookup selectAquarelleTip uses)
 *   a re-pick of the current Lift id is a compare-then-write no-op
 *   aquarelleActiveTipId resolves the tip per tool ('filbert' when the Lift
 *   id is null)
 *   aquarelleBrushForActiveTool is the ONE live/record binding law
 *   snapshotAquarelleRecord records through that law (Lift = its tip + neutral
 *   overrides; Brush = its tip + the live overrides)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleActiveTipId,
  aquarelleActiveTool,
  aquarelleBrushForActiveTool,
  aquarelleBrushResponseMemory,
  aquarelleLiftTipId,
  aquarelleParams,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  selectAquarelleTip,
  setAquarelleLiftTipId,
  setAquarelleMultiplier,
  setAquarelleTool,
  snapshotAquarelleRecord,
} from './aquarelleRecordState';

function resetSelection(): void {
  aquarelleLiftTipId.value = 'filbert';
  aquarelleSelectedTipId.value = 'filbert';
  aquarelleActiveTool.value = 'brush';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  aquarelleBrushResponseMemory.value = {};
}

describe('261028-k03c D1 Lift tip defaults', () => {
  it('opens with the Lift tip and the new-Brush tip both on FILBERT', () => {
    expect(aquarelleLiftTipId.value).toBe('filbert');
    expect(aquarelleSelectedTipId.value).toBe('filbert');
    expect(aquarelleToolOverrides.value).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
  });

  it('filbert is a real BRUSH_PRESETS id', () => {
    expect(BRUSH_PRESETS.some((preset) => preset.id === 'filbert')).toBe(true);
  });
});

describe('261028-k03c D1 setAquarelleLiftTipId', () => {
  beforeEach(() => {
    resetSelection();
  });

  it('changes only the Lift id while the tool is lift', () => {
    setAquarelleTool('lift');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleLiftTipId('flat');
    expect(aquarelleLiftTipId.value).toBe('flat');
    expect(aquarelleActiveTool.value, 'a Lift pick never flips the tool').toBe('lift');
    expect(aquarelleSelectedTipId.value, 'the Brush selection is untouched').toBe('round');
    expect(aquarelleToolOverrides.value, 'the Brush override bag is untouched').toEqual({
      ...NEUTRAL_TOOL_OVERRIDES,
    });
    expect(aquarelleBrushResponseMemory.value, 'no response memory write').toEqual({});
  });

  it('changes only the Lift id while the tool is brush', () => {
    setAquarelleTool('brush');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleLiftTipId('hake');
    expect(aquarelleLiftTipId.value).toBe('hake');
    expect(aquarelleActiveTool.value, 'a Lift pick never flips the tool').toBe('brush');
    expect(aquarelleSelectedTipId.value, 'the Brush selection is untouched').toBe('round');
  });

  it('never touches a dirty Brush override bag', () => {
    setAquarelleTool('lift');
    setAquarelleSelectedTipIdForTest('flat');
    setAquarelleMultiplier('tip', 1.5);
    const before = { ...aquarelleToolOverrides.value };
    setAquarelleLiftTipId('rigger');
    expect(aquarelleToolOverrides.value).toEqual(before);
    expect(aquarelleBrushResponseMemory.value, 'no response memory write').toEqual({});
  });

  it('normalizes an unknown id to null', () => {
    setAquarelleLiftTipId('not-a-real-tip');
    expect(aquarelleLiftTipId.value).toBeNull();
    // A legacy wc/* tip id is a valid tip, not unknown.
    setAquarelleLiftTipId('wc/round-medium');
    expect(aquarelleLiftTipId.value).toBe('wc/round-medium');
  });

  it('a re-pick of the current Lift id is a compare-then-write no-op', () => {
    let writes = 0;
    const unsubscribe = aquarelleLiftTipId.subscribe(() => {
      writes += 1;
    });
    // subscribe() runs its effect once on registration, so the baseline is the
    // count AFTER subscribing — only a real value change may move it.
    const baseline = writes;
    try {
      const paramsBefore = aquarelleParams.value;
      setAquarelleLiftTipId('filbert');
      setAquarelleLiftTipId(aquarelleLiftTipId.value);
      expect(writes, 'no signal write on an unchanged pick').toBe(baseline);
      expect(aquarelleParams.value, 'the param bag keeps its identity').toBe(paramsBefore);
      setAquarelleLiftTipId('flat');
      expect(writes - baseline, 'a real change writes once').toBe(1);
    } finally {
      unsubscribe();
    }
  });

  it('selectAquarelleTip stays the Brush-only seam (it still flips the tool)', () => {
    setAquarelleTool('lift');
    selectAquarelleTip('round');
    expect(aquarelleActiveTool.value, 'the Brush catalog pick still returns to brush').toBe(
      'brush',
    );
    expect(aquarelleLiftTipId.value, 'the Lift selection is untouched by a Brush pick').toBe(
      'filbert',
    );
  });
});

describe('261028-k03c D1 aquarelleActiveTipId', () => {
  beforeEach(() => {
    resetSelection();
  });

  it('returns the Lift id on lift and the Brush id on every other tool', () => {
    setAquarelleLiftTipId('flat');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleTool('lift');
    expect(aquarelleActiveTipId()).toBe('flat');
    for (const tool of ['brush', 'water', 'pen'] as const) {
      setAquarelleTool(tool);
      expect(aquarelleActiveTipId(), `active tip on ${tool}`).toBe('round');
    }
  });

  it('falls back to filbert when the Lift id is null', () => {
    setAquarelleLiftTipId(null);
    setAquarelleTool('lift');
    expect(aquarelleLiftTipId.value).toBeNull();
    expect(aquarelleActiveTipId()).toBe('filbert');
  });
});

describe('261028-k03c D1 aquarelleBrushForActiveTool', () => {
  beforeEach(() => {
    resetSelection();
  });

  it('returns the Lift tip + neutral overrides on lift', () => {
    setAquarelleTool('lift');
    setAquarelleLiftTipId('flat');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleMultiplier('aspect', 1.7);
    const selection = aquarelleBrushForActiveTool();
    expect(selection.brushId).toBe('flat');
    expect(selection.toolOverrides).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
    expect(selection.toolOverrides, 'a copy, never the live bag').not.toBe(
      aquarelleToolOverrides.value,
    );
  });

  it('falls back to filbert for a null Lift id', () => {
    setAquarelleTool('lift');
    setAquarelleLiftTipId(null);
    expect(aquarelleBrushForActiveTool().brushId).toBe('filbert');
  });

  it('returns the Brush tip + the live overrides on every other tool', () => {
    setAquarelleLiftTipId('flat');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleMultiplier('capacity', 1.6);
    for (const tool of ['brush', 'water', 'pen'] as const) {
      setAquarelleTool(tool);
      const selection = aquarelleBrushForActiveTool();
      expect(selection.brushId, `brushId on ${tool}`).toBe('round');
      expect(selection.toolOverrides.capacity, `live overrides on ${tool}`).toBe(1.6);
    }
  });

  it('an empty Brush selection records an empty brushId (unchanged seam)', () => {
    setAquarelleTool('brush');
    aquarelleSelectedTipId.value = null;
    expect(aquarelleBrushForActiveTool().brushId).toBe('');
  });
});

describe('261028-k03c D1 snapshotAquarelleRecord through the one law', () => {
  beforeEach(() => {
    resetSelection();
  });

  it('records the Lift tip as brushId with neutral overrides on lift', () => {
    setAquarelleTool('lift');
    setAquarelleLiftTipId('dagger');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleMultiplier('tip', 1.9);
    const snapshot = snapshotAquarelleRecord();
    expect(snapshot.tool).toBe('lift');
    expect(snapshot.brushId).toBe('dagger');
    expect(snapshot.toolOverrides).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
  });

  it('records the Brush tip with the live overrides on brush', () => {
    setAquarelleTool('brush');
    setAquarelleLiftTipId('dagger');
    setAquarelleSelectedTipIdForTest('round');
    setAquarelleMultiplier('tip', 1.9);
    const snapshot = snapshotAquarelleRecord();
    expect(snapshot.tool).toBe('brush');
    expect(snapshot.brushId).toBe('round');
    expect(snapshot.toolOverrides.tip).toBe(1.9);
  });

  it('records the filbert fallback for a null Lift id', () => {
    setAquarelleTool('lift');
    setAquarelleLiftTipId(null);
    expect(snapshotAquarelleRecord().brushId).toBe('filbert');
  });
});

/**
 * The Brush selection is written directly here on purpose: the Lift laws under
 * test must never be satisfied by a Brush-side call, so this helper bypasses
 * selectAquarelleTip (which would also flip the tool).
 */
function setAquarelleSelectedTipIdForTest(tipId: string | null): void {
  aquarelleSelectedTipId.value = tipId;
}
