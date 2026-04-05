import { LazyStore } from '@tauri-apps/plugin-store';

/** Singleton store for paint preferences -- persists as JSON in Tauri app data dir */
const store = new LazyStore('paint-preferences.json');

export async function saveBrushColor(color: string): Promise<void> {
  await store.set('brushColor', color);
}

export async function loadBrushColor(): Promise<string> {
  return (await store.get<string>('brushColor')) ?? '#000000';
}

export async function saveBrushSize(size: number): Promise<void> {
  await store.set('brushSize', size);
}

export async function loadBrushSize(): Promise<number> {
  return (await store.get<number>('brushSize')) ?? 4;
}

export async function savePaintMode(mode: string): Promise<void> {
  await store.set('activePaintMode', mode);
}

export async function loadPaintMode(): Promise<string> {
  return (await store.get<string>('activePaintMode')) ?? 'flat';
}

/** Load all brush preferences at once */
export async function loadBrushPreferences(): Promise<{color: string; size: number}> {
  const [color, size] = await Promise.all([loadBrushColor(), loadBrushSize()]);
  return { color, size };
}
