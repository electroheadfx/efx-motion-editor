---
status: complete
phase: 55-efx-paint-host-engine-1-host-split
source: [55-VERIFICATION.md]
started: 2026-10-15T09:55:37.331Z
updated: 2026-10-15T13:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Record a Physic Paint script and Apply it
expected: Loop Clip lands; canvas matches the pre-split golden look
result: PASS

### 2. Play-from-cursor + audible scrub (phase 51 contract)
expected: Play starts at the cursor; scrub is audible. Scrubbing the app timeline (main editor) must play the paint audio snippet.
result: PASS
detail: |
  A2 re-judged PASS after GAP-55-01 fix (plan 55-10). Snippet audible while dragging
  (throttled ~120ms bursts), silent on release, Play-from-cursor plays the clip from
  the cursor. Also confirmed audible in the paint Studio scrub.

### 3. Leave the frame mid-bake and return
expected: Bake completes on return; no torn frame; no orphaned queue
result: PASS

### 4. Save and reopen
expected: Reopened script replays identically with its brush-pack snapshot (envelope)
result: PASS

### 5. Apply a foreign-engine or unreadable script
expected: Named visible refusal; document unchanged
result: PASS

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none — GAP-55-01 closed by plan 55-10, A2 PASS 2026-10-15)
