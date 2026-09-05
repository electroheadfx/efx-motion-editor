---
phase: quick-260905-dso
plan: 260905-dso
subsystem: ui
tags: [preact, signals, physic-paint, toolbox-popover, scripts-panel, guarded-actions]

# Dependency graph
requires:
  - phase: 52
    provides: the Tools popover (Interpolation + Key Spacing sections), the guarded styled-tooltip idiom, and the rotoScript clipboard availability controller
provides:
  - A third "Actions" section in the Tools popover with guarded Apply ("Apply Action to Frame") and Clear ("Clear Action from buffer") buffer buttons
  - The ScriptsPanel toolbar reduced to Save, Load + Apply, Create Rail…, Delete, Refresh, Copy
  - Identity-stable handleApplyScript/handleDiscardScript Studio useCallbacks wired into the workflow memo
affects: [Phase 53 Integrated v1.0.0 Acceptance, any future ScriptsPanel or toolbox popover work]

# Actuals (#2632) — pairs with the plan's `estimate` (30000 tokens) to calibrate future estimates.
actuals:
  tokens: 11811    # chars/4 over the realized diff (47244 chars)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signal-reference ports keep the workflow memo cacheable: the strip reads rotoScriptActionMutationDisabledReason.value in render (like physicalActions?.canInsertFrame.value), never .value-read in the Studio body."
    - "Relocated guarded actions reuse the strip's guarded styled-tooltip idiom verbatim: region bottom, aria-disabled (not disabled), sr-only reason span, Enter/Space preventDefault, guarded onClick before the handler."

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx

key-decisions:
  - "The buffer Apply/Clear handlers, availability sources, setLastError flows, and the PlayScript one-source-cycle Apply refresh are unchanged — only the surface moves."
  - "The popover render guard is relaxed to `onInterpolationEnabledChange || onApplyScript || onDiscardScript` so the popover opens when either Interpolation or Actions has content."
  - "The toolbox toggle aria-label is interpolation-agnostic ('Timeline tools') when the interpolation section is absent, never claiming an interpolation-only popover."
  - "The buffer availability is derived in the strip body from rotoScript.availability + the library actionMutationDisabledReason signal reference, mirroring the ScriptsPanel derivation exactly."

patterns-established:
  - "Relocated guarded actions reuse the strip's guarded styled-tooltip idiom verbatim: region bottom, aria-disabled (not disabled), sr-only reason span, Enter/Space preventDefault, guarded onClick before the handler."

requirements-completed: [ACC-01]

# Metrics
duration: 12min
completed: 2026-09-05
status: complete
---

# Phase quick-260905-dso: Move the Actions tab Apply/Clear buffer buttons into the Tools popover

**The buffer Apply/Clear actions relocated from the ScriptsPanel toolbar into the Tools popover as a third "Actions" section, wired from the Studio through identity-stable ports, with the ScriptsPanel toolbar reduced to Save, Load + Apply, Create Rail…, Delete, Refresh, Copy.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T10:03:00Z
- **Completed:** 2026-09-05T10:15:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added a third "Actions" section to the Tools popover with guarded Apply ("Apply Action to Frame") and Clear ("Clear Action from buffer") icon buttons using the strip's guarded styled-tooltip idiom (region bottom, aria-disabled, sr-only reason, Enter/Space guard, guarded onClick before the handler).
- Relaxed the popover render guard to open when either the Interpolation section or the Actions section has content; made the toolbox toggle aria-label interpolation-agnostic when the interpolation section is absent.
- Added identity-stable `handleApplyScript`/`handleDiscardScript` useCallbacks in the Studio and wired them plus the library `actionMutationDisabledReason` signal reference into the workflow memo.
- Removed the Apply/Clear spans, the `onApplyScript`/`onDiscardScript` props, the `ClipboardPen`/`ClipboardX` imports, and the Apply/Clear availability derivations from the ScriptsPanel; removed the inline handlers from the Studio rightPanel scripts props.
- Updated the ScriptsPanel, LoopClipRail, and WorkflowStrip tests; added four new popover Actions section source-contract tests. Full vitest suite (3441 passed) and `tsc --noEmit` are green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the "Actions" section to the Tools popover and wire the Studio ports** - `48591f48` (feat)
2. **Task 2: Remove Apply/Clear from the ScriptsPanel toolbar, clean up unused props/imports/derivations, update tests** - `ccdfa40b` (refactor)
3. **Task 3: Add the popover Actions section tests and run the full suite + type check** - `4cf8ddaf` (test)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Added the Actions section (guarded Apply/Clear buttons), the three optional strip ports, the six static-chrome ports, the buffer availability derivations, the relaxed popover render guard, and the conditional toolbox toggle aria-label.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Added `handleApplyScript`/`handleDiscardScript` useCallbacks, wired them plus the mutation-lock signal into the workflow memo, removed the inline rightPanel scripts handlers.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` - Removed the Apply/Clear spans, props, imports, and availability derivations; the Copy span stays byte-identical.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Updated two pre-relocation assertions; added the four-test "toolbox Actions section (260905-dso)" describe block.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - Replaced the Clear Action Buffer contract with a relocation contract; updated the Copy-only toolbar/label/Gap F/Gap G contracts and the deletion-lifecycle list.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` - Dropped the removed `onDiscardScript`/`onApplyScript` props from `renderScriptsPanel`.

## Decisions Made
- The relocation keeps the same Studio handlers, availability sources, setLastError flows, and the PlayScript one-source-cycle Apply refresh — only the surface moves.
- The popover render guard is relaxed to `onInterpolationEnabledChange || onApplyScript || onDiscardScript`; dismissal/placement/portal are untouched.
- The toolbox toggle aria-label is interpolation-agnostic when the interpolation section is absent.
- The buffer availability is derived in the strip body from `rotoScript.availability` + the library `actionMutationDisabledReason` signal reference (signal reads in render, memo stays cacheable).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two existing strip tests asserted the pre-relocation state**
- **Found during:** Task 1 (Add the Actions section to the Tools popover)
- **Issue:** The plan's Task 1 done criteria said "the existing strip test file passes unchanged", but the relocation inherently adds `ClipboardPen`/`ClipboardX` to the strip import and reads `scriptAvailability?.applyDisabledReason` in the strip body. Two existing tests asserted the strip source does NOT contain `ClipboardPen` and does NOT contain `applyDisabledReason` — both now fail.
- **Fix:** Updated the two tests to assert the bottom action row (not the whole source) no longer contains the tokens, and to assert the popover header block now contains `ClipboardPen`. This reflects the new reality (the buffer actions live in the popover, not the row) while preserving the tests' original intent.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
- **Verification:** `pnpm exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` passes (137 tests).
- **Committed in:** 48591f48 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The auto-fix was necessary to keep the suite green (ACC-01). No scope creep.

## Issues Encountered
- The plan's Task 2 verify command referenced `PhysicsPaintLoopClipRail.test.tsx.test.ts` (a real generated file) — the plan's `<automated>` block also listed `PhysicsPaintLoopClipRail.test.tsx.test.ts` which exists; the correct files were run and all pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Tools popover now hosts the buffer Apply/Clear actions; the ScriptsPanel toolbar is reduced to the six remaining buttons.
- Native UAT (user drives) remains: hover Apply reads "Apply Action to Frame", empty buffer greys both with the reason in the tooltip, Copy → move frame → Apply from the popover applies paint with immediate canvas refresh, Clear empties the buffer, and the popover closes on outside click and Escape.

---
*Phase: quick-260905-dso*
*Completed: 2026-09-05*

## Self-Check: PASSED
- SUMMARY.md exists at `.planning/quick/260905-dso-move-the-actions-tab-apply-clear-buffer-/260905-dso-SUMMARY.md`
- Task commits verified: `48591f48` (Task 1), `ccdfa40b` (Task 2), `4cf8ddaf` (Task 3)
