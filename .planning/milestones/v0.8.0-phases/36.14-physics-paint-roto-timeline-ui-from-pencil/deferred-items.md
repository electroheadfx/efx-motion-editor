# Phase 36.14 Deferred Items

Tracking technical debt and deviations from plans that downstream plans must resolve. Updated after Plan 36.14-03 execution.

> All entries in this file were acknowledged (deferred) at the v0.9.0 milestone close (2026-08-21). The v0.9.0 milestone shipped the Roto physical-timeline model (Phases 43.x) that supersedes the 36.14 source/display seams listed below; these rows are retained as historical record.

## After Plan 36.14-03 (Clean Physical Cutover)

### Deleted test files — Plan 36.14-13 must recreate from scratch

Plan 36.14-03 deleted 6 test files that imported from the removed `rotoSourceDisplayModel.ts` or tested the old mixed-settings controller signature. The plan's prohibition on test-file deletion conflicted with its requirement to delete the production module and pass typecheck; the executor resolved this as a Rule 3 blocking-issue auto-fix rather than stopping at a Rule 4 architectural checkpoint.

- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts` — **Tested behavior:** source/display projection (removed). **Replacement owner:** no replacement, behavior is gone.
- `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts` — **Tested behavior:** legacy key controller with source/display. **Replacement owner:** Plan 36.14-13 must create new test against physical resolver.
- `app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts` — **Tested behavior:** legacy key transactions with source/display. **Replacement owner:** Plan 36.14-13 must create new test against physical transactions.
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts` — **Tested behavior:** legacy session with source/display callbacks. **Replacement owner:** Plan 36.14-13 must create new test against physical session contract.
- `app/src/lib/physicPaintRotoDurableCore.test.ts` — **Tested behavior:** legacy durable core with source/display. **Replacement owner:** Plan 36.14-13 must create new test against physical durable core.
- `app/src/components/physic-paint/hooks/useRotoInterpolationController.test.ts` — **Tested behavior:** old mixed-settings controller (inBetweenCount, deform, position). **Replacement owner:** Plan 36.14-13 must create new test against enabled-only controller.
- **Status:** acknowledged

**Note:** Plan 36.14-13's original scope was "transfer every still-valid stale-wrapper assertion to final production-owner tests, delete six tests whose production modules were removed, rewrite the surviving interpolation-controller test". Since the 6 tests are already deleted, Plan 36.14-13 now needs to CREATE the replacement tests from scratch rather than transfer assertions. The plan should be revised before execution.

### Inlined legacy helpers — Plans 36.14-06 through 36.14-08 must remove

Plan 36.14-03 inlined thin wrapper helpers from `rotoSourceDisplayModel.ts` into legacy modules that are assigned to later plans. The ripple LOGIC is unchanged — only import paths and helper locations changed. These inlined helpers must be removed when the owning plans migrate these modules to the physical resolver.

- **File:** `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts` — **Inlined helpers:** `normalizeRealSourceFrames`, `createRotoSourceDisplayModelLegacy`, `getRotoDisplayProjectionLegacy`, `resolveRotoRealKeySaveTargetLegacy`. **Owning plan:** 36.14-06 (Insert/Delete) and 36.14-07 (Drag).
- **File:** `app/src/components/physic-paint/roto/rotoKeyTransactions.ts` — **Inlined helpers:** (same helpers, used by key transactions). **Owning plan:** 36.14-06 (Insert/Delete).
- **Status:** acknowledged

**Marker:** Search for `createRotoSourceDisplayModelLegacy` and `getRotoDisplayProjectionLegacy` to find all inlined helper sites.

### Retained legacy seams — Plan 36.14-06 must remove

Plan 36.14-03 retained legacy source/display seams as optional fields in session and Studio for backward compat with `useRotoKeyUtilities` (not in plan 03's declared files, assigned to 36.14-06). These violate the plan's prohibition on "compatibility alias, dual write, coordinate translation" but were necessary to pass typecheck without declaring `useRotoKeyUtilities` in plan 03's scope.

- **File:** `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` — **Retained legacy fields:** `resolveSourceFrameForDisplayFrame?`, `resolveDisplayFrameForSourceFrame?`, `resolvePasteTargetForDisplayFrame?` (optional callbacks). **Owning plan:** 36.14-06.
- **File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — **Retained legacy fields:** `sourceFrame`, `displayFrame`, `inBetweenCount`, `sourceDisplayFrame` references; `resolveRotoSourceFrameForDisplayFrame` callback; `getCurrentSettings` returns old mixed-settings shape. **Owning plan:** 36.14-06.
- **File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — **Retained legacy fields:** physical input getters wired but not consumed by action logic. **Owning plan:** 36.14-06 through 36.14-08.
- **Status:** acknowledged

### Known stubs — Plans 36.14-04/06 must wire

- **File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — **Stub:** `onRotoInterpolationCountChange` is a no-op (D-02 removes inBetweenCount; count is derived). **Owning plan:** 36.14-15 (UI integration) may remove the prop entirely.
- **File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — **Stub:** `getRotoKeyRecords`, `getRotoInterpolationState`, `getPhysicalCells`, `getSelectedKeyId`, `getCurrentAppFrame` wired but not consumed. **Owning plan:** 36.14-06 through 36.14-08 connect operation delivery.
- **File:** `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts` — **Stub:** `selectedKeyId`, `selectedRealKey`, `currentCell` accepted as input but not used for stale-identity revalidation. **Owning plan:** 36.14-04 (coordinator) and 36.14-06 wire identity-based editing.
- **Status:** acknowledged

### State file corrections applied after merge

- `REQUIREMENTS.md`: `36.14-DOWNSTREAM-PARITY` reverted from `[x] Complete` to `[ ] Pending`. Plan 03 only did the current-state boundary; full downstream parity (persistence, cache, playback, preview, export, rendering) is owned by 36.14-09/10.
- `ROADMAP.md`: The 36-08..36-11 checkoffs added by the executor's `roadmap.update-plan-progress` are CORRECT (SUMMARY files exist, commits present). This was a pre-existing tracking gap that the executor fixed incidentally. No revert needed.
- `STATE.md`: Plan counter correctly advanced from 3 to 4 of 18. No correction needed.
- **Status:** acknowledged

### Requirement status caveat

The following 36.14 requirements were marked `[x] Complete` by plans 36.14-01/02 and remain `[x]` after plan 03. They may be partially complete (the identity/interpolation model is defined, but full "across edits, persistence, cache, reopen, preview, export, rollback, Undo, Redo" coverage is not yet done):

- `36.14-PHYSICAL-IDENTITY` — marked complete by 36.14-01, but full cross-scenario identity preservation waits on 36.14-04 through 36.14-10
- `36.14-DERIVED-INTERPOLATION` — marked complete by 36.14-02, but persistence of enabled-only state waits on 36.14-09
- `36.14-ATOMIC-FRAME-MAPPING` — marked complete (unclear which plan); owned by 36.14-04 (not yet executed)
- `36.14-RIPPLE-INSERT-DELETE` — marked complete (unclear which plan); owned by 36.14-06 (not yet executed)
- `36.14-RIPPLE-DRAG` — marked complete (unclear which plan); owned by 36.14-07 (not yet executed)
- `36.14-FORCE-SPACING` — marked complete (unclear which plan); owned by 36.14-08 (not yet executed)
- **Status:** acknowledged

These pre-existing `[x]` marks were NOT changed by plan 03. They should be reviewed by the user or verifier to determine if they represent premature completion claims.
