---
name: efx-studio-paint
description: Studio paint engine (Physic Paint / watercolor + acrylic bristle media). The shipped compositing laws — pigment replacement with coverage, the Body cliff, live-over-committed parity, KEY = CACHE (a key opens on its committed image and strokes are never replayed), the sheet cache and re-render adoption, the capture merge, per-stroke seeds, first-paint pickup parity, cache cost — plus the seams, files, verification gates and debugging discipline for any change to what the artist sees. Load before touching the aquarelle engine, its Studio layers, the key/sheet path, the capture merge, brush/mutation recording, or any medium record.
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
| Replay/bake (the arbiter) | `packages/efx-watercolor/src/bake/aquarelleBake.ts`, `adapter/engineAdapter.ts` |
| Sheet cache (capture/restore, KEY = CACHE) | `playground/Engine.ts` (`captureSheet`/`restoreSheet`, last-touch ages), `AquarelleCanvasLayer.tsx` (`rememberSheet`/`takeSheet`/`restoreCachedSheet`, script signature) |
| Re-render adoption (bake sheet → live) | `bakeAquarelleEventsToFrame` (`onSheet`), `adapter.captureSheet`, `AquarelleCanvasLayer.adoptSheet`, `PhysicsPaintStudio.tsx` (`aquarelleAdoptSheetRef`) |
| Restored capture branch | `PhysicsPaintStudio.tsx` (`handleAquarelleCaptureFrame` → `base: null` while `aquarelleSheetSeeded`) |
| First-paint probe / cache cost | `packages/efx-watercolor/probe/pickup-collapse/` (`app-live`, `app-bake`, `app-seedcost`) |
| Per-stroke seed parity | `engineAdapter.ts` (`strokeRandomForMutationId`), `paintMutationLedger.ts` |
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
- probe scene(s) for the touched surface through the real engine
- live UAT row naming the exact surface (live / committed / re-render)

Reference detail: `references/compositing-parity.md`,
`references/live-seed.md`.
</gates>
