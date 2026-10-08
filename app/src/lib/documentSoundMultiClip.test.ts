import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from './audioEngine';
import { efxPaintAudioMonitor, resumeEfxPaintAudioAtLiveCursor } from '../components/physic-paint/audio/efxPaintAudioMonitor';
import { audioPreviewEnabled } from '../components/physic-paint/audio/efxPaintAudioPreviewStore';
import { efxPaintAudioOwnership } from '../components/physic-paint/audio/efxPaintAudioOwnership';
import { createEfxPaintDocument, type DocumentSoundClip } from '../efx-paint/document/efxPaintDocument';
import { registerDocument, removeDocument } from '../stores/efxPaintStore';

// ---------------------------------------------------------------------------
// Debug dup-clip-plays-audios-0 (TDD RED): multi-clip documentAudio transport.
//
// Symptom: alt+drag-duplicated Document sound clips only play `audios[0]`, and
// play-loop goes silent after the first pass. Root cause: the `documentAudio`
// channel is the closed 3-member singleton {revision, clipId, assetUrl} fed
// from `audios[0]`, and the Studio clip leg is single-slot.
//
// These tests pin the D-01 follow-up contract:
//   - the transport carries EVERY placed clip, keyed by its own `id`
//     (never `sourceId` — duplicates share the source),
//   - the clip leg dispatches every prepared clip,
//   - loop restart re-arms every clip (no already-run-to-end drop).
// ---------------------------------------------------------------------------

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
    stop: vi.fn(),
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

const LAYER_ID = 'layer-1';
const SHARED_SOURCE_ID = 'asset-shared-1';

function makeClip(id: string, overrides: Partial<DocumentSoundClip> = {}): DocumentSoundClip {
  return {
    id,
    sourceId: SHARED_SOURCE_ID,
    relativePath: 'audio/sound.wav',
    sourceRevision: 1,
    startFrame: 48,
    inFrame: 0,
    outFrame: 240,
    gain: 0,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    enabled: true,
    ...overrides,
  };
}

function registerClips(...clips: readonly DocumentSoundClip[]): void {
  const document = createEfxPaintDocument(LAYER_ID);
  registerDocument({ ...document, audios: clips });
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

describe('documentAudio transport carries every placed clip (261008-ig1 D-01 follow-up)', () => {
  it('buildPhysicPaintDocumentAudioSection names BOTH clips of a duplicated source — not just audios[0]', async () => {
    const { buildPhysicPaintDocumentAudioSection } = await import('./physicPaintBridge');
    const { projectStore } = await import('../stores/projectStore');
    projectStore.dirPath.value = '/tmp/efx-multi-audio';

    const clipA = makeClip('clip-a');
    const clipB = makeClip('clip-b', { startFrame: 200 });
    registerClips(clipA, clipB);

    const section = buildPhysicPaintDocumentAudioSection(LAYER_ID);
    expect(section).not.toBeNull();
    if (!section) throw new Error('unreachable');

    // The section must name every placed clip by its OWN id (never sourceId).
    const clipIds = 'clips' in section && Array.isArray((section as { clips?: unknown }).clips)
      ? ((section as { clips: Array<{ clipId: string }> }).clips.map((entry) => entry.clipId))
      : [/* legacy singleton shape — must not survive this test */ (section as { clipId?: string }).clipId].filter(Boolean) as string[];

    expect(clipIds).toEqual(expect.arrayContaining(['clip-a', 'clip-b']));
    expect(clipIds).toHaveLength(2);
    // Per-clip id key, never the shared sourceId.
    expect(clipIds).not.toContain(SHARED_SOURCE_ID);

    projectStore.dirPath.value = null;
    removeDocument(LAYER_ID);
  });

  it('isPhysicPaintDocumentAudioSection accepts the multi-clip shape and rejects a sourceId key', async () => {
    const { isPhysicPaintDocumentAudioSection } = await import('../types/physicPaint');
    const multi = {
      revision: 1,
      clips: [
        { clipId: 'clip-a', assetUrl: 'efxasset://localhost/audio/a.wav' },
        { clipId: 'clip-b', assetUrl: 'efxasset://localhost/audio/a.wav' },
      ],
    };
    expect(isPhysicPaintDocumentAudioSection(multi)).toBe(true);

    const sourceKeyed = {
      revision: 1,
      clips: [
        { clipId: 'clip-a', sourceId: SHARED_SOURCE_ID, assetUrl: 'efxasset://localhost/audio/a.wav' },
      ],
    };
    expect(isPhysicPaintDocumentAudioSection(sourceKeyed)).toBe(false);
  });
});

describe('Studio clip leg dispatches every prepared clip (D-01 follow-up)', () => {
  it('playAtCursor dispatches BOTH placed clips of a duplicated source, each under its own sound.id', async () => {
    const { efxPaintDocumentAudioStore } = await import('../components/physic-paint/audio/efxPaintDocumentAudioStore');
    efxPaintDocumentAudioStore.reset();
    efxPaintDocumentAudioStore.setLaunchIdentity(LAYER_ID, 24);

    const clipA = makeClip('clip-a');
    const clipB = makeClip('clip-b', { startFrame: 200 });
    registerClips(clipA, clipB);

    const multiSection = {
      revision: 1,
      clips: [
        { clipId: 'clip-a', assetUrl: 'efxasset://localhost/audio/sound.wav' },
        { clipId: 'clip-b', assetUrl: 'efxasset://localhost/audio/sound.wav' },
      ],
    };
    expect(efxPaintDocumentAudioStore.accept(multiSection)).toBe(true);

    stubFetchOk();
    await efxPaintAudioMonitor.prepare(null);
    efxPaintAudioMonitor.playAtCursor(48, 288);

    const playedIds = mockedAudioEngine.play.mock.calls.map((call) => call[0])
      .concat(mockedAudioEngine.playDelayed.mock.calls.map((call) => call[0]));
    expect(playedIds).toEqual(expect.arrayContaining(['clip-a', 'clip-b']));
    // Both placed clips sound — not just the audios[0] singleton.
    expect(playedIds).toHaveLength(2);
  });

  it('notifyLoopWrap re-arms BOTH clips on loop restart (no already-run-to-end drop)', async () => {
    const { efxPaintDocumentAudioStore } = await import('../components/physic-paint/audio/efxPaintDocumentAudioStore');
    efxPaintDocumentAudioStore.reset();
    efxPaintDocumentAudioStore.setLaunchIdentity(LAYER_ID, 24);

    const clipA = makeClip('clip-a');
    const clipB = makeClip('clip-b', { startFrame: 200 });
    registerClips(clipA, clipB);

    expect(efxPaintDocumentAudioStore.accept({
      revision: 1,
      clips: [
        { clipId: 'clip-a', assetUrl: 'efxasset://localhost/audio/sound.wav' },
        { clipId: 'clip-b', assetUrl: 'efxasset://localhost/audio/sound.wav' },
      ],
    })).toBe(true);

    stubFetchOk();
    await efxPaintAudioMonitor.prepare(null);
    efxPaintAudioMonitor.playAtCursor(48, 288);

    // Simulate both sources having run to end, then loop wrap.
    mockedAudioEngine.play.mockClear();
    mockedAudioEngine.playDelayed.mockClear();
    mockedAudioEngine.stopAll.mockClear();
    efxPaintAudioMonitor.notifyLoopWrap(48, 288);

    expect(mockedAudioEngine.stopAll).toHaveBeenCalled();
    const loopIds = mockedAudioEngine.play.mock.calls.map((call) => call[0])
      .concat(mockedAudioEngine.playDelayed.mock.calls.map((call) => call[0]));
    // Loop restart must re-arm every clip — the second schedule must not be dropped.
    expect(loopIds).toEqual(expect.arrayContaining(['clip-a', 'clip-b']));
    expect(loopIds).toHaveLength(2);
  });
});
