// ============================================================
//  aquarelleStrokeSelection — Water color stroke select mode
//  (quick 261022-pim Task 1).
//
//  Select mode is the rail Move/Select toggle OR a held Cmd/Meta
//  (temporaryMove). While active the overlay above the vendor
//  canvas outlines every recorded stroke of the CURRENT edit
//  frame, and a click selects the newest stroke under the
//  pointer. Selection is written in the pointer handler — never
//  an effect (efx-preact-reactivity).
//
//  Coordinates cross from document UV to canvas pixels through
//  aquarelleUvToEnginePixel (the ONE bridge) so an outlined
//  stroke and the delete target can never disagree.
//
//  Signals are read only by narrow leaves (the overlay and the
//  rail toggle), never the Studio render body.
// ============================================================

import { computed, signal } from '@preact/signals';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleUvToEnginePixel,
  type EnginePixelSize,
} from '../engine/aquarelleStrokeBridge';
import {
  aquarelleStrokesRevision,
  getRecordedAquarelleStrokeEntries,
  isAquarelleStrokeDeleted,
} from './aquarelleRecordState';

/** Long polylines are decimated for rendering only (bounds use every point). */
const MAX_POLYLINE_POINTS = 96;

/** Minimum hit/bounds pad — below this the outline of a thin pen is unclickable. */
const MIN_STROKE_PAD_PX = 6;

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface AquarelleStrokeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectableAquarelleStroke {
  mutationId: number;
  pointsPx: CanvasPoint[];
  bounds: AquarelleStrokeBounds;
}

/** Rail Move/Select toggle. Compare-then-write. */
export const aquarelleSelectMode = signal(false);

/** The highlighted stroke (null = nothing selected). Compare-then-write. */
export const aquarelleSelectedStrokeMutationId = signal<number | null>(null);

export function selectAquarelleStroke(mutationId: number | null): void {
  if (aquarelleSelectedStrokeMutationId.value === mutationId) return;
  aquarelleSelectedStrokeMutationId.value = mutationId;
}

export function setAquarelleSelectMode(on: boolean): void {
  if (aquarelleSelectMode.value === on) return;
  aquarelleSelectMode.value = on;
  // Leaving select mode drops the highlight so a later re-arm starts clean.
  if (!on) selectAquarelleStroke(null);
}

export function toggleAquarelleSelectMode(): void {
  setAquarelleSelectMode(!aquarelleSelectMode.value);
}

/**
 * Session-wide non-deleted stroke count — the rail toggle's enable gate.
 * Selection/outlining stay frame-scoped; the rail has no frame prop, so this
 * coarse gate only answers "is there anything to select".
 */
export const aquarelleLiveStrokeCount = computed<number>(() => {
  void aquarelleStrokesRevision.value;
  let count = 0;
  for (const mutationId of getRecordedAquarelleStrokeEntries().keys()) {
    if (!isAquarelleStrokeDeleted(mutationId)) count += 1;
  }
  return count;
});

/** Map every recorded point through the ONE UV → canvas-pixel bridge. */
export function aquarelleStrokePointsPx(
  stroke: AquarelleStroke,
  size: EnginePixelSize,
): CanvasPoint[] {
  return stroke.points.map((point) => aquarelleUvToEnginePixel(point, size));
}

/** Brush radius in canvas px, floored so a hairline pen stays clickable. */
function strokeRadiusPx(stroke: AquarelleStroke): number {
  const declared = Number(stroke.params['size']);
  return Number.isFinite(declared) && declared > 0
    ? Math.max(MIN_STROKE_PAD_PX, declared / 2)
    : MIN_STROKE_PAD_PX;
}

/** Bounding box inflated by half the brush size on every side. */
export function aquarelleStrokeBoundsPx(
  points: readonly CanvasPoint[],
  brushSize: number,
): AquarelleStrokeBounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const pad =
    Number.isFinite(brushSize) && brushSize > 0
      ? Math.max(MIN_STROKE_PAD_PX, brushSize / 2)
      : MIN_STROKE_PAD_PX;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function distanceToSegmentPx(
  px: number,
  py: number,
  a: CanvasPoint,
  b: CanvasPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq),
  );
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function hitsStroke(
  pointPx: CanvasPoint,
  pointsPx: readonly CanvasPoint[],
  radius: number,
): boolean {
  if (pointsPx.length === 0) return false;
  if (pointsPx.length === 1) {
    return Math.hypot(pointPx.x - pointsPx[0]!.x, pointPx.y - pointsPx[0]!.y) <= radius;
  }
  for (let index = 1; index < pointsPx.length; index += 1) {
    if (
      distanceToSegmentPx(
        pointPx.x,
        pointPx.y,
        pointsPx[index - 1]!,
        pointsPx[index]!,
      ) <= radius
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Newest-first hit-test: when ribbons overlap, the last recorded stroke wins.
 * Frame-scoped and deleted-scoped — an invisible stroke can never be the
 * delete target.
 */
export function hitTestAquarelleStroke(
  pointPx: CanvasPoint,
  playFrame: number,
  size: EnginePixelSize,
): number | null {
  void aquarelleStrokesRevision.value;
  const entries = Array.from(getRecordedAquarelleStrokeEntries().entries()).reverse();
  for (const [mutationId, stroke] of entries) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    if (hitsStroke(pointPx, pointsPx, strokeRadiusPx(stroke))) return mutationId;
  }
  return null;
}

/** Hit-test then select — the pointer handler's ONE selection write. */
export function selectAquarelleStrokeAt(
  pointPx: CanvasPoint,
  playFrame: number,
  size: EnginePixelSize,
): number | null {
  const hit = hitTestAquarelleStroke(pointPx, playFrame, size);
  selectAquarelleStroke(hit);
  return hit;
}

function decimatePoints(points: readonly CanvasPoint[]): CanvasPoint[] {
  if (points.length <= MAX_POLYLINE_POINTS) return [...points];
  const out: CanvasPoint[] = [];
  for (let index = 0; index < MAX_POLYLINE_POINTS; index += 1) {
    const sourceIndex = Math.round(
      (index * (points.length - 1)) / (MAX_POLYLINE_POINTS - 1),
    );
    out.push(points[sourceIndex]!);
  }
  return out;
}

/**
 * Every selectable stroke of the frame in recording order. Reads the
 * revision so a narrow leaf re-renders when the stroke set changes.
 */
export function listSelectableAquarelleStrokes(
  playFrame: number,
  size: EnginePixelSize,
): SelectableAquarelleStroke[] {
  void aquarelleStrokesRevision.value;
  const out: SelectableAquarelleStroke[] = [];
  for (const [mutationId, stroke] of getRecordedAquarelleStrokeEntries()) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    out.push({
      mutationId,
      pointsPx: decimatePoints(pointsPx),
      // Bounds use every point — decimation must never clip the box ends.
      bounds: aquarelleStrokeBoundsPx(pointsPx, Number(stroke.params['size'])),
    });
  }
  return out;
}
