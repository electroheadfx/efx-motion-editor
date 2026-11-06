---
phase: 59-rail-motion-channels-v7-interface
plan: 02
subsystem: model
tags: [typescript, pure-model, validation, rail-motion, reducer, tdd, d-12, d-15]

# Dependency graph
requires:
  - phase: 59-01
    provides: "Reserved rail-motions canonical ordinal and the cross-language parity harness that later consumes this collection"
provides:
  - "The single rail-motion type authority: PhysicPaintRotoRailMotionRecord/Channel/Key plus the five-channel union and the edit union"
  - "Value domains and the px/percent/degrees/no-wrap UI conversion pair (D-09)"
  - "canonicalizeRailMotionChannels with the grouped Position pairing invariant (D-11, D-12)"
  - "Fail-closed parsePhysicPaintRotoRailMotions with T-59-04/05/06 caps, allowlists and field-naming errors"
  - "Frozen shared empty constant PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY (the zero-byte REL-02 representation)"
  - "createPhysicPaintRotoRailId: a rail identity namespace separate from drawing-key identity"
  - "applyRailMotionEditToCollection: animate / set-key / remove-key / add-channel / remove-channel with D-04 idempotence and the D-15 removal cascade"
affects: [59-03, 59-05, 59-06, 59-07, 59-10, 59-12, 59-16]

actuals:
  tokens: 15814
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Pure model module with module-local guards: no import of physicsPaintRotoPhysicalModel.ts, so 59-03 can import this module without a cycle"
    - "Fail-closed parser with exact allowlists, bounded ids and count caps enforced before validation work; no silent clamp/drop/repair"
    - "Canonical collection helper sorts records by railId and channels by the fixed order, then deep-freezes; every edit path returns through it"
    - "Quiet no-op vs throw split: unknown rail/channel/key targets return the same reference (stale UI reads), invalid values/channels/frames throw for the store to refuse"

key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionModel.ts
    - app/src/components/physic-paint/roto/railMotionModel.test.ts
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-02-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-02-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-02-task3.json
  modified: []

key-decisions:
  - "Module-local guards (isRecord, allowlists, id/frame/wiggle guards) rather than importing physicsPaintRotoPhysicalModel.ts: 59-03 imports this module, so a shared import would create a cycle"
  - "set-key carries an optional pairedValue for grouped Position inserts; when absent the sibling key step-holds its outgoing value. 59-12 can supply the evaluator-derived sibling value so inserting an X key never snaps Y"
  - "Grouped Position edits always address both axes in one edit: set-key writes both, remove-key removes the frame from both, add-channel seeds both, remove-channel removes the pair"
  - "The parser rejects duplicate frames but sorts keys before freezing: 'strictly ascending' is the canonical output invariant, so input order is irrelevant"
  - "Grouped Position add/remove treats either axis as the whole lane: adding or removing position-x and position-y is one grouped operation (D-11/D-12)"
  - "Requirement IDs MOTN-02/03/09/12 were left pending, matching the 59-01 precedent: the model layer is complete, but the user-facing animate, persistence wiring and evaluation land in 59-03/05/12 and only UAT can close them"

patterns-established:
  - "Rail-motion canonicalization: fixed channel order, frame-ascending keys, deep freeze, railId-sorted records"
  - "Reducer change detection by reference: every successful edit returns a new canonical collection; no-op paths return the input reference"

requirements-completed: []

coverage:
  - id: D1
    description: "Five-channel union, fixed canonical order and the px/percent/degrees/no-wrap UI conversions"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#rail motion channel union + rail motion value domains + rail motion UI conversions"
        status: pass
    human_judgment: false
  - id: D2
    description: "canonicalizeRailMotionChannels sorts, deep-freezes and enforces the grouped Position pairing (D-12)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#canonicalizeRailMotionChannels (9 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fail-closed parser: caps, allowlists, bounded ids, frame/value/easing/wiggle domains, duplicate rejection, canonical frozen output"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#parsePhysicPaintRotoRailMotions (22 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rail-id mint seam returns a fresh v4 UUID per call"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#createPhysicPaintRotoRailId"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pure edit reducer: animate identity seed and D-04 idempotence, grouped set-key, D-15 cascade, add-channel identity seeds"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#applyRailMotionEditToCollection (17 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No document/allowlist coupling, no store/DOM/React import and no runtime dependency (REL-01)"
    verification:
      - kind: other
        ref: "grep -rn PhysicPaintRotoScriptMotionSettings railMotionModel.ts -> no match; git diff -- app/package.json empty"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 02: Rail Motion Model Summary

**Pure rail-motion model: five-channel union, fail-closed persisted-shape parser, and the D-15 edit reducer, with no document wiring yet.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-11-06T12:05Z
- **Completed:** 2026-11-06T12:17Z
- **Tasks:** 3
- **Files modified:** 2 source files (both created), plus three RED evidence records

## Accomplishments

- One type authority now exists for every later surface: `PhysicPaintRotoRailMotionRecord { railId, anchorKeyId, channels }`, five model channels (`position-x`, `position-y`, `scale`, `rotation`, `opacity`), the `hold | ease` easing union, and the edit union. No document allowlist, revision or canonical term is touched — 59-03 lands those atomically.
- `parsePhysicPaintRotoRailMotions` is fail-closed on every persisted-shape rejection the threat register names: non-array, 513 records, duplicate railId, unknown record/channel/key members, empty channels/keys, >5 channels, >4096 keys, invalid frame/easing/wiggle, out-of-domain values, duplicate channel ids/frames, and the lone/mismatched Position axis. Every message starts with `PhysicPaintRotoRailMotions:` and names the offending field.
- `canonicalizeRailMotionChannels` is the single canonical-order authority: fixed channel order, frame-ascending keys, deep freeze, input never mutated or reused.
- `applyRailMotionEditToCollection` implements `animate`, `set-key`, `remove-key`, `add-channel`, `remove-channel` as pure edits: animate is idempotent by reference and seeds only the Position pair at the edit frame (D-04), set-key never auto-creates a record or channel (D-08), and removal cascades key → channel → record (D-15), returning the shared frozen empty constant when the last record goes.
- `createPhysicPaintRotoRailId` is a one-line `crypto.randomUUID()` seam, deliberately separate from `createPhysicPaintRotoKeyId` so rail identity and drawing-key identity remain distinguishable namespaces.

## Task Commits

Each task followed the RED → GREEN cycle:

1. **Task 1 RED: add failing rail motion model pins** - `86ca3f2a9` (test)
2. **Task 1 GREEN: implement rail motion domains and canonical channel order** - `c61b9e07c` (feat)
3. **Task 2 RED: add failing rail motion parser and mint pins** - `94cf4f917` (test)
4. **Task 2 GREEN: implement fail-closed rail motion parser and rail-id mint** - `8d3778151` (feat)
5. **Task 3 RED: add failing rail motion reducer pins** - `fb5751edc` (test)
6. **Task 3 GREEN: implement the pure rail motion edit reducer** - `dd23f5111` (feat)
7. **Typecheck fixture fix** - `d72a10c3b` (test)

**Plan metadata:** `docs(59-02): complete rail motion model plan` (final commit)

_Note: TDD tasks have multiple commits (test → feat)._

## RED Evidence

All three RED gates were validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (`target_test_failed`, JUnit format, zero report errors):

| Task | Records | Target test | Outcome |
|------|---------|-------------|---------|
| 1 | 20 tests, 4 pass / 16 fail | `rail motion channel union > accepts exactly the five model channel ids and rejects the lane id` | `expected false to be true` at railMotionModel.test.ts:45 |
| 2 | 45 tests, 22 pass / 23 fail | `parsePhysicPaintRotoRailMotions > accepts a canonical record and freezes every level` | `expected [] to have a length of 1` against the stub |
| 3 | 69 tests, 52 pass / 17 fail | `applyRailMotionEditToCollection > animate creates the identity Position pair at the edit frame` | `expected [] to have a length of 1` against the stub |

Each named target compiled, executed and failed on its planned assertion — no build, import or collection faults. The 69-test suite is green at HEAD.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionModel.ts` — types, channel union/order, value domains, UI conversion pair, canonicalizer, fail-closed parser, empty default, rail-id mint, pure edit reducer. No store, signal, DOM or React/Preact import; no `PhysicPaintRotoScriptMotionSettings` reference.
- `app/src/components/physic-paint/roto/railMotionModel.test.ts` — 69 tests across channel union, domains, conversions, canonicalization, parser rejection table, mint and reducer behavior/immutability.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-02-task{1,2,3}.json` — validated RED records with their JUnit reports under `red-evidence/`.

## Decisions Made

- **Module-local guards instead of shared imports.** `physicsPaintRotoPhysicalModel.ts` keeps its guards private, and 59-03 will import this module; importing back would create a cycle. `isRecord`, the allowlists and the bounded-id/frame/wiggle guards are therefore duplicated locally (small and stable).
- **`pairedValue` on the set-key edit.** D-12 requires both Position axes at every frame. When the addressed axis inserts a new frame, the reducer must put *some* truthful value on the sibling. The edit carries the evaluator-derived sibling value in an optional `pairedValue`; if the caller omits it, the reducer step-holds the sibling's outgoing value rather than inventing a midpoint. 59-12 can pass the evaluated value for a snap-free insert.
- **Grouped Position is one lane, two channels.** Adding or removing either Position axis applies to the pair, and removing a Position key removes that frame from both axes. This keeps every intermediate collection parseable under the same invariant the parser enforces.
- **Frame ordering is an output invariant.** The parser rejects duplicate frames but accepts unsorted input and canonicalizes key order; "strictly ascending" therefore describes the frozen output, matching the plan's "input array order becomes irrelevant".
- **Quiet no-op vs throw.** Unknown rail/channel/key targets return the input reference unchanged (stale UI reads), while invalid channel ids, frames, values, easing and wiggle throw so the 59-07 store action refuses the write. `animate` validates its railId first but a pre-existing record always makes it idempotent.
- **Requirements left pending.** The plan frontmatter claims MOTN-02, MOTN-03, MOTN-09, MOTN-12 and REL-02, but this plan delivers only the model layer. The user-facing animate command (59-12), persistence wiring (59-03/07), evaluation and pivot (59-05/08), and save/reopen round-trip (59-03) are not in this plan, and MOTN-12 in particular cannot be claimed before the document carrier lands. Following the 59-01 precedent, no requirement was falsely flipped; REL-02 remains complete from 59-01.

## Deviations from Plan

### Process deviations (no behavior outside the planned contract)

**1. Added an optional `pairedValue` field to the `set-key` edit**
- **Found during:** Task 3 (reducer design)
- **Issue:** D-12 requires identical Position frame sets, but a single-axis `set-key` edit at a new frame gives the reducer no sibling value. Step-holding is safe; the evaluator's value is truthful. Without a channel for that value, 59-12 could not insert a Position key without snapping the sibling axis.
- **Resolution:** `PhysicPaintRotoRailMotionEdit.set-key` carries `pairedValue?: number`, validated against the sibling axis. Absent, the reducer step-holds the sibling's outgoing value. This is additive: the plan's five edit kinds and all listed fields are unchanged.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionModel.ts`
- **Verification:** the grouped Position tests assert both axes from one edit and the sibling-preservation path.

**2. Extra typecheck-fix commit after Task 3 GREEN**
- **Found during:** the plan verification `pnpm --filter efx-motion-editor run typecheck`
- **Issue:** two deliberately malformed fixtures were passed through the typed `channel()`/`key()` helpers, so TypeScript applied excess-property checks to the test file (`enabled`, `curve`).
- **Resolution:** cast the two fixtures at the boundary (`as unknown as PhysicPaintRotoRailMotionChannel` / `...Key`); runtime behavior unchanged, tests still 69/69.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionModel.test.ts`
- **Committed in:** `d72a10c3b`

**3. RED evidence format is JUnit, not TAP**
- **Found during:** Task 1 RED evidence capture
- **Issue:** the project's RED classifier rejects vitest's `tap`/`tap-flat` output as malformed; the accepted JUnit record format was verified against the 261031-cf9 precedent.
- **Resolution:** every RED run uses `--reporter=junit --outputFile=...` with `reportPath`, `runStartedAt` and `reportModifiedAt` in the record. All three verdicts are `RED_EVIDENCE_OK`.
- **Files modified:** the three RED evidence records.

**Total deviations:** 3 process deviations (0 auto-fixes). **Impact on plan:** none on the planned behavior — the delivered model matches the plan's artifacts and invariants exactly, plus the additive `pairedValue` field needed to honor D-12 truthfully.

## Issues Encountered

- The TAP RED-evidence rejection cost a detour; resolved by switching to the JUnit reporter (see deviation 3).
- No source-behavior issues: the three GREEN implementations passed their suites on the first run after each RED was validated.

## Threat Surface Scan

The plan's threat register is fully mitigated: T-59-04 (exact allowlists, plain-prototype `isRecord`, bounded ids, caps, duplicate rejection, frozen output), T-59-05 (512/5/4096/frame caps enforced before allocation-heavy work), T-59-06 (fail-closed, field-naming errors, one test per rejection). T-59-SC: no install. No network endpoint, auth path or trust-boundary surface was added; the module has no document or store coupling.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 59-03 can import `railMotionModel.ts` with no cycle: it owns the `rotoPhysical` allowlist/revision additions and the conditional canonical term at the reserved `rail-motions` ordinal.
- 59-05's evaluator consumes only the exported types; its `evaluateRailMotionChannel` output is exactly what a `set-key` edit's `pairedValue` expects.
- 59-06's identity layer owns `createPhysicPaintRotoRailId`; 59-07's store action owns catching reducer throws and committing through the single setter.
- Verification at HEAD: 69/69 tests in `railMotionModel.test.ts`, `pnpm --filter efx-motion-editor run typecheck` clean, no `PhysicPaintRotoScriptMotionSettings` reference, both files tracked.
- No blockers.

---

*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- `railMotionModel.ts`, `railMotionModel.test.ts` and this SUMMARY exist at the recorded paths.
- Commits `86ca3f2a9`, `c61b9e07c`, `94cf4f917`, `8d3778151`, `fb5751edc`, `dd23f5111` and `d72a10c3b` are ancestors of `HEAD`.
