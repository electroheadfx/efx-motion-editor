// ============================================================
//  brushScriptHydration — the in-session navigation rehydration
//  policy (quick 261023-h9v).
//
//  Navigation flushes the outgoing frame into the session store,
//  calls engine.clear(), then loads the destination's cached
//  pixels. This module is the ONE seam that may instead restore a
//  COMPLETE retained script straight into the engine, replacing
//  the cached-pixel path (no double paint).
//
//  FAIL-CLOSED: every refusal keeps today's cached-pixel path and
//  never touches the engine. Refusals:
//    no-entry   — the frame was never captured this session;
//    empty      — the captured projection has no strokes;
//    partial    — a cached pixel base sits under the session script
//                 (restoring it would delete the base pixels);
//    generated  — only a REAL key may hydrate (generated / none /
//                 no-launch destinations always repaint pixels);
//    watercolor — the aquarelle sheet owns its own record store;
//    playback / scrub — a moving playhead must never pause to
//                 replay a retained script;
//    budget     — the restore cost exceeds the documented ceiling.
//
//  The module is DOM-free: the engine is a structural interface so
//  unit suites can pin the policy without importing EfxPaintEngine.
// ============================================================

import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import type { RecordedStrokeGroup } from './recordedStrokeGroups';
import {
  flushBrushScriptFrame,
  getBrushScriptFrameEntry,
  markBrushScriptFrameDirty,
  type BrushScriptFrameEntry,
} from './brushScriptRecordState';

/**
 * MEASURED replay budget (quick 261023-h9v Task 3, 2026-10-23). The restore
 * replays synchronously through the engine harness (mock canvas, real
 * redrawAll). Costs at 1920x1080 — the largest supported working canvas:
 *
 *   point replay: 10x60 = 233 ms, 25x90 = 601 ms, 40x180 = 1102 ms,
 *                 40x600 (24000 pts) = 1492 ms;
 *   per-stroke fixed cost ~17.5 ms (the full-frame saved-wet scan in
 *                 applyStrokeToEngine), ~0.04 ms per extra point;
 *   diffusion:    1 frame = 21 ms @100x100, 250 ms @800x600, 331 ms @1280x720,
 *                 705 ms @1920x1080; 300 frames @800x600 measured 61 s.
 *
 * The points cap alone cannot bound cost (600 strokes x 1 point would pass a
 * 600-point cap but cost seconds), so strokes are gated separately. The
 * chosen ceilings keep the WORST allowed restore at the 10x60 light fixture
 * (~200-233 ms measured at 1920x1080), under the ~250 ms target. Any nonzero
 * diffusion run exceeds that target at HD, so physics-run frames never
 * hydrate — they keep the cached-pixel path and report hydratable=false.
 */
export const MAX_HYDRATION_POINTS = 600;
export const MAX_HYDRATION_STROKES = 10;
export const MAX_HYDRATION_DIFFUSION_FRAMES = 0;

/** The budget gate alone — strokes, points and diffusion within the ceilings. */
export function isWithinBrushHydrationBudget(
  strokes: number,
  points: number,
  diffusionFrames: number,
): boolean {
  return strokes <= MAX_HYDRATION_STROKES
    && points <= MAX_HYDRATION_POINTS
    && diffusionFrames <= MAX_HYDRATION_DIFFUSION_FRAMES;
}

/**
 * Probe-facing hydratability: complete AND within budget. Liveness and the
 * navigation-time gates (real key, module, playback, scrub) are separate.
 */
export function isBrushScriptFrameHydratable(entry: {
  readonly complete: boolean;
  readonly strokes: number;
  readonly points: number;
  readonly diffusionFrames: number;
}): boolean {
  return entry.complete
    && isWithinBrushHydrationBudget(entry.strokes, entry.points, entry.diffusionFrames);
}

export interface BrushHydrationRequest {
  /** The destination app frame. */
  frame: number;
  /** The destination cell kind; only 'real' is hydratable. */
  destinationKind: string;
  /** Brush color mode is active (the Water color sheet owns its own store). */
  brushModuleActive: boolean;
  /** The navigation started while cached playback was running. */
  wasPlaying: boolean;
  /** The ruler scrub gesture is armed. */
  scrubActive: boolean;
}

export type BrushHydrationRefusal =
  | 'no-entry'
  | 'empty'
  | 'partial'
  | 'generated'
  | 'watercolor'
  | 'playback'
  | 'scrub'
  | 'budget';

export type BrushHydrationDecision =
  | { hydrate: true; entry: BrushScriptFrameEntry }
  | { hydrate: false; reason: BrushHydrationRefusal };

/** The pure policy read: no engine, no store mutation. */
export function planBrushScriptHydration(request: BrushHydrationRequest): BrushHydrationDecision {
  const entry = getBrushScriptFrameEntry(request.frame);
  if (!entry) return { hydrate: false, reason: 'no-entry' };
  if (entry.groups.length === 0) return { hydrate: false, reason: 'empty' };
  if (!entry.complete) return { hydrate: false, reason: 'partial' };
  if (request.destinationKind !== 'real') return { hydrate: false, reason: 'generated' };
  if (!request.brushModuleActive) return { hydrate: false, reason: 'watercolor' };
  if (request.wasPlaying) return { hydrate: false, reason: 'playback' };
  if (request.scrubActive) return { hydrate: false, reason: 'scrub' };
  if (
    !isWithinBrushHydrationBudget(entry.strokes, entry.points, entry.diffusionFrames)
  ) {
    return { hydrate: false, reason: 'budget' };
  }
  return { hydrate: true, entry };
}

/** The engine surface the hydration seam needs (structural). */
export interface BrushHydrationEngine {
  restoreStrokesBaseline(groups: readonly Readonly<RecordedStrokeGroup>[]): number;
}

/**
 * Plan + restore. Returns true only when the engine accepted a non-empty
 * baseline; every refusal is silent (the caller keeps the pixel path).
 */
export function attemptBrushScriptHydration(
  engine: BrushHydrationEngine | null | undefined,
  request: BrushHydrationRequest,
): boolean {
  const decision = planBrushScriptHydration(request);
  if (!decision.hydrate || !engine) return false;
  return engine.restoreStrokesBaseline(decision.entry.groups) > 0;
}

/** The engine surface the liveness gate needs (structural). */
export interface BrushScriptIdentityEngine {
  getStrokeSerials(): Map<number, number>;
}

/**
 * True only when the engine currently holds EVERY stored primary of this
 * frame. Move outlines must render only for live handles: after a navigation
 * that kept the cached-pixel path the store entry is stale, and drawing it
 * would show dead outlines over pixels the engine cannot edit.
 */
export function engineHoldsBrushScriptFrame(
  engine: BrushScriptIdentityEngine | null | undefined,
  frame: number,
): boolean {
  if (!engine) return false;
  const entry = getBrushScriptFrameEntry(frame);
  if (!entry || entry.groups.length === 0) return false;
  let serials: Map<number, number>;
  try {
    serials = engine.getStrokeSerials();
  } catch {
    return false;
  }
  return entry.groups.every((group) => serials.has(group.primary.mutationId as number));
}

/** The engine surface the completion law needs (structural). */
export interface BrushScriptFlushEngine {
  getStrokes(): readonly PaintStroke[];
}

/**
 * The ONE completion-listener law (261023-h9v).
 *
 *  - 'clear' NEVER writes the store: engine.clear() notifies 'clear' on every
 *    navigation, after the navigation flush already recorded the frame. Only
 *    an explicit user clear (clearBrushScriptFrame) drops an entry.
 *  - paint/move/erase/physics only MARK the frame (O(1), no projection).
 *  - undo/redo flush from the completing engine so the retained script and
 *    the Move overlay track the restored stack. The engine's deferred-undo
 *    path notifies nothing; the Studio-side wrapper flushes that case.
 */
export function applyCompletedBrushMutation(
  kind: CompletedPaintMutation['kind'],
  frame: number,
  engine: BrushScriptFlushEngine | null | undefined,
): void {
  if (kind === 'clear') return;
  markBrushScriptFrameDirty(frame);
  if (kind !== 'undo' && kind !== 'redo') return;
  let strokes: readonly PaintStroke[] | null = null;
  try {
    strokes = engine?.getStrokes() ?? null;
  } catch {
    strokes = null;
  }
  flushBrushScriptFrame(frame, strokes);
}
