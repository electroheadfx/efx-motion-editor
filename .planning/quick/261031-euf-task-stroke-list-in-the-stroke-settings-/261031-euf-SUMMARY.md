---
phase: 261031-euf-task-stroke-list-in-the-stroke-settings-
plan: 01
subsystem: paint
tags: [watercolor, stroke-list, fine-filters, preact-signals, tdd, quick]

# Dependency graph
requires:
  - phase: quick-261031-cf9
    provides: the watercolor Geometry/Stack/Paint sheet shell and the shared stroke-edition seam this list extends
provides:
  - "SelectableScriptStroke additive display metadata: tool, brushId, customResponse"
  - "Pure list laws: tool labels, type match, tip-name resolution, topmost-first sort, option derivation, filtering and the F-n summary"
  - "Fine-filter module state (tool + tip) reset at select-mode entry and on an actual type-filter change"
  - "The empty-selection stroke list surface with tool/tip dropdowns, summary line and both empty messages in the watercolor Stroke sheet"
affects: []

# Actuals (#2632) - same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 18678
  tasks: 2
  commits: 2
  plan_head_before: 915a96d01bccf1ddd5b46b83084a0f230de30f47
  plan_head_after: fae0f92ebf720a1a4d08fe75a665ec91061d80b7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-body-only signal reads; effective filters are derived, so a stale stored value renders All without a render-body write"
    - "Option derivation narrowed per axis: tool options from type rows, tip options from tool rows, so every offered combination yields at least one row"
    - "Orphaned tip reset computed inside the tool onChange from the NEW tool's rows, before the tool write"
    - "Compare-then-write filter setters mirroring the existing select-mode/type-filter choke points"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts

key-decisions:
  - "The list reads the existing aquarelleStrokeTypeFilter signal, so Paint/Eraser/All drives the list and the overlay/hit-test from ONE filter law"
  - "Tip options are derived from the tool-filtered rows, not the type rows, so the checker advisory holds: no offered tool/tip combination yields zero rows"
  - "Stale stored filters render as All via resolve helpers; the stored signal is never written from the render body"
  - "A tool change resets the tip only when the current tip is absent under the new tool, computed before writing the tool"
  - "Type toggles received filter-specific style copies with textTransform 'none'; the shared Stack/Paint segmented styles are untouched"

# Metrics
duration: 17min
completed: 2026-10-31
status: complete
---

# Quick 261031-euf: Stroke list in the Stroke settings sheet Summary

**The empty watercolor Move/Edit sheet now lists every recorded, non-deleted frame stroke topmost-first with tool/tip fine filters, a live summary and two distinct empty messages; clicking a row selects exactly that stroke and the Geometry/Stack/Paint tabs return**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-31T09:47:00Z
- **Completed:** 2026-10-31T10:04:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `SelectableScriptStroke` now carries additive display metadata (`tool`, `brushId`, `customResponse`) populated on both the paint and lift branches of `listSelectableAquarelleStrokes`; `customResponse` is true only when a `toolOverrides` multiplier differs from `NEUTRAL_TOOL_OVERRIDES`.
- Pure list laws in `strokeSettingsModel.ts`: `strokeToolLabel`, `matchesStrokeTypeFilter`, `resolveStrokeTipName` (fail-closed `findTip` with raw-id fallback), `sortStrokesTopmostFirst` (copy, stackPosition then serial), `listStrokeToolOptions`, `listStrokeTipOptions`, `filterStrokeListRows`, both resolve helpers and the exact `F{n} · {total} strokes · {paint} paint · {erasers} erasers` summary.
- The empty sheet renders one row button per type-filtered stroke with color dot, type, serial, stack position, tip name and an optional "Custom response" marker; the row click calls the existing replace setter `selectAquarelleStroke(mutationId)`, so the canvas outline follows and the tabs replace the list on the next render.
- Fine filters live in module state: `aquarelleStrokeToolFilter` / `aquarelleStrokeTipFilter` with compare-then-write setters, reset in `setAquarelleSelectMode` beside the type reset, and reset by `setAquarelleStrokeTypeFilter` only on an actual value change.
- Dialog fine-filter row: tool select limited to present tools in canonical Brush/Water/Pen/Eraser order; tip select rendered only with more than one tip; summary line; "No strokes on this frame." vs "No strokes match this filter.".
- Sheet-scoped CSS for the dark select, list row grid, hover/focus-visible states and meta classes; no existing rule changed and no uppercase transform on any new control.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end row — empty Move/Edit lists the frame's strokes, one click selects and the tabs return** - `0ee92e03b` (feat)
2. **Task 2: Finer filters, dropdowns, empty states, summary and sentence-case chrome** - `fae0f92eb` (feat)

**Plan metadata:** not committed by the executor (orchestrator owns the docs commit).

## Files Created/Modified

- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` - `ScriptStrokeTool` and the three additive `SelectableScriptStroke` fields
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - listing metadata, `hasCustomToolOverrides`, fine-filter signals/setters/reset, reset call sites
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - labels, type match, tip resolution, topmost-first sort, option/filter/summary laws
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - list rows, quick-click selection, fine-filter selects, summary, empty states, sentence-case chrome
- `app/src/components/physic-paint/physicsPaintStudio.css` - sheet-scoped select/list/row/meta rules appended only
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - model, dialog and CSS pins for the list and fine filters
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` - listing metadata, fine-filter state, reset choke points and port-isolation pins

## Decisions Made

- The list and the overlay/hit-test share `aquarelleStrokeTypeFilter`; no second type-filter source was introduced.
- Tool options derive from the type-filtered rows and tip options from the tool-filtered rows, satisfying the "never offer a zero-row combination" law structurally.
- Effective filters are computed with `resolveStrokeToolFilter` / `resolveStrokeTipFilter`; a stored filter the rows no longer offer renders as All without a render-body write.
- The orphaned tip is reset inside the tool `onChange` from the new tool's rows, before the tool write, so one gesture lands on a valid combination.
- Filter-specific style copies add `textTransform: 'none'` to the Paint/Eraser/All toggles without touching the Stack/Paint segmented styles.

## Deviations from Plan

None affecting implementation - the plan was executed as written.

## Issues Encountered

- Task 2 RED was captured as intended: all 175 targeted tests failed on the missing `resetAquarelleStrokeFineFilters` export before implementation, then went green.
- The first Task 2 typecheck flagged two imported label constants as unused (TS6133). They were wired into the dialog option-label assertions (`[ALL_TOOL_FILTER_LABEL, ...]`, `[ALL_TIP_FILTER_LABEL, ...]`) rather than deleted; the re-run was clean.

## Verification

- Task 2 targeted run: `strokeSettingsModel.test.ts`, `aquarelleStrokeSelection.test.ts`, `scriptStrokeEdition.test.ts`, `aquarelleRecordState.reorder.test.ts` - **208 passed**, typecheck clean (`tsc --noEmit`).
- Full app suite: **359 files passed | 2 skipped**, **6616 tests passed | 1 skipped | 96 todo** - zero regressions.
- No dependency added, no package change, no `dist` rebuild; rendering, hit-testing, selection semantics, persistence and schema are untouched; no Studio bundle change.
- Tracer task (Task 1) passed its automated verifies before expansion, so Task 2 proceeded without a halt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated-ready; the live Studio UAT of the visible list, fine filters, row click and empty messages is pending on the user's side.
- `gsd_run` is unavailable in this environment, so STATE.md / ROADMAP.md / requirements bookkeeping and the docs commit remain with the orchestrator (and ROADMAP is intentionally not updated for quick tasks).

---
*Plan: quick 261031-euf*
*Completed: 2026-10-31*

## Self-Check: PASSED

- All implementation files and this SUMMARY exist on disk.
- Both task commits (`0ee92e03b`, `fae0f92eb`) are ancestors of HEAD.
- Targeted suites, full app suite and typecheck are green.
