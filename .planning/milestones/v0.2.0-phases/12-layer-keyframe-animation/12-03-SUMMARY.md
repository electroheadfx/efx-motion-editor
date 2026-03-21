---
phase: 12-layer-keyframe-animation
plan: 03
subsystem: timeline-ui
tags: [keyframe, diamond, canvas, interaction, popover, easing, preact-signals]

requires:
  - phase: 12-layer-keyframe-animation
    plan: 01
    provides: Keyframe types, keyframeStore with CRUD/selection/interpolation
provides:
  - Diamond markers on timeline tracks for selected content layer keyframes
  - Full keyframe interaction: click-select, shift-multiselect, drag-move, delete, double-click popover
  - KeyframePopover interpolation curve selector (Linear, Ease In, Ease Out, Ease In-Out)
  - Reactive signal subscriptions for immediate diamond updates
affects: [12-04, timeline-ui, properties-panel]

tech-stack:
  added: []
  patterns: [custom DOM events for cross-component communication (keyframe-dblclick), virtualized canvas diamond rendering]

key-files:
  created:
    - Application/src/components/timeline/KeyframePopover.tsx
  modified:
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/timeline/TimelineCanvas.tsx
    - Application/src/lib/shortcuts.ts

key-decisions:
  - "Diamond size 6px with gold colors (#E5A020 normal, #FFD700 selected) matching industry standard"
  - "Hit threshold scales with zoom: max(0.6 frames, 8px) for reliable clicking at any zoom level"
  - "Double-click detection via manual 400ms timer on same frame (no dblclick event needed)"
  - "Custom DOM event keyframe-dblclick for cross-component popover trigger (TimelineInteraction -> TimelineCanvas)"
  - "Delete key checks keyframe selection BEFORE layer deletion in handleDelete priority chain"

patterns-established:
  - "Custom DOM events for canvas interaction -> React component communication"
  - "Virtualized diamond rendering: skip diamonds outside visible area"
  - "Double-click detection via timestamp comparison (400ms threshold)"

requirements-completed: [KF-09, KF-10, KF-11, KF-12, KF-13]

duration: 5min
completed: 2026-03-14
---

# Phase 12 Plan 03: Timeline Keyframe Diamonds and Interaction Summary

**Gold diamond markers on timeline tracks with full interaction: click-select, shift-multiselect, drag-move, delete, and double-click interpolation popover**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T15:36:30Z
- **Completed:** 2026-03-14T15:41:51Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Diamond markers rendered on content track rows for selected layer keyframes, with gold fill and white stroke + glow for selected state
- Full keyframe interaction chain: click-select with playhead snap, shift-multiselect, drag-move with coalesced undo, delete key (prioritized over layer deletion), double-click popover
- KeyframePopover component with 4 easing options, gold-highlighted current selection, click-outside-to-close backdrop
- Reactive signal subscriptions in TimelineCanvas: diamonds update immediately when keyframes are added/removed/moved/selected

## Task Commits

Each task was committed atomically:

1. **Task 1: Draw keyframe diamonds on the timeline** - `dc9bedf` (feat)
2. **Task 2: Add keyframe interaction handlers, wire draw state, and add reactive subscriptions** - `86e13e4` (feat)
3. **Task 3: Create KeyframePopover interpolation selector** - `25b135f` (feat)

## Files Created/Modified
- `Application/src/components/timeline/TimelineRenderer.ts` - Added drawDiamond, drawKeyframeDiamonds methods; extended DrawState with keyframe fields
- `Application/src/components/timeline/TimelineInteraction.ts` - Added keyframeHitTest, keyframe drag state, click/drag/double-click handlers, deleteSelectedKeyframes method
- `Application/src/components/timeline/TimelineCanvas.tsx` - Wired keyframe data to DrawState, added reactive signal subscriptions, keyframe-dblclick event listener, popover mount
- `Application/src/components/timeline/KeyframePopover.tsx` - New interpolation curve selector popover with 4 easing options
- `Application/src/lib/shortcuts.ts` - Added keyframe-delete-first check to handleDelete priority chain

## Decisions Made
- Diamond size 6px with industry-standard gold coloring; selected diamonds get white stroke and shadowBlur glow
- Hit threshold dynamically scales: max(0.6 frames, 8px) ensures reliable clicking at both zoomed-in and zoomed-out levels
- Custom DOM event pattern (keyframe-dblclick) bridges canvas interaction class to Preact component state for popover
- Delete key priority: keyframe diamonds checked before layer deletion and before sequence deletion
- Double-click detected manually (400ms window on same frame) rather than relying on browser dblclick event, which doesn't work well with pointer capture

## Deviations from Plan

None - plan executed exactly as written. Plan 02 had already added the keyframeStore/timelineStore/isFxLayer imports and I-key shortcut to shortcuts.ts, so only the handleDelete keyframe-first check was needed from this plan.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 keyframe interaction modes are wired and functional
- Interpolation popover ready for user testing
- Reactive signal subscriptions ensure diamonds update on any keyframe change
- Ready for Plan 04 (canvas rendering of interpolated property values during playback)

---
*Phase: 12-layer-keyframe-animation*
*Completed: 2026-03-14*
