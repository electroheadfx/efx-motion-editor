---
phase: 261031-vbo-task-quick-c-run-script-merge-result-bec
plan: 01
subsystem: physic-paint / roto loop clips (Run Script stacking)
tags: [preact-signals, roto, loop-clips, run-script, standard-rail, presentation, vitest]
requires:
  - quick: 261031-i54 (Quick A — stack a script onto an existing Paint rail)
    provides: stack destination resolution, collision/extend-only law, Keep 2x2, one atomic undo
  - quick: 261031-qps (Quick B — Reveal adoption on a stack)
    provides: reveal bake tail, reload round-trip, acknowledgements
  - quick: 261030-v1t
    provides: Group Regenerate lifecycle shape and the per-key frozen settings
provides:
  - buildStandardStackedLoopClip whitelist merge projection and isStandardMergedLoopClip
  - "'standard' presentation lifecycle, Standard labels, merged status/regenerate/replay copy, no dot"
  - gray #9CA3AF Standard rail line in the active lane and on non-active rows
  - merged-rail Regenerate/Replay refusal at both entry points with zero writes
  - Standard classification for delete scope and rail-set copy
  - stack dialog copy stating the merge result is one Standard Rail
affects: [physic-paint roto rails, run-script dialog, Regenerate, delete copy, rail CSS]
actuals:
  tokens: 22617
  tasks: 3
  commits: 3
plan_head_before: f67b27d302179ffad8ef446b906fd78b3f151b60
plan_head_after: c76ba561f8ac78b576a192445dae2b8548762b17
tech-stack:
  added: []
  patterns:
    - 'Whitelist merge projection: an explicit object literal, never a spread of the destination'
    - 'One presentation classifier (classifyLoopClipRailKind) drives the active lane and the rows'
    - 'Standard is expressed by ABSENT provenance/railKind, never by a stored rail type'
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
    - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
key-decisions:
  - 'A Run Script stack is a merge of results: every destination becomes ONE Standard Rail in the same atomic commit.'
  - 'The destination picture, cycle/repeat and lifecycle survive; the run composites over them.'
  - 'scriptId, motion, overrideColor, railKind, colorize, colorizeMix and photoWiggle are dropped; the required mode keeps the destination value internally.'
  - 'Regenerate and Replay are refused with a merged-rail reason before any lifecycle/provenance branch.'
  - 'No persisted schema change: Standard is a provenance-free playscript clip the existing parser already accepts.'
metrics:
  duration: 19min
  completed: 2026-10-31
status: complete
---

# Phase 261031-vbo Plan 01: Run Script merge result becomes a Standard Rail

A Motion, Static, Reveal or already-Standard rail that receives a Motion or Static run now commits ONE Standard Rail — destination picture and cycles preserved, single-script/reveal identity dropped in the same atomic commit — presented gray, with Regenerate and Replay refused.

## Performance

- **Duration:** ~19 min (plan finalized at `f67b27d30` 23:07 to final commit 23:26, local time)
- **Started:** 2026-10-31T23:07:04+01:00
- **Completed:** 2026-10-31T23:26:43+01:00
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- The stack merge is now a whitelist projection: `buildStandardStackedLoopClip` emits only loopId, placementStart, repeat, a frozen copy of the merged sourceKeyIds, the destination's stored `mode`, the optional `keyScriptEdits`/`paintSeedVariation` flags when true, and the destination's six lifecycle members (a non-null lifecycle plan wins; a null plan preserves them). No spread of the destination exists, so `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix` and `photoWiggle` are absent as own properties.
- A `standard` presentation lifecycle now flows from one classifier (`classifyLoopClipRailKind`) through both rail hosts: 'Standard Rail', 'Type: Standard', source label and status 'Merged rail — multiple scripts.', no lifecycle dot, merged Regenerate/Replay reasons, and a neutral gray `#9CA3AF` line (hover `#D1D5DB`) with selected/unresolved/action-linked restated for both modes. Typed (purple/cyan) and reveal (blue) rails are unchanged.
- Regenerate refuses a merged rail at both entry points — `groupRegenerateReason` (before the lifecycle-shape check, so canonical and infinity merges both report the merged reason) and `openSourceEdit` (the dialog's trigger, before its lifecycle-shape branch) — with zero writes.
- Delete scope/success copy and the rail-set copy mapper classify the clip instead of reading `mode`, so a merged rail says Standard everywhere; typed rails keep Motion/Static/Key copy.
- The stack dialog's Rail Type helper now reads 'This run merges into the rail — the result is one Standard Rail.'

## Task Commits

Each task was committed atomically (code only):

1. **Task 1: One stack run commits a Standard Rail and the active-lane rail paints it gray, end to end** — `0bf377a63` (feat)
2. **Task 2: Non-active rows show the same Standard rail and Regenerate refuses merged rails** — `9752d6567` (feat)
3. **Task 3: Stack dialog copy and the merged-rail laws are pinned** — `c76ba561f` (feat)

## Merge law (whitelist) and dropped fields

`buildStandardStackedLoopClip({ target, mergedSourceKeyIds, lifecycle })` returns exactly:

- `loopId`, `placementStart`, `repeat` — the destination's rail geometry (repeat unchanged; cycle growth comes from the plan's lifecycle only)
- `sourceKeyIds` — `Object.freeze([...mergedSourceKeyIds])`, the merged run result (target's cycle + run slices)
- `mode` — the destination's stored value; internal schema requirement, never presented as a rail type
- `keyScriptEdits` / `paintSeedVariation` — only when the destination carried `true`
- the six lifecycle members (`syncState`, `provenanceState`, `phaseOrigin`, `originalEndExclusive`, `visibleRanges`, `frameOverrides`) copied when present, then overridden by `...(lifecycle ?? {})`

Dropped in the same atomic commit: `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix`, `photoWiggle`.

## Presentation

- `RotoRailKind = 'playscript' | 'reveal' | 'standard'`; the stored-field classifier is narrowed to `StoredRotoRailKind = Exclude<RotoRailKind, 'standard'>`, and `classifyLoopClipRailKind(clip)` is the only producer of `standard` (undefined → playscript; `railKind: 'reveal'` → reveal; absent scriptId → standard).
- `PhysicsPaintGroupLifecycle` gained `'standard'`; `PhysicsPaintGroupSynchronizationDot` excludes it, so a merged rail never paints a dot. Unresolved still wins over standard; reveal keeps reveal precedence.
- `modeLabel`/`groupTypeLabel` widen to include 'Standard'/'Standard Rail'; `sourceLabel` falls back to 'Merged rail — multiple scripts'; status/regenerate/replay reasons come from the three shared constants in the stacking module.
- `PhysicsPaintLoopClipRail` and `PhysicsPaintTrackRow` both receive `rail-kind-standard` next to `mode-<mode>`; aria reads 'Standard rail at frame N' via `getRotoRailKindLabel`.
- CSS: a gray block mirroring the reveal block's specificity for BOTH modes — base `#9CA3AF`, hover/focus `#D1D5DB`, selected `#f59e0b`, unresolved `#ff6b6b`, action-linked `#D1D5DB`.

## Regenerate / Replay gate placement

- `groupRegenerateReason`: the standard guard sits immediately after the busy/lock guard and BEFORE `isRegenerableLifecycleShape`, the syncState check and the provenance check. An infinity merge (no lifecycle members) therefore reports the merged reason instead of 'Rail source is unresolved', and an inherited `provenanceState` can never say 'Script detached'.
- `openSourceEdit`: the same guard sits between the loop-exists check and `isRegenerableLifecycleShape(loop)`, so the dialog's Regenerate trigger refuses a lifecycle-less merge instead of falling to 'no source-cycle provenance'.
- Replay carries the merged reason through the presentation (`replayDisabledReasonFor` early-returns for the standard lifecycle, ahead of the reference/script pre-checks).

## Intentional test-law reversals

These assertions encoded the forked adoption law C1 reverses; nothing else was reconciled:

- Quick A color adoption pins: the committed rail no longer has an own `overrideColor` (dialog seeding and `useStackColor` assertions stay).
- Quick A 'seeds the run from the rail settings' pin: the bake still uses the dialog's mode/motion, while the committed rail keeps `mode: 'progressive'`, `paintSeedVariation: true` and stores neither `motion` nor `overrideColor`.
- Quick B reveal-adoption pin: the committed rail has no colorize/colorizeMix/photoWiggle/scriptId/railKind/motion/overrideColor; the reveal tail render-call assertions stay.
- Quick B reload pin: `railKind` is absent after reload; repeat and sourceKeyIds assertions stay.
- WR-12 acknowledgement pin: retargeted from the no-longer-persisted colorize pair to KEPT fields (`mode`, `keyScriptEdits`), still proving a mismatched loop clip is rejected.
- Presentation table row 'no source action' became the merged Standard Rail expectation set (Standard labels, merged status/regenerate reason, null dot).
- Fixtures that intend a typed rail gained all-or-nothing provenance: the LoopClipRail static theme fixture, the TrackRow shared-family colors fixture, and the hook's shared `lifecycleGroup` helper (a dedicated `standardMergedGroup` helper covers the merged case).
- The Studio source-scan pin moved from the `deletedGroupMode` expression to the classification-based `deletedRailType` copy.

## New law pins

- Whitelist keep/drop matrix plus own-property absence for every dropped field, stored mode, frozen sourceKeyIds copy, null-plan preservation and non-null-plan override (stacking suite).
- End-to-end: Motion run on a Static destination commits ONE Standard Rail; exactly one `commit`; a pre-run deep snapshot of the destination still equals the pre-run value and the published record is a different object (one undo restores the typed rail).
- Reload: the committed record satisfies `isPhysicPaintRotoLoopClip`, `parsePhysicPaintRotoLoopClips([committed])` deep-equals `[committed]`, the parsed document round-trips it unchanged, and the reopened clip still projects 'Standard Rail'/lifecycle 'standard'.
- Keep: ON records 'append', flag-on OFF records 'replace', pixel-only OFF records nothing; all three committed clips classify Standard.
- Cycles: finite runs keep the destination repeat and receive the plan's extended `originalEndExclusive`/`visibleRanges`; an infinity merge (null plan) preserves the destination's six lifecycle members unchanged.
- Regenerate: canonical (six lifecycle members) and infinity merged clips both refuse with the merged reason, with no commit and no authority request.
- Non-active rows and the active lane both assert `rail-kind-standard`, aria/labels, no dot and the `#9CA3AF` CSS rule; typed and reveal rows are unchanged.
- Copy: delete scope says 'Delete Standard Rail', rail-set copy says 'N Standard Rails selected', and the stack dialog copy appears only on a stack destination.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` — whitelist projection, merged classifier, three copy constants.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — commits the whitelist record; merged Regenerate guards; `omitStoredRevealKnobs` deleted.
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` — standard lifecycle and merged copy.
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` — `RotoRailKind` extension, `classifyLoopClipRailKind`, Standard label.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` / `PhysicsPaintTrackRow.tsx` — `rail-kind-standard` in both hosts.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — rail-set member classification.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` — stack dialog copy.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — Standard delete scope and rail-set copy types.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — classified delete success copy.
- `app/src/components/physic-paint/physicsPaintStudio.css` — gray Standard rail block.
- Test files for each of the above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an unreachable `case 'standard'` from `replayDisabledReasonFor`**
- **Found during:** Task 1 (typecheck)
- **Issue:** The plan asked for both an early return and a `case 'standard'` in the switch; the early return narrows the subject, so TypeScript flagged the case as incomparable (TS2678).
- **Fix:** Kept the early return (the required ordering ahead of the reference/script pre-checks) and dropped the redundant case.
- **Files modified:** `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts`
- **Commit:** `0bf377a63`

**2. [Rule 1 - Bug] Presentation test asserted the Regenerate reason inside `tooltipLines`**
- **Found during:** Task 1
- **Issue:** The tooltip only carries the replay reason and freshness line; the Regenerate reason is a separate presentation field.
- **Fix:** Asserted `regenerateDisabledReason` directly and dropped the tooltip assertion.
- **Files modified:** `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts`
- **Commit:** `0bf377a63`

No other deviations. The plan's delete-copy threading was implemented as an optional third `railKind` parameter on `buildRotoDeleteScopeLabel` (fed by a tracked clip lookup in the `deleteScopeLabel` computed) to avoid adding a field to the exported delete-target classifier shape, which dozens of strict `toEqual` assertions pin.

## Auth gates

None.

## Known Stubs

None — no placeholder data, hardcoded empty UI sources, TODO/FIXME markers or unwired components were introduced. No `gsd windows append` entries were needed.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or trust-boundary schema change. The merge stays inside the existing single `ports.commit`.

## Schema statement (required)

**No persisted schema or format changed.** Standard is represented by ABSENT `scriptId`/`motion`/`overrideColor`/`railKind`/reveal knobs; the required `mode` field keeps its existing stored value. `physicsPaintRotoPhysicalModel.ts`, the serializers/parsers and every persisted rail field are untouched (`git diff --stat` over the plan's three commits lists only UI/controller/test files). The committed record round-trips through the existing parser and fingerprint.

**C2 was not started.** Reveal incoming on a non-Reveal destination and the document-reference routing/refusal were not implemented. Quick A/B collision, extend-only, repeat-unchanged, Keep and atomic-undo laws still hold; Load+Apply, Save/Delete script and the script library format were not touched.

## UAT rows handed to the user (live visible UAT — automated green is not done)

1. Motion destination + Static run: the rail turns into a gray "Standard Rail"; row tooltip, rail tooltip and the Scripts panel all say Standard, never Motion/Static/Reveal.
2. Static destination + Static run: same gray Standard result.
3. Motion destination + Motion run: same gray Standard result (the first rail's motion is no longer advertised as a Motion rail).
4. A Standard rail that receives another Motion or Static run stays Standard, stays gray, and keeps its cycle/repeat options.
5. Keep ON: the destination's existing picture stays under the new run after the merge and after repeating the run; Keep OFF flattens it; nothing doubles.
6. Cycle/repeat editing on the merged rail still works (Edit Rail, change repeat and cycle length).
7. Regenerate and Replay are unavailable on the merged rail with the merged-rail reason; key editing and per-key script editing still work.
8. One Undo restores the original typed rail exactly — type, color, source script and (for a reveal destination) its reveal knobs.
9. Save then reopen: the rail is still a gray Standard Rail with the same picture and the same blend.
10. Typed rails never show Standard: an unstacked Motion rail stays purple, a Static rail stays cyan, a Reveal rail stays blue, each with its own Regenerate behaviour.

## Verification evidence

- Targeted: stacking 63, controller 243, presentation/workflow/rail suites green; TrackRow 20, WorkflowStrip 149, hook 136, Studio 302, dialog 79.
- Full suite: 363 files (361 passed, 2 skipped) · 6,814 passed · 1 skipped · 96 todo · 0 failed (baseline 6,783 passed; +31 new pins).
- Typecheck: clean (`tsc --noEmit`).
- Schema tripwire: clean (no model/serializer/parser/persisted-field file in the diff).

## Self-Check: PASSED

- Files verified present: stacking module, controller, presentation/workflow modules, both rail hosts, CSS, dialog cards, hook, Studio, and their suites.
- Commits verified in history: `0bf377a63`, `9752d6567`, `c76ba561f` (all ancestors of HEAD; measured 3 commits over `f67b27d30..c76ba561f`).

## Post-UAT fix (2026-11-01, commit `28411564c`)

Live UAT round 1 failed two rows:

- Motion rail (Key Script Editing ON) + Static rail = gray Standard rail, but the cached motion animation was lost (the span became static).
- Motion rail + Static rail with Keep OFF = rail 1 replaced by rail 2, including its script.

Root cause: the non-reveal stack picture path replayed the destination's recorded events (untransformed strokes) over the durable base. A motion rail's animation lives in its BAKED pixels, not in its script, so the union bake flattened it to a static wash; Keep OFF additionally used Quick A's purge/replace record mode.

Fix (law now identical for every non-reveal destination):

- The run's OWN baked frame (mode/motion/seed already applied) composites over each touched key's CURRENT cached picture. The destination's animation survives, and an incoming Motion run animates.
- Keep ON: still appends the run's slices and stages the pre-run base pins (per-key editing stays). Keep OFF: records nothing and NEVER purges the destination's scripts or picture.
- Reveal destination tail law unchanged.

Ports: `bakeStackedRailKey` takes the run `sheets` (not slices) and merges them; `composeStackedRailKey` takes `sheetBytes`. Tests updated: the union-port pins now assert the current-payload composite and the absence of event replay; the WR-12/replace pins were retargeted to the new law. Full suite 363 files / 6,818 passed / 0 failed, typecheck clean. Rows 1–5 of the UAT list above are the user's re-test.

## UAT result — APPROVED 2026-11-01

The user re-ran live UAT after `28411564c` and approved: the Motion rail keeps its animation when a Static run merges over it, Keep OFF no longer replaces the destination, and the merged rail presents as one gray Standard Rail. Quick C1 is CLOSED. C2 (Reveal incoming on any destination + document-reference routing/refusal) is the next quick.
