---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 10
subsystem: physics-paint-session-persistence
tags: [physics-paint, tauri, save-dialog, editable-state, uat-gap-closure]
requires:
  - phase: 36-02
    provides: Editable Physics Paint JSON serialization helper with browser/injected-adapter download seam
  - phase: 36-08
    provides: Active rebuilt PhysicsPaintStudio workflow strip state actions
  - phase: 36-09
    provides: Latest active PhysicsPaintStudio source after onion gap closure
provides:
  - Tauri-native Save state path using plugin-dialog.save and plugin-fs.writeTextFile
  - Clean native cancel behavior with no filesystem write and no scary error state
  - Browser Blob/anchor download fallback outside Tauri or when native plugins are unavailable
  - Regression coverage for native save, cancel, fallback, and rendered-output exclusion
  - Active rebuilt PhysicsPaintStudio save handler that consumes structured save/cancel results
  - Editable-state-only JSON contract preserved from engine.save()
affects: [physics-paint-ui, standalone-physics-paint, save-load-session-state, uat-gap-6]
tech-stack:
  added: []
  patterns:
    - Dynamic Tauri plugin imports guarded by injected runtime detection
    - Structured save result status for success versus cancel
    - Test-injected native/browser adapters instead of real OS dialogs
key-files:
  created:
    - .planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-10-SUMMARY.md
  modified:
    - app/src/components/physic-paint/physicsPaintSessionFile.ts
    - app/src/components/physic-paint/physicsPaintSessionFile.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
key-decisions:
  - "Save state now prefers a Tauri native save adapter in desktop runtime and falls back to the existing browser download adapter when native APIs are unavailable."
  - "Native cancel is modeled as a structured non-error result so PhysicsPaintStudio clears lastError and does not report a failed save."
  - "Editable-state serialization remains strictly engine.save() output; rendered PNG/apply payload/frame output is excluded."
patterns-established:
  - "Use injected adapters in tests for native dialog/fs behavior rather than opening OS dialogs."
  - "Keep native filesystem writes limited to the exact path returned by plugin-dialog.save, and do not write on cancel."
requirements-completed: [SAVE-01, SAVE-02]
duration: 4min
completed: 2026-06-13
---

# Phase 36 Plan 10: Native Save State Dialog Summary

**Physics Paint Save state now opens a Tauri native JSON save dialog in desktop runtime while preserving browser editable-JSON download fallback.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-13T09:47:25Z
- **Completed:** 2026-06-13T09:50:25Z
- **Tasks:** 2
- **Files modified:** 3 production/test files plus this summary

## Accomplishments

- Added RED Vitest coverage for native save path selection, native cancel behavior, browser fallback, and rendered-output exclusion.
- Updated `downloadPhysicsPaintState` to dynamically load `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` only in detected Tauri runtime.
- Wrote editable JSON only to the user-selected path returned by the native save dialog.
- Preserved the browser Blob/anchor download adapter when Tauri runtime/plugins are unavailable.
- Updated active rebuilt `PhysicsPaintStudio.saveEditableState` so native cancel is informational and does not set `lastError`.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add native save adapter tests for Save state** - `b3c9b84` (test)
2. **Task 2 GREEN: Implement Tauri/native Save state path with browser fallback** - `9c496fe` (feat)

**Plan metadata:** pending final docs commit

_Note: Both plan tasks were marked `tdd="true"`; Task 1 committed the failing adapter/import-seam tests and Task 2 implemented the passing behavior._

## Files Created/Modified

- `app/src/components/physic-paint/physicsPaintSessionFile.test.ts` - Added injected native adapter tests for save path, cancel, fallback, and stricter rendered-output exclusion checks.
- `app/src/components/physic-paint/physicsPaintSessionFile.ts` - Added structured save results, native/browser adapter union, Tauri runtime detection, dynamic plugin imports, native JSON save dialog, fs write, cancel handling, and fallback download behavior.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Updated the active rebuilt Save state handler to treat cancel as non-error and success as the existing `Saved editable JSON state.` copy.
- `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-10-SUMMARY.md` - Execution summary and verification record.

## Decisions Made

- Kept the Tauri implementation inside `physicsPaintSessionFile.ts` rather than reactivating the legacy toolbar path, because the rebuilt Studio is the active source of truth.
- Used dynamic `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` imports with injected-global runtime detection so browser tests and browser development fallback do not require a real Tauri runtime.
- Modeled cancel separately from errors with `{ status: 'cancelled' }`, allowing UI state to remain calm and avoiding a failed-save error on intentional cancellation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The RED test failed as intended before implementation because the helper returned a string and accepted only a simple browser `save` adapter.
- Initial GREEN typecheck exposed TypeScript union narrowing on the adapter shape; narrowing was corrected to use the `browser` discriminator before committing Task 2.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None found in files created/modified by this plan. Existing local `null` and empty-array assignments in `PhysicsPaintStudio.tsx` are state initialization/reset patterns, not UI placeholder data.

## Threat Flags

None beyond the plan threat model. This plan adds a local desktop filesystem write surface, but it is exactly the planned Save state trust boundary and is mitigated by writing only to the path returned by `plugin-dialog.save` and writing nothing on cancel.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/physicsPaintSessionFile.test.ts` — passed, 1 file / 7 tests.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` — passed.
- `grep -n "plugin-dialog\|plugin-fs\|writeTextFile" /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintSessionFile.ts` — passed; Tauri plugin imports and `writeTextFile` are present.
- `! grep -n "data:image/png\|PhysicPaintRenderedFrame\|renderedFrame" /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintSessionFile.ts` — passed; editable-state helper contains no rendered-output payload fields.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/physicsPaintSessionFile.ts`.
- Found `app/src/components/physic-paint/physicsPaintSessionFile.test.ts`.
- Found `app/src/components/physic-paint/PhysicsPaintStudio.tsx`.
- Found task commit `b3c9b84` in git history.
- Found task commit `9c496fe` in git history.
- Created `36-10-SUMMARY.md` in the phase directory.

## Next Phase Readiness

UAT gap 6 is closed in source and tests. The remaining active Phase 36 work can proceed without changing editable state JSON format or adding rendered output to session files.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-13*
