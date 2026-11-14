---
phase: quick-261017-mz9
plan: 261017-mz9
subsystem: ui
tags: [web-worker, offscreen-canvas, paper-sheet, freeze, perf, procedural-paper]

# Dependency graph
requires:
  - phase: 56
    provides: procedural fond sheet generation (playground port, content-keyed cache)
provides:
  - Capped procedural paper-sheet generation in a Web Worker (GPU-first on OffscreenCanvas, CPU field fallback)
  - Non-blocking fond seam (cache-read + async kick) with flat-tint pending state
  - Worker-based warm-up prefetch (no heavy work on mount)
  - /tmp/efx-paper-sheet-capture.json generation-path logger
affects: [physic-paint-studio, project-paper-raster, paper-picker, preview-renderer]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 20548
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Web Worker sheet generation via bundler form new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })"
    - "Cache-read + async kick fond seam delivering through the existing texture-resolve notify"
    - "Pixel-mass cap: one named long-side constant, aspect-preserving, uScale from capped height"

key-files:
  created:
    - app/src/lib/paperSheetField.ts
    - app/src/lib/paperSheetField.test.ts
    - app/src/lib/paperSheet.worker.ts
    - app/src/lib/paperSheetClient.ts
    - app/src/lib/paperSheetClient.test.ts
  modified:
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
    - app/src/lib/paperSheetWarmup.ts
    - app/src/lib/paperSheetWarmup.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts

key-decisions:
  - "PAPER_FIELD_MAX_LONG_SIDE = 1024 (not 768): 1.875x upscale keeps Cold Press grain recognizable; the worker is what kills the freeze"
  - "One continuous field scaled up to fond size — never createPattern tile repeat (user rejected visible tile grids)"
  - "Delivery reuses notifyTextureListeners / subscribeProjectPaperTextureResolve / _ensureFondTextureSubscription — no new signal"
  - "requestProceduralSheet key string shape matches the fond cache key exactly (20f9dfdc shape preserved)"
  - "Rule 1 fix: physicsPaintRotoScriptThumbnail window.setTimeout -> globalThis.setTimeout (node/vitest host has no window)"

patterns-established:
  - "Worker-first procedural generation: GPU OffscreenCanvas three-pass, CPU field fallback, RGBA ArrayBuffer back"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Capped sheet generation in a Web Worker (GPU-first, CPU fallback, in-flight dedup, /tmp capture)"
    verification:
      - kind: unit
        ref: "app/src/lib/paperSheetField.test.ts + app/src/lib/paperSheetClient.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Non-blocking fond seam + warm-up prefetch (flat tint while pending, resolve-notify delivery)"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts + app/src/lib/paperSheetWarmup.test.ts + app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live UAT: no freeze on editor open and on Studio open (THE acceptance)"
    verification: []
    human_judgment: true
    rationale: "UI freeze is a live interactive judgment — automated tests cannot observe main-thread jank in the packaged host"

# Metrics
duration: 25min
completed: 2026-10-17
status: complete
---

# Quick 261017-mz9: Urgent 15s UI Freeze Summary

**Procedural paper-sheet generation moved to a Web Worker at a 1024-long-side cap — the fond seam is now cache-read + async kick with a flat-tint pending state, so the UI never freezes.**

## Accomplishments

- **Task 1 — Capped sheet generation in a Web Worker.** New `paperSheetField.ts` owns `PAPER_FIELD_MAX_LONG_SIDE = 1024` and `capFieldSize` (aspect-preserving; 1920x1080 → 1024x576) plus the pure CPU generator with `uScale = PAPER_UNITS / (fieldHeight * grainScale)`. New `paperSheet.worker.ts` tries an OffscreenCanvas WebGL2 three-pass (importing the existing GLSL from `paperFieldGl.ts`, unmodified) and falls back to the CPU field; both post back RGBA as a transferable ArrayBuffer with a path label. New `paperSheetClient.ts` is the only main-thread door: bundler worker form, in-flight dedup keyed like the fond cache, resolved cache with one `cache-hit` capture row per key, and the `/tmp/efx-paper-sheet-capture.json` writer.
- **Task 2 — Non-blocking fond seam + warm-up prefetch.** `buildProceduralPaperFond` is now cache-read + async kick: on miss it returns null this tick (the flat tint draws), and on delivery it upscales one continuous field into the fond cache and fires `notifyTextureListeners` so `_ensureFondTextureSubscription` recomposites. `isProjectPaperTextureResolved` flips only once a sheet is cached. `subscribeProjectPaperCanvas` follows the jpg-style pending pattern. Warm-up is a worker prefetch only — no heavy work on mount.
- **Rule 1 fix (deviation).** `physicsPaintRotoScriptThumbnail.ts` used `window.setTimeout`, which threw in the vitest node host once the sheet became async; switched to `globalThis.setTimeout` / `globalThis.clearTimeout`. Its paper/* pin retargeted to the client mock.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Thumbnail fail-soft timeout used `window`**
- **Found during:** Task 2 full-suite run
- **Issue:** `resolveProjectPaperCanvas` scheduled its 5s fail-soft via `window.setTimeout`; once procedural delivery became async the node/vitest host reached that path and threw `window is not defined`.
- **Fix:** `globalThis.setTimeout` / `globalThis.clearTimeout`; retargeted the paper/* thumbnail pin to mock the worker client.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts`, `...Thumbnail.test.ts`
- **Commit:** 06207d8c

## Known Stubs

None.

## Live UAT rows (the user runs these — rows 1 and 2 are THE acceptance)

1. **No freeze, editor:** launch the app and open the editor — the UI never freezes. The paper may appear a fraction of a second later; the UI stays responsive the whole time.
2. **No freeze, Studio:** open PHYSIC PAINT STUDIO — no freeze. Interactive immediately.
3. **Look:** Cold Press still matches `SPECS/v1.1.0-water-color/paper/cold press.png` at normal zoom — slightly softer grain from the upscale is OK; tiling/seams/wrong scale is not.
4. **Responsive while generating:** with a fresh paper selected, scrub the timeline and move panels while the sheet is still being generated — everything stays fluid.
5. **Repeat is a hit:** change paper A to B to A — A is instant (cache hit, no regeneration).
6. **Console clean.** And `/tmp/efx-paper-sheet-capture.json` reports which path ran and its duration.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: app/src/lib/paperSheetField.ts
- FOUND: app/src/lib/paperSheet.worker.ts
- FOUND: app/src/lib/paperSheetClient.ts
- FOUND: app/src/lib/projectPaperRaster.ts
- FOUND: app/src/lib/paperSheetWarmup.ts
- FOUND: 06207d8c (merge-base ancestor check via git rev-parse)
