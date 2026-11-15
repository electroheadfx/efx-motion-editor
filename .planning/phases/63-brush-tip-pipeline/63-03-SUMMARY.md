---
phase: 63-brush-tip-pipeline
plan: 03
subsystem: engine
tags: [typescript, vitest, brush-tips, builtin-tips, base64, bmp, sips, chunk-budget]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-01's deriveMask two-branch law, normalizeMaskContrast and the mask registry the built-ins seed into"
provides:
  - "builtinTipMasks.generated.ts: BRISTLE/CHALK/SPONGE base64 constants, each decoding to exactly 36,864 bytes with min 0 and max 255"
  - "builtinTips.ts: BUILTIN_TIPS (the single source of the three texture records later plans import) and BUILTIN_TIP_MASKS (decoded once at module load, length-checked)"
  - "A registry whose module-init state and reset state are the three built-ins, so a fresh install resolves them with no project and no import"
  - "builtinBake.test.ts: the env-gated authoring step that regenerates the constants from the supplied art through the shared derivation law"
affects: [63-brush-tip-pipeline]

actuals:
  tokens: 42817
  tasks: 2
  commits: 2
  plan_head_before: dfeda1d7b97995ff6a6e2b6c9f26683506c495f9
  plan_head_after: a219a43525e6bb2c4759e981a6391d1a9f3a678e

tech-stack:
  added: []
  patterns:
    - "Bake-as-test: the authoring step is a vitest file gated by an env var, registering exactly one named skipped test when unset so the default suite never performs IO or spawns a child process"
    - "Generated-constant module with a 'do not edit by hand' header naming the exact re-run command, mirroring spectralData.ts"
    - "Dynamic imports after the write so one enabled run proves the artifact it just produced instead of a module-cache stale copy"
    - "Dual export sets: tip records (catalog surface) and mask entries (registry surface) are separate arrays over one private D-07 definition list"

key-files:
  created:
    - packages/efx-watercolor/src/brushes/builtinTips.ts
    - packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts
    - packages/efx-watercolor/src/brushes/builtinBake.test.ts
    - packages/efx-watercolor/src/brushes/builtinTips.test.ts
  modified:
    - packages/efx-watercolor/src/brushes/maskRegistry.ts
    - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
    - packages/efx-watercolor/src/brushes/index.ts

key-decisions:
  - "The bake dispatches sips on the three fixed D-07 assets, parses the BMP header (24-bit BGR bottom-up with padding, 32-bit BGRA when present), and calls deriveMask then normalizeMaskContrast — there is no second conversion anywhere in the file"
  - "builtinTips.ts owns ONE private D-07 definition list; BUILTIN_TIPS and BUILTIN_TIP_MASKS are derived from it, so a swap is one manifest line and the ids cannot drift between the catalog and the registry"
  - "decodeMask throws at module load on any length other than 36,864, which is what turns a hand-edited constant into a failing unit test instead of a wrong-sized registry entry (T-63-14)"
  - "The bake test imports the registry and brush bridge dynamically, AFTER writing the generated module, so the enabled run proves the freshly written constants paint rather than the pre-existing cache"
  - "A 32-bit BI_RGB BMP with an all-zero alpha channel is treated as opaque: the fourth byte is an unused slot in that format, and reading it as alpha would collapse the mask to a constant"
  - "resetMaskRegistry is literally replaceMaskRegistry(BUILTIN_TIP_MASKS), so the reset state can never drift from the module-init state (D-20)"

patterns-established:
  - "Env-gated authoring test that proves its own output from the written file text, then re-imports the consumer modules to prove the end-to-end path in the same run"
  - "Scalar predicate assertions (boolean/primitive toBe) keep the invariant diagnostics one-line, matching the 63-01 corpus style"

requirements-completed: [TIP-13]

coverage:
  - id: D1
    description: "A fresh install resolves exactly three texture tips — wc/builtin-bristle 'Bristle fan', wc/builtin-chalk 'Chalk grain', wc/builtin-sponge 'Sponge' — from BUILTIN_TIPS, frozen, with the eight neutral multipliers"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/builtinTips.test.ts#BUILTIN_TIPS — exactly three frozen texture records (D-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each built-in mask is a compile-time constant of exactly 36,864 bytes, decoded once at module load, whose normalized content spans min 0 to max 255"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/builtinBake.test.ts#bakes builtin tips from the supplied source art (BAKE_BUILTIN_TIPS=1)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/builtinTips.test.ts#BUILTIN_TIP_MASKS — decoded once, exact length (T-63-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The bake calls deriveMask and normalizeMaskContrast — the same derivation and normalize-only stretch as import — and the same run proves buildBrushForStroke('wc/builtin-bristle') paints the decoded mask at tipSize 192"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/builtinBake.test.ts (asserts tipData identity with the decoded bristle mask)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A module-fresh registry resolves every built-in with no reset call, and reset after a custom registration restores exactly the three built-in ids with the same allocations"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/builtinTips.test.ts#registry seeding, #resetMaskRegistry"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts#resetMaskRegistry — no ghost mask"
        status: pass
    human_judgment: false
  - id: D5
    description: "The built-in set and the project entry set are separate exports: no built-in id appears in the shipped TIPS list or in buildBrushPackSnapshot output"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/builtinTips.test.ts#built-in set vs project entry set — separate exports"
        status: pass
    human_judgment: false
  - id: D6
    description: "The production build stays inside the pinned 2000 kB main-chunk ceiling with the three base64 masks shipped"
    requirement: TIP-13
    verification:
      - kind: other
        ref: "pnpm --filter efx-motion-editor build — main chunk 1,881.87 kB, no chunk-size warning"
        status: pass
      - kind: unit
        ref: "app/src/viteBuild.test.ts (13 tests, limit still 2000)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 03: Built-in Texture Tips Summary

**Three compile-time texture tips baked from the supplied art through the shared derivation law: `brushes/builtinTips.ts` owns the frozen records and the once-decoded masks, and the registry now seeds and resets to them instead of an empty map**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-15T10:55:03Z
- **Completed:** 2026-11-15T10:59:20Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `builtinBake.test.ts` is an env-gated authoring step: without `BAKE_BUILTIN_TIPS=1` it registers exactly one named skipped test and performs no write and no child process; with the gate it downscales the three D-07 source JPEGs through `sips`, parses the BMP header (24-bit BGR bottom-up with row padding, 32-bit BGRA when present, all-zero-alpha fallback), assembles RGBA, calls `deriveMask` then `normalizeMaskContrast`, asserts 36,864 bytes and a full 0..255 span, and writes `builtinTipMasks.generated.ts` with a "generated, do not edit by hand" header naming the re-run command.
- The same enabled run decodes all three constants from the written file text, asserts their lengths, installs them with `replaceMaskRegistry`, and proves `buildBrushForStroke('wc/builtin-bristle')` returns `tipSize` 192 with `tipData` identical to the decoded bristle mask. The bake is deterministic: a second run reproduced the same SHA-256 over the generated module.
- `builtinTips.ts` exports `BUILTIN_TIPS` (three frozen texture records, neutral multipliers, exact D-07 ids and labels) and `BUILTIN_TIP_MASKS` (id plus mask decoded once at module load, every constant length-checked with a throw). Both are derived from one private definition list, so a mapping swap is one manifest line.
- `maskRegistry.ts` seeds the map with the built-ins at module init and `resetMaskRegistry()` is now `replaceMaskRegistry(BUILTIN_TIP_MASKS)` — the reset state can never drift from the compile-time set.
- Plan verification: package suite 377 passed / 9 skipped (the one named skip from the bake gate), the targeted Task 2 suites 36/36, the package build green, the app build at 1,881.87 kB with no chunk-size warning, and `viteBuild.test.ts` 13/13 with the limit pinned to 2000.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end built-in tip — baked mask paints as wc/builtin-bristle (tracer)** — `cbfebb645` (feat)
2. **Task 2: Built-in invariants — ids, labels, reset and no project leakage** — `a219a4352` (test)

_Note: the plan frontmatter is `type: execute`; see `## TDD Gate Compliance` for the commit-shape record._

## Files Created/Modified

- `packages/efx-watercolor/src/brushes/builtinBake.test.ts` — env-gated bake: sips dispatch, BMP parser, deriveMask → normalizeMaskContrast, generated-module writer, white-box decode and end-to-end paint proof
- `packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts` — `BRISTLE_MASK_BASE64`, `CHALK_MASK_BASE64`, `SPONGE_MASK_BASE64` and nothing else (148 KB source, ~147 KB of payload)
- `packages/efx-watercolor/src/brushes/builtinTips.ts` — one private D-07 definition list, `BUILTIN_TIPS`, `BUILTIN_TIP_MASKS`, fail-closed `decodeMask`
- `packages/efx-watercolor/src/brushes/builtinTips.test.ts` — 14 invariant tests (ids, labels, freeze, category, neutral multipliers, mask lengths, fresh-module seeding, reset law, set separation)
- `packages/efx-watercolor/src/brushes/maskRegistry.ts` — module-init seeding, reset-to-built-ins, header law updated
- `packages/efx-watercolor/src/brushes/maskRegistry.test.ts` — reset rows assert the built-in set and the restored mask length
- `packages/efx-watercolor/src/brushes/index.ts` — barrel exports `./builtinTips`

## Decisions Made

- **Bake-as-test with a named skip:** the package `test` script collects every `src/**/*.test.ts`, so the authoring step must both gate itself and leave a collected test behind. `it.skip('bakes builtin tips (set BAKE_BUILTIN_TIPS=1 to run)', () => {})` satisfies both; the default run does no IO and spawns nothing.
- **Dynamic imports after the write:** a static import of the registry would freeze the pre-bake module cache. The enabled test writes the module, reads its text back, and only then imports the consumers — so the proof is of the artifact produced in that run, not of a stale placeholder.
- **One definition list, two exports:** ids/labels/constants live once; `BUILTIN_TIPS` and `BUILTIN_TIP_MASKS` are derived. The task's "separate exports" law is about built-ins vs project entries, not about duplicating the ids.
- **Opaque fallback for 32-bit BMP:** `sips` currently emits 24-bit BMP, but a 32-bit BI_RGB file with an unused (zero) alpha slot would otherwise trip the alpha branch of `deriveMask` and yield a constant mask. The parser detects an all-zero alpha channel and treats it as opaque.
- **Reset is replace:** `resetMaskRegistry()` delegates to `replaceMaskRegistry(BUILTIN_TIP_MASKS)`, so the generation counter behavior and the per-entry validation are shared with project open.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan-01 lifecycle test was amended in Task 1, not Task 2**

- **Found during:** Task 1 (registry seeding)
- **Issue:** Task 1's action changes `resetMaskRegistry()` to restore the built-ins, but `maskRegistry.test.ts` pinned an empty registry after reset in two rows, and Task 1's acceptance requires the whole package suite (`vitest run`) to exit 0.
- **Fix:** the two rows now assert the built-in state — `'rejects an empty id'` expects the three built-ins to remain, and the reset row expects the exact built-in id list. Task 2 then extended the same file with the restored mask-length assertion, as its files list anticipated.
- **Files modified:** `packages/efx-watercolor/src/brushes/maskRegistry.test.ts`
- **Verification:** the full package suite exits 0 with the gate unset; both files are green in the Task 2 verify run.
- **Committed in:** `cbfebb645` (Task 1) and `a219a4352` (Task 2)

**Total deviations:** 1 Rule 3 blocking fix (test-row ownership moved one task earlier). No auto-fixed bugs, no scope changes.
**Impact on plan:** none on delivered behavior; every law the plan names is pinned.

## TDD Gate Compliance

Plan frontmatter carries `type: execute`, and the orchestrator did not dispatch with `TDD_MODE=true`; `task.is-behavior-adding` on the plan returns `true` (tdd_true / has_behavior_block / has_source_files all true) for Task 2. Observed commit order is `feat(63-03)` (`cbfebb645`) → `test(63-03)` (`a219a4352`): Task 1 is a tracer that intentionally delivers the slice end-to-end (constants, module, registry, barrel), so Task 2's invariant tests hit immediate GREEN. Following the fail-fast rule and the 63-01/63-02 precedent, no RED was fabricated and the tests landed as a test-only commit with the green-by-construction reason recorded here. All 14 invariant tests plus the 22 lifecycle tests pass in one run.

## Issues Encountered

- The generated module does not exist until the first bake, while `builtinTips.ts` imports it statically. Resolved by keeping every consumer import dynamic in the bake test and running the bake before any build; the committed module is the real artifact, not a placeholder.
- `sips` emits a top-down BMP (negative height) at 24 bits per pixel; the parser handles both orientations and both depths rather than assuming the observed header.

## User Setup Required

None — no external service configuration required.

## Threat Flags

None — T-63-10 is mitigated and measured (main chunk 1,881.87 kB against the pinned 2000 kB ceiling), T-63-14 is mitigated by the module-load length check that throws before the registry sees a constant, and T-63-SC holds: the bake uses `sips` plus `node:fs`/`node:child_process` and adds no dependency.

## Next Phase Readiness

- `BUILTIN_TIPS` is the single source of the three texture records for the rest of the phase: 63-05/63-06 (catalog, library sections, payload) import it rather than re-declaring ids.
- The registry resolves the built-ins on a fresh process, so a project that never imported a tip resolves them on open and after close / New Project without any project-file content.
- The app does not surface the built-ins yet — wiring arrives with the catalog store and library sections, which is expected plan scope rather than a stub.
- `TIP-13` is marked complete; the reopen persistence row it also touches is covered by the built-ins being compile-time constants rather than package entries, which this plan pins.

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All seven files exist on disk.
- Commits `cbfebb645` and `a219a4352` are ancestors of HEAD.
