---
phase: quick-261022-ne3
plan: 261022-ne3
subsystem: ui
tags: [preact, signals, physic-paint, tools-popover, workflow-strip, scripts, push-tool]

# Dependency graph
requires:
  - phase: quick-260905-dso
    provides: relocated buffer Apply/Clear ports in the Tools popover — the guarded idiom and signal-reference pattern this quick reuses
provides:
  - Six cloned Scripts-toolbar actions in the Physic Paint Tools popover (Save, Load + Apply, Create Rail, Delete, Refresh, Copy)
  - Push mode group relocated after the delete-key button in the bottom action row
affects: [physic-paint-studio, roto-scripts-toolbar]

# Actuals (#2632) — same chars/4 scale as the plan estimate.
actuals:
  tokens: 11446
  tasks: 3
  commits: 3
plan_head_before: bb4c4562def69b805f505bb568ebb56b58c1ee63
plan_head_after: bcaf1013b632d9e1907b64f41020ddf5b687bd80

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Availability crosses into the memoized static chrome as plain values derived in the strip body from signal references read in render"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts

key-decisions:
  - "Clone the Scripts-toolbar actions as labeled buttons inside the Tools popover rather than moving them out of the right sidebar"
  - "Pass library availability, selected row, and play-script reason as ReadonlySignal references; derive plain values in the strip render body"
  - "Keep the Delete clone on rotoScriptLibrary.requestDelete() — the confirmation stays in the right-panel Scripts tab"
  - "Scope the historical icon-only Delete assertion to the action row so the new labeled popover clone does not falsify it"

# Metrics
duration: 5min
completed: 2026-10-22
status: complete
---

# Quick 261022-ne3: Bottom Timeline Buttons Arrangement Summary

**Six Scripts-toolbar actions cloned into the Physic Paint Tools popover above the preserved Apply/Clear row, and the Push mode group moved after the delete-key button**

Automated-ready: the targeted suites and typecheck for the touched files pass. The ten live-UAT rows below are PENDING — the quick is not validated until the user runs them.

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-22T14:56:00Z
- **Completed:** 2026-10-22T15:00:03Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Tools popover's Scripts section now shows Save, Load + Apply, Create Rail, Delete, Refresh, and Copy with visible labels, wrapping in a new `physics-paint-toolbox-scripts-row`, above the untouched Apply/Clear row.
- Each clone mirrors its right-panel twin: same controller action, same reason copy (`aria-disabled` only, reason span, guarded tooltip, Enter/Space prevention).
- Availability reaches the popover with zero new state and zero new effects: the three controller signals are read in the strip render body and passed to the memoized static chrome as plain values/stable callbacks.
- Push mode group moved verbatim to sit immediately after the delete-key (Trash2) button and before Duplicate; the row's class-scoped disarm guard is untouched.
- The popover max-height rose from 240px to 360px so the Scripts section is visible without an inner scrollbar.

## Task Commits

Each task was committed atomically:

1. **Task 1: Clone Save Script into the Tools popover end-to-end** - `8aa48720` (feat)
2. **Task 2: Clone the remaining five Scripts actions** - `c8e3c78a` (feat)
3. **Task 3: Move the Push mode group after the delete-key button** - `bcaf1013` (feat)

**Plan metadata:** not committed here — the orchestrator owns the docs commit (SUMMARY/PLAN/STATE).

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - new Scripts-row markup, strip/chrome ports + derivations, Push group relocated
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - six identity-stable handlers plus workflow wiring
- `app/src/components/physic-paint/physicsPaintStudio.css` - wrapping scripts row, popover max-height 360px
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - 261022-ne3 source-contract suite, new action-row order, scoped A7
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - superseded "Copy lives only in the panel" absence check replaced by the popover-clone contract

## Decisions Made

- Clones stay in the popover; the right sidebar is unchanged (plan scope).
- Availability is derived in the strip body (`props.rotoScriptLibraryAvailability?.value`, `props.rotoScriptLibrarySelected?.value`, `props.rotoScriptPlayDisabledReason?.value`) and handed down as plain values — the memoized static chrome receives no signal `.value` reads of its own beyond existing patterns.
- The Delete clone calls the existing `requestDelete()`; no second dialog was built (threat T-261022-NE3-01 mitigation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Obsolete assertion] Refreshed the Copy-lives-only-in-the-panel contract**
- **Found during:** Task 2 (remaining Scripts clones)
- **Issue:** `PhysicsPaintScriptsPanel.test.ts:291` asserted the strip source never contains `aria-label="Copy Script"` — directly contradicted by the planned Copy clone.
- **Fix:** Replaced the absence check with the new intentional-presence contract, keeping the real intent intact (no legacy `onCopyRotoScript`/`onApplyRotoScript` ports in the strip).
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
- **Verification:** full three-suite run green (214 tests).
- **Committed in:** `c8e3c78a`

**2. [Rule 1 - Over-broad assertion] Scoped A7's icon-only Delete check to the action row**
- **Found during:** Task 2 (remaining Scripts clones)
- **Issue:** A7 asserted the whole strip source never contains `>Delete</span>`, but the planned popover Delete clone carries the visible label `Delete`.
- **Fix:** Asserted against `getActionRowBlock(code)` instead — the assertion's meaning (this row's Delete is icon-only) is preserved; Push assertions are unchanged.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
- **Verification:** 147 strip tests green; Push block verified byte-identical before/after the move.
- **Committed in:** `c8e3c78a` (test scoping) and `bcaf1013` (order test)

---

**Total deviations:** 2 auto-fixed (2 obsolete/over-broad test contracts forced by the planned feature)
**Impact on plan:** No production-scope change; both edits are test-only and preserve the original assertions' intent.

## Issues Encountered

- `pnpm --dir app typecheck` is not clean at the repo level: pre-existing errors remain in untouched files (`PhysicsPaintPalette.test.ts`, `projectPaperRaster.test.ts`, `physicPaintBridge.ts`, `physicsPaintRotoBackgroundValidatorParity.test.ts`). Filtering the typecheck output for the files touched by this quick returns zero errors. Per the scope boundary, those pre-existing failures were left alone.
- A broader run of `src/components/physic-paint/view` (1288 tests) shows one unrelated, pre-existing failure: `PhysicsPaintWorkflowStrip.viewport.test.ts:834` still expects a `physics-paint-track-row-solo` chip that no longer exists in any source file (retired by quick 261022-iff). It is untouched by this quick and fails at HEAD; left alone per the scope boundary.
- The plan's `files_modified` did not list `PhysicsPaintScriptsPanel.test.ts`, but Task 2's verify command requires that suite green; the test-only deviation above resolves the contradiction.

## Live UAT — SUPERSEDED BY 261022-o2a

> This intermediate layout was replaced by quick **261022-o2a** (UAT approved 2026-10-22). The current contract is the Tools Scripts/Living Script split, the shared Script picker, the four-action sidebar toolbar and per-row hover delete recorded in that quick's summary. The rows below are kept as a historical record of the 261022-ne3 round.

| # | Row | Status |
|---|-----|--------|
| 1 | Bottom row order: Push (arrows icon) sits immediately after the trash icon and before Duplicate; every other control keeps its place | PENDING |
| 2 | Push behavior unchanged: click Push → arms (pressed); drag a Rail → pushes as before; another toolbar button or Escape disarms | PENDING |
| 3 | Popover layout: Tools → Scripts shows six labeled buttons (Save, Load + Apply, Create Rail, Delete, Refresh, Copy) across at least two lines, with Apply/Clear below, all reachable without scrolling the popover | PENDING |
| 4 | Save: click Save → a Script entry is captured/appears in the right-panel Scripts tab; unsaved project or running library operation greys it with the reason in the tooltip | PENDING |
| 5 | Load + Apply: with a script selected, reloads and applies the preset to the current Roto frame; no selection → "Select a project Script first." | PENDING |
| 6 | Create Rail: opens the existing Create Rail / Play Script dialog (same dialog as the sidebar) | PENDING |
| 7 | Delete: select a script, click Delete → confirmation appears in the right-panel Scripts tab; Cancel leaves it; confirming removes it | PENDING |
| 8 | Refresh: rescans the project folder (busy state visible) | PENDING |
| 9 | Copy: copies the script (Apply becomes available); nothing copyable → tooltip names the reason | PENDING |
| 10 | Existing Apply / Clear still behave exactly as before, and the popover still dismisses on an outside click | PENDING |

## Next Phase Readiness

- Automated surface is green (PhysicsPaintWorkflowStrip, PhysicsPaintScriptsPanel, physicsPaintToolboxPopover — 214 tests) and the touched files typecheck.
- User runs the live UAT table; the quick is only validated when those rows pass.
- No new dependencies, no controller changes, no changes to the right-panel toolbar.

---
*Quick: 261022-ne3*
*Completed: 2026-10-22 (automated-ready; live UAT pending)*

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/261022-ne3-bottom-timeline-buttons-arrangement-tool/261022-ne3-SUMMARY.md`
- Task commits found on HEAD: `8aa48720`, `c8e3c78a`, `bcaf1013`
- Modified key files present; targeted suites green (214 tests)
