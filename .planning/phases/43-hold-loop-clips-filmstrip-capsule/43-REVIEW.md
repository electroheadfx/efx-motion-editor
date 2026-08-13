---
phase: 43-hold-loop-clips-filmstrip-capsule
reviewed: 2026-08-13T09:53:22Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - app/src/lib/exportEngine.ts
  - app/src/lib/frameMap.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/physicPaintPersistence.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
  - app/src/types/timeline.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/rotoLaunchHydration.ts
  - app/src/components/physic-paint/roto/rotoOnionPreview.ts
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-08-13T09:53:22Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Adversarial review of the Phase 43 (Hold Loop Clips + Integrated Loop Rail) implementation at standard depth. The core physical model, loop range derivation, per-frame resolution, persistence gauntlet, bridge apply path, play-script controller, and history snapshot comparison were traced and verified solid: the four-allowlist parsing, revision fingerprinting (Q1), D-24 boundary scan, D-25 infinity natural end, D-26/D-27 linked resolution, D-28 placeholder variant, operation guards, and lease-token publication all hold up under cross-file tracing.

Three warnings and five info items were found. The most significant is a frame-coordinate mismatch in the D-28 export preflight (WR-01): the guard compares global export frames against layer-local loop ranges, so it both fails open on resume and over-blocks on initial export for sequences with a non-zero `inFrame`. The Loop Clip rail also has a double-click dead zone (WR-02) and overstates the extent of parent-truncated finite loops (WR-03). No critical issues were proven; the remaining items are dead code, cosmetic, and diagnostic noise.

## Warnings

### WR-01: D-28 export preflight compares global export frames against layer-local loop ranges

**File:** `app/src/lib/exportEngine.ts:78` (and `app/src/stores/physicPaintStore.ts:1856`)
**Issue:** `findUnresolvedExportLoop` receives the global export window `[fromFrame, toFrame)` (from `startExport`, `exportEngine.ts:142`) and passes it unchanged to `getRotoPhysicalUnresolvedLoops`, which intersects it against `range.placementStart`/`range.effectiveEnd` — layer-local frames (0-based within the sequence's authored span, offset by `seq.inFrame`; confirmed via `frameMap.ts:130-134` and `getTimelineOverlaySequenceOutFrame` at `frameMap.ts:210-218`). Two failure modes result for any physic-paint sequence with `inFrame > 0`:

1. **Fails open on resume.** A loop occupying layer-local `[0, 10)` in a sequence with `inFrame = 50` plays at global `[50, 60)`. Resuming an export at global frame 55 checks `[55, total)` against layer-local `[0, 10)` — no intersection — so the unresolved loop escapes the guard and placeholder frames are silently written into the deliverable. This defeats the D-28 contract ("a deliverable never silently contains placeholder frames").
2. **Over-blocks on initial export.** A loop at layer-local `[95, 100)` in the same sequence plays at global `[145, 150)`. An export of `[0, 120)` checks `[0, 120)` against layer-local `[95, 100)` — intersection — so a loop that is entirely outside the export range blocks the export with a false positive.

**Fix:** Translate the export window into layer-local coordinates per sequence before querying. In `findUnresolvedExportLoop`, compute `const seqStart = seq.inFrame ?? 0;` and query with `[fromFrame - seqStart, toFrame - seqStart)` (clamped to `>= 0`), or have the store accept a per-sequence offset. The error message should also report the global frame (`placementStart + seqStart`) so the user can locate the offending Group on the timeline.

### WR-02: Double-click dead zone in the Loop Clip rail (220–250 ms)

**File:** `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx:95-108`
**Issue:** `LOOP_CLIP_FAST_DOUBLE_CLICK_MS = 220` and `LOOP_CLIP_SINGLE_CLICK_DELAY_MS = 250`. A second click arriving in the 30 ms window `(220, 250]` is neither a double-click (threshold is `<= 220`) nor a clean single click: `clearPendingSingleClick()` cancels the first click's pending selection, then a new single-click timer is scheduled. The user's double-click intent (open the loop edit dialog) is silently dropped, and the first click's selection is lost. The dead zone is exactly the interval a deliberate double-click most often lands in.

**Fix:** Make the double-click threshold at least as large as the single-click delay (e.g., `LOOP_CLIP_FAST_DOUBLE_CLICK_MS = 250`), or treat any click that arrives while a single-click timer is pending as a double-click (cancel the timer and open the editor) regardless of the exact elapsed time.

### WR-03: Rail and presentation use `requestedEnd` instead of the truncated `effectiveEnd` for finite loops

**File:** `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx:181` and `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts:74-77`
**Issue:** For a finite loop, the rail builds `continuousRange.effectiveEnd = range.requestedEnd` and the presentation computes `effectiveEnd = range.requestedEnd` (both only use `range.effectiveEnd` for `'infinity'`). But the resolver truncates finite loops at the parent end: `effectiveEnd = Math.min(naturalEnd, fragment.endExclusive, boundaryFrame)` (`physicsPaintRotoPhysicalResolver.ts:3313`), and marks `truncated: effectiveEnd < naturalEnd` (line 3327). When a finite loop's requested end exceeds the parent end, the rail clip is drawn wider than the frames that actually resolve (frames past `effectiveEnd` resolve `'empty'`), and the tooltip's `Effective Xf` label overstates the duration. The `truncated` CSS class is applied (line 135) but the geometry ignores the truncation.

**Fix:** Use `range.effectiveEnd` for the rail geometry and the presentation's `effectiveDuration`/`effectiveLabel` for finite loops as well, so the drawn extent and the label match the frames that actually resolve. Keep `requestedEnd` only for the cycle label (`Cycle Nf × R = Df`), which correctly describes the user's intent.

## Info

### IN-01: Dead ternary in `cancelPhysicalEdit`

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:1157`
**Issue:** `reason === 'launch-replacement' ? 'settlement-mismatch' : 'settlement-mismatch'` — both branches are identical, so the conditional is dead. The `reason` parameter only survives into the message string. This reads as a placeholder for a future distinct disposition (e.g., `'cancelled'`) and will mislead maintainers.
**Fix:** Collapse to `finalizeFailed(pending, before, 'settlement-mismatch', ...)`, or introduce a distinct disposition for `'launch-replacement'` if the two paths are meant to differ.

### IN-02: `missingSourceFrame` assumes consecutive source frames

**File:** `app/src/lib/exportEngine.ts:97`
**Issue:** `missingSourceFrame = first.loop.placementStart + (sourceIndex >= 0 ? sourceIndex : 0)` assumes the source cycle occupies consecutive frames `placementStart..placementStart+cycleLength-1`. The resolver's `sourceOffsets` (`physicsPaintRotoPhysicalResolver.ts:3259-3261`) explicitly supports non-consecutive source positions, so the reported frame in the error message can be wrong for a gapped source cycle. The guard itself is unaffected (it uses `missingSourceKeyIds`), so this is message accuracy only.
**Fix:** Report the actual source frame via the range's `sourceOffsets` (e.g., `placementStart + sourceOffsets[sourceIndex]`) when available, falling back to the current approximation.

### IN-03: Formatting defects in `useRotoTimelineActions.ts`

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:1036` and `:1524`
**Issue:** `const prepareRotoKeyDrag = useCallback((movedKeyId, target) => {    const launch = ...` and `function computeForceSpacingAvailability(input) {  if (!input.getLaunchContext ...` — the opening brace and the first statement share a line. Cosmetic, but it breaks the file's otherwise consistent brace style and can confuse tooling that keys on brace placement.
**Fix:** Move the first statement to its own line after the opening brace.

### IN-04: Dense-array assumption for `physicalCells`

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:123`
**Issue:** `input.physicalCells[input.currentAppFrame]?.kind === 'generated'` indexes `physicalCells` by `appFrame`, assuming a dense array. This holds today (the projection materializes a dense capacity-sized array), but the contract is implicit; a future sparse representation would silently change the guard's behavior.
**Fix:** Document the dense-array contract on the `RotoTimelineActionsInput.physicalCells` type, or guard with an explicit bounds check before indexing.

### IN-05: Production `console.error` in the persistence coordinator

**File:** `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts:299`
**Issue:** `console.error('[PhysicsPaintStudio] Roto cache delivery failed', error)` runs in production on every failed bridge delivery. The failure is already tracked in `parentDeliveryErrorRef`/`failedParentPayloadRef` for retry, so the console noise adds no functional value and can flood the console during a sustained bridge outage.
**Fix:** Remove the `console.error` (the refs already record the failure) or gate it behind the existing `profiling` flag.

---

_Reviewed: 2026-08-13T09:53:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
