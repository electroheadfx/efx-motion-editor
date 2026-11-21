# Live-seed — the live sheet carries the committed paint

Reference for `Skill("efx-studio-paint")`. The code is the authority:
`packages/efx-watercolor/src/bake/aquarelleSeed.ts`, the seed controller in
`app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`, and the
seeded capture branch in `PhysicsPaintStudio.tsx`.

## The law (2026-11-22, artist decision — supersedes the replay)

**A key opens on its CACHE. The Studio never replays recorded strokes.**

- The displayed base is the key's committed cached image (the underlay); the
  live sheet starts blank.
- A key revisited in the SAME session uploads the exact sheet it was left with
  (`Engine.captureSheet()` / `restoreSheet()`, the same layer capture a saved
  document uses) — an upload, never a replay. Validated by the frame's script
  signature (mutation id + sample count per event) and bounded to 3 frames /
  256 MB.
- `seedAquarelleEngine` and its host slicing remain in the package (probe and
  parity work), but the Studio layer no longer calls it.

The acrylic carrier's pickup chain samples the engine's own sheet:

    pickup = clamp(rate * thirst * travel * wet * touch * liftGate, 0, 0.75)
    wet    = mean3(exp(-age / wetSeconds) * clamp(cover / floor, 0, 1))

`canvasAt` / `wetAt` read ink, fixed, cover and last-touch — a display-only
underlay is invisible to them. Consequence of the cache law: on the FIRST
visit of a painted key in a session (blank sheet) the first strokes do not
pick up the committed base; they still paint and composite correctly over the
cached image. Do not reintroduce a stroke replay to restore that drag. If the
artist wants base pickup back without a replay, the sanctioned direction is a
pickup-side read of the committed cache image (shader change + pickup UAT),
not a replay.

Historical note (refuted mechanism): tapping the display raster as the pickup
base alone never worked — the raster has no touch field and cannot be re-wet
(measured pickup 0.0000 after a 20 s pause; reverted 8e1364aff → e51c52764).

## `seedAquarelleEngine` (package seam — no longer called by the Studio)

Retained for the probe/parity work; if it is ever re-introduced, these laws
still hold: the script is read through the Studio getter with the commit's
transform (`withAquarelleReplayGrid`, Dry clones), the engine runs manual with
recording off, one mode-switched clock, `resetSheet()` first, and the bake's
`frameCount: 1` replay with the capped settle (`fix()` + 72 ticks), handing
the engine back in `finally`. The bake's `yieldToHostMs` slices the replay so
it never owns the main thread.

## Never stack (restored sheet)

- **Display:** `syncUnderlay` binds `null` while `aquarelleSheetSeeded`;
  `aquarelleBaseCompositedLive = painted && (underlayApplied ||
  aquarelleSheetSeeded)`. A BLANK sheet (a first-visit key) binds the cached
  image as the underlay — the app's cache law.
- **Capture:** `handleAquarelleCaptureFrame` merges with `base: null` when
  `aquarelleSheetSeeded` — the restored sheet already contains the base.
  Roto promotion/Lift composites keep their laws.

## Cost (cache law)

No stroke replay in the Studio. Key changes cost:

| event | cost |
|---|---|
| key leave | pixel capture + one GPU readback of the sheet (`captureSheet`, everPainted rect) |
| key return (visited this session) | one texture upload (`restoreSheet`) — no replay |
| key return (not visited this session) | nothing: the sheet starts blank over the cached image |
| Studio open | nothing beyond the normal mount |

Replay numbers below are retained for the PACKAGE seam (`seedAquarelleEngine`)
and the probe, not for the Studio:

| surface | base dabs | replay | phases |
|---|---|---|---|
| 1080×1080 | 240 | 1.84 s | replay 1.76 s / settle 1 ms / capture 80 ms |
| 1920×1080 | 457 | 3.41 s | replay 3.32 s / settle 1 ms / capture 87 ms |

### Sheet cache (2026-11-22)

`Engine.captureSheet()` / `restoreSheet()` expose the exact layer set
(`captureWhole`/`uploadWhole`, no paper/history/view). The layer captures the
sheet when the artist LEAVES a frame and restores it on return (one texture
upload). Entries are keyed by the frame's script signature (mutation id +
sample count per event); any script edit mismatches and the key opens blank
over its cache. Bounded: 3 frames / 256 MB, LRU; a single sheet over half the
budget is never cached. `getSeedEvents` takes the FRAME so the layer can sign
the frame it is leaving.

The package's `yieldToHostMs` slicing stays (the bake seam is still used by
`seedAquarelleEngine` and the probe) but the Studio no longer drives a replay.

### Re-render adoption (2026-11-23)

A re-render (Apply, a script edit, the artist's manual rebake) hands its bake
engine's EXACT sheet to the live layer (`bakeAquarelleEventsToFrame` →
`onSheet` → `adapter.captureSheet()` → the layer's `adoptSheet` →
`engine.restoreSheet`). The live engine then holds the committed base, so
painting over it blends and picks up like a fresh bake — no stroke replay and
no rebake per stroke. The sheet stores last-touch as AGES and the restore
re-stamps them on the live clock: the bake runs a virtual clock from 0, so a
raw stamp would read as ancient on the live engine and the base would never
blend. When each engine `nowSec()` starts at 0 after the restore's
`resetSheet()`, `stamp = 0 - age` is the correct negative-origin encoding.

Flow: open a painted key → cached image only (no blend) → trigger the
re-render once → the sheet is adopted → every later stroke blends/picks up.
The first-visit no-blend residual above still applies; adoption is the
artist-sanctioned base rebuild.

## Verification

- Probe `packages/efx-watercolor/probe/pickup-collapse/` (`run.mjs`):
  `app-seeded` vs `app-bake` at `--gap 20000`, same scene/size/pins; compare
  FINAL PIXELS, not carrier readouts. Acceptance: identical `meanRgb` and
  samples; pickup-0 control unmixed on both.
- Seed determinism: `committedVsSeeded {0,0,0}` (the seed and the commit are
  the same replay path).
- Pins: `packages/efx-watercolor/src/playground/liveSeed.test.ts` (undo
  suppression, seed law, adapter injection, handoff-on-failure, sheet-cache
  seam) and `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts`
  (KEY = CACHE: no replay symbol in the layer, restore-on-return, blank key
  over the cached image, never-stack display, restored capture `base: null`).

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
- The sheet cache must be validated by the frame's SCRIPT SIGNATURE: restoring
  a sheet after the script changed (undo, delete, edit elsewhere) would show
  paint the script no longer owns. `restoreSheet` also refuses a size mismatch.
- Known residuals (blank-sheet keys): no base pickup on the first strokes of a
  first-visit key; the filter-mode eye cannot hide a RESTORED sheet's paint
  (a blank key's cached image hides normally); the gather's mid-stroke smear
  read is sheet-only (live < bake).

## Origin

Phase 64 debug `pickup-collapse-live` (2026-11-21, UAT approved). Evidence:
the pickup chain was intact (spike 003) but the first live dab read an empty
sheet; the display-raster tap was refuted at a 20 s pause; the seeded replay
matched the re-bake byte-for-byte at 20 s for pickup 100 and the pickup-0
control. Session record: `.planning/debug/resolved/pickup-collapse-live.md`.
