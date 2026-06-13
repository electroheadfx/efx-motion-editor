---
status: resolved
trigger: "Saved Play canvas renders fine in efx-motion, but reopening Physics Paint loses editable Play work; prior interrupted fix added stored Tauri launch context and post-mount fetch."
created: 2026-06-13
updated: 2026-06-13
---

# Debug Session: physics-paint-play-reopen

## Symptoms

- expected_behavior: After saving a Physics Paint Play animation and reopening Physics Paint for that layer, the editable Play source/script/strokes should reload.
- actual_behavior: The rendered paint animation appears correctly in efx-motion, but reopening Physics Paint loses the editable Play work.
- error_messages: No app error reported; prior Claude API stream disconnected before completion while applying a fix.
- timeline: Reported during Phase 36 gap closure; saved Play source reload was expected in Phase 36, not a later phase.
- reproduction: Create/play canvas in Physics Paint, save Play, verify render in efx-motion, then reopen Physics Paint and observe editable Play source is not restored.

## Current Focus

- hypothesis: Native reopen path drops or misses editableState because the Tauri window URL omits large editable payloads and the one-shot launch event can fire before the React studio mounts.
- test: Verify current code stores launch context in Tauri state, exposes a fetch command, fetches it after mount, and has focused regression coverage plus passing type/Rust checks.
- expecting: Studio receives saved editable Play state on reopen even if it missed the launch event.
- next_action: audit partial changes, run focused tests/checks, and fix any gaps without starting the dev server.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-13T13:03:59Z
  source: code_audit
  finding: Native Physics Paint launch now stores the full launch context, including editableState, in Tauri-managed state before opening/focusing the standalone window; the generated native URL intentionally excludes editableState to avoid large URL payloads.
- timestamp: 2026-06-13T13:03:59Z
  source: code_audit
  finding: PhysicsPaintStudio fetches get_physics_paint_launch_context after mount and applies it through the same applyLaunchContext path as the launch event, so a missed one-shot event no longer drops editable Play state.
- timestamp: 2026-06-13T13:03:59Z
  source: verification
  finding: cargo test --manifest-path "/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml" physics_paint --lib passed; 2 focused Rust tests passed.
- timestamp: 2026-06-13T13:03:59Z
  source: verification
  finding: pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/lib/physicPaintBridge.test.ts src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts passed; 4 files / 48 tests passed.
- timestamp: 2026-06-13T13:03:59Z
  source: verification
  finding: pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" typecheck passed.
- timestamp: 2026-06-13T13:03:59Z
  source: verification
  finding: cargo check --manifest-path "/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml" passed.

## Eliminated

- Browser fallback encoded context path: existing tests confirm persisted Play workflow metadata and editableState are included in the browser fallback launch context.
- Invalid TypeScript or Rust API usage: focused tests, TypeScript typecheck, Rust focused tests, and cargo check all passed.

## Resolution

- root_cause: The native reopen path could omit or miss the editable Play payload because the Tauri window URL is not suitable for large editableState data and the launch event can fire before PhysicsPaintStudio has mounted its listener.
- fix: The partial fix is complete: store the latest Physics Paint launch context in Tauri state, expose get_physics_paint_launch_context, fetch/apply that stored context after PhysicsPaintStudio mounts, and keep editableState out of the native window URL while preserving it in the stored/event payload.
- verification: `cargo test --manifest-path "/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml" physics_paint --lib`; `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/lib/physicPaintBridge.test.ts src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts`; `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" typecheck`; `cargo check --manifest-path "/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml"` all passed.
- files_changed: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/lib.rs, /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx, /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts, /Users/lmarques/Dev/efx-motion-editor/.planning/debug/physics-paint-play-reopen.md
