# Acrylic Bristle Deposit (per-bristle carrier + 5-nearest gather)

Ports the reference brush's per-bristle reservoir and 5-nearest deposit into the
real `efx-watercolor` engine, behind a deterministic replay contract. Origin:
spike 002. **This reference assumes the coverage composite is already in
place** — the spike workbench was built on top of spike 001.

Contract documents the formulas come from:
- `SPECS/v2.2.0-medium-engine/better-acrylic.md` — the three acceptance asks.
- `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md` — §-numbered
  reverse engineering. **Every formula in the build must cite its §.**
- `/Users/lmarques/Dev/craft-brushes/site/assets/app.js` — the reference
  shaders, for ambiguities only.

## Requirements

From the `acrylic-bristle-deposit` idea (MANIFEST.md):

- Reuse the real engine through `createAquarelleEngineAdapter` and the
  `probe/medium-engine` harness idiom. **Never the dev server.**
- Every claimed formula quotes the notes' section number (§2, §3.1–§3.5,
  §4.1–§4.5, §5.1–§5.6, §6, §8, §9).
- State explicitly what is not portable: compute passes, dual f16 buffers,
  RGB smear, smudge/wipe/resample.
- Go/no-go **per leg with measurements, not prose**: (1) deterministic replay —
  same script twice ⇒ byte-identical, and if not, what state must enter the
  record; (2) cost at 1080² and 2K, citing the 64-14/64-15 numbers; (3) wetness
  — derivable from existing coverage, or a new channel with measured sheet
  memory + undo snapshot + frame-cache bytes.

## How to Build It

### 1. Seed order — the determinism contract

The bristle set is generated from **one** RNG (the stroke's `traceSeed`), in a
**fixed call order**. Changing the order changes every bristle, so it is part of
the record's meaning, not an implementation detail.

```ts
count = round(clamp(2·halfWidthPx / 1.1, 40, 256))     // §4.1, halfWidth in doc texels
```

Generate runs of `3 + floor(rng()·14)`, **one draw per field even when the run
is clipped**, then per bristle `across`, `edge`, `radiusScale`, `touchReach`,
`loadRate`, `initialLoad`, `seed`, `valueJitter`. Full table in the spike
README; the implementation is `sources/002-acrylic-bristle-deposit/src/bristles.ts`
(99 lines, 8-float stride).

**The paper seed must be pinned before this is meaningful.** The engine rolls
`paperSeed` from `Math.random()` in the constructor (`Engine.ts:574`) and
`setPaper()` never re-seeds it. The current engine *already* fails replay
equality without a pin (`det-paper-baseline`: `7d58f971` vs `c5594fba`) because
paper height gates the deposit's tooth threshold. Record it, or derive it from
the document/mutation id. `traceSeed` already exists and is derived from
`mutationId` (D-20) — no new record field is needed for the set itself.

### 2. Per-dab pipeline order

Insert the carrier **before** the deposit, inside the existing `stamp()` brush
case. Body/relief/wet draws keep their order:

```
eachDab →
  bristleTravel()        distance since previous dab, in brush widths + px
  carrierPass()          §3.1 — updates reservoirs from the canvas under this dab
  coverPass()            (unchanged) Body order
  bristleInk()           §3.2–§5 — the 5-nearest gather
  brushRelief() / wet    (unchanged)
```

The carrier must sample the canvas **before** the dab deposits, or it picks up
its own output. That ordering is the physics, not a convenience.

### 3. Targets

| Target | Format | Size | Notes |
|---|---|---|---|
| reservoirs | `RGBA16F` ×3, `1 × 256`, ping-pong | 24 B/bristle | carried absorbance 0–3; 4–6 + alpha; load/across/seed/jitter |
| shape | `RGBA16F`, `1 × 256` | static | radiusScale, touchReach, loadRate |
| last-touch | `FLOAT_R`, doc-sized, **pair** | 4 B/px × 2 | only if shipping §3.4 |

Upload the initial reservoir state into the **write** half and swap, so the
first carrier pass reads it.

The last-touch target needs a sentinel: a cleared `R32F` reads 0, which the
virtual clock would call "touched at t=0" — every texel wet at the start. Clear
to a one-week-old value.

### 4. The gather

One fragment pass over the dab rect. Five nearest bristles by `profile`, each
weighted by

```
ink = profile · min(load·1.5, 1) · touch · broken · landed · combed
carried = Σ ink·(rgb, alpha) / Σ ink
```

then mixed into the canvas in **coefficient space** — `mix(canvasCoeffs,
carriedCoeffs, deposit)` — never RGB. This is the structural consequence of
Studio's spectral model; see "What to Avoid".

The same gather runs a second time writing only coverage (`bristleCover`, blend
`ONE, ONE_MINUS_SRC_ALPHA` into `cover`). The deposit itself is additive
absorbance (Studio's law, blend `ONE, ONE`).

### 5. New history layer

If the last-touch channel ships, it joins **pool 0** as one `FLOAT_R` layer and
must be added to `allocateHistory` / `snapshotLayers` / `travel` / `docTargets`
**together** — the same rule as `relief` and `cover`. Grow all lists or the
atlas copies the wrong layer.

### 6. Studio touch points

1. `packages/efx-watercolor/src/playground/Engine.ts` — stroke start seeds the
   set; `stamp()` calls the carrier then the gather; the four layer lists; and
   `resetSheet` clearing the new state to its sentinel.
2. `playground/shaders.ts` — gather constants and the noise family. Keep
   `FOOTPRINT_MASK` as the single footprint law.
3. `playground/brushes.ts` — `bristle-flat` / `bristle-round` become geometric
   settings instead of (or in addition to) a procedural tip texture. Every other
   preset keeps its tip.
4. `playground/mediums.ts` — the acrylic record needs `pickup` / `refill` /
   `wetSeconds` (or canonical equivalents), or they ride existing params. A plan
   decision.
5. `adapter/engineAdapter.ts` + `payload/toStudioStroke.ts` — pin/record the
   paper seed. `traceSeed` already exists.
6. `app/src/components/physic-paint/roto/` — the replay/publish boundary: does a
   live stroke on a committed frame hydrate the base into the engine (needed for
   pickup on existing paint) or keep the clean-sheet + merge model? **This is an
   app-architecture decision, not an engine one.**
7. Probe gates: extend `probe/medium-engine` with a bristle scenario and the
   `watercolor-50` / 2K cost pair. `bakeMs` / `renderMs` are measured, never
   gated (64-17's contract).

## What to Avoid

- **Do not assume an RGB canvas.** The reference's reservoir is RGB; Studio's is
  7 absorbance coefficients + scattering in two `RGBA16F` textures. Mix
  coefficients. A plan written against an RGB canvas will not fit.
- **Do not port the compute passes.** WebGL2 has no compute (§1, §8). The
  carrier becomes a `1 × 256` fragment pass (one invocation per bristle) with an
  MRT ping-pong; the deposit becomes a fragment pass over the dab rect. Two
  consequences: the timestamp is a **double-buffered pair** (+4 B/px), not an
  in-place read-modify-write; and the reference's "96 substeps per frame" has no
  equivalent — Studio's dabs are already arc-length spaced.
- **Do not port the deposit-time RGB smear (§3.3).** It mixes a straight RGB
  colour the spectral field does not store. A coefficient-space equivalent is a
  new law requiring its own validation, not a port.
- **Do not replace Studio's pressure law (§5.2).** Studio has its own
  `processInput` speed → `simPressure` path and its own pen-pressure path.
  Replacing them moves every existing stroke. Feed the engine's `pr` into the
  carrier and deposit.
- **Do not run two engines in one page for cost gates.** At 2K, SwiftShader
  memory pressure degraded the second run ~35 % in an early gate. One engine per
  page — the committed `probe/medium-engine` methodology.
- **Do not read the workbench's image as the acceptance look.** Its deposit is
  additive absorbance without §3.3's smear; the crossing reads darker than the
  stroke's own body (89.9 vs 113.3 luma) — that is the *pickup signature*, not a
  finished appearance.
- **Do not assume `spacing` is in px².** In the reference deposit shader
  `spacing` is normalised (`2/count`), so `radius = shape.y · spacing ·
  halfWidth` is in **pixels** (`app.js:1208–1213`). Resolved explicitly because
  it is genuinely ambiguous in the notes.

## Constraints

Measured, headless SwiftShader, one engine per page. `bakeMs` = script + settle;
`renderMs` = exports + readbacks.

| Gate | Size | Bristles | bake | Δ bake | render Δ | GPU peak Δ |
|---|---|---|---|---|---|---|
| watercolor-50 | 1080² | 48 | 833 → 1072 ms | **+239 (+28.7 %)** | +6 ms | +26.2 MB |
| watercolor-50 | 2K | 91 | 951 → 1200 ms | **+249 (+26.2 %)** | +8 ms | +67.2 MB |
| acrylic-20 (`bristle-flat`) | 1080² | 190 | 383 → 521 ms | **+138 (+36 %)** | export noise | +26.2 MB |
| acrylic-20 (`bristle-flat`) | 2K | 256 (cap) | 551 → 832 ms | **+281 (+51 %)** | export noise | +67.2 MB |

- Committed reference point (64-14, watercolor-50 at 1080²): **bake 792 ms,
  render 79 ms**. The same harness baseline measures 833 ms (+5 %, same
  digests), so quote the harness delta (+239 ms), not the +35 % against the
  committed number.
- Cost scales with **dab area**, not bristle count: the count only sizes the
  `1 × 256` textures and the 5 loads per pixel.
- Wetness channel: `R32F` pair **9.33 MB** (1080²) / **33.55 MB** (2K); undo
  atlas pool-0 `FLOAT_R` **+16.8 MB** / **+33.6 MB**; total **+26.1 MB** /
  **+67.1 MB** (computed matched GL counter to 0.1 MB). Deposit-time draw
  **+103 ms** bake on the 20-stroke acrylic passage (514 → 617, +20 %). Frame
  cache **0 B** — the committed frame is a WebP raster and a new frame starts
  clean.
- **Coverage cannot substitute for last-touch.** Coverage is an opacity with no
  time dimension: two texels at 0.9 coverage can be one second or one hour old.
  `wet × cover` is a usable **proxy** and costs nothing, but it measures water
  amount, not age; re-wetting adds water instead of resetting a timer; a thin
  fresh stroke reads less wet than a thick older one. Ship the proxy only as a
  recorded decision.
- **A live stroke on a committed frame cannot pick up the committed raster.**
  Studio paints on a clean sheet and merges the base at publish, so a reservoir
  sampling the canvas sees nothing until a script re-bake. Invisible in the
  probe (which always replays); real in the app.
- Determinism holds at 256², 1080² and 2K when the paper seed is pinned —
  identical exports **and** reservoir digests (`364300cf` / `076aecee` /
  `146298c6`). An unrecorded RNG offset (the `salt` control) changes both, which
  is how we know the seed is load-bearing.
- **Resize loses the last-touch field** unless `captureWhole` / `uploadWhole`
  carry it. Precedent: `relief` and `cover` in 64-14.
- Proposed slicing, adjusted to the measurements: **64-21** record + reservoirs
  (no visual law change; identity gates stay byte-identical), **64-22** gather +
  mixing law (the cost-bearing core), **64-23** traces + directional edges (the
  heaviest fragment path, acceptance ask #2), **64-24** acrylic water + wetness
  (the only large memory delta). Determinism precedes everything; the reference's
  §9 ranks payoff the same way.

### Frontier: the combined stack at full Body (measured 2026-11-19)

`--body` on the same acrylic-20 passage (canonical 0..100 → `toEngineParams`),
one engine per page:

| Engine | 1080² Body 0 | 1080² Body 100 | 2K Body 0 | 2K Body 100 |
|---|---|---|---|---|
| bristle | 510 ms | **675.5 ms** | 819 ms | **1169 ms** |
| baseline | 365 ms | **551.5 ms** | 553 ms | **994 ms** |

- **They compose.** Order in `stamp()`: carrier → `coverPass` → bristle gather.
  Body 100 moves the same regions in both engines (cross-scene crossing luma
  30.4 → 107.0 baseline, 89.9 → 162.4 bristle); determinism holds at Body 100
  (identical images + reservoirs, bristle `0f36b320`/`c9f718b5`).
- Body is additive and deposit-law independent: **+165 ms** bristle vs **+186 ms**
  baseline at 1080²; **+350 ms** vs **+441 ms** at 2K. One extra fragment pass
  over the dab footprint, independent of the bristle loop.
- Combined vs shipping at the same Body: **+22.5 %** (1080²) / **+17.6 %** (2K);
  with last-touch **+38.5 %** / **+22.7 %**. vs the no-Medium build: **+85 % /
  +111 %** (**+109 % / +121 %** with wetness).
- **No new GPU targets** — GPU peak identical across Body pairs.
- Open design decision for 64-22: the cover pass was driven by the raw dab
  footprint while the deposit is bristle-broken; whether the cover mask should
  be bristle-modulated is unmeasured and belongs to that plan's acceptance.

## Origin

Synthesized from spike: **002-acrylic-bristle-deposit** (`VALIDATED`, three
conditional legs).
Source files: `sources/002-acrylic-bristle-deposit/` — `README.md` (the full
formula table with § numbers, the 64-21…64-24 slicing, the non-portable list),
`src/bristles.ts`, `src/bristleShaders.ts`,
`patches/Engine.diff` (against base `406d1ead1`, **on top of** spike 001's
coverage model), `probe/`, `results/`.
