---
phase: 261029-lsr
fixed_at: 2026-10-29T15:50:16Z
review_path: .planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Quick 261029-lsr: Code Review Fix Report

**Fixed at:** 2026-10-29T15:50:16Z
**Source review:** `.planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, CR-02, WR-01, WR-02 — the user-scoped set; WR-03, WR-04, IN-01..IN-03 untouched)
- Fixed: 4
- Skipped: 0

**Verification location:** the main checkout (`workflow.use_worktrees=false` in `.planning/config.json`), not an isolated worktree. The gate numbers below are reproducible from the current tree.

## Fixed Issues

### CR-01: A failed redo now re-anchors instead of deadlocking forever

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
**Commit:** `a6309441`
**Applied fix:** The three-way recovery block in `replayStroke` is no longer gated on `direction === 'undo'`. `reanchorAquarelleEditRevision(editId, direction)` now runs for BOTH directions after `enteredReplay && reachedRebake`; only the cache-entry DELETE is undo-only (`if (!reanchored && direction === 'undo') aquarelleStrokeEditIdsRef.current.delete(mutationId)`). The doc comment was rewritten: a failed redo re-anchors the same way (undo re-seats `after`, redo re-seats `before`) and never drops its cached edit.

### CR-02: Cross-frame paint undo is refused instead of silently consuming history

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
**Commit:** `dfc360c0`
**Applied fix:** `replayStroke` now resolves `getRecordedAquarelleStroke(mutationId)` first and returns `false` when the stroke is unknown or `(stroke.playFrame ?? 0) !== (launchContextRef.current?.startFrame ?? 0)` — the same comparison `aquarelleStrokesOnFrame` uses, and before any cached/uncached branch. A one-line comment names the reason (the script is global, the bake is per-frame).

### WR-01: The script-edit in-flight flag is held across the replay

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
**Commit:** `1441ddfc`
**Applied fix:** `runScriptReplay` keeps the guard reads first (`isAquarelleScriptEditInFlight()` still refuses re-entrant calls), then `rotoCachedPlayback.stop()`, then `setAquarelleScriptEditInFlight(true)` wrapped around `await runAquarelleScriptReplay(...)` with `finally { setAquarelleScriptEditInFlight(false); }`. Two rapid Cmd+Z presses can no longer both mint an edit, and the loser can no longer delete the winner's cached id.

### WR-02: The replay's never-throws contract is now enforced on every port

**Files modified:** `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts`, `app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts`
**Commit:** `ac6b3af4`
**Applied fix:** A throwing `restore` returns `false` (nothing was swapped, so nothing to revert). A throwing `resetSheet` after a successful restore rolls back exactly once and returns `false`. Both rollback sites are themselves exception-guarded so a throwing `rollback` cannot escape. A throwing `notify` or `publishOwner` is swallowed and still resolves `true` (the bake already committed). Step order, every `onStep` emission, the synchronous first `invalidate`, and the literals `if (revert === null) return false;` / `ports.rollback(revert)` are unchanged.

## Test Changes (disclosed)

- **Changed an existing assertion that encoded the bug (required by CR-01/IN-04):** `PhysicsPaintStudio.test.ts` previously pinned `if (direction === 'undo' && enteredReplay)`. It now pins `if (enteredReplay) {` AND asserts the old undo-gated conditional is absent, plus a new row asserting the dead-id delete stays inside a `direction === 'undo'` guard. This is the only pre-existing assertion whose expected value changed; none were weakened or deleted.
- **Added** the CR-02 source pin (the `stroke.playFrame` comparison against the current start frame, ordered before every cached/uncached branch).
- **Added** WR-01 order pins (guard and playback stop precede `setAquarelleScriptEditInFlight(true)`; the flag clears).
- **Added** four WR-02 rows: throwing `restore` (resolves false, nothing to roll back), throwing `resetSheet` after a successful restore (resolves false, rollback called exactly once with the identity-checked revert), throwing `rollback` after a failed bake (never escapes), and throwing `notify`/`publishOwner` after a successful bake (still resolves true). All new rows fail against the pre-fix module.
- **Clarification:** for a throwing `restore`, `rollback` is NOT called — no revert exists because the swap never happened. Rolling back with a non-existent revert would be wrong; the review's own fix shape returns `false` in that branch.

## Gates

- Targeted suite (6 files: `aquarelleScriptReplay`, `aquarelleStrokeSelection`, `useRotoPhysicalEditHistory`, `useRotoFramePersistenceCoordinator`, `rotoLivePixelCacheTransactions`, `PhysicsPaintStudio`): 458 passed, 6 files passed.
- Full suite (`vitest run`): 355 passed | 2 skipped files; 6349 passed | 1 skipped | 96 todo.
- Typecheck (`pnpm --filter efx-motion-editor typecheck`): clean.

---

_Fixed: 2026-10-29T15:50:16Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
