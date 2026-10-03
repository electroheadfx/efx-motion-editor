---
status: complete
---

# Quick Task 261003-hpi — Erase contract (fresh = whole-stroke, dry = pixel eraser with force)

**Verdict: automated-ready** (native UAT pending — see rows below)

## What changed

| File | Change |
|---|---|
| `packages/efx-physic-paint/src/brush/erase.ts` | Dry-only pixel eraser: zero wet-buffer writes (W-P cell); linear force law `ERASE_FORCE_SCALE=2.7` replaces cubic strMul (D-P cell) |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | `liveErase` option on `StrokeApplicationOptions`; `removeWetIntersectedStrokes()` (W-S cell: detect wet targets → splice primary + zero-point continuations from `allActions` + `undoStack` → replay rebuild via `redrawAll`); blanket `forceDryAll('erase-final-force-dry')` **deleted** (W-P cell); force-0 skips detection entirely |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts` | Full truth table as executable cells (15 tests) |

## Truth table — results

| Cell | Result | Evidence |
|---|---|---|
| W-S force 100 | **GREEN** | Whole stroke removed (entry + deposit gone) |
| W-S force 50 | **GREEN** | Whole stroke removed |
| W-S force 0 | **GREEN** | Eraser inert (entry kept, wet unchanged) |
| W-P never-cell | **GREEN** | 0 mismatches outside removed footprint; non-crossed stroke stays wet |
| D-P force 100 → 1 pass | **GREEN** | 1 pass |
| D-P force 50 → ≤ 8 passes | **GREEN** | 6 passes (measured) |
| D-P force 25 → ≤ 21 passes | **GREEN** | 14 passes (measured) |
| D-P per-pass law | **GREEN** | removal ≥ force/100 at full coverage, strictly monotone 0/25/50/75/100 |
| D-P force 0 | **GREEN** | Zero removal |
| D-S never-cell | **GREEN** | Entry counts unchanged by pixel cell |
| R4 anti-alignment | **GREEN** | 2 mutationIds differ; erase-shape ≠ shape-detail stream; `erase.ts` has `'erase-shape'`, zero `Math.random()` |
| Frozen knobs | **GREEN** | DEPOSIT_KEEP_TIER=40, DEPOSIT_DENSITY_SCALE=4500, PAPER_ADSORPTION_GAMMA=0.5 |
| History coherence | **GREEN** | undo counts only present mutations; undo() doesn't crash or resurrect |

## RED evidence (pre-change)

8/15 failed at base: W-S (all 3 force levels), W-P (339 pixels mutated by blanket forceDryAll), D-P (force 50/25 pass-count + per-pass law — cubic strMul too weak), history coherence (mutationId 1 resurrectable). 7/15 passed (guard pins: D-S, R4×3, knobs, D-P force 100, D-P force 0).

## Green commands (verbatim)

```
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/engine/EfxPaintEngine.eraseContract.test.ts
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run
cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check
```

Full suite: **46 files, 375 passed, 3 skipped**. Typecheck clean.

## Guardrail scope proof

Changed files (quick-base `4a8111a7` → HEAD):
- `packages/efx-physic-paint/src/brush/erase.ts` ✓
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` ✓
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts` ✓

Guardrail diff **EMPTY** for: `compositor.ts`, `drying.ts`, `wet-layer.ts`, `types.ts`, `paint.ts`, `stroke.ts`, `footprintLanes.ts`, `spreadScale.ts`, `paper.ts`, `app/**`.

## Native UAT (pending)

- (a) One erase swipe over still-wet paint makes the whole stroke vanish at once — no ghosting — and it stays gone after save/reload.
- (b) On dry paint the eraser really erases: full force clears in one pass, 50 in a few passes, the force slider visibly changes speed — no more endless lightness.
- (c) A swipe never damages or prematurely dries neighboring strokes it did not cross; those fresh strokes still whole-stroke-erase on a later swipe.
- (d) The erased edge keeps the brush's torn texture that never lines up with the painted mark, and painting looks completely unchanged (deposit/paper look law frozen).
- (e) Undo stays coherent after an erase: no crashes, no resurrected strokes, counters honest.
