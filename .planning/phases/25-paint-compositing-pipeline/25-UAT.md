---
status: diagnosed
phase: 25-paint-compositing-pipeline
source:
  - 25-01-SUMMARY.md
started: 2026-03-27T20:00:00Z
updated: 2026-03-27T20:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Luma Key Toggle
expected: Open PaintProperties panel. Click Luma Key toggle to ON. Draw a white-filled shape or use existing paint stroke. White areas become transparent, revealing the background beneath.
result: issue
reported: "When I paint a blue brush on white, the paint is transparent instead of being opaque. Luma key should only use white as alpha key."
severity: blocker

### 2. Luma Invert Toggle
expected: With Luma Key already on, click Luma Invert toggle to ON. A black stroke on white background becomes a white opaque stroke (inverted appearance).
result: blocked
blocked_by: other
reason: "Can't change brush color - color is stuck at white, luma key breaks paint editing"

### 3. Non-Destructive Paint Edit
expected: Enter paint mode, draw strokes. Exit paint mode. Re-enter paint mode. Previously drawn strokes are still visible and remain editable.
result: blocked
blocked_by: other
reason: "Can't change brush color - color is stuck at white, luma key breaks paint editing"

### 4. Toggle Persistence
expected: With Luma Key ON, enter and exit paint mode. Luma Key remains ON when you return to paint mode (settings persist within session).
result: blocked
blocked_by: other
reason: "Can't change brush color - color is stuck at white, luma key breaks paint editing"

## Summary

total: 4
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 3

## Gaps

- truth: "Blue paint stroke on white background remains opaque (non-white areas unaffected by luma key)"
  status: failed
  reason: "User reported: When I paint a blue brush on white, the paint is transparent instead of being opaque. Luma key should only use white as alpha key."
  severity: blocker
  test: 1
  root_cause: "Alpha formula 255 - luma makes ALL non-black colors semi-transparent. Blue (luma=18) gets alpha=237, gray (luma=128) gets alpha=127. Only pure black gets full opacity."
  artifacts:
    - path: "Application/src/lib/lumaKey.ts:46"
      issue: "Wrong formula: data[i + 3] = 255 - luma"
    - path: "Application/src/lib/lumaKey.test.ts:137-151"
      issue: "Tests verify buggy formula instead of correct threshold behavior"
  missing:
    - "Replace continuous alpha formula with threshold: luma >= 254 → alpha=0 (transparent), else alpha=255 (opaque)"
    - "Update tests to verify threshold-based luma key"
  debug_session: ".planning/debug/luma-key-blocker.md"

- truth: "Paint strokes remain editable with full color control (luma key should only affect white transparency)"
  status: failed
  reason: "User reported: Can't change stroke color anymore. Tried blue, brush appeared semi-transparent. Can't edit brush properties."
  severity: major
  test: 2
  root_cause: "Same root cause as gap 1 - wrong alpha formula makes all non-white strokes semi-transparent, breaking paint editing."
  artifacts:
    - path: "Application/src/lib/lumaKey.ts:46"
      issue: "Wrong formula: data[i + 3] = 255 - luma"
  missing:
    - "Fix luma key alpha formula to use threshold approach"
  debug_session: ".planning/debug/luma-key-blocker.md"
