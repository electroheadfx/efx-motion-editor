---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
  - app/src/types/physicPaint.ts
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---
# Phase 36: Code Review Report

**Reviewed:** 2026-06-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Re-reviewed the Phase 36 scope after commit `71f330e`, focusing on the previously reported browser fallback apply-result path, the roto save-and-advance pending-state race, conversion-control fixes, and the shared apply-result type guard.

The prior browser fallback result path is now resolved: the standalone posts apply payloads to its opener, the parent listener replies to `event.source`, and the standalone consumes `physic-paint:apply-result` message payloads through `isPhysicPaintApplyResultMessage`. The prior save-and-advance race is also resolved for the original failure mode: `pendingRotoAdvanceRef.current` is set before the payload is sent. However, the conversion implementation introduced/left a release-blocking persistence gap: converting Play/Roto state mutates only the standalone window's local store/UI state instead of sending a validated apply operation back to the main editor, so conversion results are lost outside the standalone.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Play/Roto conversion mutates only the standalone store and never reaches the editor

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:808-849`

**Issue:** The newly reachable conversion controls call `convertPlayToRoto` / `convertRotoToPlay`, but those callbacks only mutate `physicPaintStore` and React state inside the Physics Paint standalone window. In both the Tauri and browser-fallback flows, the main editor lives in a separate window/webview with its own JS heap; the reviewed bridge only persists output to the editor when `sendPhysicPaintApplyPayload` is used. `convertPlayToRoto` writes frames with `physicPaintStore.setFrame(...)` on lines 820-823, and `convertRotoToPlay` calls `physicPaintStore.setEditableState(...)` / `removeFrameRange(...)` on lines 840-841, but neither sends an apply payload nor waits for an apply result. The UI can report "Converted" while the main editor/project still contains the previous Play output or Roto frames, causing conversion work to disappear when the standalone closes or the project is saved from the editor.

**Fix:** Route conversions through the same bridge/result path used by save operations, or add explicit validated bridge payloads for conversion operations and apply them in the main editor. For Play-to-Roto, send the converted frame set to the editor and only update local success UI after a matching successful result. For Roto-to-Play, send a bridge operation that removes the target rendered frame range and updates the editable state in the editor-side store; do not rely on direct standalone `physicPaintStore` mutations.

```ts
// Sketch: conversion should not mutate only the standalone store.
const payload: PhysicPaintApplyPayload = {
  operationId,
  kind: 'apply-play-canvas',
  layerId: launchContext.layerId,
  startFrame: launchContext.startFrame,
  frameCount,
  frames: convertedFrames,
  editableState: engine.save(),
};
activeOperationIdRef.current = operationId;
await sendPhysicPaintApplyPayload(payload, bridgeMode);
startApplyTimeout(operationId);
```

## Warnings

### WR-01: Conversion coverage still relies on source-string inspection instead of behavior

**File:** `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts:91-112`

**Issue:** The conversion test still reads `PhysicsPaintWorkflowStrip.tsx` as text and checks snippets. It does not render the component, click the conversion controls, verify the confirmation dialog appears, or assert that `Continue` invokes `onConvertPlayToRoto` / `onConvertRotoToPlay` under real Preact event wiring. This can pass while the conversion flow is broken by JSX structure, conditional rendering, event propagation, or disabled-state behavior.

**Fix:** Add real component interaction coverage using the project's Preact test setup. Render `PhysicsPaintWorkflowStrip` in play mode, click `Convert Play to Roto`, click `Continue`, and assert `onConvertPlayToRoto` fires. Repeat for roto mode and assert missing Play frames disables/prevents the Play-to-Roto callback.

---

_Reviewed: 2026-06-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
