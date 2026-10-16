---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 11
subsystem: engine
tags: [watercolor, aquarelle, live-surface, gap-closure, fluid-sheet, record-seam, tdd]
gap_closure: true

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room (56-01 / 56-03 / 56-06 / 56-08)
    provides: FluidSheet, stampTool/depositStrokeOnSheet, payload codec, EngineAdapter, aquarelleBake
provides:
  - sheetToRgba / drawSheetToCanvas — sheet → display raster (alpha 0 unpainted)
  - createAquarelleEngineAdapter FluidSheet path (depositStrokeOnSheet + step + sheet-raster capture)
  - aquarelleLiveSurface — pointer → 60 Hz tick resample → FluidSheet → display
  - stroke-end full AquarelleStroke record (supersedes the params-only seam)
  - D-05 shared Color/Size/Opacity widgets for both modules
affects: [56-10 / AQUA-08 UAT A1-A5]

# Actuals
actuals:
  tokens: 42000
  tasks: 4
  commits: 5
plan_head_before: 8e86e277
plan_head_after: ab5224da

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One stepping law live == bake: stampTool/depositStrokeOnSheet per sample, step(sheet, 1) per tick, sheet raster for display/capture"
    - "Preview may decimate sim resolution; RECORDED ticks/params stay complete and exact"
    - "toStudioStroke tick law: pts[].tick = sample index i on the HOST_TICK_HZ grid"

key-files:
  created:
    - packages/efx-watercolor/src/engine/raster.ts
    - packages/efx-watercolor/src/engine/raster.test.ts
    - app/src/components/physic-paint/engine/aquarelleLiveSurface.ts
    - app/src/components/physic-paint/engine/aquarelleLiveSurface.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  modified:
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/src/engine/index.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx

requirements-completed: [AQUA-04, AQUA-05, AQUA-08]
---

# 56-11 — Live Water color canvas on the clean-room aquarelle engine (gap-closure)

## Why this plan existed

Phase 56 shipped the clean-room aquarelle engine (fluid core, codec, bake) but the
Studio live canvas still painted through `EfxPaintEngine` (physics). The earlier
record seam (34edfbf1) snapshotted params AFTER physics already painted — no points,
no ticks. Water color looked like the physics brush. A1–A5 were unjudgeable.

## What landed

### 1. Sheet display raster (`packages/efx-watercolor/src/engine/raster.ts`)
- `sheetToRgba(sheet)` — composites mobile+fixed pigment to RGBA; alpha 0 where unpainted (AQUA-08 / A5).
- `drawSheetToCanvas(sheet, canvas)` — display/capture raster.
- `sheetToBytes` remains the determinism byte view; this is the display path.

### 2. Adapter FluidSheet parity (`createAquarelleEngineAdapter`)
- `applyStroke` → `depositStrokeOnSheet` (was the 2D tracer `depositStroke`).
- `stepTick` → `step(sheet, 1)` per integer tick (was a no-op).
- `captureFrame` → the sheet raster.
- Dry still force-dries only at the event's tick (D-15). Frame indices never force-dry (P4).
- Result: bake of a script now produces bloom/tide line (A3) and A2 double-bake identity holds.

### 3. Live aquarelle surface (`app/src/components/physic-paint/engine/aquarelleLiveSurface.ts`)
- Pointer path resampled onto the host tick grid (HOST_TICK_HZ = 60; `pts[].tick` = sample index).
- Per tick: `stampTool` on the FluidSheet + `step(sheet, 1)`; display throttled.
- Stroke end records a full `AquarelleStroke` (points + params + tool + brushId + color).
- `emitDry(tick)` force-dries and returns a recorded Dry payload event.
- Preview may use a reduced sim resolution; the recorded ticks/params stay complete.

### 4. Studio wiring (`PhysicsPaintCanvasMount` / `AquarelleCanvasLayer` / `PhysicsPaintStudio`)
- When `activeModule === 'watercolor'`: aquarelle canvas captures pointer input in the
  same `demo-canvas-shell`; `EfxPaintEngine.setInputLocked(true)` and its surface is
  hidden. When `'brush'`: the physics path is unchanged.
- Stroke end → `recordAquarelleStroke(mutationId, stroke)` + `enqueueRecordedStroke`
  so the Roto script path still sees the mark.
- The params-only `recordAquarellePayload(buildAquarelleStrokePayload())` call at
  physics mutation completion is REMOVED (superseded, not built on).
- `aquarelleEventsFromScript` prefers the recorded aquarelle stroke's own points.

### 5. D-05 shared block (`PhysicsPaintRightPanel`)
- Color: compact chip + hex in the shared block (full picker remains above).
- Size: routes to `aquarelleParams.size` in Water color, `size` in Brush.
- Opacity: routes to `aquarelleParams.load` in Water color, `settings.opacity` in Brush.

## Verification

- `pnpm --filter @efxlab/efx-watercolor exec vitest run` — 115 passed
- `pnpm --filter efx-motion-editor exec vitest run` — 5135 passed, 1 skipped, 96 todo
- `pnpm --filter efx-motion-editor run typecheck` — clean
- `pnpm --filter @efxlab/efx-watercolor build` — success

## What the user must judge live

Phase 56 UAT rows A1–A5 (AQUA-08) remain PENDING. This plan makes them judgeable:
Water color must now paint aquarelle on the Studio canvas (wet-in-wet bloom, tide
line) and record → play → bake must come from one engine per script.

**Do not close Phase 56 until A1–A5 are user-asserted.**

## Known scope notes

- Preview sim resolution may be reduced for framerate; A1/A2/A3 are judged on the
  recorded path (play/bake), which steps the full record.
- Physics engine is still mounted (hidden + input-locked) during Water color so the
  Roto script persistence path keeps working. Switching back to Brush restores it.
- The unknown-layer lookup debug (`.planning/debug/roto-unknown-physic-layer.md`)
  stays on its own track and was not touched.
