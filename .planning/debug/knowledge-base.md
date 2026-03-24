# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## keyframe-label-z-index-overlap — Keyframe hit zone blocks label clicks due to missing Y check
- **Date:** 2026-03-24
- **Error patterns:** z-index, pointer-events, keyframe, label, click, hit-test, unclickable, timeline
- **Root cause:** In TimelineInteraction.ts, the pointerdown handler checks keyframeHitTest before nameLabelHitTest. The keyframe hit test for content tracks uses only X-position (no Y check), so its hit zone covers the entire track height including the label area. When a keyframe is near a label's X position, the keyframe intercepts the click even though the user clicked on the label at a different Y position.
- **Fix:** Reordered hit-test priority in both pointerdown and pointermove handlers so nameLabelHitTest runs BEFORE keyframeHitTest. Label hit testing uses a precise bounding box (both X and Y), so it only catches clicks actually on the label text.
- **Files changed:** Application/src/components/timeline/TimelineInteraction.ts
---
