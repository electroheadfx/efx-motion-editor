# Phase 36.14 Deferred Items

Tracking technical debt and deviations from plans that downstream plans must resolve. Updated after Plan 36.14-03 execution.

## After Plan 36.14-03 (Clean Physical Cutover)

### Deleted test files — Plan 36.14-13 must recreate from scratch

Plan 36.14-03 deleted 6 test files that imported from the removed `rotoSourceDisplayModel.ts` or tested the old mixed-settings controller signature. The plan's prohibition on test-file deletion conflicted with its requirement to delete the production module and pass typecheck; the executor resolved this as a Rule 3 blocking-issue auto-fix rather than stopping at a Rule 4 architectural checkpoint.

| Deleted file | Tested behavior | Replacement owner |
|---|---|---|
| `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts` | source/display projection (removed) | No replacement — behavior is gone |
| `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts` | legacy key controller with source/display | Plan 36.14-13 must create new test against physical resolver |
| `app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts` | legacy key transactions with source/display | Plan 36.14-13 must create new test against physical transactions |
| `app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts` | legacy session with source/display callbacks | Plan 36.14-13 must create new test against physical session contract |
| `app/src/lib/physicPaintRotoDurableCore.test.ts` | legacy durable core with source/display | Plan 36.14-13 must create new test against physical durable core |
| `app/src/components/physic-paint/hooks/useRotoInterpolationController.test.ts` | old mixed-settings controller (inBetweenCount, deform, position) | Plan 36.14-13 must create new test against enabled-only controller |

**Note:** Plan 36.14-13's original scope was "transfer every still-valid stale-wrapper assertion to final production-owner tests, delete six tests whose production modules were removed, rewrite the surviving interpolation-controller test". Since the 6 tests are already deleted, Plan 36.14-13 now needs to CREATE the replacement tests from scratch rather than transfer assertions. The plan should be revised before execution.

### Inlined legacy helpers — Plans 36.14-06 through 36.14-08 must remove

Plan 36.14-03 inlined thin wrapper helpers from `rotoSourceDisplayModel.ts` into legacy modules that are assigned to later plans. The ripple LOGIC is unchanged — only import paths and helper locations changed. These inlined helpers must be removed when the owning plans migrate these modules to the physical resolver.

| File | Inlined helpers | Owning plan |
|---|---|---|
| `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts` | `normalizeRealSourceFrames`, `createRotoSourceDisplayModelLegacy`, `getRotoDisplayProjectionLegacy`, `resolveRotoRealKeySaveTargetLegacy` | 36.14-06 (Insert/Delete) and 36.14-07 (Drag) |
| `app/src/components/physic-paint/roto/rotoKeyTransactions.ts` | (same helpers, used by key transactions) | 36.14-06 (Insert/Delete) |

**Marker:** Search for `createRotoSourceDisplayModelLegacy` and `getRotoDisplayProjectionLegacy` to find all inlined helper sites.

### Retained legacy seams — Plan 36.14-06 must remove

Plan 36.14-03 retained legacy source/display seams as optional fields in session and Studio for backward compat with `useRotoKeyUtilities` (not in plan 03's declared files, assigned to 36.14-06). These violate the plan's prohibition on "compatibility alias, dual write, coordinate translation" but were necessary to pass typecheck without declaring `useRotoKeyUtilities` in plan 03's scope.

| File | Retained legacy fields | Owning plan |
|---|---|---|
| `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` | `resolveSourceFrameForDisplayFrame?`, `resolveDisplayFrameForSourceFrame?`, `resolvePasteTargetForDisplayFrame?` (optional callbacks) | 36.14-06 |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `sourceFrame`, `displayFrame`, `inBetweenCount`, `sourceDisplayFrame` references; `resolveRotoSourceFrameForDisplayFrame` callback; `getCurrentSettings` returns old mixed-settings shape | 36.14-06 |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Physical input getters wired but not consumed by action logic | 36.14-06 through 36.14-08 |

### Known stubs — Plans 36.14-04/06 must wire

| File | Stub | Owning plan |
|---|---|---|
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `onRotoInterpolationCountChange` is a no-op (D-02 removes inBetweenCount; count is derived) | 36.14-15 (UI integration) may remove the prop entirely |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | `getRotoKeyRecords`, `getRotoInterpolationState`, `getPhysicalCells`, `getSelectedKeyId`, `getCurrentAppFrame` wired but not consumed | 36.14-06 through 36.14-08 connect operation delivery |
| `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts` | `selectedKeyId`, `selectedRealKey`, `currentCell` accepted as input but not used for stale-identity revalidation | 36.14-04 (coordinator) and 36.14-06 wire identity-based editing |

### State file corrections applied after merge

- `REQUIREMENTS.md`: `36.14-DOWNSTREAM-PARITY` reverted from `[x] Complete` to `[ ] Pending`. Plan 03 only did the current-state boundary; full downstream parity (persistence, cache, playback, preview, export, rendering) is owned by 36.14-09/10.
- `ROADMAP.md`: The 36-08..36-11 checkoffs added by the executor's `roadmap.update-plan-progress` are CORRECT (SUMMARY files exist, commits present). This was a pre-existing tracking gap that the executor fixed incidentally. No revert needed.
- `STATE.md`: Plan counter correctly advanced from 3 to 4 of 18. No correction needed.

### Requirement status caveat

The following 36.14 requirements were marked `[x] Complete` by plans 36.14-01/02 and remain `[x]` after plan 03. They may be partially complete (the identity/interpolation model is defined, but full "across edits, persistence, cache, reopen, preview, export, rollback, Undo, Redo" coverage is not yet done):

- `36.14-PHYSICAL-IDENTITY` — marked complete by 36.14-01, but full cross-scenario identity preservation waits on 36.14-04 through 36.14-10
- `36.14-DERIVED-INTERPOLATION` — marked complete by 36.14-02, but persistence of enabled-only state waits on 36.14-09
- `36.14-ATOMIC-FRAME-MAPPING` — marked complete (unclear which plan); owned by 36.14-04 (not yet executed)
- `36.14-RIPPLE-INSERT-DELETE` — marked complete (unclear which plan); owned by 36.14-06 (not yet executed)
- `36.14-RIPPLE-DRAG` — marked complete (unclear which plan); owned by 36.14-07 (not yet executed)
- `36.14-FORCE-SPACING` — marked complete (unclear which plan); owned by 36.14-08 (not yet executed)

These pre-existing `[x]` marks were NOT changed by plan 03. They should be reviewed by the user or verifier to determine if they represent premature completion claims.