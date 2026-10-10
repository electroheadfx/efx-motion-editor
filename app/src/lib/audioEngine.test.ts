import {describe, it, expect} from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {audioEngine} from './audioEngine';

describe('audioEngine', () => {
  it('exports audioEngine object', () => {
    expect(audioEngine).toBeDefined();
  });

  it('has expected methods', () => {
    expect(typeof audioEngine.ensureContext).toBe('function');
    expect(typeof audioEngine.decode).toBe('function');
    expect(typeof audioEngine.getBuffer).toBe('function');
    expect(typeof audioEngine.play).toBe('function');
    expect(typeof audioEngine.stop).toBe('function');
    expect(typeof audioEngine.stopAll).toBe('function');
    expect(typeof audioEngine.setVolume).toBe('function');
    expect(typeof audioEngine.removeTrack).toBe('function');
  });

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

  describe('AUDIO-06: applyFadeSchedule (261010-ht0 F3)', () => {
    it('schedules every curve via setValueCurveAtTime of the sampled fadeCurves law', () => {
      const source = readFileSync(
        fileURLToPath(new URL('./audioEngine.ts', import.meta.url)),
        'utf8',
      );
      expect(source).toContain("from './fadeCurves'");
      expect(source).toContain('sampleFadeCurve');
      expect(source).toContain('setValueCurveAtTime');
      // No linear-ramp stand-in for logarithmic (or any curve).
      expect(source).not.toContain('linearRampToValueAtTime');
      expect(source).not.toContain('exponentialRampToValueAtTime');
      // Partial fade-in entry samples the remaining loudness slice.
      expect(source).toContain("sampleFadeCurve(track.fadeInCurve, 'in'");
    });
  });
});
