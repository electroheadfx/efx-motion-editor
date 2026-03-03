import './index.css';
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {startAutoSave} from './lib/autoSave';
import {guardUnsavedChanges} from './lib/unsavedGuard';

// Resolve temp project dir from Tauri's app data path before rendering
initTempProjectDir().then(() => {
  render(<App />, document.getElementById('app')!);
  startAutoSave();

  // Guard window close: show unsaved-changes dialog and prevent close on Cancel
  getCurrentWindow().onCloseRequested(async (event) => {
    const result = await guardUnsavedChanges();
    if (result === 'cancelled') {
      event.preventDefault();
    }
  });
});
