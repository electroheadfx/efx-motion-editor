---
phase: 35-interactive-physics-paint-controls
plan: 06
subsystem: ui
tags: [physics-paint, tauri, apply-back, persistence, uat]
requires:
  - phase: 35-interactive-physics-paint-controls
    provides: interactive physics paint editor-to-standalone workflow and rendered-output apply-back foundation
provides:
  - Native Tauri apply-result handling for physics paint standalone apply completion
  - Tauri-first editable state save with visible success/cancel/error feedback
  - Physic-paint source.layerId persistence and hydration regression coverage
  - Native physics paint window launch route for the app-hosted standalone surface
affects: [physics-paint, tauri-windowing, project-persistence, uat]
tech-stack:
  added: []
  patterns:
    - Tauri event-bus apply-result listener with operationId matching
    - User-selected editable state JSON save via Tauri dialog/fs with browser fallback
key-files:
  created:
    - app/public/img/paper_1.jpg
    - app/public/img/paper_2.jpg
    - app/public/img/paper_3.jpg
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - packages/efx-physic-paint/demo/src/Toolbar.tsx
    - packages/efx-physic-paint/demo/src/styles.css
    - app/src-tauri/capabilities/default.json
    - app/src-tauri/src/lib.rs
    - app/src-tauri/tauri.conf.json
    - app/src/stores/projectStore.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/main.tsx
    - package.json
key-decisions:
  - "Save state remains editable physics paint JSON import/export, separate from rendered-output apply-back."
  - "The package demo keeps Tauri plugins as runtime-only dynamic imports so its browser build remains dependency-clean."
patterns-established:
  - "Native apply results are consumed by the standalone via PHYSIC_PAINT_APPLY_RESULT_EVENT and matched by operationId."
  - "Hydrated physic-paint layers must retain source.layerId equal to the layer id for editor apply validation."
requirements-completed: [PAINT-01, PAINT-02, PAINT-03, PAINT-04, DIAG-01]
duration: 35min
completed: 2026-06-09
---

# Phase 35: Interactive Physics Paint Controls — Plan 06 Summary

**Physics paint UAT gap closure for native apply-result completion, editable state save feedback, and hydrated layer identity validation**

## Performance

- **Duration:** 35 min active close-out in this session; prior production commits existed from an interrupted run
- **Started:** 2026-06-09T15:00:00Z
- **Completed:** 2026-06-09T15:20:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 13

## Accomplishments

- Persisted and hydrated physic-paint `source.layerId`, with regression coverage proving a reloaded layer is accepted by apply validation.
- Routed native Tauri physics paint apply-result events into standalone completion handling so matching canvas/sequence operations clear the timeout path.
- Added Tauri-first Save state behavior with native save dialog, JSON writing, browser fallback, and visible success/cancel/error feedback in both toolbar surfaces.
- Added the app-hosted `/physics-paint` route/window setup and public paper assets required by the native standalone window.

## Task Commits

1. **Task 1: Persist and hydrate physic-paint source.layerId for editor apply validation** - `66ad345` (test)
2. **Task 2: Route native Tauri apply-result events into standalone apply completion** - `ab29c41` (fix)
3. **Task 3: Make Save state Tauri-first with visible feedback** - `56d1a86` (fix; also closed remaining native route/assets work from the interrupted run)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Consumes native apply-result events and routes matching operation results through existing apply status UI.
- `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` - Saves editable state via Tauri dialog/fs when available, with visible feedback and browser fallback.
- `app/src/components/physic-paint/physicsPaintStudio.css` - Adds toolbar status feedback styling.
- `packages/efx-physic-paint/demo/src/Toolbar.tsx` - Mirrors Save state feedback while keeping Tauri plugins as dynamic runtime-only imports.
- `packages/efx-physic-paint/demo/src/styles.css` - Adds demo toolbar status feedback styling.
- `app/src-tauri/capabilities/default.json` - Adds physics paint window capability coverage and `dialog:allow-save`.
- `app/src-tauri/src/lib.rs` - Adds native physics paint window open command and launch context emission.
- `app/src-tauri/tauri.conf.json` - Labels the main window for targeted event transport.
- `app/src/stores/projectStore.ts` - Persists physic-paint `layer_id` source identity.
- `app/src/lib/physicPaintBridge.ts` - Uses native launch command, apply listener, and validation updates.
- `app/src/lib/physicPaintBridge.test.ts` - Covers hydrated physic-paint source identity and native launch behavior.
- `app/src/main.tsx` - Routes `/physics-paint` to the standalone studio and installs editor-side apply listener in the main app.
- `app/public/img/paper_1.jpg`, `app/public/img/paper_2.jpg`, `app/public/img/paper_3.jpg` - App-hosted paper textures for the native standalone route.

## Decisions Made

- Followed the plan’s separation of concerns: Save/Load remains editable state import/export; app apply-back remains rendered output only.
- Kept package demo Tauri integration lazy via `import(/* @vite-ignore */ ...)` to avoid adding app-only Tauri plugin dependencies to the standalone package build.

## Deviations from Plan

### Auto-fixed Issues

**1. Demo build dependency boundary**
- **Found during:** Task 3 verification (`pnpm --filter @efxlab/efx-physic-paint demo:build`)
- **Issue:** Static Tauri plugin imports in the package demo toolbar caused Vite/Rollup to fail resolving app-only dependencies.
- **Fix:** Switched the demo toolbar to runtime-only dynamic imports guarded by the Tauri environment check.
- **Files modified:** `packages/efx-physic-paint/demo/src/Toolbar.tsx`
- **Verification:** `pnpm --filter @efxlab/efx-physic-paint demo:build` passes.
- **Committed in:** `56d1a86`

---

**Total deviations:** 1 auto-fixed
**Impact on plan:** Necessary to keep the standalone package demo buildable without expanding scope or changing the transport contract.

## Issues Encountered

- The exact plan test command `pnpm --dir app test --run app/src/lib/physicPaintBridge.test.ts` found no test files because the path is app-prefixed while running inside `app/`. Reran the equivalent app-relative command `pnpm --dir app test --run src/lib/physicPaintBridge.test.ts`, which passed.
- Live UAT was not run in this session because project instructions say not to run the server. Sequence apply slowness was not measured live; transport verification is automated and UAT should retest with the user’s running app.

## Verification

- `pnpm --dir app test --run src/lib/physicPaintBridge.test.ts` — passed, 15 tests.
- `pnpm --dir app typecheck` — passed.
- `pnpm --filter @efxlab/efx-physic-paint check` — passed.
- `pnpm --filter @efxlab/efx-physic-paint demo:build` — passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 35 gap blockers are ready for verification/UAT rerun. The user should retest UAT Tests 4, 5, 6, 7, 8, and 9 from `35-UAT.md` in their live app session.

## Self-Check: PASSED

- All three plan tasks are covered by committed code/test changes.
- Key created files exist on disk.
- Required automated validation commands pass, with the app-relative test path noted above.
- Apply-back remains rendered-output-only, while Save/Load remains editable physics paint state JSON.

---
*Phase: 35-interactive-physics-paint-controls*
*Completed: 2026-06-09*
