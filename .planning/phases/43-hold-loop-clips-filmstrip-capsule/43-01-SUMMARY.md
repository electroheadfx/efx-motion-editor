---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 01
subsystem: persistence
tags: [roto, physics-paint, loop-clips, persistence, revision-fingerprint, undo-redo, vitest]

requires:
  - phase: 42-playscript-application-modes
    provides: Play Script one-source-cycle controller, batch generation commits, static/hold schedule
provides:
  - PhysicPaintRotoLoopClip record (loopId, placementStart, sourceKeyIds, repeat, mode) with fail-closed guard and parser
  - loopClips as first genuinely optional physical-document member — v0.8.1 documents load as empty collection with no migration (D-29)
  - loopClips threaded through the four-allowlist persistence gauntlet (model document keys, PERSISTED_DOCUMENT_KEYS + save/hydrate mapping, types/project.ts document type, bridge apply-payload allowlists)
  - Canonical revision fingerprint extended to (records, interpolation, loopClips) — loop-only edits are revision-visible (Q1 resolved: single fingerprint extended)
  - RotoPhysicalEditSnapshot.loopClips — keys and loops ride ONE Undo/Redo snapshot; generation + derived loop shrink is one undoable/redoable outcome (D-06/D-10)
  - replaceRotoPhysicalLoopClips store mutation with fail-closed validation
affects: [43-02, 43-03, 43-04, 43-05, 43-06, 43-07, 43-08, 43-09, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 27000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Additive optional document member: absent means empty collection, empty collection contributes NO term to the canonical revision so legacy revisions stay byte-stable (D-29)"
    - "Fail-closed allowlist parsing (hasOnlyAllowedKeys idiom) with verbatim preservation of dangling references (D-31)"
    - "Single canonical snapshot covering keys + loops together for history (D-06/D-10) — no parallel loop-only history channel"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts
    - app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/lib/physicPaintPersistence.ts
    - app/src/types/project.ts
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
    - app/src/stores/physicPaintStore.ts

key-decisions:
  - "Q1 resolved per plan: loopClips join the single canonical revision fingerprint via buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips) — no separate loop revision"
  - "Empty loopClips collection contributes no fingerprint term, so v0.8.1 documents keep their legacy revision and load with no migration (D-29)"
  - "play-script and paste-key-group commit kinds are ordinary history-bearing commands so a generation plus its derived loop shrink stays one undoable/redoable outcome (D-06 coherence)"
  - "Dangling source keyIds are preserved verbatim at parse — never validated, normalized, or rewritten (D-31)"

patterns-established:
  - "Four-allowlist gauntlet for new persisted fields: model document keys + persistence keys/save/hydrate + project document type + bridge payload allowlists, threaded in one change set (RESEARCH Pitfall 1)"
  - "Structural cache memo keyed on identity quadruple (recordMap, interpolation, capacity, loopClips) — every mutation replaces identities, no explicit invalidation"

requirements-completed: [HOLD-05]

coverage:
  - id: D1
    description: "Loop Clip record with finite repeat or infinity round-trips save then reopen byte-identically through the physical document (D-29)"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts#persistence gauntlet (41 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duplicated linked loop record (placementStart independent from source location) round-trips byte-identically"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts#placement/source independence"
        status: pass
    human_judgment: false
  - id: D3
    description: "v0.8.1-shaped document without loopClips loads as empty collection; malformed loopClips throws fail-closed; dangling source keyIds preserved verbatim (D-29/D-31)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts#absent member / malformed member / dangling references"
        status: pass
    human_judgment: false
  - id: D4
    description: "Loop-only edit changes the canonical revision and is restorable through Undo/Redo; generation+shrink is one undoable/redoable outcome; snapshotRecordsEqual compares loopClips (Q1, D-06/D-10)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts#revision + Undo/Redo snapshot (4 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#existing history behavior unchanged"
        status: pass
    human_judgment: false

duration: ~50min across API-quota resume
completed: 2026-08-06
status: complete
---

# Phase 43 Plan 01: Loop Clip Persistence Foundation Summary

**Loop Clip records persist byte-identically through the four-allowlist gauntlet and join the single canonical revision fingerprint and Undo/Redo snapshot — v0.8.1 documents load unchanged, loop-only edits are revision-visible and undoable**

## Performance

- **Duration:** ~50 min across an API-quota pause (resumed by a continuation executor)
- **Started:** 2026-08-06T19:24:52Z (first RED commit)
- **Completed:** 2026-08-06T20:15:59Z (Task 2 GREEN commit)
- **Tasks:** 2
- **Files modified:** 24 (8 source + 2 new specs + 14 test/support updates)

## Accomplishments

- `PhysicPaintRotoLoopClip` record with fail-closed guard/parser: unknown keys, wrong types, empty sourceKeyIds, and non-positive/non-integer finite repeat all throw; `repeat: 'infinity'` persists as the explicit infinity state
- loopClips threaded end-to-end in one coherent change set (RESEARCH Pitfall 1): model document keys, `PERSISTED_DOCUMENT_KEYS` + save/hydrate mapping, `McePhysicPaintRotoPhysicalDocument.loopClips`, and both bridge apply-payload allowlists
- v0.8.1 compatibility locked by construction: absent member parses to an empty collection and the empty collection contributes NO term to the canonical revision, so legacy revisions stay byte-stable (D-29, no migration)
- Dangling source keyIds load successfully and are preserved verbatim — never validated or normalized at parse (D-31); no derived loop state (Effective duration, boundaries, repeat-instance mappings, resolved destinations) is ever persisted (D-30)
- `buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips)` — Q1 resolved by extending the single fingerprint; every call site threaded (store, bridge, coordinator, timeline actions, Studio, parse-time recompute, project equality)
- `RotoPhysicalEditSnapshot.loopClips` + `snapshotRecordsEqual` coverage: Undo restores the exact prior loop state, Redo re-applies the exact operation result; a Play Script generation plus its derived loop shrink is one history command (D-06/D-10)

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **Task 1 (tracer): loopClips persistence gauntlet** — `052ffaca` (test, RED) + `19d4c495` (feat, GREEN)
2. **Task 2: loopClips join revision fingerprint and Undo/Redo snapshot** — `4cd0e3af` (test, RED) + `d52f48dd` (feat, GREEN)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts` — 41-test persistence gauntlet spec (round-trip, placement/source independence, v0.8.1 absent member, fail-closed malformed input, verbatim dangling references, infinity repeat, payload allowlists)
- `app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts` — 4-test revision + history snapshot spec (loop-only revision difference, Undo/Redo exactness both directions, generation+shrink one-undo coherence, snapshotRecordsEqual semantics)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — loop clip record/guard/parser, `loopClips` document member, three-argument canonical revision, D-29 empty-collection term elision
- `app/src/lib/physicPaintPersistence.ts` — `loopClips` in persisted keys, save mapping, hydration
- `app/src/types/project.ts` — `McePhysicPaintRotoLoopClip` + optional document member
- `app/src/types/physicPaint.ts` — `loopClips` in both apply-payload allowlists
- `app/src/lib/physicPaintBridge.ts` — loopClips threaded through apply-payload validation/acceptance and revision call sites
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — snapshot member, equality, replay authority checks; `play-script`/`paste-key-group` ordinary kinds
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` — `RotoPhysicalEditSnapshot.loopClips`, records-port `getLoopClips`/`replaceLoopClips`
- `app/src/stores/physicPaintStore.ts` — `replaceRotoPhysicalLoopClips` (fail-closed, revision-visible), structural cache identity quadruple, revision call sites
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts`, `useRotoTimelineActions.ts`, `PhysicsPaintStudio.tsx` — call-site threading
- Test support updates: launch context, history, export/preview renderer, frameMap, bridge, persistence, PlayScript bridge, structural-cache specs

## Decisions Made

- Q1 resolved per plan/research recommendation: the single canonical revision fingerprint was extended to cover loopClips rather than creating a parallel loop revision — D-06/D-10 atomicity requires keys and loops in one snapshot
- Empty loopClips contributes no fingerprint term so v0.8.1 revisions are byte-stable (D-29); documented inline at `encodePhysicPaintRotoPhysicalContent`
- `play-script` and `paste-key-group` commit kinds became ordinary history-bearing commands so generation plus derived loop shrink replays as one command in both directions
- No sidecar file, no migration code, no normalization of dangling references anywhere (plan prohibitions held)

## Deviations from Plan

None - plan executed exactly as written. The continuation executor preserved and completed the prior executor's uncommitted GREEN implementation for Task 2 without rework; all verify commands passed on first run after resume.

## Issues Encountered

- Prior executor hit an API quota limit mid-Task-2 (GREEN implementation complete but uncommitted). Resumed by reviewing the in-flight diff, confirming RED/GREEN state, and committing — no work discarded.
- A background full-suite run initially executed from the repo root (harness cwd reset) and reported `vitest not found`; re-ran from `app/` — full suite green (1219 passed, 1 skipped, 101 todo across 100 files).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Loop Clip persistence foundation is ready for all Wave 2+ plans: loop operations (create/duplicate/edit Repeat) can build on `replaceRotoPhysicalLoopClips`, the revision fingerprint, and the single-snapshot history with atomic undo guaranteed
- Byte-identical save/reopen and v0.8.1 no-migration load are proven by automated specs; packaged-app smoke of the capsule/loop surface remains Phase 43-10 scope per the Phase 44 handoff note in STATE.md

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-01-SUMMARY.md`
- FOUND: `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts`
- FOUND: `app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts`
- FOUND commits: `052ffaca`, `19d4c495`, `4cd0e3af`, `d52f48dd`
- Verify: `pnpm --dir app exec vitest run physicsPaintRotoLoopHistory useRotoPhysicalEditHistory` — 5 passed; `physicsPaintRotoLoopClips` — 41 passed; full suite — 1219 passed, 0 failed; `tsc --noEmit` clean

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-06*
