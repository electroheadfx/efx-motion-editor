import './index.css';
import {render} from 'preact';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {startAutoSave} from './lib/autoSave';

// Resolve temp project dir from Tauri's app data path before rendering
initTempProjectDir().then(() => {
  render(<App />, document.getElementById('app')!);
  startAutoSave();
});
