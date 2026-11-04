---
phase: quick-261104-uyv
plan: 261104-uyv
subsystem: ui
tags: [preact, signals, physics-paint, studio, canvas-zoom, pan, aquarelle, vitest]

# Dependency graph
requires: []
provides:
  - Pure Studio canvas zoom/pan math plus a module-level signals store (fit/max/min, presets, cursor-anchored zoom, pan clamp)
  - Mount sizing seam that reports measured container + working size and renders the shell at the store's effective scale in real CSS pixels
  - Clipping zoom viewport with a translate-only pan layer, wheel/pinch/middle-drag interactions
  - Floating zoom pill (minus, percent, plus, Fit, 1:1) gated by the picker step-aside
affects:
  - Studio canvas layout inside the canvas region (display only)
  - Engine shell CSS size (the engine's own resize observer re-captures its box)

tech-stack:
  added: []
  patterns:
    - "Display-only zoom: grow the shell by REAL CSS size, translate only the ancestor pan layer — never a scale transform (client-rect mapping would double-scale)"
    - "Module-level signals store read by narrow leaves: the mount (sizing seam), the two-div pan layer, the pill"
    - "One-frame rAF coalescer: one store write per frame, terminated by the flush clearing its pending job, cancelled on unmount"
    - "Backing-pixel budget bounds the max scale because the engine's WebGL backing grows with scale squared times devicePixelRatio (capped at 2)"
    - "Capture-phase button-1 pointerdown consumption keeps middle-drag out of the stack gates and the engine"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts
    - app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
    - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx
    - app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts
  modified:
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "The percent readout is the working-pixel-to-CSS-pixel ratio: 1:1 reads 100%, fit reads the contained ratio (~36% for 1080x1920 in a typical region)."
  - "Fit delegates to getContainedCanvasDisplaySize, so the opening view is byte-identical to today's sizing authority; it stays the floor (minScale = min(fit, 1))."
  - "The max scale is budget-bounded (16 MP of engine backing pixels at DPR<=2), not a flat 400%: a flat 400% on 1080x1920 would allocate ~132 MP (~530 MB) and kill the WebView."
  - "The shell grows in real CSS size (max caps neutralized only while sized); the pan is a translate on an ancestor, so canvasBounds and every pointer/color-pick mapping stay exact with no double scaling."
  - "Middle-drag is consumed in the CAPTURE phase and the engine never sees button 1; no bare-key shortcut is added — wheel, gesture and middle-button are the only new inputs."

actuals:
  tokens: 14947
  tasks: 3
  commits: 3

plan_head_before: 5c91eb6b345cc251cf29bfb5d730af883a71b36c
plan_head_after: bdbbdc5b9afc9d543a146cad52bac4f7f645f84d

requirements-completed: [QUICK-261104-UYV]

duration: 8m
completed: 2026-11-04
status: complete
---

# Quick 261104-uyv: Studio Canvas Zoom Controls Summary

**The Studio now has a full canvas zoom surface — a floating pill with minus, percent, plus, Fit and 1:1; Fit stays the opening view and follows container resizes; 1:1 maps one engine working pixel to one CSS pixel and is pannable by plain wheel and middle-button drag, clipped at the canvas viewport so no panel or floating dialog is ever overdrawn.**

## Performance

- **Duration:** 8m
- **Started:** 2026-11-04T21:27:34Z
- **Completed:** 2026-11-04T21:35:25Z
- **Tasks:** 3/3
- **Files created:** 5 (module, module test, viewport, bar, wiring test)
- **Files modified:** 3 (mount, Studio view, Studio CSS)

## Architecture

One end-to-end display-only slice in three sequential tasks:

1. **Pure math + signals store** (`physicsPaintCanvasZoom.ts`)
   - Pure helpers: `resolveFitScale` (delegates to `getContainedCanvasDisplaySize`), `resolveMaxScale`, `resolveMinScale`, `clampZoomScale`, `nextScalePreset`, `resolveDisplaySize`, `resolveZoomPercent`, `resolveMaxPan`, `clampPanToBounds`, `resolveCursorAnchoredPan`.
   - Module-level signals: `containerWidth/Height`, `workWidth/Height`, `mode` (`fit | absolute`), `absoluteScale`, `panX/panY`; computeds `fitScale`, `minScale`, `maxScale`, `effectiveScale` (0 while unmeasured), `displayWidth/Height`, `zoomPercent`, `hasOverflow`, `isAtMin/isAtMax/isFit/isActualSize`.
   - Every setter is compare-then-write; an idempotence test proves repeated identical writes notify zero extra times and a real change notifies exactly once.
   - ONE anchored-pan path serves both the cursor wheel/pinch and the center-anchored preset buttons.

2. **Mount sizing seam** (`PhysicsPaintCanvasMount.tsx`)
   - The mount's existing ResizeObserver still measures the tracks group, but now reports `setWorkSize(props.width, props.height)` + `setContainerSize(rect…)` to the store instead of holding `displaySize` state.
   - The shell renders `width: workWidth × effectiveScale`, `height: workHeight × effectiveScale` in real CSS pixels, with `maxWidth/maxHeight: 'none'` ONLY while sized; before the first measurement the existing CSS caps provide today's fallback.
   - Pinned contracts untouched: the dependency line `}, [props.height, props.width]);`, the four performance counters, the memo boundary, every engine call, `paperTextureScale`, working size and paint data.

3. **Viewport + pill** (`PhysicsPaintCanvasZoomViewport.tsx`, `PhysicsPaintCanvasZoomBar.tsx`, `PhysicsPaintStudioView.tsx`, CSS)
   - `PhysicsPaintCanvasZoomViewport` = the ONE clip (`overflow: hidden`) in the canvas region; the canvas region stays unclipped so its floating dialogs and the apply pill keep anchoring past its edges.
   - `PhysicsPaintCanvasZoomPanLayer` reads only `panX/panY` and emits a `translate(...)` only when non-zero (default DOM keeps today's stacking). Panning therefore re-renders a two-div leaf, never the memoized stack.
   - Interactions live in one `[]`-dep effect: a single rAF coalescer (one store write per frame; termination = the flush clears its pending job; cleanup cancels the frame), `wheel` (`{passive:false}`) for Cmd/Ctrl zoom (`exp(-deltaY*0.0025)` clamped to [0.5, 2]) and plain wheel pan only while `hasOverflow`, `gesturestart`/`gesturechange` for WKWebView pinch (base scale × `event.scale`, cursor-anchored with the container-center fallback), and capture-phase middle-button drag with pointer capture + `auxclick` prevention.
   - The pill reads only `zoomPercent/isAtMin/isAtMax/isFit/isActualSize`: minus, percent (tabular numerals, fixed min-width), plus, Fit, 1:1; disabled/pressed states from the store; no keydown handler and no shortcut hint.
   - The view wraps the single `<MemoizedPhysicsPaintCanvasStack {...canvas} />` in the viewport (literal stays exactly once, before every picker overlay) and renders the pill as a region sibling after the apply pill under `!pickerOpen`.

## Max-scale budget rationale

The watercolor engine's `fitCanvas` sizes its WebGL backing store from the shell's **CSS box × devicePixelRatio** (capped at 2), so backing pixels grow with **scale squared**. A flat 400% on a 1080×1920 sheet would allocate ~132 megapixels (~530 MB) and kill the WebView.

`PHYSICS_PAINT_ZOOM_BACKING_BUDGET = 16_000_000` backing pixels (~64 MB RGBA worst case):

- `resolveMaxScale = max(1, min(4, sqrt(budget / (workW × workH × dprCap²))))`
- 1080×1920 → **~1.389×** (still admits 1:1; 1:1 uses 8.29 MP)
- 1920×1920 (the largest reachable working size, long edge capped at 1920) → **~1.042×** — 1:1 is reachable for EVERY reachable working size
- 500×500 → **4.0×** exactly (500×4×2 squared = 16,000,000), so the top ladder preset is reachable on small sheets
- 512×512 → **~3.907×** (the 4× preset is unreachable there; the budget, not the ladder, is the law)

## Verification

Focused gate (per task):

- `pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts` — **20/20 passed**
- `pnpm --dir app exec vitest run src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts` — **19/19 passed**
- `pnpm --dir app exec vitest run …ZoomWiring …StudioView …ApplyProgressPill …PhysicsPaintStudio …CanvasMount` — **364/364 passed**
- `pnpm --dir app run typecheck` — **clean**

Closing gate:

- `pnpm --dir app exec vitest run` — **370 files passed, 2 skipped; 7,239 tests passed, 1 skipped, 96 todo; 0 failed** (includes the production `viteBuild` gate).

The dev server / Tauri app were never started (the user runs live UAT).

## Task Commits

1. **Task 1: TDD the pure zoom/pan math and its signals store** — `e09a0b682` (feat)
2. **Task 2: Feed the store from the mount and render the shell at its display size** — `d32d87183` (feat)
3. **Task 3: Clip, pan, interact, and seat the floating zoom pill** — `bdbbdc5b9` (feat)

Measured ledger: `5c91eb6b..bdbbdc5b9` = 3 commits, 8 files, 1,260 insertions, 5 deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan arithmetic: `resolveMaxScale(512, 512)` cannot be 4 with the specified budget**
- **Found during:** Task 1 (max-scale group)
- **Issue:** The plan names `PHYSICS_PAINT_ZOOM_BACKING_BUDGET = 16_000_000` AND expects `resolveMaxScale(512, 512)` to be 4. The formula with that constant yields `sqrt(16e6 / (512² × 4)) ≈ 3.9065`.
- **Fix:** Kept the explicit 16 MP constant (it is the threat-register budget and the “about 64 MB” rationale). The test pins the arithmetic truth for 512×512 (`≈3.9065`, ≤ 4×) and pins the plan's real intent — a small sheet reaching the 4× ladder top — with `resolveMaxScale(500, 500) === 4` (500×4×2 squared = exactly 16,000,000). 1:1 at 1920×1920 remains pinned ≥ 1.
- **Files:** `physicsPaintCanvasZoom.test.ts`
- **Committed in:** `e09a0b682`

**2. [Rule 1 - Bug] Cursor-anchored test geometry had no overflow to anchor into**
- **Found during:** Task 1 (cursor-anchored group)
- **Issue:** The plan's case (container 1000×800, display 400×600, cursor offset 100/−50) has **no horizontal overflow**, so the symmetric pan clamp pins `panX` to 0 and the point under the cursor cannot stay fixed (fraction 0.75 → 0.667). Clamped anchoring is the specified behaviour, so the test case was the inconsistent part.
- **Fix:** The anchoring law is pinned on a both-axes-overflowing case (display 1200×900 at 1.5× inside 1000×800 → cursor-anchored to a 1800×1350 display; fractions equal within 1e-6), and the plan's own numbers are pinned separately as the graceful clamp degradation (`{x: 0, y: 25}`). The pure helper is also pinned directly.
- **Files:** `physicsPaintCanvasZoom.test.ts`
- **Committed in:** `e09a0b682`

**3. [Rule 2 - Missing Critical] A zoomed shell would be flex-shrunk back inside the tracks group**
- **Found during:** Task 3 (CSS)
- **Issue:** `.physics-paint-tracks-group > .demo-canvas-shell` is a flex item whose base rule carries `overflow: hidden`; with `overflow:hidden` its automatic minimum size is 0, so the default `flex-shrink: 1` clamps a zoomed shell back to the group's main size — a distorted sheet instead of a viewport-clipped overflowing one.
- **Fix:** Added a display-only rule scoped to the new viewport: `.physics-paint-canvas-zoom-pan .physics-paint-tracks-group > .demo-canvas-shell { flex: 0 0 auto; }`. The DOM outside the zoom viewport keeps today's flex behaviour; Fit renders identically (its inline size already equals the contained size).
- **Files:** `physicsPaintStudio.css`
- **Committed in:** `bdbbdc5b9`

**4. [Rule 1 - Bug] `clampPanToBounds` produced `-0` on the zero axes**
- **Found during:** Task 1 (test-driven)
- **Issue:** `Math.max(-0, Math.min(0, -50))` yields `-0`, which fails `toBe(0)` / `toEqual({x: 0})` and would make a “clamped to zero” comparison look different from zero.
- **Fix:** Normalize a clamped zero to `+0` before returning.
- **Files:** `physicsPaintCanvasZoom.ts`
- **Committed in:** `e09a0b682`

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical). No scope change: the feature is display-only and no engine/document/persistence/export/paint path was touched.

## Deferred / Out of Scope

- ~~Clicking a pill button bubbles a left `pointerdown` to the canvas region, clearing a Move/Select stroke selection.~~ **Addressed after the quick:** the pill is now selection-scoped chrome in `KEEP_SELECTION_WITHIN` (`scriptSelectionDeselect.ts`, test pinned in `scriptSelectionDeselect.test.ts`), commit `43cd118da`. Fit/1:1/minus/plus clicks keep the stroke set.
- Global wheel zoom on the whole Studio window (outside the canvas viewport) is not in scope; the pill and the viewport are the surface.

## Known Stubs

None. No TODO/FIXME/placeholder markers; the pill drives real store actions and the percent readout reflects the live ratio.

## Threat Flags

None beyond the plan's register. T-261104-UYV-01 (scale/pan clamping before every write), T-02 (16 MP backing budget, 1:1 always reachable, flat 400% refused on large sheets), T-03 (capture-phase button-1 consumption before the stack gates and the engine) and T-04 (local percent readout only) are implemented. No package installs, no manifest/lockfile change, no network/auth/file surface added.

## Live UAT — PENDING (user-run; never record as passed here)

| # | Row | Status |
|---|-----|--------|
| 1 | The Studio opens fitted with the zoom pill showing the fit percent (~36% for a 1080x1920 sheet) | **PENDING** |
| 2 | 1:1 reads 100% and one engine working pixel maps to one CSS pixel | **PENDING** |
| 3 | Fit restores the fitted view and keeps tracking window and side-panel resizes while in fit mode | **PENDING** |
| 4 | Pan by middle-drag and by plain wheel while zoomed; the sheet is clipped at the canvas viewport and no panel/dialog is overdrawn | **PENDING** |
| 5 | Cmd/Ctrl+wheel and macOS trackpad pinch zoom about the cursor with the point under the cursor held fixed | **PENDING** |
| 6 | Bounds-anchored overlays (fond, program monitor + above slice, onion, reference ghost and handles, background handles, brush ring, picker visor) stay glued to the sheet at every zoom and pan | **PENDING** |
| 7 | Painting at 1:1 lands under the pen (pointer and color-pick mapping exact after the shell grows) | **PENDING** |
| 8 | Space/F/C and the tool keys behave exactly as before; no new bare-key shortcut fires | **PENDING** |
| 9 | Clicking the zoom pill (minus, plus, Fit, 1:1) keeps a Move/Select stroke selection | **PENDING** |

## Next

- The orchestrator owns the docs commit (this SUMMARY, STATE.md). Nothing was pushed; no dev server was started.
- Live UAT rows 1-8 above are the gate before this quick can be marked approved.

## Self-Check: PASSED

- SUMMARY.md exists at the expected path (left uncommitted for the orchestrator).
- All five created files and the three modified files exist on disk.
- All three task commits (`e09a0b682`, `d32d87183`, `bdbbdc5b9`) are ancestors of HEAD.
- Measured ledger `5c91eb6b..bdbbdc5b9` = 3 commits, matching the frontmatter `commits: 3`.
- No `.planning/` artifact was committed, no `.planning/STATE.md` or ROADMAP change was made, and nothing was pushed.
