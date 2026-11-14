---
phase: 59-rail-motion-channels-v7-interface
plan: 01
subsystem: persistence
tags: [rust, typescript, canonical-hash, cross-language-parity, golden-fixture, railKind, rel-02]

# Dependency graph
requires: []
provides:
  - "Rust canonical_loop_clips emits the railKind term at the TypeScript ordinal (repairs the Phase 52-01 divergence)"
  - "pub(crate) canonical_physical_source — a comparable canonical string with a documented additive term order"
  - "Frozen cross-language golden fixture consumed by both suites (expectedSource + expectedProject)"
  - "Ratified Gate A–D answers and the five research open-question resolutions (plan body)"
affects: [59-02, 59-03, 59-04, 59-07, 59-14, 59-15, "every future canonical term addition"]

actuals:
  tokens: 5534
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Shared golden fixture as the single cross-language canonical authority (frozen literals, never regenerated to green a test)"
    - "Source-level parity comparison: a term-order regression names the offending term instead of an opaque hash"

key-files:
  created:
    - app/src/lib/__fixtures__/railMotionCanonical.golden.json
    - app/src/lib/railMotionCanonicalParity.test.ts
  modified:
    - app/src-tauri/src/services/script_library.rs
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts

key-decisions:
  - "railKind is emitted conditionally (present only), immediately after `mode` and before the scriptId block — the exact TypeScript ordinal"
  - "The golden fixture was produced ONCE from the TypeScript encoder with all three documents and committed with frozen literals; it is never regenerated to make a parity test pass"
  - "canonical_physical_hash was split into canonical_physical_source + hash as a pure extraction, so both suites can diff the source term-by-term"
  - "The rail-motions ordinal is reserved in comments in both encoders but not emitted by this plan, so no existing project value moves"
  - "The lifecycle-less document is a TypeScript-only pin: Rust receives the normalized persisted shape and must not be taught a path that never reaches it"

requirements-completed: [REL-01, REL-02]

coverage:
  - id: D1
    description: "Rust accepts a railKind-bearing physical document: canonical_loop_clips emits the railKind term and recomputes the same project equality as TypeScript"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity (services::script_library::tests::rail_motion_canonical_parity)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One frozen golden fixture (untouched, rail-kind, rail-kind-script) pins expectedSource and expectedProject in both languages"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#matches the frozen canonical source and project equality"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity (include_str! of the same fixture)"
        status: pass
    human_judgment: false
  - id: D3
    description: "canonical_physical_source extraction plus a documented additive term order with the rail-motions ordinal reserved in both encoders"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml services::script_library (16 passed, including the TS reference vectors in tests/script_library_transaction_contract.rs)"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#normalizes a lifecycle-less finite clip to its explicit lifecycle project equality"
        status: pass
    human_judgment: false
  - id: D4
    description: "No runtime dependency added (REL-01)"
    requirement: REL-01
    verification:
      - kind: other
        ref: "git diff -- app/package.json app/src-tauri/Cargo.toml (0 lines)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 01: Canonical Parity Harness Summary

**Repaired the unrepaired Phase 52-01 `railKind` divergence in Rust and pinned the full TS↔Rust canonical term order with one frozen cross-language golden fixture.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-11-06T11:57Z
- **Completed:** 2026-11-06T12:04Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Rust `canonical_loop_clips` now emits the `railKind` discriminator at the identical TypeScript ordinal (after `mode`, before the `scriptId` block, only when present). Every reveal/playscript clip previously produced a different project equality, so the physical-edit guard rejected the request with "Target physical hash does not match the canonical physical document".
- `app/src/lib/__fixtures__/railMotionCanonical.golden.json` freezes three documents (`rail-kind`, `untouched`, `rail-kind-script`) with `expectedSource` and `expectedProject` literals produced once from the TypeScript authority. Both suites consume the same bytes: TS through `readFileSync`, Rust through `include_str!`.
- `canonical_physical_hash` was split into `pub(crate) canonical_physical_source` + hash (pure extraction). Both suites now compare the canonical SOURCE first, so a term-order regression names the offending term instead of only moving an opaque hash.
- The additive term order (`records`, `group-overrides`, `interpolation`, `mode`, `loops`, `rail-motions`, `incoming-breaks`, `capacity`, `motion`, `background`, `selection`, `cursor`) is documented in both encoders, with the `rail-motions` ordinal reserved but not emitted.
- Gates A–D and the five research open-question resolutions are ratified in the plan body and are binding for plans 59-02…59-16.

## Task Commits

Each task was committed atomically. Task 1 followed the RED → GREEN cycle:

1. **Task 1 (RED): add failing cross-language canonical parity pin** - `3bdb1e690` (test)
2. **Task 1 (GREEN): mirror the railKind canonical term in Rust** - `55cd909cb` (feat)
3. **Task 2: extract canonical source and pin the full term order** - `a14b43c9f` (refactor)

**Plan metadata:** `docs(59-01): complete canonical parity harness plan` (final commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## RED Evidence

- **Command:** `cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity -- --nocapture`
- **Exit code:** 101
- **Target test:** `services::script_library::tests::rail_motion_canonical_parity`
- **Output:** `assertion left == right failed: rail-kind: recomputed project equality diverged from the TS authority / left: "project-485-45d3c45" / right: "project-495-7dde2bca"`
- **Semantic assessment:** the named target test compiled, executed, and failed on its assertion for the intended reason (the missing `railKind` term changes the canonical source). Not a build failure, not zero-test discovery, not an unrelated assertion.
- **TS half at RED:** `railMotionCanonicalParity.test.ts` already passed (4 tests) — TypeScript is the authority; only Rust had drifted.

## Files Created/Modified

- `app/src-tauri/src/services/script_library.rs` — `railKind` term at the TS ordinal; `pub(crate) canonical_physical_source` extraction with the documented additive term order; reserved `rail-motions` ordinal; Rust half of the parity pin via `include_str!`.
- `app/src/lib/__fixtures__/railMotionCanonical.golden.json` — frozen cross-language authority with three documents, `expectedSource` and `expectedProject` literals, and a provenance note forbidding regeneration-to-green.
- `app/src/lib/railMotionCanonicalParity.test.ts` — TS half of the parity pin (source + project for all three documents) plus the lifecycle-normalization regression pin.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — additive term-order comment above `encodeValidatedPhysicPaintRotoPhysicalContent`, reserved `rail-motions` ordinal marker, and `buildPhysicPaintRotoProjectEqualitySource` (pure extraction; `buildPhysicPaintRotoProjectEquality` is its fingerprint).

## Decisions Made

- Used the TypeScript encoder as the sole authority to generate the fixture once; the Rust side was then changed to match. No fixture value was recomputed after the Rust fix.
- Kept the Rust lifecycle block's presence logic untouched: persisted documents reach Rust normalized, so only the Rust test gains a normalized fixture (the lifecycle-less shape stays a TS-only pin).
- Two requirements were deliberately not marked complete: **MOTN-12** is claimed by this plan's frontmatter but no motion record exists yet in this plan — it is delivered by plans 59-02/03/04/07/14/15 and was left unchecked rather than falsely flipped. REL-01 and REL-02 were marked complete (dependency diff empty; parity pinned by a test).

## Deviations from Plan

### Process deviations (no code impact)

**1. The golden fixture was generated once with all three documents in the Task 1 commit**
- **Found during:** Task 1 (fixture generation)
- **Issue:** Task 1 specified a fixture whose first entry is `rail-kind`; Task 2 extended it with `untouched` and `rail-kind-script`.
- **Resolution:** The generator ran ONCE and froze all three literals; Task 1 pinned `rail-kind` only (assertions), Task 2 extended both suites to all three entries and to `expectedSource`. Regenerating the fixture in Task 2 would have violated the plan's own prohibition ("never regenerate a failing cross-language golden fixture from the code under test").
- **Files modified:** `app/src/lib/__fixtures__/railMotionCanonical.golden.json`
- **Verification:** `git diff 8068ac89..HEAD -- app/src/lib/__fixtures__/railMotionCanonical.golden.json` shows a single creation; both suites pass against the same bytes.

**2. `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` was modified although it is not in `files_modified`**
- **Found during:** Task 1 (source accessor) and Task 2 (term-order comment)
- **Issue:** Task 2 explicitly requires the term-order comment above `encodeValidatedPhysicPaintRotoPhysicalContent`, and the acceptance criterion requires both suites to assert `expectedSource` — the TypeScript encoder did not expose a source-level accessor.
- **Resolution:** Added `buildPhysicPaintRotoProjectEqualitySource` as a pure extraction (`buildPhysicPaintRotoProjectEquality` delegates to it) plus the comment block.
- **Verification:** the two existing pinned project hashes in `src/types/physicPaint.test.ts` (`project-598-5cf0b794`, `project-305-ed764eca`) still pass, proving no byte moved.
- **Committed in:** `a14b43c9f`

**3. MOTN-12 left unchecked**
- **Found during:** State updates
- **Issue:** The plan frontmatter lists MOTN-12 (motion persists through save → close → reopen), but this plan adds no motion record.
- **Resolution:** Only REL-01 and REL-02 were marked complete; MOTN-12 remains pending for the plans that actually deliver persistence.

**Total deviations:** 3 process deviations (0 auto-fixes). **Impact on plan:** none on behavior — the delivered canonical bytes are exactly the planned term order.

## Issues Encountered

- None. The `railKind` fix landed in one edit and the source-level parity comparison matched on the first post-fix run.

## Threat Surface Scan

The plan's threat register is fully mitigated: T-59-01 (shared fixture + identical ordinal), T-59-02 (frozen literals + provenance note), T-59-03 (dependency diff is empty), T-59-SC (no installs). No new network endpoint, auth path, or trust-boundary surface was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The canonical parity harness is green end-to-end (TS → frozen fixture → Rust) for three documents, including a full `scriptId` + lifecycle clip.
- Plan 59-02 (and every later encoder change) can add terms at the reserved ordinal; the fixture will name any divergence at the source level.
- `cargo test --manifest-path app/src-tauri/Cargo.toml services::script_library` (16 passed), `cargo test --test script_library_transaction_contract` (21 passed), the full vitest suite (376 files / 7352 tests), and `pnpm typecheck` all pass.
- No blockers.

---

*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Fixture, TS parity test, Rust encoder, and TS model files all exist at the recorded paths.
- Commits `3bdb1e690`, `55cd909cb`, and `a14b43c9f` are ancestors of `HEAD`.
