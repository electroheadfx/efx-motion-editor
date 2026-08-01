---
phase: 35-interactive-physics-paint-controls
plan: 04
plan_name: Apply Bridge and Preview Rendering
subsystem: physics-paint-apply-preview
tags: [physics-paint, apply-bridge, preview-renderer, tauri-events, tdd]
dependency_graph:
  requires: [35-01, 35-02, 35-03]
  provides:
    - app/src/lib/physicPaintBridge.ts apply payload listener and result feedback
    - app/src/lib/physicPaintBridge.test.ts focused apply-back bridge tests
    - app/src/lib/previewRenderer.ts physic-paint rendered-frame compositing
  affects:
    - app/src/components/Preview.tsx subscribes to physicPaintVersion for redraws
tech_stack:
  added: []
  patterns: [Preact Signals version invalidation, Tauri event listener fallback, Canvas 2D compositing]
key_files:
  created:
    - app/src/lib/physicPaintBridge.test.ts
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/previewRenderer.ts
    - app/src/components/Preview.tsx
decisions:
  - Physics paint apply-back transports rendered PNG output only; editable strokes and engine internals are rejected before mutation.
  - Duplicate successful apply delivery is deduplicated by operationId to prevent double mutation while still returning success feedback.
metrics:
  completed_date: "2026-06-08"
  duration: "not measured"
  tasks_completed: 2
  files_changed: 4
commits:
  - hash: a5f1272
    message: "test(35-04): add failing tests for physics paint apply bridge"
  - hash: 2bf64a1
    message: "feat(35-04): implement physics paint apply bridge"
  - hash: c0b5723
    message: "feat(35-04): composite physics paint rendered frames"
---

# Phase 35 Plan 04: Apply Bridge and Preview Rendering Summary

Physics paint apply-back now validates standalone rendered output, writes it into editor state with operation-matched feedback, and composites applied frames in the editor preview.

## What Changed

### Task 1: Handle validated standalone apply transport and result feedback

Implemented and tested the standalone apply bridge in `app/src/lib/physicPaintBridge.ts` and `app/src/lib/physicPaintBridge.test.ts`.

- Added `PHYSIC_PAINT_APPLY_EVENT` and `PHYSIC_PAINT_APPLY_RESULT_EVENT` constants with code comments documenting the rendered-output-only contract.
- Added `applyPhysicPaintPayload(payload)` validation and mutation flow:
  - Rejects malformed payloads via `isPhysicPaintApplyPayload`.
  - Rejects unknown layer ids.
  - Rejects non-`physic-paint` targets and source/layer mismatches.
  - Rejects editable internals through the type validator before store mutation.
  - Applies still output with `physicPaintStore.applyCanvas`.
  - Applies generated output sequences with `physicPaintStore.applySequence`, preserving `startFrame + i` mapping.
- Added operationId dedupe for duplicate successful deliveries so repeated bridge events do not double-mutate state.
- Added `installPhysicPaintApplyListener(onResult?)` with Tauri listener support and browser/dev `CustomEvent` fallback cleanup.
- Added operationId-matched result feedback over `physic-paint:apply-result`.
- Added focused TDD coverage for success, rejection, duplicate delivery, and browser fallback result dispatch.

### Task 2: Composite physic-paint rendered frames in preview

Implemented preview rendering for applied physics paint outputs.

- Imported `physicPaintStore` and `physicPaintVersion` into `app/src/lib/previewRenderer.ts`.
- Added explicit `layer.type === 'physic-paint'` branch that:
  - Looks up rendered output by layer/frame.
  - Draws nothing safely when no output exists.
  - Loads rendered PNG data URLs into cached `HTMLImageElement`s.
  - Calls `onImageLoaded` for async load/error refresh.
  - Composites with the layer blend mode and effective opacity.
- Preserved the existing `layer.type === 'paint'` branch and p5.brush/perfect-freehand rendering paths.
- Updated `app/src/components/Preview.tsx` to subscribe to `physicPaintVersion` so apply-back mutations trigger redraws.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-aecff91b24ca83be9/app test --run src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts` passed.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-aecff91b24ca83be9/app typecheck` passed.

## TDD Gate Compliance

- RED commit: `a5f1272` added failing bridge tests before implementation.
- GREEN commit: `2bf64a1` implemented the apply bridge and made focused tests pass.
- Additional feature commit: `c0b5723` added preview compositing support.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed existing workspace dependencies from lockfile**
- **Found during:** Task 1 RED verification
- **Issue:** `vitest` was unavailable because `node_modules` was missing in the worktree.
- **Fix:** Ran `pnpm install --frozen-lockfile` using the committed lockfile. No new package was added and no package names were substituted.
- **Files modified:** None
- **Commit:** N/A

**2. [Rule 3 - Blocking] Used app-relative Vitest filter paths**
- **Found during:** Task 1 RED verification
- **Issue:** The plan's `pnpm --dir app test --run app/src/...` filter did not match tests when executed with `--dir app` because Vitest filters from the app package root.
- **Fix:** Verified with equivalent app-relative filters: `src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts`.
- **Files modified:** None
- **Commit:** N/A

**3. [Rule 2 - Missing critical functionality] Subscribed preview component to `physicPaintVersion`**
- **Found during:** Task 2 implementation
- **Issue:** Importing `physicPaintVersion` in `PreviewRenderer` alone was not sufficient for the main preview effect to redraw after apply-back mutations.
- **Fix:** Added a `physicPaintVersion.value` subscription in `app/src/components/Preview.tsx`, matching the existing paintVersion pattern.
- **Files modified:** `app/src/components/Preview.tsx`
- **Commit:** `c0b5723`

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None. The new transport and rendered-image trust boundaries were already covered by the plan threat model and mitigated with validation, typed constants, dedupe, cleanup, and scoped preview rendering.

## Deferred Issues

None.
