---
phase: 261029-lsr
reviewed: 2026-10-29T15:44:33Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts
  - app/src/components/physic-paint/roto/aquarelleScriptReplay.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 261029-lsr: Code Review Report

**Reviewed:** 2026-10-29T15:44:33Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the quick 261029-lsr implementation that makes aquarelle stroke undo/redo script-authoritative: the shared replay orchestrator, the synthetic single-stroke edit builder and its re-anchor helper, the live-pixel capture epoch, the Studio replay wiring, and the paint / auto-key-paint ledger branches.

Two blocking defects were found. First, `replayStroke` re-anchors a failed replay only for `undo`; a failed `redo` leaves the edit permanently unusable, so every later Cmd+Shift+Z for that stroke is refused forever. Second, the paint ledger branch that now routes through the script has no frame gate: undoing a stroke recorded on another frame removes it from the global script, re-bakes only the current frame, and silently consumes the history entry while the current picture does not change and the stroke's own frame keeps stale pixels. Four warnings and four info items follow (duplicate edits from concurrent Cmd+Z, an unenforced "never throws" contract, an edit ledger whose 10-entry eviction can strand a redo, an ignored compensating redo, and test/source pins that encode the first bug).

Verified sound and not reported below:

- Step ordering in `runAquarelleScriptReplay` is correct, and step 1 (`invalidate`) is synchronous before any await.
- All fail-closed `null`/`false` returns leave the caller's stacks untouched; no step is skipped on a failed bake except as noted in WR-02.
- `beginAquarelleStrokeUndoEdit` builds the right pair (`after` = WITH, `before` = WITHOUT + tombstone, same revision) and shares the registry by reference without mutating or leaking it (`restoreAquarelleStrokeRegistry` clears and re-populates the live maps; entries are replaced, never mutated in place).
- `reanchorAquarelleEditRevision` does not bump the revision, does not install content, does not touch the opposite side, and refuses unknown ids.
- `paint` undo/redo moves the stacks only on `true`, never falls back to `undoPaint()` after a failed script replay, never double-pops, and always calls `publishAvailability()` on every exit path.
- `runScriptReplay` runs all three guards before `rotoCachedPlayback.stop()`, captures `playFrame` once, and reads signals only with `.peek()` (no render-body subscription).
- The epoch is stamped as the first statement of capture entry and re-read through the same port at produce/commit; `isStillCurrent` appears exactly twice; legacy captures never carry it and are unaffected.

## Critical Issues

### CR-01: A failed redo never re-anchors, permanently deadlocking that stroke's redo

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4845-4849`
**Severity:** BLOCKER

**Issue:** The three-way cache recovery is gated on `direction === 'undo'`:

```ts
if (ok) return true;
if (direction === 'undo' && enteredReplay) {
  const editId = aquarelleStrokeEditIdsRef.current.get(mutationId);
  const reanchored = reachedRebake && editId !== undefined && reanchorAquarelleEditRevision(editId, direction);
  if (!reanchored) aquarelleStrokeEditIdsRef.current.delete(mutationId);
}
return false;
```

`runAquarelleScriptReplay` installs the target snapshot and bumps `aquarelleStrokesRevision` (`view/aquarelleStrokeSelection.ts:787-789`), then on a failed bake calls `ports.rollback(revert)` → `restoreAquarelleSnapshotRaw` → `applySnapshotContent` (`:797-799`, `:560-568`), which bumps the revision **again** without writing it back into the edit. The re-anchor exists precisely to forgive that self-inflicted drift — but only for undo.

Redo failure sequence: undo succeeds (edit.before.revision = live = R1, edit.after.revision = R0 stale) → Cmd+Shift+Z → restore(redo) passes its guard, sets edit.after.revision = R2 → bake fails → rollback bumps to R3 and live content returns to the `before` side. Now `restoreAquarelleEditSnapshot(id, 'redo')` validates `liveSide = edit.before` (R1) against live R3 → always `null`. The recovery branch does not run for redo, the cached id is not dropped, and `useRotoPhysicalEditHistory.ts:1150-1152` returns `false` before moving the stacks. Every subsequent Cmd+Shift+Z retries the same dead guard forever. The comment at `:4820-4822` ("a failed redo simply retries the same id and never drops") describes the bug, and `PhysicsPaintStudio.test.ts:3229` pins the undo-only condition, so the suite cannot catch it.

**Fix:** Apply the same re-anchor to both directions; only the *dead-id drop* is undo-specific (a redo needs its id to retry):

```ts
if (ok) return true;
if (enteredReplay) {
  const editId = aquarelleStrokeEditIdsRef.current.get(mutationId);
  const reanchored = reachedRebake && editId !== undefined && reanchorAquarelleEditRevision(editId, direction);
  if (!reanchored && direction === 'undo') aquarelleStrokeEditIdsRef.current.delete(mutationId);
}
return false;
```

This preserves the fail-closed property: `reanchorAquarelleEditRevision(editId, 'redo')` re-seats only `edit.before`, while `edit.after` keeps its stale revision, so a foreign script mutation is still rejected. Add a test row that fails the redo's bake and asserts the retry succeeds (see IN-04).

### CR-02: Undoing a recorded stroke from another frame consumes history without re-baking that stroke's frame

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:957-975`
**Severity:** BLOCKER

**Issue:** The paint ledger is session-wide and a `paint` entry carries no frame (`useRotoPhysicalEditHistory.ts:197-198`: `{ kind: 'paint'; mutationId }`), while the new replay always targets the *current* frame:

- `PhysicsPaintStudio.tsx:4709` — `const playFrame = launchContextRef.current?.startFrame ?? 0;`
- `:4720` — invalidation is scoped to that frame's identity key;
- `:4728` — the bake applies only `getAquarelleEventsForFrame(playFrame)`.

`getRecordedAquarellePayloadTimeline()` is global, and `beginAquarelleStrokeUndoEdit` deletes the stroke from it by `mutationId` (`view/aquarelleStrokeSelection.ts:642-665`) regardless of the stroke's `playFrame`.

Repro: paint a stroke on frame 5, navigate to frame 9, paint there, undo the frame-9 stroke, undo again. The second Cmd+Z takes the `paint` branch, `hasRecordedStroke` answers `true`, and `replayStroke` removes the frame-5 stroke from the global script, resets the sheet and re-bakes **frame 9** — whose event set is byte-identical to before. The call returns `true`, so the entry is popped from `appliedRef` and pushed to `redoRef` (`:969-974`). Result: a Cmd+Z with no visible effect that silently consumes history, while frame 5's committed pixels still contain the stroke (and its pending captures for that key are not invalidated, because only `playFrame`'s key was invalidated). That is exactly the display-vs-bake drift this quick exists to eliminate, now reachable from the frame-navigation path. Every sibling script-edit handler gates ids with `aquarelleStrokesOnFrame(ids, playFrame)` (`PhysicsPaintStudio.tsx:7211, 7292, 7378, 7448`), which filters on `stroke.playFrame` and tombstones (`aquarelleStrokeSelection.ts:156-171`); the new paint branch has no equivalent.

**Fix:** Refuse (fail closed, preserving the pre-quick engine behavior) when the stroke does not belong to the current frame; the old engine path failed closed, so this restores the previous contract while keeping same-frame undo script-authoritative:

```ts
replayStroke: async (mutationId, direction) => {
  const playFrame = launchContextRef.current?.startFrame ?? 0;
  const stroke = getRecordedAquarelleStroke(mutationId);
  if (!stroke || (stroke.playFrame ?? 0) !== playFrame) return false; // foreign frame
  // ...existing cached/uncached branches...
}
```

`getRecordedAquarelleStroke` is tombstone-free by design (R-2), so the check also holds for the redo direction after the undo tombstoned the stroke. A larger alternative (re-bake the stroke's own frame, plus invalidating that frame's key) is out of scope for this quick; if that is intended later, it needs its own test rows. Either way, this must not stay untested.

## Warnings

### WR-01: The replay never sets `isAquarelleScriptEditInFlight`, so concurrent Cmd+Z can mint duplicate edits and wipe the winner's cached id

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4698-4714`
**Severity:** WARNING

**Issue:** `runScriptReplay` only *checks* the in-flight flag (`:4712`). Every sibling script-edit path sets it (`:7313, 7386, 7477, 7530, 7582`). Two quick Cmd+Z presses both pass the guard while the first is awaiting `ensureAquarelleDurableBaseRef` (`aquarelleScriptReplay.ts:80-85`); both then reach `prepare` (`:4838-4841`) and each calls `beginAquarelleStrokeUndoEdit`, creating two edits for the same stroke. Only one can pass the revision guard. The loser (`enteredReplay === true`, `reachedRebake === false`, `direction === 'undo'`) executes `aquarelleStrokeEditIdsRef.current.delete(mutationId)` at `:4848`, deleting the mapping the **winner** wrote at `:4840`. The winning undo succeeds, the entry moves to `redoRef`, but the next redo finds no cached id and returns `false` at `:4833-4834` — that stroke's redo is permanently refused. The ledger also gains a dead edit that occupies a slot in the 10-entry map, feeding WR-03.

**Fix:** Hold the flag across the replay, synchronously after the guard and before any await:

```ts
if (isAquarelleScriptEditInFlight()) return false;
setAquarelleScriptEditInFlight(true);
try {
  rotoCachedPlayback.stop();
  return await runAquarelleScriptReplay({ /* ports untouched */ });
} finally {
  setAquarelleScriptEditInFlight(false);
}
```

`setAquarelleScriptEditInFlight` is already imported in this file.

### WR-02: "Never throws to the caller" is unenforced; only the base and the bake are guarded

**File:** `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts:95-119`
**Severity:** WARNING

**Issue:** The docstring at `:64-68` promises the orchestrator never throws, and the callers rely on that: `replayStroke`/`replay` have no `catch`, and the recovery block only runs on a normal `false` return. Only `ensureBase` (`:81-85`) and `rebake` (`:106-111`) are exception-guarded. `restore` (`:97`), `resetSheet` (`:102`), `rollback` (`:113`), `notify` (`:118`) and `publishOwner` (`:119`) are not. The ports reach `applySnapshotContent` (signal writes, registry rebuild), `engine.clear()` through `aquarelleResetSheetRef`, `applyFrameModuleState` and `restoreAquarelleSnapshotRaw`.

Worst case: `restore` succeeds (the script is swapped and the revision bumped), then `resetSheet` throws. No rollback runs, `return false` never happens, the rejection propagates to whatever invokes undo (typically `void undo()`), and `reachedRebake` stays false so the caller deletes the cached id if it does catch the rejection. The live sheet is left cleared with a swapped script that was never re-baked, and an unhandled rejection surfaces. A throw in `notify`/`publishOwner` is milder but still turns a physically successful undo into a `false`/rejected result while the stacks have not moved.

**Fix:** Guard the restore and the post-restore steps so the contract is real:

```ts
let revert: Revert | null = null;
try { revert = ports.restore(editId, direction); } catch { return false; }
if (revert === null) return false;

try { ports.resetSheet(); } catch {
  try { ports.rollback(revert); } catch { /* raw restore failed; nothing else to do */ }
  return false;
}
// existing guarded rebake
...
try { ports.notify(); } catch { /* publish is best-effort */ }
try { ports.publishOwner(); } catch { /* publish is best-effort */ }
```

Alternatively, narrow the docstring to "never throws after a successful restore", and make the callers catch — but then the rollback obligation must move to the callers.

### WR-03: An evicted edit id permanently refuses that stroke's redo, because redo keeps dead cached ids by design

**File:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:574-583`
**Severity:** WARNING

**Issue:** `storeAquarelleEdit` caps the shared ledger at 10 by insertion order, and `restoreAquarelleEditSnapshot` returns `null` for an unknown id (`:783-784`). `aquarelleStrokeEditIdsRef` (`PhysicsPaintStudio.tsx:1507`) maps strokes to edit ids for the Studio's lifetime and is never pruned. The redo branch (`:4830-4834`) replays the cached id and, on failure, deliberately does not drop it (`:4845` gate; comment at `:4820-4822`). So once a stroke's edit is evicted, every redo of that stroke fails at `restore` and the stack never moves.

Reachable: the map accumulates edits for the whole session, including stale delete/move edits whose history entries were already trimmed (they are never removed) and leaked edits from failed prepares (IN-02). With the applied stack capped at 10 (`useRotoPhysicalEditHistory.ts:646-650`), an undo-then-undo-more sequence can create 10 new edits and evict an older stroke edit whose history entry is still sitting in `redoRef`. The subsequent redo of that stroke is silently refused forever.

**Fix:** Tie the edit-ledger lifetime to the history ledger instead of a raw count. Minimal actionable version:

1. Add `hasAquarelleEdit(editId)` (or make `restoreAquarelleEditSnapshot` distinguish "missing" from "stale") so `replayStroke` can drop a cached id that no longer exists even in the redo direction.
2. Remove an edit when its history entry leaves the ledger — a `release` hook for `paint`/`auto-key-paint` entries mirroring `releaseReferencedEntries` (`useRotoPhysicalEditHistory.ts:635-657`), or clear both the ref map and the module map in `clear()`.
3. Fix the comment at `PhysicsPaintStudio.tsx:4820-4822`: redo *can* hold a dead id.

### WR-04: The auto-key undo's compensating redo result is ignored; a failed compensation strands the composite entry

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:1061-1073`
**Severity:** WARNING

**Issue:** When the key half of an `auto-key-paint` undo is rejected, the stroke half is compensated with:

```ts
await route.replayStroke(entry.mutationId, 'redo');
```

The result is discarded with the comment "mirroring the engine call" (`redoPaint()` at `:1070`). But `redoPaint()` is a local engine history step and cannot fail on an authority guard; `replayStroke` can, and its failure is not symmetric. If the redo's restore or re-bake refuses after the undo half already committed, the script is left **without** the stroke while `appliedRef` still holds the composite entry and `redoRef` does not. The next Cmd+Z retries `replayStroke(..., 'undo')`, whose guard expects the live side to be the `after` content (`view/aquarelleStrokeSelection.ts:787`) — the live script is at the `before` side, so the guard returns `null` and the undo is refused. The user is stranded: the stroke is visually gone, no stack moved, and nothing reconciles the script with the ledger. With CR-01 unfixed, the same call site also feeds the permanent redo deadlock.

**Fix:** Check the result and make the failure explicit rather than swallowing it:

```ts
if (recordedStroke && route !== undefined) {
  const compensated = await route.replayStroke(entry.mutationId, 'redo');
  if (!compensated) {
    // The script half is no longer reversible; the composite entry cannot be
    // kept in either stack. Surface it and drop the entry deterministically.
    setLastError?.('The stroke could not be restored after a failed key undo.');
  }
}
```

At minimum, log and re-anchor (the CR-01 fix must run for redo so a later retry is not deadlocked), and add a test row for a rejected key replay whose compensation refuses.

## Info

### IN-01: `beginAquarelleStrokeUndoEdit` omits `clearAquarelleStrokeDrag()`

**File:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:642-665`
**Severity:** INFO

**Issue:** Every sibling edit builder clears the drag ghost before touching the script (`:608` delete, `:679` move, `:702`, `:724`, `:745`, `:764`). The stroke-undo builder does not. A replay installs a new snapshot, resets the live sheet and re-bakes, while the ghost overlay (if present) still holds pre-undo positions and stays visible until the next interaction. The replay's synchronous `invalidate` makes a mid-drag undo plausible.
**Fix:** Call `clearAquarelleStrokeDrag()` as the first statement, before the in-flight check, matching the other builders.

### IN-02: A failed prepare leaves an orphaned edit in the 10-entry ledger

**File:** `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts:89-98` (builder at `view/aquarelleStrokeSelection.ts:642-665`)
**Severity:** INFO

**Issue:** `prepare()` stores the edit before `restore` can refuse it. When `restore` returns `null` (revision drift between the build and the swap), the edit id is dropped from the caller's cache (`PhysicsPaintStudio.tsx:4848`) but the record stays in `aquarelleEdits` forever. Repeated failures leak slots and evict live edits (feeds WR-03). The delete/move handlers avoid this by recording the edit only after a successful bake.
**Fix:** Add `dropAquarelleEdit(editId)` and call it when `restore` returns `null`, or pass the builder a deferred commit so the record is stored only after a successful restore.

### IN-03: The session-global epoch is broader than the per-key guard and narrower than CR-02 needs; the transaction commit guard is unreachable

**File:** `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts:631-685`
**Severity:** INFO

**Issue:** Two verification notes:

1. `getScriptEpoch` reads the global `aquarelleStrokesRevision` (`PhysicsPaintStudio.tsx:1420`), while a capture is keyed to one `(launch, layer, key, contentRevision, appFrame)` identity. The replay's step-1 `invalidateLivePixels(playFrame)` already bumps that key's revision, and `rotoLivePixelCacheTransactions.ts` checks the per-key revision at produce (`:180`) and commit (`:203`). The epoch's only incremental effect is rejecting captures for *other* frames/keys, whose pixels are unaffected by the replay — and it does not help the stroke's own frame in the CR-02 case, where the current-frame invalidation is the wrong key. A per-frame or per-key epoch would match the invariant; the global one is over-broad and under-targeted.
2. The epoch gate exists "exactly twice", as intended, but the second occurrence (top of `commit`, `:201`) cannot fire: the queue calls `isStillWanted('before-commit')` (`pilot/finalizationQueue.ts:221`) and then `turn.commit(...)` (`:233`) with no await in between, so nothing can change the revision in the gap. The test row at `rotoLivePixelCacheTransactions.test.ts:266-299` (outcome `stale-before-commit`) therefore exercises the queue's gate, not the transaction's own guard. Harmless defense in depth, but the comments and test name overstate what is proven.
**Fix:** None required for correctness. If the epoch is kept, scope it per frame (or drop it in favour of the per-key revision) and note in the test that the pre-commit gate is the queue's.

### IN-04: No test covers a failed redo — the one branch that contains CR-01

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts:3229`
**Severity:** INFO

**Issue:** `aquarelleStrokeSelection.test.ts:875-891` covers the happy-path undo/redo cycle, and `:949-960` covers the undo-side re-anchor while asserting the opposite side stays fail-closed. The Studio source pin at `:3229` asserts the literal `if (direction === 'undo' && enteredReplay)`, locking in the CR-01 defect. Nothing exercises a redo whose bake fails and is retried, which is why the bug shipped green.
**Fix:** Add a `replayStroke` row (or a `runScriptReplay` integration row) that fails the redo bake on the first attempt, asserts the cached edit is re-anchored, and asserts the second Cmd+Shift+Z succeeds. Update the source pin to the corrected recovery condition.

---

_Reviewed: 2026-10-29T15:44:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
