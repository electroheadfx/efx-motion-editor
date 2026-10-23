// ============================================================
//  brushScriptHydration — the in-session navigation rehydration
//  policy (quick 261023-h9v, reworked by 261023-j5b).
//
//  LAZY ATTACH: navigation flushes the outgoing frame into the
//  session store, calls engine.clear(), loads the destination's
//  cached pixels, and then ATTACHES a COMPLETE retained script
//  into the engine ledger SILENTLY. Nothing is replayed and no
//  pixel is repainted — the cached pixels are the display. The
//  expensive faithful reconstruction (live deposit semantics)
//  belongs to the first edit of the visit, not to navigation;
//  the eager h9v restore replayed the whole script on arrival
//  with `{ replay: true }`, which was slow AND corrupting.
//
//  FAIL-CLOSED: every refusal keeps today's cached-pixel path and
//  never touches the engine. Refusals:
//    no-entry   — the frame was never captured this session;
//    empty      — the captured projection has no strokes;
//    partial    — a cached pixel base sits under the session script
//                 (the ledger could never be edited without deleting
//                 the base pixels);
//    generated  — only a REAL key may attach (generated / none /
//                 no-launch destinations always repaint pixels);
//    watercolor — the aquarelle sheet owns its own record store;
//    playback / scrub — a moving playhead must never pause for a
//                 synchronous ledger mutation;
//    budget     — the frame exceeds the attach (clone) sanity cap.
//
//  The module is DOM-free: the engine is a structural interface so
//  unit suites can pin the policy without importing EfxPaintEngine.
// ============================================================

import type { CompletedPaintMutation, PaintRenderSettings, PaintStroke } from '@efxlab/efx-physic-paint';
import type { RecordedStrokeGroup } from './recordedStrokeGroups';
import {
  flushBrushScriptFrame,
  getBrushScriptFrameEntry,
  markBrushScriptFrameDirty,
  type BrushScriptFrameEntry,
} from './brushScriptRecordState';

/**
 * GENEROUS attach sanity cap (quick 261023-j5b). Attaching clones the stored
 * group list into the ledger — O(n), no replay — so the only cost this cap
 * bounds is cloning. Provisional values here; Task 3 replaces them with
 * numbers measured on the mock-canvas harness. The h9v replay budget
 * (600 points / 10 strokes / 0 diffusion frames) is deliberately gone: a
 * many-stroke frame now attaches fine because navigation no longer replays it.
 */
export const MAX_ATTACH_STROKES = 200;
export const MAX_ATTACH_POINTS = 40000;

/** The attach sanity cap alone — stroke and point counts within the ceilings. */
export function isWithinBrushAttachCap(strokes: number, points: number): boolean {
  return strokes <= MAX_ATTACH_STROKES && points <= MAX_ATTACH_POINTS;
}

/**
 * Probe-facing hydratability: complete AND within the attach sanity cap.
 * Liveness and the navigation-time gates (real key, module, playback, scrub)
 * are separate.
 */
export function isBrushScriptFrameHydratable(entry: {
  readonly complete: boolean;
  readonly strokes: number;
  readonly points: number;
  readonly diffusionFrames: number;
}): boolean {
  return entry.complete && isWithinBrushAttachCap(entry.strokes, entry.points);
}

export interface BrushHydrationRequest {
  /** The destination app frame. */
  frame: number;
  /** The destination cell kind; only 'real' is attachable. */
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
  if (!isWithinBrushAttachCap(entry.strokes, entry.points)) {
    return { hydrate: false, reason: 'budget' };
  }
  return { hydrate: true, entry };
}

/** The engine surface the attach seam needs (structural). */
export interface BrushHydrationEngine {
  attachStrokesBaseline(
    groups: readonly Readonly<RecordedStrokeGroup>[],
    settings?: PaintRenderSettings | null,
  ): number;
}

/**
 * Plan + attach. Returns true only when the engine accepted a non-empty
 * baseline; every refusal is silent (the caller keeps the pixel path).
 */
export function attemptBrushScriptHydration(
  engine: BrushHydrationEngine | null | undefined,
  request: BrushHydrationRequest,
): boolean {
  const decision = planBrushScriptHydration(request);
  if (!decision.hydrate || !engine) return false;
  return engine.attachStrokesBaseline(decision.entry.groups, decision.entry.paintSettings ?? null) > 0;
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
