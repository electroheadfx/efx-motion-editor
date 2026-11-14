---
status: complete
phase: 61-vector-painting-tool
source: [61-VERIFICATION.md, 61-REVIEW.md, 61-UI-REVIEW.md, 61-VALIDATION.md]
started: 2026-11-10T23:40:00Z
updated: 2026-11-12T10:56:44.836Z
---

## Current Test

[testing complete]

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
result: issue
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
result: issue
detail: `+Key` clones raster bytes only (`useRotoKeyUtilities.ts:411-445`); no script copy. The Duplicate path's projection `aquarelleStrokeFromScriptEvent` (`roto/physicsPaintRotoDuplicateScript.ts:172`) drops `anchors` and `renderMode`, so it cannot be reused verbatim either.

### 8. Bézier anchors and handles are editable
expected: Coupled handles, handle break, insert, delete, multi-select (ROADMAP success criterion 1; 61-UI-SPEC §297, §340-341).
result: [passed]
detail: User: "I tested edit vector with alt it works". Alt+drag breaks the tangent. NOTE: Alt is overloaded — Select mode uses Alt+click for stroke deletion and the picker uses it too. No conflict was observed in draw/edit, but the overlap is real and unresolved.

### 9. A committed path edit updates the rendered paint
expected: Releasing an edited anchor re-bakes the sheet so the paint follows the new path.
result: issue
detail: User: "re-render doesn't update like the vector edit, I tried too to force re-render ... The blue watercolor doesn't follow the vector I edit". The spine moves (overlay reads the edited registry) but the paint stays at the ORIGINAL geometry — and the rail's forced Re-render (Shift+R) reproduces the same stale result, so this is NOT only the Draft defer route: the re-apply itself produces the pre-edit geometry.

### 10. The color picker is hidden during vector edit
expected: A path edit owns the canvas; the color picker is not shown over it.
result: issue
detail: User: "Just need to hide the color picker for vector edit". `enterPathEdit` disarms the picker (`vectorPathSession.ts:80`) but the picker surface remains visible.

### 11. Spline (auto-smooth) editing mode alongside Bézier — FEATURE REQUEST
expected: User would like spline editing instead of / in addition to Bézier, selectable with a switch.
result: issue
detail: Scope question, not a defect. 61-CONTEXT D-01 defines exactly TWO anchor kinds — Bézier with coupled handles, and auto-smooth whose handles are derived from its neighbours — and D-04 explicitly REJECTED a user-selectable Catmull-Rom curve family. Painted-stroke curve editing is Phase 62. Granting this means revisiting D-01/D-04 and deciding whether the switch is per-anchor, per-stroke or a document setting.

**Post gap-closure re-test (2026-11-11).** Rows 12–21 (labelled R1–R10) re-test the eleven
gap-closure plans (61-21 … 61-31). The original rows above stay as the historical record; these
are the live pass criteria for `61-VERIFICATION.md`'s ten `human_verification` items.

### 12. R1 — Vertex-drag responsiveness at the reference count (truth 13)
expected: Drag and commit stay native-feeling on the 10-stroke reference sheet at 1920x1080. Probe raster cost is 772.6 ms per sheet re-bake, so this is a judgment call.
result: pass

### 13. R2 — CR-01: a mid-drag Delete survives the release (truth 19)
expected: Start an anchor drag, press Delete mid-drag, release — the deleted anchor STAYS deleted and no phantom edit is recorded. Then start a drag, press Escape or switch stroke, reopen the edit — no stale gesture commits. A normal drag still lands exactly one undoable edit.
result: pass
detail: User-confirmed 2026-11-12. The seam ends the drag before its write (`9be725501`, pinned by an ordering test); the mounted edit-close effect is now live-verified too.

### 14. R3 — G-17: a committed path edit updates the rendered paint
expected: Releasing an edited anchor re-bakes the sheet so the wash follows the new curve — after the ordinary bake, after a Draft settle, and after a forced Shift+R replay; one undo returns the paint to the pre-edit curve.
result: pass
detail: User-confirmed 2026-11-12; closes the phase's highest-priority gap (G-17). Cause was the stale replay spine carried through `updateAquarellePathInScript`'s spread; the write now re-derives `points` from the stored anchors (61-29).

### 15. R4 — G-11 / VEC-03+04: Vertex size and per-vertex colour
expected: With one vector stroke selected, the "Vertex size" control is visible in the default list view and in Stroke Settings → Geometry; dragging it moves that vertex's width; with no path edit open it is inert with "Open Edit path on this stroke to set vertex sizes."; the selected anchor wears the ring and loses it on deselect. With anchors selected on the open path edit, the sidebar Color tab recolours THOSE anchors in one undo and the wash blends between them; with no anchor selected the Color tab still recolours the whole stroke.
result: pass
detail: User: "its beautiful very nice work". Closes G-11 and confirms the per-vertex colour feature end to end.

### 16. R5 — G-15: +Key inherits the vector
expected: `+Key` on a vector-bearing previous real key yields a key with the same painted result that is re-editable (anchor markers on Edit vector); a hand-painted source behaves as today; a forced copy failure still creates the key and says only that the script could not be copied.
result: pass
detail: User-confirmed 2026-11-12. Closes G-15.

### 17. R6 — G-19: the picker is hidden during a path edit
expected: With Edit path open the Pipette visor never appears over the canvas and the rail's Picker chip stays unlit; holding Alt and dragging a handle breaks the tangent; after the edit Alt picks as before.
result: pass
detail: User-confirmed 2026-11-12. Closes G-19.

### 18. R7 — G-20 / Curve row in Stroke Settings → Geometry (rows A–F)
expected: Stroke Settings shows Geometry + Stack only (the Paint tab is gone). The Curve row appears in Geometry for vector strokes only; switching Bézier <-> Spline changes the drawn shape and is one undo; authored handles return after switching back; Mixed converts honestly; hand-painted strokes are never touched; a spline insert lands on the drawn curve; a saved spline reopens identically.
result: pass
detail: User-confirmed 2026-11-12 (rows A–F including the Geometry relocation from quick 261111-vg4).

### 19. R8 — 61-26/61-27 refusal seams
expected: Shift+A under wireframe changes nothing and restores normal selection after wireframe off; a failed path-edit bake's capsule matches whether the pre-edit path actually came back; a vector stroke drawn during an in-flight bake reappears at the next settle with no error capsule; selecting another stroke closes the open edit; a focused header button + Enter activates the button and touches no anchor.
result: pass
detail: User-confirmed 2026-11-12.

### 20. R9 — 61-20 undo row
expected: One Cmd+Z reverts a whole path edit (anchor or handle drag, Draft mode, and a forced failing re-bake); Redo re-applies; a failed re-bake leaves the undo stack unchanged and restores the pre-edit path.
result: pass
detail: User-confirmed 2026-11-12.

### 21. R10 — UI review held-out rows and the outstanding warnings
expected: Per 61-UI-SPEC: E5 overflow, E6 rail loading, E7 canvas loading/populated. (The E8 Simple-ribbon thumb row is retired — `cb49cc728` removed the ribbon engine from `packages/efx-watercolor`.) Plus the re-audit's outstanding warnings — Curve row copy/teaching, refusal grammar, wireframe z-order (VectorPathOverlay z=41 over the ScriptStrokeOverlay chrome at z=40), segmented weight 600 vs 700, and a pre-press hover affordance.
result: pass
detail: User-confirmed 2026-11-12.

## Summary

total: 21
passed: 16
issues: 5
pending: 0
skipped: 0
blocked: 0
resolved: 5

## Gaps

### Resolution records (2026-11-12)

Each gap below was diagnosed, planned in the gap-closure wave, executed, and
live-verified by re-test rows 12–21.

- gap_id: G-11
  truth: "A selected anchor can be given a width (size) value, and the stroke renders with that per-vertex width."
  test: 3
  status: resolved
  resolved_by: 61-22-PLAN.md
  resolved_at: 2026-11-12
  reason: "User reported: I don't know how change size stroke size per vertex (a corner vector)"
  severity: major

- gap_id: G-15
  truth: "Starting a vector on a key and adding a new key copies the vector path onto the new key."
  test: 7
  status: resolved
  resolved_by: 61-24-PLAN.md
  resolved_at: 2026-11-12
  reason: "User reported: +Key clones raster bytes only; no script copy, so the new key cannot be re-edited"
  severity: major

- gap_id: G-17
  truth: "Releasing an edited anchor re-bakes the sheet so the paint follows the new path."
  test: 9
  status: resolved
  resolved_by: 61-29-PLAN.md
  resolved_at: 2026-11-12
  reason: "User reported: re-render doesn't update like the vector edit; the blue watercolor doesn't follow the vector I edit"
  severity: blocker

- gap_id: G-19
  truth: "A path edit owns the canvas; the color picker is not shown over it."
  test: 10
  status: resolved
  resolved_by: 61-23-PLAN.md
  resolved_at: 2026-11-12
  reason: "User reported: Just need to hide the color picker for vector edit"
  severity: minor

- gap_id: G-20
  truth: "Spline editing selectable alongside Bézier with a switch."
  test: 11
  status: resolved
  resolved_by: 61-30-PLAN.md
  resolved_at: 2026-11-12
  reason: "User requested: spline editing instead of / in addition to Bézier, selectable with a switch"
  severity: minor

### Closed since the first UAT round (do not re-plan)

- **G-9** — Path edit self-destructed on entry. FIXED `94101c60c`: `enterPathEdit` no longer clears Select mode, so the selection its gate depends on survives.
- **G-10** — Vertex selection unreachable. CLOSED by G-9.
- **G-12** — Tool-mode switching. CLOSED: watercolor mode confirmed working.
- **G-13** — Vector chrome always drawn over the render. FIXED `a15ed6427`.
- **G-14** — Stroke width preview. CLOSED: user-confirmed working.
- **G-16** — Bézier handles not editable. CLOSED by G-9; user-confirmed.

### Implemented in the gap-closure wave — re-test pending (see rows R2–R7)

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
