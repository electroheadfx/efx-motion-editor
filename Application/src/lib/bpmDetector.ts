export interface BpmResult {
  bpm: number;        // BPM rounded to 1 decimal place
  confidence: number; // Raw autocorrelation peak value (higher = more confident)
}

export interface BpmOptions {
  minBPM?: number;  // default 60
  maxBPM?: number;  // default 200
}

/**
 * Detect BPM from PCM audio data using onset detection + autocorrelation.
 *
 * Algorithm (per D-05, RESEARCH.md Pattern 2):
 * 1. Compute energy in 10ms windows
 * 2. Compute onset detection function (half-wave rectified derivative)
 * 3. Autocorrelate onset signal for lag range derived from BPM range
 * 4. Find peak lag, convert to BPM
 * 5. Octave correction (Pitfall 4)
 * 6. Round to 1 decimal
 */
export function detectBPM(
  channelData: Float32Array,
  sampleRate: number,
  options?: BpmOptions,
): BpmResult {
  const minBPM = options?.minBPM ?? 60;
  const maxBPM = options?.maxBPM ?? 200;

  // Step 1: Compute energy in 10ms windows
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms
  const hopSize = Math.floor(windowSize / 2);       // 50% overlap
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize) + 1;

  if (numWindows < 2) {
    return { bpm: 0, confidence: 0 };
  }

  const energy = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize && start + j < channelData.length; j++) {
      const sample = channelData[start + j];
      sum += sample * sample;
    }
    energy[w] = sum / windowSize;
  }

  // Step 2: Onset detection function (half-wave rectified derivative)
  const onsets = new Float32Array(numWindows);
  for (let i = 1; i < numWindows; i++) {
    const diff = energy[i] - energy[i - 1];
    onsets[i] = diff > 0 ? diff : 0;
  }

  // Step 3: Autocorrelate onset signal
  // Convert BPM range to lag range in onset-signal units
  // lag (in hops) = 60 / (bpm * hopSize / sampleRate) = 60 * sampleRate / (bpm * hopSize)
  const minLag = Math.floor((60 * sampleRate) / (maxBPM * hopSize));
  const maxLag = Math.ceil((60 * sampleRate) / (minBPM * hopSize));
  const correlationLength = Math.min(numWindows, 1000);

  let bestLag = minLag;
  let bestCorrelation = -Infinity;

  for (let lag = minLag; lag <= maxLag && lag < numWindows; lag++) {
    let correlation = 0;
    const maxI = Math.min(correlationLength, numWindows - lag);
    for (let i = 0; i < maxI; i++) {
      correlation += onsets[i] * onsets[i + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestCorrelation <= 0) {
    return { bpm: 0, confidence: 0 };
  }

  // Step 4: Convert best lag to BPM
  let bpm = 60 / (bestLag * hopSize / sampleRate);

  // Step 5: Octave correction (Pitfall 4)
  // If bpm < 80, try doubling; if > 160, try halving
  // Prefer value closest to 120 BPM (common musical center)
  if (bpm < 80) {
    const doubled = bpm * 2;
    if (Math.abs(doubled - 120) < Math.abs(bpm - 120)) {
      bpm = doubled;
    }
  } else if (bpm > 160) {
    const halved = bpm / 2;
    if (Math.abs(halved - 120) < Math.abs(bpm - 120)) {
      bpm = halved;
    }
  }

  // Step 6: Round to 1 decimal place
  bpm = Math.round(bpm * 10) / 10;

  return { bpm, confidence: bestCorrelation };
}
