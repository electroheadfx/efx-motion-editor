---
status: complete
quick_id: 260820-hq9
description: addEmptyKey inside an interpolated segment must clear to empty payload on commit
date: 2026-08-20
commit: 076ddc67
---

# 260820-hq9 — addEmptyKey clears to empty payload on commit

## Result

Fixed. `addEmptyKey` (which routes an empty payload through the `paste-key`
physical edit) now reconciles the destination frame to the accepted EMPTY key
on commit, so the canvas flips to blank immediately and the cached
interpolated image loses to the newest (empty) content revision.

## Root cause

`addEmptyKey` (`useRotoTimelineActions.ts:2259`) runs
`operationKind: 'paste-key'`, but the `finalizeAccepted` reconcile list in
`useRotoPhysicalEditCoordinator.ts` only reconciled the retained frame for
`insert-empty-segment` — a different operation kind `addEmptyKey` does not
use. With interpolation ON, the destination frame inside a derived Key Rail
segment kept showing the prior interpolated render while the accepted
document already declared a real EMPTY key.

## Change

- `useRotoPhysicalEditCoordinator.ts` — added `|| pending.operationKind === 'paste-key'`
  to the `finalizeAccepted` reconcile list (one production line). This is the
  ONLY production change; the interpolation-OFF path is byte-identical
  (reconcile is purely additive for the same empty real key).

## Tests

- RED → GREEN: `useRotoPhysicalEditCoordinator.test.ts` — seed 0/4/8
  interpolation-ON, `paste-key` at 6, assert `reconcileCurrentFrame(6)` called
  once after acceptance (failed before the fix: called 0 times).
- Full suites green (206 tests): coordinator, timeline-actions
  (interpolation-OFF byte-identical), key-utilities.
- `pnpm typecheck` (tsc --noEmit) clean.

## Out of scope

`paste-key-group` reconcile, history/persistence/bridge, resolver, render-source
derivation, and the regression-refresh-multi-paint engine seam — untouched.

## Native UAT (deferred to user)

With Frame Blending ON, keys 0/4/8 → +Key on frame 6 → canvas flips to blank
immediately on commit, status `Real Roto key · Frame 6`; painting persists on
refresh; Undo restores the interpolated display; Redo clears again.
