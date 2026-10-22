---
status: resolved
trigger: "studio-multi-track-composite-shows-only-selected — Studio, several tracks, NONE soloed, NONE hidden: the canvas shows ONLY the selected/active track. Expected: every visible track composites (D-04). Solo is the ONLY way to view one track alone."
created: 2026-10-22
updated: 2026-10-22
---

# Debug Session: studio-multi-track-only-active

## Symptoms

- **Expected behavior:** every visible track composites when no solo is armed and no track is hidden (D-04). Solo is the ONLY way to view one track alone.
- **Actual behavior:** in Studio's program monitor, the canvas shows only the selected/active track's paint; paint from other visible tracks is missing.
- **Errors:** none.
- **Timeline:** regression — it worked before; exact break point unknown.
- **Reproduction:** open Studio with 2+ tracks having paint on the SAME frame, no solo armed, no hide armed. Expected both tracks composite; only the active track appears.

## Oracle (locked — do not rewrite)

- **D-04** (`efxPaintHideSolo.ts`): no solo armed -> every visible track participates; any solo armed -> only visible AND soloed; hide wins over solo.
- **D-05** (`PhysicsPaintProgramMonitor.tsx`): editing mode excludes ONLY the active track from the flattened base because the live engine supplies its pixels (T-48-16 anti double-apply). Playback draws the FULL composite.

## Constraints

- Do NOT patch by forcing the editing base (violates T-48-16).
- Do NOT change the D-04 truth table — it is not the fault.
- `vitest run` (never watch). Visual verdict = live UAT only.
- Live evidence over unit probes for this cross-webview/canvas path — app-written JSON captures to /tmp, read from disk.

## Evidence needed (from user)

1. Reproduce with 2+ tracks having paint on the SAME frame, no solo, no hide.
2. Probe the flattened record at that frame: does `getFlattenedFrame` include both tracks? does `getFlattenedFrameExcluding(active)` include the non-active track? App-written JSON to /tmp, read from disk.
3. If the flatten is correct, check the stacking: is the engine surface or the fond covering the program monitor? (opacity / z-index / mix-blend)

## Ranked suspects

1. `getFlattenedFrameExcluding` returns empty for non-active tracks.
2. Stacking cover: engine canvas (or fond) covers the program monitor.
3. A selection-gated filter introduced outside D-04 (store-side).

## Current Focus

- hypothesis: FOUR defects confirmed and fixed. (1) Legacy cached frames carried an opaque white matte. (2) The active track's live overlay was appended after the whole composite (selection overrode the stack). (3) The compositor drew `order` ascending as bottom-to-top, but `order 0` is the UI's TOP row / TOP layer (`addTrack` inserts at 0) — so the whole stack was inverted. (4) After the matte repair the raster became real-alpha, so the 1x1 opacity probe switched the editor's fond draw from `multiply` to `source-over`; the Studio multiplies paint over paper once, so the editor/export were brighter. The near-white wash fringe also stayed opaque after exact-white removal, which source-over revealed as a white veil.
- test: Compositor draws the track list in reverse (bottom row first, top row last) and places the overlay at its ordered slot; the matte strip removes the near-white wash (channel cutoff 240); the fond branch always draws the mixed paint with `multiply`.
- expecting: Paint 3 (top row) renders topmost, Paint 1 middle, Paint 2 at the bottom, regardless of selection; Studio and editor show the same composite — same paper, same pigment density, no white veil.
- next_action: Closed — live UAT approved 2026-10-22. If the 240 cutoff ever erases too much light paint on legacy frames, tune the cutoff (235 more aggressive, 245 more conservative).
- bug_class: null
- reasoning_checkpoint: null
- tdd_checkpoint: null

## Eliminated

<!-- APPEND only -->

- D-04 truth table (`participatingPaintTracks`, `efxPaintHideSolo.ts`) — re-read line by line; matches the locked oracle exactly (no solo armed -> every visible track; solo -> visible AND soloed; hide wins). Not the fault.
- `getFlattenedFrameExcluding(active)` dropping non-active tracks — pinned by test (b): two seeded roto tracks, the editing base keeps track-b content and omits only track-a. Test (e) pins hidden-active exclusion. 12/12 monitor tests green.
- Flattened cache-key staleness between including and excluding variants — key carries the sorted `excl:` term and `fond:0`, so the two variants never collide.
- Track-scoped roto resolution leaking the active track — all resolution maps (`_rotoRealKeyRecords`, structural cache, interpolation, loop clips, capacity) are keyed `(layerId, trackId)`; the only `activeTrackId` reads are the D-09 fond/paper choice.
- Alpha-canvas prune collateral (`_pruneUnreferencedRotoAlphaCanvases`) — global-reference-aware: a token is pruned only when no track/layer references it, so publishing one track never deletes another track's canvas.
- Launch hydration installing only the active track — `hydrateRotoPhysicalLaunchContext` installs EVERY carried track's physical document and pre-decodes all inline bytes.
- `reanchorRotoRuntimeFrames` wiping other tracks — per-track moves only; a frameless realm and an unchanged record set are no-ops; source frames are snapshotted before any write.
- Studio child realm missing tracks in its document — the launch carries the full v1.0 document; `registerDocument` installs it wholesale.
- Monitor component filtering tracks itself — the component never filters; it only selects which store path to read.

## Evidence

<!-- APPEND only -->

- timestamp: 2026-10-22 — Static: D-04 truth table, D-05 exclusion path, composite order/blend, flattened key derivation, track-scoped roto structural resolution, alpha-canvas prune and launch hydration all reviewed; no defect found on the compositor/store contract.
- timestamp: 2026-10-22 — Tests (`vitest run`): `physicsPaintProgramMonitor.test.ts` 12/12 and `efxPaintHideSolo.test.ts` 6/6 green. Editing base contains non-active track-b; playback draws both; hidden active excluded.
- timestamp: 2026-10-22 — Instrumentation added: `app/src/lib/programMonitorCapture.ts` writes `/tmp/studio-multi-track-only-active.json`; `PhysicsPaintProgramMonitor` calls it at the draw seam with the drawn record, the full including record, the excluding probe, and stacking styles/canvas probes. Capture is gated to the live Tauri webview (`__TAURI_INTERNALS__`), so the unit harness pays nothing; tests remain 18/18 green.
- timestamp: 2026-10-22 — Pending: live reproduction by the user, then read the capture from disk (base-content fact vs cover fact vs selection-gated filter).
- timestamp: 2026-10-22 — LIVE CAPTURE parsed (38 `monitor-draw` events, frames 2/3/6/7/8; user cycled 3 tracks). Document: 3 tracks, ALL visible, NONE solo; `participating` = all 3. At frame 2 track c4868e73 reports `missingRefs: 0` (absence, not a dangling source), so two tracks carry paint on the shared frame.
- timestamp: 2026-10-22 — LIVE FLATTEN CONTRACT HOLDS: `full` center = `212,228,239` every time. `excluding` differs exactly by active track: excluding eeccc14c -> `236,171,193`; excluding 1aa3adf6 or c4868e73 -> `212,228,239`. The store does keep non-active content. Suspect 1 eliminated live.
- timestamp: 2026-10-22 — OVERLAY PATH: `PhysicsPaintStudio.tsx:4987` passes `engine.getBakedCanvas()` as `liveOverlay`; `_resolveFlattenedFrame` (physicPaintStore.ts:2832-2858) composites it LAST over the excluding raster. With a liveOverlay the store BYPASSES the memo read (2773) and does NOT memo-write (2964), yet the record keeps the same `cacheKey` as the overlay-less excluding record. Consequence: one cacheKey maps to different pixels across events (335-848b801 was blue at events 26-29, pink at event 37). The capture's `excluding` probe calls the store WITHOUT liveOverlay, so `drawn` vs `excluding` mismatches are expected and not the bug.
- timestamp: 2026-10-22 — CAPTURE ORDER: `captureProgramMonitorState` runs BEFORE the actual `ctx.drawImage` (PhysicsPaintProgramMonitor.tsx:170 vs 205-207), so every `programMonitorCanvas` probe is one draw behind. Drawn-vs-monitor-probe mismatches are an artifact; do not classify from them.
- timestamp: 2026-10-22 — ENGINE SURFACES at the latest event: child1 z2 `opacity:0` coverage 1 (content present); child2 z4 `opacity:0` empty; child3 z4 `opacity:1` empty. No opaque engine canvas is visible, but the `liveOverlay` canvas itself is NOT probed. Its content did not track the active selection in the captured window (blue while eeccc14c was active at events 26-29; pink after switching away, still pink when eeccc14c was active again at event 37) — possible stale previewBase or overlay content, pending the direct probe.
- timestamp: 2026-10-22 — NEXT PROBE: add a liveOverlay direct probe (alpha histogram, coarse color grid, PNG to /tmp) and move the capture after the draw. This distinguishes an opaque cover (paper/full-frame pixels) from a transparent strokes-only overlay whose base should show through.
- timestamp: 2026-10-22 — INSTRUMENTATION v2 (measure-only, not a fix): `programMonitorCapture.ts` now probes the liveOverlay canvas directly (64x64 alpha histogram in 6 buckets, `fullyOpaqueFraction`, `anyAlphaFraction`, 4x4 RGBA color grid) and writes a latest-only 320px PNG thumbnail to `/tmp/studio-multi-track-only-active-liveoverlay.png` (re-encoded at most every 1.5 s; every event carries `liveOverlayPngAt`). `PhysicsPaintProgramMonitor` now calls the capture AFTER the draw on every exit path (no-record / key-unchanged / raster draw), so `programMonitorCanvas` probes are current. `vitest run physicsPaintProgramMonitor.test.ts` 12/12 green; `tsc --noEmit` reports no errors in either touched file (pre-existing errors elsewhere untouched).
- timestamp: 2026-10-22 — PENDING: live reproduction by the user (paint 2+ tracks on one frame, cycle the active track, return to the first), then parse the JSON + inspect the overlay PNG.
- timestamp: 2026-10-22 — V2 LIVE RESULT — COVER CONFIRMED. 33 events. Last two selections: event 31 active 1aa3adf6, event 32 active c4868e73. In both, `liveOverlayProbe.alphaHistogram = [0,0,0,0,0,1]`, `fullyOpaqueFraction = 1`, `anyAlphaFraction = 1`; the 4x4 color grid is `255,255,255,255` in 12-13 of 16 cells with paint in the rest. `/tmp/studio-multi-track-only-active-liveoverlay.png` is an opaque white sheet carrying only the active track's paint. The correct excluding base is underneath (`excluding.raster.center = 212,228,239` while `drawn.raster.center = 236,171,193` / `208,224,234` after the overlay composite). The white overlay is the cover: D-05's base is correct, the overlay composited last is opaque.
- timestamp: 2026-10-22 — V3 INSTRUMENTATION (measure-only): engine `isVisibleBackgroundSuppressed()` getter, Studio passes `liveOverlayPaintSource` (engine `getPreviewBasePaintSource()`) and `liveOverlayBackgroundSuppressed`; capture emits `liveOverlayPaintSourceProbe` + the flag under codeMarker `multi-track-only-active-v3`. Purpose: locate the white's origin (cached paint bytes vs engine bg draw). `tsc --noEmit` clean for all touched files.
- timestamp: 2026-10-22 — V3 LIVE RESULT: `liveOverlayBackgroundSuppressed: true`, `liveOverlayPaintSourceProbe.alphaHistogram = [0,0,0,0,0,1]` — the white is in the CACHED PAINT SOURCE, not the engine background draw. The project's own frame files confirm it: Paint 3 f2 `fcdb7ea2…webp`, Paint 1 f2 `cbc2a5ec…webp`, Paint 2 f2 `dc8fddc2…webp` are all fully opaque with corner `(255,255,255,255)`; a correctly captured key (e.g. Paint 3 f9 `c3e6a01b…webp`) is real-alpha (0.9% painted, 0 opaque).
- timestamp: 2026-10-22 — OFFLINE REPAIR PROOF: stripping exact pure-white pixels from the three frame-2 keys and compositing in track order produces one image with all three tracks (Paint 3 blue ring, Paint 1 pink/yellow, Paint 2 maroon). `/tmp/mt-active-composite-test.png`.
- timestamp: 2026-10-22 — FIX (read seams + writer): `app/src/lib/opaqueWhiteMatte.ts` strips the exact corruption signature (fully opaque, pure-white corners, some non-white content); applied in `physicPaintStore._decodeWebpToBitmap` (media frames), `rotoCanvasFrames.registerRotoAlphaCanvasFrameFromBytes` (hydrated registry canvases), `physicsPaintRotoAlphaMerge.loadCachedRotoBaseImage` (merge base, prevents re-baking), and `EfxPaintEngine.applyPreviewBaseImage` (active live overlay, memoized per dataUrl). `copyLiveAlphaCanvas` now subtracts the background unless `visibleBackgroundSuppressed` — the old `previewBackgroundSeparated`-only condition skipped subtraction on applied bases and baked the matte.
- timestamp: 2026-10-22 — TESTS: `opaqueWhiteMatte.test.ts` 5/5; `physicsPaintProgramMonitor.test.ts` 12/12; `physicsPaintRotoAlphaMerge.test.ts` 6/6; `efxPaintCleanBreakContract.test.ts` 3/3. FULL SUITE: 308 files passed | 2 skipped; 5389 passed | 1 skipped | 96 todo. Engine package `tsc --noEmit` clean; app `tsc --noEmit` clean for all touched files. Diagnostic capture instrumentation removed (measure-only, not part of the fix). Live UAT pending.
- timestamp: 2026-10-22 — LIVE UAT ROUND 2 (matte fix): all three tracks now appear together, so the matte repair works. NEW STACK DEFECT: the active track is always topmost — Paint 3 top, Paint 1 middle, Paint 2 bottom in the track list, but selecting Paint 1 or Paint 2 renders it above Paint 3. Cause: `_resolveFlattenedFrame` appended `liveOverlay` AFTER `compositeFrame`, so the selected track always overrode layer order.
- timestamp: 2026-10-22 — FIX (stack order): the compositor gained an `engineOverlay` port. `compositeFrame` substitutes the overlay raster at the excluded track's ordered slot (with that track's opacity/blend and the first-track source-over rule) instead of skipping that track; `_resolveFlattenedFrame` passes `{ trackId, raster: liveOverlay }` and the post-composite last-draw block is removed. The overlay stays inside the base before `applyPaperPass`. New compositor test pins bottom → overlay → top draw order; U2 source guard updated to the new seam. FULL SUITE green: 308 files | 2 skipped; 5390 passed | 1 skipped | 96 todo.
- timestamp: 2026-10-22 — LIVE UAT ROUND 3: (a) the whole stack is INVERTED — the list's top row (Paint 3, order 0) renders at the BOTTOM, the bottom row (Paint 2, order 3) on top. (b) The bright look is in BOTH Studio and editor. The inversion's cause: `participatingPaintTracks` returns `order` ascending, which the compositor treated as bottom-to-top, but `order 0` is the UI's TOP row (`addTrack` inserts the new track at array front with order 0; the Background sits beneath all rows). The bright look's cause: exact-white removal leaves the near-white WASH fringe opaque; the Studio's paper multiply hides most of it, while the editor's source-over shows it as a white veil.
- timestamp: 2026-10-22 — FIX (inversion): the compositor now draws `considered` in REVERSE document order (bottom row first, top row last); `participates.trackIds` stays in document (top-to-bottom) order. Matrix/compositor/store tests updated to the order-0-is-top convention. Offline cutoff tests: a 240 channel cutoff removes the near-white wash veil while keeping the paint; 235 is more aggressive, 245 leaves haze.
- timestamp: 2026-10-22 — FIX (near-white matte): `stripOpaqueWhiteMatte` and the engine's duplicate now treat every fully opaque pixel with all RGB channels >= 240 as matte (not just exact white), preserving the corruption-signature detection (near-white corners + at least one pixel below the cutoff). FULL SUITE green: 308 files | 2 skipped; 5391 passed | 1 skipped | 96 todo.
- timestamp: 2026-10-22 — LIVE UAT ROUND 4: stack order is correct, but the editor is still brighter/washed out than the Studio. User screenshot (real paint stack) sampled: editor yellow stroke `(253,252,215)`; Studio reference `(209,188,128)`; paper corner `(213,194,157)`. `(253,252,215) x paper / 255 = (211,192,132)` — Studio is EXACTLY the editor pixel multiplied by the paper. Paper corners match between both surfaces (studio `213,194,157`; editor `210,191,154`), so the fond is identical; only the paint-over-fond op differs.
- timestamp: 2026-10-22 — ROOT CAUSE 5: after the matte repair the flattened raster became real-alpha, so `isOpaqueRaster` (a 1x1 top-left probe) returned false and `_resolveFlattenedFrame` switched the fond draw from `multiply` to `source-over`. The Studio's tracks group multiplies the paint over its paper fond exactly once (brush one-law, `physicsPaintStudio.css:6550`), so the editor/export were the only surfaces drawing pigment source-over — brighter, with the residual light wash showing as a white veil. The Studio was never wrong here; it was hiding the matte with multiply.
- timestamp: 2026-10-22 — FIX (fond law): the fond branch now ALWAYS draws the mixed paint with `multiply`, matching the Studio's one-law for brush and aquarelle alike; `isOpaqueRaster` deleted (unused). Store tests updated to the `draw(canvas,1,multiply)` fond op. Offline proof from the project's real frame-2 WebPs: source-over vs multiply composite — multiply reproduces the Studio look. FULL SUITE green: 308 files | 2 skipped; 5391 passed | 1 skipped | 96 todo; app `tsc --noEmit` clean for the touched files (pre-existing errors elsewhere untouched).
- timestamp: 2026-10-22 — LIVE UAT ROUND 5 — APPROVED. All three tracks composite; stack order follows the list (Paint 3 top, Paint 1 middle, Paint 2 bottom) regardless of selection; Studio and editor now show the same paper-multiplied pigment with no white veil. Session closed.

## Resolution

- root_cause: >
  Four contributing defects. (1) Legacy Roto cache frames carry the engine's
  white background baked in — each frame is fully opaque with near-white
  corners. Paint tracks are pigment layers; only the document fond may be
  opaque. The compositor draws each track source-over, so every opaque frame
  covers the tracks beneath it. The capture writer could bake the matte because
  `copyLiveAlphaCanvas` skipped background subtraction whenever
  `previewBackgroundSeparated` was true, even in a host whose visible engine
  background is drawn into the dry canvas. (2) The Studio's live overlay (the
  active track's `getBakedCanvas()` = preview base + dry) was appended AFTER
  the whole composite, so the selected track always rendered topmost — the
  selection overrode the layer stack. (3) The compositor treated `order`
  ascending as bottom-to-top, but `order 0` is the UI's TOP row / TOP layer, so
  the entire stack rendered inverted. (4) The editor's fond branch chose
  `multiply` only when the raster's top-left pixel was opaque; once the matte
  repair gave the paint real alpha, the editor/export switched to `source-over`
  while the Studio keeps multiplying its tracks group over the paper once. The
  same pigment therefore read brighter in the editor, and the residual
  near-white wash showed as a white veil. Exact-white matte removal also left
  that near-white fringe opaque initially.
- fix: >
  (1) `stripOpaqueWhiteMatte` + `stripOpaqueWhiteMatteFromCanvas` repair the
  corruption signature at every read seam: media decode
  (`_decodeWebpToBitmap`), hydrated alpha canvases
  (`registerRotoAlphaCanvasFrameFromBytes`), the engine's preview base (active
  live overlay, memoized per dataUrl), and the cache merge base (prevents
  re-baking). The matte now removes every fully opaque pixel at/above the
  240 channel cutoff, so the near-white wash veil is gone. (2)
  `copyLiveAlphaCanvas` subtracts the background unless the engine's visible
  background is suppressed, so future captures store paint-only frames. (3)
  The compositor gained an `engineOverlay` port: the overlay replaces the
  excluded track's store raster INSIDE the ordered track loop (opacity/blend
  and first-track rule preserved), and the loop now walks the document order
  in REVERSE (bottom row first, top row last), so selection never changes the
  stacking and the list order matches the visual stack. (4) The fond branch
  always draws the mixed paint with `multiply`; this is the Studio's brush
  one-law (the tracks group multiplied by the paper once), applied to both
  real-alpha engine paint and aquarelle transmittance. `isOpaqueRaster`
  (the 1x1 probe that flipped the op after the matte repair) is deleted. No
  change to D-04 or the D-05 exclusion base (T-48-16).
- verification: >
  Offline: the three actual frame-2 keys composite into one image after the
  matte strip; the 240 cutoff removes the white veil; rendering that stack
  source-over vs multiply over the sampled paper shows multiply reproduces the
  Studio screenshot (editor yellow 253,252,215 x paper 213,194,157 =
  211,192,132 vs Studio 209,188,128). Unit: matte 6/6, program monitor 12/12,
  merge 6/6, clean-break contract 3/3, compositor 22/22 (overlay-slot pin +
  order-0-is-top matrix), paper-pass guard 16/16, store 121/121.
  Full suite: 308 files passed | 2 skipped; 5391 passed | 1 skipped |
  96 todo. Types: engine package clean; app clean for all touched files.
  Live UAT pending — reload, then verify stack order + brightness in both
  surfaces.
- residual: >
  Legacy frames lost their true alpha when the white background was baked in.
  The 240 cutoff removes the white veil but very light paint above the cutoff
  becomes transparent; lower the cutoff (e.g. 235) if too much light paint is
  lost, raise it if haze remains. New captures are paint-only and unaffected.
- files_changed:
  - app/src/lib/opaqueWhiteMatte.ts
  - app/src/lib/opaqueWhiteMatte.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/lib/rasterAlpha.ts
  - app/src/efx-paint/compositor/efxPaintCompositor.ts
  - app/src/efx-paint/compositor/efxPaintCompositor.test.ts
  - app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts
  - app/src/stores/physicPaintStore.test.ts
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
