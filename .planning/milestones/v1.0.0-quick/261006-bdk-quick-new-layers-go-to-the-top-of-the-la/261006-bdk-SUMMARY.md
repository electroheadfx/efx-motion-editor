---
phase: quick-261006-bdk
plan: 261006-bdk
subsystem: stores
tags: [sequence-store, layer-stack, placement, shader-browser, preact-signals]

# Dependency graph
requires: []
provides:
  - "createFxSequence placement law: every layer type defaults to stack-top; only explicit position:'end' appends"
  - "Regression pin that opts-less creation lands at overlays[0]"
affects: [layer-stack, shader-browser-apply, add-layer-menu, timeline-reorder, export-compositing]

# Actuals (#2632)
actuals:
  tokens: 670
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Store-level placement default: the law lives in the store default, not in per-call-site opts (a future layer type cannot silently fall back to append)"

key-files:
  created: []
  modified:
    - app/src/stores/sequenceStore.ts
    - app/src/stores/sequenceStore.test.ts

key-decisions:
  - "Placement condition inverted to `opts?.position === 'end' ? append : insertSequenceAtStackTop` — explicit 'end' is the only append opt-in; opts type unchanged so the six { position: 'top' } AddFxMenu call sites and efxPaintCutover source-shape pins keep matching byte-for-byte"
  - "Docstring rewritten to state the law (stack-top unless position:'end') instead of promising the old opts-less append"
  - "ShaderBrowser.tsx:569 left untouched — its opts-less call top-inserts purely via the store default, keeping the diff inside the two planned files"

requirements-completed: [QUICK-261006-BDK]

coverage:
  - id: D1
    description: "Opts-less createFxSequence (Shader Browser generator/adjustment apply) lands the new layer at the head of the stack"
    requirement: QUICK-261006-BDK
    verification:
      - kind: unit
        ref: "app/src/stores/sequenceStore.test.ts#opts-less createFxSequence lands at the head of the stack — every layer type defaults to top (261006-bdk)"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/stores/sequenceStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts (36 + 28 tests green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native UAT: a shader applied from the Shader Browser appears as the TOP stack row; each + Layer entry still lands on top; the one-gesture drag-reorder into the bottom slot still works (260923-kcs regression row)"
    requirement: QUICK-261006-BDK
    verification: []
    human_judgment: true
    rationale: "Visual stack-row position in the native timeline cannot be judged by unit tests — vitest is blind to the rendered timeline order (fxTrackLayouts row rendering); the user runs the native UAT"

# Metrics
duration: 14min
completed: 2026-10-06
status: complete
---

# Phase quick-261006-bdk: New layers go to the top of the stack Summary

**createFxSequence's default placement now routes through the existing `insertSequenceAtStackTop` helper — the Shader Browser's opts-less generator/adjustment apply lands its new layer at the TOP of the timeline stack instead of the bottom, making stack-top the single law for every layer type (only an explicit `position: 'end'` appends), with the diff confined to the store and its test.**

## Accomplishments

- **Task 1 (live fix first, per the quick's locked order):** inverted the placement ternary in `createFxSequence` (app/src/stores/sequenceStore.ts) from `position === 'top' ? topInsert : append` to `position === 'end' ? append : topInsert`. The docstring that promised the old opts-less-append behavior for ShaderBrowser was rewritten to state the new law. `insertSequenceAtStackTop`, `reorderFxSequences`, and `resolveFxReorderToIndex` are byte-untouched (260923-kcs single resolver-owned adjustment contract held); no UI added; `opts` type unchanged so all six explicit `{ position: 'top' }` call sites in AddFxMenu.tsx keep compiling and matching the efxPaintCutover source pins.
- **Task 2 (regression pin after the fix):** added one case to the existing `describe('top insert (position: top / content overlay)')` block — two opts-less `createFxSequence` calls assert `getOverlaySequences()[0].id` is the NEW sequence and `[1].id` the existing one. Verified RED against pre-fix code (base `06db7a46` store restored → the new pin fails, default append lands the new sequence last), GREEN at HEAD. Existing cases byte-for-byte untouched.
- **Caller audit re-check (plan verification):** every non-test `createFxSequence(` caller is either explicit `{ position: 'top' }` (AddFxMenu ×6) or opts-less (ShaderBrowser.tsx:569, now compliant via the default). No creation path was found landing at the stack end.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/stores/sequenceStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts` → 52 passed (+12 pre-existing todos), green.
- `pnpm --filter efx-motion-editor run typecheck` → clean (exit 0).
- `pnpm --filter efx-motion-editor exec vitest run` (full app suite) → 235/238 files green, 4430 tests passed; 1 suite fails pre-existing at module load (see Deferred), 2 skipped files.
- Diff boundary: `git diff --stat 06db7a46..HEAD` → only `app/src/stores/sequenceStore.ts` (+8/−5) and `app/src/stores/sequenceStore.test.ts` (+9). `fxReorder.ts`, `TimelineInteraction.ts`, `ShaderBrowser.tsx`, `AddFxMenu.tsx` untouched.
- Native visual UAT: **PENDING — user** (see coverage D2).

## Deviations from Plan

### Auto-fixed Issues

None — the plan executed as written (Rules 1-4 not triggered).

### Environment note (not a plan deviation)

The worktree shipped without `node_modules`; `pnpm install --frozen-lockfile` (lockfile unchanged, no new packages — threat T-261006-bdk-SC honored) and `pnpm --filter @efxlab/efx-physic-paint build` (workspace package `dist`, gitignored) were required before vitest could run. No package.json/lockfile diff.

## Auth gates

None.

## Known Stubs

None.

## Deferred Issues

1. **`app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — suite fails at module load** with `TypeError: _setPaintMarkDirtyCallback is not a function` (paintStore ↔ projectStore circular init at `projectStore.ts:1125`). Out of scope: reproduced at base `06db7a46` with the base versions of both files this quick touches restored — this quick changed no imports or store wiring. Logged in `.planning/quick/261006-bdk-quick-new-layers-go-to-the-top-of-the-la/deferred-items.md` and appended to `.planning/WINDOWS.md`.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes; the diff is an array-splice placement inversion (threat register T-261006-bdk-01 mitigated by the suite gates; -02/-03 accepted as documented).

## Self-Check: PASSED

- FOUND: app/src/stores/sequenceStore.ts
- FOUND: app/src/stores/sequenceStore.test.ts
- FOUND: commit 4bd3e47b (task 1)
- FOUND: commit 145c9bc5 (task 2)
- FOUND: 261006-bdk-SUMMARY.md (this file)
