# Phase 64 — Contract Amendments (2026-11-22)

The pipeline was looping on the same verification diffs because the acceptance text
(`REQUIREMENTS.md` + the plans' `must_haves`) was frozen at planning time, while the shipped
law moved under it in four post-UAT quicks. This file records each amendment so the text now
describes what ships. **No engine behaviour changed in this pass.** Every edit carries an
inline `*(Amended 2026-11-22: …)*` note in the source it amends.

| # | Amended | Was | Now | Authority |
|---|---------|-----|-----|-----------|
| 1 | MED-09, 64-02 truth 3 | "exactly the ten medium keys" | fourteen medium keys over the sixteen-key canonical set (`size` and `lift` excluded) | 64-22 added `feather`, `pickup`, `refill`, `wetSeconds` |
| 2 | MED-19, 64-06 truth 1, ROADMAP SC5 | `Body` exposed as a globals row | bag-only, Reset-only, **no row** | quick `261121-mtu` — "body has no row anywhere"; the artist's ruling |
| 3 | 64-04 truth 5 | Emboss row on the full 0..100 band | row kept, slider capped at 15 | post-UAT cap, `EMBOSS_MAX = 15` |
| 4 | MED-21, 64-22 truth 3, ROADMAP SC5 | Body erode runs for every response | non-bristle responses keep the D-21 erode; the bristle path attenuates ink+fixed by `(1 − a)` inside `bristleInk`, independent of `Body` | quicks `261119-pod`, `261121-umu` |
| 5 | 64-22 truth 4 | flat thirteen-row law; `softness = 0.09 + 0.25·feather` | tool/medium-context groups; dead rows hidden; Feather four-sided at constant `BRISTLE_SOFTNESS` 0.09 | quicks `261121-mtu`, `261119-pod` |
| 6 | 64-15 truth 3 | `isFullyOpaqueRaster(coverage)` guard | `readCoverage` null + transparent-scratch + fail-open guard, now also a source-dimension check | 64-25 (CR-04) + `95220123f` (WR-02) |
| 7 | 64-23 truth 5 | Feather-100 edge width must exceed Feather-0 | both widths are recorded evidence; the relation claims are non-zero variation + width below half-width | `261119-pod` made the softness contribution constant |
| 8 | MED-25, MED-32 | no new render target/pass at all | no target/pass **for `Body`/`S`**; the bristle carrier's 2×RGBA16F smear pair and the last-touch pair exist | `261119-pod` delivery law |
| 9 | MED-18, MED-38, ROADMAP SC7 | "export matches the screen" unqualified | parity measured against the 2026-11-21 darkness-only derivation, visible alpha = 1 − min(RGB); the coverage raster is an instrument, not an export channel | 64-25 alpha-law statement |

## Still open — not closable by text

| Item | Why it is not a text fix |
|------|--------------------------|
| 12 of 15 committed probe gates red | The invariants measure an alpha the pigment export no longer carries, and several digests predate the amended law. Needs the invariants re-specified on the coverage raster (`exportCanvas('coverage')`) **and** baselines re-captured from verified deterministic pairs. |
| 4 bristle-body gates + white-over-blue / red-over-blue-50 / cover-* | Same: re-capture on the final engine, then author the baselines from the verified captures. |
| Body on the bristle path | A **product decision**, not an implementation gap: either keep the shipped Body-independent dab law (text above) or restore a Body-modulated erode pass. Deliberately not decided here. |
| 14 UAT rows (10 pending, 4 failed) | Human judgement only. |
| 64-03 truths 8/11, 64-04 truth 6 | Present-but-behaviour-unverified (cancellation, replay rebuild, no-shimmer) — routed to human verification. |

## Probe prose left stale on purpose

`run.mjs` and `compare.mjs` still describe the mode-4 export alpha as `max(1 − min(rgb), cover)`.
Correcting that prose without correcting the invariants would leave the comments disagreeing
with the code, so both move together in the probe pass above.
