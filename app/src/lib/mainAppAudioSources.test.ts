import {describe, it, expect, beforeEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {imageStore} from '../stores/imageStore';

// 261009-rko Task 1: the efxasset decode door does not exist yet at RED time.
// Dynamic import keeps each failure under its own test name.
async function loadSources() {
  return await import('./mainAppAudioSources');
}

function readAppFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
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
    const calledUrl = String((fetchSpy.mock.calls[0] as unknown as [unknown])[0]);
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

// ---------------------------------------------------------------------------
// 261009-rko Task 2: never-copy gallery import and sidebar Replace — the
// picker path is recorded verbatim; mkdir/copyFile never run for audio.
// ---------------------------------------------------------------------------
describe('registerPickedAudioSource (261009-rko never-copy gallery import)', () => {
  beforeEach(() => {
    imageStore.reset();
    vi.restoreAllMocks();
  });

  it('creates an imageStore.audioAsset with the picker path verbatim and basename as name', async () => {
    const mkdir = vi.fn();
    const copyFile = vi.fn();
    vi.doMock('@tauri-apps/plugin-fs', () => ({mkdir, copyFile, readFile: vi.fn()}));

    const {registerPickedAudioSource} = await loadSources();
    const asset = registerPickedAudioSource('/Users/test/Music/take.wav');

    expect(asset.path).toBe('/Users/test/Music/take.wav');
    expect(asset.name).toBe('take.wav');
    expect(imageStore.audioAssets.value).toHaveLength(1);
    expect(imageStore.audioAssets.value[0].path).toBe('/Users/test/Music/take.wav');
    expect(mkdir).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
    vi.doUnmock('@tauri-apps/plugin-fs');
  });

  it('registers nothing new for a second call with the same path', async () => {
    const {registerPickedAudioSource} = await loadSources();
    const first = registerPickedAudioSource('/Users/test/Music/take.wav');
    const second = registerPickedAudioSource('/Users/test/Music/take.wav');

    expect(second.id).toBe(first.id);
    expect(imageStore.audioAssets.value).toHaveLength(1);
  });

  it('registers a second distinct path as a separate asset', async () => {
    const {registerPickedAudioSource} = await loadSources();
    registerPickedAudioSource('/Users/test/Music/take-a.wav');
    registerPickedAudioSource('/Users/test/Music/take-b.wav');

    expect(imageStore.audioAssets.value).toHaveLength(2);
  });
});

describe('buildAudioReplacePatch (261009-rko sidebar Replace never-copy)', () => {
  it('returns a track patch whose filePath is the input path verbatim and originalFilename is its basename', async () => {
    const {buildAudioReplacePatch} = await loadSources();
    const decoded = {sampleRate: 48000, duration: 2.5, numberOfChannels: 2};
    const patch = buildAudioReplacePatch('/Users/test/Music/other.flac', decoded, 24);

    expect(patch.filePath).toBe('/Users/test/Music/other.flac');
    expect(patch.originalFilename).toBe('other.flac');
    expect(patch.sampleRate).toBe(48000);
    expect(patch.duration).toBe(2.5);
    expect(patch.channelCount).toBe(2);
    expect(patch.inFrame).toBe(0);
    expect(patch.outFrame).toBe(60);
    expect(patch).not.toHaveProperty('relativePath');
  });
});

describe('never-copy component doors (261009-rko copy-site retirement)', () => {
  it('gallery import registers the picker path and never copies into the package', () => {
    const source = readAppFile('components/views/ImportedView.tsx');
    const importStart = source.indexOf('const handleImport = async ()');
    const importSource = source.slice(importStart, source.indexOf('handleSelect', importStart));
    const audioBranch = importSource.slice(
      importSource.indexOf("currentIntent?.type === 'audio'"),
      importSource.indexOf("currentIntent?.type === 'video'"),
    );

    // Boolean pins keep TAP YAML small (a string diff dumps the whole handler).
    expect(audioBranch.includes('registerPickedAudioSource')).toBe(true);
    expect(audioBranch.includes('mkdir')).toBe(false);
    expect(audioBranch.includes('copyFile')).toBe(false);
    expect(audioBranch.includes('destPath')).toBe(false);
  });

  it('sidebar Replace rebuilds from the picker path and never copies into the package', () => {
    const source = readAppFile('components/sidebar/AudioProperties.tsx');
    const replaceStart = source.indexOf('const handleReplace = async ()');
    const replaceSource = source.slice(replaceStart, source.indexOf('const volumePercent', replaceStart));

    expect(replaceSource.includes('readAudioSourceBytes')).toBe(true);
    expect(replaceSource.includes('buildAudioReplacePatch')).toBe(true);
    expect(replaceSource.includes('mkdir')).toBe(false);
    expect(replaceSource.includes('copyFile')).toBe(false);
    expect(replaceSource.includes('plugin-fs')).toBe(false);
  });

  it('handleSelectAudio reads through readAudioSourceBytes, not plugin-fs readFile', () => {
    const source = readAppFile('components/views/ImportedView.tsx');
    const selectStart = source.indexOf('const handleSelectAudio');
    const selectSource = source.slice(selectStart, source.indexOf('// Import handler', selectStart));

    expect(selectSource.includes('readAudioSourceBytes')).toBe(true);
    expect(selectSource.includes('readFile(')).toBe(false);
  });
});
