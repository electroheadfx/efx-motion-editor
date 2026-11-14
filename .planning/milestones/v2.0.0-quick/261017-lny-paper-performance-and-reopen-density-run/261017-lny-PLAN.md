---
phase: quick-261017-lny
plan: 261017-lny
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/paperFieldGl.ts
  - app/src/lib/paperFieldGl.test.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/lib/projectPaperRaster.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
autonomous: true
requirements: []

estimate:
  tokens: 48000
  raw_tokens: 34000
  tasks: 2
  confidence: med

must_haves:
  truths:
    - "Studio open with a procedural paper and a paper change are near-instant: the fond's heavy lifting is one WebGL2 pass + one readback, not a CPU per-pixel loop over the full sheet."
    - "The GPU path runs the playground GLSL sources (paperFieldFS / paperLightFS / PAPER_COLOUR + toSRGB) — the look the CPU port just got right is unchanged."
    - "A procedural paper under paint stays full density on reopen: no white under-fill, no 0.18 overlay on an opaque paperColour sheet."
    - "The real-jpg arm (paper/real-1..3) keeps the subtle grain-over-white overlay."
    - "A repeat of the same (paper, W, H, grainScale) is a cache hit, not a re-render."
  artifacts:
    - app/src/lib/paperFieldGl.ts
    - app/src/lib/paperFieldGl.test.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
  key_links:
    - "paperFieldGl.ts is the GPU host for the oracle GLSL — paperFieldFS / paperLightFS / PAPER_COLOUR text survives there verbatim; playgroundPaperField.ts stays the CPU fallback and the constants source of truth."
    - "buildProceduralPaperFond (projectPaperRaster.ts) is the one fond seam every surface already calls (physicPaintStore flatten, rotoPlaybackBackground, thumbnails) — route the sheet build through the GPU entry there and Studio open / paper change / reopen all follow."
    - "drawProjectPaperRaster keeps white + 0.18 for the jpg arm only; an opaque procedural sheet draws at alpha 1 with no white under-fill on every seam that paints paper under paint."
---

<objective>
Make the procedural paper fond instant (run the playground GLSL on the GPU instead of the CPU per-pixel port) and stop the paper washing out to white on reopen under paint.

Two live-UAT bugs on `71ea1277` (2026-10-17), both already located:

1. **Performance.** `packages/efx-watercolor/src/papers/playgroundPaperField.ts` `renderPaperSheet` evaluates the transliterated `paperFieldFS` / `paperLight` / `paperColourSRGB` over every fond pixel (2M+ at 1080p, multi-octave noise with nested 5x5 loops). The playground is instant because the same math runs as GLSL fragment shaders over the target (`SPECS/v1.1.0-water-color/watercolor-playground/src/engine/Engine.ts` `drawPaper`, shaders in `.../engine/shaders.ts`). Required: offscreen WebGL2 running their shader sources essentially verbatim. Do not rewrite the shader again.

2. **Density on reopen.** An opaque `paperColour` sheet (alpha 255, carrying `preset.tint`) is being drawn with the real-jpg overlay treatment — white under-fill + `globalAlpha = 0.18` — which destroys its density (screenshot 52 washed-out vs screenshot 53 dense). Required: the procedural arm draws at `globalAlpha = 1` with no white under-fill; the white + 0.18 treatment stays only for `paper/real-1..3`. Live and reopen must end at the same full-density paper.

Purpose: the user cannot judge watercolour on a multi-second stall or a paper that flashes white under the paint. The look is already right — this quick only moves the work to the GPU and fixes the draw alpha.

Output: `app/src/lib/paperFieldGl.ts` (GLSL host + `renderPaperSheetGl`), the fond routed through it with the CPU port as fallback, the procedural/jpg draw-alpha split, and pin tests.

## The oracle — what to run, not redesign

**Read-only.** `SPECS/v1.1.0-water-color/watercolor-playground/src/engine/shaders.ts` and `Engine.ts`. Do not edit anything under `SPECS/v1.1.0-water-color/`.

Embed in `paperFieldGl.ts` (copied, not re-derived):

- `HEADER` (the `#version 300 es` + `vUv` prelude at the top of `shaders.ts`)
- `paperFieldFS` (~274-488) — primitives + 10 kinds + `main()` coordinate law `p = (vUv * uRes + uOffset) * uScale`
- `paperLightFS` (~493-507) — neighbour normal, `uBump`, `L = normalize(vec3(-0.5, 0.6, 0.62))`, `lit = 0.5 + (dot(n, L) - L.z) * 1.3 + (f.x - 0.5) * 0.25`
- `PAPER_COLOUR` + `TO_SRGB` (~510-524) — a tiny `main()` that outputs `toSRGB(paperColour(paper, uPaperTint))` at `uTexture = 1` (the `paperSwatchFS` body minus the ultramarine wash; the CPU `renderPaperSheet` already ends at `paperColourSRGB(..., textureStrength = 1)`)

Call-site constants (Engine.ts `drawPaper` / `paperUniforms`):

- `uBump = (preset.bump * 1.4) / scale`
- `uOffset = [0, 0]` for the full-sheet fond
- `uScale = PAPER_UNITS / (height * grainScale)` with `PAPER_UNITS = 1100`
- `uSeed = 1` (the existing cache-key seed term)
- `linearRGB` of `preset.tint` / `preset.fleck`, `preset.mottle`, `uTexture = 1`
- readback is RGBA8 with the playground's y-flip (`Engine.ts` `paperSwatch` tail)

## GL pattern to follow

`app/src/lib/glMotionBlur.ts` — lazy shared offscreen WebGL2 (`getGL` ~line 80), `compileShader` / `createProgram`, draw into a framebuffer, `readPixels`. `app/src/lib/fxBlur.ts` is the "try GPU first, fall back to CPU" shape. Do not invent a third pattern; do not edit `glMotionBlur.ts` (keep its context private to the blur). A local lazy `getGL` in the same shape is correct.

If `RGBA16F` render targets are unavailable, fall back to `RGBA8` for the field texture (the final output is 8-bit sRGB anyway). Never throw into the Studio when WebGL2 / float targets / compile fail — return `null` and let the CPU port fill in (`AquarelleCanvasLayer.tsx` precedent: no WebGL2 leaves the surface blank rather than crashing).

## Scope fence

- DO run the playground GLSL. The playground is MIT and vendored in-repo; the user has explicitly demanded we stop re-deriving. Do NOT redesign the shader.
- DO NOT edit `SPECS/v1.1.0-water-color/watercolor-playground/**` or `SPECS/v1.1.0-water-color/paper/*.png`.
- DO NOT change `PaperPicker.tsx` `CELL_SIZE = 64` / `GRID_GAP = 8` / 3-column grid (UI-SPEC locked). Thumbs may stay on the CPU `renderPaperSheet` (64x64 = 4096 px, cheap).
- DO NOT change the aquarelle bake / cache-key string shape from `20f9dfdc`.
- DO NOT touch `PhysicsPaintTopBar.tsx` / `PhysicsPaintRightPanel.tsx`.
- DO NOT change the paper validator work from `1876f4b3`.
- Do NOT delete `playgroundPaperField.ts` — it is the no-WebGL fallback and the constants source of truth.
- No new dependencies (WebGL2 is a platform API). No jpeg conversion.
- Do NOT tick any TODO row in `SPECS/v1.1.0-water-color/phase-55-issues/index.md`.
- Chunk budget viteBuild 2 MO ceiling — no new deps, no heavy new bundle surface.

## Project constraints

- Preact + @preact/signals only (this quick is lib code; no new components). No `useState`. No `useEffect` for selection.
- `pnpm`, never `npm`. `pnpm vitest run` — never watch.
- Vitest only collects `*.test.ts` — new tests MUST be `.test.ts`.
- No backward-compat shims. One file per visual unit.
- Commit message in English, conventional style. **Never push.** Local commit only.
- If `git commit` reports `.git/index.lock`: `lsof .git/index.lock`; if nothing holds it, `rm -f .git/index.lock` and retry.

</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@app/src/lib/projectPaperRaster.ts
@app/src/lib/glMotionBlur.ts
@app/src/lib/fxBlur.ts
@app/src/lib/rotoFrameDraw.ts
@packages/efx-watercolor/src/papers/playgroundPaperField.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: GPU paper fond via the playground GLSL</name>
  <files>app/src/lib/paperFieldGl.ts, app/src/lib/paperFieldGl.test.ts, app/src/lib/projectPaperRaster.ts, app/src/lib/projectPaperRaster.test.ts</files>
  <behavior>
    - Source-scan: paperFieldGl.ts carries the oracle GLSL text (paperFieldFS / paperLightFS / PAPER_COLOUR / TO_SRGB) with uBump, 1.3, 0.25, and mat2(0.8, -0.6, 0.6, 0.8) surviving.
    - renderPaperSheetGl returns null (never throws) when WebGL2 / shader compile / render-target setup fails.
    - CPU fallback entry (renderPaperSheet) remains exported and reachable.
    - buildProceduralPaperFond prefers the GPU entry and falls back to the CPU port.
    - Repeat (paper, W, H, grainScale) is a proceduralFondCache hit — one build, not one per call.
  </behavior>
  <action>
Create `app/src/lib/paperFieldGl.ts` as the offscreen WebGL2 host for the playground paper shaders (Bug 1).

1. Embed the oracle GLSL verbatim from `SPECS/v1.1.0-water-color/watercolor-playground/src/engine/shaders.ts`: `HEADER`, `paperFieldFS`, `paperLightFS`, `PAPER_COLOUR`, `TO_SRGB`, plus a tiny colour `main()` that writes `toSRGB(paperColour(paper, uPaperTint))` at `uTexture = 1`. Do not tidy, re-derive, or "simplify" any constant — these bytes are the look.

2. Follow the `glMotionBlur.ts` lazy-offscreen-WebGL2 shape (local `getGL`, `compileShader` / `createProgram`, framebuffer + `readPixels`). Leave `glMotionBlur.ts` untouched.

3. Export `renderPaperSheetGl(width, height, scale, seed, preset): Uint8ClampedArray | null` matching `renderPaperSheet`'s signature/semantics:
   - pass 1 `paperFieldFS` into a `HALF_FLOAT_RGBA` target (`RGBA8` fallback if float targets are missing — the output is 8-bit sRGB anyway)
   - pass 2 `paperLightFS` with `uBump = (preset.bump * 1.4) / scale`, `uTexel = (1/w, 1/h)`
   - pass 3 colour + toSRGB with `linearRGB(preset.tint)` / `linearRGB(preset.fleck)` / `preset.mottle` / `uTexture = 1` (reuse the package's `linearRGB` / presets — do not re-port the table)
   - `readPixels` RGBA8, y-flip like the playground `paperSwatch` tail
   - `uOffset = [0, 0]`, `uSeed = 1`, `uScale` already computed by the caller
   - any GL failure returns `null` (never throws into the Studio)

4. In `app/src/lib/projectPaperRaster.ts` `buildProceduralPaperFond`: call `renderPaperSheetGl` first; on `null`, fall back to the existing CPU `renderPaperSheet`. Keep the `proceduralFondCache` content key `paperId|1|WxH|grainScale` exactly as today so a repeat is a hit. PaperPicker keeps the CPU `renderPaperSheet` (thumbs stay cheap).

5. Pins in `app/src/lib/paperFieldGl.test.ts` (`*.test.ts`): source-scan the GLSL constants listed in `<behavior>`; assert the null-on-no-GL contract (inject a fake where `getContext('webgl2')` is unavailable); assert the CPU fallback symbol is still exported from the package entry.

6. Extend `app/src/lib/projectPaperRaster.test.ts` with a cache-hit pin (same key twice → one build) and a GPU-preferred / CPU-fallback routing pin (stub `renderPaperSheetGl` to a known sheet vs `null`).
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/paperFieldGl.test.ts src/lib/projectPaperRaster.test.ts && pnpm --filter @efxlab/efx-watercolor exec vitest run src/papers/playgroundPaperField.test.ts</automated>
  </verify>
  <done>paperFieldGl.ts hosts the oracle GLSL and exposes renderPaperSheetGl with a never-throw null fallback; buildProceduralPaperFond prefers GPU then CPU; proceduralFondCache still hits on repeat (paper, W, H, grainScale); PaperPicker thumbs unchanged on the CPU port; pins green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Full-density procedural paper under paint</name>
  <files>app/src/lib/projectPaperRaster.ts, app/src/lib/projectPaperRaster.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts</files>
  <behavior>
    - The procedural / opaque-sheet arm draws at globalAlpha = 1 with no white under-fill.
    - The real-jpg arm (paper/real-1..3) still records white fill then a pattern at alpha 0.18.
    - A procedural paper id in a roto thumbnail paints the sheet, not a flat fill under the paint.
    - Live fond and reopen/hydrate fond resolve through the same full-density helper.
  </behavior>
  <action>
Fix Bug 2 — the procedural sheet must never take the real-jpg overlay treatment.

1. In `app/src/lib/projectPaperRaster.ts`, give `drawProjectPaperRaster` an explicit opaque-sheet arm: when the source is a procedural `paperColour` sheet (branch on `isProceduralPaperTexture` / an explicit opaque-sheet flag from the caller — pick the seam that keeps the jpg call sites byte-identical), draw at `globalAlpha = 1` with **no** white under-fill and no `createPattern` repeat. The white-fill + `globalAlpha = 0.18` pattern treatment stays **only** for the real-jpg arm (`paper/real-1..3` / `canvas1..3`). Route `buildProceduralPaperFond`'s output through that opaque arm if the sheet is drawn via `drawProjectPaperRaster`; if it keeps using `putImageData`, the opaque arm must still exist so any future/shared draw site cannot silently apply the jpg overlay.

2. In `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts`, the paper is only drawn when `background.startsWith('canvas')` after a white/color fill — procedural `paper/*` ids fall through and leave paint on a flat wash. Widen that gate to the procedural library ids (reuse `isProceduralPaperTexture` / `getProjectPaperCanvas`, which already returns the opaque sheet) so the thumbnail paints the real sheet under the script alpha.

3. Walk the reopen/hydrate path against the live path (`physicPaintStore._resolveFlattenedFrame` fond step, `rotoPlaybackBackground` / `PhysicsPaintRotoPlaybackBackground`, `drawMissingRotoBackground`) and confirm both end at the same full-density paper for a procedural id. `drawMissingRotoBackground`'s `paperCanvas` arm already draws at full alpha — if any caller still hands it a raw texture and takes the 0.18 arm for a procedural id, fix that caller. Do not change the jpg 0.18 behaviour.

4. Pins in `app/src/lib/projectPaperRaster.test.ts`: (a) the opaque-sheet arm records `globalAlpha = 1` and no white `fillRect` before the sheet draw; (b) the jpg arm still records white fill + pattern at 0.18 (keep the existing pin honest); (c) a source-scan that the procedural branch is reachable from `getProjectPaperCanvas`. Add a thumbnail-gate pin (`.test.ts`) that a `paper/*` id draws the sheet rather than only the flat fill.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/projectPaperRaster.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts</automated>
  </verify>
  <done>Procedural sheets draw full density (alpha 1, no white under-fill) on every paper-under-paint seam including thumbnails; the jpg arm keeps white + 0.18; live and reopen fond paths share the same helper; pins green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter efx-motion-editor exec vitest run src/lib/paperFieldGl.test.ts src/lib/projectPaperRaster.test.ts` green
- `pnpm --filter @efxlab/efx-watercolor exec vitest run src/papers/playgroundPaperField.test.ts src/papers/papers.test.ts` green
- Full suites: `pnpm vitest run` in `app/` and in `packages/efx-watercolor/` (never watch)
- Source-scan: GLSL constants survive in `app/src/lib/paperFieldGl.ts`
- One atomic conventional commit (English). Never push.
</verification>

<success_criteria>
- The fond's heavy lifting runs on WebGL2 using the playground shader sources (pin: `uBump`, `1.3`, `0.25`, `mat2(0.8, -0.6, 0.6, 0.8)` present in `app/src/lib/paperFieldGl.ts`).
- CPU port remains the no-WebGL fallback (pin: `renderPaperSheet` still exported and called when `renderPaperSheetGl` returns null).
- Procedural arm draws at alpha 1 with no white under-fill; jpg arm keeps white + 0.18 (pin).
- Cache: repeat of the same (paper, W, H, grainScale) is a hit (pin).
- `pnpm vitest run` green in `app/` and `packages/efx-watercolor/`.
- Status stays automated-ready until the user judges the live UAT rows below (executor does not start the server).

Live UAT rows (record in the SUMMARY; the user runs them):
1. Speed: open PHYSIC PAINT STUDIO with a procedural paper → fond appears immediately (no multi-second wait). Change Cold Press → Rough → Khadi in a row → each change immediate, no spinner.
2. Look unchanged: Cold Press still matches `SPECS/v1.1.0-water-color/paper/cold press.png` (fine crisp grain, no tile grid).
3. Density on reopen: watercolor wash on a dense paper (e.g. Khadi) → save → close Studio → reopen → paper under the paint is the same density as before closing (screenshot 52's washed-out white gone).
4. Live vs reopen consistency: with and without paint, the paper reads the same density.
5. Real jpgs unchanged: `paper/real-1..3` still render as the subtle grain-over-white overlay (0.18 treatment survives for that arm only).
6. Save → reopen → same paper, same density, same look. Console clean.
</success_criteria>

<output>
Create `.planning/quick/261017-lny-paper-performance-and-reopen-density-run/261017-lny-SUMMARY.md` when done
</output>
