---
status: testing
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
source: [46-VERIFICATION.md]
started: 2026-08-24
updated: 2026-08-24
---

## Current Test

number: 1
name: Operation-matrix UAT
expected: |
  copy/cut/paste/duplicate/clear/undo/redo × same-track × cross-track in the running Studio,
  including the auto-activation visual of the target track on undo
awaiting: user response

## Tests

### 1. Operation-matrix UAT
expected: copy/cut/paste/duplicate/clear/undo/redo × same-track × cross-track in the running Studio, including the auto-activation visual of the target track on undo
result: [pending]

### 2. Async PlayScript capture
expected: Start a long PlayScript render on track A, switch to track B mid-flight; the commit must land on A only; fail-closed 'Track is unavailable.' surface
result: [pending]

### 3. Track-delete dialog
expected: Delete a track with accepted caches: dialog states the frame count, confirm removes track + no orphan sidecars on disk after the next save; last-track refusal message; Hold cells answer unresolved placeholders
result: [pending]

### 4. Track-local Hold surface
expected: Edit a Hold source frame → every linked occurrence updates in place; delete a source → cells become placeholders; clip editor rejects empty/foreign refs in the real timeline
result: [pending]

### 5. Sidecar cleanup on disk
expected: After a committed delete + save, verify `cache/efx-paint/<stableLayer>/<trackId>/` is removed and survivor directories remain
result: [pending]

### 6. F-01 follow-up (recommended)
expected: After the follow-up fix, a mid-flight switch between two identical-content tracks before a group-frame-paint commit lands on the captured track
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
