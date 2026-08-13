---
phase: quick-260813-ibo-paint-layer-invisible-in-studio-without-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/exportRenderer.ts
  - app/src/lib/exportRenderer.test.ts
autonomous: false
requirements:
  - QUICK-260813-IBO
estimate:
  tokens: 11000
  raw_tokens: 11000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A paint (physic-paint / PPaint) layer renders in the Studio canvas with zero Timeline key photos — no content key photo is required to see the paint layer."
    - "After save and project reopen, a paint-only project renders its paint layer in Studio exactly as it did before closing (hydration is layerId-keyed and independent of timeline key photos; the reopen symptom is the same render-gating defect, not a persistence loss)."
    - "Projects that DO have Timeline key photos render identically to before the fix (content render, cross dissolve, and overlay compositing are unchanged when a content frameMap entry exists)."
    - "Frames within a paint layer's authored/roto span that lie beyond the last content key photo still composite the paint layer (frameMap tail-extension already pads these; the fix must not regress them)."
  artifacts:
    - path: "app/src/lib/exportRenderer.ts"
      provides: "renderGlobalFrame restructured so overlay (FX/content-overlay) compositing runs even when no content frameMap entry exists at the current global frame"
      contains: "renderGlobalFrame"
    - path: "app/src/lib/exportRenderer.test.ts"
      provides: "Regression contract: paint-only project (empty frameMap, fx physic-paint sequence with seeded physical roto keys) still invokes renderer.renderFrame for the paint layer"
  key_links:
    - from: "app/src/lib/exportRenderer.ts"
      to: "app/src/lib/frameMap.ts"
      via: "frameMap contains only content-sequence keyPhoto frames; overlay sequences never appear in it, so overlay compositing must not be gated on frameMap entries"
      pattern: "frameIndex >= fm.length"
    - from: "app/src/lib/exportRenderer.ts"
      to: "app/src/lib/previewRenderer.ts"
      via: "Overlay renderFrame calls use the overlay sequence's own fps and an empty frames array when no content entry exists — resolveLayerSource only consumes frames/fps for base-layer image-sequence and video sources, never for physic-paint overlays"
      pattern: "overlaySeq.fps"
    - from: "app/src/stores/projectStore.ts"
      to: "app/src/stores/physicPaintStore.ts"
      via: "hydrateFromMce restores FX sequences/layers and physic_paint_outputs keyed by layerId — reopen visibility requires no timeline keys once render gating is fixed"
      pattern: "loadFromMceOutputs"
---

<objective>
Fix paint-layer render gating so a PPaint (physic-paint) layer composites in the Studio canvas without requiring any Timeline key photos, in-session and after project reopen.

Purpose: User report — "when I add a paint layer, I can't view it in studio until I add a key photo in Timeline… next time I open project paint layer alone are invisible." Root cause confirmed during planning: `renderGlobalFrame` (app/src/lib/exportRenderer.ts, early returns at the top of the function) aborts the whole render when the current global frame has no content-sequence entry in `frameMap`, which also skips the overlay compositing block at the bottom of the function that draws FX/paint sequences. `frameMap` (app/src/lib/frameMap.ts) is built exclusively from content sequences' keyPhotos and its tail-extension only runs when at least one content entry exists, so a project with zero Timeline key photos has an empty frameMap and Studio renders nothing — even though `totalFrames` already reports the paint layer's full span (getTimelineRequiredFrameCount includes overlay outFrame and roto display end). The reopen symptom is the SAME defect, not a hydration loss: `hydrateFromMce` (app/src/stores/projectStore.ts) restores FX sequences and their physic-paint layers, and `physicPaintStore.loadFromMceOutputs(project.physic_paint_outputs)` restores the physical roto document keyed by layerId — both fully independent of timeline key photos. Do NOT paper over the defect by faking a timeline key or extending frameMap with synthetic content entries.

Output: A minimal restructure of `renderGlobalFrame` so overlay compositing is independent of content entries, plus regression tests.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@app/src/lib/exportRenderer.ts
@app/src/lib/exportRenderer.test.ts
@app/src/lib/frameMap.ts
@app/src/lib/previewRenderer.ts
</context>

<tasks>

<task type="tracer">
  <name>Task 1: RED — failing regression tests proving the paint-only render gate (and that reopen is the same defect, not hydration loss)</name>
  <files>app/src/lib/exportRenderer.test.ts</files>
  <action>Add failing tests to the existing `describe('renderGlobalFrame')` block in app/src/lib/exportRenderer.test.ts, reusing the file's existing helpers (`makeRotoLayer`, `seedPhysicalRoto`, `physicPaintStore`, `sequenceStore` reset pattern — note `makeSequence` builds a content sequence; build the FX sequence inline instead). Two tests, both must FAIL before the fix and PASS after:

  Test A — "composites a physic-paint overlay with an empty frameMap (no Timeline key photos)": reset stores; create ONE Sequence with `kind: 'fx'` (not 'content'), an explicit `inFrame: 0`, `outFrame` large enough to cover the seeded keys (e.g. 100), `fps: 24`, and a single `makeRotoLayer()` layer; `seedPhysicalRoto` with keys mimicking the user's report (appFrames 41, 44, 47, small data-URL strings); call `renderGlobalFrame(rendererStub, canvasStub, 41, [], [fxSeq], [], false)` with an EMPTY `fm` array; use a stubbed `PreviewRenderer`-shaped object with a `vi.fn()` `renderFrame` (the existing test file already stubs renderers in nearby describes — follow that pattern); assert `renderFrame` was called at least once with a layers array containing the physic-paint layer and with `globalFrame` 41 passed through (paint lookup is keyed by global frame — previewRenderer.ts paintLookupFrame). Today this fails because the function returns before the overlay block when `fm.length === 0`.

  Test B — "hydrated paint-only project renders after simulated reopen (no content sequences registered)": reset stores; seed the physical document via `physicPaintStore.replaceRotoPhysicalDocument` (this mirrors exactly what `loadFromMceOutputs` installs on reopen — the physical document authority is layerId-keyed and does not touch timeline key photos; reference this in a short comment); register ONLY the fx sequence in sequenceStore (zero content sequences); assert the store-side authority is intact (`physicPaintStore.getRotoPhysicalRenderSource('roto-layer', 41)` returns a non-null, non-'loop-placeholder' source) AND that `renderGlobalFrame` with `fm = []` still invokes `renderFrame`. The store assertion pins the diagnosis that persistence is not the defect; the render assertion pins the actual gate.

  Also add one guard test (must pass both before and after): "content project renders unchanged" — an fx physic-paint sequence PLUS a content sequence with one keyPhoto, `fm` built from the content entry (reuse `buildSequenceFrames`-style inline entries or the exported helpers already used in this file); assert `renderFrame` is called for both the content pass (clearCanvas true) and the overlay pass (clearCanvas false).

  Run `pnpm vitest run src/lib/exportRenderer.test.ts` from the app/ directory (vitest run, never watch) and confirm Tests A and B fail for the expected reason (renderFrame never called) while the guard test passes.</action>
  <verify>
    <automated>cd app && pnpm vitest run src/lib/exportRenderer.test.ts -t "empty frameMap" ; tests A and B fail before the fix, guard test passes</automated>
  </verify>
  <done>Tests A and B exist and fail with "renderFrame not called" (proving the gate), the guard test passes, and no other test in the file regresses.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — restructure renderGlobalFrame so overlay compositing is independent of content frameMap entries</name>
  <files>app/src/lib/exportRenderer.ts</files>
  <behavior>
    - Test A from Task 1 passes: paint-only project (fm = []) composites the physic-paint overlay at every frame inside the overlay sequence's span.
    - Test B passes: simulated reopen renders identically.
    - Guard test passes: content + overlay projects render exactly as before (content pass, cross dissolve, fade, and overlay ordering unchanged).
    - Frames with a content entry behave byte-for-byte as before; only the no-content-entry path changes.
  </behavior>
  <action>In app/src/lib/exportRenderer.ts `renderGlobalFrame`, make the minimal restructure — do not refactor anything else:

  1. Keep `if (frameIndex < 0) return;` as a hard guard (negative frames render nothing, including overlays).
  2. Replace the blanket early returns (`frameIndex >= fm.length`, missing entry, `!seq || seq.kind === 'fx'`) so they gate ONLY the content-render portion. Concretely: compute `const entry = fm[frameIndex];` and `const seq = entry ? allSeqs.find(s => s.id === entry.sequenceId) : undefined;`, then derive `const hasContentEntry = !!seq && seq.kind !== 'fx';`. Wrap the existing cross-dissolve check AND the normal content render in `if (hasContentEntry) { ... }`, keeping `seqStart` / `seqFrames` / `localFrame` / `handledByCrossDissolve` scoped inside that block exactly as they are today.
  3. Leave the overlay compositing block (`if (!soloActive) { ... }`) unconditional, but decouple it from content state: where it currently passes `seqFrames` and `seq.fps` into `renderer.renderFrame` for content-overlay and FX sequences, pass an empty array fallback (`hasContentEntry ? seqFrames : []`) and the OVERLAY sequence's own fps (`overlaySeq.fps`). This is safe: `PreviewRenderer.resolveLayerSource` only consumes the `frames` argument for base-layer image-sequence lookups (overlays are never base layers) and only consumes `fps` for video sources; physic-paint overlays resolve via `physicPaintStore.getRotoPhysicalRenderSource(layerId, paintLookupFrame)` where `paintLookupFrame = globalFrame ?? frame` — already the global frame passed through. The overlay loop bound `getTimelineOverlaySequenceOutFrame(overlaySeq, fm.length)` needs no change: with `fm.length === 0` it falls back to `overlaySeq.outFrame` and is raised by `getPhysicPaintRotoDisplayEndFrame` from the seeded roto records (keys at 41/44/47 → end 48), matching the user's scenario.
  4. Do NOT touch `frameMap`, `totalFrames`, `Preview.tsx`, `exportEngine.ts`, hydration (`hydrateFromMce` / `loadFromMceOutputs`), or any store. Do NOT synthesize fake content entries. Explicit non-goal (leave unchanged, note in SUMMARY as known boundary): `startExport` still reports "No frames to export" for a paint-only project because it totals `fm.length` — the user reported Studio visibility only.

  Run the full file: `cd app && pnpm vitest run src/lib/exportRenderer.test.ts` — Tests A, B, and the guard all pass. Then run the neighboring suites that exercise this renderer: `cd app && pnpm vitest run src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/previewRenderer.test.ts src/lib/previewRenderer.loops.test.ts src/lib/frameMap.test.ts` — all must pass unchanged.</action>
  <verify>
    <automated>cd app && pnpm vitest run src/lib/exportRenderer.test.ts src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/previewRenderer.test.ts src/lib/previewRenderer.loops.test.ts src/lib/frameMap.test.ts</automated>
  </verify>
  <done>All Task 1 tests pass, all neighboring renderer/export suites pass, and the diff is confined to renderGlobalFrame's control flow plus the two overlay renderFrame argument fallbacks.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>renderGlobalFrame now composites paint (and other overlay/FX) sequences even when the project has zero Timeline key photos, in-session and across save/reopen; regression tests pin both the render gate and the hydration independence.</what-built>
  <how-to-verify>
    In the dev app (start it yourself on your side as usual):
    1. Create a new project (or use the reported one). Add a paint layer (PPaint) and paint keys — WITHOUT adding any Timeline key photo. Confirm the paint content is visible in the Studio canvas immediately at the painted frames (e.g. frames 41, 44, 47), and while scrubbing across the layer's span.
    2. Save the project, close it, reopen it. Confirm the paint layer content is visible in Studio again WITHOUT adding a Timeline key photo.
    3. Regression spot-check: open a project that has Timeline key photos plus a paint layer and confirm Studio rendering is unchanged (content frames, fades/transitions if any, and the paint overlay all composite as before).
    4. Playback spot-check: press Play on the paint-only project and confirm the painted frames appear during playback (the rAF loop routes through the same renderGlobalFrame).
  </how-to-verify>
  <resume-signal>Type "approved" or describe any frame/span where the paint layer still does not render.</resume-signal>
</task>

</tasks>

<verification>
- `cd app && pnpm vitest run src/lib/exportRenderer.test.ts src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/previewRenderer.test.ts src/lib/previewRenderer.loops.test.ts src/lib/frameMap.test.ts` — all green.
- Native UAT checkpoint approved: paint layer visible with zero Timeline key photos, survives save/reopen, content projects unchanged.
</verification>

<success_criteria>
- Paint-only project renders the PPaint layer in Studio without any Timeline key photo (user's primary request).
- Reopened paint-only project renders identically — no fake timeline keys introduced anywhere.
- Zero regressions in content/overlay/cross-dissolve rendering and in all neighboring renderer/export test suites.
</success_criteria>

<output>
Create `.planning/quick/260813-ibo-paint-layer-invisible-in-studio-without-/260813-ibo-01-SUMMARY.md` when done.
</output>
