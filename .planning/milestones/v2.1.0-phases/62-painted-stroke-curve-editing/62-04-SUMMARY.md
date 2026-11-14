---
phase: 62-painted-stroke-curve-editing
plan: 04
subsystem: physics-paint / vector path undo
tags: [preact-signals, tdd, vector-path, cancellation-epoch, undo-router, exit-bracket, d-13, d-14]

# Dependency graph
requires:
  - phase: 62-painted-stroke-curve-editing
    provides: 62-02's ONE exit funnel (`registerPathEditExitHook`) and the curve-bracket teardown; 62-03's overlay edit target over the held fit
provides:
  - "The rebake sequence's third terminal — `isCancelled` / `onCancelled`: a cancelled apply publishes nothing (D-13)"
  - "The token-keyed pending path-edit apply epoch (arm / cancel / observe / clear) in the session module (D-13)"
  - "The Studio's settled-bake promise seam and the undo router's pending-apply branch: exact-editId replay with one reanchor retry (D-13)"
  - "The deferred-settle await before the shipped history undo (D-14)"
  - "The ONE production `registerPathEditExitHook` registration — every shipped exit restores the pre-entry wireframe/Draft in-app (D-06)"
affects: [62-05]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 10305
  tasks: 3
  commits: 6
  plan_head_before: 22ba32b1fd179344a7d64463cf0581c7a5bebadf
  plan_head_after: 8851c38a789aee1ed9bcb17c259b4b2d8aeb6436

tech-stack:
  added: []
  patterns:
    - "Synchronous cancellation predicate re-read at the produce and commit turns — the isStillCurrent epoch precedent, no AbortController"
    - "Token-keyed compare-then-write epoch (arm / cancel / observe / clear) with idempotent cancel"
    - "Settled-promise ref so undo awaits the exact in-flight bake it cancelled"
    - "Three ordered undo branches: pending apply -> deferred settle -> shipped history"
    - "ONE dedicated [settleDraftScript] effect registers the exit hook beside the mount reset, cleanup detaches"

key-files:
  created:
    - .planning/phases/62-painted-stroke-curve-editing/62-04-t1-RED-evidence.json
    - .planning/phases/62-painted-stroke-curve-editing/62-04-t2-RED-evidence.json
  modified:
    - app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts
    - app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts
    - app/src/components/physic-paint/view/vectorPathSession.ts
    - app/src/components/physic-paint/view/vectorPathSession.test.ts
    - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Cancellation is a synchronous predicate read after the entry yield and again after the exit yield; the commit-turn read wins over a successful apply or a rejection"
  - "The latch is released in finally BEFORE any terminal, and a cancelled run resolves false writing nothing (no ledger, no error, no message)"
  - "The epoch is session-only: the Studio reads it with .peek() and writes only through the four token-keyed verbs; cancel is idempotent (a repeat notify is refused)"
  - "Undo never pops the stack on the pending branch — the cancelled edit has no ledger entry, so the exact editId is replayed (reanchor + one retry mirrors the shipped replay shape)"
  - "Deferred commits arm nothing: their edit is already on the stack, so after awaiting the settle the ordinary undo targets it (D-14)"
  - "The ONE production exit-hook registration lives in a dedicated [settleDraftScript] effect beside the mount reset (never inside it); cleanup detaches so a remount leaves no stale hook"
  - "endCurveBracket accepts () => void | Promise<unknown> so the shipped boolean-resolving settleDraftScript is admitted — type-only widening, no runtime change"

requirements-completed: [CRV-02, CRV-04]

coverage:
  - id: D1
    description: "A cancelled run performs no reset, no apply and no terminal other than onCancelled; the latch is released before it; a non-cancelled run is byte-identical to the shipped sequence"
    requirement: CRV-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts#62-04 the rebake sequence third terminal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Undo pressed mid-bake cancels THIS token, awaits that exact bake and replays its exact editId — never a stack pop"
    requirement: CRV-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#62-04 the undo router"
        status: pass
    human_judgment: false
  - id: D3
    description: "An in-flight deferred settle is awaited before the ordinary history undo (D-14)"
    requirement: CRV-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#62-04 the undo router"
        status: pass
    human_judgment: false
  - id: D4
    description: "Arm / cancel / observe / clear are token-keyed compare-then-write; a stale token never touches a newer apply and the record never outlives the bake"
    requirement: CRV-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#62-04 the pending path-edit apply epoch"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Studio installs exactly ONE production exit-hook registration from a dedicated [settleDraftScript] effect with a detaching cleanup"
    requirement: CRV-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#62-04 the pending path-edit apply epoch and the ONE exit-hook registration"
        status: pass
    human_judgment: false
  - id: D6
    description: "The immediate bake is bracketed by exactly one arm and one clear; the deferred route arms nothing"
    requirement: CRV-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#62-04 the pending path-edit apply epoch and the ONE exit-hook registration"
        status: pass
    human_judgment: false
  - id: D7
    description: "Native UAT rows A-D: cancelled undo restores the pre-edit shape with no new ledger entry and a second undo reaching the previous edit; deferred-settle undo consumes exactly one step; Cmd+Shift+Z does not resurrect; the veil is gone and the next drag commits normally"
    requirement: CRV-04
    verification: []
    human_judgment: true
    rationale: "Rows A-D are judged on the live canvas by the user; this plan ships and pins the routing contracts they observe."

# Metrics
duration: 9min
completed: 2026-11-14
status: complete
---

# Phase 62 Plan 04: Undo cancels the bake it interrupts, never the previous edit

**A Cmd+Z that lands mid path-edit bake now cancels that apply's publish, awaits it, and replays the stroke's exact pre-edit script by edit id — with the ONE production exit-hook registration making every curve-session exit restore the user's own view in-app.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-14T13:18:01Z (ledger base)
- **Completed:** 2026-11-14T13:27Z
- **Tasks:** 3
- **Files modified:** 9 (7 source/test + 2 RED evidence records)

## Accomplishments

- `runAquarelleScriptRebake` now has THREE mutually exclusive terminals. The cancellation predicate is read after the entry yield (a cancelled run never resets the sheet and never applies) and re-read after the exit yield (an undo that lands while the apply is pending wins the commit turn even when the apply itself succeeded or rejected). The latch is released in `finally` before any terminal, and a cancelled run resolves false writing nothing.
- The session module carries a token-keyed pending-apply epoch (`beginPathEditApply` / `cancelPathEditApply` / `isPathEditApplyCancelled` / `clearPathEditApply`) built on compare-then-write: a stale token can never cancel or clear a newer bake, a repeat cancel notifies nobody, and `resetForStudioOpen` drops the record with the shipped latches.
- The immediate bake is bracketed by exactly one arm before the rebake and one token-and-promise-matched clear in `finally`; the settled promise is published on `pathEditApplySettledRef` so undo awaits the exact work it cancelled. The deferred route arms nothing — its edit is already recorded.
- `undo` is now a three-branch router: (1) pending apply → cancel token, await the bake, replay the record's exact `editId` through `runScriptReplay`, with reanchor + one retry; (2) deferred settle in flight → await it and fall through; (3) the shipped `rotoMoveHistoryUndo` path, unchanged. `redo` is byte-identical to the shipped callback.
- The ONE production registration of 62-02's `registerPathEditExitHook` is installed in a dedicated `[settleDraftScript]` effect beside the mount reset (cleanup detaches), so every one of the nine shipped exit routes now runs `endCurveBracket` in-app and restores the pre-entry wireframe/Draft.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing tests for the cancelled-apply terminal** - `2cc911978` (test)
2. **Task 1 GREEN: give the rebake sequence a cancelled-apply terminal** - `ce53cad0a` (feat)
3. **Task 2 RED: pin the pending-apply epoch and the ONE exit-hook registration** - `cd244c54a` (test)
4. **Task 2 GREEN: arm the pending-apply epoch around the immediate bake** - `f8c313f3c` (feat)
5. **Task 3 RED: pin the undo router's pending-apply branch** - `83387f2ca` (test)
6. **Task 3 GREEN: route undo through the pending apply and the deferred settle** - `8851c38a7` (feat)

**Plan metadata:** final docs commit (recorded in the completion report; not part of the measured 6 task commits)

_Task 3 is `type="auto"` (no TDD gate required); following the phase convention its pins landed in a `test(...)` commit before the `feat(...)` commit._

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` - The third terminal: optional `isCancelled` / `onCancelled`, produce-turn and commit-turn predicate reads, latch released before any terminal.
- `app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts` - 5 cancellation cases plus the shipped-pin positive control.
- `app/src/components/physic-paint/view/vectorPathSession.ts` - `PendingPathEditApply`, `pendingPathEditApply`, the module token counter, the four token-keyed verbs, and the reset clear.
- `app/src/components/physic-paint/view/vectorPathSession.test.ts` - 5 epoch cases (arm/supersede, cancel/stale/idempotent, read, clear, reset).
- `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` - `settle` return type widened to `() => void | Promise<unknown>` (type-only).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `pathEditApplySettledRef`, the immediate-bake arm/clear, the `isCancelled`/`onCancelled` members, the ONE `[settleDraftScript]` registration effect, and the three-branch undo router.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 5 epoch/registration pins, 5 undo-router pins, and two documented shipped-pin retargets.
- `.planning/phases/62-painted-stroke-curve-editing/62-04-t1-RED-evidence.json` - Machine-verified RED evidence.
- `.planning/phases/62-painted-stroke-curve-editing/62-04-t2-RED-evidence.json` - Machine-verified RED evidence.

## Decisions Made

- **Cancellation is a predicate, not an abort:** the synchronous `isCancelled` read at the produce and commit turns is the `isStillCurrent` epoch precedent — no AbortController, no new promise factory, no cancellation exception (efx-async-orchestration §1).
- **The commit turn wins:** a predicate flipped while the apply is pending takes the cancellation terminal even when the apply resolved true or rejected, so a late undo can never leave a recorded edit behind.
- **Cancelled means silent:** the terminal clears the status to `idle` and publishes no message, no error and no ledger entry; the undo branch owns restoration.
- **Tokens are monotonic for the session lifetime:** a stale token is refused even after a clear, because the counter never resets.
- **Undo never pops on the pending branch:** the cancelled edit wrote no ledger entry, so `rotoMoveHistoryUndo()` would consume the previous edit — the exact `editId` replay restores the pre-edit script instead; the shipped reanchor + one-retry shape covers a refused replay.
- **Deferred commits need no epoch:** the deferred branch records its edit synchronously, so awaiting its settle makes the ordinary stack undo target exactly that edit (D-14).
- **One registration, one identity:** the exit hook is registered from a dedicated `[settleDraftScript]` effect with a `registerPathEditExitHook(null)` cleanup; the mount reset keeps its `[]` deps untouched.
- **A type-only widening over a wrapper:** `endCurveBracket`'s `settle` accepts `Promise<unknown>` so the shipped `settleDraftScript` passes through with no new promise and the plan's exact expression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `endCurveBracket`'s settle type widened (outside Task 2's `<files>`)**
- **Found during:** Task 2 GREEN, `tsc --noEmit`
- **Issue:** The planned registration passes the shipped `settleDraftScript` (`() => Promise<boolean>`), which is not assignable to the bracket's `() => void | Promise<void>` (TS2322: `Promise<boolean>` is not `Promise<void>`), verified in an isolated strict check.
- **Fix:** Widened the option to `() => void | Promise<unknown>` with a 62-04 provenance comment — type-only, the bracket still awaits the real settle before restoring.
- **Files modified:** app/src/components/physic-paint/view/vectorPathCurveBracket.ts
- **Commit:** `f8c313f3c`

**2. [Rule 1 - Bug] The new undo dependency pin asserted a token that cannot appear**
- **Found during:** Task 3 GREEN
- **Issue:** The pin asserted `runScriptReplay,` inside the undo block, but the dependency list closes as `..., runScriptReplay]);` — no standalone comma form exists.
- **Fix:** Retargeted to the exact dependency-list line (a strictly stronger pin).
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Commit:** `8851c38a7`

### Plan-directed retargets

**1. The 62-02 import-line pin now carries `endCurveBracket`**
- **Found during:** Task 2 GREEN (the RED run's only shipped-pin casualty surfaced after implementation)
- **Issue:** The 62-02 pin asserted the exact two-member import from `./view/vectorPathCurveBracket`; the ONE registration needs the third member.
- **Fix:** Retargeted to the documented three-member line with a comment naming the addition; no other import changed.
- **Commit:** `f8c313f3c`

**2. The 61-20 undo dependency pin gained `runScriptReplay`**
- **Found during:** Task 3 GREEN
- **Issue:** The shipped pin asserted the exact four-item dependency list; the plan explicitly adds `runScriptReplay`.
- **Fix:** Retargeted to the five-item list with a comment naming the addition; every other assertion (the `isPlaying` guard, the redo list) unchanged.
- **Commit:** `8851c38a7`

## Known Stubs

None. This plan closes the deferral 62-02 documented: the production `registerPathEditExitHook` registration is now installed, so every shipped exit route reaches the curve bracket in-app.

## TDD Gate Compliance

| Gate | Task | Evidence | Verdict |
|------|------|----------|---------|
| RED | Task 1 | `2cc911978`, `62-04-t1-RED-evidence.json` | `RED_EVIDENCE_OK` (12 tests: 8 pass, 4 fail behaviourally; the fifth new case is the positive control) |
| GREEN | Task 1 | `ce53cad0a` | 12/12 aquarelleVectorPathCommit cases pass |
| RED | Task 2 | `cd244c54a`, `62-04-t2-RED-evidence.json` | `RED_EVIDENCE_OK` (449 tests: 439 pass, exactly the 10 new cases fail behaviourally) |
| GREEN | Task 2 | `f8c313f3c` | 449/449 session+Studio cases pass; tsc clean |
| RED | Task 3 (auto, tests first) | `83387f2ca` | 4 new pins fail on HEAD; 424 pass; the fifth pin is the redo positive control |
| GREEN | Task 3 | `8851c38a7` | 466/466 across the three plan suites; tsc clean |

No plan-level `type: tdd` frontmatter; the Task 1 gate evidence was machine-verified via `gsd_run check tdd-red-evidence`.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts` — **466/466 pass**.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathCurveBracket.test.ts` — **19/19 pass** (touched module).
- `pnpm --filter efx-motion-editor exec tsc --noEmit` — **clean**.
- Native UAT rows A-D remain for the user (human judgment): cancelled undo restores the pre-edit shape with no new ledger entry and a second undo reaching the previous edit; deferred-settle undo consumes exactly one step; Cmd+Shift+Z does not resurrect; the veil is gone and the next drag commits normally.

## Self-Check: PASSED

- All three task commit pairs are ancestors of HEAD (`2cc911978`, `ce53cad0a`, `cd244c54a`, `f8c313f3c`, `83387f2ca`, `8851c38a7`).
- `62-04-SUMMARY.md` and both RED evidence records exist on disk.
- Measured plan commits: 6 (`git rev-list --count 22ba32b1f..8851c38a7`).
