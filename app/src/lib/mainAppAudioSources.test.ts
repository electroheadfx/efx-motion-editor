import {describe, it, expect, beforeEach, vi} from 'vitest';

// 261009-rko Task 1: the efxasset decode door does not exist yet at RED time.
// Dynamic import keeps each failure under its own test name.
async function loadSources() {
  return await import('./mainAppAudioSources');
}

describe('readAudioSourceBytes (261009-rko efxasset decode door)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a disk-referenced path through fetch(assetUrl(...)) and returns the bytes', async () => {
    const bytes = new ArrayBuffer(16);
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => bytes,
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const {readAudioSourceBytes, assetUrl} = await loadSources();
    const sourcePath = '/Users/test/Music/take.wav';
    const result = await readAudioSourceBytes(sourcePath);

    expect(result).toBe(bytes);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toBe(assetUrl(sourcePath));
    expect(calledUrl).toContain('efxasset://');
  });

  it('throws when the efxasset response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0)})));
    const {readAudioSourceBytes} = await loadSources();
    await expect(readAudioSourceBytes('/Users/test/Music/missing.wav')).rejects.toThrow();
  });

  it('never calls plugin-fs readFile', async () => {
    const readFile = vi.fn();
    vi.doMock('@tauri-apps/plugin-fs', () => ({readFile, mkdir: vi.fn(), copyFile: vi.fn()}));
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(8)})));

    const {readAudioSourceBytes} = await loadSources();
    await readAudioSourceBytes('/Users/test/Music/take.wav');

    expect(readFile).not.toHaveBeenCalled();
    vi.doUnmock('@tauri-apps/plugin-fs');
  });
});
