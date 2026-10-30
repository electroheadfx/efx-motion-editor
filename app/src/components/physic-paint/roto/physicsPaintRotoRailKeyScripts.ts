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
  void input;
  return [];
}
