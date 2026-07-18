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

## physics-paint-delete-cache — Deleting a Physics Paint layer left runtime and persisted cache state behind
- **Date:** 2026-07-18
- **Error patterns:** Physics Paint, deletion, stale state, persisted cache, runtime frames, Roto metadata, interpolation metadata, alpha state, serialized outputs, cache files
- **Root cause:** Deletion was split across unsynchronized sources of truth: sequenceStore removed/restored timeline sequences while physicPaintStore retained canonical state under layer.source.layerId. The zero-output persistence path also returned before removing cache/physic-paint, and serialization accepted noncanonical layer.id identities.
- **Fix:** Added complete per-layer snapshot/restore/clear lifecycle, wired orphan-only canonical cleanup into all authoritative deletion Undo/Redo transactions, restricted serialization to source.layerId, and removed the project-local Physics Paint cache root on zero-output saves.
- **Files changed:** app/src/stores/sequenceStore.ts, app/src/stores/sequenceStore.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts, app/src/stores/projectStore.ts, app/src/stores/projectStore.test.ts, app/src/lib/physicPaintPersistence.ts, app/src/lib/physicPaintPersistence.test.ts
---
