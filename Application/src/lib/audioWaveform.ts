import type {WaveformPeaks} from '../types/audio';

/**
 * Extract min/max peaks from a mono sample array.
 * Output is interleaved Float32Array: [min0, max0, min1, max1, ...]
 */
function extractPeaks(mono: Float32Array, totalLength: number, peakCount: number): Float32Array {
  const bucketSize = Math.ceil(totalLength / peakCount);
  const peaks = new Float32Array(peakCount * 2);

  for (let i = 0; i < peakCount; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, totalLength);
    let min = 1;
    let max = -1;

    for (let j = start; j < end; j++) {
      const val = mono[j];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    // Handle edge case where bucket extends past data
    if (start >= totalLength) {
      min = 0;
      max = 0;
    }

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
}

/**
 * Compute waveform peaks at 3 resolution tiers from an AudioBuffer.
 * Mixes all channels to mono per D-03 before peak extraction.
 *
 * @param buffer - Decoded AudioBuffer from Web Audio API
 * @returns WaveformPeaks with tier1 (~100 peaks), tier2 (~2000 peaks), tier3 (~8000 peaks)
 */
export function computeWaveformPeaks(buffer: AudioBuffer): WaveformPeaks {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;

  // Mix down to mono: average all channels
  const mono = new Float32Array(length);

  if (numChannels === 1) {
    // Optimization: single channel, just copy
    mono.set(buffer.getChannelData(0));
  } else {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i];
      }
    }
    // Divide by number of channels to average
    for (let i = 0; i < length; i++) {
      mono[i] /= numChannels;
    }
  }

  // Extract peaks at 3 resolution tiers
  const tier1 = extractPeaks(mono, length, 100);   // ~100 peaks for extreme zoom-out
  const tier2 = extractPeaks(mono, length, 2000);   // ~2000 peaks for standard zoom
  const tier3 = extractPeaks(mono, length, 8000);   // ~8000 peaks for zoomed-in detail

  return {tier1, tier2, tier3};
}
