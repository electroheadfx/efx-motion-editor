---
phase: quick-261027-klx
verified: 2026-10-27T20:42:30Z
status: human_needed
score: 9/9 must-haves verified
covered_files:
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-PLAN.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W0-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W1-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W2-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W3-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W4-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W5-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W6-1-SUMMARY.md"
  - ".planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W6-SUMMARY.md"
  - "app/src/components/physic-paint/engine/paintMutationLedger.test.ts"
  - "app/src/components/physic-paint/engine/paintMutationLedger.ts"
  - "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts"
  - "app/src/components/physic-paint/roto/paintMutationRotoPort.test.ts"
  - "app/src/components/physic-paint/roto/paintMutationRotoPort.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ledgerApply.test.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts"
covered_digest: "v3:sha256:4487539dfc2108f81cfd1b86c8042e6876fc60bc5283ecd505e51a27387c72f0"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/9
  gaps_closed:
    - "CR-01: Copy -> Apply deadlocked on the synchronous ledger because the clipboard registered its expected mutation ids only after enqueueRecordedStroke returned; the new onAccepted seam registers the id and accepted target before the completion listener runs."
    - "CR-02: Copy/Save captured the session-global ledger instead of the current frame; capture is now frame-scoped from the aquarelle record timeline, so navigation, a track switch, a restore and Trash cannot carry or lose strokes."
    - "WR-02: isEmpty was measured after the acceptance increment and was always false; it is now measured before the mutation joins the count."
    - "WR-06: getRotoPort replaced its seams on a later registration; it now merges them so an earlier seam is never blanked."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the Studio from the main window and inspect the module surface."
    expected: "Water color is the only module offered; no Brush slot, tab, rail section or Brush canvas is reachable."
    why_human: "Launching the packaged/dev Studio and judging the visible module surface is a native app fact no unit test observes."
  - test: "Paint, select, move, delete strokes, then undo and redo."
    expected: "Every gesture behaves as before removal; IDs keep advancing, no stroke is lost or duplicated, undo/redo restores the same pixels."
    why_human: "Real pointer input and visible canvas outcome across the whole tool set are user-flow behaviors."
  - test: "Create Roto keys and run Play Script Apply."
    expected: "Keys and Apply work watercolor-only; Apply bakes through the aquarelle port and produces the expected frames."
    why_human: "Apply runs the real bake (WebGL) and is judged on the visible result."
  - test: "Save, close, reopen and navigate the project; then open a v1-v4 SNAP-era project."
    expected: "SNAP v5 restores with no brush seeding; an old container shows the single clean-break notice and leaves the frame pixels unchanged."
    why_human: "Cross-session restore and the visible notice depend on live native storage."
  - test: "Open the Script library with a watercolor script and with an old Brush script on disk."
    expected: "Watercolor scripts load; the old Brush script appears as a refused legacy row without a crash."
    why_human: "The refusal row is a visible UI surface backed by Rust filesystem scanning."
  - test: "Composite and export a project."
    expected: "Composite and export output are unchanged from the pre-removal behavior."
    why_human: "Exported media is judged visually."
  - test: "Copy a multi-frame Roto script, apply it to another frame, then inspect devtools memory after a Studio session."
    expected: "The Apply burst settles with every brush applied and no deadlock; no engine-1 allocations appear; the Studio chunk stays under the locked ceiling (measured 911,432 bytes <= 951,080)."
    why_human: "Memory readings and the live Apply progression are runtime measurements."
---

# Phase quick-261027-klx: Engine-1 (Brush) Removal Verification Report

**Phase Goal:** Remove `@efxlab/efx-physic-paint` (engine-1, the Brush module) and every Brush runtime path, so `@efxlab/efx-watercolor` (engine-2) is the only paint engine.
**Verified:** 2026-10-27T20:42:30Z
**Status:** human_needed
**Re-verification:** Yes — after the targeted review fix `b148d5c0` (previous report verified `4e6ad914`)

**Verified tree:** `b148d5c0` (W6.1 fix commit), clean working tree apart from the untracked planning documents (`-REVIEW.md`, `-W6-SUMMARY.md`, `-W6-1-SUMMARY.md`, and this report).

**Verdict rationale:** all nine must-have truths, all ten artifacts and all six key links resolve to VERIFIED in the live tree at `b148d5c0`, and every automated gate is green. The four review findings fixed by `b148d5c0` (CR-01, CR-02, WR-02, WR-06) were re-checked at source level and against their regression tests, and the CR-01 burst test passes on the real ledger/port/controller stack. Status is `human_needed` rather than `passed` because the outcome includes visible Studio behaviors (launch, gestures, live Apply, cross-session restore, refusal row, export, memory) that only native UAT can confirm — the project rule is to report automated-ready, not done, until that UAT passes. No gaps were found. The review findings deliberately left open by instruction (WR-01, WR-03, WR-04, WR-05, IN-01..IN-03) are not must-haves of this phase and are recorded below as known-open, non-blocking items.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | The Studio builds and runs with no `@efxlab/efx-physic-paint` package installed; no surviving runtime source imports the specifier; remaining test/fixture occurrences are enumerated negative guards and refusal rows. | ✓ VERIFIED | `packages/` holds only `efx-paint-host`, `efx-spectral`, `efx-watercolor`; `app/package.json`, root `package.json`, `app/vite.config.ts` and `pnpm-lock.yaml` contain zero occurrences. G1-prod re-run at `b148d5c0` with the plan's exact scan/exclusions = **0**. G1-tests = **12 hits / 5 files**, every one an allowed category (negative guard, planted literal, fixture comment). Typecheck exit 0; app build exit 0. |
| 2 | Every watercolor stroke receives its mutation ID from the app-owned ledger: monotonic, never reused, seeded from restored max + 1, acceptance order == stroke-end order; the ledger emits completion itself with no rasterization/finalization/rendering. | ✓ VERIFIED | `paintMutationLedger.ts:99-101` (`nextMutationId++`), `:94-97` max-raise `reserveNextMutationId`, `:103-105` `seedFromRestoredMax`, `:145-150` frozen accepted record, `:154-155` `wasEmpty` then count increment, `:161` `onAccepted`, `:164-169` synchronous listener loop, `:170` return. Studio wires allocation at `PhysicsPaintStudio.tsx:3361`/`:5824`, seeding at `:4456`/`:4750`, subscription at `:5750`. Ledger suite 13/13; purity suite 13/13 (no engine import, no raster, no hidden render); launch integration 11/11. |
| 3 | Roto script save/copy/apply reads accepted strokes through ONE memoized port object, so `getAcceptedTarget` returns the accepted target for that same key and consumes it; no path calls engine-1 for stroke identity or acceptance. | ✓ VERIFIED | `paintMutationRotoPort.ts:33` `WeakMap<PaintMutationLedger, MemoizedRotoPort>`; one stable port identity; `getStrokes: () => ledger.getAcceptedStrokes()`; `enqueueRecordedStroke(group, onAccepted)` forwards the seam (`:53-56`). Studio publishes the same identity at `:598`/`:1936` and observes at `:5758`. Consumption: `physicsPaintRotoScriptClipboard.ts:1295-1300` (`targets?.delete(mutationId)` at `:1298`), pinned by `physicsPaintRotoScriptClipboard.test.ts:535` ("same-port, same-id and CONSUMES on read"). No engine-1 import or stroke-identity call remains. |
| 4 | Paper height conditioning is byte-identical to the engine-1 implementation, proven by a committed golden fixture plus a permanent test that compares bytes (NaN and -0 included). | ✓ VERIFIED | `paperConditioning.ts:24-34` is the verbatim engine-1 `conditionHeightMap` (clamp inlined), wired through `paperPass.ts:1`. Fixture `__fixtures__/paperConditioning.golden.json` has 8 cases (empty, symmetric, ramp, contrast extremes, seeded mulberry32 `0x261027`, NaN propagation, exact bound, negative zero). `paperConditioning.test.ts` compares `Uint8Array` bytes with a lossless `"NaN"`/`"-0"` codec — **11/11 re-run at `b148d5c0`**. Provenance was independently re-derived from pre-deletion engine-1 code (`core/paper.ts:79-92` + `util/math.ts:56-58`), so the fixture is not circular. |
| 5 | SNAP is version 5 with no brush body; a v1-v4 container produces exactly ONE clean-break notice per project binding (never the generic unsupported-version wording) and seeds zero rows (`maxRestoredMutationId === 0`). | ✓ VERIFIED | `studioScriptSnapshotCodec.ts:59` `STUDIO_SCRIPT_SNAPSHOT_VERSION = 5`; `:64` retired set `{1,2,3,4}`; `:562-563` raises `snap-v4-retired` before the generic check at `:565`. `studioScriptSnapshotController.ts:549` pinned clean-break message; `:612` `reportRestoreFailureOnce`; refusals return `maxRestoredMutationId: 0` (`:665`, `:676`); dedupe reset only in `bind()`/`reset()`. Codec suite 30/30; controller suite 58/58, including one notice per binding and zero seeded rows. Rust file-name version unchanged: `studio_script_snapshot.rs:64` `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1`. |
| 6 | Roto frame persistence classifies a frame from the watercolor recorded-stroke truth source, so a painted watercolor frame persists after the engine-1 document mirror is gone. | ✓ VERIFIED | `rotoFramePersistTruth.ts:37` — `recordedStrokeCount > 0 \|\| bgMode !== 'transparent'`. Studio builds the truth from `getAquarelleEventsForFrame` (`PhysicsPaintStudio.tsx:3973-3993`) and injects it as `getFrameTruth`. Both persistence paths delegate: `rotoSaveTransactions.ts:48-63`, `rotoEditBufferTransactions.ts:41-55`; controller reads it at `useRotoFrameEditingController.ts:93`. Truth-table 7/7, save transactions 7/7, edit-buffer transactions green. |
| 7 | The module surface is watercolor-only: no Brush slot, no `activeModule === 'brush'`, no `frameScriptOwner === 'brush'`, and the Studio renders the Aquarelle layers without the hidden engine-1 canvas. | ✓ VERIFIED | `activeModule.ts:18` `ActiveModule = 'watercolor'` (no `'brush'` literal); `frameModuleLock.ts` `FrameScriptOwner = 'watercolor' \| null`; `frameScriptOwnership.ts` returns `'watercolor' \| null`. `ModuleSwitcher.tsx` renders watercolor active plus an inert Krita slot; `PhysicsPaintRightPanel.tsx:458` mounts only `WatercolorModuleSection`; `PhysicsPaintToolRail.tsx` only `WatercolorRail`; `PhysicsPaintCanvasMount.tsx` renders AquarelleCachedBaseLayer + AquarelleCanvasLayer only, pinned by `PhysicsPaintCanvasMount.runtime.test.ts:149` and the negative source scan. |
| 8 | The Studio chunk measures at or below 951,080 bytes, the 2,000 kB build budget still passes, and the Studio still emits at least one `PhysicsPaintStudio-*.js` chunk. | ✓ VERIFIED | `app/dist/PhysicsPaintStudio-CyiGGNIV.js` = **911,432 bytes** (re-measured at `b148d5c0`; 39,648 bytes of headroom). Exactly one chunk matches the pattern. `app/vite.config.ts:290` `chunkSizeWarningLimit: 2000`. App build exit 0. (The 650-700 KB aspirational range is missed; the hard ceiling in the plan and CONTEXT is 951,080 and is met — recorded, not a gate failure.) |
| 9 | Every do-not-delete surface survives. | ✓ VERIFIED | The plan's 21-path probe re-run at `b148d5c0`: `PROBE_PATHS=21 PROBE_MISSING=0`. Non-empty spot checks: `aquarelleStrokeBridge.ts` 5,019 B, `aquarelleRecordState.ts` 58,429 B, `WatercolorBrushLibrary.tsx` 3,171 B, `brushFxDefaults.test.ts` 2,660 B, `types/paint.ts` 6,054 B, `ScriptStrokeOverlay.tsx` 20,567 B, `BrushesDocker.tsx` 13,166 B, `BrushResponsePanel.tsx` 3,642 B. Tauri label/capability survive: `app/src-tauri/src/lib.rs:210` (`let label = "efx-physic-paint";`) and `capabilities/physics-paint.json:5` (`"windows": ["efx-physic-paint"]`). |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Re-Verification Delta (`b148d5c0`)

The previous report verified `4e6ad914`. Commit `b148d5c0` changed eight files (four production, four test files, including one new suite). The four review findings it targeted were re-checked in source and by executing the regression tests.

| Finding | What was wrong | Fix in the live tree | Evidence |
| ------- | -------------- | -------------------- | -------- |
| CR-01 | The ledger emits each completion synchronously *inside* `enqueueRecordedStroke`; the clipboard registered `expectedMutationIds` and the accepted target only after the call returned. It therefore ignored the completion of the brush it had just enqueued — including the first brush of every Apply burst — and `finishApply` never ran (deadlock). | `paintMutationLedger.ts:161` calls the optional `onAccepted(mutationId)` after the acceptance record and count, before the listener loop. `paintMutationRotoPort.ts:53-56` forwards it. `physicsPaintRotoScriptClipboard.ts:830-845` defines one idempotent `registerAccepted` (registers expected id, accepted target with `publishPixels: brushIndex + 1 === brushes.length`, and `onFirstAcceptedBrush` for brush 0); `:847` passes it into `enqueueRecordedStroke` and `:848` calls it again defensively. `:778-794` `settleApplyIfDrained` now also requires the burst itself to be drained or cancelled. | `physicsPaintRotoScriptClipboard.ledgerApply.test.ts` (real ledger, real port, real controller, two-guide-stroke Copy -> Apply, 1000 ms `Promise.race` guard) passes **1/1**; unit pins in `paintMutationLedger.test.ts` ("onAccepted runs after acceptance and before the completion listener") and `paintMutationRotoPort.test.ts` ("forwards the onAccepted seam ahead of the completion listener") pass. Pre-fix, the integration test times out at ~1015 ms (deadlock signature recorded in W6.1). |
| CR-02 | Copy/Save read the session-global ledger, so they could capture another frame's or another track's strokes, kept Copy enabled after navigation to an unpainted frame, and treated a restored key as empty (a restore seeds the record timeline, never the ledger). | `physicsPaintRotoScriptClipboard.ts:374-378` derives `sourceHasBrushes` from `hasAquarelleScriptForFrame(sourceState.value.appFrame)`, re-evaluated on `aquarelleStrokesRevision` and `sourceRevisionTick`. `captureFrameScript` (`:1503-1529`) walks `frameCaptureEvents(playFrame)` (`:1430-1447`: timeline order, Dry events at their exact position, duplicate mutation ids collapse to the last occurrence), builds brushes from the current frame only, prefers a live ledger group by mutation id to preserve continuations, and projects restored strokes via `recordedStrokeToGroup` (`:1458`). All three capture sites (`:529`, `:598`, `:911`) use it. | `physicsPaintRotoScriptClipboard.test.ts:1945-2017`: CR-02a (navigation to an unpainted frame disables Copy and captures nothing), CR-02a2 (Copy carries only the current frame, never the session ledger), CR-02b (restored key is copyable and Save captures its restored script), CR-02c (track switch replaces the frame truth — no cross-track capture), CR-02d (Trash clears the rail script and disables Copy). All pass; harness records frame strokes explicitly and resets aquarelle record state per test. |
| WR-02 | `isEmpty` was read in place after `acceptedStrokeCount += actions.length`, so every completion reported `false`, including the first mutation of a session. | `paintMutationLedger.ts:154` captures `wasEmpty` before `:155` increments the count. | `paintMutationLedger.test.ts` "WR-02: isEmpty is measured before the mutation joins the acceptance count" — expected `[true, false]`. |
| WR-06 | `getRotoPort` replaced `existing.seams`, so a later call supplying only one seam blanked every seam registered earlier (including the capture seam). | `paintMutationRotoPort.ts:44` `existing.seams = { ...existing.seams, ...seams };` — merge, never replace. | `paintMutationRotoPort.test.ts` "WR-06: re-registering seams merges them instead of replacing them". |

The targeted five-file suite (ledger, port, clipboard, ledger-Apply integration, launch integration) is **114/114 green at `b148d5c0`**; the ledger purity and paper parity suites add **24/24** in the same session.

### Required Artifacts

The PLAN declares `must_haves.artifacts` as 10 bare paths (no `provides`), so `gsd-tools query verify.artifacts` answers `invalid` (exit 1) rather than a parseable verdict. Each path was verified manually at all four levels (exists, substantive, wired, data flows).

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/engine/paintMutationLedger.ts` | App-owned mutation ledger | ✓ VERIFIED | 214 lines; allocation/acceptance/completion/seed contracts at `:94-170`; wired at Studio `:3361`/`:4456`/`:4750`/`:5750`/`:5824`; 13 ledger + 13 purity test cells |
| `app/src/components/physic-paint/roto/paintMutationRotoPort.ts` | One memoized Roto port | ✓ VERIFIED | 68 lines; `WeakMap` memoization, seam merge (`:44`), `onAccepted` forwarding (`:53-56`); wired at Studio `:598`/`:1936`/`:5758`; 8 test cells |
| `app/src/components/physic-paint/roto/rotoFramePersistTruth.ts` | Watercolor persistence truth | ✓ VERIFIED | 37 lines; imported by both transaction modules; 7 test cells |
| `app/src/components/physic-paint/types/paintCore.ts` | App-owned paint types | ✓ VERIFIED | 112 lines of exported types; imported by 12+ modules including Studio, clipboard, schema, coordinator |
| `app/src/lib/paperConditioning.ts` | Byte-parity paper conditioner | ✓ VERIFIED | 34 lines; wired through `paperPass.ts:1`; 11 test cells re-run |
| `app/src/lib/__fixtures__/paperConditioning.golden.json` | Golden byte fixture | ✓ VERIFIED | 617 lines / 8 cases; asserted by the byte-comparing test; provenance verified against pre-deletion code |
| `app/src/components/physic-paint/view/stackOrder.ts` | App-owned stack order | ✓ VERIFIED | 63 lines; imported by `aquarelleRecordState.ts` and `PhysicsPaintStrokeSettingsDialog.tsx`; 7 test cells |
| `app/src/components/physic-paint/engine/aquarelleEnginePort.ts` | Narrow Option A port | ✓ VERIFIED | 95 lines; `{snapshot, restore, exportCanvas, undo, redo, clear}`; `WatercolorEngine` is type-only and never re-exported; published by `AquarelleCanvasLayer.tsx:441`; imported by 9 modules |
| `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` | SNAP v5 codec | ✓ VERIFIED | Version 5 (`:59`), retired set `{1,2,3,4}` (`:64`), `snap-v4-retired` raised before the generic check (`:562-563`); 30 test cells |
| `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` | SNAP restore + notice | ✓ VERIFIED | Pinned message (`:549`), once-per-binding notice (`:612`), zero seeded rows on refusal (`:665`, `:676`); 58 test cells |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Aquarelle stroke end | ledger → completion handler → accepted target | `allocateStrokeMutation` → `onAccepted` seam → synchronous listener → `observeCompletedMutation(rotoMutationPort, mutation)` → clipboard `getAcceptedTarget` | ✓ WIRED | Studio `:5824` allocate, `:5750` subscribe, `:5758` observe; clipboard `:1295-1300` consume. Wording note: the must-have phrases the last hop as a direct `rotoScript.getAcceptedTarget(port, mutationId)` call in the Studio; shipped code publishes only the ONE port identity and the clipboard controller owns the lookup — pinned by `PhysicsPaintStudio.test.ts:4550` (`expect(studio).not.toContain('rotoScript.getAcceptedTarget(')`) and by the consume-on-read test at `physicsPaintRotoScriptClipboard.test.ts:535`. Same port identity, same consume-on-read contract. |
| `ledger.getAcceptedStrokes` | script capture/save | `paintMutationRotoPort.getStrokes` → `normalizeLogicalBrushes(engine.getStrokes())` → brushes + `aquarelleEvents` + alpha canvas | ✓ WIRED | Port `:50`; `captureFrameScript` `:1509` consumes `normalizeLogicalBrushes(engine.getStrokes())`; frame membership from `getAquarelleEventsForFrame`; capture call sites `:529`/`:598`/`:911` |
| `restoreAquarelleRecordTimeline` | next allocation | `maxRestoredMutationId` → `reserveNextMutationId(max + 1)` | ✓ WIRED | Studio `:4456` (launch restore), `:4750` (track switch); ledger max-raise `:94-97`; `seedFromRestoredMax` (`:103-105`) is the same contract and is exercised by the ledger seed test. Exactly two seed sites, pinned by the Studio source test. |
| SNAP codec v5 | controller restore | retired-version kind → `reportRestoreFailureOnce` → one notice, zero seeded rows | ✓ WIRED | Codec `:562-563`; controller `:612`/`:665`/`:676`; 58 controller test cells cover one-notice-per-binding and the zero rows |
| `aquarelleRecordState` recorded strokes | `shouldPersistRotoFrame` | `getAquarelleFrameTruth` → truth table | ✓ WIRED | Studio `:3973-3993`; `rotoSaveTransactions.ts:48-63`; `rotoEditBufferTransactions.ts:41-55`; `useRotoFrameEditingController.ts:93` |
| `AquarelleCanvasLayer` | Roto coordinator ports | `aquarelleEnginePort` (snapshot/restore/exportCanvas/undo/redo/clear) | ✓ WIRED | Layer publishes `createAquarelleEnginePort(() => engineRef.current)` at `AquarelleCanvasLayer.tsx:441`; `rotoCoordinatorPorts.ts` and 9 importers consume the narrow port; no `WatercolorEngine` internals leak |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `paintMutationLedger.ts` | accepted strokes / mutation IDs | live `RecordedStrokeGroup` passed from the stroke-end handler (`PhysicsPaintStudio.tsx:5824`) | Yes — real stroke groups, not literals | ✓ FLOWING |
| `paintMutationRotoPort.ts` | `getStrokes`, `getStrokeCount` | `ledger.getAcceptedStrokes()` / `getAcceptedStrokeCount()` | Yes — same ledger state the Studio writes | ✓ FLOWING |
| `physicsPaintRotoScriptClipboard.ts` | capture brushes + `aquarelleEvents` | `getAquarelleEventsForFrame(playFrame)` for membership, live ledger groups by mutation id for continuations, `getRecordedAquarelleStroke` for restored strokes | Yes — current frame's record timeline, never a static fallback | ✓ FLOWING |
| `rotoFramePersistTruth.ts` | `recordedStrokeCount`, `bgMode` | `getAquarelleEventsForFrame(frame)` + `settings.background` | Yes — per-frame aquarelle event log | ✓ FLOWING |
| `studioScriptSnapshotController.ts` | `maxRestoredMutationId`, restored user frames | decoded SNAP v5 container (`studioScriptSnapshotCodec.ts`) | Yes — decoded user data; refusals return 0 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted regression suites (5 files) | `pnpm --dir app exec vitest run <ledger, port, clipboard, ledgerApply, launch integration>` | exit 0; **5 files, 114 tests passed** | ✓ PASS |
| Ledger purity + paper byte parity | `pnpm --dir app exec vitest run paintMutationLedger.purity.test.ts paperConditioning.test.ts` | exit 0; **2 files, 24 tests passed** | ✓ PASS |
| CR-01 Copy -> Apply multi-brush burst | included in targeted run (real ledger + real port + real controller, 1000 ms race guard) | 1 passed; settled, progress cleared, 4 accepted ledger entries | ✓ PASS |
| CR-02 frame-scoped capture (a, a2, b, c, d) | included in targeted run | 5 passed | ✓ PASS |
| Typecheck | `pnpm --dir app run typecheck` | `TYPECHECK_EXIT=0` (W6.1 post-commit run) | ✓ PASS |
| Full app suite | `pnpm --dir app exec vitest run` | exit 0; 343 files passed / 2 skipped (345); 6,069 tests passed / 1 skipped / 96 todo (6,166) (W6.1 post-commit run) | ✓ PASS |
| Watercolor check / suite / build | `pnpm --dir packages/efx-watercolor run check`, `... vitest run`, `... run build` | exits 0; 10 files / 136 passed / 4 skipped (W6.1 run) | ✓ PASS |
| App build + Studio chunk | `pnpm --dir app run build`; `ls -l app/dist/PhysicsPaintStudio-*.js` | exit 0; one chunk `PhysicsPaintStudio-CyiGGNIV.js` = **911,432 bytes <= 951,080** (re-measured) | ✓ PASS |
| Build budget | `grep chunkSizeWarningLimit app/vite.config.ts` | `2000` at `:290` | ✓ PASS |
| Rust suite | `cargo test --manifest-path app/src-tauri/Cargo.toml` | exit 0; 104 + 20 + 39 + 4 + 21 = **188 passed, 0 failed** (W6.1 run) | ✓ PASS |
| G1-prod | plan's exact scan of `app/src packages` with test/fixture exclusions | **0 live imports** (re-run at `b148d5c0`) | ✓ PASS |
| G1-tests inventory | `grep -rn '@efxlab/efx-physic-paint' app/src packages` | **12 hits / 5 files** — all negative guards, planted literals, fixture/comment rows | ✓ PASS |
| G2 | `grep -rn -E "brushScript\|BrushScript" app/src` | **0** (re-run) | ✓ PASS |
| G3 | `grep -rnE "ROTO_SCRIPT_ENGINE_ID\b" app/src` | **0** (re-run) | ✓ PASS |
| G4 | `grep -rnE "SCRIPT_ENGINE_ID\b" app/src-tauri/src` | **0** (re-run) | ✓ PASS |
| G5 | `grep -rn "efx-physic-paint" app/src` plus the allowlist assertion | **46 hits / 17 files**, allowlist leftover **0** (re-run) | ✓ PASS |
| Do-not-delete probe | `test -e` over the plan's 21 paths | `PROBE_PATHS=21 PROBE_MISSING=0` (re-run) | ✓ PASS |

### Probe Execution

Step 7c: N/A. The phase declares no `scripts/*/tests/probe-*.sh` probe. The W6 "do-not-delete probe" is the shell existence loop over 21 protected paths, reported in the table above; no probe-based verification is claimed.

### Requirements Coverage

N/A — quick task, not a milestone phase; `.planning/REQUIREMENTS.md` maps no requirement IDs to this task. The plan's `requirements: []` is consistent with that.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`) in the eight fix-commit files | none | Re-scanned at `b148d5c0`: zero matches. No unreferenced debt marker blocks the phase. |
| — | — | Empty implementations / static stubs in phase-authored runtime modules | none | No `return null`/`return {}` placeholder on a live path; every dynamic value traced to a real source (Level 4 above). |
| `useRotoFramePersistenceCoordinator.ts` | 248-260, 458-460 | `loop-placeholder` string | ℹ️ Info | Domain concept (D-28 render-source variant with a rejection arm), not a stub. |
| `ModuleSwitcher.tsx` | 7 | "placeholder" comment | ℹ️ Info | The inert, native-disabled Krita slot is intentional; it never writes the module. |
| `packages/efx-paint-host/src/script/parse.ts` | 16 | `ENGINE_IDS = new Set(['efx-physic-paint', 'efx-watercolor', 'efx-krita'])` | ℹ️ Info | Generic envelope allowlist in a do-not-delete package. Not an import and not a Brush runtime path; the app schema refuses a legacy `engineId` before a script is produced. |
| `script_library.rs` | 2997-3015 | Retired literal in a test fixture | ℹ️ Info | Inside `#[cfg(test)]`; refusal INPUT only. |

Known-open review findings, deliberately left open by the W6.1 instruction (not must-haves of this phase; no must-have truth depends on them):

| ID | Finding | Status / severity |
| -- | ------- | ----------------- |
| WR-01 | Completion-listener throws are not isolated; `handleAquarelleStrokeEnd` swallows errors in an empty catch | ⚠️ Warning — known-open, deferred by instruction |
| WR-03 | Rust `validate_brush_pack` accepts any `kind` value | ⚠️ Warning — known-open, deferred by instruction |
| WR-04 | Rust `brush_count` counts Dry markers as brushes | ⚠️ Warning — known-open, deferred by instruction |
| WR-05 | The ledger's input lock has no reader (dead lock) | ⚠️ Warning — known-open, deferred by instruction |
| IN-01 | Dead APIs identified by the review remain exported | ℹ️ Info — known-open |
| IN-02 | `guideProxy` is unread; its claim that `snapshotBoundSource` captures every ledger stroke is now obsolete (CR-02 makes capture frame-scoped by construction), but the dead field remains | ℹ️ Info — known-open |
| IN-03 | `shouldPersistRotoFrame` is duplicated in two places | ℹ️ Info — known-open |

None of these defeats a must-have truth, and none was introduced by the fix commit beyond the scope the user explicitly closed (CR-01, CR-02, WR-02, WR-06). They are recorded here so they cannot be lost between the review and a later phase.

### Human Verification Required

These are the seven native UAT rows the W6 summary prepared as **automated-ready**. They are not claimed complete; per the project rule, the phase is automated-ready until live UAT passes.

#### 1. Studio opens Water color only

**Test:** Open the Studio from the main window and inspect the module surface.
**Expected:** Water color is the only module offered; no Brush slot, tab, rail section or Brush canvas is reachable.
**Why human:** Launching the Studio and judging its visible module surface is a native app fact.

#### 2. Paint / select / move / delete / undo / redo unaffected

**Test:** Perform each gesture and undo/redo.
**Expected:** Behavior matches the pre-removal app; no stroke is lost or duplicated.
**Why human:** Real pointer input and visible canvas outcome.

#### 3. Roto keys + Play Script Apply watercolor-only

**Test:** Create Roto keys and run Play Script Apply.
**Expected:** Keys and Apply work watercolor-only and bake through the aquarelle port.
**Why human:** The real bake needs WebGL and is judged on the visible result.

#### 4. Save / close / reopen / navigate restores SNAP v5 with no brush seeding

**Test:** Save, close, reopen, navigate; also open a v1-v4-era project.
**Expected:** SNAP v5 restores with no brush seeding; an old container shows the single clean-break notice and leaves the pixels unchanged.
**Why human:** Cross-session restore and the visible notice depend on live native storage.

#### 5. Script library watercolor-only with a refused legacy row

**Test:** Open the Script library with a watercolor script and an old Brush script on disk.
**Expected:** Watercolor scripts load; the old Brush script appears as a refused legacy row without a crash.
**Why human:** Visible UI surface backed by Rust filesystem scanning.

#### 6. Composite / export unchanged

**Test:** Composite and export a project.
**Expected:** Output unchanged from the pre-removal behavior.
**Why human:** Exported media is judged visually.

#### 7. Multi-brush Apply settles; devtools memory shows no engine-1 allocations; chunk under ceiling

**Test:** Copy a multi-frame Roto script, apply it to another frame, then inspect devtools memory after a Studio session and compare the Studio chunk.
**Expected:** The Apply burst settles with every brush applied and no deadlock; no engine-1 allocations; chunk 911,432 bytes <= 951,080.
**Why human:** Memory readings and live Apply progression are runtime measurements.

### Gaps Summary

**No gaps.** Every must-have truth is verified with codebase evidence; every artifact exists, is substantive, is wired and has flowing data; every key link is wired; all heavy gates and all six census gates are green at `b148d5c0`.

Three notes recorded without affecting the verdict:

1. **Fixed findings are genuinely closed.** CR-01 and CR-02 are not taken on the SUMMARY's word: the source shows the seam ordering (`onAccepted` after acceptance, before listeners) and the frame-scoped capture by construction, and the regression tests execute the real ledger/port/controller stack. WR-02 and WR-06 are pinned by their unit tests. Targeted suites: 114/114 at `b148d5c0`.
2. **Key link 1 wording divergence (not a gap).** The must-have describes the Studio completion handler calling `rotoScript.getAcceptedTarget(port, mutationId)` directly. The shipped design publishes the one memoized port identity and lets the clipboard controller perform the consuming lookup. The contract — same port identity, accepted target returned then consumed — is implemented and pinned by a negative source assertion plus a consume-on-read test. This was documented in W4 as decision D8 and is unchanged by the fix.
3. **Chunk target.** 911,432 bytes passes the locked 951,080-byte ceiling but misses the 650,000-700,000 aspirational range. The plan's pass criterion is the ceiling; no dedupe work was in scope.

---

_Verified: 2026-10-27T20:42:30Z_
_Verifier: Claude (gsd-verifier)_
