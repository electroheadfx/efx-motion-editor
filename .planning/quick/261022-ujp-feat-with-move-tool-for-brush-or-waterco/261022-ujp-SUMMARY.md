---
phase: quick-261022-ujp
plan: 261022-ujp
subsystem: physic-paint
tags: [keyboard-shortcuts, stroke-stack, watercolor, brush-engine, undo-redo, persistence]
requires:
  - 261022-pim
  - 261022-tv1
provides:
  - "Space steps a selected/hovered stroke one paint step backward (watercolor + brush)"
affects:
  - "physicsPaintStudioKeyboard Space dispatch"
  - "EfxPaintEngine paint-order projection and serialization"
tech-stack:
  added: []
  patterns:
    - "Paint-order projection kept separate from the acceptance/undo ledger"
    - "Reorder gesture re-applied through the shared Apply pipeline (one undo step)"
key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
key-decisions:
  - "allActions stays the acceptance/undo ledger; a new strokeStack is a paint-order projection of the same object refs, followed by rendering and serialization."
  - "The group walk runs on liveActionsInPaintOrder (dead refs filtered), so an interleaved dead ref cannot make 'already at front' falsely succeed and clear the redo stack for a no-op."
  - "Once a target holds, Space is consumed even when the step is refused (physical lock, already first), matching Backspace/delete semantics; playback only keeps Space where no target exists."
  - "A watercolor reorder resets the sheet and replays the frame through applyAquarelleTimeline so reorder + re-bake is one aquarelle-script undo step; a failed replay restores the before snapshot and reports a refusal."
  - "buildAquarelleEventsFromCapture now walks the recorded payload timeline so a reorder survives capture/clipboard/save rather than being undone by engine capture order."
actuals:
  tokens: 19862
  tasks: 3
  commits: 3
plan_head_before: c4f66b01c24483b1d33fd4f4618bc0b1c88f210a
plan_head_after: d245768fd7052cd67cd6ed967241fe57e094e041
metrics:
  duration: "26m"
  completed: "2026-10-22"
status: complete
---

# Quick 261022-ujp: Space steps a stroke back in the paint stack — Summary

Space restacks finished strokes without repainting: Water color swaps a selected stroke's payload-timeline entry with the nearest older same-frame stroke and re-applies the frame script as one undoable `aquarelle-script` edit, while Brush sends the hovered stroke one step back in a new paint-order projection and redraws like a move commit — playback keeps Space wherever no target exists.

## What Was Built

### Water color (Task 1)

- `sendAquarelleStrokeBackwardInScript(mutationId)` in `view/aquarelleRecordState.ts` resolves the recorded entry, walks backward for the nearest same-`playFrame` stroke that is not deleted (Dry events skipped), swaps the two entries by index assignment, and bumps the revision.
- `beginAquarelleReorderEdit(mutationId)` in `view/aquarelleStrokeSelection.ts` mirrors `beginAquarelleMoveEdit`: clears any drag, refuses while a script edit is in flight, captures before/after snapshots, and stores the edit.
- `handleAquarelleSendBackward` in `PhysicsPaintStudio.tsx` gates on the physical mutation lock, script apply/lock, a real (non-interpolated) frame cell, and the in-flight guard; then resets the sheet, awaits `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`, records the script edit on success, and restores the before snapshot with a refusal message on failure.
- `view/physicsPaintRotoScriptClipboard.ts` now derives captured events from the recorded payload timeline so the new order survives clipboard/capture projections.

### Brush (Task 2)

- `EfxPaintEngine` gains a documented `strokeStack` paint-order projection of ledger refs with `liveStrokeStack()`, `liveActionsInPaintOrder()`, and `pushAcceptedActions()`. Both acceptance sites append to both arrays; `redrawAll`, `getStrokes`, and `serializeProject` follow the projection; `clear` empties it; `loadProjectData` reseeds it.
- Public `getMoveTargetMutationId()` returns the hover target only while the Move tool is active; public `sendStrokeBackward(mutationId)` flushes pending finalizations, finds the primary in live paint order, swaps its contiguous group (primary + following zero-point continuations) with the previous group, clears the redo stack, redraws, emits `notifyCompletedMutation('move', mutationId)`, and keeps the hover target. `allActions` is never reordered and no undo checkpoint is pushed.

### Gating and affordances (Tasks 1 + 3)

- `view/physicsPaintStudioKeyboard.ts`: a Space branch precedes the playback branch, guarded by `!repeat`, no meta/ctrl/alt/shift, and `!state.isPlaying`; `preventDefault` fires only when `stepSelectedStrokeBackward()` returns true. Fall-through keeps the existing playback toggle verbatim.
- Both rail tooltips name the shortcut: Brush Move ("Space sends the hovered stroke one step back") and Water color Select ("Space sends the selected stroke one step back").

## Verification Results

All gates run per plan; package-related suites run against the built `dist` after the package build.

| Gate | Result |
|------|--------|
| Task 3 targeted suites | 407 passed / 4 files |
| Task 1 six-suite gate | 418 passed / 6 files |
| Engine targets (5 suites) | 46 passed / 5 files |
| Full app suite (`pnpm vitest run` from `app/`) | 9 failed, 5471 passed, 1 skipped, 96 todo (5577) / 315 files |
| Full package suite | 30 failed, 356 passed, 3 skipped (389) / 47 files |
| App typecheck | 15 errors, equal to the pre-existing baseline |
| Package build + `tsc --noEmit` | clean |

### Orchestrator follow-up — stroke loss on restack (`e973ef33`)

Reported live: sending a watercolor stroke back made it vanish (2-stroke repro:
blue behind pink → blue gone; the opposite key brought it back, so the script
data was intact). Root cause is in the re-bake, not the data: `buildRecordedTimeline`
(`packages/efx-watercolor/src/bake/aquarelleBake.ts`) derives each start tick
from the stroke's wall-clock `recordedOrder` and clamps it to the previous
stroke's end. The step moved positions but left the clock, so the moved stroke's
start collapsed onto its new neighbour — the underpainting was replayed into a
still-wet sheet and the water absorbed it.

The step now swaps `recordedOrder` / `timestamp` with the positions, replacing
entries rather than mutating them (snapshots hold references, so undo still
restores the captured `before` side). Pinned at both layers: the timeline keeps
a monotonic clock in paint order (`aquarelleRecordState.reorder.test.ts`) and
the bake simulates the original ~114-tick idle gap instead of zero
(`aquarelleBake.test.ts`, both directions of the repro).

### Orchestrator follow-up — shortcuts (`f8d6b0cf`)

Live feedback replaced Space with explicit stack keys: `<` steps the target one
position back, `>` one position forward (new `sendStrokeForward` /
`sendAquarelleStrokeForwardInScript`), and Space is playback-only again. Shift is
deliberately unguarded in the gate because `<` / `>` are Shift-produced
characters on a US layout. Both rail tooltips name the new pair.

### Orchestrator follow-up — hit test (`eac877a3`)

`resolveEraseTargetIds` walked the acceptance ledger newest-first. That law is
only equivalent to "visually topmost" while paint order equals acceptance
order, which the stack step ends. Left alone, the Move/Erase preview and the
click/delete target would resolve to a stroke the user sees underneath another
after a restack. The walk now follows the paint-order projection, and
`EfxPaintEngine.strokeReorder.test.ts` pins the retarget (10 tests, all green).
The numbers above are post-fix; no new failures appeared.

Full-suite failures are pre-existing and outside this quick:

- App: all allowlisted files (`PhysicsPaintRightSidebar`, `PhysicsPaintWorkflowStrip.viewport`, `efxPaintCompositorMatrix`, `exportEngine`, `paperPass.frameGuard`) plus `rotoCompletionPaintGuard.test.ts` (2 tests). The `rotoCompletionPaintGuard` failure is not on the plan allowlist, so it was proved pre-existing by reproducing the identical 2 failures in a temporary git worktree at `ddef0569` (pre-Task-2 HEAD); the worktree was removed afterwards. The shared cause is harness drift (`previewBaseMatteCache`/`dualCanvas.dryCtx` undefined), not this quick.
- Package: 6 failing files / 30 tests, all proven identical at `ddef0569` in the same temporary worktree.

## TDD Gate Compliance

Not a `type: tdd` plan. Tests were still written alongside each behavior (engine reorder suite, aquarelle reorder suite, keyboard and Studio wiring pins) and all pass.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] TypeScript union narrowing in Task 1 tests**
   - **Found during:** Task 1 typecheck.
   - **Issue:** 11 TS2339 errors indexing `readonly AquarellePayloadEvent[]` without narrowing to stroke events.
   - **Fix:** Added `'kind' in event` guards plus an `asTimelineStroke()` helper typed as `ReturnType<typeof aquarelleToStudioStroke>`; replaced a non-narrowing `.filter()` with `flatMap` in the clipboard test.
   - **Files modified:** `view/aquarelleRecordState.reorder.test.ts`, `roto/physicsPaintRotoScriptClipboard.test.ts`.
   - **Commit:** `ddef0569`.

2. **[Rule 1 - Bug] Refusal-message mention pin updated 6 → 7**
   - **Found during:** Task 1 wired-guard test run.
   - **Issue:** `PhysicsPaintStudio.test.ts` pinned the refusal copy to exactly six call sites; the new send-backward handler is a legitimate seventh.
   - **Fix:** Updated the pin to 7 with a dated `261022-ujp` comment.
   - **Commit:** `ddef0569`.

3. **[Rule 1 - Bug] Engine reorder tests initially missed `setTool('move')`**
   - **Found during:** First run of `EfxPaintEngine.strokeReorder.test.ts` (2 failures).
   - **Issue:** `sendStrokeBackward` refuses outside the Move tool by design; the save/load and undo/redo cells never armed Move.
   - **Fix:** Added `setTool('move')` in those cells. Test-only correction, no production behavior change.
   - **Commit:** `cdaf5518`.

4. **[Rule 1 - Bug] Source-pin text mismatches**
   - **Found during:** Task 3 pin run.
   - **Issue:** Engine source uses a no-semicolon style, and a slice boundary captured a JSDoc containing the word "splice".
   - **Fix:** Pins now match exact semicolon-less text and assert on `.splice(` instead of the bare word.
   - **Files modified:** `PhysicsPaintStudio.test.ts`.
   - **Commit:** `d245768f`.

No Rule 2/3/4 deviations. No architectural change was required.

## Known Stubs

None. The feature is wired end-to-end in both modules; no placeholder data or TODOs were introduced.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes at trust boundaries. Reorder is gated by the existing physical mutation lock and script in-flight guard; no new serialization surface (the projection reuses the existing stroke schema and capture format).

## Live UAT

PENDING — user-run, the only completion signal:

1. **Water color:** select a recorded stroke, press Space → the app shows the `0/N → N/N` re-apply pill and the stroke renders behind the next older stroke; Cmd+Z restores the previous order (and re-bakes it), Cmd+Shift+Z re-applies.
2. **Brush:** with the Move tool over a stroke, press Space → the canvas redraws with the stroke one paint step back; repeated Space presses keep stepping the same hovered stroke; Backspace and drag still work afterwards.
3. **Space unchanged elsewhere:** Space still toggles playback outside move/select mode, with no target, while playing, on key repeat, and with a modifier held.

Automated-ready until all three rows pass.

## Self-Check: PASSED

Three task commits verified reachable from HEAD; all 12 modified/created files present on disk; summary written to `.planning/quick/261022-ujp-feat-with-move-tool-for-brush-or-waterco/261022-ujp-SUMMARY.md`.

## Commits

| Commit | Message |
|--------|---------|
| `ddef0569` | feat(261022-ujp): Space steps a recorded watercolor stroke back in the paint stack |
| `cdaf5518` | feat(261022-ujp): Space sends the hovered Brush stroke one paint step back |
| `d245768f` | docs(261022-ujp): name the Space stack step in both rail tooltips and pin the wiring |
