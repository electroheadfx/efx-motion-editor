# Spike Wrap-Up Summary

**Date:** 2026-11-19
**Spikes processed:** 2
**Feature areas:** Coverage composite, Acrylic bristle deposit, Measurement harness
**Skill output:** `./.claude/skills/spike-findings-efx-motion-editor/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | coverage-composite-acrylic | standard | ✓ VALIDATED | Coverage composite |
| 002 | acrylic-bristle-deposit | standard | ✓ VALIDATED (3 conditional legs) | Acrylic bristle deposit |

Both ideas (`opaque-acrylic-coverage`, `acrylic-bristle-deposit`) were wrapped;
no unrelated idea is represented in this skill.

## Key Findings

**The punch machinery is not needed for opaque acrylic.** A per-dab coverage term,
`a = min(1, bodyCurve(Body)·2) · (1 − exp(−8 · amount · m))`, composited source-over
inside the pigment layer gives correct opaque paint without the `preInk` snapshot, the
per-dab ping-pong, or the app-level cached-base punch. All three acceptance criteria
pass; the current build fails two of them structurally (its layer alpha is derived from
darkness, so a near-white pigment's alpha is ~0.02 and can never cover). Measured at
1080²: 0 full-document draws vs 3613, 0 B transient vs +17.80 MiB per stroke, median
rapid stroke 5.8 ms vs 23.8 ms (4.1×), total bake −16 %. Body 0 is byte-identical, which
is the gate that makes the model safe to land incrementally.

**The bristle carrier ports selectively, and its cost is bounded.** Per-bristle
reservoirs (3 × `RGBA16F` at `1 × 256`) plus a 5-nearest gather cost +26–29 % bake on a
50-stroke watercolor passage and +36–51 % on a large acrylic brush, with no new
full-document pass. Determinism holds across two full replays at 256², 1080² and 2K —
but only with a pinned paper seed, and the product does not pin one today (the current
engine already fails replay equality without it). That is the one pre-existing record
gap the build must close first.

**Wetness cannot be derived from coverage.** Coverage has no time dimension; `wet ×
cover` is a usable proxy but measures water amount, not age. The honest channel is an
R32F last-touch pair at +26.1 MB (1080²) / +67.1 MB (2K) sheet + undo, +103 ms bake on
the 20-stroke acrylic passage, and 0 B frame cache (every frame starts dry).

**Methodological carry-overs.** Prove neutrality before believing a delta; compare
against the current build inside the same harness, never a remembered number; one engine
per page for timing (two engines at 2K degrade ~35 % under SwiftShader); p95 is an
alignment-sensitive number on a script with periodic sim stalls — the median and the
aggregate bake are the stable comparisons.
