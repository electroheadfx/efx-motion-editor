---
phase: quick-260729-taj-close-milestone-audit-gap-edit-02-b-01-i
plan: 01
subsystem: infra
tags: [physics-paint, frame-sync, timeline, startup, tdd, vitest]

# Dependency graph
requires:
  - phase: v0.8.0 milestone audit
    provides: EDIT-02/B-01 gap identification — installPhysicPaintFrameSyncListener defined and unit-tested in physicPaintBridge.ts but with zero production callers
provides:
  - Editor startup installs installPhysicPaintFrameSyncListener alongside the five sibling Physics Paint listeners
  - Startup-level regression coverage proving installation and valid seek-event routing to timelineStore.seek/ensureFrameVisible
affects: [physics-paint, standalone-window, timeline-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Startup regression testing: stub window/document globals, capture addEventListener registrations, dynamic-import main.tsx once per suite (no vi.resetModules — module identity must match statically imported stores)"

key-files:
  created:
    - app/src/main.test.ts
  modified:
    - app/src/main.tsx

key-decisions:
  - "Startup suite imports main.tsx once in beforeAll without vi.resetModules: resetting the registry rebinds main.tsx to fresh store instances the statically imported timelineStore spy cannot observe"

patterns-established:
  - "main.tsx startup regression harness: manual globalThis.window/document stubs plus vi.mock only for side-effectful imports; real bridge install functions and real stores remain the subjects under test"

requirements-completed: [QUICK-260729-TAJ]

coverage:
  - id: D1
    description: "Editor startup installs the physic-paint:seek-frame frame-sync listener alongside the five sibling Physics Paint listeners"
    requirement: QUICK-260729-TAJ
    verification:
      - kind: unit
        ref: "app/src/main.test.ts#completes editor startup and registers at least one window message listener"
        status: pass
    human_judgment: false
  - id: D2
    description: "A valid { type: 'physic-paint:seek-frame', frame: N } message routes to timelineStore.seek(N) and timelineStore.ensureFrameVisible(N) exactly once each"
    requirement: QUICK-260729-TAJ
    verification:
      - kind: unit
        ref: "app/src/main.test.ts#routes a valid physic-paint:seek-frame message to the editor timeline"
        status: pass
    human_judgment: false
  - id: D3
    description: "Existing bridge coverage (physicPaintBridge.test.ts including D-26 frame-sync block) remains green; typecheck and build gates pass"
    requirement: QUICK-260729-TAJ
    verification:
      - kind: unit
        ref: "cd app && pnpm exec vitest run src/main.test.ts src/lib/physicPaintBridge.test.ts"
        status: pass
      - kind: other
        ref: "cd app && pnpm run typecheck && pnpm run build"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-29
status: complete
---

# Quick 260729-taj: Close Milestone Audit Gap EDIT-02/B-01 Summary

**Editor startup now installs the physic-paint:seek-frame frame-sync listener in main.tsx, restoring standalone-window navigation seek to the editor timeline, with startup-level regression coverage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-29T19:18:26Z
- **Completed:** 2026-07-29T19:22:59Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- main.tsx installs installPhysicPaintFrameSyncListener in the editor startup branch alongside the five sibling Physics Paint listener installs (gap B-01 closed at main.tsx:31-39 install block)
- New app/src/main.test.ts startup regression suite proves installation and valid seek-event routing to timelineStore.seek(7)/ensureFrameVisible(7), with sibling listeners proven not to double-route the payload
- All gates green with existing configuration only: targeted vitest (2 files, 33 passed / 1 skipped), tsc --noEmit, vite build

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing startup regression test (RED)** - `e832b45f` (test)
2. **Task 2: Install installPhysicPaintFrameSyncListener in main.tsx (GREEN)** - `ed590d2b` (fix)

**Plan metadata:** handled by orchestrator (docs commit)

## Files Created/Modified
- `app/src/main.test.ts` - Startup regression suite: stubs window/document, captures addEventListener registrations, imports main.tsx, asserts message listeners exist and a valid seek-frame payload routes to the editor timeline
- `app/src/main.tsx` - Added installPhysicPaintFrameSyncListener to the physicPaintBridge named import (alphabetical order) and one synchronous install call after installPhysicPaintThumbnailEncodeListener, with a comment documenting the standalone-window seek routing

## Decisions Made
- Startup suite imports main.tsx once in beforeAll without vi.resetModules. A registry reset between tests re-evaluates main.tsx against fresh store module instances while the test file's statically imported timelineStore spy still targets the original instance — the routing assertion would then observe nothing. Startup runs once per process in production, so a single import per suite matches reality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced store module mocks with a spy on the real paintStore**
- **Found during:** Task 1 (RED scaffold bring-up)
- **Issue:** The plan-prescribed `vi.mock('./stores/paintStore', ...)` factory only exported `{ paintStore }`, but projectStore.ts imports `_setPaintMarkDirtyCallback` from paintStore at module scope, so the mock broke the real store graph (`No "_setPaintMarkDirtyCallback" export is defined on the mock`). The same risk applied to the canvasStore/uiStore mocks.
- **Fix:** Dropped all three store module mocks; spy on `paintStore.initFromPreferences` (plain object literal method) with mockResolvedValue before importing main.tsx. canvasStore/uiStore are only touched inside menu callbacks that the tests never invoke, so the real modules are harmless.
- **Files modified:** app/src/main.test.ts
- **Verification:** Test A (startup sanity) passes; RED failure is isolated to the documented seek-spy assertion
- **Committed in:** `e832b45f` (part of Task 1 test commit)

**2. [Rule 3 - Blocking] Import timelineStore before paintStore to respect the circular store graph**
- **Found during:** Task 1 (RED scaffold bring-up)
- **Issue:** With paintStore as the first static import, the paintStore <-> projectStore circular edge evaluated projectStore's module-scope `_setPaintMarkDirtyCallback(...)` call before paintStore's function binding was initialized (`TypeError: _setPaintMarkDirtyCallback is not a function`). The existing bridge test enters the graph via timelineStore, which evaluates projectStore first and completes paintStore evaluation before the callback wiring runs.
- **Fix:** Reordered the test file's static imports to `timelineStore` then `paintStore`, matching the proven entry order of physicPaintBridge.test.ts.
- **Files modified:** app/src/main.test.ts
- **Verification:** Suite collects and runs; no module-scope errors
- **Committed in:** `e832b45f` (part of Task 1 test commit)

**3. [Rule 1 - Bug] Single startup import per suite instead of per-test import with vi.resetModules**
- **Found during:** Task 1 (RED scaffold bring-up)
- **Issue:** Per-test dynamic import plus vi.resetModules caused the second import of main.tsx to bind to a fresh paintStore instance, bypassing the initFromPreferences spy and firing a real Tauri store load (unhandled rejection); the same rebind would have made the Test B timelineStore spy permanently blind even after the GREEN fix.
- **Fix:** Moved stub setup and the main.tsx import into beforeAll, kept spy restoration in afterEach, and restore window/document globals in afterAll. Documented the rationale inline in the test file.
- **Files modified:** app/src/main.test.ts
- **Verification:** Clean RED run — Test A passes, Test B fails only on `expected "seek" to be called 1 times, but got 0 times`, zero unhandled errors; GREEN run passes both tests after Task 2
- **Committed in:** `e832b45f` (part of Task 1 test commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug) — all confined to the new test scaffold; the production change remained exactly the audit-prescribed two-line remedy
**Impact on plan:** Test-scaffold corrections only; no production scope creep. main.tsx diff is exactly the planned import plus one synchronous install call.

## Issues Encountered
- None beyond the scaffold deviations above; the RED state matched the plan's prediction precisely (Test A green, Test B red on the missing startup install).

## User Setup Required
None - no external service configuration required.

## Threat Flags
None — the plan only wires the already-tested fail-closed guard (isPhysicPaintFrameSyncMessage) into startup; no new network endpoints, auth paths, or schema changes.

## Next Phase Readiness
- EDIT-02/B-01 integration blocker cleared; standalone Physics Paint window navigation now seeks the editor timeline at app startup
- Milestone audit gap register can mark EDIT-02 satisfied and B-01 closed
- Native visible confirmation of the seek behavior belongs to user-run UAT if desired; no automated coverage gaps remain for this flow

## Self-Check: PASSED

- FOUND: app/src/main.test.ts
- FOUND: app/src/main.tsx (contains installPhysicPaintFrameSyncListener import + call)
- FOUND: commit e832b45f (test RED)
- FOUND: commit ed590d2b (fix GREEN)

---
*Phase: quick-260729-taj-close-milestone-audit-gap-edit-02-b-01-i*
*Completed: 2026-07-29*
