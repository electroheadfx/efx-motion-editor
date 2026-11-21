---
name: efx-studio-paint
description: Studio paint engine (Physic Paint / watercolor + acrylic bristle media). The shipped compositing laws — pigment replacement with coverage, live-over-committed parity, live-seed replay (the live sheet holds the committed paint), the capture merge, per-stroke seeds, first-paint pickup parity, seed cost — plus the seams, files, verification gates and debugging discipline for any change to what the artist sees. Load before touching the aquarelle engine, its Studio layers, the live-seed path, the capture merge, or brush/mutation recording.
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
2. **Live-seed: the live sheet HOLDS the committed paint.** At mount, after
   every `resetSheet()` and on a debounced frame change, the committed script
   is replayed into the LIVE engine through the bake's own adapter feed path
   (`seedAquarelleEngine`) — same events (including the commit's
   `withAquarelleReplayGrid` transform), same per-stroke seeds, same capped
   settle. The carrier's `canvasAt`/`wetAt` taps then read the base exactly as
   a re-bake's do, and the stroke's own touch re-wets it, so Pickup works on
   the FIRST live dab for ANY pause. This is the primary live path; a tap on
   the display raster is NOT a substitute (a static raster dries out and cannot
   be re-wet).
3. **The underlay is the fallback, never stacked.** While a sheet is seeding
   or seeded, the live compositor binds NO underlay (`setUnderlay(null)`) and
   the cached base element steps aside (`aquarelleBaseCompositedLive`). The
   underlay path (`engine.setUnderlay`, `t' = t_sheet x t_base^(1 - cover)`,
   render-only, exports ignore it) remains for non-seeded / legacy / empty
   states. Never bind or stack the base under a seeded sheet — that counts the
   committed paint twice.
4. **Capture: export the sheet, then merge only what it does not contain.**
   Seeded: the exported sheet ALREADY carries the committed paint, so the
   ordinary capture merges with a null base — the sheet alone is the stored
   result. Non-seeded: the ordinary capture exports the transparent sheet AND
   `exportCanvas('coverage')` in the same turn and merges with `mergeBlend:
   'coverage-composite'`: `t' = t_sheet x t_base^(1 - cover)`. Roto-owned
   composites (Lift punches, Apply over group bases) keep their
   `pigment-alpha` law.
5. **Alpha is darkness.** `alpha = 1 - min(t)` in mode 4 and in
   `rasterAlpha.ts`; the coverage channel drives deposition, erode, the wet
   gate and the base-replacement weight — never display opacity.
</parity-rules>

<live-seed>
## Live-seed: mechanism, cost and guarded surfaces

- **Undo isolation.** The seed is the committed base, not an artist action:
  `Engine.setStepRecording(false)` makes `beginStep`, `recordChange` and every
  `history.protect` a no-op for the seed's duration. A seed must never appear
  as an undo step or pollute the previous step's tiles.
- **One clock.** `setManual(true)` + ONE mode-switched clock closure
  (`seedMode ? seedMs : seedEndMs + realElapsed`). Never a second `setClock`:
  `nowSec()` re-bases on install, and a re-base makes every seeded last-touch
  stamp read as age 0. Ages start at ~0 at handoff and grow with the artist's
  real pause — the bake's temporal law.
- **Input and mid-seed safety.** The pointer is refused while `seeding`;
  snapshots, flushes, dry/settle captures and frame-leave captures skip a
  mid-replay film; a frame scrub is debounced (`FRAME_SEED_DEBOUNCE_MS`, 250 ms)
  so a burst seeds only the landing frame; one `seedChain` + generation token
  makes a superseded seed unreachable.
- **Cost is real and linear in the committed dab count.** The replay dominates;
  the settle is ~1 ms and the readback ~80–90 ms. Measured on the headless CPU
  (SwiftShader upper bound): 1.84 s at 1080×1080 / 240 dabs, 3.41 s at
  1920×1080 / 457 dabs. An app GPU is faster, but the feed is CPU work. Treat a
  new slowdown as a critical-engine regression: read the seed cost first
  (probe `app-seedcost`, `seedMs` / `seedPhases`), not the display path.
- **Known surface changes.** On a seeded sheet the filter-mode eye cannot hide
  the committed paint (it lives IN the sheet; neither the cached base nor the
  underlay is bound or stacked); the gather's mid-stroke smear read remains
  sheet-only (live smear < bake smear) — follow-up only if the artist's surface
  shows it.

Detail, reproduction scenes and pitfalls: `references/live-seed.md`.
</live-seed>

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
   `bake-pickup-*`, the D-G touch proof; `probe/pickup-collapse`: `app-seeded`
   / `app-bake` / `app-seedcost`). The repro is the acceptance target — not a
   screenshot description, not display math.
3. **Change ONE law, compare pixels again.** A law change that cannot be shown
   in the probe (or in a live UAT row naming the exact surface) is not
   verified. Source-pin/unit tests only pin the law you just wrote.
4. **Name the surface** in every handover: live during stroke, after settle,
   after move/re-bake. They must agree.
5. **First-paint parity bugs: check the SEED, not the underlay.** Ask whether
   the sheet is seeded (`seeding` / `aquarelleSheetSeeded`) and whether the
   seed getter applied the commit's transform. A display-raster tap cannot
   reproduce the bake's pickup — the base must live in the sheet.

Never: start the dev server (the artist runs it), run vitest in watch mode,
push, replace the live-seed with an underlay tap for pickup, or touch the
store's paint paths to "make the test pass".
</debugging-discipline>

<seams-and-files>
## Seams and files

| Concern | File |
| --- | --- |
| Dab/deposit laws, coverage, exports | `packages/efx-watercolor/src/playground/Engine.ts`, `shaders.ts` |
| Display modes 2/4, underlay branch | `shaders.ts` (`displayFS`), `Engine.drawDisplay`/`render` |
| Replay/bake (the arbiter) | `packages/efx-watercolor/src/bake/aquarelleBake.ts`, `adapter/engineAdapter.ts` |
| Live-seed replay (live sheet = committed paint) | `packages/efx-watercolor/src/bake/aquarelleSeed.ts`; `adapter/engineAdapter.ts` (engine + clock injection); `playground/Engine.ts` (`setStepRecording`, clock) |
| Seeded live surface / input gates | `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` (`seeding`, `aquarelleSheetSeeded`, `seedChain`, capture gates) |
| Seeded capture branch | `PhysicsPaintStudio.tsx` (`handleAquarelleCaptureFrame` → `base: null` while seeded) |
| First-paint probe / seed cost | `packages/efx-watercolor/probe/pickup-collapse/` (`app-seeded`, `app-bake`, `app-seedcost`) |
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
- The cache eye (`frozenCacheVisible`) disables the underlay and hides the
  cached base — both display-only. On a SEEDED sheet it cannot hide the
  committed paint: the paint is in the sheet (artist-accepted surface change).
- On a seeded sheet the FIRST stroke after a frame switch waits for the seed
  replay (pointer refused; cost above). This is a deliberate parity tradeoff,
  not a bug; any regression is measured from `seedMs`, never "fixed" by
  skipping the seed.
</seams-and-files>

<gates>
## Verification gates

- `pnpm --dir packages/efx-watercolor exec vitest run` (never watch)
- `pnpm --dir app exec vitest run`
- `pnpm --dir app exec tsc --noEmit`
- first-paint probe: `probe/pickup-collapse` `app-seeded` vs `app-bake` at
  `--gap 20000`; FINAL PIXELS must be identical; pickup-0 control unmixed on
  both
- seed cost: `app-seedcost --sheet WxH --base-samples N`; record `seedMs` and
  `seedPhases` (replay dominates)
- probe scene(s) for the touched surface through the real engine
- live UAT row naming the exact surface (live / committed / re-render)

Reference detail: `references/compositing-parity.md`,
`references/live-seed.md`.
</gates>
