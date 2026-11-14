---
phase: 261109-pwt-phase-60-issue-with-paint-on-cached-key-
plan: 01
subsystem: physic-paint
tags: [preact, signals, roto, paint-cache, navigation, persistence]

# Dependency graph
requires:
  - phase: 52.1
    provides: per-identity live-pixel capture transactions and the parent-delivery chain
  - phase: 59
    provides: rail motion evaluation untouched by this quick
provides:
  - read-only per-frame pending-live-pixel probe (identity-scoped, includes parent-delivery keys)
  - navigation-time destination arm sampled before the synchronous cached-base load
  - displayed-frame settle effect that flushes only the armed identity and reloads only on a byte-carrier change
affects: [Phase 61, Phase 62]

actuals:
  tokens: 4300
  tasks: 2
  commits: 2
  plan_head_before: 7e742a03c468872c0558f335419ee6b78e9d67af
  plan_head_after: 26e0e7cd99f5a011ffd9c4c4d58dd6bc4b6fef7d

tech-stack:
  added: []
  patterns:
    - "Navigation arm + displayed-frame settle: sample a destination's pending cache work synchronously before its cached base loads, then settle it once the destination is the displayed frame"
    - "Byte-carrier identity reload gate: reload only when the applied preview base's bytes differ by reference from the resolved display frame"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts

key-decisions:
  - "The pending probe is read-only and identity-scoped through the same resolveFrameIdentityInput every capture/flush uses, plus the parent-delivery maps — never a drain and never a throw"
  - "The navigation arms the destination only when frame !== currentFrame and the probe reports pending work, sampled after setCachedRotoReferenceUrl(null) and BEFORE the synchronous loadCachedRotoReferenceFrame"
  - "The settle effect consumes the arm synchronously before any await (no double-flush), skips superseded navigations and active cached playback, and requires launchContext.startFrame to equal the armed frame after the await"
  - "The reload forces the generated post-flush sequence (clear base, reset background, load) because the loader's plain-refresh guard refuses a plain reload with an explicit base already applied for the same frame"
  - "No change to motion evaluation, key evaluation, the compositor, the selection/transform overlay, the engine pointer conversion, the document schema or any store setter"

patterns-established:
  - "Destination settle: arm in the navigation intent tick, consume in the displayed-frame effect"
  - "Per-frame pending probe: a pure map lookup on the coordinator return, separate from the global hasPendingLivePixels"

requirements-completed: [QUICK-261109-PWT]

coverage:
  - id: D1
    description: "Persistence coordinator exposes a read-only, identity-scoped hasPendingLivePixelsForFrame probe on the hook return"
    requirement: QUICK-261109-PWT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts#261109-pwt destination pending probe"
        status: pass
    human_judgment: false
  - id: D2
    description: "Navigation arms the destination before its synchronous cached-base load; one settle effect flushes the armed identity after startFrame displays it and forces one reload only on a byte change"
    requirement: QUICK-261109-PWT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#quick 261109-pwt — pending destination capture settles after the destination is displayed"
        status: pass
    human_judgment: false
  - id: D3
    description: "hasPending/flush are per identity: one identity settles while another stays pending, and the global probe clears only when every capture settles"
    requirement: QUICK-261109-PWT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts#261109-pwt per-identity pending probe"
        status: pass
    human_judgment: false
  - id: D4
    description: "First return to a cached key shows paint added since that key's last cache commit, with no second click, on the live native build"
    requirement: QUICK-261109-PWT
    verification:
      - kind: manual
        ref: "Native UAT approved 2026-11-09 — first-return, fast-leave faint wash, blank-leave and normal-paint rows confirmed"
        status: pass
    human_judgment: true
    rationale: "The reported symptom is a live WKWebView display surface (destination cached base loaded before its pending capture commits); only the six native UAT rows can confirm the visible first-return behavior and the no-delay/no-flash controls."

# Metrics
duration: 3min
completed: 2026-11-09
status: complete
---

# Quick 261109-pwt: Cached-key first return shows newly painted pixels

**A navigation now arms the destination frame's still-pending cache capture before loading its cached base, and a displayed-frame settle effect commits that identity once the destination is shown — removing the second-click workaround.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-09T18:02:17Z
- **Completed:** 2026-11-09T18:04:59Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `hasPendingLivePixelsForFrame(appFrame, trackId?)` to the persistence coordinator: a read-only, identity-scoped probe over the live-pixel transactions and the parent-delivery maps (delivery key `launchId:layerId:keyId`), exposed next to `flushLivePixels`.
- The Studio navigation samples the destination's pending capture immediately after `setCachedRotoReferenceUrl(null)` and before the synchronous `loadCachedRotoReferenceFrame(frame, previewBasePort)` — so a destination whose frame-leave capture is still pending arms exactly one repair, and a same-frame navigation arms nothing.
- One settle effect consumes the arm once `currentFrame` (the propagated `startFrame`) equals the armed frame: it skips superseded navigations and active cached playback, consumes the ref before any await, flushes only the armed identity, re-checks the generation and `launchContext.startFrame` after the await, and then forces exactly one reload (clear base, reset background, load) only when the applied byte carrier differs from the resolved display frame. Same-bytes and nothing-pending paths return before any await, so they add no flash and cannot loop.
- Sequence pins lock the arm ordering and every settle guard, and a behavior test pins the per-identity `hasPending`/`flush` contract the effect relies on.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end settle — per-frame pending probe, navigation arm, displayed-frame settle effect** — `22662b433` (fix)
2. **Task 2: Per-identity pending/flush behavior pin and full gates** — `26e0e7cd9` (test)

**Plan metadata:** not committed here — the orchestrator owns the docs commit.

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — added the `hasPendingLivePixelsForFrame` probe and exposed it on the hook return.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — added `pendingDestinationCaptureRef`, the navigation-time arm sampled before the synchronous destination load, and the settle effect between the navigation callback and `lastReferenceDisplayStateRef`.
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` — `261109-pwt destination pending probe` source pins (identity/parent-delivery reads, no `await`/`.flush(`, hook-return exposure).
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — `quick 261109-pwt — pending destination capture settles after the destination is displayed` pins (arm ordering, single consume, flush guard, generation/startFrame guards, byte comparison, forced reload sequence, deps array).
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts` — `261109-pwt per-identity pending probe` behavior test (two identities pending, one flush settles only its identity, global probe clears last).

## Decisions Made

- Probe reads `livePixelTransactionsRef.current.hasPending(identity)`, `parentDeliveryRef.current.has(key)` and `parentDeliveryErrorRef.current.has(key)` — the same identity resolver and delivery key `flushLivePixels` uses, so the arm can never address a different identity than the flush.
- The arm is assigned unconditionally on every launch navigation (either a new arm or `null`), which is what keeps a stale arm from a previous navigation from surviving.
- The arm uses `frame !== currentFrame` to skip a destination that is already displayed: in that case the navigation's own flush is that identity's flush.
- `rotoCachedPlayback` is read at run time and deliberately excluded from the effect deps (its identity changes every render); refs are likewise read at run time.
- No production change was needed in Task 2 — the test is a behavior pin for the existing per-identity transaction contract.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

Both register entries were mitigated as planned: the flush is identity-scoped and consumes the arm before the await (T-PWT-01), and the reload requires a byte-carrier change with a read-only probe (T-PWT-02). No new package, endpoint, auth path or schema surface was introduced (T-PWT-SC; T-PWT-03 accepted).

## Issues Encountered

None. `pnpm --filter efx-motion-editor run typecheck`, the three targeted suites, and the full `vitest run` (408 files passed, 2 skipped; 8417 tests passed, 1 skipped, 96 todo) all pass. No `.test.tsx` was added and no dev server was started.

## Follow-up — UAT round 2 (2026-11-09)

UAT found a second, independent loss mode: painting a faint wash and leaving the frame before the watercolor simulation settles still dropped the stroke entirely. The live trace (`/tmp/efx-aquarelle-render-split.json`) shows the capture was invoked with `hasPaint: true` but rejected by the Studio's `AQUARELLE_MIN_CAPTURE_INK` floor: real wet strokes measured 0.71/0.93/0.94 while accepted captures scored 1.32–1.81 — the floor of 1 sat inside the real-paint band. The sheet is wiped on frame leave, so the rejected capture lost the paint for good.

Fix `8b1508db8`: the floor is now 0.3, still 2.5x above the measured blank-sheet maximum (0.05–0.12) but below every observed real capture. The guard literal and the settle path from this quick are unchanged; the source pin was updated to the new constant.

**Native UAT approved 2026-11-09** — first return, fast-leave faint wash, blank-leave and normal-paint rows all confirmed.

## Known Stubs

None.

## Next Phase Readiness

- Automated gates are green; the six native UAT rows in the plan are the remaining confirmation (first-return visibility for Group override cells and ordinary real keys, generated-destination control, save/reopen persistence, no visible delay, identity rails).
- No blockers. The identity/no-pending/superseded/playback paths are unchanged, and the rail-edit cursor seat fix from `studio-paint-motion-offset` is untouched.

## Self-Check: PASSED

- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — FOUND
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — FOUND
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts` — FOUND
- Commit `22662b433` — FOUND (ancestor of HEAD)
- Commit `26e0e7cd9` — FOUND (ancestor of HEAD)
