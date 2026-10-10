import { describe, it, expect, beforeEach } from 'vitest';
import { audioWaveformGain, setAudioWaveformGain } from './audioWaveformGain';

describe('audioWaveformGain (261010 UAT display amplification)', () => {
  beforeEach(() => {
    setAudioWaveformGain(1);
  });

  it('stores x1..x4 and clamps outside that range', () => {
    setAudioWaveformGain(3);
    expect(audioWaveformGain.value).toBe(3);
    setAudioWaveformGain(0);
    expect(audioWaveformGain.value).toBe(1);
    setAudioWaveformGain(99);
    expect(audioWaveformGain.value).toBe(4);
    // non-integers round to the nearest level
    setAudioWaveformGain(2.4);
    expect(audioWaveformGain.value).toBe(2);
    setAudioWaveformGain(1);
    expect(audioWaveformGain.value).toBe(1);
  });
});
