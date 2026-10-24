// ============================================================
//  scriptStrokeEdition — the ONE script-edition seam shared by
//  the Water color select surface and the Brush Move surface
//  (quick 261023-g4p Task 2).
//
//  One selection signal, one drag signal, one geometry law, and
//  one keyboard consume law serve both modules. The watercolor
//  module re-exports the same signal objects by identity, so an
//  existing consumer can never diverge from the shared state.
//
//  SIGNAL DISCIPLINE (efx-preact-reactivity):
//    - every setter is compare-then-write;
//    - the keyboard helpers read `.peek()` only — they never
//      subscribe a render body;
//    - the signals are read by narrow leaves (the overlays and the
//      rail), never the Studio render body.
//
//  The port is a plain module variable (render-body ref-style
//  write), never a signal. The Studio registers the port for the
//  active module; a port that reports inactive refuses every key.
// ============================================================

import { computed, signal } from '@preact/signals';
import type { ScriptStrokeTransform } from './scriptStrokeTransform';

/** The shared transform type — adapters import it from here, never redeclare it. */
export type { ScriptStrokeTransform } from './scriptStrokeTransform';

/** Long polylines are decimated for rendering only (bounds use every point). */
export const MAX_POLYLINE_POINTS = 96;

/** Minimum hit/bounds pad — below this the outline of a thin pen is unclickable. */
export const MIN_STROKE_PAD_PX = 6;

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ScriptStrokeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Canvas size the stroke point space is measured in (Studio working pixels). */
export interface ScriptStrokeSize {
  width: number;
  height: number;
}

export interface SelectableScriptStroke {
  mutationId: number;
  pointsPx: CanvasPoint[];
  bounds: ScriptStrokeBounds;
  /** 261022-ujp: creation-order id, stable across restack/delete. */
  serial: number;
  /** 261022-ujp: 1-based position from the TOP of the paint stack. */
  stackPosition: number;
  /** 261022-ujp: number of strokes in this frame's stack. */
  stackTotal: number;
  /** 261022-ujp: the stroke's own colour — the selected box and badge wear it. */
  color: string;
}

/** Rail Move/Select toggle. Compare-then-write. */
export const scriptSelectMode = signal(false);

/**
 * The highlighted strokes (261024-mz5: one SET, not a single id).
 * Compare-then-write on membership — an identical membership never
 * allocates a new Set nor notifies a subscriber.
 */
export const scriptSelectedStrokeIds = signal<ReadonlySet<number>>(new Set());

/**
 * The single-id view of the selection: the id when exactly ONE stroke is
 * selected, else null. Existing single-stroke consumers (badges, the
 * watercolor alias) read this computed instead of a raw signal, so they
 * keep the original notify-only-on-change law.
 */
export const scriptSelectedStrokeId = computed<number | null>(() => {
  const ids = scriptSelectedStrokeIds.value;
  if (ids.size !== 1) return null;
  return ids.values().next().value ?? null;
});

function sameSelection(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of b) {
    if (!a.has(id)) return false;
  }
  return true;
}

/** Replace the selection with any iterable of ids. Compare-then-write. */
export function setScriptStrokeSelection(ids: Iterable<number>): void {
  const next = new Set<number>();
  for (const id of ids) {
    if (Number.isFinite(id)) next.add(id);
  }
  if (sameSelection(scriptSelectedStrokeIds.value, next)) return;
  scriptSelectedStrokeIds.value = next;
}

/** Replace the selection with one stroke (or clear it). Compare-then-write. */
export function selectScriptStroke(mutationId: number | null): void {
  setScriptStrokeSelection(mutationId === null ? [] : [mutationId]);
}

/** Add the id when absent, remove it when present. Compare-then-write. */
export function toggleScriptStrokeSelection(mutationId: number): void {
  const current = scriptSelectedStrokeIds.value;
  const next = new Set(current);
  if (next.has(mutationId)) next.delete(mutationId);
  else next.add(mutationId);
  if (sameSelection(current, next)) return;
  scriptSelectedStrokeIds.value = next;
}

/** Idempotent clear — an empty selection never notifies. */
export function clearScriptStrokeSelection(): void {
  if (scriptSelectedStrokeIds.value.size === 0) return;
  scriptSelectedStrokeIds.value = new Set();
}

export function setScriptSelectMode(on: boolean): void {
  if (scriptSelectMode.value === on) return;
  scriptSelectMode.value = on;
  // Leaving select mode drops the selection and any in-flight ghost/preview
  // so a later re-arm starts clean (compare-then-write clear).
  if (!on) {
    clearScriptStrokeSelection();
    clearScriptStrokeDrag();
    clearScriptStrokeTransform();
  }
}

/**
 * The live drag preview. Written in the overlay's pointer handlers, read
 * ONLY by that overlay leaf (the ghost). No Studio or layer render body
 * subscribes to it — no script mutation or apply happens while a drag is
 * in progress.
 */
export interface ScriptStrokeDrag {
  /** Every stroke the gesture moves (one id for a single-stroke drag). */
  readonly mutationIds: readonly number[];
  readonly dxPx: number;
  readonly dyPx: number;
}

export const scriptStrokeDrag = signal<ScriptStrokeDrag | null>(null);

function sameIdList(a: readonly number[], b: readonly number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/** Compare-then-write on the id list and the delta (rule 3). */
export function setScriptStrokeDrag(next: ScriptStrokeDrag | null): void {
  const current = scriptStrokeDrag.value;
  if (next === null) {
    if (current === null) return;
    scriptStrokeDrag.value = null;
    return;
  }
  if (
    current !== null
    && sameIdList(current.mutationIds, next.mutationIds)
    && current.dxPx === next.dxPx
    && current.dyPx === next.dyPx
  ) {
    return;
  }
  scriptStrokeDrag.value = {
    mutationIds: [...next.mutationIds],
    dxPx: next.dxPx,
    dyPx: next.dyPx,
  };
}

/** Idempotent clear — a pointer-up/cancel with no drag armed is a no-op. */
export function clearScriptStrokeDrag(): void {
  setScriptStrokeDrag(null);
}

/**
 * The live handle-gesture preview (261024-mz5). Written ONLY by the
 * overlay's pointer handlers and read ONLY by that overlay leaf — no
 * script mutation and no commit runs while a handle is being dragged.
 */
export interface ScriptStrokeTransformPreview extends ScriptStrokeTransform {
  /** The captured selection the gesture transforms. */
  readonly ids: readonly number[];
}

export const scriptStrokeTransform = signal<ScriptStrokeTransformPreview | null>(null);

/** Compare-then-write over the id list and every geometry field (rule 3). */
export function setScriptStrokeTransform(next: ScriptStrokeTransformPreview | null): void {
  const current = scriptStrokeTransform.value;
  if (next === null) {
    if (current === null) return;
    scriptStrokeTransform.value = null;
    return;
  }
  if (
    current !== null
    && sameIdList(current.ids, next.ids)
    && current.kind === next.kind
    && current.centerX === next.centerX
    && current.centerY === next.centerY
    && current.anchorX === next.anchorX
    && current.anchorY === next.anchorY
    && current.angleRad === next.angleRad
    && current.scaleX === next.scaleX
    && current.scaleY === next.scaleY
  ) {
    return;
  }
  scriptStrokeTransform.value = {
    ids: [...next.ids],
    kind: next.kind,
    centerX: next.centerX,
    centerY: next.centerY,
    anchorX: next.anchorX,
    anchorY: next.anchorY,
    angleRad: next.angleRad,
    scaleX: next.scaleX,
    scaleY: next.scaleY,
  };
}

/** Idempotent clear — a release/cancel with no preview armed is a no-op. */
export function clearScriptStrokeTransform(): void {
  setScriptStrokeTransform(null);
}

export function distanceToSegmentPx(
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

/** The shared hit law: segment distance, single-point radius, empty = false. */
export function hitsScriptStroke(
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

/** Bounding box inflated by half the brush size on every side. */
export function scriptStrokeBoundsPx(
  points: readonly CanvasPoint[],
  brushSize: number,
): ScriptStrokeBounds {
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

/** Evenly decimate a polyline for rendering (bounds keep every point). */
export function decimateScriptPoints(points: readonly CanvasPoint[]): CanvasPoint[] {
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
 * The per-module edition contract. Watercolor wires the list/hit functions
 * from its selection module; the brush wires the engine-backed port. The
 * Studio injects the delete/move/step callbacks.
 */
export interface ScriptStrokeEditionPort {
  /** True while this module's select surface owns the keyboard. */
  isActive(): boolean;
  listStrokes(playFrame: number, size: ScriptStrokeSize): SelectableScriptStroke[];
  hitTestStroke(pointPx: CanvasPoint, playFrame: number, size: ScriptStrokeSize): number | null;
  /** 261024-mz5: the WHOLE selection in one batch edit. */
  deleteStrokes(ids: readonly number[]): void;
  moveStrokes(ids: readonly number[], dxPx: number, dyPx: number): void;
  /** 261024-mz5 Task 2: uniform scale + rotation in ONE commit. */
  transformStrokes(ids: readonly number[], transform: ScriptStrokeTransform): void;
  stepStroke(id: number, direction: 'back' | 'forward'): void;
}

/**
 * The registered ports (plain module variable — render-body ref-style write,
 * no signal, no subscription). The Studio registers both module ports; the
 * resolver picks the one whose surface is currently active.
 */
interface ScriptStrokeEditionPorts {
  watercolor: ScriptStrokeEditionPort | null;
  brush: ScriptStrokeEditionPort | null;
}

let scriptStrokeEditionPorts: ScriptStrokeEditionPorts = { watercolor: null, brush: null };

/** Legacy single-port registration (watercolor slot) — kept for one-port callers. */
export function setScriptStrokeEditionPort(port: ScriptStrokeEditionPort | null): void {
  scriptStrokeEditionPorts = { watercolor: port, brush: null };
}

export function setScriptStrokeEditionPorts(
  ports: { watercolor?: ScriptStrokeEditionPort | null; brush?: ScriptStrokeEditionPort | null } | null,
): void {
  scriptStrokeEditionPorts = {
    watercolor: ports?.watercolor ?? null,
    brush: ports?.brush ?? null,
  };
}

/**
 * Active port wins. Both ports gate their own `isActive()` on their module
 * AND their selection state, so at most one can be active; the watercolor
 * slot is the deterministic fallback when neither is (the consume law then
 * refuses the key — no module surface owns it).
 */
export function resolveScriptStrokeEditionPort(): ScriptStrokeEditionPort | null {
  const { watercolor, brush } = scriptStrokeEditionPorts;
  if (watercolor?.isActive()) return watercolor;
  if (brush?.isActive()) return brush;
  return watercolor ?? brush;
}

/**
 * Hit-test through the port, then update the selection under the modifier
 * law: a plain hit REPLACES, an additive hit TOGGLES, a plain empty hit
 * CLEARS and an additive empty hit KEEPS the current selection.
 */
export function selectScriptStrokeAt(
  pointPx: CanvasPoint,
  playFrame: number,
  size: ScriptStrokeSize,
  port: ScriptStrokeEditionPort,
  additive = false,
): number | null {
  const hit = port.hitTestStroke(pointPx, playFrame, size);
  if (hit === null) {
    if (!additive) clearScriptStrokeSelection();
  } else if (additive) {
    toggleScriptStrokeSelection(hit);
  } else {
    selectScriptStroke(hit);
  }
  return hit;
}

/**
 * Delete the WHOLE selection in one batch call. CONSUME LAW: once a port
 * reports active and the set is non-empty, the key is consumed even when the
 * port's own operation refuses internally (physical lock, missing strokes).
 * Peek-only reads — the keyboard helper never subscribes a render body.
 */
export function deleteSelectedScriptStroke(): boolean {
  const port = resolveScriptStrokeEditionPort();
  if (!port) return false;
  if (!port.isActive()) return false;
  if (scriptSelectedStrokeIds.peek().size === 0) return false;
  const ids = [...scriptSelectedStrokeIds.peek()];
  port.deleteStrokes(ids);
  return true;
}

/**
 * Step a SINGLE selected stroke; same consume law as delete. With 2+
 * selected the key is consumed (the surface owns it) but nothing steps —
 * restacking is a one-stroke operation by design.
 */
export function stepSelectedScriptStroke(direction: 'back' | 'forward'): boolean {
  const port = resolveScriptStrokeEditionPort();
  if (!port) return false;
  if (!port.isActive()) return false;
  if (scriptSelectedStrokeIds.peek().size === 0) return false;
  // 261024-mz5: restacking is a one-stroke operation by design — a
  // multi-selection consumes the key but never steps anything.
  if (scriptSelectedStrokeIds.peek().size !== 1) return true;
  const id = scriptSelectedStrokeId.peek();
  if (id === null) return false;
  port.stepStroke(id, direction);
  return true;
}
