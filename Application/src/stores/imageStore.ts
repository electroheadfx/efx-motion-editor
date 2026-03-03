import {signal, computed, batch} from '@preact/signals';
import type {ImportedImage} from '../types/image';
import type {MceImageRef} from '../types/project';
import {importImages as ipcImportImages, assetUrl} from '../lib/ipc';

const POOL_MAX = 50;

/** All imported images (metadata only -- does not mean full-res is loaded) */
const images = signal<ImportedImage[]>([]);

/** IDs of images currently loaded at full resolution in the DOM */
const fullResLoaded = signal<Map<string, number>>(new Map()); // id -> lastAccessed timestamp

/** Whether an import operation is in progress */
const isImporting = signal(false);

/** Last import error messages */
const importErrors = signal<string[]>([]);

const imageCount = computed(() => images.value.length);
const poolSize = computed(() => fullResLoaded.value.size);

export const imageStore = {
  images,
  fullResLoaded,
  isImporting,
  importErrors,
  imageCount,
  poolSize,

  /** Import images from file paths via Rust backend */
  async importFiles(paths: string[], projectDir: string) {
    if (paths.length === 0) return;

    isImporting.value = true;
    importErrors.value = [];

    try {
      const result = await ipcImportImages(paths, projectDir);
      if (!result.ok) {
        importErrors.value = [result.error];
        return;
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
    } finally {
      isImporting.value = false;
    }
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

  /** Update image paths after project dir migration (temp -> real project) */
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
      fullResLoaded.value = new Map();
      isImporting.value = false;
      importErrors.value = [];
    });
  },
};
