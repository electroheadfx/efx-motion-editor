# Phase 49: Fixed Background Track and Imported Loop Clips - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 49-fixed-background-track-and-imported-loop-clips
**Areas discussed:** Import UX + ordering, Clip placement & edits, Source persistence, Fallback config + gaps

---

## Import UX + ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Drop onto Bg row | User drops image files directly onto the Background row; clip lands at the drop frame. | |
| Import button + dialog | An Import control on the Bg row header opens the macOS file picker (multi-select). | |
| Both | Drop for quick placement and a dialog for precise control. | |
| Filename sort | Frames sorted by filename (natural sort). | ✓ |
| Selection order | The order files appear in the multi-select dialog becomes the sequence. | |
| Review & reorder step | Import lands in filename order but a thumbnail strip lets the user drag-reorder before committing. | |

**User's choice:** Import button opens the **project asset module**, NOT a bare macOS dialog. Clicking Import on the Bg row swaps the Studio canvas region to a scoped asset-picker variant (images-only, multi-select, Confirm/Cancel) — the same full-area pattern as the main editor's ImportedView, not a floating dialog. Inside it, the user imports new images into the project library OR selects already-imported ones; the chosen images land as clips on the Background row. Reuse boundary: build the compact variant from imageStore + ImportGrid (lean: signals + importImages/assetUrl IPC). Do NOT port ImportedView itself into the Studio window — it is coupled to sequence/layer/audio intents from the main editor. Locks: the engine stays mounted underneath (paused) and the composite refreshes on return — no canvas recreation. Confirm drops the clip at the current playhead frame. Cancel returns untouched. Picker refreshes the library on open; no live cross-window sync required in this phase. Clarification: the existing static fond selector (bgMode: photo / canvas textures) maps to the Background track's fallback config — it is NOT this feature. This phase's Import feeds timeline clips; photoReference stays Phase 50 scope.
**Notes:** Sequence ordering = natural filename sort, hard lock: sort by the ORIGINAL FILENAME (natural/numeric-aware: shot_1 < shot_2 < shot_10), never by the asset UUID. Asset IDs are random UUID v4 (image_pool.rs), so the existing main-editor image-sequence flow's selectedIds.sort() produces an effectively arbitrary order today — Phase 49 must not copy that pattern. Selection order is irrelevant for 50-frame stop-motion plates; a review/reorder step can be added later if real usage asks.

---

## Clip placement & edits

| Option | Description | Selected |
|--------|-------------|----------|
| At playhead (confirm) | Confirm drops the clip at the current playhead frame. | ✓ |
| Append after last clip | New clips always append after the last clip's end (or frame 0 if empty). | |
| Reject + capsule | Any import/move that would overlap an existing clip is rejected with the status-capsule red warning. | ✓ (refined) |
| Snap to free frame | The clip's start auto-adjusts to the nearest free frame. | |
| Reject import, snap drag | Imports reject on overlap; drags snap to the nearest free position. | |
| Drag the rail | Drag the clip rail to move its start frame, reusing the Phase 43 rail drag machinery. | ✓ |
| Numeric field | A numeric start-frame field in the clip editor for exact placement. | |
| Both | Drag for quick moves plus a numeric field for exact values. | |
| Numeric + ∞ toggle | Reuse the PlayScript dialog pattern plus an explicit ∞ toggle/checkbox. | ✓ |
| Stepper + ∞ | ▲▼ increment/decrement buttons with a separate ∞ control. | |
| Text field w/ ∞ | A single text field that accepts a number or the literal '∞'. | |
| Right panel | Clicking a Bg clip rail selects it; the right-panel section shows its properties. | ✓ |
| Inline popover | A small editor popover anchored near the selected clip rail. | |
| Panel + inline | Right panel for properties plus a compact inline affordance. | |
| Plain undoable delete | Deleting a Bg clip is a plain undoable delete — one Undo restores it. | ✓ |
| Acknowledge dialog | Reuse the track acknowledge-and-delete dialog for clip deletion too. | |

**User's choice:** Placement = at playhead, confirmed. Precision on the collision law: rejection (capsule warning) applies ONLY when the playhead sits strictly inside an existing clip. If the imported clip is longer than the gap and overlaps the NEXT clip downstream, that is NOT a rejection — the existing interruption law applies (next clip interrupts without overlap, stop at next clip or parent end), consistent with the Phase 48 compositor semantics.
**Notes:** Collision = fail-closed on START collision only, interruption law for downstream extent. Any import or drag whose landing frame sits strictly inside an existing clip is rejected with the status-capsule red warning. But a clip LONGER than the gap is NOT rejected: the existing interruption law applies — visual cut at the next clip's start, data preserved, same as Loop Clip endpoint cuts (Phases 43/48). Same rule for import and drag — no asymmetric snap behavior. Start-frame editing = drag the rail (Phase 43 machinery). Repeat input = numeric field + ∞ toggle (PlayScript dialog pattern). Per-clip controls live in the right panel. Deleting a Background clip is a plain undoable delete (no acknowledge dialog, since clips hold no accepted cache assets like tracks do).

---

## Source persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Library asset IDs | Imported images live in the project library (imageStore / image_pool.rs); sourceFrameRefs reference library asset IDs, never external file paths. | ✓ |
| External file paths | Clips reference the original files on disk by path. | |
| Fail-closed only | A missing library asset renders transparent + the status-capsule red warning. | ✓ |
| Fail-closed + re-link | Fail-closed plus a per-clip 're-link' affordance in this phase. | |

**User's choice:** Library asset IDs — imported images live in the project library (imageStore / image_pool.rs, the same pool the main editor uses); a clip's sourceFrameRefs reference library asset IDs, never external file paths. Repeats reference the same asset (no durable duplication). Selecting already-imported images reuses existing assets without copying.
**Notes:** Missing source = fail-closed only — a missing library asset renders transparent + the status-capsule red warning (Phase 48 D-09). Re-import/re-link of a missing clip is deferred to a later phase.

---

## Fallback config + gaps

| Option | Description | Selected |
|--------|-------------|----------|
| Fond selector = fallback | The existing fond selector (transparent / white / canvas1-3 + grain) becomes the Background fallback config; the document fallback union is extended to carry those modes. | ✓ (refined) |
| Solid/transparent only | A new minimal fallback control (transparent or solid color) drives background.fallback. | |
| Map textures to solid | The selector drives the document fallback; canvas textures map to a solid color in the document. | |
| Row swatch + monitor fond | The Bg row shows the transparent checkerboard or the solid fallback swatch in gaps; the program monitor shows the fond beneath the composite. | ✓ (refined) |
| Distinct gap hatch | Gaps also show a distinct 'no clip' hatch/pattern on the Bg row. | |

**User's choice:** Fond selector = fallback, photo mode excluded. The existing fond selector (transparent / white / canvas1-3 + grain) becomes the Background fallback config, and the document fallback union is extended to carry those modes — one surface, faithful flattened output (the 48 compositor already draws the fond beneath the composite at project resolution). The 'photo' fond mode is NOT part of this mapping: user photos belong to the reserved photoReference slot, Phase 50 scope. In Phase 49 the selector drops 'photo' — acceptable under the clean-break contract since legacy one-track projects are rejected at parse anyway.
**Notes:** Gap display = row swatch + monitor fond, with one scoped addition: when the effective fond is TRANSPARENT (transparent fallback, no paper texture, no clip covering the frame), the Studio program monitor draws a transparency checkerboard instead of the current black backdrop (After Effects convention). The checkerboard appears ONLY in that no-fond case — with a paper/canvas texture or solid fallback active, the monitor shows the fond as today. Monitor-only, never part of the flattened raster or export.

---

## Claude's Discretion

- Exact store/function shape for the asset-picker variant (reuse imageStore + ImportGrid), the Background clip CRUD store ops, and the rail-drag integration for Bg clips.
- Exact document fallback union extension shape (fond modes) and how the compositor's fond draw consumes it.
- Exact right-panel clip-properties section layout and copy (English).
- The ∞ toggle affordance details in the repeat input.
- Whether the Bg row's own `visible` toggle is surfaced in Phase 49 (Phase 48 D-04: Background stays visible on solo; its own `visible` flag controls it).

## Deferred Ideas

- Review/reorder step after import (thumbnail strip drag-reorder) — add later if real usage asks.
- `photoReference` track — Phase 50 (REF); the `'photo'` fond mode is reserved for it.
- Re-import/re-link of a missing Background clip — later phase (fail-closed only in Phase 49).
