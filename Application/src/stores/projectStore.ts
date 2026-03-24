import {signal, computed, batch} from '@preact/signals';
import type {ProjectData, MceProject, MceSequence, MceKeyPhoto, MceLayer} from '../types/project';
import type {MceAudioTrack} from '../types/audio';
import type {AudioTrack, FadeCurve} from '../types/audio';
import type {Sequence, KeyPhoto, TransitionType, FadeMode} from '../types/sequence';
import type {Layer, LayerType, BlendMode, LayerSourceData, EasingType} from '../types/layer';
import {createBaseLayer} from '../types/layer';
import {projectCreate, projectSave as ipcProjectSave, projectOpen as ipcProjectOpen, projectMigrateTempImages} from '../lib/ipc';
import {imageStore, _setImageMarkDirtyCallback} from './imageStore';
import {sequenceStore, _setMarkDirtyCallback} from './sequenceStore';
import {audioStore, _setAudioMarkDirtyCallback} from './audioStore';
import {uiStore} from './uiStore';
import {timelineStore} from './timelineStore';
import {layerStore} from './layerStore';
import {historyStore} from './historyStore';
import {playbackEngine} from '../lib/playbackEngine';
import {audioEngine} from '../lib/audioEngine';
import {computeWaveformPeaks} from '../lib/audioWaveform';
import {audioPeaksCache} from '../lib/audioPeaksCache';
import {startAutoSave, stopAutoSave} from '../lib/autoSave';
import {tempProjectDir} from '../lib/projectDir';
import {addRecentProject, setLastProjectPath} from '../lib/appConfig';
import {canvasStore} from './canvasStore';
import {paintStore} from './paintStore';
import {savePaintData, loadPaintData, cleanupOrphanedPaintFiles} from '../lib/paintPersistence';
import {readFile} from '@tauri-apps/plugin-fs';

// --- Signals ---

const name = signal('Untitled Project');
const fps = signal(24);
const width = signal(1920);
const height = signal(1080);

const aspectRatio = computed(() => width.value / height.value);

/** Absolute path to .mce file (null = never saved) */
const filePath = signal<string | null>(null);

/** Absolute path to project root directory */
const dirPath = signal<string | null>(null);

/** True when unsaved changes exist */
const isDirty = signal(false);

/** True during save operation (prevents concurrent saves) */
const isSaving = signal(false);

// --- Helpers ---

/** Build MceProject from current store state */
function buildMceProject(): MceProject {
  const projectRoot = dirPath.value ?? '';

  // Convert sequences to MceSequence format
  const mceSequences: MceSequence[] = sequenceStore.sequences.value.map(
    (seq: Sequence, index: number): MceSequence => ({
      id: seq.id,
      name: seq.name,
      fps: seq.fps,
      width: seq.width,
      height: seq.height,
      order: index,
      kind: seq.kind,
      ...(seq.inFrame != null ? { in_frame: seq.inFrame } : {}),
      ...(seq.outFrame != null ? { out_frame: seq.outFrame } : {}),
      ...(seq.fadeIn ? {
        fade_in: {
          type: seq.fadeIn.type,
          duration: seq.fadeIn.duration,
          mode: seq.fadeIn.mode,
          color: seq.fadeIn.color,
          curve: seq.fadeIn.curve,
        },
      } : {}),
      ...(seq.fadeOut ? {
        fade_out: {
          type: seq.fadeOut.type,
          duration: seq.fadeOut.duration,
          mode: seq.fadeOut.mode,
          color: seq.fadeOut.color,
          curve: seq.fadeOut.curve,
        },
      } : {}),
      ...(seq.crossDissolve ? {
        cross_dissolve: {
          type: seq.crossDissolve.type,
          duration: seq.crossDissolve.duration,
          mode: seq.crossDissolve.mode,
          color: seq.crossDissolve.color,
          curve: seq.crossDissolve.curve,
        },
      } : {}),
      ...(seq.glTransition ? {
        gl_transition: {
          shader_id: seq.glTransition.shaderId,
          params: seq.glTransition.params,
          duration: seq.glTransition.duration,
          curve: seq.glTransition.curve,
        },
      } : {}),
      key_photos: seq.keyPhotos.map(
        (kp: KeyPhoto, kpIndex: number): MceKeyPhoto => ({
          id: kp.id,
          image_id: kp.imageId,
          hold_frames: kp.holdFrames,
          order: kpIndex,
          ...(kp.solidColor ? { solid_color: kp.solidColor } : {}),
          ...(kp.isTransparent ? { is_transparent: true } : {}),
          ...(kp.gradient ? {
            gradient: {
              type: kp.gradient.type,
              stops: kp.gradient.stops.map(s => ({ color: s.color, position: s.position })),
              ...(kp.gradient.angle != null ? { angle: kp.gradient.angle } : {}),
              ...(kp.gradient.centerX != null ? { center_x: kp.gradient.centerX } : {}),
              ...(kp.gradient.centerY != null ? { center_y: kp.gradient.centerY } : {}),
            }
          } : {}),
        }),
      ),
      layers: seq.layers.map((layer, layerIndex): MceLayer => ({
        id: layer.id,
        name: layer.name,
        type: layer.type,
        visible: layer.visible,
        opacity: layer.opacity,
        blend_mode: layer.blendMode,
        transform: {
          x: layer.transform.x,
          y: layer.transform.y,
          scale_x: layer.transform.scaleX,
          scale_y: layer.transform.scaleY,
          rotation: layer.transform.rotation,
          crop_top: layer.transform.cropTop,
          crop_right: layer.transform.cropRight,
          crop_bottom: layer.transform.cropBottom,
          crop_left: layer.transform.cropLeft,
        },
        source: {
          type: layer.source.type,
          // Content layer fields (existing)
          ...(layer.source.type === 'static-image' ? {image_id: layer.source.imageId} : {}),
          ...(layer.source.type === 'image-sequence' ? {image_ids: layer.source.imageIds} : {}),
          ...(layer.source.type === 'video' ? (() => {
            const src = layer.source as {type: 'video'; videoAssetId: string};
            return {
              video_asset_id: src.videoAssetId,
              video_path: imageStore.videoAssets.peek().find(v => v.id === src.videoAssetId)?.path ?? '',
            };
          })() : {}),
          // Generator-grain
          ...(layer.source.type === 'generator-grain' ? {
            density: layer.source.density, size: layer.source.size,
            intensity: layer.source.intensity, lock_seed: layer.source.lockSeed,
            seed: layer.source.seed,
          } : {}),
          // Generator-particles
          ...(layer.source.type === 'generator-particles' ? {
            count: layer.source.count, speed: layer.source.speed,
            size_min: layer.source.sizeMin, size_max: layer.source.sizeMax,
            lock_seed: layer.source.lockSeed, seed: layer.source.seed,
          } : {}),
          // Generator-lines
          ...(layer.source.type === 'generator-lines' ? {
            count: layer.source.count, thickness: layer.source.thickness,
            length_min: layer.source.lengthMin, length_max: layer.source.lengthMax,
            lock_seed: layer.source.lockSeed, seed: layer.source.seed,
          } : {}),
          // Generator-dots
          ...(layer.source.type === 'generator-dots' ? {
            count: layer.source.count, size_min: layer.source.sizeMin,
            size_max: layer.source.sizeMax, speed: layer.source.speed,
            lock_seed: layer.source.lockSeed, seed: layer.source.seed,
          } : {}),
          // Generator-vignette
          ...(layer.source.type === 'generator-vignette' ? {
            size: layer.source.size, softness: layer.source.softness,
            intensity: layer.source.intensity,
          } : {}),
          // Adjustment-color-grade
          ...(layer.source.type === 'adjustment-color-grade' ? {
            brightness: layer.source.brightness, contrast: layer.source.contrast,
            saturation: layer.source.saturation, hue: layer.source.hue,
            fade: layer.source.fade, tint_color: layer.source.tintColor,
            preset: layer.source.preset, fade_blend: layer.source.fadeBlend,
          } : {}),
          // Adjustment-blur
          ...(layer.source.type === 'adjustment-blur' ? {
            radius: layer.source.radius,
          } : {}),
          // GLSL shaders (generator-glsl / adjustment-glsl)
          ...((layer.source.type === 'generator-glsl' || layer.source.type === 'adjustment-glsl') ? {
            shader_id: (layer.source as { shaderId: string }).shaderId,
            params: (layer.source as { params: Record<string, number> }).params,
          } : {}),
          // Paint layer
          ...(layer.source.type === 'paint' ? {
            layer_id: (layer.source as { layerId: string }).layerId,
          } : {}),
        },
        is_base: layer.isBase ?? false,
        order: layerIndex,
        ...(layer.blur != null && layer.blur > 0 ? { blur: layer.blur } : {}),
        ...(layer.keyframes && layer.keyframes.length > 0 ? {
          keyframes: layer.keyframes.map(kf => ({
            frame: kf.frame,
            easing: kf.easing,
            values: {
              opacity: kf.values.opacity,
              x: kf.values.x,
              y: kf.values.y,
              scale_x: kf.values.scaleX,
              scale_y: kf.values.scaleY,
              rotation: kf.values.rotation,
              blur: kf.values.blur,
              ...(kf.values.sourceOverrides ? { source_overrides: kf.values.sourceOverrides } : {}),
            },
          })),
        } : {}),
      })),
    }),
  );

  return {
    version: 14,
    name: name.value,
    fps: fps.value,
    width: width.value,
    height: height.value,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    sequences: mceSequences,
    images: imageStore.toMceImages(projectRoot),
    audio_tracks: audioStore.tracks.value.map((track, index): MceAudioTrack => ({
      id: track.id,
      audio_asset_id: track.audioAssetId,
      name: track.name,
      relative_path: track.relativePath,
      original_filename: track.originalFilename,
      offset_frame: track.offsetFrame,
      in_frame: track.inFrame,
      out_frame: track.outFrame,
      volume: track.volume,
      muted: track.muted,
      fade_in_frames: track.fadeInFrames,
      fade_out_frames: track.fadeOutFrames,
      fade_in_curve: track.fadeInCurve,
      fade_out_curve: track.fadeOutCurve,
      sample_rate: track.sampleRate,
      duration: track.duration,
      channel_count: track.channelCount,
      order: index,
      track_height: track.trackHeight,
      slip_offset: track.slipOffset,
      total_frames_in_file: track.totalFramesInFile,
      ...(track.bpm != null ? { bpm: track.bpm } : {}),
      ...(track.beatOffsetFrames ? { beat_offset_frames: track.beatOffsetFrames } : {}),
      ...(track.beatMarkers.length > 0 ? { beat_markers: track.beatMarkers } : {}),
      ...(track.showBeatMarkers ? { show_beat_markers: track.showBeatMarkers } : {}),
    })),
  };
}

/** Load MceProject data into all stores */
function hydrateFromMce(project: MceProject, projectRoot: string) {
  batch(() => {
    // 1. Set projectStore signals
    name.value = project.name;
    fps.value = project.fps;
    width.value = project.width;
    height.value = project.height;

    // 2. Load images (converts relative to absolute)
    imageStore.loadFromMceImages(project.images, projectRoot);

    // 3. Convert MceSequences to frontend Sequence type and load into sequenceStore
    sequenceStore.reset();
    const videoAssetIdToPath = new Map<string, string>(); // Built during layer deserialization for video asset registration
    const sortedSeqs = [...project.sequences].sort((a, b) => a.order - b.order);
    for (const mceSeq of sortedSeqs) {
      const sortedKps = [...mceSeq.key_photos].sort((a, b) => a.order - b.order);

      // Deserialize layers; auto-generate base layer for v1 files without layers
      const layers: Layer[] =
        mceSeq.layers && mceSeq.layers.length > 0
          ? mceSeq.layers
              .sort((a, b) => a.order - b.order)
              .map(
                (ml): Layer => ({
                  id: ml.id,
                  name: ml.name,
                  type: ml.type as LayerType,
                  visible: ml.visible,
                  opacity: ml.opacity,
                  blendMode: ml.blend_mode as BlendMode,
                  transform: {
                    x: ml.transform.x,
                    y: ml.transform.y,
                    scaleX: ml.transform.scale_x ?? ml.transform.scale ?? 1,
                    scaleY: ml.transform.scale_y ?? ml.transform.scale ?? 1,
                    rotation: ml.transform.rotation,
                    cropTop: ml.transform.crop_top,
                    cropRight: ml.transform.crop_right,
                    cropBottom: ml.transform.crop_bottom,
                    cropLeft: ml.transform.crop_left,
                  },
                  source: (() => {
                    const t = ml.source.type;
                    if (t === 'static-image') return {type: t, imageId: ml.source.image_id!} as LayerSourceData;
                    if (t === 'image-sequence') return {type: t, imageIds: ml.source.image_ids ?? []} as LayerSourceData;
                    if (t === 'video') {
                      const videoAssetId = ml.source.video_asset_id ?? crypto.randomUUID();
                      const videoPath = ml.source.video_path ?? '';
                      const absVideoPath = videoPath && !videoPath.startsWith('/') ? projectRoot + '/' + videoPath : videoPath;
                      videoAssetIdToPath.set(videoAssetId, absVideoPath);
                      return {type: t, videoAssetId} as LayerSourceData;
                    }
                    if (t === 'generator-grain') return {type: t, density: ml.source.density ?? 0.3, size: ml.source.size ?? 1, intensity: ml.source.intensity ?? 0.5, lockSeed: ml.source.lock_seed ?? true, seed: ml.source.seed ?? 42} as LayerSourceData;
                    if (t === 'generator-particles') return {type: t, count: ml.source.count ?? 50, speed: ml.source.speed ?? 1, sizeMin: ml.source.size_min ?? 1, sizeMax: ml.source.size_max ?? 4, lockSeed: ml.source.lock_seed ?? true, seed: ml.source.seed ?? 42} as LayerSourceData;
                    if (t === 'generator-lines') return {type: t, count: ml.source.count ?? 15, thickness: ml.source.thickness ?? 1, lengthMin: ml.source.length_min ?? 0.1, lengthMax: ml.source.length_max ?? 0.4, lockSeed: ml.source.lock_seed ?? true, seed: ml.source.seed ?? 42} as LayerSourceData;
                    if (t === 'generator-dots') return {type: t, count: ml.source.count ?? 30, sizeMin: ml.source.size_min ?? 2, sizeMax: ml.source.size_max ?? 8, speed: ml.source.speed ?? 0.5, lockSeed: ml.source.lock_seed ?? true, seed: ml.source.seed ?? 42} as LayerSourceData;
                    if (t === 'generator-vignette') return {type: t, size: ml.source.size ?? 0.6, softness: ml.source.softness ?? 0.5, intensity: ml.source.intensity ?? 0.7} as LayerSourceData;
                    if (t === 'adjustment-color-grade') return {type: t, brightness: ml.source.brightness ?? 0, contrast: ml.source.contrast ?? 0, saturation: ml.source.saturation ?? 0, hue: ml.source.hue ?? 0, fade: ml.source.fade ?? 0, tintColor: ml.source.tint_color ?? '#D4A574', preset: ml.source.preset ?? 'none', fadeBlend: ml.source.fade_blend} as LayerSourceData;
                    if (t === 'adjustment-blur') return {type: t, radius: ml.source.radius ?? 0.3} as LayerSourceData;
                    if (t === 'generator-glsl' || t === 'adjustment-glsl') return {type: t, shaderId: ml.source.shader_id ?? '', params: ml.source.params ?? {}} as LayerSourceData;
                    if (t === 'paint') return {type: t, layerId: ml.source.layer_id ?? ml.id} as LayerSourceData;
                    // Fallback for unknown types
                    return ml.source as unknown as LayerSourceData;
                  })(),
                  isBase: ml.is_base,
                  ...(ml.blur != null ? { blur: ml.blur } : {}),
                  ...(ml.keyframes && ml.keyframes.length > 0 ? {
                    keyframes: ml.keyframes.map(mkf => ({
                      frame: mkf.frame,
                      easing: mkf.easing as EasingType,
                      values: {
                        opacity: mkf.values.opacity,
                        x: mkf.values.x,
                        y: mkf.values.y,
                        scaleX: mkf.values.scale_x,
                        scaleY: mkf.values.scale_y,
                        rotation: mkf.values.rotation,
                        blur: mkf.values.blur ?? 0,
                        ...(mkf.values.source_overrides ? { sourceOverrides: mkf.values.source_overrides } : {}),
                      },
                    })),
                  } : {}),
                }),
              )
          : [createBaseLayer()];

      const seq: Sequence = {
        id: mceSeq.id,
        kind: (mceSeq.kind as 'content' | 'fx' | 'content-overlay') ?? 'content',
        name: mceSeq.name,
        fps: mceSeq.fps,
        width: mceSeq.width,
        height: mceSeq.height,
        keyPhotos: sortedKps.map(
          (kp): KeyPhoto => ({
            id: kp.id,
            imageId: kp.image_id,
            holdFrames: kp.hold_frames,
            ...(kp.solid_color ? { solidColor: kp.solid_color } : {}),
            ...(kp.is_transparent ? { isTransparent: kp.is_transparent } : {}),
            ...(kp.gradient ? {
              gradient: {
                type: kp.gradient.type as 'linear' | 'radial' | 'conic',
                stops: kp.gradient.stops,
                ...(kp.gradient.angle != null ? { angle: kp.gradient.angle } : {}),
                ...(kp.gradient.center_x != null ? { centerX: kp.gradient.center_x } : {}),
                ...(kp.gradient.center_y != null ? { centerY: kp.gradient.center_y } : {}),
              },
            } : {}),
          }),
        ),
        layers,
        ...(mceSeq.in_frame != null ? { inFrame: mceSeq.in_frame } : {}),
        ...(mceSeq.out_frame != null ? { outFrame: mceSeq.out_frame } : {}),
        ...(mceSeq.fade_in ? {
          fadeIn: {
            type: mceSeq.fade_in.type as TransitionType,
            duration: mceSeq.fade_in.duration,
            mode: (mceSeq.fade_in.mode ?? 'transparency') as FadeMode,
            color: mceSeq.fade_in.color ?? '#000000',
            curve: (mceSeq.fade_in.curve ?? 'ease-in-out') as EasingType,
          },
        } : {}),
        ...(mceSeq.fade_out ? {
          fadeOut: {
            type: mceSeq.fade_out.type as TransitionType,
            duration: mceSeq.fade_out.duration,
            mode: (mceSeq.fade_out.mode ?? 'transparency') as FadeMode,
            color: mceSeq.fade_out.color ?? '#000000',
            curve: (mceSeq.fade_out.curve ?? 'ease-in-out') as EasingType,
          },
        } : {}),
        ...(mceSeq.cross_dissolve ? {
          crossDissolve: {
            type: mceSeq.cross_dissolve.type as TransitionType,
            duration: mceSeq.cross_dissolve.duration,
            mode: (mceSeq.cross_dissolve.mode ?? 'transparency') as FadeMode,
            color: mceSeq.cross_dissolve.color ?? '#000000',
            curve: (mceSeq.cross_dissolve.curve ?? 'ease-in-out') as EasingType,
          },
        } : {}),
        ...((mceSeq as any).gl_transition ? {
          glTransition: {
            shaderId: (mceSeq as any).gl_transition.shader_id,
            params: (mceSeq as any).gl_transition.params ?? {},
            duration: (mceSeq as any).gl_transition.duration,
            curve: ((mceSeq as any).gl_transition.curve ?? 'ease-in-out') as EasingType,
          },
        } : {}),
      };
      sequenceStore.add(seq);
    }

    // Set first sequence as active if any exist
    if (sortedSeqs.length > 0) {
      sequenceStore.setActive(sortedSeqs[0].id);
      uiStore.selectSequence(sortedSeqs[0].id);
    }

    // Re-discover video assets from loaded video layers using videoAssetId
    for (const seq of sequenceStore.sequences.value) {
      for (const layer of seq.layers) {
        if (layer.source.type === 'video' && layer.source.videoAssetId) {
          const videoPath = videoAssetIdToPath.get(layer.source.videoAssetId) ?? '';
          const filename = videoPath.split('/').pop() ?? 'video';
          imageStore.addVideoAsset({
            id: layer.source.videoAssetId,
            name: filename,
            path: videoPath,
          });
        }
      }
    }

    // 4. Load audio tracks (v8+; empty for v7 and earlier)
    audioStore.reset();
    audioPeaksCache.clear();
    const mceAudioTracks = project.audio_tracks ?? [];
    const sortedAudio = [...mceAudioTracks].sort((a, b) => a.order - b.order);

    for (const mat of sortedAudio) {
      const track: AudioTrack = {
        id: mat.id,
        audioAssetId: mat.audio_asset_id ?? mat.id,
        name: mat.name,
        filePath: projectRoot + '/' + mat.relative_path,
        relativePath: mat.relative_path,
        originalFilename: mat.original_filename,
        offsetFrame: mat.offset_frame,
        inFrame: mat.in_frame,
        outFrame: mat.out_frame,
        volume: mat.volume,
        muted: mat.muted,
        fadeInFrames: mat.fade_in_frames,
        fadeOutFrames: mat.fade_out_frames,
        fadeInCurve: (mat.fade_in_curve as FadeCurve) ?? 'exponential',
        fadeOutCurve: (mat.fade_out_curve as FadeCurve) ?? 'exponential',
        sampleRate: mat.sample_rate,
        duration: mat.duration,
        channelCount: mat.channel_count,
        order: mat.order,
        trackHeight: mat.track_height ?? 44,
        slipOffset: mat.slip_offset ?? 0,
        totalFramesInFile: mat.total_frames_in_file ?? mat.out_frame,
        bpm: mat.bpm ?? null,
        beatOffsetFrames: mat.beat_offset_frames ?? 0,
        beatMarkers: mat.beat_markers ?? [],
        showBeatMarkers: mat.show_beat_markers ?? false,
      };
      // Load track into store (without undo -- this is hydration)
      audioStore.tracks.value = [...audioStore.tracks.value, track];

      // Populate audioAssets in imageStore so ImportedView shows them
      imageStore.addAudioAsset({
        id: track.id,
        name: track.originalFilename,
        path: track.filePath,
      });
    }

    // 5. Clear dirty flag (just loaded)
    isDirty.value = false;
  });

  // Load paint layer sidecar data (async, outside batch)
  const paintLayerIds = sequenceStore.sequences.value
    .flatMap(s => s.layers)
    .filter(l => l.type === 'paint')
    .map(l => l.id);
  if (paintLayerIds.length > 0) {
    loadPaintData(projectRoot, paintLayerIds).catch(err => {
      console.error('Failed to load paint data (non-fatal):', err);
    });
  }

  // Async: re-decode audio files for playback and waveform peaks
  (async () => {
    for (const track of audioStore.tracks.peek()) {
      try {
        const fileBytes = await readFile(track.filePath);
        const arrayBuffer = fileBytes.buffer;
        const audioBuffer = await audioEngine.decode(track.id, arrayBuffer);
        const peaks = computeWaveformPeaks(audioBuffer);
        audioPeaksCache.set(track.id, peaks);
      } catch (err) {
        console.error(`Failed to decode audio track "${track.name}":`, err);
      }
    }
  })();
}

// --- Store ---

export const projectStore = {
  name,
  fps,
  width,
  height,
  aspectRatio,
  filePath,
  dirPath,
  isDirty,
  isSaving,

  setName(v: string) {
    name.value = v;
    isDirty.value = true;
  },
  setFps(v: number) {
    fps.value = v;
    isDirty.value = true;
  },
  setResolution(w: number, h: number) {
    width.value = w;
    height.value = h;
    isDirty.value = true;
  },

  loadFromData(data: ProjectData) {
    name.value = data.name;
    fps.value = data.fps;
    width.value = data.width;
    height.value = data.height;
  },

  markDirty() {
    isDirty.value = true;
  },

  buildMceProject,
  hydrateFromMce,

  /** Create a new project. Migrates temp images if any exist. */
  async createProject(projectName: string, projectFps: number, projectDirPath: string) {
    // Close any existing project first (resets all stores, stops engines/timers)
    projectStore.closeProject();

    const result = await projectCreate(projectName, projectFps, projectDirPath);
    if (!result.ok) {
      throw new Error(result.error);
    }

    // Migrate images from temp dir to real project dir (Pitfall 6)
    const tempDir = tempProjectDir.value;
    if (tempDir) {
      const migrateResult = await projectMigrateTempImages(tempDir, projectDirPath);
      if (migrateResult.ok) {
        // Update all imageStore image paths: replace tempDir prefix with new dirPath
        imageStore.updateProjectPaths(tempDir, projectDirPath);
      }
    }

    batch(() => {
      name.value = projectName;
      fps.value = projectFps;
      width.value = result.data.width;
      height.value = result.data.height;
      dirPath.value = projectDirPath;
      filePath.value = null; // Not yet saved to .mce
      isDirty.value = true;
    });

    // Restart auto-save for the new project
    startAutoSave();

    // Fit canvas to window on project create (per ZOOM-03)
    // Use setTimeout(0) to ensure DOM has rendered with new project dimensions
    setTimeout(() => canvasStore.fitToWindow(), 0);
  },

  /** Save the project to its .mce file. If filePath is null, caller should use saveProjectAs. */
  async saveProject() {
    if (isSaving.value) return; // Prevent concurrent saves
    const currentFilePath = filePath.value;
    if (!currentFilePath) return; // Cannot save without a file path

    isSaving.value = true;
    try {
      // Save paint sidecar files before .mce (per Pitfall 5: write paint files first)
      const currentDir = dirPath.value;
      if (currentDir) {
        try {
          await savePaintData(currentDir);
          // Cleanup orphaned paint directories for deleted paint layers
          const paintLayerIds = sequenceStore.sequences.value
            .flatMap(s => s.layers)
            .filter(l => l.type === 'paint')
            .map(l => l.id);
          await cleanupOrphanedPaintFiles(currentDir, paintLayerIds);
        } catch (err) {
          console.error('Failed to save paint data (non-fatal):', err);
        }
      }

      const project = buildMceProject();
      const result = await ipcProjectSave(project, currentFilePath);
      if (!result.ok) {
        throw new Error(result.error);
      }
      isDirty.value = false;

      // Update recent projects
      await addRecentProject({
        name: name.value,
        path: currentFilePath,
        lastOpened: new Date().toISOString(),
      });
      await setLastProjectPath(currentFilePath);
    } finally {
      isSaving.value = false;
    }
  },

  /** Save project to a specific file path (Save As). Migrates temp images if needed. */
  async saveProjectAs(newFilePath: string) {
    // If saving from temp project, migrate images first
    const tempDir = tempProjectDir.value;
    const currentDir = dirPath.value;
    if (tempDir && currentDir === tempDir) {
      const newDir = newFilePath.substring(0, newFilePath.lastIndexOf('/'));
      const migrateResult = await projectMigrateTempImages(tempDir, newDir);
      if (migrateResult.ok) {
        imageStore.updateProjectPaths(tempDir, newDir);
        dirPath.value = newDir;
      }
    }

    // Derive dirPath from filePath's parent
    const parentDir = newFilePath.substring(0, newFilePath.lastIndexOf('/'));
    dirPath.value = parentDir;
    filePath.value = newFilePath;

    await projectStore.saveProject();
  },

  /** Open a project from an .mce file */
  async openProject(openFilePath: string) {
    // Close any existing project first (resets all stores, stops engines/timers)
    projectStore.closeProject();

    const result = await ipcProjectOpen(openFilePath);
    if (!result.ok) {
      throw new Error(result.error);
    }

    // Derive dirPath from filePath's parent
    const projectRoot = openFilePath.substring(0, openFilePath.lastIndexOf('/'));

    batch(() => {
      filePath.value = openFilePath;
      dirPath.value = projectRoot;
    });

    hydrateFromMce(result.data, projectRoot);

    // Update recent projects
    await addRecentProject({
      name: result.data.name,
      path: openFilePath,
      lastOpened: new Date().toISOString(),
    });
    await setLastProjectPath(openFilePath);

    // Restart auto-save for the opened project
    startAutoSave();

    // Fit canvas to window on project open (per ZOOM-03)
    // Use setTimeout(0) to ensure DOM has rendered with new project dimensions
    setTimeout(() => canvasStore.fitToWindow(), 0);
  },

  /** Close the current project and reset all stores */
  closeProject() {
    // 1. Stop engines and timers FIRST (prevents orphaned operations)
    stopAutoSave();
    playbackEngine.stop();

    // 2. Reset all stores
    batch(() => {
      name.value = 'Untitled Project';
      fps.value = 24;
      width.value = 1920;
      height.value = 1080;
      filePath.value = null;
      dirPath.value = null;
      isDirty.value = false;
      isSaving.value = false;
    });
    sequenceStore.reset();
    imageStore.reset();
    audioStore.reset();
    paintStore.reset();
    audioPeaksCache.clear();
    audioEngine.stopAll();
    uiStore.reset();
    timelineStore.reset();
    layerStore.reset();
    canvasStore.reset();
    historyStore.stack.value = [];
    historyStore.pointer.value = -1;
  },

  reset() {
    name.value = 'Untitled Project';
    fps.value = 24;
    width.value = 1920;
    height.value = 1080;
  },
};

// Wire sequenceStore's markDirty callback to projectStore
// This avoids circular imports (sequenceStore -> projectStore)
_setMarkDirtyCallback(() => projectStore.markDirty());

// Wire imageStore's markDirty callback to projectStore
// This avoids circular imports (imageStore -> projectStore)
_setImageMarkDirtyCallback(() => projectStore.markDirty());

// Wire audioStore's markDirty callback to projectStore
// This avoids circular imports (audioStore -> projectStore)
_setAudioMarkDirtyCallback(() => projectStore.markDirty());
