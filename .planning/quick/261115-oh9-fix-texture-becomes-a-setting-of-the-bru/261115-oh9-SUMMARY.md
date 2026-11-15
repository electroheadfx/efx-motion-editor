---
phase: quick/261115-oh9
plan: 01
subsystem: physic-paint
tags: [preact, signals, watercolor, textures, brush, roto, tdd, vitest]

requires: []
provides:
  - "One texture law: base = presetFor(brushId); tip = textureId ? resolveMask(textureId) ?? base.tip : base.tip"
  - "textureId carrier through the aquarelle payload codec, record restore, duplicate and Roto scripts"
  - "Texture row with real grayscale mask chips in the brush library and the pinned top-bar popover strip"
affects: [physic-paint, watercolor-engine, brush-library, brush-popover, roto-script-library]

actuals:
  tokens: 44444
  tasks: 3
  commits: 4
plan_head_before: c30038de738d9f68867f9ce780d2ebe5c1bdf9c7
plan_head_after: 97a0182da9e06ad0ae4e0c00b7c69c8fff70a4c5

tech-stack:
  added: []
  patterns:
    - "Texture rides only the opaque engine slot as a conditional spread; AQUARELLE_SCHEMA_VERSION stays 1"
    - "Mask chips blit strokeTipData bytes — the engine's own tip — cached by response|texture|maskGeneration"
    - "The popover's texture strip is a sibling AFTER SidebarScrollArea so the chrome measurement counts it"
    - "Texture selection is written in the click handler from a compare-then-write setter"

key-files:
  created:
    - app/src/components/physic-paint/view/watercolorMaskChip.ts
    - app/src/components/physic-paint/view/watercolorMaskChip.test.ts
    - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
    - app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts
  modified:
    - packages/efx-watercolor/src/playground/brushBridge.ts
    - packages/efx-watercolor/src/playground/index.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/brushes/maskRegistry.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "D-01: one resolution function in the package; every reader delegates to strokeTipData/buildBrushForStroke"
  - "D-02: textureId is optional and absent means the response's own tip; unknown masks fall back to base.tip"
  - "D-03: the carrier lives in the opaque engine slot; both boundary guards validate it as a non-empty string when present"
  - "D-04: texture chips paint the engine's actual mask bytes, never a thumbnail approximation"
  - "D-05: the library grid lists responses only; textures live in one row spanning both grid columns"
  - "D-06: an import selects the new texture on arrival; the response selection is untouched"
  - "D-07: the top-bar popover pins the texture strip below the scroller; texture picks keep it open, response picks close it"
  - "D-08: Roto script saves read brushId AND textureId so a custom texture must travel with the script"
  - "D-09: the eraser (lift) branch carries no texture at live, record or punch time"

requirements-completed: []

duration: ~20 min
completed: 2026-11-15
status: complete
---

# Quick 261115-oh9: Texture becomes a setting of the brush response Summary

**A stroke is now a response plus an optional texture: the response owns every physical multiplier, the texture replaces only the footprint, and the pair survives record, restore, duplicate and Roto scripts while the eraser stays texture-free.**

## Performance

- **Duration:** ~20 min (approximation; first task commit 18:27:24+01:00 → completion ~18:41)
- **Started:** 2026-11-15T~18:21+01:00 (approximation)
- **Completed:** 2026-11-15T~18:41+01:00
- **Tasks:** 3
- **Files modified:** 45 committed files (4 created, 41 modified); one extra test file vs the plan and two planned files ultimately unchanged

## Accomplishments

- Replaced the old texture-selects-a-preset path with one law in `brushBridge.ts`: `base = presetFor(brushId)`, `tip = textureId ? resolveMask(textureId) ?? base.tip : base.tip`, `buildBrushForStroke(brushId, { textureId, overrides, seed })`; the eight D-08 multipliers apply ungated. `strokeTipData(brushId, textureId, seed)` exposes the same single resolution.
- Carried `textureId` through `BrushStrokeOptions`, the aquarelle payload codec (opaque engine slot, conditional spread, schema version 1), studio record restore, duplicate/copy, the stroke band and thumbnail paths, with the two boundary guards accepting present-non-empty or absent.
- Rebuilt the library as responses-only plus a texture row: every chip shows the engine's real 192px grayscale mask (`strokeTipData`) in a 44px canvas; an import selects the new texture on arrival via `setAquarelleSelectedTextureId`.
- Added the pinned texture strip to the top-bar brush popover below the scroller (sibling, not list content) so the chrome measurement counts it; texture picks keep the menu open, response picks close it; the eraser branch gains no strip.
- Extended the Roto script save law: `referencedCustomBrushIds` collects custom ids from both `engine.brushId` and `engine.textureId`; a custom texture that cannot travel refuses the save by name, built-ins never block, and serialize→parse round-trips the texture.
- Kept the eraser texture-free at every layer and surfaced unknown/unavailable masks as the single aggregate warning path.

## Task Commits

Each task committed atomically (code only):

1. **Task 1 (auto, TDD):** `b15a744e8` — one texture law + the `textureId` carrier through every reader
2. **Task 2 (auto, TDD):** `ccef60ccf` — library responses-only grid, mask-texture row, import selects on arrival
3. **Task 3 (auto, TDD):** `880664790` — popover texture strip + script-carrier save law
4. **Verification fix:** `97a0182da` — anchor the texture-chip CSS pin to the standalone rule

*Planning artifacts are intentionally not committed by the executor; the orchestrator owns their commit.*

## TDD / Test-First Notes

- The plan frontmatter is `type: execute`, so no plan-level RED/GREEN evidence ledger applies. Each task carried `tdd="true"`: tests were authored first and observed failing (missing modules / failing assertions) before the implementation made them pass; refactors followed each green run.
- Per the dispatch's "commit each task atomically (code changes only)", each task landed as one atomic commit containing its tests and implementation; no separate RED commits were created.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/brushBridge.ts` — the one resolution (`resolveStrokeBrush`), `BrushStrokeOptions`, `buildBrushForStroke`, `strokeTipData`.
- `packages/efx-watercolor/src/playground/index.ts` — exports the new API and `TIP_SIZE`.
- `packages/efx-watercolor/src/payload/codec.ts` — carries `textureId` in the engine slot; `isStrokeShape` guard.
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` — record-side carrier.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — resolves through the shared law.
- `packages/efx-watercolor/src/brushes/maskRegistry.ts` — mask generation tracking used by the chip cache.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `aquarelleSelectedTextureId` + compare-then-write setter.
- `app/src/components/physic-paint/view/watercolorMaskChip.ts` — engine-tip mask chips with a `response|texture|generation` cache.
- `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` — Default + built-in + imported texture chips; writes only the texture signal.
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` — responses grid, texture row, import selects on arrival.
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` — pinned compact strip below the scroller; effect deps read the catalog generation.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — custom ids read from both axes.
- `app/src/components/physic-paint/physicsPaintStudio.css` — texture row/chip styles and the popover strip (34px chips).
- Test files updated across the package and app, including the new texture-parity suite, mask-chip suite, and restore-carrier coverage.

## Decisions Made

- Texture selection writes only `aquarelleSelectedTextureId`; the response selection and multiplier bag stay untouched.
- Chips are the engine's own tip bytes so the UI cannot drift from what the brush will paint; the cache key includes the response id and the mask registry generation.
- The texture strip is a sibling after `SidebarScrollArea` in both surfaces, keeping the popover's natural-height measurement honest.
- Script saves read both axes; a missing custom texture refuses the save by name rather than silently degrading.

## Accepted Loss

**A phase-63 project stroke whose `brushId` is a texture id replays through `presetFor` → `round`. No migration, no recovery is provided.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical coverage] Added `aquarelleRecordState.restore.test.ts`**
- **Found during:** Task 1
- **Issue:** The plan's file list did not include the record-restore suite, but the carrier must be proven to survive record restore.
- **Fix:** Extended the existing restore test with `textureId` round-trip coverage.
- **Files modified:** `app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts`
- **Commit:** `b15a744e8`

**2. [Rule 1 - Bug] Anchored the texture-chip CSS pin to the standalone rule**
- **Found during:** final full app suite
- **Issue:** The library test's bare `cssRuleBody(css, '.watercolor-texture-chip-canvas')` substring matched Task 3's earlier compound `.physics-paint-brush-menu-textures .watercolor-texture-chip-canvas` (34px) rule, so the 44px assertion failed once all three tasks were on disk.
- **Fix:** Anchor the lookup at a line start (`'\n.watercolor-texture-chip-canvas'`) and document why.
- **Files modified:** `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts`
- **Commit:** `97a0182da`

### Plan Scope Notes

- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` and `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts` were listed in the plan's file list but required no change; their existing pins already cover the required behavior and they pass unchanged.

## Issues Encountered

- The full app suite's first run (default workers) also produced an unhandled Tauri listener rejection in `physicPaintBridge.test.ts` (WR-04). Re-running with the plan-sanctioned `--minWorkers 1 --maxWorkers 4` passed cleanly; this is pre-existing load sensitivity, unrelated to this quick's changes.

## Verification

1. `pnpm --filter @efxlab/efx-watercolor test` — 20 files passed, 1 skipped; 417 passed, 9 skipped.
2. `pnpm --filter @efxlab/efx-watercolor build` — ESM + DTS build success.
3. `pnpm --filter @efxlab/efx-watercolor check` — clean.
4. `pnpm --filter efx-motion-editor run typecheck` — clean.
5. Targeted task suites — Task 1: 371 passed (13 files); Task 2: 45 passed (3 files); Task 3: 79 passed (3 files).
6. Full app suite (`--minWorkers 1 --maxWorkers 4`) — 444 files passed, 2 skipped; 9408 tests passed, 1 skipped, 96 todo (after the review + live-defect fixes).
7. `pnpm run build` — success; largest chunk 1,902.64 kB, under the 2000 kB ceiling.

## User Setup Required

None — no external service configuration required. The dev server was never started.

## Native UAT (automated-ready — not claimed)

1. Pick a response, keep the Default texture: the stroke uses that response's own tip and physics.
2. Pick a non-default texture: the footprint changes while the response's water/load/flow/roughness/spacing/scatter/rotation still drive the stroke.
3. Change the response with Default selected: the Default chip repaints to the new response's tip, and painting uses the new response.
4. Library: the grid lists responses only; the texture row sits beneath it with real grayscale masks; an import selects the new texture on arrival.
5. Top-bar popover: responses plus a pinned texture strip below the list; a texture pick keeps the menu open, a response pick closes it, and the eraser branch shows no strip.
6. Record a textured stroke, then undo/redo, duplicate, save and reload a Roto script: the texture survives every path.
7. An unavailable/unknown texture falls back to the response's tip without throwing and reports one aggregate warning.
8. The eraser (lift) carries no texture at live, record or punch time.

## Next Phase Readiness

- Automated-ready; awaiting the native UAT rows above before claiming the quick task verified.
- No stubs. The one windows-ledger deviation entry (id 124) was recorded and marked fixed after `97a0182da`.

## Live defect found at UAT (post-execution, fixed)

The user painted in the running app and reported: "I can't change the texture, it always the same."

**Root cause:** `Engine.tipTexture` cached the uploaded GPU tip by `brush.id` alone. Under the new law `id` is the RESPONSE, so a second texture on the same response reused the first uploaded tip forever. No unit test could see it — the cache is only reachable with a live WebGL context (project law: live evidence over unit probes).

**Fix (`11ab31094`):** `Brush` now carries the texture that supplied its bytes; the cache keys on `brushTipCacheKey(b)` = `id|textureId`; an unresolvable texture resolves to the base key (no phantom entry, no duplicate upload); `forgetBrush` drops every key a response owns. Pinned by `brushTipCacheKey` behaviour in `brushBridge.test.ts` and by `engineTipIdentity.test.ts`.

## Code review disposition (REVIEW.md, `4bb706468`)

| Finding | Severity | Disposition |
|---|---|---|
| CR-01 — a pen's eraser end lifts with the textured brush live while the punch/bake erase the response tip, and a lift stroke recorded the texture | critical | FIXED — `Engine.setLiftBrush` + `applyLiveConfig` binds the response's untextured tip for lift; the record gates `textureId` on `recordedTool !== 'lift'` |
| WR-01 — a dangling `wc/custom-*` texture survives a project switch and poisons later records and script saves | warning | FIXED — `aquarelleBrushForActiveTool()` returns `null` unless `resolveMask(textureId)` resolves |
| IN-01 — the band builders' `Pick`/cache stamp omitted `textureId` | info | FIXED — both `Pick`s widened, stamp carries the texture |
| IN-02 — the library texture strip stays interactive while the Lift tool is active | info | ACCEPTED — the pick is remembered for the next brush stroke and never reaches the eraser; no data loss, control only |
| IN-03 — the in-memory script fallback dropped `textureId` | info | FIXED — conditional spread added (the co-located `toolOverrides` omission is pre-existing and out of scope) |

## Self-Check: PASSED

- Created files exist: `watercolorMaskChip.ts`, `watercolorMaskChip.test.ts`, `WatercolorTextureStrip.tsx`, `aquarelleTextureParity.test.ts`.
- Commits are ancestors of HEAD: `b15a744e8`, `ccef60ccf`, `880664790`, `97a0182da`.
- Measured commits from ledger base `c30038de738d9f68867f9ce780d2ebe5c1bdf9c7`: 4.
