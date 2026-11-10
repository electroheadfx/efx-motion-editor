---
status: testing
phase: 61-vector-painting-tool
source: [61-VERIFICATION.md, 61-REVIEW.md]
started: 2026-11-10T23:40:00Z
updated: 2026-11-10T23:40:00Z
---

## Current Test

number: 1
name: Edit a vector path
expected: |
  With a vector path on the frame, the user can open its edit session, move its
  anchors, and commit the edit onto the live sheet.
awaiting: user response

## Tests

### 1. Edit vector paths
expected: A committed vector path can be re-opened for editing and its anchors moved, with the result baked onto the sheet.
result: [failed]
detail: User reports "I can't edit vectors".

### 2. Select a vertex
expected: Individual anchors of the open path can be selected, and the selection is visible on the overlay.
result: [failed]
detail: User reports "I can't select vertex".

### 3. Assign a vertex to the size/width property
expected: A selected anchor can be given a width (size) value, and the stroke renders with that per-vertex width.
result: [failed]
detail: User reports "I can't assign vertex to size property".

### 4. Switch tool modes (er/watercolor) both ways
expected: Switching from the ribbon/eraser surface to the watercolor brush and back is immediate and does not require hunting through gated controls.
result: [failed]
detail: User reports "I have difficulty to change rubon to watercolor and inverse". Term unconfirmed. 2026-11-11 follow-up: "when I switch on water color, watercolor is different, its transparent and very flat, strange look like phantom paint" — switching INTO watercolor changes the rendered appearance of paint (transparent, flat, phantom-like).

### 5. Hide the vector lines to show only the rendered paint
expected: The spine/width-envelope wireframe can be hidden so only the rendered sheet is visible.
result: [failed]
detail: User reports "I can't hide vectors line for show only render".

### 6. Show a stroke width preview
expected: The stroke's width profile is previewed so per-vertex width can be judged before committing.
result: [failed]
detail: User reports "I can't show stroke width preview".

### 7. New keys inherit the vector from the previous key
expected: Starting a vector on a key and adding a new key copies the vector path onto the new key.
result: [failed]
detail: User reports "when I start with vector on a key, when I add a new key, the new key should get copied the vector".

### 8. Bézier anchors and handles are editable
expected: A Bézier anchor draws its coupled handles, Alt+drag breaks the tangent, and the shape/colour change on promotion is legible (61-UI-SPEC §297, §340-341; ROADMAP success criterion 1).
result: [failed]
detail: User reports "I have not access to bezier mode too, it was in specs". Bézier anchors can be created at draw time (Alt+click) but can never be edited.

## Summary

total: 8
passed: 0
issues: 8
pending: 0
skipped: 0
blocked: 0

## Gaps

- G-9  — Path edit self-destructs: `enterPathEdit` clears the selection its own gate requires, so the mode is exited in the same tick. Root cause of G-10, G-11, G-14 and G-16.
- G-10 — Vertex selection is unreachable (no path edit can stay open) and the selection is not rendered distinctly.
- G-11 — Per-vertex width (size) assignment is unreachable: 61-19's gate is unsatisfiable without an open edit.
- G-12 — Tool-mode switching between the ribbon/eraser surface and the watercolor brush is difficult. Term "rubon" unconfirmed.
- G-13 — The vector spine/envelope cannot be hidden; the user cannot view render-only output. The rail's Wireframe toggle adds skeletons rather than hiding them.
- G-14 — The stroke width preview ignores per-vertex anchors; the per-vertex profile appears only inside the wireframe envelope.
- G-15 — Adding a key after a vector key does not inherit the vector path (only raster bytes are cloned).
- G-16 — Bézier anchors and handles are not editable, although Phase 61's success criterion 1 requires coupled handles, handle break, insert, delete and multi-select.
