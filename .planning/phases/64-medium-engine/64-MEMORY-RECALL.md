# Memory Recall (MemPalace)

_Wing: efx_motion_editor · Mode: augment · Transport: mcp_

## Prior decisions

- **Phase 63 — brush library two-axis structure**: a *response* is the brush behaviour, a *tip* is the mask; the library is a sectioned 2-column grid, `BrushesDocker` is never revived (D-02), and one single-mapping law owns tip → engine — provenance: drawer `63-CONTEXT.md` (decisions), 2026-11-15.
- **Phase 63 — project-tip admission law**: `normalizeProjectBrushTip` is applied by both catalog producers, with built-in-id refusal and `category` pinned to `'custom'` — provenance: drawer `63-10-SUMMARY.md` (63-brush-tip-pipeline plan 10).
- **Undo snapshots must carry every new painted channel**: the transparency work had to add `strokeOpacity` to the undo snapshot explicitly, or an undo left stale values behind — provenance: drawer `05.2-RESEARCH.md`, 2026-07-05. Apply the same rule to Phase 64's thickness channel.
- **Deterministic replay is a first-class input**: Phase 61 persisted the render-mode tag into the stroke record because replay determinism is the acceptance bar, not a visual nicety — provenance: drawer `61-07-PLAN.md`, 2026-11-10.

## Patterns

- **Paper heightmap owns paper emboss; brush grain is additive, never a replacement** — the Phase 03 open-question ruling kept `paperHeight` for the emboss and layered brush grain on top. Phase 64's thickness emboss is a *third* thing (paint thickness), so it must not repurpose or displace the existing paper relief — provenance: drawer `03-RESEARCH.md` Open Question 3.
- **Snapshot-before-mutation around painted state**: undo captures a cloned before-image and restores by replay from real keys; raster bytes are not stored in undo entries — provenance: drawer `46-CONTEXT.md` (D-03), 2026-08-23.
- **Extend the canonical parameter mapping in ONE place**: `params.ts` `toEngineParams` is the single canonical ↔ vendor translation; every new global must enter there, not be read directly by the engine — provenance: project files named in `64-CONTEXT.md` (canonical refs).

## Surprises / gotchas

- **The Stam-solver legacy already parameterizes "viscosity"** as a *research* word for `DENSITY_K` and solver diffusion — Phase 64's `Viscosity` is a new, additive global that raises dissipation and suppresses spread. Do not conflate the two names — provenance: drawer `05.1-RESEARCH.md` "State of the Art" table.
- **`commitAquarelleSelectionParams` looks like the single-write path but is selection-only** (returns `null` with no selection). CONTEXT D-04 already supersedes spec 07's parenthetical; a medium switch must write the live params bag — provenance: drawer `63-*` summaries plus `64-CONTEXT.md` D-04.
- **No KG facts exist for this phase's vocabulary** (`Medium Engine`, `Aquarelle` both return zero) — the palace KG has no aliasing for the paint subsystem; rely on the drawers above and native `.planning/` artifacts.
