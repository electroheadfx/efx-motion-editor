// ============================================================
//  61-15 — the vector commit bake seam (G-1/G-2).
//
//  A vector stroke paints no engine dabs: its only pixels come from
//  replaying the recorded script. This module owns the ONE route
//  decision (defer the pixels vs re-bake them) and the ONE single-
//  flight sequence around reset + apply. It never records, restores
//  or publishes — it only sequences. No Studio import: the leaf is
//  unit-testable without mounting the Studio.
// ============================================================

export const VECTOR_PATH_SCRIPT_OFF_MESSAGE =
  'Vector path rejected — Script is off, so the path would not be recorded. Turn Script on and draw it again.';

/**
 * A stroke is a vector commit only when it carries anchors. The list is
 * the ONE signal — a missing or empty list is an ordinary dabs stroke.
 */
export function isVectorAquarelleStroke(stroke: { anchors?: readonly unknown[] }): boolean {
  return Array.isArray(stroke.anchors) && stroke.anchors.length > 0;
}

/**
 * Draft and wireframe both defer the engine re-render: the committed sheet
 * keeps its last rendered pixels until the ONE settle runs. Any other
 * state re-bakes immediately.
 */
export function resolveVectorCommitRoute(latches: { draft: boolean; wireframe: boolean }): 'defer-pixels' | 'rebake' {
  return latches.draft || latches.wireframe ? 'defer-pixels' : 'rebake';
}

export interface AquarelleScriptRebakeSequence {
  readonly isInFlight: () => boolean;
  readonly beginInFlight: () => void;
  readonly endInFlight: () => void;
  readonly resetSheet: () => void;
  readonly applyTimeline: () => Promise<boolean>;
  readonly onSuccess?: () => void;
  readonly onFailure?: () => void;
}

/**
 * Hand the host one macrotask. `MessageChannel` posts a macrotask in every
 * webview we run in (WebKit included) and, unlike `requestAnimationFrame`, it
 * still fires for a hidden window — a re-bake must never be stranded because
 * the user switched away mid-edit.
 */
function yieldToHost(): Promise<void> {
  if (typeof MessageChannel === 'function') {
    return new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(0);
    });
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Bound on the paint wait: a hidden or throttled window must never strand a bake. */
const PAINT_YIELD_TIMEOUT_MS = 64;

/**
 * Give anything opened by the latch a REAL painted frame before the work
 * blocks. One host turn flushes a signal write into the DOM; two animation
 * frames then let the frame carrying that DOM mutation reach the screen. The
 * whole wait is bounded so a hidden window (where `requestAnimationFrame` does
 * not fire) costs one short timer, never a hang.
 */
async function yieldForPaint(): Promise<void> {
  await yieldToHost();
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, PAINT_YIELD_TIMEOUT_MS);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(finish));
    } else {
      finish();
    }
  });
}

/**
 * ONE in-flight latch per rebake. Already in flight → return false without
 * touching anything (fail closed). Otherwise reset, apply, then exactly one
 * terminal callback: `onSuccess` on true, `onFailure` on false or a rejected
 * apply. The latch is cleared in `finally`, before the callback runs.
 *
 * 261112-i6d: the host is yielded ONE painted frame on BOTH sides of the
 * latch. A re-bake only yields between fed strokes (and not at all for a
 * single-stroke script), so without the entry yield the busy state opened
 * below could never paint — the canvas looked dead for the whole replay and
 * then jumped to the result. The exit yield is the mirror: closing the latch
 * only removes the blocker from the DOM, and a webview that has just been
 * blocked must still be handed the turns that commit that removal, or the last
 * painted frame keeps the blocker on screen until the next input event.
 */
export async function runAquarelleScriptRebake(sequence: AquarelleScriptRebakeSequence): Promise<boolean> {
  if (sequence.isInFlight()) return false;
  sequence.beginInFlight();
  let ok = false;
  try {
    await yieldForPaint();
    sequence.resetSheet();
    ok = await sequence.applyTimeline();
  } catch {
    ok = false;
  } finally {
    sequence.endInFlight();
  }
  await yieldForPaint();
  if (ok) sequence.onSuccess?.();
  else sequence.onFailure?.();
  return ok;
}
