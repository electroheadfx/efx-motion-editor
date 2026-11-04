---
phase: 261104-l0i-v2-0-1-version-issue-when-i-add-a-key-ke
plan: 01
subsystem: physic-paint-roto
tags: [roto, rails, loop-clips, key-rail, physical-edit, resolver, dissolve, undo]

requires:
  - quick: 261104-bop-v2-0-1-studio-timeline-rails-redesign-v7
    provides: the Standard merged rail set, the Key Rail segmenter and the 58 in-rail insert law this change extends
  - quick: 260918-o0n
    provides: the rail-set boundary law (leading / between-rail destinations) that keeps governing every non-dissolve destination

provides:
  - dissolveRailGroupId on the transient paste-key intent (validator allow-list, exclusivity rules, canonical serializer, factory argument)
  - resolvePhysicPaintRotoRailDissolveTarget — fail-closed qualification of a complete Standard merged rail strictly below the destination
  - resolver paste-key dissolve branch — one proposal that removes the clip, keeps every source record, joins the new key and drops stale non-leading source breaks
  - addEmptyKey dissolve dispatch after the 58 insert target, with forced join semantics and the forceNewSegment opt-out
  - pin matrix for the untouched rail laws and the ordinary-paste opt-out

affects: [physic-paint roto rails, key rail segmentation, paint promotion, physical-edit proposals, undo]

actuals:
  tokens: 12228
  tasks: 3
  commits: 3

plan_head_before: c86619b54191ef788d250c6ac78bfb38b4523f25
plan_head_after: bd2c9fdff35d0c4db1b22c36105f66c7e8bc44c6

tech-stack:
  added: []
  patterns:
    - "Fail-closed resolver qualification: the helper re-validates the whole matrix from the canonical identities and clip collection, so the hook only chooses the intent and the resolver owns the destructive decision."
    - "Intent opt-in field: dissolveRailGroupId lives only on the transient physical-edit intent and is mutually exclusive with railInsertGroupId/destinationKeyId, so ordinary paste paths are structurally unable to dissolve a rail."
    - "Atomic proposal composition: clip removal, joined key insertion and break normalisation ride the existing Candidate fields (nextLoopClips / nextIncomingInterpolationBreakKeyIds), giving one undo entry with no new transport and no persisted schema change."

key-files:
  created: []
  modified:
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Dissolve law (user-approved 2026-11-04, not revisited): a key on an empty frame strictly after one complete Standard merged rail removes that clip and joins the new key to its last source key in ONE atomic edit; the repeats disappear with the clip and the user re-adds a cycle afterwards."
  - "The Standard discriminator is imported from physicsPaintRotoRunScriptStacking (isStandardMergedLoopClip) instead of re-derived; the reverse edge is type-only, so this value import stays acyclic."
  - "Stale non-leading source-key incoming breaks are dropped in the same proposal so a remnant break cannot split the extended line; the first source key's own break state survives because it starts the rail either way."
  - "forceNewSegment wins over the dissolve, and the dissolve is consulted only when the 58 insert target returns null, so every in-rail and repeat-mapping destination stays byte-identical."
  - "Clip removal reuses proposal.nextLoopClips (already a legal canonical proposal shape): no persisted model, parser or serializer is touched."

patterns-established:
  - "Destructive rail authority lives in the resolver: resolvePhysicPaintRotoRailDissolveTarget takes (identities, loopClips, appFrame) and re-checks ownership, completeness, extent and collisions."
  - "Rail-tail dissolve is a paste-key variant with a seventh rail argument, not a new edit kind, so validation, finalisation and undo stay on one path."

requirements-completed: [QUICK-261104-L0I]

coverage:
  - id: D1
    description: "+ Key / paint promotion on an empty frame strictly after a complete Standard merged rail removes that clip and lands the new key joined to its last source key, producing one continuous Key Rail from the first source key to the new key (repeat cycles included)."
    requirement: QUICK-261104-L0I
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1 Rail dissolve (destination strictly AFTER a Standard merged rail)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#v2.0.1 Rail dissolve (destination strictly AFTER a Standard rail)"
        status: pass
      - kind: unit
        ref: "app/src/types/physicPaint.test.ts#v2.0.1: round-trips the Rail dissolve group and refuses every unproven pairing"
        status: pass
    human_judgment: true
    rationale: "Live visible UAT is required: the user confirms the contiguous rail line, cycle removal, one-undo restore and the fall-through behaviours in the running app."
  - id: D2
    description: "Every unproven case (in-rail 58 insert, repeat mapping, reveal insert, scripted/Reveal rails, shared source cycles, painted overrides, inside-footprint or other-rail-touched destinations, forceNewSegment, ordinary Copy/Paste) falls back to today's behaviour with zero data loss."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1 Rail dissolve (destination strictly AFTER a Standard merged rail)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#v2.0.1 Rail dissolve (destination strictly AFTER a Standard rail)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#v2.0.1: the paint promotion keeps its ONE addEmptyKey route with join semantics"
        status: pass
    human_judgment: true
    rationale: "The fall-through results (scripted/Reveal rail end unchanged, in-rail insert, ordinary paste detached key) are visible live behaviours the user verifies."

duration: 9min
completed: 2026-11-04
status: complete
---

# Quick 261104-l0i: v2.0.1 Standard rail dissolve on a post-rail key add Summary

**A key after a Standard rail now dissolves that rail into one joined Key Rail — clip removal, joined key insertion and stale-break cleanup in a single fail-closed atomic edit.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-04T14:26:00Z
- **Completed:** 2026-11-04T14:34:41Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- The v2.0.1 rails regression is fixed for Standard rails: + Key and paint-on-empty strictly after a complete Standard merged rail no longer leave a detached one-key rail behind a rail line that stops at its old end.
- The `dissolveRailGroupId` intent field crosses the bridge canonically — allow-listed by the validator, mutually exclusive with the rail-insert and existing-destination shapes, serialized in deterministic order and accepted by the factory as a seventh rail argument.
- `resolvePhysicPaintRotoRailDissolveTarget` proves the whole qualification matrix from the resolver's own identities and clips, so a stale or unauthorised child-realm intent fails closed instead of removing a clip.
- The dissolve proposal removes the clip through the existing `nextLoopClips` field, keeps every source record, lands the new key joined and drops stale non-leading source-key breaks in the same edit — one undo entry, no persisted schema change.
- Every existing rail law is pinned byte-identically: the 58 in-rail insert (including Reveal), repeat-occurrence mapping, the rail-set boundary law, scripted/Reveal editing, stacking and ordinary Copy/Paste.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dissolve a Standard rail on a post-rail paste key** — `de84de889` (feat) — types contract, helper and resolver branch.
2. **Task 2: Dispatch the rail dissolve from + Key and paint promotion** — `cd8cc0fee` (feat) — `addEmptyKey` wiring.
3. **Task 3: Pin the untouched rail laws and the paste opt-out** — `bd2c9fdff` (test) — regression pins.

Plan metadata commit is owned by the orchestrator; no docs artifact was committed by the executor.

## Files Created/Modified

- `app/src/types/physicPaint.ts` — `dissolveRailGroupId` on the paste-key intent variant, validator allow-list + exclusivity rules, canonical serializer entry.
- `app/src/types/physicPaint.test.ts` — round-trip, deterministic ordering, absence when undefined and the rejection matrix.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — extended `createPhysicPaintRotoPasteKeyIntent`, `resolvePhysicPaintRotoRailDissolveTarget`, `isCompleteStandardRailClip`, `buildDissolvedRailPasteCandidate`, the paste-key dissolve branch.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` — qualification matrix, dissolve proposal pins, stale-break pins, fail-closed re-validation, ordinary-paste opt-out.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — dissolve lookup after the 58 insert target, forced join semantics, `forceNewSegment` opt-out.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — + Key / paint-shaped dispatches and every fall-through.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — single `addEmptyKey` route with join semantics.

## The user-approved dissolve law

When + Key or a paint promotion creates a key on an **empty frame strictly AFTER** one complete Standard merged rail's footprint, the physical edit:

1. removes that rail's Loop Clip (its repeats disappear with it — repeats are derived, never real keys),
2. lands the new key on the clicked frame joined to the rail's last source key (no incoming break, and the right-neighbour break is suppressed by the join),
3. drops every non-leading source key's incoming break in the same edit, and
4. keeps every source record.

The derived Key Rail is therefore ONE continuous segment from the rail's first source key to the new key; in-between frames interpolate or not per the document's current interpolation setting. The user re-adds a cycle afterwards if wanted. It is one undo entry.

## The `dissolveRailGroupId` intent field

- Added to the paste-key intent variant only; it never reaches a persisted model.
- Validator: added to the `hasOnlyKeys` allow-list; requires a non-empty string, forbids coexistence with `railInsertGroupId`, forbids `destinationKeyId !== null`, requires `newKeyId !== null`, forbids `startsNewSegment === true`.
- Canonical serializer: emitted after `railInsertGroupId` in deterministic key order; absent when `undefined`.
- Factory: `createPhysicPaintRotoPasteKeyIntent(..., railInsertGroupId = null, dissolveRailGroupId = null)`; throws `'Rail dissolve requires a fresh key identity and one Group id.'` on the invalid pairing, and spreads the field only when non-null.

## `resolvePhysicPaintRotoRailDissolveTarget` qualification matrix

Returns `{ loopId }` or `null`; every failure is a silent, non-destructive fallback to today's behaviour. In evaluation order:

1. `appFrame` is a non-negative integer; `identities` and `loopClips` are arrays (locals are re-annotated after `Array.isArray` so the clip/identity contracts survive).
2. Every identity has a bounded key id and a non-negative integer frame; key ids are unique.
3. There is a **nearest real key strictly below** the destination.
4. **Exactly one** clip's last source key equals that nearest key (shared/ambiguous endings are not provable ownership).
5. That clip is a **complete Standard merged lifecycle rail**: `syncState` and `provenanceState` defined, `isCanonicalLifecycleRailClip`, finite positive safe-integer repeat, at least two source keys, and `isStandardMergedLoopClip` (no `scriptId`, not `railKind: 'reveal'`).
6. The destination is at or after `originalEndExclusive` (inside the footprint the 58 insert keeps precedence).
7. Its source keys are all known, strictly ascending, anchored at `phaseOrigin`.
8. `originalEndExclusive === phaseOrigin + cycleLength * repeat`, proving the stored footprint describes exactly that many full cycles.
9. For every other clip: it must not share a target source key id; it must not own a source key at or after the destination; and its derived source extent (`resolvePhysicPaintRotoLoopSourceExtent` with `PHYSIC_PAINT_MAX_APPLY_FRAMES`) must not reach the destination.

Fail-closed cases covered by pins: unknown or duplicate identities, non-integer frames, no key below, two clips ending on the same key, scripted rails, Reveal rails, non-canonical lifecycle clips, `repeat: 'infinity'`, a destination inside the footprint, a shifted `originalEndExclusive`, shared source keys and a neighbouring clip whose extent covers the destination.

## Resolver branch and stale-break normalisation

- The paste-key branch validates the intent shape first: a non-string/empty `dissolveRailGroupId`, coexistence with `railInsertGroupId`, an existing `destinationKeyId`, a missing `newKeyId`, `joinsPreviousRail !== true` or `startsNewSegment === true` returns `fail('malformed-identity', ..., 'A Rail dissolve requires one fresh key that joins the previous Rail.')`.
- The dissolve branch runs only when the rail-insert branch did not; it re-resolves the target from `identities.ordered` and the validated `loopClips`, then compares `loopId` to the intent. A null target or a mismatch returns `fail('loop-source-key-insert-rejected', ..., 'This Rail can no longer be dissolved at this frame.')` — never a partial edit.
- `buildDissolvedRailPasteCandidate` starts from the ordinary paste candidate (which already applies the join semantics) and then:
  - `nextLoopClips = Object.freeze(loopClips.filter(clip => clip.loopId !== targetClip.loopId))`,
  - `nextBreaks` keeps the break list filtered to `keyId === firstSourceKeyId || !sourceKeyIds.has(keyId)`, and reports `nextIncomingInterpolationBreakKeyIds` only when the collection actually changed (the resolver's absent-means-unchanged convention).
- The finalizer and semantic-delta validation then run on the combined proposal, so records, clip removal and break collection are staged by one proposal and one undo entry.

## `addEmptyKey` placement and the `forceNewSegment` opt-out

- `loopClips` is read once (`input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY`) and reused by `groupOwnedKeyIds`, the 58 `railInsert` lookup and the dissolve lookup.
- `railInsert` is resolved first. The dissolve is consulted **only when `railInsert === null` and `options?.forceNewSegment !== true`** — so in-rail destinations (58 insert, Reveal insert, repeat mapping) keep the insert path, and Create rail → Key opts out.
- On a dissolve target, the dispatch forces join semantics: `startsNewSegment` becomes `false` and `joinsPreviousRail: joinsPreviousRail || joinedByDissolve`, while `railInsertFrame` stays null. The intent carries `dissolveTarget.loopId`.
- The paint promotion reaches the same route through its single `physicalKeyUtilities.addEmptyKey(..., { joinPreviousRail })` call, pinned by the studio test, so no second promotion path can bypass the dissolve.

## Derived-segment proof

The segmenter (`deriveKeyRailSegments`) flushes a segment at group-owned keys and at a break before its owner. After the dissolve: the source keys are no longer group-owned (their clip is gone), every non-leading source key's break is dropped, and the new key owns no incoming break because it joins. Therefore there is no flush between the rail's first source key and the new key — the segmenter must emit ONE segment spanning them. The pins assert exactly this (`F1 → clicked frame`) for repeat 1 and repeat 2, including the generated interpolation cells and the absence of a detached one-key rail at the destination.

## Untouched laws (pinned byte-identically)

- **58 in-rail insert** (G-05/G-06): a destination inside the rail's first cycle still grows the source cycle; Reveal rails still insert; the existing pins pass with no assertion edits.
- **Repeat-occurrence mapping** under + Key still maps back to its first-cycle phase (`allowRepeatRailInsert` unchanged).
- **Reveal edit law**: Reveal rails are excluded by `isStandardMergedLoopClip`; the hook test proves the Reveal rail beyond its end keeps today's detached-key behaviour.
- **Rail-set boundary law**: `joinsPreviousRail`, `insideConnectedSpan`, `boundaryBreak`, `rightBreak` and `nextBreaks` in `buildPasteCandidate` are unmodified; between-rail and leading-gap destinations behave as before.
- **Scripted (Motion/Static) rails**: excluded; the scripted-rail-beyond-end pin falls through.
- **Ordinary Copy/Paste**: never sets `dissolveRailGroupId`; the resolver pin proves the clip survives and the key opens its own Key Rail, and the harness pin proves `pasteKey` dispatch keeps the plain intent.
- **PlayScript regeneration / stacking / ghost-source-key logic**: untouched — `isStandardMergedLoopClip` is imported, not modified.
- **Persisted schema / format**: untouched; the schema tripwire (`git diff --stat`) shows only the seven planned files and no `physicsPaintRotoPhysicalModel.ts`.

## Verification

- Targeted plan files, fresh run at this HEAD: `4 passed (4)`, `794 passed (794)` — `physicPaint.test.ts`, `physicsPaintRotoPhysicalResolver.test.ts`, `useRotoTimelineActions.test.ts`, `PhysicsPaintStudio.test.ts`.
- Full suite at this HEAD: `Test Files 368 passed | 2 skipped (370)`, `Tests 7200 passed | 1 skipped | 96 todo (7297)`, **0 failed**.
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` clean.
- Commit ledger: 3 commits since `c86619b54`, zero deleted files, diff limited to the seven planned files (770 insertions, 5 deletions).

## Decisions Made

- Followed the user-approved dissolve law exactly as specified in the plan; no scope additions.
- Kept the dissolve as a paste-key variant rather than a new edit kind so intent validation, finalization, semantic-delta validation and undo stay on one path.
- Imported `isStandardMergedLoopClip` from the stacking module after confirming the reverse dependency is type-only (acyclic value edge).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The resolver test's generated-cell assertion initially included cells from an earlier key's segment; retargeted to `cell.kind === 'generated' && cell.leftKeyId === 'K5'`.
- Identity comparisons for surviving source records use `toEqual(currentRecords[index])` (the semantic input validator clones records), with explicit `appFrame` equality.
- Two typecheck fixes during Task 1: `clip.repeat` needed a local narrowed `repeat` before the extent arithmetic (TS2363), and `Array.isArray` narrowed the inputs to `any[]`, so the locals were re-annotated to keep the loops typed (TS7006).
- The scripted-rail hook fixture needed the full all-or-nothing provenance trio (`motion`, `overrideColor`) for `isPhysicPaintRotoLoopClip` to accept the clip; without it the dispatch was rejected as `malformed-loop-clips`.

## User Setup Required

None - no external service configuration required.

## UAT rows handed to the user

**UAT approved by the user on 2026-11-04 — all rows passed.**

Live visible UAT; automated-green is not done:

- Standard rail without a cycle (keys 1/3/5): + Key on an empty frame after F5 draws ONE rail line from F1 to the new key, with in-between dashes only when interpolation is on.
- Same document, paint on an empty frame after the rail: same contiguous result through the paint promotion route.
- Cycle-2 Standard rail: + Key after the repeats removes the repeats, keeps the source keys and extends the line to the clicked frame; re-adding a cycle afterwards still works.
- One Undo restores the previous rail with its cycle and removes the added key.
- + Key on an in-between inside a rail still grows the rail by a source phase (58 law unchanged), and + Key on a repeat occurrence still opens the key at its first-cycle phase.
- A scripted (Motion/Static) or Reveal rail beyond its end keeps today's behaviour (detached key, rail end unchanged).
- Ordinary Copy/Paste on that same empty frame still creates a detached key (no rail is dissolved).

## Self-Check: PASSED

- All seven planned files present and modified; no deletions.
- Commits `de84de889`, `cd8cc0fee`, `bd2c9fdff` are ancestors of HEAD.
- Targeted tests and typecheck green at this HEAD; full suite green with 0 failed.
