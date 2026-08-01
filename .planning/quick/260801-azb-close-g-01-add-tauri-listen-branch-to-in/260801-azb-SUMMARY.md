---
phase: quick-260801-azb-close-g-01-tauri-frame-sync-listen
plan: 01
subsystem: physic-paint-bridge
tags: [tauri, physics-paint, frame-sync, regression-tests, milestone-audit]
requires:
  - physicsPaintBridgeTransport sendPhysicPaintFrameSyncMessage (Tauri emit of 'physic-paint:seek-frame')
provides:
  - Native-mode frame sync from standalone Physics Paint window to editor timeline (G-01 closed)
  - CI-visible Tauri-path regression coverage for startup and bridge listener (G-02 closed)
affects:
  - app/src/lib/physicPaintBridge.ts
  - app/src/main.tsx
  - app/src/main.test.ts
  - app/src/lib/physicPaintBridge.test.ts
tech-stack:
  added: []
  patterns:
    - "Tauri listen branch first, DOM message fallback second (mirrors five sibling bridge listeners)"
    - "vi.hoisted Tauri listener registry to model the native emit path in the startup suite"
key-files:
  created: []
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/main.tsx
    - app/src/main.test.ts
    - app/src/lib/physicPaintBridge.test.ts
decisions:
  - "Literal event name 'physic-paint:seek-frame' used in the listen branch (publisher emits the literal; no new exported constant introduced)"
  - "main.test.ts DOM-message startup assertions replaced, not duplicated: browser fallback is unit-covered in physicPaintBridge.test.ts"
metrics:
  duration: "~6 minutes"
  completed: 2026-08-01
status: complete
actuals:
  tokens: 24000
  tasks: 2
  commits: 2
---

# Phase quick-260801-azb Plan 01: Close G-01 — Tauri listen branch for frame sync Summary

Native-mode frame sync restored: `installPhysicPaintFrameSyncListener` now registers a Tauri `listen` handler for `physic-paint:seek-frame` (payload guarded by `isPhysicPaintFrameSyncMessage`) before the unchanged DOM `message` fallback, and the startup suite models the native emit path so a future removal of the branch fails CI.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Add isTauriRuntime() + eventApi.listen branch to installPhysicPaintFrameSyncListener | 9ad75430 | app/src/lib/physicPaintBridge.ts, app/src/main.tsx, app/src/lib/physicPaintBridge.test.ts |
| 2 | Tauri-path regression coverage in startup suite and bridge unit tests (G-02) | 8c9defa1 | app/src/main.test.ts, app/src/lib/physicPaintBridge.test.ts |

## Verification

- Focused: `pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts src/main.test.ts` — 34 passed, 1 skipped (pre-existing skip).
- Full app suite: `pnpm --dir app exec vitest run` — 995 passed, 1 skipped, 101 todo (94 files passed, 3 skipped).
- Typecheck: `pnpm --dir app run typecheck` — green.
- Regression proof (G-01/G-02): with the Task 1 `isTauriRuntime()` listen branch temporarily removed, all three new Tauri-path tests failed (2 in main.test.ts, 1 in physicPaintBridge.test.ts); branch restored via `git checkout -- <file>` and suites re-verified green.

## Deviations from Plan

### Environment setup (Rule 3 - blocking issue)

**1. [Rule 3 - Blocking] Installed workspace dependencies and built `@efxlab/efx-physic-paint` in the worktree**
- **Found during:** Task 1 verification
- **Issue:** Fresh worktree had no `node_modules` (vitest not found), and after `pnpm install --frozen-lockfile`, 7 unrelated test files failed to resolve `@efxlab/efx-physic-paint/preact` / `/animation` entries because the workspace package's `dist/` was not built.
- **Fix:** `pnpm install --frozen-lockfile` at the worktree root, then `pnpm --filter @efxlab/efx-physic-paint build`. No source code changed; no lockfile changes; no commits involved.
- **Files modified:** none (generated `node_modules` and `packages/efx-physic-paint/dist` are gitignored).

### Auto-fixed Issues

None — plan executed exactly as written.

## Threat Model Notes

- T-260801-azb-01 (Tampering, mitigate): satisfied — the Tauri branch routes payloads through the existing `isPhysicPaintFrameSyncMessage` guard inside `handlePhysicPaintFrameSyncMessage`; no new unvalidated surface.
- T-260801-azb-02 (Spoofing, accept): unchanged — Tauri events are confined to the app's own webviews and `timelineStore.seek` clamps to the valid frame range.
- No new threat flags: the change adds a subscriber on an existing event, no new endpoints, auth paths, or schema changes.

## Known Stubs

None.

## Self-Check

- FOUND: app/src/lib/physicPaintBridge.ts (Tauri branch present at installPhysicPaintFrameSyncListener)
- FOUND: app/src/main.tsx (awaited install at call site)
- FOUND: app/src/main.test.ts (Tauri registry + rewritten tests)
- FOUND: app/src/lib/physicPaintBridge.test.ts (Tauri-branch unit test)
- FOUND: commit 9ad75430 (Task 1)
- FOUND: commit 8c9defa1 (Task 2)

## Self-Check: PASSED
