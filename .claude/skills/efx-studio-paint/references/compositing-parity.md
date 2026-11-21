# Compositing parity — the shipped arithmetic

Reference for `Skill("efx-studio-paint")`. Every formula here is implemented;
the file names below are the authority when this document drifts.

## 1. The engine deposit (per dab)

Non-bristle (`Engine.coverageDeposit`):

    ink   <- ink   * (1 - a) + C * a      // 7 spectral absorbance coefficients + scattering S
    fixed <- fixed * (1 - a)              // bodyCover pass, same a
    cover <- cover * (1 - a) + a          // coverMaskFS, ONE / ONE_MINUS_SRC_ALPHA

Bristle / acrylic (`Engine.bristleInk`, four draws):

    ink   *= (1 - a)                      // bristleDepositFS uMode 1, ZERO / ONE_MINUS_SRC_COLOR
    fixed *= (1 - a)                      // same draw into the settled pool (1b)
    ink   += carried * a                  // bristleDepositFS uMode 0, ONE / ONE
    cover <- cover * (1 - a) + T * a      // bristleCoverFS, T = uCoverTarget * g.alpha
                                             (uCoverTarget = bristleBodyAlpha = Body opacity)

`a = clamp(gather.coverage, 0, 1)`; the carried coefficients and the smear are
coefficient-space (no RGB averaging).

## 2. What the artist sees

| Surface | Law |
| --- | --- |
| Storage / cache bytes | mode 2: opaque transmittance `vec4(lit, 1)`, white = no pigment |
| Cached-base display | `rasterAlpha.transmittanceToAlpha`: `alpha = 1 - min(t)`, `color = (t - min) / alpha` |
| Live compositor (mode 4) | `alpha = 1 - min(t)`, `color = (t - min) / alpha`; premultiplied output |
| Live over committed (underlay) | `t' = t_sheet x t_base^(1 - cover)`, linear light, then mode 4 |
| Capture merge (`coverage-composite`) | stored `t' = t_sheet x t_base^(1 - cover)`, linear light |
| Full-script re-bake | replay through §1, published raw (`durableBase: known-empty` for ordinary keys) |

The underlay composite is `Engine.setUnderlay` + the mode-4 branch in
`displayFS`; it is bound only when `target === null && mode === MODE.pigment`
(the on-screen render). Exports never sample it.

## 3. Why the parity holds

Let `S` be the surviving share of the committed base under a stroke. The engine
attenuates both pools by `(1 - a)` per dab, so `S = prod(1 - a_i)`. The cover
channel accumulates the same lerp, so with a constant cover target `T`,
`cover = T x (1 - S)`. The artist's usual Body 100 gives `T ~ 1`, hence
`S = 1 - cover`.

At `S`:

    t' = exp(-(S A_base + (1 - S) C)) = t_base^S x exp(-(1 - S) C)

and the live sheet itself is `t_sheet = exp(-(1 - S) C)` (the engine starts
empty), so `t' = t_sheet x t_base^S`. With `S = 1 - cover` this is the shipped
formula.

The committed base must then step aside: the live canvas's output is a pigment
layer with `alpha = 1 - min(t') < 1`, so the cached base underneath would
re-add its paint (the double count). `aquarelleBaseCompositedLive` hides it
(display-only class; the canvas stays mounted).

## 4. Seed parity

`hashMutationId(id)` is the trace seed `configure()` derives for an unsalted
stroke. `strokeRandomForMutationId(id) = seededRandom(hashMutationId(id) || 1)`
reproduces that stream exactly (pinned in `engineAdapter.test.ts`). The Studio
draws the id at pointerdown, the engine is seeded before the first dab, and the
stroke end accepts that same reserved id — so the live dabs and the stored
record agree.

## 5. Verification surfaces

- Headless real-engine probe: `packages/efx-watercolor/probe/port-comparison`
  (`node probe/port-comparison/run.mjs --run after --scene <name> --out <json>`).
  Panels land in `/tmp/port-comparison/<run>/<scene>-pigment.png`.
- App diagnostics: `/tmp/efx-aquarelle-render-split.json` — `coordinator-produce`
  (`mergeBlend`), `script-bake` (`diagnostics.path`, `simulatedTicks`,
  `skippedGapTicks`), `capture-alpha-proof`.
- UAT must name the surface: live during stroke / after settle / after move.
