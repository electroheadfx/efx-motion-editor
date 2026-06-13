---
status: complete
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
source: [36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md, 36-06-SUMMARY.md, 36-07-SUMMARY.md]
started: 2026-06-13T07:52:27Z
updated: 2026-06-13T08:29:52Z
---

## Current Test

[testing complete]

## Tests

### 1. Five-region Physics Paint layout
expected: Opening the standalone Physics Paint editor shows the rebuilt five-region UI: compact top bar, ordered left tool rail, central canvas, right settings panel, and bottom Roto/Play workflow strip. The old diagnostics/toolbar layout is not the main render path, and the UI looks polished against the Phase 36 spec.
result: pass

### 2. Top bar and right-panel paint controls
expected: Brush size, opacity, background, paper texture, and grain controls are visible and usable. Grain strength offers exactly `None`, `Soft`, `Med`, and `Hard`; the right panel supports color entry/palette controls, blend preview, and erase-only options when Erase is active.
result: pass

### 3. Left tool rail and local shortcuts
expected: The left rail shows the ordered Paint, Paint with physics, Erase, Undo, Clear frame, physics-last, physics-all, and Dry/freeze actions with bundled icons. Keyboard shortcuts only affect the Physics Paint studio when focus is inside that surface and do not trigger while typing in editable inputs.
result: pass

### 4. Roto/Play workflow strip and timeline lanes
expected: The bottom strip exposes `Roto canvas` and `Play canvas` modes, primary actions update for the active mode, Roto frames and Play range lanes are readable, and clicking the Play lane only inspects/positions the range rather than publishing or converting output.
result: issue
reported: "dans les specs on s'était dit que changer de tab entre roto canvas et play canvas faisait une conversion avec un dialog de confirmation, on avait parlé de ca au lieu de mettre des boutons de conversion ici : [screenshot] c'est pas tres UX je prefer les enlever"
severity: major

### 5. Onion preview and explicit conversion flows
expected: Onion-skin controls clamp to the supported range, previous/next frame overlays appear around the active frame, live preview suppresses onion overlays, and Play-to-Roto or clear actions require explicit confirmation before destructive changes happen.
result: issue
reported: "Onion-skin controls UI is present but onion functionality does not work; changing controls does not affect the canvas overlay."
severity: major

### 6. Editable state save/load and frame sync
expected: Save state downloads editable Physics Paint JSON without rendered PNG output; loading valid saved state restores editable engine state, invalid JSON is rejected with the required error copy, and standalone frame navigation syncs the editor timeline to the requested frame without accepting malformed messages.
result: issue
reported: "Save state does not open an OS save dialog to choose where to save the file, while Load state does open the OS dialog."
severity: major

### 7. Preview, Save play, and dev proof export
expected: Play preview remains preview-only until `Save play`; `Save play` publishes the selected range, keeps the standalone window open, and shows a saved range summary. Dev export is gated to valid rendered frames and produces inspectable PNG/manifest proof metadata without using a headless replay path.
result: issue
reported: "Play works, but Save play ends with a yellow box/overlay bug. After closing and reopening EFX Physics, all edits are lost and the studio reopens in the Roto canvas tab instead of the Play canvas tab."
severity: blocker

## Summary

total: 7
passed: 3
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The bottom strip should let users switch between Roto canvas and Play canvas in the agreed UX, with conversion happening via tab switch plus confirmation dialog rather than separate conversion buttons."
  status: failed
  reason: "User reported: dans les specs on s'était dit que changer de tab entre roto canvas et play canvas faisait une conversion avec un dialog de confirmation, on avait parlé de ca au lieu de mettre des boutons de conversion ici : [screenshot] c'est pas tres UX je prefer les enlever"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Onion-skin controls should update functional previous/next frame overlays on the canvas when relevant frames exist, and live preview should suppress those overlays."
  status: failed
  reason: "User reported: Onion-skin controls UI is present but onion functionality does not work; changing controls does not affect the canvas overlay."
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "Save state should open an OS save dialog so the user can choose where to save the editable Physics Paint JSON, matching the explicit OS dialog behavior used by Load state."
  status: failed
  reason: "User reported: Save state does not open an OS save dialog to choose where to save the file, while Load state does open the OS dialog."
  severity: major
  test: 6
  artifacts: []
  missing: []

- truth: "Save play should publish the selected range without leaving a yellow box/overlay artifact, persist the edited Play canvas output, and reopen the standalone studio in the Play canvas context when that output is reloaded."
  status: failed
  reason: "User reported: Play works, but Save play ends with a yellow box/overlay bug. After closing and reopening EFX Physics, all edits are lost and the studio reopens in the Roto canvas tab instead of the Play canvas tab."
  severity: blocker
  test: 7
  artifacts: []
  missing: []
