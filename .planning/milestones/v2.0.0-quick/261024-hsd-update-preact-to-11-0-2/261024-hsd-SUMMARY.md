---
phase: quick-261024-hsd
plan: 261024-hsd
subsystem: dependency-maintenance
tags: [preact, pnpm, lockfile, dependency-bump, preact-11, signals, workspace, supply-chain]

# Dependency graph
requires:
  - phase: Phase 54
    provides: adoption of the preact 11 line (11.0.1) and the one-preact-copy contract pin
provides:
  - preact 11.0.2 resolved from the root pnpm override, the app exact pin, and the efx-physic-paint dev pin
  - a regenerated pnpm-lock.yaml whose only 11.0.x resolution is preact@11.0.2
  - exactly one preact copy on disk (node_modules/.pnpm/preact@11.0.2); no 11.0.1 resolution remains
affects: [future preact bumps, efx-physic-paint preact surface, release builds, the one-copy law]

# Actuals (#2632) — pairs with the plan's `estimate` (30000 tokens) to calibrate future estimates.
actuals:
  tokens: 2102   # chars/4 over the realized diff (8,408 chars)
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One manifest triple, one resolution: root pnpm.overrides + app exact pin + efx-physic-paint dev pin move together, so pnpm resolves a single preact copy"
    - "Baseline-first gate diagnosis: temporarily restore the previous manifests/lockfile, re-run the failing files, then restore HEAD — proving pre-existing vs bump-caused before changing anything"

key-files:
  created: []
  modified:
    - package.json
    - app/package.json
    - packages/efx-physic-paint/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Bumped only preact and its lockfile entries; @preact/signals, @preact/preset-vite and lucide-preact peer ranges already accept 11.0.2, so no unrelated upgrade rides along"
  - "App keeps the exact pin form (11.0.2, no caret); efx-physic-paint peerDependencies.preact stays >=11.0.0"
  - "Removed only the unreferenced node_modules/.pnpm/preact@11.0.1 directory created by the baseline diagnostic; no other virtual-store entry touched"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "The workspace resolves exactly one preact copy at 11.0.2 (root override, app exact pin, efx-physic-paint dev pin, lockfile, virtual store)"
    verification:
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec node -p \"require('preact/package.json').version\" => 11.0.2"
        status: pass
      - kind: other
        ref: "pnpm --filter @efxlab/efx-physic-paint exec node -p \"require('preact/package.json').version\" => 11.0.2"
        status: pass
      - kind: other
        ref: "grep -o 'preact@11\\.0\\.[0-9]*' pnpm-lock.yaml | sort -u => preact@11.0.2 only"
        status: pass
      - kind: other
        ref: "find node_modules app/node_modules -maxdepth 3 -type d -name 'preact@11.0.*' => preact@11.0.2 only"
        status: pass
      - kind: other
        ref: "pnpm -r why preact => preact 11.0.2 only"
        status: pass
    human_judgment: false
  - id: D2
    description: "The one-preact-copy contract pin stays green on the bumped manifests"
    verification:
      - kind: unit
        ref: "app/src/preactSingleCopyContract.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The workspace gates stay green after the bump (app typecheck, efx-physic-paint check, full vitest run including the production-build contract)"
    verification:
      - kind: automated_ui
        ref: "pnpm --filter @efxlab/efx-physic-paint run check => exit 0"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/viteBuild.test.ts => 11 passed (real cold production build)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck => exit 2, 15 pre-existing errors (identical on preact 11.0.1)"
        status: fail
      - kind: unit
        ref: "full vitest run => 5824 passed, 10 pre-existing failures in 7 files (identical on preact 11.0.1)"
        status: fail
    human_judgment: true
    rationale: "The plan's automated verify exits 1 on a documented pre-existing baseline (15 typecheck errors, 10 test failures) reproduced identically on the pre-bump preact 11.0.1 tree; a human should confirm the bump is accepted despite the unchanged baseline."

# Metrics
duration: 3min
completed: 2026-10-24
status: complete
plan_head_before: d98a401569bbc54190a542f2080b5af0eb0d8b36
plan_head_after: 0b15de7c973a33f63a2ac84bdadc980a21923a5e
commits: 1
---

# Quick 261024-hsd: Update Preact to 11.0.2 Summary

**Workspace moved to preact 11.0.2 on all three manifest surfaces with a regenerated lockfile; exactly one preact copy remains on disk and the gates show the unchanged pre-existing baseline.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-24T10:52:52Z
- **Completed:** 2026-10-24T10:55:57Z
- **Tasks:** 2 (Task 2 is verification-only; no edits)
- **Files modified:** 4

## Accomplishments

- `pnpm.overrides.preact` = `^11.0.2` (root), `dependencies.preact` = `11.0.2` (app, exact), `devDependencies.preact` = `^11.0.2` (efx-physic-paint); the package peer stays `>=11.0.0`.
- `pnpm-lock.yaml` regenerated by `pnpm install`: the only 11.0.x resolution is `preact@11.0.2`, with the new registry integrity hash and peer suffixes (`@preact/signals`, `@prefresh/*`, `lucide-preact`, `@preact/preset-vite`) moved onto it; no new package, install script, or transitive dependency entered the graph.
- On-disk resolution proof: both workspace probes print `11.0.2`, the virtual store holds only `preact@11.0.2`, `pnpm -r why preact` reports only `preact 11.0.2`, and the unreferenced `preact@11.0.1` store directory left by the baseline diagnostic was removed.
- The one-preact-copy contract pin reports 6/6 passed; the real cold production-build contract (`viteBuild.test.ts`) passes 11/11 on the bumped tree.
- No component, store, IPC, Rust, test, or config source was edited.

## Task Commits

1. **Task 1: Bump preact to 11.0.2 on all three manifest surfaces and regenerate the lockfile** - `0b15de7c` (chore)
2. **Task 2: Prove the bumped workspace still passes its gates** - no commit (verification-only, no edits)

## Files Created/Modified

- `package.json` - `pnpm.overrides.preact` `^11.0.1` -> `^11.0.2`
- `app/package.json` - `dependencies.preact` `11.0.1` -> `11.0.2` (exact pin kept)
- `packages/efx-physic-paint/package.json` - `devDependencies.preact` `^11.0.1` -> `^11.0.2`; `peerDependencies.preact` unchanged at `>=11.0.0`
- `pnpm-lock.yaml` - regenerated: `preact@11.0.2` only, updated integrity hash, peer suffixes re-keyed

## Decisions Made

- Bumped preact only; `@preact/signals` (2.11.3), `@preact/preset-vite` (2.10.6) and `lucide-preact` (^1.57.0) stay put because their peer ranges already accept the patch — mixing unrelated upgrades would violate the no-scope-creep constraint.
- Kept the app's exact-pin form and the package's `>=11.0.0` peer exactly as planned.
- Deleted only the unreferenced `node_modules/.pnpm/preact@11.0.1` directory (created by the baseline diagnostic) after confirming zero lockfile references and that every symlink resolves to `11.0.2`.

## Deviations from Plan

None — the three manifest edits and the lockfile regeneration match the plan's target table exactly. The pre-existing gate failures are reported below, not repaired, per the plan's Task 2 instruction.

## Issues Encountered

**Pre-existing app typecheck baseline (unchanged by this bump).** `pnpm --filter efx-motion-editor run typecheck` exits 2 with the same 15 errors documented before this quick in `261023-l35-SUMMARY.md` (six files: `projectPaperRaster.test.ts` 9, `physicsPaintRotoBackgroundValidatorParity.test.ts` 2, `physicPaintBridge.ts` 1, `PhysicsPaintPalette.test.ts` 1, `PaperPicker.tsx` 1, `usePhysicsPaintEngineActions.test.ts` 1). Zero errors mention preact or JSX runtime types.

**Pre-existing vitest failures (unchanged by this bump).** The full `vitest run` exits 1 with `7 failed | 320 passed | 2 skipped` files and `10 failed | 5824 passed` tests. The identical ten failures were reproduced on the pre-bump tree by temporarily restoring the 11.0.1 manifests and lockfile and re-running the same seven files (`10 failed | 131 passed`, exit 1). Seven of the ten are already recorded in earlier quick `deferred-items.md` files (solo-semantics matrix/export/paperPass, sidebar stale pins, workflow-strip row-S-chip). The remaining three (`rotoCompletionPaintGuard` 2, `PhysicsPaintTopBar` `setGrainScale` source pin) are likewise untouched by this bump — the guard fails inside `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:3468`, and the top-bar failure is a stale source-text pin. Recorded in `.planning/WINDOWS.md` as entry 103 (`unrun-verify`) for ship-gate visibility.

**Not repaired, per plan scope:** no source, test, config, or unrelated dependency change was made to chase these failures.

## Known Stubs

None.

## Threat Flags

None — the change is the planned patch bump of an already-approved package; pnpm recorded the new registry integrity hash in the committed lockfile, and no new package or install script entered the graph (T-261024-hsd-01 / T-261024-hsd-SC mitigations hold).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The workspace resolves a single preact 11.0.2 copy; the one-copy law holds across manifests, lockfile, and disk.
- The pre-existing typecheck and vitest baselines now block a clean `verify` exit; recording them (WINDOWS entry 103) keeps the distinction between this bump and pre-existing debt visible at ship time.

## Self-Check: PASSED

- `package.json`, `app/package.json`, `packages/efx-physic-paint/package.json`, `pnpm-lock.yaml` all present and committed in `0b15de7c`.
- Commit `0b15de7c` is an ancestor of HEAD (`git rev-list --count d98a4015..HEAD` = 1).
- Resolution probes, lockfile scan, virtual-store scan and `pnpm -r why preact` all report 11.0.2 only.

---
*Quick task: 261024-hsd*
*Completed: 2026-10-24*
