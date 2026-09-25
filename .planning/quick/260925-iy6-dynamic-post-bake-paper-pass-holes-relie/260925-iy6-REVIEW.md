---
phase: 260925-iy6
reviewed: 2026-09-25T16:47:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/lib/paperPass.test.ts
  - app/src/lib/paperPass.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/viteBuild.test.ts
  - app/vite.config.ts
  - packages/efx-physic-paint/src/index.ts
findings:
  critical: 1
  warning: 2
  info: 5
  total: 8
status: issues_found
---

# Phase 260925-iy6: Code Review Report

**Reviewed:** 2026-09-25T16:47:00Z
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Adversarial review of the dynamic post-bake paper pass (tile builder + shared
apply routine + the single `_resolveFlattenedFrame` seam), its structural guard
tests, and the chunk-budget raise. Most of the stated laws hold under
verification: exactly ONE `applyPaperPass` call site (store:2637, between
`compositeFrame` and the fond draw), no pixel-array API in the store or in the
apply routine, no `destination-out`, valley floor derived from the paper tint,
tile cache bounded on entry count (12) and bytes (64MB) with oldest-first
eviction, texture decode-once reused for the build probe, CR-01 gate returns
before touching any context, export/preview both consume the same
`_resolveFlattenedFrame` record, grain presets and the segmented control
untouched, no resurrected `fillPolyGrain`/`applyPaperEmboss`/`ensureHeightMap`.

The one critical finding is in the apply routine's blend math: `multiply` /
`lighten` over a **partial-alpha backdrop** paints tile color into
semi-transparent pixels (spec preparation term `(1 − αb) · Cs`), and the
`destination-in` step restores alpha but not color — so any semi-transparent
content (track opacity < 1, antialiased edges) renders washed toward the paper
tint at roughly α² effective strength. The bundled test harness has no pixel
math, so op-order pins cannot catch this.

**Chunk-budget verdict (1355 → 1370): legitimate measured raise, no evidence of
an accidental large import.** The raise follows the repo's documented
measured-raise convention (measurement note in both `vite.config.ts` and
`viteBuild.test.ts`, plus a dedicated record commit `3bac0eca`). The only new
main-chunk import edge is `paperPass.ts` → `conditionHeightMap` from the
package barrel; `core/paper.ts` already ships in the main chunk (Sep-19 dist
predating iy6 contains `loadPaperTexture`), the engine stays in the
PhysicsPaintStudio lazy chunk (773 kB, separate), and the claimed delta is
consistent with a ~250-line local module. Caveat: the on-disk `app/dist` is
stale (Sep-19), so the exact 1,355.02 kB figure could not be independently
re-measured here.

## Critical Issues

### CR-01: `applyPaperPass` washes out semi-transparent paint (blend prep contaminates partial-alpha pixels; effective opacity ≈ α²)

**File:** `app/src/lib/paperPass.ts:230-249` (steps at 232, 237, 242), call
site `app/src/stores/physicPaintStore.ts:2637`
**Issue:** Per the W3C compositing spec, a blend-mode draw with source alpha 1
over a backdrop of alpha `αb` yields color
`(1 − αb) · Cs + αb · B(Cb, Cs)` and alpha 1. Tracing the routine on a
semi-transparent paint pixel (color Cb, alpha a):

1. capture → (Cb, a)
2. `multiply` valley V → color `= (1−a)·V + a·Cb·V`, alpha 1
   — the `(1−a)·V` term is tile color painted where the backdrop was NOT
   opaque; correct modulation would be exactly `Cb·V`
3. `lighten` peak → same preparation class, smaller magnitude
4. `destination-in` original → alpha restored to `a`, **color unchanged** —
   the contamination is baked in
5. `copy` writeback

Final displayed result over the fond F (with V ≈ paper tone ≈ F):
`F·(1 − a²) + a²·Cb·V` instead of the intended `F·(1 − a) + a·Cb·V` —
i.e. the pass renders semi-transparent content at effective opacity **a²**.
`compositeFrame` draws every track with `ctx.globalAlpha = track.opacity`
(`efxPaintCompositor.ts:290`), so track opacity 0.5 reads as ≈0.25 with the
pass on, opacity 0.3 as ≈0.09; antialiased stroke edges on every stroke take
the same hit. This directly contradicts PIN 0 ("never scale
depositAlpha / strokeOpacity / body coverage") in spirit and effect — the pass
scales perceived coverage of all partial-alpha pixels. Opaque paint (a = 1)
is exact, which is why the routine looks correct in the common case. The
`paperPass.test.ts` harness fakes carry no pixel math (op-log only), so no
current test can observe this.

**Fix:** Keep alpha untouched through the blend steps and make the blend see an
opaque backdrop whose color is the paint's own. Concretely, pin the intended
behavior first with a truth table over a ∈ {0, 0.5, 1} × valley/peak values
(color AND alpha assertions — extend the harness to compute the spec formula,
or verify live per the "live evidence over unit probes" rule), then pick a
sequence that satisfies it. Candidate directions: (a) flatten alpha to 1
without changing color before `multiply` and restore after (requires a
transform that raises alpha while preserving straight color — verify whether a
compositing-only sequence exists; if not, the honest options are a masked draw
that limits modulation to fully-opaque regions, or documenting that the pass
does not support partial-alpha content); (b) reject/normalize at the seam:
apply the pass to an opaque-only mask. Do not "fix" it by touching track
opacity, depositAlpha, or strokeOpacity (PIN 0).

```ts
// Test pin to add alongside the fix (spec-formula oracle):
// for a in [0, 0.5, 1]: applyPaperPass must satisfy
//   alpha_out === a
//   color_out === color_in * valley   (per channel, straight alpha)
// today it yields color_out === (1-a)*valley + a*color_in*valley → FAIL for a<1
```

## Warnings

### WR-01: `getPaperPassTile` / `encodePassTiles` trust `strength` with no clamp — the never-black floor law depends on an external validator the store setter does not invoke

**File:** `app/src/lib/paperPass.ts:75-99, 131`
**Issue:** `grainScale` is normalized (`normalizeGrainScale`, with a hostile-
input comment), but `strength` is not. `encodePassTiles` computes
`valley = round(255 − v·(255 − tint))` with `v ≤ 0.8·strength`; for
strength > ~1.25 the value goes negative and `Uint8ClampedArray` clamps it to
**0 = black** — exactly the locked rejection ("valley floor is the paper's own
tint, never black"). The document validator does bound `grainStrength` to
[0, 1] (`types/physicPaint.ts:2387-2390`), but
`physicPaintStore.setRotoBackgroundMetadata` (store:2878-2902) stores whatever
metadata object it is handed with **no validation call**, and in-memory
callers (script library, Studio settings sync) feed it directly. Any path that
delivers an out-of-range value silently breaks the locked hole-color law.

**Fix:** Clamp at the entry, mirroring the grain-scale guard:

```ts
// paperPass.ts getPaperPassTile, after the strength gate:
const s = Number.isFinite(strength) ? Math.min(strength, 1) : 0;
if (!(s > 0)) return null;
// ...use s in the cache key and encodePassTiles
```

### WR-02: Gate keys on `paperGrain`, probe keys on `background` — White paper + grain on silently never gets the pass

**File:** `app/src/stores/physicPaintStore.ts:2625-2631` +
`app/src/lib/paperPass.ts:132-133`
**Issue:** The gate enables the pass when `metadata.paperGrain` is truthy and
`grainStrength > 0`, but the probe texture is `metadata.background`.
`'white'` is a selectable background (`PhysicsPaintTopBar.tsx:32`) and is NOT
in `PAPER_TEXTURE_URLS`, so `getProjectPaperTextureImage('white')` returns
null forever → the pass is deterministically skipped while the fond still
draws its black-dot grain (rotoFrameDraw:130-131). The user explicitly picked
a grain texture (PAPER_GRAIN_OPTIONS are independent of the background), yet
gets no tooth on the paint. Symmetrically, when `background !== paperGrain`
(e.g. Paper 1 background + Paper 3 grain), the modulation derives from the
fond paper rather than the selected grain texture — verify which control is
the source of truth. Deterministic skip (no crash), so not a blocker, but a
supported configuration silently does nothing.

**Fix:** Probe `passSource.metadata.paperGrain` (the grain texture the user
chose — always a `canvasN` key that resolves) instead of `background`, or, if
White-is-toothless is the intent, document it and gate on
`background`-resolvability so the skip is explicit rather than incidental.

## Info

### IN-01: Tile-cache byte budget excludes the build-time transient (~3× the final footprint)

**File:** `app/src/lib/paperPass.ts:139-193`
**Issue:** `evictOverBounds` accounts for the two final canvases
(`w·h·8`), but a single build simultaneously holds the probe canvas, the
`getImageData` buffer, the `Float32Array` raw map, and the valley/peak maps —
≈ `w·h·20` transient on top of `w·h·8` resident (≈130 MB transient at the
2560² test size, ~200 MB at 4K). One-time per key, in a WKWebView with
documented OOM history.
**Fix:** Consider chunked probe/encode (tile the build in strips) if frame
sizes above HD become common; at minimum note the transient in the budget
comment.

### IN-02: Main-chunk code imports the package barrel without a `sideEffects` flag, and no test pins the engine's ABSENCE from the main chunk

**File:** `app/src/lib/paperPass.ts:1`, `packages/efx-physic-paint/package.json`
**Issue:** `import { conditionHeightMap } from '@efxlab/efx-physic-paint'`
pulls the index that also re-exports `EfxPaintEngine`. Rollup currently
tree-shakes it (Sep-19 dist evidence: core/paper already in main, engine in
the 773 kB Studio chunk), but `package.json` has no `sideEffects: false`, and
`viteBuild.test.ts:170-179` only pins that the Studio chunk EXISTS — never
that the engine is absent from main. A future side-effectful module in the
index would silently duplicate the engine into main without failing any test.
**Fix:** Import from a narrow subpath (or add `sideEffects: false`), and add a
negative assertion (e.g. main chunk must not contain a stable engine marker).

### IN-03: `vite.config.ts` budget preamble still cites "1120" as the monitored budget

**File:** `app/vite.config.ts:187-189`
**Issue:** The standing comment ("1120 is a monitored desktop entry-bundle
budget… must not be raised again without measurement") was never updated
through eleven raises; the actual budget is now 1370. Misleads the next
reader into thinking the lock is 1120.
**Fix:** Reference "the budget below (see measurement trail)" instead of a
hard-coded stale number.

### IN-04: `encodePassTiles` names its `Float32Array` height field `height` alongside `heightPx`

**File:** `app/src/lib/paperPass.ts:75-81`
**Issue:** `height: Float32Array` (the conditioned field) vs `heightPx:
number` — a reader (or a future edit) can easily swap them; the call at :188
is correct today.
**Fix:** Rename the first parameter `heightField`.

### IN-05: `resetProjectPaperRasterForTests` does not clear `paperPass.ts`'s `tileCache`

**File:** `app/src/lib/projectPaperRaster.ts:170-175` /
`app/src/lib/paperPass.ts:41`
**Issue:** The documented test-only deep reset clears the texture/raster
caches but not the pass tile cache, which is module-level in a different
file. The current tests happen to use disjoint keys, so nothing is red today,
but a future test reusing a key with different fake pixel data would observe a
stale tile (false pass/fail).
**Fix:** Export a `resetPaperPassTileCacheForTests()` and call it from the
same `afterEach`, or move the tile cache reset into the existing reset.

---

_Reviewed: 2026-09-25T16:47:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
