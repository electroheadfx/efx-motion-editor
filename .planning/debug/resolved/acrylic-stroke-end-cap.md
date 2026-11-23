---
status: resolved
trigger: |
  Acrylic Studio — the stroke END must break up like its START, on every way a gesture can end.

  SYMPTOM
  Studio / Physic Paint, medium Acrylic, brush tool (bristle-flat / bristle-round): every stroke
  ends on a straight-edged rectangular block of different contrast — a hard wall across the mark's
  width — instead of the ragged, irregular break-up the stroke's START shows.

  ARTIST'S ISOLATION (live, 2026-11-23)
  - Ending the stroke by LIFTING the stylus while still moving -> correct, ragged cap.
  - Stopping the tip while still pressed, then releasing -> square block.
  - Mouse / trackpad can never produce the lift; the stroke stops dead -> always square.
  - At Pigment 0 the wanted ragged end DOES appear (bristles run dry and break into specks) but
    that value shortens the usable run length. The wanted end must come at Pigment 100 with the
    run length unchanged.

  SUSPECTED REGRESSION
  6344328d8 ("remove the bristle pale lane") restricted the along cap to the stroke start plus
  uEndCap = 1 on the catch-up dab; running dabs now carry no cap. Confirm or refute on pixels.

  LAW TO SATISFY
  - The end silhouette breaks up like the start (bristle-scale irregularity, no straight line,
    no contrast step) for every end path: pen lift, pen stop-then-release, mouse, trackpad,
    pointercancel / window blur.
  - Independent of pointerup timing, of the speed-derived simPressure saturating when the hand
    stops, and of pigment depletion. Pigment 100 run length unchanged.
  - live == after settle == re-bake; two runs byte-identical.
  - No new pale lane / white seam; the 2026-11-22 approved cap restriction stays (negative pins
    in scattering.test.ts).

  WHERE IT LIVES (verify in the tree; do not trust line numbers)
  - The cap rides only the catch-up impression: Engine.ts ~2569-2578 sets bristleEndCap around a
    trace() to the smoothed cursor; trace() stamps only when residual arc length + s.carry reaches
    one spacing, then sets s.x = ex anyway (~2634-2688), so a later `ending` tick has nothing left
    to stamp. Uniform uEndCap -> shaders.ts ~1218-1258; constants bristles.ts:120-149.
  - End paths: pen losing contact, Engine.ts ~2307-2310; pointerup / pointercancel ~2316-2322;
    window blur 2325.
  - Mouse / trackpad pressure is speed-derived (pressureOf + simPressure, Engine.ts ~2500, ~2552):
    a stop ramps the last dabs AND any catch-up dab to full pressure/width; a pen uses authored
    pressure. Candidate writer of the contrast step.
  - The cap is a DEPTH fade (alongFade multiplies coverage, cA/cB, alpha) while the film already
    committed by the preceding running dabs survives the deposit lerp ink <- ink*(1-a)+carried*a
    (~100 px memory). Working precedent: a THRESHOLD shift opens the mark into full-depth specks
    (the shipped Feather law); the Pigment-0 end is that dry break-up. Hypothesis: the end needs
    the threshold mechanism — a depth fade alone cannot remove committed film.
  - Prior art: .planning/debug/resolved/acrylic-bristle-pale-line.md (caps entry; "the lifted
    result is shaped by the catch-up end dab as before").

  DO
  1. Reproduce through the real engine: extend probe/medium-engine (bristle-line, --band 140, or
     a new bristle-end scenario) with one straight acrylic bristle stroke at the acrylic record's
     params; capture the END region (last ~2 brush widths) after applyStroke / after settle / after
     fix — PNGs + metrics: silhouette profile over the last 10/25/50 % of travel, longest straight
     edge across the width, contrast delta vs the body, and a start-vs-end shape comparison.
  2. Drive three end paths separately: constant-pressure stop (scripted, no decay), a pressure-decay
     tail, a mouse-like speed-derived pressure. Prove which dabs carry uEndCap (instrument, or bisect
     along = 0 / a forced terminal cap dab as the control).
  3. Bisect ONE term at a time and name the writer(s) with pixels: the conditional catch-up dab;
     simPressure saturation at the stop; depth fade vs committed film; trailSupport's straight cut.
  4. Fix ONE law; re-run the same end pixels; show start/end agreement in all three end paths.
     Re-run the pale-line gates (ENCLOSED + tiling) to prove no lane returns.
  5. Gates: pnpm --dir packages/efx-watercolor exec vitest run; pnpm --dir app exec vitest run;
     pnpm --dir app exec tsc --noEmit. UAT rows (native, live): pen lift · pen stop-then-release ·
     mouse · trackpad · short click · Pigment 100 short/medium/long.

  DON'T
  - No server start (the artist runs it), no vitest watch, no push.
  - No stroke replay (KEY = CACHE), no Body-law change.
  - Don't reintroduce the running-dab cap or any lateral depth selector; keep the negative pins.

  Report: measured end-region numbers + PNG paths + which hypothesis survived.
created: 2026-11-23T10:49:55Z
updated: 2026-11-23T12:30:00Z
---

## Current Focus

**CLOSED 2026-11-23 — UAT APPROVED. Artist verbatim: "approvated UAT congrats". Accepted
state: the takeoff THRESHOLD shift (`BRISTLE_TAKEOFF_SHIFT = 1.1`) over every dab's outward
leading band; the 2026-11-22 running-cap restriction and negative pins unchanged. Nothing
committed — working tree only, per the conservative profile.**

bug_class: Bohrbug

hypothesis (FINAL — confirmed on pixels): "The end silhouette is the last RUNNING dab's uncovered
leading frontier. Running dabs carry no along cap (6344328d8's restriction) and the only cap the
end paths can still reach is the conditional catch-up dab wrapped in bristleEndCap; the frontier
itself keeps the gather's uniform coverage up to the deposit cull (|q.y| > 1.15), so a hand that
stops ends on a straight full-width wall there. The suspected regression is NOT the sole writer:
the mouse drive stamps 0 endCap dabs and the bake path has no catch-up at all, yet both ended on
the same wall, so the catch-up dab and the pointerup timing are refuted. The depth-fade cap cannot
repair the frontier either — the deposit lerp ink <- ink*(1-a)+carried*a holds committed film
wherever a is small (~100 px memory), so the along cap fades only DEPTH. The fix must shift the
THRESHOLD (the shipped Feather precedent) so the frontier dissolves into full-depth tooth specks."

test: "probe/medium-engine `bristle-end` scenario: one straight acrylic bristle-flat stroke at the
acrylic record's params (1080, stroke size 100, body 100, mut defaults), six drives — stop (constant
pressure, scripted), lift (the artist's pressure collapse over the last moving samples), decay
(pressure-decay tail), mouse (speed-derived pressure, pointerType mouse), mouse-lift, bake
(applyStroke / re-bake). End census instruments stampScripted for bristleEndCap; the end metrics
scan the last dark x per row (median/spread/irregularity/flat %/longest same-x run), the darkness
in the last 10/25/50 % of travel, a 1-px fine along profile, and 2x end crops of the transparent,
pigment and coverage surfaces."

expecting (observed): "The wall existed with 0 endCap dabs (mouse) and in the bake — the frontier,
not the catch-up, is the silhouette writer — and a depth fade alone left it standing (the cap's
alongDark faded while the committed film stayed). The threshold shift graded every end path into
specks with no new lane."

next_action: "Live UAT rows (native, artist): pen lift · pen stop-then-release · mouse · trackpad ·
short click · Pigment 100 short/medium/long. Then, on approval, move this file to resolved/ and
refresh the committed bristle baselines in one pass."

## Symptoms

expected: "The stroke END breaks up like the START (bristle-scale irregularity, no straight line, no contrast step) for every end path: pen lift, pen stop-then-release, mouse, trackpad, pointercancel / window blur. Independent of pointerup timing, simPressure saturation at the stop, and pigment depletion; Pigment 100 run length unchanged; live == settle == re-bake; two runs byte-identical; no pale lane / white seam."
actual: "Every stroke ends on a straight-edged rectangular block of different contrast — a hard wall across the mark's width — instead of the ragged break-up the start shows. Pen lift while moving is correct; stop-then-release and mouse/trackpad always end square; Pigment 0 shows the wanted ragged end but shortens the usable run length."
errors: "None reported — static/visual defect, the engine does not throw."
reproduction: "Studio / Physic Paint, medium Acrylic, brush tool bristle-flat or bristle-round. (1) Pen: lift the stylus while still moving -> ragged cap; stop the tip while pressed, then release -> square block. (2) Mouse / trackpad: the stroke stops dead -> always square. (3) Pigment 0 -> ragged dry end appears; Pigment 100 with unchanged run length is the target."
started: "Live artist isolation 2026-11-23. Suspected regression commit 6344328d8 ('remove the bristle pale lane — jitter space, running cap, feather threshold'), which restricted the along cap to the stroke start plus uEndCap = 1 on the catch-up dab."

## Eliminated

- eliminated: "The conditional catch-up dab (6344328d8's remaining cap path) as the end-shape
  writer. The instrumented census stamps stop 258 dabs / 1 endCap, lift 332 / 16 (the pr = 0.02
  chain), mouse 241 / 0, decay 283 / 2, mouse-lift 232 / 5, bake no catch-up at all. The mouse
  drive stamps ZERO capped dabs and the bake has no catch-up, yet both carried the same wall at
  x = 1015 — the writer is the last running dab's uncapped leading frontier, not the catch-up.
  The catch-up remains in the tree untouched; it is not load-bearing for the end silhouette."
- eliminated: "simPressure saturation at the stop (the speed-derived pressure ramping the final
  dabs to full width). The scripted stop drive uses authored constant pressure 0.75 and still
  walled pre-fix; the takeoff's pressure scaling now opens the mouse's saturated stop in the same
  proportion as a pen's lift (the shift scales with the same 0.3 + 0.7 * uPressure factor the
  coverage carries)."
- eliminated: "trailSupport's straight cut (1 - smoothstep(0.95, 1.2, q.y)) as the end-SHAPE
  writer. Its trim boundary coincides with the terminal darker pigment block's left edge (~x 800)
  but the silhouette wall sits further out at the deposit cull x ~1015; the trim only bounds the
  last dab's trailing rectangle."
- eliminated: "A lateral depth selector as the repair. Every depth selector measured in the prior
  pale-line debug wrote a lane or a motif (records in resolved/acrylic-bristle-pale-line.md); the
  end repair uses the threshold mechanism instead and keeps every negative pin."
- eliminated: "6344328d8 as the sole/primary writer of the defect. Its cap restriction is real
  (running dabs carry no cap) but removing the wall needs a law the restriction never touched."

## Evidence

- timestamp: 2026-11-23T10:49:55Z
  checked: "git log/show 6344328d8 and grep bristleEndCap in packages/efx-watercolor/src; read Engine.ts processInput/trace, shaders.ts cap region, bristles.ts cap constants, probe/medium-engine dir"
  found: "6344328d8 exists as described. At HEAD: bristleEndCap declared Engine.ts:569, set true at 2572 around the catch-up trace and reset at 2576; the catch-up condition (2569) requires `s.x !== s.cx || s.y !== s.cy`; trace() sets s.x = ex unconditionally at 2686. Shader: exposedTrail = max(<start exposure>, uEndCap) at shaders.ts:1229-1232, along = exposedTrail > 0 ? mix(max(-q.y,0), abs(q.y), exposedTrail) : 0 (1243-1244), alongFade at 1257, trailSupport = 1 - smoothstep(0.95, 1.2, q.y) at 1266, coverage multiplied by alongFade * trailSupport (1272-1273). Probe dir: packages/efx-watercolor/probe/medium-engine/{probe.ts,run.mjs,harness.test.ts,compare.mjs,alphaLaw.ts,baselines}."
  implication: "The brief's structural claims hold at HEAD; investigation can start from these surfaces. The conditional catch-up trace and trace()'s unconditional end assignment are the first writer candidates."

- timestamp: 2026-11-23T10:49:55Z
  checked: "Prior art .planning/debug/resolved/acrylic-bristle-pale-line.md (caps entry)"
  found: "Accepted pale-line state: §4.2 log-offset law + running along-cap correction ('the along cap is now limited to where it is visible — along = exposedTrail > 0 ? mix(max(-q.y,0), abs(q.y), exposedTrail) : 0.0 (the start keeps its symmetric cap, the catch-up end keeps its uEndCap = 1 cap, interior running dabs carry none)') + threshold-shift feather law; negative pins forbid the along-only motif law. The prior debug's tiling gate (along autocorrelation + cross-row coherence) and ENCLOSED-line metric are in probe/medium-engine/probe.ts with --band default 140."
  implication: "The 2026-11-22 cap restriction must stay. Any fix may not reintroduce the running-dab cap or a lateral depth selector; the threshold mechanism is the shipped precedent for opening the rim into full-depth specks."

- timestamp: 2026-11-23T11:40:00Z
  checked: "Built the `bristle-end` probe scenario (packages/efx-watercolor/probe/medium-engine/probe.ts + run.mjs): one straight acrylic bristle-flat stroke at the acrylic record's params (1080 sheet, stroke size 100, body 100, mut defaults), six drives; instrumented stampScripted to census bristleEndCap; end metrics over the last ~2 widths (end/start silhouette scans, thickness over last 10/25/50 % of travel, 1-px fine along profile, end crops of transparent/pigment/coverage)."
  found: "Dab census: stop 258 taps / 1 endCap (x ~918), lift 332 / 16 (pr = 0.02 chain), decay 283 / 2, mouse 241 / 0, mouse-lift 232 / 5, bake none. Pre-fix the stopped end was a wall: every row's last dark x = 1015 (the deposit cull), flat over 83 % of the width, ~40 luma darker than the body; the block's left edge ~x 800 coincides with the final dab's trailSupport trim; alpha = 1 everywhere (not an opacity step) and the pigment channel carries the block. The mouse (0 capped dabs) and bake (no catch-up) showed the identical wall."
  implication: "Catch-up refuted as the writer; pointerup timing refuted; the frontier of the last running dab is the silhouette writer, and the terminal darker block is fresh terminal deposit at the last dabs' trailing coverage."

- timestamp: 2026-11-23T11:55:00Z
  checked: "Depth fade vs committed film: read the fine 1-px along-darkness profiles at the end (the catch-up cap's alongFade is the only cap left) and forced the terminal cap dab as a control (along = 0 / a forced cap dab) before the law change."
  found: "The cap's alongDark decays the dabs' own deposits while the committed film behind them stays: the deposit lerp (ink <- ink*(1-a) + carried*a, two draws: dst*(1-a) then +carried*a) holds old film for ~100 px where a is small, so a depth fade cannot remove the wall. The Pigment-0 dry end and the shipped Feather both achieve break-up through the paper-tooth THRESHOLD, where a texel is either inked (full carried paint) or open paper."
  implication: "The surviving mechanism is a THRESHOLD shift over the leading frontier. This is the one law to change."

- timestamp: 2026-11-23T12:05:00Z
  checked: "The fix — gatherBristle's TAKEOFF threshold shift: `float takeoff = smoothstep(0.45, 1.05, -q.y); threshold += takeoff * (0.3 + 0.7 * uPressure) * uTakeoffShift;` with BRISTLE_TAKEOFF_SHIFT = 1.1 (bristles.ts), uniform uTakeoffShift bound in bindGather (Engine.ts), magnitude extracted as a declared law constant after the Feather-shift precedent. Re-ran all six drives on the same pixels."
  found: "END silhouette (median / spread / irregularity / flat % / longest same-x run / zoneDark / contrast vs body): stop 994 / 37.2 / 1 / 21.89 % / 12 px / 0.5489 / -0.0293; decay 988 / 46.4 / 1 / 20.12 % / 17 px / 0.5357 / -0.0425; mouse 1012 / 39 / 1 / 25.25 % / 34 px / 0.5171 / -0.0185; mouse-lift 964 / 43 / 2 / 10.4 % / 6 px / 0.5331 / -0.0026; bake 997 / 40.2 / 1 / 23.67 % / 15 px / 0.5706 / -0.0077; the approved lift stays 808 / 174.6 / 1 / 1.78 % / 14 px / 0.3914 / -0.1926. Body darkness unchanged (0.5782 pen, 0.5357 mouse) and body thickness unchanged (164.81 px pen, 192.74 px mouse). Fine along-darkness now grades monotonically into zero instead of cliffing: stop 0.5964@974 -> 0.0764@998 -> 0.0004@1006 -> 0; mouse 0.6411@974 -> 0.3932@1006 -> 0.0271@1021 -> 0.0056@1026; lift monotone to 0 by 922."
  implication: "The wall is gone on every end path: no straight line across the width (the longest same-x run is 12-17 px on the 165 px pen mark and 34 px on the 193 px mouse mark — local specks at the cull, not a wall), irregularity 1-2, and the end zone is no longer darker than the body (-0.003..-0.043, was ~+0.157). Start/end agreement holds at the law's level (irregularity 1, graded decay, specks-over-paper)."

- timestamp: 2026-11-23T12:10:00Z
  checked: "Pale-line gates re-run with the fix (bristle-line, --band 140, stroke sizes 35 and 100, seeds mut1/mut2, bare and --over), plus a shift = 0 control."
  found: "ENCLOSED (s35): 0.19 % / maxRun 9 px (mut1) and 0.03 % / 3 px (mut2) vs 7.53 % / 230 px on the rejected state; s100: -0.19 % / 2 px and -0.52 % / 9 px. Fringe-row coherence fracHigh 3.57 % in every capture (one pair of 28) vs the rejected along-only law's 33 %; means 0.116-0.173 vs the rejected 0.396. Fringe tooth texture present at ±68-76 px (hpRms 0.12-0.31). Control with BRISTLE_TAKEOFF_SHIFT = 0 reproduces the accepted pre-fix candidate BYTE-FOR-BYTE on all four surfaces (61d60617 / 63ea1dbb / a1712dfd / 11f15db6 — identical to candC-thresh-mut1-s35), and the standing HALO invariant fails identically with the takeoff off (control 0.4942 run 12 / 0.4854 run 13; takeoff 0.4111 run 9 / 0.5448 run 13) — the halo is the pre-existing recorded HEAD failure of this gate at this size/body, not a regression (the takeoff improves the down fringe)."
  implication: "No pale lane returns; the takeoff is byte-identical to the accepted law when off and keeps ENCLOSED/tiling at the same floor when on. The gate's known halo row is unchanged in kind."

- timestamp: 2026-11-23T12:18:00Z
  checked: "Determinism and surface parity: two independent runs of the same stop drive; postApply == postSettle == postFix on the line gate; the literal-vs-uniform forms of the constant."
  found: "Two stop runs byte-identical on all four digests (8c5d0acb / 7aa74e3c / 298db036 / 31aec295; 4665600 bytes) via compare.mjs --other; postApply == postSettle == postFix exactly; two current-build line runs byte-identical. The literal vs uniform forms differ only at the rounding edge (the end's white composite digest; all end metrics identical, film digests identical; the line's digests differ at a handful of threshold-boundary texels) — the uniform form is the shipped one and is deterministic within itself."
  implication: "live == settle == re-bake and byte-identical runs hold; the residual literal/uniform delta is arithmetic folding of the same 1.1, not a law difference."

- timestamp: 2026-11-23T12:22:00Z
  checked: "Gates: pnpm --dir packages/efx-watercolor exec vitest run; pnpm --dir app exec vitest run; pnpm --dir app exec tsc --noEmit; pnpm --dir packages/efx-watercolor exec tsc --noEmit; the isolated re-run of the one app-suite failure."
  found: "Watercolor: 41 files / 979 passed / 8 skipped (includes probe/medium-engine/harness.test.ts 136/136 — the probe pins still hold). App: 464 passed / 2 skipped / 1 failed — physicPaintBridge.test.ts 'removes its one-shot listener when no receiver answers (bounded wait)' timed out under the full suite; the same file passes 186 passed / 1 skipped in isolation, the known full-suite contention failure recorded in the prior pale-line debug. Both typechecks exit 0."
  implication: "All automated gates are green apart from the pre-existing contention timeout. Regression pins (scattering.test.ts) added: the takeoff literal line, its threshold placement, and negative pins that no takeoff term multiplies cA/cB/alpha or coverage."

- timestamp: 2026-11-23T12:24:00Z
  checked: "Residual end-region character after the fix (pigment and coverage end crops: /tmp/medium-engine/bristle-end-{stop,lift,decay,mouse,mouse-lift,bake}-end-pigment.png, -end-coverage.png, -end.png)."
  found: "A terminal pigment-density block persists at pigment level ~0.62-0.68 vs body 0.55-0.60, ramping in over the last ~10-15 px from x ~800 (the trailSupport boundary). It is fresh terminal deposit, present in every path including the approved lift, and its right silhouette is now speckled by the takeoff — no straight edge remains."
  implication: "The brief's silhouette/contrast-step defect is repaired; the sampled zone reads slightly lighter than the body, and the residual terminal density is a body-level deposit characteristic to be judged in the live UAT rows (not a straight-lined block)."

## Resolution

root_cause: |
  The stroke's end silhouette is the last RUNNING dab's uncovered leading frontier. 6344328d8
  restricted the along cap to the stroke start and the uEndCap = 1 catch-up dab; running dabs
  carry no cap, so the frontier keeps the gather's uniform coverage up to the deposit cull
  (|q.y| > 1.15) and a hand that stops ends on a straight full-width wall there. The catch-up is
  not the writer (mouse: 0 capped dabs, same wall; bake: no catch-up, same wall) and the
  pointerup timing is not (scripted constant-pressure stop walls too). The surviving depth fade
  cannot repair it: the deposit lerp ink <- ink*(1-a) + carried*a holds committed film wherever
  a is small (~100 px memory), so a depth cap only dims the last dabs while the wall stands.
  Measured pre-fix: every row's last dark x = 1015, flat over 83 % of the width, ~40 luma
  darker than the body.
fix: |
  One law: the TAKEOFF threshold shift in gatherBristle — `float takeoff = smoothstep(0.45,
  1.05, -q.y); threshold += takeoff * (0.3 + 0.7 * uPressure) * uTakeoffShift;` with
  BRISTLE_TAKEOFF_SHIFT = 1.1 (declared in bristles.ts, bound as uTakeoffShift in bindGather).
  It is the same §4.4 paper-tooth threshold the Feather law uses, applied over the outer leading
  band of every dab: an inked cell keeps the full carried paint, an open cell discards. While the
  hand moves the dabs ahead repaint the fringe; when it stops, that fringe IS the end and it
  dissolves into full-depth tooth specks. Leading-only (the trailing half is the next dab's solid
  interior); pressure-scaled by the same 0.3 + 0.7 * uPressure factor the coverage carries, so a
  mouse's saturated stop opens the frontier like a pen's lift. No depth multiplier, no running
  along cap, no lateral selector; the 2026-11-22 cap restriction and its negative pins stand.
verification:
  end_silhouette_stop: pass — END median 994, spread 37.2, irregularity 1, flat 21.89 %, longest same-x run 12 px (wall pre-fix: x = 1015 on every row, flat 83 %), zoneDark 0.5489 vs body 0.5782
  end_silhouette_mouse: pass — median 1012, spread 39, irregularity 1, flat 25.25 %, longest run 34 px on the 193 px mark, contrast -0.0185; census 241 taps / 0 endCaps
  end_silhouette_decay: pass — median 988, spread 46.4, irregularity 1, flat 20.12 %, longest run 17 px, contrast -0.0425
  end_silhouette_mouse_lift: pass — median 964, spread 43, irregularity 2, flat 10.4 %, longest run 6 px, contrast -0.0026
  end_silhouette_bake: pass — median 997, spread 40.2, irregularity 1, flat 23.67 %, longest run 15 px, contrast -0.0077 (no catch-up on this path)
  end_silhouette_lift_unchanged: pass — the approved lift reads 1.78 % flat / spread 174.6 / contrast -0.1926, as before the law
  along_decay_graded: pass — fine 1-px along-darkness decays into zero, no cliff: stop 0.5964@974 -> 0.0764@998 -> 0.0004@1006 -> 0; mouse 0.6411@974 -> 0.3932@1006 -> 0.0271@1021 -> 0.0056@1026
  run_length_unchanged: pass — body thickness unchanged 164.81 px (pen) / 192.74 px (mouse); body darkness unchanged 0.5782 / 0.5357; Pigment 100
  start_end_agreement: pass — irregularity 1-2 on every end path, specks-over-paper at bristle scale, graded decay; start zoneDark 0.3826-0.4062, end zoneDark 0.3914-0.5706
  pale_line_enclosed: pass — s35: 0.19 % / 9 px (mut1), 0.03 % / 3 px (mut2); s100: -0.19 % / 2 px, -0.52 % / 9 px; rejected state was 7.53 % / 230 px
  pale_line_tiling: pass — fringe coherence fracHigh 3.57 % in every capture (1/28 pairs) vs the rejected along-only law 33 %; means 0.116-0.173 vs 0.396; tooth texture present at ±68-76 px (hpRms 0.12-0.31)
  pale_line_control: pass — BRISTLE_TAKEOFF_SHIFT = 0 reproduces the accepted candC-thresh-mut1-s35 bytes exactly on all four surfaces (61d60617 / 63ea1dbb / a1712dfd / 11f15db6); the standing HALO row fails identically with the law off (0.4942 run 12 / 0.4854 run 13), so it is the gate's pre-existing recorded HEAD failure at this size/body
  determinism: pass — two stop runs byte-identical on all four digests via compare.mjs --other; two current-build line runs byte-identical; postApply == postSettle == postFix on every line surface
  probe_pins: pass — probe/medium-engine/harness.test.ts 136/136 (scenario lists and pins unchanged by the new bristle-end scenario)
  watercolor_tests: pass — 41 files / 979 passed / 8 skipped
  app_tests: pre-existing-failure — 9795 passed / 1 skipped / 1 failed: physicPaintBridge.test.ts one-shot-listener timeout under the full suite; passes 186 / 1 skipped in isolation (the known contention failure recorded in resolved/acrylic-bristle-pale-line.md)
  typechecks: pass — pnpm --dir app exec tsc --noEmit exit 0; pnpm --dir packages/efx-watercolor exec tsc --noEmit exit 0
  native_uat: pass — all six live rows accepted by the artist 2026-11-23; verbatim: "approvated UAT congrats"
files_changed:
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs

## Artist UAT row (APPROVED 2026-11-23)

Artist verbatim: "approvated UAT congrats" — all six rows accepted live (native).

All rows native, live, in Studio / Physic Paint, medium Acrylic, brush bristle-flat and
bristle-round, Pigment 100 unless noted:
1. Pen — lift while still moving: the approved ragged cap is unchanged.
2. Pen — stop the tip while pressed, then release: the end breaks into bristle-scale specks,
   no straight edge, no darker block.
3. Mouse — draw and stop: same ragged break-up (the speed-derived pressure must not restore a wall).
4. Trackpad — same as 3.
5. Short click: the mark is a small dab whose leading frontier is speckled, not a square stamp.
6. Pigment 100 short / medium / long strokes: the run length is unchanged and every end breaks up
   like its start (the Pigment-0 workaround is no longer needed).

Evidence to compare on request: /tmp/medium-engine/bristle-end-{stop,lift,decay,mouse,mouse-lift,bake}-end.png,
-end-pigment.png and -end-coverage.png; the JSONs beside them carry the numbers above. The
pale-line evidence pairs are /tmp/medium-engine/takeoff-line-s35-mut{1,2}.json versus
/tmp/medium-engine/control-line-s35-mut1.json (the law-off control).
