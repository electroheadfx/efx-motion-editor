---
phase: 64-medium-engine
plan: 30
subsystem: paint-engine, sheet-cache
tags: [aquarelle, sheet-cache, inv-02, type-guard, tdd, deferred-record]

# Dependency graph
requires:
  - phase: 64-medium-engine
    provides: the canonical whole-event sheet digest (64-28) and the KEY = CACHE sheet cache whose remember/restore sides disagreed about empty scripts
  - phase: 64-medium-engine
    provides: the 64-REVIEW-DISPOSITION rows for IN-02 and IN-06
provides:
  - hasCacheableScript — one exported presence predicate in the sheet-signature module, used by both remember sites and restoreCachedSheet
  - a symmetric sheet cache — a script the cache refuses to restore can no longer be parked
  - the IN-06 dead-seed deferral with symbols, caller, risk and reopen trigger
affects: [sheet-cache identity, any future emptiness/presence check on frame scripts, dead-code cleanup of the seed path]

# Actuals (#2632) — same scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 3603
  tasks: 2
  commits: 3
  plan_head_before: 2d7556764fd59ba0b0f3c5d84ab8724dac67a6ac
  plan_head_after: 5d864d571585dc2cd862089c1fa16eb98b1c1f66

# Tech tracking
tech-stack:
  added: []
  patterns: [one predicate answering both sides of a cache, presence-not-truthiness type guard beside the identity module]

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/engine/aquarelleSheetSignature.ts
    - app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
    - .planning/phases/64-medium-engine/deferred-items.md

key-decisions:
  - "The presence predicate lives in the digest module: the module that owns what a script's identity IS also owns whether there is a script at all, so the remember side and the restore side cannot drift apart (IN-02)."
  - "hasCacheableScript is a type guard on `unknown` (Array.isArray + positive length), and restoreCachedSheet's parameter widened to `unknown`: a malformed non-array payload is rejected by the guard instead of reaching the digest walk as if it were a script."
  - "The shipped import pin was widened with the predicate name on the one import line rather than keeping two imports from the same module — one module, one import."
  - "IN-06 stays as shipped: only a test-only caller reaches the seed path, and removing the adapter's injected engine/clock options would touch the shared bake-adapter surface for zero shipped behaviour; the deferral records the symbols, caller, risk and reopen trigger."
  - "RED used a stub returning Boolean(events) rather than a module-not-found run, because the TDD gate classifies load failures as INVALID_RED (#3770) — the stub made the truth table fail on its own assertion."

patterns-established:
  - "Symmetric cache predicate: the same exported function answers the write side and the read side, so an entry can never be parked under a rule the reader does not share."
  - "One-line message pins (`expect(source.includes(needle), message).toBe(true)`) when pinning a whole-file source: a failing `toContain` on the layer dumps its full source into the TAP diagnostic and breaks RED-evidence parsing."

requirements-completed: [MED-05, MED-23]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "One exported hasCacheableScript predicate answers presence for absent, non-array, empty, one-event and many-event inputs, and both remember sites plus restoreCachedSheet call it — the cache can no longer park a script it would refuse to restore; the digest, bounds and signature comparison are unchanged."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts#64-30 hasCacheableScript — one predicate for both cache sides (IN-02)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts#SHEET CACHE: one predicate answers both sides of the cache (64-30 IN-02)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "IN-06 is recorded as a written deferral naming the dead seed function, the adapter's injected engine/clock seam and the 8 ms yield constant, their file:line locations, the surviving test-only caller, the anti-replay layer pins, the reason removal is deferred and the reopen trigger; no source file changed."
    verification:
      - kind: other
        ref: "grep -q IN-06 && grep -q seedAquarelleEngine deferred-items.md && git diff --quiet -- packages/efx-watercolor/src/bake/aquarelleSeed.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-11-22
status: complete
---

# Phase 64 Plan 30: Symmetric sheet-cache predicate + IN-06 deferral Summary

**The sheet cache now asks one exported `hasCacheableScript` predicate on both sides — remember and restore can no longer disagree about an empty script — and the dead live-seed path is recorded as a reasoned deferral.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-22T18:44:54Z
- **Completed:** 2026-11-22T18:48:01Z
- **Tasks:** 2
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments
- Added `hasCacheableScript(events: unknown)` to `aquarelleSheetSignature.ts`: a type guard answering presence, not truthiness — absent, non-array and empty arrays are not scripts; one event and any longer list are. It lives beside the digest so the module that owns a script's identity also owns whether there is a script.
- Wired all three cache decision points to it: both `rememberSheet` call sites (re-render adoption and frame-leave capture) and `restoreCachedSheet`, whose parameter widened to `unknown` and whose hand-rolled `!events || events.length === 0` test is gone. A frame with no events parks nothing and restores nothing; a populated frame's lifecycle is unchanged.
- Pinned the symmetry: three truth-table tests in the digest gate (rejecting side, accepting side, type narrowing) and a contract pin asserting the import, the restore call, both remember sites, and the absence of any hand-rolled emptiness test in the cache block.
- Recorded IN-06 in `deferred-items.md`: the dead `seedAquarelleEngine` family, the adapter's injected `engine`/`clock` options, and the seed's `yieldToHostMs: 8` constant, each with file:line; the surviving caller (`liveSeed.test.ts`), the anti-replay layer pins, the reason removal stays out of this phase, and the reopen trigger. The seed source is byte-identical.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: pin one cacheable-script predicate for both cache sides** - `1ccdd2f7a` (test)
2. **Task 1 GREEN: share one cacheable-script predicate across the sheet cache** - `75fdac1a6` (feat)
3. **Task 2: record IN-06 seed-path deferral** - `5d864d571` (docs)

**Plan metadata:** (docs commit created after this SUMMARY)

_Note: Task 1 is TDD (test → feat); Task 2 is a planning-prose task (single docs commit)._

## TDD Gate Compliance

- **Task 1:** RED evidence `.gsd/tdd-evidence/64-30/task1-red.json` — `RED_EVIDENCE_OK` (`target_test_failed`, 40 tests collected, 38 pass / 2 fail: the truth-table assertion and the new contract pin). GREEN commit `75fdac1a6` follows RED commit `1ccdd2f7a`. No REFACTOR commit — the implementation is the minimal predicate plus the three call-site swaps.
- The RED stub returned `Boolean(events)` so the gate failed on its own assertion; a module-not-found run would have been `INVALID_RED (fixture_or_load_failure)` (#3770).
- Post-GREEN the same 40 tests pass, including all 26 shipped contract pins and all 10 shipped digest pins (the digest's output is untouched).

## Files Created/Modified
- `app/src/components/physic-paint/engine/aquarelleSheetSignature.ts` - adds `hasCacheableScript` (unknown → `readonly AquarellePayloadEvent[]`, `Array.isArray && length > 0`); digest body untouched
- `app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts` - new 64-30 truth table (rejecting side, accepting side, narrowing) alongside the untouched 64-28 digest gate
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - imports the predicate; `restoreCachedSheet` asks it (param widened to `unknown`); both remember sites ask it
- `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` - new IN-02 pin (import, restore call, both remember sites, no hand-rolled emptiness); the shipped import pin widened to the new literal
- `.planning/phases/64-medium-engine/deferred-items.md` - IN-06 deferral section appended after the 64-14 entry

## Decisions Made
- Presence lives with identity: `hasCacheableScript` is exported from the digest module so "is there a script" and "what is this script" have one owner.
- The predicate is a type guard on `unknown`; `restoreCachedSheet` takes `unknown` so the guard — not the declared type — is the runtime gate.
- IN-06 remains as shipped; the deferral names the three dead pieces, the test-only caller, the shared adapter surface that makes removal non-trivial, and the reopen trigger.

## Deviations from Plan

None — plan executed exactly as written. The shipped import pin in `aquarelleLayerContract.test.ts` was updated to the widened one-line import literal (the planned diff necessarily changes that line); its intent is preserved and the new IN-02 pin asserts the same import.

## Issues Encountered
- The first contract-pin draft used `expect(layer).toContain(...)`, so the RED failure diagnostic embedded the whole layer source as a multi-line YAML scalar and the classifier returned `INVALID_RED (invalid_record)` ("Non-TAP data in report"). Rewriting the new pins as one-line `expect(source.includes(needle), message).toBe(true)` assertions produced a clean TAP report and `RED_EVIDENCE_OK`.
- The narrowing test initially asserted `value[0].kind`, which does not exist on the stroke branch of the `AquarellePayloadEvent` union; `tsc --noEmit` caught it (TS2339). Replaced with an identity assertion (`expect(first).toBe(dry)`) that still requires the guard to narrow `unknown`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IN-02 is closed by construction and by pin: the two sides of the sheet cache share one predicate, and the digest, bounds, eviction order and signature comparison are unchanged.
- IN-06 is deferred with a fully stated record; the dead path is byte-identical.
- Automated verification green: 40 tests across the two suites, `tsc --noEmit` clean, plan diff limited to the five planned files.
- This plan claims no UAT row (spec-less probe); live visual UAT remains the phase verifier's call.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-22*

## Self-Check: PASSED
