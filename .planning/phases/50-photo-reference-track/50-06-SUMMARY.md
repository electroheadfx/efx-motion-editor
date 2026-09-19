---
phase: 50-photo-reference-track
plan: 06
subsystem: testing
tags: [typescript, preact, vitest, photo-reference, persistence, round-trip, d06-exclusion, integration-contract]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    plan: 02
    provides: setPhotoReferenceSource/Mode/Visible/Opacity/Transform/TransformLocked + serializeRuntimeIntoDocument/hydrateRuntimeFromDocument + hydrateReferenceSourceImagesFromLibrary
  - phase: 50-photo-reference-track
    plan: 03
    provides: Photo row + reference picker swap (BackgroundAssetPickerView reuse)
  - phase: 50-photo-reference-track
    plan: 04
    provides: PhysicsPaintReferenceGhostLayer + drawReferenceGhost (monitor-paint ghost)
  - phase: 50-photo-reference-track
    plan: 05
    provides: PhysicsPaintPhotoReferenceSection + PhysicsPaintReferenceTransformHandles + Escape re-lock
provides:
  - Photo reference track persistence round-trip contract (serialize → parse → hydrate preserves all seven fields, idempotent)
  - End-to-end Studio integration contract (import → ghost → mode → opacity → transform → save/reopen wiring)
  - D-06 non-regression assertion (no reference input reaches compositor/cache/preview/export)
  - Native UAT checklist (the phase close-out evidence)
affects: []

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 1863
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persistence round-trip contract: drive the Plan 50-02 setters to a full track, then serialize → parse → hydrate and deep-equal the hydrated photoReference to the pre-save track on all seven fields"
    - "D-06 non-regression as a token allow-list scan over the four raster surfaces (compositor, flattened cache, preview renderer, export renderer)"

key-files:
  created: []
  modified:
    - app/src/stores/efxPaintPersistenceMultiTrackRoundTrip.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The persistence round-trip asserts on `parsed.photoReference` (the document that hydrateRuntimeFromDocument installs) deep-equal to the pre-save track — the photoReference field rides the `...document` spread in serializeRuntimeIntoDocument, so the round-trip is structural and the only genuinely new persistence work was already proven in Plan 50-02."
  - "The D-06 non-regression is a token allow-list scan over the four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer) — fourteen reference-input tokens (photoReference, drawReferenceGhost, getReferenceSourceFrameVerdict, registerReferenceSourceImage, the six setters, the three components, getReferenceBounds) must not appear in any of them."
  - "The end-to-end contract consolidates the per-plan wiring assertions (50-03 picker, 50-04 ghost, 50-05 section/transform/Escape) into one integration proof, plus the save/reopen seam (hydrateReferenceSourceImagesFromLibrary)."

patterns-established:
  - "Photo reference persistence round-trip: serialize → parse → hydrate preserves id, sourceFrameRefs (natural sort order), mode, revision, visibleInStudio, opacity, transform, transformLocked; serialize → hydrate → serialize is idempotent."
  - "D-06 exclusion is proven structurally at the integration layer: no reference-input token reaches the compositor, flattened cache, preview renderer, or export renderer."

requirements-completed: [REF-05]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Photo reference track persistence round-trip: serialize → parse → hydrate preserves all seven fields (id, sourceFrameRefs in natural sort order, mode, revision, visibleInStudio, opacity, transform, transformLocked) and is idempotent (serialize → hydrate → serialize stable) (REF-05)"
    requirement: "REF-05"
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintPersistenceMultiTrackRoundTrip.test.ts#photo reference track survives serialize → parse → hydrate with all seven fields intact and idempotent"
        status: pass
    human_judgment: false
  - id: D2
    description: "End-to-end Studio integration contract: the full flow is wired (import → Photo row band → ghost → mode → opacity → transform → Escape re-lock → save/reopen) and the D-06 non-regression holds (no reference input reaches the compositor, flattened cache, preview renderer, or export renderer in any mode) (REF-05, D-06)"
    requirement: "REF-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#wires the full flow: import → Photo row band → ghost → mode → opacity → transform → Escape re-lock → save/reopen"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#keeps the reference out of flattened output in every mode — no reference input reaches the compositor, cache, preview, or export (D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Native UAT: the full user flow works end-to-end in the running app (import source → Photo row band → ghost overlay → mode switch → opacity slider → transform with lock/Escape → save → reopen → everything restored; reference never appears in flattened output or export)"
    requirement: "REF-05"
    verification: []
    human_judgment: true
    rationale: "The automated contracts prove the wiring and the persistence round-trip, but the actual visual/behavioral flow (ghost overlay rendering, live opacity preview, canvas transform gestures, save/reopen in the packaged app) requires the user to run the app — Claude does not claim done before this native UAT passes."

# Metrics
duration: 10min
completed: 2026-09-01
status: complete
---

# Phase 50 Plan 06: Photo Reference Persistence + End-to-End Integration Summary

**Photo reference track persistence round-trip and end-to-end Studio integration contracts proving save/reopen preserves all seven track fields and the D-06 exclusion holds through the persistence path**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-01T17:46:00Z
- **Completed:** 2026-09-01T17:56:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended `efxPaintPersistenceMultiTrackRoundTrip.test.ts` with a photo-reference round-trip scenario: drive the Plan 50-02 setters to a full track, then serialize → parse → hydrate and assert the hydrated `photoReference` deep-equals the pre-save track on all seven fields (`id`, `sourceFrameRefs` in natural sort order, `mode`, `revision`, `visibleInStudio`, `opacity`, `transform`, `transformLocked`), plus an idempotency assertion (serialize → hydrate → serialize stable).
- Extended `PhysicsPaintStudio.test.ts` with an end-to-end integration contract asserting the full flow is wired (import → Photo row band → ghost → mode → opacity → transform → Escape re-lock → save/reopen) and a D-06 non-regression assertion (no reference-input token reaches the compositor, flattened cache, preview renderer, or export renderer).
- Both test files green (127 tests) and `pnpm --dir app run typecheck` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: persistence round-trip — photo reference track survives save/load (REF-05)** - `3ea3cf42` (test)
2. **Task 2: end-to-end Studio integration contract + native UAT (REF-05)** - `c9695f8b` (test)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `app/src/stores/efxPaintPersistenceMultiTrackRoundTrip.test.ts` - Added the photo-reference round-trip scenario (serialize → parse → hydrate preserves all seven fields, idempotent)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Added the end-to-end integration contract (full-flow wiring) + the D-06 non-regression token scan

## Decisions Made
- **Round-trip asserts on `parsed.photoReference`:** the `photoReference` field rides the `...document` spread in `serializeRuntimeIntoDocument`, so the round-trip is structural — the only genuinely new persistence work (reference source-byte hydration) was already proven in Plan 50-02.
- **D-06 non-regression as a token allow-list scan:** fourteen reference-input tokens must not appear in any of the four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer).
- **End-to-end contract consolidates the per-plan wiring assertions** into one integration proof plus the save/reopen seam.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Native UAT Checklist (phase close-out evidence)

The phase is **automated-ready, not claimed done** until the user's native UAT passes. The user runs the app and verifies:

1. Open the EFX Physic Paint Studio and import a reference source (Import images) — the Photo row appears above the Bg row with a camera glyph and a passive band.
2. Confirm the ghost overlay draws over the composite while painting, at 50% opacity by default.
3. Switch the Mode control between Reference only / Reveal source / Masked transform — the active segment changes, the ghost looks identical (flag-only).
4. Drag the Overlay opacity slider — live preview during drag, commit on release; the value persists.
5. Unlock the reference transform, drag/scale/rotate the overlay, then press Escape — it re-locks and painting works normally.
6. Save the project, close, and reopen — the source, mode, opacity, transform, and lock state are all restored.
7. Confirm the reference NEVER appears in flattened output or export in any mode.

## Next Phase Readiness
- Phase 50 is automated-ready; the user's native UAT is the final gate before Phase 50 is declared complete.
- The persistence round-trip shape and the D-06 exclusion-through-persistence proof are recorded as the phase close-out evidence.

## Self-Check: PASSED

- Both modified files exist on disk.
- Both task commits (`3ea3cf42`, `c9695f8b`) present in git history.

---
*Phase: 50-photo-reference-track*
*Completed: 2026-09-01*
