---
status: resolved
trigger: "--discuss phase 36.1 In play paint: when I open a play paint already created, the physics paint don't use the cached image, I need to force a save play preview for retrieve the cache, so I think the cache are not used in physics paint when I open except if I re save. Its the 4th you try to fix this issue without success ! try to think deep and ask me questions on gray zone"
created: 2026-06-14
updated: 2026-06-14
---

# Debug Session: play-paint-physics-cache

## Symptoms

- Expected behavior: When opening/reopening an existing Physics Paint layer canvas script, Physics Paint should use the already persisted saved play preview/cache as its source image without requiring a new Save Play Preview or re-render.
- Actual behavior: After closing Physics Paint following a render, reopening the Physics Paint layer canvas script shows the final paint at the last frame as expected, but previous frames cannot be previewed. The cache is not used in the Physics Paint canvas reopen path.
- Error messages: No explicit error reported.
- Timeline: This is a recurring Phase 36.1 bug; previous fix attempts did not resolve it.
- Reproduction: Render Physics Paint, close Physics Paint, reopen the Physics Paint layer canvas script. The app itself uses the cache correctly, but Physics Paint does not. Re-rendering / Save Play Preview rewrites the cache and fixes Physics Paint only.

## Clarified Gray Areas

- Intended source of truth: Saved preview/cache persisted with the project file.
- Failure scope: Physics Paint canvas script reopen path only; app-level preview/cache use works.
- Visible failure: Final paint at last frame appears correct, but previous frames cannot be previewed until the cache is rewritten.
- Re-save effect: Save Play Preview/re-render fixes Physics Paint cache use by rewriting the cache; this does not indicate app-level cache failure.

## Current Focus

- hypothesis: Physics Paint reopen/hydration path loads final render state but does not hydrate or pass the persisted saved preview/cache timeline/image data used for previous-frame preview; the re-render path rewrites in-memory or persisted cache in a format/location that Physics Paint consumes.
- test: Compare open-project/app preview cache loading against Physics Paint canvas script reopen loading, then add a regression test for reopening after render without re-render.
- expecting: There is a missing bridge/store/persistence handoff in the Physics Paint open/reopen path, not a failure of project-level cache persistence.
- next_action: gather initial evidence
- reasoning_checkpoint: Gray-zone clarification received from user; avoid broad project-cache assumptions and focus on Physics Paint layer canvas script reopen after render.
- tdd_checkpoint: pending

## Evidence

- timestamp: 2026-06-14T19:33:00Z
  observation: `createPhysicPaintLaunchContext` only sent `cachedPlayFrames` when `containingRange.cacheStatus === 'cached'`, even though `projectStore.openProject` had already hydrated `physicPaintStore` frames from persisted cache files.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts
- timestamp: 2026-06-14T19:34:00Z
  observation: Added regression coverage for reopening a hydrated saved Play range whose persisted range status is stale while rendered cached frames exist.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.test.ts
- timestamp: 2026-06-14T19:35:00Z
  observation: `pnpm vitest run src/lib/physicPaintBridge.test.ts` passes with 40 tests after the fix.
  source: command output
- timestamp: 2026-06-14T19:38:00Z
  observation: User screenshots show the previous fix is insufficient: reopening Physics Paint displays the final stroke state at frame 1 and gray timeline cells, while Preview / Save Play rewrites the cache and immediately turns timeline cells green with correct per-frame preview.
  source: user screenshots
- timestamp: 2026-06-14T19:44:00Z
  observation: `PhysicsPaintLaunchContext` in Tauri only modeled operation/layer/frame/workflow/editable fields. Serde dropped frontend fields including `cachedPlayFrames`, `playCacheStatus`, `selectedPlayScriptId`, `previewFrame`, and `playMotion` before storing/emitting the native launch context.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/lib.rs

## Eliminated


## Resolution

- root_cause: The frontend bridge created `cachedPlayFrames`/`playCacheStatus`, but Tauri deserialized the launch payload into a Rust `PhysicsPaintLaunchContext` that did not model those fields. Serde dropped the cached frames and cache status before storing/emitting the native launch context, so the standalone window reopened with final editable state but gray/missing per-frame preview cells.
- fix: Extended the Tauri launch-context model to preserve `requestedWorkflowMode`, `selectedPlayScriptId`, `playCacheStatus`, `playMotion`, `previewFrame`, `cachedPlayFrames`, and Play limit metadata; kept large cache data out of the URL and available through stored-context fetch/event payloads. Kept the frontend bridge fix deriving cache status from hydrated frames.
- verification: `pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` passed (57 tests). `cargo test --manifest-path app/src-tauri/Cargo.toml physics_paint` passed (2 tests).
- files_changed: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/lib.rs; /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.test.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts
