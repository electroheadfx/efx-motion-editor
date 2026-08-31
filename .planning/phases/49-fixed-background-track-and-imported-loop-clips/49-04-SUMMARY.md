---
phase: 49-fixed-background-track-and-imported-loop-clips
plan: 04
subsystem: bridge + picker
tags: [efx-paint, background-track, image-library, bridge-pair, asset-picker, capability, checkpoint, tdd]

# Dependency graph
requires:
  - phase: 49-fixed-background-track-and-imported-loop-clips (49-02)
    provides: addBackgroundClip store op + naturalFilenameSort (Confirm ordering) + the 49-02 verdict union the picker's confirm path will consume
  - phase: 49-fixed-background-track-and-imported-loop-clips (49-03)
    provides: document-fallback fond authority + selector write-through the picker's confirm flow lands against
provides:
  - Cross-window image-library bridge pair `physic-paint:image-library-request` / `physic-paint:image-library-result` (operationId-correlated, boundary-validated) letting the Studio webview request `{ images: MceImageRef[], projectDir: string }` from the main webview's authoritative imageStore realm (Pitfall 2)
  - `dialog:allow-open` capability delta on physics-paint.json — exactly one permission, no fs:* grant (V4 least privilege, Pitfall 3)
  - `BackgroundAssetPickerView` scoped full-area picker (S2): signal-driven controller (useSignal/useComputed only), region swap (no modal), Confirm/Cancel semantics, in-picker Import, natural-sorted confirm ordering (D-02)
  - Main-window install of the image-library request listener (the fix that made the picker live)
affects: [49-05, 49-06, Phase 50 photoReference]

# Actuals (#2632) — pairs with the plan's estimate (90000 tokens)
actuals:
  tokens: 0        # not measured this run
  tasks: 3         # tasks completed (Task 3 = native checkpoint)
  commits: 10      # commits made

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-window request/result pair: operationId-correlated bridge events following the script-library/roto-authority idiom — consumer requestImageLibrary() + publisher-side listener answering from the main-window imageStore realm (Pitfall 2)"
    - "Least-privilege capability delta: exactly dialog:allow-open added to physics-paint.json; thumbnails ride the app-wide efxasset:// CSP grant, no fs:* permission (V4)"
    - "Signal-driven picker controller: useSignal/useComputed only — no useState in new Studio code (efx-preact-reactivity, Pitfall 4)"
    - "Document fallback as the single fond authority on open: applyBackgroundFallbackToSettings + applyBackgroundFallbackToEngine hydrate selector AND engine from the document fallback at three points (settings init, engine lifecycle, launch integration) — no first-click divergence"

key-files:
  created:
    - app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx
    - app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts
    - app/src-tauri/capabilities/physics-paint.json
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
    - app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/efx-paint/utils/naturalFilenameSort.ts
    - app/src/types/physicPaint.ts
    - app/src/main.tsx

key-decisions:
  - "Bridge pair follows the established request/result idiom: requestImageLibrary() (consumer) correlates by operationId and enforces a 15s timeout; installPhysicPaintImageLibraryListener (publisher) answers from imageStore.toMceImages(projectDir ?? tempProjectDir) — the temp-dir fallback makes temp-dir-opened projects populate the picker"
  - "The listener MUST be installed at main-window startup: without installPhysicPaintImageLibraryListener() in main.tsx the child's emitTo('main', ...) has no receiver and every request times out — the root cause of the final checkpoint rejection"
  - "Picker is a region swap, not a modal: role=region + aria-label, focus moves to the first actionable control (Confirm) on open and restores to the opener on close; no backdrop, no Tab trap, engine canvas stays mounted underneath (D-01)"
  - "Confirm ordering is natural original-filename order via sortImagesByOriginalFilename — click order and asset UUID never influence the emitted reference order (D-02/BKG-02)"
  - "Document fallback is the single fond authority on open: applyBackgroundFallbackToSettings + applyBackgroundFallbackToEngine hydrate the selector mode AND engine bgMode from launchContext.document.background.fallback at settings init, the engine lifecycle effect, and the launch integration callback — eliminating the two-authorities divergence that caused the black monitor fond"

patterns-established:
  - "Pattern: cross-window realm seam — the Studio realm's empty imageStore is filled by a request/result bridge pair to the main webview's authoritative realm; the pair validates at the boundary and answers only the latest matching operationId"
  - "Pattern: single fond authority on open — the document fallback hydrates selector + engine at init, so the selector, engine, and monitor fond agree before the first click"
  - "Pattern: signal-driven picker controller — useSignal/useComputed only, no useState, per efx-preact-reactivity"

requirements-completed: [BKG-01, BKG-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Cross-window image-library bridge pair — requestImageLibrary() correlates by operationId and enforces a 15s timeout; the publisher listener answers with { images, projectDir } from the main-window imageStore realm; malformed/mismatched payloads rejected at the boundary; the listener is installed at main-window startup so the child's emitTo('main', ...) has a receiver"
    requirement: BKG-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts#image-library request/result round-trip + correlation + validation"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#installs the image-library request listener in the app entry point (49-04 picker)"
        status: pass
      - kind: native
        ref: "Task 3 checkpoint — picker grid populates from the project library (realm-isolation proof)"
        status: pass
    human_judgment: true
  - id: D2
    description: "Capability delta — physics-paint.json gains exactly dialog:allow-open; no fs:* permission; thumbnails ride the app-wide efxasset:// CSP grant"
    requirement: BKG-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts#capability delta structural JSON assertion"
        status: pass
      - kind: native
        ref: "Task 3 checkpoint — native OS file dialog opens from the in-picker Import button"
        status: pass
    human_judgment: true
  - id: D3
    description: "S2 full-area picker — signal-driven controller (useSignal/useComputed only), region swap (role=region, no modal), Confirm/Cancel semantics, in-picker Import, natural-sorted confirm ordering (D-02), empty/error/loading states, focus move/restore, engine canvas stays mounted"
    requirement: BKG-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts#controller state machine + buildConfirmedImageIds natural ordering + surface contract"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#picker swap + engine identity preserved"
        status: pass
      - kind: native
        ref: "Task 3 checkpoint — import adds to the grid without closing, Confirm natural-sorted, Cancel leaves nothing changed"
        status: pass
    human_judgment: true
  - id: D4
    description: "Document fallback as the single fond authority on open — applyBackgroundFallbackToSettings + applyBackgroundFallbackToEngine hydrate selector AND engine from the document fallback at settings init, the engine lifecycle effect, and the launch integration callback; the selector, engine, and monitor fond agree before the first click"
    requirement: BKG-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-04: hydrates the selector mode from the document fallback (transparent/solid/paper)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-04: applies the document fallback to the engine bgMode (transparent/solid/paper)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-04: the fallback round-trip is stable — settings → fallback → settings"
        status: pass
      - kind: native
        ref: "Task 3 checkpoint — paper fond shows when a paper swatch is active, selector state correct on open, no first click needed"
        status: pass
    human_judgment: true

# Metrics
duration: 3h
completed: 2026-08-31
status: complete
---

# Phase 49 Plan 4: Scoped Asset Picker Surface (S2) — Cross-Window Library Seam, Capability Delta, and the Document-Fallback Fond Authority on Open

**Built the scoped asset-picker surface the Bg row's Import control will open: the operationId-correlated image-library bridge pair that fills the Studio realm's empty imageStore (Pitfall 2), the single `dialog:allow-open` capability delta that makes in-picker native import legal (Pitfall 3), and the `BackgroundAssetPickerView` full-area region swap with Confirm/Cancel semantics. The checkpoint passed native UAT after four fix rounds — the last two root causes being the document fallback never hydrating selector+engine on open (black monitor fond) and the image-library request listener never being installed at main-window startup (every picker request timing out).**

## Performance

- **Duration:** ~3 h
- **Started:** 2026-08-31
- **Completed:** 2026-08-31
- **Tasks:** 3 (Task 3 = blocking native checkpoint)
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- **Cross-window image-library bridge pair (Pitfall 2)**: `requestImageLibrary()` (consumer) correlates by operationId and enforces a 15s timeout; `installPhysicPaintImageLibraryListener` (publisher) answers from `imageStore.toMceImages(projectDir ?? tempProjectDir)` — the temp-dir fallback makes temp-dir-opened projects populate the picker. The pair follows the script-library/roto-authority idiom, rejects unknown/mismatched payloads at the bridge boundary, and answers only the latest matching operationId.
- **Least-privilege capability delta (V4)**: `physics-paint.json` gains exactly `dialog:allow-open` — no `fs:*` grant. Library thumbnails display through the app-wide `efxasset://` protocol which needs no fs permission (CSP already allows it).
- **S2 full-area picker (D-01)**: `BackgroundAssetPickerView` is a bordered panel filling the canvas region with a top bar (`Import background images` title + named `Confirm`/`Cancel` buttons) and an images-only multi-select grid. `role="region"` with `aria-label="Import background images"`, focus moves to the first actionable control (Confirm) on open and restores to the opener on close. No backdrop overlay, no Tab trap — a region swap, not a modal. The engine canvas stays mounted underneath.
- **Signal-driven controller (efx-preact-reactivity)**: `useBackgroundAssetPickerController` uses `useSignal`/`useComputed` only — no `useState` in new Studio code (Pitfall 4). Empty/loading/error states, in-picker Import with library refresh without closing, prior selection preserved on import failure.
- **Natural-sorted confirm ordering (D-02/BKG-02)**: `buildConfirmedImageIds` emits the confirmed selection ordered by `sortImagesByOriginalFilename` — click order and asset UUID never influence the emitted reference order.
- **Document fallback as the single fond authority on open**: `applyBackgroundFallbackToSettings` + `applyBackgroundFallbackToEngine` hydrate the selector mode AND engine bgMode from `launchContext.document.background.fallback` at three points — settings init (`PhysicsPaintStudio.tsx:682`), the engine lifecycle effect (`usePhysicsPaintEngineLifecycle.ts`), and the launch integration callback (`usePhysicsPaintLaunchIntegration.ts:145`). This eliminated the two-authorities divergence that caused the black monitor fond on open.
- **Main-window listener install**: `installPhysicPaintImageLibraryListener()` is now installed in `main.tsx` alongside the sibling physic-paint bridge installers — the fix that made the picker live (previously every request timed out because the child's `emitTo('main', ...)` had no receiver).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: image-library bridge pair + projectDir delivery + capability extension** - `7e0eb35f` (test: RED), `452de56c` (feat: GREEN)
2. **Task 2: `BackgroundAssetPickerView` — scoped full-area picker (S2) and the Studio region swap** - `f2c368b9` (feat), `59da6f33` (feat: log natural-sorted confirm order for the native checkpoint)
3. **Task 3: Native checkpoint — picker dialog permission and cross-window library proof** - four fix rounds before approval:
   - `ff7792e9` (checkerboard verdict respects engine-side active background mode)
   - `c39ddf44` (enlarge transparency checkerboard tile to 20px)
   - `4f9b4ed7` (wire background swatch click to write the document fallback)
   - `91cec8d8` (resolve bridge project dir via dirPath ?? tempProjectDir)
   - `e68b8ba2` (hydrate selector + engine from the document fallback on open)
   - `0e73a217` (install the image-library request listener at main startup)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` (new) - S2 full-area picker: signal-driven controller + presentational region swap with Confirm/Cancel/Import.
- `app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts` (new) - controller state machine, natural-sorted confirm ordering, surface contract (no useState, region swap, focus move/restore).
- `app/src/lib/physicPaintBridge.ts` - `requestImageLibrary()` + `installPhysicPaintImageLibraryListener()` + `applyPhysicPaintImageLibraryRequest` + `createImageLibraryRequestLifecycle` + `PhysicPaintImageLibraryStatePorts`.
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts` - round-trip, correlation, validation, capability-delta tests.
- `app/src-tauri/capabilities/physics-paint.json` - exactly `dialog:allow-open` added.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - picker swap state + `useBackgroundAssetPickerController` wiring + `handleBackgroundChange` wrapper + settings init from document fallback.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - picker swap, engine identity, main.tsx listener install, fond hydration contract tests.
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` - `applyBackgroundFallbackToSettings` + `applyBackgroundFallbackToEngine`.
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts` - 49-04 hydration/engine/round-trip tests.
- `app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts` - engine bgMode hydrates from the document fallback.
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` - launch integration hydrates settings from the document fallback.
- `app/src/components/physic-paint/physicsPaintStudio.css` - picker styles + checkerboard tile 20px.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - checkerboard layer.
- `app/src/efx-paint/utils/naturalFilenameSort.ts` - natural sort util (Confirm ordering).
- `app/src/types/physicPaint.ts` - `PhysicPaintImageLibraryRequest`/`Result` types + guards.
- `app/src/main.tsx` - `installPhysicPaintImageLibraryListener()` installed at main-window startup.

## Decisions Made

- **Bridge pair follows the established request/result idiom**: `requestImageLibrary()` (consumer) correlates by operationId and enforces a 15s timeout; `installPhysicPaintImageLibraryListener` (publisher) answers from `imageStore.toMceImages(projectDir ?? tempProjectDir)` — the temp-dir fallback makes temp-dir-opened projects populate the picker.
- **The listener MUST be installed at main-window startup**: without `installPhysicPaintImageLibraryListener()` in `main.tsx` the child's `emitTo('main', ...)` has no receiver and every request times out — the root cause of the final checkpoint rejection.
- **Picker is a region swap, not a modal**: `role="region"` + `aria-label`, focus moves to the first actionable control (Confirm) on open and restores to the opener on close; no backdrop, no Tab trap, engine canvas stays mounted underneath (D-01).
- **Confirm ordering is natural original-filename order** via `sortImagesByOriginalFilename` — click order and asset UUID never influence the emitted reference order (D-02/BKG-02).
- **Document fallback is the single fond authority on open**: `applyBackgroundFallbackToSettings` + `applyBackgroundFallbackToEngine` hydrate the selector mode AND engine bgMode from `launchContext.document.background.fallback` at settings init, the engine lifecycle effect, and the launch integration callback — eliminating the two-authorities divergence that caused the black monitor fond.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The document fallback never hydrated selector + engine on open (black monitor fond)**
- **Found during:** Task 3 native checkpoint (2nd rejection)
- **Issue:** The click handler wrote the document fallback, but `reflectFallbackToBackgroundMode` was never called outside its module — nothing hydrated selector + engine from the document fallback on open. For existing documents the selector showed paper (old per-track persisted settings), the engine ran paper mode, but the document fallback stayed transparent → monitor fond resolved null → black. Two authorities diverged until the first click of the session.
- **Fix:** Added `applyBackgroundFallbackToSettings` + `applyBackgroundFallbackToEngine` helpers and wired them into the settings init (`PhysicsPaintStudio.tsx:682`), the engine lifecycle effect (`usePhysicsPaintEngineLifecycle.ts`), and the launch integration callback (`usePhysicsPaintLaunchIntegration.ts:145`). The document fallback is now the single authority on open.
- **Files modified:** app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts, app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts, app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** full suite 3141 passed; `pnpm --dir app run typecheck` exits 0
- **Committed in:** e68b8ba2

**2. [Rule 1 - Bug] The image-library request listener was never installed (every picker request timed out)**
- **Found during:** Task 3 native checkpoint (4th rejection)
- **Issue:** `installPhysicPaintImageLibraryListener` (physicPaintBridge.ts:2429) was defined but never called anywhere — the main webview never registered the request listener, so the Studio's `emitTo('main', ...)` had no receiver and every request timed out after 15s.
- **Fix:** Installed the listener at main-window startup alongside the sibling physic-paint bridge installers in `main.tsx`, and added a contract test asserting the entry point installs it.
- **Files modified:** app/src/main.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** full suite 3141 passed; `pnpm --dir app run typecheck` exits 0
- **Committed in:** 0e73a217

**3. [Rule 1 - Bug] Checkerboard appeared with a paper fond active + 8px tile too small**
- **Found during:** Task 3 native checkpoint (1st rejection)
- **Issue:** The checkerboard verdict did not respect the engine-side active background mode, so it appeared while a paper fond was active; the 8px tile (4px effective cells) was too small to read.
- **Fix:** Added the `settings.background === 'transparent'` guard to the checkerboard verdict and enlarged the tile to 20px.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/physicsPaintStudio.css
- **Committed in:** ff7792e9, c39ddf44

**4. [Rule 1 - Bug] Paper swatch → black monitor fond regression + picker empty state + import-does-nothing**
- **Found during:** Task 3 native checkpoint (2nd rejection)
- **Issue:** With a paper swatch selected the monitor showed black where the paper fond should be; the picker showed the empty state with an open project; Import opened the dialog but imported nothing.
- **Fix:** Wired the background swatch click to write the document fallback (`handleBackgroundChange` wrapper) and resolved the bridge project dir via `dirPath ?? tempProjectDir` so temp-dir-opened projects populate the picker.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/lib/physicPaintBridge.ts
- **Committed in:** 4f9b4ed7, 91cec8d8

---

**Total deviations:** 4 auto-fixed (all bugs found during the native checkpoint)
**Impact on plan:** All four fixes were necessary for the plan's own goals — the fond hydration and listener install are the two structural prerequisites that made the picker and the monitor fond actually work. No scope creep.

## Issues Encountered

- **Black monitor fond on open (2nd rejection):** the click handler wrote the document fallback but nothing hydrated selector + engine from it on open — two authorities diverged until the first click. Root cause: `reflectFallbackToBackgroundMode` was never called outside its module. Fixed by adding `applyBackgroundFallbackToSettings`/`applyBackgroundFallbackToEngine` and wiring them at three hydration points.
- **Picker request timeout (4th rejection):** `installPhysicPaintImageLibraryListener` was defined but never called — the main webview never registered the request listener, so every `emitTo('main', ...)` had no receiver. Fixed by installing it at main-window startup.
- **Checkerboard with paper fond + tiny tile (1st rejection):** the verdict did not respect the engine-side background mode and the 8px tile was too small. Fixed with the transparent guard + 20px tile.
- **Paper swatch → black fond + picker empty + import no-op (2nd rejection):** the swatch click did not write the document fallback and the bridge project dir did not fall back to tempProjectDir. Fixed with the `handleBackgroundChange` wrapper + `dirPath ?? tempProjectDir`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **49-05 consumes the picker seams**: the Bg row's Import control opens the picker swap; `onConfirm(ids)` → `addBackgroundClip(layerId, { startFrame: playhead, sourceFrameRefs: natural-sorted ids, repeat: finite 1 })`; `onCancel()` closes with zero store interaction. The `requestImageLibrary()` port and the `BackgroundAssetPickerView` component are exported and wired.
- **The document fallback is the single fond authority on open**: selector + engine + monitor fond agree before the first click — the 49-05 Bg row renders the fallback display (transparent checkerboard or solid swatch) from the same authority.
- **The image-library listener is installed at main-window startup**: the picker grid populates from the project library (including temp-dir-opened projects) and in-picker Import adds to the grid without closing.
- **49-06 consumes the clip-selection routing**: the picker's Confirm creates the clip; the right-panel clip section (49-06) reads the selected clip.

## Self-Check: PASSED

- FOUND: app/src/lib/physicPaintBridge.ts, app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx, app/src-tauri/capabilities/physics-paint.json, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/main.tsx, app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
- FOUND: 7e0eb35f (RED), 452de56c (GREEN), f2c368b9, 59da6f33, ff7792e9, c39ddf44, 4f9b4ed7, 91cec8d8, e68b8ba2, 0e73a217

---
*Phase: 49-fixed-background-track-and-imported-loop-clips*
*Completed: 2026-08-31*
