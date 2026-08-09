# Memory Recall (MemPalace)

_Wing: efx-motion-editor · Mode: augment · Transport: mcp_

## Prior decisions
- The physical document is the canonical parent-authoritative truth; child/UI state must not expose a key, break, marker, selection, or history result as accepted before exact settlement. — `.planning/phases/43.1-intentional-gap-insert-use-specs-milestone-v0-9-0-new-phases/43.1-CONTEXT.md`, palace drawer created 2026-08-09
- Incoming-break ownership is stable-key-owned and key plus break are accepted, rejected, undone, and redone as one atomic physical-document command. — `43.1-CONTEXT.md` D-01, palace drawer created 2026-08-09
- Interpolation updates must remain inside the acknowledged physical transaction rather than split authority back into legacy settings. — Phase 36.14 interpolation-authority problem drawer, created 2026-07-24

## Patterns
- Resolver, coordinator, and parent bridge should validate the same complete semantic delta and return the exact accepted tuple/revision; prior Duplicate/Paste closure used this pattern to distinguish fresh identities from identity-preserving replacement. — `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-20-SUMMARY.md`, palace drawer created 2026-07-22
- Undo/Redo history advances only after exact accepted provenance and replays complete child-owned physical snapshots through the sole acknowledged coordinator. — Phase 36.14 G-36.14-2/G-36.14-3 problem drawer, created 2026-07-24
- Generated interpolation stays derived from ordered real keys; local incoming-boundary suppression must not create a second interpolation engine or materialize generated frames. — `43.1-CONTEXT.md`, palace drawer created 2026-08-09

## Surprises / gotchas
- A parent/child hot-reload mismatch previously contaminated native close/reopen observations; complete break ownership had to be forwarded through launch hydration, live projection, and republishing before frozen-code UAT passed. — `.planning/debug/resolved/phase-43-1-close-reopen-loss.md`, palace drawer created 2026-08-09
- Render-local Signal instances previously let stable settlement callbacks mutate stale instances, causing history to miss accepted edits; authority-scoped replay must avoid recreating that split. — Phase 36.14 G-36.14-2/G-36.14-3 problem drawer, created 2026-07-24
