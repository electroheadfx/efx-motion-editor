---
phase: 55-efx-paint-host-engine-1-host-split
plan: 06
subsystem: app
tags: [refusal, fail-closed, HOST-05, DATA-02, D-09, D-10, D-11, D-12, no-partial, owned-refusal]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-05)
    provides: HostScriptRefusal codes + classifyEnvelopeParseFailure + engine-1 codec on StudioScriptEnvelope
provides:
  - "Four named Apply refusal lines in buildRotoScriptApplyRefusalMessage (D-11)"
  - "hostSplitFailClosedApply.test.ts standing no-partial pin (D-12)"
  - "parseRotoScript engine-mismatch discrimination for known-but-wrong engine"
affects: [55-07, 55-08, 56-efx-watercolor]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7001
  tasks: 2
  commits: 3
  plan_head_before: 242e4cfe10ec91e93486c74ccc3ac217e8acbb6a
  plan_head_after: 4ae4938f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host codes / Studio names split: refusal.ts yields codes + detail; buildRotoScriptApplyRefusalMessage names them on the owned-refusal surface (D-09)"
    - "engine-mismatch detail format: '<scriptEngineId>:<targetEngineId>' with D-15 display-name mapping (Brush / Water color / Krita)"
    - "D-12 no-partial pin fires each refusal twice (idempotency) + second Apply in the same turn (concurrency)"

key-files:
  created:
    - app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Four host codes map to four distinct named English lines on the existing switch — no second error channel (D-09/D-10)"
  - "engine-mismatch detail carries '<scriptEngineId>:<targetEngineId>'; the mapper maps package ids to display names (D-15) and never leaks raw ids"
  - "parseRotoScript returns engine-mismatch (not malformed-engine-payload) for a known engine that is not engine-1 (Rule 2 — the four refusals must be distinguishable in production)"
  - "PhysicsPaintStudio.test.ts contract consciously extended: handleSelectedScriptLoadAndApply has two mutually exclusive error publications (refused-row + apply-failure); mentions count 3→4"

patterns-established:
  - "Named refusal line format: 'Apply rejected — <what went wrong>. Nothing changed.' on the existing apply-status / lastError line"

requirements-completed: [HOST-05, DATA-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Four named cross-engine Apply refusal lines in buildRotoScriptApplyRefusalMessage (D-11) on the existing owned-refusal surface (D-09/D-10)"
    requirement: "HOST-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts#maps unknown-engine-id to a named line about the unknown module"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts#maps malformed-engine-payload to a named line about an unreadable script"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts#maps engine-mismatch to a line naming BOTH engines (script engine first, target second)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts#maps unreadable-legacy-script to a line naming an older-version script"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts#the four host codes map to four DISTINCT named lines (not one shared fallback)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-12 no-partial pin: every named refusal writes nothing (no strokes, no cache, no Loop Clip) — twice per code + second Apply in the same turn"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts#each of the four named refusals maps to a non-null line and leaves the write probe at zero"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts#IDEMPOTENCY: firing each refusal twice yields the same named line and still zero writes"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts#CONCURRENCY: a second Apply in the same turn also writes nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "PhysicsPaintStudio wires host refusals through the existing owned-refusal surface (scriptApplyRefusalOwnedRef + clearOwnedScriptApplyRefusal + setLastError/setApplyMessage/setApplyStatus) — no second error channel"
    requirement: "HOST-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#routes BOTH apply entry points through the refusal helper and the capsule"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#adds no second refusal route: the mapper is imported once and called only at the apply/refusal sites"
        status: pass
    human_judgment: false
  - id: D4
    description: "parseRotoScript discriminates engine-mismatch from malformed-engine-payload for known-but-wrong engine"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts#maps engine-mismatch to a line naming BOTH engines (script engine first, target second)"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 06: Four Named Apply Refusals + No-Partial Pin Summary

**Fail-closed Apply with four named visible refusals on the owned-refusal surface and a standing D-12 no-partial pin (HOST-05 / DATA-02)**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-15T07:27:52Z
- **Completed:** 2026-10-15T07:42:32Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `buildRotoScriptApplyRefusalMessage` extended with four host refusal codes (D-11): `unknown-engine-id`, `malformed-engine-payload`, `engine-mismatch`, `unreadable-legacy-script` — each maps to its own distinct named English line on the existing apply-status / lastError surface
- `hostSplitFailClosedApply.test.ts` standing no-partial pin (D-12): every named refusal writes nothing (no strokes, no cache, no Loop Clip), fired twice per code (idempotency probe) and with a second Apply in the same turn (concurrency probe)
- `parseRotoScript` now discriminates `engine-mismatch` from `malformed-engine-payload` for a known engine that is not engine-1 — the four refusals are distinguishable in production
- PhysicsPaintStudio surfaces host refusals through the EXISTING owned-refusal surface (D-09/D-10): no modal, no toast, no red-triangle vocabulary, no second status line

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — four named refusal lines + no-partial pin** - `a8efec52` (test)
2. **Task 2: GREEN — extend the owned-refusal mapper and wire the existing surface** - `4ae4938f` (feat)

**Plan metadata:** see final commit below

_Note: TDD RED→GREEN order respected (test first, then implementation)._

## Files Created/Modified

- `app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` — D-12 standing no-partial pin (created)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` — four host-code cases + engine-mismatch display-name mapping (modified)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts` — four host-code mapper cases + distinctness + regression lock (modified)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` — parseRotoScript engine-mismatch discrimination (modified)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — refused-row branch surfaces named line through owned-refusal surface (modified)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — contract consciously extended for the new branch (modified)

## Decisions Made

- Four host codes map to four distinct named English lines on the existing switch — no second error channel (D-09/D-10). The line format is `Apply rejected — <what went wrong>. Nothing changed.`
- `engine-mismatch` detail carries `"<scriptEngineId>:<targetEngineId>"`; the mapper maps package ids to D-15 display names (Brush / Water color / Krita) and never leaks raw ids into the visible line.
- `parseRotoScript` returns `engine-mismatch` (not `malformed-engine-payload`) for a known engine that is not engine-1. Without this, the four refusals were not distinguishable in production — the `engine-mismatch` mapper case would be dead code.
- `PhysicsPaintStudio.test.ts` contract consciously extended: `handleSelectedScriptLoadAndApply` has two mutually exclusive error publications (refused-row branch + apply-failure branch); the mapper mention count went from 3 to 4. The invariant "a success can never take an error branch" is preserved via `lastIndexOf` ordering (the refused-row branch is an early return before the success path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] parseRotoScript engine-mismatch discrimination**
- **Found during:** Task 2 (GREEN)
- **Issue:** `parseRotoScript` returned `malformed-engine-payload` for a valid envelope with a known-but-wrong engineId (e.g. `efx-watercolor` in the engine-1 codec). The `engine-mismatch` refusal code was never produced in production, making the mapper's case dead code and the "engine mismatch" refusal unable to reach the user with its own name.
- **Fix:** Added an engine-mismatch check in `parseRotoScript` before the `isPersistedRotoScriptV1` fallthrough: if the envelope parsed cleanly (known engine) but the engineId is not `efx-physic-paint`, return `{ ok: false, refusal: { code: 'engine-mismatch', detail: '<scriptEngineId>:<targetEngineId>' } }`.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`
- **Verification:** All 186 tests green including the mapper's engine-mismatch cases and the no-partial pin.
- **Committed in:** `4ae4938f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical)
**Impact on plan:** The fix is required for the four named refusals to be distinguishable in production — without it, `engine-mismatch` is unreachable. No scope creep.

## Issues Encountered

- The TDD RED evidence classifier initially rejected the TAP report as `INVALID_RED (invalid_record)` due to pnpm error banners contaminating the TAP output and a truncated capture. Fixed by re-capturing with `--reporter=tap-flat`, stripping only the pnpm `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` banner lines, and using the exact qualified target test name. Second submission: `RED_EVIDENCE_OK`.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `a8efec52` `test(55-06): add failing tests for four named Apply refusals + no-partial pin` | Present — target tests failed on the named mapper-null assertion (RED_EVIDENCE_OK) |
| GREEN | `4ae4938f` `feat(55-06): implement four named Apply refusals on the owned-refusal surface` | Present — all 186 tests pass |
| REFACTOR | — | Not needed |

## Self-Check: PASSED

- [x] `app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` exists
- [x] `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` modified
- [x] `app/src/components/physic-paint/PhysicsPaintStudio.tsx` modified
- [x] RED commit `a8efec52` is ancestor of HEAD
- [x] GREEN commit `4ae4938f` is ancestor of HEAD
- [x] Plan verification: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts src/efx-paint/host-split/hostSplitFailClosedApply.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — 186/186 passed
- [x] Guard pins: golden parity (6/6), residue contract (5/5), schema tests (14/14), host suite (59/59), paintVersion discipline (5/5) — all green

## Next Phase Readiness

Ready for 55-07 (fake engine-2 A5 pin + import-graph pin + bake-host pattern port). The four named refusals are landed on the owned-refusal surface with the no-partial pin as a standing guard. Phase-wide symbol inventory lives in 55-08.

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*
