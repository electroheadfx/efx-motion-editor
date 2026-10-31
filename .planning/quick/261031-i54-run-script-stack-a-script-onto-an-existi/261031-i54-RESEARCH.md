# Quick Task 261031-i54: Run Script — stack a script onto an existing Paint rail — Research

**Researched:** 2026-10-31
**Domain:** Physic Paint Roto Loop Clip ("rail") in-place targeting + extend-only growth
**Confidence:** MEDIUM overall — every seam below was read this session (HIGH for in-repo facts); two behavioural questions (Keep-ON recording on a `keyScriptEdits`-off rail, and what "Overwrite" can physically mean) still need a locked decision (MEDIUM).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rename (Requirement 1)**
- Already completed in commit `0266a199d` and UAT-approved (`7cd1ecbf0`): Scripts panel button, Tools popover, Workflow strip labels/tooltips all read "Run Script"; the dialog title/button already read "Run Script".
- This task only verifies no user-visible "Create Rail" label remains. Internal code comments/types may retain historical naming; they are not user-visible.
- Load + Apply, Save/Delete script, and the script library format are untouched.

**Destination resolution**
- **Playhead membership only.** If the playhead sits inside exactly one rail's effective span — real key, generated frame, empty frame, or repeated occurrence — that rail is the target and the playhead maps to its source-cycle offset.
- Playhead outside every rail → today's create path, byte-identical to current Create Rail.
- Overlapping/ambiguous membership fails closed with a clear refusal reason.
- No "add to existing rail" option is added to the modal; the existing target selector is not extended.

**Position and role of the run**
- The playhead's cycle offset is the script's first output frame. A repeated occurrence maps through the resolver to the source cycle; the run writes source-cycle keys at their canonical physical frames, never into virtual occurrences.
- Keys before/after the touched span keep exact pixels and identities.
- Generated/interpolated frames become valid run starts **only when inside a rail**; outside a rail the existing `generated-interpolation` refusal stays.

**Extend only**
- If the run reaches beyond the rail's current cycle end, append new source-cycle keys and grow the cycle to the new length. Never shrink.
- Repeat count does not change; the rail re-resolves from the new cycle/cache, so a repeated rail's effective span grows by (repeat × cycle growth). Repeated occurrences are never materialized.
- Rail lifecycle must be updated (`originalEndExclusive`, `visibleRanges`, and any phase-relative extent) so the extended cycle belongs to the rail and repeats resolve. Infinity clips stay lifecycle-less per the existing parser contract.

**Keep script**
- New switch shown only when the destination is an existing rail; default ON.
- **ON:** append the new run's strokes per touched key to that key's existing recorded script and re-bake the union over the key's recovered pre-script durable base using the existing `aquarelleBaseRecovery` provenance gates. The key's committed pixels are not treated as the base; the recovered base is.
- If the durable base is unprovable, fail closed with a clear refusal — never guess.
- **The rail's persisted `keyScriptEdits` flag is never implicitly flipped.** Flipping it would make the base "known empty" and discard the original paint.
- **OFF:** replace the touched span's pixels and purge then replace the touched keys' recorded scripts with THIS run's slices only. Keys before/after keep their records. This is the explicit opt-out; never silently erase.
- Stacking is repeatable: running again appends/overlays again with no drift.
- "Save script on each key" remains the creation-time switch for new rails and is unchanged.

**Collision on extension**
- Collision check applies when the new cycle end would cross another rail's start or the parent end.
- **Other rail:** confirmation dialog with Cancel, Truncate (default), Overwrite.
  - Cancel: no writes.
  - Truncate: clip the run at the boundary; the target rail extends only to it; the other rail is untouched.
  - Overwrite: the target rail's span wins; the other rail is shortened or removed by the canonical Loop Clip model.
- **Parent end:** Truncate / Cancel only. Overwrite is not offered; extending the parent layer is out of scope.
- The whole operation is one atomic undo entry, including any other-rail change.

**Dialog readout**
- Before confirm the dialog shows the resolved span, the start offset (source cycle position), and the resulting extension/truncation.
- Max resolves to the free span before the collision boundary, not the whole capacity.

**Deferred to Quick B**
- Reveal rail stacking. Reveal rails will stack like Paint rails and Keep script will record the new strokes, which changes today's contract that Reveal keys are script-incapable. Extension of a Reveal rail must bake the new tail through the currently placed photo reference (same photo, new wash) and refuse with a clear reason when no reference is placed. Plain-paper keys must never be mixed into a Reveal rail.

### Claude's Discretion
- Exact preview copy and layout for the resolved-span/offset readout.
- Internal naming for the new controller state and pure helpers.
- Whether the collision check is a separate pure module or rides the loop resolver, as long as it uses the canonical 43-02 derivation and the same boundary authority.

### Deferred Ideas (OUT OF SCOPE)
- Reveal rail stacking and per-key script recording on Reveal rails (Quick B).
- Extending the parent layer / capacity.
- Changing the persisted script-library format, Load + Apply, Save/Delete script.
- Materializing repeated occurrences.
</user_constraints>

## Summary

Every mechanism this task needs already exists; the work is a **re-anchoring of the Play Script controller's `start`** from "the current selection" to "the target rail's source-cycle frame", plus one new pure extension/collision helper and one new script-union port. Today the whole dialog geometry, the confirm guard, the bake offset, the publication range and the loop preflight are all derived from `canonicalStart`, which `openConfirmation` sets to the authority's `canonicalStart` — i.e. the selected playhead frame ([VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:786] `canonicalStart.value = authority.canonicalStart;`).

Destination resolution is a solved problem: `derivePhysicPaintRotoLoopRanges` + `resolvePhysicPaintRotoLoopFrame` already return the owning `loopId`, `phaseOrigin`, `cycleLength` and — for non-real frames — `cycleOffset` and `repeatInstance`. The canonical write frame is therefore `phaseOrigin + cycleOffset` (first occurrence), never the virtual occurrence.

Three hard constraints shape the design:

1. **Extension is a lifecycle edit, not a key edit.** For a finite lifecycle clip `requestedEnd` and `naturalEnd` both read `originalEndExclusive` ([VERIFIED: …PhysicalResolver.ts:5551-5558]), so appending keys without growing `originalEndExclusive` + `visibleRanges` leaves them outside the rail. `updateLoop` already contains the exact extension algebra to copy ([VERIFIED: …PlayScriptController.ts:1283-1293]).
2. **The commit delta forbids structural removal.** `validatePlayScriptPhysicalDelta` requires every current record outside `[affectedStart, affectedEnd]` to be present and byte-identical, and `expectedLayerEndExclusive` is recomputed **from `delta.affectedStartAppFrame`** ([VERIFIED: physiopaintBridge.ts:1209-1215]). So "Overwrite" cannot delete another rail's source keys; it can only remove that rail's **clip** while its keys survive as ordinary keys.
3. **Keep script ON needs per-key union rebakes inside the same publication.** No such port exists: `recordRailKeyScripts` only purges-and-replaces after commit ([VERIFIED: PhysicsPaintStudio.tsx:3904-3915]).

**Primary recommendation:** implement this as three focused tasks — (1) pure resolution + extension/collision helpers with unit tests, (2) controller re-anchoring + publication + dialog readout, (3) Keep-script union port + Studio wiring. Do not attempt it as one task.

## A. Integration Seams and Current Contracts

### A1. Destination resolution (substrate exists, membership test does not)

`derivePhysicPaintRotoLoopRanges` returns one compact interval per visible fragment with `loopId`, `placementStart`, `phaseOrigin`, `cycleLength`, `sourceFrameCount`, `sourceKeyIds`, `sourceOffsets`, `repeat`, `requestedEnd`, `effectiveEnd`, `boundary`, `truncated`, `partialCycle`, `unresolved` ([VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5348-5374, 5613-5637]). For a finite lifecycle clip:

```
const requestedEnd: number | 'infinity' = lifecycleAvailable && finite
  ? clip.originalEndExclusive!
  : ...
const naturalEnd = lifecycleAvailable && finite
  ? clip.originalEndExclusive!
  : ...
```
[VERIFIED: physicsPaintRotoPhysicalResolver.ts:5551-5558]

Cycle math per frame ([VERIFIED: physicsPaintRotoPhysicalResolver.ts:5715-5717]):
```
const offset = appFrame - range.phaseOrigin;
const cycleOffset = offset % range.cycleLength;
const repeatInstance = Math.floor(offset / range.cycleLength);
```

**Gap:** `resolvePhysicPaintRotoLoopFrame` returns `'real'` first and real frames carry **no `loopId`** ([VERIFIED: …PhysicalResolver.ts:5681-5684]). Destination resolution therefore needs a real-key membership test on top: find the rail whose `sourceKeyIds` contains that `keyId` **and** whose effective span contains the frame. Rails that share an identical ordered source cycle (allowed by the model — `validatePhysicPaintRotoGroupReferences` only refuses non-identical sharing, [VERIFIED: physicsPaintRotoPhysicalModel.ts:1586-1590]) make that frame genuinely ambiguous. Per the locked law, fail closed with a reason naming both rails.

Recommended pure helper (discretion area, but keep it in the resolver module so it uses the canonical derivation):

```
resolveRunScriptDestination({ identities, loopClips, capacity, interpolationEnabled, appFrame })
  → { kind: 'rail', loopId, phaseOrigin, cycleLength, cycleOffset, repeatInstance, runStart }
  | { kind: 'none' }
  | { kind: 'ambiguous', loopIds }
```

### A2. The dialog/controller start anchor — the central refactor

| Site | Today | Needed for a rail destination |
|---|---|---|
| `disabledReason` | refuses any `generated-interpolation` selection [VERIFIED: …PlayScriptController.ts:486] | keep the refusal only when destination = `none` |
| `openConfirmation` | `canonicalStart = authority.canonicalStart` from the playhead [VERIFIED: :786]; preflight snapshot from that authority [VERIFIED: :789-794] | resolve destination from the identities-only snapshot + `ports.getRotoLoopClips()`, then set `canonicalStart = runStart` |
| `destinationRange` | `F${start}–F${start + count - 1}` [VERIFIED: :504-508] | same formula, `start = runStart`; add the source-cycle offset to the readout |
| `loopReadout` | derives requested/effective from `canonicalStart` + `layerEndExclusive` [VERIFIED: :584-596] | must not claim "shortened by the next clip" for the target rail (D-24 self-exclusion already prevents that) |
| `loopShortenPreflight` | `derivePhysicPaintRotoLoopShortenPreflight({destinationStart: start, destinationCount: count})` [VERIFIED: :546-553] | still correct, but the **collision** decision needs the extension-aware helper (A4) |
| `Max` | `capacity.value` from the playhead [VERIFIED: :491-492] | free span before the collision boundary |
| confirm guard | `startingSelection.appFrame !== start` refuses [VERIFIED: :1674] | relax only when a rail was resolved at open |
| confirm authority | `requestAuthority(nextOperationId('confirm'), start)` [VERIFIED: :1681] | request at `runStart` (the bridge derives its expected layer end from `affectedStart`, A6) |
| pre-commit selection check | refuses `generated-interpolation` and `appFrame !== start` [VERIFIED: :1824-1829] | relax the same way; keep the preset/identity checks |
| bake | `bakeAquarelleScript({ snapshot, count, start, … })` [VERIFIED: :1792] | pass `runStart` so staged frames line up with `buildPhysicalPublication`'s `start + index` |
| publication | `buildPhysicalPublication({ start, count })` builds `targetAppFrames = start + index` [VERIFIED: :2521-2531] | unchanged, given `start = runStart` |

`buildPhysicalPublication` already preserves occupied `keyId`s ([VERIFIED: :2562-2568] `const keyId = existing?.keyId ?? createPhysicPaintRotoKeyId();`) and selects `affectedStartAppFrame` ([VERIFIED: :2603-2604]). For stacking, set `preserveSelection: true` in the semantic delta so the playhead does not jump to `runStart` — the flag is already legal and honoured in both validators ([VERIFIED: app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:939-944], [VERIFIED: app/src/lib/physicPaintBridge.ts:1205-1219], [VERIFIED: app/src/types/physicPaint.ts:1102]). Note: `preserveSelection` has never been used together with a non-empty affected range — pin it with a test.

### A3. Extend only — cycle growth

Current cycle end = `phaseOrigin + cycleLength`. If `runStart + count > phaseOrigin + cycleLength`, the appended frames become new source keys at `phaseOrigin + cycleLength … runStart + count - 1` (contiguous after the last source key, which is exactly `phaseOrigin + cycleLength - 1` by the `cycleLength` definition [VERIFIED: …PhysicalResolver.ts:5539-5541]).

Lifecycle update (copy `updateLoop`'s algebra, [VERIFIED: …PlayScriptController.ts:1271-1298]):
```
const originalEndExclusive = Math.min(target.phaseOrigin + newCycleLength * target.repeat, snapshot.capacity);
const visibleRanges = target.visibleRanges.flatMap(...)        // clip to the new end
if (originalEndExclusive > target.originalEndExclusive) {
  const last = visibleRanges[visibleRanges.length - 1];
  if (last?.endExclusive === target.originalEndExclusive) visibleRanges[...] = { ...last, endExclusive: originalEndExclusive };
  else visibleRanges.push({ start: target.originalEndExclusive, endExclusive: originalEndExclusive });
}
```
Creation precedent for the same shape: `buildNewLoopLifecycle` ([VERIFIED: :2492-2508] `const endExclusive = Math.min(placementStart + cycleFrameCount * repeat, capacity);`).

Hard invariants that will bite:
- `originalEndExclusive <= phaseOrigin` is refused by the parser ([VERIFIED: physicsPaintRotoPhysicalModel.ts:813] `if (originalEndExclusive <= phaseOrigin) return false;`) → a rail can never be shortened to 0 by editing its end; removal is the only zero representation.
- `originalEndExclusive > capacity` refuses the whole document ([VERIFIED: physicsPaintRotoPhysicalModel.ts:1565-1567] `throw new Error(\`PhysicPaintRotoPhysicalDocument: Group "\${clip.loopId}" exceeds capacity.\`);`).
- New keys must join `sourceKeyIds`; owned keys are excluded from the rail's own D-24 boundary scan ([VERIFIED: …PhysicalResolver.ts:5542-5545, 5582-5586]), so unlisted new keys would truncate the rail itself.
- Infinity clips carry no lifecycle ([VERIFIED: :5551-5558] `lifecycleAvailable` gate) — skip the lifecycle edit entirely, matching `buildNewLoopLifecycle`'s `if (repeat === 'infinity') return null;`.
- Repeat multiplies the growth: `originalEndExclusive = phaseOrigin + (cycleLength + growth) * repeat`. A repeat-5 rail gaining 2 frames gains 10 frames of span.

### A4. Collision authority

The collision boundary is the same D-24 algebra the resolver already computes: first non-owned real key at/after the scan point, another loop's `placementStart` strictly after it, or parent end ([VERIFIED: …PhysicalResolver.ts:5570-5593]). `derivePhysicPaintRotoLoopShortenPreflight` already builds the "after" identities by synthesizing a non-owned key at every destination frame ([VERIFIED: :5923-5945]) — the same trick works for the extension window.

Recommended (discretion) shape: one pure helper

```
resolveRunScriptExtension({ identities, loopClips, capacity, interpolationEnabled, targetLoopId, runStart, count })
  → { newCycleLength, newOriginalEndExclusive, growthFrames,
      collision: null | { kind: 'other-rail' | 'parent-end', frame, loopIds }, freeCount }
```

`freeCount` is what `Max` must resolve to. Cross-check by building a draft clip with the extended lifecycle and re-deriving: any other rail whose `effectiveEnd` shrinks is a collision victim. Do **not** hand-roll boundary math — the 43-02 derivation is the contract (CONTEXT explicitly allows either module placement, not either arithmetic).

**"Overwrite" can only mean remove the other rail's clip.** Structural facts:
- `validatePlayScriptPhysicalDelta` refuses any out-of-range record change ([VERIFIED: physicPaintBridge.ts:1247-1257]) → the other rail's source keys cannot be deleted in the same commit.
- Occupied frames keep their `keyId` ([VERIFIED: :1264-1265] `if (proposed.keyId !== current.keyId) return 'Play Script changed an occupied destination keyId.';`), so writing over another rail's keys reuses their identity and merely rewrites their pixels.
- A rail whose start is crossed cannot be "shortened" — shortening trims the end, and `originalEndExclusive <= phaseOrigin` is illegal (A3).
- `unlinkLoop` is the clean remove primitive: it drops only the record and keeps source keys as ordinary keys ([VERIFIED: …PlayScriptController.ts:1312-1317]). `proposePhysicPaintRotoDeleteGroup` would additionally delete unshared keys ([VERIFIED: physicsPaintRotoGroupLifecycle.ts:665-689] via `cleanupCandidates`) — unusable here because of the record-preservation rule.

So Overwrite = drop the other clip from `loopClips` in the same publication; its keys survive as ordinary keys and any that fall inside the affected range are overwritten by the run. The "shortened" half of the locked wording is not representable; this is the one clause that needs a user decision (see Open Questions).

### A5. Keep script (ON / OFF)

Current seams:
- Controller port: `recordRailKeyScripts?: (input: { keyIds; slices }) => void` ([VERIFIED: …PlayScriptController.ts:275-278]); called after a successful commit only when a clip carries `keyScriptEdits === true` ([VERIFIED: :2017-2037] `const preserveKeyScripts = (loopClips ?? currentLoopClips()).some(...)` … `ports.recordRailKeyScripts?.({ keyIds: cycleKeyIds, slices: keyScriptSlices });`).
- Studio implementation: purge then pin known-empty then record ([VERIFIED: PhysicsPaintStudio.tsx:3901-3916]):
```
purgeAquarelleFrameScript(slice.frame);
aquarelleDurableBaseByKeyRef.current.set(keyId, null);
```
- Slice law: static = full drawing on every key; progressive = cumulative strokes started by that slot; `playFrame` equals the key frame ([VERIFIED: physicsPaintRotoRailKeyScripts.ts:20-32, 55-77]).
- Base recovery: `ensureAquarelleDurableBaseRef` pins `recovery.kind === 'empty' ? null : recovery.bytes` into the session map, and adopts `null` when there are no committed pixels ([VERIFIED: PhysicsPaintStudio.tsx:6587-6705]).
- Rebase composite: `composeRotoScriptRebakeFrame({ durableBaseBytes, sheetBytes, appFrame, size })`, null = fail closed ([VERIFIED: PhysicsPaintStudio.tsx:1983-2021]).
- The durable base is **persisted**, not session-only: SNAP v5 carries a durable-base section keyed by keyId (state 0 = known empty) ([VERIFIED: performance/studioScriptSnapshotCodec.ts:83-90]; restored into the map at [VERIFIED: PhysicsPaintStudio.tsx:1266-1279]).
- Rail ownership today: `railScriptOwnsKey` = `clip.keyScriptEdits === true && clip.sourceKeyIds.includes(keyId)` ([VERIFIED: PhysicsPaintStudio.tsx:3363-3366]); a source occurrence with flag-off resolves its base to the **source key payload** ([VERIFIED: :3433-3438] `durableBaseKeyId: target.sourceKeyId`).

Two viable ON implementations, and they differ materially:

- **Rail already `keyScriptEdits === true`:** base is known-empty, so union rebake = bake the union sheet from scratch, publish it raw, then purge+record the union. Uses existing machinery.
- **Rail with `keyScriptEdits` absent (the normal painted rail):** keys have no records, so they have no committed-pixel composite; the recovered base **is** the current payload (`prepareRotoScriptTarget`'s rule: "The key record payload IS the pre-script cache here" [VERIFIED: PhysicsPaintStudio.tsx:3404-3405]). ON = composite the union sheet over that base. Writing records here creates the doubling hazard: after reopen `railScriptOwnsKey` is false → base = source payload = composite → next edit re-composites the script over its own output.

Recommended: ON writes records **only** on flag-on rails, and on flag-off rails performs the pixel composite without writing records (the union-over-recovered-base result the CONTEXT demands is identical; the "append to that key's existing recorded script" clause is vacuous because no record exists). The alternative — record anyway and make `prepareRotoScriptTarget` prefer the persisted durable-base map for source occurrences — closes the hazard but changes a fail-closed authority path for every rail. Both are schema-free; the second should be a follow-up, not this quick task (see Open Questions).

**Union rebake mechanics (feasible today).** Existing events come from `getAquarelleEventsForFrame(frame)` (payload events, Dry included) ([VERIFIED: view/aquarelleRecordState.ts:1688-1696]); new strokes convert with `toStudioStroke` (the same projection the record path uses — `payloadTimeline.push(toStudioStroke(recorded))` at [VERIFIED: :1290-1292], exported from `@efxlab/efx-watercolor/payload`, imported at [VERIFIED: :14-26]). Bake with `bakeAquarelleEventsToFrame({ events, size, paper })` ([VERIFIED: …PlayScriptController.ts:2160-2222]) — one engine creation per touched key, so cost is O(touched keys) full replays; gate the confirm behind progress, as the create path already does.

**OFF** is already implemented in the only way that matters: replace the pixels and purge+replace the records. The creation path's `recordRailKeyScripts` purges first, so "purge then replace" is the existing primitive; the only change is to call it for flag-off rails too (today it is gated by the persisted flag at :2017-2019).

### A6. Atomic undo

One `replace-roto-physical-map` accepted command = one ledger/history entry; loopClips ride the same publication ([VERIFIED: …PlayScriptController.ts:1927-1961] live-clips mapping + `loopClips` on the publication; [VERIFIED: app/src/lib/physicPaintBridge.ts:2033-2060] commit recording). Play-script is **not** in `GROUP_LIFECYCLE_OPERATION_KINDS`, so the parent never recomputes lifecycle for these clips ([VERIFIED: physicPaintBridge.ts:1371, 1546] `if (!GROUP_LIFECYCLE_OPERATION_KINDS.has(payload.operationKind)) return null;`). Consequence: the controller is the sole author of the target rail's new lifecycle and of the removed other-rail clip — correct for a one-entry undo, but it means the target lifecycle must be self-consistent **before** commit (the parser runs on the staged document).

`expectedLayerEndExclusive` is derived by the parent **from `delta.affectedStartAppFrame`** ([VERIFIED: physicPaintBridge.ts:1209-1215]), and the coordinator additionally requires `delta.expectedLayerEndExclusive > delta.affectedEndAppFrame` ([VERIFIED: useRotoPhysicalEditCoordinator.ts:947]). With `affectedStart = runStart`, the confirm-time authority request must be made at `runStart` (A2), or the expectations mismatch.

A separate undo gap to state explicitly: per-key aquarelle records live in a module-level timeline outside the physical document. They are not covered by Undo. The create path already records **after** a successful commit; the stacking path must do the same, accepting that Undo restores pixels (via history replay) but leaves the recorded scripts in place — the same asymmetry the create path has today. Do not try to make the records transactional in this task.

### A7. Rename verification

No user-visible "Create Rail" remains: every hit is an internal comment or a test comment ([VERIFIED: grep over app/src — PhysicsPaintStudio.tsx:751/3965/4026/4425/9858, controller comments, model/railKeyScripts comments, tests]). The live labels already read "Run Script" ([VERIFIED: view/PhysicsPaintScriptsPanel.tsx:180], [VERIFIED: view/PhysicsPaintPlayScriptDialog.tsx:454, 855], [VERIFIED: view/PhysicsPaintWorkflowStrip.tsx:1682-1703]). Requirement 1 is a no-op verification row.

## B. Test Impact

Tests that pin laws this task intentionally changes (must be updated deliberately, each with a stated new law):

| Test | File:line | Why it changes |
|---|---|---|
| `requires a durable row but permits an empty canonical start and rejects generated starts` | physicsPaintRotoPlayScriptController.test.ts:278-289 | generated start becomes legal when the playhead resolves into a rail |
| `clamps a finite Repeat that runs past the parent end into the created Group lifecycle` | :710-749 | unchanged law, but the expected lifecycle shape is now also produced by the extension helper — keep untouched if the create path is not refactored |
| `re-applying the same static/hold generation to the same inputs produces a byte-identical publication` | :1153 | stacking is deliberately non-idempotent (run twice = more paint); keep the create-path test, add a stacking counterpart |
| `261030-np9: records each key's slice … only for an opted-in cycle` | :3133-3195 | Keep-script OFF must now record on non-opted-in rails; ON/OFF semantics diverge from the creation switch |
| `261030-ig0: writes keyScriptEdits on a NEW-loop Apply only when the toggle is on` | :2986-3036 | the stacking path must never write the flag (new assertion) |

Tests that must stay untouched (they pin laws this task relies on):
- `physicsPaintRotoLoopResolver.test.ts:355-438` (D-24 boundary algebra; `356` non-owned real key truncates / re-expands), `:440-498` (D-14 loop-loop priority), `:419` (0f survives D-08), `:499-546` (infinity bounds).
- `physicsPaintRotoPlayScriptController.test.ts:1020-1152` (one history command per generation), `:1186-1293` (D-06 shorten preflight, including `:1274` self-exclusion), `:2826-2960` (loop persistence / link-to-existing-cycle), `:2511-2532` (unlink keeps keys), `:2571-2598` (same-start and overlap refusal).
- `physicsPaintRotoRailKeyScripts.test.ts:38-146` (static/progressive cumulative law).
- `physicsPaintRotoPhysicalModel.test.ts` lifecycle/capacity/parser pins — especially `originalEndExclusive <= phaseOrigin` and `> capacity`.

New tests this task needs (Wave 0 for the quick task):
1. Pure destination resolution: real source key, generated frame inside a rail, empty frame inside a rail, repeated occurrence → `runStart = phaseOrigin + cycleOffset`; outside every rail → `none`; two rails sharing a source cycle → `ambiguous`.
2. Pure extension: growth with repeat 1 and repeat 5; parent-end clamp; other-rail start crossing; infinity (no lifecycle).
3. Controller: open on a rail destination sets `start = runStart`, `Max` = free span, confirm requests authority at `runStart`, publication has `affectedStart = runStart` + `preserveSelection`, one history entry.
4. Keep ON union: flag-on rail → purge+record union; flag-off rail → no records, pixels composited over the recovered base; unprovable base → refusal with a reason and zero mutations.
5. Keep OFF: records replaced with this run's slices, keys before/after untouched.
6. Overwrite: other clip removed in the same publication, out-of-range records byte-identical, undo restores the other clip.
7. Rename: no user-visible "Create Rail" (one cheap assertion).

## C. Feasibility Risks and Task Split

| # | Risk | Verdict |
|---|---|---|
| C1 | Appending keys after the last source key with repeat > 1 | **Feasible** — append contiguous keys at `phaseOrigin + cycleLength …`, join `sourceKeyIds`, recompute `originalEndExclusive = min(phaseOrigin + newCycleLength × repeat, capacity)`, extend `visibleRanges` exactly like `updateLoop`. Main trap: repeat multiplies the span, so the parent-end clamp must truncate the **run**, not clamp the lifecycle silently (silent clamping would create a partial cycle the user did not ask for). |
| C2 | Atomic Overwrite of another rail in the same commit | **Partially feasible** — clip removal is atomic and schema-free; deleting that rail's source keys is refused by the delta validator; "shortening" a start-crossed rail is not representable. Requires a locked decision. |
| C3 | Staged bake + commit revalidation for a non-selection start | **Feasible** — bake at `runStart`, request confirm authority at `runStart`, relax the two selection guards for rail destinations, add `preserveSelection`. The generated-frame refusal must stay for `none`. |
| C4 | Keep ON base/flag hazard | **Feasible schema-free** — flag-on: known-empty base, union rebake; flag-off: composite over the recovered base, no records. Recording on flag-off rails needs a `prepareRotoScriptTarget` lookup change to survive reopen. |
| C5 | Per-key union rebake cost | **Real** — one engine creation + full union replay per touched key. A 20-key rail = 20 bakes. Progress reporting already exists in the bake path; reuse it, and gate the confirm. |
| C6 | Script records are outside the undo ledger | **Known asymmetry**, identical to the create path. State it; do not fix it here. |
| C7 | Dialog state interactions | **Manageable but easy to miss**: `Cycle` (repeat) is meaningless for a rail destination; `identicalSourceCycle` / `linkChoice` describe creating a *new* rail and must be suppressed; `loopShortenPreflight` must not warn about the target rail (already self-excluded) and a new extension readout replaces it for rail destinations. |

**Task split verdict: one task is not realistic; two is tight. Recommend three.**

- **Task 1 (pure, no UI):** destination resolution + extension/collision helpers in the resolver module, plus their unit tests. No controller/Studio change, so today's behaviour is provably untouched.
- **Task 2 (controller + dialog):** re-anchor `start`, rail-destination branch, extension publication (records + lifecycle + other-rail clip removal), readout (`resolved span`, `start offset`, extension/truncation), `Max` = free span, collision choice (Truncate default / Cancel / Overwrite), `preserveSelection`. Keep-unaware: the OFF path (records replaced) can land here because `recordRailKeyScripts` already exists.
- **Task 3 (Keep ON):** union read + per-key rebake + base recovery + fail-closed reasons + the new port, Studio wiring, and the flag-on/flag-off split.

If the user insists on two tasks, fold Task 3 into Task 2 only by dropping Keep-ON to a disabled switch in the same commit — do not ship a switch that silently no-ops.

## D. Persisted Schema / Format

**No persisted schema or format change is required.** Everything rides existing optional fields:
- `keyScriptEdits` is already an optional, fingerprint-excluded flag ([VERIFIED: physicsPaintRotoPhysicalModel.ts:337-343]; excluded at [VERIFIED: :1517]); this task only reads it.
- Lifecycle fields (`phaseOrigin`, `originalEndExclusive`, `visibleRanges`, `frameOverrides`) are the existing six-member all-or-nothing set ([VERIFIED: :801-846]); extension rewrites values, not shape.
- The durable-base section of SNAP v5 already persists per-key bases and the known-empty marker ([VERIFIED: performance/studioScriptSnapshotCodec.ts:83-90]) — nothing new to write.
- loopClips already ride the play-script publication ([VERIFIED: app/src/lib/physicPaintBridge.ts:1226] loop-only requires them; general play-script accepts them).

The only design that would need a schema change is "persist a per-key 'this rail owns this key's script' fact" to disambiguate flag-off rails with records. Do not add one; the recommended ON split avoids needing it. If planning concludes otherwise, STOP and report per CONTEXT.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | "Overwrite" is implemented as removing the other rail's clip (keys survive as ordinary keys), because record deletion and start-shortening are both unrepresentable | A4, C2 | The dialog copy would promise shortening that never happens; user-facing contract violation |
| A2 | Keep-ON on a `keyScriptEdits`-off rail composites over the recovered base but writes **no** records | A5, C4 | If the user expects records to exist there, a later script edit will not replay the stacked strokes |
| A3 | The run's first output frame is `phaseOrigin + cycleOffset` for a repeated occurrence; the visible change also appears at the playhead | A1 | Wrong destination writes; the one-source-cycle law would be broken |
| A4 | `preserveSelection: true` is acceptable with a non-empty affected range | A2, A6 | Playhead would jump to `runStart`; undo/selection behaviour differs from the dialog promise |
| A5 | Collision "cross" is measured on the **new cycle end** (`phaseOrigin + newCycleLength`), while the parent-end limit is measured on the **new `originalEndExclusive`** (`× repeat`) | A3, A4 | Max would over-promise for repeated rails |

## Open Questions

1. **Overwrite semantics.** What we know: the other rail's clip can be removed atomically; its keys cannot be deleted; a start-crossed rail cannot be shortened. What is unclear: whether the user accepts "Overwrite = that rail disappears (its keys become ordinary keys and inside the run they show the run's pixels)". Recommendation: lock Overwrite = remove the clip; replace "shortened" in the copy with "removed".
2. **Keep-ON recording on flag-off rails.** What we know: the doubling hazard is real and reopen-reachable; the durable base is persisted. What is unclear: whether the CONTEXT intends records to be written on flag-off rails. Recommendation: no records on flag-off rails in this task; if records are wanted, plan the `prepareRotoScriptTarget` map-first change as a separate task.
3. **Linked rails sharing a source cycle.** At the shared physical source frames two rails claim membership. Recommendation: fail closed and name both rails (locked ambiguity law); do not silently pick the earlier `placementStart`.
4. **Count default for a rail destination.** Today `countText` opens at `'3'`; Reveal opens at the script's natural duration ([VERIFIED: …PlayScriptController.ts:801, 810]). Recommendation: default to the script's natural duration for a rail destination and let the user shorten — it matches "run the script".

## Environment Availability

No external dependencies: pure TypeScript changes against installed workspace packages (`@efxlab/efx-watercolor` already imported by the record state). No package installs → **Package Legitimacy Audit not applicable**. Test runner: `pnpm vitest run` only (never watch); the vitest suite collects `*.test.ts` (a `.test.tsx` target alone runs nothing — see project memory `project_vitest_collects_test_ts_only`).

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest (existing monorepo config) |
| Quick run | `pnpm vitest run app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.test.ts` |
| Controller run | `pnpm vitest run app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` |
| Phase gate | `pnpm vitest run` (full) before UAT |

Manual-only: the visible stacking result (pixels, rail band, repeated-span growth) — the user runs the app; this task must never start the server.

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `disabledReason` (478-488), `destinationRange` (504-508), `loopShortenPreflight` (537-556), `loopReadout` (557-597), `openConfirmation` (775-833), `updateLoop` (1227-1310), `unlinkLoop` (1312-1318), `confirmGeneration` (1638-2062), `bakeAquarelleEventsToFrame` (2160-2222), `buildNewLoopLifecycle` (2492-2508), `buildPhysicalPublication` (2510-2606).
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — range record (5348-5374), derivation (5488-5648), per-frame resolution (5655-5784), shorten preflight (5910-5959).
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — loop clip fields (305-360), lifecycle validator (801-846), reference validator (1546-1593).
- `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts` — delete-group (665-689), delete-rails (934-1004).
- `app/src/lib/physicPaintBridge.ts` — `validatePlayScriptPhysicalDelta` (1190-1281), lifecycle-kind guard (1371, 1546), commit/history (2033-2060).
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — `validatePlayScriptInput` (925-997).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — apply publish branches (1970-2077), `prepareRotoScriptTarget` (3346-3470), `recordRailKeyScripts` (3895-3918), durable-base recovery (6587-6705).
- `app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.ts` (20-77), `app/src/components/physic-paint/view/aquarelleRecordState.ts` (1194-1215, 1268-1294, 1688-1696), `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` (83-90).
- Test files listed in section B.

### Secondary (MEDIUM confidence)
- `.planning/quick/261031-i54-…/261031-i54-CONTEXT.md` — locked user decisions (the only source for intended behaviour).

## Metadata

**Confidence breakdown**
- Standard stack: HIGH — no new libraries; every API cited was opened this session.
- Architecture: MEDIUM — the re-anchoring and extension algebra are pinned by source, but the Overwrite and Keep-ON-record questions change the shape.
- Pitfalls: HIGH — invariants (`originalEndExclusive > phaseOrigin`, `<= capacity`, out-of-range record preservation, occupied-keyId reuse, flag-off doubling) are read from validators, not inferred.

**Research date:** 2026-10-31
**Valid until:** ~30 days (stable, internal); re-verify if the Play Script controller or the physical delta validator changes.
