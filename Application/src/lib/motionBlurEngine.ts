import type {KeyframeValues} from '../types/layer';

export interface LayerVelocity {
  dx: number;       // pixels/frame
  dy: number;       // pixels/frame
  dRotation: number; // degrees/frame
  dScale: number;    // factor/frame
}

const VELOCITY_THRESHOLD = 0.5;

/**
 * Compute per-layer velocity from the difference between current and previous
 * frame's interpolated KeyframeValues.
 */
export function computeLayerVelocity(
  current: KeyframeValues,
  previous: KeyframeValues,
): LayerVelocity {
  return {
    dx: current.x - previous.x,
    dy: current.y - previous.y,
    dRotation: current.rotation - previous.rotation,
    dScale: (current.scaleX - previous.scaleX + current.scaleY - previous.scaleY) / 2,
  };
}

/**
 * Returns true when a layer's velocity is below the stationary threshold,
 * meaning it should skip motion blur for performance.
 */
export function isStationary(v: LayerVelocity): boolean {
  return Math.abs(v.dx) + Math.abs(v.dy) + Math.abs(v.dRotation) + Math.abs(v.dScale) < VELOCITY_THRESHOLD;
}
