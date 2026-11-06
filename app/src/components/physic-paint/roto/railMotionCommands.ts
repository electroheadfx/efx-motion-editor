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
  RAIL_MOTION_FRAME_LIMIT,
  RAIL_MOTION_WIGGLE_LIMIT,
  applyRailMotionEditToCollection,
  railMotionValueIsValid,
  type PhysicPaintRotoRailMotionChannel,
  type PhysicPaintRotoRailMotionChannelId,
  type PhysicPaintRotoRailMotionEasing,
  type PhysicPaintRotoRailMotionKey,
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

export interface SetMotionKeyAtCursorInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly railId: string;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  /** The rail-local frame the key lands on (see {@link railMotionCursorFrame}). */
  readonly keyFrame: number;
  /** Explicit value; absent = the channel's current evaluated value. */
  readonly value?: number;
  readonly easing?: PhysicPaintRotoRailMotionEasing;
  readonly wiggle?: number;
}

export interface RemoveMotionKeyInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly railId: string;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  readonly keyFrame: number;
}

export interface StepMotionKeyInput {
  readonly channel: PhysicPaintRotoRailMotionChannel;
  readonly fromFrame: number;
  readonly direction: -1 | 1;
}

export interface SetMotionKeyEasingInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly railId: string;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  readonly keyFrame: number;
  readonly easing: PhysicPaintRotoRailMotionEasing;
}

export interface SetMotionKeyWiggleInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly railId: string;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  readonly keyFrame: number;
  readonly wiggle: number;
}

/**
 * The three independent selection scopes (MOTN-11). A rail scope may coexist
 * with a key scope; the two key scopes never coexist. The strip renders one
 * contextual command list per active scope and never decides the scope itself.
 */
export type RailMotionSelectionScope = 'rail' | 'drawing-key' | 'motion-key';

/** Session-only identity of the selected Motion key (rail-local frame). */
export interface RailMotionKeySelection {
  readonly railId: string;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  readonly frame: number;
}

export interface ResolveSelectionScopeInput {
  readonly hasRail: boolean;
  readonly hasDrawingKey: boolean;
  readonly hasMotionKey: boolean;
}

/** One scope authority: a key scope wins over the rail scope it rides on. */
export function resolveSelectionScope(
  _input: ResolveSelectionScopeInput,
): RailMotionSelectionScope | null {
  return null;
}

/** The addressed Motion key on a record, or null when the frame carries none. */
export function resolveMotionKeyAtFrame(
  _record: PhysicPaintRotoRailMotionRecord | null,
  _channelId: PhysicPaintRotoRailMotionChannelId,
  _railLocalFrame: number,
): PhysicPaintRotoRailMotionKey | null {
  return null;
}

/** Adds or updates the addressed Motion key. RED stub — GREEN fills the policy. */
export function setMotionKeyAtCursor(_input: SetMotionKeyAtCursorInput): RailMotionCommandResult {
  return failure('The Motion key could not be written.');
}

/** Removes the addressed Motion key. RED stub — GREEN fills the policy. */
export function removeMotionKey(_input: RemoveMotionKeyInput): RailMotionCommandResult {
  return failure('The Motion key could not be removed.');
}

/** Adjacent Motion key frame in the requested direction. RED stub. */
export function stepMotionKey(_input: StepMotionKeyInput): number | null {
  return null;
}

/** Sets Hold/Ease on an existing Motion key. RED stub. */
export function setMotionKeyEasing(_input: SetMotionKeyEasingInput): RailMotionCommandResult {
  return failure('The Motion key easing could not be changed.');
}

/** Sets Wiggle on an existing Motion key. RED stub. */
export function setMotionKeyWiggle(_input: SetMotionKeyWiggleInput): RailMotionCommandResult {
  return failure('The Motion key wiggle could not be changed.');
}

/** The commands the 59-12 action bar can publish. */
export type RailMotionCommandId =
  | 'animate'
  | 'set-motion-key'
  | 'remove-motion-key'
  | 'previous-motion-key'
  | 'next-motion-key'
  | 'set-motion-key-easing'
  | 'set-motion-key-wiggle';

export interface RailMotionCommandAvailabilityInput {
  readonly command: RailMotionCommandId;
  /** A rail is selected in the active track's rail scope. */
  readonly hasRail: boolean;
  /** The rail carries a motion record. */
  readonly hasMotionRecord?: boolean;
  /** A Motion channel is selected (or the addressed lane carries one). */
  readonly hasChannel?: boolean;
  /** The playhead sits inside the rail's keyed span. */
  readonly cursorInsideRailSpan?: boolean;
  /** A Motion key exists at the playhead in the addressed channel. */
  readonly keyAtCursor?: boolean;
  /** An adjacent Motion key exists in the requested direction. */
  readonly hasAdjacentKey?: boolean;
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
