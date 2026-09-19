---
phase: 49-fixed-background-track-and-imported-loop-clips
reviewed: 2026-09-01T00:00:00Z
depth: deep
files_reviewed: 23
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintBackgroundClipDrag.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintBackgroundClipResize.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts
  - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
  - app/src/efx-paint/compositor/efxPaintCompositor.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 49: Code Review Report

**Reviewed:** 2026-09-01
**Depth:** deep
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Adversarial review of the Phase 49 "Fixed Background Track and Imported Loop Clips" changes (commit range `945e9ca7..HEAD`, 28 commits). Cross-file analysis covered the unified undo/redo ledger (`useRotoPhysicalEditHistory`), the background clip CRUD store ops (`efxPaintStore`), the compositor missing-source fill (`efxPaintCompositor`), the flattened-frame resolution path (`physicPaintStore`), the document parsers, the keyboard shortcut routing, and the S5 sidebar section.

The core design — immutable document by reference, delete-only ledger recording, `bgsrc:` cache-key term, fail-closed missing-source fill — is sound. However, the background undo/redo path has a data-loss defect: it restores/re-applies whole documents by reference with no live-state authority guard, and unrecorded background mutations (add/move/repeat/scale/source/fallback) neither clear the redo stack nor invalidate the recorded `after` snapshot. One BLOCKER and two WARNINGs are reported.

## Critical Issues

### CR-01: Background undo/redo clobbers unrecorded edits (data loss)

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:771-779` (undo), `860-867` (redo)
**Issue:** The `background` undo path pops the entry and calls `registerDocument(entry.descriptor.before)` unconditionally; the redo path re-applies `descriptor.after` unconditionally. Unlike the physical path (line 788), which fails closed via `snapshotReplayAuthorityEqual(getLiveSourceSnapshot(), entry.after)`, the background path has **no live-state authority guard** — it never verifies the current document still matches the recorded `after` snapshot.

This is exploitable because only the delete op records a ledger entry (`recordBackgroundEdit` is called only at `PhysicsPaintStudio.tsx:2561` and `:2922`). Add, move, repeat, scale, source-replace, and fallback ops mutate the document through the store without recording and without clearing the redo stack (the history hook subscribes only to coordinator/referenced-action acceptance streams, never to `efxPaintVersion` or document revision).

- **Undo clobber:** delete clip A (recorded) → add clip B (unrecorded) → Cmd+Z restores the `before` document → clip B is silently lost.
- **Redo clobber:** delete clip A (recorded) → undo → add clip B (unrecorded; redo stack still holds the delete) → redo re-applies the stale `after` document captured before clip B existed → clip B is lost.

Both paths destroy user work that was never part of the undo step.

**Fix:** Add a live-state authority guard to both paths, mirroring the physical path:
```ts
if (entry.kind === 'background') {
  const getLiveDocument = inputRef.current.getLiveDocument;
  if (typeof getLiveDocument !== 'function'
    || getLiveDocument() !== entry.descriptor.after) return false; // fail closed
  appliedRef.current.pop();
  redoRef.current.push(entry);
  registerDocument(entry.descriptor.before);
  publishAvailability();
  return true;
}
```
Additionally, either record every background mutation (add/move/repeat/scale/source/fallback) as a ledger entry, or clear the redo stack on any unrecorded background mutation so a stale `after` can never be re-applied over a newer document.

## Warnings

### WR-01: Parser accepts finite repeat count 0 — uncaught crash at resolution

**File:** `app/src/efx-paint/document/efxPaintDocumentParsers.ts:132`
**Issue:** `parseFrameLoopClip` validates finite repeat with `isNonNegativeInteger(value.repeat.count)`, which **allows count 0**. This is inconsistent with the store (`_isValidRepeat` at `efxPaintStore.ts:594` requires `repeat.count >= 1`) and with the resolver (`isPhysicPaintRotoLoopClip` at `app/src/types/physicPaint.ts:1285` requires `repeat >= 1`). A count-0 document therefore parses successfully but throws inside `deriveEfxPaintBackgroundResolution` — and the call site at `physicPaintStore.ts:1666` has **no try/catch**, so the resolver's strict validation throw propagates uncaught out of `_resolveFlattenedFrame`. The resolver's own comment (`efxPaintBackgroundResolution.ts:90-91`) confirms "count < 1" is expected to fail at derivation time, but the parser is the first gate and lets it through.

**Fix:** Require a positive integer in the parser:
```ts
if (!Number.isInteger(value.repeat.count) || value.repeat.count < 1) {
  throw new Error('FrameLoopClip: finite repeat requires a positive integer count.');
}
```
As defense-in-depth, also wrap the derivation call at `physicPaintStore.ts:1666` in a try/catch that fails closed to a missing background rather than crashing the frame resolution.

### WR-02: Bg delete shortcut fires before roto delete with coexisting selections

**File:** `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:172-180`
**Issue:** The Bg-clip delete branch runs **before** the roto delete branch whenever `state.hasSelectedBackgroundClip` is true. Selection is not mutually exclusive: `onSelectBackgroundClip` (`PhysicsPaintStudio.tsx:3390-3394`) does not clear `selectedKeyId`, and roto key selection does not clear `selectedBackgroundClipId`. A user who selects a roto key, then clicks a Bg rail to inspect it, then presses Delete/Backspace will delete the Bg clip — even though the roto key is still in the primary selection and the user's intent was the roto key. The roto delete path is unreachable while a Bg clip is selected.

**Fix:** Enforce mutual exclusion — clear `selectedKeyId` (and `selectedKeyIds`) when a Bg clip is selected, mirroring how `onSelectTrack` clears `selectedBackgroundClipId` at `PhysicsPaintStudio.tsx:3382`. Alternatively, prefer the roto delete path when a real roto key is in the primary selection and only fall through to the Bg delete when no roto key is selected.

---

_Reviewed: 2026-09-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
