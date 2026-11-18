# Memory Recall (MemPalace)

_Wing: efx_motion_editor · Mode: augment · Transport: mcp · Refreshed: 2026-11-18 (gap-closure run)_

## Prior decisions

- **Phase 63 — brush library two-axis structure**: a *response* is the brush behaviour, a *tip* is the mask; the library is a sectioned 2-column grid, `BrushesDocker` is never revived (D-02), and one single-mapping law owns tip → engine — provenance: drawer `63-CONTEXT.md` (decisions), 2026-11-15.
- **Phase 63 — project-tip admission law**: `normalizeProjectBrushTip` is applied by both catalog producers, with built-in-id refusal and `category` pinned to `'custom'` — provenance: drawer `63-10-SUMMARY.md` (63-brush-tip-pipeline plan 10).
- **Undo snapshots must carry every new painted channel**: the transparency work had to add `strokeOpacity` to the undo snapshot explicitly, or an undo left stale values behind — provenance: drawer `05.2-RESEARCH.md`, 2026-07-05. Apply the same rule to Phase 64's thickness channel.
- **Deterministic replay is a first-class input**: Phase 61 persisted the render-mode tag into the stroke record because replay determinism is the acceptance bar, not a visual nicety — provenance: drawer `61-07-PLAN.md`, 2026-11-10.
- **One committed gesture = one ledger entry** is an established project-wide law, not a local choice: Phase 62 D-12 ("One committed gesture = one `aquarelle-script` ledger entry, through the shipped seam") — provenance: drawer `62-CONTEXT.md` (decisions), 2026-11-14. Phase 23 D-07/D-08 shipped the same shape for transforms as *snapshot-before / commit-on-release*, explicitly "one undo entry per gesture (not per pointer-move frame)" — provenance: drawers `23-CONTEXT.md`, `23-RESEARCH.md`, `23-01-PLAN.md`. CR-02 (light rows committing per pointermove) violates this standing law.
- **64-05 declared the light-in-revision backstop**: "The document revision includes the light, so a light change rotates the revision and every cache keyed on it misses; the sync fingerprint inherits the rotation." — provenance: drawer `64-05-PLAN.md`, 2026-11-17. CR-01 shows this claim does not hold at the roto frame cache, whose revision is built from the roto physical `contentRevision` plus a paper-only term.

## Patterns

- **Paper heightmap owns paper emboss; brush grain is additive, never a replacement** — the Phase 03 open-question ruling kept `paperHeight` for the emboss and layered brush grain on top. Phase 64's thickness emboss is a *third* thing (paint thickness), so it must not repurpose or displace the existing paper relief — provenance: drawer `03-RESEARCH.md` Open Question 3.
- **Snapshot-before-mutation around painted state**: undo captures a cloned before-image and restores by replay from real keys; raster bytes are not stored in undo entries — provenance: drawer `46-CONTEXT.md` (D-03), 2026-08-23.
- **Extend the canonical parameter mapping in ONE place**: `params.ts` `toEngineParams` is the single canonical ↔ vendor translation; every new global must enter there, not be read directly by the engine — provenance: project files named in `64-CONTEXT.md` (canonical refs).
- **Slider gesture boundary is a shipped seam**: `SliderStepper` already exposes `onChange` (continuous stream) and `onCommit` (exactly once per gesture — quick 261111-tul). Established callers pair them: `AquarelleGlobalsPanel` (`onGlobalChange` live write / `onGlobalCommit` one selection commit), `PhysicsPaintRightPanel`, `BrushResponsePanel`, `PhysicsPaintTopBar`. The light rows are the outlier — they pass `onChange` only — provenance: drawer `64-*` summaries plus the live source.

## Surprises / gotchas

- **The Stam-solver legacy already parameterizes "viscosity"** as a *research* word for `DENSITY_K` and solver diffusion — Phase 64's `Viscosity` is a new, additive global that raises dissipation and suppresses spread. Do not conflate the two names — provenance: drawer `05.1-RESEARCH.md` "State of the Art" table.
- **`commitAquarelleSelectionParams` looks like the single-write path but is selection-only** (returns `null` with no selection). CONTEXT D-04 already supersedes spec 07's parenthetical; a medium switch must write the live params bag — provenance: drawer `63-*` summaries plus `64-CONTEXT.md` D-04.
- **No KG facts exist for this phase's vocabulary** (`Medium Engine`, `Phase 64`, `Aquarelle` all return zero) — the palace KG has no aliasing for the paint subsystem; rely on the drawers above and native `.planning/` artifacts.
- **No palace drawer exists for Spike 001 / the coverage composite** (created 2026-11-18, not yet captured) — for this addendum the source of truth is `.planning/spikes/001-coverage-composite/VERDICT.md` plus the two-file workbench delta (`Engine.ts`, `shaders.ts`), not palace recall.
- **The undo-snapshot rule above applies directly to the new coverage channel**: the coverage target is a painted channel read by the display; if it is not captured in `WholeDoc` / `snapshotLayers()` / the history layer map, an undo will restore pigment while leaving stale coverage (the 05.2 `strokeOpacity` failure mode).
- **Scattering constants are declared once** — `S = SCATTERING_MAX (8) × bodyCurve(body) × amount`, `SCATTER_EPSILON = 1e-3`, `bodyCurve = clamp01^6` — provenance: drawer `64-08-PLAN.md`, 2026-11-17. The coverage/film coherence fix must not introduce a second curve or a second constant.
