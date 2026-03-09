import {tinykeys} from 'tinykeys';
import {playbackEngine} from './playbackEngine';
import {pressJ, pressK, pressL} from './jklShuttle';
import {undo, redo} from './history';
import {guardUnsavedChanges} from './unsavedGuard';
import {projectStore} from '../stores/projectStore';
import {uiStore} from '../stores/uiStore';
import {layerStore} from '../stores/layerStore';
import {save, open} from '@tauri-apps/plugin-dialog';

/**
 * Check whether a keyboard shortcut should be suppressed because the user
 * is typing in a form element or contentEditable region.
 */
function shouldSuppressShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;

  return false;
}

// --- Internal handler functions ---

async function handleSave(): Promise<void> {
  if (projectStore.isSaving.value) return;

  if (!projectStore.filePath.value) {
    // Never saved — open Save As picker
    const filePath = await save({
      filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
      defaultPath: `${projectStore.name.value}.mce`,
    });
    if (filePath) {
      try {
        await projectStore.saveProjectAs(filePath);
      } catch (err) {
        console.error('Failed to save project:', err);
      }
    }
  } else {
    try {
      await projectStore.saveProject();
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  }
}

async function handleNewProject(): Promise<void> {
  const guard = await guardUnsavedChanges();
  if (guard === 'cancelled') return;
  uiStore.showNewProjectDialog.value = true;
}

async function handleOpenProject(): Promise<void> {
  const guard = await guardUnsavedChanges();
  if (guard === 'cancelled') return;

  const selected = await open({
    multiple: false,
    filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
  });
  if (selected && typeof selected === 'string') {
    try {
      await projectStore.openProject(selected);
    } catch (err) {
      console.error('Failed to open project:', err);
    }
  }
}

function handleDelete(): void {
  // Delete selected layer if any
  const selectedLayer = uiStore.selectedLayerId.value;
  if (selectedLayer) {
    layerStore.remove(selectedLayer);
    uiStore.selectLayer(null);
    return;
  }
  // Key photo deletion from keyboard will be refined when key photo
  // selection state is added in Phase 6. For now, no-op if nothing selected.
}

// --- Mount shortcuts ---

/**
 * Mount all keyboard shortcuts globally via tinykeys.
 * Returns the unsubscribe function (typically not needed — shortcuts remain
 * active for the lifetime of the app).
 */
export function mountShortcuts(): () => void {
  return tinykeys(window, {
    // Playback (KEY-01, KEY-02)
    'Space': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault(); // Prevent page scroll (Pitfall 6)
      playbackEngine.toggle();
    },
    'ArrowLeft': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      playbackEngine.stepBackward();
    },
    'ArrowRight': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      playbackEngine.stepForward();
    },

    // JKL Scrub (KEY-03)
    'KeyJ': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      pressJ();
    },
    'KeyK': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      pressK();
    },
    'KeyL': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      pressL();
    },

    // Undo/Redo (KEY-04)
    '$mod+KeyZ': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      undo();
    },
    '$mod+Shift+KeyZ': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      redo();
    },

    // File operations (KEY-05)
    '$mod+KeyS': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      handleSave();
    },
    '$mod+KeyN': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      handleNewProject();
    },
    '$mod+KeyO': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      handleOpenProject();
    },

    // Delete (KEY-06)
    'Backspace': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      handleDelete();
    },
    'Delete': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      handleDelete();
    },

    // Shortcuts overlay (KEY-08)
    'Shift+?': (e: KeyboardEvent) => {
      // ? key -- uses event.key matching for layout-independent binding
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      uiStore.toggleShortcutsOverlay();
    },
  });
}
