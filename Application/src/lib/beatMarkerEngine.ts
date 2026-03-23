/** Compute beat marker frame positions from BPM and offset. Per D-07, D-09 */
export function computeBeatMarkers(
  bpm: number,
  beatOffsetFrames: number,
  fps: number,
  totalFrames: number,
): number[] {
  if (bpm <= 0) return [];

  const framesPerBeat = (60 / bpm) * fps;
  const markers: number[] = [];
  let frame = beatOffsetFrames;

  while (frame < totalFrames) {
    const rounded = Math.round(frame);
    if (rounded >= 0) {
      markers.push(rounded);
    }
    frame += framesPerBeat;
  }

  return markers;
}

/** Identify downbeat frames (first beat of each bar). Per D-10 */
export function computeDownbeatFrames(
  beatMarkers: number[],
  beatsPerBar: number = 4,
): Set<number> {
  const downbeats = new Set<number>();
  for (let i = 0; i < beatMarkers.length; i++) {
    if (i % beatsPerBar === 0) {
      downbeats.add(beatMarkers[i]);
    }
  }
  return downbeats;
}

/** Find nearest beat marker within snap threshold. Per D-13 */
export function snapToBeat(
  frame: number,
  beatMarkers: number[],
  thresholdFrames: number,
): number | null {
  if (beatMarkers.length === 0) return null;

  let bestMarker: number | null = null;
  let bestDistance = Infinity;

  for (const marker of beatMarkers) {
    const distance = Math.abs(marker - frame);
    if (distance <= thresholdFrames && distance < bestDistance) {
      bestDistance = distance;
      bestMarker = marker;
    }
  }

  return bestMarker;
}

/**
 * Compute new holdFrames to snap a key photo's end frame to the nearest beat marker.
 * Returns the new holdFrames value, or null if no beat marker is within threshold.
 * Guarantees minimum holdFrames of 1 (never 0 or negative).
 * Per D-13: snap works on the boundary between two key photos, changing the hold frame count.
 */
export function snapHoldFramesToBeat(
  startFrame: number,
  currentHoldFrames: number,
  beatMarkers: number[],
  thresholdFrames: number,
): number | null {
  const endFrame = startFrame + currentHoldFrames;
  const snappedEnd = snapToBeat(endFrame, beatMarkers, thresholdFrames);
  if (snappedEnd === null) return null;
  const newHold = snappedEnd - startFrame;
  return newHold >= 1 ? newHold : 1;
}

/** Compute hold frame values to align key photos with beats. Per D-14, D-15, D-16 */
export type ArrangeStrategy = 'every-beat' | 'every-2-beats' | 'every-bar';

export function autoArrangeHoldFrames(
  numKeyPhotos: number,
  beatMarkers: number[],
  strategy: ArrangeStrategy,
  fps: number,
  bpm: number,
): number[] {
  if (beatMarkers.length === 0 || numKeyPhotos <= 0) return [];

  // Determine stride based on strategy
  const stride = strategy === 'every-bar' ? 4 : strategy === 'every-2-beats' ? 2 : 1;

  // Compute stride duration from actual beat markers for precision,
  // falling back to BPM calculation if not enough markers
  const strideFrames = stride < beatMarkers.length
    ? beatMarkers[stride] - beatMarkers[0]
    : Math.round((60 / bpm) * fps) * stride;

  // Each key photo holds for exactly one stride — transitions land on beats
  return Array(numKeyPhotos).fill(Math.max(strideFrames, 1));
}
