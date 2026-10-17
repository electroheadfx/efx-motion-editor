---
status: awaiting_human_verify
trigger: I-07 remainder — watercolor paper washes out on Studio leave + reopen (Phase 55 issues, SPECS/v1.1.0-water-color/phase-55-issues/index.md)
created: 2026-10-17
updated: 2026-10-17
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
- next_action: live UAT — reopen Studio after picking a procedural paper and confirm the dense engine sheet survives; if it still washes out, read /tmp captures for the resolved paper id at the fond draw.
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

## Eliminated

## Resolution

- root_cause: >
  H1 confirmed — runtime paper-id degradation caused by a settings/store split-brain.
  `handlePaperIdChange` writes the track mirror and document fallback unconditionally
  (`physicPaintStore.setPaperId`), but updates the Studio `settings` through
  `setBackground`, which returns early when `canMutate()` is false (engine absent or
  mutation-locked). With the engine not yet ready, `settings.background` stays on the
  unhydrated default (`canvas1` / `transparent`) while the store holds `paper/kraft`.
  Every later settings-driven write then reproduces the STALE id:
  `useRotoBackgroundMetadataSync` clobbers the track mirror via
  `setRotoBackgroundMetadata(buildRotoBackgroundMetadata(settings))`, and
  `handleGrainScaleChange`/`handleGrainStrengthChange` clobber the document fallback via
  `setBackgroundFallback(backgroundModeToFallback(settings.background, …))`. That
  degraded fallback rides the child→parent document push and is what the next Studio
  open hydrates from — so the reopen fond resolves `canvas1` (jpg wash arm = white +
  0.18 faint grain) or `white`/absent (flat white / no fond) instead of the dense
  engine sheet. The engine sheet generator itself (vendored WatercolorEngine.paperSheet)
  is not implicated.
- fix: >
  Paper-display fields (background id, grain strength, grain scale) are composite-only —
  the document fond/paperPass own the visible paper, never the engine. Their settings
  updates are now gated on the mutation lock only, not on engine readiness; the engine
  call (`setBgMode`/`setEmbossStrength`) stays best-effort (`input.engine?`). Engine
  mutations (tool, brush, physics) keep the existing engine-presence gate unchanged.
- verification: >
  tdd_mode: failing test written first — `setBackground / setGrainStrength update
  settings even with no engine (paper display is composite-only)` was RED at base
  (setSettings called 0 times with engine=null), GREEN after the fix. Full regression:
  224 tests pass across usePhysicsPaintEngineActions, physicsPaintStudioSettings,
  physicPaintStore.paper, physicPaintStore, projectPaperRaster, enginePaperSheet and
  the physic-paint engine suite. Live reopen UAT still pending (Tauri/cross-webview —
  vitest cannot mount the Studio).
- guardrail_verdict: accepted
- oracle_type: specified (contract: paper-display settings updates must not require an engine; asserted on the action layer's setSettings call count)
- files_changed:
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
