# Memory Recall (MemPalace)

_Wing: efx_motion_editor · Mode: augment · Transport: mcp_

## Prior decisions

- **Undo/redo authority must stay atomic and same-authority** — Phase 43.1 loop history: Undo/Redo restores records, incoming breaks, and Loop Clip placements atomically, with command stacks in refs and availability/output in Signals; typed real-hook harnesses model current selection without reactive mirroring. — drawer 43.1-11-PLAN.md (planning)
- **Play Script cache publication is an explicit non-history replace operation** — Phase 36.14 regression: "Play Script is an explicit non-history replace-roto-physical-map operation and never publishes through replace-roto-key-frames"; progressive frames stay provisional, then one sorted complete physical map crosses the sole coordinator and parent bridge. — drawer `?` (problems room, 2026-07-24)
- **10-level undo cap is the accepted Roto model** — the user approved an exact 10-level Undo for Roto; Paint and PlayScript edits feed the same capped stack (echoed in 46-CONTEXT D-02). — drawer 46-CONTEXT.md (decisions)

## Patterns

- **Fail-closed reference severs on asset deletion** — Phase 15.1 asset removal: referencing frames become placeholder/blank (not deleted), references are severed before physical deletion, in-use deletion needs two-step confirmation. Mirrors 46 D-13/D-16 (flag source-missing, sever refs before track delete). — drawer 15.1-CONTEXT.md (planning)
- **ID-based references, never path strings** — asset refactor precedent: `videoAssetId`/`imageId`/`audioAssetId` over paths; consistent with track-local `trackId` addressing. — drawer 15.1-CONTEXT.md (planning)

## Surprises / gotchas

- **Play Script caches broke after the physical-frame cutover (36.14)** — cache publication path regressed when the coordinate system changed; the lesson is that cache mutation must be an explicit single operation crossing the coordinator, not a side effect of a key-replace path. Relevant to 46's track-local cache invalidation (D-12) and async authority (D-19/D-20).
- **Palace wings: both `efx_motion_editor` (35.7k drawers) and `efx-motion-editor` (388) exist** — the large wing is the primary corpus; recall pulled from it.

## Native memory note

The phase CONTEXT.md and 46-DISCUSSION-LOG.md are already filed in the palace (decisions room). Native GSD artifacts (`.planning/graphs/`, STATE.md) remain authoritative under augment mode.
