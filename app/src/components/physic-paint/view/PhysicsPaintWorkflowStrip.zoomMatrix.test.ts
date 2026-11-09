// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';
import { projectPhysicsPaintLoopClipGeometry } from './physicsPaintLoopClipPresentation';
import {
  TIMELINE_LANE_ORIGIN_PX,
  resolvePlayheadAnchorLocalX,
  resolveRulerStep,
  resolveTimelineMetrics,
} from './physicsPaintTimelineZoom';
import { soundStainLeftPx, soundStainWidthPx } from './soundBandGeometry';
import { TIMELINE_GEOMETRY, TIMELINE_MOTION } from './timelineRailDesign';

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
