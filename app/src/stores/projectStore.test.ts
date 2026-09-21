import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {projectStore} from './projectStore';
import {audioStore} from './audioStore';
import {sequenceStore} from './sequenceStore';
import {physicPaintStore} from './physicPaintStore';
import {imageStore} from './imageStore';
import {applyPhysicPaintImageImportRequest, createPhysicPaintImageImportStatePorts} from '../lib/physicPaintBridge';
import type {AudioTrack} from '../types/audio';
import type {RuntimeMceProject} from '../types/project';
import { testWebpBytes } from '../testUtils/testWebpBytes';

// 260918-ovi: spy on the projectCreate IPC wrapper so createProject threading
// is observable. Other ipc exports (assetUrl, configGet*, etc.) keep their real
// implementations so dependent stores load unchanged.
const mockProjectCreate = vi.hoisted(() => vi.fn());
// quick-260921-bjm: spy on the import IPC wrapper so the picker's import leg is
// observable through the REAL imageStore (the manifest's only source).
const mockImportImages = vi.hoisted(() => vi.fn());
vi.mock('../lib/ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/ipc')>();
  return {
    ...actual,
    projectCreate: mockProjectCreate,
    importImages: mockImportImages,
  };
});
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

/** Create a minimal AudioTrack for testing */
describe('EFX Paint package save transaction (52.2-07)', () => {
  it('routes Save and Save As through the package save with the project and the package path only', () => {
    const source = readFileSync(fileURLToPath(new URL('./projectStore.ts', import.meta.url)), 'utf8');
    const saveStart = source.indexOf('async saveProject(options?');
    const saveAsStart = source.indexOf('async saveProjectAs(newFilePath');
    const saveSource = source.slice(saveStart, saveAsStart);
    const saveAsSource = source.slice(saveAsStart, source.indexOf('/** Open a project', saveAsStart));

    // Both call sites hand the package root and the write set to the ONE
    // package funnel — the manifest is assembled inside it (D-09).
    expect(saveSource).toContain('await savePackageWithTelemetry(projectDir, documents, branch);');
    expect(saveAsSource).toContain("const manifest = await savePackageWithTelemetry(parentDir, documents, 'manual');");

    // The funnel passes the project and the package path to the package save,
    // plus the package identity and the machine-local cache root. The cache
    // transaction id plan 05 Task 3 left dead is gone from every call site —
    // never forwarded, never a placeholder argument (T-52.2-21).
    const helperStart = source.indexOf('async function savePackageWithTelemetry(');
    const helperSource = source.slice(helperStart, source.indexOf('function buildMceProject', helperStart));
    expect(helperSource).toContain('await savePackage(packageDir, {');
    expect(helperSource).toContain('project: buildMceProject(),');
    expect(helperSource).toContain('documents,');
    expect(helperSource).toContain('projectId: projectId.value,');
    expect(helperSource).not.toContain('cacheTransactionId');
    expect(source).not.toContain('cacheTransactionId');
    // One save path only: no legacy physic-paint persistence remains in projectStore.
    expect(source).not.toContain('savePhysicPaintDataWithProjectWrite');
    expect(source).not.toContain('physic_paint_' + 'outputs' + ': await savePhysicPaintData(');
  });
});

function makeTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'track-1',
    audioAssetId: 'audio-asset-1',
    name: 'test-audio.wav',
    filePath: '/project/audio/test-audio.wav',
    relativePath: 'audio/test-audio.wav',
    originalFilename: 'test-audio.wav',
    offsetFrame: 10,
    inFrame: 0,
    outFrame: 100,
    volume: 0.8,
    muted: false,
    fadeInFrames: 5,
    fadeOutFrames: 10,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'linear',
    sampleRate: 44100,
    duration: 4.2,
    channelCount: 2,
    order: 0,
    trackHeight: 44,
    slipOffset: 3,
    totalFramesInFile: 100,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
    ...overrides,
  };
}

describe('projectStore audio persistence', () => {
  beforeEach(() => {
    audioStore.reset();
    sequenceStore.reset();
    physicPaintStore.reset();
  });

  describe('AUDIO-07: buildMceProject', () => {
    it('includes audio_tracks array in output', () => {
      audioStore.tracks.value = [makeTrack()];
      const project = projectStore.buildMceProject();
      expect(project.audio_tracks).toBeDefined();
      expect(project.audio_tracks!).toHaveLength(1);
    });

    it('maps AudioTrack fields to MceAudioTrack snake_case', () => {
      audioStore.tracks.value = [makeTrack()];
      const project = projectStore.buildMceProject();
      const mat = project.audio_tracks![0];

      expect(mat.id).toBe('track-1');
      expect(mat.name).toBe('test-audio.wav');
      expect(mat.relative_path).toBe('audio/test-audio.wav');
      expect(mat.original_filename).toBe('test-audio.wav');
      expect(mat.offset_frame).toBe(10);
      expect(mat.in_frame).toBe(0);
      expect(mat.out_frame).toBe(100);
      expect(mat.volume).toBe(0.8);
      expect(mat.muted).toBe(false);
      expect(mat.fade_in_frames).toBe(5);
      expect(mat.fade_out_frames).toBe(10);
      expect(mat.fade_in_curve).toBe('exponential');
      expect(mat.fade_out_curve).toBe('linear');
      expect(mat.sample_rate).toBe(44100);
      expect(mat.duration).toBe(4.2);
      expect(mat.channel_count).toBe(2);
      expect(mat.order).toBe(0);
      expect(mat.track_height).toBe(44);
      expect(mat.slip_offset).toBe(3);
    });

    it('sets version to 16', () => {
      const project = projectStore.buildMceProject();
      expect(project.version).toBe(16);
    });

    it('outputs empty audio_tracks when none exist', () => {
      const project = projectStore.buildMceProject();
      expect(project.audio_tracks).toEqual([]);
    });

    it('never emits the legacy outputs carrier (v1.0 one save path)', () => {
      sequenceStore.add({
        id: 'seq-1',
        kind: 'fx',
        name: 'Physics Paint',
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: [],
        layers: [{
          id: 'active-layer',
          name: 'Active Physics',
          type: 'physic-paint',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
          source: { type: 'physic-paint', layerId: 'active-cache' },
        }],
        inFrame: 0,
        outFrame: 24,
      });
      physicPaintStore.setFrame('active-cache', TEST_TRACK_ID, 1, {
        frameIndex: 0,
        appFrame: 1,
        bytes: testWebpBytes('AQID'),
        width: 100,
        height: 50,
      });
      physicPaintStore.setFrame('deleted-cache', TEST_TRACK_ID, 1, {
        frameIndex: 0,
        appFrame: 1,
        bytes: testWebpBytes('BAUG'),
        width: 100,
        height: 50,
      });

      const project = projectStore.buildMceProject();
      expect(('physic_paint_' + 'outputs') in project).toBe(false);
    });
  });

  describe('AUDIO-07: hydrateFromMce', () => {
    function makeMinimalMceProject(overrides: Partial<RuntimeMceProject> = {}): RuntimeMceProject {
      return {
        version: 8,
        name: 'Test Project',
        fps: 24,
        width: 1920,
        height: 1080,
        created_at: '2026-01-01',
        modified_at: '2026-01-01',
        sequences: [],
        images: [],
        ...overrides,
      };
    }

    it('restores audio tracks from project.audio_tracks', () => {
      const project = makeMinimalMceProject({
        audio_tracks: [{
          id: 'a1',
          name: 'music.mp3',
          relative_path: 'audio/music.mp3',
          original_filename: 'music.mp3',
          offset_frame: 5,
          in_frame: 0,
          out_frame: 200,
          volume: 0.7,
          muted: true,
          fade_in_frames: 10,
          fade_out_frames: 20,
          fade_in_curve: 'logarithmic',
          fade_out_curve: 'exponential',
          sample_rate: 48000,
          duration: 8.3,
          channel_count: 1,
          order: 0,
          track_height: 60,
          slip_offset: -2,
          total_frames_in_file: 200,
        }],
      });

      projectStore.hydrateFromMce(project, '/test/project');

      const tracks = audioStore.tracks.value;
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('a1');
      expect(tracks[0].name).toBe('music.mp3');
      expect(tracks[0].filePath).toBe('/test/project/audio/music.mp3');
      expect(tracks[0].relativePath).toBe('audio/music.mp3');
      expect(tracks[0].volume).toBe(0.7);
      expect(tracks[0].muted).toBe(true);
      expect(tracks[0].fadeInCurve).toBe('logarithmic');
      expect(tracks[0].trackHeight).toBe(60);
      expect(tracks[0].slipOffset).toBe(-2);
    });

    it('handles v7 projects with no audio_tracks (defaults to empty)', () => {
      const project = makeMinimalMceProject({version: 7});
      // Explicitly remove audio_tracks to simulate v7
      delete (project as unknown as Record<string, unknown>).audio_tracks;

      projectStore.hydrateFromMce(project, '/test/project');

      expect(audioStore.tracks.value).toHaveLength(0);
    });

    it('sorts tracks by order field', () => {
      const project = makeMinimalMceProject({
        audio_tracks: [
          {
            id: 'b', name: 'second.wav', relative_path: 'audio/second.wav',
            original_filename: 'second.wav', offset_frame: 0, in_frame: 0,
            out_frame: 50, volume: 1, muted: false, fade_in_frames: 0,
            fade_out_frames: 0, fade_in_curve: 'exponential',
            fade_out_curve: 'exponential', sample_rate: 44100, duration: 2,
            channel_count: 2, order: 1, track_height: 44, slip_offset: 0, total_frames_in_file: 50,
          },
          {
            id: 'a', name: 'first.wav', relative_path: 'audio/first.wav',
            original_filename: 'first.wav', offset_frame: 0, in_frame: 0,
            out_frame: 50, volume: 1, muted: false, fade_in_frames: 0,
            fade_out_frames: 0, fade_in_curve: 'exponential',
            fade_out_curve: 'exponential', sample_rate: 44100, duration: 2,
            channel_count: 2, order: 0, track_height: 44, slip_offset: 0, total_frames_in_file: 50,
          },
        ],
      });

      projectStore.hydrateFromMce(project, '/test/project');

      const tracks = audioStore.tracks.value;
      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe('a');  // order 0 first
      expect(tracks[1].id).toBe('b');  // order 1 second
    });
  });
});

describe('GL transition persistence (GLT-08)', () => {
  describe('serialization (save)', () => {
    it.todo('serializes glTransition as gl_transition with snake_case fields');
    it.todo('serializes shaderId as shader_id');
    it.todo('serializes params HashMap');
    it.todo('omits gl_transition when sequence has none');
  });

  describe('deserialization (load)', () => {
    it.todo('deserializes gl_transition back to glTransition with camelCase fields');
    it.todo('maps shader_id back to shaderId');
    it.todo('defaults missing curve to ease-in-out');
    it.todo('handles v10 files without gl_transition field (backward compat)');
  });

  describe('version', () => {
    it.todo('saves with version 11');
  });
});

describe('260918-ovi: canvas format threading', () => {
  beforeEach(() => {
    mockProjectCreate.mockReset();
    projectStore.width.value = 1920;
    projectStore.height.value = 1080;
  });

  describe('manifest round-trip (law pins)', () => {
    function makeMinimalMceProject(overrides: Partial<RuntimeMceProject> = {}): RuntimeMceProject {
      return {
        version: 8,
        name: 'Test Project',
        fps: 24,
        width: 1920,
        height: 1080,
        created_at: '2026-01-01',
        modified_at: '2026-01-01',
        sequences: [],
        images: [],
        ...overrides,
      };
    }

    it('buildMceProject round-trips non-default dims', () => {
      projectStore.width.value = 1080;
      projectStore.height.value = 1920;
      const project = projectStore.buildMceProject();
      expect(project.width).toBe(1080);
      expect(project.height).toBe(1920);
    });

    it('hydrateFromMce restores vertical dims', () => {
      const project = makeMinimalMceProject({ width: 1080, height: 1920 });
      projectStore.hydrateFromMce(project, '/test/project');
      expect(projectStore.width.value).toBe(1080);
      expect(projectStore.height.value).toBe(1920);
    });
  });

  describe('createProject threading (260918-ovi)', () => {
    it('createProject threads width/height through IPC and adopts returned dims', async () => {
      mockProjectCreate.mockResolvedValue({
        ok: true,
        data: { width: 1080, height: 1920 },
      });
      await projectStore.createProject('Fresh', 24, '/projects/Fresh.mce', 1080, 1920);
      expect(mockProjectCreate).toHaveBeenCalledWith('Fresh', 24, '/projects/Fresh.mce', 1080, 1920);
      expect(projectStore.width.value).toBe(1080);
      expect(projectStore.height.value).toBe(1920);
    });
  });
});

/**
 * quick-260921-bjm (verdict (b)): the manifest is the ONLY place a picker
 * import becomes durable. `buildMceProject()` reads `imageStore.toMceImages()`
 * (the record the 52.2 package writes) and the reopen path reads
 * `imageStore.loadFromMceImages(project.images, projectRoot)`. This locks the
 * record through that round-trip — the "close Studio, quit, relaunch" half of
 * the reported loss.
 */
describe('quick-260921-bjm: an imported image survives the manifest round-trip', () => {
  const PROJECT_DIR = '/projects/persisted-import';
  const importedImage = {
    id: 'asset-persisted',
    original_path: 'shot_1.png',
    project_path: `${PROJECT_DIR}/images/shot_1_ab12cd34.png`,
    thumbnail_path: `${PROJECT_DIR}/images/.thumbs/shot_1_ab12cd34.png`,
    width: 640,
    height: 480,
    format: 'png',
  };
  const importedRef = {
    id: 'asset-persisted',
    original_filename: 'shot_1.png',
    relative_path: 'images/shot_1_ab12cd34.png',
    thumbnail_relative_path: 'images/.thumbs/shot_1_ab12cd34.png',
    width: 640,
    height: 480,
    format: 'png',
  };

  /** Drive the ONE production import path: the main realm's own ports. */
  const runPickerImport = () => applyPhysicPaintImageImportRequest(
    { operationId: 'op-260921-bjm', paths: ['/Users/someone/Pictures/shot_1.png'] },
    createPhysicPaintImageImportStatePorts(),
  );

  beforeEach(() => {
    imageStore.reset();
    mockImportImages.mockReset();
    projectStore.dirPath.value = PROJECT_DIR;
  });

  it('MANIFEST LEG: the picker import lands in buildMceProject().images with PROJECT-RELATIVE paths', async () => {
    mockImportImages.mockResolvedValueOnce({ ok: true, data: { imported: [importedImage], errors: [] } });

    const result = await runPickerImport();

    expect(mockImportImages).toHaveBeenCalledWith(['/Users/someone/Pictures/shot_1.png'], PROJECT_DIR);
    expect(result.ok).toBe(true);
    expect(result.images).toEqual([importedRef]);
    // The record the package writes — relative paths, so the manifest stays
    // portable (52.2 reference-only format, unchanged by this fix).
    expect(projectStore.buildMceProject().images).toEqual([importedRef]);
  });

  it('REOPEN LEG: quit → relaunch reproduces the library from the manifest alone', async () => {
    mockImportImages.mockResolvedValueOnce({ ok: true, data: { imported: [importedImage], errors: [] } });
    await runPickerImport();
    const manifestImages = projectStore.buildMceProject().images;
    expect(manifestImages).toEqual([importedRef]);

    // Quit: the realm's library is gone. Relaunch: the manifest is the only
    // input (projectStore open → imageStore.loadFromMceImages).
    imageStore.reset();
    expect(imageStore.images.value).toEqual([]);
    imageStore.loadFromMceImages(manifestImages, PROJECT_DIR);

    // Same ids, same project-relative paths — the gallery is populated again.
    expect(imageStore.toMceImages(PROJECT_DIR)).toEqual([importedRef]);
    expect(imageStore.getById('asset-persisted')?.project_path).toBe(importedImage.project_path);
  });

  it('CONTROL: an import that could not be performed writes NO record — never a silent no-op dressed as success', async () => {
    mockImportImages.mockResolvedValueOnce({ ok: false, error: 'No space left on device' });

    const result = await runPickerImport();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Image import failed');
    expect(projectStore.buildMceProject().images).toEqual([]);
  });
});
