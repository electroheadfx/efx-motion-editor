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
