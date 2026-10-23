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
 * Documented serialized-cost budget. The restore replays every point
 * synchronously, so the ceiling is expressed in stored points rather than
 * bytes; the probe measures the real cost at the boundary.
 */
export const MAX_HYDRATION_POINTS = 24000;
export const MAX_HYDRATION_DIFFUSION_FRAMES = 300;

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
    entry.points > MAX_HYDRATION_POINTS
    || entry.diffusionFrames > MAX_HYDRATION_DIFFUSION_FRAMES
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
