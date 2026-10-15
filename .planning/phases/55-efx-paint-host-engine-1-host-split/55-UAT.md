---
status: complete
phase: 55-efx-paint-host-engine-1-host-split
source: [55-VERIFICATION.md]
started: 2026-10-15T09:55:37.331Z
updated: 2026-10-15T09:56:16.437Z
---

## Current Test

[testing complete]

## Tests

### 1. Record a Physic Paint script and Apply it
expected: Loop Clip lands; canvas matches the pre-split golden look
result: PASS

### 2. Play-from-cursor + audible scrub (phase 51 contract)
expected: Play starts at the cursor; scrub is audible. In the paint editor ("le son du paint") an audio snippet must be heard while scrubbing.
result: FAIL
detail: |
  Play-from-cursor works. Audible scrub is SILENT on the paint-editor surface —
  no audio snippet while scrubbing ("le son du paint"). The user reports the scrub
  audio is gone on the editor surface.

  Measured scope check: Phase 55 changed 0 files matching audio|scrub|sound|waveform|
  transport (`git diff dev...HEAD`). Not a host-split regression — same latent class
  as the parked "Unknown physics paint layer" debug
  (.planning/debug/roto-unknown-physic-layer.md).

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
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### GAP-55-01 — audible scrub silent in the paint editor (A2)

- row: A2
- surface: paint editor ("le son du paint")
- expected: audible audio snippet while scrubbing (phase 51 audible-scrub contract)
- actual: scrub is silent on the editor surface
- severity: blocks phase close — A2 is a must-have UAT row
- scope: NOT a Phase 55 host-split regression. `git diff dev...HEAD` shows 0 files
  matching audio|scrub|sound|waveform|transport. Same latent class as
  `.planning/debug/roto-unknown-physic-layer.md` (session-scoped / pre-existing,
  exposed by live UAT).
- next: `/gsd-plan-phase 55 --gaps` creates a `gap_closure: true` plan for this row.
  Do not close Phase 55 while this gap is open.
