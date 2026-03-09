---
status: diagnosed
phase: 03-project-sequence-management
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md
started: 2026-03-09T14:00:00Z
updated: 2026-03-09T14:10:00Z
round: 2
previous_issues: 5 (all resolved via plans 04-08)
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Welcome Screen Recent Projects
expected: On app launch, Welcome Screen appears with "New" and "Open" buttons. Recent projects list shows readable text (project names and dates clearly visible against dark background). Projects that no longer exist show "Not found" with dimmed cursor. Clicking an available project opens it in the editor.
result: pass

### 2. Create New Project
expected: Click "New" on Welcome Screen. Dialog appears with project name input, FPS toggle (15/24), and folder picker. Fill in details and confirm. App transitions to editor with empty project — left panel shows a default sequence with no key photos.
result: pass

### 3. Sequence CRUD (Create, Rename, Duplicate, Delete)
expected: Create a new sequence — appears in list. Double-click name to rename inline (Enter confirms, Escape cancels). Open context menu (action button) — Duplicate creates a copy. Create or duplicate until you have 3+ sequences. Delete the 3rd sequence via context menu — it removes without errors.
result: pass

### 4. Sequence Drag Reorder
expected: With 3+ sequences, grab the drag handle and drag a sequence to a new position. The sequence moves and the new order persists (doesn't snap back). File import overlay does NOT appear during the drag.
result: pass

### 5. Sequence Context Menu Overlay
expected: With enough sequences to cause scrolling, click the action button on a sequence. Context menu appears as a floating overlay — no extra scrollbar in the sequence list, menu is not clipped by panel boundaries.
result: pass

### 6. Add Key Photos from Picker
expected: Click the "+" add button next to the key photo strip. A popover opens upward showing imported images in a 4-column grid (max 300px height). Click an image to add it. Repeat to add 2nd, 3rd key photos — add button continues working each time.
result: issue
reported: "all work except I don't want the plus button in place of key image place, I want a '+' at top of horizontal keys image list, allow me to have a window of 3 image thumbs instead of two."
severity: minor

### 7. Key Photo Select and Arrow Reorder
expected: Click a key photo in the strip — it gets a visible selection ring. Press ArrowLeft/ArrowRight to move it. Strip scrolls to keep the moved photo visible. Click a different photo to change selection.
result: issue
reported: "Arrow keys work but ArrowLeft/ArrowRight also move the timeline cursor simultaneously. Remove arrow key shortcuts for key photos. Instead add left/right buttons on the image to move its order. Re-add drag-and-drop reorder (should work now with 3-thumb strip from test 6 fix)."
severity: minor

### 8. Key Photo Hold Frames and Remove
expected: Key photo card shows hold frame count. Click/edit the value to change it, press Enter to confirm. Hover over a key photo — remove/X button appears. Click it to remove the key photo.
result: pass

### 9. Per-Sequence Settings (FPS and Resolution)
expected: Select a sequence. FPS toggle shows 15 or 24 — clicking switches. Resolution dropdown offers presets (1920x1080, 1280x720, etc.). Changes apply to selected sequence only.
result: pass

### 10. Save, Reopen, and Auto-Save
expected: Click Save — .mce file saves (Save As dialog if first save). Close and reopen the .mce file — all sequences, key photos, and settings restored. After making changes, dirty indicator dot appears in toolbar; auto-save fires after ~2s and clears it.
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Add key photo button is positioned at the start of the horizontal strip and strip shows 3 thumbnails"
  status: failed
  reason: "User reported: plus button takes the place of a key image slot (dashed border placeholder). Want '+' at top/start of horizontal list, and want visible window to fit 3 thumbnails instead of 2."
  severity: minor
  test: 6
  root_cause: "AddKeyPhotoButton rendered AFTER scroll container in flex layout (line 109). Strip only fits 2 cards due to gap-1.5 spacing in 268px panel width."
  artifacts:
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      issue: "Line 109: '+' button at end of flex. Lines 89-92: gap-1.5 too wide for 3 cards in available space."
  missing:
    - "Move AddKeyPhotoButton BEFORE the scroll container (left side of strip)"
    - "Reduce gap from gap-1.5 to gap-1 to fit 3 thumbnails"
  debug_session: ""

- truth: "Key photos can be reordered via left/right buttons and drag-and-drop without interfering with timeline"
  status: failed
  reason: "User reported: ArrowLeft/ArrowRight also move timeline cursor simultaneously. Remove arrow key shortcuts. Add left/right buttons on the image instead. Re-add drag-and-drop reorder (should work with wider 3-thumb strip)."
  severity: minor
  test: 7
  root_cause: "handleKeyDown (lines 61-86) calls preventDefault but event still propagates to timeline. No visible move buttons exist on cards. SortableJS drag was removed in plan 08."
  artifacts:
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      issue: "Lines 61-86: arrow key handler conflicts with timeline. No move buttons on cards. SortableJS removed."
  missing:
    - "Remove handleKeyDown and onKeyDown from strip container"
    - "Add left/right hover buttons on KeyPhotoCard (like existing remove button)"
    - "Re-add SortableJS with forceFallback:true and DOM revert pattern from SequenceList"
  debug_session: ""
