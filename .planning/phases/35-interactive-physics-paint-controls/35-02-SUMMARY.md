---
phase: 35-interactive-physics-paint-controls
plan: 02
subsystem: editor physics paint entry point
tags: [physics-paint, bridge, sidebar, layer-menu, tdd]
dependency_graph:
  requires: [35-01 app physics paint contracts, app layer menu, sidebar properties routing]
  provides: [physic paint launch bridge, Physic Paint layer creation, physics paint sidebar entry point]
  affects: [app/src/lib/physicPaintBridge.ts, app/src/components/sidebar/PhysicPaintProperties.tsx, app/src/components/timeline/AddFxMenu.tsx, app/src/components/layout/LeftPanel.tsx]
tech_stack:
  added: []
  patterns: [Result-style UI bridge, dynamic Tauri imports, browser dev fallback, rendered-output-only workflow]
key_files:
  created:
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/components/sidebar/PhysicPaintProperties.tsx
  modified:
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/components/layout/LeftPanel.tsx
decisions:
  - The editor opens physics paint through a typed launch context and rejects non-physic-paint layers before any window action.
  - Browser/dev fallback uses a serialized launch context URL while Tauri runtime uses dynamic WebviewWindow/event APIs.
  - Physic Paint is added as a sibling paint-layer workflow and intentionally does not enter existing paint edit mode.
metrics:
  duration: TBD
  completed_date: 2026-06-08
  tasks_completed: 2
  tests_added: 4
---

# Phase 35 Plan 02: Editor Physics Paint Entry Point Summary

## One-liner

A distinct Physic Paint layer can now be created, inspected in the sidebar, and opened in the standalone physics paint canvas with current layer/frame context.

## What Changed

- Added `app/src/lib/physicPaintBridge.ts` with `PHYSIC_PAINT_LAUNCH_EVENT`, `createPhysicPaintLaunchContext`, and `openPhysicPaintCanvas`.
- Added bridge tests covering launch context creation, invalid layer rejection, browser fallback URL context, and launch event naming.
- Added `PhysicPaintProperties` sidebar UI with current layer/frame details, rendered-output status, required empty-state copy, bridge success/error diagnostics, and the exact `[open fx paint canvas]` CTA.
- Added a `Physic Paint` item to the PAINT layer menu using `type: 'physic-paint'` and `source: { type: 'physic-paint', layerId }`.
- Routed selected `physic-paint` layers to `PhysicPaintProperties` in `LeftPanel` before generic layer properties.

## Task Results

| Task | Name | Status | Commits | Verification |
|------|------|--------|---------|--------------|
| 1 | Create the typed bridge for opening the standalone canvas | Complete | 046a9b0, 51958f8 | `pnpm --dir app test --run src/lib/physicPaintBridge.test.ts`; `pnpm --dir app typecheck` |
| 2 | Add Physic Paint layer creation and sidebar properties entry point | Complete | 5e234e8 | `pnpm --dir app typecheck` |

## Verification

- `pnpm --dir app test --run src/lib/physicPaintBridge.test.ts` passed with 4 tests.
- `pnpm --dir app typecheck` passed.
- The dev server was not run, per project instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Installed locked workspace dependencies**
- **Found during:** Task 1 RED verification
- **Issue:** `vitest` was unavailable because workspace `node_modules` were absent in the worktree.
- **Fix:** Ran `pnpm install --frozen-lockfile` using the existing lockfile. No new packages or package names were introduced.
- **Files modified:** none
- **Commit:** none

**2. [Rule 1 - Bug] Added a test-local browser window shim**
- **Found during:** Task 1 GREEN verification
- **Issue:** Bridge tests that assert browser fallback behavior ran in Vitest's Node environment where `window` is undefined.
- **Fix:** Added a test-local `globalThis.window` shim with `open` and `location.origin`, restored after each test.
- **Files modified:** `app/src/lib/physicPaintBridge.test.ts`
- **Commit:** 51958f8

## Known Stubs

None found in files created or modified by this plan. The bridge intentionally does not implement apply-back listeners; Plan 35-04 owns apply payload handling.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: app-to-standalone-launch | app/src/lib/physicPaintBridge.ts | New app UI to standalone window trust boundary sends only typed layer/frame launch context, rejects non-`physic-paint` layers, and avoids editable stroke/engine transport. |
| threat_flag: project-layer-mutation | app/src/components/timeline/AddFxMenu.tsx | New layer creation mutates project state through the existing FX sequence path while preserving existing Paint / Rotopaint behavior. |

## Auth Gates

None.

## TDD Gate Compliance

- RED commit: `046a9b0`
- GREEN commit: `51958f8`
- REFACTOR commits: none needed

## Self-Check: PASSED

- Created files exist: `app/src/lib/physicPaintBridge.ts`, `app/src/lib/physicPaintBridge.test.ts`, `app/src/components/sidebar/PhysicPaintProperties.tsx`.
- Modified files exist: `app/src/components/timeline/AddFxMenu.tsx`, `app/src/components/layout/LeftPanel.tsx`.
- Task commits exist: `046a9b0`, `51958f8`, `5e234e8`.
- Verification passed: 4 bridge tests and app typecheck.
