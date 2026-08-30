# Phase 49: Fixed Background Track and Imported Loop Clips - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the **authoring surface** for the fixed Background track: importing still/sequence clips, positioning them, setting finite/infinite repeat, configuring the fallback, and persisting. The **compositor side is already done** — Phase 48 D-03 resolved Background clips (modulo source mapping, finite/infinite repeat, gaps, next-clip interruption) reusing the Loop Clip resolver, and the document model already carries `background.clips` + `background.fallback`. This phase adds the import/repeat/fallback-config UI plus the clip CRUD store ops, undo/redo (BKG-08), and save/reopen (BKG-09) that consume the existing model and resolution path.

**Naming contract (locked by user, carried from Phases 45/46/47/48):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

**Copy language (carried from Phase 47):** All user-facing copy is **English**.

**Clarification (user, this phase):** The existing static fond selector (`settings.background`: transparent / white / canvas1-3 + grain) maps to the Background track's **fallback config** — it is NOT the Import feature. This phase's Import feeds timeline clips; `photoReference` stays Phase 50 scope.

</domain>

<decisions>
## Implementation Decisions

### Import UX (BKG-02)
- **D-01:** The Import control on the Bg row opens the **project asset module** — NOT a bare macOS dialog. Clicking Import swaps the Studio canvas region to a **scoped asset-picker variant** (images-only, multi-select, Confirm/Cancel) — the same full-area pattern as the main editor's `ImportedView`, not a floating dialog. Inside it, the user imports new images into the project library OR selects already-imported ones; the chosen images land as clips on the Background row. **Reuse boundary:** build the compact variant from `imageStore` + `ImportGrid` (lean: signals + `importImages`/`assetUrl` IPC). Do **NOT** port `ImportedView` itself into the Studio window — it is coupled to sequence/layer/audio intents from the main editor. **Locks:** the engine stays mounted underneath (paused) and the composite refreshes on return — no canvas recreation. Confirm drops the clip at the current playhead frame (D-03). Cancel returns untouched. The picker refreshes the library on open; no live cross-window sync required in this phase. — **Reversibility:** costly — the asset-picker variant is a new full-area surface in the Studio; reverting to a dialog means unwinding it.
- **D-02:** Sequence ordering is **natural filename sort, hard lock**: sort by the ORIGINAL FILENAME (natural/numeric-aware: `shot_1 < shot_2 < shot_10`), **never by the asset UUID**. Asset IDs are random UUID v4 (`image_pool.rs`), so the existing main-editor image-sequence flow's `selectedIds.sort()` produces an effectively arbitrary order today — Phase 49 must **not** copy that pattern. Selection order is irrelevant for 50-frame stop-motion plates; a review/reorder step can be added later if real usage asks. — **Reversibility:** one-way — the ordering contract is a published behavior; changing it later changes which frames land where in every existing clip.

### Clip placement & edits (BKG-03, BKG-04, BKG-05)
- **D-03:** **Placement = at the playhead, confirmed.** Confirm drops the clip at the current playhead frame. Precision on the collision law: rejection (capsule warning) applies ONLY when the playhead sits **strictly inside** an existing clip. If the imported clip is longer than the gap and overlaps the NEXT clip downstream, that is NOT a rejection — the existing interruption law applies (next clip interrupts without overlap, stop at next clip or parent end), consistent with the Phase 48 compositor semantics.
- **D-04:** **Collision = fail-closed on START collision only, interruption law for downstream extent.** Any import or drag whose landing frame sits strictly inside an existing clip is rejected with the status-capsule red warning (the established paste-rejection UX). But a clip LONGER than the gap is NOT rejected: the existing interruption law applies — visual cut at the next clip's start, data preserved, same as Loop Clip endpoint cuts (Phases 43/48). **Same rule for import and drag — no asymmetric snap behavior.** — **Reversibility:** costly — changing the collision law later changes the visual result and requires re-validating the interruption semantics.
- **D-05:** **Start-frame editing = drag the rail.** Reuse the Phase 43 rail drag machinery (live preview, release-time commit, collisions reject on start collision per D-04).
- **D-06:** **Repeat input = numeric field + ∞ toggle.** Reuse the PlayScript dialog pattern ("Enter a positive integer") plus an explicit ∞ toggle/checkbox. The badge shows `×N` or `×∞`.
- **D-07:** **Per-clip controls live in the right panel.** Clicking a Bg clip rail selects it; the right-panel section shows its properties (start frame, repeat, source cycle, delete). Consistent with the existing right-panel Track section.
- **D-08:** **Deleting a Background clip is a plain undoable delete** — one Undo restores it, no acknowledge dialog, since clips hold no accepted cache assets like tracks do. Matches BKG-08 by-reference undo.

### Source persistence (BKG-07, BKG-09, CMP-05)
- **D-09:** **Source model = library asset IDs.** Imported images live in the project library (`imageStore` / `image_pool.rs`, the same pool the main editor uses); a clip's `sourceFrameRefs` reference library asset IDs, **never external file paths**. Repeats reference the same asset (no durable duplication). Selecting already-imported images reuses existing assets without copying. — **Reversibility:** one-way — the reference model is a published persistence contract; switching to external paths later would break save/reopen and missing-source handling.
- **D-10:** **Missing source = fail-closed only.** A missing library asset renders transparent + the status-capsule red warning (Phase 48 D-09). Re-import/re-link of a missing clip is deferred to a later phase.

### Fallback config & gaps (BKG-06)
- **D-11:** **Fond selector = fallback, photo mode excluded.** The existing fond selector (transparent / white / canvas1-3 + grain) becomes the Background fallback config, and the document fallback union is extended to carry those modes — one surface, faithful flattened output (the Phase 48 compositor already draws the fond beneath the composite at project resolution). The `'photo'` fond mode is NOT part of this mapping: user photos belong to the reserved `photoReference` slot, Phase 50 scope. In Phase 49 the selector drops `'photo'` — acceptable under the clean-break contract since legacy one-track projects are rejected at parse anyway. — **Reversibility:** one-way — extending the document fallback union changes the persisted schema; dropping `'photo'` from the selector is a clean-break surface change.
- **D-12:** **Gap display = row swatch + monitor fond, with one scoped addition.** The Bg row shows the transparent checkerboard or the solid fallback swatch in gaps (Phase 47 D-06, already locked); the Studio program monitor shows the fond beneath the composite (Phase 48 UAT-C already draws the paper layer). **Addition:** when the effective fond is TRANSPARENT (transparent fallback, no paper texture, no clip covering the frame), the Studio program monitor draws a **transparency checkerboard** instead of the current black backdrop (After Effects convention). The checkerboard appears ONLY in that no-fond case — with a paper/canvas texture or solid fallback active, the monitor shows the fond as today. **Monitor-only, never part of the flattened raster or export.**

### Claude's Discretion
- Exact store/function shape for the asset-picker variant (reuse `imageStore` + `ImportGrid`), the Background clip CRUD store ops, and the rail-drag integration for Bg clips.
- Exact document fallback union extension shape (fond modes) and how the compositor's fond draw consumes it.
- Exact right-panel clip-properties section layout and copy (English).
- The ∞ toggle affordance details in the repeat input.
- Whether the Bg row's own `visible` toggle is surfaced in Phase 49 (Phase 48 D-04: Background stays visible on solo; its own `visible` flag controls it).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 5 — Fixed Background track and imported Loop Clips (objective, track rules, loop resolution, required example, timeline visualization). Also §"Background track and Loop Clips" (locked rules: non-overlap, repeat 1..∞, interruption, fallback) and §"Canonical document concept" (`BackgroundTrack` / `FrameLoopClip` / `BackgroundFallback` model) and §Phase 3 (Background row visualization, `clip suivant — interrompt la boucle` — superseded by English copy per Phase 47 D-14).

### Milestone research (2026-08-23, confidence HIGH)
- `.planning/research/SUMMARY.md` — executive summary, build-order rationale, per-phase pitfalls. Phase 5 section: Background import, non-overlap, gaps, fallback, requested/effective duration.
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (track-local addressing), the `efx-paint/compositor/` folder, the locked invariant (one parent layer → one document → many tracks → one flattened result).
- `.planning/research/PITFALLS.md` — Pitfall 9 (loop asset duplication), Pitfall 12 (Background overlap/reorder), Pitfall 13 (Background gaps differ), Pitfall m2 (requested vs effective duration visibility), Pitfall m3 (Background/photo-reference visual confusion).

### Requirements
- `.planning/REQUIREMENTS.md` §BKG — BKG-01..BKG-09 mapped to this phase.
- `.planning/ROADMAP.md` §Phase 49 — goal, success criteria.

### Prior phase context
- `.planning/phases/48-internal-compositor-and-flattened-parent-result/48-CONTEXT.md` — D-03 (compositor fully resolves Background clips now; Phase 49 adds only the import/repeat/fallback-config UI), D-04 (Background stays visible on solo), D-09 (missing source = transparent + status capsule), D-11 (`getFlattenedFrame` delivery seam), UAT-C (fond-less monitor composite + paper fond layer).
- `.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-CONTEXT.md` — D-06 (Bg row: muted "Bg" label, lock indicator, gaps show checkerboard/solid swatch), D-12/D-14 (interruption label "next clip — interrupts the loop", English), close-out (filmstrip capsule removed by user demand — rails + tooltip only).
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-CONTEXT.md` — D-01..D-03 (unified 10-level undo by reference), D-10..D-13 (Hold linked-source semantics, fail-closed on source-missing), D-14..D-18 (track deletion laws).
- `.planning/phases/45-new-efx-paint-document-and-clean-cutover/45-CONTEXT.md` — document model decisions, identity rules, clean-break invariants, transparent fallback default (D-08).

### Code anchors
- `app/src/efx-paint/document/efxPaintDocument.ts` — the v1.0 document model: `BackgroundTrack` carries `clips`, `fallback`, `visible`, `revision`; `FrameLoopClip` carries `id`, `startFrame`, `sourceFrameRefs`, `repeat`, `sourceKind`, `revision`; `BackgroundFallback` is `{ mode: 'transparent' } | { mode: 'solid'; color }` (to be extended per D-11).
- `app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts` — Background clip resolution (modulo, repeat, gaps, interruption) + `projectBackgroundFrameLoopClip` projection.
- `app/src/stores/physicPaintStore.ts` — `resolveBackgroundFrame`, `registerBackgroundSourceImage`, `resolveBackgroundSourceImage`, `getFlattenedFrame` delivery point, `_resolveDocumentFondInstruction` (fond draw).
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` + `PhysicsPaintWorkflowStrip.tsx` — the Bg row (`kind="background"`, muted skeleton) and the rail drag machinery to extend for Bg clips.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — the repeat-input pattern ("Enter a positive integer") + `× ∞` badge copy to reuse (D-06).
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` + `PhysicsPaintStudio.tsx` — the fond selector (`settings.background`: transparent / white / canvas1-3 + grain) that becomes the fallback config (D-11).
- `app/src/stores/imageStore.ts` + `app/src/components/import/ImportGrid.tsx` — the project asset library + grid the asset-picker variant is built from (D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `imageStore.ts` + `ImportGrid.tsx` — the project asset library and grid; the compact asset-picker variant is built from these (D-01), NOT `ImportedView`.
- `PhysicsPaintWorkflowStrip.tsx` / `PhysicsPaintTrackRow.tsx` — the Bg row skeleton (`kind="background"`) and the Phase 43 rail drag machinery (live preview, release-time commit) reused for Bg clip start-frame drag (D-05).
- `PhysicsPaintPlayScriptDialog.tsx` — the repeat-input pattern (numeric field + validation) reused for the clip repeat control (D-06).
- `physicsPaintStudioSettings.ts` / `PhysicsPaintStudio.tsx` — the fond selector (`settings.background`) that becomes the fallback config (D-11).
- `efxPaintBackgroundResolution.ts` + `physicPaintStore.ts` (`resolveBackgroundFrame`, `registerBackgroundSourceImage`) — the resolution + source-image ports the clip CRUD ops call.
- The status capsule (`setApplyStatus('error')`) — the established fail-closed rejection surface (D-04, D-10).

### Established Patterns
- English copy everywhere (Phase 47 correction).
- Fail-closed rejections surface in the status capsule with a red warning triangle (Phase 46 paste UX) — reused for start-collision rejections (D-04) and missing sources (D-10).
- Rail drag: live preview, release-time commit, rejection publication — the Bg clip drag extends this (D-05).
- Right-panel Track section shows the active track's properties — the Bg clip-properties section follows it (D-07).
- Unified document-wide 10-level undo by reference (Phase 46 D-01..D-03) — clip CRUD ops record by reference (BKG-08).
- Library asset IDs, never external paths; repeats reference the same asset (no durable duplication) (D-09).
- Clean-break no-compat: legacy one-track projects rejected at parse; dropping `'photo'` from the fond selector is acceptable (D-11).

### Integration Points
- `PhysicsPaintStudio.tsx` — the asset-picker region swap (D-01), the fond selector → fallback config wiring (D-11), the program-monitor transparent checkerboard (D-12).
- `PhysicsPaintWorkflowStrip.tsx` — Bg clip rails + drag on the Bg row (D-05), clip selection.
- The right panel — the Bg clip-properties section (D-07).
- `physicPaintStore.ts` — Background clip CRUD store ops, fallback config mutation, undo/redo recording.
- `efxPaintDocument.ts` — the document fallback union extension (D-11).
- `imageStore.ts` / `ImportGrid.tsx` — the asset-picker variant (D-01).
- The compositor + `previewRenderer.ts` — unchanged flattened path; the monitor-only checkerboard never enters it (D-12).

</code_context>

<specifics>
## Specific Ideas

- The user anchored the import to the main editor's `ImportedView` **full-area pattern** but explicitly forbade porting `ImportedView` itself into the Studio window — it is coupled to sequence/layer/audio intents. Build the compact variant from `imageStore` + `ImportGrid`.
- The user's collision law is precise: **reject only on START collision** (strictly inside an existing clip); downstream extent follows the interruption law — same for import and drag, no asymmetric snap.
- The fond selector (transparent / white / canvas1-3 + grain) **IS** the fallback config; `'photo'` is reserved for Phase 50 `photoReference`.
- The transparent no-fond case shows a **monitor-only transparency checkerboard** (After Effects convention) — never in the flattened raster or export.

</specifics>

<deferred>
## Deferred Ideas

- Review/reorder step after import (thumbnail strip drag-reorder) — add later if real usage asks.
- `photoReference` track — **Phase 50** (REF); the `'photo'` fond mode is reserved for it (D-11).
- Re-import/re-link of a missing Background clip — later phase (fail-closed only in Phase 49, D-10).

</deferred>

---

*Phase: 49-fixed-background-track-and-imported-loop-clips*
*Context gathered: 2026-08-30*
