import { signal } from '@preact/signals';
import { getTheme, setThemePreference } from './appConfig';

export type Theme = 'dark' | 'medium' | 'light';
const THEMES: Theme[] = ['dark', 'medium', 'light'];

export const currentTheme = signal<Theme>('dark');

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme.value = theme;
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
