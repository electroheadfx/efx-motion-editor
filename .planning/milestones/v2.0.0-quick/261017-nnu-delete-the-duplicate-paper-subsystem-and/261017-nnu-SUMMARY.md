---
phase: quick-261017-nnu
plan: 261017-nnu
subsystem: efx-watercolor paper
tags: [paper, engine, cleanup, watercolor]
status: complete
requires: []
provides: [engine-paperSheet, engine-paperHeight, enginePaperSheet-host]
affects: [projectPaperRaster, paperPass, PaperPicker, PhysicsPaintStudio]
tech_stack:
  added: []
  patterns: [thin-map-cache-over-engine, sibling-shader-without-wash]
key_files:
  created:
    - app/src/lib/enginePaperSheet.ts
    - app/src/lib/enginePaperSheet.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/papers/library.ts
    - packages/efx-watercolor/src/papers/index.ts
    - packages/efx-watercolor/src/papers/papers.test.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
    - app/src/lib/paperPass.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts
  deleted:
    - packages/efx-watercolor/src/papers/playgroundPaperField.ts
    - packages/efx-watercolor/src/papers/playgroundPaperField.test.ts
    - app/src/lib/paperFieldGl.ts
    - app/src/lib/paperFieldGl.test.ts
    - app/src/lib/paperSheet.worker.ts
    - app/src/lib/paperSheetField.ts
    - app/src/lib/paperSheetField.test.ts
    - app/src/lib/paperSheetClient.ts
    - app/src/lib/paperSheetClient.test.ts
    - app/src/lib/paperSheetWarmup.ts
    - app/src/lib/paperSheetWarmup.test.ts
    - app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts
    - app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts
decisions:
  - "Vendored WatercolorEngine is the single paper generator (user directive 2026-10-17)."
  - "Wash-free sheet is a sibling paperSheetFS, not a uniform on paperSwatchFS."
  - "enginePaperSheet.ts is a Map cache over the engine — never a generator."
metrics:
  duration: ~25m
  completed: 2026-10-17
  tasks: 3
---

# Quick 261017-nnu: Delete the duplicate paper subsystem Summary

One-liner: The vendored MIT `WatercolorEngine` is now the only paper generator — `paperSheet`/`paperHeight` on the engine, a thin `Map` host, and the hand-rolled CPU/GL/worker ports deleted.

## Outcome

Exactly one paper field generator remains: `WatercolorEngine.drawPaper` (now public). Fond, PaperPicker thumbs, and the paperPass bake tooth all reach it through `app/src/lib/enginePaperSheet.ts`. The ultramarine wash is swatch-only and never reaches the document.

## Engine.ts diff (the only new code)

1. `private drawPaper` → `drawPaper` (visibility only; body untouched).
2. Registered `paperSheet: this.g.program(S.paperSheetFS)` beside `paperSwatch`.
3. `paperSheet(preset, width, height, scale = PAPER_UNITS / height): HTMLCanvasElement` — clones `paperSwatch`'s `g.target` / `drawPaper` / `paperUniforms` / `readPixels` / y-flip tail exactly, but:
   - offset `[0, 0]` (sheet origin, not the swatch diagonal)
   - caller-supplied `scale` (sheet law default)
   - `paperSheetFS` instead of `paperSwatchFS`
   - `RangeError` door on non-positive / non-finite width, height, or scale
4. `paperHeight(preset, width, height, scale = PAPER_UNITS / height): Float32Array` — one `drawPaper` into an RGBA8 target, `readPixels` once, green byte / 255 (packed texel is `(lit, height, mottle, fleck)` per `paperLightFS`), y-flipped into canvas order. Same `RangeError` door.

## Wash removal

Sibling shader `paperSheetFS` in `packages/efx-watercolor/src/playground/shaders.ts`, immediately after `paperSwatchFS`: `HEADER` + `PAPER_COLOUR` + `TO_SRGB` only — `o = vec4(toSRGB(paperColour(...)), 1.0)`. No `wash`, no `smoothstep(0.6, 0.605, x)`, no `tide` mix. `paperSwatchFS` / `paperFieldFS` / `paperLightFS` bodies are byte-unchanged. The fond has no wash.

## Cache shape

`app/src/lib/enginePaperSheet.ts` — one lazily constructed detached-canvas `WatercolorEngine` + two `Map`s keyed `${studioPaperId}|${width}x${height}|${scale}`:
- `getEnginePaperSheet(studioPaperId, w, h, scale) -> HTMLCanvasElement | null`
- `getEnginePaperHeight(studioPaperId, w, h, scale) -> Float32Array | null`
- `resetEnginePaperSheetForTests()` clears both maps + drops the engine
- Real ids (`paper/real-1..3`, `canvas*`) return null — jpg arm stays caller-side
- Missing WebGL / `document` returns null; the Studio never throws from paper generation

Studio id → playground `PaperPreset` goes through `paperPresetForStudioId` (AquarelleCanvasLayer) — the table is not copied.

## Consumers retargeted

| Consumer | Now calls |
|---|---|
| `projectPaperRaster.ts` procedural fond | `getEnginePaperSheet(id, w, h, PAPER_UNITS / (h * normalized))` — fond cache-key string still `${paperTexture}\|1\|${width}x${height}\|${normalized}` |
| `PaperPicker.tsx` 64×64 thumbs | `getEnginePaperSheet(id, CELL_SIZE, CELL_SIZE, PAPER_UNITS / 256)` — `CELL_SIZE = 64` / `GRID_GAP = 8` / 3 columns untouched |
| `paperPass.ts` deposit tooth | `getEnginePaperHeight(id, w, h, PAPER_UNITS / (h * scale))` |
| `PhysicsPaintStudio.tsx` | `usePaperSheetWarmup` dropped (the engine path is the warm path) |
| `physicsPaintPerformanceTrace.ts` | `paperHeightMapPresent` field dropped (no writer) |

## Files deleted

- `packages/efx-watercolor/src/papers/playgroundPaperField.ts` + test (catalog relocated to `papers/library.ts`)
- `app/src/lib/paperFieldGl.ts` + test
- `app/src/lib/paperSheet.worker.ts`
- `app/src/lib/paperSheetField.ts` + test
- `app/src/lib/paperSheetClient.ts` + test
- `app/src/lib/paperSheetWarmup.ts` + test
- `app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts` + test

No re-export shim. `@efxlab/efx-watercolor/papers` still resolves `PAPER_UNITS` / `PAPER_PRESETS` / `presetForPaperId` / `PAPER_LIBRARY` from `library.ts`. Deleted module names grep is empty across `app/src` and `packages/efx-watercolor/src`.

## Measured performance

**`paperSheet` at 1920×1080 (Cold Press, sheet scale law): 9.9 – 13.7 ms, median ~12 ms** (headless Chrome, GPU path, warm shader compile; 4 samples: 11.2 / 13.6 / 9.9 / 13.7 ms).

No new subsystem was built to hide this. The fond is a same-tick cache hit after the first call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `getEnginePaperHeight` accepted a zero / non-finite scale**
- **Found during:** Task 2 tests
- **Issue:** Host door checked id / width / height but not scale; the engine throws `RangeError` and the host caught it, but a stub engine returned a degenerate field.
- **Fix:** Both host getters now reject non-positive / non-finite scale (fail-soft null), matching the engine door.
- **Files modified:** `app/src/lib/enginePaperSheet.ts`

**2. [Rule 1 - Stale pin] PaperPicker test forbade the word `engine` in source**
- **Found during:** Task 2 full-suite run
- **Issue:** `PaperPicker.test.tsx` pinned "no call into the fluid engine" via a `/engine|deposit|fluid/i` scan — written when thumbs were CPU-rendered. This plan deliberately routes thumbs through the engine paper host.
- **Fix:** Retargeted the pin: must import `enginePaperSheet` and call `getEnginePaperSheet`; must NOT contain `WatercolorEngine` construction, `deposit`, `fluid`, or `paperPass`.
- **Files modified:** `app/src/components/physic-paint/view/PaperPicker.test.tsx`

### Out of scope (not touched)

- `pnpm build` DTS in `packages/efx-watercolor` fails on `engineAdapter.ts:204` `setPaper` not on `EngineAdapter` type. Pre-existing optional seam (261017-fz3); ESM build succeeds; vitest is green. Not caused by this task.

## Verification

- `pnpm --filter @efxlab/efx-watercolor exec vitest run` — **113 passed, 4 skipped** (8 files) — new tests ran (`papers.test.ts` 17).
- `pnpm vitest run` from `app/` — **5202 passed, 1 skipped, 96 todo** (299 files) — new tests ran (`enginePaperSheet.test.ts` 10).
- Targeted paper suite: 88 passed (`enginePaperSheet` 10, `projectPaperRaster` 32, `paperPass` 18, `paperPass.composeLaw` 12, `paperPass.frameGuard` 16).
- Deleted-name grep count: **0**.
- `paperSheetFS` body: `PAPER_COLOUR` + `TO_SRGB` + `toSRGB(c)`, no `wash` / `smoothstep(0.6, 0.605, x)`.
- `drawPaper` has no `private` modifier; `paperSheet` / `paperHeight` present with `scale` default.
- Fond cache key string unchanged. `PaperPicker` grid constants unchanged. Aquarelle bake key shape untouched.

## Live UAT rows (user-run)

1. **No freeze:** open the editor and Studio — the UI never freezes; the paper appears promptly. Measured `paperSheet` at fond size: **~12 ms (9.9–13.7 ms) for 1920×1080**.
2. **Look:** Cold Press fond matches `SPECS/v1.1.0-water-color/paper/cold press.png` — fine crisp grain, no ultramarine corner treatment, no tile grid. [ ]
3. **Thumb = fond:** the PaperPicker 64×64 cell shows the same paper as the fond. [ ]
4. **Real scans unchanged:** `paper/real-1..3` still grain-over-white. [ ]
5. **Repeat is a hit:** A → B → A is instant. [ ]
6. Save → reopen → same paper, same density. Console clean. [ ]
