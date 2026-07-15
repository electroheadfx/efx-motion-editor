---
phase: quick-260715-j3q
plan: 01
subsystem: physics-paint
status: complete
tags: [undo, redo, cooperative-finalization, roto, preact, vitest]
dependency_graph:
  requires: [accepted-exact-undo, automatic-roto-live-pixel-cache]
  provides: [exact-ten-level-bidirectional-brush-history, redo-input-ui, redo-regressions]
  affects: [phase-36.14-copy-apply-script]
tech_stack:
  added: []
  patterns: [engine-owned-grouped-history, exact-checkpoint-transfer, successful-only-roto-ownership]
key_files:
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts
    - app/src/components/physic-paint/hooks/useRotoEditBufferController.ts
    - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts
    - app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts
    - app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
decisions:
  - Keep history owned by EfxPaintEngine and expose boolean undo/redo without introducing UI history state.
  - Restore finalized Redo from exact checkpoints and never replay the full paint script.
  - Preserve cached Roto bases by changing only successful live-overlay ownership.
metrics:
  duration: 11m39s
  completed: 2026-07-15
---

# Quick Task 260715-j3q: Exact 10-Level Physics Paint Undo/Redo Summary

Exact grouped per-brush Undo/Redo now transfers checkpoints or deferred finalization payloads bidirectionally, keeps script truth synchronized, and exposes successful-only Roto, keyboard, and rail integration without finalized script replay.

## Commits

1. `f2a9046b` — `feat(260715-j3q): add exact Physics Paint redo history`
2. `57f54d19` — `feat(260715-j3q): wire Physics Paint redo controls`
3. `47e735b5` — `test(260715-j3q): cover exact Physics Paint redo`
4. `cf0a336f` — `fix(260715-j3q): publish queued redo mutations`

## Automated Verification

| Gate | Result |
|---|---|
| Engine TypeScript compile | PASS — `pnpm --dir packages/efx-physic-paint exec tsc --noEmit` |
| Focused engine Vitest | PASS — final run: 2 files, 33 tests |
| Focused app Vitest | PASS — 4 files, 65 tests |
| Physics Paint/app Vitest gate | PASS — 36 files, 318 passed, 1 skipped |
| Full app Vitest | PASS — 72 files passed, 3 skipped; 770 passed, 1 skipped, 101 todo |
| Package check | PASS |
| Package build | PASS |
| App typecheck | PASS |
| Root build | PASS — package and app production builds |
| Git diff check | PASS |

The package-local `pnpm exec vitest` command from the plan is unavailable because Vitest is provided by the app workspace, so the same existing Vitest installation was run with `--root /Users/lmarques/Dev/efx-motion-editor` for package engine tests. Vitest 2.1.9 does not support the plan's `-x` alias; `--bail=1` was used for focused fail-fast runs. No dependency or test configuration was added.

## Delivered Behavior

- Grouped logical brush entries retain mutation identity, exact ordered actions including trailing continuation actions, and either an exact checkpoint or deferred finalization payload.
- Queued and active Redo requeue original work cooperatively; finalized Redo restores exact buffers directly without `redrawAll`, `renderFromStrokes`, `renderAllStrokes`, or full-script replay.
- Undo/Redo return boolean success and unavailable operations remain side-effect free.
- Successful finalized Redo publishes `CompletedPaintMutation.kind = 'redo'` after restored pixels are ready for automatic live-alpha capture.
- New accepted pointer-up transactions clear the Redo branch; discarded short strokes do not.
- Clear and load reset both history directions and stale finalization generation state.
- Cached-base Roto ownership is updated only after successful engine history operations; the flattened base/reference remains unchanged.
- Cmd/Ctrl+Z remains Undo; Cmd/Ctrl+Shift+Z and Ctrl+Y exclusively dispatch Redo.
- Redo is adjacent to Undo in the existing accessible tool rail and uses the mirrored existing Undo asset without new state architecture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the existing app Vitest binary for package tests**
- **Found during:** Task 3 focused engine verification
- **Issue:** The package has no local Vitest executable, and Vitest 2.1.9 rejects the `-x` alias.
- **Fix:** Ran the same repository Vitest installation from `app` with workspace root and `--bail=1`.
- **Files modified:** None
- **Commit:** N/A

**2. [Rule 1 - Bug] Preserved queued Redo publication without synchronous finalization**
- **Found during:** Task 3 completed-mutation timing review
- **Issue:** Deferred Redo had to publish the required `redo` mutation while still preserving cooperative non-blocking requeue behavior.
- **Fix:** Publish only after successful action/payload restoration and scheduling, without flushing or rasterizing the deferred job.
- **Files modified:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`, `packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts`
- **Commit:** `cf0a336f`

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. No new endpoint, authentication path, file-access boundary, dependency, or schema trust boundary was introduced.

## Native UAT A-G: APPROVED

The user approved native Undo/Redo UAT on 2026-07-15, including exact ordered restoration, queued/active responsiveness, Redo branch invalidation, the shared ten-transaction limit, cached-base overlay symmetry, visible-script parity, navigation reset safety, and the reactive Undo/Redo availability badges.

The dedicated Roto Copy Script / Apply Script quick is now the next prerequisite before Phase 36.14.

## Self-Check: PASSED

- All listed modified source and test files exist.
- Commits `f2a9046b`, `57f54d19`, `47e735b5`, and `cf0a336f` exist on `main`.
- Summary status is `complete`, and this planning artifact remains uncommitted as requested.
