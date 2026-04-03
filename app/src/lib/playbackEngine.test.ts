import {describe, it, expect} from 'vitest';
import {PlaybackEngine, playbackEngine} from './playbackEngine';

describe('playbackEngine audio sync', () => {
  it('exports PlaybackEngine class and singleton instance', () => {
    expect(PlaybackEngine).toBeDefined();
    expect(playbackEngine).toBeInstanceOf(PlaybackEngine);
  });

  it('startAudioPlayback method exists on PlaybackEngine prototype', () => {
    // startAudioPlayback is private, but we can verify via prototype check
    expect(typeof (playbackEngine as any).startAudioPlayback).toBe('function');
  });

  describe('AUDIO-03: start', () => {
    it.todo('calls audioEngine.play for each unmuted audio track');
    it.todo('skips muted tracks');
    it.todo('computes correct audio offset from current frame');
    it.todo('only plays tracks whose range includes current frame');
  });

  describe('AUDIO-03: stop', () => {
    it.todo('calls audioEngine.stopAll');
  });

  describe('AUDIO-03: seekToFrame', () => {
    it.todo('stops and restarts audio when playing');
    it.todo('does not start audio when paused');
  });
});
