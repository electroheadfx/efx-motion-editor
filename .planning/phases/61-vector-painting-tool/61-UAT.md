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
detail: Discoverability, not a broken gate. The control renders only in the sheet's SETTINGS view, under the Size row, and only with exactly one vector stroke selected — the user never found it. Candidate fix: surface it from the default list view, or add an explicit affordance.

### 9. A committed path edit updates the rendered paint
expected: Releasing an edited anchor re-bakes the sheet so the paint matches the new path.
result: [failed]
detail: User reports "The vector edit change do not update render". Named causes to check: the Draft/wireframe defer route (`PhysicsPaintStudio.tsx:10132-10138`) commits the script but defers the re-render to the Draft settle, and 61-18 makes that settle refuse outright while wireframe is on; the three silent early returns at `:10116-10118` return null with no message.

### 4. Switch tool modes (er/watercolor) both ways
expected: Switching from the ribbon/eraser surface to the watercolor brush and back is immediate and does not require hunting through gated controls.
result: [passed]
detail: User confirmed watercolor mode "seem work". The earlier "transparent, flat, phantom" impression was not reproduced as a defect; the remaining complaint is the per-vertex size control in test 3.

### 5. Hide the vector lines to show only the rendered paint
expected: The spine/width-envelope wireframe can be hidden so only the rendered sheet is visible.
result: [failed]
detail: User reports "when I switch on paint, vector are always visible on paint — its not good for view final render". FIXED 2026-11-11: the spine/anchors/handles/rungs are construction chrome and now render only while the pen is drawing, a path edit is open, or the wireframe view is on (VectorPathOverlay `showStructure`).

### 6. Show a stroke width preview
expected: The stroke's width profile is previewed so per-vertex width can be judged before committing.
result: [passed]
detail: User confirmed "stroke size preview work, I missed it".

### 7. New keys inherit the vector from the previous key
expected: Starting a vector on a key and adding a new key copies the vector path onto the new key.
result: [failed]
detail: User reports "when I start with vector on a key, when I add a new key, the new key should get copied the vector".

### 8. Bézier anchors and handles are editable
expected: A Bézier anchor draws its coupled handles, Alt+drag breaks the tangent, and the shape/colour change on promotion is legible (61-UI-SPEC §297, §340-341; ROADMAP success criterion 1).
result: [failed]
detail: User reports "I have not access to bezier mode too, it was in specs". Bézier anchors can be created at draw time (Alt+click) but can never be edited.

## Summary

total: 9
passed: 2
issues: 7
pending: 0
skipped: 0
blocked: 0

## Gaps

- G-9  — Path edit self-destructs: `enterPathEdit` clears the selection its own gate requires, so the mode is exited in the same tick. Root cause of G-10, G-11, G-14 and G-16.
- G-10 — Vertex selection is unreachable (no path edit can stay open) and the selection is not rendered distinctly.
- G-11 — Per-vertex width (size) assignment is unreachable: 61-19's gate is unsatisfiable without an open edit.
- G-12 — Tool-mode switching between the ribbon/eraser surface and the watercolor brush is difficult. Term "rubon" unconfirmed.
- G-13 — CLOSED 2026-11-11: chrome now renders only while drawing, editing, or in wireframe.
- G-14 — CLOSED: the stroke width preview works (user-confirmed).
- G-15 — Adding a key after a vector key does not inherit the vector path (only raster bytes are cloned).
- G-17 — A committed path edit does not update the rendered paint.
- G-18 — The per-vertex width control is undiscoverable (settings view only, under Size).
- G-16 — Bézier anchors and handles are not editable, although Phase 61's success criterion 1 requires coupled handles, handle break, insert, delete and multi-select.
