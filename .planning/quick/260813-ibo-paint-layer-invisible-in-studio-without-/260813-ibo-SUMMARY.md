---
phase: quick-260813-ibo-paint-layer-invisible-in-studio-without-
plan: 01
subsystem: rendering
tags: [physic-paint, studio-preview, export-renderer, frameMap, overlay-compositing]
requires:
  - app/src/lib/frameMap.ts getTimelineOverlaySequenceOutFrame roto display-end extension
  - app/src/stores/physicPaintStore.ts layerId-keyed physical render-source authority
provides:
  - renderGlobalFrame composites overlay/FX sequences even when the current global frame has no content frameMap entry
  - Regression contract: paint-only project (empty frameMap) renders the physic-paint layer, in-session and after simulated reopen
affects:
  - app/src/lib/exportRenderer.ts renderGlobalFrame control flow
tech-stack:
  added: []
  patterns:
    - "Content-render gating separated from overlay compositing: hasContentEntry flag guards content pass only"
key-files:
  created: []
  modified:
    - app/src/lib/exportRenderer.ts
    - app/src/lib/exportRenderer.test.ts
decisions:
  - "Overlay renderFrame calls pass an empty frames array fallback and the overlay sequence's own fps when no content entry exists; safe because resolveLayerSource only consumes frames/fps for base-layer image-sequence and video sources, never for physic-paint overlays"
  - "startExport 'No frames to export' for paint-only projects left unchanged (explicit non-goal; user reported Studio visibility only)"
metrics:
  duration: ~10min
  completed: 2026-08-13
  tasks: 3 of 3 (task 3 native UAT approved by user 2026-08-13)
  commits: 2
actuals:
  tokens: 12000
  tasks: 3
  commits: 2
status: complete
---

# Quick 260813-ibo Plan 01: Paint Layer Invisible in Studio Without Timeline Key Photos — Summary

**One-liner:** renderGlobalFrame restructured so overlay/FX compositing is independent of content frameMap entries — physic-paint layers render in Studio with zero Timeline key photos, in-session and after save/reopen.

## What Was Built

`renderGlobalFrame` (app/src/lib/exportRenderer.ts) previously aborted the entire render when the current global frame had no content-sequence entry in `frameMap` (`frameIndex >= fm.length`, missing entry, or `seq.kind === 'fx'`), which also skipped the overlay compositing block that draws FX/paint sequences. A project with zero Timeline key photos has an empty `frameMap`, so Studio rendered nothing even though `totalFrames` already reported the paint layer's full span.

The fix is a minimal control-flow restructure:

1. `if (frameIndex < 0) return;` kept as a hard guard (negative frames render nothing, including overlays).
2. Entry/sequence lookup made null-safe; derived `hasContentEntry = !!seq && seq.kind !== 'fx'`. The cross-dissolve check and the normal content render are wrapped in `if (hasContentEntry) { ... }` with `seqStart` / `seqFrames` / `localFrame` / `handledByCrossDissolve` hoisted but only meaningfully computed inside that block.
3. Overlay compositing block left unconditional; its two `renderFrame` calls now pass `hasContentEntry ? seqFrames : []` and the overlay sequence's own fps (`overlaySeq.fps`) instead of the content sequence's frames/fps.
4. No changes to `frameMap`, `totalFrames`, `Preview.tsx`, `exportEngine.ts`, hydration (`hydrateFromMce` / `loadFromMceOutputs`), or any store. No synthetic content entries.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — failing regression tests proving the paint-only render gate | 87426421 | app/src/lib/exportRenderer.test.ts |
| 2 | GREEN — restructure renderGlobalFrame overlay independence | e071775c | app/src/lib/exportRenderer.ts |
| 3 | Native UAT checkpoint | approved by user (2026-08-13) | — |

## Verification (automated)

- RED gate: Tests A and B failed before the fix with "renderFrame not called" (proving the gate); guard test passed; no other test regressed.
- GREEN gate: `pnpm vitest run src/lib/exportRenderer.test.ts src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/previewRenderer.test.ts src/lib/previewRenderer.loops.test.ts src/lib/frameMap.test.ts` — 57 passed, 28 todo, 0 failed.
- `pnpm typecheck` — clean.

## Deviations from Plan

None — plan executed exactly as written.

## Known Boundaries (explicit non-goals, per plan)

- `startExport` still reports "No frames to export" for a paint-only project because it totals `fm.length` — the user reported Studio visibility only; export of paint-only projects is out of scope for this fix.

## TDD Gate Compliance

- RED commit `87426421` (test) precedes GREEN commit `e071775c` (fix). Fail-fast rule honored: both RED tests failed for the expected reason before implementation.

## Native UAT Status

**APPROVED by the user on 2026-08-13.** All 4 verification steps passed:

1. Paint-only project (no Timeline key photo): paint content visible in Studio at painted frames and while scrubbing — PASS.
2. Save, close, reopen: paint layer visible again without adding a Timeline key photo — PASS.
3. Regression spot-check: project with Timeline key photos + paint layer renders unchanged — PASS.
4. Playback spot-check: Play on the paint-only project shows painted frames during playback — PASS.

## Self-Check: PASSED

- FOUND: commit 87426421 (test)
- FOUND: commit e071775c (fix)
- FOUND: app/src/lib/exportRenderer.ts, app/src/lib/exportRenderer.test.ts modified as claimed
