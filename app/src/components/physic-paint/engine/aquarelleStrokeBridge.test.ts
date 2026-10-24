// ============================================================
//  aquarelleStrokeBridge.test — pins the aquarelle → engine-1
//  point crossing (script-playback-draws-nothing).
//
//  The regression this guards: the Water color stroke-end bridge
//  copied AquarelleStroke points verbatim into the engine-1
//  PaintStroke the Roto script path records. Aquarelle points are
//  document UV (0..1, y up); engine-1 points are canvas pixels
//  (0..width/height, y down). The saved script therefore carried
//  0.16–0.81 as if they were pixels and replay drew a sub-pixel
//  blob at the top-left origin — the timeline advanced, the canvas
//  stayed empty.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AquarelleStroke } from '@efxlab/efx-watercolor';
import {
  aquarelleEnginePixelDeltaToUv,
  aquarelleEnginePixelToUv,
  aquarelleStrokeToPaintStroke,
  aquarelleUvToEnginePixel,
} from './aquarelleStrokeBridge';

/** Studio working size from the failing session — 1080×1080. */
const SIZE = { width: 1080, height: 1080 } as const;

function makeAquarelleStroke(points: Array<{ x: number; y: number }>): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#dd20df',
    // Canonical AQUA-04 globals (the record bag), not the mapped 0..1 vendor bag.
    params: {
      size: 50,
      load: 50,
      water: 50,
      dry: 50,
      edge: 50,
      flow: 50,
      bleed: 50,
      granulation: 50,
    },
    brushId: 'wc/round-medium',
    points: points.map((point) => ({
      x: point.x,
      y: point.y,
      p: 0.5,
      tx: 0,
      ty: 0,
      tw: 0,
    })),
    timestamp: 1792332563513,
    playFrame: 0,
  };
}

describe('aquarelleUvToEnginePixel', () => {
  it('scales document UV onto the engine-1 pixel space', () => {
    expect(aquarelleUvToEnginePixel({ x: 0.5, y: 0.5 }, SIZE)).toEqual({ x: 540, y: 540 });
    // x scales straight; y is flipped, so uv 0.25 → canvas 810 (below centre).
    expect(aquarelleUvToEnginePixel({ x: 0.25, y: 0.25 }, SIZE)).toEqual({ x: 270, y: 810 });
    expect(aquarelleUvToEnginePixel({ x: 1, y: 1 }, SIZE)).toEqual({ x: 1080, y: 0 });
  });

  it('flips y: aquarelle y-up becomes engine-1 y-down (boundary neighbours N-1 / N / N+1 class)', () => {
    // uv y = 0 is the sheet bottom → engine-1 y = height (canvas bottom).
    expect(aquarelleUvToEnginePixel({ x: 0, y: 0 }, SIZE)).toEqual({ x: 0, y: 1080 });
    // uv y = 1 is the sheet top → engine-1 y = 0 (canvas top).
    expect(aquarelleUvToEnginePixel({ x: 0, y: 1 }, SIZE)).toEqual({ x: 0, y: 0 });
    // Just inside each edge stays on the correct side of the flip.
    expect(aquarelleUvToEnginePixel({ x: 0, y: 0.001 }, SIZE).y).toBeCloseTo(1078.92, 5);
    expect(aquarelleUvToEnginePixel({ x: 0, y: 0.999 }, SIZE).y).toBeCloseTo(1.08, 5);
  });

  it('honours non-square canvases independently per axis', () => {
    const wide = { width: 1920, height: 1080 };
    expect(aquarelleUvToEnginePixel({ x: 0.5, y: 0.5 }, wide)).toEqual({ x: 960, y: 540 });
    expect(aquarelleUvToEnginePixel({ x: 1, y: 0 }, wide)).toEqual({ x: 1920, y: 1080 });
  });
});

// 261022-tv1: the inverse crossing — a pointer drag is measured in canvas
// pixels and must move the script's document-UV point the same way.
describe('aquarelleEnginePixelDeltaToUv', () => {
  it('maps a canvas pixel delta back to UV (y flip)', () => {
    expect(
      aquarelleEnginePixelDeltaToUv({ x: 40, y: -20 }, { width: 400, height: 200 }),
    ).toEqual({ x: 0.1, y: 0.1 });

    // Round-trip: moving the UV point by this delta and mapping it back lands
    // exactly on the original canvas pixel plus the pixel delta.
    const origin = { x: 0.3, y: 0.7 };
    const originPx = aquarelleUvToEnginePixel(origin, { width: 400, height: 200 });
    const uvDelta = aquarelleEnginePixelDeltaToUv(
      { x: 40, y: -20 },
      { width: 400, height: 200 },
    );
    const movedPx = aquarelleUvToEnginePixel(
      { x: origin.x + uvDelta.x, y: origin.y + uvDelta.y },
      { width: 400, height: 200 },
    );
    expect(movedPx.x).toBeCloseTo(originPx.x + 40, 10);
    expect(movedPx.y).toBeCloseTo(originPx.y - 20, 10);
  });

  it('refuses a degenerate sheet', () => {
    // No NaN/Infinity may propagate into the recorded script.
    expect(aquarelleEnginePixelDeltaToUv({ x: 10, y: 10 }, { width: 0, height: 200 })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelDeltaToUv({ x: 10, y: 10 }, { width: 400, height: 0 })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelDeltaToUv({ x: 10, y: 10 }, { width: Number.NaN, height: 200 })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelDeltaToUv({ x: 10, y: 10 }, { width: 400, height: Infinity })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelDeltaToUv({ x: Number.POSITIVE_INFINITY, y: 0 }, { width: 400, height: 200 })).toEqual({ x: 0, y: 0 });
  });
});

// 261024-mz5 Task 3: the absolute-point inverse. A transform centre captured
// in canvas pixels must cross into document UV exactly once — the same law the
// delta path already follows (y flipped, degenerate sheet refused).
describe('aquarelleEnginePixelToUv', () => {
  it('maps a canvas pixel point back to document UV (y flip)', () => {
    expect(
      aquarelleEnginePixelToUv({ x: 100, y: 50 }, { width: 400, height: 200 }),
    ).toEqual({ x: 0.25, y: 0.75 });

    // Round-trip: every point lands on itself through the forward map too.
    const uv = { x: 0.3, y: 0.7 };
    const px = aquarelleUvToEnginePixel(uv, { width: 400, height: 200 });
    const back = aquarelleEnginePixelToUv(px, { width: 400, height: 200 });
    expect(back.x).toBeCloseTo(uv.x, 12);
    expect(back.y).toBeCloseTo(uv.y, 12);
  });

  it('refuses a degenerate sheet or point', () => {
    expect(aquarelleEnginePixelToUv({ x: 10, y: 10 }, { width: 0, height: 200 })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelToUv({ x: 10, y: 10 }, { width: 400, height: 0 })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelToUv({ x: 10, y: 10 }, { width: Number.NaN, height: 200 })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelToUv({ x: 10, y: 10 }, { width: 400, height: Infinity })).toEqual({ x: 0, y: 0 });
    expect(aquarelleEnginePixelToUv({ x: Number.NaN, y: 10 }, { width: 400, height: 200 })).toEqual({ x: 0, y: 0 });
  });
});

describe('aquarelleStrokeToPaintStroke', () => {
  it('regression: a saved watercolor stroke lands in the painted region, not the origin', () => {
    // The exact coordinates persisted by the failing script (05ea4afa…).
    const stroke = makeAquarelleStroke([
      { x: 0.16869918699186992, y: 0.17750677506775067 },
      { x: 0.65, y: 0.81 },
    ]);
    const paint = aquarelleStrokeToPaintStroke(stroke, SIZE);

    expect(paint.points).toHaveLength(2);
    // Before the fix these were the raw UV values (0.16…0.81) — sub-pixel at
    // the top-left corner. After the fix they span the painted area.
    expect(paint.points[0]!.x).toBeCloseTo(182.2, 1);
    expect(paint.points[0]!.y).toBeCloseTo(888.3, 1);
    expect(paint.points[1]!.x).toBeCloseTo(702, 5);
    expect(paint.points[1]!.y).toBeCloseTo(205.2, 5);
    // The whole path must sit well inside the canvas, away from the origin.
    for (const point of paint.points) {
      expect(point.x).toBeGreaterThan(10);
      expect(point.y).toBeGreaterThan(10);
      expect(point.x).toBeLessThan(SIZE.width - 10);
      expect(point.y).toBeLessThan(SIZE.height - 10);
    }
  });

  it('never emits unconverted UV magnitudes for a mid-canvas stroke', () => {
    // A 0..1 point on a 1080 canvas is always < 2 after the flip; a converted
    // one is not. Guards a future re-introduction of the verbatim copy.
    const paint = aquarelleStrokeToPaintStroke(
      makeAquarelleStroke([{ x: 0.5, y: 0.5 }]),
      SIZE,
    );
    expect(paint.points[0]!.x).toBe(540);
    expect(paint.points[0]!.y).toBe(540);
  });

  it('carries the record bag onto engine-1 brush params and keeps sample identity', () => {
    const stroke = makeAquarelleStroke([{ x: 0.4, y: 0.6 }]);
    const paint = aquarelleStrokeToPaintStroke(stroke, SIZE);

    expect(paint.tool).toBe('paint');
    expect(paint.color).toBe('#dd20df');
    expect(paint.timestamp).toBe(stroke.timestamp);
    expect(paint.params.size).toBe(50);
    expect(paint.params.opacity).toBe(50); // load
    expect(paint.params.waterAmount).toBe(50);
    expect(paint.params.dryAmount).toBe(50);
    expect(paint.params.edgeDetail).toBe(50);
    expect(paint.points[0]!.p).toBe(0.5);
    expect(paint.points[0]!.spd).toBe(0);
  });

  it('falls back to the historic defaults when the record bag omits a slider', () => {
    const stroke = makeAquarelleStroke([{ x: 0.5, y: 0.5 }]);
    const sparse = { ...stroke, params: {} } as AquarelleStroke;
    const paint = aquarelleStrokeToPaintStroke(sparse, SIZE);
    expect(paint.params.size).toBe(12);
    expect(paint.params.opacity).toBe(50);
    expect(paint.params.waterAmount).toBe(50);
    expect(paint.params.dryAmount).toBe(50);
    expect(paint.params.edgeDetail).toBe(50);
  });
});

describe('Water color stroke-end bridges through aquarelleStrokeToPaintStroke', () => {
  // Contract pin (same family as aquarelleLayerContract): the defect was the
  // Studio copying AquarelleStroke points verbatim into the engine-1
  // PaintStroke. The unit tests above pin the math; these pin that the live
  // seam actually uses it — a reintroduced inline copy fails here.
  const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');

  it('routes handleAquarelleStrokeEnd through the conversion helper', () => {
    const seam = studio.slice(studio.indexOf('const handleAquarelleStrokeEnd'));
    const body = seam.slice(0, seam.indexOf('}, [recordAquarelleStroke'));
    expect(body).toContain('aquarelleStrokeToPaintStroke(stroke');
    // The working-canvas pixel size must be the conversion target.
    expect(body).toMatch(/aquarelleStrokeToPaintStroke\(stroke,\s*\{\s*width:\s*canvasWidth,\s*height:\s*canvasHeight\s*\}\)/);
  });

  it('never copies aquarelle UV points into the engine-1 stroke verbatim', () => {
    // The exact defect expression — raw x/y from the aquarelle sample.
    expect(studio).not.toContain('x: p.x, y: p.y, p: p.p');
    // And the seam must not rebuild a point list by hand any more.
    const seam = studio.slice(studio.indexOf('const handleAquarelleStrokeEnd'));
    const body = seam.slice(0, seam.indexOf('}, [recordAquarelleStroke'));
    expect(body).not.toContain('stroke.points.map');
  });
});
