---
phase: 59-rail-motion-channels-v7-interface
plan: 04
subsystem: persistence
tags: [rust, typescript, canonical-hash, cross-language-parity, golden-fixture, rail-motion, tdd, motn-12, rel-02]

# Dependency graph
requires:
  - phase: 59-01
    provides: "Reserved rail-motions canonical ordinal and the shared golden-fixture parity harness"
  - phase: 59-02
    provides: "PhysicPaintRotoRailMotionRecord model, five-channel union and fail-closed validation vocabulary"
  - phase: 59-03
    provides: "Conditional TypeScript rail-motions canonical term and the record/channel/key byte format"
provides:
  - "Rust canonical_rail_motions reproduces the TypeScript rail-motions byte format at the reserved ordinal (`loops:` < `rail-motions:` < `incoming-breaks:`)"
  - "Fail-closed Rust validation: caps 512/5/4096, bounded ids, channel union, ascending integer frames, domain-valid values, hold|ease, non-negative wiggle, grouped Position pairing"
  - "Five-document cross-language golden fixture asserted by both languages (expectedSource + expectedProject)"
  - "Empty railMotions byte-identical to the untouched pre-Phase-59 document (physical-298-91cccaed / project-365-dc29ff63)"
  - "Guard-path acceptance of the reveal railKind + railMotions combination that motivated the phase"
affects: [59-07, 59-08, 59-14, 59-15, "every future canonical term addition"]

actuals:
  tokens: 12353
  tasks: 2
  commits: 3

plan_head_before: 6c5498e9ed0538131b2224d1d418f7b001f3593c
plan_head_after: f67f9b7a69823574ad620a100959d02e24a77820

tech-stack:
  added: []
  patterns:
    - "Cross-language collection encoder: Rust sorts by railId with String::cmp matching TS localeCompare on the bounded UUID alphabet, canonicalizes channel order, then builds bytes only after every record validates"
    - "Fail-closed untrusted collection: a present non-array member is an error, absent maps to an empty slice — absent stays distinguishable from malformed"
    - "Ordinal asserted on the computed source, never only on the fixture literal, so a wrong-branch insertion fails even if the fixture were regenerated"
    - "Term elision for empty collections: absent and [] contribute zero bytes, proven against a frozen pre-change revision literal"

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-04-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-04-task1.xml
  modified:
    - app/src-tauri/src/services/script_library.rs
    - app/src/lib/__fixtures__/railMotionCanonical.golden.json
    - app/src/lib/railMotionCanonicalParity.test.ts

key-decisions:
  - "A present non-array railMotions returns a closed Err instead of taking the plan snippet's `.and_then(Value::as_array)` silent-skip path; the plan's own prohibition and T-59-12 require fail-closed, so absent and malformed stay distinct"
  - "Rust canonicalizes channels into the fixed position-x/position-y/scale/rotation/opacity order rather than trusting input order, matching the TS writer's guarantee"
  - "The rail-motion and rail-motion-empty entries were appended from the TypeScript authority AFTER the Rust encoder landed; the three 59-01 entries were not regenerated and their expected literals did not move, per the carry-over rule"
  - "rail-motion-empty is pinned byte-identically to untouched on source, project AND revision (physical-298-91cccaed), proving the D-29 conditional-term law at the fixture level"
  - "Requirements left pending, matching the 59-02/59-03 precedent: MOTN-12 also requires per-key persistence/undo work (59-03, 59-15); REL-02 is already complete from 59-01 and is re-proven here without a false flip"

patterns-established:
  - "Every additive canonical term lands twice: a TS encoder + fixture authority, then a Rust mirror that must reproduce the same bytes before the native guard can accept motion-bearing edits"
  - "Malformed-input rejection is asserted to fire BEFORE the guard's hash comparison, so users never receive a misleading 'does not match' message for a structurally invalid document"
  - "Collection limits are checked before any output byte is written (deterministic error ordering)"

requirements-completed: []

coverage:
  - id: D1
    description: "Rust canonical_rail_motions emits the TypeScript byte format at the reserved ordinal, conditional on a non-empty collection"
    verification:
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml canonical_rail_motions -- --nocapture#services::script_library::tests (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed motion fails closed with a field-naming error and no panic: caps, duplicate railId, unknown/empty channel, non-ascending frames, domain values, easing, wiggle, grouped Position pairing"
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/script_library.rs#canonical_rail_motions_rejects_each_malformed_case (14 cases)"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/script_library.rs#rail_motion_canonical_parity_rejects_malformed_motion_before_the_guard_compares"
        status: pass
    human_judgment: false
  - id: D3
    description: "Five frozen cross-language documents; both languages assert expectedSource and expectedProject; the empty collection is byte-identical to untouched"
    verification:
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity -- --nocapture#3 tests"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#9 tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Guard accepts the combined reveal railKind + railMotions document and the ordinal is asserted on the Rust-computed source"
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/script_library.rs#rail_motion_canonical_parity_emits_the_motion_term_at_the_reserved_ordinal"
        status: pass
    human_judgment: false

duration: ~6min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 04: Rust Rail-Motion Canonical Mirror Summary

**Rust now reproduces the TypeScript `rail-motions:` canonical term byte-for-byte at the reserved ordinal, fails closed on malformed motion, and both encoders share a five-document golden fixture.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-06T13:39:49Z
- **Completed:** 2026-11-06T13:46Z
- **Tasks:** 2
- **Files modified:** 5 (1 Rust service module, 1 golden fixture, 1 TypeScript parity test, 2 RED evidence records)

## Accomplishments

- `canonical_rail_motions` mirrors the TypeScript encoder exactly: records sorted by `railId` (Rust `String::cmp` equals TS `localeCompare` on the lower-case-hex-and-hyphen alphabet), channels canonicalized into the fixed five-channel order, keys frame-ascending, byte primitives reused from the existing `canonical_string` / `canonical_number` helpers.
- The term is emitted exactly once, between `loops:` and `incoming-breaks:`, and only when the collection is non-empty. The untouched document keeps its frozen `physical-298-91cccaed` / `project-365-dc29ff63` values, proving no existing project value moves.
- Validation fails closed with field-naming errors for non-array input, more than 512 records, duplicate `railId`, unknown or empty channels, more than five channels, more than 4096 keys, non-ascending or non-integer frames, out-of-domain values per channel, invalid easing, negative wiggle, and unpaired/mismatched Position axes. No panic path and no silent skip.
- The five-document golden fixture (`rail-kind`, `untouched`, `rail-kind-script`, `rail-motion`, `rail-motion-empty`) is the single cross-language authority: both suites compare the full source string and the project hash, not only the hash.
- The ordinal assertion runs against the RUST-computed source, so inserting the term in the wrong branch of `canonical_physical_source` fails even if the fixture were accidentally regenerated.
- The guard's recompute-and-compare path accepts the exact combination this phase repairs: a Loop Clip with `railKind: 'reveal'` AND a motion-bearing rail.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing rail-motion canonical pins** - `305517bac` (test)
2. **Task 1 GREEN: mirror the rail-motion canonical term in Rust** - `389af0531` (feat)
3. **Task 2: pin the motion fixture, ordinal and fail-closed rejection** - `f67f9b7a6` (test)

**Plan metadata:** `docs(59-04): complete rust rail-motion canonical mirror plan` (final commit)

_Note: Task 1 is `tdd="true"` and therefore committed RED then GREEN; Task 2 is a plain `type="auto"` task with one commit._

## RED Evidence

Task 1 was validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (`target_test_failed`, JUnit format, zero report errors):

| Task | Tests | Target test | Outcome |
|------|-------|-------------|---------|
| 1 | 5 tests, 1 pass / 4 fail | `canonical_rail_motions_emits_the_typescript_byte_format` | the canonical source carried no `rail-motions:` term; the pin failed on its planned assertion, not on a build/import fault |

Command: `cargo test --manifest-path app/src-tauri/Cargo.toml canonical_rail_motions -- --nocapture`, exit 101. Cargo/libtest has no JUnit reporter and the classifier has no cargo adapter, so the real libtest output was translated faithfully into JUnit (raw log embedded as `consoleOutput`; conversion method documented in the record).

## Files Created/Modified

- `app/src-tauri/src/services/script_library.rs` — `canonical_rail_motions` plus caps, channel union, domain and grouped-Position validation; the fail-closed `railMotions` read in `canonical_physical_source`; the term wired after `loops:` and before `incoming-breaks:`; 5 unit tests for the encoder/validator and 3 parity/guard/rejection tests.
- `app/src/lib/__fixtures__/railMotionCanonical.golden.json` — appended `rail-motion` (reveal clip + one motion record with all five channels, mixed hold/ease, non-zero wiggle, one incoming break) and `rail-motion-empty` (`railMotions: []`, byte-identical to `untouched`); extended the provenance note; the three 59-01 entries were not regenerated.
- `app/src/lib/railMotionCanonicalParity.test.ts` — five-name assertion, motion-term ordinal/exactly-once pin, empty-collection byte identity on source, project and revision.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-04-task1.json` and `red-evidence/red-59-04-task1.xml` — the validated RED record and its JUnit report.

## Decisions Made

- **Present non-array `railMotions` is an error, not an empty collection.** The plan's action snippet used `.and_then(Value::as_array)` with `None => empty`, which would silently treat a malformed member as absent — contradicting the plan's own prohibition and T-59-12. Absent stays `NULL => &[]`; a present non-array returns `Err("Target physical document railMotions is malformed")`. Documented as a deviation below.
- **Channel order belongs to the encoder, not the caller.** Records are written in the fixed `position-x, position-y, scale, rotation, opacity` order regardless of input order, so Rust matches the TS writer even when a caller passes channels differently ordered.
- **Fixture generation order honored.** The two new entries were produced once from the TypeScript authority through `parsePhysicPaintRotoPhysicalDocument` after the Rust encoder landed; expected literals were frozen and the pre-existing literals were verified unchanged. No failing fixture was regenerated.
- **Requirements left pending.** MOTN-12 ("persists through save → close → reopen, with undo/redo per key operation") is only partially delivered here: 59-03 landed persistence and 59-15 owns undo/redo. REL-02 is already complete from 59-01; this plan adds the native half of the cross-language enforcement but does not need a second flip. Following the 59-02/59-03 precedent, `requirements-completed` stays empty rather than falsely checking MOTN-12.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] A present non-array `railMotions` now fails closed**
- **Found during:** Task 1 (wire-in)
- **Issue:** The plan's action text instructed `object.get("railMotions").and_then(Value::as_array)` with `None` mapping to an empty slice. That makes a malformed (non-array) collection indistinguishable from an absent one and silently skips the term, violating the plan's prohibition ("MUST NOT let Rust silently skip an unparseable rail-motions collection; the guard must fail closed") and T-59-12.
- **Fix:** explicit match — absent maps to `&[]`, a present value must be an array or the canonical source returns `Err("Target physical document railMotions is malformed")`.
- **Files modified:** `app/src-tauri/src/services/script_library.rs`
- **Verification:** the 14-case malformed table and the guard-path rejection test both assert closed errors; no silent-skip path remains.
- **Committed in:** `389af0531` (Task 1 GREEN)

### Process deviations

**2. RED evidence format required a faithful JUnit translation**
- Cargo/libtest emits no JUnit; the RED classifier has no cargo adapter. The real libtest run was translated into JUnit by a temporary script (not committed), with the raw log embedded as `consoleOutput` and the method recorded in the evidence record's `conversion` field. `gsd_run check tdd-red-evidence` then returned `RED_EVIDENCE_OK`.

**3. Fixture field naming follows the established schema**
- The plan's artifacts table mentions `expectedProjectHash`; the existing 59-01 fixture schema uses `expectedProject` and both suites already consume it. Kept the established field so TS and Rust share one authority without a schema fork.

**Total deviations:** 1 auto-fixed (Rule 2) + 2 process notes. **Impact on plan:** no behavioral scope change. The Rule 2 fix is required by the plan's own prohibition; the fixture and test keys match the existing cross-language contract.

## Issues Encountered

- The first JUnit conversion over-captured panic blocks from adjacent parallel tests; the converter was narrowed to line-based panic blocks that stop at blank/`test `/`thread '`/`note: run` boundaries. The rerun produced the exact 5-test/1-pass/4-fail record accepted by the classifier.
- No production issues: the GREEN encoder passed its suite on the first run after RED validation, and both parity suites agree on all five documents.

## Threat Surface Scan

The plan's threat register is fully mitigated. T-59-10: the shared five-document fixture asserts full source and project equality in both languages, and the ordinal is asserted on the Rust-computed source. T-59-11: the 512/5/4096 caps, bounded ids and finite checks all run before any output byte is built. T-59-12: malformed input returns a closed `Err` naming the field; dedicated tests prove no panic and no silent skip, and the rejection fires before the guard's comparison. T-59-SC: no install occurred — `app/package.json` and `app/src-tauri/Cargo.toml` dependency sections are unchanged. No new network endpoint, auth path or schema change at a trust boundary was introduced; the only new surface is the native parser now treating `railMotions` as untrusted JSON, which it rejects fail-closed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The native physical-edit guard now accepts motion-bearing documents from TypeScript, so the runtime apply path no longer rejects the exact reveal + motion combination that motivated Phase 59.
- 59-07 and later plans can rely on the canonical term order and byte format being enforced on both sides; 59-08's flattened cache key sits above a canonical revision that already carries motion.
- The golden fixture is frozen with five documents; any future canonical term addition must append new entries and prove the pre-existing literals have not moved, per the provenance note.
- Verification at HEAD: Rust parity 3/3 pass, Rust encoder suite 5/5 pass, full `cargo test` exit 0 (116 lib + 20 + 39 + 4 + 21), TypeScript parity 9/9 pass, full vitest 381 files / 7511 tests passed (2 files skipped, 1 test skipped, 96 todo), typecheck exit 0, no dependency changes.
- No blockers.

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- `59-04-SUMMARY.md`, both RED evidence records, the Rust service module, the golden fixture and the TS parity test exist at the recorded paths.
- Commits `305517bac`, `389af0531` and `f67f9b7a6` are ancestors of `HEAD`.
- Targeted verify at HEAD: Rust parity 3/3, Rust encoder suite 5/5, TS parity 9/9; full cargo suite exit 0; full vitest 381 files / 7511 passed; typecheck exit 0; dependency files unchanged.

