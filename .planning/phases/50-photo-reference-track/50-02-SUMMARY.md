---
phase: 50-photo-reference-track
plan: 02
subsystem: store
tags: [typescript, preact, vitest, store, undo-ledger, fail-closed-resolution, d06-exclusion, photo-reference]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    plan: 01
    provides: PhotoReferenceTrack + PhotoReferenceMode + PhotoReferenceTransform types, parsePhotoReferenceTrack fail-closed branch, encodeCanonicalPhotoReference revision term
  - phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-caches
    provides: unified 10-level undo ledger (recordBackgroundEdit by reference)
  - phase: 49-fixed-background-track-and-imported-loop-clips
    provides: _backgroundSourceImages registry + registerBackgroundSourceImage + hydrateBackgroundSourceImagesFromLibrary precedent
provides:
  - Six photo/reference setters (setPhotoReferenceSource/Mode/Visible/Opacity/Transform/TransformLocked) with the mutation vs display-preference split
  - Parallel _referenceSourceImages registry + registerReferenceSourceImage + _referenceSourceRevision + _resolveReferenceSourceImage + getReferenceSourceFrameVerdict
  - hydrateReferenceSourceImages + hydrateReferenceSourceImagesFromLibrary reopen-path source-byte hydration
  - D-06 structural exclusion proof (byte-identical flattened output) + serialize/hydrate idempotence
affects: [50-03, 50-04, 50-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 9154
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation-setter vs display-preference split (RESEARCH Pattern 1): source/mode bump track revision + documentRevision and record undo by reference; visible/opacity/transform/lock persist without undo or revision bump"
    - "Parallel source registry (reference independent of Background clip lifecycle) with a deterministic order-preserving revision term"
    - "Frame-aligned fail-closed resolution: index = min(frame, refs.length - 1), missing ref → null + :missing suffix"

key-files:
  created:
    - app/src/stores/efxPaintStore.photoReference.test.ts
  modified:
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/physicPaintStore.ts

key-decisions:
  - "Setter signatures: setPhotoReferenceSource(layerId, sourceFrameRefs) and setPhotoReferenceMode(layerId, mode) return PhotoReferenceMutationResult ({ ok: true; descriptor } | { ok: false; reason }); the four display setters return PhotoReferenceDisplayResult ({ ok: true } | { ok: false; reason }) with no descriptor."
  - "BackgroundEditOperationKind extended with 'set-photo-reference-source' and 'set-photo-reference-mode' — the unified ledger's recordBackgroundEdit restores before/after by reference with no per-kind switch, so the extension is additive."
  - "The reference registry is a PARALLEL _referenceSourceImages map (not shared with _backgroundSourceImages) so the reference's fail-closed resolution stays independent of the Background clip lifecycle (RESEARCH Open Question 2)."
  - "registerReferenceSourceImage bumps physicPaintVersion (ghost re-render) but does NOT clear the flattened memo — the reference never enters the flattened path (D-06), so a reference bytes arrival must not invalidate the flattened composite."
  - "_referenceSourceRevision preserves sourceFrameRefs ORDER (frame N → refs[N], D-15) — unlike _backgroundSourceRevision which sorts a deduped set; the order is the frame-alignment contract."
  - "The D-06 exclusion and serialize/hydrate were already structural (Tests 8-9 passed in the RED phase); the only new persistence work was the reference source-image hydration (Test 10)."

patterns-established:
  - "Photo reference store CRUD: mutation setters (source/mode) vs display-preference setters (visible/opacity/transform/lock), consumed by Plans 50-03..50-05."
  - "getReferenceSourceFrameVerdict(layerId, frame) → { ref, dataUrl, clamped } | null is the ghost draw + band tooltip accessor (Plan 50-04)."

requirements-completed: [REF-02, REF-03, REF-04]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Photo/reference CRUD: undoable source-replace and mode-switch mutations (bump track revision + documentRevision, record by reference) plus non-undoable display-preference setters (visibleInStudio/opacity/transform/transformLocked), all idempotent (REF-02)"
    requirement: "REF-02"
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#setPhotoReferenceSource creates the track with locked defaults, replaces it, and records undo by reference (D-03)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#setPhotoReferenceMode records one undo entry and bumps track + document revision (D-07)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#display-preference setters persist without undo or revision bump (D-11/D-12/D-13)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#setters are idempotent no-ops on same-value writes (no revision bump, no undo, no dirty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reference source registry + deterministic revision term + frame-aligned fail-closed resolution: frame N → source frame N clamped at sequence end, missing ref → null with :missing suffix (REF-04)"
    requirement: "REF-04"
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#resolves frame N to source frame N, clamped at sequence end (D-15)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#missing source resolves to null with a :missing revision suffix (D-04)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#_referenceSourceRevision changes on source/dataUrl change, is stable otherwise, and is empty when null"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-06 exclusion lock: getFlattenedFrame output is byte-identical whether the photo reference is absent, present, or visibleInStudio toggled — the reference never enters the flattened raster (REF-03)"
    requirement: "REF-03"
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#getFlattenedFrame output is byte-identical regardless of reference state (D-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Serialize/hydrate persistence: serialize → hydrate → serialize is idempotent and preserves all track fields; the reference source images hydrate through the library path (REF-05 re-verified at the store layer)"
    requirement: "REF-05"
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#serialize → hydrate → serialize is idempotent and preserves all track fields (REF-05)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.photoReference.test.ts#hydrateReferenceSourceImages registers the reference source images through the library path (REF-05)"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-09-01
status: complete
---

# Phase 50 Plan 02: Photo/Reference Store CRUD + Registry + Resolution Summary

**Undoable source/mode mutations and non-undoable display-preference setters, a parallel fail-closed source registry with a deterministic revision term, frame-aligned resolution, and the structural D-06 exclusion — plus serialize/hydrate persistence**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-01T16:58:03Z
- **Completed:** 2026-09-01T17:01:40Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added six photo/reference setters to `efxPaintStore.ts` with the RESEARCH Pattern 1 field-class split: `setPhotoReferenceSource`/`setPhotoReferenceMode` are undoable document mutations (bump track `revision` + `documentRevision`, record by reference on the unified ledger); `setPhotoReferenceVisible`/`Opacity`/`Transform`/`TransformLocked` are display preferences (persist, no undo, no revision bump). All idempotent.
- Added a parallel `_referenceSourceImages` registry + `registerReferenceSourceImage` + `_referenceSourceRevision` + `_resolveReferenceSourceImage` + `getReferenceSourceFrameVerdict` to `physicPaintStore.ts` — frame-aligned (frame N → refs[N], clamped at sequence end) and fail-closed (missing ref → null + `:missing` suffix).
- Added `hydrateReferenceSourceImages` + `hydrateReferenceSourceImagesFromLibrary` and wired the reopen path so the reference source images warm the registry after a project reopen.
- Proved the D-06 exclusion structurally (byte-identical flattened output regardless of reference state) and the serialize/hydrate round-trip idempotence.
- 10-test contract suite green alongside the pre-existing store suites (322 passed, 24 todo across 19 store test files).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: photo reference CRUD — undoable source/mode mutations vs non-undoable display-preference setters** - `56ed7ef3` (test RED) → `11c6ae96` (feat GREEN)
2. **Task 2: source registry + revision + frame-aligned fail-closed resolution** - `b17cc307` (test RED) → `f440efd1` (feat GREEN)
3. **Task 3: D-06 exclusion lock + serialize/hydrate persistence** - `3014b746` (test RED) → `2d9f80e0` (feat GREEN)

**Plan metadata:** pending (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `app/src/stores/efxPaintStore.ts` - Six photo/reference setters (mutation vs display-preference split), `BackgroundEditOperationKind` extension, `PhotoReferenceMutationResult`/`PhotoReferenceDisplayResult` types, reference source-image hydration wiring in `hydrateRuntimeFromDocument`
- `app/src/stores/physicPaintStore.ts` - `_referenceSourceImages` registry + `registerReferenceSourceImage`, `_referenceSourceRevision`, `_resolveReferenceSourceImage`, `getReferenceSourceFrameVerdict`, `hydrateReferenceSourceImages` + `hydrateReferenceSourceImagesFromLibrary`, `reset()` clears the reference registry
- `app/src/stores/efxPaintStore.photoReference.test.ts` - 10-test contract suite (CRUD + undo, registry + resolution, exclusion, persistence)

## Decisions Made
- **Setter signatures:** mutation setters return `PhotoReferenceMutationResult` (with `descriptor`); display setters return `PhotoReferenceDisplayResult` (no descriptor). Rejection reasons: `no-document`, `no-photo-reference`, `invalid-source-refs`, `invalid-mode`, `invalid-opacity`, `invalid-transform`.
- **Ledger extension:** `BackgroundEditOperationKind` gained `'set-photo-reference-source'` and `'set-photo-reference-mode'` — additive, since `recordBackgroundEdit` restores `before`/`after` by reference with no per-kind switch.
- **Parallel registry:** the reference registry is a separate `_referenceSourceImages` map, keeping fail-closed resolution independent of the Background clip lifecycle.
- **Memo discipline:** `registerReferenceSourceImage` bumps `physicPaintVersion` but never clears `_flattenedMemo` (D-06).
- **Order-preserving revision:** `_referenceSourceRevision` keeps `sourceFrameRefs` order (frame N → refs[N]) rather than sorting.

## Deviations from Plan

None — plan executed as written. Two observations worth recording (not Rule 1-4 deviations):

- **Tests 8-9 passed in the RED phase.** The D-06 exclusion and the serialize/hydrate round-trip were already structural (the flattened path never reads `document.photoReference`; `serializeRuntimeIntoDocument` already carries `photoReference` via the `...document` spread). The plan anticipated this ("the exclusion is structural"), so the only genuinely new persistence work was the reference source-image hydration (Test 10). The RED commit for Task 3 therefore had 1 failing test (Test 10) and 2 already-green tests (Tests 8-9).
- **`serializeRuntimeIntoDocument` needed no change.** The plan's Task 3 action said to "write `photoReference` into the serialized document", but the existing `...document` spread already carried it. No edit was required there.

## Issues Encountered
- None beyond the observations above. The `_referenceSourceRevision` test seam is exported underscore-prefixed (consistent with `_setEfxPaintMarkDirtyCallback`) because Test 7 requires direct access, even though the plan's exports list only names `registerReferenceSourceImage` and `getReferenceSourceFrameVerdict`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 50-03 (row + picker) can consume `setPhotoReferenceSource`/`setPhotoReferenceMode` and the `PhotoReferenceMutationResult` descriptor for the undo ledger.
- Plan 50-04 (ghost draw) can consume `getReferenceSourceFrameVerdict(layerId, frame)` and `_referenceSourceRevision` for the frame-aligned ghost overlay and the band tooltip.
- Plan 50-05 (right panel) can consume the four display-preference setters.

## Self-Check: PASSED

- All 3 modified/created files exist on disk.
- All 6 task commits (`56ed7ef3`, `11c6ae96`, `b17cc307`, `f440efd1`, `3014b746`, `2d9f80e0`) present in git history.

---
*Phase: 50-photo-reference-track*
*Completed: 2026-09-01*
