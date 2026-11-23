# Quick Task 261123-vkb: Freeze the held wet look at the visible settle cap — Research

**Researched:** 2026-11-23
**Domain:** efx-watercolor engine awake-window cap (hold-wet follow-up, quick 261123-pee)
**Confidence:** HIGH for engine mechanics; MEDIUM for one bake-stamp hazard (reasoned from source, not yet observed live)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Helper home (user: neutral module)**
- Move `aquarelleVisibleSettleTicks` to a neutral package module
  (`packages/efx-watercolor/src/playground/settleCap.ts`). Re-export it from
  `bake/aquarelleBake.ts` so the package index (`src/index.ts` → `./bake`) and the layer's
  `@efxlab/efx-watercolor` import path stay unchanged. `Engine.ts` imports the neutral
  module — no Engine↔adapter↔bake cycle. ONE definition, no duplicated constants.

**Cap semantics (user: strict min)**
- Held awake bound = `min(wetUntil(), lastWet + visibleSettleMs)`. A nearly-dry held sheet
  keeps its SHORTER natural window; a real wash is bounded by the cap. Never extends an
  awake window. Unheld branch byte-identical (`now < this.wetUntil()` exactly as today).

**Probe lens (user: Dry 100)**
- Extend `packages/efx-watercolor/probe/wet-hold` with the existing dry-100 lens:
  held idle must stop at exactly 30 ticks (`aquarelleVisibleSettleTicks(100)`), the
  hold-off control must still sleep at the measured natural 237-tick window
  (pre-change readout /tmp/wet-hold/hold-hold.json), freeze proof digest at the cap vs
  +30 s idle. Unit tests pin the Dry 0/50/100 formula values.

**Locked artist behaviour (from the task spec)**
- Cap = round(30 + 270 × (1 − dry)) ticks at 60 Hz, dry 0..1 (Dry 50 → 165 ticks ≈ 2.75 s;
  Dry 0 → 300 ticks = 5 s; Dry 100 → 30 ticks = 0.5 s).
- At the cap the sim sleeps through the existing `if (!awake && this.active) this.sleep()`
  paths. No fix(), no wetness decay, no mobile→fixed, no hold write.
- The Water gate stays OPEN (`hasStandingWater` true via `isSheetWet`'s `held` branch),
  `wetPeak` survives sleep (shipped in 261123-pee), water/mobile pigment remain.
- The cap is measured from the LAST WET INPUT (`lastWet`), never the last pointer event.
  Wet paths confirmed today: fill/watercolor dab (Engine.ts ~1430), `brushWet` (~3350),
  `splatWet` (~3891).
- No infinite wake loop: after the cap `active` is null → stays asleep until input or Dry.
- Unheld sheet: awake window byte-identical.
- Dry (F), dry-first captures, wet replay (Shift+R / Apply one frame), CR-01 Dry-ledger
  guard: unchanged. ONE shared formula; no new recorded event type (STOP and report if
  parity would require recording the mode).

**Engine seams (verified 2026-11-23; the spec's line numbers drifted)**
- `isAwake` getter: Engine.ts:1249-1253. `tick()` awake expression: 1563-1583.
  rAF awake expression: 4288-4317 (uses `clockNow`). `wetUntil()`: 3973-3976.
  `sleep()`'s `if (!this.holdWet) this.wetPeak = 0;`: 4193. `wetDecay()`: 3968-3970.
  `advectWet uDecay`: 4070. `setHoldWet`: 2045. `fix(auto)`: ~2068.
- `holdWet.test.ts` pins the three awake expressions byte-identical (≈ lines 98-110) plus
  wetUntil/sleep/gate/decay pins. Re-express the awake pins deliberately (never delete);
  keep sleep/gate/decay/wetUntil pins unchanged.
- Layer polls `engine.isAwake` (AquarelleCanvasLayer.tsx:1202, 1294) and stamps
  `stampPendingSettle()` on awake→asleep — unchanged. `settleSheetNow` (1020-1041) and
  `settleForCapture` are commit paths — untouched.

### Claude's Discretion
None specified in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)
None specified in CONTEXT.md.
</user_constraints>

## Summary

Everything needed is already in-tree; this is an internal sim-timing change with no new packages, no shader, no medium record, no recorded event type. The bake module imports only `@efxlab/efx-paint-host` (+ `/animation`) and `../payload/*` (`aquarelleBake.ts:26-41`), so a zero-import `playground/settleCap.ts` re-exported from `aquarelleBake.ts` creates no cycle and keeps both the main package entry and `./bake` working. The three awake expressions are literally identical today (`isAwake`, `tick()`, rAF `frame`); a single private `awakeUntil()` helper substituted at those three sites is the whole engine change. `wetUntil()`, `wetDecay()`, `sleep()`, the gate and `fix()` remain untouched, which is exactly what the 261123-pee pins require.

One hidden hazard must be decided by the plan: the layer's idle-sleep stamp measures from stroke end, not from `lastWet`, and the bake's `settleCapped` flag flips when the recorded cuisson falls one tick below the cap — which the new shorter window makes likely. Without a floor at the awake→asleep stamp, a dry re-render of a held sheet can fall back to the washed cook-to-sleep path. Recommendation: pass the cap as `minTicks` on the held awake→asleep stamp (the contract already shipped in 261123-pee).

**Primary recommendation:** add `private awakeUntil()` returning `this.holdWet ? Math.min(this.wetUntil(), this.lastWet + aquarelleVisibleSettleTicks(this.params.dry * 100) * SETTLE_TICK_MS) : this.wetUntil()`, substitute it at Engine.ts:1252, 1568, 4302; move the formula verbatim to `playground/settleCap.ts` and re-export; floor the layer's awake→asleep stamp at the cap.

## Q1 — Helper home and import graph (no cycle)

- `aquarelleBake.ts` imports only: `{ BAKE_TURN_CONCURRENCY, createBakeHost, type BakeTurnOutcome, type EngineAdapter, type StudioStroke }` from `'@efxlab/efx-paint-host'` (line 26-32), `{ buildProgressiveStrokeSchedule, getProgressiveFrameStrokes }` from `'@efxlab/efx-paint-host/animation'` (33-36), `{ DIFFUSION_CAP, type AquarelleStrokePayload }` from `'../payload/toStudioStroke'` (37-40), and the dry event from `'../payload/dryEvent'` (41). No `playground` import exists anywhere in the bake. [VERIFIED: packages/efx-watercolor/src/bake/aquarelleBake.ts:26-41]
- `src/index.ts` exports `export * from './bake'` (line 14) and `export * from './playground'` (line 19) [VERIFIED: packages/efx-watercolor/src/index.ts:14-19]. The layer imports the formula from the main entry (`AquarelleCanvasLayer.tsx:24-30`), so `export { aquarelleVisibleSettleTicks } from '../playground/settleCap'` inside `aquarelleBake.ts` keeps both `@efxlab/efx-watercolor` and `@efxlab/efx-watercolor/bake` resolving the same binding.
- Source importers of the helper (excluding archived spike workbenches): `aquarelleBake.ts:285` (definition), `aquarelleBake.test.ts` (line 24 import; formula pins at 584-589), `AquarelleCanvasLayer.tsx` (675, 777, 1029 — all keep working), `aquarelleLayerContract.test.ts:160` (pin, unchanged).
- **Do NOT** also export it from `playground/index.ts`: two barrels (`./bake` and `./playground`) would export the same name from `src/index.ts`, an unnecessary duplicate-star-export risk. Internal consumers import by relative path.

## Q2 — Engine awake sites, clock semantics, wet writers

All three sites carry the identical expression today:

- `get isAwake()` — Engine.ts:1249-1253: `return this.active !== null && (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());` [VERIFIED: Engine.ts:1249-1253]
- `tick(dt)` — Engine.ts:1566-1568: same, from `const now = this.clock();` [VERIFIED: Engine.ts:1566-1568]
- rAF `frame` — Engine.ts:4300-4302: same, from `const clockNow = this.clock();` [VERIFIED: Engine.ts:4300-4302]

Supporting sites (verified verbatim this session):
- `private wetUntil() { if (this.wetPeak <= WET_THRESHOLD) return this.lastWet; return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD) * 1000; }` [VERIFIED: Engine.ts:3973-3976]
- `private wetDecay() { return this.holdWet && this.fixTimer <= 0 ? 1 : Math.exp(...) }` [VERIFIED: Engine.ts:3968-3970]
- `if (!this.holdWet) this.wetPeak = 0;` inside `sleep()`; `this.active = null;` stays [VERIFIED: Engine.ts:4180-4195]
- `setHoldWet(held: boolean) { this.holdWet = held; }` [VERIFIED: Engine.ts:2044-2046]
- `fix(auto = false)` starts `if (auto) { if (this.holdWet) return false; } else this.holdWet = false;` then `beginStep('dry','Dry')` → `beginSettle(this.painted, true)` → `clearLastTouch()` [VERIFIED: Engine.ts:2067-2083]
- `if (wake) this.minAwakeUntil = Math.max(this.minAwakeUntil, this.clock() + 250);` in `touch()` [VERIFIED: Engine.ts:3847]. Smallest cap is 500 ms (dry 100) → `minAwakeUntil` (250 ms) never binds post-stroke; leave it alone.
- `lastWet` writers are only the wet paths: fill wet band `this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), wetAmt); this.lastWet = this.clock();` [VERIFIED: Engine.ts:1430-1431], `brushWet` [VERIFIED: Engine.ts:3350-3351], `splatWet` [VERIFIED: Engine.ts:3891-3892]; plus reset/restore/travel bookkeeping (919, 1154, 1186, 2274). No writer change needed.
- Clock: the default engine clock is `performance.now()` (`private clock: () => number = () => performance.now();`, Engine.ts:475); `tick(dt)` reads the clock but never advances it [VERIFIED: Engine.ts:1563-1568]; the bake's adapter advances it explicitly: `stepTick` runs `advanceClock(1000 * HOST_DT); engine.tick(HOST_DT)` [VERIFIED: src/adapter/engineAdapter.ts:709-715]. `timeBaseMs`/`nowSec()` affect last-touch only, not `lastWet`/`wetUntil`/awake math [VERIFIED: Engine.ts:487-501].
- Other `isAwake`/`wetUntil` consumers: the gate `hasStandingWater` passes `held: this.holdWet` and `wetUntilMs: this.wetUntil()` [VERIFIED: Engine.ts:1260-1268]; the layer wasAwake/stamp poll [VERIFIED: AquarelleCanvasLayer.tsx:1202, 1294-1296]; the bake's adapter seam (`isAwake(): boolean { return engine?.isAwake ?? false }` [VERIFIED: engineAdapter.ts:532-533]) used by `stepGap`'s skip fast-forward and `applySettle`'s cook loop. The gate short-circuits on `held` (`return state.held === true || state.nowMs < state.wetUntilMs;` [VERIFIED: src/playground/wetState.ts:44]), so capping the awake expression cannot close the Water gate.
- Restore path: `restoreSheet` does not set `active`/`minAwakeUntil` (only `restore()` at:1190 does), so a restored sheet stays asleep until input — unchanged by this task.

## Q3 — The 261123-pee pins

`holdWet.test.ts` re-express (never delete) — lines 98-110, `it('leaves isAwake, wetUntil and both tick awake expressions byte-identical')`:
- the `isAwake` slice `includes('(this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil())')` must become the new held-aware expression (e.g. `now < this.awakeUntil()`);
- the `wetUntil` slice pin stays (`return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD) * 1000;`) — `wetUntil()` itself is untouched;
- the two regex counts (`now` pattern length 2; `clockNow` pattern length 1) must be re-expressed to the new expression, plus a new pin on `awakeUntil()`'s held `Math.min(...)` and unheld exact `this.wetUntil()`.
- Stale prose to update (not test-breaking): test header lines 10-14 ("`isAwake`, `wetUntil()` and both tick awake expressions are untouched"), Engine comment at 636-642 ("the sim still sleeps normally (`isAwake`/`wetUntil` untouched)"), Engine sleep comment 4190-4193.
- Keep byte-for-byte: sleep wetPeak guard `if (!this.holdWet) this.wetPeak = 0;` (and the one-write count), wetDecay bypass, advectWet `uDecay` uniform, gate `held: this.holdWet,` / `fixing: this.fixTimer > 0,`, fix auto-refusal order, `beginSettle` tail, `settleForCapture`, `exportSettledCanvas`, `SheetSnapshot`, `historyRevision`.
- Pin style is `sliceBetween(source, startAnchor, endAnchor)` + `indexOf`/`includes` + `match(...)` counts — re-express in the same style. No other test file pins the awake expressions (verified: `lastTouch.test.ts`, `engineStartDwell.test.ts` have none; only fake adapters in `determinismContract.test.ts`, `engineAdapter.test.ts`, `aquarelleBake.test.ts`).

## Q4 — Probe harness (wet-hold)

- Lens: `const HOST_TICK_S = 1 / 60` (line 90), `const MAX_IDLE_TICKS = 60 * 120` (92), `const WET_SECONDS = 60` (96), `const DRY_PARAM = 100` (97) [VERIFIED: packages/efx-watercolor/probe/wet-hold/probe.ts:86-97].
- `idleWalk` is the held idle: `engine.setHoldWet(true)` then `while (engine.isAwake && ticks < MAX_IDLE_TICKS) { adapter.stepTick(ticks); ticks += 1; if (!engine.isFixing) engine.setHoldWet(true) }` [VERIFIED: probe.ts:450-466]. `adapter.stepTick` is the clock advance (see Q2), so this is the live per-frame law.
- `engine.tick(dt)` alone does NOT advance the clock (`engineTickWalk`, probe.ts:472-479) — a +30 s freeze proof must use `adapter.stepTick` (or `advanceClock`) for the extra 1800 ticks, or the frozen clock proves nothing.
- Measured pre-change dry-100 readout, `/tmp/wet-hold/hold-hold.json` [VERIFIED: /tmp/wet-hold/hold-hold.json:51-64]: `"idle": { "ticks": 237, "engineMs": 3950, ... }`; `"postSleep": { "isAwake": false, "hasStandingWater": true, "wetPeak": 0.028906, "strokeNull": true, "activeNull": true }`. Consistent with dryTau's 2 s floor at dry 100: 2·ln(0.028906/0.004)·1000 ≈ 3956 ms → 237 ticks.
- Frozen-digest proof is valid: display/render paths do not read the awake clock, so the raw sheet digest is stable once asleep. Compare the raw digest at the cap vs after +30 s of `adapter.stepTick` (1800 ticks); also assert `isAwake === false`, `hasStandingWater === true`, `wetPeak` unchanged, `activeNull === true`.
- Extension plan: parameterize `idleWalk` with the hold flag (or add a control walk). Held arm at dry 100 must stop at exactly 30 ticks (`aquarelleVisibleSettleTicks(100)`); hold-off control (`setHoldWet(false)` before the same walk) must sleep at 237 ticks — note an unheld sleep zeroes `wetPeak` and closes the gate (expected for the control). The existing second-stroke block already runs after `idleWalk`; it now proves re-wake + pickup from the frozen state (the second stroke re-arms the window via its own wet dabs). Add run.mjs expectations: held idle 30, control 237, frozen digests equal, post-cap gate/peak. Preserve `/tmp/wet-hold/hold-hold.json` (pre-change reference) before rerunning labels.

## Q5 — Bake parity (no bake logic change; one stamp hazard)

- The wet bake already does the right thing without code changes: `settle: 'wet'` skips `applySettle` entirely (`if (isFinalFrame && options.settle !== 'wet') await applySettle()` [VERIFIED: aquarelleBake.ts:946]; same at 965), and the adapter is held only for that arm (`holdWet: settle === 'wet'`). `timelineEnd` uses `settleEstimate = Math.min(rawSettle || settleCap, settleCap)` with `settleCap = aquarelleVisibleSettleTicks(lastStrokeDry ?? 50)` [VERIFIED: aquarelleBake.ts:648-670].
- The bake's `stepGap` fast-forward now engages at the cap for the held arm: `if (canSkip && !seams.isAwake!()) { stepTimeline(tick); ... seams.skipTicks!(skipFrom, toTick) }` [VERIFIED: aquarelleBake.ts:570-598]. Post-change the wet-bake final sheet equals the live sheet at its sleep point (more accurate than today, where the held bake engine stayed awake through the whole post-end window). Consequence: **do not pin old wet-bake digests**; re-baseline, and prefer the new parity proof — live frozen raw digest vs wet-bake digest in the same run. The dry bake arm is unheld (`holdWet` not set), so its awake window and `settleCapped` behavior are byte-identical apart from the cuisson input.
- **Hazard — the lone deviation from "layer unchanged"**: `settleCapped = rawSettle <= 0 || rawSettle >= settleCap` [VERIFIED: aquarelleBake.ts:657]; `clampCuisson` truncates and caps at 600 but never floors [VERIFIED: aquarelleBake.ts:271-274]. The layer's idle-sleep stamp measures **from stroke end**, not from `lastWet`: `pendingSettle = { stroke, endedAt: performance.now() }` right after stroke end [VERIFIED: AquarelleCanvasLayer.tsx:783-786] and `stampPendingSettle()` with no floor at the awake→asleep transition [VERIFIED: AquarelleCanvasLayer.tsx:1294-1296]. With the new short window, any pause between the last wet dab and pointerup makes the measured cuisson `cap − gap < settleCap` → `settleCapped` false → `applySettle`'s cook-to-sleep branch (`seams.isAwake` loop, aquarelleBake.ts:916-923) cooks the unheld 237-tick window → **washed dry re-render**. Pre-change this never bit because 237 ≥ cap always. Fix: pass the cap as `minTicks` at the held awake→asleep stamp (the `stampPendingSettle(minTicks)` contract already exists; commit paths already floor via `stampPendingSettle(capTicks)` in `settleSheetNow`, layer 1020-1041). The stroke's recorded `diffusionFrames` is already the cap (layer:777), so an unstamped stroke is safe; only a too-small stamp is dangerous.
- The wet bake's `settleEstimate` from a slightly-under-cap stamp is at most `gap` ticks short of the live post-end window — acceptable; the 'wet' arm never force-dries regardless.

## Q6 — Formula and units

- Helper verbatim [VERIFIED: aquarelleBake.ts:285-290]:
  `export function aquarelleVisibleSettleTicks(dryPercent: number): number { const dry = typeof dryPercent === 'number' && Number.isFinite(dryPercent) ? Math.max(0, Math.min(100, dryPercent)) : 50; return Math.round(30 + 270 * (1 - dry / 100)) }` — percent in, 60 Hz ticks out. Values: 0 → 300, 50 → 165, 100 → 30, NaN → 165. Existing pins [VERIFIED: aquarelleBake.test.ts:584-589].
- Engine `params.dry` is 0..1: `dry: num(p.dry, d.dry) / 100,` [VERIFIED: src/playground/params.ts:196] — the engine must call `aquarelleVisibleSettleTicks(this.params.dry * 100)`.
- Tick→ms: the bake holds `const HOST_TICK_MS = 1000 / 60` [VERIFIED: aquarelleBake.ts:296]; the layer has its own `const HOST_TICK_MS = 1000 / HOST_TICK_HZ;` (HZ 60) [VERIFIED: AquarelleCanvasLayer.tsx:80-81]. `settleCap.ts` should export one named tick-ms constant (e.g. `SETTLE_TICK_MS = 1000 / 60`) for the engine; the layer and bake keep their locals (no forced edits).

## Q7 — Test runners and build

- app vitest: `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` [VERIFIED: app/vitest.config.ts:5] — `.test.ts` only; no resolve aliases, so `@efxlab/efx-watercolor` resolves through node_modules → package `exports` → `dist` (dist is gitignored). **The plan must rebuild the package** (`pnpm --dir packages/efx-watercolor build`) before app vitest/tsc, or the app sees the old dist.
- efx-watercolor has no vitest config → default include collects a new `packages/efx-watercolor/src/playground/settleCap.test.ts`.
- Files to edit: `holdWet.test.ts` (awake pins), new `settleCap.test.ts` (formula + constant), optionally move the formula block out of `aquarelleBake.test.ts` (it imports from `./aquarelleBake`, so it stays green via the re-export — keep one identity pin that the re-export is the same function). `aquarelleLayerContract.test.ts` unchanged unless the stamp floor edit touches its pinned text (it pins `const awake = engine.isAwake`; `if (wasAwake && !awake) stampPendingSettle();` — passing an argument changes that pin; update deliberately).

## Validation Architecture

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File exists? |
|---|---|---|---|
| Formula 0/50/100 + NaN + clamp; ONE module | unit | `pnpm --dir packages/efx-watercolor exec vitest run src/playground/settleCap.test.ts` | ❌ Wave 0 |
| Held awake bound is strict min; unheld byte-identical; three sites use it | source pin | `pnpm --dir packages/efx-watercolor exec vitest run src/playground/holdWet.test.ts` | ✅ (re-express awake pins) |
| Held idle at dry 100 = 30 ticks; control 237; frozen digest; gate/peak survive; re-wake pickup | probe | `node packages/efx-watercolor/probe/wet-hold/run.mjs` (existing flags; dry-100 lens) | ✅ (extend) |
| Layer contracts unchanged | source pin | `pnpm --dir app exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts` | ✅ (adjust only stamp pin if floored) |
| Live during stroke / after cap frozen / after Dry / re-render wet / PlayScript | UAT | manual rows | — |

Sampling: per task — package vitest run; per wave — both vitest runs + `pnpm --dir app exec tsc --noEmit`; phase gate — probe green + UAT rows.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The measured idle-sleep stamp lands below `settleCap` when a gap exists between the last wet dab and stroke end (reasoned from `endedAt` vs `lastWet`, not observed live) | Q5 | Dry re-render falls back to the washed cook-to-sleep path; fixed by the cap floor at the stamp |
| A2 | Post-change wet-bake digests shift by at most the last-dab→endTick gap; magnitude not measured | Q5 | Probe re-baseline scope grows; parity math unchanged |
| A3 | The probe scene stays deterministic (seeded paper, dry-100 lens), so 237 ticks / wetPeak 0.028906 are stable references | Q4 | Control assertions need a small tolerance |
| A4 | 30 ticks exact is achievable despite float clock steps (same `1000/60` constant everywhere) | Q4/Q6 | Off-by-one idle count; align the constant or allow ±1 with a note |

## Constraints for the planner

1. **Create `packages/efx-watercolor/src/playground/settleCap.ts` with ZERO imports.** Move the `aquarelleVisibleSettleTicks` body verbatim (same clamp, same NaN → 50 default) and export a tick-ms constant (`SETTLE_TICK_MS = 1000 / 60`). Delete the local definition from `aquarelleBake.ts` and re-export: `export { aquarelleVisibleSettleTicks } from '../playground/settleCap'`. ONE definition.
2. **Do not add `settleCap` to `playground/index.ts`** — avoid duplicate star-export of the same name from two barrels in `src/index.ts`. The public path stays `./bake` (+ main entry), matching today's importers.
3. **Engine change is exactly three substitutions**: add one private `awakeUntil()` helper; replace `now < this.wetUntil()` (1252, 1568) and `clockNow < this.wetUntil()` (4302) with the helper. Held branch: `Math.min(this.wetUntil(), this.lastWet + aquarelleVisibleSettleTicks(this.params.dry * 100) * SETTLE_TICK_MS)`; unheld: `this.wetUntil()` exactly. Never extend an awake window; never touch `wetUntil()`, `wetDecay()`, `sleep()`, the gate or `fix()`.
4. **Re-express `holdWet.test.ts` awake pins** (slice includes + occurrence counts) and add a new pin on `awakeUntil()`'s held min and unheld branch. Keep every other pin byte-identical. Update stale prose: test header 10-14, Engine 636-642, Engine sleep comment 4190-4193.
5. **Floor the held awake→asleep stamp at the cap** (Q5 hazard): the awake→asleep `stampPendingSettle()` call must pass the cap (`aquarelleVisibleSettleTicks(dry)`) so the recorded cuisson never drops below the bake's `settleCap`; otherwise `settleCapped` flips false and the dry re-render washes. If the user insists the layer stays untouched, the plan must instead prove via probe/UAT that the stamp is >= cap with a realistic last-dab→pointerup gap, and record that check as an acceptance row.
6. **Probe (dry-100 lens)**: held arm idles exactly 30 ticks; hold-off control (`setHoldWet(false)`) idles 237 ticks; frozen raw digest at cap equals digest after +30 s of `adapter.stepTick` (NOT `engine.tick`); post-cap `isAwake` false / gate true / `wetPeak` 0.028906; the existing second-stroke block proves re-wake + pickup from frozen. Back up `/tmp/wet-hold/hold-hold.json` as the pre-change reference; update run.mjs expectations.
7. **Bake: no logic change** in `aquarelleBake.ts` beyond the re-export. Do not pin old wet-bake digests (the held bake now sleeps at the cap and its `stepGap` skips clock-only); compare live frozen digest vs wet-bake digest. Dry arm is unheld and unchanged.
8. **New `settleCap.test.ts`** pins 0→300, 50→165, 100→30, NaN→165, clamp below 0 / above 100, and the re-export identity (bake import === settleCap import). Keep `aquarelleBake.test.ts` green via the re-export.
9. **Rebuild `@efxlab/efx-watercolor` dist** before app vitest/tsc (app vitest has no aliases; dist is gitignored).
10. **Gates**: `pnpm --dir packages/efx-watercolor exec vitest run`; `pnpm --dir app exec vitest run`; `pnpm --dir app exec tsc --noEmit`; wet-hold probe run; live UAT rows on the five named surfaces (live during stroke / after the cap frozen / after Dry / re-render wet / PlayScript).
11. **Never**: call `engine.fix()` at the cap; change shaders/mediums/UI; add a recorded event type or record the hold mode; replay committed strokes; start the dev server; run vitest in watch mode.

## Sources

### Primary (HIGH confidence)
- `packages/efx-watercolor/src/playground/Engine.ts` (awake sites 1249-1253, 1566-1568, 4300-4302; wetUntil 3973-3976; wetDecay 3968-3970; sleep 4180-4195; setHoldWet 2044-2046; fix 2067-2083; touch 3847; lastWet writers 1430-1431, 3350-3351, 3891-3892; clock 475, 487-501)
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` (imports 26-41; formula 276-290; constants 292-303; settle cap 640-670; applySettle 900-924; wet skip 946, 965; stepGap 561-599; clampCuisson 271-274)
- `packages/efx-watercolor/src/playground/params.ts:188-201` (dry ÷ 100)
- `packages/efx-watercolor/src/playground/wetState.ts:36-44` (held gate)
- `packages/efx-watercolor/src/adapter/engineAdapter.ts:532-533, 709-715`
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:24-30, 704-710, 775-786, 1020-1041, 1198-1296`
- `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts:160`
- `packages/efx-watercolor/probe/wet-hold/probe.ts:86-97, 450-479`; `/tmp/wet-hold/hold-hold.json`
- `packages/efx-watercolor/src/playground/holdWet.test.ts:10-14, 98-110`; `aquarelleBake.test.ts:584-589`; `app/vitest.config.ts:5`

### Secondary (MEDIUM confidence)
- Pre-change probe readouts (`/tmp/wet-hold/hold-hold.json`, `verify-hold.json`) — deterministic scene, but no post-change observation yet.

**Research date:** 2026-11-23
**Confidence breakdown:** stack/imports HIGH; engine mechanics HIGH (all sites read verbatim); bake parity HIGH for the mechanism, MEDIUM for the stamp hazard magnitude; probe mechanics HIGH.
