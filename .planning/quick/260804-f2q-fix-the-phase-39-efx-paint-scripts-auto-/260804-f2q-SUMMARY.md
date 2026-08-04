---
phase: 260804-f2q
plan: 01
subsystem: physic-paint
status: complete
tags: [roto, script-library, hydration, launch-context, regression-fix]
requirements:
  - HYDR-01
  - HYDR-02
  - HYDR-03
  - HYDR-04
  - HYDR-05
  - HYDR-06
dependency_graph:
  requires: [physics-paint-launch-bridge, roto-script-library]
  provides: [exact-payload-script-library-hydration]
  affects: [PhysicsPaintStudio, usePhysicsPaintLaunchIntegration, physicsPaintRotoScriptLibrary]
tech_stack:
  added: []
  patterns: [explicit-payload-handoff, exactly-once-hydration-marker, preact-signals]
key_files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
decisions:
  - updateProjectContext consumes only its payload argument; ports.getLaunchContext() is used exclusively by the manual refresh() path
  - exactly-once auto-scan marker (lastAutoHydratedKey) resets on context identity change and dispose
  - project-context bridge callback merges from peekLaunchContext() (committed render truth) and hands the exact payload to onSettledLaunchContext synchronously
metrics:
  duration: ~16 minutes
  completed: 2026-08-04
actuals:
  tokens: 3000
  tasks: 2
  commits: 3
---

# Phase 260804-f2q Plan 01: EFX Paint Scripts Auto-Hydration Fix Summary

Event-driven Scripts auto-hydration: the roto script library now hydrates from the exact authoritative project-context payload passed synchronously through the launch bridge, fixing the Phase 39 regression where a stale launch getter (`project.saved === false`) blocked the automatic scan.

## Root Cause (confirmed)

`usePhysicsPaintProjectContextBridge`'s callback wrapped the handoff in a state updater plus a deferred microtask handoff and discarded the exact `updated` payload; `rotoScriptLibrary.updateProjectContext()` then reread `ports.getLaunchContext()`, whose freshness depended on render-commit timing. The scan observed the stale unsaved state, cleared rows, and never ran. Manual Refresh only worked because it executes after the committed render.

## RED Proof

The four new regression tests were committed failing (commit `af008602`) before the controller change:
- `hydrates from the exact project context payload without reading the launch getter` — failed with 0 scans (expected 1), `canSave === false`: the ignored payload argument left the stale unsaved getter in charge.
- `auto-scans exactly once per context and keeps manual refresh explicit` — failed with 0 scans (expected 1).
- `rejects rows from a context replaced while its scan was in flight` — failed with 0 requests recorded (getter stayed unsaved, no scan ever issued).
- `clears rows and refuses persistence for an unsaved project context payload` — failed with 0 rows (expected 2 after hydration).

All failures were the root-cause reason (stale getter, zero scans), not unrelated errors. The 7 pre-existing tests passed throughout.

## What Changed

1. `physicsPaintRotoScriptLibrary.ts` — `updateProjectContext(context: PhysicPaintLaunchContext)` now computes identity and saved state from the payload only. `refresh()` was extracted into `refreshWithContext(context)`; `refresh()` and `enterScripts` call it with `ports.getLaunchContext()`, keeping byte-identical manual-Refresh behavior. A `lastAutoHydratedKey` marker guarantees exactly one auto-scan per authoritative context key; it resets in the shared context-identity reset branch and in `dispose()`. Unsaved payloads apply the same clearing branch and issue no request. Existing `execute()` generation/operationId staleness guards are untouched and reject replaced-context results.
2. `usePhysicsPaintLaunchIntegration.ts` — new `peekLaunchContext` input; the project-context bridge callback now reads committed truth, builds `{ ...current, project }`, calls `setLaunchContext(updated)` in object form, and invokes `onSettledLaunchContext?.(updated)` synchronously. The state-updater wrapper and its deferred microtask handoff were removed entirely.
3. `PhysicsPaintStudio.tsx` — passes `peekLaunchContext: () => launchContext` and `onSettledLaunchContext: (context) => { void rotoScriptLibrary.updateProjectContext(context); }`, so both the launch-settle path (exact hydrated context) and the project-context-event path (merged updated context) deliver the payload.

## Test Results

- `physicsPaintRotoScriptLibrary.test.ts`: 11/11 passed (4 new + 7 pre-existing, pre-existing assertions unmodified).
- Task 2 wiring suites: `usePhysicsPaintLaunchIntegration.test.ts` (6), `PhysicsPaintStudio.test.ts` (25), `PhysicsPaintScriptsPanel.test.ts` (21) — all passed unmodified (63 tests total across the four suites).
- Full app suite (`vitest run`): 96 files passed, 1014 tests passed, 0 failures (3 files / 1 test skipped pre-existing, 101 todo pre-existing).
- Typecheck (`tsc --noEmit`): passed.

## HYDR-06 Diff Gate

Added-lines scan over the full plan diff (base `e36d86cf` recorded in `.base-sha` before any commit) for `setTimeout|setInterval|requestAnimationFrame|queueMicrotask|advanceTimersByTime`: **count 0 — PASS**. The scan covers all added lines including comments and test names.

## Requirement Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| HYDR-01 | automated-ready | Regression test 1: exact payload hydrates rows with stale getter |
| HYDR-02 | automated-ready | Regression tests 1/2: `canSave === true`, `saveDisabledReason === null` from payload |
| HYDR-03 | automated-ready | Regression tests 2/3: exactly-once scan, stale replacement rejected, no duplicate listeners (existing unlisten cleanup untouched) |
| HYDR-04 | automated-ready | Regression test 4: unsaved payload clears rows, no request, Save stays disabled |
| HYDR-05 | automated-ready | Manual `refresh()`/`enterScripts` unchanged (shared `refreshWithContext` via getter); panel/studio contract suites pass unmodified |
| HYDR-06 | PASS | Diff gate counted 0 timing primitives; handoff is synchronous and payload-driven |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree missing dependencies and built workspace package**
- **Found during:** Task 1 RED run
- **Issue:** `vitest` not found; after `pnpm install`, `@efxlab/efx-physic-paint/animation` unresolved because the local workspace package had no `dist/`
- **Fix:** `pnpm install --frozen-lockfile` at the worktree root, then `pnpm run build` in `packages/efx-physic-paint`
- **Files modified:** none (build artifacts only)

**2. [Rule 1 - Bug] New Test 3 mock did not record the pending scan request**
- **Found during:** Task 1 GREEN run
- **Issue:** the `mockImplementationOnce` returning a pending promise bypassed the harness `requests.push`, so the scan-count assertion saw 1 request instead of 2
- **Fix:** push the input into `test.requests` inside the Once mock, matching the file's existing mock pattern
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` (new test only; no pre-existing assertion touched)

## Known Stubs

None.

## Threat Flags

None — no new trust-boundary surface beyond the plan's threat model; T-39-02/T-39-03 mitigations are pinned by regression tests 3 and 4.

## UAT Status (Task 3 — blocking human checkpoint)

**PENDING USER UAT.** Per project rule the executor does not run the server or drive the native UI. The native packaged-app checklist in the plan (Task 3) must be performed by the user:

1. HYDR-01: saved project with durable scripts — rows populated on Scripts-tab open without Refresh. **(pending)**
2. HYDR-02: Save Script enabled immediately when idle. **(pending)**
3. HYDR-04: unsaved project shows `Save the project first.`; saving while EFX Paint is open hydrates automatically. **(pending)**
4. HYDR-03: close/reopen 3 times — exactly one population per open, no duplicates/stale rows. **(pending)**
5. HYDR-05: manual Refresh rescans; Copy/Apply/Load+Apply/Play/rename/delete/selection unchanged; Scripts tab default-open unchanged. **(pending)**
6. HYDR-06: diff-gate count 0 confirmed (executor-reported above); no "wait a moment" step required by any checklist item. **(pending)**

Until the user approves this checklist, the task is automated-ready only; Phase 39's UAT gate is not yet satisfied.

## Commits

- `af008602` test(260804-f2q-01): add failing regression tests for exact-payload script library hydration (RED)
- `506d5624` feat(260804-f2q-01): hydrate script library from the exact project context payload (GREEN)
- `69007a01` feat(260804-f2q-01): pass exact merged context synchronously through the launch bridge

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
- FOUND: app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND commit: af008602
- FOUND commit: 506d5624
- FOUND commit: 69007a01
