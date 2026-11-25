# Resume here — spike 006

**Last measured: 2026-11-25.** Q1, Q2, Q3 and Q3b are answered; Q4 is not started
(Q3b failed, and the brief said stop and report).

Read first: `SPECS/v2.2.0-medium-engine/SPIKE-stroke-layer-FINDINGS.md`
(the whole record; it is gitignored, it lives only in the tree).

## Where the answers stand

| Q | verdict | one line |
|---|---|---|
| Q1 | GO, conditional | band-mix composite + bounded KM fit lands in 7 coeffs at ≤1/255; the design's §3.3 law and the 7×16 pinv both fail |
| Q2 | NO | the shipped committed-base merge multiplies, it does not glaze; only the layer supplies a lateral alpha |
| Q3 | GO / NO-GO | 2K merge is ~40–50 ms per realistic stroke rect (bar 16.7 ms); 4K is unallocatable; the ping-pong memory was 224 MB |
| Q3b | **FAIL** | the merge is a real **36–44 ms stroke-end stall** at 2K (bar for an immediate restart: 20 ms). Painting unaffected (+0.4 ms display), memory **+80 MiB** (in-place merge into the engine's existing ink/cover doubles), 50/200 ms pauses hide it. Half-res 11.9 ms but max 216/255; rank-one Jacobian exact but only 33 ms |
| Q4 | not run | parity: live / capture / bake, amount-0 identity — gated on Q3b |

## Reproduce

```bash
# Q1 — the composite law
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --size 540

# Q3 + Q2 + the pool rider — the real GLSL merge
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario cost --size 1080
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario cost --size 2048

# Q3b — the serialized stroke-end path + both cost variants
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario q3b --size 2048
```

Results in `results/` (`composite-540*.json`, `cost-1080.json`, `cost-2048.json`,
`q3b-2048.json`, `cost-smoke.json`). The `probe.bundle.js` is a build artifact —
regenerate, never commit.

## Files

- `probe/law.ts` — the CPU mirror of `displayBasisGLSL` + the two composite laws + both encoders
- `probe/sheet.ts` — sheet decode/encode/restore, the pool split, the RNG and engine tap
- `probe/merge.ts` — **the GLSL LM merge pass**, the rank-1 Jacobian variant, the half-res
  resolve and the display-cost proxy (all the GPU passes)
- `probe/probe.ts` — the Q1 scenario · `probe/cost.ts` — Q3 + Q2 + rider ·
  `probe/q3b.ts` — the serialized path, variants, memory and the Q4 parity block
- `probe/run.mjs` — bundles and drives headless Chrome; `--scenario composite|cost|q3b`

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
- `gl.flush()` after the merge is what makes a "start the next stroke 50 ms later" pause
  real GPU time instead of an unsubmitted queue.
- A half-resolution fit cannot be rescued by a better resolve: the band is a pointwise mix
  of two full-resolution textured states. The exact-core branch is provably right
  (aEff ≥ 0.9999: max 0/255 over 166,846 texels), so do not go looking for a resolve bug.
- The 62 texels over 2/255 all sit at aEff 0.25–0.5 — the LM's seed switch, not the law.
