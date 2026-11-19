# Spike 001 — Verdict: coverage composite vs the erase/punch machinery

**Date:** 2026-11-18
**Build under test:** branch `gsd/phase-64-medium-engine` @ `406d1ead1` (current build) vs a
patched copy of the same engine in `workbench/` (throwaway). Main tree untouched.
**Harness:** real WebGL2 in headless Chrome, 1080×1080, cold paper, seeded RNG, one engine
per process. `probe/run.mjs --matrix`, 12 gates, results in `results/`.

## The question

Replace *"erase the underlayer along the brush footprint, then deposit watercolor"* with a
per-dab **coverage** term composited source-over inside the pigment layer. Does that give
correct opaque paint, without the punch machinery, inside a performance budget?

## The answer

**YES — GO on the model.** All three engine-side criteria pass. The limit was the model,
not the tuning: the current erase path is structurally unable to make a near-white pigment
cover (its layer alpha is derived from darkness), while the coverage term is
pigment-independent by construction. A separate engine is **not** warranted by these
numbers.

## Criterion 1 — white 240 over saturated blue

Underlayer is a saturated Body-0 blue band (`#0044dd`); the covering stroke is white
`#f0f0f0` at the stated Body. Crossing box, 1080². "Blue excess" is `mean(B) − mean(R)` —
the untouched blue band reads **41.1**.

| Body | Current build — crossing | Blue excess | Coverage model — crossing | Blue excess | Layer alpha (mode 4) |
|------|--------------------------|-------------|---------------------------|-------------|----------------------|
| 100  | 210, 226, 246 (blue)     | **35.8**    | 241, 242, 242 (white)     | **0.7**     | **0.98** (was 0.18) |
| 60   | 206, 224, 246 (blue)     | **39.8**    | 218, 232, 249 (light blue)| **31.2**    | 0.23 |
| 30   | 206, 224, 246 (blue)     | **40.0**    | 212, 230, 253 (blue)      | **41.1**    | 0.17 (blue's own alpha) |

- **At 100 the underlayer disappears:** 0.7 vs 41.1 blue excess → 98 % replaced; the
  crossing reads 241–245, the white pigment's own value.
- **At 60 it is partly visible:** 76 % of the underlayer's blue excess survives.
- **No value produces paper-white:** whole-sheet scan of texels the layer claims to cover
  (`alpha ≥ 0.5`) that read ≥ 250 in the transmittance export = **0 %** at all three Body
  values; the crossing's paper-white fraction is 0 %; min/max luma at the crossing core
  (Body 100) is 240–245, never 255.
- The current build fails at every Body: the white deposit only tints the blue (the
  crossing's layer alpha is 0.18; the white paint's own area reads 251 at alpha 0.02),
  which is exactly the reported "near-white does not cover".

Note: at Body 30 the white film is ~1 % opaque per dab, so the stroke over bare paper reads
near-paper. That is a nearly transparent white glaze, not an erase hole — the crossing over
the blue stays blue, never paper.

## Criterion 2 — red over blue, 50 rapid strokes

Blue field at Body 0, then 50 rapid `#cc2222` strokes at Body 100, 1080², one engine tick
per stroke, settle every 10. Compared against a fresh red stroke painted in the same run.

| | Field luma | Fresh-red ref luma | Ratio | Δhue |
|---|---|---|---|---|
| Current build | 165.2 | 197.9 | **0.835** | +0.3° |
| Coverage model | 145.8 | 148.4 | **0.982** | **−0.1°** |

Stated tolerance: luma ratio ≥ 0.95 and |Δhue| ≤ 3°.
**Coverage passes; the current build fails the luma ratio** — its blue underlayer still
sums into the red (16.5 % darker than its own reference). Neither drifts to black in this
script, but the coverage model removes the mechanism (coefficient summation) that produces
the drift at longer sessions.

## Criterion 3 — performance and memory, 54 strokes at 1080²

3 underlayer + 50 rapid + 1 reference stroke, p50/p95 over the 50 rapid strokes.

| | Rapid p50 | Rapid p95 | Total bake | Full-document draws | Full-document blits | Peak transient GPU memory |
|---|---|---|---|---|---|---|
| Current build | 23.8 ms | 56.5 ms | 1389 ms | **3613** | **105** | **+17.80 MiB** |
| Coverage model | **5.8 ms** | 135 ms | **1170 ms** | **0** | **3** | **+0.00 MiB** |
| Body-0 control (cover path disabled — engines byte-identical) | 6.6 vs 5.1 ms | 100.8 vs 110.3 ms | 863 vs 859 ms | 0 | 0 | +0.00 MiB |

- **No per-stroke full-canvas pass:** the coverage engine issues zero unscissored
  document-sized draws across all 54 strokes; the current build issues 3613 plus 105
  full-document blits (two per Body>0 stroke = the `preInk` snapshot). The 3 remaining
  blits are the sim's double-buffer sync, present in both.
- **Median rapid stroke 4.1× faster**; total bake 16 % faster — the remaining time is the
  shared fluid sim/settle, which the model does not change.
- **The p95 tail is the script, not the model.** The Body-0 control above runs the same
  54-stroke script with the cover path off: both engines are byte-identical there, yet
  both show a ~100–110 ms p95 and the current build's Body-100 p95 (56.5 ms) is *lower
  than its own Body-0 p95*. A periodic shared sim/readback stall lands on different
  frames depending on the per-dab cost, so p95 is an alignment-sensitive number here. The
  stable comparisons are the median (5.8 vs 23.8 ms at Body 100; 5.1 vs 6.6 ms at Body 0)
  and the aggregate bake (−16 %).
- **Memory:** one persistent `R16F` coverage target (+2.3 MB at 1080²) replaces a 17.8 MiB
  full-document snapshot allocated **and** blitted per stroke.
- **App-level punch (code-path fact, not run here):** the current cover path punches the
  visible and durable cached base per stroke — 2 × 4.67 MB of 1080² raster — plus a
  per-frame preview punch and the commit merge. The model makes the punch unnecessary:
  the live sheet's coverage alpha (0.98 at the white crossing vs 0.18) hides the base by
  compositing instead of erasing it.

## Identity — the Body-0 path is untouched

| Gate | Current build | Coverage model | Result |
|---|---|---|---|
| `neutral-identity` (256²) | `d2bd637a / 291d4a11 / 6ba88334` | identical | ✓ byte-identical (and equal to the committed baseline) |
| 50-stroke watercolour script, Body 0 (1080²) | `2b4a86d7 / 7f56e401 / bc74be59` | identical | ✓ byte-identical |

## What the model is

Per dab, `m` = the deposit's own footprint mask, `Body` = the approved D-14 curve + gain:

```
a       = min(1, bodyCurve(Body) × 2) × (1 − exp(−K · amount · m))     K = 8, medium density
ink    ← ink × (1 − a) + C × a               C = the dab's masstone absorbance
fixed  ← fixed × (1 − a)
cover  ← cover × (1 − a) + a                 (display alpha)
S      ← S × (1 − a) + S_dab
display (mode 4): alpha = max(1 − min(rgb), cover)
```

Three scissored draws per dab; no snapshot, no ping-pong, no punch callback. Body 0 keeps
the additive path unchanged.

## Go / no-go

**GO.** The current engine can deliver opaque acrylic coverage without the punch machinery,
inside the budget:

- Correctness: all three criteria pass; the current build fails 1 and 2.
- Performance: 4.1× median per-stroke, −16 % total bake, zero full-document passes, and
  −17.8 MiB per-stroke transient.
- Risk: bounded and integration-shaped, not architectural. No separate engine.

### Required before shipping (not spike scope)

1. **App wiring:** publish the live sheet with coverage alpha and stop punching the cached
   base (visible + preview + durable); keep the normal commit composite.
2. **Coverage lifecycle:** advect coverage with the ink (or accept a static registration),
   include it in undo history, and reduce it in Lift.
3. **Tuning + UAT:** Body now scales the **paint film's opacity**, not only the erase —
   Body 30 is a ~1 % film per dab, and the cover rate at 60 is set by the one `K` knob.
   Needs the live visual pass; the covered-paper-white and hue tolerances above are the
   pins to keep.
4. **Textured tips:** same mask by construction, not yet exercised — the rev-4 UAT failure
   mode (per-dab jitter unioning the erase past the paint) cannot occur here because the
   deposit and the coverage share one `a`, but it should be demonstrated.

### Prior-context check (read, not re-litigated)

The debug session's four root causes (display swap publishing the punched base, deferral
race on the decode, content-memoized URL, stale session bookkeeping) are all artifacts of
the punch/erase architecture. The coverage model deletes the architecture those fixes
protect: there is no punched base to publish, no punch/decode ordering to coordinate, and
no pre-stroke snapshot to go stale. The rev-4 law itself is unchanged in the main tree.
