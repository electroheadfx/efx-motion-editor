---
status: testing
phase: 58-rail-editing-regressions
source: [58-VERIFICATION.md]
started: 2026-11-03T15:30:00Z
updated: 2026-11-03T15:30:00Z
---

## Current Test

number: 1
name: Key Rail inspector takeover
expected: |
  In the Studio, selecting a normal Key Rail, double-clicking one, or focusing one
  and pressing Enter replaces the Scripts pane with the inspector showing exactly
  Frames, Keys, Type Standard, an Edit Rail action, and Close. Each entry surface
  opens the reduced modal; Close restores the normal Scripts content.
awaiting: user response

## Tests

### 1. Key Rail inspector takeover
expected: Select / double-click / Enter a normal Key Rail → inspector shows Frames, Keys, Type Standard, Edit Rail, Close; each entry opens the reduced modal; Close restores Scripts.
result: [pending]

### 2. Reduced Cycle modal
expected: Only the Cycle stepper (prefilled 1) and the Infinity switch — no tabs or source controls; Create Cycle commits a gray Standard cycle.
result: [pending]

### 3. Rail-set anchor
expected: Modifier-selecting multiple rails whose first member is a Key Rail shows Edit Rail visibly disabled with "Select a single rail to edit it." and offers no bulk conversion.
result: [pending]

### 4. Cancel during the in-flight window and during committing
expected: Zero writes, no undo entry, the modal stays usable, and a retry commits exactly once — both when cancelling while the authority request is in flight and when cancelling during committing.
result: [pending]

### 5. Single-key drag under Law A on a Motion/Static/Reveal rail
expected: With exactly one loop referencing the cycle, an order-preserving single-key drag is accepted and the cycle re-derives; an order-breaking drag is rejected with the locked rigid-group copy and never shows "Source missing".
result: [pending]

### 6. Enter in the Cycle field
expected: Enter inside the Cycle field confirms exactly once (same as clicking Create Cycle); Escape cancels with zero writes.
result: [pending]

### 7. CR-03 scope decision — partial-cycle group move
expected: Decide whether to fix the pre-existing `move-key-group` order-invariant hole before phase acceptance, or explicitly defer it. Today a partial-cycle group drag past later source keys is accepted and leaves the cycle unresolved ("Source missing", export blocked).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
