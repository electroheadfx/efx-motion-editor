# Memory Recall (MemPalace)

_Wing: efx-motion-editor · Mode: augment · Transport: mcp_

## Prior decisions
- First-class `duplicate-key`/`paste-key` ordinary operations were added across shared types, the physical resolver, the coordinator, accepted-only history, and the parent bridge; resolver, coordinator, and bridge validate the same complete semantic delta and the bridge returns the exact accepted tuple/revision — drawer from `36.14-20-SUMMARY.md`, 2026-07-22. Group paste must extend this exact seam, not add a parallel route.
- Play Script cache publication regression fix: cache publication is an explicit non-history `replace-roto-physical-map` operation; progressive frames remain provisional, then one sorted complete physical map crosses the sole coordinator and parent bridge — problems drawer, 2026-07-24.
- Interpolation authority fix: the child defers its document update until exact parent acceptance; no local canonical mutation — problems drawer, 2026-07-24.
- Occupied-boundary drag semantics (36.14 D-29): source closure resolves A@1,B@3,C@5,D@8 → A@1,C@5,B@8,D@9 → A@1,C@5,D@8,B@9; relevant precedent for how occupied destinations are handled deliberately, not silently — problems drawer, 2026-07-24.

## Patterns
- Parent acknowledgement is authoritative for every durable timeline mutation; optimistic child state is always provisional with complete rollback on rejection.
- A single sorted complete physical map is the only thing that crosses the coordinator/bridge boundary — never incremental per-key patches.
- Native UAT approval precedes any regression-test work (recurring accepted delivery sequence across 36.14 / 36.15 / quick tasks).

## Surprises / gotchas
- Split-authority bugs (child mutating canonical state locally while the parent holds the real value) were the dominant recurring regression family in Phase 36.14 — the group paste intent must not introduce a second mutation path around the resolver/coordinator.
- Publishing through the wrong transaction path (`replace-roto-key-frames` vs `replace-roto-physical-map`) silently broke Play Script caches after the physical-frame cutover — downstream caches must derive from the accepted map only.
