/**
 * 261017-xa0 I-03 — playground preset ids ride the tip seam.
 *
 * Laws pinned here:
 *   each of the 15 BRUSH_PRESETS ids selects cleanly (no silent clear)
 *   a successful pick forces aquarelleActiveTool to 'brush'
 *   a preset pick loads NEUTRAL_TOOL_OVERRIDES; setAquarelleMultiplier rides on top
 *   snapshotAquarelleRecord().brushId / buildAquarelleStrokePayload().brushId carry the id
 *   buildBrushForStroke(id) matches buildBrush(preset) on the vendor Brush fields
 *   261027-gh9: 'chalk' is a dry media — no water, no wet bloom, high grain —
 *   whose deterministic tip replays through buildBrushForStroke
 *   legacy wc/* tip ids and the null-clear path stay unchanged
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, buildBrush, buildBrushForStroke, TIP_SIZE } from '@efxlab/efx-watercolor';
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

  it('exposes exactly the 15 playground preset ids in catalog order', () => {
    expect(PRESET_IDS).toEqual([
      'chalk',
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
    expect(PRESET_IDS.length).toBe(15);
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

describe('chalk dry-media preset contract (261027-gh9)', () => {
  const chalk = BRUSH_PRESETS.find((preset) => preset.id === 'chalk');

  it('adds exactly one chalk entry and keeps every id unique', () => {
    expect(BRUSH_PRESETS.filter((preset) => preset.id === 'chalk').length).toBe(1);
    const ids = BRUSH_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is a dry media: no water, no wet bloom, moderate paper tooth', () => {
    expect(chalk, 'chalk preset must exist').toBeTruthy();
    expect(chalk!.water).toBe(0);
    expect(chalk!.wetRound).toBe(0);
    // 261027-gh9c: the paper tooth must modulate the deposit, not dominate
    // it — a high grain gate produced paper-sized blobs instead of chalk.
    expect(chalk!.grain).toBeGreaterThan(0.2);
    expect(chalk!.grain).toBeLessThan(0.6);
    expect(chalk!.flow).toBeGreaterThan(0);
    expect(chalk!.flow).toBeLessThan(1);
    expect(chalk!.capacity).toBeGreaterThan(0);
    expect(chalk!.capacity).toBeLessThan(1);
  });

  it('builds a textured, non-empty tip with finite Brush fields', () => {
    const brush = buildBrush(chalk!);
    expect(brush.tipSize).toBe(TIP_SIZE);
    expect(brush.tipData.length).toBe(TIP_SIZE * TIP_SIZE);
    expect(brush.tipMean).toBeGreaterThan(0.01);
    expect(brush.tipMean).toBeLessThanOrEqual(1);
    const numericFields = [
      'tipMean',
      'aspect',
      'angle',
      'angleJitter',
      'pressureSize',
      'speedThin',
      'spacing',
      'scatter',
      'dabs',
      'sizeJitter',
      'water',
      'load',
      'flow',
      'capacity',
      'grain',
      'wetRound',
    ] as const;
    for (const field of numericFields) {
      expect(Number.isFinite(brush[field]), `finite ${field}`).toBe(true);
    }
    // Texture, not an empty or solid block: both zero and painted cells.
    expect(brush.tipData.some((value) => value === 0), 'tip has zero cells').toBe(true);
    expect(brush.tipData.some((value) => value > 0), 'tip has painted cells').toBe(true);
  });

  it('replays through buildBrushForStroke deterministically', () => {
    const viaStroke = buildBrushForStroke('chalk', undefined, 7);
    const viaPreset = buildBrush(chalk!, 7);
    expect(viaStroke.tipSize).toBe(viaPreset.tipSize);
    expect(viaStroke.tipMean).toBe(viaPreset.tipMean);
    expect(viaStroke.aspect).toBe(viaPreset.aspect);
    expect(viaStroke.spacing).toBe(viaPreset.spacing);
    expect(viaStroke.capacity).toBe(viaPreset.capacity);
    expect(viaStroke.grain).toBe(viaPreset.grain);
    expect(viaStroke.wetRound).toBe(viaPreset.wetRound);
    expect(buildBrushForStroke('chalk', undefined, 7).tipMean).toBe(viaStroke.tipMean);
  });
});
