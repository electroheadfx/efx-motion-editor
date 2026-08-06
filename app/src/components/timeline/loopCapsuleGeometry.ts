/**
 * Pure filmstrip-capsule geometry for the main-editor timeline (Phase 43,
 * HOLD-06). Every function is a pure derivation over the resolver's compact
 * interval record (43-02 `PhysicPaintRotoLoopRange`, surfaced on
 * `FxTrackLayout.loopCapsules`) — no store or signal imports, fully
 * unit-testable in the `getPhysicPaintRotoKeyMarkerGeometry` style.
 *
 * The capsule is a pure VIEW of the resolver derivation (D-24): placement
 * starts, boundaries, and effective durations are never recomputed here —
 * this module only maps the locked interval semantics to frame-space
 * geometry (band extents, ghost-cell grid, diagonal landing, anchor flag,
 * zoom band, badge text). Ghost cells are computed only for the visible
 * frame window at draw time (D-32).
 */

/** D-16 zoom bands: high ≥ 16px, default 8–15px, low < 8px frame widths. */
export type LoopCapsuleZoomBand = 'high' | 'default' | 'low';

export const LOOP_CAPSULE_HIGH_ZOOM_MIN_FRAME_WIDTH = 16;
export const LOOP_CAPSULE_DEFAULT_ZOOM_MIN_FRAME_WIDTH = 8;

/** D-22 zero-effective anchor flag metrics (locked approximate marker). */
export const LOOP_ANCHOR_FLAG_WIDTH_PX = 24;
export const LOOP_ANCHOR_FLAG_HEIGHT_PX = 6;

/** The interval fields capsule geometry consumes (structural subset of the
 *  resolver's `PhysicPaintRotoLoopRange` / the layout's `TimelineLoopCapsule`). */
export interface LoopCapsuleGeometryInterval {
  readonly placementStart: number;
  readonly cycleLength: number;
  readonly effectiveEnd: number;
  readonly truncated: boolean;
  readonly partialCycle: boolean;
}

/** One visible repetition cell (ghost cell at high zoom). Frames are
 *  layer-local; `endFrame` is exclusive and clipped at the effective end.
 *  `repeatInstance` is 1-based — instance 0 is the source cycle itself. */
export interface LoopCapsuleGhostCell {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly repeatInstance: number;
}

/** One first-cycle presentation frame (placement/source identity, D-15). */
export interface LoopCapsuleFirstCycleCellFrame {
  readonly index: number;
  readonly frame: number;
}

export interface LoopCapsuleAnchorFlagGeometry {
  readonly frame: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface LoopCapsuleViewTransform {
  readonly inFrame: number;
  readonly frameWidth: number;
  readonly scrollX: number;
  readonly headerWidth: number;
}

/** D-19 locked compact math badge. Finite: `Cycle {N}f × {R} = {D}f` (the
 *  single-cycle form `Cycle {N}f × 1 = {N}f` falls out of the same formula).
 *  Infinity: `Cycle {N}f × ∞` — never a numeric or spelled-out suffix. */
export function badgeTextForLoop(input: { cycleLength: number; repeat: number | 'infinity' }): string {
  if (input.repeat === 'infinity') return `Cycle ${input.cycleLength}f × ∞`;
  return `Cycle ${input.cycleLength}f × ${input.repeat} = ${input.cycleLength * input.repeat}f`;
}

/** D-16 zoom-band selection (prescriptive thresholds). */
export function zoomBandForFrameWidth(frameWidth: number): LoopCapsuleZoomBand {
  if (frameWidth >= LOOP_CAPSULE_HIGH_ZOOM_MIN_FRAME_WIDTH) return 'high';
  if (frameWidth >= LOOP_CAPSULE_DEFAULT_ZOOM_MIN_FRAME_WIDTH) return 'default';
  return 'low';
}

/** D-08/D-22: a boundary landing exactly at the placement start yields
 *  Effective = 0f; the loop survives as the anchor-flag marker. */
export function isZeroEffectiveLoop(interval: LoopCapsuleGeometryInterval): boolean {
  return interval.effectiveEnd <= interval.placementStart;
}

/** The repetition region begins at placementStart + cycleLength — never at
 *  placementStart (the source cycle occupies the first cycle, D-24). */
export function repetitionRegionStartFrame(interval: LoopCapsuleGeometryInterval): number {
  return interval.placementStart + interval.cycleLength;
}

/** Ghost-cell grid over the repetition region, restricted to the visible
 *  frame window [visibleStartFrame, visibleEndFrame). O(visible cells) —
 *  never a duration-sized structure, even for capacity-bounded infinity
 *  intervals (D-32). The trailing cell clips at the effective end. */
export function visibleGhostCells(
  interval: LoopCapsuleGeometryInterval,
  visibleStartFrame: number,
  visibleEndFrame: number,
): LoopCapsuleGhostCell[] {
  const regionStart = repetitionRegionStartFrame(interval);
  const regionEnd = Math.min(interval.effectiveEnd, visibleEndFrame);
  if (regionEnd <= regionStart) return [];
  // First cell whose END crosses the window start intersects the window.
  const firstIndex = Math.max(0, Math.floor((visibleStartFrame - regionStart) / interval.cycleLength));
  const cells: LoopCapsuleGhostCell[] = [];
  for (let index = firstIndex; ; index++) {
    const startFrame = regionStart + index * interval.cycleLength;
    if (startFrame >= regionEnd) break;
    cells.push({
      startFrame,
      endFrame: Math.min(startFrame + interval.cycleLength, interval.effectiveEnd),
      repeatInstance: index + 1,
    });
  }
  return cells;
}

/** D-21 truncation diagonal landing frame (fractional frames allowed —
 *  a partial-cycle landing is the MIDPOINT of the cell containing the last
 *  presented frame). Complete cycles land exactly on the cycle boundary at
 *  the effective end; low zoom always lands on the band end. Returns null
 *  when there is nothing to mark (untruncated, or zero-effective — the
 *  D-22 anchor flag carries that marker). */
export function truncationDiagonalFrame(
  interval: LoopCapsuleGeometryInterval,
  band: LoopCapsuleZoomBand,
): number | null {
  if (!interval.truncated || isZeroEffectiveLoop(interval)) return null;
  if (band === 'low') return interval.effectiveEnd;
  if (!interval.partialCycle) return interval.effectiveEnd;
  const lastPresentedFrame = interval.effectiveEnd - 1;
  const cellStart = interval.placementStart
    + Math.floor((lastPresentedFrame - interval.placementStart) / interval.cycleLength) * interval.cycleLength;
  return cellStart + interval.cycleLength / 2;
}

/** D-22 anchor flag: pinned at the placement start, 24px wide hit basis,
 *  ~6px-high pill. */
export function anchorFlagGeometry(interval: LoopCapsuleGeometryInterval): LoopCapsuleAnchorFlagGeometry {
  return {
    frame: interval.placementStart,
    widthPx: LOOP_ANCHOR_FLAG_WIDTH_PX,
    heightPx: LOOP_ANCHOR_FLAG_HEIGHT_PX,
  };
}

/** First-cycle presentation frames: one per source-cycle frame, starting at
 *  the placement start (placement/source identity — presentation frames are
 *  placement-derived, never source-key-derived, D-24/D-30). */
export function firstCycleCellFrames(interval: LoopCapsuleGeometryInterval): LoopCapsuleFirstCycleCellFrame[] {
  const cells: LoopCapsuleFirstCycleCellFrame[] = [];
  for (let index = 0; index < interval.cycleLength; index++) {
    cells.push({ index, frame: interval.placementStart + index });
  }
  return cells;
}

/** Layer-local frame → canvas x, mirroring the FX coordinate math used by
 *  `getPhysicPaintRotoKeyMarkerGeometry`: (inFrame + frame) * frameWidth -
 *  scrollX + headerWidth. */
export function loopCapsuleFrameToX(frame: number, view: LoopCapsuleViewTransform): number {
  return (view.inFrame + frame) * view.frameWidth - view.scrollX + view.headerWidth;
}
