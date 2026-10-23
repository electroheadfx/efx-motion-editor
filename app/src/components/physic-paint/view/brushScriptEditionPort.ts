// ============================================================
//  brushScriptEditionPort — the Brush adapter of the ONE
//  script-edition seam (quick 261023-g4p Task 3).
//
//  The engine holds only the CURRENT frame's strokes. This port
//  projects the session store's captured per-frame groups into the
//  shared SelectableScriptStroke shape (serial from the engine badge
//  map, stack position from the TOP of the paint order), hit-tests
//  topmost-first, and routes every edit through the engine's public
//  by-id APIs. After a successful edit it flushes the frame so the
//  retained script matches what the canvas shows.
//
//  LOCK LAW: every mutation is gated on the Studio's physical lock —
//  a held lock refuses without touching the engine or the store.
//
//  No Preact component, no effect. The listing reads the store's
//  revision signal (the overlay leaf subscribes there); the edit ops
//  read `.peek()`-free plain state at event time.
// ============================================================

import type { PaintStroke } from '@efxlab/efx-physic-paint';
import {
  brushScriptRevision,
  flushBrushScriptFrame,
  getBrushScriptForFrame,
} from './brushScriptRecordState';
import { engineHoldsBrushScriptFrame } from './brushScriptHydration';
import {
  decimateScriptPoints,
  hitsScriptStroke,
  MIN_STROKE_PAD_PX,
  scriptSelectedStrokeId,
  scriptStrokeBoundsPx,
  selectScriptStroke,
  type CanvasPoint,
  type ScriptStrokeEditionPort,
  type ScriptStrokeSize,
  type SelectableScriptStroke,
} from './scriptStrokeEdition';

/** The engine surface the brush port needs (structural — the overlay never imports the engine class). */
export interface BrushScriptEditionEngine {
  getStrokes(): readonly PaintStroke[];
  getStrokeSerials(): Map<number, number>;
  moveStroke(mutationId: number, dxPx: number, dyPx: number): boolean;
  deleteStroke(mutationId: number): boolean;
  sendStrokeBackward(mutationId: number): boolean;
  sendStrokeForward(mutationId: number): boolean;
  setStrokeLabelsSuppressed(suppressed: boolean): void;
  setCursorVisible(visible: boolean): void;
}

/**
 * Studio registration. Read at call time (event handlers / narrow leaves),
 * never stored in a signal — the temporaryEraseDepsRef precedent.
 */
export interface BrushScriptEditionContext {
  getEngine(): BrushScriptEditionEngine | null;
  getPlayFrame(): number;
  isActive(): boolean;
  /** The physical-mutation lock — every edit refuses while it is held. */
  isLocked(): boolean;
}

let brushScriptEditionContext: BrushScriptEditionContext | null = null;

export function configureBrushScriptEdition(context: BrushScriptEditionContext | null): void {
  brushScriptEditionContext = context;
}

interface ResolvedEdition {
  context: BrushScriptEditionContext;
  engine: BrushScriptEditionEngine;
  frame: number;
}

function resolveEdition(): ResolvedEdition | null {
  const context = brushScriptEditionContext;
  if (!context) return null;
  const engine = context.getEngine();
  if (!engine) return null;
  return { context, engine, frame: context.getPlayFrame() };
}

/** Read the engine-side creation-order serials once per listing call. */
function engineSerials(engine: BrushScriptEditionEngine | null): Map<number, number> {
  if (!engine) return new Map();
  try {
    return engine.getStrokeSerials();
  } catch {
    // A detached engine must never break the overlay render — fall back to
    // mutation ids, which are still stable handles.
    return new Map();
  }
}

/**
 * The overlay's narrow-leaf read: subscribes to brushScriptRevision so any
 * capture/prune/reset repaints the outlines, then maps the frame's retained
 * groups (bottom -> top) to rows with TOP-relative stack positions.
 */
export function listBrushScriptStrokes(
  playFrame: number,
  _size: ScriptStrokeSize,
): SelectableScriptStroke[] {
  // Narrow-leaf subscription: the overlay (and only the overlay) repaints when
  // the store changes. Never read in the Studio render body.
  void brushScriptRevision.value;
  const engine = brushScriptEditionContext?.getEngine() ?? null;
  // 261023-h9v: only LIVE handles may render. An entry whose strokes were
  // dropped by engine.clear() (navigation without hydration) would draw dead
  // Move outlines the engine cannot edit.
  if (!engineHoldsBrushScriptFrame(engine, playFrame)) return [];
  const groups = getBrushScriptForFrame(playFrame);
  if (groups.length === 0) return [];
  const serials = engineSerials(engine);
  const stackTotal = groups.length;
  return groups.map((group, index) => {
    const primary = group.primary;
    const mutationId = primary.mutationId as number;
    const points = primary.points;
    return {
      mutationId,
      pointsPx: decimateScriptPoints(points),
      bounds: scriptStrokeBoundsPx(points, primary.params?.size ?? 0),
      serial: serials.get(mutationId) ?? mutationId,
      // The groups array is bottom -> top, so the last row is 1/total.
      stackPosition: stackTotal - index,
      stackTotal,
      color: primary.color || '#111827',
    };
  });
}

/** Topmost painted stroke wins: walk the paint order in reverse. */
export function hitTestBrushScriptStroke(
  pointPx: CanvasPoint,
  playFrame: number,
  _size: ScriptStrokeSize,
): number | null {
  // Same liveness gate as the listing — a stale entry never hit-tests.
  if (!engineHoldsBrushScriptFrame(brushScriptEditionContext?.getEngine() ?? null, playFrame)) {
    return null;
  }
  const groups = getBrushScriptForFrame(playFrame);
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const primary = groups[index]!.primary;
    const radius = Math.max(MIN_STROKE_PAD_PX, (primary.params?.size || 24) / 2);
    if (hitsScriptStroke(pointPx, primary.points, radius)) {
      return primary.mutationId as number;
    }
  }
  return null;
}

/** Translate one captured stroke, then refresh the frame's retained script. */
export function moveBrushScriptStroke(mutationId: number, dxPx: number, dyPx: number): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  const moved = resolved.engine.moveStroke(mutationId, dxPx, dyPx);
  if (moved) flushBrushScriptFrame(resolved.frame, resolved.engine.getStrokes());
  return moved;
}

/** Delete one captured stroke; a vanished id also drops the highlight. */
export function deleteBrushScriptStroke(mutationId: number): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  const deleted = resolved.engine.deleteStroke(mutationId);
  if (!deleted) return false;
  flushBrushScriptFrame(resolved.frame, resolved.engine.getStrokes());
  if (scriptSelectedStrokeId.peek() === mutationId) selectScriptStroke(null);
  return true;
}

/** Step one captured stroke through the paint stack; the store refreshes only on an accepted step. */
export function stepBrushScriptStroke(mutationId: number, direction: 'back' | 'forward'): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  const stepped =
    direction === 'back'
      ? resolved.engine.sendStrokeBackward(mutationId)
      : resolved.engine.sendStrokeForward(mutationId);
  if (stepped) flushBrushScriptFrame(resolved.frame, resolved.engine.getStrokes());
  return stepped;
}

/** The registered brush port consumed by the shared overlay + keyboard seam. */
export const brushScriptEditionPort: ScriptStrokeEditionPort = {
  isActive: () => brushScriptEditionContext?.isActive() === true,
  listStrokes: (playFrame, size) => listBrushScriptStrokes(playFrame, size),
  hitTestStroke: (pointPx, playFrame, size) => hitTestBrushScriptStroke(pointPx, playFrame, size),
  deleteStroke: (mutationId) => {
    deleteBrushScriptStroke(mutationId);
  },
  moveStroke: (mutationId, dxPx, dyPx) => {
    moveBrushScriptStroke(mutationId, dxPx, dyPx);
  },
  stepStroke: (mutationId, direction) => {
    stepBrushScriptStroke(mutationId, direction);
  },
};
