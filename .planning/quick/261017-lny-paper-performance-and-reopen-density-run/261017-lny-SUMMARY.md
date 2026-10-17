---
phase: quick-261017-lny
plan: 261017-lny
subsystem: efx-watercolor
tags: [webgl2, glsl, paper, watercolor, fond, performance, density]

# Dependency graph
requires:
  - phase: quick-261017-ki6
    provides: playgroundPaperField TS port (CPU) + procedural fond wiring
  - phase: quick-261017-iwm
    provides: continuous procedural fond at WxH with PAPER_REFERENCE_HEIGHT scale law
provides:
  - paperFieldGl.ts — offscreen WebGL2 host running the playground paper GLSL verbatim
  - GPU-first fond build with CPU port as no-WebGL fallback
  - opaque-sheet draw arm (alpha 1, no white under-fill) for procedural paperColour sheets
  - thumbnail gate widened so paper/* ids paint the sheet under the script
affects: [efx-watercolor, physic-paint, paper library, studio fond]

actuals:
  tokens: 10400
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "GPU-first / CPU-fallback sheet render (glMotionBlur lazy offscreen WebGL2 shape)"
    - "Oracle GLSL copied verbatim into an app host — no re-derivation"

key-files:
  created:
    - app/src/lib/paperFieldGl.ts
    - app/src/lib/paperFieldGl.test.ts
  modified:
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts

key-decisions:
  - "Run the playground GLSL (paperFieldFS / paperLightFS / PAPER_COLOUR + toSRGB) on offscreen WebGL2 instead of re-deriving or redesigning the shader"
  - "RGBA16F field target with RGBA8 fallback; never throw into the Studio — renderPaperSheetGl returns null and the CPU port fills in"
  - "Procedural paperColour sheets draw at globalAlpha = 1 with no white under-fill; white + 0.18 stays only for the real-jpg arm"

requirements-completed: []

coverage:
  - id: D1
    description: "GPU paper fond via playground GLSL (one pass per paper/size/grainScale)"
    verification:
      - kind: unit
        ref: "app/src/lib/paperFieldGl.test.ts (GLSL source-scan, null-on-failure, CPU export)"
        status: pass
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts (GPU-preferred / CPU-fallback routing, cache hit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full-density procedural sheet under paint (opaque arm + thumbnail gate)"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts (opaque arm alpha 1, jpg arm white+0.18)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts (paper/* paints sheet)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live UAT — speed, look parity, density on reopen, jpg arm unchanged"
    verification: []
    human_judgment: true
    rationale: "Look and speed of the procedural paper are human-judged against SPECS ground-truth PNGs and the live Studio; the executor does not start the server."

duration: 25min
completed: 2026-10-17
status: complete
---

# Quick 261017-lny: Paper performance + reopen density Summary

**Playground paper GLSL now runs on offscreen WebGL2 (one GPU pass per sheet), and procedural sheets keep full density under paint on reopen.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2

## Accomplishments

- Created `app/src/lib/paperFieldGl.ts` — offscreen WebGL2 host embedding the oracle GLSL verbatim (`HEADER`, `paperFieldFS`, `paperLightFS`, `PAPER_COLOUR`, `TO_SRGB`, plus a tiny colour `main()` at `uTexture = 1`). Follows the `glMotionBlur.ts` lazy shared context shape; `glMotionBlur.ts` untouched.
- Three-pass pipeline matching `Engine.ts drawPaper` + `paperUniforms` + `paperSwatch` y-flip: field (RGBA16F, RGBA8 fallback) → light (`uBump = (preset.bump * 1.4) / scale`) → colour + toSRGB → `readPixels` RGBA8.
- `buildProceduralPaperFond` prefers `renderPaperSheetGl`, falls back to the CPU `renderPaperSheet` on null. Cache key `paperId|1|WxH|grainScale` unchanged — repeat is a hit, not a re-render. PaperPicker thumbs stay on the CPU port.
- `drawProjectPaperRaster` gained an explicit `opaqueSheet` arm: `globalAlpha = 1`, no white under-fill, no `createPattern`. White + 0.18 stays only for the real-jpg arm (`paper/real-1..3` / `canvas1..3`).
- Thumbnail gate widened from `startsWith('canvas')` to `canvas*` + `paper/*` so procedural (and real) papers paint the sheet under the script instead of a flat wash.
- Live and reopen/hydrate fond paths both resolve through `getProjectPaperCanvas` → `buildProceduralPaperFond` → `drawMissingRotoBackground(paperCanvas)` at full alpha — same helper, cannot diverge.

## Deviations from Plan

None — plan executed as written.

## Pin coverage

| Pin | Where |
|-----|-------|
| GLSL constants (`uBump`, `1.3`, `0.25`, `mat2(0.8, -0.6, 0.6, 0.8)`) survive | `paperFieldGl.test.ts` source-scan |
| `renderPaperSheetGl` returns null (never throws) without WebGL2 | `paperFieldGl.test.ts` |
| CPU `renderPaperSheet` still exported and reachable | `paperFieldGl.test.ts` |
| GPU preferred / CPU fallback routing | `projectPaperRaster.test.ts` (stubbed `renderPaperSheetGl`) |
| Repeat (paper, W, H, grainScale) is a cache hit | `projectPaperRaster.test.ts` |
| Opaque arm: alpha 1, no white `fillRect` | `projectPaperRaster.test.ts` |
| jpg arm keeps white + 0.18 | `projectPaperRaster.test.ts` |
| `paper/*` thumbnail paints the sheet | `physicsPaintRotoScriptThumbnail.test.ts` |

## Verification

- `pnpm vitest run` in `app/`: **5192 passed**, 1 skipped, 96 todo
- `pnpm vitest run` in `packages/efx-watercolor/`: **155 passed**, 4 skipped
- New tests ran and passed (paperFieldGl 5, projectPaperRaster 27, thumbnail 4)

## Live UAT rows (user-judged; executor does not start the server)

1. **Speed:** open PHYSIC PAINT STUDIO with a procedural paper → fond appears immediately (no multi-second wait). Change Cold Press → Rough → Khadi in a row → each change immediate, no spinner.
2. **Look unchanged:** Cold Press still matches `SPECS/v1.1.0-water-color/paper/cold press.png` (fine crisp grain, no tile grid).
3. **Density on reopen:** watercolor wash on a dense paper (e.g. Khadi) → save → close Studio → reopen → paper under the paint is the same density as before closing (screenshot 52's washed-out white gone).
4. **Live vs reopen consistency:** with and without paint, the paper reads the same density.
5. **Real jpgs unchanged:** `paper/real-1..3` still render as the subtle grain-over-white overlay (0.18 treatment survives for that arm only).
6. **Save → reopen → same paper, same density, same look.** Console clean.

## Self-Check: PASSED

- `app/src/lib/paperFieldGl.ts` FOUND
- `app/src/lib/paperFieldGl.test.ts` FOUND
- `app/src/lib/projectPaperRaster.ts` FOUND
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts` FOUND
- Commit `a7eaf78a` FOUND (ancestor of HEAD)
