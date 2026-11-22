---
status: resolved
trigger: |
  Symptom (v2.2.0, Phase 64, branch gsd/phase-64-medium-engine): every Acrylic bristle
  stroke drags a thin pale line along its length. It is a PALER, THINNER FILM of the
  stroke's own pigment, not an uncovered hole: on the artist's capture the blue body is
  ~RGB(85,150,214) and the line ~RGB(175,210,227); pink (234,90,152) -> (251,204,223);
  yellow (245,205,107) -> (252,228,154). Width ~1-3 px, continuous, present on bare paper
  AND where the stroke crosses earlier paint.

  Reproduction state — use the artist's values, NOT the acrylic medium record: the artist
  reports Body 0 (while MEDIUMS.acrylic.params.body is 100). Record the full parameter set
  the probe uses in the report, and flag the mismatch (do not change the medium record in
  this fix). Brush: bristle-flat / bristle-round (pressureLink 0, speedLink 0). At Body 0,
  S = 0 (legacy exponential display) and cover tops at BRISTLE_BODY_ALPHA_FLOOR 0.5, so
  the scattering/white-veil theory is out and the defect must live in the ink/coverage path.

  Do not fix from prose. Reproduce through the real engine: extend the probe harness
  (probe/port-comparison or probe/small-brush) to paint ONE straight Acrylic bristle-flat
  stroke at 1080x1080 and dump a PNG plus mid-stroke across-stroke profiles of: the cover
  channel, the delivered ink absorbance, and the gather's per-texel coverage. Run it at
  Body 0 AND Body 100: an identical line points at the ink/threshold path, a different one
  at the cover/underlay path. Cheap regression: run the same probe at HEAD and at
  08fc85977^ (before 64-23's trace/edge laws) - if the line predates them it belongs to
  64-21/22.

  Then bisect ONE term at a time and report which one owns the line:
  (a) the paper-tooth threshold (grainHeight / bristleThreshold, shaders.ts ~1059-1163) -
      brush-local streaks have sub-pixel across cells;
  (b) the per-bristle ink weight driving body/local (shaders.ts 1124-1150, bristles.ts
      bristleBody);
  (c) the §4.2 value jitter - it multiplies ABSORBANCE (Engine.ts 3179), which inverts the
      reference's dark-fibre band; a CPU check gives only ~#6191d3 vs #4f7ec9 for blue, so
      unlikely to be the whole effect;
  (d) pickup/smear. The line survives over any fond, so the mechanism must thin the
    DELIVERED film regardless of what is underneath.

  Guardrails:
  - One law change, then the same probe pixels. Name the surface: live during stroke, after
    settle, after re-bake - they must agree.
  - Keep the gates green: pnpm --dir packages/efx-watercolor exec vitest run,
    pnpm --dir app exec vitest run, pnpm --dir app exec tsc --noEmit. No stroke replay,
    never start the dev server, never run vitest in watch mode.
  - If no single term kills the line, stop and report the profiles instead of shipping a
    cosmetic tune.

  Acceptance: one artist UAT row - a Bristle-Flat stroke at the artist's default
  parameters, on paper and over an earlier stroke, shows no pale/white line, with the
  across-profile and before/after PNG as evidence.
created: 2026-11-22T00:00:00Z
updated: 2026-11-22T11:45:00Z
---

## Current Focus

**CLOSED 2026-11-22 ~12:00 — UAT ROW 4 PASSED. Artist verbatim: "beautiful now, Approbated
UAT, congrats". Accepted state: §4.2 log-offset law + running along-cap correction +
threshold-shift feather law; the along-only motif law is fully reverted and forbidden by
negative pins. Regression pin added to `scattering.test.ts` (879 passed). Nothing committed —
working tree only, per the conservative profile.**

**UAT ROW 3 FAILED 2026-11-22 ~11:17 — the along-only fade-depth law is REJECTED (verbatim:
"its worser now … the white seams created like a motif (tiled) … now we have seams repeats on
boths side of the stroke"). It traded the continuous line for a periodic band motif. The
probe's enclosed-line statistic was BLIND to periodicity, so a TILING metric was added before
any further law change: fringe-row coherence + per-row periodogram. The metric separates the
fault cleanly — S2 0.117 / 3.6 % coherent pairs; the rejected along-only law 0.396 / 33 %; the
fixed law 0.094 / 4 %.**

**STRUCTURAL FIX SHIPPED (2026-11-22 ~11:40), probe-only, awaiting artist UAT row 4. The
artist's pale line was not a selector problem but a DEPTH problem: any fade that scales the
film's depth gives the texel a small deposit weight a, and the dab lerp
`ink <- ink*(1-a) + carried*a` then holds the old film for ~100 px of travel. Every depth
selector therefore froze its pale cells into a lane (across noise 7.54 % / 231 px enclosed;
2-D cell 11.66 % / 205 px) or traded the line for a tiled motif (the along-only 18-px
selector, UAT row 3 REJECTED). Four topologies were measured with the new TILING gate before
the law changed. The shipped fix removes the depth fade entirely: Feather raises the §4.4
paper-TOOTH threshold (`featherShift = uFeather * uFeatherShift * smoothstep(featherStart,
uFeatherEdge, lateral)`, with `BRISTLE_FEATHER_SHIFT = 0.35` declared in bristles.ts and
bound by the engine), so the rim opens into FULL-DEPTH specks over paper — the existing
dry-end mechanism — and the rag comes from the paper itself, which has no along period.
Measured on the same pixels: ENCLOSED 0.22 % / 9 px (mut1) and 0.01 % / 4 px (mut2) vs
7.53 % / 230 px at S2; fringe coherence 0.094 / 4 % and 0.064 / 0 % vs 0.117 / 3.6 % at S2
and 0.396 / 33 % for the rejected along-only law (the band-motif discriminator). The across
profile is monotone (core 0.69-0.72 → specks 0.68/0.51/0.42/0.17 → paper by 96 px); the
fringe texture is the tooth's specks (hpRms 0.22-0.33 at ±68-76 px), never a coherent pulse.
postApply == postSettle == postFix in both seeds; a re-run is byte-identical.**

hypothesis: CONFIRMED — the writer is the feather's DEPTH multiplier itself, not its selector.
`g.coverage = inked * featherFade` makes a pale texel a LOW-WEIGHT texel; the deposit's lerp
`ink <- ink*(1-a) + carried*a` then needs ~20 dabs (≈100 px) to converge where a ≈ 0.15, so
each pale cell holds the pre-stroke (paper) film along the whole stroke: ENCLOSED 7.54 % /
231 px at S2. A selector can only choose which cells are pale: across-independent selectors
add local across contrast (2-D cell 11.66 % / 205 px), across-monotone selectors remove the
raggedness (monotone tip ramp: fringe 0.67-0.69, at the core's own depth), along-only
selectors beat against the dab train into a repeated band (row 3). Removing the partial-weight
window fixes the mechanism: the fringe becomes sparse FULL-DEPTH specks via the paper-tooth
threshold, and the rag comes from the paper, which has no along period. Prior writers already
shipped/corrected: the §4.2 log-offset law (Row 1) and the running along cap (Row 2).

test: Real-engine probe, ONE straight bristle-flat stroke at 1080×1080, size 35 (engine scale
1.0), artist record Body 0, press/speed unlinked, mut 1/2, `--band 140`, postApply / postSettle
/ postFix. Metrics: the ENCLOSED-line statistic (a pale row bounded by darker paint on both
sides — paper is not paint) PLUS the TILING gate added 2026-11-22 — per-row boxcar high-pass,
dominant along period 12..180 px and amplitude on 11 rows across the mark, and the across-row
coherence of the fringe profiles (a band motif pulses the fringe in phase; tooth specks are
row-independent).

expecting: (i) the fix collapses the enclosed lane to the feather-pin floor; (ii) fringe
coherence stays at the pin's floor (no in-phase pulse along the mark); (iii) the fringe keeps
ragged tooth texture (hpRms well above the smooth-veil floor); (iv) across profiles monotone;
(v) postApply == postSettle == postFix; (vi) mut1 and mut2 both pass; (vii) byte-identical re-run.

next_action: NONE — session closed on the artist's UAT approval of row 4 ("beautiful now,
Approbated UAT, congrats"). The regression pin was added after the approval: the §4.2
log-offset describe in `scattering.test.ts` (flat band shift = -ln(vj), display scales by vj, a
coefficient scale shifts bands unequally, both application sites pinned, the retired raw
multiply forbidden). Package gate: 39 files / 879 passed / 8 skipped. Outstanding handoff: the
working tree is uncommitted (conservative profile). Non-probe surfaces still unexercised:
Bristle-Round, a refill > 0 record, the live display composite, a stroke over wet earlier paint,
and the Feather slider's full sweep (F0 untouched by construction; F100 not captured).

## Symptoms

- **Expected:** An Acrylic bristle (flat/round) stroke reads as one uniform film at the artist's default parameters.
- **Actual:** A continuous ~1–3 px pale/thinner line of the stroke's own pigment runs along the stroke — on bare paper AND over earlier paint. Blue body (85,150,214) → line (175,210,227); pink (234,90,152) → (251,204,223); yellow (245,205,107) → (252,228,154).
- **Errors:** None — purely visual; no throw, no console noise reported.
- **Timeline:** Present in v2.2.0 on branch `gsd/phase-64-medium-engine`. Suspect range 64-21/22/23; the pre-64-23 commit boundary is `08fc85977^`.
- **Reproduction:** Bristle-flat / bristle-round, pressureLink 0, speedLink 0, Body 0 (artist value; `MEDIUMS.acrylic.params.body` is 100 — mismatch flagged, medium record NOT changed), 1080×1080, real engine via probe harness.

## Gathered context (orchestrator, pre-delegation)

- Probe harness: `packages/efx-watercolor/probe/medium-engine/` extended for this debug with
  `--scenario bristle-line`, `--stroke-size <1..200>`, `--band <16..400>` and `--mut <n>`
  (probe.ts + run.mjs; the harness.test.ts resolved-brush pin follows the extended default
  chain). The scenario prints the full params bag, the record's Body beside the override,
  and three across-stroke profile sets (postApply / postSettle / postFix) over cover, film
  darkness (`dark`) and delivered ink absorbance (`ink`), plus three PNG data URLs written
  beside the JSON.
- Engine sources: `packages/efx-watercolor/src/playground/{Engine.ts,shaders.ts,bristles.ts}`;
  pigment basis `spectral.ts` + `spectralData.ts`.
- Standing project rules that bind this fix: `Skill("efx-studio-paint")` before touching
  anything that changes what the paint looks like; `Skill("spike-findings-efx-motion-editor")`
  for the measured shader laws and the headless harness; no stroke replay; never start the
  dev server; never vitest in watch mode; `pnpm` not `npm`.
- Conservative commit profile: do NOT commit or push; report changed files, validation, and
  suggested commands at handoff.
- Live UAT is the acceptance surface; after the behavior proof, the regression test follows
  (`feedback_fix_before_tests`; tdd_mode stays on).

## Evidence

- timestamp: 2026-11-22T03:10:00Z
  note: "The documented reproduction used the probe's canonical STROKE_PARAMS size 12, NOT the artist's stroke. At size 12 no interior lane exists at any Body, on HEAD or on 08fc85977^ (`/tmp/medium-engine/line-body0-1080.json`, `line-body100-1080.json`, `old-art-body0-s12.json`); postApply == postSettle == postFix. The artist's real default is `DEFAULT_BRUSH_SIZE = 35` (app/src/types/paint.ts), which maps through `sizeToEngineScale` to the FLAT 32..80 band → engine scale 1.0, byte-identical to probe size 48 (verified identical profiles 35 vs 48). The lane is a scale-1.0 phenomenon."
- timestamp: 2026-11-22T04:05:00Z
  note: "Bug captured at the artist's parameters (size 35, mut seed 1): `/tmp/medium-engine/line-mut1-s35.json` (+ PNGs). Interior pale lanes, postFix: ink −15..−6 px = 1.908–1.970 and +15..+18 px = 1.747–1.762 against a 2.09–2.39 plateau; dark 0.577–0.623 against 0.66–0.70; the cover channel is featureless along the same span. A 200-px band capture (`line-band-s48.json`) shows the lane fully bounded (+23..+32 px) inside the un-faded body (featherStart ≈ 49 px at scale 1)."
- timestamp: 2026-11-22T04:30:00Z
  note: "Seed control: the lane MOVES with `--mut` (mut2: +4..+12 px = 1.825–1.891 and +32..+45 px = 1.682–1.854) while the outer feather dips stay fixed at ±60–65 px. The writer is bristle-seeded, not the paper-tooth threshold and not the feather."
- timestamp: 2026-11-22T05:30:00Z
  note: "Old tree `08fc85977^` (worktree /tmp/efx-08fc, artist record pinned literally): the film is a saturated flat slab at the artist's size — cover exactly 0.9148, ink exactly 19.66 — no lane, no structure. The structured film arrives with 08fc85977 (64-23); the old record (feather 0, emboss 40) cannot show the defect either way. Origin remains 64-21/22's structured film, and the writer is proven at HEAD by bisection."
- timestamp: 2026-11-22T06:20:00Z
  note: "ONE-term bisection (c): neutralizing the run multiplier (m → 1, ±4 % kept, RNG order preserved) killed the interior lanes and left the cover channel unchanged (`bisect-novj-mut1-s35.json`) — the value jitter owns the lane. (a) is eliminated by the seed control; (d) cannot produce a pale lane on bare paper (nothing to lift) and its smear is along-hashed in 6-px dashes, never continuous; (b) is the gather's profile weight, which the seed control and the exact polarity inversion refute."
- timestamp: 2026-11-22T07:10:00Z
  note: "Law choice measured on CPU (spectral basis): a raw coefficient scale is the wrong space. For the probe colour #2b6fd0 at vj = 0.8, the linear-RGB ratios are 0.812/0.800/0.800 under `pig + u·LEVEL_COEFFS` (u = −ln vj) but 0.385/0.667/0.905 under the first mirror candidate `pig · (2 − vj)` — a large hue distortion. The exact log offset scales every band by vj, matching the reference's linear-light multiply. LEVEL_COEFFS = sums of the 7 basis vectors over 38 bands = [6.1539, −0.1302, 0.1670, 0.2132, 0.0945, −0.0355, 0.1527]; the constant's reconstruction residual is max 0.0353 per band (mean 0.0070). The mirror candidate was still captured live (`fix-mirror-mut1-s35.json`, `fix-mirror-s35.json`) to prove the writer and the polarity, then rejected on hue."
- timestamp: 2026-11-22T09:25:00Z
  note: "Fix captured (exact log-offset law): `/tmp/medium-engine/fix-level-mut1-s35.json`, `fix-level-mut2-s35.json`, `fix-level-body100-s35.json` (+ PNGs). mut1: the −15..−6 lane reads 2.089–2.194 and +15..+18 reads 2.261–2.279; the bug's +22..+28 dark band (2.318–2.392) becomes the reference's light-fibre run (2.014–2.110). mut2: +4..+12 reads 2.337–2.370 and +32..+45 reads 2.153–2.309. The cover channel is identical to the bug capture at every offset."
- timestamp: 2026-11-22T09:26:00Z
  note: "Body pairing with the fix: Body 0 ink min 2.0136 @ +28 px and Body 100 ink min 2.0136 @ +28 px — identical ink, different cover minima (0.3354 vs 0.6711 @ +40 px). The line lives in the delivered-ink path; Body writes only the cover/underlay. postApply == postSettle == postFix in every capture (the surface agrees; no settle/fix divergence)."
- timestamp: 2026-11-22T09:28:00Z
  note: "Gates. `pnpm --dir packages/efx-watercolor exec vitest run`: 39 files / 876 passed / 8 skipped. `pnpm --dir app exec tsc --noEmit`: exit 0. `pnpm --dir packages/efx-watercolor exec tsc --noEmit`: exit 0. `pnpm --dir app exec vitest run`: 463 files passed, 9752 tests passed, 1 failed — `src/lib/physicPaintBridge.test.ts` import round trip, which the file itself documents as full-suite-contention sensitive and which fails identically on a PRISTINE HEAD worktree (/tmp/efx-head: same test, 19.5 s vs 2.2 s alone) — pre-existing, unrelated."
- timestamp: 2026-11-22T09:35:00Z
  note: "Committed bristle baselines do NOT reproduce on pristine HEAD even before this fix: a fresh `bristle-body0-1080` capture on /tmp/efx-head gives 7b2bc3ad/f22616a2/63cd32f1/a8366a0f (spread P90 0.10) against the committed 025290a8/fdcaac2a/0ca6fc2f/883b5ba7 (P90 1). The 261121 quicks (b14b7ebe6 dab floor, 13906a9f1 pressure decouple, 0e41c0d6a Dry law) changed the bristle film after 64-24 re-authored those five baselines. No automated gate consumes them; the fix adds further drift, so any future re-authoring must include this law."

- timestamp: 2026-11-22T10:20:00Z
  note: "UAT FAILED — ARTIST STILL SEES THE LINE, on a build CONFIRMED patched (dev server reloaded after the fix; user answer). Capture: /Users/lmarques/Desktop/Capture d’écran 2026-11-22 à 10.18.06.png (144×622). Measured (PIL, mean over 5-row bands): the strongest interior pale ridge sits at x≈54–57 (≈3–4 px wide) reading RGB (167,196,218) against neighbour (138,175,208) — ≈+24 luminance units ≈9 % relative — at y≈180; weaker ridges at y=260/340/420/500 with prominence 4–7 (normal fibre). The fix therefore attenuates the lane (~halves the probe depth) but does not remove it; the visible residual is the SAME order as the post-fix probe residual (dark min 0.632 vs 0.714 plateau ≈11 %, ink 2.014 vs 2.392 at the +22..+28 run), so the live line is the residual, not an unpatched code path. Re-open bisection on the residual."

- timestamp: 2026-11-22T10:23:00Z
  note: "Residual reproduced on the current tree: `residual-mut1-s35` and `residual-mut2-s35`. Interior band (−48..48 px) depths: mut1 cover 6.91 % (min 0.3354 @ +40), dark 6.34 % (min 0.6318 @ +27), ink 9.23 % (min 2.014 @ +28); mut2 6.65 / 6.10 / 8.29 %. postApply == postSettle == postFix in both."
- timestamp: 2026-11-22T10:31:00Z
  note: "SEED CONTROL REFUTED for the fine structure. A pure-node PNG decode (minimal zlib inflater, /tmp/png_columns.mjs) over x 270..810, y ±48: the per-column mottle field's correlation between mut1 and mut2 is 0.995 (pre-fix) — the residual is canvas/seed-independent, not bristle-seeded. The 04:30 note's 'lane MOVES with --mut' was true only for the band-AVERAGED dips; the fine minima are locked. Corrects Eliminated (a) below."
- timestamp: 2026-11-22T10:34:00Z
  note: "One-term pins at the artist's parameters, all with the same probe. (i) valueJitter pinned to 1 (RNG order preserved): band depths 6.91 / 5.98 / 6.82 — no reduction (`bisect-vjoff-mut1-s35`). (ii) paper height pinned to 0.5: 6.27 / 6.54 / 9.60 — no reduction (`bisect-flatgrain-mut1-s35`). (iii) body pinned to 1: 5.52 / 6.70 / 9.55 — no reduction (`bisect-body1-mut1-s35`). (iv) ALL THREE pins at once: 5.52 / 5.11 / 5.44 — STILL present at the same per-column minima (`bisect-alloff-mut1-s35`). None of the recorded candidates (a)/(b)/(c-continuity) owns the residual alone."
- timestamp: 2026-11-22T10:44:00Z
  note: "CAPS BISECT — OWNER NAMED. With the three pins in place, pinning BOTH along caps (`alongFade = 1`, `trailSupport = 1`) collapses the band: cover 0.57 %, dark 0.38 %, ink 0.02 % (`bisect-caps-mut1-s35`). SPLIT: alongFade LIVE + trailSupport pinned keeps it — cover 4.19 %, dark 4.45 %, ink 4.18 % (`bisect-capA`); alongFade PINNED + trailSupport live kills it — cover 0.87 %, dark 0.56 %, ink 0.21 % (`bisect-capB`). The owner is `alongFade`. Mechanism: the only across-frequency term in alongFade is `fadeStreak` (via `hairEnd`), and fadeStreak carries NO seed — exactly the seed-independence measured above."
- timestamp: 2026-11-22T10:47:00Z
  note: "ONE LAW CHANGE on the same pixels: the along cap is now limited to where it is visible — `along = exposedTrail > 0.0 ? mix(max(-q.y, 0.0), abs(q.y), exposedTrail) : 0.0` (the start keeps its symmetric cap, the catch-up end keeps its `uEndCap = 1` cap, interior running dabs carry none). Fix capture `fix-alongcap-mut1-s35`: band cover 2.75 %, dark 2.78 %, ink 5.00 %; local pale-ridge prominence (mean of ±2..6 px neighbours minus the texel, over the band mean) dark 2.08 % @ +24 (was 3.88–4.59 %), ink 3.98 % @ +24 (was 5.71–7.16 %), cover 2.69 %. mut2: 2.71 % dark band, prominence 2.20 / 4.50 / 1.96. The mottle field decorrelates from pre-fix (0.49) but the post-fix field is still 0.991-correlated between mut1/mut2. Decomposition: fix + paper height pinned = dark prominence 2.25 %, ink 4.20 % (`fix-flatgrain-mut1-s35`) — the tooth is NOT the owner of the remaining ridge. The fix does NOT kill the residual."
- timestamp: 2026-11-22T10:50:00Z
  note: "Gates after the law change + reverting every diagnostic pin: `pnpm --dir packages/efx-watercolor exec vitest run` 39 files / 876 passed / 8 skipped (the static source pin in scattering.test.ts:1356 was updated deliberately to the new cap law, with the reason); `pnpm --dir app exec vitest run` 464 files / 9753 passed / 1 skipped; `pnpm --dir app exec tsc --noEmit` clean. No commit, no push."

- timestamp: 2026-11-22T10:55:00Z
  note: "Orchestrator decision (user): KEEP BISECTING, probe-only. No artist UAT row until a candidate term actually kills the ridge; the next probes are the recorded next_action (body=1 comb × threshold, then per-dab jitter re-randomization, then live-path deltas). Gates re-verified by the orchestrator after the along-cap law: efx-watercolor 39 files / 876 passed / 8 skipped."
- timestamp: 2026-11-22T10:56:00Z
  note: "RECORDED NEXT ACTION 1 (body comb × threshold) REFUTED at the wide band: `bisect2-body1-mut1-s35` (body pinned to 1, --band 140) reads fringe local prominence 8.38 %, ENCLOSED 7.46 % in 231-px runs — indistinguishable from the base 8.32 % / 7.54 % / 231 px. The body/local comb does not own the ridge."
- timestamp: 2026-11-22T10:58:00Z
  note: "WIDE-BAND RESCAN — the lane the earlier bisections never saw. `wide-band-mut1-s35` and `base-recheck-mut1-s35` (--band 140; byte-identical digests c2689d52/1aa4a2dc/ecfe8c0c/2acbf81a): a pale lane at ±62 px holds 63.8 % of the stroke's length in 3 runs (mean 115 px, max 233 px), local prominence 8.32 %; the ENCLOSED line (pale row with darker paint both sides) 7.54 % / maxRun 231 px. The ±48 default band excluded it — every earlier 'residual owner' bisect was blind to this lane. The profile structure matches the artist's capture: paper -> dark rim band -> pale line -> darker core. One-term pin `float featherFade = 1.0;` (`bisect2-feather1-mut1-s35`): fringe 1.45 % (exactly the core's fibre floor), ENCLOSED −1.08 % / maxRun 9. The FEATHER FADE owns the artist-visible line."
- timestamp: 2026-11-22T11:05:00Z
  note: "WRONG TOPOLOGY MEASURED AND REJECTED. A 2-D cell selector for the fade depth (`valueNoise(vec2(across*hairFreq, uStrokeDistPx/uStreakLen) + vec2(11.3,47.0))`, `fix-ragged2d-mut1/mut2-s35`): ENCLOSED 11.66 % / maxRun 205 px and 11.15 % / 204 px — WORSE than base (7.54 % / 231 px), and the lane moved outward to ±71 px. Independent across cells ADD local across contrast, and the deposit's ~100-px along memory (measured along oscillation period 118–127 px; dab spacing ~5.5 px at bristle-flat aspect 0.28 × spacing 0.1) re-smooths any selector cell size. Replaced by the correct topology, not iterated."
- timestamp: 2026-11-22T11:08:00Z
  note: "ONE LAW CHANGE — the fade depth varies ALONG the stroke only: `fadeAlong = noise1(uStrokeDistPx / max(uStreakLen, 1.0) + 11.3)` replaces the across-varying selector in `raggedFade`; `fadeStreak`/`hairFreq` remain solely for the end cap's `hairEnd` stagger. `fix-fadealong-mut1/mut2-s35` (--band 140): ENCLOSED 0.60 % / maxRun 10 px (mut1) and 0.65 % / 30 px (mut2) vs base 7.54 % / 231 px; fringe local prominence 2.90 % / 3.17 % (the pulsing outer extent of a dry brush), core unchanged 1.45 % / 1.08 %; across profiles monotone at every sampled x (rows 58–78 share the same ~120-px along pulse). postApply == postSettle == postFix in base and both fix seeds. Visual crops (`compare-line-3x.png`, `compare-fadealong-wide.png`, `compare-fadealong.png`, `compare-fullmark.png`): base crisp white line vs fix broad pulsing dry swath vs pin solid mark."
- timestamp: 2026-11-22T11:09:00Z
  note: "DETERMINISM: `fix-fadealong-mut1-s35-det` re-run is byte-identical to `fix-fadealong-mut1-s35` — paper b9f48f21, transparent 6714a4c9, white 9281340b, pigment b42266fe (4665600 bytes)."
- timestamp: 2026-11-22T11:14:00Z
  note: "Gates after the along-only law (static source pins in scattering.test.ts:1344-1346 record the law and the measured numbers): `pnpm --dir packages/efx-watercolor exec vitest run` 39 files / 876 passed / 8 skipped; `pnpm --dir packages/efx-watercolor exec tsc --noEmit` exit 0; `pnpm --dir app exec tsc --noEmit` exit 0; `pnpm --dir app exec vitest run` 464 files passed / 2 skipped, 9753 tests passed / 1 skipped (the documented `physicPaintBridge.test.ts` contention flake failed once on the first run, clean on the full rerun). No commit, no push."

- timestamp: 2026-11-22T11:25:00Z
  note: "UAT ROW 3 FAILED — artist verbatim: 'its worser now I pointed on the image the white seams created like a motif (tiled) now we have seams repeats on boths side of the stroke'. Capture /Users/lmarques/Desktop/Capture d’écran 2026-11-22 à 11.17.31.png (204×494, hand-drawn pink bristle stroke). Measured (PIL): pale band clusters along the stroke at y≈84, 190, 248, 370; adjacent spacing ≈106, 58, 122 capture px; the bands span much of the stroke width, and at them one or both fringes run +35..+45 luminance units paler than the interior, alternating left/right — i.e. the fringe fade depth now pulses periodically on BOTH sides. Writer of the TILE: `fadeAlong = noise1(uStrokeDistPx / max(uStreakLen,1) + 11.3)` with `BRISTLE_STREAK_LENGTH = 18` document px (`bristles.ts:218`) — the depth repeats every 18 document px, held by the deposit's ~100–120 px along memory; the artist's zoom maps 18 px to the visible ~100-capture-px tile. The along-only selector is REJECTED and must not ship. The probe gate was blind to periodicity — add a tiling metric (along autocorrelation / dominant period + amplitude) alongside the enclosed-line and monotone-across checks before the next law change."
- timestamp: 2026-11-22T11:28:00Z
  note: "TILING GATE ADDED to `probe/medium-engine/probe.ts` (and the band default raised to 140, help text updated). Per-row (offsets 0, ±44, ±52, ±60, ±68, ±76) 200-px boxcar high-pass, periodogram over 12..180 px reporting the dominant period and |DFT|/n amplitude; cross-row coherence over the fringe rows (|offset| >= 52) as the mean pairwise correlation and the fraction of pairs > 0.5; the ENCLOSED-line scan moved in-probe (offsets 56..96, both signs) and reproduces the offline `/tmp/png_ridge.mjs` numbers exactly. Discriminator established: the offline `/tmp/tiling.mjs` reads the REJECTED along-only capture at coherence 0.396 / 33 % pairs>0.5, while S2 reads 0.117 / 3.6 % (`s2-tiling-mut1-s35`, ENCLOSED 7.53 % / 230 px — byte-metric-identical to `base-recheck-mut1-s35`)."
- timestamp: 2026-11-22T11:30:00Z
  note: "REVERTED-CANDIDATE MEASUREMENTS (all `--band 140`, mut1 unless noted, postFix; surfaces agree in every capture). (i) PER-DAB SEED (`fix-dabseed-mut1/mut2-s35`): ENCLOSED 2.20 % / 136 px and 2.26 % / 136 px, coherence 0.404 / 32 % and 0.359 / 29 %, fringe amplitude at the fibre floor (0.010-0.016) — it REDUCES the lane but does not remove it, and the fringe sits at 0.63-0.71 dark, close to the feather pin, so the Feather control barely acts. (ii) The 'tip' multiply (`fix-tipdab-mut1/mut2-s35`) is a NO-OP: lateralFade is already 0 beyond uFeatherEdge, so fadeAcross = lateralFade * tipFade == lateralFade; its metrics equal the per-dab seed exactly. (iii) SMOOTH FADE (`bisect-tipfade-mut1-s35`): ENCLOSED 0.30 % / 5 px, coherence 0.266 / 7 %, but the across profile is the rejected white VEIL — 0.19 dark from 36 to 68 px, then the un-faded spill rim at 0.72 (72-100 px): a wide pale swath bounded outside by darker paint, and the fringe texture is below the pin's floor."
- timestamp: 2026-11-22T11:36:00Z
  note: "TIP-REACHING RAMP CANDIDATES. (A) One monotone ramp featherStart..1.0 with the per-dab seed (`candA-tipramp-mut1-s35`): ENCLOSED −0.98 % / 13 px and coherence 0.262 / 11 % — line and tiling PASS — but the fringe reads 0.67-0.69 dark at 60-80 px, the core's own depth (0.69-0.71): no pale depth anywhere, so the Feather control is DEAD. (B) The same ramp with the across-noise selector (`candB-tipstreak-mut1-s35`): ENCLOSED 0.22 % / 28 px, coherence 0.330 / 25 %, fringe again near-full depth out to 76 px — the raggedness returns as thin cells but the control is still weak. Neither passes line + tiling + feather."
- timestamp: 2026-11-22T11:38:00Z
  note: "ONE LAW CHANGE — Feather now shifts the §4.4 paper-tooth THRESHOLD and the film carries NO depth fade: `featherShift = uFeather * uFeatherShift * smoothstep(featherStart, uFeatherEdge, lateral)`, `threshold = uGrain*(1-height) - 0.25 + featherShift`, `float featherFade = 1.0;` (the along cap still multiplies it). The rim therefore opens into FULL-DEPTH specks over paper — the existing dry-end mechanism — with the paper tooth as the rag source (no along period) and no partial-weight window for the lerp to freeze. `candC-thresh-mut1-s35`: ENCLOSED 0.22 % / 9 px (4.8 % of rows), fringe coherence 0.094 / 4 %; across profile monotone — core 0.69-0.72 (44-56 px) -> specks 0.68 (68) / 0.51 (72) / 0.42 (76) / 0.17 (80) -> paper by 96 px; the fringe rows carry the tooth's own specks (hpRms 0.22-0.33, period 43-66 px) but no across-row phase coherence. mut2: ENCLOSED 0.01 % / 4 px, coherence 0.064 / 0 %. postApply == postSettle == postFix in both; `candC-thresh-mut1-s35-det` is byte-identical to `candC-thresh-mut1-s35` (paper/transparent/white/pigment all equal, 4665600 bytes). Visual crops `crop2x-candC-*.png` / `edge4x-candC-*.png`: solid body, ragged full-depth specks at both edges, no line; S2's crop shows the thin pale lane above the darker rim."
- timestamp: 2026-11-22T11:42:00Z
  note: "The shift magnitude is now a declared law constant, not a shader literal: `BRISTLE_FEATHER_SHIFT = 0.35` (bristles.ts), uniform `uFeatherShift`, bound in `bindGather` and pinned by the constants test (plus the static law pin). `candC2-uniform-mut1-s35` is BYTE-IDENTICAL to `candC-thresh-mut1-s35` (all four digests equal, tiling block equal) — the extraction changed no pixels. Gates re-run after it: watercolor 39 files / 876 passed / 8 skipped, both typechecks exit 0, app 464 files passed / 2 skipped / 9753 tests passed. No commit, no push."
- timestamp: 2026-11-22T11:44:00Z
  note: "Gates after the threshold law (static pins in scattering.test.ts updated: the threshold line, the featherShift line, `float featherFade = 1.0;`, and negative pins forbidding lateralFade/raggedFade/fadeAlong; bristles.ts docs updated to the threshold mechanism): `pnpm --dir packages/efx-watercolor exec vitest run` 39 files / 876 passed / 8 skipped; `pnpm --dir packages/efx-watercolor exec tsc --noEmit` exit 0; `pnpm --dir app exec tsc --noEmit` exit 0; `pnpm --dir app exec vitest run` 464 files passed / 2 skipped, 9753 tests passed / 1 skipped. No commit, no push."

## Eliminated

- **(a) paper-tooth threshold / grainHeight streak:** CORRECTED 2026-11-22. The original
  seed-control argument is REFUTED for the fine structure: the per-column minima are
  seed-INDEPENDENT (mut1 vs mut2 mottle correlation 0.995), so they are not bristle-seeded.
  The canvas-stationary writer is NOT the paper tooth either: pinning `height = 0.5` leaves
  the band depths unchanged (6.27 / 6.54 / 9.60 %) and pinning it on top of the fix leaves
  the ridge (2.25 % dark prominence). The stationary across texture is `fadeStreak` via
  `hairEnd` — see the caps entry below.
- **(b) per-bristle ink profile weight (bristleBody / body·local):** for the ORIGINAL lane the
  one-term neutralization of the run multiplier removed it with everything else intact. For
  the RESIDUAL, pinning `body = 1.0` alone leaves the band (5.52 / 6.70 / 9.55 %; wide band:
  `bisect2-body1` ENCLOSED 7.46 % / 231 px vs base 7.54 % / 231 px) — the comb × threshold is
  NOT the fringe writer.
- **(c) — ORIGINAL-LANE OWNER.** The §4.2 value jitter applied as a raw multiply on
  ABSORBANCE. For the RESIDUAL, pinning valueJitter to 1 leaves the band
  (6.91 / 5.98 / 6.82 %) — the residual has a SECOND writer, the running along cap below.
- **(e) — RESIDUAL OWNER (contribution).** The along cap on pure running dabs: `hairEnd`'s
  stagger reads `fadeStreak`'s across-frequency term (`across · hairFreq`, the lateral
  fringe's texture), writing a canvas-stationary across weight into the saturated deposit.
  Split bisect: alongFade live keeps the band, alongFade pinned kills it. Corrected by
  limiting the cap to `exposedTrail > 0` (start) and `uEndCap = 1` (catch-up end) — halves the
  interior band; the artist-visible remainder is the fringe feather fade (see the corrected
  Feather fade entry).
- **trailSupport:** NOT the residual's writer — with alongFade pinned and trailSupport LIVE the
  band is 0.87 / 0.56 / 0.21 % (`bisect-capB`); with alongFade live and trailSupport pinned it
  is 4.19 / 4.45 / 4.18 % (`bisect-capA`).
- **(d) pickup / smear:** cannot pale a film on bare paper (no canvas colour to lift), and
  the smear is an along-hashed 6-px dash pattern, never a continuous line. Not the writer.
- **Body / cover / underlay path:** Body 0 and Body 100 ink profiles are identical; Body only
  moves the cover minima. The defect is not in the cover path.
- **Feather fade:** CONFIRMED 2026-11-22 — the earlier clearance covered only the CORE lane
  (well inside featherStart ≈ 49 px at scale 1). The artist-visible line is the fringe fade
  itself at ±60–64 px, outside the ±48 probe band: pinning `featherFade = 1.0` collapses the
  enclosed lane 7.54 % / 231 px → −1.08 % / 9 px. The writer is the DEPTH MULTIPLY, not any
  one selector (see Resolution); the shipped fix removes it.
- **Every depth selector measured and eliminated (2026-11-22):** across noise 7.54 % / 231 px;
  2-D cell 11.66 % / 205 px; along-only 0.60 % / 10 px but an 18-doc-px tiled motif (artist
  UAT row 3 REJECTED); per-dab seed 2.20 % / 136 px with the Feather control nearly dead;
  smooth fade 0.30 % / 5 px but the white veil; monotone tip ramp −0.98 % / 13 px but the
  fringe at full core depth (control dead). No depth selector can pass line + tiling + feather
  — the partial deposit weight itself is the mechanism.
- **Size 12 reproduction:** the documented repro size was not the artist's; at the artist's
  engine scale (1.0) the lane exists and at canonical size 12 it does not. Not a defect
  premise, a measurement correction.

## Resolution

root_cause: §4.2's per-bristle value jitter is a REFLECTANCE multiplier in the reference (`brush.rgb * colorScale` in linear light, app.js:355; refill at app.js:849), but `Engine.beginBristles` applied it as a raw multiply on the palette's ABSORBANCE coefficients, and the carrier's refill target (`uPigmentA * state.w`, shaders.ts:891) repeated the same mistake. Each run of 3–16 bristles (≈3.3–17.6 px at 1.1 px spacing) shares one multiplier; 18 % of runs draw 0.80–0.92, which REDUCED delivered absorbance and laid the continuous pale lane. Measured: ink 1.75 vs 2.30 (mut1, +15..+18 px), 1.83–1.89 vs ~2.2 (mut2, +4..+12 px), dark 0.58 vs 0.70, cover untouched.
fix: The jitter maps into absorbance as a FLAT BAND OFFSET, the exact image of a reflectance multiply: `u = -ln(vj)` applied through the basis's level coefficients. `spectral.ts` exports `LEVEL_COEFFS` (the sum of each basis vector over the 38 bands); `Engine.beginBristles` uploads `pig[k] + u * LEVEL_COEFFS[k]` (rows past `count` unchanged); the carrier refill target becomes `uPigmentA + uLevelA * (-log(state.w))` with `uLevelA`/`uLevelB` bound in `carrierPass`. A raw coefficient scale (including the `2 − vj` mirror) was measured and rejected: it shifts hue (0.385/0.667/0.905 per channel for the probe colour at vj 0.8) instead of scaling all bands by vj. The medium record's Body 100 vs the artist's Body 0 is flagged; the record was NOT changed.
verification:
  probe_author_size: pass — one straight bristle-flat stroke, 1080×1080, size 35 (engine scale 1.0), artist record Body 0, press/speed unlinked
  lane_removed_seed_1: pass — bug lanes 1.908–1.970 and 1.747–1.762 replaced by 2.089–2.194 and 2.261–2.279; the former dark band becomes the reference's light-fibre run
  lane_removed_seed_2: pass — bug lanes 1.825–1.891 and 1.682–1.854 replaced by 2.337–2.370 and 2.153–2.309
  cover_unchanged: pass — cover profile identical to the bug capture at every sampled offset, both seeds
  body_pairing: pass — Body 0 and Body 100 ink minima identical (2.0136 @ +28 px); cover minima 0.3354 / 0.6711 @ +40 px
  surfaces_agree: pass — postApply == postSettle == postFix in all six captures
  watercolor_tests: pass — 39 files / 876 passed / 8 skipped (`pnpm --dir packages/efx-watercolor exec vitest run`)
  app_tests: pre-existing-failure — 9752 passed; one `physicPaintBridge.test.ts` full-suite contention failure reproduces identically on pristine HEAD (worktree /tmp/efx-head)
  typechecks: pass — `pnpm --dir app exec tsc --noEmit` exit 0; `pnpm --dir packages/efx-watercolor exec tsc --noEmit` exit 0
  baselines: not-refreshed — the five bristle baselines are already stale at pristine HEAD (261121 quicks); no automated gate consumes them; refresh must include this law
  feather_line_enclosed: pass — ENCLOSED 0.22 % / 9 px (mut1) and 0.01 % / 4 px (mut2) vs S2 7.53 % / 230 px and the feather pin −1.08 % / 9 px
  feather_tiling: pass — fringe coherence 0.094 / 4 % (mut1) and 0.064 / 0 % (mut2) vs S2 0.117 / 3.6 % and the rejected along-only law 0.396 / 33 %
  feather_ragged: pass — fringe tooth texture present (hpRms 0.22-0.33 at ±68-76 px; period 43-66 px), no across-row phase coherence; the smooth-veil floor on the same rows is 0.009-0.016
  feather_across_monotone: pass — core 0.69-0.72 → 0.68/0.51/0.42/0.17 at 68/72/76/80 px → paper by 96 px, both signs
  feather_surfaces_agree: pass — postApply == postSettle == postFix, both seeds
  feather_determinism: pass — `candC-thresh-mut1-s35-det` byte-identical to `candC-thresh-mut1-s35` (4665600 bytes)
  native_uat: PASSED row 4 — 2026-11-22 ~12:00 the artist approved the threshold-shift feather
    law verbatim: "beautiful now, Approbated UAT, congrats". Rows 1 and 3 had FAILED: ~10:18
    the artist still saw the ridge after the §4.2 law; ~11:17 the along-only law was rejected
    as a tiled motif. Row 2 (along-cap correction) is in the tree. The accepted state is
    writers 1 (§4.2 log offset) + 2 (running along cap) + 4 (threshold-shift feather); the
    along-only law (row 3) was fully reverted and is forbidden by negative pins.
  regression_pin: pass — `scattering.test.ts` §4.2 describe: flat band shift = -ln(vj) within
    the basis residual, display scales by vj, a coefficient scale shifts bands unequally, and
    the source rows pin both application sites while forbidding `pig[0]! * vj` /
    `uPigmentA * state.w`. Package gate after the pins: 39 files / 879 passed / 8 skipped.
residual_addendum: The post-§4.2 lane has a SECOND writer: the along cap on pure running dabs
  wrote a canvas-stationary across texture (fadeStreak via hairEnd) into the deposit's
  saturation level. Corrected by limiting the cap to exposedTrail > 0 / uEndCap = 1. Measured
  effect on the same probe pixels: interior band depth 6.9/6.3/9.2 % → 2.8/2.8/5.0 %; local
  pale-ridge prominence dark 3.9–4.6 % → 2.1–2.2 %, ink 5.7–7.2 % → 4.0–4.5 %.
feather_fade_addendum: The artist-visible continuous pale line is the LATERAL FEATHER FADE at
  the fringe (±60–64 px; outside the probe's original ±48-px band, which is why the earlier
  bisections missed it). root_cause: the fade scales the film's DEPTH, so a pale texel is a
  LOW-WEIGHT texel; the deposit lerp `ink <- ink*(1-a) + carried*a` then needs ~20 dabs (≈100
  px of travel) to converge where a ≈ 0.15, and each pale cell holds the pre-stroke (paper)
  film along the whole stroke (ENCLOSED 7.54 %, maxRun 231 px). Every depth selector was
  measured: across noise 7.54 % / 231 px; 2-D cell 11.66 % / 205 px; along-only 0.60 % / 10 px
  but an 18-doc-px tiled band MOTIF (artist UAT row 3 REJECTED); per-dab seed 2.20 % / 136 px
  with the Feather control nearly dead; smooth fade 0.30 % / 5 px but the white veil; monotone
  tip ramp −0.98 % / 13 px but the fringe at the core's own depth (control dead). fix: the
  film carries NO depth fade — Feather raises the §4.4 paper-tooth THRESHOLD at the lateral
  rim (`featherShift = uFeather * uFeatherShift * smoothstep(featherStart, uFeatherEdge,
  lateral)` with `BRISTLE_FEATHER_SHIFT = 0.35`; `threshold = uGrain*(1-height) - 0.25 +
  featherShift`; `float featherFade = 1.0;`), the
  same specks-over-paper mechanism the dry end already uses. The rim opens into full-depth
  specks whose rag is the paper tooth — no along period, no partial-weight window. verified:
  ENCLOSED 0.22 % / 9 px (mut1) and 0.01 % / 4 px (mut2); fringe coherence 0.094 / 4 % and
  0.064 / 0 % (the pin's floor); across profiles monotone; postApply == postSettle == postFix;
  byte-identical re-run; F0 untouched by construction (the shift is uFeather-scaled).
postmortem:
  why_not_caught: "The phase's probe gates measure the cover alpha, the alpha spread and the edge census — never the delivered ink's spectral VALUE. The reference's colour multiplier was ported into the wrong space (absorbance instead of reflectance) and no gate compared a bristle film's hue/darkness against the reference law. The fringe fade was also outside the probe's default band: the gate must span the full brush, not the interior."
  guard: "The medium-engine `bristle-line` scenario reports three-channel across-stroke profiles (cover / film darkness / delivered ink) at three surfaces and two seeds over the FULL brush (`--band 140`), PLUS the ENCLOSED-line statistic and the TILING gate (per-row periodogram + fringe-row coherence — the enclosed-line statistic alone passed a law the artist rejected as a tiled motif). The feather law is pinned in scattering.test.ts to the threshold shift with the measured numbers, with negative pins forbidding every depth selector that was measured (lateralFade / raggedFade / fadeAlong)."
  artifact: "This debug file, the `/tmp/medium-engine/line-*`, `residual-*`, `fix-level-*`, `fix-alongcap-*`, `fix-ragged2d-*`, `fix-fadealong-*`, `s2-tiling-*`, `candA-tipramp-*`, `candB-tipstreak-*` and `candC-thresh-*` captures + PNGs (plus `compare-fadealong*.png`, `compare-line-3x.png`, `compare-fullmark.png`, `crop2x-*`, `edge4x-*`), and the law comments in shaders.ts / bristles.ts / spectral.ts / Engine.ts."

## Artist UAT row (pending)

Row 1 — §4.2 log-offset law (FAILED 2026-11-22 ~10:18; the fix is live, the lane persists;
see Current Focus).

Row 2 — residual along-cap correction (PENDING; PARTIAL fix, do not close on it):
- Paint ONE Bristle-Flat stroke at your normal settings (Body 0) on bare paper, and one
  crossing an earlier stroke. Expected: the pale ridge is HALVED but a faint residual may
  remain — this row is a magnitude check, not a pass/fail gate on its own.
- Watch the mark WHILE drawing (the live front): the leading edge of a running dab no longer
  carries the along cap; the lifted result is shaped by the catch-up end dab as before. Report
  any "hard live front" the moment you see it — that is the face UAT of this change.
- Evidence to compare: BEFORE `/tmp/medium-engine/residual-mut1-s35-transparent.png`,
  `residual-mut2-s35-transparent.png`; AFTER `/tmp/medium-engine/fix-alongcap-mut1-s35-*`,
  `fix-alongcap-mut2-s35-*`; decomposition `fix-flatgrain-mut1-s35-*`. Across-profile JSONs:
  `residual-mut1-s35.json` / `residual-mut2-s35.json` vs `fix-alongcap-mut1-s35.json` /
  `fix-alongcap-mut2-s35.json`; bisect ladder `bisect-vjoff-*`, `bisect-flatgrain-*`,
  `bisect-body1-*`, `bisect-alloff-*`, `bisect-capA-*`, `bisect-capB-*`, `bisect-caps-*`.
- Not covered by the probe (needs the live brush): Bristle-Round, a refill > 0 record, and the
  live display composite (the probe's darkness metric is film-only; the display amplifies).
- Original §4.2 evidence for reference: BEFORE `line-mut1-s35-*` / `line-mut2-s35-*`; AFTER
  `fix-level-mut1-s35-*` / `fix-level-mut2-s35-*`; Body-100 `fix-level-body100-s35-*`.

Row 3 — along-only feather-fade law (FAILED 2026-11-22 ~11:17; verbatim: "its worser now …
the white seams created like a motif (tiled) … now we have seams repeats on boths side of the
stroke"). REJECTED; not in the tree.

Row 4 — threshold-shift feather law (CURRENT ACCEPTANCE ROW; probe: enclosed lane 0.22 % /
9 px and 0.01 % / 4 px, fringe coherence 0.094 / 4 % and 0.064 / 0 %, both seeds — the
Feather now OPENS the edge instead of thinning it; only your eye can confirm):
- Paint ONE Bristle-Flat stroke at your normal settings (Body 0) on bare paper, and one
  crossing an earlier stroke. Expected: NO continuous pale/white line and NO repeated bands
  along the stroke. The edge should read as a DRY-BRUSH fringe: full-strength paint specks
  thinning into the paper, the way the stroke's end already breaks up — the speck pattern
  follows the paper, it does not repeat along the mark. A ragged dry edge is the intent; a
  line, a pale veil, or a rhythmic band motif is a fail.
- Watch the mark WHILE drawing too. Expected: the specks appear as the leading edge passes,
  the released result matches what you saw live; report any hard live front or band.
- The Feather slider should now widen/narrow that speck fringe rather than fading the body.
  If that is NOT what you want Feather to do, say so — that is a control-semantics decision,
  not a bug.
- Evidence to compare: BEFORE `/tmp/medium-engine/s2-tiling-mut1-s35-*` (the pale lane at
  ±62 px; byte-metric-identical to `base-recheck-mut1-s35-*`), `fix-dabseed-mut1-s35-*`
  (2.2 % residual), `fix-fadealong-mut1-s35-*` (the rejected motif); AFTER
  `/tmp/medium-engine/candC-thresh-mut1-s35-*` / `candC-thresh-mut2-s35-*`; visual crops
  `edge4x-s2-tiling-mut1-s35.png` (the line) vs `edge4x-candC-thresh-mut1-s35.png` (the dry
  fringe), `crop2x-*`. Metrics JSONs: `s2-tiling-mut1-s35.json` vs `candC-thresh-mut1-s35.json`
  / `candC-thresh-mut2-s35.json` (ENCLOSED row + TILING block).
- Not covered by the probe (needs the live brush): Bristle-Round, a refill > 0 record, the live
  display composite, a stroke over wet earlier paint, and the Feather slider's full sweep
  (F0 is untouched by construction; F100 not captured).
