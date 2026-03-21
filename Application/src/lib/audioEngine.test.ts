import {describe, it} from 'vitest';

describe('audioEngine', () => {
  describe('ensureContext', () => {
    it.todo('creates AudioContext lazily on first call');
    it.todo('resumes suspended AudioContext');
  });

  describe('decode', () => {
    it.todo('decodes ArrayBuffer into AudioBuffer');
    it.todo('caches decoded buffer by trackId');
  });

  describe('AUDIO-04: volume', () => {
    it.todo('setVolume updates GainNode gain value');
  });

  describe('play / stop', () => {
    it.todo('creates new AudioBufferSourceNode per play call (one-shot)');
    it.todo('connects source -> GainNode -> destination');
    it.todo('stop disconnects and removes source');
    it.todo('stopAll stops all active sources');
  });

  describe('AUDIO-06: applyFadeSchedule', () => {
    it.todo('schedules fade-in with exponentialRampToValueAtTime for exponential curve');
    it.todo('schedules fade-in with linearRampToValueAtTime for linear curve');
    it.todo('schedules fade-out ramp to 0.001 (not 0)');
    it.todo('computes correct ramp times from fadeInFrames/fadeOutFrames and fps');
    it.todo('handles partial fade-in when playback starts mid-fade');
  });
});
