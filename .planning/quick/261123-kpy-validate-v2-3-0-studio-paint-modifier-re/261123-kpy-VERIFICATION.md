---
phase: quick/261123-kpy
verified: 2026-11-23T15:02:53Z
status: human_needed
score: 6/7 must-haves verified
covered_files: [".planning/quick/261123-kpy-validate-v2-3-0-studio-paint-modifier-re/261123-kpy-PLAN.md", ".planning/quick/261123-kpy-validate-v2-3-0-studio-paint-modifier-re/261123-kpy-SUMMARY.md", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts", "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts", "app/src/components/physic-paint/performance/scriptTimelineCodec.ts", "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts", "app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.clone.test.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts", "app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts", "app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts", "packages/efx-watercolor/probe/medium-engine/compare.mjs", "packages/efx-watercolor/probe/medium-engine/harness.test.ts", "packages/efx-watercolor/probe/medium-engine/probe.ts", "packages/efx-watercolor/probe/medium-engine/run.mjs", "packages/efx-watercolor/src/adapter/engineAdapter.test.ts", "packages/efx-watercolor/src/adapter/engineAdapter.ts", "packages/efx-watercolor/src/determinismContract.test.ts", "packages/efx-watercolor/src/payload/codec.test.ts", "packages/efx-watercolor/src/payload/codec.ts", "packages/efx-watercolor/src/payload/toStudioStroke.test.ts", "packages/efx-watercolor/src/payload/toStudioStroke.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/coverage.test.ts", "packages/efx-watercolor/src/playground/relief.test.ts", "packages/efx-watercolor/src/playground/reliefModifier.test.ts", "packages/efx-watercolor/src/playground/reliefModifier.ts", "packages/efx-watercolor/src/playground/scattering.test.ts"]
covered_digest: "v4:sha256:c84b7c083ae14f4b4acef82fc2153f5296d73b50e16b7420516b3ddfca973b4b"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "A recorded modifier stroke keeps its polarity through every live recording seam and replays as a modifier stroke (no paint): record, restore, duplicate and script copy all share the ONE projection — restoreAquarelleRecordTimeline and cloneAquarelleStrokeForDuplicate now carry `relief` (e45a72d11), and the third instance found after the report, the in-memory fallback of aquarelleEventsFromScript, carries it too (44ba44cc1)."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Undo restores a modifier stroke in one step: the modifier dab takes its own touch on the same rects the ink pass uses (1.5 non-bristle / 1.6 bristle, PROTECT_MARGIN 24) for BOTH polarities"
    test: "Paint an impasto band, then a Shift-erode stroke across it (any Emboss); press Cmd+Z once"
    expected: "The band returns to its pre-stroke relief in ONE undo step — no half-erased band, no second undo"
    why_human: "The own-touch call is present and source-pinned (Engine.ts:2942; relief.test.ts:654-662), but no test drives the engine history; the one-step merge is a runtime history invariant that presence checks cannot see. Kept as a LIVE UAT row by the user's decision."
human_verification:
  - test: "Paint an impasto band (Emboss +15), then a Shift-erode stroke across it; press Cmd+Z once"
    expected: "The band returns to its pre-stroke relief in ONE undo step (no half-erased band, no second undo)"
    why_human: "The own-touch `touch(stampRect(..., 1.5/1.6))` is present for both polarities and source-pinned, but no test drives the engine undo history; the one-step merge is a runtime history invariant. User-retained live UAT row."
---

# Quick 261123-kpy: Pressure-driven Studio paint modifier relief — Verification Report

**Goal:** (v2.3.0) Studio paint: modifier relief is pressure-driven — Shift erodes, Cmd deposits. Supersedes quick 261123-jak's Shift semantics, keeping its persistence spine and replacing only the modifier rule and the magnitude.
**Verified:** 2026-11-23T15:02:53Z (re-verification after the two gap-fix commits; re-ran the three gap-fix pin files, the scoped package pins, every probe compare over the recorded captures, the full app suite, and the app typecheck)
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Gap Closure (Re-verification)

Diff since the previously verified implementation HEAD `04ec5c743` is exactly six files, all app-side rebuild seams and their pins; no engine, codec, probe or identity file moved (`git diff --stat 04ec5c743..HEAD` = 182 insertions, 0 deletions).

| Previously failed item | Closure evidence | Status |
| --- | --- | --- |
| T4 restore seam — `restoreAquarelleRecordTimeline` dropped `relief` | `aquarelleRecordState.ts:2333` reads `const relief = engine.relief`; `:2361` spreads it into the rebuilt stroke before `toStudioStroke(stroke)` (`e45a72d11`) | ✓ CLOSED |
| T4 duplicate seam — `cloneAquarelleStrokeForDuplicate` dropped `relief` | `aquarelleStrokeSelection.ts:1050` conditional spread beside the texture carriers (`e45a72d11`) | ✓ CLOSED |
| Third instance found after the report — `aquarelleEventsFromScript` in-memory fallback | `physicsPaintRotoPlayScriptController.ts:4458` conditional spread beside `textureRotation` (`44ba44cc1`) | ✓ CLOSED |
| Pins for the seams | `aquarelleRecordState.restore.test.ts` (3 rows), `aquarelleStrokeSelection.clone.test.ts` (4 rows incl. a record→restore→duplicate→toStudioStroke round trip), `physicsPaintRotoPlayScriptController.test.ts` (2 rows) | ✓ PASS |

**Field-by-field rebuild sweep (the whole T4 property, not the two spread lines).** Every construction site of `AquarelleStroke` / `AquarelleStrokePayload` in production app/package code was enumerated and inspected:

- Fixed: `aquarelleRecordState.ts:2334` (restore), `aquarelleStrokeSelection.ts:~1024` (duplicate), `physicsPaintRotoPlayScriptController.ts:4430` (fallback).
- Preserve by spread (no drop possible): `aquarelleRecordState.ts` move/params/vector-spine/transform/swap/renumber rebuilds (1237, 1508, 1607, 1706, 1772, 1901, 2000, 2091 — all `...stroke`), `recordAquarelleStroke` → `toStudioStroke(recorded)` (2243), `codec.ts cloneStrokeForWire` (`...stroke.engine`), `toStudioStroke.ts` (the ONE projection, conditional spread at 288), `aquarelleReplayGrid.ts` (58, 87), `physicsPaintRotoScriptSchema.ts` (187, 275), `physicsPaintRotoScriptClipboard.ts` (679, 1421), the AQTL decode merge (`scriptTimelineCodec.ts:1163`).
- Not a carrier (first-record surfaces with no marker source): `AquarelleCanvasLayer.tsx:739` live pointer record (has the marker), `vectorPathHandles.ts buildVectorStroke` (vector commit, engine latch never involved), `physicsPaintRotoScriptClipboard.ts:1567` (`PhysicStrokePayload`, a different tool's payload), probe files.

Every duplicate/copy/rail projection funnels through the fixed `aquarelleStrokeFromScriptEvent` (`physicsPaintRotoDuplicateScript.ts:224` ← `copyAquarelleScriptToFrame:248`, `sliceRailKeyScripts:86`). **No fourth instance found.**

**Do the new pins fail without the fix in spirit?** Yes — they call the real production functions and assert behavior, not source literals: the restore pin feeds a decoded-shaped event into `restoreAquarelleRecordTimeline` and asserts both the rebuilt registry stroke and the re-projected entry keep the polarity (pre-fix both are `undefined`); the clone pin asserts `clone.relief` on the output of `cloneAquarelleStrokeForDuplicate` (pre-fix `undefined`); the end-to-end pin chains record → restore → duplicate → `toStudioStroke` through the real seams; the fallback pin drives the controller's public confirm/reveal-run port with a snapshot that has no `aquarelleEvents`, so the in-memory branch really executes (pre-fix `projected.engine.relief` was `undefined`).

**Executor finding sanity-check — CONFIRMED.** `getRecordedAquarellePayload` returns an `AquarelleStrokePayload` body built field-by-field (no `.engine` slot) and does **not** copy `relief`, while the payload type declares `relief?`. So `stored?.relief` type-checks but would always read `undefined`, and `stored?.engine` does not type-check. Sourcing the value from `getRecordedAquarelleStroke` (`storedStroke.relief`) is correct. The silent swallow itself is recorded as an ℹ️ Info finding below (no behavioral impact today; one consumer, which uses the stroke accessor).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Shift at stroke start erodes and Cmd deposits: the probe shows the +15 band mean at most half with the peak not raised (erode), a light band's mean and peak raised (deposit), pigment and unshaded film byte-identical vs an off-sheet inert twin for BOTH polarities, plus the bristle erode arm | ✓ VERIFIED | All three `--relief-modifier <control>` compares re-run at HEAD, PASS: erode watercolor 0.0024→0.0001 (−95.8%), peak 0.0659→0.0053; erode bristle 0.0081→0, peak 0.225→0.064; deposit 0.0008→0.2389, peak 0.022→6.6094; unshaded digests `92fb355b`/`88022845` (watercolor, both polarities) and `f6a0893b`/`160aa53d` (bristle) equal to control |
| 2 | Magnitude is PRESSURE-ONLY: pen pressure drives the `embossPress` floor curve, the recorded `p < 0` sentinel is exactly 1.0, the Emboss slider is never read (works at Emboss 0), never pointerType | ✓ VERIFIED | `reliefModifier.ts:37-50`; `Engine.ts:2815` uses `amount * RELIEF_GAIN` (no `P.emboss`); `s.pressureless = q.p < 0` at 2569/2605; scoped package pins re-run green (8 files, 243 passed, 8 skipped). Pressure compares re-run PASS: p=0.3 reduction 0.0019 vs p=1 0.0024 (ratio 0.7917), `none` 0.0022 (ratio 0.9167 ≥ 0.9) |
| 3 | Latch at pointerdown on the RESOLVED tool: Shift wins over Cmd, mid-stroke changes never flip, Alt stays the picker | ✓ VERIFIED | `Engine.ts:2315` — the exact latch literal, after the tool overrides, `shiftKey` ternary before `metaKey`; no other `shiftKey`/`metaKey` read exists in the stroke lifetime (structural no-flip proof); engine untouched since the previous pass; pins green |
| 4 | A recorded modifier stroke keeps its polarity through every live recording seam and replays as a modifier stroke (no paint): record, restore, duplicate and script copy all share the ONE projection | ✓ VERIFIED | Previously FAILED — now closed end to end: record (`AquarelleCanvasLayer.tsx:772`), restore (`aquarelleRecordState.ts:2333/2361`), duplicate (`aquarelleStrokeSelection.ts:1050`), script copy (`physicsPaintRotoDuplicateScript.ts:224` via the fixed projection), Play Script fallback (`physicsPaintRotoPlayScriptController.ts:4458`). Every rebuild site swept; no fourth instance. The three new pin files pass (330 tests), including a record→restore→duplicate→project round trip for both polarities |
| 5 | Normal strokes and Emboss 0 are byte-identical to pre-change HEAD captures | ✓ VERIFIED | `compare.mjs emboss-pos15 --other emboss-pos15-kpy-head` and `neutral-identity --other neutral-identity-kpy-head` re-run: 12/12 fields equal each; no package file changed since the previous pass |
| 6 | Undo restores a modifier stroke in one step via the dab's own ink-rect touch (1.5/1.6, PROTECT_MARGIN 24) for BOTH polarities | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `Engine.ts:2942` takes the own touch for `s.relief !== null` for both polarities before the relief draw; source-pinned at `relief.test.ts:654-662`; no test drives the engine history — user-retained LIVE UAT row (unchanged, not failed) |
| 7 | The modifier stroke paints nothing (no ink/water/cover/carrier/bristle stamp), GAP-1 stands, both modifiers documented in the shared shortcuts help | ✓ VERIFIED | One `s.relief === null` guard family owns cover (2861), carrier (2896), the paint block (2906), wet (2957) and splat (2962); probe proves byte-identical pigment/unshaded film for both polarities; `physicsPaintShortcutsHelp.ts:44-46`; engine/help untouched since the previous pass |

**Score:** 6/7 truths verified (0 failed; 1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/playground/reliefModifier.ts` | Pure pressure law | ✓ VERIFIED | 50 lines; gains 15/15; imported by Engine |
| `packages/efx-watercolor/src/playground/Engine.ts` | Latch, sentinel, guards, own touch, report | ✓ VERIFIED | Untouched by the fix commits; `reliefAmount` literal and clamped erode law byte-identical |
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` | Both types + conditional spread | ✓ VERIFIED | `relief?: ReliefMode` on payload (135) and runtime (208); spread at 288 |
| `packages/efx-watercolor/src/payload/codec.ts` | Fail-closed literal guard, spread clone | ✓ VERIFIED | Guard refuses any non-`'erode'`/`'deposit'` value; `cloneStrokeForWire` spreads the engine (no drop) |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | Feed the payload value to `scriptBegin` | ✓ VERIFIED | `active.stroke.engine.relief` at 500 |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | Record only when latched | ✓ VERIFIED | `onStrokeEnd(tool, relief)`; conditional spread at 772 |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | AQTL bits 5-6 | ✓ VERIFIED | Encode 657-658, guard 630-632, conflict refusal 972, decode 1019-1020, merge 1163 |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` | Mirror guard + label | ✓ VERIFIED | 536 / 629; label `engine.relief` |
| `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts` | Duplicate/script-copy projection | ✓ VERIFIED | 224; feeds `copyAquarelleScriptToFrame` and `sliceRailKeyScripts` |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Restore seam carries the polarity | ✓ VERIFIED | 2333/2361 (fixed in `e45a72d11`); all other rebuilds spread the stroke |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Duplicate seam carries the polarity | ✓ VERIFIED | 1050 (fixed in `e45a72d11`) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | Fallback projection carries the polarity | ✓ VERIFIED | 4458 (fixed in `44ba44cc1`); sourced from `getRecordedAquarelleStroke` |
| `app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts` | Both modifiers documented | ✓ VERIFIED | 44-46, pinned by the keys array |
| `packages/efx-watercolor/probe/medium-engine/probe.ts` | Scene, operands, readback | ✓ VERIFIED | Untouched since the verified pass |
| `packages/efx-watercolor/probe/medium-engine/compare.mjs` | Relation/control/pressure modes | ✓ VERIFIED | All gates re-run PASS |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `Engine.ts` | `reliefModifier.ts` | `reliefSigned` through the pure law | ✓ WIRED | Import 51, use 2815; normal path untouched |
| `Engine.ts` | `AquarelleCanvasLayer.tsx` | pointerdown latch → `onStrokeEnd` → recorded bag | ✓ WIRED | Latch 2315, report call 2646, record 772 |
| `AquarelleCanvasLayer.tsx` / restores / clones / script copy | `toStudioStroke.ts` | the ONE projection | ✓ WIRED | Previously PARTIAL — restore and duplicate now feed a stroke that still carries `relief`; the fallback projects it too; pins prove the round trip |
| `scriptTimelineCodec.ts` | `engineAdapter.ts` | AQTL bits 5/6 → `active.stroke.engine.relief` → `scriptBegin` | ✓ WIRED | Encode/decode/merge + adapter arg |
| `probe.ts` | `Engine.ts` | `reliefBandStats` + unshaded digests vs off-sheet twin | ✓ WIRED | All compares re-run PASS |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Recorded bag (live stroke) | `relief` | engine pointerdown latch | Yes | ✓ FLOWING |
| `toStudioStroke` | `engine.relief` | recorded AquarelleStroke | Yes (when present) | ✓ FLOWING |
| `engineAdapter` | `scriptBegin` 11th arg | payload `engine.relief` | Yes | ✓ FLOWING |
| `restoreAquarelleRecordTimeline` | `engine.relief` | AQTL/JSON-decoded event | Yes — copied onto the rebuilt stroke | ✓ FLOWING (was DISCONNECTED) |
| `cloneAquarelleStrokeForDuplicate` | `relief` | source AquarelleStroke | Yes — conditional spread | ✓ FLOWING (was DISCONNECTED) |
| `aquarelleEventsFromScript` fallback | `relief` | `getRecordedAquarelleStroke(mutationId)` | Yes — conditional spread | ✓ FLOWING (was DISCONNECTED) |
| `mergeStudioScriptSnapshotContent` → save | `watercolorEvents` | session event preferred over retained | Yes — the session event now keeps the polarity | ✓ FLOWING (was DISCONNECTED) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Gap-fix pins (restore, clone, Play Script fallback) | `pnpm --dir app exec vitest run <3 files>` | 3 files, 330 passed | ✓ PASS |
| Scoped package pins (relief, reliefModifier, scattering, coverage, determinism, codec, toStudioStroke, adapter) | `pnpm --dir packages/efx-watercolor exec vitest run <8 files>` | 8 files, 243 passed, 8 skipped | ✓ PASS |
| Full app suite | `pnpm --dir app exec vitest run` | 9812 passed, 1 failed, 1 skipped, 96 todo (441 files passed of 468 incl. 2 skipped) | ✓ PASS* |
| Known flake isolated | `pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts` | 186 passed, 1 skipped — the single full-suite failure (`removes its one-shot listener…` 20s bounded-wait timeout) passes in isolation; the file has no phase history since 261116-inu | ✓ PASS |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | exit 0 | ✓ PASS |
| Untouchable surfaces | `git diff --exit-code 5c0c7fa7c..HEAD -- shaders.ts mediums.ts mediums.test.ts scattering.ts wetState.ts` | exit 0 | ✓ PASS |

\* The sole full-suite failure is the documented `physicPaintBridge.test.ts` bounded-wait flake named in the SUMMARY for both gap-fix runs (9811 and 9813 pre-flake counts match this run's 9812+1).

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| Erode relation + no-paint pair | `compare.mjs emboss-relief-modifier-erode --relief-modifier …-erode-control` | PASS — 0.0024→0.0001, peak 0.0659→0.0053; film digests equal | ✓ PASS |
| Bristle erode relation + pair | `compare.mjs emboss-relief-modifier-erode-bristle --relief-modifier …-control` | PASS — 0.0081→0, peak 0.225→0.064; film equal | ✓ PASS |
| Deposit relation + pair | `compare.mjs emboss-relief-modifier-deposit --relief-modifier …-control` | PASS — 0.0008→0.2389, peak 0.022→6.6094; film equal | ✓ PASS |
| Pressure p=0.3 vs p=1 | `compare.mjs emboss-relief-modifier-erode-p03 --relief-pressure …-p1` | PASS — reduction ratio 0.7917 | ✓ PASS |
| Pressure none vs p=1 | `compare.mjs emboss-relief-modifier-erode-none --relief-pressure …-p1` | PASS — ratio 0.9167 ≥ 0.9 | ✓ PASS |
| Replay parity erode a/b | `compare.mjs emboss-relief-modifier-erode-a --other …-b` | PASS — 12/12 fields equal | ✓ PASS |
| Replay parity deposit a/b | `compare.mjs emboss-relief-modifier-deposit-a --other …-b` | PASS — 12/12 fields equal | ✓ PASS |
| Identity +15 vs HEAD | `compare.mjs emboss-pos15 --other emboss-pos15-kpy-head` | PASS — 12/12 fields equal | ✓ PASS |
| Identity neutral vs HEAD | `compare.mjs neutral-identity --other neutral-identity-kpy-head` | PASS — 12/12 fields equal | ✓ PASS |

Note: the headless-Chrome probes were not re-driven (no probe/engine file changed since `04ec5c743`); every compare gate was re-executed over the recorded captures in `/tmp/medium-engine/`, whose values match the previous verification exactly.

### Requirements Coverage

The plan declares `requirements: []` (quick task, no ROADMAP requirement IDs). Not applicable; no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in any phase file | — | Debt-marker gate clear |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | ~2594 | `getRecordedAquarellePayload` returns `AquarelleStrokePayload` (whose type declares `relief?`) but its field-by-field projection omits `relief` — a silent `undefined` for any future `stored?.relief` consumer | ℹ️ Info | No behavioral impact today: its one consumer (the fixed fallback) reads `getRecordedAquarelleStroke` instead; noted so the trap is not re-entered |

No stubs and no empty implementations in the changed surface. The previously reported wiring gap is closed.

### Human Verification Required

1. **UNDO (user-retained UAT row)** — Paint an impasto band (Emboss +15), Shift-erode across it, press Cmd+Z once. Expected: the band returns to its pre-stroke relief in ONE step, no half-erased band, no second undo. Why human: the own-touch is present and source-pinned, but no test drives the engine history.

The ten planned artist UAT rows from the plan remain (ERODE, DEPOSIT, PRESSURE, MOUSE, EMBOSS 0, ALT, SETTLE, RE-RENDER, IDENTITY, LATCH) — unchanged, automated-ready. Their surfaces are covered by the probe law and the pins above; the live pass is the artist's.

### Gaps Summary

None. The single previously failed truth (T4) is closed at all three live rebuild seams — the two named in the previous report (`restoreAquarelleRecordTimeline`, `cloneAquarelleStrokeForDuplicate`) and the third instance the executor found afterwards (the in-memory fallback of `aquarelleEventsFromScript`). A full sweep of every `AquarelleStroke` / `AquarelleStrokePayload` construction site found no remaining field-by-field rebuild that omits `relief`; every other site spreads the source stroke or goes through the ONE projection. The new pins drive the real production seams (including a record→restore→duplicate→project round trip and a controller-level fallback run) and would have caught the original bug. All probe gates, the scoped package pins, the app typecheck and the untouchable-surface audit pass; the full app suite passes apart from the documented `physicPaintBridge` timing flake, which passes in isolation. The only remaining item is the undo one-step check, which the user has decided to keep as a live UAT row (recorded as behavior-unverified, not failed).

---

_Verified: 2026-11-23T15:02:53Z_
_Verifier: Claude (gsd-verifier)_
