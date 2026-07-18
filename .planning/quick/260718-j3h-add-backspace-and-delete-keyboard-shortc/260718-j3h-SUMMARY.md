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
  - Delete-specific target protection for editing controls, dialogs, and unrelated interactive controls
  - Shortcut-help copy for selected real-key deletion
  - Native UAT handoff for destructive keyboard behavior

affects: [physics-paint, roto-key-utilities, phase-36.14]

tech-stack:
  added: []
  patterns:
    - Reuse the existing controller action for keyboard and visible-button destructive behavior
    - Apply destructive-key target policy separately from established shortcut target policy

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx

key-decisions:
  - "Backspace/Delete receive the exact rotoKeyUtilities.deleteKey reference already used by the visible Delete path."
  - "Native approval remains blocking before regression tests, final gates, completion tracking, or a complete status."

patterns-established:
  - "Destructive shortcut eligibility is narrower than the generic Studio shortcut target policy."

requirements-completed: []

coverage:
  - id: D1
    description: "Unmodified, non-repeating Backspace/Delete dispatch through the existing guarded Roto delete action from eligible Studio targets."
    requirement: QUICK-260718-J3H
    verification:
      - kind: other
        ref: "pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck"
        status: pass
      - kind: other
        ref: "git -C /Users/lmarques/Dev/efx-motion-editor diff --check"
        status: pass
    human_judgment: true
    rationale: "Destructive native keyboard behavior, focus routing, repeat suppression, controller guards, and Undo/Redo require visible native UAT."
  - id: D2
    description: "Editable controls, dialogs, unrelated interactive targets, generated/empty states, and busy operations remain protected while the current Roto cell stays eligible."
    requirement: QUICK-260718-J3H
    verification: []
    human_judgment: true
    rationale: "Focus and modal behavior must be exercised in the native standalone Studio before tests are authorized."
  - id: D3
    description: "Existing Physics Paint shortcuts and the visible Delete-button behavior remain unchanged."
    requirement: QUICK-260718-J3H
    verification: []
    human_judgment: true
    rationale: "The complete existing-shortcut matrix remains subject to native non-regression approval."

production-commit: d25712b4
started: 2026-07-18T11:50:52Z
completed: null
status: awaiting_native_uat
---

# Quick 260718-j3h: Backspace/Delete Roto Key Shortcuts Summary

**Backspace and Delete are automated-ready through the existing guarded Roto key utility, with native destructive-key UAT still blocking tests and completion.**

## Current Status

- **Stage:** Production-only pre-UAT implementation
- **Status:** `awaiting_native_uat`
- **Production commit:** `d25712b4` — `feat(quick-260718-j3h): add Roto key delete shortcuts`
- **Task completion:** Not complete; native UAT is required
- **Post-UAT work:** Blocked until explicit native approval

## Production Files Changed

- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` — adds optional delete action dispatch, repeat/modifier suppression, modal protection, interactive-target exclusion, and the current Roto-cell exception.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — supplies the exact `rotoKeyUtilities.deleteKey` function reference to the keyboard dispatcher.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — adds `Backspace / Delete remove selected real key` to shortcut help.

## Automated Checks

- **PASS:** `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck`
- **PASS:** `git -C /Users/lmarques/Dev/efx-motion-editor diff --check`
- No development server was started.
- No final test gate was run.

## Test Statement

No regression tests were created, modified, renamed, deleted, or executed during this production-only stage. Vitest was not run. Regression coverage and final gates remain explicitly blocked until the user approves native UAT.

## Native UAT Checklist

1. In the native standalone Physics Paint Studio, select a deletable real Roto key, place focus on the Studio root or canvas, press Backspace once, and confirm exactly that selected real key is deleted through the same visible behavior/status path as the Delete button.
2. Undo the deletion and confirm the real key returns with its expected cached/canvas state; Redo and confirm it is deleted again. Undo once more to restore it for the next checks.
3. With the restored real key selected, press Delete once and confirm the same one-key deletion behavior; Undo it again.
4. Hold Backspace long enough to generate repeat events and confirm only the initial keydown can delete—the next real key is not removed. Repeat with Delete if practical.
5. Select a generated interpolation cell, an empty cell, and any visible background-only/non-deletable cell in turn; press both Backspace and Delete and confirm no key is removed and the existing guard/status semantics remain authoritative.
6. While a key mutation, Apply, Load/Apply Script, or Play Script operation is busy/locked, press Backspace/Delete and confirm no deletion occurs. Do not interrupt the operation beyond its normal controls.
7. Focus the script rename input and press Backspace/Delete while editing text; confirm only the text field responds. Open the Play Script dialog, focus its Frames input, and confirm Backspace/Delete edits that value without deleting a Roto key.
8. With either Play Script or Delete Script confirmation dialog open, focus dialog buttons or dialog body and press Backspace/Delete; confirm no Roto key deletion occurs and dialog controls retain their normal behavior.
9. Focus the selected `.physics-paint-roto-cell` button itself and press Backspace, then after Undo press Delete; confirm both shortcuts remain allowed from the selected timeline cell despite it being a button. Confirm root, canvas, and local timeline focus also work.
10. Focus unrelated buttons/controls and press Backspace/Delete; confirm they do not delete a Roto key.
11. Recheck all established Studio shortcuts: Cmd/Ctrl+Z Undo, Cmd+Shift+Z or Ctrl+Y Redo, `?` help, Space cached playback, arrows and Shift+arrows navigation, G current-frame navigation, O onion toggle, and `[ ]` onion count. Confirm none regressed.

## Resume Instruction

Type `approved` to authorize the resumed post-UAT regression-test and final-gate stage, or describe the first failing key, target, guard, Undo/Redo, hold, dialog, or existing-shortcut case. Do not claim completion at this checkpoint.

## Deviations from Plan

- The user explicitly required the SUMMARY to remain uncommitted for the orchestrator, overriding the plan's separate SUMMARY documentation commit instruction.
- No production-scope deviations occurred.

## Blocking Checkpoint

Native visible UAT is blocking. Do not create or modify tests, run Vitest or final gates, update this summary to complete, update `STATE.md` or `ROADMAP.md`, or claim quick-task completion until explicit approval is received.
