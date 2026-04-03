import { signal } from '@preact/signals';
import { getTheme, setThemePreference, getCanvasBg, setCanvasBg } from './appConfig';

export type Theme = 'dark' | 'medium' | 'light';
const THEMES: Theme[] = ['dark', 'medium', 'light'];

export const currentTheme = signal<Theme>('dark');

/** Apply canvas bg override from config, or fall back to CSS theme default. */
async function applyCanvasBg(theme: Theme): Promise<void> {
  const color = await getCanvasBg(theme);
  if (color) {
    document.documentElement.style.setProperty('--color-bg-right', color);
  } else {
    document.documentElement.style.removeProperty('--color-bg-right');
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme.value = theme;
  // Fire-and-forget: async canvas bg lookup. CSS default is already reasonable.
  applyCanvasBg(theme);
}

export function cycleTheme(): void {
  const idx = THEMES.indexOf(currentTheme.value);
  const next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next);
}

export async function setTheme(theme: Theme): Promise<void> {
  applyTheme(theme);
  await setThemePreference(theme);
}

export async function initTheme(): Promise<void> {
  const saved = await getTheme();
  applyTheme(saved && THEMES.includes(saved as Theme) ? (saved as Theme) : 'dark');
}

/** Set a custom canvas background color for the current theme and persist it. */
export async function setCanvasBackground(color: string): Promise<void> {
  document.documentElement.style.setProperty('--color-bg-right', color);
  await setCanvasBg(currentTheme.value, color);
}
