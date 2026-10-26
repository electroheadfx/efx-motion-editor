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
//    foreign-key — the entry's physical key identity is unknown (legacy v1
//                 row) or no longer the destination cell's key. A script
//                 follows key identity: attaching it to a replaced key would
//                 draw dead outlines and edit content the cell does not own;
//    watercolor — the aquarelle sheet owns its own record store;
//    playback / scrub — a moving playhead must never pause for a
//                 synchronous ledger mutation;
//    edit-cost  — the frame exceeds the attach (clone) sanity cap, or it
//                 carries diffusion frames whose faithful rebake is
//                 unaffordable (measured 705 ms per diffusion frame at
//                 1920x1080). Such frames stay view-only on cached pixels.
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
 * bounds is cloning. SIZED FROM MEASUREMENT (2026-10-23, mock-canvas harness
 * driving the real ledger): the heavy fixture (40 strokes x 180 points =
 * 7200 points, 40 clones) attaches in 1.84 ms at 1920x1080 and 0.61 ms at
 * 100x100; light attaches in 0.54 ms. The 200-stroke / 40000-point ceiling is
 * 5x the heavy fixture's stroke count and 5.5x its point count; by linear
 * scaling a full-ceiling attach costs roughly 10 ms, still an order of
 * magnitude under the removed 233 ms light replay, while bounding a
 * pathological store. The h9v replay budget (600 points / 10 strokes /
 * 0 diffusion frames) is deliberately gone: a many-stroke frame now attaches
 * fine because navigation no longer replays it.
 */
export const MAX_ATTACH_STROKES = 200;
export const MAX_ATTACH_POINTS = 40000;

/**
 * The EDIT-AFFORDABILITY gate. A physics-run frame stores zero-point diffusion
 * continuations; the faithful rebake replays every continuation frame through
 * the solver. Measured (h9v 705 ms, j5b 684 ms) for ONE diffusion frame at
 * 1920x1080 — unaffordable for a synchronous first edit. Such frames stay
 * view-only: cached pixels, no attach. (At 100x100 a frame is 8 ms, but the
 * working canvas is HD, so the gate is HD-sized.)
 */
export const MAX_EDITABLE_DIFFUSION_FRAMES = 0;

/** The attach sanity cap alone — stroke and point counts within the ceilings. */
export function isWithinBrushAttachCap(strokes: number, points: number): boolean {
  return strokes <= MAX_ATTACH_STROKES && points <= MAX_ATTACH_POINTS;
}

/** The edit-affordability cap alone — zero diffusion frames (physics runs). */
export function isWithinBrushEditCostCap(diffusionFrames: number): boolean {
  return diffusionFrames <= MAX_EDITABLE_DIFFUSION_FRAMES;
}

/**
 * Probe-facing EDITABLE verdict: complete, within the attach sanity cap, and
 * within the edit-affordability cap. Liveness and the navigation-time gates
 * (real key, module, playback, scrub) are separate. This is the SAME predicate
 * the live navigation policy applies, so the probe can never disagree.
 */
export function isBrushScriptFrameHydratable(entry: {
  readonly complete: boolean;
  readonly strokes: number;
  readonly points: number;
  readonly diffusionFrames: number;
}): boolean {
  return (
    entry.complete &&
    isWithinBrushAttachCap(entry.strokes, entry.points) &&
    isWithinBrushEditCostCap(entry.diffusionFrames)
  );
}

export interface BrushHydrationRequest {
  /** The destination app frame. */
  frame: number;
  /** The destination cell kind; only 'real' is attachable. */
  destinationKind: string;
  /**
   * quick-261026-odd: the destination cell's physical key id. Hydration
   * refuses any entry whose identity is unknown (legacy null) or differs —
   * a retained script belongs to the KEY it was captured on.
   */
  keyId: string | null;
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
  | 'foreign-key'
  | 'watercolor'
  | 'playback'
  | 'scrub'
  | 'edit-cost';

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
  // quick-261026-odd (empty-script gate): the KEY identity gate. A legacy null
  // row and a row for a replaced key both fail closed — the cached pixels keep
  // rendering, the engine stays empty, and Move has no dead handles to show.
  if (
    request.keyId === null
    || entry.keyId === null
    || entry.keyId === undefined
    || entry.keyId !== request.keyId
  ) {
    return { hydrate: false, reason: 'foreign-key' };
  }
  if (!request.brushModuleActive) return { hydrate: false, reason: 'watercolor' };
  if (request.wasPlaying) return { hydrate: false, reason: 'playback' };
  if (request.scrubActive) return { hydrate: false, reason: 'scrub' };
  if (!isWithinBrushAttachCap(entry.strokes, entry.points)) {
    return { hydrate: false, reason: 'edit-cost' };
  }
  // A physics-run frame's faithful rebake replays solver frames at ~700 ms
  // each on HD — fail closed to the cached pixels (view-only).
  if (!isWithinBrushEditCostCap(entry.diffusionFrames)) {
    return { hydrate: false, reason: 'edit-cost' };
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
