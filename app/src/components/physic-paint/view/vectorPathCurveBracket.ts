// ============================================================
//  62-01 — the session-only held fit and the wireframe entry
//  bracket for the painted-stroke conversion (D-03, D-06).
//
//  ENTRY HOLDS, NOTHING COMMITS: `beginPaintedCurveSession` fits
//  the stroke's OWN recorded samples into `auto` anchors and leaves
//  them in a module signal. No document, revision, payload or
//  ledger write happens here — the ONE script write the first
//  committed gesture performs is the conversion (D-03).
//
//  The wireframe bracket captures the user's pre-entry wireframe
//  value BEFORE the shipped latch forces Draft on, and a repeated
//  arm NEVER overwrites that capture (compare-then-write).
//
//  PURITY: this module imports the pure fitter, the dependency-free
//  session latches and `view/scriptStrokeEdition` ONLY. It reads no
//  document store, imports no payload codec, engine or save path
//  (T-62-04). Preact reactivity: compare-then-write on every
//  writer, `.peek()` in handlers, never a render-body write.
// ============================================================
import { signal } from '@preact/signals';
import type {
  AquarelleAnchor,
  AquarellePoint,
  AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import { writeIfChanged } from './vectorPathLatches';
import { fitVectorPathAnchors } from './vectorPathFit';
import { setWireframeMode, wireframeMode } from './scriptStrokeEdition';

/** The held, uncommitted fit for one painted stroke. */
export interface PaintedCurveSession {
  /** The stroke the fit belongs to. */
  readonly mutationId: number;
  /** Fitted `auto` anchors, every one placed ON a recorded sample. */
  readonly anchors: readonly AquarelleAnchor[];
  /** The stroke's own recorded samples — no copy, the fit read them. */
  readonly sourcePoints: readonly AquarellePoint[];
}

/** The session-only held fit, or null while no painted stroke is armed. */
export const curveFitSession = signal<PaintedCurveSession | null>(null);

/** The user's pre-entry wireframe value, or null while no bracket is open. */
export const curveWireframeRestore = signal<boolean | null>(null);

function sameAnchors(
  left: readonly AquarelleAnchor[],
  right: readonly AquarelleAnchor[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (a.x !== b.x || a.y !== b.y || a.kind !== b.kind) return false;
  }
  return true;
}

function sameSession(a: PaintedCurveSession, b: PaintedCurveSession): boolean {
  return a.mutationId === b.mutationId
    && a.sourcePoints === b.sourcePoints
    && sameAnchors(a.anchors, b.anchors);
}

/**
 * Fit a painted stroke's own recorded samples and hold the result.
 *
 * Returns null when there is nothing to fit — fewer than two distinct
 * finite samples, or a stroke that already carries anchors (the fit is
 * for painted strokes only). A repeated arm of the SAME stroke returns
 * the ONE held session object: compare-then-write, no notification.
 */
export function beginPaintedCurveSession(stroke: AquarelleStroke): PaintedCurveSession | null {
  const candidate = stroke as { readonly mutationId?: unknown; readonly anchors?: unknown } | null;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const { mutationId } = candidate;
  if (typeof mutationId !== 'number' || !Number.isFinite(mutationId)) return null;
  const existingAnchors = candidate.anchors;
  if (Array.isArray(existingAnchors) && existingAnchors.length > 0) return null;

  const sourcePoints = (stroke as { readonly points?: unknown }).points;
  if (!Array.isArray(sourcePoints)) return null;
  const anchors = fitVectorPathAnchors(sourcePoints as readonly AquarellePoint[]);
  if (anchors.length < 2) return null;

  const next: PaintedCurveSession = { mutationId, anchors, sourcePoints };
  const held = curveFitSession.peek();
  if (held !== null && sameSession(held, next)) return held;
  curveFitSession.value = next;
  return next;
}

/** Drop the held fit. An already-empty session notifies nothing. */
export function clearCurveFitSession(): void {
  writeIfChanged(curveFitSession, null);
}

/** Drop the wireframe bracket capture. An already-empty capture notifies nothing. */
export function clearCurveWireframeRestore(): void {
  writeIfChanged(curveWireframeRestore, null);
}

/**
 * Open the painted-curve wireframe bracket: capture the user's current
 * wireframe value FIRST — before the shipped latch forces Draft on — then
 * turn the construction view on. Returns the captured pre-entry value.
 *
 * A repeated arm never overwrites the capture, so a nested open cannot
 * lose the user's own setting (T-62-04, compare-then-write).
 */
export function beginCurveWireframeBracket(): boolean {
  let restore = curveWireframeRestore.peek();
  if (restore === null) {
    restore = wireframeMode.peek();
    curveWireframeRestore.value = restore;
  }
  setWireframeMode(true);
  return restore;
}
