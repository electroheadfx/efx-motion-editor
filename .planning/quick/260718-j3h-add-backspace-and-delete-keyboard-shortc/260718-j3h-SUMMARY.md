---
phase: quick-260718-j3h-add-backspace-and-delete-keyboard-shortc
plan: 01
subsystem: ui
tags: [preact, keyboard-shortcuts, physics-paint, roto]

requires:
  - phase: 36.7-physics-paint-roto-key-utilities
    provides: Guarded `rotoKeyUtilities.deleteKey` transaction used by the visible Delete button
provides:
  - Backspace and Delete dispatch through the existing guarded Roto key deletion action
  - Delete-specific focus, modifier, repeat, and modal protection
  - Immediate clear-blank canvas restoration after deleting a real key
  - Focused post-UAT regression coverage for keyboard and refresh behavior

affects: [physics-paint, roto-key-utilities, phase-36.14]

tech-stack:
  added: []
  patterns:
    - Reuse one guarded destructive action for visible-button and keyboard entry points
    - Clear the cached preview base before resetting and clearing a blank Roto canvas

key-files:
  created:
    - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.test.ts
  modified:
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts

key-decisions:
  - "Backspace/Delete receive the exact rotoKeyUtilities.deleteKey reference already used by the visible Delete path."
  - "Generated, empty, busy, mutation-locked, and persistence-in-flight states remain governed by existing key utility availability and validation."
  - "Clear-blank restoration must disable the preview base before engine reset/clear so deleted paint cannot be redrawn."

patterns-established:
  - "Destructive shortcut eligibility is narrower than the generic Studio shortcut target policy."
  - "Roto blank-canvas clearing uses clearPreviewBaseImage -> resetBackground -> clear ordering."

requirements-completed: [QUICK-260718-J3H]

coverage:
  - id: D1
    description: "Unmodified, non-repeating Backspace/Delete dispatch through the existing guarded Roto delete action from eligible Studio targets."
    requirement: QUICK-260718-J3H
    verification:
      - kind: test
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts"
        status: pass
    human_judgment: true
    rationale: "Native UAT approved both keys, one-shot deletion, Undo/Redo, protected targets, and existing shortcut behavior."
  - id: D2
    description: "Real/generated/empty/busy semantics remain authoritative through existing Roto key utilities."
    requirement: QUICK-260718-J3H
    verification:
      - kind: test
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts"
        status: pass
      - kind: test
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts"
        status: pass
    human_judgment: true
    rationale: "Native UAT approved deletion and non-deletable frame behavior."
  - id: D3
    description: "Deleting a key immediately clears stale paint when restoration resolves to a blank selected frame."
    requirement: QUICK-260718-J3H
    verification:
      - kind: test
        ref: "app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.test.ts"
        status: pass
    human_judgment: true
    rationale: "Native UAT approved immediate canvas refresh after the clear-blank fix."

production-commit: d25712b4
refresh-fix-commit: cf45fddb
regression-commit: f9a4cede
started: 2026-07-18T11:50:52Z
completed: 2026-07-18T13:43:20Z
status: complete
---

# Quick 260718-j3h: Backspace/Delete Roto Key Shortcuts Summary

**Backspace and Delete now remove the selected real Physics Paint Roto key through the existing guarded transaction, with native-approved canvas refresh and regression coverage.**

## Delivered

- Added unmodified `Backspace` and `Delete` handling to the standalone Physics Paint Studio.
- Routed both keys to the exact `rotoKeyUtilities.deleteKey` reference used by the visible Delete button.
- Suppressed repeat and modified events.
- Protected editable fields, dialogs, unrelated controls, links, and ARIA widgets.
- Preserved deletion from the selected `.physics-paint-roto-cell.current`, Studio root, canvas, and timeline.
- Updated shortcut help with `Backspace / Delete remove selected real key`.
- Fixed stale paint after deletion by clearing the enabled preview base before clear-blank engine restoration.

## Native UAT

Approved on 2026-07-18.

The user verified:

- Backspace and Delete remove exactly the selected real key.
- Undo restores the key and Redo deletes it again.
- Holding either key does not cascade through multiple keys.
- Generated, empty, and blocked states do not delete keys.
- Inputs, script rename, Play Script count, dialogs, and unrelated controls remain protected.
- The selected timeline-cell button remains an eligible shortcut target.
- Existing Physics Paint shortcuts remain functional.
- Save/reopen and interpolation behavior remain intact.
- Deleting frame 0 and other clear-blank cases refresh the canvas immediately without timeline movement.

## Root Cause and Resolution

The deletion transaction correctly emitted a `clear-blank` restoration, but `engine.clear()` ran while the cached preview base was still enabled. The engine therefore redrew deleted paint even though the key transaction and timeline state were correct. Both authoritative blank-canvas paths now use this order:

1. `clearPreviewBaseImage()`
2. `resetBackground()`
3. `clear()`

Temporary `[DEBUG-roto-refresh-7f3a]` diagnostics were removed before completion.

## Validation

Focused regression command:

```text
pnpm --dir app exec vitest run \
  src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts \
  src/components/physic-paint/hooks/useRotoPersistenceIntegration.test.ts \
  src/components/physic-paint/PhysicsPaintStudio.test.ts \
  src/components/physic-paint/roto/physicsPaintRotoSession.test.ts \
  src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts
```

Results:

- 5 test files passed.
- 101 tests passed.
- `pnpm --dir app typecheck` passed.
- `pnpm --dir app build` passed with 1086 modules transformed.
- `git diff --check` passed.
- No development server was started.
- No temporary diagnostic logs remain.

## Commits

- `d25712b4` — Add Roto key delete shortcuts.
- `cf45fddb` — Clear blank Roto preview after deletion.
- `f9a4cede` — Cover Roto key deletion regressions.

## Outcome

Quick task complete, native-approved, regression-covered, and ready for Phase 36.14 planning.
