import {signal, computed, batch} from '@preact/signals';
import type {ProjectData, MceProject, RuntimeMceProject, MceSequence, MceKeyPhoto, MceLayer} from '../types/project';
import type {MceAudioTrack} from '../types/audio';
import type {AudioTrack, FadeCurve} from '../types/audio';
import type {Sequence, KeyPhoto, TransitionType, FadeMode} from '../types/sequence';
import type {PhysicPaintRenderedFrame} from '../types/physicPaint';
import type {Layer, LayerType, BlendMode, LayerSourceData, EasingType} from '../types/layer';
import {createBaseLayer} from '../types/layer';
import {projectCreate, projectSaveAsWithScriptLibrary, projectOpen as ipcProjectOpen, projectMigrateTempImages, resolvePhysicPaintCacheRoot, scriptLibraryBindSavedProject, scriptLibraryClearActiveProject} from '../lib/ipc';
import {imageStore, _setImageMarkDirtyCallback} from './imageStore';
import {sequenceStore, _setMarkDirtyCallback, _setSequenceProjectDimensionsProvider} from './sequenceStore';
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
import {paintStore, _setPaintMarkDirtyCallback} from './paintStore';
import {physicPaintStore, _setPhysicPaintMarkDirtyCallback, _setPhysicPaintCompositorSizeProvider, _setPhysicPaintPackageDirProvider} from './physicPaintStore';
import {motionBlurStore} from './motionBlurStore';
import {exportStore} from './exportStore';
import {savePaintData, loadPaintData, cleanupOrphanedPaintFiles} from '../lib/paintPersistence';
import {recordPhysicsPaintPerformance} from '../components/physic-paint/performance/physicsPaintPerformanceTrace';
import {requestPhysicPaintFlush} from '../lib/physicPaintFlush';
import {loadEfxPaintPackage, savePackage} from '../lib/efxPaintPersistence';
import type {EfxPaintDocumentSaveInput, EfxPaintLoadedDocument} from '../lib/efxPaintPersistence';
import type {EfxPaintDocument} from '../efx-paint/document/efxPaintDocument';
import {materializePackageRotoMediaBytes} from '../lib/efxPaintMediaMaterialize';
import {isProjectId} from '../lib/efxPaintPackage';
import {toPackageManifestPath} from '../lib/openedProjectUrls';
import {findPackageFormatRejection} from '../efx-paint/document/efxPaintCleanBreak';
import {showLegacyPhysicPaintRejectionDialog} from '../lib/efxPaintRejectionDialog';
import {
  registerDocument as registerEfxPaintDocument,
  hydrateRuntimeFromDocument as hydrateEfxPaintRuntimeFromDocument,
  serializeRuntimeIntoDocument as serializeEfxPaintDocument,
  takePendingTrackDeletions,
  reset as resetEfxPaintStore,
  _setEfxPaintMarkDirtyCallback,
} from './efxPaintStore';
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
const scriptLibraryAuthority = signal<string | null>(null);
const projectContextId = signal(crypto.randomUUID());
/**
 * quick-260922-al1: the Scripts panel's layer-scope filter. The MAIN realm owns
 * it because a Studio layer switch re-boots the child webview — the reused
 * window is NAVIGATED by `open_physics_paint_window` (app/src-tauri/src/lib.rs:186)
 * — so no in-child signal survives one, while this realm survives the whole
 * Studio session inside one open project. Holds `'all'` or a LIVE physic-paint
 * layer id; `setScriptScope` clamps fail-closed, so a dead layer is never stored.
 */
const scriptScope = signal<string>('all');

/**
 * The package identity (52.2-07, D-05): the manifest's `projectId`, and the key
 * the machine-local derived-frame cache root is resolved from. Minted for a new
 * project, ADOPTED from the manifest on open (so a package keeps its identity —
 * and therefore its disposable cache — wherever it is opened), and rotated on
 * close so the next project can never resolve the previous one's cache.
 */
const projectId = signal<string>(crypto.randomUUID());

function rotateProjectContext(): void {
  projectContextId.value = crypto.randomUUID();
  // quick-260922-al1: the scope is project-SESSION state. The project identity
  // is the only term that rotates on open / close / new, so this is exactly the
  // locked "returns to All on every project reopen" trigger — a LAYER identity
  // change (same projectContextId, different layerId) must keep the scope.
  scriptScope.value = 'all';
}

function rotateProjectId(): void {
  projectId.value = crypto.randomUUID();
}

/**
 * The machine-local derived-frame cache root for one package identity
 * (`<app_data_dir>/frame-cache/<projectId>`). Best-effort by contract (D-14):
 * a resolution failure returns null, the save skips the whole cache leg, and
 * the authoritative package save still commits.
 */
async function resolveCacheRootFor(cacheProjectId: string): Promise<string | null> {
  const result = await resolvePhysicPaintCacheRoot(cacheProjectId);
  return result.ok ? result.data : null;
}

/** The cache root of the CURRENTLY open package. */
async function resolveCacheRoot(): Promise<string | null> {
  return resolveCacheRootFor(projectId.value);
}

async function publishScriptLibraryContext(): Promise<void> {
  const { publishPhysicPaintProjectContext } = await import('../lib/physicPaintBridge');
  await publishPhysicPaintProjectContext();
}

async function bindScriptLibraryAuthority(savedFilePath: string): Promise<void> {
  const result = await scriptLibraryBindSavedProject(savedFilePath);
  if (!result.ok) throw new Error(result.error);
  scriptLibraryAuthority.value = result.data;
  await publishScriptLibraryContext();
}

function clearScriptLibraryAuthority(): void {
  scriptLibraryAuthority.value = null;
  void scriptLibraryClearActiveProject().finally(() => { void publishScriptLibraryContext(); });
}

// --- Helpers ---

/**
 * Every live physic-paint layer, in timeline order, deduplicated by layerId.
 * `name` is the layer's LIVE display name (quick-260922-al1: the Scripts panel
 * filter entries and the provenance line resolve from it); an empty or absent
 * name falls back to the layer id so a filter entry is never blank.
 */
function getActivePhysicPaintLayers(): { id: string; name: string }[] {
  const layers: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const sequence of sequenceStore.sequences.value) {
    for (const layer of sequence.layers) {
      if (layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') continue;
      const id = layer.source.layerId;
      if (seen.has(id)) continue;
      seen.add(id);
      layers.push({ id, name: typeof layer.name === 'string' && layer.name.trim() ? layer.name : id });
    }
  }
  return layers;
}

/** The ids of every live physic-paint layer — `getActivePhysicPaintLayers`'s consumer. */
function getActivePhysicPaintLayerIds(): Set<string> {
  return new Set(getActivePhysicPaintLayers().map((layer) => layer.id));
}

/**
 * Store a requested script scope (quick-260922-al1). Idempotent compare-then-
 * write — a repeat call with the same value writes nothing, so it can never
 * drive a subscriber loop — and fail-closed: anything that is not `'all'` or a
 * LIVE layer id (unknown, dead, malformed) stores `'all'`. This is the main
 * realm's INBOUND edge; the child's outbound request never reaches a stored
 * value the child cannot render an entry for.
 */
function setScriptScope(value: string): void {
  const next = value === 'all' || getActivePhysicPaintLayers().some((layer) => layer.id === value) ? value : 'all';
  if (scriptScope.peek() === next) return;
  scriptScope.value = next;
}

/**
 * Build the v1.0 save input: one serialized document per active physic-paint
 * layer plus its runtime frame bytes (staged as sidecars by the persistence
 * service). Fail-closed: a layer without a registered document throws
 * (creation always registers one — Task 3 — and the open gate rejects
 * documentless layers, so this only fires on internal inconsistency).
 */
function buildEfxPaintDocuments(): Map<string, EfxPaintDocumentSaveInput> {
  const documents = new Map<string, EfxPaintDocumentSaveInput>();
  for (const layerId of getActivePhysicPaintLayerIds()) {
    const document = serializeEfxPaintDocument(layerId);
    // 46-02 (TRK-03): the frame carrier is per-track (trackId → appFrame →
    // frame). Every track of the serialized document contributes its own
    // runtime frame map so two tracks may own frames at the same appFrame
    // without collision.
    const framesPerTrack = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
    for (const track of document.tracks) {
      framesPerTrack.set(track.id, physicPaintStore.getFrames(layerId, track.id));
    }
    // 46-05 D-15: committed track deletions register their sidecar dirs here
    // (cleared on read) so the removal rides the same cache transaction as
    // this save.
    documents.set(layerId, {
      document,
      frames: framesPerTrack,
      deletions: takePendingTrackDeletions(layerId),
    });
  }
  return documents;
}

function recordSaveStage(stage: string, durationMs: number, branch: 'autosave' | 'manual'): void {
  recordPhysicsPaintPerformance({
    stage,
    category: 'async-elapsed',
    durationMs,
    timestamp: performance.now(),
    branch,
  });
}

/**
 * Run one package save (52.2-07 Task 3, D-09/D-10/D-11) and record its
 * per-file telemetry (T-52.2-24). `packageDir` is the package root — the
 * project folder itself. The manifest is assembled inside the persistence
 * service from `buildMceProject()` plus the package identity, and reaches its
 * canonical path only through the package transaction, exactly like every
 * layer sub-file and media file. The four stages are reported separately so a
 * regression to one whole-project serialize shows up as a single dominant term
 * instead of hiding inside one opaque total.
 *
 * Returns the committed manifest — the project as persisted.
 */
async function savePackageWithTelemetry(
  packageDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput>,
  branch: 'autosave' | 'manual',
): Promise<MceProject> {
  const result = await savePackage(packageDir, {
    project: buildMceProject(),
    documents,
    projectId: projectId.value,
    cacheRoot: await resolveCacheRoot(),
  });
  recordSaveStage('persist.media', result.metrics.mediaMs, branch);
  recordSaveStage('persist.layers', result.metrics.layersMs, branch);
  recordSaveStage('persist.manifest', result.metrics.manifestMs, branch);
  recordSaveStage('persist.commit', result.metrics.commitMs, branch);
  // The manifest IS the persisted project (the main-editor fields plus
  // `formatVersion`/`projectId`/`efxPaint`); Save As hands it to the script
  // library migration, which stages the same project shape.
  return result.manifest as unknown as MceProject;
}

function buildMceProject(): RuntimeMceProject {
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
          // Paint / physic-paint layer identity
          ...(layer.source.type === 'paint' || layer.source.type === 'physic-paint' ? {
            layer_id: (layer.source as { layerId: string }).layerId,
          } : {}),
        },
        is_base: layer.isBase ?? false,
        order: layerIndex,
        ...(layer.blur != null && layer.blur > 0 ? { blur: layer.blur } : {}),
        ...(layer.paintBgColor ? { paint_bg_color: layer.paintBgColor } : {}),
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
    version: 16,
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
    motion_blur: {
      enabled: motionBlurStore.enabled.peek(),
      shutter_angle: motionBlurStore.shutterAngle.peek(),
      preview_quality: motionBlurStore.previewQuality.peek(),
      export_sub_frames: exportStore.motionBlurSubFrames.peek(),
    },
    // v1.0: EFX Paint documents are persisted by the package save funnel
    // (savePackage), never by this builder — buildMceProject emits only the
    // main-editor fields the manifest is built from (D-04, one save path only).
  };
}

/**
 * Load MceProject data into all stores. `loadedDocuments` carries the v1.0
 * EFX Paint documents (with hydrated runtime frame bytes) loaded by the
 * persistence loader; each is registered into efxPaintStore and its default
 * track is projected into the physicPaintStore runtime maps (DOC-05).
 */
function hydrateFromMce(
  project: RuntimeMceProject,
  projectRoot: string,
  loadedDocuments: ReadonlyMap<string, EfxPaintLoadedDocument> = new Map(),
  runtimeDocuments: ReadonlyMap<string, EfxPaintDocument> = new Map(),
) {
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
                    if (t === 'paint' || t === 'physic-paint') return {type: t, layerId: ml.source.layer_id ?? ml.id} as LayerSourceData;
                    // Fallback for unknown types
                    return ml.source as unknown as LayerSourceData;
                  })(),
                  isBase: ml.is_base,
                  ...(ml.blur != null ? { blur: ml.blur } : {}),
                  ...(ml.paint_bg_color ? { paintBgColor: ml.paint_bg_color } : {}),
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

    // 5. Motion blur settings (v15+, optional for backward compat)
    const mb = project.motion_blur;
    motionBlurStore.enabled.value = mb?.enabled ?? false;
    motionBlurStore.shutterAngle.value = mb?.shutter_angle ?? 180;
    motionBlurStore.previewQuality.value = (mb?.preview_quality as 'off' | 'low' | 'medium') ?? 'medium';
    exportStore.setMotionBlurSubFrames(mb?.export_sub_frames ?? 8);

    // 6. v1.0 EFX Paint documents: register each into efxPaintStore and
    //    project its default track into the runtime maps (DOC-05). A pre-52.2
    //    project never reaches this point — the refusal gate rejects a manifest
    //    without the current `formatVersion` before hydration (52.2-08) — so
    //    the documents loaded here always come from the package sub-files.
    //    quick-260913-52r (G): the registered document stays REFERENCE-ONLY
    //    (the persisted shape); the runtime installs its materialized twin —
    //    every resolvable frame's bytes read and digest-verified at open —
    //    because the authority, the launch pack and the engine require inline
    //    bytes (the compositor's lazy seam is not a substitute for them).
    for (const [layerId, loaded] of loadedDocuments) {
      registerEfxPaintDocument(loaded.document);
      hydrateEfxPaintRuntimeFromDocument(runtimeDocuments.get(layerId) ?? loaded.document, loaded.frames);
    }

    // 8. Clear dirty flag (just loaded)
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
  scriptLibraryAuthority,
  projectContextId,
  scriptScope,

  getActivePhysicPaintLayers,
  setScriptScope,

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
  async createProject(projectName: string, projectFps: number, projectDirPath: string, projectWidth: number, projectHeight: number) {
    rotateProjectContext();
    // Close any existing project first (resets all stores, stops engines/timers)
    projectStore.closeProject();
    // A new project gets its own package identity (D-05): the manifest carries
    // it and the machine-local cache root is derived from it.
    rotateProjectId();

    const result = await projectCreate(projectName, projectFps, projectDirPath, projectWidth, projectHeight);
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
      // quick-260913-05k round 3 (UAT defect A): the user picked this package's
      // location in the New Project dialog, so the project owns its manifest
      // path from birth — a plain save (Cmd+S, autosave) targets the chosen
      // package instead of falling into the Save As picker, and a failed
      // initial save can never strand the project as "never saved".
      filePath.value = toPackageManifestPath(projectDirPath);
      isDirty.value = true;
    });

    // Restart auto-save for the new project
    startAutoSave();

    // Fit canvas to window on project create (per ZOOM-03)
    // Use setTimeout(0) to ensure DOM has rendered with new project dimensions
    setTimeout(() => canvasStore.fitToWindow(), 0);
  },

  /** Save the project to its .mce file. If filePath is null, caller should use saveProjectAs. */
  async saveProject(options?: { deferScriptAuthority?: boolean; skipPaintFlush?: boolean }) {
    if (isSaving.value) return; // Prevent concurrent saves
    const currentFilePath = filePath.value;
    if (!currentFilePath) return; // Cannot save without a file path

    isSaving.value = true;
    const saveStartedAtMs = performance.now();
    const branch = options?.skipPaintFlush === true ? 'autosave' : 'manual';
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

      const projectDir = currentDir ?? currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      // 52.1: drain the Studio's queued post-gesture work before serializing, so
      // a stroke + immediate Save never persists a stale document/sidecar set.
      // The debounced auto-save skips it (skipPaintFlush): the flush forces the
      // engine's finalize drain, which is unbounded at 1080p (~0.5-2s on the
      // Studio's main thread at 52.1 sizes) and fires from inside the user's
      // next stroke — the autosave's freshness guarantee doesn't need it.
      if (!options?.skipPaintFlush) await requestPhysicPaintFlush();
      // The write set is computed AFTER the flush, so the Studio's pending
      // post-gesture work is what gets persisted (never stale content).
      const documents = buildEfxPaintDocuments();
      await savePackageWithTelemetry(projectDir, documents, branch);
      if (!options?.deferScriptAuthority && !scriptLibraryAuthority.peek()) await bindScriptLibraryAuthority(currentFilePath);
      isDirty.value = false;

      // Update recent projects
      await addRecentProject({
        name: name.value,
        path: currentFilePath,
        lastOpened: new Date().toISOString(),
      });
      await setLastProjectPath(currentFilePath);
    } finally {
      recordPhysicsPaintPerformance({
        stage: 'persist.total',
        category: 'async-elapsed',
        durationMs: performance.now() - saveStartedAtMs,
        timestamp: performance.now(),
        branch: options?.skipPaintFlush === true ? 'autosave' : 'manual',
      });
      isSaving.value = false;
    }
  },

  /** Save project to a specific file path (Save As). Migrates temp images if needed. */
  async saveProjectAs(newFilePath: string) {
    const previousFilePath = filePath.peek();
    const previousDirPath = dirPath.peek();
    const previousAuthority = scriptLibraryAuthority.peek();
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

    const parentDir = newFilePath.substring(0, newFilePath.lastIndexOf('/'));
    try {
      // 52.1: drain the Studio's queued post-gesture work before serializing.
      await requestPhysicPaintFlush();
      const documents = buildEfxPaintDocuments();
      // The destination package: manifest, layer sub-files and media all reach
      // their canonical paths through the destination's own transaction, so a
      // refusal leaves the previous destination (or its absence) untouched.
      const manifest = await savePackageWithTelemetry(parentDir, documents, 'manual');
      if (previousFilePath && previousFilePath !== newFilePath) {
        // The script-library migration is its own native step: it moves the
        // active library from the source project to the destination and
        // re-publishes the manifest it is handed (byte-identical to the one the
        // package transaction just published) under its own transaction.
        const transaction = await projectSaveAsWithScriptLibrary(
          manifest,
          previousFilePath,
          newFilePath,
        );
        if (!transaction.ok) throw new Error(transaction.error);
        if (transaction.data.diagnostics.length > 0) console.warn('[projectStore] Script library Save As diagnostics', transaction.data.diagnostics);
      }
      batch(() => {
        dirPath.value = parentDir;
        filePath.value = newFilePath;
        scriptLibraryAuthority.value = null;
        rotateProjectContext();
        isDirty.value = false;
      });
      await bindScriptLibraryAuthority(newFilePath);
      // Update recent projects: a fresh/renamed v1.0 project must surface in Recents
      await addRecentProject({
        name: name.value,
        path: newFilePath,
        lastOpened: new Date().toISOString(),
      });
      await setLastProjectPath(newFilePath);
    } catch (error) {
      dirPath.value = previousDirPath;
      filePath.value = previousFilePath;
      scriptLibraryAuthority.value = previousAuthority;
      throw error;
    }
  },

  /** Open a project from an .mce file */
  async openProject(openFilePath: string) {
    const result = await ipcProjectOpen(openFilePath);
    if (!result.ok) {
      throw new Error(result.error);
    }

    // Clean-break gate (D-08): refuse pre-52.2 projects before any sidecar IO,
    // store mutation, or auto-save (Pitfall F4) — this position IS the
    // mitigation, moving it reproduces the Phase 45 hybrid-state failure. The
    // gate is a pure, non-throwing scan over the raw parsed manifest keyed on
    // `formatVersion` (52.2-08); on rejection the blocking no-recourse dialog
    // is shown and openProject returns with zero mutation.
    const rejection = findPackageFormatRejection(result.data, { pathKind: 'directory' });
    if (rejection) {
      await showLegacyPhysicPaintRejectionDialog(rejection);
      return;
    }

    // Load the v1.0 EFX Paint package (52.2-09 D-13) before replacing the
    // currently open project: the manifest's `efxPaint` index is the only layer
    // source, every layer sub-file passes the fail-closed reference-only
    // parser, and the returned documents carry media references with no pixel
    // bytes (the frames map is empty until the compositor decodes on demand).
    const projectRoot = openFilePath.substring(0, openFilePath.lastIndexOf('/'));
    // Adopt the package's own identity (D-05) BEFORE the load, because the
    // loader recomputes each derived-frame location against the machine cache
    // root of THIS package. A manifest without a usable `projectId` (a pre-52.2
    // project, which plan 08's gate refuses before this point) mints a fresh
    // one: a brand-new cache root is the fail-closed default, never another
    // package's cache.
    const nextProjectId = isProjectId(result.data.projectId) ? result.data.projectId : crypto.randomUUID();
    const loadedDocuments = await loadEfxPaintPackage({
      packageDir: projectRoot,
      manifest: result.data,
      machineCacheRoot: await resolveCacheRootFor(nextProjectId),
    });
    // quick-260913-52r (G): read every referenced frame file BEFORE hydration —
    // the runtime must hold bytes for the consumers that structurally require
    // them (authority frames projection, launch pack, engine preparation).
    // A failed read is loud and per-key; it never blocks the open (the record
    // stays reference-only and renders the missing-content slate), and it is
    // never silent.
    const materialized = await materializePackageRotoMediaBytes(loadedDocuments, projectRoot);
    for (const failure of materialized.failures) {
      console.error(
        `[efxPaintPersistence] reopen: frame media "${failure.relativePath}" (layer ${failure.layerId}, track ${failure.trackId}, ${failure.collection} ${failure.keyId}) is unreadable — ${failure.reason}. The key stays reference-only until its file is restored.`,
      );
    }
    const runtimeProject: RuntimeMceProject = {
      ...result.data,
    };

    projectStore.closeProject({ preservePreparedRotoCanvases: true });
    batch(() => {
      filePath.value = openFilePath;
      dirPath.value = projectRoot;
      projectId.value = nextProjectId;
    });

    hydrateFromMce(runtimeProject, projectRoot, loadedDocuments, materialized.runtimeDocuments);
    await bindScriptLibraryAuthority(openFilePath);

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
  closeProject(options?: { preservePreparedRotoCanvases?: boolean }) {
    rotateProjectContext();
    // A closed project's package identity must never key the next project's
    // derived-frame cache: a fresh UUID makes the next cache root a brand-new
    // directory rather than a stale, disposable-but-readable one.
    rotateProjectId();
    clearScriptLibraryAuthority();
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
    physicPaintStore.reset({ preserveRotoAlphaCanvases: options?.preservePreparedRotoCanvases });
    resetEfxPaintStore();
    motionBlurStore.reset();
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

// 260918-ovi: wire sequenceStore's project-dims provider so the three
// sequence factories (createSequence / createFxSequence /
// createContentOverlaySequence) stamp the LIVE project canvas size into each
// new Sequence record. Same ESM module-body cycle workaround as
// _setMarkDirtyCallback — sequenceStore never imports projectStore.
_setSequenceProjectDimensionsProvider(() => ({width: width.value, height: height.value}));

// Wire imageStore's markDirty callback to projectStore
// This avoids circular imports (imageStore -> projectStore)
_setImageMarkDirtyCallback(() => projectStore.markDirty());

// Wire audioStore's markDirty callback to projectStore
// This avoids circular imports (audioStore -> projectStore)
_setAudioMarkDirtyCallback(() => projectStore.markDirty());

// Wire paintStore's markDirty callback to projectStore
// This ensures auto-save fires when the user paints
_setPaintMarkDirtyCallback(() => projectStore.markDirty());

// Wire physicPaintStore's markDirty callback to projectStore
// This ensures auto-save notices rendered physics paint output changes
_setPhysicPaintMarkDirtyCallback(() => projectStore.markDirty());

// Wire physicPaintStore's flattened-compositor size provider to the parent
// project canvas dims (48-03 Open Question 1 — the parent project canvas is
// the size authority for getFlattenedFrame; injected here because the store
// cannot import projectStore without an ESM module-body cycle).
_setPhysicPaintCompositorSizeProvider(() => ({width: width.value, height: height.value}));
// quick-260913-52r (G): the 52.2-09 compositor seam resolves reference-only
// frames against the open package root through this provider — it was created
// for exactly this wiring and never installed in production (the only callers
// were tests), so every reference answered 'missing' with no log. The Studio
// window keeps `dirPath` null: its pixels arrive as bytes with the launch pack
// (the open leg materializes them), and this provider serves the main
// window's lazy composite path.
_setPhysicPaintPackageDirProvider(() => dirPath.value ?? null);

// Wire efxPaintStore's markDirty callback to projectStore
// This ensures auto-save notices v1.0 document mutations
_setEfxPaintMarkDirtyCallback(() => projectStore.markDirty());
