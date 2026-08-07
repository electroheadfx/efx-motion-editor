# Memory Recall (MemPalace)

_Wing: efx-motion-editor · Mode: augment · Transport: mcp_

## Prior decisions
- Phase 42 generates only one real source cycle; Repeat/Infinity are loop intent and must never duplicate durable frames. Static/Hold uses the existing Frames input as cycle length. — MemPalace decisions drawer, Phase 42 CONTEXT, 2026-08-05
- Physical-frame edits must remain parent-authoritative and become visible only after exact accepted acknowledgement; local optimistic authority has caused prior Roto regressions. — MemPalace problem drawer, Phase 36.14 interpolation authority

## Patterns
- Keep Loop Clip operations on the existing controller/coordinator/history route. The accepted-only physical edit path is the stable pattern for fresh identities, semantic deltas, revision checks, and Undo/Redo. — MemPalace problem drawer, `36.14-20-SUMMARY.md`
- EFX Paint UI work should preserve the approved fixed physical-frame strip and existing semantic cell palette rather than creating a parallel state model. — MemPalace project-status drawer, quick `260717-9hw`

## Surprises / gotchas
- Main-timeline focused Delete previously bypassed the Studio controller and history path; the repair required a typed request/ack bridge. Removing the unintended main-timeline surface should remove that special request path, while retaining the underlying accepted controller transaction. — MemPalace problem drawer, `43-08-SUMMARY.md`
- Fresh-child open-loop-edit delivery required immediate plus bounded retries because the main timeline had to launch/focus the Studio and race listener installation. The corrected local EFX Paint lane should not preserve this main-to-child delivery complexity. — MemPalace problem drawer, `43-08-SUMMARY.md`
