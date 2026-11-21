---
name: efx-studio-paint
description: Studio paint engine (Physic Paint / watercolor + acrylic bristle media). The shipped compositing laws — pigment replacement with coverage, live-over-committed parity, the capture merge, per-stroke seeds — plus the seams, files, verification gates and debugging discipline for any change to what the artist sees. Load before touching the aquarelle engine, its Studio layers, the capture merge, or brush/mutation recording.
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
</the-one-law>

<parity-rules>
## Live / committed parity (shipped 2026-11-21)

1. **Per-stroke seed.** The Studio reserves the stroke's mutation id at
   pointerdown (`onStrokeWillStart`) and seeds the engine with
   `strokeRandomForMutationId(id)` before the first dab; stroke end accepts
   that reserved id (`allocateStrokeMutation(..., reservedMutationId)`). Live
   and every re-bake then share one random stream.
2. **Live over committed.** The live compositor renders the committed sheet
   under the live film: `engine.setUnderlay(committed sheet image)` — a
   render-only seam; every `exportCanvas` ignores it. The law is
   `t' = t_sheet x t_base^(1 - cover)` in linear light, then the mode-4
   darkness-alpha conversion.
3. **Never stack the composite.** While the live canvas carries the whole
   composite, the committed cached-base layer steps aside
   (`aquarelleBaseCompositedLive`). Stacking it under the composite counts the
   committed paint twice — a translucent stroke that darkens the layer below.
4. **The capture merge stores the same product.** The ordinary capture exports
   the transparent sheet AND `exportCanvas('coverage')` in the same turn, and
   merges with `mergeBlend: 'coverage-composite'`:
   `t' = t_sheet x t_base^(1 - cover)`. The old `pigment-alpha` lerp stays only
   for Roto-owned composites (Lift punches, Apply over group bases).
5. **Alpha is darkness.** `alpha = 1 - min(t)` in mode 4 and in
   `rasterAlpha.ts`; the coverage channel drives deposition, erode, the wet
   gate and the base-replacement weight — never display opacity.
</parity-rules>

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
   `bake-pickup-*`, the D-G touch proof). The repro is the acceptance target —
   not a screenshot description, not display math.
3. **Change ONE law, compare pixels again.** A law change that cannot be shown
   in the probe (or in a live UAT row naming the exact surface) is not
   verified. Source-pin/unit tests only pin the law you just wrote.
4. **Name the surface** in every handover: live during stroke, after settle,
   after move/re-bake. They must agree.

Never: start the dev server (the artist runs it), run vitest in watch mode,
push, or touch the store's paint paths to "make the test pass".
</debugging-discipline>

<seams-and-files>
## Seams and files

| Concern | File |
| --- | --- |
| Dab/deposit laws, coverage, exports | `packages/efx-watercolor/src/playground/Engine.ts`, `shaders.ts` |
| Display modes 2/4, underlay branch | `shaders.ts` (`displayFS`), `Engine.drawDisplay`/`render` |
| Replay/bake (the arbiter) | `packages/efx-watercolor/src/bake/aquarelleBake.ts`, `adapter/engineAdapter.ts` |
| Seed parity | `engineAdapter.ts` (`strokeRandomForMutationId`), `paintMutationLedger.ts` |
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
- The cache eye (`frozenCacheVisible`) disables the underlay as well as hiding
  the cached base — both are display-only.
</seams-and-files>

<gates>
## Verification gates

- `pnpm --dir packages/efx-watercolor exec vitest run` (never watch)
- `pnpm --dir app exec vitest run`
- `pnpm --dir app exec tsc --noEmit`
- probe scene(s) for the touched surface through the real engine
- live UAT row naming the exact surface (live / committed / re-render)

Reference detail: `references/compositing-parity.md`.
</gates>
