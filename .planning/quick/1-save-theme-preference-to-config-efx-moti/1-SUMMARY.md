---
phase: quick
plan: 1
subsystem: config
tags: [tauri, rust, yaml, serde_yaml, theme, config]

requires:
  - phase: 08-ui-theme-system
    provides: theme persistence via LazyStore in appConfig.ts

provides:
  - Rust commands for reading/writing builder-config.yaml
  - Theme persistence at ~/.config/efx-motion/builder-config.yaml
  - IPC wrappers configGetTheme/configSetTheme

affects: [theme, config, appConfig]

tech-stack:
  added: [serde_yaml]
  patterns: [YAML config at ~/.config, atomic write (tmp+rename), read-modify-write]

key-files:
  created:
    - Application/src-tauri/src/commands/config.rs
  modified:
    - Application/src-tauri/Cargo.toml
    - Application/src-tauri/src/commands/mod.rs
    - Application/src-tauri/src/lib.rs
    - Application/src/lib/ipc.ts
    - Application/src/lib/appConfig.ts

key-decisions:
  - "Use $HOME/.config path directly instead of dirs crate (avoids ~/Library/Application Support on macOS)"
  - "Atomic write via tmp+rename for config file safety"
  - "Read-modify-write pattern preserves future YAML keys"

patterns-established:
  - "Config YAML I/O: read_config()/write_config() helpers in config.rs"
  - "Atomic file writes: write to .tmp then rename"

requirements-completed: []

duration: 2min
completed: 2026-03-12
---

# Quick Task 1: Save Theme Preference to Config Summary

**Theme persistence moved from Tauri LazyStore to ~/.config/efx-motion/builder-config.yaml via Rust serde_yaml commands**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T13:17:13Z
- **Completed:** 2026-03-12T13:18:52Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Rust config commands (config_get_theme, config_set_theme) read/write YAML at ~/.config/efx-motion/builder-config.yaml
- Frontend theme functions in appConfig.ts now route through Rust IPC instead of LazyStore
- Atomic write pattern (tmp + rename) ensures config file integrity
- Read-modify-write pattern preserves any future keys added to the YAML

## Task Commits

Each task was committed atomically:

1. **Task 1: Add serde_yaml and create Rust config commands** - `105fa6d` (feat)
2. **Task 2: Wire frontend theme persistence to Rust config commands** - `a8e0cf3` (feat)

## Files Created/Modified
- `Application/src-tauri/src/commands/config.rs` - New: BuilderConfig struct, config_path/read_config/write_config helpers, config_get_theme/config_set_theme commands
- `Application/src-tauri/Cargo.toml` - Added serde_yaml dependency
- `Application/src-tauri/src/commands/mod.rs` - Added pub mod config
- `Application/src-tauri/src/lib.rs` - Registered config commands in invoke handler
- `Application/src/lib/ipc.ts` - Added configGetTheme/configSetTheme IPC wrappers
- `Application/src/lib/appConfig.ts` - Replaced LazyStore theme calls with Rust command calls

## Decisions Made
- Used $HOME/.config path directly instead of dirs crate to avoid macOS ~/Library/Application Support mapping
- Atomic write via tmp+rename for config file safety
- Read-modify-write pattern so future config keys in the YAML are preserved
- LazyStore retained for recentProjects and other appConfig functions (only theme moved)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Remaining
- Manual: Launch app, cycle theme (Cmd+Shift+T), quit, check ~/.config/efx-motion/builder-config.yaml contains the selected theme. Relaunch to confirm restore.
- Manual: Delete builder-config.yaml, relaunch -- app should default to dark theme.

---
*Quick Task: 1*
*Completed: 2026-03-12*
