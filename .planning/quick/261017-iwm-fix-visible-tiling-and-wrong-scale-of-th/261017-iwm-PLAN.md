---
phase: quick-261017-iwm
plan: 261017-iwm
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/papers/procedural.ts
  - packages/efx-watercolor/src/papers/papers.test.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/lib/projectPaperRaster.test.ts
autonomous: true
requirements: []

estimate:
  tokens: 32000
  raw_tokens: 22000
  tasks: 2
  confidence: med

must_haves:
  truths:
    - "The editor fond is one continuous procedural paper: no visible tile grid and no seams at any canvas size."
    - "Tooth feature size is canvas-size-invariant under the playground PAPER_UNITS = 1100 law: frequency scales with output height / 1100, so the same paper at 512 and 1024 shows features of the same pixel size."
    - "Per-paper bump / mottle from the playground papers.ts table still modulate relief contrast / cloudiness."
    - "Procedural fond rasters are cached by content key and never regenerated on every render."
    - "PaperPicker thumbs, the real-jpg fond arm, and the aquarelle bake / paperPass path stay behaviourally unchanged."
  artifacts:
    - packages/efx-watercolor/src/papers/procedural.ts
    - packages/efx-watercolor/src/papers/papers.test.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
  key_links:
    - "proceduralHeightMap (packages/efx-watercolor/src/papers/procedural.ts) is the one place the frequency law lives — a new referenceHeight parameter, default = today's f-cycles-across-the-map so PaperPicker / paperPass / papers.test keep their bytes."
    - "buildProceduralPaperTile / drawProjectPaperRaster (app/src/lib/projectPaperRaster.ts) is the fond seam: generate at the fond's actual WxH and draw once; the createPattern('repeat') arm stays for real jpg scans only."
    - "getProjectPaperCanvas is what physicPaintStore, previewRenderer, rotoPlaybackBackground, and physicsPaintRotoScriptThumbnail already call — fix the procedural arm there and every fond surface follows."
---

<objective>
Fix the visible 4x4 tile grid and the wrong grain scale on the procedural paper fond (live UAT screenshot 49, 2026-10-17).

Two faults, already located:

1. **Tiling.** `app/src/lib/projectPaperRaster.ts` synthesizes one 256x256 relief tile and `drawProjectPaperRaster` repeats it across the fond via `createPattern(texture, 'repeat')` — that repeat is the grid. The oracle does not tile: the playground runs its paper field per-texel over the whole target as a continuous function of paper-unit space.
2. **Scale law.** `FIELD_RECIPES` frequencies are "cycles across the tile of 256" (pixel-space), so grain size drifts with canvas size. The playground law is `PAPER_UNITS = 1100` (engine/Engine.ts:133): a feature keeps a constant physical size at any document size; `paperScale = PAPER_UNITS / dh` (Engine.ts:353).

Required fix (no architecture re-derivation — the call sites are known):

1. Generate the height field over the fond's actual raster size; remove the repeat/tile path from the procedural arm. The real-jpg arm stays as-is.
2. Express frequencies relative to a 1100-unit reference height via a `referenceHeight` parameter on `proceduralHeightMap`, so a recipe frequency `f` becomes `f * (outputHeight / 1100)` cycles across the generated map. Prefer the scaling inside the generator (testable, not re-implemented per caller).
3. Honour per-paper bump / mottle from the playground `engine/papers.ts:23-32` as relief/emboss strength and low-frequency speckle amplitude. Tint/fleck colours are optional — do not gold-plate.
4. Cache the full-fond field by content key in the existing decode-once content-keyed-cache pattern.

Purpose: the user cannot judge watercolor on a visibly repeating grid; feature size must match the playground preview at the same zoom.

Output: scale-law parameter in the package generator; full-fond no-tile synthesis in the app; pin tests for no-repeat, frequency scaling, bump/mottle, and cache identity.

## Scope fence (crossing any of these fails the task)

- **P1 clean-room HARD fence:** do NOT transliterate `paperFieldFS` / `paperLightFS` GLSL or port `pcg`/`hash`/`vnoise`/`fbm`/`blobs`/`fibres`/`specks`/`warp`/`coldPress` from the playground. Numbers and laws only (`PAPER_UNITS = 1100`, `paperScale`, bump/mottle table). P1 is method provenance, not licence.
- Do NOT edit `SPECS/v1.1.0-water-color/watercolor-playground` (read-only oracle).
- Do NOT change `PaperPicker.tsx` `CELL_SIZE = 64` / `GRID_GAP = 8` / 3-column grid. Picker thumbs may keep the small map.
- Do NOT change the aquarelle bake / cache-key work (`packages/efx-watercolor/src/bake/aquarelleBake.ts`, `app/src/lib/paperPass.ts` call shape).
- Do NOT change the paper validator work from `1876f4b3`.
- Do NOT touch `PhysicsPaintTopBar.tsx` / `PhysicsPaintRightPanel.tsx` (I-04/I-05/I-06 remain separate).
- Do NOT add jpeg conversion of procedural papers.
- No new dependencies.
- Do NOT tick any TODO row in `SPECS/v1.1.0-water-color/phase-55-issues/index.md`.

## Project constraints (mandatory)

- Preact + @preact/signals only; no `useState`; no `useEffect` for selection.
- `pnpm`, never `npm`. `pnpm vitest run` — never watch mode.
- Vitest collects only `*.test.ts` — not `.test.tsx`.
- No backward-compat shims / legacy migration.
- One atomic commit for this quick (English conventional message).
- Never push. Local commit only. Sequential, main tree.
- If `git commit` hits `.git/index.lock`: `lsof .git/index.lock`; if nothing holds it, `rm -f .git/index.lock` and retry. Never delete other `.git/*` files.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md

FIX CONTRACT (locked — already researched, do not re-derive):

## Fault 1 — the fond repeats a 256 tile

- `buildProceduralPaperTile` (projectPaperRaster.ts) builds one `PROCEDURAL_FOND_TILE = 256` canvas from a 256-window of a 1100 field and caches it in `proceduralTileCache`.
- `drawProjectPaperRaster` then does `context.createPattern(texture, 'repeat')` + `fillRect` — the visible grid.
- `proceduralHeightMap(id, seed, width, height)` already accepts arbitrary width/height. Call it at the fond size.

## Fault 2 — pixel-space frequency

- Today `FIELD_RECIPES.toothFrequency` is "cycles across the tile" of 256; `u = (x / width) * period` always spans `period` cycles whatever the map size, so feature pixel-size drifts when the map size drifts.
- Playground law (numbers only): `PAPER_UNITS = 1100`; a feature of F paper units spans `F * dh / PAPER_UNITS` texels of a sheet `dh` tall; grain looks the same at any document size.
- Required: recipe `f` becomes "cycles per 1100 texels of sheet height" when `referenceHeight = 1100`. Across a generated map of height `H`: `f * (H / 1100)` cycles. Isotropic: cycles-per-texel is `f / referenceHeight` on both axes.

## Default that keeps existing callers byte-stable

`referenceHeight` is **optional**. When omitted, keep today's formula exactly (`period` cycles across each axis, `u = (x / width) * period`, `v = (y / height) * period`) so `PaperPicker` (CELL_SIZE=64), `paperPass.ts` (aquarelle bake tooth), and `papers.test.ts` keep their bytes. When provided, use the isotropic `f / referenceHeight` law. Export `PAPER_REFERENCE_HEIGHT = 1100` from `procedural.ts` as the single home of the constant.

## Bump / mottle (playground engine/papers.ts:23-32 — numbers only)

| studio id | bump | mottle |
|---|---|---|
| paper/cold-press | 1.0 | 0.05 |
| paper/hot-press | 0.6 | 0.04 |
| paper/rough | 0.8 | 0.06 |
| paper/khadi | 1.0 | 0.12 |
| paper/washi | 0.8 | 0.14 |
| paper/laid | 1.0 | 0.05 |
| paper/canvas | 1.0 | 0.04 |
| paper/toned-sand | 1.0 | 0.06 |
| paper/kraft | 0.8 | 0.12 |
| paper/student | 1.0 | 0.03 |

`PLAYGROUND_PAPER_LOOK` in projectPaperRaster.ts already carries these. Keep honouring them in the fond shade. The `1.4` factor from `(preset.bump * 1.4) / scale` is a constant you may adopt; do not port their shader. Tint/fleck colours: skip unless the fond renderer already has a colour channel — it is grayscale relief today, do not add one.

## Cache

Full-fond fields are expensive. Content key in the existing module-level Map pattern: `(paperId, seed, width, height, grainScale)` (seed is currently the fixed `1`; include it in the key anyway). Strength is a paperPass/engine-tooth input, not a fond input — do not grow the `getProjectPaperCanvas` API. Same key twice returns the identical canvas object.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: referenceHeight scale law in proceduralHeightMap</name>
  <files>packages/efx-watercolor/src/papers/procedural.ts, packages/efx-watercolor/src/papers/papers.test.ts</files>
  <behavior>
    - Existing behaviour: proceduralHeightMap(id, seed, w, h) with referenceHeight omitted keeps byte-identical output to today (hash equality pin at 32x32 and at the non-square 16x12 size papers.test already uses).
    - New law: proceduralHeightMap(id, seed, w, h, 1100) places f * (h / 1100) cycles across the height axis and f * (w / 1100) across the width axis (isotropic cycles-per-texel f/1100).
    - Frequency scales with output height / referenceHeight: local-extrema count along a centre row of a 512x512 map with referenceHeight 1100 is about half that of a 1024x1024 map of the same paper (feature pixel-size stays ~1100/f).
    - No tile repetition: a 512x512 field with referenceHeight 1100 has column 0 distinct from column 256 (a repeated 256 tile would match).
    - Unknown id still returns null; non-positive or non-integer sizes still return null.
  </behavior>
  <action>Add an optional `referenceHeight` parameter to `proceduralHeightMap` in `packages/efx-watercolor/src/papers/procedural.ts`, and export `PAPER_REFERENCE_HEIGHT = 1100` as the playground sheet-height law (the number, not any shader). When `referenceHeight` is omitted, keep the current coordinate mapping byte-for-byte (recipe frequency stays "cycles across the generated map" — the 256-tile recipe domain) so PaperPicker thumbs, paperPass bake tooth, and the existing papers.test hashes do not move. When `referenceHeight` is a finite positive number, map sample coordinates isotropically at `recipeFrequency / referenceHeight` cycles per texel so a recipe `f` is "cycles per `referenceHeight` texels of sheet height"; at `referenceHeight = PAPER_REFERENCE_HEIGHT` this is the user's required `f * (outputHeight / 1100)` law. Update the `PaperFieldRecipe` doc comment so `toothFrequency` / `mottleFrequency` / `streakFrequency` state both meanings. Do not change the FIELD_RECIPES numbers, the seeded lattice core, or the [0,1] clamp. Do not touch paperPass.ts or PaperPicker.tsx. Add the behaviour pins above to `packages/efx-watercolor/src/papers/papers.test.ts` (keep the existing describes green).</action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor exec vitest run src/papers/papers.test.ts</automated>
  </verify>
  <done>referenceHeight is optional and default-stable (hash pin); the 1100 law is exported; frequency scales with outputHeight/referenceHeight; a 512 map is not a 2x repeat of a 256 map; papers.test.ts green under vitest run (never watch).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: fond at full raster, no tiling, content-keyed cache</name>
  <files>app/src/lib/projectPaperRaster.ts, app/src/lib/projectPaperRaster.test.ts</files>
  <behavior>
    - getProjectPaperCanvas on a procedural id at WxH returns a WxH canvas whose pixels come from one continuous field — the image is not a repeated 256 tile (pin: at 512x512 the pixel at (0,y) differs from (256,y) for interior y; a 256-repeat would match).
    - Feature size is canvas-size-invariant: the same paper at 512x512 and 1024x1024 shows ~2x the features on the larger canvas (comparable physical size, frequency scales with height / 1100).
    - Cold Press vs Rough still differ (Rough reads coarser); hot-press bump 0.6 still differs from cold-press bump 1.0; washi mottle 0.14 still differs from student 0.03.
    - Two getProjectPaperCanvas calls with the same (id, W, H, scale) return the identical canvas object; a different scale returns a different canvas.
    - Unknown procedural ids stay fail-soft null; paper/real-* stays on the jpg URL path (null until resolve).
    - The real-jpg arm of drawProjectPaperRaster still uses createPattern('repeat') (the 260923-bcm scale pins stay green).
  </behavior>
  <action>In `app/src/lib/projectPaperRaster.ts`, replace the 256-tile synthesis with full-fond generation. Introduce a `buildProceduralPaperFond(paperTexture, width, height, scale)` that calls `proceduralHeightMap(paperTexture, seed, width, height, referenceHeight)` at the fond's actual raster size with `referenceHeight = PAPER_REFERENCE_HEIGHT * normalizeGrainScale(scale)` (grainScale 2 coarsens the field, matching the jpg pattern-transform zoom direction), then shades it with the existing PaperPicker relief formula modulated by `PLAYGROUND_PAPER_LOOK` bump / mottle (keep the current look table; you may fold the playground's constant 1.4 into the relief slope). Cache the finished canvas in a module-level Map keyed by content `(paperTexture, seed, width, height, normalizeGrainScale(scale))` — same key returns the identical object. Point `getProjectPaperCanvas`'s procedural arm at this builder and return that canvas directly (it is already WxH); do not run procedural rasters through `createPattern('repeat')`. Keep `drawProjectPaperRaster`'s pattern/repeat path for the real-jpg arm only — the procedural arm must not tile. Delete `PROCEDURAL_FOND_TILE` / the 256-window sampler / the old `proceduralTileCache` once unused. Leave `PAPER_TEXTURE_URLS`, the jpg resolve subscription, `paperPass.ts`, `PaperPicker.tsx`, and `clearProjectPaperRasterCache` / `resetProjectPaperRasterForTests` semantics intact (reset must clear the new fond cache too). Update `app/src/lib/projectPaperRaster.test.ts`: the fz3 source-scan that expects `PAPER_UNITS / PROCEDURAL_FOND_TILE` must follow the new law (`PAPER_REFERENCE_HEIGHT`); the `getProjectPaperCanvas` body scan may name the new builder instead of `proceduralHeightMap` directly; add the no-repeat, frequency-scaling, bump/mottle, and cache-identity pins from the behaviour block. Keep the 260923-bcm grain-scale and jpg-path pins green.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/projectPaperRaster.test.ts</automated>
  </verify>
  <done>Procedural fond is one continuous no-seam field at any canvas size; feature size follows PAPER_REFERENCE_HEIGHT = 1100; bump/mottle honoured; content-keyed cache returns identical objects; jpg arm unchanged; projectPaperRaster.test.ts green under vitest run (never watch).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Paper id / seed / size / grainScale → procedural height synthesis | hostile or unknown inputs must not throw or stall the fond path |
| Fond raster cache → every consumer (flattened composite, preview, playback, thumbnail) | a stale or mis-keyed cache serves the wrong paper or a tile grid |
| Playground oracle constants → app-side relief synthesis | wrong scale/bump mapping silently misrepresents the paper (the reported bug) |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this directory (T-261017-IWM-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261017-IWM-01 | Integrity | fond content-key cache — a missing term (scale/size/seed) would serve a stale tile or the wrong grain | high | mitigate | Cache key is (paperTexture, seed, width, height, normalizeGrainScale(scale)); pin asserts same key returns the identical object and a different scale returns a different object |
| T-261017-IWM-02 | Tampering | unknown or hostile paper id / size / scale reaching the builder must not throw or hang | medium | mitigate | proceduralHeightMap stays total (null on unknown id / non-positive size / non-finite seed); normalizeGrainScale already floors hostile scale to 1; pin covers unknown paper/* and empty string |
| T-261017-IWM-03 | Availability | a full-fond field at large canvas size could stall a render if regenerated per draw | medium | mitigate | Build once into the content-keyed Map; getProjectPaperCanvas returns the cached canvas; pin asserts repeat calls return the identical object (no rebuild) |
| T-261017-IWM-04 | Tampering | transliterating playground GLSL would violate the P1 clean-room fence | medium | mitigate | Task actions take numbers and laws only (PAPER_REFERENCE_HEIGHT, bump/mottle table); no shader file is opened for copy; scope fence listed in objective |
| T-261017-IWM-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface, so no legitimacy checkpoint is required |

</threat_model>

<verification>
- Scale law: `pnpm --filter @efxlab/efx-watercolor exec vitest run src/papers/papers.test.ts` — default-stable hashes, 1100 frequency scaling, no 256-repeat at 512.
- Fond path: `pnpm --filter efx-motion-editor exec vitest run src/lib/projectPaperRaster.test.ts` — no tiling, canvas-size-invariant feature size, bump/mottle, cache identity, jpg arm unchanged.
- Non-regression: `pnpm --filter efx-motion-editor exec vitest run src/lib/paperPass.test.ts` (if present) and the existing projectPaperRaster grain-scale pins stay green; run with vitest run, never watch.
- Guardrail audit: `git diff SPECS/` empty; `git diff app/src/components/physic-paint/view/PaperPicker.tsx` empty; `git diff app/src/lib/paperPass.ts` empty; `git diff packages/efx-watercolor/src/bake/` empty; `git diff app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` empty; `git diff app/package.json packages/efx-watercolor/package.json` empty.
- One atomic commit only (not one per task).
- Status stays automated-ready until the user judges the live UAT rows (no server started by the executor).
</verification>

<success_criteria>
- No tile repetition anywhere in the fond (pin: a WxH field is not a repeated 256 tile — column 0 differs from column 256 at 512).
- Feature size is canvas-size-invariant (pin: frequency scales with output height / 1100; 512 vs 1024 show comparable physical feature size).
- Per-paper bump/mottle honoured (cold vs hot bump; washi vs student mottle).
- Cached by content key — two calls with the same key return the identical object; no per-render regeneration.
- `pnpm vitest run` green for the touched suites.
- One atomic commit (English conventional style).
- Live UAT (user-run, recorded in the SUMMARY — do not claim done before UAT):
  1. Open the editor with a procedural paper (Cold Press) selected → the fond is one continuous paper: no visible tile grid, no seams, at default and large canvas sizes.
  2. Tooth feature size matches the playground paper preview at the same zoom — not zoomed-in blobs, not invisible micro-grain. Cold Press vs Rough side by side: Rough reads clearly coarser.
  3. Change paper → the fond changes; no stale tile grid from the previous paper.
  4. A non-watercolor stroke and a watercolor stroke still sit on the same continuous fond.
  5. Save → close → reopen → same paper, same continuous fond.
  6. Console clean.
</success_criteria>

<output>
Create `.planning/quick/261017-iwm-fix-visible-tiling-and-wrong-scale-of-th/261017-iwm-SUMMARY.md` when done (`status: complete` in SUMMARY frontmatter). Record the live UAT rows in the SUMMARY — do not claim done before UAT.
</output>
