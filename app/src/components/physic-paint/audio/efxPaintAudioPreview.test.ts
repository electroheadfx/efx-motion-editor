import { beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../../../lib/audioEngine';
import {
  applyRevisionedEfxPaintAudioPreview,
  parseEfxPaintAudioPreviewSection,
  resolveTrackPlayback,
} from './efxPaintAudioPreviewContext';
import { efxPaintAudioMonitor } from './efxPaintAudioMonitor';

vi.mock('../../../lib/audioEngine', () => ({
  audioEngine: {
    ensureContext: vi.fn(),
    decode: vi.fn(async () => ({})),
    getBuffer: vi.fn(),
    play: vi.fn(),
    playDelayed: vi.fn(),
    stopAll: vi.fn(),
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
      (288 - 120) / 24,
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
