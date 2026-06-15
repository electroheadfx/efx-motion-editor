import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
} from '../../types/physicPaint';

export type PhysicsPaintWorkflowMode = 'roto' | 'play';
export type PhysicsPaintApplyStatus = 'idle' | 'applying' | 'success' | 'error';
export type PhysicsPaintEngineStatusTone = 'ready' | 'not-ready' | 'error';

export type PhysicsPaintWorkflowAction =
  | 'save-active-source'
  | 'clear-active-source'
  | 'convert-play-to-roto'
  | 'convert-roto-to-play'
  | 'inspect-play-range'
  | 'move-play-marker';

export interface PhysicsPaintOnionState {
  enabled: boolean;
  previous: boolean;
  next: boolean;
  count: number;
  opacity: number;
}

export interface PhysicsPaintPlayRange {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  currentFrame: number;
  markerRatio: number;
}

export const PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE = 'Save or regenerate Play output before converting it to roto frames.';

export function clampOnionCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  const integer = Math.trunc(numeric);
  if (integer < 1) return 1;
  if (integer > 3) return 3;
  return integer;
}

export function clampOnionOpacity(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 60;
  const integer = Math.trunc(numeric);
  if (integer < 10) return 10;
  if (integer > 100) return 100;
  return integer;
}

export function getActivePrimaryActionLabel(mode: PhysicsPaintWorkflowMode): 'Save roto frame' | 'Save play' {
  return mode === 'play' ? 'Save play' : 'Save roto frame';
}

export function getPhysicsPaintSourceLabel(mode: PhysicsPaintWorkflowMode): 'Roto #1' | 'Play #2' {
  return mode === 'play' ? 'Play #2' : 'Roto #1';
}

export function requiresDestructiveConfirmation(action: PhysicsPaintWorkflowAction, mode: PhysicsPaintWorkflowMode): boolean {
  if (action === 'convert-play-to-roto' || action === 'convert-roto-to-play') return true;
  if (action === 'clear-active-source') return mode === 'play';
  return false;
}

export function getPhysicsPaintEngineStatusTone({
  ready,
  error,
}: {
  ready: boolean;
  error?: string | null;
  applyStatus?: PhysicsPaintApplyStatus;
}): PhysicsPaintEngineStatusTone {
  if (ready) return 'ready';
  return error ? 'error' : 'not-ready';
}

export function isPhysicsPaintDevExportEnabled(env: { DEV?: boolean; MODE?: string }): boolean {
  return env.DEV === true || env.MODE === 'development';
}

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

export {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
};

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
