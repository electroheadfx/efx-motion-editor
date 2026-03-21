import {describe, it} from 'vitest';

describe('audioStore', () => {
  describe('AUDIO-01: addTrack', () => {
    it.todo('adds a track to the tracks signal');
    it.todo('auto-selects the newly added track');
    it.todo('pushes an undo action with description');
    it.todo('marks project dirty');
  });

  describe('removeTrack', () => {
    it.todo('removes track by id');
    it.todo('clears selection if removed track was selected');
    it.todo('pushes an undo action');
  });

  describe('updateTrack', () => {
    it.todo('merges partial updates into existing track');
  });

  describe('AUDIO-05: setOffset', () => {
    it.todo('changes track offsetFrame');
    it.todo('pushes an undo action');
  });

  describe('setInOut', () => {
    it.todo('changes track inFrame and outFrame');
  });

  describe('setSlipOffset', () => {
    it.todo('changes track slipOffset');
  });

  describe('reorderTracks', () => {
    it.todo('swaps track positions and updates order fields');
  });

  describe('setMuted', () => {
    it.todo('toggles track muted state');
  });

  describe('setVolume', () => {
    it.todo('sets track volume 0-1');
  });

  describe('setTrackHeight', () => {
    it.todo('clamps height between 28 and 120');
  });

  describe('reset', () => {
    it.todo('clears all tracks and selection');
  });
});
