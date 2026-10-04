---
phase: quick-261004-dn5
plan: 261004-dn5
subsystem: physic-paint-studio-tools
tags: [physic-paint, studio, move-tool, temporary-move, preact-signals, tdd]

# Dependency graph
requires:
  - phase: quick-261003-vos
    provides: "the dual-arm host module this quick extends — physicsPaintTemporaryErase.ts (Alt arm, gesture-boundary deferral, event hygiene) is the ONE file both arms live in"
  - phase: quick-261003-hpi
    provides: "resolveEraseTargetIds — the ONE geometric ribbon-overlap detection law reused verbatim for move hover + move gesture start"
provides:
  - "Move tool in the Physics Paint Studio left rail, directly under Erase, enabled only while a stroke script is in memory"
  - "Cmd/Meta held in Paint mode = temporary move (same gated-arm lifecycle as the UAT-closed Alt erase); MOVE WINS when both arms are held"
  - "Engine move contract: hover previews the target stroke, one click-drag rigidly translates entry + deposit, release commits, in-memory script refreshed so Save writes moved coordinates"
affects: [physic-paint-studio, physic-paint-engine, tool-rail]

# Actuals (#2632) — pairs with the plan's estimate (tokens 78000)
actuals:
  tokens: 24655    # chars/4 over the realized diff (98619 diff chars)
  tasks: 3
  commits: 3       # measured: git rev-list --count 41fbd6e523fa0cb23117a0b4ba164e3930c2996a..HEAD

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dual-arm ephemeral modifier tool: one signal pair + ONE combination rule (combineEffectiveTool) + boundary-deferred engine.setTool"
    - "single detection law: resolveEraseTargetIds reused verbatim for hover + gesture start (no second hit-test)"
    - "frozen stroke points: move commit assigns a NEW array of NEW objects — undo entry keeps identity, so Undo/Redo follow implicitly and move pushes NO undo checkpoint"

key-files:
  created:
    - app/src/assets/physics-paint-ui/icons/move-tool.svg
    - app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts
  modified:
    - packages/efx-physic-paint/src/types.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "combineEffectiveTool first argument = 'some temporary arm is held' (erase||move), third = the move arm — the ONE combination rule satisfies every committed precedence cell while keeping all reachable states identical to the plan's intent (only Cmd -> move, only Alt -> erase, both -> move, none -> paint)"
  - "move commit rewrites allActions[index].points with a new array of new objects and clears redoStack — undo follows implicitly through the existing history entry; move pushes no checkpoint, matching the plan's 'Undo after a move undoes the last PAINT' row"
  - "strokeScriptInMemory is written from the EXISTING history listener (fires immediately on attach + on every allActions change) — the rail's only feature gate, no new engine call, no new Studio effect"
  - "startMoveGesture resolves its target at pointerdown and refuses silently (no drawing, no rawPts) when there is none — a baked/pixel stroke can never start a move gesture"

requirements-completed: [QUICK-261004-DN5]

coverage:
  - id: D1
    description: "Move geometry contract: hover preview, rigid (dx,dy) translate of every point with p/tx/ty/tw/spd/timestamp/params untouched, <1px discard, script refreshed, look parity through redrawAll, frozen look constants untouched"
    requirement: QUICK-261004-DN5
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts (17 cells) + full package suite (50 files, 414 tests) + full app suite (235 files, 4421 tests) + both typechecks"
        status: pass
    human_judgment: false
  - id: D2
    description: "Studio experience: Move icon under Erase gated by stroke script, Cmd-held temporary move, release/blur/hidden recovery, chords unaffected, Save/reopen fidelity, look parity after move"
    requirement: QUICK-261004-DN5
    verification:
      - kind: uat
        ref: "native UAT rows (a)-(e) — approved 2026-10-04 (see Native UAT section)"
        status: pass
    human_judgment: true
    rationale: "Modifier timing, hover/drag feel, Save/reopen fidelity and look parity live only in the native Studio webview — vitest is blind to them (node env, no DOM)"

# Metrics
duration: 92min
completed: 2026-10-04
status: complete
plan_head_before: 41fbd6e523fa0cb23117a0b4ba164e3930c2996a
---

# Phase quick-261004-dn5: Move tool on fresh strokes Summary

**Status: CLOSED — native UAT approved 2026-10-04 (rows a–e all passed live).**

**A Move tool now sits directly under Erase in the Physics Paint Studio rail, enabled only while a stroke script is in memory: selecting it (or holding Cmd in Paint mode as a temporary arm) lets one click-drag rigidly translate a whole fresh stroke — hover previews it, release commits, the in-memory script is refreshed so Save writes the moved coordinates — while baked/pixel paint, the frozen look constants and every existing Cmd chord stay byte-for-byte untouched.**

## Performance

- **Duration:** 92 min (plan base -> SUMMARY; includes a mid-execution context compaction)
- **Started:** 2026-10-04T08:13:24Z (plan base commit 41fbd6e5)
- **Completed:** 2026-10-04T09:47Z
- **Tasks:** 3/3
- **Files modified:** 8 (3 new, 5 modified)

## Accomplishments

- **TDD RED first:** Task 1 (a729ae33) committed both contract test files before any implementation; both commands failed pre-implementation (RED evidence below, re-verified against the bit-identical pre-implementation tree after a context compaction).
- **One detection law:** move hover and move gesture start both call the engine's existing `resolveEraseTargetIds(gesturePoints, brushOpts, firstOnly)` verbatim — no second hit-test, no wetness gate, newest-first ordering unchanged.
- **Frozen points, free undo:** a painted stroke's points are frozen at acceptStroke, so the move commit assigns a NEW array of NEW objects on the SAME action entry — the existing history entry keeps its identity and Undo/Redo follow implicitly; move clears redoStack and pushes NO undo checkpoint.
- **Dual-arm, one rule:** the UAT-closed Alt arm is behaviorally byte-identical (same gates, unconditional release, zero preventDefault/stopPropagation); Cmd/Meta arms move through the same lifecycle; `combineEffectiveTool` is still the ONE combination rule and ranks move above erase; blur/hidden/teardown clear BOTH arms.
- **Rail gating:** the Move icon renders directly under Erase and is disabled while `strokeScriptInMemory` is false — the signal is written from the Studio's existing history listener, read in one narrow rail leaf (`!strokeScriptInMemory.value`), never in a container.
- **Full gates green:** app suite 235 files / 4421 tests, package suite 50 files / 414 tests, both `tsc --noEmit` clean, package build success; scope proof exactly the plan's 8-file allowlist.

## Task Commits

Each code task was committed atomically (docs left to the orchestrator):

1. **Task 1 (RED): move-translate + dual-arm + rail contract tests** - `a729ae33` (test)
2. **Task 2 (GREEN): engine move tool — hover preview, rigid translate, script refreshed** - `3417a6cd` (feat)
3. **Task 3 (GREEN): Cmd temporary move arm + Move rail icon gated by stroke script** - `4a055e7e` (feat)

**Plan base (ledger):** `41fbd6e523fa0cb23117a0b4ba164e3930c2996a` recorded at `$(git rev-parse --git-dir)/gsd-plan-head-before-261004-dn5` BEFORE the first commit (`.git` is a file in this worktree, so the plan's `cat .git/...` form resolves through `git rev-parse --git-dir`), `commits: 3` measured from it.

## RED Evidence (Task 1, recorded honestly)

Both Task 1 commands failed pre-implementation. The original in-session outputs were consumed by a context compaction; the outputs below were re-verified by re-running the RED test files exactly as committed in a729ae33 against the pre-implementation sources (41fbd6e5), then restoring the tree (verified `git status --short` clean):

```bash
# Command 1 — app arm/rail contract at base
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
#   → Test Files  1 failed (1)
#      Tests  33 failed | 5 passed (38)
#   first errors: expected 'erase' to be 'move' (precedence cell a),
#                 Cannot set properties of undefined (setting 'value')  (temporaryMove signal missing),
#                 handleTemporaryMoveKeyDown is not a function          (arm handlers missing)

# Command 2 — engine move contract at base
cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/engine/EfxPaintEngine.moveTranslate.test.ts
#   → Test Files  1 failed (1)
#      Tests  11 failed | 6 passed (17)
#   first errors: expected null to be 1 (hover target never set),
#                 expected 20 to be 40 (no translation applied)
```

Both files were committed failing-first; GREEN turned them green with ZERO edits to the precedence, gesture, hygiene, rail-pin or Studio-pin cells (the two EVENT HYGIENE dispatcher cells were corrected in Task 3 — see Deviations 3-4).

## GREEN Verification (exact commands, all run)

```bash
# Targeted — app dual-arm contract (Task 3 done criteria)
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
#   → Test Files  1 passed (1)
#      Tests  38 passed (38)

# Targeted — engine move contract (Task 2)
#   → 17/17 passed

# Full gates (Task 3)
pnpm --filter @efxlab/efx-physic-paint build
#   → ESM Build success, DTS Build success (dist/EfxPaintEngine-D31QVpSK.d.ts ships ToolType = 'paint' | 'erase' | 'move')
pnpm --filter efx-motion-editor exec vitest run
#   → Test Files  235 passed | 2 skipped (237)
#      Tests  4421 passed | 1 skipped | 101 todo (4523)
cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run
#   → Test Files  50 passed (50)
#      Tests  414 passed | 3 skipped (417)
pnpm --filter efx-motion-editor exec tsc --noEmit    # → exit 0, clean
pnpm --filter @efxlab/efx-physic-paint run check     # → exit 0, clean (tsc --noEmit)
```

## Scope Proof (vs plan base 41fbd6e5)

```bash
git diff --name-only "$(cat "$(git rev-parse --git-dir)/gsd-plan-head-before-261004-dn5")"...HEAD
#   app/src/assets/physics-paint-ui/icons/move-tool.svg
#   app/src/components/physic-paint/PhysicsPaintStudio.tsx
#   app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
#   app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
#   app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
#   packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts
#   packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
#   packages/efx-physic-paint/src/types.ts
```

Exactly the plan's `files_modified` list (8/8). Negative greps: **0** matches for `app/src/lib/shortcuts.ts`, `app/src/components/canvas/`, `app/src/stores/paintStore.ts`, `physicsPaintStudioKeyboard.ts`, `physicsPaintTemporaryErase.test.ts`, `compositor.ts`, `drying.ts`, `wet-layer.ts`. Frozen-knob literals (`wetDisplayAlpha`, `DEPOSIT_KEEP_TIER`, `DEPOSIT_DENSITY_SCALE`, `PAPER_ADSORPTION_GAMMA`) in the diff outside comments/tests: **0**. Post-commit deletion check: empty.

## Files Created/Modified

- `packages/efx-physic-paint/src/types.ts` — `ToolType` gains `'move'`.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — move hover (`updateMoveHover`/`clearMoveHover`, preview stroke at 0.6 opacity, pointer glyph, overlay bounds), move gesture (`startMoveGesture`/`updateMoveGesture`/`finishMoveGesture`), commit (`commitMoveGesture`: new points array, redoStack cleared, `displayCompositeDirty`, `redrawAll`, `notifyCompletedMutation('move')`), pointer pipeline branches gated on `state.tool === 'move'`. NOT edited: `resolveEraseTargetIds`, `redrawAll`, `serializeProject`, compositor/drying/wet-layer, frozen constants.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts` (NEW) — 17-cell engine contract (hover, drag rigidity, <1px discard, script refresh/Save, look parity, pointer lifecycle).
- `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts` — dual-arm extension: `temporaryMove` signal, move-precedence `combineEffectiveTool`, `handleTemporaryMoveKeyDown/KeyUp` (Meta, same gates as Alt), blur/hidden/teardown/reset clear BOTH arms, key listeners dispatch both handlers without consuming the event. Alt-arm handler bodies otherwise byte-identical.
- `app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts` (NEW) — 38-cell contract of record (PRECEDENCE, GATED META ARM, UNCONDITIONAL KEYUP, BLUR/VISIBILITY, EVENT HYGIENE, BOUNDARY DEFERRAL, MOUNT/TEARDOWN, source pins for rail + Studio).
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — `'move'` union + rail item directly under Erase, `isItemActive` branch, `onSelectTool('move', physicsMode)`, required `strokeScriptInMemory` prop gating `disabled` (narrow `.value` leaf read inside the memoized rail IMPL).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `strokeScriptInMemory` signal, written inside the existing `setHistoryAvailabilityListener` (`readyEngine.getStrokeCount() > 0`), armed-guard now peeks BOTH arms, tool-rail identity memo passes the signal through.
- `app/src/assets/physics-paint-ui/icons/move-tool.svg` (NEW) — 4-way move glyph, conventions matched to the sibling icons (`width/height 32`, `viewBox 0 0 64 64`, `fill="currentColor"`).

## Cmd-Binding Audit (re-run at HEAD — guardrail 1)

```
BINDING                                  | WHERE (physicsPaintStudioKeyboard.ts) | VERDICT
---------------------------------------- | ------------------------------------- | --------
Cmd+Shift+Z redo                        | :119                                  | UNTOUCHED (file diff EMPTY)
Ctrl+Y redo                             | :125                                  | UNTOUCHED
Cmd+Z undo                              | :131                                  | UNTOUCHED — dispatcher's own preventDefault fires once, arm never sees it
Cmd+Shift+N addTrack                    | :142                                  | UNTOUCHED
Cmd+Shift+D duplicateTrack              | :148                                  | UNTOUCHED
Cmd+C/X/V roto clipboard                | :154                                  | UNTOUCHED
? shortcuts dialog                      | :162                                  | UNTOUCHED
Backspace/Delete roto delete            | :167                                  | UNTOUCHED (Alt exclusions preserved)
Cmd+A Select All (strip-scoped)         | :196                                  | UNTOUCHED
Escape layer cascade                    | :210                                  | UNTOUCHED
main-window Cmd chords                  | app/src/lib/shortcuts.ts              | different window — not mounted on /physics-paint; scope proof EMPTY
```

Arm-handler hygiene: the source-body assertion (EVENT HYGIENE cell) proves no handler in `physicsPaintTemporaryErase.ts` contains `preventDefault` or `stopPropagation`; the dispatcher integration cells prove Cmd+Z still fires undo, Cmd+C/V still fire their actions, Cmd+Shift+Z fires redo and Cmd+A fires select-all while the move arm is armed. `physicsPaintStudioKeyboard.ts` diff is EMPTY (scope proof).

## Out of Scope (guardrail)

The main-window inline paint editor and `app/src/lib/shortcuts.ts` are OUT OF SCOPE — this quick targets only the Physics Paint Studio window. `applyStrokeToEngine` gained no `'move'` branch; baked/pixel strokes have no script entry and can never become move targets (startMoveGesture refuses silently).

## Deviations from Plan

**1. [Rule 1 - Test harness] Engine test mock deposits color + saturating alpha**
- **Found during:** Task 2 (GREEN)
- **Issue:** The test's mock `renderPaintStroke` deposited only alpha/strokeOpacity, leaving wet.r/g/b at 0 and alpha at a flat 500 — under identity `wetDisplayAlpha` the forceDryAll transfer then painted a different color than the live rasterizer (harness artifact only; production replay uses the real rasterizer with the same color/params).
- **Fix:** the mock now parses the stroke color hex and deposits r/g/b, and deposits alpha at 5000 (the saturating regime the live rasterizer reaches through overlapping deposits), with both changes commented in the test.
- **Files modified:** packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts
- **Commit:** 3417a6cd

**2. [Interpretation] combineEffectiveTool: first argument = "some arm held"**
- **Found during:** Task 3 (first run of the 38-cell contract)
- **Issue:** The plan's Task 3 literal rule (`moveArmed && selected === 'paint' ? 'move' : …`) contradicts the committed RED cell `combineEffectiveTool(false, 'paint', true) === 'paint'` (a move flag with the first argument false must stay 'paint'); no positional assignment of the two signals satisfies both the precedence group and the resolve group under the literal rule. The test file states it is the contract of record.
- **Fix:** `combineEffectiveTool(armed, selected, moveArmed)`: `armed && moveArmed && paint → 'move'`, else `armed && paint → 'erase'`, else pass-through; `resolveEffectiveTool`/`readEffectiveTool` pass `eraseArm || moveArm` as the first argument and the move signal as the third. Every reachable state is identical to the plan's intent (only Cmd → move, only Alt → erase, both → move, none → paint); the impossible input (first arg false, move flag true) safely falls through to 'paint'. All 6 precedence cells + 3 two-arg cells + 4 resolve cells green with ZERO assertion edits.
- **Files modified:** app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
- **Commit:** 4a055e7e

**3. [Rule 1 - Test bug] Dispatcher meta+Z cell: preventDefault is the dispatcher's own**
- **Found during:** Task 3
- **Issue:** The RED cell asserted `preventDefault` was never called for Cmd+Z, but `physicsPaintStudioKeyboard.ts:131` (read-only, pre-existing) calls `event.preventDefault()` for Cmd+Z by design (browser-undo suppression). The guardrail is that the ARM never consumes the event, not that the dispatcher stops doing so.
- **Fix:** assertion changed to `toHaveBeenCalledTimes(1)` with a comment pinning that the single call is the dispatcher's own pre-existing branch; `undo` fired and `stopPropagation` stays at zero (dispatcher never calls it).
- **Files modified:** app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts (the quick's own new contract file — the plan forbids editing `physicsPaintStudioKeyboard.ts` and `physicsPaintTemporaryErase.test.ts`, neither touched)
- **Commit:** 4a055e7e

**4. [Rule 1 - Test bug] Dispatcher Cmd+A cell: Select All is workflow-strip scoped**
- **Found during:** Task 3
- **Issue:** The dispatcher gates Select All on `event.target.closest('.physics-paint-workflow-strip')` (strip-focus scoping, Pitfall 5 — pre-existing, read-only); the fake target's `closest()` always returned null, so the cell could never reach its action.
- **Fix:** `TestHTMLElement.closest` now answers a marker only for the exact `.physics-paint-workflow-strip` selector and keeps null for every other selector (input guards, rail targets) — the cell now proves the real dispatcher path fires while the move arm is armed.
- **Files modified:** app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
- **Commit:** 4a055e7e

No Rule 4 changes — no architectural modification; no package installs (T-dn5-SC respected).

## Known Stubs

None. No placeholder values, no TODO/FIXME, no unwired prop (`strokeScriptInMemory` is written by the existing history listener), no skipped or `todo` test added by this quick.

## Threat Flags

None — no new surface beyond the plan's `<threat_model>` (T-dn5-01..05 cover the Cmd-chord trust boundary, frozen look constants, Save fidelity, cross-window isolation and scope; T-dn5-SC: no installs). No installs were performed. No new network endpoints, auth paths or schema changes.

## Native UAT — PASSED 2026-10-04

**All five rows approved live** (user verdict 2026-10-04):

**(a)** Move icon greyed on an empty frame, enabled after painting one stroke; icon sits directly under Erase.

**(b)** Select Move (no Cmd): hover previews stroke; drag translates whole stroke; release commits; Save → reopen keeps moved coordinates; click-without-drag is a no-op.

**(c)** Cmd held in Paint mode = temporary move; release restores Paint; lost-keyup/Alt+Tab/hidden window never leaves the Studio stuck on move; Cmd+Z/Cmd+Shift+Z/Cmd+C/X/V/A all unaffected.

**(d)** Pixel-only (baked) paint unchanged — existing strokes/erasures behave exactly as before.

**(e)** Look parity after move (same color/radius/texture, no re-simulation); Undo after a move undoes the last PAINT (no move undo entry) and Redo is unavailable until the next paint.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
- FOUND: app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
- FOUND: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx (modified)
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx (modified)
- FOUND: app/src/assets/physics-paint-ui/icons/move-tool.svg (created)
- FOUND: packages/efx-physic-paint/src/types.ts, src/engine/EfxPaintEngine.ts, src/engine/EfxPaintEngine.moveTranslate.test.ts (modified/created)
- FOUND: a729ae33, 3417a6cd, 4a055e7e (all in git log)
- Scope allowlist exact (8/8); forbidden-path greps EMPTY; frozen-knob grep EMPTY; full suites + both typechecks + build green
