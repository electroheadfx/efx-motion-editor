---
phase: 261111-vg4-remove-the-stroke-settings-paint-tab
plan: 01
subsystem: ui
tags: [preact, signals, stroke-settings, vector-painting, tab-removal, source-pins, render-harness]

requires:
  - phase: 61-vector-painting-tool
    provides: Curve row (61-31), Anchor width control + D-09 law (61-11/61-22), list-first Stroke Settings view
  - phase: quick-261111-ucf
    provides: brush picks and paint-control releases editing the selected strokes (paint editing relocated to the sidebar/top bar)
provides:
  - Two-tab Stroke Settings sheet (Geometry | Stack) with a fixed tab set under every filter and selection state
  - Curve row mounted inside Geometry after the transform rows (single `applyCurveMode` call site, active-mode no-write guard)
  - Anchor width control mounted in Geometry under the transform rows and in the default list view on one shared `anchorWidthVisible` gate
  - Deletion of the Paint block, color readout, numeric/segmented rows and the four Paint-only model color exports
affects: [verification of quick 261111-vg4, remaining Phase 61 vector-painting work, any future Stroke Settings UI work]

actuals:
  tokens: 17056
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Two-tab fixed set: a narrowed tab union makes stale tab writers/readers compile errors"
    - "One visible gate + one component serving two mounts, each wrapper carrying its own testid"
    - "Source pins resolve the FIRST bare component block, so the component declaration stays after both mount wrappers"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts

key-decisions:
  - "Curve moved into Geometry verbatim (gate, Mixed caption, no-write guard and call site byte-identical) so the row survives the Paint removal without semantic change"
  - "The Anchor width control is mounted in Geometry on the same `anchorWidthVisible` gate and Size reading the list view uses; one component, two wrapper testids, D-09 semantics untouched"
  - "The Paint tab was deleted rather than hidden: the union narrowed to 'geometry' | 'stack', the availability law (selectionHasLift/paintTabAvailable) removed, and the Paint-only model color helpers deleted with their tests"
  - "The four Paint-only model exports were removed with no compatibility shim; a repo grep confirmed no production consumer besides the dialog and its tests"
  - "Per-stroke size/color/wet editing is untouched in the sidebar Paint/Brush tabs and top bar (quick 261111-ucf) — the dialog now edits geometry only"

patterns-established:
  - "Fixed tab set: no filter or selection state changes the rendered tab keys; only a missing commit seam can hide Stack"
  - "Two mounts of one control share a single visibility gate variable, pinned by declaration count and mount-gate count"
  - "Dialog source pins are written as positive/negative literal scans so a deleted surface (Paint/color/segmented rows) cannot silently return"

requirements-completed: [QUICK-261111-VG4]

coverage:
  - id: D1
    description: "The Stroke Settings sheet is Geometry | Stack only: two tabs render under every filter (Paint/Eraser/All) and with a selected lift stroke; Geometry is the default."
    requirement: QUICK-261111-VG4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#quick 261111-vg4 — the two-tab sheet"
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#puts Geometry and Stack on ONE pinned tab row, Geometry by default"
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#keeps the same two tabs under every filter and a selected lift stroke"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Curve row renders inside Geometry after the transform rows and nowhere else, with its seam gate, Mixed caption and single applyCurveMode call site intact."
    requirement: QUICK-261111-VG4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-31 Curve row (G-20)"
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#renders the Curve row inside Geometry and nowhere on Stack"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Anchor width control mounts in Geometry under the transform rows and in the default list view, sharing one gate and the same Size reading; empty/absent states render neither wrapper."
    requirement: QUICK-261111-VG4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-22 G-11 — the Anchor width control in the list view and Geometry"
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-22 G-11 — the Anchor width mounts (Geometry + list)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Paint tab, its block, color readout, numeric/segmented rows and in-map anchor mount are gone; readColorField/buildColorPatch/ColorFieldReading/NEUTRAL_STROKE_COLOR are deleted with their tests."
    requirement: QUICK-261111-VG4
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#leaves no Paint tab, block, color readout, field map or style behind"
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#switches content per tab and mounts no Paint content anywhere"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live UAT: only Geometry and Stack exist in a real watercolor stroke sheet; Curve switches a selected vector stroke between Bézier and Spline from Geometry; Anchor width drag/release works from both the list view and Geometry while the sidebar and top bar still edit size/color/wet."
    requirement: QUICK-261111-VG4
    verification:
      - "UAT PASSED 2026-11-11 (user-confirmed): the real watercolor sheet shows only Geometry and Stack, Curve switches the selected vector stroke between Bézier and Spline from Geometry, Anchor width commits from both the list view and Geometry, and the sidebar/top bar still edit size/color/wet for the selection"
    human_judgment: true
    rationale: "The plan required a live UAT row before calling the feature shipped; the automated suites prove the pins and render harness but cannot prove the visible sheet, the native drag feel or the untouched sidebar/top-bar edit paths — that row passed 2026-11-11."

duration: 14min
completed: 2026-11-11
status: complete
plan_head_before: 8549ab75ac69f3af583a5fb97e1d71645473efce
plan_head_after: 828b58f48fe86830d469fe62e31f3ce30aadffd9
---

# quick 261111-vg4: Remove the Stroke Settings Paint tab — Summary

**Two-tab Geometry | Stack sheet with the Curve row and both Anchor width mounts inside Geometry, and the Paint block plus its four model color helpers deleted**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-11T21:47:00Z (approx.)
- **Completed:** 2026-11-11T22:01:05Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `StrokeSettingsTab` narrowed to `'geometry' | 'stack'`; the pinned tab row renders exactly those two entries, Geometry by default, and no filter or selection state (Paint, Eraser, All, a selected lift stroke) can surface a third tab.
- The Curve row moved verbatim into the Geometry section after X/Y/Scale/Rotation — same gate, Mixed caption, `if (active) return;` guard and one `bundle.applyCurveMode?.(ids, option.mode)` call site — and renders nowhere else.
- The Anchor width control now mounts in Geometry under the transform rows AND in the default list view, sharing one `anchorWidthVisible` gate and the same Size reading for the same ids; one component declaration, D-09 semantics untouched.
- The Paint tab, its section, color readout, numeric/segmented rows and in-map anchor mount are deleted; `readColorField`, `buildColorPatch`, `ColorFieldReading` and `NEUTRAL_STROKE_COLOR` are removed with their tests, while `buildAppearancePatch`, `readNumericField`, the field registries and every anchor-width/curve/geometry/list export stay.
- Both suites retargeted: 211 targeted tests pass, the whole `physic-paint` suite passes (6400 tests), and the full repo run is green (8918 passed, 1 skipped, 96 todo).

## Task Commits

Each task was committed atomically:

1. **Task 1: Move the Curve row into Geometry** - `1804b7fce` (feat)
2. **Task 2: Mount Anchor width in Geometry on the shared visible gate** - `0f0ce348c` (feat)
3. **Task 3: Remove the Paint tab and its color helpers** - `828b58f48` (feat)

**Plan metadata:** not committed by the executor (docs commit is the orchestrator's).

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - two-tab union/registry, Curve row relocated into Geometry, second Anchor width mount, Paint branch and Paint-only styles/locals/imports deleted, stale comments corrected.
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - `ColorFieldReading`, `NEUTRAL_STROKE_COLOR`, `readColorField` and `buildColorPatch` deleted; everything else untouched.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - Curve region ends at Stack with a Geometry-first ordering chain; E4 component-body invariant; 61-22 count 2, both wrappers before the declaration; new two-tab positive/negative pins and model deletion pins.
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - color imports/tests removed, `renderDialogTab` narrowed, Size-row test retargeted to the Geometry Opacity commit, fields/shared-color suite shrunk, tab tests flipped to the fixed two-tab set, two eraser Paint-tab tests collapsed into one, free-entry counts pinned at 9/8, two describes retitled.

## Decisions Made

- Moved the Curve row verbatim rather than rewriting it, keeping the single `applyCurveMode` call site and the active-mode no-write guard as the load-bearing contract.
- Shared `anchorWidthVisible` between both mounts and gave each wrapper its own testid, preserving the E4 rule that the first bare `stroke-settings-anchor-width` block is the component body.
- Deleted the Paint surface outright (no hidden tab, no compatibility shim) because quick 261111-ucf made the sidebar/top bar the paint-editing home; the narrowed union turns any missed `'paint'` writer into a typecheck failure.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The new render helper initially returned `createBundle`'s `{ bundle, calls }` wrapper instead of `.bundle`, so the sheet read as closed and two Curve pins saw no block; fixed by returning the bundle and re-running the suite.
- The tab-registry count pin counted the type annotation's `{ key: StrokeSettingsTab…` literal; pinned on `{ key: '` (entry literals only) instead.
- Full gate results: typecheck clean; targeted suites 211 passed; `src/components/physic-paint` 6400 passed; repo-wide `vitest run` 426 files passed / 2 skipped (8918 passed, 1 skipped, 96 todo).

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None - the change removes surface (a whole tab and four helpers) and adds no endpoint, auth path, file access or schema change.

## Next Phase Readiness

- Shipped: the sheet is Geometry | Stack only, the Curve row and both Anchor width mounts live in Geometry, and the live UAT row (D5) passed on 2026-11-11 (user-confirmed) — Curve switches Bézier/Spline from Geometry, Anchor width commits from the list view and Geometry, and the sidebar and top bar still edit size/color/wet.
- Only the four listed files were staged; `packages/efx-watercolor/probe/vector-spine/result.json` and the pre-existing `.red-evidence` directories remain untouched.

---
*Phase: 261111-vg4-remove-the-stroke-settings-paint-tab*
*Completed: 2026-11-11*

## Self-Check: PASSED

- Four `files_modified` present on disk.
- Task commits `1804b7fce`, `0f0ce348c`, `828b58f48` are all ancestors of HEAD.
- Measured commits from the plan ledger (`8549ab75a..HEAD`) = 3.
