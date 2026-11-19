---
spike: 002
idea: acrylic-bristle-deposit
name: acrylic-bristle-deposit
type: standard
validates: "Given the recorded stroke script and a pinned paper seed, when a per-bristle carrier and 5-nearest deposit are replayed twice, then the exported sheets and the bristle reservoirs are byte-identical; the deposit costs a stated bake/render delta at 1080² and 2K on the real engine; and a last-touch channel's sheet/undo/cache bytes are measured"
verdict: VALIDATED — go on all three legs, each with a stated condition
related: [001]
tags: [webgl2, watercolor, acrylic, bristles, pickup, determinism, performance]
---

# Spike 002: Acrylic bristle deposit feasibility

## What This Validates

The three decision legs, against the acceptance asks in
`SPECS/v2.2.0-medium-engine/better-acrylic.md`:

1. **Deterministic replay** — can per-bristle reservoirs be reconstructed from
   the stroke script alone, with two replays of the same script byte-identical?
   If not, what state must enter the record?
2. **Cost** — does the 5-nearest gather plus the per-bristle loop fit the
   current bake/render budget at 1080² and 2K, on the real engine?
3. **Wetness** — is a last-touch signal derivable from existing coverage, or
   does it need a new channel, and what does that channel cost?

The experiment is a throwaway workbench: a copy of `packages/efx-watercolor/src`
with the reference's carrier and deposit ported into WebGL2, driven through the
real `createAquarelleEngineAdapter` in headless Chrome (real WebGL2, SwiftShader),
using the `probe/medium-engine` harness idiom. No production file was changed.

**Headline verdicts**

| Leg | Verdict | Measured |
|---|---|---|
| 1. Determinism | **GO**, conditional | 2 replays → identical image *and* reservoir digests at 256², 1080², 2K. Condition: the paper seed must be pinned — today it is not, and the current engine already fails replay equality without it (`det-paper-baseline`) |
| 2. Cost | **GO** | bake +26.2 % at 2K / +28.7 % at 1080² on the 50-stroke passage; +36 % (1080²) and +51 % (2K, 256 bristles) on a large acrylic brush. Render +6–8 ms on the 50-stroke passage; at 2K the render phase is export-dominated and engine-insensitive |
| 3. Wetness | **GO — new channel required** | coverage alone cannot encode recency; `wet × cover` is a usable proxy but not §3.4's law. R32F pair: **+26.1 MB** at 1080², **+67.1 MB** at 2K (sheet + undo atlas), measured; frame cache **0 B** (session-scoped) |
| Frontier (2026-11-19) | **GO — they compose** | bristle gather + coverage composite on the same stroke at Body 100: stack bake 675.5 ms at 1080² / 1.17 s at 2K, **+22.5 % / +17.6 %** over the shipping Body-100 build, **+85 % / +111 %** over the no-Medium build; no new GPU targets; byte-identical replays. See "Frontier measurement" |

## Contract: source documents

- `SPECS/v2.2.0-medium-engine/better-acrylic.md` — the three acceptance asks
  (Body as a blend, direction-aware anti-aliasing, water/feather in acrylic)
  and the REA remarks (blending in the brush and on contours, trails, edge
  variation).
- `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md` — the
  reverse-engineered algorithm. Every formula below carries its section.
- `/Users/lmarques/Dev/craft-brushes/site/assets/app.js` — the reference
  shaders (`F` bristles, `R` stamp, `I` present) where a formula was ambiguous.
  The one ambiguity resolved there: `spacing` in the deposit shader is
  **normalised** (`2/count`), so `radius = shape.y · spacing · halfWidth` is in
  pixels, not px² (app.js:1208–1213).

## Research

### The reference, in the notes' own terms

- §2 — the canvas is two storage buffers: premultiplied linear RGB + coverage
  as packed `f16` pairs (8 B/px) and a per-pixel `f32` last-touch time (4 B/px).
  Colour is converted to linear in JS and back to sRGB once, at present.
- §3.1 — each bristle holds its own reservoir `(rgb, alpha, load)`, samples the
  canvas at 3 taps along its direction, and mixes toward the canvas (`pickup`)
  and toward fresh pigment (`refill`). The equilibrium is
  `carried* ≈ pickup/(pickup+refill)·canvas + refill/(pickup+refill)·pigment`,
  and because `refill` is scaled by `load`, **a stroke changes its own mixing
  ratio as it empties** (clean start, muddy middle, dry pick-up at the end).
- §3.2 — the deposit is an ink-weighted average of ≤ 5 reservoirs, so the pixel
  receives a colour that is already mixed. `mix(canvas, carried, deposit)` is
  the only compositing operation in the reference.
- §3.3 — deposit-time smear, a per-pixel pull toward the wet canvas gated by a
  hash that re-rolls every 6 px along the stroke.
- §3.4 — `wetness = exp(−age / wetSeconds) · alpha`; the timestamp is refreshed
  by `times = mix(times, now, deposit)`, so a partially covered pixel only
  partially refreshes.
- §4.1 — bristle spacing is a fixed ≈ 1.1 device px,
  `count = round(clamp(2·halfWidth/1.1, 40, 256))`; the radius floor is 0.8 px.
- §4.2 — tufts of 3–17 bristles share radius/contact/load; 18 % of tufts are
  0.80–0.92 and 12 % 1.04–1.12 in value (the dark/light fibres); edge bristles
  are thicker, drier and print later.
- §4.3 — `broken` is 1D noise along the stroke gated by `dryness`, so dashes
  appear only as the brush dries.
- §4.4 — `grainHeight` mixes three noise bands in two coordinate systems:
  `streaks` (brush-local, along the stroke), `tooth` (screen, isotropic),
  `cloud` (low-frequency absorbency), turned into
  `threshold = grain·(1−height) − 0.25`.
- §4.5 — `body = mix(wide/5·presence, local, hairs)`: a smooth core vs a bundle
  of fibres, with the same knob that breaks the stroke when dry.
- §5 — six independent edge contributions: the soft cross-section, pressure
  from speed, rim-scaled contact noise, staggered landing, the `dryEdge` bias,
  and the 1/255 dither.
- §8 — per substep: one `ceil(count/64)`-workgroup dispatch plus one dispatch
  over the substep quad; 256 bristles × 48 B = 12 KB; canvas 12 B/px.
- §9 — the four non-skippable things: timestamps as wetness, per-bristle loads,
  the paper threshold, and rim contact noise.

### Studio's integration surface (read, not changed)

| Surface | What it is today | Consequence for the port |
|---|---|---|
| `playground/Engine.ts` `stamp()` (brush case, ~L2120–2207) | per-dab seam: `eachDab` → `brushInk` / `coverageDeposit` + `brushRelief` + `brushWet` | the carrier + gather replace `brushInk` only; the rest of the seam is reuse |
| `playground/Engine.ts` `brushInk` / `drawStamp` | one tip-texture stamp, additive absorbance deposit | the gather must write *per-pixel carried coefficients* instead of `uColor0·f` |
| `playground/Engine.ts` `coverPass` / `coverageDeposit` | Body = order (erode `fixed`/`relief`) + coverage composite (`a = amount·(1−exp(−density·mask))`) | acceptance ask #1 ("blend, not transparency") already lands here |
| `playground/shaders.ts` `stampFS`, `FOOTPRINT_MASK`, `displayFS` mode 4 | tip-space footprint; display alpha = `max(1−min(rgb), cover)` | the gather's `q` mapping is the same math; the coverage channel already exists |
| `playground/Engine.ts` `allocateTargets` / `allocateHistory` / `snapshotLayers` / `travel` | doc targets + pooled tile undo; pool 0 = ink A/B, wet, relief, cover | a new layer must join all four lists together |
| `playground/Engine.ts` `processInput` (stroke start, ~L2006) | first queued sample starts the stroke; `this.rng` is the seeded stream | the bristle set is seeded here, from `this.rng` only |
| `playground/Engine.ts` `resetSheet` | wipes the sheet, keeps paper and seed; "bakes never travel history" | a replay starts from blank paper — the precondition for reservoir reconstruction |
| `adapter/engineAdapter.ts` `configure` (~L300–340) | `engine.setRandom(seededRandom(stroke.traceSeed))` per stroke | `traceSeed` is the bristle-set key; no new record field needed for the set |
| `payload/toStudioStroke.ts` | `traceSeed = hashMutationId(mutationId)` (± `paintSeedSalt`); points carry `tick`, width, pigment; brush id, texture id/rotation, tool overrides, params | the script *is* the reservoir input; the seed is derived, not stored |
| `playground/brushes.ts` | `bristle-flat` / `bristle-round` exist as acrylic presets — a procedural **tip texture**, not reservoirs | the port replaces the texture with geometry for these two responses; other tips stay |
| `playground/mediums.ts` | acrylic record: water 8, load 100, flow 50, bleed 10, dry 70, edge 65, granulation 25, viscosity 90, body 85, emboss 40 | the reference's `pickup`/`refill`/`wetSeconds` have no medium key yet (plan question) |
| `roto/physicsPaintRotoPlayScriptController.ts:4264` | script edits = a **fresh adapter + full replay from blank paper** | the bake path is already the deterministic model the reservoirs need |
| `roto/aquarelleScriptReplay.ts` | undo/apply = reset sheet + full re-bake | same |
| `AquarelleCachedBaseLayer.tsx` + `useRotoFramePersistenceCoordinator.ts` | committed frames are a per-key **WebP raster**; a new live stroke paints on a clean sheet and is merged over the base at publish | (a) a live stroke cannot pick up the committed raster; (b) wetness cannot survive an apply without a sidecar |

### What the workbench added (throwaway, inside the spike)

- `workbench/src/playground/bristles.ts` — `bristleCount` (§4.1),
  `makeBristles` (§4.2) from the stroke RNG in a fixed call order.
- `workbench/src/playground/bristleShaders.ts` — `carrierBristleFS` (§3.1,
  §3.4, §5.3), `depositBristleFS` (§3.2, §3.4–§4.5, §5.1, §5.3–§5.5),
  `coverBristleFS` (same gather, coverage only), `touchBristleFS` (§3.4).
- `workbench/src/playground/Engine.ts` — three RGBA16F `1 × 256` reservoir
  textures (carried absorbance 0–3; 4–6 + alpha; load/across/seed/jitter) plus
  a static shape texture, all ping-ponged; a document-sized R32F last-touch
  pair; the per-dab carrier + gadget in `stamp()`; the touch layer in pool 0.
- `probe/probe.ts`, `probe/run.mjs` — the gate driver (two replays for
  determinism, one engine per page for cost, GL-boundary byte counting).

## Formulas (with the notes' sections)

| Term | Formula | § |
|---|---|---|
| Count | `round(clamp(2·halfWidth/1.1, 40, 256))` | §4.1 |
| Across positions | `−1 + (i+0.5)·spacing + (rand−0.5)·0.6·spacing`, `spacing = 2/count` | §4.1 |
| Bristle radius | `max(radiusScale·spacing·halfWidth, 0.8 px)` | §4.1 |
| Profile | `offset = (across − across_i)·halfWidth/radius`; `profile = (1−offset²)²` | §3.2, §5.1 |
| Tufts | runs of `3 + floor(rand·14)`; `d = 0.75+0.6r`, `f = (r−0.5)·0.16`, `p = 0.88+0.12r`, value `m`: 18 % 0.80–0.92, 12 % 1.04–1.12, else 0.96–1.04 | §4.2 |
| Per bristle | `radius = d·(0.88+0.24r)·(1+1.4·edge)`; `touchReach = clamp(0.04+0.3r²+0.42·edge+f, 0, 0.92)`; `loadRate` = radius law; `load₀ = p·(1−0.3·edge·r)`; `value = m·(1±0.04)`; `edge = smoothstep(0.55,1,\|across\|)` | §4.2 |
| Thirst | `0.15 + 2.4·smoothstep(0.35, 0.9, fract(seed·7.31))` | §3.1 |
| Travel | `\|Δp\| / (2·halfWidth)` (brush widths) | §3.1 |
| Pickup | `clamp(pickupRate·thirst·travel·wet·touch, 0, 0.75)` | §3.1 |
| Refill | `clamp(refillRate·travel·load, 0, 1)` | §3.1 |
| Reservoir | `carried = mix(carried, canvas, pickup)`; `carried = mix(carried, pigment·valueJitter, refill)` | §3.1 |
| Equilibrium | `carried* ≈ pickup/(pickup+refill)·canvas + refill/(pickup+refill)·pigment` | §3.1 |
| Depletion | `load −= rate·loadRate·travelledPx·touch·(0.35+0.65·pressure)`; `load += pickup·0.25` | §3.1 |
| Ink weight | `profile · min(load·1.5, 1) · touch · broken · landed · combed` | §3.2 |
| Deposit colour | `carried = Σ ink·(rgb, alpha) / Σ ink` over the 5 nearest | §3.2 |
| Wetness | `exp(−max(now−times[i], 0)/wetSeconds) · alpha`; `times = mix(times, now, deposit)` | §3.4 |
| Dryness / dashes | `dryness = clamp((1−load)·streak·1.6, 0, 1)`; `streak = noise1(dist/streakLength + seed·4096)`; `broken = mix(1, smoothstep(0.3,0.7,streak), dryness·hairs)` | §4.3 |
| Paper height | `streaks·streakShare + tooth·0.35 + cloud·(0.65−streakShare)`; streaks `valueNoise(local.x/11, local.y·0.75)·0.65 + valueNoise(local.x/3, local.y·1.9)·0.35`; tooth/cloud as §4.4 | §4.4 |
| Threshold | `threshold = grain·(1−height) − 0.25`; `deposit = smoothstep(threshold−softness, threshold+softness, coverage)` | §4.4 |
| Body | `wide = Σ_{−2..2} min(load·1.25,1)·touchOf(touchReach, pressure)` at stride 7; `presence = min(profileSum/0.5,1)`; `local = inkSum/max(profileSum,0.5)`; `body = mix(wide/5·presence, local, hairs)` | §4.5 |
| Coverage | `body·(0.3+0.7·pressure)·dryEdge` | §4.5, §5.5 |
| Contact noise | `rim = 0.25+0.75·smoothstep(0.45,1,\|across_i\|)`; `contact = noise1(dist/(streakLength·0.7)+seed·2048+0.5)−0.5`; `touch = touchOf(touchReach + contact·rim·rimContact, pressure)` | §5.3 |
| Landing | `landing = (0.04+0.7·fract(seed·13.7)²)·landing`; `landed = smoothstep(landing, landing+0.12, dist/max(halfWidth,1))` | §5.4 |
| Edge bias | `dryEdge = mix(1, dryEdge, smoothstep(0.3, 1.05, \|across\|))` | §5.5 |
| Defaults | pickup 0.6, refill 0.6, wetSeconds 7, grain 1.2, softness 0.09, streak 0.9, streakLength 18, streakShare 0.15, rimContact 0.45, hairs 0.45, dryEdge 0.35, landing 1 | §6 |

**Adapted, not copied:** pressure. The reference derives pressure from speed
and an attack/lift envelope (§5.2); Studio has its own
`processInput` speed → `simPressure` law (Engine.ts ~L2030–2035) and its own
pen-pressure path. The port consumes `pr` as the engine resolves it. The
reference's `distanceAlong` is CSS px; the port uses document texels (the sheet
is the canvas), and `halfWidth`/`travelled` are converted per sheet.

**Mapped into the spectral field:** the reference's reservoir is RGB; Studio's
canvas is 7 absorbance coefficients + scattering. The port carries the
**coefficient vector** per bristle and mixes in coefficient space
(`carried = mix(carried, canvasCoeffs, pickup)`). This is the structural
consequence of Studio's pigment model — see "What NOT to port".

## How to Run

```bash
cd .planning/spikes/002-acrylic-bristle-deposit

# determinism (two replays in one page): images AND reservoirs must match
node probe/run.mjs --gate det-cross --engine bristle --scenario cross --size 256
node probe/run.mjs --gate det-salt1 --engine bristle --scenario cross --size 256 --salt 1
node probe/run.mjs --gate det-paper-bristle --engine bristle --scenario cross --size 256 --paper-b random
node probe/run.mjs --gate det-paper-baseline --engine baseline --scenario cross --size 256 --paper-b random

# cost (one engine per page — the committed methodology)
node probe/run.mjs --gate wc1080-base    --engine baseline --scenario watercolor-50 --size 1080 --runs 1
node probe/run.mjs --gate wc1080-bristle --engine bristle  --scenario watercolor-50 --size 1080 --runs 1
node probe/run.mjs --gate wc2048-base    --engine baseline --scenario watercolor-50 --size 2048 --runs 1
node probe/run.mjs --gate wc2048-bristle --engine bristle  --scenario watercolor-50 --size 2048 --runs 1
node probe/run.mjs --gate ac1080-base    --engine baseline --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --runs 1
node probe/run.mjs --gate ac1080-bristle --engine bristle  --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --runs 1
node probe/run.mjs --gate ac2048-base    --engine baseline --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --runs 1
node probe/run.mjs --gate ac2048-bristle --engine bristle  --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --runs 1

# wetness: the same acrylic scene, last-touch channel off vs on
node probe/run.mjs --gate wet1080-off --engine bristle --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --touch 0 --runs 1
node probe/run.mjs --gate wet1080-on  --engine bristle --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --touch 1 --runs 1

# combined Body (added 2026-11-19): the frontier question — the deposit and
# the coverage composite on the SAME stroke. `--body` is canonical 0..100 and
# travels through toEngineParams(), exactly the Phase 64 mapping.
node probe/run.mjs --gate ac1080-b0        --engine bristle  --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --body 0   --runs 1
node probe/run.mjs --gate ac1080-b100      --engine bristle  --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --body 100 --runs 1
node probe/run.mjs --gate ac1080-b100-wet  --engine bristle  --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --body 100 --touch 1 --runs 1
node probe/run.mjs --gate ac2048-b0        --engine bristle  --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --body 0   --runs 1
node probe/run.mjs --gate ac2048-b100      --engine bristle  --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --body 100 --runs 1
node probe/run.mjs --gate ac2048-b100-wet  --engine bristle  --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --body 100 --touch 1 --runs 1
node probe/run.mjs --gate acb1080-b0       --engine baseline --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --body 0   --runs 1
node probe/run.mjs --gate acb1080-b100     --engine baseline --scenario acrylic-20 --size 1080 --size-param 60 --brush bristle-flat --body 100 --runs 1
node probe/run.mjs --gate acb2048-b0       --engine baseline --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --body 0   --runs 1
node probe/run.mjs --gate acb2048-b100     --engine baseline --scenario acrylic-20 --size 2048 --size-param 60 --brush bristle-flat --body 100 --runs 1
```

Results land in `results/<gate>.json`. Every gate reports both runs, the four
export digests, `paintedPct`, four region means, the GPU target bytes counted at
the GL boundary, and — for the workbench — the bristle count and reservoir
digest. Facts from the runs:

- The **baseline 1080² watercolor-50 capture reproduces the committed 64-14
  digests exactly**: transparent `7f56e401`, pigment `432f3a3f` — the same
  numbers as `64-14-SUMMARY.md` line 198. The harness is measuring the real
  engine.
- Two live engines in one page add SwiftShader memory pressure at 2K (the
  second run degraded ~35 % in one early gate). Cost gates therefore run one
  engine per page, exactly like `probe/medium-engine`.

## Results

### Leg 1 — deterministic replay: **GO, conditional**

| Gate | Images | Reservoirs | Pigment digest |
|---|---|---|---|
| `smoke-bristle` (cross, 256², 2 replays) | identical | identical `364300cf` | `ee370877` both |
| `cost-1080-bristle` (watercolor-50, 1080², 2 replays) | identical | identical `076aecee` | `3b021ec2` both |
| `cost-2048-bristle` (watercolor-50, 2K, 2 replays) | identical | identical `146298c6` | `36d5b3a3` both |
| `det-salt1` (same script, unrecorded RNG offset 1) | identical *within* the gate, but **different from salt 0** | `30340c5b` vs `364300cf` | `babb5c49` vs `ee370877` |
| `det-paper-bristle` (run B unpinned paper seed) | **different** (`ee370877` vs `6d569548`) | identical (`364300cf` both) | — |
| `det-paper-baseline` (current engine, run B unpinned) | **different** (`7d58f971` vs `c5594fba`) | — | — |

Reading:

- A bristle set generated from the stroke RNG is a pure function of the record.
  Two fresh adapters, full replays from blank paper, produce byte-identical
  exports **and** byte-identical reservoirs at 256², 1080² and 2K.
- `salt` is the negative control for the seed: an unrecorded RNG offset changes
  both the reservoirs and the image. The **seed is load-bearing**, and it is
  already in the record (`traceSeed`, derived from `mutationId` — D-20).
- The **paper seed is the one missing record field**. The engine rolls
  `paperSeed` from `Math.random()` in the constructor (Engine.ts:574) and
  `setPaper()` never re-seeds it. The current engine already fails replay
  equality when the seed is unpinned (`det-paper-baseline`), because the paper
  height gates the deposit. Note that `identicalBristles` stays true in
  `det-paper-bristle`: the carrier samples ink/fixed/wet/cover, not paper, so
  the reservoir set is paper-independent — the paper seed enters at the
  deposit's tooth threshold, exactly as §4.4 says.
- **What must enter the script record:** nothing new for the reservoirs
  themselves. One pre-existing gap must close first: the paper seed (record it,
  or derive it from the document/mutation id), plus the already-recorded
  `traceSeed`, stroke points/ticks, params, brush id, texture id/rotation and
  dry events. The clock is already virtual in the bake.
- **The one replay the model does not cover:** a *live* stroke on a frame with a
  committed raster base paints on a clean sheet (the base is composited at
  publish), so its reservoir cannot pick up the committed paint. A script
  re-bake can. This is an app-architecture boundary, not an engine one — see
  "Limitations".

### Leg 2 — cost: **GO**

One engine per page, same script, same seeds. `bakeMs` = script + settle
(exports excluded); `renderMs` = the four exports + readbacks. Medians of two
runs where two exist.

| Gate | Sheet | Bristles | bakeMs | Δ bake | renderMs | Δ render | GPU peak | Δ peak |
|---|---|---|---|---|---|---|---|---|
| `wc1080-base` | 1080² | — | **833** (822–844) | — | **78** | — | 196.8 MB | — |
| `wc1080-bristle` | 1080² | 48 | **1072** (1071–1072) | **+239 (+28.7 %)** | **84** | **+6** | 223.0 MB | +26.2 MB |
| `wc2048-base` | 2K | — | **951** (947–955) | — | **196** | — | 547.0 MB | — |
| `wc2048-bristle` | 2K | 91 | **1200** (1197–1204) | **+249 (+26.2 %)** | **204** | **+8** | 614.2 MB | +67.2 MB |
| `ac1080-base` | 1080² | — | **383** | — | **147** | — | 196.8 MB | — |
| `ac1080-bristle` | 1080² | 190 | **521** | **+138 (+36 %)** | 189 | +42 (see note) | 223.0 MB | +26.2 MB |
| `ac2048-base` | 2K | — | **551** | — | **398** | — | 547.0 MB | — |
| `ac2048-bristle` | 2K | 256 (cap) | **832** | **+281 (+51 %)** | 337 | export noise | 614.2 MB | +67.2 MB |

Budget comparison. 64-15 records no probe durations (it is the app-seam plan);
the cost numbers for this gate are 64-14's (`64-14-SUMMARY.md` line 198:
watercolor-50 at 1080² — **bake 792 ms, render 79 ms**). 64-17's contract makes
both durations *measured, never gated*:

- The workbench's bristle bake at 1080² is 1072 ms, i.e. **+280 ms over the
  committed 792 ms** (+35 %). The same engine's baseline measured 833 ms in this
  harness (+5 % over the committed number, same digests), so the honest
  bristle delta against the harness baseline is **+239 ms (+28.7 %)**.
- At 2K no committed number exists; the harness baseline is 951 ms and the
  bristle delta is **+249 ms (+26.2 %)**.
- The large-brush passages are the stress case: 190 bristles at 1080²,
  **+36 %**; 256 (the §4.1 cap) at 2K, **+51 %**.
- `renderMs` on the 50-stroke passage moves by **+6 ms (1080²) / +8 ms (2K)**.
  The larger swings on the acrylic gates are the export phase's own variance
  (the identical export code runs in both engines), not bristle work; at 2K the
  exports dominate.
- **Where the cost goes:** the deposit is two fragment passes over the dab
  rectangle (the 5-nearest gather for absorbance + the same gather for
  coverage), plus two 1 × 256 carrier fragments per dab. The carrier is
  negligible; the gather is the delta, and it scales with the dab area, not the
  bristle count (the count only sizes the 1 × 256 textures and the 5 loads per
  pixel).

**Verdict:** go. The delta is bounded and recorded; there is no budget to blow.
The slicing below gives the gather its own cost gate so the visual law cannot
drift into an unbounded shader.

### Leg 3 — wetness: **GO — a new channel, measured**

**Can a last-touch signal be derived from existing coverage?** No.

- Coverage is an opacity with no time dimension (`displayFS` mode 4 reads it as
  `alpha = max(darkness, cover)`); two texels at 0.9 coverage can be one second
  or one hour old.
- The engine's `wet` channel does decay per tick and is per-texel, so
  `wet × cover` is a usable **proxy** for "wet paint" and costs nothing. It is
  not §3.4's law: it measures water amount, not age; re-wetting adds water
  instead of resetting a timer; a thin fresh stroke reads less wet than a thick
  older one. The workbench runs both modes (`touch=0` proxy, `touch=1`
  timestamp) through the same carrier.
- The reference's own answer is a separate field: `times` f32 per pixel (§2),
  refreshed by `times = mix(times, now, deposit)` (§3.4).

**What the channel costs (measured):**

| Cost | 1080² | 2K |
|---|---|---|
| Sheet: R32F ping-pong pair (4 B × 2) | **9.33 MB** | **33.55 MB** |
| Undo: pool-0 atlas gains one FLOAT_R layer (4 B/atlas texel) | **16.8 MB** (atlas 4,194,304 px) | **33.6 MB** (atlas 8,388,608 px) |
| **Total GPU peak delta** | **+26.1 MB computed / +26.2 MB measured** | **+67.1 MB computed / +67.2 MB measured** |
| Deposit-time draw | **+103 ms bake** on the 20-stroke acrylic passage (514 → 617 ms, +20 %) | not run (same per-dab law) |
| Frame cache | **0 B** — the committed frame is a WebP raster, and a new frame starts clean | 0 B |

The ping-pong is forced by the architecture: a WebGL2 fragment pass cannot read
and write the same texel, so the reference's in-place `f32` buffer becomes a
pair. If the channel ever needs to survive an Apply, it needs a sidecar
(2–4 B/px raw, or a 16-bit lossless image); today it does not, because every
frame starts dry (`AquarelleCanvasLayer` clears the sheet on a frame change).

**Verdict:** go, as its own plan with a memory gate. Treat the channel exactly
like `relief`: engine-only, rebuilt by replay, never written to a project
format (Engine.ts's relief comment is the precedent).

### Frontier measurement — the combined stack at full Body (2026-11-19)

The three legs above measured the deposit alone (Body 0). The open question the
wrap-up named was whether the bristle gather **composes with the coverage
composite on the same stroke at full Body**, and whether that combined fragment
stack still fits the bake budget. Measured with a `--body` operand on the same
`acrylic-20` passage (canonical Body 0..100 → `toEngineParams`, the shipping
mapping; one engine per page; a second sample where a delta is claimed):

| Engine | Sheet | Body | bakeMs (samples) | renderMs | GPU peak |
|---|---|---|---|---|---|
| bristle | 1080² | 0 | **510** (510–521) | 184 | 223.0 MB |
| bristle | 1080² | 100 | **675.5** (674–677) | 188 | 223.0 MB |
| bristle | 1080² | 100 + last-touch | **764** | 187 | 223.0 MB |
| bristle | 2K | 0 | **819** (819–832) | 335 | 614.2 MB |
| bristle | 2K | 100 | **1169** (1166–1172) | 357.5 | 614.2 MB |
| bristle | 2K | 100 + last-touch | **1220** | 355 | 614.2 MB |
| baseline | 1080² | 0 | **365** (365–383) | 161 | 196.8 MB |
| baseline | 1080² | 100 | **551.5** (549–554) | 196 | 196.8 MB |
| baseline | 2K | 0 | **553** (551–553) | 374 | 547.0 MB |
| baseline | 2K | 100 | **994** (987–1001) | 378.5 | 547.0 MB |

Reading:

- **They compose.** In the workbench's `stamp()` brush branch the order is
  carrier → `coverPass` (Body > 0) → the bristle gather deposit. Body 100
  moves the same regions in the same direction in both engines: on the 256²
  cross scene the baseline's crossing luma goes 30.4 → 107.0 and the bristle
  path's 89.9 → 162.4; on `acrylic-20` at 1080² the bristle crossing goes
  14.3 → 160.9. The cover law is doing its work over the bristle deposit, not
  fighting it.
- **Body is additive and deposit-law independent.** Its absolute cost is the
  same order in both engines — **+165 ms (+32.5 %)** bristle vs **+186 ms
  (+51.1 %)** baseline at 1080²; **+350 ms (+42.7 %)** vs **+441 ms (+79.7 %)**
  at 2K. That is the expected shape: the cover pass is ONE extra fragment pass
  over the dab footprint, independent of the bristle loop, so it does not
  multiply with the bristle count. The spread between the two engines' deltas
  is SwiftShader variance and the two pages' different memory footprints, not a
  law difference.
- **The combined stack vs shipping at the same Body:** 675.5 vs 551.5 ms at
  1080² (**+22.5 %**), 1169 vs 994 ms at 2K (**+17.6 %**); with the last-touch
  channel on, 764 vs 551.5 (**+38.5 %**) and 1220 vs 994 (**+22.7 %**).
  Against the shipping build with no Medium at all: **+85 %** (1080²) /
  **+111 %** (2K), or **+109 % / +121 %** with wetness — the number a budget
  line has to accept, not a number that breaks a gate (64-17: durations are
  recorded, never gated).
- **No new GPU targets.** The GPU peak is byte-identical across the Body pairs
  at each sheet size (the cover pass reuses the existing ink/base targets), so
  the Body composite costs time, not memory.
- **Still deterministic at full Body.** Two replays of the 256² cross scene at
  Body 100 are byte-identical on both engines — bristle images
  `0f36b320`/`b5984bd9` and reservoirs `c9f718b5`, baseline images
  `2b91ac4e`/`0ac9f361` — and equal to the single-run gates. The neutrality
  control also holds: `--body 0` reproduces the recorded Body-0 region readings
  and digests exactly on both engines.
- **One design question this measurement does NOT settle:** the cover pass was
  driven by the raw dab footprint (`bindFootprint`), the same mask the shipping
  law uses, while the deposit is broken up by the bristle profile. So at high
  Body the underlayer is hidden along the whole footprint even where the
  bristles deposited nothing. Whether the cover mask should instead be the
  bristle-modulated coverage is a visual law decision for **64-22**, not a
  measured verdict; it would move cost (the mask would come from the gather)
  and belongs in that plan's acceptance criteria.

**Verdict:** go, unchanged — but 64-22's cost gate should be stated against the
Body-100 numbers above (675.5 ms / 1.17 s), not only against the Body-0
`833 / 951 ms` baselines, and its acceptance must pick footprint-cover or
bristle-cover explicitly.

## Touch points in Studio (what a plan would edit)

1. `packages/efx-watercolor/src/playground/Engine.ts`
   - `processInput` stroke start: seed the bristle set from `this.rng`.
   - `stamp()` brush case: call the carrier before `eachDab`, and the gather
     instead of `brushInk` (Body/relief/wet draws keep their order).
   - `allocateTargets` / `allocateHistory` / `snapshotLayers` / `travel` /
     `docTargets`: grow together for any new channel.
   - `resetSheet`: clear the new state to its sentinel.
2. `packages/efx-watercolor/src/playground/shaders.ts` — the gather's constants
   and noise family; keep `FOOTPRINT_MASK` as the single footprint law.
3. `packages/efx-watercolor/src/playground/brushes.ts` — `bristle-flat` /
   `bristle-round` become geometric settings (count/spacing/jitter) instead of
   (or in addition to) their tip texture; every other preset keeps its tip.
4. `packages/efx-watercolor/src/playground/mediums.ts` — the acrylic record
   needs `pickup` / `refill` / `wetSeconds` (or their canonical equivalents) or
   they ride existing params; a plan decision.
5. `packages/efx-watercolor/src/adapter/engineAdapter.ts` + `payload/toStudioStroke.ts`
   — pin/record the paper seed; `traceSeed` already exists.
6. `app/src/components/physic-paint/roto/` — the replay/publish boundary:
   decide whether a live stroke on a committed frame hydrates the base into the
   engine (required for pickup on existing paint) or keeps the merge model.
7. Probe gates: extend `probe/medium-engine` with a bristle scenario and the
   `watercolor-50`/2K cost pair; the same `bakeMs`/`renderMs` contract applies.

## Proposed 64-21 … 64-24 slicing (adjusted to the measurements)

| Plan | Scope | Gate (all measured, none tuned into the law) |
|---|---|---|
| **64-21 — record + reservoirs** | Pin the paper seed (record or derive); deterministic bristle set from `traceSeed`; the `1 × 256` reservoir pair + carrier pass per dab. Deposit stays the current stamp: no visual law change, so every existing neutral/identity gate stays byte-identical. | Two replays in the probe → identical exports *and* reservoirs at 256²/1080²/2K; the neutral and Body-0 identity gates unchanged; `bakeMs` carries the carrier-only delta (this spike measured it as negligible). |
| **64-22 — the gather + the mixing law** | 5-nearest ink-weighted carried coefficients; profile/body/coverage; pickup/refill exposed; the RGB→coefficient law and the §3.3 smear decision; Body composition through `coverageDeposit` (footprint-cover or bristle-cover — decide explicitly). | Acceptance ask #1 (Body as a blend, contour blending) on the probe's cover scenes; the 50-stroke `bakeMs` at 1080² and 2K against **833 / 951 ms** (harness baselines) with the **+239 / +249 ms** reference delta, **and** the combined Body-100 gate: **675.5 ms / 1.17 s** (this spike, 2026-11-19); no new full-document pass. |
| **64-23 — traces + directional edges** | `broken` (§4.3), `grainHeight` trio (§4.4), rim contact (§5.3), landing (§5.4), `dryEdge` (§5.5), `wide/local` body (§4.5). This is the heaviest fragment path and the home of acceptance ask #2 and the REA "trails/edge variation" remarks. | The same cost gates (this spike's numbers already include the full noise stack); a visual gate for direction-following AA and the hairy rim; the 256-bristle cap case at 2K (**+51 %** reference). |
| **64-24 — acrylic water + wetness** | The R32F last-touch pair (or a recorded decision to ship the `wet × cover` proxy); the §3.4 gate in the carrier; Wet/Dry UI wiring; the frame-cache decision (session-scoped). | Memory pins: **+26.1 MB** at 1080², **+67.1 MB** at 2K (sheet + undo atlas); **+103 ms** bake on the 20-stroke passage at 1080²; no persisted sidecar; the watercolor Wet/Dry law unchanged. |

Rationale for the order: determinism is a precondition for every later gate
(64-21), the gather is the cost-bearing core and the mixing law decision
(64-22), the texture stack is the visual acceptance and the largest shader
(64-23), and the wetness channel is separable and carries the only large memory
delta (64-24). The reference's §9 order is the same ranking of payoff.

## What NOT to port

1. **The dual f16 buffer layout (§2).** 8 B/px premultiplied RGB + coverage plus
   a 4 B/px timestamp is the reference's canvas. Studio's canvas is 7 spectral
   absorbance coefficients + scattering in two RGBA16F textures, plus fixed,
   wet, relief and cover. The reservoir must mix **coefficients**, not RGB; the
   per-bristle state is 24 B (three half-float texels of 4) against the
   reference's 48 B struct. Any plan that assumes an RGB canvas will not fit.
2. **The GPU compute passes (§1, §8).** WebGL2 has no compute. The carrier is a
   `1 × 256` fragment pass (one invocation per bristle) ping-ponging an MRT
   target; the deposit is a fragment pass over the dab rect. Consequences: the
   timestamp channel becomes a double-buffered pair (+4 B/px), not an in-place
   read-modify-write; the substep quad's `inverseBilinear` is replaced by the
   engine's per-dab axis mapping; the "96 substeps per frame" loop has no
   direct equivalent — Studio's dabs are arc-length spaced (spacing 0.1–0.55 ×
   radius). The per-dab carrier is the analogue; whether a stroke needs
   sub-dabs is a 64-22 plan question.
3. **The deposit-time RGB smear (§3.3).** It mixes a straight RGB colour the
   spectral field does not store. A coefficient-space equivalent is a new law,
   not a port.
4. **Smudge mode, wipe and resample.** Out of scope; the reference reuses the
   same machine with `isSmudge` gates and a separate wipe shader.
5. **The reference's pressure envelope (§5.2).** Studio already has a
   speed/pressure law and a pen-pressure path; replacing them would move every
   existing stroke. Feed the engine's `pr` into the carrier/deposit instead.
6. **The 1/255 dither (§5.6).** Studio's display writes its own sRGB path; a
   dither is a separate display decision, not part of the deposit.

## Limitations

- **Live strokes on a committed frame.** The Studio paints a new live stroke on
  a clean sheet and merges it over the committed WebP at publish
  (`AquarelleCachedBaseLayer`, `useRotoFramePersistenceCoordinator`). A reservoir
  that samples the canvas therefore cannot pick up the committed raster during
  that live stroke; only a script re-bake (which replays from blank) sees the
  full underlayer. This is invisible in the probe (which always replays) and is
  an app-architecture decision for 64-22: hydrate the base into the engine
  (cost: the base's 12 B/px decoded sheet, plus the decode) or accept
  paint-only pickup for live strokes.
- **The paper seed** is not recorded today; the probe pins it. Determinism leg 1
  is only as good as that pin. This is a pre-existing gap, proven by
  `det-paper-baseline`.
- **Resize loses the last-touch field in the workbench.** `captureWhole` /
  `uploadWhole` carry ink, fixed, wet, relief and cover only; a sheet resize
  resets the wetness memory. A real plan must add the channel to `WholeDoc` and
  to every layer list (the precedent is `relief` and `cover` in 64-14).
- **The workbench's visual fidelity is a feasibility port, not the acceptance
  law.** It reproduces the reference's carrier, gather, body, threshold and edge
  terms, but its deposit is additive absorbance (Studio's law) and it does not
  implement §3.3's smear; the crossing region reads darker than the stroke's own
  body (89.9 vs 113.3 luma in `smoke-bristle`), which is the pickup signature,
  not a finished look.
- **SwiftShader.** All timings are software-rasterised (headless Chrome,
  `--enable-unsafe-swiftshader`), the same environment the committed gates use.
  Absolute numbers will differ on a GPU; the *deltas* and the memory model are
  the decision inputs, and the memory model matched the GL counter to 0.1 MB at
  both sizes.
- **One page = two engines for determinism.** That is deliberate; it also
  exposed a harness hazard (memory pressure at 2K), which is why cost gates run
  one engine per page.
- The `combed` factor (§3.2) is smudge-only and is held at 1; `landing` is held
  at the reference default 1 in the workbench.

## Investigation trail

1. Read the notes and the shipped shader; resolved the `spacing` ambiguity
   (`app.js:1208`: normalised `2/count`).
2. Read the Studio seam: `stamp()`/`brushInk`/`coverageDeposit`, the coverage
   channel from spikes 001/64-13/64-14, the adapter's per-stroke
   `setRandom(traceSeed)`, and the replay model (fresh adapter + full replay;
   live = clean sheet + merge over the cached base).
3. Built the workbench (copy, not a patch of the main tree): deterministic
   bristle set, carrier, gather, coverage, last-touch, pool-0 history.
4. Iterated on the harness: missing `in vUv` in the fragment header; `FLOAT_R`
   not declared in the engine's format table; baseline import depth.
5. First smoke (256² cross): identical replays. Added region metrics; the
   crossing reads darker than the red stroke's own body — pickup works.
6. Added `--runs 1` after observing a two-engine page's memory pressure at 2K
   (the second run degraded ~35 %); re-ran the whole cost matrix one engine per
   page. Numbers then repeated to 1–2 ms.
7. Added the seed controls: `--salt` (unrecorded RNG offset) and `--paper-b`
   (unpinned paper seed). The first changes reservoirs + image; the second
   changes the image but not the reservoirs, and reproduces on the *baseline*
   engine — the paper seed is the pre-existing record gap.
8. Cross-checked the baseline against the committed gate: watercolor-50 at
   1080² produced `7f56e401` / `432f3a3f`, exactly `64-14-SUMMARY.md` line 198.

## Reproduce / artifacts

- `workbench/src` — the throwaway engine copy (patched).
- `probe/probe.ts`, `probe/run.mjs`, `probe/index.html` — the gate driver.
- `results/*.json` — every capture quoted above (digests, durations, region
  means, GPU bytes, reservoir digests).
- No production file was modified. The only change outside this directory is
  the spike index row in `.planning/spikes/MANIFEST.md`.
