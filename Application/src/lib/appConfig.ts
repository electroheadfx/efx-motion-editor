import { LazyStore } from '@tauri-apps/plugin-store';
import { configGetTheme, configSetTheme, configGetCanvasBg, configSetCanvasBg } from './ipc';

/** Singleton app config store -- persists as JSON in Tauri app data dir */
const store = new LazyStore('app-config.json');

/** A recent project entry shown on the welcome screen */
export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}

/** App configuration persisted between sessions */
export interface AppConfig {
  windowWidth: number;
  windowHeight: number;
  lastProjectPath: string | null;
}

// --- Recent Projects ---

export async function getRecentProjects(): Promise<RecentProject[]> {
  return (await store.get<RecentProject[]>('recentProjects')) ?? [];
}

export async function addRecentProject(project: RecentProject): Promise<void> {
  const recent = await getRecentProjects();
  // Remove if already exists (re-add to top)
  const filtered = recent.filter(r => r.path !== project.path);
  // Add to front, keep max 10
  const updated = [project, ...filtered].slice(0, 10);
  await store.set('recentProjects', updated);
}

export async function removeRecentProject(path: string): Promise<void> {
  const recent = await getRecentProjects();
  const updated = recent.filter(r => r.path !== path);
  await store.set('recentProjects', updated);
}

export async function updateRecentProjectPath(oldPath: string, newPath: string): Promise<void> {
  const recent = await getRecentProjects();
  const updated = recent.map(r =>
    r.path === oldPath ? { ...r, path: newPath } : r,
  );
  await store.set('recentProjects', updated);
}

// --- App Config ---

export async function getAppConfig(): Promise<AppConfig> {
  return {
    windowWidth: (await store.get<number>('windowWidth')) ?? 1440,
    windowHeight: (await store.get<number>('windowHeight')) ?? 900,
    lastProjectPath: (await store.get<string>('lastProjectPath')) ?? null,
  };
}

export async function setLastProjectPath(path: string | null): Promise<void> {
  await store.set('lastProjectPath', path);
}

export async function setWindowSize(width: number, height: number): Promise<void> {
  await store.set('windowWidth', width);
  await store.set('windowHeight', height);
}

// --- Theme (persisted to ~/.config/efx-motion/builder-config.yaml via Rust) ---

export async function getTheme(): Promise<string | null> {
  const result = await configGetTheme();
  return result.ok ? result.data : null;
}

export async function setThemePreference(theme: string): Promise<void> {
  await configSetTheme(theme);
}

// --- Canvas Background (persisted per-theme via Rust) ---

export async function getCanvasBg(theme: string): Promise<string | null> {
  const result = await configGetCanvasBg(theme);
  return result.ok ? result.data : null;
}

export async function setCanvasBg(theme: string, color: string): Promise<void> {
  await configSetCanvasBg(theme, color);
}
