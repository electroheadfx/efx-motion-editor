# Phase 43: Hold Loop Clips + Integrated Loop Rail - Context

**Gathered:** 2026-08-07
**Status:** Ready for UI contract and correction replanning

<domain>
## Phase Boundary

Phase 43 retains deterministic static/hold rendering and canonical linked Loop Clips, but the rejected separate Loop Clips lane is replaced before implementation continues. Physics Paint Studio Loop Rail and Scripts inspector remain the exclusive interactive authoring owners for Loop Clips.

The Motion Editor main timeline may receive only minimal interval data `{startFrame, frameCount}` and paint one compact passive Repeat-duration marker per canonical Loop Clip effective interval inside the existing PPaint FX bar. The marker is a 3px `#8B5CF6` strip with no new row or height, text, badge, capsule, tooltip, hover/focus styling, or own pointer target. The main timeline receives no `loopId`, source keys, repeat metadata, status, selection state, callbacks, or commands and owns no Loop Clip-specific selection, focus, hover, Edit, drag, context menu, keyboard route, navigation, or mutation. Generic FX-track behavior may continue beneath the paint.

Inside EFX Paint/Roto, Loop Clips are represented by an integrated Loop Rail in the top edge of the existing physical-frame row. The correction adds no timeline row and no track height. It also makes the existing right-sidebar Scripts context the persistent inspector for the selected Loop Clip.

This is a bounded presentation and interaction correction, not a rewrite of the Loop Clip model. HOLD-01..05 behavior, persistence, resolver algebra, atomic history, guards, unresolved-source policy, preview/export parity, source-cycle sharing, and generic accepted physical-edit bridges remain authoritative. HOLD-06's information contract is redistributed across the rail tooltip and contextual sidebar; its earlier persistent full-filmstrip capsule, repetition band, and permanent Cycle badge presentation is superseded.

Requirements: HOLD-01..06 in `.planning/REQUIREMENTS.md`. The integrated-rail decisions below supersede the earlier Phase 43 dedicated-lane correction, the current `43-UI-SPEC.md`, Plans 43-11..14, `43-VALIDATION.md`, and the failed Step 1 wording in `43-UAT.md`. `.planning` remains the sole planning authority for Phase 43; SPECS is not active unless the user explicitly re-enables it.

</domain>

<decisions>
## Implementation Decisions

### Product ownership and rail geometry

- **D-33R:** The Motion Editor main timeline may project only `{startFrame, frameCount}` for each canonical Loop Clip effective interval and paint one passive 3px `#8B5CF6` strip inside the existing PPaint FX bar. It adds no row or height and has no text, badge, capsule, tooltip, hover/focus styling, own pointer target, identity, metadata, status, selection, callback, command, or Loop Clip-specific interaction. Generic FX-track behavior may continue beneath the paint. This supersedes D-33's zero-visibility wording without restoring a second authoring surface. — **Reversibility:** moderate — the passive visibility can be removed without changing canonical Loop Clip authority, while adding identity or interaction would violate the ownership boundary.
- **D-34R:** Replace the rejected separate Loop Clips lane with an integrated Loop Rail inside the top edge of each existing EFX Paint/Roto physical-frame row. The visible rail is exactly 3px high and adds zero row or track height. It must not move, cover, or clip the physical cells or their action toolbar. This supersedes the earlier dedicated-lane D-34.
- **D-35R:** The rail has a transparent 10–12px interaction target while only 3px remains visible. It is hidden when the track has no Loop Clips, so no-loop geometry stays byte-for-byte equivalent at the layout-contract level. This supersedes the earlier 32px conditional lane.
- **D-36R:** The persistent timeline presentation is a compact rail, not a full filmstrip capsule. Remove the separate lane, source-thumbnail filmstrip, linked-repetition band, permanent Cycle badge, and raw UUID display. Preserve existing blue linked-frame indicators inside physical cells. Use the existing canonical Requested/Effective derivation; do not introduce new boundary logic.
- **D-37R:** Rail states are: normal Loop Clip accent; stronger accessible selected/focused highlight; amber end treatment when truncated; red treatment when unresolved; and a compact visible, selectable marker when Effective is `0f`. Status must never disappear silently.

### Rail information and interactions

- **D-38R:** Hovering the rail shows a tooltip above it containing the Loop Clip display name, `Cycle Nf × R = Tf` or `Cycle Nf × ∞`, Effective duration, and normal/truncated/unresolved status. Truncation keeps the approved English meaning `Loop shortened by next clip`; `clip bloquant` remains prohibited in every language.
- **D-39R:** Single click selects only the Loop Clip and may open the existing local actions popover. It must not navigate, select, multi-select, or alter a physical frame. The local popover retains `Duplicate`, `Unlink`, `Delete`, `Repair`, and `Relink` as applicable, with the existing fail-closed guards and accepted-only completion behavior.
- **D-40R:** Double-clicking the rail, or pressing Enter while the rail is keyboard-focused, opens the existing Studio-local `Edit Loop Clip` modal with current values through `openLoopEdit(loopId)`. No parent-to-child Loop Clip open request is used.
- **D-41:** Reserve pointer geometry compatible with a future horizontal drag-and-drop placement feature, but do not implement Loop Clip dragging in this correction without separate user approval.
- **D-42:** Physical-cell navigation, real-key selection, multi-select, and drag behavior below the rail remain unchanged. The rail's event target must be structurally isolated from physical-cell handlers, and the accepted blue linked-frame indicators remain intact.

### Contextual right sidebar

- **D-43:** The existing right-sidebar Scripts context becomes the persistent inspector for the current selection; do not add a separate Loop Clip inspector pane. When a normal script is selected, keep the existing Play action. When a Loop Clip is selected, replace that same primary action slot with a Lucide Pencil/Edit button that opens the existing `Edit Loop Clip` modal.
- **D-44:** In Loop Clip context, display: Loop Clip display name; source script name; placement/start frame; `Cycle Nf × R = Tf` or infinity form; Effective duration; Progressive or Static / Hold mode; and normal, truncated, or unresolved status.
- **D-45:** Derive the Loop Clip display name from the source script unless an existing loop-specific name is already available. Do not add a new persisted naming field without asking the user first. The displayed script name remains renameable by clicking the name directly; do not add a dedicated pencil button solely for script renaming.

### Carried-forward behavior and authority

- **D-01..D-14 remain locked:** Loop Edit and Source Edit modes, Link/Create, unlink-only deletion, source-cycle sharing, rigid linked source keys, shrink/re-expansion, materialize-on-paint/Clear, Delete-key rejection, loop-loop priority, and atomic Undo/Redo semantics remain unchanged.
- **Earlier D-15..D-23 presentation details are narrowed:** status, copy, selection/focus accessibility, truncation, unresolved, and zero-effective semantics remain; persistent filmstrip thumbnails, ghost repetitions, a permanent math badge, and the dedicated capsule surface are superseded by D-34R..D-40R.
- **D-24..D-32 remain locked:** boundary algebra, dynamic parent end, canonical resolver, preview/export parity, additive persistence, derived Effective duration, verbatim unresolved references, virtual modulo resolution, and no repeated durable/cache assets remain unchanged.
- **D-46:** Loop operations continue through the existing EFX Paint controller, physical-edit coordinator, authority request, atomic commit, and Undo/Redo paths. Generic launch, project context, authority, apply-result, save, and frame-sync bridges remain. Main-timeline-specific Loop Clip request/result protocol is removed only after no callers remain.
- **D-47:** Preserve the lazy performance invariant: compact interval records, visible-window derivation, O(1) modulo frame resolution, no per-repetition raster/cache assets, and no materialized Infinity destination list. The 3px rail derives only visible geometry.

### Planning and verification gate

- **D-48:** Stop implementation after the rejected Plan 43-11 tracer commits (`4bc8f76a`, `1ad75ff8`, `b52028b9`). They are unapproved implementation substrate to replace, not an accepted checkpoint. Before execution resumes, update `43-UI-SPEC.md`, Plans 43-11..14, `43-VALIDATION.md`, and `43-UAT.md` against this context.
- **D-49:** The revised tracer must prove all nine user-visible checks before expansion: no extra row/height change; no cell or toolbar clipping; conditional 3px rail; correct hover tooltip; loop-only single-click selection; double-click and Enter opening Edit Loop Clip; contextual sidebar Play→Edit swap plus loop details; blue linked indicators preserved; and the Motion Editor PPaint FX bar showing only the passive 3px `#8B5CF6` effective-interval marker with no Loop Clip-specific interaction.

### Claude's Discretion

- Exact DOM/component split for the 3px rail, provided it is a focused EFX Paint module and not more logic added directly to `PhysicsPaintStudio.tsx`.
- Exact tooltip and local-popover primitives, provided tooltip placement is above the rail and the interaction/accessibility contract is met.
- Exact selected/focus accent values and zero-effective marker shape within the revised UI-SPEC tokens.
- Exact non-persisted display-name derivation helper and fallback copy, excluding raw UUID as product text.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements, roadmap, and failed acceptance
- `.planning/REQUIREMENTS.md` — HOLD-01..06; D-34R..D-49 are the latest interpretation of HOLD-06's presentation and acceptance surface.
- `.planning/ROADMAP.md` §“Phase 43” — phase goal and linked-loop success criteria; persistent full-filmstrip wording must be reconciled during correction replanning.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UAT.md` — failed native acceptance artifact to rewrite around the integrated rail and contextual sidebar.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-VALIDATION.md` — validation mapping to revise before execution resumes.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UI-SPEC.md` — stale dedicated-lane contract; must be replaced, not patched incrementally.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-11-PLAN.md` through `43-14-PLAN.md` — stale correction plans to rewrite against D-34R..D-49.

### Prior locked behavior
- `.planning/phases/42-playscript-application-modes-color-override/42-CONTEXT.md` — approved Play Script dialog shell, cycle-only generation, requested/effective conventions, and static/hold behavior reused by Loop Edit and Source Edit.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-MEMORY-RECALL.md` — accepted-only transaction pattern, fixed physical-strip constraint, and specialized main-timeline bridge gotchas.

### Correct EFX Paint seams
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — target host: existing frame grid, horizontal window, physical-cell handlers, linked indicators, and current rejected lane insertion point.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — persistent right-sidebar shell and Scripts tab host.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — existing Play action, script selection/name surface, and contextual action slot to reuse.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — local `openLoopEdit`, Duplicate, Unlink, Repair, Relink, guards, authority, and atomic operations.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — existing Studio-local Edit Loop Clip modal.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — selection/controller wiring; keep new presentation logic out of this already-large component where possible.
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts` — focused signal/view-model seam for selected Loop Clip and inspector projection.
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` — existing physical-cell presentation and tooltip-copy pattern.
- `app/src/components/physic-paint/physicsPaintStudio.css` — current strip/right-panel tokens and the rejected lane styles to replace.

### Surface-independent authority
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — persisted Loop Clip record and physical-frame document authority.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — compact ranges, lazy frame resolution, boundary algebra, and validation.
- `app/src/stores/physicPaintStore.ts` — structural resolution, render-source parity, unresolved-loop query, and source-scoped cache identity.
- `app/src/lib/previewRenderer.ts` and `app/src/lib/exportEngine.ts` — marked preview placeholder and fail-fast export policy, retained unchanged except for correction regressions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PhysicsPaintWorkflowStrip.tsx` already owns the visible frame window, 48px cell pitch, ruler alignment, physical-cell event handlers, and linked-frame presentation. The rail can consume the existing `rotoLoopResolutionContext.ranges` without materializing repeated frames.
- `RotoTimelineCellButtonImpl` already uses the project's styled-tooltip pattern around physical-cell anchors. Reuse the local tooltip conventions while keeping the rail target outside the cell button's navigation/drag path.
- `PhysicsPaintRightPanel.tsx` already hosts the default-open Scripts tab and delegates its content through `PhysicsPaintScriptsPanelProps`; selection-aware inspector data belongs in this existing path rather than a new pane.
- `physicsPaintRotoPlayScriptController.openLoopEdit(loopId)` already stops playback, requests authority, prefills current loop values, and opens the existing confirmation modal. Rail double-click, Enter, and sidebar Edit should converge on this one action.
- Existing controller operations and accepted acknowledgements already implement Duplicate, Unlink/Delete semantics, Repair, and Relink; the rail/popover must not create a second mutation path.

### Established Patterns
- Preact Signals carry shared Studio/session selection state; avoid hook/effect mirroring and prop-drilling sprawl.
- Physical-frame edits are parent-authoritative and visible only after exact accepted acknowledgement. Rejections preserve selection and controls for correction.
- The right sidebar uses resizable sections and a default-open Scripts tab; contextual content should preserve its approved scroll/resizer behavior.
- Native visual UAT is the final oracle. Automated tests must pin geometry, event isolation, copy, and action routing, but execution remains blocked until the user approves the live tracer.

### Integration Points
- Replace `PhysicsPaintLoopClipLane` and its extra-row mount in `PhysicsPaintWorkflowStrip` with a focused integrated rail component/presentation helper attached to the existing physical-row wrapper.
- Feed selected Loop Clip identity and derived inspector data through `usePhysicsPaintStudioViewModel`/Studio signals into both the rail and `PhysicsPaintScriptsPanel` context.
- Keep the local actions popover and Edit modal inside EFX Paint. Remove the specialized main-timeline Loop Clip request protocol after main-timeline callers and tests are gone.
- Project only `{startFrame, frameCount}` into the Motion Editor and paint the passive 3px `#8B5CF6` strip with a pure Canvas helper inside the existing PPaint FX bar; never expose identity or attach Loop Clip-specific input routes.
- Preserve existing blue linked-frame indicators and all physical-cell pointer/keyboard/drag routes below the rail.

</code_context>

<specifics>
## Specific Ideas

- Visible rail height: exactly 3px; transparent interaction target: 10–12px; zero added track height.
- Tooltip above the rail: display name, `Cycle Nf × R = Tf` or infinity, Effective duration, and status.
- Single click selects the Loop Clip only; double-click or Enter edits it.
- Sidebar primary action slot: normal script = existing Play; selected Loop Clip = Lucide Pencil/Edit.
- Sidebar loop facts: display name, source script, start frame, Cycle math, Effective, mode, status.
- No new persisted loop naming field without explicit approval; never expose raw UUID as product copy.
- The rejected full lane/capsule and permanent badge must be removed rather than visually refined.

</specifics>

<deferred>
## Deferred Ideas

- Horizontal Loop Clip drag-and-drop placement — reserve compatible pointer geometry now, but implementation requires separate user approval.

</deferred>

---

*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Context gathered: 2026-08-07*
