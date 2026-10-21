/**
 * 261017-xa0 I-03 — playground preset ids ride the tip seam.
 *
 * Laws pinned here:
 *   each of the 14 BRUSH_PRESETS ids selects cleanly (no silent clear)
 *   a successful pick forces aquarelleActiveTool to 'brush'
 *   a preset pick loads NEUTRAL_TOOL_OVERRIDES; setAquarelleMultiplier rides on top
 *   snapshotAquarelleRecord().brushId / buildAquarelleStrokePayload().brushId carry the id
 *   buildBrushForStroke(id) matches buildBrush(preset) on the vendor Brush fields
 *   legacy wc/* tip ids and the null-clear path stay unchanged
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, buildBrush, buildBrushForStroke } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES, findTip } from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleActiveTool,
  aquarelleBrushResponseMemory,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  buildAquarelleStrokePayload,
  selectAquarelleTip,
  setAquarelleMultiplier,
  setAquarelleTool,
  snapshotAquarelleRecord,
} from './aquarelleRecordState';

const PRESET_IDS = BRUSH_PRESETS.map((p) => p.id);

function resetSelection(): void {
  aquarelleSelectedTipId.value = null;
  aquarelleActiveTool.value = 'brush';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  aquarelleBrushResponseMemory.value = {};
}

describe('I-11 default brush selection', () => {
  it('opens with ROUND selected so the Settings tab is not empty', () => {
    expect(aquarelleSelectedTipId.value).toBe('round');
    expect(aquarelleToolOverrides.value).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
  });
});

describe('I-03 playground preset ids on the tip seam', () => {
  beforeEach(() => {
    resetSelection();
  });

  it('exposes exactly the 14 playground preset ids in catalog order', () => {
    expect(PRESET_IDS).toEqual([
      'round',
      'detail',
      'rigger',
      'flat',
      'hake',
      'filbert',
      'mop',
      'dry',
      'fan',
      'sponge',
      'spatter',
      'sumi',
      'dagger',
      'stipple',
    ]);
  });

  it('every BRUSH_PRESETS id selects without clearing selection', () => {
    expect(PRESET_IDS.length).toBe(14);
    for (const id of PRESET_IDS) {
      resetSelection();
      selectAquarelleTip(id);
      expect(aquarelleSelectedTipId.value, `pick ${id} must keep the id`).toBe(id);
    }
  });

  it('every preset id lands in snapshotAquarelleRecord().brushId and the payload', () => {
    for (const id of PRESET_IDS) {
      resetSelection();
      selectAquarelleTip(id);
      expect(snapshotAquarelleRecord().brushId, `snapshot brushId for ${id}`).toBe(id);
      expect(buildAquarelleStrokePayload().brushId, `payload brushId for ${id}`).toBe(id);
    }
  });

  it('buildBrushForStroke(id) matches buildBrush(preset) on the vendor Brush fields', () => {
    for (const preset of BRUSH_PRESETS) {
      const viaStroke = buildBrushForStroke(preset.id, undefined, 7);
      const viaPreset = buildBrush(preset, 7);
      expect(viaStroke.tipSize, `tipSize ${preset.id}`).toBe(viaPreset.tipSize);
      expect(viaStroke.tipMean, `tipMean ${preset.id}`).toBe(viaPreset.tipMean);
      expect(viaStroke.aspect, `aspect ${preset.id}`).toBe(viaPreset.aspect);
      expect(viaStroke.spacing, `spacing ${preset.id}`).toBe(viaPreset.spacing);
      expect(viaStroke.capacity, `capacity ${preset.id}`).toBe(viaPreset.capacity);
      expect(viaStroke.grain, `grain ${preset.id}`).toBe(viaPreset.grain);
      expect(viaStroke.wetRound, `wetRound ${preset.id}`).toBe(viaPreset.wetRound);
    }
  });

  it('a preset pick issued while water / pen / lift is active flips the tool to brush', () => {
    for (const tool of ['water', 'pen', 'lift'] as const) {
      resetSelection();
      setAquarelleTool(tool);
      expect(aquarelleActiveTool.value).toBe(tool);
      selectAquarelleTip('round');
      expect(aquarelleActiveTool.value, `pick during ${tool} must return to brush`).toBe('brush');
    }
  });

  it('a preset pick loads NEUTRAL_TOOL_OVERRIDES and setAquarelleMultiplier rides on top', () => {
    selectAquarelleTip('flat');
    expect(aquarelleToolOverrides.value).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
    setAquarelleMultiplier('tip', 1.5);
    expect(aquarelleToolOverrides.value.tip).toBe(1.5);
    expect(aquarelleToolOverrides.value.aspect).toBe(1);
    expect(aquarelleToolOverrides.value.capacity).toBe(1);
    expect(snapshotAquarelleRecord().brushId).toBe('flat');
    expect(snapshotAquarelleRecord().toolOverrides.tip).toBe(1.5);
  });

  it('legacy wc/* tip ids still resolve through findTip', () => {
    const tip = findTip('wc/round-medium');
    expect(tip, 'legacy tip must exist').toBeTruthy();
    selectAquarelleTip('wc/round-medium');
    expect(aquarelleSelectedTipId.value).toBe('wc/round-medium');
    expect(snapshotAquarelleRecord().brushId).toBe('wc/round-medium');
    // Tip packs own their multipliers (unchanged seam).
    expect(aquarelleToolOverrides.value).toEqual({
      tip: tip!.tip,
      aspect: tip!.aspect,
      rotation: tip!.rotation,
      sizeCurve: tip!.sizeCurve,
      scatter: tip!.scatter,
      capacity: tip!.capacity,
      grain: tip!.grain,
      wetRound: tip!.wetRound,
    });
  });

  it('a null pick clears selection and resets multipliers to neutral', () => {
    selectAquarelleTip('round');
    setAquarelleMultiplier('tip', 1.5);
    selectAquarelleTip(null);
    expect(aquarelleSelectedTipId.value).toBeNull();
    expect(snapshotAquarelleRecord().brushId).toBe('');
    expect(aquarelleToolOverrides.value).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
  });
});

describe('I-11 per-brush response memory', () => {
  beforeEach(() => {
    resetSelection();
  });

  it('keeps each brush response across switches', () => {
    selectAquarelleTip('flat');
    setAquarelleMultiplier('tip', 1.5);

    selectAquarelleTip('round');
    expect(aquarelleToolOverrides.value, 'a fresh brush starts neutral').toEqual({
      ...NEUTRAL_TOOL_OVERRIDES,
    });

    selectAquarelleTip('flat');
    expect(aquarelleToolOverrides.value.tip, 'flat remembers its edit').toBe(1.5);
  });

  it('keeps independent bags for different brushes', () => {
    selectAquarelleTip('flat');
    setAquarelleMultiplier('tip', 1.5);
    selectAquarelleTip('round');
    setAquarelleMultiplier('capacity', 0.7);

    selectAquarelleTip('flat');
    expect(aquarelleToolOverrides.value.tip).toBe(1.5);
    expect(aquarelleToolOverrides.value.capacity).toBe(1);

    selectAquarelleTip('round');
    expect(aquarelleToolOverrides.value.capacity).toBe(0.7);
    expect(aquarelleToolOverrides.value.tip).toBe(1);
  });

  it('restores the remembered bag after a null clear', () => {
    selectAquarelleTip('mop');
    setAquarelleMultiplier('wetRound', 1.8);
    selectAquarelleTip(null);
    expect(aquarelleToolOverrides.value).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });

    selectAquarelleTip('mop');
    expect(aquarelleToolOverrides.value.wetRound).toBe(1.8);
  });

  it('legacy tip defaults seed the memory until edited', () => {
    const tip = findTip('wc/round-small');
    expect(tip).toBeTruthy();
    selectAquarelleTip('wc/round-small');
    expect(aquarelleToolOverrides.value.tip).toBe(tip!.tip);

    selectAquarelleTip('detail');
    selectAquarelleTip('wc/round-small');
    expect(aquarelleToolOverrides.value.tip).toBe(tip!.tip);
  });

  it('a recorded stroke snapshots the remembered bag', () => {
    selectAquarelleTip('flat');
    setAquarelleMultiplier('capacity', 1.6);
    selectAquarelleTip('round');
    selectAquarelleTip('flat');
    expect(snapshotAquarelleRecord().toolOverrides.capacity).toBe(1.6);
  });
});
