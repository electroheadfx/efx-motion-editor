---
status: resolved
trigger: "phase 36.1 I have a slowdown on the whole app experience. it appear wheel of the death of macos with freezed app. It does that when I go in a menu, when I resize the app window, when I change in the timeline the position (first then after its smooth), when I want change duration, Its slow too when I click on a recent project first time app is open, sometimes after I paint a stroke too etc ... I think all ui interaction are affected by wheel of death. Could inspect what it cause this issue ? is the app is too big ? too much javascript ? its very big issue"
created: 2026-06-14
updated: 2026-06-14
---

# Debug Session: phase-36-1-app-wide-slowdown

## Symptoms

- expected_behavior: "UI interactions should remain responsive during menus, resizing, timeline changes, duration edits, recent-project opening, and painting."
- actual_behavior: "The whole app frequently freezes and macOS shows the spinning wheel of death."
- error_messages: "No explicit error reported."
- timeline: "Reported during Phase 36.1; user notes it affects many UI interactions and may happen first-time then smooth out in some flows."
- reproduction: "Open the app and interact with menus, resize the app window, change timeline position, change duration, click a recent project on first app open, or paint a stroke."

## Current Focus

- hypothesis: "physics paint rendered PNG frames were serialized inline into the .mce project on save/open, making auto-save and recent project open move/pretty-print large base64 strings through JS and Rust"
- test: "inspect persistence path and run targeted physics paint persistence, bridge, store, projectStore, and Rust project_io tests"
- expecting: "physics paint render caches persist as cache/physic-paint PNG files, while .mce stores only metadata and cache_path references"
- next_action: "user restarts the Tauri app so updated capabilities load, then verifies save/open and responsiveness with a project containing physics paint outputs"
- reasoning_checkpoint: "Slowdown was app-wide but clustered around save/open and first-time interactions. Auto-save runs after dirty store changes and project_save uses serde_json::to_string_pretty on the whole project. Phase 36.1 stored physics paint output frames as data:image/png base64 strings inside physic_paint_outputs, so every auto-save sent and pretty-printed potentially many full PNGs. The final fix moves rendered PNGs to cache/physic-paint sidecars, stores cache_path in .mce, tightens TypeScript and Rust saved-project types, and adds the Tauri fs:allow-write-file capability required for binary PNG writes."
- tdd_checkpoint: "focused TS and Rust tests pass; full TS typecheck remains blocked only by pre-existing unused-symbol errors"

## Evidence

- timestamp: 2026-06-14T18:10:00Z
  observation: "projectStore.buildMceProject includes physicPaintStore.toMceOutputs() in physic_paint_outputs, and saveProject sends the full object to ipcProjectSave."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/stores/projectStore.ts"
- timestamp: 2026-06-14T18:10:00Z
  observation: "project_io::save_project serializes the complete project with serde_json::to_string_pretty before writing. Large inline PNG data URLs therefore become expensive pretty-printed JSON on every save."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/services/project_io.rs"
- timestamp: 2026-06-14T18:11:00Z
  observation: "PhysicPaintRenderedFrame stores dataUrl, and applySequence can persist up to PHYSIC_PAINT_MAX_APPLY_FRAMES = 600 frames per Play script."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts"
- timestamp: 2026-06-14T18:12:00Z
  observation: "Auto-save runs two seconds after watched project data changes; paint and physics paint mutations mark the project dirty."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/lib/autoSave.ts, /Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts"
- timestamp: 2026-06-14T18:17:00Z
  observation: "Implemented physics paint sidecar PNG persistence and targeted physics paint tests pass: 51 tests across physicPaintStore.test.ts and physicPaintBridge.test.ts."
  source: "pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts"
- timestamp: 2026-06-14T18:40:00Z
  observation: "Finalized cache design: saved .mce Physics Paint frames use cache_path only, rendered PNGs are written under cache/physic-paint, and TypeScript/Rust saved-project models no longer allow arbitrary inline dataUrl frames."
  source: "app/src/lib/physicPaintPersistence.ts, app/src/types/project.ts, app/src-tauri/src/models/project.rs"
- timestamp: 2026-06-14T18:53:00Z
  observation: "User reported save button stayed dirty after creating a Physics Paint Play Canvas. Root cause was missing Tauri fs:allow-write-file permission for binary PNG cache writes; existing permissions only allowed text writes. Added permission and made new project directories create cache/physic-paint."
  source: "app/src-tauri/capabilities/default.json, app/src-tauri/src/services/project_io.rs"
- timestamp: 2026-06-14T18:53:00Z
  observation: "Focused TS and Rust tests pass after the regression fix. Full TypeScript typecheck remains blocked only by pre-existing unused-symbol errors in PhysicsPaintStudio.tsx and PhysicsPaintWorkflowStrip.tsx."
  source: "pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/lib/physicPaintPersistence.test.ts src/lib/physicPaintBridge.test.ts src/stores/physicPaintStore.test.ts src/stores/projectStore.test.ts; cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml project_io; pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec tsc --noEmit"

## Eliminated

- hypothesis: "Recent UI label/button changes alone explain app-wide beachballing."
  reason: "Recent Phase 36.1 UI diffs are small component/CSS changes and do not touch menu, resize, or global interaction loops."
- hypothesis: "The app is simply too large or has too much JavaScript."
  reason: "The codebase size is not the smoking gun; the hot path was repeated movement/serialization of large inline PNG payloads during persistence."

## Resolution

- root_cause: "Physics Paint rendered frames were persisted inline as base64 PNG data URLs inside the .mce project, so save/open and auto-save repeatedly transported and pretty-serialized very large project JSON, blocking the UI and causing macOS beachball freezes. The first cache implementation also missed the Tauri binary fs write permission, causing saves with Physics Paint cached PNGs to fail and leave the save button dirty."
- fix: "Moved Physics Paint rendered PNGs into cache/physic-paint sidecar files, changed saved .mce frames to cache_path references only, rehydrates runtime data URLs on load, tightened TypeScript and Rust saved-project models, added fs:allow-write-file for binary PNG writes, and creates cache/physic-paint for new projects."
- verification: "Passed: pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/lib/physicPaintPersistence.test.ts src/lib/physicPaintBridge.test.ts src/stores/physicPaintStore.test.ts src/stores/projectStore.test.ts. Passed: cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml project_io. Full typecheck is currently blocked only by pre-existing unused-symbol errors in PhysicsPaintStudio.tsx and PhysicsPaintWorkflowStrip.tsx."
- files_changed: "/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintPersistence.ts, /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintPersistence.test.ts, /Users/lmarques/Dev/efx-motion-editor/app/src/stores/projectStore.ts, /Users/lmarques/Dev/efx-motion-editor/app/src/stores/projectStore.test.ts, /Users/lmarques/Dev/efx-motion-editor/app/src/types/project.ts, /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/models/project.rs, /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/services/project_io.rs, /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/default.json"
