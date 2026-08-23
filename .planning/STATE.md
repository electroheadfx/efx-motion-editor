---
gsd_state_version: 1.0
milestone: v1.0.0
milestone_name: EFX Paint Multi-Track Frames and Reveal
current_phase: 45
current_phase_name: New EFX Paint Document and Clean Cutover
status: executing
stopped_at: Completed 45-03-PLAN.md
last_updated: "2026-08-23T14:18:17.437Z"
last_activity: 2026-08-23
last_activity_desc: Phase 45 plan 02 (Rust+TS serde co-change, cache re-point) complete
state_head: 36d055ada5088f72bb0d989f119e63e289e5bf57
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 8
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-23 after v1.0.0 milestone start)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 45 — New EFX Paint Document and Clean Cutover

## Current Position

Phase: 45 (New EFX Paint Document and Clean Cutover) — EXECUTING
Plan: 3 of 8
Status: Ready to execute
Last activity: 2026-08-23 — Phase 45 plan 02 complete

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 100 for v0.9.0 (12 phases, shipped 2026-08-21)
- Average duration: N/A
- Total execution time: N/A

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 45. New EFX Paint Document and Clean Cutover | 2 | TBD | - |
| 46. Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches | 0 | TBD | - |
| 47. Internal Multi-track Timeline, Filmstrip Capsules, and Controls | 0 | TBD | - |
| 48. Internal Compositor and Flattened Parent Result | 0 | TBD | - |
| 49. Fixed Background Track and Imported Loop Clips | 0 | TBD | - |
| 50. Photo/Reference Track | 0 | TBD | - |
| 51. Read-only Audio Preview | 0 | TBD | - |
| 52. Shared Mask Compositor and Reveal | 0 | TBD | - |
| 53. Integrated v1.0.0 Acceptance | 0 | TBD | - |

**Recent Trend:**

- N/A (new milestone)

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 45 P01 | 135 | 3 tasks | 6 files |
| Phase 45 P02 | 110 | 3 tasks | 6 files |
| Phase 45 P03 | 5 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.0.0 is a clean format break: pre-v1.0 Paint projects are discarded/unsupported; no migration or compatibility shim; legacy data fails explicitly.
- Architectural invariant locked: one parent Paint layer → one EFX Paint document → many internal Paint frame tracks → one flattened frame result delivered to the unchanged main-editor compositor.
- Multi-track means internal Paint frame tracks inside one opened EFX Paint document; no `Sequence.frameTracks`, no main-editor rows for internal tracks, no direct main-renderer iteration over internal tracks.
- All internal tracks share the parent application-frame axis and never change main-editor sequence duration.
- Hold and Background loops share linked source-frame references, modulo resolution, finite repeat from 1, and infinity without duplicating durable images.
- One fixed Background track sits beneath all Paint tracks with non-overlapping imported still/sequence Loop Clips; gaps reveal solid/transparent document fallback.
- One photo/reference track supplies painting reference and Reveal source but is excluded from ordinary flattened output.
- Main-editor audio is available only as read-only synchronized monitoring during EFX Paint playback.
- Internal track opacity/blend applied once inside EFX Paint; parent opacity/blend applied once by the main editor (never double-applied).
- Reveal uses photo source plus internal Paint coverage through one shared mask compositor.
- [Phase 45]: EfxPaintDocument is the v1.0 identity root: one versioned document per parent layer, stable UUID track IDs, one default Paint track, one fixed Background track with transparent fallback (D-08); shared canonical encoder extracted to efxPaintCanonicalEncoder.ts and re-pointed from the roto physical model
- [Phase 45 P02]: efx_paint_documents lands in BOTH models/project.rs and types/project.ts in the same commit (F1 co-change, proven by Rust round-trip test); physic_paint_outputs demoted to an opaque Vec<serde_json::Value> presence carrier (D-02/D-06); legacy Rust output structs deleted (DOC-04); create_project_dir creates cache/efx-paint and never cache/physic-paint, legacy dirs byte-untouched (D-04); native cache transaction service re-pointed to cache/efx-paint with .efx-paint-staging- prefix, command surface unchanged (T-45-06)
- [Phase 45]: The rejection gate is a pure scan over raw parsed .mce JSON: no filesystem, no IPC, no mutation, no throwing on unexpected shapes; fixed precedence outputs → cache-reference → documentless-layer, first match only, reasons terminal (D-07) — Pitfall F2 closed by structure discrimination: a 'physic-paint' layer is a trigger only when the top-level efx_paint_documents map has no entry for its layer id (source.layer_id, falling back to layer.id)

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags for planning: exact `.mce` v1.0 schema field-level design (Phase 45), opacity/blend application order + full pixel acceptance matrix enumeration (Phase 48), Reveal result track semantics (Phase 52), track-aware `paintVersion` reactivity model (Phase 46).
- v0.9.0 audit-accepted tech debt and deferred items carried forward (see Deferred Items below).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Persistence | DF-01: `.mce` save and fixed-path Physics Paint cache publication are not one cross-resource transaction | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Persistence | DF-02: native cache publication does not sync the containing directory after rename/exchange | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Loop Clips | DF-03: provenance-only Loop Clip replacement can be treated as a no-op | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Security | DF-04: browser frame-sync does not authenticate `postMessage` origin, source window, or launch identity | Non-blocking for Phase 43.1 | Phase 43.1 closure, 2026-08-10 |
| macOS distribution | Developer ID signing, notarization, stapling, and Gatekeeper validation | Preparation complete in quick 260730-mn0; credentialed release scheduled for v1.0.0 Phase 53 | v0.8.0 closure |
| Architecture | Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path | Excluded | v0.7.0 failure post-mortem |

## Session Continuity

Last session: 2026-08-23T14:18:17.424Z
Stopped at: Completed 45-03-PLAN.md
Resume file: None
