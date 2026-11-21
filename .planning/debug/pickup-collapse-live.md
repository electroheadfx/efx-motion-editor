---
status: fixed_pending_uat
trigger: "Phase 64 bristle/acrylic: pickup 100% collapses to pickup 0% on the first live paint. Committed blue sheet, then a yellow stroke with Pickup 100 / Refill 0: first live paint is unmixed yellow (reads pickup 0); moving that stroke re-renders it green-ish (pickup 100). The re-bake is the arbiter; the two surfaces must agree."
created: 2026-11-21T00:00:00Z
updated: 2026-11-21T14:00:00Z
---

## Current Focus

hypothesis: "CONFIRMED: the carrier's pickup chain (travel x wet x touch x thirst) samples the engine's own sheet. During the first live paint the committed base exists only as the display-only underlay (setUnderlay), so the sheet under the stroke has wet/cover = 0 -> pickup 0. The re-bake replays the base into its own sheet, so pickup registers. Fixed by making the carrier tap the committed base through the underlay seam."
next_action: "awaiting the user's native visual UAT on the three named surfaces (first live paint / after settle / after move; pickup 100 agrees, pickup 0 stays unmixed). Automated gates green: package suite 833 passed, app tsc clean. Residual mid-stroke rate gap documented below (rim carried hue at dab 100: live 152.7 vs bake 79.1; endpoints agree 213.9 vs 214.5)."
reasoning_checkpoint:
  surfaces:
    - "first live paint (stroke drawn over a committed-only base)"
    - "after settle / post-move re-bake (the arbiter)"
  arbiter: "real-engine probe (packages/efx-watercolor/probe/pickup-collapse/), not the final hue metric alone"
  guardrails:
    - "Do not revert the first-dab travel anchor (c0ab29b2c) or retune the pickup chain."
    - "Do not touch compositing laws, the capture merge, or seed parity."
    - "One change at a time; measure before changing anything."
    - "No dev server; vitest run only; no push."

## Symptoms

expected: "Pickup 100 / Refill 0 over a committed blue base must show the picked-up (green-ish) hue on the FIRST live paint, matching the post-move re-bake. Pickup 0 stays unmixed yellow."
actual: "First live paint is unmixed yellow (effectively pickup 0). After the stroke is moved/re-rendered it becomes green-ish (pickup 100). Both surfaces must agree."
errors: "None reported — silent visual/compositing divergence."
reproduction: "1) Commit a blue sheet. 2) Paint a yellow stroke with Pickup 100 / Refill 0. 3) Observe the first live paint: unmixed yellow. 4) Move that stroke: the re-render is green-ish (pickup 100)."
started: "Not dated by user. Context: commit 14bb73f77 made first paint == re-bake for the compositing law; its UAT did not exercise the pickup path."

## Evidence

- timestamp: 2026-11-21T00:00:00Z (session start) — read skills efx-studio-paint + spike-findings (references/pickup-carrier.md), spike 003 README, commits 14bb73f77 and 9bbd08259, probe harness.
- timestamp: 2026-11-21T00:00:00Z — code reading (Engine.ts setUnderlay/clear/resetSheet; shaders.ts bristleCarrierFS; AquarelleCanvasLayer.tsx syncUnderlay; aquarelleBake.ts; applyAquarelleTimeline/bakeAquarelleEventsToFrame frameCount:1 timed path):
  - `setUnderlay` uploads `underlayTex` used ONLY by the display pass (`uUnderlayOn = target===null && mode===pigment`); `exportCanvas`/`exportCoverageCanvas` never sample it (render-only law).
  - After an Apply/session boundary the Studio resets the live sheet (`resetSheet()` → `engine.resetSheet()` inside `aquarelleScriptReplay` step "reset"); the committed base then exists only in the cache image + underlay. No path replays the script's strokes into the live engine (no renderAllStrokes/renderPartialStrokes caller in app/src outside the bake).
  - The carrier's taps (`canvasAt`, `wetAt`) sample the engine's own ink/fixed/cover/lastTouch. `wet = mean3(exp(-age/wetSeconds) * clamp(cover/0.5))`, `liftGate = smoothstep(0.55,0.85,canvasAlpha/0.5)`; no underlay input.
- timestamp: 2026-11-21T00:00:00Z — MEASURED on the real engine (headless Chrome, packages/efx-watercolor/probe/pickup-collapse, probe extended with `app-live`/`app-bake` arms; same geometry/size 17/pins 16-0/gap 3000 ms in both; only sheet content differs):
  - app-live (committed base ONLY as underlay; sheet reset before the yellow stroke): underlay applied (sheet centre RGB 141,186,240 = blue; centreDarkness 0.447; painted 6.7 %). Yellow (pickup 100/refill 0) per-dab centre/rim: wet 0.000/0.000, cover 0.000, age 604803 s (dry sentinel), pickup 0.0000/0.0000 at EVERY sampled dab (1,5,20,50,100,300); carried hue 50.7/50.8 (unmixed yellow) throughout.
  - app-bake (base blue band in the sheet, replayed cadence): dab 1 wetC 0.424 (age 3.31 s, cover 0.68), rim wet 0.508; later dabs rim pickup up to 0.0422 with carried hue moving 50.8 → 56.9 → 73.8 → 79.1 → 214.5; centre blocked by the own-paint gate (hue 50.7) as spike 003 found.
  - travel/touch/thirst identical in both arms (same dab stream; travelPx 1.09 = 0.0265 BW after dab 1; dab 1 travel 0 anchor intact).
  - CONCLUSION: the differing term is the carrier's WET TAP INPUTS (cover/last-touch): absent in the live surface because the committed base is not in the engine sheet. Chain intact; anchor intact. Hypothesis CONFIRMED.
- timestamp: 2026-11-21T00:00:00Z — probe files changed (scratch only): probe/pickup-collapse/probe.ts (app-live/app-bake scenes, gap param, measureSheetInk), run.mjs (scenes + --gap). Result JSONs /tmp/pickup-collapse/app-live-17.json, app-bake-17.json.
- timestamp: 2026-11-21T14:00:00Z — ROOT CAUSE CONFIRMED (wet tap INPUTS). The fix: the carrier taps the committed base through the same display-only underlay seam the display composites.
  - spectral.ts `pigmentFromDisplayGLSL()` — emitted GLSL block generated from spectralData: sRGB transmittance -> reflectance upsample -> BASIS projection = `pigmentFromHex` applied to the observed colour. Verified offline: recovers a pigment's OWN seven coefficients at depths 0.2..1.0 (direction cos >= 0.99, magnitude 0.92-1.10, display error <= ~0.08 basis round-trip); samePaint gate 0.9996-1.0 (own paint, blocked) vs 0.25 (blue vs yellow, lifts).
  - shaders.ts bristleCarrierFS: `uBaseTap` (unit 11), `uBaseTapOn`, `uBaseTime`; `tapCanvas` reads sheet ink+fixed PLUS the base's coefficients at the DEPOSIT LAW's residual share `1 - clamp(cover/uBodyFloor)` (the fraction a re-bake's sheet would still hold — raw cover saturates at the Body floor, so the display's `1 - cover` would never release the base at a covered core; measured: it left the live core tap at sp 0.757-0.875 while the bake's core read sp 1.000, opening the lift gate live-only and over-dragging). Union cover = sheet cover + baseAlpha*share. `wetAt` (mode 1): union cover via the same share, age = `min(sheetAge, uNow - uBaseTime)` — the base's stamp is the OLDEST memory a session can hold; a sheet age beyond it is cleared-sentinel residue (the touch pass mixes toward uNow, so a rim texel keeps huge negative stamps for many dabs; measured live rim ages 198-500 s vs bake 0.02 s). Every read is gated by uBaseTapOn; uBaseTapOn = 0 in every bake (bakeAquarelleEventsToFrame builds its own adapter engine; no underlay is ever bound there), so the recorded bake arithmetic is untouched — reproduced byte-identically (rim hue 50.8 -> 56.9 -> 73.8 -> 79.1 -> 214.5).
  - Engine.ts: `underlayTimeSec` stamped at setUnderlay on the ONE engine clock (nowSec - ageSeconds), bound with the underlay; engine seam pinned.
- timestamp: 2026-11-21T14:00:00Z — POST-FIX MEASUREMENT (same probe, both arms, pickup 100 / refill 0, gap 3000, size 17, pins 16/0):
  - app-live centre/rim carried hue: 50.7/50.8 (dab 1-5) -> 50.8/59.2 (20) -> 50.7/92.0 (50) -> 53.3/152.7 (100) -> 145.9/213.9 (300). app-bake: 50.7/50.8 -> 50.7/56.9 -> 50.7/73.8 -> 50.7/79.1 -> 55.2/214.5.
  - ENDPOINTS AGREE (live 213.9 vs bake 214.5 rim; both load 1.000); the CORE gate now matches at dabs 20/50 (tap sp 0.999/0.993 vs bake 1.000/1.000 — shut), where before the share fix the live core read sp 0.757 (gate open, over-drag).
  - pickup 0 control: BOTH arms carried hue 50.7/50.8 at every dab (unmixed), load trajectories match (centre 0.903->0.708->0.223; rim 0.913->0.850->0.703->0.265).
  - RESIDUAL (documented, not fixable from the display-only raster): the live sheet starts at the one-week sentinel, so behind the stroke head its cover/last-touch/ink fields re-accumulate at the session's own rate while the bake INHERITS the base stroke's converged fields. Mid-stroke the live rim drags faster than the bake (dab 100: 152.7 vs 79.1; per-dab pickup 0.0274 vs 0.0234; live tap bluer 162.8 vs 119.5). Endpoints and the no-pickup law agree; the gap is bounded and confined to the mid-stroke rate.
- timestamp: 2026-11-21T14:00:00Z — tests: src/playground/underlayTap.test.ts (NEW, 8 tests: the display-manifold inverse against pigmentFromHex, coefficient recovery across palette/depths, samePaint gate, lift gate, emitted-block pins from spectralData, carrier tap structure, engine seam + stamp). Stale pins updated to the union-cover wetAt (scattering.test.ts). Gates: packages/efx-watercolor vitest run 833 passed / 8 skipped / 0 failed; app vitest 9687 passed / 1 flaky unrelated bridge timing test (passes in isolation); app tsc clean.

## Eliminated

- Retuning the pickup chain or the first-dab travel anchor: not implicated — travel/touch/thirst identical across arms before and after.
- The compositing laws / capture merge / seed parity: untouched; the bake path never binds the underlay.
- The tap colour's magnitude as the mid-stroke cause: the base share LAW was the cause (raw-cover saturation); fixed to the deposit residual. E0's recovery error (<=15 % magnitude) is not decisive.
- The gather's wetAt for the smear: deliberately left on the sheet-only read (uBaseTapOn seam is carrier-only this round); live smear stays below the bake's (0.016 vs 0.200 at dab 100) — follow-up if the artist's surface shows it.
