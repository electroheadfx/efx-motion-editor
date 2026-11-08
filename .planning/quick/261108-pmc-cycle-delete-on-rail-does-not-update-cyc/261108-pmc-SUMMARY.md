---
phase: 261108-pmc-cycle-delete-on-rail-does-not-update-cyc
plan: 01
subsystem: physic-paint-roto
tags: [roto, rails, loop-clips, delete, cycle, dissolve, vitest]
status: complete

# Dependency graph
requires:
  - quick: 261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins
    provides: the complete-canonical-lifecycle dissolve eligibility and the atomic nextLoopClips edit shape reused here
  - phase: 58
    provides: the G-01 group-owned delete refusals and the canonical lifecycle rail contract
provides:
  - Delete on a Rail cycle (repeat) cell refuses with product copy; the cell no longer removes that phase from the clip's visible ranges
  - A real key owned by a sole complete canonical Rail cycle deletes by dissolving that cycle in the same atomic edit
  - D-07 shared-source refusal retained, including the covering-clip-versus-referencing-clip mismatch
affects: [physic-paint roto delete, rail cycles, physical-edit proposals, undo]

actuals:
  tokens: 6200
  tasks: 2
  commits: 1

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
---

**Deleting a key on a cycled rail now dissolves that cycle in the same atomic edit, and Delete on a repeated cycle cell is refused instead of suppressing the matching key in every repeat.**

## What changed

1. `classifyRotoDeleteTarget` returns a new `cycle-frame` target whenever the addressed frame resolves to a
   repeat instance (`repeatInstance > 0`) of a lifecycle clip — cursor path and selected-key path alike.
   `mapRotoDeleteProductReason` publishes the locked refusal
   "Delete is unavailable on a Rail cycle frame. Delete the Rail, or a key inside it, instead."
2. A real key on a first-cycle frame now classifies as `ordinary-key`, so the resolver's `delete-key` branch
   owns the decision instead of the group-frame proposer.
3. `delete-key` gains the dissolve branch: when exactly one complete **canonical** lifecycle rail owns the
   key's frame and that clip is the only one referencing the key id, the proposal drops the clip through
   `nextLoopClips` and builds the delete candidate against the remaining clips' source keys (so survivors
   ripple exactly like a plain Key Rail delete). Non-leading source-key interpolation breaks leave with the
   clip; the leading source key keeps its break.
4. Fail-closed shapes are unchanged: a second clip referencing the same key keeps the D-07 copy
   ("…used by N linked loop(s)…"), a gapped or painted rail keeps the G-01 refusal, and multi-key /
   Key Rail / rail-set deletes still refuse.

## Verification

- `npx tsc --noEmit -p app/tsconfig.json` — clean.
- `npx vitest run src/components/physic-paint src/stores` — 257 files, 6337 tests pass.
- Live UAT pending (user): delete a key on a cycled rail → the cycle disappears in one step and the
  remaining keys survive; Delete on a dotted cycle cell → disabled with the new copy.
- A rail already damaged by the old behavior is non-canonical, so its key delete refuses with the existing
  copy — delete the Rail once to rebuild it cleanly.
