---
status: testing
phase: 60-studio-timeline-horizontal-zoom
source: [60-VERIFICATION.md]
started: 2026-11-09T15:00:00Z
updated: 2026-11-09T15:00:00Z
---

## Current Test

number: 1
name: Cmd/Ctrl+wheel and trackpad pinch zoom over the Studio timeline at several cursor positions; then a plain vertical wheel tick
expected: |
  The frame under the cursor stays fixed through each zoom step, pinch takes the same anchored path, and the plain wheel still scrolls the timeline horizontally
awaiting: user response

## Tests

### 1. Wheel and pinch zoom feel + cursor anchoring
test: Cmd/Ctrl+wheel and trackpad pinch zoom over the Studio timeline at several cursor positions; then a plain vertical wheel tick
expected: The frame under the cursor stays fixed through each zoom step, pinch takes the same anchored path, and the plain wheel still scrolls the timeline horizontally
why_human: Live gesture feel and macOS pinch delivery cannot be asserted from jsdom/node (60-VALIDATION manual-only row, ZOOM-01)
result: [pending]

### 2. Scroll-snap settle after an anchored zoom
test: Repeated pill and Fit zooms over a rail near the right edge, then let the scroll settle
expected: The playhead/cursor frame does not jump after the write settles; mandatory scroll-snap does not quantize the anchored offset
why_human: The scroll-snap interaction after an anchored zoom is the 60-VALIDATION manual-only row (RESEARCH A2, review finding WR-01); no automated test resolves it
result: [pending]

### 3. Visual check at 25%, 100% and 400%
test: Visual check of the Studio timeline at 25%, 100% and 400% (pill zoom plus Fit)
expected: Non-active row and Bg cells align with the active lane at every level, ruler labels and tick marks sit on the live cell centre, the current-frame marker covers the live cell width, rail/ghost spans cover the same frames, and the pill reads as one control group
why_human: CSS inheritance and visual composition are not visible to the node matrix; the post-plan source fixes (c59b775bf, 65a932045, e37f7e49d) are code-verified but their rendered result is a UAT row
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
