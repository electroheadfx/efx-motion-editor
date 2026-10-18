---
status: resolved
trigger: watercolor-clears-cached-paint-on-key — REGRESSION: painting with watercolor on a key that ALREADY has cached paint CLEARS the cache instead of compositing the new stroke over the existing paint when it builds the new cache. The inverse works: painting with a normal (engine-1) brush on a key that has cached paint composites correctly. So the bug is aquarelle-specific — the new watercolor capture/cache-write replaces the frame's pixels instead of merging over them. Ride existing machinery — no new cache system. The frame-cache write path is `_resolveFlattenedFrame` / captureLivePixels / aquarelle bake in physicPaintStore + AquarelleCanvasLayer + useRotoFramePersistenceCoordinator. Live evidence over unit probes; instrument via /tmp JSON capture if needed. Likely the aquarelle frame-leave capture or the flatten step starts from a blank canvas instead of the existing cached bytes.
created: 2026-10-18
updated: 2026-10-18
---

# Debug Session: watercolor-clears-cached-paint

## Symptoms

- **Expected behavior:** painting with watercolor on a key that already has cached paint COMPOSITES the new stroke over the existing paint when the new cache is built.
- **Actual behavior:** the new watercolor stroke CLEARS/REPLACES the cached paint instead of compositing over it. The existing paint is lost.
- **Errors:** none reported.
- **Timeline:** regression — the user just found it. The inverse direction works (normal/engine-1 brush composites correctly over cached paint), so this is aquarelle-specific.
- **Reproduction:** paint something on a key (cache gets built) → switch to watercolor → paint another stroke on the SAME key → the new cache contains only the watercolor stroke; the earlier paint is gone. Reverse order (watercolor first, then normal brush) composites correctly.

## Architecture (pre-mapped — do not re-derive)

- **Aquarelle vs engine-1:** two paint paths. Engine-1 (`flushPendingStrokeFinalizations` → `captureLivePixels`) composites correctly. Aquarelle (`AquarelleCanvasLayer` rAF poll → `onCaptureFrame`) replaces instead of merging.
- **Frame cache:** WebP via Rust `WebPLosslessCodec.encode_rgba` / `decode_rgba`. Cache writes are ASYNC.
- **`_resolveFlattenedFrame`** in `physicPaintStore.ts` composites fond + raster. `cachedRotoPlaybackComposition` holds the display composite.
- **Aquarelle cache contract:** `MODE.transparent` OPAQUE TRANSMITTANCE, composited with MULTIPLY over the fond (studio-reopen-paper-washout fix). Frame-scoped live aquarelle layer.
- **paintVersion contract:** bump on EVERY mutation AND subscribe in render useEffects.
- **Preact + @preact/signals**, not React. No useState. Identity-stable effect deps, narrow signal reads, idempotent store setters.
- **frame/export guard:** `physicPaintStore.ts` must contain ZERO `getImageData|putImageData`.
- **App writes JSON capture files to /tmp** — prefer that over console.
- **Prior related debug:** `paint-cache-empty-frame-on-key` (resolved) — aquarelle frame-leave capture ordering vs navigation flush. Different symptom (empty on return vs clearing on paint-over), same machinery.

## Current Focus

- hypothesis: CONFIRMED — the aquarelle capture path encoded only the live sheet (`cachedBase: null`) and replaced the frame bytes. Even with a base, source-over merge would still cover it because `exportCanvas('transparent')` is MODE.transparent OPAQUE transmittance (alpha=255 everywhere).
- status: resolved
- next_action: live UAT — paint engine-1 on a key, switch to watercolor, paint over the SAME key; confirm both paints survive in the cache. Reverse order as control.
- next_reasoning_checkpoint:
  hypothesis: "The aquarelle frame-leave capture (or its flatten step) encodes only the live aquarelle layer's pixels, discarding the previously cached raster/combined bytes, so the new cache replaces instead of composites."
  confirming_evidence:
    - "PhysicsPaintStudio.tsx handleAquarelleCaptureFrame hardcoded `cachedBase: null`, so captureLivePixels.produce took the encodeRotoFrameFromCanvas branch (live sheet only)."
    - "Engine.ts exportCanvas('transparent') returns MODE.transparent = vec4(t, 1.0) — opaque transmittance. mergeRotoAlphaCanvases source-over draw of that sheet covers any base."
    - "Engine-1 path (handleCanvasCompletedMutationImpl) passes cachedBase: cachedRotoRepaintBaseFrame and merges — the inverse order works."
    - "AquarelleCanvasLayer is frame-scoped: engine.clear() on playFrame change, never seeded from the cache. A later aquarelle session starts from a blank sheet."
  falsification_test: "If the aquarelle capture path reads the existing cache and draws the new stroke over it (like engine-1's snapshotLivePixels does), this hypothesis is wrong."
  fix_rationale: "Ride captureLivePixels + mergeCachedRotoAlphaFrame. Snapshot a SESSION BASE (cache as of this sheet's start) and merge the sheet over it with MULTIPLY (live CSS law / transmittance). Repeat captures of the same sheet stay idempotent because they merge against the session base, never a cache that already includes the sheet."
  blind_spots: "Display during watercolor painting still excludes the active track (excludeActive), so the pre-existing paint is not visible under the live sheet while painting — only after leaving watercolor / on the rebuilt cache. UAT should confirm whether that is acceptable."
  candidate_causes:
    - "code: aquarelle capture canvas cleared before drawing new stroke"
    - "code: cache write path overwrites frame bytes instead of compositing"
    - "code: flatten step resolves only the aquarelle layer, ignoring the existing raster"
  and_gate: "Both (a) cachedBase: null replace, and (b) opaque-transmittance sheet cannot source-over merge — fixing only (a) would still cover the base."

## Hypotheses

- H1 (strongest): CONFIRMED — the aquarelle capture/flatten path encodes only the live aquarelle layer, ignoring previously cached paint. The cache write then replaces the frame bytes.
- H2: PARTIAL — the cache write for aquarelle used the same captureLivePixels seam but with `cachedBase: null`, forcing the replace branch. The seam was shared; the call site opted out of merge.
- H3: NOT the flatten path — `_resolveFlattenedFrame` is display-only. The data loss is at capture/encode time.

## Constraints

- Ride existing machinery — no new cache system.
- Live evidence over unit probes if the bug is timing/cross-webview; but this one looks like a deterministic compositing bug so unit probes may work.
- Preact + @preact/signals rules mandatory.
- `physicPaintStore.ts` stays free of `getImageData|putImageData`.
- Vendored WatercolorEngine remains the ONLY paper generator.

## Evidence

- 2026-10-18: `PhysicsPaintStudio.tsx` `handleAquarelleCaptureFrame` called `captureLivePixels` with `cachedBase: null` (comment claimed A5 "full sheet, never a merge"). `captureLivePixels.produce` therefore ran `encodeRotoFrameFromCanvas(liveAlphaCanvas)` — encode-only of the live sheet — writing a replacement frame.
- 2026-10-18: `packages/efx-watercolor/src/playground/Engine.ts` `exportCanvas` note: "MODE.transparent is OPAQUE transmittance (vec4(t, 1.0))". Confirmed by shader `o = vec4(t, 1.0)` in aquarelleLayerContract. A source-over draw of this sheet covers any base, so simply passing cachedBase would not be enough.
- 2026-10-18: Engine-1 `handleCanvasCompletedMutationImpl` passes `cachedBase` (repaint base / publication identity) and `baseCanvas` (erased preview) into the same `captureLivePixels` — the working composite path.
- 2026-10-18: `AquarelleCanvasLayer` frame scope: on `playFrame` change it captures then `engine.clear()`. The sheet is never seeded from the cache, so a paint-over always starts from a blank transmittance sheet.
- 2026-10-18: TDD RED then GREEN — `physicsPaintRotoAlphaMerge.test.ts` multiply-blend cases and `aquarelleLayerContract.test.ts` composite-contract case failed before the fix, pass after. 599 physic-paint tests green.

## Eliminated

- H3 (`_resolveFlattenedFrame` drops the raster): display path only; the loss happens at cache write, before flatten.
- "Capture canvas cleared before draw": the sheet is live GPU state since `engine.clear()`; the snapshot is not cleared independently — it is simply the wrong (incomplete) pixels to encode.

## Resolution

- **root_cause:** The aquarelle cache write replaced the frame instead of compositing: `handleAquarelleCaptureFrame` passed `cachedBase: null`, so `captureLivePixels` encoded only the live sheet; and the sheet is MODE.transparent opaque transmittance, which would cover any base under a source-over merge.
- **fix:** Merge the aquarelle sheet over a per-sheet SESSION BASE (the key's cache as of that sheet's start) with MULTIPLY — the same transmittance law as the live CSS `mix-blend-mode: multiply`. Session base is snapshotted once per sheet (reset on layer attach via `handleAquarelleFlushCaptureReady`, refreshed on `playFrame` change) so dry-settle and frame-leave captures stay idempotent. Rides `captureLivePixels` + `mergeCachedRotoAlphaFrame` (new `mergeBlend: 'multiply'`); no new cache system.
- **files:**
  - `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — session base + `cachedBase` + `mergeBlend: 'multiply'` in `handleAquarelleCaptureFrame`; session reset in `handleAquarelleFlushCaptureReady`.
  - `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — `mergeBlend` pass-through on `captureLivePixels`.
  - `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` — `RotoAlphaMergeBlend` (`source-over` | `multiply`).
  - Tests: `physicsPaintRotoAlphaMerge.test.ts`, `aquarelleLayerContract.test.ts`.
- **caveat:** While the watercolor module is active, `excludeActive` hides the active track from the program monitor, so the pre-existing paint is not visible under the live sheet during the stroke — only on the rebuilt cache after leaving watercolor. If UAT wants live under-paint visibility, a follow-up should feed the session base into the monitor's `liveOverlay`.

## Prevention

- why not caught: no gate existed for this class (aquarelle cache write vs engine-1 merge contract).
- guard: `aquarelleLayerContract.test.ts` now pins that the aquarelle capture passes a session base and `mergeBlend: 'multiply'` (never `cachedBase: null`).
