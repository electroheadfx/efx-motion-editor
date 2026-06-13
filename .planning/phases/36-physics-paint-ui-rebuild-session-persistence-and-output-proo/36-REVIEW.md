---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - app/src/assets/physics-paint-ui/icons/LineiconsEraser.svg
  - app/src/assets/physics-paint-ui/icons/MaterialSymbolsUndo.svg
  - app/src/assets/physics-paint-ui/icons/clear-canvas-pencil.svg
  - app/src/assets/physics-paint-ui/icons/paint-mode-normal.svg
  - app/src/assets/physics-paint-ui/icons/paint-mode-physics.svg
  - app/src/assets/physics-paint-ui/icons/physics-all-active-paint.svg
  - app/src/assets/physics-paint-ui/icons/physics-dry-paint.svg
  - app/src/assets/physics-paint-ui/icons/physics-last-stroke.svg
  - app/src/components/physic-paint/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/physicsPaintDevExport.test.ts
  - app/src/components/physic-paint/physicsPaintDevExport.ts
  - app/src/components/physic-paint/physicsPaintSessionFile.test.ts
  - app/src/components/physic-paint/physicsPaintSessionFile.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/physicsPaintWorkflowState.test.ts
  - app/src/components/physic-paint/physicsPaintWorkflowState.ts
  - app/src/components/sidebar/PhysicPaintProperties.tsx
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/physicPaintStore.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/types/physicPaint.test.ts
  - app/src/types/physicPaint.ts
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---
# Phase 36: Code Review Report

**Reviewed:** 2026-06-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the physics-paint UI rebuild, session persistence, bridge, store, types, tests, CSS, and icon assets. The implementation contains several release-blocking correctness defects in the standalone/browser bridge and workflow actions: the documented browser fallback cannot deliver apply payloads, conversion actions are never reachable from the UI, and roto saves optimistically advance even when the editor never applies the payload. One test-quality issue also allows an unreachable workflow to pass source-string contract tests.

## Critical Issues

### CR-01: Browser fallback opens with `noopener`, then relies on `window.opener` for apply delivery

**File:** `app/src/lib/physicPaintBridge.ts:271` and `app/src/components/physic-paint/PhysicsPaintStudio.tsx:163-174`
**Issue:** The non-Tauri launch path opens the standalone window with `noopener,noreferrer`, which intentionally severs `window.opener`. The standalone then classifies itself as `Browser fallback` because `window.dispatchEvent` exists, but `sendPhysicPaintApplyPayload` only dispatches the apply event on the standalone window when there is no opener. The main editor listener is installed in the parent window, so the payload is never delivered and the user hits the 5-second apply timeout. This makes the advertised browser/dev fallback incapable of saving stills or play sequences.
**Fix:** Use a communication mechanism that survives the fallback launch mode. Either keep an opener for same-origin dev fallback or switch both windows to `postMessage`/`BroadcastChannel` with explicit origin checks. For example:
```ts
// If using opener-based same-origin fallback, do not sever opener.
const opened = window.open(
  buildPhysicsPaintUrl(context),
  PHYSIC_PAINT_WINDOW_LABEL,
  'width=1280,height=900'
);

// In the standalone, fail closed when no parent transport exists.
if (bridgeMode === 'Browser fallback') {
  if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
  window.opener.dispatchEvent(new CustomEvent(PHYSIC_PAINT_APPLY_EVENT, { detail: payload }));
  return;
}
```
If `noopener` is required for security, replace the event-dispatch fallback with a same-origin `BroadcastChannel` implemented on both the parent and standalone windows.

### CR-02: Play/Roto conversion callbacks are wired but unreachable

**File:** `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx:118-241`
**Issue:** `PhysicsPaintWorkflowStrip` defines confirmation state and receives `onConvertPlayToRoto` / `onConvertRotoToPlay`, but the only references to `setConfirmation` initialize state and cancel/close the dialog. No button or handler ever sets `confirmation` to `convert-play-to-roto` or `convert-roto-to-play`, so the confirmation dialog and both conversion callbacks are dead code. Users cannot perform either conversion despite `PhysicsPaintStudio` passing functional handlers at lines 1115-1116.
**Fix:** Add explicit conversion controls that set the confirmation state, with disabled states matching the current mode/readiness. For example:
```tsx
<button
  type="button"
  class="physics-paint-text-button"
  disabled={props.mode !== 'play'}
  onClick={() => setConfirmation('convert-play-to-roto')}
>
  Convert Play to Roto
</button>
<button
  type="button"
  class="physics-paint-text-button"
  disabled={props.mode !== 'roto'}
  onClick={() => setConfirmation('convert-roto-to-play')}
>
  Convert Roto to Play
</button>
```
Then cover these controls with an interaction test that clicks the button, confirms, and asserts the corresponding callback fires.

### CR-03: Roto save advances and marks frames saved before the editor confirms apply success

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:597-735`
**Issue:** `saveRotoFrame` marks the current frame as saved and returns a payload immediately after dispatching it, then `saveRotoFrameAndAdvance` navigates to the next frame before `PHYSIC_PAINT_APPLY_RESULT_EVENT` confirms success. If the bridge listener rejects the payload, the Tauri/browser message fails, or the editor times out, the standalone has already cleared/loaded the next frame and reports the original frame as saved locally. This creates incorrect UI state and risks users continuing work under the assumption that the previous frame was committed to the main project.
**Fix:** Only advance and mark the frame as saved after the matching successful apply result. One approach is to await a per-operation result promise before returning success from `saveRotoFrame`:
```ts
const result = await sendPhysicPaintApplyPayloadAndWaitForResult(payload, bridgeMode);
if (!result.ok) throw new Error(result.error ?? 'Apply failed');
setSavedRotoFrames((frames) => [
  ...frames.filter((frame) => frame.frame !== launchContext.startFrame),
  { frame: launchContext.startFrame, saved: true, label: `Frame ${launchContext.startFrame}` },
].sort((a, b) => a.frame - b.frame));
return payload;
```
Alternatively, keep the optimistic local state but do not call `navigateToSyncedFrame(nextFrame)` until `handleApplyResult` receives the matching successful still-apply result.

## Warnings

### WR-01: Source-string tests allow unreachable workflow code to pass

**File:** `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts:91-104`
**Issue:** The destructive-conversion test only checks that labels and callback names appear in the source file. It does not verify that conversion controls render, that `setConfirmation` is reachable, or that confirming invokes `onConvertPlayToRoto` / `onConvertRotoToPlay`. This is why the dead conversion workflow in CR-02 passes tests.
**Fix:** Replace the source-contract assertion with a rendered interaction test using Preact Testing Library (or the project’s UI test helper). Render `PhysicsPaintWorkflowStrip`, click the conversion button, click Continue in the confirmation dialog, and assert the callback was called; also assert missing Play frames disables the Play→Roto confirmation.

---

_Reviewed: 2026-06-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
