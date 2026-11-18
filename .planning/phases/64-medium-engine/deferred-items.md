# Phase 64 — Deferred Items

Out-of-scope discoveries logged during plan execution. Not fixed in phase 64.

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
