---
phase: quick/261123-pee
plan: 01
subsystem: studio-paint-engine
tags: [hold-wet, dry, settle, aquarelle, bake, probe-gate, undo-ledger, live-seed, capture]

# Dependency graph
requires: []
provides:
  - "Engine hold law: `Engine.setHoldWet(boolean)` — while held, the wet gate stays open (`hasStandingWater` true, `isSheetWet` open) however long the sheet idles; `isAwake`/`wetUntil` untouched, so the sim still sleeps (no wake loop) and `wetPeak` survives `sleep()`"
  - "`fix(auto)` refuses automatic settling while held and lifts the hold for the explicit Dry; the retired settle cap and every automatic-settle path are gone from the layer"
  - "`Engine.settleForCapture()` — the no-step capture settle (`beginSettle(rect, false)`: no `beginStep`, no `protectHistory`, no last-touch clear, no hold write); `Engine.exportSettledCanvas()` — the non-mutating settled export (capture → settle → export → always restore, raw guard on `this.stroke`)"
  - "`Engine.historyRevision` — bumped only past a real stack move in `travel()`, used to invalidate the 1.2 s Dry settle-capture timer"
  - "`bakeAquarelleEventsToFrame({ settle: 'dry' | 'wet' })` (default 'dry'): 'wet' skips `applySettle`, ignores recorded Dry events, keeps the identical timeline cook window; the adapter's `holdWet` seam keeps the sheet wet through the whole replay"
  - "App: dry-first captures on every commit path (frame-leave, flush, Dry timer), `onAquarelleDryApplied` ledger seam, the `useRotoPhysicalEditHistory` `'aquarelle-dry'` command, and the two quoted `'wet'` call sites (Shift+R re-render, Apply one frame)"
  - "Probe `wet-hold` (`--scene hold` / `--scene bake`, `--dry` control) with numeric deterministic assertions and artefacts in /tmp/wet-hold/"
affects: [studio-paint-uat, sheet-cache, capture-merge, undo-ledger, playscript]

# Actuals (#2632) — pairs with the plan's estimate (tokens: 96000, tasks: 3) to calibrate future estimates.
actuals:
  tokens: 45426    # chars/4 over the realized diff (git diff e5b013159^..c7722cb1f = 181704 chars, 24 files, excluding .planning)
  tasks: 3
  commits: 4       # MEASURED: cf5f852fd..c7722cb1f. Includes the unrelated bc551088a docs(spikes) (.planning/spikes, 327 files) that landed mid-execution; the plan's own commits are 3.
plan_head_before: cf5f852fd3865ac6a739097b05860516672b01dd
plan_head_after: c7722cb1fd73e36f0755780c96c093b4e2312061

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hold is a reader-side law: the wet gate reads the hold, the decay/mobile→fixed conversion is bypassed while held; the wake/sleep loop is untouched, so a held sheet sleeps without drying"
    - "Two kinds of settle, separated by the engine method: the explicit Dry opens one engine `'dry'` step (one ledger entry); every capture settle is a NO-STEP settle (`settleForCapture`) that pushes nothing"
    - "Dry-first commits: every capture path settles (driving an in-flight explicit Dry to completion) before exporting; the Save Script thumbnail and raster-lift eager sheet use a capture→settle→export→always-restore export, so the live sheet keeps its wetness"
    - "The Dry ledger entry is keyed to `fix()`'s own return value alone; undo/redo move the engine tile stack and restore both stacks on refusal (fail closed)"
    - "A 1.2 s settle-capture timer invalidated three ways: cancelled by a subsequent Dry and by any stroke start, and at fire time by `historyRevision` mismatch or a sheet reading wet"
    - "Settle stamps are floored at the parameter (`minTicks = 0` + `Math.max`) so every stamp is a measured tick count, never NaN or negative"

key-files:
  created:
    - packages/efx-watercolor/src/playground/holdWet.test.ts
    - packages/efx-watercolor/probe/wet-hold/index.html
    - packages/efx-watercolor/probe/wet-hold/probe.ts
    - packages/efx-watercolor/probe/wet-hold/run.mjs
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/wetState.ts
    - packages/efx-watercolor/src/playground/wetState.test.ts
    - packages/efx-watercolor/src/playground/lastTouch.test.ts
    - packages/efx-watercolor/src/playground/liveSeed.test.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
    - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts

key-decisions:
  - "Hold, not a wetness refresh: `setHoldWet(true)` is re-armed by the rAF tick after any settle that lifted it, so the sheet reads wet indefinitely while `isAwake`/`wetUntil` remain the sim's own clocks — the sim still sleeps and there is no wake loop (probe-asserted)"
  - "`fix(auto)` refuses to run automatically while held; only an explicit Dry proceeds, and it lifts the hold itself — the 'dry on leave' override is the layer's `settleSheetNow` wrapper lifting the hold after a settle it started, with the tick re-arming it"
  - "The capture settle is `Engine.settleForCapture` (no `beginStep`/`protectHistory`, `touch` with `save = false`, no last-touch write, no hold write in the engine method) so a leave/flush settle can never push an unledgered `'dry'` step; `fix()` remains the only producer of an engine `'dry'` step"
  - "`exportSettledCanvas` gates its raw path on `this.stroke` (a real in-flight explicit stroke), never on `this.active` (the simulated region), and always restores the captured sheet — the Save Script thumbnail and lift eager sheet cannot dry the artist's live sheet"
  - "The Dry settle-capture timer (1.2 s = FIX_DURATION) captures only when the frame is unchanged, `engine.historyRevision` still matches its schedule-time value, and the sheet is still post-Dry settled (`!isFixing && !hasStandingWater`) — an undone Dry or fresh paint is never step-free settled by the timer"
  - "Wet settle scope stays exactly two call sites: `handleApplyScript` (Apply one frame) and `handleRebakeScript` (Shift+R re-render), pinned by the quoted-literal count 2; undo/redo replays, script edits, lift-erase recovery, library apply and PlayScript keep the dry default"
  - "A ledger undo of a Dry restores the wet sheet but does NOT remove the recorded Dry script event; a later dry-settle replay may re-apply it — accepted by design, so UAT row 6 is the pixels/wetness check, not a script check"
  - "Every settle stamp keeps a measured value via the defaulted floor (`stampPendingSettle(minTicks = 0)` + `Math.max`), with the three no-argument call sites guarded at 3"

requirements-completed: []

coverage:
  - id: D1
    description: "Engine hold law: held sheet reads wet past the settle window and past `sleep()`; no auto-dry, no mobile→fixed, no settle-cap fix, no wake loop"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/holdWet.test.ts#hold-wet (quick 261123-pee)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/wetState.test.ts + lastTouch.test.ts + liveSeed.test.ts (re-expressed pins)"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label final-hold"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dry is one engine step: `fix()` clears last-touch AFTER snapshotting, one undo restores the exact pre-dry sheet, redo lands the post-dry state without re-running the fix"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/holdWet.test.ts#Dry step (quick 261123-pee)"
        status: pass
      - kind: integration
        ref: "probe --scene hold --dry control: undo depth one greater after `fix()`"
        status: pass
    human_judgment: false
  - id: D3
    description: "No-step settle and non-mutating settled export: undo depth unchanged across `settleForCapture()` and `exportSettledCanvas()` in both the awake window and the post-sleep state; raw guard reads `this.stroke`"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/holdWet.test.ts#settled export (quick 261123-pee)"
        status: pass
      - kind: integration
        ref: "probe --scene hold: undo depth and wet truth assertions both windows"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bake settle option: 'wet' skips applySettle and ignores recorded Dry events; 'dry' default unchanged; adapter hold seam keeps the sheet wet through the whole replay"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#settle wet (quick 261123-pee)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#holdWet (quick 261123-pee)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts#settle wet (quick 261123-pee)"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/wet-hold/run.mjs --scene bake --label final-bake"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live wiring: hold re-armed by the tick, dry-first captures (leave, flush, Dry timer), settled snapshot/export factories, Dry ledger entry with fail-closed undo/redo, the two wet call sites only"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts#261123-pee (hold, Dry sink, timer invalidation, stamp floor)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#aquarelle Dry entries (261123-pee)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#the two wet call sites and the Dry ledger wiring"
        status: pass
      - kind: integration
        ref: "pnpm --dir packages/efx-watercolor exec vitest run; pnpm --dir app exec vitest run; pnpm --dir app exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D6
    description: "Untouchable surfaces unchanged: shaders.ts, mediums.ts, mediums.test.ts, PlayScript renderer, top bar"
    verification:
      - kind: integration
        ref: "git diff --exit-code cf5f852fd..HEAD -- <the five untouchable paths>"
        status: pass
    human_judgment: false
  - id: D7
    description: "the seven live UAT rows (no-auto-dry pause, Shift+R wet, Apply wet, Dry + one undo, PlayScript unchanged, wet-key leave, Save Script/lift stays wet)"
    verification: []
    human_judgment: true
    rationale: "Visible paint behaviour — whether the sheet blends/picks up after an idle, whether a dry looks like the dense settled look rather than a washed-out full settle, and whether a save/lift leaves the live sheet wet — is artist judgment; the probe proves the laws but not the look. The artist runs the Studio."
---

# Quick 261123-pee: Hold paint wet until Dry Summary

**The live Studio sheet now holds its water and mobile pigment indefinitely until an explicit Dry — the automatic Dry/settle cap is gone, every commit path settles first through a no-step capture settle or a non-mutating settled export, Shift+R re-render and Apply one frame end wet, and Dry is exactly one engine step with one matching ledger entry.**

## Performance

- **Duration:** ~40 min (plan base commit 2026-11-23T18:38:59Z → last task commit 2026-11-23T19:18:24Z)
- **Started:** 2026-11-23 (dispatch at plan commit `cf5f852fd`)
- **Completed:** 2026-11-23T19:18:24Z
- **Tasks:** 3
- **Files changed:** 24 (4 created, 20 modified), +2679 / −123

## Accomplishments

- **Task 1 — the engine law (`e5b013159`).** `setHoldWet` as the one hold authority; the wet gate bypasses decay and the mobile→fixed conversion while held while `isAwake`/`wetUntil` stay untouched (the sim still sleeps — probe-asserted, no wake loop); `fix(auto)` refuses automatic while held and the explicit Dry lifts the hold; `settleForCapture()` (no-step settle) and `exportSettledCanvas()` (capture → settle → export → always restore, raw guard on `this.stroke`) added; `historyRevision` bumps only past a real stack move; the wet-hold probe harness and its `hold` scene (including the `--dry` control) land with numeric deterministic assertions.
- **Task 2 — the bake option and plumbing (`2f34d35ac`).** `bakeAquarelleEventsToFrame({ settle: 'dry' | 'wet' })` with the dry default intact: 'wet' skips `applySettle`, ignores recorded Dry events and keeps the identical timeline cook window; the adapter's hold seam keeps the sheet wet through the whole replay; the PlayScript controller and script clipboard ports forward the option; the probe's `bake` scene proves the wet/dry difference on the real engine.
- **Task 3 — the live surface (`c7722cb1f`).** The live layer re-arms the hold from the rAF tick, drives every capture dry-first (frame-leave, flush and the 1.2 s Dry timer via `settledSnapshot`, all other readers via the non-mutating `settledExport`), settles through the no-step `settleForCapture` on leave/flush (dry-on-leave, re-armed next tick), reports the explicit Dry through `onAquarelleDryApplied` keyed to `fix()`'s return alone, records the `'aquarelle-dry'` history command with fail-closed undo/redo, and passes the quoted `'wet'` literal at exactly the two intended call sites (Shift+R re-render, Apply one frame).

## Task Commits

Each task was committed atomically (tests committed with their implementation; RED observed locally first — Task 3 recorded 14 failing pins before GREEN):

1. **Task 1: hold the live sheet wet until Dry (engine law + wet-hold probe)** — `e5b013159`
2. **Task 2: bake settle 'dry' | 'wet', adapter hold seam and app plumbing** — `2f34d35ac`
3. **Task 3: live hold-wet, dry-first captures, Dry ledger and wet Apply** — `c7722cb1f`

**Plan metadata:** docs commit handled by the orchestrator (this quick is dispatched with docs-commit deferred; `.planning` artifacts deliberately left uncommitted).

## Files Created/Modified

- `packages/efx-watercolor/src/playground/Engine.ts` — `setHoldWet`/`holdWet`, the reader-side decay bypass, `fix(auto)` refusal + explicit lift, `settleForCapture` (no-step settle), `exportSettledCanvas` (in-flight `stroke` guard, always restore), `historyRevision`, Dry sink return values
- `packages/efx-watercolor/src/playground/wetState.ts` + `.test.ts` — the hold read in the wet gate; re-expressed pins
- `packages/efx-watercolor/src/playground/holdWet.test.ts` — the hold/wet-truth/Dry-step/settled-export law pins (new)
- `packages/efx-watercolor/src/playground/lastTouch.test.ts` — last-touch clear after the pre-dry snapshot (source slice); `liveSeed.test.ts` — re-expressed seeding pins
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` + `.test.ts` — `settle` option, wet filtering of Dry events, skipped `applySettle`
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` + `.test.ts` — `holdWet` seam through the replay
- `packages/efx-watercolor/probe/wet-hold/{index.html,probe.ts,run.mjs}` — esbuild → headless-Chrome harness; `hold` scene (`--dry` control) and `bake` scene
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — hold re-arm tick, `settleSheetNow`/`settledSnapshot`/`settledExport`, Dry sink, invalidation-safe Dry timer, stamp floor, removed auto-settle cap and settle capture
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — `onAquarelleDryApplied` passthrough
- `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` — re-expressed the four snapshot pins (never deleted) + new hold/Dry/timer/stamp pin suites
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the two `'wet'` call sites, the `settle` port field, `handleAquarelleDryApplied` + recorder ref
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — re-expressed `:4940` Shift+R pin to the two-argument call; new wet-call-site/Dry-wiring pin
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` + `.test.ts` — the `'aquarelle-dry'` command, fail-closed undo/redo, 6 new tests
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` + `.test.ts`, `physicsPaintRotoScriptClipboard.ts` — settle plumbing
- `app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts` — dropped only the `engine.cancelAutoFix()` ordinal

## Gate Record (authoritative: plan Task 3 step's verify block)

### (a) Final gate runs on the final tree

| Gate | Result |
|---|---|
| 4 target test files (layer contract, history, Studio, lift-erase) | 596 tests passed, 0 failed (post-review) |
| `pnpm --dir packages/efx-watercolor exec vitest run` | 1018 passed, 8 skipped, 0 failed (post-review) |
| `pnpm --dir app exec vitest run` | 465 test files, 9809 tests passed, 0 failed (post-review) |
| `pnpm --dir app exec tsc --noEmit` | exit 0 (post-review) |
| Untouchable-surface audit (`shaders.ts`, `mediums.ts`, `mediums.test.ts`, PlayScript renderer, top bar) | `git diff --exit-code` exit 0 |

### (b) Source pins with recorded baselines (all match)

| Pin | Baseline | Final |
|---|---|---|
| `grep -c "engine.fix(true)" AquarelleCanvasLayer.tsx` | 1 | **0** |
| `grep -c "engine.fix(" AquarelleCanvasLayer.tsx` | 2 | **1** (the Dry sink only) |
| `grep -c "stampPendingSettle = (minTicks *= *0)"` | 0 | **1** |
| `grep -c "stampPendingSettle();"` | 3 | **3** |
| `grep -c "'wet'" PhysicsPaintStudio.tsx` | 0 | **2** |

### (c) Probe — hold scene (`node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label final-hold`)

All assertions pass, including: the sheet still reads wet after idling past the recorded settle window (`isSheetWet` open, `hasStandingWater` true); the sim reported `isAwake === false` after sleeping (held wetness with no wake loop); the captured engine's undo depth is unchanged across `exportSettledCanvas()` in BOTH the awake window (`stroke === null`, `active` non-null) and the post-sleep state, and across `settleForCapture()`; the `--dry` control's explicit `fix()` raises the undo depth by exactly 1 and clears the wet truth.

### (d) Probe — bake scene (`node packages/efx-watercolor/probe/wet-hold/run.mjs --scene bake --label final-bake`)

| Arm | settleTicks | wetPeak | Events |
|---|---|---|---|
| wet | **0** | 0.02891 | 3 strokes / 3 events |
| dry | **72** | 0 | 3 strokes / 3 events |

Ink digests differ between the wet and dry arms (the settle genuinely changes the pixels); `bristleContent === true` in both arms. All assertions pass.

## Decisions Made

- Hold is a reader-side law on the wet gate, not a wetness refresh: the decay/mobile→fixed conversion is bypassed while held and the wake/sleep clocks are untouched, so a held sheet sleeps without drying.
- Exactly two kinds of settle: the explicit Dry opens one engine `'dry'` step (and therefore exactly one ledger entry, keyed to `fix()`'s return); every capture settle is the no-step `settleForCapture`. One-to-one ledger/engine alignment holds in both directions.
- Dry-first applies to every commit path: the leave/flush captures settle through the no-step method and lift the hold (dry-on-leave, re-armed next tick); the Save Script thumbnail and raster-lift eager sheet use the always-restoring settled export, so a save or lift never dries the live sheet.
- The Dry settle-capture timer is invalidated three ways (subsequent Dry, stroke start, fire-time `historyRevision`/wet-state check) so no automatic timer can ever settle a renewed wet state.
- The `exportSettledCanvas` raw path gates on `this.stroke` alone — the simulated region `active` is never the guard, because settling a sheet with only simulated paint would be wrong.
- A ledger undo of a Dry does NOT remove the recorded Dry script event (accepted, by design) — UAT row 6 is read as the pixels/wetness check, not a script check.
- No package added, upgraded or installed; no legitimacy checkpoint required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Own comment quoted the `'wet'` literal, inflating the source-pin count**
- **Found during:** Task 3
- **Issue:** A prose comment in the port described the literal `'wet'`, making `grep -c "'wet'" PhysicsPaintStudio.tsx` report 3 against the plan's expected 2.
- **Fix:** Reworded the comment ("the wet settle for Apply and the re-render") — no code change.
- **Committed in:** `c7722cb1f`

**2. [Rule 3 - Blocking] Package dist rebuild required before app tsc/vitest**
- **Found during:** Tasks 2–3
- **Issue:** The app resolves `@efxlab/efx-watercolor` through package.json exports to the gitignored `dist/*.d.ts|mjs`; after the engine/bake API changes, app `tsc` and the app suite failed on the missing new symbols (`setHoldWet`, `isFixing`, `settleForCapture`, `exportSettledCanvas`, `historyRevision`, `AquarelleBakeSettle`, `holdWet`).
- **Fix:** `pnpm --dir packages/efx-watercolor build` (tsup). `packages/*/dist/` is gitignored — nothing committed; an ordinary local step in this repo's flow.
- **Committed in:** not committed (build artifact)

### Plan-directed pin re-expressions (never deletions)

- `PhysicsPaintStudio.test.ts:4940` Shift+R pin re-expressed to `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame), 'wet')`.
- `aquarelleLayerContract.test.ts` snapshot pins re-expressed to the `settledSnapshot` / `settledExport` factories with the new law stated; the `261029-bks` diagnostics pin's slice marker re-expressed to `applyAquarelleEvents: async ({ events, target, onProgress, settle }) => {` plus a `settle,` assertion.
- `aquarelleLiftEraseContract.test.ts:93-114` — dropped ONLY the `engine.cancelAutoFix()` ordinal (gate → refusal → preventDefault ordering kept).
- Every one was re-expressed to the new law in the same commit that changed the code; none was deleted.

### Measured refutations (documented, not silently overridden)

- **Dry does not kill a different-colour stroke's pickup.** The plan's Task 1 context assumed it did; the probe measured the lift as colour-gated — 22.73° dry vs 22.27° held — so no hold-independent pickup change was made or needed.
- **History-pool probe strokes narrow.** Task 1's hold-scene strokes stay at x 0.35..0.65 of the 1080 sheet to keep the pool-0 tiles live; the dry arm's 4th engine step evicts one history tile — recorded in the probe, deliberately not asserted as a law.

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) + the plan-directed re-expressions above.
**Impact on plan:** None beyond the recorded notes; no law change outside the plan.

## Issues Encountered

- The app suite consumes built package output (see Rule 3 above); the rebuild is now an assumed step for any engine-API change.
- The plan ledger base is the dispatch HEAD `cf5f852fd`, so the MEASURED commit count is 4 — it includes the unrelated `bc551088a docs(spikes)` (327 `.planning/spikes` files) that landed mid-execution. The plan's own commits are exactly the 3 listed above.

## Code Review and Post-Review Fixes

`261123-pee-REVIEW.md` (quick depth, 24 files) found 1 blocker, 5 warnings and 2 info. Fixed in `36f16d74c`:

- **CR-01 (blocker, FIXED).** A frame change opens an unledgered `'clear'` engine step, so a Dry undo/redo after navigation could undo the wipe and resurrect the other frame's sheet. `Engine.peekUndoKind`/`peekRedoKind` are now exposed through `AquarelleEnginePort`; the dry ledger branch fails closed unless the engine's next step is the matching `'dry'` step (both stacks and the entry stay untouched).
- **WR-01/WR-02 (FIXED).** The 1.2 s Dry settle capture no longer drops an unsettled sheet — `settledSnapshot` drives an in-flight fix through its tick law, so a slow/background rAF still commits the settled look — and the capture decision treats an in-flight fix as wet, so a second Dry inside the window cannot cancel the first capture. `settled` stays telemetry only.
- **WR-03 (FIXED).** `settleForCapture()` now refuses during a real in-flight stroke (`this.stroke !== null`), matching `exportSettledCanvas`.
- **WR-04/WR-05, IN-01/IN-02 (accepted for this quick).** The settled export restore does not re-arm the simulated region (the sheet stays wet; diffusion resumes on the next touch), the Dry undo restores last-touch only over `painted ± PROTECT_MARGIN`, and the settle-cap `autoFix`/`cancelAutoFix` path is now unreachable in the app. Documented in REVIEW.md; no behavior change here.

All three gates were re-run after the fixes (numbers in the Gate Record above) and are green.

## Post-Review Fix Commit

- `36f16d74c` fix(quick-261123-pee): align the Dry ledger and harden capture settles

## Known Stubs

None. No placeholder wiring or empty data paths were introduced.

## Threat Flags

None — no new network, auth, file-access or trust-boundary surface beyond the plan's threat model (T-PEE-01..07 mitigations all pinned and green; T-PEE-SC not applicable — no package installed).

## Live UAT rows (artist-run — automated-ready until confirmed)

| # | Row |
|---|---|
| 1 | Watercolor, switch to acrylic, pause >10 s, paint: still blends/picks up (no auto-dry). |
| 2 | Shift+R re-render: the frame is wet and blendable again. |
| 3 | Apply one frame: applied paint is wet and blendable. |
| 4 | Dry (F): everything dries; acrylic afterwards paints on dry; one undo restores the wet state; the result keeps the dense settled look (not the washed-out full settle). |
| 5 | PlayScript: unchanged, still settles/dries per frame. |
| 6 | Leave a wet key: commits the dry look; returning shows the dry committed image (as today). Judge the PIXELS: a ledger undo of a Dry restores the wet sheet but does NOT remove the recorded Dry script event, so a later dry-settle replay may re-apply it (accepted, by design). |
| 7 | Save Script on a wet sheet (and a lift-erase on a wet sheet): the sheet is STILL wet and blendable afterwards (a save/lift must not dry it), and the saved/committed artifact shows the settled look. |

**Status: AUTOMATED-READY.** All three gates, both probe scenes, the source pins and the untouchable audit are green; the seven rows above are the artist's live confirmation and are not claimed as passed.

**UAT (2026-11-23): APPROVED WITH RESERVE.** The hold-wet laws behave as specified. Reserve: the wet look keeps diffusing until the sim sleeps (~20 s at Dry 50), so the dense ~1 s look is visibly washed by 10 s and that state is what a later Dry/leave commits. Follow-up queued: cap the held sheet's sim-awake window at the visible settle timing, without fixing or decaying.

## Next Phase Readiness

The hold-wet law is implemented end-to-end and probe-proven on the real engine. Skill law updates (`Skill("efx-studio-paint")` still documents the retired settle cap / auto-dry surface) are the natural follow-up once the artist confirms the rows live.

---

*Quick: 261123-pee — no auto-dry; wet one-frame Re-render/Apply; dry-first commits; Dry = one engine step = one ledger entry*
*Completed: 2026-11-23*

## Self-Check: PASSED

- All four created files exist on disk (`holdWet.test.ts`, `probe/wet-hold/{index.html,probe.ts,run.mjs}`).
- All three task commits are ancestors of HEAD (`e5b013159`, `2f34d35ac`, `c7722cb1f`).
- Working tree holds only the untracked `.planning` docs (CONTEXT, RESEARCH, this SUMMARY) — deliberately uncommitted per the dispatch.
