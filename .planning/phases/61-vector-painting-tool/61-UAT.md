---
status: testing
phase: 61-vector-painting-tool
source: [61-VERIFICATION.md, 61-REVIEW.md]
started: 2026-11-10T23:40:00Z
updated: 2026-11-11T00:45:00Z
---

## Current Test

number: 9
name: A committed path edit updates the rendered paint
expected: |
  Releasing an edited anchor re-bakes the sheet so the watercolor paint follows
  the new path — both on the automatic re-bake and on the rail's forced
  Re-render (Shift+R).
awaiting: user response

## Tests

### 1. Edit vector paths
expected: A committed vector path can be re-opened for editing and its anchors moved.
result: [passed]
detail: Confirmed by the user after the `enterPathEdit` lifecycle fix (`94101c60c`): "I tested edit vector with alt it works".

### 2. Select a vertex
expected: Individual anchors of the open path can be selected.
result: [passed]
detail: Implied by test 1 — anchors are grabbable and draggable. Note: selection has no dedicated visual (renderPath never reads `vectorAnchorSelection`); the only feedback is the Anchor width block. See G-11.

### 3. Assign a vertex to the size/width property
expected: A selected anchor can be given a width (size) value, and the stroke renders with that per-vertex width.
result: [failed]
detail: User: "I don't know how change size stroke size per vertex (a corner vector)". NOT a broken gate — a discoverability failure. The control renders only in the sheet's SETTINGS view (sliders icon in the header; the default view is the stroke list), directly under the Size row, and only when exactly one vector stroke is selected.

### 4. Switch tool modes both ways
expected: Switching into and out of watercolor is immediate and readable.
result: [passed]
detail: User: "for watercolor mode seem work". The earlier "transparent, flat, phantom" impression did not reproduce as a defect.

### 5. Hide the vector lines to show only the rendered paint
expected: Only the rendered sheet is visible when not constructing.
result: [passed]
detail: Fixed in `a15ed6427` — spine/anchors/handles/rungs render only while the pen draws, a path edit is open, or the Wireframe view is on. User: "work".

### 6. Show a stroke width preview
expected: The stroke's width profile can be previewed.
result: [passed]
detail: User: "stroke size preview work, I missed it".

### 7. New keys inherit the vector from the previous key
expected: Starting a vector on a key and adding a new key copies the vector path onto the new key.
result: [failed]
detail: `+Key` clones raster bytes only (`useRotoKeyUtilities.ts:411-445`); no script copy. The Duplicate path's projection `aquarelleStrokeFromScriptEvent` (`roto/physicsPaintRotoDuplicateScript.ts:172`) drops `anchors` and `renderMode`, so it cannot be reused verbatim either.

### 8. Bézier anchors and handles are editable
expected: Coupled handles, handle break, insert, delete, multi-select (ROADMAP success criterion 1; 61-UI-SPEC §297, §340-341).
result: [passed]
detail: User: "I tested edit vector with alt it works". Alt+drag breaks the tangent. NOTE: Alt is overloaded — Select mode uses Alt+click for stroke deletion and the picker uses it too. No conflict was observed in draw/edit, but the overlap is real and unresolved.

### 9. A committed path edit updates the rendered paint
expected: Releasing an edited anchor re-bakes the sheet so the paint follows the new path.
result: [failed]
detail: User: "re-render doesn't update like the vector edit, I tried too to force re-render ... The blue watercolor doesn't follow the vector I edit". The spine moves (overlay reads the edited registry) but the paint stays at the ORIGINAL geometry — and the rail's forced Re-render (Shift+R) reproduces the same stale result, so this is NOT only the Draft defer route: the re-apply itself produces the pre-edit geometry.

### 10. The color picker is hidden during vector edit
expected: A path edit owns the canvas; the color picker is not shown over it.
result: [failed]
detail: User: "Just need to hide the color picker for vector edit". `enterPathEdit` disarms the picker (`vectorPathSession.ts:80`) but the picker surface remains visible.

### 11. Spline (auto-smooth) editing mode alongside Bézier — FEATURE REQUEST
expected: User would like spline editing instead of / in addition to Bézier, selectable with a switch.
result: [requested]
detail: Scope question, not a defect. 61-CONTEXT D-01 defines exactly TWO anchor kinds — Bézier with coupled handles, and auto-smooth whose handles are derived from its neighbours — and D-04 explicitly REJECTED a user-selectable Catmull-Rom curve family. Painted-stroke curve editing is Phase 62. Granting this means revisiting D-01/D-04 and deciding whether the switch is per-anchor, per-stroke or a document setting.

## Summary

total: 11
passed: 6
issues: 4
pending: 0
skipped: 0
blocked: 0
requested: 1

## Gaps

### Closed since the first UAT round (do not re-plan)

- **G-9** — Path edit self-destructed on entry. FIXED `94101c60c`: `enterPathEdit` no longer clears Select mode, so the selection its gate depends on survives.
- **G-10** — Vertex selection unreachable. CLOSED by G-9.
- **G-12** — Tool-mode switching. CLOSED: watercolor mode confirmed working.
- **G-13** — Vector chrome always drawn over the render. FIXED `a15ed6427`.
- **G-14** — Stroke width preview. CLOSED: user-confirmed working.
- **G-16** — Bézier handles not editable. CLOSED by G-9; user-confirmed.

### Open — to be planned

- **G-11 — Per-vertex width is undiscoverable.** The control is correct and functional but needs: exactly one vector stroke selected, the sheet's hidden settings view, and at least one anchor selected. Surface it from the default list view and/or give anchor selection a visible treatment (currently `renderPath` never reads `vectorAnchorSelection`, so a selected anchor looks identical to an unselected one).

- **G-15 — A new key does not inherit the vector.** `+Key` (`useRotoKeyUtilities.ts:411-445`) clones only the previous real key's raster bytes. Needs a script copy on the new key plus `anchors`/`renderMode` carried through the projection (`roto/physicsPaintRotoDuplicateScript.ts:172`).

- **G-17 — A committed path edit never reaches the rendered paint.** HIGHEST PRIORITY; blocks VEC-02 and VEC-07 at the user level. Evidence: the overlay shows the edited spine, but the paint stays at the original geometry, and the rail's forced Re-render (Shift+R) reproduces the old paint, so the script re-apply yields pre-edit geometry rather than the bake merely being deferred.
  Investigate in this order:
  1. `beginAquarellePathEdit` → `updateAquarellePathInScript(mutationId, anchors, renderMode)` (`view/aquarelleStrokeSelection.ts:939-952`) — does the write land on the event the re-apply reads?
  2. `commitAquarelleVectorPathEdit` (`PhysicsPaintStudio.tsx:10115-10177`) → `runAquarelleScriptRebake` → `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`. Does the applied event carry the new `anchors`, or does a projection drop them the way `aquarelleStrokeFromScriptEvent` does?
  3. The defer route at `:10132-10138` (Draft or wireframe on) — it commits and marks dirty without re-rendering, and 61-18 makes the Draft settle refuse outright while wireframe is on, so that state can never catch up.
  4. The three silent early returns at `:10116-10118` return null with no message and no user feedback.

- **G-19 — The color picker stays visible during a vector path edit.** `enterPathEdit` disarms it (`vectorPathSession.ts:80`) but does not hide the surface.

- **G-20 (feature request) — Spline editing selectable with a switch.** Requires a scope decision against D-01/D-04 before planning; see test 11.

### Also still open from the code review (61-REVIEW.md, 61-REVIEW-DISPOSITION.md)

- **WR-01** — Shift+A writes a stroke selection while Select entry is refused under wireframe (`PhysicsPaintStudio.tsx:2717-2727`).
- **WR-02** — A failed path-edit bake rolls back through the authority-checked restore; an interleaved bump skips the rollback while the capsule reports success (`:10153-10164`).
- **WR-03** — The draw-site bake refuses silently and its result is discarded (`:8807`).
- **WR-04** — An open path edit survives the selection moving to a different vector stroke (`strokeSettingsModel.ts:886-888`).
- **WR-05** — The capture-phase key guard only knows text fields; Enter on a focused button is swallowed (`shortcutTextTarget.ts:13`).
- **CR-02** — refuted by the verifier and recorded as `skipped`; do not reopen.
