---
phase: 61-vector-painting-tool
plan: 22
subsystem: ui
tags: [preact, signals, vector-path, stroke-settings, anchor-width, selection-ring, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-11 the E4 Anchor width block and its source-region pins, 61-19 the inert no-path-edit law (ANCHOR_WIDTH_EMPTY_READING / ANCHOR_WIDTH_NO_EDIT_REASON), 61-09/61-10 the path-edit seam and vectorAnchorSelection
provides:
  - "AnchorWidthControl — the one internal control, declared after the sheet component, mounted under Size in the Paint tab and in the default list view"
  - "anchorWidthListVisible / anchorWidthSizeReading — the list-view mount gate and its shared Size reading"
  - "the vector-path-anchor-selection ring — one accent ring per selected anchor of the open edit's path"
affects: []

actuals:
  tokens: 5623
  tasks: 2
  commits: 4
  plan_head_before: 0e571856496a1967661407d3f7645c00239a1e80
  plan_head_after: 60707964371d5ef53f62831ecf872e8e702d6664

tech-stack:
  added: []
  patterns:
    - "Extract-then-mount-twice: the shipped inline block becomes one hoisted component declared AFTER its host so the shipped source-region ordering pin (first block occurrence after the gate) keeps its meaning"
    - "Selection-derived mount gate: anchorWidthAvailable && a Size reading of the same ids, and a conditional wrapper that renders no empty node when the gate closes"
    - "Additive render-only chrome: a sixth renderPath parameter fed with drawn.selected ? anchorSelection : [] keeps renderPath pure and confines rings to the open edit's path"
    - "Fail-closed boundary pin with a positive control, so a zero-ring assertion on HEAD cannot pass vacuously"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts

key-decisions:
  - "Extraction, not a second copy: one AnchorWidthControl with one stepper, one clamp and one commit seam, declared after the sheet component so the shipped blockAt > gateAt pin resolves the component body (G-11, prohibition 1/4)"
  - "The list-view gate reuses anchorWidthAvailable, which already implies exactly one selected vector stroke, plus a Size reading of the same ids — a multi-selection or anchorless stroke mounts nothing (T-61-68)"
  - "The ring renders only for drawn.selected paths: the open edit receives the selection, every other recorded path and the pen draft receive an empty list, so renderPath stays a pure function of its arguments"
  - "The ring is additive and accent-only (#38bdf8): a rect sized anchorSizePx + 6 for a bezier anchor, a circle with r = coreRadiusPx + 3 otherwise, with missing points failing closed (T-61-69)"

requirements-completed: [VEC-02, VEC-03]

coverage:
  - id: D1
    description: "The default list view mounts AnchorWidthControl behind anchorWidthListVisible inside a stroke-settings-list-anchor-width wrapper, ordered after the stroke rows inside the list container, with no empty node when the gate closes (G-11, T-61-68)"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-22 G-11 — the Anchor width control in the list view > mounts the control in the default list view behind anchorWidthListVisible"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sheet contains exactly TWO AnchorWidthControl mounts (list branch + inside the field.key !== 'size' gate) and exactly ONE function declaration with ONE root stroke-settings-anchor-width block"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-22 G-11 — the Anchor width control in the list view > shares ONE component between the two mounts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The component body keeps every shipped E4 identifier (anchorWidthEmpty derivation, mixed, the one commit seam, the clamp and the exact px template), still exactly one SliderStepper and no style attribute in the shipped region"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-22 G-11 — the Anchor width control in the list view > keeps every shipped E4 identifier inside the component body"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 E4 rows: the Anchor width block (all ten shipped pins unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The component declaration sits AFTER the field.key !== 'size' gate, so the shipped first-occurrence ordering pin keeps passing"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-22 G-11 — the Anchor width control in the list view > declares the component AFTER the Paint-tab gate"
        status: pass
    human_judgment: false
  - id: D5
    description: "The list-view mount is fed the Size reading of the SAME ids (anchorWidthSizeReading), so the px readout cannot disagree between the two mounts"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-22 G-11 — the Anchor width control in the list view > feeds the list-view mount the Size reading of the SAME ids"
        status: pass
    human_judgment: false
  - id: D6
    description: "A selection of [1] draws exactly one ring around the SECOND anchor's projected point, a circle for an auto anchor with fill none and non-scaling stroke; index 0 wears none"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-22 G-11 — the selected-anchor ring > draws one ring around the selected anchor and none for an unselected index"
        status: pass
    human_judgment: false
  - id: D7
    description: "An empty selection draws zero rings and an out-of-range index fails closed without throwing, while a valid index in the same law still draws exactly one (positive control)"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-22 G-11 — the selected-anchor ring > fails closed on an empty or out-of-range selection"
        status: pass
    human_judgment: false
  - id: D8
    description: "Only the open edit's path wears a ring: a second recorded vector stroke on the same frame stays ring-free even with an index in the selection"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-22 G-11 — the selected-anchor ring > rings only the open edit's path, never a second recorded vector stroke"
        status: pass
    human_judgment: false
  - id: D9
    description: "The ring uses SELECTED_SPINE_COLOR only and the file introduces no colour literal beyond the shipped #38bdf8 / #111111 / #ffffff / #f59e0b palette"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-22 G-11 — the selected-anchor ring > static: the ring is accent-only and adds no colour literal"
        status: pass
    human_judgment: false
  - id: D10
    description: "Plan-level integration: both suites pass together and the app type-checks clean"
    requirement: VEC-03
    verification:
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts src/components/physic-paint/engine/VectorPathOverlay.test.ts -> 100 passed (37 + 63)"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit -> exit 0"
        status: pass
    human_judgment: false
  - id: D11
    description: "Live judgment: the sheet's default list view shows the Anchor width control for one vector stroke and the px value follows the dragged factor; with no path edit the control is inert with its reason; a selected anchor wears a visible ring and loses it on deselect"
    requirement: VEC-03
    verification:
      - kind: manual
        ref: "61-22-PLAN.md <verification> UAT rows A (list-view control visible, drag moves that vertex's width), B (inert + ANCHOR_WIDTH_NO_EDIT_REASON with no path edit), C (ring on the selected anchor, gone on deselect)"
        status: pending
    human_judgment: true
    rationale: "The pins prove the mount gate, the one-component extraction, the ring geometry and the colour law; only the user can judge the visible discoverability and the live width response in the Studio."

# Metrics
duration: 4min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 22: Anchor Width Discoverability and Selected-Anchor Ring Summary

**One `AnchorWidthControl` now sits in the sheet's default list view as well as the Paint tab, and the open edit's selected anchors wear an accent ring — the two missing pieces of feedback behind G-11**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-11T11:15:25Z
- **Completed:** 2026-11-11T11:19:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extracted the shipped E4 Anchor width block into ONE internal `AnchorWidthControl`, declared AFTER the sheet component (a hoisted `function`) and mounted twice: under Size in the Paint tab at the shipped gate, and in the default list view inside `stroke-settings-list-anchor-width` behind `anchorWidthListVisible`.
- Derived the list-view gate without a new signal or effect: `anchorWidthAvailable && anchorWidthSizeReading !== null`, where the Size reading uses the SAME `appearances` and `ids`. `anchorWidthAvailable` already implies exactly one selected vector stroke, so a multi-selection or anchorless stroke mounts nothing (T-61-68).
- Kept every shipped E4 identifier in the component body: the `anchorWidthEmpty` derivation, `mixed={anchorWidthReading.mixed}`, the single `bundle.applyAnchorWidths?.(` commit, `anchorWidthPatchValue(value)`, the `→ {n} px` template, one `<SliderStepper>` and no `style=` in the pinned region. All ten 61-11/61-19 E4 pins stay green.
- Read `vectorAnchorSelection.value` once in the overlay render body and extended `renderPath` with a sixth `selectedAnchors` parameter, fed `drawn.selected ? anchorSelection : []` at both call sites — only the open edit's path receives the selection.
- Emitted one `vector-path-anchor-selection` ring per selected index that resolves to a projected point, between the anchor markers and the handles: a `rect` sized `anchorSizePx + 6` for a bezier anchor, a `circle` with `r={coreRadiusPx + 3}` otherwise, `fill="none"`, `stroke={SELECTED_SPINE_COLOR}`, `strokeWidth={1.5}`, `vectorEffect="non-scaling-stroke"`. Missing anchors skip (T-61-69) and no colour literal was added.
- Added five dialog pins and four overlay pins in `61-22 G-11` describes; the overlay fail-closed pin carries a positive control so its zero-ring assertion cannot pass vacuously.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the list-view Anchor width mount (G-11)** - `522116903` (test)
2. **Task 1 GREEN: mount the Anchor width control in the default list view (G-11)** - `934a7ec52` (feat)
3. **Task 2 RED: pin the selected-anchor ring (G-11)** - `31ae6cd7c` (test)
4. **Task 2 GREEN: draw the selected-anchor ring on the open edit path (G-11)** - `607079643` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - the extracted `AnchorWidthControl`, the list-view gate derivations and the second mount (100 added, 40 removed)
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - the `61-22 G-11` list-view describe, five pins (32 → 37 tests)
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - the render-body selection read, the sixth `renderPath` parameter, the ring block and both updated call sites (56 added, 2 changed)
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - the `61-22 G-11` selected-anchor-ring describe, four pins (59 → 63 tests)

## Decisions Made

- The extraction is the only shape that satisfies both mounts and the shipped source-region pins: the component is declared after the sheet, so the first `stroke-settings-anchor-width` occurrence still sits after the `field.key !== 'size'` gate.
- The list view reuses `anchorWidthAvailable` rather than a second selection predicate — one law for "the width commit may target this stroke" and one commit seam.
- The ring is a pure render output of a parameter, not a second signal read inside `renderPath`: the open edit's path receives the selection, every other path and the pen draft receive `[]`.
- The fail-closed overlay pin includes a valid-index positive control, so on HEAD it fails for the right reason rather than passing on absent behaviour.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The working tree carried pre-existing modifications from the previous plan's close (`packages/efx-watercolor/probe/vector-spine/result.json`) and untracked `.red-evidence` directories from earlier plans (61-03 through 61-19). All were deliberately left unstaged; only 61-22 files were committed.
- The overlay fail-closed pin initially passed on HEAD because both of its assertions expected zero rings. It was strengthened with a positive control before the RED record was written; the final RED shows 4 failed | 59 passed of 63.

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence .planning/phases/61-vector-painting-tool/.red-evidence/61-22-t1/red-record.json` → `RED_EVIDENCE_OK`, reason `target_test_failed` (5 failing / 32 passing of 37: all five new pins). Target: `61-22 G-11 — the Anchor width control in the list view > mounts the control in the default list view behind anchorWidthListVisible`. GREEN: 37/37.
- Task 2: `gsd_run check tdd-red-evidence .planning/phases/61-vector-painting-tool/.red-evidence/61-22-t2/red-record.json` → `RED_EVIDENCE_OK`, reason `target_test_failed` (4 failing / 59 passing of 63: all four new pins; all 59 shipped overlay cases stayed green). Target: `61-22 G-11 — the selected-anchor ring > draws one ring around the selected anchor and none for an unselected index`. GREEN: 63/63, then 100/100 across both plan suites.
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED. Evidence lives under `.planning/phases/61-vector-painting-tool/.red-evidence/61-22-t1/` and `61-22-t2/` (`junit.xml`, `red-record.json`, `run-start.txt`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-11 is closed: the per-vertex width control is visible in the sheet's DEFAULT list view for a single selected vector stroke, and a selected anchor of the open path edit is visibly distinct on the canvas.
- The width law is untouched (D-09): still one `SliderStepper`, one clamp `anchorWidthPatchValue`, one commit seam `bundle.applyAnchorWidths`, and the 0.2..2.0 multiplier band.
- Live UAT rows for the user (from the plan's verification): A. select one vector stroke and open the sheet — the Anchor width control is visible in the default list view; grab an anchor and drag the control so the stroke's width follows that vertex. B. with no path edit open the list-view control is inert and its caption says to open Edit path. C. click an anchor while editing — it wears a ring; click empty canvas or another stroke and the ring is gone.
- No blockers. Out of this gap-closure scope and untouched: spline curve editing (61-30/61-31), drag lifecycle (61-28), paint re-bake (61-29), overlay colour/opacity conformance (61-25).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
- FOUND: app/src/components/physic-paint/engine/VectorPathOverlay.tsx
- FOUND: app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
- FOUND: 522116903
- FOUND: 934a7ec52
- FOUND: 31ae6cd7c
- FOUND: 607079643
