---
phase: 13-sequence-fade-in-out
plan: 05
subsystem: verification
tags: [transitions, fade, cross-dissolve, verification, uat]
status: complete
---

## What was done

End-to-end human verification of the complete transition system. Multiple rounds of UI/UX fixes applied during verification:

1. **Sidebar redesign**: Removed duplicate TRANSITIONS section from sidebar, moved add buttons to timeline header as `+ Transition` dropdown
2. **Timeline rendering**: Transition overlays changed to purple bars at top 30% of content tracks (full height on FX tracks), with black border and diagonal line
3. **Toggle-deselect**: Clicking already-selected transition deselects it
4. **Properties fallback**: Deselecting transition shows active sequence base layer properties
5. **Compact TransitionProperties**: Matched SidebarProperties spacing system
6. **Persistence fix**: Added MceTransition struct to Rust backend (transitions were silently dropped by serde)
7. **Cross dissolve fix**: Removed timeline shortening, moved overlay rendering to separate pass after all track thumbnails
8. **FX layer transitions**: Added fade in/out support for FX and content-overlay sequences
9. **FX generator fade**: Fixed generators overriding globalAlpha by using offscreen canvas compositing
10. **Default duration**: 20% of sequence/FX total frames, auto-select after adding

## Key decisions

- Cross dissolve does NOT shorten the timeline — purely visual blend at boundary
- FX transitions are transparency-only (no solid mode)
- Transition bar: 30% height on content tracks, full height on FX tracks
- Icons: Layers for + Transition, Clapperboard for + Layer

## Self-Check: PASSED

All transition types verified: fade in, fade out, cross dissolve. Timeline rendering, preview playback, sidebar editing, and .mce persistence all functional.
