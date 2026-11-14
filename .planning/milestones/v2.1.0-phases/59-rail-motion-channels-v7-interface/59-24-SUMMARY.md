---
phase: 59-rail-motion-channels-v7-interface
plan: 24
subsystem: persistence
tags:
  - canonical-revision
  - cross-language-parity
  - rust
  - golden-fixture
  - rail-motion
  - gap-closure
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-01
    provides: the cross-language golden fixture and the frozen project-equality literals
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-03
    provides: the rail-motions canonical term at its reserved ordinal
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-04
    provides: the Rust canonical rail-motion encoder and the TS half of the parity test
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-20
    provides: the removal transaction's mergedDrop report (kept on the move path)
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-22
    provides: the store's ownership authority and copy-payload changes this plan builds on
provides:
  - "`compareCanonicalIds` — one code-unit comparator used by all four canonical sorts (records, incoming breaks, rail motions, loop clips)"
  - "`RotoTrackCopyResult` = { ok: true; payload } and `RotoTrackClearResult` = { ok: true }; `RotoTrackPasteResult` keeps `mergedDrop` for `moveTrackItems`"
  - "A sixth golden document `rail-motion-ordering` freezing B/a and Rail_B/rail-a order in every sorted term"
  - "A fixture-shape guard asserting every Loop Clip in every golden document carries the explicit six-member persisted lifecycle block"
  - "Six-document name assertions in both the TypeScript and the Rust parity tests"
affects:
  - Phase 59 verification (REL-02 persistence identity)
  - Any future encoder touch — the comparator and the fixture shape are the cross-language contract
  - 59-25 is unaffected (no shared file)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized app/ diff)
actuals:
  tokens: 6350
  tasks: 2
  commits: 4
plan_head_before: 0c1c5bb56402a4bb24e868fbbf6dd3d1f204845e
plan_head_after: 8e122ac3d27e191770e343e268f12f0be7661cc5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - One canonical ordering law — every sorted collection delegates to one comparator that mirrors Rust's `str::cmp`
    - A cross-language fixture must be expressible in the shape BOTH encoders read; every clip carries the persisted lifecycle block explicitly
    - Result types carry only the members a production consumer reads

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-24-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-24-task2.json
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/lib/railMotionCanonicalParity.test.ts
    - app/src/lib/__fixtures__/railMotionCanonical.golden.json
    - app/src-tauri/src/services/script_library.rs

key-decisions:
  - "`compareCanonicalIds` is the single ordering authority: `left < right ? -1 : left > right ? 1 : 0`. For the ASCII id charset it is identical to Rust's `str::cmp` over UTF-8 bytes, so the two encoders cannot disagree."
  - "The comparator was applied to all FOUR sorts, including records and incoming breaks, not only the two named by WR-05 — the review proved the parser already uses code-unit order, so a partial fix would have left two sorts on collation."
  - "The ordering fixture's `Rail_B` record carries `position-x` AND `position-y` at frame 0: the motion model refuses a lone `position-x`, so the plan's literal single-channel shape is not a valid document."
  - "The fixture's two new clips are frozen in the explicit persisted lifecycle shape (`syncState` … `frameOverrides`) because the TS encoder resolves the block unconditionally while Rust emits it only when `syncState` is present — the same raw bytes must produce the same `loops:` term."
  - "`moveTrackItems` keeps reporting `mergedDrop`; cut and clear report nothing, matching the one production consumer (the strip's non-undoable merge notice)."

patterns-established:
  - "Cross-language comparator: one exported-in-file helper documented as matching the Rust authority, used by every canonical sort site."
  - "Fixture shape guard: a structural test walks every golden document and every Loop Clip, so a future lifecycle-less entry fails at the test rather than silently diverging at the Rust encoder."

requirements-completed:
  - MOTN-02
  - REL-02

coverage:
  - id: D1
    description: "Cut and clear results carry exactly the members a consumer reads ({ ok: true } and { ok: true; payload }), while a two-sided merge still removes the tail record from the stored collection and moveTrackItems still reports the drop."
    requirement: MOTN-02
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts#still drops the merged rail from the stored collection without reporting it from clearTrackFrames"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts#still drops the merged rail from the stored collection without reporting it from cutTrackSelection"
        status: pass
    human_judgment: false
  - id: D2
    description: "TypeScript and Rust order every canonical collection by byte value: the golden fixture's sixth document puts mixed-case ids in all four sorted terms and both parity tests recompute the same bytes."
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#orders every canonical collection by code unit for mixed-case ids"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#matches the frozen canonical source and project equality: rail-motion-ordering"
        status: pass
      - kind: other
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every Loop Clip in every golden document carries the complete six-member persisted lifecycle block, so the TS encoder's unconditional resolution and Rust's syncState-gated emission encode the same raw bytes."
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#freezes the explicit persisted lifecycle block on every fixture Loop Clip"
        status: pass
      - kind: other
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-07
status: complete
---

# Phase 59 Plan 24: Removal-Result Honesty and Cross-Language Canonical Ordering Summary

**Cut and clear stop reporting a merge drop nobody reads, and both canonical encoders now order every collection by code unit — pinned by a sixth golden document whose mixed-case ids would sort differently under collation.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-07T10:17:47Z
- **Completed:** 2026-11-07T10:23:40Z
- **Tasks:** 2
- **Files modified:** 6 plan files + 2 RED evidence records

## Accomplishments

- WR-02 closed: `RotoTrackCopyResult` is `{ ok: true; payload }`, `RotoTrackClearResult` is `{ ok: true }`; neither method spreads the removal's drop. `_applyRotoTrackSelectionRemoval` is unchanged and `moveTrackItems` still reports it — the only production consumer.
- WR-05 closed: `compareCanonicalIds` (`left < right ? -1 : left > right ? 1 : 0`) replaced the collation comparator at all four canonical sorts — records, incoming breaks, rail motions and loop clips. `localeCompare` count in the model is 0.
- The golden fixture gained `rail-motion-ordering` (sixth and last): records `B`/`a`, clips `Rail_B`/`rail-a`, rail motions `Rail_B`/`rail-a`, incoming breaks `B`/`a`. Every one of those pairs sorts the opposite way under ICU collation, so the entry fails on either divergence.
- Both new clips are frozen in the explicit persisted lifecycle shape; a new structural guard walks every Loop Clip of every fixture document and fails if any lifecycle member is missing (`syncState` count in the fixture is 5).
- Both languages assert six documents, and the Rust half recomputes source and project equality from the same bytes — `cargo test rail_motion_canonical_parity` passes on the new entry.
- The five pre-existing entries are structurally identical to the previous HEAD and their expected values are byte-identical; only the provenance line and the previously-last entry's trailing separator changed.

## Task Commits

Each task was committed atomically (RED then GREEN per task):

1. **Task 1: Cut and clear stop reporting a merge drop nobody reads**
   - `a345fa2d1` (test) — RED: exact key-surface assertions for both methods
   - `27f66e4ed` (feat) — GREEN: contracts trimmed, spreads deleted, comments corrected
2. **Task 2: One byte-order comparator and a mixed-case cross-language fixture**
   - `2c785f3d5` (test) — RED: ordering row, six-name assertion, fixture lifecycle-shape guard
   - `8e122ac3d` (feat) — GREEN: comparator at four sorts, sixth fixture entry, Rust six-name assertion

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

_Note: TDD tasks have two commits each (test → feat). RED evidence records are committed as `red-evidence-59-24-task{1,2}.json` next to the phase artifacts._

## Files Created/Modified

- `app/src/stores/physicPaintStore.ts` — `RotoTrackCopyResult`/`RotoTrackClearResult` lose `mergedDrop?`; the cut and clear conditional spreads are replaced by literal `{ ok: true, payload }` / `{ ok: true }`; the shared helper and the move spread untouched.
- `app/src/stores/physicPaintStore.rotoRailMotions.test.ts` — the two merge rows now assert the exact returned key sets plus every stored-collection assertion from before; control and fail-closed rows unchanged.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `compareCanonicalIds` added and used by all four canonical sorts.
- `app/src/lib/railMotionCanonicalParity.test.ts` — mixed-case ordering row, six-name assertion, fixture Loop Clip lifecycle-shape guard (plus the ordering document builders the generator reused).
- `app/src/lib/__fixtures__/railMotionCanonical.golden.json` — provenance extended, sixth `rail-motion-ordering` document appended, fully generated once from the post-fix TypeScript encoder.
- `app/src-tauri/src/services/script_library.rs` — parity test name vector and message moved to six documents; no sort function touched.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-24-task{1,2}.json` — the two machine-validated RED records (TAP reports embedded).

## Decisions Made

- One comparator, all four sorts. WR-05 named the rail-motion and loop-clip sorts, but the review's own evidence (`railMotionModel.ts`, `railMotionIdentity.ts` already use `<`/`>`) shows a partial fix would leave two sorts on collation; every canonical id sort now delegates.
- Comparator is module-private with a doc comment naming Rust's `str::cmp` as the authority; the retired collation API name appears nowhere in the model (grep count 0).
- `moveTrackItems` untouched: it is the only path whose result reaches a consumer (`PhysicsPaintWorkflowStrip.tsx:3926`), so the drop report and its strip source pins stay green.
- The fixture's new clips are explicitly lifecycle-complete rather than lifecycle-less. The TS encoder resolves the block unconditionally, Rust emits it only under `syncState`; a lifecycle-less entry would make the Rust recomputation diverge on the `loops:` term.
- The provenance line names what moved (TypeScript ordering) and why (match Rust `str::cmp`) plus the persisted-shape reason, so a future reader can audit the regeneration without consulting this summary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's literal single `position-x` channel is not a valid motion record**
- **Found during:** Task 2 (RED — the ordering row threw before it could assert)
- **Issue:** The plan specifies `Rail_B` "with one `position-x` key at frame 0 value 0". The motion model's canonicalizer refuses a lone `position-x`: "position-x and position-y must both be present or both absent".
- **Fix:** `Rail_B` carries `position-x` and `position-y` at the same frame 0 with value 0, satisfying the paired-axis law while keeping the plan's named channel. The intent of the row (mixed-case rail ids in the rail-motions term) is unchanged.
- **Files modified:** `app/src/lib/railMotionCanonicalParity.test.ts`, `app/src/lib/__fixtures__/railMotionCanonical.golden.json`
- **Verification:** The ordering row and the frozen literal both pass; the Rust recomputation matches.
- **Committed in:** `2c785f3d5` (test), `8e122ac3d` (fixture + encoder)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is a two-line channel pair inside one fixture record; no plan contract, ordering assertion or encoder behavior changed.

## Issues Encountered

- **RED evidence report format.** The project's `tap` reporter emits nested `{ … }` subtest blocks that the evidence classifier rejects, and the `tap-flat` reporter still broke on multi-line YAML failure payloads (an array diff and a `toEqual` of an object with a nested object). Resolved without editing any report: the names assertion now compares a joined string, and the clear row asserts key absence before the deep-equal, so every failure message during RED is single-line. Two `RED_EVIDENCE_OK` verdicts were then recorded (TAP, zero report errors).
- **Plan verification literal vs. TypeScript quoting.** The plan's `grep -c '"rail-motion-ordering"'` criterion returns 0 for `railMotionCanonicalParity.test.ts` because that file's literals are single-quoted; the name IS asserted there (twice: the six-name list and the ordering-document lookup). The fixture and `script_library.rs` match the double-quoted literal. No code change made to satisfy a quoting artifact.

## TDD Gate Compliance

Both tasks carry `tdd="true"` and are behavior-adding. RED was committed before each implementation and validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (`target_test_failed`, TAP format, zero report errors):

- Task 1 — `red-evidence-59-24-task1.json`: 20 tests collected, 2 fail, both the planned merge rows; the named target failed on `expect('mergedDrop' in result).toBe(false)` for `clearTrackFrames`.
- Task 2 — `red-evidence-59-24-task2.json`: 11 tests collected, 3 fail (ordering row, six-name assertion, lifecycle guard); the named target failed on `expected 140 to be less than 10` — collation put `a` before `B`.

No GREEN commit precedes its RED commit.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts src/lib/railMotionCanonicalParity.test.ts` — 2 files, 32 tests passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity -- --nocapture` — 3 tests passed (parity, reserved-ordinal, malformed-rejection).
- `pnpm --filter efx-motion-editor exec vitest run` (full suite) — 395 files passed, 2 skipped; 7887 tests passed, 1 skipped, 96 todo.
- `pnpm --filter efx-motion-editor run typecheck` — clean.
- `grep -c "localeCompare" app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` → 0; `grep -c "compareCanonicalIds"` → 5 (1 definition + 4 call sites).
- `grep -c "\.\.\.(removed\.mergedDrop !== null" app/src/stores/physicPaintStore.ts` → 1 (the move path); `grep -c "mergedDrop?: RotoTrackMergedDrop }"` → 1 (the paste result).
- `grep -c '"syncState"' app/src/lib/__fixtures__/railMotionCanonical.golden.json` → 5.
- Structural `git show` node gate → `STRUCTURAL GATE OK {priorStable: true, six: true, priorDocs: 5}` (run before the task commit, HEAD was the pre-change baseline).
- `git status --short -- app/src/lib` lists no generator file; the temporary generator was deleted after one run.

## Known Stubs

None.

## Threat Surface Scan

No new surface beyond the plan's `<threat_model>`. T-59-63 (result-contract dead surface) is closed by deleting the unreachable members and pinning the exact returned keys; T-59-64 (ordering divergence) is closed by the single comparator plus the mixed-case fixture recomputed in both languages; T-59-65 (fixture provenance/regeneration) is covered by the provenance line and the `git show HEAD` structural gate; T-59-68 (fixture lifecycle shape) is covered by the explicit block on both new clips and the structural guard over every fixture Loop Clip.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REL-02 persistence identity now holds across languages for every accepted rail/key id charset; a future encoder change has one comparator and one fixture shape to honour.
- 59-25 does not touch any file in this plan; the two are independent within wave 2.
- Live UAT is unaffected: this plan changes persistence identity and a dead result member only, with no visible surface.

## Self-Check: PASSED

- All 6 plan files exist on disk and are committed.
- Commits `a345fa2d1`, `27f66e4ed`, `2c785f3d5`, `8e122ac3d` are ancestors of HEAD.
- Both RED evidence records present as `red-evidence-59-24-task{1,2}.json`; both validated `RED_EVIDENCE_OK`.
- The temporary fixture generator does not survive in the tree.

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-07*
