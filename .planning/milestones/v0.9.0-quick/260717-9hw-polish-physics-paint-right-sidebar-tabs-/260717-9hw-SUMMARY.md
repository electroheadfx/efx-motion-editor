---
phase: quick-260717-9hw-polish-physics-paint-right-sidebar-tabs
plan: 01
subsystem: ui-testing
tags: [preact, vitest, physics-paint, scripts, sidebar, accessibility]
requires:
  - phase: quick-260716-dby
    provides: Durable project-scoped Roto script library and immutable clipboard contracts
provides:
  - Native-approved two-pane Physics Paint sidebar with a keyboard/pointer GripHorizontal separator
  - Transactional durable script activation and guarded selected-preset Load + Apply behavior
  - Focused and broad regression coverage for the final approved sidebar behavior
affects: [phase-36.14, physics-paint, roto-scripts, right-sidebar]
tech-stack:
  added: []
  patterns: [transactional load before selection, explicit event-handler composition, behavioral adapter lifecycle tests]
key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/lib/physicPaintRotoDurableCore.test.ts
key-decisions:
  - "Keep Brush color, Tool, and conditional LOG in the upper independently scrolling pane; keep Onion, Motion, and Scripts in the lower pane."
  - "Use a 28px Lucide GripHorizontal separator with pointer dragging, ArrowUp/ArrowDown resizing, a local 50/50 initial split, and a 20-80 clamp."
  - "Preserve row activation as load-only; Paintbrush alone reloads the selected preset and invokes the existing Apply path once after successful load."
patterns-established:
  - "Right-sidebar UI contracts verify exact labels, ordering, accessibility handlers, overflow bounds, and responsive breakpoints without a one-off test configuration."
requirements-completed: [QUICK-260717-9HW]
coverage:
  - id: D1
    description: Exact upper/lower mixed-case tab groups and bounded two-pane GripHorizontal layout
    requirement: QUICK-260717-9HW
    verification:
      - kind: unit
        ref: app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
        status: pass
      - kind: manual_procedural
        ref: Native visible UAT approved 2026-07-17
        status: pass
    human_judgment: true
    rationale: Final native layout, scrolling, and resize feel required visual interaction approval.
  - id: D2
    description: Transactional repeated durable-preset activation preserves prior selection and clipboard on failure
    requirement: QUICK-260717-9HW
    verification:
      - kind: unit
        ref: app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Replacement Apply eligibility, full-row activation, disabled Play, and reload-before-one-Apply wiring
    requirement: QUICK-260717-9HW
    verification:
      - kind: unit
        ref: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
        status: pass
      - kind: unit
        ref: app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
        status: pass
      - kind: unit
        ref: app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
        status: pass
    human_judgment: false
duration: 24min
completed: 2026-07-17
status: complete
uat_approved: 2026-07-17
---

# Quick 260717-9hw: Physics Paint Right Sidebar and Scripts Polish Summary

**Native-approved split Physics Paint sidebar with exact mixed-case tabs, transactional durable script loading, and a 20-80 clamped Lucide GripHorizontal resize seam locked by focused and full-suite regressions.**

## Performance

- **Duration:** 24 min post-UAT execution
- **Started:** 2026-07-17T10:25:00Z
- **Completed:** 2026-07-17T10:49:00Z
- **Tasks:** 1 post-UAT regression task
- **Test files created/modified:** 7
- **Native visible UAT:** Approved 2026-07-17

## Accomplishments

- Locked the exact approved upper tab group (`Brush color`, `Tool`, conditional `LOG`) and lower tab group (`Onion`, `Motion`, `Scripts`) with no uppercase transformation.
- Locked two independently vertically scrollable sidebar panes with a local 50/50 initial split and a 28px `GripHorizontal` separator supporting pointer drag, ArrowUp/ArrowDown resizing, and 20-80 clamping.
- Added controller regressions proving repeated load-only activation, selection-after-clipboard-replacement, immutable clipboard replacement, and failure preservation/reporting.
- Bound prepared durable replacements to the exact preparation token and immediately invalidated source, engine, launch, disposal, and unmount lifecycle changes before stale promises can publish clipboard or library state.
- Added replacement-destination eligibility coverage for real, empty, wrong-mode, generated, and busy destinations without requiring a pre-existing clipboard.
- Completed resize drag ownership by filtering initiating pointer IDs and releasing capture through pointerup, cancel, lost capture, explicit cleanup, unmount, and replacement drag paths.
- Preserved the approved six-control Scripts toolbar, callback-free disabled Play, full-row pointer/Enter/Space activation, reload-before-one-Apply ordering, responsive bounds, and existing durable/timeline behavior.

## Production Commits

1. `a4421d30` — feat(260717-9hw): polish Physics Paint scripts sidebar
2. `68ab25ab` — fix(260717-9hw): group Tool with Brush color tabs
3. `f8a7807c` — feat(260717-9hw): add resizable sidebar panes
4. `691ec923` — fix(260717-9hw): refine sidebar resize handle

## Test Commit

1. `8bd752e1` — test(260717-9hw): lock approved sidebar interactions

## Review Fix Commits

1. `787aedc7` — fix(260717-9hw): secure transactional script load and apply
2. `89152ae6` — fix(260717-9hw): clean up sidebar resize drags
3. `b2058c9f` — fix(260717-9hw): bind prepared script replacement tokens
4. `d84d02c0` — fix(260717-9hw): complete resize pointer cleanup
5. `96ee16df` — fix(260717-9hw): preserve prepared library lifecycle

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts` — Exact tab groups, mixed-case labels, two-pane scrolling, GripHorizontal resize behavior, toolbar/wiring contracts, and responsive overflow bounds.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` — Pointer ownership, capture release, lost-capture, replacement-drag, and unmount cleanup behavior.
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts` — Production adapter token forwarding, request settlement, stale silence, bridge redetection, timeout, disposal, and late-result coverage.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` — Repeated activation, transaction ordering, malformed/request/replacement failure preservation, status, and LOG coverage.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` — Replacement availability, exact-token ownership, lifecycle invalidation, immutable clipboard, and exactly-once prepared Apply coverage.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` — Updated mixed-case tabs, six-control toolbar, inert Play, and full-row activation contracts.
- `app/src/lib/physicPaintRotoDurableCore.test.ts` — Updated mounted native contract lookup to the approved mixed-case `Onion` label.

## Verification

- Final-review focused hook/library/clipboard tests: **3 files, 46 tests passed**.
- Related Studio/right-panel/controller group: **7 files, 109 tests passed**.
- Physics Paint subtree: **46 files, 362 tests passed**.
- Full app Vitest: **83 files passed, 3 skipped; 865 tests passed, 2 skipped, 101 todo**.
- App typecheck: **passed**.
- App Vite production build: **passed**.
- `packages/efx-physic-paint` check: **passed**.
- `packages/efx-physic-paint` build: **passed**.
- `git diff --check`: **passed**.
- Final-review findings `CR-01`, `CR-02`, `WR-01`, and `WR-02`: **fixed and committed**. The live adapter now forwards the exact preparation token, stale prepared completions publish no status/LOG, cleanup settles every pending request once, and behavioral composition tests cover the production seams.

Known non-failing output remains unchanged: third-party missing-source sourcemap warnings and expected headless Tauri/audio diagnostics during the full app run.

## Decisions Made

- The final approved layout is two local scroll regions, not one full-panel scroll region.
- Tool remains grouped with Brush color and conditional LOG in the upper pane; Onion, Motion, and Scripts remain in the lower pane.
- The separator is an accessible horizontal separator with a visible Lucide grip, not a thin implicit border.
- Regression tests extend existing seams and add one narrowly named right-sidebar contract file; no alternate Vitest configuration was introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated mounted durable-core test lookup for approved mixed-case label**
- **Found during:** Full app Vitest gate
- **Issue:** The pre-existing mounted native harness still searched for `ONION`, so 18 tests failed after the production label was intentionally approved as `Onion`.
- **Fix:** Updated the mounted button lookup to the exact approved mixed-case label.
- **Files modified:** `app/src/lib/physicPaintRotoDurableCore.test.ts`
- **Verification:** Isolated durable-core suite passed 52 tests with 1 skipped; full app suite passed.
- **Committed in:** `8bd752e1`

---

**Total deviations:** 1 auto-fixed blocking test seam.
**Impact on plan:** Required to align an existing mounted contract with the native-approved UI label; no production scope change.

## Known Stubs

- Disabled `Play Script` is intentional and callback-free. Script playback remains unavailable by approved scope; the disabled control communicates this explicitly.

## Threat Flags

None. Test-only changes added no network, filesystem, authentication, schema, or native-authority surface.

## Issues Encountered

- Initial full-suite run exposed the stale uppercase mounted test selector described above; production behavior was already correct and native-approved.
- Initial test fixture used an invalid WebP payload/canonical ID combination; the fixture was corrected to use the existing validated schema path.

## User Setup Required

None.

## Next Phase Readiness

- Quick 260717-9hw is complete, native-approved, and regression-verified.
- Phase 36.14 can consume the finalized right-sidebar and durable Scripts presentation contracts.

## Self-Check: PASSED

- Summary exists at the canonical quick-task path.
- Production commits `a4421d30`, `68ab25ab`, `f8a7807c`, and `691ec923` exist.
- Test commit `8bd752e1` exists.
- All listed test files exist and all required gates passed.

---
*Quick: 260717-9hw*
*Completed: 2026-07-17*
