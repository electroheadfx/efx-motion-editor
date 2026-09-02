import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../../../lib/audioEngine';
import {
  applyRevisionedEfxPaintAudioPreview,
  parseEfxPaintAudioPreviewSection,
  resolveTrackPlayback,
} from './efxPaintAudioPreviewContext';
import { efxPaintAudioMonitor, handleEfxPaintAudioContextEvent, resumeEfxPaintAudioAtLiveCursor } from './efxPaintAudioMonitor';
import { audioPreviewEnabled, efxPaintAudioPreviewStore, setAudioPreviewEnabled } from './efxPaintAudioPreviewStore';
import { EFX_PAINT_AUDIO_SUPPRESSED_NOTE, efxPaintAudioOwnership } from './efxPaintAudioOwnership';

// Controllable Web Audio clock: the monitor captures ctx.currentTime at each
// seek-aligned start and compares against it in the throttled drift check
// (D-10). Tests advance `fakeAudioContext.currentTime` to simulate drift.
// `engineContextState.exists` simulates the engine's lazy AudioContext
// lifecycle for the 41-05 release tests (D-08): ensureContext creates it,
// closeContext discards it.
const { fakeAudioContext, engineContextState } = vi.hoisted(() => ({
  fakeAudioContext: { currentTime: 0 },
  engineContextState: { exists: false },
}));

vi.mock('../../../lib/audioEngine', () => ({
  audioEngine: {
    ensureContext: vi.fn(() => {
      engineContextState.exists = true;
      return fakeAudioContext;
    }),
    decode: vi.fn(async () => ({})),
    getBuffer: vi.fn(),
    play: vi.fn(),
    playDelayed: vi.fn(),
    stopAll: vi.fn(),
    hasContext: vi.fn(() => engineContextState.exists),
    closeContext: vi.fn(async () => {
      engineContextState.exists = false;
    }),
  },
}));

// RED suite for the locked frame-to-audio truth table:
// .planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md
// Every numeric expectation below mirrors a worked example in section 3 of that document.

function makeAudioPreviewTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'track-1',
    assetUrl: 'efxasset://localhost/Volumes/media/audio/kick.wav',
    offsetFrame: 48,
    inFrame: 24,
    outFrame: 240,
    slipOffset: 12,
    volume: 0.8,
    muted: false,
    fadeInFrames: 6,
    fadeOutFrames: 12,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'exponential',
    ...overrides,
  };
}

function makeAudioPreviewSection(overrides: Record<string, unknown> = {}) {
  return {
    revision: 1,
    fps: 24,
    tracks: [makeAudioPreviewTrack()],
    ...overrides,
  };
}

function makePreviewStore() {
  let section: unknown = null;
  return {
    getSection: () => section,
    setSection: (next: unknown) => {
      section = next;
    },
    snapshot: () => JSON.stringify(section),
  };
}

describe('parseEfxPaintAudioPreviewSection', () => {
  it('accepts a canonical section and returns it', () => {
    const section = makeAudioPreviewSection();
    expect(parseEfxPaintAudioPreviewSection(section)).toEqual(section);
  });

  it('accepts a canonical section with an empty track list', () => {
    const section = makeAudioPreviewSection({ tracks: [] });
    expect(parseEfxPaintAudioPreviewSection(section)).toEqual(section);
  });

  it('rejects unknown top-level keys (closed-key schema)', () => {
    expect(parseEfxPaintAudioPreviewSection(makeAudioPreviewSection({ unexpected: true }))).toBeNull();
  });

  it('rejects a missing revision', () => {
    const { revision: _revision, ...noRevision } = makeAudioPreviewSection();
    expect(parseEfxPaintAudioPreviewSection(noRevision)).toBeNull();
  });

  it('rejects a non-integer revision (float and string)', () => {
    expect(parseEfxPaintAudioPreviewSection(makeAudioPreviewSection({ revision: 1.5 }))).toBeNull();
    expect(parseEfxPaintAudioPreviewSection(makeAudioPreviewSection({ revision: '1' }))).toBeNull();
  });

  it('rejects a track missing assetUrl', () => {
    const { assetUrl: _assetUrl, ...noUrl } = makeAudioPreviewTrack();
    expect(parseEfxPaintAudioPreviewSection(makeAudioPreviewSection({ tracks: [noUrl] }))).toBeNull();
  });

  it('rejects non-finite numbers in the payload', () => {
    expect(
      parseEfxPaintAudioPreviewSection(
        makeAudioPreviewSection({ tracks: [makeAudioPreviewTrack({ offsetFrame: Number.POSITIVE_INFINITY })] }),
      ),
    ).toBeNull();
    expect(parseEfxPaintAudioPreviewSection(makeAudioPreviewSection({ fps: Number.NaN }))).toBeNull();
  });

  it('rejects tracks carrying unknown keys — including D-04 path fields', () => {
    expect(
      parseEfxPaintAudioPreviewSection(
        makeAudioPreviewSection({ tracks: [makeAudioPreviewTrack({ filePath: '/Users/dev/audio/kick.wav' })] }),
      ),
    ).toBeNull();
    expect(
      parseEfxPaintAudioPreviewSection(
        makeAudioPreviewSection({ tracks: [makeAudioPreviewTrack({ relativePath: 'audio/kick.wav' })] }),
      ),
    ).toBeNull();
    expect(
      parseEfxPaintAudioPreviewSection(
        makeAudioPreviewSection({ tracks: [makeAudioPreviewTrack({ checksum: 'abc' })] }),
      ),
    ).toBeNull();
  });

  it('rejects non-structured-clone values (functions, class instances)', () => {
    expect(
      parseEfxPaintAudioPreviewSection(
        makeAudioPreviewSection({ tracks: [makeAudioPreviewTrack({ play() { /* not plain data */ } })] }),
      ),
    ).toBeNull();
    class ForeignTrack {
      id = 'track-foreign';
    }
    expect(parseEfxPaintAudioPreviewSection(makeAudioPreviewSection({ tracks: [new ForeignTrack()] }))).toBeNull();
  });

  it('returns null instead of throwing on garbage input', () => {
    expect(parseEfxPaintAudioPreviewSection(null)).toBeNull();
    expect(parseEfxPaintAudioPreviewSection(undefined)).toBeNull();
    expect(parseEfxPaintAudioPreviewSection('not-a-section')).toBeNull();
    expect(parseEfxPaintAudioPreviewSection([makeAudioPreviewSection()])).toBeNull();
  });
});

describe('applyRevisionedEfxPaintAudioPreview (revision guard, D-02 / AUDIO-04)', () => {
  it('applies an incoming section when its revision is newer than the current one', () => {
    const store = makePreviewStore();
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 1 }));
    expect(store.getSection()).toEqual(makeAudioPreviewSection({ revision: 1 }));
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 2, tracks: [] }));
    expect(store.getSection()).toEqual(makeAudioPreviewSection({ revision: 2, tracks: [] }));
  });

  it('drops stale revisions silently (older never overwrites newer)', () => {
    const store = makePreviewStore();
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 3 }));
    const before = store.snapshot();
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 2, tracks: [] }));
    expect(store.snapshot()).toBe(before);
    expect(store.getSection()).toEqual(makeAudioPreviewSection({ revision: 3 }));
  });

  it('drops equal revisions — re-applying the same revision is a defined no-op (idempotency)', () => {
    const store = makePreviewStore();
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 2 }));
    const before = store.snapshot();
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 2, tracks: [] }));
    expect(store.snapshot()).toBe(before);
  });

  it('resolves interleaved re-hydration and push events to the newest revision (single application funnel)', () => {
    const store = makePreviewStore();
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 5 }));
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 4 })); // stale hydration
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 6, tracks: [] }));
    applyRevisionedEfxPaintAudioPreview(store, makeAudioPreviewSection({ revision: 5 })); // replayed push
    expect(store.getSection()).toEqual(makeAudioPreviewSection({ revision: 6, tracks: [] }));
  });
});

describe('resolveTrackPlayback (truth table section 3, projectFps = 24)', () => {
  it('worked example 1 — plain offset inside the window starts immediately', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 0, outFrame: 240, slipOffset: 0 });
    expect(resolveTrackPlayback(track, 96, 288, 24)).toEqual({
      kind: 'immediate',
      sourceOffsetSec: 2.0,
      maxPlaySec: 8.0,
    });
  });

  it('worked example 2 — offset + trim inside the window', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 0 });
    expect(resolveTrackPlayback(track, 96, 288, 24)).toEqual({
      kind: 'immediate',
      sourceOffsetSec: 3.0,
      maxPlaySec: 7.0,
    });
  });

  it('worked example 3 — offset + trim + slip inside the window', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 12 });
    expect(resolveTrackPlayback(track, 96, 288, 24)).toEqual({
      kind: 'immediate',
      sourceOffsetSec: 3.5,
      maxPlaySec: 7.0,
    });
  });

  it('cursor exactly at offsetFrame starts immediately with framesIntoTrack = 0 (half-open interval)', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 12 });
    expect(resolveTrackPlayback(track, 48, 288, 24)).toEqual({
      kind: 'immediate',
      sourceOffsetSec: 1.5,
      maxPlaySec: 9.0,
    });
  });

  it('worked example 4 — future track is scheduled with a delay', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 12 });
    expect(resolveTrackPlayback(track, 24, 288, 24)).toEqual({
      kind: 'delayed',
      delaySec: 1.0,
      sourceOffsetSec: 1.5,
      maxPlaySec: 9.0,
    });
  });

  it('worked example 5 — effectiveEnd caps at the playback-range end (loop window), never beyond', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 0 });
    expect(resolveTrackPlayback(track, 96, 200, 24)).toEqual({
      kind: 'immediate',
      sourceOffsetSec: 3.0,
      maxPlaySec: (200 - 96) / 24,
    });
  });

  it('worked example 6 — muted tracks resolve to null', () => {
    const track = makeAudioPreviewTrack({ muted: true });
    expect(resolveTrackPlayback(track, 96, 288, 24)).toBeNull();
  });

  it('worked example 7 — cursor at/after effectiveEnd resolves to null (window fully behind cursor)', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 0 });
    expect(resolveTrackPlayback(track, 264, 288, 24)).toBeNull();
    expect(resolveTrackPlayback(track, 300, 288, 24)).toBeNull();
  });

  it('worked example 8 — window fully capped by the playback-range end resolves to null', () => {
    const track = makeAudioPreviewTrack({ offsetFrame: 200, inFrame: 0, outFrame: 240, slipOffset: 0 });
    expect(resolveTrackPlayback(track, 96, 200, 24)).toBeNull();
  });
});

describe('D-04 path-leak guard', () => {
  it('a parsed canonical payload carries no filesystem paths or path fields', () => {
    const parsed = parseEfxPaintAudioPreviewSection(makeAudioPreviewSection());
    expect(parsed).not.toBeNull();
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('/Users/');
    expect(serialized).not.toContain('filePath');
    expect(serialized).not.toContain('relativePath');
  });
});

const mockedAudioEngine = vi.mocked(audioEngine);

function stubFetchOk() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })));
}

function parseOrThrow(section: unknown) {
  const parsed = parseEfxPaintAudioPreviewSection(section);
  expect(parsed).not.toBeNull();
  if (!parsed) throw new Error('unreachable');
  return parsed;
}

describe('efxPaintAudioMonitor (Play wiring, truth table section 3 dispatch)', () => {
  beforeEach(() => {
    efxPaintAudioMonitor.stop();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('playAtCursor dispatches play with worked-example 3 numbers (immediate, offset+trim+slip)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({
      revision: 1,
      tracks: [makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 12 })],
    }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(mockedAudioEngine.ensureContext).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      3.5,
      expect.objectContaining({ id: 'track-1', volume: 0.8, fadeInFrames: 6 }),
      24,
      7.0,
    );
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
  });

  it('playAtCursor dispatches playDelayed with worked-example 4 numbers (future track)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({
      revision: 1,
      tracks: [makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 12 })],
    }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(24, 288);
    expect(mockedAudioEngine.playDelayed).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.playDelayed).toHaveBeenCalledWith(
      'track-1',
      1.0,
      1.5,
      expect.objectContaining({ id: 'track-1' }),
      24,
      9.0,
    );
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
  });

  it('playAtCursor caps maxPlaySec at the playback-range end (worked example 5)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({
      revision: 1,
      tracks: [makeAudioPreviewTrack({ offsetFrame: 48, inFrame: 24, outFrame: 240, slipOffset: 0 })],
    }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 200);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      3.0,
      expect.objectContaining({ id: 'track-1' }),
      24,
      (200 - 96) / 24,
    );
  });

  it('a rejecting fetch for one track warns and skips only that track; the others still play (AUDIO-06)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('missing')) throw new Error('efxasset 404');
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    }));
    const context = parseOrThrow(makeAudioPreviewSection({
      revision: 1,
      tracks: [
        makeAudioPreviewTrack({ id: 'track-good', assetUrl: 'efxasset://localhost/Volumes/media/audio/good.wav', offsetFrame: 48, inFrame: 0, outFrame: 240, slipOffset: 0 }),
        makeAudioPreviewTrack({ id: 'track-missing', assetUrl: 'efxasset://localhost/Volumes/media/audio/missing.wav', offsetFrame: 48, inFrame: 0, outFrame: 240, slipOffset: 0 }),
      ],
    }));
    await expect(efxPaintAudioMonitor.prepare(context)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain('track-missing');
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-good',
      2.0,
      expect.objectContaining({ id: 'track-good' }),
      24,
      8.0,
    );
    warn.mockRestore();
  });

  it('stop() after playAtCursor calls stopAll exactly once; a second stop() is a no-op', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
    efxPaintAudioMonitor.stop();
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    efxPaintAudioMonitor.stop();
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
  });

  it('playAtCursor while already playing performs stopAll before re-dispatch (seek-restart)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    efxPaintAudioMonitor.playAtCursor(120, 288);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(2);
    expect(mockedAudioEngine.play).toHaveBeenLastCalledWith(
      'track-1',
      (24 + 12 + (120 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      // effectiveEnd = min(48 + (240 - 24), 288) = 264 (trim caps before range end)
      (264 - 120) / 24,
    );
  });

  it('positionedAt repositions silently — no engine dispatch (D-09 silent scrub)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.positionedAt(144);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.ensureContext).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
  });
});

describe('seek wiring regression (260902-cfa: D-02 seek-restart / D-09 silent re-anchor)', () => {
  beforeEach(() => {
    efxPaintAudioMonitor.stop();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  it('seek-while-idle re-anchors silently (D-09/D-02): positionedAt repositions the anchor with zero engine dispatch', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.positionedAt(144);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.ensureContext).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
  });

  it('seek-while-playing is a full seek-restart (truth table section 5): playAtCursor at the new cursor performs stopAll then re-dispatch', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    efxPaintAudioMonitor.playAtCursor(120, 288);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(2);
    // stopAll runs BEFORE the second (new-cursor) play dispatch.
    expect(mockedAudioEngine.stopAll.mock.invocationCallOrder[0])
      .toBeLessThan(mockedAudioEngine.play.mock.invocationCallOrder[1]);
    // The second play uses the new-cursor mapping:
    // sourceOffset = (inFrame + slipOffset + (120 - offsetFrame)) / fps.
    expect(mockedAudioEngine.play).toHaveBeenLastCalledWith(
      'track-1',
      (24 + 12 + (120 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      // effectiveEnd = min(48 + (240 - 24), 288) = 264 (trim caps before range end)
      (264 - 120) / 24,
    );
  });
});

describe('audible scrub (260902-cfa amendment: D-02 throttled snippet / D-09 silent when muted)', () => {
  beforeEach(() => {
    efxPaintAudioMonitor.stop();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  it('scrubAt dispatches a short snippet at the cursor through playAtCursor, throttled to ~120ms', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(1000);
    efxPaintAudioMonitor.scrubAt(96);
    // Snippet window: cursor + EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES (4).
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenLastCalledWith(
      'track-1',
      (24 + 12 + (96 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      (100 - 96) / 24,
    );
    // 100ms later — inside the 120ms throttle: no re-dispatch.
    nowSpy.mockReturnValue(1100);
    efxPaintAudioMonitor.scrubAt(120);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    // 200ms after the first dispatch: a fresh snippet re-dispatches.
    nowSpy.mockReturnValue(1200);
    efxPaintAudioMonitor.scrubAt(144);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(2);
    expect(mockedAudioEngine.play).toHaveBeenLastCalledWith(
      'track-1',
      (24 + 12 + (144 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      (148 - 144) / 24,
    );
  });

  it('scrubAt with the toggle off re-anchors silently — zero engine dispatch (D-09 unchanged)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    setAudioPreviewEnabled(false);
    efxPaintAudioMonitor.scrubAt(96);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.ensureContext).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    expect(efxPaintAudioMonitor.getAnchorAppFrame()).toBe(96);
    setAudioPreviewEnabled(true);
  });

  it('scrubEnd stops the snippet and re-anchors at the final frame', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.scrubAt(96);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    efxPaintAudioMonitor.scrubEnd(120);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    expect(efxPaintAudioMonitor.getAnchorAppFrame()).toBe(120);
  });
});

describe('efxPaintAudioMonitor sync behaviors (41-03: D-09 scrub, D-10 drift, D-11 loop wrap, A6 fps note)', () => {
  beforeEach(() => {
    efxPaintAudioMonitor.stop();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  async function prepareAndPlay(cursorAppFrame = 96, playbackRangeEnd = 288) {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(cursorAppFrame, playbackRangeEnd);
  }

  it('(a) scrub while playing repositions the anchor with zero audio dispatch (D-09)', async () => {
    await prepareAndPlay(96, 288);
    vi.clearAllMocks();
    efxPaintAudioMonitor.positionedAt(120);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.getAnchorAppFrame()).toBe(120);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('(b) notifyLoopWrap performs stopAll then play at the mapped loop-start offset (D-11)', async () => {
    await prepareAndPlay(96, 288);
    vi.clearAllMocks();
    efxPaintAudioMonitor.notifyLoopWrap(48, 288);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    // cursor == track.offsetFrame → framesIntoTrack = 0 → (24 + 12 + 0) / 24 = 1.5
    // effectiveEnd = min(48 + (240 - 24), 288) = 264 → maxPlaySec = (264 - 48) / 24 = 9.0
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      1.5,
      expect.objectContaining({ id: 'track-1' }),
      24,
      9.0,
    );
    expect(mockedAudioEngine.stopAll.mock.invocationCallOrder[0])
      .toBeLessThan(mockedAudioEngine.play.mock.invocationCallOrder[0]);
  });

  it('notifyLoopWrap is a no-op when not playing', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    vi.clearAllMocks();
    efxPaintAudioMonitor.notifyLoopWrap(48, 288);
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
  });

  it('(c) corrects only beyond the 40ms threshold: 30ms drift is ignored, 50ms triggers exactly one stopAll + restart (D-10)', async () => {
    await prepareAndPlay(96, 288); // anchor: appFrame 96, ctxTime 0
    vi.clearAllMocks();
    // 10 ticks, cursor advances one appFrame per tick; audio clock runs 30ms slow.
    fakeAudioContext.currentTime = 10 / 24 - 0.03;
    for (let tick = 1; tick <= 10; tick += 1) efxPaintAudioMonitor.checkDrift(96 + tick, 288);
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    // 10 more ticks; audio clock now runs 50ms fast → exactly one seek-restart.
    fakeAudioContext.currentTime = 20 / 24 + 0.05;
    for (let tick = 11; tick <= 20; tick += 1) efxPaintAudioMonitor.checkDrift(96 + tick, 288);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      (24 + 12 + (116 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      // effectiveEnd = min(48 + (240 - 24), 288) = 264
      (264 - 116) / 24,
    );
  });

  it('(d) checkDrift self-throttles: nine calls do nothing, the tenth runs the comparison (D-10 — never per frame)', async () => {
    await prepareAndPlay(96, 288);
    vi.clearAllMocks();
    // 100ms fast — over threshold whenever the comparison actually runs.
    fakeAudioContext.currentTime = 9 / 24 + 0.1;
    for (let tick = 1; tick <= 9; tick += 1) efxPaintAudioMonitor.checkDrift(96 + tick, 288);
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    fakeAudioContext.currentTime = 10 / 24 + 0.1;
    efxPaintAudioMonitor.checkDrift(106, 288);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
  });

  it('checkDrift is a no-op unless playing', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    fakeAudioContext.currentTime = 5;
    for (let tick = 1; tick <= 12; tick += 1) efxPaintAudioMonitor.checkDrift(96 + tick, 288);
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
  });

  it('(e) fps mismatch surfaces a non-blocking note once per playback session and never touches playbackRate (locked A6)', async () => {
    await prepareAndPlay(96, 288); // context fps = 24
    const note = efxPaintAudioMonitor.noteFpsMismatchOnce(24, 12);
    expect(note).toBeTruthy();
    expect(String(note)).toContain('12');
    expect(String(note)).toContain('24');
    // Once per playback session: a second mismatched call is silent.
    expect(efxPaintAudioMonitor.noteFpsMismatchOnce(24, 12)).toBeNull();
    // Matched fps never notes, and a new session (after stop) notes again.
    efxPaintAudioMonitor.stop();
    expect(efxPaintAudioMonitor.noteFpsMismatchOnce(24, 24)).toBeNull();
    expect(efxPaintAudioMonitor.noteFpsMismatchOnce(24, 8)).toBeTruthy();
    // No playbackRate scaling ever reaches the engine dispatch surface.
    for (const call of mockedAudioEngine.play.mock.calls) {
      expect(call[2]).not.toHaveProperty('playbackRate');
    }
  });
});

describe('push-on-change revisioned updates (41-03 Task 2: D-02/D-03, AUDIO-04 edges)', () => {
  beforeEach(() => {
    efxPaintAudioMonitor.stop();
    efxPaintAudioPreviewStore.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  it('(2) double-delivery of one revision applies exactly once; the second delivery is a silent drop (idempotency)', async () => {
    stubFetchOk();
    const section = makeAudioPreviewSection({ revision: 7 });
    const first = handleEfxPaintAudioContextEvent(section);
    expect(first).not.toBeNull();
    await first;
    expect(efxPaintAudioPreviewStore.getSection()?.revision).toBe(7);
    const second = handleEfxPaintAudioContextEvent(section);
    expect(second).toBeNull();
    // Exactly one application: a single fetch+decode cycle for the track.
    expect(mockedAudioEngine.decode).toHaveBeenCalledTimes(1);
  });

  it('(3) out-of-order delivery (3, 2, 4) resolves to the newest revision with exactly two applications (concurrency)', async () => {
    stubFetchOk();
    const applySpy = vi.spyOn(efxPaintAudioMonitor, 'applyRevisionedContext');
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 3 }));
    expect(handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 2, tracks: [] }))).toBeNull();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 4, tracks: [] }));
    expect(efxPaintAudioPreviewStore.getSection()?.revision).toBe(4);
    expect(efxPaintAudioPreviewStore.getSection()?.tracks).toEqual([]);
    expect(applySpy).toHaveBeenCalledTimes(2);
  });

  it('(4) a newer context arriving mid-playback restarts at the current Paint cursor with the new context (D-03)', async () => {
    stubFetchOk();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 1 }));
    efxPaintAudioMonitor.playAtCursor(96, 288);
    // Playback ticks advance the Paint cursor to appFrame 100.
    efxPaintAudioMonitor.checkDrift(100, 288);
    vi.clearAllMocks();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({
      revision: 2,
      tracks: [makeAudioPreviewTrack({ slipOffset: 0 })],
    }));
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    // Restart mapping at cursor 100 with the NEW context (slipOffset 0):
    // sourceOffset = (24 + 0 + (100 - 48)) / 24; effectiveEnd = 264.
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      (24 + (100 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      (264 - 100) / 24,
    );
    expect(mockedAudioEngine.stopAll.mock.invocationCallOrder[0])
      .toBeLessThan(mockedAudioEngine.play.mock.invocationCallOrder[0]);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('(5) a stale event while playing is dropped silently with zero audio dispatch', async () => {
    stubFetchOk();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 5 }));
    efxPaintAudioMonitor.playAtCursor(96, 288);
    vi.clearAllMocks();
    const result = handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 3 }));
    expect(result).toBeNull();
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioPreviewStore.getSection()?.revision).toBe(5);
  });

  it('a newer context while idle/positioned updates the stored context and repositions the anchor with no audio dispatch', async () => {
    stubFetchOk();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 1 }));
    efxPaintAudioMonitor.positionedAt(72);
    vi.clearAllMocks();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 2, tracks: [] }));
    expect(efxPaintAudioPreviewStore.getSection()?.revision).toBe(2);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.getAnchorAppFrame()).toBe(72);
  });
});

describe('first-player-wins ownership guard (41-04 Task 1: D-05..D-07, AUDIO-06)', () => {
  // Ownership state is module-scope session state — reset it around every
  // test so a held claim, a playing main window, a suppression, or a muted
  // toggle can never leak into another describe (later suites exercise
  // playAtCursor and must see the default unclaimed/unmuted state).
  function resetOwnership() {
    efxPaintAudioOwnership.noteVisualStop();
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    efxPaintAudioOwnership.releaseAudio();
    efxPaintAudioOwnership.configure({ statusPublisher: null, claimSender: null, resumeHandler: resumeEfxPaintAudioAtLiveCursor });
    audioPreviewEnabled.value = true;
    efxPaintAudioMonitor.stop();
  }

  beforeEach(() => {
    resetOwnership();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  afterEach(() => {
    resetOwnership();
  });

  it('(a) main playing blocks the child audio start and publishes the suppressed note (D-05/D-06)', async () => {
    const published: Array<string | null> = [];
    const claims: boolean[] = [];
    efxPaintAudioOwnership.configure({ statusPublisher: (note) => published.push(note), claimSender: (claim) => claims.push(claim) });
    efxPaintAudioOwnership.noteMainPlaybackState(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    // Suppressed start dispatches zero engine calls and claims nothing.
    expect(mockedAudioEngine.ensureContext).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    expect(efxPaintAudioOwnership.isSuppressed()).toBe(true);
    expect(claims).toEqual([]);
    // D-06: suppression is never silent — the exact note, exactly once.
    expect(EFX_PAINT_AUDIO_SUPPRESSED_NOTE).toBe('Audio playing in main editor');
    expect(published).toEqual(['Audio playing in main editor']);
    // A repeated Play attempt while still suppressed does not duplicate the note.
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(published).toEqual(['Audio playing in main editor']);
  });

  it('(b) main stop auto-resumes at the current Paint cursor and clears the note (D-07)', async () => {
    const published: Array<string | null> = [];
    const claims: boolean[] = [];
    efxPaintAudioOwnership.configure({ statusPublisher: (note) => published.push(note), claimSender: (claim) => claims.push(claim) });
    efxPaintAudioOwnership.noteMainPlaybackState(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288); // suppressed — zero dispatch
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    // Visual playback ticks advance the Paint cursor to 100 while suppressed.
    efxPaintAudioMonitor.checkDrift(100, 288);
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    // Auto-resume restarts monitoring at the CURRENT cursor (100), claims
    // ownership, and clears the suppressed note.
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      (24 + 12 + (100 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      // effectiveEnd = min(48 + (240 - 24), 288) = 264
      (264 - 100) / 24,
    );
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
    expect(efxPaintAudioOwnership.isSuppressed()).toBe(false);
    expect(published).toEqual(['Audio playing in main editor', null]);
    expect(claims).toEqual([true]);
  });

  it('(c) claim/release round-trip; a release for a non-held claim is a no-op (idempotent)', async () => {
    const claims: boolean[] = [];
    efxPaintAudioOwnership.configure({ claimSender: (claim) => claims.push(claim) });
    expect(efxPaintAudioOwnership.isClaimHeld()).toBe(false);
    efxPaintAudioOwnership.claimAudio();
    efxPaintAudioOwnership.claimAudio(); // double claim is a no-op
    expect(claims).toEqual([true]);
    expect(efxPaintAudioOwnership.isClaimHeld()).toBe(true);
    efxPaintAudioOwnership.releaseAudio();
    expect(claims).toEqual([true, false]);
    expect(efxPaintAudioOwnership.isClaimHeld()).toBe(false);
    efxPaintAudioOwnership.releaseAudio(); // release without a held claim: no-op
    expect(claims).toEqual([true, false]);
  });

  it('monitor.stop() releases the ownership claim through the single stop funnel (D-05 lifecycle)', async () => {
    const claims: boolean[] = [];
    efxPaintAudioOwnership.configure({ claimSender: (claim) => claims.push(claim) });
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(claims).toEqual([true]);
    efxPaintAudioMonitor.stop();
    expect(claims).toEqual([true, false]);
    efxPaintAudioMonitor.stop(); // second stop: no doubled release
    expect(claims).toEqual([true, false]);
  });

  it('the child keeps monitoring when the main editor starts later (first-player-wins, claim held)', async () => {
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288); // child starts first — claims
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
    vi.clearAllMocks();
    // Main starts later: the child holds the claim, so its loop-wrap restart
    // is NOT suppressed — the loser (main side, test (d)) suppresses instead.
    efxPaintAudioOwnership.noteMainPlaybackState(true);
    efxPaintAudioMonitor.notifyLoopWrap(48, 288);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(efxPaintAudioOwnership.isSuppressed()).toBe(false);
  });

  it('(e) toggle Off blocks the D-07 auto-resume (D-07 condition) and clears the stale note', async () => {
    const published: Array<string | null> = [];
    efxPaintAudioOwnership.configure({ statusPublisher: (note) => published.push(note) });
    efxPaintAudioOwnership.noteMainPlaybackState(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288); // suppressed, note published
    expect(published).toEqual(['Audio playing in main editor']);
    // The user mutes the session toggle while suppressed, then the main stops.
    audioPreviewEnabled.value = false;
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    // No auto-resume: zero engine dispatch, monitor stays silent.
    expect(mockedAudioEngine.ensureContext).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    expect(efxPaintAudioOwnership.isSuppressed()).toBe(false);
    // The note clears — the main editor is no longer playing, so "Audio
    // playing in main editor" would be a stale status.
    expect(published).toEqual(['Audio playing in main editor', null]);
  });
});

describe('Audio Preview toggle (41-04 Task 2: D-12..D-14, AUDIO-05 edges)', () => {
  function resetToggle() {
    efxPaintAudioMonitor.stop(); // stop funnel first — clears any silenced flag
    setAudioPreviewEnabled(true); // pure state reset; no resume dispatch
    efxPaintAudioOwnership.noteVisualStop();
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    efxPaintAudioOwnership.releaseAudio();
    efxPaintAudioOwnership.configure({ statusPublisher: null, claimSender: null, resumeHandler: resumeEfxPaintAudioAtLiveCursor });
  }

  beforeEach(() => {
    resetToggle();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  afterEach(() => {
    resetToggle();
  });

  it('(a) toggle Off mid-playback stops audio exactly once and touches nothing visual (D-14)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
    vi.clearAllMocks();
    setAudioPreviewEnabled(false);
    expect(audioPreviewEnabled.peek()).toBe(false);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    // Visual playback keeps ticking with audio muted — drift checks stay inert.
    efxPaintAudioMonitor.checkDrift(100, 288);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
  });

  it('(b) toggle On mid-playback resumes at the current Paint cursor without a visual restart (D-14)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    setAudioPreviewEnabled(false); // silenced mid-playback
    // Visual playback keeps ticking — the live cursor advances to 110.
    efxPaintAudioMonitor.checkDrift(110, 288);
    vi.clearAllMocks();
    setAudioPreviewEnabled(true);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      (24 + 12 + (110 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      // effectiveEnd = min(48 + (240 - 24), 288) = 264
      (264 - 110) / 24,
    );
    // The resume is a fresh dispatch from silence — no stopAll restart storm.
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('(c) setting the current value is a no-op — zero engine calls (AUDIO-05 idempotency edge)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    vi.clearAllMocks();
    setAudioPreviewEnabled(true); // already On
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    setAudioPreviewEnabled(false);
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    setAudioPreviewEnabled(false); // already Off — no doubled stopAll side effects
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
  });

  it('(d) a toggle racing a revisioned update serializes through the single funnel — Off ends silent, On ends positioned (AUDIO-05 concurrency edge)', async () => {
    stubFetchOk();
    await handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 1 }));
    efxPaintAudioMonitor.playAtCursor(96, 288);
    vi.clearAllMocks();
    // Off racing an in-flight revisioned update: the toggle stop lands inside
    // the update's prepare await, and the update's restart decision is taken
    // AFTER prepare — the funnel's final word is "silent".
    const firstApply = handleEfxPaintAudioContextEvent(makeAudioPreviewSection({
      revision: 2,
      tracks: [makeAudioPreviewTrack({ slipOffset: 0 })],
    }));
    setAudioPreviewEnabled(false);
    await firstApply;
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1); // exactly the toggle stop
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    // Visual playback keeps ticking while muted — the cursor advances to 120.
    efxPaintAudioMonitor.checkDrift(120, 288);
    vi.clearAllMocks();
    // On racing the next update: the resume dispatches at the live cursor and
    // the accepted update restarts at the same cursor with the newest context.
    const secondApply = handleEfxPaintAudioContextEvent(makeAudioPreviewSection({ revision: 3 }));
    setAudioPreviewEnabled(true);
    await secondApply;
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
    expect(mockedAudioEngine.play).toHaveBeenLastCalledWith(
      'track-1',
      (24 + 12 + (120 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      (264 - 120) / 24,
    );
  });

  it('(e) the session toggle defaults On and writes no storage (D-13 — never persisted)', () => {
    expect(audioPreviewEnabled.peek()).toBe(true);
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (storage) {
      const setItem = vi.spyOn(storage, 'setItem');
      try {
        setAudioPreviewEnabled(false);
        setAudioPreviewEnabled(true);
        expect(setItem).not.toHaveBeenCalled();
      } finally {
        setItem.mockRestore();
      }
    } else {
      // Node runtime has no Web Storage — toggling must still be safe.
      setAudioPreviewEnabled(false);
      setAudioPreviewEnabled(true);
    }
  });

  it('toggle On after a visual stop dispatches nothing — resume is mid-playback only (D-14)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    setAudioPreviewEnabled(false); // silenced mid-playback
    efxPaintAudioMonitor.stop();   // visual stop funnel clears the silenced flag
    vi.clearAllMocks();
    setAudioPreviewEnabled(true);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
  });

  it('a Play started while muted resumes on toggle On at the live cursor (D-14 muted-start path)', async () => {
    setAudioPreviewEnabled(false);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288); // muted start — zero dispatch
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    efxPaintAudioMonitor.checkDrift(104, 288); // visual ticks advance the cursor
    setAudioPreviewEnabled(true);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'track-1',
      (24 + 12 + (104 - 48)) / 24,
      expect.objectContaining({ id: 'track-1' }),
      24,
      (264 - 104) / 24,
    );
  });

  it('toggle Off while ownership-suppressed is a pure state change — the note lifecycle is unchanged', async () => {
    const published: Array<string | null> = [];
    efxPaintAudioOwnership.configure({ statusPublisher: (note) => published.push(note) });
    efxPaintAudioOwnership.noteMainPlaybackState(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288); // suppressed — note published
    expect(published).toEqual(['Audio playing in main editor']);
    setAudioPreviewEnabled(false);
    // No engine dispatch, no note clearing, suppression intact.
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(published).toEqual(['Audio playing in main editor']);
    expect(efxPaintAudioOwnership.isSuppressed()).toBe(true);
    // Main stops while muted: no resume (D-07 toggle condition), note clears.
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    expect(mockedAudioEngine.play).not.toHaveBeenCalled();
    expect(published).toEqual(['Audio playing in main editor', null]);
  });
});

describe('engine release on close (41-05 Task 1: D-08, AUDIO-06)', () => {
  // Release touches the same module-scope session state as the ownership and
  // toggle suites — reset all of it (plus the simulated engine context
  // lifecycle) around every test.
  function resetReleaseState() {
    efxPaintAudioMonitor.stop();
    efxPaintAudioOwnership.noteVisualStop();
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    efxPaintAudioOwnership.releaseAudio();
    efxPaintAudioOwnership.configure({ statusPublisher: null, claimSender: null, resumeHandler: resumeEfxPaintAudioAtLiveCursor });
    audioPreviewEnabled.value = true;
    engineContextState.exists = false;
  }

  beforeEach(() => {
    resetReleaseState();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
  });

  afterEach(() => {
    resetReleaseState();
  });

  it('(a) release after play dispatches stopAll, then closes the AudioContext (D-08)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(engineContextState.exists).toBe(true);
    vi.clearAllMocks();
    efxPaintAudioMonitor.release();
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.closeContext).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.stopAll.mock.invocationCallOrder[0])
      .toBeLessThan(mockedAudioEngine.closeContext.mock.invocationCallOrder[0]);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
    expect(engineContextState.exists).toBe(false);
  });

  it('(b) a second release is a no-op — one stopAll, at most one context close (idempotent)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    vi.clearAllMocks();
    efxPaintAudioMonitor.release();
    efxPaintAudioMonitor.release();
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.closeContext).toHaveBeenCalledTimes(1);
  });

  it('(c) release with a never-created context is a safe no-op', () => {
    expect(engineContextState.exists).toBe(false);
    efxPaintAudioMonitor.release();
    expect(mockedAudioEngine.stopAll).not.toHaveBeenCalled();
    expect(mockedAudioEngine.closeContext).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
  });

  it('(d) after release a subsequent playAtCursor creates a fresh context — a closed context is never reused (D-08)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    efxPaintAudioMonitor.release();
    expect(engineContextState.exists).toBe(false);
    vi.clearAllMocks();
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(mockedAudioEngine.ensureContext).toHaveBeenCalledTimes(1);
    expect(engineContextState.exists).toBe(true);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('release stops a delayed (future) source too — scheduled playDelayed sources never outlive the window (RESEARCH Pitfall 6)', async () => {
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(24, 288); // future track → playDelayed
    expect(mockedAudioEngine.playDelayed).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    efxPaintAudioMonitor.release();
    expect(mockedAudioEngine.stopAll).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.closeContext).toHaveBeenCalledTimes(1);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(false);
  });
});
