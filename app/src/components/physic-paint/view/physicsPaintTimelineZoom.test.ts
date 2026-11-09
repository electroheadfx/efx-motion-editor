// @vitest-environment node
import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TIMELINE_LANE_ORIGIN_PX,
  TIMELINE_RULER_MIN_STEP,
  TIMELINE_RULER_MIN_TICK_PX,
  TIMELINE_ZOOM_EPSILON,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
  TIMELINE_ZOOM_PRESETS,
  clampTimelineZoomScale,
  frameToPx,
  nextTimelineZoomPreset,
  nextTimelineZoomWheelScale,
  pxToFrame,
  registerTimelineZoomScrollPort,
  resolveAnchoredScrollLeft,
  resolveCursorAnchorLocalX,
  resolvePlayheadAnchorLocalX,
  resolveRulerStep,
  resolveTimelineFitScale,
  resolveTimelineMetrics,
  resolveTimelineViewportFrames,
  resolveTimelineZoomPercent,
  timelineZoom,
  type TimelineZoomScrollPort,
} from './physicsPaintTimelineZoom';

/**
 * Phase 60 (ZOOM-01..04): the Studio timeline's session-only pitch authority.
 *
 * 100% is the base 18px pitch. Everything horizontal derives from this module:
 * pitch, cell width, cell gap, the ruler step, the anchored scroll write and the
 * header pill's percent. Vertical geometry is deliberately absent — row height,
 * lane height, cell height, ruler-band height and the header column never scale.
 */

const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

beforeEach(() => {
  registerTimelineZoomScrollPort(null);
  timelineZoom.resetForStudioOpen();
});

afterEach(() => {
  registerTimelineZoomScrollPort(null);
});

function makePort(options: {
  scrollLeft: number;
  scrollerLeft?: number;
  clientWidth?: number;
  playheadFrame?: number;
  frameCount?: number;
}): { port: TimelineZoomScrollPort; readScrollLeft: () => number } {
  let scrollLeft = options.scrollLeft;
  const port: TimelineZoomScrollPort = {
    getScrollLeft: () => scrollLeft,
    getScrollerLeft: () => options.scrollerLeft ?? 0,
    getClientWidth: () => options.clientWidth ?? 800,
    setScrollLeft: (value: number) => {
      scrollLeft = value;
    },
    getPlayheadFrame: () => options.playheadFrame ?? 0,
    getFrameCount: () => options.frameCount ?? 120,
  };
  return { port, readScrollLeft: () => scrollLeft };
}

/**
 * The anchored scroll write is deferred one frame (it must land after the new
 * pitch renders — see commitAnchoredScroll). Node has no rAF, so the store
 * schedules a macrotask there; wait for both so this holds in either env.
 */
async function flushAnchoredScroll(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

describe('physicsPaintTimelineZoom — the locked ladder and clamp', () => {
  it('exposes the locked eight-preset ladder, strictly increasing', () => {
    expect([...TIMELINE_ZOOM_PRESETS]).toEqual([...PRESETS]);
    for (let index = 1; index < TIMELINE_ZOOM_PRESETS.length; index += 1) {
      expect(TIMELINE_ZOOM_PRESETS[index]).toBeGreaterThan(TIMELINE_ZOOM_PRESETS[index - 1]);
    }
    expect(TIMELINE_ZOOM_MIN).toBe(0.25);
    expect(TIMELINE_ZOOM_MAX).toBe(4);
    expect(TIMELINE_ZOOM_EPSILON).toBe(0.001);
    expect(TIMELINE_LANE_ORIGIN_PX).toBe(6);
    expect(TIMELINE_RULER_MIN_TICK_PX).toBe(40);
    expect(TIMELINE_RULER_MIN_STEP).toBe(3);
  });

  it('clamps into 0.25–4 and falls back to the minimum for non-finite input', () => {
    expect(clampTimelineZoomScale(0.1)).toBe(TIMELINE_ZOOM_MIN);
    expect(clampTimelineZoomScale(9)).toBe(TIMELINE_ZOOM_MAX);
    expect(clampTimelineZoomScale(1.37)).toBeCloseTo(1.37, 12);
    expect(clampTimelineZoomScale(Number.NaN)).toBe(TIMELINE_ZOOM_MIN);
    expect(clampTimelineZoomScale(Number.POSITIVE_INFINITY)).toBe(TIMELINE_ZOOM_MIN);
  });
});

describe('physicsPaintTimelineZoom — metrics (ZOOM-03: horizontal only)', () => {
  it('scales cellWidth, cellGap and pitch at every preset and never adds a vertical term', () => {
    const expected = [
      { scale: 0.25, cellWidth: 4, cellGap: 0.5, pitch: 4.5 },
      { scale: 0.5, cellWidth: 8, cellGap: 1, pitch: 9 },
      { scale: 0.75, cellWidth: 12, cellGap: 1.5, pitch: 13.5 },
      { scale: 1, cellWidth: 16, cellGap: 2, pitch: 18 },
      { scale: 1.5, cellWidth: 24, cellGap: 3, pitch: 27 },
      { scale: 2, cellWidth: 32, cellGap: 4, pitch: 36 },
      { scale: 3, cellWidth: 48, cellGap: 6, pitch: 54 },
      { scale: 4, cellWidth: 64, cellGap: 8, pitch: 72 },
    ];
    for (const row of expected) {
      const metrics = resolveTimelineMetrics(row.scale);
      expect(metrics.scale).toBeCloseTo(row.scale, 12);
      expect(metrics.cellWidth).toBeCloseTo(row.cellWidth, 12);
      expect(metrics.cellGap).toBeCloseTo(row.cellGap, 12);
      expect(metrics.pitch).toBeCloseTo(row.pitch, 12);
      // The gap is the track width minus the cell width: they must agree.
      expect(metrics.cellWidth + metrics.cellGap).toBeCloseTo(metrics.pitch, 12);
    }
  });

  it('returns exactly scale, cellWidth, cellGap and pitch — no row, lane, header or band height', () => {
    expect(Object.keys(resolveTimelineMetrics(1)).sort()).toEqual(['cellGap', 'cellWidth', 'pitch', 'scale']);
    for (const key of Object.keys(resolveTimelineMetrics(2))) {
      expect(key).not.toMatch(/height|row|lane|header|band|top|bottom/i);
    }
    // Out-of-range input is clamped, never extrapolated.
    expect(resolveTimelineMetrics(10).pitch).toBe(72);
    expect(resolveTimelineMetrics(0.1).pitch).toBe(4.5);
  });
});

describe('physicsPaintTimelineZoom — adaptive ruler step (D-09 / D-10)', () => {
  it('returns 9 / 6 / 3 / 3 / 3 / 3 / 3 / 3 for the eight presets with tick extents 40.5 / 54 / 40.5 / 54 / 81 / 108 / 162 / 216', () => {
    const expected = [
      { scale: 0.25, step: 9, extent: 40.5 },
      { scale: 0.5, step: 6, extent: 54 },
      { scale: 0.75, step: 3, extent: 40.5 },
      { scale: 1, step: 3, extent: 54 },
      { scale: 1.5, step: 3, extent: 81 },
      { scale: 2, step: 3, extent: 108 },
      { scale: 3, step: 3, extent: 162 },
      { scale: 4, step: 3, extent: 216 },
    ];
    for (const row of expected) {
      const pitch = resolveTimelineMetrics(row.scale).pitch;
      const step = resolveRulerStep(pitch);
      expect(step).toBe(row.step);
      expect(step * pitch).toBeCloseTo(row.extent, 9);
      expect(step * pitch).toBeGreaterThanOrEqual(TIMELINE_RULER_MIN_TICK_PX);
    }
  });

  it('never subdivides below 3 and never decreases as pitch grows', () => {
    expect(resolveRulerStep(0)).toBe(TIMELINE_RULER_MIN_STEP);
    expect(resolveRulerStep(-18)).toBe(TIMELINE_RULER_MIN_STEP);
    expect(resolveRulerStep(Number.NaN)).toBe(TIMELINE_RULER_MIN_STEP);
    let previous = 0;
    for (let pitch = 1; pitch <= 100; pitch += 0.5) {
      const step = resolveRulerStep(pitch);
      expect(step).toBeGreaterThanOrEqual(TIMELINE_RULER_MIN_STEP);
      expect(step % TIMELINE_RULER_MIN_STEP).toBe(0);
      expect(step).toBeLessThanOrEqual(previous === 0 ? Number.POSITIVE_INFINITY : previous);
      previous = step;
    }
  });
});

describe('physicsPaintTimelineZoom — anchoring law', () => {
  it('converts a wheel clientX into lane-local x (minus the 6px gutter)', () => {
    expect(resolveCursorAnchorLocalX(500, 200)).toBe(294);
    expect(resolveCursorAnchorLocalX(0, 0)).toBe(-6);
  });

  it('preserves the frame fraction through a scale step, including the exact table', () => {
    for (const [oldPitch, newPitch] of [
      [18, 36],
      [18, 4.5],
      [36, 9],
    ]) {
      for (const localX of [0, 88, 294, 512]) {
        const scrollLeft = 100;
        const next = resolveAnchoredScrollLeft(scrollLeft, localX, oldPitch, newPitch);
        expect((scrollLeft + localX) / oldPitch).toBeCloseTo((next + localX) / newPitch, 9);
      }
    }
    expect(resolveAnchoredScrollLeft(100, 294, 18, 36)).toBeCloseTo(494, 9);
    expect(resolveAnchoredScrollLeft(100, 88, 18, 36)).toBeCloseTo(288, 9);
    expect(resolveAnchoredScrollLeft(1000, 400, 18, 36)).toBeCloseTo(2400, 9);
  });

  it('anchors the pill on the playhead centre, falling back to the viewport centre when offscreen', () => {
    // 10 x 18 + 18 / 2 - 1 - 100 = 88 (inside [0, 800]).
    expect(resolvePlayheadAnchorLocalX(100, 800, 10, 18)).toBe(88);
    // -812 is offscreen, so the viewport centre wins.
    expect(resolvePlayheadAnchorLocalX(1000, 800, 10, 18)).toBe(400);
  });

  it('round-trips frameToPx / pxToFrame through the gutter and scroll offset', () => {
    expect(frameToPx(10, 18)).toBe(186);
    expect(pxToFrame(186, 0, 0, 18)).toBe(10);
    expect(pxToFrame(286, 200, 100, 18)).toBe(10);
    expect(frameToPx(10, 4.5)).toBeCloseTo(51, 9);
    expect(pxToFrame(51, 0, 0, 4.5)).toBe(10);
  });

  it('resolves the visible frame window and returns null for a non-positive pitch', () => {
    const frames = resolveTimelineViewportFrames(100, 800, 18);
    expect(frames).not.toBeNull();
    expect(frames?.visStart).toBeCloseTo(100 / 18, 12);
    expect(frames?.visEnd).toBeCloseTo(900 / 18, 12);
    expect(resolveTimelineViewportFrames(0, 800, 0)).toBeNull();
    expect(resolveTimelineViewportFrames(0, 800, -18)).toBeNull();
  });
});

describe('physicsPaintTimelineZoom — wheel factor (D-05)', () => {
  it('is continuous exponential at roughly x1.1 per 100px', () => {
    expect(nextTimelineZoomWheelScale(1, -100, 0)).toBeCloseTo(1.105, 3);
    expect(nextTimelineZoomWheelScale(1, 100, 0)).toBeCloseTo(1 / 1.105, 3);
    // It never snaps to a preset.
    expect(nextTimelineZoomWheelScale(1, -100, 0)).not.toBe(1.5);
  });

  it('normalizes line-mode deltas at 16px per line before applying the factor', () => {
    const lineMode = nextTimelineZoomWheelScale(1, -10, 1);
    const pixelMode = nextTimelineZoomWheelScale(1, -160, 0);
    expect(lineMode).toBeCloseTo(pixelMode, 12);
    expect(lineMode).toBeCloseTo(Math.exp(0.16), 12);
  });

  it('leaves the current scale untouched for non-finite deltas and clamps at both ends', () => {
    expect(nextTimelineZoomWheelScale(1.37, Number.NaN, 0)).toBe(1.37);
    expect(nextTimelineZoomWheelScale(1.37, Number.POSITIVE_INFINITY, 0)).toBe(1.37);
    expect(nextTimelineZoomWheelScale(1.37, -Number.POSITIVE_INFINITY, 0)).toBe(1.37);
    expect(nextTimelineZoomWheelScale(1, -100000, 0)).toBe(TIMELINE_ZOOM_MAX);
    expect(nextTimelineZoomWheelScale(1, 100000, 0)).toBe(TIMELINE_ZOOM_MIN);
  });
});

describe('physicsPaintTimelineZoom — preset stepping (D-06)', () => {
  it('steps from the current value, never from a rounded preset', () => {
    expect(nextTimelineZoomPreset(1.37, 1)).toBe(1.5);
    expect(nextTimelineZoomPreset(1.37, -1)).toBe(1);
    expect(nextTimelineZoomPreset(1, 1)).toBe(1.5);
    expect(nextTimelineZoomPreset(1, -1)).toBe(0.75);
    expect(nextTimelineZoomPreset(4, 1)).toBe(4);
    expect(nextTimelineZoomPreset(0.25, -1)).toBe(0.25);
    expect(nextTimelineZoomPreset(Number.NaN, 1)).toBe(Number.NaN);
  });
});

describe('physicsPaintTimelineZoom — fit, percent and boundary inputs', () => {
  it('computes a one-shot fit scale clamped into 0.25–4 and defaults to 1 on unusable input', () => {
    // (1000 - 6) / (120 x 18)
    expect(resolveTimelineFitScale(120, 1000)).toBeCloseTo(0.4601851, 6);
    expect(resolveTimelineFitScale(0, 1000)).toBe(1);
    expect(resolveTimelineFitScale(120, 0)).toBe(1);
    expect(resolveTimelineFitScale(Number.NaN, 1000)).toBe(1);
    // A very long range still clamps at the floor; a very short one at the ceiling.
    expect(resolveTimelineFitScale(100000, 1000)).toBe(TIMELINE_ZOOM_MIN);
    expect(resolveTimelineFitScale(1, 1000)).toBe(TIMELINE_ZOOM_MAX);
  });

  it('reads the rounded integer percent (D-03)', () => {
    expect(resolveTimelineZoomPercent(1)).toBe(100);
    expect(resolveTimelineZoomPercent(1.37)).toBe(137);
    expect(resolveTimelineZoomPercent(0.5)).toBe(50);
    expect(resolveTimelineZoomPercent(0.25)).toBe(25);
    expect(resolveTimelineZoomPercent(4)).toBe(400);
  });
});

describe('physicsPaintTimelineZoom — store', () => {
  it('writes the anchored scrollLeft for a cursor zoom', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 100, scrollerLeft: 200, clientWidth: 800 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.setScaleAtCursor(1.5, 500);
    expect(timelineZoom.scale.value).toBeCloseTo(1.5, 12);
    await flushAnchoredScroll();
    // localX = 500 - 200 - 6 = 294; (100 + 294) / 18 x 27 - 294 = 297.
    expect(readScrollLeft()).toBeCloseTo(297, 9);
  });

  it('defers the anchored write so it is never clamped against the pre-zoom width (CR-02)', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 100, scrollerLeft: 200, clientWidth: 800, playheadFrame: 10 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.zoomIn();
    // Same task: the browser would still see the OLD scrollWidth, so the write
    // must not have landed yet.
    expect(readScrollLeft()).toBe(100);
    await flushAnchoredScroll();
    expect(readScrollLeft()).toBeCloseTo(194, 9);
  });

  it('discards a queued anchored write when the Studio resets', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 100, scrollerLeft: 200, clientWidth: 800, playheadFrame: 10 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.zoomIn();
    timelineZoom.resetForStudioOpen();
    await flushAnchoredScroll();
    expect(timelineZoom.scale.value).toBe(1);
    expect(readScrollLeft()).toBe(100);
  });

  it('anchors zoomIn and zoomOut on the playhead centre', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 100, scrollerLeft: 200, clientWidth: 800, playheadFrame: 10 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.zoomIn();
    expect(timelineZoom.scale.value).toBeCloseTo(1.5, 12);
    await flushAnchoredScroll();
    expect(readScrollLeft()).toBeCloseTo(194, 9);
  });

  it('anchors zoomOut one step down on the playhead centre', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 100, scrollerLeft: 200, clientWidth: 800, playheadFrame: 10 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.zoomOut();
    expect(timelineZoom.scale.value).toBeCloseTo(0.75, 12);
    await flushAnchoredScroll();
    expect(readScrollLeft()).toBeCloseTo(53, 9);
  });

  it('falls back to the viewport centre when the playhead is offscreen', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 1000, scrollerLeft: 200, clientWidth: 800, playheadFrame: 10 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.zoomIn();
    expect(timelineZoom.scale.value).toBeCloseTo(1.5, 12);
    await flushAnchoredScroll();
    expect(readScrollLeft()).toBeCloseTo(1700, 9);
  });

  it('fits the whole range once and clamps the anchored write at 0', async () => {
    const { port, readScrollLeft } = makePort({ scrollLeft: 0, clientWidth: 360, playheadFrame: 10, frameCount: 40 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    timelineZoom.fit();
    expect(timelineZoom.scale.value).toBeCloseTo(0.49166666666666664, 12);
    await flushAnchoredScroll();
    // -95.5666... clamps at 0 so a negative never reaches the DOM.
    expect(readScrollLeft()).toBe(0);
  });

  it('is a no-op on scroll writes with no registered port and never throws', () => {
    registerTimelineZoomScrollPort(null);
    expect(() => {
      timelineZoom.setScale(1);
      timelineZoom.setScaleAtCursor(1.5, 500);
      timelineZoom.zoomIn();
      timelineZoom.zoomOut();
      timelineZoom.fit();
    }).not.toThrow();
    // The scale writes still happen (1 -> 1.5 -> 2 -> 1.5); only scroll writes are skipped.
    expect(timelineZoom.scale.value).toBeCloseTo(1.5, 12);
  });

  it('writes the scale exactly once per setScaleAtCursor call', async () => {
    const { port } = makePort({ scrollLeft: 100, scrollerLeft: 200, clientWidth: 800, playheadFrame: 10 });
    registerTimelineZoomScrollPort(port);
    timelineZoom.setScale(1);
    let runs = 0;
    const stop = effect(() => {
      void timelineZoom.scale.value;
      runs += 1;
    });
    const base = runs;
    timelineZoom.setScaleAtCursor(1.5, 500);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(base + 1);
    stop();
  });

  it('does not re-render for identical, epsilon-close or clamped-end writes (D-08)', async () => {
    timelineZoom.setScale(1);
    let runs = 0;
    const stop = effect(() => {
      void timelineZoom.scale.value;
      runs += 1;
    });
    const base = runs;

    timelineZoom.setScale(1);
    timelineZoom.setScale(1 + TIMELINE_ZOOM_EPSILON / 2);
    timelineZoom.setScaleAtCursor(1 + TIMELINE_ZOOM_EPSILON / 2, 400);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(base);

    timelineZoom.setScale(TIMELINE_ZOOM_MAX);
    await Promise.resolve();
    await Promise.resolve();
    const atMax = runs;
    timelineZoom.setScale(TIMELINE_ZOOM_MAX * 10);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(atMax);

    stop();
  });

  it('exposes the derived signals and resets to 1 on Studio open', () => {
    timelineZoom.setScale(2);
    expect(timelineZoom.metrics.value.pitch).toBeCloseTo(36, 12);
    expect(timelineZoom.percent.value).toBe(200);
    expect(timelineZoom.isAtMin.value).toBe(false);
    expect(timelineZoom.isAtMax.value).toBe(false);

    timelineZoom.setScale(TIMELINE_ZOOM_MIN);
    expect(timelineZoom.isAtMin.value).toBe(true);
    expect(timelineZoom.isAtMax.value).toBe(false);

    timelineZoom.setScale(TIMELINE_ZOOM_MAX);
    expect(timelineZoom.isAtMax.value).toBe(true);
    expect(timelineZoom.isAtMin.value).toBe(false);

    timelineZoom.resetForStudioOpen();
    expect(timelineZoom.scale.value).toBe(1);
    expect(timelineZoom.percent.value).toBe(100);
    expect(timelineZoom.metrics.value.pitch).toBeCloseTo(18, 12);
  });
});
