# Edge transparency and falloff — the shipped stroke layer

Reference for `Skill("efx-studio-paint")`. Implemented by quick `261125-kvl`
(SPIKE 006), artist UAT approved 2026-11-26. The code is the authority; this
file names the law, the measured facts and the traps.

## 1. Scope

- Bristle responses only (Gouache, Pen). Watercolor never shows the rows and
  renders identically.
- Four rows in two bristle-only sections (quick 261127-jox split the legacy
  `edge` group): **Transparency** — `edgeFade` = **Edge transparency** (0..100,
  default 0) and `edgeFalloff` = **Edge falloff** (0..100, default 50);
  **Noise** — `featherNoise` = **Feather noise** (0..100, default 20) and
  `featherFalloff` = **Feather falloff** (0..100, default 50). Canonical values
  are 0..1 in the engine (`clamp01(value / 100)`). The legacy **Feather** row
  is HIDDEN in every context (`hidden: true`, Emboss precedent): its key stays
  live in both medium records (Gouache 85), `AQUARELLE_GLOBAL_KEYS`, the
  per-stroke bag and Reset — the noise slider owns that raggedness.
- Every stroke path inherits the law — pointer, scripted, bake replay — because
  the layer opens and commits inside the engine's stroke lifecycle.
- **Amount 0 is a structural bypass**, never a value: `Engine.layerStrokeActive`
  is false, no layer target is allocated, no merge draw runs, the shipped
  deposit path renders byte-identically (`layerAllocated false`,
  `mergeDraws 0`).

## 2. The law

### 2.1 The layer

While a stroke with `edgeFade > 0` is live, its dabs render into a transient
layer instead of the sheet:

- ink pair RGBA16F (the same two attachments a sheet's ink has), LINEAR;
- film target `[cover_L, lateral]`, R16F, NEAREST (the merge reads one texel
  per texel);
- relief R16F and a merge scratch R16F.

Inside the layer the one-lerp runs unchanged; there is no settled `fixed` pool
(the sheet's fixed attenuation draw is skipped) and the sheet's cover, relief
and last-touch are untouched by the stroke's paint. `bristleCoverLayerFS`
writes the layer's coverage and its lateral coordinate, with a MIN blend on the
second attachment:

    u = clamp(|across| / BRISTLE_LAYER_EDGE, 0, 1)     // MIN over covering dabs
    BRISTLE_LAYER_EDGE = 0.9                            // u = 1 at the VISUAL edge

`u` is the smallest `|across|` among the dabs that covered the texel: 0 on the
stroke's centre line, 1 at the visual edge. The layer's cover smear is
suppressed (Law 2): its cover is the stroke's own film, never a pull toward the
under; colour pickup rides the layer's ink. The sheet path keeps the shipped
smear arm verbatim.

### 2.2 The lateral alpha

ONE snippet, `LATERAL_WEIGHT`, shared verbatim by the merge and the live
display (`STROKE_LAYER_ALPHA`):

    e    = 2^(2·falloff − 1)                           // [0.5, 2]; twin edgeFalloffExponent
    A    = 1 − amount · u^e                            // 1 = opaque
    aEff = A · cover_L

Anchors: falloff 0 → e = 0.5 (broad: the fade reaches mid-width), 50 → e = 1
(shipped linear), 100 → e = 2 (rim: solid middle, fade only at the silhouette).
The weight falls monotonically from 1 on the centre line to `1 − amount` at the
visual edge; the outer silhouette never moves. The retired 0.30 interior
plateau read as a solid core — the shipped law spans the whole lateral
coordinate with no plateau.

### 2.3 The commit (stroke end, once)

Three passes over the stroke's rect, then a copy-back over the same rect
(never a swap — outside it the read/write halves must agree):

    film_out   = mix(film_sheet, film_layer, aEff)     // component-wise: absorbs 0..6, S
    ink        = film_out − fixed                      // storage form
    cover_out  = 1 − (1 − cover_S) · (1 − aEff)        // the union
    relief_out = relief_S + aEff · relief_L

Two exact endpoints skip the mix: `aEff ≥ 1 − 1e−4` writes the layer's raw
storage, `aEff ≤ 1e−4` copies the sheet's raw ink through (every texel of the
rect is written).

The commit is a COEFFICIENT-SPACE lerp. The retired design mixed reconstructed
Kubelka-Munk reflectance bands and refit the sheet with a bounded
Levenberg–Marquardt solve; averaging nonlinear bands produced the pale lavender
fringe, no pickup, smoothed feather noise and rectangular patches. No band or
display-space mix may re-enter.

## 3. Live surface and parity

While a layer is open and the render target is null, `Engine.drawDisplay`
binds `displayLayerFS`: it evaluates the SAME coefficient mix pointwise and
reconstructs once, so the live view and the committed sheet agree up to the
store/display round-trip. `displayFS` is emitted byte-identically from
`displaySource(false)` and is the only compositor every export sees; exports
never sample the layer. The layer texts are injected as empty strings into the
shipped variant, so the two cannot drift structurally.

## 4. Lifecycle, undo, memory

- Targets are LAZY: allocated on the first Edge-active stroke, kept for the
  engine's life, cleared at open (film to cover 0, lateral 1 — a zero lateral
  field would read every texel as core), committed at stroke end BEFORE
  `this.stroke = null`, and discarded on every abandon path (`clear`,
  `resetSheet`, `abortStroke`, `travel`, `restore`, `resizeDocument`).
  Document recreates forget the layer fields before freeing targets;
  `discardLayer` is idempotent.
- The merge runs inside the stroke's own undo transaction, so undo/redo treat
  the stroke as one edit.
- Capture and cache snapshot the merged sheet; the bake inherits the commit
  because the merge is inside the stroke lifecycle. Nothing outside the engine
  knows the layer exists.
- Memory: 40 B/px measured (two RGBA16F ink halves 32, film 4, two R16F reliefs
  4) ≈ 160 MiB at 2048². The layer is transient.
- Cost: one merge at stroke end; the live display pays a few extra taps per
  frame. The probe measures the layer's memory from live target counts × dims ×
  declared strides (WebGL2 has no texture-format query).

## 5. Traps

- No interior plateau (`uEdgeStart` 0.30 or similar): the artist rejected the
  solid core.
- No band/reflectance-space commit and no spatial re-encode: the commit is
  pointwise in coefficient space, which is also why the layer's own feather
  noise and grain survive verbatim.
- Do not smear the layer's cover toward the under (Law 2); that let the under
  show through the stroke's core.
- Do not anchor the lateral field at 0.66 (`BRISTLE_FEATHER_EDGE`): it
  saturates inside the deposit. 0.9 is the measured visual edge.
- The film target is NEAREST; the ink pair is LINEAR.
- The merge writes into the WRITE halves and blits back — a swap leaves the
  read half stale outside the rect.
- Amount 0 must never allocate a target or draw a merge; the identity is
  measured by counters, not only by pixels.
- Watercolor and non-bristle tools never open a layer.

## 6. Params and rows

- `params.ts`: `edgeFade` / `edgeFalloff` on `AquarelleCanonicalParams`
  (0..100, defaults 0 / 50); `Engine.Params` 0..1 (defaults 0 / 0.5);
  `toEngineParams` divides by 100.
- `mediums.ts`: `MediumParamKey` includes all four; every record carries the
  canonical defaults (0 / 50 / 20 / 50). The key pin is `mediums.test.ts` — the
  list is currently EIGHTEEN keys.
- `aquarelleRecordState.ts`: all four are in `AQUARELLE_GLOBAL_KEYS` with the
  same defaults, so the per-stroke bag records them; the hidden legacy
  `feather` key stays there too.
- `aquarelleParamVisibility.ts`: `edgeFade`/`edgeFalloff` in the
  `transparency` group and `featherNoise`/`featherFalloff` in the `noise`
  group, `BRISTLE_MEDIA` only; the legacy `feather` row stays in the table with
  `hidden: true` so its key and Reset membership survive while no context
  renders it. All rows render through the existing `GlobalSlider`.
- No payload/codec change: `engine.params` is a loose numeric record.

## 7. Verification

- `probe/medium-engine --gate edge-layer-neutral` + `compare.mjs
  --edge-structural` against `baselines/edge-layer-neutral.json`: amount-0
  digests identical, `layerAllocated false`, `mergeDraws 0`.
- `--falloff-sweep`: midpoint alpha strictly orders broad < linear < rim on
  both sides; `cover_L` is falloff-independent; core and continuity rows hold.
- Feather-noise sweep: `probe/medium-engine` `featherNoise.mjs` — five slider
  states (0 / 20 / 40 / 60 / 100) × Feather 85 / 0, six bars; slider 20 +
  falloff 50 digests byte-identical to the pre-change baseline, slider 0
  differs by design, driven states never exceed the base footprint, the clean
  state never falls below it, the core erodes with a surviving spine,
  footprint ≥ 80 % of base, Feather 0 inert. Approved anchors and digests:
  the quick 261126-v8j SUMMARY.
- Live UAT rows: Edge transparency 100 at falloff 0 / 50 / 100 over paper and
  over a committed base (the under must show in its own colour, no pale band,
  no milky halo); undo/redo one edit; leave/reopen + forced re-render parity.
- The standard gates: package vitest (never watch), app vitest, app tsc,
  package build.

## 8. Extending — the Noise pair and new edge-family rows

The Noise pair (Spec 11, UAT approved 2026-11-27) ships the re-indexed
threshold law described in `SKILL.md` §Transparency and Noise: slider 0 clean,
20 the shipped base (neutral program), 20+ the three-scale (20/60/200 px)
breakup, footprint floored at the base silhouette; ONE shared exponent map
(`edgeFalloffExponent`), falloff 50 = shipped. Feather lives in the gather
THRESHOLD (never a depth fade); Edge transparency lives in the lateral alpha.
They compose because the merge is pointwise. A new edge-family row means:
`params.ts` canonical + `Engine.Params` + both medium records +
`AQUARELLE_GLOBAL_KEYS` + one visibility row in the `transparency` or `noise`
group + the package and app tests. Do NOT resurrect the legacy Feather row —
it stays hidden; the noise slider owns the raggedness.
