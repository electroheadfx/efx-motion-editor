/**
 * Rail-motion pivot (Phase 59-08, D-17).
 *
 * Rotation and scale must pivot on a STABLE rail-space centre — the union of
 * the rail's drawing-key ink bounds — never on the per-frame raster bounds
 * (which move as the composited frame changes, making the rail wobble under its
 * own rotation). The pivot is therefore a function of the rail's drawing-key
 * rasters plus the raster frame size only: never the evaluated frame, the loop
 * occurrence, or the evaluated transform.
 *
 * This module is PURE: it performs no canvas access, imports no store, and
 * never imports the evaluator. The caller injects a `measure` function; the
 * production measurer lives in the store (it owns the decoded raster registry
 * and the bounded offscreen scan). Memoization is keyed by
 * `railId + contentRevision` — the caller passes the PIXEL-IDENTITY (raster)
 * revision, so a motion-only edit cannot re-measure a single key.
 *
 * Cost (Gate D): one bounded resolution per rail revision; every later call is
 * a memo hit with zero measures. The production scan is downsampled to a
 * 256px long edge, so decoded-raster draw cost dominates the alpha pass.
 */

/** One ink bounding box in NORMALIZED raster coordinates (0..1). */
export interface RailMotionInkBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * One measured drawing key. `alphaInk: false` means the alpha scan found no
 * ink — such a key contributes NO bounds (a full-frame box would drag the
 * centre back to the raster centre and erase the union's meaning).
 */
export interface RailMotionMeasuredInk extends RailMotionInkBounds {
  readonly alphaInk: boolean;
}

/** `measure` is injected: the module never touches a canvas of its own. */
export type RailMotionPivotMeasurer<TSource> = (
  source: TSource,
) => RailMotionMeasuredInk | null;

/** The raster centre — the documented fallback when no key carries ink. */
export const RAIL_MOTION_PIVOT_FALLBACK = Object.freeze({ x: 0.5, y: 0.5 }) as {
  readonly x: number;
  readonly y: number;
};

export interface RailMotionPivot {
  readonly pivotX: number;
  readonly pivotY: number;
  /** false → the fallback was used (no keys, no ink, or decode unavailable). */
  readonly measured: boolean;
}

/**
 * 261107-tfp: one rail source paired with the drawing-key identity it belongs
 * to. The pivot only needs the raster (`source`), but the canvas boundary box
 * sizes itself on the DISPLAYED key, so the memo keeps a per-key view of the
 * same measurement. `measure` still receives the `source` member.
 */
export interface RailMotionInkSource<TSource> {
  readonly keyId: string;
  readonly source: TSource;
}

export interface ResolveRailMotionPivotInput<TSource> {
  readonly railId: string;
  /**
   * The PIXEL-IDENTITY revision of the rail's content (59-07's raster
   * revision), never the canonical revision: animating a rail paints nothing,
   * so motion edits must not invalidate a pivot measurement.
   */
  readonly contentRevision: string;
  /** The rail's drawing-key rasters, in any order. */
  readonly sources: readonly RailMotionInkSource<TSource>[];
  readonly measure: RailMotionPivotMeasurer<TSource>;
}

/**
 * Bounded memo (T-59-24): one small entry per rail revision. FIFO eviction
 * keeps a long editing session from growing the map without bound; an evicted
 * rail simply re-measures once.
 *
 * 261107-tfp: the entry carries BOTH views of the same measurement — the union
 * pivot (59-08) and the per-key ink boxes the boundary box consumes — so the
 * gizmo adds no second alpha scan.
 */
const RAIL_MOTION_PIVOT_MEMO_MAX = 512;
interface RailMotionInkCacheEntry {
  readonly pivot: RailMotionPivot;
  readonly boxes: ReadonlyMap<string, RailMotionInkBounds>;
}
const _railMotionPivotMemo = new Map<string, RailMotionInkCacheEntry>();

/** Test-only: keeps pivot memo assertions order-independent. */
export function __resetRailMotionPivotMemoForTests(): void {
  _railMotionPivotMemo.clear();
}

function clampUnit(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Unions every non-empty ink box and returns the centre of the union, in
 * normalized raster coordinates. Degenerate (zero/negative size) or
 * non-finite boxes are ignored; when nothing remains the raster centre
 * fallback is returned.
 */
export function computeRailInkBounds(
  bounds: readonly RailMotionInkBounds[],
): { readonly x: number; readonly y: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of bounds) {
    if (
      !Number.isFinite(box.x)
      || !Number.isFinite(box.y)
      || !Number.isFinite(box.width)
      || !Number.isFinite(box.height)
    ) {
      continue;
    }
    if (box.width <= 0 || box.height <= 0) continue;
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return RAIL_MOTION_PIVOT_FALLBACK;
  }
  return Object.freeze({
    x: clampUnit((minX + maxX) / 2),
    y: clampUnit((minY + maxY) / 2),
  });
}

/**
 * The ONE measurement pass per `railId + contentRevision`. It fills the pivot
 * and the per-key boxes together, so the two views can never re-measure each
 * other's sources.
 */
function resolveRailMotionInkEntry<TSource>(
  input: ResolveRailMotionPivotInput<TSource>,
): RailMotionInkCacheEntry {
  const memoKey = `${input.railId}:${input.contentRevision}`;
  const cached = _railMotionPivotMemo.get(memoKey);
  if (cached !== undefined) return cached;

  const boxes = new Map<string, RailMotionInkBounds>();
  for (const source of input.sources) {
    const measured = input.measure(source.source);
    // `null` = decode unavailable — a legitimate fallback, not an error.
    if (measured === null) continue;
    if (!measured.alphaInk) continue;
    // The per-key box is the measured rect WITHOUT the alpha flag: the map's
    // membership already means "this key carries ink".
    boxes.set(source.keyId, Object.freeze({
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: measured.height,
    }));
  }
  const centre = computeRailInkBounds([...boxes.values()]);
  const entry: RailMotionInkCacheEntry = Object.freeze({
    pivot: Object.freeze({
      pivotX: centre.x,
      pivotY: centre.y,
      measured: boxes.size > 0,
    }),
    boxes,
  });
  if (_railMotionPivotMemo.size >= RAIL_MOTION_PIVOT_MEMO_MAX) {
    const oldest = _railMotionPivotMemo.keys().next();
    if (!oldest.done) _railMotionPivotMemo.delete(oldest.value);
  }
  _railMotionPivotMemo.set(memoKey, entry);
  return entry;
}

/**
 * Resolves the rail pivot for one `railId + contentRevision`, measuring each
 * source at most once per revision. The second call for the same key performs
 * ZERO measurements — the property that makes the per-frame draw path cheap.
 */
export function resolveRailMotionPivot<TSource>(
  input: ResolveRailMotionPivotInput<TSource>,
): RailMotionPivot {
  return resolveRailMotionInkEntry(input).pivot;
}

/**
 * 261107-tfp: the per-key ink boxes for one `railId + contentRevision`, served
 * from the SAME memo entry {@link resolveRailMotionPivot} populates. Only keys
 * whose alpha scan found ink appear; a blank or undecodable key is absent (its
 * caller falls back to the full-raster box).
 */
export function resolveRailMotionKeyInkBounds<TSource>(
  input: ResolveRailMotionPivotInput<TSource>,
): ReadonlyMap<string, RailMotionInkBounds> {
  return resolveRailMotionInkEntry(input).boxes;
}

/**
 * 261107-tfp: unions the given ink boxes into one normalized box. Non-finite
 * and degenerate boxes are ignored; when nothing remains the result is null.
 * The union is NOT clamped to 0..1 — the caller works in painter space and the
 * pivot helper keeps its own clamp.
 */
export function unionRailInkBoxes(
  bounds: readonly RailMotionInkBounds[],
): RailMotionInkBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of bounds) {
    if (
      !Number.isFinite(box.x)
      || !Number.isFinite(box.y)
      || !Number.isFinite(box.width)
      || !Number.isFinite(box.height)
    ) {
      continue;
    }
    if (box.width <= 0 || box.height <= 0) continue;
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return Object.freeze({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  });
}
