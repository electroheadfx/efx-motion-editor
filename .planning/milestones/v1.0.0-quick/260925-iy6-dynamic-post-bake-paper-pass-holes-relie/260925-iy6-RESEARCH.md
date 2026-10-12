# Quick 260925-iy6: dynamic post-bake paper pass (holes + relief) - Research

**Researched:** 2026-09-25
**Domain:** Canvas 2D compositor pass / precomputed texture tiles / Preact-signal invalidation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)

**Hole color semantics — "Paper shows through holes"**
- Holes read as the **real paper showing through**, even at 100% paint opacity.
- Implementation model: **paper-tinted modulation map** (NOT alpha-punch, NOT black multiply).
- PIN 0 = 1.0000 intact: never scale depositAlpha / strokeOpacity / body coverage (260924-m7w law).
- Alpha-punch (`destination-out`) is explicitly rejected — it would change paint alpha.
- Raw black multiply is explicitly rejected — at 100% opacity the paper itself would not be visible.
- Valleys still "darken slightly" as the prompt states — the darkening is toward the paper's own tone, not toward black.

**Strength source — wire the existing grain-strength UI**
- The grain-strength control already exists and is inert since 9a (260925-dso) — **activate it as the `strength` term** in the signed height model `s = (h - 0.5) * 2 * strength`.
- Grain **scale** stays spatial-only (tile size). Do **not** derive strength from scale — they are independent physical parameters.
- Strength modulates **tooth depth only** — never paint opacity or deposit alpha.
- Wire the existing control **as-is** under the numeric-stepper contract (260924-ffd): integer ±1 + presets / free entry + EU comma. **No new control, no redesign.**
- Hole look remains the paper-tinted map from the decision above.

**Export path contract — share one code path**
- Pin 4 = **the exact same routine**. Export calls the same tile + drawImage/GCO paper pass as the canvas.
- Rationale: 9a just deleted a second pixel-loop implementation of this effect (`fillPolyGrain` + `applyPaperEmboss`) because it diverged and cost two synchronous passes. This project has been bitten repeatedly by dual pipelines drifting (bake vs composite, child-realm vs main-realm, mirror vs parent). Summarized visual UAT would not catch subtle drift.
- Guardrails (user-specified):
  - The shared routine takes a **target 2D context + width/height**; it must **never reach for the live canvas**.
  - **Same tile grid, same shared paper texture, same grain scale / Strength params** on both paths.
  - **save/restore globalCompositeOperation** around the call.
  - **No pixel loop** in either path.
  - Parity UAT = exported file compared against a canvas capture of the same frame.

### Claude's Discretion (verbatim)
- Exact GCO recipe (which of multiply / lighten / screen / overlay per pass, pass count 1-2 within the stated budget) — user suggestion is signed height-map encoded into precomputed tile(s), possibly two tiles (multiply map + lighten map). User marked this "suggestion, not mandated".
- Tile cache keying and regeneration triggers (paper id + grain scale + strength + paper-tint inputs).
- Where the pass sits in `_resolveFlattenedFrame` / export pipeline relative to the existing paper fond (fond stays beneath; this pass modulates the mixed paint above it).

### Deferred Ideas (OUT OF SCOPE)
- (none listed in CONTEXT.md)
</user_constraints>

## Summary

The pass belongs **inside `_resolveFlattenedFrame` in `app/src/stores/physicPaintStore.ts`**, applied to the mixed-paint raster before the fond draw. This is the single structural insight of the research: preview and export both consume that one memoized record — `previewRenderer` draws `frame.raster` directly (`if (frame.raster) return frame.raster;` [VERIFIED: app/src/lib/previewRenderer.ts:659]) and export's `renderGlobalFrame` reads the same `getFlattenedFrame` seam — so applying the pass there makes Pin 4 (export parity) **structural, not duplicated**. The existing invalidation chain already delivers "change paper/scale/strength → immediate re-texture with no re-bake": `_fondSourceSignature` includes `grainStrength` and `grainScale` terms [VERIFIED: app/src/stores/physicPaintStore.ts:1611] and `setRotoBackgroundMetadata` (line 2850) clears `_flattenedMemo`/`_trackRasterMemo` + `bumpTrackRevision` on any change.

The visual model: one precomputed tile pair (or one two-channel tile) per (paper id, size, grainScale, strength, paper tint), built **off the frame path** at cache-miss time, applied per frame with 1–2 `drawImage` + GCO passes and zero pixel loops. Signed height `s = (h - 0.5) * 2 * strength` is evaluated at tile **build** time, not draw time. Grain strength UI (segmented presets, inert since 9a) flows through the already-wired `setRotoBackgroundMetadata` path — activation is almost entirely in the tile builder, not the UI layer.

**Primary recommendation:** apply the pass to `result.raster` immediately after `compositeFrame(...)`, before `fondCtx.drawImage(result.raster, 0, 0)` — fond stays beneath, pass modulates mixed paint only, record freeze/WebP encode carries the result to every consumer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tile build (height extract, condition, encode maps) | App lib (build-time) | — | Cache-miss only; never in display frame path |
| Pass application (drawImage + GCO) | App store (`_resolveFlattenedFrame`) | — | Single seam shared by preview + export |
| Invalidation on paper/scale/strength change | Store (`setRotoBackgroundMetadata`) | Fond signature rotation | Already exists; reuse, don't rebuild |
| Strength UI activation | TopBar segmented control | `usePhysicsPaintEngineActions` | Control already emits; metadata sync already persists |
| Fond (paper background) | `_resolveDocumentFondInstruction` | `getProjectPaperCanvas` | Untouched — stays beneath the pass |

## Standard Stack

No new packages. Everything is Canvas 2D + existing project machinery.

### Core (existing, reused)
| Library / module | Purpose | Why Standard |
|---------|---------|--------------|
| `app/src/lib/projectPaperRaster.ts` | Paper texture Image cache + `getProjectPaperCanvas` [VERIFIED: app/src/lib/projectPaperRaster.ts:78-94] | The tile cache must mirror its content-keyed pattern: `cacheKey = \`${paperTexture}:${width}x${height}:${normalizeGrainScale(scale)}\`` |
| `packages/efx-physic-paint/src/core/paper.ts` | `conditionHeightMap` — mean-centre 0.5, clamp: `out[i] = clamp(0.5 + (raw[i] - mean), 0.1, 0.9)` [VERIFIED: packages/efx-physic-paint/src/core/paper.ts:71-78] | 260925-dso locked conditioning; band [0.10, 0.90], idempotent |
| Canvas 2D `globalCompositeOperation` | multiply + lighten/screen passes | GPU-composited on WKWebView; no JS pixel work |

**⚠ Export gap:** `conditionHeightMap`/`loadPaperTexture` are **not exported** from `packages/efx-physic-paint/src/index.ts` (exports only `EfxPaintEngine`, types, `transformRecordedStrokeForHeldPose` [VERIFIED: packages/efx-physic-paint/src/index.ts:2-17]). The app-side tile builder needs conditioned height — either add an export (recommended, one line) or re-implement app-side (duplication risk, forbidden pattern per dual-pipeline history).

**Installation:** none — `pnpm` monorepo, zero new dependencies.

## Package Legitimacy Audit

No external packages installed by this quick. Section not applicable beyond the note above.

## Architecture Patterns

### Data flow

```
paper_1.jpg ──(load-time, cache miss)──► tile builder
  red channel → Float32Array → conditionHeightMap → s = (h-0.5)*2*strength
  → encode 1–2 RGBA tiles (valley/paper-tint map + peak/lift map)
  → TileCache key: paperId + WxH + grainScale + strength [+ tint]
                    │
setRotoBackgroundMetadata (paper/scale/strength change)
  → clears _flattenedMemo + _trackRasterMemo, bumpTrackRevision
  → next _resolveFlattenedFrame is a memo MISS → rebuilds with new tile
                    │
_resolveFlattenedFrame (per frame, memo miss only)
  compositeFrame(...) → result.raster (MIXED paint, all layers)
  → applyPaperPass(resultRasterCtx, w, h, tile)   ← SHARED ROUTINE (1–2 drawImage, GCO, save/restore)
  → [if fond] fondCtx: drawMissingRotoBackground(...) ; fondCtx.drawImage(result.raster, 0, 0)
  → freeze record → encodeBytes (WebP) memoized
                    │
        ┌───────────┴───────────┐
previewRenderer (frame.raster)   exportRenderer (same record)   transport/bridge
```

### Placement decision (Claude's discretion — recommended)
Apply the pass to `result.raster` **after** `compositeFrame` (line 2611) and **before** the fond block's `fondCtx.drawImage(result.raster, 0, 0)` (line 2647) [VERIFIED: app/src/stores/physicPaintStore.ts:2611-2649]. Rationale: (a) modulates mixed paint only, fond stays beneath per CONTEXT; (b) applies in both fond and `includeFond=false` (Studio monitor) branches — one call site; (c) record freeze/encode happens after, so WebP transport carries the pass.

### Pattern: shared routine (Pin 4 guardrails baked in)

```typescript
// app/src/lib/paperPass.ts — NEVER touches the live canvas
export function applyPaperPass(
  ctx: CanvasRenderingContext2D,   // target ctx, caller-owned
  width: number,
  height: number,
  tile: PaperPassTile,             // precomputed; paperId+size+scale+strength keyed
): void {
  if (!tile) return                 // CR-01: paperGrain '' (grain-off) → no pass
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'   // valleys → paper tone, never black
  ctx.drawImage(tile.valley, 0, 0, width, height)
  if (tile.peak) {                             // optional 2nd pass (discretion)
    ctx.globalCompositeOperation = 'lighten'   // peaks lift; screen = softer alt
    ctx.drawImage(tile.peak, 0, 0, width, height)
  }
  ctx.restore()                       // GCO restored — guardrail, mandatory
}
```

Caller in `_resolveFlattenedFrame` (sketch):
```typescript
const result = compositeFrame(efxDocument, frame, size, ports)
// … derive tile from same fond source as _resolveDocumentFondInstruction …
applyPaperPass(result.ctx, size.width, size.height, tile)  // after composite, before fond
if (fondInstruction) { /* existing fond block unchanged, draws result.raster on top */ }
```

### GCO recipe (discretion — recommendation)
- **Pass 1 `multiply`** with valley map whose darkest value is the paper tint (conditioned band [0.10, 0.90] × tint), **not** black — satisfies "darken toward paper's own tone" and keeps paper visible at 100% opacity.
- **Pass 2 `lighten`** (or `screen` for softer) with peak map — approximates the pre-9a full-opacity lift (`const colorShift = (hVal - 0.5) * 2 * strength` then `lift = colorShift * 80` [VERIFIED: git show b8dcfcca^:packages/efx-physic-paint/src/brush/paint.ts — deleted emboss, read this session]).
- **Avoid `overlay`** — user warning: "a raw overlay pushes contrast and moves flat colors" [VERIFIED: CONTEXT.md:53]. `destination-out` and black-multiply are rejected by locked decision.
- 1–2 passes fits the stated budget; single-tile-two-passes vs two tiles is open (discretion).

### Anti-Patterns to Avoid
- **Per-frame tile rebuild:** strength/scale changes rotate the memo anyway — rebuild on cache miss only. Per-frame build = HARD BLOCKER (pixel loop off path but still O(W×H) per frame).
- **Applying the pass inside `compositeFrame` or per track/layer:** one sheet after mix, never per layer — stacking must not fill holes.
- **Second implementation for export:** the exact failure 9a deleted (`fillPolyGrain`/`applyPaperEmboss`); `paint.grainRemoval.test.ts:94` already asserts `not.toContain('fillPolyGrain')`.
- **React patterns / useState:** Preact + signals only; consult `efx-preact-reactivity` skill. This quick should need no new hooks — metadata sync (`useRotoBackgroundMetadataSync`) already writes through.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Paper texture loading/tiling | New image loader | `projectPaperRaster` texture cache + subscription | Decode-once + content-keyed cache (memory: image decode storms) |
| Height conditioning | Re-derive normalization | `conditionHeightMap` (export it) | 260925-dso locked, idempotent; drift risk |
| Invalidation on control change | New effect/bump | `setRotoBackgroundMetadata` + fond signature | Existing chain clears both memos + bumps paint clock |
| Grain-scale spatial transform | Manual matrix math | `pattern.setTransform({a: scale, b: 0, c: 0, d: scale, e: 0, f: 0})` idiom [VERIFIED: app/src/lib/projectPaperRaster.ts — drawProjectPaperRaster] | Proven; scale≠1 only, keeps default hot path byte-identical (260923-bcm) |
| Encode for transport | Re-encode | record's memoized `encodeBytes` | Freeze happens after the pass automatically |

## Common Pitfalls

### Pitfall 1: pass lands on the fond instead of the paint
**What goes wrong:** paper background itself gets modulated; holes read as double-texture. **How to avoid:** apply to `result.raster` before `fondCtx.drawImage` (placement above). **Warning sign:** export vs canvas fond regions differ.

### Pitfall 2: grain-off (`''`) crashes or draws a blank tile
**What goes wrong:** CR-01 encoding is `paperGrain: fallback.paperGrain ? fallback.texture : ''` [VERIFIED: app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts:134]; a tile lookup on `''` must early-return, not fall back to canvas1. **How to avoid:** `if (!tile) return` guard; unit test the `''` path.

### Pitfall 3: strength change doesn't re-texture (control still inert)
**What goes wrong:** forgetting the metadata write-through leaves the tile cache stale. **How to avoid:** strength already flows `TopBarSegmented → onGrainStrengthChange → setGrainStrength → setRotoBackgroundMetadata` (via `buildRotoBackgroundMetadata`) — verify end-to-end with RED pin 1 rather than adding a new path. Note: `GRAIN_STRENGTH_OPTIONS = [{None,0},{Soft,0.35},{Med,0.65},{Hard,0.95}]` [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:44-49] are **segmented presets, not a stepper** — "wire as-is" means keep them; grain *scale* is the NumericStepper (`return value > 0.5 && value < 2 ? 0.5 : 0.1` [VERIFIED: PhysicsPaintTopBar.tsx:56-58]) governed by 260924-ffd.

### Pitfall 4: pixel loop sneaks into the frame path
**What goes wrong:** tile build uses `getImageData` — fine at build time; the same code invoked per frame is the HARD BLOCKER. **How to avoid:** build behind the tile cache; grep-verify no `getImageData`/`putImageData` between `_resolveFlattenedFrame` entry and record freeze on the hit path; RED pin 3.

### Pitfall 5: strength/scale baked into the fond signature but not the tile key
**What goes wrong:** memo rotates (recomposites) yet the tile cache returns the stale tile → silent no-op change. **How to avoid:** tile key must include exactly the signature's variable terms: paper id, WxH, grainScale, strength (tint if introduced). RED pin 2.

### Pitfall 6: vitest blindness
**What goes wrong:** `.test.tsx` not collected (`include: ['src/**/*.test.ts']`); Tauri/cross-webview GCO rendering unverifiable in jsdom-like env. **How to avoid:** `vitest run` for tile-cache/keying/guard logic; canvas-render claims need live UAT (memory: live evidence over unit probes).

## RED-first pins → test map

| Pin | Behavior | Test type | Command |
|-----|----------|-----------|---------|
| 1 | Full-opacity stroke shows paper holes | live UAT | manual (user) |
| 2 | Swap paper after bake → instant re-texture | unit (cache/memo) + live UAT | `pnpm vitest run src/lib/paperPass.test.ts` style + manual |
| 3 | No per-pixel JS loop in display frame path | unit (source/structure guard, like grainRemoval.test.ts) | `vitest run` |
| 4 | Export honors same pass | parity: exported file vs canvas capture | live UAT |

## Runtime State Inventory

Not applicable — no rename/migration; additive render pass only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | multiply/lighten GCO passes are GPU-composited on WKWebView at negligible cost for 1–2 drawImage calls | GCO recipe | Perf regression if CPU fallback; mitigated by RED pin 3 + live UAT (macOS WKWebView is the only target, so live UAT IS the falsification) `[ASSUMED]` |
| A2 | `result.raster`'s canvas is uniquely owned per composite (safe to mutate in place) | Placement | Cross-memo aliasing; check `compositeFrame` raster ownership at execution `[ASSUMED]` |
| A3 | Paper tint for the valley map can be derived from the texture's own tone (no separate tint input yet) | Tile encoding | May need a tint term in the fond signature later; CONTEXT lists "paper-tint inputs" as open discretion `[ASSUMED]` |
| A4 | Adding `conditionHeightMap` to package `index.ts` exports is acceptable (public surface growth) | Standard Stack | If rejected, app-side re-implementation must byte-match `[ASSUMED]` |

## Open Questions

1. **One tile (two channels) vs two tiles?** — discretion; two tiles matches CONTEXT's suggestion; one RGBA canvas with two `drawImage` source crops is equally valid. Decide at execution, both satisfy the budget.
2. **Does the Studio monitor (`includeFond=false`) show the pass?** — recommended yes (pass applies before the fond branch, so paint looks consistent); confirm during UAT that the CSS-blend paper layer beneath doesn't double-texture.
3. **Strength at build vs draw time** — recommend build (tile keyed on strength; strength is a 4-value preset set, rebuild is cheap). Draw-time strength would need a per-pass alpha/tint lerp — avoid unless a live strength slider (non-preset) arrives.

## Sources

### Primary (HIGH confidence)
- [VERIFIED] `app/src/stores/physicPaintStore.ts` — lines 1607–1620 (fond signature + rotation), 2521+/2600–2669 (flattened pipeline, fond block, record freeze), 2850 (`setRotoBackgroundMetadata`)
- [VERIFIED] `app/src/lib/projectPaperRaster.ts` — full file (texture cache, cacheKey, setTransform idiom)
- [VERIFIED] `packages/efx-physic-paint/src/core/paper.ts` — full file (`conditionHeightMap`, band quotes)
- [VERIFIED] `.planning/quick/260925-iy6-.../260925-iy6-CONTEXT.md` — locked decisions (verbatim above)
- [VERIFIED] `git show b8dcfcca^:.../brush/paint.ts` — deleted pre-9a emboss formula (read this session)
- [VERIFIED] `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — strength presets, grainScaleStep

### Secondary (MEDIUM confidence)
- [VERIFIED] `app/src/lib/previewRenderer.ts:659` — `if (frame.raster) return frame.raster;`
- [VERIFIED] `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts:134` — grain-off `''`

### Tertiary (LOW confidence)
- A1–A4 in Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all seams read directly
- Architecture: HIGH — placement + invalidation chain verified in source; GCO recipe is discretion with user-stated constraints
- Pitfalls: HIGH — each pitfall tied to a read file or a documented prior failure (9a dual-pipeline, CR-01, decode storms)

**Research date:** 2026-09-25
**Valid until:** 30 days (stable domain — Canvas 2D + in-repo seams)
