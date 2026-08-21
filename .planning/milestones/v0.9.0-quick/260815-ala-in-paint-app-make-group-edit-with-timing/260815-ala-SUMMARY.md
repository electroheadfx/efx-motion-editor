---
phase: quick-260815-ala-in-paint-app-make-group-edit-with-timing
plan: 01
subsystem: ui
tags: [preact, signals, physics-paint, group-timing, vitest]

requires:
  - phase: 43.3
    provides: Canonical Group lifecycle and Paint/Roto timeline behavior
provides:
  - Finite three-frame Create Group timing default with Max disabled
  - Controller-owned Max checkbox state with preserved finite frame values
  - Capacity-backed frame resolution through the existing parsedCount authority
  - Matching accessible Max and Infinity timing controls
  - Preserved Edit Group and Edit Source Cycle source-cycle counts
affects: [physics-paint, roto, group-editing, playscript]

actuals:
  tokens: 8591
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Controller-owned Preact Signals for timing toggle state
    - One computed parsedCount authority for finite and capacity-backed frame counts
    - Shared native checkbox row and label styling for Max and Infinity

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "Max is controller-owned Signal state parallel to Infinity, without component hooks or synchronization effects."
  - "parsedCount remains the single downstream count authority, resolving Max to current capacity and finite drafts through strict positive-integer parsing."
  - "Edit-mode source-cycle counts override create defaults, and Max is explicitly disabled during edit prefilling."

patterns-established:
  - "Timing toggles preserve the last valid finite draft and ignore invalid drafts entered while their finite input is logically disabled."
  - "Max and Infinity use distinct stable ids and handlers while sharing one native timing-row CSS treatment."

requirements-completed: [QUICK-260815-ALA]

coverage:
  - id: D1
    description: "Create Group timing defaults to Frames 3, Max off, Repeat 1, and Infinity off, with Max resolving generation to current capacity through the controller."
    requirement: QUICK-260815-ALA
    verification:
      - kind: integration
        ref: "pnpm vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Max and Infinity appear as matching native checkboxes and preserve the intended disabled, label-click, keyboard, and edit-lock interactions in the native Paint app."
    requirement: QUICK-260815-ALA
    verification:
      - kind: human
        ref: "Native Paint UAT approved by the user on 2026-08-15"
        status: pass
    human_judgment: true
    rationale: "Native visual appearance, keyboard interaction, generated-range behavior, and edit-mode preservation were approved in the user-owned native application session."

duration: 9min
completed: 2026-08-15
status: complete
---

# Quick Task 260815-ala: Group Timing Max Checkbox Summary

**Create Group now starts at three finite frames and offers a controller-owned Max checkbox that mirrors Infinity while preserving edit-cycle counts and finite drafts.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-15T05:42:17Z
- **Completed:** 2026-08-15T05:51:11Z
- **Automated tasks:** 2 completed
- **Native checkpoint:** Approved by the user
- **Files modified:** 6

## Accomplishments

- Replaced the magic `Max` frame text with an accessible native checkbox beside Frames while retaining strict positive-integer input validation.
- Added controller-owned `max` and `lastFiniteCount` Signals so toggling Max preserves the last valid finite value and resolves all existing count consumers to current capacity through `parsedCount`.
- Set every fresh Create Group flow to Frames `3`, Max off, Repeat `1`, and Infinity off, including the first Static-mode default.
- Preserved accepted source-cycle lengths and existing lock behavior in Edit Group and Edit Source Cycle.
- Generalized the existing Infinity row and toggle CSS so Max and Infinity share the same native checkbox size, spacing, accent, and label interaction pattern.

## Task Commits

Each automated task was committed atomically:

1. **Task 1: RED — pin the 3-frame default and Max checkbox contract end to end** - `15d85429` (test)
2. **Task 2: GREEN — implement Max as controller-owned checkbox state and reuse the Infinity visual pattern** - `4aa958a4` (feat)

Planning artifacts remain uncommitted as required by the quick-task execution instructions.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - Adds Max Signals, finite-value preservation, capacity-backed parsing, three-frame defaults, and authoritative edit prefills.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` - Covers defaults, Max preservation, capacity-backed destination/readout/confirm behavior, and edit-mode counts.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` - Renders distinct Max and Infinity controls and routes each through its controller setter.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` - Covers control identity, accessibility wiring, disabled states, finite text retention, and shared styling contracts.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - Updates the directly impacted source contract from magic Max helper text to the checkbox-based interaction.
- `app/src/components/physic-paint/physicsPaintStudio.css` - Shares timing row and toggle styling between Max and Infinity.

## Decisions Made

- Mirrored the established Infinity Signals boundary rather than introducing hooks, effects, or another state abstraction.
- Kept `parsedCount` as the only resolved frame-count authority so destination range, loop readout, confirmation, and physical generation cannot diverge.
- Reset create-flow timing on every fresh confirmation open while allowing edit prefills to remain authoritative.
- Kept native UAT separate from automated completion because the user owns the native app session and the executor must not start the server or application.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the directly impacted Scripts Panel source contract**
- **Found during:** Task 2 verification
- **Issue:** `PhysicsPaintScriptsPanel.test.ts` still required helper copy advertising the removed magic `Max` text token, causing the broader directly impacted suite to encode obsolete behavior.
- **Fix:** Changed the contract to require the stable Max checkbox id and positive-integer-only helper copy.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts`
- **Verification:** The three directly impacted suites passed with 220 tests, followed by the exact two-suite plan command passing all 186 tests.
- **Committed in:** `4aa958a4`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The adjustment removed a stale assertion directly caused by the requested interaction change; no product scope or architecture was expanded.

## Issues Encountered

- The first GREEN run exposed two stale assumptions: the loop-edit lock assertion did not account for the new shared row wrapper, and an applied-summary assertion still expected the old capacity-derived four-frame default. Both assertions were updated to the requested three-frame and wrapper behavior.
- The initial RED run failed 19 new or revised assertions as expected, proving the requested contract was absent before implementation.

## Automated Verification

Passed without watch mode:

```text
cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts

Test Files  2 passed (2)
Tests       186 passed (186)
```

A broader directly impacted run also passed:

```text
Test Files  3 passed (3)
Tests       220 passed (220)
```

## Known Stubs

None.

## Threat Model Outcome

- Capacity resolution remains inside the controller-owned computed count authority.
- Existing confirm-time authority and capacity revalidation remain active.
- Max and Infinity use distinct stable ids, labels, and controller handlers.
- No new endpoints, authentication paths, filesystem access, schemas, dependencies, or external trust boundaries were introduced.

## User Setup Required

None - no external service configuration required.

## Native UAT Approved

The user approved the native Paint app verification on 2026-08-15:

1. Create Group opens with Frames `3`, Max unchecked, Repeat `1`, and Infinity unchecked.
2. Max and Infinity match in checkbox size, accent color, spacing, alignment, click target, and keyboard behavior.
3. Entering `5`, checking Max, then unchecking Max keeps and restores `5`.
4. Max generation fills available capacity and the dialog range/readout agree with the generated result.
5. Edit Group preserves and locks its real source-cycle count while Repeat and Infinity remain editable.
6. Edit Source Cycle preserves its real source-cycle count rather than resetting to `3`.
7. Fresh Motion/Static switching retains the three-frame create default.

## Next Phase Readiness

- Source changes, automated verification, and native visual/interaction acceptance are complete.

## Self-Check: PASSED

- Summary file exists at the required quick-task path.
- Task commit `15d85429` exists in Git history.
- Task commit `4aa958a4` exists in Git history.

---
*Quick task: 260815-ala-in-paint-app-make-group-edit-with-timing*
*Completed: 2026-08-15*
