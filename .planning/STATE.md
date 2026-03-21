---
gsd_state_version: 1.0
milestone: v0.1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 14-04-PLAN.md
last_updated: "2026-03-21T12:51:36.037Z"
progress:
  total_phases: 25
  completed_phases: 23
  total_plans: 66
  completed_plans: 66
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 14 — png-export

## Current Position

Phase: 15
Plan: Not started

## Accumulated Context

### Decisions

Archived to PROJECT.md Key Decisions table.
Full phase decisions archived in milestones/v0.1.0-ROADMAP.md.

- [Phase 08]: data-theme attribute on html for CSS variable switching; theme persistence moved from LazyStore to ~/.config/efx-motion/builder-config.yaml (quick-12)
- [Phase 08-02]: Semi-transparent black overlays on thumbnails stay hardcoded; layer/FX identity colors exempt from theme conversion
- [Phase 08-03]: Canvas 2D colors cached at module level with invalidation on theme signal; functional colors (playhead, drop indicator) stay hardcoded
- [Phase 09-01]: canvasStore as single source of truth for zoom/pan; circular import with projectStore safe via runtime-only calls; fit-to-window capped at 1.0
- [Phase 09-04]: Same MenuItem::with_id + on_menu_event + listen pattern as Edit menu Undo/Redo for View menu zoom items
- [Phase 09-03]: Center-anchored zoom instead of cursor-anchored per user request; canvas wrapper sized to project resolution instead of hardcoded 830px
- [Phase 09-02]: Toolbar percent display is read-only; disabled buttons use opacity-40 CSS rather than HTML disabled
- [Phase 10]: stackblur-canvas ts-expect-error import due to package.json exports missing types entry
- [Phase 10]: Quadratic normalizedToPixelRadius mapping for perceptually linear blur; generator blur uses RGB-only StackBlur to avoid alpha halos
- [Phase 11-01]: v4-to-v5 migration uses nullish coalescing: scaleX = scale_x ?? scale ?? 1
- [Phase 11-01]: Rust serde uses default_scale() -> 1.0 for v4 backward compat
- [Phase 11-02]: All canvas utility functions are pure (no signal reads) -- params in, results out
- [Phase 11-02]: Bounding-box-only hit testing (no pixel sampling) for initial implementation
- [Phase 11-03]: TransformOverlay inside CSS-transformed div (project-space coordinates, not client-space)
- [Phase 11-03]: Pan model: left-click selects/transforms, middle-click and Space+drag pan only
- [Phase 11-03]: Source dimensions from imageStore metadata rather than renderer image cache
- [Phase 11-04]: Arrow key context-dependence via layerStore.selectedLayerId.peek() check in each handler
- [Phase 11-04]: Bidirectional sync by calling both layerStore.setSelected and uiStore.selectLayer explicitly (no signal effect)
- [Phase 12-01]: Polynomial cubic easing (t^3 / (1-t)^3 / piecewise); sequence-local frame offsets for keyframes
- [Phase 12-01]: Transient overrides pattern for property edits between keyframes; .mce v5->v6 with backward compat
- [Phase 12-02]: I key (KeyI) for add-keyframe shortcut since K taken by JKL shuttle; TransformSection extended with override props for keyframe-aware editing
- [Phase 12-03]: Diamond hit threshold scales with zoom: max(0.6 frames, 8px); custom DOM event pattern for canvas-to-component popover trigger
- [Phase 12-05]: clearFxLayerSelection() helper: only nulls selectedLayerId when current selection is FX layer, preserving content layer keyframe diamond visibility
- [Phase 12.1]: Extracted NumericInput/SectionLabel to shared/; CollapsibleSection uses Signal<boolean> directly; EditorMode as string union type
- [Phase 12.1-02]: FX sub-sections vertical layout for sidebar; KeyframeButton duplicated into SidebarProperties; opacity slider flex-1 for sidebar width
- [Phase 12.1-03]: ImportGrid max-h removed (sidebar no longer renders it); Toolbar Imported/Settings buttons toggle mode; SettingsView uses projectStore (per-project FPS/Resolution)
- [Phase 12.1.1]: Restore-from-zero check runs before collapse check in calcResize to prevent immediate re-collapse
- [Phase 12.1.1]: sidebarWidth default updated from 240 to 317 per new design spec
- [Phase 12.1.1-02]: LeftPanel width 100% (parent controls via sidebarWidth); PROPERTIES panel uses flex-1; panel scroll maxHeight = panelHeight - 36px
- [Phase 12.1.1]: Used Ellipsis icon instead of MoreHorizontal (renamed in lucide-preact v0.460+)
- [Phase 12.1.1]: AddKeyPhotoButton opens full importer via setEditorMode('imported') instead of popover
- [Phase 12.1.1]: Used playbackEngine.seekToFrame for keyframe nav (syncs displayFrame + preview); removed KeyframePopover entirely, interpolation editing now inline via sidebar chips
- [Phase 12.2]: trackLayouts.peek() for imperative signal read in event handler; wasActive guard prevents playhead jump on re-click
- [Phase 12.3]: Pure functions for sequence navigation (no signal reads) -- caller passes values in for full testability; PageUp/PageDown fallback to start/end when no further sequences exist
- [Phase 12.5]: Always-visible scrollbar (no conditional hide) per user request; mirrored layout constants in timelineStore to avoid circular dependency with TimelineRenderer
- [Phase 12.5]: Deselect sidebar sequence on playback start; tick only calls ensureTrackVisible (no setActive/selectSequence); re-sync on stop
- [Phase 12.6]: pendingNewSequenceId signal drives multi-select mode; cancel-delete only when pendingId set
- [Phase 12.6]: Key photo ring highlight derived from playhead displayFrame, not separate selectedKeyPhotoId state
- [Phase 12.6]: Auto-scroll suppressed during playback via isPlaying.peek() gate, fires on stop when displayFrame syncs
- [Phase 12.6]: ensureTrackVisible placed outside if(range) but inside if(seekTrack) -- scroll happens even if key photo range not found
- [Phase 12.7]: Icon size 9px fixed (not zoom-scaled) with 18px hit area; nearest-wins replaces first-match; hover glow shadowBlur 3 with #E5A020 distinct from selected shadowBlur 6
- [Phase 12.8]: createPattern-based tile rendering with DOMMatrix scaling; center-crop offset (fw-tileWidth)/2 when frame narrower than tile; MIN_FRAME_WIDTH_FOR_THUMB=4px fallback
- [Phase 12.9]: Intent dispatch pattern: AddLayerMenu sets intent signal + switches to imported mode, ImportedView reads intent to derive filter/selection/handlers
- [Phase 12.9]: Priority-based mode resolution: addLayerIntent > pendingNewSequenceId > activeSequenceId; cancel-delete collision prevention via intent check first
- [Phase 12.10]: Inlined normalizedToPixelRadius in glBlur.ts to avoid circular import; runtime Gaussian weights in shader; RGBA8 texStorage2D; sigma=pixelRadius/3.0 mapping; 64-iteration shader loop cap
- [Phase 12.10]: GPU blur makes HQ/fast distinction obsolete; removed hqPreview signal, toggleHQ(), isHQ() from blurStore; single always-high-quality blur with bypass-only controls
- [Phase 12.11]: isFullSpeed signal uses peek() in tick guard to avoid Preact subscription tracking in rAF
- [Phase 12.11]: stop() clears isFullSpeed as first action before cancelAnimationFrame for clean state
- [Phase 12.11]: FullscreenOverlay renders own Preview instance (avoids CSS reparenting); capture-phase keydown for shortcut scoping; defense-in-depth isFullscreen guards in tinykeys
- [Phase 12.12-01]: content-overlay as new Sequence.kind value (not reusing fx); reorderFxSequences operates on all non-content for interleaved drag; content-overlay uses inFrame as keyframe startFrame
- [Phase 12.12]: CSS variable colors resolved at theme cache level for Canvas 2D; clearFxLayerSelection checks sequence kind not layer type
- [Phase 12.12]: AddLayerIntent extended with target and changeSourceFor fields; content-overlay creation reuses ImportedView flow; layerStore overlayLayers replaces fxLayers for correct routing
- [Phase 12.12-04]: Overlay filter uses s.kind \!== 'content' (not s.kind === 'fx') so content-overlay sequences composite in same pass as FX
- [Phase 12.12-04]: Video looping mod (targetTime % video.duration) applied universally to all video layers
- [Phase 12.13]: DrawState layoutMode/displayMode fields optional for backward compat; text labels (S/L, T+N/T) for toggle buttons; drag feedback suppressed in linear mode
- [Phase 12.13]: sequenceFromFrame helper uses trackLayouts X-ranges for linear mode selection; layout persisted to app config via Tauri IPC; linear mode as default
- [Phase quick-42]: sourceOverrides as optional Record<string, number> bag on KeyframeValues for FX property animation; FX sequences use inFrame as keyframe startFrame
- [Phase 12.14]: SaveIcon alias for lucide Save to avoid conflict with Tauri plugin-dialog save import; icon-only w-8 h-8 buttons with title tooltip format Label (Shortcut)
- [Phase 12.14]: Icon sizes: 14px timeline compact bar, 16px canvas standard, 18px canvas play/pause emphasis; currentColor propagation via text color on button element
- [Phase 12.15]: Tick reads isolation state via .peek() for zero-overhead when no isolation active
- [Phase 12.15]: Normal playback auto-loop now conditional on loopEnabled (was always-on)
- [Phase 12.15]: Skipped 'l' loop toggle shortcut (conflicts with JKL shuttle KeyL); removed (L) from loop button tooltip
- [Phase 12.15]: Isolation border renders BEFORE name overlay so label draws on top of border
- [Phase 12.15]: Name label hover state managed internally by renderer (setHoveredNameLabel), not passed through DrawState signal subscription
- [Phase 13]: Product rule for overlapping fadeIn/fadeOut (multiply opacities); reuse applyEasing from keyframeEngine; mutual exclusion between selectedTransition and selectedLayerId
- [Phase 13-sequence-fade-in-out]: sequenceOpacity parameter multiplied into per-layer globalAlpha rather than offscreen canvas compositing (simpler, more performant)
- [Phase 13]: Transition overlays drawn after thumbnails before pink boundaries (z-order); hit test priority: keyframes > transitions > name labels > sequences
- [Phase 13]: Outgoing sequence owns frameMap slots during cross dissolve overlap; incoming head frames skipped (D-14 timeline shortening)
- [Phase 13]: Preview reactive render effect refactored to delegate to renderFromFrameMap (eliminates duplication, ensures cross dissolve works in both scrub and playback)
- [Phase 14-01]: Made PreviewRenderer.getImageSource public for export preload checking
- [Phase 14-01]: renderGlobalFrame takes canvas parameter for solid fade overlay (avoids canvasRef closure)
- [Phase 14]: menu:export listener in main.tsx following codebase pattern (not shortcuts.ts as plan specified)
- [Phase 14]: Dynamic import for notification plugin with try/catch fallback for graceful degradation
- [Phase 14-04]: FFmpeg cached at ~/.config/efx-motion/bin/ matching config_path pattern; reqwest with rustls-tls to avoid native OpenSSL

### Pending Todos

None.

### Roadmap Evolution

- Phase 12.1 inserted after Phase 12: Remove bottom parameters bar and relocate to sidebar panel (URGENT)
- Phase 12.1.1 inserted after Phase 12.1: Big UI frontend design changes with new sidebar layout (URGENT)
- Phase 12.2 inserted after Phase 12.1.1: Auto-seek timeline to sequence start on sidebar selection (URGENT)
- Phase 12.3 inserted after Phase 12.2: Add quick keys for navigation (URGENT)
- Phase 12.4 inserted after Phase 12.3: ShortcutsOverlay tabbed/paginated sections per group (URGENT)
- Phase 12.5 inserted after Phase 12.4: vertical scroll issues (URGENT)
- Phase 12.6 inserted after Phase 12.5: Layer sequence auto-selection and key photo UX fixes (URGENT)
- Phase 12.7 inserted after Phase 12.6: Change keyframe icons and improve keyframe click targets (URGENT)
- Phase 12.8 inserted after Phase 12.7: Fix timeline thumb horizontal stretching on zoom - use repeat cover pattern (URGENT)
- Phase 12.9 inserted after Phase 12.8: Fix sidebar add-layer dialogs for Static Image, Image Sequence, and Video layers (URGENT)
- Phase 12.10 inserted after Phase 12.9: GPU-Accelerated Blur via WebGL2 (URGENT)
- Phase 12.11 inserted after Phase 12.10: Full-speed playback mode and fullscreen canvas mode (URGENT)
- Phase 12.12 inserted after Phase 12.11: New content layer for timeline (URGENT)
- Phase 12.13 inserted after Phase 12.12: Linear-timeline (URGENT)
- Phase 12.14 inserted after Phase 12: Timeline/canvas buttons enhancements (URGENT)
- Phase 12.15 inserted after Phase 12: sequence-playback (URGENT)

### Blockers/Concerns

No active blockers.

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 1 | Fix FX layers not persisting in .mce project save | 2026-03-10 | 6d3dfce |
| 2 | Freeze UI updates during playback (displayFrame dual-signal pattern) | 2026-03-10 | 5e2773f |
| 3 | Fix playback black flash regression from quick-2 | 2026-03-10 | 230b0a2 |
| 4 | Fix FX layers hide from sidebar, bullet visibility toggle | 2026-03-10 | bc1ce46 |
| 5 | Select content sequence on timeline + Delete key removal | 2026-03-10 | 9282eae |
| 6 | Move blend mode + opacity from bottom bar to LAYERS sidebar | 2026-03-10 | 473d9f2 |
| 7 | Remove blend mode from FX bottom bar, opacity from base layer | 2026-03-10 | ed54e20 |
| 8 | Fix sequence selection rendering: cursor + preview from frameMap | 2026-03-10 | 5b24e6e |
| 9 | Add video thumbnail image in import grid | 2026-03-11 | 6b9aad6 |
| 10 | Move blend mode + opacity back to bottom bar for content layers | 2026-03-11 | 3f17c34 |
| 11 | Add Remove/Locate actions for unavailable recent projects | 2026-03-11 | 37c4f77 |
| 12 | Save theme preference to ~/.config/efx-motion/builder-config.yaml | 2026-03-12 | a8e0cf3 |
| 13 | Move zoom controls from toolbar to bottom canvas bar, add F key shortcut | 2026-03-12 | 58b3593 |
| 14 | Change zoom shortcuts from Cmd+=/- to bare =/- keys | 2026-03-13 | 51aca11 |
| 15 | Create fit-lock toggle for responsive canvas refit on resize | 2026-03-13 | 1baf5ce |
| 16 | Make FX blur affect all layers beneath it (reverse compositing order) | 2026-03-13 | 8913b5c |
| 17 | Add blend mode to FX blur on timeline | 2026-03-13 | e89523b |
| 18 | Add deselect layer when clicking outside canvas | 2026-03-14 | 1220f56 |
| 19 | Theme-aware canvas background color with per-theme persistence | 2026-03-14 | f9bfdc6 |
| 20 | Fix layer deselection when drag-scrubbing NumericInput labels | 2026-03-14 | ad89d5b |
| 21 | Fix interpolation popover z-index (portal) and transparent background (--color-bg-menu) | 2026-03-15 | 830368d |
| 22 | Defer canvas re-renders during timeline drag operations (timelineDragging signal gate) | 2026-03-15 | 979325f |
| 23 | Prevent sidebar property clicks from deselecting active layer | 2026-03-17 | d32f00f |
| 24 | Stop sidebar re-renders during playback (displayFrame gating) | 2026-03-17 | 18825f8 |
| 25 | Add click-to-select key photo from importer grid | 2026-03-17 | b62c4c6 |
| 26 | Fix key photo UX: delete button, thick ring, greyout, header highlight, Delete key | 2026-03-17 | 4614055 |
| 27 | Taller sidebar grabber with 3 stacked Tally3 icons and high-contrast theme colors | 2026-03-17 | 61f9045 |
| 28 | Sequence and layer names hover effect (muted-to-vivid color transition) | 2026-03-17 | 9466faf |
| 29 | Smooth slide animations on sidebar collapse, Key label, unbold sequence titles | 2026-03-17 | c94cc92 |
| 30 | Fix FX range bar in/out point desync on horizontal scroll | 2026-03-17 | 336c90e |
| 31 | Fix z-index issue where sequence thumbnails overlap track header on scroll | 2026-03-18 | 04206a8 |
| 32 | Fix arrow key scrubbing: context-aware via mouseRegion (timeline scrubs, canvas nudges) | 2026-03-18 | 05913fb |
| 33 | Timeline zoom: replace slider with +/- icon buttons, context-aware =/- shortcuts | 2026-03-18 | f32d7a3 |
| 34 | View menu shortcut hints, context-aware menu zoom, full-opacity sequences, key photo border fix, click-to-deselect | 2026-03-18 | f2eee95 |
| 35 | Add more contrast to grab icon in sequence row | 2026-03-18 | 58a3ef2 |
| 36 | Add missing scroll shortcuts (Cmd+Scroll, Shift+Scroll) to help overlay | 2026-03-18 | 9c9e029 |
| 37 | Swap mouse wheel scroll axes: bare wheel=horizontal, Shift+wheel=vertical; widen scrollbar to 8px | 2026-03-19 | 198c175 |
| 38 | Re-enable realtime canvas preview during playhead scrub drag | 2026-03-19 | 160644b |
| 39 | Convert all FX property sections to 2-column paired-row layout | 2026-03-19 | 76905f4 |
| 40 | Fix timeline scroll: natural trackpad, Cmd=vertical, scrollY auto-clamp | 2026-03-19 | 4bb41d2 |
| 41 | Add Cmd+Arrow shortcuts for sequence navigation (laptop-friendly Home/End/PgUp/PgDn) | 2026-03-19 | 2ec4c5f |
| 42 | Add keyframe animation for FX layer source properties (sourceOverrides interpolation) | 2026-03-19 | 0ecfd78 |
| 43 | Add Cmd+ArrowUp/Down shortcuts as vertical aliases for sequence navigation | 2026-03-19 | 0467cb1 |
| 44 | Add Close Project to return to homepage + native File menu | 2026-03-20 | f14b49d |

## Session Continuity

Last session: 2026-03-21T11:13:30.163Z
Stopped at: Completed 14-04-PLAN.md
Resume file: None
