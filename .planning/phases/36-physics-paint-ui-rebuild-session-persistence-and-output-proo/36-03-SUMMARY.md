---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 03
subsystem: ui
tags: [preact, vitest, physics-paint, export, manifest]

requires:
  - phase: 35-interactive-physics-paint-controls
    provides: Standalone live physics paint frame capture and rendered frame contracts
provides:
  - Pure debug export helpers for still PNG proof metadata
  - Pure debug export helpers for frame-sequence manifest metadata
  - Vitest coverage for OUT-01 and OUT-02 proof behavior
affects: [phase-36-physics-paint-ui, debug-export, standalone-physics-paint]

tech-stack:
  added: []
  patterns:
    - Transform live captured PhysicPaintRenderedFrame payloads into dev-only proof metadata
    - Validate bounded PNG frame sequences before manifest generation

key-files:
  created:
    - app/src/components/physic-paint/physicsPaintDevExport.ts
    - app/src/components/physic-paint/physicsPaintDevExport.test.ts
  modified:
    - app/src/types/physicPaint.ts

key-decisions:
  - "Debug export remains a pure sidecar over live captured PNG data URLs; no headless renderer, AnimationPlayer creation, renderFromStrokes, or forceDryAll path was introduced."
  - "The existing rendered-frame guard is exported from app/src/types/physicPaint.ts so dev export helpers share bridge validation semantics."

patterns-established:
  - "Debug manifest helpers fail closed on empty frames, frameCount mismatches, non-PNG payloads, invalid sequential frame metadata, and frame counts outside clampPhysicPaintFrameCount bounds."

requirements-completed: [OUT-01, OUT-02, UI-REBUILD-02]

duration: 5min
completed: 2026-06-12
---

# Phase 36 Plan 03: Debug Export Proof Helpers Summary

**Dev-only physics paint PNG proof helpers transform live rendered frames into still metadata and bounded manifest.json frame-sequence metadata.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-12T15:09:00Z
- **Completed:** 2026-06-12T13:13:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added RED Vitest coverage for filename formatting, still PNG proof metadata, frame-sequence manifest metadata, invalid input rejection, and data URL decoding.
- Implemented `physicsPaintDevExport.ts` as a pure helper module operating only on existing `PhysicPaintRenderedFrame` data URLs captured from the live engine.
- Shared the existing `isPhysicPaintRenderedFrame` validation guard with the export helper so manifest/still export checks match bridge payload semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing dev-export helper tests** - `07de25e` (test)
2. **Task 2: Implement manifest and still export helpers** - `5d761c7` (feat)

**Plan metadata:** committed separately after summary creation.

_Note: This TDD plan used the required test then feat commit sequence._

## Files Created/Modified

- `app/src/components/physic-paint/physicsPaintDevExport.ts` - Pure debug export utility module for PNG still metadata, manifest.json metadata, stable frame filenames, and PNG data URL decoding.
- `app/src/components/physic-paint/physicsPaintDevExport.test.ts` - Vitest coverage for OUT-01/OUT-02 debug proof behavior and failure cases.
- `app/src/types/physicPaint.ts` - Exports `isPhysicPaintRenderedFrame` for shared validation use.

## Decisions Made

- Kept debug export as a dev-only sidecar helper layer over live engine capture data rather than adding UI workflow, a second renderer, or headless batch replay.
- Reused `clampPhysicPaintFrameCount` and `isPhysicPaintRenderedFrame` to enforce the plan threat mitigations for tampering and bounded output size.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built workspace physics paint package before app typecheck**
- **Found during:** Task 2 (Implement manifest and still export helpers)
- **Issue:** App typecheck could not resolve the workspace package exports for `@efxlab/efx-physic-paint` because `packages/efx-physic-paint/dist` was absent in this fresh worktree after offline dependency installation.
- **Fix:** Ran the existing workspace package build so TypeScript could resolve the package `exports` declarations, then re-ran app typecheck successfully.
- **Files modified:** none committed; generated package dist output is ignored/untracked outside task scope.
- **Verification:** `pnpm --dir="/Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a235efb922a56b1dc/app" typecheck` passed.
- **Committed in:** Not applicable; environment preparation only.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Verification environment preparation only; no product scope change.

## Issues Encountered

- The plan's pnpm command form with `--dir <path> vitest` is not accepted by pnpm 10.27.0 in this environment. Verification used the equivalent `pnpm --dir=".../app" exec vitest ...` form.
- `pnpm install --offline` initially updated `pnpm-lock.yaml`; that unintended lockfile change was reverted before commits. No dependency changes were committed.

## Verification

- `pnpm --dir="/Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a235efb922a56b1dc/app" exec vitest run src/components/physic-paint/physicsPaintDevExport.test.ts src/types/physicPaint.test.ts` — passed, 9 tests.
- `pnpm --dir="/Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a235efb922a56b1dc/app" typecheck` — passed.
- Forbidden-pattern audit on `physicsPaintDevExport.ts` found no `new AnimationPlayer`, `renderFromStrokes`, `forceDryAll`, or `@efxlab/efx-physic-paint/animation` import.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## TDD Gate Compliance

- RED gate commit exists: `07de25e`.
- GREEN gate commit exists after RED: `5d761c7`.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/physicsPaintDevExport.ts`.
- Found `app/src/components/physic-paint/physicsPaintDevExport.test.ts`.
- Found `app/src/types/physicPaint.ts`.
- Found task commit `07de25e`.
- Found task commit `5d761c7`.

## Next Phase Readiness

- Later Phase 36 UI plans can import `buildPhysicsPaintDebugManifest`, `buildPhysicsPaintStillExport`, `dataUrlToBlobPart`, and `makePhysicsPaintFrameFilename` from the helper module when wiring the collapsed dev-only top-bar export proof.
- No blockers remain for this plan.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-12*
