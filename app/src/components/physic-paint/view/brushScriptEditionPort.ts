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

import type { PaintRenderSettings, PaintStroke } from '@efxlab/efx-physic-paint';
import {
  brushScriptRevision,
  flushBrushScriptFrame,
  getBrushScriptForFrame,
  isBrushScriptLedgerComplete,
} from './brushScriptRecordState';
import { engineHoldsBrushScriptFrame } from './brushScriptHydration';
import {
  decimateScriptPoints,
  hitsScriptStroke,
  MIN_STROKE_PAD_PX,
  scriptSelectedStrokeIds,
  scriptStrokeBoundsPx,
  setScriptStrokeSelection,
  type CanvasPoint,
  type ScriptStrokeEditionPort,
  type ScriptStrokeSize,
  type SelectableScriptStroke,
} from './scriptStrokeEdition';
import type { ScriptStrokeTransform } from './scriptStrokeTransform';
import type { ScriptStrokeAppearance, ScriptStrokeAppearancePatch } from './strokeSettingsModel';

/** The engine surface the brush port needs (structural — the overlay never imports the engine class). */
export interface BrushScriptEditionEngine {
  getStrokes(): readonly PaintStroke[];
  getStrokeSerials(): Map<number, number>;
  moveStroke(mutationId: number, dxPx: number, dyPx: number): boolean;
  deleteStroke(mutationId: number): boolean;
  /** 261024-mz5: one batch commit for the whole selection. */
  moveStrokes(mutationIds: readonly number[], dxPx: number, dyPx: number): number;
  deleteStrokes(mutationIds: readonly number[]): number;
  /** 261024-mz5 Task 2: points-only scale/rotate in ONE commit. */
  transformStrokes(mutationIds: readonly number[], transform: ScriptStrokeTransform): number;
  /** 261024-p5q: narrow appearance read for the Stroke Settings dialog. */
  getStrokeAppearance(mutationIds: readonly number[]): Array<{
    mutationId: number;
    params: Record<string, number>;
    color: string | null;
  }>;
  /** 261024-p5q: merge per-stroke params/color into every listed stroke in ONE commit. */
  setStrokeAppearance(mutationIds: readonly number[], patch: ScriptStrokeAppearancePatch): number;
  sendStrokeBackward(mutationId: number): boolean;
  sendStrokeForward(mutationId: number): boolean;
  /** 261024-vga: exact placement (1 = topmost) — one commit. */
  moveStrokeToStackPosition(mutationId: number, positionFromTop: number): boolean;
  setStrokeLabelsSuppressed(suppressed: boolean): void;
  setCursorVisible(visible: boolean): void;
  /** 261023-j5b: the visit's captured paint globals (sticky, null until a live paint). */
  getFramePaintSettings(): PaintRenderSettings | null;
  /** The paint globals currently live on the engine (fallback when none captured). */
  getPaintRenderSettings(): PaintRenderSettings;
  /**
   * 261023-j5b follow-up: declare whether this visit's ledger is the whole
   * frame content before an edit, so a duplicate cached base is cleared once
   * before the faithful rebake.
   */
  setScriptBaseClearPending(pending: boolean): void;
}

/**
 * 261023-j5b: an edit-triggered flush carries the visit's paint globals so the
 * first faithful rebake replays with the painted look, not whatever the
 * sliders read now.
 */
function resolvePaintSettings(engine: BrushScriptEditionEngine): PaintRenderSettings {
  return engine.getFramePaintSettings() ?? engine.getPaintRenderSettings();
}

/**
 * 261023-j5b follow-up: tell the engine whether a cached preview base
 * duplicates this frame's ledger BEFORE the edit rebakes. A complete ledger
 * (including a Duplicate-derived live visit) clears the base once; a partial
 * visit keeps its pre-existing base.
 */
function declareEditBase(engine: BrushScriptEditionEngine, frame: number): void {
  engine.setScriptBaseClearPending(isBrushScriptLedgerComplete(frame));
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
  /**
   * quick-261025-awl: fired after an accepted edit that can change the frame's
   * script ownership. Only the delete paths call it — a delete can remove the
   * last stroke. Move/transform/appearance/step/place never notify.
   */
  onScriptChanged?(frame: number): void;
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

/**
 * Translate the whole selection, then refresh the frame's retained script
 * ONCE. One engine commit + one flush per gesture (261024-mz5).
 */
export function moveBrushScriptStrokes(
  mutationIds: readonly number[],
  dxPx: number,
  dyPx: number,
): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  if (mutationIds.length === 0) return false;
  declareEditBase(resolved.engine, resolved.frame);
  const moved = resolved.engine.moveStrokes(mutationIds, dxPx, dyPx) > 0;
  if (moved) {
    flushBrushScriptFrame(
      resolved.frame,
      resolved.engine.getStrokes(),
      resolvePaintSettings(resolved.engine),
    );
  }
  return moved;
}

/** Single-stroke wrapper — one stroke of the batch path. */
export function moveBrushScriptStroke(mutationId: number, dxPx: number, dyPx: number): boolean {
  return moveBrushScriptStrokes([mutationId], dxPx, dyPx);
}

/**
 * Delete the whole selection in ONE engine edit + ONE flush, then prune the
 * deleted ids from the selection (survivors stay selected).
 */
export function deleteBrushScriptStrokes(mutationIds: readonly number[]): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  if (mutationIds.length === 0) return false;
  declareEditBase(resolved.engine, resolved.frame);
  const deleted = resolved.engine.deleteStrokes(mutationIds) > 0;
  if (!deleted) return false;
  flushBrushScriptFrame(
    resolved.frame,
    resolved.engine.getStrokes(),
    resolvePaintSettings(resolved.engine),
  );
  // quick-261025-awl: a delete may have removed the frame's last stroke —
  // republish the owner so the Studio lock and Raster availability stay live.
  resolved.context.onScriptChanged?.(resolved.frame);
  const selection = scriptSelectedStrokeIds.peek();
  if (selection.size > 0) {
    const requested = new Set(mutationIds);
    const survivors: number[] = [];
    let changed = false;
    for (const mutationId of selection) {
      if (requested.has(mutationId)) changed = true;
      else survivors.push(mutationId);
    }
    if (changed) setScriptStrokeSelection(survivors);
  }
  return true;
}

/** Single-stroke wrapper — one stroke of the batch path. */
export function deleteBrushScriptStroke(mutationId: number): boolean {
  return deleteBrushScriptStrokes([mutationId]);
}

function hasAppearanceContent(patch: ScriptStrokeAppearancePatch | null | undefined): boolean {
  if (!patch) return false;
  const hasParams = patch.params !== undefined && Object.keys(patch.params).length > 0;
  const hasColor = typeof patch.color === 'string' && patch.color.length > 0;
  return hasParams || hasColor;
}

/**
 * 261024-p5q: narrow appearance read for the Stroke Settings dialog. The
 * leaf subscribes `brushScriptRevision` so every flush re-reads; a frame the
 * engine does not hold (stale/other-track visit) yields no rows.
 */
export function readBrushScriptStrokeAppearance(
  mutationIds: readonly number[],
  playFrame: number,
): ScriptStrokeAppearance[] {
  void brushScriptRevision.value;
  const engine = brushScriptEditionContext?.getEngine() ?? null;
  if (!engine || !engineHoldsBrushScriptFrame(engine, playFrame)) return [];
  return engine.getStrokeAppearance(mutationIds).map((row) => ({
    mutationId: row.mutationId,
    params: { ...row.params },
    color: row.color,
  }));
}

/**
 * 261024-p5q: write appearance for the whole selection in ONE engine commit,
 * then refresh the frame's retained script ONCE. Lock-gated; an empty batch
 * or an empty patch refuses before the edit base is declared. A zero-change
 * engine result performs no flush.
 */
export function applyBrushScriptStrokeAppearance(
  mutationIds: readonly number[],
  patch: ScriptStrokeAppearancePatch,
): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  if (mutationIds.length === 0) return false;
  if (!hasAppearanceContent(patch)) return false;
  declareEditBase(resolved.engine, resolved.frame);
  const changed = resolved.engine.setStrokeAppearance(mutationIds, patch) > 0;
  if (!changed) return false;
  flushBrushScriptFrame(
    resolved.frame,
    resolved.engine.getStrokes(),
    resolvePaintSettings(resolved.engine),
  );
  return true;
}

/**
 * Scale + rotate the whole selection in ONE engine commit, then refresh the
 * frame's retained script ONCE (261024-mz5 Task 2). The selection is kept —
 * exactly like a move.
 */
export function transformBrushScriptStrokes(
  mutationIds: readonly number[],
  transform: ScriptStrokeTransform,
): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  if (mutationIds.length === 0) return false;
  declareEditBase(resolved.engine, resolved.frame);
  const transformed = resolved.engine.transformStrokes(mutationIds, transform) > 0;
  if (!transformed) return false;
  flushBrushScriptFrame(
    resolved.frame,
    resolved.engine.getStrokes(),
    resolvePaintSettings(resolved.engine),
  );
  return true;
}

/** Step one captured stroke through the paint stack; the store refreshes only on an accepted step. */
export function stepBrushScriptStroke(mutationId: number, direction: 'back' | 'forward'): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  declareEditBase(resolved.engine, resolved.frame);
  const stepped =
    direction === 'back'
      ? resolved.engine.sendStrokeBackward(mutationId)
      : resolved.engine.sendStrokeForward(mutationId);
  if (stepped) {
    flushBrushScriptFrame(
      resolved.frame,
      resolved.engine.getStrokes(),
      resolvePaintSettings(resolved.engine),
    );
  }
  return stepped;
}

/**
 * 261024-vga: place one captured stroke at an exact stack position. Mirrors
 * stepBrushScriptStroke: lock-gated, declares the edit base, ONE engine call,
 * and flushes the frame only on an accepted placement. The boolean is the
 * whole refusal channel — the dialog's ref-held sync nonce re-syncs the
 * readout, so no extra signal or callback is added here.
 */
export function placeBrushScriptStroke(mutationId: number, positionFromTop: number): boolean {
  const resolved = resolveEdition();
  if (!resolved || resolved.context.isLocked()) return false;
  declareEditBase(resolved.engine, resolved.frame);
  const placed = resolved.engine.moveStrokeToStackPosition(mutationId, positionFromTop);
  if (placed) {
    flushBrushScriptFrame(
      resolved.frame,
      resolved.engine.getStrokes(),
      resolvePaintSettings(resolved.engine),
    );
  }
  return placed;
}

/** The registered brush port consumed by the shared overlay + keyboard seam. */
export const brushScriptEditionPort: ScriptStrokeEditionPort = {
  isActive: () => brushScriptEditionContext?.isActive() === true,
  listStrokes: (playFrame, size) => listBrushScriptStrokes(playFrame, size),
  hitTestStroke: (pointPx, playFrame, size) => hitTestBrushScriptStroke(pointPx, playFrame, size),
  deleteStrokes: (mutationIds) => {
    deleteBrushScriptStrokes(mutationIds);
  },
  moveStrokes: (mutationIds, dxPx, dyPx) => {
    moveBrushScriptStrokes(mutationIds, dxPx, dyPx);
  },
  transformStrokes: (mutationIds, transform) => {
    transformBrushScriptStrokes(mutationIds, transform);
  },
  stepStroke: (mutationId, direction) => {
    stepBrushScriptStroke(mutationId, direction);
  },
};
