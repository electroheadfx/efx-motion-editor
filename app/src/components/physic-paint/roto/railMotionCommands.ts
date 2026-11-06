/**
 * Rail motion commands (Phase 59, 59-12).
 *
 * The ONE writer surface for the rail-motion collection. Every command is a
 * pure function of the current records plus a target description and returns
 * either `{ ok: true, records }` or `{ ok: false, reason }`. The store setter
 * (`replaceRotoPhysicalRailMotions`, 59-07) is the only commit path; this
 * module never imports the store, a signal, a component or the DOM.
 *
 * Identity and collection edits are composed from the 59-06 bindings and the
 * 59-02 reducer so no second insertion/removal policy exists here.
 */

import {
  PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER,
  applyRailMotionEditToCollection,
  type PhysicPaintRotoRailMotionChannel,
  type PhysicPaintRotoRailMotionChannelId,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  bindKeyRail,
  bindLoopRail,
  type RailMotionRailView,
} from './railMotionIdentity';
import { resolveRailLocalFrame } from './railMotionEvaluator';
import type { RailSetIdentity } from './physicsPaintRotoRailSetSelection';

/** Successful command result: the next collection, never a mutated input. */
export interface RailMotionCommandSuccess {
  readonly ok: true;
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  /** True only when a removal cascade deleted the whole record (D-15). */
  readonly recordRemoved: boolean;
}

/** Refused command: a plain sentence the action bar renders verbatim. */
export interface RailMotionCommandFailure {
  readonly ok: false;
  readonly reason: string;
}

export type RailMotionCommandResult = RailMotionCommandSuccess | RailMotionCommandFailure;

function failure(reason: string): RailMotionCommandFailure {
  return Object.freeze({ ok: false, reason }) as RailMotionCommandFailure;
}

function success(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  recordRemoved = false,
): RailMotionCommandSuccess {
  return Object.freeze({ ok: true, records, recordRemoved }) as RailMotionCommandSuccess;
}

function isBoundedId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

/**
 * Converts an app frame into the rail-local frame a Motion key is stored at.
 *
 * This is the ONLY conversion in the command layer: `resolveRailLocalFrame`
 * performs the subtraction (59-05) and the result is clamped into the rail's
 * keyed span, so a cursor outside the rail still seeds a frame the rail owns.
 * A non-finite cursor is a programming error, not a frame to guess at.
 */
export function railMotionCursorFrame(view: RailMotionRailView, cursorFrame: number): number {
  if (!Number.isFinite(cursorFrame)) {
    throw new Error(
      `PhysicPaintRotoRailMotionCommands: railMotionCursorFrame requires a finite cursor frame (got ${String(cursorFrame)}).`,
    );
  }
  const local = resolveRailLocalFrame(cursorFrame, view.startFrame);
  const lastKeyedFrame = Math.floor(view.endFrameExclusive - view.startFrame) - 1;
  return Math.min(local, Math.max(0, lastKeyedFrame));
}

/**
 * The live rail view for a session rail-set identity. Loop identity resolves
 * through `loopId`; a Key Rail resolves through the first drawing key the view
 * carries as its recovery hint (the anchor), never through a railId the bare
 * rail does not have yet.
 */
export function resolveSelectedRailView(
  views: readonly RailMotionRailView[],
  selectedRail: RailSetIdentity | null,
): RailMotionRailView | null {
  if (selectedRail === null) return null;
  if (selectedRail.kind === 'loop') {
    return views.find((view) => view.loopId === selectedRail.loopId) ?? null;
  }
  return views.find(
    (view) => view.loopId === null && view.anchorKeyId === selectedRail.firstKeyId,
  ) ?? null;
}

export interface AnimateRailInput {
  /** Every live rail view — used only to exclude loop-owned records from the anchor lookup. */
  readonly views: readonly RailMotionRailView[];
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  /** The rail being animated. */
  readonly view: RailMotionRailView;
  /** App frame of the playhead; never moved by this command. */
  readonly cursorFrame: number;
}

/**
 * Animates the selected rail (D-02/MOTN-01): seeds its one identity Position
 * key at the rail-local playhead.
 *
 * A Loop Clip rail binds by `loopId` and mints nothing. Any other rail binds to
 * its already-assigned `railId` when the view carries one, otherwise it reuses
 * the record it already owns (matched by the anchor hint) so a second Animate
 * is idempotent, and only a genuinely unanimated rail mints one rail id. No
 * drawing key, loop clip, break or group override is read for mutation or
 * written.
 */
export function animateRail(input: AnimateRailInput): RailMotionCommandResult {
  const { view } = input;
  if (!Number.isFinite(input.cursorFrame)) {
    return failure('The playhead is not on a valid frame.');
  }
  if (!isBoundedId(view.anchorKeyId)) {
    return failure('This rail has no key to attach motion to.');
  }

  let railId: string;
  let anchorKeyId: string;
  if (view.loopId !== null) {
    const binding = bindLoopRail(view.loopId, view.anchorKeyId);
    railId = binding.railId;
    anchorKeyId = binding.anchorKeyId;
  } else if (view.railId !== null) {
    railId = view.railId;
    anchorKeyId = view.anchorKeyId;
  } else {
    const liveLoopIds = new Set<string>();
    for (const candidate of input.views) {
      if (candidate.loopId !== null) liveLoopIds.add(candidate.loopId);
    }
    const bound = input.records.find(
      (record) => record.anchorKeyId === view.anchorKeyId && !liveLoopIds.has(record.railId),
    );
    if (bound !== undefined) {
      railId = bound.railId;
      anchorKeyId = view.anchorKeyId;
    } else {
      const binding = bindKeyRail(view.anchorKeyId);
      railId = binding.railId;
      anchorKeyId = binding.anchorKeyId;
    }
  }

  const frame = railMotionCursorFrame(view, input.cursorFrame);
  const next = applyRailMotionEditToCollection(input.records, {
    kind: 'animate',
    railId,
    anchorKeyId,
    frame,
  });
  return success(next);
}

/** The commands the 59-12 action bar can publish. */
export type RailMotionCommandId = 'animate';

export interface RailMotionCommandAvailabilityInput {
  readonly command: RailMotionCommandId;
  /** A rail is selected in the active track's rail scope. */
  readonly hasRail: boolean;
}

export interface RailMotionCommandAvailability {
  readonly enabled: boolean;
  readonly reason: string | null;
}

/**
 * One availability authority (T-59-35). The view renders `reason` verbatim and
 * never derives a disabled state locally.
 *
 * Animate is available for EVERY rail type: there is no conversion step and no
 * cycle value (MUI-01/MOTN-01), so the only unavailable case is "no rail".
 */
export function resolveMotionCommandAvailability(
  input: RailMotionCommandAvailabilityInput,
): RailMotionCommandAvailability {
  if (input.command === 'animate') {
    if (!input.hasRail) {
      return Object.freeze({ enabled: false, reason: 'Select a rail to animate it.' }) as RailMotionCommandAvailability;
    }
    return Object.freeze({ enabled: true, reason: null }) as RailMotionCommandAvailability;
  }
  return Object.freeze({
    enabled: false,
    reason: 'This Motion command is not available.',
  }) as RailMotionCommandAvailability;
}

/**
 * The model channel ids a grouped display lane writes in one command call
 * (D-11/D-12). Exported so the view and the tests share one grouping rule.
 */
export function resolveMotionCommandChannelIds(
  channelId: PhysicPaintRotoRailMotionChannelId,
): readonly PhysicPaintRotoRailMotionChannelId[] {
  if (channelId === 'position-x' || channelId === 'position-y') {
    return Object.freeze(['position-x', 'position-y']) as readonly PhysicPaintRotoRailMotionChannelId[];
  }
  return Object.freeze([channelId]) as readonly PhysicPaintRotoRailMotionChannelId[];
}

/** The canonical model channels present on a record, in D-13 order. */
export function resolveRecordChannels(
  record: PhysicPaintRotoRailMotionRecord | null,
): readonly PhysicPaintRotoRailMotionChannel[] {
  if (record === null) return Object.freeze([]) as readonly PhysicPaintRotoRailMotionChannel[];
  return Object.freeze(
    PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER
      .map((id) => record.channels.find((channel) => channel.id === id))
      .filter((channel): channel is PhysicPaintRotoRailMotionChannel => channel !== undefined),
  ) as readonly PhysicPaintRotoRailMotionChannel[];
}
