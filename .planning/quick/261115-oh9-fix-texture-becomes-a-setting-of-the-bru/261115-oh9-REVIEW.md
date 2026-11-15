---
phase: 261115-oh9
reviewed: 2026-11-15T18:00:00Z
depth: quick
files_reviewed: 49
files_reviewed_list:
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.ts
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
  - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.test.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
  - app/src/lib/efxPaintBrushImport.test.ts
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - packages/efx-watercolor/probe/vector-spine/probe.ts
  - packages/efx-watercolor/probe/watercolor-opacity/probe.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/brushes/builtinBake.test.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.ts
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/brushBridge.test.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/engineTipIdentity.test.ts
  - packages/efx-watercolor/src/playground/index.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 261115-oh9: Code Review Report

**Reviewed:** 2026-11-15T18:00:00Z
**Depth:** quick
**Files Reviewed:** 49
**Status:** issues_found

## Summary

Reviewed the final state of quick 261115-oh9 at `4bb706468` (the four implementation commits plus
the two fix commits, `11ab31094` and `4bb706468`; the source tree was clean during review). The
previous round's findings are verified fixed: the live lift now binds a host-supplied untextured
`liftBrush` (`Engine.ts:2107-2109`, `AquarelleCanvasLayer.tsx:325-330`) and a lift stroke never
records a texture (`AquarelleCanvasLayer.tsx:595,608-614`); the binding seam refuses an unresolvable
texture (`aquarelleRecordState.ts:368`); the stroke band's Pick/stamp carry the texture
(`aquarelleStrokeBand.ts:150,230,243`); the play-script fallback copies it
(`physicsPaintRotoPlayScriptController.ts:4398`); and the GPU tip cache keys on
`(response, texture)` (`Engine.ts:1307`, `brushes.ts:83-85`). The other carriers (codec guard,
`toStudioStroke`, dup/copy, vector commit, restore, adapter binding, footprint/chip/thumb caches,
both UI surfaces, the script save law) still hold. Targeted suites pass: 406 app tests across 17
files and 115 package tests across 5 files (9 skipped), including the new `engineTipIdentity` pins.
Passing tests are not treated as correctness evidence: the source-string pins cannot see either
boundary gap below.

Two warnings remain. (1) The "eraser carries no texture" law is enforced at the writer and the
punch but not at the three persisted-data readers, so a lift+texture pair (produced by this
branch's own pre-fix build) still bakes a textured erase. (2) The engine's GPU tip cache never
invalidates when a mask is replaced under an existing id — `forgetBrush` has zero callers, while
the chip and footprint caches correctly key on `maskGeneration()`, so a chip can show bytes the
engine will not stamp. Four information items follow (play-script fallback still drops
`toolOverrides`; the library texture row is active during Lift; the strip's selected state diverges
from the validated binding; the live lift brush and the punch resolve an empty response id
differently).

Mechanical quick scans: no hardcoded secrets (the only token-shaped match is a test fixture lease
token), no `eval`/`innerHTML`/`dangerouslySetInnerHTML`, no empty catches, no commented-out code.
The only `console.log` calls are the two probe scripts' deliberate `PROBE_RESULT` output. CI/CD
checks are not applicable — the scope contains no workflow, Dockerfile, shell, Python or Go files.
No Preact/signals rule violations were found in the changed surface: no render-body signal writes,
the new setter is compare-then-write, and the menu/strip reads stay narrow.

## Narrative Findings (AI reviewer)

### WR-01: The lift/no-texture law is enforced at the writer, but the bake adapter, restore and duplicate readers accept a contradictory `tool: 'lift'` + `textureId` pair

**Classification:** WARNING
**Files:**
- `packages/efx-watercolor/src/adapter/engineAdapter.ts:296-307` — `configure()` binds
  `textureId: payload.textureId ?? null` regardless of `payload.tool`, then
  `engine.setTool(asTool(payload.tool))`.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts:1808-1832` — restore copies
  `engine.textureId` regardless of `engine.tool`.
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts:213` — copy/duplicate
  applies the same unconditional spread.
- `packages/efx-watercolor/src/payload/codec.ts:131-138` and the script schema engine guard
  validate only that `textureId` is a non-empty string when present; they do not reject the pair.

**Issue:** The writer (`AquarelleCanvasLayer.tsx:608-614`), the cached-base preview
(`AquarelleCachedBaseLayer.tsx:96`) and the punch (`aquarelleLiftErase.ts:93-99`) now exclude the
texture from a lift, so new live/record/punch strokes agree. The persisted-data readers do not
normalize, however. Given any payload carrying `tool: 'lift'` with a `textureId` — which this
branch itself produced between `b15a744e8` and `4bb706468`, and which a hand-built or foreign
script can still contain — the adapter builds a textured brush and the engine's `lift()` uses it
(the adapter never calls `setLiftBrush`, so `liftBrush` is null), while the committed raster was
punched with the untextured response tip. The restored stroke then also re-enters the record
timeline with the texture and can be re-saved, propagating the contradiction. That is the same
live/bake disagreement D-09 targets, moved to the replay boundary.

**Fix:** Normalize the pair at every reader boundary instead of trusting the payload:

```ts
// engineAdapter.configure
textureId: payload.tool === 'lift' ? null : payload.textureId ?? null,
```

```ts
// aquarelleRecordState restore (and physicsPaintRotoDuplicateScript)
const textureId = engine.tool === 'lift' ? undefined : engine.textureId;
```

Optionally reject the pair in `isStrokeShape` / the script engine guard so the state cannot enter
at all. Add a pin that configures a `tool: 'lift'` payload with a texture and asserts the bound
brush's `textureId` is null.

### WR-02: The engine's GPU tip cache never invalidates when a mask is replaced under an existing id — `forgetBrush` has no callers while the chip and footprint caches key on `maskGeneration()`

**Classification:** WARNING
**Files:**
- `packages/efx-watercolor/src/playground/Engine.ts:1306-1322` — `tipTexture` caches the uploaded
  texture by `brushTipCacheKey(b)` (`id|textureId`) and returns it on every later stamp.
- `packages/efx-watercolor/src/playground/Engine.ts:1292-1304` — `forgetBrush` is documented for
  "after a custom brush is removed or replaced" and has **zero call sites** in `app/` or the
  package.
- `packages/efx-watercolor/src/brushes/maskRegistry.ts:82-99` — `registerMask` overwrites an
  existing id; `:107-140` `replaceMaskRegistry` replaces the whole set.
- `app/src/stores/aquarelleBrushCatalog.ts:148-150` — `registerScriptMask` → `registerMask`,
  wired as the script-load port at `physicsPaintRotoScriptLibrary.ts:410` and registered during
  load at `:528`; project open/close reach `replaceMaskRegistry` at
  `aquarelleBrushCatalog.ts:268`, `:429` and `:236`.
- `app/src/components/physic-paint/view/watercolorMaskChip.ts:35` and
  `app/src/components/physic-paint/engine/aquarelleFootprint.ts:92` — both caches correctly append
  `g${maskGeneration()}`.

**Issue:** When a mask's bytes change under an id already in the registry (a loaded script
overwrites an existing custom id, a script re-imported after its texture changed on disk, or a
`replaceMaskRegistry` collision), `buildBrushForStroke` bakes new `tipData` but `tipTexture`
returns the previously uploaded GL texture for the unchanged `(response, texture)` key. The
texture chip and footprint caches do see the generation bump and repaint the new bytes, so the row
shows a texture the live sheet will not stamp — the chip-vs-engine parity D-04 claims cannot
drift. `forgetBrush` exists precisely for this replacement case and is dead code. Reachability is
low (custom ids are random per import), but the invalidation contract is missing and the new
composite key is the reason it now matters.

**Fix:** Watch the registry generation in the engine and sweep on change (bounded, unlike appending
the generation to every key, which would leak GPU textures):

```ts
private tipGeneration = maskGeneration();

private tipTexture(b: Brush): WebGLTexture {
  const generation = maskGeneration();
  if (generation !== this.tipGeneration) {
    for (const t of this.tipTextures.values()) this.gl.deleteTexture(t);
    this.tipTextures.clear();
    this.tipGeneration = generation;
  }
  // ...existing keyed lookup
}
```

Alternatively expose a `clearTipTextures()` and call it (or `forgetBrush` for every registered id)
from the catalog/bridge whenever the mask registry is replaced. Pin the sweep with a test that
registers mask A, uploads, overwrites A with different bytes, and asserts a new upload.

### IN-01: The play-script in-memory fallback still drops `stored.toolOverrides`

**Classification:** Info
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:4379-4411`
(the literal; the texture spread is at `:4398`)

**Issue:** `getRecordedAquarellePayload` provides `toolOverrides`
(`aquarelleRecordState.ts:2075`), and the fallback copies `tool`, `params`, `brushId`, the texture,
points, diffusion and frames — but not the eight multipliers. A bake on this branch therefore
stamps with the preset's base multipliers (size/aspect/rotation/spacing/scatter/…) instead of the
recorded ones, diverging from the live stroke. Reachability is conditional: the branch runs only
when `script.aquarelleEvents` is absent or empty (the save leg refuses absent but accepts an empty
array, and pre-existing scripts may lack the field). This is the residue of the same branch that
was just fixed for `textureId`.

**Fix:** Add the same conditional spread used for the texture:
`...(stored?.toolOverrides !== undefined ? { toolOverrides: { ...stored.toolOverrides } } : {})`.

### IN-02: The library texture strip stays interactive while the Lift tool is active

**Classification:** Info
**File:** `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx:283`

**Issue:** The floating library mounts `<WatercolorTextureStrip />` unconditionally, while the
top-bar popover renders its strip only in the brush branch
(`PhysicsPaintBrushMenu.tsx:133-220`). The library sheet can stay open across a tool change, so a
texture can be picked while the eraser is active; the eraser ignores textures, making the pick a
silent no-op for the current stroke (the selection is remembered for the next brush stroke, so
nothing is lost — the control is simply misleading in that state).

**Fix:** Render the strip only when `aquarelleActiveTool.value !== 'lift'` (mirroring the popover),
or disable it with an "applies to the brush" hint.

### IN-03: The strip's selected state reads the raw selection while the bound axis is validated — a dangling id renders no selected chip

**Classification:** Info
**Files:**
- `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx:129,146` — `selected` compares
  the raw `aquarelleSelectedTextureId.value`.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts:360-369` — the binding seam nulls
  an id the registry cannot resolve.

**Issue:** After the registry loses the selected custom id (project close/switch), the engine
correctly stamps the response tip, but the strip lists neither that id nor a selected chip — the
Default chip is not selected either — so the surface cannot say which texture is actually bound.
The runtime behavior is safe (the WR-01 fix); only the displayed state is untruthful until the
user picks again.

**Fix:** Derive the displayed selection through the same validation (an unresolvable id displays as
Default), or clear `aquarelleSelectedTextureId` on project close in the Studio realm (never on
every catalog payload, which would wipe the selection an import is about to make).

### IN-04: The live lift brush and the punch resolve an empty response id differently

**Classification:** Info
**Files:**
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:325-330` — the lift brush is
  built from `selection.brushId` directly; `buildBrushForStroke('')` falls back to `'round'`.
- `app/src/components/physic-paint/roto/aquarelleLiftErase.ts:96` — the punch applies
  `stroke.brushId || 'filbert'`, so `''` resolves to Filbert.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts:263,275-281` — `selectAquarelleTip`
  documents clearing the selection to null, which yields `brushId: ''`.

**Issue:** This is latent (no production caller passes null to `selectAquarelleTip` today; the
lifetime default is `'filbert'`), but the new live lift seam and the punch do not share one
resolution: with a cleared brush selection and a texture selected, the cached-base preview
(`liftShapeForStroke(aquarelleBrushForActiveTool())`) would draw a Filbert-shaped erase over the
Round silhouette the live pass and the punch use — exactly the class of disagreement the quick's
"one law" claim is meant to make impossible.

**Fix:** Build the live lift brush through the same resolution the punch uses (for example via
`liftShapeForStroke`, or apply the identical `selection.brushId || 'filbert'` fallback), so the
two call sites cannot diverge.

---

_Reviewed: 2026-11-15T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
