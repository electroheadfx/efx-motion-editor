# Deferred Items — quick-260801-jun

Out-of-scope discoveries made during execution. Not fixed (scope boundary: pre-existing
failures in files untouched by this task).

## 1. Pre-existing: `cargo test` fails to compile the lib test target at base

- **Found during:** final verification battery (item 5)
- **State:** `app/src-tauri/src/services/project_io.rs` test code references
  `McePhysicPaintOutput` fields `roto_cache_metadata`, `roto_interpolation_settings`,
  and `roto_background`, which no longer exist on the struct (available fields:
  `layer_id`, `frames`, `roto_physical`, `roto_playback`) — 8 compile errors
  (E0560/E0609) in the `lib test` target only.
- **Evidence of pre-existence:** `git show 9dd274d7:app/src-tauri/src/services/project_io.rs`
  contains `roto_cache_metadata` (2 occurrences) and zero `roto_physical`; this task's
  commits changed nothing under `app/src-tauri/src/` (empty diff vs base). The failure
  reproduces identically at base commit 9dd274d7 (v0.8.0 tag).
- **Likely cause:** stale Rust test code left behind by the Phase 36.14 physical-frame
  cutover (struct fields renamed; test file not updated). The lib test target is not
  compiled by `tauri build`, so the credentialed release pipeline never surfaced it.
- **Recommendation:** schedule a quick task to update `project_io.rs` tests to the
  `roto_physical`/`roto_playback` model.

## 2. Pre-existing: `tsc --noEmit` failed at base with TS18048 in vite.config.ts

- **Found during:** Task 1 GREEN (typecheck step of `pnpm build`)
- **State:** `config.optimizeDeps.exclude` is `string[] | undefined` in Vite's
  ResolvedConfig types; the unguarded splice code errored at base (verified via
  `git stash` + typecheck at 9dd274d7 with the workspace package built).
- **Disposition:** FIXED inline as a blocking issue (deviation Rule 3) — the typecheck
  gate is part of this task's mandated verification and the failing lines were inside
  the code region this task relocated. Guard added (`if (exclude)`); runtime behavior
  unchanged. Recorded here for traceability only.

## 3. Note: `build.target: 'safari13'` is silently overridden by Motion Canvas

- `motion-canvas:project`'s config hook contributes `build.target: 'modules'`, which
  wins over the user config (plugin config-hook returns override the config file).
  Pre-existing behavior, out of scope; documented in a vite.config.ts code comment.
