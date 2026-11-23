---
phase: quick/261123-vkb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/settleCap.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/settleCap.test.ts
  - packages/efx-watercolor/src/playground/holdWet.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - packages/efx-watercolor/probe/wet-hold/probe.ts
  - packages/efx-watercolor/probe/wet-hold/run.mjs
autonomous: true
requirements: []
estimate:
  # Three transactions. Task 1 is the one shared cap law (a zero-import
  # playground module, the bake re-export, the engine awakeUntil() and its
  # three substitutions) proven by the held probe readout collapsing from the
  # natural window to the cap. Task 2 pins the formula and deliberately
  # re-expresses the 261123-pee awake pins, and floors the live layer's
  # awake-to-asleep settle stamp at the cap. Task 3 extends the dry-100 probe
  # lens (cap window, frozen digest, hold-off control, same-session wet-bake
  # arm with a non-gating parity report) and runs the full gate set.
  # estimate-calibration: factor 1, sample_count 0, confidence low (no
  # calibration sample for quicks).
  tokens: 64000
  raw_tokens: 64000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "While the live Studio sheet is held, the sim's awake window after the LAST WET INPUT is capped at the visible settle timing and then the sim SLEEPS: no fix, no wetness decay, no mobile-to-fixed. The recorded window measure is the ticks from `lastWet` to the LAST AWAKE observation — the engine sleeps inside the `stepTick` that crosses the bound, so that sleep-detection tick is excluded by construction; at dry 100 the held window measures exactly 30 ticks under the real accumulated 60 Hz clock (the probe's recorded `windowTicks` equals its recorded `capTicks`), not the natural ~237-tick window."
    - "The frozen sheet is immutable: after the cap, the raw canvas digest AND the paint-layer digests (`inkA`, `inkB`, `fixedA`, `fixedB`, `wet`, `relief`, `cover`) are byte-identical across +30 s of clock advance (1800 `adapter.stepTick` calls), with `isAwake` false, `hasStandingWater` true, `wetPeak` above `WET_THRESHOLD`, and both `active` and `stroke` null — the water gate stays open with the water and mobile pigment still in the sheet. `lastTouch` is EXCLUDED from the comparison: `captureWhole` stores it as AGES from the capture clock (`Engine.ts:1007` → `stampsToAges(..., nowSec())`), so every age rises with the clock advance by construction and equality there is impossible (it would prove nothing)."
    - "A next wet input re-arms the window: the probe's second acrylic stroke after the freeze wakes the sim, opens a history step and keeps the carried canvas colour at the no-idle control's level (existing pickup-retained law)."
    - "An unheld sheet is byte-identical to today: the hold-off control walk (`setHoldWet(false)` before the same walk) records `windowTicks === 237` under the SAME last-awake measure (walk count 237, the recorded pre-change baseline), closes the gate and zeroes `wetPeak`."
    - "ONE formula definition: `aquarelleVisibleSettleTicks` lives only in the zero-import `playground/settleCap.ts`; `aquarelleBake.ts` re-exports it (bake sub-entry and main entry resolve the same function, and the bake's own settle cap keeps working), `Engine.ts` imports the neutral module, and no second copy of the 30/270 constants exists."
    - "The held awake-to-asleep settle stamp is floored at the cap, so a dry re-render of a held sheet records a cuisson at or above the bake's `settleCap` (`settleCapped` stays true) and commits the dense cook instead of the washed 237-tick fallback."
    - "The bake law is unchanged: the `settle: 'wet'` arm still commits with `settleTicks === 0` and `wetPeak > WET_THRESHOLD`, the `settle: 'dry'` arm still forces exactly 72 settle ticks and zero peak, and the new same-session `wetSession` arm (the same two held strokes, `settle: 'wet'`, plain nonzero `recordedOrder` anchors) commits with `settleTicks === 0` and `wetPeak > WET_THRESHOLD`; its live-versus-bake paint-layer digests and both sides' resolved begin ticks are REPORTED as a non-gating diagnostic (`parity: reported`), never asserted equal — the adapter's per-sample tick law and `buildRecordedTimeline`'s `previousEnd` clamp make exact equality unprovable."
  artifacts:
    - packages/efx-watercolor/src/playground/settleCap.ts
    - packages/efx-watercolor/src/playground/settleCap.test.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/playground/holdWet.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
    - packages/efx-watercolor/probe/wet-hold/probe.ts
    - packages/efx-watercolor/probe/wet-hold/run.mjs
  key_links:
    - from: packages/efx-watercolor/src/playground/settleCap.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the ONE `aquarelleVisibleSettleTicks` definition and `SETTLE_TICK_MS` are imported by `Engine.ts` and consumed by `private awakeUntil()`; no Engine-to-adapter-to-bake cycle is created (the module has zero imports)"
    - from: packages/efx-watercolor/src/bake/aquarelleBake.ts
      to: packages/efx-watercolor/src/playground/settleCap.ts
      via: "`export { aquarelleVisibleSettleTicks } from '../playground/settleCap'` keeps the `./bake` barrel, `src/index.ts` and the live layer's `@efxlab/efx-watercolor` import resolving the same binding; the formula is deleted from the bake, not duplicated"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the three awake sites (`isAwake`, `tick()`, the rAF `frame`) compare against `this.awakeUntil()` (strict `Math.min` of `wetUntil()` and the cap when held; `wetUntil()` exactly when not held), and the existing `if (!awake && this.active) this.sleep()` paths do the sleeping — `sleep()`, `wetUntil()`, `wetDecay()`, the gate and `fix()` are untouched"
    - from: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      to: packages/efx-watercolor/src/bake/aquarelleBake.ts
      via: "the awake-to-asleep `stampPendingSettle(...)` call passes the cap from the shared helper, so the recorded cuisson never falls below the bake's `settleCap` and `settleCapped` stays true on a dry re-render"
    - from: packages/efx-watercolor/probe/wet-hold/probe.ts
      to: packages/efx-watercolor/probe/wet-hold/run.mjs
      via: "the held scene records `windowTicks`/`capTicks`/`frozen`/`frozenAfter` and a same-session `wetSession` bake arm; `run.mjs` asserts the cap window, the clock-free freeze immutability (paint layers only — `lastTouch` stores ages) and the hold-off control, and REPORTS the live-versus-wet-bake paint-layer digests plus resolved begin ticks as a non-gating parity diagnostic"
---

<objective>
Freeze the held wet look at the visible settle cap. While the live Studio sheet
is held (`holdWet`), the engine's awake window after the last wet input becomes
`min(wetUntil(), lastWet + aquarelleVisibleSettleTicks(dry) * 1000/60)` and then
the simulation SLEEPS — no `fix()`, no wetness decay, no mobile-to-fixed. The
Water gate stays open, `wetPeak` survives, water and mobile pigment stay in the
sheet; the next wet input re-arms the window.

Purpose: quick 261123-pee (UAT approved with reserve) holds the live sheet wet
indefinitely, but because the hold bypasses decay the sim stays awake for its
full natural window (`wetUntil` ≈ `lastWet + dryTau*ln(wetPeak/0.004)`, ~3.95 s
at Dry 100, ~20 s at Dry 50), so the dense 1 s wash visibly diffuses to a washed
look by 10 s — and that washed state is what a later Dry or key-leave commits.
Capping the held awake window at the RETIRED visible settle timing freezes the
dense wet look while keeping it blendable. Every locked decision in
`261123-vkb-CONTEXT.md` is implemented here: **Helper home (user: neutral
module)** — one zero-import definition in `playground/settleCap.ts`, re-exported
from the bake, imported directly by the engine; **Cap semantics (user: strict
min)** — `min(wetUntil(), lastWet + cap)`, never extending an awake window, with
the unheld branch byte-identical; **Probe lens (user: Dry 100)** — the held
window stops at exactly the cap, the hold-off control keeps the natural window,
and the frozen sheet's canvas and paint layers are digit-identical over +30 s
(`lastTouch` excluded — it stores ages); **Locked artist behaviour** —
no fix, no decay, no mobile-to-fixed, gate open, peak alive, cap measured from
`lastWet` only, no wake loop, and the bake settle option / adapter hold seam /
clipboard / controller / PlayScript / commit paths / Dry ledger untouched.

Output: `packages/efx-watercolor/src/playground/settleCap.ts` (the one formula +
`SETTLE_TICK_MS`), a re-export in `aquarelleBake.ts`, `Engine.awakeUntil()` with
the three awake-site substitutions, the layer's cap-floored awake-to-asleep
settle stamp, the re-expressed `holdWet.test.ts` pins plus a new
`settleCap.test.ts`, and an extended `probe/wet-hold` harness proving the cap,
the clock-free freeze immutability, the hold-off control and the re-wake
pickup, plus a `wetSession` wet-bake arm whose live-versus-bake digest read is
reported (non-gating), never asserted.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/quick/261123-vkb-freeze-the-held-wet-look-at-the-visible-/261123-vkb-CONTEXT.md
@.planning/quick/261123-vkb-freeze-the-held-wet-look-at-the-visible-/261123-vkb-RESEARCH.md
@packages/efx-watercolor/src/bake/aquarelleBake.ts
@packages/efx-watercolor/src/playground/Engine.ts
@packages/efx-watercolor/src/playground/holdWet.test.ts
@packages/efx-watercolor/src/playground/params.ts
@packages/efx-watercolor/src/playground/wetState.ts
@packages/efx-watercolor/probe/wet-hold/probe.ts
@packages/efx-watercolor/probe/wet-hold/run.mjs
@app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
@app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts

Skills to load before implementing: `efx-studio-paint` (live-versus-committed
parity, KEY = CACHE, probe-gated law changes), `spike-findings-efx-motion-editor`
(the wet-hold probe harness laws), and `efx-preact-reactivity` (the layer edit is
one call in the existing rAF tick — no signal, no effect, no render-body write).

**Project constraints that bind this plan**
- `pnpm`, `vitest run` only — never watch mode (`app`'s `test` script is watch;
  always use `exec vitest run`). Never start the dev server. Never push. Do not
  commit `.planning` artifacts — code, tests and probe only.
- Change ONE law, prove it in the named probe readout or test, then the next.
- Do NOT reintroduce a settle-cap fix or call `fix()` at the cap (no auto-dry).
- No new event type, no shader/medium-record change, no new engine param, no UI.
- No stroke replay into the live engine (KEY = CACHE).
- Do not change the bake `settle` option, the adapter hold seam, the
  clipboard/controller plumbing, PlayScript, the commit paths or the Dry ledger.
- Do not slow or shorten the awake window when NOT held.
- Scope guard: this quick stays at 3 tasks / 9 files (the shape above); do not
  add a task or a file for verification plumbing — report a gap instead.

**Verified anchors at HEAD a11704700 (re-read every one before editing)**
- `aquarelleBake.ts:276-290` the formula (percent in, 60 Hz ticks out; NaN → 50,
  clamp 0..100) whose body moves verbatim. `:292-296` `FIX_SETTLE_TICKS` and the
  local `HOST_TICK_MS` (both stay). `:26-41` the import block (only
  `@efxlab/efx-paint-host`, `@efxlab/efx-paint-host/animation` and `../payload/*`
  — the bake never imports `playground`). `:648-670` the bake's own settle cap.
- `Engine.ts:1249-1253` `get isAwake` (`now`); `:1563-1583` `tick(dt)` (`now`);
  `:4288-4323` the rAF `frame` (`clockNow`) — the three sites carry the identical
  expression `(this.stroke !== null || this.fixTimer > 0 || now|clockNow < this.minAwakeUntil || now|clockNow < this.wetUntil())`.
  `:3966-3976` `dryTau`/`wetDecay`/`wetUntil`. `:4180-4195` `sleep()` and its
  `if (!this.holdWet) this.wetPeak = 0;`. `:635-643` the `holdWet` field comment;
  `:4189-4193` the sleep comment; `:2039-2046` `setHoldWet`; `:2067-2083` `fix`.
- `params.ts:196` `dry: num(p.dry, d.dry) / 100` — engine dry is 0..1, the helper
  takes 0..100.
- `wetState.ts:41-45` `isSheetWet` short-circuits on `held` (a capped awake
  expression can never close the Water gate).
- `AquarelleCanvasLayer.tsx:24-30` the `@efxlab/efx-watercolor` import block;
  `:697-710` `pendingSettle` + `stampPendingSettle(minTicks = 0)` (`Math.max(minTicks, …)`);
  `:775-786` the stroke record (`diffusionFrames` from the snapshot dry) and
  `pendingSettle = { stroke, endedAt: performance.now() }`; `:1020-1041`
  `settleSheetNow` already calls `stampPendingSettle(capTicks)`;
  `:1198-1296` the rAF poll (`const awake = engine.isAwake` then
  `if (wasAwake && !awake) stampPendingSettle();`).
- `holdWet.test.ts:98-110` the awake pin block (`sliceBetween` + `includes` +
  two regex occurrence counts: 2 × the `now` expression, 1 × the `clockNow`
  expression); `:10-14` the file header prose.
- `aquarelleLayerContract.test.ts:141-142` the awake/stamp pins;
  `:212-221` the settle-stamp-floor pins, including
  `countOccurrences(layer, 'stampPendingSettle();')).toBe(3)`.
- `probe/wet-hold/probe.ts:84-124` constants (`SETTLE_TICKS = 8`,
  `MAX_IDLE_TICKS`, `WET_SECONDS = 60`, `DRY_PARAM = 100`, `HOST_TICK_S`,
  `BAKE_*`); `:349-359` `horizontalPoints` (4 points, no explicit tick);
  `:387-402` `makeStroke(color, bag, mutationId, timestamp = 0)` →
  `toStudioStroke` (`ticks = max(1, lastTick)`, `recordedOrder = timestamp`);
  `:444-479` `idleWalk` + `engineTickWalk`; `:481-524` `settledExportProof`;
  `:560-570` `layerDigests`; `:720-890` `runScene` hold arm; `:612-700` the bake
  arms and `bakeEvents` (`recordedOrder` 1000/1200/1400 keeps `buildRecordedTimeline`
  on the `timed` path; `aquarelleBake.ts:429-455` returns null when
  `recordedOrder <= 0`, so a parity session must use a nonzero end stamp).
  `:709-715` in `engineAdapter.ts` `stepTick` is the clock advance.
- **Freeze-proof and parity law anchors**: `Engine.ts:1007` `captureWhole`
  stores `lastTouch` as AGES (`stampsToAges(readF(...), this.nowSec())`;
  `lastTouchClock.ts:27-33`), so a +30 s clock advance raises every age by
  construction — the freeze proof digests the seven paint layers only
  (`inkA`, `inkB`, `fixedA`, `fixedB`, `wet`, `relief`, `cover`).
  `engineAdapter.ts:452-500` `feedDueSample` advances one clock tick per sample
  and `:613-638` `applyStroke`/`renderAllStrokes` add one trailing tick (plus
  one `stepTick` per settle tick), while `aquarelleBake.ts:429-449` clamps
  `beginTick = Math.max(previousEnd, Math.max(0, rawBegin))` — the live walk
  and the bake's resolved begin ticks cannot agree, so any live-vs-bake digest
  comparison is REPORTED, never gated.
- Pre-change dry-100 readout: `/tmp/wet-hold/hold-hold.json` — held idle
  `ticks: 237`, `engineMs: 3950`, `wetPeak: 0.028906`, post-sleep gate open,
  `activeNull` true. Back it up before any rerun.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: One shared cap law, wired module -> bake re-export -> engine awake window</name>
  <files>
    packages/efx-watercolor/src/playground/settleCap.ts,
    packages/efx-watercolor/src/bake/aquarelleBake.ts,
    packages/efx-watercolor/src/playground/Engine.ts
  </files>
  <!-- planner-discipline-allow: 30 + 270 -->
  <action>
    Create the ONE shared formula module and make the held awake window obey it.

    `packages/efx-watercolor/src/playground/settleCap.ts` (NEW — zero imports;
    per the CONTEXT decision "Helper home (user: neutral module)"): move the
    `aquarelleVisibleSettleTicks` body VERBATIM from `aquarelleBake.ts:285-290`
    (same `Number.isFinite` guard, same NaN → 50 default, same 0..100 clamp,
    same `Math.round(30 + 270 * (1 - dry / 100))`), and export
    `const SETTLE_TICK_MS = 1000 / 60;`. The JSDoc must state the unit law: the
    argument is Dry Speed in PERCENT 0..100 and the return is 60 Hz ticks
    (0 → 300, 50 → 165, 100 → 30), the retired 261019c Studio visible settle
    window it now also bounds the live held awake window with. No other export,
    no import of any kind.

    `packages/efx-watercolor/src/bake/aquarelleBake.ts`: delete the local
    definition entirely and add `export { aquarelleVisibleSettleTicks } from '../playground/settleCap'`
    (place it with the other module-level exports above `clampCuisson`). Change
    nothing else: the bake's own settle cap at `:648-670`, `settleCapped`,
    `clampCuisson`, `FIX_SETTLE_TICKS`, the local `HOST_TICK_MS`, `stepGap` and
    both `applySettle` call sites stay byte-identical. Do NOT add `settleCap` to
    `playground/index.ts`: `src/index.ts` already star-exports both `./bake` and
    `./playground`, and a second barrel export of the same name is a duplicate
    star-export hazard. The public paths (`@efxlab/efx-watercolor` and
    `@efxlab/efx-watercolor/bake`) must keep resolving the same binding through
    the bake re-export.

    `packages/efx-watercolor/src/playground/Engine.ts`: import
    `{ aquarelleVisibleSettleTicks, SETTLE_TICK_MS } from './settleCap'` with the
    other local imports. Add ONE private helper immediately BEFORE
    `private wetUntil()` (keep `wetUntil()`'s own JSDoc anchor
    `/** Time (ms) until standing water` intact — a source pin slices it) whose
    body is exactly two branches: when `!this.holdWet` return `this.wetUntil();`
    (the unheld branch, byte-identical to today); otherwise return
    `Math.min(this.wetUntil(), this.lastWet + aquarelleVisibleSettleTicks(this.params.dry * 100) * SETTLE_TICK_MS)`.
    Document the law in prose: HOLD-WET 261123-vkb, while held the awake window
    after the LAST WET INPUT is capped at the visible settle window and the sim
    then sleeps with no fix, no decay and no mobile-to-fixed; the strict min
    never extends a natural window (a nearly-dry held sheet keeps its shorter
    one); the cap is measured from `lastWet`, never a pointer event. Do NOT
    write the retired literal expressions from the three awake sites anywhere in
    code or prose (the pins count occurrences).

    Substitute the helper at exactly three call sites, replacing the
    `this.wetUntil()` comparison in each awake expression: `get isAwake`
    (`now < this.awakeUntil()`), `tick(dt)` (`now < this.awakeUntil()`) and the
    rAF `frame` (`clockNow < this.awakeUntil()`). Everything else in those
    expressions stays byte-identical (`this.active !== null`, `this.stroke !== null`,
    `this.fixTimer > 0`, `now/clockNow < this.minAwakeUntil`).

    Update the two stale comments that still claim the awake window is
    untouched: the `holdWet` field comment (Engine.ts:635-643) and the `sleep()`
    comment (Engine.ts:4189-4193) — both must now say the hold suppresses
    automatic drying AND bounds the awake window at the visible settle cap, the
    sim still sleeping through the existing sleep paths, only an explicit Dry or
    the host's dry-on-leave commit lifting the hold. Also adjust the `isAwake`
    doc line to mention the held visible-settle window.

    Untouched by design: `wetUntil()`, `dryTau()`, `wetDecay()`, the `advectWet`
    `uDecay` uniform, `sleep()`'s guarded `wetPeak` write, `setHoldWet`, `fix()`
    and its refusal order, the `hasStandingWater` gate input, the `lastWet`
    writers, `minAwakeUntil` (its 250 ms floor can never bind against the
    500 ms minimum cap) and every bake/adapter/controller/clipboard file.

    Note for the executor: the existing `holdWet.test.ts` awake pins will read
    red after this task because they still pin the retired expressions. That is
    expected — Task 2 re-expresses them deliberately. Do not edit that file here
    and do not run the package suite as this task's gate; the tracer's gate is
    the compile check plus the held probe readout.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor run check</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label hold-cap && node -e "const r=require('/tmp/wet-hold/hold-cap.json');if(!(r.idle.awakeToAsleep&&r.idle.ticks>=29&&r.idle.ticks<=30))throw new Error('held idle '+r.idle.ticks+' (expected the 30-tick cap walk)')"</automated>
  </verify>
  <done>
    The package type-checks; the held dry-100 probe readout collapses from the
    pre-change 237-tick natural window to the 29-30-tick cap walk while every
    pre-existing held assertion (post-sleep gate open, wetPeak above threshold,
    `active`/`stroke` null, settled-export capture proofs, second-stroke pickup
    retained at the control level, capture-settle depth unchanged) still passes;
    the location-specific count shows `settleCap.ts` = 1 and `aquarelleBake.ts`
    = 0 occurrences of `30 + 270`; `git diff` touches no shader, medium
    record, adapter, bake-logic or controller hunk.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pin the formula, re-express the awake pins, floor the live settle stamp</name>
  <files>
    packages/efx-watercolor/src/playground/settleCap.test.ts,
    packages/efx-watercolor/src/playground/holdWet.test.ts,
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx,
    app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  </files>
  <behavior>
    - `settleCap.test.ts` (NEW): the formula pins 0 → 300, 50 → 165, 100 → 30 and
      `Number.NaN` → 165 (NaN falls through the guard to the 50 percent default);
      clamps below 0 → 300 and above 100 → 30; `SETTLE_TICK_MS === 1000 / 60`;
      the bake re-export is the SAME function object as the neutral module
      import (ONE definition).
    - `holdWet.test.ts` (re-expressed, never deleted): `get isAwake` and
      `tick()` each compare `now < this.awakeUntil()` (occurrence count 2) and
      the rAF frame compares `clockNow < this.awakeUntil()` (count 1); the
      retired wetUntil comparison appears zero times; the `wetUntil()` return
      pin stays byte-identical; the new helper has the unheld early return of
      `this.wetUntil()` and the held strict-min expression built from
      `aquarelleVisibleSettleTicks(this.params.dry * 100) * SETTLE_TICK_MS`;
      every other pin in the file (decay bypass, `uDecay`, sleep peak guard and
      its one-write count, gate inputs, `fix()` refusal order and hold lift,
      `beginSettle` tail, `settleForCapture`, `exportSettledCanvas`,
      `SheetSnapshot`, `historyRevision`) stays byte-identical.
    - `aquarelleLayerContract.test.ts`: the awake-to-asleep stamp pin reads the
      floored call; the no-argument stamp-call count drops from 3 to 2; a new
      pin asserts the floor literal.
  </behavior>
  <action>
    Pin the new law and close the one layer hazard (research Q5).

    `settleCap.test.ts`: add the unit pins above. Import
    `aquarelleVisibleSettleTicks, SETTLE_TICK_MS` from `./settleCap` and
    `aquarelleVisibleSettleTicks as fromBake` from `../bake/aquarelleBake`; assert
    `fromBake === aquarelleVisibleSettleTicks` so the re-export identity is
    pinned, and assert the values (0/50/100/NaN, clamps). Keep
    `aquarelleBake.test.ts:584-589` green through that re-export without editing
    it.

    `holdWet.test.ts`: re-express the awake pin block deliberately in the same
    slice-and-count style — do not delete it and do not loosen it. The `isAwake`
    slice must include the new `now < this.awakeUntil()` comparison; the
    `wetUntil` slice keeps its exact return literal; the two occurrence-count
    regexes become the `awakeUntil` forms (2 × `now`, 1 × `clockNow`); add a
    negative count proving the retired comparison is gone, and a new
    `sliceBetween` pin for the helper covering the unheld early return and the
    held `Math.min(...)` expression with the percent conversion and
    `SETTLE_TICK_MS`. Rewrite the file header lines 10-14: the hold now ALSO
    bounds the awake window at the visible settle cap (the sim still sleeps, no
    wake loop), while `wetUntil()` and the decay bypass keep their own pins.
    Every other test in the file stays byte-identical.

    `AquarelleCanvasLayer.tsx` (the ONLY layer edit): the awake-to-asleep stamp
    in the rAF poll becomes
    `if (wasAwake && !awake) stampPendingSettle(aquarelleVisibleSettleTicks(aquarelleParams.value.dry));`
    — the same cap floor the commit path already passes at `settleSheetNow`.
    Rationale in place: this stamp measures from stroke end (`pending.endedAt`),
    not `lastWet`, so with the shorter held window any last-dab-to-pointerup gap
    would record a cuisson below the bake's `settleCap`, flip `settleCapped`
    false and make a dry re-render fall back to the washed 237-tick cook; the
    `stampPendingSettle(minTicks = 0)` contract already exists and stays. Update
    the stale re-arm comment nearby (it currently says there is no settle cap):
    say the hold keeps the sheet wet until Dry AND the awake window is bounded
    by the visible settle cap with no fix and no decay. No new signal, no new
    effect, no render-body write, no UI.

    `aquarelleLayerContract.test.ts`: re-express the `:141-142` awake/stamp pins
    to the floored call, change the `:220` no-argument count from 3 to 2 with
    its comment updated to the two remaining sites (`endSheetSession` and the
    frame-change stamp), and add one pin that the awake-to-asleep stamp passes
    the cap from `aquarelleVisibleSettleTicks(aquarelleParams.value.dry)`. Keep
    the `stampPendingSettle = (minTicks = 0)` default pin unchanged.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run</automated>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts</automated>
  </verify>
  <done>
    The full package suite is green (including the new formula pins, the
    re-expressed awake pins and the untouched `aquarelleBake.test.ts` formula
    pins); the layer contract test is green with the floored stamp; the layer
    diff is one call argument plus comment prose; `wetUntil`, `wetDecay`,
    `sleep`, the gate, `fix()`, the bake and the adapter have no behavioral
    change.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Prove the freeze in the probe — cap window, immutable sheet, hold-off control, re-wake, wetSession arm</name>
  <files>
    packages/efx-watercolor/probe/wet-hold/probe.ts,
    packages/efx-watercolor/probe/wet-hold/run.mjs
  </files>
  <behavior>
    - Held arm (dry 100): the idle walk records `windowTicks` (ticks from
      `lastWet` to the LAST AWAKE observation — the `stepTick` that crosses
      the bound puts the sim to sleep, so its sleep-detection tick is excluded
      by construction) and `capTicks` (`aquarelleVisibleSettleTicks(DRY_PARAM)`
      = 30); `windowTicks === capTicks` (30 under the real accumulated 60 Hz
      clock; the walk count is 30 too — only a loop-exit clock difference
      would read 31).
      Every pre-existing held assertion keeps passing (gate open past sleep,
      peak above threshold, both `active` and `stroke` null, settled-export
      capture proofs, second-stroke pickup retained at the control level,
      capture-settle depth unchanged).
    - Freeze proof (clock-free quantities only): the raw canvas digest and the
      paint-layer digests for `{inkA, inkB, fixedA, fixedB, wet, relief, cover}`
      recorded at the cap equal those recorded after 1800 further
      `adapter.stepTick` calls (+30 s of clock), with `isAwake` false,
      `hasStandingWater` true and `wetPeak` unchanged. `lastTouch` is EXCLUDED
      from the digest read: `captureWhole` stores it as AGES from `nowSec()`
      (`Engine.ts:1007`), so every age rises by 30 s with the clock advance —
      equality there is impossible by construction and would prove nothing.
    - Hold-off control (`holdoff=1`): `setHoldWet(false)` before the same walk,
      no re-arm; the walk records `windowTicks === 237` under the SAME
      last-awake measure (walk count 237, the recorded pre-change baseline),
      then the gate closes and `wetPeak` zeroes.
    - `wetSession` bake arm (gated laws only): bakes the SAME two-stroke session
      the held scene ran (same seeds, same params, `settle: 'wet'` on a hold
      adapter) with plain nonzero `recordedOrder` anchors (1000 / 1200 — ordering
      anchors only, NOT a tick-alignment claim); its `settleTicks` is 0 and its
      `wetPeak` is above `WET_THRESHOLD`. Its live-versus-bake paint-layer digest
      comparison and both sides' resolved begin ticks are REPORTED in the readout
      and in run.mjs's console (`parity: reported`) and never gate the run: the
      adapter's per-sample tick law (`feedDueSample` advances one clock tick per
      sample plus one trailing tick) and `buildRecordedTimeline`'s `previousEnd`
      clamp make exact equality unprovable, and the task spec asks for no such
      equality.
    - Existing bake A/B unchanged: wet `wetPeak > WET_THRESHOLD` and
      `settleTicks === 0`; dry `wetPeak === 0` and `settleTicks === 72`; the two
      arms' ink digests differ.
  </behavior>
  <action>
    Back up the pre-change reference first (`/tmp/wet-hold/hold-hold.json` ->
    `/tmp/wet-hold/hold-hold.pre-vkb.json`, only if the source exists) so the
    natural 237-tick control has a recorded baseline.

    `probe.ts`:
    (1) Import `aquarelleVisibleSettleTicks` from `../../src/playground/settleCap`
    (the one definition) and record `capTicks: aquarelleVisibleSettleTicks(DRY_PARAM)`
    in every hold-scene config report.
    (2) Add a `holdoff` query flag to `readSceneConfig` and `SceneConfig`
    (`holdoff=1`), validated like the existing `dry` flag.
    (3) Extend the engine-internals read with the clock, `lastWet` and the
    `wetUntil()` call (the probe already casts the engine for `history`,
    `active`, `stroke`; `lastWetMs` and `wetUntilMs` are readout diagnostics
    only and never feed the measure). Extend
    `idleWalk(engine, adapter, hold = true)`: when `hold` is false, call
    `setHoldWet(false)` BEFORE the loop and never re-arm. THE WINDOW MEASURE
    is the LAST AWAKE OBSERVATION, never the loop-exit clock: read
    `lastAwakeClock = clock()` at the TOP of each loop iteration, BEFORE
    `adapter.stepTick` — that is the clock the `isAwake` loop condition just
    accepted as awake — and initialise it to the entry clock read so the field
    is defined even if the engine starts asleep; after the loop report
    `windowTicks = Math.round((lastAwakeClock - lastWet) / HOST_TICK_MS)`
    beside `ticks`. The engine sleeps INSIDE the `stepTick` that crosses the
    bound, so the loop-exit clock is the sleep-detection tick and would read
    31 at dry 100; the last awake observation excludes it by construction
    (dry 100: round((~799.9999999999995 − 300) / (1000/60)) = 30; the first
    top-of-loop read is already one tick past `lastWet`, so this measure
    equals the walk count — 30 held, 237 hold-off). Keep the existing fields
    unchanged.
    (4) In the hold scene, when `config.holdoff`, run the control walk and
    report `arm: 'heldoff'` with `idle` (carrying the same last-awake
    `windowTicks`) + `postSleep` only (the control's sleep zeroes `wetPeak`
    and closes the gate, so the wet-dependent blocks cannot run); otherwise
    keep the current order. After the held idle walk (before the
    second stroke), record `frozen` = raw digest (`digestCanvas` of
    `exportCanvas('transparent')`), the paint-layer digests and the state reads.
    Add a `PAINT_LAYER_IDS` tuple (`inkA`, `inkB`, `fixedA`, `fixedB`, `wet`,
    `relief`, `cover`) and give `layerDigests(whole, ids = all keys)` an optional
    filter (the bake arms' existing single-argument calls stay byte-identical).
    The comment must state the ages law: `captureWhole` stores `lastTouch` as
    SECONDS-BEFORE-CAPTURE (`Engine.ts:1007` → `stampsToAges(..., nowSec())`,
    `lastTouchClock.ts`), so a +30 s clock advance raises every age — `lastTouch`
    is excluded from the freeze comparison because its digest cannot be stable.
    Record `isAwake`, `hasStandingWater`, `wetPeak` and `activeNull`, then run
    1800 `adapter.stepTick` calls (advancing the probe's running tick counter)
    and record `frozenAfter` with the same reads and the same paint-layer filter.
    The extra clock advance must not disturb the second-stroke block: the sheet
    is asleep and frozen. Because the second stroke now runs on a sheet whose
    `lastWet` is 30 s old, re-confirm its two pre-existing pickup assertions
    still pass — `second pickup retained at the control level` (carried hue
    within 5 deg of the pre-idle control) and `second pickup moved off its own
    hue` (drag at least 5 deg from the stroke's own hue). Pickup is
    colour-gated and the sheet is held/asleep, so the risk is low; if one
    regresses, investigate the cause and never weaken the pre-existing check.
    (5) Add a `holdSession(blueSize)` helper returning the two strokes the held
    scene applies (band seed `0x7ec000` with `paramsBag(bandSize, 0, 0)`,
    acrylic seed `0x7ec001` with `paramsBag(blueSize, 100, 100)`) with plain
    nonzero `recordedOrder` anchors (band 1000, acrylic 1200 — the
    `buildRecordedTimeline` timed-path requirement: it returns null unless every
    stroke's stamp is a finite positive number). These anchors are an ORDERING
    device, never a tick-alignment claim: `buildRecordedTimeline` clamps
    `beginTick = Math.max(previousEnd, rawBegin)` (aquarelleBake.ts:429-449) and
    the adapter burns one clock tick per sample plus one trailing tick
    (engineAdapter.ts:452-500, 613-638), so the bake's begin ticks cannot
    reproduce the live walk's. Keep the LIVE applies exactly as they are today
    (`makeStroke` with the default timestamp 0) — the live deposit path ignores
    `recordedOrder` and must stay byte-identical; share the seed/param values so
    the two arms cannot drift. Record the probe's running tick counter
    immediately before each live `applyStroke` as `liveBegins` (`band`,
    `acrylic`) — a MEASURED value for the parity report, never asserted.
    (6) Add a `wetSession` bake arm: `settle: 'wet'` on an adapter created with
    `holdWet: true`, `frameCount: 1`, the same stub encoder, baking
    `holdSession(blueSize)`; report `settleTicks`, `wetPeak`, `path`, `layers`,
    the strokes' `recordedOrder`/`ticks` and their begin ticks derived with the
    same `originMs`/`previousEnd` formula as `buildRecordedTimeline` (a
    report-only mirror, commented as such), plus byte length. Expose it as
    `wetSession` beside the unchanged `wet`/`dry` arms. Do not change
    `bakeEvents`, the wet/dry arms, or any bake source.

    `run.mjs`:
    (1) Add `--holdoff` -> query `holdoff=1`, and a `heldoff` report/assert
    branch: asleep with `ticks === 237` AND `windowTicks === 237` under the
    same last-awake measure (the backed-up pre-change reference is `ticks: 237`;
    if the measurement lands one tick off, investigate the clock accumulation —
    do not widen it to a range without a note),
    `postSleep.hasStandingWater === false`, `postSleep.wetPeak === 0`,
    `postSleep.activeNull === true`.
    (2) Extend the held assertions: `idle.windowTicks === result.config.capTicks`
    and `result.config.capTicks === 30` at dry 100 (`windowTicks` is the
    last-awake measure recorded by the walk — never a loop-exit clock
    difference, which would read 31); `frozen.rawDigest ===
    frozenAfter.rawDigest`; the `frozen.layers` and `frozenAfter.layers` records
    are equal AND carry exactly the seven paint-layer ids (assert `lastTouch` is
    absent — the age-carrying layer must not enter the freeze proof);
    `frozenAfter.isAwake === false`; `frozenAfter.hasStandingWater === true`;
    `frozenAfter.wetPeak === frozen.wetPeak`; `frozen.activeNull === true`.
    Keep every existing check.
    (3) Extend the bake assertions (GATED): `wetSession.settleTicks === 0` and
    `wetSession.wetPeak > result.config.wetThreshold`. Then REPORT, never gate:
    cross-read `/tmp/wet-hold/${compareLabel}.json` (default `hold-hold`) when
    it exists and print a `parity: reported` line carrying `wetSession`'s and
    the held frozen sheet's paint-layer digests (the same `lastTouch`-free read)
    plus both sides' resolved begin ticks; print `parity: reported (no held
    run)` and continue when the file is absent. Do NOT assert equality and do
    NOT throw on a mismatch: the adapter's per-sample tick law and
    `buildRecordedTimeline`'s `previousEnd` clamp make exact equality
    unprovable, and a divergence is a finding for the readout, not a gate.
    (4) Update the file header (the new cap/freeze/hold-off laws, the
    `--holdoff` flag, and the non-gating `parity: reported` diagnostic).
    Never pin old wet-bake digest values and never gate on a live-vs-bake
    digest.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label hold-hold</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --holdoff --label hold-nohold</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene bake --label bake --compare hold-hold</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --dry --label hold-dry --compare hold-hold</automated>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor run build && pnpm --dir app exec vitest run && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    The held run reports `windowTicks === capTicks === 30` (the last-awake
    measure — the sleep-detection tick is excluded by construction), a frozen
    raw digest and the seven paint-layer digests (`lastTouch` excluded — it
    stores ages) identical after +30 s of clock advance, and the post-cap state
    (asleep, gate open, peak alive, `active`/`stroke` null) while every prior
    held assertion still passes (including the two pickup checks, re-confirmed
    after the +30 s advance); the hold-off control reports `windowTicks === 237`
    under the same measure (walk count 237) with a closed gate and a zero peak;
    the bake scene reports the unchanged wet/dry
    A/B plus a same-session `wetSession` arm with `settleTicks === 0` and
    `wetPeak > WET_THRESHOLD` whose live-versus-bake paint-layer digests and
    resolved begin ticks are printed as a non-gating `parity: reported`
    diagnostic (never asserted equal); the dry arm still commits 72 settle ticks
    and the cross-run depth checks pass; the package suite, the rebuilt package,
    the app suite and `tsc --noEmit` are all green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| artist input -> engine clock | Wet inputs stamp `lastWet`; the awake window decides how long the sim keeps moving pixels. A wrong bound either freezes paint prematurely or keeps a simulation loop alive. |
| live sheet -> committed sheet | A Dry or a key-leave commits what the held sheet looks like; a washed fallback would persist a look the artist never saw. |
| recorded cuisson -> bake | The layer's measured awake window is recorded as the stroke's `diffusionFrames`; a too-small stamp flips `settleCapped` and changes the replay's cook. |
| probe harness -> law claims | The readouts are the evidence for every pinned law; a fabricated or unpinned threshold would ship an unproven law. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-VKB-01 | Denial of service | `Engine.awakeUntil()` held branch (`Engine.ts`) | medium | mitigate | Strict `Math.min` never extends a window; `active` becomes null at sleep and the existing sleep paths keep the sim idle. The probe asserts `isAwake === false` after the cap and that 1800 further clock ticks leave the sheet byte-identical with `active` null. |
| T-VKB-02 | Tampering (data integrity) | held settle stamp (`AquarelleCanvasLayer.tsx`) | high | mitigate | The awake-to-asleep stamp passes the cap as `minTicks`, so the recorded cuisson is at or above the bake's `settleCap` and `settleCapped` stays true; pinned in the layer contract test, and the same-session `wetSession` arm reports the live-versus-bake paint-layer digests as a non-gating diagnostic. |
| T-VKB-03 | Tampering (recorded-mode parity) | held-versus-unheld awake law (`Engine.ts`) | medium | mitigate | The unheld branch returns `wetUntil()` exactly and is covered by the hold-off control (natural 237-tick window, gate closed, peak zeroed). No recorded event type and no hold-mode recording are introduced; the bake's settle option, adapter hold seam, clipboard, controller, PlayScript, commit paths and Dry ledger are untouched (`git diff --exit-code` audit). |
| T-VKB-04 | Repudiation | probe claims | low | mitigate | Every new probe assertion is numeric and deterministic against the backed-up `/tmp/wet-hold/hold-hold.pre-vkb.json` reference; no old wet-bake digest is pinned; a parity mismatch is reported, never loosened. |
| T-VKB-SC | Tampering | package installs | low | accept | No package is added, upgraded or installed by this quick; no legitimacy checkpoint is required. |
</threat_model>

<verification>
- **Per-task gates** are the commands above. Note `app`'s `test` script is
  watch mode — always `exec vitest run`.
- **Full gates (checkout root, all green before handover):**
  `pnpm --dir packages/efx-watercolor exec vitest run`,
  `pnpm --dir packages/efx-watercolor run build`,
  `pnpm --dir app exec vitest run`,
  `pnpm --dir app exec tsc --noEmit`.
  Never watch mode; never start the dev server; never push.
- **Probe scenes:** `node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label hold-hold`
  (cap window 30 via the last-awake measure — never a loop-exit clock
  difference —, freeze immutability, re-wake pickup, pre-existing laws),
  `--scene hold --holdoff --label hold-nohold` (natural window
  `windowTicks === 237` under the same measure, walk count 237),
  `--scene bake --label bake --compare hold-hold` (wet/dry A/B plus the
  `wetSession` arm and its non-gating `parity: reported` diagnostic) and
  `--scene hold --dry --label hold-dry --compare hold-hold` (the Dry control,
  unchanged). Artefacts land in `/tmp/wet-hold/`; the pre-change reference must
  survive as `hold-hold.pre-vkb.json`.
- **Untouchable-surface audit:**
  `git diff --exit-code -- packages/efx-watercolor/src/playground/wetState.ts packages/efx-watercolor/src/adapter/engineAdapter.ts packages/efx-watercolor/src/playground/shaders.ts packages/efx-watercolor/src/playground/mediums.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts`,
  plus a read of the `Engine.ts` diff confirming `wetUntil()`/`dryTau()`/
  `wetDecay()`/the `uDecay` uniform/`sleep()`'s guard/`setHoldWet`/`fix()` hunks
  are untouched, and a LOCATION-SPECIFIC count:
  `grep -c "30 + 270" packages/efx-watercolor/src/playground/settleCap.ts` = 1
  AND `grep -c "30 + 270" packages/efx-watercolor/src/bake/aquarelleBake.ts` = 0.
  [HEAD: aquarelleBake.ts=1, settleCap.ts absent (0); EXPECT settleCap.ts=1 AND
  aquarelleBake.ts=0] — a tree-wide count of 1 proves nothing because it is 1
  at HEAD too.
- **Live UAT rows (artist-run; stay pending — report AUTOMATED-READY only):**
  1. Paint a dense wash with Dry 50, hold: the look is visibly frozen at ~1 s
     and still the same at ~10 s; the next stroke blends into it.
  2. Acrylic (or water) over the frozen sheet picks up the canvas colour.
  3. Dry (F) dries dense (not washed); one undo restores the wet sheet.
  4. Shift+R (wet re-render) and Apply one frame land a wet, blendable sheet.
  5. PlayScript is unchanged.
  6. Leaving a wet key commits the dense dry look.
  7. (Optional) Dry -> Apply within 1.2 s stays wet.
</verification>

<success_criteria>
- The held sim sleeps at the visible settle cap measured from the last wet
  input (Dry 100 -> 30 ticks; Dry 50 -> 165; Dry 0 -> 300), with no fix, no
  decay, no mobile-to-fixed and no wake loop; the probe's `windowTicks` is the
  last-awake measure (ticks from `lastWet` to the last awake observation; the
  sleep-detection tick is excluded), the Water gate stays open and `wetPeak`
  survives the sleep.
- The frozen sheet is byte-identical across +30 s of clock advance (raw canvas
  and the seven paint layers; `lastTouch` excluded — it stores ages), and the
  next wet input re-arms the window with pickup retained at the control level
  (the two pre-existing pickup checks re-confirmed after the +30 s advance).
- The unheld awake window is byte-identical (hold-off control: `windowTicks
  === 237` under the same measure, walk count 237, gate closed, peak zeroed).
- ONE formula definition lives in the zero-import `playground/settleCap.ts` and
  reaches the bake (`./bake` re-export) and the engine; the bake's settle cap,
  `settleCapped`, the settle option and the adapter hold seam are unchanged.
- The held awake-to-asleep settle stamp is floored at the cap, so a dry
  re-render of a held sheet keeps the dense cook.
- The same-session `wetSession` wet bake commits with `settleTicks === 0` and
  `wetPeak > WET_THRESHOLD`; its live-versus-bake paint-layer digests are
  reported as a non-gating diagnostic, never asserted equal. The dry bake still
  force-dries (72 settle ticks, zero peak).
- All four gates green; all four probe scenes green; the seven UAT rows handed
  over as automated-ready.
</success_criteria>

<output>
Create `.planning/quick/261123-vkb-freeze-the-held-wet-look-at-the-visible-/261123-vkb-SUMMARY.md` when done (English, per project convention). Do not commit `.planning` artifacts.
</output>
