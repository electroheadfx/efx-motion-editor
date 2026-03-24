import { currentTheme, setTheme, type Theme } from '../../lib/themeManager';

const themes: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '\u25CB' },   // empty circle
  { id: 'medium', label: 'Medium', icon: '\u25D0' },  // half circle
  { id: 'dark', label: 'Dark', icon: '\u25CF' },      // filled circle
];

export function ThemeSwitcher() {
  return (
    <div class="flex items-center gap-0.5 rounded-[5px] bg-(--color-bg-settings) p-1">
      {themes.map(({ id, label, icon }) => (
        <button
          key={id}
          class={`flex items-center justify-center rounded w-6 h-6 cursor-pointer transition-colors ${
            currentTheme.value === id
              ? 'bg-(--color-accent)'
              : 'hover:bg-(--color-hover-overlay-strong)'
          }`}
          onClick={() => setTheme(id)}
          title={`${label} theme`}
        >
          <span class={`text-xs ${
            currentTheme.value === id ? 'text-white' : 'text-(--color-text-secondary)'
          }`}>
            {icon}
          </span>
        </button>
      ))}
    </div>
  );
}
