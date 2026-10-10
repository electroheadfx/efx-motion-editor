import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {DocumentSoundClip} from '../efx-paint/document/efxPaintDocument';

const fetchMock = vi.fn();
const decode = vi.fn();
const computeWaveformPeaks = vi.fn();
// Playback buffers are keyed by PLACED clip id (the dual-condition gate in
// ensureDocumentSoundPeaks reads audioEngine.getBuffer(sound.id)) — the mock
// keeps a realistic id -> buffer store so the buffer half of the gate works.
const engineBuffers = new Map<string, { duration: number }>();

vi.stubGlobal('fetch', fetchMock);
vi.mock('./audioEngine', () => ({
  audioEngine: {
    decode: (...args: unknown[]) => decode(...args),
    getBuffer: (id: string) => engineBuffers.get(id),
  },
}));
vi.mock('./audioWaveform', () => ({ computeWaveformPeaks: (...args: unknown[]) => computeWaveformPeaks(...args) }));
vi.mock('./ipc', () => ({ assetUrl: (p: string) => `efxasset://localhost${p}` }));

const SOUND: DocumentSoundClip = {
  id: 'clip-1',
  sourceId: 'src-1',
  sourcePath: '/Users/test/Music/foley.wav',
  sourceRevision: 0,
  startFrame: 0,
  inFrame: 0,
  outFrame: 48,
  sourceFrames: 240,
  slipOffset: 0,
  gain: 0,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  fadeInCurve: 'linear',
  fadeOutCurve: 'linear',
  enabled: true,
};

describe('ensureDocumentSoundPeaks', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { audioPeaksCache } = await import('./audioPeaksCache');
    audioPeaksCache.clear();
    engineBuffers.clear();
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    decode.mockImplementation(async (id: string) => {
      const buffer = { duration: 2 };
      engineBuffers.set(id, buffer);
      return buffer;
    });
    computeWaveformPeaks.mockReturnValue({ tier1: new Float32Array(2), tier2: new Float32Array(2), tier3: new Float32Array(2) });
  });

  it('decodes once and caches peaks under sourceId with the source frame count', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await ensureDocumentSoundPeaks(SOUND, 24);

    expect(decode).toHaveBeenCalledTimes(1);
    // Playback looks the buffer up by clip id; the preview peaks key on sourceId.
    expect(decode).toHaveBeenCalledWith('clip-1', expect.any(ArrayBuffer));
    expect(audioPeaksCache.get('src-1')).toBeTruthy();
    expect(audioPeaksCache.getSourceFrames('src-1')).toBe(48); // ceil(2s * 24fps)
  });

  it('is a no-op once the peaks are cached', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');

    await ensureDocumentSoundPeaks(SOUND, 24);
    await ensureDocumentSoundPeaks(SOUND, 24);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('re-decodes when peaks exist but this clip has no playback buffer yet (dual-identity gate)', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await ensureDocumentSoundPeaks(SOUND, 24);
    expect(engineBuffers.has('clip-1')).toBe(true);
    expect(audioPeaksCache.get('src-1')).toBeTruthy();

    // Peaks (sourceId-keyed) survive a missing clip-id buffer (e.g. evicted) —
    // the gate must decode again so playback gets ITS buffer back, without
    // recomputing the shared peaks.
    engineBuffers.delete('clip-1');
    const peaksBefore = audioPeaksCache.get('src-1');
    await ensureDocumentSoundPeaks(SOUND, 24);

    expect(decode).toHaveBeenCalledTimes(2);
    expect(engineBuffers.has('clip-1')).toBe(true);
    expect(audioPeaksCache.get('src-1')).toBe(peaksBefore);
  });

  it('collapses concurrent calls for the same source into one decode', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');

    await Promise.all([
      ensureDocumentSoundPeaks(SOUND, 24),
      ensureDocumentSoundPeaks(SOUND, 24),
    ]);

    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the efxasset fetch is refused without decoding', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await ensureDocumentSoundPeaks(SOUND, 24);

    expect(decode).not.toHaveBeenCalled();
    expect(audioPeaksCache.get('src-1')).toBeUndefined();
  });

  it('fails closed on a decode error and leaves the cache empty', async () => {
    decode.mockRejectedValue(new Error('bad bytes'));
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await expect(ensureDocumentSoundPeaks(SOUND, 24)).resolves.toBeUndefined();

    expect(audioPeaksCache.get('src-1')).toBeUndefined();
  });
});
