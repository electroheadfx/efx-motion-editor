/**
 * quick-261025-awl (D-01/D-02): pure frame script ownership resolver.
 *
 * Reads the two session script stores plus an optional live Brush ledger
 * sample and reports the frame's single owner. No signal reads, no writes:
 * callers persist the result through frameModuleLock's compare-then-write
 * setter.
 */
import type { FrameScriptOwner } from '../../shared/frameModuleLock';
import { getBrushScriptForFrame, purgedBrushScriptFrame } from './brushScriptRecordState';
import { hasAquarelleScriptForFrame } from './aquarelleRecordState';

export type { FrameScriptOwner };

/** One live-ledger sample — the Studio reads it from the engine on refresh. */
export interface LiveBrushScriptSample {
  active: boolean;
  strokeCount: number;
}

/** The interval half of a Loop Clip range a rail test needs. */
export interface RotoLoopRailRange {
  readonly placementStart: number;
  readonly effectiveEnd: number;
}

/**
 * quick-261026-odd: a frame inside ANY Loop Clip rail (Play Script, Motion,
 * Static, Reveal) is pixel-only by law — those rails bake pixels and add no
 * stroke script (later they may opt in). The cell projection resolves a REAL
 * key BEFORE loop ranges (D-26), so `currentCell.kind === 'real'` can never
 * tell that a rail owns the frame; this interval test is the missing half.
 */
export function isRotoLoopRailFrame(
  ranges: readonly RotoLoopRailRange[] | null | undefined,
  frame: number,
): boolean {
  if (!ranges) return false;
  for (const range of ranges) {
    if (frame >= range.placementStart && frame < range.effectiveEnd) return true;
  }
  return false;
}

export function resolveFrameScriptOwner(
  frame: number,
  liveBrush?: LiveBrushScriptSample | null,
): FrameScriptOwner {
  const storedBrush = getBrushScriptForFrame(frame).length > 0;
  const liveBrushLeg =
    liveBrush !== null &&
    liveBrush !== undefined &&
    liveBrush.active === true &&
    liveBrush.strokeCount > 0 &&
    !purgedBrushScriptFrame(frame);

  const hasBrush = storedBrush || liveBrushLeg;
  const hasWatercolor = hasAquarelleScriptForFrame(frame);

  if (hasBrush && hasWatercolor) return 'both';
  if (hasBrush) return 'brush';
  if (hasWatercolor) return 'watercolor';
  return null;
}
