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
export interface RailKeyScriptSlice {
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
 * stroke; a slot with no starting stroke inherits the last stroke that started
 * at or before it, and a leading gap inherits the first stroke of the nearest
 * later non-empty slot. Every key therefore owns at least one stroke, which is
 * what keeps Move/Select available on every key.
 */
export function sliceRailKeyScripts(input: SliceRailKeyScriptsInput): readonly RailKeyScriptSlice[] {
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
    for (const anchor of anchors) {
      const slot = Math.max(0, Math.min(lastSlot, Math.trunc(anchor.startFrame)));
      buckets[slot]!.push(anchor);
    }
    // Every key must own at least one stroke: a slot with no starting stroke
    // inherits the LAST stroke that started before it; a leading gap inherits
    // the FIRST stroke of the nearest later non-empty slot.
    let lastStarted: RailKeyScriptAnchor | null = null;
    for (let slot = 0; slot <= lastSlot; slot += 1) {
      const bucket = buckets[slot]!;
      if (bucket.length > 0) {
        lastStarted = bucket[bucket.length - 1]!;
        continue;
      }
      const inherited = lastStarted ?? firstStartedAfter(buckets, slot) ?? anchors[anchors.length - 1]!;
      bucket.push(inherited);
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

function firstStartedAfter(
  buckets: readonly (readonly RailKeyScriptAnchor[])[],
  slot: number,
): RailKeyScriptAnchor | null {
  for (let index = slot + 1; index < buckets.length; index += 1) {
    const bucket = buckets[index]!;
    if (bucket.length > 0) return bucket[0]!;
  }
  return null;
}
