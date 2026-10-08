import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {DocumentSoundClip} from '../efx-paint/document/efxPaintDocument';

const readFile = vi.fn();
const decode = vi.fn();
const computeWaveformPeaks = vi.fn();
const isSafeAudioRelativePath = vi.fn();

vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: (...args: unknown[]) => readFile(...args) }));
vi.mock('./audioEngine', () => ({ audioEngine: { decode: (...args: unknown[]) => decode(...args) } }));
vi.mock('./audioWaveform', () => ({ computeWaveformPeaks: (...args: unknown[]) => computeWaveformPeaks(...args) }));
vi.mock('./efxPaintPersistence', () => ({ isSafeAudioRelativePath: (...args: unknown[]) => isSafeAudioRelativePath(...args) }));

const SOUND: DocumentSoundClip = {
  id: 'clip-1',
  sourceId: 'src-1',
  relativePath: 'audio/foley.wav',
  sourceRevision: 0,
  startFrame: 0,
  inFrame: 0,
  outFrame: 48,
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
    isSafeAudioRelativePath.mockReturnValue(true);
    readFile.mockResolvedValue({ buffer: new ArrayBuffer(8) });
    decode.mockResolvedValue({ duration: 2 });
    computeWaveformPeaks.mockReturnValue({ tier1: new Float32Array(2), tier2: new Float32Array(2), tier3: new Float32Array(2) });
  });

  it('decodes once and caches peaks under sourceId with the source frame count', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await ensureDocumentSoundPeaks(SOUND, '/proj', 24);

    expect(decode).toHaveBeenCalledTimes(1);
    // Playback looks the buffer up by clip id; the preview peaks key on sourceId.
    expect(decode).toHaveBeenCalledWith('clip-1', expect.any(ArrayBuffer));
    expect(audioPeaksCache.get('src-1')).toBeTruthy();
    expect(audioPeaksCache.getSourceFrames('src-1')).toBe(48); // ceil(2s * 24fps)
  });

  it('is a no-op once the peaks are cached', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');

    await ensureDocumentSoundPeaks(SOUND, '/proj', 24);
    await ensureDocumentSoundPeaks(SOUND, '/proj', 24);

    expect(readFile).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('collapses concurrent calls for the same source into one decode', async () => {
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');

    await Promise.all([
      ensureDocumentSoundPeaks(SOUND, '/proj', 24),
      ensureDocumentSoundPeaks(SOUND, '/proj', 24),
    ]);

    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('refuses an unsafe relative path without reading or decoding', async () => {
    isSafeAudioRelativePath.mockReturnValue(false);
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await ensureDocumentSoundPeaks(SOUND, '/proj', 24);

    expect(readFile).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
    expect(audioPeaksCache.get('src-1')).toBeUndefined();
  });

  it('fails closed on a decode error and leaves the cache empty', async () => {
    decode.mockRejectedValue(new Error('bad bytes'));
    const { ensureDocumentSoundPeaks } = await import('./documentSoundPeaks');
    const { audioPeaksCache } = await import('./audioPeaksCache');

    await expect(ensureDocumentSoundPeaks(SOUND, '/proj', 24)).resolves.toBeUndefined();

    expect(audioPeaksCache.get('src-1')).toBeUndefined();
  });
});
