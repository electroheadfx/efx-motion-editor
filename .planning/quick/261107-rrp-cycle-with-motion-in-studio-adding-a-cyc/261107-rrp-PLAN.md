---
phase: 261107-rrp-cycle-with-motion-in-studio-adding-a-cyc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/railMotionIdentity.ts
  - app/src/components/physic-paint/roto/railMotionIdentity.test.ts
  - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
  - app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts
  - app/src/lib/railMotionGateBEdits.test.ts
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/roto/railMotionCommands.test.ts
  - app/src/components/physic-paint/roto/railMotionEvaluator.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts
autonomous: true
requirements: [QUICK-261107-RRP]
user_setup: []

estimate:
  tokens: 60000
  raw_tokens: 60000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Converting an animated Key Rail into a Rail cycle or Key Rail cycle preserves its motion: the stored record keeps every channel, key, value, easing, wiggle and rail-local frame, and is re-keyed to the new Loop Clip's loopId in the same commit as the conversion."
    - "After a conversion the record is active on the new cycle rail (railId equals loopId), so dots, curve and the compositor all bind to it; no motion is deleted, no orphan warning is produced, and one undo restores the pre-conversion railId byte-identically."
    - "A finite Loop Clip's motion span is the rail's resolved extent: the view ends at the span resolver's effectiveEnd for that loopId, never at a source-key-count product. An infinity clip keeps the locked Math.max(single-occurrence fallback, resolved end) rule."
    - "The motion span auto-fits in both directions: a longer cycle (more repeats, a new source key, a longer lifecycle) extends the lane, a shorter cycle shortens it, and lane width, header stack, curve sampling, drag clamp and cursor writes all read one shared derived frame count."
    - "Out-of-range motion keys are preserved verbatim (preserved-but-inactive), never clamped or deleted: they stop rendering, selecting and dragging while outside the band and reappear at their original rail-local frames when the rail re-extends; every frame still inside the band evaluates identically before and after a shrink."
    - "No persisted railMotions field, schema, serializer, evaluator or store path changes; the span stays derived from the loop-resolution ranges that the rail and compositor already use."
  artifacts:
    - path: "app/src/components/physic-paint/roto/railMotionIdentity.ts"
      provides: "onConvertRailToLoopClip (identity-preserving re-key to a Loop Clip), the finite-clip resolved-span branch in deriveRailMotionRailViews, and railMotionViewFrameCount as the ONE band derivation"
    - path: "app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts"
      provides: "conversion detection before delete-only-key: a next Loop Clip owning every prior Key Rail key at the same placement start re-keys the record instead of deleting it; placementStart joins the clip facts"
    - path: "app/src/components/physic-paint/roto/railMotionCommands.ts"
      provides: "railMotionCursorFrame reads the shared frame-count helper so a write clamps into the resolved band without touching out-of-band keys"
    - path: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
      provides: "TimelineMotionBlock derives railFrameCount through the shared helper"
    - path: "app/src/components/physic-paint/view/TimelineMotionChannels.tsx"
      provides: "TimelineMotionHeaderGroup derives its band through the shared helper, so header and body cannot disagree"
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      provides: "prepareMotionKeyDrag and commitMotionKeyDrag validate the destination with the shared frame count"
    - path: "app/src/lib/railMotionGateBEdits.test.ts"
      provides: "real-transport pin: a loop-only conversion payload through applyPhysicPaintPayload re-keys the record and one undo restores it"
  key_links:
    - from: "railMotionDocumentReconciler.classifyRailMotionEdit"
      to: "next Loop Clip ownership"
      via: "collectRailMotionGroupOwnedKeyIds over the next clip, checked BEFORE the delete-only-key branch"
    - from: "railMotionIdentity.onConvertRailToLoopClip"
      to: "reconcileRailMotions active map"
      via: "the re-keyed record's railId equals the Loop Clip's loopId, the only durable identity join"
    - from: "structural.loopResolution.ranges"
      to: "deriveRailMotionRailViews finite end"
      via: "createRailMotionViewSpanResolver.resolveLoopEndExclusive, the same authority the rail and compositor read"
    - from: "railMotionViewFrameCount"
      to: "lane width, header stack, curve sampling, drag clamp, cursor writes"
      via: "one exported helper imported by every consumer"
---

<objective>
Fix the Phase 59 rail-motion model so a cycle preserves motion and the motion span always equals the rail's resolved extent.

Purpose: three live UAT findings on branch `gsd/phase-59-rail-motion-channels-v7-interface` against the shipped v2.1.0 motion surface. (1) Adding a Rail cycle or Key Rail cycle to an animated rail deletes its motion. (2) Adding motion to an already-cycled rail only spans the first cycle's key count, so later occurrences show empty dotted placeholders. (3) Reducing the cycle shortens the motion span by a value that does not match the rail. The user's directive is explicit: the motion time space must auto-fit the rail length — extend with a key or a cycle, shrink with it.

Diagnosis: two independent defects, both at identity/span authorities, not in the dot renderer. (1) `confirmKeyRailCycle` mints a fresh `loopId` and every source key becomes group-owned, so `reconcileRailMotionDocumentEdit` finds zero successor Key Rail segments and classifies the record as `delete-only-key`; the record is deleted in the conversion commit. (2) `deriveRailMotionRailViews` computes a finite Loop Clip's end as `placementStart + sourceKeyIds.length * repeat` — a key COUNT — and consults the span resolver only for `repeat === 'infinity'`; gapped cycles, lifecycle ends and truncation therefore disagree with the rail the user sees, and the rail-local drag/cursor band inherits that wrong width.

Scope note: the span stays derived (no persisted span field, no schema shim). The reconcile path is extended with one identity transition and one classification row; the span path reuses the existing `structural.loopResolution.ranges` resolver at every view derivation. Out-of-band motion keys are PRESERVED in the record (preserved-but-inactive): they are filtered from rendering/selection/drag by the existing in-band filter and reappear when the rail re-extends, which loses the least user data and makes shrink/re-extend reversible. The evaluator, serializer, store projection, compositor, CSS, document model and `physicsPaintRotoRailSetCopy.ts` (an anchor-only consumer that never reads a loop view end) are untouched. `workflow.tdd_mode` is on: each task is RED-first (`tdd="true"` with `<behavior>`).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.claude/skills/efx-async-orchestration/SKILL.md

Verified anchors at HEAD bebeb79b9 (the only baseline this plan changes):

- Defect 1 site — `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts`: `RailMotionDocumentLoopClipFact` 51-55 (loopId, sourceKeyIds, optional frameOverrides; no placementStart), `ReconcileRailMotionsForDocumentEditInput` 83-87, loop-owned branch 197-203, prior-segment lookup 205-212, delete-only-key classification 227-228, split/merge/start-moved rows 230-275, switch 320-380, entry 288-389. `collectRailMotionGroupOwnedKeyIds` 104-113 is the ONE ownership projection.
- Conversion producer — `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`: `confirmKeyRailCycle` 2072-2130 builds the clip with `loopId: createPhysicPaintRotoKeyId()`, `placementStart: firstKeyFrame`, `sourceKeyIds: target.keyIds`, `mode: 'progressive'`, and publishes through `buildLoopOnlyPublication` 2389-2427 (no railMotions member, so the bridge reconciles). The refusal at 2095 already forbids converting keys that belong to a clip, so the destination loopId is always fresh.
- Commit path — `app/src/lib/physicPaintBridge.ts:1960-1985` reconciles only when the payload omits `railMotions`, passing each side's staged full `loopClips` (which structurally carry placementStart); `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:2497-2509` stages the same reconciliation and hashes it into the revision. Replay/paste pass an explicit collection and bypass reconciliation.
- Defect 2 site — `app/src/components/physic-paint/roto/railMotionIdentity.ts`: `RailMotionLoopClipSource` 30-37, `RailMotionRailViewSpanResolver` 78-80, `createRailMotionViewSpanResolver` 89-109 (max effectiveEnd per loopId; finite positive integer answers only), `deriveRailMotionRailViews` 233-274 with the finite/infinity branch at 242-247, `assignRailMotionRailViews` 287-317, Gate B transitions 324-472, `rekeyRailMotionsForCopy` 473+.
- Span authority — `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`: `derivePhysicPaintRotoLoopRanges` 6758-6917; `cycleLength` is span-based (`last source offset + 1`) at 6809-6811, `requestedEnd` 6821-6825, source extent bound 6833-6838, per-fragment `effectiveEnd = max(start, min(boundedNaturalEnd, endExclusive, boundary.frame))` 6889-6893, ranges sorted by placementStart 6912. This is the same context the rail and compositor draw.
- Band consumers to unify — `app/src/components/physic-paint/roto/railMotionCommands.ts:81` (`railMotionCursorFrame`, imports identity at 25-31), `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:629-631` (`TimelineMotionBlock`, imports identity at 34-36), `app/src/components/physic-paint/view/TimelineMotionChannels.tsx:643-645` (`TimelineMotionHeaderGroup`, currently a type-only identity import at 33), `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:4209` and `:4261` (prepare/commit Motion-key drag, imports identity at 85-89). The lane body receives `railFrameCount` as a prop, so fixing the row fixes lane width, cell count and curve sampling in one place.
- View derivation call sites — store `app/src/stores/physicPaintStore.ts:1246-1257` (resolver built from `structural.loopResolution.ranges`, feeds the compositor via `_railMotionViewAtFrame`), row facts `PhysicsPaintTrackRow.tsx:430-441` (`getTrackRotoResolutionContext`), action state `useRotoTimelineActions.ts:2236-2240`. `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:404` deliberately passes no resolver: it reads only Key Rail first-key bindings (`view.loopId === null`), never a loop end. Do not change it.
- Tests — `railMotionIdentity.test.ts` helpers `loopClip` 61-72, `keyRailSegment` 74-86, `spanResolverFrom` 136-142; the finite-clip test at 381-394 currently asserts the key-count formula (`19`) and MUST be replaced; infinity tests 356-379 stay. `railMotionDocumentReconciler.test.ts` helpers `snapshot` 16-28 and `motion` 31-44; delete-only-key describe 155-166; split 168-184; merge 202-300. `railMotionGateBEdits.test.ts` helpers `seedBridgeDocument` 112-133, `launchBridge` 135-139, `bridgePayload` 141-165, `applyBridgePayload` 167-173, `canonicalPayload` 265-314, `documentSnapshot` 236-242, `undoAcceptedEdit` 245-258; `railMotion` helper 83-91 seeds one opacity key at frame 0. `railMotionCommands.test.ts` clamp describe ~742-860. `railMotionEvaluator.test.ts` lane-curve describe 302+. `TimelineMotionChannels.test.ts` out-of-band key test 478, header band test 899-910, purity pins 967-997. `timelineMotionSurface.contract.test.ts` component source helper 29-38.

Project skills: `efx-preact-reactivity` — only plain derived values change in components; no new signal, store write or effect, and no render-body signal writes. `efx-async-orchestration` — the conversion is already one awaited commit through the bridge; the reconciler change stays synchronous and pure, no timer, retry or queue.

Gates: `pnpm --filter efx-motion-editor exec vitest run <app-relative path>` and `pnpm --filter efx-motion-editor run typecheck`. Vitest collects only `src/**/*.test.ts`; the row suite runs through its import-only launcher `PhysicsPaintTrackRow.test.tsx.test.ts`. Never run Vitest in watch mode; never start the dev server.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: A Key Rail converted to a cycle keeps its motion through the real commit path</name>
  <files>app/src/components/physic-paint/roto/railMotionIdentity.ts, app/src/components/physic-paint/roto/railMotionIdentity.test.ts, app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts, app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts, app/src/lib/railMotionGateBEdits.test.ts</files>
  <behavior>
    - RED first (real transport, the end-to-end slice): seed real keys A..E and one animated Key Rail record (railId 'rail-1', anchor 'A', opacity keys at rail-local frames 0 and 4); launch the bridge; apply a loop-only payload that adds a Standard clip with `loopId 'loop-new'`, `placementStart` 0, `sourceKeyIds ['A','B','C','D','E']`, `repeat` 3, `mode 'progressive'`, unchanged records and NO `railMotions` member; the accepted store collection holds exactly one record whose railId is 'loop-new', whose anchor is 'A', and whose channels deep-equal the seed; one undo restores the 'rail-1' record byte-identically.
    - Classification: a prior Key Rail whose entire key set is owned by a NEW next Loop Clip, at the same placement start, with no next Key Rail segment sharing any prior key, is re-keyed — never classified delete-only-key; adoptedRailId, droppedRailId and droppedRailFrames stay null.
    - Not a conversion (fail closed, keys are never re-based): a next clip owning only some prior keys; a next clip whose placementStart differs from the prior segment's first key frame; a next clip whose placementStart is absent from the facts; and an edit that leaves a next Key Rail segment sharing a prior key each take an existing non-conversion classification.
    - Idempotent: reconciling the post-conversion collection against the post-conversion snapshot returns the same collection reference; a malformed collision where a record already carries the destination loopId leaves the collection unchanged (no duplicate railId, no deletion).
    - Transition: onConvertRailToLoopClip keeps channels and rail-local key frames verbatim, uses the loop's first source key as the recovery anchor, returns the same reference when railId already equals loopId, and returns the input when the source record is absent.
  </behavior>
  <action>
In `app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts` and `app/src/components/physic-paint/roto/railMotionIdentity.test.ts`, write the failing unit rows first: add a `describe('261107-rrp rail motion document reconciler — Key Rail to cycle conversion')` built on the existing `snapshot` and `motion` helpers (pass `loopClips` with `placementStart`), and a transition describe for `onConvertRailToLoopClip` (re-key, freeze, anchor, no-op, absent source, destination collision). In `app/src/lib/railMotionGateBEdits.test.ts`, add the real-transport describe inside the existing suite setup: seed with `seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] })` (extend the local `railMotion` helper only if the two-key fixture is needed), launch, build the loop-only payload with `bridgePayload(launchOperationId, { operationKind: 'create-loop', loopClips: [clip] })` and no `railMotions`, apply through `applyBridgePayload`, then assert the accepted collection, the drop-report nulls and one `undoAcceptedEdit` restoring the prior document. Confirm the new tests fail for the right reason before implementing.

In `app/src/components/physic-paint/roto/railMotionIdentity.ts`:
1. Export `onConvertRailToLoopClip(records, railId, loopId, anchorKeyId)` beside the other Gate B transitions. Return the input reference when `railId === loopId` or no record carries `railId`. When a record already carries `loopId`, return the input unchanged: never duplicate a railId and never delete the only copy. Otherwise map the source record in place to a frozen record with `railId: loopId`, the supplied recovery anchor, and the source `channels` reference verbatim. Mirror the doc-comment style of `onDeleteFirstKey`: identity changes, every rail-local key frame does not.

In `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts`:
2. Add `readonly placementStart?: number` to `RailMotionDocumentLoopClipFact`; the production documents passed by the bridge and coordinator carry the field.
3. Add the classification variant `{ kind: 'convert-rail-to-loop'; loopId: string; anchorKeyId: string }`.
4. Add `nextLoopClips` to `ClassifyInput` and pass `next.loopClips` at the call site. Add a module-local detector: iterate next clips, skip any id present in `previousLoopIds`, require `clip.placementStart === priorSegment.firstKeyFrame` (absent or different placement fails closed), build the clip's owned set through `collectRailMotionGroupOwnedKeyIds([clip])`, and require every `priorKeyIds` member to be owned. Anchor the transition on `clip.sourceKeyIds[0] ?? record.anchorKeyId`.
5. In `classifyRailMotionEdit`, place the conversion row after the orphan guard and after `successorSegments` is computed, only when `successorSegments.length === 0`, and BEFORE the delete-first-key and delete-only-key rows. Comment it as the cycle conversion: a mints-a-new-loopId identity change that must re-key rather than delete.
6. Add the switch case invoking `onConvertRailToLoopClip(working, record.railId, classification.loopId, classification.anchorKeyId)`; set `changed` only when the returned collection reference differs; leave adopted/dropped report fields untouched.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts src/components/physic-paint/roto/railMotionIdentity.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionGateBEdits.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>A loop-only conversion through the real bridge re-keys the animated Key Rail's record to the new loopId with every channel and rail-local frame intact; the record is active on the cycle rail; non-conversion edits, absent placement facts and destination collisions fail closed without deleting motion; one undo restores the prior railId; the reconciler, identity and Gate B suites plus typecheck are green.</done>
  <reversibility rating="reversible">One additive identity transition and one classification row; the persisted record shape and every existing classification are unchanged.</reversibility>
</task>

<task type="auto" tdd="true">
  <name>Task 2: A finite cycle's motion span is its resolved rail extent, and out-of-band keys are preserved</name>
  <files>app/src/components/physic-paint/roto/railMotionIdentity.ts, app/src/components/physic-paint/roto/railMotionIdentity.test.ts, app/src/components/physic-paint/roto/railMotionCommands.test.ts, app/src/components/physic-paint/roto/railMotionEvaluator.test.ts</files>
  <behavior>
    - RED first: a finite Loop Clip (placement 10, three source keys, repeat 3) with a resolver answering 40 ends its view at 40 instead of the key-count product 19; the Key Rail view in the same call is untouched.
    - No resolver answer for that loopId keeps the single-occurrence/key-count fallback (19); the infinity rows stay exactly as they are, including the rule that a resolver can never shorten an infinity clip below one occurrence.
    - Shrink and re-extend: the same frozen clips derived against resolver ends 12 then 40 produce ends 12 then 40, with no stored record involved and every view frozen.
    - railMotionViewFrameCount returns the non-negative floored band for a view pair, and 0 for a null view.
    - Policy at the command layer: with a 10-frame view, a cursor frame beyond the band maps to the last band frame and a frame before the start maps to 0; writing a key inside the band leaves a key at rail-local frame 20 byte-identical; a drag clamp whose band comes from the helper stops at frame 9.
    - Curve invariance: a channel with keys at 0 and 20 sampled over 20 frames and over 10 frames produces identical leading points for every frame inside the shorter band, and the shorter path ends at frame 9.
  </behavior>
  <action>
In `app/src/components/physic-paint/roto/railMotionIdentity.test.ts`, replace the test at 381-394 (its key-count expectation is the defect) with the finite-resolved, no-answer and shrink/re-extend rows from `<behavior>`, and add the helper row. Keep the infinity tests 356-379 and the resolver-shape tests untouched.

In `app/src/components/physic-paint/roto/railMotionIdentity.ts`:
1. In `deriveRailMotionRailViews` (242-247), resolve the clip end once: an `infinity` clip keeps `Math.max(fallbackEnd, resolver answer ?? fallbackEnd)` exactly as today; a finite clip uses the resolver's answer verbatim when it answers, otherwise the existing fallback. Add a short comment naming the authority: the resolved loop range is the same extent the rail and compositor draw, so a key count can never shorten or lengthen the lane.
2. Export `railMotionViewFrameCount(view)` accepting a `Pick<RailMotionRailView, 'startFrame' | 'endFrameExclusive'> | null` and returning 0 for null, else the non-negative floored difference. Put it next to `deriveRailMotionRailViews` and document it as the ONE band derivation for every consumer.

In `app/src/components/physic-paint/roto/railMotionCommands.test.ts`, add a `describe('261107-rrp motion span auto-fit policy')` using the existing `railView` helper and record fixtures: the cursor clamp rows, the preserved out-of-band key row, and a clamp row whose `frameCount` is `railMotionViewFrameCount(view)`.

In `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts`, add the curve-invariance row inside the existing lane-curve describe, asserting the shared-frame point equality and the shorter path's last x. No evaluator source change.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionIdentity.test.ts src/components/physic-paint/roto/railMotionCommands.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionEvaluator.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>A finite Loop Clip's derived view ends at the resolved span and tracks it when the cycle grows or shrinks; the fallback only applies when the resolver has no answer; infinity semantics are unchanged; cursor writes clamp into the resolved band while out-of-band keys survive byte-identically; the band helper and curve-invariance tests pass; the identity, commands and evaluator suites plus typecheck are green.</done>
  <reversibility rating="reversible">A single branch inside the existing view derivation plus one pure helper; the record shape, evaluator and persistence layer are untouched.</reversibility>
</task>

<task type="auto">
  <name>Task 3: Every band consumer reads the one helper, and the scope and contract are proven</name>
  <files>app/src/components/physic-paint/roto/railMotionCommands.ts, app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx, app/src/components/physic-paint/view/TimelineMotionChannels.tsx, app/src/components/physic-paint/view/TimelineMotionChannels.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts</files>
  <behavior>
    - The lane body, the header stack, the drag clamp/cursor writes and the motion-key drag validation all derive the band from railMotionViewFrameCount; no consumer keeps a private band computation.
    - The header group and the lane body render the same frame band for the same view, including a long resolved span, so a widened cycle cannot produce a short header over a long body or the reverse.
    - A source contract pin fails if any of the four consumers stops importing the helper, or if railMotionIdentity stops exporting it.
    - Existing Motion behavior is unchanged when the span already matched the fallback: lane key rendering, band filtering, click selection, drag clamp and purity pins stay green.
  </behavior>
  <action>
1. In `app/src/components/physic-paint/roto/railMotionCommands.ts:81`, replace the local band arithmetic in `railMotionCursorFrame` with `railMotionViewFrameCount(view)` and keep the existing clamp of the local frame to the last band frame. Import the helper from the existing identity import block.
2. In `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:629-631`, replace the local derivation in `TimelineMotionBlock` with `railMotionViewFrameCount(view)`; add it to the existing identity import.
3. In `app/src/components/physic-paint/view/TimelineMotionChannels.tsx:643-645`, replace the local derivation in `TimelineMotionHeaderGroup` with the helper, converting the type-only identity import into a value plus type import.
4. In `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:4209` and `:4261`, replace both local band subtractions in the Motion-key prepare and commit with `railMotionViewFrameCount(state.view)`; add it to the existing identity import beside `createRailMotionViewSpanResolver`.
5. In `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`, extend the header band test at 899-910 so the header's derived band equals `railMotionViewFrameCount` for a long resolved span (for example a view starting at 10 and ending at 46 yields 36 frames), keeping the null-view fail-closed assertion.
6. In `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts`, add a describe that reads the four consumer sources with the existing source helper and pins: each imports and calls `railMotionViewFrameCount`; `railMotionIdentity.ts` exports it; the strip, row, lane and actions modules contain no second band helper export. Do not add negative pins on incidental arithmetic; the import-and-call pins are the drift guard.
7. Do not touch `physicsPaintRotoRailSetCopy.ts` (anchor-only consumer), the evaluator, the store projection, the document model, the serializer or any CSS.

Then run every targeted suite, the full suite and typecheck. Run `git diff --name-only bebeb79b9 -- app/src` and confirm the output is exactly this plan's `app/src` paths; any path under `app/src/stores`, `app/src/efx-paint/document`, `src-tauri`, `railMotionEvaluator.ts`, `railMotionModel.ts` or a CSS file means the scope broke — stop and report instead of widening. If an unrelated failure appears, stop and report it; do not edit unrelated assertions.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/view/timelineMotionSurface.contract.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>git diff --name-only bebeb79b9 -- app/src</automated>
  </verify>
  <done>Lane width, header stack, curve sampling, drag clamp, cursor writes and drag validation all read railMotionViewFrameCount; the header and body bands agree for long resolved spans; the contract pins prove one authority; the full suite is green, typecheck clean, and the app source diff contains only this plan's files.</done>
  <reversibility rating="reversible">Mechanical adoption of a pure helper plus source pins; each site keeps its prior behavior for every span that already matched.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| document delta -> motion identity | The commit-point reconciler decides whether a stored motion record still describes a live rail; a wrong classification silently deletes or mis-binds user animation. |
| loop resolution -> view extent | A resolved range crosses from the physical resolver into the motion view; a wrong end makes the lane disagree with the compositor and the rail. |
| view extent -> band consumers | Lane geometry, header stack, drag clamp and cursor writes derive numbers from the view; drift between them lets a write land outside what the rail draws. |
| history/undo -> single commit | A conversion must be one document write; a second motion-only write would break undo/redo parity and the accepted revision. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261107-RRP-01 | Tampering | `classifyRailMotionEdit` conversion row | high | mitigate | Conversion requires every prior segment key owned by a NEW next clip, the same placement start, and zero successor Key Rail segments; absent or different placement fails closed. Non-conversion rows are tested explicitly. |
| T-261107-RRP-02 | Tampering | `onConvertRailToLoopClip` destination railId | medium | mitigate | The transition returns the input unchanged when the destination loopId already carries a record; the parser remains the final duplicate invariant; the cycle confirm already refuses keys owned by another clip. |
| T-261107-RRP-03 | Tampering | finite span adoption in `deriveRailMotionRailViews` | high | mitigate | The view end is the resolver's `effectiveEnd`, the exact value the rail and compositor draw; the key-count fallback applies only when the resolver has no finite answer, and the infinity `Math.max` rule is preserved. |
| T-261107-RRP-04 | Repudiation | shrinking a cycle loses motion keys | high | mitigate | Records are never rewritten on span changes; out-of-band keys stay byte-identical and inactive, and the shrink/re-extend plus curve-invariance tests pin restoration and shared-frame equality. |
| T-261107-RRP-05 | Tampering | band drift between consumers | medium | mitigate | One exported `railMotionViewFrameCount` is used by row, header, commands and actions; contract pins fail if a consumer stops importing it, and the header test pins the shared band. |
| T-261107-RRP-SC | Tampering | pnpm dependency installs | high | accept | No dependency is added, upgraded or installed by this plan; the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. Conversion end to end: `pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionGateBEdits.test.ts` — the loop-only payload re-keys the record to loop-new with channels intact, reports no drop, and one undo restores rail-1.
2. Reconciler and identity: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts src/components/physic-paint/roto/railMotionIdentity.test.ts` — conversion rows, fail-closed non-conversions, idempotence, the finite resolved span, the no-answer fallback, infinity semantics, helper rows.
3. Policy and curve: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts src/components/physic-paint/roto/railMotionEvaluator.test.ts` — cursor clamp, preserved out-of-band keys, helper-derived clamp band, curve invariance under shrink.
4. Consumers and contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` — header/body band agreement, existing lane behavior, one-authority pins, purity pins.
5. Actions: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — prepare/commit drag validation on the resolved band.
6. Full suite: `pnpm --filter efx-motion-editor exec vitest run` must end with 0 failed. Never watch; never start the server.
7. Typecheck: `pnpm --filter efx-motion-editor run typecheck` reports no errors.
8. Scope tripwire: `git diff --name-only bebeb79b9 -- app/src` lists only this plan's files; no evaluator, model, store, document, desktop or CSS path.

UAT rows the user will run after execution (live visible UAT; automated-green is not done):
- Convert an animated Key Rail into a Rail cycle: the motion dots and curve stay on the new cycle rail at the same rail-local frames with the same values, and no motion or warning is lost.
- Undo the conversion and redo it: the Key Rail and its motion return, and redo restores the cycle with motion still attached.
- Raise the cycle order: the motion lane extends to the new rail end and the repeat occurrences carry the animation instead of empty dotted placeholders.
- Animate an already-cycled rail and add motion keys in a later occurrence: the dots accept frames up to the rail end, and drag/click stay clamped inside the rail.
- Lower the cycle order, then raise it again: the lane shrinks with the rail, and re-extending restores the dots at their original rail-local frames with their values intact.
</verification>

<success_criteria>
- Adding a Rail cycle or Key Rail cycle to an animated rail preserves every motion channel, key, value, easing, wiggle and rail-local frame, re-keyed to the new loopId in the same commit, and one undo restores it.
- A finite Loop Clip's motion span is the resolved rail extent, so added motion spans the full repeated rail and track record dots appear up to the rail end.
- The span auto-fits both directions and every consumer reads the one derived frame count.
- Out-of-range motion keys are preserved but inactive; shrinking and re-extending the rail loses no key and does not change any frame that remains visible.
- No persisted schema, evaluator, store or compositor change; the app source diff is confined to this plan's files.
- Targeted suites, the full suite and typecheck are green; three atomic commits, one per task.
</success_criteria>

<output>
Create `.planning/quick/261107-rrp-cycle-with-motion-in-studio-adding-a-cyc/261107-rrp-SUMMARY.md` when done. Record the three task commits, the `convert-rail-to-loop` classification and `onConvertRailToLoopClip` transition, the placement-start guard, the finite resolved-span branch, `railMotionViewFrameCount` and its five consumers, the preserved-but-inactive policy, the real-transport conversion pin, the full-suite/typecheck results, the `git diff --name-only` scope result, and the UAT rows handed to the user.
</output>
