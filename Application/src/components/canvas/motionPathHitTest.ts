import type {Point} from './coordinateMapper';

export interface KeyframeCircle {
  x: number; // project-space X
  y: number; // project-space Y
  frame: number; // sequence-local frame offset
}

/**
 * Hit test keyframe circles on the motion path.
 * Returns the index of the hit circle or null.
 * Iterates in reverse order so topmost (last rendered) circle is hit first.
 */
export function hitTestKeyframeCircles(
  point: Point,
  circles: KeyframeCircle[],
  zoom: number,
  hitScreenSize: number = 12,
): number | null {
  const hitRadius = hitScreenSize / zoom;
  const hitRadiusSq = hitRadius * hitRadius;
  for (let i = circles.length - 1; i >= 0; i--) {
    const c = circles[i];
    const dx = point.x - c.x;
    const dy = point.y - c.y;
    if (dx * dx + dy * dy <= hitRadiusSq) {
      return i;
    }
  }
  return null;
}
