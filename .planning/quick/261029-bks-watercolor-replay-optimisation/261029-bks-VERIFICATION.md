---
phase: quick-261029-bks
verified: 2026-10-29T07:34:51Z
status: human_needed
score: 7/7 must-haves verified
covered_files: [
  ".planning/quick/261029-bks-watercolor-replay-optimisation/261029-bks-PLAN.md",
  ".planning/quick/261029-bks-watercolor-replay-optimisation/261029-bks-SUMMARY.md",
  "app/src/components/physic-paint/PhysicsPaintStudio.test.ts",
  "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
  "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts",
  "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts",
  "packages/efx-watercolor/src/adapter/engineAdapter.test.ts",
  "packages/efx-watercolor/src/adapter/engineAdapter.ts",
  "packages/efx-watercolor/src/bake/aquarelleBake.test.ts",
  "packages/efx-watercolor/src/bake/aquarelleBake.ts"
]
covered_digest: "v3:sha256:774264a53d73cb3bce30a8425b7c7ac72edbc0a93eb2b32207ed1bd4d9eaf915"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Apply a watercolor script whose recording contains a long idle gap (tens of seconds), then read /tmp/efx-aquarelle-render-split.json"
    expected: "script-bake.diagnostics.skippedGapTicks > 0 and close to the recorded gap length; simulatedTicks a small fraction of timelineTicks; path === 'timed'; adapterCreateMs present and small relative to bake wall time"
    why_human: "Requires the real recorded Studio session and the native /tmp capture; vitest cannot reproduce the artist's wall-clock idle gaps or the Tauri-hosted bake path"
  - test: "Compare bakeFrame.digest and bakeInk of that Apply against a previous Apply of the same untouched script"
    expected: "Both unchanged (bake determinism preserved by the clock-only skip)"
    why_human: "Byte-level identity against a pre-change baseline needs the user's prior render-split artifact; the package parity tests use a double, not the real engine"
  - test: "Perform one scripted Lift (or the legacy-key Lift base recovery), then read the lift-erase events"
    expected: "diagnostics present on both base-recovery-ok and base-recovery-failed, with the same field set plus adapterCreateMs"
    why_human: "The lift transaction runs only in the live Studio with real paint, real recovery validation and the native render-split writer"
  - test: "Judge only what automation cannot: the applied key and the Lift erase look identical to the pre-change behaviour, and Apply on a long-gap script is visibly faster"
    expected: "No visible difference in the applied wash or the erase; Apply wall time visibly reduced on long-gap scripts"
    why_human: "Visual identity and perceived speed are human judgement on a live session"
---

# Quick 261029-bks: Watercolor Replay Optimisation Verification Report

**Phase Goal:** Watercolor replay optimisation — parity-preserving idle-gap tick skip in the aquarelle bake.
**Verified:** 2026-10-29T07:34:51Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The optimisation is not merely present: it is wired into exactly the three agreed gap walks, capability-gated so that every adapter without the seam keeps the old tick law, and the parity suite pins the invariant both per gap (stepped + skipped === gap length) and on the final virtual clock (strict `toBe`). The SUMMARY narrative matches the code; nothing in it overstated what was shipped.

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | Recorded-timeline bake whose adapter exposes `skipTicks`: gap ticks step while awake, become clock-only once `isAwake()` reads false; final virtual clock strictly equal and captured bytes identical to a skip-OFF bake | ✓ VERIFIED | `aquarelleBake.ts:431-452` (`stepGap`); rows (b) bytes identity and (d) strict clock `toBe` — `aquarelleBake.test.ts:991-1048`, green in the 40-test package suite; the double mutates the mock canvas only while awake, so bytes are real pixels, not a constant encoder (`pixelEncoder` reads `getImageData`, `aquarelleBake.test.ts:164-171`) |
| 2 | Sleep-transition boundary tick always runs before the remainder of the gap is skipped | ✓ VERIFIED | `aquarelleBake.ts:436-447` — the `isAwake()===false` branch steps the tick, increments, re-checks once, only then calls `skipTicks!(tick, toTick)`. Pinned exactly against fixture geometry: (e2) skip `{from:121,to:257}` + 41 steps 80..120, (e3) skip `{from:81,to:257}` + exactly one step at 80 (`aquarelleBake.test.ts:1065-1088`) |
| 3 | Adapters without `skipTicks` step every gap tick and receive ZERO `isAwake` probes; existing suite green UNEDITED | ✓ VERIFIED | `canSkip` requires BOTH seams and short-circuits before any probe (`aquarelleBake.ts:419`, `:436`). Existing `makeTimelineAdapter` (has `isAwake` with the side-effecting `awake--`, no `skipTicks`, `aquarelleBake.test.ts:485-523`) still satisfies its pinned `stepsBefore === 114` and `stepsByFrame[3] >= 120` — probing the gap walker would have drained that budget and failed them. `git diff d7d43a8b..27702a84` removed-line count = 0 in all three modified test files |
| 4 | Exactly three gap walks route through `stepGap`; fallback loop, fix bake, cook-to-sleep loop, legacy per-stroke branch and `renderPartialStrokes` keep their exact tick law; capture count, windows, `onStrokeFed` order and Dry ordering unchanged | ✓ VERIFIED | `grep 'stepGap('` → `aquarelleBake.ts:431` declaration + calls at `:642` (pre-stroke), `:658` (trailing-Dry pre-gap), `:664` (window tail). Only tick-law edits elsewhere are `adapter.stepTick` → `stepTimeline` (`:671`, `:684`, `:690`, `:838`); `FIX_SETTLE_TICKS`/`SETTLE_MAX_TICKS` unchanged. Row (f) pins Dry-after-windowEnd ordering and unchanged feeds (`:1090-1118`); row (h) pins 3 captures, equal feeds and equal bytes per frame (`:1246-1271`) |
| 5 | `onDiagnostics` fires exactly once per `bake()` on every path (timed/fallback/legacy, cancelled/failed), never throws; reports the 8 documented fields | ✓ VERIFIED | `aquarelleBake.ts:313-322` swallows consumer throws (T-bks-02); emission from the `bake()` `finally` at `:897-900`, one per-call accumulator at `:766-780`. Rows: (g1) one timed record + counter law, (g2) gapCount, (g3) fallback, (g4) legacy, (g5) throwing consumer survives, (g6) cancelled still emits once (`:1120-1244`); app helper owns the failed-result case (`physicsPaintRotoPlayScriptApplyBake.test.ts:139-156`) |
| 6 | App measures `adapterCreateMs` = creation span + `finally` teardown span, merges it into the diagnostics forwarded by `bakeAquarelleEventsToFrame`, `applyAquarelleEventsToKey` passes it through, Studio `script-bake` and both `lift-erase` flows carry the merged object | ✓ VERIFIED | `physicsPaintRotoPlayScriptController.ts:1892-1940` — `createStartedAt` before `createDefaultAquarelleAdapter` (a dynamic import), teardown clock around `bake.dispose(); adapter.dispose();`, callback last inside `finally`; pass-through at `:1961-1970`. Studio: apply port `:1844-1851` + `script-bake` `diagnostics: bakeDiagnostics` `:1996`; ensure flow `:6153-6161` with 3 `diagnostics: recoveryDiagnostics` records (`:6174`, `:6199`, `:6228`) and honest `diagnostics: null` before any bake (`:6147`); lift transaction `:6411-6502` with records at `:6436`, `:6477`, `:6553`. Mocked suite proves forwarding, finite merge, failure emission and dispose→callback order (`physicsPaintRotoPlayScriptApplyBake.test.ts`, 5 rows) |
| 7 | No visual law, sample feeding, window allocation, live RNG, settle cap or host `EngineAdapter` interface changed | ✓ VERIFIED | `git diff --name-only d7d43a8b..27702a84 -- packages/efx-paint-host` → 0 files; whole diff is 8 files, all inside the plan's `files_modified`; no `setRandom`/`seededRandom`/`Math.random`/window-allocation edits in the diff; `FIX_SETTLE_TICKS` and `aquarelleVisibleSettleTicks` untouched; no new dependency, no feature flag, no pooling |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Deferred Items

None. This is a quick task inside milestone v2.0.0 with no later-phase roadmap section to defer to; every plan item is implemented.

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | `skipTicks(from,to)`: `disposed \|\| !engine` early return BEFORE any clock add, one `advanceClock(1000*HOST_DT)` per tick, no `engine.tick`, no render | ✓ VERIFIED | `:272-280`; guard mirrors `stepTick` at `:369` exactly; counted loop, never a single multiply; declared on the return type at `:123-128` |
| `packages/efx-watercolor/src/bake/aquarelleBake.ts` | `AquarelleBakePath`, `AquarelleBakeDiagnostics`, `AquarelleBakeOptions.onDiagnostics`, internal `stepGap`, per-bake counters, once-per-bake emission | ✓ VERIFIED | `:83-136` types (Counter law JSDoc verbatim), `:174-180` option, `:304-322` countedStep + emitDiagnostics, `:383-452` stepGap, `:897-900` finally |
| `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` | Parity baseline, skip parity, per-gap law, truth-table rows, trailing-Dry ordering, diagnostics, capture parity | ✓ VERIFIED | `:811-1272`, 15 new tests; purely additive (0 removed lines); no `it.skip` |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | `AquarelleApplyDiagnostics`, `onDiagnostics` input with `adapterCreateMs` across create + finally teardown (fires on every exit), pass-through | ✓ VERIFIED | `:1854-1872` type + zeroDiagnostics, `:1879-1941` helper, `:1953-1970` pass-through |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Apply port captures diagnostics into `script-bake`; both Lift base-recovery bakes capture it and every `lift-erase` record of those flows carries it | ✓ VERIFIED | `:1844-1851`, `:1996`; ensure flow `:6147`,`:6153`,`:6174`,`:6199`,`:6228`; transaction flow `:6411`,`:6436`,`:6477`,`:6500`,`:6553`. Diff is local-variable plumbing only — no `useState`, signal or effect added |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts` | Module-mocked proof of forwarding, finite `adapterCreateMs`, failure emission, dispose-then-callback order | ✓ VERIFIED | New 215-line file, 5 tests, `.test.ts` (collected — ran in the suite), all mocks `vi.hoisted` |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `skipTicks` seam | `stepTick` law | guard before every clock add | ✓ WIRED | `engineAdapter.ts:273` vs `:369` — identical `if (disposed \|\| !engine) return`; clock adds only after it |
| `canSkip` gate | `isAwake` probe | `typeof skipTicks === 'function' && typeof isAwake === 'function'` | ✓ WIRED | `aquarelleBake.ts:419`, short-circuits at `:436`; the pinned existing doubles prove zero probes empirically |
| `stepGap` | `bakeProgressive` scope | declared inside it, `cursor` by value | ✓ WIRED | `:431`; no `cursor` read/write inside the helper; three callers own their cursor |
| Per-gap tick accounting | no-skip clock | stepped + skipped === gap length; strict clock equality | ✓ WIRED | rows (c) and (d) pass; `skippedGapTicks` incremented only at `:444` with `toTick - skipFrom` |
| `adapterCreateMs` | Studio publish closure | helper `finally` runs after both disposes, before return | ✓ WIRED | `controller.ts:1923-1939`; order pinned by `physicsPaintRotoPlayScriptApplyBake.test.ts:158-169`; Studio comment at `:1842-1843` records the dependency |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `aquarelleBake.ts` diagnostics record | `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs` | Live per-bake counters incremented at the actual step sites (`:606`,`:617`,`:836`; `countedStep` `:304-307`; settle `:685`,`:691`; encode timing `:712-714`,`:857-859`; clock `readNow` `:268`) | Yes | ✓ FLOWING |
| `PhysicsPaintStudio` `script-bake` / `lift-erase` events | `diagnostics` | Helper callback → local captured in the port/flow closures → render-split record (`Studio.tsx:1996`, `:6174`, `:6199`, `:6228`, `:6436`, `:6477`, `:6553`) | Yes — the object is the very record the bake emitted (or the documented zero/null fallbacks), never a hardcoded literal | ✓ FLOWING |
| `adapterCreateMs` | number | Wall clock around adapter create (`:1892-1897`) + teardown (`:1924-1929`) | Yes — measured, not constant | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Package typecheck | `pnpm --filter @efxlab/efx-watercolor run check` | clean (exit 0) | ✓ PASS |
| Package suite (existing assertions unedited + 15 new rows) | `pnpm --filter @efxlab/efx-watercolor run test` | 154 passed \| 4 skipped (158); `aquarelleBake.test.ts` 40 tests, `engineAdapter.test.ts` 13 (4 GPU-skipped) | ✓ PASS |
| Built package serves the new seam/types to the app | `stat` + symbol scan of `packages/efx-watercolor/dist` | `dist` built 08:30:09, after the final commit 08:26:07; contains `skipTicks` and `AquarelleBakeDiagnostics` | ✓ PASS |
| App typecheck | `pnpm --filter efx-motion-editor run typecheck` | clean (exit 0) | ✓ PASS |
| Targeted 7 suites | `pnpm exec vitest run <7 suites>` | 7 files, 481 passed | ✓ PASS |
| Full app regression suite (plan gate 6) | `pnpm exec vitest run` | 351 passed \| 2 skipped files; 6,247 passed \| 1 skipped \| 96 todo; exit 0 | ✓ PASS |
| Skip removed when the seam is absent | `withoutSkipSeam` rows (b) and the pinned existing counts | `off.log.skips === []`; pinned `stepsBefore`/`stepsByFrame` unchanged | ✓ PASS |

### Probe Execution

No probes are declared or implied by this quick task (no `scripts/*/tests/probe-*.sh`), and neither PLAN nor SUMMARY claims probe-based verification. Step 7c: SKIPPED (no probes).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| — | `requirements: []` | Quick task: the CONTEXT decision set is the requirement source | N/A | No ROADMAP requirement IDs apply |
| D1 | CONTEXT.md | `skipTicks` clock-only seam with the disposed-before-clock guard, per-tick adds | ✓ SATISFIED | `engineAdapter.ts:272-280`; `engineAdapter.test.ts` new `describe('skipTicks (261029-bks)')` |
| D2 | CONTEXT.md | `stepGap` used by exactly three walks | ✓ SATISFIED | grep: 1 declaration + 3 calls |
| D3 | CONTEXT.md | Gap law: probe-before-step, one boundary tick, re-check, skip only with both seams | ✓ SATISFIED | `aquarelleBake.ts:431-452`; rows (e1)-(e3) |
| D4 | CONTEXT.md | `onDiagnostics` once per bake, field list + path, never throws | ✓ SATISFIED | `aquarelleBake.ts:122-131`, `:313-322`, `:897-900`; rows (g1)-(g6) |
| D5 | CONTEXT.md | App threading: helper `onDiagnostics`, `adapterCreateMs` create+teardown, Apply pass-through, Studio `script-bake` + two `lift-erase` flows | ✓ SATISFIED | controller `:1854-1970`; Studio `:1844-1851`,`:1996`,`:6147-6228`,`:6411-6553` |
| D6 | CONTEXT.md | Parity baseline first, rows (a)-(h), existing package tests unedited | ✓ SATISFIED | rows (a)-(h) at `aquarelleBake.test.ts:974-1272`; 0 removed lines in all modified test files |
| D7 | CONTEXT.md | Adapter creation cost measured, not optimised; no pooling; no runtime feature flag | ✓ SATISFIED | `adapterCreateMs` only; no pooling code, no flag in the diff |

**Decision Coverage (gate):** `gsd-tools query check.decision-coverage-verify` → `{"skipped": true, "blocking": false, "reason": "no trackable decisions", "total": 0}`. The gate's trackable-decision parser does not recognise this CONTEXT.md's `###`-headed decision block, so it skipped; the seven decisions were assessed manually above and all are honored. Non-blocking by design.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` (261029-bks block) | D2, D3, D4, D6 | 15 | 0 | No (expected values are fixture-derived constants and log-derived relationships, not outputs of the system re-fed in) | Behavioral (byte identity, ordered event log, strict clock equality, counter law) | SUFFICIENT |
| `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` (new `it`) | D1 | 1 | 0 | No | Existence + no-throw (as the plan specified) | SUFFICIENT for the seam; the clock parity it enables is proven at bake level (rows b, d) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts` | D5 | 5 | 0 | No (module mocks are recorders, not oracles) | Behavioral (forwarding, merge, failure path, ordered dispose log, throwing consumer) | SUFFICIENT |
| `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` (new `it`) | D5 | 1 | 0 | No | Source pin (the file's existing idiom), counts 3 + 3 `lift-erase` records and both bake blocks | SUFFICIENT as a wiring pin |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0. **Insufficient assertions:** 0.
Pre-existing `describe.skipIf(!gpu)` in `engineAdapter.test.ts` is untouched and unrelated (GPU-only suite).

Non-blocking observation: row (c)'s per-gap "gap length" is derived from the contiguous stepped run in the log rather than from an independently declared `[a,b)`. On its own that arithmetic would tolerate a uniformly shifted skip range; rows (e1)-(e3) close that hole by pinning the exact skip ranges and step lists against fixture geometry, so the truth is not left resting on row (c).

**Reliance check (advisory):** no `coincidental-reliance` findings. The one model-dependent claim — byte identity — rests on CONTEXT.md's declared precondition that `Engine.tick` is a no-op while asleep (`isAwake` false implies `active === null`), which is the phase's agreed contract, not an undeclared assumption.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX` in any of the 8 modified files; no placeholder returns, no empty handlers, no hardcoded-empty props introduced by the diff; the only swallowed throw is the documented T-bks-02 consumer guard | ℹ️ Info | None |

### Human Verification Required

#### 1. Diagnostics on a real long-gap Apply

**Test:** Open the Studio, Apply a watercolor script whose recording contains a long idle gap (tens of seconds), then read `/tmp/efx-aquarelle-render-split.json`.
**Expected:** `script-bake.diagnostics.skippedGapTicks` > 0 and close to the recorded gap length; `simulatedTicks` a small fraction of `timelineTicks` (report the saving as `simulatedTicks / timelineTicks`); `path === 'timed'`; `adapterCreateMs` present and small relative to the bake wall time (the <5% judgement).
**Why human:** Requires a real recorded Studio session and the native capture file; vitest cannot reproduce wall-clock idle gaps or the Tauri-hosted encode path.

#### 2. Bake determinism against a pre-change baseline

**Test:** Compare `bakeFrame.digest` and `bakeInk` of that Apply with a previous Apply of the same untouched script.
**Expected:** Both unchanged.
**Why human:** The package parity suite uses a double; the real-engine byte identity against a pre-change artifact can only be observed on disk.

#### 3. Lift recovery diagnostics

**Test:** Perform one scripted Lift (or the legacy-key Lift base recovery), then read the `lift-erase` events.
**Expected:** `diagnostics` present on both `base-recovery-ok` and `base-recovery-failed`, with the same field set plus `adapterCreateMs`.
**Why human:** The lift transaction requires live paint, the real recovery validation and the native render-split writer.

#### 4. Visual identity and perceived speed

**Test:** Judge only what automation cannot: the applied key and the Lift erase look identical to before, and Apply on a long-gap script is visibly faster.
**Expected:** No visible difference in the applied wash or the erase; a visible Apply speed-up on long-gap scripts.
**Why human:** Visual identity and perceived speed are human judgement on a live session.

### Gaps Summary

No gaps found. Every must-have truth is implemented in the code (not just reported), the three gap walks are exactly the agreed three, adapters without the seam provably keep the old tick law (the existing pinned-count tests would have failed if the gate probed `isAwake`), the boundary tick and clock parity are pinned against fixture geometry, diagnostics are emitted once per bake from a `finally` on every path, and the app carries a measured `adapterCreateMs` into the `script-bake` and both `lift-erase` flows on success and failure. All six automated gates pass when re-run by this verifier (the full app suite included). What remains is the native UAT the plan explicitly reserved for the user — hence `human_needed`, not `passed`.

---

_Verified: 2026-10-29T07:34:51Z_
_Verifier: Claude (gsd-verifier)_
