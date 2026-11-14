---
phase: quick-261017-mdr
plan: 261017-mdr
subsystem: ui
tags: [webgl2, paper-fond, preact-signals, cache-warmup, blit, watercolor]

# Dependency graph
requires:
  - phase: quick-261017-lny
    provides: WebGL2 paper shader pipeline (paperFieldGl) + proceduralFondCache
  - phase: quick-261017-iwm
    provides: continuous procedural fond at full WxH + PAPER_REFERENCE_HEIGHT scale law
provides:
  - GPU-blit sheet present path (GL canvas hand-out, no readPixels / no per-row JS copy)
  - Idle warm-up entry (paperSheetWarmup + usePaperSheetWarmup + PaperPicker thumb warm)
  - Cache-discipline pins on proceduralFondCache.clear() and the per-frame fond identity hit
affects: [physic-paint-studio, preview-flatten, paper-picker]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 8300
  tasks: 3
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GPU-blit fond: renderPaperSheetGl hands out the shared GL canvas; buildProceduralPaperFond drawImage-blits into a dedicated cached 2D canvas (never aliases the GL canvas)."
    - "Idle warm-up: setTimeout(0) / optional requestIdleCallback in a tiny lib module; Studio calls one hook at the working-size + paper seam."

key-files:
  created:
    - app/src/lib/paperSheetWarmup.ts
    - app/src/lib/paperSheetWarmup.test.ts
    - app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts
    - app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts
  modified:
    - app/src/lib/paperFieldGl.ts
    - app/src/lib/paperFieldGl.test.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Sheet present = hand out the shared GL canvas (pass 3 to default framebuffer); drop the third FBO + readPixels + y-flip loop. Orientation matches the playground display — no shader vUv flip needed for drawImage."
  - "Cached fond is always a dedicated 2D canvas copied via drawImage — never the shared GL canvas (a later sheet render would overwrite it)."
  - "Warm-up is deferred (setTimeout(0), requestIdleCallback optional accelerator) and idempotent via proceduralFondCache / reliefCache — never blocks first paint."
  - "Cache-discipline audit: the two proceduralFondCache.clear() sites were already correct (dispose + test reset) — pins only, no production fix invented."

patterns-established:
  - "GPU sheet → dedicated 2D cache canvas blit (drawImage), CPU fallback keeps createImageData/set/putImageData on null."

requirements-completed: []

coverage:
  - id: D1
    description: "GPU-blit sheet reaches proceduralFondCache with no CPU readback or per-row JS copy"
    verification:
      - kind: unit
        ref: "app/src/lib/paperFieldGl.test.ts — 261017-mdr GPU-blit sheet present path"
        status: pass
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts — GPU arm blits into a dedicated cache canvas"
        status: pass
    human_judgment: false
  - id: D2
    description: "Idle warm-up of selected sheet + picker thumbs is deferred and idempotent"
    verification:
      - kind: unit
        ref: "app/src/lib/paperSheetWarmup.test.ts — schedule defers; second schedule is a cache hit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts — schedules procedural, skips non-procedural"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cache discipline: per-frame getProjectPaperCanvas identity hit; clear() only on dispose / test reset"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts — 261017-mdr cache discipline"
        status: pass
    human_judgment: false
  - id: UAT1
    description: "Live UAT: cold start instant, first paper change instant, look unchanged, scrub smooth, paint does not regenerate sheet, save/reopen clean"
    verification: []
    human_judgment: true
    rationale: "First-render stall and sheet orientation can only be judged live in the Studio (executor does not start the server)."

duration: 25min
completed: 2026-10-17
status: complete
---

# Quick 261017-mdr: Kill the First-Render Stall Summary

**Procedural paper fond now GPU-blits into a dedicated cache canvas (no readPixels, no per-row JS copy) and warms up in an idle slot, so the first visible fond is a cache hit.**

## Accomplishments

- `renderPaperSheetGl` returns the shared GL canvas (`HTMLCanvasElement | null`); pass 3 draws to the default framebuffer; the third FBO, the RGBA readback, and the y-flip row loop are gone. Null-on-failure preserved.
- `buildProceduralPaperFond` GPU arm does one `drawImage(glSheet, 0, 0, width, height)` into a dedicated cached 2D canvas. CPU fallback (`renderPaperSheet` → `createImageData` → `set` → `putImageData`) unchanged on null. Cache-key shape `20f9dfdc` untouched.
- New `paperSheetWarmup.ts`: `warmProceduralPaperSheet` + `scheduleProceduralPaperWarmup` (setTimeout(0), optional requestIdleCallback). Never runs inline, never throws, idempotent.
- `PaperPicker.warmProceduralReliefThumbs()` pre-fills the 64×64 reliefCache. `CELL_SIZE = 64` / `GRID_GAP = 8` / 3-column grid unchanged.
- `usePaperSheetWarmup` hook wired once in `PhysicsPaintStudio.tsx` at the working-size + paper seam (`settings.background` when `paper/`, else `paper/cold-press`; grain = `settings.grainScale`).

## Cache-Discipline Audit (Task 3)

**Already correct — pins only, no production fix invented.**

- `proceduralFondCache.clear()` appears exactly twice: `clearProjectPaperRasterCache` (production) and `resetProjectPaperRasterForTests` (test reset).
- Production caller of `clearProjectPaperRasterCache` is `previewRenderer.dispose()` only — a genuine dispose, not a paint/revision bump. `physicPaintStore.ts` has zero references.
- Per-frame `getProjectPaperCanvas` in `_resolveFlattenedFrame` (~2794) is a pure cache hit after warm-up: key `${paperTexture}|1|${width}x${height}|${normalized}` with `size.width` / `size.height` / `fondInstruction.grainScale` stable across frames for an unchanged document (compositor working size + background metadata).
- **Out of scope (recorded, not redesigned):** `_resolveFlattenedFrame`'s per-frame `document.createElement('canvas')` is the flattener composite target, not the paper sheet path.

## Deviations from Plan

None — plan executed as written.

## Known Stubs

None.

## Pin Coverage

| Pin | Where | Status |
|-----|-------|--------|
| No `readPixels` / no per-row y-flip loop in sheet path | `paperFieldGl.test.ts` source-scan | pass |
| Pass 3 → default framebuffer; sheet is the GL canvas; `preserveDrawingBuffer: true` | `paperFieldGl.test.ts` source-scan | pass |
| No `vUv` flip inserted in `PAPER_SHEET_FS` | `paperFieldGl.test.ts` source-scan | pass |
| GPU arm `drawImage`s into a dedicated canvas (never aliases GL canvas) | `projectPaperRaster.test.ts` | pass |
| GPU arm has no `putImageData` / `createImageData` | `projectPaperRaster.test.ts` source-scan | pass |
| CPU fallback on null | `projectPaperRaster.test.ts` | pass |
| Cache identity: same key → identical object, one build | `projectPaperRaster.test.ts` | pass |
| Cache-key shape `20f9dfdc` unchanged | `projectPaperRaster.test.ts` source-scan | pass |
| Warm-up deferred (not inline) + second schedule is a cache hit | `paperSheetWarmup.test.ts` | pass |
| Warm-up non-procedural no-op; failures never throw | `paperSheetWarmup.test.ts` | pass |
| Hook schedules procedural / skips non-procedural / no re-schedule on same inputs | `usePaperSheetWarmup.test.ts` | pass |
| `CELL_SIZE = 64` / `GRID_GAP = 8` locked | `usePaperSheetWarmup.test.ts` + `PaperPicker.test.tsx` | pass |
| `proceduralFondCache.clear()` only in the two reset functions | `projectPaperRaster.test.ts` source-scan | pass |
| `clearProjectPaperRasterCache` absent from `physicPaintStore.ts` | `projectPaperRaster.test.ts` source-scan | pass |
| Production clear caller is `previewRenderer.dispose()` | `projectPaperRaster.test.ts` source-scan | pass |

## Verification

- `pnpm vitest run` in `app/`: **5211 passed** | 1 skipped | 96 todo (301 files) — includes 59 new/updated pin tests across 5 files (all confirmed ran).
- `pnpm vitest run` in `packages/efx-watercolor/`: **155 passed** | 4 skipped (9 files).
- Source-scans green (see Pin Coverage).
- Oracle GLSL kept verbatim (uBump / 1.3 / 0.25 / mat2 / coordinate law pins still honest).

## Live UAT Rows (user runs these)

1. **Cold start is instant too:** quit the app, relaunch, open PHYSIC PAINT STUDIO with a procedural paper selected → the fond appears immediately, no noticeable stall on the first display.
2. **Paper change first time is instant:** switch to a paper not used this session (e.g. Kraft) → immediate, no stall.
3. **Look unchanged:** Cold Press still matches `SPECS/v1.1.0-water-color/paper/cold press.png` — the blit path must not alter the look (no flipped/rotated/upside-down sheet).
4. **Per-frame work is gone / cached:** scrub the timeline across many frames with a paper selected → no repeated full-frame CPU churn; playback stays smooth.
5. **Cache discipline:** changing only the paint (not the paper) never regenerates the paper sheet.
6. Save → reopen → same paper, same density, same look. Console clean.

Status stays **automated-ready** until the user judges these live rows.

## Self-Check: PASSED

All key files found on disk (`paperFieldGl.ts`, `projectPaperRaster.ts`, `paperSheetWarmup.ts`, `usePaperSheetWarmup.ts`, `PaperPicker.tsx`, `PhysicsPaintStudio.tsx`). Test counts verified in the runs above (app 5211 passed; efx-watercolor 155 passed; the 5 pin files reported 59 tests).
