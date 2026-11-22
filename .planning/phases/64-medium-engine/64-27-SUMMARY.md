---
phase: 64-medium-engine
plan: 27
subsystem: [physic-paint, relight-scheduler, preact-reactivity]
tags: [single-flight, parked-request, idle-edge, setBlocked, signals-effect, wr-04, med-17, tdd]

requires:
  - phase: 64-medium-engine (64-19)
    provides: the bounded relight scheduler, the light-term cache miss and the gesture/sync request sites this plan extends
  - phase: 64-medium-engine (64-18)
    provides: the ONE light writer and the gesture ledger entry that precedes the relight request
provides:
  - SingleFlightRelight.setBlocked with ONE parked request and an idle-edge drain, no timer and no polling
  - the parked request drains through the shipped single-run-in-flight path — queued behind a live run, started only when idle
  - settle() and resolveIdleWaiters treat a parked request as non-idle
  - the Studio's one narrow gate effect over isPlaying, draftMode.value and wireframeMode.value
  - RED evidence records for both tasks under .gsd/tdd-evidence/64-27/
affects: [phase-64 verification (64-19 truth 2 / WR-04), any future relight or Apply-lane work]

actuals:
  tokens: 3823
  tasks: 2
  commits: 4
plan_head_before: e13d5b2011d26629a19b83582d9d1968f5965f07
plan_head_after: 2c41a9271ab1ab2271acebe2b2a429c452df5fc9

tech-stack:
  added: []
  patterns:
    - "A refusal is the caller's knowledge, not a busy result: the scheduler is TOLD about the blocking state, parks ONE request while it holds, and drains it through the same single-run-in-flight path a request takes on the blocked-to-idle edge — no timer, no polling, no retry budget spent"
    - "The blocking state reaches the scheduler through ONE narrow preact effect created inside a [isPlaying]-dependent lifecycle effect: subscribed signals are read through .value inside the effect body, never in the render body and never through .peek()"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/engine/committedFrameRelight.ts
    - app/src/components/physic-paint/engine/committedFrameRelight.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The scheduler parks a request instead of letting a refusal be discovered as a busy false: start() checks `blocked` first and sets ONE pending flag without setting inFlight, so a refusal spends neither a run nor the follow-up budget — a refusal is structurally distinguishable from 'ran, no change'"
  - "The unblock edge never calls start() while inFlight: the parked request becomes the shipped queued follow-up and starts on that run's completion, so no reachable state has two runs in flight or lets settle() resolve between them"
  - "Both idle paths test the parked flag — resolveIdleWaiters and settle()'s own early return — so a parked request can never let settle() resolve early"
  - "The Studio gate is a preact effect created inside a [isPlaying]-dependent useEffect with an optional ref call: the first pass before the controller exists is a harmless no-op, and the disposer releases the subscription on unmount"

requirements-completed: [MED-17]

coverage:
  - id: D1
    description: "A relight requested while the Studio is playing, in Draft or in wireframe is parked as ONE pending request and starts exactly once on the blocked-to-idle edge, through the shipped queue-when-in-flight path (maxActive 1), with settle() waiting through the park and no automatic follow-up spent on the refusal."
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/committedFrameRelight.test.ts#64-27 parked committed-frame relight (WR-04) > a blocked request starts nothing: any number of requests park ONE run that the idle edge starts exactly once"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/committedFrameRelight.test.ts#64-27 parked committed-frame relight (WR-04) > a false result while blocked parks instead of spending the automatic follow-up"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/committedFrameRelight.test.ts#64-27 parked committed-frame relight (WR-04) > an unblock while a run is still in flight queues the parked request — never a second run beside it"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/committedFrameRelight.test.ts#64-27 parked committed-frame relight (WR-04) > settle() waits through a parked request and resolves after the unblocked run"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/committedFrameRelight.test.ts#64-19 committed-frame relight (CR-01, MED-17) (all five shipped bounds unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Studio drives the gate from ONE narrow effect over isPlaying, draftMode.value and wireframeMode.value: one setBlocked call site, no timer, no .peek() on the subscribed signals, [isPlaying] as the only render-state dependency, and the controller creation and both request sites untouched."
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#64-19 committed-frame relight wiring (CR-01) > the WR-04 gate is ONE narrow subscription effect over the three refusal states"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#64-19 committed-frame relight wiring (CR-01) (all five shipped 64-19 pins unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The end-to-end artist-visible behaviour: commit a light mid-playback (or in Draft/wireframe), stop the state, and the committed frame re-lights exactly once with no unrelated trigger."
    requirement: MED-17
    verification: []
    human_judgment: true
    rationale: "The scheduler and the gate are fully pinned, but the visible re-light of a committed frame across a real playback session is a live Studio surface (the Studio runs in a separate WebView and is not exercised by vitest); UAT must observe the sheet change once on the idle edge."

duration: 3 min
completed: 2026-11-22
status: complete
---

# Phase 64 Plan 27: Parked Committed-Frame Relight Summary

**A relight refused during playback, Draft or wireframe is parked as one pending request and drained exactly once on the idle edge — the scheduler is told about the refusal instead of discovering it as a busy false, and the Studio wires that gate through one narrow signals effect.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-22T16:15:01Z
- **Completed:** 2026-11-22T16:17:52Z
- **Tasks:** 2 (both TDD: 2 RED + 2 GREEN commits)
- **Files modified:** 4

## Accomplishments

- `SingleFlightRelight` gained `setBlocked(blocked)`: while blocked nothing starts, any number of requests collapse into ONE parked request, and the blocked-to-idle edge drains it exactly once through the shipped single-run-in-flight path — no timer, no polling, no follow-up budget spent on a refusal (WR-04).
- `resolveIdleWaiters` and `settle()`'s early return both treat a parked request as non-idle, so settling waits through the park and only resolves after the unblocked run.
- The Studio creates ONE narrow gate effect (a preact `effect` over `isPlaying || draftMode.value || wireframeMode.value` inside a `[isPlaying]`-dependent `useEffect`) that calls the ref-held controller's `setBlocked`; it writes no signal, creates no timer, never uses `.peek()` for the subscribed values, and leaves the controller's single lazy creation, its three runner guards and both request sites untouched.
- Every shipped bound (one in flight, one queued follow-up, one busy-false follow-up, swallowed rejection, settle-through) and every 64-19 wiring pin stays green unamended; the file grows from 441 to 446 tests, all passing.

## Task Commits

Each task was committed atomically (TDD pairs):

1. **Task 1: The parked request in the scheduler** — `ec53ec4a2` (test: RED for the parked request and idle-edge drain), `3ec50e5be` (feat: park a refused relight and drain it on the idle edge)
2. **Task 2: The idle edge in the Studio and its pins** — `3caad3e8f` (test: RED for the WR-04 gate effect), `2c41a9271` (feat: drive the relight gate from the Studio's blocking states)

**Plan metadata:** (docs commit recorded below)

_Note: TDD tasks produced RED → GREEN pairs; no REFACTOR commit was needed._

## Files Created/Modified

- `app/src/components/physic-paint/engine/committedFrameRelight.ts` — `setBlocked` on the interface, `blocked`/`pending` state, the park branch in `start`, the block-first request, the idle-edge drain and the non-idle treatment in both settle paths.
- `app/src/components/physic-paint/engine/committedFrameRelight.test.ts` — four new WR-04 tests (park/coalesce, false-while-blocked, unblock-while-in-flight with `maxActive` 1, settle-through-park); the five shipped tests unchanged.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the WR-04 gate effect after the controller creation and before `handleDocumentLightChange`.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — the gate pin added to the 64-19 wiring block, whose header now names WR-04 and the parked-request law.

## Decisions Made

- A refusal is represented, not inferred: the scheduler parks on the caller's `setBlocked` knowledge rather than spending the busy-false follow-up against a state that would refuse again.
- The drain reuses the shipped queue-when-in-flight branch: an unblock during a live run queues the parked request instead of starting beside it, so `maxActive` never exceeds 1 and `settle()` cannot resolve between two runs.
- The gate effect is a preact `effect` created inside a `[isPlaying]`-dependent `useEffect`, reading the signals through their subscribing `.value`; `.peek()` is deliberately NOT used for the subscribed values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED evidence required the TAP report without the runner's sourcemap preamble**
- **Found during:** Task 2 (RED)
- **Issue:** The `pnpm --silent ... vitest run --reporter=tap-flat` run for `PhysicsPaintStudio.test.ts` printed a long block of "Sourcemap … points to missing source files" lines to stdout before the TAP document, so `gsd_run check tdd-red-evidence` classified the record `INVALID_RED` / `invalid_record` ("Unsupported report format") even though the target test failed on its planned assertion.
- **Fix:** Preserved the full console output verbatim in `.gsd/tdd-evidence/64-27/task2-red.console.txt` and recorded in `task2-red.json` the reporter's own TAP document from `TAP version 13` onward (the report itself unmodified), per `tdd.md`'s rule to preserve other console output separately rather than edit the report.
- **Files modified:** `.gsd/tdd-evidence/64-27/task2-red.json` (evidence only, gitignored)
- **Verification:** `gsd_run check tdd-red-evidence .gsd/tdd-evidence/64-27/task2-red.json` returned `RED_EVIDENCE_OK` with `reason: target_test_failed`.
- **Committed in:** not committed (RED evidence is a gitignored artifact by design)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Evidence capture only; no production or test behaviour changed. The plan's tested laws are unchanged.

## Issues Encountered

- The first Task 2 RED record was rejected as `INVALID_RED` because the runner's stdout preamble preceded the TAP document. Splitting the console output from the report (see the deviation above) resolved it; both tasks' final RED records are `RED_EVIDENCE_OK`.

## Threat Flags

None — the changes stay inside the plan's threat register (T-64-92 mitigation: parked request + idle-edge drain; T-64-93: one pending flag, no timer; T-64-94: the last-seen signature still advances only after a true bake). No new network, auth, file-access or schema surface.

## Known Stubs

None — no placeholder, hardcoded empty value or unwired data source was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-04's mechanism is closed: a light committed during playback, Draft or wireframe now parks and re-bakes once on the idle edge.
- What remains is UAT judgment (coverage D3): observe one re-light on a real playback session; vitest cannot exercise the Studio WebView surface.
- CR-01's keying, CR-02's one-ledger-entry-per-gesture law, the light writer and the gesture ref are untouched; their pins stayed green throughout.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-22*

## Self-Check: PASSED

- All 4 modified files exist on disk.
- All 4 task commits (`ec53ec4a2`, `3ec50e5be`, `3caad3e8f`, `2c41a9271`) are ancestors of HEAD.
- `actuals.commits` = 4, measured with `git rev-list --count e13d5b201..HEAD` at SUMMARY time; `plan_head_before` / `plan_head_after` recorded from the commit ledger.
- Plan verification re-run at SUMMARY time: `committedFrameRelight.test.ts` (10 tests) and `PhysicsPaintStudio.test.ts` (446 tests) pass — 456 total; `pnpm --filter efx-motion-editor typecheck` exits 0.
- Both TDD RED records return `RED_EVIDENCE_OK` (`task1-red.json`, `task2-red.json`).
