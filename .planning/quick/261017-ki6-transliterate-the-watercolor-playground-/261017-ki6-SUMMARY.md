---
phase: quick-261017-ki6
plan: 261017-ki6
subsystem: papers
tags: [watercolor, playground, transliteration, paper-field, glsl, fond, aquarelle]

# Dependency graph
requires:
  - phase: 56
    provides: procedural paper library + fond cache + paperPass bake tooth + PaperPicker thumbs
provides:
  - playgroundPaperField.ts — the single paper generator (1:1 CPU port of the playground paper shader)
  - Opaque paperColour fond at full W×H with the PAPER_UNITS scale law
  - PaperPicker thumbs and bake tooth reading the same ported field
affects: [efx-watercolor, physic-paint, aquarelle-bake, paper-fond]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 24800
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "1:1 shader transliteration (GLSL → TS) with source-scan salt pins"
    - "single paper generator consumed by fond + thumbs + bake tooth"

key-files:
  created:
    - packages/efx-watercolor/src/papers/playgroundPaperField.ts
    - packages/efx-watercolor/src/papers/playgroundPaperField.test.ts
  modified:
    - packages/efx-watercolor/src/papers/index.ts
    - packages/efx-watercolor/src/papers/library.ts
    - packages/efx-watercolor/src/papers/papers.test.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
    - app/src/lib/paperPass.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx

key-decisions:
  - "Transliterate the MIT-vendored playground shader constant-for-constant (user override 2026-10-17) — the P1 clean-room fence is revoked for this oracle."
  - "New file playgroundPaperField.ts rather than rewriting procedural.ts in place, so the port stays line-auditable against the oracle and the two never share a file."
  - "Renamed the port's preset interface to StudioPaperPreset — the vendored playground already exports PaperPreset with a different shape."

patterns-established:
  - "Source-scan pins assert per-kind salt tuples survived in the TS source (T-261017-KI6-01)."

requirements-completed: []

coverage:
  - id: D1
    description: "playgroundPaperField.ts is a 1:1 port of paperFieldFS + paperLightFS + PAPER_COLOUR (primitives, 10 kinds, PAPER_UNITS, presets)"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/papers/playgroundPaperField.test.ts (34 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fond is an opaque paperColour sheet at full W×H with uScale = PAPER_UNITS / (height * grainScale), no tiling, content-keyed cache"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts (261017-ki6 blocks)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly one generator remains; thumbs + bake tooth read it; bake cache-key shape unchanged"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/papers/papers.test.ts + app/src/lib/paperPass.test.ts + grep audit"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT: fond reads like SPECS/v1.1.0-water-color/paper/*.png (fine crisp grain, per-kind character)"
    verification: []
    human_judgment: true
    rationale: "Paper look is a human visual judgment against the user-placed ground-truth snapshots; automated pins cannot score grain character."

# Metrics
duration: 14min
completed: 2026-10-17
status: complete
---

# Quick 261017-ki6: Transliterate the Watercolor Playground Paper Shader Summary

**The editor fond, picker thumbs, and bake tooth now read a 1:1 TypeScript transliteration of the watercolor-playground paper shader — same primitives, same per-kind salts, same scale law — and the clean-room generator is gone.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2/2
- **Commits:** 1 (atomic)

## Accomplishments

- Created `packages/efx-watercolor/src/papers/playgroundPaperField.ts` — the single generator. Export surface: `PAPER_UNITS`, `PAPER_PRESETS`, `StudioPaperPreset`, `PROCEDURAL_PAPER_IDS`, `presetForPaperId`, `linearRGB`, `toSRGB`/`toSRGBChannel`, `paperField`, `paperFieldMap`, `paperLight`, `paperColour`/`paperColourSRGB`, `renderPaperSheet`, `paperHeightMap`.
- Wired the fond arm of `app/src/lib/projectPaperRaster.ts` at full W×H, `uScale = PAPER_UNITS / (height * grainScale)`, offset `[0, 0]`, opaque paperColour sheet, content-keyed cache kept (key shape `${paperTexture}|1|${width}x${height}|${normalized}` unchanged).
- Deleted `packages/efx-watercolor/src/papers/procedural.ts` (no re-export shim). `PAPER_REFERENCE_HEIGHT` is gone; `PAPER_UNITS` is the one name for 1100.
- Retargeted `PaperPicker.tsx` 64×64 thumbs to `renderPaperSheet` at `uScale = PAPER_UNITS / 256` (CELL_SIZE=64, GRID_GAP=8, 3-column grid untouched).
- Retargeted `paperPass.ts` bake tooth to `paperHeightMap` at the fond's scale law; cache key `v1:${paperTexture}:${width}x${height}:${scale}:${k}` unchanged.

## Decisions Made

- Transliterate, do not re-derive (user override 2026-10-17). The P1 clean-room fence is revoked for this MIT-vendored oracle.
- Port lives in a new file so it stays line-auditable against `shaders.ts` paper section.
- Interface renamed `StudioPaperPreset` to avoid colliding with the vendored playground's `PaperPreset`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PaperPreset` name collision broke the package DTS build**
- **Found during:** Task 2 (build)
- **Issue:** `packages/efx-watercolor/src/papers/playgroundPaperField.ts` exported `PaperPreset`, colliding with the vendored `src/playground/papers.ts` `PaperPreset` re-exported from the root index (TS2308).
- **Fix:** Renamed to `StudioPaperPreset`.
- **Files modified:** packages/efx-watercolor/src/papers/playgroundPaperField.ts
- **Commit:** 71ea1277

## Known Stubs

None.

## Live UAT Rows (user-run — compare against `SPECS/v1.1.0-water-color/paper/*.png`)

1. Select **Cold Press** → the fond reads like `cold press.png`: fine crisp grain, not soft blobs, not a tile grid.
2. **Rough** vs **Cold Press** side by side → Rough is visibly coarser/knobblier, matching `rough.png`.
3. **Hot Press** is the smoothest of the three (little tooth), matching `hot press.png`.
4. **Laid** shows directional laid/chain lines, matching `laid.png`. **Canvas** shows a plain weave, matching `canvas.png`.
5. Feature size is constant across canvas sizes (the playground law) and matches the preview at the same zoom; the PaperPicker 64×64 thumb shows the same character as the fond.
6. Paper change → fond changes; save → reopen → identical; console clean.

## Verification Results

- `pnpm vitest run` in `packages/efx-watercolor/`: **155 passed, 4 skipped** (9 files) — includes `playgroundPaperField.test.ts` 34/34 and `papers.test.ts` 25/25.
- `pnpm vitest run` in `app/`: **5179 passed, 1 skipped, 96 todo** (298 files) — includes `projectPaperRaster.test.ts` and `paperPass.test.ts`.
- Single-generator grep (`FIELD_RECIPES|tileFbm|tileLattice|proceduralHeightMap|PAPER_REFERENCE_HEIGHT`): empty.
- Guardrails: `git diff SPECS/` empty; TopBar/RightPanel untouched; `packages/efx-watercolor/src/bake/` untouched; `package.json` untouched; PaperPicker `CELL_SIZE = 64` / `GRID_GAP = 8` / 3-column grid intact.

## Follow-up Needed

- Live UAT rows 1–6 above (user-run against the ground-truth snapshots).
- Pre-existing (out of scope, not touched): `tsup` DTS build of `@efxlab/efx-watercolor` fails on `engineAdapter.ts` optional `setPaper` seam (TS2353) — JS build is green and is what vitest consumes.

## Self-Check: PASSED

- FOUND: packages/efx-watercolor/src/papers/playgroundPaperField.ts
- FOUND: packages/efx-watercolor/src/papers/playgroundPaperField.test.ts
- FOUND: 71ea1277 (git merge-base --is-ancestor)
