---
phase: quick-261017-nnu
plan: 261017-nnu
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/papers/library.ts
  - packages/efx-watercolor/src/papers/index.ts
  - packages/efx-watercolor/src/papers/papers.test.ts
  - app/src/lib/enginePaperSheet.ts
  - app/src/lib/enginePaperSheet.test.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/lib/projectPaperRaster.test.ts
  - app/src/lib/paperPass.ts
  - app/src/components/physic-paint/view/PaperPicker.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
autonomous: true
requirements: []

estimate:
  tokens: 48000
  raw_tokens: 32000
  tasks: 3
  confidence: med

must_haves:
  truths:
    - "Exactly one paper field generator remains in the repo: the vendored WatercolorEngine.drawPaper GPU path."
    - "The document fond and the PaperPicker 64x64 thumbs are produced by that same engine shader family, so they show the same paper."
    - "The fond sheet carries PAPER_COLOUR + TO_SRGB only — the ultramarine picker wash is a swatch-only treatment and never reaches the document."
    - "A repeated request for the same (paper, w, h, scale) returns the cached canvas immediately — no second GPU pass."
    - "Real jpg papers (paper/real-1..3, canvas1..3) keep their existing grain-over-white arm untouched."
  artifacts:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - app/src/lib/enginePaperSheet.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/paperPass.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx
  key_links:
    - "Engine.paperSheet is the single sheet entry (fond + thumbs); Engine.paperHeight is the single height entry (paperPass tooth)."
    - "app/src/lib/enginePaperSheet.ts is a thin offscreen-engine host + Map cache — it must never contain field maths or GLSL."
    - "papers/index.ts keeps re-exporting PAPER_UNITS / PAPER_PRESETS / presetForPaperId from library.ts after playgroundPaperField.ts is deleted, so consumer import paths stay stable."
---

<objective>
Delete the duplicate paper subsystem this session built and render paper with the already-vendored MIT `WatercolorEngine` (`packages/efx-watercolor/src/playground/Engine.ts`). The engine's `drawPaper` already draws the paper on the GPU in real time — that is the property two hand-rolled ports failed to reproduce.

Direction locked by the user 2026-10-17, option (a): expose `drawPaper` and take the paper from the engine. One visibility change in their class plus one small sibling method. Do not design anything new.

The only new code is `paperSheet` / `paperHeight` on the engine (cloned from the existing `paperSwatch` readback shape) plus a thin content-keyed cache host. Everything else is deletion and re-pointing.

Purpose: one paper generator, their working GPU code, no second subsystem.

Output: public `drawPaper`, `paperSheet` + `paperHeight` on the engine, a no-wash sheet shader sibling, consumers on the engine, the duplicate modules gone.

## Scope fence

- DO modify `packages/efx-watercolor/src/playground/Engine.ts` minimally (`drawPaper` visibility + `paperSheet` + `paperHeight`) and add a tiny `paperSheetFS` sibling in `shaders.ts`.
- DO NOT redesign `paperFieldFS` / `paperLightFS` / `paperSwatchFS` — leave their maths alone.
- DO NOT edit `SPECS/v1.1.0-water-color/watercolor-playground/**` or `SPECS/v1.1.0-water-color/paper/*.png`.
- DO NOT change `PaperPicker.tsx` grid constants (`CELL_SIZE = 64` / `GRID_GAP = 8` / 3-column grid).
- DO NOT change the aquarelle bake / cache-key string shape from `20f9dfdc`.
- DO NOT touch `PhysicsPaintTopBar.tsx` / `PhysicsPaintRightPanel.tsx`.
- DO NOT redesign `_resolveFlattenedFrame`'s composite.
- No new dependencies. No Web Worker. No new field maths. No re-export shim for deleted modules.
- Do NOT tick any TODO row in `SPECS/v1.1.0-water-color/phase-55-issues/index.md`.
- If `paperSheet` at fond size is slower than the UI can absorb, record the measured duration in the SUMMARY — do not build another subsystem to hide it.

## Claude's Discretion (recorded)

- `paperSheet` / `paperHeight` take an optional 4th `scale` (paper units per texel) defaulting to `PAPER_UNITS / height` (the sheet law). Thumbs keep their existing zoom window by passing `PAPER_UNITS / 256`; the fond and the bake tooth pass their existing grain-scaled law. A 3-arg-only signature would force the 64x64 thumbs onto a full-sheet zoom and change the locked thumb look.
- The wash-free presentation is a sibling `paperSheetFS` (`PAPER_COLOUR` + `TO_SRGB`) rather than a uniform on `paperSwatchFS`, because the swatch shader is out of scope for redesign.
- Glue host file `app/src/lib/enginePaperSheet.ts` holds one lazily constructed offscreen `WatercolorEngine` plus `Map` caches — a map over `engine.paperSheet`, not a generator.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@packages/efx-watercolor/src/playground/Engine.ts
@packages/efx-watercolor/src/playground/shaders.ts
@packages/efx-watercolor/src/papers/playgroundPaperField.ts
@packages/efx-watercolor/src/papers/library.ts
@packages/efx-watercolor/src/papers/index.ts
@packages/efx-watercolor/src/playground/papers.ts
@app/src/lib/projectPaperRaster.ts
@app/src/lib/paperPass.ts
@app/src/components/physic-paint/view/PaperPicker.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expose engine paperSheet + paperHeight (the only new code)</name>
  <files>packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/shaders.ts</files>
  <action>
In `packages/efx-watercolor/src/playground/Engine.ts`, next to `paperSwatch` (~line 912), make `drawPaper` public and add two methods that clone `paperSwatch`'s allocation / draw / readPixels / y-flip tail exactly.

1. `private drawPaper` becomes `drawPaper` (visibility only — body untouched).

2. Add sibling shader `paperSheetFS` in `packages/efx-watercolor/src/playground/shaders.ts` immediately after `paperSwatchFS`. It is `HEADER` + `out vec4 o` + `uniform sampler2D uPaper` + the existing private `PAPER_COLOUR` + `TO_SRGB` snippets, and `void main` samples `uPaper`, runs `paperColour(paper, uPaperTint)`, then `o = vec4(toSRGB(c), 1.0)`. Register it as `paperSheet: this.g.program(S.paperSheetFS)` in the `programs` object beside `paperSwatch`. Per D-option-a this presentation must not carry the swatch's granulating corner treatment (that lives only in `paperSwatchFS`).

3. `paperSheet(preset: PaperPreset, width: number, height: number, scale = PAPER_UNITS / height): HTMLCanvasElement` — same body shape as `paperSwatch`: `g.target(width, height, [RGBA8], gl.LINEAR)` for the paper, `g.target(width, height, [RGBA8], gl.NEAREST)` for out, then `this.drawPaper(paper, [0, 0], scale, preset)` (sheet origin, caller-supplied scale — not `paperSwatch`'s diagonal offset), bind `paperSheet` program + `uPaper`, `this.paperUniforms(s, preset, 1)`, `g.draw(out)`, `readPixels` into `Uint8Array`, dispose both targets, y-flip into a new `document.createElement('canvas')`. Return that canvas. Total on non-positive / non-finite width, height, or scale: throw a clear `RangeError` at the door (same domain-door style as `HOST_TICK_HZ` elsewhere) rather than allocating a broken target.

4. `paperHeight(preset: PaperPreset, width: number, height: number, scale = PAPER_UNITS / height): Float32Array` — run the same `drawPaper` into a `g.target(width, height, [RGBA8], gl.LINEAR)`, `readPixels` once, and emit a `Float32Array` of `width * height` holding the packed height channel of `paperLightFS` (texel is `(lit, height, mottle, fleck)`, so the height is the green byte / 255). Dispose the target. Same `RangeError` door.

Do not touch `paperFieldFS`, `paperLightFS`, or `paperSwatchFS` bodies. Do not add helpers beyond these two methods + one shader string.
  </action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts && rg -n "paperSheetFS|paperSheet\(|paperHeight\(|  drawPaper\(" packages/efx-watercolor/src/playground/Engine.ts packages/efx-watercolor/src/playground/shaders.ts | rg -v "private drawPaper"</automated>
  </verify>
  <done>`drawPaper` has no `private` modifier; `paperSheet` / `paperHeight` exist on `WatercolorEngine` with the `scale` default; `paperSheetFS` is registered and its source ends at `toSRGB` without a corner-treatment mix; `paperSwatchFS` / `paperFieldFS` / `paperLightFS` bodies are byte-unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Retarget fond, thumbs, and bake tooth onto the engine</name>
  <files>app/src/lib/enginePaperSheet.ts, app/src/lib/enginePaperSheet.test.ts, app/src/lib/projectPaperRaster.ts, app/src/lib/projectPaperRaster.test.ts, app/src/lib/paperPass.ts, app/src/components/physic-paint/view/PaperPicker.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts</files>
  <action>
Create the thin host and point the three real consumers at the engine. No field maths, no GLSL, no worker.

1. New `app/src/lib/enginePaperSheet.ts` — the allowed thin cache over `engine.paperSheet` / `engine.paperHeight`:
   - One lazily constructed offscreen `WatercolorEngine` (a detached `document.createElement('canvas')` + `new WatercolorEngine(canvas, null, {}, [1, 1])`, reused for every call; the methods allocate their own targets). Map studio paper id to playground `PaperPreset` via the existing `STUDIO_PAPER_TO_PRESET` / `PAPERS` / `DEFAULT_PAPER` map already exported from `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` (`paperPresetForStudioId`) — import that helper, do not copy the table. Real ids (`paper/real-1..3`, `canvas*`) return null so the jpg arm stays the caller's business.
   - `getEnginePaperSheet(studioPaperId, width, height, scale): HTMLCanvasElement | null` — `Map` cache keyed `${studioPaperId}|${width}x${height}|${scale}`; on miss call `engine.paperSheet(preset, width, height, scale)` and store the canvas. Repeat is a hit.
   - `getEnginePaperHeight(studioPaperId, width, height, scale): Float32Array | null` — same shape, own `Map`, calls `engine.paperHeight`.
   - `resetEnginePaperSheetForTests()` clears both maps + drops the engine.
   - Guard `typeof document === 'undefined'` / missing WebGL by returning null (the Studio must never throw from paper generation).

2. `app/src/lib/projectPaperRaster.ts` procedural arm: replace `requestProceduralSheet` with `getEnginePaperSheet(paperTexture, width, height, PAPER_UNITS / (height * normalized))`. Keep the existing `proceduralFondCache` key string byte-identical (`${paperTexture}|1|${width}x${height}|${normalized}` — pin from `20f9dfdc`). On a host hit the fond is available the same tick (no more null-then-notify flight); still call `notifyTextureListeners` when a new canvas is inserted so existing subscriptions recomposite. Real-jpg arm, `drawProjectPaperRaster`, and the grain-over-white treatment stay as they are. `normalizeGrainScale` can stay local or re-export from the host — one home only.

3. `app/src/components/physic-paint/view/PaperPicker.tsx`: `proceduralReliefImage` stops calling `renderPaperSheet` and instead `drawImage`s `getEnginePaperSheet(id, CELL_SIZE, CELL_SIZE, PAPER_UNITS / THUMB_WINDOW_UNITS)` into the cell canvas (keep the per-id ImageData or canvas cache so re-renders are hits). `warmProceduralReliefThumbs` keeps pre-filling that cache through the same host call. Grid constants untouched. Real cells keep the jpg path.

4. `app/src/lib/paperPass.ts` procedural tooth: replace `paperHeightMap(paperTexture, 1, width, height, PAPER_UNITS / (height * scale))` with `getEnginePaperHeight(paperTexture, width, height, PAPER_UNITS / (height * scale))`. `encodePassTiles` / tile cache / strength clamp / jpg arm untouched.

5. `app/src/components/physic-paint/PhysicsPaintStudio.tsx`: drop the `usePaperSheetWarmup` import and call (the engine path is the warm path). Do not grow inline warm-up logic.

6. `app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts`: the `paperHeightMapPresent` field has no writer — drop the field rather than rename it.

Tests: add `app/src/lib/enginePaperSheet.test.ts` covering cache-hit identity (two calls, same canvas reference) and null-on-unknown-id. Update `app/src/lib/projectPaperRaster.test.ts` / `app/src/lib/paperPass.test.ts` fixtures that currently stub the worker or `paperHeightMap` to stub `getEnginePaperSheet` / `getEnginePaperHeight` instead. New tests are `*.test.ts` only (vitest does not collect `.test.tsx`).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/lib/enginePaperSheet.test.ts app/src/lib/projectPaperRaster.test.ts app/src/lib/paperPass.test.ts app/src/lib/paperPass.composeLaw.test.ts app/src/lib/paperPass.frameGuard.test.ts</automated>
  </verify>
  <done>Fond, thumbs, and bake tooth all reach the engine through `app/src/lib/enginePaperSheet.ts`; the fond cache-key string is unchanged; real-jpg papers still use the grain-over-white arm; a second `getEnginePaperSheet` for the same key returns the identical canvas object; Studio no longer mounts `usePaperSheetWarmup`; `paperHeightMapPresent` is gone from the trace type.</done>
</task>

<task type="auto">
  <name>Task 3: Delete the duplicate paper subsystem and pin the single generator</name>
  <files>packages/efx-watercolor/src/papers/library.ts, packages/efx-watercolor/src/papers/index.ts, packages/efx-watercolor/src/papers/papers.test.ts, app/src/lib/enginePaperSheet.test.ts</files>
  <action>
Remove the hand-rolled machinery and leave one generator standing.

1. Relocate the still-live catalog out of `packages/efx-watercolor/src/papers/playgroundPaperField.ts` into `packages/efx-watercolor/src/papers/library.ts` (or a sibling `presets.ts` re-exported from `papers/index.ts`): `PAPER_UNITS`, `PROCEDURAL_PAPER_IDS`, `ProceduralPaperId`, `StudioPaperPreset`, `PAPER_PRESETS`, `presetForPaperId`. Consumer import path `@efxlab/efx-watercolor/papers` must keep resolving those names. Drop the CPU colour helpers and every generator with them.

2. Delete these modules and their tests (no re-export shim — the engine is the single source of truth):
   - `packages/efx-watercolor/src/papers/playgroundPaperField.ts`
   - `packages/efx-watercolor/src/papers/playgroundPaperField.test.ts`
   - `app/src/lib/paperFieldGl.ts` + `app/src/lib/paperFieldGl.test.ts`
   - `app/src/lib/paperSheet.worker.ts`
   - `app/src/lib/paperSheetField.ts` + `app/src/lib/paperSheetField.test.ts`
   - `app/src/lib/paperSheetClient.ts` + `app/src/lib/paperSheetClient.test.ts`
   - `app/src/lib/paperSheetWarmup.ts` + `app/src/lib/paperSheetWarmup.test.ts`
   - `app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts` + `app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts`

3. Trim `packages/efx-watercolor/src/papers/index.ts` to the surviving modules and fix `papers.test.ts`: keep the 13-paper library pins (adjacency, ordering, real-asset paths); delete the CPU-port generation pins (they tested the module being removed). Update any leftover import of a deleted name.

4. Add a small contract pin in `app/src/lib/enginePaperSheet.test.ts` (or a new `packages/efx-watercolor/src/papers/singlePaperGeneratorContract.test.ts`) that fails if any deleted module path is reintroduced under `app/src` / `packages/efx-watercolor/src`, and that reads `packages/efx-watercolor/src/playground/shaders.ts` asserting the `paperSheetFS` export's body has no `wash` mix (the swatch-only corner treatment stays confined to `paperSwatchFS`).
  </action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor run test && pnpm --filter efx-motion-editor exec vitest run app/src/lib/enginePaperSheet.test.ts app/src/lib/projectPaperRaster.test.ts app/src/lib/paperPass.test.ts && rg -l "playgroundPaperField|paperFieldGl|paperSheetField|paperSheetClient|paperSheetWarmup|paperSheet\.worker|renderPaperSheetGl|paperHeightMap\b" app/src packages/efx-watercolor/src | wc -l | rg -x "0"</automated>
  </verify>
  <done>Deleted module names appear nowhere under `app/src` or `packages/efx-watercolor/src`; `PAPER_UNITS` / `PAPER_PRESETS` / `presetForPaperId` still resolve from `@efxlab/efx-watercolor/papers`; the sheet path's shader text carries no corner-treatment mix; both package suites are green; one atomic conventional commit in English (never push).</done>
</task>

</tasks>

<verification>
- `pnpm --filter @efxlab/efx-watercolor run test` green.
- `pnpm --filter efx-motion-editor exec vitest run` green (use `vitest run`, never watch).
- Source scan: exactly one paper field generator — `WatercolorEngine.drawPaper` — and zero references to the deleted module names.
- Fond cache key string still `${paperTexture}|1|${width}x${height}|${normalized}`.
- `PaperPicker` still `CELL_SIZE = 64` / `GRID_GAP = 8` / 3 columns.
</verification>

<success_criteria>
- `drawPaper` is public; `paperSheet(preset, w, h, scale?)` and `paperHeight(preset, w, h, scale?)` exist and are the only sheet/height entries the app calls.
- Duplicate subsystem modules listed in Task 3 are gone; no shim re-exports them.
- Fond + thumbs + bake tooth all come from the engine; real jpgs unchanged.
- One atomic commit, local only.
- Live UAT rows below recorded in the SUMMARY (user-run).
</success_criteria>

<output>
Create `.planning/quick/261017-nnu-delete-the-duplicate-paper-subsystem-and/261017-nnu-SUMMARY.md` when done, including the live UAT rows:

1. **No freeze:** open the editor and Studio — the UI never freezes; the paper appears promptly. Record the measured `paperSheet` duration at fond size.
2. **Look:** Cold Press fond matches `SPECS/v1.1.0-water-color/paper/cold press.png` — fine crisp grain, no ultramarine corner treatment, no tile grid.
3. **Thumb = fond:** the PaperPicker 64x64 cell shows the same paper as the fond.
4. **Real scans unchanged:** `paper/real-1..3` still grain-over-white.
5. **Repeat is a hit:** A -> B -> A is instant.
6. Save -> reopen -> same paper, same density. Console clean.
</output>
