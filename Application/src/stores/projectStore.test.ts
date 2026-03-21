import {describe, it, expect, beforeEach} from 'vitest';
import {projectStore} from './projectStore';
import {audioStore} from './audioStore';
import type {AudioTrack} from '../types/audio';
import type {MceProject} from '../types/project';

/** Create a minimal AudioTrack for testing */
function makeTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'track-1',
    name: 'test-audio.wav',
    filePath: '/project/audio/test-audio.wav',
    relativePath: 'audio/test-audio.wav',
    originalFilename: 'test-audio.wav',
    offsetFrame: 10,
    inFrame: 0,
    outFrame: 100,
    volume: 0.8,
    muted: false,
    fadeInFrames: 5,
    fadeOutFrames: 10,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'linear',
    sampleRate: 44100,
    duration: 4.2,
    channelCount: 2,
    order: 0,
    trackHeight: 44,
    slipOffset: 3,
    totalFramesInFile: 100,
    ...overrides,
  };
}

describe('projectStore audio persistence', () => {
  beforeEach(() => {
    audioStore.reset();
  });

  describe('AUDIO-07: buildMceProject', () => {
    it('includes audio_tracks array in output', () => {
      audioStore.tracks.value = [makeTrack()];
      const project = projectStore.buildMceProject();
      expect(project.audio_tracks).toBeDefined();
      expect(project.audio_tracks!).toHaveLength(1);
    });

    it('maps AudioTrack fields to MceAudioTrack snake_case', () => {
      audioStore.tracks.value = [makeTrack()];
      const project = projectStore.buildMceProject();
      const mat = project.audio_tracks![0];

      expect(mat.id).toBe('track-1');
      expect(mat.name).toBe('test-audio.wav');
      expect(mat.relative_path).toBe('audio/test-audio.wav');
      expect(mat.original_filename).toBe('test-audio.wav');
      expect(mat.offset_frame).toBe(10);
      expect(mat.in_frame).toBe(0);
      expect(mat.out_frame).toBe(100);
      expect(mat.volume).toBe(0.8);
      expect(mat.muted).toBe(false);
      expect(mat.fade_in_frames).toBe(5);
      expect(mat.fade_out_frames).toBe(10);
      expect(mat.fade_in_curve).toBe('exponential');
      expect(mat.fade_out_curve).toBe('linear');
      expect(mat.sample_rate).toBe(44100);
      expect(mat.duration).toBe(4.2);
      expect(mat.channel_count).toBe(2);
      expect(mat.order).toBe(0);
      expect(mat.track_height).toBe(44);
      expect(mat.slip_offset).toBe(3);
    });

    it('sets version to 8', () => {
      const project = projectStore.buildMceProject();
      expect(project.version).toBe(8);
    });

    it('outputs empty audio_tracks when none exist', () => {
      const project = projectStore.buildMceProject();
      expect(project.audio_tracks).toEqual([]);
    });
  });

  describe('AUDIO-07: hydrateFromMce', () => {
    function makeMinimalMceProject(overrides: Partial<MceProject> = {}): MceProject {
      return {
        version: 8,
        name: 'Test Project',
        fps: 24,
        width: 1920,
        height: 1080,
        created_at: '2026-01-01',
        modified_at: '2026-01-01',
        sequences: [],
        images: [],
        ...overrides,
      };
    }

    it('restores audio tracks from project.audio_tracks', () => {
      const project = makeMinimalMceProject({
        audio_tracks: [{
          id: 'a1',
          name: 'music.mp3',
          relative_path: 'audio/music.mp3',
          original_filename: 'music.mp3',
          offset_frame: 5,
          in_frame: 0,
          out_frame: 200,
          volume: 0.7,
          muted: true,
          fade_in_frames: 10,
          fade_out_frames: 20,
          fade_in_curve: 'logarithmic',
          fade_out_curve: 'exponential',
          sample_rate: 48000,
          duration: 8.3,
          channel_count: 1,
          order: 0,
          track_height: 60,
          slip_offset: -2,
          total_frames_in_file: 200,
        }],
      });

      projectStore.hydrateFromMce(project, '/test/project');

      const tracks = audioStore.tracks.value;
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('a1');
      expect(tracks[0].name).toBe('music.mp3');
      expect(tracks[0].filePath).toBe('/test/project/audio/music.mp3');
      expect(tracks[0].relativePath).toBe('audio/music.mp3');
      expect(tracks[0].volume).toBe(0.7);
      expect(tracks[0].muted).toBe(true);
      expect(tracks[0].fadeInCurve).toBe('logarithmic');
      expect(tracks[0].trackHeight).toBe(60);
      expect(tracks[0].slipOffset).toBe(-2);
    });

    it('handles v7 projects with no audio_tracks (defaults to empty)', () => {
      const project = makeMinimalMceProject({version: 7});
      // Explicitly remove audio_tracks to simulate v7
      delete (project as unknown as Record<string, unknown>).audio_tracks;

      projectStore.hydrateFromMce(project, '/test/project');

      expect(audioStore.tracks.value).toHaveLength(0);
    });

    it('sorts tracks by order field', () => {
      const project = makeMinimalMceProject({
        audio_tracks: [
          {
            id: 'b', name: 'second.wav', relative_path: 'audio/second.wav',
            original_filename: 'second.wav', offset_frame: 0, in_frame: 0,
            out_frame: 50, volume: 1, muted: false, fade_in_frames: 0,
            fade_out_frames: 0, fade_in_curve: 'exponential',
            fade_out_curve: 'exponential', sample_rate: 44100, duration: 2,
            channel_count: 2, order: 1, track_height: 44, slip_offset: 0, total_frames_in_file: 50,
          },
          {
            id: 'a', name: 'first.wav', relative_path: 'audio/first.wav',
            original_filename: 'first.wav', offset_frame: 0, in_frame: 0,
            out_frame: 50, volume: 1, muted: false, fade_in_frames: 0,
            fade_out_frames: 0, fade_in_curve: 'exponential',
            fade_out_curve: 'exponential', sample_rate: 44100, duration: 2,
            channel_count: 2, order: 0, track_height: 44, slip_offset: 0, total_frames_in_file: 50,
          },
        ],
      });

      projectStore.hydrateFromMce(project, '/test/project');

      const tracks = audioStore.tracks.value;
      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe('a');  // order 0 first
      expect(tracks[1].id).toBe('b');  // order 1 second
    });
  });
});
