import type { PaintStroke } from '../types/paint';

/**
 * Distribute a stroke's points across targetFrameCount frames using speed-based allocation.
 *
 * Algorithm:
 * 1. Calculate distance between consecutive points (proxy for drawing speed --
 *    points captured at uniform time intervals, so larger distance = faster drawing).
 * 2. Use INVERSE distance as weight (slow = small distance = more frames allocated).
 * 3. Clamp minimum distance to avoid infinite frame allocation for stationary points.
 * 4. Allocate points to frames proportionally.
 * 5. Each frame's stroke contains points from start up to its allocation (progressive reveal).
 *
 * @param stroke The source stroke to distribute
 * @param targetFrameCount Number of frames to distribute across (>= 2)
 * @returns Array of PaintStroke objects, each representing the stroke state at that frame
 */
export function distributeStrokeBySpeed(
  stroke: PaintStroke,
  targetFrameCount: number,
): PaintStroke[] {
  const points = stroke.points;
  if (points.length < 2 || targetFrameCount < 2) {
    return [{ ...stroke }];
  }

  // Step 1: Calculate distances between consecutive points
  const distances: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    distances.push(Math.max(dist, 0.5)); // clamp minimum to avoid zero division
  }

  // Step 2: Inverse distances = time weights (slow segments get more frames)
  const invDistances = distances.map(d => 1 / d);
  const totalWeight = invDistances.reduce((a, b) => a + b, 0);

  // Step 3: Calculate cumulative weight at each point
  const cumulativeWeight: number[] = [0];
  let cumSum = 0;
  for (let i = 0; i < invDistances.length; i++) {
    cumSum += invDistances[i];
    cumulativeWeight.push(cumSum);
  }

  // Step 4: For each frame, find the point index where cumulative weight reaches the frame's threshold
  const frameStrokes: PaintStroke[] = [];

  for (let f = 0; f < targetFrameCount; f++) {
    // Frame f should show points up to (f + 1) / targetFrameCount of the total weight
    const targetWeight = ((f + 1) / targetFrameCount) * totalWeight;

    // Find the last point index whose cumulative weight <= targetWeight
    let endIdx = 0;
    for (let i = 0; i < cumulativeWeight.length; i++) {
      if (cumulativeWeight[i] <= targetWeight) {
        endIdx = i;
      } else {
        break;
      }
    }
    // Ensure at least one point per frame and progressive growth
    endIdx = Math.max(endIdx, 1);
    // Ensure last frame includes all points
    if (f === targetFrameCount - 1) {
      endIdx = points.length - 1;
    }

    const framePoints = points.slice(0, endIdx + 1);

    frameStrokes.push({
      ...stroke,
      id: f === 0 ? stroke.id : crypto.randomUUID(),
      points: framePoints as [number, number, number][],
      // Clear anchors -- animated partial strokes don't have bezier paths
      anchors: undefined,
    });
  }

  return frameStrokes;
}
