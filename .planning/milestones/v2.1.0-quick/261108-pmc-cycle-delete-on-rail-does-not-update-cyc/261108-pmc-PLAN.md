---
quick_id: 261108-pmc
slug: cycle-delete-on-rail-does-not-update-cyc
date: 2026-11-08
status: planned
phase: 261108-pmc-cycle-delete-on-rail-does-not-update-cyc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
autonomous: true
requirements: [QUICK-261108-PMC]
user_setup: []

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: high

must_haves:
  truths:
    - "Delete on a Rail cycle frame (a repeat-instance cell, the dotted cell) is refused with a product message; it never removes that phase from the clip's visible ranges and never leaves a suppressed key behind."
    - "Delete on a real key that a lifecycle Rail cycle owns dissolves that cycle in the SAME atomic edit: the Loop Clip leaves the collection, the key is deleted, later survivors ripple left as a plain Key Rail delete, and one undo restores both."
    - "A real key referenced by more than one loop, or owned by a covering clip while another clip references it, still refuses with the locked D-07 copy; nothing is dissolved."
    - "Generated in-between frames (repeatInstance 0, no real key record) keep the existing group-frame delete behavior; no non-cycle Group semantics change."
    - "No schema, persisted document shape, store projection, bridge protocol, motion channel or CSS changes."
  artifacts:
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      provides: "the cycle-frame delete target, its product copy, and the real-key routing that reaches the ordinary key delete"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
      provides: "the delete-key dissolve branch that drops the owning lifecycle clip in the same candidate"
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts"
      provides: "classifier pins for the three routing outcomes"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts"
      provides: "resolver pins for the dissolve proposal and the shared-cycle refusal"
  key_links:
    - from: "classifyRotoDeleteTarget (selected real key on a cycle frame)"
      to: "delete-key intent"
      via: "ordinary-key route instead of group-frame"
    - from: "delete-key resolver branch"
      to: "proposal.nextLoopClips"
      via: "the filtered clip collection consumed by physicPaintBridge"
---

<objective>
Fix two reported delete defects on cycled rails (Phase 59 branch):

1. Deleting a real key on a rail that carries a cycle did not update the cycle. The UI classifier
   routes every group-owned frame to `delete-group-frame`, which removes that phase from the clip's
   `visibleRanges` and leaves the slot EMPTY — the cycle keeps its length and repeats around a hole.
2. Deleting a cycle cell (repeat instance) routed to the same path, so one press silently suppressed
   the matching key in every repeat.

Decisions locked with the user:
- Deleting a REAL KEY owned by a rail cycle DISSOLVES that cycle in the same atomic edit and deletes
  the key (the approved +Key law shape from 261108-nq0). The Rail survives as a plain Key Rail.
- Only REPEAT/CYCLE cells are refused. Generated in-between cells keep today's behavior.

Out of scope: multi-select, rail-set delete, Key Rail delete, cycle shrinking in place, persistence.
</objective>

<tasks>

<task id="1" type="auto">
  <name>Refuse Delete on Rail cycle cells</name>
  <files>app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</files>
  <action>
In `classifyRotoDeleteTarget`, widen the group-frame resolver so it also carries `repeatInstance`.
When the selected key's frame — or the cursor frame — classifies as `source-occurrence`,
`generated-occurrence` or `override` with `repeatInstance > 0`, return a new target
`{ kind: 'cycle-frame', groupId, appFrame }` instead of `group-frame`. Add the `cycle-frame` case to
`mapRotoDeleteProductReason` with the copy "Delete is unavailable on a Rail cycle frame. Delete the
Rail, or a key inside it, instead." Extend the `RotoDeleteTarget` union. Every other branch is
unchanged: repeatInstance 0 generated frames stay `group-frame`.
  </action>
  <verify>
`pnpm vitest run app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
  </verify>
  <done>A repeat-instance frame classifies as cycle-frame and maps to the refusal copy. Pins cover cursor and selected-key paths; a repeatInstance-0 generated frame still classifies as group-frame.</done>
</task>

<task id="2" type="auto">
  <name>Dissolve the owning cycle when a real key is deleted</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts, app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.ts</files>
  <action>
Classifier: a selected real key whose own frame is group-owned by a lifecycle clip with
`repeatInstance === 0` returns `{ kind: 'ordinary-key', keyId }` (not `group-frame`). The same applies
to the cursor path when the frame classifies as `source-occurrence` and a real key record sits on it.
Resolver: in the `delete-key` branch, before the D-07 guard, resolve the unique lifecycle clip whose
bounded extent covers the key's frame and whose `visibleRanges` include it. When exactly one such clip
exists and no OTHER clip references the key id, build the delete candidate with
`buildDeleteCandidate(identities, keyId, remainingClipsReferencedKeyIds)` and
`nextLoopClips = loopClips without that clip`, then finalize. When another clip references the key,
keep the existing D-07 refusal and copy. The existing G-01 guard stays as the backstop for every
non-dissolvable case.
  </action>
  <verify>
`pnpm vitest run app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
  </verify>
  <done>Deleting a sole-cycle source key yields an accepted proposal that removes the key and drops the clip; a shared source cycle refuses with the D-07 copy; undoing restores both.</done>
</task>

</tasks>

<verification>
- `pnpm vitest run` over the two touched suites plus `app/src/components/physic-paint` passes.
- Live UAT (user): delete a key on a cycled rail → the cycle disappears in one step, the rail keeps
  the remaining keys; delete a dotted cycle cell → Delete is disabled with the new copy.
</verification>
