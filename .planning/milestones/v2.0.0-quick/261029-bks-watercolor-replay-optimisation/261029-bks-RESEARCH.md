# Quick 261029-bks: Watercolor replay optimisation — Research

**Researched:** 2026-10-29
**Domain:** `packages/efx-watercolor` bake loop / virtual clock / app diagnostics wiring
**Confidence:** HIGH (all seams, call sites and pinned test values read from source this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Truth table (agreed 2026-10-29)**

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
| window end (Play) | the gap never crosses `windowEnd` | — | unchanged | unchanged |

**Sleep-transition boundary tick**
- When a gap's `isAwake()` first reads false, run ONE more `stepTick` before clock-skipping the remainder.
- Why: the tick that observes sleep is where `Engine.tick` calls `sleep()` (clears `active`, velocity, pressure) and `render()` flushes any pending dirty rect. Running it makes the skipped state provably identical to no-skip even if `isAwake() === false` ever coexists with `active !== null`. Cost: 1 engine tick per gap.
- The check is monotone (`Engine.isAwake` is `active !== null && (stroke || fixTimer || now < minAwakeUntil || now < wetUntil())`), so a pre-tick false can never mask a tick that would have been awake; a pre-tick true may still turn false inside the tick, which the loop handles.

**Clock arithmetic**
- `skipTicks(from, to)` advances the virtual clock with per-tick `advanceClock(1000 * HOST_DT)` additions, exactly like `stepTick`, so the clock end value is bit-identical to no-skip. The loop is O(n) float adds (< 1 ms for 26k ticks); the removed cost is `engine.tick`, not the loop.

**Seam type**
- Optional adapter extension `skipTicks?(fromTick, toTick)`, detected by cast in `aquarelleBake` exactly like `isAwake` / `fix` / `setPaper`. No change to `packages/efx-paint-host`; the bake falls back to plain stepping when the seam is absent (test doubles, older adapters).

**Gap loops and boundaries**
- Only the two `if (timed)` gap loops change: `aquarelleBake.ts:497` (before a stroke's first sample) and `:517` (tail to the window end).
- Never skip: inside `renderPartialStrokes` (per-sample ticks), across a Dry application, across a window boundary, or inside the final settle law.
- The fallback point-weight schedule (`:523`) and the legacy per-stroke branch keep their existing tick law.

**Diagnostics**
- Optional `onDiagnostics` callback on the package bake (called once per `bake()`): `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount`, `settleTicks`, `bakeMs`, `encodeMs`. `adapterCreateMs` is measured by the app helper (adapter + WatercolorEngine + program compile + dispose) and merged into the same render-split event.
- Definitions: `timelineTicks` = sum of window tick spans; `simulatedTicks` = actual `stepTick` calls; `skippedGapTicks` = clock-only ticks; `settleTicks` = end-frame settle ticks (fix bake or cook-to-sleep); `gapCount` = gap ranges with length > 0 processed by the gap walker.
- Logged in the app's existing `script-bake` render-split event and the `lift-erase` recovery events.

### Claude's Discretion
- Naming/shape of the internal `stepGap` helper and the diagnostics type.
- Whether the counters live on `AquarelleBakeResult` or only via the callback (callback is required; no result-shape change).

### Deferred Ideas (OUT OF SCOPE)
None recorded — CONTEXT.md has no Deferred Ideas section.
</user_constraints>

## Summary

The change is confined to `bakeProgressive` in `packages/efx-watercolor/src/bake/aquarelleBake.ts`, plus one new optional adapter method in `packages/efx-watercolor/src/adapter/engineAdapter.ts` and one optional option key (`onDiagnostics`) threaded through the app's two bake helpers. The engine is already structured so that a tick taken while `active === null` and `stroke === null` is a pure no-op except for the clock: `tick()` only resets `brushNow.r`, `processInput` early-returns, `render()` early-returns on a clean flag, and `sleep()` is gated on `this.active` — so the only observable change is the virtual clock, which `skipTicks` reproduces add-for-add.

**Primary recommendation:** gate the new shortcut on the presence of the `skipTicks` seam (not on `isAwake` alone). That single choice is what keeps every existing package test valid without edits — the test doubles define `isAwake` but not `skipTicks` (`aquarelleBake.test.ts:486`, `:493`), so their tick law is untouched — and it is the reading CONTEXT line 45 locks ("the bake falls back to plain stepping when the seam is absent").

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Gap-walk sleep detection + tick skip | `packages/efx-watercolor/src/bake/aquarelleBake.ts` (bake orchestration) | — | Only the bake knows gap spans and window boundaries; the engine must stay policy-free |
| Clock-only advance | `packages/efx-watercolor/src/adapter/engineAdapter.ts` (virtual clock owner) | — | `virtualNow` is private to the adapter; no other tier can reproduce it bit-exactly |
| Sleep semantics (when is a tick a no-op) | `packages/efx-watercolor/src/playground/Engine.ts` (simulation) | — | `isAwake`, `sleep()`, `trimActive()` live here; unchanged by this task |
| Diagnostics emission + render-split logging | `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` + `PhysicsPaintStudio.tsx` | — | App owns the event schema and `adapterCreateMs` measurement |

## 1. Test Inventory and Required Deltas

### 1a. Gate decision (decides whether ANY existing test changes)

`makeTimelineAdapter(awakeTicks, withFix)` declares its extension surface explicitly:

```ts
adapter: EngineAdapter<AquarelleStrokePayload> & { isAwake: () => boolean; fix?: () => void }
```
[VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.test.ts:486] — and the object literal at `:493` carries exactly those keys (`isAwake: () => awake-- > 0` at `:521`, `fix` spread at `:522`). No `skipTicks`.

`makeFakeAdapter` (`aquarelleBake.test.ts:125-162`) has no `isAwake` at all.

- **Gate on `typeof skipTicks === 'function'`** → every existing test keeps its exact current tick law. **Zero existing test edits.** This is the prescribed gate.
- Gate on `isAwake` presence instead → the following break (documented so the planner can recognise the error if the implementation drifts):

| Test | Location | Current assertion | Under `isAwake` gating |
|---|---|---|---|
| `starts the animation at frame 0 …` | `aquarelleBake.test.ts:755` | `expect(bRender.stepsBefore).toBe(114)` | 114 gap ticks: 5 awake (fake budget `makeTimelineAdapter(5)`) + 1 boundary tick → `6` |
| same test, settle tail | `aquarelleBake.test.ts:760` | `expect(log.stepsByFrame[9]).toBe(59 + 5)` | tail 59 ticks: budget exhausted → 1 boundary tick; cook loop pre-check false → 0 → `1` |
| `keeps the settle gap when the slot travels with the position` | `aquarelleBake.test.ts:579` | `expect(log.renders[1]!.stepsBefore).toBeGreaterThan(100)` | `makeTimelineAdapter(0)` → 1 boundary tick → `1` |
| `the final frame is captured after the settle cook` | `aquarelleBake.test.ts:774` | `.toBeGreaterThanOrEqual(120)` | survives, but only because the consumed probe budget now lands in the tail gap; must be re-baselined, not left as a lucky margin |

Unaffected under either gate (no gap walk, or fix path bypasses the probe): `:565` (`toBe(0)`, zero-length gap), `:608` (`toBe(164 + 72)`, `withFix` path — "The awake probe is never consulted." at `:607`), `:645`/`:666`/`:683` (report counts only), `:720` (both sides use identical fake budgets).

### 1b. Existing tests that MUST stay green unchanged (regression fence)

| File:line | Pins |
|---|---|
| `aquarelleBake.test.ts:608` | `expect(log.stepsByFrame[3]).toBe(164 + 72)` — settle law: `FIX_SETTLE_TICKS = Math.round(1.2 * 60)` [VERIFIED: aquarelleBake.ts:161] |
| `aquarelleBake.test.ts:720` | `expect(listened.log.stepsByFrame).toEqual(plain.log.stepsByFrame)` — the existing skip-OFF tick-sequence parity check |
| `aquarelleBake.test.ts:741` | `expect(log.captures).toBe(10)` — window/capture count unchanged |
| `aquarelleBake.test.ts:746-748` | per-frame partial point counts `[2, 4, 6, 8, 10, 11]` — window allocation unchanged |
| `aquarelleBake.test.ts:756-757` | `bRender.frame` `5`, first `pointCount` `1` — sample feeding unchanged |
| `aquarelleBake.test.ts:774` | settle cook still runs on the final frame |
| `aquarelleBake.test.ts:803-807` | `poseFrame` once per output frame, output order |

App-side: no test asserts a bake tick count or call order. The only source-text pins near this work are index-ordering pins (`PhysicsPaintStudio.test.ts:4480-4495`, `bake` before `recoverAquarelleDurableBase`) and the durable-base `set(`/`delete(` counts (`:4442-4443`) — all insensitive to adding an `onDiagnostics:` key inside the helper call object.

### 1c. New tests to add (package, `aquarelleBake.test.ts`)

1. **Skip-OFF parity baseline** — two bakes of the same fixture with a `skipTicks`-less fake: byte-identical frames. (Cheap, independent of `:720`.)
2. **Skip-ON == skip-OFF bytes** — a recording double that implements `skipTicks(from, to)` by counting `to - from` clock-only ticks; assert `frames[0].bytes` equal to the skip-OFF run on a fixture whose engine sleeps across a gap. **Never compare against a live Studio capture** — live uses `Math.random`, bake uses `setRandom(seededRandom(traceSeed))` [CITED: 261029-bks-CONTEXT.md "Specifics"].
3. **Per-gap law** — for every gap: `stepTick` calls inside the gap + skipped ticks === `gapEnd - gapStart`; skipped > 0 on an asleep gap; skipped === 0 on an awake gap.
4. **Clock bit-identity** — the double accumulates `virtualNow += 1000 * HOST_DT` per skip tick; assert the final clock `toBe` (strict equality, not `toBeCloseTo`) the skip-OFF final clock.
5. **Truth-table rows** — awake-throughout (0 skipped), awake→asleep at `s` (`[a,s)` + 1 boundary, `(s,b)` skipped), asleep-throughout (1 step, `(a,b)` skipped).
6. **Boundary tick observable** — with `active !== null` but every awake disjunct false at the gap start, exactly one `stepTick` runs before the skip (double reports `isAwake: () => false`, records a call count of 1 over the gap).
7. **Trailing Dry ordering** — Dry applied after the clock has reached `windowEnd`; captures unchanged.
8. **Diagnostics** — `onDiagnostics` called exactly once per `bake()`; `gapCount` counts only length > 0 gaps; `skippedGapTicks` equals the double's skip total; `settleTicks` > 0 on the final frame.

## 2. Implementation Seams

### 2a. Adapter seam (`engineAdapter.ts`)

Add beside `isAwake`/`fix` in the returned object (`:253-260`), mirroring `stepTick`'s guard exactly:

```ts
stepTick(_tick: number): void {
  if (disposed || !engine) return
  advanceClock(1000 * HOST_DT)
  engine.tick(HOST_DT)
},
```
[VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.ts:348-354]

`skipTicks(fromTick, toTick)` must (a) `if (disposed || !engine) return` **before** any clock add — same early-return law, otherwise the clock diverges from a no-skip run with a disposed adapter; (b) loop `advanceClock(1000 * HOST_DT)` once per tick. **Trap:** never collapse to `advanceClock((to - from) * 1000 * HOST_DT)` — a single multiply is not bit-identical to n sequential adds, and bit-identity is the whole contract. `advanceClock` is `virtualNow += ms` [VERIFIED: engineAdapter.ts:152-155].

### 2b. Bake seam (`aquarelleBake.ts`)

Widen the existing cast at `:292` rather than adding a second one:

```ts
const awakeProbe = adapter as EngineAdapter<AquarelleStrokePayload> & { isAwake?: () => boolean }
```
[VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.ts:292]

→ one `TimedSeams` type adding `fix?: () => void` and `skipTicks?: (fromTick: number, toTick: number) => void`. The `fix` cast at `:532` can then reuse it.

One helper declared inside `bakeProgressive` (it needs `adapter`, `seams`, and the per-bake counters):

```ts
const stepGap = (fromTick: number, toTick: number): void => {
  let tick = fromTick
  const canSkip = typeof seams.skipTicks === 'function'
  while (tick < toTick) {
    if (!canSkip || seams.isAwake?.() !== false) { adapter.stepTick(tick); tick += 1; continue }
    adapter.stepTick(tick)          // mandatory boundary tick
    tick += 1
    seams.skipTicks!(tick, toTick)  // clock-only
    tick = toTick
  }
}
```

Prescriptive notes:
- Probe **before** every step while awake (so a tick that turns asleep mid-gap is still fully executed); only skip after a false read.
- `canSkip` short-circuits before any `isAwake` call when the seam is absent — this is what preserves the fakes' probe budget (section 1a).
- `stepGap` must not mutate `cursor`; callers assign after the call.

### 2c. Call sites — exactly three walks, not two

| Location | Current code | Replacement | Note |
|---|---|---|---|
| `aquarelleBake.ts:496-497` | `const firstTick = entry.beginTick + fed` / `for (let tick = cursor; tick < firstTick; tick += 1) adapter.stepTick(tick)` | `stepGap(cursor, firstTick)` | gap before a stroke's first sample |
| `aquarelleBake.ts:510-512` | `if (isFinalFrame && trailingDrys.length > 0) { for (let tick = cursor; tick < windowEnd; tick += 1) adapter.stepTick(tick)` / `cursor = windowEnd` | `stepGap(cursor, windowEnd)` then keep `cursor = windowEnd` | **third walk** — CONTEXT's "two loops" enumeration omits it but the truth table allows it ("gap to `windowEnd` may skip; the Dry fires AFTER the clock reaches `windowEnd`"). Recommended: route it through `stepGap` (same law); the Dry application line `adapter.applyStroke(dry …)` stays untouched and stays after the walk. |
| `aquarelleBake.ts:517` | `for (let tick = cursor; tick < windowEnd; tick += 1) adapter.stepTick(tick)` | `stepGap(cursor, windowEnd)` | tail to window end |

Quoted verbatim [VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.ts:496-497, :510-517].

**Never route through `stepGap`:** the non-timed loop at `:523-525` (`for (let tick = 0; tick < tickBudget; tick += 1) { adapter.stepTick(tick) }`), the fix bake at `:535`, the cook-to-sleep loop at `:537-539` (quoted below), the legacy `bake()` branch at `:611`, or anything inside `renderPartialStrokes`.

```ts
if (isFinalFrame) {
  const fixSeam = (adapter as EngineAdapter<AquarelleStrokePayload> & { fix?: () => void }).fix
  if (settleCapped && typeof fixSeam === 'function') {
    fixSeam.call(adapter)
    for (let tick = 0; tick < FIX_SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
  } else if (typeof awakeProbe.isAwake === 'function') {
    for (let guard = 0; guard < SETTLE_MAX_TICKS && awakeProbe.isAwake(); guard += 1) {
      adapter.stepTick(guard)
    }
  }
}
```
[VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.ts:531-540]

### 2d. Aliasing / lifetime traps

- `cursor` is a `let` in the per-frame produce closure (`:484`) and is read by all three walks — pass by value, assign after.
- `timed` is the `const timed = timedBase` narrowing alias (`:347`); all three walks are inside `if (timed)`. Do not hoist `stepGap` outside the factory body or re-derive `timedBase` inside it.
- `windowEnd` / `previousWindowEnd` are recomputed per frame (`:443-462`). Never cache them in the helper.
- `isFinalFrame` gates BOTH the trailing-Dry walk and the settle law; the trailing-Dry branch must keep `cursor = windowEnd` immediately after the walk, before the Drys are applied.
- `awakeProbe` is captured once per `bake()` at `:292`; reuse it inside `stepGap` (do not re-cast per iteration).
- Counters must be locals of `bakeProgressive` (called once per `bake()`), mutated only inside the serialized produce closures; the frame produce chain is FIFO through the host barrier so there is no interleaving.
- `:499-501` applies `drysBeforeStroke` when `fed === 0` — that happens *after* the gap walk in the same stroke chunk; the skip must not cross it.

## 3. Diagnostics Wiring

### 3a. Package

Add to `AquarelleBakeOptions` (`aquarelleBake.ts:83-119`, alongside `onStrokeFed?: (completed: number, total: number) => void` at `:118`):
`onDiagnostics?: (d: AquarelleBakeDiagnostics) => void` with the CONTEXT field list. Optional ⇒ every existing call site and every stub keeps type-checking (all option assertions are partial: `toMatchObject({ frameCount: … })` and `bakeOptions[0]!.frameCount`).

To honour "called once per `bake()`" across both progressive and legacy branches, declare a counting local in the factory:

```ts
let simulatedTicks = 0
const stepTick = (tick: number) => { simulatedTicks += 1; adapter.stepTick(tick) }
```

and route the progressive walks through it. The legacy per-stroke branch keeps its exact call sequence (`adapter.stepTick(tick)` at `:665-667` region) — either count it too (identical call order, additional counter) or emit counters for the progressive path only; the tick law must not change either way.

### 3b. App threading (minimal signature change)

`bakeAquarelleEventsToFrame` creates the bake with `frameCount: 1` [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1869]. Extend its input with `onDiagnostics?: (d: AquarelleBakeDiagnostics & { adapterCreateMs: number }) => void`; measure `adapterCreateMs` around `createDefaultAquarelleAdapter` (`:1858`, the `await` at the top of the function) and around the `finally` block (`:1879-1884` where `bake.dispose(); adapter.dispose();` run), formatting the elapsed time and invoking the caller's callback **before** returning — so the `publish:` closure that emits `script-bake` (Studio `:1983`) already holds the value.

Callers to update (complete list):

| Call site | Line | Diagnostics use |
|---|---|---|
| `applyAquarelleEventsToKey` | `physicsPaintRotoPlayScriptController.ts:1906` | pass-through from its own new optional input |
| Studio `applyAquarelleEvents` port | `PhysicsPaintStudio.tsx:1842` (`onStrokeFed: onProgress` at `:1845`) | capture into a `let` declared in the port body; read it inside `publish:` when calling `recordAquarelleRenderSplitEvent('script-bake', { … })` at `:1983` |
| Studio `ensureAquarelleDurableBaseRef` | `PhysicsPaintStudio.tsx:6144` | success/failure `lift-erase` events fire after the `await` (`:6150`), so a local capture works |
| Studio `runAquarelleLiftErase` recovery | `PhysicsPaintStudio.tsx:6472` | same; `lift-erase` event after the bake |

`onStrokeFed: input.onStrokeFed` at `:1870` and `:1910` is the exact template for the new key.

### 3c. Tests that stub the bake (must keep type-checking; no behaviour change)

| File | Stub |
|---|---|
| `roto/physicsPaintRotoPlayScriptController.test.ts:218-243` | `vi.fn((_adapter: unknown, options?: AquarelleBakeOptions) => …)`, records `bakeOptions` |
| `roto/physicsPaintRotoPlayScriptController.bake.test.ts:272, 312, 358, 402, 445, 485, 519, 552, 599` | `vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, _options?: AquarelleBakeOptions) => bake)` |
| `roto/physicsPaintRotoRevealBake.test.ts:49-70` | `vi.mock('@efxlab/efx-watercolor/bake')`, pushes `options` into `harness.bakeOptions` |
| `roto/physicsPaintRotoRegistryOwnership.test.ts:27-39` | same two mocks, bake returns `harness.bakeResult` |
| `roto/physicsPaintRotoPlayScriptRenderer.test.ts:39` | source-text pin `expect(renderer).toContain('createAquarelleBake(adapter, {')` — unaffected |

An additive optional key is safe for all of them; none asserts an exhaustive options object.

### 3d. Counter identity trap (for whoever writes the assertion)

`timelineTicks` (sum of window spans) is **not** `simulatedTicks + skippedGapTicks`: the sample ticks are taken inside the adapter, one per fed sample —

```ts
advanceClock(1000 * HOST_DT)
…
engine.tick(HOST_DT)
```
[VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.ts:234-237, inside `feedDueSample`, reached from `renderPartialStrokes` at `:337`]

and `applyDry` adds its own 30 clock+tick pairs (`:209-213`). Therefore:

- `timelineTicks = simulatedGapTicks + skippedGapTicks + sampleTicks` (sample ticks never appear in `simulatedTicks`).
- `settleTicks` is outside every window span.
- The assertion that must hold is the **per-gap** one (`stepped + skipped === gapLength`) plus clock equality — not a global subtraction.

## 4. Build and Test Commands

**App tests and app `tsc` read `dist`, not source.** `app/vitest.config.ts` has no `resolve.alias` (`include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` [VERIFIED: app/vitest.config.ts:5]) and Vitest prefers `vitest.config` over `vite.config`; `app/vite.config.ts` aliases the package to source only for the Vite build/dev server, with an explicit stale-dist warning [VERIFIED: app/vite.config.ts:155-161]; the package exports point at dist (`"types": "./dist/index.d.ts", "import": "./dist/index.mjs"` [VERIFIED: packages/efx-watercolor/package.json:30-33]). `dist/` is currently newer than `src/` (built 2026-10-28 19:50 vs source 2026-10-26 16:58), so it is fresh today and goes stale the moment the package changes.

Order of operations:

```bash
pnpm --filter @efxlab/efx-watercolor run check    # tsc --noEmit (package)
pnpm --filter @efxlab/efx-watercolor run test     # vitest run — never watch
pnpm --filter @efxlab/efx-watercolor run build    # tsup → dist, REQUIRED before app side
pnpm --filter efx-motion-editor run typecheck     # app tsc --noEmit
pnpm --filter efx-motion-editor exec vitest run <paths>   # app vitest, run mode
```

`app/package.json` `test` is bare `vitest` (watch) — never invoke it directly; use the `exec vitest run` form above or the configured `workflow.test_command` `pnpm --filter efx-motion-editor exec vitest run` [VERIFIED: .planning/config.json `workflow.test_command`]. `packages/efx-watercolor/package.json` scripts: `build: tsup`, `check: tsc --noEmit`, `test: vitest run` [VERIFIED: packages/efx-watercolor/package.json:59-64]. No `packages/efx-paint-host` rebuild is needed — the seam lives entirely in `efx-watercolor`.

Targeted app suites to run after the rebuild: `physicsPaintRotoPlayScriptController.test.ts`, `physicsPaintRotoPlayScriptController.bake.test.ts`, `physicsPaintRotoRevealBake.test.ts`, `physicsPaintRotoRegistryOwnership.test.ts`, `physicsPaintRotoPlayScriptRenderer.test.ts`, `PhysicsPaintStudio.test.ts`.

## 5. Gotchas — what actually happens while asleep

| State | Behaviour when `active === null` / asleep | Hazard? |
|---|---|---|
| `brushNow.r` | `this.brushNow.r = 0` runs unconditionally at the top of `tick` [VERIFIED: Engine.ts:879]; the next real tick resets it before any `step()`/render | No |
| `processInput` | `const s = this.stroke; if (!s) return;` [VERIFIED: Engine.ts:1565-1566] — queue untouched | No |
| `render()` | `if (!this.dirtyAll && !this.dirty)` early return; `sleep()` already flushed via the boundary tick | No |
| `history` | Never written by `tick()`; the eviction notify lives in the rAF `frame()` path only | No |
| `maskCounter` / `flowSpeed` / `growCarry` | All three mutated only inside `if (awake)` [VERIFIED: Engine.ts:884-894]; `sleep()` additionally zeroes `flowSpeed` [VERIFIED: Engine.ts:2114] | No |
| `lastWet` | Not written by `tick()`; `wetUntil()` reads it | No |
| `dirty` / `dirtyAll` | Set by `touch`/`step`; cleared by the `render()` in the boundary tick | No |
| `minAwakeUntil` | `max(…, clock() + 250)` at `touch`, constant between wakes; the `now <` test is monotone in clock ⇒ a skipped tick can never have been awake | No |

Real hazards, each already covered by the mandatory boundary tick:

1. **The sleep tick itself does the blit.** `tick` ends with

   ```ts
   this.render();
   if (!awake && this.active) this.sleep();
   ```
   [VERIFIED: Engine.ts:896-897]

   and `sleep()` blits one ping-pong half onto the other, clears velocity/pressure, then `this.active = null` [VERIFIED: Engine.ts:2103-2115]. Skipping this tick leaves `active` non-null and the halves divergent — a later capture could differ. Hence: never skip without first stepping the false-observing tick.
2. **`isAwake() === false` can coexist with `active !== null`.** All awake disjuncts can be false while a rect exists; the boundary tick is what converts that into a proper `sleep()`. Same for the reverse asymmetry: `trimActive()` calls `this.sleep()` from inside the awake branch when no wet remains (`if (next) this.active = next; else this.sleep();` [VERIFIED: Engine.ts:2099]), so `active` can be nulled by a tick while the open-stroke bookkeeping is still meaningful.
3. **The first gap tick is the one that closes the previous stroke.** `feedDueSample` calls `engine.scriptEnd()` at the end of its sample loop without a following tick [VERIFIED: engineAdapter.ts:239-241], and `processInput` only clears `this.stroke` when it sees `s.ending` [VERIFIED: Engine.ts:1606-1607]. So a gap always *starts* awake; the probe naturally returns true for those first ticks. `scriptBegin` refuses while a stroke is open (`if (this.stroke) return false;` [VERIFIED: Engine.ts:828]), so losing that drain would silently drop the next stroke. The pre-tick probe plus the boundary tick is exactly what keeps this safe.
4. **`applyDry` is not skippable and is not a gap.** Its 30 clock+tick pairs run inside the adapter [VERIFIED: engineAdapter.ts:206-213]; the Drys are applied between walks, never inside one. Its `fix()` leaves `fixTimer > 0`, so the gap after a Dry stays awake by construction.
5. **Settle loops are outside the gap law.** `FIX_SETTLE_TICKS = Math.round(1.2 * 60)` → 72 [VERIFIED: aquarelleBake.ts:161]; `SETTLE_MAX_TICKS = 3600` [VERIFIED: aquarelleBake.ts:171]. Neither loop may call `stepGap`.
6. **Disposed adapter.** `stepTick` returns before `advanceClock` when `disposed || !engine` [VERIFIED: engineAdapter.ts:349] — `skipTicks` must do the same or the clock diverges.
7. **Chunk budget.** `viteBuild.test.ts` pins `chunkSizeWarningLimit: 2000` with zero chunk-size warnings allowed; the bake lives in the PhysicsPaintStudio lazy chunk, so a few hundred bytes is not a risk — but keep the helper inside the existing module (no new dependency).

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest 2.x, run mode only |
| Config file | `packages/efx-watercolor/vitest.config.*` (package), `app/vitest.config.ts` (app) |
| Quick run command | `pnpm --filter @efxlab/efx-watercolor run test` (25 tests, ~40 ms baseline) |
| Full suite command | package test + `pnpm --filter @efxlab/efx-watercolor run build` + `pnpm --filter efx-motion-editor exec vitest run` |

### Requirement → Test Map (task-derived; no REQ IDs exist for a quick task)
| Behaviour | Test type | Automated command | File exists? |
|---|---|---|---|
| Skip-OFF byte parity (two bakes identical) | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts` | ✅ extend |
| Skip-ON == skip-OFF bytes on a sleeping fixture | unit | same | ❌ Wave 0 |
| Per-gap stepped + skipped === gap length; clock strict-equal | unit | same | ❌ Wave 0 |
| Truth-table rows (awake / transition / asleep) | unit | same | ❌ Wave 0 |
| Trailing Dry fires after clock reaches windowEnd | unit | same | ❌ Wave 0 |
| Diagnostics counters + once-per-bake | unit | same | ❌ Wave 0 |
| App stubs still type-check with the new option | typecheck | `pnpm --filter efx-motion-editor run typecheck` | ✅ existing |

### Sampling Rate
- **Per task commit:** package `check` + package `test`.
- **Per wave merge:** package `build` then app `typecheck` + targeted app suites.
- **Phase gate:** full app suite green before UAT.

## Security Domain

Not applicable: the change touches no input parsing, auth, session, access control, cryptography, or network surface. Input validation is unchanged (`payloadCodec.parse` at the adapter seam, `engineAdapter.ts:265-268`); no new dependency is introduced, so the Package Legitimacy Audit is empty (no packages installed).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Routing the trailing-Dry pre-gap (`:511`) through `stepGap` is acceptable (CONTEXT's "two loops" enumeration omits it, the truth table permits skipping it) | 2c | If wrong, that gap keeps simulating — still correct output, just a smaller win on Dry-terminated scripts |
| A2 | Legacy per-stroke branch may also route through the counting wrapper without changing behaviour (identical call order) | 3a | If the planner prefers zero legacy diff, `onDiagnostics` fires only on progressive bakes and "once per bake()" needs a one-line doc carve-out |
| A3 | `adapterCreateMs` measured around adapter create + the `finally` dispose, invoking the callback before the helper returns | 3b | Timer placement is a design detail; a different span changes the number's meaning, not correctness |

## Open Questions

1. **Diagnostics delivered via callback vs returned from the app helper.** Both work; the callback matches CONTEXT ("callback is required") and the existing `onStrokeFed` template. Recommendation: callback on both the package option and `bakeAquarelleEventsToFrame`'s input; no change to `AquarelleBakeResult`.
2. **Counter ownership.** CONTEXT leaves it at discretion. Recommendation: locals in `bakeProgressive` (plus a factory-level `simulatedTicks` if the legacy branch reports too); do not extend `AquarelleBakeResult`.

## Sources

### Primary (HIGH confidence — read from source this session)
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — `AquarelleBakeOptions` (:83-119), `bakeProgressive` (:284-593), gap walks (:496-497, :510-517), settle law (:531-540), constants (:161, :171), legacy branch (:611)
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — virtual clock (:152-157), `applyDry` (:206-213), `isAwake`/`fix` (:253-260), `feedDueSample` (:221-241), `renderPartialStrokes` (:315-345), `stepTick` (:348-354)
- `packages/efx-watercolor/src/playground/Engine.ts` — `isAwake` (:663-667), `tick` (:878-898), `scriptBegin` (:827-839), `processInput` (:1564-1613), `trimActive` (:2065-2100), `sleep` (:2103-2115)
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — `makeTimelineAdapter` (:485-525), pinned assertions (:565, :579, :608, :720, :755, :760, :774)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `bakeAquarelleEventsToFrame` (:1851-1885), `applyAquarelleEventsToKey` (:1897-1920)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — apply port (:1840-1845), `script-bake` event (:1983), Lift bakes (:6144, :6472)
- `app/vitest.config.ts:5`, `app/vite.config.ts:151-167`, `packages/efx-watercolor/package.json:30-33, 59-64`, `app/package.json:9-10`, `.planning/config.json`

### Secondary (CITED)
- `.planning/quick/261029-bks-watercolor-replay-optimisation/261029-bks-CONTEXT.md` — the locked design, seam type, diagnostics field list, parity strategy

### Tertiary (LOW)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack / seams: HIGH — every line range quoted above was read this session.
- Test deltas: HIGH — the gate decision follows directly from the doubles' declared type and CONTEXT's fallback clause.
- Diagnostics wiring: MEDIUM — the call sites are verified; the shape (callback vs return) is a design choice left at discretion.
- Pitfalls: HIGH — each hazard cites the exact engine line.

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 (stable internal code; re-verify line numbers if `aquarelleBake.ts` changes first).
