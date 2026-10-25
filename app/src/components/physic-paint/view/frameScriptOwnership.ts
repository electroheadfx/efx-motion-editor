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
