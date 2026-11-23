# Quick Task 261123-pee: Hold Paint Wet Until Dry — Research

**Researched:** 2026-11-23
**Domain:** `@efxlab/efx-watercolor` drying/wetness + Studio live sheet + aquarelle bake replay
**Confidence:** HIGH — every engine, bake and app seam below was opened in the live tree this session; CONTEXT line refs drift by ≤2 lines.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Live hold seam: Engine-level `holdWet` flag (constructor/option), one source of truth. While held: `fixDrying`/settle and mobile->fixed are no-ops; transport and awake behavior unchanged. The hold suppresses AUTOMATIC drying ONLY. Explicit Dry (`fix(false)`) and dry-on-leave override it and LIFT the hold. The wet bake reuses the same hold flag in its engine adapter.
- isSheetWet summary: Extend `SheetSnapshot` to carry `wetPeak` and `lastWet` alongside the existing wet pixels/last-touch ages. Carry `lastWet` as a wetAgo age (same clock-age convention as the other sheet age fields). `isSheetWet` reads the real fields, and stays OPEN (wet) while the sheet is held wet.
- Dry undo scope: Dry captures the sheet BEFORE `fix()`. One undo restores that exact pre-dry sheet: mobile pigment, last-touch ages, wetPeak. Redo must land the post-dry state WITHOUT re-running `fix()`.

### Claude's Discretion
- Probe placement and scene layout under `packages/efx-watercolor/probe/`.
- Exact option names/types for the hold flag and settle mode.
- Where the dry-first rule is enforced for flush/save paths.
- Remaining wiring details, within the source-pin and guardrail constraints.

### Deferred Ideas (OUT OF SCOPE)
- None in CONTEXT.md (no `## Deferred Ideas` section). The `domain` NON-GOALS/GUARDRAILS are binding: no PlayScript per-frame change, no wet base-recovery bakes, no stroke replay (KEY = CACHE), no medium-record change, no new UI control, no new recorded event type (STOP and report if parity requires it).
</user_constraints>

## Summary

The engine already gives Dry one undoable step: `fix()` opens a `'dry'` history step and `touch(painted)` saves pool 0 — mobile ink pair, wet, relief, last-touch pair, cover — plus the step meta (`wetAgo`, `wetPeak`), so engine undo restores the exact pre-dry sheet. Two real gaps: `fix()` never clears the last-touch field (`clear()` does, Engine.ts:2055), and the app ledger has **no Dry command** — `emitAquarelleDry` only appends the event and fires sinks (aquarelleRecordState.ts:2739-2744), so Cmd+Z after Dry today targets the previous stroke and the tiles/script diverge.

Automatic live drying is exactly two places: the settle-cap `engine.fix(true)` call (AquarelleCanvasLayer.tsx:1195-1201) and the per-frame wet-decay uniform (`Math.exp(-dt / this.dryTau())`, Engine.ts:3944). Retiring the cap removes the only producer of the "settled look" cache capture (1202-1219); capture-on-frame-leave and capture-on-Dry must remain. The wet bake is a pure option pass-through: `bakeAquarelleEventsToFrame` has no `settle` field yet, `applySettle` runs unconditionally on the final frame, and the bake consumes recorded Dry events internally — wet must skip `applySettle` and ignore Dry events while leaving tick/window math untouched. `captureFrame` already exports mobile pigment (`exportCanvas('transparent')`).

**Primary recommendation:** Add `holdWet` as an Engine setter forwarded through the adapter's pre-first-stroke option seam (same as light/paperSeed); make the auto-fix refusal + wet-decay bypass reader-side of the flag; mint a Dry ledger command routed to the live engine's tile undo/redo and clear last-touch inside the same `'dry'` step; thread `settle?: 'dry' | 'wet'` (default `'dry'`) through the clipboard port → dispatch → controller helper → `AquarelleBakeOptions`, passing `'wet'` only from Studio:2653 and Studio:6278.

## Project Constraints (from CLAUDE.md)

- `vitest run` only, never watch; never run the dev server (the artist runs it); never push; conservative git (no commit unless asked).
- pnpm (not npm); app lives in `app/`; Preact + `@preact/signals` only (no React patterns, no `useState`) if a UI seam is touched.
- Load `Skill("efx-studio-paint")` before touching paint laws (done); `Skill("spike-findings-efx-motion-editor")` for probe harness laws (done).
- Report automated-ready first; never claim done before live UAT.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Wetness/drying state (hold, decay, fix) | Engine (`Engine.ts`) | — | One source of truth; adapter only forwards options |
| Live settle/capture policy | Studio live layer (`AquarelleCanvasLayer.tsx`) | — | Owns rAF tick, settle cap, captures, sheet cache |
| Bake replay settle policy | Bake (`aquarelleBake.ts`) via controller helper | Controller | Option on the bake; controller forwards it |
| Apply routing (wet vs dry per tool) | Clipboard dispatch (`physicsPaintRotoScriptClipboard.ts`) | Studio call sites | The port is the shared seam; only 2 callers pass wet |
| Dry undo | App ledger (`useRotoPhysicalEditHistory.ts`) | Engine tile history | Ledger owns stack moves; engine owns pixels/meta |
| Sheet adoption | Live layer (`adoptSheet` → `restoreSheet`) | Controller `onSheet` | KEY = CACHE; never replay strokes |

## Verified Anchors (CONTEXT ref → live tree, this session)

| Spec anchor | Live location | Status |
|---|---|---|
| Engine dry law | `Engine.ts:3842-3850` | ✅ exact. `private dryTau() { return this.fixTimer > 0 ? 0.25 : 2 + (1 - this.params.dry) * 16; }` Per-frame decay at 3944: `gl.uniform1f(P.advectWet.u.uDecay, Math.exp(-dt / this.dryTau()));` — the hold must bypass this factor |
| `engine/drying.ts` fixDrying | CPU reference impl, consumed by `engine/fluid.ts` only | ⚠️ Not the shipped engine — editing it has no live effect |
| Awake checks | `Engine.ts:1223-1227` (isAwake), `1538-1552` (tick), `4192` | ✅ CONTEXT 4173 drifted to 4192. Both ticks end `if (!awake && this.active) this.sleep();` — leave untouched |
| wetState predicate | `wetState.ts:12,14-23,34-36` | ✅ `export const WET_THRESHOLD = 0.004;` and `return !state.fixing && state.wetPeak > WET_THRESHOLD && state.nowMs < state.wetUntilMs;`. Only caller `Engine.ts:1234-1241` |
| `fix()` | `Engine.ts:2014-2026` | ✅ exact. Opens `beginStep('dry', 'Dry')`, protects pool 1, `fixTimer = FIX_DURATION`, `touch(this.painted)`. Does NOT clear last-touch; early-returns when `painted` is null |
| Dry sentinel (clear/reset) | `Engine.ts:2053-2055`, `2079-2081`; `clearLastTouch` 829-838 | ✅ `this.clearLastTouch();` writes the one-week sentinel to both halves and invalidates the carry |
| `SheetSnapshot` | `Engine.ts:213`, `captureSheet` 1109-1112, `restoreSheet` 1123-1134 | ✅ `export interface SheetSnapshot { whole: WholeDoc; bristleContent: boolean }` — no wetPeak/lastWet. Restore is pass-through ages (`uploadWhole` re-stamps) but does NOT set `painted`/`wetPeak`/`lastWet`; contrast full-document `restore()` 1158-1164 |
| Reset state | `Engine.ts:893-904` | ✅ `this.painted = null; ... this.lastWet = -Infinity; this.wetPeak = 0; ...` |
| Undo meta / last-touch travel | `Engine.ts:2133-2159` | ✅ restores `lastWet = now - meta.wetAgo`, `wetPeak`, `active` (2148-2152); last-touch pair is pool-0 entry 5 |
| `touch()` + `snapshotLayers()` | `Engine.ts:3712-3724`, `3726-3732` | ✅ `protectHistory(0, …)` saves inkA/inkB/wet/relief/lastTouch/cover — the `'dry'` step already snapshots the exact pre-dry sheet |
| `sleep()` | `Engine.ts:4054-4066` | ⚠️ `this.wetPeak = 0;` closes the gate after the sim sleeps (wet texture survives). The hold must keep wetPeak truthful |
| Live settle cap | `AquarelleCanvasLayer.tsx:1195-1201` | ✅ CONTEXT said 1195-1200 — end line drifted +1. Block quoted below |
| Capture moments | `AquarelleCanvasLayer.tsx:1157-1158` + `1162-1166` (leave), `1202-1219` (settle) | ✅ frame-leave capture + sheet cache; settle capture is `if (wasAwake && !awake && engine.hasPaint)` (1204) |
| Dry live end | `AquarelleCanvasLayer.tsx:1029-1032`, `1075-1093` | ✅ `onAquarelleDry(() => { settleCapArmed = true; engine.fix(); })`; post-settle capture at `FIX_SETTLE_MS = 1200` (84) |
| Dry record end | `aquarelleRecordState.ts:2739-2744` | ✅ `payloadTimeline.push(event); for (const sink of drySinks) sink(event);` — no ledger entry. `getAquarelleEventsForFrame` 2681-2690 keeps Dry global (all frames) |
| Dry triggers | `PhysicsPaintStudio.tsx:7058-7061` (F action), `PhysicsPaintTopBar.tsx:352`, `physicsPaintStudioKeyboard.ts:407-409` | ✅ F → `dryAquarelleSheet`; top bar `onClick={() => emitAquarelleDry(aquarelleRecordClock())}` bypasses the Studio action's locks |
| Undo ledger kinds | `useRotoPhysicalEditHistory.ts:155-252`, dispatch 1041-1131 | ⚠️ Kinds: physical, referenced-action, paint, auto-key-paint, background, aquarelle-script. No dry/engine-undo kind — plan must add one |
| Bake helper input | `physicsPaintRotoPlayScriptController.ts:4244-4276`; `applyAquarelleEventsToKey` 4350-4385; adapter factory 4388-4406 | ✅ no `settle` field; CONTEXT 4388-4405 drifted +1 (ends 4406) |
| Adapter seams | `engineAdapter.ts:57-104` (options), `360-376` (pre-first-stroke writes), `446-454` (applyDry), `510-577` (seams), `703-704` (captureFrame) | ✅ hold flag rides the light/paperSeed seam; `applyDry` = `engine.fix()` + 30 ticks — the recorded-Dry replay site to neutralize; `captureFrame` = `engine?.exportCanvas('transparent') ?? canvas` (mobile pigment included) |
| Bake settle | `aquarelleBake.ts:151-231` (options), `265-283` (constants), `624-650` (settleCapped), `886-903` (applySettle), call sites `924` and `942` | ✅ `return Math.round(30 + 270 * (1 - dry / 100))`; `const FIX_SETTLE_TICKS = Math.round(1.2 * 60)`; `const SETTLE_MAX_TICKS = 3600`. Wet must skip both `await applySettle()` sites |
| Dry events inside bake | `aquarelleBake.ts:41, 485, 665-699, 839-863` | ✅ the bake reads `isAquarelleDryEvent` from the event list — wet must ignore recorded Dry (filter at the helper or add a bake option) |
| Shared apply seam | `physicsPaintRotoScriptClipboard.ts:196-205` (port), `708-715` (applyPreparedScript), `873-882` (applyScript), `1060-1163` (dispatchApply) | ✅ port `{ events, target, onProgress? }` has no settle; `applyPreparedScript` ends `return applyScript();` (714) |
| WET call sites | `PhysicsPaintStudio.tsx:2653` (Apply one frame → applyScript), `6278` (Shift+R → applyAquarelleTimeline) | ✅ both verified |
| DRY call sites | `2624` (prepared/library apply → applyScript, see Open Q), `2946` relight, `4189` Duplicate port, `5654` Draft exit, `6228` undo/redo rebake, `8133/8208/8550` lift-recovery family, `9022/9318/9442/9546/9627/9710/9811/9879/9943/10844` script edits | ✅ grep-confirmed; 6278 is the only wet caller among 17 non-test `applyAquarelleTimeline` sites |
| PlayScript renderer | `physicsPaintRotoPlayScriptRenderer.ts:153-188` | ✅ separate multi-frame bake — untouched per guardrail |

## Source Skeletons (verbatim, this session)

```ts
// Engine.ts:2014-2026 — the Dry step already snapshots the pre-dry sheet
fix(auto = false): boolean {
  if (!auto) this.autoFix = false;
  if (!this.painted || this.fixTimer > 0) return false;
  this.beginStep('dry', 'Dry');
  this.protectHistory(1, this.painted, this.fixed.views);
  this.fixTimer = FIX_DURATION;
  this.autoFix = auto;
  this.touch(this.painted);
  this.schedule();
  return true;
}
```

```ts
// AquarelleCanvasLayer.tsx:1195-1201 — the ONLY automatic live dry (retire)
if (!painting && !settleCapArmed && lastWetAt > 0 && engine.isAwake) {
  const capMs = aquarelleVisibleSettleTicks(aquarelleParams.value.dry) * HOST_TICK_MS;
  if (performance.now() - lastWetAt >= capMs) {
    settleCapArmed = true;
    engine.fix(true);
  }
}
```

```ts
// wetState.ts:34-36 — extend with the held input; keep the WET_THRESHOLD law
export function isSheetWet(state: WetState): boolean {
  return !state.fixing && state.wetPeak > WET_THRESHOLD && state.nowMs < state.wetUntilMs;
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Dry undo pixels | New snapshot channel | Engine tile history (`'dry'` step + pool-0 protect) | Already restores mobile ink, wet, relief, lastTouch, cover + meta |
| Wetness truth | Ad-hoc wet checks | `wetState.isSheetWet` (+ `held` input) | One predicate pins already assert |
| Settle windows / cooked ticks | New timers | `aquarelleVisibleSettleTicks`, `applySettle` | Recorded cuisson and bake parity depend on them |
| Sheet adoption | Stroke replay / re-paint | `captureSheet`/`restoreSheet`/`adoptSheet` | KEY = CACHE artist law |
| Dry ingestion in replay | New event type | Filter existing `AquarelleDryEvent`s for wet mode | No new recorded event type permitted |

## Common Pitfalls

1. **Dry after adoption no-ops.** `restoreSheet` → `resetSheet` → `resetPaintState` leaves `painted = null`; `fix()` returns false. A wet bake sheet adopted on Shift+R makes the very next Dry dead. Set `painted` (from `whole.rect`) when restoring a wet sheet.
2. **Ledger/pixel divergence on Dry.** Without a Dry ledger entry, Cmd+Z moves the previous stroke's script but the tile stack still holds the `'dry'` step — next tile undo restores pre-dry pixels over a pre-stroke script. The Dry command must own both stack moves.
3. **The cache-law pin changes meaning.** `aquarelleLayerContract.test.ts:125-129` pins "the settled (dry) look is captured, never the wet stroke-end" via `const awake = engine.isAwake` / `if (wasAwake && !awake && engine.hasPaint)`. With no settle cap the sheet rarely stops being awake until an explicit Dry; keep frame-leave/Dry captures and re-express this pin deliberately (do not silently delete it).
4. **Gate closes when the sim sleeps.** `sleep()` sets `wetPeak = 0` (4064); `wetUntil` is derived from `lastWet`/`wetPeak`, so both predicates eventually read dry even though the wet texture never decayed. Keep `wetPeak` across sleep while held and add `held` to `isSheetWet`.
5. **Infinite wake loop.** Do not let the hold wake the sim: leave `isAwake`/`wetUntil` alone; the sheet may sleep, and the wet layer survives sleep (`sleep()` only blits halves and clears velocity/pressure/active/wetPeak).
6. **Wet bake still dries.** Skipping `applySettle` is not enough — recorded Dry events route through `applyDry` (`engine.fix()` + 30 ticks) inside the bake. Wet must ignore them (filter at the helper boundary is the smallest change) while keeping the same cook window and tick math.
7. **New recorded event type temptation.** Wet is a bake/adapter option, never script data. If parity is found to require recording it, STOP and report.
8. **retiring the cap without a replacement dry-on-leave.** Leaving a still-wet key must force the normal fix first, then capture (commit + bake stay settled/dry); any flush/save path commits the same dry-first rule.

## Validation Architecture

`workflow.nyquist_validation: true` (config confirmed) — required.

| Property | Value |
|---|---|
| Framework | vitest (`vitest run` only) |
| Gates | `pnpm --dir packages/efx-watercolor exec vitest run` · `pnpm --dir app exec vitest run` · `pnpm --dir app exec tsc --noEmit` |

| Requirement (spec pin) | Behavior | Test type | Where |
|---|---|---|---|
| No auto-dry while held | long idle keeps wet layer + pickup | probe + unit | new probe scene (below); engine unit pin |
| `fix()` clears last-touch | acrylic reads dry immediately after Dry | unit | `lastTouch.test.ts` (no such pin today) |
| Dry = one undo, exact pre-dry sheet | mobile, lastTouch ages, wetPeak restored; redo dry without fix | unit | `useRotoPhysicalEditHistory.test.ts` + engine history test |
| `settle: 'wet'` keeps mobile pigment; `'dry'` does not | bake A/B | unit | `aquarelleBake.test.ts` / `physicsPaintRotoPlayScriptApplyBake.test.ts` (fake adapter settleTicks 72) |
| Only 2653/6278 pass wet | source pin | unit | `PhysicsPaintStudio.test.ts` |
| `isSheetWet` open while held | gate truth | unit | `wetState.test.ts` (extend) |
| KEY = CACHE preserved | adoption still `restoreSheet`, no replay | unit | `aquarelleLayerContract.test.ts` |

**Wave 0 gaps:** probe scene in `packages/efx-watercolor/probe/` (paint watercolor → acrylic → idle >10 s → acrylic pickup still blends; bake same script `settle:'wet'` vs `'dry'`, assert mobile pigment preserved only in wet); update `wetState.test.ts`, `aquarelleLayerContract.test.ts:125-129`, and the clipboard test harness port type (`physicsPaintRotoScriptClipboard.test.ts` types the port from `RotoScriptClipboardControllerPorts['applyAquarelleEvents']`).

**Probe commands:** `node probe/pickup-collapse/run.mjs --label <name> --scene app-live|app-bake --gap <ms>` (flags: `--dry --feather --body --pressure --size --sheet --base-samples`); `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <name> --scenario cover`. Both drive the real engine in headless Chrome (esbuild + Chrome required; `run.mjs` fails fast with candidates).

**Sampling:** per task commit — touched package `vitest run`; per wave — all three gates; phase gate — all green before live UAT.

## Security Domain

Not applicable beyond existing surfaces: local desktop paint engine, no auth/session/network/input parsing changes, no new dependencies, no persisted user data. V5 Input Validation satisfied by existing TypeScript option types (the new `settle` union). Do not weaken the existing lock gates (`staticControlsLocked`, `wireframeMode`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | "Dry-first on flush/save" applies to every capture path (nav flush `flushCapture` 1006-1017, frame leave, Dry settle) | Pitfalls 8 | A missed path commits a wet image |
| A2 | After explicit Dry the live layer re-arms `holdWet` on its next tick (engine flag cleared by `fix(false)` per "LIFT the hold") | Recommendation | If re-arm is missed, auto-dry returns |
| A3 | Keeping `wetPeak` across `sleep()` while held is the intended "real fields" reading, rather than the gate ignoring the field | Pitfalls 4 | Gate lies (dry while wet, or wet while blank) |
| A4 | Library load-and-apply (`applyPreparedScript`) should stay dry because CONTEXT names only two wet call sites | Open Q 1 | Wrong tool ends wet |

## Open Questions

1. **Dry ledger command kind** — add a new kind (e.g. `'dry'`) or reuse a paint-like route to `undoPaint`/`redoPaint`? Recommendation: new kind routing to engine undo/redo with the same stack-move discipline as `'paint'`.
2. **`applyPreparedScript` (library load-and-apply)** ends in `applyScript()` — wet or dry? CONTEXT names only `handleApplyScript`; recommendation: `applyScript` takes an optional settle and only `handleApplyScript` passes wet (prepared path stays dry).
3. **"LIFT the hold" semantics** — does `fix(false)` clear the engine flag, or merely bypass suppression for that call? Plan must pick one and pin it.
4. **Where dry-first is enforced on flush/save** (Claude's discretion) — flush path, frame-leave path, or both? Needs the same fix-before-capture rule.
5. **Wet-sheet `painted` restore** — set from `whole.rect` in `restoreSheet`, or have `fix()` accept a rect? Affects Dry-after-adoption.

## Sources

- Live tree (this session): `Engine.ts`, `bake/aquarelleBake.ts`, `adapter/engineAdapter.ts`, `playground/wetState.ts`, `playground/lastTouchClock.ts`, `AquarelleCanvasLayer.tsx`, `PhysicsPaintStudio.tsx`, `PhysicsPaintTopBar.tsx`, `physicsPaintStudioKeyboard.ts`, `aquarelleRecordState.ts`, `physicsPaintRotoPlayScriptController.ts`, `physicsPaintRotoScriptClipboard.ts`, `useRotoPhysicalEditHistory.ts`, `aquarelleLayerContract.test.ts`.
- `.planning/quick/261123-pee-…/261123-pee-CONTEXT.md`; `Skill("efx-studio-paint")`; `Skill("spike-findings-efx-motion-editor")`.
- No web/package sources needed — no new dependencies.

## Metadata

**Confidence:** Standard stack HIGH (no new packages); Architecture HIGH (all seams read); Pitfalls HIGH (traps verified in source). **Valid until:** 30 days (stable internal codebase; line numbers drift — re-verify anchors before executing if the tree moved).
