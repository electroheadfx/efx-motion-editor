---
status: testing
phase: 60-studio-timeline-horizontal-zoom
source: [60-VERIFICATION.md]
started: 2026-11-09T15:00:00Z
updated: 2026-11-09T17:30:00Z
---

## Current Test

number: 4
name: The fourth pill control shows the timeline at 100% zoom
expected: |
  The control is the lucide square-dimensions icon with no text label, matched to the minus/plus nav-button treatment; its tooltip reads "Show timeline at 100% zoom" and pressing it returns the density to 100% with the playhead kept in view
awaiting: user response

## Tests

### 1. Wheel and pinch zoom feel + cursor anchoring
test: Cmd/Ctrl+wheel and trackpad pinch zoom over the Studio timeline at several cursor positions; then a plain vertical wheel tick
expected: The frame under the cursor stays fixed through each zoom step, pinch takes the same anchored path, and the plain wheel still scrolls the timeline horizontally
why_human: Live gesture feel and macOS pinch delivery cannot be asserted from jsdom/node (60-VALIDATION manual-only row, ZOOM-01)
result: passed

### 2. Scroll-snap settle after an anchored zoom
test: Repeated pill and Fit zooms over a rail near the right edge, then let the scroll settle
expected: The playhead/cursor frame does not jump after the write settles; mandatory scroll-snap does not quantize the anchored offset
why_human: The scroll-snap interaction after an anchored zoom is the 60-VALIDATION manual-only row (RESEARCH A2, review finding WR-01); no automated test resolves it
result: passed

### 3. Visual check at 25%, 100% and 400%
test: Visual check of the Studio timeline at 25%, 100% and 400% (pill zoom plus Fit)
expected: Non-active row and Bg cells align with the active lane at every level, ruler labels and tick marks sit on the live cell centre, the current-frame marker covers the live cell width, rail/ghost spans cover the same frames, and the pill reads as one control group
why_human: CSS inheritance and visual composition are not visible to the node matrix; the post-plan source fixes (c59b775bf, 65a932045, e37f7e49d) are code-verified but their rendered result is a UAT row
result: issue — the in-between "-" glyph sat left of centre above 100%. Fixed in 7c55ea4c4 (dash centred and proportionally wide on the live cell); needs a re-check.
fixed_in: 7c55ea4c4

### 4. Fourth pill control = "Show timeline at 100% zoom"
test: Hover the last control in the timeline zoom pill, then press it from a non-100% level
expected: The control is the lucide square-dimensions icon (no "Fit" text), wears the same nav-button treatment as minus/plus, its tooltip reads "Show timeline at 100% zoom", and pressing it returns the density to exactly 100% with the playhead kept in view
why_human: Icon choice, tooltip wording and pill composition are visual
result: [pending]
fixed_in: 7c55ea4c4, superseded by the 100% reset rework

### 5. Zoom persists per paint layer across close/reopen
test: Zoom a paint layer's timeline to a non-100% level, close the Studio, reopen the same paint layer; then open a different paint layer
expected: The reopened layer returns to the level it was left at; a different paint layer opens at its own remembered level (or 100% the first time), never inheriting another layer's zoom
why_human: The Studio window is destroyed on close and rebuilt on open, so this is a cross-webview behaviour that only the packaged app can prove
result: [pending]
fixed_in: 7c55ea4c4

## Summary

total: 5
passed: 2
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

- 2026-11-09: in-between dash centring reported at >100% zoom — fixed in 7c55ea4c4, awaiting re-check.
- 2026-11-09: Fit was a text button; replaced with the square-dimensions icon at the user's request — awaiting re-check.
- 2026-11-09: zoom reset on every Studio open; now remembered per paint layer in localStorage (the webview is destroyed on close) — awaiting re-check.
