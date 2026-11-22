# Phase 64 — Deferred Items

Out-of-scope discoveries logged during plan execution. Not fixed in phase 64.

Plans 64-32 … 64-38 are **retired as obsolete** by the artist's 2026-11-22 ruling — the Studio
render law is validated and must not change. They are closed work, not deferred work; the
authoritative record is `deferred/RETIRED.md`.

## 64-07 — `bakeAquarelleScript` still renders with the engine default light

- **Found during:** 64-07 Task 2 (render-path wiring), verified at GREEN
- **File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- **Location:** `bakeAquarelleScript` at line ~2677; adapter creation at ~2700-2702 (`ports.createAquarelleAdapter(size, bakePaper)` / `createDefaultAquarelleAdapter(size, bakePaper)`); call sites at ~3154, ~3530, ~3815
- **Issue:** The Play-Script consume branch (56-08, `createAquarelleBake` with `flush-survives-navigation`) builds its adapter through the optional `ports.createAquarelleAdapter` port, whose signature carries only `(size, paper)`. The per-document `light` added by 64-05 never reaches this bake, so it renders with the engine default (`DEFAULT_LIGHT`) while the live sheet, reveal Play bake and Apply bake use the document light.
- **Why not fixed here:** Threading it requires (a) changing the `createAquarelleAdapter` port signature (a cross-module interface change with its own test implementers) and (b) a cache-key decision — the staged bake cache must include the light, or a light change would serve stale pixels. That is Rule 4 architecture, and no 64 plan covers this path (64-07's scope is the reveal Play bake and the Apply / stroke-edit bake).
- **Impact:** only this bake path; the must-have "every bake path resolves the light" is met for the paths the plan enumerates but not for `bakeAquarelleScript`.
- **Suggested follow-up:** a quick task or a later phase: add `light?: LightSettings` to the port and pass it through both factory calls, decide the staged-cache key term with `lightSignature`, and extend `physicsPaintRotoPlayScriptController.bake.test.ts`.
- **Ledger:** recorded in `.planning/WINDOWS.md` as `unmet-truth`.

## 64-17 — `physicPaintBridge.test.ts` reports an unhandled error in the full app suite

- **Found during:** 64-17 Task 3 verification (a full-suite sanity run; running the suite is not part of this plan's gate chain)
- **File:** `app/src/lib/physicPaintBridge.test.ts`
- **Issue:** `pnpm --filter efx-motion-editor exec vitest run` reproducibly ends `Test Files 1 failed | 459 passed | 2 skipped (462)` with an unhandled error attributed to this file; the named test is "answers success when the catalog publish rejects after the mutation landed (WR-04)". The same file passes 186/187 (1 skipped) when run alone (`npx vitest run src/lib/physicPaintBridge.test.ts`), so it looks like a full-suite pollution/timer interaction rather than an assertion failure.
- **Why not fixed here:** unrelated to plan 64-17, which touches only `packages/efx-watercolor/probe/medium-engine/`; the probe files are not imported by this test. Out of scope per the executor scope boundary.
- **Impact:** none on the pixel gates or on this plan's acceptance — `probe/medium-engine/harness.test.ts` and every other file passed in the same runs.
- **Suggested follow-up:** capture the unhandled rejection with a verbose/serial run and fix the cross-file interaction; check for unawaited timers or shared module state between tests.
- **Wave 7/9 observations (orchestrator):** the flaking test varies run to run — "removes its one-shot listener when no receiver answers (bounded wait)" (20 s) in waves 7 and 9, "answers with the same operationId and publishes the catalog before the answer" (15.2 s) in wave 9's re-run. Both pass in isolation. The common shape is a bounded-wait assertion whose budget is exhausted under full-suite load; no bridge code changed in 64-13/64-14/64-17 (64-13 touched engine shaders; 64-14 the engine and probe). Classified as a pre-existing load-sensitive flake, not a wave regression.

## 64-14 — `white-over-blue` criterion-1 invariant fails on covered paper-white

- **Found during:** the post-UAT verification fix (the unmasked cover-deposit scattering square), while re-capturing the Body>0 probe baselines
- **File:** `packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json` (stale) and the `coveredPaperWhitePct` invariant in `compare.mjs`
- **Issue:** at 1080² Body 100 the capture now reports `coveredPaperWhitePct` 0.88 (bar 0) — 0.88% of texels the pigment layer claims to cover still read as bare paper (transparent-export luma ≥ 250). The committed baseline records 0 at commit `4a54aa411` (64-17 task 2).
- **Not caused by the scattering fix:** an A/B with the previous unmasked law measures 0.95% for the same run, so the drift predates the fix. It is not reproducible from the committed baseline either: 64-14's three commits (`f396bcba5`, `12f9c1e1b`, `2720ab282`) changed the render path after the baseline was captured, and no later plan re-ran `white-over-blue`.
- **Likely mechanism:** 64-14 advects the coverage channel with the wet ink; coverage can reach a texel whose paint film is thinner, so the mode-4 alpha claims coverage where the transmittance sheet still reads paper.
- **Impact:** the phase's Spike 001 criterion-1 gate is red at its 0 bar. It does not block the phase's own must-haves (which cite criterion 2 and the region invariants) but it is a real model-consistency question.
- **Suggested follow-up:** a focused quick or a 64.x plan: measure whether coverage and the paint film advect coherently, and either tighten the advection or justify a non-zero bar with a calibrated baseline note.

## 64-30 / IN-06 — dead seed path: `seedAquarelleEngine`, the adapter's injected engine/clock seam, `yieldToHostMs`

- **Found during:** 64-30 Task 2 (the IN-06 disposition row in `64-REVIEW-DISPOSITION.md` is `open`, flagged "not in the current review"). The Studio's KEY = CACHE cutover (2026-11-22) removed the live-seed replay, and nothing production-side has called this path since.
- **What is dead (three parts):**
  1. **The seed function** — `seedAquarelleEngine` plus its types `AquarelleSeedOptions`, `AquarelleSeedResult` and `AquarelleSeedHandle`, in `packages/efx-watercolor/src/bake/aquarelleSeed.ts` (types at 27-49, function at 63-144). It is still re-exported from the package main entry: `packages/efx-watercolor/src/index.ts:18` (`export * from './bake/aquarelleSeed'`).
  2. **The adapter's injected engine and clock seam** — `AquarelleAdapterOptions.engine` (`packages/efx-watercolor/src/adapter/engineAdapter.ts:69`) and `.clock` (`:75`), with the injected branches at `:307`, `:317-321`, `:336-340`, `:362-374`, `:561`, `:566` and the dispose guard at `:713`. Its only consumers are `aquarelleSeed.ts:89-94` and `liveSeed.test.ts:277`; every other adapter call site (probes, Play renderer, Studio bakes) omits both options.
  3. **The seed's yield constant** — `yieldToHostMs: 8` in the seed's bake options (`packages/efx-watercolor/src/bake/aquarelleSeed.ts:106`). The `yieldToHostMs` OPTION itself stays live for the bake path (`packages/efx-watercolor/src/bake/aquarelleBake.ts:230`, slice at `:503`, plus `aquarelleBake.test.ts:1747`); only the seed's constant dies with the seed.
- **Only remaining caller that keeps it alive:** `packages/efx-watercolor/src/playground/liveSeed.test.ts` — the runtime seed test dynamic-imports `seedAquarelleEngine` at `:223` and calls it at `:237`; the same file pins the seed source text (`:121`, `:139`, `:121-141`) and exercises the adapter's injected seam with a stub engine at `:277`. No app or Roto source imports any seed symbol today.
- **Contract pins that currently assert its absence from the layer:** `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` (the "KEY = CACHE" test) asserts the aquarelle package import and the layer carry none of `seedAquarelleEngine`, `AquarelleSeedHandle`, `seedSheet`, `abandonSeed`, `FRAME_SEED_DEBOUNCE_MS` or `seeding`. Those pins are the anti-replay guard and must survive any future removal.
- **Why removal is deferred:** the path is reachable only from a test-only caller, so deleting it changes no shipped behaviour; the removal would touch the adapter's public options surface — a module every bake path imports (probes, Play renderer, Studio bake) — and rewrite `liveSeed.test.ts`; and this phase's remaining risk budget belongs to the visible closure (the IC-02 symmetry fix and the UAT surface), not to a dead-code sweep.
- **Reopen trigger:** any future work that must seed an engine off the live path (a new probe/parity harness reusing the injected engine/clock seam), or the retirement of `liveSeed.test.ts`. Either one makes this entry actionable again.
- **Verification:** this entry modifies planning prose only. The dead code is byte-identical — `git diff --quiet -- packages/efx-watercolor/src/bake/aquarelleSeed.ts` passes, and no file under `packages/` or `app/` changed for this task.
