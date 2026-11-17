---
phase: 64-medium-engine
plan: 09
subsystem: ui
tags: [watercolor, emboss-light, document-light, right-panel, paper-tab, preact-signals, slider-stepper]

# Dependency graph
requires:
  - phase: 64-05
    provides: the durable per-document `light` member on the paint-layer record and its ONE `setDocumentLight` mutation (wrap/clamp bands, null descriptor on a same-value write)
  - phase: 64-07
    provides: the Studio's `documentLight()` render-time getter, the `handleDocumentLightChange` ledger-recording handler, and the package `DEFAULT_LIGHT` threading through every render path
provides:
  - the right panel's Paper tab relabelled `Paper & Light`, with three controlled `SliderStepper` rows (Azimuth / Elevation / Intensity) BELOW the paper-grain pair in one Light option group
  - the `light` / `onLightChange` prop pair through `PhysicsPaintRightPanel` into the single `RightPanelPaperTab` mount
  - the Studio's `rightPanelProps` entries `light: documentLight()` and `onLightChange: handleDocumentLightChange`, with no new memo dependency
  - the removal of the 64-07 `void handleDocumentLightChange;` placeholder
affects: [64-10, 64-11, 64-12]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 5620
  tasks: 2
  commits: 2
plan_head_before: 7d38aa899e657ffe78fda7802bb09eba4af43444
plan_head_after: 93b205f49bc312af7d50cc203326599db1d89009

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document-is-the-state row: the three light rows are controlled from `props.light ?? DEFAULT_LIGHT` and emit ONE-FIELD patches upward; the tab holds no signal, no useState and no copied object, and never calls the store"
    - "One write port through the panel: the Studio's `handleDocumentLightChange` is threaded unchanged as `onLightChange`, so the panel and tab carry no mutation and the ledger entry stays in the Studio handler"
    - "Memo-dependency reuse: `light: documentLight()` joins `rightPanelProps` without a new dep entry because `efxPaintVersion.value` already subscribes the factory to every document mutation, `setDocumentLight` included"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/RightPanelPaperTab.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "`DEFAULT_LIGHT` is the only default source: the tab falls back `props.light ?? DEFAULT_LIGHT`, so the triple is never retyped in the app (the spec's no-retyped-default prohibition) and an absent light renders exactly the explicit default"
  - "Row geometry mirrors the store bands rather than re-clamping: Azimuth step 1 / 0..360 / precision 1, Elevation step 1 / 0..90 / precision 2, Intensity step 0.1 / 0..4 / precision 2 — `setDocumentLight` remains the only place that wraps azimuth and clamps elevation/intensity"
  - "The label change is scoped to `TOP_PANE_TAB_LABELS.paper` only: the tab id `'paper'`, its order and its `aria-label=\"Paper\"` stay untouched, and the moduleGate / RightPanel label pins were REPOINTED, never deleted"
  - "No new memo dependency: `efxPaintVersion.value` already re-runs `rightPanelPropsMemo`, so the light read refreshes on every document edit with zero identity churn elsewhere"
  - "Task 2's behavioural row drives the deps surface against the real store (`registerDocument` + `setDocumentLight` + `efxPaintVersion`) instead of mounting the Studio, because the node vitest env collects only `*.test.ts` and cannot import the Studio; the Studio wiring itself is pinned by source scan (the 64-07 precedent)"

requirements-completed: [MED-17]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The Paper tab carries three controlled rows (Azimuth/Elevation/Intensity) below the paper picker in one Light option group, fed by the document light with the package DEFAULT_LIGHT fallback and one-field upward patches"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#64-09 Paper & Light tab"
        status: pass
    human_judgment: false
  - id: D2
    description: "The panel threads `light` and `onLightChange` into the single RightPanelPaperTab mount, and the Paper tab label reads `Paper & Light` with the id, order and aria-label unchanged"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts#top-pane tab row is fixed to Color + Brush + Paper + Memory"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#is the LAST top-pane tab in watercolor mode (after Color/Brush/Paper)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Studio's rightPanelProps carries `light: documentLight()` and `onLightChange: handleDocumentLightChange` with no new memo entry and no second light state; the 64-07 void placeholder is gone; the deps surface delivers the document light and one-field writes with one version bump"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#64-09 — the right panel is fed by the document light"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT: moving each of the three light rows re-lights the live aquarelle sheet without painting a stroke, and the top-pane tab reads `Paper & Light`"
    verification: []
    human_judgment: true
    rationale: "Re-lighting the live sheet is a visual judgement over the WebGL2 canvas. The node vitest env collects only *.test.ts and never mounts PhysicsPaintStudio.tsx or the canvas layer, so no automated row can prove the visible re-light; the live sheet is run by the user."

# Metrics
duration: 1h 49m
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 09: Paper & Light Summary

**The document light's one UI home: the Paper tab becomes `Paper & Light` with three controlled rows driving `setDocumentLight` through the Studio's single handler**

## Performance

- **Duration:** 1h 49m
- **Started:** 2026-11-17T15:28:35Z
- **Completed:** 2026-11-17T17:17:31Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- The right panel's Paper tab is now `Paper & Light` and carries Azimuth / Elevation / Intensity rows below the paper-grain pair, in one Light option group.
- The rows are controlled by the paint-layer document's light with the package `DEFAULT_LIGHT` fallback and emit one-field patches upward — no local state, no second signal, no store call from a view.
- The Studio feeds the panel with `light: documentLight()` and `onLightChange: handleDocumentLightChange` in `rightPanelProps`, with no new memo dependency, and the 64-07 `void handleDocumentLightChange;` placeholder is gone.

## Task Commits

Each task was committed atomically:

1. **Task 1: Paper & Light tab with three document-light rows** - `f52a3edfb` (feat)
2. **Task 2: feed the right panel from the Studio's document light read** - `93b205f49` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified
- `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` - three light `SliderStepper` rows below the PaperPicker, `light` / `onLightChange` props, `DEFAULT_LIGHT` fallback
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - `light` / `onLightChange` props threaded into the single tab mount, `TOP_PANE_TAB_LABELS.paper = 'Paper & Light'`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `rightPanelProps` gains `light: documentLight()` and `onLightChange: handleDocumentLightChange`; void placeholder removed
- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` - new `64-09 Paper & Light tab` source-scan block (4 rows)
- `app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts` - label pin repointed to `Paper & Light`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` - tab-label pin repointed to `Paper & Light`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - new `64-09` block: 4 source pins + 1 behavioural row over the real store

## Decisions Made
- The tab falls back `props.light ?? DEFAULT_LIGHT` — the document is the state, and the triple is never retyped in the app.
- Row geometry mirrors the store bands; `setDocumentLight` stays the only wrap/clamp authority.
- The label change touches `TOP_PANE_TAB_LABELS.paper` only; id, order and `aria-label` stay untouched and the pins were repointed, never deleted.
- No new memo dependency — `efxPaintVersion.value` already refreshes `rightPanelProps` on every document edit.
- The Task 2 behavioural row drives the deps surface against the real store, since the node env cannot import/mount the Studio; the Studio wiring is pinned by source scan.

## TDD Gate Compliance

- The plan is `type: execute` and no task carries `tdd="true"` or a `<behavior>` block, so the behaviour-adding gate does not fire and `gsd_run check tdd-red-evidence` is not required.
- RED was nonetheless captured inline before each task's implementation:
  - Task 1: 3 failed files / 6 failed | 55 passed across the paper-single-home, module-gate and right-panel suites — all six failures on the planned anchors (missing light rows and the old `Paper` label pins).
  - Task 2: `PhysicsPaintStudio.test.ts` — 2 failed | 436 passed; exactly the two planned wiring failures (`onLightChange: handleDocumentLightChange` absent from `rightPanelProps`, and `void handleDocumentLightChange;` still present).
- GREEN: the four plan test files ran 499 passed; `tsc --noEmit` exited 0.
- Per the plan's atomic-task instruction, each task is one commit containing its tests and implementation together; the RED evidence is recorded here rather than as separate JSON artifacts.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The node-env vitest harness collects only `*.test.ts` and cannot import `PhysicsPaintStudio.tsx`, so Task 2's behavioural row was designed to drive the same deps surface (`registerDocument` + `setDocumentLight` + `efxPaintVersion`) directly against the real store, with the Studio wiring additionally source-pinned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The light is now adjustable in the product: every render path 64-04..64-07 touched reads the same persisted document light these rows write.
- The live UAT row is ready for the user: move each of the three rows and watch the live sheet re-light without painting a stroke; the tab reads `Paper & Light`.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Files present: the SUMMARY itself plus the seven modified plan files (no new source files were created)
- Commits present and ancestors of HEAD: `f52a3edfb`, `93b205f49`, and the metadata commit `ff40140e0`
- Measured plan span: `7d38aa899..93b205f49` = 2 commits (frontmatter `commits: 2`)
- Suites: the four plan test files ran 499 passed; `tsc --noEmit` exit 0
