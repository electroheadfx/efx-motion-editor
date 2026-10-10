import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {AudioTrack} from '../types/audio';
import type {FrameEntry} from '../types/timeline';
import {audioStore} from '../stores/audioStore';
import {sequenceStore} from '../stores/sequenceStore';
import {timelineStore} from '../stores/timelineStore';
import {audioEngine} from './audioEngine';
import {isPhysicPaintChildAudioClaimed, publishPhysicPaintAudioPlaybackState} from './physicPaintBridge';
import {PlaybackEngine, playbackEngine} from './playbackEngine';
import {registerDocument, reset as resetEfxPaintStore} from '../stores/efxPaintStore';
import {soloStore} from '../stores/soloStore';
import {
  createEfxPaintDocument,
  type DocumentSoundClip,
  type EfxPaintDocument,
} from '../efx-paint/document/efxPaintDocument';
import {defaultTransform, type Layer, type LayerType} from '../types/layer';
import type {Sequence} from '../types/sequence';

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
    filePath: '/Users/test/Music/kick.wav',
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

  it('scrubbing onto a leading gap preserves the active sequence and key-photo selection', async () => {
    // WR-01 (52.3-REVIEW.md): a gap entry is ownerless (sequenceId ''), never a
    // deselection signal (D-08) — pre-52.3 unowned positions had no entry and
    // preserved the active sequence.
    const {frameMap} = await import('./frameMap');
    const entries: FrameEntry[] = [
      {kind: 'gap' as const, globalFrame: 0, sequenceId: ''},
      {kind: 'gap' as const, globalFrame: 1, sequenceId: ''},
      ...Array.from({length: 4}, (_, i) => ({
        kind: 'paint' as const,
        globalFrame: i + 2,
        sequenceId: 'fx-p',
        layerId: 'roto-layer',
      })),
    ];
    (frameMap as unknown as {value: FrameEntry[]}).value = entries;
    const setActive = vi.spyOn(sequenceStore, 'setActive');

    // Pre-condition: entering the paint span activates the owning fx sequence.
    playbackEngine.scrubToFrame(2);
    expect(setActive).toHaveBeenCalledWith('fx-p');
    expect(sequenceStore.activeSequenceId.value).toBe('fx-p');
    sequenceStore.selectKeyPhoto('kp-1');
    expect(sequenceStore.selectedKeyPhotoId.value).toBe('kp-1');

    setActive.mockClear();

    // The leading gap scrub must not reach setActive at all (it also clears
    // selectedKeyPhotoId, sequenceStore.ts:1091-1094).
    playbackEngine.scrubToFrame(1);
    expect(setActive).not.toHaveBeenCalled();
    expect(sequenceStore.activeSequenceId.value).toBe('fx-p');
    expect(sequenceStore.selectedKeyPhotoId.value).toBe('kp-1');
  });

  it('scrubbing through an inter-fx gap keeps the previous owner and still activates the next one', async () => {
    // WR-01 (52.3-REVIEW.md): ownerless gap frames preserve the prior active
    // sequence; a real owner transition must still run in full.
    const {frameMap} = await import('./frameMap');
    const entries: FrameEntry[] = [
      {kind: 'paint' as const, globalFrame: 0, sequenceId: 'fx-a', layerId: 'roto-layer'},
      {kind: 'paint' as const, globalFrame: 1, sequenceId: 'fx-a', layerId: 'roto-layer'},
      {kind: 'gap' as const, globalFrame: 2, sequenceId: ''},
      {kind: 'paint' as const, globalFrame: 3, sequenceId: 'fx-b', layerId: 'roto-layer'},
      {kind: 'paint' as const, globalFrame: 4, sequenceId: 'fx-b', layerId: 'roto-layer'},
    ];
    (frameMap as unknown as {value: FrameEntry[]}).value = entries;

    playbackEngine.scrubToFrame(0);
    expect(sequenceStore.activeSequenceId.value).toBe('fx-a');
    sequenceStore.selectKeyPhoto('kp-a');

    // Inter-fx gap: neither the sequence nor its key-photo selection moves.
    playbackEngine.scrubToFrame(2);
    expect(sequenceStore.activeSequenceId.value).toBe('fx-a');
    expect(sequenceStore.selectedKeyPhotoId.value).toBe('kp-a');

    // Anti-over-suppression pin: a genuine owner change still activates and
    // still clears the key-photo selection (setActive's documented behavior).
    playbackEngine.scrubToFrame(3);
    expect(sequenceStore.activeSequenceId.value).toBe('fx-b');
    expect(sequenceStore.selectedKeyPhotoId.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 52.5-02 Task 1 (D-12/D-13/D-14, Q5/A1, MAIN-MIX-01/02): the document clip
// joins main-editor playback AFTER the main-track loop, under the D-12 clip
// switch and the D-13 composite gate. A1 pin: soloActive removes overlay
// sequences from the composite (exportRenderer skips them), so the clip is
// silent under solo exactly like the layer's pixels.
//
// Frame-space law: `sound.startFrame` is document-local (the Studio band's
// `appFrame` cells). The clip's global timeline start is
// `sequence.inFrame + sound.startFrame`, mirroring frameMap's
// `localFrame = globalFrame - seq.inFrame`.
//
// Model drift note: 52.5-02-PLAN.md predates UAT rounds 2-4 (`soundInOutput`,
// `volume` 0-100). The shipped model uses the clip's single `enabled` switch
// and `gain` (-100..+100 -> dB/5 -> true linear amplitude via the adapter).
// ---------------------------------------------------------------------------

const CLIP_LAYER = 'layer-sound';

function makeFxLayer(layerId: string, overrides: Partial<Layer> = {}): Layer {
  return {
    id: `layer-${layerId}`,
    name: 'Physics',
    type: 'physic-paint' as LayerType,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: {type: 'physic-paint', layerId},
    ...overrides,
  };
}

function makeFxSequence(overrides: Partial<Sequence> = {}): Sequence {
  return {
    id: 'seq-fx',
    kind: 'fx',
    name: 'FX',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeFxLayer(CLIP_LAYER)],
    inFrame: 0,
    outFrame: 300,
    visible: true,
    ...overrides,
  };
}

function makeSound(overrides: Partial<DocumentSoundClip> = {}): DocumentSoundClip {
  return {
    id: 'sound-clip-1',
    sourceId: 'asset-1',
    sourcePath: '/Users/test/Music/sound.wav',
    sourceRevision: 1,
    startFrame: 48,
    inFrame: 0,
    outFrame: 240,
    gain: -25,
    fadeInFrames: 6,
    fadeOutFrames: 12,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'linear',
    enabled: true,
    ...overrides,
  };
}

function registerSoundDocument(sound: DocumentSoundClip | null): EfxPaintDocument {
  const document: EfxPaintDocument = {
    ...createEfxPaintDocument(CLIP_LAYER),
    audios: sound === null ? [] : [sound],
  };
  registerDocument(document);
  return document;
}

describe('playbackEngine document clip dispatch (52.5-02, MAIN-MIX-01/02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedClaimed.mockReturnValue(false);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    audioStore.tracks.value = [];
    timelineStore.setPlaying(false);
    timelineStore.seek(0);
    soloStore.setSolo(false);
  });

  afterEach(() => {
    playbackEngine.stop();
    audioStore.tracks.value = [];
    sequenceStore.sequences.value = [];
    resetEfxPaintStore();
    soloStore.setSolo(false);
    timelineStore.setPlaying(false);
    timelineStore.seek(0);
    vi.unstubAllGlobals();
  });

  function seed(sound: DocumentSoundClip | null, sequence: Sequence) {
    sequenceStore.sequences.value = [sequence];
    registerSoundDocument(sound);
  }

  it('(c1) plays the clip mixed with the main track at the clip window (gain -> linear volume, D-14)', () => {
    seed(makeSound(), makeFxSequence());
    audioStore.tracks.value = [makeMainAudioTrack()];
    // Cursor 96 inside the clip window [48, 288): immediate at (0 + 48) / 24 = 2.0,
    // remaining (288 - 96) / 24 = 8.0. The main track dispatches too (control).
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play.mock.calls.map((call) => call[0])).toEqual(['audio-1', 'sound-clip-1']);
    expect(mockedAudio.play).toHaveBeenNthCalledWith(
      2,
      'sound-clip-1',
      2.0,
      expect.objectContaining({
        id: 'sound-clip-1',
        volume: 10 ** (-25 / 100), // 261010-bkv: gain -25 -> -5 dB -> 10^(-0.25)
        fadeInFrames: 6,
        fadeOutFrames: 12,
        fadeInCurve: 'exponential',
        fadeOutCurve: 'linear',
        offsetFrame: 48,
        inFrame: 0,
        outFrame: 240,
        slipOffset: 0,
      }),
      24,
      8.0,
    );
    expect(mockedAudio.playDelayed).not.toHaveBeenCalled();
  });

  it('(c2) a clip starting after the cursor is scheduled with playDelayed', () => {
    seed(makeSound(), makeFxSequence());
    // Cursor 24 before the clip start 48 -> delayed 1.0s at source 0, 10.0s long.
    timelineStore.seek(24);
    playbackEngine.start();
    expect(mockedAudio.play).not.toHaveBeenCalled();
    expect(mockedAudio.playDelayed).toHaveBeenCalledWith(
      'sound-clip-1',
      1.0,
      0,
      expect.objectContaining({id: 'sound-clip-1'}),
      24,
      10.0,
    );
  });

  it('(c3) the clip start is sequence-rebased: document-local start + seq.inFrame', () => {
    seed(makeSound({startFrame: 48, inFrame: 0, outFrame: 48}), makeFxSequence({inFrame: 50}));
    // Document-local 48 at seq.inFrame 50 -> global 98. Cursor 98 -> immediate
    // at source 0, 2.0s long (48 frames).
    timelineStore.seek(98);
    playbackEngine.start();
    expect(mockedAudio.play).toHaveBeenCalledWith(
      'sound-clip-1',
      0,
      expect.objectContaining({id: 'sound-clip-1', offsetFrame: 98}),
      24,
      2.0,
    );
  });

  it('(c4) enabled false silences the clip while the main track still plays (D-12)', () => {
    seed(makeSound({enabled: false}), makeFxSequence());
    audioStore.tracks.value = [makeMainAudioTrack()];
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play).not.toHaveBeenCalledWith('sound-clip-1', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(mockedAudio.play).toHaveBeenCalledWith('audio-1', expect.anything(), expect.anything(), 24, expect.anything());
  });

  it('(c5) a document without a sound never dispatches a clip', () => {
    seed(null, makeFxSequence());
    audioStore.tracks.value = [makeMainAudioTrack()];
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play.mock.calls.map((call) => call[0])).toEqual(['audio-1']);
  });

  it('(c6) hiding the fx sequence silences the clip while the main track still plays (D-13)', () => {
    seed(makeSound(), makeFxSequence({visible: false}));
    audioStore.tracks.value = [makeMainAudioTrack()];
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play).not.toHaveBeenCalledWith('sound-clip-1', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(mockedAudio.play).toHaveBeenCalledWith('audio-1', expect.anything(), expect.anything(), 24, expect.anything());
  });

  it('(c7) solo ON silences the clip while the main track still plays (A1 pin)', () => {
    seed(makeSound(), makeFxSequence());
    audioStore.tracks.value = [makeMainAudioTrack()];
    soloStore.setSolo(true);
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play).not.toHaveBeenCalledWith('sound-clip-1', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(mockedAudio.play).toHaveBeenCalledWith('audio-1', expect.anything(), expect.anything(), 24, expect.anything());
  });

  it('(c8) a held child audio claim suppresses the clip leg too (41-04 D-05)', () => {
    seed(makeSound(), makeFxSequence());
    audioStore.tracks.value = [makeMainAudioTrack()];
    mockedClaimed.mockReturnValue(true);
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play).not.toHaveBeenCalled();
    expect(mockedAudio.playDelayed).not.toHaveBeenCalled();
  });

  it('(c9) a clip-only project (no main tracks) still plays the clip', () => {
    seed(makeSound(), makeFxSequence());
    timelineStore.seek(96);
    playbackEngine.start();
    expect(mockedAudio.play.mock.calls.map((call) => call[0])).toEqual(['sound-clip-1']);
  });
});

// ---------------------------------------------------------------------------
// Source contract (plan acceptance criteria): the dispatch seam, the decode-once
// seam, and the path-safe reference join.
// ---------------------------------------------------------------------------
describe('playbackEngine document clip source contract (52.5-02)', () => {
  const readSource = (relative: string): string =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

  it('(s1) playbackEngine imports getDocument + getTimelineOverlaySequenceOutFrame and dispatches inside startAudioPlayback', () => {
    const source = readSource('./playbackEngine.ts');
    expect(source.includes('getDocument')).toBe(true);
    expect(source.includes('getTimelineOverlaySequenceOutFrame')).toBe(true);
    expect(source.includes('collectDocumentSoundClips')).toBe(true);
    const fnAt = source.indexOf('private startAudioPlayback');
    expect(fnAt >= 0).toBe(true);
    const fnBody = source.slice(fnAt, source.indexOf('private tick'));
    expect(fnBody.includes('collectDocumentSoundClips')).toBe(true);
  });

  it('(s2) the clip decodes once by sound.id through the bare sourcePath (261009-ofk)', () => {
    // The decode lives in documentSoundPeaks (one decode serves playback AND
    // the main timeline's sourceId-keyed waveform preview); projectStore and
    // the document-sync apply both route through it. 261009-ofk: the retired
    // isSafeAudioRelativePath gate is gone — sourcePath is absolute and the
    // efxasset read boundary is the only door.
    const peaksSource = readSource('./documentSoundPeaks.ts');
    expect(peaksSource.includes('audioEngine.decode(sound.id')).toBe(true);
    expect(peaksSource.includes('isSafeAudioRelativePath')).toBe(false);
    expect(peaksSource.includes('computeWaveformPeaks')).toBe(true);

    const projectSource = readSource('../stores/projectStore.ts');
    expect(projectSource.includes('ensureDocumentSoundPeaks')).toBe(true);
    const bridgeSource = readSource('./physicPaintBridge.ts');
    expect(bridgeSource.includes('ensureDocumentSoundPeaks')).toBe(true);
  });

  it('(s3) exportEngine joins the clip through buildExportMixEntries and never reads the preview-mix toggle', () => {
    const source = readSource('./exportEngine.ts');
    expect(source.includes('buildExportMixEntries')).toBe(true);
    // 261009-ofk: the retired package-relative gate is gone — sourcePath is
    // the absolute disk path mixed directly.
    expect(source.includes('isSafeAudioRelativePath')).toBe(false);
    // D-11: the preview-mix flag is preview-only — it is structurally absent
    // from the export decision (exportClipEnabled reads the clip alone).
    expect(source.includes('audioPreviewEnabled')).toBe(false);
  });
});
