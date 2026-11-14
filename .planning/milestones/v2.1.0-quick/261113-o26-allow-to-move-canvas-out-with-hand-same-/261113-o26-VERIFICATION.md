---
phase: 261113-o26-allow-to-move-canvas-out-with-hand-same-
verified: 2026-11-13T16:37:18Z
status: human_needed
score: 6/6 must-haves verified
covered_files: [".planning/quick/261113-o26-allow-to-move-canvas-out-with-hand-same-/261113-o26-PLAN.md", ".planning/quick/261113-o26-allow-to-move-canvas-out-with-hand-same-/261113-o26-SUMMARY.md", "app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx", "app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx", "app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts", "app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts", "app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts", "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts", "app/src/stores/canvasStore.test.ts", "app/src/stores/canvasStore.ts"]
covered_digest: "v4:sha256:447521d0e2e751398d2e92c094dd4b9ac2dc51d29ada8ab8547d5b668b348ca3"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Studio at Fit (the opening view): press and HOLD the Hand in the floating zoom pill and drag in each of the four directions."
    expected: "The sheet follows the pointer and can be pushed entirely off the right, left, bottom and top edges."
    why_human: "Real pointer capture and CSS transform behavior in the Studio window cannot be exercised from node/vitest; only the store law and handler wiring are automatable."
  - test: "Studio at 1:1: middle-drag the sheet."
    expected: "The sheet moves freely past the old half-overflow limit in every direction."
    why_human: "Middle-button drag is a live pointer interaction; the gate removal is pinned structurally but not exercised end-to-end."
  - test: "Studio with the sheet pushed off-screen: press Fit."
    expected: "The sheet returns, centered and fitted."
    why_human: "Visual recovery flow; the store reset is unit-tested, the rendered result is not."
  - test: "Studio: close and reopen the Studio."
    expected: "Every open starts fitted and centered (no stray pan survives)."
    why_human: "Fresh-document window lifecycle; requires the real Studio open path."
  - test: "Main editor at Fit: hold Space and drag, and middle-drag, in all four directions."
    expected: "The canvas moves freely and can leave the frame."
    why_human: "Live Space-held overlay routing and pointer events cannot be exercised from node/vitest."
  - test: "Main editor with the canvas pushed off-screen: press F and the zoom pill's Fit."
    expected: "The canvas returns, centered and fitted."
    why_human: "Keyboard binding and rendered recovery are live-app behavior."
  - test: "Regression: at a zoomed-in state on both surfaces, paint/select still lands under the pointer after a pan."
    expected: "No mapping drift — the pan layer is translate-only."
    why_human: "Client-rect-derived pointer mapping must be observed live."
  - test: "Regression: plain two-finger wheel/trackpad scroll over the Studio at Fit."
    expected: "Still left to the platform (no capture, no jump)."
    why_human: "Trackpad gesture ownership is a platform/runtime behavior."
---

# Quick 261113-o26: Free Canvas Pan on Both Surfaces — Verification Report

**Task Goal:** Allow moving the canvas out with the Hand even when not zoomed in — push the canvas paint to the right, left, bottom or top at full size or full zoom-out, on BOTH the Physic Paint Studio sheet and the main editor canvas (D-01/D-02: free pan, no retention rule, Fit restores).
**Verified:** 2026-11-13T16:37:18Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | In the Physic Paint Studio, the Hand press and middle-drag pan the sheet with NO bound at Fit, at 1:1, and at every zoom between; an 800x700 region can push the sheet entirely off any edge (D-01/D-02) | ✓ VERIFIED | `physicsPaintCanvasZoom.setPan` writes `sanitizePan(x/y)` with no bounds (`physicsPaintCanvasZoom.ts:319-323`). Hand path: `PhysicsPaintCanvasZoomBar.tsx:85-88` calls `setPan(startPan + delta)` on every session pointermove with no scale/overflow gate (press begins unconditionally at `:69-72`). Middle-drag: `PhysicsPaintCanvasZoomViewport.tsx:135-152` `onPointerDown` carries no `hasOverflow`, pointermove at `:158` calls `setPan`. Tests `physicsPaintCanvasZoom.test.ts:174-189`: at Fit (`hasOverflow.value === false`) `setPan(5000,-5000)` is preserved; at 1:1 `setPan(9999,-9999)` is preserved. 44/44 targeted tests pass. |
| 2 | In the main editor, Space-drag and middle-drag pan the canvas with NO bound at Fit or 1:1; the canvas can be pushed entirely off any edge (D-01) | ✓ VERIFIED | `canvasStore.setPan` (`canvasStore.ts:99-111`) sanitizes and compare-writes each axis with no bounds; `clampPan` deleted with all four call sites (`zoomIn`, `zoomOut`, `setSmoothZoom`, `setPan` — verified in diff). Write path: `CanvasArea.tsx:128-131` `handlePointerMove` → `canvasStore.setPan`. Entry points: middle button `CanvasArea.tsx:116-122`; Space-held routing in `PaintOverlay.tsx:1088` and `TransformOverlay.tsx:217`. Tests `canvasStore.test.ts:23-37` preserve (5000,-5000) at Fit and (9999,-9999) at zoom 2; 6/6 pass. |
| 3 | Recovery is unchanged and already exists on both surfaces: Studio Fit button + `resetForStudioOpen` on every open, main-editor Fit button + F key + `menu:fit-to-window` reset the pan to (0,0); no recovery UI is added | ✓ VERIFIED | Studio: `fitToWindow()` zeroes the pan (`physicsPaintCanvasZoom.ts:294-298`), `resetForStudioOpen()` zeroes it (`:330-335`) and runs on every mount (`PhysicsPaintCanvasZoomViewport.tsx:34-37`); Fit button `onClick={() => physicsPaintCanvasZoom.fitToWindow()}` (`PhysicsPaintCanvasZoomBar.tsx:156`). Main: `canvasStore.fitToWindow()` zeroes pan (`:127-128`); Fit button `CanvasArea.tsx:352` → `toggleFitLock()` → `fitToWindow()`; F key `shortcuts.ts:426-433`; `menu:fit-to-window` `main.tsx:187`. Tests: reset cases at `physicsPaintCanvasZoom.test.ts:291-303` and `canvasStore.test.ts:48-54`. The diff adds no JSX/recovery element. |
| 4 | A non-finite pan can never reach a pan signal: both `setPan`s write only `Number.isFinite` values and `-0` normalizes to `+0`, so compare-then-write idempotence holds | ✓ VERIFIED | Identical sanitizer in both stores: `Number.isFinite(value) ? (value === 0 ? 0 : value) : 0` (`physicsPaintCanvasZoom.ts:66-68`, `canvasStore.ts:39-41`); the anchored-pan result is sanitized too (`:166`); every other pan write is a literal 0. Compare-then-write via `setSignal`/`Object.is` (zoom store `:210-214`, `:321-322`; canvas store `:109-110`). Tests: NaN/Infinity → 0 and `Object.is(-0, 0)` normalization (`physicsPaintCanvasZoom.test.ts:191-199`, `canvasStore.test.ts:39-46`); repeat write notifies zero times (`physicsPaintCanvasZoom.test.ts:305-346`, `canvasStore.test.ts:65-79`). |
| 5 | The Studio plain-wheel pan stays gated on `hasOverflow`; the `hasOverflow` computed survives and is consumed by exactly one wheel gate | ✓ VERIFIED | `grep -c hasOverflow` → viewport 1, store 2. Sole consumer: `PhysicsPaintCanvasZoomViewport.tsx:99` inside `onWheel`. Computed declared `physicsPaintCanvasZoom.ts:197`, exported `:276`. Wiring pins slice the `onPointerDown` block and assert no `hasOverflow` (`physicsPaintCanvasZoomWiring.test.ts:124-134`), and the `onWheel` block asserts `physicsPaintCanvasZoom.hasOverflow.peek()` (`:136-144`). |
| 6 | Everything else is byte-identical: fit sizing, zoom ladder, backing-pixel budget, `clampZoomScale`, `nextScalePreset`, fit/reset pan resets, the Hand press-and-hold lifecycle, and every paint/document/persistence/export path | ✓ VERIFIED | `git diff --stat` vs plan base touches exactly the 8 planned files (168 insertions, 128 deletions). No hunk touches `resolveFitScale`, `getContainedCanvasDisplaySize`, the ladder constants, `PHYSICS_PAINT_ZOOM_BACKING_BUDGET`, `clampZoomScale`, `nextScalePreset`, or the `fitToWindow`/`resetForStudioOpen` pan resets. `PhysicsPaintCanvasZoomBar.tsx` diff is one docblock sentence (Hand JSX/lifecycle untouched). Regression: `PhysicsPaintStudio.test.ts` 413/413; typecheck exit 0. No paint/document/persistence/export file is in the diff. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

None — no gaps require later-phase deferral.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts` | Free Studio pan; clamps deleted; sanitizer kept; unbounded `setPan` | ✓ VERIFIED | `gsd_run query verify.artifacts`: exists, no issues, passed. Diff confirms `resolveMaxPan`, `clampPanToBounds`, `reClampPan` deleted; `sanitizePan` added; `setPan` unbounded; `hasOverflow` intact. Wired: imported by viewport, zoom bar, mount, view. |
| `app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts` | Free-pan pins replace clamp pins | ✓ VERIFIED | Exists, no issues, passed. Contains free-pan at Fit/1:1, non-finite sanitize, resize keeps pan, exact anchored pan, resets, idempotence. All pass. |
| `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx` | Middle-button pan unconditional; wheel gate and capture untouched | ✓ VERIFIED | Exists, no issues, passed. Diff is exactly one deleted gate line plus comment prose; capture-phase registration, coalescer, pointer capture and wheel gate unchanged. Wired via `PhysicsPaintStudioView` (pinned in wiring test). |
| `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx` | Corrected Hand docblock; free-pan law | ✓ VERIFIED | Exists, no issues, passed. Docblock now states the pan is free at every zoom and Fit is the recovery. No JSX/handler/style change in the diff. Wired via `PhysicsPaintStudioView`. |
| `app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts` | Source pins: no gate on middle press, wheel still gated, store exports `hasOverflow` | ✓ VERIFIED | Exists, no issues, passed. New describe at `:124-145` asserts all three. |
| `app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts` | Comment-only correction; every assertion unchanged | ✓ VERIFIED | Exists, no issues, passed. Diff is one comment line; the `beginBlock` no-`hasOverflow` assertion and all others unchanged. |
| `app/src/stores/canvasStore.ts` | Free main-editor pan; `clampPan` deleted; sanitizing compare-write `setPan` | ✓ VERIFIED | Exists, no issues, passed. `grep -c clampPan` → 0; docblock documents the free-pan law and recovery. Wired via `CanvasArea` and `main.tsx`. |
| `app/src/stores/canvasStore.test.ts` | Focused node test for the free-pan law | ✓ VERIFIED | Exists, no issues, passed. 6 cases, 80 lines: Fit, zoomed-in, sanitizer, Fit recovery, zoom keeps pan, repeat-write idempotence. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PhysicsPaintCanvasZoomBar.tsx` | `physicsPaintCanvasZoom.ts` | `setPan(startPanX + dx, startPanY + dy)` on every hand-session pointermove | ✓ WIRED | Import at `:3`; sole Hand write path at `:85-88`; no scale/overflow gate. |
| `PhysicsPaintCanvasZoomViewport.tsx` | `physicsPaintCanvasZoom.ts` | `setPan(...)` from middle-drag pointermove; `onPointerDown` no longer consults `hasOverflow.peek()` | ✓ WIRED | Import at `:3`; pointermove write at `:158`; wheel-flush write at `:57`; `onPointerDown` block (`:135-152`) contains no `hasOverflow`. |
| `CanvasArea.tsx` | `stores/canvasStore.ts` | `canvasStore.setPan(startPan + delta / zoom)` in `handlePointerMove`; `fitToWindow()` remains recovery | ✓ WIRED | Import at `:14`; write at `:128-131`; `fitToWindow` at `:227`, `:236`; Fit control `:352`. |
| `main.tsx` | `stores/canvasStore.ts` | `menu:fit-to-window` → `canvasStore.fitToWindow()` | ✓ WIRED | Import at `:16`; listener at `:187`; untouched by the diff. |

> Note (tooling, not a defect): `gsd_run query verify.key-links` reports all four as `verified: false, detail: "Target not referenced in source"` because the plan's `to:` values are repo-relative file paths and the verb's no-`pattern` branch does a literal `sourceContent.includes(to)` substring test (`gsd-core/bin/lib/verify.cjs:1788-1795`), which cannot match a relative import specifier. All four connections were verified by direct source inspection (import + call site above); none is missing or partial.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PhysicsPaintCanvasZoomPanLayer` | `panX` / `panY` signals | Pointer deltas from the Hand session and middle-drag write `physicsPaintCanvasZoom.setPan` | Yes — user input drives `translate(...)`; no static fallback | ✓ FLOWING |
| Main-editor canvas wrapper (`CanvasArea.tsx:420`) | `canvasStore.panX` / `panY` | `handlePointerMove` writes `canvasStore.setPan` from live pointer deltas | Yes — real drag input flows into `transform: scale(z) translate(...)` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Free-pan law on both stores + structural pins | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts src/stores/canvasStore.test.ts` | 4 files, 44/44 tests passed | ✓ PASS |
| Type safety after signature/field removal | `pnpm --prefix app run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| Studio regression sweep | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | 413/413 passed | ✓ PASS |
| Clamp machinery deleted | `grep -rnE "resolveMaxPan\|clampPanToBounds\|reClampPan\|clampPan\(" app/src --include="*.ts" --include="*.tsx" \| wc -l` | 0 (plan baseline 23) | ✓ PASS |
| One wheel-gate consumer | `grep -c hasOverflow PhysicsPaintCanvasZoomViewport.tsx` | 1 (plan baseline 2) | ✓ PASS |
| `hasOverflow` computed survives | `grep -c hasOverflow physicsPaintCanvasZoom.ts` | 2 (computed + export) | ✓ PASS |
| `canvasStore` clamp gone | `grep -c clampPan app/src/stores/canvasStore.ts` | 0 (plan baseline 5) | ✓ PASS |
| No out-of-store pan writes | `grep -rn "panX.value\s*=\|panY.value\s*=" app/src --include="*.ts" --include="*.tsx"` excluding the two stores | No matches | ✓ PASS |
| Scope containment | `git diff --name-only 409c86b1f..HEAD` | Exactly the 8 planned files | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | `find scripts -path '*/tests/probe-*.sh'` + PLAN/SUMMARY probe grep | No probes declared or found; this is not a migration/tooling phase | SKIPPED (not applicable) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-261113-O26 | `261113-o26-PLAN.md` | Free Hand/middle-drag pan on both canvases, no bound, Fit restores (D-01/D-02) | ✓ SATISFIED | Both stores' pan laws are unbounded and sanitized; both write paths wired; recovery paths untouched; 44/44 targeted + 413/413 regression green. |

Quick tasks are not tracked in `.planning/REQUIREMENTS.md` (no entry expected); no orphaned requirement maps to this task.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintCanvasZoom.test.ts` | QUICK-261113-O26 | 20 | 0 | No | Value + behavioral (exact pan values at Fit/1:1, resize, resets) | ✓ |
| `physicsPaintCanvasZoomWiring.test.ts` | QUICK-261113-O26 | 8 | 0 | No (readFileSync only) | Structural slice + negative grep | ✓ |
| `physicsPaintHandToolWiring.test.ts` | QUICK-261113-O26 | 10 | 0 | No (readFileSync only) | Structural slice + negative grep | ✓ |
| `canvasStore.test.ts` | QUICK-261113-O26 | 6 | 0 | No | Value + behavioral (Fit/zoom/sanitize/reset/idempotence) | ✓ |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None: no TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, no stub returns, no hardcoded empty props, no console.log in the 8 changed files | — | — |

### Decision Coverage

Not evaluated — the quick task has no `CONTEXT.md` (and therefore no `<decisions>` block). The two locked user decisions were verified directly instead: D-01 both canvases (truths 1 and 2) and D-02 no retention rule (clamp machinery deleted, not widened). The user-declared out-of-scope items are intact: the Studio plain-wheel `hasOverflow` gate survives (truth 5), and fit sizing, zoom ladder, and the Hand press-and-hold lifecycle are untouched (truth 6).

### Human Verification Required

1. **Studio Hand pan at Fit**
   **Test:** Press and HOLD the Hand in the floating zoom pill and drag in each of the four directions.
   **Expected:** The sheet follows the pointer and can be pushed entirely off the right, left, bottom and top edges.
   **Why human:** Live pointer capture and CSS transform behavior in the Studio window.

2. **Studio middle-drag at 1:1**
   **Test:** Middle-drag the sheet at 1:1.
   **Expected:** It moves freely past the old half-overflow limit in every direction.
   **Why human:** Live pointer interaction; the gate removal is pinned structurally only.

3. **Studio Fit recovery**
   **Test:** Push the sheet off-screen, then press Fit.
   **Expected:** The sheet returns, centered and fitted.
   **Why human:** Rendered recovery flow.

4. **Studio reopen reset**
   **Test:** Close and reopen the Studio.
   **Expected:** Every open starts fitted and centered; no stray pan survives.
   **Why human:** Fresh-document window lifecycle.

5. **Main editor free pan at Fit**
   **Test:** Hold Space and drag (and middle-drag) in all four directions at Fit.
   **Expected:** The canvas moves freely and can leave the frame.
   **Why human:** Live Space-held overlay routing and pointer events.

6. **Main editor Fit recovery**
   **Test:** With the canvas pushed off-screen, press F and the zoom pill's Fit.
   **Expected:** The canvas returns, centered and fitted.
   **Why human:** Keyboard binding and rendered recovery in the live app.

7. **Pointer mapping regression after pan**
   **Test:** At a zoomed-in state on both surfaces, paint/select after panning.
   **Expected:** Marks still land under the pointer; no mapping drift.
   **Why human:** Client-rect-derived mapping must be observed live.

8. **Studio plain-wheel regression at Fit**
   **Test:** Two-finger wheel/trackpad scroll over the Studio at Fit.
   **Expected:** Still left to the platform — no capture, no jump.
   **Why human:** Platform gesture ownership.

### Gaps Summary

None. The two independent clamps are deleted (not disabled, not widened), both pan setters write sanitized unbounded values compare-then-write, the Studio middle press is unconditional while the plain-wheel `hasOverflow` gate is preserved, and every recovery path is untouched. The automated layer is complete and green (44/44 targeted, 413/413 regression, typecheck exit 0) with no stubs, debt markers, skipped tests, or out-of-scope file changes. The phase goal is not claimed as live-validated: the eight native UAT rows above belong to the user, so the status is `human_needed` — automated-ready until live UAT.

---

_Verified: 2026-11-13T16:37:18Z_
_Verifier: Claude (gsd-verifier)_
