---
phase: quick-261029-bks
plan: 261029-bks
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 — package: adapter seam + bake gap walk + diagnostics + parity tests
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  # Task 2 — app: helper diagnostics + adapterCreateMs + render-split wiring + tests
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "On a recorded-timeline bake whose adapter exposes `skipTicks`, idle-gap ticks execute while the engine is awake and become clock-only once `isAwake()` reads false; the final virtual clock is strictly equal (`toBe`) to a skip-OFF bake and the captured bytes are identical."
    - "The sleep-transition boundary tick always runs: the tick that first observes sleep is executed on the engine (its `sleep()`/`render()` flush) before the remainder of that gap is skipped, so a tick that closes the previous stroke or flushes a dirty rect is never lost."
    - "Adapters without `skipTicks` (every existing test double, older adapters) step every gap tick and receive ZERO `isAwake` probes from the gap walker — the existing package suite stays green UNEDITED."
    - "Exactly three gap walks route through `stepGap` (pre-stroke gap, trailing-Dry pre-gap, window tail); the fallback diffusion loop, the fix bake, the cook-to-sleep loop, the legacy per-stroke branch and everything inside `renderPartialStrokes` keep their exact tick law; capture count, per-frame windows, `onStrokeFed` order and Dry ordering are unchanged."
    - "`onDiagnostics` fires exactly once per `bake()` on every path (timed / fallback / legacy, including a cancelled or failed bake) and can never throw into the bake; it reports `path`, `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs`."
    - "The app measures `adapterCreateMs` as the sum of the adapter creation span (`createDefaultAquarelleAdapter` incl. its dynamic import and engine construction) and the `finally` teardown span (`bake.dispose(); adapter.dispose();`), merges it into the diagnostics it forwards from `bakeAquarelleEventsToFrame`, `applyAquarelleEventsToKey` passes it through, and the Studio's `script-bake` and `lift-erase` render-split events carry the merged object."
    - "No visual law, sample feeding, window allocation, live RNG, settle cap, or the host `EngineAdapter` interface (`packages/efx-paint-host`) changed."
  artifacts:
    - path: "packages/efx-watercolor/src/adapter/engineAdapter.ts"
      provides: "`skipTicks(fromTick, toTick)` on the returned adapter: `disposed || !engine` early-return BEFORE any clock add, then one `advanceClock(1000 * HOST_DT)` per tick (never a single multiply), no `engine.tick`, no render."
    - path: "packages/efx-watercolor/src/bake/aquarelleBake.ts"
      provides: "`AquarelleBakePath`, `AquarelleBakeDiagnostics`, `AquarelleBakeOptions.onDiagnostics`, the internal `stepGap` helper wired to the three gap walks, per-bake counters, once-per-bake emission."
    - path: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts"
      provides: "the parity baseline (skip-OFF byte identity), skip-ON == skip-OFF bytes and clock, per-gap stepped+skipped == gap length, the truth-table rows, trailing-Dry ordering, diagnostics counters/once-per-bake/never-throw, capture and pointCount parity."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      provides: "`AquarelleApplyDiagnostics` type, `bakeAquarelleEventsToFrame` `onDiagnostics` input with `adapterCreateMs` measured across adapter create + finally dispose (fired on every exit), `applyAquarelleEventsToKey` pass-through."
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "apply port captures the last diagnostics into a local and adds `diagnostics` to the `script-bake` event; both Lift base-recovery bakes (:6144, :6472) capture it and every `lift-erase` record of those flows carries `diagnostics` on success and failure."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts"
      provides: "module-mocked proof that the helper forwards `onDiagnostics`, merges a finite `adapterCreateMs`, fires on failure, and disposes bake then adapter before the callback."
  key_links:
    - "`skipTicks`'s `disposed || !engine` early-return mirrors `stepTick` exactly (engineAdapter.ts:348-354); a clock add before that guard would desynchronise the virtual clock from a no-skip run and break the bit-identity contract."
    - "The `canSkip` gate requires BOTH `skipTicks` and `isAwake` to be functions and short-circuits before any probe, which is what keeps `makeTimelineAdapter`'s pinned tick counts (:565, :579, :608, :720, :755, :760, :774) valid without edits."
    - "`stepGap` is declared inside `bakeProgressive` (it needs the adapter, the captured seams and the per-bake counters); `cursor` is passed by value and assigned by the caller, so no walk can move another walk's cursor."
    - "Per gap, `stepTick` calls with an index inside the gap plus `skippedGapTicks` equals the gap length, and the final virtual clock is strictly equal to the no-skip run. No global `timelineTicks === simulatedTicks + skippedGapTicks` identity is claimed: sample ticks run inside the adapter, clamp-adjacent strokes can feed more samples than the window span, and settle steps sit outside every window span."
    - "`adapterCreateMs` is the adapter lifecycle cost — creation span plus teardown span — and the callback is invoked in the helper's `finally` AFTER `bake.dispose(); adapter.dispose();`, so the Studio's `publish` closure (which runs after the helper returns) always reads a populated local. It must NOT span the bake itself: the field answers 'how much does the adapter cost per Apply', which is what the user's <5%-of-wall-time judgement reads."
---

<objective>
Stop the aquarelle bake from simulating tens of thousands of idle ticks: skip gap ticks ONLY while the engine is provably asleep, with byte-identical output and a bit-identical virtual clock, and emit one diagnostics record per bake so the saving is measurable.

The recorded timeline keeps the artist's wall-clock idle gaps (`buildRecordedTimeline`, `aquarelleBake.ts:251`) and the timed bake steps every gap tick through `adapter.stepTick` (`aquarelleBake.ts:497`, `:510-512`, `:517`). A 435 s pause between two Lift strokes becomes ~26,100 simulated 60 Hz ticks in a single-frame Apply bake. The engine's tick is already a no-op while asleep except for the clock (`Engine.tick` only resets `brushNow.r`, `processInput` early-returns, `render()` early-returns on a clean flag, `sleep()` is gated on `active`), so the only observable effect of those ticks is the virtual clock — which a clock-only seam reproduces add-for-add.

Purpose: every Apply and every script edit stops paying for the artist's pauses, without moving a single pixel.

Output: an optional `skipTicks` adapter seam, a `stepGap` gap walker used by exactly three walks, an optional `onDiagnostics` bake option, app-side `adapterCreateMs` measurement threaded into the existing `script-bake` / `lift-erase` render-split events, and a parity test suite that never touches an existing assertion.

## Locked design (from CONTEXT.md — never revisit)

1. `skipTicks?(fromTick, toTick)` on the aquarelle adapter, implemented beside `isAwake`/`fix`. It MUST early-return on `disposed || !engine` BEFORE any clock add (mirrors `stepTick`) and MUST advance the virtual clock with per-tick `advanceClock(1000 * HOST_DT)` additions (bit-identical; never a single multiply). No `engine.tick`, no render.
2. One internal `stepGap(fromTick, toTick)` helper used by EXACTLY THREE gap walks: the pre-stroke gap (:497), the trailing-Dry pre-gap (:510-512) and the window tail (:517). NEVER the fallback non-timed loop (:523), the fix bake (:535), the cook-to-sleep loop (:537), the legacy per-stroke branch (:611), or anything inside `renderPartialStrokes`.
3. Gap law: step while awake (probe BEFORE each step); when `isAwake()` first reads false, run ONE mandatory boundary `stepTick`, re-check, then clock-skip the remainder. Skipping requires BOTH `skipTicks` and `isAwake`; when `skipTicks` is absent, call NO `isAwake` probes and step every tick. Never cross a Dry, a window bound, or the settle law. Capture count, per-frame windows, `onStrokeFed` and Dry ordering unchanged.
4. Diagnostics: optional `onDiagnostics?: (d: AquarelleBakeDiagnostics) => void` on `AquarelleBakeOptions`, exactly once per `bake()` (progressive and legacy), fields `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs`, plus `path: 'timed' | 'fallback' | 'legacy'`. The callback must never throw into the bake.
5. App wiring: `bakeAquarelleEventsToFrame` gains an optional `onDiagnostics` input, measures `adapterCreateMs` around `createDefaultAquarelleAdapter` + the `finally` dispose, and merges it into the diagnostics it forwards. `applyAquarelleEventsToKey` passes it through. The Studio apply port captures the last diagnostics in a local and adds it to the existing `recordAquarelleRenderSplitEvent('script-bake', …)` (:1983) payload; the two Lift base-recovery bakes (:6144, :6472) do the same for their `lift-erase` events, on success and failure.
6. Parity baseline FIRST, in test order: (a) two skip-OFF bakes of one fixture are byte-identical; (b) skip-ON equals skip-OFF bytes on a fixture whose double sleeps across a gap; (c) per-gap stepped+skipped === gap length; (d) final virtual clock strict equality; (e) truth-table rows; (f) trailing-Dry order; (g) diagnostics once-per-bake and counter values; (h) capture count/windows/pointCounts unchanged. Existing package tests stay green UNEDITED — any edit to an existing assertion is a red flag to escalate, not a fix.
7. Adapter creation cost is MEASURED by `adapterCreateMs`, not optimised. No pooling. No runtime feature flag.

## Truth table (agreed — the executor must not invent a row)

| Gap state | Simulated ticks | Skipped | Clock after gap | Capture / output |
|---|---|---|---|---|
| engine awake throughout | all `b−a` | 0 | `+ (b−a) × (1000/60)` ms | unchanged |
| awake → asleep at tick `s` | `[a,s)` + one boundary tick | `(s,b)` | identical to no-skip | unchanged |
| asleep throughout | one boundary tick at `a` | `(a,b)` | identical to no-skip | unchanged |
| trailing Dry | gap to `windowEnd` may skip; the Dry fires AFTER the clock reaches `windowEnd` (its fix + 30 ticks unchanged) | — | unchanged | unchanged |
| final settle | `settleCapped` → `fix()` + 72 `FIX_SETTLE_TICKS` (never skipped); else cook-to-sleep already exits at `isAwake() === false` | 0 | unchanged | unchanged |
| window end (Play) | the gap never crosses `windowEnd` | — | unchanged | unchanged |

## Counter law (one reading — do not invent a second)

- `timelineTicks`: the timed path sums each window's tick span (`tickBudget` per frame); the fallback path sums `tickBudget`; the legacy path sums the clamped cuisson per stroke.
- `simulatedTicks`: ACTUAL `adapter.stepTick(...)` invocations made by the bake — gap-walk steps, the fallback diffusion steps, the legacy cuisson steps and the end-frame settle steps. It EXCLUDES the sample ticks (they run inside the adapter's `renderPartialStrokes`/`feedDueSample`, never through `stepTick`) and the adapter-internal Dry drain (30 clock+tick pairs inside `applyDry`). This is the CONTEXT-locked definition; `settleTicks` is the subset of these calls owned by the settle law.
- `skippedGapTicks`: clock-only ticks advanced by `skipTicks`.
- `settleTicks`: end-frame settle `stepTick` calls (`FIX_SETTLE_TICKS` on the fix bake, the guard count on the cook-to-sleep). Subset of `simulatedTicks`.
- `gapCount`: gap ranges with `toTick > fromTick` walked by `stepGap`.
- Invariant the tests pin (per gap, not global): for every gap `[a,b)`, `stepTick` calls with an index inside `[a,b)` plus `skippedGapTicks` for that gap equals `b − a`, and the virtual clock is strictly equal to the no-skip run. There is NO global `timelineTicks === simulatedTicks + skippedGapTicks` identity: sample ticks run inside the adapter (never through `stepTick`), `buildRecordedTimeline` clamps `beginTick` to `previousEnd` so clamp-adjacent strokes can feed more samples than the window span, and the settle steps sit outside every window span. `skippedGapTicks === 0` on the fallback and legacy paths.
- `bakeMs`: wall time from `bake()` entry to its return; `encodeMs`: accumulated `encodeWebp` wall time (cumulative across frames; overlapping encodes may double-count — document it, do not "fix" it).

## Out of scope (do not expand)

- No change to `packages/efx-paint-host` (the `EngineAdapter` interface stays as-is; `skipTicks` is an optional extension detected by cast).
- No visual law, sample feeding, window allocation, RNG (`setRandom(seededRandom(...))` untouched), settle cap or `FIX_SETTLE_TICKS` change.
- No pooling of adapter creation, no runtime feature flag, no new dependency, no new package export beyond the diagnostics type (already covered by `export * from './aquarelleBake'`).
- No live-vs-bake byte comparison (live uses `Math.random`, bake uses the seeded RNG) and no native UAT executed by the executor.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261029-bks-watercolor-replay-optimisation/261029-bks-CONTEXT.md
@.planning/quick/261029-bks-watercolor-replay-optimisation/261029-bks-RESEARCH.md
@packages/efx-watercolor/src/bake/aquarelleBake.ts
@packages/efx-watercolor/src/adapter/engineAdapter.ts
@packages/efx-watercolor/src/bake/aquarelleBake.test.ts
@packages/efx-watercolor/src/playground/Engine.ts
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Package — `skipTicks` adapter seam, `stepGap` gap walker, once-per-bake diagnostics, parity test suite</name>
  <files>packages/efx-watercolor/src/adapter/engineAdapter.ts, packages/efx-watercolor/src/adapter/engineAdapter.test.ts, packages/efx-watercolor/src/bake/aquarelleBake.ts, packages/efx-watercolor/src/bake/aquarelleBake.test.ts</files>
  <behavior>
    Write the RED tests first (they compile against the new double's own local type, so they fail on behaviour, not on types): a `makeSkippingAdapter` double in `aquarelleBake.test.ts` with a wet budget, a `virtualNow` clock advanced by `1000 * HOST_DT` on every `stepTick` AND every skipped tick, a `steps: number[]` log, a `skips: { from: number; to: number }[]` log, an ordered `events` log (`step` / `skip` / `feed` / `dry` / `capture`), `isAwake` reading a budget that `renderPartialStrokes` (a fed sample) refills, `skipTicks` that records and advances the clock only, and a `stepTick` that mutates the mock canvas ONLY while awake so a tick taken while asleep is a true no-op. Then the rows:
    - (a) Skip-OFF parity baseline: two bakes of one timed fixture with a `skipTicks`-less double produce byte-identical frames (timed path, `frameCount: 1`).
    - (b) Skip-ON == skip-OFF bytes: the same fixture whose double sleeps across a long gap produces byte-identical bytes with and without the seam.
    - (c) Per-gap law: for every `skips` entry, `to - from > 0`, no `steps` entry has an index inside `[from, to)`, exactly one `stepTick` sits at `from - 1` (the mandatory boundary tick), and for that gap `stepTick` calls inside `[a,b)` plus `to - from === b − a`. Do NOT assert a global `timelineTicks === simulatedTicks + skippedGapTicks` identity (sample ticks run inside the adapter and clamp-adjacent strokes can feed more samples than the window span).
    - (d) Clock bit-identity: the double's final clock is strictly `toBe` equal between skip-ON and skip-OFF (never `toBeCloseTo`).
    - (e) Truth-table rows: awake-throughout → `skips` empty, steps equal the gap length; awake→asleep at `s` → steps `[a,s)` plus one boundary step, skip `(s,b)`; asleep-throughout → exactly one step then one skip covering the rest.
    - (f) Trailing-Dry ordering: with a Dry after the last stroke, the Dry's `applyStroke` appears in the ordered log AFTER the final window's last step/skip and BEFORE the capture — the produce applies trailing Drys at :513-515, ahead of `captureFrame()` at :542 — so the clock reached `windowEnd` first; capture count and per-frame `pointCounts` equal the skip-OFF run.
    - (g) Diagnostics: `onDiagnostics` called exactly once per `bake()`; `path` is `'timed'` with recorded timestamps, `'fallback'` when the timestamps are unusable (timestamp 0), `'legacy'` without `frameCount`; `skippedGapTicks` equals the double's skip total; `gapCount` counts only ranges with length > 0; `settleTicks` equals `72` on a `withFix` fixture and is > 0 on the cook-to-sleep path; a throwing `onDiagnostics` consumer never fails the bake; a cancelled bake still emits exactly once.
    - (h) Capture count/windows unchanged: with the skipping double, `captures === frameCount` and every render entry's `pointCount` matches the skip-OFF run.
    - `engineAdapter.test.ts`: exactly one NEW `it` (no existing assertion edited) — the adapter exposes a `skipTicks` function, calling it with `(0, 10)` does not throw, and calling it after `dispose()` does not throw (the `disposed || !engine` early return).
  </behavior>
  <action>
    Work test-first, parity-first: add the double and rows (a)-(h), run and confirm the RED failures, then implement, then re-run.

    packages/efx-watercolor/src/adapter/engineAdapter.ts:
    1. Extend the declared return type of `createAquarelleEngineAdapter` with `skipTicks(fromTick: number, toTick: number): void` and a doc comment: "Clock-only advance for an idle gap the bake proved asleep. Never calls engine.tick or render; one `advanceClock(1000 * HOST_DT)` per tick so the virtual clock stays bit-identical to per-tick stepping."
    2. Implement it in the returned object beside `isAwake`/`fix`: first `if (disposed || !engine) return` (the exact `stepTick` law — the guard must precede every clock add), then `if (!(toTick > fromTick)) return`, then a counted loop (`let remaining = toTick - fromTick; while (remaining > 0) { advanceClock(1000 * HOST_DT); remaining -= 1 }`). NEVER collapse to `advanceClock((toTick - fromTick) * 1000 * HOST_DT)` — n sequential float adds are the contract; a single multiply is not bit-identical. No `engine.tick`, no `render`, no state mutation other than `virtualNow`.

    packages/efx-watercolor/src/bake/aquarelleBake.ts:
    3. Export `type AquarelleBakePath = 'timed' | 'fallback' | 'legacy'` and `interface AquarelleBakeDiagnostics` with readonly `path`, `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs`. Copy the Counter law section into the interface JSDoc verbatim (it is the contract the tests pin; `simulatedTicks` counts actual `stepTick` calls only, the Dry drain counts in no counter). Also declare a NON-exported mutable accumulator type so the mutations type-check: `type MutableBakeDiagnostics = { -readonly [K in keyof AquarelleBakeDiagnostics]: AquarelleBakeDiagnostics[K] }`. The per-call accumulator is a `MutableBakeDiagnostics`; `countedStep` takes a `MutableBakeDiagnostics`; `emitDiagnostics` passes it as `AquarelleBakeDiagnostics` (readonly is assignable from mutable).
    4. Add `onDiagnostics?: (d: AquarelleBakeDiagnostics) => void` to `AquarelleBakeOptions` beside `onStrokeFed` (:118), documenting "exactly once per bake(), never throws into the bake, a consumer must not throw".
    5. In `createAquarelleBake`: add a module-local `readNow()` using `performance.now()` when available, `Date.now()` otherwise. Add a mutable per-call accumulator created INSIDE `bake()` (typed `MutableBakeDiagnostics`: all counters 0, `path: 'legacy'`), a `startedAt` read at entry, and emit once from a `finally` around the whole dispatch (so cancelled/failed bakes report too) via `emitDiagnostics`, which wraps `options.onDiagnostics` in try/catch and returns silently on a throw. Set `bakeMs` at emit time. `AquarelleBakeResult` shape is unchanged.
    6. Time the encoder: in the progressive `produce`, wrap `await encodeWebp(frame, width, height)` with `readNow()` around it and add the elapsed to `encodeMs`; do the same in the legacy `produce`. Keep the existing `tick`/`frameIndex` fields untouched.
    7. `bake()` passes the accumulator as a third argument to `bakeProgressive(events, frameCount, diagnostics)`. Do not export the third parameter.
    8. In `bakeProgressive`: replace `awakeProbe` (:292) with one captured seam cast `const seams = adapter as EngineAdapter<AquarelleStrokePayload> & { isAwake?: () => boolean; fix?: () => void; skipTicks?: (fromTick: number, toTick: number) => void }`; the settle-law cast at :532 reuses it. Set `diagnostics.path = timed ? 'timed' : 'fallback'` immediately after `timedBase` is computed. Compute `const canSkip = typeof seams.skipTicks === 'function' && typeof seams.isAwake === 'function'`.
    9. Add ONE counting-wrapper factory beside `readNow()` in `createAquarelleBake`: `const countedStep = (d: MutableBakeDiagnostics) => (tick: number) => { d.simulatedTicks += 1; adapter.stepTick(tick) }`. Bind it in the TWO scopes that own a counted step site, both named `stepTimeline`: (i) in `bake()`, immediately after the per-call accumulator is created (item 5) — `const stepTimeline = countedStep(diagnostics)` — the wrapper the legacy cuisson loop (:665-667) calls; (ii) in `bakeProgressive`, immediately after `canSkip` (item 8) — `const stepTimeline = countedStep(diagnostics)` — the wrapper the fallback loop (:524) and `stepGap` call. No counted `adapter.stepTick(` survives outside those two bindings' reach; the settle sites keep the raw call (item 12). Declare `stepGap(fromTick, toTick)` inside `bakeProgressive`: return immediately when `toTick <= fromTick`; otherwise `gapCount += 1`, then loop — when `canSkip` is true probe `seams.isAwake!()` BEFORE each step; if it reads true (or `canSkip` is false) call `stepTimeline(tick)` and `tick += 1`; if it reads false, call `stepTimeline(tick)` (the mandatory boundary tick), `tick += 1`, RE-CHECK `isAwake()` once, and only then, while `tick < toTick`, call `seams.skipTicks!(tick, toTick)`, add `toTick - tick` to `skippedGapTicks` and set `tick = toTick`; a true re-check falls through to further stepping. `stepGap` must not read or mutate `cursor`.
    10. Route EXACTLY THREE walks through `stepGap`: (i) `:497` `for (let tick = cursor; tick < firstTick; …)` becomes `stepGap(cursor, firstTick)`; (ii) the trailing-Dry block `:510-512` becomes `stepGap(cursor, windowEnd)` followed by the existing `cursor = windowEnd` and the untouched Dry `applyStroke` loop; (iii) the window tail `:517` becomes `stepGap(cursor, windowEnd)`. Do NOT touch the fallback loop `:523-525` except to call `stepTimeline(tick)` instead of `adapter.stepTick(tick)`, the fix bake `:535` or the cook-to-sleep loop `:537-539` except to call `stepTimeline` while also counting `settleTicks += 1`, the legacy cuisson loop `:665-667` except `stepTimeline(tick)`, or anything inside `renderPartialStrokes`.
    11. Counters at their sources: in the per-frame window computation add `diagnostics.timelineTicks += tickBudget` in BOTH branches (timed after `tickBudget = Math.max(0, windowEnd - previousWindowEnd)` is computed, fallback after its `tickBudget` is set); in the legacy `produce` add `diagnostics.timelineTicks += cuisson` immediately before its cuisson loop. Do NOT add sample feeds to `simulatedTicks` — fed samples tick inside the adapter and never call `stepTick`; `simulatedTicks` is incremented only by the `countedStep` wrapper.
    12. Keep the settle law's behaviour byte-identical: `settleCapped` + `fix` seam still runs `fix()` then 72 `stepTimeline` stepTicks (each increments `simulatedTicks` AND `settleTicks += 1`); the cook-to-sleep loop still runs `while (guard < SETTLE_MAX_TICKS && isAwake())` with `stepTimeline(guard)` and `settleTicks += 1`. It must never call `stepGap` or the skip seam.

    packages/efx-watercolor/src/bake/aquarelleBake.test.ts:
    13. Add the `makeSkippingAdapter` double and one new describe for rows (a)-(h). Build the double's type locally (`EngineAdapter<AquarelleStrokePayload> & { isAwake; skipTicks; fix?; clock() }`) so nothing depends on package source changes to compile. Use two `timedStroke(...)` fixtures: a short gap (engine awake throughout) and a long gap (engine sleeps mid-gap); a third fixture with a trailing `createDryEvent(...)`. Keep every existing test and every existing assertion byte-identical.
    14. For row (f), assert on the ordered log, not on pixels: the Dry's `applyStroke` index is greater than the index of the last `step`/`skip` event of the final window, and the capture count and per-frame `pointCount`s equal the skip-OFF run.
    15. For row (g), capture diagnostics with a `let` array and assert `toHaveLength(1)` after each bake; use `Number.isFinite` and `toBeGreaterThanOrEqual(0)` for `bakeMs`/`encodeMs`, never exact timings.

    packages/efx-watercolor/src/adapter/engineAdapter.test.ts:
    16. Append ONE new `it` for the seam's presence and the disposed no-throw law. Do not edit an existing assertion or helper.

    Escalation rule: if any EXISTING package assertion fails, the gate implementation is wrong (most likely `canSkip` probing an `isAwake`-only double) — fix the gate, never the test.
  </action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor run check</automated>
    <automated>pnpm --filter @efxlab/efx-watercolor run test</automated>
  </verify>
  <done>I will see: `skipTicks` on the adapter with the disposed-before-clock guard and per-tick clock adds; `stepGap` used by exactly three walks with probe-before-step, one boundary tick and a re-check; no probes and no skipping when `skipTicks` is absent; `onDiagnostics` firing exactly once per bake on every path and never throwing; and the whole existing package suite green with zero edits to existing assertions, plus the new parity rows (byte identity skip-ON vs skip-OFF, strict clock equality, per-gap law, truth-table rows, trailing-Dry order, counters, capture parity).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: App — `onDiagnostics` + `adapterCreateMs` through the bake helper, `script-bake` and `lift-erase` render-split payloads</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    Write the new module-mocked test first (RED: the helper has no `onDiagnostics` input yet):
    - `physicsPaintRotoPlayScriptApplyBake.test.ts` (new file, must end `.test.ts` — vitest collects only `src/**/*.test.ts`): `vi.mock('@efxlab/efx-watercolor', …)` returning `{ createAquarelleEngineAdapter }` that records its options and an ordered `dispose` log; `vi.mock('@efxlab/efx-watercolor/bake', …)` whose `createAquarelleBake` records its options and returns a bake whose `bake` invokes `harness.nextDiagnostics ? options.onDiagnostics(harness.nextDiagnostics) : undefined` then returns `harness.bakeResult`; `vi.mock('../engine/AquarelleCanvasLayer', () => ({ paperPresetForStudioId: () => undefined }))`; `vi.mock('../../../lib/webpFrameCodec', () => ({ encodeWebpFrame: vi.fn(async () => new Uint8Array([1])) }))`. Rows:
      1. `bakeAquarelleEventsToFrame` passes a function under `onDiagnostics` in the bake options and forwards the emitted diagnostics to its own `onDiagnostics` caller exactly once, merged with a finite, non-negative `adapterCreateMs`.
      2. The caller's callback still fires with `adapterCreateMs` when the bake returns `{ ok: false, reason: 'failed' }` (the helper returns null) — the emission lives in the `finally`.
      3. Ordering: the ordered log shows `bake.dispose`, then `adapter.dispose`, then the diagnostics callback.
      4. `applyAquarelleEventsToKey` forwards `onDiagnostics` to the helper (same assertion reached through the outer function) and still publishes the last baked frame.
      5. A throwing `onDiagnostics` consumer never fails the helper — it still returns the baked bytes.
    - `PhysicsPaintStudio.test.ts` source pins (the file's existing idiom; do NOT touch the counts at :4442-:4443 or the ordering block at :4480-:4495):
      6. the apply port's `applyAquarelleEventsToKey({` block contains `onDiagnostics:`;
      7. the `recordAquarelleRenderSplitEvent('script-bake', …)` data object contains `diagnostics`;
      8. both `bakeAquarelleEventsToFrame({` blocks in the Lift recovery flows contain `onDiagnostics:`, and their `lift-erase` records contain `diagnostics`.
  </behavior>
  <action>
    Work test-first: add the new mocked suite and the Studio pins, watch them fail, then implement.

    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:
    1. Import `type AquarelleBakeDiagnostics` from `@efxlab/efx-watercolor/bake` (extend the existing import block at :34-39). Export `type AquarelleApplyDiagnostics = AquarelleBakeDiagnostics & { adapterCreateMs: number }`.
    2. Add a module-local `readNow()` (`performance.now()` when available, `Date.now()` otherwise) beside the WebP encoder helper.
    3. `bakeAquarelleEventsToFrame` input gains `onDiagnostics?: (d: AquarelleApplyDiagnostics) => void`. Inside: read `createStartedAt = readNow()` immediately BEFORE `await createDefaultAquarelleAdapter(...)` and `let adapterCreateMs = readNow() - createStartedAt` right after it resolves (the span covers the dynamic import + engine construction); declare `let diagnostics: AquarelleBakeDiagnostics | null = null`; pass `onDiagnostics: (d) => { diagnostics = d }` into `defaultCreateAquarelleBake`'s options; in the `finally`, read `teardownStartedAt = readNow()` BEFORE `bake.dispose(); adapter.dispose();`, and AFTER them do `adapterCreateMs += readNow() - teardownStartedAt` — the field is the adapter's lifecycle cost (create + teardown), never the whole bake — then invoke the caller's callback inside try/catch with `{ ...(diagnostics ?? zeroDiagnostics()), adapterCreateMs }`. `zeroDiagnostics()` is a small local returning the full field set with `path: 'timed'` and zeros, used only if the bake never emitted (the `finally` must fire on every exit: success, cancelled, failed, no frames). Never let a throwing consumer escape.
    4. `applyAquarelleEventsToKey` input gains the same optional `onDiagnostics` and forwards it unchanged to `bakeAquarelleEventsToFrame`. Keep the publish call and dispose order byte-identical.

    app/src/components/physic-paint/PhysicsPaintStudio.tsx:
    5. Import `type AquarelleApplyDiagnostics` from `./roto/physicsPaintRotoPlayScriptController` (extend the import at :74) — do not import the package type directly here.
    6. Apply port (`applyAquarelleEvents`, ~:1840): declare `let bakeDiagnostics: AquarelleApplyDiagnostics | null = null;` before `applyAquarelleEventsToKey({`, pass `onDiagnostics: (d) => { bakeDiagnostics = d; }`, and add `diagnostics: bakeDiagnostics` to the `recordAquarelleRenderSplitEvent('script-bake', { … })` data object at :1983 (the `publish` closure runs after the helper returned, so the local is populated). Do not touch the composite/alpha-proof/upsert logic.
    7. `ensureAquarelleDurableBaseRef` (~:6109-6216): declare `let recoveryDiagnostics: AquarelleApplyDiagnostics | null = null;` before the `bakeAquarelleEventsToFrame` call at :6144, pass `onDiagnostics`, and add `diagnostics: recoveryDiagnostics` to every `lift-erase` record of that flow — the `base-recovery-failed` at :6150, the validation-failure record at :6169 and the `base-recovery-ok` at :6196. The `no-visible-payload` record (:6129) records before any bake and keeps `diagnostics: null` (state it as `diagnostics: null` explicitly or leave it absent — do not invent a value).
    8. `runAquarelleLiftErase` recovery (~:6439-6535): declare the same local before `adoptKnownEmpty` (so both closures read it), pass `onDiagnostics` into the bake at :6472, and add `diagnostics` to `adoptKnownEmpty`'s `lift-erase` record (via its `extra` argument or directly), to `failRecovery`'s records and to the explicit `base-recovery-ok` record at :6513. The `no-visible-payload` adopt runs with no bake → `diagnostics` stays null, which is the honest value.
    9. Nothing else in the Studio changes: no compose, punch, commit, publish or navigation logic is touched; no new signal/state; no new `useState`.

    Tests:
    10. `physicsPaintRotoPlayScriptApplyBake.test.ts` — the five rows above, a fake `document.createElement('canvas')` returning a minimal 2D context so the WebP encode path runs (or let the mocked encoder make it unnecessary; follow the reveal-bake suite's `RecordingCanvas` idiom if a canvas is needed).
    11. `PhysicsPaintStudio.test.ts` — the three source pins above, using the file's existing `between`/`countOccurrences` helpers; add them as one new `it`, leaving every existing pin untouched.
    12. Rebuild the package BEFORE the app typecheck and app tests: `app/vitest.config.ts` has no `@efxlab/*` source aliases and the package exports point at `dist`, so a stale `dist` is the first suspect if the new type or seam is reported missing.
  </action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor run build && pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>I will see: `AquarelleApplyDiagnostics` forwarded through `bakeAquarelleEventsToFrame` and `applyAquarelleEventsToKey`, with `adapterCreateMs` measured across adapter creation + the finally dispose and emitted exactly once on every exit (including a failed bake and a throwing consumer); the Studio's `script-bake` event carrying `diagnostics`; both Lift base-recovery flows carrying `diagnostics` on their `lift-erase` records on success and failure; the app typecheck clean against the freshly built package; and the seven targeted app suites green with every pre-existing pin untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bake diagnostics → /tmp render-split JSON | internal counters and timings leave the process into a debug capture file |
| bake loop → optional adapter seams (`skipTicks` / `isAwake`) | the bake trusts an adapter-supplied clock-only advance and sleep probe |
| diagnostics callback → host bake turn | a consumer callback runs inside the bake's `finally` |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-bks-01 | Information disclosure | `onDiagnostics` payload → `script-bake` / `lift-erase` events | low | mitigate | The diagnostics object carries only scalar counters and timings (`path`, `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs`, `adapterCreateMs`). Never add pixel data, canvases, data URLs or script content; the existing `bakeInk`/`bakeFrame.digest` fields remain the only byte-derived values. |
| T-bks-02 | Tampering (bake integrity) | `emitDiagnostics` consumer callback | medium | mitigate | The emitter wraps the consumer in try/catch and returns silently — a throwing diagnostics consumer can never fail, cancel or corrupt a bake; pinned by a package test and by the app helper test. |
| T-bks-03 | Denial of service | `stepGap` skip loop / `skipTicks` | low | mitigate | The skip is bounded by the gap length (`toTick - fromTick`) and performs no engine work; the boundary-tick + re-check law means at most one engine tick per gap is paid once asleep. `skipTicks` loops a counted integer number of `advanceClock` adds — no unbounded or floating loop condition. |
| T-bks-04 | Tampering (visual parity) | three gap walks × window bounds × Dry ordering | high | mitigate | Only the three enumerated walks route through `stepGap`; the probe runs BEFORE each step, exactly one boundary tick precedes any skip and the clock is advanced per tick (never a multiply), so skip-ON output bytes and the final virtual clock are strictly equal to skip-OFF — pinned by the parity test suite before the implementation lands. |
| T-bks-SC | Tampering | npm/pip/cargo installs | high | accept | No package is installed and no dependency version changes in this quick; the package-legitimacy gate is not triggered. If a task discovers it needs a new package, stop and return to planning. |
</threat_model>

<verification>
Automated gates (cwd is the checkout root; run in order):
1. `pnpm --filter @efxlab/efx-watercolor run check` — package tsc clean.
2. `pnpm --filter @efxlab/efx-watercolor run test` — vitest run (never watch), existing assertions unedited.
3. `pnpm --filter @efxlab/efx-watercolor run build` — REQUIRED before any app check/test (the app reads `dist`).
4. `pnpm --filter efx-motion-editor run typecheck` — app tsc clean.
5. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — NEVER the bare `test` script (it is watch mode).
6. `pnpm --filter efx-motion-editor exec vitest run` — full app suite (background it if long; resume on the completion notification).

Cross-cutting checks before closing:
- Exactly three `stepGap(` call sites in `bakeProgressive`; zero inside `renderPartialStrokes`, the fallback loop, the fix bake, the cook-to-sleep loop or the legacy branch (`grep -n 'stepGap(' packages/efx-watercolor/src/bake/aquarelleBake.ts` → 4 lines: baseline at HEAD is 0, target 1 declaration + 3 calls).
- Every counted step resolves to a `stepTimeline` in scope: exactly two `countedStep(diagnostics)` bindings — one in `bake()` (legacy cuisson loop :665-667) and one in `bakeProgressive` (fallback loop :524, `stepGap`, and the settle law) — and the ONLY raw `adapter.stepTick(` left is inside the `countedStep` factory body (`grep -n 'adapter\.stepTick(' packages/efx-watercolor/src/bake/aquarelleBake.ts` → 1 line; baseline at HEAD is 7).
- `skipTicks` adds the clock per tick and never multiplies the whole span; its `disposed || !engine` guard precedes the first `advanceClock`.
- No existing package assertion was edited: `git diff packages/efx-watercolor/src/bake/aquarelleBake.test.ts` shows only added lines/cases.
- No `useState`, no new signal, no signal write in a render body, no new effect (efx-preact-reactivity); the Studio change is local-variable plumbing only.
- No new dependency, no `packages/efx-paint-host` change, no `FIX_SETTLE_TICKS`/`aquarelleVisibleSettleTicks` change.
- The server is never started, nothing is pushed; the executor writes `261029-bks-SUMMARY.md` but commits code only (the orchestrator commits the docs artifacts).

Native UAT handoff (the user's; automated gates do not claim it):
1. Open the Studio, Apply a watercolor script whose recording contains a long idle gap (tens of seconds), then read `/tmp/efx-aquarelle-render-split.json`:
   - `script-bake.diagnostics.skippedGapTicks` > 0 and close to the recorded gap length; `script-bake.diagnostics.simulatedTicks` near the awake portion of the gap plus the settle (`settleTicks`), i.e. a small fraction of `timelineTicks`; `script-bake.diagnostics.path === 'timed'`; `adapterCreateMs` present and small relative to the bake wall time (the <5% judgement that decides whether creation ever needs attention). Report the saving as `simulatedTicks / timelineTicks`, excluding `settleTicks` from the numerator if you want the pure gap ratio.
   - `bakeFrame.digest` unchanged versus a previous Apply of the same untouched script (bake determinism), and `bakeInk` unchanged.
2. Perform one scripted Lift (or the legacy-key Lift base recovery) and read the `lift-erase` events: `diagnostics` present on both `base-recovery-ok` and `base-recovery-failed`, with the same field set plus `adapterCreateMs`.
3. Judge only what automation cannot: the applied key and the Lift erase look identical to the pre-change behaviour, and Apply on a long-gap script is visibly faster.
</verification>

<success_criteria>
- The truth table's six rows hold: awake gaps simulate every tick; a sleep transition costs exactly one boundary tick then clock-only skip; asleep-throughout costs one tick; the trailing Dry still fires after the clock reaches `windowEnd`; the settle law (fix + 72, or cook-to-sleep) is never skipped; no gap crosses a window end.
- `skipTicks` is a clock-only seam with the `disposed || !engine` guard before any clock add and per-tick `advanceClock(1000 * HOST_DT)` additions — the final virtual clock is strictly equal to a no-skip run and the captured bytes are identical.
- Adapters without `skipTicks` step every gap tick and receive no `isAwake` probes: the existing package suite passes with zero edits to existing assertions.
- `stepGap` is used by exactly three gap walks; the fallback loop, the fix bake, the cook-to-sleep loop, the legacy branch and `renderPartialStrokes` keep their tick law; capture count, windows, `pointCount`s, `onStrokeFed` order and Dry order are unchanged.
- `onDiagnostics` fires exactly once per `bake()` on timed, fallback and legacy paths (including cancelled/failed bakes), never throws into the bake, and reports `path`, `timelineTicks`, `simulatedTicks` (actual `stepTick` calls only), `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs` with the documented semantics; the pinned invariant is per gap (stepped + skipped === gap length) plus strict clock equality, never a global two-term subtraction.
- The app merges a measured `adapterCreateMs` (adapter creation span + teardown span, never the bake itself) into the forwarded diagnostics on every exit; the Studio's `script-bake` and both Lift `lift-erase` flows carry `diagnostics` on success and failure; no other Studio behaviour changed.
- All six automated gates pass; native UAT is left for the user — no "done" claim before it passes; no visual law, sample feeding, window allocation, RNG, settle cap, host interface, dependency or feature flag changed.
</success_criteria>

## Source Coverage Audit

| Source | Item | Covered by |
|---|---|---|
| GOAL | Skip idle-gap ticks only while the engine is provably asleep, byte-identical output, identical virtual clock | Task 1 |
| GOAL | Make the saving measurable (one diagnostics record per bake, adapter creation cost measured) | Task 1 (counters) + Task 2 (adapterCreateMs + render-split) |
| REQ | Quick task — no ROADMAP requirement IDs; the CONTEXT decision set is the requirement source | All items below; frontmatter `requirements: []` by convention |
| CONTEXT D1 | `skipTicks` optional seam beside `isAwake`/`fix`, disposed-before-clock guard, per-tick adds | Task 1 (adapter) |
| CONTEXT D2 | `stepGap` used by exactly three walks (pre-stroke, trailing-Dry pre-gap, window tail) | Task 1 (bake) |
| CONTEXT D3 | Gap law: probe-before-step, one boundary tick, re-check, skip only with both seams, never cross a Dry/window/settle | Task 1 (bake + truth-table tests) |
| CONTEXT D4 | `onDiagnostics` once per bake, field list + `path`, never throws | Task 1 (bake) |
| CONTEXT D5 | App threading: helper `onDiagnostics`, `adapterCreateMs` across create + finally dispose, Apply pass-through, Studio `script-bake` + two Lift `lift-erase` flows | Task 2 |
| CONTEXT D6 | Parity baseline first, rows (a)-(h), existing package tests unedited | Task 1 (`<behavior>` lists every row; parity-first ordering in `<action>`) |
| CONTEXT D7 | Adapter cost measured, not optimised; no pooling; no runtime feature flag | Task 2 (`adapterCreateMs`) + out-of-scope list |
| RESEARCH | Gate on `skipTicks` presence (not `isAwake`) to keep `makeTimelineAdapter`'s pinned counts valid; the `isAwake`-gated breakage table is the red flag to recognise | Task 1 items 8-9 and the escalation rule |
| RESEARCH | Three walks, not two (the trailing-Dry pre-gap at :510-512 is the third) | Task 1 item 10 |
| RESEARCH | Aliasing traps: `cursor` by value, `timed` alias, per-frame window bounds, counters as `bakeProgressive` locals | Task 1 items 8-11 |
| RESEARCH | App diagnostics wiring call sites (:1851, :1906, Studio :1842/:1983/:6144/:6472) and the build-before-app-check order | Task 2 items 1-12 |
| RESEARCH | Open question 1 (callback, not result-shape change) and 2 (counters in `bakeProgressive`, no `AquarelleBakeResult` change) — RESOLVED as recommended | Task 1 items 3-7 |
| RESEARCH | Assumption A1 (trailing-Dry gap may skip) — accepted, implemented as the third walk | Task 1 item 10 |
| RESEARCH | Assumption A2 (legacy branch counts through the same wrapper, identical call order) — accepted | Task 1 item 10 |
| RESEARCH | Assumption A3 (adapterCreateMs spans create + finally dispose, callback before the helper returns) — accepted | Task 2 items 2-3 |

No source item is deferred or unplanned. CONTEXT.md has no Deferred Ideas section; there is nothing excluded to carry.

<output>
Create `.planning/quick/261029-bks-watercolor-replay-optimisation/261029-bks-SUMMARY.md` when done. The executor writes the SUMMARY only; STATE.md and the commits belong to the orchestrator.
</output>
