---
phase: 64-medium-engine
plan: 28
subsystem: paint-engine, probe-harness
tags: [preact, signals, aquarelle, sheet-cache, fnv1a, canonical-digest, medium-engine-probe, pickup-floor, tdd]

# Dependency graph
requires:
  - phase: 64-medium-engine
    provides: the shipped KEY = CACHE sheet cache (capture/restore/adopt) whose key was the count-only seedSignature, and the 64-24 bristle-wet acceptance with its committed 1080 baseline
provides:
  - aquarelleSheetSignature — a canonical, key-order-stable, total FNV-1a u32 digest over the whole event list (every field of every event)
  - the sheet cache keyed on that digest at all three sites; the old count-only walk deleted and contract-pinned absent
  - the bristle-wet pickup floor derived from the committed baseline's recorded gap (199.52 → 99.76 luma) with a 49/50 collapsed-range discriminator
affects: [sheet-cache identity, bristle-wet probe baseline re-authoring, 64 verification, any future event-payload signature]

# Actuals (#2632) — same scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 7143
  tasks: 2
  commits: 4
  plan_head_before: 694a992970aac386a2025c8361f067bfae175d22
  plan_head_after: 041f156802f6b238b27d62882cfb40b6a080570c

# Tech tracking
tech-stack:
  added: []
  patterns: [canonical type-tagged length-framed digest encoder, baseline-derived invariant floor]

key-files:
  created:
    - app/src/components/physic-paint/engine/aquarelleSheetSignature.ts
    - app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts
  modified:
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts

key-decisions:
  - "The digest is a deliberate superset of the deposit inputs: over-invalidating the sheet cache costs one blank key over its cached image (visible, recoverable), while under-invalidating restores stale pixels (the IN-05 defect) — hashing every event field is the safe side of that asymmetry."
  - "Canonical encoding, never JSON.stringify: nested records are walked with SORTED keys, every value carries a type tag with length-prefixed strings, absent and explicit-undefined members encode identically, NaN/±Infinity/cycles get their own markers, and the result stays an unsigned 32-bit FNV-1a digest — so identity is the values, never their construction history, and the encoder never throws."
  - "The pickup floor is derived in source at fifty percent of the committed baseline's recorded gap (RECORDED_PICKUP_GAP = 199.52 → PICKUP_MIN_DELTA = 99.76); re-authoring baselines/bristle-wet-1080.json requires re-deriving the floor, and the derivation is stated in the constant's doc."
  - "RED for IN-05 used a stub module returning a constant 0, because the project TDD gate classifies a module-not-found load failure as INVALID_RED (fixture_or_load_failure); the stub made the gate's discriminating assertions fail on their own assertions (RED_EVIDENCE_OK, target_test_failed)."
  - "The 49/50 and 100/100.5 cases assert against the single-line INVARIANT line rather than the whole comparator report, so a failing expectation keeps a one-line TAP `actual` and the report stays parseable for the TDD gate."

patterns-established:
  - "Canonical digest encoder: type-tagged, length-framed, sorted-key walk with explicit markers for undefined/NaN/±Infinity/cycles and a leading encoding-version token; a future byte-stream change misses every cached entry instead of comparing equal."
  - "Baseline-derived invariant floor: the probe comparator names the committed baseline's own reading as a constant and derives its bar from it, so the numeric gate is traceable to measured evidence rather than a decorative round number."

requirements-completed: [MED-05, MED-23, MED-38]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The sheet cache's identity is a canonical whole-event digest: every event field (point x/y/pressure/tilt/tick/wetness, stroke ticks/cuisson/seed/order/frame/colour/brush, engine tool/params/overrides/anchors/texture/curve flags, Dry tick/order) changes the signature, equal-count script edits diverge, key insertion order does not, and malformed payloads never throw."
    requirement: "MED-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts#64-28 canonical sheet signature (IN-05)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts#SHEET CACHE: the signature is the canonical whole-event digest (64-28 IN-05)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "The bristle-wet pickup floor is derived at half the committed baseline's recorded gap (99.76 of 199.52 luma): the recorded 50.64/250.16 pair still passes, the decorative 100/100.5 pair fails naming the derived floor, and a NEW 49/50 pair that the old one-luma floor accepted exits 1."
    requirement: "MED-38"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#the bristle-wet invariant discriminates (64-24, executed)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#the comparator gates the relation, never the direction"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-11-22
status: complete
---

# Phase 64 Plan 28: Sheet-cache script identity + baseline-derived pickup floor Summary

**The sheet cache now keys on a canonical whole-event FNV-1a digest (the count-only walk is deleted and pinned absent), and the bristle-wet pickup floor is derived at half the recorded 199.52-luma baseline gap, proven by a 49/50 collapsed-response case the old 1-luma floor accepted.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-22T16:20:22Z
- **Completed:** 2026-11-22T16:25:34Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Added `aquarelleSheetSignature` — a canonical, key-order-stable, total FNV-1a u32 digest over every field of every event, with a 10-test gate proving equal-count script edits diverge field by field (points, stroke fields, engine payload incl. params/overrides/anchors/texture/curve, Dry tick/order, list order), key insertion order does not, and malformed payloads never throw.
- Wired the layer to it: `rememberSheet`/`takeSheet`/`restoreCachedSheet` all key on the digest; the local count-only `seedSignature` walk is deleted, and the layer contract test pins its absence (`mutationId + 0x9e3779b9`, `pts?.length`) alongside the three new call sites.
- Replaced the probe's decorative `PICKUP_MIN_DELTA = 1` with `RECORDED_PICKUP_GAP = 199.52` (|50.64 − 250.16| from the committed `bristle-wet-1080` capture) and `PICKUP_MIN_DELTA = RECORDED_PICKUP_GAP / 2` (99.76); the failure message now names the derived floor and its derivation, and the doc requires re-deriving on a new baseline.
- Added the 49/50 collapsed-range executed case: a gap of exactly 1 passed the old floor and now exits 1, while the recorded pair, blank-band and out-of-range cases are unchanged; no baseline byte changed.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: pin the canonical whole-event sheet signature** - `effd12afd` (test)
2. **Task 1 GREEN: hash the whole event list into the sheet-cache key** - `0788c4ccd` (feat)
3. **Task 2 RED: pin the pickup floor derived from the recorded gap** - `4179266ad` (test)
4. **Task 2 GREEN: derive the pickup floor from the recorded gap** - `041f15680` (feat)

**Plan metadata:** (docs commit created after this SUMMARY)

_Note: TDD tasks produce paired test → feat commits._

## TDD Gate Compliance

- **Task 1:** RED evidence `.gsd/tdd-evidence/64-28/task1-red.json` — `RED_EVIDENCE_OK` (`target_test_failed`, 10 tests collected, 5 pass / 5 fail on genuine digest assertions). GREEN commit `0788c4ccd`.
- **Task 2:** RED evidence `.gsd/tdd-evidence/64-28/task2-red.json` — `RED_EVIDENCE_OK` (`target_test_failed`, 53 tests collected, 50 pass / 3 fail: the two updated pins and the new 49/50 case exiting 0 under the old floor). GREEN commit `041f15680`.
- Both evidence records were classified with `gsd_run check tdd-red-evidence` before any production edit; the first Task 1 attempt at RED (module-not-found) would have been `INVALID_RED (fixture_or_load_failure)`, so a stub module was used instead (see Deviations).

## Files Created/Modified
- `app/src/components/physic-paint/engine/aquarelleSheetSignature.ts` - canonical whole-event FNV-1a digest (sorted-key typed length-framed encoder, u32 result)
- `app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts` - 10-test gate: equal-count divergence field by field, key-order invariance, totality, explicit-undefined ≡ absent
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - imports the digest, deletes the count-only walk, keys all three sheet-cache sites on it
- `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` - pins the digest import and all three call sites, pins the old walk absent, KEY = CACHE comment amended
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` - `RECORDED_PICKUP_GAP` 199.52 and derived `PICKUP_MIN_DELTA` 99.76, failure message names floor and derivation, header/doc updated
- `packages/efx-watercolor/probe/medium-engine/harness.test.ts` - source pins moved to the two constants and derived comparison; decorative case requires the derived-floor message; new 49/50 collapsed-range case

## Decisions Made
- Hashing every event field is the safe side of the KEY = CACHE asymmetry (over-invalidation = one visible blank key; under-invalidation = stale pixels).
- Canonical encoding with type tags, length frames, sorted keys and explicit NaN/±Infinity/cycle/undefined markers; never `JSON.stringify`, never counts or ids alone; a `v1:` encoding-version token future-proofs the byte stream.
- The pickup floor is derived in source at 50% of the committed baseline's recorded gap; re-authoring the baseline requires re-deriving it (stated in the doc block).
- Test assertions read the single-line `INVARIANT` line of the comparator report so failing expectations keep parseable one-line TAP diagnostics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED used a stub module instead of the plan's module-not-found run**
- **Found during:** Task 1 (canonical sheet signature), RED phase
- **Issue:** The plan prescribed recording the module-not-found run as RED evidence, but the project's TDD gate (#3770/#3990) classifies load/import failures as `INVALID_RED (fixture_or_load_failure)` and requires a distinctly named target test failing on its assertion.
- **Fix:** Created `aquarelleSheetSignature.ts` as a stub returning a constant `0`, so the gate's discriminating tests fail on their own assertions ("expected +0 not to be +0"); the classifier returned `RED_EVIDENCE_OK`.
- **Files modified:** app/src/components/physic-paint/engine/aquarelleSheetSignature.ts (stub, replaced in GREEN)
- **Verification:** `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK (target_test_failed)`; the layer-contract run showed exactly one failing new pin with the 25 shipped pins green.
- **Committed in:** effd12afd (Task 1 RED)

**2. [Rule 3 - Blocking] Fixtures typed to the shipped `AquarelleToolOverrides` bag**
- **Found during:** Task 1 GREEN (typecheck)
- **Issue:** Four TS2353 errors: the test fixtures used `{ width, flow }` for `engine.toolOverrides`, but `AquarelleToolOverrides` requires exactly `{tip, aspect, rotation, sizeCurve, scatter, capacity, grain, wetRound}`.
- **Fix:** Added the full valid bag via an `overrides(tip)` helper and used a reverse-key-order copy to prove key-order invariance.
- **Files modified:** app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts
- **Verification:** `pnpm --filter efx-motion-editor typecheck` exit 0; 36 tests green.
- **Committed in:** 0788c4ccd (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were process/type-safety requirements of the enforced TDD gate and strict typecheck; no behavioral scope changed.

## Issues Encountered
- The first Task 2 RED evidence record classified as `INVALID_RED (invalid_record)`: vitest's `tap-flat` reporter emitted the multi-line comparator output as a YAML scalar with column-0 continuation lines, which the TAP parser read as non-TAP data. Resolved by having the two new/updated cases assert against the single-line `INVARIANT` line (`invariantLine` helper); the re-run classified `RED_EVIDENCE_OK` with no report errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 28 is the last of the four 2026-11-22 re-review gap-closure plans (IN-05 and IN-07 folded in per the artist's G-01 ruling); all 28 phase-64 plans are now executed.
- Automated verification complete: 36 app tests + typecheck green, 53 probe-harness tests green, no baseline edited, no other probe invariant or dispatch entry moved.
- Live visual UAT remains the phase verifier's call; this plan claims no UAT row (spec-less probe, all 76 edge rows stay `unclassified`).

---
*Phase: 64-medium-engine*
*Completed: 2026-11-22*

## Self-Check: PASSED
