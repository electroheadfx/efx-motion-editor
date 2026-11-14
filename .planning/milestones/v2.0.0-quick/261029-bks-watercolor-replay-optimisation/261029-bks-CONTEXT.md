# Quick Task 261029-bks: Watercolor replay optimisation - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning
**Milestone:** v2.0.0
**Branch at handoff:** v2.0.0/bake-speed (HEAD 997afe8e; the prompt's `v2.0.0/lift-three-state` is stale — `init.quick` returned `branch_name: null`, so the task stays on the current branch)

<domain>
## Task Boundary

Every Apply and every script edit re-bakes the watercolour sheet at ~recorded-session speed. The recorded timeline keeps the artist's wall-clock idle gaps (`buildRecordedTimeline`, `aquarelleBake.ts:251`), and the timed bake loop steps every gap tick through `adapter.stepTick` (`aquarelleBake.ts:497`, `:517`). A 435 s pause between two Lift strokes becomes ~26,100 simulated 60 Hz ticks in the single-frame Apply bake (`frameCount: 1`).

Goal: skip idle-gap ticks ONLY while the engine is provably asleep, with byte-identical bake-vs-bake output and an identical virtual clock. No visual law, sample feeding, window allocation, live RNG, or settle-cap change.

</domain>

<decisions>
## Implementation Decisions

### Truth table (agreed 2026-10-29)

Bake paths:
- **A — Apply & legacy-key recovery:** `frameCount: 1` → `bakeProgressive(events, 1)`. One window `[0, timelineEnd]`, 1 capture, end-frame settle law.
- **B — Play:** `frameCount: N > 1` → `bakeProgressive(events, N)`. N windows allocated by sample progress; final window ends at `timelineEnd`; N captures.
- **C — legacy non-progressive:** no `frameCount` → per-stroke `bake()` branch. No recorded timeline, no gap loops. Untouched.

| Gap state | Simulated ticks | Skipped | Clock after gap | Capture / output |
|---|---|---|---|---|
| engine awake throughout | all `b−a` | 0 | `+ (b−a) × (1000/60)` ms | unchanged |
| awake → asleep at tick `s` | `[a,s)` + one boundary tick | `(s,b)` | identical to no-skip | unchanged |
| asleep throughout | one boundary tick at `a` | `(a,b)` | identical to no-skip | unchanged |
| trailing Dry | gap to `windowEnd` may skip; the Dry fires AFTER the clock reaches `windowEnd` (its fix + 30 ticks unchanged) | — | unchanged | unchanged |
| final settle | `settleCapped` → `fix()` + 72 `FIX_SETTLE_TICKS` (never skipped); else cook-to-sleep loop already exits at `isAwake() === false` | 0 | unchanged | unchanged |
| window end (Play) | the gap never crosses `windowEnd` | — | unchanged | N captures unchanged |

### Sleep-transition boundary tick
- When a gap's `isAwake()` first reads false, run ONE more `stepTick` before clock-skipping the remainder.
- Why: the tick that observes sleep is where `Engine.tick` calls `sleep()` (clears `active`, velocity, pressure) and `render()` flushes any pending dirty rect. Running it makes the skipped state provably identical to no-skip even if `isAwake() === false` ever coexists with `active !== null`. Cost: 1 engine tick per gap.
- The check is monotone (`Engine.isAwake` is `active !== null && (stroke || fixTimer || now < minAwakeUntil || now < wetUntil())`), so a pre-tick false can never mask a tick that would have been awake; a pre-tick true may still turn false inside the tick, which the loop handles.

### Clock arithmetic
- `skipTicks(from, to)` advances the virtual clock with per-tick `advanceClock(1000 * HOST_DT)` additions, exactly like `stepTick`, so the clock end value is bit-identical to no-skip. The loop is O(n) float adds (< 1 ms for 26k ticks); the removed cost is `engine.tick`, not the loop.

### Seam type
- Optional adapter extension `skipTicks?(fromTick, toTick)`, detected by cast in `aquarelleBake` exactly like `isAwake` / `fix` / `setPaper`. No change to `packages/efx-paint-host`; the bake falls back to plain stepping when the seam is absent (test doubles, older adapters).

### Gap loops and boundaries
- Only the two `if (timed)` gap loops change: `aquarelleBake.ts:497` (before a stroke's first sample) and `:517` (tail to the window end).
- Never skip: inside `renderPartialStrokes` (per-sample ticks), across a Dry application, across a window boundary, or inside the final settle law.
- The fallback point-weight schedule (`:523`) and the legacy per-stroke branch keep their existing tick law.

### Diagnostics
- Optional `onDiagnostics` callback on the package bake (called once per `bake()`): `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs`. `adapterCreateMs` is measured by the app helper (adapter + WatercolorEngine + program compile + dispose) and merged into the same render-split event.
- Definitions: `timelineTicks` = sum of window tick spans; `simulatedTicks` = actual `stepTick` calls; `skippedGapTicks` = clock-only ticks; `settleTicks` = end-frame settle ticks (fix bake or cook-to-sleep); `gapCount` = gap ranges with length > 0 processed by the gap walker.
- Logged in the app's existing `script-bake` render-split event and the `lift-erase` recovery events.

### Claude's Discretion
- Naming/shape of the internal `stepGap` helper and the diagnostics type.
- Whether the counters live on `AquarelleBakeResult` or only via the callback (callback is required; no result-shape change).

</decisions>

<specifics>
## Specific Ideas

- Parity baseline FIRST: two skip-OFF bakes of the same fixture must be byte-identical (fake adapter where WebGL is unavailable); then skip-ON must equal skip-OFF bytes on a fixture whose engine sleeps across the gap. Never compare live-vs-bake bytes — the live Studio engine uses `Math.random`, the bake uses `setRandom(seededRandom(traceSeed))`.
- Existing fake-adapter tests that pin `stepsBefore` will change when the fake reports asleep; they must assert the new law (simulated + skipped = gap length, clock equality) instead of the old all-ticks-simulated count.
- Adapter creation cost is MEASURED, not optimised: if `< 5 %` of wall time, document and leave it; pooling requires a separate user go.

</specifics>

<canonical_refs>
## Canonical References

- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — `buildRecordedTimeline` (:251), timed gap loops (:497, :517), settle law (:527-541).
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — virtual clock (:152-157), `stepTick` (:348), `isAwake` (:253), `fix` (:258).
- `packages/efx-watercolor/src/playground/Engine.ts` — `isAwake` (:663), `tick` (:878), `sleep` (:2103), `processInput` (:1564), settle constants (:158-162).
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `bakeAquarelleEventsToFrame` (:1851), `createDefaultAquarelleAdapter` (:1923).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `script-bake` event (:1983), Lift base-recovery bakes (:6144, :6472), `lift-erase` events.
- `app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts` — render-split report writer.

</canonical_refs>
