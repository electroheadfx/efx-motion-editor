---
status: resolved
phase: 03-project-sequence-management
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-03-09T11:30:00Z
updated: 2026-03-09T13:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Welcome Screen
expected: On app launch, you see a Welcome Screen (not the editor). It shows "New" and "Open" buttons. If you've previously created projects, a recent projects list appears.
result: issue
reported: "1) Recent projects list is greyed out (transparent dark gray), not easily readable - should be fully legible. 2) Projects in the list can't be opened by clicking them."
severity: major

### 2. Create New Project
expected: Click "New" → a dialog appears with project name input, FPS toggle (15/24), and a folder picker. Fill in details and confirm → the app transitions to the editor with an empty project.
result: pass

### 3. Create and Rename Sequence
expected: In the left panel, create a new sequence (it appears in the list). Double-click the sequence name → it becomes editable. Type a new name, press Enter → name updates. Escape cancels the edit.
result: pass

### 4. Sequence Context Menu (Duplicate & Delete)
expected: Right-click a sequence → context menu with Rename, Duplicate, Delete. Duplicate creates a copy of the sequence. Delete removes it (with confirmation if applicable).
result: issue
reported: "Rename, duplicate and delete work fine until the 2nd sequence. When a third sequence is created or duplicated, it can't be deleted."
severity: major

### 5. Reorder Sequences via Drag
expected: Drag a sequence by its handle to a new position. The order updates correctly. The file import overlay does NOT appear during the drag.
result: issue
reported: "The drag works but when I release nothing happens, and during the drag nothing happens either. The drag doesn't work yet. The import image overlay doesn't trigger during drag (that fix works), but the sequence order does not update."
severity: major

### 6. Add Key Photo via Image Picker
expected: On the key photo strip, click the add button → a popover opens upward with imported images in a 4-column grid (max 300px height). Click an image → it's added as a key photo with a thumbnail.
result: issue
reported: "On an empty sequence, can add 1 key image but can't add a second — Add button does nothing. On a sequence with 2 keys, trying to add a third shows a scroll bar portion and can't add. After deleting the second key, can't add a second key anymore (Add button stops working). Likely a z-index issue with the popover inside the key photo strip layout."
severity: major

### 7. Reorder Key Photos via Drag
expected: Drag a key photo to a new position in the horizontal strip. The order updates. The file import overlay does NOT appear during the drag.
result: issue
reported: "Drag and drop reorder doesn't work — nothing happens on drop. Image import overlay no longer appears during drag (that fix works)."
severity: major

### 8. Edit Hold Frames & Remove Key Photo
expected: Click the hold frame count on a key photo → it becomes editable. Change the value and press Enter → it updates. Hover over a key photo → a remove/X button appears. Click it → the key photo is removed.
result: pass

### 9. Per-Sequence Settings
expected: Select a sequence. FPS toggle shows 15 or 24 — clicking switches between them. Resolution dropdown offers presets (1920x1080, 1280x720, etc.) — changing updates the sequence.
result: pass

### 10. Save, Reopen & Auto-Save
expected: Click Save → .mce file saves (Save As dialog if never saved). Close and reopen the .mce file → all sequences, key photos, settings restored. After making changes, a dirty indicator dot appears; auto-save fires after ~2s and clears it.
result: pass

## Summary

total: 10
passed: 5
issues: 5
pending: 0
skipped: 0

## Gaps

- truth: "Welcome Screen shows a readable recent projects list that can be opened by clicking"
  status: resolved
  reason: "User reported: 1) Recent projects list is greyed out (transparent dark gray), not easily readable. 2) Projects in the list can't be opened by clicking them."
  severity: major
  test: 1
  root_cause: "Two issues: (A) Non-highlighted items use #888888/#444444 text on #161616 bg — insufficient contrast. opacity-50 applied when !available. (B) exists() check uses fs:scope-appdata-recursive which blocks paths outside $APPDATA, marking all user-directory projects as unavailable. Click handler returns early on !available."
  artifacts:
    - path: "Application/src/components/project/WelcomeScreen.tsx"
      issue: "Lines 65-77: non-highlighted items use low-contrast text colors. Line 56: opacity-50 on !available. Line 151: click guard on !available."
    - path: "Application/src-tauri/capabilities/default.json"
      issue: "Line 20: fs:scope-appdata-recursive too restrictive for exists() check on user-chosen paths"
  missing:
    - "Broaden FS scope or use Rust-side path exists check to allow validation of user-directory project paths"
    - "Improve text contrast for non-highlighted recent project items"

- truth: "Sequences can be deleted regardless of how many exist in the list"
  status: resolved
  reason: "User reported: Rename, duplicate and delete work fine until the 2nd sequence. When a third sequence is created or duplicated, it can't be deleted."
  severity: major
  test: 4
  root_cause: "SortableJS useEffect in SequenceList uses [] deps — instance is never recreated when sequences change. SortableJS holds stale DOM references and intercepts click events on dynamically-added children (3rd+ sequence), preventing context menu delete from executing."
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      issue: "Lines 18-31: SortableJS useEffect with [] deps — never destroyed/recreated when sequence list changes"
  missing:
    - "Add sequences.length to useEffect dependency array so SortableJS instance is recreated on add/remove"

- truth: "Sequences can be dragged to reorder and the new order persists"
  status: resolved
  reason: "User reported: Drag works visually but nothing happens on release — sequence order does not update. File import overlay fix confirmed working."
  severity: major
  test: 5
  root_cause: "SortableJS physically moves DOM elements during drag. onEnd callback updates Preact signal, but Preact re-renders against already-mutated DOM, seeing no diff — reorder silently fails/snaps back."
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      issue: "Lines 18-31: onEnd updates signal without reverting SortableJS DOM mutation first"
  missing:
    - "Revert SortableJS DOM mutation in onEnd before calling store reorder method, so Preact handles the re-render"

- truth: "Key photos can be added from the image picker popover at any time, including adding 2nd, 3rd, etc."
  status: resolved
  reason: "User reported: Can add 1 key image on empty sequence but Add button stops working for subsequent adds. With 2 keys, adding 3rd shows scroll bar and fails. After deleting second key, can't add second again. Likely z-index issue with popover inside key strip layout."
  severity: major
  test: 6
  root_cause: "Two issues: (A) Popover renders inside overflow-x-auto strip container — gets clipped when strip has enough content to scroll. (B) SortableJS on strip container intercepts click events on AddKeyPhotoButton. Also, component switches render branches (0 vs 1+ keys), remounting AddKeyPhotoButton in a different DOM context."
  artifacts:
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      issue: "Line 64: overflow-x-auto clips absolutely-positioned popover. Lines 49-60: SortableJS on same container intercepts add button clicks. Lines 208-233: popover inside overflow-clipped parent."
  missing:
    - "Move AddKeyPhotoButton outside the overflow-x-auto strip div (as sibling, not child)"
    - "Add SortableJS filter option to exclude add button from event handling"

- truth: "Key photos can be dragged to reorder in the horizontal strip"
  status: resolved
  reason: "User reported: Drag and drop reorder doesn't work — nothing happens on drop. Image import overlay fix confirmed working."
  severity: major
  test: 7
  root_cause: "Same as sequence drag: SortableJS physically moves DOM elements, onEnd updates Preact signal, but Preact re-renders against already-mutated DOM — reorder silently fails."
  artifacts:
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      issue: "Lines 47-61: onEnd updates signal without reverting SortableJS DOM mutation first"
  missing:
    - "Revert SortableJS DOM mutation in onEnd before calling store reorder method"
