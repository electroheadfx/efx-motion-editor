---
phase: 04-drying-persistence
plan: "02"
subsystem: persistence
tags: [serialization, save-load, replay, physics-aware]

# Dependency graph
requires:
  - phase: 04-drying-persistence
    plan: "01"
    provides: "LUT-driven drying system"
provides:
  - "Stroke serialization to compact JSON (serializeProject)"
  - "Canvas settings round-trip (bgMode, paperGrain, embossStrength, wetPaper)"
  - "Physics-aware replay with timestamp-driven fast-forward"
  - "Save/Load UI buttons"
affects: [05-library-demo-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [compact-point-arrays, physics-fast-forward-replay, blob-download]

key-files:
  created: []
  modified: [efx-paint-physic-v3.html]

key-decisions:
  - "Compact point arrays [x,y,p,tx,ty,tw,spd] instead of object format for file size"
  - "Physics interval paused during replay for determinism"
  - "Capped replay ticks at 500 (50s max between strokes)"
  - "Wet-layer path used for load replay instead of directRender"
---

## One-liner

Stroke serialization, save/load persistence, and physics-aware replay for painting files.

## What was built

- `serializeProject()` — creates compact JSON with canvas settings + strokes as point arrays
- `loadProject(json)` — restores canvas environment and replays strokes with physics fast-forward
- `replayWithPhysics(strokes)` — timestamp-driven replay with inter-stroke physics ticks
- `saveProject()` / `loadProjectFromFile()` — file download and picker UI
- Save/Load buttons in toolbar

## Commits

- `593d306` feat(04-02): add stroke serialization, save/load persistence, and physics-aware replay
- `eace296` fix(04): address checkpoint feedback — dead tools, save/load artifacts, tool sensitivity
- `8ebbc8b` fix(04): fix save/load visual fidelity — use wet-layer path instead of directRender

## Known Limitations

1. **Load visual fidelity**: Loaded paintings do not render identically to the original. The replay path produces visibly different results compared to live painting. Root cause: the replay dispatches strokes in a tight loop without the real-time physics interleaving that happens during live painting.
2. **Physics simulation non-functional**: Flow, diffusion, and transport physics never produced meaningful visual results. The wet/dry/blow tools depend on physics that don't actually work, so replay of those tools is also non-functional.
3. **No SUMMARY written during execution** — closed retroactively with known limitations documented.

## Status

Complete with known limitations. Issues 1 and 2 are deferred to a new physics rework phase.
