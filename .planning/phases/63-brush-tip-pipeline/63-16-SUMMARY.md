---
phase: 63-brush-tip-pipeline
plan: 16
subsystem: physic-paint/snapshot
tags: [snapshot, refused-restore-latch, aqtl-retirement, tdd, gap-closure, cr-02, wr-12]

requires:
  - phase: 63-15
    provides: AQTL v3 texture-aware wire and the proven SNP1 v5 snapshot seam
  - phase: 63
    provides: the SNP1 v5 watercolor-only clean break and its pinned retirement notice
provides:
  - CR-02 closed — a binding-scoped `refusedRestore` latch withholds every routine save after a refused read or decode, upstream of `deps.write`
  - WR-12 closed — an inner `unsupported-version` AQTL body raises `aqtl-retired` and maps to a named notice; corruption still reads as corruption
  - The existing `sessionOnly` purge door is the only acknowledgement that clears the latch, and only after a successful commit
affects: [verify-work, audit-milestone, ship]

actuals:
  tokens: 6958
  tasks: 2
  commits: 6

plan_head_before: bc8c757fc362ae537e1d9d6ab2e77e04077121b0
plan_head_after: 240236401bef0d5c174978db0ef79594f78cb326

tech-stack:
  added: []
  patterns:
    - "Binding-scoped refusal latch read inside `prepareSave` BEFORE the write port — the destructive seam is never entered, so no backup artifact is needed"
    - "Inner-code inspection instead of flattening: a known retirement code is surfaced under its own container-level code, every other inner failure keeps the generic section tag"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
    - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts

key-decisions:
  - "CR-02 fix = latch (review option a), not a backup file: the refused bytes are protected by NOT WRITING, so no new Rust/IPC surface or orphan artifact exists"
  - "The latch is set on both refusal arms (read refused/io and decode failure) and NEVER by `missing`, so a degraded read fails closed while a genuinely empty track still saves"
  - "Latch clears only in bind/reset, on a later SUCCESSFUL restore, and on a SUCCESSFUL explicit `sessionOnly` purge commit — a failed purge write leaves it set"
  - "`aqtl-retired` is a container code, not an AQTL change: the inner codec keeps the one and only version gate; no v1/v2 reader or migration exists (no-backward-compat law)"
  - "The retirement message is a pinned constant mapped from `corrupt:aqtl-retired`, reusing the once-per-binding report path; the corrupt-watercolor and snap-v4-retired paths are untouched"

patterns-established:
  - "Destructive-write protection at the prepare seam: gate the write intent where the options are already known, before any adapter call"
  - "Retirement vs corruption: a deliberate format break carries its own code and named notice; only genuine malformation says 'corrupt'"

requirements-completed: [TIP-14]

coverage:
  - id: D1
    description: "After a refused read, one painted stroke plus saveNow/flushNow writes nothing (the CR-02 destruction shape), and the debounced drain writes nothing either"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: withholds saveNow and flushNow after a refused read with a non-empty session"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: the debounced drain writes nothing while latched"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: the latch stands across repeated routine saves"
        status: pass
    human_judgment: false
  - id: D2
    description: "Latch lifecycle is exactly the contract: decode-refusal latches, missing does not, a successful restore and a rebind do not, a failed purge write keeps it, a successful purge clears it"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: withholds the decode-refused arm too"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: a missing snapshot never latches"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: a successful restore still saves the union exactly as before"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: the latch is binding-scoped — a rebind whose restore succeeds saves"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: the explicit purge writes once, clears the latch, and routine saves resume"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#CR-02: a FAILED purge write leaves the latch set; a later successful purge clears it"
        status: pass
    human_judgment: false
  - id: D3
    description: "A v5 container whose inner AQTL version word is 1 or 2 raises `aqtl-retired` with the pinned message; corrupt magic stays `watercolor` and container v1-4 stays `snap-v4-retired`"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts#names a retired AQTL body instead of reporting watercolor corruption (WR-12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The retired AQTL body shows the named notice exactly once per binding, a genuinely broken body keeps the generic corrupt report, and the refusal latches against routine saves"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#AQTL_RETIRED: shows the pinned named notice exactly once per binding"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#AQTL_RETIRED: keeps the generic corrupt message for a broken AQTL body"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#AQTL_RETIRED: the refusal latches — no routine save replaces the snapshot"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-11-16
status: complete
---

# Phase 63 Plan 16: CR-02 + WR-12 gap closure Summary

**A refused snapshot restore now latches its binding so no routine save can replace the unread file, and a pre-v3 AQTL body is named as a retirement instead of being reported as corruption.**

## Performance

- **Duration:** 11 min (measured from the plan ledger base `bc8c757fc` to the last task commit `240236401`)
- **Tasks:** 2 of 2
- **Files modified:** 4 (all declared; no created files)
- **Commits:** 6 task commits, measured as `git rev-list --count bc8c757fc..240236401`

## Accomplishments

- CR-02's destruction path is closed at the only seam that can cause it: `prepareSave` returns `null` while `refusedRestore` is set and the explicit `sessionOnly` purge is not, so `deps.write` / `ipcStudioScriptSnapshotWrite` / `write_snapshot_at` are never reached for a binding whose snapshot could not be read.
- The exact destructive shape is pinned: a refused read, one real stroke (making the payload non-empty so the empty-save guard cannot protect the file), then `saveNow` + `flushNow` → zero writes. The habitual 800 ms debounced drain is pinned separately.
- The latch lifecycle is symmetric and proven: decode refusal latches; `missing` never latches; a successful restore saves the union exactly as before; a rebind starts clean; a failed purge write keeps the latch; a successful purge write clears it; repeated routine saves stay withheld.
- WR-12: an inner `unsupported-version` AQTL error is inspected, not flattened, and surfaces as `aqtl-retired` with the pinned message `AQTL body predates the texture format`. The controller maps it to `STUDIO_SCRIPT_SNAPSHOT_AQTL_RETIRED_MESSAGE` once per binding.
- GENUINE corruption still reads as corruption (`corrupt:watercolor` generic message), retired containers 1-4 keep the existing `snap-v4-retired` notice, and there is still exactly one AQTL version gate — no v1/v2 reader, migration, Rust, IPC, manifest or dependency change.

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-02 — latch a refused restore** (tdd)
   - `b4bc2a572` (test) — RED: CR-02 latch pins
   - `2ccecaa52` (feat) — GREEN: `refusedRestore` latch, gate, and successful-purge clear
   - `9f3d79d4c` (test) — pin the debounced drain against a latched binding
2. **Task 2: WR-12 — a retired AQTL body is named** (tdd)
   - `1dba08049` (test) — RED: codec + controller retirement pins
   - `ce882c355` (test) — probe identity correction (see Deviations)
   - `240236401` (feat) — GREEN: `aqtl-retired` code and the named notice

_Measured from the plan ledger: `git rev-list --count bc8c757fc..HEAD` = 6. Plan metadata commit follows this SUMMARY (not counted)._

## Files Created/Modified

- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` — `refusedRestore` declaration, bind/reset clears, both refusal-arm sets, success clear, `sessionOnly` on `PreparedSave`, the `prepareSave` gate, the purge-commit clear, and `STUDIO_SCRIPT_SNAPSHOT_AQTL_RETIRED_MESSAGE` + its message mapping
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts` — the CR-02 regression describe (9 pins) and the WR-12 describe (3 pins) plus `aqtlMagicOffset` / `retiredAqtlContainer` / `corruptAqtlContainer` helpers
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` — `ScriptTimelineCodecError` value import, `aqtl-retired` union member, and the first-position inner-catch branch
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts` — the retired-inner-AQTL probe beside the existing corrupt-watercolor pin

## Decisions Made

- Latch over backup (review option a): protection comes from withholding the write, so there is no new artifact, no Rust/IPC surface, and no orphaned backup to manage.
- The latch is deliberately NOT cleared by the `missing` arm or by any routine save, failed write or report — the only durable clear sites are bind/reset, a successful restore, and a successful `sessionOnly` commit.
- WR-12 uses a distinct container code with a pinned non-interpolated message; the inner text is never surfaced because it describes the retired body's internal expectation, not the user's situation.
- No migration was added: the retirement is named, per the project's no-backward-compat law and 63-15's accepted consequence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WR-12 rebind probe carried the wrong identity**
- **Found during:** Task 2 GREEN
- **Issue:** the "once per binding" pin rebound to `track-2` but kept reading a container encoded under `track-1`; the v5 header decodes (and identity-checks) before the inner AQTL body, so the probe hit `corrupt:identity` and never reached the retirement path. The production mapping was correct.
- **Fix:** parameterised `retiredAqtlContainer(version, identity)` and encoded the second container under the rebound identity.
- **Files modified:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts`
- **Commit:** `ce882c355`

### Process Notes

**2. [Rule 3 - Blocking] Stale beads dependency blocked the Task 1 close**
- `bd close efx-motion-editor-mhz.38` was blocked by `mhz.37` (63-15.3), which is complete per `63-15-SUMMARY.md` (`582e7b0c9`, `6d83d5ea2`) but was never closed on this branch; `mhz.37` is itself blocked by the same stale chain. Task 63-16.1 was closed with `--force` and the evidence recorded in the close reason. `63-15.x` issues are left for the orchestrator's reconcile rather than closed from this plan.

**3. [Rule 3 - Blocking] RED evidence path must live inside the project**
- `gsd_run check tdd-red-evidence` rejects paths outside the project root, so the JUnit report and record were written under the repo root for classification, then deleted before staging. Both plan commits still touch only the four declared TypeScript files (`git diff --name-only` verified).

**4. Extra regression pin committed separately**
- Task 1's debounced-drain pin (`9f3d79d4c`) is an additional regression test beyond the plan's minimum, committed alone with no production change.

## TDD Gate Compliance

- **Task 1:** RED `b4bc2a572` → classifier `RED_EVIDENCE_OK`, reason `target_test_failed` (5 intended target failures, JUnit, 71 tests). GREEN `2ccecaa52`; controller suite 72/72 at GREEN.
- **Task 2:** RED `1dba08049` → classifier `RED_EVIDENCE_OK`, reason `target_test_failed` (2 intended failures: codec `expected 'watercolor' to be 'aqtl-retired'`; controller `expected 'Studio script snapshot could not be r…' to be 'This track's script was saved in an …'`; 107 tests). GREEN `240236401`.
- Both REDs were behavioural assertions on real encoded containers, not collection or import errors.

## Verification Evidence

- Targeted suites: `studioScriptSnapshotCodec.test.ts` + `studioScriptSnapshotController.test.ts` → **107/107 passed**.
- 63-15 regression block (11 suites, including `scriptTimelineCodec`, `aquarelleRecordState.*`, the roto clipboard/library/PlayScript suites) → **609/609 passed**.
- `pnpm --filter efx-motion-editor run typecheck` → clean (`tsc --noEmit`, no output).
- Latch present: non-comment `refusedRestore` count = **8** (expected >= 7).
- Gate upstream of the write: `refusedRestore &&` count = **1** (expected >= 1).
- Retirement code in codec: non-comment `aqtl-retired` = **2** (expected >= 2); named notice constant = **2** (expected >= 2).
- Pins: `CR-02` in controller test = **13** (>= 3); `aqtl-retired` in codec test = **2** (>= 1); `AQTL_RETIRED` in controller test = **7** (>= 1).
- One AQTL version gate only: `version !== SCRIPT_TIMELINE_BINARY_VERSION` count = **1**.
- Purity law intact: impure tokens (`PhysicsPaintStudio|useEffect|useSignal|useState|useMemo`) = **0**; `^import .*@preact` = **1**; `StudioScriptSnapshotSaveOptions` still has exactly `allowEmpty` + `sessionOnly`.
- No seam widening: `git diff --name-only bc8c757fc..240236401` lists only the four declared TypeScript files; the `app/src-tauri`, `app/src/lib/ipc.ts`, manifests and lockfile diff is empty.

## Threat Surface Scan

No new surface beyond the plan's threat model. T-63-35 (routine-save overwrite) is mitigated by the prepare-seam gate; T-63-36 (retirement misreported as corruption) by the `aqtl-retired` mapping; T-63-37 (latch clear path) by the pinned clear-site set. No dependency, manifest or IPC change was made.

## Known Stubs

None.

## Issues Encountered

- The `bd update <id> --close` form is rejected (`unknown flag: --close`); the close verb is `bd close <id>`.
- The stale-open 63-15 beads chain required a documented `--force` on 63-16.1 (see Deviations note 2).

## User Setup Required

None.

## Next Phase Readiness

- 63-16 is the phase's final planned plan (16 plans, no 63-17); `/gsd-verify-work` can re-check CR-02 and WR-12 against `63-VERIFICATION.md`'s gaps.
- The refused-snapshot path now fails closed end to end: unreadable or retired snapshots are preserved byte-for-byte until a successful explicit purge, and the user sees a named notice rather than a corruption report.

## Self-Check: PASSED

- All four modified source files and this SUMMARY exist on disk.
- All six task commits (`b4bc2a572`, `2ccecaa52`, `9f3d79d4c`, `1dba08049`, `ce882c355`, `240236401`) are ancestors of HEAD.
- `actuals.commits` is measured from the plan ledger: 6; `plan_head_before` and `plan_head_after` recorded.
