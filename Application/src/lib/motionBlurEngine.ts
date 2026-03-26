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

/** Per-layer velocity cache for delta computation (per D-13) */
export class VelocityCache {
  private prev = new Map<string, KeyframeValues>();
  private lastFrame = -1;

  /**
   * Compute velocity for a layer. Returns null if no previous frame cached
   * (first frame or after seek -- skip blur for that frame per Pitfall 2).
   */
  computeForLayer(
    layerId: string,
    currentValues: KeyframeValues,
    currentFrame: number,
  ): LayerVelocity | null {
    // Invalidate cache on non-sequential frame (seek detection per Pitfall 6)
    if (Math.abs(currentFrame - this.lastFrame) > 1) {
      this.prev.clear();
    }
    this.lastFrame = currentFrame;

    const previous = this.prev.get(layerId);
    // Store current for next frame
    this.prev.set(layerId, { ...currentValues });

    if (!previous) return null;
    return computeLayerVelocity(currentValues, previous);
  }

  /** Clear all cached values (call on project load, sequence change) */
  clear() {
    this.prev.clear();
    this.lastFrame = -1;
  }
}
