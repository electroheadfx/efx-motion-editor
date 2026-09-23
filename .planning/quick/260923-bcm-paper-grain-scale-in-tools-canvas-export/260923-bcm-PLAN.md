---
phase: quick-260923-bcm
plan: 260923-bcm
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/projectPaperRaster.ts
  - app/src/lib/projectPaperRaster.test.ts
  - app/src/lib/rotoFrameDraw.ts
  - app/src/lib/rotoFrameDraw.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/types/physicPaint.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
  - app/src/components/physic-paint/view/rotoPlaybackBackground.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/lib/previewRenderer.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts
autonomous: true
requirements: []

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A Grain scale control in the Tools (TopBar) surface changes the paper pattern size on the Studio canvas live, smaller and larger."
    - "Export uses the same grainScale through getFlattenedFrame / getDocumentFondInstruction — the value is not display-only."
    - "grainScale survives Studio close/reopen and save/reopen (hydrates from document.background.fallback)."
    - "Grain on/off (grainStrength) semantics unchanged; a default-scale (1) project renders byte-identical to today."
    - "Scale-only edits pass the setRotoBackgroundMetadata idempotence guard (no silent early-return drop) and rotate encodeCanonicalBackground / encodeCanonicalBackgroundFallback / _fondSourceSignature."
    - "The paper tile loop cannot spin on a malformed scale (zero/negative/NaN clamped at parse, tile step floored >= 1 at draw)."
  artifacts:
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/rotoFrameDraw.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  key_links:
    - "settings.grainScale -> buildRotoBackgroundMetadata -> setRotoBackgroundMetadata guard comparison -> fond instruction -> getProjectPaperCanvas(scale)"
    - "settings.grainScale -> backgroundModeToFallback -> setBackgroundFallback -> encodeCanonicalBackgroundFallback -> hydrate on reopen"
    - "TopBar onGrainScaleChange -> handleGrainScaleChange (settings + mirror + fallback, synchronous) -> playback/fond/canvasStack dep rotation"
---

<objective>
Add a paper grain SCALE control to the Tools surface (PhysicsPaintTopBar) so the fixed-size paper texture pattern can be made smaller or larger on the Studio canvas and in export, with the value persisted in the project document.

Purpose: Today the paper pattern is created at natural image size (createPattern repeat, no transform) and the Tools surface exposes grain presence/strength but not pattern scale — the texture reads as one fixed size everywhere.
Output: grainScale threaded through settings, track mirror, document fallback, fond instruction, and every projectPaperRaster consumer (Studio fond, main preview, export authority), plus a segmented Grain scale control in the TopBar.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

Grounding notes from discovery (verify against source before editing):
- app/src/lib/projectPaperRaster.ts — drawProjectPaperRaster creates the pattern at natural size; cache key is `${paperTexture}:${width}x${height}` (needs a scale term). Exports getProjectPaperCanvas / subscribeProjectPaperCanvas / resetProjectPaperRasterForTests.
- app/src/lib/rotoFrameDraw.ts — resolveMissingRotoFrameDraw (instruction carries paperTexture/paperGrain/grainStrength), drawMissingRotoBackground (paperCanvas arm + paperTexture createPattern arm), drawDeterministicPaperGrain step 5/7/9 (deliberately NOT scaled — guardrail keeps grain strength on/off semantics).
- app/src/stores/physicPaintStore.ts — _resolveFondSource (fallback arm builds metadata), _fondSourceSignature, fond draw calls getProjectPaperCanvas(fondInstruction.paperTexture, size.width, size.height) (~line 2632), setRotoBackgroundMetadata idempotence guard (~2848) — MUST compare grainScale or scale-only writes early-return and are dropped; getDocumentFondInstruction is the CMP-01 export authority.
- app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts — PhysicsPaintStudioSettings + makeInitialPhysicsPaintStudioSettings, backgroundModeToFallback, buildRotoBackgroundMetadata, applyRotoBackgroundMetadataToSettings, applyBackgroundFallbackToSettings. Engine apply fns intentionally do not touch grainScale (engine visible background is suppressed in PhysicsPaintCanvasMount).
- app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx:108 — engine.setVisibleBackgroundSuppressed(true): engine package changes NOT needed.
- app/src/components/physic-paint/PhysicsPaintStudio.tsx — settings useState hydrates from document fallback on open (~803), fondInstructionToFondMetadata (~157), handleBackgroundChange fallback-write idiom (~1246), topBar memo (~3300), cachedRotoPlaybackComposition deps (~3611), canvasStack memo deps (~3704).
- app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx:127 — PlaybackBackground effect deps (background.background, color, grainStrength, paperGrain, height, width).
- app/src/components/physic-paint/view/rotoPlaybackBackground.ts — subscribeRotoPlaybackBackground builds instruction from background metadata then calls subscribeProjectPaperCanvas.
- app/src/types/physicPaint.ts — PhysicPaintRotoBackgroundMetadata + isPhysicPaintRotoBackgroundMetadata.
- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts — PHYSIC_PAINT_ROTO_BACKGROUND_KEYS, isPhysicPaintRotoBackground, encodeCanonicalBackground.
- app/src/efx-paint/document/efxPaintDocument.ts — BackgroundFallback paper arm.
- app/src/efx-paint/document/efxPaintDocumentParsers.ts — FALLBACK_PAPER_KEYS + exact-count check.
- app/src/efx-paint/document/efxPaintDocumentRevision.ts — encodeCanonicalBackgroundFallback (`paper:...` term) feeds revisions + composite cache.
- app/src/stores/efxPaintStore.ts — fallback validation + setBackgroundFallback idempotent guard.
- app/src/lib/previewRenderer.ts — preloadPaperTextures subscription warm (scale-irrelevant notify; re-query at consumer scale).
- app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts — get/subscribe project paper canvas for thumbnails (capture scale from script source.background snapshot only).
- app/vitest.config.ts — collects only `src/**/*.test.ts`; run with `pnpm --filter efx-motion-editor exec vitest run <files>` (never watch).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED then thread grainScale through model, persistence, and encoders</name>
  <files>app/src/types/physicPaint.ts, app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts, app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts, app/src/efx-paint/document/efxPaintDocument.ts, app/src/efx-paint/document/efxPaintDocumentParsers.ts, app/src/efx-paint/document/efxPaintDocumentRevision.ts, app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts, app/src/stores/efxPaintStore.ts, app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts, app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts</files>
  <behavior>
    - Test: settings round trip — buildRotoBackgroundMetadata(settings with grainScale 2) emits grainScale 2; applyRotoBackgroundMetadataToSettings restores 2; applyBackgroundFallbackToSettings restores 2; backgroundModeToFallback paper arm emits grainScale; default settings have grainScale 1.
    - Test: fallback parser accepts an optional grainScale member and normalizes absent/invalid to 1; FALLBACK_PAPER_KEYS exact-count check allows the optional member (error text updated).
    - Test: encodeCanonicalBackground and encodeCanonicalBackgroundFallback differ when only grainScale changes (2 vs 1); equal for the same scale; absent normalizes to 1.
    - Test: PHYSIC_PAINT_ROTO_BACKGROUND_KEYS includes grainScale; isPhysicPaintRotoBackground accepts optional finite in-range number; physical parse normalizes missing grainScale to 1.
    - Test (currently RED): setRotoBackgroundMetadata accepts a scale-only change — metadata identical except grainScale 1 -> 2 must NOT early-return; the idempotence guard compares normalized grainScale on both sides.
    - Test (currently RED): getDocumentFondInstruction / _fondSourceSignature carry the scale — a fallback with grainScale 2 produces instruction.grainScale 2 and a signature that rotates when only scale changes; _resolveFondSource fallback arm copies grainScale with ?? 1.
    - Test: fondInstructionToFondMetadata (in PhysicsPaintStudio) copies grainScale (white arm: 1).
  </behavior>
  <action>RED first: extend the listed test files with the behavior pins above and run the targeted vitest command; confirm the new assertions fail (especially the idempotence-guard and fond-instruction legs). Then implement: add optional `grainScale?: number` to PhysicPaintRotoBackgroundMetadata and BackgroundFallback paper arm with finite-range acceptance in isPhysicPaintRotoBackgroundMetadata; add 'grainScale' to PHYSIC_PAINT_ROTO_BACKGROUND_KEYS and normalize `grainScale: value.grainScale ?? 1` in the physical parse; append normalized scale to encodeCanonicalBackground; allow the optional member in FALLBACK_PAPER_KEYS with normalize-to-1 in the exact-count parser path and update the "must contain exactly..." error text; append `:${encodeCanonicalNumber(fallback.grainScale ?? 1)}` to encodeCanonicalBackgroundFallback; add the optional-fallback validation branch in efxPaintStore; add REQUIRED `grainScale: number` (default 1 in makeInitialPhysicsPaintStudioSettings) and thread it through buildRotoBackgroundMetadata, applyRotoBackgroundMetadataToSettings, applyBackgroundFallbackToSettings, backgroundModeToFallback (paper arm), while the engine apply fns intentionally ignore it (visible background suppressed — do not call the engine). In physicPaintStore: copy grainScale ?? 1 in the _resolveFondSource fallback metadata arm, append normalized scale to _fondSourceSignature, and extend the setRotoBackgroundMetadata idempotence guard to compare (current.grainScale ?? 1) === (metadata.grainScale ?? 1) — without this a scale-only write silently early-returns. Copy grainScale in fondInstructionToFondMetadata. This task establishes the persistence spine only; no UI and no draw-transform changes yet (Task 2/3). Type shape law: settings field REQUIRED with default 1; metadata/fallback/instruction members optional with ?? 1 normalization (optional-member idiom, NOT legacy migration — no backward-compat code).</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts src/efx-paint/document/efxPaintBackgroundFallback.test.ts src/stores/physicPaintStore.test.ts</automated>
  </verify>
  <done>RED pins recorded then GREEN: all four targeted suites pass; scale-only metadata writes are accepted by the idempotence guard; both canonical encoders and the fond signature rotate on scale; fallback parse accepts optional grainScale and normalizes absent to 1; settings default grainScale is 1; tsc clean for touched files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RED then scale the paper pattern at every draw seam (canvas + export authority)</name>
  <files>app/src/lib/projectPaperRaster.ts, app/src/lib/projectPaperRaster.test.ts, app/src/lib/rotoFrameDraw.ts, app/src/lib/rotoFrameDraw.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts, app/src/components/physic-paint/view/rotoPlaybackBackground.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts, app/src/lib/previewRenderer.ts</files>
  <behavior>
    - Test (currently RED): drawProjectPaperRaster with scale 2 records a pattern transform with a=2, d=2 on the fake 2D context; with scale 1 (default) no setTransform call is recorded (byte-identical hot path) — scale===1 skips the transform.
    - Test: getProjectPaperCanvas cache key includes the normalized scale — scale 1 and scale 2 for the same texture/width/height do not share a cached canvas; subscribe notifies at the requested scale.
    - Test (currently RED): drawMissingRotoBackground paperTexture arm applies setTransform a=2 at scale 2; the paperCanvas arm passes scale through getProjectPaperCanvas; instruction.grainScale ?? 1 reaches the draw (default 1 when absent).
    - Test (export authority, currently RED): getDocumentFondInstruction carries grainScale from fallback/mirror, AND the fond draw path calls getProjectPaperCanvas with the instruction's scale as an extra argument (partial vi.mock of getProjectPaperCanvas asserting call args) — proves export/main-preview pixels honour the value, not display-only.
    - Test: a malformed scale of 0 / negative / NaN still draws — tile step floored to >= 1, no infinite loop (assert draw returns).
    - Test: default-scale operation logs from rotoFrameDraw are unchanged (existing fixtures still pass byte-for-byte / op-for-op).
  </behavior>
  <action>RED first: write the pins above against the current natural-size createPattern implementation and confirm they fail. Then implement: add a `scale` parameter (default 1) to drawProjectPaperRaster, getProjectPaperCanvas, and subscribeProjectPaperCanvas; include the normalized scale in the cache key; after createPattern, when scale !== 1 call pattern.setTransform with the plain object { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 } (DOMMatrix2DInit plain object — no DOMMatrix constructor, test-friendly in jsdom); when scale === 1 skip setTransform entirely so default renders stay byte-identical; floor the tile step with Math.max(1, step) so a hostile scale can never produce a zero-step infinite loop (DoS). Add `grainScale?: number` to the rotoFrameDraw instruction type and thread it through resolveMissingRotoFrameDraw and both arms of drawMissingRotoBackground (texture arm: setTransform path; canvas arm: pass scale into getProjectPaperCanvas). In physicPaintStore, pass fondInstruction.grainScale ?? 1 into the fond getProjectPaperCanvas call. Update every remaining call site to pass an explicit scale: rotoPlaybackBackground (from background.grainScale ?? 1), physicsPaintRotoScriptThumbnail get/subscribe (from input.background.grainScale ?? 1 — snapshot capture only, no re-apply side effect), previewRenderer.preloadPaperTextures (pass 1 for the warm; notify stays texture-keyed and each consumer re-queries at its own scale). Do NOT touch drawDeterministicPaperGrain step 5/7/9 — dot grain strength stays on/off only (guardrail). Do NOT touch the engine workspace package.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/projectPaperRaster.test.ts src/lib/rotoFrameDraw.test.ts src/stores/physicPaintStore.test.ts</automated>
  </verify>
  <done>RED pins recorded then GREEN: pattern transform a=2 observed in both draw seams at scale 2; scale 1 records no setTransform; cache keys isolate scales; fond/export path passes instruction scale into getProjectPaperCanvas; malformed scale draws without hanging; existing default-scale fixtures unchanged; dot-grain step untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Grain scale control in Tools + live wiring + hydration round trip</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx, app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts, app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/hooks/useRotoBackgroundMetadataSync.ts</files>
  <behavior>
    - Test: PhysicsPaintTopBar renders a "Grain scale" segmented control with options 0.5x / 0.75x / 1x / 1.5x / 2x, default active 1x; clicking 2x calls onGrainScaleChange(2); control sits beside the existing Grain strength control on the same Tools surface.
    - Test: grain on/off regression — existing paperGrain / grainStrength props and handlers still render and fire unchanged (existing TopBar pins keep passing).
    - Test: handleGrainScaleChange writes settings AND the track mirror AND the document fallback in one action (mock/spy setRotoBackgroundMetadata + setBackgroundFallback; fallback written via backgroundModeToFallback when mode !== 'photo'); no engine setVisibleBackground* call is made.
    - Test: settings.grainScale appears in the cachedRotoPlaybackComposition deps, canvasStack memo deps (including physicPaintVersion.value as the convergence door), StudioView PlaybackBackground effect deps, and the TopBar memo deps — source-shape pins asserting the dep arrays contain the identifier.
    - Test: hydration — makeInitial default is 1; applyBackgroundFallbackToSettings restores a persisted 2 after reopen (round trip with the Task 1 settings suite).
  </behavior>
  <action>RED first: add the TopBar render/behavior pins and the Studio source-shape pins, confirm they fail. Then implement: in PhysicsPaintTopBar add a "Grain scale" segmented control beside Grain strength using discrete options 0.5x/0.75x/1x/1.5x/2x (clean cache keys, default 1) with new props `grainScale: number` and `onGrainScaleChange: (scale: number) => void` — this is the only surface that already exposes paper grain, so the control belongs here (Claude's discretion: the timeline Tools popover never had grain and is out of scope). In usePhysicsPaintEngineActions add `setGrainScale(scale)` = updateSetting('grainScale', scale) ONLY — no engine call (visible background suppressed at PhysicsPaintCanvasMount:108). In PhysicsPaintStudio add `handleGrainScaleChange` that synchronously: (1) updates settings, (2) writes the track mirror via the existing persist/setRotoBackgroundMetadata idiom with the next settings (the useRotoBackgroundMetadataSync effect then becomes an idempotent no-op through the Task 1 guard — this closes the one-render-behind window), and (3) when settings.background !== 'photo', writes the document fallback via setBackgroundFallback(layerId, backgroundModeToFallback(mode, settings)) exactly as handleBackgroundChange does — without the fallback write, hydration on reopen loses the value because settings hydrate only from document.background.fallback. Destructure setGrainScale and grainScale, pass both into the topBar memo (deps + props). Add settings.grainScale to cachedRotoPlaybackComposition deps, to the canvasStack memo deps together with physicPaintVersion.value (convergence door so the flattened fond memo rotates the same render), to StudioView PlaybackBackground effect deps, and to fondInstructionToFondMetadata if not already done in Task 1. Every dep list that currently names settings.grainStrength or paperGrain as a fond input gains settings.grainScale. Keep Preact signals rules (efx-preact-reactivity): idempotent setters, identity-stable effect deps, no render-body signal writes; the existing settings useState in Studio is the established idiom for this settings object — do not introduce new useState. No new file format fields beyond the stored scale value.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts src/stores/physicPaintStore.test.ts && pnpm --filter efx-motion-editor exec tsc --noEmit && git diff --name-only</automated>
  </verify>
  <done>Control visible in TopBar Tests; clicking a scale option updates settings, mirror, and fallback in one action; dep arrays contain settings.grainScale / physicPaintVersion.value source-pins; hydration round trip restores 2; grain on/off tests unchanged; full vitest run and tsc clean; git diff limited to the planned files (no engine workspace files).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| document file -> parsers/encoders | Untrusted project JSON (fallback, physical background payload) crosses into validated settings and render state |
| settings -> pattern tile loop | A malformed scale value reaches createPattern/setTransform and the tile iteration bounds |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260923-01 | Denial of Service | efxPaintDocumentParsers fallback parse; projectPaperRaster/rotoFrameDraw tile loop | high | mitigate | Clamp/normalize at parse (finite, in-range, else 1) in FALLBACK_PAPER_KEYS path and isPhysicPaintRotoBackgroundMetadata; floor tile step with Math.max(1, step) at draw so scale 0/negative/NaN can never produce a zero-step infinite loop. Pin: Task 2 malformed-scale draw test. |
| T-260923-02 | Tampering | grainScale value in document/mirror | low | accept | Value is render-only (pattern transform); it cannot alter stroke data, physics, or executable content; engine visible background is suppressed so no engine state is written. |
| T-260923-03 | Information Disclosure / Spoofing | TopBar control + persisted scale | low | accept | No new trust decision, no auth surface, no cross-user data; scale is cosmetic metadata alongside existing paperGrain/grainStrength. |
| T-260923-SC | Tampering | package installs | low | accept | This quick performs zero npm/pip/cargo installs — no Package Legitimacy Audit table required; dependencies unchanged. |
</threat_model>

<verification>
1. RED-first proof: targeted vitest runs before implementation fail on the new pins (record the failure output in the SUMMARY).
2. GREEN: pnpm --filter efx-motion-editor exec vitest run (full suite, never watch) passes.
3. Type safety: pnpm --filter efx-motion-editor exec tsc --noEmit passes.
4. Scope gate: git diff --name-only matches files_modified — no engine workspace package, no drawDeterministicPaperGrain step change, no new format fields beyond grainScale.
5. Native UAT (user, 4 rows, after GREEN):
   (1) Tools surface shows Grain scale; selecting smaller/larger visibly rescales the paper pattern on the Studio canvas.
   (2) Export at two different scales shows matching pattern size (not display-only).
   (3) Value survives Studio close/reopen and save/reopen.
   (4) Regression: grain on/off still works; a default-scale (1) project looks unchanged.
</verification>

<success_criteria>
All automated pins green (RED recorded first), tsc clean, scope gate clean, and the 4 native UAT rows pass live.
</success_criteria>

<output>
Create `.planning/quick/260923-bcm-paper-grain-scale-in-tools-canvas-export/260923-bcm-SUMMARY.md` when done
</output>
