---
phase: 261111-vg4-remove-the-stroke-settings-paint-tab
verified: 2026-11-11T22:05:39Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/quick/261111-vg4-remove-the-stroke-settings-paint-tab/261111-vg4-PLAN.md
  - .planning/quick/261111-vg4-remove-the-stroke-settings-paint-tab/261111-vg4-SUMMARY.md
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
covered_digest: "v4:sha256:848c6ae85ad1f6b5d87972249c4eb44d63541b038096f6e6bbe26f88595ffda1"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open a watercolor stroke sheet (Move/Select with one or more strokes) and inspect the settings tab row in every filter (Paint / Eraser / All) and with a lift stroke selected."
    expected: "Exactly Geometry and Stack tabs; Geometry selected by default; no Paint tab or Paint content anywhere."
    why_human: "The render harness proves the VDOM shape, but the visible sheet chrome, tab row and absence of a third tab in the real Studio window are visual."
  - test: "In Geometry, switch a selected vector stroke between Bézier and Spline, then press the already-active mode."
    expected: "One press writes one curve-mode change; pressing the active mode writes nothing (no undo entry). The row sits under the transform rows."
    why_human: "The source pin proves the `if (active) return;` guard and the single `bundle.applyCurveMode` call site, but the click-to-document write and visible lit state are live behavior."
  - test: "Open Edit path on a single watercolor vector stroke, then drag and release Anchor width from the default list view AND from Geometry while the sidebar Paint/Brush tabs and top bar edit size/color/wet for the selection."
    expected: "Both mounts read the same Size and commit through the same seam; a drag outside an open path edit shows the refusal line; sidebar/top-bar paint edits still land on the selected strokes."
    why_human: "Native drag feel, the refusal toast and the cross-surface interaction cannot be exercised by the render harness."
---

# Quick 261111-vg4: Remove the Stroke Settings Paint tab — Verification Report

**Task Goal:** The Stroke Settings dialog becomes Geometry | Stack only; paint editing lives in the sidebar Paint/Brush tabs and the top bar. Move the Curve row and the Anchor width mount into Geometry, delete the Paint block, prune Paint-only model helpers, and retarget the tab-row and Paint-tab test suites.
**Verified:** 2026-11-11T22:05:39Z at HEAD `828b58f48` (`gsd/phase-61-vector-painting-tool`)
**Status:** passed — all code-level must-haves verified, and the visible live-UAT rows below were confirmed by the user on 2026-11-11
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The sheet is Geometry \| Stack only: two tabs, Geometry default, no filter/selection can surface a third tab | ✓ VERIFIED | `PhysicsPaintStrokeSettingsDialog.tsx:186` `type StrokeSettingsTab = 'geometry' \| 'stack';`; registry 188-191 has exactly the two entries; tab row 1198-1217 filters only Stack-without-seam (1199); default signal `'geometry'` at 445; stack fallback only at 691-693. Zero occurrences of `paintTabAvailable` / `selectionHasLift`. Tests: dialog.test.ts:622-636 (union + 2 entry literals); model test renders only `geometry`/`stack` under `paint`/`lift`/`all` filters and a selected lift stroke (strokeSettingsModel.test.ts:822-847, 1544-1576). |
| 2 | The Curve row lives in Geometry after X/Y/Scale/Rotation; mounts only for watercolor + vector + commit seam; active-mode press writes nothing; one `bundle.applyCurveMode(ids, mode)` call site | ✓ VERIFIED | Dialog 1508-1554 sits inside the `activeSettingsTab === 'geometry'` / `liveCenter` branch after Rotation (1480-1493) and before the Stack section (1563); gate literal at 1513; `if (active) return;` at 1544; single call `void bundle.applyCurveMode?.(ids, option.mode);` at 1545 (grep: 1 call-site literal, 2 total mentions incl. the gate). Dialog test 439-495 pins the Geometry→rotation→curve→stack chain, `countOf('bundle.applyCurveMode?.(') === 1`, and no `readVectorAnchors`/`anchorWidth`/`readNumericField` inside the block. Model test 3740-3764 renders the block on Geometry, not Stack, and not without the seam. |
| 3 | Anchor width mounts in Geometry under the transform rows AND in the default list view; both read the same Size reading for the same ids through one gate and the same `bundle.applyAnchorWidths` seam, with D-09 semantics untouched | ✓ VERIFIED | One gate declaration at 745 (`anchorWidthVisible = anchorWidthAvailable && anchorWidthSizeReading !== null`); list mount 1348-1358 (`stroke-settings-list-anchor-width`), Geometry mount 1497-1507 (`stroke-settings-geometry-anchor-width`, after Rotation 1480-1493 and before Curve 1513); both pass `reading={anchorWidthSizeReading}`, `anchorWidthReading`, `anchorWidthTarget`; one component declaration 1677-1736. D-09 model block untouched by the diff (only color helpers were deleted): constants 903-906 (0.2 / 2 / 0.1 / 1), `anchorWidthPatchValue` clamp 981-984, `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` 936, `resolveAnchorWidthTarget` 859-871, `applyAnchorWidths?.` commit 1716. Tests: dialog.test.ts:505-608 (one gate, two mount gates, mount 2 / declaration 1 / bare block inside component); model test 3594-3674 (Geometry + list wrappers, both absence cases, D-09 empty stepper + caption). |
| 4 | The Paint tab/block is gone (no color readout, no per-field numeric/segmented rows, no in-block anchor mount) and per-stroke size/color/wet editing stays reachable from the untouched sidebar/top bar | ✓ VERIFIED | Zero occurrences in the dialog of `data-testid="stroke-settings-paint"`, `data-testid="stroke-settings-color"`, `paintTabAvailable`, `selectionHasLift`, `segmentedFields`, `hexToRgba`, `colorReading`, `colorRgb`, `COLOR_BLOCK_STYLE`, `COLOR_READOUT_ROW_STYLE`, `numericFields.map`. `git diff --name-status 8361488d1..828b58f48` = the plan file + exactly the four listed files; sidebar/top-bar/library/docker files byte-identical. Reachability proof: top bar keeps size/pigment/water controls (`PhysicsPaintTopBar.tsx`), and the quick-ucf seam is covered and green — `PhysicsPaintTopBar.test.ts:880`, `BrushResponsePanel.test.ts:215`, `PhysicsPaintRightPanel.test.ts:1212`, `WatercolorBrushLibrary.test.ts:609`, `AquarelleGlobalsPanel.test.ts:269`. Render harness mounts no Paint content in any tab or the list (model test 849-873); dialog test 638-648. |
| 5 | The four Paint-only model color helpers are removed while the other helpers/registries/seams stay | ✓ VERIFIED | `git diff` of `strokeSettingsModel.ts` is exactly the 28-line deletion of `ColorFieldReading`, `NEUTRAL_STROKE_COLOR`, `readColorField`, `buildColorPatch` — no other hunk. Survivors present: `BRUSH_SETTINGS_FIELDS` (62), `WATERCOLOR_SETTINGS_FIELDS` (85), `strokeSettingsFields` (104), `readNumericField` (232), `buildAppearancePatch` (265), `readCurveMode` (162), the `applyCurveMode?` bundle contract (646), `resolveAnchorWidthTarget` (859), anchor constants (903-906), `readAnchorWidthReading` (944), `anchorWidthEffectivePx` (970), `anchorWidthPatchValue` (981), geometry/list laws. Repo-wide grep for the four removed names outside negative test pins: 0 consumers. Typecheck clean. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | Two-tab sheet with Curve + Anchor width in Geometry, Paint block deleted, list mount preserved | ✓ VERIFIED | 1738 lines; exists, substantive, imported and mounted at `PhysicsPaintStudioView.tsx:38,590`; data flows from the Studio-built bundle. |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Same model minus the four Paint-only color exports | ✓ VERIFIED | 984 lines; diff is the four deletions only; imported by the dialog, tests and Studio test suite. |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` | Source pins for two-tab sheet, Geometry curve, two anchor mounts, paint removal | ✓ VERIFIED | 733 lines, 43 tests pass; negative pins 639-644, model pins 665-668, curve region 436/449-456, mount pins 505-608. |
| `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` | Render-harness coverage of the final shape | ✓ VERIFIED | 3765 lines, 168 tests pass; `renderDialogTab` narrowed to `'geometry' \| 'stack'` (285-288); tab/render pins 822-873, 1544-1576; anchor mounts 3594-3674; curve 3740-3764. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PhysicsPaintStrokeSettingsDialog.tsx` | `strokeSettingsModel.ts` | Geometry Curve row calls `bundle.applyCurveMode?.(ids, option.mode)`; both Anchor mounts call `bundle.applyAnchorWidths` through the one `AnchorWidthControl` | ✓ WIRED | Call sites 1545 and 1716; bundle contract at model 646; production bundle builds both seams at `PhysicsPaintStudio.tsx:11637` and `:11655` (file untouched). |
| `PhysicsPaintStrokeSettingsDialog.test.ts` | `PhysicsPaintStrokeSettingsDialog.tsx` | Curve region ends at the Stack testid; anchor pins resolve the FIRST bare anchor block inside the component declaration | ✓ WIRED | Test 436 ends `curveBlock()` at `stroke-settings-stack`; test 582-593 asserts both wrappers precede `function AnchorWidthControl(` and the bare block follows it. Code order: list mount 1348, Geometry mount 1497, declaration 1677, bare block 1681. |
| `strokeSettingsModel.test.ts` | `PhysicsPaintStrokeSettingsDialog.tsx` | `renderDialogTab`'s `'geometry' \| 'stack'` union makes any leftover Paint render call a typecheck failure | ✓ WIRED | Signature at 285-288; no `renderDialogTab(..., 'paint')` remains; typecheck exit 0. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Dialog Geometry rows | `appearances`, `selectedVectorAnchors`, `geometrySession`, `stroke.stackPosition` | `bundle.readAppearance` / `bundle.readVectorAnchors` / `bundle.listStrokes` passed from `PhysicsPaintStudio.tsx` | Yes — Studio bundling at 11637/11655 wires real per-stroke reads and commits | ✓ FLOWING |
| Anchor width (both mounts) | `anchorWidthSizeReading`, `anchorWidthReading`, `anchorWidthTarget` | `readNumericField(appearances, ids, size)` + `readAnchorWidthReading(selectedVectorAnchors, vectorAnchorSelection)` + `resolveAnchorWidthTarget` | Yes — no static fallback; empty state is the explicit D-09 constant | ✓ FLOWING |
| Curve row | `curveModeReading` | `readCurveMode(appearances)` over hydrated vector appearances | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck (strict, noUnusedLocals over `src`) | `pnpm --filter efx-motion-editor run typecheck` | exit 0, no diagnostics | ✓ PASS |
| Two targeted suites | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts` | 2 files, 211 passed (43 + 168), 900 ms | ✓ PASS |
| Whole physic-paint suite | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint` | 252 files, 6400 passed, exit 0 | ✓ PASS |
| Repository-wide `vitest run` (incl. `viteBuild.test.ts`) | `pnpm --filter efx-motion-editor exec vitest run` | 426 files passed / 2 skipped; 8918 passed, 1 skipped, 96 todo; exit 0; vite build 1706 kB main / 1171 kB Studio chunk (under the 2 MB ceiling) | ✓ PASS |

### Probe Execution

No probes are declared or implied by this quick (not a migration/CLI phase; PLAN/SUMMARY mention none). Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-261111-VG4 | 261111-vg4-PLAN.md | Two-tab Stroke Settings; Curve + Anchor width in Geometry; Paint tab/block and Paint-only model helpers removed; suites retargeted; scope limited to four files | ✓ SATISFIED | Truths 1-5 above; commit range `8361488d1..828b58f48` touches only the plan plus the four files; full gate green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX/TODO/HACK/placeholder markers, no empty-return stubs in the four changed files | — | — |
| `PhysicsPaintStrokeSettingsDialog.tsx` | 102-105 | Stale pre-existing comment: "a read-only thumb shows the selected strokes' color" — the thumb was deleted with the Paint tab. The corrected quick-vg4 paragraph at 111-113 immediately states the Paint tab is gone and paint editing lives in the sidebar/top bar | ℹ️ Info | Comment-only; no code or behavior impact. Worth a one-line cleanup in a future touch of this file. |

### Human Verification Required

> **UAT RESULT: PASSED** — user-confirmed 2026-11-11. All three rows below passed in the live Studio.

#### 1. Two-tab sheet under every filter

**Test:** Open a watercolor stroke sheet and inspect the settings tab row with the Paint, Eraser and All filters, and with a lift stroke selected.
**Expected:** Exactly Geometry and Stack tabs; Geometry selected by default; no Paint tab or Paint content.
**Why human:** Visual tab row in the live Studio window; the harness proves the VDOM, not the rendered surface.

#### 2. Geometry Curve switch

**Test:** In Geometry, switch a selected vector stroke between Bézier and Spline; then press the already-active mode.
**Expected:** One press applies one curve-mode change; pressing the active mode writes nothing (no undo entry).
**Why human:** The source pin proves the guard and single call site, but the live commit and lit state are runtime behavior.

#### 3. Anchor width from both mounts + untouched paint editing

**Test:** Open Edit path on one vector stroke; drag/release Anchor width from the default list view and from Geometry; meanwhile edit size/color/wet from the sidebar Paint/Brush tabs and top bar.
**Expected:** Both mounts agree on the same Size; a commit outside an open path edit shows the refusal line; sidebar/top-bar paint edits still land on the selection.
**Why human:** Native drag feel, refusal surfacing and cross-surface interaction cannot be exercised by the render harness.

### Gaps Summary

None. All five must-have truths are verified in the live tree at HEAD `828b58f48` with deterministic evidence (source anchors, grep counts, render-harness assertions, and reproduced test runs). The phase goal — a Geometry | Stack-only Stroke Settings sheet with the Curve row and both Anchor width mounts inside Geometry and the Paint tab plus its four model color helpers deleted — is achieved in code. The live UAT row (D5) recorded above passed on 2026-11-11 (user-confirmed), so the feature is shipped, not merely automated-ready.

---

_Verified: 2026-11-11T22:05:39Z_
_Verifier: Claude (gsd-verifier)_
