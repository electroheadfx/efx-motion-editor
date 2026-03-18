---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: completed
stopped_at: Completed 12.8-01-PLAN.md
last_updated: "2026-03-18T17:18:23.329Z"
last_activity: "2026-03-18 - Completed 12.8-01: tile-pattern thumbnail rendering with center-crop"
progress:
  total_phases: 19
  completed_phases: 14
  total_plans: 39
  completed_plans: 39
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** v0.2.0 Phase 12.7 -- Change keyframe icons and improve keyframe click targets

## Current Position

Milestone: v0.2.0
Phase: 12.8 (fix-timeline-thumb-horizontal-stretching-on-zoom-use-repeat-cover-pattern)
Plan: 1 of 1
Status: Phase Complete
Last activity: 2026-03-18 - Completed 12.8-01: tile-pattern thumbnail rendering with center-crop

Progress: [██████████] 100%

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

## Session Continuity

Last session: 2026-03-18T17:09:06.424Z
Stopped at: Completed 12.8-01-PLAN.md
Resume file: None
