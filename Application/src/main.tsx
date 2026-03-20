import './index.css';
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {startAutoSave} from './lib/autoSave';
import {guardUnsavedChanges} from './lib/unsavedGuard';
import {mountShortcuts, handleSave, handleNewProject, handleOpenProject, handleCloseProject} from './lib/shortcuts';
import {undo, redo} from './lib/history';
import {canvasStore} from './stores/canvasStore';
import {uiStore} from './stores/uiStore';
import {timelineStore} from './stores/timelineStore';

// Resolve temp project dir from Tauri's app data path before rendering
initTempProjectDir().then(async () => {
  const { initTheme } = await import('./lib/themeManager');
  await initTheme();
  render(<App />, document.getElementById('app')!);
  startAutoSave();
  mountShortcuts(); // Mount keyboard shortcuts globally

  // Listen for undo/redo events emitted by the native macOS menu.
  // On macOS, Cmd+Z and Cmd+Shift+Z are intercepted by the native menu
  // accelerators before keydown reaches the webview, so these menu event
  // listeners are the sole path for undo/redo on that platform.
  listen('menu:undo', () => { undo(); });
  listen('menu:redo', () => { redo(); });

  // Listen for zoom events emitted by the native macOS View menu.
  // Zoom in/out now use bare = / - keys via tinykeys (no Cmd modifier),
  // so the menu items have no accelerator. These listeners handle the
  // click path when users select Zoom In / Zoom Out from the View menu.
  // Fit to Window (Cmd+0) still uses a native accelerator.
  listen('menu:zoom-in', () => {
    if (uiStore.mouseRegion.peek() === 'timeline') {
      timelineStore.zoomIn();
    } else {
      canvasStore.zoomIn();
    }
  });
  listen('menu:zoom-out', () => {
    if (uiStore.mouseRegion.peek() === 'timeline') {
      timelineStore.zoomOut();
    } else {
      canvasStore.zoomOut();
    }
  });
  listen('menu:fit-to-window', () => { canvasStore.fitToWindow(); });

  // Listen for File menu events emitted by the native macOS File menu.
  // On macOS, Cmd+N/O/S/W are intercepted by the native menu accelerators
  // before keydown reaches the webview, so these listeners are the sole path
  // for file operations on that platform (same pattern as Edit > Undo/Redo).
  listen('menu:new-project', () => { handleNewProject(); });
  listen('menu:open-project', () => { handleOpenProject(); });
  listen('menu:save-project', () => { handleSave(); });
  listen('menu:close-project', () => { handleCloseProject(); });

  // Guard window close: show unsaved-changes dialog and prevent close on Cancel
  getCurrentWindow().onCloseRequested(async (event) => {
    const result = await guardUnsavedChanges();
    if (result === 'cancelled') {
      event.preventDefault();
    }
  });
});
