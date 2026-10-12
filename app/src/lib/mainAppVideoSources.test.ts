import {describe, it, expect, beforeEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {imageStore} from '../stores/imageStore';

// 261012-d6q: the never-copy video registration door does not exist yet at RED
// time. Dynamic import keeps each failure under its own test name instead of
// taking the file down as a collection failure (mainAppAudioSources.test.ts idiom).
async function loadVideoSources() {
  return await import('./mainAppVideoSources');
}

function readAppFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

// ---------------------------------------------------------------------------
// 261012-d6q: never-copy gallery import — the picker path is registered
// VERBATIM as a disk reference; mkdir/copyFile never run for video (VID-01).
// ---------------------------------------------------------------------------
describe('registerPickedVideoSource (261012-d6q never-copy gallery import)', () => {
  beforeEach(() => {
    imageStore.reset();
    vi.restoreAllMocks();
  });

  it('creates a videoAssets row with the picker path verbatim and basename as name', async () => {
    const mkdir = vi.fn();
    const copyFile = vi.fn();
    vi.doMock('@tauri-apps/plugin-fs', () => ({mkdir, copyFile, readFile: vi.fn()}));

    const {registerPickedVideoSource} = await loadVideoSources();
    const asset = registerPickedVideoSource('/Users/test/Movies/clip.mp4');

    expect(asset.path).toBe('/Users/test/Movies/clip.mp4');
    expect(asset.name).toBe('clip.mp4');
    expect(imageStore.videoAssets.value).toHaveLength(1);
    expect(imageStore.videoAssets.value[0].path).toBe('/Users/test/Movies/clip.mp4');
    expect(mkdir).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
    vi.doUnmock('@tauri-apps/plugin-fs');
  });

  it('registers nothing new for a second call with the same path', async () => {
    const {registerPickedVideoSource} = await loadVideoSources();
    const first = registerPickedVideoSource('/Users/test/Movies/clip.mp4');
    const second = registerPickedVideoSource('/Users/test/Movies/clip.mp4');

    expect(second.id).toBe(first.id);
    expect(imageStore.videoAssets.value).toHaveLength(1);
  });

  it('registers a second distinct path as a separate asset', async () => {
    const {registerPickedVideoSource} = await loadVideoSources();
    registerPickedVideoSource('/Users/test/Movies/clip-a.mp4');
    registerPickedVideoSource('/Users/test/Movies/clip-b.mp4');

    expect(imageStore.videoAssets.value).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 261012-d6q: the VID-01/VID-02 acceptance chain at unit level — a path OUTSIDE
// any project dir is registered verbatim, emitted verbatim by buildMceProject
// (zero fs writes), and restored verbatim by hydrateFromMce, with a layer that
// shares the id yielding EXACTLY ONE gallery row.
// ---------------------------------------------------------------------------
describe('video disk-reference chain (261012-d6q VID-01/VID-02)', () => {
  beforeEach(() => {
    imageStore.reset();
    vi.restoreAllMocks();
  });

  it('register -> build -> hydrate round-trips an outside-project path with zero fs writes and one shared-id row', async () => {
    const mkdir = vi.fn();
    const copyFile = vi.fn();
    vi.doMock('@tauri-apps/plugin-fs', () => ({mkdir, copyFile, readFile: vi.fn()}));

    const {registerPickedVideoSource} = await loadVideoSources();
    const {projectStore} = await import('../stores/projectStore');

    // VID-01: register a path OUTSIDE any project dir — pure registration.
    const asset = registerPickedVideoSource('/Users/test/Movies/clip.mp4');
    expect(imageStore.videoAssets.value).toHaveLength(1);

    // VID-02: the manifest member round-trips byte-for-byte.
    const project = projectStore.buildMceProject();
    const assets = (project as unknown as {video_assets?: Array<Record<string, unknown>>}).video_assets;
    expect(assets).toBeDefined();
    expect(assets![0].source_path).toBe('/Users/test/Movies/clip.mp4');
    const json = JSON.stringify(assets);
    expect(json).toContain('source_path');
    expect(json).not.toContain('relative_path');
    expect(mkdir).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();

    // Hydrate the same manifest plus a video layer referencing the emitted id:
    // the shared id must land as EXACTLY ONE gallery row.
    const hydrated = {
      ...project,
      sequences: [
        {
          id: 'seq-video',
          name: 'Video Seq',
          fps: 24,
          width: 1920,
          height: 1080,
          order: 0,
          key_photos: [],
          layers: [
            {
              id: 'l1',
              name: 'Clip',
              type: 'video',
              visible: true,
              opacity: 1,
              blend_mode: 'normal',
              transform: {
                x: 0, y: 0, scale_x: 1, scale_y: 1, rotation: 0,
                crop_top: 0, crop_right: 0, crop_bottom: 0, crop_left: 0,
              },
              source: {type: 'video', video_asset_id: asset.id, video_path: '/Users/test/Movies/clip.mp4'},
              is_base: false,
              order: 0,
              keyframes: [],
            },
          ],
        },
      ],
    };
    imageStore.reset();
    projectStore.hydrateFromMce(hydrated as never, '/test/project');

    expect(imageStore.videoAssets.value).toHaveLength(1);
    expect(imageStore.videoAssets.value[0].path).toBe('/Users/test/Movies/clip.mp4');
    expect(mkdir).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
    vi.doUnmock('@tauri-apps/plugin-fs');
  });
});

// ---------------------------------------------------------------------------
// 261012-d6q: source-scan pins over the copy site (ImportedView video branch).
// ---------------------------------------------------------------------------
describe('never-copy component doors (261012-d6q copy-site retirement)', () => {
  it('the video branch registers the picker path and holds no copy tokens', () => {
    const source = readAppFile('components/views/ImportedView.tsx');
    const importStart = source.indexOf('const handleImport = async ()');
    const importSource = source.slice(importStart, source.indexOf('handleSelect', importStart));
    const videoBranch = importSource.slice(
      importSource.indexOf("currentIntent?.type === 'video'"),
      importSource.indexOf('// Image import flow (existing behavior)'),
    );

    // Boolean pins keep the failure output small (a string diff dumps the branch).
    expect(videoBranch.includes('registerPickedVideoSource')).toBe(true);
    expect(videoBranch.includes('mkdir')).toBe(false);
    expect(videoBranch.includes('copyFile')).toBe(false);
    expect(videoBranch.includes('destPath')).toBe(false);
  });

  it('ImportedView.tsx no longer imports @tauri-apps/plugin-fs at all', () => {
    const source = readAppFile('components/views/ImportedView.tsx');
    expect(source.includes('@tauri-apps/plugin-fs')).toBe(false);
  });

  it('the audio and video intent markers stay findable for the existing audio-branch scan', () => {
    const source = readAppFile('components/views/ImportedView.tsx');
    expect(source.includes("currentIntent?.type === 'audio'")).toBe(true);
    expect(source.includes("currentIntent?.type === 'video'")).toBe(true);
  });
});
