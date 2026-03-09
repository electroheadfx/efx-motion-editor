import './index.css';
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {startAutoSave} from './lib/autoSave';
import {guardUnsavedChanges} from './lib/unsavedGuard';
import {mountShortcuts} from './lib/shortcuts';
import {undo, redo} from './lib/history';

// Resolve temp project dir from Tauri's app data path before rendering
initTempProjectDir().then(() => {
  render(<App />, document.getElementById('app')!);
  startAutoSave();
  mountShortcuts(); // Mount keyboard shortcuts globally

  // Listen for undo/redo events emitted by the native macOS menu.
  // On macOS, Cmd+Z and Cmd+Shift+Z are intercepted by the native menu
  // accelerators before keydown reaches the webview, so these menu event
  // listeners are the sole path for undo/redo on that platform.
  listen('menu:undo', () => { undo(); });
  listen('menu:redo', () => { redo(); });

  // Guard window close: show unsaved-changes dialog and prevent close on Cancel
  getCurrentWindow().onCloseRequested(async (event) => {
    const result = await guardUnsavedChanges();
    if (result === 'cancelled') {
      event.preventDefault();
    }
  });
});
