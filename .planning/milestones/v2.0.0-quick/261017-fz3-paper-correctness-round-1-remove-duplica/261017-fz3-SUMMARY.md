---
phase: quick-261017-fz3
plan: 261017-fz3
subsystem: ui
tags: [watercolor, paper, bake, cache-key, aquarelle, preact, vitest]

requires:
  - phase: quick-261017-e7n
    provides: procedural paper tooth in editor fond + enginePaperGrainKey routing
provides:
  - single PaperPicker mount (Paper tab only)
  - paper-aware aquarelle bake with cache fingerprint (id+strength+scale)
  - playground PAPER_UNITS relief scale with bump/mottle modulation
affects: [56-efx-watercolor, physic-paint, paper-display]

actuals:
  tokens: 10266
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "aquarellePaperCacheFingerprint: paper id+strength+scale as cache-key term"
    - "PAPER_UNITS = 1100 / PROCEDURAL_FOND_TILE scale law for relief tiles"
    - "playground bump/mottle modulation of the PaperPicker shade formula"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts

key-decisions:
  - "Paper feeds the aquarelle bake engine via paperPresetForStudioId (exported from AquarelleCanvasLayer); Q5a cold fallback for paper/real-* stays byte-untouched"
  - "cacheRevision folds paper id+strength+scale at all three sites so a paper change is a cache miss; engine-1 frames are NOT widened to this exception"
  - "Procedural relief feature size derives from PAPER_UNITS = 1100 over tile texel height (the engine's paperScale law), not a hand-picked frequency"
  - "Per-paper bump (0.6-1.0) modulates shade contrast; mottle (0.03-0.14) modulates cloudiness — same PaperPicker formula, modulated"

requirements-completed: []

coverage:
  - id: D1
    description: "Exactly one PaperPicker mount in PhysicsPaintRightPanel.tsx (Paper tab); Paint tab shared block shows Opacity with no paper grid"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#mounts PaperPicker exactly once"
        status: pass
    human_judgment: false
  - id: D2
    description: "Paper id+strength+scale in the aquarelle cache fingerprint — a paper change re-bakes; setPaper(paperPresetForStudioId) before first applyStroke; AQUA-08 alpha-0 unpainted"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#261017-fz3 paper-aware bake"
        status: pass
    human_judgment: false
  - id: D3
    description: "Procedural relief feature size follows PAPER_UNITS = 1100 / tile texel height; bump/mottle modulate contrast/cloudiness per playground papers.ts"
    verification:
      - kind: unit
        ref: "src/lib/projectPaperRaster.test.ts#261017-fz3 playground paper scale"
        status: pass
    human_judgment: false
  - id: D4
    description: "Watercolor reacts to paper in the live editor (tooth/granulation follow selected paper; paper change re-bakes)"
    verification: []
    human_judgment: true
    rationale: "Live visual UAT only — user judges tooth scale, fond consistency, and re-bake behavior in PHYSIC PAINT STUDIO"
  - id: D5
    description: "Fond is consistent across tracks (non-watercolor stroke sits on the same fond paper — screenshot 48 behaviour stays)"
    verification: []
    human_judgment: true
    rationale: "Compositor-law visual check requiring live screenshots across track types"

duration: 15min
completed: 2026-10-17
status: complete
---

# Quick 261017-fz3: Paper Correctness Round 1 Summary

**Single PaperPicker mount, paper-aware aquarelle bake with cache fingerprint, and playground PAPER_UNITS relief scale**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-17T09:51:02Z
- **Completed:** 2026-10-17T10:06:57Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Removed the duplicate PaperPicker from the Paint tab — paper is selected from the Paper tab only (user asked twice)
- Paper (id+strength+scale) feeds the aquarelle bake engine via `paperPresetForStudioId` before replay and joins the cache fingerprint so a paper change re-bakes
- Procedural relief feature size now follows the playground `PAPER_UNITS = 1100` law with per-paper bump/mottle modulation

## Task Commits

Each task was committed atomically:

1. **Task 1: remove duplicate PaperPicker** - `bf547f76` (fix)
2. **Task 2: paper-aware aquarelle bake + cache key** - `20f9dfdc` (fix)
3. **Task 3: playground PAPER_UNITS relief scale** - `66c9eab0` (fix)

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` — source-scan pin for single PaperPicker mount
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — deleted Paint-tab PaperPicker mount
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — AquarelleBakePaper type, aquarellePaperCacheFingerprint, setPaper-before-replay seam
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — paper-aware bake tests (fingerprint, call order, AQUA-08)
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — AquarelleAdapterOptions paper fields, setPaper method
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — bakeAquarelleScript reads paper from getBackgroundMetadata
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — exported paperPresetForStudioId + STUDIO_PAPER_TO_PRESET
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — cacheRevision folds paper term at all three sites
- `app/src/stores/physicPaintStore.ts` — _writePaperDisplay comment names the aquarelle exception
- `app/src/lib/projectPaperRaster.ts` — PAPER_UNITS scale law + bump/mottle modulation
- `app/src/lib/projectPaperRaster.test.ts` — playground scale + bump/mottle tests

## Decisions Made

- Paper reaches the bake engine via `paperPresetForStudioId` (exported from AquarelleCanvasLayer.tsx) — single source for studio-id to PaperPreset mapping; Q5a cold fallback for `paper/real-*` is byte-untouched
- `cacheRevision` folds `paper:id|str:strength|scl:scale` at all three computation sites so a paper change is a cache miss; engine-1 frames are NOT widened to this exception (display-fond paper stays composite-only for engine-1)
- Procedural relief feature size derives from `PAPER_UNITS = 1100 / PROCEDURAL_FOND_TILE` (the engine's `paperScale = PAPER_UNITS / dh` law); the height map is generated over PAPER_UNITS and a tile window is sampled
- Per-paper bump (playground papers.ts) modulates the PaperPicker shade formula's contrast; mottle modulates cloudiness — recognisably the same formula, modulated not replaced

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Live UAT Rows (user-run)

1. **One paper UI only:** open the Water color module → the Paper tab shows the grid; the Paint tab shows **no** paper grid (Opacity and params remain).
2. **Watercolor reacts to paper:** paint a watercolor wash on frame A → change the paper (e.g. Cold Press → Rough) → the wash **and** the fond visibly change (tooth scale + relief). No stale cache.
3. **Fond is consistent across tracks:** a non-watercolor stroke and a watercolor stroke both sit on the **same** fond paper (screenshot 48's behaviour is correct and must stay).
4. **Scale matches the playground:** the procedural tooth feature size looks like the playground's paper preview at the same zoom — not zoomed-in blobs, not invisible.
5. Save → close → reopen → paper still selected, still renders, watercolor still matches.
6. Console clean — no `invalid background metadata`, no `<PhysicsPaintStudio>` error.

## Next Phase Readiness

- Paper correctness round 1 complete; three pin suites + non-regression green (5176 app tests, 115 efx-watercolor tests)
- Live UAT is the user's — status stays automated-ready until the six rows above are judged

---
*Quick: 261017-fz3*
*Completed: 2026-10-17*

## Self-Check: PASSED

All 11 files found. All 3 commits (bf547f76, 20f9dfdc, 66c9eab0) verified as ancestors of HEAD.
