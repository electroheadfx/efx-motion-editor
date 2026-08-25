---
status: testing
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
source: [47-VERIFICATION.md]
started: 2026-08-25T20:15:00.000Z
updated: 2026-08-25T20:15:00.000Z
---

## Current Test

number: 1
name: Header column + track CRUD UI (47-02)
expected: |
  The pinned header column shows the "Tracks N" strip with '+' button; each Paint row shows its name with the active accent, eye / 'S' solo buttons, and a hover panel with pencil/copy/trash. Rename is edit-in-place; duplicate creates '<name> Copy'; delete opens the acknowledge dialog (frame count, loop clip count, Hold count) and refuses deleting the last Paint track. The Bg row is locked at the bottom with the lock indicator. The header-drag reorder shows a live insertion indicator.
awaiting: user response

## Tests

### 1. Header column + track CRUD UI (47-02)
expected: Rename, duplicate, delete dialog, reorder grab, active accent, Bg lock all behave as described above; delete of the last Paint track is refused with "At least one Paint track is required".

### 2. Right-panel Track section (47-03)
expected: The right panel shows the active track's name, an Opacity slider (0-1) and a Blend select with exactly normal/screen/multiply/overlay/add; changing tracks re-renders the section; Cmd/Ctrl+Shift+N adds a track and Cmd/Ctrl+Shift+D duplicates the active track (never while painting or with a text input focused).

### 3. Filmstrip capsules (47-04)
expected: Hold Loop Clips render as filmstrip capsules — source-cycle cells, ×N/×∞ badge, shortened visual with "Loop shortened by next clip" tooltip, diagonal cut on a partial cycle; the Bg row shows imported clip capsules; zoom above the threshold expands the repetition band.

### 4. Cross-track drag (47-05)
expected: Dragging real keys from one track's row onto another track's row highlights the destination and shows the insertion preview; releasing commits the move (keys leave the source row, appear on the destination row); rejections (occupied destination frame, partial loop) surface in the status capsule with the red warning triangle.

### 5. Phase 47 overall (regression)
expected: Track 1 and new tracks keep their keys across save/reopen; painting stays fluid (no stutter at stroke start); hover cursors are the select pointer on frames/keys; no black window on reopen after a long idle.

## Summary

### Round 1 (2026-08-25) — test 1 feedback + fixes (commit 6d19e5f6)

User feedback on the header column:
- Solo 'S' chip removed from the standing row; moved into the hover tools panel.
- Pencil (rename) icon removed from the hover tools — double-click on the name
  renames in place (confirmed working by the user).
- Eye toggle moved OUT of the hover tools to a standing row control, placed
  before the name and after the reorder grip.
- The row now shows only: grip, eye, name, more-button; the tools panel opens
  solo / copy / trash.
- Header column widened from 140px to 160px (`.physics-paint-header-column`).
- Delete-track dialog now centered on the EFX Paint window (`position: fixed`,
  no transformed ancestor — tracked to the webview viewport).
- Drag reorder confirmed working by the user.

Re-verification of this group is pending user response; remaining UAT items
(2-5) are still awaiting the user's group-by-group reports.
