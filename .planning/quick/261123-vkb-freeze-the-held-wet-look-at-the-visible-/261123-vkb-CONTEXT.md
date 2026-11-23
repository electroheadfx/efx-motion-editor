# Quick Task 261123-vkb: Freeze the held wet look at the visible settle cap — Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Task Boundary

Follow-up to quick 261123-pee (UAT approved with reserve). The live Studio sheet never
auto-dries while held, but because the hold bypasses wetness decay the sim stays awake for
its full natural window (wetUntil ≈ lastWet + dryTau·ln(wetPeak/0.004), ~20 s at Dry 50),
so the dense wash visibly diffuses to a washed look by 10 s — and that washed state is what
a later Dry / key-leave commits. Freeze the dense wet look: while the sheet is held, cap the
sim's awake window after the last wet input at the RETIRED visible settle timing, then let
it SLEEP (no fix(), no decay, no mobile→fixed). Water gate stays open, wetPeak survives,
mobile pigment stays in the sheet. The next stroke/water dab re-arms the window and picks up
from the frozen wash.

</domain>

<decisions>
## Implementation Decisions

### Helper home (user: neutral module)
- Move `aquarelleVisibleSettleTicks` to a neutral package module
  (`packages/efx-watercolor/src/playground/settleCap.ts`). Re-export it from
  `bake/aquarelleBake.ts` so the package index (`src/index.ts` → `./bake`) and the layer's
  `@efxlab/efx-watercolor` import path stay unchanged. `Engine.ts` imports the neutral
  module — no Engine↔adapter↔bake cycle. ONE definition, no duplicated constants.

### Cap semantics (user: strict min)
- Held awake bound = `min(wetUntil(), lastWet + visibleSettleMs)`. A nearly-dry held sheet
  keeps its SHORTER natural window; a real wash is bounded by the cap. Never extends an
  awake window. Unheld branch byte-identical (`now < this.wetUntil()` exactly as today).

### Probe lens (user: Dry 100)
- Extend `packages/efx-watercolor/probe/wet-hold` with the existing dry-100 lens:
  held idle must stop at exactly 30 ticks (`aquarelleVisibleSettleTicks(100)`), the
  hold-off control must still sleep at the measured natural 237-tick window
  (pre-change readout /tmp/wet-hold/hold-hold.json), freeze proof digest at the cap vs
  +30 s idle. Unit tests pin the Dry 0/50/100 formula values.

### Locked artist behaviour (from the task spec)
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

### Engine seams (verified 2026-11-23; the spec's line numbers drifted)
- `isAwake` getter: Engine.ts:1249-1253. `tick()` awake expression: 1563-1583.
  rAF awake expression: 4288-4317 (uses `clockNow`). `wetUntil()`: 3973-3976.
  `sleep()`'s `if (!this.holdWet) this.wetPeak = 0;`: 4193. `wetDecay()`: 3968-3970.
  `advectWet uDecay`: 4070. `setHoldWet`: 2045. `fix(auto)`: ~2068.
- `holdWet.test.ts` pins the three awake expressions byte-identical (≈ lines 98-110) plus
  wetUntil/sleep/gate/decay pins. Re-express the awake pins deliberately (never delete);
  keep sleep/gate/decay/wetUntil pins unchanged.
- Layer polls `engine.isAwake` (AquarelleCanvasLayer.tsx:1202, 1294) and stamps
  `stampPendingSettle()` on awake→asleep — with ONE necessary adjustment (research Q5):
  the stamp must be floored at the cap (`stampPendingSettle(aquarelleVisibleSettleTicks(
  aquarelleParams.value.dry))`) because it measures from stroke end (`endedAt`, layer:786),
  not `lastWet`. Without the floor a last-dab→pointerup gap records `cap − gap`, flips the
  bake's `settleCapped` false (aquarelleBake.ts:657) and a dry re-render falls back to the
  washed 237-tick cook. The `stampPendingSettle(minTicks)` contract already exists and the
  commit path already floors the same way (layer:1036). No UI, no new control; this is the
  only layer edit beyond consuming the shared helper.
  `settleSheetNow` (1020-1041) and `settleForCapture` are commit paths — untouched.

</decisions>

<specifics>
## Specific Ideas

- Retired layer cap value + unit: `aquarelleVisibleSettleTicks(dryPercent: 0..100)` returns
  60 Hz ticks. Engine `params.dry` is 0..1 (params.ts:196) — the engine multiplies by 100
  and converts ticks → ms with 1000/60. The helper's JSDoc must state its percent unit.
- Measured probe facts (pre-change, dry-100 lens): natural held idle = 237 ticks / 3950 ms,
  wetPeak after the strokes = 0.028906. The hold-off control must reproduce that natural
  window; the held arm must now stop at 30 ticks.
- `isSheetWet` (wetState.ts:41) already returns true while held when
  wetPeak > WET_THRESHOLD — no gate change needed.
- Acceptance surface names: live during stroke / after the cap (frozen) / after Dry
  (dense dry committed) / re-render wet / PlayScript.

</specifics>

<canonical_refs>
## Canonical References

- Quick 261123-pee (hold-wet): `.planning/quick/261123-pee-*` artifacts; `holdWet.test.ts`.
- `packages/efx-watercolor/src/bake/aquarelleBake.ts:285` (`aquarelleVisibleSettleTicks`,
  used by the bake settle cap at :650 and by the layer at :675, :777, :1029).
- `packages/efx-watercolor/src/playground/wetState.ts` (WET_THRESHOLD, isSheetWet held branch).
- `packages/efx-watercolor/probe/wet-hold/` (probe.ts, run.mjs, index.html) — the harness to extend.
- `Skill("efx-studio-paint")` (loaded): live↔committed parity, KEY = CACHE, capture laws.

</canonical_refs>
