---
phase: quick-260815-bmg-remove-numeric-undo-redo-counts-from-pai
plan: 01
subsystem: ui
tags: [preact, signals, physics-paint, accessibility, vitest]

requires:
  - phase: 38.1
    provides: Memoized Physics Paint tool rail with narrow history availability subscribers
provides:
  - Count-free Paint and Physics Paint Studio Undo/Redo icon presentation
  - Plain Undo/Redo accessible names and existing titles without history depth
  - Preserved history-driven enabled and disabled states
  - Focused regression coverage for the presentation-only boundary
affects: [physics-paint, paint-ui, accessibility, history-controls]

actuals:
  tokens: 1005
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - Keep Signal-backed history counts internal when they are required only for control availability
    - Pin presentation-only accessibility contracts with focused source assertions

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "History availability counts remain subscribed in the narrow Undo/Redo child and continue to drive only the existing zero-count disabled expression."
  - "Undo and Redo retain their existing item labels as both title and accessible name, with no replacement label or tooltip mechanism."

patterns-established:
  - "Presentation-only history changes must leave handlers, routing, shortcuts, depth, and Paint-versus-timeline ownership untouched."

requirements-completed: [QUICK-260815-BMG]

coverage:
  - id: D1
    description: "Paint and Physics Paint Studio Undo/Redo controls retain their icons and availability-driven disabled state without rendering or announcing history counts."
    requirement: QUICK-260815-BMG
    verification:
      - kind: integration
        ref: "pnpm vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts --bail=1"
        status: pass
      - kind: other
        ref: "pnpm typecheck && pnpm vitest run && pnpm build && git diff --check"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-15
status: complete
---

# Quick Task 260815-bmg: Count-Free Paint Undo/Redo Summary

**Paint and Physics Paint Studio Undo/Redo controls now show only their existing icons and plain action names while preserving the exact history-driven availability and behavior boundary.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-15T06:26:54Z
- **Completed:** 2026-08-15T06:29:48Z
- **Tasks:** 1 completed
- **Files modified:** 3

## Accomplishments

- Removed the rendered numeric history badges from the Studio Undo and Redo icon buttons.
- Replaced count-composed `title` and `aria-label` values with the existing plain `Undo` and `Redo` item labels.
- Preserved the narrow `historyAvailability?.value` Signal subscription, count derivation, and `disabled={disabled || count === 0}` behavior.
- Removed only the obsolete badge CSS while retaining icon-button sizing, icon treatment, disabled styling, focus styling, callbacks, shortcuts, routing, and history ownership.
- Extended the focused Studio contract to prevent visible or announced counts from returning.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Studio Undo/Redo count presentation without changing history behavior** - `357965a1` (fix)

Planning artifacts remain uncommitted as required by the quick-task execution instructions.

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - Keeps Undo/Redo history counts internal to disabled-state calculation and renders only the existing icons with plain action names.
- `app/src/components/physic-paint/physicsPaintStudio.css` - Removes the unreachable visible and disabled history-badge rules.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Pins the narrow Signal subscription, count derivation, disabled expression, count-free labels, absent badge markup, and absent badge CSS.

## Decisions Made

- Kept the existing count derivation rather than replacing or moving state because history availability still exclusively controls whether Undo and Redo are enabled.
- Used the existing `item.label` for both `title` and `aria-label`; no labels, tooltips, hooks, effects, state, or history abstractions were added.
- Left Motion Editor Undo/Redo, timeline history, keyboard routing, callbacks, and history capacity byte-unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported Vitest `-x` with the installed fail-fast option**
- **Found during:** Task 1 focused verification
- **Issue:** Vitest 2.1.9 rejected the plan's `-x` flag as an unknown option.
- **Fix:** Queried the installed CLI help and reran the focused command with the equivalent supported `--bail=1` option.
- **Files modified:** None
- **Verification:** The focused suite passed all 57 tests with `--bail=1`, followed by all standard gates.
- **Committed in:** Not applicable; verification command adjustment only.

---

**Total deviations:** 1 auto-fixed (1 blocking verification-command compatibility issue)
**Impact on plan:** No source scope or product behavior changed; fail-fast focused verification remained intact.

## Issues Encountered

- Initial attempts to express the plan's working-directory command through pnpm directory flags were parsed as executable paths by the installed pnpm version. Running the plan command from the app directory resolved the invocation without changing project files.

## Automated Verification

Passed without starting a development server:

```text
pnpm vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts --bail=1
Test Files  1 passed (1)
Tests       57 passed (57)

pnpm typecheck
Passed

pnpm vitest run
Test Files  121 passed | 3 skipped (124)
Tests       2142 passed | 1 skipped | 101 todo (2244)

pnpm build
Built successfully

git diff --check
Passed
```

The skipped and todo tests reported by the full suite were pre-existing and were not added or modified by this task.

## Known Stubs

None.

## Threat Model Outcome

- History depth remains internal and is no longer disclosed through visible badges or accessible names.
- The exact zero-count availability guard remains pinned by the focused test.
- No handlers, shortcuts, routing, history capacity, timeline history, Motion Editor controls, network endpoints, authentication paths, filesystem access, schemas, or dependencies changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The scoped source change and all automated gates are complete.
- Native visual confirmation can be performed in the user's existing app session if desired; no server or application was started by the executor.

## Self-Check: PASSED

- Summary file exists at the required quick-task path.
- Task commit `357965a1` exists in Git history.
- All modified source files are within the plan's declared three-file boundary.

---
*Quick task: 260815-bmg-remove-numeric-undo-redo-counts-from-pai*
*Completed: 2026-08-15*
