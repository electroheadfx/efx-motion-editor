---
name: efx-studio-paint
description: Studio paint engine (Physic Paint / watercolor + acrylic bristle media). The shipped compositing laws — pigment replacement with coverage, the Body cliff, the per-stroke stroke layer behind ONE global Opacity (stored `edgeFade`, shown inverted 100 = opaque; the lateral Edge-transparency/falloff law is retired), the coefficient-space merge and live/committed parity, the feather-noise threshold law (0 clean / 20 base / 40–100 three-scale breakup; the neutral/extended shader permutation) and the Noise panel pair (the legacy Feather row is hidden), the diffuse emboss with its view-fixed Blinn sheen and the paper-matched light default (130/38/1, whole degrees), live-over-committed parity, KEY = CACHE (a key opens on its committed image and strokes are never replayed), the sheet cache and re-render adoption, the capture merge, per-stroke seeds, first-paint pickup parity, cache cost — plus the seams, files, verification gates and debugging discipline for any change to what the artist sees. Load before touching the aquarelle engine, its Studio layers, the key/sheet path, the capture merge, brush/mutation recording, or any medium record.
---

<context>
## What this covers

The Studio's paint surface is ONE engine (`@efxlab/efx-watercolor`, vendored
playground engine) used by every medium: watercolor washes and the acrylic
bristle brush are parameterisations of the same deposit. The app never paints
with a second engine and never composites paint outside the engine's own laws.

Two documents own the shipped behaviour:

- this skill — the application-level laws, seams and gates;
- `Skill("spike-findings-efx-motion-editor")` — the measured spike laws
  (`references/coverage-composite.md`, `references/bristle-deposit.md`) and the
  headless-Chrome measurement harness.

If a change touches "what the paint looks like", it is governed by this skill.
</context>

<the-one-law>
## The one law: a dab REPLACES pigment

`Engine.coverageDeposit` (non-bristle) and `Engine.bristleInk` (bristle/acrylic)
both composite each dab source-over INSIDE the pigment layers:

    ink   <- ink   * (1 - a) + C * a     (attenuate the settled/mobile underlayer, add the carried pigment)
    fixed <- fixed * (1 - a)             (the SAME weight on the settled pool)
    cover <- cover * (1 - a) + T * a     (T = Body's film opacity x the carried alpha)

Consequences, and they are not negotiable:

- Paint over dried paint is a REPLACEMENT weighted by the dab's coverage `a`,
  never a product of two films. Multiplying two sheets' transmittances reads
  dark and is wrong; lerping them by their own darkness alpha reads opaque and
  is wrong.
- Across a stroke the committed base survives by exactly `1 - cover`
  (the cover channel is the union of every dab's `a`).
- The display transmittance is `ink + fixed`; the display's pigment alpha is
  `1 - min(t)` (darkness only). The retired `max(darkness, cover)` alpha term
  must not come back.
- The re-bake (`aquarelleBake`, `applyAquarelleEvents`) replays the whole
  stroke script through this same law. THE REPLAY IS THE ARBITER of the look:
  first paint must render what a re-render renders.
- **Body is ORDER, and any Body above 0 moves the WHOLE deposit into this
  composite** (non-bristle): its film weight is `bodyCurve(Body) * COVER_GAIN`
  on the `body ^ 6` curve, so a low Body deposits almost nothing — Body 25 is
  a 0.05 % film and paints BLANK (the 2026-11-21 chalk regression; probe
  `probe/chalk-deposit`). A medium record either states Body 0 (additive
  deposit: watercolor, Chalk/pastel, graphite) or a visible cover (gouache 55,
  acrylic 100). Never ship a Body on the invisible cliff, pinned in
  `mediums.test.ts`.
</the-one-law>

<edge-law>
## Global Opacity and Noise (bristle only, shipped 2026-11-27)

Bristle responses — **Gouache Round** and **Pen 1B** (one shared physics
record and the same bristle tip; only the landing bag differs) — gain two
panel sections. **Paint & reservoir**: Pigment, Pickup, **Opacity**
(`edgeFade`, 0..100, default 100). **Noise**: **Feather noise**
(`featherNoise`, 0..100, default 20) and **Feather falloff** (`featherFalloff`,
0..100, default 50). The legacy **Feather** amplitude row is HIDDEN in every
context (`hidden: true`, Emboss precedent): its key stays in
`AQUARELLE_GLOBAL_KEYS`, both medium records (Gouache 85) and the per-stroke
bag, and the engine still reads it, but the panel exposes no standalone row —
the feather-noise re-index owns that raggedness. Watercolor never sees these
rows and renders identically.

**Opacity is the display face of the stored transparency.** The key is
`edgeFade` (0 = opaque, 100 = fully transparent); the row renders and edits
OPACITY (`invert: true`) — 100 = opaque (the default), 0 = fully transparent —
and the panel maps back on change, so the stored keys, the medium records and
the engine keep the transparency semantics. The retired **Transparency**
section and **Edge falloff** row are GONE (`edgeFalloff` survives only as a
record key in both medium records, `AQUARELLE_GLOBAL_KEYS`, the per-stroke bag
and Reset; the global law reads no shape bias). The lateral fade read as a
zebra band wherever a stroke's edge crossed a contrasting under — that is why
it died.

**Stored `edgeFade` 0 (Opacity 100) is a branch, never a value.** A stroke with
`edgeFade === 0` (or a non-bristle tool) never allocates a layer and never draws
a merge — the shipped deposit renders byte-identically (`layerAllocated false`,
`mergeDraws 0`). Keep the predicate in `Engine.layerStrokeActive()`.

**The stroke layer.** While a stroke with `edgeFade > 0` is live, its dabs
render into a transient LAYER instead of the sheet (lazy, 40 B/px: ink pair
RGBA16F, film [cover_L, lateral], relief, merge scratch). Inside the layer the
one-lerp runs unchanged and there is no settled `fixed` pool; the sheet's
cover, relief and last-touch are untouched by the stroke's paint. The layer
commits ONCE at stroke end, inside the stroke's undo transaction, before the
stroke is cleared. Every abandon path discards it; document recreates forget
it.

**The alpha law — ONE uniform film scale** (`LATERAL_WEIGHT` /
`STROKE_LAYER_ALPHA`):

    A     = 1 − amount          // amount = the stored edgeFade, 0..1
    aEff  = A · cover_L

Every texel of the stroke gets the same film factor: lowering Opacity glazes
the WHOLE mark uniformly — no rim opening, no interior plateau and no lateral
coordinate in the alpha. The cover pass still writes the lateral attachment
(`uLayerEdge`, `BRISTLE_LAYER_EDGE`, 0.9 of the footprint) but the shipped
alpha no longer reads it; do not build a new transparency law on that field
without a probe and an artist decision. The retired lateral law
(`A = 1 − amount·clamp(|across|/0.9, 0, 1)^e`) and its `edgeFalloff` shape
bias are not to return.

**The commit is a coefficient-space lerp, never a display-band mix.** Per
texel, over the stroke rect:

    film_out   = mix(film_sheet, film_layer, aEff)        // component-wise absorbs + S
    ink        = film_out − fixed                         // storage form
    cover_out  = 1 − (1 − cover_S) · (1 − aEff)           // the union
    relief_out = relief_S + aEff · relief_L

Two exact endpoints skip the mix (aEff ≈ 1 writes the layer raw, ≈ 0 copies the
sheet). Three passes write the sheet's WRITE halves and the rect is copied
back — never a swap. Averaging reconstructed Kubelka-Munk reflectance bands
(the retired band/Levenberg-Marquardt encoder) produced the pale lavender
fringe; no band or display-space mix may re-enter.

**Live = committed.** While a layer is open the live compositor binds
`displayLayerFS`: the SAME coefficient mix pointwise, then one display
reconstruction. Exports bind `displayFS` and never see the layer samplers, so
capture, cache and bake stay layer-blind. The merge is pointwise, so the
layer's own feather noise and grain survive verbatim.

**Layer cover ≠ sheet cover.** The layer's cover smear is suppressed: its cover
is the stroke's own film, not a pull toward the under; colour pickup rides the
layer's ink. The sheet path keeps the shipped smear arm.

**Feather noise — the shipped threshold law (UAT approved 2026-11-27).** The
slider is re-indexed around the shipped look: **0 = clean edge**, **20 = the
shipped base (default)**, 40 light, 60 medium, **100 full breakup**; linear
between anchors. In `bristles.ts`:

    featherEdgeClean(n) = smoothstep(0, 0.2, n)      // 0 at 0 -> clean; 1 from 20 up
    featherNoiseDrive(n) = clamp01((n - 0.2) / 0.8)  // 0 at 20; 1 at 100

At 0 the shipped raggedness is scaled away (`featherShift *= uFeatherEdgeClean`)
and the rim paper tooth is calmed (`rimClean`), so the mark follows the smooth
bristle silhouette. Above 20 the raggedness is fully restored and the breakup
runs. The breakup is a DEPTH-OF-PENETRATION threshold in the gather: paint
outside a wavy front is removed, everything inside stays solid, so the core is
continuous at every value and no detached islands enter the body:

    uN       = clamp(lateral / BRISTLE_LAYER_EDGE, 0, 1)   // the SAME lateral coordinate
    front    = mix(0.88, 0.35, drive) + cloudMix(css) * 0.30
    envelope = smoothstep(front - 0.04, front + 0.04, uN)
    featherShift += uFeather * LIFT * envelope            // paint outside the front removed
    featherShift += uFeather * LIFT * band * spray        // contained fringe specks
    featherShift -= uFeather * LIFT * envelope * 0.90 * spike
    featherShift -= uFeather * spike * reach              // sparse peaks cancel erosion
    featherShift = max(featherShift, shippedShift)       // never paint beyond the base mark

`cloudMix` is THREE fixed document scales — 20 / 60 / 200 px — of a four-octave
rotated value-noise fractal, mixed 0.40 / 0.33 / 0.27. The footprint floor lets
chips cancel the erosion but never paint beyond the base silhouette. Gate:
`uFeather > 0` (Feather 0 inert). NEVER a depth fade, a body hole-punch, a
single smooth erosion field (the rejected "noodle" shrink) or a uniform fine
chip field (the rejected "animal fur"); the 3-noise mix is the approved
character.

**Feather falloff** reuses the same shape language: ONE exponent map
(`edgeFalloffExponent`, `2^(2·b − 1)`, 0.5 = shipped, `pow` skipped at exactly
0.5). It shapes the rim opening only — never the noise drive and never the
global opacity alpha.

**The permutation is the identity mechanism.** `bristleGatherSource(extended)`
is the ONE generator: the NEUTRAL gather is the pre-change source; the EXTENDED
gather carries the law and its uniforms. `Engine.gatherProgram()` compiles the
extended programs LAZILY on the first draw where drive > 0, clean < 1, or
featherFalloff ≠ 0.5. At slider 20 + falloff 50 the neutral program runs, so
the default render is byte-identical to the pre-change baseline by
construction. Never make the law unconditional.

The two laws compose because the stroke-layer commit is pointwise. Detail and
measured facts: `references/edge-transparency.md`.
</edge-law>

<emboss-law>
## Emboss and its specular sheen (shipped 2026-11-28)

**Light state.** Per paint-layer document `LightSettings` in DEGREES
(`azimuth` 0..360 wrapped, `elevation` 0..90, `intensity` 0..4), render-only:
never in a stroke payload or a params snapshot. `Engine.drawDisplay` converts
once to radians and builds the Blinn half-vector. The ONE default is the
package's `DEFAULT_LIGHT = { azimuth: 130, elevation: 38, intensity: 1 }`
(2026-11-28, whole degrees) — the rounded reconstruction of the light
`paperLightFS` bakes into the paper, `normalize(-0.5, 0.6, 0.62)` (129.8° /
38.45°), so impasto shadows fall the same way as the sheet's grain. The Studio
never retypes the triple; an absent document light resolves to `DEFAULT_LIGHT`.

**Thickness = the emboss map.** A document R16F `relief` field, deposited
additively per dab by `reliefFS` (watercolor: the same tip mask, dry
re-threshold, jitter and paper-tooth gate as `stampFS`) or `bristleReliefFS`
(bristle: the gather's own coverage). Brush texture and paper tooth therefore
shape the relief; pigment granulation does not. The engine-side `emboss` param
is SIGNED (negative erodes through the Lift law); the acrylic-context UI row
offers 0..5 and watercolor never renders the row.

**Shading law (one source, `displaySource`).** One document texel of central
difference, fixed `RELIEF_BUMP = 1.0` (never zoom-scaled):

    litDelta  = uLightIntensity * (dot(n, L) - L.z) * uReliefBump * EMBOSS_GAIN (2.3)
    specDelta = uLightIntensity * uReliefBump * smoothstep(0.05, 0.35, c)
                * EMBOSS_SPEC_GAIN (1.0)
                * max(pow(max(dot(n, H), 0), 16) - pow(H.z, 16), 0)
    shade     = clamp(1.0 + (litDelta + specDelta) * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX (1.5))

`H = normalize(L + V)` with `V = (0,0,1)` is built ONCE per draw in
`Engine.drawDisplay` and uploaded as ONE `uniform vec3 uSpecHalf` — never
normalized per fragment. The sheen reuses the five relief taps already
sampled; it adds no fetch, sampler or texture unit. The fold happens BEFORE
the single clamp on the ONE `shade`: `displayFS` (exports, mode 0/1/2/3/4, the
amount-0 path), `displayLayerFS` (live stroke layer), the cached-base
round-trip and mode-4 alpha inherit it by construction. **Alpha is never
scaled by the light** — it derives from the unshaded `tMin`.

**Exact neutral identity.** Flat field (both pow operands are the same
evaluation), `uLightIntensity` 0, `uReliefBump` 0, `uFlat` 1 (region pick),
or zero thickness (the block is guarded by `if (c > 0.0)`) all leave the
render identical. The zero subtraction is deliberately AFTER the exponent —
a literal `max(dot(n,H) - H.z, 0)` under a 16th power is ~1e-12 and would
never render — and `pow(H.z, g)` is never precomputed on the CPU (ulp drift
would break the exact flat-field zero).

**What the sheen can be.** A pigment/transmittance LIFT (a sheen): the
multiply compositor cannot exceed the fond, so a true additive white glint is
out of scope. The highlight is brightest on thick crests (`smoothstep(0.05,
0.35, c)` keeps thin films clean of 1-texel speckle). Per-medium gloss
(watercolor matte vs acrylic gloss) is DEFERRED — the engine has no medium
identity. `EMBOSS_SPEC_*` are calibration start values the artist's live UAT
may retune; light intensity scales the diffuse AND the sheen together, so
reduce the sheen alone only through the spec constants. UAT approved live
2026-11-28 ("excellent résultat").
</emboss-law>

<parity-rules>
## Live / committed parity (shipped 2026-11-21)

1. **Per-stroke seed.** The Studio reserves the stroke's mutation id at
   pointerdown (`onStrokeWillStart`) and seeds the engine with
   `strokeRandomForMutationId(id)` before the first dab; stroke end accepts
   that reserved id (`allocateStrokeMutation(..., reservedMutationId)`). Live
   and every re-bake then share one random stream.
2. **KEY = CACHE: a key opens on its cache and strokes are NEVER replayed**
   (artist decision 2026-11-22, supersedes the live-seed replay). The
   displayed base is the key's committed cached image; the live sheet starts
   blank. A key revisited in the SAME session uploads the exact sheet it was
   left with (`Engine.captureSheet()` / `restoreSheet()`, validated by the
   frame's script signature) — an upload, never a replay. `seedAquarelleEngine`
   stays in the package for probe/parity work; the Studio layer never calls
   it. Do not reintroduce a stroke replay under any name.
3. **The underlay is the base, never stacked.** `syncUnderlay` binds `null`
   while `aquarelleSheetSeeded`; `aquarelleBaseCompositedLive = painted &&
   (underlayApplied || aquarelleSheetSeeded)`. A BLANK first-visit key binds
   the cached image as the underlay. The underlay path (`engine.setUnderlay`,
   `t' = t_sheet x t_base^(1 - cover)`, render-only) is for every non-restored
   sheet. Never bind the base under a RESTORED sheet — that counts the
   committed paint twice.
4. **Capture: export the sheet, then merge only what it does not contain.**
   Restored sheet (`aquarelleSheetSeeded`): the exported sheet ALREADY carries
   the committed paint, so the capture merges with `base: null` — the sheet
   alone is the stored result. Blank key: the ordinary capture exports the
   transparent sheet AND `exportCanvas('coverage')` in the same turn and
   merges with `mergeBlend: 'coverage-composite'`: `t' = t_sheet x
   t_base^(1 - cover)`. Roto-owned composites (Lift punches, Apply over group
   bases) keep their `pigment-alpha` law. A re-render adopts its bake engine's
   exact sheet into the live layer (`onSheet` → `adoptSheet`), so painting
   after one re-render blends and picks up with no replay and no rebake per
   stroke.
5. **Alpha is darkness.** `alpha = 1 - min(t)` in mode 4 and in
   `rasterAlpha.ts`; the coverage channel drives deposition, erode, the wet
   gate and the base-replacement weight — never display opacity.
</parity-rules>

<sheet-cache>
## Sheet cache: cost and guarded surfaces

- **Cost.** Key leave: pixel capture + one GPU readback of the sheet
  (`captureSheet`, everPainted rect). Key return (visited this session): one
  texture upload (`restoreSheet`). Key return (not visited): nothing — the
  sheet starts blank over the cached image. No stroke replay anywhere in the
  Studio.
- **Cache law.** Entries are keyed by the frame's script signature (mutation
  id + sample count per event); any script edit mismatches and the key opens
  blank over its cache. Bounded: 3 frames / 256 MB, LRU; a single sheet over
  half the budget is never cached.
- **Clocks.** A sheet stores last-touch as AGES, not stamps: a bake runs a
  virtual clock from 0, and restoring raw stamps onto the live clock would
  read as ancient (no wetness, no blend). `restoreSheet` re-stamps as
  `now - age` after its `resetSheet()` re-bases `nowSec()` to ~0.
- **Known residual.** On a first-visit key (blank sheet) the first strokes do
  not pick up the committed base; they still paint and composite correctly
  over the cached image. One manual re-render adopts the sheet and restores
  blend/pickup. The sanctioned direction for base pickup without a re-render
  is a pickup-side read of the committed cache image (shader change + UAT),
  never a replay.

Detail, reproduction scenes and pitfalls: `references/live-seed.md`.
</sheet-cache>

<debugging-discipline>
## Debugging discipline (this is the part that matters)

Before changing any compositing law:

1. **Read the engine, not the comments.** The truth is in
   `Engine.bristleInk`, `Engine.coverageDeposit`, `Engine.coverPass` and
   `shaders.ts` (`bristleDepositFS`, `bristleCoverFS`, `coverDepositFS`,
   `coverMaskFS`, `displayFS`). Comments and test pins describe whatever law
   was written when they were edited.
2. **Reproduce the re-bake through the real engine** with the probe harness
   (`packages/efx-watercolor/probe/port-comparison`: `live-pickup-*`,
   `bake-pickup-*`, the D-G touch proof; `probe/pickup-collapse`: `app-live`
   / `app-bake` / `app-seedcost`; `probe/chalk-deposit` for a blank or faint
   deposit). The repro is the acceptance target — not a screenshot
   description, not display math.
3. **Change ONE law, compare pixels again.** A law change that cannot be shown
   in the probe (or in a live UAT row naming the exact surface) is not
   verified. Source-pin/unit tests only pin the law you just wrote.
4. **Name the surface** in every handover: live during stroke, after settle,
   after move/re-bake. They must agree.
5. **First-paint parity bugs: check the SHEET, not the underlay.** Ask whether
   the key's sheet was restored this session (`aquarelleSheetSeeded`) or is
   blank over the cached image, and whether a re-render adopted its bake sheet
   (`adoptSheet`). A display-raster tap cannot reproduce the bake's pickup —
   the base must live in the sheet. NEVER "fix" the gap with a stroke replay:
   the artist's law is then violated.
6. **A blank or near-blank stroke: bisect the medium record before the brush.**
   Paint the response through `probe/chalk-deposit` with the record's own
   params, then with one key reverted at a time. The 2026-11-21 chalk blank
   was Body 25 on the Chalk record, not a brush or shader defect.

Never: start the dev server (the artist runs it), run vitest in watch mode,
push, replay committed strokes into the live engine, or touch the store's
paint paths to "make the test pass".
</debugging-discipline>

<seams-and-files>
## Seams and files

| Concern | File |
| --- | --- |
| Dab/deposit laws, coverage, exports | `packages/efx-watercolor/src/playground/Engine.ts`, `shaders.ts` |
| Display modes 2/4, underlay branch | `shaders.ts` (`displayFS`), `Engine.drawDisplay`/`render` |
| Emboss / sheen / light | `shaders.ts` (`displaySource` emboss block, `EMBOSS_GAIN`/`EMBOSS_SHADE_MAX`/`EMBOSS_SPEC_*`, `uSpecHalf`), `Engine.ts` (`DEFAULT_LIGHT`, `setLight`/`getLight`, `RELIEF_BUMP`, the `drawDisplay` half-vector), `emboss.test.ts` |
| Replay/bake (the arbiter) | `packages/efx-watercolor/src/bake/aquarelleBake.ts`, `adapter/engineAdapter.ts` |
| Sheet cache (capture/restore, KEY = CACHE) | `playground/Engine.ts` (`captureSheet`/`restoreSheet`, last-touch ages), `AquarelleCanvasLayer.tsx` (`rememberSheet`/`takeSheet`/`restoreCachedSheet`, script signature) |
| Re-render adoption (bake sheet → live) | `bakeAquarelleEventsToFrame` (`onSheet`), `adapter.captureSheet`, `AquarelleCanvasLayer.adoptSheet`, `PhysicsPaintStudio.tsx` (`aquarelleAdoptSheetRef`) |
| Restored capture branch | `PhysicsPaintStudio.tsx` (`handleAquarelleCaptureFrame` → `base: null` while `aquarelleSheetSeeded`) |
| First-paint probe / cache cost | `packages/efx-watercolor/probe/pickup-collapse/` (`app-live`, `app-bake`, `app-seedcost`) |
| Per-stroke seed parity | `engineAdapter.ts` (`strokeRandomForMutationId`), `paintMutationLedger.ts` |
| Edge stroke layer lifecycle | `playground/Engine.ts` (`layerStrokeActive`, `ensureLayer`, `openLayer`, `commitLayer`, `discardLayer`, `mergeStrokeLayer`, `bindLayerAlpha`) |
| Global-opacity alpha / live layer display | `shaders.ts` (`LATERAL_WEIGHT` = the uniform `lateralWeight(amount)`, `STROKE_LAYER_ALPHA`, `bristleCoverLayerFS`, `strokeLayerMergeFS`, `strokeLayerCoverFS`, `strokeLayerReliefFS`, `displayLayerFS`), `bristles.ts` (`BRISTLE_LAYER_EDGE`) |
| Opacity/noise rows / records / payload | `aquarelleParamVisibility.ts` (the `edgeFade` row = **Opacity** in the `paint` group under Pickup, `invert: true`; the `noise` pair; the legacy `feather` row is `hidden: true`; the `transparency` group is retired), `aquarelleRecordState.ts` (`AQUARELLE_GLOBAL_KEYS`, defaults), `params.ts`, `mediums.ts` (`edgeFalloff` is a record-only key) |
| Feather-noise threshold law / permutation | `shaders.ts` (`bristleGatherSource`, `FEATHER_CLOUD`, `FEATHER_LAW_BODY`), `bristles.ts` (`featherNoiseDrive`, `featherEdgeClean`, `edgeFalloffExponent`, `FEATHER_NOISE_NEUTRAL`, `FEATHER_NOISE_LIFT`), `Engine.ts` (`featherLawActive`, `gatherProgram`, `bindGather`) |
| Opacity probe | `probe/medium-engine/` (`edge-layer` scenario, `baselines/edge-layer-neutral.json`, `compare.mjs --edge-structural`); the retired `--falloff-sweep` cannot separate shapes under the global law |
| Feather-noise probe | `probe/medium-engine/featherNoise.mjs` — the five-state sweep (slider 0 / 20 / 40 / 60 / 100 × Feather 85 / 0) and its six bars |
| Medium records / the Body cliff | `playground/mediums.ts`, `mediums.test.ts`, probe `probe/chalk-deposit` |
| Live surface | `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` |
| Committed base display | `.../engine/AquarelleCachedBaseLayer.tsx` (pigment-alpha conversion; steps aside while composited) |
| Canvas stack | `.../engine/PhysicsPaintCanvasMount.tsx` |
| Engine port (Roto/Studio boundary) | `.../engine/aquarelleEnginePort.ts` |
| Capture merge | `roto/physicsPaintRotoAlphaMerge.ts`, `hooks/useRotoFramePersistenceCoordinator.ts` |
| Capture handler, stroke end | `PhysicsPaintStudio.tsx` (`handleAquarelleCaptureFrame`, `handleAquarelleStrokeWillStart/End`) |
| Probe harness / gates | `packages/efx-watercolor/probe/port-comparison/` |

Known caveats:

- The cover channel is Body-weighted (`T = bodyAlpha x carried alpha`). At low
  Body the merge retains slightly more base than the engine's raw `1 - a`
  attenuation. If a low-Body stroke reads too blue, export the raw attenuation
  union instead of the cover channel.
- The Lift punch preview lives on the cached base canvas; with the base stepped
  aside during a live composite the preview is only visible when the live sheet
  is empty (the shipped flow). Do not "fix" this by stacking the base.
- The cache eye (`frozenCacheVisible`) disables the underlay and hides the
  cached base — both display-only. On a RESTORED sheet it cannot hide the
  committed paint: the paint is in the sheet (artist-accepted surface change).
- On a first-visit key the sheet is blank over the cached image: instant, but
  the first strokes do not pick up/blend with the committed base until ONE
  manual re-render adopts the bake's sheet. That residual is by design; never
  "fix" it by replaying strokes.
- The ONE global Opacity is bristle-only, and stored `edgeFade` 0 (= Opacity
  100, the default) is a structural bypass. `edgeFalloff` is a retired record
  key — no transparency shader reads it. Lowering Opacity glazes the whole
  stroke uniformly; a lateral fade/falloff cannot be expressed by this law and
  was rejected live (the zebra band) — a new lateral control needs a new
  artist decision and a probe. The layer is transient: capture, cache, export
  and bake are layer-blind and see only the merged sheet; undo/redo ride the
  stroke's own transaction. Layer memory is 40 B/px measured (≈160 MiB at
  2048²).
- The stroke-end merge is pointwise in coefficient space, so the layer's own
  feather noise and grain survive verbatim — any future band fit or spatial
  pre-encode would smooth them.
- The legacy Feather row is hidden on purpose: the feather-noise slider owns
  the edge raggedness (0 zeroes it, 20 = the shipped base, 20+ breaks it up).
  Do not un-hide the row or add a second edge-noise control without a new
  artist decision. Feather noise is threshold-only — never a depth fade or a
  band/reflectance mix — and the slider-20 neutral program must stay
  byte-identical to the pre-change gather.
</seams-and-files>

<gates>
## Verification gates

- `pnpm --dir packages/efx-watercolor exec vitest run` (never watch)
- `pnpm --dir app exec vitest run`
- `pnpm --dir app exec tsc --noEmit`
- first-paint probe: `probe/pickup-collapse` `app-live` vs `app-bake` at
  `--gap 20000`; FINAL PIXELS must be identical; pickup-0 control unmixed on
  both
- chalk/dry deposit: `node probe/chalk-deposit/run.mjs` — every presets
  response must report painted texels > 0 on its own medium record
- cache cost: `app-seedcost --sheet WxH --base-samples N`; record the capture
  and restore phases
- Opacity identity: `probe/medium-engine --gate edge-layer-neutral` +
  `compare.mjs --edge-structural` — stored-edgeFade-0 (Opacity 100) digests
  identical, `layerAllocated false`, `mergeDraws 0`
- Opacity uniformity: at stored `edgeFade > 0` the committed stroke reads ONE
  uniform alpha across its cross-section (no rim opening, no core plateau);
  the retired `--falloff-sweep` no longer separates shapes
- Opacity live rows: Opacity 100 inert (default look); ~50 glazes the whole
  mark uniformly over paper and over a committed base (no zebra band, no
  white fringe); Opacity 0 fully transparent; undo/redo one edit;
  leave/reopen + forced re-render parity
- Emboss/sheen law: `pnpm --dir packages/efx-watercolor exec vitest run
  src/playground/emboss.test.ts` — one CPU half-vector uniform, five relief
  taps reused, exact neutral identity (flat / intensity 0 / bump 0 / uFlat 1 /
  zero thickness), the fold before the clamp, alpha untouched, both display
  variants identical. Live rows approved 2026-11-28: crest sheen, thin films
  clean, live = committed, region pick hides it, intensity 0 = unlit look;
  `DEFAULT_LIGHT` 130/38/1 within one degree of the paper's baked light
- Feather-noise probe: `probe/medium-engine` five-state sweep
  (`featherNoise.mjs`) — slider 20 / falloff 50 digests byte-identical to the
  pre-change baseline, slider 0 differs by design, driven states never exceed
  the base footprint and never fall below it when clean, the core erodes
  progressively with a surviving spine, footprint ≥ 80 % of base, Feather 0
  inert
- probe scene(s) for the touched surface through the real engine
- live UAT row naming the exact surface (live / committed / re-render)

Reference detail: `references/compositing-parity.md`,
`references/edge-transparency.md`, `references/live-seed.md`.
</gates>
