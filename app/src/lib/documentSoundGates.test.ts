import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from './audioEngine';
import { efxPaintAudioMonitor, resumeEfxPaintAudioAtLiveCursor } from '../components/physic-paint/audio/efxPaintAudioMonitor';
import { audioPreviewEnabled, setAudioPreviewEnabled } from '../components/physic-paint/audio/efxPaintAudioPreviewStore';
import { EFX_PAINT_AUDIO_SUPPRESSED_NOTE, efxPaintAudioOwnership } from '../components/physic-paint/audio/efxPaintAudioOwnership';
import { parseEfxPaintAudioPreviewSection } from '../components/physic-paint/audio/efxPaintAudioPreviewContext';
import { createEfxPaintDocument, type DocumentSoundClip, type EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { registerDocument, removeDocument } from '../stores/efxPaintStore';
import { defaultTransform, type Layer, type LayerType } from '../types/layer';
import type { Sequence } from '../types/sequence';

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
  clips: [
    { clipId: 'sound-clip-1', assetUrl: 'efxasset://localhost/audio/sound.wav' },
  ],
} as const;

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

function registerSound(...clips: readonly DocumentSoundClip[]): void {
  const document = createEfxPaintDocument(LAYER_ID);
  registerDocument({ ...document, audios: clips });
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
    const track = toDocumentSoundAudioTrack(sound, CLIP_SECTION.clips[0].assetUrl, 24);
    expect(track).toMatchObject({
      id: 'sound-clip-1',
      audioAssetId: 'asset-1',
      offsetFrame: 48,
      inFrame: 0,
      outFrame: 240,
      slipOffset: 0,
      volume: 10 ** (-25 / 100), // 261010-bkv: gain -25 -> -5 dB -> 10^(-0.25)
      muted: false,
      fadeInFrames: 6,
      fadeOutFrames: 12,
      fadeInCurve: 'exponential',
      fadeOutCurve: 'linear',
    });
    expect(track.volume).toBeGreaterThanOrEqual(0);
    expect(track.volume).toBeLessThanOrEqual(10);
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
    expect(efxPaintDocumentAudioStore.accept({ revision: 1, clips: [{ clipId: 'clip-a', assetUrl: 'efxasset://localhost/audio/a.wav' }] })).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 1, clips: [{ clipId: 'clip-a' }] });
    expect(efxPaintDocumentAudioStore.accept({ revision: 3, clips: [{ clipId: 'clip-b', assetUrl: 'efxasset://localhost/audio/b.wav' }] })).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 3, clips: [{ clipId: 'clip-b' }] });
    // Equal revision: dropped (same-revision re-delivery is a defined no-op).
    expect(efxPaintDocumentAudioStore.accept({ revision: 3, clips: [{ clipId: 'clip-c', assetUrl: 'efxasset://localhost/audio/c.wav' }] })).toBe(false);
    // Older revision: dropped (stale never overwrites newer).
    expect(efxPaintDocumentAudioStore.accept({ revision: 2, clips: [{ clipId: 'clip-d', assetUrl: 'efxasset://localhost/audio/d.wav' }] })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 3, clips: [{ clipId: 'clip-b' }] });
    // Fail-closed: an unknown ad-hoc key never reaches the store.
    expect(efxPaintDocumentAudioStore.accept({ revision: 4, clips: [{ clipId: 'clip-e', assetUrl: 'efxasset://x' }], adHoc: true })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 3, clips: [{ clipId: 'clip-b' }] });
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
    expect(efxPaintDocumentAudioStore.accept({ revision: 5, clips: [{ clipId: 'clip-x', assetUrl: 'efxasset://localhost/audio/x.wav' }] })).toBe(true);
    expect(efxPaintDocumentAudioStore.accept(null)).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toBeNull();
    expect(efxPaintDocumentAudioStore.accept(null)).toBe(false); // idempotent clear
    // The applied revision survives the null-clear: a replayed stale section
    // can never resurrect a removed clip (strict newer-than, T-52.5-08).
    expect(efxPaintDocumentAudioStore.accept({ revision: 5, clips: [{ clipId: 'clip-x', assetUrl: 'efxasset://localhost/audio/x.wav' }] })).toBe(false);
    expect(efxPaintDocumentAudioStore.getSection()).toBeNull();
    // A genuinely newer section after the clear still applies.
    expect(efxPaintDocumentAudioStore.accept({ revision: 6, clips: [{ clipId: 'clip-y', assetUrl: 'efxasset://localhost/audio/y.wav' }] })).toBe(true);
    expect(efxPaintDocumentAudioStore.getSection()).toMatchObject({ revision: 6, clips: [{ clipId: 'clip-y' }] });
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

  it('dispatches the document clip after the main loop with gain scaled to linear (UAT round 4)', async () => {
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
        volume: 10 ** (-25 / 100),
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
      expect.objectContaining({ id: 'sound-clip-1', volume: 10 ** (-25 / 100) }),
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
      expect.objectContaining({ id: 'sound-clip-1', volume: 10 ** (-25 / 100) }),
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
      expect.objectContaining({ id: 'sound-clip-1', volume: 10 ** (-25 / 100) }),
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
      expect.objectContaining({ id: 'sound-clip-1', volume: 10 ** (-25 / 100) }),
      24,
      // Snippet window: cursor + EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES (4).
      (100 - 96) / 24,
    );
    expect(efxPaintAudioMonitor.isPlaying()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 52.5-02 Tasks 1-2 (D-11/D-12/D-13/D-14, MAIN-MIX-01/02, EXPORT-01, Q5/A1):
// main-editor mixed playback + export mixer inclusion.
//
// Model drift note: 52.5-02-PLAN.md predates UAT rounds 2-4 and speaks of
// `soundInOutput`, `previewMainApp` and `volume` (0-100). The SHIPPED model
// collapsed those into the clip's single `enabled` switch (ON = audible in
// Studio + main playback + export; OFF = silent everywhere) and `gain`
// (-100..+100, adapter maps (gain+100)/100 -> linear 0..2). The gates below
// implement the shipped contract: `enabled` is D-12's master switch, and the
// D-11 preview-mix toggle is structurally absent from every export input.
//
// Frame-space law: `sound.startFrame` is DOCUMENT-LOCAL (the Studio band's
// `appFrame` cells, bounded by `rotoParentEndExclusive`). A clip's global
// timeline start is `sequence.inFrame + sound.startFrame`, mirroring frameMap's
// `localFrame = globalFrame - seq.inFrame` and getTimelineOverlaySequenceOutFrame's
// `seq.inFrame + rotoEnd`.
// ---------------------------------------------------------------------------

function makeFxLayer(layerId: string, overrides: Partial<Layer> = {}): Layer {
  return {
    id: `layer-${layerId}`,
    name: 'Physics',
    type: 'physic-paint' as LayerType,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId },
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
    layers: [makeFxLayer('layer-1')],
    inFrame: 0,
    outFrame: 300,
    visible: true,
    ...overrides,
  };
}

function documentWithSound(sound: DocumentSoundClip | null, layerId = 'layer-1'): EfxPaintDocument {
  return { ...createEfxPaintDocument(layerId), audios: sound === null ? [] : [sound] };
}

function mapGetDocument(entries: ReadonlyMap<string, EfxPaintDocument>): (layerId: string) => EfxPaintDocument | null {
  return (layerId) => entries.get(layerId) ?? null;
}

describe('documentSoundGates — collectDocumentSoundClips (52.5-02, MAIN-MIX-01)', () => {
  it('(m1) collects one entry per sound-carrying physic-paint layer on an fx sequence, deduped by layer id', async () => {
    const { collectDocumentSoundClips } = await import('./documentSoundGates');
    const soundA = makeSound({ id: 'clip-a', sourceId: 'asset-a' });
    const soundB = makeSound({ id: 'clip-b', sourceId: 'asset-b' });
    const seq = makeFxSequence({
      layers: [makeFxLayer('layer-1'), makeFxLayer('layer-2'), makeFxLayer('layer-1')],
    });
    const documents = new Map<string, EfxPaintDocument>([
      ['layer-1', documentWithSound(soundA, 'layer-1')],
      ['layer-2', documentWithSound(soundB, 'layer-2')],
    ]);
    const entries = collectDocumentSoundClips([seq], mapGetDocument(documents));
    // Deduped by layer id: the repeated 'layer-1' contributes one entry.
    expect(entries.map((entry) => entry.layerId)).toEqual(['layer-1', 'layer-2']);
    expect(entries[0].sound).toBe(soundA);
    expect(entries[1].sound).toBe(soundB);
    // The entry carries the owning sequence so callers can resolve visibility
    // and the sequence's global inFrame offset.
    expect(entries[0].sequence).toBe(seq);
  });

  it('(m2) skips non-fx sequences and sound-less documents; a hidden fx sequence is still collected', async () => {
    const { collectDocumentSoundClips } = await import('./documentSoundGates');
    const sound = makeSound();
    // A physic-paint layer on a CONTENT sequence is not an overlay (frameMap.ts:60).
    const contentSeq = makeFxSequence({ id: 'seq-content', kind: 'content', layers: [makeFxLayer('layer-1')] });
    // A document whose sound is null contributes nothing.
    const emptySeq = makeFxSequence({ id: 'seq-empty', layers: [makeFxLayer('layer-2')] });
    // Visibility is the CALLER's gate (layerInComposite) — collect stays a pure
    // membership read, so a hidden fx sequence still yields its entry.
    const hiddenSeq = makeFxSequence({ id: 'seq-hidden', visible: false, layers: [makeFxLayer('layer-3')] });
    const documents = new Map<string, EfxPaintDocument>([
      ['layer-1', documentWithSound(sound, 'layer-1')],
      ['layer-2', documentWithSound(null, 'layer-2')],
      ['layer-3', documentWithSound(sound, 'layer-3')],
    ]);
    const entries = collectDocumentSoundClips([contentSeq, emptySeq, hiddenSeq], mapGetDocument(documents));
    expect(entries.map((entry) => entry.layerId)).toEqual(['layer-3']);
  });

  it('(m3) entries carry the document-local start rebased to the sequence global inFrame', async () => {
    const { collectDocumentSoundClips } = await import('./documentSoundGates');
    const sound = makeSound({ startFrame: 48 });
    const seq = makeFxSequence({ inFrame: 50, layers: [makeFxLayer('layer-1')] });
    const documents = new Map([['layer-1', documentWithSound(sound, 'layer-1')]]);
    const entries = collectDocumentSoundClips([seq], mapGetDocument(documents));
    expect(entries[0].timelineStartFrame).toBe(98); // 50 + 48
    // inFrame undefined is the [seq.inFrame ?? 0] law -> 0 + 48.
    const bare = makeFxSequence({ inFrame: undefined, layers: [makeFxLayer('layer-1')] });
    expect(collectDocumentSoundClips([bare], mapGetDocument(documents))[0].timelineStartFrame).toBe(48);
  });

  it('(m9) one layer carrying several clips yields one entry per clip (261008-ig1, D-01)', async () => {
    const { collectDocumentSoundClips } = await import('./documentSoundGates');
    const clipA = makeSound({ id: 'clip-a', sourceId: 'asset-shared' });
    const clipB = makeSound({ id: 'clip-b', sourceId: 'asset-shared', startFrame: 200 });
    const seq = makeFxSequence({ layers: [makeFxLayer('layer-1'), makeFxLayer('layer-1')] });
    const documents = new Map<string, EfxPaintDocument>([
      ['layer-1', { ...createEfxPaintDocument('layer-1'), audios: [clipA, clipB] }],
    ]);
    const entries = collectDocumentSoundClips([seq], mapGetDocument(documents));
    // Sequence-layer dedupe still holds; the layer's own clip list expands.
    expect(entries.map((entry) => entry.sound.id)).toEqual(['clip-a', 'clip-b']);
    expect(entries.every((entry) => entry.layerId === 'layer-1')).toBe(true);
    expect(entries[0].sequence).toBe(seq);
  });
});

describe('documentSoundGates — resolveDocumentSoundClip by id anywhere in the list (261008-ig1, D-01)', () => {
  it('(r1) resolves the clip whose id matches, whether it sits first or second in audios[]', async () => {
    const { resolveDocumentSoundClip } = await import('./documentSoundGates');
    const clipA = makeSound({ id: 'clip-a' });
    const clipB = makeSound({ id: 'clip-b' });
    const document: EfxPaintDocument = { ...createEfxPaintDocument(LAYER_ID), audios: [clipA, clipB] };

    expect(resolveDocumentSoundClip(document, { clipId: 'clip-b' })).toBe(clipB);
    expect(resolveDocumentSoundClip(document, { clipId: 'clip-a' })).toBe(clipA);
    // Fail-closed: a clipId naming no member resolves to null.
    expect(resolveDocumentSoundClip(document, { clipId: 'clip-zzz' })).toBeNull();
    expect(resolveDocumentSoundClip({ ...createEfxPaintDocument(LAYER_ID), audios: [] }, { clipId: 'clip-a' })).toBeNull();
    expect(resolveDocumentSoundClip(document, null)).toBeNull();
  });
});

describe('documentSoundGates — layerInComposite + mainPlaybackClipEnabled (D-12/D-13, Q5/A1)', () => {
  it('(m4) layerInComposite pins the A1 solo row: soloActive removes overlay sequences from the composite', async () => {
    const { layerInComposite } = await import('./documentSoundGates');
    expect(layerInComposite(true, false)).toBe(true);
    // A1 pin: renderGlobalFrame skips overlay sequences entirely when soloActive
    // (exportRenderer.ts:334-335) and physic-paint layers ride fx sequences.
    expect(layerInComposite(true, true)).toBe(false);
    expect(layerInComposite(false, false)).toBe(false);
    expect(layerInComposite(false, true)).toBe(false);
  });

  it('(m5) mainPlaybackClipEnabled = clip present AND enabled AND layer-in-composite', async () => {
    const { mainPlaybackClipEnabled } = await import('./documentSoundGates');
    // No clip at all -> never dispatches.
    expect(mainPlaybackClipEnabled(null, true, false)).toBe(false);
    // `enabled` is D-12's master switch (UAT round 2: OFF = silent everywhere).
    expect(mainPlaybackClipEnabled(makeSound({ enabled: true }), true, false)).toBe(true);
    expect(mainPlaybackClipEnabled(makeSound({ enabled: false }), true, false)).toBe(false);
    // D-13: hidden layer and solo both silence the clip.
    expect(mainPlaybackClipEnabled(makeSound({ enabled: true }), false, false)).toBe(false);
    expect(mainPlaybackClipEnabled(makeSound({ enabled: true }), true, true)).toBe(false);
    expect(mainPlaybackClipEnabled(makeSound({ enabled: true }), false, true)).toBe(false);
  });
});

describe('documentSoundGates — exportClipEnabled + buildExportMixEntries (52.5-02, EXPORT-01, D-11/D-12/D-14)', () => {
  it('(m6) exportClipEnabled reads the clip switch alone — preview state has no say (D-11)', async () => {
    const { exportClipEnabled } = await import('./documentSoundGates');
    expect(exportClipEnabled(null)).toBe(false);
    // D-12: the clip's `enabled` switch is the whole export decision. The D-11
    // preview-mix toggle is preview-only and is structurally absent from this
    // signature — there is no preview parameter to consult.
    expect(exportClipEnabled(makeSound({ enabled: true }))).toBe(true);
    expect(exportClipEnabled(makeSound({ enabled: false }))).toBe(false);
  });

  it('(m7) buildExportMixEntries refuses without includeAudio and passes tracks through without a clip', async () => {
    const { buildExportMixEntries } = await import('./documentSoundGates');
    const { toDocumentSoundAudioTrack } = await import('./documentSoundGates');
    const track = toDocumentSoundAudioTrack(makeSound(), CLIP_SECTION.clips[0].assetUrl, 24);
    const clip = {
      sound: makeSound({ enabled: true }),
      filePath: '/proj/audio/sound.wav',
      timelineStartFrame: 98,
    };
    // includeAudio false -> nothing mixes, even with tracks and clips.
    expect(buildExportMixEntries(false, [track], [clip], 24)).toEqual([]);
    // includeAudio true, tracks only -> the same track contents as input.
    expect(buildExportMixEntries(true, [track], [], 24)).toEqual([track]);
  });

  it('(m8) buildExportMixEntries appends one entry per enabled clip, keyed by sound.id with the rebased global start', async () => {
    const { buildExportMixEntries } = await import('./documentSoundGates');
    const clipA = {
      sound: makeSound({ id: 'clip-a', sourceId: 'asset-a', gain: -25, fadeInFrames: 6, fadeOutFrames: 12, enabled: true }),
      filePath: '/proj/audio/a.wav',
      timelineStartFrame: 98,
    };
    const clipB = {
      sound: makeSound({ id: 'clip-b', sourceId: 'asset-b', enabled: false }),
      filePath: '/proj/audio/b.wav',
      timelineStartFrame: 10,
    };
    const clipC = {
      sound: makeSound({ id: 'clip-c', sourceId: 'asset-c', enabled: true }),
      filePath: '/proj/audio/c.wav',
      timelineStartFrame: 200,
    };
    const entries = buildExportMixEntries(true, [], [clipA, clipB, clipC], 24);
    // Two layers carry a clip: two entries appended (the disabled one is out).
    expect(entries.map((entry) => entry.id)).toEqual(['clip-a', 'clip-c']);
    expect(entries[0]).toMatchObject({
      id: 'clip-a',
      volume: 10 ** (-25 / 100), // 261010-bkv: gain -25 -> -5 dB -> 10^(-0.25)
      fadeInFrames: 6,
      fadeOutFrames: 12,
      // The rebased GLOBAL start, never the document-local sound.startFrame.
      offsetFrame: 98,
      filePath: '/proj/audio/a.wav',
      muted: false,
      slipOffset: 0,
    });
    expect((entries[0] as unknown as Record<string, unknown>).relativePath).toBeUndefined();
  });
});
