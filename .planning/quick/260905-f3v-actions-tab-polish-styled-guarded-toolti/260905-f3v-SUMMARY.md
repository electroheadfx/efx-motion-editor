---
phase: quick-260905-f3v
plan: 260905-f3v
subsystem: ui
tags: [preact, physic-paint, guarded-tooltip, linked-rails, a11y, css]

# Dependency graph
requires:
  - phase: quick-260905-dso
    provides: shared IconButton guarded-tooltip helper (aria-disabled + styled tooltip + no native title)
provides:
  - Guarded Previous/Next Linked Rails nav with ChevronLeft/ChevronRight icons, 'Previous Rail'/'Next Rail' labels, and boundary reasons in the tooltip
  - Contextual Edit Rail button in the list view when the playhead is on the current linked rail
  - Readable script rows (transparent default background, near-white name + provenance/count sub-lines)
  - Contract/harness tests locking the toolbar guarded idiom, nav buttons, Edit Rail, and row CSS
affects: [Phase 53 Integrated v1.0.0 Acceptance, native UAT of the Actions tab]

# Actuals (#2632) — pairs with the plan's `estimate` (30000 tokens) to calibrate future estimates.
actuals:
  tokens: 6769    # chars/4 over the realized diff (27075 chars)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded IconButton idiom extended with className/wrapperClassName props so non-toolbar controls (nav buttons) reuse the same aria-disabled + styled-tooltip contract without altering toolbar rendering"
    - "Contextual control gated by a derivation that reuses the nav selection's own range (cursorOnCurrentLinkedRail from effectiveLinkedGroup) so the button and the selection can never disagree"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts

key-decisions:
  - "The plan's Task 1 test spec ('aria-describedby when a disabledReason is present' per button) is asserted at the shared IconButton helper level, because the Delete Action and Refresh Actions buttons (pre-existing from 260905-dso) do not pass descriptionId; the styled tooltip still shows the reason, so the must-have truth is met. Logged to deferred-items.md."
  - "handleEditCurrentLinkedGroup is declared after the effectiveLinkedGroup derivation (TDZ-safe) and added to the right-panel memo deps alongside cursorOnCurrentLinkedRail so the memo never goes stale."

patterns-established:
  - "Guarded nav buttons: IconButton with className='physics-paint-loop-clip-inspector-action' fills its grid cell (flex: 1 1 auto), aria-disabled grey-out mirrors the native :disabled colors pinned on hover/focus-visible, and the contextual Edit Rail spans the full row via grid-column: 1 / -1."

requirements-completed: [ACC-01]

coverage:
  - id: D1
    description: "Every toolbar button routes through the guarded IconButton idiom (aria-disabled, styled tooltip, no native title) with de-prefixed tooltip grammar and the Delete button ref preserved for the cancel focus flow"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#Physics Paint Scripts panel guarded toolbar contract (260905-f3v)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Linked Rails Previous/Next are guarded IconButtons with ChevronLeft/ChevronRight icons, 'Previous Rail'/'Next Rail' labels, boundary reasons in the tooltip, and a contextual Edit Rail in the list view only when the playhead is on the current linked rail"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#Physics Paint Actions inspector linked Group navigation (43.2-15)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Script rows readable by default: transparent row background, near-white name and provenance/count sub-lines, distinct #7e9cff selected border, hover and focus-visible preserved"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#Physics Paint Scripts panel readable rows contract (260905-f3v)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-05
status: complete
---

# Phase quick-260905-f3v: Actions tab polish — guarded toolbar tooltips, Linked Rails nav with icons + contextual Edit Rail, readable script rows

**Guarded Previous/Next Linked Rails nav with ChevronLeft/ChevronRight icons and boundary reasons, a contextual Edit Rail in the list view gated on the playhead being on the current linked rail, readable near-white script rows on a transparent panel background, and contract/harness tests locking the toolbar guarded idiom, nav buttons, Edit Rail, and row CSS.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T11:00:00Z
- **Completed:** 2026-09-05T11:12:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Locked the guarded-tooltip toolbar idiom (already shipped by 260905-dso) with contract tests: every toolbar button routes through the shared IconButton helper with `disabledReason`, the helper renders `aria-disabled` (never native `disabled`), the styled tooltip uses the de-prefixed `unavailable: {reason}` grammar, and the rendered button element carries no native `title=` attribute.
- Converted the Linked Rails Previous/Next buttons in BOTH renderings (inspector and list) to the guarded IconButton idiom with ChevronLeft/ChevronRight icons, 'Previous Rail'/'Next Rail' labels, and boundary reasons ('Already on the first linked Rail' / 'Already on the last linked Rail') in the tooltip; the single-rail 'Go to Rail' / 'Go to Group' case is unchanged.
- Added a contextual Edit Rail button (Pencil) in the list view, rendered only when the playhead is on the current linked rail; the Studio derives `cursorOnCurrentLinkedRail` from `effectiveLinkedGroup`'s own range and wires `cursorOnCurrentRail` + `onEditCurrent` through the right-panel memo deps.
- Made script rows readable by default: transparent row background (1px border keeps separation), near-white `#eef1f4` provenance/count sub-lines matching the name, distinct `#7e9cff` selected border, hover and focus-visible preserved.
- Full app suite green (3455 passed) and `tsc --noEmit` clean (ACC-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify the guarded-tooltip toolbar idiom and lock it with contract tests** - `7880f52e` (test)
2. **Task 2: Linked Rails nav — guarded Previous/Next with icons + contextual Edit Rail** - `732abb30` (feat)
3. **Task 3: Script rows readable by default** - `cc113daa` (feat)

**Plan metadata:** `5144c0fe` (docs: plan)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` - ChevronLeft/ChevronRight imports; `linkedGroupNavigation` props extended with `cursorOnCurrentRail`/`onEditCurrent`; `previousRailReasonId`/`nextRailReasonId`; IconButton gains `className`/`wrapperClassName` props; Previous/Next converted to guarded IconButton in both renderings; contextual Edit Rail added to the list view.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `cursorOnCurrentLinkedRail` derivation reusing `effectiveLinkedGroup`'s range; `handleEditCurrentLinkedGroup` useCallback (TDZ-safe, declared after the derivation); `linkedGroupNavigation` object extended; memo deps array gains `cursorOnCurrentLinkedRail` + `handleEditCurrentLinkedGroup`.
- `app/src/components/physic-paint/physicsPaintStudio.css` - nav guarded-button rules (wrapper flex, button fills cell, icon no-shrink, label nowrap, aria-disabled grey-out pinned on hover/focus-visible, Edit Rail full-row span); script-row readability rules (transparent default background, near-white sub-lines).
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - toolbar guarded-tooltip contract tests, updated 43.2-15 nav assertions, Edit Rail harness test, Studio wiring assertions, script-row CSS contract tests.

## Decisions Made
- The plan's Task 1 test spec ("aria-describedby when a disabledReason is present" per button) is asserted at the shared IconButton helper level rather than per-button, because the Delete Action and Refresh Actions buttons (pre-existing from 260905-dso) do not pass `descriptionId`. The styled tooltip still shows the reason, so the plan's must-have truth is met; the gap is logged to `deferred-items.md`.
- `handleEditCurrentLinkedGroup` is declared after the `effectiveLinkedGroup` derivation to avoid a TDZ/use-before-declaration error, and both new values are added to the right-panel memo deps so the memo never goes stale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] handleEditCurrentLinkedGroup placed after the effectiveLinkedGroup derivation**
- **Found during:** Task 2 (Linked Rails nav)
- **Issue:** Placing the useCallback next to `handleOpenRotoLoopEdit` (as the plan's line reference suggested) referenced `effectiveLinkedGroup` before its declaration — `tsc` failed with TS2448/TS2454.
- **Fix:** Declared `handleEditCurrentLinkedGroup` immediately after the `cursorOnCurrentLinkedRail` derivation (which is after `effectiveLinkedGroup`), keeping the same deps `[effectiveLinkedGroup, handleOpenRotoLoopEdit]`.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Verification:** `tsc --noEmit` clean; full suite green.
- **Committed in:** 732abb30 (Task 2 commit)

### Deferred (not auto-fixed)

**2. [Rule 2 consideration - Missing accessibility path] Delete/Refresh toolbar buttons lack `descriptionId`**
- **Found during:** Task 1 (toolbar contract tests)
- **Issue:** The Delete Action and Refresh Actions buttons route through the shared IconButton helper with `disabledReason` but no `descriptionId` prop (pre-existing from 260905-dso). When disabled, the sr-only reason span and `aria-describedby` are absent for these two buttons — the styled tooltip still shows the reason, so the plan's must-have truth is met, but the screen-reader announcement path is incomplete. The plan's context note claimed all five buttons carry `descriptionId`; the code does not.
- **Fix:** Not fixed — the plan explicitly forbids production-code changes in Task 1, and the gap is pre-existing (out of scope per the scope boundary rule). Logged to `deferred-items.md`.
- **Files modified:** none
- **Verification:** n/a (deferred)

---

**Total deviations:** 1 auto-fixed (Rule 3), 1 deferred (Rule 2 consideration)
**Impact on plan:** The auto-fix was necessary for type-correctness. The deferred item does not block the plan's must-have truths. No scope creep.

## Issues Encountered
- The node-environment harness does not expand function components, so the guarded nav/Edit Rail buttons surface as IconButton vnodes exposing `props.label`/`props.disabled` rather than rendered `aria-label`/`aria-disabled`. The harness tests assert the guarded `disabled` prop and the source-code assertions verify the rendered `aria-disabled` path.
- `getScriptsToolbarBlock` now includes the Linked Rails nav section (which sits between the toolbar and the list), so the second-row guarded-count test was scoped to the toolbar div only.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Actions tab toolbar, Linked Rails nav, and script rows are ready for native UAT (user-driven, no server start by Claude): hover each toolbar button enabled and unavailable — styled tooltip with reason copy; Linked Rails Previous/Next show icons + labels + boundary reasons; Edit Rail appears in the list view when the playhead is on the current linked rail and edits it; script rows readable by default with a distinct selected state.
- Deferred: Delete/Refresh `descriptionId` gap tracked in `deferred-items.md` for a future accessibility pass.

---
*Phase: quick-260905-f3v*
*Completed: 2026-09-05*

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/260905-f3v-actions-tab-polish-styled-guarded-toolti/260905-f3v-SUMMARY.md`
- deferred-items.md exists at `.planning/quick/260905-f3v-actions-tab-polish-styled-guarded-toolti/deferred-items.md`
- Task commits verified in git log: `7880f52e` (Task 1), `732abb30` (Task 2), `cc113daa` (Task 3)
