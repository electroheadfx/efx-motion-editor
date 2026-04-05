import { LazyStore } from '@tauri-apps/plugin-store';

const store = new LazyStore('app-config.json');

export interface BrushPreferences {
  color: string;
  size: number;
}

export async function loadBrushPreferences(): Promise<BrushPreferences> {
  const color = await store.get<string>('brushColor') ?? '#203769';
  const size = await store.get<number>('brushSize') ?? 35;
  return { color, size };
}

export async function saveBrushColor(color: string): Promise<void> {
  await store.set('brushColor', color);
}

export async function saveBrushSize(size: number): Promise<void> {
  await store.set('brushSize', size);
}

export async function loadRecentColors(): Promise<string[]> {
  return (await store.get<string[]>('recentColors')) ?? [];
}

export async function saveRecentColors(colors: string[]): Promise<void> {
  await store.set('recentColors', colors.slice(0, 16));
}

export async function loadFavoriteColors(): Promise<string[]> {
  return (await store.get<string[]>('favoriteColors')) ?? [];
}

export async function saveFavoriteColors(colors: string[]): Promise<void> {
  await store.set('favoriteColors', colors);
}
