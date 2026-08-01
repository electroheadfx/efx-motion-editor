---
phase: 35-interactive-physics-paint-controls
plan: 01
subsystem: app physics paint contracts
tags: [physics-paint, contracts, store, rendered-output, tdd]
dependency_graph:
  requires: [Phase 34 standalone demo shell, app layer model, paintStore invalidation pattern]
  provides: [physic-paint layer type, rendered-output apply payload contracts, physic paint rendered frame store]
  affects: [app/src/types/layer.ts, app/src/types/physicPaint.ts, app/src/stores/physicPaintStore.ts, app/src/stores/projectStore.ts]
tech_stack:
  added: []
  patterns: [Preact Signals store, runtime payload guards, rendered-output-only handoff, Vitest TDD]
key_files:
  created:
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
  modified:
    - app/src/types/layer.ts
    - app/src/stores/projectStore.ts
    - app/package.json
    - app/src/components/canvas/PaintCursor.tsx
    - app/src/components/sidebar/SidebarProperties.tsx
decisions:
  - Added physic-paint as a distinct additive layer/source type rather than overloading existing paint.
  - App-side apply contracts accept rendered PNG data URLs only and reject editable strokes, engine, project, and internals fields.
  - Rendered physics output is stored in an in-memory layer/frame Map with a dedicated physicPaintVersion invalidation signal.
metrics:
  duration: TBD
  completed_date: 2026-06-08
  tasks_completed: 2
  tests_added: 9
---

# Phase 35 Plan 01: App-Side Physics Paint Contracts Summary

## One-liner

Distinct `physic-paint` layer contracts and rendered-output-only frame storage now exist for the editor-to-standalone apply workflow.

## What Changed

- Added `physic-paint` as a sibling `LayerType` and `LayerSourceData` entry without changing the existing `paint` source contract.
- Added `app/src/types/physicPaint.ts` with launch context, rendered frame, still apply, sequence apply, apply result, readiness state types, clamp helpers, and runtime guards.
- Added `app/src/stores/physicPaintStore.ts` using a `Map<string, Map<number, PhysicPaintRenderedFrame>>` and `physicPaintVersion` signal for visual invalidation.
- Wired physics paint rendered-output mutations into `projectStore.markDirty()` through the same late-bound callback pattern used by existing paint/audio/image stores.
- Added Vitest coverage for payload validation, rendered-output-only rejection, frame-count clamping, still placement, sequence frame placement, mutation version bumps, clear, and reset behavior.
- Added missing app package scripts for `pnpm --dir app test` and `pnpm --dir app typecheck`, matching plan verification commands.

## Task Results

| Task | Name | Status | Commits | Verification |
|------|------|--------|---------|--------------|
| 1 | Add distinct physic-paint layer and rendered-output payload contracts | Complete | 6ab8110, 661b71c | `pnpm --dir app test --run src/types/physicPaint.test.ts`; `pnpm --dir app typecheck` |
| 2 | Implement rendered physics paint store with version invalidation | Complete | 70aa6c1, 736fc35 | `pnpm --dir app test --run src/stores/physicPaintStore.test.ts`; `pnpm --dir app typecheck` |

## Verification

- `pnpm --dir app test --run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts` passed with 9 tests.
- `pnpm --dir app typecheck` passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added app package verification scripts**
- **Found during:** Task 1 RED verification
- **Issue:** The plan required `pnpm --dir app test` and `pnpm --dir app typecheck`, but `app/package.json` did not expose those scripts.
- **Fix:** Added `test: vitest` and `typecheck: tsc --noEmit` scripts so plan verification commands run consistently.
- **Files modified:** `app/package.json`
- **Commit:** 6ab8110

**2. [Rule 3 - Blocking issue] Installed locked workspace dependencies**
- **Found during:** Task 1 RED verification
- **Issue:** `vitest` was unavailable because workspace `node_modules` were absent in the worktree.
- **Fix:** Ran `pnpm install --frozen-lockfile` using the existing lockfile. No new packages or package names were introduced.
- **Files modified:** none
- **Commit:** none

**3. [Rule 3 - Blocking issue] Fixed pre-existing unused symbols blocking typecheck**
- **Found during:** Task 1 GREEN verification
- **Issue:** `pnpm --dir app typecheck` failed on unused `zoom` in `PaintCursor.tsx` and unused `ArrowRight` in `SidebarProperties.tsx`.
- **Fix:** Removed the unused destructured prop/import without changing behavior.
- **Files modified:** `app/src/components/canvas/PaintCursor.tsx`, `app/src/components/sidebar/SidebarProperties.tsx`
- **Commit:** 661b71c

## Known Stubs

None found in files created or modified by this plan.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: apply-payload-validation | app/src/types/physicPaint.ts | New standalone/apply payload trust boundary validates kind, operationId, layerId, startFrame, frameCount, and rendered PNG data before app store mutation. |
| threat_flag: editor-visible-frame-mutation | app/src/stores/physicPaintStore.ts | New store mutates editor-visible rendered frame output by layer and app frame, guarded by typed apply payload validation. |

## Auth Gates

None.

## TDD Gate Compliance

- RED commits: `6ab8110`, `70aa6c1`
- GREEN commits: `661b71c`, `736fc35`
- REFACTOR commits: none needed

## Self-Check: PASSED

- Created files exist: `app/src/types/physicPaint.ts`, `app/src/types/physicPaint.test.ts`, `app/src/stores/physicPaintStore.ts`, `app/src/stores/physicPaintStore.test.ts`.
- Modified files exist: `app/src/types/layer.ts`, `app/src/stores/projectStore.ts`, `app/package.json`, `app/src/components/canvas/PaintCursor.tsx`, `app/src/components/sidebar/SidebarProperties.tsx`.
- Task commits exist: `6ab8110`, `661b71c`, `70aa6c1`, `736fc35`.
- Verification passed: 9 targeted tests and app typecheck.
