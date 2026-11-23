---
phase: quick/261123-pee
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/wetState.ts
  - packages/efx-watercolor/src/playground/wetState.test.ts
  - packages/efx-watercolor/src/playground/holdWet.test.ts
  - packages/efx-watercolor/src/playground/lastTouch.test.ts
  - packages/efx-watercolor/src/playground/liveSeed.test.ts
  - packages/efx-watercolor/probe/wet-hold/probe.ts
  - packages/efx-watercolor/probe/wet-hold/index.html
  - packages/efx-watercolor/probe/wet-hold/run.mjs
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
autonomous: true
requirements: []
estimate:
  # Three transactions. Task 1 is the engine law (hold, wet truth, Dry step,
  # sheet snapshot, non-mutating settled export) with its source pins plus the
  # probe harness and the hold scene. Task 2 is the bake settle option, the
  # adapter hold seam and the app plumbing (controller + clipboard) with unit
  # pins and the bake scene. Task 3 is the live layer, the Dry ledger and the
  # two wet call sites with the source pins and the full gate run.
  # estimate-calibration reports factor 1, sample_count 0, confidence low (no
  # calibration sample for quicks). Revision raised 92000 -> 96000 for the
  # liveSeed pins and the settled-export seam; the final revision adds the
  # in-flight-stroke export guard + the awake-window probe, the historyRevision
  # timer invalidation and the commit-settle hold lift. If Task 3's gate run grows past
  # ~1.5x, split it: 3a = layer hold + capture laws + the snapshot factory,
  # 3b = Dry ledger + the two wet call sites (same plan, second executor pass).
  tokens: 96000
  raw_tokens: 96000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "The live Studio sheet never auto-dries: a watercolor wash + acrylic stroke that is then left idle past the recorded settle window (engine asleep) still reads wet (`isSheetWet` open, `hasStandingWater` true) and the next acrylic stroke still picks up and blends — no wetness decay, no mobile->fixed conversion, no settle-cap fix."
    - "No infinite wake loop: the sim may sleep after its normal activity window (`isAwake` false, `sleep()` ran) while the wetness survives in the sheet and the gate stays open because the sheet is held — `wetUntil`/`isAwake` are untouched."
    - "Dry is one undoable step that both records and undoes: `fix()` clears the last-touch field AFTER it snapshots the pre-dry sheet, so acrylic paints on dry immediately, one undo restores the exact pre-dry sheet (mobile pigment, last-touch ages, wetPeak) and redo lands the post-dry state WITHOUT re-running the fix."
    - "Dry ledger alignment: the ledger entry is keyed to `fix()`'s own return value alone, and `fix()` (the layer's Dry sink) is the ONLY producer of an engine `'dry'` step — the capture-path settle (`Engine.settleForCapture`, behind the frame-leave, flush and Dry-timer captures) starts the same tick law through the no-step tail (`beginSettle` with `save = false`: no `beginStep`, no `protectHistory`, no last-touch clear, and no hold write inside the engine method — the layer's `settleSheetNow` wrapper lifts the hold with `setHoldWet(false)` after a settle it started, the locked dry-on-leave override, and the rAF tick re-arms it exactly like the explicit Dry), so each engine `'dry'` step has exactly one Dry ledger entry and each ledger entry exactly one engine step — a Dry on a painted-but-dry sheet (e.g. right after a key return) is still one aligned step, a Dry on a blank sheet opens neither, and a leave/flush settle pushes no engine step at all."
    - "Capture is dry-first on every commit path: the frame-leave capture, the flush capture and the Dry settle capture drive an in-flight explicit Dry to completion and force the engine's own settle through `Engine.settleForCapture` (same tick law, no engine history step, no last-touch clear; the engine method writes no hold, and the layer's `settleSheetNow` wrapper lifts it after a settle it started — dry-on-leave — with the rAF tick re-arming it) before the export, and the Save Script thumbnail (`copyLiveAlphaCanvas` / `captureAquarelleCanvas`) plus the raster-lift eager sheet read the engine's non-mutating settled export (capture sheet, settle, export, always restore — the live sheet is exactly as wet afterwards) and open no engine history step — no commit path persists a wet at-rest sheet (the only raw export left is a sheet with the engine's in-flight stroke — `this.stroke !== null`, never the simulated region `active` — where settling would abort it), and the retired settle capture is gone."
    - "`bakeAquarelleEventsToFrame` takes `settle: 'dry' | 'wet'` (default 'dry'): in 'wet' it skips `applySettle`, ignores recorded Dry events, keeps the identical timeline cook window, and the adapter's hold flag keeps the sheet wet through the whole replay (not just the tail strokes)."
    - "Only Shift+R re-render (`handleRebakeScript`) and Apply one frame (`handleApplyScript`) pass wet; undo/redo replays, script edits, lift-erase base recovery, library load-and-apply and PlayScript stay dry — pinned by the quoted-literal count and by the untouched call sites."
    - "An adopted wet bake sheet blends on the next stroke and reads wet to the Water gate: `SheetSnapshot` carries `wetPeak` + `wetAgo`, `restoreSheet` restores `painted`/`wetPeak`/`lastWet`, so a Dry right after adoption is a real step, not a no-op."
    - "An automatic Dry capture never settles renewed paint: the 1.2 s Dry settle-capture timer is (a) cancelled by a subsequent Dry and by any stroke start, (b) invalidated at fire time when the engine's `historyRevision` moved since schedule (an undo or redo of the Dry, or any other stack move), and (c) captures only while the sheet is still the post-Dry settled state (`!isFixing && !hasStandingWater`) — so no timer settles a live wet sheet step-free, reverting an undo or auto-drying fresh paint."
  artifacts:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/wetState.ts
    - packages/efx-watercolor/src/playground/holdWet.test.ts
    - packages/efx-watercolor/probe/wet-hold/run.mjs
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  key_links:
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/wetState.ts
      via: "`setHoldWet` is the ONE hold authority; `hasStandingWater` passes `held: this.holdWet` into `isSheetWet` so the Water gate stays open after the sim sleeps and `wetPeak` survives `sleep()`"
    - from: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the layer asserts `setHoldWet(true)` every rAF tick while the engine is not fixing and on construction; every `onCaptureFrame` export forces the engine's own no-step capture settle (`settleForCapture()` + tick law) first — never `fix()`, so no engine history step is pushed and the Dry ledger stays one-to-one — then lifts the hold (`setHoldWet(false)`, the dry-on-leave override; the tick re-arms it); and the `onSnapshotReady` factory is the engine's non-mutating settled export (capture sheet, settle, export, always restore — the sheet stays as wet as it was, no history step, no hold write)"
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
      via: "only the two tool call sites pass the quoted `wet` settle; the clipboard port forwards `settle` to `dispatchApply` -> `ports.applyAquarelleEvents` -> `applyAquarelleEventsToKey`"
    - from: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
      to: packages/efx-watercolor/src/bake/aquarelleBake.ts
      via: "`bakeAquarelleEventsToFrame` filters Dry events out in wet mode and passes `settle` into `defaultCreateAquarelleBake`, which skips `applySettle` on the final frame"
    - from: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
      to: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      via: "the new dry command kind routes to `undoPaint`/`redoPaint` (the live engine's tile stack) with the paint branch's fail-closed stack-move discipline; the Studio handler records it from `fix()`'s own return value, never from a wetness read, so the ledger mirrors the engine stack exactly"
    - from: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      to: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      via: "the registered `onSnapshotReady` factory is the settled export, and it feeds both durable consumers of the live sheet: `copyLiveAlphaCanvas`/`captureAquarelleCanvas` (the Save Script thumbnail, read before the drain) and the raster-lift eager sheet committed as `liveAlphaCanvas`"
---

<objective>
Hold the live Studio paint wet until the artist presses Dry, and make the two
one-frame tools (Shift+R re-render and Apply one frame) land a WET sheet while
every other replay stays dry.

Purpose: today the live sheet force-dries itself at a settle cap and the engine
decays water on a slider-driven tau, so watercolor stops blending with acrylic
after a pause and a wet wash is never blendable again without repainting. The
locked artist behaviour is the opposite: the live Studio sheet NEVER auto-dries;
watercolor keeps blending with acrylic indefinitely; Dry (F, top bar) is the one
recorded/undoable step that dries everything AND clears the last-touch field so
acrylic paints on dry immediately. Leaving a still-wet key forces the engine's
own settle first (a no-step capture settle: the committed/baked look, no engine
history step), lifts the hold (the locked dry-on-leave override; the next rAF
tick re-arms it), then captures; every other save path (the Save Script thumbnail,
the raster-lift eager sheet) reads a settled export that restores the wet sheet — so
the committed image and the bake stay the settled/dry look without a save ever
drying the working sheet. Re-render and Apply one frame must END WET — a replay
that settles is the bug the artist reported.

Every locked decision in `261123-pee-CONTEXT.md` is implemented here and none is
re-litigated: **Live hold seam** (`holdWet`, one source of truth; hold suppresses
AUTOMATIC drying only; explicit Dry and dry-on-leave override and lift it; the
wet bake reuses the flag), **isSheetWet summary** (`SheetSnapshot` carries
`wetPeak` + `lastWet` as an age; the gate stays open while held), **Dry undo
scope** (capture before `fix()`, one undo restores the exact pre-dry sheet, redo
lands post-dry without re-running the fix), plus the seven resolved research
open questions (only `handleApplyScript` + Shift+R pass wet; hold re-armed by the
live layer after an explicit fix and after a commit settle; Dry routed to the engine tile step with a new
ledger kind and no new script event; dry-first on BOTH frame-leave and flush
(a no-step capture settle) and on every save/lift commit via the non-mutating
settled export; `restoreSheet` restores `painted`; `wetPeak` truthful across
sleep + `held` input; the cache-law pin re-expressed deliberately; the Dry
ledger keyed to `fix()`'s return so the engine stack and the ledger stay
one-to-one, with the capture settle opening no engine step).

Output: `Engine.setHoldWet`/`isFixing` with reader-side decay bypass,
`Engine.settleForCapture` + the no-step `beginSettle(rect, save)` tail,
`Engine.exportSettledCanvas` (the non-mutating settled capture, gated on the
engine's in-flight stroke field and driving an in-flight Dry to completion) and
`Engine.historyRevision` (the Dry-timer invalidation signal), last-touch
clearing inside the existing `'dry'` step only, wet truth in `SheetSnapshot` and
`isSheetWet`, `settle: 'dry' | 'wet'` on the bake with the adapter hold seam and
its full app forwarding, the live layer's dry-first capture + retired settle cap
+ commit-settle hold lift + stale-proof Dry timer, the Dry ledger command, and a
headless probe scene proving the laws.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@packages/efx-watercolor/src/playground/Engine.ts
@packages/efx-watercolor/src/playground/wetState.ts
@packages/efx-watercolor/src/playground/wetState.test.ts
@packages/efx-watercolor/src/playground/lastTouch.test.ts
@packages/efx-watercolor/src/bake/aquarelleBake.ts
@packages/efx-watercolor/src/adapter/engineAdapter.ts
@app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
@app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
@app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
@app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts

Skills to load before implementing: `efx-studio-paint` (compositing laws,
live/committed parity, KEY = CACHE, sheet cache clocks, debugging discipline),
`spike-findings-efx-motion-editor` (probe harness laws and the measured
determinism contract), `efx-preact-reactivity` (the layer is a Preact component
with module variables and a rAF tick — no state, no effects, no render-body
writes).

**Project constraints that bind this plan**
- `pnpm`, `vitest run` only — never watch mode. Never start the dev server (the
  artist drives it). Never push. Do NOT commit `.planning` artifacts; code,
  tests and probe only.
- Change ONE law, prove it in the named test or probe scene, then the next.
- No new recorded script event type. No medium-record change (`mediums.ts`), no
  shader change, no Body/emboss change, no new UI control.
- Never replay strokes into the live engine (KEY = CACHE): adoption only through
  `restoreSheet`/`adoptSheet`.
- PlayScript's per-frame dry settle (`physicsPaintRotoPlayScriptRenderer.ts`) and
  the lift-erase base-recovery bakes are untouchable.
- Do not weaken the existing lock gates (`staticControlsLocked`, `wireframeMode`).

**Verified anchors at HEAD 7cd6ebe55 (re-read every one before editing)**
- `Engine.ts:2014-2026` `fix(auto = false)`: `beginStep('dry','Dry')`,
  `protectHistory(1, painted, fixed.views)`, `fixTimer = FIX_DURATION`,
  `touch(this.painted)` — this pool-0 protect is what makes the Dry step
  snapshot the exact pre-dry sheet. It does NOT clear last-touch.
- `Engine.ts:829-838` `clearLastTouch()` — writes `LAST_TOUCH_DRY_SECONDS` into
  both halves + `invalidateCarry`.
- `Engine.ts:3842-3850` `dryTau()`/`wetDecay()`/`wetUntil()`; `3944`
  `uDecay = Math.exp(-dt / this.dryTau())`; `1400` and `3767` wetPeak updates
  through `wetDecay()`.
- `Engine.ts:1223-1227` `isAwake`; `1536-1552` and `4171-4193` the two ticks both
  end `if (!awake && this.active) this.sleep();`; `sleep()` `4055-4066` zeroes
  `wetPeak`.
- `Engine.ts:213-216` `SheetSnapshot`; `captureSheet()` `1106-1112`;
  `restoreSheet()` `1119-1136` (calls `resetSheet()` → `resetPaintState()`:
  `active = null`, `painted = null`, `lastWet = -Infinity`, `wetPeak = 0`,
  `fixTimer = 0`).
- `Engine.ts:892-904` `resetPaintState()`; `resetSheet()` `2073-2086` (clears
  targets + `clearLastTouch`, no history step, no `history.begin`);
  `exportCanvas()` `1556-1582`; `FIX_DURATION = 1.2` at `413` and
  `fixTimer -= dt` at `3876` — the capture settle's own tick bound
  (`Math.ceil(FIX_DURATION * 60) + 1`).
- `liveSeed.test.ts:149-155` and `:190-199` the two `captureSheet`
  return-shape pins (`return { whole, bristleContent: this.bristleContent };`)
  that Task 1 must re-state to the new shape; `:196-199` the pass-through
  assertion that must keep holding.
- `PhysicsPaintStudio.tsx:790` `copyLiveAlphaCanvas`; `2215-2219`
  `captureAquarelleCanvas` (ink-gated Save Script read); `8390-8398` the
  raster-lift eager sheet; `10117-10121` the `onCaptureFrame` handler that
  receives the layer's factory. `physicsPaintRotoScriptClipboard.ts:583-621`
  reads the sheet eagerly before the drain (two reads per save: `:591` and
  `:604`).
- `probe/pickup-collapse/probe.ts:42` (imports
  `createAquarelleEngineAdapter`), `:1466` `toStudioStroke`, `:1705-1726`
  adapter construction + `adapter.stepTick`/`adapter.fix()` settle idiom,
  `:1740-1748` `adapter.applyStroke` — the stroke-construction route the new
  probe must copy, plus its captured-engine hook for direct engine reads.
- `Engine.ts:2133-2159` `travel()` restores `lastWet = now - meta.wetAgo`,
  `wetPeak`, `active`, `painted` — the Dry step's meta already carries them.
- `Engine.ts:3712-3732` `touch(rect, wake = true, save = true)` +
  `snapshotLayers()` (pool 0 = ink A/B, wet, relief, lastTouch read half,
  cover). The `save` branch is the pool-0 `protectHistory(0, …)`; `beginStep`
  (`3852-3858`) is the ONLY step opener and `protectHistory` (`3867-3870`) the
  only writer. A settle that opens no step MUST pass `save = false`, or it
  overwrites the previous step's before-image (the
  `useRotoPhysicalEditHistory.ts:1074-1075` warning: an engine undo would then
  resurrect the wrong pixels).
- `history.ts:78-84` `canUndo`/`entries()` (`{ list, index }`, `index` = undo
  depth) — the probe's step-free proof reads
  `(engine as unknown as { history: { entries(): { index: number } } }).history.entries().index`
  off the captured engine (`stepRecording` defaults `true`, so a real `fix()`
  moves the index and a no-step settle does not).
- `PhysicsPaintStudio.tsx:9250-9253` `handleAquarelleStrokeSettled` forwards the
  stamped tick count into `setAquarelleStrokeDiffusionFrames(mutationId, ticks)`
  (`aquarelleRecordState.ts:2567-2580`, whose `Math.trunc(NaN)` poisons
  `diffusionFrames`/`cuisson`); the bake's `settleCapped`
  (`aquarelleBake.ts:626-638`) is false for NaN, so a non-finite stamp silently
  yields the washed-out full settle.
- `wetState.ts:12,34-36` `WET_THRESHOLD = 0.004`, `isSheetWet` (its only caller
  is `Engine.hasStandingWater` at `1234-1241`).
- `AquarelleCanvasLayer.tsx:687-693` `stampPendingSettle` (zero-parameter
  today; no-argument calls at `:1107` `endSheetSession`, `:1170` the
  frame-change stamp, `:1222` the `wasAwake && !awake` stamp); `699-702`
  `painting`/`lastWetAt`/`settleCapArmed`; `1029-1032` the Dry live sink
  (`settleCapArmed = true; engine.fix();`); `1075-1093` the Dry settle capture
  (`FIX_SETTLE_MS = 1200`, `FIX_SETTLE_MS` at `84`); `1083-1093` pointerdown
  reopen (`engine.cancelAutoFix()`); `1157-1173` the frame-leave capture +
  `rememberSheet`; `1195-1201` the settle-cap auto-fix block
  (`engine.fix(true)`, the HEAD `engine.fix(` count is 2: `:1031` + `:1199`);
  `1204-1219` the settle capture (`if (wasAwake && !awake && engine.hasPaint)`);
  `1222` `stampPendingSettle()`; `1249` the Water-gate publish.
- `PhysicsPaintStudio.test.ts:4940` — the `offers the force-re-render only on a
  frame that owns a paint script` test pins the ONE-argument
  `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`;
  Task 3 RE-EXPRESSES it to the two-argument `'wet'` call (never deletes it).
- `aquarelleBake.ts:151-231` options; `886-903` `applySettle` (`settleCapped` →
  `seams.fix` + `FIX_SETTLE_TICKS`); call sites `924` and `942`; `485` the
  stroke list excludes Dry; `665-699` Dry grouping; `839-863` Dry application via
  `adapter.applyStroke(dry)`. Dry never contributes a tick to `timedBase` or to
  `timelineEnd`, so removing Dry events cannot move the cook window.
- `engineAdapter.ts:57-104` `AquarelleAdapterOptions`; `340-385` pre-first-stroke
  writes (paper/light/paperSeed seam, guarded by `!injectedEngine`); `446-454`
  `applyDry` (`engine.fix()` + 30 ticks); `703-704` `captureFrame`.
- `physicsPaintRotoPlayScriptController.ts:4244-4290` bake helper + option
  pass-through; `4280-4300` `defaultCreateAquarelleBake` call; `4350-4385`
  `applyAquarelleEventsToKey`; `4388-4406` `createDefaultAquarelleAdapter`.
- `physicsPaintRotoScriptClipboard.ts:196-205` port; `708-715`
  `applyPreparedScript`; `873-881` `applyScript`; `961-1011`
  `applyAquarelleTimeline`; `1060-1160` `dispatchApply` (aquarelle branch
  `1133-1145`).
- `PhysicsPaintStudio.tsx:2222-2237` the port implementation; `2651-2667`
  `handleApplyScript`; `6261-6291` `handleRebakeScript`; `6365` the
  `aquarelleScriptHistory` route; `6488-6489` `undoPaint`/`redoPaint`;
  `7058-7061` the F action; `10944`+ `canvasMountPropsMemo.resolve([...])`.
- `useRotoPhysicalEditHistory.ts:155-252` entry kinds; `840-870` the paint push;
  `980-990` `recordBackgroundEdit`/`recordAquarelleScriptEdit`; undo branches
  `1041-1131` (the `'paint'` non-recorded branch at `1082-1092`); redo
  `1290-1310`; return surface `1423-1436`.
- `aquarelleLayerContract.test.ts:120-122` and `:323` the `onCaptureFrame`
  factory pins; `:125-129` the cache pin to re-express; `:363-382` the SAVE
  registration pin (`onSnapshotReadyRef.current?.(snapshot)`) plus its
  after-setup / before-destroy ordering — all re-expressed in Task 3.
- `Engine.ts:616` `private active: Rect | null` ("document texels the sim must
  process", set by `touch()` at `3712-3724`, cleared by `sleep()` / `resetPaintState`)
  vs `Engine.ts:639` `private stroke: Stroke | null` — the REAL in-flight stroke:
  set at pointerdown `2297` and the script opener `1453`, cleared at
  `2343-2344`, `abortStroke` `2092`, `clear` `2043`, `resetSheet` `2074`,
  `restore` `1140`, `travel` `2118`. `active` stays non-null for the whole awake
  window after a stroke and during any fix — it is NOT pointer ownership, so no
  export guard may key on it.
- `Engine.ts:2116-2138` `travel()` — the ONE stack-move path (`undo`/`redo`
  `2099-2101`, `jumpTo` `2104-2110`, `abortStroke`, `cancelAutoFix`); a real
  move passes `if (!res) return;` before the meta/layer restore. `history.ts:88-91`
  `entries()` has no monotonic counter (undo+redo returns to the same index), so
  a fire-time timer invalidation needs a new `Engine.historyRevision`.
- `AquarelleCanvasLayer.tsx:1074-1093` the Dry settle-capture timer
  (`pendingSettleTimers` Set; guards `frameChanged` + `hasPaint` ONLY today —
  the stale-window hole), `1029-1032` the live Dry sink, and `1039-1067` the
  pointerdown listener (`engine.cancelAutoFix()` at `1056`, after the
  lift-refusal gate) — the seams where a pending Dry timer must be cancelled
  and invalidated.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Engine hold law, wet truth, the Dry step and the settled export</name>
  <files>
    packages/efx-watercolor/src/playground/Engine.ts,
    packages/efx-watercolor/src/playground/wetState.ts,
    packages/efx-watercolor/src/playground/wetState.test.ts,
    packages/efx-watercolor/src/playground/holdWet.test.ts,
    packages/efx-watercolor/src/playground/lastTouch.test.ts,
    packages/efx-watercolor/src/playground/liveSeed.test.ts,
    packages/efx-watercolor/probe/wet-hold/probe.ts,
    packages/efx-watercolor/probe/wet-hold/index.html,
    packages/efx-watercolor/probe/wet-hold/run.mjs
  </files>
  <behavior>
    - `wetState.test.ts`: a held sheet (`held: true`) with `wetPeak` above `WET_THRESHOLD` reads wet even when `nowMs` is past `wetUntilMs`; it reads dry while `fixing`, and dry at or below `WET_THRESHOLD`; an unheld sheet keeps today's window law.
    - `holdWet.test.ts` (new source-pin test, same slice-the-source idiom as `lastTouch.test.ts`): `wetDecay()` and the `uDecay` uniform each return 1 on the held branch; `sleep()` zeroes `wetPeak` only when not held; `fix(auto)` returns false while held for the automatic call and clears the hold for the explicit call; `isAwake`/`wetUntil()`/both tick awake expressions are unchanged; `hasStandingWater` passes `held`; `captureSheet` writes `wetPeak`/`wetAgo` and `restoreSheet` restores `painted`/`wetPeak`/`lastWet`; `settleForCapture()` contains no `beginStep`/`protectHistory`/`clearLastTouch` and no hold write, and starts through `beginSettle(this.painted, false)` (a no-step settle can never save pool 0 into a step it did not open); `fix()` is the only `beginSettle(…, true)` caller, its protect landing inside the `'dry'` step it just opened; `exportSettledCanvas()` guards its raw path on `this.stroke` (the in-flight stroke field — pinned so the guard never reads `this.active`), has an in-flight-fix branch that drives `tick` to completion before exporting, contains no `beginStep`/`protectHistory`/`clearLastTouch` and no hold write, starts the same no-step tail, always restores the captured sheet on the settle-it-started branch, and leaves the undo depth unchanged; `travel()` bumps `historyRevision` only past `if (!res) return;` (a real stack move) and no other method writes it.
    - `lastTouch.test.ts`: the `fix()` body calls `this.clearLastTouch()` AFTER `this.touch(this.painted)` and BEFORE the method returns, so the pre-dry last-touch pair is what the `'dry'` step protected.
    - `liveSeed.test.ts`: both `captureSheet` pins assert the NEW return shape (the object literal now carries `wetPeak` and `wetAgo` beside `whole`/`bristleContent`), and the pass-through assertion (`captureSheet` performs no age arithmetic of its own) still holds.
    - Probe `--scene hold`: painting watercolor then acrylic, idling past the settle window until the engine sleeps, keeps `hasStandingWater` true and keeps the next acrylic stroke's pickup (hue shift) at the no-idle control's level; an explicit `fix()` closes the gate and kills that pickup. An `exportSettledCanvas()` call in the post-sleep state AND again in the AWAKE window right after the second stroke (`stroke === null`, `active` non-null, `hasStandingWater` true) reports a DIFFERENT ink digest from the raw export each time, then the sheet still reads wet (`hasStandingWater` true, `captureSheet().wetPeak` unchanged) and the engine undo depth is unchanged — the settle is a capture, not a Dry; the awake-window call is the regression for a guard keyed on `active` (non-null for the whole awake window) instead of the in-flight stroke.
  </behavior>
  <action>
    Extend the engine with one hold authority and make the wet truths honest.

    `Engine.ts`: add `private holdWet = false;`, a public `setHoldWet(held: boolean)` one-liner that only assigns the flag, and a `get isFixing(): boolean { return this.fixTimer > 0; }` beside the other public getters. Add `private historyMoves = 0;` and `get historyRevision(): number { return this.historyMoves; }` beside `canUndo`/`canRedo`, and bump it in `travel()` ONLY after `if (!res) return;` — a real stack move, never a step that was merely opened — so the live layer can invalidate a pending Dry capture when the artist undoes or redoes the Dry (the engine is where undo/redo state actually changes, and the public `history.entries().index` cannot detect an undo+redo pair that returns to the same depth). In `fix(auto = false)` the FIRST statements become: an automatic call (`auto === true`) returns false while `holdWet` is set — no `beginStep`, no timer, no history write; an explicit call (`auto === false`) clears `holdWet` (this is the documented "explicit Dry lifts the hold"; the live layer re-arms it, see Task 3). Keep the existing `if (!this.painted || this.fixTimer > 0) return false;` ordering AFTER the auto refusal so a held-but-painted sheet still opens the `'dry'` step for an explicit call. Factor the timer/touch/schedule tail into `private beginSettle(rect: Rect, save: boolean)` (`this.fixTimer = FIX_DURATION; this.touch(rect, true, save); this.schedule();`); `fix()` sets `this.autoFix = auto`, calls `this.beginSettle(this.painted, true)` and then `this.clearLastTouch()` — the pool-0 snapshot `touch` takes must land BEFORE the clear or undo would restore the cleared field. `save = true` is reserved for a caller that just opened a history step: `touch`'s `save` branch protects pool 0 into the CURRENT step, so a no-step settle must pass `false` or it would overwrite the previous step's before-image. Do not change `protectHistory`, the step kind or the step label.

    Bypass decay reader-side: `wetDecay()` returns 1 when `holdWet` is set and `fixTimer <= 0`, otherwise today's exponential; the `advectWet` `uDecay` uniform in `step()` uses the same expression (1 while held and not fixing). Do NOT touch `dryTau()`, `wetUntil()` or either awake expression — the sim must still sleep normally. In `sleep()` guard the `this.wetPeak = 0;` write with the hold so the peak (and therefore the snapshot's wet truth) survives the sleep; `active`/velocity/pressure clearing stays exactly as today.

    `hasStandingWater` adds `held: this.holdWet` to its `isSheetWet` input. `wetState.ts`: `WetState` gains an optional `held?: boolean`; `isSheetWet` returns false when `fixing`, false when `wetPeak <= WET_THRESHOLD`, then true when `held === true` or `nowMs < wetUntilMs` (keep the strict threshold and window comparisons the existing pins assert).

    `SheetSnapshot` (`Engine.ts:213`) gains `wetPeak: number` and `wetAgo: number` (seconds, the same AGE convention as the last-touch record; `Infinity` when the sheet was never wet). `captureSheet()` fills them from `this.wetPeak` and the clock distance to `this.lastWet`. `restoreSheet()` after `uploadWhole` sets `this.painted = whole.rect ? { ...whole.rect } : null;`, `this.wetPeak = s.wetPeak ?? 0;` and `this.lastWet = Number.isFinite(s.wetAgo) ? this.clock() - s.wetAgo * 1000 : -Infinity;` — a restored sheet must be dryable (Pitfall 1) and must read wet to the gate after a wet bake adoption. Add a getter the layer can use for the dry-first capture if it needs the raw peak (only if the layer cannot use `hasStandingWater`).

    Add `settleForCapture(): boolean` — the capture-path settle Task 3 calls behind every `onCaptureFrame` capture (frame leave, flush, Dry-timer). Body: `if (!this.painted || this.fixTimer > 0) return false; this.beginSettle(this.painted, false); return true;`. Same tick law as `fix()` (the caller drives `tick` while `isFixing`), but NO `beginStep`, NO `protectHistory`, NO `clearLastTouch` and no hold write: it bakes a sheet the caller is committing and dropping, and it must never push an engine step — the ledger stays one-to-one with the engine's recorded `'dry'` steps, and an unledgered step is exactly what makes a later engine undo resurrect the wrong pixels. The last-touch clear stays inside the recorded Dry alone because it is undoable only through that step's pool-0 snapshot; at frame-leave `engine.clear()` clears it anyway and at the Dry timer the explicit Dry already did.

    Add `exportSettledCanvas(): HTMLCanvasElement | null` — the non-mutating dry-first export that Task 3 registers on `onSnapshotReady` for the Save Script thumbnail and the raster-lift eager sheet. Law, in this order: (1) an in-flight REAL stroke (`this.stroke !== null` — the pointer/script stroke field, NOT `this.active`, which is the simulated region `touch()` fills and which stays non-null for the whole awake window after a stroke and during any fix) returns `exportCanvas('transparent')` unchanged — the only raw export left, because settling would abort the stroke; (2) an explicit Dry already in flight (`fixTimer > 0`) is driven to completion with the same tick law (`this.tick(1 / 60)` while `fixTimer > 0`, bounded by `Math.ceil(FIX_DURATION * 60) + 1`) and the settled canvas is exported — a save or a lift during a settle must never commit a mid-settle image; (3) with no mobile pigment (`painted === null`) or nothing standing (`!hasStandingWater`) return the raw export; (4) otherwise capture the sheet first (`this.captureSheet()`), start the settle through `this.beginSettle(this.painted, false)` (never the explicit Dry `fix()`), drive the same bounded tick walk, export in a `try`, and ALWAYS `restoreSheet(snap)` in the `finally` — a save or a lift must leave the artist's live sheet exactly as wet as it found it and must never push an unledgered engine step. No `beginStep`, no `protectHistory`, no hold write of any kind: only the explicit Dry (inside `fix()`) and the layer's commit wrapper (dry-on-leave) lift the hold.

    Tests: extend `wetState.test.ts` with the held cases; add `holdWet.test.ts` with source pins (slice between method markers exactly like `lastTouch.test.ts`) including the `settleForCapture` pins (no `beginStep`/`protectHistory`/`clearLastTouch`, no hold write, `beginSettle(this.painted, false)`), the `exportSettledCanvas` pins (the raw guard reads `this.stroke` and the body contains no `this.active` test, the in-flight-fix tick walk, no step, no hold write, the unconditional restore on the settle-it-started branch, the cheap path) and the `historyRevision` pin (bumped in `travel()` past `if (!res) return;`, written nowhere else); extend `lastTouch.test.ts` with the `fix()` clear-after-snapshot pin; re-read `liveSeed.test.ts:149-155` and `:190-199` and re-state BOTH `captureSheet` pins to the new return literal (adds `wetPeak`/`wetAgo` beside `whole`/`bristleContent`), keeping the pass-through assertion at `:196-199`. The `'dry'` step's undo/redo contract needs no new engine code — `travel()` already restores `lastWet`/`wetPeak`/`painted` from the step meta — so pin it: the `fix()` body opens `beginStep('dry', 'Dry')` before `touch(this.painted)`.

    Probe: create `packages/efx-watercolor/probe/wet-hold/` modelled file-for-file on `probe/pickup-collapse/` (esbuild bundling of `probe.ts`, an `index.html` template with a bundle placeholder, `run.mjs` that writes to `/tmp/wet-hold/` and prints a compact report; imports from `../../src/...`). Build the sheet exactly the way that analog does — NOT the app's live tool path: `createAquarelleEngineAdapter({ width, height, paperPreset, paperStrength, paperSeed })`, strokes built with `toStudioStroke(...)` from `src/payload/toStudioStroke` and fed with `adapter.applyStroke(...)`, time advanced with `adapter.stepTick(...)`, and direct engine reads through the analog's captured-engine hook. `toEngineParams`/`buildBrushForStroke` belong to the app's pointer path and do not enter this probe. `probe.ts` exposes two scenes; this task implements `--scene hold`: arm the hold the way the live layer does — `engine.setHoldWet(true)` on the captured engine, re-asserted after every tick walk while `!engine.isFixing` (the adapter's `holdWet` option only lands in Task 2) — paint a watercolor stroke and an acrylic stroke, record the pickup control, then idle: advance the virtual clock past the recorded settle window with a bounded tick walk until `isAwake` is false (assert the awake -> asleep transition happened), then paint a second acrylic stroke over the same footprint and report the pickup hue shift and `hasStandingWater` before and after. Prove the settled export is a capture, not a Dry, in BOTH windows — each time reporting its digest beside the raw `exportCanvas('transparent')` digest (must differ while the sheet is wet), the post-call `hasStandingWater` and `captureSheet().wetPeak` (must be unchanged) and the engine undo depth (read off the captured engine's `history.entries().index`; must be unchanged): first in the post-sleep state (`stroke === null`), and again in the AWAKE window immediately after the second stroke — assert `stroke === null`, `active !== null` and `hasStandingWater` true there, because that awake case is exactly what a guard keyed on `active` (the simulated region, non-null for the whole awake window) would export raw. After the second stroke's pickup is recorded, prove the capture settle is step-free: record the depth, call `engine.settleForCapture()` and drive its ticks exactly as the layer does (`engine.tick(HOST_TICK_MS / 1000)` while `engine.isFixing`, bounded by `Math.ceil(1.2 * 60) + 1`), then report the depth again (must be unchanged), `hasStandingWater` (must be false) and `captureSheet().wetPeak` (must be 0). Add a `--dry` flag that calls the engine's explicit fix before the second stroke and reports the closed gate plus the absent pickup as the control, and its undo depth ONE greater than the held run's before-fix depth (the positive control proving the depth read detects a real step). Keep every readout numeric and deterministic (no wall-clock values in the assertions).
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run src/playground/wetState.test.ts src/playground/lastTouch.test.ts src/playground/holdWet.test.ts src/playground/liveSeed.test.ts</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label hold-hold</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --dry --label hold-dry</automated>
  </verify>
  <done>
    `pnpm --dir packages/efx-watercolor exec vitest run` is green including the new pins and the re-stated `liveSeed` captureSheet pins; the hold probe reports `hasStandingWater: true` after the idle with pickup retained at the control level and `asleep: true` (no wake loop), its settled export differs from the raw export in BOTH the post-sleep state and the awake window right after a stroke (asserted there with `stroke === null` and `active` non-null) while the sheet stays wet with an unchanged undo depth, and its `settleForCapture` run reports the same undo depth before and after with a closed gate and a zeroed `wetPeak`; the `--dry` control reports the gate closed, no pickup, and an undo depth one greater than the held run's before-fix depth; no shader, `mediums.ts`, `isAwake`, `wetUntil` or awake-expression byte changed (`git diff --exit-code` on those hunks).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: `settle: 'dry' | 'wet'` bake option, adapter hold seam and app plumbing</name>
  <files>
    packages/efx-watercolor/src/bake/aquarelleBake.ts,
    packages/efx-watercolor/src/bake/aquarelleBake.test.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.test.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts,
    packages/efx-watercolor/probe/wet-hold/probe.ts
  </files>
  <behavior>
    - `aquarelleBake.test.ts`: with a fake adapter exposing `fix` and `isAwake` (the existing fixture shape), `settle: 'wet'` calls neither and reports `settleTicks === 0` while the frame is still captured; with `settle` absent or `'dry'` the capped fix path runs exactly as today.
    - `physicsPaintRotoPlayScriptApplyBake.test.ts`: the same recorded event list (strokes + one Dry) baked `'wet'` never feeds the Dry to the adapter (`applyStroke` is not called with a Dry event) and still bakes one frame; baked `'dry'` feeds it.
    - `engineAdapter.test.ts`: `holdWet: true` writes the engine's hold flag before the first stroke; absent keeps the engine's default; an injected `engine` (the seed path) is never written.
  </behavior>
  <action>
    Bake (`aquarelleBake.ts`): export `type AquarelleBakeSettle = 'dry' | 'wet'` beside `AquarelleBakeOptions` and add `settle?: AquarelleBakeSettle` with a doc comment stating 'dry' is the default and 'wet' means "no end settle: the sheet keeps mobile pigment and water". In both places that call `applySettle()` (the final frame of the OFF path and the variation branch) gate the call on `options.settle !== 'wet'`. Change nothing else in the tick/window math, the Dry grouping, the cuisson clamp or `settleCapped` — the wet mode keeps the identical cook window and only omits the end fix.

    Adapter (`engineAdapter.ts`): `AquarelleAdapterOptions` gains `holdWet?: boolean` documented as the engine-level hold (same pass-through family as `light`/`paperSeed`). In the pre-first-stroke block, guarded like its neighbours (`!injectedEngine`), call `engine.setHoldWet(true)` when `options.holdWet === true`. Leave `applyDry`, `fix()` and `captureSheet()` untouched — in wet mode the bake never calls `fix` because `applySettle` is skipped and Dry events are filtered upstream.

    Controller (`physicsPaintRotoPlayScriptController.ts`): `bakeAquarelleEventsToFrame` gains `settle?: AquarelleBakeSettle` (omit → dry). Build the event list once: in wet mode filter out every `isAquarelleDryEvent` event before handing it to `bake.bake()` (Dry contributes no stroke tick to `buildRecordedTimeline` or `timelineEnd`, so the cook window is unchanged; the filter only suppresses the recorded Dry application). Pass `settle: input.settle ?? 'dry'` into `defaultCreateAquarelleBake(adapter, {...})`, and extend `createDefaultAquarelleAdapter(size, paper, light, paperSeed, holdWet)` to forward `holdWet: input.settle === 'wet'` into `createAquarelleEngineAdapter`. `applyAquarelleEventsToKey` gains the same optional `settle` and forwards it to the bake helper.

    Clipboard (`physicsPaintRotoScriptClipboard.ts`): the `applyAquarelleEvents` port input gains `settle?: 'dry' | 'wet'` (documented as the two-tool wet flag). `applyScript(settle?)` forwards into `dispatchApply`; `dispatchApply`'s `options` gains `settle?` and passes it to `ports.applyAquarelleEvents`; `applyAquarelleTimeline(events, settle?)` forwards it into its `dispatchApply` call. `applyPreparedScript` must not pass a settle (library load-and-apply stays dry), and `applyCurrentScript`/`applyProvidedScript` stay dry by construction.

    Probe: extend `probe/wet-hold/probe.ts` with `--scene bake`. Build ONE recorded event list (two watercolor strokes, one acrylic stroke, one recorded Dry in the middle) and bake it twice through `createAquarelleBake` with `frameCount: 1` and a stub `encodeWebp`: once `settle: 'wet'` on an adapter created with `holdWet: true`, once `settle: 'dry'` on a default adapter. Before disposing each adapter read `adapter.captureSheet()` and report: `wetPeak`, `wetAgo`, the per-layer numeric digest of `whole.layers` (sum and non-zero count per layer — deterministic, no canvas readback), `settleTicks`, `path`, `strokeCount` and the captured byte length. Assert in the probe: wet `wetPeak > WET_THRESHOLD` and wet `settleTicks === 0`; dry `wetPeak === 0` and dry `settleTicks === 72`; the two ink-layer digests differ.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts src/adapter/engineAdapter.test.ts</automated>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene bake</automated>
  </verify>
  <done>
    The bake A/B probe reports the wet sheet with `wetPeak > 0.004`, `settleTicks === 0` and a different ink digest from the dry sheet (`wetPeak === 0`, `settleTicks === 72`); the unit pins above are green; `applyPreparedScript` has no settle argument and the dry call sites in the app are untouched.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Live hold wiring, dry-first capture, Dry ledger and the two wet call sites</name>
  <files>
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx,
    app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx,
    app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts,
    app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts,
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts,
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  </files>
  <behavior>
    - `aquarelleLayerContract.test.ts`: the re-expressed cache pins assert every `onCaptureFrame` capture goes through the dry-first factory (the settle helper runs before the export at the leave, flush and Dry call sites), that helper starts the engine's NO-STEP capture settle (`engine.settleForCapture()`), and the layer's only `engine.fix(` call is the Dry sink — `grep -c "engine\.fix(" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` == 1 [HEAD=2 EXPECT==1 @7cd6ebe55].
    - The `onSnapshotReady` registration is the settled export (not the raw closure), so both Save Script reads and the raster-lift eager sheet commit the dry look; the layer reports `fix()`'s own return value to the ledger (`onDryAppliedRef.current?.(started)`), and the layer asserts the engine hold.
    - The commit-settle wrapper `settleSheetNow()` drives an in-flight explicit Dry to completion before deciding (`engine.tick` while `engine.isFixing`, bounded by `FIX_SETTLE_TICKS`), lifts the hold (`engine.setHoldWet(false)`) after a settle it started, and never calls the explicit Dry seam; the rAF tick re-arms the hold (`engine.setHoldWet(true)`) while not fixing.
    - The Dry settle-capture timer is stale-proof: `cancelPendingDrySettleCaptures()` is called from the live Dry sink before the explicit Dry and from the pointerdown handler after the lift-refusal gate (replacing the removed auto-fix reopen), and the timer callback captures only when the frame is unchanged, `engine.historyRevision` still equals the value captured at schedule and the sheet is still the post-Dry settled state (`!engine.isFixing && !engine.hasStandingWater`).
    - The layer contains no automatic settle cap — `grep -c "engine\.fix(true)" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` == 0 [HEAD=1 EXPECT==0 @7cd6ebe55].
    - The settle-stamp helper carries the defaulted floor at the parameter (`const stampPendingSettle = (minTicks = 0) => {`) with the stamp `Math.max(minTicks, Math.round((performance.now() - pending.endedAt) / HOST_TICK_MS))` and exactly the three existing no-argument call sites (`endSheetSession`, the frame-change stamp, the `wasAwake && !awake` stamp; `grep -c "stampPendingSettle();" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` == 3 [HEAD=3 EXPECT==3 @7cd6ebe55 GUARD MUTATION: a stamp call site gains an argument]), so every call site yields a finite count and a no-argument call keeps today's measured value.
    - `PhysicsPaintStudio.test.ts`: exactly the two tool call sites pass the quoted wet settle literal — `applyScript('wet')` in `handleApplyScript` and `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame), 'wet')` in `handleRebakeScript`; no comment repeats the literal — `grep -c "'wet'" app/src/components/physic-paint/PhysicsPaintStudio.tsx` == 2 [HEAD=0 EXPECT==2 @7cd6ebe55]; and the `offers the force-re-render only on a frame that owns a paint script` test's one-argument `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` pin at `:4940` is RE-EXPRESSED — never deleted — to the two-argument `'wet'` call.
    - `useRotoPhysicalEditHistory.test.ts`: a recorded dry entry pops to redo only when the engine's paint undo/redo reports a change; a refused move leaves both stacks and the entry untouched (fail closed); undo/redo of a dry entry never touches document state; and every recorded dry entry corresponds to exactly one engine `'dry'` step — a Dry on a painted-but-dry sheet still records one entry, a Dry on a blank sheet records none.
    - `aquarelleLiftEraseContract.test.ts`: the k03 D3 pointerdown gate keeps its ordinal law WITHOUT the retired auto-fix cancellation — the lift refusal still precedes the engine's own pointerdown handling, and the only removed assertion is the `engine.cancelAutoFix()` ordinal; every other pin in the file (eager sheet read before the flush, the raster commit, the merge-base fence) still holds.
  </behavior>
  <action>
    Layer (`AquarelleCanvasLayer.tsx`): after the engine is constructed call `engine.setHoldWet(true)`; in the rAF tick, before the capture bookkeeping, assert the hold again while the engine is not mid-fix (`if (!engine.isFixing) engine.setHoldWet(true)`) with a comment naming the artist law ("the live sheet never auto-dries; an explicit Dry or a commit settle lifts the hold and this re-arms it"). Delete the settle-cap block (the auto-fix that arms on the last wet timestamp), the `lastWetAt`/`settleCapArmed` declarations and every write to them (the two stroke callbacks, the frame-change reset, `clearSheetPaint`, `adoptSheet`, and the Dry live sink's `settleCapArmed = true;`), and the `engine.cancelAutoFix()` call in the pointerdown listener — replacing it with `cancelPendingDrySettleCaptures()` (a stroke start renews the wet sheet, so a pending Dry settle capture is stale) — keep every other duty of that listener (lift refusal, stroke keying, palm guard) and keep the listener's `reopenSettleOnPaint` name (its slice markers are pinned by the lift contract test). Delete the settle capture (the `wasAwake && !awake && engine.hasPaint` export block and its diagnostic event) but keep `stampPendingSettle()` and its `wasAwake && !awake` trigger; update the stroke-end comment that says the rAF settle capture owns the commit.

    Add `const FIX_SETTLE_TICKS = Math.round(FIX_SETTLE_MS / HOST_TICK_MS);` and a `settleSheetNow()` helper: if the engine has no paint return false; if an explicit Dry is already in flight (`engine.isFixing`) drive its own tick law to completion first (`engine.tick(HOST_TICK_MS / 1000)` while `engine.isFixing`, below `FIX_SETTLE_TICKS`), so a capture during a settle lands the settled canvas, never a mid-settle one; if `!engine.hasStandingWater` return false; otherwise read the visible cap (`aquarelleVisibleSettleTicks(aquarelleParams.value.dry)`), start the engine's NO-STEP capture settle — `if (!engine.settleForCapture()) return false;`, never the explicit Dry seam — then run the same tick loop; stamp the pending stroke with a floor of the cap (`stampPendingSettle(capTicks)`), so the recorded cuisson is at or above the bake's own `settleCap` and the re-bake reproduces the committed dry look (`settleCapped` stays true); then lift the hold with `engine.setHoldWet(false)` — the locked dry-on-leave override, because the sheet is being committed — and return true (the rAF tick re-arms the hold on its next pass, exactly like an explicit Dry). Add `const settledSnapshot = () => { settleSheetNow(); return snapshot(); }` and pass it to EVERY `onCaptureFrameRef` call (frame leave, Dry settle timer, `flushCapture`). This leave/flush settle is the CONTEXT's "force the normal fix first, then capture" law and may mutate the sheet, because the sheet is being committed and dropped.

    The capture settle is NOT a Dry: `Engine.settleForCapture` opens no engine history step (the `beginSettle` tail without `beginStep`/`protectHistory`), leaves the last-touch field untouched (the clear is undoable only inside the recorded `'dry'` step's pool-0 snapshot) and writes no hold flag — the hold lift lives in the layer's `settleSheetNow` wrapper (the dry-on-leave override), never inside the engine method and never on the save-path export. The Dry sink's explicit `fix()` call therefore stays the layer's ONLY Dry call and the only producer of an engine `'dry'` step — exactly one ledger entry per engine Dry step, and none for a leave/flush/Dry-timer capture.

    Extend `stampPendingSettle` with a DEFAULTED floor at the parameter: `const stampPendingSettle = (minTicks = 0) => { ... const ticks = Math.max(minTicks, Math.round((performance.now() - pending.endedAt) / HOST_TICK_MS)); ... }`. The default is the fix, not a cast: the strict app tsconfig (`app/tsconfig.json:8`, `"strict": true`) types an optional parameter as `number | undefined`, so `Math.max(minTicks, …)` would not compile without a default or a cast — and a cast would ship `Math.max(undefined, n)` → `NaN`, which `setAquarelleStrokeDiffusionFrames` turns into a `NaN` `cuisson` and the bake's `settleCapped` reads as false (the washed-out full settle). With `minTicks = 0` the three existing no-argument call sites keep today's measured value and every call site stays finite.

    Durable save/lift consumers: register `onSnapshotReadyRef.current?.(settledExport)` where `const settledExport = () => { try { return engine.exportSettledCanvas(); } catch { return null; } };` (the same fail-soft shape as `snapshot`) — NOT the raw `snapshot` closure — and re-express the SAVE registration pin accordingly. That single registration is the seam behind Save Script (`copyLiveAlphaCanvas` at Studio:790 and the eager `captureAquarelleCanvas` at 2216, read in the clipboard before the drain) and the raster-lift eager sheet (Studio:8393), so all three commit the dry look without drying the artist's live sheet: the export captures the sheet, settles, exports, and restores. A Save Script thus settles twice (the eager read at clipboard:591 and the `copyLiveAlphaCanvas` read at :604, with the sheet restored wet in between) — that is the accepted cost of never committing a wet sheet; do not memoize the canvas or drop the restore to save it. The sheet-cache `engine.captureSheet()` stays on its own path (the leave branch stores the sheet after `settleSheetNow`, so it stores the dry sheet). Keep the capture-before-`engine.clear()` order intact.

    Dry sink: define `pendingSettleTimers` and `cancelPendingDrySettleCaptures()` ahead of the two Dry sinks inside `attachEngine` (`const cancelPendingDrySettleCaptures = () => { for (const timer of pendingSettleTimers) window.clearTimeout(timer); pendingSettleTimers.clear(); };` — the same Set the cleanup already drains). In the live sink call `cancelPendingDrySettleCaptures()` FIRST (a subsequent Dry invalidates the previous Dry's capture window), then compute `const wasWet = engine.hasStandingWater;` then `const started = engine.fix();` and report through a new prop `onDryApplied?: (opened: boolean) => void` wired as a ref like the sibling props: `onDryAppliedRef.current?.(started)`. Publish `wasWet` into a closure flag the Dry settle-capture sink reads (both `onAquarelleDry` sinks fire on the same event in registration order, so the live sink sets it before the capture sink schedules). The ledger follows `fix()` alone — never `wasWet` — so every engine `'dry'` step gets exactly one ledger entry and every entry exactly one step (a Dry on a painted-but-dry sheet is reachable and must still be one aligned step). `wasWet` is a CAPTURE precondition only: schedule the Dry settle-capture timer only when `wasWet` (a dry sheet has nothing to re-capture). The timer must also be STALE-PROOF: capture the engine's `historyRevision` when scheduling and, in the callback, `invoked` only when the frame is unchanged, the revision still matches (an undo or redo of the Dry — or any other stack move — invalidates the pending capture) and the sheet is still the post-Dry settled state (`!engine.isFixing && !engine.hasStandingWater`); a sheet whose wet state was renewed after the Dry is never settled by this timer, step-free or otherwise. Record the frame/revision/state outcome in the existing `layer-capture` event payload (`data` is a `Record<string, unknown>`) and return before the capture whenever any check fails; when the checks pass, read through `settledSnapshot` (a no-op settle in the ordinary case, because the explicit Dry already settled the sheet).

    Mount (`PhysicsPaintCanvasMount.tsx`): add `onAquarelleDryApplied?: (opened: boolean) => void` to the props, mirror it in a ref and pass `onDryApplied={(opened) => onAquarelleDryAppliedRef.current?.(opened)}` on the layer.

    Studio (`PhysicsPaintStudio.tsx`): `handleApplyScript` calls `rotoScript.applyScript('wet')`; `handleRebakeScript` calls `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame), 'wet')`. The port implementation forwards the incoming `settle` into `applyAquarelleEventsToKey`. Add an identity-stable `handleAquarelleDryApplied` that calls `rotoMoveHistory.recordAquarelleDry()` when `opened` is true (it means "the engine opened a Dry step", not "the sheet was wet"), add it to the `canvasMountPropsMemo.resolve([...])` dependency list and the mount props object. Nothing else on the shared apply path changes.

    Ledger (`useRotoPhysicalEditHistory.ts`): add a `DryCommand` entry kind `'aquarelle-dry'` to the union, a `recordAquarelleDry` callback mirroring `recordAquarelleScriptEdit` exactly (push, `trimAppliedHistory`, `discardRedoHistory`, `publishAvailability`), and the undo/redo branches: pop the entry to the other stack, call `inputRef.current.undoPaint()` / `redoPaint()`, and on a false result restore both stacks and return false — the same fail-closed discipline as the unrecorded paint branch, never falling back to a script replay. Export it from the returned surface.

    Tests: in `aquarelleLayerContract.test.ts` re-express, never delete, the four snapshot pins — `:120-122` and `:323` (the `onCaptureFrame` factory is now `settledSnapshot`), `:125-129` (state the new law: the settled-look commit comes from the dry-first capture and the explicit Dry, and no settle cap exists), and `:363-382` (the `onSnapshotReady` registration is `settledExport`, keeping the after-setup / before-destroy ordering); add the hold assertion pin, the `onDryAppliedRef.current?.(started)` pin, the no-step capture-settle pin (`engine.settleForCapture()` present, `engine.fix(` count 1 — the Dry sink only), the commit-hold pins (the tick re-arms `engine.setHoldWet(true)` while not fixing and `settleSheetNow` lifts it with `engine.setHoldWet(false)` after a settle), the Dry-timer invalidation pins (`cancelPendingDrySettleCaptures()` in the live Dry sink before `engine.fix()` and in the pointerdown handler, the schedule-time `engine.historyRevision` comparison and the `!engine.isFixing && !engine.hasStandingWater` precondition in the callback), the settle-stamp pin (parameter default `= 0`, the `Math.max(minTicks, Math.round(...))` stamp, and the three no-argument call sites counting 3), and the Studio quoted-literal pin; in `PhysicsPaintStudio.test.ts` re-express the `:4940` Shift+R pin to `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame), 'wet')` (never delete it); add the dry-entry stack-move tests to `useRotoPhysicalEditHistory.test.ts` using the existing fake route fixtures; in `aquarelleLiftEraseContract.test.ts:93-114` drop ONLY the `engine.cancelAutoFix()` ordinal from the k03 D3 gate test (the gate → refusal → preventDefault ordering stays asserted) — every other pin in that file is untouched.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts</automated>
    <automated>grep -c "engine\.fix(true)" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx; test "$(grep -c "engine\.fix(true)" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx)" = "0" # [HEAD=1 EXPECT==0 @7cd6ebe55]</automated>
    <automated>test "$(grep -c "engine\.fix(" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx)" = "1" # [HEAD=2 EXPECT==1 @7cd6ebe55] — the Dry sink only; the capture settle is engine.settleForCapture()</automated>
    <automated>test "$(grep -c "stampPendingSettle = (minTicks *= *0)" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx)" = "1" # [HEAD=0 EXPECT==1 @7cd6ebe55] — the floor is defaulted at the parameter</automated>
    <automated>test "$(grep -c "stampPendingSettle();" app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx)" = "3" # [HEAD=3 EXPECT==3 @7cd6ebe55 GUARD MUTATION: a stamp call site gains an argument (e.g. the frame-change stamp passes a tick count), dropping the zero-argument count below 3]</automated>
    <automated>test "$(grep -c "'wet'" app/src/components/physic-paint/PhysicsPaintStudio.tsx)" = "2" # [HEAD=0 EXPECT==2 @7cd6ebe55]</automated>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run</automated>
    <automated>pnpm --dir app exec vitest run</automated>
    <automated>pnpm --dir app exec tsc --noEmit</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label final-hold</automated>
    <automated>node packages/efx-watercolor/probe/wet-hold/run.mjs --scene bake --label final-bake</automated>
  </verify>
  <done>
    All three gates are green (package vitest, app vitest, app tsc), both probe scenes report their assertions on the final tree, the source-pin counts match their recorded expectations (`engine.fix(true)` 1→0, `engine.fix(` 2→1 — the Dry sink only, settle-stamp default 0→1 plus the no-argument call-site guard at 3, quoted wet 0→2), the layer never auto-dries and every commit path settles first — the leave/flush captures drive an in-flight explicit Dry to completion, settle by the NO-STEP capture settle (`engine.settleForCapture`: no engine history step, last-touch untouched) and lift the hold (dry-on-leave; the tick re-arms it), and the Save Script thumbnail plus the raster-lift eager sheet by the settled export — gated on the engine's in-flight stroke, never the simulated region — that leaves the sheet exactly as wet as it found it and opens no engine step — Dry is exactly one engine step and one ledger entry (aligned by `fix()`'s return value) whose undo restores the wet sheet and whose redo needs no fix, no automatic Dry timer settles a live sheet whose wet state was renewed (cancelled by a subsequent Dry and by any stroke start, invalidated by `historyRevision` and by the post-Dry settled-state check), every settle stamp stays finite (the no-argument call sites keep the measured value), and the summary is reported as AUTOMATED-READY with the seven live UAT rows (no-auto-dry pause, Shift+R wet, Apply wet, Dry + one undo, PlayScript unchanged, wet-key leave, Save Script stays wet) handed to the artist. State in the SUMMARY that the ledger undo of a Dry does NOT remove the recorded Dry script event — accepted; a later dry-settle replay may re-apply it — so UAT row 6 is read as the pixels/wetness check, not a script check.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app options → engine/bake | `settle: 'dry' \| 'wet'` and `holdWet` are compile-time TypeScript unions written by two internal call sites; no file, IPC or user string reaches them. |
| recorded script → replay | The bake already consumes persisted stroke/Dry events; this plan changes only whether the end settle and recorded Dry applications run, never the event schema. |
| live engine → committed sheet | The capture path decides what pixels are committed to a key; a wet sheet committed as the settled look would be a data-integrity (not confidentiality) defect. |
| undo ledger → engine tile stack | A new ledger command moves the engine's undo/redo stacks; a mis-ordered move would restore pixels that disagree with the recorded script. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-PEE-01 | Tampering | `settle` / `holdWet` options (`aquarelleBake.ts`, `engineAdapter.ts`, clipboard port) | low | accept | Internal TypeScript string/boolean unions; no parser, no persisted field, no network surface. The bake defaults to dry when the option is absent, so an unset caller keeps today's law. |
| T-PEE-02 | Tampering | Dry ledger entry vs engine tile stack (`useRotoPhysicalEditHistory.ts`) | medium | mitigate | The entry is recorded from `fix()`'s own return value alone (a wetness read never gates it), so ledger and engine stack stay one-to-one; it pops only on a true `undoPaint`/`redoPaint` result, and a false result restores both stacks and returns false (fail closed). The capture-path settle is `Engine.settleForCapture` (no `beginStep`/`protectHistory`, `touch` with `save = false`, no last-touch write), so a leave/flush settle can never push an unledgered `'dry'` step. No script replay fallback, no new recorded event type. |
| T-PEE-03 | Tampering / Repudiation | `fix()` last-touch clear vs the `'dry'` undo step (`Engine.ts`) | medium | mitigate | `clearLastTouch()` runs AFTER `touch(this.painted)` so the pool-0 snapshot holds the pre-dry last-touch pair and meta; pinned by a source slice in `lastTouch.test.ts` and asserted by the Dry undo UAT row. |
| T-PEE-04 | Denial of service | hold vs the simulation loop (`Engine.ts`) | medium | mitigate | `isAwake`, `wetUntil()` and both awake expressions are untouched; `wetPeak` survives `sleep()` without re-waking. The hold probe asserts `isAwake === false` after the idle (no wake loop). |
| T-PEE-05 | Tampering (data integrity) | capture/commit paths (`AquarelleCanvasLayer.tsx` + `Engine.exportSettledCanvas`) | high | mitigate | Every `onCaptureFrame` export goes through the dry-first helper (an in-flight explicit Dry is driven to completion, then the engine's own no-step `settleForCapture` + tick law before the export — no engine history step, no last-touch clear) and then lifts the hold (dry-on-leave; the tick re-arms it); the `onSnapshotReady` factory is the non-mutating settled export, gated on the engine's in-flight stroke (`this.stroke`, never the simulated region `active`) and always restoring the captured sheet, so the Save Script thumbnail and the raster-lift eager sheet also commit the settled look while the live sheet stays as wet as it was; the settle cap and the wet settle capture are removed; a wet sheet is never committed. The probe's bake A/B, the awake-window and post-sleep settled-export assertions (undo depth and wet truth unchanged) and UAT rows 6-7 prove it. |
| T-PEE-06 | Elevation of privilege (UI intent) | wet settle scope | medium | mitigate | Only `handleApplyScript` and `handleRebakeScript` pass the quoted wet literal (source-pin count 0→2); undo/redo, script edits, lift recovery, library apply and PlayScript keep the dry default. |
| T-PEE-07 | Tampering (data integrity) | Dry settle-capture timer (`AquarelleCanvasLayer.tsx`) | medium | mitigate | The 1.2 s timer is cancelled on a subsequent Dry (`cancelPendingDrySettleCaptures()` in the live sink) and on any stroke start (the pointerdown listener, after the lift-refusal gate), and the callback captures only when the frame is unchanged, `engine.historyRevision` still matches its schedule-time value and the sheet is still the post-Dry settled state (`!engine.isFixing && !engine.hasStandingWater`) — an undone Dry or fresh paint is never settled step-free by the timer. Pinned in `aquarelleLayerContract.test.ts`. |
| T-PEE-SC | Tampering | package installs | low | accept | No package is added, upgraded or installed by this quick; no legitimacy checkpoint is required. |
</threat_model>

<verification>
- **Per-task gates** are the scoped `vitest run` targets and probe scenes above.
- **Full gates (checkout root, all must be green before handover):**
  `pnpm --dir packages/efx-watercolor exec vitest run`,
  `pnpm --dir app exec vitest run`,
  `pnpm --dir app exec tsc --noEmit`.
  Never watch mode; never start the dev server; never push.
- **Probe scenes:** `node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold` (and `--dry` control) and `--scene bake`; assertions are numeric and deterministic, artefacts land in `/tmp/wet-hold/`. The step-free proof is the captured engine's undo depth: unchanged across `exportSettledCanvas()` — asserted in BOTH the awake window (`stroke === null`, `active` non-null) and the post-sleep state — and across `settleForCapture()`, and one greater after the `--dry` control's explicit `fix()`.
- **Untouchable-surface audit:** `git diff --exit-code -- packages/efx-watercolor/src/playground/shaders.ts packages/efx-watercolor/src/playground/mediums.ts packages/efx-watercolor/src/playground/mediums.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`.
- **Source pins with recorded baselines:** layer auto-settle-cap count 1→0; layer `engine.fix(` count 2→1 (the Dry sink only — the capture settle is `engine.settleForCapture()`, which opens no engine history step); layer settle-stamp default `stampPendingSettle = (minTicks = 0)` 0→1, plus a regression guard on the no-argument call-site count 3→3 (the three existing stamps keep today's measured value under the new default, so no call site can produce `NaN`; the guard is pinned with its mutation reference); the layer's `settleSheetNow` lifts the hold after a settle it started and the rAF tick re-arms it; `cancelPendingDrySettleCaptures()` is called by the live Dry sink and by the pointerdown handler; the Dry-timer callback compares `engine.historyRevision` to its schedule-time value and requires `!engine.isFixing && !engine.hasStandingWater`; `Engine.exportSettledCanvas`'s raw guard reads `this.stroke`, never `this.active`; `travel()` bumps `historyRevision` only on a real move; Studio quoted wet literal count 0→2; `applyPreparedScript` passes no settle; `applyAquarelleTimeline` dry call sites (undo/redo `6228`, script edits `9318-9943`, recovery `8208`/`8550`, PlayScript) keep their one-argument form while the Shift+R pin at `PhysicsPaintStudio.test.ts:4940` is re-expressed (never deleted) to the two-argument `'wet'` call; the `onSnapshotReady` registration is the settled export (not the raw closure) and the Dry sink reports `fix()`'s return value alone (source pins in the layer contract test).
- **Durable-commit audit (read the diff, not just the tests):** the only readers of the live sheet are `onCaptureFrame` (settled factory), `copyLiveAlphaCanvas`/`captureAquarelleCanvas` and the lift eager sheet (all through the settled export factory). No reader of the raw `snapshot` remains outside the settled helpers.
- **Live UAT rows (artist-run, exact surface named):**
  1. Watercolor, switch to acrylic, pause >10 s, paint: still blends/picks up (no auto-dry).
  2. Shift+R re-render: the frame is wet and blendable again.
  3. Apply one frame: applied paint is wet and blendable.
  4. Dry (F): everything dries; acrylic afterwards paints on dry; one undo restores the wet state; the result keeps the dense settled look (not the washed-out full settle).
  5. PlayScript: unchanged, still settles/dries per frame.
  6. Leave a wet key: commits the dry look; returning shows the dry committed image (as today). Judge the PIXELS: a ledger undo of a Dry restores the wet sheet but does NOT remove the recorded Dry script event, so a later dry-settle replay may re-apply it (accepted, by design).
  7. Save Script on a wet sheet (and a lift-erase on a wet sheet): the sheet is STILL wet and blendable afterwards (a save/lift must not dry it), and the saved/committed artifact shows the settled look.
  Report AUTOMATED-READY first; never claim done before these rows pass.
</verification>

<success_criteria>
- The live sheet holds its water and mobile pigment indefinitely until Dry: no decay, no mobile->fixed, no settle-cap fix, and no wake loop (the sim still sleeps).
- Dry is one recorded/undoable step that dries the sheet, clears the last-touch field immediately and survives undo/redo through the engine's existing `'dry'` step; its ledger entry is keyed to `fix()`'s return so the engine stack and the ledger stay one-to-one — and every other settle (the capture paths and the settled export) is a no-step settle that pushes no engine step.
- Shift+R and Apply one frame end wet (bake skips the settle, ignores recorded Dry, adapter held); every other replay stays dry.
- An adopted wet sheet blends on the next stroke and reads wet to the Water gate.
- No automatic timer ever settles a live sheet whose wet state was renewed: the Dry settle-capture window is cancelled by a subsequent Dry and by any stroke start, and invalidated at fire time by any history move (`historyRevision`) or by the sheet reading wet.
- Every commit path is dry-first; a wet sheet is never committed — the save/lift commits restore the artist's live sheet exactly as wet as it found it and push no history step, the leave/flush captures settle through the no-step capture settle and lift the hold (dry-on-leave, re-armed on the next tick), and the only raw export left is a sheet with a real in-flight stroke (`this.stroke !== null`, never the simulated region).
- All three gates green; both probe scenes assert their laws (including the capture settle's unchanged undo depth and the `fix()` control's +1); the seven UAT rows are handed over as automated-ready.
</success_criteria>

<output>
Create `.planning/quick/261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet/261123-pee-SUMMARY.md` when done (English, per project convention). Do not commit `.planning` artifacts.
</output>
