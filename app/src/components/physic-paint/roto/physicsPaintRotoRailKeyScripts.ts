import type { AquarelleStroke, AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import { aquarelleStrokeFromScriptEvent } from './physicsPaintRotoDuplicateScript';

/**
 * Quick 261030-np9: Create Rail "Save script on each key".
 *
 * The rail's keys must own the script, not settings overrides: on a 5-stroke
 * script over 5 frames F0 owns the top line, F1 the first bar, F2 the "0", F3
 * the second bar and F4 the bottom line, so selecting F1 edits only its bar.
 *
 * The bake is the ONE slicing authority (D-01): it reports the start frame it
 * actually used for each stroke through `onStrokeFrameAnchors`, and this pure
 * module only decides WHICH strokes land on WHICH committed key (D-02). It
 * never re-derives a schedule, never calls `buildProgressiveStrokeSchedule`,
 * never invents a stroke and never emits Dry events.
 */

/** One stroke paired with the output frame the bake started it on. */
export interface RailKeyScriptAnchor {
  readonly stroke: StudioStroke<AquarelleStrokePayload>;
  readonly startFrame: number;
}

/** The strokes one rail key owns, projected onto that key's app frame. */
export interface RailKeyScriptResult {
  /** 0-based cycle slot — the index into the rail's `sourceKeyIds`. */
  readonly slot: number;
  /** The committed key's app frame; every stroke's `playFrame` is this frame. */
  readonly frame: number;
  readonly strokes: readonly AquarelleStroke[];
}

export type RailKeyScriptMode = 'progressive' | 'static';

export interface SliceRailKeyScriptsInput {
  readonly anchors: readonly RailKeyScriptAnchor[];
  /** The committed key app frame per cycle slot, in slot order. */
  readonly frames: readonly number[];
  readonly mode: RailKeyScriptMode;
}

/**
 * D-02. Static = the complete drawing on EVERY key. Progressive = each stroke
 * lands on the key whose slot equals the bake's start-frame index for that
 * stroke, and the key owns EVERY stroke that had started by then. The sheet is
 * cumulative: a key's script must reproduce the picture its frame actually
 * shows, so F0 owns the top line, F1 owns the top line AND the bar, and the
 * last key owns the whole drawing. Slicing to "only the new stroke" left every
 * key after the first unable to reproduce its own frame.
 *
 * A slot before the first anchor still owns the first stroke, so no key is
 * ever script-less and Move/Select stays available on every key.
 */
export function sliceRailKeyScripts(input: SliceRailKeyScriptsInput): readonly RailKeyScriptResult[] {
  const { anchors, frames } = input;
  // No anchor means the bake reported no schedule — never fabricate a script.
  if (anchors.length === 0 || frames.length === 0) return [];

  const lastSlot = frames.length - 1;
  const buckets: RailKeyScriptAnchor[][] = frames.map(() => []);

  if (input.mode === 'static') {
    for (const anchor of anchors) {
      for (const bucket of buckets) bucket.push(anchor);
    }
  } else {
    const clamped = anchors.map((anchor) => ({
      anchor,
      slot: Math.max(0, Math.min(lastSlot, Math.trunc(anchor.startFrame))),
    }));
    for (let slot = 0; slot <= lastSlot; slot += 1) {
      const bucket = buckets[slot]!;
      for (const entry of clamped) {
        if (entry.slot <= slot) bucket.push(entry.anchor);
      }
      if (bucket.length === 0) bucket.push(clamped[0]!.anchor);
    }
  }

  return buckets.map((bucket, slot) => {
    const frame = frames[slot]!;
    return {
      slot,
      frame,
      strokes: bucket.map((anchor) => aquarelleStrokeFromScriptEvent(anchor.stroke, frame)),
    };
  });
}
