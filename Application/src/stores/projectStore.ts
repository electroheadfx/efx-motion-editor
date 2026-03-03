import {signal, computed, batch} from '@preact/signals';
import type {ProjectData, MceProject, MceSequence, MceKeyPhoto} from '../types/project';
import type {Sequence, KeyPhoto} from '../types/sequence';
import {projectCreate, projectSave as ipcProjectSave, projectOpen as ipcProjectOpen, projectMigrateTempImages} from '../lib/ipc';
import {imageStore, _setImageMarkDirtyCallback} from './imageStore';
import {sequenceStore, _setMarkDirtyCallback} from './sequenceStore';
import {uiStore} from './uiStore';
import {tempProjectDir} from '../lib/projectDir';
import {addRecentProject, setLastProjectPath} from '../lib/appConfig';

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
      key_photos: seq.keyPhotos.map(
        (kp: KeyPhoto, kpIndex: number): MceKeyPhoto => ({
          id: kp.id,
          image_id: kp.imageId,
          hold_frames: kp.holdFrames,
          order: kpIndex,
        }),
      ),
    }),
  );

  return {
    version: 1,
    name: name.value,
    fps: fps.value,
    width: width.value,
    height: height.value,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    sequences: mceSequences,
    images: imageStore.toMceImages(projectRoot),
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
    const sortedSeqs = [...project.sequences].sort((a, b) => a.order - b.order);
    for (const mceSeq of sortedSeqs) {
      const sortedKps = [...mceSeq.key_photos].sort((a, b) => a.order - b.order);
      const seq: Sequence = {
        id: mceSeq.id,
        name: mceSeq.name,
        fps: mceSeq.fps,
        width: mceSeq.width,
        height: mceSeq.height,
        keyPhotos: sortedKps.map(
          (kp): KeyPhoto => ({
            id: kp.id,
            imageId: kp.image_id,
            holdFrames: kp.hold_frames,
          }),
        ),
      };
      sequenceStore.add(seq);
    }

    // Set first sequence as active if any exist
    if (sortedSeqs.length > 0) {
      sequenceStore.setActive(sortedSeqs[0].id);
      uiStore.selectSequence(sortedSeqs[0].id);
    }

    // 4. Clear dirty flag (just loaded)
    isDirty.value = false;
  });
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
  },

  /** Save the project to its .mce file. If filePath is null, caller should use saveProjectAs. */
  async saveProject() {
    if (isSaving.value) return; // Prevent concurrent saves
    const currentFilePath = filePath.value;
    if (!currentFilePath) return; // Cannot save without a file path

    isSaving.value = true;
    try {
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
  },

  /** Close the current project and reset all stores */
  closeProject() {
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
    uiStore.reset();
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
