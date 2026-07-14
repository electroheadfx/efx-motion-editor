---
gsd_state_version: 1.0
milestone: v0.8.0
milestone_name: Standalone Physics Paint
current_phase: 36.14
current_phase_name: physics-paint-roto-timeline-ui-from-pencil
status: ready_to_plan
stopped_at: Phase 36.13 completed and native UAT approved
last_updated: "2026-07-14T06:45:00Z"
last_activity: 2026-07-14
last_activity_desc: Completed quick task 260714-ail — replaced manual Roto save with automatic live pixel caching
progress:
  total_phases: 19
  completed_phases: 16
  total_plans: 92
  completed_plans: 92
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-22)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 36.14 — physics-paint-roto-timeline-ui-from-pencil

## Current Position

Phase: 36.14 (physics-paint-roto-timeline-ui-from-pencil) — READY TO PLAN
Previous phase: 36.13 — Physics Paint Roto Dynamic Interpolation Spacing complete
Plan: 0 of TBD
Status: Phase 36.13 completed with native UAT approval
Last activity: 2026-07-14 — Completed quick task 260714-ail: replaced manual Roto save with automatic live pixel caching
Next recommended action: Run `/gsd-plan-phase 36.14`

Progress: [█████████████████░░░] 92/92 planned Phase 36.13 plans executed; 16/19 phases complete (84%)

## Performance Metrics

**Velocity:**

- Total plans completed: 39 for v0.8.0
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
| 36.3 | 2 | - | - |
| 36.4 | 2 | - | - |
| 36.5 | 3 | 45min | 15min |
| 36.6 | 3 | - | - |
| 36.7 | 5 | - | - |
| 36.10 | 5 | - | - |
| 36.11 | 3 | - | - |

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
| Phase 36.4 P01 | 20min | 3 tasks | 3 files |
| Phase 36.5 P01 | 7min | 3 tasks | 2 files |
| Phase 36.5 P02 | 4min | 3 tasks | 2 files |
| Phase 36.5 P03 | 34min | 3 tasks + visual fix | 4 files |
| Phase 36.6 P01 | 42min | 3 tasks | 2 files |
| Phase 36.6 P02 | 25min | 3 tasks | 5 files |

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
- [Superseded by quick 260714-ail] Phase 36.2 Plan 03 manual lifecycle flushes at frame leave, Save pending/current, and close/unload are replaced by completed-mutation live pixel caching.
- [Phase 36.2]: Plan 03: Cached-only Roto PNGs are repaintable visual references, not editable stroke state, and are cleared before exported replacement frames are generated. — Prevents old cache compositing into replacement Roto output.
- [Superseded by quick 260714-ail] Phase 36.2 Plan 03 navigation blocking during Roto flush/apply is removed; per-source-frame revisions now prevent stale cache writes without blocking navigation.
- [Superseded by quick 260714-ail] Phase 36.2 Plan 07 close-time Roto flush/apply is removed; completed mutations already update durable flattened pixels.
- [Phase 36.2 Plan 07]: Editable-session pink cells are driven only by real editable stroke content in the open session; cached/background-only occupancy remains separate.
- [Phase 36.2 Plan 07]: Cached Roto references stay full opacity and use outline treatment for reference status so old cache pixels are not visually diminished.
- [Phase 36.2 Plan 08]: Roto interpolation controls live inline in the standalone workflow strip, not in a modal or hidden shortcut path, so UAT can discover and change settings visually.
- [Phase 36.2 Plan 08]: Generated interpolation frames remain render-only cached frames surfaced by connector/status UI; real-key cells remain the only editable targets.
- [Phase 36.2 Plan 09]: Roto key utility controls are inline in the standalone workflow strip; generated interpolation frames stay render-only and Paste is replace-style on real keys only.
- [Phase 36.3]: Cached Roto PNG output is the durable truth; reopen uses a full-strength visual `Cached reference`, not editable stroke restoration.
- [Superseded by quick 260714-ail] Phase 36.3 `Save current` recovery is removed; completed live mutations automatically commit the latest flattened alpha pixels.
- [Phase 36.3]: Phase 36.3 UI-spec fidelity debt is documented in `36.3-UI-REVIEW.md`; defer fixes to a later targeted UI cleanup, not hidden Phase 36.3 scope.
- [Superseded by quick 260714-ail] Phase 36.6 save-on-leave and queued navigation lifecycle are removed; source-bound per-frame revisions accept only the latest automatic live-pixel commit.
- [Phase 36.7]: Roto key utilities now operate on real-key controller transactions so Duplicate, Insert, Delete, Copy, and Paste keep cache/cell/canvas state clean.
- [Phase 36.9]: Cached Roto Play/Stop transport lives inside the Roto navigator; Play and Stop replace each other in one icon slot, loop is an icon pressed state, fps changes restart active playback, and Space toggles playback in Roto mode.
- [Phase 36.9]: Cached Roto playback sequences only real cached Roto key frames from launch context, excluding current/occupied/saved/background fallback frames that caused empty trailing frames.
- [Phase 36.11]: Cached real-key repaint uses the cached alpha as a non-editable engine preview base and merges new live alpha additively on save; preview base stays out of export/cache serialization.
- [Superseded by quick 260714-ail] Phase 36.11 same-session post-Save navigation is replaced by immediate automatic live-pixel commits through the same cached-frame source.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 36.2 Codex gap execution is rejected as failed and administratively superseded. See `.planning/phases/36.2-roto-paint-enhancements-all-details-are-here-specs-phase-36-/36.2-CODEX-GAP-EXECUTION-FAILURE.md`.
- Plans `36.2-11`, `36.2-12`, and `36.2-13` are closed with rejected/superseded summaries so they must not be resumed as Phase 36.2 implementation.
- Remaining recovery inputs after Phase 36.3: close-path polish, Roto interpolation, Roto key utilities, broader cached playback/export, missing-background rules, repaint cached real-key behavior, and UI-spec fidelity fixes from `36.3-UI-REVIEW.md`.
- Phase 36.7 completed: Roto key utility UAT passed for Duplicate, Insert, Delete, Copy, Paste, generated/empty guards, dirty save-before-action, focused regressions, typecheck, and user-story coverage.
- Phase 36.8 completed: Roto session/key state boundary refactor passed focused regressions, full app tests, typecheck, package build, and user-approved Roto key utility UAT.
- Phase 36.9 State Machine Readiness is deferred to Phase 36.15 maintenance; Phase 36.8 is the state boundary foundation while remaining user-facing Roto features are prioritized first.
- Phase 36.9 cached playback has green automated checks and Plan 03 summary prepared, but final user UAT confirmation is still pending for the real-key-only fix that should remove empty trailing playback frames.
- Phase 36.10 completed: UAT Test 5 passed after user verified save/close/reopen preserves Physics Paint Roto strokes and paper/background metadata.
- Phase 36.11 completed: user approved additive cached real-key repaint after old cache visibility, new paint preview layering, paper/background proportions, save merge, and same-session navigation cache refresh were verified.
- Phase 36.12 completed: user approved generated render-only Roto interpolation after duplicate mapping, parent preview/export, persistence, live toggle-off, and compact source-sequence key creation blockers were resolved.
- Phase 36.13 completed: user approved dynamic spacing, canonical persistence/preview/export parity, generated/empty non-durability, visible onion composition, real-key-depth Onion Value semantics, and generated-owner onion traversal.
- Phase 37 should stay contract/validation-only: no headless adapter, no editor-driven `renderFromStrokes`, no `forceDryAll`, and no broad editor integration.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260614-ujc | Phase 36.1 script play canvas update options | 2026-06-14 | 34fd228 | [260614-ujc-phase-36-1-i-would-like-to-be-able-with-](./quick/260614-ujc-phase-36-1-i-would-like-to-be-able-with-/) |
| 260615-c4t | solidify phase 36.1 | 2026-06-15 | 29969ee | [260615-c4t-solidify-phase-36-1-fix-the-version-numb](./quick/260615-c4t-solidify-phase-36-1-fix-the-version-numb/) |
| 260615-dpz | Phase 36.1 consolidation naming fix | 2026-06-15 | 410ac50 | [260615-dpz-phase-36-1-consolidation-image-9-there-i](./quick/260615-dpz-phase-36-1-consolidation-image-9-there-i/) |
| 260615-iui | Phase 36.1 Consolidation play canvas brush cache fix | 2026-06-15 | be8f6e8 | [260615-iui-phase-36-1-consolidation-when-i-add-brus](./quick/260615-iui-phase-36-1-consolidation-when-i-add-brus/) |
| 260626-dja | Set up Vitest coverage for app tests and run the coverage report | 2026-06-26 | 966c76ec | [260626-dja-set-up-vitest-coverage-for-app-tests-and](./quick/260626-dja-set-up-vitest-coverage-for-app-tests-and/) |
| 260714-9es | Fix Clear current Roto frame cache reset | 2026-07-14 | 82ebc620 | [260714-9es-fix-the-clear-current-roto-frame-button-](./quick/260714-9es-fix-the-clear-current-roto-frame-button-/) |
| 260714-ail | Replace manual Roto save with automatic live pixel caching | 2026-07-14 | f5ad4212 | [260714-ail-replace-manual-save-on-leave-rendering-w](./quick/260714-ail-replace-manual-save-on-leave-rendering-w/) |

### Roadmap Evolution

- Phase 36 edited: added heavy physics paint package UI rebuild scope alongside session persistence and output proof.
- Phase 36.1 inserted after Phase 36 (URGENT): Physics paint timeline markers for play script segments, selecting/editing the active segment by scrubber position, previewing interpolation inside efx-physics paint, and rendering play paint scripts sequentially like one pencil stroke path instead of parallel hands.
- Phase 36.2 inserted after Phase 36: Roto paint enhancements: All details are here @SPECS/phase-36.2-physics-paint-roto-cache.md (URGENT)
- Phase 36.4 inserted after Phase 36: Physics Paint Roto Explicit Close Behavior Use SPECS/36.x-phases/phase-36.4-explicit-close/spec-36.4-explicit-close.md as the source of truth for this phase. (URGENT)
- Phase 36.5 inserted after Phase 36: Physics Paint Roto Cell Semantics — Roto timeline cell semantics: make frame states visible and trustworthy in the UI, using SPECS/36.x-phases/timeline-ui/* as visual reference while keeping the MVP narrow. (URGENT)
- Phase 36.6 inserted after Phase 36: Physics Paint Roto Save On Leave — source of truth: SPECS/36.x-phases/phase-36.6-save-on-leave/spec-36.6-save-on-leave.md (URGENT)
- Phase 36.7 inserted after Phase 36: Physics Paint Roto Key Utilities; source of truth: SPECS/36.x-phases/phase-36.7-key-utilities/spec-36.7-key-utilities.md (URGENT)
- Phase 36.8 inserted after Phase 36: Physics Paint Roto State Refactor (URGENT)
- Phase 36.9 inserted after Phase 36: Physics Paint Roto State Machine Readiness (URGENT)
- Phase 36.x order updated: inserted Phase 36.11 Repaint Cached Real Key, shifted Generated Interpolation to 36.12, Timeline UI From Pencil to 36.13, and deferred State Machine Readiness to 36.14 maintenance after remaining user-facing Roto features; Phase 36.8 is the state boundary foundation
- Phase 36.x order updated: inserted Phase 36.13 Dynamic Interpolation Spacing, shifted Timeline UI From Pencil to 36.14, and deferred State Machine Readiness to 36.15 maintenance after custom per-segment interpolation spacing is stabilized.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Editor integration | EFX editor layer integration, Tauri child-window IPC, `.mce` persistence, cached compositing | Deferred to future milestone | v0.8.0 scope |
| Architecture | Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path | Excluded | v0.7.0 failure post-mortem |

## Session Continuity

Last session: 2026-07-13T23:50:00Z
Stopped at: Phase 36.13 completed and native UAT approved
Resume file: .planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/ (plan not created yet)
