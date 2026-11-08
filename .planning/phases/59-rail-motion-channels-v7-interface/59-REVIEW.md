---
phase: 59-rail-motion-channels-v7-interface
reviewed: 2026-11-08T18:35:15Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - app/src-tauri/src/services/script_library.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
  - app/src/components/physic-paint/roto/railMotionEvaluator.ts
  - app/src/components/physic-paint/roto/railMotionIdentity.ts
  - app/src/components/physic-paint/roto/railMotionInkScan.ts
  - app/src/components/physic-paint/roto/railMotionModel.ts
  - app/src/components/physic-paint/roto/railMotionPath.ts
  - app/src/components/physic-paint/roto/railMotionPivot.ts
  - app/src/components/physic-paint/roto/railMotionSnapFrames.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/floatingSheetStack.ts
  - app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts
  - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
  - app/src/components/physic-paint/view/physicsPaintHandTool.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/RailMotionPathOverlay.tsx
  - app/src/components/physic-paint/view/railMotionEditingMode.ts
  - app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannelMenuOverlay.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx
  - app/src/components/physic-paint/view/timelineRailDesign.ts
  - app/src/efx-paint/document/efxPaintCanonicalEncoder.ts
  - app/src/lib/efxPaintMediaMaterialize.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/physicPaintStore.ts
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
  necessity: 2
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-11-08T18:35:15Z
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

Incremental standard-depth re-review of the Phase 59 rail-motion surface after the quick-task wave that landed since base `7c23a119c` (261107-eaa..261108-pmc: cycle-cell delete refusal + key-delete dissolve, inside-span `+Key` dissolve, cycle-create slot serialization, authored motion-path overlay, easing table and icons, channel wiggle and apply-all commands, draggable Motion keys, canvas Hand tool, parent/child clip reconciliation, onion SliderStepper migration). Scope came from the diff `7c23a119c..HEAD` (production source only; tests, planning artifacts, lockfiles and skills were excluded from the review list). Previously dispositioned findings (CR-01, WR-01..WR-06, IN-01..IN-05, CR-02..CR-04 in `59-REVIEW-DISPOSITION.md`) were not re-litigated; CR-01's bit-pattern encoder fix was spot-checked and is correct on both sides (`efxPaintCanonicalEncoder.ts:35-47`, `script_library.rs:1291-1293`).

Most of the wave is sound. Verified in context: the snap-frame memo sufficiency (`rasterRevision` covers records/loopClips/breaks, so a motion edit cannot serve a stale cache, and a record gaining its first stop-motion key has no prior entry); the content-vs-raster revision split (`railMotions` in `contentRevision`, excluded from `rasterRevision`); the canonical number parity including `-0` normalization for the JSON transport; the pivot/ink memo split and FIFO bound; the `convert-rail-to-loop` reconciler classification and its fail-closed destination collision; the path-overlay static cache; the hand-tool pointer session and unmount cleanup; the outline geometry math; the rail-identity precedence chain; the `waitForPhysicalEditSlot` bounded wait (never-rejecting, signal-driven, cadence only for the ref-held slot); and the encoding-path `railMotions` propagation through the bridge transport, media materialize and store revision builders.

Four new findings remain. One BLOCKER: the new `delete-key` dissolve branch in the resolver qualifies a whole-Rail-cycle delete on frame ownership alone, and its `referencingClips.every(...)` guard is vacuously true for any real key the clip does not reference, so deleting a detached key inside a canonical cycle silently drops the entire Loop Clip (previously refused). One WARNING: the Motion sheet's "All" easing target commits twice in property mode because `applyEasingToAllKeys` violates its own key-mode-only contract and the `??` chain falls through to `motionEasing.set`. Two necessity Info items cover an unreachable zero-key guard and never-instantiated disabled/reason props.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-05: Deleting a real key the cycle does not reference silently dissolves the entire Rail cycle (vacuous `.every()`)

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5296-5323`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1240-1255` (reachability: `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:1031-1045`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:5037-5068`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5688-5771`)

**Issue:** `resolveDeleteDissolveClip` returns a clip purely on frame ownership — exactly one `clipOwnsFrame` match (`:1194-1208`: frame inside `[phaseOrigin, min(originalEndExclusive, source extent))` and a visible range) plus complete-canonical eligibility. It never checks that the selected key is one of the clip's `sourceKeyIds`. The caller then computes:

```ts
const referencingClips = loopClips.filter((clip) => clip.sourceKeyIds.includes(intent.selectedKeyId));
if (referencingClips.every((clip) => clip.loopId === dissolveClip.loopId)) {
```

For a real key that the clip does **not** reference as a source, `referencingClips` is empty, so `.every(...)` is **vacuously true** and the branch drops the whole Loop Clip through `nextLoopClips` in the same atomic edit as the one-key delete. Repeat count, visible ranges, lifecycle state, and any rail Motion record bound to the loop all leave with it (the reconciler then deletes the loop-bound Motion record). The quick task's own declared law requires "that clip is the **only one referencing the key id**" — here nothing references it, so the dissolve should not fire and the fall-through `isGroupOwnedKeyFrame` refusal at `:5333-5335` (`group-owned-key-delete-rejected`) is the correct outcome.

Reachability is concrete, not theoretical:

1. The timeline drag classifier accepts a `generated` cell as a valid `physical-cell` target (`PhysicsPaintWorkflowStrip.tsx:5037-5068`, `cellKind === 'generated'` → `valid: true`).
2. The resolver's `move-key` branch has no group-ownership destination guard (`:5688-5771`); the direct-cell candidate only rejects out-of-range and real-key occupancy (`:2045-2060`), and a generated cycle frame holds no real key.
3. Dragging a non-source key onto such a frame therefore lands a real key inside a canonical clip's extent without source membership or a `frameOverrides` entry — the "local key the Group extent covers" shape the surrounding comments already describe (`:5330-5332`, and the Key Rail branch at `:5378-5381`), which nq0 treats as a detached key and keeps fail-closed for the paste path.
4. Deleting it classifies the frame as `generated-occurrence` with `repeatInstance === 0` (`physicsPaintRotoGroupLifecycle.ts:464-513`), routes through the selected-key branch as `ordinary-key` (`useRotoTimelineActions.ts:1031-1045`), and reaches this branch.

**Fix:** qualify the dissolve on source membership so only the key the clip actually repeats can dissolve it, and let every other owned key keep the fail-closed G-01 refusal:

```ts
const dissolveClip = resolveDeleteDissolveClip(intent.selectedKeyId, identities, loopClips, input.capacity);
const referencingClips = dissolveClip === null
  ? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY
  : loopClips.filter((clip) => clip.sourceKeyIds.includes(intent.selectedKeyId));
if (dissolveClip !== null
  && dissolveClip.sourceKeyIds.includes(intent.selectedKeyId)
  && referencingClips.every((clip) => clip.loopId === dissolveClip.loopId)) {
  // existing dissolve body
}
```

(or equivalently `referencingClips.length > 0 && referencingClips.every(...)`). Add a resolver row: a canonical clip with a real key at an interpolated first-cycle frame + `delete-key` on that key → `group-owned-key-delete-rejected`, key retained, `nextLoopClips` untouched. If the drag-onto-generated-cell state is meant to be unreachable, add the missing destination guard in `move-key` instead — but the resolver must stay fail-closed either way.

## Warnings

### WR-07: The Motion sheet's "All" easing button commits twice in property mode

**File:** `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx:414-416` (contract: `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts:348-364`; producer: `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:3620-3622`, commit path `:2453-2472`, `:3492-3494`; store early-return `app/src/stores/physicPaintStore.ts:5519-5521`)

**Issue:** The modal's easing control routes the `all` target through:

```ts
const rejection = target === 'key'
  ? keyEasing?.set(easing) ?? null
  : applyToAllKeys?.(easing) ?? bundle.motionEasing?.set(easing) ?? null;
```

The bundle contract says `applyEasingToAllKeys` is "Present ONLY in key mode … null in property-only mode, where the modal renders no apply-all button" (`physicsPaintKeyRailPresentation.ts:348-353`), and the modal repeats that assumption at `:212-214`. The producer violates it: `applyEasingToAllKeys` is returned unconditionally (`useRotoTimelineActions.ts:3620-3622`, comment "in BOTH modes"), while `motionEasing` is non-null in property mode (`:3569-3578`). `commitMotionAllKeysEasing` returns `null` on success (`:3494`), so `??` falls through and the second handle runs `commitMotionAllKeysEasing` again. The second model write is data-idempotent — `canonicalizeRailMotionRecords` allocates new records (`railMotionModel.ts:563-575`) but `replaceRotoPhysicalRailMotions` early-returns `{ ok: true }` on an equal content revision (`physicPaintStore.ts:5519-5521`) — yet `commitRailMotionRecords` still runs `markDocumentSyncDirty()` and `publishMotionDocumentSync()` (`:2465-2470`), i.e. a second full-document serialize plus bridge push, and the success status "Motion easing applied to all keys." is published a second time (`:3492`). Every "All" click in property mode performs two commits; key mode (where `motionEasing` is null) performs one. No data corruption, but duplicated side effects, duplicated user feedback, and the contract/implementation divergence will mislead the next consumer of the bundle.

**Fix:** restore the documented contract — make the apply-all handle key-mode-only, letting `motionEasing.set` own the property-mode click:

```ts
applyEasingToAllKeys: keyMode
  ? (easing: PhysicPaintRotoRailMotionEasing): string | null => commitMotionAllKeysEasing(easing)
  : null,
```

Then the `all` target resolves to exactly one handle in each mode. Add a test that spies on `replaceRotoPhysicalRailMotions` (or counts `publishStatus` calls) and asserts one commit per "All" click in property mode; today it would observe two. Alternatively, drop the `?? bundle.motionEasing?.set(easing)` fallback — but that contradicts the two comments and the presentation contract, so the producer fix is the intended shape.

## Info

### IN-06: Unreachable zero-key guard in the apply-all easing command (necessity)

**Category:** necessity

**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:819-820` (duplicate invariant throw at `app/src/components/physic-paint/roto/railMotionModel.ts:980-983`)

**Issue:** `if (keyCount === 0) return failure('There are no Motion keys to change.');` guards a state that cannot occur for the records this command can receive. The parser rejects a record with zero channels (`railMotionModel.ts:517-519`) and a channel with zero keys (`:331-333`); the D-15 cascade removes a channel when its last key goes and removes the record when no channels remain (`:785-792`); and the only production caller reads `state.records` straight from the store (`useRotoTimelineActions.ts:3482-3488`), which is parse-validated on write (`physicPaintStore.ts:5510-5514`). The same impossible check is repeated inside the model reducer (`railMotionModel.ts:980-983`). Unlike IN-01, the guard's fallback is harmless, so this is dead defensive code rather than a wrong failure mode.

**Fix:** delete the command-level guard (the model throw already documents the invariant), or keep it and document that the command module is exported and must stay safe for externally constructed arrays, with a test that passes an invalid collection. Do not leave both unexplained.

### IN-07: Never-instantiated disabled/reason props on the shared easing control (necessity)

**Category:** necessity

**File:** `app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx:42-48,87-88,116,131-132`

**Issue:** `disabled`, `disabledAll`, `describedById` and `describedByIdAll` are declared, read (`keyDisabled`/`allDisabled`), and wired into each button's `aria-disabled`/`aria-describedby`/click guard, but the only production caller (`PhysicsPaintRailMotionModal.tsx:405-418`) passes none of them — only the component's own test supplies them. The advertised affordance ("the command layer refuses the edit; both buttons grey out with a live reason span") has no instantiation: rejections are reported through the status channel instead. This is generality without an instantiation; the per-key buttons' only real disable condition is `keyFrame === null`.

**Fix:** either project real availability into the control from the bundle (e.g. a `canApplyAll` derived from the command's own predicate) so the grey-out path exists, or delete the four props and their branches and keep the `keyFrame === null` disable. If they are intentionally staged for a later wiring, document the owner and the milestone.

---

_Reviewed: 2026-11-08T18:35:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
