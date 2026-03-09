---
status: complete
phase: 03-project-sequence-management
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md
started: 2026-03-09T14:00:00Z
updated: 2026-03-09T15:00:00Z
round: 3
previous_issues: 2 (resolved via plan 09)
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Add button position and 3-thumbnail strip
expected: The '+' add button appears at the LEFT of the key photo strip as a compact pill. The strip shows 3 thumbnail cards (72px wide) without horizontal scrolling. Clicking '+' opens the image picker popover upward. Adding images works repeatedly.
result: issue
reported: "plus button is in the wrong place, it takes place for photos. Want the '+' on the title bar 'KEY PHOTOS' at RIGHT TOP on the thumbnails horizontal list bar, not inside the strip."
severity: minor

### 2. Move buttons and drag reorder
expected: Hovering a key photo card reveals left/right move buttons (not at boundaries — leftmost has no left button, rightmost has no right button). Clicking a move button reorders the card. Cards can also be reordered by drag-and-drop. Arrow keys do NOT move key photos or interfere with the timeline cursor.
result: issue
reported: "Perfect, all logic works. Move left/right and delete buttons out of the thumb cards and into the 'KEY PHOTOS' title bar — shown only when a key photo is selected. Example: KEY PHOTOS < X > with left/delete/right in the title bar. Also bring back key thumb selection (click to select)."
severity: cosmetic

### 3. External drag-and-drop vs internal drag
expected: Dragging image files from the OS file manager onto the app shows a drop overlay and imports images. Internal SortableJS drags (reordering key photos or sequences) do NOT trigger the file import overlay.
result: pass

### 4. Full round-trip persistence
expected: After making changes (add key photos, reorder them, change hold frames, adjust FPS/resolution), save the project. Close and reopen the .mce file — all data restores exactly: sequence order, key photo order, hold frames, FPS, resolution, and image references.
result: pass

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Add key photo '+' button is positioned in the KEY PHOTOS title bar at the right, not inside the thumbnail strip"
  status: failed
  reason: "User reported: plus button is in the wrong place, it takes place for photos. Want the '+' on the title bar 'KEY PHOTOS' at RIGHT TOP on the thumbnails horizontal list bar, not inside the strip."
  severity: minor
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Move/delete buttons appear in the KEY PHOTOS title bar when a key photo is selected, not overlaid on the thumbnail cards"
  status: failed
  reason: "User reported: move left/right and delete buttons should be in the 'KEY PHOTOS' title bar (shown on selection), not on the thumb cards. Bring back click-to-select on key photos. Layout: KEY PHOTOS < X >"
  severity: cosmetic
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
