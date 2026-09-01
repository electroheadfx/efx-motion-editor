---
phase: 50-photo-reference-track
plan: 01
subsystem: document-model
tags: [typescript, preact, vitest, document-model, fail-closed-parser, canonical-revision, photo-reference]

# Dependency graph
requires:
  - phase: 45-new-efx-paint-document-and-clean-cutover
    provides: EfxPaintDocument identity root, fail-closed parser primitives, canonical revision encoder
  - phase: 49-fixed-background-track-and-imported-loop-clips
    provides: parseBackgroundTrack fail-closed precedent, encodeCanonicalBackgroundFallback term
provides:
  - PhotoReferenceTrack + PhotoReferenceMode + PhotoReferenceTransform types (efxPaintDocument.ts)
  - parsePhotoReferenceTrack fail-closed branch (efxPaintDocumentParsers.ts)
  - encodeCanonicalPhotoReference revision term (efxPaintDocumentRevision.ts)
  - round-trip + rejection + revision-stability contract suite (efxPaintDocumentParsers.test.ts)
affects: [50-02, 50-03, 50-04, 50-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 4813
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed exact-member parser (isPlainRecord → hasOnlyKeys → per-field validation → Object.freeze)"
    - "Canonical revision encoder with document-mutation vs display-preference field split"
    - "Cross-package schema mirror (app-side EfxPaintDocument ↔ packages/efx-physic-paint/src/types.ts)"

key-files:
  created:
    - app/src/efx-paint/document/efxPaintDocumentParsers.test.ts
  modified:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - packages/efx-physic-paint/src/types.ts

key-decisions:
  - "PhotoReferenceTrack field shape: source identity is an ordered `readonly string[]` of library asset IDs in natural-filename-sort order (D-02), mirroring FrameLoopClip.sourceFrameRefs; display preferences (visibleInStudio, opacity, transform, transformLocked) ride on the track itself, not a separate record."
  - "Document-mutation fields (id, sourceFrameRefs, mode, revision) enter the canonical revision term; display-preference fields (visibleInStudio, opacity, transform, transformLocked) are validated but EXCLUDED from the encoder (D-07 vs D-11/D-12/D-13 split)."
  - "The reserved 'photo' fond mode stays absent from the PhotoReferenceMode union (D-08); the parser rejects it fail-closed."
  - "The package's EfxPaintDocument type mirrors the app-side photoReference widening (PhotoReferenceTrack | null) so the app-side document remains assignable across the bridge; the standalone engine's runtime validateEfxPaintDocument still rejects non-null photoReference (correct for the engine)."

patterns-established:
  - "PhotoReferenceTrack model: mutation fields vs display-preference fields split, consumed by Plans 50-02..50-05."
  - "parsePhotoReferenceTrack mirrors parseBackgroundTrack exactly (hasOnlyKeys → per-field validation → Object.freeze)."

requirements-completed: [REF-01, REF-05]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "PhotoReferenceTrack model round-trips through type + parser + canonical encoder (REF-01, REF-05)"
    requirement: "REF-05"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.test.ts#round-trips a valid PhotoReferenceTrack through serialize/parse (REF-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fail-closed rejection of malformed/reserved inputs: unknown mode, missing sourceFrameRefs, negative revision, out-of-range/non-finite opacity, missing/non-finite transform (ASVS V5)"
    requirement: "REF-05"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.test.ts#throws fail-closed on unknown mode, missing sourceFrameRefs, and negative revision (ASVS V5)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.test.ts#round-trips boundary opacity and rejects out-of-range/non-finite/non-number (D-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deterministic canonical revision term covering mutation fields only; display-preference changes never bump the document revision (D-07 vs D-12/D-13)"
    requirement: "REF-01"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.test.ts#mode changes the canonical revision; opacity does not (D-07 vs D-12)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.test.ts#revision is stable under field reordering; null photoReference parses to null (D-07)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-09-01
status: complete
---

# Phase 50 Plan 01: PhotoReferenceTrack Model Summary

**PhotoReferenceTrack model with fail-closed parser and display-preference-free canonical revision term, replacing the `photoReference: null` placeholder**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-01T18:33:00+02:00
- **Completed:** 2026-09-01T18:49:39+02:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced the `EfxPaintDocument.photoReference: null` literal with `PhotoReferenceTrack | null`, adding `PhotoReferenceMode`, `PhotoReferenceTransform`, and `PhotoReferenceTrack` types to the identity root.
- Extended the fail-closed parser with `parsePhotoReferenceTrack` (exact-member, mode-union, opacity [0,1], five-finite-number transform, non-negative revision), replacing the non-null reject.
- Replaced the `'photo:null;'` placeholder with `encodeCanonicalPhotoReference`, covering mutation fields (id, ordered sourceFrameRefs, mode, revision) and excluding display-preference fields.
- Added a 7-test contract suite (round-trip, encoder split, fail-closed, mode/opacity/transform edges, revision stability) — all green alongside the pre-existing document suites (3223 passed).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (tracer): PhotoReferenceTrack model + parser + revision** - `26ab9c93` (test RED) → `824aad0e` (feat GREEN)
2. **Task 2: complete the model — display-preference validation, mode-union edges, revision stability** - `a93e9d00` (test edge cases)

**Plan metadata:** pending (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `app/src/efx-paint/document/efxPaintDocument.ts` - Added `PhotoReferenceMode`, `PhotoReferenceTransform`, `PhotoReferenceTrack` types; widened `photoReference` to `PhotoReferenceTrack | null`
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` - Added `parsePhotoReferenceTrack` fail-closed branch replacing the non-null reject
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` - Added `encodeCanonicalPhotoReference` term replacing the `'photo:null;'` placeholder
- `app/src/efx-paint/document/efxPaintDocumentParsers.test.ts` - 7-test round-trip + rejection + revision-stability contract suite
- `packages/efx-physic-paint/src/types.ts` - Mirrored the app-side photoReference widening (Rule 3 deviation)

## Decisions Made
- **Field shape:** source identity is an ordered `readonly string[]` of library asset IDs in natural-filename-sort order (D-02), mirroring `FrameLoopClip.sourceFrameRefs`; display preferences ride on the track itself.
- **Revision split:** mutation fields (id, sourceFrameRefs, mode, revision) enter the canonical term; display-preference fields (visibleInStudio, opacity, transform, transformLocked) are validated but excluded (D-07 vs D-11/D-12/D-13).
- **Reserved mode:** `'photo'` stays absent from the union (D-08); the parser rejects it fail-closed.
- **Package mirror:** the package's `EfxPaintDocument` type mirrors the widening so the app-side document stays assignable across the bridge; the standalone engine's runtime validator still rejects non-null photoReference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Opacity test compared documents with different UUIDs**
- **Found during:** Task 1 (encoder test)
- **Issue:** Each `documentWithPhotoReference()` call generated fresh UUIDs via `createEfxPaintDocument`, so the two opacity variants differed by track/background IDs, not opacity — the "identical hash" assertion failed for the wrong reason.
- **Fix:** Built both opacity variants from a shared `base` document via `JSON.parse(JSON.stringify(base))`.
- **Files modified:** app/src/efx-paint/document/efxPaintDocumentParsers.test.ts
- **Verification:** Test 2 passes; opacity change produces identical revision hash.
- **Committed in:** 824aad0e (Task 1 GREEN)

**2. [Rule 3 - Blocking] Cross-package type mismatch (TS2345)**
- **Found during:** Task 1 (typecheck)
- **Issue:** App-side `EfxPaintDocument` (photoReference: `PhotoReferenceTrack | null`) was not assignable to the package's `EfxPaintDocument` (photoReference: `null`), breaking `usePhysicsPaintSessionController.ts`.
- **Fix:** Mirrored the photoReference widening in `packages/efx-physic-paint/src/types.ts` and rebuilt the package (`pnpm --filter @efxlab/efx-physic-paint build`).
- **Files modified:** packages/efx-physic-paint/src/types.ts
- **Verification:** `pnpm --dir app run typecheck` exits 0.
- **Committed in:** 824aad0e (Task 1 GREEN)

**3. [Rule 3 - Blocking] `delete` operator on non-optional property (TS2790)**
- **Found during:** Task 2 (test authoring)
- **Issue:** `delete` on the non-optional `sourceFrameRefs` property in the test helper failed typecheck.
- **Fix:** Used destructuring (`const { sourceFrameRefs: _omitRefs, ...trackWithoutRefs } = ...`) to omit the field.
- **Files modified:** app/src/efx-paint/document/efxPaintDocumentParsers.test.ts
- **Verification:** `pnpm --dir app run typecheck` exits 0.
- **Committed in:** a93e9d00 (Task 2)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and typecheck. No scope creep.

## Issues Encountered
- None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 50-02 (store CRUD + resolution) can consume the `PhotoReferenceTrack` model without further document-layer work.
- The exact field shape (source as `readonly string[]`, display prefs on the track) is recorded as a decision for Plans 50-02..50-05.

## Self-Check: PASSED

- All 5 modified/created files exist on disk.
- All 3 task commits (`26ab9c93`, `824aad0e`, `a93e9d00`) present in git history.

---
*Phase: 50-photo-reference-track*
*Completed: 2026-09-01*
