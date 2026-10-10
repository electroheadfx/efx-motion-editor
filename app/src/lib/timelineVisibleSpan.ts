import {BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH} from '../components/timeline/TimelineRenderer';

/** View inputs at click time — read with .peek() from timelineStore, never subscribed. */
export interface TimelineViewSpanInput {
  zoom: number;
  scrollX: number;
  viewportWidth: number;
}

export interface TimelineFrameSpan {
  inFrame: number;
  outFrame: number;
}

/**
 * LOCKED view-span law (261010-mwy) — the only home of this formula:
 *   frameWidth = BASE_FRAME_WIDTH * zoom
 *   trackArea = viewportWidth - TRACK_HEADER_WIDTH
 *   visibleFrameCount = max(1, round(trackArea / frameWidth))
 *   inFrame = floor(scrollX / frameWidth)
 *   outFrame = inFrame + visibleFrameCount
 *
 * Physic Paint layer creation spans exactly the timeline frames visible at the
 * current zoom and scroll. Zoom is the length control: zoom out = longer span,
 * zoom in = shorter span; scrolling moves the window with the view.
 */
export function computeVisibleTimelineFrameSpan(view: TimelineViewSpanInput): TimelineFrameSpan {
  const frameWidth = BASE_FRAME_WIDTH * view.zoom;
  const trackArea = view.viewportWidth - TRACK_HEADER_WIDTH;
  // Degenerate zoom (0 / NaN) cannot produce a span; the 1-frame floor still holds.
  const visibleFrameCount = frameWidth > 0 ? Math.max(1, Math.round(trackArea / frameWidth)) : 1;
  const inFrame = frameWidth > 0 ? Math.floor(view.scrollX / frameWidth) : 0;
  return {
    inFrame,
    outFrame: inFrame + visibleFrameCount,
  };
}

/**
 * Physic-paint creation decision, kept pure so the isolation-vs-view law is
 * testable without mounting the menu.
 *
 * Isolation wins: when a target sequence is isolated, the new layer keeps the
 * isolated sequence range — the visible view never overrides it. Without
 * isolation the layer fills the visible view (the createFxSequence 100-frame
 * fallback is never an input to this function).
 */
export function resolvePhysicPaintCreateSpan(args: {
  isolated: TimelineFrameSpan | null;
  view: TimelineViewSpanInput;
}): TimelineFrameSpan {
  if (args.isolated) {
    return {inFrame: args.isolated.inFrame, outFrame: args.isolated.outFrame};
  }
  return computeVisibleTimelineFrameSpan(args.view);
}
