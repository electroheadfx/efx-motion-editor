---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src-tauri/Cargo.toml
  - Application/src-tauri/src/commands/mod.rs
  - Application/src-tauri/src/commands/config.rs
  - Application/src-tauri/src/lib.rs
  - Application/src/lib/appConfig.ts
  - Application/src/lib/ipc.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Theme preference is saved to ~/.config/efx-motion/builder-config.yaml on theme change"
    - "Theme preference is restored from builder-config.yaml on app open"
    - "If builder-config.yaml does not exist, app defaults to dark theme and creates the file on first theme change"
    - "Existing LazyStore theme key is ignored for theme persistence (other LazyStore keys like recentProjects unaffected)"
  artifacts:
    - path: "Application/src-tauri/src/commands/config.rs"
      provides: "Tauri commands for reading/writing builder-config.yaml"
      exports: ["config_get_theme", "config_set_theme"]
    - path: "Application/src/lib/ipc.ts"
      provides: "Frontend wrappers for config Tauri commands"
    - path: "Application/src/lib/appConfig.ts"
      provides: "Updated getTheme/setThemePreference using Rust commands instead of LazyStore"
  key_links:
    - from: "Application/src/lib/themeManager.ts"
      to: "Application/src/lib/appConfig.ts"
      via: "getTheme() and setThemePreference() calls"
      pattern: "getTheme|setThemePreference"
    - from: "Application/src/lib/appConfig.ts"
      to: "Application/src/lib/ipc.ts"
      via: "safeInvoke to Rust commands"
      pattern: "configGetTheme|configSetTheme"
    - from: "Application/src-tauri/src/commands/config.rs"
      to: "~/.config/efx-motion/builder-config.yaml"
      via: "serde_yaml read/write"
      pattern: "serde_yaml"
---

<objective>
Move theme preference persistence from Tauri's LazyStore (app-config.json in Tauri app data dir) to a YAML config file at ~/.config/efx-motion/builder-config.yaml. This makes the preference accessible outside Tauri and portable across projects.

Purpose: User wants theme config in a standard config location (~/.config/) as YAML, not locked inside Tauri's opaque store.
Output: Rust commands for YAML config I/O, frontend wired to use them for theme get/set.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src-tauri/Cargo.toml
@Application/src-tauri/src/lib.rs
@Application/src-tauri/src/commands/mod.rs
@Application/src-tauri/src/commands/project.rs
@Application/src/lib/appConfig.ts
@Application/src/lib/themeManager.ts
@Application/src/lib/ipc.ts

<interfaces>
<!-- Existing patterns the executor must follow -->

From Application/src/lib/ipc.ts:
```typescript
export type Result<T, E = string> = { ok: true; data: T } | { ok: false; error: E };
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>>;
```

From Application/src/lib/appConfig.ts (theme functions to replace):
```typescript
export async function getTheme(): Promise<string | null>;
export async function setThemePreference(theme: string): Promise<void>;
```

From Application/src/lib/themeManager.ts (consumers -- signatures stay the same):
```typescript
export type Theme = 'dark' | 'medium' | 'light';
export async function initTheme(): Promise<void>;  // calls getTheme()
export async function setTheme(theme: Theme): Promise<void>;  // calls setThemePreference()
```

From Application/src-tauri/src/commands/project.rs (command pattern):
```rust
use tauri::command;
#[command]
pub fn example_cmd(arg: String) -> Result<SomeType, String> { ... }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add serde_yaml and create Rust config commands</name>
  <files>
    Application/src-tauri/Cargo.toml,
    Application/src-tauri/src/commands/config.rs,
    Application/src-tauri/src/commands/mod.rs,
    Application/src-tauri/src/lib.rs
  </files>
  <action>
1. Add `serde_yaml = "0.9"` to `[dependencies]` in Cargo.toml.

2. Create `Application/src-tauri/src/commands/config.rs` with:
   - A `BuilderConfig` struct deriving Serialize, Deserialize, Default with a single field: `theme: Option<String>` (default None).
   - A helper `fn config_path() -> PathBuf` that returns `dirs::config_dir() / "efx-motion" / "builder-config.yaml"`. Use `std::env::var("HOME")` + `/.config/efx-motion/builder-config.yaml` on macOS (do NOT use dirs crate -- it maps to ~/Library/Application Support on macOS, which is wrong). Construct: `PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())).join(".config/efx-motion/builder-config.yaml")`.
   - A helper `fn read_config() -> BuilderConfig` that reads the YAML file if it exists, deserializes it, and returns Default on any error (missing file, parse error).
   - A helper `fn write_config(config: &BuilderConfig) -> Result<(), String>` that creates parent dirs if needed (`std::fs::create_dir_all`), serializes to YAML, and writes atomically (write to .tmp then rename).
   - `#[tauri::command] pub fn config_get_theme() -> Option<String>` -- calls read_config(), returns theme field.
   - `#[tauri::command] pub fn config_set_theme(theme: String) -> Result<(), String>` -- calls read_config(), sets theme field, calls write_config(). Read-modify-write so future fields in the YAML are preserved.

3. Add `pub mod config;` to `Application/src-tauri/src/commands/mod.rs`.

4. In `Application/src-tauri/src/lib.rs`:
   - Add `use commands::config;`
   - Add `config::config_get_theme` and `config::config_set_theme` to the `tauri::generate_handler![]` macro invocation.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application/src-tauri && cargo check 2>&1 | tail -5</automated>
  </verify>
  <done>Rust compiles with new config commands registered. config_get_theme and config_set_theme are available as Tauri commands.</done>
</task>

<task type="auto">
  <name>Task 2: Wire frontend theme persistence to Rust config commands</name>
  <files>
    Application/src/lib/ipc.ts,
    Application/src/lib/appConfig.ts
  </files>
  <action>
1. In `Application/src/lib/ipc.ts`, add two new IPC wrappers at the bottom:
   ```typescript
   // --- Config commands ---
   export async function configGetTheme(): Promise<Result<string | null>> {
     return safeInvoke<string | null>('config_get_theme');
   }

   export async function configSetTheme(theme: string): Promise<Result<null>> {
     return safeInvoke<null>('config_set_theme', { theme });
   }
   ```

2. In `Application/src/lib/appConfig.ts`, replace the theme section (lines 68-77) to use the new Rust commands instead of LazyStore:
   - Import `configGetTheme` and `configSetTheme` from `./ipc`.
   - Replace `getTheme()` body: call `configGetTheme()`, if result.ok return result.data, else return null.
   - Replace `setThemePreference()` body: call `configSetTheme(theme)`, no need to handle errors (fire-and-forget like the current LazyStore version).
   - Remove the LazyStore `store.get('theme')` and `store.set('theme', ...)` calls from these two functions.
   - Do NOT remove the LazyStore import or singleton -- it is still used by recentProjects and appConfig functions above.

3. `themeManager.ts` requires NO changes -- it already calls `getTheme()` and `setThemePreference()` which maintain their signatures.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <done>TypeScript compiles. Theme get/set now routes through Rust commands to ~/.config/efx-motion/builder-config.yaml. Cycling theme in the app creates/updates the YAML file. On app restart, theme is restored from the YAML file.</done>
</task>

</tasks>

<verification>
1. `cargo check` passes in src-tauri (Rust compiles)
2. `npx tsc --noEmit` passes in Application (TypeScript compiles)
3. Manual: Launch app, cycle theme (Cmd+Shift+T or UI toggle), quit, check `~/.config/efx-motion/builder-config.yaml` contains `theme: medium` (or whichever was selected). Relaunch -- theme should restore.
4. Manual: Delete builder-config.yaml, relaunch -- app defaults to dark theme.
</verification>

<success_criteria>
- Theme preference persists in ~/.config/efx-motion/builder-config.yaml as human-readable YAML
- Theme restores correctly on app launch from the YAML file
- Other LazyStore functionality (recent projects, window size) is unaffected
- YAML file uses read-modify-write pattern so future config keys are preserved
</success_criteria>

<output>
After completion, create `.planning/quick/1-save-theme-preference-to-config-efx-moti/1-SUMMARY.md`
</output>
