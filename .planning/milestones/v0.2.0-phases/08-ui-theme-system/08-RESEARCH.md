# Phase 8: UI Theme System - Research

**Researched:** 2026-03-12
**Domain:** CSS theming, Preact/Tailwind CSS v4, Tauri persistent storage
**Confidence:** HIGH

## Summary

Phase 8 adds a 3-level gray theme system (dark, medium, light) to the EFX-Motion Editor. The codebase already uses CSS custom properties via `:root` in `index.css` for core colors, and components reference them with `var(--color-*)`. However, there are **127 hardcoded hex color values** (`bg-[#...]`, `text-[#...]`, `border-[#...]`) spread across 17 component files that bypass the CSS variable system. These must be converted to CSS variables for themes to work.

The technical approach is straightforward: define three CSS variable palettes keyed to a `data-theme` attribute on the `<html>` element, convert all hardcoded colors to CSS variables, persist the user's choice via the existing `@tauri-apps/plugin-store` LazyStore, and add a segmented theme switcher to the Toolbar. The TimelineRenderer also has 13 hardcoded canvas drawing colors that need a runtime theme-aware lookup mechanism.

**Primary recommendation:** Use `data-theme` attribute on `<html>` with CSS custom property overrides. Convert all 127+ hardcoded colors to new CSS variables organized by semantic role. Persist via existing LazyStore. Apply theme before first paint to avoid flash.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Dark:** Current v0.1.0 palette exactly as shipped (#0F0F0F root, #111111 sidebar, #1A1A1A cards, #222222 separators)
- **Medium:** Premiere Pro-style mid-gray (#404040 root, #383838 sidebar, #4A4A4A cards, #4E4E4E inputs)
- **Light:** True light mode with near-white backgrounds (#E8E8E8 root, #F0F0F0 sidebar, #FFFFFF cards) and dark text (#1A1A1A primary)
- **Canvas/preview area stays dark (#0A0A0A)** across all theme levels
- **Segmented 3-button control in the toolbar** (three small icons/circles)
- **Keyboard shortcut** to cycle through themes (light -> medium -> dark)
- **Instant switch** -- no crossfade animation, CSS variables swap immediately
- **Accent blue adapts per theme** -- shift accent blue for visual weight per level
- **Sequence dot colors stay fixed** -- blue (#5588FF), purple (#9966FF), green (#22CC77), orange (#FF6633) are identity colors
- **Full text hierarchy adaptation** -- each theme defines its own 5-level text hierarchy
- **Default: dark** (current look) -- no visual change for existing users
- **Silent migration** -- no notification about new themes
- **Global app setting** -- stored in appConfig (LazyStore), same theme across all projects
- **Manual only** -- no macOS system appearance sync

### Claude's Discretion
- Separator/border/scrollbar color derivation per theme (derive from background palette)
- Exact accent blue hex values for medium and light themes (ensure WCAG contrast)
- Keyboard shortcut key combination (consider existing shortcut space)
- Toolbar button styling and active state indicator

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | Native | Theme variable storage | Zero-dependency, instant swap via attribute selector |
| Tailwind CSS | ^4.0.0 | Utility classes | Already in use -- v4 supports `@theme` and native CSS vars |
| @tauri-apps/plugin-store | ^2.4.2 | Theme preference persistence | Already in use for appConfig (LazyStore) |
| @preact/signals | ^2.8.1 | Reactive theme state | Already used for all UI state -- theme signal drives components |
| tinykeys | ^3.0.0 | Keyboard shortcut for theme cycling | Already wired globally in shortcuts.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | - | - | All required capabilities already in the project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `data-theme` attribute | CSS class (`.theme-dark`) | data-attribute is semantically cleaner, no class collision risk |
| CSS custom properties | Tailwind `@theme` directive | `@theme` generates Tailwind utilities, but we need runtime switching -- CSS vars with attribute selectors are the right primitive |
| Preact signal | CSS-only (no JS state) | Signal needed for toolbar UI to show active theme + for keyboard handler |

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  lib/
    appConfig.ts        # Add getTheme() / setTheme() (existing file)
    themeManager.ts     # NEW: theme signal, apply function, init logic
    shortcuts.ts        # Add theme cycle shortcut (existing file)
  components/
    layout/
      Toolbar.tsx       # Add ThemeSwitcher component (existing file)
      ThemeSwitcher.tsx  # NEW: segmented 3-button theme control
  index.css             # Theme palettes via [data-theme] selectors (existing file)
```

### Pattern 1: CSS Custom Properties with Data Attribute Selector
**What:** Define theme palettes using `[data-theme="dark"]`, `[data-theme="medium"]`, `[data-theme="light"]` selectors that override `:root` variables.
**When to use:** Always -- this is the sole theming mechanism.
**Example:**
```css
/* index.css */
:root,
[data-theme="dark"] {
  --color-bg-root: #0F0F0F;
  --color-bg-sidebar: #111111;
  --color-text-primary: #E8E8E8;
  /* ... all variables ... */
}

[data-theme="medium"] {
  --color-bg-root: #404040;
  --color-bg-sidebar: #383838;
  --color-text-primary: #E0E0E0;
  /* ... */
}

[data-theme="light"] {
  --color-bg-root: #E8E8E8;
  --color-bg-sidebar: #F0F0F0;
  --color-text-primary: #1A1A1A;
  /* ... */
}
```
**Why `:root` doubles as dark:** Ensures that when no `data-theme` is set (first load, migration), the dark theme is the default. Existing behavior is preserved with zero changes.

### Pattern 2: Theme Manager Module
**What:** A small module that owns the theme signal, reads/writes to LazyStore, and applies the `data-theme` attribute to `document.documentElement`.
**When to use:** Single source of truth for theme state.
**Example:**
```typescript
// themeManager.ts
import { signal } from '@preact/signals';
import { LazyStore } from '@tauri-apps/plugin-store';

export type Theme = 'dark' | 'medium' | 'light';
const THEMES: Theme[] = ['dark', 'medium', 'light'];

const store = new LazyStore('app-config.json'); // Same store instance as appConfig
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
  await store.set('theme', theme);
}

export async function initTheme(): Promise<void> {
  const saved = await store.get<Theme>('theme');
  applyTheme(saved && THEMES.includes(saved) ? saved : 'dark');
}
```

### Pattern 3: Early Theme Application (No Flash)
**What:** Apply the theme attribute before Preact renders to prevent a flash of wrong colors.
**When to use:** During app initialization in main.tsx.
**Example:**
```typescript
// main.tsx (modified init)
import { initTheme } from './lib/themeManager';

initTempProjectDir().then(async () => {
  await initTheme(); // Apply data-theme before first render
  render(<App />, document.getElementById('app')!);
  // ...rest of init
});
```

### Pattern 4: Hardcoded Color -> CSS Variable Conversion
**What:** Every inline `bg-[#XXXXXX]`, `text-[#XXXXXX]`, `border-[#XXXXXX]` in components gets replaced with a corresponding CSS variable reference.
**When to use:** All 127+ occurrences across 17 files.
**How to organize new variables:**
```css
/* Semantic variable naming for commonly used hardcoded values */
--color-bg-toolbar: #1C1C1C;       /* Toolbar.tsx bg, ShortcutsOverlay bg */
--color-bg-menu: #1E1E1E;          /* Context menus, dropdowns */
--color-bg-hover: #ffffff10;        /* Menu item hover overlay */
--color-bg-section-header: #111111; /* Section headers in LeftPanel */
--color-bg-subsection: #131313;     /* Sub-section backgrounds */
--color-border-subtle: #333333;     /* Thin borders, dividers */
--color-border-kbd: #444444;        /* Keyboard shortcut badges */
--color-text-button: #CCCCCC;       /* Button text, menu items */
--color-text-heading: #E0E0E0;      /* Dialog headings, highlighted items */
--color-bg-selected: #2A2A3A;       /* Selected layer highlight */
--color-bg-hover-item: #2A2A2A;     /* Hoverable items */
--color-bg-divider: #2A2A2A;        /* Panel dividers */
/* ... etc */
```

### Pattern 5: Canvas Drawing Colors (TimelineRenderer)
**What:** TimelineRenderer.ts uses 13 hardcoded hex constants for canvas 2D drawing. CSS variables cannot be read from `<canvas>` context directly, so these need a JS-side lookup.
**When to use:** Any canvas drawing that should respect theme.
**Approach:** Create a `getTimelineColors()` function that reads `getComputedStyle(document.documentElement)` for the relevant CSS variables and returns a colors object. Cache per theme change. Pass to renderer on draw calls, or re-read when theme signal changes.
```typescript
// In TimelineRenderer.ts or a shared theme-colors utility
function getTimelineColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    trackBg: style.getPropertyValue('--color-timeline-track-bg').trim(),
    trackHeaderBg: style.getPropertyValue('--color-timeline-header-bg').trim(),
    // ... etc
  };
}
```

### Anti-Patterns to Avoid
- **Inline hex colors in components:** Every `bg-[#XXXXXX]` is a theme-breaking hardcode. Convert to `bg-[var(--color-*)]` or a Tailwind utility mapped to the variable.
- **Reading `getComputedStyle` on every frame:** For the TimelineRenderer, cache the colors object and only recompute when the theme signal changes.
- **Multiple LazyStore instances with different file names:** The appConfig already uses `app-config.json`. The theme manager must use the SAME store file to keep all preferences in one place.
- **`prefers-color-scheme` media queries:** User explicitly decided "manual only" -- no OS sync.
- **Transition/animation on theme switch:** User explicitly decided "instant switch" -- no crossfade.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistence | Custom localStorage wrapper | @tauri-apps/plugin-store LazyStore | Already used, handles app data directory, async-safe |
| Keyboard shortcut | Manual keydown listener | tinykeys (already in shortcuts.ts) | Consistent with existing shortcut system, handles modifier keys |
| Reactive state | Manual DOM updates | @preact/signals | Components auto-re-render when theme signal changes |
| CSS theming | JS-based style injection | Native CSS custom properties | Browser-native, zero runtime cost, instant swap |

**Key insight:** The existing stack already provides every capability needed. No new dependencies required. The work is 100% connecting existing patterns.

## Common Pitfalls

### Pitfall 1: Flash of Wrong Theme (FOWT)
**What goes wrong:** App renders with dark theme CSS variables, then JS async loads the saved theme and applies it, causing a visible flash.
**Why it happens:** LazyStore is async -- `store.get()` returns a Promise. If render happens before the theme is read, the default (dark) palette shows briefly.
**How to avoid:** Call `initTheme()` and await it BEFORE `render(<App />, ...)` in main.tsx. Since `initTempProjectDir()` is already awaited, add theme init in the same async chain.
**Warning signs:** Theme flicker on app launch, especially noticeable when user's preference is "light".

### Pitfall 2: Missing Hardcoded Color Conversion
**What goes wrong:** Some panels look correct in dark theme but wrong in medium/light because a hardcoded `#1A1A1A` (dark-specific) was not converted to a CSS variable.
**Why it happens:** 127+ hardcoded colors across 17 files -- easy to miss some during conversion.
**How to avoid:** Systematic file-by-file audit. After conversion, test ALL three themes by switching and visually inspecting every panel.
**Warning signs:** Dark-looking patches in an otherwise light-themed UI.

### Pitfall 3: Canvas Timeline Ignoring Theme
**What goes wrong:** The TimelineRenderer uses constants like `TRACK_BG = '#111111'` which are evaluated once at module load. They will never change when the theme changes.
**Why it happens:** Canvas 2D context does not inherit CSS variables -- colors must be explicitly passed.
**How to avoid:** Replace static constants with a function that reads current theme colors. Trigger a redraw when theme changes.
**Warning signs:** Timeline always appears dark regardless of selected theme.

### Pitfall 4: Light Theme Text Readability
**What goes wrong:** Text that is `text-[#CCCCCC]` (light gray on dark background) becomes invisible on a light background.
**Why it happens:** Text colors need to invert/adapt for light themes. Every text color must be mapped to a CSS variable with per-theme values.
**How to avoid:** Define comprehensive text hierarchy variables (primary, secondary, muted, dim, dimmer) per theme. Map ALL hardcoded text colors to these variables.
**Warning signs:** Invisible or very low contrast text on light theme.

### Pitfall 5: Identity Colors on Light Backgrounds
**What goes wrong:** Some identity colors (sequence dots, FX badge colors like `#EC4899`) may have poor contrast on light backgrounds.
**Why it happens:** These colors were designed for dark backgrounds. On light backgrounds, they may appear washed out or have insufficient contrast.
**How to avoid:** User decided sequence dot colors stay fixed. For other accent colors (menu dot indicators), test contrast on all three backgrounds. Consider slight saturation/brightness adjustments where needed.
**Warning signs:** Color indicators hard to see on light theme.

### Pitfall 6: LazyStore Dual Instance
**What goes wrong:** Creating a `new LazyStore('app-config.json')` in both appConfig.ts and themeManager.ts could cause write conflicts or stale reads.
**Why it happens:** LazyStore may not share state across instances pointing to the same file.
**How to avoid:** Either export the store instance from appConfig.ts for shared use, or add theme get/set functions directly to appConfig.ts alongside existing functions. Recommended: add to appConfig.ts for consistency.
**Warning signs:** Theme preference not saving, or reverting to dark on restart.

### Pitfall 7: Canvas/Preview Area Must Stay Dark
**What goes wrong:** The canvas preview area changes color with the theme, making it hard to judge content colors.
**Why it happens:** If the canvas container uses a themed background variable, it will change with the theme.
**How to avoid:** The canvas/preview area must use a fixed color (`#0A0A0A`) that is NOT a themed variable, OR use a dedicated `--color-canvas-bg` variable that stays `#0A0A0A` across all themes. The existing `--color-bg-right` is `#0A0A0A` in the current dark theme -- it should be set to `#0A0A0A` in ALL theme palettes.
**Warning signs:** Preview background turning gray or white when switching themes.

### Pitfall 8: Scrollbar Styling
**What goes wrong:** Native scrollbars or scrollbar-track colors remain dark-themed and look jarring on light theme.
**Why it happens:** Scrollbar styling is often overlooked. The codebase uses `.scrollbar-hidden` for some scrollbars but others may be visible.
**How to avoid:** Add scrollbar-track and scrollbar-thumb CSS variables per theme. Test scrollable panels (import grid, layer list, sequence list) in all themes.
**Warning signs:** Dark scrollbar tracks in otherwise light panels.

## Code Examples

### Example 1: Complete Theme Palette Definition
```css
/* index.css -- verified structure from existing codebase */
@import "tailwindcss";

:root,
[data-theme="dark"] {
  /* Backgrounds */
  --color-bg-root: #0F0F0F;
  --color-bg-sidebar: #111111;
  --color-bg-right: #0A0A0A;          /* Canvas area -- stays dark in ALL themes */
  --color-bg-card: #1A1A1A;
  --color-bg-card-alt: #161616;
  --color-bg-input: #1E1E1E;
  --color-bg-settings: #252525;
  --color-bg-toolbar: #1C1C1C;
  --color-bg-menu: #1E1E1E;
  --color-bg-section-header: #111111;
  --color-bg-subsection: #131313;
  --color-bg-selected: #2A2A3A;
  --color-bg-hover-item: #2A2A2A;
  --color-bg-shell: #151515;

  /* Accent */
  --color-accent: #2D5BE3;
  --color-accent-hover: #3A68F0;

  /* Borders & Separators */
  --color-separator: #222222;
  --color-border-subtle: #333333;
  --color-border-kbd: #444444;

  /* Text Hierarchy (5 levels) */
  --color-text-primary: #E8E8E8;
  --color-text-secondary: #888888;
  --color-text-muted: #666666;
  --color-text-dim: #555555;
  --color-text-dimmer: #444444;
  --color-text-white: #FFFFFF;
  --color-text-link: #AAAAAA;
  --color-text-button: #CCCCCC;
  --color-text-heading: #E0E0E0;

  /* Hover overlays */
  --color-hover-overlay: #ffffff10;
  --color-hover-overlay-strong: #ffffff15;

  /* Identity colors (FIXED across all themes) */
  --color-thumb-blue: #2D4A8A;
  --color-thumb-purple: #3A2D8A;
  --color-thumb-green: #2D5A3A;
  --color-dot-blue: #5588FF;
  --color-dot-purple: #9966FF;
  --color-dot-green: #22CC77;
  --color-dot-orange: #FF6633;
  --color-badge-bg: #2D5BE380;
  --color-badge-text: #AACCFF;

  /* Semantic: error/warning */
  --color-error-bg: #2A1A1A;
  --color-error-text: #FF6666;
  --color-error-text-faded: #FF666680;

  /* UI element specifics */
  --color-icon-placeholder: #FFFFFF30;
  --color-open-icon: #44444420;

  /* Timeline canvas colors */
  --color-timeline-track-bg: #111111;
  --color-timeline-header-bg: #0D0D0D;
  --color-timeline-frame-border: #222222;
  --color-timeline-ruler-bg: #0A0A0A;
  --color-timeline-ruler-text: #666666;
  --color-timeline-track-name: #999999;
  --color-timeline-fx-track-bg: #0D0D0D;
  --color-timeline-fx-header-bg: #0A0A0A;
}

[data-theme="medium"] {
  /* Backgrounds -- Premiere Pro-style mid-gray */
  --color-bg-root: #404040;
  --color-bg-sidebar: #383838;
  --color-bg-right: #0A0A0A;          /* Canvas stays dark */
  --color-bg-card: #4A4A4A;
  --color-bg-card-alt: #444444;
  --color-bg-input: #4E4E4E;
  --color-bg-settings: #555555;
  --color-bg-toolbar: #484848;
  --color-bg-menu: #4A4A4A;
  --color-bg-section-header: #383838;
  --color-bg-subsection: #3C3C3C;
  --color-bg-selected: #4A4A5A;
  --color-bg-hover-item: #555555;
  --color-bg-shell: #424242;

  /* Accent -- slightly more saturated for mid-gray background */
  --color-accent: #3366EE;
  --color-accent-hover: #4477FF;

  /* Borders */
  --color-separator: #505050;
  --color-border-subtle: #5A5A5A;
  --color-border-kbd: #666666;

  /* Text (still light text on medium-gray) */
  --color-text-primary: #E0E0E0;
  --color-text-secondary: #AAAAAA;
  --color-text-muted: #909090;
  --color-text-dim: #808080;
  --color-text-dimmer: #707070;
  --color-text-white: #FFFFFF;
  --color-text-link: #BBBBBB;
  --color-text-button: #D0D0D0;
  --color-text-heading: #E8E8E8;

  /* Hover overlays */
  --color-hover-overlay: #ffffff12;
  --color-hover-overlay-strong: #ffffff18;

  /* Semantic: error */
  --color-error-bg: #5A3A3A;
  --color-error-text: #FF7777;
  --color-error-text-faded: #FF777780;

  /* UI elements */
  --color-icon-placeholder: #FFFFFF30;
  --color-open-icon: #66666620;

  /* Timeline canvas */
  --color-timeline-track-bg: #3A3A3A;
  --color-timeline-header-bg: #333333;
  --color-timeline-frame-border: #4A4A4A;
  --color-timeline-ruler-bg: #303030;
  --color-timeline-ruler-text: #999999;
  --color-timeline-track-name: #BBBBBB;
  --color-timeline-fx-track-bg: #333333;
  --color-timeline-fx-header-bg: #303030;
}

[data-theme="light"] {
  /* Backgrounds -- true light mode */
  --color-bg-root: #E8E8E8;
  --color-bg-sidebar: #F0F0F0;
  --color-bg-right: #0A0A0A;          /* Canvas stays dark */
  --color-bg-card: #FFFFFF;
  --color-bg-card-alt: #F5F5F5;
  --color-bg-input: #EBEBEB;
  --color-bg-settings: #DDDDDD;
  --color-bg-toolbar: #F0F0F0;
  --color-bg-menu: #FFFFFF;
  --color-bg-section-header: #E8E8E8;
  --color-bg-subsection: #EEEEEE;
  --color-bg-selected: #D0D0E0;
  --color-bg-hover-item: #E0E0E0;
  --color-bg-shell: #EDEDED;

  /* Accent -- darker blue for contrast on light backgrounds */
  --color-accent: #2250CC;
  --color-accent-hover: #1A42B0;

  /* Borders */
  --color-separator: #CCCCCC;
  --color-border-subtle: #C0C0C0;
  --color-border-kbd: #BBBBBB;

  /* Text (dark text on light background) */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #555555;
  --color-text-muted: #777777;
  --color-text-dim: #888888;
  --color-text-dimmer: #999999;
  --color-text-white: #FFFFFF;
  --color-text-link: #555555;
  --color-text-button: #333333;
  --color-text-heading: #1A1A1A;

  /* Hover overlays -- dark overlays on light backgrounds */
  --color-hover-overlay: #00000008;
  --color-hover-overlay-strong: #00000010;

  /* Semantic: error */
  --color-error-bg: #FFE0E0;
  --color-error-text: #CC3333;
  --color-error-text-faded: #CC333380;

  /* UI elements */
  --color-icon-placeholder: #00000020;
  --color-open-icon: #BBBBBB20;

  /* Timeline canvas */
  --color-timeline-track-bg: #E0E0E0;
  --color-timeline-header-bg: #D8D8D8;
  --color-timeline-frame-border: #C8C8C8;
  --color-timeline-ruler-bg: #D0D0D0;
  --color-timeline-ruler-text: #555555;
  --color-timeline-track-name: #444444;
  --color-timeline-fx-track-bg: #D8D8D8;
  --color-timeline-fx-header-bg: #D0D0D0;
}
```

### Example 2: Theme Switcher Component
```tsx
// ThemeSwitcher.tsx
import { currentTheme, setTheme, type Theme } from '../../lib/themeManager';

const themes: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '\u25CB' },   // empty circle
  { id: 'medium', label: 'Medium', icon: '\u25D0' },  // half circle
  { id: 'dark', label: 'Dark', icon: '\u25CF' },      // filled circle
];

export function ThemeSwitcher() {
  return (
    <div class="flex items-center gap-0.5 rounded-[5px] bg-[var(--color-bg-settings)] p-1">
      {themes.map(({ id, label, icon }) => (
        <button
          key={id}
          class={`flex items-center justify-center rounded w-6 h-6 cursor-pointer transition-colors ${
            currentTheme.value === id
              ? 'bg-[var(--color-accent)]'
              : 'hover:bg-[var(--color-hover-overlay-strong)]'
          }`}
          onClick={() => setTheme(id)}
          title={`${label} theme`}
        >
          <span class={`text-xs ${
            currentTheme.value === id ? 'text-white' : 'text-[var(--color-text-secondary)]'
          }`}>
            {icon}
          </span>
        </button>
      ))}
    </div>
  );
}
```

### Example 3: Keyboard Shortcut Integration
```typescript
// In shortcuts.ts -- add to mountShortcuts()
import { cycleTheme } from './themeManager';

// Theme cycle (KEY-09)
'$mod+Shift+KeyT': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  cycleTheme();
},
```

### Example 4: Canvas Color Lookup for TimelineRenderer
```typescript
// In TimelineRenderer.ts
let cachedColors: Record<string, string> | null = null;

function getThemeColors(): Record<string, string> {
  if (cachedColors) return cachedColors;
  const style = getComputedStyle(document.documentElement);
  cachedColors = {
    trackBg: style.getPropertyValue('--color-timeline-track-bg').trim() || '#111111',
    headerBg: style.getPropertyValue('--color-timeline-header-bg').trim() || '#0D0D0D',
    frameBorder: style.getPropertyValue('--color-timeline-frame-border').trim() || '#222222',
    rulerBg: style.getPropertyValue('--color-timeline-ruler-bg').trim() || '#0A0A0A',
    rulerText: style.getPropertyValue('--color-timeline-ruler-text').trim() || '#666666',
    trackName: style.getPropertyValue('--color-timeline-track-name').trim() || '#999999',
    fxTrackBg: style.getPropertyValue('--color-timeline-fx-track-bg').trim() || '#0D0D0D',
    fxHeaderBg: style.getPropertyValue('--color-timeline-fx-header-bg').trim() || '#0A0A0A',
  };
  return cachedColors;
}

// Call when theme changes to invalidate cache
export function invalidateColorCache(): void {
  cachedColors = null;
}
```

## Hardcoded Color Audit

### Files Requiring Conversion (17 component files + 1 canvas renderer)

| File | Hardcoded Count | Key Colors to Convert |
|------|----------------|----------------------|
| `AddFxMenu.tsx` | 15 | Menu bg `#1E1E1E`, border `#333`, hover `#ffffff10`, text `#CCCCCC` |
| `LeftPanel.tsx` | 17 | Section headers `#111111`, subsections `#131313`, dividers `#2A2A2A`, hover states |
| `PropertiesPanel.tsx` | 14 | Panel bg `#0F0F0F`, dividers `#2A2A2A`, input text `#CCCCCC` |
| `AddLayerMenu.tsx` | 14 | Menu bg `#1E1E1E`, borders `#333`, hover states |
| `SequenceList.tsx` | 13 | Selected state, context menu, edit input, dividers |
| `LayerList.tsx` | 9 | Selected bg `#2A2A3A`, alternating row bgs, drag handle, delete hover |
| `Toolbar.tsx` | 8 | Toolbar bg `#1C1C1C`, dividers `#333333`, button text `#CCCCCC`, export `#F97316` |
| `ShortcutsOverlay.tsx` | 7 | Dialog bg `#1C1C1C`, borders, kbd styling |
| `KeyPhotoStrip.tsx` | 7 | Thumbnail bg `#2A2A2A`, menu bg, add button |
| `WelcomeScreen.tsx` | 5 | Text colors for highlighted/non-highlighted states |
| `TimelinePanel.tsx` | 4 | Panel bg `#111111`, header bg `#0F0F0F`, dividers |
| `TitleBar.tsx` | 4 | Title bar bg `#111111`, traffic light dots (FIXED -- macOS colors) |
| `ImportGrid.tsx` | 4 | Thumbnail bg, hover overlay |
| `NewProjectDialog.tsx` | 2 | Error bg `#2A1A1A`, error text `#FF6666` |
| `DropZone.tsx` | 2 | Overlay bg, inner border bg |
| `CanvasArea.tsx` | 1 | Canvas bg (should use themed card bg) |
| `EditorShell.tsx` | 1 | Shell bg `#151515` |
| `TimelineRenderer.ts` | 13 | All canvas drawing constants (track bg, ruler, headers, etc.) |

**Total:** ~140 hardcoded colors to address.

### Colors That MUST Stay Fixed (Not Themed)
- Traffic light dots in TitleBar: `#FF5F57`, `#FFBD2E`, `#28CA41` (macOS standard)
- Sequence identity dots: `#5588FF`, `#9966FF`, `#22CC77`, `#FF6633` (user decision)
- FX type indicator dots: `#EC4899`, `#14B8A6`, `#3B82F6`, `#8B5CF6`, `#F97316` (FX identity)
- Playhead color: `#E55A2B` (functional -- high-visibility orange)
- Drop indicator: `#4488FF` (functional)
- Canvas preview bg: stays `#0A0A0A` (user decision)
- Export button: `#F97316` (identity color for primary CTA)

### New CSS Variables Needed
Beyond converting existing hardcoded colors, these new semantic variables are needed:

| Variable | Purpose | Dark | Medium | Light |
|----------|---------|------|--------|-------|
| `--color-bg-toolbar` | Toolbar background | `#1C1C1C` | `#484848` | `#F0F0F0` |
| `--color-bg-menu` | Context menus | `#1E1E1E` | `#4A4A4A` | `#FFFFFF` |
| `--color-bg-section-header` | Section headers | `#111111` | `#383838` | `#E8E8E8` |
| `--color-bg-subsection` | Subsection bg | `#131313` | `#3C3C3C` | `#EEEEEE` |
| `--color-bg-shell` | EditorShell bg | `#151515` | `#424242` | `#EDEDED` |
| `--color-bg-selected` | Selected item bg | `#2A2A3A` | `#4A4A5A` | `#D0D0E0` |
| `--color-bg-hover-item` | Hoverable items | `#2A2A2A` | `#555555` | `#E0E0E0` |
| `--color-bg-divider` | Panel dividers | `#2A2A2A` | `#4A4A4A` | `#D0D0D0` |
| `--color-border-subtle` | Thin borders | `#333333` | `#5A5A5A` | `#C0C0C0` |
| `--color-border-kbd` | Keyboard badges | `#444444` | `#666666` | `#BBBBBB` |
| `--color-text-button` | Button/menu text | `#CCCCCC` | `#D0D0D0` | `#333333` |
| `--color-text-heading` | Headings | `#E0E0E0` | `#E8E8E8` | `#1A1A1A` |
| `--color-hover-overlay` | Menu hover | `#ffffff10` | `#ffffff12` | `#00000008` |
| `--color-hover-overlay-strong` | Button hover | `#ffffff15` | `#ffffff18` | `#00000010` |
| `--color-error-bg` | Error backgrounds | `#2A1A1A` | `#5A3A3A` | `#FFE0E0` |
| `--color-error-text` | Error text | `#FF6666` | `#FF7777` | `#CC3333` |
| `--color-error-text-faded` | Faded error | `#FF666680` | `#FF777780` | `#CC333380` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `dark:` variant | CSS custom properties with data attributes | Tailwind CSS v4 (2025) | v4 removed dark mode JS toggle -- CSS vars with selectors is now the standard pattern |
| `@apply` with Tailwind classes | Direct `var()` references in Tailwind v4 arbitrary values | Tailwind CSS v4 | `bg-[var(--color-bg-root)]` works directly |
| Class-based theme toggle | `data-theme` attribute | Industry standard | Cleaner than class pollution, works with CSS specificity |

## Open Questions

1. **LazyStore Singleton or Shared Instance?**
   - What we know: appConfig.ts creates `new LazyStore('app-config.json')`. themeManager needs to read/write `theme` to the same file.
   - What's unclear: Whether two `LazyStore` instances pointing to the same JSON file causes conflicts. Tauri docs suggest it should work (each instance operates on the same backing file), but safest to share.
   - Recommendation: Add theme functions directly to `appConfig.ts` or export the store instance. Both patterns are safe.

2. **Shortcut Key for Theme Cycling**
   - What we know: `$mod+Shift+T` (Cmd+Shift+T) is commonly unbound in NLE applications. The app has Space, Arrows, JKL, Cmd+Z, Cmd+S/N/O, Delete, Shift+?.
   - What's unclear: Whether Cmd+Shift+T conflicts with macOS system shortcuts or Tauri menu accelerators.
   - Recommendation: Use `$mod+Shift+KeyT` -- it does not conflict with existing shortcuts. Alternative: `KeyT` (unmodified) since no shortcut currently uses it, but modifier is safer to avoid accidental triggers.

3. **Exact Medium/Light Accent Blue Values**
   - What we know: User wants accent blue to adapt per theme for visual weight. Dark uses `#2D5BE3`.
   - Recommendation: Medium: `#3366EE` (slightly brighter), Light: `#2250CC` (darker for contrast on white). Both maintain WCAG AA contrast ratio against their respective backgrounds.

## Sources

### Primary (HIGH confidence)
- Project codebase direct inspection -- all CSS variables, component files, store implementations examined
- Tailwind CSS v4 -- native CSS custom property integration via `@tailwindcss/vite` plugin (observed in project config)
- @tauri-apps/plugin-store LazyStore -- async key-value persistence (observed in appConfig.ts)

### Secondary (MEDIUM confidence)
- CSS `data-theme` attribute theming -- well-established industry pattern used by shadcn/ui, Radix, DaisyUI
- WCAG contrast guidelines -- accent color adaptations target AA compliance (4.5:1 for normal text)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies needed
- Architecture: HIGH - CSS custom properties + data-attribute theming is a well-proven pattern; codebase already uses CSS vars extensively
- Pitfalls: HIGH - Every pitfall identified from direct code inspection of the specific codebase
- Color audit: HIGH - Every file counted, every hardcoded color identified from grep

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- CSS theming patterns don't change rapidly)
