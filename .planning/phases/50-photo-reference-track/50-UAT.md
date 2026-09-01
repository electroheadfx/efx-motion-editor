---
status: testing
phase: 50-photo-reference-track
source: [50-VERIFICATION.md]
started: 2026-09-01T20:10:00Z
updated: 2026-09-01T20:10:00Z
---

## Current Test

number: 1
name: Import a reference source and confirm the Photo row
expected: |
  Open the EFX Physic Paint Studio and import a reference source (Import images).
  The Photo row appears above the Bg row with a camera glyph and a passive muted band.
awaiting: user response

## Tests

### 1. Import a reference source and confirm the Photo row
expected: The Photo row appears above the Bg row with a camera glyph and a passive muted band
result: [pending]

### 2. Confirm the ghost overlay draws over the composite while painting
expected: The reference draws as a semi-transparent ghost at 50% opacity by default, transformed by the display transform
result: [pending]

### 3. Switch the Mode control between Reference only / Reveal source / Masked transform
expected: The active segment changes; the ghost looks identical (flag-only, no compositor change)
result: [pending]

### 4. Drag the Overlay opacity slider
expected: Live preview during drag, commit on release; the value persists
result: [pending]

### 5. Unlock the reference transform, drag/scale/rotate the overlay, then press Escape
expected: Drag moves, corner handles scale, rotation handle rotates; Escape re-locks and painting works normally
result: [pending]

### 6. Save the project, close, and reopen
expected: The source, mode, opacity, transform, and lock state are all restored
result: [pending]

### 7. Confirm the reference NEVER appears in flattened output or export in any mode
expected: No reference pixels leak into the flattened raster, main preview, or export
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
