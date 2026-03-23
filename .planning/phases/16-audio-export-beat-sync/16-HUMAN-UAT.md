---
status: partial
phase: 16-audio-export-beat-sync
source: [16-VERIFICATION.md]
started: 2026-03-23T21:42:00Z
updated: 2026-03-23T21:42:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Audio Export End-to-End (including hang fix)
expected: Export completes without hanging. Exported video contains synchronized audio. Fade-in/fade-out applied. Cancel button works during audio pre-render phase.
result: [pending]

### 2. BPM Persistence Round-Trip
expected: Beat markers reappear on the timeline after save/close/reopen. AudioProperties shows the saved BPM value and beat offset.
result: [pending]

### 3. Beat Marker Visual Rendering
expected: Amber vertical lines span all tracks. Downbeats (every 4th) are visibly thicker and brighter. Toggle button shows/hides them.
result: [pending]

### 4. Playhead Snap-to-Beat During Scrub
expected: When Snap-to-beats is enabled (Magnet button), dragging the playhead snaps to nearby beat marker positions.
result: [pending]

### 5. Snap-to-Beat Button in FramesPopover
expected: A Music-icon "Snap to beat" button is visible in the popover when an audio track with BPM is selected. Clicking it adjusts hold-frames so the key photo's end frame aligns with the nearest beat marker. No button appears when no BPM audio is selected.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
