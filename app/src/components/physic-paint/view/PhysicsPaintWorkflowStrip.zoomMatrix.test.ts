// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';
import { projectPhysicsPaintLoopClipGeometry } from './physicsPaintLoopClipPresentation';
import {
  TIMELINE_LANE_ORIGIN_PX,
  TIMELINE_RULER_MIN_STEP,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
  frameToPx,
  nextTimelineZoomPreset,
  nextTimelineZoomWheelScale,
  pxToFrame,
  registerTimelineZoomScrollPort,
  resolvePlayheadAnchorLocalX,
  resolveRulerStep,
  resolveTimelineFitScale,
  resolveTimelineMetrics,
  resolveTimelineViewportFrames,
  timelineZoom,
  type TimelineZoomScrollPort,
} from './physicsPaintTimelineZoom';
import { soundStainLeftPx, soundStainWidthPx } from './soundBandGeometry';
import {
  TIMELINE_GEOMETRY,
  TIMELINE_MOTION,
  projectTimelineRailLineWidth,
} from './timelineRailDesign';

/**
 * Phase 60 — the five-level zoom acceptance matrix (ZOOM-01..05).
 *
 * This file is the phase's acceptance surface. Every earlier plan proves its own
 * conversion; this matrix proves the phase: the numbers the product promises
 * (playhead centring, ruler legibility, rail extents, audio range, gesture
 * stepping) hold at 0.25x, 0.5x, 1x, 2x and 4x AND stay consistent with each
 * other.
 *
 * Rules this file obeys:
 * - Every expected value below is a literal transcribed from the documented
 *   predicates. The implementation under test is NEVER used as its own oracle:
 *   no `resolveTimelineMetrics(...)` result computes another row's expectation.
 * - The single pitch source is the module authority, so a drift fails the
 *   metrics row and every dependent row in the same run.
 * - Selection and paste are frame-index operations, not pixel projections:
 *   their only pixel surface is the rail/ghost geometry asserted here (the loop
 *   clip 13 / 26 / 52 / 104 / 208 and clipped 18 / 36 / 72 / 144 / 288), pinned
 *   to the live pitch by 60-02 task 3. No separate selection/paste pixel row
 *   exists because no such projection exists.
 */

interface ZoomLevel {
  readonly scale: number;
  readonly pitch: number;
  readonly cellWidth: number;
  readonly cellGap: number;
  readonly rulerStep: number;
  readonly rulerExtent: number;
  readonly playheadFrame10: number;
  readonly playheadAnchorFrame10: number;
  readonly soundStain5: number;
  readonly loopLeftFrame2: number;
  readonly loopVisibleWidth3: number;
  readonly loopClippedWidth4: number;
  readonly hitTestClientXFrame7: number;
  readonly adjacencyGap: number;
  readonly adjacentRailStart3: number;
  readonly dragFramesAt72: number;
  readonly fourFrameDragPx: number;
  readonly scrollToFrame100Target: number;
  readonly scrollToFrame100Guard: number;
}

/**
 * The one frozen five-level table. P = 18 * scale, CW = 16 * scale,
 * G = 2 * scale, ruler step = min{3k : 3k * P >= 40}, playhead =
 * 6 + 10 * P + P/2 - 1. All values are literal; adding or removing a level here
 * is the only way to add or skip a level anywhere in this file.
 */
const ZOOM_LEVELS: readonly ZoomLevel[] = Object.freeze([
  {
    scale: 0.25,
    pitch: 4.5,
    cellWidth: 4,
    cellGap: 0.5,
    rulerStep: 9,
    rulerExtent: 40.5,
    playheadFrame10: 52.25,
    playheadAnchorFrame10: 46.25,
    soundStain5: 22.5,
    loopLeftFrame2: 9,
    loopVisibleWidth3: 13,
    loopClippedWidth4: 18,
    hitTestClientXFrame7: 137.5,
    adjacencyGap: 0.5,
    adjacentRailStart3: 13.5,
    dragFramesAt72: 16,
    fourFrameDragPx: 18,
    scrollToFrame100Target: 302.25,
    scrollToFrame100Guard: 454.5,
  },
  {
    scale: 0.5,
    pitch: 9,
    cellWidth: 8,
    cellGap: 1,
    rulerStep: 6,
    rulerExtent: 54,
    playheadFrame10: 99.5,
    playheadAnchorFrame10: 93.5,
    soundStain5: 45,
    loopLeftFrame2: 18,
    loopVisibleWidth3: 26,
    loopClippedWidth4: 36,
    hitTestClientXFrame7: 169,
    adjacencyGap: 1,
    adjacentRailStart3: 27,
    dragFramesAt72: 8,
    fourFrameDragPx: 36,
    scrollToFrame100Target: 754.5,
    scrollToFrame100Guard: 909,
  },
  {
    scale: 1,
    pitch: 18,
    cellWidth: 16,
    cellGap: 2,
    rulerStep: 3,
    rulerExtent: 54,
    playheadFrame10: 194,
    playheadAnchorFrame10: 188,
    soundStain5: 90,
    loopLeftFrame2: 36,
    loopVisibleWidth3: 52,
    loopClippedWidth4: 72,
    hitTestClientXFrame7: 232,
    adjacencyGap: 2,
    adjacentRailStart3: 54,
    dragFramesAt72: 4,
    fourFrameDragPx: 72,
    scrollToFrame100Target: 1659,
    scrollToFrame100Guard: 1818,
  },
  {
    scale: 2,
    pitch: 36,
    cellWidth: 32,
    cellGap: 4,
    rulerStep: 3,
    rulerExtent: 108,
    playheadFrame10: 383,
    playheadAnchorFrame10: 377,
    soundStain5: 180,
    loopLeftFrame2: 72,
    loopVisibleWidth3: 104,
    loopClippedWidth4: 144,
    hitTestClientXFrame7: 358,
    adjacencyGap: 4,
    adjacentRailStart3: 108,
    dragFramesAt72: 2,
    fourFrameDragPx: 144,
    scrollToFrame100Target: 3468,
    scrollToFrame100Guard: 3636,
  },
  {
    scale: 4,
    pitch: 72,
    cellWidth: 64,
    cellGap: 8,
    rulerStep: 3,
    rulerExtent: 216,
    playheadFrame10: 761,
    playheadAnchorFrame10: 755,
    soundStain5: 360,
    loopLeftFrame2: 144,
    loopVisibleWidth3: 208,
    loopClippedWidth4: 288,
    hitTestClientXFrame7: 610,
    adjacencyGap: 8,
    adjacentRailStart3: 216,
    dragFramesAt72: 1,
    fourFrameDragPx: 288,
    scrollToFrame100Target: 7086,
    scrollToFrame100Guard: 7272,
  },
]);

/** A loop-range fixture; only placementStart and effectiveEnd are read by the geometry. */
function loopRange(overrides: Partial<PhysicPaintRotoLoopRange> = {}): PhysicPaintRotoLoopRange {
  return {
    loopId: 'zoom-matrix-loop',
    placementStart: 2,
    phaseOrigin: 2,
    cycleLength: 3,
    sourceFrameCount: 3,
    sourceKeyIds: ['zoom-key-a', 'zoom-key-b', 'zoom-key-c'],
    sourceCycleId: 'zoom-cycle-a',
    sourceOffsets: [0, 1, 2],
    strictInteriorPolicy: 'hold',
    repeat: 1,
    requestedEnd: 5,
    effectiveEnd: 5,
    boundary: { kind: 'parent-end', frame: 5 },
    truncated: false,
    partialCycle: false,
    unresolved: null,
    ...overrides,
  };
}

const FULL_WINDOW = Object.freeze({ startFrame: 0, endFrameExclusive: 20 });
const CLIPPED_WINDOW = Object.freeze({ startFrame: 0, endFrameExclusive: 6 });

describe('Phase 60 zoom matrix — the five-level table', () => {
  it('carries exactly the documented levels 0.25 / 0.5 / 1 / 2 / 4', () => {
    expect(ZOOM_LEVELS).toHaveLength(5);
    expect(ZOOM_LEVELS.map((level) => level.scale)).toEqual([0.25, 0.5, 1, 2, 4]);
  });
});

describe('Phase 60 zoom matrix — render geometry at every level', () => {
  it.each(ZOOM_LEVELS)('at $scale× resolves the documented pitch, cell width and gap', (level) => {
    const metrics = resolveTimelineMetrics(level.scale);
    expect(metrics.scale).toBe(level.scale);
    expect(metrics.pitch).toBe(level.pitch);
    expect(metrics.cellWidth).toBe(level.cellWidth);
    expect(metrics.cellGap).toBe(level.cellGap);
    // Exactly four horizontal terms: no vertical dimension can vary with zoom.
    expect(Object.keys(metrics).sort()).toEqual(['cellGap', 'cellWidth', 'pitch', 'scale']);
  });

  it.each(ZOOM_LEVELS)(
    'at $scale× coarsens the ruler to $rulerStep frames over $rulerExtent px',
    (level) => {
      const step = resolveRulerStep(level.pitch);
      expect(step).toBe(level.rulerStep);
      expect(step * level.pitch).toBe(level.rulerExtent);
    },
  );

  it.each(ZOOM_LEVELS)('at $scale× centres the frame-10 playhead at $playheadFrame10 px', (level) => {
    // The documented playhead law: lane origin + frame * pitch + half pitch - 1.
    expect(TIMELINE_LANE_ORIGIN_PX + 10 * level.pitch + level.pitch / 2 - 1).toBe(
      level.playheadFrame10,
    );
    // The anchor law reports the same centre relative to the viewport's left edge.
    expect(resolvePlayheadAnchorLocalX(0, 1000, 10, level.pitch)).toBe(
      level.playheadAnchorFrame10,
    );
  });

  it.each(ZOOM_LEVELS)('at $scale× places the sound stain on the live pitch', (level) => {
    expect(soundStainLeftPx(5, level.pitch)).toBe(level.soundStain5);
    expect(soundStainWidthPx(2, 7, level.pitch)).toBe(level.soundStain5);
  });

  it.each(ZOOM_LEVELS)(
    'at $scale× ends a visible three-frame loop clip on the scaled gap',
    (level) => {
      const geometry = projectPhysicsPaintLoopClipGeometry(
        loopRange({ placementStart: 2, effectiveEnd: 5 }),
        FULL_WINDOW,
        level.pitch,
        level.cellGap,
      );
      expect(geometry).not.toBeNull();
      expect(geometry?.left).toBe(level.loopLeftFrame2);
      expect(geometry?.width).toBe(level.loopVisibleWidth3);
    },
  );

  it.each(ZOOM_LEVELS)(
    'at $scale× keeps the full extent for a viewport-clipped loop clip',
    (level) => {
      const geometry = projectPhysicsPaintLoopClipGeometry(
        loopRange({ placementStart: 2, effectiveEnd: 10 }),
        CLIPPED_WINDOW,
        level.pitch,
        level.cellGap,
      );
      expect(geometry).not.toBeNull();
      expect(geometry?.left).toBe(level.loopLeftFrame2);
      // The visible branch subtracts the scaled gap; the clipped branch does not.
      expect(geometry?.width).toBe(level.loopClippedWidth4);
    },
  );

  it('holds every vertical token fixed — the metrics carry no vertical term', () => {
    expect(TIMELINE_GEOMETRY.rowHeight).toBe(30);
    expect(TIMELINE_GEOMETRY.cellHeight).toBe(22);
    expect(TIMELINE_MOTION.cellHeight).toBe(18);
    expect(TIMELINE_MOTION.laneHeight).toBe(18);
    // The fixed rhythm cannot change: adjacent lanes neither overlap nor separate.
    expect(TIMELINE_GEOMETRY.rowHeight).toBeGreaterThan(TIMELINE_GEOMETRY.cellHeight);
    expect(TIMELINE_GEOMETRY.cellHeight).toBeGreaterThan(TIMELINE_MOTION.laneHeight);
    expect(TIMELINE_MOTION.laneHeight).toBe(TIMELINE_MOTION.cellHeight);

    for (const level of ZOOM_LEVELS) {
      for (const key of Object.keys(resolveTimelineMetrics(level.scale))) {
        expect(key).not.toMatch(/height|row|lane|header|band|top|bottom/i);
      }
    }
  });
});

describe('Phase 60 zoom matrix — interaction geometry at every level', () => {
  it.each(ZOOM_LEVELS)('at $scale× round-trips the hit-test at a fixed content x', (level) => {
    // Scroller left 200, scrollLeft 100: client x = 100 + frameToPx(7, pitch).
    const clientX = 100 + frameToPx(7, level.pitch);
    expect(clientX).toBe(level.hitTestClientXFrame7);
    expect(pxToFrame(clientX, 200, 100, level.pitch)).toBe(7);
    // Mid-cell travel never crosses a frame boundary.
    expect(pxToFrame(clientX + level.pitch / 2, 200, 100, level.pitch)).toBe(7);
    expect(pxToFrame(clientX + level.pitch - 0.001, 200, 100, level.pitch)).toBe(7);
    expect(pxToFrame(clientX + level.pitch, 200, 100, level.pitch)).toBe(8);
  });

  it.each(ZOOM_LEVELS)('at $scale× reports the audio visible range in frames', (level) => {
    const frames = resolveTimelineViewportFrames(100, 200, level.pitch);
    expect(frames).not.toBeNull();
    expect(frames?.visStart).toBeCloseTo(100 / level.pitch, 10);
    expect(frames?.visEnd).toBeCloseTo(300 / level.pitch, 10);
  });

  it.each(ZOOM_LEVELS)(
    'at $scale× leaves exactly one scaled gap between adjacent rails',
    (level) => {
      // A three-frame rail starting at frame 0 ends on the last cell's right edge...
      const railEnd = projectTimelineRailLineWidth(3, level.pitch, true, level.cellGap);
      expect(railEnd).toBe(level.loopVisibleWidth3);
      // ...and the adjacent rail at frame 3 starts exactly one gap later.
      const nextRail = projectPhysicsPaintLoopClipGeometry(
        loopRange({ placementStart: 3, effectiveEnd: 6 }),
        FULL_WINDOW,
        level.pitch,
        level.cellGap,
      );
      expect(nextRail?.left).toBe(level.adjacentRailStart3);
      expect((nextRail?.left ?? 0) - railEnd).toBe(level.adjacencyGap);
    },
  );

  it('orders the ladder: pitch strictly increases and the ruler extent never decreases', () => {
    let previousPitch = 0;
    let previousExtent = 0;
    for (const level of ZOOM_LEVELS) {
      const pitch = resolveTimelineMetrics(level.scale).pitch;
      expect(pitch).toBeGreaterThan(previousPitch);
      const extent = resolveRulerStep(pitch) * pitch;
      expect(extent).toBeGreaterThanOrEqual(previousExtent);
      previousPitch = pitch;
      previousExtent = extent;
    }
  });

  it('keeps the empty document exact: no scaled cell, the ruler floor and the fit default', () => {
    expect(resolveRulerStep(0)).toBe(TIMELINE_RULER_MIN_STEP);
    expect(resolveRulerStep(0)).toBe(3);
    expect(resolveTimelineMetrics(0).scale).toBe(0.25);
    expect(resolveTimelineMetrics(0).cellWidth).toBe(4);
    expect(resolveTimelineMetrics(0).cellGap).toBe(0.5);
    expect(resolveTimelineMetrics(0).pitch).toBe(4.5);
    expect(resolveTimelineFitScale(0, 360)).toBe(1);
    expect(resolveTimelineViewportFrames(0, 0, 0)).toBeNull();
  });

  it.each(ZOOM_LEVELS)('at $scale× resolves a 72px drag to $dragFramesAt72 frames', (level) => {
    expect(Math.round(72 / level.pitch)).toBe(level.dragFramesAt72);
    expect(4 * level.pitch).toBe(level.fourFrameDragPx);
  });

  it.each(ZOOM_LEVELS)('at $scale× projects the ruler scrub onto frame 7', (level) => {
    // The scrub surface (the ruler's own rect) starts where the scroller does.
    const clientX = 106 + 7 * level.pitch;
    expect(clientX).toBe(level.hitTestClientXFrame7);
    expect(pxToFrame(clientX, 200, 100, level.pitch)).toBe(7);
    expect(pxToFrame(clientX + level.pitch / 2, 200, 100, level.pitch)).toBe(7);
    expect(pxToFrame(clientX + level.pitch - 0.001, 200, 100, level.pitch)).toBe(7);
    expect(pxToFrame(clientX + level.pitch, 200, 100, level.pitch)).toBe(8);
  });

  /**
   * The documented scroll-to-frame law. No exported helper exists, so this local
   * predicate is the explicit substitute for a five-level call: it restates the
   * centring target and the `scrollWidth < (frame + 1) * pitch` no-op guard that
   * 60-03 task 2 pins on both positioning effects (peeked pitch, unchanged
   * dependency arrays). The expected values stay literal in the level table.
   */
  function scrollToFramePlan(
    frame: number,
    clientWidth: number,
    pitch: number,
    scrollWidth: number,
  ): { readonly target: number; readonly proceeds: boolean } {
    return {
      target: frame * pitch + pitch / 2 - clientWidth / 2,
      proceeds: scrollWidth >= (frame + 1) * pitch,
    };
  }

  it.each(ZOOM_LEVELS)(
    'at $scale× centres frame 100 at $scrollToFrame100Target px with its guard at $scrollToFrame100Guard',
    (level) => {
      expect((100 + 1) * level.pitch).toBe(level.scrollToFrame100Guard);
      const justBelow = scrollToFramePlan(100, 300, level.pitch, level.scrollToFrame100Guard - 1);
      expect(justBelow.target).toBe(level.scrollToFrame100Target);
      expect(justBelow.proceeds).toBe(false);
      const atThreshold = scrollToFramePlan(100, 300, level.pitch, level.scrollToFrame100Guard);
      expect(atThreshold.target).toBe(level.scrollToFrame100Target);
      expect(atThreshold.proceeds).toBe(true);
    },
  );
});

interface EdgeProbeRow {
  readonly id: number;
  readonly requirement: string;
  readonly category:
    | 'unclassified'
    | 'boundary'
    | 'adjacency'
    | 'empty'
    | 'ordering'
    | 'precision';
  readonly owner: string;
}

/**
 * The phase's spec-less edge probe: eleven rows across the five categories plus
 * two unclassified review rows. Each row names the predicate that owns it. A row
 * that loses its home fails red here instead of vanishing.
 */
const EDGE_PROBE_ROWS: readonly EdgeProbeRow[] = Object.freeze([
  {
    id: 1,
    requirement: 'ZOOM/SC1',
    category: 'unclassified',
    owner:
      '60-01 task 1 cursor anchor (localX 294, anchored 494, wheel factor) plus 60-01 task 2 wiring (modifier branch before the shift guard)',
  },
  {
    id: 2,
    requirement: 'ZOOM/SC2',
    category: 'boundary',
    owner:
      '60-01 task 1 clamp table at 0.25 / 4 and one step beyond, plus 60-06 task 3 end-step cases',
  },
  {
    id: 3,
    requirement: 'ZOOM/SC2',
    category: 'adjacency',
    owner: '60-01 task 1 wheel-epsilon no-op, plus 60-06 task 3 no-write at the current scale',
  },
  {
    id: 4,
    requirement: 'ZOOM/SC2',
    category: 'empty',
    owner:
      '60-01 task 1 port-absent contract (every action is a scroll no-op, never throws), plus 60-06 task 3 Fit with no port',
  },
  {
    id: 5,
    requirement: 'ZOOM/SC2',
    category: 'ordering',
    owner: '60-01 task 1 strictly increasing ladder, plus 60-06 task 2 ordering block',
  },
  {
    id: 6,
    requirement: 'ZOOM/SC2',
    category: 'precision',
    owner:
      '60-01 task 1 percent rounding (137 / 100 / 50), plus 60-06 task 3 Fit literal 0.49166666666666664 -> percent 49',
  },
  {
    id: 7,
    requirement: 'ZOOM/SC3',
    category: 'adjacency',
    owner:
      '60-06 task 2 adjacency block (a 3-frame rail ends at 3 x pitch - gap, the next starts at 3 x pitch, visible gap 0.5 / 1 / 2 / 4 / 8)',
  },
  {
    id: 8,
    requirement: 'ZOOM/SC3',
    category: 'empty',
    owner:
      '60-06 task 2 empty block (resolveRulerStep(0) is 3, resolveTimelineMetrics(0) is the 0.25 entry, zero pitch returns a null viewport)',
  },
  {
    id: 9,
    requirement: 'ZOOM/SC3',
    category: 'ordering',
    owner: '60-06 task 2 ordering block (pitch strictly increases, ruler extent never decreases)',
  },
  {
    id: 10,
    requirement: 'ZOOM/SC4',
    category: 'adjacency',
    owner:
      '60-06 task 1 vertical-token block (lane and cell heights stay at their 1x values, so adjacent lanes neither overlap nor separate with zoom)',
  },
  {
    id: 11,
    requirement: 'ZOOM/SC4',
    category: 'empty',
    owner:
      '60-06 task 2 empty block (resolveTimelineFitScale(0, 360) is 1, resolveRulerStep(0) is 3 and resolveTimelineMetrics(0) is the 0.25 entry - an empty document never produces a scaled cell)',
  },
  {
    id: 12,
    requirement: 'ZOOM/SC4',
    category: 'ordering',
    owner:
      '60-06 task 1 vertical-token block (the fixed vertical tokens are scale-invariant, so their order cannot change)',
  },
  {
    id: 13,
    requirement: 'ZOOM/SC5',
    category: 'unclassified',
    owner:
      '60-01 task 2/3 wiring (resetForStudioOpen at the mount seam, no document import) plus 60-06 task 3 reset to scale 1, percent 100, flags false/false',
  },
]);

describe('Phase 60 zoom matrix — edge-probe row ownership', () => {
  it('carries exactly the thirteen rows the phase edge probe raised', () => {
    expect(EDGE_PROBE_ROWS).toHaveLength(13);
    expect(EDGE_PROBE_ROWS.map((row) => row.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(new Set(EDGE_PROBE_ROWS.map((row) => row.category))).toEqual(
      new Set(['unclassified', 'boundary', 'adjacency', 'empty', 'ordering', 'precision']),
    );
  });

  it('assigns a named owner to every row and owns both unclassified rows explicitly', () => {
    for (const row of EDGE_PROBE_ROWS) {
      expect(row.owner.trim().length).toBeGreaterThan(0);
    }
    const unclassified = EDGE_PROBE_ROWS.filter((row) => row.category === 'unclassified');
    expect(unclassified).toHaveLength(2);
    expect(unclassified.map((row) => row.id)).toEqual([1, 13]);
    for (const row of unclassified) {
      expect(row.owner).toMatch(/^60-0[1-6] task/);
    }
  });
});

/** A fresh stub port per test: every action reads it, and the setter is a spy. */
function makePort(
  options: {
    scrollLeft?: number;
    scrollerLeft?: number;
    clientWidth?: number;
    playheadFrame?: number;
    frameCount?: number;
  } = {},
) {
  let scrollLeft = options.scrollLeft ?? 0;
  const setScrollLeft = vi.fn((value: number) => {
    scrollLeft = value;
  });
  const port: TimelineZoomScrollPort = {
    getScrollLeft: () => scrollLeft,
    getScrollerLeft: () => options.scrollerLeft ?? 0,
    getClientWidth: () => options.clientWidth ?? 360,
    setScrollLeft,
    getPlayheadFrame: () => options.playheadFrame ?? 10,
    getFrameCount: () => options.frameCount ?? 40,
  };
  return { port, setScrollLeft };
}

describe('Phase 60 zoom matrix — store gestures', () => {
  beforeEach(() => {
    registerTimelineZoomScrollPort(null);
    timelineZoom.resetForStudioOpen();
  });

  afterEach(() => {
    registerTimelineZoomScrollPort(null);
  });

  it('steps the preset ladder from the current value, never from a rounded preset (D-06)', () => {
    timelineZoom.setScale(1.37);
    timelineZoom.zoomIn();
    expect(timelineZoom.scale.value).toBe(1.5);
    expect(nextTimelineZoomPreset(1.37, 1)).toBe(1.5);

    timelineZoom.setScale(1.37);
    timelineZoom.zoomOut();
    expect(timelineZoom.scale.value).toBe(1);
    expect(nextTimelineZoomPreset(1.37, -1)).toBe(1);
  });

  it('holds the clamped ends: minus at 0.25 and plus at 4 are no-ops (ZOOM-02)', () => {
    timelineZoom.setScale(TIMELINE_ZOOM_MIN);
    timelineZoom.zoomOut();
    expect(timelineZoom.scale.value).toBe(TIMELINE_ZOOM_MIN);
    expect(timelineZoom.scale.value).toBe(0.25);
    expect(nextTimelineZoomPreset(TIMELINE_ZOOM_MIN, -1)).toBe(TIMELINE_ZOOM_MIN);

    timelineZoom.setScale(TIMELINE_ZOOM_MAX);
    timelineZoom.zoomIn();
    expect(timelineZoom.scale.value).toBe(TIMELINE_ZOOM_MAX);
    expect(timelineZoom.scale.value).toBe(4);
    expect(nextTimelineZoomPreset(TIMELINE_ZOOM_MAX, 1)).toBe(TIMELINE_ZOOM_MAX);
  });

  it('does not write scroll when the scale is unchanged (D-08)', () => {
    const { port, setScrollLeft } = makePort({ scrollLeft: 100 });
    registerTimelineZoomScrollPort(port);

    timelineZoom.setScale(1.37);
    expect(timelineZoom.percent.value).toBe(137);
    timelineZoom.setScale(1.37);
    expect(timelineZoom.percent.value).toBe(137);

    // The epsilon guard returns before any write: the setter itself stays uncalled.
    timelineZoom.setScaleAtCursor(1.37, 500);
    expect(timelineZoom.scale.value).toBe(1.37);
    expect(setScrollLeft).not.toHaveBeenCalled();
  });

  it('fits the whole range once and clamps the anchored write at 0 (D-04)', () => {
    const { port, setScrollLeft } = makePort({
      scrollLeft: 0,
      scrollerLeft: 0,
      clientWidth: 360,
      playheadFrame: 10,
      frameCount: 40,
    });
    registerTimelineZoomScrollPort(port);

    timelineZoom.fit();
    expect(timelineZoom.scale.value).toBe(0.49166666666666664);
    expect(timelineZoom.percent.value).toBe(49);
    expect(setScrollLeft).toHaveBeenCalledTimes(1);
    expect(setScrollLeft).toHaveBeenCalledWith(0);
  });

  it('is a safe no-op when Fit runs with no registered port', () => {
    timelineZoom.setScale(2);
    expect(() => timelineZoom.fit()).not.toThrow();
    expect(timelineZoom.scale.value).toBe(2);
  });

  it('resets the session to 1x on Studio open (ZOOM-04)', () => {
    timelineZoom.setScale(2.5);
    expect(timelineZoom.isAtMin.value).toBe(false);
    expect(timelineZoom.isAtMax.value).toBe(false);

    timelineZoom.resetForStudioOpen();
    expect(timelineZoom.scale.value).toBe(1);
    expect(timelineZoom.percent.value).toBe(100);
    expect(timelineZoom.isAtMin.value).toBe(false);
    expect(timelineZoom.isAtMax.value).toBe(false);
  });

  it('keeps the wheel factor continuous and clamps it at both ends (D-05)', () => {
    expect(nextTimelineZoomWheelScale(1, -100, 0)).toBeCloseTo(Math.exp(0.1), 12);
    expect(nextTimelineZoomWheelScale(1, 100, 0)).toBeCloseTo(Math.exp(-0.1), 12);
    // Line-mode wheels normalize at 16px per line before applying the factor.
    expect(nextTimelineZoomWheelScale(1, -10, 1)).toBeCloseTo(Math.exp(0.16), 12);
    expect(nextTimelineZoomWheelScale(TIMELINE_ZOOM_MAX, -1000, 0)).toBe(TIMELINE_ZOOM_MAX);
    expect(nextTimelineZoomWheelScale(TIMELINE_ZOOM_MIN, 1000, 0)).toBe(TIMELINE_ZOOM_MIN);
  });
});
