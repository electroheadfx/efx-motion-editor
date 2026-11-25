---
spike: 006
idea: stroke-layer-transparency
name: composite-law
type: standard
validates: "Given a stroke layer (its own ink, cover and a lateral alpha field) and a base sheet, when the layer is merged once with band_out = A*band_L + (1-A)*band_S at amount 100 over paper and over an earlier same-visit stroke, then every station of the fade band prints, the core returns the layer's own pigment, every band stays between the two inputs, and a 50 % layer over white reads 50 % darkness through displayBasisGLSL — in the Gouache (Kubelka-Munk) branch as well as the legacy one"
verdict: VALIDATED ✓ (conditional — see the three corrections in the findings)
related: [001, 002]
tags: [webgl2, watercolor, kombe, kubelka-munk, transparency, composite, spectral, phase-64, v2.2.0]
---

# Spike 006: the stroke-layer composite law

## What This Validates

Whether the architecture in `SPECS/v2.2.0-medium-engine/DESIGN-stroke-layer-transparency.md`
can work at all: a per-stroke layer, merged into the sheet ONCE at stroke end, whose
result must land back in the sheet's **7 absorbance coefficients + one scattering
scalar** without the artist seeing a difference.

This is the killer question of the four the artist asked. If 7 coefficients cannot carry
the composite, the other three (committed base, parity, cost) are moot — the storage
format, not the architecture, would have to change.

**Scope: Q1 only.** Q2 (committed base), Q3 (cost), Q4 (parity) were deliberately not
run. See `SPECS/v2.2.0-medium-engine/SPIKE-stroke-layer-FINDINGS.md`.

## Research

No external library is involved: this is a question about the repo's own spectral law.
The law stack read, in order:

| Layer | Where | What it decides |
|---|---|---|
| `displayBasisGLSL()` | `playground/spectral.ts:152` | 16 display bands from 7 coefficients. **Two branches**: `exp(-k)` below `SCATTER_EPSILON`, Kubelka-Munk above it. |
| `BASIS`, `DISPLAY_BANDS`, `DISPLAY_RGB_WEIGHTS` | `playground/spectralData.ts` | 7×38 basis, the 16 sampled bands, the (partly negative) RGB weights |
| `scatteringDeposit` | `playground/scattering.ts` | `Body` → the broadband `S` the deposit transports |
| the one deposit lerp | `Engine.bristleInk` | `ink ← ink·(1−a) + carried·a`, `S` and `cover` by the same weight |

**The design's assumption vs what ships.** §3.3 defines the composite per absorbance
band: `t = exp(-k)`, `t_out = A·t_L + (1−A)·t_S`, `k_out = -ln(t_out)`. That is the
**legacy** branch only. Every Gouache stroke the artist paints has `S > SCATTER_EPSILON`
— measured on a real Body-100 stroke at `S ≈ 0.022` — so the display applies the
Kubelka-Munk band law, which has no `exp(-k)` form and no exact 7-coefficient inverse.

Competing approaches compared:

| # | Composite law | Encoder into 7 coeffs + S |
|---|---|---|
| A | **L-band**: `band_out,i = A·band_L,i + (1−A)·band_S,i` (the area mix of the displayed band values) | 7×16 pseudo-inverse of `-ln(band)` |
| B | **L-band**, same target | bounded Levenberg–Marquardt fit on (7 coeffs + S) against the 16 display bands |
| C | **L-exp**: DESIGN §3.3 literally — mix band *transmittances*, `k_out = -ln(t_out)` | 7×16 pseudo-inverse |

`L-band` is the physically correct one: a partially-covered texel is a fraction `A` of
area carrying the stroke and `(1−A)` showing the base, and because the display's RGB
weights are linear, the band mix is exactly a linear-light RGB mix. It reduces to
`L-exp` when the medium scatters nothing.

## How to Run

```bash
node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs \
  --size 540 [--start 0.30] [--amount 100] [--stride 2] [--seed 0xc0ffee]
```

Bundles `probe.ts` with esbuild, runs it in headless Chrome (real WebGL2, SwiftShader
acceptable), writes `results/<gate>.json` and prints a summary. No dev server, no
vitest. ~8 s per run at 540².

## What to Expect

```
  mirror gate   : max 1.00/255, p99 1.00/255 over 291600 states (scatter share 55 %) — PASS
  end-to-end    : real displayFS vs the mirror on a real composite sheet — max 1.00/255
  ...
  paper       L-band  fit    50      0/0    1/1    1/1    1/1    0/0
  stroke      L-band  fit    50      0/0    1/1    1/1    1/1    0/0
```

## Method, and why it is evidence

1. **Three captures from the real engine, one sheet.** Stroke B alone on blank paper
   (`S_B` — the layer's content), stroke A alone (`S_A` — the base), then B over A in the
   same visit (`S_AB` — the shipped result). All via `captureSheet()`; the engine is
   unmodified.
2. **The mirror gate.** `law.ts` mirrors `displayBasisGLSL()` line for line over the same
   exported constants. It is *not* taken on trust: 291,600 random states (55 % in the KM
   branch) are uploaded into the real engine, exported through the real `displayFS`, and
   the mirror must reproduce them. **Max 1/255.** After this gate the mirror *is* the
   display law, which is what makes the exhaustive sweeps affordable.
3. **End-to-end.** A real composite sheet is also rendered through the real shader and
   compared to the mirror over 6,954 texels: **max 1/255**.
4. **Alpha is the independent variable.** The composite is `A·layer + (1−A)·base`; the
   lateral field only *chooses* A. So the probe sweeps the stations `t = 0, ¼, ½, ¾, 1`
   with `A = 1 − amount·t^e` and reads the error at each one — "every station of the fade
   band" without entangling the law in stroke geometry.
5. **Declared before measuring:** `≤ 2/255` per channel, hue in the same bracket
   (chroma-qualified), and the mirror gate at `≤ 1/255`.

## Results

At 540², `START = 0.30`, `amount = 100`, Body 100, Gouache (`bristle-round`), Feather 0.
6,954 layer texels over paper, 1,681 over stroke A. All numbers are 8-bit channel steps.

### The law's own check — 50 % layer over white

The check must be made in **linear light**: the display's `rgb` is linear, but the
artist-facing "darkness" (`alpha = 1 − min(rgb)` after `toSRGB`) is companded and does
**not** halve under a 50 % linear mix. A linear 50 % mix of a core reading `[183,63,44]`
over white gives `[0.737, 0.525, 0.513]` linear, whose sRGB darkness is 0.255 — not the
0.413 that "half of the layer's sRGB darkness" would suggest.

| Law | target linear | vs `0.5·layer + 0.5` | encoder round-trip |
|---|---|---|---|
| **L-band** | `[0.7370, 0.5246, 0.5128]` | **err 0.08/255** ✓ | pinv 0/255, fit 1/255 (28 it) |
| **L-exp** (§3.3 literal) | `[0.8502, 0.6077, 0.5783]` | **err 28.95/255** ✗ | pinv 0/255, fit 0/255 |

`L-exp` is exact for a non-scattering medium and wrong by 29/255 on the one the artist
paints with. Its *encoder* is fine — it faithfully reproduces a target that is itself
wrong, which is why this check is essential and a round-trip error alone proves nothing.

### The fade band — error at every station (max / mean, gate = none)

| scene | law | encoder | t=0 | t=0.25 | t=0.5 | t=0.75 | t=1 |
|---|---|---|---|---|---|---|---|
| paper | L-band | **fit** | 0 / 0.00 | 1 / 0.27 | 1 / 0.22 | 1 / 0.23 | 0 / 0.00 |
| stroke | L-band | **fit** | 0 / 0.00 | 1 / 0.37 | 1 / 0.49 | 1 / 0.39 | 0 / 0.00 |
| paper | L-band | pinv | **5** / 3.41 | 1 / 0.69 | 1 / 0.20 | 1 / 0.28 | 0 / 0.00 |
| stroke | L-band | pinv | **5** / 3.17 | 3 / 1.99 | 3 / 1.85 | 3 / 1.89 | **5** / 3.45 |
| paper | L-exp | pinv | 2 / 1.18 | 1 / 0.47 | 1 / 0.12 | 1 / 0.09 | 0 / 0.00 |
| stroke | L-exp | pinv | 2 / 1.12 | 2 / 0.78 | 1 / 0.77 | 1 / 0.84 | 2 / 1.23 |

Same picture at `amount 50` and at every falloff (0 / 50 / 100):
**L-band + fit is 0–1/255 everywhere; L-band + pinv misses the core by 5/255.**

### Between-law: how often the encoded band leaves `[min(layer, base), max(...)]` by >1/255

| scene | law / encoder / gate | share |
|---|---|---|
| paper | any L-band | **0.00 %** |
| stroke | L-band / **fit** / none | **0.003 %** (1 of 38,400) |
| stroke | L-band / pinv / none | 3.95 % (15,919 of 403,440) |
| stroke | L-band / pinv / alpha gate | 1.69 % |
| stroke | **L-exp** / pinv / any gate | **60–64 %** |

Over paper the convex mix is trivially between, and white is a fixed point. Over a
painted base it is not: the naive projection leaves the interval on ~4 % of band
comparisons, and the design's `L-exp` law on ~60 % — it is *not* a proportional mix for
a scattering medium.

### The alpha gate — the second law defect

DESIGN §3.3 uses bare `A` in the transmittance mix while gating only the cover channel.
Where the layer holds no visible paint (a bristle gap), `band_L = 1`, so bare `A` gives
`A + (1−A)·band_S` — it washes the base by `A` for nothing. Measured on the under-stroke
at the band midpoint (Δ from the untouched base, max / mean):

| gate | over paper | over stroke |
|---|---|---|
| `A` alone (design §3.3) | 3.0 / 1.3 | **157.0 / 118.4** |
| `A · cover_L` | 0.0 / 0.0 | 10.0 / 4.4 |
| `A · layerAlpha` (`1 − min(rgb)`) | 0.0 / 0.0 | 13.0 / 5.5 |

Bare `A` reproduces the pale-band failure of the six rejected laws exactly. The gate is
mandatory; `cover_L` and the display's own alpha perform about equally. Cost of gating:
print retention at the band edges drops 99.3 % → 95–96 % over paper (the faintest texels
fall below the print threshold as alpha shrinks) — not a hole, a deeper fade.

### Continuity and the core

- **Print retention** (texels the layer prints that the composite still prints), over
  paper by station: 100 % / 99.4 % / 98.7 % / 96.2 % / 0 % for L-band+fit. The 0 % at
  `t=1` is `A = 0`: the composite IS the base there. No hole is ever introduced.
- **Core** (`t = 0`, `A = 1`): L-band+fit reproduces the layer's own state **exactly**
  (0/255, both scenes, all falloffs). L-band+pinv misses by **5/255** — the naive
  projection cannot invert the Kubelka-Munk branch.
- **Hue** (target chroma ≥ 25/255): L-band+fit 0.0° at the core, 1.1–2.0° through the
  band, 2.7° at the faintest station — which corresponds to a ~1.2/255 channel move. The
  bracket is met in channel terms and marginally exceeded in degrees at low chroma.
- **Falloff ordering**: the station alphas are monotone and distinct per falloff —
  at `t = 0.5`, `A = 0.293 / 0.500 / 0.750` for falloff 0 / 50 / 100.

### Fit cost

Mean LM iterations per texel: 4–30 (typically 5–25), 9 forward evaluations per iteration.
One merge pass per stroke, so the per-stroke cost is `touched texels × ~25 × 9 × 16` band
evaluations — the subject of Q3, not measured here.

### Environment / determinism

- Determinism: two runs of the same gate are byte-identical (bakeMs aside).
- **Negative control (paper seed):** varying `--seed` changes nothing. The adapter pins
  the engine RNG (`setRandom(seededRandom(1))`), so the paper is deterministic by
  construction and the seed is not load-bearing here. Recorded rather than removed.
- **The layer stand-in's blind spot.** Stroke B is painted on a *blank* sheet, so it
  cannot pick up stroke A. Where it should read `[167,73,61]` (B over A, the shipped
  same-visit result at the core), the stand-in reads `[193,66,47]` — **26/255**. That is
  what the stand-in omits, not what the design loses: §7.6 keeps pickup sheet-side, so a
  real layer would still lift A. What the design genuinely loses is the layer's own
  wetness feeding `wetAt` (self-pickup), which this probe cannot measure.

## Verdict

**GO for Q1 — conditional.** The composite lands in 7 coefficients + S to **≤1/255 per
channel at every station, over paper and over a same-visit stroke, with the core exact
and the between-law intact** — but only with three corrections to the design:

1. The composite law is the **area mix of the display band values**, not §3.3's
   transmittance/exp round-trip (`L-exp` fails the design's own 50 % test by 29/255 and
   is not a proportional mix for 60 % of bands on Gouache).
2. The merge must be a **bounded per-texel Kubelka-Munk fit**, not the 7×16
   pseudo-inverse (pinv misses the core by 5/255 and breaks the between-law on ~4 %).
3. The alpha must be **gated** by the layer's own coverage: `A_eff = A · cover_L`. Bare
   `A` washes the under-stroke by up to 157/255 — the pale band, again.

## Investigation Trail

1. First scene build read `cover = 0` everywhere and `centreX = 0`. Cause: `readHalf`
   with `channels = 1` packs **one lane per texel**, and `decodeSheet` indexed it as
   RGBA (`×4`). Fixed → the cover channel reads as designed.
2. The nominal stroke coordinates do not survive the adapter's drive (stroke A lands
   `x 0…177` on a 256 sheet, not `25…230`). All geometry is now read off the captured
   ink, never off the authored points.
3. The first "50 % darkness" check failed by 40/255. Cause: it compared **sRGB**
   darkness, which is companded. In linear light the band mix is exact (0.08/255). The
   design's acceptance sentence needs restating in linear light — recorded as a finding.
4. `cover` measured binary (0 → 1 at the ink's edge), which is what the engine documents
   ("the gather deposits near-binary coverage"). It is a *membership* weight, not an
   opacity ramp — which is why the lateral fade must come from `A`, with `cover` only
   gating it.
5. The fit initially missed the `t=1` station by 8/255 over the stroke: seeded from the
   layer, it could not walk to the base. Seeding from the dominant input (`alpha ≥ 0.5 ?
   layer : base`) closes it to 0/255.

## Limitations

- **Q1 only.** The committed-base path, cost, parity and amount-0 byte identity were not
  measured (deliberately — see the findings' costing gate).
- The lateral field is **analytic** (`u = |x − centre| / halfWidth` on a straight
  vertical stroke). The MIN-of-`|across|` field the implementation needs is not
  prototyped; it only differs on a non-straight stroke, and this probe never paints one.
- The composite is measured on the **band law**, with `readback(flat)` so granulation,
  the edge crispener and the display film-blur are out of the comparison. The relief
  (emboss) is not composited.
- The merged state is written into the mobile pool only; the two-pool split matters to a
  later wet transport, which this probe never runs on an encoded sheet.
- `q1 only` means the "is it worth shipping" question is still open: if the merge pass at
  2K/4K is unaffordable, the law being right does not help.
