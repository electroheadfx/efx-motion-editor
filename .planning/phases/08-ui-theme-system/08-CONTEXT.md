# Phase 8: UI Theme System - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a theme system with 3 selectable gray levels (light, medium, dark) to fix the overly dark UI. Users can switch between levels via toolbar controls and the choice persists across sessions. Canvas/preview area stays dark regardless of theme. No new capabilities beyond theme switching.

</domain>

<decisions>
## Implementation Decisions

### Gray level definitions
- **Dark:** Current v0.1.0 palette exactly as shipped (#0F0F0F root, #111111 sidebar, #1A1A1A cards, #222222 separators)
- **Medium:** Premiere Pro-style mid-gray (#404040 root, #383838 sidebar, #4A4A4A cards, #4E4E4E inputs)
- **Light:** True light mode with near-white backgrounds (#E8E8E8 root, #F0F0F0 sidebar, #FFFFFF cards) and dark text (#1A1A1A primary)
- **Canvas/preview area stays dark (#0A0A0A)** across all theme levels — preserves color perception, standard NLE practice

### Theme switching UX
- **Segmented 3-button control in the toolbar** — three small icons/circles, click any to switch instantly
- **Keyboard shortcut** to cycle through themes (light → medium → dark)
- **Instant switch** — no crossfade animation, CSS variables swap immediately

### Accent & semantic colors
- **Accent blue adapts per theme** — slightly shift accent blue at each level to maintain visual weight (darker blue on lighter backgrounds for contrast)
- **Sequence dot colors stay fixed** — blue (#5588FF), purple (#9966FF), green (#22CC77), orange (#FF6633) are identity colors, same across all themes
- **Full text hierarchy adaptation** — each theme defines its own 5-level text hierarchy (dark themes use light text, light theme uses dark text, medium adjusts muted/dim values for readability)

### Default theme & persistence
- **Default: dark** (current look) — no visual change for existing users on update
- **Silent migration** — no notification or prompt about new themes; users discover the toolbar switcher organically
- **Global app setting** — stored in appConfig (LazyStore), same theme across all projects
- **Manual only** — no macOS system appearance sync

### Claude's Discretion
- Separator/border/scrollbar color derivation per theme (derive from background palette)
- Exact accent blue hex values for medium and light themes (ensure WCAG contrast)
- Keyboard shortcut key combination (consider existing shortcut space)
- Toolbar button styling and active state indicator

</decisions>

<specifics>
## Specific Ideas

- Light mode should be "true light mode" — near-white backgrounds, not just a lighter gray. Think standard light theme, not video-editor-gray.
- Medium should feel like Premiere Pro / DaVinci Resolve — classic NLE neutral workspace gray.
- Dark level is exactly the current shipped v0.1.0 look — no visual regression.
- Segmented buttons in toolbar should visually echo the concept (light circle, half-filled circle, filled circle: ○ ◐ ●).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `appConfig.ts` (LazyStore): Already persists user preferences between sessions — add `theme` key alongside existing `windowWidth`, `windowHeight`, `lastProjectPath`
- `index.css` `:root` block: All 28+ CSS variables already centralized — theme system swaps these values
- `tinykeys` keyboard shortcuts: Already wired in the app — add theme cycle shortcut alongside existing shortcuts

### Established Patterns
- CSS custom properties for all colors — components reference `var(--color-*)` via Tailwind or direct usage
- Tailwind CSS v4 with `@import "tailwindcss"` — theme variables integrate naturally
- 20 component files use Tailwind `bg-`/`text-`/`border-` classes — some may hardcode colors that need conversion to CSS vars

### Integration Points
- Toolbar component (`Toolbar.tsx`): Add segmented theme switcher control
- `index.css` `:root`: Replace single palette with theme-conditional palettes (CSS data attribute or class on `<html>`)
- `appConfig.ts`: Add theme preference read/write functions
- App initialization: Read stored theme on startup, apply before first paint

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-ui-theme-system*
*Context gathered: 2026-03-12*
