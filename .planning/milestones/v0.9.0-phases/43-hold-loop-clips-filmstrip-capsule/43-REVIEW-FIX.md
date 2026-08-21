---
phase: 43-hold-loop-clips-filmstrip-capsule
fixed_at: 2026-08-13T10:52:26Z
review_path: .planning/phases/43-hold-loop-clips-filmstrip-capsule/43-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 43: Code Review Fix Report

**Fixed at:** 2026-08-13T10:52:26Z
**Source review:** `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: D-28 export preflight compares global export frames against layer-local loop ranges

**Files modified:** `app/src/lib/exportEngine.ts`
**Commit:** `0c182594`
**Applied fix:** `findUnresolvedExportLoop` now translates the global export window `[fromFrame, toFrame)` into layer-local coordinates per sequence (`seqStart = seq.inFrame ?? 0`, querying with `[fromFrame - seqStart, toFrame - seqStart)` clamped to `>= 0`) before calling `getRotoPhysicalUnresolvedLoops`. This closes the resume fail-open (a loop at layer-local `[0, 10)` in a sequence with `inFrame = 50` now intersects the resume window `[55, total)` correctly) and the initial-export over-block (a loop entirely outside the export range no longer blocks). The error message now reports the global placement frame (`placementStart + seqStart`) so the user can locate the offending Group on the timeline, and the hit sort uses the global placement frame so the earliest timeline loop is named first.

### WR-02: Double-click dead zone in the Loop Clip rail (220–250 ms)

**Files modified:** `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx`
**Commit:** `2404bbc4`
**Applied fix:** `handleClick` now treats any click that arrives while a single-click timer is still pending as a double-click (cancels the timer, selects, and opens the loop edit dialog) regardless of the exact elapsed time, in addition to the existing fast-double-click threshold. This closes the `(LOOP_CLIP_FAST_DOUBLE_CLICK_MS, LOOP_CLIP_SINGLE_CLICK_DELAY_MS]` dead zone where a deliberate double-click was silently dropped and the first click's selection was lost.

### WR-03: Rail and presentation use `requestedEnd` instead of the truncated `effectiveEnd` for finite loops

**Files modified:** `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx`, `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts`, `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx`
**Commit:** `0de760ab`
**Applied fix:** The rail's `continuousRange.effectiveEnd` now uses `resolvedEnd` (the max `effectiveEnd` across the loop's fragments) for finite loops as well as infinity loops, so the drawn clip extent matches the frames that actually resolve (frames past `effectiveEnd` resolve `'empty'`). The presentation's `effectiveDuration`/`effectiveLabel` now use `range.effectiveEnd` for both finite and infinity loops, so the tooltip's `Effective Xf` label no longer overstates the duration of a parent-truncated finite loop. `requestedEnd` remains in the cycle label (`Cycle Nf × R = Df`), which correctly describes the user's intent. The two rail tests that build a presentation from a fragment range were updated to build from the last fragment (max `effectiveEnd`), matching how the studio builds the loopId-keyed presentation map.

## Verification

- Full project type check (`npx tsc --noEmit` in `app/`): exit 0.
- `PhysicsPaintLoopClipRail.test.tsx`: 15/15 passed.
- `physicsPaintLoopClipPresentation.test.ts`: 9/9 passed.
- `PhysicsPaintWorkflowStrip.test.ts`: 84/84 passed.
- Verification ran in the main checkout (`workflow.use_worktrees` is `false`), so the numbers are reproducible from the tree under review.

---

_Fixed: 2026-08-13T10:52:26Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
