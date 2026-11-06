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
  ChevronLeft,
  ChevronRight,
  Diamond,
  Move,
  RotateCw,
  Scaling,
} from 'lucide-preact';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
} from '../roto/railMotionModel';
import { buildRailMotionCurvePath } from '../roto/railMotionEvaluator';
import {
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

export interface TimelineMotionChannelLaneProps {
  readonly railId: string;
  readonly lane: RailMotionDisplayLaneView;
  readonly railType: TimelineRailType;
  readonly selected: boolean;
  readonly railFrameCount: number;
  readonly cursorFrame: number;
  readonly selectedKeyFrames?: readonly number[];
  readonly onSelectRail?: (railId: string) => void;
  readonly onSelectKey?: (frame: number) => void;
  readonly onMoveCursorToKey?: (frame: number) => void;
  readonly onToggleKeyAtCursor?: () => void;
  readonly disabledReasons?: Partial<Record<TimelineMotionLaneControl, string>>;
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

function renderLaneIcon(id: RailMotionDisplayLaneId) {
  switch (id) {
    case 'position':
      return <Move size={8} />;
    case 'scale':
      return <Scaling size={8} />;
    case 'rotation':
      return <RotateCw size={8} />;
    case 'opacity':
      return <Blend size={8} />;
  }
}

/**
 * One lane per DISPLAY lane. `lane.keys` is already the shared key set for the
 * grouped Position lane, so exactly one dot renders per shared frame while the
 * lane receives one evaluator curve path PER MODEL CHANNEL.
 */
export function TimelineMotionChannelLane({
  railId,
  lane,
  railType,
  selected,
  railFrameCount,
  cursorFrame,
  selectedKeyFrames,
  onSelectRail,
  onSelectKey,
  onMoveCursorToKey,
  onToggleKeyAtCursor,
  disabledReasons,
}: TimelineMotionChannelLaneProps) {
  const palette = resolveTimelineRailPalette(railType, selected ? 'selected' : 'active');
  const laneHeight = TIMELINE_MOTION.laneHeight;
  const frameCount = Number.isFinite(railFrameCount)
    ? Math.max(0, Math.floor(railFrameCount))
    : 0;
  const laneWidth = frameCount * TIMELINE_GEOMETRY.cellPitch;

  const inBandKeys = lane.keys.filter(
    (key) => Number.isFinite(key.frame) && key.frame >= 0 && key.frame < frameCount,
  );
  const sortedInBandFrames = inBandKeys
    .map((key) => key.frame)
    .sort((left, right) => left - right);

  const cursorInsideRail = cursorFrame >= 0 && cursorFrame < frameCount;
  const previousFrame = resolveAdjacentKeyFrame(sortedInBandFrames, cursorFrame, -1);
  const nextFrame = resolveAdjacentKeyFrame(sortedInBandFrames, cursorFrame, 1);

  const previousState = resolveControlState(
    'previous',
    onMoveCursorToKey !== undefined && previousFrame !== null,
    onMoveCursorToKey === undefined
      ? 'Motion key navigation is unavailable'
      : 'No earlier motion key in this rail',
    disabledReasons,
  );
  const nextState = resolveControlState(
    'next',
    onMoveCursorToKey !== undefined && nextFrame !== null,
    onMoveCursorToKey === undefined
      ? 'Motion key navigation is unavailable'
      : 'No later motion key in this rail',
    disabledReasons,
  );
  const diamondState = resolveControlState(
    'diamond',
    onToggleKeyAtCursor !== undefined && cursorInsideRail,
    onToggleKeyAtCursor === undefined
      ? 'Motion key editing is unavailable'
      : 'Cursor is outside this rail',
    disabledReasons,
  );
  const selectKeyState = resolveControlState(
    'select-key',
    onSelectKey !== undefined,
    'Motion key selection is unavailable',
    disabledReasons,
  );

  function navButtonStyle(disabled: boolean): CSSProperties {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      border: 'none',
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
    cursor: selectKeyState.disabled ? 'not-allowed' : 'pointer',
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
          {lane.channels.map((channel) => (
            <path
              key={channel.id}
              d={buildRailMotionCurvePath(channel, frameCount, laneHeight)}
              fill="none"
              stroke={palette.line}
              strokeWidth={TIMELINE_MOTION.curveWidth}
              strokeLinecap="round"
            />
          ))}
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
          onClick={selectKeyState.disabled ? undefined : () => onSelectKey?.(key.frame)}
        />
      ))}

      <div
        class="physics-paint-motion-lane-header"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'flex',
          alignItems: 'center',
          gap: TIMELINE_MOTION.laneLabelGap,
          width: TIMELINE_MOTION.headerClusterWidth,
          height: laneHeight,
          background: TIMELINE_SURFACE.motionLane,
        }}
      >
        <span
          data-motion-header-part="icon"
          aria-hidden="true"
          style={{ display: 'inline-flex', color: palette.line }}
        >
          {renderLaneIcon(lane.id)}
        </span>
        <span
          data-motion-header-part="label"
          style={{ fontSize: 9, fontWeight: 600, color: palette.line }}
        >
          {RAIL_MOTION_DISPLAY_LANE_LABELS[lane.id]}
        </span>
        <span
          data-motion-header-part="count"
          style={{ fontSize: 8, color: palette.keyRim }}
        >
          {`${lane.keyCount} keys`}
        </span>
        <button
          data-motion-header-part="previous"
          aria-label="Previous motion key"
          {...navButtonProps(previousState)}
          onClick={
            previousState.disabled ? undefined : () => onMoveCursorToKey?.(previousFrame as number)
          }
        >
          <ChevronLeft size={10} aria-hidden="true" />
        </button>
        <button
          data-motion-header-part="diamond"
          aria-label="Toggle motion key at cursor"
          {...navButtonProps(diamondState)}
          onClick={diamondState.disabled ? undefined : () => onToggleKeyAtCursor?.()}
        >
          <Diamond size={8} aria-hidden="true" />
        </button>
        <button
          data-motion-header-part="next"
          aria-label="Next motion key"
          {...navButtonProps(nextState)}
          onClick={
            nextState.disabled ? undefined : () => onMoveCursorToKey?.(nextFrame as number)
          }
        >
          <ChevronRight size={10} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
