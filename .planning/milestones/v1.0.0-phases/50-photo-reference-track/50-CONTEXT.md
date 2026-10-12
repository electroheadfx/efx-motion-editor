# Phase 50: Photo/Reference Track - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add one durable photo/reference track per EFX Paint document — a source track used for painting reference, Reveal source, and accepted masked-transform workflows — without turning it into a main-editor content track. The phase delivers: the track model (stable source identity + revision, three source modes), reference-only Studio visibility (a painting overlay), explicit exclusion from ordinary flattened Paint output, frame-aligned source resolution, missing-source recovery, and save/reopen persistence. Reveal compositing itself is Phase 52; this phase sets up the source and modes it consumes.

**Naming contract (locked by user, carried from Phases 45/46/47/48/49):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

**Copy language (carried from Phase 47):** All user-facing copy is **English**.

**Current model state:** `EfxPaintDocument.photoReference` is `null` today; the parser (`efxPaintDocumentParsers.ts`) rejects any non-null value. This phase replaces it with a real `PhotoReferenceTrack` — a clean-break format change under the v1.0.0 contract.

</domain>

<decisions>
## Implementation Decisions

### Source import & sequence (REF-02, REF-04)
- **D-01:** **Reuse the Phase 49 asset-picker variant** (`BackgroundAssetPickerView`) for the reference source — images-only, multi-select, Confirm/Cancel, full-area region swap. NOT a bare macOS dialog, NOT a port of the main editor's `ImportedView` (coupled to sequence/layer/audio intents). — **Reversibility:** costly — the picker variant is a full-area surface; reverting to a dialog means unwinding it.
- **D-02:** The reference source is **one still image OR one ordered sequence** (natural filename sort, Phase 49 D-02 — never asset UUID order). A single image is a cycle of length 1. A sequence enables frame-aligned resolution over time (Pitfall M5).
- **D-03:** **Replaceable source via a row Import control** (like the Bg row). Re-opening the picker REPLACES the source; replacement bumps the source revision (REF-04), invalidating dependent Reveal/transformation results. One source at a time. — **Reversibility:** one-way — the replace contract is a published behavior; changing it later changes which source lands where.
- **D-04:** **Missing source recovery = the same Replace flow.** A missing library asset renders the reference absent in Studio + the status-capsule red warning (fail-closed, Phase 48 D-09). The user re-opens the picker and re-selects/re-links the source. No separate recovery surface.

### Mode switching & behavior (REF-02)
- **D-05:** **Segmented control/dropdown** on the photo/reference row (or right panel) with the three modes: `reference-only` / `reveal-source` / `masked-transform-source`. Switching is instant and undoable.
- **D-06:** **Flag-only in Phase 50.** All three modes show the reference overlay identically while painting; the mode is a persisted flag consumed by Phase 52 (Reveal) and the future masked-transform workflow. **HARD LOCK (user):** in ALL THREE modes, reference pixels NEVER reach the flattened raster, main preview, or export — the mode only changes the persisted flag. Reference leaking into output before Phase 52 exists would be an unguarded regression. — **Reversibility:** one-way — the exclusion guarantee is a published output contract; relaxing it later breaks the release stop condition "Reference-only photo pixels leak into output".
- **D-07:** **Mode switch is one undoable document mutation** (unified 10-level undo by reference, Phase 46) and bumps the photo/reference track revision — so save/reopen and any dependent cache key see it.
- **D-08:** **The reserved `'photo'` fond mode stays absent in Phase 50.** Wiring it would draw reference pixels as the document fallback — which IS part of the flattened output (Phase 48) — directly violating the D-06 exclusion lock. Defer to a later phase with a Studio-only display if ever wanted.

### Reference overlay look (REF-03)
- **D-09:** **Ghost overlay + toggle.** The reference draws as a semi-transparent ghost on top of the composite while painting (like onion skin, Phase 48 D-06). Never part of the flattened raster.
- **D-10:** The overlay is **independent of Paint-track hide/solo** — controlled only by its own toggle (matches the Background rule, Phase 48 D-04: Background stays visible on solo).
- **D-11:** The overlay toggle is **persisted in the document** (`visibleInStudio` on the photo/reference track, per the spec sketch) and survives save/reopen.
- **D-12:** **Adjustable opacity slider in the right panel.** Live preview as you drag, commit on release (same release-commit pattern as track opacity, Phase 48). It is a **persisted display preference** on the photo/reference track (survives save/reopen alongside `visibleInStudio`), **NOT an undoable document mutation**, and never touches the flattened raster.
- **D-13:** **Reference display transform with direct canvas manipulation** — position X/Y, scale X/Y, rotation — drag to move, corner handles to scale, rotation handle. Reuses the main editor's **TransformOverlay** pattern. **Lock toggle:** locked by default (painting works normally); unlocking enters reference-transform mode (canvas gestures move the overlay, handles active); re-lock to paint again. Default = centered at natural size, no rotation. Transform + lock state persist as **display properties** (same class as the opacity slider — not undoable document mutations). **Identical transform in all three modes** so what you align is what Reveal will reveal. NEVER affects the flattened raster or export. — **Reversibility:** costly — the canvas-transform surface is new; reverting to a fixed overlay means unwinding the handle machinery.
- **D-14:** The overlay is visible **only while painting/editing on the active track** — it hides during playback and export (matches onion-skin behavior, Phase 48 D-06).

### Frame alignment law (REF-02, Pitfall M5)
- **D-15:** **Application frame N → source frame N, 1:1 from frame 0, clamped at the sequence end** (last source frame holds). No start offset, no loop. The reference always matches the frame you're on; Reveal (Phase 52) uses the exact referenced source frame.

### Claude's Discretion
- Exact store/function shape for the photo/reference track CRUD ops, the source revision bump, and the reference overlay draw path.
- Exact segmented-control/dropdown placement (row vs right panel) and copy (English).
- Exact TransformOverlay reuse shape for the reference transform (how the display transform is applied when drawing the ghost).
- Whether the photo/reference row's own `visible` toggle is surfaced in Phase 50 (the overlay toggle D-11 covers it).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 6 — Photo/reference track (objective, requirements, acceptance). Also §"Photo/reference track" (locked modes: `reference-only` / `reveal-source` / `masked-transform-source`; must not auto-enter parent output), §"Canonical document concept" (`PhotoReferenceTrack` / `PhotoSourceReference` model: id, source, mode, visibleInStudio, revision), §"Forbidden sequence-level assumptions" (photo/reference track as a main-editor content track forbidden), §"Release stop conditions" (reference-only photo pixels leak into output).

### Milestone research (2026-08-23, confidence HIGH)
- `.planning/research/SUMMARY.md` — Phase 6 section: one photo/reference track, three source modes, reference-only Studio visibility, exclusion from flattened output, frame-aligned source resolution, missing-source recovery. Uses `imageStore` LRU + Rust image pipeline.
- `.planning/research/PITFALLS.md` — Pitfall 14 (reference photo leaks into output — the track-matte classic leak), Pitfall M5 (frame-aligned source resolution — reference changes over time but source resolved once at import), Pitfall M6 (missing source treated as silent transparency).

### Requirements
- `.planning/REQUIREMENTS.md` §REF — REF-01..REF-05 mapped to this phase.
- `.planning/ROADMAP.md` §Phase 50 — goal, success criteria.

### Prior phase context
- `.planning/phases/49-fixed-background-track-and-imported-loop-clips/49-CONTEXT.md` — D-02 (natural filename sort, never asset UUID), D-09 (library asset IDs, never external paths), D-10 (missing source fail-closed), D-11 (`'photo'` fond mode reserved for the photoReference slot).
- `.planning/phases/48-internal-compositor-and-flattened-parent-result/48-CONTEXT.md` — D-04 (Background stays visible on solo), D-05 (Studio canvas = program monitor, flattened composite), D-06 (onion-skin ghosts over the composite), D-09 (missing source = transparent + status capsule), D-11 (`getFlattenedFrame` delivery seam).
- `.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-CONTEXT.md` — hide/solo truth table, track identity rules, distinct surfaces for photo/reference vs editable Paint rows.
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-CONTEXT.md` — D-01..D-03 (unified 10-level undo by reference), D-10..D-13 (Hold linked-source semantics, fail-closed on source-missing).

### Code anchors
- `app/src/efx-paint/document/efxPaintDocument.ts` — the v1.0 document model: `EfxPaintDocument.photoReference: null` (to be replaced with `PhotoReferenceTrack` per the spec sketch: id, source, mode, visibleInStudio, revision).
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — the parser currently rejects non-null `photoReference` (line ~327); this phase extends it.
- `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` — the Phase 49 asset-picker variant to reuse for the reference source (D-01).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` + `PhysicsPaintTrackRow.tsx` — the Bg row pattern (`kind="background"`) to extend for the photo/reference row.
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` — the fond selector; `buildRotoBackgroundMetadata` still maps `settings.background === 'photo'` to transparent (the reserved mode, D-08).
- `app/src/stores/physicPaintStore.ts` — the store; `getFlattenedFrame`, `resolveBackgroundFrame`, `registerBackgroundSourceImage` ports the reference source resolution follows.
- `app/src/lib/previewRenderer.ts` — the main-editor boundary; the reference overlay never enters it (D-06, D-13).
- The main editor's TransformOverlay — the canvas-manipulation pattern to reuse for the reference transform (D-13).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BackgroundAssetPickerView.tsx` — the asset-picker variant reused for the reference source (D-01).
- `PhysicsPaintWorkflowStrip.tsx` / `PhysicsPaintTrackRow.tsx` — the Bg row pattern extended for the photo/reference row + Import control (D-03).
- The main editor's TransformOverlay — the canvas-manipulation pattern reused for the reference transform (D-13).
- The status capsule (`setApplyStatus('error')`) — the fail-closed rejection surface (D-04).
- The onion-skin ghost pattern (Phase 48 D-06) — the reference overlay draws like it (D-09).

### Established Patterns
- English copy everywhere (Phase 47 correction).
- Library asset IDs, never external paths; repeats reference the same asset (Phase 49 D-09).
- Fail-closed rejections surface in the status capsule with a red warning triangle (Phase 46 paste UX) — reused for missing-source alerts (D-04).
- Unified document-wide 10-level undo by reference (Phase 46 D-01..D-03) — the mode switch records by reference (D-07).
- Track identity: stable `trackId` UUID strings, never array indices.
- Per-track revision + `paintVersion` bump — the source revision feeds dependent cache keys (REF-04).
- Release-commit pattern for sliders (track opacity, Phase 48) — the reference opacity slider follows it (D-12).
- Clean-break no-compat: legacy one-track projects rejected at parse; the `photoReference` null→track change is a clean-break format change.

### Integration Points
- `PhysicsPaintStudio.tsx` — the photo/reference row, the asset-picker region swap (D-01), the reference overlay draw path.
- `PhysicsPaintWorkflowStrip.tsx` — the photo/reference row + Import control (D-03).
- The right panel — the mode selector (D-05) and the opacity slider (D-12).
- `physicPaintStore.ts` — photo/reference track CRUD ops, source revision bump, mode mutation, undo/redo recording.
- `efxPaintDocument.ts` + `efxPaintDocumentParsers.ts` — the `PhotoReferenceTrack` model + parser extension.
- `imageStore.ts` / `ImportGrid.tsx` — the asset-picker variant (D-01).
- The compositor + `previewRenderer.ts` — unchanged flattened path; the reference overlay never enters it (D-06, D-13).

</code_context>

<specifics>
## Specific Ideas

- The user's hard lock: **reference pixels NEVER reach the flattened raster, main preview, or export in ANY mode** — leaking before Phase 52 exists would be an unguarded regression. The mode only changes the persisted flag.
- The user added a **canvas-transformable reference overlay** (drag to move, corner handles to scale, rotation handle) with a **lock toggle** — because a source image rarely arrives at the exact framing needed. Locked by default so painting gestures never accidentally move it.
- The reference transform is **identical in all three modes** so what you align is what Reveal will reveal.
- The opacity slider is a **persisted display preference, NOT an undoable document mutation** — same class as the transform/lock state.

</specifics>

<deferred>
## Deferred Ideas

- `'photo'` fond mode wiring — deferred to a later phase (would draw reference pixels as the document fallback, part of flattened output — violates D-06).
- Reveal compositing — **Phase 52** (RVL); consumes the `reveal-source` mode and the frame-aligned source resolution.
- Masked-transform workflow — future accepted local transformation result consumes the `masked-transform-source` mode.
- Reference overlay opacity slider — implemented in Phase 50 (D-12), but noted as a display preference, not an undoable mutation.

</deferred>

---

*Phase: 50-photo-reference-track*
*Context gathered: 2026-09-01*
