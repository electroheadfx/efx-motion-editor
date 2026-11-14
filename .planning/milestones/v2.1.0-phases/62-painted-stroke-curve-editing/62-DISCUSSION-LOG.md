# Phase 62: Painted-Stroke Curve Editing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 62-Painted-Stroke Curve Editing
**Areas discussed:** Stroke identity, Thickness law, Fit fidelity, Edit reach

---

## Stroke identity

| Option | Description | Selected |
|--------|-------------|----------|
| Re-sample, stay painted | Fitted anchors are a transient handle; commit re-samples back to hand-painted points; no schema change. | |
| Convert to a vector path | Persist fitted + edited anchors; the stroke becomes a Phase 61 vector stroke. Declared schema change; replay switches to vector sampling. | ✓ |
| Prompt on first edit | Ask once after the first commit whether to convert or keep painted. | |

**User's choice:** Convert to a vector path.

**Notes:** The user asked whether a painted stroke carries "plenty of points/vertex" that need resampling for vector editing, and suggested possibly resampling in the background after each paint. Clarified that a hand-painted stroke records one sample per tick (~19–86 points on real strokes), that `fit-curve` on that is millisecond-scale, and that converting at paint time would change the paint immediately. The conversion is therefore applied at the first committed edit, not at record time. The ROADMAP scope gate is declared open; `anchors`/`curveMode` already exist in AQTL v2 and both `.mce` languages since Phase 61, so no new field is invented.

### Fit timing (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Lazily on curve-mode entry | Fit only the stroke being edited when the spline-pointer opens curve mode. | ✓ |
| Pre-fit in background after each paint | Session-cache fitted anchors for every stroke so entry is instant. | |
| Convert at record time | Every painted stroke is born vector. | |

**User's choice:** Lazily on curve-mode entry.

**Notes:** The user asked why lazy is recommended over sampling at creation ("isn't it more efficient?"). Explained the three costs (total work, entry latency, interference with the capture→encode→bake pipeline); entry latency is not a risk at 19–86 samples, and pre-fitting adds invalidation surface for no persistence benefit.

---

## Thickness law

| Option | Description | Selected |
|--------|-------------|----------|
| Remap the hand pressure | Keep the recorded pressure profile and re-map it along the new spine by arc length. | ✓ |
| Speed-derived, like a vector stroke | Use the shipped sentinel pressure and the engine's speed law (zero new code). | |
| Constant neutral width | One constant pressure along the whole spine. | |

**User's choice:** Remap the hand pressure.

### Width envelope (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Pressure envelope | Draw the wireframe band from the remapped per-sample pressure. | ✓ |
| Anchor width envelope only | Reuse Phase 61's uniform anchor-width envelope. | |
| Both envelopes | Pressure band plus editable anchor width markers. | |

**User's choice:** Pressure envelope.

### Cadence (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve count on every path edit | A path edit redistributes the existing sample count along the new spine; duration never changes. Also changes Phase 61 drawn-vector edit timing. | ✓ |
| Preserve only on the converting commit | Conversion keeps the hand duration; later edits re-time. | |
| Vector cadence everywhere | Leave `resampleVectorPaintPoints` as shipped; conversion re-times the stroke. | |

**User's choice:** Preserve count on every path edit.

**Notes:** The user was shown the visible consequence: the current seam re-samples at the vector cadence and derives `ticks` from the sample count, so the first commit would re-time the wash. Preserving the count keeps the hand stroke's wet lifetime exactly and makes path length independent of duration; the cost is a deliberate change to Phase 61's edit timing for drawn vector strokes.

---

## Fit fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Interpolating anchors | Anchors on decimated original points; the spline passes exactly through them; untouched anchors do not move. | ✓ |
| Least-squares fit (fit-curve) | Fitted Bézier handles; the first commit shifts every part of the stroke slightly. | |
| Fit-curve with a deviation gate | Fit-curve tightened until under a pixel threshold. | |

**User's choice:** Interpolating anchors.

### Entry view (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Wireframe on + original-spine ghost | Entry turns the wireframe on for the edit, draws the fitted path over a faint ghost of the original spine, restores the prior setting on exit. | ✓ |
| Wireframe on, no ghost | Fitted path and anchors only. | |
| Respect the manual toggle | Never auto-enable the wireframe. | |

**User's choice:** Wireframe on + original-spine ghost.

### Density (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Curvature-adaptive, capped | Anchors at turns, none on straight runs, hard cap ~40. | ✓ |
| Fixed even count | Roughly 12 anchors by arc length. | |
| Dense sampling | An anchor every few samples. | |

**User's choice:** Curvature-adaptive, capped.

---

## Edit reach

| Option | Description | Selected |
|--------|-------------|----------|
| Source-only, all occurrences follow | Curve mode where the stroke is a real key; the source re-bakes and every linked occurrence shows the new pixels. | ✓ |
| Materialize a local key first | Create a local real key at the occurrence and edit only that copy. | |
| Refuse with a named message | Reject curve mode on occurrence frames with explicit copy. | |

**User's choice:** Source-only, all occurrences follow.

### Eligibility (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Brush, Water and Pen | The three pigment-depositing tools; Lift refused by the path-edit gate. | ✓ |
| All four tools, including Lift | Eraser strokes are curve-editable too. | |
| Brush only | Only tool='brush' strokes. | |

**User's choice:** Brush, Water and Pen.

### Undo mid-bake (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel and snap back | Undo aborts the in-flight apply, restores the pre-edit script and sheet, writes no ledger entry. | ✓ |
| Settle, then undo automatically | Queue the undo behind the bake; undo the completed entry. | |
| Block undo with feedback | Ignore undo while the bake runs. | |

**User's choice:** Cancel and snap back.

**Notes:** The user was shown that the bake holds a latch and a canvas veil and that its ledger entry is written only on success, so an unguarded Cmd+Z mid-bake would undo the previous history entry. The cancellation token is the implementation consequence.

---

## Session interruption

The user requested a commit of the working tree (the pre-existing roadmap changes for v2.2.0/v2.3.0) so they could push `dev` before the discussion continued. Committed as `2b05506be`; the user pushed; discussion resumed.

## Claude's Discretion

- Curvature threshold, decimation algorithm, cap value (~40) and minimum-anchor floor.
- Arc-length pressure-remap implementation and long/short spine behaviour.
- Ghost spine and pressure-envelope rendering inside the shipped palette.
- Whether the fit is held for the session (never persisted separately).
- Cancellation-token shape and abort observation point.
- Refusal copy for Lift and degenerate strokes.
- Exact placement/wording in the dialog header.

## Deferred Ideas

- Fit at paint time / anchors-at-birth.
- Pre-fit background cache.
- Least-squares fit-curve approximation.
- Length-proportional re-sampling.
- Editing Lift/eraser strokes.
- Materializing occurrence copies / per-occurrence curve edits.
- Multi-stroke curve editing in one session.
- Closed paths and filled vector shapes.
- A persisted pre-conversion pressure baseline field.

## No todos reviewed

The phase todo matcher returned no matches for Phase 62 (`todo_count: 1`, `matches: []`), so no todos were folded or reviewed.
