# Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 36 rebuilds the Physics Paint standalone/window UI into the redesigned production UI while wiring it to the behavior that already exists: engine controls, Save/Load editable state JSON, preview Play, Save roto frame, Save play, rendered frame output, and bridge/apply behavior. The phase must make the UI usable and visually consistent with EFX Motion while proving standalone output can be inspected for future cached compositing.

This phase does not implement the full Phase 38 source-lane model. In Phase 36, Roto canvas and Play canvas are exclusive workflows. Hybrid mixing of script-play output plus roto corrections, advanced source-lane persistence, auto-publish policy, overlap/conflict handling, and arbitrary stacked roto lanes are deferred.

</domain>

<decisions>
## Implementation Decisions

### UI Rebuild and Visual Cutline
- **D-01:** Phase 36 must replace the old toolbar structure with the redesigned layout: top bar, left sidebar tools, main paint canvas, right sidebar color/options, and bottom physics-paint timeline/workflow strip.
- **D-02:** Use the existing EFX Motion app UI language/components/buttons as the visual base. Use the Pencil design for placement/layout, not for inventing unrelated styles.
- **D-03:** Use the SVG assets provided in `SPECS/physics-paint-ui/icons/` for the left-sidebar tools.
- **D-04:** Every existing engine/apply/save/load control must remain functional in its new location. Genuinely new affordances may be disabled or deferred if they would require large new systems.
- **D-05:** Remove the large bottom diagnostics/log grid. It previously showed Layer, Start frame, Canvas size, Engine ready, Canvas mounted, Active tool, Color, Brush size, Opacity, Physics mode, Bridge transport mode, and Last error. Keep only compact user-facing status/errors/logs in the top bar.
- **D-06:** `Grain` is renamed to `Grain strength` and must keep four choices: `None`, `Soft`, `Med`, `Hard`.
- **D-07:** Remove custom FPS from the UI. Play canvas preview uses the current project FPS.
- **D-08:** The right-sidebar mini blend/color area is for lightweight color blending and brush-color selection. Do not add a second full `EfxPaintEngine`/canvas for this in Phase 36 if that is heavy; prefer a lightweight local preview and reuse existing EFX Motion color picker/palette code where practical.
- **D-09:** The new spreadsheet/timeline is physics-paint-specific and should not be copied from the main EFX Motion timeline, though it should share app visual style.
- **D-10:** `Save roto frame` and `Save play` must use the same button style family as EFX Motion UI, not mismatched colors.
- **D-11:** `Roto canvas` and `Play canvas` are workflow tabs/segments in the same bottom strip. They are both visible, but the active workflow controls the editable mode and primary actions.

### Save and Output Behavior
- **D-12:** Phase 36 keeps manual explicit save/publish. `Save roto frame` manually publishes the current roto frame. `Save play` manually publishes the generated play range. Auto-save/auto-publish is deferred to Phase 38.
- **D-13:** `Save roto frame` defaults to save-and-next: it saves/publishes the current roto frame and advances to the next synced frame.
- **D-14:** `Play` is preview only. It must not finalize EFX cache/source output until the user clicks `Save play`.
- **D-15:** When `Save play` succeeds, keep the Physics Paint UI/window open, show a publication summary, and let the user continue painting/adjusting. Do not automatically close the standalone window.
- **D-16:** Normal artist workflow is `Save roto frame` and `Save play`. Debug output export is not the final artist workflow.
- **D-17:** Phase 36 must provide both an inspectable UI summary and dev/debug export proof for generated output. The normal UI should show summaries such as generated frame count, start frame, canvas size, success, and errors.
- **D-18:** Exporting generated PNGs plus `manifest.json` is a dev/debug inspection artifact only. It must only appear for users in dev mode / development environment, not in the final app.
- **D-19:** The dev/debug PNG+manifest export lives in the top bar status area, collapsed by default.

### Source Modes and Timeline Lanes
- **D-20:** The timeline must show two visible rows: `Roto frames` as per-frame cells, and `Play canvas` / script play as a start square plus range bar.
- **D-21:** Phase 36 uses two exclusive source modes: Roto frame-by-frame mode and Play canvas mode. It does not mix script-play output with roto corrections on the same final output.
- **D-22:** The inactive lane remains visible for context but is subdued/disabled and not editable until its workflow tab is active.
- **D-23:** The Play canvas range should show a current-position/interpolation marker, for example `[0]----•---[50]`, where `•` represents the current frame/state inside the play range.
- **D-24:** Clicking inside a Play canvas range moves the current frame/marker for inspection/preview. It must not convert modes or destroy source data.
- **D-25:** Conversion between Play and Roto is explicit through the workflow tabs, never by casual lane clicks. Any destructive conversion requires confirmation.
- **D-26:** Physics Paint frame navigation must stay synced with EFX Motion current frame. Previous/next frame controls move both the EFX Motion current frame and the EFX Physics Paint frame together.
- **D-27:** Roto previous/next buttons move to the previous/next immediate frame. `Shift+←` / `Shift+→` can navigate previous/next saved roto frame if implemented.
- **D-28:** The Play canvas frame-count field defines the range length. It should also drive a ghost/preview range before `Save play` when feasible.

### Onion Skin and Preview
- **D-29:** Roto canvas has onion-skin controls with a global on/off plus previous and next toggles/checkboxes.
- **D-30:** Onion skin can show previous frames, next frames, or both. Default count is `1`; planner may cap at `3` unless implementation finds a better small bound.
- **D-31:** Onion skin should preview available Play canvas frames too, when applicable and not during live Play preview.
- **D-32:** Live Play canvas preview temporarily disables onion skin to avoid confusing overlays during playback.
- **D-33:** Suggested onion rendering: previous frames in light cyan/blue, next frames in light orange/yellow, with opacity decreasing by distance. Onion frames are preview-only and not editable.

### Clear, Replace, and Destructive Conversion Rules
- **D-34:** `Clear frame` clears only the active workflow source. In Roto mode, it clears the current roto frame/source. In Play mode, it clears the play range/source.
- **D-35:** Clearing a Roto frame does not require a modal warning. Clearing a Play canvas range requires a confirmation dialog because it modifies/deletes the range/source.
- **D-36:** Saving over existing output in the same mode replaces that same-mode output with clear feedback. Do not build advanced conflict handling in Phase 36.
- **D-37:** Play→Roto conversion converts the whole rendered Play range into roto frame-by-frame images, then loses/deletes the editable Play script source. This requires confirmation.
- **D-38:** Roto→Play conversion replaces roto frames starting at the current frame for the current `Play canvas` frameCount range, then loses those roto images in that range. This requires confirmation and should state the affected frame span/count.
- **D-39:** If Play rendered frames needed for Play→Roto conversion are missing, require the user to save/regenerate Play output first rather than fabricating incomplete roto frames.

### Shortcuts
- **D-40:** Physics Paint shortcuts are contextual to the Physics Paint window/surface only and must not conflict with the main editor when focus is outside Physics Paint or inside an input.
- **D-41:** Accepted general shortcuts: `Cmd+Z` undo, `Cmd+Shift+Z` redo, `Esc` stop preview / close dialog / cancel active interaction, `Cmd+S` save the active workflow (`Save roto frame` in Roto mode, `Save play` in Play mode), and `?` show shortcuts/help.
- **D-42:** Accepted Roto mode shortcuts: `←` / `→` previous/next synced frame, `Shift+←` / `Shift+→` previous/next saved roto frame if implemented, `G` focus/go-to-frame, `O` onion on/off, `[` / `]` onion count down/up, `Cmd+Enter` save roto frame and go next, `Delete` clear current roto frame/source with the active-mode warning rules.
- **D-43:** Accepted Play mode shortcuts: `Space` play/stop preview, `Enter` play/stop preview when not inside an input, `Cmd+S` save play, `Esc` stop preview before falling back to cancel/close behavior.

### Claude's Discretion
Planner/researcher may choose the safest technical implementation for lightweight color blending, dev-mode detection, exact unsaved-change guard placement, and exact visual styling details, but must preserve the user-facing decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase scope
- `.planning/ROADMAP.md` — Phase 36 goal/success criteria and Phase 37/38 boundaries.
- `.planning/REQUIREMENTS.md` — SAVE-01, SAVE-02, OUT-01, OUT-02 are Phase 36 requirements; future integration and source-lane work is later scope.
- `.planning/PROJECT.md` — v0.8.0 standalone physics paint context and non-replacement boundary.
- `.planning/STATE.md` — Current workflow state and note that Phase 36 includes heavy physics paint UI rebuild scope.

### Prior phase context
- `.planning/phases/35-interactive-physics-paint-controls/35-CONTEXT.md` — Existing app-to-standalone workflow, apply canvas/apply play canvas, rendered-output-only bridge, and editable state import/export distinctions.
- `.planning/phases/34-standalone-demo-shell/34-CONTEXT.md` — Package-local standalone demo boundaries and public API preference.

### User-supplied Phase 36 specs
- `SPECS/physics-paint-ui/ui-connection-phase-36.md` — Old UI to new UI mapping, existing implementation anchors, tool order, icons, confirmed timeline control meanings, feasible Phase 36 boundary.
- `SPECS/physics-paint-ui/ui-feature-phase-36-and-more.md` — Roto frame vs script play concepts, source lanes, save/preview behavior, clear-frame behavior, Phase 36 vs Phase 38 split.
- `SPECS/physics-paint-ui/physics-paint.pen` — Pencil design source for placement/layout. Use Pencil MCP tools to inspect this file; do not read it directly as text.
- `SPECS/physics-paint-ui/icons/` — Provided SVG assets for left-sidebar physics paint tools.
- `SPECS/physics-paint-ui/physics-paint-ui-after.png` — Redesigned UI screenshot referenced by the spec.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — Owns launch context, Tauri/browser bridge detection, play preview, current apply canvas behavior, apply play canvas behavior, readiness/errors, and apply payloads that already include `editableState: engine.save()`.
- `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` — Owns existing tool, brush, background, paper grain, grain strength, physics, animation, save/load state, undo, and clear controls that need to be moved into the redesigned UI.
- `app/src/types/physicPaint.ts` — Defines launch/apply payload contracts, rendered frame shape, frame count clamp, editable state validation, and rendered PNG data URL validation.
- `app/src/stores/physicPaintStore.ts` — Stores rendered frames and editable state per physic-paint layer; applies current-frame and sequence payloads; exposes `physicPaintVersion` for explicit visual invalidation.
- `app/src/lib/physicPaintBridge.ts` — Opens the Physics Paint window, creates launch context with existing editable state, validates/apply payloads, and returns apply results.
- `app/src/components/sidebar/PhysicPaintProperties.tsx` — Existing editor-side entry point/status for opening the physics paint canvas and receiving apply results.
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts` — Existing frame-based stroke replay engine used for Play preview/render capture.
- `packages/efx-physic-paint/src/types.ts` — `SerializedProject` stores editable stroke/settings data, not full pixel buffers.
- `app/src/components/sidebar/InlineColorPicker.tsx` — Existing rich inline color picker with Box/TSL/RVB/CMYK modes, alpha, recent colors, and favorite swatches; reuse where practical for the Physics Paint color widget/palette.
- `app/src/components/shared/ColorPickerModal.tsx` — Existing modal color picker/gradient support; available if modal behavior is preferred.
- `app/src/lib/shortcuts.ts` and `app/src/components/overlay/ShortcutsOverlay.tsx` — Existing shortcut patterns and conflicts to respect.

### Established Patterns
- Physics paint is additive: it does not replace perfect-freehand basic paint or p5.brush FX paint.
- The rejected headless/batch adapter approach must not return. Preserve interactive incremental simulation quality.
- Non-reactive Map storage uses explicit version signals (`physicPaintVersion`, paint memories' `paintVersion` pattern) to trigger UI refreshes after mutations.
- The app uses Preact + signals, custom Tailwind/CSS-variable UI, and EFX Motion's own button/control styling rather than heavy UI libraries.
- Existing paint-mode shortcut conflicts must be guarded by context/window focus.

### Integration Points
- Rebuilt UI connects to the existing `PhysicsPaintStudio` route/window and must preserve bridge/apply behavior.
- Save roto frame maps to current `applyCanvas()` behavior, renamed and restyled.
- Save play maps to current `applyPlayCanvas()` behavior, renamed/restyled and changed to remain open after success.
- Play preview maps to `AnimationPlayer.play()` and must use project FPS rather than exposing a custom FPS control.
- Debug PNG+manifest export should be gated to dev mode and surfaced in the top bar status area collapsed by default.

</code_context>

<specifics>
## Specific Ideas

- Build the UI like the Pencil design explains, but visually base it on the existing EFX Motion app UI.
- The bottom physics-paint spreadsheet/timeline is new and different from the EFX Motion timeline.
- Roto and Play canvas controls should look like the same product; distinguish them by grouping/labels and mode state, not mismatched button colors.
- Play range marker example: `[0]----•---[50]`, where `•` shows the current interpolated frame/state inside the play animation.
- Conversion should be explicit through the Roto/Play workflow tabs: clicking the Play range only moves/inspects the marker and frame, not conversion.
- Debug artifacts are for dev users only; final users should see the normal Save roto frame / Save play workflow and concise status.

</specifics>

<deferred>
## Deferred Ideas

- Phase 38: true persisted source-lane data model for roto-frame and script-play sources.
- Phase 38: hybrid/mixing model where script play can be the base and roto corrections can be layered on top.
- Phase 38: auto-save/auto-publish policy.
- Phase 38: conflict/overlap handling for script-play ranges and roto fixes.
- Phase 38 or later: edit script source from any frame in its range.
- Phase 38 or later: multiple stacked roto lanes / arbitrary layer mixing.
- Later if needed: second full physics-paint engine/canvas for mini blend preview. Phase 36 should attempt lightweight blending first and defer if a full engine is required.

</deferred>

---

*Phase: 36-Physics Paint UI Rebuild, Session Persistence, and Output Proof*
*Context gathered: 2026-06-12*
