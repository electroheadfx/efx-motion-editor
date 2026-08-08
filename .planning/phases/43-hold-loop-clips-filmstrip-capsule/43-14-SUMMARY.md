---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 14
status: complete
completed: 2026-08-08
subsystem: obsolete-surface-cleanup
requirements-completed: [HOLD-05, HOLD-06]
commits:
  - 973ee5ab
---

# Phase 43 Plan 14: Obsolete Surface and Listener Cleanup Summary

**Rejected rich timeline and separate-lane code was deleted, and Physics Paint Studio no longer mounts specialized Loop Clip child listeners.**

## Accomplishments

- Deleted `TimelineCapsuleTooltip.tsx` and `loopCapsuleGeometry.ts` after active callers and mounts were removed.
- Replaced stale positive tooltip/interaction tests with structural absence contracts.
- Deleted the rejected `PhysicsPaintLoopClipLane.tsx`; the integrated rail remains the only EFX timeline presentation.
- Removed specialized open-loop-edit and loop-operation hooks, handler factories, listener state, and Studio mounts.
- Retained generic launch, project context, audio context, authority/apply result, save/close, and frame-sync bridge behavior.
- Retained the Studio-local rail/sidebar `openLoopEdit(loopId)` route.
- Preserved the passive Motion Editor marker type/projection/renderer and the approved physical-cell geometry.

## Verification

- Focused structural cleanup matrix: 9 files passed; 175 tests passed, 1 skipped.
- Production residue search found no obsolete tooltip, geometry, lane, specialized listener, specialized event, specialized sender, or popover symbol.
- Typecheck, full suite, build, dependency diff, and patch check pass.

## Result

Plan 43-14 is complete. The corrected ownership boundary is structural rather than hidden behind dead code.
