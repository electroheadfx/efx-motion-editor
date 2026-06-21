---
status: resolved
trigger: "Phase 36.6 regression: Dirty Roto Close saving saves but does not close the efx-physics paint window."
created: 2026-06-21T00:00:00Z
updated: 2026-06-21T09:02:00Z
---

## Current Focus

hypothesis: Unknown; need runtime-oriented evidence around the dirty Roto save continuation and Tauri close request ordering.
test: Gather code/runtime evidence for saveAndCloseRotoFrame, handleApplyResult, close-ready effect, closePhysicsPaintWindow, and native onCloseRequested.
expecting: Identify whether close continuation is never reached, programmatic close is blocked by the close guard, dirty state remains true, or appWindow.close fails.
next_action: gather initial evidence
reasoning_checkpoint: 
tdd_checkpoint: 

## Symptoms

expected: In efx-physics paint Roto mode, clicking “Close saving” in the “Close unsaved Roto frame?” modal saves the current Roto frame and then closes the physics paint window/dialog.
actual: Clicking “Close saving” saves the current Roto frame successfully, but the window/dialog does not close.
errors: No visible error reported. Screenshot: /Users/lmarques/Desktop/Capture d’écran 2026-06-21 à 08.05.29.png
timeline: Regression observed after Phase 36.6 dirty Roto close-save fixes. Commits b338948e, 9a467a98, and 4d4390a2 passed source-contract tests and typecheck but did not fix runtime behavior.
reproduction: Open efx-physics paint in Roto mode, make the current Roto frame dirty, trigger close so the dirty-close modal appears, click “Close saving”, observe save succeeds but the window remains open.

## Relevant Files

- app/src/components/physic-paint/PhysicsPaintStudio.tsx
- app/src/components/physic-paint/PhysicsPaintStudio.test.ts

## Important Functions and State

- closePhysicsPaintWindow
- saveAndCloseRotoFrame
- saveRotoFrame
- flushRotoFrame
- handleApplyResult
- closeAfterApplyOperationIdRef
- closeGuardBypassRef
- closeAfterRotoSaveRequestedRef
- closeAfterRotoSaveReady
- rotoClosePromptState
- setApplyStatus / setApplyMessage progress/status updates

## Prior Attempts

- b338948e fix(36.6): close after dirty roto save completes
  - Added onPayload callback through flushRotoFrame / saveRotoFrame.
  - Close saving registers closeAfterApplyOperationIdRef as soon as payload is created.
  - Goal: avoid fast apply-result arriving before close-after marker is set.
  - Tests passed, runtime still does not close.
- 9a467a98 fix(36.6): preserve dirty close intent through save
  - Added closeAfterRotoSaveRequestedRef.
  - Native close handler ignores close requests while close-saving intent is active.
  - Successful apply clears modal state and tries to close.
  - Tests passed, runtime still does not close.
- 4d4390a2 fix(36.6): close dirty roto after save render settles
  - Added closeAfterRotoSaveReady state.
  - Moved actual closePhysicsPaintWindow() call out of handleApplyResult into a post-render useEffect.
  - Goal: avoid progress/status re-render interrupting close.
  - Tests passed, runtime still does not close.

## Hypotheses

- hypothesis: closePhysicsPaintWindow() is called, but Tauri appWindow.close() triggers onCloseRequested again before or after refs update and the handler prevents close.
  status: untested
- hypothesis: closeGuardBypassRef.current is reset by a re-render/session reset before the close request is processed.
  status: untested
- hypothesis: close-ready useEffect never runs because component/window state changes during save result handling.
  status: untested
- hypothesis: save result path never reaches shouldCloseAfterSave === true in actual runtime despite source-contract assumptions.
  status: untested
- hypothesis: appWindow.close() rejects/fails silently; closePhysicsPaintWindow lacks runtime visibility for close failure.
  status: untested
- hypothesis: dirty state remains true after save in native close handler, so programmatic close gets blocked again.
  status: untested

## Suggested Instrumentation

- saveAndCloseRotoFrame: click received, current frame, dirtyRotoFramesRef contents, payload operationId, closeAfterApplyOperationIdRef.current, closeAfterRotoSaveRequestedRef.current.
- handleApplyResult: detail operationId/kind/startFrame/ok, activeOperationIdRef, pendingApplyRef, shouldCloseAfterSave, rotoClosePromptState before/after, closeGuardBypassRef, closeAfterRotoSaveReady.
- close-ready effect: whether effect runs, closeGuardBypassRef before close, result/error of closePhysicsPaintWindow.
- native onCloseRequested: whether it fires during programmatic close, closeGuardBypassRef, closeAfterRotoSaveRequestedRef, dirty state, whether it calls event.preventDefault().

## Eliminated


## Evidence

- timestamp: 2026-06-21T08:28:57Z
  observation: TDD contract failed red before the fix. Existing code let applyIncomingLaunchContext/resetRotoSessionForLaunch clear dirty close-save continuation state during the apply-result launch-context refresh.
- timestamp: 2026-06-21T08:30:22Z
  observation: After preserving close-after-save state across launch-context refresh, PhysicsPaintStudio.test.ts passed and app typecheck passed, but live testing still showed the window stayed open.
- timestamp: 2026-06-21T08:37:30Z
  observation: Preserving pendingApplyRef alongside close-save flags was necessary for recognizing the matching successful apply result, but live testing still failed while the actual close was deferred through closeAfterRotoSaveReady/useEffect.
- timestamp: 2026-06-21T08:48:32Z
  observation: Historical comparison showed the originally working dirty-close implementation called closePhysicsPaintWindow directly from handleApplyResult after setting closeGuardBypassRef. Commit 4d4390a2 moved that direct close into a post-render closeAfterRotoSaveReady effect. Restoring direct close still passed tests but live testing still failed because the close authority was still inside the child paint window UI/render cycle.
- timestamp: 2026-06-21T09:01:00Z
  observation: Final working fix moved close authority to the main editor apply listener. Close saving marks the apply-canvas payload with closeWindowAfterApply. After the main app successfully applies the payload and emits the apply result, it closes/destroys the native efx-physic-paint window by label. User confirmed live flow works.

## Resolution

root_cause: The regression was caused by keeping the close continuation inside the standalone PhysicsPaintStudio UI/render cycle after save-on-leave changes. The Roto save completed, but progress/modal/relaunch/render updates in the child paint window could interrupt or lose the child-side close request, leaving the native window open.
fix: Make close-after-save a main-app responsibility. The child marks the explicit Close saving payload with closeWindowAfterApply; the main apply listener applies the payload, emits the result, then destroys the native efx-physic-paint window by label. This removes dependence on child-window useEffect/progress modal state for closing.
verification: User confirmed live Close saving flow now closes after save; pnpm --dir app exec vitest run PhysicsPaintStudio.test.ts; pnpm --dir app exec vitest run physicPaintBridge.test.ts; pnpm --dir app exec vitest run physicPaint.test.ts; pnpm --dir app typecheck
files_changed: ["app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/lib/physicPaintBridge.ts", "app/src/lib/physicPaintBridge.test.ts", "app/src/types/physicPaint.ts", "app/src/types/physicPaint.test.ts"]
