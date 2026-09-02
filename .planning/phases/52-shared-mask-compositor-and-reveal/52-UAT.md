---
status: testing
phase: 52-shared-mask-compositor-and-reveal
source: [52-VERIFICATION.md]
started: 2026-09-02T19:10:00Z
updated: 2026-09-02T19:10:00Z
---

## Current Test

number: 1
name: Abort the reveal bake mid-span and verify no keys are written and the document is unchanged
expected: |
  The bake aborts cleanly; no baked keys appear; the document revision is not bumped
awaiting: user response

## Tests

### 1. Abort the reveal bake mid-span
expected: The bake aborts cleanly; no baked keys appear; the document revision is not bumped
result: [pending]

### 2. Native UAT: modal "Reveal with script…" flow (RVL-01)
expected: Place a reference, paint, save a script, run "Reveal with script…" from the photo-reference modal; the reveal rail appears on the current track with baked keys and the onProgress bar runs during the bake.
result: [pending]

### 3. Native UAT: track rail-creation flow (RVL-01)
expected: Create a reveal rail from the track rail-creation flow (Create rail → Reveal) and verify it lands baked through the same mutation as the modal path.
result: [pending]

### 4. Native UAT: reveal rail visual look (RVL-04)
expected: The reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
