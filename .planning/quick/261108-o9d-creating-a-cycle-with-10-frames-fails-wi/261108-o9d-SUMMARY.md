---
phase: 261108-o9d-creating-a-cycle-with-10-frames-fails-wi
plan: 01
subsystem: physics-paint-roto
tags: [preact-signals, physical-edit-coordinator, play-script-controller, key-rail-cycle, serialize-wait, diagnostics]

# Dependency graph
requires:
  - phase: 261108-nq0
    provides: the cycle-rail dispatch seam and its settlement pinning used to localize this refusal
provides:
  - a bounded, never-rejecting waitForPhysicalEditSlot on the physical-edit coordinator
  - a Key Rail cycle confirm that serializes behind a still-settling previous edit instead of being dropped
  - named diagnostics for the slot-expiry and launch-mismatch pre-dispatch refusals
affects: [59-rail-motion-channels, key-rail-cycle, play-script-settlement]

# Actuals (#2632)
actuals:
  tokens: 6759
  tasks: 2
  commits: 2
  uat_approved: 2026-11-08
plan_head_before: e48b273312919859887688d069e73bb269d9c242
plan_head_after: bf4d80e28c09c06a1f60da783b5ad56cdf5136b8

tech-stack:
  added: []
  patterns:
    - "One slot predicate shared by the serialize guard and a bounded slot wait"
    - "Signal-change wait with a 25 ms cadence only for acknowledge-without-signal settlement"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "The parent-vs-child capacity hypothesis is refuted; the refusal is timing at the single dispatch slot, so the fitting create waits instead of being dropped."
  - "The wait is driven by signal change, with one 25 ms cadence only because acknowledging an accepted settlement releases the settled lease without writing a signal."
  - "The wait is bounded at 6000 ms and returns a boolean (never rejects); the controller checks its generation after the wait and fails honestly on expiry."
  - "No validator, clamp formula, reconcile rule, lease acquire, schema, document shape, bridge protocol, store projection, motion channel or CSS was touched."

patterns-established:
  - "Shared slot predicate: isPhysicalEditSlotBusy() returns a cause string or null and backs both the serialize refusal and waitForPhysicalEditSlot."
  - "Pre-dispatch false refusals are named in status.logDiagnostic instead of surfacing as the bare not-dispatched copy."

requirements-completed: [QUICK-261108-O9D]

coverage:
  - id: D1
    description: "A Key Rail cycle confirm issued while the previous physical edit is still settling waits for the slot, then dispatches and applies with Cycle = 10."
    requirement: QUICK-261108-O9D
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#waits for the previous physical edit to settle, then creates Cycle 10 (slot gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repeat 10 and the repeat 9 control both apply on a clear slot, and repeat 100 over capacity 30 still commits clamped."
    requirement: QUICK-261108-O9D
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#creates Cycle 10 from one key at frame 0 with exactly one physical commit (user row)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#creates Cycle 9 from the same Key Rail (control row)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#commits Cycle 100 shortened to capacity 30 instead of refusing (clamp law)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The live Studio gesture (one key at frame 0, Create Cycle = 10 right after a prior edit) applies on the first confirm with no 'was not dispatched' copy."
    requirement: QUICK-261108-O9D
    verification: []
    human_judgment: true
    rationale: "Tauri/WKWebView live behavior and the visible dialog/status copy need the user's native UAT; the plan lists five live rows."
  - id: D4
    description: "Launch-mismatch and slot-expiry refusals log named diagnostics instead of refusing silently."
    requirement: QUICK-261108-O9D
    verification:
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec vitest run (full suite, 8233 passed)"
        status: pass
    human_judgment: true
    rationale: "The diagnostic lines have no dedicated assertion row; they are inspected in the live UAT log channel."

duration: 12min
completed: 2026-11-08
status: complete
---

# Quick 261108-o9d: Key Rail Cycle 10 create behind the physical-edit slot Summary

**A fitting Key Rail cycle confirm now waits for the single physical-edit slot instead of being dropped, so one key at frame 0 with Cycle = 10 applies on the first confirm while the shorten law still clamps oversized repeats.**

## Performance

- **Duration:** 12 min (plan file creation to latest gate run)
- **Started:** 2026-11-08T17:51 local
- **Completed:** 2026-11-08T18:04 local
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Reproduced the reported copy at the real controller->coordinator seam and named the gate: the serialize guard (`setConciseMessage 'A Roto physical edit is already in flight.'`, no diagnostic) refused the confirm pre-dispatch, which the Play Script settlement formatted as the bare `Group update was not dispatched.`
- Extracted one `isPhysicalEditSlotBusy()` predicate (staging, pending settlement, settled lease, recovery lease) shared by the serialize guard and the new bounded `waitForPhysicalEditSlot`.
- The coordinator wait is signal-driven, resolves true when the slot clears, resolves false at 6000 ms after a named diagnostic, never rejects, and unsubscribes/clears timers on every exit.
- `confirmKeyRailCycle` awaits the optional port after phase `preparing` and before `requestAuthority`, checks its generation, and commits against the settled document; the clamp, validators, reconcile rule and lease acquire are untouched.
- The launch-mismatch refusal now logs the expected/current launch operation ids; the port is forwarded hook-side only when supplied and wired in Studio.
- Gate evidence: the plan's Task 1 reproduction used the pending `execute()` helper, whose shared fixture republished loop clips on acceptance and made the retry an ownership refusal. The gate row now opens the slot with `executePasteKey(14)` (an ordinary pending edit that leaves the bare Key Rail state) — a documented test-only deviation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reproduce the Cycle = 10 refusal at the real seam** - `35aac8b19` (test)
2. **Task 2: Serialize a fitting cycle create behind an open slot** - `bf4d80e28` (fix)

**Plan head before:** `e48b27331` · **Plan head after:** `bf4d80e28` · **Commits (measured):** 2

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` - real controller->real coordinator helper plus the user/control/clamp rows and the wait-then-dispatch slot-gate row
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` - shared slot predicate, bounded `waitForPhysicalEditSlot`, handle exposure, launch-mismatch diagnostic
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - optional `waitForPhysicalEditSlot` port and the pre-authority wait in `confirmKeyRailCycle`
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` - optional port forwarding in the controller closure
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - one-line wiring of `physicalEditCoordinator.waitForPhysicalEditSlot`

## Decisions Made

- Serializing the confirm (not merely improving the copy) is the fix the async contract requires: a submit past the turn limit waits on a slot and must not drop silently (`efx-async-orchestration` section 4).
- The wait is bounded at 6000 ms (0.5 s past the 5.5 s Play Script settlement budget) and returns a boolean so failures stay data (section 5), with `assertCurrent` as the cancellation contract.
- The gate row keeps a single publication per confirm and asserts one commit result; no clamp, validator, reconcile, lease-acquire or document-shape change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gate-row pending edit switched from `execute()` to `executePasteKey(14)`**
- **Found during:** Task 1 (real-seam reproduction)
- **Issue:** The plan named the existing `execute()` (force-spacing) helper to open the slot, but that fixture's proposal republishes its loop clips on acceptance; key A then became loop-owned and the retry was refused as an ownership violation instead of dispatching.
- **Fix:** Opened the slot with `executePasteKey(14)`, an ordinary pending physical edit built from the harness's current empty `loopClips`, preserving the bare Key Rail condition the report describes.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` (test-only)
- **Verification:** Targeted suite green; the row asserts the serialize gate pre-fix and the wait-then-dispatch behavior post-fix.
- **Committed in:** `35aac8b19` and `bf4d80e28`

**2. [Rule 1 - Bug] Null-safe refusal reason in the test helper**
- **Found during:** Task 1 typecheck
- **Issue:** `openKeyRailCycleEdit` returns `reason: string | null`; `new Error(opened.reason)` failed typecheck.
- **Fix:** `throw new Error(opened.reason ?? 'Key Rail cycle edit was refused without a reason.')`.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` (test-only)
- **Verification:** `pnpm --filter efx-motion-editor run typecheck` clean.
- **Committed in:** `35aac8b19`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), both test-only. No production scope change beyond the plan.
**Impact on plan:** None on behavior; the reproduction still lands on the exact serialize gate and the fix path is unchanged.

## Task 2 Step 6 branch

Task 1 reproduced the **serialize gate** (`setConciseMessage: 'A Roto physical edit is already in flight.'`, `logDiagnostic: (none)`), so Step 6 selected: **serialize gate → Steps 2-5 are the complete fix**. No stale-metadata, target-document-parse or launch-divergence branch was needed.

## Issues Encountered

- Both Task 1 gate-row failures were test-harness contract mismatches (not-dispatched formatting order; fixture loop ownership). Both were diagnosed from the controller log and fixed without changing production code or weakening any existing row.

## User Setup Required

None - no external service configuration required.

## UAT

Approved 2026-11-08 by the user after the live Studio pass: the reported gesture (Create Cycle = 10 on a Key Rail) applies without the "Group update was not dispatched." copy.

Rows covered by the approval:

1. Right after a prior edit settles, Create Cycle with Cycle = 10. Expected: applies on the first confirm (span 0..10), no red status.
2. Cycle = 9. Expected: applies identically (control).
3. Re-open the created rail and raise Cycle to 10. Expected: applies, unchanged.
4. Cycle = 100 on a short timeline. Expected: the clip is shortened to the available capacity and applies — never refused, never grown.
5. Confirm twice in rapid succession. Expected: exactly one cycle is created; the second confirm is refused by the existing phase guard.

## Next Phase Readiness

- Automated gates all green: targeted coordinator suite (106), controller suite (284), typecheck, full suite (403 files, 8233 passed, 0 failed), scope tripwire lists only the five plan paths.
- UAT approved; the quick task is closed.
- No blockers, no schema or persisted-document change, no dependency change.

## Self-Check: PASSED

- Verified created/modified files exist (5 paths) and commits `35aac8b19` and `bf4d80e28` are ancestors of HEAD.
