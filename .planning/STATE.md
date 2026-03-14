---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: executing
stopped_at: Completed 11-03-PLAN.md
last_updated: "2026-03-13T17:14:03.471Z"
last_activity: "2026-03-13 - Completed 11-03: TransformOverlay with drag state machine, revised pan model"
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 15
  completed_plans: 14
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** v0.2.0 Phase 11 -- Live canvas transform with non-uniform scaling

## Current Position

Milestone: v0.2.0
Phase: 11 (live-canvas-transform)
Plan: 4 of 4
Status: In Progress
Last activity: 2026-03-13 - Completed 11-03: TransformOverlay with drag state machine, revised pan model

Progress: [█████████░] 93%

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

### Pending Todos

None.

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

## Session Continuity

Last session: 2026-03-14T10:35:39Z
Stopped at: Completed quick-7
Resume file: None
