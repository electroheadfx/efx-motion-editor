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
//  The wireframe bracket captures the user's pre-entry values —
//  wireframe AND Draft — BEFORE the shipped latch forces Draft
//  on, and a repeated arm NEVER overwrites that capture
//  (compare-then-write, D-06).
//
//  62-02 adds the exit half: ONE pure `resolveCurveExitAction`
//  pins every exit (restore the user's own wireframe, settle a
//  dirty Draft exactly once, or leave Draft directly), and
//  `endCurveBracket` performs it. The held fit is dropped FIRST;
//  no exit without a committed gesture ever bakes behind the
//  user's own construction view (D-14, T-62-08).
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
import {
  draftMode,
  draftPixelsDirty,
  setDraftMode,
  setWireframeMode,
  wireframeMode,
} from './scriptStrokeEdition';

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

/** The user's pre-entry VIEW state — captured before the wireframe latch forces Draft on. */
export interface CurveEntrySnapshot {
  readonly wireframe: boolean;
  readonly draft: boolean;
}

/** The pre-entry capture, or null while no bracket is open. */
export const curveEntrySnapshot = signal<CurveEntrySnapshot | null>(null);

/** The pure exit decision: restore the wireframe, settle the Draft, or leave Draft. */
export interface CurveExitAction {
  readonly restore: boolean;
  readonly settle: boolean;
  readonly leaveDraft: boolean;
}

/** The three facts an exit resolves from: the capture and the live dirty flag. */
export interface CurveExitState {
  readonly preWireframe: boolean;
  readonly preDraft: boolean;
  readonly dirty: boolean;
}

/**
 * Resolve what an exit must do — the five pinned cases (D-06, D-14, T-62-08):
 * a dirty Draft can only leave through the shipped settle or stay behind the
 * user's own wireframe; a clean exit restores exactly the pre-entry view.
 */
export function resolveCurveExitAction(state: CurveExitState): CurveExitAction {
  if (state.dirty) {
    return state.preWireframe
      ? { restore: true, settle: false, leaveDraft: false }
      : { restore: false, settle: true, leaveDraft: false };
  }
  if (state.preWireframe) return { restore: true, settle: false, leaveDraft: false };
  if (state.preDraft) return { restore: false, settle: false, leaveDraft: false };
  return { restore: false, settle: false, leaveDraft: true };
}

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
 * CR-01: true between the start of a teardown's settle await and its tail.
 * A bracket opening inside that window TAKES OVER the capture rather than
 * inheriting it, so the settling teardown can no longer clear the newcomer's
 * capture by identity — while the newcomer still inherits the ORIGINAL
 * pre-entry values, so the user's own wireframe/Draft setting survives the
 * overlap instead of being replaced by the teardown's intermediate state.
 */
let curveBracketReleasing = false;

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

/** Drop the bracket capture. An already-empty capture notifies nothing. */
export function clearCurveEntrySnapshot(): void {
  writeIfChanged(curveEntrySnapshot, null);
}

/**
 * Open the painted-curve wireframe bracket: capture the user's current
 * wireframe AND Draft values FIRST — before the shipped latch forces Draft
 * on — then turn the construction view on. Returns the captured pre-entry
 * wireframe value.
 *
 * A repeated arm never overwrites the capture, so a nested open cannot
 * lose the user's own setting (T-62-04, compare-then-write).
 */
export function beginCurveWireframeBracket(): boolean {
  const held = curveEntrySnapshot.peek();
  const snapshot = held === null || curveBracketReleasing
    ? {
        wireframe: held === null ? wireframeMode.peek() : held.wireframe,
        draft: held === null ? draftMode.peek() : held.draft,
      }
    : held;
  if (snapshot !== held) curveEntrySnapshot.value = snapshot;
  setWireframeMode(true);
  return snapshot.wireframe;
}

/**
 * Close the curve bracket. No-op while no capture is open (compare-then-write,
 * no notify). Order is the contract: read the action, drop the held fit FIRST,
 * clear the construction latch, then apply exactly one of leave-Draft / settle,
 * restore the user's own wireframe, and clear the capture last (T-62-08).
 */
export async function endCurveBracket(options: {
  // 62-04: the Studio's ONE production registration hands in the shipped
  // single-flight `settleDraftScript`, which resolves boolean — `unknown`
  // admits it while the bracket still awaits the real settle before restoring.
  readonly settle: () => void | Promise<unknown>;
}): Promise<void> {
  const snapshot = curveEntrySnapshot.peek();
  if (snapshot === null) return;
  const action = resolveCurveExitAction({
    preWireframe: snapshot.wireframe,
    preDraft: snapshot.draft,
    dirty: draftPixelsDirty.peek(),
  });
  clearCurveFitSession();
  setWireframeMode(false);
  if (action.leaveDraft) setDraftMode(false);
  // CR-01/WR-01: the tail runs in `finally` and every write is identity-guarded,
  // so a rejected settle cannot strand the teardown and a bracket that opened
  // during the await keeps its own capture.
  curveBracketReleasing = true;
  try {
    if (action.settle) await options.settle();
  } finally {
    curveBracketReleasing = false;
    if (curveEntrySnapshot.peek() === snapshot) {
      if (action.restore) setWireframeMode(true);
      clearCurveEntrySnapshot();
    }
  }
}
