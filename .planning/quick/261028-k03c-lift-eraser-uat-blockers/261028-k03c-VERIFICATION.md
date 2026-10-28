---
phase: quick-261028-k03c
verified: 2026-10-28T18:55:34Z
status: human_needed
score: 4/8 must-haves verified
covered_files: [".planning/quick/261028-k03c-lift-eraser-uat-blockers/261028-k03c-PLAN.md", ".planning/quick/261028-k03c-lift-eraser-uat-blockers/261028-k03c-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx", "app/src/components/physic-paint/engine/aquarelleFootprint.test.ts", "app/src/components/physic-paint/engine/aquarelleFootprint.ts", "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts", "app/src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts", "app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts", "app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts", "app/src/components/physic-paint/roto/aquarelleLiftErase.ts", "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts", "app/src/components/physic-paint/roto/aquarelleLiftPreview.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/view/LiftShapePicker.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts", "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts", "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx", "app/src/components/physic-paint/view/RightPanelBrushTab.tsx", "app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts", "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/panelSplitShell.test.tsx", "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/shaders.ts"]
covered_digest: "v3:sha256:2bd9e5c2148ef93f61c7afecf421ba68ce0ecf159ef8b9402cbd94db93e34682"
behavior_unverified: 4
overrides_applied: 0
behavior_unverified_items:
  - truth: "On a legacy scripted frame whose SNAP v5 durable-base section is empty/absent, a Lift erases visibly, appears in the script, survives leave/return, deleting the Lift event restores the script paint, Apply re-erases it, and pre-script raster paint outside the lift is preserved."
    test: "Open the legacy UAT project on a scripted frame, erase with Lift, then leave/return, delete the Lift event, and Apply."
    expected: "Visible erase plus a Lift event; leave/return and Apply keep the erase; deleting the event restores the script paint; pixels outside the lift are unchanged."
    why_human: "The Studio suite is source-string pins; no test executes the WebGL bake, the base-recovery transaction, or the leave/return path. Requires the native app and the real SNAP v5 project."
  - truth: "When the recovered base fails validation (recomposition mean absolute error > 3/255, or the CR-02 provenance signals trip), the erase refuses with the unknown-base copy, the recorded event is removed, the live sheet session is dropped, and a diagnostic carries the score — a bad base is never adopted."
    test: "Force a failed recovery (navigation/tilted legacy frame with an inconsistent P/S pair) and erase."
    expected: "The unknown-base refusal copy; no Lift event left in the script; sheet dropped; a base-recovery-failed diagnostic with meanError/clampRatio/saturatedColorError; the frame unchanged."
    why_human: "The pure fail-closed gate is unit-tested, but the Studio rollback ordering (event delete -> reset sheet -> revert preview -> publish) is only source-pinned; it needs a live failing recovery."
  - truth: "A raster-only Lift survives leave/return, Studio close/reopen and project close/reopen with Script ON and with Script OFF; the punched key payload (not a stale settle capture) is what a return loads."
    test: "Erase raster-only with Script ON and with Script OFF; leave/return, close/reopen Studio, close/reopen the project."
    expected: "The erased pixels persist in every path; Script ON also records the event, Script OFF is pixels only; no pre-erase pixels resurrect."
    why_human: "The fence, single retry, revision bump and markDirty are source-pinned; no test exercises the native settle-capture race, the durable key write, or a relaunch."
  - truth: "Lift erases in the selected tip's footprint (aspect, rotation, mask) in the live engine, the cached-base preview and the transmittance punch, so Copy/Apply reproduces the erased shape."
    test: "Erase with Filbert, Flat and Round tips (mouse and tilted pen); compare the live erase, the preview and the Copy/Apply result."
    expected: "All three stages show the same silhouette; Apply reproduces the erased shape; a tilted pen changes the fixed-rotation angle consistently."
    why_human: "The punch angle/shape math is unit-tested, but the live WebGL liftFS render and the Copy/Apply visual parity are not exercised by any test."
human_verification:
  - test: "Legacy scripted frame (truth table row 3): erase with Lift on the legacy project's scripted frame; leave and return; delete the Lift event; Apply; inspect pre-script raster paint outside the lift."
    expected: "Visible erase + Lift event; leave/return and Apply keep it; deleting the event restores the script paint; pixels outside the lift untouched."
    why_human: "Native WebGL engine, actual SNAP v5 project and the full Studio transaction cannot run in vitest."
  - test: "Failed recovery (row 4): make the recovered base fail validation and erase."
    expected: "Unknown-base refusal copy, event removed, sheet dropped, base-recovery-failed diagnostic, frame unchanged."
    why_human: "The rollback ordering lives in Studio and needs a real failing recovery."
  - test: "Raster durability (rows 6/7): erase raster-only with Script ON and OFF; leave/return, close/reopen Studio, close/reopen the project."
    expected: "Punched pixels persist; no stale settle capture resurrects the erased pixels; Script ON adds the event, Script OFF stays pixels only."
    why_human: "Persistence across native relaunches is outside the test harness."
  - test: "Cursor truth (D6): pen with tilt and mouse on every tool, all three rotation modes, small and flat tips, select/move modes."
    expected: "Circle / rotated ellipse / rounded rectangle matches the engine footprint; fixed rotation follows the pen-tilt azimuth; crosshair under 8 CSS px; hidden in select/move."
    why_human: "Visual appearance and live interaction are user-observed."
  - test: "Brush tab single state (D2/D3): edit Size, Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed and the eight response multipliers in the sidebar Brush tab, the top bar and the floating modal; use the Lift shape picker in both surfaces; Select lifts."
    expected: "All three surfaces show and write one state; the Lift picker never flips the tool or the Brush selection; Select lifts works."
    why_human: "Interactive UI behavior across surfaces."
  - test: "Tip-shaped erase + Copy/Apply parity: Filbert, Flat and Round; Copy/Apply the script; per-stroke Lift strength."
    expected: "Erased silhouette matches the selected tip in live, preview and Apply; strength is per stroke."
    why_human: "Visual parity of the rendered erase."
  - test: "No regressions: stylus eraser end, Script OFF pixels only, no engine-1, Engine.lift still erases dried pigment."
    expected: "Existing behaviors unchanged."
    why_human: "Native interaction and hardware."
---

# Quick 261028-k03c: Lift eraser UAT blockers Verification Report

**Phase Goal:** Lift eraser — fix the scripted/raster UAT blockers, add the real footprint cursor, restore the sidebar Brush tab, and expose tip shapes for Lift and Brush. Default tip: Filbert.
**Verified:** 2026-10-28T18:55:34Z
**Status:** human_needed
**Re-verification:** No — initial verification
**HEAD verified:** 6d1fa6b9 (commit chain d88aec5f..6d1fa6b9, 12 commits)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Legacy scripted frame: Lift erases visibly, records, survives leave/return, event deletion restores paint, Apply re-erases, outside paint preserved | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `PhysicsPaintStudio.tsx:5924-5972` (recoverBase plan arm), `:6148-6257` (recovery transaction: failRecovery, bake without the new event, validate, adopt, single punch), `:6300-6310` (re-bake after event removal); bake split `physicsPaintRotoPlayScriptController.ts:1851-1912`; inversion + <=3/255 gate `aquarelleBaseRecovery.ts` tested at `aquarelleBaseRecovery.test.ts:79-154, 248-302`. Studio suite is source pins (`PhysicsPaintStudio.test.ts:4440+`) — no test runs the transaction |
| 2 | Failed recovery refuses with unknown-base copy, removes the event, drops the sheet, carries a diagnostic; bad base never adopted | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Pure gate exercised: invalid recomposition rejected `aquarelleBaseRecovery.test.ts:282-302`, provenance rejection `:304-352`; Studio rollback `PhysicsPaintStudio.tsx:6158-6185` (failure memo, delete event, reset sheet, revert preview, publish refusal) + diagnostic `:6165-6177` — only source-pinned by `aquarelleLiftEraseContract.test.ts:387-450` |
| 3 | Raster-only Lift survives leave/return, Studio reopen and project reopen with Script ON and OFF; punched payload is what a return loads | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Capture fence `PhysicsPaintStudio.tsx:7165-7185`; base pinned before await `:6380-6395`, restored on failure `:6413-6417`; single retry `:6409-6412`; post-ack durable write + bump + markDirty `:6433-6442`; contract pins `aquarelleLiftEraseContract.test.ts:283-381, 452+`. No runtime settle-capture/relaunch test |
| 4 | Cursor shows the true footprint size and shape for pen and mouse on every tool, incl. fixed-rotation tilt azimuth; hidden in select/move | ✓ VERIFIED | Law `aquarelleFootprint.ts:118-147`; radius/shape/rotation/preview-pressure/CSS tests `aquarelleFootprint.test.ts:55-201` (16 tests); cursor `AquarelleCanvasLayer.tsx:111-213` (rotated ellipse/rounded rect, `rotate(-angle)`, crosshair under 8 px, hidden on select/move at `:114`); WR-01 repaint `:88, :120, :890, :942`; pins `aquarelleLayerContract.test.ts:320-356` |
| 5 | Sidebar Brush tab restored and shares one state with top bar and floating modal (Size, globals, response multipliers, Lift section) | ✓ VERIFIED | `RightPanelBrushTab.tsx:31-91` (catalog, Size 1..80, `AquarelleGlobalsPanel`, `BrushResponsePanel`, Lift shape, strength 5..90, Select lifts; watercolor gate `:32`); tab union/list/label/arm `PhysicsPaintRightPanel.tsx:121-126, 216-221, 330`; prop threading `:105, :203`; top bar `PhysicsPaintTopBar.tsx:225-260`; single-signal seam `aquarelleRecordState.ts:94, 105, 233-244`; gate tests `physicsPaintRightPanelModuleGate.test.ts`, `PhysicsPaintRightSidebar.test.ts`, `PhysicsPaintTopBar.test.ts` |
| 6 | Filbert default for new Brush and Lift; Lift pick never flips tool nor mutates Brush selection; live, recorded brushId and bake use one tip | ✓ VERIFIED | Defaults `aquarelleRecordState.ts:94, 105`; compare-then-write setter with no tool/brush writes `:233-244`; `aquarelleActiveTipId` `:248-252`; `aquarelleBrushForActiveTool` `:260-272`; snapshot through the one law `:342-359`; behavioral tests `aquarelleLiftTipSelection.test.ts:48-246`; live binding `AquarelleCanvasLayer.tsx:285-293`; recorded brushId `:519-530`; punch reads the recorded brush `aquarelleLiftErase.ts:90-101` |
| 7 | Lift erases in the selected tip's footprint in live engine, cached-base preview and punch, so Copy/Apply reproduces the shape | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `liftFS` `shaders.ts:272-288` (uTip/uTipAspect/uRound/uAxis, tip square crop, envelope kept); `Engine.lift` `Engine.ts:1889-1924`; `brushAngle` `:1550-1557`, sticky azimuth `:1571`, per-dab call `:1726-1737`; dab contract `:49`; layer forwarder `AquarelleCanvasLayer.tsx:507-509`; mount relay `PhysicsPaintCanvasMount.tsx:58, 192`; preview angle `aquarelleLiftPreview.ts:32-37`; punch shape `aquarelleLiftErase.ts:67, 90-101, 161-200, 281-403, 459-485`; cached preview pin `AquarelleCachedBaseLayer.tsx:53, 65-69, 95`. Coverage/angle unit tests exist (`aquarelleLiftErase.test.ts:585+`) but the live WebGL erase and Copy/Apply parity are not exercised |
| 8 | Nothing regresses: per-stroke strength, Select lifts, stylus eraser end, Script OFF pixels only, no engine-1, Engine.lift still erases dried pigment | ✓ VERIFIED | Full suite green (see spot-checks); top-bar strength/select preserved `PhysicsPaintTopBar.tsx:239-260`; stylus eraser end `AquarelleCanvasLayer.tsx:702`; Script ON/OFF plan gate `PhysicsPaintStudio.tsx:5924-5972`; engine-1 remains absent (`PhysicsPaintStudio.test.ts:45, 329, 1038, 1189`); `Engine.lift` keeps the radial envelope times the tip mask with `uRound = 0` (`shaders.ts:269-287`, `Engine.ts:1889-1924`) |

**Score:** 4/8 truths verified (4 present, behavior-unverified)

### Deferred Items

None. This quick is standalone; no later milestone phase is scheduled to absorb any part of its goal.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Lift tip signal/setter, active-tip law, one binding law, Filbert defaults, snapshot through the law | ✓ VERIFIED | 1460+ lines; `aquarelleLiftTipId` `:105`; `setAquarelleLiftTipId` `:233-244`; `aquarelleActiveTipId` `:248-252`; `aquarelleBrushForActiveTool` `:260-272`; `snapshotAquarelleRecord` uses it `:342-359`; `aquarelleSelectedTipId` default `:94`; `bumpAquarelleStrokesRevision` `:458` |
| `app/src/components/physic-paint/view/LiftShapePicker.tsx` | One Lift shape control (thumb + native select over 15 presets) writing only the setter | ✓ VERIFIED | 57 lines; thumb + `<select aria-label="Lift shape">` over `BRUSH_PRESETS`; `onChange -> setAquarelleLiftTipId` `:48`; inline compact row; null-id fallback to filbert `:27`; mounted at `PhysicsPaintTopBar.tsx:230` and `RightPanelBrushTab.tsx:62` |
| `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` | Restored Brush tab: catalog + Size + globals + response panel + Lift shape/strength/Select lifts behind the watercolor gate | ✓ VERIFIED | 91 lines; gate `:32`; catalog, Size 1..80, globals, `BrushResponsePanel`, Lift section `:59-85`; no local state |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | `brush` in union/labels/list (Memory last), brush arm before settings, `onSelectLiftStrokes` | ✓ VERIFIED | Union/labels `:121-126`; list `:216-217`; state `:221`; brush arm `:330`; prop `:105, :203`; Memory last in the list |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | Lift cluster = Shape + Strength + Select lifts; shape reads the Lift signal | ✓ VERIFIED | `physics-lift-controls` `:225`; Shape first `:230`; Strength `:239-253`; Select lifts last `:257` |
| `packages/efx-watercolor/src/playground/shaders.ts` | `liftFS` gains uTip/uTipAspect/uRound/uAxis and tip-mask footprint keeping the radial envelope | ✓ VERIFIED | `:269-288`; rotated tip square, `discard` outside, bilinear tip sample, `exp(-pow(dot(q,q),2.0)) * mix(t,1,uRound)`; IN-07 comment corrected `:269-271`; `uRound = 0` bound by engine |
| `packages/efx-watercolor/src/playground/Engine.ts` | `lift(x,y,r,angle,amount)` binds tip textures/uniforms and reports the dab angle; `case 'lift'` uses `brushAngle` | ✓ VERIFIED | `onLiftDab(...,angle)` `:49`; `brushAngle` `:1550-1557`; sticky azimuth `:1571`; case lift `:1726-1737`; `lift()` `:1889-1924` (tip texture/aspect/axis uniforms + callback) |
| `app/src/components/physic-paint/roto/aquarelleLiftErase.ts` | `LiftDab.angle`, `liftShapeForStroke`, per-dab angles, bilinear `buildLiftCoverage` mirroring liftFS | ✓ VERIFIED | `LIFT_TIP_ROUND` `:67`; shape `:77-101` from the recorded brushId/toolOverrides; `collectLiftDabs` `:161-200` with fixed/follow/random and sticky recorded tilt azimuth; `sampleTipBilinear` `:281`; coverage `:320-403`; punch `:459-485`; angle/coverage tests |
| `app/src/components/physic-paint/engine/aquarelleFootprint.ts` | Shared numeric footprint law + preview pressure + CSS size | ✓ VERIFIED | 178 lines; radius laws `:87-95, 118-147`; rotation incl. live tilt `:103-115`; rounded `:132-145`; `cursorPreviewPressure` `:153-162`; `footprintCssSize` `:170-178`; 16 tests |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | Live binding through the one law; 5-arg dab forwarder; footprint cursor | ✓ VERIFIED | `applyLiveConfig` `:285-293`; record `:519-530`; dab forwarder `:507-509`; cursor `:111-213`; WR-01 version `:88, :120, :890, :942`; pointer tracking `:885-948` |
| `app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts` | Inversion, provenance stats, mean error, fail-closed recovery with injected codec | ✓ VERIFIED | 447 lines; inversion, `inversionConsistencyStats`, `meanAbsoluteChannelError`, `recoverAquarelleDurableBase` (decode -> provenance -> invert -> recombine -> <=3 gate -> encode, per-leg try/catch), default codec via the existing merge/encode seams |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | `bakeAquarelleEventsToFrame` split out and reused by Apply and recovery | ✓ VERIFIED | `:1851-1895`; `applyAquarelleEventsToKey` calls it `:1897-1906` and publishes after disposal |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | recoverBase plan + stroke-end bypass, recovery stage, capture fence, retry, bump + markDirty after every durable write | ✓ VERIFIED | Plan `:5924-5972`; handlers `:5979-5997`; transaction `:6016-6482`; CR-01 guards `:6035-6085`; failure memo `:1480`; recovery `:6148-6257`; non-recover WR-02 `:6258-6285`; raster fence/retry `:6312-6474`; stroke-end bypass `:6500-6533`; fence `:7165-7185`; durable set sites at `:3017, :3195, :6240, :6255, :6276, :6437, :7083` |
| `app/src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts` | Pixel-math round trip, white base, saturation, a~0, clamping, validation accept/reject | ✓ VERIFIED | 447 lines; forward-model round trip `:79-93`; white sheet `:95-107`; saturation `:109-136`; a~0 `:138-145`; clamp `:147-154`; CR-02 provenance `:157-188`; fail-closed gate + IN-09 `:224-447` |

### Key Link Verification

| # | From -> To | Via | Status | Details |
|---|-----------|-----|--------|---------|
| 1 | Record flow -> live binding | `aquarelleBrushForActiveTool` called by `snapshotAquarelleRecord` and `applyLiveConfig` | WIRED | `aquarelleRecordState.ts:354`; `AquarelleCanvasLayer.tsx:292-293`; punch reads the same recorded brush in `aquarelleLiftErase.ts:90-101` |
| 2 | Engine -> punch -> cursor | One `Engine.brushAngle` rotation law | WIRED | Engine `:1550-1557, :1737`; punch `aquarelleLiftErase.ts:188-200`; cursor `aquarelleFootprint.ts:103-115`; tests `aquarelleFootprint.test.ts:134-170`, `aquarelleLiftErase.test.ts:585+` |
| 3 | Recorded brushId -> bake -> punch | `buildBrushForStroke` with the recorded id | WIRED | Record `AquarelleCanvasLayer.tsx:519-530`; shape `aquarelleLiftErase.ts:90-101`; re-bake `PhysicsPaintStudio.tsx:6300-6310` -> `applyAquarelleEventsToKey` -> `bakeAquarelleEventsToFrame` |
| 4 | Engine dab -> preview -> punch | 5-arg `onLiftDab` contract | WIRED | Engine `:1924`; layer `:507-509`; mount `:58, :192`; Studio `:5979-5997`; preview `aquarelleLiftPreview.ts:32-37`; `LiftDab.angle` -> `buildLiftCoverage` |
| 5 | Durable write -> snapshot | `bumpAquarelleStrokesRevision()` before `markDirty()` | WIRED | `PhysicsPaintStudio.tsx:6240-6242, 6255-6257, 6276-6283, 6437-6442`; contract pin `aquarelleLiftEraseContract.test.ts:421-450` |
| 6 | recoverBase plan -> stroke-end guard | Bypasses only `willPinBase`; group/Script-OFF/no-cache refusals untouched | WIRED | `PhysicsPaintStudio.tsx:6516-6527`; plan `:5955-5971`; contract pin `aquarelleLiftEraseContract.test.ts:173` |
| 7 | Capture fence -> target | Keyed by (trackId, frame) while in flight | WIRED | Target set `:6028`, cleared `:6051`; fence `:7168-7185`; only the exact pair skipped; contract tests pin the forwarder |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AquarelleCanvasLayer.tsx` cursor | footprint (radius/aspect/angle/rounded) | live pointer tilt/pressure/type/buttons/move angle + displayed layer rect height through `aquarelleFootprintFor` | Yes | ✓ FLOWING (visual truth is human UAT) |
| `Engine.ts` live lift | dab radius/angle/amount | `processInput` -> `brushAngle(s)` -> `lift()` uniforms -> `onLiftDab` | Yes | ✓ FLOWING (runtime render human UAT) |
| `aquarelleLiftErase.ts` punch | coverage/transmittance | recorded stroke points + recorded brushId `liftShapeForStroke` -> `buildLiftCoverage` -> `punchTransmittanceBytes` | Yes | ✓ FLOWING (unit-tested math; Studio transaction human UAT) |
| `LiftShapePicker.tsx` | `liftTipId` | `aquarelleLiftTipId` signal -> thumb + select -> `setAquarelleLiftTipId` | Yes | ✓ FLOWING |
| `aquarelleBaseRecovery.ts` | recovered base bytes | displayed composite + raw bake -> inversion -> recombine validation -> encode | Yes | ✓ FLOWING (gate unit-tested; Studio recovery human UAT) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 350 files passed / 2 skipped; 6202 tests passed / 1 skipped / 96 todo (includes the viteBuild test) | ✓ PASS |
| Package type/logic check | `pnpm --filter @efxlab/efx-watercolor run check` | exit 0 | ✓ PASS |
| Package build | `pnpm --filter @efxlab/efx-watercolor run build` | exit 0 | ✓ PASS |
| App typecheck | `pnpm --filter efx-motion-editor run typecheck` | exit 0 | ✓ PASS |
| Lift tip selection law | included in the full run (`aquarelleLiftTipSelection.test.ts`) | 20 behavior assertions pass | ✓ PASS |
| Footprint law | included in the full run (`aquarelleFootprint.test.ts`) | 16 tests pass | ✓ PASS |
| Fail-closed base recovery | included in the full run (`aquarelleBaseRecovery.test.ts`) | accept/reject + provenance tests pass | ✓ PASS |
| Studio transaction | — | source-string pins only (`PhysicsPaintStudio.test.ts:4440+`) | ? SKIP — not runnable without native WebGL/Studio |

### Probe Execution

N/A. The quick declares no probes and no `scripts/*/tests/probe-*.sh` files exist for this area; it is not a migration/tooling phase.

### Requirements Coverage

None. `requirements: []` in the PLAN frontmatter; this quick carries no REQUIREMENTS.md ids.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/efx-watercolor/src/playground/shaders.ts` | 269-288 | `liftFS` ignores tip roughness/grain and per-dab angleJitter (declared approximation, IN-08 in REVIEW) | ℹ️ Info | All three erase paths agree with each other; no UAT blocker |
| — | — | No `TBD`/`FIXME`/`XXX` markers in any file changed by this quick | — | Debt-marker gate clean |
| — | — | No placeholder/empty implementations found; the only `return null` occurrences are DOM-capability guards in `aquarelleBaseRecovery.ts` and the watercolor module gate in `RightPanelBrushTab.tsx:32` | — | Clean |

### Human Verification Required

1. **Legacy scripted recovery (truth 1 / row 3)**
   **Test:** On the legacy UAT project, open a scripted frame, select Lift, erase; leave/return; delete the Lift event; Apply; inspect paint outside the lift.
   **Expected:** Visible erase and Lift event; leave/return and Apply keep it; deleting the event restores the script paint; outside pixels untouched.
   **Why human:** Native WebGL engine + real SNAP v5 project; the Studio transaction has no automated exercise.

2. **Failed recovery (truth 2 / row 4)**
   **Test:** Force a recovery that fails validation and erase.
   **Expected:** Unknown-base refusal copy, event removed, sheet dropped, `base-recovery-failed` diagnostic (meanError/clampRatio/saturatedColorError), frame unchanged.
   **Why human:** Rollback ordering is Studio-only.

3. **Raster durability (truth 3 / rows 6-7)**
   **Test:** Erase raster-only with Script ON and OFF; leave/return, close/reopen Studio, close/reopen the project.
   **Expected:** Punched pixels persist everywhere; no pre-erase pixels resurrect; Script ON records the event, Script OFF stays pixels only.
   **Why human:** Native settle-capture race and relaunch persistence.

4. **Cursor truth (truth 4 / D6)**
   **Test:** Pen with tilt and mouse, every tool, fixed/follow/random rotations, small/flat tips, select/move modes.
   **Expected:** Circle / rotated ellipse / rounded rectangle matching the engine footprint; tilt azimuth for fixed rotation; crosshair under 8 CSS px; hidden in select/move.
   **Why human:** Visual appearance.

5. **Brush tab single state (truth 5 / D2-D3)**
   **Test:** Edit Size, Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed and the eight multipliers in the sidebar Brush tab, the top bar and the floating modal; use the Lift shape picker in both surfaces; Select lifts.
   **Expected:** One shared state across all three surfaces; the Lift picker never flips the tool or the Brush selection; Select lifts works.
   **Why human:** Interactive UI.

6. **Tip-shaped erase + Copy/Apply parity (truth 7 / D5)**
   **Test:** Erase with Filbert, Flat and Round (mouse and tilted pen); Copy/Apply the script; change per-stroke Lift strength.
   **Expected:** The live erase, preview and Apply show the same silhouette; strength is per stroke.
   **Why human:** Visual parity.

7. **No regressions (truth 8)**
   **Test:** Stylus eraser end, Script OFF pixels only, no engine-1, `Engine.lift` on dried pigment.
   **Expected:** Existing behavior unchanged.
   **Why human:** Native interaction/hardware.

### Gaps Summary

No gaps. Every must-have is present and wired, all four repository gates are green, and both review criticals (CR-01 navigation guard, CR-02 provenance validation) plus WR-01/WR-02 and IN-01..IN-07, IN-09 are fixed in code with tests. The four behavior-dependent truths are code-complete but only source-pinned at the Studio/WebGL level, so native visual UAT is required before the goal is declared achieved. This matches the user's instruction that native visual UAT belongs to the developer.

---

_Verified: 2026-10-28T18:55:34Z_
_Verifier: Claude (gsd-verifier)_
