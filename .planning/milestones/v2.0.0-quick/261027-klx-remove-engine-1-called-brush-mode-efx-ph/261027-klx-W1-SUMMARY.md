---
phase: quick-261027-klx
plan: W1
wave: 1
status: complete
stop_conditions: []
resolved_conditions: []
commit: 22d0a8e9
plan_head_before: 7474b9412b56442a017d321940bf3ddd62640c3b
plan_head_after: 22d0a8e91fdf0545b8f0baf6566ba5ed93a186c7
commits: 1
files_changed: 95
insertions: 17
deletions: 32967
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 1 Summary

**Status: COMPLETE.** The engine-1 workspace package, its manifests and every
build reference are gone. The app is **intentionally non-compiling** after this
wave; the dangling engine-1 imports are Waves 2-4 work and were not touched.

## Pre-deletion census (step 1.1)

Measured on the live tree at HEAD `7474b941`, before any Wave 1 edit:

| Metric | Value | Command |
|---|---:|---|
| G1 line hits (§10 command) | **91** | `grep -rn "@efxlab/efx-physic-paint" app/src packages --include='*.ts' --include='*.tsx' --include='*.json' \| grep -v node_modules \| grep -v dist \| wc -l` |
| Files mentioning the specifier, `app/src` | **65** | `grep -rl … app/src …` |
| Files mentioning the specifier, `app/src` + `packages` | **73** | same, both roots |
| Files with a real import statement, `app/src` | **60** | `grep -rlE "from ['\"]@efxlab/efx-physic-paint" app/src …` |
| Package tracked files | **88** | `git ls-files packages/efx-physic-paint \| wc -l` |
| Package tracked line count | **34,956** | `git ls-files … \| xargs wc -l` |

G1 = 91 matches the pinned inventory baseline exactly, so the tree matched the
plan's measured state. The plan's context also cites "62 importing files"; that
figure is definition-sensitive and pre-Wave-0: Wave 0 added four files that
carry the literal only as comments / negative guards
(`types/paintCore.ts`, `lib/paperConditioning.ts`,
`lib/paperConditioning.test.ts`, `engine/paintMutationLedger.purity.test.ts`),
which inflates a naive "files mentioning" count. The structural baselines used
by the gates (G1) are exact; the file-count variants are recorded above so the
Wave 6 re-measurement has an unambiguous reference.

## What landed

1. **1.2 Package deleted.** `git rm -r -- packages/efx-physic-paint` (88 tracked
   files). The deletion left untracked build output on disk (`dist/`,
   `demo/dist/`, `node_modules/`), so those artifacts were removed with a
   **scoped** `rm -r` on exactly those three paths and `rmdir` on the emptied
   directory — the literal gate `test ! -d packages/efx-physic-paint` now passes.
   No `git clean` was used (prohibited), and no tracked file outside the package
   was touched.
2. **1.3 Manifest/config/lockfile.**
   - `app/package.json`: dropped `"@efxlab/efx-physic-paint": "workspace:*"`.
   - `app/vite.config.ts`: dropped both aliases
     (`@efxlab/efx-physic-paint/preact`, `@efxlab/efx-physic-paint`) and the
     `optimizeDeps.exclude` entry. The watercolor and paint-host aliases are
     untouched.
   - root `package.json`: `build` is now
     `pnpm --filter efx-motion-editor build`; `dev:paint` deleted.
   - `pnpm-lock.yaml`: regenerated with `pnpm install` at the workspace root
     (no hand-editing). Diff is 28 deletions only: the app importer entry and
     the whole `packages/efx-physic-paint` importer block. The app's
     `node_modules/@efxlab/efx-physic-paint` link is gone.
3. **1.4** `stackOrder.parity.test.ts` removed; the permanent `stackOrder.test.ts`
   stays green (7 tests).
4. **1.5** `hostAnimationResidueContract.test.ts` retargeted: the two
   `readFileSync` rows over the deleted `package.json` / `tsup.config.ts` are
   replaced by one stronger assertion — the package **directory** does not exist
   (`existsSync(ENGINE1_PACKAGE_DIR) === false`), so it publishes no
   `./animation` export and no tsup `animation` entry. Kept unchanged: the
   `src/animation/` absence row, the `HOST_ANIMATION_INDEX` existence row, the
   comment-stripping helpers, the `ENGINE1_ANIMATION_SUBPATH` adversarial matcher
   rows, and the repo-walk residue scan (its `walkFiles` already guards
   `existsSync`). Test count 5 -> 4 because two rows became one assertion.
5. **1.6** `efxPaintCleanBreakContract.test.ts` retargeted: removed
   `resolve(REPO_ROOT, 'packages/efx-physic-paint/src')` from `SCAN_ROOTS` (its
   `walkFiles` uses an unguarded `readdirSync`, so two of three cases would have
   thrown ENOENT) and updated the header prose to list the three surviving
   roots. Every token scan and every allowlist is unchanged.
6. **1.7 Commit.** `22d0a8e9` — `chore(261027-klx): remove the
   efx-physic-paint package and its config`, 95 files, +17 / -32,967.
   Pathspec-scoped staging only: the two `git rm` forms for deletions, and
   `git add --` for the four manifests plus the two retargeted tests.

## Commands run and results

| # | Command | Result |
|---|---------|--------|
| 1 | baseline vitest on the four targeted files (pre-deletion) | PASS — 4 files, **31 tests** |
| 2 | `git rm -r -- packages/efx-physic-paint` | PASS — 88 files deleted from the index + worktree |
| 3 | scoped `rm -r` of leftover untracked `dist/`, `demo/dist/`, `node_modules/`; `rmdir` the empty package dir | PASS — `test ! -d` holds |
| 4 | `pnpm install` (workspace root) | PASS — "Already up to date", lockfile regenerated, 0 `efx-physic-paint` hits |
| 5 | exact plan `<verify>` command (below) | PASS on the gate shape — `MANIFEST GATE: 0`; 4 files / **30 tests** green; census captured |

Exact verify command and output:

```
test ! -d packages/efx-physic-paint && ! grep -q "efx-physic-paint" app/package.json app/vite.config.ts package.json pnpm-lock.yaml && echo "MANIFEST GATE: 0" && pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/hostAnimationResidueContract.test.ts src/efx-paint/efxPaintCleanBreakContract.test.ts src/lib/paperPass.frameGuard.test.ts src/components/physic-paint/view/stackOrder.test.ts && (pnpm --dir app run typecheck > /tmp/klx-wave1-typecheck.log 2>&1; grep -oE "^[^ (]+\.(ts|tsx)" /tmp/klx-wave1-typecheck.log | sort -u)
```

```
MANIFEST GATE: 0

 RUN  v2.1.9 /Users/lmarques/Dev/efx-motion-editor/app

 ✓ src/components/physic-paint/view/stackOrder.test.ts (7 tests) 2ms
 ✓ src/lib/paperPass.frameGuard.test.ts (16 tests) 4ms
 ✓ src/efx-paint/host-split/hostAnimationResidueContract.test.ts (4 tests) 182ms
 ✓ src/efx-paint/efxPaintCleanBreakContract.test.ts (3 tests) 368ms

 Test Files  4 passed (4)
      Tests  30 passed (30)
   Duration  605ms (transform 72ms, setup 0ms, collect 99ms, tests 556ms, environment 0ms, prepare 116ms)
```

The trailing typecheck census is reproduced verbatim in the next section.

## Typecheck census (intentional breakage)

`pnpm --dir app run typecheck` exits **2** by design after this wave: every
surviving engine-1 import is dangling. Raw census (61 distinct files, paths as
tsc emits them, relative to `app/`):

```
src/components/physic-paint/engine/aquarelleStrokeBridge.ts
src/components/physic-paint/engine/EfxPaintCanvas.lifecycle.test.ts
src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts
src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
src/components/physic-paint/engine/physicsPaintStudioSettings.ts
src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts
src/components/physic-paint/hooks/useRotoFrameEditingController.ts
src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
src/components/physic-paint/hooks/useRotoReferenceController.ts
src/components/physic-paint/performance/depositSpeckleCapture.ts
src/components/physic-paint/performance/lookDeltaCapture.ts
src/components/physic-paint/performance/moveProvenanceCapture.ts
src/components/physic-paint/performance/scriptMemoryProbe.ts
src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
src/components/physic-paint/performance/scriptMemorySnapshot.ts
src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
src/components/physic-paint/performance/studioScriptMemoryGauge.ts
src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
src/components/physic-paint/PhysicsPaintStudio.tsx
src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
src/components/physic-paint/roto/rotoCanvasFrames.ts
src/components/physic-paint/roto/rotoCoordinatorPorts.ts
src/components/physic-paint/roto/rotoEditBufferTransactions.ts
src/components/physic-paint/roto/rotoSaveTransactions.ts
src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
src/components/physic-paint/view/BrushModuleSection.tsx
src/components/physic-paint/view/brushScriptEditionPort.test.ts
src/components/physic-paint/view/brushScriptEditionPort.ts
src/components/physic-paint/view/brushScriptHydration.test.ts
src/components/physic-paint/view/brushScriptHydration.ts
src/components/physic-paint/view/brushScriptRecordState.test.ts
src/components/physic-paint/view/brushScriptRecordState.ts
src/components/physic-paint/view/frameScriptOwnership.test.ts
src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts
src/components/physic-paint/view/physicsPaintTemporaryErase.ts
src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
src/components/physic-paint/view/PhysicsPaintToolRail.tsx
src/components/physic-paint/view/recordedStrokeGroups.ts
src/efx-paint/host-split/preSplitGoldenFixture.ts
```

**Census verdict: PASS.** All 61 files are members of the Wave 2-4 `<files>`
sets (cross-checked mechanically against the plan's `<files>` blocks). Counts
earlier in this wave were 62 vs 61 only because the two host-animation surface
rows were merged, not because a file entered the set.

**Error classes (79 errors), all engine-1-caused:**

| Code | Count | Cause |
|---|---:|---|
| TS2307 | 63 | 61 x `Cannot find module '@efxlab/efx-physic-paint'`, 2 x `…/preact` — direct, expected |
| TS7006 | 14 | implicit-`any` cascades: callback params lose contextual types from the now-unresolved package types (all in the census files) |
| TS2345 | 2 | `physicsPaintRotoPlayScriptRenderer.ts:161,449` — `const engine = new EfxPaintEngine(...)` is now `any`, so `renderProgressiveAlphaFrame` returns `any` and the declared `HTMLCanvasElement \| null` no longer narrows; the call arguments are reported nullable. Same direct cause, no unrelated regression |

No error of any other class appears. No file outside the Wave 2-4 sets appears.

## Deviations from plan

1. **vite.config.ts comment (plan discretion, step 1.3).** The comment above the
   `esbuild` override described two things: the surviving `vite:esbuild` config
   snapshot timing law, and a now-dead example (`packages/efx-physic-paint` was
   the only workspace package with `.tsx` sources). The plan said leave it only
   if it still describes a surviving condition, otherwise delete it. The
   surviving half was kept and the dead example removed, so the gate
   (`! grep -q efx-physic-paint app/vite.config.ts`) passes while the config
   hook's rationale is not left unexplained. The `esbuild` override itself is
   unchanged.
2. **Untracked build artifacts inside the deleted package.** `git rm` removed
   the 88 tracked files but left untracked `dist/`, `demo/dist/` and
   `node_modules/`, so `test ! -d packages/efx-physic-paint` failed until those
   artifacts were removed with a scoped `rm -r` + `rmdir`. No `git clean`, no
   tracked file affected.
3. **Host-animation test row count.** The plan's 1.5 says replace the two
   `readFileSync` rows with one stronger directory-absence assertion; the test
   count therefore drops from 5 to 4 (31 -> 30 targeted tests overall). No
   assertion was weakened: `existsSync(packageDir) === false` is strictly
   stronger than "this file has no `./animation` export key".

## Constraints honoured

- Pathspec-scoped staging only; `.planning/`, `SPECS/`, `app/dist/` and any
  unrelated dirty file were not staged. `git status` after the commit is clean.
- `pnpm` only, `vitest run` only, no dev server, no push.
- `git show --first-parent --diff-filter=D --name-only HEAD` lists exactly the
  88 package files + `stackOrder.parity.test.ts` — the intended deletions.
- Ledger: `plan_head_before 7474b941` -> `plan_head_after 22d0a8e9`, 1 commit.

## Notes for Wave 2

- Any test that imports a file in the census now fails at transform time with
  the same TS2307 class; that is expected until Waves 2-4 rewrite them.
- `hostSplitFailClosedApply.test.ts:226` still asserts the
  `'efx-physic-paint': 'Brush'` refusal row and is green today — do not remove
  it in Wave 2; Wave 3/5 own the refusal classification change.
- `packages/efx-spectral/src/index.ts:3` carries an engine-1 mention in a
  comment only; it is outside Wave 1's `<files>` and was left untouched.
- `app/src/components/physic-paint/view/stackOrder.test.ts` is green and
  remains the permanent stack-order pin; the parity file it replaced is gone.

## Self-Check: PASSED

- `packages/efx-physic-paint` absent (`test ! -d` passes).
- `MANIFEST GATE: 0` re-run green after the commit.
- Four targeted test files green (30/30).
- Commit `22d0a8e9` is an ancestor of `HEAD`; tree clean apart from this
  untracked summary file.
- Typecheck census: 61 files, all inside the Wave 2-4 declared file sets.
