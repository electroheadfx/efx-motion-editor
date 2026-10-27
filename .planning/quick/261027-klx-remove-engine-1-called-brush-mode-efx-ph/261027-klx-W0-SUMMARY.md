---
phase: quick-261027-klx
plan: W0
wave: 0
status: complete
stop_conditions: []
resolved_conditions: [S3, S4]
baseline_repin: 951080
commit: d39865bc
plan_head_before: 98b2e50e71c859d302737aa7464dc590553274da
plan_head_after: d39865bc7e4b40f8bf1d5de00a379d93a47e285b
commits: 1
files_changed: 17
insertions: 1722
deletions: 35
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 0 Summary

**Status: COMPLETE (chunk ceiling re-pinned by user decision).** All functional work
landed and every test/typecheck gate is green. The required `copyLiveAlphaCanvas` null
seam added **37 bytes** (951,043 -> 951,080). The user re-pinned the Wave 0 ceiling to
**951,080 bytes** on 2026-10-27; the final 650-700 KB target and the 2,000 kB build
budget are unchanged. The S3/S4 stop was correct and is recorded below.

## What landed

The app-owned mutation ledger, the ONE memoized Roto engine port, the frame-persistence
truth table, the paper conditioner port with a byte-exact golden fixture, the local paint
types, the app-owned stack-order law with a temporary package-parity proof, and the
`copyLiveAlphaCanvas` nullable seam.

## Files touched (17)

Created:

- `app/src/components/physic-paint/types/paintCore.ts` — app-owned paint types (11 declarations: ToolType, BrushOpts, PenPoint, BgMode, PhysicsMode, PaintStroke, StackReorderResult, CompletedPaintMutation, PaintHistoryAvailability, PhysicStrokePayload, RotoEditableState). Pure types; no runtime values, no engine-1 re-export.
- `app/src/components/physic-paint/engine/paintMutationLedger.ts` — monotonic never-reused clock (seed 1), max-raise reserve, `seedFromRestoredMax`, acceptance-ordered accepted list, defensive clones, read-only target lookup, synchronous completion emit.
- `app/src/components/physic-paint/engine/paintMutationLedger.test.ts` — 11 permanent semantic-parity tests.
- `app/src/components/physic-paint/engine/paintMutationLedger.purity.test.ts` — 13 structural purity tests over the four new modules (comments stripped; no package specifier, no `EfxPaintEngine`, no engine-object `enqueueRecordedStroke`).
- `app/src/components/physic-paint/roto/paintMutationRotoPort.ts` — WeakMap-memoized port with stable identity per ledger.
- `app/src/components/physic-paint/roto/paintMutationRotoPort.test.ts` — 6 tests (identity, WeakMap round-trip, acceptance order, completion, null canvas passthrough, setInputLocked/flush seams).
- `app/src/components/physic-paint/roto/rotoFramePersistTruth.ts` — `shouldPersistRotoFrameFromTruth` stating the current law over an explicit truth input.
- `app/src/components/physic-paint/roto/rotoFramePersistTruth.test.ts` — 7-row truth table including the engine-1-mirror-empty regression row.
- `app/src/lib/paperConditioning.ts` — verbatim port of `conditionHeightMap` with the engine-1 `clamp` inlined (plan-permitted form).
- `app/src/lib/paperConditioning.test.ts` — 11 tests; byte equality via `Uint8Array` buffers, no `toBeCloseTo`.
- `app/src/lib/__fixtures__/paperConditioning.golden.json` — 8 cases generated from the package implementation before any other Wave 0 file was written; `"NaN"` / `"-0"` string encoding.
- `app/src/components/physic-paint/view/stackOrder.parity.test.ts` — 4 tests proving the local copy against the still-installed package; this file is deleted in Wave 1 by design.

Modified:

- `app/src/components/physic-paint/view/stackOrder.ts` — now owns `clampStackPosition`, `targetIndexForStackPosition`, `reorderForStackPosition` (verbatim from `packages/efx-physic-paint/src/engine/stackOrder.ts:21-59`); imports/re-exports `StackReorderResult` from `../types/paintCore`.
- `app/src/components/physic-paint/view/stackOrder.test.ts` — header only (implementation is now app-owned).
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — `copyLiveAlphaCanvas?: () => HTMLCanvasElement | null`; capture calls the seam once, bails out on null instead of substituting a blank canvas.
- `app/src/lib/paperPass.ts` — line 1 retargeted to `./paperConditioning`; no other change.
- `app/src/lib/paperPass.frameGuard.test.ts` — removed the package `index.ts` and `EfxPaintEngine.ts` source reads and the U5 `getDryCanvas` block; P4(e) retargeted at `app/src/lib/paperConditioning.ts`.

## Commands run and results

| # | Command | Result |
|---|---------|--------|
| 1 | `pnpm --dir app run build` (step 0.1, pre-write baseline) | PASS — `PhysicsPaintStudio-C0u2oqfS.js` = **951,043 bytes**, identical to the re-pinned baseline. Writes proceeded. |
| 2 | `pnpm --dir app run build` + `ls -l app/dist/PhysicsPaintStudio-*.js` (first post-Wave-0) | **FAIL S4** — `PhysicsPaintStudio-7qtbpQrg.js` = **951,080 bytes** (+37). |
| 3 | `pnpm --dir app run build` + `ls -l` (after inline-clamp attempt) | **FAIL S4 again** — `PhysicsPaintStudio-Dbfp50Vr.js` = **951,080 bytes** (unchanged). Same failure twice → S3. |
| 4 | `pnpm --filter efx-motion-editor exec vitest run` on the 8 targeted files | PASS — 8/8 files, **75/75 tests**, 446 ms. |
| 5 | `pnpm --dir app run typecheck` | PASS — exit 0, no output. |
| 6 | `git show --first-parent --diff-filter=D --name-only HEAD` | PASS — no deletions in the commit. |
| 7 | `git status --short` after commit | PASS — clean. |

## Chunk gate: S4 (and S3) — resolved

- Ceiling was **951,043 bytes**. Measured: **951,080 bytes** (`app/dist/PhysicsPaintStudio-Dbfp50Vr.js`). The user re-pinned the ceiling to **951,080 bytes**, accepting the required +37-byte null-safety growth; the 2,000 kB build budget is unchanged.
- The gate failed twice in a row for the same reason (measurement 2 and 3 above) → **S3**.
- Attribution (measured, not assumed):
  - `copyLiveAlphaCanvas` is present in the Studio chunk (`PhysicsPaintStudio-Dbfp50Vr.js`) and in the main chunk.
  - `transmittanceTrackConverted` (paperPass) appears **0 times** in the Studio chunk and once in `index-DFHPxFED.js` — the paper conditioner is bundled in the main chunk, so step 0.4/0.5 cannot affect the measured chunk.
  - `fromIndex` (stackOrder) appears **0 times** in the Studio chunk and twice in `index-DFHPxFED.js` — same conclusion for step 0.3.
  - `esbuild --minify` on the clipboard module: HEAD **17,393 bytes** vs working tree **17,427 bytes** = **+34 bytes**, matching the observed +37 chunk delta (the remaining 3 bytes are chunk-level naming/order overhead).
- Conclusion: step 0.7b is **mandated** to add a null check and a local, and it is the only Wave 0 change that lands in the Studio chunk. Because the ceiling equals the pre-change baseline (951,043), **any** compliant implementation of 0.7b exceeds it. This is a plan arithmetic conflict, not an implementation defect; the executor stopped rather than weakening 0.7b or raising the budget.
- **Resolution (user decision, 2026-10-27):** re-pinned the Wave 0 ceiling to **951,080 bytes**. The +37 bytes is accepted required growth from the null-safety seam; the Wave 6 target of 650-700 KB is unaffected and the 2,000 kB build budget is unchanged. The null-safety seam stays.

## Deviations from plan

1. **`RotoEditableState` import path.** The plan names `@efxlab/efx-watercolor/playground`, but that subpath is not in the package `exports` map (".", "./papers", "./brushes", "./payload", "./bake"). The root entry re-exports `./playground`, so `DocumentSnapshot` is imported from `@efxlab/efx-watercolor` (type-only). Typecheck passes.
2. **`clamp` form.** Inlined the ternary inside `conditionHeightMap` (the plan explicitly allows "inline the ternary or export a local `clamp`"). This was also an attempted byte reduction; it had no effect on the Studio chunk because paperPass is in the main chunk.
3. **Golden-fixture generator location.** Generated with a temporary app-side vitest (`app/src/lib/paperConditioning.golden.generator.test.ts`) importing `packages/efx-physic-paint/src/core/paper.ts` directly. It ran green before deletion; the generator file is not committed. The plan offered the package config or a node script as options; the constraint that mattered — generated from the package implementation before any other Wave 0 file — is met.
4. **Extra fixture case.** Added `[-0, 0, 0.5, 0.5]` as an 8th case beyond the seven listed, so the `"-0"` codec path is exercised by a real value (the listed cases do not reliably produce `-0`).
5. **Ledger additive API.** Added `getAcceptedStrokeCount()` (required by step 0.7's `getStrokeCount`), plus `isInputLocked()` / `isActive()` getters so the required `setInputLocked` / `setActive` state is test-observable. No existing locked member was renamed or removed.
6. **Summary status.** The wave was written as `status: blocked` when S3/S4 fired; after the user re-pinned the ceiling to 951,080 bytes it is `status: complete`. Everything in the wave is code-complete and verified.

## Numeric-identity waiver (required by the plan)

Exact mutation-ID parity with engine-1 is **explicitly waived**. The three numeric ID
sources disappear with the package: interactive-stroke allocation at
`EfxPaintEngine.ts:4687`, the implicit pre-increment used for clear/physics at `:3690`, and
the fresh IDs assigned on load at `:5100`. Reproducing those numbers would require
retaining engine-1 internals, which is the thing this quick removes.

The achievable contract is pinned instead, all in `paintMutationLedger.test.ts`:
monotonic and never reused (500-allocation run), seeded from the restored max + 1
(`seedFromRestoredMax(41)` → 42), acceptance order equals stroke-end order, and
completion emitted synchronously before `allocateStrokeMutation` returns, with no
rasterization or finalization dependency.

## Notes for Wave 1

- `stackOrder.parity.test.ts` imports the package on purpose and is expected to be deleted
  in Wave 1, not now.
- The golden fixture is committed and must not be regenerated (the source implementation
  is deleted in Wave 1).
- Commit for this wave: `d39865bc` — `feat(261027-klx): land engine-1 removal blockers
  (ledger, port, paper, types)`, 17 files, +1722/-35.
- No unrelated file was staged: `.planning/`, `SPECS/`, `app/dist/`, and `brushes.ts`
  remain untouched in git.
