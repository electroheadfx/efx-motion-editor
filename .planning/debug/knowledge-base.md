---
audit_acknowledged:
  milestone: v0.9.0
  at: 2026-08-21
  status: unknown
---

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

## wave1-loop-rail-current — Loop Rail integration test retained a superseded current-selection oracle

- **Date:** 2026-08-09
- **Error patterns:** PhysicsPaintLoopClipRail, current, roto-spacing-proxy-selected, boundaryStart, ownership tracer, stale assertion, Wave 1, 1 failure out of 1626
- **Root cause(s):** `PhysicsPaintLoopClipRail.test.tsx` retained a Phase 43 assertion that cursor frame 0 must carry `current`; Quick 260809-aac later made real-key `current` depend on an active primary key identity and gave spacing-proxy selection precedence, but its focused gate omitted this rail integration test. Wave 1 did not introduce the behavior; its post-merge full-suite run exposed the stale assertion.
- **Fix:** Replaced the obsolete `current` expectation with an explicit `roto-spacing-proxy-selected` expectation for the selected frame-0 source proxy.
- **Files changed:** app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
- **Why not caught:** The Quick 260809-aac focused test gate omitted the downstream PhysicsPaintLoopClipRail ownership-tracer test that still encoded the superseded `current` contract.
- **Recurrence guard:** The corrected specified-oracle assertion in `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` now covers this spacing-selected source proxy, and the full 1,626-test app suite verifies the downstream integration contract.

---

## phase-43-1-wave4-tests — Static action extractor did not recognize contextual Insert aria-label source

- **Date:** 2026-08-09
- **Error patterns:** PhysicsPaintWorkflowStrip, Insert key before, aria-label, insertRotoKeyDescription, source token not found, aria-disabled, locked order, 4 failures
- **Root cause(s):** `PhysicsPaintWorkflowStrip.test.ts` identified Insert only through the literal source token `aria-label="Insert key before"`. Wave 4 intentionally changed production to `aria-label={insertRotoKeyDescription}` for contextual accessible copy, so the shared extractor returned no Insert button and four dependent source-contract assertions failed despite intact production behavior.
- **Fix:** Added `getActionAriaLabelToken` to map the existing semantic Insert identity to the contextual JSX source token while retaining literal matching for every other action; reused it in button extraction and action-order checks.
- **Files changed:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
- **Why not caught:** Focused contextual Insert and settlement gates verified runtime semantics but omitted the downstream static workflow-strip source-contract suite; the full post-merge app suite was the first gate to combine the intentional production label change with the stale extractor.
- **Recurrence guard:** `getActionAriaLabelToken` in `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` centralizes semantic action-to-source-token mapping; the corrected 78-test strip suite and full 1,649-test app suite verify contextual Insert without reverting its dynamic accessible label.

---

## phase-43-1-close-reopen-loss — Break ownership was dropped across Physics Paint consumer boundaries

- **Date:** 2026-08-09
- **Error patterns:** Physics Paint, contextual Insert, incoming generated cells, close reopen, blank canvas, only frame 0, canonical revision mismatch, incomingInterpolationBreakKeyIds, Loop Clips
- **Root cause(s):** Break-bearing canonical documents crossed incomplete consumer inputs: child hydration omitted `incomingInterpolationBreakKeyIds` and rejected the canonical revision; live timeline projection omitted the same collection and retained the incoming generated span; coordinator republishing omitted break IDs and Loop Clips.
- **Fix:** Forwarded canonical break ownership through hydration validation and live projection, passed it from Studio, and republished complete launch physical documents including Loop Clips and breaks in source fix commit `6e6acac7`.
- **Files changed:** app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts, app/src/components/physic-paint/hooks/useRotoTimelineModel.ts, app/src/components/physic-paint/roto/rotoLaunchHydration.ts, app/src/components/physic-paint/roto/rotoTimelineSelectors.ts, app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineModel.test.ts, app/src/lib/physicPaintBridge.test.ts
- **Why not caught:** No pre-existing gate exercised a complete break-bearing physical document across child hydration, live timeline projection, and launch republishing; no-break fixtures passed and hid the field omission.
- **Recurrence guard:** Specified-oracle regression coverage in `app/src/lib/physicPaintBridge.test.ts`, `app/src/components/physic-paint/hooks/useRotoTimelineModel.test.ts`, and `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` fails when break ownership or Loop Clips are omitted and passed in the full 1,554-test Vitest gate.

---
