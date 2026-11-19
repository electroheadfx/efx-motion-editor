---
name: spike-findings-efx-motion-editor
description: Implementation blueprint from spike experiments in EFX Motion Editor (efx-watercolor medium engine). Requirements, proven shader laws, measured costs, determinism contracts, and the headless-Chrome measurement harness for acrylic coverage and per-bristle deposit. Auto-loaded during implementation work on the v2.2.0 medium engine / Phase 64.
---

<context>
## Project: efx-motion-editor

**opaque-acrylic-coverage** — Can the current `efx-watercolor` engine deliver
opaque acrylic coverage **without** the Body erase/punch machinery? The shipped
rev-4 law erases the underlayer along the brush footprint (settled `fixed`, wet
`preInk`, and the app's cached base) and then deposits watercolor. This idea
tests the alternative: a per-dab **coverage** term composited source-over inside
the pigment layer, so the underlayer is hidden by the new paint's opacity rather
than punched away — no per-stroke base punch, no per-dab preview punch, no
commit merge, no full-document `preInk` snapshot. Spike 001 answered **yes, on
the engine side**, and a separate engine is not warranted by the numbers.

**acrylic-bristle-deposit** — Can the reference brush's per-bristle carrier and
5-nearest deposit be ported into the real engine without breaking Studio's
replay model or its budget — and what state/cost does wetness add? The contract
is `SPECS/v2.2.0-medium-engine/better-acrylic.md` plus the reverse-engineered
notes at `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md`. Spike 002
answered **go on all three legs, each conditional**.

Spike sessions wrapped: 2026-11-19 (spikes 001, 002)
</context>

<requirements>
## Requirements

### opaque-acrylic-coverage

- The spike ran in a throwaway workspace; the main tree's paint/cache path was
  never modified. The approved rev-4 cover law is not redesigned as a side
  effect of another plan — it is replaced deliberately, or not at all.
- Prior context is read, not re-litigated: `.planning/debug/rev4-cover-erase-lost-paint.md`
  and the `261117-tq7` summary.
- Measurable success criteria at 1080×1080, carried into the build as pins:
  1. White 240 over saturated blue at Body 100 / 60 / 30 — hidden at 100, partly
     visible at 60, **no value produces paper-white**.
  2. Red over blue, 50 rapid strokes — no drift toward black; luma ratio ≥ 0.95,
     |Δhue| ≤ 3°.
  3. No per-stroke full-canvas punch/merge.
- Reuse the existing probe/vitest harness (`node probe/run.mjs`,
  `npx vitest run`); never watch mode; never start the dev server.

### acrylic-bristle-deposit

- No production file changes during the spike; reuse the real engine through
  `createAquarelleEngineAdapter` and the `probe/medium-engine` harness idiom.
- Go/no-go per leg understood as measurements, not prose:
  1. deterministic replay — same script twice ⇒ byte-identical; if not, what
     state must enter the record;
  2. cost at 1080² and 2K, citing the 64-14/64-15 numbers;
  3. wetness — a last-touch signal from existing coverage, or a new channel with
     measured sheet memory + undo snapshot + frame-cache bytes.
- Every claimed formula quotes the notes' section number (§2, §3.1–§3.5,
  §4.1–§4.5, §5.1–§5.6, §6, §8, §9).
- State explicitly what is not portable: compute passes, dual f16 buffers, RGB
  smear, smudge/wipe/resample.
- Deliverable is per-leg verdicts, the Studio touch points, and a slicing
  adjusted to what was measured (64-21…64-24).
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Coverage composite | references/coverage-composite.md | Per-dab coverage `a = bodyGain·(1 − exp(−8·amount·mask))` composited source-over gives true opaque acrylic; 4.1× median stroke, 0 full-document draws vs 3613, −17.8 MiB per-stroke transient. Body 0 stays byte-identical. |
| Acrylic bristle deposit | references/bristle-deposit.md | Deterministic per-bristle carrier + 5-nearest gather ports into WebGL2 selectively: +26–29 % bake on a 50-stroke passage, +36–51 % on a large acrylic brush. Determinism holds only with a pinned paper seed (a pre-existing record gap). Wetness needs its own R32F pair: +26.1 MB at 1080². |
| Measurement harness | references/measurement-harness.md | Real engine + real WebGL2 in headless Chrome, one engine per process, GL-boundary instrumentation, byte-identical neutrality control before believing any delta. p95 is not a cost signal on a stalling script. |

## Source Files

Original spike artifacts are preserved in `sources/`:

- `sources/001-coverage-composite/` — README, VERDICT (all number tables),
  `patches/Engine.diff` + `patches/shaders.diff` (the model against base
  `406d1ead1`), `probe/`, `results/` (12 gate JSONs). The 480 KB esbuild bundle
  is omitted as a build artifact.
- `sources/002-acrylic-bristle-deposit/` — README (formula table with § numbers,
  64-21…64-24 slicing, non-portable list), `src/bristles.ts`,
  `src/bristleShaders.ts`, `patches/Engine.diff` (against `406d1ead1`, **on top
  of** spike 001), `probe/`, `results/` (16 gate JSONs).

### Applying the patches

Both patches are against `406d1ead1` and are **read-as-law, not apply-blindly**:
`packages/efx-watercolor/src/playground/shaders.ts` has since gained 64-20's
coverage transport (`advectCoverFS`, `coverClearFS`, `FILM_PRESENCE`), which the
spike copies predate. Order matters: 001's coverage model first, then 002's
bristle workbench — 002's `Engine.ts` calls `coverageDeposit`.
</findings_index>

<metadata>
## Processed Spikes

- 001-coverage-composite (opaque-acrylic-coverage) — VALIDATED
- 002-acrylic-bristle-deposit (acrylic-bristle-deposit) — VALIDATED, three
  conditional legs
</metadata>
