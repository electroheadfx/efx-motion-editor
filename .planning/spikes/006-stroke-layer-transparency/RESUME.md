# Resume here — spike 006

**Last measured: 2026-11-25.** Q1–Q4 are answered. The artist accepted Q3c's ~21 ms
first-dab cost, so the encoder is **frozen**; Q4 passes every bar the workbench can hold,
and the engine-lifecycle rows are the implementation quick's explicit gate.

Read first: `SPECS/v2.2.0-medium-engine/SPIKE-stroke-layer-FINDINGS.md`
(the whole record; it is gitignored, it lives only in the tree).

## The frozen encoder — do not re-derive

| constant | value | why |
|---|---|---|
| bands | **8 compiled bands `[1,3,5,7,9,10,11,13]`** (D-optimal over the 16) | 8 unknowns need 8 well-conditioned equations; the residual is judged through **all 16** |
| Jacobian | **rank-one** | exact for `bandOf`'s A-dependence — keep it for correctness, not speed |
| iterations | **4 LM steps**, hard cap | 2 iterations is 9.5 ms but max 13/255 |
| seed | **`mix(base, layer, aEff)`** in coefficient space | the nearer-input seed leaves the LM a kink at aEff 0.5 (62 outliers) |
| write-back | **in place: `ink = fit − fixed`**; display `ink + fixed = fit` | the display sums the pools; writing the full fit into `ink` double-counts the base |
| cost | **~21 ms felt** at 2K over a 1.45 M-texel stroke rect | accepted by the artist (one frame, immediate restart only) |

The band list, the Jacobian and the seed law are **compile-time constants in the shader**;
only `amount`, `start`, `falloff` and `maxIter` are uniforms. A uniform band *mask* leaves
every array at 16 and saves nothing.

## Where the answers stand

| Q | verdict | one line |
|---|---|---|
| Q1 | GO, conditional | band-mix composite + bounded KM fit lands in 7 coeffs at ≤1/255; §3.3's law and the 7×16 pinv both fail |
| Q2 | NO | the shipped committed-base merge multiplies, it does not glaze; only the layer supplies a lateral alpha |
| Q3 | GO / NO-GO | 2K merge ~40–50 ms per realistic stroke rect; 4K unallocatable |
| Q3b | FAIL (cost) | a real 36–44 ms stroke-end stall at 2K; painting unaffected (+0.4 ms), memory +80 MiB |
| Q3c | FAIL by 0.6–1.8 ms (cost) | 8 bands + 4 it + rank-one + seed mix: residual **max 2, p95 1, 0 over** at **20.6–21.0 ms** — **accepted, encoder frozen** |
| Q4 | **PASS** (workbench bars 1–4) | live vs merged **max 2/255, p95 1, 0 over of 8,728,956** at falloff 0/50/100 over paper and a same-visit stroke; capture round trip **byte-identical**; `fit − fixed` write-back ≤1/255; merge bit-identical across draws and processes; amount-0 layer path diverges **203/255** → bypass mandatory |

## Q4's reference values a quick must match

- **Amount-0 reference digests** (FNV-1a over every byte of every captured layer; paper
  `cold`, seed `0xc0ffee`, strength 1, Body 100, `bristle-round`, the two straight strokes
  in `probe/q4.ts`): stroke A as the **first paint of a fresh process** `3b53a64e`, stroke
  B as the **second paint** (its first dab starts from A's end direction) `3d04526f`,
  **first visit A→B from the constructor carry `[1,0]/0` `36a3f71d`**. The quick's
  amount-0 gate compares against the **visit** digest; both visit replays and both
  processes reproduce `36a3f71d`.
- **Merged sheet digest** (frozen encoder, falloff 50, over the same-visit stroke,
  `3170f21b`) — identical across processes.

## The implementation quick's explicit gates (bar 5 — not covered here)

| # | Gate |
|---|---|
| G1 | A **pointer** stroke with `edgeTransparency > 0` runs the merge once at stroke end, before the next stroke reads the sheet |
| G2 | A **scripted** stroke (`adapter.applyStroke` → Studio apply / capture / bake) runs the same stroke-end call |
| G3 | **Bake replay** of a merged sheet renders byte-identical to the live display |
| G4 | `edgeTransparency = 0`: no layer target allocated, no merge draw, capture bytes == `36a3f71d` |
| G5 | The merge is fed the sheet's **summed** base (`ink.read + fixed`) — in the same visit the earlier stroke may still be in `ink` |

## Reproduce

```bash
# Q1 — the composite law
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --size 540

# Q3 + Q2 + the pool rider — the real GLSL merge
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario cost --size 1080
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario cost --size 2048

# Q3b — the serialized stroke-end path + both cost variants
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario q3b --size 2048

# Q3c — the reduced-band-set fit (band selection + 12 candidates + interleaved A/B)
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario q3c --size 2048

# Q4 — parity: 2 scenes x 3 falloffs + capture round trip + replay (+ run twice for
# the cross-process digest check: both runs must print 36a3f71d for the visit)
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario q4 --size 2048
```

Results in `results/` (`composite-540*.json`, `cost-1080.json`, `cost-2048.json`,
`q3b-2048.json`, `q3c-2048-s0.3-a100.json`, `q4-2048-s0.3-a100.json`,
`q4-2048-replay.json`). The `probe.bundle.js` is a build artifact — regenerate, never
commit.

## Files

- `probe/law.ts` — the CPU mirror of `displayBasisGLSL` + the two composite laws + both encoders
- `probe/sheet.ts` — sheet decode/encode/restore, the pool split (**incl. the frozen
  `settled` split: mobile = sheet − settled**), the RNG and engine tap
- `probe/bands.ts` — the band selection: importance, sensitivity direction, D-optimal search
- `probe/merge.ts` — **the GLSL LM merge pass**, the rank-one Jacobian, the half-res
  resolve, the display-cost proxy; the fit's band list, the Jacobian and the seed law are
  compiled into the shader
- `probe/probe.ts` — the Q1 scenario · `probe/cost.ts` — Q3 + Q2 + rider ·
  `probe/q3b.ts` — the serialized path, variants, memory ·
  `probe/q3c.ts` — the reduced-band-set fit, the frontier table, the interleaved A/B ·
  `probe/q4.ts` — parity: the frozen encoder, 2 scenes × 3 falloffs, capture round trip,
  replay determinism, the quick's gate rows
- `probe/run.mjs` — bundles and drives headless Chrome; `--scenario composite|cost|q3b|q3c|q4`

## Known rough edges (do not re-derive)

- `readHalf` returns half **bit patterns** — decode with `fromHalf` before using them.
- `gl.finish()` is not a fence in WebGL; a 1×1 `readPixels` is.
- The engine pins its own RNG (`setRandom(seededRandom(1))`), so `--seed` is inert.
- The merge shader needs LM step **rejection** and a good seed; without rejection it
  diverges on a handful of texels and reports 156/255 outliers.
- **Timing method matters more than the number.** Q3's `run()` loop queues 20 draws and
  divides, which measures throughput and hides the latency (and had a ±20 % run-to-run
  spread). Q3b's single draw after an idle GPU is the serialized-path measurement. Always
  run a **size ladder** — it is what proves the cost is fragment work rather than a
  per-draw floor.
- **Run-to-run drift at this scale is ±10 %.** When the gate is a ~1 ms margin, measure
  the two contenders **interleaved in one process**; a table of sequential candidates
  cannot resolve it.
- `gl.flush()` after the merge is what makes a "start the next stroke 50 ms later" pause
  real GPU time instead of an unsubmitted queue.
- A half-resolution fit cannot be rescued by a better resolve: the band is a pointwise mix
  of two full-resolution textured states.
- The 62 texels over 2/255 all sit at aEff 0.25–0.5 — the LM's seed switch. **Fixed** by
  seeding from `mix(base, layer, aEff)` (+1.6–2.0 ms in rejected LM attempts).
- The numeric Jacobian is **unstable** when the band count equals the parameter count
  (8 bands). Use the rank-one Jacobian for correctness.
- A reduced band list must be compiled into the shader, not masked by a uniform.
- **Use the ADAPTER's `resetSheet()`, not the engine's**, for a from-scratch replay: the
  adapter rewinds the virtual clock and re-seeds the RNG; the engine's leaves both alone.
- **The engine carries the previous stroke's end direction/angle into the next stroke's
  first dab** (`scriptBegin` seeds from `lastDir`/`lastAngle`, `Engine.ts:1494`; the stroke
  end writes `lastDir`, `:2791`; `resetSheet` clears neither). Deterministic but
  sequence-dependent: pin `lastDir = [1,0]`, `lastAngle = 0` before a replay (Q4's
  `carryLog` records every stroke's start state) and the replay reproduces the first paint.
- **The capture crop is the `everPainted` bbox** and drifts by a band at the edges between
  in-process replays (7 px at 540², 16–17 px at 2K); the extra band carries no paint. Cause
  not traced (engine bookkeeping). Compare the display bytes (or the union), not two
  differently cropped capture arrays.
- **`lastTouch` is the one layer that is not zero outside the crop** (the one-week sentinel
  is written over the whole sheet), so zero-filling a crop is wrong for it alone. Where the
  crop covers the whole sheet (2K visit), `lastTouch` is byte-identical too.
- **The amount-0 bypass is required**: at `amount 0`, `A_eff = cover`, so the layer path
  replaces the base with the layer (it loses same-visit pickup). Measured **203/255**.
- The visit's two strokes at 2K produce an `everPainted` crop of the whole 2048² sheet, so
  the visit capture is byte-identical in full — the single-stroke crops are the ones that
  drift.
