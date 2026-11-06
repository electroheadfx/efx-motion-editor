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
 * evaluator's own path string (59-05) — no interpolation math lives here.
 *
 * RED stub: the projection placeholders and the lane body land in GREEN.
 */

import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
} from '../roto/railMotionModel';
import type { TimelineRailType } from './timelineRailDesign';

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

const POSITION_MODEL_CHANNEL_ORDER: readonly PhysicPaintRotoRailMotionChannelId[] = Object.freeze([
  'position-x',
  'position-y',
]);

/** RED stub: every display lane is empty until the projection lands in GREEN. */
export function resolveMotionDisplayLanes(
  _channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly RailMotionDisplayLaneView[] {
  return RAIL_MOTION_DISPLAY_LANE_ORDER.map((id) => ({
    id,
    channels: [] as readonly PhysicPaintRotoRailMotionChannel[],
    keys: [] as readonly PhysicPaintRotoRailMotionKey[],
    keyCount: 0,
  }));
}

export function resolveVisibleMotionDisplayLanes(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly RailMotionDisplayLaneView[] {
  return resolveMotionDisplayLanes(channels).filter((lane) => lane.keyCount > 0);
}

export function resolveKeylessMotionDisplayLanes(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly RailMotionDisplayLaneView[] {
  return resolveMotionDisplayLanes(channels).filter((lane) => lane.keyCount === 0);
}

/** RED stub: the lane body lands in GREEN. */
export function TimelineMotionChannelLane(
  _props: TimelineMotionChannelLaneProps,
): null {
  void POSITION_MODEL_CHANNEL_ORDER;
  return null;
}
