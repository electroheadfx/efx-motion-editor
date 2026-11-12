---
phase: 61-vector-painting-tool
plan: 20
subsystem: ui
tags: [preact, signals, undo-ledger, vector-path, rebake, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-15 the ONE writer/bake seam commitAquarelleVectorPathEdit, 61-18 the refusal preceding it, 61-19 the width member routed through it
provides:
  - The re-bake route's single ledger entry, recorded in commitAquarelleVectorPathEdit's onSuccess tail
  - The defer route's single ledger entry, recorded before setDraftPixelsDirty(true)
  - The stable recordAquarelleScriptEdit callback in the commit's dependency array (never the per-render wrapper)
  - Region-scoped pins proving one entry per gesture, none on failure, none from any delegating vector route
affects: []

actuals:
  tokens: 2284
  tasks: 2
  commits: 4
  plan_head_before: 94eb80f74d53c987575daf62134680b386321650
  plan_head_after: aa3e3dc2c806bfb734181809cdac704139b4c88c

tech-stack:
  added: []
  patterns:
    - "Record the undo entry as a success callback of the bounded re-bake sequence — after apply resolves true, never before, nothing on failure"
    - "Record the defer route BEFORE the dirty flag: the deferred re-render changes when pixels appear, never whether the gesture is undoable"
    - "Depend on the stable recorder useCallback, never the wrapper object a hook returns fresh each render (efx-preact-reactivity §4)"
    - "Slice source pins by structural markers inside the one writer (onSuccess:, onFailure:, if (draft || wireframe) {) and assert exact site counts per region"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Both record sites live INSIDE commitAquarelleVectorPathEdit — the one writer 61-15 built — so the Anchor width member, handleAquarelleVectorPathEdit and the draw tail all delegate and can never double-count (G-8)"
  - "The re-bake record sits first in onSuccess, before setLastError(null), mirroring the shipped delete handler's record-then-clear ordering; the failure route restores the snapshot and records nothing"
  - "The defer record sits immediately before setDraftPixelsDirty(true), mirroring the shipped Draft delete branch: the edit is synchronous, so there is no in-flight flag, reset or apply"
  - "The commit depends on rotoMoveHistory.recordAquarelleScriptEdit (the hook's stable useCallback) and never on the per-render wrapper, pinned by a negative source assertion"
  - "The draw bake (bakeAquarelleVectorCommit) gets no record: a draw is a paint mutation, and recording it as an aquarelle-script command would double-count the gesture"

requirements-completed: [VEC-07]

coverage:
  - id: D1
    description: "A completed vector path edit records exactly ONE aquarelle-script ledger entry on BOTH shared-commit success routes (defer and re-bake), one per gesture, never one per anchor (G-8, VEC-07)"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > records exactly once on the re-bake success tail, between onSuccess and onFailure"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > records exactly once on the defer route, before the dirty flag"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > totals exactly two record sites, both before the failure restore"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed re-bake records nothing: the commit restores the pre-edit snapshot and leaves the undo stack unchanged, so Undo can never claim an edit the sheet rejected (G-8)"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > records nothing on the failure route"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > records after the bake resolved and before any failure restore"
        status: pass
    human_judgment: false
  - id: D3
    description: "The recorder is the stable recordAquarelleScriptEdit callback in the dependency array, never the per-render rotoMoveHistory wrapper (efx-preact-reactivity §4)"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > depends on the stable recorder callback, never the per-render wrapper"
        status: pass
    human_judgment: false
  - id: D4
    description: "No other vector route records: the Anchor width member, handleAquarelleVectorPathEdit and the draw tail all delegate to the one commit, so the entry count stays one per gesture (G-8)"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-20 G-8: a vector path edit is exactly one undo entry > keeps every delegating vector route record-free"
        status: pass
    human_judgment: false
  - id: D5
    description: "The recorded entry replays through the shipped aquarelle-script ledger route with the edit id the commit returns — no new ledger kind, no new replay machinery"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#useRotoPhysicalEditHistory aquarelle script commands (261022-pim Task 3) > recordAquarelleScriptEdit pushes exactly one entry and clears redo"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#useRotoPhysicalEditHistory aquarelle script commands (261022-pim Task 3) > calls the replay port with undo and moves the stacks only on true"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts -> 465 passed (386 + 79)"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit -> exit 0"
        status: pass
    human_judgment: true
    rationale: "Source and ledger pins prove the entry is recorded and replays; only a live anchor drag + Cmd+Z proves the whole gesture reverts in one step on screen."

# Metrics
duration: 5min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 20: Vector Path Edit Ledger Entry Summary

**Every committed vector path edit now records exactly one `aquarelle-script` ledger entry — on both the defer and the re-bake success routes of the one shared commit, never on failure, never from a delegating route — so one Undo reverts the whole gesture**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-10T22:09:00Z
- **Completed:** 2026-11-10T22:13:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added the re-bake route's ledger entry inside `commitAquarelleVectorPathEdit`'s `onSuccess`: `rotoMoveHistory.recordAquarelleScriptEdit(editId);` runs first, before `setLastError(null)` and `clearOwnedScriptApplyRefusal()` — the apply has resolved true, so the sheet holds this exact path (G-8, VEC-07).
- Added the defer route's ledger entry immediately before `setDraftPixelsDirty(true)`: the synchronous script commit IS the edit, and the deferred re-render changes only when pixels appear, never whether the gesture is undoable. These are the seam's only two record sites.
- Put the hook's stable `recordAquarelleScriptEdit` useCallback — not the `rotoMoveHistory` wrapper a hook returns fresh each render — into the commit's dependency array (efx-preact-reactivity §4).
- Left the failure route record-free: it restores the pre-edit snapshot and returns null, so Undo can never claim an edit the sheet rejected.
- Confirmed every delegating vector route is record-free: `applyAnchorWidths` (61-19), `handleAquarelleVectorPathEdit` (61-15) and the draw tail `bakeAquarelleVectorCommit` all route through the one commit (or, for draws, none), so the count stays one entry per gesture.
- Added a seven-pin describe block of region-scoped source pins that slice the one writer by its structural markers and assert exact record counts per region.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the one-entry ledger accounting for a vector path edit** - `33e1af620` (test)
2. **Task 1 GREEN: record one ledger entry on the path-edit re-bake success tail** - `2308a752d` (feat)
3. **Task 2 RED: pin the defer-route record, the failure route and the delegating routes** - `24cfe7da8` (test)
4. **Task 2 GREEN: record the defer-route ledger entry, closing the two-site seam** - `aa3e3dc2c` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - the two record sites and the stable recorder dependency (13 lines changed)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - one new seven-pin describe with the region-slicing helper (382 → 386 tests)

## Decisions Made

- Both records live inside the one writer, not at the call sites, so the delegation law is structural: a second entry would require editing the commit itself, which the "totals exactly two" pin forbids.
- The re-bake record precedes `setLastError(null)`, mirroring the shipped delete handler's record-then-clear ordering; the defer record precedes the dirty flag, mirroring the shipped Draft delete branch.
- The commit depends on `rotoMoveHistory.recordAquarelleScriptEdit` only; a negative assertion pins that the wrapper object never appears in the dependency array.
- The draw bake intentionally records nothing: a draw is a paint mutation, and an `aquarelle-script` entry for it would double-count the gesture in the undo stack.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's `'defer-pixels'` slice marker does not exist inside the commit**
- **Found during:** Task 2 RED
- **Issue:** the plan directs slicing the defer branch by a `'defer-pixels'` literal, but that string belongs to `bakeAquarelleVectorCommit`'s `resolveVectorCommitRoute(...) === 'defer-pixels'` call — `commitAquarelleVectorPathEdit` contains no such literal.
- **Fix:** sliced the defer branch by its real structural marker `if (draft || wireframe) {`, with a test comment explaining the route string's actual owner.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** defer-route pin fails at RED and passes at GREEN.
- **Committed in:** `24cfe7da8`

**2. [Rule 1 - Bug] The failure-route pin over-reached into the dependency array**
- **Found during:** Task 2 RED (the run showed 3 failures instead of the intended 2)
- **Issue:** `commit.slice(failureAt)` ran past the callback body into the dependency array, which legitimately names `rotoMoveHistory.recordAquarelleScriptEdit,`, so the negative assertion could never pass once GREEN was correct.
- **Fix:** scoped the pin to the callback body with `regionOf(commit, 'onFailure:', '  }, [')`.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** RED then showed exactly 2 failures (the defer pin plus the two-site total), GREEN 386/386.
- **Committed in:** `24cfe7da8`

**3. [Rule 1 - Bug] Task 1's first-record-index pin became false once Task 2 landed the defer site**
- **Found during:** Task 2 GREEN (first suite run: 1 failed / 464 passed)
- **Issue:** the ordering pin compared `commit.indexOf(record)` (now the defer site, textually before `onSuccess:`) against `successAt`; the recorded index moved ahead of the success slice.
- **Fix:** retargeted the assertion at the re-bake record inside the success slice (`success.indexOf(record)`, then `successAt + recordAt` against the rebake and restore offsets) and dropped a trivially-true absolute-index assertion.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** 386/386 and 465/465 across both suites.
- **Committed in:** `aa3e3dc2c`

---

**Total deviations:** 3 auto-fixed (1 slice-marker correction, 2 test-authoring bugs the RED/GREEN runs surfaced)
**Impact on plan:** None on scope. The intended behaviour shipped exactly as specified; only the pins' slicing and reference form were corrected, and no shipped pin was weakened.

## Issues Encountered

- Adding the re-bake record required disambiguating two identical `onSuccess: () => { setLastError(null); clearOwnedScriptApplyRefusal(); },` blocks (the draw bake and the path-edit commit); the edit was scoped by extending the match with the unique following `onFailure` restore lines, guaranteeing the draw bake got no record.
- `pnpm exec vitest run` prints pre-existing sourcemap warnings from `@efxlab/motion-canvas-core`; unrelated and not addressed (out of scope).

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (3 failing / 379 passing of 382 at RED: the re-bake record pin, the ordering pin and the stable-dependency pin). The target was `61-20 G-8: a vector path edit is exactly one undo entry > records exactly once on the re-bake success tail, between onSuccess and onFailure`. GREEN: 382/382.
- Task 2: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (2 failing / 384 passing of 386 at RED: the defer-route pin and the two-site total; the failure-route and delegating-route pins pass trivially at RED because both absences already hold — they are guards against future drift, not presence assertions). The target was `61-20 G-8: a vector path edit is exactly one undo entry > records exactly once on the defer route, before the dirty flag`. GREEN: 386/386, then 465/465 across both suites.
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-8 is fully implemented: 61-15 built the one writer and re-bake, 61-19 routed the width member through it, and 61-20 attached the ledger entry to both success routes. One gesture = one ledger entry = one Undo.
- Live UAT rows: (1) drag an anchor or a bezier handle, then press Cmd+Z once — the whole path edit must revert (Redo re-applies); (2) enter Edit path in Draft mode, change the path, press Cmd+Z — the script must revert even though the pixels were deferred; (3) force a failing re-bake — the undo stack must be unchanged and the pre-edit path restored.
- 61-20 is the last plan in phase 61; no blockers. Out of scope and unchanged: WR-01 through WR-05, IN-01 through IN-03.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- FOUND: 33e1af620
- FOUND: 2308a752d
- FOUND: 24cfe7da8
- FOUND: aa3e3dc2c
