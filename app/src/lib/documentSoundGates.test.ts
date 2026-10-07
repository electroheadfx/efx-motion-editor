import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from './audioEngine';
import { efxPaintAudioMonitor, resumeEfxPaintAudioAtLiveCursor } from '../components/physic-paint/audio/efxPaintAudioMonitor';
import { audioPreviewEnabled, setAudioPreviewEnabled } from '../components/physic-paint/audio/efxPaintAudioPreviewStore';
import { EFX_PAINT_AUDIO_SUPPRESSED_NOTE, efxPaintAudioOwnership } from '../components/physic-paint/audio/efxPaintAudioOwnership';
import { parseEfxPaintAudioPreviewSection } from '../components/physic-paint/audio/efxPaintAudioPreviewContext';
import { createEfxPaintDocument, type DocumentSoundClip } from '../efx-paint/document/efxPaintDocument';
import { registerDocument, removeDocument } from '../stores/efxPaintStore';

// ---------------------------------------------------------------------------
// 52.5-01a Task 3 (Q3, D-11/D-14, STUDIO-MIX-01): Studio clip playback.
//
// The three modules under test do not exist yet at RED time
// (app/src/lib/documentSoundGates.ts, the child documentAudio store), so
// every test body reaches them through a dynamic `await import()` — each test
// then fails under its OWN test name instead of taking the whole file down as
// a collection/load failure. The monitor exists; its clip leg does not.
// ---------------------------------------------------------------------------

// Controllable Web Audio clock + engine context lifecycle (baseline harness
// idiom from efxPaintAudioPreview.test.ts).
const { fakeAudioContext, engineContextState } = vi.hoisted(() => ({
  fakeAudioContext: { currentTime: 0 },
  engineContextState: { exists: false },
}));

vi.mock('./audioEngine', () => ({
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

const mockedAudioEngine = vi.mocked(audioEngine);

function stubFetchOk() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })));
}

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

function parseOrThrow(section: unknown) {
  const parsed = parseEfxPaintAudioPreviewSection(section);
  expect(parsed).not.toBeNull();
  if (!parsed) throw new Error('unreachable');
  return parsed;
}

const LAYER_ID = 'layer-1';
const CLIP_SECTION = {
  revision: 1,
  clipId: 'sound-clip-1',
  assetUrl: 'efxasset://localhost/audio/sound.wav',
} as const;

function makeSound(overrides: Partial<DocumentSoundClip> = {}): DocumentSoundClip {
  return {
    id: 'sound-clip-1',
    sourceId: 'asset-1',
    relativePath: 'audio/sound.wav',
    sourceRevision: 1,
    startFrame: 48,
    inFrame: 0,
    outFrame: 240,
    volume: 75,
    fadeInFrames: 6,
    fadeOutFrames: 12,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'linear',
    enabled: true,
    ...overrides,
  };
}

function registerSound(sound: DocumentSoundClip): void {
  const document = createEfxPaintDocument(LAYER_ID);
  registerDocument({ ...document, sound });
}

// ---------------------------------------------------------------------------
// Test 1 (gates): the pure gate table + the AudioTrack adapter (Q3).
// ---------------------------------------------------------------------------

describe('documentSoundGates — Studio mix gates (52.5-01a, Q3, STUDIO-MIX-01)', () => {
  it('studioMainLegEnabled is the session monitoring toggle alone (UAT round 2: the modal never touches main-app audio)', async () => {
    const { studioMainLegEnabled } = await import('./documentSoundGates');
    expect(studioMainLegEnabled(true)).toBe(true);
    expect(studioMainLegEnabled(false)).toBe(false);
  });

  it('the clip leg rides the clip `enabled` switch alone (UAT round 2)', async () => {
    const { studioClipLegEnabled } = await import('./documentSoundGates');
    expect(studioClipLegEnabled(true)).toBe(true);
    expect(studioClipLegEnabled(false)).toBe(false);
  });

  it('toDocumentSoundAudioTrack maps the document sound onto the AudioTrack contract (D-14 percent to linear)', async () => {
    const { toDocumentSoundAudioTrack } = await import('./documentSoundGates');
    const sound = makeSound();
    const track = toDocumentSoundAudioTrack(sound, CLIP_SECTION.assetUrl, 24);
    expect(track).toMatchObject({
      id: 'sound-clip-1',
      audioAssetId: 'asset-1',
      offsetFrame: 48,
      inFrame: 0,
      outFrame: 240,
      slipOffset: 0,
      volume: 0.75, // 75% -> 0.75 linear (D-14)
      muted: false,
      fadeInFrames: 6,
      fadeOutFrames: 12,
      fadeInCurve: 'exponential',
      fadeOutCurve: 'linear',
    });
    expect(track.volume).toBeGreaterThanOrEqual(0);
    expect(track.volume).toBeLessThanOrEqual(1);
  });

  it('resolveClipPlayback maps the sound clip onto the locked resolveTrackPlayback truth table', async () => {
    const { resolveClipPlayback } = await import('./documentSoundGates');
    const sound = makeSound({ startFrame: 48, inFrame: 24, outFrame: 240 });
    // Mirrors truth-table worked example 2 (offset + trim, slip 0):
    // cursor 96 inside [48, 48 + (240 - 24)) -> immediate, (24 + 48) / 24 = 3.0,
    // effectiveEnd = min(48 + 216, 288) = 264 -> maxPlaySec = (264 - 96) / 24 = 7.0.
    expect(resolveClipPlayback(sound, 96, 288, 24)).toEqual({
      kind: 'immediate',
      sourceOffsetSec: 3.0,
      maxPlaySec: 7.0,
    });
    // A cursor behind the clip window schedules it (delayed arm).
    expect(resolveClipPlayback(sound, 24, 288, 24)).toMatchObject({ kind: 'delayed' });
  });
});

// ---------------------------------------------------------------------------
// Test 2 (store): the child documentAudio funnel — strict newer-than revision
// guard + idempotent setter, mirroring handleEfxPaintAudioContextEvent
// (52.5-01a, Q1, T-52.5-08).
// ---------------------------------------------------------------------------

describe('efxPaintDocumentAudioStore — closed documentAudio funnel (52.5-01a, Q1, T-52.5-08)', () => {
  it('a newer documentAudio revision replaces the stored section while equal-or-older revisions are dropped', async () => {
    const { efxPaintDocumentAudioStore } = await import('../components/physic-paint/audio/efxPaintDocumentAudioStore');
    efxPaintDocumentAudioStore.reset();
    expect(efxPaintDocumentAudioStore.accept({ revision: 1, clipId: 'clip-a', assetUrl: 'efxasset://localhost/audio/a.wav' })).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 1, clipId: 'clip-a' });
    expect(efxPaintDocumentAudioStore.accept({ revision: 3, clipId: 'clip-b', assetUrl: 'efxasset://localhost/audio/b.wav' })).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 3, clipId: 'clip-b' });
    // Equal revision: dropped (same-revision re-delivery is a defined no-op).
    expect(efxPaintDocumentAudioStore.accept({ revision: 3, clipId: 'clip-c', assetUrl: 'efxasset://localhost/audio/c.wav' })).toBe(false);
    // Older revision: dropped (stale never overwrites newer).
    expect(efxPaintDocumentAudioStore.accept({ revision: 2, clipId: 'clip-d', assetUrl: 'efxasset://localhost/audio/d.wav' })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 3, clipId: 'clip-b' });
    // Fail-closed: an unknown ad-hoc key never reaches the store.
    expect(efxPaintDocumentAudioStore.accept({ revision: 4, clipId: 'clip-e', assetUrl: 'efxasset://x', adHoc: true })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 3, clipId: 'clip-b' });
  });

  it('re-setting the identical section is idempotent — zero signal churn', async () => {
    const { efxPaintDocumentAudioStore } = await import('../components/physic-paint/audio/efxPaintDocumentAudioStore');
    efxPaintDocumentAudioStore.reset();
    const payload = { ...CLIP_SECTION };
    expect(efxPaintDocumentAudioStore.accept(payload)).toBe(true);
    const before = efxPaintDocumentAudioStore.getSection();
    let notifications = 0;
    const unsubscribe = efxPaintDocumentAudioStore.section.subscribe(() => {
      notifications += 1;
    });
    // signal.subscribe runs once on attach (effect semantics) — reset so the
    // counter measures CHURN caused by accept, not the attach-fire.
    notifications = 0;
    expect(efxPaintDocumentAudioStore.accept({ ...payload })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toBe(before);
    expect(notifications).toBe(0);
    unsubscribe();
  });

  it('a null payload clears the section idempotently and a stale replay cannot resurrect it', async () => {
    const { efxPaintDocumentAudioStore } = await import('../components/physic-paint/audio/efxPaintDocumentAudioStore');
    efxPaintDocumentAudioStore.reset();
    expect(efxPaintDocumentAudioStore.accept({ revision: 5, clipId: 'clip-x', assetUrl: 'efxasset://localhost/audio/x.wav' })).toBe(true);
    expect(efxPaintDocumentAudioStore.accept(null)).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toBeNull();
    expect(efxPaintDocumentAudioStore.accept(null)).toBe(false); // idempotent clear
    // The applied revision survives the null-clear: a replayed stale section
    // can never resurrect a removed clip (strict newer-than, T-52.5-08).
    expect(efxPaintDocumentAudioStore.accept({ revision: 5, clipId: 'clip-x', assetUrl: 'efxasset://localhost/audio/x.wav' })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toBeNull();
    // A genuinely newer section after the clear still applies.
    expect(efxPaintDocumentAudioStore.accept({ revision: 6, clipId: 'clip-y', assetUrl: 'efxasset://localhost/audio/y.wav' })).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 6, clipId: 'clip-y' });
  });
});

// ---------------------------------------------------------------------------
// Test 3 (dispatch): the monitor's ungated clip leg. The clip rides INSIDE
// playAtCursor — after the main-track loop, outside the first-player-wins
// early-return (mix, don't contend), gated by NEITHER toggle (Q3).
// ---------------------------------------------------------------------------

describe('efxPaintAudioMonitor clip dispatch — ungated document clip leg (52.5-01a, Q3, STUDIO-MIX-01)', () => {
  async function freshClipStore() {
    const { efxPaintDocumentAudioStore } = await import('../components/physic-paint/audio/efxPaintDocumentAudioStore');
    efxPaintDocumentAudioStore.reset();
    efxPaintDocumentAudioStore.setLaunchIdentity(LAYER_ID, 24);
    return efxPaintDocumentAudioStore;
  }

  function resetSession() {
    efxPaintAudioMonitor.stop();
    efxPaintAudioOwnership.noteVisualStop();
    efxPaintAudioOwnership.noteMainPlaybackState(false);
    efxPaintAudioOwnership.releaseAudio();
    efxPaintAudioOwnership.configure({ statusPublisher: null, claimSender: null, resumeHandler: resumeEfxPaintAudioAtLiveCursor });
    audioPreviewEnabled.value = true;
  }

  beforeEach(() => {
    resetSession();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fakeAudioContext.currentTime = 0;
    engineContextState.exists = false;
  });

  afterEach(() => {
    resetSession();
    removeDocument(LAYER_ID);
    vi.unstubAllGlobals();
  });

  it('dispatches the document clip after the main loop with percent volume scaled to linear (D-14)', async () => {
    const store = await freshClipStore();
    registerSound(makeSound());
    expect(store.accept(CLIP_SECTION)).toBe(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    // Main loop dispatches first (worked example 3), clip dispatches after it.
    expect(mockedAudioEngine.play.mock.calls.map((call) => call[0])).toEqual(['track-1', 'sound-clip-1']);
    expect(mockedAudioEngine.play).toHaveBeenNthCalledWith(
      1,
      'track-1',
      3.5,
      expect.objectContaining({ id: 'track-1', volume: 0.8 }),
      24,
      7.0,
    );
    // Clip: window [48, 288), cursor 96 -> immediate, (0 + (96 - 48)) / 24 = 2.0,
    // effectiveEnd = min(48 + 240, 288) = 288 -> maxPlaySec = (288 - 96) / 24 = 8.0.
    expect(mockedAudioEngine.play).toHaveBeenNthCalledWith(
      2,
      'sound-clip-1',
      2.0,
      expect.objectContaining({
        id: 'sound-clip-1',
        volume: 0.75,
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
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('the session toggle Off silences the main loop while the clip still dispatches (Q3)', async () => {
    const store = await freshClipStore();
    registerSound(makeSound());
    expect(store.accept(CLIP_SECTION)).toBe(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    setAudioPreviewEnabled(false);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    // Main leg: zero dispatch under the muted session toggle.
    expect(mockedAudioEngine.play).not.toHaveBeenCalledWith('track-1', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    // Clip leg: ungated by the session toggle — still dispatches.
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'sound-clip-1',
      2.0,
      expect.objectContaining({ id: 'sound-clip-1', volume: 0.75 }),
      24,
      8.0,
    );
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('enabled false silences the clip while the main leg keeps playing (UAT round 2)', async () => {
    const store = await freshClipStore();
    registerSound(makeSound({ enabled: false }));
    expect(store.accept(CLIP_SECTION)).toBe(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    // Clip switch OFF: the clip is silent everywhere — main leg unaffected.
    expect(mockedAudioEngine.play).not.toHaveBeenCalledWith('sound-clip-1', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(mockedAudioEngine.play).toHaveBeenCalledWith('track-1', expect.anything(), expect.anything(), 24, expect.anything());
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('a failed first-player-wins claim suppresses main only — the clip still dispatches (mix, do not contend)', async () => {
    const store = await freshClipStore();
    registerSound(makeSound());
    expect(store.accept(CLIP_SECTION)).toBe(true);
    const published: Array<string | null> = [];
    const claims: boolean[] = [];
    efxPaintAudioOwnership.configure({
      statusPublisher: (note) => published.push(note),
      claimSender: (claim) => claims.push(claim),
    });
    efxPaintAudioOwnership.noteMainPlaybackState(true);
    stubFetchOk();
    const context = parseOrThrow(makeAudioPreviewSection({ revision: 1 }));
    await efxPaintAudioMonitor.prepare(context);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    // Main leg suppressed by the ownership guard, with the D-06 note.
    expect(mockedAudioEngine.play).not.toHaveBeenCalledWith('track-1', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(published).toEqual([EFX_PAINT_AUDIO_SUPPRESSED_NOTE]);
    // Clip leg mixes through: dispatched, and it never claims ownership.
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'sound-clip-1',
      2.0,
      expect.objectContaining({ id: 'sound-clip-1', volume: 0.75 }),
      24,
      8.0,
    );
    expect(claims).toEqual([]);
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('a clip-only session (zero main tracks) dispatches the clip through the widened prepare gate', async () => {
    const store = await freshClipStore();
    registerSound(makeSound());
    expect(store.accept(CLIP_SECTION)).toBe(true);
    stubFetchOk();
    // No audioPreview section exists for a zero-main-audio project: prepare
    // receives null (the widened gate) and still decodes the clip.
    await efxPaintAudioMonitor.prepare(null);
    efxPaintAudioMonitor.playAtCursor(96, 288);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'sound-clip-1',
      2.0,
      expect.objectContaining({ id: 'sound-clip-1', volume: 0.75 }),
      24, // fps comes from the launch identity seeded into the child store
      8.0,
    );
    expect(mockedAudioEngine.playDelayed).not.toHaveBeenCalled();
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });

  it('scrubAt in a clip-only session dispatches the clip — audible scrub matches Play (UAT regression)', async () => {
    const store = await freshClipStore();
    registerSound(makeSound());
    expect(store.accept(CLIP_SECTION)).toBe(true);
    stubFetchOk();
    await efxPaintAudioMonitor.prepare(null);
    // The scrub funnel used to require a main-audio `context`, which a
    // clip-only session never has — Play sounded the clip while scrub was
    // silent. The gate is now "anything dispatchable".
    efxPaintAudioMonitor.scrubAt(96);
    expect(mockedAudioEngine.play).toHaveBeenCalledTimes(1);
    expect(mockedAudioEngine.play).toHaveBeenCalledWith(
      'sound-clip-1',
      2.0,
      expect.objectContaining({ id: 'sound-clip-1', volume: 0.75 }),
      24,
      // Snippet window: cursor + EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES (4).
      (100 - 96) / 24,
    );
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });
});
