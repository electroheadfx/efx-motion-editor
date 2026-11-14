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
  tokens: 8400
  tasks: 2
  commits: 4
  uat_approved: 2026-11-08

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
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
- `npx vitest run src/lib src/components/physic-paint src/stores` after the bridge parity fix — 336 files,
  7505 tests pass.
- A rail already damaged by the old behavior is non-canonical, so its key delete refuses with the existing
  copy — delete the Rail once to rebuild it cleanly.

## UAT

Approved 2026-11-08 by the user after the live Studio pass ("All uat approved").

Rows covered by the approval:

1. Delete a real key on a rail carrying a cycle. Expected: the cycle dissolves in the same step and the
   surviving keys stay on one continuous rail; one undo restores both.
2. Delete on a dotted cycle cell. Expected: Delete is unavailable with "Delete is unavailable on a Rail
   cycle frame. Delete the Rail, or a key inside it, instead."
3. +Key on an interpolated frame of a cycled rail. Expected: applies — no parent rejection, no
   `(loop-clips)` mismatch.

## Follow-up — parent rejection `(loop-clips)` (fixed)

A live +Key on an interpolated frame of a cycled rail was rejected by the parent with
"Submitted physical document does not match the canonical parent-resolved edit (loop-clips)." Not caused
by the delete law (delete-key is not on the +Key path).

Root cause (confirmed, pinned by a bridge test): the CHILD bounds every staged edit to the source-derived
extent via `reconcilePhysicPaintRotoGroupFrames` (58-09 G-01), but the PARENT compared the resolver's
unbounded collection. A stale clip — `originalEndExclusive` past the extent its surviving source keys
prove — therefore diverged on every edit of that track, with records still equal. The parent now applies
the same reconciliation before comparing and before building the revision
(`6ebcf075f`); the pin fails with the user's exact `(loop-clips)` message when the call is removed.

Side effect: the first edit after this fix persists the bounded clip, so the rail's cycle stops at its
surviving source extent (the 58-09 G-01 law) and the track stops failing.
