---
status: testing
phase: 55-efx-paint-host-engine-1-host-split
source: [55-VERIFICATION.md]
started: 2026-10-15T09:55:37.331Z
updated: 2026-11-02T09:30:00.000Z
---

## Current Test

number: 6
name: HOST-03 supersession decision
expected: |
  Confirm whether quick 261027-klx's engine-1 retirement (2026-10-27, native UAT approved)
  supersedes Phase 55's HOST-03 / ROADMAP success criterion 1 (pre-split golden parity for
  Physic Paint). If superseded, accept the current tree and record the override. If not
  superseded, define how a runnable parity guard can exist without restoring the removed
  engine-1 package.
awaiting: user response

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

### 6. HOST-03 supersession decision
expected: Confirm whether quick 261027-klx's engine-1 retirement supersedes the pre-split golden-parity contract; if superseded, record the override.
result: [pending]

## Summary

total: 6
passed: 5
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

(none — GAP-55-01 closed by plan 55-10, A2 PASS 2026-10-15)

## Re-verification 2026-11-02

The report was regenerated against the current tree after quick 261027-klx deleted the
pre-split golden fixture, its parity pin, and the efx-physic-paint package. Six of seven
truths verify from live source and passing tests; HOST-03 is the open decision above.
