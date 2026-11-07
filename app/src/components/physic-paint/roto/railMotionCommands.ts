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
  railMotionValueFromUi,
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
import { evaluateRailMotionChannel, resolveRailLocalFrame } from './railMotionEvaluator';
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

export interface AddMotionChannelInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  /** The rail the channel joins; null when no rail is selected. */
  readonly railId: string | null;
  /** The DISPLAY channel the affordance addressed (grouped Position -> `position-x`). */
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
}

/**
 * Adds one display channel to a rail that already carries motion (59-17, G1).
 *
 * The `+` row is the only caller: it lists exactly the display lanes the rail
 * does NOT carry, so a refusal here means a stale inventory and names itself
 * instead of silently no-oping (MUI-06). Grouped Position is addressed as
 * `position-x` and the 59-02 reducer seeds BOTH axes in one edit — this
 * command seeds nothing itself, so there is one seeding authority.
 *
 * A refusal returns the input collection reference untouched, so a refused add
 * can never mutate the document (T-59-52).
 */
export function addMotionChannel(input: AddMotionChannelInput): RailMotionCommandResult {
  const { records, railId, channelId } = input;
  if (!isBoundedId(railId)) return failure('Select a rail first.');
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('Animate this rail before adding a Motion channel.');

  const groupedIds = resolveMotionCommandChannelIds(channelId);
  if (record.channels.some((entry) => groupedIds.includes(entry.id))) {
    return failure('This Motion channel is already present.');
  }

  const next = applyRailMotionEditToCollection(records, {
    kind: 'add-channel',
    railId,
    channel: channelId,
  });
  // The reducer returns the SAME reference for an edit it could not apply; a
  // silent no-op would hide the refusal from the user, so report it verbatim.
  if (next === records) return failure('This Motion channel is already present.');
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
  /**
   * Explicit grouped Position sibling value (D-12). Absent = the sibling's
   * current evaluated value. The gizmo supplies it so both axes are written
   * from the SAME gesture sample, never from a wiggle-perturbed evaluation.
   */
  readonly pairedValue?: number;
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
 * The three independent selection scopes (MOTN-11) live with the rail-set
 * selection authority; re-exported here so the command layer stays the one
 * import site for the strip. A rail scope may coexist with a key scope; the
 * two key scopes never coexist. The strip renders one contextual command list
 * per active scope and never decides the scope itself.
 */
export {
  RAIL_MOTION_SELECTION_SCOPES,
  clearSelectionForScope,
  resolveSelectionScope,
  type RailMotionKeySelection,
  type RailMotionSelectionScope,
  type RailSelectionScopesState,
  type ResolveSelectionScopeInput,
} from './physicsPaintRotoRailSetSelection';
import type { RailMotionSelectionScope } from './physicsPaintRotoRailSetSelection';

/** The addressed Motion key on a record, or null when the frame carries none. */
export function resolveMotionKeyAtFrame(
  record: PhysicPaintRotoRailMotionRecord | null,
  channelId: PhysicPaintRotoRailMotionChannelId,
  railLocalFrame: number,
): PhysicPaintRotoRailMotionKey | null {
  if (record === null) return null;
  const channel = record.channels.find((entry) => entry.id === channelId);
  if (channel === undefined) return null;
  return channel.keys.find((key) => key.frame === railLocalFrame) ?? null;
}

function isRailMotionFrameValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= RAIL_MOTION_FRAME_LIMIT;
}

function isRailMotionWiggleValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= RAIL_MOTION_WIGGLE_LIMIT;
}

function isRailMotionEasingValue(value: unknown): value is PhysicPaintRotoRailMotionEasing {
  return value === 'hold' || value === 'ease';
}

function findRailMotionRecord(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId: string,
): PhysicPaintRotoRailMotionRecord | null {
  return records.find((entry) => entry.railId === railId) ?? null;
}

function positionSiblingId(
  channelId: PhysicPaintRotoRailMotionChannelId,
): 'position-x' | 'position-y' | null {
  if (channelId === 'position-x') return 'position-y';
  if (channelId === 'position-y') return 'position-x';
  return null;
}

/**
 * Adds or updates a Motion key (D-12/D-15 are the reducer's policy; this
 * composes it). A new key takes the channel's evaluated value at the cursor
 * unless an explicit value is supplied, so adding a key never moves the pose.
 * Grouped Position carries the sibling's evaluated value in the SAME reducer
 * call, so both axes are written atomically.
 */
export function setMotionKeyAtCursor(input: SetMotionKeyAtCursorInput): RailMotionCommandResult {
  const { records, railId, channelId, keyFrame } = input;
  if (!isBoundedId(railId)) return failure('Select a rail first.');
  if (!isRailMotionFrameValue(keyFrame)) return failure('The Motion key frame is not valid.');
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('This rail has no Motion to edit yet.');
  if (!record.channels.some((entry) => entry.id === channelId)) {
    return failure('This Motion channel is not present on the rail.');
  }
  if (input.easing !== undefined && !isRailMotionEasingValue(input.easing)) {
    return failure('Easing must be Hold or Ease.');
  }
  if (input.wiggle !== undefined && !isRailMotionWiggleValue(input.wiggle)) {
    return failure('Wiggle must be between 0 and 1,000,000.');
  }
  const value = input.value ?? evaluateRailMotionChannel(record, channelId, keyFrame);
  if (!railMotionValueIsValid(channelId, value)) {
    return failure('This value is outside the Motion channel range.');
  }
  const siblingId = positionSiblingId(channelId);
  let pairedValue: number | undefined;
  if (siblingId !== null) {
    if (input.pairedValue !== undefined) {
      if (!railMotionValueIsValid(siblingId, input.pairedValue)) {
        return failure('This value is outside the Motion channel range.');
      }
      pairedValue = input.pairedValue;
    } else if (record.channels.some((entry) => entry.id === siblingId)) {
      pairedValue = evaluateRailMotionChannel(record, siblingId, keyFrame);
    }
  }

  try {
    const next = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId,
      channel: channelId,
      frame: keyFrame,
      value,
      ...(input.easing !== undefined ? { easing: input.easing } : {}),
      ...(input.wiggle !== undefined ? { wiggle: input.wiggle } : {}),
      ...(pairedValue !== undefined ? { pairedValue } : {}),
    });
    return success(next);
  } catch {
    return failure('The Motion key could not be written.');
  }
}

/**
 * Removes the addressed Motion key. D-15 (key -> channel -> record) is the
 * reducer's cascade; this reports the whole-record removal back to the row.
 */
export function removeMotionKey(input: RemoveMotionKeyInput): RailMotionCommandResult {
  const { records, railId, channelId, keyFrame } = input;
  if (!isBoundedId(railId)) return failure('Select a rail first.');
  if (!isRailMotionFrameValue(keyFrame)) return failure('The Motion key frame is not valid.');
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('This rail has no Motion to edit yet.');
  if (!record.channels.some((entry) => entry.id === channelId)) {
    return failure('This Motion channel is not present on the rail.');
  }
  if (resolveMotionKeyAtFrame(record, channelId, keyFrame) === null) {
    return failure('There is no Motion key at this frame.');
  }

  try {
    const next = applyRailMotionEditToCollection(records, {
      kind: 'remove-key',
      railId,
      channel: channelId,
      frame: keyFrame,
    });
    return success(next, !next.some((entry) => entry.railId === railId));
  } catch {
    return failure('The Motion key could not be removed.');
  }
}

/** The adjacent Motion key frame in one direction; never wraps (null at the end). */
export function stepMotionKey(input: StepMotionKeyInput): number | null {
  const { channel, fromFrame, direction } = input;
  if (!Number.isFinite(fromFrame)) return null;
  let best: number | null = null;
  for (const key of channel.keys) {
    if (!Number.isFinite(key.frame)) continue;
    const isCandidate = direction < 0 ? key.frame < fromFrame : key.frame > fromFrame;
    if (!isCandidate) continue;
    if (best === null || (direction < 0 ? key.frame > best : key.frame < best)) {
      best = key.frame;
    }
  }
  return best;
}

/** The property change a grouped-axis edit applies to every addressed axis. */
interface RailMotionKeyPropertyEdit {
  readonly easing?: PhysicPaintRotoRailMotionEasing;
  readonly wiggle?: number;
}

/**
 * Applies one property change to every model axis a grouped display lane
 * addresses (D-11/D-12, WR-04).
 *
 * The submitted axis gates the command and is edited FIRST; every remaining
 * axis is then re-resolved from the records the previous edit produced. That
 * ordering is what keeps the result symmetric when the lane addresses
 * `position-y`: the reducer's D-12 rule seeds the keyless paired axis at the
 * edit frame, and the follow-up edit reaches that seeded key. Each axis is
 * edited with its OWN resolved value, and no `pairedValue` is ever passed — an
 * easing/wiggle edit authors no values, so it can never overwrite a sibling's
 * stored value.
 */
function applyAxisMotionKeyEdits(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId: string,
  channelId: PhysicPaintRotoRailMotionChannelId,
  channelIds: readonly PhysicPaintRotoRailMotionChannelId[],
  keyFrame: number,
  editFor: () => RailMotionKeyPropertyEdit,
  failureReason: string,
): RailMotionCommandResult {
  const record = findRailMotionRecord(records, railId);
  if (resolveMotionKeyAtFrame(record, channelId, keyFrame) === null) {
    return failure('There is no Motion key at this frame.');
  }

  const orderedIds: PhysicPaintRotoRailMotionChannelId[] = [
    channelId,
    ...channelIds.filter((id) => id !== channelId),
  ];
  let next = records;
  try {
    for (const axisId of orderedIds) {
      const axisKey = resolveMotionKeyAtFrame(
        findRailMotionRecord(next, railId),
        axisId,
        keyFrame,
      );
      // Reachable only when the record carries no channel entry for that axis
      // at all; a paired axis that merely lacks a key was just seeded by D-12.
      if (axisKey === null) continue;
      next = applyRailMotionEditToCollection(next, {
        kind: 'set-key',
        railId,
        channel: axisId,
        frame: keyFrame,
        value: axisKey.value,
        ...editFor(),
      });
    }
    return success(next);
  } catch {
    return failure(failureReason);
  }
}

/** Sets Hold/Ease on every Motion axis the grouped lane addresses (WR-04). */
export function setMotionKeyEasing(input: SetMotionKeyEasingInput): RailMotionCommandResult {
  const { records, railId, channelId, keyFrame, easing } = input;
  if (!isRailMotionEasingValue(easing)) return failure('Easing must be Hold or Ease.');
  if (!isBoundedId(railId)) return failure('Select a rail first.');
  if (!isRailMotionFrameValue(keyFrame)) return failure('The Motion key frame is not valid.');
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('This rail has no Motion to edit yet.');

  return applyAxisMotionKeyEdits(
    records,
    railId,
    channelId,
    resolveMotionCommandChannelIds(channelId),
    keyFrame,
    () => ({ easing }),
    'The Motion key easing could not be changed.',
  );
}

/** Sets Wiggle on every Motion axis the grouped lane addresses (WR-04). */
export function setMotionKeyWiggle(input: SetMotionKeyWiggleInput): RailMotionCommandResult {
  const { records, railId, channelId, keyFrame, wiggle } = input;
  if (!isRailMotionWiggleValue(wiggle)) {
    return failure('Wiggle must be between 0 and 1,000,000.');
  }
  if (!isBoundedId(railId)) return failure('Select a rail first.');
  if (!isRailMotionFrameValue(keyFrame)) return failure('The Motion key frame is not valid.');
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('This rail has no Motion to edit yet.');

  return applyAxisMotionKeyEdits(
    records,
    railId,
    channelId,
    resolveMotionCommandChannelIds(channelId),
    keyFrame,
    () => ({ wiggle }),
    'The Motion key wiggle could not be changed.',
  );
}

/** The commands the 59-12 action bar can publish. */
export type RailMotionCommandId =
  | 'animate'
  | 'add-motion-channel'
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
  /**
   * At least one display lane still carries no keys, so an add can succeed
   * (59-17). The add-channel row derives it from the same display projection
   * the block renders, never from a second inventory walk.
   */
  readonly hasKeylessChannel?: boolean;
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

function available(): RailMotionCommandAvailability {
  return Object.freeze({ enabled: true, reason: null }) as RailMotionCommandAvailability;
}

function unavailable(reason: string): RailMotionCommandAvailability {
  return Object.freeze({ enabled: false, reason }) as RailMotionCommandAvailability;
}

/**
 * One availability authority (T-59-35). The view renders `reason` verbatim and
 * never derives a disabled state locally.
 *
 * Animate is available for EVERY rail type: there is no conversion step and no
 * cycle value (MUI-01/MOTN-01), so the only unavailable case is "no rail".
 * Every other command names its exact missing prerequisite, in a fixed order:
 * rail -> channel -> cursor span -> key presence -> adjacency.
 *
 * 59-17: `add-motion-channel` answers on the rail and the channel INVENTORY
 * only. It addresses a lane, not a selected channel or a cursor frame, so its
 * branch sits between the rail guard and the channel-selection guard.
 */
export function resolveMotionCommandAvailability(
  input: RailMotionCommandAvailabilityInput,
): RailMotionCommandAvailability {
  if (input.command === 'animate') {
    return input.hasRail ? available() : unavailable('Select a rail to animate it.');
  }
  if (!input.hasRail) return unavailable('Select a rail first.');
  if (input.command === 'add-motion-channel') {
    if (input.hasMotionRecord !== true) {
      return unavailable('Animate this rail before adding a Motion channel.');
    }
    return input.hasKeylessChannel === true
      ? available()
      : unavailable('Every Motion channel is already present on this rail.');
  }
  if (input.command === 'previous-motion-key') {
    return input.hasAdjacentKey === true
      ? available()
      : unavailable('There is no earlier Motion key in this rail.');
  }
  if (input.command === 'next-motion-key') {
    return input.hasAdjacentKey === true
      ? available()
      : unavailable('There is no later Motion key in this rail.');
  }
  if (input.hasChannel === false) return unavailable('Select a Motion channel first.');
  if (input.command === 'set-motion-key-easing' || input.command === 'set-motion-key-wiggle') {
    return input.keyAtCursor === true
      ? available()
      : unavailable('Select a Motion key first.');
  }
  if (input.cursorInsideRailSpan === false) {
    return unavailable('Move the playhead inside this rail first.');
  }
  if (input.command === 'set-motion-key') {
    return input.keyAtCursor === true
      ? unavailable('A Motion key already exists at this frame.')
      : available();
  }
  if (input.command === 'remove-motion-key') {
    return input.keyAtCursor === true
      ? available()
      : unavailable('There is no Motion key at this frame.');
  }
  return unavailable('This Motion command is not available.');
}

/**
 * 59-12 Task 3 (MOTN-11): the contextual command vocabulary. Each command
 * belongs to exactly ONE scope list — a command that does not apply is absent,
 * not disabled. Motion commands reuse `RailMotionCommandId`; the other scopes
 * name their own commands so the three lists can never overlap by accident.
 */
export type RotoContextualCommandId =
  | RailMotionCommandId
  | 'scissor-key-rail'
  | 'delete-rails'
  | 'insert-key'
  | 'delete-key'
  | 'move-keys';

/**
 * The ONE per-scope command table. The strip renders its action bar from this
 * table instead of an inline condition list.
 */
export const CONTEXTUAL_COMMANDS_BY_SCOPE: Readonly<
  Record<RailMotionSelectionScope, readonly RotoContextualCommandId[]>
> = Object.freeze({
  rail: Object.freeze(['animate', 'scissor-key-rail', 'delete-rails'] as const),
  'drawing-key': Object.freeze(['insert-key', 'delete-key', 'move-keys'] as const),
  'motion-key': Object.freeze([
    'set-motion-key',
    'remove-motion-key',
    'set-motion-key-easing',
    'set-motion-key-wiggle',
    'previous-motion-key',
    'next-motion-key',
  ] as const),
});

const NO_CONTEXTUAL_COMMANDS: readonly RotoContextualCommandId[] = Object.freeze([] as const);

/** The ordered command ids for the active scope; empty when no scope is active. */
export function resolveContextualMotionCommands(
  scope: RailMotionSelectionScope | null,
): readonly RotoContextualCommandId[] {
  return scope === null ? NO_CONTEXTUAL_COMMANDS : CONTEXTUAL_COMMANDS_BY_SCOPE[scope];
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

// ---------------------------------------------------------------------------
// 59-13: the canvas gizmo. `values` is expressed in DISPLAY units — pixels for
// Position, PERCENT for Scale, DEGREES for Rotation — and is converted through
// the 59-02 `railMotionValueFromUi` pair at this one boundary. Opacity is not
// writable here (D-07); a rotation is never normalized or wrapped (D-13).
// ---------------------------------------------------------------------------

/** Display-unit transform values a gizmo drag produces (UI units, not model). */
export interface RailMotionTransformValues {
  /** Position in project pixels; when present BOTH axes are written. */
  readonly position?: { readonly x: number; readonly y: number };
  /** Uniform Scale in PERCENT (100 = identity). */
  readonly scale?: number;
  /** Rotation in DEGREES, never wrapped. */
  readonly rotation?: number;
}

export interface RailMotionGizmoAvailability {
  readonly enabled: boolean;
  readonly reason: string | null;
}

export interface MotionGizmoAvailabilityInput {
  /** The mounted rail's non-null railId, or null when no animated rail is selected. */
  readonly selectedRailId: string | null;
  /** Channel ids that already carry at least one Motion key on the selected rail. */
  readonly animatedChannelIds: readonly PhysicPaintRotoRailMotionChannelId[];
  readonly cursorInsideSpan: boolean;
}

/** The channels the canvas gizmo can drag; Opacity is numeric-only (D-07). */
const MOTION_GIZMO_CHANNEL_IDS: ReadonlySet<PhysicPaintRotoRailMotionChannelId> = new Set([
  'position-x',
  'position-y',
  'scale',
  'rotation',
]);

/**
 * The gizmo's availability gate. It answers, it never derives a disabled state
 * inside the gesture: no animated rail, no draggable channel, or a playhead
 * outside the rail's keyed span are the three refusals.
 */
export function resolveMotionGizmoAvailability(
  input: MotionGizmoAvailabilityInput,
): RailMotionGizmoAvailability {
  if (!isBoundedId(input.selectedRailId)) {
    return Object.freeze({
      enabled: false,
      reason: 'Select an animated rail to edit its motion.',
    }) as RailMotionGizmoAvailability;
  }
  if (!input.animatedChannelIds.some((channelId) => MOTION_GIZMO_CHANNEL_IDS.has(channelId))) {
    return Object.freeze({
      enabled: false,
      reason: input.animatedChannelIds.length === 0
        ? 'Animate the rail before dragging it.'
        : 'This rail has no draggable Motion channel.',
    }) as RailMotionGizmoAvailability;
  }
  if (!input.cursorInsideSpan) {
    return Object.freeze({
      enabled: false,
      reason: 'Move the playhead inside the rail to edit its motion.',
    }) as RailMotionGizmoAvailability;
  }
  return Object.freeze({ enabled: true, reason: null }) as RailMotionGizmoAvailability;
}

/**
 * The pointer-move sink: a PURE frozen merge of the gesture's present channels
 * into the session draft. It imports no store and no signal, so "N draft steps
 * write nothing" is structural — there is no write path to call from here.
 */
export function mergeRailMotionDraft(
  draft: RailMotionTransformValues | null,
  next: RailMotionTransformValues,
): RailMotionTransformValues {
  const position = next.position ?? draft?.position;
  const scale = next.scale ?? draft?.scale;
  const rotation = next.rotation ?? draft?.rotation;
  return Object.freeze({
    ...(position !== undefined
      ? { position: Object.freeze({ x: position.x, y: position.y }) }
      : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
  }) as RailMotionTransformValues;
}

export interface WriteMotionTransformAtCursorInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  /** The mounted rail view; its railId MUST be non-null (59-06 mount gate). */
  readonly view: RailMotionRailView;
  /** App-frame playhead; converted by {@link railMotionCursorFrame}. */
  readonly cursorFrame: number;
  /** Display-unit values; every PRESENT channel is the D-08 gate input. */
  readonly values: RailMotionTransformValues;
}

/**
 * The gizmo's ONE commit path. It resolves the rail-local frame through the
 * 59-12 helper (no second span clamp), applies the D-08 gate to every channel
 * present in the partial, and delegates to {@link setMotionKeyAtCursor}. A
 * Position drag writes the grouped pair in the SAME call via `pairedValue`, so
 * both axes come from one gesture sample.
 */
export function writeMotionTransformAtCursor(
  input: WriteMotionTransformAtCursorInput,
): RailMotionCommandResult {
  const { records, view, cursorFrame, values } = input;
  if (!Number.isFinite(cursorFrame)) return failure('The playhead is not on a valid frame.');
  const railId = view.railId;
  if (!isBoundedId(railId)) return failure('Animate the rail before dragging it.');
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('This rail has no Motion to edit yet.');

  const hasPosition = values.position !== undefined;
  const hasScale = values.scale !== undefined;
  const hasRotation = values.rotation !== undefined;
  if (!hasPosition && !hasScale && !hasRotation) {
    return failure('The drag did not change a Motion channel.');
  }

  // D-08 as revised at UAT: a grouped Position drag still needs BOTH axes
  // animated (writing one axis would invent motion on the other), but an
  // explicit Scale/Rotation handle drag now AUTO-ADDS that channel in the same
  // gesture. The old refusal made those handles lie: they previewed during the
  // drag and snapped back on release whenever the channel had not been added
  // first through the lane's `+` row.
  if (hasPosition) {
    for (const channelId of ['position-x', 'position-y'] as const) {
      if (!record.channels.some((entry) => entry.id === channelId)) {
        return failure('This Motion channel has no keys yet.');
      }
    }
  }
  let seeded: readonly PhysicPaintRotoRailMotionRecord[] = records;
  for (const channelId of [
    ...(hasScale ? ['scale'] as const : []),
    ...(hasRotation ? ['rotation'] as const : []),
  ]) {
    const currentRecord = findRailMotionRecord(seeded, railId);
    if (currentRecord === null) return failure('This rail has no Motion to edit yet.');
    if (currentRecord.channels.some((entry) => entry.id === channelId)) continue;
    const added = applyRailMotionEditToCollection(seeded, {
      kind: 'add-channel',
      railId,
      channel: channelId,
    });
    if (added === seeded) return failure('This Motion channel could not be added.');
    seeded = added;
  }

  const keyFrame = railMotionCursorFrame(view, cursorFrame);
  const position = hasPosition
    ? {
      x: railMotionValueFromUi('position-x', values.position!.x),
      y: railMotionValueFromUi('position-y', values.position!.y),
    }
    : null;
  const scale = hasScale ? railMotionValueFromUi('scale', values.scale!) : null;
  const rotation = hasRotation ? railMotionValueFromUi('rotation', values.rotation!) : null;

  const converted: number[] = [];
  if (position !== null) converted.push(position.x, position.y);
  if (scale !== null) converted.push(scale);
  if (rotation !== null) converted.push(rotation);
  if (!converted.every((value) => Number.isFinite(value))) {
    return failure('This value is outside the Motion channel range.');
  }
  if (position !== null && (
    !railMotionValueIsValid('position-x', position.x)
    || !railMotionValueIsValid('position-y', position.y)
  )) {
    return failure('This value is outside the Motion channel range.');
  }
  if (scale !== null && !railMotionValueIsValid('scale', scale)) {
    return failure('This value is outside the Motion channel range.');
  }
  if (rotation !== null && !railMotionValueIsValid('rotation', rotation)) {
    return failure('This value is outside the Motion channel range.');
  }

  let current: readonly PhysicPaintRotoRailMotionRecord[] = seeded;
  if (position !== null) {
    const written = setMotionKeyAtCursor({
      records: current,
      railId,
      channelId: 'position-x',
      keyFrame,
      value: position.x,
      pairedValue: position.y,
    });
    if (!written.ok) return written;
    current = written.records;
  }
  if (scale !== null) {
    const written = setMotionKeyAtCursor({
      records: current,
      railId,
      channelId: 'scale',
      keyFrame,
      value: scale,
    });
    if (!written.ok) return written;
    current = written.records;
  }
  if (rotation !== null) {
    const written = setMotionKeyAtCursor({
      records: current,
      railId,
      channelId: 'rotation',
      keyFrame,
      value: rotation,
    });
    if (!written.ok) return written;
    current = written.records;
  }
  return success(current);
}

// ---------------------------------------------------------------------------
// 59-16: the numeric Motion inspector. `uiValue` is a DISPLAY-unit number
// (pixels / percent / degrees) entered in one field; it is converted through
// the same 59-02 pair the gizmo uses, so the two edit paths converge on one
// stored collection. Rotation is passed through untouched: no wrap, no
// shortest-arc rewrite, no degrees/radians conversion at this boundary.
// ---------------------------------------------------------------------------

/** The visible sentence for an out-of-domain entry, per channel (T-59-39). */
function railMotionValueDomainReason(channelId: PhysicPaintRotoRailMotionChannelId): string {
  if (channelId === 'scale') return 'Scale must be greater than 0.';
  if (channelId === 'opacity') return 'Opacity must be between 0 and 100.';
  if (channelId === 'position-x' || channelId === 'position-y') {
    return 'Position must be between -1,000,000 and 1,000,000 px.';
  }
  return 'This value is outside the Motion channel range.';
}

export interface WriteRailMotionChannelValueAtCursorInput {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  /** The record's railId; null when no animated rail is selected. */
  readonly railId: string | null;
  /** The selected Motion key's rail-local frame (fields never move the playhead). */
  readonly keyFrame: number | null;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  /** Display-unit value: px / percent / degrees. */
  readonly uiValue: number;
}

/**
 * The numeric inspector's ONE commit path. It updates one channel at the
 * selected key's rail-local frame and delegates to {@link setMotionKeyAtCursor},
 * so a typed value and a gizmo drag produce the same collection.
 *
 * Grouped Position shares FRAMES but never VALUES (D-11/D-12): the sibling
 * axis is written explicitly through `pairedValue` — its stored value at that
 * frame when it already carries a key, otherwise the evaluated value the pose
 * already has there. A rejected entry returns a sentence and writes nothing.
 */
export function writeRailMotionChannelValueAtCursor(
  input: WriteRailMotionChannelValueAtCursorInput,
): RailMotionCommandResult {
  const { records, railId, keyFrame, channelId, uiValue } = input;
  if (!Number.isFinite(uiValue)) return failure('Enter a number.');
  if (!isBoundedId(railId)) return failure('Select a rail first.');
  if (keyFrame === null || !isRailMotionFrameValue(keyFrame)) {
    return failure('The Motion key frame is not valid.');
  }
  const record = findRailMotionRecord(records, railId);
  if (record === null) return failure('This rail has no Motion to edit yet.');
  if (!record.channels.some((entry) => entry.id === channelId)) {
    return failure('This Motion channel is not present on the rail.');
  }

  const value = railMotionValueFromUi(channelId, uiValue);
  if (!Number.isFinite(value) || !railMotionValueIsValid(channelId, value)) {
    return failure(railMotionValueDomainReason(channelId));
  }

  const siblingId = positionSiblingId(channelId);
  const pairedValue = siblingId !== null && record.channels.some((entry) => entry.id === siblingId)
    ? (resolveMotionKeyAtFrame(record, siblingId, keyFrame)?.value
      ?? evaluateRailMotionChannel(record, siblingId, keyFrame))
    : undefined;

  return setMotionKeyAtCursor({
    records,
    railId,
    channelId,
    keyFrame,
    value,
    ...(pairedValue !== undefined ? { pairedValue } : {}),
  });
}
