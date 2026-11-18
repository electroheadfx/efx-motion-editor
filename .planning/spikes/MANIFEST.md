# Spike Manifest

## Ideas

### opaque-acrylic-coverage
Can the current `efx-watercolor` engine deliver opaque acrylic coverage **without** the Body erase/punch machinery? The shipped rev-4 law erases the underlayer along the brush footprint (settled `fixed`, wet `preInk`, and the app's cached base) and then deposits watercolor. This idea tests the alternative model: a per-dab **coverage** term composited source-over inside the pigment layer, so the underlayer is hidden by the new paint's opacity rather than punched away — no per-stroke base punch, no per-dab preview punch, no commit merge, no full-document `preInk` snapshot.

**Requirements:**

- The spike runs in a throwaway workspace (`.planning/spikes/001-coverage-composite/`); the main tree's paint/cache path is never modified.
- The approved rev-4 cover law is not redesigned in the main tree; the spike bypasses it in a copied engine.
- Reuse the existing probe/vitest harness (`node probe/run.mjs`, `npx vitest run`); never watch mode; never start the dev server.
- Measurable success criteria at 1080×1080:
  1. White 240 over saturated blue at Body 100 / 60 / 30: at 100 the underlayer disappears; at 60 it is partly visible; NO value produces paper-white.
  2. Red over blue, 50 rapid strokes: no drift toward black; hue within a stated tolerance.
  3. 50 rapid strokes: no per-stroke full-canvas punch/merge; report p95 stroke latency and memory against the current build.
- Deliverable is a verdict with numbers and go/no-go — no phase plan, no quick plan, no commits to main, no push.
- Prior context is read, not re-litigated: `.planning/debug/rev4-cover-erase-lost-paint.md` and `.planning/quick/261117-tq7-.../261117-tq7-SUMMARY.md`.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | opaque-acrylic-coverage | coverage-composite-acrylic | standard | Given a per-dab coverage term composited source-over in the pigment layer, when white 240 is painted over blue at Body 100/60/30 and red over blue for 50 strokes at 1080², then the underlayer is hidden at 100 and partly at 60 with no paper-white and no black drift, at lower per-stroke cost than the rev-4 punch path | VALIDATED ✓ — all three criteria pass; Body-0 byte-identical; 0 full-doc draws vs 3613; 4.1× median stroke. See `001-coverage-composite/VERDICT.md` | webgl2, watercolor, acrylic, coverage, performance |
