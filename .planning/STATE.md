---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Production Tool
status: executing
stopped_at: Completed 05-04-PLAN.md (Undo/Redo & Shortcuts Overlay Fix)
last_updated: "2026-03-09T21:16:33Z"
last_activity: 2026-03-09 — Completed 05-04 (Undo/Redo & Shortcuts Overlay Fix)
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 5 — Editing Infrastructure (gap closure: undo/redo & shortcuts fix)

## Current Position

Phase: 5 of 10 (Editing Infrastructure)
Plan: 5 of 5 in current phase -- COMPLETE
Status: In Progress
Last activity: 2026-03-09 — Completed 05-04 (Undo/Redo & Shortcuts Overlay Fix)

Progress: [█████████░] 89% (v1.0 complete, v2.0 Phase 5 plan 5/5)

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
| 6. Layers & Props | 4/4 | 12min | 3min |

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

### Pending Todos

None.

### Blockers/Concerns

~~Carried forward from v1.0 audit (fixed in 05-01):~~
- ~~INT-01: Data bleed on "New Project" from Toolbar (stores not reset)~~ -- FIXED in 3285b6d
- ~~INT-02: timelineStore/playbackEngine not reset on project close~~ -- FIXED in 3285b6d
- ~~INT-03: stopAutoSave() never called~~ -- FIXED in 3285b6d

No active blockers.

## Session Continuity

Last session: 2026-03-09T21:16:33Z
Stopped at: Completed 05-04-PLAN.md (Undo/Redo & Shortcuts Overlay Fix)
Resume file: None
