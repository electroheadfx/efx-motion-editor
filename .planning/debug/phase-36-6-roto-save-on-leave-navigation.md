---
status: investigating
trigger: "Diagnose this Phase 36.6 UAT issue in /Users/lmarques/Dev/efx-motion-editor. Do not edit files. Context: user tested Roto save-on-leave. Test 1 passed: dirty source frame is visible and unsaved. Test 2 failed: when clicking another Roto frame from a dirty source frame, the source frame is saved, but the requested destination frame does not open; UI stays on the original frame. Expected: dirty source frame saves automatically and requested destination opens after save completes."
created: 2026-06-20T00:00:00Z
updated: 2026-06-20T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Confirmed. Save-on-leave queues the requested destination, but the apply-result handler invokes navigateToSyncedFrame through a closure captured while applyStatus is 'applying'; navigateToSyncedFrame rejects navigation whenever applyStatus === 'applying', so the successful save updates the source frame but the queued destination is skipped.
test: Static control-flow trace through requestRotoFrameNavigation -> flushRotoFrame -> handleApplyResult -> navigateToSyncedFrame.
expecting: Source save path succeeds while queued navigation returns false because of the applying guard.
next_action: Return concise diagnose-only report with exact file paths and line numbers.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Dirty Roto source frame saves automatically when clicking another Roto frame, then requested destination opens after save completes.
actual: Source frame is saved, but requested destination frame does not open; UI stays on original frame.
errors: none reported
reproduction: Open Physics Paint in Roto mode, make current source frame dirty, click another Roto frame.
started: Phase 36.6 UAT Test 2

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-20T00:00:00Z
  checked: common bug patterns
  found: Symptom matches Async/Timing and State Management patterns: async save followed by navigation, pending destination queue, and current frame state coordination.
  implication: Investigate stale closure / invalid transition / dual source of truth around dirty source, pending destination, and navigation state.
- timestamp: 2026-06-20T00:00:00Z
  checked: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx:1382-1406
  found: requestRotoFrameNavigation snapshots dirty source, stores targetFrame in pendingRotoAdvanceRef, and calls flushRotoFrame(sourceFrame, { force: true, advanceToFrame: targetFrame }). It does not directly navigate after the save send resolves.
  implication: Destination opening depends on the later apply-result handler consuming pendingRotoAdvanceRef.
- timestamp: 2026-06-20T00:00:00Z
  checked: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx:1460-1496
  found: handleApplyResult marks applyStatus success, saves the source frame, reads nextFrame from pendingRotoAdvanceRef, clears refs, then calls navigateToSyncedFrame(nextFrame).
  implication: Source can be saved even if the post-save navigation call returns false.
- timestamp: 2026-06-20T00:00:00Z
  checked: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx:1361-1380
  found: navigateToSyncedFrame immediately returns false when rotoFlushInFlightRef.current or applyStatus === 'applying'. The callback captures applyStatus in its dependency array.
  implication: During handleApplyResult, React state setApplyStatus('success') has not synchronously changed the captured applyStatus value, so the queued navigation call sees applyStatus === 'applying' and refuses to navigate.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: In /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx, handleApplyResult consumes pendingRotoAdvanceRef after a successful save but calls navigateToSyncedFrame while the navigate callback still has applyStatus === 'applying' captured from the render that initiated the save. navigateToSyncedFrame rejects navigation on applyStatus === 'applying', so save-on-leave saves the source frame but skips the queued destination.
fix: Diagnose-only. Likely fix is to let the post-save advance bypass the applyStatus/flush guard after clearing the active operation, or split guarded user-initiated navigation from internal post-save synced navigation.
verification: static diagnosis only; no edits performed
files_changed: []
