---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/index.css
  - Application/src-tauri/src/commands/config.rs
  - Application/src/lib/ipc.ts
  - Application/src/lib/appConfig.ts
  - Application/src/lib/themeManager.ts
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "Canvas outside area shows dark gray instead of near-black in all themes"
    - "Each theme has a visually distinct canvas background color"
    - "Canvas background color preference persists across app restarts"
  artifacts:
    - path: "Application/src/index.css"
      provides: "Theme-aware --color-bg-right values per theme"
      contains: "--color-bg-right"
    - path: "Application/src-tauri/src/commands/config.rs"
      provides: "canvas_bg field in BuilderConfig with get/set commands"
      contains: "canvas_bg"
    - path: "Application/src/lib/themeManager.ts"
      provides: "Applies canvas_bg CSS variable override from config on theme change"
  key_links:
    - from: "Application/src/lib/themeManager.ts"
      to: "Application/src/lib/appConfig.ts"
      via: "getCanvasBg/setCanvasBg calls"
      pattern: "canvas[Bb]g"
---

<objective>
Make the canvas outside area background theme-aware with dark gray defaults instead of hardcoded near-black, and persist per-theme canvas background colors in ~/.config/efx-motion/builder-config.yaml.

Purpose: The current #0A0A0A canvas background is too dark (essentially black) and identical across all themes. Users need the canvas surround to adapt to their theme for visual consistency.
Output: Theme-aware canvas background with config persistence.
</objective>

<context>
@Application/src/index.css
@Application/src/lib/themeManager.ts
@Application/src/lib/appConfig.ts
@Application/src-tauri/src/commands/config.rs
@Application/src/lib/ipc.ts

<interfaces>
From Application/src/lib/themeManager.ts:
```typescript
export type Theme = 'dark' | 'medium' | 'light';
export const currentTheme = signal<Theme>('dark');
export function applyTheme(theme: Theme): void;
export async function setTheme(theme: Theme): Promise<void>;
export async function initTheme(): Promise<void>;
```

From Application/src/lib/appConfig.ts:
```typescript
export async function getTheme(): Promise<string | null>;
export async function setThemePreference(theme: string): Promise<void>;
```

From Application/src/lib/ipc.ts:
```typescript
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>>;
export async function configGetTheme(): Promise<Result<string | null>>;
export async function configSetTheme(theme: string): Promise<Result<null>>;
```

From Application/src-tauri/src/commands/config.rs:
```rust
#[derive(Debug, Serialize, Deserialize, Default)]
struct BuilderConfig {
    #[serde(default)]
    theme: Option<String>,
}
// Uses read_config()/write_config() pattern with atomic tmp+rename
```

CSS variable usage -- CanvasArea.tsx line 233:
```tsx
<div class="... bg-[var(--color-bg-right)]">
```

Current index.css: --color-bg-right is #0A0A0A in all three themes (dark, medium, light).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add theme-aware canvas BG defaults and Rust config commands</name>
  <files>Application/src/index.css, Application/src-tauri/src/commands/config.rs, Application/src-tauri/src/lib.rs, Application/src/lib/ipc.ts, Application/src/lib/appConfig.ts</files>
  <action>
1. **Update CSS defaults** in `Application/src/index.css`:
   - Dark theme (`--color-bg-right`): change from `#0A0A0A` to `#1A1A1A` (dark gray). Update comment to remove "stays dark in ALL themes".
   - Medium theme (`--color-bg-right`): change from `#0A0A0A` to `#2E2E2E` (medium-dark gray that contrasts with the #404040 sidebar).
   - Light theme (`--color-bg-right`): change from `#0A0A0A` to `#3A3A3A` (still dark enough to frame the canvas but distinct from near-black).

2. **Extend Rust BuilderConfig** in `Application/src-tauri/src/commands/config.rs`:
   - Add `canvas_bg` field to `BuilderConfig`: `canvas_bg: Option<HashMap<String, String>>` where keys are theme names ("dark", "medium", "light") and values are hex color strings.
   - Add `use std::collections::HashMap;` import.
   - Add `#[command] pub fn config_get_canvas_bg(theme: String) -> Option<String>` that reads config and returns canvas_bg map entry for the given theme.
   - Add `#[command] pub fn config_set_canvas_bg(theme: String, color: String) -> Result<(), String>` that does read-modify-write: reads config, inserts/updates the theme key in canvas_bg map, writes config back.

3. **Register new commands** in `Application/src-tauri/src/lib.rs`:
   - Add `config::config_get_canvas_bg` and `config::config_set_canvas_bg` to the invoke_handler.

4. **Add IPC wrappers** in `Application/src/lib/ipc.ts`:
   - Add `configGetCanvasBg(theme: string)` calling `config_get_canvas_bg`.
   - Add `configSetCanvasBg(theme: string, color: string)` calling `config_set_canvas_bg`.

5. **Add appConfig helpers** in `Application/src/lib/appConfig.ts`:
   - Import the new IPC functions.
   - Add `getCanvasBg(theme: string): Promise<string | null>` that calls configGetCanvasBg and returns the color or null.
   - Add `setCanvasBg(theme: string, color: string): Promise<void>` that calls configSetCanvasBg.
  </action>
  <verify>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</verify>
  <done>CSS variables updated with distinct dark gray values per theme. Rust config supports canvas_bg map with get/set commands. IPC and appConfig wrappers exist and compile.</done>
</task>

<task type="auto">
  <name>Task 2: Wire theme manager to apply and persist canvas BG</name>
  <files>Application/src/lib/themeManager.ts</files>
  <action>
1. **Update `applyTheme()`** in `Application/src/lib/themeManager.ts`:
   - After setting `data-theme` attribute, call `getCanvasBg(theme)` from appConfig.
   - If a custom color is returned, set `document.documentElement.style.setProperty('--color-bg-right', color)` to override the CSS default.
   - If null is returned (no custom override saved), remove any inline override with `document.documentElement.style.removeProperty('--color-bg-right')` so the CSS theme default takes effect.
   - Since applyTheme is synchronous and getCanvasBg is async, restructure: keep applyTheme synchronous for the data-theme attribute and signal update (so UI doesn't flash), then fire-and-forget the async canvas bg lookup. Create a separate `async function applyCanvasBg(theme: Theme)` that does the async config read + CSS property set/remove.
   - Call `applyCanvasBg(theme)` from within `applyTheme()` (fire-and-forget, no await needed since the CSS default is already reasonable).

2. **Update `initTheme()`**:
   - After calling `applyTheme(savedTheme)`, the canvas bg override will be applied automatically via applyCanvasBg inside applyTheme.

3. **Add `setCanvasBackground()`** export for future use:
   - `export async function setCanvasBackground(color: string): Promise<void>` that:
     - Sets `document.documentElement.style.setProperty('--color-bg-right', color)`.
     - Calls `setCanvasBg(currentTheme.value, color)` to persist for the current theme.
   - This provides the API hook for a future color picker UI.
  </action>
  <verify>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</verify>
  <done>Theme switching applies theme-appropriate canvas background. Custom canvas bg overrides are read from config on theme init/switch. A setCanvasBackground API exists for future UI integration. All three themes show visually distinct dark gray canvas backgrounds by default.</done>
</task>

</tasks>

<verification>
1. `cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit` -- no type errors
2. `cd /Users/lmarques/Dev/efx-motion-editor/Application && cargo check --manifest-path src-tauri/Cargo.toml` -- Rust compiles
3. Visual: Launch app, canvas surround should be dark gray (#1A1A1A) not near-black (#0A0A0A)
4. Visual: Cycle themes -- canvas surround should change to distinct gray for each theme
5. Config: After switching themes, check `~/.config/efx-motion/builder-config.yaml` -- should not contain canvas_bg unless user explicitly set a custom color
</verification>

<success_criteria>
- Canvas outside area is dark gray (#1A1A1A) in dark theme, not near-black (#0A0A0A)
- Each theme has a visually distinct canvas background color
- Canvas background preference can be persisted per-theme in builder-config.yaml
- TypeScript and Rust compile without errors
</success_criteria>

<output>
After completion, create `.planning/quick/8-theme-aware-background-color-for-outside/8-SUMMARY.md`
</output>
