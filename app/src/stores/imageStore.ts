import {signal, computed, batch} from '@preact/signals';
import type {ImportResult, ImportedImage} from '../types/image';
import type {MceAudioAssetRef, MceImageRef, MceVideoAssetRef} from '../types/project';
import {importImages as ipcImportImages, assetUrl} from '../lib/ipc';
import {readMceAudioSourcePath, readMceVideoAssetSourcePath} from '../lib/mceAudioSourcePath';

const POOL_MAX = 50;

/** Metadata for an imported video asset */
export interface VideoAsset {
  id: string;
  name: string;
  path: string; // absolute on-disk source path of the referenced video (disk reference, never copied)
}

/** Probed source length in frames per video asset id (53.1-03: feeds the export
 *  gate's past-source extrapolation). Plain Map, NOT a signal — this is a
 *  draw-path → export-gate handoff, and a reactivity write from the canvas draw
 *  path is a Rule 6 cycle ("Cycle detected"). Absent = unknown → the export gate
 *  treats the source as unlimited (MAX_SAFE_INTEGER). */
const videoSourceFrameCounts = new Map<string, number>();

/** Metadata for an imported audio asset */
export interface AudioAsset {
  id: string;
  name: string;
  path: string; // absolute path to the audio file on disk (disk reference)
}

/** All imported images (metadata only -- does not mean full-res is loaded) */
const images = signal<ImportedImage[]>([]);

/** All imported video assets */
const videoAssets = signal<VideoAsset[]>([]);

/** All imported audio assets */
const audioAssets = signal<AudioAsset[]>([]);

/** IDs of images currently loaded at full resolution in the DOM */
const fullResLoaded = signal<Map<string, number>>(new Map()); // id -> lastAccessed timestamp

/** Whether an import operation is in progress */
const isImporting = signal(false);

/** Last import error messages */
const importErrors = signal<string[]>([]);

const imageCount = computed(() => images.value.length);
const poolSize = computed(() => fullResLoaded.value.size);
const videoAssetCount = computed(() => videoAssets.value.length);
const audioAssetCount = computed(() => audioAssets.value.length);

// markDirty callback set by projectStore to avoid circular imports
let _markDirty: (() => void) | null = null;
export function _setImageMarkDirtyCallback(fn: () => void) {
  _markDirty = fn;
}

export const imageStore = {
  images,
  fullResLoaded,
  isImporting,
  importErrors,
  imageCount,
  poolSize,
  videoAssets,
  videoAssetCount,
  audioAssets,
  audioAssetCount,

  /**
   * Import images from file paths via Rust backend.
   *
   * quick-260921-bjm: returns the IPC outcome additively so the image-import
   * bridge handler (running in THIS realm — the one that owns the manifest
   * `images` record) can report success and per-file errors. `null` = the
   * import could not be performed (IPC failure). The two main-app callers
   * (`EditorShell.tsx`, `ImportedView.tsx`) ignore the value; `importErrors`
   * and `isImporting` behave exactly as before.
   */
  async importFiles(paths: string[], projectDir: string): Promise<ImportResult | null> {
    if (paths.length === 0) return null;

    isImporting.value = true;
    importErrors.value = [];

    try {
      const result = await ipcImportImages(paths, projectDir);
      if (!result.ok) {
        importErrors.value = [result.error];
        return null;
      }

      batch(() => {
        // Add newly imported images to the store
        images.value = [...images.value, ...result.data.imported];

        // Record any errors
        if (result.data.errors.length > 0) {
          importErrors.value = result.data.errors.map(
            (e) => `${e.path}: ${e.error}`,
          );
        }
      });
      // Mark project dirty so auto-save interval also triggers
      _markDirty?.();
      return result.data;
    } finally {
      isImporting.value = false;
    }
  },

  /** Register a video file as an imported asset (idempotent by id). */
  addVideoAsset(asset: VideoAsset) {
    if (videoAssets.value.some((existing) => existing.id === asset.id)) return;
    videoAssets.value = [...videoAssets.value, asset];
    _markDirty?.();
  },

  /** Register an audio file as an imported asset (idempotent by id). */
  addAudioAsset(asset: AudioAsset) {
    if (audioAssets.value.some((existing) => existing.id === asset.id)) return;
    audioAssets.value = [...audioAssets.value, asset];
    _markDirty?.();
  },

  /** Remove a video asset from the store */
  removeVideoAsset(id: string) {
    videoAssets.value = videoAssets.value.filter(v => v.id !== id);
    videoSourceFrameCounts.delete(id);
    _markDirty?.();
  },

  /** Record the probed source length (frames) for a video asset. Plain cache
   *  write — never touches a signal, so it is legal on the canvas draw path. */
  setVideoSourceFrameCount(assetId: string, count: number) {
    videoSourceFrameCounts.set(assetId, count);
  },

  /** Probed source length for a video asset, or undefined when not yet known. */
  getVideoSourceFrameCount(assetId: string): number | undefined {
    return videoSourceFrameCounts.get(assetId);
  },

  /** Remove an audio asset from the store */
  removeAudioAsset(id: string) {
    audioAssets.value = audioAssets.value.filter(a => a.id !== id);
    _markDirty?.();
  },

  /** Get the display URL for an image -- thumbnail (always) or full-res (if in pool) */
  getDisplayUrl(image: ImportedImage, preferFullRes: boolean = false): string {
    if (preferFullRes && fullResLoaded.value.has(image.id)) {
      return assetUrl(image.project_path);
    }
    return assetUrl(image.thumbnail_path);
  },

  /** Load a full-res image into the pool; evict LRU if over capacity */
  loadFullRes(id: string) {
    const map = new Map(fullResLoaded.value);
    map.set(id, Date.now());

    // Evict LRU entries if over capacity
    while (map.size > POOL_MAX) {
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      for (const [key, time] of map) {
        if (time < oldestTime) {
          oldestTime = time;
          oldestId = key;
        }
      }
      if (oldestId) map.delete(oldestId);
    }

    fullResLoaded.value = map;
  },

  /** Touch an entry (mark as recently used) */
  touchFullRes(id: string) {
    const entry = fullResLoaded.value.get(id);
    if (entry !== undefined) {
      const map = new Map(fullResLoaded.value);
      map.set(id, Date.now());
      fullResLoaded.value = map;
    }
  },

  /** Remove an imported image from the store */
  remove(id: string) {
    batch(() => {
      images.value = images.value.filter((img) => img.id !== id);
      const map = new Map(fullResLoaded.value);
      map.delete(id);
      fullResLoaded.value = map;
    });
  },

  /** Get an image by ID */
  getById(id: string): ImportedImage | undefined {
    return images.value.find((img) => img.id === id);
  },

  /** Load images from MceImageRef array (for project open hydration).
   *  Converts relative paths to absolute using the project root. */
  loadFromMceImages(mceImages: MceImageRef[], projectRoot: string) {
    const root = projectRoot.endsWith('/') ? projectRoot.slice(0, -1) : projectRoot;
    const imported: ImportedImage[] = mceImages.map((ref) => ({
      id: ref.id,
      original_path: ref.original_filename,
      project_path: `${root}/${ref.relative_path}`,
      thumbnail_path: `${root}/${ref.thumbnail_relative_path}`,
      width: ref.width,
      height: ref.height,
      format: ref.format,
    }));
    batch(() => {
      images.value = imported;
      fullResLoaded.value = new Map();
    });
  },

  /**
   * Restore gallery audio assets from a saved project — disk references, path
   * verbatim from `source_path` (no projectRoot join, no root strip).
   */
  loadFromMceAudioAssets(refs: readonly unknown[]) {
    const loaded = refs.map((ref) => {
      const sourcePath = readMceAudioSourcePath(ref, 'audio_assets[]');
      const record = ref as {id: unknown; name: unknown};
      return {
        id: String(record.id ?? ''),
        name: String(record.name ?? ''),
        path: sourcePath,
      };
    });
    batch(() => {
      audioAssets.value = loaded;
    });
  },

  /** Convert current gallery audio assets to disk-reference refs (for project save). */
  toMceAudioAssets(): MceAudioAssetRef[] {
    return audioAssets.value.map((asset) => ({
      id: asset.id,
      name: asset.name,
      source_path: asset.path,
    }));
  },

  /**
   * Restore gallery video assets from a saved project — disk references, path
   * verbatim from `source_path` (no projectRoot join, no root strip). Fail
   * closed through `readMceVideoAssetSourcePath` (261012-d6q/VID-02).
   */
  loadFromMceVideoAssets(refs: readonly unknown[]) {
    const loaded = refs.map((ref) => {
      const sourcePath = readMceVideoAssetSourcePath(ref, 'video_assets[]');
      const record = ref as {id: unknown; name: unknown};
      return {
        id: String(record.id ?? ''),
        name: String(record.name ?? ''),
        path: sourcePath,
      };
    });
    batch(() => {
      videoAssets.value = loaded;
    });
  },

  /** Convert current gallery video assets to disk-reference refs (for project save). */
  toMceVideoAssets(): MceVideoAssetRef[] {
    return videoAssets.value.map((asset) => ({
      id: asset.id,
      name: asset.name,
      source_path: asset.path,
    }));
  },

  /** Convert current images to MceImageRef array (for project save).
   *  Makes paths relative by stripping the project root prefix. */
  toMceImages(projectRoot: string): MceImageRef[] {
    const root = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
    return images.value.map((img) => ({
      id: img.id,
      original_filename: img.original_path.split('/').pop() ?? img.original_path,
      relative_path: img.project_path.startsWith(root)
        ? img.project_path.slice(root.length)
        : img.project_path,
      thumbnail_relative_path: img.thumbnail_path.startsWith(root)
        ? img.thumbnail_path.slice(root.length)
        : img.thumbnail_path,
      width: img.width,
      height: img.height,
      format: img.format,
    }));
  },

  /** Update image paths after project dir migration (temp -> real project).
   *  Disk references (audio AND video) are never rewritten — a root-prefix
   *  replace over a path outside the project would corrupt it (261012-d6q). */
  updateProjectPaths(oldRoot: string, newRoot: string) {
    images.value = images.value.map((img) => ({
      ...img,
      project_path: img.project_path.replace(oldRoot, newRoot),
      thumbnail_path: img.thumbnail_path.replace(oldRoot, newRoot),
    }));
  },

  /** Reset store */
  reset() {
    batch(() => {
      images.value = [];
      videoAssets.value = [];
      audioAssets.value = [];
      fullResLoaded.value = new Map();
      isImporting.value = false;
      importErrors.value = [];
    });
    videoSourceFrameCounts.clear();
  },
};
