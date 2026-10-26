---
status: awaiting_human_verify
trigger: "Studio compositor and main-editor compositor disagree for watercolor tracks: Studio looks like the top watercolor track is transparent/multiplied with the layers beneath; the editor masks the lower track but shows a strange speckle noise. Same artifact appears when watercolor is stacked over a cached paint on the SAME track. User asks to confirm whether watercolor compositing uses a blend mode (multiply) instead of alpha."
goal: find_and_fix
symptoms_prefilled: true
created: 2026-10-26T00:00:00.000Z
updated: 2026-10-26T00:00:00.000Z
---

## Current Focus

hypothesis: CONFIRMED — two independent divergences plus one same-track path. (H1, Studio glazing) In aquarelle mode the Studio gave each watercolor layer its own CSS `mix-blend-mode: multiply` and lifted the tracks-group isolation, so a watercolor track glazed/multiplied over the tracks beneath instead of masking them; the editor flattened tracks source-over first, which is the user-approved opaque-sheet law. (H2, editor speckle) The editor passed the flattened paint through `applyPaperPass` (paper tooth) before the multiply over the fond; for a watercolor transmittance raster (alpha = 1, paper response already baked by the engine) this second paper modulation produces the fine dark speckle over dense pigment — proof: Track 1 alone already shows the speckle, and the Studio live sheet never receives the pass. (H3, same track) The same-track capture merge used `mergeBlend: 'multiply'`, so a new watercolor sheet multiplied with the cached paint underneath instead of overpainting it.
test: validated by code inspection + user-provided image comparison + full test suite (6164 passed). Live UAT pending.
expecting: OPAQUE SHEETS (user law 2026-10-26): each Paint track is a sheet over the document paper; the tracks group multiplies once over the fond; a top watercolor track masks the tracks below; same-track watercolor over cached paint overpaints the cache; Studio and editor show the same pixels.
next_action: live UAT — (1) Studio two-track watercolor-over-brush masks the brush and matches the editor preview; (2) editor speckle gone on Track 1 alone and in the two-track composite; (3) same-track watercolor over cached paint overpaints (no strokes showing through); (4) reopening a cached watercolor frame shows the cache before any new stroke; (5) brush-mode appearance unchanged.

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

## Resolution

root_cause: |
  Two independent compositing-law divergences, plus a same-track capture bug. (1) Studio: in aquarelle mode each watercolor layer carried its own CSS `mix-blend-mode: multiply` with the tracks-group isolation lifted, so a top watercolor track glazed over the tracks beneath instead of masking them (the editor flattened source-over among tracks — the correct opaque-sheet behavior). (2) Editor: `applyPaperPass` (valley multiply + peak lighten) was applied to the flattened watercolor transmittance raster before the fond multiply, a second paper modulation on an already paper-aware opaque sheet; the lighten step over dense pigment is the fine dark speckle, and the Studio live sheet (no pass) stayed clean. (3) Same track: the aquarelle capture merge used `mergeBlend: 'multiply'`, multiplying a new watercolor sheet with the cached paint instead of overpainting it.

fix: |
  Opaque-sheet law applied in one seam per surface. Studio CSS: `.physics-paint-tracks-group` keeps `isolation: isolate` and owns the single `mix-blend-mode: multiply` over the fond in BOTH modules; all aquarelle per-layer multiply and isolation-lift rules removed; monitor set to `normal`; dead `dry-live-overlay` class removed from the view. Editor/export/preview: new `shouldApplyPaperPass` predicate in `paperPass.ts` skips the tooth for a pre-fond fully-opaque raster (probe `isFullyOpaqueRaster` taken before the fond multiply in `_resolveFlattenedFrame`; the same probe feeds the existing transmittance flag so there is one signature). Same-track capture: `mergeBlend` changed from `'multiply'` to `'source-over'`. Empty-sheet gate: the live aquarelle canvas renders `opacity: 0` until `engine.hasPaint`. Contract tests updated to pin the new law (group multiply once, no per-layer multiply, source-over merge, empty-sheet gate, pass gate).

verification: |
  `npx tsc --noEmit` clean. Targeted TDD tests: 46/46 (9 failed first as designed). Store/paper suites: 160/160. Studio/view/preview suites: 1833 tests across 76 files. Full app suite: 339 files passed | 2 skipped; 6164 passed | 1 skipped | 96 todo. Live UAT pending (the visual surfaces cannot be validated by vitest).

files_changed:
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
