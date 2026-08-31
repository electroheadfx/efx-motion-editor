---
phase: 49-fixed-background-track-and-imported-loop-clips
plan: 01
subsystem: model
tags: [efx-paint, document, fallback, parser, canonical-encoder, round-trip, tdd]

# Dependency graph
requires:
  - phase: 45-new-efx-paint-document-and-clean-cutover
    provides: v1.0 EfxPaintDocument model, fail-closed parser, canonical encoder
provides:
  - Extended BackgroundFallback union carrying the paper mode (texture canvas1-3, paperGrain, grainStrength)
  - Fail-closed exact-member paper parser branch (extra AND missing member rejection, finite non-negative grainStrength)
  - Deterministic canonical paper encoder term (paper:<texture>:<paperGrain>:<grainStrength>)
  - White-mapping gate resolution: White = solid '#ffffff', no distinct 'white' literal
  - Round-trip + rejection contract suite (10 tests) proving BKG-09 persistence for every fallback mode
affects: [49-02, 49-03, 49-04, 49-05, 49-06, Phase 50 photoReference]

# Actuals (#2632) — pairs with the plan's estimate (40000 tokens)
actuals:
  tokens: 2927    # chars/4 over the realized diff (11706 chars)
  tasks: 2         # tasks completed
  commits: 3       # commits made

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exact-member fail-closed parsing: hasOnlyKeys AND key-count presence check for the paper arm (extra AND missing members both throw)"
    - "Lockstep union extension: type + parser + encoder extended in ONE commit (Pitfall 6), proven by round-trip tests not typecheck alone"
    - "Engine package type mirrors the app-side schema (BackgroundFallback widened in lockstep)"

key-files:
  created:
    - app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts
  modified:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - packages/efx-physic-paint/src/types.ts

key-decisions:
  - "White maps to the existing solid arm as { mode: 'solid', color: '#ffffff' } — the total parser/encoder round-trips it with zero information loss, so NO distinct 'white' literal is added (RESEARCH Open Q2 resolved by the Test 4 gate)"
  - "Paper fallback grainStrength is validated as a finite non-negative number (no clamping, fail-closed at the min boundary) — negative, NaN, Infinity, and non-number all throw at parse"
  - "The paper parser enforces exact-member presence (key-count check in addition to hasOnlyKeys) so a missing paperGrain/grainStrength throws the 'must contain exactly' error, matching the plan's must_haves truth"

patterns-established:
  - "Pattern: every new fallback arm extends type + parser + encoder in one commit, with round-trip + rejection tests as the deciding gate"
  - "Pattern: exact-member fail-closed = allowed-key-set membership AND required-key presence"

requirements-completed: [BKG-06, BKG-09]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Extended BackgroundFallback union with the paper arm (texture canvas1-3, paperGrain, grainStrength) round-tripping through type + parser + canonical encoder"
    requirement: BKG-09
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts#round-trips a paper fallback through JSON serialize/parse"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts#produces distinct canonical revisions for distinct paper textures and identical revisions for identical paper fallbacks"
        status: pass
    human_judgment: false
  - id: D2
    description: "White mapping gate resolved — White uses the solid arm as '#ffffff' with no distinct 'white' literal (allow-list assertion)"
    requirement: BKG-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts#maps White to the solid arm with #ffffff and adds no distinct white literal"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fail-closed rejection of reserved/unknown/malformed fallback inputs — photo mode, unknown mode, extra member, missing member, non-finite/negative grainStrength all throw at parse"
    requirement: BKG-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts#rejects the reserved photo mode at parse"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts#rejects negative, NaN, Infinity, and non-number grainStrength fail-closed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Canonical revision stability — a paper-fallback document's revision is unchanged by JSON field reordering (deterministic encoder, T-49-01-02)"
    requirement: BKG-09
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts#produces a canonical revision unchanged by JSON field reordering for a paper fallback"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-31
status: complete
---

# Phase 49 Plan 1: Background Fallback Union Extension Summary

**Extended the persisted `BackgroundFallback` union with the paper mode (texture canvas1-3, paperGrain, grainStrength), a fail-closed exact-member parser branch, a deterministic canonical encoder term, and a 10-test round-trip + rejection contract suite — with White resolved to the solid `#ffffff` arm (no distinct literal).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-31T11:13:21Z
- **Completed:** 2026-08-31T11:16:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `BackgroundFallback` union extended with the paper arm: `{ mode: 'paper'; texture: 'canvas1'|'canvas2'|'canvas3'; paperGrain: boolean; grainStrength: number }` — the model half of D-11, consumable by Plans 49-02/49-03 without further model work.
- Fail-closed paper parser branch: texture membership, boolean `paperGrain`, finite non-negative `grainStrength`, and exact-member validation (extra AND missing members both throw the "must contain exactly" error).
- Deterministic canonical encoder term `paper:<texture>:<paperGrain>:<grainStrength>` — encoder output never contains revision or volatile fields; identical documents hash identically.
- White mapping gate resolved by round-trip test: `{ mode: 'solid', color: '#ffffff' }` round-trips cleanly through the total parser/encoder, so White uses the solid arm and NO `white` literal is added (RESEARCH Open Q2 closed).
- `photo` mode stays reserved (D-11): a serialized `{ mode: 'photo' }` throws at parse, reserved for the Phase 50 photoReference track.
- Engine package `BackgroundFallback` type widened in lockstep to mirror the app-side union (typecheck boundary fix).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): paper fallback mode end-to-end** - `91024764` (test: RED), `76cfc3fd` (feat: GREEN)
2. **Task 2: complete the union — White mapping, grain edges, photo/unknown rejection** - `8b94c8fb` (test)

**Plan metadata:** pending (docs: complete plan)

_Note: TDD tasks produce multiple commits (test → feat). Task 2's tests passed against the Task 1 implementation — the White gate resolved to the solid arm, so no new implementation was needed._

## Files Created/Modified

- `app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts` - New 10-test contract suite: per-mode round-trip, encoder distinctness/stability, fail-closed rejection (missing member, unknown texture, photo, unknown mode, extra member, non-finite/negative grainStrength), White mapping gate, revision stability.
- `app/src/efx-paint/document/efxPaintDocument.ts` - `BackgroundFallback` union gains the paper arm; new `PaperTexture` type exported.
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` - Paper parser branch with exact-member (extra + missing) validation, texture membership, boolean paperGrain, finite non-negative grainStrength; error message updated to "transparent, solid, or paper".
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` - Canonical encoder switch extended with the deterministic paper term.
- `packages/efx-physic-paint/src/types.ts` - Engine package `BackgroundFallback` widened to mirror the app-side union (typecheck lockstep; dist rebuilt, gitignored).

## Decisions Made

- **White = solid `#ffffff`, no `white` literal** (RESEARCH Open Q2): the Test 4 round-trip gate passed with the solid arm — the total parser/encoder carries `#ffffff` with zero information loss. The allow-list assertion (`{ mode: 'white' }` throws) locks the union to exactly transparent, solid, paper.
- **grainStrength fail-closed at the min boundary**: finite non-negative number, no clamping — `-0.1`, `NaN`, `Infinity`, and non-numbers all throw at parse (BKG-04 adjacency family).
- **Exact-member presence check**: the paper branch adds a key-count check alongside `hasOnlyKeys` so missing members throw the "must contain exactly" error (the plan's must_haves truth requires missing-member rejection).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Engine package BackgroundFallback type widened to mirror the app-side union**
- **Found during:** Task 1 (GREEN, typecheck)
- **Issue:** The union widening made the app-side `EfxPaintDocument` unassignable to the engine package's `EfxPaintDocument` at the `engine.load(document)` boundary (`usePhysicsPaintSessionController.ts:98`) — the engine's `BackgroundFallback` type only carried transparent/solid.
- **Fix:** Widened `packages/efx-physic-paint/src/types.ts` `BackgroundFallback` to mirror the app-side union (the type comment already declares "mirrors the app-side schema"). The engine's runtime validation (`validateEfxPaintDocument`) only checks the background record's keys, not the fallback's inner structure, so the widening is type-only and runtime-safe. Rebuilt the package dist (gitignored build artifact).
- **Files modified:** packages/efx-physic-paint/src/types.ts
- **Verification:** `pnpm --dir app run typecheck` exits 0
- **Committed in:** 76cfc3fd (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Test 2 built "identical" documents with fresh UUIDs per call**
- **Found during:** Task 1 (GREEN iteration)
- **Issue:** `documentWithFallback` calls `createEfxPaintDocument` which allocates fresh track/background UUIDs per call, so the two "identical" paper-fallback documents had different IDs and produced different revisions.
- **Fix:** Built the second variant via `JSON.parse(JSON.stringify(base))` from the same base document, so only the texture differs.
- **Files modified:** app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts
- **Verification:** Test 2 passes
- **Committed in:** 76cfc3fd (Task 1 GREEN commit)

**3. [Rule 2 - Missing Critical] Paper parser missing-member presence check**
- **Found during:** Task 1 (GREEN iteration)
- **Issue:** `hasOnlyKeys` only rejects extra keys, not missing ones — `{ mode: 'paper', texture: 'canvas1' }` passed the key-set check and failed later on the paperGrain type check, not the "must contain exactly" error the plan's must_haves truth requires for missing members.
- **Fix:** Added `Object.keys(value).length !== FALLBACK_PAPER_KEYS.size` to the paper branch so missing members throw the exact-member error.
- **Files modified:** app/src/efx-paint/document/efxPaintDocumentParsers.ts
- **Verification:** Test 3 passes with the "must contain exactly" error
- **Committed in:** 76cfc3fd (Task 1 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All auto-fixes were necessary for correctness and typecheck green. The engine type widening is a required lockstep mirror (the type comment already promised it). No scope creep.

## Issues Encountered

- The engine package `dist/` is gitignored, so the rebuilt `.d.ts` is a local build artifact — the committed source change in `packages/efx-physic-paint/src/types.ts` is what future builds consume.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 49-02 (fallback setter) and 49-03 (fond re-wire + selector) can consume the extended union without further model work — every fond-selector mode (transparent, white, canvas1-3 + grain) persists through the document schema with a clean round-trip and fail-closed rejection of reserved/unknown modes.
- The `photo` mode remains reserved for the Phase 50 photoReference track (D-11).
- Ready for 49-02.

## Self-Check: PASSED

- FOUND: app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts
- FOUND: .planning/phases/49-fixed-background-track-and-imported-loop-clips/49-01-SUMMARY.md
- FOUND: 91024764 (RED), 76cfc3fd (GREEN), 8b94c8fb (Task 2)

---
*Phase: 49-fixed-background-track-and-imported-loop-clips*
*Completed: 2026-08-31*
