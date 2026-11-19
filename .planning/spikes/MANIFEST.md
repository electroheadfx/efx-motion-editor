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

### acrylic-bristle-deposit

Can the reference brush's per-bristle carrier and 5-nearest deposit be ported
into the real `efx-watercolor` engine without breaking Studio's replay model or
its budget — and what state/cost does wetness add? The contract is
`SPECS/v2.2.0-medium-engine/better-acrylic.md` plus the reverse-engineered
notes at `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md`; every
formula a follow-up plan cites must carry its notes section, and the
non-portable parts (the dual f16 buffers, the GPU compute passes) must be named
explicitly.

**Requirements:**

- The spike runs in a throwaway workbench (`.planning/spikes/002-acrylic-bristle-deposit/`); no production file changes.
- Reuse the real engine through `createAquarelleEngineAdapter` and the `probe/medium-engine` harness idiom; never the dev server.
- Return go/no-go per leg with measurements, not prose:
  1. deterministic replay — same script twice ⇒ byte-identical; if not, what state must enter the record;
  2. cost — the 5-nearest gather + per-bristle loop at 1080² and 2K, citing the 64-14/64-15 numbers;
  3. wetness — a last-touch signal from existing coverage, or a new channel with measured sheet memory + undo snapshot + frame-cache bytes.
- Every claimed formula quotes the notes' section number (§2, §3.1–§3.5, §4.1–§4.5, §5.1–§5.6, §6, §8, §9).
- State explicitly what is not portable (compute passes, dual f16 buffers, RGB smear, smudge/wipe/resample).
- Deliverable is a README with per-leg verdicts, the Studio touch points, and a proposed 64-21…64-24 slicing adjusted to what was measured.
- No commits to main and no push.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | opaque-acrylic-coverage | coverage-composite-acrylic | standard | Given a per-dab coverage term composited source-over in the pigment layer, when white 240 is painted over blue at Body 100/60/30 and red over blue for 50 strokes at 1080², then the underlayer is hidden at 100 and partly at 60 with no paper-white and no black drift, at lower per-stroke cost than the rev-4 punch path | VALIDATED ✓ — all three criteria pass; Body-0 byte-identical; 0 full-doc draws vs 3613; 4.1× median stroke. See `001-coverage-composite/VERDICT.md` | webgl2, watercolor, acrylic, coverage, performance |
| 002 | acrylic-bristle-deposit | acrylic-bristle-deposit | standard | Given the recorded stroke script and a pinned paper seed, when a per-bristle carrier and 5-nearest deposit are replayed twice, then the exported sheets and the bristle reservoirs are byte-identical; the deposit costs a stated bake/render delta at 1080² and 2K on the real engine; and a last-touch channel's sheet/undo/cache bytes are measured | VALIDATED ✓ — go on all three legs, each conditional: determinism holds when the paper seed is pinned (today it is not — the current engine already fails it), cost +26–29 % bake on the 50-stroke passage and +36–51 % on a 256-bristle acrylic brush, wetness needs an R32F pair at +26.1 MB / +67.1 MB (sheet + undo) and 0 B cached. See `002-acrylic-bristle-deposit/README.md` | webgl2, acrylic, bristles, pickup, determinism, performance |
