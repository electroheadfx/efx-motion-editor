---
status: awaiting_human_verify
trigger: "Body cover rev 4 leaves the canvas in an inconsistent state after sustained painting (Phase 64 / quick 261117-tq7)"
created: 2026-11-18
updated: 2026-11-18
---

# Debug Session: rev4-cover-erase-lost-paint

## Symptoms

- **Expected behavior:** Brush strokes paint the chosen pigment with the approved rev-4 Body-cover behavior; no white bands crossing strokes, no hue shifts (orange → red), stable painting across a long session.
- **Actual behavior:** After sustained painting on one frame, brushes behave erratically. Clean white bands appear crossing existing strokes (look like a stroke that painted paper-white). Fresh strokes come out with hues that do not match the chosen pigment (orange → red). Degradation worsens with session length. Closing/reopening Studio does not restore stable paint. Leaving the frame and returning restores the orange paint (persisted pixels are correct); re-painting reproduces the issue where existing paint displays correctly but the current stroke disappears.
- **Error messages:**
  - `[aquarelle-capture] ink-gate rejected blank sheet frame=0 startFrame=0 op=physic-paint-… globalInk=0 pigmentInk=0 pigmentPixels=0 localInk=0 inkPixels=0 minInk=0.3 minPigmentInk=0.5 minLocalInk=2.5` (repeated, always frame 0)
  - XState `FLUSH_SETTLED` / `FLUSH_BEGIN` unhandled-in-`queued` warnings — triaged as expected by design, NOT the bug.
- **Timeline:** Appears after a while of painting (accumulation-dependent), not immediately. Not tied to a specific action.
- **Reproduction:** Sustained painting on frame 0 of an HD square (1024) document. Starts after several strokes. Studio close/reopen does not clear it; frame leave/return restores persisted paint; restarting the app does not clear the overall corruption.
- **User answers to repro questions:**
  - Onset: only sustained painting (no frame change, Studio reopen, undo, or tool switch required at onset).
  - Persistence: restart keeps it.
  - Document size: HD square (1024).
  - White bands: on fresh strokes only (new strokes erase/white-out; past strokes are displayed correctly).
  - Additional: "Sound like a re-render issue update" (user hypothesis: live display update path, not persisted pixels).

## Context (do not change)

- Branch `gsd/phase-64-medium-engine`, latest commit `d050dff00`.
- Rev-4 cover law is user-approved and must not be redesigned: `f = uAmount * (1 - exp(-uDensity * mask))`, `uDensity` from `coeffsOpacity(pigment.coeffs * amount)`, `COVER_DEPOSIT_GAIN` retired, relief erode linear (`uShape = 0`). See `.planning/quick/261117-tq7-.../261117-tq7-SUMMARY.md` § "Live UAT revisions".

## Ranked Leads

1. **(highest) Cached-base cover punch can erase without a matching capture landing.** On an ordinary key with a cached display, every Brush stroke with Body > 0 returns `kind: 'erase'` from `planAquarelleCoverErase` (PhysicsPaintStudio.tsx:7928-7954). During the gesture `handleAquarelleCoverDab` punches the cached base live (aquarelleCoverGestureDabsRef, PhysicsPaintStudio.tsx:8049-8066), and at stroke end the base is punched again (profile: 'deposit', PhysicsPaintStudio.tsx:8426-8430 and 8466-8470, committed via `captureLivePixels({ liveAlphaCanvas: punchedCover.canvas })`). If the live capture is rejected (blank readback), the cache keeps the punch but never receives the new paint. Repeated strokes drive the base monotonically toward paper-white along past stroke paths. Verify: correlate each rejection with what the base becomes; check whether `coverBase` (findCachedRotoDisplayFrameRef / payload / pinned base) is the same bytes that were punched and whether a rejected `captureLivePixels` still allowed the punch to be committed (PhysicsPaintStudio.tsx:8480-8500).
2. **(high) Why is the live capture blank?** Snapshot taken eagerly (PhysicsPaintStudio.tsx:10260-10263) yet reads zero pigment on frame 0 repeatedly. Check ordering against finalization pipeline: `handleAquarelleCaptureFrame` vs FLUSH_*/queued window, frame-leave clearing the live sheet, and whether the cover punch path's `captureLivePixels` runs before the layer's live snapshot. Rule out stale launchContext/startFrame mismatch (frame=0 startFrame=0).
3. **(medium) preInk can be silently reused instead of re-armed.** `armInkCover()` returns early when `preInk !== null` (Engine.ts:2396-2401). A missed `dropPreInk()` leaves a stale pre-stroke snapshot → negative ink → over-bright/erratic colours and erasure without matching paint. Harden: make `armInkCover` self-healing (`dropPreInk();` allocate+copy unconditionally at stroke start) + regression pin.
4. **(medium) CoverPass erases fixed without excluding the current stroke's own paint.** Mobile path excludes own paint via preInk; settled path does not. If a settle/drain moves the in-progress stroke's ink into fixed while a stroke is active, later dabs erase the stroke's own paint (pale/white bands along the stroke). Check whether the settle pass can run with `this.stroke !== null`, and whether `travel()`/`cancelAutoFix()` can interleave.
5. **(medium) GPU memory churn.** `preInk` is a full-document 2×RGBA16F target allocated/disposed per stroke (~19 MB at 1100², ~67 MB at 2048²). Erratic colours, blank readbacks and white patches are classic WebGL context-loss/texture-eviction symptoms. Check for `webglcontextlost` handling; consider a session-reusable preInk target (re-blit per stroke).

## Ruled Out

- Gesture dabs do not leak across strokes: `aquarelleLiftGestureDabsRef` / `aquarelleCoverGestureDabsRef` are spliced at every stroke end (PhysicsPaintStudio.tsx:9242-9260).
- XState `FLUSH_*` warnings — queued deliberately ignores flush events (finalizationMachine.ts `queued` comments); unhandled-event warnings only.
- The rev-4 cover law itself — user-approved.
- WebGL context loss as the blank-readback cause — an all-zero ink measurement is uniform WHITE (an empty sheet); a lost context reads black or unmeasurable.
- Leads 4 and 5 were not exercised: the reported symptoms are fully explained by the footprint/blank-commit/stale-snapshot findings below.

## Green Baseline To Preserve

- `packages/efx-watercolor`: `npx vitest run` → 561 passed / 8 skipped.
- app cover/seam tests (`aquarelleCoverSeamContract`, `aquarelleLiftCoverageDeposit`, `aquarelleLiftPreview`, `aquarelleLiftEraseContract`) → 51 passed (now 51 + the new parity suite).
- Probe: neutral-identity PASS 6/6 byte-equal; cover-over-wet invariants pass at Body 100/85/70/50.
- Pre-existing unrelated app failures: `viteBuild.test.ts` + `engine/aquarelleLayerContract.test.ts` (stale displayFS literals), `view/mediumSelection.test.ts` + `view/AquarelleGlobalsPanel.test.ts` (expect acrylic body 90, record is 85), `lib/physicPaintBridge.test.ts` (bounded-wait timeout).

## Current Focus

- **hypothesis (ROUND 2 — PROVEN IN CODE):** The cover commit SUCCEEDS (persistence is correct — frame leave/return restores the stroke, no ink-gate or cover-failure logs). The defect is the POST-ACK DISPLAY SWAP: after `captureLivePixels` commits the merged composite (punched base + this stroke's sheet, `mergeBlend: 'pigment-alpha'`), the cover branch calls `aquarelleResetSheetRef.current?.()` (wiping the live sheet, the stroke's only on-screen pigment at that instant) and then `loadCachedRotoReferenceFrame(..., true, generation, punchedCover.bytes)` — publishing the PUNCHED BASE ALONE as the display URL. The punched base is exactly the underlayer REMOVED along the footprint (the Lift's correct end state, which adds no pigment), so the post-release display is paper-white along the stroke until a frame reload reads the correct committed payload. During the drag the live sheet still carries the stroke, so it looks correct until release.
- **next_action:** LIVE UAT — paint a Body>0 brush stroke on a cooked key: the stroke must stay visible after release (not turn paper-white), leaving/returning the frame must show the same image, and a second stroke over it must cover, not erase, the first. Then run the remaining rev-4 cover UAT rows.
- **reasoning_checkpoint:** Round 1's footprint/blank-guard/self-healing work is kept. Round 2 could not be an ordering or blank-sheet defect: `aquarelleSnapshotRef` resolves `engine.exportCanvas('transparent')`, which allocates a FRESH canvas (`Engine.ts:1112-1137`) — the eager snapshot is a deep copy taken before the flush, and the UAT console shows no ink-gate rejections. The fail-closed/revert path was also not hit (no failure copy was published). The only remaining writer of the displayed base URL is the loader's `setReferenceUrl`, and the cover branch supplied the punched base there.

## Evidence

- 2026-11-18: User repro answers — sustained painting only, HD 1024, restart keeps it, white bands on fresh strokes, frame leave/return restores persisted orange paint, Studio reopen does not stabilize.
- 2026-11-18: Screenshots show navy strokes with a white band crossing them, and an orange stroke over blue with hue mixing.
- 2026-11-18 (new): With tip texture enabled, a fresh green stroke carries a WRONG WHITE BORDER / outline around its own footprint, and white gaps appear between adjacent brown strokes. This is consistent with the cover punch erasing outside/around the deposit footprint (rim/edge erase) rather than only along it — relevant to the soft-rim cover mask and the deposit-footprint erode from commits d67db6cda / b4681de85.
- 2026-11-18 (code, decisive): `liftShapeForStroke()` forces `textureId: null` (`aquarelleLiftErase.ts:96-99`, a Lift law) while the engine's cover binds the ACTIVE textured brush (`Engine.bindFootprint` from `this.brush`; the live brush carries `textureId` + library `textureRotation`, `AquarelleCanvasLayer.tsx:335-346`). The cover preview (`AquarelleCachedBaseLayer.tsx:106`) and the stroke-end punch (`PhysicsPaintStudio.tsx:8369`, visible AND durable base) BOTH resolved through `liftShapeForStroke` for the `deposit` profile.
- 2026-11-18 (code): the deposit profile sampled the RAW unrotated tip — no `uTipRotation`, no `uJitter`, no `th = uRough * 0.45` re-threshold / wide ramp `smoothstep(th, th + 0.5, t)`, no soft square-rim fade `1 - smoothstep(0.82, 1, max(|q|))` (`shaders.ts` FOOTPRINT_MASK:336-370).
- 2026-11-18 (code): `captureLivePixels` merges the live sheet over the punched base with NO blank guard, so an ink-gate-rejected (uniform white, all-zero ink) sheet commits the erased base alone — the "current stroke disappears while its removal stays" report. The durable punch also persists, explaining "restart keeps it".
- 2026-11-18 (code): `armInkCover()` returned early on a non-null `preInk`; `inkCover` subtracts `f * pre` from the live ink, so a stale snapshot subtracts another stroke's density and drives coefficients negative (hue shifts / vanished paint).
- 2026-11-18 (UAT round 1, FAILED — decisive): After c1fdd45e0, a new stroke renders correctly DURING the drag and becomes paper-white only AFTER release. The paint is correct in persistence: leaving the frame and returning restores the stroke. Console at release shows only the launch-context log and the FLUSH_BEGIN/FLUSH_SETTLED warnings — NO `[aquarelle-capture] ink-gate rejected blank sheet` lines and NO `cover-blank-live-sheet` failure. Document is 1080×1080 (not 1024), startFrame 0. (Round-1 reading — SUPERSEDED by the round-2 code proof below: the guard did not refuse; the commit succeeded and the display was swapped to the punched base alone.)
- 2026-11-18 (ROUND 2 code proof — decisive): the fail-closed guard is NOT what UAT round 2 hit — the commit SUCCEEDS (hence no failure copy and no ink-gate log; persistence is correct). After the ack the cover branch resets the sheet (`PhysicsPaintStudio.tsx:8567`) and publishes `punchedCover.bytes` as the display's explicit bytes (`:8573-8580`). `punchedCover` is the underlayer with paint REMOVED along the footprint (`punchTransmittanceBytes(coverBase.bytes, ...)`), so with the sheet wiped the stroke has no on-screen source: paper-white. The loader's `setReferenceUrl(paintBytes)` (`useRotoReferenceController.ts:165,230`) is the only writer of the displayed base URL; the plain-refresh guard (`:202-215`) then pins that explicit URL (it refuses later plain reloads for the same frame), which is why the frame stays white until navigation reloads the committed payload.
- 2026-11-18 (ROUND 2 ordering refutation): `aquarelleSnapshotRef` is `() => engine.exportCanvas('transparent')` (`AquarelleCanvasLayer.tsx:814-820`); `Engine.exportCanvas` builds a NEW canvas from a fresh readback (`Engine.ts:1112-1137`). The stroke-end `sheet` is therefore a deep copy taken eagerly BEFORE the `flushLivePixels` await — FLUSH_BEGIN/FLUSH_SETTLED cannot empty it. The cover branch's blank-sheet gate reads that copy and passed (no rejections in the console), and the flushed payload is correct (frame leave/return).

## Eliminated

- hypothesis: Gesture dabs leak across strokes.
  - reason: Dabs are spliced at every stroke end (PhysicsPaintStudio.tsx:9242-9260).
- hypothesis: FLUSH_* event warnings cause the corruption.
  - reason: Deliberate no-transition handling in `queued` state; warnings only.
- hypothesis: Persisted document pixels are corrupted first.
  - reason: Frame leave/return restores the orange paint from persistence.
- hypothesis: GPU context loss explains the blank readbacks.
  - reason: All-zero ink is uniform white (empty sheet); a lost context reads black/unmeasurable.
- hypothesis (round 2): the release-time flush empties the live sheet before the stroke-end capture, so the gate refuses and the display keeps the punch.
  - reason: `aquarelleSnapshotRef` returns `engine.exportCanvas('transparent')`, which allocates a fresh canvas from a fresh readback — the eager `sheet` is a deep copy taken before the `flushLivePixels` await, and the UAT console shows the gate passing (no rejections) with correct persistence.
- hypothesis (round 2): `revertAquarelleLiftPreview()` fails to un-punch the displayed base after a fail-closed cover.
  - reason: not the path taken in UAT round 2 — no cover-failure copy was published (the commit succeeded). The revert arm itself restores the pre-gesture snapshot into the decoded transmittance and repaints the full canvas (`AquarelleCachedBaseLayer.tsx:130-148`).
- hypothesis (round 2): `captureLivePixels` merges in the wrong order (punched base wins over the stroke).
  - reason: the committed payload is correct — frame leave/return restores the stroke from it. The merge draws `baseCanvas` first, then the sheet's pigment over it (`physicsPaintRotoAlphaMerge.ts:37-70`).

## Resolution

- root_cause (ROUND 1 — PARTIAL, superseded by UAT round 1 failure): The Body cover's cached-base punch resolved its footprint through `liftShapeForStroke`, which hard-excludes textures (a Lift law). Every Body > 0 brush stroke erased the cached and durable bases with the neutral procedural tip while the engine deposited through the active TEXTURE mask, and the punch dropped the shader's texture rotation, dry re-threshold/wide ramp, per-dab jitter and soft square-rim fade. Two compounding defects: a blank live sheet could be committed over the punched base (underlayer erased, stroke missing — the ink-gate warnings), and `armInkCover`'s early return could reuse a stale `preInk` snapshot.
- fix (ROUND 1 — landed in c1fdd45e0, KEPT): `coverShapeForBrush` resolves the deposit footprint (texture + recorded rotation + roughness/stampJitter); the `deposit` profile mirrors `footprintMask()`; the cover fails CLOSED on a blank live sheet (`cover-blank-live-sheet`); `Engine.armInkCover` is self-healing.
- verification (ROUND 1): package 561/8 skipped, app physic-paint 6944 passed with only the 5 pre-existing failures, parity suite 13/13. **Live UAT FAILED** — see Evidence 2026-11-18 UAT round 1: white now appears only after release, display-only, persistence correct. Round 2 must find why the release-time live sheet lacks the stroke's pigment and why the fail-closed path leaves the displayed base punched.

- root_cause (ROUND 2 — CONFIRMED IN CODE, awaiting live UAT): the cover's post-acknowledgement display swap published the PUNCHED BASE ALONE. `runAquarelleLiftErase`'s cover branch commits the merged composite (punched base + this stroke's live sheet) to persistence, then `aquarelleResetSheetRef.current?.()` wipes the live sheet (the stroke's only remaining on-screen pigment) and `loadCachedRotoReferenceFrame(..., punchedCover.bytes)` publishes the underlayer-with-paint-removed as the displayed `AquarelleCachedBaseLayer` URL. The result is exactly the UAT observation: correct during the drag (live sheet), paper-white after release (punched base, stroke gone from the display), correct after frame leave/return (committed payload). Round 1's fail-closed guard was not involved — the commit succeeded, hence no `cover-blank-live-sheet` and no ink-gate log. FLUSH ordering is not implicated: the eager `sheet` is a deep copy (`exportCanvas` allocates a fresh canvas) taken before the flush.
- fix (ROUND 2): the capture's produce step now hands its exact encoded frame to the caller (`captureLivePixels` gains an optional `onProduced` seam), and the cover's post-ack display swap publishes those COMMITTED bytes (`coverProduced.bytes`) instead of `punchedCover.bytes`. A null (produce never ran) falls back to the just-committed payload lookup in the loader, never to the underlayer-only punch. RED-first pin added to `aquarelleCoverSeamContract.test.ts` ("publishes the committed composite to the display, never the punched base alone").
- verification (ROUND 2, automated): new pin RED at HEAD then GREEN; cover/lift/coordinator suites 89/89; app physic-paint 6945 passed with only the same 5 documented pre-existing failures; `packages/efx-watercolor` 561 passed / 8 skipped; app tsc clean. Live UAT pending (status awaiting_human_verify).


- files_changed (ROUND 1):
  - `app/src/components/physic-paint/roto/aquarelleLiftErase.ts`
  - `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
  - `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx`
  - `app/src/components/physic-paint/view/aquarelleRecordState.ts`
  - `packages/efx-watercolor/src/playground/Engine.ts`
  - `app/src/components/physic-paint/roto/aquarelleCoverFootprintParity.test.ts` (new)
  - `app/src/components/physic-paint/roto/aquarelleLiftCoverageDeposit.test.ts`
  - `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts`
  - `packages/efx-watercolor/src/playground/coverage.test.ts`
- files_changed (ROUND 2):
  - `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (cover display swap publishes the produced committed bytes)
  - `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` (`onProduced` seam in `captureLivePixels`)
  - `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts` (RED-first display pin)
