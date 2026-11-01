import {effect} from '@preact/signals';
import {projectStore} from '../stores/projectStore';
import {sequenceStore} from '../stores/sequenceStore';
import {imageStore} from '../stores/imageStore';
import {efxPaintVersion} from '../stores/efxPaintStore';
import {physicPaintVersion} from '../stores/physicPaintStore';
import {clearIoFailureLatch, reportLatchedIoFailure} from './projectIoFailureDialog';
import {isStudioDraftModeActive, setStudioDraftModeReleaseHandler} from './physicPaintDraftMode';

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
  // quick-260913-05k: a save that lands re-arms the failure latch, so a later
  // failure streak shows its own modal instead of inheriting this one's silence.
  clearIoFailureLatch('save');
  lastSavedEfxPaintVersion = efxPaintVersion.value;
  lastSavedPhysicPaintVersion = physicPaintVersion.value;
  nonPaintDirty = false;
}

function scheduleSave() {
  if (disposed) return;
  // 261101-o2m (D-05, T-261101-o2m-01): an autosave uses `skipPaintFlush`, so
  // persisting mid-Draft would write the NEW script against the FROZEN
  // pre-Draft pixel sidecar. While the Studio publishes an active gate nothing
  // arms; the release handler registered in `startAutoSave` re-schedules once
  // the Studio reports a clean pixel state (or the 20s staleness belt clears a
  // dead Studio's gate — a dead webview can never wedge autosave forever).
  if (isStudioDraftModeActive()) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (projectStore.filePath.value && projectStore.isDirty.value && (paintVersionsChanged() || nonPaintDirty)) {
      if (isStudioDraftModeActive()) return;
      void projectStore.saveProject({ skipPaintFlush: true }).then(recordSaved, (error) => {
        reportLatchedIoFailure('save', error);
      });
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

  // 261101-o2m (D-05): the deferred save resumes on the Draft-off publish, not
  // before — the 2s debounce then re-arms normally. The handler is cleared in
  // `stopAutoSave` so a stopped watcher can never be resurrected.
  setStudioDraftModeReleaseHandler(() => scheduleSave());

  // Periodic save every 60 seconds as safety net
  intervalId = setInterval(() => {
    if (projectStore.filePath.value && projectStore.isDirty.value && (paintVersionsChanged() || nonPaintDirty)) {
      // Same mid-Draft hazard as the debounce body: skip, never persist over
      // the frozen pixel sidecar.
      if (isStudioDraftModeActive()) return;
      void projectStore.saveProject({ skipPaintFlush: true }).then(recordSaved, (error) => {
        reportLatchedIoFailure('save', error);
      });
    }
  }, 60_000);
}

/** Stop auto-save watchers. Call on app shutdown or project close. */
export function stopAutoSave(): void {
  disposed = true;
  setStudioDraftModeReleaseHandler(null);
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
