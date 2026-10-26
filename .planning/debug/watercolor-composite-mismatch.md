---
status: awaiting_human_verify
trigger: "Studio compositor and main-editor compositor disagree for watercolor tracks: Studio looks like the top watercolor track is transparent/multiplied with the layers beneath; the editor masks the lower track but shows a strange speckle noise. Same artifact appears when watercolor is stacked over a cached paint on the SAME track. User asks to confirm whether watercolor compositing uses a blend mode (multiply) instead of alpha."
goal: find_and_fix
symptoms_prefilled: true
created: 2026-10-26T00:00:00.000Z
updated: 2026-10-26T23:30:00.000Z
---

## Current Focus

hypothesis: CONFIRMED — ROUND 2 FIXED, AWAITING LIVE UAT. The watercolor sheet is OPAQUE transmittance in storage (`vec4(t, 1.0)`, white = no pigment); all display/composite seams now re-express it as STRAIGHT-ALPHA PIGMENT (alpha = 1 − min(r,g,b), color = (r,g,b − min)/alpha) so it stacks as a real paint layer: dense pigment masks, light washes stay translucent, and the one fond multiply (paper × t) stays exact. Engine-1 real-alpha paint is untouched (the full-opacity probe returns false).
test: All automated gates green — targeted 68/68, full app suite 6179 passed / 2 files skipped, `npx tsc --noEmit` clean. RED-first evidence: 12 intended failures before implementation.
expecting (live UAT): soft wash borders translucent in Studio AND editor/export; dense pigment masks lower tracks; cached base visible through unpainted areas; no speckle; Studio/editor parity.
next_action: user runs the live UAT rows in the Round 2 verification list, then archive this session if the surfaces match.

round2_constraints: |
  1. PAPER PASS GATE MUST BE RE-KEYED. `shouldApplyPaperPass` currently skips the tooth when the PRE-FOND raster is fully opaque (the aquarelle signature). Once the sheet carries pigment alpha the raster is no longer fully opaque, so that probe would re-enable the pass and the dense-pigment speckle returns. The gate needs an explicit aquarelle signal from the composite (e.g. the store sets "converted a transmittance track" while pre-resolving).
  2. STUDIO LIVE SURFACE. The live canvas renders with `MODE.transparent` when `compositorLayer` is on (Engine.ts:2071) — either add a pigment-alpha display mode (GPU, preferred: premultiplied rgb = t − min(t), alpha = 1 − min(t)) or convert the canvas before draw. The cached base `<img>` (`.aquarelle-cached-base`) holds the raw opaque sheet and needs the same alpha treatment, otherwise the same-track hard mask persists.
  3. STORAGE vs SEAM. Two viable designs: (A) store watercolor frames already carrying alpha (GPU at capture; needs a persisted aquarelle discriminator for the paper-pass gate — the frame records carry none today) or (B) keep storing opaque transmittance and convert at each display/composite seam (no format change, old projects keep rendering; cost is a per-frame CPU conversion that MUST be memoized per track/frame revision). Prefer the design with the smaller trusted surface and state the tradeoff explicitly.
  4. OUT OF SCOPE: the "new stroke loses existing strokes" bug the user also hit is a separate known regression — do NOT fix it in this session; only ensure this change does not worsen it.
  5. The conversion law already exists in app/src/lib/rasterAlpha.ts `transmittanceToAlpha` (alpha = 1 − min; color = (rgb − min)/alpha, straight alpha). Reuse it rather than writing a second formula.

## Symptoms

expected: |
  PRODUCT LAW (user decision 2026-10-26): opaque sheets. Each Paint track is an independent sheet composited over the document paper/fond. A watercolor track above a brush track masks the brush where the watercolor is dense; it does NOT multiply/glaze with the track beneath. Watercolor over a cached paint on the SAME track overpaints the cached pigment — it does not multiply with it. Studio canvas and main-editor preview must show the same pixels for the same frame.

actual: |
  Studio canvas (watercolor track above a brush track) shows the brush strokes through the watercolor as a multiply/glaze — the top track reads as transparent/darkened by the layers under it.
  Main editor (same frame) masks the brush below the dense watercolor (user considers this correct), but a strange fine dark speckle/noise motif appears across the dense blue pigment.
  The same multiply/noise artifact appears when watercolor is painted over an existing cached paint on the SAME track.

errors: |
  None reported (visual/compositing only).

reproduction: |
  1. Project with Track 1 = pigment-heavy watercolor, Track 2 = brush paint (track 2 beneath track 1).
  2. Compare the Studio canvas with the main editor preview at the same frame — the two surfaces disagree; Studio glazes, editor masks + speckle.
  3. Same track: paint brush strokes, commit to a cache, then paint watercolor over that cached paint — the same multiply/noise artifact appears.

started: unknown — user has no reliable before/after; treat as a code-law divergence, not a known regression point.

evidence_images:
  - /Users/lmarques/Desktop/top-opaque-watercolor.png (Track 1 alone, pigment-heavy watercolor)
  - /Users/lmarques/Desktop/bottom.png (Track 2 alone, brush paint)
  - /Users/lmarques/Desktop/composited in studio.png (Studio canvas, Tracks 1+2 — looks multiplied/glazed)
  - /Users/lmarques/Desktop/editor final compositing.png (editor preview, Tracks 1+2 — masks brush but shows speckle noise)
  - "/Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 22.30.29.png" (same-track watercolor stacked over cached paint — multiply/noise artifact)

## Eliminated

- hypothesis: The editor's per-track flatten is wrong and the Studio's per-layer multiply is the intended law.
  eliminated: 2026-10-26 — user product decision: opaque sheets is the law; the editor's track flatten is correct. The Studio was the surface to change.

- hypothesis: Same-track multiply is a separate CSS bug on the cached base only.
  eliminated: 2026-10-26 — the same-track artifact was the capture merge blend (`mergeBlend: 'multiply'` in `captureLivePixels` / the diagnostics call), not a CSS per-layer rule: the cached base image itself is normal inside the group; the merged bitmap already carried the multiplied pixels.

- hypothesis: The editor speckle comes from the fond multiply itself (single multiply is wrong).
  eliminated: 2026-10-26 — the speckle is absent from the Studio live sheet (no paper pass) and present on Track 1 alone in the editor, where only one track and one multiply exist. The added modulation is the tooth pass, not the fond multiply.

- hypothesis: `transmittanceToAlpha` in the preview renderer is the editor speckle source.
  eliminated: 2026-10-26 — it only runs for non-normal track blends; a normal watercolor track keeps the opaque transmittance raster, so it never sees the conversion.

## Evidence

- timestamp: 2026-10-26
  checked: packages/efx-watercolor/src/playground/shaders.ts:646-668 (uMode == 2 branch)
  found: Watercolor renders TRANSMITTANCE, opaque (R2.2 paper-agnostic multiply seam): `o = vec4(t, 1.0)` where rgb is how much paper light gets through the pigment. The comment states it must be composited with `mix-blend-mode: multiply` over ANY fond: result = fond x transmittance. `MODE.paper` instead bakes `rgb * paperCol` into the sheet.
  implication: Confirms the user's suspicion for the watercolor LAYER-level law — it is a multiply/transmittance layer, not a straight-alpha layer. Canvas multiply still uses the source alpha, but the raster is opaque here (alpha = 1), so per-track source-over makes it OCCLUDE lower tracks instead of glazing.

- timestamp: 2026-10-26
  checked: app/src/efx-paint/compositor/efxPaintCompositor.ts:234-339 (compositeFrame)
  found: ONE shared pure pipeline flattens participating Paint tracks bottom-to-top with per-track opacity then blend mode; the FIRST participating track forces `source-over`, every other track uses `blendModeToCompositeOp(track.blendMode)` (default normal -> source-over). Only after all tracks are flattened does the Background/fallback draw destination-over, and then the store multiplies the flattened raster over the paper fond (physicPaintStore.ts:3017-3024).
  implication: In the editor a watercolor track with blendMode 'normal' composites source-over over the brush track -> brush masked. This matches the user-approved opaque-sheets law. The flatten-then-multiply-over-fond order is the v1.0 law ("tracks blend among themselves first, then the result is placed over the background/fond").

- timestamp: 2026-10-26
  checked: app/src/components/physic-paint/physicsPaintStudio.css:6734-6759, 6841-6866, 6894-6900
  found: In aquarelle mode `.physics-paint-tracks-group` lifts `isolation: auto` and each aquarelle layer gets its own `mix-blend-mode: multiply` — `.aquarelle-live-canvas` (6855), `.aquarelle-cached-base` (6864), `.physics-paint-program-monitor` (6899), `.physics-paint-cached-roto-playback` (6934). In brush mode the tracks GROUP is multiply-once over the fond (6752) and the monitor is normal inside (6757).
  implication: Studio watercolor mode is a per-layer multiply (glazing) over everything beneath, including lower tracks — exactly the behavior the user rejects. Brush mode already follows the "multiply once over the fond" law, so the divergence is specific to the aquarelle CSS treatment.

- timestamp: 2026-10-26
  checked: app/src/stores/physicPaintStore.ts:2954-3025 (_resolveFlattenedFrame)
  found: Before the fond multiply, `applyPaperPass(passCtx, w, h, passTile)` modulates the flattened mixed paint (paper tooth) when the fond is paper and grainStrength > 0. Then the whole raster is multiplied over the paper fond (`fondCtx.globalCompositeOperation = 'multiply'`).
  implication: Candidate mechanism for the editor speckle: the pass is applied to the already-paper-aware watercolor transmittance raster, potentially a second paper modulation. Must be verified against a live/export capture (and against the Studio path, which draws the live aquarelle canvas with no pass above the monitor).

- timestamp: 2026-10-26
  checked: app/src/lib/paperPass.ts:302-333 (applyPaperPass) + image comparison of the user's captures
  found: The tooth is a multiply with a valley map plus a LIGHTEN draw with a peak map, then an alpha restore. A lighten overlay is a nonlinear lift; over dense dark pigment (watercolor transmittance near black) the peak map leaves isolated un-lifted specks wherever the height field is non-zero, reading as fine dark speckle. Track 1 alone (`top-opaque-watercolor.png`) already shows the speckle while no lower track participates, and the Studio live sheet draws with no pass, so the pass — not the track blend — is the sole source.
  implication: H2 confirmed. Fix at the single seam: skip the pass for a pre-fond fully-opaque (transmittance) raster. Engine-1 alpha paint keeps real alpha, so the probe stays false and the tooth applies unchanged there.

- timestamp: 2026-10-26
  checked: app/src/components/physic-paint/physicsPaintStudio.css (post-fix) + PhysicsPaintCanvasMount.test.ts F1/F2a
  found: The base `.physics-paint-tracks-group` rule now carries `isolation: isolate` + `mix-blend-mode: multiply` for BOTH modules; the aquarelle isolation lift and the per-layer multiply rules are deleted; `.aquarelle-live-canvas` keeps only z-index 4; `.aquarelle-cached-base` keeps only z-index 3; `.physics-paint-program-monitor` is `mix-blend-mode: normal`. Per CSS spec an element's own mix-blend-mode still blends with its parent backdrop, so the group multiplies exactly once over the fond even though isolation is restored inside it.
  implication: H1 fixed with one law in one seam. The Studio now flattens its tracks source-over inside the group and multiplies the result once over the paper — identical to the editor's flatten-then-multiply.

- timestamp: 2026-10-26
  checked: app/src/components/physic-paint/PhysicsPaintStudio.tsx:7101, 7114 (captureLivePixels + diagnostics capture)
  found: Both capture calls recorded `mergeBlend: 'multiply'` into `aquarelleMergeBaseRef`; the merge writes the new sheet as a multiplication with the cached bitmap, which is the see-through same-track artifact. Changed to `'source-over'` so a new watercolor sheet overpaints the cache.
  implication: H3 fixed at the capture seam. Consequence recorded for UAT: once the first stroke lands, the new sheet replaces the cached pixels wholesale (the engine sheet is not seeded from the cache) — this is the declared overpaint law, not a regression.

- timestamp: 2026-10-26
  checked: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx (post-fix)
  found: The live transmittance sheet is opaque (alpha = 1) even when empty. Under the new source-over-inside-group law, an empty sheet would paint opaque white over the cached base and the fond. Added a module-level `aquarelleLivePaint` signal set from `engine.hasPaint` at the end of the rAF tick (after the frame-change clear) and applied as `opacity: 0/1` on the live canvas — opacity, not visibility, so the canvas stays the pointer target.
  implication: Empty-sheet washout regression prevented. A cleared/new sheet starts hidden in the same tick it is cleared.

- timestamp: 2026-10-26T22:40:00.000Z
  checked: app/src/efx-paint/compositor/efxPaintCompositor.ts:315-324 + physicPaintStore.ts ports wiring
  found: The compositor reads `ports.trackRasterMemo.get(trackKey)` BEFORE `ports.resolveTrackContent`. Wrapping only the resolve port would have been bypassed for every memoized track (the common case), silently restoring the opaque sheet.
  implication: A converting composite must be handed NO raw per-track memo (`trackRasterMemo: convertTransmittanceTracks ? undefined : trackRasterMemo`); the memo keeps RAW resolutions for the non-converting seams. Pinned in paperPass.frameGuard.test.ts U1b.

- timestamp: 2026-10-26T22:55:00.000Z
  checked: app/src/components/physic-paint/PhysicsPaintStudio.tsx:7493 (program monitor liveOverlay)
  found: In aquarelle mode the monitor passes `liveOverlay: null` and `excludeActive: true` — the aquarelle live surface never reaches the store as a mutable overlay canvas. No conversion of a mutating canvas is needed (and the WeakMap helper must never be given one: its memo assumes immutable pixels).
  implication: Conversion is safely limited to pre-resolved ImageBitmaps / registered frame canvases / one-shot export snapshots.

- timestamp: 2026-10-26T23:05:00.000Z
  checked: consumer audit — aquarelleFramePose.ts, physicsPaintRotoPlayScriptRenderer.ts, physicsPaintRotoScriptThumbnail.ts, physicsPaintRotoScriptLibrary.ts, physicsPaintRotoAlphaMerge.ts, physicsPaintRotoScriptRebake.ts, aquarelleRenderSplitCapture.ts
  found: Pose white margins, script thumbnails/library, and the render-split diagnostics all consume STORED opaque bytes and stay exact (paper × t). The reveal bake already converts via `transmittanceToAlpha`. Two seams needed the pigment law: the same-track capture merge and the script rebake (both `'multiply'` → `'pigment-alpha'`, composing over white).
  implication: The opaque-storage invariant holds everywhere; only the seams that STACK the sheet changed.

- timestamp: 2026-10-26T23:20:00.000Z
  checked: RED-first targeted run (7 files) before implementation
  found: 12 intended failures: helper missing, predicate file missing, gate not re-keyed, store conversion absent, Engine `MODE.pigment` absent, shader mode 4 absent, cached-base component absent, capture still `source-over`, rebake still `multiply`.
  implication: Each new law had a failing test first. After implementation: targeted 68/68 green.

- timestamp: 2026-10-26T23:25:00.000Z
  checked: full `npx vitest run` + `npx tsc --noEmit`
  found: Two source-contract pins broke for legitimate reasons: (a) PhysicsPaintStudio.test pinned the moved `class="aquarelle-cached-base"` string — retargeted to the `AquarelleCachedBaseLayer` mount; (b) physicPaintStore.test RED 8b indexed `createdCanvases[0]`, which is now a 64×64 probe canvas — retargeted to the 4×3 compositor canvas by size. Final: 340 files passed | 2 skipped; 6179 passed | 1 skipped | 96 todo; tsc clean.
  implication: No behavioral regression in the engine-1 paths; the only breakages were test selectors.

## Resolution

root_cause: |
  ROUND 2: the round-1 blend law was correct but the watercolor sheet is OPAQUE transmittance in storage (`vec4(t, 1.0)`, alpha = 1 everywhere, white = no pigment). Under any source-over stacking that is a hard mask: wash borders that should read 50–80% transparent render fully opaque, and a sheet covers the cached base wholesale. The layer model must be straight-alpha pigment: alpha = 1 − min(r,g,b), color = (rgb − min)/alpha — exact over paper because a·C + 1 − a = t, so the one fond multiply (paper × t) is still exact while inter-track stacking becomes ordinary alpha compositing.

  ROUND 1 (historical, superseded by round 2): two independent compositing-law divergences, plus a same-track capture bug. (1) Studio: in aquarelle mode each watercolor layer carried its own CSS `mix-blend-mode: multiply` with the tracks-group isolation lifted, so a top watercolor track glazed over the tracks beneath instead of masking them (the editor flattened source-over among tracks — the correct opaque-sheet behavior). (2) Editor: `applyPaperPass` (valley multiply + peak lighten) was applied to the flattened watercolor transmittance raster before the fond multiply, a second paper modulation on an already paper-aware opaque sheet; the lighten step over dense pigment is the fine dark speckle, and the Studio live sheet (no pass) stayed clean. (3) Same track: the aquarelle capture merge used `mergeBlend: 'multiply'`, multiplying a new watercolor sheet with the cached paint instead of overpainting it.

fix: |
  ROUND 2 — option B (opaque storage, pigment conversion at display/composite seams). One conversion law + one memo: `transmittanceSourceToPigmentAlpha` (rasterAlpha.ts) probes full opacity and converts once per immutable raster via a WeakMap; `shouldConvertTransmittanceTracks` (efxPaintPigmentAlpha.ts) decides WHEN (more than one content track, background content, or no fond — a single track over a fond keeps the exact opaque fast path). `_resolveFlattenedFrame` converts pre-resolved track rasters, denies the RAW per-track memo on converting composites (the compositor reads it before the resolve port), and passes `transmittanceTrackConverted` to `shouldApplyPaperPass` so the engine-1 tooth stays off watercolor. Studio: displayFS `uMode 4` emits premultiplied pigment alpha and the compositor view renders in it; `AquarelleCachedBaseLayer` converts the committed sheet at display; `exportCanvas('transparent')` keeps the opaque storage format. Same-track capture and script rebake switch to `mergeBlend: 'pigment-alpha'` (white → cached base → converted sheet source-over; stored t' = a·C + (1−a)·t_base). Round-1 laws stay: group multiply once, pass gate, empty-sheet opacity gate.
  ROUND 1 (historical): opaque-sheet law — group owns the single multiply; `shouldApplyPaperPass` skips the tooth for a pre-fond fully-opaque raster; empty live sheet opacity 0 until `hasPaint`.

verification: |
  ROUND 2: RED-first — 12 targeted tests failed before implementation for the intended reasons. Green: targeted 68/68; full `npx vitest run` 340 files passed | 2 skipped, 6179 passed | 1 skipped | 96 todo; `npx tsc --noEmit` clean. LIVE UAT PENDING (visual surfaces cannot be validated by vitest).
  ROUND 1: 46/46 targeted, full suite 6164 passed, tsc clean; live UAT failed on semi-transparency (this round).

round2_files_changed:
  - app/src/lib/rasterAlpha.ts
  - app/src/lib/rasterAlpha.test.ts
  - app/src/efx-paint/compositor/efxPaintPigmentAlpha.ts (new)
  - app/src/efx-paint/compositor/efxPaintPigmentAlpha.test.ts (new)
  - app/src/lib/paperPass.ts
  - app/src/lib/paperPass.transmittanceGate.test.ts
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx (new)
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts (doc)
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts (doc)
  - app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts (doc)

round1_files_changed:
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/lib/paperPass.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/lib/paperPass.transmittanceGate.test.ts

## Prevention

The class of bug is a compositing law that existed in two places (CSS per-layer rules and the canvas flatten) with no single statement of where the multiply belongs. It was not caught by any gate: no test asserted that the aquarelle Studio path and the editor flatten produce the same law, and the tooth pass had no guard that its input was engine-1 alpha paint. Guards now in place: `aquarelleLayerContract.test.ts` F2a pins "the tracks group is the ONE paper multiply in every module" (and forbids per-layer multiply), the CACHE test pins the source-over overpaint law, the EMPTY SHEET test pins the opacity gate, and `paperPass.transmittanceGate.test.ts` + `paperPass.frameGuard.test.ts` pin the transmittance skip and the probe ordering. Residual gap: no automated pixel-parity test between the Studio DOM stack and the flattened editor raster — both surfaces are pinned by law (source text), not by identical pixels; a future parity harness would need a headless layout engine and is out of scope for this session.

## Round 2 — UAT failure (2026-10-26)

uat_result: |
  ROW 1 FAILED. The user reports "I lost the semi transparency of the watercolor": wash borders that should read ~50–80% transparent now render as a hard mask (capture: `8.png` in the conversation image cache). The user's proposed law: base the layer alpha on pigment strength. The same-track complaint follows the same mechanism — an opaque sheet covers the cached paint instead of letting unpainted areas read through.

observed_mechanism: |
  The watercolor engine output is opaque transmittance (`shaders.ts:652-660`, `o = vec4(t, 1.0)`), and round 1 only changed how that opaque sheet is blended. Under source-over the sheet is now a full-canvas opaque mask whose "no pigment" white is indistinguishable from paint coverage. The user wants the sheet converted to pigment alpha before compositing.

required_law: |
  STRAIGHT-ALPHA PIGMENT LAYER: alpha = 1 − min(r,g,b); color = (rgb − min)/alpha. Dense pigment → alpha near 1 → masks tracks below. Light wash → low alpha → reads as translucent. Over the paper fond the one multiply still reproduces the transmittance exactly (paper × t). Between tracks the law is ordinary source-over alpha compositing. Studio and editor must match.

design_decision: |
  OPTION B — storage stays opaque transmittance; conversion happens at display/composite seams. Rejected option A (persist alpha frames): frame records carry no engine discriminator today, so A needs a persisted aquarelle flag on every capture path plus a format change, and it would reinterpret every existing stored sheet. B keeps the bytes' meaning stable (old projects, thumbnails, pose margins, reveal bake, diagnostics all keep working) and reuses the runtime discriminator the round-1 paper-pass gate already trusts: `isFullyOpaqueRaster` — a stored transmittance sheet is fully opaque, engine-1 alpha paint is not. Cost: a per-frame CPU conversion, memoized by raster-object identity (WeakMap) so it runs once per track/frame revision, never per playback tick. Residual risk (shared with the round-1 gate): an engine-1 frame that is fully opaque everywhere would be misread as transmittance and recolored; accepted as the existing declared discriminator, documented here.
  SEAMS: (1) editor/export/monitor — `_resolveFlattenedFrame` converts each participating fully-opaque track raster before `compositeFrame` (helper `transmittanceSourceToPigmentAlpha` in `rasterAlpha.ts`, WeakMap-memoized by immutable raster identity; store keeps its no-pixel-API guardrail) — but ONLY when the composite has other content (more than one participating track, background content, or no fond); a single watercolor track over the paper fond keeps the exact opaque fast path via the pure predicate `shouldConvertTransmittanceTracks`. The compositor is denied the RAW per-track memo on a converting composite (it reads the memo before the resolve port). (2) paper-pass gate — explicit `transmittanceTrackConverted` signal; skip the tooth when either it or the pre-fond opacity probe is set. (3) Studio live canvas — `MODE.pigment = 4` in displayFS: premultiplied `vec4(pigment·alpha, alpha)` where pigment = (t − min)/alpha; transparent outside the sheet; `Engine.render` uses it when `compositorLayer`; `exportCanvas('transparent')` still returns the opaque sheet so storage is unchanged. (4) Studio cached base — `AquarelleCachedBaseLayer` canvas replaces the raw `<img>`: one decode + one probe + one conversion per URL (the element is hidden during cached-roto playback, so never a hot path); raw bytes untouched for playback/thumbnails. (5) same-track capture — compose over white: white → cached base → pigment-alpha-converted live sheet source-over, yielding `t' = a·C + (1−a)·t_base`, which the one fond multiply turns into `a·(paper·C) + (1−a)·(paper·t_base)`. Script rebake adopts the same law. `transmittance` on the frozen record is false whenever a track was converted (the probe is no longer opaque) so previewRenderer draws source-over; transparent-background export now carries pigment alpha, as expected.

open_questions_for_the_debugger: |
  RESOLVED (see design_decision + Resolution): (1) conversion at both seams — GPU pigment display mode for the live surface, memoized CPU conversion in the store/capture (option B, storage untouched); (2) the paper pass learns it from the explicit `transmittanceTrackConverted` flag; (3) transparent-background export now carries pigment alpha, and every consumer that assumes opaque storage (thumbnails, pose margins, reveal bake, diagnostics, playback) was audited and keeps consuming the stored opaque bytes.

known_separate_issue: |
  The user also re-hit the "new stroke loses existing strokes" bug. Explicitly deferred: do not fix it in this session; only avoid making it worse.
