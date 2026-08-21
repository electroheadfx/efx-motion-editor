# Memory Recall (MemPalace)

_Wing: efx-motion-editor · Mode: augment · Transport: mcp_

## Prior decisions
- Phase 42 generates one real source cycle only; Repeat/Infinity remain loop intent and must never duplicate durable frames. Static/Hold uses the existing Frames input as cycle length. — MemPalace `decisions` drawer, Phase 42 CONTEXT, 2026-08-05
- The Physics Paint right sidebar's existing resizable Brush/Tool/Scripts-Onion-Motion structure, custom scrollbar, and Lucide interaction language passed native UAT and should be reused rather than replaced by another pane. — MemPalace `project-status` and `approved-behavior` drawers, quick 260717-9hw, 2026-07-17

## Patterns
- Keep selected-loop UI inside the existing Scripts context: contextual action/detail substitution preserves the already-approved sidebar layout, scrolling, and resize behavior. — Derived from MemPalace quick 260717-9hw project-status drawer
- Physical-frame changes remain provisional until one accepted canonical physical-map transaction crosses the existing coordinator/parent authority path; local UI must not publish optimistic loop facts. — MemPalace `problems` drawer, Phase 36.14 Play Script cache-publication fix
- Session-scoped UI state uses Preact Signals and existing controller state; source-cycle and reusable script documents remain unchanged by presentation selection. — MemPalace Phase 42 decisions drawer

## Surprises / gotchas
- Main-timeline focused Delete previously bypassed the Studio controller/history path and required a specialized typed request/ack repair. Removing the main-timeline Loop Clip surface should remove that special caller, not duplicate the mutation path inside the new rail. — MemPalace `problems` drawer, `43-08-SUMMARY.md`
- Main-to-child open-loop-edit delivery required immediate plus bounded retries because it raced Studio launch/listener readiness. Rail double-click, Enter, and sidebar Edit are local Studio actions and should not preserve this transport complexity. — MemPalace `problems` drawer, `43-08-SUMMARY.md`
- The right sidebar has already passed native approval; adding a new Loop Clip pane or changing its resizer/scroll structure would reopen accepted UI without product need. — MemPalace `project-status` drawer, quick 260717-9hw
