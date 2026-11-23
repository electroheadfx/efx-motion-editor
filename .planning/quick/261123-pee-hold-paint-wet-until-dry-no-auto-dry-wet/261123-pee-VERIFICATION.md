---
phase: 261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet
verified: 2026-11-23T20:44:09Z
status: human_needed
score: 9/9 must-haves verified
covered_files:
  - .planning/quick/261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet/261123-pee-PLAN.md
  - .planning/quick/261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet/261123-pee-SUMMARY.md
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleEnginePort.ts
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - packages/efx-watercolor/probe/wet-hold/index.html
  - packages/efx-watercolor/probe/wet-hold/probe.ts
  - packages/efx-watercolor/probe/wet-hold/run.mjs
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/holdWet.test.ts
  - packages/efx-watercolor/src/playground/lastTouch.test.ts
  - packages/efx-watercolor/src/playground/liveSeed.test.ts
  - packages/efx-watercolor/src/playground/wetState.test.ts
  - packages/efx-watercolor/src/playground/wetState.ts
covered_digest: "v4:sha256:d3030a9adb58bf32e26e0cb9fd37e5035cb5ff3464d2f299504860890627d7fc"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "UAT 1 — Watercolor stroke, switch to acrylic, pause >10 s, paint"
    expected: "The sheet still blends and picks up (no auto-dry at any pause length)."
    why_human: "Visible paint behaviour; the probe proves the engine law but not the look."
  - test: "UAT 2 — Shift+R re-render"
    expected: "The frame is wet and blendable again."
    why_human: "Live tool behaviour on the real Studio surface."
  - test: "UAT 3 — Apply one frame"
    expected: "The applied paint is wet and blendable."
    why_human: "Live tool behaviour on the real Studio surface."
  - test: "UAT 4 — Dry (F), then paint acrylic"
    expected: "Everything dries; acrylic afterwards paints on dry; one undo restores the wet state; the result keeps the dense settled look (not the washed-out full settle)."
    why_human: "Look judgment (dense vs washed-out) plus live undo behaviour."
  - test: "UAT 5 — PlayScript playback"
    expected: "Unchanged: still settles/dries per frame."
    why_human: "Live playback behaviour."
  - test: "UAT 6 — Leave a still-wet key"
    expected: "Commits the dry look; returning shows the dry committed image (as today). Judge the pixels only: a ledger undo of a Dry restores the wet sheet but does NOT remove the recorded Dry script event, so a later dry-settle replay may re-apply it (accepted, by design)."
    why_human: "Pixels/commit look; the script-event asymmetry is an accepted design point."
  - test: "UAT 7 — Save Script on a wet sheet, and a lift-erase on a wet sheet"
    expected: "The sheet is STILL wet and blendable afterwards (a save/lift must not dry it), and the saved/committed artifact shows the settled look."
    why_human: "Live durable-read behaviour plus visible look."
  - test: "Supplementary (verifier-derived, not in the executor's UAT set) — press Dry, then within ~1.2 s Apply the same frame"
    expected: "The applied sheet stays wet and blendable; the pending Dry settle-capture timer must not settle it."
    why_human: "Documents the residual edge of the WR-01 telemetry substitution: the timer's capture guard no longer reads `settled`, so a wet sheet adopted inside the 1.2 s window without a stroke or history move would be settled step-free. Timing-dependent live behaviour no grep or probe can settle."
---

# Phase 261123-pee: Hold paint wet until Dry Verification Report

**Phase Goal:** Hold paint wet until Dry — no auto-dry, wet one-frame Re-render/Apply. The live Studio sheet never auto-dries; watercolor keeps blending with acrylic indefinitely until Dry (F). Dry dries everything and clears last-touch, one recorded/undoable step. Leaving a still-wet key forces the normal fix first, then captures (committed/bake stay dry; wet is never committed). Only Shift+R re-render and Apply one frame end wet; every other replay stays dry. Add `settle: 'dry' | 'wet'` (default `'dry'`) to the bake, forwarded through the controller/clipboard/dispatch. Engine probe proves wet survives a long idle with pickup, and a wet bake keeps mobile pigment while a dry bake does not. No new recorded event type; no medium-record change; no new UI control; KEY = CACHE; vitest run only; never push.
**Verified:** 2026-11-23T20:44:09Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior VERIFICATION.md; the task dir held only CONTEXT/PLAN/RESEARCH/REVIEW/SUMMARY)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The live Studio sheet never auto-dries: an idle past the settle window (engine asleep) still reads wet and the next acrylic stroke picks up — no decay, no mobile->fixed, no settle-cap fix | ✓ VERIFIED | `Engine.wetDecay()` returns `1` while `holdWet && fixTimer <= 0` (Engine.ts:3970); the advect `uDecay` uniform gets the same `1` (Engine.ts:4070); `hasStandingWater` passes `held: this.holdWet` into `isSheetWet` (Engine.ts:1261-1266), whose held branch keeps the gate open (wetState.ts). `engine.fix(true)`, `settleCapArmed` and `lastWetAt` are absent from the layer (pinned in aquarelleLayerContract.test.ts:129-141). Probe `hold`: post-idle `awake false`, `wet true`, `wetPeak 0.0289` — 29/29 assertions passed. |
| 2 | No infinite wake loop: the sim sleeps (`isAwake` false, `sleep()` ran) while wetness survives and the gate stays open — `wetUntil`/`isAwake` untouched | ✓ VERIFIED | `isAwake` and `wetUntil` are byte-identical to pre-phase (Engine.ts:1249-1253; pinned at holdWet.test.ts:98-110). `sleep()` keeps all its duties (`active = null`, `flowSpeed = 0`) and only guards the peak zero with `if (!this.holdWet)` (Engine.ts:4193; one zero write, pinned). Probe `hold` asserts `awake false` after the idle with `wet true`. |
| 3 | Dry is one undoable step: `fix()` clears last-touch AFTER the pre-dry snapshot; one undo restores the exact pre-dry sheet; redo lands post-dry WITHOUT re-running the fix | ✓ VERIFIED | `fix()` order is `beginStep('dry','Dry')` -> `protectHistory(1, painted, fixed.views)` -> `beginSettle(painted, true)` -> `clearLastTouch()` (Engine.ts:2067-2083; holdWet.test.ts:137-145). `history.ts` `swap()` carries the step meta both ways, so undo restores pre-dry `lastWet/wetPeak` and redo re-applies the post-dry meta without a second fix. Probe `hold --dry` control: undo depth exactly +1 after `fix()`. |
| 4 | Dry ledger alignment: the `'aquarelle-dry'` entry is keyed to `fix()`'s own return alone; `fix()` is the only producer of an engine `'dry'` step; capture settles push none | ✓ VERIFIED | Layer: `const started = engine.fix(); onDryAppliedRef.current?.(started)` (AquarelleCanvasLayer.tsx:1113); Studio `handleAquarelleDryApplied`: `if (opened) aquarelleDryRecorderRef.current?.()` (PhysicsPaintStudio.tsx:10677-10679) with the recorder bound to `recordAquarelleDry` (10676). `recordAquarelleDry` is the `'aquarelle-dry'` command (useRotoPhysicalEditHistory.ts:253, 1016-1021) whose undo/redo branches fail closed on `peekUndoKind/peekRedoKind !== 'dry'` (1079-1098, 1322-1339) with restore-on-false. `countOccurrences(layer, 'engine.fix(') === 1` (contract test:157); `settleForCapture`/`exportSettledCanvas` open no step (`beginStep` absent, holdWet.test.ts:181-188, 231-238). History tests: 6 new dry-entry tests green. |
| 5 | Capture is dry-first on every commit path: leave/flush/Dry-timer captures settle through the no-step `settleForCapture`; Save Script thumbnail and raster-lift eager sheet use the non-mutating `exportSettledCanvas`; only a real in-flight `stroke` exports raw | ✓ VERIFIED | `settleSheetNow` drives an in-flight fix, gates on `hasStandingWater`, calls `engine.settleForCapture()`, stamps, then `setHoldWet(false)` (AquarelleCanvasLayer.tsx:1020-1041); `settledSnapshot` wraps it (1042) and is what `flushCapture` (1087), the frame-change capture and the Dry timer (1194) pass to `onCaptureFrame`. `settledExport` wraps `engine.exportSettledCanvas()` (1049-1055) and feeds `onSnapshotReadyRef` (1097) -> `handleAquarelleSnapshotReady` (Studio:10649) -> `aquarelleSnapshotRef` (784), read by `copyLiveAlphaCanvas` (790), `captureAquarelleCanvas` (2216) and the raster-lift eager sheet (8404). Engine export: raw only on `this.stroke !== null` (never `active`), in-flight Dry driven to completion, capture->settle->export->`finally restoreSheet` (Engine.ts:2122-2143; pinned holdWet.test.ts:195-238). Probe `hold`: undo depth unchanged across both settle paths and across `exportSettledCanvas` in BOTH the post-sleep and awake windows; exports differ from the wet sheet and restore exactly. |
| 6 | `bakeAquarelleEventsToFrame` takes `settle: 'dry' \| 'wet'` (default 'dry'): wet skips `applySettle`, ignores recorded Dry events, identical cook window, adapter hold keeps the sheet wet through the whole replay | ✓ VERIFIED | `AquarelleBakeSettle` type + option (aquarelleBake.ts:96, 232-238); both applySettle call sites gated `options.settle !== 'wet'` (946, 965). Controller filters `isAquarelleDryEvent` in wet mode (physicsPaintRotoPlayScriptController.ts:4323-4325) and defaults `settle: input.settle ?? 'dry'` (4313). Adapter `holdWet` seam applies only when `!injectedEngine` and `=== true` (engineAdapter.ts:385-389). Probe `bake`: wet -> `settleTicks 0`, `wetPeak 0.02891`, 3 strokes with the Dry filtered; dry -> `settleTicks 72`, `wetPeak 0`, 4 events incl. the Dry; ink digests differ; `bristleContent true` both. |
| 7 | Only Shift+R re-render and Apply one frame pass wet; every other replay stays dry | ✓ VERIFIED | Studio quoted `'wet'` literal count = 2, both intended: `rotoScript.applyScript('wet')` (PhysicsPaintStudio.tsx:2659) and `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame), 'wet')` (6286). Every other `applyAquarelleTimeline(` call site (16 of them) is one-argument; `applyPreparedScript` (clipboard:724) and `applyCurrentScript`/`applyProvidedScript` pass no settle. The settle travels `applyScript(settle?)` (clipboard:883-893) -> `dispatchApply(..., { settle })` (1076) -> `applyAquarelleEvents({..., settle })` (1155) -> Studio port (2222-2232) -> `applyAquarelleEventsToKey` (controller:4402). Pinned at PhysicsPaintStudio.test.ts:4946-4971 plus the two-wet-call-site test. |
| 8 | An adopted wet bake sheet blends on the next stroke and reads wet; a Dry right after adoption is a real step, not a no-op | ✓ VERIFIED | `SheetSnapshot` carries `wetPeak` + `wetAgo` (Engine.ts:213-223); `captureSheet()` records the age convention (`Infinity` when never wet, 1131); `restoreSheet()` restores `painted` after `uploadWhole`, plus `wetPeak` and `lastWet` reconstructed from the age (1143-1160). Probe `hold` re-adoption asserts the restored sheet's wet truth and that a subsequent `fix()` is a real step. Pins at holdWet.test.ts:245-268. |
| 9 | An automatic Dry capture never settles renewed paint: timer (a) cancelled by a subsequent Dry and any stroke start, (b) invalidated at fire time when `historyRevision` moved, (c) captures only while the sheet is still post-Dry settled | ✓ VERIFIED (documented deviation on clause c) | (a) `offDry` calls `cancelPendingDrySettleCaptures()` before `engine.fix()`; the window pointerdown handler cancels after the lift-refusal gate; cleanup drains the set (AquarelleCanvasLayer.tsx:1060-1064, 1107-1114, 1151, contract test:192-221). (b) `dryRevision = engine.historyRevision` at schedule; `revisionChanged` at fire skips (1173-1195); `historyMoves++` only past a real `travel()` move (Engine.ts:2258-2262). (c) **Deviation:** the post-review fix 36f16d74c (WR-01/WR-02) deliberately demoted `settled = !engine.isFixing && !engine.hasStandingWater` to telemetry and gates the capture on `frameChanged \|\| revisionChanged \|\| !hasPaint` instead — gating on `settled` at fire would DROP the Dry capture whenever the 1.2 s fix had not tightened on the timer boundary (a janky/backgrounded rAF case); `settledSnapshot` now drives the fix to completion instead. Both named harms stay guarded: undo/redo -> revision check; fresh paint -> the stroke-start cancel. Pinned at aquarelleLayerContract.test.ts:205-211 (`expect(layer).not.toContain('revisionChanged \|\| !settled')`). Residual edge recorded as the supplementary human check below. |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Required Artifacts

The `verify.artifacts` verb returned `total: 0` because the PLAN lists `must_haves.artifacts` as bare path strings, not `path:` objects — the verb had nothing to map, so the three-level check below is manual (exists / substantive / wired).

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/playground/Engine.ts` | hold law, no-step settle, settled export, historyRevision | ✓ VERIFIED | 3-level: exists, substantive (all six laws with bodies, not stubs), wired (constructed by the layer at AquarelleCanvasLayer.tsx:716; consumed by probe + tests). |
| `packages/efx-watercolor/src/playground/wetState.ts` | `held` read in the wet gate | ✓ VERIFIED | Imported by Engine.ts:45, used at 1261-1266. |
| `packages/efx-watercolor/src/playground/holdWet.test.ts` | law pins | ✓ VERIFIED | New file, 296 lines, 25 source-pin tests, green in the targeted run. |
| `packages/efx-watercolor/probe/wet-hold/run.mjs` | probe harness | ✓ VERIFIED | Executed in this verification: `hold`, `hold --dry`, `bake` scenes all passed on the real engine. |
| `packages/efx-watercolor/src/bake/aquarelleBake.ts` | settle option + Dry filter | ✓ VERIFIED | Imported by the controller; gated at both applySettle sites. |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | hold seam | ✓ VERIFIED | `holdWet` option applied to the non-injected engine (385-389). |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | settle plumbing + filter | ✓ VERIFIED | Default 'dry', wet filter, adapter settle/ hold args. |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` | settle forwarding | ✓ VERIFIED | Port input, `applyScript(settle?)`, `dispatchApply` -> `applyAquarelleEvents`. |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | live hold, dry-first captures, Dry sink, timer guards | ✓ VERIFIED | Holds armed at construction (804) and re-armed by the tick (1290); single hold lift (1039); single `engine.fix(` (1113). |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | two wet call sites, settle port field, Dry recorder | ✓ VERIFIED | Literal count 2 (2659, 6286); recorder wired 10676-10679; snapshot consumers 790/2216/8404. |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | `'aquarelle-dry'` command, fail-closed undo/redo | ✓ VERIFIED | Kind 253, record 1016-1021, guards 1079-1098 / 1322-1339. |

Created-but-not-in-plan artifacts also verified: `probe/wet-hold/{index.html,probe.ts}`, plus the re-expressed test files listed under Behavioral Spot-Checks.

### Key Link Verification

The `verify.key-links` verb reports 0/6 verified with detail "Target not referenced in source": it greps for the target **file-path literal** inside the source file, and this TypeScript monorepo imports through module specifiers (`@efxlab/efx-watercolor`, `./wetState`), so the mechanical check cannot succeed by construction. Each link was verified by direct import/call evidence instead:

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `Engine.ts` | `wetState.ts` | hold read in the gate | ✓ WIRED | `import { WET_THRESHOLD, isSheetWet } from './wetState'` (Engine.ts:45); `isSheetWet({... held: this.holdWet ...})` (1261-1266); peak retained in `sleep()` (4193). |
| `AquarelleCanvasLayer.tsx` | `Engine.ts` | hold arm/lift + no-step settle + settled export | ✓ WIRED | The layer constructs the real `WatercolorEngine` (716) and calls `setHoldWet` (804/1039/1290), `settleForCapture` (1030), `exportSettledCanvas` (1051), `historyRevision` (1173/1178), `isFixing` (1288-1290). `engine.fix(` exactly once (1113); `engine.setHoldWet(false)` exactly once (1039). Compile-proven by `tsc --noEmit` exit 0. |
| `PhysicsPaintStudio.tsx` | `physicsPaintRotoScriptClipboard.ts` | the two wet call sites | ✓ WIRED | 2659 and 6286 pass `'wet'`; no other call site does; the port forwards through `dispatchApply` -> `ports.applyAquarelleEvents`. |
| `physicsPaintRotoPlayScriptController.ts` | `aquarelleBake.ts` | settle into the bake + Dry-event filter | ✓ WIRED | `settle: input.settle ?? 'dry'` (4313); `isAquarelleDryEvent` filter (4324); adapter built with the hold flag for wet. |
| `useRotoPhysicalEditHistory.ts` | `PhysicsPaintStudio.tsx` | Dry ledger keyed to `fix()`'s return | ✓ WIRED | Studio binds `aquarelleDryRecorderRef.current = rotoMoveHistory.recordAquarelleDry` (10676) and calls it only `if (opened)` (10678), where `opened` is `fix()`'s return (layer 1113). |
| `AquarelleCanvasLayer.tsx` | `PhysicsPaintStudio.tsx` | settled export to the durable readers | ✓ WIRED | `onSnapshotReadyRef.current?.(settledExport)` (1097) -> mount prop (PhysicsPaintCanvasMount.tsx:281) -> `onAquarelleSnapshotReady: handleAquarelleSnapshotReady` (Studio:11004) -> `aquarelleSnapshotRef` (784) -> `copyLiveAlphaCanvas` (790), `captureAquarelleCanvas` (2216), raster-lift eager sheet (8404). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Commit captures (leave/flush/Dry) | `onCaptureFrame` snapshot factory | `settledSnapshot` -> `settleSheetNow` (drives the real fix, `settleForCapture` on the live engine) -> `snapshot()` | Yes — probe proved the settled export differs from the wet sheet and restores exactly | ✓ FLOWING |
| Save Script thumbnail / raster-lift eager sheet | `liveAlphaCanvas` / `aquarelleSnapshotRef` | `settledExport` -> `engine.exportSettledCanvas()` (capture -> settle -> export -> restore) | Yes — non-mutating settled read of the real engine tiles | ✓ FLOWING |
| Dry ledger | `recordAquarelleDry` | `fix()`'s return value via `onDryApplied` prop chain | Yes — engine-truth boolean, never a wetness read | ✓ FLOWING |
| Wet bake | `bakeAquarelleEventsToFrame({ settle })` | Real event replay + `applySettle` gating; probe measured `wetPeak 0.02891` wet vs `0` dry | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

All commands run against the final tree (HEAD `36f16d74c`), vitest in run mode only.

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Hold/wet-truth/Dry-step/settled-export source pins | `pnpm --dir packages/efx-watercolor exec vitest run src/playground/holdWet.test.ts src/playground/wetState.test.ts src/playground/lastTouch.test.ts src/playground/liveSeed.test.ts` | 177 passed, 8 skipped (pre-existing GPU-gated blocks) | ✓ PASS |
| Bake settle option tests | `pnpm --dir packages/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts src/adapter/engineAdapter.test.ts` (in the same targeted run) | passed | ✓ PASS |
| Layer/Dry/timer/stamp contract | `pnpm --dir app exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts` | passed | ✓ PASS |
| The two wet call sites + Dry wiring named pin | `pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts -t "wet call sites"` | 1 passed, 446 skipped | ✓ PASS |
| App typecheck (proves the engine methods reach the layer through the real types) | `pnpm --dir app exec tsc --noEmit` | exit 0 | ✓ PASS |
| Untouchable surfaces unchanged | `git diff --exit-code cf5f852fd..HEAD -- packages/efx-watercolor/src/playground/shaders.ts packages/efx-watercolor/src/playground/mediums.ts packages/efx-watercolor/src/playground/mediums.test.ts <PlayScript renderer> <top bar>` | exit 0 | ✓ PASS |

### Probe Execution

Probes are the phase's declared behavioral evidence (`packages/efx-watercolor/probe/wet-hold/`), run in this verification's own process on the real engine (headless Chrome, WebKit WebGL).

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| Hold scene | `node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --label verify-hold` | 29/29 assertions passed: post-idle `awake false`, `wet true`, `wetPeak 0.0289`; second acrylic stroke picks up (depth 2->3, `stroke null`, `active != null`); settled exports differ and restore exactly with unchanged undo depth in BOTH post-sleep and awake windows; `settleForCapture` depth unchanged, gate closed, peak 0 | ✓ PASS |
| Dry control | `node packages/efx-watercolor/probe/wet-hold/run.mjs --scene hold --dry --label verify-hold-dry` | `fix()` depth +1, gate closed, hold lifted, cross-run depth relation holds | ✓ PASS |
| Bake scene | `node packages/efx-watercolor/probe/wet-hold/run.mjs --scene bake --label verify-bake` | Wet: `settleTicks 0`, `wetPeak 0.02891`, 3 strokes with the Dry filtered. Dry: `settleTicks 72`, `wetPeak 0`, 4 events incl. the Dry. Ink digests differ; `bristleContent true` both | ✓ PASS |

### Requirements Coverage

Quick tasks carry no REQUIREMENTS.md mapping; the CONTEXT-derived laws D1-D7 (SUMMARY `coverage:`) are the contract.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| D1 | TASK 1 / truths 1-2 | Engine hold law; no auto-dry, no mobile->fixed, no settle-cap fix, no wake loop | ✓ SATISFIED | Truths 1-2; probe `hold`; source pins. |
| D2 | TASK 1 / truth 3 | Dry is one engine step; undo restores pre-dry, redo post-dry without re-running the fix | ✓ SATISFIED | Truth 3; probe `--dry` control. |
| D3 | TASK 1 / truth 5 | No-step settle + non-mutating settled export; raw guard reads `this.stroke` | ✓ SATISFIED | Truth 5; probe both windows. |
| D4 | TASK 2 / truth 6 | Bake settle option, wet Dry-event filter, adapter hold seam | ✓ SATISFIED | Truth 6; probe `bake`. |
| D5 | TASK 3 / truths 4, 7, 9 | Live wiring: hold re-arm, dry-first captures, Dry ledger, two wet call sites, timer invalidation | ✓ SATISFIED | Truths 4, 7, 9; contract + history + Studio pins. |
| D6 | all tasks | Untouchable surfaces unchanged | ✓ SATISFIED | `git diff --exit-code` on the five paths. |
| D7 | UAT | The seven live UAT rows | ? NEEDS HUMAN | Artist judgment — see Human Verification Required. |

### Test Quality Audit

- No skipped, todo, or disabled tests in any phase-created or phase-modified test file. The 8 skipped tests in the targeted run are the two pre-existing `describe.skipIf(!gpu)` GPU blocks in `engineAdapter.test.ts` (308, 474), introduced by 7f187f611 — unrelated to this phase.
- Source-scan pins ("source-pin" style) are structural by design in this repo; the behavioral proof for the engine laws lives in the probe harness, which executes the real engine and asserts numeric readouts (run in this verification, not trusted from the SUMMARY).
- The history tests exercise real behavior with a fail-closed harness (peek kind mismatch -> refused move + stack preserved), not just string pins.
- The re-expressions are assertions strengthened to the new law; none were deleted (SUMMARY deviations list matches the diffs).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | — | — | None. Debt-marker gate clean: 0 `TBD`/`FIXME`/`XXX`; 0 phase-introduced `TODO`/`HACK`/`PLACEHOLDER` (`git diff ... \| grep -c PLACEHOLDER` = 0; the `AQUARELLE_PLACEHOLDER_MAX_BYTES` hits are a pre-existing placeholder-frame byte threshold, untouched). No empty-handler, hardcoded-empty or console-only stubs in the changed files. |

### Decision Coverage

`gsd_run query check.decision-coverage-verify` returned `skipped: true, blocking: false, total: 0 — "No trackable decisions in CONTEXT.md."` Non-blocking; nothing to honor.

### Human Verification Required

Seven artist UAT rows (the executor's set; AUTOMATED-READY until confirmed) plus one supplementary verifier-derived row:

1. **UAT 1 — No auto-dry pause**
   **Test:** Watercolor stroke, switch to acrylic, pause >10 s, paint.
   **Expected:** The sheet still blends and picks up.
   **Why human:** Visible paint behaviour; the probe proves the law, not the look.

2. **UAT 2 — Shift+R re-render**
   **Test:** Shift+R on a settled/wet frame.
   **Expected:** The frame is wet and blendable again.

3. **UAT 3 — Apply one frame**
   **Test:** Apply one frame from the library/script.
   **Expected:** The applied paint is wet and blendable.

4. **UAT 4 — Dry (F)**
   **Test:** Press Dry (F) on a wet sheet, then paint acrylic.
   **Expected:** Everything dries; acrylic paints on dry; one undo restores the wet state; the result keeps the dense settled look (not the washed-out full settle).

5. **UAT 5 — PlayScript**
   **Test:** Run a PlayScript.
   **Expected:** Unchanged — still settles/dries per frame.

6. **UAT 6 — Leave a wet key**
   **Test:** Paint a wet key and leave it.
   **Expected:** Commits the dry look; returning shows the dry committed image (as today). Judge the PIXELS only: a ledger undo of a Dry restores the wet sheet but does NOT remove the recorded Dry script event, so a later dry-settle replay may re-apply it (accepted, by design).

7. **UAT 7 — Save Script / lift-erase on a wet sheet**
   **Test:** Save Script on a wet sheet; separately, lift-erase on a wet sheet.
   **Expected:** The sheet is STILL wet and blendable afterwards, and the saved/committed artifact shows the settled look.

8. **Supplementary (verifier-derived, optional) — Dry then Apply within 1.2 s**
   **Test:** Press Dry, then within ~1.2 s Apply the same frame (wet).
   **Expected:** The applied sheet stays wet and blendable.
   **Why human:** Documents the residual edge of the WR-01 telemetry substitution (truth 9 clause c): the Dry timer's capture guard no longer reads `settled`, so a wet sheet adopted inside the 1.2 s window without a stroke or history move would be settled step-free. Timing-dependent live behaviour no grep or probe can settle.

### Gaps Summary

No gaps. All nine must-have truths are verified in the code (not from the SUMMARY), all eleven artifacts pass the three-level check, all six key links are wired with direct evidence, and the probe scenes pass on the real engine in this verification's own run.

One documented mechanism deviation, already authorized by the post-review fix 36f16d74c and pinned in the contract test: truth 9 clause (c) (`settled` gating the Dry capture) was demoted to telemetry (WR-01) because gating on it would drop the Dry capture whenever the 1.2 s fix had not tightened exactly on the timer boundary (janky/backgrounded rAF); `settledSnapshot` drives the fix to completion instead, and the truth's two named harms remain guarded — undo/redo by the `historyRevision` check, renewed fresh paint by the stroke-start cancellation (and WR-02 counts an in-flight fix as wet so a second Dry cannot drop the capture). The one residual edge (wet sheet adopted inside the 1.2 s window without a stroke or history move) is surfaced as supplementary human row 8.

Informational, not a gap: `Skill("efx-studio-paint")` still documents the retired settle cap / auto-dry surface — a follow-up the SUMMARY already names, outside this quick's must-haves.

---

_Verified: 2026-11-23T20:44:09Z_
_Verifier: Claude (gsd-verifier)_
