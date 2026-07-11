import { clampPhysicPaintFrameCount } from '../../../types/physicPaint';

export interface PhysicsPaintPlayRange {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  currentFrame: number;
  markerRatio: number;
}
export const PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE = 'Save or regenerate Play output before converting it to roto frames.';
export function getPreviewFps(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 24;
  const integer = Math.trunc(numeric);
  return integer > 0 ? integer : 24;
}

export function getPlayRangeMarker(startFrame: number, frameCount: number, currentFrame: number): PhysicsPaintPlayRange {
  const safeStartFrame = clampNonNegativeInteger(startFrame, 0);
  const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
  const endFrame = safeStartFrame + safeFrameCount - 1;
  const safeCurrentFrame = clampNonNegativeInteger(currentFrame, safeStartFrame);
  const clampedCurrentFrame = clampNumber(safeCurrentFrame, safeStartFrame, endFrame);
  const denominator = Math.max(1, safeFrameCount - 1);

  return {
    startFrame: safeStartFrame,
    endFrame,
    frameCount: safeFrameCount,
    currentFrame: clampedCurrentFrame,
    markerRatio: (clampedCurrentFrame - safeStartFrame) / denominator,
  };
}
function clampNonNegativeInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}
function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
