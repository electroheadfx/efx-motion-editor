// ============================================================
//  The last-touch ping-pong carry (CR-03; 64-26 Task 1).
//
//  `DoubleTarget`'s two halves are INDEPENDENT textures: `gl.ts double()`
//  creates and clears each on its own and `swap()` only swaps references.
//  The touch fragment samples the READ half and writes the WRITE half over
//  the dab's scissored rect, so after the swap the two halves differ only
//  inside the just-stamped rect — they started equal and the fragment's
//  writes were scissored to that rect. Copying the previous dab's rect from
//  the read half into the write half before the next scissored draw makes
//  them equal everywhere again, and the following draw then changes only
//  its own rect. The invariant therefore holds with ONE rect-sized copy per
//  dab instead of a document-sized blit — which is exactly what D-29's
//  delivery law budgets. Without that copy each dab reverts everything the
//  previous dab stamped (the shipped defect this module repairs).
//
//  The state is the single PENDING rect: the just-stamped dab whose texels
//  the next dab must carry. Whole-target writes (a clear, a whole-document
//  upload, a resize's target-to-target copy) leave both halves identical,
//  so they invalidate the pending rect — a stale rectangle would blit
//  nothing meaningful and may not even exist in the new geometry.
//
//  No WebGL types here: this module deals in plain numbers, so the law is
//  provable on the CPU.
// ============================================================

/** A texel rectangle, the same open-x1/open-y1 shape the engine's Rect uses. */
export interface TouchRect { x0: number; y0: number; x1: number; y1: number }

/** The pending carry: the previous dab's rect, or null after a whole-target write. */
export interface LastTouchCarry { rect: TouchRect | null }

export function newLastTouchCarry(): LastTouchCarry {
  return { rect: null }
}

/**
 * The rect to copy read-to-write before the next stamp, or null when there
 * is nothing to carry. Consumes the pending rect: one carry per stamp.
 */
export function takeCarry(state: LastTouchCarry): TouchRect | null {
  const rect = state.rect
  state.rect = null
  return rect
}

/** Record the rect just stamped. An empty or inverted rect stamps nothing. */
export function recordStamp(state: LastTouchCarry, rect: TouchRect): void {
  if (rect.x1 > rect.x0 && rect.y1 > rect.y0) state.rect = { ...rect }
}

/** Drop the pending rect: both halves were just written identically. */
export function invalidateCarry(state: LastTouchCarry): void {
  state.rect = null
}
