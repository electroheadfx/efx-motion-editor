import {appDataDir} from '@tauri-apps/api/path';
import {signal} from '@preact/signals';

/** Resolved temp project directory (within Tauri's app data, accessible by asset protocol) */
export const tempProjectDir = signal<string | null>(null);

/** Initialize the temp project directory from Tauri's app data path */
export async function initTempProjectDir(): Promise<void> {
  const base = await appDataDir();
  tempProjectDir.value = `${base}temp-project`;
}
