# 260924-stb Diagnosis Verdict

quick-260924-stb · physics intensity must scale with local stroke width
Calibrated 2026-09-24 from uncommitted scratch measurements (prototype `scaledLocalStep` proven byte-identical to `localFluidPhysicsStep` with f ≡ 1 across all 18 substrate × cell combinations before any bound was read off it).

## Carrier verdict

**Winner: (c) distance/erosion field from raster alpha** — concretely a run-length (erosion-style) width field, `run = min(h-run, v-run)` over `inside ⇔ alpha > 20`, computed ONCE per settle from the deposited raster, mapped onto the local Stam grid, bounded to the engine local bbox. It is derived from the exact raster the solver already consumes, so it cannot drift from what is being settled.

Winner's files: **`packages/efx-physic-paint/src/core/fluids.ts` only** — the field builder plus an `f(localWidth)` multiplier applied inside `createLocalFluidPhysicsContinuation` at the height-equalization source call (fluids.ts:578 → the source terms at fluids.ts:233-234). No transfer-signature change, so `core/wet-layer.ts`, `brush/paint.ts`, and `types.ts` stay untouched.

Line-level evidence for the chosen carrier:

- fluids.ts:572 — `waterHeight[...] = wet.alpha[...]` (the solver's height field IS the raster alpha; width can be read from the same source).
- fluids.ts:577-578 — per-tick `addHeightEqualization(localW, localH, u0, v0, waterHeight, config.omega_h)` — the injection point for `f(localWidth)`.
- fluids.ts:233-234 — the equalization sources themselves: `u0[idx] += omega_h * (waterHeight[left] - waterHeight[right])` (+ y twin).
- fluids.ts:552-556 (mask build, `alpha > 20`) and 580-581 (`darkenEdges` per tick) — the second velocity source, same raster threshold the width field reuses.
- Scratch structural proof: the prototype orchestrator with `f ≡ 1` reproduces `localFluidPhysicsStep` byte-for-byte on every substrate × water × paper cell → adding the field + multiplier changes nothing unless `f < 1`.

Rejected options:

- **(a) per-point deposit path — rejected.** `depositToWetLayer` (wet-layer.ts:162) is not on the production transfer path; the engine rasterizes then transfers via `transferToWetLayerClipped` (paint.ts:529, 576, 642 → wet-layer.ts:423). Modulating deposit alpha at the per-point path is also the m7w 24f40261 alpha-carry failure class (revert 1648658b) — forbidden outright by PIN 0.
- **(b) companion width mask at the raster seam — rejected as strictly dominated.** curve + radius are in scope at all three transfer call sites, but a companion mask must be threaded through the transfer signature and kept consistent with `ribbon` + `deformN` rasterization (point radius ≠ raster width after edge-detail deform). Carrier (c) needs no caller change and reads the raster itself — no sync surface, smaller diff, same information.
- **(d) weighting wetness writes by ribbon radius — FALSIFIED by measurement.** With the bbox fixed: settled alpha digests are byte-identical for water 0.1 vs 0.9, and byte-identical when the wetness write is zeroed entirely. Wetness never feeds the Stam velocity sources (structural: fluids.ts:614/649 only copy wetness through advection; equalization reads `waterHeight = wet.alpha` at 572; darkening reads the `alpha > 20` mask at 556/581). The only water→settle dependence is the engine bbox margin formula (`margin = ceil(2 + waterCurve*brushR*0.6 + spreadCurve*brushR*0.4)`) — a grid-extent artifact, not physics fuel. Scaling the wetness write alone does NOT move settle.

## Quantities that scale

**Wetness write vs alpha-driven velocity sources — answered and measured: wetness is OUT, alpha-driven velocity sources are IN.** The wetness falsification above is direct: zeroing or scaling the wetness write leaves settled digests byte-identical. The settle behavior (spread of the hairline, dilution of the thin body) is produced entirely by the two alpha-driven velocity sources.

What scales:

1. **Height-equalization source strength** (fluids.ts:233-234, invoked at 578) multiplied per source cell by `f(localWidth)` with a residual floor:

   ```
   f(run) = 0.25 + 0.75 * clamp((run - wFloor) / (wFull - wFloor), 0, 1)
   wFloor = 4,  wFull = 6
   run    = min(h-run, v-run) over inside ⇔ alpha > 20, computed once from the deposit
   ```

   The 0.25 residual floor is measured, not aesthetic: with a hard zero on thin cells, the global pressure projection collapses thick-stroke spread too (null-paper default-water thick d(b) 1 → 0); with the 25% floor it stays 1 → 1 while thin still pins to its deposit footprint in every cell.

2. **Edge darkening (fluids.ts:581) is NOT modulated.** Measured: darkening-only modulation leaves thin inflation unchanged in all cells (thin excess visible width unchanged) — equalization is the thin-inflation driver; equalization-only modulation pins thin while preserving thick d(b) under the floor above.

In / out of scope:

- **Granulation (D-09) / adsorption (D-08) / subtractive mixing (D-10): OUT.** Deposit arithmetic keeps its base expressions (PIN 0 law). The carrier never writes the deposit stage.
- **Emboss: OUT** — no emboss term exists in the settle path.
- **Determinism:** `f` is a pure function of the deposited raster (no RNG, no wall clock). Width field computed once before tick 0; bbox-bounded like the solver itself.

## Pin bounds proposal

Measurement substrate (shared by all pins): pressure gesture, brush radius 10, `pThin = 0.1134` → drawn thin **2.025 px** at THIN_X = 44, drawn thick **19.865 px** at THICK_X = 68; canvas 128×64; `K_TICKS = 3`; `FLUID_CONFIG {viscosity: 0.0001, omega_h: 0.06, darkening: 0.1}`; waters {10, 50, 90} (50 = app default, `EfxPaintEngine.ts:599 waterAmount: 50`); papers {null, synthetic}; `ALPHA_FLOOR = 125`, `VISIBLE_THRESH = 13`; regions: thin x ∈ [40, 48], thick x ∈ [64, 76], body threshold `max(200, plateau * 0.9)`.

### W1 — hairline tolerance: **tol = 3.0 px**

`W_visible(thin) ≤ W_drawn(thin) + 3.0` in every cell (2 papers × 3 waters).

- Base measured visible widths: null 6 / 4 / 5, synthetic 5 / 5 / 6 → excess 3.975 / 1.975 / 2.975 / 2.975 / 1.975 / 3.975.
- **Base prediction: RED** — cells null-w10 and synthetic-w90 (excess 3.975 > 3.0; limit 5.025 px).
- **GREEN prediction: PASS** — prototype pins thin settle to its deposit: visible = 4 in all 6 cells → excess 1.975 ≤ 3.0 (integer headroom: GREEN may drift to v = 5 and still pass).

### W2 — thick still spreads (control): **floor = 1 px**

At default water (50), both papers: `d(b) = W_settle − W_deposit` at the thick cross-section ≥ 1 (the pyp/rm2 texture idiom).

- Base: null 1, synthetic 2 → **PASS at base** (control).
- GREEN (prototype): null 1, synthetic 1 → **PASS at GREEN**, no margin below the floor.

### W3 — monotone law: **physics-induced relative inflation, thin ≤ thick**

`(W_settle − W_deposit) / W_drawn` at the thin cross-section ≤ same at the thick cross-section, every cell. `W_*` here use the established stage-wise `widthFromAlpha` (ALPHA_FLOOR) idiom — exactly the harness's own d(b) machinery.

**Recalibration of the literal `(W_visible/W_drawn − 1)` form, performed now, pre-RED, under this section's joint-satisfiability clause.** Structural unsatisfiability proof: the locked keep-gate + `(a/255)*3000` deposit and the AA fringe give every stroke a visible floor of roughly drawn + 2 px (relative floor ≈ 0.97 for a 2.025 px hairline), while thick-stroke zero-physics relative inflation is ≈ 0.05 — fringe is an absolute-width phenomenon, not a proportional one. No mechanism that keeps PIN 0 locked can make `rel_thin ≤ rel_thick`; the literal law would require the 19.87 px stroke to settle at ~39 px. The physics-induced numerator preserves the plan's intent ("thin penalized harder than thick" = the physics component) while excluding the locked deposit quantization both sides share.

- Base physics inflation: thin 0.987 / 0 / 0.494 / 0.494 / 0.494 / 0.987 vs thick 0.050 / 0.050 / 0.201 / 0.101 / 0.101 / 0.101.
- **Base prediction: RED** — fails in 5 of 6 cells (only null-w50 passes at base).
- GREEN: thin 0.000 (settle = deposit everywhere) ≤ thick 0.050-0.101 (d(b) ≥ 1 in every cell) → **PASS in all 6 cells**.

### W4 — PIN 0 / PIN 0b (opacity law, control)

- PIN 0: body deposit ratio ∈ [0.99, 1.01] of `(a/255)*3000`, both regions × all 12 cells. Measured `[1.0000, 1.0000]` — the carrier never touches the deposit stage. **PASS at base and GREEN.**
- PIN 0b base literals (meanAlpha / meanDisplay), asserted post-settle at ≥ 0.95 × literal:

  | paper | water | thin α | thin disp | thick α | thick disp |
  |-------|-------|--------|-----------|---------|------------|
  | null | 10 | 2609.81 | 245.61 | 2828.31 | 252.64 |
  | null | 50 | 2615.41 | 245.83 | 2838.81 | 253.16 |
  | null | 90 | 2359.55 | 220.78 | 2859.92 | 254.84 |
  | synthetic | 10 | 2599.17 | 243.06 | 2873.23 | 252.58 |
  | synthetic | 50 | 2609.84 | 245.44 | 2884.11 | 253.43 |
  | synthetic | 90 | 2389.93 | 218.22 | 2905.78 | 254.42 |

  GREEN/base ratios measured with the prototype: thin **1.0730-1.2095** (thin body is *restored* — at base, high water dilutes the hairline body to 2359/2389, exactly the reported failure; the carrier pins it back to ~2800), thick **0.9934-0.9998**. Min 0.9934 ≥ 0.95 → **PASS**. Base run reproduces the literals exactly (ratio 1.0) → control PASS at base.

### W5 — determinism (control)

Two identical gesture runs → byte-identical deposit AND settled alpha digests. `f` and the width field are pure functions of the deposit (LCG-seeded substrate, no RNG/clock in the scaling path). **PASS at base; PASS at GREEN.**

### Joint satisfiability

W1 tolerance implies W3 given the W2 floor:

1. `tol(W1) = 3.0 ≥ q + thinPhysics = 1.975 + 0` — the tolerance absorbs the locked deposit quantization `q` with 1.025 px margin, and the carrier's measured GREEN thin physics component is 0 (settle ≡ deposit in every cell), so W1's bound is reachable.
2. The carrier pins thin physics inflation to **exactly 0**, and `0 ≤ anything` — therefore W3 holds in every cell in which thin is pinned, independent of thick's exact value. W2 floor = 1 px guarantees the thick side is strictly positive at default water (relative 0.050), so W3 is a real inequality there, not a 0 ≤ 0 tautology.
3. Conversely, W3's base failure (thin physics 0.49-0.99 vs thick 0.05-0.20) is exactly the W1 excess minus `q` — the two pins measure the same defect through different windows, so no bound pair can be GREEN while the other is RED.
4. Base-fail predictions (the RED): **W1 RED** (2 cells), **W3 RED** (5 cells); **W2, W4, W5 GREEN at base** (controls).

Bounds are calibrated once, here, before RED — never re-calibrated after the tests-only commit.

## STOP clause

**VERDICT: START — no re-architecture required.**

Carrying local thickness past the raster is done by modulating velocity-source strength (the height-equalization inputs at fluids.ts:233-234, injected at 578) inside the existing Stam pipeline. Solver structure, grid topology, the velStep/advect/project contract, the channel set, and the tick structure are all untouched — proven by the f ≡ 1 byte-identity run (the mechanism is inert until f < 1, and nothing outside the source multiplication differs from today's code). The plan's STOP clause explicitly names "modulating the velocity SOURCES feeding the existing solver" as NOT re-architecture.

## Locked files

Guardrail diffs must be empty for these; any appearance in the Task-3 diff is a STOP:

1. **Preview ribbon law** — `render/canvas.ts` `buildPreviewRibbon` (275-280) and the preview-ribbon test; `brush/stroke.ts` `ribbon()` (101-119) — committed stroke geometry.
2. **Compositor / display** — `render/compositor.ts` `wetDisplayAlpha` (29), `compositeWetLayer` (45).
3. **Normal-mode raster & bake** (mode split: Normal = `physicsMode === null` → raster + bake, NO settle — `PhysicsPaintToolRail.tsx:66-67`; engine branch `EfxPaintEngine.ts:2556-2557` → `forceDryAll`):
   - `brush/paint.ts` raster schedule inside `renderPaintStroke` / `renderPaintSingleColor` (the transfer call sites 529 / 576 / 642 are on the Physics path only, and the carrier needs no change there anyway);
   - `core/drying.ts` `forceDryAll` (173);
   - `EfxPaintEngine.ts` non-local branch (2556-2557).
4. **PIN 0 absolutes in `core/wet-layer.ts`** — `DEPOSIT_KEEP_TIER = 70` (417) and its include/exclude gate (447); deposit math `(a / 255) * 3000` (450); D-08/D-09/D-10 arithmetic (455-484); strokeOpacity Porter-Duff accumulation (488-489); wetness write (490). The carrier does not require editing this file at all.
5. **Determinism** — no `Math.random`, `Date`, or `performance.now` input into any scaling decision (stop-motion law).
6. **Scope ceiling** — no new UI, no package.json / pnpm-lock changes, no preview-ribbon or Normal-mode behavior change.

## Live-scope authorizations

- **Task-3 max edit set (actual):** `packages/efx-physic-paint/src/core/fluids.ts` + the new `packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts`. Nothing else. `types.ts`, `paint.ts`, `wet-layer.ts` are inside the plan's allowed set but require no change (carrier derives width from raster alpha at settle time) — a diff there without this section naming it is still a STOP.
- **Calibration scratch:** all measurements above came from an uncommitted scratch test deleted before this commit; it must never be committed.
- **Legacy-risk disclosure (honest):** the pyp production texture pin (`d(b) ≥ 1` at every water × both papers on the uniform-r3 production raster) is substrate-specific. The scratch's simplified uniform-r3 builder reproduces base `d(b) = 0` and therefore cannot oracle that pin. Task 3 runs the real harness; any regression there is the plan-defined STOP before GREEN, not something this verdict pre-approves.
- **Pre-existing base state recorded at verdict time:** `productionAaSettleMeasurement.test.ts` 7/7 green; `physicsSettledFootprint.test.ts` 4 passed + 3 skipped (recorded deferred/dispositioned state).

---

# Re-calibration cycle (Option 1, 2026-09-24) — FALSIFIED: joint satisfiability FAILED

Appended after the Task-3 STOP. The orchestrator authorized a fresh diagnosis cycle
extending the measurement substrate to BOTH the r=10 scratch gesture AND the pyp
production raster (brush radius 3, 6–7 px stroke), with the pyp texture pin promoted to
a first-class pin (W6) in `physicsWidthScaling.test.ts` (RED committed as `30541402`
before any re-calibration landed in code). This section records the derivation attempt
and its outcome. Nothing above is rewritten.

## Result

**No bound pair satisfies the full pin set (W1–W6). Joint satisfiability FAILED —
carrier (c)'s scalar law `f(run)` cannot serve both substrates.** Per the falsification
honesty clause: W1/W3 were NOT weakened, no GREEN was made, and the cycle stops here.

## Method

All measurement ran through an identity-validated parameterized prototype
(`__stb_recal_scratch.test.ts`, deleted before this append, never committed):

- **V1:** prototype at the original bounds `(4,6,residual 0.25)` is byte-identical to
  the production carrier in `fluids.ts` across every cell.
- **V2:** prototype at `f ≡ 1` reproduces the documented base numbers (the original
  VERDICT's base tables) exactly.

Both validations passed, so sweep results are trustworthy proxies for production runs.

Sweep families — **210 candidates total, every one evaluated against the FULL pin set**
(W1 hairline tol 3.0, W2 thick floor, W3 monotone, W4 PIN 0/0b, W5 determinism,
W6 production texture d(b) ≥ 1 at every water × both papers, plus envelope/determinism
controls) over 12 gesture cells + 6 production cells:

| Family | Grid | Candidates | Passing |
| ------ | ---- | ---------- | ------- |
| Classic `f(run)` | residual {0.25, 0.5, 0.75, 0.9} × wFloor 0–4 × wFull ≤ 6 | 68 | 0 |
| FINE (near-miss knees) | residual 0.30–0.60 step 0.05 × 7 knees incl. wFull=7 | 49 | 0 |
| HIGH (residual window close) | residual 0.65–0.90 step 0.05 × 9 knees incl. (5,7),(6,8) | 54 | 0 |
| Frontier-exempt `f(run=0)=1` | residual {0.25, 0.5, 0.75} × wFloor 1–4 × wFull ≤ 6 | 39 | 0 |

## Evidence — the two regimes never overlap

- **Low residual (≤ 0.50):** W1, W2, W3, W4, W5 all PASS (thin pinned: maxThinExcess
  1.975–2.975 ≤ 3.0; thick d(b) ≥ 1). **W6 fails in EVERY candidate — minProdDb = 0**
  (production stroke settles to a hard stamp, W_deposit 6 → W_settle 6, at least
  null/w90, usually all 6 cells).
- **High residual (≥ 0.85):** W6 recovers (minProdDb = 1) but **W1 breaks**
  (maxThinExcess 3.975 > 3.0) and W3 collapses (thin physics 0.988 vs thick 0.101).
- **Nearest miss (5, 7, residual 0.75):** W1, W2, W4, W6, ENV all PASS
  (maxThinExcess 2.975, minProdDb 1) — **W3 fails alone**: thin physics inflation
  0.494 > thick 0.101–0.201 in 4+ cells. W3 is explicitly protected (no weakening).
- **Nearest miss (4, 7, residual 0.50):** only W6 null/w90 + synthetic/w90 db = 0
  (and W3 synthetic/w90) remain — production at water 90 is the last holdout, and the
  residual needed to fix it (≥ 0.75) is exactly the residual that breaks W3.
- **Frontier-exempt family:** fixes production texture at low residual but **W3 fails
  in every candidate** — the hairline's run=0 frontier cells get f = 1 and inflate the
  thin physics component to 0.494.

## Structural impossibility (why no bound pair can pass)

The equalization circulation on BOTH substrates is driven by low-run cells, and
`f` is a scalar function of `run` alone:

- **Production (r=3):** run histogram over the pyp local grid
  `{0:911, 1:3, 2:10, 3:18, 4:92, 5:23, 6:324, 7:36}` — the ~146 inside cells
  (run 1–6, ≈29%) plus the run=0 frontier carry the boundary height gradient; damping
  them below the spread threshold (residual ≈ 0.25) kills texture (d(b)=0), while the
  residual needed for texture (≥ 0.75) removes the damping the hairline pin needs.
- **Hairline (r=10 gesture):** the thin stroke's source cells are run 0–2 as well
  (stroke is ~2 px wide); pinning W1/W3 requires those cells at residual ≈ 0.25.

`run = 0` means the same thing on both substrates (outside the deposit), so no
`(wFloor, wFull, residual)` — and no frontier exemption — can give production's low-run
cells full strength while keeping the hairline's low-run cells damped. A discriminating
feature other than `run` (e.g. deposit density/alpha magnitude, substrate-local
statistics) would be a **different carrier law → re-diagnosis (Rule 4), out of this
cycle's scope.**

## RED state left in place (honest, unchanged pins)

Battery at cycle end (uncommitted `(4,6,0.25)` carrier in tree, no GREEN commit):

| Pin | Result |
| --- | ------ |
| W1 hairline tol 3.0 | PASS |
| W2 thick d(b) ≥ 1 (control) | PASS |
| W3 monotone thin ≤ thick | PASS |
| W4 PIN 0 / PIN 0b | PASS (ratio 1.0000; min body ratio ≥ 0.95× literals) |
| W5 determinism | PASS (byte-identical) |
| W6 production texture d(b) ≥ 1 | **FAIL — d(b)=0 in every cell** (null w10/50/90 + synthetic cells) |
| pyp legacy texture pin | **FAIL — d(b)=0** (same cause) |
| pyp other 6 tests / footprint 4+3sk | PASS |

`physicsWidthScaling.test.ts` W6 and the pyp texture pin are RED against the only
carrier ever written for this quick; W1–W5 tolerance values were never moved.

## Options for continuation

1. **Carrier revision (re-diagnosis):** discriminate hairline vs production low-run
   cells on a feature other than `run` (deposit alpha magnitude, local density,
   stroke-relative width) — new VERDICT, new RED, Rule 4.
2. **Split the requirement:** keep carrier (c) at low residual (W1–W5 GREEN, ship the
   hairline fix) and treat the production texture identity (W6/pyp) as an explicitly
   deferred, ledgered regression with the user's sign-off.
3. **Revert** the uncommitted `fluids.ts` carrier (Tasks 1/2/3-RED commits stand) and
   re-plan the quick.

---

# Re-diagnosis (carrier revision — Option 1, 2026-09-25) — neighborhood thickness field: joint satisfiability HOLDS

Appended after the orchestrator resolved the falsification checkpoint with **carrier
revision: neighborhood-scale thickness field** (VERDICT option 1, discriminating
feature chosen). Nothing above is rewritten. Measurement again ran through an
identity-validated parameterized prototype (`__stb_nb_scratch.test.ts`, deleted before
this append, never committed).

## Result

**The new carrier answers "how thick is the stroke in this neighborhood?" instead of
"how long is this scanline run?". Joint satisfiability of W1–W6 across BOTH substrates
HOLDS on measurement: exactly 2 of 122 field candidates pass the full pin set.
VERDICT: START — proceed to RED (W7) then GREEN.** No pin bound was moved.

## Carrier — field construction

```
run(c)   = min(h-run, v-run) over inside ⇔ alpha > 20        (unchanged, bbox-bounded)
T(c)     = MEAN of run(c') over inside cells c' in the Chebyshev box
           |i'-i| ≤ R, |j'-j| ≤ R, clamped to the local grid interior   (R = 2)
f(c)     = 0.25 + 0.75 * clamp((T(c) - 4) / (6 - 4), 0, 1)
```

applied per source cell at the height-equalization inputs (fluids.ts
`addHeightEqualization`), computed ONCE per settle from the deposited raster before
tick 0. `f ≡ 1` arithmetic stays byte-identical to the unmodulated law. Measured fact
used by the construction: **every positive-alpha cell on both substrates is `inside`
(alpha > 20) — no fringe band (1 ≤ alpha ≤ 20) exists**, so the source set and the
field's support set coincide; `run = 0` cells are never sources and never counted by
the mean (only `run > 0` cells enter the average).

Why the mean and not the max: the mean is the only aggregate tested that both (a)
lifts production's low-height cells that sit *next to* the full-height interior and
(b) does not leak the gesture's taper thickness back into the hairline (the max
propagates a single thick neighbor at full weight — see sweep evidence).

## Support size R = 2 — calibration against BOTH substrates (pre-RED)

R is the **unique** passing support in the swept grid {1..6} (with mean, knee 4/6):

| R (mean agg) | Outcome |
| --- | --- |
| 1 | **W2 FAIL** (synthetic thick d(b)=0) — support too small: edge/transition cells of the thick stroke don't see the interior |
| **2** | **PASS all W1–W6** (both residuals 0.25 and 0.5) |
| 3–6 | **W3/W1 FAIL** — the 5×5+ box reaches the taper from the hairline cross-section (thin-region T max rises 4.94 → 6.58), lifting hairline cells above the knee → physics inflation 0.494 > thick 0.101 |

Every `max`-aggregate candidate at every R ≥ 1 fails W1/W3 (taper leakage at full
weight: gesture thin-region T reaches 8–11). Knee (5,7) fails W6 at every R (production
mean T = 5.47 → f < 0.75 → texture dies — the falsification's measured threshold).
Knees (2,4)/(3,5) fail W3 (hairline T@col44 = 3.29 sits above tFloor → partial hairline
activity). The passing window is therefore exactly: **mean × R=2 × knee (4,6) ×
residual ∈ {0.25, 0.5}** — residual **0.25** chosen (continuity with the original
VERDICT's measured residual floor; stronger hairline damping, W2/W6 unaffected).

Measured discriminator (both papers identical, null/w50 deposits):

- Gesture hairline, cols ≤ 46: T ≤ 4 → **f = 0.25** (at the W1 cross-section col 44:
  T ≤ 3.29 → f = 0.25); cols 47–49 ramp (their neighborhood contains the taper):
  f = 0.35 / 0.59 / 0.90; col 50+ → f = 1.
- Gesture thick region (cols 64–76), **including edge cells**: T ≥ 14.85 ≫ 6 → **f = 1.0**.
- Production interior (cols 40–90): T ≥ 5.67 → f ≥ 0.875 (mean T = 5.47 whole-stroke);
  end ramps (height-4 columns, e.g. cols 100–108) stay partially damped (caps f = 0.25).
- Discriminating gap: hairline-core T ≤ 4 < tFloor, production-interior T ≥ 5.67 —
  margin 0.71 px on the hairline side, 1.67 px on the production side.

## The three neighborhood properties — stated and proved

1. **Hairline (2 px): every cell's neighborhood sees a thin mark → damped.** Proved:
   on the drawn hairline (p = pThin through x = 48) the 5×5 mean thickness never
   reaches tFloor at cols ≤ 46 (f = residual 0.25, both papers); the last two hairline
   columns (47–48) sit at f ≤ 0.60 because their neighborhood genuinely contains the
   taper. **Behavioral consequence (the pins that matter): W1 excess 0.975–1.975 ≤ 3.0;
   W3 thin physics inflation = −0.494…0 (zero — settle never inflates past deposit) in
   every cell.**
2. **Thick stroke (12–20 px): cells near the edge see the interior → physics
   preserved.** Proved: every edge cell of the thick cross-section has T ≥ 14.85
   (support radius 2 reaches 4 rows/columns into a 20-px body) → f = 1.0 exactly
   (both papers). Behavioral: W2 thick d(b) = 1 (null) / 2 (synthetic) = base values,
   no margin below the floor consumed.
3. **pyp production substrate (r = 3, 6–7 px): body reads "thick enough" → d(b) ≥ 1.**
   Proved: interior cells' neighborhoods average the full-height columns → f ≥ 0.875,
   above the falsification's measured texture threshold (uniform residual ≥ 0.75
   restored W6); behavioral: **W6 d(b) = 1 in all 6 cells** (base was 1/1/1, 2/2/1 —
   the four zero-margin cells hold at exactly ≥ 1).

## Identity validations (V1/V2) and corrections to the record

- **V1:** prototype at R=0 (T ≡ run → the old `f(run)` law) with knee (4,6)/0.25 is
  **byte-identical** to the in-tree `f(run)` carrier via the real
  `localFluidPhysicsStep` on 4 cells (gesture + production × both waters) — the sweep
  harness reproduces the carrier it replaces.
- **V2:** prototype at residual 1 (f ≡ 1) is **byte-identical to authoritative HEAD
  base** (real `localFluidPhysicsStep` with no carrier) on all 18 cells — base claims
  below are measured, not inherited.
- **Correction (honesty):** the previous SUMMARY's "committed tree has W1/W3/W6 RED"
  was wrong about W6 — authoritative base run: **W6 is GREEN at base** (and legacy pyp
  7/7 GREEN); W6 was RED only against the `f(run)` carrier. Base W1/W3 RED stand
  (2 and 5 cells respectively).
- **Correction:** the original §Pin-bounds excess list's 5th entry (synthetic/w50
  1.975) contradicts its own visible-width table (5 → excess 2.975). Authoritative
  base visible widths: null 6/4/5, synthetic 5/5/6 → excess 3.975/1.975/2.975/2.975/
  2.975/3.975. W1's base-fail set (null/w10 + synthetic/w90) is unchanged.
- Authoritative base production d(b) (both harness substrates, base tables match
  cell-for-cell): null 1/1/1, synthetic 2/2/1 — **four cells with zero margin**; any
  damping that costs 1 px of spread breaks W6. Hence the target: f ≈ 1 across the
  production body.

## Sweep evidence (every candidate scored on the FULL pin set W1–W6)

122 candidates = {max, mean} × R{1–6} × knee{(2,4),(3,5),(4,6),(3,6),(5,7)} ×
residual{0.25, 0.5}, plus 2 R=0 references, over 12 gesture cells + 6 production
cells each (deposits cached; identity V1/V2 passed first):

- **Passing: 2** — `mean, R=2, knee 4/6, res 0.25` (maxThinExcess 1.975, minProdDb 1,
  minBody 0.9994) and the same at res 0.5 (minBody 0.9995).
- **R=0 reference reproduces the falsified `f(run)` exactly**: W1–W5 pass, W6
  d(b) = 0 in every null cell — harness sanity against the known RED state.
- Failure structure: max-agg 0 pass; mean R=1 → W2 only; knee (5,7) → W6 only;
  knees (2,4)/(3,5) → W3 only; R ≥ 3 → W3/W1 only (near-miss table: 60+ candidates
  at n=4/5, each failing on exactly one pin family).

## W7 — field-law pin (bounds calibrated HERE, pre-RED; never re-calibrated after)

W1–W6 are behavioral and cannot distinguish *why* the winner passes; W7 locks the
neighborhood law itself at the field level, encoding the three properties above. It
imports the (now-exported) `buildWidthScaleField` from `fluids.ts` and asserts, on the
REAL deposits (both papers, water 50):

| Sub-pin | Assertion | Measured | Bound |
| --- | --- | --- | --- |
| W7a — thick edge keeps f high | min f over edge cells of the thick region ≥ 0.99 | 1.0 (both papers) | **0.99** |
| W7b — hairline damped | max f over source cells, cols 40–46 (incl. W1 col 44) ≤ 0.30 | 0.25 (both papers) | **0.30** |
| W7c — production body reads thick | min f over production source cells, cols 40–90 ≥ 0.80 | 0.875 (both papers) | **0.80** |

RED at the current HEAD: `buildWidthScaleField` is not exported (import fails) — the
classic missing-implementation RED; GREEN only when the carrier lands.

## Joint satisfiability table (W1–W6, both substrates — base → winner)

| Pin | Base (HEAD, authoritative) | Winner (mean/R2/4-6/0.25, prototype-measured) |
| --- | --- | --- |
| W1 hairline tol 3.0 | **RED** — excess up to 3.975 (2 cells) | **PASS** — excess 0.975–1.975 in all 6 cells |
| W2 thick d(b) ≥ 1 @ w50 | PASS (null 1 / syn 2) | **PASS** (null 1 / syn 2 — base values) |
| W3 monotone thin ≤ thick | **RED** — 5 of 6 cells | **PASS** — thinPhys −0.494…0 ≤ thickPhys 0.050–0.101, all cells |
| W4 PIN 0 / 0b | PASS | **PASS** — deposit untouched (PIN 0 ratio 1.0000); minBody 0.9994 ≥ 0.95 |
| W5 determinism | PASS | **PASS** — field is a pure function of the deposit; two independent runs byte-identical |
| W6 production texture d(b) ≥ 1 | PASS (min 1, four zero-margin cells) | **PASS** — d(b) = 1 in all 6 cells |
| W7 field law | RED (no export) | PASS (bounds table above) |
| legacy pyp 7/7 + footprint 4+3sk | GREEN | substrate base tables identical to W6's → predicted GREEN; real harness runs at Task-3 GREEN with STOP semantics |

Why the falsification no longer applies: `f` is no longer a scalar function of the
cell's own `run`. `run = 0`/low-run means the same on both substrates, but the
neighborhood mean does not — the hairline's box averages hairline-only cells
(T ≤ 4) while the production body's box averages full-height neighbors
(T ≥ 5.67) even inside its low-height end ramps. The two substrate classes sit on
opposite sides of the knee with a measured 1.67 px gap.

## Cost bound

Field computed once per settle before tick 0: run extraction O(N) (two bbox-bounded
passes), box-mean O(N · (2R+1)²) = **25N** simple adds at R=2 (N = local bbox cells —
the same clip extent the solver itself uses; no unbounded loops, window clamped to the
local grid), f-fold O(N). Peak scratch: `hRun`, `vRun` transient + `run` + `f`
grid — same allocation class as the replaced carrier. No `Math.random`, no
`Date`/`performance.now` input into any field value (stop-motion law).

## Live-scope authorizations (carrier-revision cycle)

- **Edit set:** `packages/efx-physic-paint/src/core/fluids.ts` (replace the `f(run)`
  builder with the mean/R2 neighborhood law; export `buildWidthScaleField` for W7) +
  `packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts` (add W7 only —
  W1–W6 tolerances byte-untouched). Nothing else.
- The falsified `f(run)` carrier had been reverted to HEAD during the authoritative
  base measurement (saved at /tmp, never committed); GREEN writes the new law from HEAD.
- Locked files / STOP clauses unchanged from the section above: deposit arithmetic,
  keep-gate 70, Normal mode, preview ribbon, no UI, no installs, no push.
- STOP remains absolute: any PIN 0/0b movement, W2/W5 flip, W6/legacy regression, or
  locked-file leak at the GREEN battery → halt and report.
