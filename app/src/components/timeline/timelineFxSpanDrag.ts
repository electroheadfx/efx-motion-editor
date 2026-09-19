/**
 * Pure FX-area span drag range resolver (FX-09).
 *
 * The timeline total is DERIVED from the span ends (`lib/frameMap.ts`
 * `getTimelineRequiredFrameCount` → `totalFrames` / `frameMap`), so bounding a
 * drag by it is circular: shrinking a span collapses the total onto the span's
 * own new end, and that collapsed end then refuses every later extension.
 *
 * The pointer's addressable range is the natural limit, and the timeline grows
 * to follow the span. Callers must not re-clamp the resolved range.
 *
 * Dependency-free on purpose — no store imports.
 */

export type FxSpanDragMode = 'move' | 'resize-left' | 'resize-right';

export interface FxSpanDragInput {
  mode: FxSpanDragMode;
  /** Span start captured at pointer-down (the displayed bar edge). */
  origIn: number;
  /** Span end captured at pointer-down (the displayed bar edge). */
  origOut: number;
  /** Pointer frame minus the frame captured at pointer-down, in frames. */
  delta: number;
}

export interface FxSpanRange {
  inFrame: number;
  outFrame: number;
}

export function resolveFxSpanDragRange(input: FxSpanDragInput): FxSpanRange {
  const { mode, origIn, origOut, delta } = input;

  if (mode === 'move') {
    // Translate the whole span, preserving duration; the end may go past the
    // current end and the timeline grows with it.
    const inFrame = Math.max(0, origIn + delta);
    return { inFrame, outFrame: inFrame + (origOut - origIn) };
  }

  if (mode === 'resize-left') {
    // Keep the start inside [0, end - 1]; the end never moves.
    return { inFrame: Math.max(0, Math.min(origIn + delta, origOut - 1)), outFrame: origOut };
  }

  // resize-right: at least one frame wide, unbounded above.
  return { inFrame: origIn, outFrame: Math.max(origIn + 1, origOut + delta) };
}
