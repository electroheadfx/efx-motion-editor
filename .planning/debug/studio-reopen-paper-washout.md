---
status: resolved
trigger: I-07 remainder — watercolor paper washes out on Studio leave + reopen (Phase 55 issues, SPECS/v1.1.0-water-color/phase-55-issues/index.md)
created: 2026-10-17
updated: 2026-10-17 (resolved — UAT passed on aa1c5135)
---

# Debug Session: studio-reopen-paper-washout

## Symptoms

- **Expected behavior:** procedural paper (e.g. `paper/kraft` / `paper/cold-press`) renders as the dense engine sheet (Image #55: dense cream/kraft with fibers) every time Studio opens.
- **Actual behavior:** after leave Studio → re-open the physic layer to Studio, the fond becomes white OR a very lighter paper version (Image #54: white-ish with faint grain). No console error.
- **Errors:** none.
- **Timeline:** first Studio session is correct; breaks only on leave + reopen. Regression on the I-07 engine swap (vendored WatercolorEngine paperSheet).
- **Reproduction:** open Studio → pick a procedural paper (Paper tab) → paper looks correct → leave Studio → re-open the physic layer to Studio → paper washed out.

## Architecture (pre-mapped — do not re-derive)

- Fond resolution: `physicPaintStore._resolveFondSource` (physicPaintStore.ts:1543) prefers the ACTIVE TRACK's mirror in `_rotoBackgroundMetadata` over the document fallback (`efxPaintStore` `background.fallback`).
- Studio fond layer: `PhysicsPaintStudioView` → `PhysicsPaintRotoPlaybackBackground` → `subscribeRotoPlaybackBackground` → `subscribeProjectPaperCanvas` → `drawRotoFrameComposite(..., null, paperCanvas, null)`.
- Flattened/editor fond: `_resolveFlattenedFrame` → `getProjectPaperCanvas` → `drawMissingRotoBackground(..., null, fondPaperCanvas)`.
- Procedural papers: `getProjectPaperCanvas` → `buildProceduralPaperFond` → `getEnginePaperSheet` (enginePaperSheet.ts, thin Map cache over vendored `WatercolorEngine.paperSheet`). Returns the opaque sheet.
- `drawMissingRotoBackground` (rotoFrameDraw.ts:95): `paperCanvas` → drawImage full density (correct); `paperTexture` → white fill + 0.18 grain (jpg wash arm); neither → `instruction.color` flat fill (`backgroundColorForRotoMode` default `#f4efe3` for `paper/*`, `#ffffff` for white).
- `drawProjectPaperRaster` has an `opaqueSheet` option with ZERO callers (dead code — the 261017-lny "reopen wash-out" fix that was never wired).
- `isProceduralPaperTexture(id)` = `startsWith('paper/') && !(id in PAPER_TEXTURE_URLS)`. `PAPER_TEXTURE_URLS` contains `paper/real-1..3` and `canvas1..3`. If the id degrades to `canvas1` or `paper/real-1`, the jpg arm (white + 0.18) produces exactly "very lighter paper version".
- `makeInitialPhysicsPaintStudioSettings()` defaults `background:'canvas1'`, `grainStrength:0.45`.
- `useRotoBackgroundMetadataSync` writes `buildRotoBackgroundMetadata(settings)` to the track mirror on MOUNT and on every settings change (useRotoBackgroundMetadataSync.ts:24). `setRotoBackgroundMetadata` has an idempotence guard but WILL overwrite when the background id differs.
- Studio settings hydrate from `launchContext.document.background.fallback` via `applyBackgroundFallbackToSettings` (PhysicsPaintStudio.tsx:895, usePhysicsPaintLaunchIntegration.ts:188). `launchContext` is parsed from `window.location` (`?context=`) at mount (PhysicsPaintStudio.tsx:487), then re-delivered via the bridge.
- `createPhysicPaintLaunchContext` (physicPaintBridge.ts:3911) builds the carrier from `getEfxPaintDocument(layerId)` — the LIVE document, which `_writePaperDisplay` (`setPaperId` → `setBackgroundFallback` + track mirror) is supposed to have written with the `paper/*` id.
- Studio is a separate Tauri window that gets NAVIGATED on each open (`open_physics_paint_window`), so `PhysicsPaintStudio` remounts with a fresh `launchContext` each re-open.

## Current Focus

- hypothesis: On Studio reopen the `paper/*` id degrades to `canvas1` (makeInitialPhysicsPaintStudioSettings default) or `white` in the track mirror or document fallback, so the jpg wash arm (white + 0.18) or the flat color arm draws instead of the opaque engine sheet.
- test: Pin the actual paper id + fallback + mirror value at Studio reopen, and which draw arm runs (capture JSON to /tmp).
- expecting: If H1 — mirror or fallback reads `canvas1`/`white` at reopen despite the user having picked `paper/*`. If H2 — `getEnginePaperSheet` returns null and `drawMissingRotoBackground` takes the `instruction.color` arm. If H3 — `fondInstructionToFondMetadata` maps a falsy `paperTexture` to `background:'white'`.
- hypothesis: CONFIRMED H1 (runtime id degradation). The Studio paper pick splits across two writers with different gates: `setPaperId` writes the track mirror + document fallback UNCONDITIONALLY, while `setBackground`/`setGrainStrength`/`setGrainScale` update `settings` only when `canMutate()` (engine present + not locked). When the engine is not ready the settings stay on the unhydrated default (`canvas1` / `transparent`). The next `useRotoBackgroundMetadataSync` write (any settings change) and/or `handleGrainScaleChange`/`handleGrainStrengthChange` (`backgroundModeToFallback(settings.background)`) then clobber the mirror AND the fallback back to the stale id. The fond resolves the stale id: `canvas1`/`paper/real-N` → jpg wash arm (white + 0.18 faint grain); `white`/solid → flat white; absent mirror → no fond.
- test: `usePhysicsPaintEngineActions.test.ts` — "setBackground / setGrainStrength update settings even with no engine". RED at base (setSettings called 0 times), GREEN after fix.
- expecting: Fixed — paper-display settings updates no longer require an engine.
- UAT RESULT (2026-10-17): FAILED — same wash-out on leave + reopen after `3ca751af`. The H1 engine-gate split was real but was NOT the reopen-visible cause (or not the only one). H1's own falsification test now applies: if the resolved id is still `paper/*` at reopen, the cause is H2.
- hypothesis: H2 (follow-up) — `getEnginePaperSheet` returns null on the reopened window's first fond draw (offscreen WatercolorEngine WebGL context not ready during early page load, or a one-shot `paperSheet` throw), and `buildProceduralPaperFond`/`subscribeProjectPaperCanvas` NEVER RETRIED: the first null delivery stuck the fond on `drawMissingRotoBackground`'s `instruction.color` arm (`#f4efe3` = "very lighter paper version"; `#ffffff` = white). First Studio session works because the Paper tab warms the engine before the fond re-subscribes on pick; reopen draws the fond at mount, cold engine → null → stuck.
- test: `projectPaperRaster.test.ts` — "a null engine sheet retries and then delivers the real sheet" + "a permanently-null sheet stops after the bounded retries". RED at base (subscriber stays null forever), GREEN after the bounded retry.
- expecting: Fixed — a null procedural sheet schedules a bounded retry (8 attempts) and notifies texture listeners when the real engine sheet lands; unknown ids still fail-soft with no spin.
- next_action: live UAT with pixel probes (40ad4223) — reopen Studio after picking a procedural paper. Read `/tmp/studio-reopen-paper-washout.json` for the `sheet` pixels (is the engine readback white?) and the `fond-draw` arm + centerPixel (is the fond drawing the sheet or the flat color?).
- CAPTURE RESULT (2026-10-17, after a756c42e): id is CORRECT end-to-end (`paper/toned-sand` in fallback, mirror-write, and fond-resolve) and `getEnginePaperSheet` returns `ok: true` at 1080x1080. H1 (id degradation) and H2 (null sheet) are both ELIMINATED by live evidence. The wash-out is downstream of generation: either the sheet pixels are white (WebGL readback failure on the reused window) or the fond draw takes a non-sheet arm / is covered. Pixel probes added at the sheet and the fond draw.
- CAPTURE RESULT (2026-10-17, after 40ad4223): sheet pixels are DENSE kraft (`212,195,162` / `202,186,154` / `222,204,170`) and the fond draw is `arm: "sheet"` at full density with matching pixels. The fond canvas is CORRECT. The wash-out is a COVERING LAYER.
- CAPTURE RESULT (2026-10-17, after 4e616529): layer-stack dump — `aquarelleCanvas: MISSING`, `engineSurface.opacity: 1`, `tracksGroup.isolation: isolate`, `tracksGroup.className: physics-paint-tracks-group` (no `aquarelle-compositing`). The user is in BRUSH mode at reopen: `activeModule` is a plain signal defaulting to `'brush'` and the Studio window NAVIGATES on every open, resetting JS state. Engine-1 is visible (its `setVisibleBackgroundSuppressed(true)` keeps its own paper off the visible canvases, but the module the user left is not restored). Fix e36a5bfe: persist `activeModule` in sessionStorage so reopen returns to Water color.
- CAPTURE RESULT (2026-10-17, after e36a5bfe): engine canvas pixel probe — `engineCanvases[1]` (the DRY canvas, z-index 4, on top) is opaque `245,240,232,255` = `#f5f0e8`. That is `drawBg`'s fallback fill (bgMode `canvas*` with a texture not loaded, or `photo` with no photo) painted onto the VISIBLE dry canvas despite `visibleBackgroundSuppressed`. Two draws were unguarded: the constructor's initial `dryCtx.drawImage(bgCanvas)` and `clear()`'s `dryCtx.putImageData(bgPixels)`. `#f5f0e8` is exactly the reported "very lighter paper version" and it sits over the dense fond (`212,195,162`). Fix 7466fbd5: gate both draws on `!visibleBackgroundSuppressed` and make `setVisibleBackgroundSuppressed` re-assert the clear on every call.
- reasoning_checkpoint:
  hypothesis: "handlePaperIdChange writes the store unconditionally but setBackground is gated on engine readiness, so settings.background desyncs; the next settings-driven write clobbers the paper id in the track mirror and document fallback, and the fond renders the jpg wash (canvas1) or white instead of the engine sheet."
  confirming_evidence:
    - "drawMissingRotoBackground callers pass paperTexture=null; the jpg wash arm is unreachable from the fond paths — so 'white-ish with faint grain' can only come from getProjectPaperCanvas returning a JPG-arm canvas, i.e. id degraded to canvas1/paper/real-N (isProceduralPaperTexture false)."
    - "usePhysicsPaintEngineActions.setBackground/setGrainStrength return early when engine is null (canMutate), while setPaperId writes mirror+fallback unconditionally — reproduced as a failing test (setSettings called 0 times)."
    - "handleGrainScaleChange/handleGrainStrengthChange call backgroundModeToFallback(settings.background) — with a stale settings.background they write the fallback back to transparent/canvas1, which survives the child→parent push and is what reopen hydrates from."
  falsification_test: "If at Studio reopen the resolved paper id (track mirror + document fallback + fond instruction.paperTexture) still reads the picked paper/* id while the fond is washed out, this hypothesis is wrong and H2 (getEnginePaperSheet null) is the cause."
  fix_rationale: "Paper display (background id, grain) is composite-only — the fond/paperPass own the visible paper, not the engine. Updating settings without an engine removes the split-brain so every later settings-driven write (sync effect, grain handlers) reproduces the picked id instead of the stale default."
  blind_spots: "No live reopen capture yet — the deterministic leave→reopen chain is inferred from the code path (settings clobber → fallback clobber → push → reopen hydrate). The engine-sheet-null arm (H2) is not excluded by this fix; if UAT still washes out with the correct id resolved, H2 is next."
  candidate_causes:
    - "code: canMutate() gates paper-display settings updates on engine readiness (usePhysicsPaintEngineActions.ts)"
    - "environment/data: getEnginePaperSheet returns null on the reused Studio window (WebGL context loss on the offscreen engine) — H2, not excluded"
  and_gate: "no — a single contributing condition (stale settings.background after a gated pick) is sufficient to clobber the id; the grain-handler fallback write is a second manifestation of the same stale-settings condition, not an independent requirement."
- tdd_checkpoint:
  test_file: "app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts"
  test_name: "setBackground / setGrainStrength update settings even with no engine (paper display is composite-only)"
  status: "green"
  failure_output: "expected spy to be called 2 times, but got 0 times (RED at base; GREEN after fix)"
- bug_class: Bohrbug (deterministic leave+reopen regression; no intermittency reported)
- known_pattern_candidate: "studio-reopen-empty-boot — display-only docSync changes deduped by the bare revision" (weak match: same Studio reopen family, different symptom class; different root cause expected)

## Hypotheses

- H1 (strongest): on Studio reopen the track mirror or document fallback degrades from `paper/<id>` to `canvas1` (makeInitialPhysicsPaintStudioSettings default) or `white`. Candidate clobber sites: `useRotoBackgroundMetadataSync` mount write with unhydrated settings (`launchContext` null at first useState init → `canvas1`); `handleBackgroundChange`; `reflectFallbackToBackgroundMode`; the child→parent document sync on Studio close (`mirrorSyncedTrackDocuments` / `applyDocument`) overwriting the parent's fallback/mirror.
- H2: `getEnginePaperSheet` returns null on the second call (WebGL context loss on the offscreen engine in enginePaperSheet.ts, or a cache-key mismatch because the fond width/height differs between `cachedRotoPlaybackComposition` and `programMonitor.width`), so `getProjectPaperCanvas` → null → `drawMissingRotoBackground` falls to `instruction.color` (`#f4efe3` = "very lighter paper version", `#ffffff` = "white").
- H3: the fond instruction loses `paperTexture` (`fondInstructionToFondMetadata` maps a falsy `paperTexture` to `background:'white'`), so the Studio fond layer subscribes to `'white'` → no texture → flat fill.

## Constraints

- The fix must keep the vendored `WatercolorEngine` as the ONLY paper generator (no new paper code).
- Instrument via JSON capture files in /tmp — prefer that over console (app-written capture files over console copy).
- Live evidence over unit probes for Tauri/cross-webview behavior.

## Evidence

- timestamp: 2026-10-17
  checked: drawMissingRotoBackground callers (rotoPlaybackBackground.ts:32, physicPaintStore.ts:2805) + drawProjectPaperRaster call sites
  found: BOTH production fond draws pass `paperTexture=null` and only consume `paperCanvas`. The jpg wash arm (white + 0.18) inside drawMissingRotoBackground is therefore unreachable from the fond paths. `drawProjectPaperRaster`'s `opaqueSheet` option has had ZERO callers since it was added in a7eaf78a (lny) — it was never the reopen fix, even in its own commit. Procedural sheets return directly from buildProceduralPaperFond and never traverse drawProjectPaperRaster.
  implication: "white-ish with faint grain" cannot come from the jpg overlay on a procedural sheet. It matches getProjectPaperCanvas returning a JPG-arm canvas — i.e. the paper id degraded to canvas1/paper/real-N (isProceduralPaperTexture false → white+0.18 baked into the canvas). Pure white matches id 'white' or a solid-color fond source (fondInstructionToFondMetadata's white arm). Flat #f4efe3 (lighter, no grain) matches paperCanvas=null → instruction.color arm. H1 explains both reported looks; H2 explains only the flat/lighter look.

- timestamp: 2026-10-17
  checked: parseBackgroundFallback / isPaperTextureValue / encodeCanonicalBackgroundFallback / isPhysicPaintRotoBackground / buildEfxPaintDocumentSyncFingerprint
  found: `paper/${string}` survives every parser and encoder in the chain. The sync fingerprint includes the canonical revision which includes the `fallback:` term, so a fallback change is not deduped away by the push guard.
  implication: A pure codec/allowlist drop of the paper id is eliminated. If the id degrades it is a RUNTIME state write (mirror/settings), not a parse loss.

- timestamp: 2026-10-17
  checked: usePhysicsPaintEngineActions.setBackground + handlePaperIdChange (PhysicsPaintStudio.tsx:1464)
  found: `setBackground` is gated on `canMutate()` = `Boolean(engine) && !isMutationLocked()`. `handlePaperIdChange` calls `physicPaintStore.setPaperId(...)` (UNCONDITIONAL — writes mirror + document fallback) and then `setBackground(paperId)` (GATED — updates settings only if the engine is ready). Split-brain: store can hold `paper/kraft` while `settings.background` stays the unhydrated default `canvas1`/`transparent`.
  implication: A concrete H1 clobber mechanism. `useRotoBackgroundMetadataSync` writes `buildRotoBackgroundMetadata(settings)` to the track mirror on every settings change — with a stale `settings.background` it overwrites the correct mirror the pick just wrote. `_resolveFondSource` prefers the mirror, so the fond then renders the stale id (canvas1 jpg wash / transparent / white).

- timestamp: 2026-10-17 (post-3ca751af UAT FAIL)
  checked: applyBackgroundFallbackToSettings / reflectFallbackToBackgroundMode / backgroundModeToFallback / _isValidFallback / serializeRuntimeIntoDocument / createPhysicPaintLaunchContext / open_physics_paint_window
  found: `StudioBackgroundMode = BgMode | PaperTexture` holds `paper/*` verbatim; `reflectFallbackToBackgroundMode` returns `fallback.texture` unchanged; `_isValidFallback` accepts `paper/`; `serializeRuntimeIntoDocument` preserves `document.background.fallback`; the Studio window is NAVIGATED on reopen (fresh JS context, fresh enginePaperSheet cache). The id-mapping chain is lossless end-to-end. The remaining reopen-specific failure is the fond's FIRST `getEnginePaperSheet` call happening at mount (cold offscreen WatercolorEngine) and `buildProceduralPaperFond` returning null with NO RETRY — `subscribeProjectPaperCanvas` delivers null once and never re-asks, so `drawMissingRotoBackground` takes the `instruction.color` arm forever. First session works because the Paper tab warms the engine before the pick re-subscribes the fond.
  implication: H2 confirmed as the reopen-visible cause. Fix = bounded retry in buildProceduralPaperFond (8 attempts, notify on success) + /tmp capture at fond-resolve / sheet / mirror-write so a still-failing UAT names the arm.

## Eliminated

- H1 (id degradation to canvas1/white): ELIMINATED by capture — `paper/toned-sand` survives end-to-end (fallback, mirror-write, fond-resolve) at reopen. The 3ca751af engine-gate split was real but not the reopen-visible cause.
- H2 (null engine sheet stuck): ELIMINATED by capture — `getEnginePaperSheet` returns `ok: true` at 1080x1080 with DENSE kraft pixels (`212,195,162`). The a756c42e bounded retry is a real robustness fix but not the reopen-visible cause.
- H3 (fond instruction loses paperTexture): ELIMINATED — fond draw takes `arm: "sheet"` at full density with matching pixels. The fond canvas is CORRECT.

## Resolution

- root_cause: >
  COVERING LAYERS over a correct fond. Capture proved the fond canvas holds the
  dense engine sheet; the wash-out was painted on top. Three stacked covers:
  (1) engine-1's DRY canvas painted `drawBg`'s fallback `#f5f0e8` despite
  `visibleBackgroundSuppressed` — the constructor's initial
  `dryCtx.drawImage(bgCanvas)` and `clear()`'s `dryCtx.putImageData(bgPixels)`
  were unguarded, and `getDryRestoreData()` restored `bgData` even when
  suppressed. (2) `activeModule` is a plain signal defaulting to `'brush'`; the
  Studio window NAVIGATES on every open, so reopen landed in Brush mode with the
  aquarelle layer missing. (3) The aquarelle cache stores `MODE.transparent`
  OPAQUE TRANSMITTANCE — the shader outputs `vec4(t, 1.0)` ("how much paper light
  gets through"), designed for CSS `mix-blend-mode: multiply` over the fond, NOT
  real alpha. Composited `source-over` it covers the paper with white. The Studio
  program monitor needed the same multiply + an `isolation: auto` lift so the
  blend reaches the fond.
- fix: >
  (1) Gate every engine-1 bg draw on `!visibleBackgroundSuppressed` and make
  `getDryRestoreData()` return null when suppressed (7466fbd5, b90db315).
  (2) Persist `activeModule` in sessionStorage so reopen returns to Water color
  (e36a5bfe). (3) Keep the transmittance cache as-is and composite it with
  MULTIPLY over the fond, branching on raster opacity: opaque → multiply
  (aquarelle transmittance), real-alpha → source-over (engine-1). Probe lives in
  `lib/rasterAlpha.ts` so the store stays free of pixel-array canvas APIs
  (09c422e1, 04177803). (4) `.physics-paint-program-monitor` carries
  `mix-blend-mode: multiply` and the tracks group lifts `isolation: auto` when
  `:has(.physics-paint-program-monitor)` (04177803, aa1c5135). An earlier
  alpha-flattening attempt (9f6a7a3d) was REVERTED — it kept transmittance RGB at
  low coverage and produced a faint/white ghost.
- verification: >
  Full suite green after aa1c5135: 299 passed | 2 skipped (301) files;
  5205 passed | 1 skipped | 96 todo (5302) tests. CSS contract pin
  (`.physics-paint-program-monitor` block must contain `z-index: 0`) holds after
  folding multiply into the original block. frame/export guard
  (`physicPaintStore.ts` free of `getImageData|putImageData`) holds — the opacity
  probe lives in `lib/rasterAlpha.ts`. Live UAT PASSED 2026-10-17: editor AND
  Studio both show the stroke on the dense procedural paper.
- guardrail_verdict: accepted
- oracle_type: specified (contract: the aquarelle cache is transmittance and MUST multiply over the fond; asserted on the composite-op branch and the CSS blend/isolation pins)
- files_changed:
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/lib/projectPaperRaster.test.ts
  - app/src/lib/paperFondCapture.ts
  - app/src/lib/enginePaperSheet.ts
  - app/src/lib/rasterAlpha.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/components/physic-paint/hooks/useRotoBackgroundMetadataSync.ts
  - app/src/components/physic-paint/view/rotoPlaybackBackground.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/shared/activeModule.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
