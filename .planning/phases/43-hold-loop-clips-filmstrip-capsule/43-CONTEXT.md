# Phase 43: Hold Loop Clips + Integrated Loop Rail - Context

**Gathered:** 2026-08-07
**Status:** Approved; closure authority reconciled 2026-08-08

<domain>
## Phase Boundary

Phase 43 retains deterministic static/hold rendering and canonical linked Loop Clips, but the rejected separate Loop Clips lane is replaced before implementation continues. Physics Paint Studio Loop Rail and Scripts inspector remain the exclusive interactive authoring owners for Loop Clips.

The Motion Editor main timeline may receive only minimal passive marker data `{startFrame, frameCount, mode}` and paint one compact Repeat-duration marker per canonical Loop Clip effective interval inside the existing PPaint FX bar. Progressive is 3px `#8B5CF6`, Static/Hold is 3px cyan `#06B6D4`, and actual start/end positions receive white cuts. The main timeline receives no `loopId`, source keys, repeat metadata, status, selection state, callbacks, or commands and owns no Loop Clip-specific selection, focus, hover, tooltip, Edit, drag, context menu, keyboard route, navigation, or mutation. Generic FX-track behavior may continue beneath the paint.

Inside EFX Paint/Roto, Loop Clips are represented by an integrated Loop Rail in the top edge of the existing physical-frame row. The correction adds no timeline row and no track height. It also makes the existing right-sidebar Scripts context the persistent inspector for the selected Loop Clip.

This is a bounded presentation and interaction correction, not a rewrite of the Loop Clip persistence model. HOLD-01..05 behavior, persistence, boundary algebra, atomic history, unresolved-source policy, preview/export parity, source-cycle sharing, and generic accepted physical-edit bridges remain authoritative, with two explicit current corrections: validated exact source positions may act as session-only Key Spacing proxies and retime the authoritative real source-key `appFrame` positions for every loop sharing the same ordered source cycle; and every Progressive or Static/Hold Apply creates a Loop Clip even at finite Repeat 1. HOLD-06's information contract is redistributed across the rail tooltip and contextual sidebar; its earlier persistent full-filmstrip capsule, repetition band, permanent Cycle badge, and proposed dedicated local-actions popover are superseded.

Requirements: HOLD-01..06 in `.planning/REQUIREMENTS.md`. The integrated-rail decisions below supersede the earlier Phase 43 dedicated-lane correction, the current `43-UI-SPEC.md`, Plans 43-11..14, `43-VALIDATION.md`, and the failed Step 1 wording in `43-UAT.md`. `.planning` remains the sole planning authority for Phase 43; SPECS is not active unless the user explicitly re-enables it.

</domain>

<decisions>
## Implementation Decisions

### Product ownership and rail geometry

- **D-33R (amended by D-53):** The Motion Editor main timeline may project only `{startFrame, frameCount, mode}` for each canonical Loop Clip effective interval and paint one passive 3px mode-colored strip with canonical white endpoint cuts inside the existing PPaint FX bar. It adds no row or height and has no text, badge, tooltip, hover/focus styling, own pointer target, identity, source/repeat metadata, status, selection, callback, command, or Loop Clip-specific interaction. Generic FX-track behavior may continue beneath the paint. This supersedes D-33's zero-visibility wording without restoring a second authoring surface. — **Reversibility:** moderate — the passive visibility can be removed without changing canonical Loop Clip authority, while adding identity or interaction would violate the ownership boundary.
- **D-34R:** Replace the rejected separate Loop Clips lane with an integrated Loop Rail inside the top edge of each existing EFX Paint/Roto physical-frame row. The visible rail is exactly 3px high and adds zero row or track height. It must not move, cover, or clip the physical cells or their action toolbar. This supersedes the earlier dedicated-lane D-34.
- **D-35R:** The rail has a transparent 10–12px interaction target while only 3px remains visible. It is hidden when the track has no Loop Clips, so no-loop geometry stays byte-for-byte equivalent at the layout-contract level. This supersedes the earlier 32px conditional lane.
- **D-36R:** The persistent timeline presentation is a compact rail, not a full filmstrip capsule. Remove the separate lane, source-thumbnail filmstrip, linked-repetition band, permanent Cycle badge, and raw UUID display. Preserve existing blue linked-frame indicators inside physical cells. Use the existing canonical Requested/Effective derivation; do not introduce new boundary logic.
- **D-37R:** Rail states are: normal Loop Clip accent; stronger accessible selected/focused highlight; amber end treatment when truncated; red treatment when unresolved; and a compact visible, selectable marker when Effective is `0f`. Status must never disappear silently.

### Rail information and interactions

- **D-38R:** Hovering the rail shows a tooltip above it containing the Loop Clip display name, `Cycle Nf × R = Tf` or `Cycle Nf × ∞`, Effective duration, and normal/truncated/unresolved status. Truncation keeps the approved English meaning `Loop shortened by next clip`; `clip bloquant` remains prohibited in every language.
- **D-39R (superseded in part by D-59):** Single click selects only the Loop Clip, updates the contextual Scripts inspector, and establishes its complete source cycle as the session-only rail Key Spacing scope. It must not navigate, select, multi-select, or alter a physical frame. The proposed dedicated local-actions popover is not part of the approved surface.
- **D-40R:** Double-clicking the rail, or pressing Enter while the rail is keyboard-focused, opens the existing Studio-local `Edit Loop Clip` modal with current values through `openLoopEdit(loopId)`. No parent-to-child Loop Clip open request is used.
- **D-41:** Reserve pointer geometry compatible with a future horizontal drag-and-drop placement feature, but do not implement Loop Clip dragging in this correction without separate user approval.
- **D-42:** Physical-cell navigation, real-key selection, multi-select, and drag behavior below the rail remain unchanged. The rail's event target must be structurally isolated from physical-cell handlers, and the accepted blue linked-frame indicators remain intact.

### Contextual right sidebar

- **D-43:** The existing right-sidebar Scripts context becomes the persistent inspector for the current selection; do not add a separate Loop Clip inspector pane. When a normal script is selected, keep the existing Play action. When a Loop Clip is selected, replace that same primary action slot with a Lucide Pencil/Edit button that opens the existing `Edit Loop Clip` modal.
- **D-44:** In Loop Clip context, display: Loop Clip display name; source script name; placement/start frame; `Cycle Nf × R = Tf` or infinity form; Effective duration; Progressive or Static / Hold mode; and normal, truncated, or unresolved status.
- **D-45:** Derive the Loop Clip display name from the source script unless an existing loop-specific name is already available. Do not add a new persisted naming field without asking the user first. The displayed script name remains renameable by clicking the name directly; do not add a dedicated pencil button solely for script renaming.

### Carried-forward behavior and authority

- **D-01..D-14 remain locked except for D-57's bounded D-11 selection/ripple supersession and D-56's apply-time creation supersession:** Loop Edit and Source Edit modes, Link/Create, unlink-only deletion, source-cycle sharing, shrink/re-expansion, materialize-on-paint/Clear, Delete-key rejection, loop-loop priority, and atomic Undo/Redo semantics remain unchanged. D-11 still rejects single-key movement, linked drag, ordinary linked-source Force Spacing without current mode-specific authorization, and every other linked structural mutation.
- **Earlier D-15..D-23 presentation details are narrowed:** status, copy, selection/focus accessibility, truncation, unresolved, and zero-effective semantics remain; persistent filmstrip thumbnails, ghost repetitions, a permanent math badge, and the dedicated capsule surface are superseded by D-34R..D-40R. D-23 still says linked occurrences are not ordinary durable keys; D-57 permits equivalent exact source positions to reflect a valid session-only physical or rail selection, while linked generated interiors, linked gaps, and unresolved frames remain navigation-only.
- **D-24..D-32 remain locked:** boundary algebra, dynamic parent end, canonical resolver, preview/export parity, additive persistence, derived Effective duration, verbatim unresolved references, virtual modulo resolution, and no repeated durable/cache assets remain unchanged.
- **D-46:** Loop operations continue through the existing EFX Paint controller, physical-edit coordinator, authority request, atomic commit, and Undo/Redo paths. Generic launch, project context, authority, apply-result, save, and frame-sync bridges remain. Main-timeline-specific Loop Clip request/result protocol is removed only after no callers remain.
- **D-47:** Preserve the lazy performance invariant: compact interval records, visible-window derivation, O(1) modulo frame resolution, no per-repetition raster/cache assets, and no materialized Infinity destination list. The 3px rail derives only visible geometry.

### Planning and verification gate

- **D-48:** Stop implementation after the rejected Plan 43-11 tracer commits (`4bc8f76a`, `1ad75ff8`, `b52028b9`). They are unapproved implementation substrate to replace, not an accepted checkpoint. Before execution resumes, update `43-UI-SPEC.md`, Plans 43-11..14, `43-VALIDATION.md`, and `43-UAT.md` against this context.
- **D-49 (amended by D-57/D-58):** The revised tracer/checkpoint must prove the nine ownership checks plus the recovery matrix in the same build: no extra row/height or clipping; mode-colored integrated rails and canonical cuts; correct tooltip/Edit/sidebar routing; passive non-interactive Motion Editor markers; Repeat-1 creation; rail plain/range/toggle selection; physical/rail mutual exclusion; exact Select All scope; one-cycle-only physical partial spacing; ordered cumulative capsule ripple; unchanged Interpolation behavior; atomic records-plus-Loop-Clips Undo/Redo; and first/follow-up Play Script background parity. No later plan or second checkpoint may reinterpret these rules.
- **D-50 (superseded by D-57):** The initial exact-source proxy exception proved source-key timing and linked-position provenance but was too narrow: it treated multi-capsule selection as a physical-cell workflow, prevented downstream ripple, and assumed Loop Clip placements never followed moved source cycles. D-57 retains its fail-closed provenance and non-materialization guarantees while replacing its selection and movement model.
- **D-51 (superseded by D-56):** The initial correction made Static/Hold finite Repeat 1 create a Loop Clip but incorrectly left Progressive Repeat 1 loop-free.
- **D-56 (supersedes D-09/D-51 apply-time creation thresholds):** Every Play Script Apply expresses Loop Clip intent in both Progressive and Static/Hold modes, including finite Repeat 1. The same atomic generation publication persists one canonical Loop Clip record referencing the committed ordered source key IDs, so the integrated mode-colored Loop Rail appears immediately across the whole source cycle. Repeat 1 materializes no repeated occurrences and stores no duplicate assets; Repeat and Infinity control requested duration, not whether a Loop Clip exists.
- **D-52 (clarifies D-37R/D-38R visual differentiation):** Progressive rails use `#8B5CF6`; Static/Hold rails use cyan `#06B6D4` with `#67E8F9` hover. Selected rails use orange `#F59E0B` regardless of mode. Every actual Loop Clip start/end—not a viewport-clipped edge—paints a white vertical cut on the 3px rail and a matching white left/right border on the boundary frame cells, so adjacent clips read as `|---clip 1---||---clip 2---|`. The rail tooltip and accessible name include `Progressive` or `Static/Hold` mode.
- **D-53 (supersedes D-33R's uniform-color/two-field marker detail only):** The passive Motion Editor marker may receive `mode` alongside `startFrame` and `frameCount`. It paints Progressive purple, Static/Hold cyan, and white cuts only at actual canonical endpoints. `mode` is paint-only; no Loop Clip identity, source/repeat data, status, tooltip, selection, hit target, callback, command, or mutation route enters the main timeline.
- **D-54 (supersedes the blocking Play Script modal shell):** Play Script, Edit Loop Clip, and Edit Source Cycle use one draggable non-modal floating `role="dialog"`. The viewport root has no dimming backdrop and passes pointer input through outside the dialog surface, so the live Studio brush palette remains selectable for Custom color. The surface alone accepts pointer input; Tab is not trapped, while Escape/Enter and Studio-shortcut containment still apply when focus is inside the dialog.
- **D-55 (accepted Play Script current-frame reconciliation):** When an accepted Play Script transaction settles deferred records, the coordinator immediately reconciles `after.currentAppFrame` through the existing reference/canvas reload port. The first generated frame must appear on the Studio canvas without moving the playhead. Rejection/rollback and Undo/Redo retain their existing reconciliation behavior.
- **D-57 (supersedes D-50's selection and movement model):** Loop Rails own multi-capsule Key Spacing. Plain rail click selects exactly one Loop Clip and its complete ordered source cycle while retaining the Scripts inspector target; Shift-click selects the inclusive contiguous Loop Clip range from the stable rail anchor in canonical placement order; Cmd/Ctrl-click toggles non-contiguous Loop Clips. Selected clips derive complete source cycles from current records at Apply time, identical cycles deduplicate, and stale, reordered, duplicate-covered, missing, or ambiguous authorization rejects before coordinator execution. Physical real-key selection remains available for ordinary operations and partial Key Spacing inside at most one current source cycle; a physical selection spanning multiple linked cycles rejects with guidance to select Loop Rails. Rail and physical selection are synchronously mutually exclusive, and Select All clears rail/proxy state so its visible physical keys are the exact operation scope. For accepted spacing, process selected cycle groups left-to-right: each group's first selected key is anchored at its original frame plus prior cumulative growth, internal destinations use the requested spacing, and every later real key ripples by the group's signed growth. A Loop Clip whose pre-edit `placementStart` equals its first source key's pre-edit frame follows that key; duplicated placements remain fixed. Loop IDs, ordered source IDs, mode, repeat, Infinity, script provenance, motion, and override color remain byte-identical. Interpolation is passed through unchanged—Off leaves empty gaps, On derives generated interiors—and the complete records-plus-Loop-Clips result is staged, accepted, rolled back, and recorded as one history command. No linked occurrence or selection/provenance state is persisted or materialized.
- **D-58 (Play Script background transaction):** Every `play-script` physical publication carries a valid snapshot of the current `buildRotoBackgroundMetadata(settings)` value. The first accepted Play Script on a fresh layer creates the canonical physical document with that background in the same `replaceRotoPhysicalDocument` transaction; later Play Scripts replace stale parent metadata with the current snapshot. Ordinary physical edit kinds reject `rotoBackground`. No separate optimistic background mutation, repeated destination materialization, project-data repair, or schema migration is added; main Studio, preview, export, and save/reopen consume the accepted document background.
- **D-59 (supersedes the dedicated-popover portions of D-39R, D-46, and the initial 43-12 contract):** The final user-approved Loop Clip authoring surface is the integrated rail, its styled tooltip, the contextual Scripts sidebar, and the existing Studio-local Edit Loop Clip floating dialog. Plain/range/toggle rail gestures update selection and sidebar context only; focused Enter, rail double-click, and sidebar Edit converge on `openLoopEdit(loopId)` exactly once. No `PhysicsPaintLoopClipPopover`, anchored actions dialog, popover focus lifecycle, or rail-triggered Duplicate/Repair/Relink/Unlink/Delete controls are introduced. Those controller capabilities remain canonical internal operations and regression-protected authority, but exposing them through a new surface is deferred beyond Phase 43. No specialized cross-window protocol is retained to compensate for the removed popover.

### Claude's Discretion

- Exact DOM/component split for the 3px rail, provided it is a focused EFX Paint module and not more logic added directly to `PhysicsPaintStudio.tsx`.
- Exact styled-tooltip primitive, provided placement is above the rail and the interaction/accessibility contract is met; no dedicated actions popover is added.
- Exact selected/focus accent values and zero-effective marker shape within the revised UI-SPEC tokens.
- Exact non-persisted display-name derivation helper and fallback copy, excluding raw UUID as product text.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements, roadmap, and failed acceptance
- `.planning/REQUIREMENTS.md` — HOLD-01..06; D-34R..D-59 are the latest interpretation of timing, presentation, Loop Clip creation, rail-owned spacing, atomic ripple, Play Script background acceptance, and the final no-popover surface boundary.
- `.planning/ROADMAP.md` §“Phase 43” — final integrated-rail, contextual-sidebar, passive-marker, and cleanup plan map.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UAT.md` — approved native acceptance record reconciled to the final rail/sidebar/Edit surface.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-VALIDATION.md` — final automated/native coverage map.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UI-SPEC.md` — final visual and interaction contract.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-11-PLAN.md` through `43-15-PLAN.md` — executed correction and structural cleanup plans.

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
- Existing controller operations and accepted acknowledgements already implement Duplicate, Unlink/Delete semantics, Repair, and Relink. They remain internal canonical authority; the approved rail/sidebar/Edit surface does not add a second mutation path or expose a dedicated actions popover.

### Established Patterns
- Preact Signals carry shared Studio/session selection state; avoid hook/effect mirroring and prop-drilling sprawl.
- Physical-frame edits are parent-authoritative and visible only after exact accepted acknowledgement. Rejections preserve selection and controls for correction.
- The right sidebar uses resizable sections and a default-open Scripts tab; contextual content should preserve its approved scroll/resizer behavior.
- Native visual UAT is the final oracle. Automated tests must pin geometry, event isolation, copy, and action routing, but execution remains blocked until the user approves the live tracer.

### Integration Points
- Replace `PhysicsPaintLoopClipLane` and its extra-row mount in `PhysicsPaintWorkflowStrip` with a focused integrated rail component/presentation helper attached to the existing physical-row wrapper.
- Feed selected Loop Clip identity and derived inspector data through `usePhysicsPaintStudioViewModel`/Studio signals into both the rail and `PhysicsPaintScriptsPanel` context.
- Keep the rail tooltip, contextual Scripts sidebar, and Edit modal inside EFX Paint. Do not mount a dedicated actions popover. Remove the specialized main-timeline Loop Clip request protocol after main-timeline callers and tests are gone.
- Project only `{startFrame, frameCount, mode}` into the Motion Editor and paint passive purple/cyan 3px strips with canonical white endpoint cuts through the pure Canvas helper inside the existing PPaint FX bar; never expose identity or attach Loop Clip-specific input routes.
- Preserve existing blue linked-frame indicators and all physical-cell pointer/keyboard/drag routes below the rail.

</code_context>

<specifics>
## Specific Ideas

- Visible rail height: exactly 3px; transparent interaction target: 10–12px; zero added track height.
- Tooltip above the rail: display name, `Cycle Nf × R = Tf` or infinity, Effective duration, and status.
- Plain rail click selects one Loop Clip and its complete source cycle; Shift selects a contiguous rail range; Cmd/Ctrl toggles non-contiguous rails; double-click or Enter edits the primary selected clip.
- Rail selection and physical-key selection are mutually exclusive. Rail mode paints only the selected 3px line while its complete source cycle remains the invisible Apply-time Key Spacing scope. Physical keys retain ordinary selection and visibly marked partial same-cycle Key Spacing; cross-cycle physical spacing directs the user to Loop Rails. Equivalent linked positions mirror selection only for explicit physical proxy selection, while generated interiors, gaps, and unresolved frames remain navigation-only.
- Force Spacing never drags or materializes a linked occurrence. It processes authorized cycle groups left-to-right, ripples later real keys cumulatively, moves only source-attached Loop Clip placements, preserves Interpolation Off/On unchanged, and publishes records plus Loop Clips as one atomic history command.
- The Play Script publication snapshots the current active Paint background and installs it with the accepted physical document, including fresh-layer first use.
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
