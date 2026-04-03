import {describe, it, expect} from 'vitest';
import {detectBPM} from './bpmDetector';

/**
 * Generate a synthetic click track: short bursts of energy at exact beat intervals.
 * Each beat is a 2ms burst of amplitude 1.0 followed by silence.
 */
function generateClickTrack(bpm: number, sampleRate: number, durationSec: number): Float32Array {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(totalSamples);
  const samplesPerBeat = Math.floor((60 / bpm) * sampleRate);
  const burstLength = Math.floor(sampleRate * 0.002); // 2ms burst

  for (let beatStart = 0; beatStart < totalSamples; beatStart += samplesPerBeat) {
    for (let j = 0; j < burstLength && beatStart + j < totalSamples; j++) {
      data[beatStart + j] = 1.0;
    }
  }
  return data;
}

describe('detectBPM', () => {
  it('detects 120 BPM from a click track at 44100 Hz', () => {
    const data = generateClickTrack(120, 44100, 10);
    const result = detectBPM(data, 44100);
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
  });

  it('detects 90 BPM from a click track at 44100 Hz', () => {
    const data = generateClickTrack(90, 44100, 10);
    const result = detectBPM(data, 44100);
    expect(result.bpm).toBeGreaterThanOrEqual(88);
    expect(result.bpm).toBeLessThanOrEqual(92);
  });

  it('detects 150 BPM from a click track at 44100 Hz', () => {
    const data = generateClickTrack(150, 44100, 10);
    const result = detectBPM(data, 44100);
    expect(result.bpm).toBeGreaterThanOrEqual(148);
    expect(result.bpm).toBeLessThanOrEqual(152);
  });

  it('returns confidence > 0 for a valid signal', () => {
    const data = generateClickTrack(120, 44100, 10);
    const result = detectBPM(data, 44100);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('respects custom minBPM/maxBPM options', () => {
    const data = generateClickTrack(120, 44100, 10);
    const result = detectBPM(data, 44100, { minBPM: 100, maxBPM: 140 });
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
  });

  it('returns BPM rounded to 1 decimal place', () => {
    const data = generateClickTrack(120, 44100, 10);
    const result = detectBPM(data, 44100);
    const str = result.bpm.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(1);
  });
});
