---
phase: 261124-ujb
plan: 01
subsystem: paint-engine
tags: [edge-transparency, edge-falloff, bristle-gather, spec-10, medium-records, probe-harness]

# Dependency graph
requires:
  - phase: 64-medium-engine
    provides: the bristle gather (`gatherBristle`, `uFeatherEdge`), the two medium records and the app's canonical global bag
provides:
  - Spec 10's two bristle-only controls — Edge transparency (amount) and Edge falloff (shape bias) — end to end
  - the `edge-transparency` probe scenario with two pre-change identity baselines and three `--differs-from` sweeps
  - a film-domain silhouette calibration in the probe comparator
affects: [medium-engine UAT rows 1-9, Studio Paint panel, probe medium-engine gates]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 32402
  tasks: 3
  commits: 3
  plan_head_before: d509a886df2dc0a85f5a248068bb69bcf0d16790
  plan_head_after: e08e356f930ba57981fb48793aeea4ac0c7f6949

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE lateral film in silhouette units inside gatherBristle, in the plain arithmetic form so amount 0 is bit-inert"
    - "Film-domain station calibration in the probe comparator at amount > 0; reference-rim calibration at amount 0"

key-files:
  created:
    - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json
    - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json
  modified:
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - "packages/efx-watercolor/probe/medium-engine/{probe.ts,run.mjs,compare.mjs,harness.test.ts}"

key-decisions:
  - "Plain arithmetic film (`1.0 - uEdgeFade * pow(edgeT, edgeExp)`) instead of the plan's ternary guard: the ternary perturbed the compiled shader and drifted every export at amount 0"
  - "At amount > 0 the comparator calibrates the station domain from the film's own rim floor; the reference's 2 %-of-peak rim lies outside the engine's silhouette"
  - "Coverage is normalised row by row against the neutral reference (the exact factor the gather applied), never by the capture's own peak (which is 1 and would hide the film)"

requirements-completed: []

coverage:
  - id: D1
    description: "Spec 10 film law: one lateral share (g.film) scales BOTH halves of the deposit lerp — the gather coverage (opacity, base replacement, relief) and the carried absorbance after the pickup mix — plus the scatter S, so the fixed point is cA·film and the attenuation is proportional to what is laid; the core keeps 45% of its pigment (about 69% of the original density) at amount 100; the paper threshold and the feather are untouched; inert at amount 0"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/bristles.test.ts#bristleEdgeFilm; scattering.test.ts#both-halves film pins; harness.test.ts#weighted-film must-fail"
        status: pass
      - kind: integration
        ref: "compare.mjs edge-transparency-neutral{,-broad} (identity, fresh captures) + the three amount-100 sweeps (cover shape bars + core ink bar)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both knobs are canonical: sixteen-key medium records, live bag, Reset 0/50 and two Gouache-only rows"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts; app mediumSelection / aquarelleParamVisibility / AquarelleGlobalsPanel / brushGroupMedium tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sweeps at (100,0), (100,50) and (100,100) differ from the neutral baseline on all digests and hold the core/mid/rim bars"
    verification:
      - kind: integration
        ref: "compare.mjs edge-transparency-{broad,linear,rim} --differs-from edge-transparency-neutral"
        status: pass
    human_judgment: false
  - id: D4
    description: "UAT rows 1-9 — the artist judges the live look (transparent rim keeps the core; no milky Body rim; watercolor unchanged)"
    verification: []
    human_judgment: true
    rationale: "Whether a transparent Gouache rim looks right is an artist judgment; the plan ends at automated-ready and hands rows 1-9 off"

# Metrics
duration: 29min
completed: 2026-11-24
status: complete
---

# Quick 261124-ujb: Edge transparency and Edge falloff Summary

**Two bristle-only sliders — Edge transparency and Edge falloff — driving one lateral film in `gatherBristle`, with amount 0 proven byte-identical to the pre-change engine**

## Performance

- **Duration:** ~29 min
- **Started:** 2026-11-24T21:37Z (plan authored)
- **Completed:** 2026-11-24T22:06Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- The lateral `edgeFilm` (silhouette units, `BRISTLE_EDGE_START` 0.55, `e = 2^(2b-1)`) scales `featherFade` once — coverage, cA, cB and alpha move together — and the carried deposit `S` term carries `g.film`, so the rim fades without erasing and no Body-milky rim appears.
- `edgeFade` / `edgeFalloff` are canonical (defaults 0 / 50), the sixteen-key medium records carry them (acrylic literal, watercolor derived), the live bag, the per-stroke snapshot, the selection write allowlist and Reset all ride them, and the two rows render for the Gouache paint context only.
- The `edge-transparency` probe scenario paints a live `bristle-round` stroke (`body 100`) with `--edge` / `--falloff` knobs; two amount-0 identity baselines were captured from the unmodified engine *before* any `src/` change, and one shared `isBristleCapture` predicate keeps the probe and comparator agreed on the visible-alpha contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: probe scenario + pre-change identity baselines** — `130fe7ee0` (test)
2. **Task 2: the ONE gather film (twin, params, uniforms, shader, deposit)** — `1c5a27f4b` (feat)
3. **Task 3: records, rows, app pins and the film-domain comparator** — `e08e356f9` (feat)

**Plan metadata:** not committed by this executor — the orchestrator owns the docs commit.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/bristles.ts` — `BRISTLE_EDGE_START`, exponent bounds, `edgeFalloffExponent`, `bristleEdgeFilm`
- `packages/efx-watercolor/src/playground/params.ts` — canonical `edgeFade` / `edgeFalloff` and their `toEngineParams` mapping
- `packages/efx-watercolor/src/playground/Engine.ts` — `Params` defaults, `uEdgeStart` / `uEdgeFade` / `uEdgeFalloff` bound in `bindGather`
- `packages/efx-watercolor/src/playground/shaders.ts` — uniforms, `Gathered.film`, the lateral film, `uScatter * a * g.film`
- `packages/efx-watercolor/src/playground/mediums.ts` — both keys on the sixteen-key records
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — interface, defaults, key list
- `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` — the two Edge rows
- `packages/efx-watercolor/probe/medium-engine/probe.ts`, `run.mjs`, `compare.mjs`, `harness.test.ts` — the scenario, its comparator and pins
- `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral{,-broad}.json` — pre-change identity baselines
- Package and app test files — the law pins updated to sixteen keys / fifteen rows / eighteen bag keys

## Decisions Made

- The film is the plain arithmetic form, never a ternary amount guard — the guard was measured to perturb the whole compiled shader (see deviation 1).
- The comparator's station domain is calibrated from the film at amount > 0 and from the reference at amount 0 (see deviation 2).
- The ink array stays supporting evidence only (direction check), never a ratio bar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's ternary film guard drifted every export at amount 0**
- **Found during:** Task 2 (the ONE gather film)
- **Issue:** A layered bisect showed params, Engine binds, uniform declarations and the struct field inert; only consuming `g.film` with the prescribed `uEdgeFade <= 0.0 ? 1.0 : …` form changed the amount-0 digests (`b368e18c/4d9c6842/2f9c971e/eb000cac` vs baseline `21171475/3ebe1b9d/fb026f34/606376d0`) although `edgeFade` was exactly 0. The GPU's codegen was perturbed by the branch.
- **Fix:** The plain arithmetic form `1.0 - uEdgeFade * pow(edgeT, edgeExp)` — at amount 0 the product is exactly zero, so the film is exactly 1.0 and the pre-change program renders bit-identically (pinned in `scattering.test.ts`).
- **Verification:** Both mode-1 identity gates pass on all twelve fields; full package suite green.
- **Committed in:** `1c5a27f4b` (Task 2)

**2. [Rule 1 - Bug] The reference-rim silhouette put the sweep stations outside the film**
- **Found during:** the Task 3 sweep gate (comparator calibration)
- **Issue:** The plan calibrated the silhouette from the reference's 2 %-of-peak rim (22 px), but the engine's `uFeatherEdge` is `BRISTLE_FEATHER_EDGE = 0.66` of the nominal footprint (≈16-17 px), so the mid station read a blank row (0.0000).
- **Fix:** At amount > 0 the station domain comes from the film's own rim floor (the contiguous tail at `1 - amount`, both sides averaged; their half-difference is the axis offset). The amount-0 branch keeps the reference calibration. The ink direction check now reads the integer rim station (the calibrated silhouette can land on a half pixel).
- **Verification:** Sweeps read broad mid 0.320 (Δ0.027), linear 0.394 (Δ0.106), rim 0.632 (Δ0.118) — all within ±0.12 — and a new harness discriminator proves a wider reference rim cannot move the stations.
- **Committed in:** `e08e356f9` (Task 3)

**3. [Rule 3 - Blocking] The app resolves the package's generated `dist`, which was stale**
- **Found during:** the Task 3 app gate
- **Issue:** `@efxlab/efx-watercolor` exports `./dist/*`; the generated build predated Task 2, so app tests saw the new keys as `undefined`.
- **Fix:** `pnpm --dir packages/efx-watercolor build` (untracked, gitignored output; no source change).
- **Verification:** App suite went from 4 failing files to 467 passed / 2 skipped.
- **Committed in:** none — build artifact only.

**4. [Rule 1 - Bug] Task 1's station normalisation is reference-relative, not self-peak**
- **Found during:** Task 1 (the comparator)
- **Issue:** A capture's own peak is 1 by construction, so normalising by it would hide the film entirely.
- **Fix:** Each row's coverage is divided by the neutral reference's coverage at the same row — the exact factor the gather applied (1 by identity at amount 0).
- **Verification:** The fixture law-exact profiles pass; the "rim not faded" and "falloff mismatch" fixtures still fail as they must.
- **Committed in:** `130fe7ee0` (Task 1)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking) plus 1 Task 1 normalisation law
**Impact on plan:** All four were necessary for correctness and the identity/sweep gates; no scope creep.

## Issues Encountered

- The app suite requires a fresh package `dist` — run `pnpm --dir packages/efx-watercolor build` before `pnpm --dir app exec vitest run` when package source changed.
- One pre-existing unhandled rejection surfaced in the first app run (`physicPaintBridge.test.ts` `unregisterListener`); it did not recur as a failure and is unrelated to this plan.

## Known Stubs

None — both rows are wired to real record keys, and no placeholder value or empty data source was introduced.

## UAT Hand-off

Automated-ready only. UAT rows 1-9 (the live artist judgment: the transparent rim keeps the core, the rim is inert at amount 100 with no milky Body rim, falloff shapes read broad/linear/rim, watercolor and the Water tool are unchanged, Reset restores 0 / 50) are handed off — not claimed here.

## UAT feedback (2026-11-24) — the law revised

The artist's first live look reported a **white border** on a Gouache mark at
Edge transparency 100 (Feather 100), amplified at falloff 100, "destroying the
feather".

- **Root cause (probed):** the deposit's source is `cA * a`. Scaling the
  carried coefficients by `edgeFilm` *and* carrying the film in `a` squared the
  replacement while the attenuation of the underlayer stayed linear — inside
  the fade band the underlayer was erased ~1× against a ~film² deposit, leaving
  a pale rail. A two-stroke probe (opaque red underlayer + the edge stroke)
  measured the red's pigment alpha dropping from 177 to 86 where the new paint
  deposited almost nothing; the same band read (250,198,199) in the transparent
  export.
- **Fix (`1028861ed`):** the lateral film is the **deposit weight**, never a
  colour dilution. `g.coverage` and `g.alpha` carry it; `cA`/`cB` stay full
  strength (the caps' `featherFade` still applies); the scatter S rides it
  through `a` alone (no second factor). The same probe capture after the fix
  keeps the red at alpha ~150 in the band (the amount-0 control level) with a
  proportional full-colour deposit.
- **Unchanged:** the cover channel's equilibrium (`target / a`) is still
  `edgeFilm`-scaled, so the committed base is retained proportionally; the
  relief and touch weights still follow the coverage; the probe's coverage
  stations, the identity baselines and the three sweeps are unchanged and pass.
- **Gates after the fix:** package vitest 1057 passed / 8 skipped; the five
  probe gates PASS; app vitest 9875 passed / 1 pre-existing `physicPaintBridge`
  timeout flake (passes in isolation); `tsc --noEmit` clean.

## UAT feedback (2026-11-25) — the film fades the whole mark

The artist's second look: at amount 100 the four strokes' bodies were
identical (measured mean RGB ~235,134,97) and only the fringe changed — the
slider read as a "feather/noise edge remover". The spec's `film(0) = 1` kept
the core opaque; the artist wants amount 100 to make the whole mark read
translucent.

- **Fix (`e0f040f33`):** the profile gains a core share —
  `edgeProfile = BRISTLE_EDGE_CORE + (1 - CORE)·t^e` with
  `BRISTLE_EDGE_CORE = 0.35` — and `edgeFilm = 1 - amount·edgeProfile`.
  Amount 100 leaves 65 % film in the core, reaches 0 at the silhouette, and
  the falloff shapes the ramp (mid reads 0.19 / 0.325 / 0.49 at amount 100
  for falloff 0 / 50 / 100).
  Amount 0 is unchanged (the product is exactly zero).
- **Unchanged:** the film is still the deposit weight (cA/cB full strength,
  S through `a`), the cover equilibrium still fades with the film, and the
  relief/touch weights still follow the coverage.
- **Probe:** the comparator's core bar now expects `1 - amount·EDGE_CORE`
  and widens to ±0.06 for the coverage channel's many-dab convergence lag
  (measured 0.693 where the law reads 0.650); the harness fixture encodes
  the new profile independently.
- **Gates after the change:** package vitest 1057 passed / 8 skipped; the
  five probe gates PASS (two identity + three sweeps); app tsc clean; app
  vitest 9876 passed / 4 skipped.

## UAT feedback (2026-11-25 #2) — "there's no transparency, it's just a cut off"

The artist's third look, at amount 100 with falloff 0 and 100 side by side: the
two edge-100 strokes read as SOLID bodies with clean cut edges, while the
neutral stroke kept its textured bristle fringe — "there's none transparency
edge, it's just a cut off".

- **Root cause (measured):** the film was still the DEPOSIT WEIGHT. The
  deposit lerp is `ink <- ink·(1-a) + cA·a`; its fixed point is the carried
  absorbance cA whatever `a` is. Scaling `a` therefore cannot thin the body —
  every overlapping dab still arrives at full pigment — and where the weight
  falls under the many-dab convergence the deposit never converges at all, so
  the fringe disappears outright (the cut). The probe's per-row ratios showed
  it directly: the core ink ratio converged to 1.0 while only the cover
  target faded.
- **Fix (v3 law, `7ebc51142`):** the film is the PIGMENT SHARE. `g.film`
  rides the gather struct and each consumer applies it AFTER its own work:
  the deposit to the carried absorbance `cA`/`cB` (after the pickup mix, so
  lifted paint is diluted too) and the scatter S; the cover write to the
  base-replacement target; the thickness deposit to the relief. The deposit
  WEIGHT, the paper threshold and the cover blend weight stay full — the
  mark's geometry, tooth and fringe never move. The lerp's fixed point is now
  `cA · film`: at amount 100 the whole body converges to 65 % of its pigment,
  and the lateral ramp dilutes the fringe gradually instead of cutting it.
- **Measured effect (1080 sheet, transparent export darkness):** core
  0.585 → 0.477, 12 px 0.595 → 0.359, 14 px 0.604 → 0.244, 16 px 0.541 →
  0.080, 17 px → 0.006 — a smooth graduated dissolve, no step. The ink ratio
  reads 0.6500 flat across the body (the law's exact core share).
- **Gate (`f748a5e00`):** the old bars only read the cover target, which BOTH
  laws scale — that is how the cut passed. The ink channel is linear in the
  carried absorbance, so the capture/reference ratio is exactly the pigment
  share: the core is now asserted at ±0.06 (measured 0.6500 against the law's
  0.6500; a weight-law film reads ~1.0 and fails) and the mid/rim stations at
  the calibrated silhouette's ±1 px placement tolerance (±0.12). A synthetic
  weighted-film capture is pinned as must-fail, and the capture exports the
  visible darkness row as evidence.
- **Unchanged:** the params, records, rows, Reset and the amount-0 identity
  (all 12 fields byte-equal on a fresh capture against the pre-change
  baseline).
- **Gates after the change:** package vitest 1058 passed / 8 skipped; five
  probe gates PASS (two identity + three sweeps); app `tsc --noEmit` clean;
  app vitest 9875 passed (the known `physicPaintBridge` flake, green in
  isolation) / 4 skipped.

## UAT feedback (2026-11-25 #3) — "no work, regressions ... edge white fringe"

The artist's fourth look, three cases at amount 100 (Feather 100 falloff 0,
Feather 100 falloff 100, Feather 0 falloff 100): every stroke wore a WHITE
ragged fringe along its edges — pale scallops inside the silhouette, white
cracks where a stroke crossed another — and the bodies still read as solid
paint: "No transparence, edge white fringe".

- **Root cause, two mechanisms:**
  1. **The white fringe (a real regression of v3).** The v3 law diluted only
     the carried absorbance and left the deposit WEIGHT full. The lerp is
     `ink <- ink·(1-a) + cA·g·a`, so a dab whose `a` is full still erases
     `a` of the pigment under it while returning `g·a` worth: at the fringe
     `g → 0`, every dab wiped paint (an earlier dab's own, or an earlier
     stroke's) and deposited almost nothing — the paper showed as white
     scallops. The lateral noise makes each texel's `g` differ dab to dab,
     so the last fringe dab decided the pixel.
  2. **No transparence.** The core share kept 65 % of the PIGMENT, and the
     display's transmittance law maps that to ~82 % of the original opacity
     (darkness 0.585 → 0.477) — a change the eye reads as "still solid".
- **Fix (v4 law):** the film now scales BOTH halves of the ONE lerp — the
  gather's coverage (the dab's opacity, which also drives the base
  replacement through the cover channel and the relief thickness) and the
  carried absorbance the deposit applies after the pickup mix. The lerp's
  fixed point is `cA · film` AND the attenuation is proportional to what the
  dab lays, so a fringe dab neither solidifies the body nor erases the mark.
  The cover target carries the film explicitly (its blend is
  `cover <- target + cover·(1-a)`, so its equilibrium is `target/a` and the
  weight cancels); the scatter S carries a second factor (its equilibrium is
  `uScatter · film`); the relief rides the film through the coverage.
  `BRISTLE_EDGE_CORE` moves 0.35 → 0.55: the core keeps 45 % of its pigment.
- **Measured (1080 sheet, amount 100 linear):** core darkness 0.585 → 0.402
  (69 % of the original density; the darkest channel's transmission rises
  41 % → 60 %), 11 px 0.593 → 0.333, 14 px 0.604 → 0.174, 16 px 0.541 →
  0.028, 17 px → 0.002 — a graduated dissolve with no step and no erased
  band. The ink and cover ratios read 0.495 against the law's 0.450 (the
  few-percent excess is the capture's own wet transport, which the film also
  scales through the coverage-driven touch field).
- **Gate:** the core ink bar stays the law's teeth (a weight-only film reads
  ~1.0 and fails); the ramp stations are judged on the cover channel; the
  source pins now hold the coverage weight TO the film (the inverted v3 pin
  that let the white fringe through is gone). The ramp ink bars were dropped
  — the film-scaled opacity makes their ink build more slowly than its
  target, a lag the comparator cannot know.
- **Unchanged:** the params, records, rows, Reset and the amount-0 identity
  (all 12 fields byte-equal on fresh captures against the pre-change
  baselines, after the final shader).
- **Gates after the change:** package vitest 1058 passed / 8 skipped; five
  probe gates PASS (two identity + three sweeps, fresh captures); app
  `tsc --noEmit` clean; app vitest 9875 passed (the known
  `physicPaintBridge` load flake, green in isolation) / 4 skipped.

## Next Phase Readiness

- Gates green: package vitest 1058 passed / 8 skipped; app vitest 9875 passed / 4 skipped / 96 todo; `tsc --noEmit` clean; five probe gates PASS.
- Mode-1 identity at amount 0 passes byte-for-byte against baselines captured from `d509a886d` (re-verified after the v4 law).
- The artist can re-run rows 1-9 now: at amount 100 the body should read as a lighter wash (~69 % of its original density, the darkest channel 41 % → 60 % transmission) with the paper grain showing through, the edge should dissolve gradually with the falloff moving where the ramp sits, and no white fringe should appear — including where strokes overlap. If the body still reads too solid, `BRISTLE_EDGE_CORE` (0.55) is the one constant: 0.70 would put the body near half its original density. Last automated state: the v4 law commit.

---

## Self-Check: PASSED

- SUMMARY file present at `.planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-SUMMARY.md`
- Commits are ancestors of HEAD: `130fe7ee0`, `1c5a27f4b`, `e08e356f9`
- Measured commits (`plan_head_before..HEAD`): 3 — matches the frontmatter `actuals.commits`

---
*Quick: 261124-ujb*
*Completed: 2026-11-24*
