import {describe, it, expect} from 'vitest';
import {computeWaveformPeaks} from './audioWaveform';

/** Create a mock AudioBuffer-like object for testing. */
function mockAudioBuffer(channelData: Float32Array[], sampleRate = 44100): AudioBuffer {
  return {
    length: channelData[0].length,
    numberOfChannels: channelData.length,
    sampleRate,
    duration: channelData[0].length / sampleRate,
    getChannelData(ch: number) {
      return channelData[ch];
    },
    copyFromChannel() {},
    copyToChannel() {},
  } as unknown as AudioBuffer;
}

describe('audioWaveform', () => {
  describe('AUDIO-02: computeWaveformPeaks', () => {
    it('returns WaveformPeaks with tier1, tier2, tier3 fields', () => {
      const data = new Float32Array(44100); // 1 second at 44100Hz
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(i * 0.1);
      }
      const buffer = mockAudioBuffer([data]);
      const peaks = computeWaveformPeaks(buffer);
      expect(peaks).toHaveProperty('tier1');
      expect(peaks).toHaveProperty('tier2');
      expect(peaks).toHaveProperty('tier3');
      expect(peaks.tier1).toBeInstanceOf(Float32Array);
      expect(peaks.tier2).toBeInstanceOf(Float32Array);
      expect(peaks.tier3).toBeInstanceOf(Float32Array);
    });

    it('tier1 has ~200 values (100 min/max pairs)', () => {
      const data = new Float32Array(44100);
      const buffer = mockAudioBuffer([data]);
      const peaks = computeWaveformPeaks(buffer);
      expect(peaks.tier1.length).toBe(200); // 100 peaks * 2 (min/max)
    });

    it('tier2 has ~4000 values (2000 min/max pairs)', () => {
      const data = new Float32Array(44100);
      const buffer = mockAudioBuffer([data]);
      const peaks = computeWaveformPeaks(buffer);
      expect(peaks.tier2.length).toBe(4000); // 2000 peaks * 2
    });

    it('tier3 has ~16000 values (8000 min/max pairs)', () => {
      const data = new Float32Array(44100);
      const buffer = mockAudioBuffer([data]);
      const peaks = computeWaveformPeaks(buffer);
      expect(peaks.tier3.length).toBe(16000); // 8000 peaks * 2
    });

    it('mixes stereo channels to mono (D-03)', () => {
      const left = new Float32Array(1000);
      const right = new Float32Array(1000);
      // Left channel has positive values, right has negative
      for (let i = 0; i < 1000; i++) {
        left[i] = 0.8;
        right[i] = -0.2;
      }
      const buffer = mockAudioBuffer([left, right]);
      const peaks = computeWaveformPeaks(buffer);
      // Mono should be average: (0.8 + -0.2) / 2 = 0.3
      // tier1 should have min/max both around 0.3
      // Check first peak pair
      expect(peaks.tier1[0]).toBeCloseTo(0.3, 1); // min
      expect(peaks.tier1[1]).toBeCloseTo(0.3, 1); // max
    });

    it('peak values are in range [-1, 1]', () => {
      const data = new Float32Array(44100);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(i * 0.01);
      }
      const buffer = mockAudioBuffer([data]);
      const peaks = computeWaveformPeaks(buffer);
      for (let i = 0; i < peaks.tier1.length; i++) {
        expect(peaks.tier1[i]).toBeGreaterThanOrEqual(-1);
        expect(peaks.tier1[i]).toBeLessThanOrEqual(1);
      }
    });
  });
});
