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

  // Filter markers by stride to get target beat positions
  const targetBeats: number[] = [];
  for (let i = 0; i < beatMarkers.length; i += stride) {
    targetBeats.push(beatMarkers[i]);
  }

  if (targetBeats.length === 0) return [];

  const framesPerBeat = Math.round((60 / bpm) * fps);
  const framesPerStride = framesPerBeat * stride;

  // Case: more photos than target beats -- each gets minimum stride duration
  if (numKeyPhotos > targetBeats.length) {
    return Array(numKeyPhotos).fill(framesPerStride);
  }

  // Case: photos <= target beats -- distribute evenly
  const holdFrames: number[] = [];
  const beatsPerPhoto = Math.floor(targetBeats.length / numKeyPhotos);

  for (let i = 0; i < numKeyPhotos; i++) {
    const startIdx = i * beatsPerPhoto;
    if (i < numKeyPhotos - 1) {
      const endIdx = (i + 1) * beatsPerPhoto;
      holdFrames.push(targetBeats[endIdx] - targetBeats[startIdx]);
    } else {
      // Last photo: hold through remaining beats
      // Total span from this photo's start to the last target beat + one stride
      const lastTargetBeat = targetBeats[targetBeats.length - 1];
      holdFrames.push(lastTargetBeat - targetBeats[startIdx] + framesPerStride);
    }
  }

  return holdFrames;
}
