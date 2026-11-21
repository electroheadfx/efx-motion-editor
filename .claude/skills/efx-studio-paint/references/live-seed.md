# Live-seed — the live sheet carries the committed paint

Reference for `Skill("efx-studio-paint")`. The code is the authority:
`packages/efx-watercolor/src/bake/aquarelleSeed.ts`, the seed controller in
`app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`, and the
seeded capture branch in `PhysicsPaintStudio.tsx`.

## The law

The acrylic carrier's pickup chain samples the engine's own sheet:

    pickup = clamp(rate * thirst * travel * wet * touch * liftGate, 0, 0.75)
    wet    = mean3(exp(-age / wetSeconds) * clamp(cover / floor, 0, 1))

`canvasAt` / `wetAt` read ink, fixed, cover and last-touch. A display-only
underlay is invisible to them. The live sheet must therefore BE continuous with
the committed paint: at mount, after every `resetSheet()` and on a debounced
frame change, the committed script is replayed into the LIVE engine. The first
live stroke then finds the same converged fields a re-bake finds, and its own
touch pass re-wets the base — the exact mechanism that makes Pickup 100 drag
after an arbitrary pause.

Do not "fix" first-paint pickup by tapping the display raster. A raster can only
be stamped once at bind; it dries out (`wetSeconds` 7 s) and the stroke cannot
re-wet it. Measured after a 20 s pause: pickup 0.0000 at every sampled dab, the
base visible through a translucent yellow stroke. Reverted (8e1364aff →
e51c52764).

## Mechanism (`seedAquarelleEngine`)

1. The layer reads the frame's committed script through the Studio getter and
   applies the SAME transform the commit applies: Dry events cloned, vector
   strokes passed through `withAquarelleReplayGrid`. Commit == seed.
2. `seedAquarelleEngine({ engine, events, width, height })`:
   - `engine.setManual(true)`, `engine.setStepRecording(false)`;
   - ONE `setClock(clockNow)` closure — seed mode advances `seedMs`, the
     handoff reads `seedEndMs + (performance.now() - realBase)`. Never a second
     `setClock` (a re-base resets every age to 0);
   - `engine.resetSheet()` — naked sheet on the artist's own paper, no undo;
   - an injected `createAquarelleEngineAdapter({ engine, clock })` plus the
     same `createAquarelleBake` the commit uses, `frameCount: 1`, stub encoder;
   - `bake.bake(events)` replays the committed dabs with their per-stroke seeds
     and the app's capped settle (`fix()` + 72 ticks);
   - `finally`: handoff (recording on, manual off, clock to real time), dispose
     adapter/bake — never the engine.
3. The layer owns the surface for the seed's duration: pointer refused,
   `snapshot()` null, flush/dry/settle/frame-leave captures skipped, rAF config
   writes skipped. A 250 ms frame debounce plus one `seedChain` and a
   generation token make a scrub burst seed only the landing frame and a
   superseded seed unreachable.

## Never stack (seeded)

- **Display:** `syncUnderlay` binds `null` while
  `seeding || aquarelleSheetSeeded`; `aquarelleBaseCompositedLive = painted &&
  (underlayApplied || aquarelleSheetSeeded)` so the cached base element steps
  aside. The underlay product `t' = t_sheet × t_base^(1 − cover)` applies only
  to the non-seeded fallback.
- **Capture:** `handleAquarelleCaptureFrame` merges with `base: null` when
  `aquarelleSheetSeeded` — the exported sheet already contains the base.
  Roto promotion/Lift composites keep their laws.
- **Undo:** `setStepRecording(false)` prevents `beginStep`, `recordChange` and
  every `protect`; the seed is never an undo step.

## Cost

Replay-dominated and linear in the committed dab count:

| surface | base dabs | seed | phases |
|---|---|---|---|
| 1080×1080 | 240 | 1.84 s | replay 1.76 s / settle 1 ms / capture 80 ms |
| 1920×1080 | 457 | 3.41 s | replay 3.32 s / settle 1 ms / capture 87 ms |

Headless Chrome SwiftShader = CPU upper bound; the app GPU is faster, but the
feed is JS/CPU work. The pointer is refused for the window. If a slowdown is
reported, measure `seedMs` / `seedPhases` (probe `app-seedcost`) BEFORE touching
the display or compositing path. Mitigations if the artist rejects the pause
(lazy seed on first pointerdown, per-frame seed cache, visible-region seed) are
NOT shipped; choosing one is a design decision, not a bug fix.

## Verification

- Probe `packages/efx-watercolor/probe/pickup-collapse/` (`run.mjs`):
  `app-seeded` vs `app-bake` at `--gap 20000`, same scene/size/pins; compare
  FINAL PIXELS, not carrier readouts. Acceptance: identical `meanRgb` and
  samples; pickup-0 control unmixed on both.
- Seed determinism: `committedVsSeeded {0,0,0}` (the seed and the commit are
  the same replay path).
- Pins: `packages/efx-watercolor/src/playground/liveSeed.test.ts` (undo
  suppression, seed law, adapter injection, handoff-on-failure) and
  `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts`
  (mount/reset/frame-change triggers, chain + generation, capture gates,
  never-stack display, seeded capture `base: null`).
- UAT names the surface: first live paint / after settle / after move; pickup
  100 agrees, pickup 0 stays unmixed.

## Pitfalls

- A second `setClock` after the replay resets `timeBaseMs` → every seeded age
  reads 0 → the whole base is "wet" for E seconds. Use the one-closure handoff.
- Suppressing only `scriptBegin` is not enough: `fix()` always begins a Dry step
  and `history.protect` writes into the last existing step. Guard the
  engine-wide `setStepRecording`.
- The seed getter must apply `withAquarelleReplayGrid`; the raw timeline replays
  vector strokes at the wrong cadence and breaks commit == seed.
- A second engine on the live canvas double-owns the WebGL context. Inject the
  live engine into the adapter; injected `dispose()` must never destroy it.
- `snapshot()` / flush / capture must return null or skip while seeding — a
  half-seeded film must never reach the cache, a save or a thumbnail.
- Known residuals: the filter-mode eye cannot hide the committed paint on a
  seeded sheet; the gather's mid-stroke smear read is sheet-only (live < bake).

## Origin

Phase 64 debug `pickup-collapse-live` (2026-11-21, UAT approved). Evidence:
the pickup chain was intact (spike 003) but the first live dab read an empty
sheet; the display-raster tap was refuted at a 20 s pause; the seeded replay
matched the re-bake byte-for-byte at 20 s for pickup 100 and the pickup-0
control. Session record: `.planning/debug/resolved/pickup-collapse-live.md`.
