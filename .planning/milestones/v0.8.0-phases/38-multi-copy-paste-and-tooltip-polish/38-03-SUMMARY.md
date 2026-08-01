---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 03
subsystem: ui
tags: [preact, physics-paint, roto, status-capsule, presentation-selector]

requires:
  - phase: 36.15-final-timeline-ui-integration
    provides: header status capsule selector (getRotoStatusCapsuleViewModel), ambient input slot, currentSemanticCell derivation in the strip
provides:
  - Pure idle current-cell context helper getRotoStatusCapsuleIdleContext with the UI-SPEC locked real/generated/empty mapping
  - Capsule idle rung fed from live state (currentSemanticCell + currentFrame) instead of a static baseline constant
  - Selector final fallback returning the ambient line or an empty string — no static filler anywhere in the chain
affects: [38-05-tooltip-rework, 38-06-native-uat, 38-08-post-uat-tests]

tech-stack:
  added: []
  patterns:
    - "Capsule idle rung is a caller-supplied render-time derivation, never a module-level constant (D-08/D-09)"
    - "Missing-frame information is event-driven only, emitted from playback start/active/stop paths (D-10)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx

key-decisions:
  - "Playback missing-frame wording in useRotoCachedPlayback.ts kept verbatim — all three emission sites are provably event-driven (start guard, playing status, stop), so no tightening was required (D-10)"
  - "Tracer feedback gate satisfied by automated re-verify; human-check is explicitly deferred to 38-06 native UAT per the plan"

patterns-established:
  - "getRotoStatusCapsuleIdleContext: pure mapping from cell kind + physical appFrame to the locked context strings with the middle-dot separator"

requirements-completed: [38-CAPSULE-IDLE-CONTEXT]

coverage:
  - id: D1
    description: "Static capsule baseline deleted; selector idle rung returns ambient or empty string"
    requirement: 38-CAPSULE-IDLE-CONTEXT
    verification:
      - kind: other
        ref: "grep -c 'Missing frames play transparent' app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Idle capsule shows locked current-cell context line (Real Roto key / Generated frame / Empty frame · Frame {n}) and follows navigation"
    requirement: 38-CAPSULE-IDLE-CONTEXT
    verification: []
    human_judgment: true
    rationale: "Native visible UAT is plan 38-06 by design (D-15 sequence); this plan is automated-ready, not user-verified"
  - id: D3
    description: "Missing-frame information exists only as event-driven playback status in useRotoCachedPlayback.ts"
    requirement: 38-CAPSULE-IDLE-CONTEXT
    verification:
      - kind: other
        ref: "repo-wide grep for missing-frame text outside useRotoCachedPlayback.ts (excluding tests) -> no matches"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-07-27
status: complete
---

# Phase 38 Plan 03: Capsule Idle Context Summary

**Static capsule baseline deleted and replaced with a live current-cell idle context line fed through the selector's ambient slot from a new pure helper; missing-frame wording confirmed event-driven only in useRotoCachedPlayback.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-27T15:04:00Z
- **Completed:** 2026-07-27T15:10:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Deleted `ROTO_STATUS_CAPSULE_BASELINE` and the `ambient ?? <baseline>` fallback; the selector now returns the trimmed ambient line or `''` (D-08) — the capsule can never show static filler again
- Added exported pure helper `getRotoStatusCapsuleIdleContext({ cellKind, frame })` implementing the UI-SPEC locked mapping: real → `Real Roto key · Frame {n}`, generated → `Generated frame · Frame {n}`, empty → `Empty frame · Frame {n}`, null → null (D-09)
- Strip feeds `ambient` from `currentSemanticCell?.kind ?? null` + `props.currentFrame` at render time — no new controller state, signal, memo, or effect (Preact state ownership contract)
- Reviewed `useRotoCachedPlayback.ts` missing-frame emissions: all three sites (empty-cache start guard, playing status with count, stopped status) are event-driven by construction; wording kept verbatim (D-10)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end capsule idle context — delete baseline, feed `ambient` from the strip (D-08, D-09)** — `d72a3eda` (feat)
2. **Task 2: Missing-frame wording review — event-driven surface only (D-10)** — review-only, no code change required; no commit (wording kept, grep audit clean)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` — baseline constant and fallback removed; header comment updated to describe the caller-supplied ambient rung; new exported `getRotoStatusCapsuleIdleContext` helper
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — capsule selector call now passes `ambient:` from the new helper; wiring comment extended; helper added to presentation imports
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — reviewed, unmodified (wording kept per D-10)

## Decisions Made
- Kept the playback missing-frame wording in `useRotoCachedPlayback.ts` verbatim: each emission fires from an explicit playback event (start guard / active playback / stop), so the explanatory clause is playback-scoped and factually relevant — tightening was conditional on a permanent-state reading, which does not exist here (D-10).
- Treated the tracer feedback gate as satisfiable by automated re-verify: the plan's human-check is explicitly scoped to the 38-06 native run ("UAT is 38-06"), so no interactive checkpoint was emitted between Tasks 1 and 2.

## Deviations from Plan

None - plan executed exactly as written.

(Deviation-adjacent note, not a rule deviation: Task 2 produced no code change because the review outcome was "wording kept", which the plan explicitly allows — "wording review only (kept or tightened; never removed)".)

## Issues Encountered
None.

## Known Stubs
None — no placeholder, empty-value, or unwired-data patterns were introduced. The idle context line is fully wired to live state.

## User Setup Required
None - no external service configuration required.

## Threat Flags
None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. All new strings render as Preact text children only (T-38-04 / T-36.15-08 preserved).

## Verification Evidence
- `grep -c "Missing frames play transparent" app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` → 0
- `grep -rn "Missing frames play transparent" app/src/components/physic-paint` outside `useRotoCachedPlayback.ts` and tests → no matches
- `grep -c "ambient:" app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` → 1
- `getRotoStatusCapsuleIdleContext` present in both presentation and strip files
- No remaining references to `ROTO_STATUS_CAPSULE_BASELINE` anywhere in `app/src`
- D-15 discipline: `git diff --name-only` shows no `*.test.ts` changes; no `vitest` invocation in this plan
- Full typecheck/build gate deferred to 38-08 per the D-15 sequence — this plan is "automated-ready", not "done"; native visible UAT is 38-06

## Next Phase Readiness
- 38-04/38-05 can proceed; 38-05 must not alter the ambient feed when restacking tooltip placement
- 38-06 native UAT owns the visible verification of the tracer slice (idle on real key shows `Real Roto key · Frame 5`; empty cell shows `Empty frame · Frame 7`)
- 38-08 rewrites the knowingly-red `physicsPaintWorkflowPresentation.test.ts:159-225` baseline assertions against the idle-context contract (Pitfall 5 — untouched here per D-15)

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: `.planning/phases/38-multi-copy-paste-and-tooltip-polish/38-03-SUMMARY.md`
- FOUND: commit `d72a3eda` (Task 1)
- Task 2 intentionally has no commit (review-only outcome, wording kept per plan)
