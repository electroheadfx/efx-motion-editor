---
phase: 50-photo-reference-track
verified: 2026-09-01T21:00:40Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred:
  - "Reveal source mode behavior (Phase 52 Shared Mask Compositor and Reveal)"
  - "Masked-transform workflow (future phase)"
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 50: Photo/Reference Track Verification Report

**Phase Goal:** Add one durable source track used for painting reference, Reveal source, and accepted masked-transform workflows without turning it into a main-editor content track.
**Verified:** 2026-09-01T21:00:40Z
**Status:** passed
**Re-verification:** Yes — reflects the 50-UAT modal redesign and the round-2/round-3 fixes (paint-block wrapper, one-way toggles, reopen hydration, visible rotation handle)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add one photo/reference track with stable source identity and revision (REF-01) | ✓ VERIFIED | `PhotoReferenceTrack` type (id, sourceFrameRefs, mode, revision) in `efxPaintDocument.ts`; `setPhotoReferenceSource` creates the track with locked defaults and bumps revision; import flows through the strip camera icon → the floating Photo Reference dialog → Import (`PhysicsPaintPhotoReferenceDialog.tsx`), or Replace on a later import (D-03) |
| 2 | User can switch between reference-only, reveal-source, and masked-transform-source modes (REF-02) | ✓ VERIFIED | `PhotoReferenceMode` union (3 modes, no `'photo'`); `setPhotoReferenceMode` is one undoable mutation; the dialog's 3-segment radiogroup (Reference / Reveal / Masked) drives it; controller test asserts one undoable mutation |
| 3 | Toggling reference-only visibility never alters ordinary flattened Paint output (REF-03) | ✓ VERIFIED | D-06 structural exclusion: `_resolveFlattenedFrame`/`getFlattenedFrame` never read `photoReference` or `_referenceSourceImages`; byte-identical test; token scan over compositor/flattenedCache/previewRenderer/exportRenderer |
| 4 | Missing source is visible and recoverable; source revision invalidates dependent Reveal/transformation results (REF-04) | ✓ VERIFIED | `_resolveReferenceSourceImage` returns null on missing; `_referenceSourceRevision` carries `:missing` suffix; missing-source capsule `Missing reference source — use Replace source to re-link.`; source/mode setters bump revision |
| 5 | Save/reopen preserves source identity and mode (REF-05) | ✓ VERIFIED | `serializeRuntimeIntoDocument` carries `photoReference`; `hydrateRuntimeFromDocument` restores it and warms `_referenceSourceImages`; the Physic Paint LAUNCH path now also hydrates reference bytes with the library fallback (`usePhysicsPaintLaunchIntegration.ts`) — the round-2 reopen bug (reference invisible until a Replace) is fixed; persistence round-trip test asserts all 7 fields + idempotency |
| 6 | Reference transform (drag/scale/rotate with lock/Escape) reuses the TransformOverlay pattern (D-13) | ✓ VERIFIED | `PhysicsPaintReferenceTransformHandles.tsx` writes to `setPhotoReferenceTransform`; `getReferenceBounds` geometry tested; a VISIBLE rotation handle (stem + knob above the top edge, D-13 spec) was added per UAT and natively verified; the overlay wrapper is pointer-events none so painting passes through when locked; the pointer-gesture behavior (drag/scale/rotate + Escape re-lock) passed native UAT item 5 |

**Score:** 6/6 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/efx-paint/document/efxPaintDocument.ts` | PhotoReferenceTrack/Mode/Transform types; photoReference widened | ✓ VERIFIED | Types; `photoReference: PhotoReferenceTrack \| null`; factory keeps `null` |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | parsePhotoReferenceTrack fail-closed branch | ✓ VERIFIED | `parsePhotoReferenceTrack` + `parsePhotoReferenceTransform`; exact-member, mode-union, opacity [0,1], finite transform, non-negative revision |
| `app/src/efx-paint/document/efxPaintDocumentRevision.ts` | encodeCanonicalPhotoReference term | ✓ VERIFIED | Covers id/sourceFrameRefs/mode/revision, excludes display prefs |
| `app/src/stores/efxPaintStore.ts` | 6 setters + clear + serialize/hydrate | ✓ VERIFIED | Mutation setters (source/mode/clear) bump revision + record undo; display setters via `_setPhotoReferenceDisplayProperty` (no undo, no revision bump); `clearPhotoReference` removes the reference as one undoable mutation |
| `app/src/stores/physicPaintStore.ts` | registry + revision + resolution + launch hydration | ✓ VERIFIED | `_referenceSourceImages`, `_referenceSourceRevision`, `_resolveReferenceSourceImage`, `getReferenceSourceFrameVerdict`; `hydrateReferenceSourceImagesFromLibrary` wired into the launch/reopen path |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Camera icon in the Tracks strip (NOT a track row) | ✓ VERIFIED | `PhysicsPaintTrackColumnStrip` camera button (has-reference active state), always opens the Photo Reference dialog; no X remove badge (Remove lives in the dialog, 50-UAT round 2) |
| `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` | Movable dialog with all photo/reference controls | ✓ VERIFIED | Mode segmented, Overlay opacity slider, Lock/Visible toggles, source chip, Import/Replace, Remove; Play Script movable-dialog pattern; liquid-glass surface; Escape closes; focus returns to the camera |
| `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts` | Shared controller state machine | ✓ VERIFIED | Accepted canonical state only; release-commit opacity draft; toggles invert from the LIVE document (round-2 one-way-toggle fix) |
| `app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts` | shouldDrawReferenceGhost + drawReferenceGhost | ✓ VERIFIED | Decision + draw; behaviorally tested with mock canvas context |
| `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts` + `Handles.tsx` | getReferenceBounds + interactive transform overlay | ✓ VERIFIED | Geometry + overlay writing to `setPhotoReferenceTransform`; visible rotation handle; bounds-only pointer capture |
| Test files (7 suites) | contract suites | ✓ VERIFIED | 3299 tests pass (whole suite), tsc clean |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Strip camera icon | Photo Reference dialog | `onOpenReference` → `referenceDialogOpen.value = true` | ✓ WIRED | `PhysicsPaintStudio.tsx` workflow block; dialog memo re-resolves on `efxPaintVersion` |
| Dialog Import/Replace | reference picker | `onImportSource: () => referencePicker.openPicker()` | ✓ WIRED | `PhysicsPaintStudio.tsx` dialog bundle |
| Confirm path | setPhotoReferenceSource | `setPhotoReferenceSource(layerId, sortedIds)` + fresh-import hydration | ✓ WIRED | `handleConfirmReferencePicker` |
| Reopen path | reference hydration | `hydrateReferenceSourceImagesFromLibrary(document, launchLibrary)` | ✓ WIRED | `usePhysicsPaintLaunchIntegration.ts` `applySettledLaunchContext` |
| Ghost draw | getReferenceSourceFrameVerdict | `shouldDrawReferenceGhost` → verdict | ✓ WIRED | `PhysicsPaintReferenceGhost.ts` |
| Dialog Mode control | setPhotoReferenceMode | `selectMode` → `setMode` port | ✓ WIRED | controller + dialog; one undoable mutation |
| Transform handles | setPhotoReferenceTransform | gesture handlers → store display property | ✓ WIRED | `PhysicsPaintReferenceTransformHandles.tsx` |
| Escape re-lock | relockReferenceTransform | keyboard layer → `relockReferenceTransform` action | ✓ WIRED | `physicsPaintStudioKeyboard.ts`; `PhysicsPaintStudio.tsx` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `setPhotoReferenceSource` | `sourceFrameRefs` | picker `buildConfirmedImageIds` (library asset IDs) | Yes — real library IDs, natural-sorted | ✓ FLOWING |
| `_resolveReferenceSourceImage` | `dataUrl` | `_referenceSourceImages` registry (hydrated on import, launch, and project reopen) | Yes — real dataUrl, null on missing | ✓ FLOWING |
| `drawReferenceGhost` | `verdict.dataUrl` | `getReferenceSourceFrameVerdict` | Yes — real image bytes | ✓ FLOWING |
| `PhysicsPaintPhotoReferenceDialog` → controller | `filenames` | `resolveFilename` port → `imageStore.getById` | Yes — real filenames | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole suite incl. document/store/ghost/dialog/persistence/Studio | `vitest run` | 3299 passed | ✓ PASS |
| Type check | `tsc --noEmit` | clean | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REF-01 | 50-01, 50-03 | One photo/reference track with stable source identity and revision | ✓ SATISFIED | Model + revision term + camera icon + dialog import |
| REF-02 | 50-02, 50-05 | reference-only / reveal-source / masked-transform-source modes | ✓ SATISFIED | Mode union + setPhotoReferenceMode + dialog segmented control |
| REF-03 | 50-02, 50-04, 50-05 | Reference-only visibility excluded from flattened output | ✓ SATISFIED | D-06 structural exclusion + token scan + native UAT item 7 |
| REF-04 | 50-02, 50-03, 50-04 | Source revision invalidates dependents; missing source visible/recoverable | ✓ SATISFIED | Revision bump + `:missing` suffix + capsule + Replace flow |
| REF-05 | 50-01, 50-02, 50-06 | Save/reopen preserves source identity and mode | ✓ SATISFIED | Persistence round-trip + launch-path hydration fix (native UAT item 6) |

All 5 requirement IDs (REF-01..REF-05) are accounted for. No orphaned requirements.

### Code Review Findings (advisory — from 50-REVIEW.md)

| ID | Severity | Finding | Impact on goal |
| -- | -------- | ------- | -------------- |
| WR-01 | Warning | `resolveFilename` returns full path, not basename (tooltip shows `/Users/.../shot_1.png`) | Presentation-layer; does not affect any must-have truth |
| WR-02 | Warning | `drawReferenceGhost` async decode lacks cancellation/onerror (stale-decode race) | Presentation-layer; degrades fail-closed, no data loss |
| WR-03 | Warning | `PhysicsPaintReferenceTransformHandles` decode effect lacks cleanup | Presentation-layer; stale size write race |
| WR-04 | Warning | Reference missing-source handler can clobber the shared status capsule | Presentation-layer; capsule arbitration |
| IN-01 | Info | `_referenceSourceRevision` uses 64-char dataUrl prefix, not full hash | Collision extremely unlikely |

None are BLOCKER-level. All remain accepted advisory as they do not falsify any must-have truth.

### Decision Coverage

CONTEXT.md carries 15 decisions (D-01..D-15). All honored in the shipped artifacts, including the 50-UAT redesign (camera icon instead of a row, movable dialog instead of the right-panel section). 15/15 honored.

### Human Verification Required

None outstanding. The phase-closing native UAT (7 items in 50-UAT.md) passed on 2026-09-01. Four issues surfaced during UAT were fixed and re-validated:
1. Paint blocked by the reference-transform overlay wrapper (pointer-events none, round 2).
2. One-way Lock/Visible toggles (live-document inversion, round 2).
3. Reference lost on reopen (launch-path source hydration, round 2).
4. Missing visible rotation handle (D-13 spec stem + knob, round 2), plus the dialog modal redesign + liquid-glass restyle per the user's mockup (round 3).

### Gaps Summary

No gaps. All 6 truths, all 5 requirements, and all 15 decisions are verified against the codebase with passing behavioral tests and approved native UAT. Reveal source mode behavior is deferred to Phase 52 (Shared Mask Compositor and Reveal) and the masked-transform workflow to a future phase — by design under the D-06 HARD LOCK (the mode is flag-only in Phase 50; reference pixels never leak into flattened output before Phase 52 exists).

---

_Verified: 2026-09-01T21:00:40Z_
_Verifier: Claude (gsd-verifier)_
