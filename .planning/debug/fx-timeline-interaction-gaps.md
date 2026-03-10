---
status: diagnosed
trigger: "Three UAT issues: FX dot not clickable for visibility toggle, FX bars not reorderable, no vertical scroll for many FX layers"
created: 2026-03-10T14:00:00Z
updated: 2026-03-10T14:30:00Z
---

## Current Focus

hypothesis: All three issues are missing features - no code exists for dot click handling, FX reorder drag, or vertical scroll
test: Exhaustive code review of renderer, interaction handler, canvas component, and store
expecting: No implementation for any of the three features
next_action: Return structured diagnosis for all three issues

## Symptoms

expected: (1) Clicking color dot near FX name toggles visibility. (2) FX range bars can be reordered by dragging headers. (3) Vertical scroll appears when many FX tracks overflow the canvas.
actual: (1) Dot is purely decorative - no click handler. (2) No drag-to-reorder for FX tracks. (3) Canvas has fixed height with overflow:hidden - no scroll.
errors: No runtime errors - features simply don't exist
reproduction: (1) Click the color dot next to any FX name. (2) Try dragging an FX track header. (3) Add 5+ FX sequences to overflow the timeline.
started: Phase 07 initial implementation - features were never built

## Eliminated

(none - root causes immediately identifiable from code review)

## Evidence

- timestamp: 2026-03-10T14:05:00Z
  checked: TimelineRenderer.drawFxTrack lines 261-325
  found: Color dot is drawn as a filled circle at (dotX+3, dotY) with radius 3 (lines 282-285). It is purely a canvas drawing operation with no hit detection or interactivity. No visibility state is read or rendered (no dimming for hidden FX).
  implication: Dot click-to-toggle requires: (a) hit detection in TimelineInteraction, (b) a visibility toggle method in sequenceStore or on the FX sequence model, (c) visual feedback in the renderer for hidden state

- timestamp: 2026-03-10T14:07:00Z
  checked: TimelineInteraction.onPointerDown lines 167-191 (FX area handling)
  found: When click is in FX area, code checks fxDragModeFromX which only tests against the range bar body (move/resize-left/resize-right). If mode is null (click is NOT on the bar), it falls through to seek-playhead. There is NO hit test for the header area (localX < TRACK_HEADER_WIDTH) within the FX area.
  implication: Clicks on the FX header (where the dot lives) are treated as "click in FX area but not on a bar" and just seek the playhead. The dot is unreachable.

- timestamp: 2026-03-10T14:09:00Z
  checked: Sequence type (sequence.ts) and FxTrackLayout type (timeline.ts)
  found: Sequence has no `visible` field. FxTrackLayout has no `visible` field. Layer has `visible: boolean` but that's per-layer within a sequence, not per-FX-sequence.
  implication: No data model support for FX sequence visibility toggle

- timestamp: 2026-03-10T14:11:00Z
  checked: sequenceStore.ts - all methods
  found: No toggleFxVisibility, reorderFxSequences, or similar methods exist. reorderSequences (line 141) operates on ALL sequences (content + fx mixed) by array index - not suitable for FX-only reorder.
  implication: Store has no FX-specific visibility or reorder support

- timestamp: 2026-03-10T14:13:00Z
  checked: TimelineInteraction - FX area drag handling
  found: isDraggingTrack / dragTrackIndex / setDragState only handle content track reorder (lines 196-218, 265-275, 337-365). FX drag (isDraggingFx) only supports move/resize modes (lines 237-261). No FX reorder drag mode exists.
  implication: FX reorder drag is completely unimplemented

- timestamp: 2026-03-10T14:15:00Z
  checked: TimelineCanvas.tsx container div (line 69)
  found: Container is `<div class="flex-1 min-h-0 overflow-hidden">`. The overflow-hidden prevents any scrolling. Canvas is rendered at `w-full h-full` filling the container.
  implication: No vertical scroll mechanism exists. Canvas fills its container and clips - no scrollbar, no scroll offset for vertical content.

- timestamp: 2026-03-10T14:17:00Z
  checked: TimelineRenderer.draw - height calculation
  found: Canvas height is set by setupCanvas() from getBoundingClientRect (line 78-83). The canvas does NOT size itself to content (FX tracks + content tracks). It sizes to its CSS container. Tracks that extend beyond the canvas bottom are simply not visible.
  implication: Even if overflow were not hidden, the canvas itself doesn't grow to accommodate content. A scrollY offset would need to be added to the rendering pipeline.

- timestamp: 2026-03-10T14:19:00Z
  checked: TimelineRenderer.draw - vertical layout math
  found: FX tracks start at RULER_HEIGHT (24px), each is FX_TRACK_HEIGHT (28px). Content tracks start at RULER_HEIGHT + fxOffset. No scrollY offset is subtracted from any Y positions. The wheel handler (TimelineInteraction.onWheel) only handles horizontal scroll (deltaX + deltaY) and zoom - no vertical scroll.
  implication: Vertical scroll would require: (a) a scrollY signal in timelineStore, (b) subtracting scrollY from all Y positions in the renderer, (c) wheel/touch handling for vertical scroll, (d) container or canvas sizing changes

## Resolution

root_cause: Three distinct missing features, not bugs in existing code.
fix: (not applied - diagnosis only)
verification: (not applicable)
files_changed: []
