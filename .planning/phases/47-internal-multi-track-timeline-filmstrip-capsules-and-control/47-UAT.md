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

### Round 4 (2026-08-25) — test 2 regression fix (commit 6ca409ab)

User report: selecting a track opens the Track option tab, then it reverts to
Paint option a fraction of a second later ("event conflict").

Root cause: clicking a track row ALSO emits paint-revision activity shortly
after (runtime re-projection / document sync round-trip), which the
paint-flip signals effect translated into an instant tab revert.

Fix: paint-revision bumps inside a 600ms quiet window after a track
selection are treated as selection side effects and ignored
(`TRACK_TAB_SETTLE_MS`); a real paint stroke after the window still snaps
back to Paint option. Regression tests cover both paths (bump inside the
window keeps the Track tab; bump after the window flips to Paint).

### Round 3 (2026-08-25) — test 2 (right sidebar) feedback + fixes (commit 82fc8a91)

- The tool pane now hosts two tabs, matching the bottom Actions/Onion/Motion
  pattern: 'Paint option' (Shape detail / Color blending / Spread / Erase
  strength / Brush smoothing) and 'Track option' (active track name, Opacity
  0-1, Blend select) — the track options are out of the brush-tools pane.
- Auto-selection: choosing a track (activeTrackId change) opens 'Track
  option'; choosing a tool (activeTool change) or painting (physicPaintVersion
  bump, subscribed via a signals effect so the memoized panel flips the tab
  without re-rendering per stroke) snaps back to 'Paint option'.

Re-verification of this group is pending user response; remaining UAT items
(3-5) are still awaiting the user's group-by-group reports.

### Round 2 (2026-08-25) — test 1 feedback + fixes (commit d437f053)

- Open tools panel now takes over the WHOLE row: grip, eye, blend, name and
  the more-button hide; the solo / copy / trash buttons stretch across the
  track's full width (flex: 1 each).
- Header column widened again: 160px -> 185px.
- NEW per-track frame-blending toggle after the eye: shows the Blend icon,
  its pressed state reads that track's canonical interpolation state, the
  click writes `setRotoPhysicalInterpolationState(layerId, trackId, ...)`
  (revision bump -> pushed into the parent document via serialize; guarded
  while a physical edit is pending).

Re-verification of this group is pending user response; remaining UAT items
(2-5) are still awaiting the user's group-by-group reports.

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
