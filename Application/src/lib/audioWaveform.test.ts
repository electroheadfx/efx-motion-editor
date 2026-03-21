import {describe, it, expect} from 'vitest';

describe('audioWaveform', () => {
  describe('AUDIO-02: computeWaveformPeaks', () => {
    it.todo('returns WaveformPeaks with tier1, tier2, tier3 fields');
    it.todo('tier1 has ~200 values (100 min/max pairs)');
    it.todo('tier2 has ~4000 values (2000 min/max pairs)');
    it.todo('tier3 has ~16000 values (8000 min/max pairs)');
    it.todo('mixes stereo channels to mono (D-03)');
    it.todo('peak values are in range [-1, 1]');
  });
});
