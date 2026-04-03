---
type: gap-report
phase: 05-library-demo-polish
created: 2026-04-01
status: open
---

# Physics Engine Gaps — v3 → Library Extraction

## Summary

The paint stroke rendering works correctly (shape, color, opacity, emboss). The physics
simulation (diffusion, drying, color mixing) diverged significantly from v3 during extraction
and subsequent fixes. These need a focused comparison against `cleaning/efx-paint-physic-v3.html`.

## Working (Verified)

- Stroke rendering pipeline: smooth → resample → ribbon → deformN → fillPolyGrain/fillFlat
- Opacity: post-multiply approach (render at full intensity, scale alpha after emboss)
- Paper emboss: applyPaperEmboss modifies both alpha AND color for 3D effect
- Save/Load with animated stroke replay (replayAnimated)
- Background switching with clearRect before redraw
- Erase tool, Undo, Clear

## Broken Physics Issues

### 1. DENSITY_K changed from 3.5 to 1.5
**File:** `paint-rebelle-new/src/types.ts:19`
**Why changed:** K=3.5 compressed Beer-Lambert curve so opacity slider had no effect (50% opacity showed 91% opaque).
**Impact:** K=1.5 gives good opacity response but weakens wet layer display during physics (diffusion looks faint).
**Fix approach:** Need separate K values for stroke display vs physics, OR find a single K that works for both, OR move opacity control out of Beer-Lambert entirely.

### 2. forceDryAll divisor changed from /800 to /DENSITY_NORM (3000)
**File:** `paint-rebelle-new/src/core/drying.ts:150`
**Why changed:** With uniform deposit (no grain gate), /800 clamped any opacity >27% to fully opaque.
**Impact:** Drying produces lighter results. dryStep still uses /800, creating inconsistency.
**Fix approach:** Either use consistent divisor everywhere, or compute sa from the intended opacity stored with the stroke.

### 3. Brush grain removed from transferToWetLayerClipped
**File:** `paint-rebelle-new/src/core/wet-layer.ts:279`
**Why changed:** brush_texture.png has 93% near-zero pixels, creating block artifacts when used as deposit gate.
**Impact:** Without grain-based sparsity, deposits are uniform. V3's watercolor stipple texture came from this sparsity.
**Fix approach:** Either use a better grain texture, or use paper height as a more nuanced deposit modulator, or generate a procedural grain pattern with appropriate statistics.

### 4. No color mixing at stroke overlaps
**Symptom:** Yellow over blue shows as flat yellow, no green mixing.
**Root cause:** The wet layer uses per-pixel alpha blending (lerp by blend ratio) which just replaces color at high deposit. V3 had the same issue but the sparse grain created partial overlap regions where colors blended visually.
**Fix approach:** Implement subtractive RYB color mixing in the deposit path (mixSubtractive from util/color.ts exists but isn't used in the wet layer).

### 5. Diffusion quality — no organic liquid spread
**Symptom:** Physics "Last"/"All" spreads paint in blocky patterns, not organic watercolor flow.
**Root cause:** The diffuseStep was extracted but may have parameter scaling issues. The interplay between displacement map, paper gradient, and wet alpha thresholds needs line-by-line comparison with v3.
**v3 reference:** `cleaning/efx-paint-physic-v3.html` lines 1828-1925 (diffuseStep), 1926-1940 (physicsStep)

### 6. Opacity post-multiply interaction with physics
**Current:** Layers render at full intensity, opacity applied via getImageData/putImageData alpha multiply.
**Issue:** savedWet stores the post-multiplied alpha. When physics restores savedWet to wet, the wet alpha is already reduced by opacity. Diffusion operates on these reduced values, producing weaker effects.
**Fix approach:** Store savedWet at full intensity (pre-opacity) and apply opacity only in the compositor.

## Key Files

- `paint-rebelle-new/src/types.ts` — DENSITY_K constant
- `paint-rebelle-new/src/core/wet-layer.ts` — transferToWetLayerClipped (deposit logic)
- `paint-rebelle-new/src/core/drying.ts` — dryStep (/800) and forceDryAll (/3000)
- `paint-rebelle-new/src/core/diffusion.ts` — diffuseStep, physicsStep
- `paint-rebelle-new/src/render/compositor.ts` — compositeWetLayer (Beer-Lambert display)
- `paint-rebelle-new/src/brush/paint.ts` — renderPaintStrokeSingleColor (post-multiply, emboss)
- `cleaning/efx-paint-physic-v3.html` — REFERENCE (working v3, do NOT modify)

## Brush Texture Analysis

`paint-rebelle-new/public/img/brush_texture.png` (512x512):
- 93.8% of red channel pixels are < 10 (near zero)
- Mean red value: 5.2/255
- Only 6.2% has actual brush marks
- When used as deposit multiplier: creates block artifacts (sparse non-zero regions form repeating 256x256 pattern)

## Debug Session History

All fixes applied during phase 05-04 verification:
1. Default color #000000 → #103c65
2. Paper names smooth/canvas/rough → canvas1/canvas2/canvas3
3. Toolbar initial state sync (useEffect on mount)
4. willReadFrequently on canvas contexts
5. Brush grain removed from deposit (block artifact fix)
6. Procedural FBM grain (attempted, too uniform)
7. Paper-height grain (attempted, too strong without embossStrength scaling)
8. Emboss color shift (darken valleys, lighten peaks) — KEPT
9. Opacity post-multiply (render full, scale alpha after) — KEPT
10. DENSITY_K 3.5→1.5 — KEPT but problematic for physics
11. forceDryAll /800→/3000 — KEPT but inconsistent with dryStep
12. Animated stroke replay on load — KEPT
13. Load keeps current background — KEPT
14. Checkerboard CSS for transparent mode — KEPT
15. clearRect/putImageData in clear() and setBgMode — KEPT
16. display:block on canvas (baseline gap fix) — KEPT
