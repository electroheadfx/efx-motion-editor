---
phase: 52-shared-mask-compositor-and-reveal
plan: 02
subsystem: api
tags: [reveal, photo-reference, mode-removal, clean-break, fail-closed-parser, round-trip]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    provides: photoReference track, PhotoReferenceMode flag (removed here per D-15), reference transform
  - phase: 52-shared-mask-compositor-and-reveal (52-01)
    provides: reveal rail (railKind 'reveal' on PhysicPaintRotoLoopClip), bake, undo-by-reference
provides:
  - Mode-free PhotoReferenceTrack schema (D-15 clean break) — no vestigial mode state
  - Fail-closed parser rejection of legacy mode-bearing records (T-52-04)
  - Mode-free canonical photo/reference revision term
  - efx-physic-paint package mirror type synced to the mode-free schema
affects: [52-03, 52-04, 52-05, verify-work]

# Actuals (#2632) — pairs with the plan's `estimate` (20000 tokens).
actuals:
  tokens: 13600    # chars/4 over the realized diff (54396 chars)
  tasks: 2         # tasks completed
  commits: 2       # commits made (test RED + feat GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clean-break schema removal: the mode member is dropped from the parser allowlist, so a legacy mode-bearing record throws (unknown member) — never normalized, never silently accepted"
    - "Mirror-type sync: the efx-physic-paint package's EfxPaintDocument/PhotoReferenceTrack mirror must track the app-side schema (typecheck boundary)"

key-files:
  created:
    - app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts
  modified:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx
    - packages/efx-physic-paint/src/types.ts

key-decisions:
  - "The PhotoReferenceMode flag is removed entirely (D-15) — not kept as a vestigial semantic marker; the reveal rail bakes the reference as placed regardless of any mode."
  - "The parser stays fail-closed: PHOTO_REFERENCE_KEYS drops 'mode', so a legacy mode-bearing record throws (unknown member) — no normalization, no backward-compat parsing (T-52-04)."
  - "The canonical photo/reference revision term drops the mode term — the mode was a document-mutation field; with it gone, only id/sourceFrameRefs/revision remain."

patterns-established:
  - "Pattern 1: Clean-break schema removal — the removed field is deleted from the allowlist, not retained; legacy records fail closed at the parser boundary."
  - "Pattern 2: Mirror-type sync — the package's document mirror must be updated in the same commit as the app-side schema (the app typecheck enforces it)."

requirements-completed: [RVL-05, RVL-06]

coverage:
  - id: D1
    description: "PhotoReferenceMode flag removed from schema, parser, store, and controller — no vestigial mode state (D-15); the bake-time RVL-05 guard is the mode-free schema"
    requirement: RVL-05
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts#rejects a legacy mode-bearing PhotoReferenceTrack fail-closed (unknown member throws)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A mode-free PhotoReferenceTrack parses and round-trips byte-identically (RVL-06 save/reopen)"
    requirement: RVL-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts#parses a mode-free PhotoReferenceTrack and round-trips byte-identically (RVL-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reveal rail record (railKind 'reveal') round-trips through the physical-level parser without loss"
    requirement: RVL-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts#round-trips a railKind reveal Loop Clip through the physical-level parser without loss"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-02
status: complete
---

# Phase 52 Plan 2: PhotoReferenceMode Removal Summary

**The `PhotoReferenceMode` flag removed entirely (D-15 clean break) — a mode-free `PhotoReferenceTrack` schema/parser/store/controller with fail-closed rejection of legacy mode-bearing records, a mode-free canonical revision term, and the reveal rail record round-trip through the physical-level parser**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-02T14:30:00Z
- **Completed:** 2026-09-02T14:50:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- The `PhotoReferenceMode` union (`reference-only` / `reveal-source` / `masked-transform-source`) and the `mode` field on `PhotoReferenceTrack` are deleted from the v1.0 document schema — no vestigial state (D-15, Phase 45 no-compat).
- The parser drops `'mode'` from `PHOTO_REFERENCE_KEYS`, deletes the `PHOTO_REFERENCE_MODES` set, and removes the mode validation/return — the parser stays fail-closed: a legacy mode-bearing record throws (unknown member), never normalized or silently accepted (T-52-04).
- `setPhotoReferenceMode`, the `PHOTO_REFERENCE_MODES` const, and the `'set-photo-reference-mode'` operation kind are removed from `efxPaintStore.ts`; `setPhotoReferenceSource` and the display-preference setters (visible/opacity/transform/transformLocked) are unchanged.
- The photo-reference controller drops the mode signal, `PHOTO_REFERENCE_MODE_OPTIONS`, `PHOTO_REFERENCE_MODE_HINT`, and the `setMode` port — it keeps the source/visibility/opacity/transform/lock ports.
- The canonical photo/reference revision term drops the mode term (`efxPaintDocumentRevision.ts`).
- The `efx-physic-paint` package's mirror `PhotoReferenceTrack`/`EfxPaintDocument` types are synced to the mode-free schema (the app typecheck boundary), and the package dist is rebuilt.
- The reveal rail record (`railKind: 'reveal'`) round-trips through the physical-level parser without loss, and an unknown `railKind` is rejected fail-closed.

## Task Commits

Each task was committed atomically:

1. **Task 2 (RED): Mode-free PhotoReferenceTrack round-trip test** - `f041aa75` (test) — the failing tests written first per the plan's Task 2 action ("Write the failing tests first (RED), then confirm GREEN against the Task 1 changes")
2. **Task 1: Remove PhotoReferenceMode — schema, parser, store, controller (D-15)** - `df63cbc1` (feat) — the removal that turns the RED tests GREEN

**Plan metadata:** pending final docs commit

_Note: The TDD gate is satisfied — the git log shows `test(52-02)` (f041aa75) before `feat(52-02)` (df63cbc1). The RED test was written before the removal so it genuinely failed against the mode-bearing parser (mode-free track rejected, legacy mode accepted), then the removal made it green._

## Files Created/Modified

- `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` - NEW: 4 tests — mode-free PhotoReferenceTrack round-trip (RVL-06), legacy mode-bearing record rejected fail-closed, reveal rail record round-trip through the physical-level parser, unknown railKind rejected.
- `app/src/efx-paint/document/efxPaintDocument.ts` - Deleted `PhotoReferenceMode` union and the `mode` field on `PhotoReferenceTrack`; updated the track doc comment (D-15).
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` - Dropped `'mode'` from `PHOTO_REFERENCE_KEYS`, deleted `PHOTO_REFERENCE_MODES`, removed mode validation and the returned `mode` member; updated the unknown-members error copy.
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` - Removed the mode term from `encodeCanonicalPhotoReference`; updated the doc comment.
- `app/src/stores/efxPaintStore.ts` - Deleted `setPhotoReferenceMode`, the `PHOTO_REFERENCE_MODES` const, the `'set-photo-reference-mode'` operation kind, the `'invalid-mode'` rejection reason, and the `mode: 'reference-only'` default in `setPhotoReferenceSource`; removed the `PhotoReferenceMode` import.
- `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts` - Removed the mode signal, `PHOTO_REFERENCE_MODE_OPTIONS`, `PHOTO_REFERENCE_MODE_HINT`, the `setMode` port, and `selectMode`; the controller keeps the source/visibility/opacity/transform/lock ports.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Removed the `setMode` port wiring and the `PhotoReferenceMode`/`setPhotoReferenceMode` imports.
- `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` - Removed the Mode 3-segment radiogroup and the exclusion hint; the dialog keeps opacity/lock/visibility/source/remove controls.
- `packages/efx-physic-paint/src/types.ts` - Synced the mirror `PhotoReferenceTrack`/`EfxPaintDocument` types to the mode-free schema (removed `PhotoReferenceMode` and the `mode` field).
- Test updates (Rule 3): `efxPaintDocumentParsers.test.ts`, `efxPaintStore.photoReference.test.ts`, `efxPaintPersistenceMultiTrackRoundTrip.test.ts`, `PhysicsPaintStudio.test.ts`, `PhysicsPaintPhotoReferenceDialog.test.ts` — removed the mode assertions/behaviors and updated the revision expectation (0, not 1).

## Decisions Made

- The `PhotoReferenceMode` flag is removed entirely (D-15) — not kept as a vestigial semantic marker; the reveal rail bakes the reference as placed regardless of any mode. The real guard is RVL-05 (photo pixels reach output only through reveal keys).
- The parser stays fail-closed: `PHOTO_REFERENCE_KEYS` drops `mode`, so a legacy mode-bearing record throws (unknown member) — no normalization, no backward-compat parsing (T-52-04).
- The canonical photo/reference revision term drops the mode term — with the mode gone, only `id`/`sourceFrameRefs`/`revision` remain as document-mutation terms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dependent source surfaces broke on the removal**
- **Found during:** Task 1 (Remove PhotoReferenceMode)
- **Issue:** Removing `setPhotoReferenceMode`/`PhotoReferenceMode` broke the imports and port wiring in `PhysicsPaintStudio.tsx` (the `setMode` port), `PhysicsPaintPhotoReferenceDialog.tsx` (the Mode radiogroup + hint), and `efxPaintDocumentRevision.ts` (the mode revision term).
- **Fix:** Removed the `setMode` port and imports from the Studio, removed the Mode radiogroup/hint from the dialog, and dropped the mode term from the canonical photo/reference revision.
- **Files modified:** `PhysicsPaintStudio.tsx`, `PhysicsPaintPhotoReferenceDialog.tsx`, `efxPaintDocumentRevision.ts`
- **Verification:** Full suite green; typecheck clean.
- **Committed in:** df63cbc1 (Task 1 commit)

**2. [Rule 3 - Blocking] efx-physic-paint package mirror type out of sync**
- **Found during:** Task 1 (Remove PhotoReferenceMode)
- **Issue:** The app typecheck failed — the package's mirror `PhotoReferenceTrack` still required `mode`, so the app's mode-free `EfxPaintDocument` was not assignable to the package's `EfxPaintDocument` (the `engine.load(document)` boundary in `usePhysicsPaintSessionController.ts`).
- **Fix:** Removed `PhotoReferenceMode` and the `mode` field from `packages/efx-physic-paint/src/types.ts` and rebuilt the package dist (gitignored build artifact).
- **Files modified:** `packages/efx-physic-paint/src/types.ts`
- **Verification:** App typecheck clean; package typecheck clean; full suite green.
- **Committed in:** df63cbc1 (Task 1 commit)

**3. [Rule 3 - Blocking] Existing tests asserting the old mode behavior broke**
- **Found during:** Task 1 (Remove PhotoReferenceMode)
- **Issue:** Five test files asserted the removed mode behavior (parser mode round-trip/rejection, `setPhotoReferenceMode` undo semantics, the `setMode` port wiring, the Mode radiogroup, and the mode revision term).
- **Fix:** Removed the mode assertions/behaviors; updated the persistence round-trip revision expectation to 0 (the mode mutation was the only other revision-bumping photo-reference op).
- **Files modified:** `efxPaintDocumentParsers.test.ts`, `efxPaintStore.photoReference.test.ts`, `efxPaintPersistenceMultiTrackRoundTrip.test.ts`, `PhysicsPaintStudio.test.ts`, `PhysicsPaintPhotoReferenceDialog.test.ts`
- **Verification:** Full suite green (3343 passed).
- **Committed in:** df63cbc1 (Task 1 commit)

**4. [Plan verify command path] The plan's verify command path is wrong relative to the vitest root**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` command `pnpm --filter efx-motion-editor exec vitest run app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` fails with "No test files found" — the vitest root is `app/` and the filter must be relative to it.
- **Fix:** Used the correct equivalent `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` (4 tests pass).
- **Verification:** Reveal test file green; full suite green.
- **Committed in:** n/a (command-only deviation)

---

**Total deviations:** 4 (3 auto-fixed Rule 3 blocking issues, 1 command-path deviation)
**Impact on plan:** All auto-fixes were necessary consequences of the D-15 removal — no scope creep. The command-path deviation is a plan-authoring artifact, not a code issue.

## TDD Gate Compliance

- **Task 2 is `tdd="true"`.** The RED phase was satisfied by writing the failing tests BEFORE the Task 1 removal (per the plan's Task 2 action: "Write the failing tests first (RED), then confirm GREEN against the Task 1 changes"). The RED run genuinely failed: the mode-free track was rejected by the mode-bearing parser, and the legacy mode-bearing record was accepted. The Task 1 removal then turned them green.
- **Git log gate:** `test(52-02)` (f041aa75) precedes `feat(52-02)` (df63cbc1) — the strict RED/GREEN commit sequence is satisfied.

## Issues Encountered

- The plan's verify command path (`app/src/...`) is wrong relative to the vitest root (`app/`); the correct equivalent (`src/...`) passes. Documented as a deviation.
- The `efx-physic-paint` package's mirror `PhotoReferenceTrack` type was out of sync with the app-side schema after the removal — the app typecheck caught it at the `engine.load(document)` boundary. Synced the mirror and rebuilt the package dist.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The mode-free `PhotoReferenceTrack` schema, parser, store, and controller are proven end-to-end; a mode-free track parses and round-trips, a legacy mode-bearing record is rejected fail-closed, and the reveal rail record round-trips through the physical-level parser.
- Ready for the horizontal expansion plans (52-03..52-05): the rail surface (color/status dot/tooltip freshness), the "Reveal with script…" modal entry, and the RVL-05 token allow-list leak contract.
- The `efx-physic-paint` package dist was rebuilt locally (gitignored) — the mirror type is in sync.

## Self-Check: PASSED

- FOUND: `.planning/phases/52-shared-mask-compositor-and-reveal/52-02-SUMMARY.md`
- FOUND: `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts`
- FOUND: commit `f041aa75` (test RED)
- FOUND: commit `df63cbc1` (feat GREEN)

---
*Phase: 52-shared-mask-compositor-and-reveal*
*Completed: 2026-09-02*
