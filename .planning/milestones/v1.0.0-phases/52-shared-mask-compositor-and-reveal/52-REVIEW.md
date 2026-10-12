---
phase: 52-shared-mask-compositor-and-reveal
reviewed: 2026-09-02T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
  - app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts
  - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.test.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/stores/efxPaintPersistenceMultiTrackRoundTrip.test.ts
  - app/src/stores/efxPaintStore.photoReference.test.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/viteBuild.test.ts
  - app/vite.config.ts
  - packages/efx-physic-paint/src/types.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 52: Code Review Report

**Reviewed:** 2026-09-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 52 delivers the reveal rail as the 4th rail kind (`railKind: 'reveal'` on `PhysicPaintRotoLoopClip`), the reference-mask bake renderer (`renderRotoRevealFrames` + `compositeRevealMask`), the four store mutations (`createRevealRail`/`replayRevealRail`/`deleteRevealRail`/`resizeRevealRail`) with undo-by-reference, the `PhotoReferenceMode` flag removal, the reveal rail Loop Clip rail surface, both reveal-rail creation paths, and the RVL-05 leak contract test.

The bake mask semantics, the rail-kind allowlist, the mode-free `PhotoReferenceTrack` round-trip, and the RVL-05 token exclusion are all implemented correctly and well-tested. The `compositeRevealMask` transform convention matches the Phase 50 ghost layer (translate → rotate → scale → centered drawImage), so the bake reproduces the reference "as placed".

The main concerns are: (1) the undo-by-reference contract for the reveal mutations restores the document but never rolls back the runtime store, so undo leaves the rail visible and the baked keys alive; (2) the `resizeRevealRail` stretch path is a no-op for the rail extent; (3) the bake resolves the reference only at the span start, breaking frame-aligned resolution for multi-image reference cycles; (4) the strip's `revealCreationRequested` flag is never reset, permanently forcing the reveal-creation surface open in the photo reference dialog.

## Critical Issues

### CR-01: Reveal rail undo-by-reference leaves the runtime store out of sync — undo does not remove the rail

**File:** `app/src/stores/efxPaintStore.ts:1333-1388` (and `replayRevealRail` 1417-1475, `deleteRevealRail` 1482-1522, `resizeRevealRail` 1530-1579)
**Issue:** Every reveal mutation records a `BackgroundEditDescriptor` whose `before`/`after` are document objects by reference. The undo path (`useRotoPhysicalEditHistory.ts:772-786`) restores the document via `registerDocument(entry.descriptor.before)` and never touches the runtime store. Unlike the other background edits (background clips, photo reference source), the reveal mutations ALSO mutate the runtime store: `commitRevealBake` commits the baked `PhysicPaintRotoRealKeyRecord`s and `replaceRotoPhysicalLoopClips` writes the rail clip into `_rotoPhysicalLoopClips`. After undo, the runtime still holds the rail clip and the baked keys. The strip renders rails from the runtime (`PhysicsPaintStudio.tsx:622` reads `physicPaintStore.getRotoPhysicalLoopClips`), so the rail stays visible after undo, and the next `serializeRuntimeIntoDocument` re-projects the orphaned keys back into the document. The RVL-06 tests (`efxPaintStore.reveal.test.ts:209-228`) only assert the document object (`getDocument(layerId)!.tracks[0].rotoPhysical`), never the runtime, so the divergence is not caught.
**Fix:** The reveal mutations must either (a) not record undo entries until the runtime rollback seam exists, or (b) the undo path must re-hydrate the runtime from the restored document (e.g., call `hydrateRuntimeFromDocument`/`installRuntimeStateFromDocument` for the affected track after `registerDocument`). At minimum, add a runtime assertion to the RVL-06 tests (`physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId)` and `getRotoRealKeyRecords` must be empty after undo).

## Warnings

### WR-01: `resizeRevealRail` stretch is a no-op — the rail extent never changes

**File:** `app/src/stores/efxPaintStore.ts:1530-1579`
**Issue:** The rail extent is derived by the resolver as `placementStart + cycleLength × repeat` (no lifecycle on the created clip, `physicsPaintRotoPhysicalResolver.ts:5541-5548`). A stretch (`newEndExclusive` > current end) keeps every key, so `survivingKeyIds` equals the full `sourceKeyIds`, `repeat` stays 1, and no lifecycle fields are set. The rail extent is therefore unchanged, yet the mutation still bumps `documentRevision` and records a `'reveal-span'` undo entry. The D-07 contract ("stretching keeps existing keys and leaves the new frames empty until a voluntary Replay") is not honored — the new frames are never part of the rail.
**Fix:** On a stretch, update the clip's span metadata so the resolver derives the new extent — e.g., set a lifecycle (`phaseOrigin`/`originalEndExclusive`/`visibleRanges`) with `originalEndExclusive = newEndExclusive`, or increase `repeat` to cover the new span. Add a test asserting the derived range's `effectiveEnd` after a stretch.

### WR-02: `commitRevealBake` resolves the reference only at `canonicalStart` — multi-image reference cycles bake the wrong source image

**File:** `app/src/stores/physicPaintStore.ts:1281-1297`
**Issue:** `_resolveReferenceSourceImage(document, input.canonicalStart)` is called once, and the same `verdict.dataUrl` is passed to `renderRotoRevealFrames` for every frame of the span. The D-15 contract is frame-aligned ("Application frame N resolves to source frame N, 1:1 from frame 0, clamped at the sequence end"). For a reveal rail spanning frames 10-12 over a 3-image reference cycle, all three baked keys use the image at source frame 10 instead of images 0/1/2. The bake comment explicitly claims "Frame-aligned reference resolution (D-15)", so this is a contract violation. The tests only exercise single-image references (`registerReferenceSourceImage('ref-a', ...)`), so the multi-image case is untested.
**Fix:** Resolve the reference per frame inside the bake loop (or pass a per-frame resolver into `renderRotoRevealFrames`), so frame `canonicalStart + i` uses `_resolveReferenceSourceImage(document, canonicalStart + i)`. Add a multi-image reference test asserting each baked key carries the frame-aligned image.

### WR-03: `revealCreationRequested` is never reset — the reveal-creation surface permanently opens in the photo reference dialog

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:377, 3871-3874`
**Issue:** The strip's "Reveal" entry sets `revealCreationRequested.value = true` and never resets it. The dialog's controller initializes `revealCreationOpen` from this prop and the dialog effect (`PhysicsPaintPhotoReferenceDialog.tsx:139-141`) re-opens the surface whenever `revealCreationRequested && open`. After the strip entry is used once, every subsequent open of the photo reference dialog (camera icon) shows the reveal-creation surface instead of the normal dialog — the user can never reach the opacity/lock/source controls again without a full Studio remount.
**Fix:** Reset `revealCreationRequested.value = false` when the flow completes (after `createRevealRail` succeeds) or when the dialog closes (`onClose`), or make the dialog consume the one-shot flag (e.g., clear it inside `openRevealCreation`).

### WR-04: `createRevealRail` controller has no try/catch — a throwing store op leaves `revealBusy` stuck true

**File:** `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts:272-301`
**Issue:** `createRevealRail` awaits `createReveal(...)` without a try/catch. The store's `createRevealRail` catches bake errors but does not catch a throwing `_revealScriptLoader` (`efxPaintStore.ts:1327` — `await _revealScriptLoader(input.scriptId)` propagates a rejection). If the loader throws, the controller's promise rejects, `revealBusy.value` stays `true`, and the dialog's Create button is permanently disabled with "Baking…" — the user cannot cancel or retry.
**Fix:** Wrap the `await createReveal(...)` in a try/catch that sets `revealBusy.value = false` and `revealError.value` to a generic failure copy on throw.

### WR-05: Partial-failure atomicity — the bake commits records before the loop clip write, leaving orphaned keys

**File:** `app/src/stores/efxPaintStore.ts:1333-1363` (create), `1488-1502` (delete), `1548-1559` (resize)
**Issue:** The mutations are not atomic across the runtime writes. `createRevealRail` commits the baked records via `commitRevealBake` first, then calls `replaceRotoPhysicalLoopClips`; if the loop clip write fails, the baked keys remain in the runtime with no rail record and no undo entry. `deleteRevealRail` removes the loop clip first, then the records; if the record replacement fails, the rail is gone but its keys remain. `resizeRevealRail` has the same ordering hazard in reverse. Any of these partial states leaves orphaned keys that the next serialize re-projects into the document.
**Fix:** Order the writes so a failure cannot leave orphaned state (e.g., validate the loop clip collection before committing records, or roll back the records on a loop clip failure), and/or return a distinct rejection reason so the caller can recover.

### WR-06: Freshness line does not detect reference transform/source changes — the tooltip can claim "fresh" when the reference moved

**File:** `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts:149-150`
**Issue:** `isFresh` is computed from `lifecycle === 'synchronized' && scriptExists !== false && referencePlaced !== false`. The D-23 freshness contract is "stale — script or reference changed since bake". The implementation only detects script deletion (`scriptExists`) and reference removal (`referencePlaced`), never a reference transform change (`setPhotoReferenceTransform`) or a source image replacement (`setPhotoReferenceSource`). After the user moves the reference, the baked keys are stale but the tooltip still says "baked from current script & reference". The `referencePlaced` boolean is also derived from `photoReference !== null` (`PhysicsPaintStudio.tsx:1992-1994`), which cannot distinguish a moved reference from an unchanged one.
**Fix:** Feed a reference-content token (e.g., `_referenceSourceRevision` plus the transform) into the presentation options and compare it against a bake-time snapshot stored on the rail record, so a transform/source change flips the freshness line to stale.

## Info

### IN-01: `replayDisabledReasonFor` maps `unresolved` to "no reference placed" — copy mismatch

**File:** `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts:341`
**Issue:** An `unresolved` lifecycle (missing source keys) returns `REVEAL_REPLAY_DISABLED_NO_REFERENCE` ("Replay unavailable — no reference placed."). The actual failure is missing source keys, not a missing reference. The copy misleads the user about the cause.
**Fix:** Return a distinct reason for the unresolved case (e.g., "Replay unavailable — source keys missing.") or map it to the script-deleted copy.

### IN-02: `projectPhysicsPaintLoopClipFragmentPresentation` drops the freshness and Replay-disabled lines for reveal rails

**File:** `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts:238-241`
**Issue:** The fragment projection rebuilds `tooltipLines` from `presentation.tooltipLines.slice(0, 5)`, which drops the freshness line (index 5) and the Replay disabled reason (index 6) that reveal rails append after the Status line. A fragmented reveal rail loses its freshness/Replay state from the tooltip.
**Fix:** Preserve the reveal-specific lines when slicing (e.g., keep lines 5-6 when `presentation.freshnessLine` or `presentation.replayDisabledReason` is present).

### IN-03: `yieldToBrowser` abort race — an abort after rAF scheduling resolves instead of rejecting

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:300-312`
**Issue:** If the signal aborts after the `requestAnimationFrame` is scheduled but before the callback runs, the rAF callback resolves the promise (the abort listener is removed first, so the abort is missed). The loop then continues to the next frame where `throwIfAborted` throws, so the abort is eventually honored — but one extra frame of work runs after cancellation.
**Fix:** Check `signal.aborted` inside the rAF callback before resolving, and reject with `AbortError` when aborted.

---

_Reviewed: 2026-09-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
