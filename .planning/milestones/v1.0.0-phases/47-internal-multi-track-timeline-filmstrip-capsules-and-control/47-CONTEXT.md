# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the multi-row Paint timeline inside EFX Physic Paint Studio: N Paint track rows + one fixed Background row, track CRUD UI (add/rename/duplicate/delete/reorder), active-track selection, hide/solo/opacity/blend controls, Hold Loop Clip filmstrip capsules, vertical scrolling with ensure-active-track visibility, and the cross-track drag gesture deferred from Phase 46 (D-08/D-09). The data/state layer (track-local addressing, track-aware undo, cross-track copy/paste/move data ops, Hold linked-source semantics, deletion laws) was built in Phase 46 — this phase is the UI + gesture layer that consumes it. The internal compositor (opacity/blend application, flattened parent raster) is Phase 48; Phase 47 only reflects hide/solo in the Studio preview.

**Naming contract (locked by user, carried from Phases 45/46):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

**Copy language (user correction, overrides spec):** All user-facing copy in this phase is **English**. The spec's French copy gate (Pitfall m1: `clip suivant — interrompt la boucle` / `Boucle raccourcie par le clip suivant`) is a **recorded v0.9 divergence, not shipped copy**. Shipped labels: "Loop shortened by next clip" and "next clip — interrupts the loop". Do NOT implement French labels.

</domain>

<decisions>
## Implementation Decisions

### Row layout & header column (TML-01, TML-03, TML-07)
- **D-01:** The multi-row timeline uses an **NLE structure**: a fixed-width header column (~140px, user-resizable) listing every track, with the frame cells extending to the right. The existing header/action row stays on top as the global toolbar. Every row is always visible with its identity. — **Reversibility:** costly — the single-row strip (`PhysicsPaintWorkflowStrip.tsx`, ~2400 lines) is generalized into a row-based model; reverting to single-row means unwinding that refactor.
- **D-02:** Track names are **truncated with an ellipsis** when too long (full name on hover tooltip). Auto-generated names stay short: "Paint 1", "Paint 2", ... The **timeline frame area never depends on name length**.
- **D-03:** Rename is **edit-in-place on double-click** in the header column.
- **D-04:** The active track is marked with an **accent-colored left border + subtle row background tint + bold track name** — always visually unambiguous (TML-03), distinct from rail selection colors (orange selection line, purple/cyan loop rails).
- **D-05:** Vertical scrolling: the **header column stays pinned** while the frame rows scroll beneath it; a slim vertical scrollbar on the right. The **active row auto-scrolls into view** when it changes (track switch, undo auto-activation per Phase 46 D-04, keyboard navigation).
- **D-06:** The fixed Background row is labeled **"Bg"** (short label that fits the fixed-width header column without truncation) with a **muted tone** (darker/desaturated vs Paint rows) and a **lock indicator** (fixed position, cannot reorder above Paint rows — Pitfall 12). Gaps show the transparent checkerboard or solid fallback swatch.

### Track CRUD interactions (TML-02, TML-08)
- **D-07:** Add/duplicate/delete controls: **per-row hover actions** (duplicate, delete icon buttons) in the header column; a **'+' button at the bottom of the header column** adds a track. Everything track-related lives with the track — no global toolbar clutter.
- **D-08:** Reorder = **drag the row header** with a live insertion indicator. The header drag has a **distinct grab area + cursor** from content drag so the two never conflict.
- **D-09:** Duplicate = **full deep copy with fresh identities** (the Phase 46 paste rule, D-05): Paint frames, Roto keys, Loop Clips all copied self-contained, editable with zero effect on the source. Duplicate name gets a short suffix (e.g., " copie") — exact suffix is Claude's discretion.
- **D-10:** Track CRUD survives save/reopen; reorder changes compositor order but never track identity (stable UUIDs, Phase 45 — Pitfall 1, Pitfall M3).

### Filmstrip capsules (TML-06, TML-07)
- **D-11:** The filmstrip capsule **evolves the existing Loop Clip rail** (`PhysicsPaintLoopClipRail.tsx` + `physicsPaintLoopClipPresentation.ts`), it does not replace it. The Phase 43 rail semantics stay locked: selection, drag, spacing, playback, purple/cyan rails, passive markers, white endpoint cuts. The capsule adds the spec elements around the rail: source-cycle cells at the capsule head, ×N/∞ + requested/effective badges, diagonal cut on partial cycles, high-zoom expansion.
- **D-12:** A **compact badge on the capsule** shows the requested duration (`Cycle 5f × 3 = 15f`, `Cycle 1f × 20`, or `Cycle 5f × ∞`). When a next clip shortens the loop, the badge switches to the **distinct shortened visual + "Loop shortened by next clip"** label (Pitfall m2: badge always shows requested; shortened state is a distinct visual + label). Full detail (repeat instance, source-frame index, source asset, provenance) stays in the **tooltip**.
- **D-13:** High-zoom expansion: below a zoom threshold, repetitions show as the **compact perforated/hatched band**; above it, each repeated occurrence **expands into lighter linked cells** (same source-frame mapping, lighter tone). The threshold is **derived from cell width** so the expansion is gradual and predictable.
- **D-14:** The following-clip label is **"next clip — interrupts the loop"** (English, per the copy-language correction). Never "clip bloquant".

### Cross-track drag (TML-05, Phase 46 D-08/D-09)
- **D-15:** **All existing draggables can cross track rows**: real keys, Key Rails, Loop Clip Rails, rail sets. The drag starts on the source row and crosses into the destination row.
- **D-16:** **Plain drag crosses rows** — no modifier key. Crossing a row boundary automatically becomes a cross-track move: the destination row highlights as the drop target and a **live insertion preview** shows exactly where the dragged content will land in the destination row (frame position).
- **D-17:** On release, the move commits with the Phase 46 D-09 semantics (exactly copy-paste-delete: fresh identities in the destination, source items removed, Hold refs re-pointed fail-closed). Rejections surface through the **existing status capsule with the red warning triangle** — identical to the Phase 46 paste rejection UX.
- **D-18:** The row-reorder drag (D-08) and the content cross-track drag (D-15/D-16) are distinct interactions: different grab areas and cursors, so timeline interactions never mutate another row accidentally (TML-05 acceptance).

### Claude's Discretion
- Exact store/function shape for the multi-row strip refactor (generalize `PhysicsPaintWorkflowStrip.tsx` into a row-based model vs. a new multi-row container instantiating per-track strips — research recommends the former; researcher finalizes).
- Background row scope in Phase 47: the Bg row renders Background clips **when present** (display surface via the shared capsule, D-11); the import/repeat/fallback-config UI is Phase 49 (BKG). With no clips yet, the row shows the fallback display.
- Hide/solo Studio reflection: Phase 47 applies the **hide/solo truth table to the Studio preview** (visibility filter on the existing preview path, Pitfall M8); opacity/blend application is Phase 48 (CMP-03).
- No placeholder rows for photo/reference or audio surfaces in Phase 47 — they arrive with Phases 50/51; the row model should anticipate them but not render them.
- Keyboard shortcuts for track CRUD: guard against conflicts per the existing `isPaintEditMode()` shortcut-guard pattern (Pitfall m4).
- Duplicate name suffix (D-09), exact delete-confirmation copy (English, per Phase 46 D-14 acknowledge-and-delete), exact badge/tooltip copy wording.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 3 — Internal multi-track timeline and controls (objective, requirements, acceptance). Also §"Timeline visualization" (shared adaptive filmstrip capsule: source cycle, compact repetition band, badges, high-zoom expansion, diagonal partial-cycle cut) and §"Required truth tables" (hide/solo rules, internal frame axis). NOTE: the spec's French copy gate is superseded by the user's English-copy correction (D-14) — see `<domain>`.

### Milestone research (2026-08-23, confidence HIGH)
- `.planning/research/SUMMARY.md` — executive summary, build-order rationale, per-phase pitfalls. Phase 3 section: multi-row strip, filmstrip capsules, track CRUD UI, active selection, hide/solo/opacity/blend controls, fixed Background row.
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (track-local addressing), file map for the strip and stores.
- `.planning/research/PITFALLS.md` — Pitfall 12 (Background overlap/reorder), Pitfall M2 (active-track routing), Pitfall M3 (compositor order determinism), Pitfall M8 (hide/solo truth table drift), Pitfall m1 (banned `clip bloquant` term — superseded by English copy), Pitfall m2 (requested vs effective duration visibility), Pitfall m3 (Background/photo-reference visual confusion), Pitfall m4 (shortcut conflicts).

### Requirements
- `.planning/REQUIREMENTS.md` §TML — TML-01..TML-08 mapped to this phase.
- `.planning/ROADMAP.md` §Phase 47 — goal, success criteria.

### Prior phase context
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-CONTEXT.md` — D-01..D-20: track-aware undo (auto-activate target track), cross-track copy/paste/move data semantics (fresh identities, fail-closed Hold re-pointing), Hold linked-source semantics, track deletion laws (acknowledge-and-delete, last Paint track refused, nearest-adjacent activation), async revalidation. The drag gesture (D-08/D-09) is this phase's to build.
- `.planning/phases/45-new-efx-paint-document-and-clean-cutover/45-CONTEXT.md` — document model decisions, identity rules, clean-break invariants.

### Code anchors
- `app/src/efx-paint/document/efxPaintDocument.ts` — the v1.0 document model: `InternalPaintTrack` already carries `id`, `name`, `order`, `visible`, `solo`, `opacity`, `blendMode`, `revision`, `frames`, `rotoPhysical`, `loopClips`; `EfxPaintDocument` carries `documentRevision`, `activeTrackId`, `tracks`, `compositeRevision`.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — the single-row strip to generalize into the multi-row timeline (header, action row, cells, horizontal viewport, drag machinery).
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` + `PhysicsPaintLoopClipRail.tsx` — the Loop Clip rail + presentation the filmstrip capsule evolves (D-11).
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.ts` — the Loop Clip resolver (modulo, finite/infinite, next-clip interruption) — single resolver for all capsule labels (Pitfall m2).

### UI references
- `SPECS/physics-paint-ui/physics-paint.pen` — Pencil design for the Studio (UI hint: yes). Researcher should inspect for the multi-track timeline design intent.
- `SPECS/UI-SPECS/` — UI reference folder (canva/invideo layer-transform references).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PhysicsPaintWorkflowStrip.tsx` — the single-row Roto strip (header, roto action row, cells, horizontal viewport + zoom, playback, onion, selection, drag machinery). The multi-row timeline generalizes this into a row-based model; the existing header/action row becomes the global toolbar (D-01).
- `physicsPaintLoopClipPresentation.ts` — Loop Clip presentation (displayName, sourceLabel, cycleLabel, effectiveLabel, fragmentLabel, linkedDescription, tooltipLines) — the capsule badge/tooltip foundation (D-12).
- `PhysicsPaintLoopClipRail.tsx` — the Loop Clip rail rendering (purple/cyan, passive markers, white endpoint cuts) — evolved, not replaced (D-11).
- `physicsPaintRotoLoopClips.ts` — the Loop Clip resolver — single source for requested/effective duration and partial-cycle facts (Pitfall m2).
- `efxPaintDocument.ts` — track model already carries name/order/visible/solo/opacity/blendMode — the CRUD/hide/solo/opacity/blend controls mutate these fields.
- Phase 46 store ops — track CRUD, cross-track move data op, track-aware undo — the UI calls these.
- `physicsPaintStudioKeyboard.ts` / `physicsPaintRailKeyboardNavigation.ts` — existing keyboard navigation + shortcut guards to extend for track CRUD (Pitfall m4).
- `physicsPaintSoloArm.ts` — existing solo-arm pattern for the hide/solo controls.

### Established Patterns
- Track identity: stable `trackId` UUID strings, never array indices — reorder must never rewrite IDs (Pitfall 1, Pitfall M3).
- Hide/solo truth table locked: no solo → all visible; solo → visible+soloed only; hide wins over solo (Pitfall M8).
- Fail-closed rejections surface in the status capsule with a red warning triangle (Phase 46 paste UX) — reused for cross-track drag rejections (D-17).
- Per-track `paintVersion` bump + subscribe (Pitfall 4) — hide/solo/opacity/blend mutations bump the track revision.
- Drag machinery: single-key drag, rigid group drag, rail-set move, push — all with release-time rejection publication; the cross-track drag extends these across rows (D-15/D-16).

### Integration Points
- `PhysicsPaintStudioView.tsx` — the Studio container wiring the strip, toolbar, and right panel; the multi-row strip and track CRUD controls integrate here.
- `app/src/stores/physicPaintStore.ts` — track CRUD + hide/solo/opacity/blend store ops (Phase 46 built the data layer; this phase adds the UI calls).
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — the timeline action bundle the strip consumes; cross-track drag gestures route through it.
- `previewRenderer.ts` — unchanged main-editor boundary; Phase 47's hide/solo Studio reflection is a Studio-preview visibility filter, NOT the Phase 48 compositor.

</code_context>

<specifics>
## Specific Ideas

- The user corrected the spec's copy gate: shipped copy is **English** ("Loop shortened by next clip", "next clip — interrupts the loop"). The French labels in the spec (Pitfall m1) are a recorded v0.9 divergence, not shipped copy. This applies to all Phase 47 surfaces.
- The user anchored the capsule design to the **existing Phase 43 rail** — evolve, never replace; the locked rail semantics (selection, drag, spacing, playback) are untouchable.
- The user wants the header column **fixed-width (~140px, resizable)** so the frame area never depends on name length; the Background row label "Bg" was chosen specifically to fit without truncation.
- Cross-track drag is **plain drag, no modifier** — the destination row highlight + live insertion preview make the crossing explicit; rejections reuse the paste rejection capsule.

</specifics>

<deferred>
## Deferred Ideas

- Background clip import, repeat-count, and fallback-config UI — **Phase 49** (BKG); Phase 47 only renders the Bg row and clips when present.
- Internal opacity/blend application in the flattened composite — **Phase 48** (CMP-03); Phase 47 only reflects hide/solo in the Studio preview.
- Photo/reference and audio-preview row surfaces — **Phases 50/51**; the row model anticipates them but renders no placeholders in Phase 47.

</deferred>

---

*Phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control*
*Context gathered: 2026-08-24*
