// ============================================================
//  aquarelleFootprint — the ONE numeric footprint law shared
//  by the engine and the cursor (261028-k03c D6).
//
//  Every expectation below is computed from the engine's own
//  `toEngineParams` / `buildBrushForStroke`, never from hand-
//  copied constants, so the cursor cannot drift from what the
//  engine actually stamps.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  buildBrushForStroke,
  NEUTRAL_TOOL_OVERRIDES,
  toEngineParams,
  type AquarelleTool,
  type AquarelleToolOverrides,
} from '@efxlab/efx-watercolor';
import {
  aquarelleFootprintFor,
  cursorPreviewPressure,
  footprintCssSize,
  type AquarelleFootprint,
  type AquarelleFootprintInput,
} from './aquarelleFootprint';

const DEG = Math.PI / 180;

function sizeMult(size: number): number {
  return Math.pow(3, ((toEngineParams({ size }).size ?? 0.5) - 0.5) * 2);
}

function brushOf(id: string, overrides: AquarelleToolOverrides = NEUTRAL_TOOL_OVERRIDES) {
  return buildBrushForStroke(id, overrides);
}

function fp(
  tool: AquarelleTool,
  tipId: string | null,
  extra: Partial<AquarelleFootprintInput> = {},
): AquarelleFootprint {
  return aquarelleFootprintFor({
    tool,
    tipId,
    toolOverrides: NEUTRAL_TOOL_OVERRIDES,
    size: 40,
    pressure: 0.4,
    moveAngle: 0,
    tiltX: 0,
    tiltY: 0,
    ...extra,
  });
}

describe('radius law (footprint table)', () => {
  it('brush matches (size0 + Δ·pr^pressureSize)·sizeMult·0.8 at 0.4 and 1.0, sizes 12/40/80', () => {
    for (const size of [12, 40, 80]) {
      for (const pressure of [0.4, 1]) {
        const b = brushOf('filbert');
        const expected =
          (b.size[0] + (b.size[1] - b.size[0]) * Math.pow(pressure, b.pressureSize)) *
          sizeMult(size) *
          0.8;
        const actual = fp('brush', 'filbert', { size, pressure }).radiusDoc;
        expect(actual, `size ${size} pressure ${pressure}`).toBeCloseTo(expected, 10);
      }
    }
  });

  it('water is exactly brush × 1.3 at speed 0', () => {
    for (const pressure of [0.4, 1]) {
      const brush = fp('brush', 'mop', { pressure }).radiusDoc;
      expect(fp('water', 'mop', { pressure }).radiusDoc).toBeCloseTo(brush * 1.3, 10);
    }
  });

  it('pen is (0.0016 + 0.0042·pr)·1.12·sizeMult', () => {
    for (const size of [12, 40, 80]) {
      for (const pressure of [0.4, 1]) {
        const expected = (0.0016 + 0.0042 * pressure) * 1.12 * sizeMult(size);
        expect(fp('pen', null, { size, pressure }).radiusDoc).toBeCloseTo(expected, 10);
      }
    }
  });

  it('lift is (0.012 + 0.03·pr)·sizeMult', () => {
    for (const size of [12, 40, 80]) {
      for (const pressure of [0.4, 1]) {
        const expected = (0.012 + 0.03 * pressure) * sizeMult(size);
        expect(fp('lift', 'filbert', { size, pressure }).radiusDoc).toBeCloseTo(expected, 10);
      }
    }
  });
});

describe('shape law', () => {
  it('aspect is 1 for pen and b.aspect for brush/water/lift', () => {
    for (const id of ['filbert', 'flat', 'round']) {
      const b = brushOf(id);
      for (const tool of ['brush', 'water', 'lift'] as const) {
        expect(fp(tool, id).aspect, `${tool}/${id}`).toBeCloseTo(b.aspect, 12);
      }
    }
    expect(fp('pen', 'flat').aspect).toBe(1);
  });

  it('reads the tip through the same buildBrushForStroke binding the engine uses', () => {
    const overrides: AquarelleToolOverrides = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 1.5 };
    const b = brushOf('filbert', overrides);
    const actual = aquarelleFootprintFor({
      tool: 'brush',
      tipId: 'filbert',
      toolOverrides: overrides,
      size: 40,
      pressure: 0.4,
      moveAngle: 0,
      tiltX: 0,
      tiltY: 0,
    });
    expect(actual.aspect).toBeCloseTo(b.aspect, 12);
  });

  it('rounded is true exactly when aspect < 0.6 for brush/water/lift, never for pen', () => {
    expect(brushOf('flat').aspect).toBeLessThan(0.6);
    expect(brushOf('round').aspect).toBeGreaterThanOrEqual(0.6);
    for (const tool of ['brush', 'water', 'lift'] as const) {
      expect(fp(tool, 'flat').rounded, tool).toBe(true);
      expect(fp(tool, 'round').rounded, tool).toBe(false);
    }
    expect(fp('pen', 'flat').rounded).toBe(false);
  });
});

describe('rotation law (Engine.brushAngle)', () => {
  it('fixed rotation without tilt is the preset angle', () => {
    const b = brushOf('flat');
    expect(fp('brush', 'flat').angle).toBeCloseTo(b.angle * DEG, 12);
  });

  it('fixed rotation takes the live tilt azimuth above hypot 12 and the preset angle at exactly 12', () => {
    const b = brushOf('flat');
    expect(fp('brush', 'flat', { tiltX: 30, tiltY: -20 }).angle).toBeCloseTo(
      Math.atan2(20, 30),
      12,
    );
    // A vertical pen tells us nothing — the threshold is strict.
    expect(fp('brush', 'flat', { tiltX: 12, tiltY: 0 }).angle).toBeCloseTo(b.angle * DEG, 12);
  });

  it('follow adds the movement direction to the preset angle', () => {
    const b = brushOf('hake');
    expect(b.rotation).toBe('follow');
    expect(fp('brush', 'hake', { moveAngle: 0.7 }).angle).toBeCloseTo(0.7 + b.angle * DEG, 12);
  });

  it('random holds the last non-random angle', () => {
    const fixed = brushOf('flat');
    fp('brush', 'flat');
    const random = brushOf('sponge');
    expect(random.rotation).toBe('random');
    expect(fp('brush', 'sponge').angle).toBeCloseTo(fixed.angle * DEG, 12);
    // A later fixed sample updates the carried angle; random still returns it.
    fp('brush', 'flat', { tiltX: 40, tiltY: -40 });
    expect(fp('brush', 'sponge').angle).toBeCloseTo(Math.atan2(40, 40), 12);
  });

  it('pen has no rotation', () => {
    expect(fp('pen', 'flat', { tiltX: 40, tiltY: -40 }).angle).toBe(0);
  });
});

describe('cursorPreviewPressure', () => {
  it('is the live pen pressure while a pen is pressed', () => {
    expect(cursorPreviewPressure('pen', 1, 0.73)).toBe(0.73);
  });

  it('falls back to the 0.4 hover pressure off-press or without pen pressure', () => {
    expect(cursorPreviewPressure('pen', 0, 0.73)).toBe(0.4);
    expect(cursorPreviewPressure('mouse', 1, 0.5)).toBe(0.4);
    expect(cursorPreviewPressure('pen', 1, 0)).toBe(0.4);
    expect(cursorPreviewPressure('pen', 1, Number.NaN)).toBe(0.4);
  });
});

describe('footprintCssSize', () => {
  it('scales the document radius by the displayed layer height', () => {
    const footprint: AquarelleFootprint = { radiusDoc: 0.25, aspect: 0.5, angle: 0, rounded: true };
    expect(footprintCssSize(footprint, 400)).toEqual({ width: 200, height: 100 });
  });

  it('never produces a negative size before the layer has a height', () => {
    const footprint: AquarelleFootprint = { radiusDoc: 0.25, aspect: 0.5, angle: 0, rounded: false };
    expect(footprintCssSize(footprint, 0)).toEqual({ width: 0, height: 0 });
  });
});
