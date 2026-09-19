import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AudioTrack} from '../types/audio';
import type {FrameEntry} from '../types/timeline';
import {audioStore} from '../stores/audioStore';
import {sequenceStore} from '../stores/sequenceStore';
import {timelineStore} from '../stores/timelineStore';
import {audioEngine} from './audioEngine';
import {isPhysicPaintChildAudioClaimed, publishPhysicPaintAudioPlaybackState} from './physicPaintBridge';
import {PlaybackEngine, playbackEngine} from './playbackEngine';

// 41-04 (D-05): the main-side ownership gate + playback-state broadcast are
// mocked so this suite can drive claim state directly and observe the exact
// broadcast sequence without a bridge runtime.
vi.mock('./physicPaintBridge', () => ({
  isPhysicPaintChildAudioClaimed: vi.fn(() => false),
  publishPhysicPaintAudioPlaybackState: vi.fn(async () => undefined),
}));

vi.mock('./audioEngine', () => ({
  audioEngine: {
    play: vi.fn(),
    playDelayed: vi.fn(),
    stopAll: vi.fn(),
  },
}));

// Fixed timeline geometry: 300 frames, no sequences — startAudioPlayback caps
// track audibility at totalFrames (truth table section 2 main-editor rule).
// importOriginal keeps the remaining exports (timelineStore reads more than
// the three playbackEngine consumes).
vi.mock('./frameMap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./frameMap')>();
  const {signal: mockSignal} = await import('@preact/signals');
  return {
    ...actual,
    totalFrames: mockSignal(300),
    frameMap: mockSignal([]),
    trackLayouts: mockSignal([]),
  };
});

const mockedClaimed = vi.mocked(isPhysicPaintChildAudioClaimed);
const mockedPublish = vi.mocked(publishPhysicPaintAudioPlaybackState);
const mockedAudio = vi.mocked(audioEngine);

function makeMainAudioTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'audio-1',
    audioAssetId: 'asset-1',
    name: 'kick',
    filePath: '/audio/kick.wav',
    relativePath: 'audio/kick.wav',
    originalFilename: 'kick.wav',
    offsetFrame: 0,
    inFrame: 0,
    outFrame: 240,
    volume: 1,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'exponential',
    sampleRate: 48000,
    duration: 10,
    channelCount: 2,
    order: 0,
    trackHeight: 44,
    slipOffset: 0,
    totalFramesInFile: 240,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
    ...overrides,
  };
}

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

describe('playbackEngine ownership guard (41-04 Task 1: D-05 symmetric, AUDIO-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedClaimed.mockReturnValue(false);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
  });

  afterEach(() => {
    playbackEngine.stop();
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
    vi.unstubAllGlobals();
  });

  it('(d) a held child audio claim suppresses main startAudioPlayback; start/stop still broadcast playback state (D-05)', () => {
    audioStore.tracks.value = [makeMainAudioTrack()];
    mockedClaimed.mockReturnValue(true);
    playbackEngine.start();
    // Suppressed: visual playback proceeds but zero audio dispatch.
    expect(mockedAudio.play).not.toHaveBeenCalled();
    expect(mockedAudio.playDelayed).not.toHaveBeenCalled();
    // The main window still broadcasts its state so the child can suppress /
    // auto-resume on its side.
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    expect(mockedPublish).toHaveBeenLastCalledWith(true);
    playbackEngine.stop();
    expect(mockedPublish).toHaveBeenLastCalledWith(false);
    // Gate open (no claim): the same start dispatches audio at the cursor.
    mockedClaimed.mockReturnValue(false);
    playbackEngine.start();
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    playbackEngine.stop();
  });

  it('an unclaimed gate lets muted tracks stay silent and unmuted tracks play (control)', () => {
    audioStore.tracks.value = [makeMainAudioTrack(), makeMainAudioTrack({id: 'audio-2', muted: true})];
    playbackEngine.start();
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    expect(mockedAudio.play).toHaveBeenCalledWith(
      'audio-1',
      0,
      expect.objectContaining({id: 'audio-1'}),
      24,
      240 / 24,
    );
    playbackEngine.stop();
    expect(mockedAudio.stopAll).toHaveBeenCalled();
  });
});

describe('playbackEngine audible scrub (TIME-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedClaimed.mockReturnValue(false);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
    timelineStore.seek(0);
    // Singleton scrub state reset (throttle timestamp + snippet flag).
    playbackEngine.scrubAudioEnd();
    vi.clearAllMocks();
  });

  afterEach(() => {
    playbackEngine.stop();
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
    vi.unstubAllGlobals();
  });

  it('dispatches a 4-frame-capped snippet at the dragged frame while idle', () => {
    audioStore.tracks.value = [makeMainAudioTrack()];
    playbackEngine.scrubToFrame(48);
    expect(mockedAudio.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    expect(mockedAudio.play).toHaveBeenCalledWith(
      'audio-1',
      48 / 24,
      expect.objectContaining({id: 'audio-1'}),
      24,
      4 / 24,
    );
  });

  it('throttles snippet re-dispatch to the 120ms scrub window', () => {
    audioStore.tracks.value = [makeMainAudioTrack()];
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(1000);
    playbackEngine.scrubToFrame(10);
    nowSpy.mockReturnValue(1050); // 50ms inside the throttle window
    playbackEngine.scrubToFrame(11);
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    nowSpy.mockReturnValue(1130); // 130ms past the window
    playbackEngine.scrubToFrame(12);
    expect(mockedAudio.play).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('stays silent while the child audio claim is held (D-05 symmetric guard)', () => {
    audioStore.tracks.value = [makeMainAudioTrack()];
    mockedClaimed.mockReturnValue(true);
    playbackEngine.scrubToFrame(48);
    expect(mockedAudio.play).not.toHaveBeenCalled();
    expect(mockedAudio.playDelayed).not.toHaveBeenCalled();
  });

  it('seek-restarts full audio while playing instead of the snippet', () => {
    audioStore.tracks.value = [makeMainAudioTrack()];
    timelineStore.setPlaying(true);
    playbackEngine.scrubToFrame(48);
    expect(mockedAudio.play).toHaveBeenCalledWith(
      'audio-1',
      48 / 24,
      expect.objectContaining({id: 'audio-1'}),
      24,
      (240 - 48) / 24,
    );
    timelineStore.setPlaying(false);
  });

  it('scrubAudioEnd stops the snippet and un-throttles the next scrub', () => {
    audioStore.tracks.value = [makeMainAudioTrack()];
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(2000);
    playbackEngine.scrubToFrame(10);
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    playbackEngine.scrubAudioEnd();
    expect(mockedAudio.stopAll).toHaveBeenCalledTimes(2);
    nowSpy.mockReturnValue(2010); // inside the OLD throttle window
    playbackEngine.scrubToFrame(20);
    expect(mockedAudio.play).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('scrubAudioEnd is a silent no-op when no snippet is sounding', () => {
    playbackEngine.scrubAudioEnd();
    expect(mockedAudio.stopAll).not.toHaveBeenCalled();
  });

  it('keeps muted tracks silent during scrub', () => {
    audioStore.tracks.value = [makeMainAudioTrack({muted: true})];
    playbackEngine.scrubToFrame(48);
    expect(mockedAudio.play).not.toHaveBeenCalled();
  });
});

describe('playbackEngine paint-frame activation (52.3-02, Pitfall 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedClaimed.mockReturnValue(false);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
    timelineStore.seek(0);
    sequenceStore.reset();
    // Singleton scrub state reset (throttle timestamp + snippet flag).
    playbackEngine.scrubAudioEnd();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    playbackEngine.scrubAudioEnd();
    playbackEngine.stop();
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
    sequenceStore.reset();
    // Restore the frameMap mock to empty so no paint entries leak into other
    // describes (the mock module is shared file-wide).
    const {frameMap} = await import('./frameMap');
    (frameMap as unknown as {value: FrameEntry[]}).value = [];
    vi.unstubAllGlobals();
  });

  it('playback into a paint frame activates the owning fx sequence', async () => {
    // Pitfall 3 (52.3): the dense frameMap makes paint frames activatable —
    // playhead entry into one fires sequenceStore.setActive(fxId) through the
    // same syncActiveSequence path the AUDIO cases drive. Deliberate,
    // D-08-consistent behavior. (setActive also clears selectedKeyPhotoId —
    // that is setActive's own tested behavior, out of scope here.)
    const {frameMap} = await import('./frameMap');
    const paintEntries: FrameEntry[] = Array.from({length: 10}, (_, globalFrame) => ({
      kind: 'paint' as const,
      globalFrame,
      sequenceId: 'fx-p',
      layerId: 'roto-layer',
    }));
    (frameMap as unknown as {value: FrameEntry[]}).value = paintEntries;
    const setActive = vi.spyOn(sequenceStore, 'setActive');

    playbackEngine.scrubToFrame(4);

    expect(setActive).toHaveBeenCalledWith('fx-p');
    expect(sequenceStore.activeSequenceId.value).toBe('fx-p');
  });
});
