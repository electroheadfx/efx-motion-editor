---
status: complete
phase: 05-editing-infrastructure
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server or Tauri process. Start the application from scratch. App boots without errors, main window appears, and the editor shell renders with toolbar, canvas area, and timeline visible.
result: pass

### 2. Project Switching Data Isolation
expected: Open or create a project with at least one sequence and some key photos. Then create a new project (via Toolbar New button or Cmd+N). The new project should have a completely clean state — no sequences, no key photos, no timeline data carried over from the previous project. Playback should be stopped. Auto-save timer should not be duplicated.
result: pass

### 3. Unsaved Changes Guard (New Project)
expected: Make a change to the current project (e.g., add a key photo or rename a sequence). Click the New button in the toolbar. A native macOS dialog appears with three buttons: Save, Don't Save, Cancel. Clicking Cancel returns to the current project without changes. Clicking Don't Save discards and opens new project. Clicking Save saves first then opens new project.
result: pass

### 4. Unsaved Changes Guard (Window Close)
expected: Make a change to the current project. Attempt to close the application window (Cmd+W or the red close button). The native Save/Don't Save/Cancel dialog appears, preventing accidental data loss. Cancel keeps the window open.
result: pass

### 5. Undo a Sequence Edit
expected: Perform a sequence mutation (e.g., create a new sequence, rename one, or add a key photo). Press Cmd+Z. The mutation is undone — state reverts to before the edit.
result: issue
reported: "Cmd+Z or ctrl+Z (on mac) no work, I have no state reverts on any action"
severity: major

### 6. Redo After Undo
expected: After undoing (Cmd+Z), press Cmd+Shift+Z. The previously undone change is restored.
result: issue
reported: "redo and undo no work"
severity: major

### 7. Space Bar Play/Pause
expected: With a sequence that has key photos, press the Space bar. Playback starts (timeline scrubber moves, canvas updates). Press Space again — playback pauses at current position.
result: pass

### 8. Arrow Key Frame Stepping
expected: With playback paused, press Right arrow. The timeline moves forward one frame and the canvas updates. Press Left arrow — moves back one frame. Holding the key repeats.
result: pass

### 9. JKL Shuttle with Speed Badge
expected: Press L — forward playback starts at 1x. Press L again — speed increases (2x, 4x, 8x on repeated presses). A speed badge briefly appears near playback controls showing the current speed multiplier. Press K — playback stops and speed resets. Press J — reverse playback starts, with matching speed tiers on repeated presses. J and L decelerate each other (pressing J while going forward slows down first).
result: issue
reported: "L and J make multiplier and play at same time. It acts like a play and a playback and a multiplier too, not very intuitive. Space should only run the play, and L/J choose direction (L=normal, J=reverse). Repeated L or J presses should augment multiplier but only Space should start/stop playback with those settings. K resets all. Also needs auto-loop: when player reaches end it should return to start (or reverse to start for reverse play) in endless loop."
severity: major

### 10. Cmd+S / Cmd+N / Cmd+O File Operations
expected: Cmd+S triggers save (or Save As for unsaved projects). Cmd+N opens the new project dialog. Cmd+O opens the file picker to open a project. All three behave the same as their toolbar button counterparts.
result: pass

### 11. Shortcuts Overlay
expected: Press ? (question mark). A centered dark modal appears showing all keyboard shortcuts in a 2-column grouped layout with macOS key symbols (⌘, ⇧, ⌫). Press Escape or click outside — the overlay dismisses.
result: issue
reported: "No help shortcuts keyboard appear when I press '?'. On mac I need to press with shift+','"
severity: major

### 12. Input Field Suppression
expected: Click into a text input field (e.g., a sequence name rename field). Type characters including Space, J, K, L, and ?. The characters appear in the input field. Shortcuts do NOT fire — playback doesn't toggle, shuttle doesn't start, overlay doesn't appear.
result: pass

## Summary

total: 12
passed: 8
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Cmd+Z undoes the last sequence mutation"
  status: failed
  reason: "User reported: Cmd+Z or ctrl+Z (on mac) no work, I have no state reverts on any action"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Cmd+Shift+Z redoes the last undone change"
  status: failed
  reason: "User reported: redo and undo no work"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "JKL shuttle provides intuitive speed/direction control separate from play/pause"
  status: failed
  reason: "User reported: L and J make multiplier and play at same time. Not intuitive. Space should control play/stop, L/J set direction and speed, K resets. Needs auto-loop."
  severity: major
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Pressing ? opens the shortcuts overlay"
  status: failed
  reason: "User reported: No help shortcuts keyboard appear when I press '?'. On mac I need to press with shift+','"
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
