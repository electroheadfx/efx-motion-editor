---
status: testing
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
source: [46-VERIFICATION.md]
started: 2026-08-24
updated: 2026-08-24
---

## Current Test

number: 1
name: Operation-matrix UAT (same-track half)
expected: |
  copy/cut/paste/duplicate/clear/undo/redo on the default track in the running Studio
awaiting: user response

## Tests

### 1. Operation-matrix UAT (same-track half) — TESTABLE NOW
expected: copy/cut/paste/duplicate/clear/undo/redo on the default track (single-track build; no cross-track path exists yet)
result: [pending]

### 2. Async PlayScript capture — DEFERRED to Phase 47 UAT
expected: Start a long PlayScript render on track A, switch to track B mid-flight; the commit must land on A only; fail-closed 'Track is unavailable.' surface
result: [blocked — needs ≥2 tracks; track CRUD UI is Phase 47 TML-02]

### 3. Track-delete dialog (partial) — TESTABLE NOW
expected: last-track refusal: attempt delete on the only track → refusal message
result: [pending]

### 4. Track-local Hold surface — TESTABLE NOW
expected: Edit a Hold source frame → every linked occurrence updates in place; delete a source → cells become placeholders; clip editor rejects empty/foreign refs in the real timeline
result: [pending]

### 5. Sidecar cleanup on disk — DEFERRED to Phase 47 UAT
expected: After a committed delete + save, verify `cache/efx-paint/<stableLayer>/<trackId>/` is removed and survivor directories remain
result: [blocked — needs an actual delete, which needs ≥2 tracks; track CRUD UI is Phase 47 TML-02]

### 6. F-01 follow-up (recommended) — DEFERRED to Phase 47 UAT
expected: After the follow-up fix, a mid-flight switch between two identical-content tracks before a group-frame-paint commit lands on the captured track
result: [blocked — needs ≥2 tracks; track CRUD UI is Phase 47 TML-02]

## Deferred to Phase 47 UAT (transferred verification debt)

Blocked on track CRUD UI (Phase 47 TML-02 — no add-track path exists in the current build). These items are recorded here so they are not lost; they will be re-run as part of Phase 47 UAT once ≥2 tracks can be created:

- Item 1 cross-track half + auto-activation visual of the target track on undo
- Item 2 (async switch A→B)
- Item 3 delete-with-caches dialog + severed-Hold placeholders
- Item 5 (sidecar cleanup needs an actual delete, needs ≥2 tracks)
- Item 6 (F-01 identical-content switch)

## Summary

total: 6
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 3

## Gaps
