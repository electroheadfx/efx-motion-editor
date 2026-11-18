---
phase: 64-medium-engine
reviewed: 2026-11-18T19:44:18Z
depth: deep
files_reviewed: 79
files_reviewed_list:
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleEnginePort.ts
  - app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
  - app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
  - app/src/components/physic-paint/roto/aquarelleLiftPreview.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftPreview.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/RightPanelPaperTab.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/aquarellePaintControls.ts
  - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/brushGroups.test.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
  - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/efx-paint/document/paintDocumentLight.test.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/probe/medium-engine/.gitignore
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-advect.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-lift.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-textured.json
  - packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json
  - packages/efx-watercolor/probe/medium-engine/baselines/neutral-pigment.json
  - packages/efx-watercolor/probe/medium-engine/baselines/red-over-blue-50.json
  - packages/efx-watercolor/probe/medium-engine/baselines/watercolor-50.json
  - packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/index.html
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/determinismContract.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/brushes.test.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/coverage.test.ts
  - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
  - packages/efx-watercolor/src/playground/dryMedia.test.ts
  - packages/efx-watercolor/src/playground/emboss.test.ts
  - packages/efx-watercolor/src/playground/index.ts
  - packages/efx-watercolor/src/playground/kmBand.test.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/relief.test.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/scattering.ts
  - packages/efx-watercolor/src/playground/shaders.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/spectral.ts
  - packages/efx-watercolor/src/playground/viscosity.test.ts
findings:
  critical: 2
  warning: 2
  info: 3
  total: 7
  necessity: 0
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-11-18T19:44:18Z
**Depth:** deep
**Files Reviewed:** 79
**Status:** issues_found

## Summary

Phase 64 (Medium Engine) was reviewed at deep depth: all 79 submitted files read in full or by verified line ranges, with cross-file tracing across the Studio, the frame-persistence coordinator, the store, the document parsers, and `packages/efx-watercolor` (Engine, shaders, spectral, adapter, probe harness). The core engine work is largely sound: the new layer maps (`relief`, `cover`) are positionally consistent across `travel`, `resize`, `clear`, `snapshotLayers`, and export; the KM scattering algebra and its neutral-default bit-identity hold; the light field persists through a strict fail-closed parser with a TS/Rust field pin; the Lift preview bridge and its punch math carry only declared approximations; and the coverage/relief GL blend pairs do not leak ambient state.

Two BLOCKERs survive verification, both in the new ambient-light (relief/emboss) feature:

1. **A light change never reaches any rendered or cached pixel.** The cache fingerprint is paper-only, the cached display layer has no light input, and the light term in `getContentSignature` gates only script-file saving. The frame the user sees after moving the light stays lit by the old light until an unrelated re-bake (paint, re-key, or reload) happens to occur.
2. **Every pointermove on a light slider writes the document and appends a unified-ledger entry.** Because the ledger is capped at 10 entries with splice eviction and redo clearing, a single drag over the azimuth track can permanently destroy the user's undo stack. This directly contradicts the plan's "one unified-ledger entry per gesture".

Two WARNINGs: fixed footprint extents clip the new per-dab paths for wide tips, and the two-sheet coverage capture loses its alpha in the fully-opaque coverage case.

Necessity review was performed at deep depth; no necessity finding survived (each guard examined either protects a reachable state or is exercised by a shipped path).

## Structural Findings (fallow)

No structural findings block was supplied with this review.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: A light change never re-lights a committed or cached frame

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2876-2883` (also `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts:280-283,289,297,336,346,566-570`, `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx:39,134-189`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1362-1382`, `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:808,880,927,1024,1071,1186`)

**Issue:**
`handleDocumentLightChange` applies the light to the document and appends a history entry, and then does nothing else:

```ts
const handleDocumentLightChange = (patch: Partial<PaintDocumentLight>): void => {
  ...
  rotoMoveHistory.recordBackgroundEdit(result.descriptor);
};
```

Three consumers would need the light, and none of them has it:

1. **Frame cache.** The real-frame cache revision is `buildRotoRealCacheRevision(document.revision, record.keyId, paperCacheTerm(document.background))`, and `paperCacheTerm` contains only the paper id, strength and scale. Two frames captured under different lights therefore share a cache revision, so a cache hit serves pixels baked with the superseded light.
2. **Visible cached sheet.** `AquarelleCachedBaseLayer({ url })` takes no light prop; its decode effect is keyed on `[props.url]` and it draws the baked WebP/`image` untouched. The displayed paint cannot react to a light change at all.
3. **Content signature.** `getContentSignature: () => \`${aquarelleStrokesRevision.peek()}|${lightSignature(documentLight())}\`` does include the light, but the only consumer is `studioScriptSnapshotController` (script-file save gating), never any pixel artifact. The comment above it — "a light change can never serve pixels lit by a superseded light" (lines 1378-1382) — is factually false.

The eager `exportCanvas('pigment')` at capture time runs `displayFS` with the then-current light, so the committed bytes are light-baked and frozen. Consequences: spec 05 §6 / lines 94-95 ("a light change re-bakes"), plan 64-07 lines 28-29 and the T-64-20 acceptance row lines 199-205, 219-223 ("no cache can serve a frame lit by a superseded light"), and UAT row 4 ("Move the light → the change is immediate on the canvas") are all violated. If a frame is ever freshly re-baked later under the new light (for example after the next paint stroke), the user sees the light "jump" on that frame only — an inconsistent multi-frame look.

**Fix:**
Make the light a first-class cache-key term, exactly like the paper:
- In `useRotoFramePersistenceCoordinator.ts`, extend the cache-key helper (the function that builds `paperCacheTerm`) with a `lightTerm(document.light)` derived from the resolved azimuth/elevation/intensity, and pass it at the three `buildRotoRealCacheRevision` call sites (lines 289/297, 336/346, 566-570).
- In `handleDocumentLightChange`, after the descriptor is recorded, schedule the deterministic re-bake/invalidation path (the same path a paper change uses) so every cached frame is re-captured under the new light.
- Do not just subscribe `AquarelleCachedBaseLayer` to the light: the emboss is baked into the pixels by `displayFS`, so a display-only tweak cannot reproduce the lit result.

#### CR-02: One light-slider drag appends one document write and one ledger entry per pointermove, blowing through the 10-entry undo cap

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/view/RightPanelPaperTab.tsx:60-97` (also `app/src/components/shared/SliderStepper.tsx:460-485`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2876-2883`, `app/src/stores/efxPaintStore.ts:1098-1133`, `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:744-748,750-755,977-982`)

**Issue:**
The three new light rows pass only `onChange`, never `onCommit`:

```tsx
onChange={(value) => props.onLightChange?.({ azimuth: value })}
```

`SliderStepper` emits `onChange` on every pointer move (lines 460-485) and `onCommit` once on release. Each `onChange` reaches `setDocumentLight`, which returns a fresh descriptor for **every distinct value** (`efxPaintStore.ts:1098-1133`), and `handleDocumentLightChange` records one ledger entry per call:

```ts
const recordBackgroundEdit = useCallback((descriptor: BackgroundEditDescriptor) => {
  appliedRef.current.push({ kind: 'background', descriptor });
  discardRedoHistory();
  trimAppliedHistory();
}, [...]);
```

`trimAppliedHistory` caps the stack at 10 and **splices off the oldest entries** (`useRotoPhysicalEditHistory.ts:744-748`), releasing their references; `discardRedoHistory` clears redo on the first move. A single drag of the azimuth track (0..360, step 1) or the intensity track emits dozens of writes, so:

- The pre-drag undo stack is permanently evicted (data-loss-grade undo failure), and
- Undo after the drag walks back through dozens of 1-unit light steps instead of restoring the pre-drag state, and
- Redo for whatever the user did before the drag is gone.

This contradicts `64-07-PLAN.md:28` ("one unified-ledger entry per gesture") and `64-09-PLAN.md:29` ("a real change produces exactly one ledger entry"). Note that `app/src/lib/history.ts` `startCoalescing`/`stopCoalescing` does **not** help here — it coalesces only the app-level history stack, not the Studio's roto ledger.

**Fix:**
Pick one of two coherent designs:
- **Gesture coalescing in the ledger (preferred, mirrors `app/src/lib/history.ts`):** on the first edit of a gesture, push the entry and remember its index; on subsequent edits of the same `operationKind` + target, replace that entry's `after` (keep `before`); on gesture end, finalize. This keeps one undoable command with the full before/after span. Wire the slider rows' `onCommit` to the finalize call so a release that changes nothing can drop the entry.
- **Record only on commit:** apply the light continuously to the live view (as `onChange` does now), but record the ledger entry from `onCommit` with a descriptor spanning before-gesture → after-release values. This requires passing `onCommit` through `RightPanelPaperTab.tsx` (it is already available on `SliderStepper`) and restructure of `handleDocumentLightChange` into live-apply + commit-record.

### Warnings

#### WR-01: Fixed draw extents clip the new relief and coverage passes for wide tips

**Severity:** WARNING
**File:** `packages/efx-watercolor/src/playground/Engine.ts:2273` (also `:2264`, `:2369`, `:2501`, `:2554`; reachable via `packages/efx-watercolor/src/brushes/tips.ts:124,131,138`, `app/src/components/physic-paint/view/BrushResponsePanel.tsx:33-42`, `app/src/components/physic-paint/view/aquarelleRecordState.ts:127-128`, `packages/efx-watercolor/src/playground/brushBridge.ts:131`)

**Issue:**
`drawStamp` sizes its scissor rect from the conservative mask bound:

```ts
g.draw(t, this.stampRect(x, y, r, t.w, t.h, Math.sqrt(1 + b.aspect * b.aspect) * 1.02));
```

The new per-dab paths instead use fixed extents:
- `drawRelief` defaults to `extent = 1.5` (line 2273),
- `coverageDeposit` scissor rects all three passes at `extent = 2` (line 2369),
- `lift()` builds `rect = stampRect(..., 2)` (line 2501) and reuses it for the relief/cover erosion (lines 2548-2554).

The footprint mask is aspect-scaled, so its half-extent is `sqrt(1 + aspect²)·r`. Any aspect above ~1.73 (coverage/relief at 1.5: above ~1.12) is scissor-clipped. This is reachable: tips declare aspect overrides 2.0/1.8/1.6 (`tips.ts:124,131,138`) and the user Aspect multiplier ranges 0.5..2.0 (`BrushResponsePanel.tsx:33-42`, `aquarelleRecordState.ts:127-128`; composed by `brushBridge.ts:131`), producing aspects up to 4.0.

Impact: a Body stroke's masstone deposit and its cover mask are truncated (the stroke silhouette changes as Body is raised — the very seam spec 06's cover pass exists to fix), the thickness/emboss deposit is cut short of the ink dab, and Lift's relief and cover erosion no longer match the pigment erosion it is documented to mirror.

**Fix:**
Derive all three rects from the same bound the pigment stamp uses:

```ts
const stampRect = this.stampRect(x, y, r, this.dw, this.dh, Math.sqrt(1 + b.aspect * b.aspect) * 1.02);
```

Use it for `drawRelief`'s default `rect`, for `coverageDeposit`'s `rect` (and its `touch`), and for `lift()`'s rect. The cost is a few extra scissored fragments; the correctness contract (same footprint as `stampFS`) is restored.

#### WR-02: The two-sheet coverage capture loses its alpha when the coverage export is fully opaque

**Severity:** WARNING
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:9986-9991` (also `app/src/lib/rasterAlpha.ts:147-159`, `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts:54-75`)

**Issue:**
The capture guard keeps the coverage canvas only when it is **not** fully opaque:

```ts
const liveCoverageCanvas = exportedCoverage !== null && !isFullyOpaqueRaster(exportedCoverage) ? exportedCoverage : liveAlphaCanvas;
```

`isFullyOpaqueRaster` samples every alpha (64×64 probe). At maximum Body coverage the cover mask saturates (`dst = a + dst·(1−a)` with `COVER_MEDIUM_DENSITY = 8`, `Engine.ts:191,2395-2404`; two dabs ≈ 0.9999999 round to exactly 1.0 in half float), so the mode-4 export's alpha is 1.0 everywhere the stroke covers — and for a stroke that covers the whole sheet the whole export is opaque. The guard then falls back to the transmittance (`liveAlphaCanvas`), and `transmittanceSourceToPigmentAlpha` will convert it **as if it were a stored transmittance raster** — which is wrong for an opaque pigment/coverage sheet: for pale pigment (e.g. white at full coverage) `alpha = 255 − min(r,g,b) = 0`, so the paint is rendered fully transparent and the dark underlayer shows through.

The same sheet-kind blindness exists in the merge: `transmittanceSourceToPigmentAlpha(scriptAlphaCanvas) ?? scriptAlphaCanvas` (`physicsPaintRotoAlphaMerge.ts:69-71`) decides purely from the opaque probe (`rasterAlpha.ts:147-159`), so any coverage sheet that happens to be fully opaque is misinterpreted as transmittance. Phase 64-15 explicitly defers live/export parity to UAT row 9, and this is precisely the source-level gap: the strongest-coverage case (the case the coverage pass was designed for) loses its alpha on committed frames.

**Fix:**
Stop inferring sheet kind from opacity. Carry it explicitly:
- Have the capture path know which sheet it is (the `exportCanvas('pigment')` result is always straight-alpha pigment; the transparent `snapshot()` is always transmittance) and pass a `kind: 'pigment' | 'transmittance'` tag through `captureLivePixels` and `mergeRotoAlphaCanvas`.
- In the merge, draw a `pigment` sheet raw (source-over) and only run `transmittanceSourceToPigmentAlpha` for a `transmittance` sheet.
- Keep `isFullyOpaqueRaster` as the legacy-format heuristic only where no explicit kind is available, and document that it cannot distinguish a saturated coverage sheet.

### Info

#### IN-01: Dead `coeffsOpacity` in the shipped package with a false docstring

**Severity:** INFO
**File:** `packages/efx-watercolor/src/playground/spectral.ts:75-89`

**Issue:**
`coeffsOpacity` is exported but has no caller anywhere in the shipped `packages/efx-watercolor/src` (verified by grep); only the probe workbench copy uses it. Its docstring claims "The Body cover attenuates the underlayer by THIS number ... the cover used to be calibrated with an arbitrary gain" — the shipped cover law does not use it (`bodyCoverFS`/`coverDepositFS` in `shaders.ts:446-489`, `Engine.ts` `coverPass`/`coverageDeposit` with `COVER_GAIN`/`COVER_MEDIUM_DENSITY`). A reader tracing the cover calibration will follow a false lead.

**Fix:** Either delete the export (and the workbench if it is dead too) or move it under `probe/` and correct the docstring to state it describes `displayFS` mode 4's alpha, not the deposit law.

#### IN-02: `fillStep` applies scattering but no Body cover/thickness

**Severity:** INFO
**File:** `packages/efx-watercolor/src/playground/Engine.ts:930-985`

**Issue:**
`fillStep` deposits pigment with the scattering term derived from `Body` (`uColor1` carries `scatteringDeposit(...)`) but never calls `coverageDeposit` or `brushRelief`. If a fill ever rendered a Body medium, its scattering and its coverage/thickness would disagree. This is not a live defect: `fillStep` has no caller in `app/` or the package (only the generated `dist/index.d.ts` mentions it), so the path is unreachable from the shipped Studio.

**Fix:** Record the divergence in the `fillStep` doc comment, or gate the scattering term behind the same Body-aware path so a future caller cannot resurrect the inconsistency.

#### IN-03: Azimuth 360 wraps to 0, making the slider knob snap to the left end on release

**Severity:** INFO
**File:** `app/src/stores/efxPaintStore.ts:1113`

**Issue:**
```ts
azimuth: ((resolve('azimuth') % LIGHT_AZIMUTH_MAX) + LIGHT_AZIMUTH_MAX) % LIGHT_AZIMUTH_MAX,
```
with `LIGHT_AZIMUTH_MAX = 360` (line 1076) and the slider's max at 360. Dragging to the right end and releasing rewrites 360 as 0, so the knob jumps from the right end to the left end even though the lighting is identical. Confusing UX, no state corruption.

**Fix:** Render the azimuth control on 0..359 (with the label treating 359 as "≈360"), or keep the stored value 360 when it is exactly the max and only wrap on explicit overflow. A canonicalization that is invisible to the user is preferable to one that visibly rewinds the control.

---

_Reviewed: 2026-11-18T19:44:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
