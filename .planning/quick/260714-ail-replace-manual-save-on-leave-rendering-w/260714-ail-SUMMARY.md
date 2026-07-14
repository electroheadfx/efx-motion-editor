---
phase: quick-260714-ail
plan: 01
subsystem: physics-paint-roto
tags: [preact, canvas, roto, pixel-cache, persistence, vitest]
requires:
  - phase: quick-260714-9es
    provides: approved same-key Roto Clear behavior
provides:
  - event-driven automatic caching of completed live Roto alpha pixels
  - per-source-frame latest-revision acceptance with stale/removal protection
  - pixel-only durable Roto state with immediate navigation and no manual save lifecycle
affects: [physics-paint, roto-interpolation, onion-skin, preview, export, project-persistence]
tech-stack:
  added: []
  patterns: [completed-mutation callback, direct alpha canvas copy, frame-local revision transaction]
key-files:
  created:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts
    - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
    - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/physicPaintRotoDurableCore.test.ts
key-decisions:
  - "Automatic Roto commits copy the engine's already-rendered live alpha surface and never replay strokes or rerun physics."
  - "Flattened Roto pixels are durable; editable engine JSON remains active-session memory only, while Play persistence is unchanged."
  - "Roto navigation and close no longer wait for save/apply acknowledgement or expose pending, saving, retry, or manual-save state."
patterns-established:
  - "Frame-local latest-wins: bind source, revision, base, overlay, and dimensions before asynchronous encoding, then recheck immediately before store mutation."
  - "Cached-base repaint: compose flattened base first and live alpha overlay second without importing base pixels into Undo history."
requirements-completed: [QUICK-260714-AIL]
coverage:
  - id: D1
    description: "Completed editable-real-key mutations automatically cache exact alpha pixels with frame-local latest-wins ordering."
    requirement: QUICK-260714-AIL
    verification:
      - kind: integration
        ref: "app/src/lib/physicPaintRotoDurableCore.test.ts#automatic live pixel mutation commits through the mounted Studio engine seam without Save current"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Manual Roto save/save-on-leave lifecycle is removed while Play save behavior remains available."
    requirement: QUICK-260714-AIL
    verification:
      - kind: integration
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#automatic Roto pixel cache contract"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm --dir app exec vitest run"
        status: pass
    human_judgment: false
  - id: D3
    description: "Native visible behavior matches the twelve artist workflow checks below."
    requirement: QUICK-260714-AIL
    verification: []
    human_judgment: true
    rationale: "Canvas fidelity, navigation responsiveness, Undo feel, and reopened visual output require native user observation."
duration: resumed interrupted run
completed: 2026-07-14
status: complete
---

# Quick Task 260714-ail: Automatic Roto Pixel Cache Summary

**Completed Roto mutations now cache the exact existing alpha pixels through frame-local latest-wins transactions, with flattened pixels as the sole durable Roto paint truth and no manual save-on-leave lifecycle.**

## Accomplishments

- Added a completed-mutation engine seam and direct dry/display alpha copy that excludes preview base and paper/background.
- Added per-source-frame monotonic revisions, stale result rejection, removal precedence, and additive cached-base plus live-overlay composition.
- Removed Save current, Save pending, save-before-navigation/close, pending/saving/retry state, and dead Roto save/apply controllers.
- Preserved accepted Clear, absolute real-key identity, generated render-only frames, custom spacing, interpolation, onion, preview/export, and Play save behavior.
- Prevented Roto editable engine JSON from being written to durable store/project output while retaining Play-owned editable persistence.

## Task Commits

1. **Task 1: RED — define automatic Roto pixel cache contract** - `5ea97505`
2. **Task 2: GREEN — cache completed Roto pixels automatically** - `a6635b87`
3. **Task 3: REFACTOR — remove manual Roto save lifecycle** - `f5ad4212`

## Automated Verification

Passed:

- Focused automatic cache matrix: 100 passed, 1 pre-existing skipped.
- Secondary session/key/onion/persistence/bridge/store/preview/export matrix.
- Complete Physics Paint regression matrix.
- Full application Vitest suite via `vitest run`.
- `pnpm --filter @efxlab/efx-physic-paint check`.
- `pnpm --filter @efxlab/efx-physic-paint build`.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck`.
- `pnpm -C /Users/lmarques/Dev/efx-motion-editor build`.
- `git -C /Users/lmarques/Dev/efx-motion-editor diff --check`.

Expected non-failing test output still includes existing Tauri-listener warnings in the browser test harness and missing upstream Motion Canvas sourcemap warnings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded test sources from the package production typecheck**
- **Found during:** Task 3 final gate
- **Issue:** The package `check` command included test files even though Vitest is owned by the app workspace, causing unresolved `vitest` type imports.
- **Fix:** Excluded `src/**/*.test.ts(x)` from the package production tsconfig; tests continue to run through the app Vitest workspace.
- **Files modified:** `packages/efx-physic-paint/tsconfig.json`
- **Verification:** Package check/build and full app Vitest suite pass.
- **Committed in:** `f5ad4212`

**2. [Rule 1 - Bug] Updated stale manual-save regression contracts**
- **Found during:** Task 3 focused and full test gates
- **Issue:** Source-contract and mounted tests still required removed Save current/save-on-leave controls and durable Roto editable state.
- **Fix:** Replaced obsolete assertions with automatic pixel-cache, immediate-navigation, no-manual-save, and pixel-only durability contracts.
- **Files modified:** Physics Paint Studio, workflow strip, session, durable-core, bridge, and store tests.
- **Verification:** Focused, subsystem, and full application suites pass.
- **Committed in:** `f5ad4212`

## Known Stubs

None.

## Native UAT — Not Run

1. Paint a simple brush on an empty real frame, immediately navigate away, then return:
   the exact same visible paint is cached without pressing Save current.

2. Paint a rich/complex frame and navigate away:
   navigation remains immediate and no long second rendering operation occurs.

3. Paint several brushes, use the existing per-brush Undo repeatedly, then navigate away and return:
   every undone brush remains absent and the cache matches the visible post-Undo result.

4. Undo all brushes on a frame that was initially empty:
   the frame returns to empty and no stale cached paint remains.

5. Reopen an existing flattened cached key, add several new brushes, then use the existing per-brush Undo:
   only the new brushes are removed and the original flattened cached paint remains intact.

6. Undo all newly painted brushes on the reopened cached key:
   the visible result and cache both return exactly to the original flattened cached paint.

7. Paint on multiple frames in quick succession:
   each cached result remains attached to the correct source frame and no older result overwrites a newer one.

8. Close and reopen Physics Paint, then save and reopen the project:
   the latest flattened pixels remain; old brush JSON is not expected to remain editable.

9. Verify onion skin uses the latest cached paint.

10. Verify generated interpolation refreshes from the latest real-key paint without becoming editable.

11. Verify parent preview and export use the latest cached pixels.

12. Verify Play canvas still uses its existing save workflow.

## Self-Check: PASSED

- All three quick-task commits exist in Git history.
- Key created and modified files exist.
- Every mandated automated gate passed.
- Native UAT was intentionally not run.
