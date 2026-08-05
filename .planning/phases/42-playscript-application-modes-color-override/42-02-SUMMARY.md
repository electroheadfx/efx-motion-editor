---
phase: 42-playscript-application-modes-color-override
plan: 02
subsystem: physic-paint-roto
tags: [play-script, static-hold, color-override, hold-loop, controller, renderer, tdd, vitest]

requires:
  - phase: 42-playscript-application-modes-color-override
    plan: 01
    provides: buildStaticStrokeSchedule/getStaticFrameStrokes schedule pair consumed at the renderer mode seam
provides:
  - "RotoPlayScriptRenderInput.mode/overrideColor — one renderer entry point shared by both modes; override applied post-Motion, paint-only (PLAY-01, PLAY-02)"
  - "Controller option signals (mode/overrideColor/overrideEnabled/dialogMotion/repeatText/infinity/lastFiniteRepeat/layerEndExclusive), parsedRepeat/repeatError/loopReadout computeds, setInfinity/resetDialogMotion methods, appliedSummary line1/line2 — the exact surface 42-03 (dialog) and 42-04 (panel) consume"
affects: [42-03 dialog UI, 42-04 panel summary UI]

actuals:
  tokens: 10000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Mode seam as a ternary over sibling schedule pairs; everything else in the render pipeline mode-agnostic"
    - "Color override inside the per-frame transform callback AFTER transformRecordedStrokeForHeldPose (seed hashes original color), tool !== 'erase' gate"
    - "Safe-product bound derived BEFORE multiplication: maxRepeat = Math.floor(Number.MAX_SAFE_INTEGER / cycleLength) against the current cycle value"
    - "Single appliedSummary assignment site after successful commit, composed from the committed options snapshot only"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "42-02: Infinity readout composed as 'Cycle {C}f × ∞ · Effective: {E}f' — only the literal 'Cycle {N}f × ∞' was locked copy; the effective clause keeps the boundary visible per the plan's 'effective still derived' language"
  - "42-02: setInfinity preserves the last VALID finite repeat — an invalid draft never overwrites lastFiniteRepeat (merges D-12 'last valid' wording with the preserve/restore mechanism)"
  - "42-02: first-time Static / Hold defaults (D-15) applied via a disposed @preact/signals effect so any write path to mode triggers them exactly once per session"
  - "42-02: tracer gate executed autonomously (plan is autonomous with an automated-only verify): tracer verify re-run end-to-end after the GREEN commit, then expansion proceeded"

requirements-completed: [PLAY-02]

coverage:
  - id: D1
    description: "Static mode routes through the static schedule pair; progressive default byte-identical; override recolors paint-only in both modes with erase pass-through, post-Motion application, point-identical geometry, deep-equal/freeze-safe source, zero library writes"
    requirement: PLAY-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts (15 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts (34 tests)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-05
status: complete
---

# Phase 42 Plan 02: PlayScript Modes + Color Override Controller/Renderer Summary

**Two-mode Play Script generation wired end-to-end test-first: the renderer selects the static/hold schedule by mode and applies the color override post-Motion to paint strokes only, while the controller gains the full session-only option surface — dialog Motion, safe-product Repeat bound, Infinity preserve/restore, loop readout, generation-error lifecycle, and the atomically-composed applied summary that 42-03/42-04 render.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-05T18:55:45Z
- **Completed:** 2026-08-05T19:18:07Z
- **Tasks:** 3
- **Files modified:** 4 (0 created)

## Accomplishments

- Tracer: static/hold generation with color override proven end-to-end through the real controller and renderer — paint-only recolor in both modes, erase pass-through in both modes, original color into the Motion transform with point-identical geometry under nonzero Motion, deep-equal and deep-frozen source immutability, zero script-library write-port invocations
- Hold Loop state: `parseRepeat` with the safe-product bound (`Math.floor(Number.MAX_SAFE_INTEGER / cycleLength)` derived before multiplication), exact error copy (`Enter a positive integer.` / `Repeat is too large for this cycle length.`), `loopReadout` with locked D-13 finite forms plus the literal infinity form, `setInfinity` preserve/restore of the last valid finite repeat, first-time Static / Hold defaults (D-15), generation pinned to the cycle value (D-02)
- Controller boundaries: `resetDialogMotion` (read-only re-read of the CURRENT Motion defaults port), generation-error lifecycle (`fail()` nulls progress; error cleared at start, populated on failure, null on cancellation), and `appliedSummary` line1/line2 composed atomically at a single post-commit site with byte-stability across edits/cancel/cancellation/failure
- Wave gates: targeted suites 49/49, full app suite 1130 passed, package animation suites 17/17, `pnpm --dir app typecheck` clean, `progressiveStrokeSchedule.ts` diff empty (regression lock intact)

## Task Commits

Each task was committed atomically (TDD RED then GREEN per task):

1. **Task 1 (RED): failing tests for static/hold mode and color override** — `617df9f9` (test)
2. **Task 1 (GREEN): wire static/hold mode and color override through controller and renderer** — `52baff9d` (feat)
3. **Task 2 (RED): failing tests for hold loop option state** — `01eac22b` (test)
4. **Task 2 (GREEN): hold loop option state with safe-product repeat bound and duration readout** — `e12cfd3a` (feat)
5. **Task 3 (RED): failing tests for reset/error-lifecycle/applied-summary boundaries** — `2b015907` (test)
6. **Task 3 (GREEN): reset/generation-error/applied-summary controller boundaries** — `68cee271` (feat)
7. **Wave-gate fix: type the loadSnapshot spy via vi.mocked for tsc** — `f73f3bca` (test)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — `RotoPlayScriptRenderInput.mode`/`overrideColor`, static/progressive schedule selection ternary, post-Motion paint-only color substitution in the shared transform callback
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — option signals, `parseRepeat`/`repeatError`/`loopReadout`/`parsedRepeat`, `setInfinity`, `resetDialogMotion`, `appliedSummary` with single post-commit assignment site, `fail()` progress-nulling, `layerEndExclusive` retention (Pitfall 5)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` — 12 new cases (mode routing, recolor/erase pass-through per mode, geometry parity, deep-equal, deep-frozen); async rAF stub
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — 28 new cases across Tasks 1-3; library write-port spies, mutable getMotion port

## Decisions Made

- **Infinity readout composition:** rendered as `Cycle {C}f × ∞ · Effective: {E}f`. Only the literal `Cycle {N}f × ∞` is locked copy (D-12/UI-SPEC); the plan required effective to remain derived from the retained boundary, so it is shown after the literal. 42-03 renders this verbatim.
- **Last-valid preserve semantics:** `setInfinity(true)` overwrites `lastFiniteRepeat` only when the current draft parses as valid — an invalid draft never poisons the restored value (D-12's "last valid finite Repeat" wording).
- **D-15 trigger mechanism:** a `@preact/signals` effect (disposed in `dispose()`) applies the first-time Static / Hold defaults on any write path to `mode`, exactly once per session.
- **Tracer gate:** executed autonomously — the plan is `autonomous: true` with an automated-only verify and contains no checkpoint tasks; the tracer verify was re-run end-to-end after its GREEN commit (49/49 at the time) before expansion tasks began.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Async rAF stub in the renderer test harness**
- **Found during:** Task 1 RED
- **Issue:** The pre-existing synchronous `requestAnimationFrame` stub invoked its callback before `yieldToBrowser`'s `abort` const initializes (TDZ `ReferenceError`), which no prior renderer test ever surfaced because every pre-existing case rejected before the success path
- **Fix:** Stub now defers via `queueMicrotask`
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts`
- **Commit:** `617df9f9`

**2. [Rule 1 - Test bug] Cancellation cases must cancel mid-render, not mid-prepare**
- **Found during:** Task 3 GREEN
- **Issue:** `waitFor(canCancel)` fires during the `preparing` phase, so the held-render mock's abort listener was never consumed; the unconsumed `mockImplementationOnce` then swallowed the next test step's `mockRejectedValueOnce` and hung the suite (proven with an instrumented trace)
- **Fix:** Both cancellation cases now `mockClear()` and wait for `rendered` to have been called before `cancel()`
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
- **Commit:** `68cee271`

**3. [Rule 3 - Blocking] tsc rejected `.mockResolvedValue` on the typed library port**
- **Found during:** wave-gate typecheck
- **Issue:** `library` is cast to `RotoScriptLibraryController`, hiding vitest mock methods
- **Fix:** `vi.mocked(test.library.loadSnapshot).mockResolvedValue(fixture)`
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
- **Commit:** `f73f3bca`

## Authentication Gates

None.

## Known Stubs

None — every controller/renderer surface added here is exercised by tests and consumed by 42-03/42-04; no placeholder data flows to UI.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes beyond the plan's threat model (T-42-02-01 mitigated by `parseRepeat` + table-driven rejection tests; T-42-02-02 override value contract kept `#rrggbb | null`, never interpolated into HTML/CSS).

## Issues Encountered

None beyond the documented deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 42-03 consumes by exact name: `mode`, `overrideColor`, `overrideEnabled`, `dialogMotion`, `repeatText`, `infinity`, `layerEndExclusive`, `parsedRepeat`, `repeatError`, `loopReadout`, `setInfinity`, `resetDialogMotion`, `error`, `appliedSummary` — no dialog access to construction ports needed
- 42-04 renders `appliedSummary.line1/line2` verbatim (read-only, signal-driven per the locked summary update contract)
- PLAY-02 marked complete; PLAY-03/PLAY-04 remain pending until the dialog (42-03) and panel (42-04) render these surfaces — the controller/renderer contracts they need are now test-locked

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts (mode union + buildStaticStrokeSchedule reference)
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts (parseRepeat safe-product bound, both exact error strings, setInfinity/repeatError/loopReadout/appliedSummary/resetDialogMotion on the returned object)
- FOUND: commit 617df9f9 (Task 1 RED), 52baff9d (Task 1 GREEN), 01eac22b (Task 2 RED), e12cfd3a (Task 2 GREEN), 2b015907 (Task 3 RED), 68cee271 (Task 3 GREEN), f73f3bca (typecheck fix)
- Quick gate exits 0 (49/49); full app suite 1130 passed; package animation suites 17/17; typecheck clean; `git diff --exit-code packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` empty

---
*Phase: 42-playscript-application-modes-color-override*
*Completed: 2026-08-05*
