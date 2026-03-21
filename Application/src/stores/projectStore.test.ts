import {describe, it, expect} from 'vitest';

describe('projectStore audio persistence', () => {
  describe('AUDIO-07: buildMceProject', () => {
    it.todo('includes audio_tracks array in output');
    it.todo('maps AudioTrack fields to MceAudioTrack snake_case');
    it.todo('sets version to 8');
  });

  describe('AUDIO-07: hydrateFromMce', () => {
    it.todo('restores audio tracks from project.audio_tracks');
    it.todo('handles v7 projects with no audio_tracks (defaults to empty)');
    it.todo('sorts tracks by order field');
  });
});
