# Resume here — spike 006

**Last measured: 2026-11-25.** Q1, Q2, Q3, Q3b and Q3c are answered; Q4 is not started
(Q3c failed its gate by 0.6–1.8 ms, and the brief said Q4 only if it passes).

Read first: `SPECS/v2.2.0-medium-engine/SPIKE-stroke-layer-FINDINGS.md`
(the whole record; it is gitignored, it lives only in the tree).

## Where the answers stand

| Q | verdict | one line |
|---|---|---|
| Q1 | GO, conditional | band-mix composite + bounded KM fit lands in 7 coeffs at ≤1/255; the design's §3.3 law and the 7×16 pinv both fail |
| Q2 | NO | the shipped committed-base merge multiplies, it does not glaze; only the layer supplies a lateral alpha |
| Q3 | GO / NO-GO | 2K merge ~40–50 ms per realistic stroke rect; 4K unallocatable; the ping-pong memory was 224 MB |
| Q3b | **FAIL** | a real **36–44 ms stroke-end stall** at 2K (bar 20). Painting unaffected (+0.4 ms display), memory +80 MiB, 50/200 ms pauses hide it. Half-res 11.9 ms but max 216/255; rank-one Jacobian exact but only 33 ms |
| Q3c | **FAIL, by 0.6–1.8 ms** | 8 D-optimal bands + 4 it + rank-one + seed mix meets the residual **exactly** (max 2, p95 1, 0 texels over) at **20.6–21.0 ms felt** (bar 20). The 2-iteration combination is **9.4–9.7 ms** but max 13. Each LM iteration ≈ 5.5 ms; the bar needs four |
| Q4 | not run | parity: live / capture / bake, amount-0 identity — gated on Q3b *and* Q3c |

## The frontier (Q3c), for whoever picks this up

| iterations | felt ms | residual max | verdict |
|---|---|---|---|
| 2 | 9.5 | 13 | fast, wrong |
| 3 | 15.0 | 6 | fast, wrong |
| **4** | **20.6–21.0** | **2 (0 over)** | **right, ~1 ms slow** |
| 12 (16 bands) | 183 | 2 | unaffordable |

Cost ≈ **5.5 ms × LM iterations** at 8 bands over a 1.45 M-texel stroke rect. The band
count is the lever (16 → 8 cuts the cost 30.3 → 19.1 ms, −37 %); the Jacobian is not (~1.0×).

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
```

Results in `results/` (`composite-540*.json`, `cost-1080.json`, `cost-2048.json`,
`q3b-2048.json`, `q3c-2048-s0.3-a100.json`, `cost-smoke.json`). The `probe.bundle.js` is a
build artifact — regenerate, never commit.

## Files

- `probe/law.ts` — the CPU mirror of `displayBasisGLSL` + the two composite laws + both encoders
- `probe/sheet.ts` — sheet decode/encode/restore, the pool split, the RNG and engine tap
- `probe/bands.ts` — the band selection: importance, sensitivity direction, D-optimal search
- `probe/merge.ts` — **the GLSL LM merge pass**, the rank-one Jacobian, the half-res
  resolve, the display-cost proxy; the fit's band list, the Jacobian and the seed law are
  compiled into the shader
- `probe/probe.ts` — the Q1 scenario · `probe/cost.ts` — Q3 + Q2 + rider ·
  `probe/q3b.ts` — the serialized path, variants, memory and the Q4 parity block ·
  `probe/q3c.ts` — the reduced-band-set fit, the frontier table and the interleaved A/B
- `probe/run.mjs` — bundles and drives headless Chrome; `--scenario composite|cost|q3b|q3c`

## Known rough edges (do not re-derive)

- `readHalf` returns half **bit patterns** — decode with `fromHalf` before using them.
- `gl.finish()` is not a fence in WebGL; a 1×1 `readPixels` is.
- The engine pins its own RNG (`setRandom(seededRandom(1))`), so `--seed` is inert.
- The merge shader needs LM step **rejection** and a good seed; without rejection it
  diverges on a handful of texels and reports 156/255 outliers.
- **Timing method matters more than the number.** Q3's `run()` loop queues 20 draws and
  divides, which measures throughput and hides the latency (and had a ±20 % run-to-run
  spread; the committed `cost-2048.json` and the FINDINGS §3.2 table disagree because the
  table came from a run whose JSON was overwritten). Q3b's single draw after an idle GPU
  is the serialized-path measurement. Always run a **size ladder** (1×1 / 512² / 1024² /
  full) — it is what proves the cost is fragment work rather than a per-draw floor.
- **Run-to-run drift at this scale is ±10 %.** Q3b's baseline measured 36.0 ms one day and
  29–31 ms the next; the same Q3c shader read 21.0 mid-run and 23.6 at the end of one run.
  When the gate is a ~1 ms margin, measure the two contenders **interleaved in one process**
  (Q3c does 4× A/B); a table of sequential candidates cannot resolve it.
- `gl.flush()` after the merge is what makes a "start the next stroke 50 ms later" pause
  real GPU time instead of an unsubmitted queue.
- A half-resolution fit cannot be rescued by a better resolve: the band is a pointwise mix
  of two full-resolution textured states. The exact-core branch is provably right
  (aEff ≥ 0.9999: max 0/255 over 166,846 texels), so do not go looking for a resolve bug.
- The 62 texels over 2/255 all sit at aEff 0.25–0.5 — the LM's seed switch, not the law.
  **Fixed in Q3c** by seeding from `mix(base, layer, aEff)` (16 bands: max 3 → max 1, 0
  over; 8 bands: max 5 → max 2, 0 over). The fix costs +1.6–2.0 ms in rejected LM attempts.
- The numeric Jacobian is **unstable** when the band count equals the parameter count
  (8 bands): forward differences plus step rejection blow out at the seed boundary
  (R = 255 at aEff 0.496, max 17/255). The rank-one Jacobian is exact (max 5). Use rank-one
  for correctness, not for speed.
- A reduced band list must be compiled into the shader, not masked by a uniform: the arrays
  (`tgt`, `r0`, `J`, the normal equations) only shrink when the constant does. Design
  constants (band list, Jacobian, seed law) belong in the source; only scene parameters
  belong in uniforms.
