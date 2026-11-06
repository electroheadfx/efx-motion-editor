/**
 * Rail motion model (Phase 59) — RED skeleton.
 *
 * Types and constants only; every behavior below is a stub so the planned
 * tests compile and fail on their assertions instead of a module-load fault.
 */

export type PhysicPaintRotoRailMotionChannelId =
  | 'position-x'
  | 'position-y'
  | 'scale'
  | 'rotation'
  | 'opacity';

export type PhysicPaintRotoRailMotionEasing = 'hold' | 'ease';

export interface PhysicPaintRotoRailMotionKey {
  readonly frame: number;
  readonly value: number;
  readonly easing: PhysicPaintRotoRailMotionEasing;
  readonly wiggle: number;
}

export interface PhysicPaintRotoRailMotionChannel {
  readonly id: PhysicPaintRotoRailMotionChannelId;
  readonly keys: readonly PhysicPaintRotoRailMotionKey[];
}

export interface PhysicPaintRotoRailMotionRecord {
  readonly railId: string;
  readonly anchorKeyId: string;
  readonly channels: readonly PhysicPaintRotoRailMotionChannel[];
}

export const RAIL_MOTION_POSITION_LIMIT_PX = 1_000_000;
export const RAIL_MOTION_FRAME_LIMIT = 1_000_000;
export const RAIL_MOTION_WIGGLE_LIMIT = 1_000_000;

export const PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER: readonly PhysicPaintRotoRailMotionChannelId[] = Object.freeze([
  'position-x',
  'position-y',
  'scale',
  'rotation',
  'opacity',
]);

export const PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY: readonly PhysicPaintRotoRailMotionRecord[] = Object.freeze([]);

export function railMotionValueIsValid(
  _channelId: PhysicPaintRotoRailMotionChannelId,
  _value: number,
): boolean {
  return false;
}

export function railMotionValueToUi(
  _channelId: PhysicPaintRotoRailMotionChannelId,
  value: number,
): number {
  return value;
}

export function railMotionValueFromUi(
  _channelId: PhysicPaintRotoRailMotionChannelId,
  uiValue: number,
): number {
  return uiValue;
}

export function canonicalizeRailMotionChannels(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly PhysicPaintRotoRailMotionChannel[] {
  return channels;
}
