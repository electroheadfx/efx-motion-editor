/**
 * v7 motion lane surface (Phase 59 plan 10).
 *
 * The display-lane projection folds the FIVE persisted model channels into
 * exactly FOUR rows: Position is one grouped lane backed by `position-x` and
 * `position-y` sharing one key frame set (D-11, D-12, D-13), Scale, Rotation
 * and Opacity each wrap their single model channel. Lane order is fixed and
 * never re-derived from input order.
 *
 * Props only: this module reads no store, no signal, no hook and no DOM, so
 * the whole surface is materializable in a plain `.test.ts`. The curve is the
 * evaluator's own path string (59-05) — no interpolation math lives here, and
 * every length comes from the design tokens.
 */

import type { CSSProperties } from 'preact';
import {
  Blend,
  Check,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Move,
  Plus,
  RotateCw,
  Scaling,
} from 'lucide-preact';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
} from '../roto/railMotionModel';
import {
  railMotionViewFrameCount,
  type RailMotionRailView,
} from '../roto/railMotionIdentity';
import { buildRailMotionCurvePath } from '../roto/railMotionEvaluator';
import {
  resolveMotionBlockOutlineRect,
  resolveTimelineRailPalette,
  TIMELINE_GEOMETRY,
  TIMELINE_MOTION,
  TIMELINE_SURFACE,
  type TimelineRailType,
} from './timelineRailDesign';

export type RailMotionDisplayLaneId = 'position' | 'scale' | 'rotation' | 'opacity';

/** The fixed display order (D-13): Position, Scale, Rotation, Opacity. */
export const RAIL_MOTION_DISPLAY_LANE_ORDER: readonly RailMotionDisplayLaneId[] = Object.freeze([
  'position',
  'scale',
  'rotation',
  'opacity',
]);

export interface RailMotionDisplayLaneView {
  readonly id: RailMotionDisplayLaneId;
  readonly channels: readonly PhysicPaintRotoRailMotionChannel[];
  readonly keys: readonly PhysicPaintRotoRailMotionKey[];
  readonly keyCount: number;
}

export type TimelineMotionLaneControl = 'previous' | 'diamond' | 'next' | 'select-key';

/**
 * 261107-pd8: presentation-only drag surface. The lane paints the grab cursor
 * and the ghost and forwards pointerdown; the pointer SESSION itself lives in
 * the own-key-drag host, never here (this module stays hook-free).
 */
export interface TimelineMotionKeyDragPresentation {
  readonly ghost: Readonly<{
    active: boolean;
    left: number;
    width: number;
    blockedEdge: 'left' | 'right' | null;
  }>;
  readonly onPointerDownKey: (event: PointerEvent, frame: number) => void;
  /** Returns true exactly once for the click the browser dispatches after a drop. */
  readonly consumeClickSuppression: () => boolean;
}

export interface TimelineMotionChannelLaneProps {
  readonly railId: string;
  readonly lane: RailMotionDisplayLaneView;
  readonly railType: TimelineRailType;
  readonly selected: boolean;
  readonly railFrameCount: number;
  readonly cursorFrame: number;
  /**
   * 261108-d5o: the rail's displayed-real frames, in rail-local space. The lane
   * computes NOTHING — the host resolves the list through the store accessor
   * and passes it down, so the drawn curve samples stop-motion exactly like the
   * applied transform.
   */
  readonly snapFrames: readonly number[];
  readonly selectedKeyFrames?: readonly number[];
  readonly onSelectRail?: (railId: string) => void;
  readonly onSelectKey?: (frame: number) => void;
  readonly disabledReasons?: Partial<Record<TimelineMotionLaneControl, string>>;
  /** Present only when the host supplies drag ports; absent is click-only. */
  readonly keyDrag?: TimelineMotionKeyDragPresentation;
}

export interface TimelineMotionChannelHeaderRowProps {
  readonly lane: RailMotionDisplayLaneView;
  readonly railType: TimelineRailType;
  readonly selected: boolean;
  /** Animate mode: this channel is the one the canvas is editing. */
  readonly channelSelected: boolean;
  readonly railFrameCount: number;
  readonly cursorFrame: number;
  readonly onSelectChannel: () => void;
  readonly onMoveCursorToKey: (frame: number) => void;
  readonly onToggleKeyAtCursor: () => void;
  readonly disabledReasons?: Partial<Record<TimelineMotionLaneControl, string>>;
}

export interface TimelineMotionHeaderGroupProps {
  readonly channels: readonly PhysicPaintRotoRailMotionChannel[];
  readonly view: RailMotionRailView | null;
  readonly selected: boolean;
  readonly selectedChannel: RailMotionDisplayLaneId | null;
  readonly cursorFrame: number;
  readonly disabledReasons?: Partial<Record<TimelineMotionLaneControl, string>>;
  readonly onSelectChannel: (channel: RailMotionDisplayLaneId) => void;
  readonly onMotionCursorStep: (
    direction: -1 | 1,
    channelId: PhysicPaintRotoRailMotionChannelId,
  ) => void;
  readonly onToggleMotionKeyAtCursor: (channelId: PhysicPaintRotoRailMotionChannelId) => void;
}

const RAIL_MOTION_DISPLAY_LANE_LABELS: Record<RailMotionDisplayLaneId, string> = {
  position: 'Position',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
};

/** Position is the only grouped display lane: these two travel together (D-11). */
const POSITION_MODEL_CHANNEL_ORDER: readonly PhysicPaintRotoRailMotionChannelId[] = Object.freeze([
  'position-x',
  'position-y',
]);

const SINGLE_MODEL_DISPLAY_LANES: readonly Exclude<RailMotionDisplayLaneId, 'position'>[] =
  Object.freeze(['scale', 'rotation', 'opacity']);

const EMPTY_CHANNELS: readonly PhysicPaintRotoRailMotionChannel[] = Object.freeze([]);
const EMPTY_KEYS: readonly PhysicPaintRotoRailMotionKey[] = Object.freeze([]);

function findModelChannel(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
  id: PhysicPaintRotoRailMotionChannelId,
): PhysicPaintRotoRailMotionChannel | null {
  for (const channel of channels) {
    if (channel.id === id) return channel;
  }
  return null;
}

function makeDisplayLane(
  id: RailMotionDisplayLaneId,
  channels: readonly PhysicPaintRotoRailMotionChannel[],
  keys: readonly PhysicPaintRotoRailMotionKey[],
): RailMotionDisplayLaneView {
  return { id, channels, keys, keyCount: keys.length };
}

/**
 * The one display-lane projection. The grouped Position lane reuses the FIRST
 * present axis's frames as the shared key set: D-12 guarantees frame equality
 * and the 59-02 parser already refuses a lone or frame-mismatched axis, so a
 * second merge rule here would be a second authority.
 */
export function resolveMotionDisplayLanes(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly RailMotionDisplayLaneView[] {
  const positionChannels: PhysicPaintRotoRailMotionChannel[] = [];
  for (const id of POSITION_MODEL_CHANNEL_ORDER) {
    const channel = findModelChannel(channels, id);
    if (channel !== null) positionChannels.push(channel);
  }
  const sharedKeys = positionChannels.length > 0 ? positionChannels[0].keys : EMPTY_KEYS;

  const lanes: RailMotionDisplayLaneView[] = [
    makeDisplayLane('position', positionChannels, sharedKeys),
  ];
  for (const id of SINGLE_MODEL_DISPLAY_LANES) {
    const channel = findModelChannel(channels, id);
    if (channel === null || channel.keys.length === 0) {
      lanes.push(makeDisplayLane(id, EMPTY_CHANNELS, EMPTY_KEYS));
    } else {
      lanes.push(makeDisplayLane(id, [channel], channel.keys));
    }
  }
  return Object.freeze(lanes);
}

/** The lanes a rail actually shows: a display lane with zero keys has no row. */
export function resolveVisibleMotionDisplayLanes(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly RailMotionDisplayLaneView[] {
  return Object.freeze(
    resolveMotionDisplayLanes(channels).filter((lane) => lane.keyCount > 0),
  );
}

/** The `+` menu complement (D-14): display lanes that carry no keys yet. */
export function resolveKeylessMotionDisplayLanes(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly RailMotionDisplayLaneView[] {
  return Object.freeze(
    resolveMotionDisplayLanes(channels).filter((lane) => lane.keyCount === 0),
  );
}

/** The model channel a display lane addresses for its nav intents: the grouped
 *  Position lane answers with its FIRST axis (`position-x`), which is also the
 *  channel the `+` menu seeds. One resolver, so header and body cannot drift. */
export function resolveDisplayLaneChannelId(
  lane: RailMotionDisplayLaneView,
): PhysicPaintRotoRailMotionChannelId {
  return lane.channels[0]?.id ?? 'position-x';
}

/**
 * The ONE rail-band predicate: a key belongs to the lane's drawn band only when
 * its frame is finite and sits in `[0, frameCount)`. The key dots and the header
 * row's adjacency list share it, so navigation never steps onto a frame the
 * lane does not draw.
 */
export function resolveInBandMotionKeys(
  keys: readonly PhysicPaintRotoRailMotionKey[],
  frameCount: number,
): readonly PhysicPaintRotoRailMotionKey[] {
  return keys.filter(
    (key) => Number.isFinite(key.frame) && key.frame >= 0 && key.frame < frameCount,
  );
}

interface MotionLaneControlState {
  readonly disabled: boolean;
  readonly reason: string | null;
}

function resolveControlState(
  control: TimelineMotionLaneControl,
  available: boolean,
  unavailableReason: string,
  disabledReasons: Partial<Record<TimelineMotionLaneControl, string>> | undefined,
): MotionLaneControlState {
  const override = disabledReasons?.[control];
  if (override !== undefined) return { disabled: true, reason: override };
  if (!available) return { disabled: true, reason: unavailableReason };
  return { disabled: false, reason: null };
}

function resolveAdjacentKeyFrame(
  frames: readonly number[],
  cursorFrame: number,
  direction: -1 | 1,
): number | null {
  let best: number | null = null;
  for (const frame of frames) {
    const isCandidate =
      direction < 0 ? frame < cursorFrame : frame > cursorFrame;
    if (!isCandidate) continue;
    if (best === null || (direction < 0 ? frame > best : frame < best)) best = frame;
  }
  return best;
}

function renderLaneIcon(id: RailMotionDisplayLaneId, size = 12) {
  switch (id) {
    case 'position':
      return <Move size={size} />;
    case 'scale':
      return <Scaling size={size} />;
    case 'rotation':
      return <RotateCw size={size} />;
    case 'opacity':
      return <Blend size={size} />;
  }
}

/**
 * One lane per DISPLAY lane. `lane.keys` is already the shared key set for the
 * grouped Position lane, so exactly one dot renders per shared frame. The lane
 * draws ONE curve: the grouped Position lane's axes share their key frames
 * (D-12), so a second axis path would only paint a crossing duplicate.
 */
export function TimelineMotionChannelLane({
  railId,
  lane,
  railType,
  selected,
  railFrameCount,
  cursorFrame,
  snapFrames,
  selectedKeyFrames,
  onSelectRail,
  onSelectKey,
  disabledReasons,
  keyDrag,
}: TimelineMotionChannelLaneProps) {
  const palette = resolveTimelineRailPalette(railType, selected ? 'selected' : 'active');
  const laneHeight = TIMELINE_MOTION.laneHeight;
  const frameCount = Number.isFinite(railFrameCount)
    ? Math.max(0, Math.floor(railFrameCount))
    : 0;
  const laneWidth = frameCount * TIMELINE_GEOMETRY.cellPitch;

  const inBandKeys = resolveInBandMotionKeys(lane.keys, frameCount);

  const selectKeyState = resolveControlState(
    'select-key',
    onSelectKey !== undefined,
    'Motion key selection is unavailable',
    disabledReasons,
  );

  const keyStyle = (frame: number): CSSProperties => ({
    position: 'absolute',
    // Centred on the frame column: frame × pitch + (cell − key) / 2.
    left:
      frame * TIMELINE_GEOMETRY.cellPitch +
      (TIMELINE_MOTION.cellWidth - TIMELINE_MOTION.keySize) / 2,
    top: (laneHeight - TIMELINE_MOTION.keySize) / 2,
    width: TIMELINE_MOTION.keySize,
    height: TIMELINE_MOTION.keySize,
    borderRadius: TIMELINE_MOTION.keyRadius,
    border: 'none',
    padding: 0,
    background: palette.keyFill,
    boxShadow: `0 0 0 ${TIMELINE_MOTION.keyRimWidth}px ${palette.keyRim}`,
    cursor: selectKeyState.disabled ? 'not-allowed' : keyDrag !== undefined ? 'grab' : 'pointer',
  });

  const cellStyle = (frame: number): CSSProperties => ({
    position: 'absolute',
    left: frame * TIMELINE_GEOMETRY.cellPitch,
    top: 0,
    width: TIMELINE_MOTION.cellWidth,
    height: TIMELINE_MOTION.cellHeight,
    borderRadius: TIMELINE_MOTION.cellRadius,
    background: TIMELINE_SURFACE.emptyCellFill,
    border: `1px solid ${TIMELINE_SURFACE.emptyCellBorder}`,
  });

  return (
    <div
      class="physics-paint-motion-lane"
      data-motion-display-lane={lane.id}
      data-motion-rail-id={railId}
      style={{
        position: 'relative',
        width: laneWidth,
        height: laneHeight,
        background: TIMELINE_SURFACE.motionLane,
        overflow: 'hidden',
      }}
      data-motion-rail-selected={selected ? 'true' : 'false'}
      onClick={() => onSelectRail?.(railId)}
    >
      {Array.from({ length: frameCount }, (_, frame) => (
        <div key={`cell-${frame}`} data-motion-cell-frame={frame} style={cellStyle(frame)} />
      ))}

      {frameCount > 0 && (
        <svg
          class="physics-paint-motion-lane-curves"
          width={laneWidth}
          height={laneHeight}
          viewBox={`0 0 ${laneWidth} ${laneHeight}`}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {lane.channels[0] !== undefined ? (
            <path
              d={buildRailMotionCurvePath(lane.channels[0], frameCount, laneHeight, {
                railId,
                snapFrames,
              })}
              fill="none"
              stroke={palette.line}
              strokeWidth={TIMELINE_MOTION.curveWidth}
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      )}

      {inBandKeys.map((key) => (
        <button
          key={`key-${key.frame}`}
          type="button"
          class="physics-paint-motion-lane-key"
          data-motion-key-frame={key.frame}
          data-tier={key.frame === cursorFrame ? 'current' : 'idle'}
          data-selected={selectedKeyFrames?.includes(key.frame) ? 'true' : 'false'}
          disabled={selectKeyState.disabled}
          title={selectKeyState.reason ?? undefined}
          aria-description={selectKeyState.reason ?? undefined}
          aria-label={`Motion key at frame ${key.frame}`}
          style={keyStyle(key.frame)}
          onPointerDown={keyDrag === undefined
            ? undefined
            : (event) => keyDrag.onPointerDownKey(event, key.frame)}
          onClick={selectKeyState.disabled
            ? undefined
            : (event) => {
              // The drop's companion click must not re-select or bubble into
              // the lane's rail selection.
              if (keyDrag?.consumeClickSuppression() === true) {
                event.stopPropagation();
                return;
              }
              onSelectKey?.(key.frame);
            }}
        />
      ))}

      {keyDrag !== undefined && keyDrag.ghost.active ? (
        <span
          class={`physics-paint-motion-lane-key-ghost${keyDrag.ghost.blockedEdge === null
            ? ''
            : ` blocked-edge-${keyDrag.ghost.blockedEdge}`}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: keyDrag.ghost.left,
            // Same vertical centring and measures as the key it replaces.
            top: (laneHeight - TIMELINE_MOTION.keySize) / 2,
            width: keyDrag.ghost.width,
            height: TIMELINE_MOTION.keySize,
            borderRadius: TIMELINE_MOTION.keyRadius,
            background: palette.keyFill,
            boxShadow: `0 0 0 ${TIMELINE_MOTION.keyRimWidth}px ${palette.keyRim}`,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      ) : null}

    </div>
  );
}

/**
 * One channel header row (MUI-04 split): the icon, label, key count and the
 * previous/diamond/next cluster that belongs to a lane's HEADER. It renders in
 * the pinned left column — never over the lane's cells — with the same 18px
 * lane rhythm, labels, reasons and intents as the former in-lane cluster.
 */
export function TimelineMotionChannelHeaderRow({
  lane,
  railType,
  selected,
  channelSelected,
  railFrameCount,
  cursorFrame,
  onSelectChannel,
  onMoveCursorToKey,
  onToggleKeyAtCursor,
  disabledReasons,
}: TimelineMotionChannelHeaderRowProps) {
  // SPECS §2: the header's label, icon and nav cluster always use the BRIGHT
  // rail colour. The dim `active` tier + 0.55 row opacity rendered the labels
  // unreadably dark on the sidebar background (261107 UAT).
  const palette = resolveTimelineRailPalette(railType, 'selected');
  const frameCount = Number.isFinite(railFrameCount)
    ? Math.max(0, Math.floor(railFrameCount))
    : 0;
  const sortedInBandFrames = resolveInBandMotionKeys(lane.keys, frameCount)
    .map((key) => key.frame)
    .sort((left, right) => left - right);

  const cursorInsideRail = cursorFrame >= 0 && cursorFrame < frameCount;
  const hasKeyAtCursor = cursorInsideRail && sortedInBandFrames.includes(cursorFrame);
  const previousFrame = resolveAdjacentKeyFrame(sortedInBandFrames, cursorFrame, -1);
  const nextFrame = resolveAdjacentKeyFrame(sortedInBandFrames, cursorFrame, 1);

  const previousState = resolveControlState(
    'previous',
    previousFrame !== null,
    'No earlier motion key in this rail',
    disabledReasons,
  );
  const nextState = resolveControlState(
    'next',
    nextFrame !== null,
    'No later motion key in this rail',
    disabledReasons,
  );
  const diamondState = resolveControlState(
    'diamond',
    cursorInsideRail,
    'Cursor is outside this rail',
    disabledReasons,
  );

  function navButtonStyle(disabled: boolean): CSSProperties {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: TIMELINE_MOTION.cellWidth,
      height: TIMELINE_MOTION.cellWidth,
      padding: 0,
      border: 'none',
      borderRadius: 3,
      background: 'transparent',
      color: palette.line,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    };
  }

  function navButtonProps(state: MotionLaneControlState) {
    return {
      type: 'button' as const,
      disabled: state.disabled,
      title: state.reason ?? undefined,
      'aria-description': state.reason ?? undefined,
      style: navButtonStyle(state.disabled),
    };
  }

  return (
    <div
      class="physics-paint-motion-lane-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: TIMELINE_MOTION.laneLabelGap + 2,
        width: '100%',
        minWidth: TIMELINE_MOTION.headerClusterWidth,
        height: TIMELINE_MOTION.laneHeight,
        padding: '0 10px',
        boxSizing: 'border-box',
        flexShrink: 0,
        background: TIMELINE_SURFACE.motionLane,
      }}
      title={selected ? undefined : 'Click this lane to select the rail for canvas transforms'}
    >
      {/* 261107 UAT: the property itself is the ANIMATE-MODE control. Clicking
          it highlights the row white and arms the canvas boundary for this
          channel; clicking it again returns to painting. Deploying the lane
          never selects a property on its own. */}
      <button
        type="button"
        class="physics-paint-motion-lane-channel"
        data-motion-channel-selected={channelSelected ? 'true' : 'false'}
        aria-pressed={channelSelected}
        // The key count lives in the tooltip: the row shows the property name
        // only. `textTransform: none` opts out of the global
        // `button { text-transform: uppercase }` rule (261107 UAT).
        title={`${RAIL_MOTION_DISPLAY_LANE_LABELS[lane.id]} — ${lane.keyCount} key${lane.keyCount === 1 ? '' : 's'}. ${channelSelected
          ? 'Click to leave motion editing and paint again'
          : 'Click to animate this property on the canvas'}`}
        onClick={onSelectChannel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: TIMELINE_MOTION.laneLabelGap + 2,
          flex: '1 1 auto',
          minWidth: 0,
          height: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          textTransform: 'none',
          cursor: 'pointer',
        }}
      >
        <span
          data-motion-header-part="icon"
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            color: channelSelected ? TIMELINE_SURFACE.activeTrackName : palette.line,
          }}
        >
          {renderLaneIcon(lane.id, 12)}
        </span>
        <span
          data-motion-header-part="label"
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            fontSize: 11,
            fontWeight: 600,
            color: channelSelected ? TIMELINE_SURFACE.activeTrackName : palette.line,
            whiteSpace: 'nowrap',
          }}
        >
          {RAIL_MOTION_DISPLAY_LANE_LABELS[lane.id]}
        </span>
      </button>
      <button
        data-motion-header-part="previous"
        aria-label="Previous motion key"
        {...navButtonProps(previousState)}
        onClick={previousState.disabled ? undefined : () => onMoveCursorToKey(previousFrame as number)}
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <button
        data-motion-header-part="diamond"
        // The glyph reads the toggle's own semantics: hollow = clicking adds a
        // key at the cursor, filled = a key is there and clicking removes it.
        aria-label={hasKeyAtCursor ? 'Remove motion key at cursor' : 'Add motion key at cursor'}
        data-motion-key-at-cursor={hasKeyAtCursor ? 'true' : 'false'}
        {...navButtonProps(diamondState)}
        onClick={diamondState.disabled ? undefined : () => onToggleKeyAtCursor()}
      >
        <Diamond
          size={11}
          fill={hasKeyAtCursor ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>
      <button
        data-motion-header-part="next"
        aria-label="Next motion key"
        {...navButtonProps(nextState)}
        onClick={nextState.disabled ? undefined : () => onMoveCursorToKey(nextFrame as number)}
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The header-side stack of an expanded motion block: one header row per visible
 * display lane in fixed order plus the 2px post-block gap — the SAME rhythm the
 * body renders, so both panes stay in lockstep without this group ever
 * declaring its own total height.
 */
export function TimelineMotionHeaderGroup({
  channels,
  view,
  selected,
  selectedChannel,
  cursorFrame,
  disabledReasons,
  onSelectChannel,
  onMotionCursorStep,
  onToggleMotionKeyAtCursor,
}: TimelineMotionHeaderGroupProps) {
  const railType = view?.railType ?? 'standard';
  const railFrameCount = railMotionViewFrameCount(view);
  return (
    <div
      class="physics-paint-motion-header-group"
      style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
    >
      {resolveVisibleMotionDisplayLanes(channels).map((lane) => {
        const channelId = resolveDisplayLaneChannelId(lane);
        return (
          <TimelineMotionChannelHeaderRow
            key={lane.id}
            lane={lane}
            railType={railType}
            selected={selected}
            channelSelected={selectedChannel === lane.id}
            railFrameCount={railFrameCount}
            cursorFrame={cursorFrame}
            disabledReasons={disabledReasons}
            onSelectChannel={() => onSelectChannel(lane.id)}
            onMoveCursorToKey={(frame) => onMotionCursorStep(frame < cursorFrame ? -1 : 1, channelId)}
            onToggleKeyAtCursor={() => onToggleMotionKeyAtCursor(channelId)}
          />
        );
      })}
      <div
        class="physics-paint-motion-header-gap"
        aria-hidden="true"
        style={{ height: TIMELINE_MOTION.postBlockGap, flexShrink: 0 }}
      />
    </div>
  );
}

export interface TimelineMotionBlockOutlineProps {
  readonly rowTop: number;
  readonly rowHeight: number;
  readonly laneCount: number;
  /** App frame where the rail starts — the outline hugs the rail's extent. */
  readonly railStartFrame: number;
  readonly railFrameCount: number;
  readonly selected: boolean;
  /** The rail's bright line; the host resolves it from the rail type. */
  readonly lineColor?: string;
}

export interface TimelineMotionChannelMenuProps {
  readonly channels: readonly PhysicPaintRotoRailMotionChannel[];
  /**
   * Add (`present = false`) or remove (`present = true`) one display channel.
   * Grouped Position is addressed as `position-x`; the reducer keeps both axes
   * atomic, so the menu never exposes a lone axis.
   */
  readonly onToggleChannel: (
    channelId: PhysicPaintRotoRailMotionChannelId,
    present: boolean,
  ) => void;
  readonly onClose: () => void;
}

/** The grouped Position row adds only `position-x`; the reducer seeds both axes. */
const DISPLAY_LANE_ADD_CHANNEL_ID: Record<RailMotionDisplayLaneId, PhysicPaintRotoRailMotionChannelId> = {
  position: 'position-x',
  scale: 'scale',
  rotation: 'rotation',
  opacity: 'opacity',
};

/** Menu labels: the grouped Position lane names both axes. */
const RAIL_MOTION_DISPLAY_LANE_MENU_LABELS: Record<RailMotionDisplayLaneId, string> = {
  position: 'Position (X/Y)',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
};

/**
 * Which display channels the rail already carries. Presence is read from the
 * raw channel ids, never drawn from the display projection: a present channel
 * is always key-bearing (the reducer drops an emptied channel), so the two
 * agree today, but the menu must answer "is this channel on the rail", not
 * "does it have keys".
 */
export function resolveMotionChannelPresence(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): Readonly<Record<RailMotionDisplayLaneId, boolean>> {
  const ids = new Set<PhysicPaintRotoRailMotionChannelId>();
  for (const channel of channels) ids.add(channel.id);
  return Object.freeze({
    position: ids.has('position-x') || ids.has('position-y'),
    scale: ids.has('scale'),
    rotation: ids.has('rotation'),
    opacity: ids.has('opacity'),
  });
}

/**
 * The expanded block's outline (MUI-03): an absolutely-positioned rounded rect
 * over the rail row plus its display lanes. Rendered only when the block has
 * lanes — a collapsed rail shows no outline.
 */
export function TimelineMotionBlockOutline({
  rowTop,
  rowHeight,
  laneCount,
  railStartFrame,
  railFrameCount,
  selected,
  lineColor,
}: TimelineMotionBlockOutlineProps) {
  const rect = resolveMotionBlockOutlineRect({
    rowTop,
    rowHeight,
    laneCount,
    railStartFrame,
    railFrameCount,
  });
  if (rect === null) return null;
  return (
    <div
      class="physics-paint-motion-block-outline"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: rect.radius,
        border: `${rect.strokeWidth}px solid ${lineColor ?? TIMELINE_SURFACE.accentFallback}`,
        opacity: selected ? 1 : 0.55,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

/**
 * The Animate-anchored channel menu: every display channel in fixed order,
 * each row adding the absent ones or removing the present ones. It is the only
 * channel affordance — there is no sidebar `+` row and no default Position
 * channel, so a rail becomes animatable one chosen channel at a time.
 */
export function TimelineMotionChannelMenu({
  channels,
  onToggleChannel,
  onClose,
}: TimelineMotionChannelMenuProps) {
  const presence = resolveMotionChannelPresence(channels);
  return (
    <div
      class="physics-paint-motion-channel-menu"
      role="menu"
      aria-label="Motion channels"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: TIMELINE_SURFACE.rows,
      }}
    >
      {RAIL_MOTION_DISPLAY_LANE_ORDER.map((laneId) => {
        const present = presence[laneId];
        return (
          <button
            key={laneId}
            type="button"
            role="menuitemcheckbox"
            aria-checked={present}
            class="physics-paint-motion-channel-menu-row"
            data-motion-channel-menu-row={laneId}
            data-motion-channel-present={present ? 'true' : 'false'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 28,
              padding: '0 10px',
              border: 'none',
              background: 'transparent',
              color: TIMELINE_SURFACE.trackName,
              font: 'inherit',
              fontSize: 11,
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onClick={() => {
              onToggleChannel(DISPLAY_LANE_ADD_CHANNEL_ID[laneId], present);
              onClose();
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex', width: 12 }}>
              {renderLaneIcon(laneId, 12)}
            </span>
            <span style={{ flex: '1 1 auto' }}>
              {RAIL_MOTION_DISPLAY_LANE_MENU_LABELS[laneId]}
            </span>
            <span aria-hidden="true" style={{ display: 'inline-flex', opacity: present ? 1 : 0.5 }}>
              {present ? <Check size={13} /> : <Plus size={13} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
