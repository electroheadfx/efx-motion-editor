// ============================================================
//  aquarelleFootprint — the ONE numeric footprint law shared
//  by the engine and the cursor (261028-k03c D6).
//
//  Every expectation below is computed from the engine's own
//  `toEngineParams` / `buildBrushForStroke`, never from hand-
//  copied constants, so the cursor cannot drift from what the
//  engine actually stamps.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBrushForStroke,
  NEUTRAL_TOOL_OVERRIDES,
  registerMask,
  resetMaskRegistry,
  TIP_MASK_BYTES,
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
import { canonicalFromDiameter } from './aquarelleBrushSize';
import {
  aquarelleActiveCanonicalSize,
  aquarelleLiftSize,
  setAquarelleLiftSize,
  setAquarelleParam,
  setAquarelleTool,
  aquarelleParams,
} from '../view/aquarelleRecordState';

// 63-06 / G-2: count real builds through a delegating wrapper. The footprint
// cache is module state with no accessor, so the build count is the observable
// that proves a mask replacement (or a registry reset) invalidated it.
const brushBuildState = vi.hoisted(() => ({ count: 0 }));

vi.mock('@efxlab/efx-watercolor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@efxlab/efx-watercolor')>();
  return {
    ...actual,
    buildBrushForStroke: (...args: Parameters<typeof actual.buildBrushForStroke>) => {
      brushBuildState.count += 1;
      return actual.buildBrushForStroke(...args);
    },
  };
});

const DEG = Math.PI / 180;

function sizeMult(size: number): number {
  return Math.pow(3, ((toEngineParams({ size }).size ?? 0.5) - 0.5) * 2);
}

function brushOf(id: string, overrides: AquarelleToolOverrides = NEUTRAL_TOOL_OVERRIDES) {
  return buildBrushForStroke(id, { textureId: null, overrides });
}

function fp(
  tool: AquarelleTool,
  tipId: string | null,
  extra: Partial<AquarelleFootprintInput> = {},
): AquarelleFootprint {
  return aquarelleFootprintFor({
    tool,
    tipId,
    textureId: null,
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
      textureId: null,
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

describe('footprint brush cache is generation-aware (63-06 / G-2 / T-63-18)', () => {
  const MASKED = 'wc/custom-footprint-generation';
  const uniformMask = (value: number) => new Uint8Array(TIP_MASK_BYTES).fill(value);

  beforeEach(() => {
    resetMaskRegistry();
    brushBuildState.count = 0;
  });

  afterEach(() => {
    resetMaskRegistry();
  });

  it('rebuilds the footprint brush when a mask changes under an unchanged id', () => {
    registerMask(MASKED, uniformMask(30));
    fp('brush', MASKED);
    expect(brushBuildState.count, 'first read builds once').toBe(1);

    fp('brush', MASKED);
    expect(brushBuildState.count, 'an unchanged generation stays a cache hit').toBe(1);

    registerMask(MASKED, uniformMask(210));
    fp('brush', MASKED);
    expect(brushBuildState.count, 'a mask replacement rebuilds the brush').toBe(2);
  });

  it('after resetMaskRegistry a texture id reverts to the response footprint', () => {
    registerMask(MASKED, uniformMask(30));
    // quick-261115-oh9: the RESPONSE owns the physics. 'round' is a fixed-
    // rotation response, so a texture never turns it into a follow tip.
    const textured = fp('brush', 'round', { textureId: MASKED, moveAngle: 0.7 });
    expect(textured.angle, 'the textured tip keeps the response rotation').toBe(0);
    expect(brushBuildState.count, 'the textured brush was built once').toBe(1);

    resetMaskRegistry();
    const reverted = fp('brush', 'round', { textureId: MASKED, moveAngle: 0.7 });
    expect(reverted.angle, 'reset keeps the response rotation').toBe(0);
    expect(brushBuildState.count, 'the cached textured brush was rebuilt').toBe(2);
  });
});

describe('footprint texture axis (quick-261115-oh9)', () => {
  beforeEach(() => {
    resetMaskRegistry();
    brushBuildState.count = 0;
  });

  it('invalidates its single-entry cache when textureId changes', () => {
    fp('brush', 'round', { textureId: null });
    expect(brushBuildState.count, 'the untextured brush was built once').toBe(1);

    fp('brush', 'round', { textureId: null });
    expect(brushBuildState.count, 'an unchanged texture stays a cache hit').toBe(1);

    fp('brush', 'round', { textureId: 'wc/custom-4a7c19' });
    expect(brushBuildState.count, 'a texture change rebuilds the brush').toBe(2);

    fp('brush', 'round', { textureId: 'wc/custom-4a7c19' });
    expect(brushBuildState.count, 'the textured entry caches').toBe(2);
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

  it('mirrors the engine minimums so a tiny or flat tip stays visible (IN-03)', () => {
    const footprint: AquarelleFootprint = { radiusDoc: 0.001, aspect: 0.1, angle: 0, rounded: true };
    // Engine.updateCursor: d = max(4, …), h = max(3, d · aspect).
    expect(footprintCssSize(footprint, 100)).toEqual({ width: 4, height: 3 });
  });
});

// quick 261116-inu / Task 8 — the px size law and the lift split. The size
// controls store a canonical; this law turns it into the px the engine stamps
// at full pressure, so a displayed 512 must paint 512 px and a displayed 1
// must stay 1 (the retired floor is gone, the footprint law adds none).
describe('pixel-true size law (quick 261116-inu / Task 8)', () => {
  it('Round at workingHeight 1080: canonical for 512 paints 512 +/- 1 px, canonical for 1 paints 1 +/- 0.01', () => {
    const fullPressure = brushOf('round').size[1];
    const ring = (size: number): AquarelleFootprint =>
      aquarelleFootprintFor({
        tool: 'brush',
        tipId: 'round',
        textureId: null,
        toolOverrides: NEUTRAL_TOOL_OVERRIDES,
        size,
        // Full pressure: brushRadius collapses to brush.size[1].
        pressure: 1,
        moveAngle: 0,
        tiltX: 0,
        tiltY: 0,
      });

    const diameter512 = 2 * ring(canonicalFromDiameter(512, fullPressure, 1080)).radiusDoc * 1080;
    expect(diameter512).toBeGreaterThanOrEqual(511);
    expect(diameter512).toBeLessThanOrEqual(513);
    expect(diameter512).toBeCloseTo(512, 1);

    const diameter1 = 2 * ring(canonicalFromDiameter(1, fullPressure, 1080)).radiusDoc * 1080;
    expect(diameter1).toBeGreaterThanOrEqual(0.99);
    expect(diameter1).toBeLessThanOrEqual(1.01);
    expect(diameter1).toBeCloseTo(1, 2);
  });

  it('lift: aquarelleActiveCanonicalSize is the lift size and sweeping the paint canonical never moves the ring', () => {
    const previousPaintSize = aquarelleParams.value.size;
    setAquarelleLiftSize(34);
    setAquarelleTool('lift');
    try {
      expect(aquarelleActiveCanonicalSize(), 'the one selector reads the lift canonical').toBe(
        aquarelleLiftSize.value,
      );
      const liftRing = (): AquarelleFootprint =>
        aquarelleFootprintFor({
          tool: 'lift',
          tipId: 'filbert',
          textureId: null,
          toolOverrides: NEUTRAL_TOOL_OVERRIDES,
          size: aquarelleActiveCanonicalSize(),
          pressure: 0.4,
          moveAngle: 0,
          tiltX: 0,
          tiltY: 0,
        });
      // Engine.radius('lift'): (0.012 + 0.03·pr) · sizeMult.
      const expectedRadius = (0.012 + 0.03 * 0.4) * sizeMult(34);
      const first = liftRing();
      expect(first.radiusDoc).toBeCloseTo(expectedRadius, 12);

      for (const paintSize of [1, 12, 40, 80, 200, 512, 800]) {
        setAquarelleParam('size', paintSize);
        expect(aquarelleActiveCanonicalSize(), `paint size ${paintSize} never leaks into the lift`).toBe(34);
        expect(liftRing().radiusDoc).toBeCloseTo(expectedRadius, 12);
      }
    } finally {
      setAquarelleTool('brush');
      setAquarelleLiftSize(12);
      setAquarelleParam('size', previousPaintSize);
    }
    // Back on Brush, the same selector returns the paint canonical.
    expect(aquarelleActiveCanonicalSize()).toBe(aquarelleParams.value.size);
  });
});
