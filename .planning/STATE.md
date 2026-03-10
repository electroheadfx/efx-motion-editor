---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Production Tool
status: completed
stopped_at: Completed 07-10-PLAN.md
last_updated: "2026-03-10T13:36:03.431Z"
last_activity: 2026-03-10 — Completed 07-10 (Timeline Vertical Scroll)
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 23
  completed_plans: 23
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 7 — Cinematic FX Effects (FX rendering integration, AddLayerMenu)

## Current Position

Phase: 7 of 10 (Cinematic FX Effects)
Plan: 10 of 10 in current phase
Status: Phase Complete
Last activity: 2026-03-10 - Completed quick task 4: Fix FX layers hide from sidebar sequence

Progress: [██████████] 100% (v1.0 complete, v2.0 Phase 7 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (v1.0)
- Average duration: ~2.5 hours (v1.0)
- Total execution time: ~32 hours (v1.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3 | v1.0 | v1.0 |
| 2. UI Shell | 3 | v1.0 | v1.0 |
| 3. Project Mgmt | 3 | v1.0 | v1.0 |
| 3.1 Integration Fix | 1 | v1.0 | v1.0 |
| 4. Timeline | 3 | v1.0 | v1.0 |

| 5. Editing Infra | 3 | v2.0 | v2.0 |
| 6. Layers & Props | 8/8 | 20min | 2.5min |

*v2.0 metrics will populate as plans execute*
| Phase 03 P04 | 2min | 2 tasks | 2 files |
| Phase 03 P06 | 1min | 2 tasks | 2 files |
| Phase 03 P05 | 2min | 2 tasks | 4 files |
| Phase 03 P08 | 2min | 2 tasks | 2 files |
| Phase 03 P07 | 2min | 1 tasks | 1 files |
| Phase 03 P09 | 3min | 2 tasks | 1 files |
| Phase 03 P10 | 2min | 2 tasks | 3 files |
| Phase 04 P04 | 2 | 2 tasks | 4 files |
| Phase 04 P05 | 2min | 2 tasks | 2 files |
| Phase 05 P05 | 2min | 2 tasks | 3 files |
| Phase 05 P04 | 5min | 2 tasks | 3 files |
| Phase 06 P06 | 3min | 2 tasks | 3 files |
| Phase 06 P05 | 3min | 2 tasks | 4 files |
| Phase 06 P08 | 2min | 1 tasks | 1 files |
| Phase 06 P07 | 2min | 2 tasks | 2 files |
| Phase 07 P01 | 2min | 2 tasks | 4 files |
| Phase 07 P02 | 3min | 2 tasks | 2 files |
| Phase 07 P03 | 3min | 2 tasks | 2 files |
| Phase 07 P05 | 3min | 2 tasks | 9 files |
| Phase 07 P06 | 5min | 2 tasks | 7 files |
| Phase 07 P08 | 2min | 2 tasks | 4 files |
| Phase 07 P09 | 3min | 2 tasks | 7 files |
| Phase 07 P10 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Archived to PROJECT.md Key Decisions table. Full v1.0 decisions archived in milestones/v1.0-ROADMAP.md.

Recent decisions affecting current work:
- v2.0: Canvas 2D PreviewRenderer over Motion Canvas generator model for compositing
- v2.0: Custom command-pattern undo over @kvndy/undo-manager (operation-level granularity needed)
- v2.0: tinykeys over hotkeys-js for keyboard shortcuts (650B, TypeScript-native)
- v2.0: Web Audio API directly over wavesurfer.js (avoid widget/DOM conflicts with canvas timeline)
- 05-01: guardUnsavedChanges() returns GuardResult union type for clean caller control flow
- 05-01: closeProject() stops engines/timers before store resets (prevents orphaned operations)
- 05-01: createProject() and openProject() call closeProject() first for guaranteed clean state
- 05-02: Standalone lib/history.ts engine with snapshot/restore helpers in sequenceStore
- 05-02: structuredClone for all undo snapshots (correctness over micro-optimization)
- 05-02: resetHistory clears coalescing state to prevent stale anchors across projects
- 05-03: tinykeys module declaration in vite-env.d.ts to work around v3.0.0 missing types export
- 05-03: Toolbar refactored to use uiStore.showNewProjectDialog signal for Cmd+N parity
- ~~05-03: JKL shuttle uses own rAF loop separate from PlaybackEngine for variable-rate stepping~~ (superseded by 05-05: shuttle is state-only, PlaybackEngine reads shuttle signals)
- 06-01: layerStore.layers computed from sequenceStore active sequence (not independent signal)
- 06-01: All layer mutations route through sequenceStore for unified snapshot/restore undo
- 06-01: Base layer ID always 'base' with isBase=true for deletion protection
- 06-01: Project version bumped to 2; v1 files auto-generate base layer on load
- 06-02: PreviewRenderer is standalone class decoupled from UI for Phase 10 export reuse
- 06-02: Canvas DPI scaling matches TimelineRenderer pattern (devicePixelRatio)
- 06-02: Motion Canvas player removed from Preview.tsx (canvas compositing replaces it)
- 06-02: Async image loading with cache prevents main-thread blocking
- 06-03: Tauri FS plugin (copyFile/mkdir/readDir) for video import instead of new Rust IPC command
- 06-03: Natural sort (localeCompare numeric) for image sequence frame ordering
- 06-03: Reversed-index SortableJS mapping (arrayIndex = totalLayers - 1 - visualIndex)
- 06-04: Inline sub-components (BlendSection, TransformSection, CropSection) in same file for panel cohesion
- 06-04: Shared NumericInput with coalescing support for all numeric inputs
- 06-04: Crop values clamped to 0-1 range in onChange handler
- [Phase 03]: Check DragDropEvent paths.length > 0 on enter to distinguish external file drags from SortableJS internal drags
- [Phase 03]: Image picker popover opens upward (bottom-14) since key photo strip is near bottom of left panel
- [Phase 03]: SortableJS DOM revert pattern: removeChild+insertBefore before signal update for correct Preact re-render
- [Phase 03]: SortableJS useEffect deps on collection.length to recreate instance on add/remove without unnecessary recreation on edits
- [Phase 03]: AddKeyPhotoButton moved outside overflow-x-auto sortable container to prevent popover clipping and click interception
- [Phase 03]: Use std::path::Path::exists() for scope-free file validation in WelcomeScreen
- [Phase 03]: Hard-coded hex colors (#CCCCCC, #999999) for non-highlighted recent project items to guarantee contrast
- [Phase 03]: Removed SortableJS from KeyPhotoStrip in favor of click-select + arrow key reorder per UAT user feedback
- [Phase 03]: scrollbar-hidden CSS utility for cross-browser hidden scrollbar with wheel-to-horizontal-scroll
- [Phase 03]: createPortal from preact/compat renders context menu in document.body, escaping overflow-y-auto container
- [Phase 03]: SortableJS forceFallback:true uses CSS transforms + pointer events, bypassing Tauri native HTML5 DnD interception
- [Phase 03]: Re-added SortableJS with forceFallback:true to KeyPhotoStrip alongside hover move buttons for dual reorder UX
- [Phase 03]: Cards resized from 80px to 72px with compact 24px add button for 3-thumbnail visible window in 268px panel
- [Phase 03]: Header bar layout: KEY PHOTOS [< X >] [+] with move/delete only when selected
- [Phase 03]: AddKeyPhotoButton popover opens downward and right-aligned for header bar context
- [Phase 03]: Selection cleared on setActive/removeKeyPhoto/reset for clean state management
- [Phase 04]: Belt-and-suspenders cache busting: both Cache-Control headers and URL query param for efxasset protocol
- [Phase 04]: imageId used as bustKey since each distinct image already has a unique imageId in store
- [Phase 04]: Switched MouseEvent to PointerEvent for timeline/preview drag interactions to fix setPointerCapture(0) DOMException
- [Phase 04]: Widened playhead hit area from 5px to 10px for easier drag targeting
- [Phase 05]: 05-05: JKL shuttle is purely state-only (no rAF loop); PlaybackEngine reads shuttle signals in its tick
- [Phase 05]: 05-05: Space is sole play/stop; J/L set direction+speed; K resets to 1x forward without stopping
- [Phase 05]: 05-05: Playback auto-loops at boundaries instead of stopping
- 05-04: MenuItem::with_id for Undo/Redo instead of PredefinedMenuItem to emit events to frontend
- 05-04: PredefinedMenuItem kept for Cut/Copy/Paste/Select All (native handling works in webview)
- 05-04: Shift+? character matching over Shift+Slash physical key code for layout independence
- 06-06: Replicated AddKeyPhotoButton popover pattern for static image asset picker (consistency over custom UI)
- 06-06: VideoAsset interface kept in imageStore.ts (not separate types file) for simplicity since only two consumers
- 06-06: Video assets tracked in-memory only (no .mce persistence); layer source paths sufficient for reconstruction
- [Phase 06]: 06-05: NumericInput uses focus/blur lifecycle for coalescing instead of pointer events
- [Phase 06]: 06-05: Inline rotation input replaced with shared NumericInput component for consistency
- [Phase 06]: 06-05: Video loading placeholder shows layer name for identification
- [Phase 06]: 06-08: Shared readyHandler stored per layer ID in videoReadyHandlers map for loadeddata/seeked event cleanup
- [Phase 06]: 06-07: Video picker uses name+icon list (not thumbnail grid) since videos have no thumbnails per design
- [Phase 06]: 06-07: Video assets re-discovered from layer source data during hydration (no .mce persistence needed)
- [Phase 07]: 07-01: MC Random used standalone (no MC scene graph) for seeded PRNG in generators
- [Phase 07]: 07-01: Color grade uses save/resetTransform/restore to handle DPI-scaled canvas pixel access
- [Phase 07]: 07-01: All generators use normalized coordinates (0-1) scaled to canvas for resolution independence
- [Phase 07]: 07-02: Single-pass draw loop replacing two-pass resolve+draw for FX layer support
- [Phase 07]: 07-02: Opacity-scaled color grade parameters instead of pixel-level blending (approximation, visually identical)
- [Phase 07]: 07-02: Generators default to screen blend mode in AddLayerMenu for natural FX compositing
- [Phase 07]: 07-03: FX sections dispatch via switch on source.type for precise control routing
- [Phase 07]: 07-03: Preset change overwrites all color grade params; individual param change resets preset to none
- [Phase 07]: 07-03: SeedControls extracted as shared sub-component for grain/particles/lines/dots reuse
- [Phase 07]: FX temporal range (inFrame/outFrame) moved from Layer to Sequence level for timeline-first FX architecture
- [Phase 07]: 07-05: .mce version bumped from 3 to 4; v3 layer-level in_frame/out_frame silently ignored on load
- [Phase 07]: 07-06: FX overlay compositing uses clearCanvas=false parameter rather than separate render method
- [Phase 07]: 07-06: PropertiesPanel searches all sequences (not just active) to find FX layers for property editing
- [Phase 07]: 07-06: FX sequences filtered from content frameMap/trackLayouts; fxTrackLayouts provides FX-specific layout
- [Phase 07]: 07-08: clearCanvas=false overlay passes treat any visible layer as drawable (adjustment layers modify existing pixels)
- [Phase 07]: 07-08: Sequence-aware CRUD methods added alongside active-sequence-scoped methods (no breaking changes)
- [Phase 07]: 07-08: FX layers rendered in LayerList outside SortableJS container (reorder deferred to timeline)
- [Phase 07]: 07-08: Empty FX sequences auto-removed when sole layer deleted
- [Phase 07]: visible?: boolean uses undefined=true, false=hidden to avoid adding visible:true to all existing sequences
- [Phase 07]: FX header click vs drag resolved on pointerUp: same-track release = toggle visibility, different-track = reorder
- [Phase 07]: 07-10: Ruler fixed at top via clip region; playhead in screen space; deltaY=vertical, shift+deltaY=horizontal scroll
- [Quick-02]: Dual-signal pattern: displayFrame for UI panels, currentFrame for render loop; syncDisplayFrame on stop/seek/step only
- [Quick-04]: Filter FX sequences at render time (not store level) to keep SortableJS reorder index mapping explicit
- [Quick-04]: 18px hit zone for 6px bullet provides generous click target without overlapping name text

### Pending Todos

None.

### Blockers/Concerns

~~Carried forward from v1.0 audit (fixed in 05-01):~~
- ~~INT-01: Data bleed on "New Project" from Toolbar (stores not reset)~~ -- FIXED in 3285b6d
- ~~INT-02: timelineStore/playbackEngine not reset on project close~~ -- FIXED in 3285b6d
- ~~INT-03: stopAutoSave() never called~~ -- FIXED in 3285b6d

No active blockers.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Project save doesn't save FX layers created in the project, when I re-open the project my FX has gone | 2026-03-10 | 6d3dfce | [1-project-save-doesn-t-save-fx-layers-crea](./quick/1-project-save-doesn-t-save-fx-layers-crea/) |
| 2 | Freeze UI updates during playback (displayFrame/displayTime dual-signal pattern) | 2026-03-10 | 5e2773f | [2-freeze-ui-updates-during-playback-only-u](./quick/2-freeze-ui-updates-during-playback-only-u/) |
| 3 | Fix playback black flash regression from quick-2 UI freeze changes | 2026-03-10 | 230b0a2 | [3-fix-playback-black-flash-regression-from](./quick/3-fix-playback-black-flash-regression-from/) |
| 4 | Fix FX layers hide from sidebar, bullet visibility toggle, click-to-toggle | 2026-03-10 | bc1ce46 | [4-fix-fx-layers-hide-from-sidebar-sequence](./quick/4-fix-fx-layers-hide-from-sidebar-sequence/) |

## Session Continuity

Last session: 2026-03-10T18:57:16Z
Stopped at: Completed quick task 4
Resume file: None
