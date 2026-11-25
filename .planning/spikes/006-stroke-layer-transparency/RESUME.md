# Resume here — spike 006

**Last measured: 2026-11-25.** Q1, Q2 and Q3 are answered; Q4 is not started.

Read first: `SPECS/v2.2.0-medium-engine/SPIKE-stroke-layer-FINDINGS.md`
(the whole record; it is gitignored, it lives only in the tree).

## Where the answers stand

| Q | verdict | one line |
|---|---|---|
| Q1 | GO, conditional | band-mix composite + bounded KM fit lands in 7 coeffs at ≤1/255; the design's §3.3 law and the 7×16 pinv both fail |
| Q2 | NO | the shipped committed-base merge multiplies, it does not glaze; only the layer supplies a lateral alpha |
| Q3 | GO / NO-GO | 2K merge is ~50 ms per realistic stroke rect (bar 16.7 ms) and 224 MB of 256 MB; 4K is unallocatable |
| Q4 | not run | parity: live / capture / bake, amount-0 identity |

## Reproduce

```bash
# Q1 — the composite law
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --size 540

# Q3 + Q2 + the pool rider — the real GLSL merge
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario cost --size 1080
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs --scenario cost --size 2048
```

Results in `results/` (`composite-540*.json`, `cost-1080.json`, `cost-2048.json`,
`cost-smoke.json`). The `probe.bundle.js` is a build artifact — regenerate, never commit.

## Files

- `probe/law.ts` — the CPU mirror of `displayBasisGLSL` + the two composite laws + both encoders
- `probe/sheet.ts` — sheet decode/encode/restore, the pool split, the RNG and engine tap
- `probe/merge.ts` — **the GLSL LM merge pass** (the Q3 harness)
- `probe/probe.ts` — the Q1 scenario · `probe/cost.ts` — Q3 + Q2 + rider
- `probe/run.mjs` — bundles and drives headless Chrome; `--scenario composite|cost`

## Known rough edges (do not re-derive)

- `readHalf` returns half **bit patterns** — decode with `fromHalf` before using them.
- `gl.finish()` is not a fence in WebGL; a 1×1 `readPixels` is.
- The engine pins its own RNG (`setRandom(seededRandom(1))`), so `--seed` is inert.
- The merge shader needs LM step **rejection** and a good seed; without rejection it
  diverges on a handful of texels and reports 156/255 outliers.
- The 2048 run's timing rows are noisy (shared GPU); the 4-iteration numbers are the
  stable, affordable configuration.
