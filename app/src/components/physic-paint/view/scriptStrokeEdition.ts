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

import { signal } from '@preact/signals';

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

/** The highlighted stroke (null = nothing selected). Compare-then-write. */
export const scriptSelectedStrokeId = signal<number | null>(null);

export function selectScriptStroke(mutationId: number | null): void {
  if (scriptSelectedStrokeId.value === mutationId) return;
  scriptSelectedStrokeId.value = mutationId;
}

export function setScriptSelectMode(on: boolean): void {
  if (scriptSelectMode.value === on) return;
  scriptSelectMode.value = on;
  // Leaving select mode drops the highlight and any in-flight ghost so a
  // later re-arm starts clean (compare-then-write clear).
  if (!on) {
    selectScriptStroke(null);
    clearScriptStrokeDrag();
  }
}

/**
 * The live drag preview. Written in the overlay's pointer handlers, read
 * ONLY by that overlay leaf (the ghost). No Studio or layer render body
 * subscribes to it — no script mutation or apply happens while a drag is
 * in progress.
 */
export interface ScriptStrokeDrag {
  readonly mutationId: number;
  readonly dxPx: number;
  readonly dyPx: number;
}

export const scriptStrokeDrag = signal<ScriptStrokeDrag | null>(null);

/** Compare-then-write on all three fields (efx-preact-reactivity rule 3). */
export function setScriptStrokeDrag(next: ScriptStrokeDrag | null): void {
  const current = scriptStrokeDrag.value;
  if (next === null) {
    if (current === null) return;
    scriptStrokeDrag.value = null;
    return;
  }
  if (
    current !== null
    && current.mutationId === next.mutationId
    && current.dxPx === next.dxPx
    && current.dyPx === next.dyPx
  ) {
    return;
  }
  scriptStrokeDrag.value = { mutationId: next.mutationId, dxPx: next.dxPx, dyPx: next.dyPx };
}

/** Idempotent clear — a pointer-up/cancel with no drag armed is a no-op. */
export function clearScriptStrokeDrag(): void {
  setScriptStrokeDrag(null);
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
  deleteStroke(id: number): void;
  moveStroke(id: number, dxPx: number, dyPx: number): void;
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

/** Hit-test through the port, then write the one selection signal. */
export function selectScriptStrokeAt(
  pointPx: CanvasPoint,
  playFrame: number,
  size: ScriptStrokeSize,
  port: ScriptStrokeEditionPort,
): number | null {
  const hit = port.hitTestStroke(pointPx, playFrame, size);
  selectScriptStroke(hit);
  return hit;
}

/**
 * Delete the selected stroke. CONSUME LAW: once a port reports active and a
 * stroke is selected, the key is consumed even when the port's own operation
 * refuses internally (physical lock, missing stroke). Peek-only reads.
 */
export function deleteSelectedScriptStroke(): boolean {
  const port = resolveScriptStrokeEditionPort();
  if (!port) return false;
  if (!port.isActive()) return false;
  const id = scriptSelectedStrokeId.peek();
  if (id === null) return false;
  port.deleteStroke(id);
  return true;
}

/** Step the selected stroke; same consume law as delete. */
export function stepSelectedScriptStroke(direction: 'back' | 'forward'): boolean {
  const port = resolveScriptStrokeEditionPort();
  if (!port) return false;
  if (!port.isActive()) return false;
  const id = scriptSelectedStrokeId.peek();
  if (id === null) return false;
  port.stepStroke(id, direction);
  return true;
}
