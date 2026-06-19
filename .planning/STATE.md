---
gsd_state_version: 1.0
milestone: v0.8.0
milestone_name: Standalone Physics Paint
current_phase: 36.3
current_phase_name: Physics Paint Roto Durable Core Recovery
status: planned_recovery
stopped_at: Phase 36.3 context gathered
last_updated: "2026-06-19T07:59:06.729Z"
last_activity: 2026-06-19
last_activity_desc: failed history preserved on backup/broken-36.2-gap-execution-20260618; 36.2-11 through 36.2-13 closed as rejected/superseded summaries
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 43
  completed_plans: 43
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Recovery planning after Phase 36.2 failed/superseded closure

## Current Position

Phase: 36.3 (Physics Paint Roto Durable Core Recovery) — PLANNED RECOVERY
Previous phase: 36.2 — FAILED/SUPERSEDED administrative closure
Plan: create or plan the new MVP/TDD recovery phase
Status: Do not execute Phase 36.2. Create or plan Phase 36.3 from current main.
Last activity: 2026-06-19 — failed history preserved on backup/broken-36.2-gap-execution-20260618; 36.2-11 through 36.2-13 closed as rejected/superseded summaries
Next recommended action: `/gsd-mvp-phase 36.3` or `/gsd-plan-phase 36.3` for Physics Paint Roto Durable Core Recovery

Progress: [██████████] 43/43 Phase 36.2 plan records closed administratively; Phase 36.2 outcome is failed/superseded, not complete

## Performance Metrics

**Velocity:**

- Total plans completed: 30 for v0.8.0
- Average duration: N/A
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 34. Standalone Demo Shell | 0 | TBD | - |
| 35. Interactive Physics Paint Controls | 0 | TBD | - |
| 36. Session Persistence and Output Proof | 0 | TBD | - |
| 37. Future Integration Contract and Validation | 0 | TBD | - |
| 34 | 3 | - | - |
| 35 | 7 | - | - |
| 36.1 | 9 | - | - |

**Recent Trend:**

- Last 5 plans: N/A
- Trend: N/A

*Updated after each plan completion*
| Phase 36.2 P09 | 7min | 3 tasks | 5 files |
| Phase 36.2 P08 | 7min | 3 tasks | 5 files |
| Phase 36.2 P07 | 5min | 3 tasks | 4 files |
| Phase 36 P06 | 392 | 2 tasks | 3 files |
| Phase 36 P09 | 6min | 2 tasks | 2 files |
| Phase 36.2 P02 | 5580 | 3 tasks | 6 files |
| Phase 36.2 P04 | 21min | 2 tasks | 4 files |
| Phase 36.2 P03 | 2h | 2 tasks | 3 files |
| Phase 36.2 P10 | 8min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v0.8.0: efx-physic-paint must be proven as a standalone interactive physics paint app/window before editor integration.
- v0.8.0: Physics paint is an additional tool; it does not replace perfect-freehand basic paint or p5.brush FX paint.
- v0.8.0: Failed headless adapter/batch replay remains excluded; future integration seam is typed/contract-only in this milestone.
- [Phase 36]: Workflow strip owns a physics-paint-specific compact lane model rather than importing or cloning the main EFX Motion timeline. — Followed D-09 and keeps the bottom timeline separate from the main editor timeline implementation.
- [Phase 36]: Play lane click handling remains inspection-only; conversion and clearing are explicit button/dialog flows. — Mitigates timeline-click tampering by keeping destructive callbacks behind explicit confirmations.
- [Phase 36]: Roto onion overlays use local Roto snapshots and persisted Roto output only, excluding latest Play frames from normal post-save overlay rendering.
- [Phase 36.2]: Plan 02 keeps Roto dirty/current state orthogonal to gray/green/pink semantic fills; missing main EFX Motion cache preview/marker propagation is carried to Plans 36.2-03/04.
- [Phase 36.2 Plan 04]: Generated-only Roto cache frames are launch redirects, not editable targets; standalone launch opens the nearest real key when metadata is available.
- [Phase 36.2 Plan 04]: Missing Roto frames are resolved virtually in PreviewRenderer, preserving transparent/background-only playback without writing cache metadata.
- [Phase 36.2]: Plan 03: Dirty Roto frames flush only at explicit lifecycle boundaries: frame leave, Save pending/current, and close/unload. — Prevents repeated apply traffic during brush movement while preserving cache durability.
- [Phase 36.2]: Plan 03: Cached-only Roto PNGs are repaintable visual references, not editable stroke state, and are cleared before exported replacement frames are generated. — Prevents old cache compositing into replacement Roto output.
- [Phase 36.2]: Plan 03: Navigation is blocked while a Roto flush/apply is in flight to preserve operation ordering and avoid duplicate frame-sync races. — Preserves bridge operation matching across save-on-leave boundaries.
- [Phase 36.2 Plan 07]: Roto close requests are prevented once, flushed through the existing apply-canvas path, then resumed via the Tauri window close API.
- [Phase 36.2 Plan 07]: Editable-session pink cells are driven only by real editable stroke content in the open session; cached/background-only occupancy remains separate.
- [Phase 36.2 Plan 07]: Cached Roto references stay full opacity and use outline treatment for reference status so old cache pixels are not visually diminished.
- [Phase 36.2 Plan 08]: Roto interpolation controls live inline in the standalone workflow strip, not in a modal or hidden shortcut path, so UAT can discover and change settings visually.
- [Phase 36.2 Plan 08]: Generated interpolation frames remain render-only cached frames surfaced by connector/status UI; real-key cells remain the only editable targets.
- [Phase 36.2 Plan 09]: Roto key utility controls are inline in the standalone workflow strip; generated interpolation frames stay render-only and Paste is replace-style on real keys only.
- [Phase ?]: [Phase 36.2 Plan 10]: Roto paper/background settings are stored as layer workflow metadata, not rendered cache frames, so missing background gaps never become green cached cells.
- [Phase ?]: [Phase 36.2 Plan 10]: Missing Roto active backgrounds render virtually in PreviewRenderer/export and transiently in compact playback without mutating physicPaintStore.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 36.2 Codex gap execution is rejected as failed and administratively superseded. See `.planning/phases/36.2-roto-paint-enhancements-all-details-are-here-specs-phase-36-/36.2-CODEX-GAP-EXECUTION-FAILURE.md`.
- Full failed local history is preserved on `backup/broken-36.2-gap-execution-20260618`; current `main` is synced to `origin/main` at `f9758371`.
- Plans `36.2-11`, `36.2-12`, and `36.2-13` are closed with rejected/superseded summaries so they must not be resumed as Phase 36.2 implementation.
- Reported failures remain recovery inputs: Physics Paint close path broken, Roto interpolation not working, cache routing regression into sequence image behavior, Roto key utility buttons unusable/missing, and UI spec coverage incomplete.
- Next action is to create or plan new MVP/TDD recovery phases using `SPECS/36.2-and-more/gsd-recovery-context.en.md`, starting with durable Physics Paint Roto cache core behavior.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260614-ujc | Phase 36.1 script play canvas update options | 2026-06-14 | 34fd228 | [260614-ujc-phase-36-1-i-would-like-to-be-able-with-](./quick/260614-ujc-phase-36-1-i-would-like-to-be-able-with-/) |
| 260615-c4t | solidify phase 36.1 | 2026-06-15 | 29969ee | [260615-c4t-solidify-phase-36-1-fix-the-version-numb](./quick/260615-c4t-solidify-phase-36-1-fix-the-version-numb/) |
| 260615-dpz | Phase 36.1 consolidation naming fix | 2026-06-15 | 410ac50 | [260615-dpz-phase-36-1-consolidation-image-9-there-i](./quick/260615-dpz-phase-36-1-consolidation-image-9-there-i/) |
| 260615-iui | Phase 36.1 Consolidation play canvas brush cache fix | 2026-06-15 | be8f6e8 | [260615-iui-phase-36-1-consolidation-when-i-add-brus](./quick/260615-iui-phase-36-1-consolidation-when-i-add-brus/) |

### Roadmap Evolution

- Phase 36 edited: added heavy physics paint package UI rebuild scope alongside session persistence and output proof.
- Phase 36.1 inserted after Phase 36 (URGENT): Physics paint timeline markers for play script segments, selecting/editing the active segment by scrubber position, previewing interpolation inside efx-physics paint, and rendering play paint scripts sequentially like one pencil stroke path instead of parallel hands.
- Phase 36.2 inserted after Phase 36: Roto paint enhancements: All details are here @SPECS/phase-36.2-physics-paint-roto-cache.md (URGENT)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Editor integration | EFX editor layer integration, Tauri child-window IPC, `.mce` persistence, cached compositing | Deferred to future milestone | v0.8.0 scope |
| Architecture | Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path | Excluded | v0.7.0 failure post-mortem |

## Session Continuity

Last session: 2026-06-19T07:59:06.723Z
Stopped at: Phase 36.3 context gathered
Resume file: .planning/phases/36.3-physics-paint-roto-durable-core-recovery/36.3-CONTEXT.md
