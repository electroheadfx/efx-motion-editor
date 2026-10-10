import {describe, it, expect, beforeEach} from 'vitest';
import {audioStore, _setAudioMarkDirtyCallback} from './audioStore';
import type {AudioTrack} from '../types/audio';

function makeTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: crypto.randomUUID(),
    audioAssetId: crypto.randomUUID(),
    name: 'Test Track',
    filePath: '/Users/test/Music/audio.mp3',
    originalFilename: 'audio.mp3',
    offsetFrame: 0,
    inFrame: 0,
    outFrame: 100,
    volume: 1,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'exponential',
    sampleRate: 44100,
    duration: 10,
    channelCount: 2,
    order: 0,
    trackHeight: 44,
    slipOffset: 0,
    totalFramesInFile: 100,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
    ...overrides,
  };
}

describe('audioStore', () => {
  beforeEach(() => {
    audioStore.reset();
    _setAudioMarkDirtyCallback(() => {});
  });

  describe('AUDIO-01: addTrack', () => {
    it('adds a track to the tracks signal', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      expect(audioStore.tracks.value).toHaveLength(1);
      expect(audioStore.tracks.value[0].id).toBe(track.id);
    });

    it('auto-selects the newly added track', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      expect(audioStore.selectedTrackId.value).toBe(track.id);
    });

    it.todo('pushes an undo action with description');

    it('marks project dirty', () => {
      let dirty = false;
      _setAudioMarkDirtyCallback(() => { dirty = true; });
      audioStore.addTrack(makeTrack());
      expect(dirty).toBe(true);
    });
  });

  describe('removeTrack', () => {
    it('removes track by id', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      audioStore.removeTrack(track.id);
      expect(audioStore.tracks.value).toHaveLength(0);
    });

    it('clears selection if removed track was selected', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      expect(audioStore.selectedTrackId.value).toBe(track.id);
      audioStore.removeTrack(track.id);
      expect(audioStore.selectedTrackId.value).toBeNull();
    });

    it.todo('pushes an undo action');
  });

  describe('updateTrack', () => {
    it('merges partial updates into existing track', () => {
      const track = makeTrack({volume: 0.5});
      audioStore.addTrack(track);
      audioStore.updateTrack(track.id, {volume: 0.8, name: 'Renamed'});
      const updated = audioStore.getTrack(track.id);
      expect(updated?.volume).toBe(0.8);
      expect(updated?.name).toBe('Renamed');
    });
  });

  describe('AUDIO-05: setOffset', () => {
    it('changes track offsetFrame', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      audioStore.setOffset(track.id, 42);
      expect(audioStore.getTrack(track.id)?.offsetFrame).toBe(42);
    });

    it.todo('pushes an undo action');
  });

  describe('setInOut', () => {
    it('changes track inFrame and outFrame', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      audioStore.setInOut(track.id, 10, 50);
      const t = audioStore.getTrack(track.id);
      expect(t?.inFrame).toBe(10);
      expect(t?.outFrame).toBe(50);
    });

    it('Out path leaves offsetFrame unchanged (right-edge trim)', () => {
      const track = makeTrack({offsetFrame: 7, inFrame: 10, outFrame: 50});
      audioStore.addTrack(track);
      audioStore.setInOut(track.id, 10, 60);
      const t = audioStore.getTrack(track.id);
      expect(t?.outFrame).toBe(60);
      expect(t?.offsetFrame).toBe(7);
    });
  });

  describe('setIn (261010-en9 R4 In-from-left trim)', () => {
    it('moves the left edge right while the clip end stays fixed', () => {
      // offsetFrame + (outFrame - inFrame) is invariant.
      const track = makeTrack({offsetFrame: 10, inFrame: 20, outFrame: 80});
      audioStore.addTrack(track);
      audioStore.setIn(track.id, 30);
      const t = audioStore.getTrack(track.id);
      expect(t?.inFrame).toBe(30);
      expect(t?.outFrame).toBe(80);
      // newOffset = oldOffset + (newIn - oldIn) = 10 + (30 - 20) = 20
      expect(t?.offsetFrame).toBe(20);
      expect((t!.offsetFrame) + (t!.outFrame - t!.inFrame)).toBe(70);
    });

    it('lowering In moves the left edge left and keeps the end put', () => {
      const track = makeTrack({offsetFrame: 10, inFrame: 20, outFrame: 80});
      audioStore.addTrack(track);
      audioStore.setIn(track.id, 5);
      const t = audioStore.getTrack(track.id);
      expect(t?.inFrame).toBe(5);
      expect(t?.offsetFrame).toBe(-5);
      expect((t!.offsetFrame) + (t!.outFrame - t!.inFrame)).toBe(70);
    });

    it('clamps inFrame to [0, outFrame - 1] (1-frame minimum span)', () => {
      const track = makeTrack({offsetFrame: 0, inFrame: 10, outFrame: 50});
      audioStore.addTrack(track);
      audioStore.setIn(track.id, -20);
      expect(audioStore.getTrack(track.id)?.inFrame).toBe(0);
      audioStore.setIn(track.id, 50);
      expect(audioStore.getTrack(track.id)?.inFrame).toBe(49);
    });

    it('is a no-op when the track is missing', () => {
      audioStore.setIn('missing', 5);
      expect(audioStore.tracks.value).toHaveLength(0);
    });
  });

  describe('setSlipOffset', () => {
    it('changes track slipOffset inside the file window', () => {
      // total 200 / out 100 -> engine slip may run to +100 (later source).
      const track = makeTrack({inFrame: 0, outFrame: 100, totalFramesInFile: 200});
      audioStore.addTrack(track);
      audioStore.setSlipOffset(track.id, 15);
      expect(audioStore.getTrack(track.id)?.slipOffset).toBe(15);
    });

    it('clamps engine slip so the heard window stays inside the file', () => {
      const track = makeTrack({inFrame: 10, outFrame: 100, totalFramesInFile: 200});
      audioStore.addTrack(track);
      audioStore.setSlipOffset(track.id, -999);
      expect(audioStore.getTrack(track.id)?.slipOffset).toBe(-10);
      audioStore.setSlipOffset(track.id, 999);
      expect(audioStore.getTrack(track.id)?.slipOffset).toBe(100);
    });
  });

  describe('reorderTracks', () => {
    it('swaps track positions and updates order fields', () => {
      const t1 = makeTrack({name: 'A', order: 0});
      const t2 = makeTrack({name: 'B', order: 1});
      audioStore.addTrack(t1);
      audioStore.addTrack(t2);
      audioStore.reorderTracks(0, 1);
      expect(audioStore.tracks.value[0].name).toBe('B');
      expect(audioStore.tracks.value[1].name).toBe('A');
      expect(audioStore.tracks.value[0].order).toBe(0);
      expect(audioStore.tracks.value[1].order).toBe(1);
    });
  });

  describe('setMuted', () => {
    it('toggles track muted state', () => {
      const track = makeTrack({muted: false});
      audioStore.addTrack(track);
      audioStore.setMuted(track.id, true);
      expect(audioStore.getTrack(track.id)?.muted).toBe(true);
    });
  });

  describe('setVolume', () => {
    it('sets track volume 0-1', () => {
      const track = makeTrack({volume: 1});
      audioStore.addTrack(track);
      audioStore.setVolume(track.id, 0.3);
      expect(audioStore.getTrack(track.id)?.volume).toBe(0.3);
    });
  });

  describe('setTrackHeight', () => {
    it('clamps height between 28 and 120', () => {
      const track = makeTrack();
      audioStore.addTrack(track);
      audioStore.setTrackHeight(track.id, 10);
      expect(audioStore.getTrack(track.id)?.trackHeight).toBe(28);
      audioStore.setTrackHeight(track.id, 200);
      expect(audioStore.getTrack(track.id)?.trackHeight).toBe(120);
      audioStore.setTrackHeight(track.id, 60);
      expect(audioStore.getTrack(track.id)?.trackHeight).toBe(60);
    });
  });

  describe('reset', () => {
    it('clears all tracks and selection', () => {
      audioStore.addTrack(makeTrack());
      audioStore.reset();
      expect(audioStore.tracks.value).toHaveLength(0);
      expect(audioStore.selectedTrackId.value).toBeNull();
    });
  });
});
