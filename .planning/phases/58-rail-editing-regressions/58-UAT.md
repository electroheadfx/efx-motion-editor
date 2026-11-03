---
status: testing
phase: 58-rail-editing-regressions
source: [58-VERIFICATION.md]
started: 2026-11-03T17:56:00Z
updated: 2026-11-03T17:56:00Z
---

## Current Test

number: 1
name: Key Rail inspector takeover (select / double-click / Enter / Close)
expected: |
  In the Studio, selecting a normal Key Rail, double-clicking one, or focusing one
  and pressing Enter replaces the Scripts pane with the inspector showing exactly
  Frames, Keys, Type Standard, an Edit Rail action, and Close. Each entry surface
  opens the reduced modal; Close restores the normal Scripts content.
awaiting: user response

## Tests

### 1. Key Rail inspector takeover (select / double-click / Enter / Close)
expected: Select / double-click / Enter a normal Key Rail → the inspector shows Frames F{first}–F{last}, Keys n, Type Standard, Edit Rail, Close; each entry opens the reduced modal; Close restores the normal Scripts content.
result: [pending]

### 2. Reduced Cycle modal
expected: Only the Cycle stepper (prefilled 1) and Infinity switch; Create Cycle commits a gray Standard cycle; no tabs, rail type, frames-per-cycle, Motion, source-cycle, seed, or Regenerate controls appear.
result: [pending]

### 3. Rail-set anchor
expected: Modifier-selecting two or more rails whose first member is a Key Rail shows Edit Rail visibly disabled with "Select a single rail to edit it." and offers no bulk conversion.
result: [pending]

### 4. Cancel during the in-flight window and during committing
expected: Zero writes, no undo entry, the modal stays usable, and a later Create Cycle commits exactly once — both when cancelling while the authority request is in flight and when cancelling during committing.
result: [pending]

### 5. Single-key Law A drag on a Motion/Static/Reveal rail
expected: With exactly one loop referencing the cycle, an order-preserving single-key drag is accepted and the cycle re-derives; an order-breaking drag is rejected with the locked rigid-group copy and never shows "Source missing".
result: [pending]

### 6. Enter and Escape in the Cycle field
expected: Enter inside the Cycle field confirms exactly once (same as clicking Create Cycle); Escape cancels with zero writes.
result: [pending]

### 7. G-01 repro — surviving-cycle extent
expected: Convert a Motion rail to a Standard (grey) cycle, delete the end keys and change the Cycle count, then close and reopen the Studio. The cycle stops at the surviving source extent: deleted frames render empty (no cached paint), stale paint sheets are gone, and the repaired extent survives reopen. A genuinely dangling source id still presents "Source missing".
result: [pending]

### 8. CR-01 — pasted Infinity rail tail
expected: Copy an Infinity rail whose visible span is not a whole multiple of its cycle length (e.g. keys at 10 and 14, cycle 5, next unowned key at 27), paste it elsewhere, commit, then reopen. The pasted rail renders the full copied visible duration (its 17-frame tail included) and survives the commit and reopen byte-identically; no tail frames are trimmed.
result: [pending]

### 9. WR-01 — lifecycle-gap key delete
expected: Reach a lifecycle gap (a rendered Group frame that later leaves visibleRanges) and press Delete on the real key now sitting on the gap frame: it deletes normally, with no impossible "Delete the Rail frame instead" instruction. Separately, Delete on a visible Group frame stays refused with the locked copy.
result: [pending]

### 10. CR-03 — partial-cycle group drag
expected: Select a partial source-cycle set (e.g. A and B of A..E) and drag the group to an order-preserving destination, then to an order-breaking one. The order-preserving drag is accepted and commits exactly once with the cycle still resolvable; the order-breaking drag is rejected with the locked rigid-group copy, never commits, and never shows "Source missing".
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
