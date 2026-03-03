import {effect} from '@preact/signals';
import {projectStore} from '../stores/projectStore';
import {sequenceStore} from '../stores/sequenceStore';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let disposed = false;

function scheduleSave() {
  if (disposed) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (projectStore.filePath.value && projectStore.isDirty.value) {
      projectStore.saveProject();
    }
  }, 2000); // 2-second debounce
}

let disposeEffect: (() => void) | null = null;

/** Start auto-save watchers. Call once after app initializes. */
export function startAutoSave(): void {
  disposed = false;

  // Watch for meaningful store changes (effect auto-subscribes to accessed signals)
  disposeEffect = effect(() => {
    // Access signals to subscribe
    projectStore.name.value;
    projectStore.fps.value;
    projectStore.width.value;
    projectStore.height.value;
    sequenceStore.sequences.value;
    // Trigger debounced save
    scheduleSave();
  });

  // Periodic save every 60 seconds as safety net
  intervalId = setInterval(() => {
    if (projectStore.filePath.value && projectStore.isDirty.value) {
      projectStore.saveProject();
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
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}
