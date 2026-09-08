import {effect} from '@preact/signals';
import {projectStore} from '../stores/projectStore';
import {sequenceStore} from '../stores/sequenceStore';
import {imageStore} from '../stores/imageStore';
import {efxPaintVersion} from '../stores/efxPaintStore';
import {physicPaintVersion} from '../stores/physicPaintStore';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let disposed = false;
// 52.1 (a1): the expensive document re-serialize is only warranted by new paint
// content, so a save is skipped when neither paint version has moved since the
// last save. nonPaintDirty tracks non-paint mutations (name/fps/dimensions/
// sequences/images) so those still persist without a paint-version bump.
let lastSavedEfxPaintVersion = -1;
let lastSavedPhysicPaintVersion = -1;
let nonPaintDirty = false;

function paintVersionsChanged(): boolean {
  return efxPaintVersion.value !== lastSavedEfxPaintVersion || physicPaintVersion.value !== lastSavedPhysicPaintVersion;
}

function recordSaved(): void {
  lastSavedEfxPaintVersion = efxPaintVersion.value;
  lastSavedPhysicPaintVersion = physicPaintVersion.value;
  nonPaintDirty = false;
}

function scheduleSave() {
  if (disposed) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (projectStore.filePath.value && projectStore.isDirty.value && (paintVersionsChanged() || nonPaintDirty)) {
      void projectStore.saveProject({ skipPaintFlush: true }).then(recordSaved);
    }
  }, 2000); // 2-second debounce
}

let disposeEffect: (() => void) | null = null;
let disposePaintEffect: (() => void) | null = null;

/** Start auto-save watchers. Idempotent: stops existing watchers before starting new ones. */
export function startAutoSave(): void {
  // Guard: stop existing watchers to prevent duplicate timer accumulation
  if (disposeEffect || disposePaintEffect) {
    stopAutoSave();
  }
  disposed = false;

  // Watch for non-paint project changes (name/fps/dimensions/sequences/images).
  disposeEffect = effect(() => {
    projectStore.name.value;
    projectStore.fps.value;
    projectStore.width.value;
    projectStore.height.value;
    sequenceStore.sequences.value;
    imageStore.images.value;
    nonPaintDirty = true;
    scheduleSave();
  });

  // 47-01: EFX Paint document mutations (track CRUD) and physic paint runtime
  // mutations (paint strokes, Roto edits) must also re-schedule the debounced
  // save — without these subscriptions a painted stroke or a new track waits
  // for the 60s safety-net interval before persisting.
  disposePaintEffect = effect(() => {
    efxPaintVersion.value;
    physicPaintVersion.value;
    scheduleSave();
  });

  // Periodic save every 60 seconds as safety net
  intervalId = setInterval(() => {
    if (projectStore.filePath.value && projectStore.isDirty.value && (paintVersionsChanged() || nonPaintDirty)) {
      void projectStore.saveProject({ skipPaintFlush: true }).then(recordSaved);
    }
  }, 60_000);
}

/** Stop auto-save watchers. Call on app shutdown or project close. */
export function stopAutoSave(): void {
  disposed = true;
  if (disposeEffect) {
    disposeEffect();
    disposeEffect = null;
  }
  if (disposePaintEffect) {
    disposePaintEffect();
    disposePaintEffect = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}
