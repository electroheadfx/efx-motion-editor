# Memory Recall (MemPalace)

_Wing: efx_motion_editor · Mode: augment · Transport: mcp · Refreshed: 2026-11-19 (acrylic bristle extension run)_

## Prior decisions

- **Phase 63 — brush library two-axis structure**: a *response* is the brush behaviour, a *tip* is the mask; the library is a sectioned 2-column grid, `BrushesDocker` is never revived (D-02), and one single-mapping law owns tip → engine — provenance: drawer `63-CONTEXT.md` (decisions), 2026-11-15.
- **Phase 63 — project-tip admission law**: `normalizeProjectBrushTip` is applied by both catalog producers, with built-in-id refusal and `category` pinned to `'custom'` — provenance: drawer `63-10-SUMMARY.md`.
- **Undo snapshots must carry every new painted channel**: the transparency work had to add `strokeOpacity` to the undo snapshot explicitly, or an undo left stale values behind — provenance: drawer `05.2-RESEARCH.md`, 2026-07-05. This is the exact rule the last-touch pair (D-24) inherits: if it is not in `WholeDoc` / `snapshotLayers()` / the history map / `captureWhole`+`uploadWhole`, undo and resize silently diverge.
- **Deterministic replay is a first-class input**: Phase 61 persisted the render-mode tag into the stroke record because replay determinism is the acceptance bar, not a visual nicety — provenance: drawer `61-07-PLAN.md`, 2026-11-10.
- **One committed gesture = one ledger entry** is an established project-wide law (Phase 62 D-12; Phase 23 D-07/D-08) — provenance: drawers `62-CONTEXT.md`, `23-CONTEXT.md`.
- **64-13 replaced the erase model with the coverage composite**: the cover draw's order is *attenuate, deposit, union the coverage*; `amount = min(1, bodyCurve(P.body) * COVER_GAIN)` and density = `COVER_MEDIUM_DENSITY * amount` — no pigment coefficient reaches either — provenance: drawer `64-13-SUMMARY.md`, 2026-11-18.
- **Never let coverage decay with the settle**: the cover keep factor is 1, or dried white paint loses its opacity — provenance: drawer closet `64-14-PLAN.md`, 2026-11-18.
- **64-14's pool-0 precedent is the template for the R32F last-touch pair**: relief and cover each joined the format list, `snapshotLayers()`, `travel`, `docTargets`, `captureWhole` and `uploadWhole` in the same pass, with their pinned test literals amended — provenance: drawer `64-14-PLAN.md`.

## Patterns

- **Paper heightmap owns paper emboss; brush grain is additive** — Phase 64's thickness emboss is a *third* thing and must not repurpose the existing paper relief — provenance: drawer `03-RESEARCH.md` Open Question 3.
- **Extend the canonical parameter mapping in ONE place**: `params.ts` `toEngineParams` is the single canonical ↔ vendor translation; every new global (`feather`, `pickup`, `refill`) must enter there — provenance: `64-CONTEXT.md` canonical refs.
- **Slider gesture boundary is a shipped seam**: `SliderStepper` exposes `onChange` (continuous) and `onCommit` (once per gesture, quick 261111-tul) — provenance: drawer `64-*` summaries plus live source.
- **Structural pin suites are amended, never deleted**: when a new pool-0 layer or capture path lands, the existing literal arrays (`relief.test.ts`, `scattering.test.ts`) are extended in the same task that changes the source — provenance: drawer `64-14-PLAN.md` (a) and (b). The bristle plans must follow the same rule for the last-touch layer and the reservoir targets.
- **Probe methodology is a contract**: one engine per page for cost gates; `bakeMs`/`renderMs` are *measured, never gated* (64-17); prove neutrality before believing a delta; median over p95 — provenance: drawers `64-17-SUMMARY.md`, spike 002 README.
- **Determinism gates compare images AND reservoirs** at 256²/1080²/2K, plus a negative control (`--salt`) and a paper-seed control — provenance: spike 002 README Leg 1.

## Surprises / gotchas

- **The Stam-solver legacy already parameterizes "viscosity"** as a *research* word for `DENSITY_K`; Phase 64's `Viscosity` is a different, additive global — provenance: drawer `05.1-RESEARCH.md`.
- **`commitAquarelleSelectionParams` is selection-only** (returns `null` with no selection); a medium switch must write the live params bag (D-04) — provenance: `64-CONTEXT.md` D-04.
- **The paper seed is not recorded today** — the engine rolls `paperSeed` from `Math.random()` and `setPaper()` never re-seeds it; the *current* engine already fails replay equality when unpinned (`det-paper-baseline`: `7d58f971` vs `c5594fba`). This is the one pre-existing record gap 64-21 must close before its determinism gate means anything — provenance: spike 002 README Leg 1 + `64-CONTEXT.md` Claude's Discretion.
- **The last-touch field is lost on resize in the workbench** because `captureWhole`/`uploadWhole` carry only ink, fixed, wet, relief and cover — the same failure mode 64-14 fixed for relief — provenance: spike 002 README Limitations.
- **The live-stroke pickup boundary is declared, not engineered (D-23)**: a live stroke paints on a clean sheet and merges over the committed WebP, so it cannot pick up paint committed to an earlier frame; only a re-bake sees the full underlayer — provenance: spike 002 README Limitations + D-23.
- **The cover mask is now a design decision, not a measured verdict**: the spike's Body-100 numbers used the raw footprint cover; D-21 chooses a bristle-modulated cover, so 675.5 ms (1080²) / 1.17 s (2K) are a reference point, not the acceptance bar — provenance: spike 002 Frontier measurement + D-21.
- **Scattering constants are declared once**: `S = SCATTERING_MAX (8) × bodyCurve(body) × amount`, `SCATTER_EPSILON = 1e-3`, `bodyCurve = clamp01^6` — a second curve or constant is a defect — provenance: drawer `64-08-PLAN.md`.
- **No KG facts exist for this phase's vocabulary** (`Medium Engine`, `Phase 64` return zero) — rely on drawers and native artifacts.
- **Planning artifacts are stale relative to today's CONTEXT**: `64-PATTERNS.md` and `64-VALIDATION.md` predate the bristle extension. PATTERNS.md is regenerated this run; VALIDATION.md is not regenerated because Nyquist is skipped (research disabled, no RESEARCH.md).
