---
status: complete
phase: 03-project-sequence-management
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the application fresh. The app boots without errors in the terminal, the window opens, and the WelcomeScreen is displayed.
result: pass

### 2. Welcome Screen & New Project
expected: WelcomeScreen shows New and Open buttons (plus any recent projects if they exist). Click New — a dialog appears with project name input, FPS toggle (15/24), and a folder picker. Fill in a name, pick a folder, click Create. The editor opens immediately with the new project (no more WelcomeScreen).
result: pass

### 3. Sequence CRUD
expected: In the left panel, you can create a new sequence (it appears in the list). Double-click a sequence name to rename it inline (Enter confirms, Escape cancels). Right-click a sequence to see a context menu with Rename, Duplicate, and Delete. Duplicate creates a copy. Delete asks for confirmation before removing.
result: pass

### 4. Key Photo Management
expected: Select a sequence. The KeyPhotoStrip shows below it. You can add key photos from imported images (an image picker popover appears). Added photos show thumbnails. Hover a key photo to see a remove button. You can edit the hold frame count inline on each key photo. Drag key photos horizontally to reorder them.
result: issue
reported: "1) Image picker popover UX: when adding a second key photo, the popover requires scrolling to access the photos list, not very usable. 2) Drag reorder broken: when trying to drag key photos to reorder them, the drag-and-drop import overlay appears instead, blocking reorder functionality entirely."
severity: major

### 5. Sequence Drag Reorder & Settings
expected: Drag sequences by their handle to reorder them in the list — the order persists after dropping. Each sequence has a FPS toggle (15/24) and a resolution dropdown (1920x1080, 1280x720, 3840x2160). Changing these settings updates the sequence.
result: issue
reported: "Can't reorder sequences because the drag-and-drop import overlay appears and blocks the reorder. FPS and resolution settings work correctly — changes trigger save and timeline updates."
severity: major

### 6. Project Save, Reopen & Auto-Save
expected: Click Save in the toolbar — if the project was never saved, a Save As dialog appears to pick a location. The project saves to a .mce file. Close the project (or restart the app). Open the .mce file — all sequences, key photos, hold frames, and settings are restored exactly as saved. While editing, a dirty indicator dot appears on the toolbar after changes, and auto-save fires after ~2 seconds of inactivity (the dot clears).
result: pass

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Key photo image picker popover is usable when adding multiple photos"
  status: failed
  reason: "User reported: Image picker popover requires scrolling to access photos list when adding second key photo, poor UX"
  severity: minor
  test: 4
  artifacts: []
  missing: []

- truth: "Key photos can be dragged horizontally to reorder them"
  status: failed
  reason: "User reported: Drag reorder triggers the drag-and-drop import overlay instead of reordering key photos"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Sequences can be dragged by their handle to reorder them"
  status: failed
  reason: "User reported: Drag-and-drop import overlay appears and blocks sequence reorder. Same root cause as key photo drag issue."
  severity: major
  test: 5
  artifacts: []
  missing: []
