---
phase: 261112-i6d-vector-enhancement-double-click-stroke-t
plan: roll-up
subsystem: ui
tags: [preact, signals, svg, vector-path, bezier, spline, pointer-gestures, ux]
status: complete
requirements: [QUICK-261112-I6D]
commits:
  - 8cdf97ecd
  - fcc01068e
  - a52d6221d
  - 4d2bfc7f0
  - 71a98a033
  - bc42217f8
  - 81a28767c
  - d0af8039b
  - 2f2231f52
  - 9d60b5a17
  - ae975a687
  - 34728c5e4
verification: passed
---

# Quick Task 261112-i6d — Vector edit enhancements

Four asks, delivered as three sequential plans on `gsd/phase-61-vector-painting-tool`.

## Plans

| Plan | Scope | Commits | Summary |
|------|-------|---------|---------|
| 01 | Double-click entry, Alt+click corner law, orange selection chrome | `8cdf97ecd`, `fcc01068e` | [261112-i6d-01-SUMMARY.md](./261112-i6d-01-SUMMARY.md) |
| 02 | Package width ceiling `ANCHOR_WIDTH_MAX` 2 → 20, every probe repointed | `a52d6221d`, `4d2bfc7f0` | [261112-i6d-02-SUMMARY.md](./261112-i6d-02-SUMMARY.md) |
| 03 | App ×10 slider track, free entry to ×20, unchanged-width no-op | `71a98a033`, `bc42217f8` | [261112-i6d-03-SUMMARY.md](./261112-i6d-03-SUMMARY.md) |

## What shipped

**1. Double-click enters the path edit.** `ScriptStrokeOverlay` gained an optional
`onStrokeDoubleClick`, bound conditionally so an absent callback leaves the DOM prop
literally `undefined`. `AquarelleStrokeOverlay` resolves the hit to a vector stroke and
calls the Edit-path icon's own `enterPathEdit` session — one action, not a parallel path.
Hand-painted strokes are inert.

**2. Alt+click breaks the tangent.** `breakAnchorTangent(anchors, index)` writes the one
straight-corner shape (`kind: 'bezier'`, both handles on the anchor) and identity-returns
when nothing changes. It sits after the handle branch and before `promoteAnchorForDrag`,
so no drag state is created and Alt on a handle still starts the existing handle drag.
The corner survives `resolveCurveAnchors` under Spline (the default mode). `isCornerAnchor`
is exported from the payload package so package and app share one predicate.

**3. Vertex size reaches ×10 and beyond.** `ANCHOR_WIDTH_MAX` is now **20** — the single
storage/evaluation ceiling, inherited by `clampAnchorWidth`, per-anchor factor reads,
`sampleVectorWidths`, `Engine.scriptWidthFactor` and the payload reopen guard.
`AQUARELLE_ANCHOR_WIDTH_SLIDER_MAX = 10` bounds the slider track only; typed free entry
reaches `anchorWidthPatchValue`, the one clamp that decides what lands in the document.
A stored value above the track maximum reads its true px product while the knob pins at
the track end. An unchanged clamped repeat no longer publishes a refusal banner — the
width sibling of the shipped CR-01 colour no-op.

**4. Selected vertex is legible over orange paint.** Three stacked strokes replace the
single thin ring: soft outer glow (8 px / 0.35), dark contrast halo (4 px / 0.85) and a
crisp orange `#f97316` ring (1.5 px), all `vectorEffect: non-scaling-stroke` so the chrome
is screen-constant at every zoom. The original `vector-path-anchor-selection` testid stays
on the crisp ring, so existing exact-count pins stay green.

## Gates

- Package: 305 passed, 8 skipped (pre-existing GPU-only) — `vitest run`
- App: `physic-paint` subtree 253 files / 6,447 tests passed
- Typecheck: `pnpm --prefix app run typecheck` green
- Plan checker: 2 blockers + 2 warnings found and resolved; final pass 0/0 with one advisory
- Verifier: 9/11 must-haves verified automatically at first pass (`human_needed`); the two
  human-gated truths passed live UAT on 2026-11-12
- Final `physic-paint` subtree after the follow-ups: 254 files / 6,474 tests passed

## Post-verification follow-ups (UAT-driven)

Three UAT rounds added behaviour on top of the verified plans:

- **Alt+click is a TOGGLE** (`toggleAnchorCorner`): a straight corner goes back to the
  derived-smooth round shape. One law for both curve modes; the corner shape lives in the
  payload package (`readAnchorCornerState` / `withAnchorCornerState`).
- **Geometry Corner row** (Round / Straight) in Stroke settings: a SETTER over the selected
  anchors, through the same path-edit commit.
- **Canvas veil for the re-bake**: a path edit replays the WHOLE script, so the engine's
  input lock was real but invisible. The veil is blocking, canvas-scoped (z 65, between the
  apply pill at 60 and the floating sheets at 70+), and is the re-bake latch itself — no
  timer, no effect. `runAquarelleScriptRebake` paints one host frame on entry and one on
  exit, and the spinner is compositor-promoted so it turns while the bake blocks the main
  thread. It carries the stroke counter; the apply pill stands down during a path edit, so
  one operation never shows two progress surfaces. The strip's "Rebuilding path…" line was
  removed as a third copy of the same story.

## Live UAT rows — PASSED (user-confirmed 2026-11-12)

1. Double-click a vector stroke opens the path edit exactly as the Edit-path icon does; hand-painted strokes stay inert
2. Alt+click in Spline mode makes a straight corner; undo is one step
3. Alt+click in Bézier mode splits the tangent; dragging one handle stops mirroring the other; already-corner vertex is a no-op; handle clicks take precedence
4. Orange ring with dark halo and glow stays legible over orange paint at 25 / 50 / 100 %
5. Vertex size track tops at ×10; typed 20 commits and reads `Size × 20 px` with the knob pinned at the end; typing 99 twice clamps to 20 with no refusal banner
6. A ×20 vertex survives save/reopen with no data-loss refusal, and bake/draw cost at ×20 stays acceptable

## Deviations recorded by executors

- Plan 01: the plan's "Spline default" fixture was factually Bézier (`curveMode` absent resolves to `bezier`; spline is only the draw default) — the Spline pin now passes `curveMode: 'spline'` explicitly. Rebuilt the gitignored package `dist` so app tests resolve `isCornerAnchor`. Cleared a leaking shared selection in the new describe's setup.
- Plan 02: none — executed as written.
- Plan 03: reworded a docblock that contained the literal token `allowOutOfRangeEntry`, which inflated an exact-count source pin. Rebuilt the stale gitignored `dist` so the app clamp read 20.
