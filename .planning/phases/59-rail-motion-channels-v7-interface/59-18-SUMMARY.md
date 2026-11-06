---
phase: 59-rail-motion-channels-v7-interface
plan: 18
subsystem: ui
tags:
  - preact
  - motion-channels
  - copy-paste
  - gap-closure
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-03
    provides: railMotions on the physical document, 6-argument canonical revision, fail-closed parser
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-06
    provides: assignRailMotionRailViews anchor-based binding for bare Key Rails
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-15
    provides: buildRotoRailSetCopyPayload motion freezing and proposeRails re-keying (untouched here)
provides:
  - getRotoRailMotions port on RotoTimelineActionsInput
  - buildRailSetCopyDocument parses and hashes the active track's motion collection
  - Production Studio wiring over getRotoPhysicalRailMotions(layerId, studioActiveTrackId())
affects:
  - 59-VERIFICATION truth row 16 / gap G3 (CR-01)
  - MOTN-05 and MOTN-12 copy-path assertions

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 9405
  tasks: 2
  commits: 3
plan_head_before: 1e3f8346a7e07e67c4f14b4ae9fdb541f53d15a7
plan_head_after: e0464ac557f3a2c9a6bcb7f8125e3e1a577be4c9

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Copy builders must feed the parser and the canonical revision from the SAME collection: the parser recomputes the revision and fails closed on mismatch, so agreement is structural, not asserted."
  - "A motion source port defaults to the shared empty constant, keeping the motion-free path byte-identical."

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-18-task1.json
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "The copied document's revision is the 6-argument revision over the SAME collection the parser receives; the fail-closed parse is the proof that motion and revision agree."
  - "The port stays optional and defaults to PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY, so a hook host without the port keeps today's exact motion-free payload."
  - "The Studio closure mirrors getRotoLoopClips: launch context in scope, studioActiveTrackId() resolved at call time, shared empty constant as fallback."

patterns-established:
  - "Copy-document builders hash exactly what they carry — no derived or separately-read collection can drift from the document content."

requirements-completed:
  - MOTN-01
  - MOTN-02
  - MOTN-05
  - MOTN-12

coverage:
  - id: D1
    description: "Rail-set Copy and Duplicate produce a frozen payload whose railMotions describes exactly the copied rails, with the copied document's revision hashing that same collection"
    requirement: MOTN-12
    verification:
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED: copyRailSet builds a payload whose railMotions carries the copied rail motion"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED: duplicateRailSet carries the same motion on its fresh payload"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED: the copied document revision includes the motion collection it carries"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The motion-free and port-absent paths stay byte-identical, and the production Studio supplies the active track's stored motion at call time"
    requirement: MOTN-05
    verification:
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a motion-free copy keeps the shared empty collection and the four-argument revision"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#the port is optional: a copy without getRotoRailMotions succeeds with the empty collection"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
      - kind: other
        ref: "grep -c 'getRotoRailMotions' app/src/components/physic-paint/PhysicsPaintStudio.tsx (== 1)"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 18: Rail-Set Copy/Duplicate Carries Rail Motion Summary

**Rail-set Copy and Duplicate now carry the rails' motion: the copied document is parsed and hashed with the same active-track motion collection, so the frozen payload re-keys real motion on paste instead of freezing nothing.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-11-06T20:50:25Z
- **Completed:** 2026-11-06T20:52:32Z
- **Tasks:** 2
- **Files modified:** 3 code/test files plus the RED evidence artifact

## Accomplishments

- Added the optional `getRotoRailMotions` port to `RotoTimelineActionsInput`, beside `getRotoLoopClips`, documented as the ACTIVE track's stored motion with the shared empty collection as its default.
- Fixed `buildRailSetCopyDocument`: it now reads the motion collection once and passes that same collection to BOTH `parsePhysicPaintRotoPhysicalDocument` and the 6-argument `buildPhysicPaintRotoPhysicalRevision` (5th argument stays `[]` for group overrides).
- Wired the production source in `PhysicsPaintStudio.tsx`: `getRotoRailMotions` reads `getRotoPhysicalRailMotions(launchContext.layerId, studioActiveTrackId())` at call time and falls back to `PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY`, mirroring `getRotoLoopClips`.
- Left the paste half untouched: `_applyRotoTrackPaste` and `proposeRails` re-keying are unchanged, `physicPaintStore.ts` shows no diff in this plan.

## Task Commits

Each task was committed atomically (Task 1 is TDD: test → feat):

1. **Task 1 RED: failing motion-bearing copy pins** - `ac05bc2ed` (test)
2. **Task 1 GREEN: copy document carries and hashes the motion** - `e124510e1` (feat)
3. **Task 2: Studio wiring from the launch context** - `e0464ac55` (feat)

**Plan metadata:** committed after this SUMMARY (docs: complete rail-set motion copy plan)

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `getRotoRailMotions` port; `buildRailSetCopyDocument` reads the collection once and threads it into the parser input and the 6-argument revision.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — harness option/port, copy/duplicate motion rows, revision-term row, motion-free row and port-absent row.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — production `getRotoRailMotions` wiring immediately after `getRotoLoopClips`.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-18-task1.json` — TAP RED evidence (`RED_EVIDENCE_OK`, target test failed on its own assertion).

## Decisions Made

- The parser and the revision are fed from the same local collection. Because `parsePhysicPaintRotoPhysicalDocument` recomputes the revision from the document content and throws on mismatch, a builder that parsed motion but hashed the 4-argument revision would fail closed — the successful copy is the structural proof that both agree.
- The port is optional by contract with a shared-constant default, so a hook host that omits it keeps the exact pre-59-18 payload.
- The Studio closure mirrors the neighbouring `getRotoLoopClips` closure (render-scope `launchContext`, `studioActiveTrackId()` resolved at call time) rather than capturing ids into a constant or memo.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — the port is fully wired to the real store reader and covered by the hook tests.

## Threat Flags

None — no new network, auth or file-access surface. The plan's T-59-54 mitigation is structural: the motion collection is read from the same active track as the records and loop clips, validated by the fail-closed parser, and hashed into the same document revision; the paste half still re-keys through `proposeRails`. T-59-SC: no install in this plan.

## TDD Gate Compliance

- **Task 1 RED:** `ac05bc2ed` — target test `RED: copyRailSet builds a payload whose railMotions carries the copied rail motion` failed on its own assertion (`expected [] to have a length of 1 but got +0`); 176 tests ran, 173 pass, 3 fail; classifier verdict `RED_EVIDENCE_OK` (reason `target_test_failed`).
- **Task 1 GREEN:** `e124510e1` — same command exits 0 (210 tests across both plan suites pass).
- **Task 2:** declared `type="auto"` without `tdd="true"`; its gates (`typecheck`, port-presence grep) pass and the commit shipped in `e0464ac55`.

## Self-Check: PASSED

- Files exist: `useRotoTimelineActions.ts`, `useRotoTimelineActions.test.ts`, `PhysicsPaintStudio.tsx`, `red-evidence-59-18-task1.json`.
- Commits `ac05bc2ed`, `e124510e1`, `e0464ac55` are ancestors of HEAD.
- Plan verification: vitest exit 0 (210 tests), typecheck exit 0, `getRotoRailMotions` count 1 in the Studio, `railMotions` count 3 in the hook, `physicPaintStore.ts` unchanged.
