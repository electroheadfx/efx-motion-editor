---
phase: 58-rail-editing-regressions
verified: 2026-11-03T20:20:01Z
status: passed
score: 52/52 must-haves verified
covered_files:
  - .planning/phases/58-rail-editing-regressions/58-01-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-01-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-02-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-02-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-03-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-03-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-04-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-04-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-05-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-05-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-06-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-06-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-07-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-07-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-08-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-08-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-09-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-09-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-10-PLAN.md
  - .planning/phases/58-rail-editing-regressions/58-10-SUMMARY.md
  - .planning/phases/58-rail-editing-regressions/58-UAT.md
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/types/physicPaint.test.ts
  - app/src/types/physicPaint.ts
covered_digest: "v4:sha256:0bd66e4f95538755271706d166522e941682e77f61fe85c4886ec66bb11e5d14"
behavior_unverified: 0
overrides_applied: 3
overrides:
  - must_have: "An accepted single-key move never emits nextLoopClips, so placementStart stays put"
    reason: "UAT G-04 (2026-11-03) approved retiming the rail band on a single-key drag: an accepted rail source-key move may emit nextLoopClips and move placementStart when the dragged key is the first source key. The phase goal (single key draggable to choose spacing) requires it; the old D-13 no-emit assertion is superseded by the approved behavior. Ownership is not silently relaxed: two-or-more referencing loops still reject (truth 17)."
    accepted_by: "Laurent Marques"
    accepted_at: "2026-11-03"
  - must_have: "Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy"
    reason: "UAT G-02/G-03/G-05/G-06 (2026-11-03) approved rail-aware Delete/Insert semantics: generate-mode delete contracts the source cycle, insert extends a canonical rail, +Key/paint inserts a source phase, and Insert accepts Reveal and overridden rails. The guarded refusals and locked copy remain for non-canonical, shared-source, overlapping, and collision cases; the rail-local acceptance is the approved expansion."
    accepted_by: "Laurent Marques"
    accepted_at: "2026-11-03"
  - must_have: "The acceptance is entirely inside the resolver: prepareRotoKeyDrag / commitRotoKeyDrag and the WorkflowStrip drag dispatch are untouched"
    reason: "UAT G-04 (2026-11-03) approved arming rail source keys for drag. PhysicsPaintWorkflowStrip's cell drag gate now drops the spacing-proxy exclusion (dragEligible = isPhysicalRealKey && !rotoDragLocked && frameInteraction?.dragEligible !== false); prepareRotoKeyDrag and commitRotoKeyDrag remain untouched, and the Law A resolver guard remains the acceptance authority."
    accepted_by: "Laurent Marques"
    accepted_at: "2026-11-03"
re_verification:
  previous_status: human_needed
  previous_score: 52/52
  gaps_closed:
    - "All 10 human-verification items in the 2026-11-03T16:59:06Z report were exercised live and passed (58-UAT.md: 10 passed, 0 issues; commit 02e6556f9)"
    - "G-01 re-tested after the G-02 contraction fix: the rail stops at the surviving source extent and the repair survives reopen"
    - "G-02: generate-mode rail delete contracts the source cycle (ripple left, overrides shift, extent follows) — eb576f1cf, 2d2105897"
    - "G-03: insert extends a canonical rail (static and spaced source cycles) instead of failing — 2d2105897, b9691ea03"
    - "G-04: rail source keys arm a drag; the band retimes at both ends — bdc5928ac"
    - "G-05/G-06: + Key/paint inserts a source phase inside the rail; Insert accepts Reveal and overridden rails — e41c2f6a4, 9507de221"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Per-frame cells, cycle grays, and the rail colour dot on Standard rails"
    addressed_in: "v7 timeline rails (in-milestone quick)"
    evidence: "ROADMAP Phase 58 SC2: 'Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58.'"
  - truth: "Motion channels"
    addressed_in: "v2.1.0"
    evidence: "ROADMAP v7 timeline rails: 'Motion channels stay in v2.1.0.'"
advisory:
  - finding: "The reduced Cycle dialog keeps the fixed 700x660 shell around one ~150px card, leaving roughly 376px of dead vertical space and 478px of dead horizontal space"
    category: other
    reason: "58-UI-REVIEW.md priority fix 1. Visual composition only; the D-05 reduced form is contract-correct. Would be resolved by a reduced surface height or a centered compact column."
    evidence_status: "none provided — no screenshots (no dev server started); geometry derived from CSS"
  - finding: "Edit Rail / Create Cycle refusal reasons are returned or logged but never rendered, and rejectLoopOp sets error to null, so a refused action leaves the footer on 'Ready'"
    category: other
    reason: "58-UI-REVIEW.md priority fix 2. UX feedback polish outside the RAIL acceptance; the refusal paths themselves correctly write nothing."
    evidence_status: "none provided — source-derived, no live capture"
  - finding: "During the 'committing' phase the footer Cancel and primary remain enabled-looking while cancel() no-ops and the primary silently refuses"
    category: other
    reason: "58-UI-REVIEW.md priority fix 3. UX polish; the WR-01 fix deliberately makes this window a true no-op so no state is stranded."
    evidence_status: "none provided — source-derived, no live capture"
  - finding: "Pasting a rail-set copy taken from an already-stale finite lifecycle rail can be rejected fail-closed: the child coordinator's G-01 reconcile trims the pasted clip while the paste semantic delta was built from the untrimmed proposal, so the bridge's canonical recomputation (sameCanonicalLoopClips / revision) mismatches"
    category: other
    reason: "Narrow residual of combining G-01's lazy repair with the paste semantic-delta recompute; source-derived, no failing test run. The rejection writes nothing and the paste can be retried after the source rail is repaired. Would be resolved by building the paste impact from the post-reconcile document."
    evidence_status: "none provided — source-derived, no failing test run"
---

# Phase 58: Rail editing regressions Verification Report

**Phase Goal:** A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Verified:** 2026-11-03T20:20:01Z (re-verified against the live tree at `39dc6e418`, working tree clean)
**Status:** passed
**Re-verification:** Yes — after UAT completion and the six post-report fix commits

## Goal Achievement

The phase goal is achieved in the current codebase. The 2026-11-03T16:59:06Z report was correct about the ten planned changes but predated six UAT-driven fix commits and the completed UAT. This re-verification checked the live tree, not the summaries:

- The Key Rail -> Standard conversion path (RAIL-01..RAIL-05) is unchanged and still verified end to end: inspector takeover, reduced Cycle/Infinity modal, provenance-free Standard record, one loop-only commit, one-command undo/redo, and a generation-fenced cancel path.
- The single-key drag law (RAIL-06) is verified on the live path. The previous blocker for the goal's second clause was that rail source keys could not arm a drag at all: the cell drag gate excluded Key Spacing proxies. Commit `bdc5928ac` removed that exclusion, and a canonical lifecycle rail now repositions the moved phase and retimes the band at either end. A cell key referenced by two or more loops still rejects with the locked rigid-group copy.
- The post-report UAT fixes (G-02..G-06) are regression-pinned and green. They extend Delete/Insert on canonical rails and +Key/paint inside a rail; these are user-approved behavior additions, not silent ownership relaxations.
- Native UAT is complete: `58-UAT.md` records 10 passed, 0 issues (commit `02e6556f9`). Every previous `human_needed` item has live evidence, so no human re-verification item remains.

### Observable Truths

Status vocabulary: VERIFIED = code + tests support it; PASSED (override) = the planned assertion is superseded by explicitly user-approved UAT behavior (see Overrides).

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Selecting a normal Key Rail exposes the sidebar Edit Rail action: the Scripts panel is replaced by an inspector with Edit Rail and Close | VERIFIED | `PhysicsPaintScriptsPanel.tsx:147-160` takeover branch precedes the loop branch, Edit Rail/Close at `:153-154`; `PhysicsPaintStudio.tsx:7202`; ScriptsPanel spec 61/61 |
| 2 | Double-clicking a Key Rail invokes the open intent: plain second click within 220 ms, never a move member, never while busy | VERIFIED | `PhysicsPaintKeyRail.tsx:31`, `:277-283`, `:305`; `PhysicsPaintWorkflowStrip.tsx:447`, `:4868`; KeyRail launcher 17/17 |
| 3 | Enter on a focused Key Rail selects it then invokes the same open intent; Space still plain-selects; Escape still hides the tooltip | VERIFIED | `PhysicsPaintKeyRail.tsx:300-307`; KeyRail launcher 17/17 |
| 4 | The conversion modal shows only the Cycle stepper and Infinity switch, prefilled at 1 and unchecked, with no tabs, rail type, frames-per-cycle, Motion, source cycle, seed, or Regenerate | VERIFIED | `ReducedCycleCard` `PhysicsPaintPlayScriptCards.tsx:561`; `PhysicsPaintPlayScriptDialog.tsx:72`, `:377-380`; dialog spec 108/108 |
| 5 | Cancel performs zero writes: no store mutation, no revision bump, no undo entry | VERIFIED | `acceptedGeneration = ++generation` before `'preparing'` (`controller:1835`), `assertCurrent` after authority (`:1842`) and after commit (`:1874`), AbortError -> `'cancelled'` without `fail()` (`:1878-1893`); test `controller.test.ts:4066-4115` |
| 6 | The primary action labels Create Cycle for a first conversion and Update Rail for an existing Standard clip, and both route through `playScript.confirm()` | VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:579-586`; dialog spec 108/108 |
| 7 | Confirming creates one provenance-free Standard clip: `sourceKeyIds` in segment order, `placementStart` = first key frame, repeat from the reduced form, no `scriptId` / `railKind` / `motion` | VERIFIED | `buildKeyRailStandardLoopClip` `physicsPaintRotoRunScriptStacking.ts:597-613`; `controller.test.ts:3980-4025` |
| 8 | Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent "Source missing" clip with no in-UI repair | VERIFIED | `resolver:5232-5264`; `loopGuards.test.ts:283-309` moves A 10 -> 9 and asserts the derived L1 range `unresolved` is null; G-04 retime pins `:4460`, `:4532` |
| 9 | The clip classifies as Standard and presents via the existing `.rail-kind-standard` pill; the existing Edit Rail dialog owns Repeat/Infinity afterwards | VERIFIED | `classifyLoopClipRailKind(clip) === 'standard'` pinned `KeyRailCycle.test.ts:104`; CSS `physicsPaintStudio.css:4935-4936` |
| 10 | A gapped segment keeps its span: cycle length = last - first + 1, extent clamped to capacity, infinity lifecycle-less | VERIFIED | `controller:1850` passes `cycleFrameCount`; `KeyRailCycle.test.ts` (8 tests) covers 6-frame cycle, repeat-2 extent 22, repeat-1 extent 16, infinity |
| 11 | A single-key segment converts to a 1-frame cycle | VERIFIED | `KeyRailCycle.test.ts` single-key case |
| 12 | A second conversion over already loop-owned keys is refused before any commit | VERIFIED | open-time `controller:1781`, confirm-time `:1846`; tests `controller.test.ts` owned via `sourceKeyIds` and via `frameOverrides` |
| 13 | Undo restores the pre-conversion Key Rail and Redo re-applies the conversion as one command | VERIFIED | `controller.test.ts:4026-4046` drives the real history hook: availability 1/0, redo restores `originalEndExclusive` 16 |
| 14 | The conversion is exactly one `ports.commit` with `semanticDelta.kind 'play-script'`, `loopOnly: true`, `affectedEndAppFrame = anchor - 1`, `freshKeyIds: []` | VERIFIED | `buildLoopOnlyPublication` `controller:2140-2177`; `confirmKeyRailCycle:1861-1870`; test `controller.test.ts:3980-4025` |
| 15 | Cancel and every refusal perform zero commits and zero history entries | VERIFIED | Generation fence (truth 5); cancel-after-open pinned `controller.test.ts:4049`; refusals return before commit (`controller:1843-1846`); in-flight cancel asserts zero history |
| 16 | A single-key drag on a key referenced by exactly one loop is accepted and lands on the requested frame (Law A) | VERIFIED | `resolver:5232` comparator `> 1`; `loopGuards.test.ts:283-309`; G-04 rail-drag pins `:4460-4644` |
| 17 | A key referenced by two or more loops is rejected, never moves silently, with `loop-source-key-move-rejected`, `move-key`, and the verbatim D-16 copy | VERIFIED | `resolver:5232`; locked copy `:925`; `loopGuards.test.ts:366` |
| 18 | An accepted single-key move never emits `nextLoopClips`, so `placementStart` stays put | PASSED (override) | Superseded by UAT G-04: `resolver:5214-5288` now builds a canonical-rail reposition candidate (`buildRailSourceRepositionCandidate:2155`) and may emit `nextLoopClips` via `computeSourceAttachedLoopPlacementFollow:1010`; band retime pins `:4460`, `:4496`, `:4532-4644`. The two-or-more guard is untouched (truth 17) |
| 19 | Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy | PASSED (override) | Force Spacing guard remains `resolver:5290-5328`, and the D-11/D-16 guards/copy remain; UAT G-02/G-03/G-05/G-06 approved rail-local Delete contraction and Insert acceptance (static/reveal/overridden rails), pinned `resolver.test.ts:4116-4819`, `5511-5596`. No-leak pins `loopGuards.test.ts:684-707` unchanged |
| 20 | The acceptance is entirely inside the resolver: `prepareRotoKeyDrag` / `commitRotoKeyDrag` and the WorkflowStrip drag dispatch are untouched | PASSED (override) | UAT G-04 required arming rail keys: `PhysicsPaintWorkflowStrip.tsx:4982` drops `spacingProxy === null` from the cell gate. `prepareRotoKeyDrag`/`commitRotoKeyDrag` remain untouched, and the resolver still owns acceptance |
| 21 | Edit Rail and double-click/Enter reach one Studio handler that selects the rail first, then delegates to `openKeyRailCycleEdit`, returning a Promise on every path | VERIFIED | `PhysicsPaintStudio.tsx:4816-4824`; Studio spec `selects before opening and returns a Promise on the missing-segment refusal` |
| 22 | A 2+ rail set whose anchor is a Key Rail projects with setSize >= 2, Edit Rail visible and disabled with "Select a single rail to edit it.", and no bulk conversion | VERIFIED | `Studio` rail-set anchor projection; `physicsPaintKeyRailPresentation.ts:111`, `:129-143`; Studio spec |
| 23 | Close clears both `selectedRotoKeyRail` and `railSetSelection`, so the takeover dismisses in the plain and rail-set states | VERIFIED | `Studio:4829-4833`; Studio spec `clears BOTH selection layers on Close` |
| 24 | The inspector shows exactly Frames F{first}-F{last}, Keys n, Type Standard, and keeps one object identity across unrelated renders | VERIFIED | `physicsPaintKeyRailPresentation.ts:129-143`; memo deps; `reconcileRotoKeyRailSelection:453-463` |
| 25 | No `.mce` schema field is added or changed; resolver, undo, and existing D-11 guard tests are green or deliberately updated | VERIFIED | Phase diff contains no `.mce`, schema, parser, or `src-tauri` path; the only `app/src/types` change is transient intent/semantic-delta typing (documented deviation); full suite 7143 passed; `tsc --noEmit` exit 0 |
| 26 | Cancelling while the conversion is still awaiting authority never calls `ports.commit`, lands in `'cancelled'`, leaves error null, and produces no accepted output | VERIFIED | `controller:1842` assertCurrent before ack; test `controller.test.ts:4066-4115` |
| 27 | A cancelled conversion keeps `keyRailCycleEditTarget` and the open dialog, so a later confirm retries and commits exactly once | VERIFIED | `controller:1878-1893`; test asserts target non-null, `confirmationOpen` true, retry returns true and commit called once |
| 28 | Cancelling while the phase is `'committing'` neither clears the target nor closes the dialog; after that commit fails, Create Cycle retries and commits | VERIFIED | `cancel()` busy early return `controller:3659-3660`; test `controller.test.ts:4117-4164` |
| 29 | A cancel before confirm still closes the dialog with zero writes | VERIFIED | Existing test `controller.test.ts:4049` unchanged and passing |
| 30 | An AbortError is never routed through `fail()`: no `'Play Script failed'` phase, no error text, no error-level log | VERIFIED | `controller:1878-1893`; test asserts status `'Key Rail cycle cancelled'`, error null, no error-level log |
| 31 | The successful conversion path still commits exactly once, clears the target, and closes the dialog | VERIFIED | `controller.test.ts:3980-4025`: one commit, phase `'complete'`, target null, `confirmationOpen` false |
| 32 | With exactly one referencing loop, a move-key whose final mapping breaks strict increase is rejected with `loop-source-key-move-rejected`, `operationKind move-key`, and the verbatim D-16 copy | VERIFIED | `resolver:5264`; `loopGuards.test.ts:311-317` pins C 12 -> 22 |
| 33 | The order check reads the FINAL candidate mapping (ripple-proof) and fails closed when a referenced source key is absent from the mapping | VERIFIED | `resolver:5264` reads `moveResult.candidate.mapping`; `loopGuards.test.ts:337-344` dangling-source rejection |
| 34 | A one-element source cycle is always order-preserving and its only key can move | VERIFIED | `loopGuards.test.ts:319` one-element acceptance with a resolved derivation |
| 35 | A key referenced by no loop, and a no-change drag back to its own cell, are accepted | VERIFIED | `loopGuards.test.ts:346` (unreferenced) and `:356` (no-change dangling exemption) |
| 36 | `sourceKeyIds` is never re-sorted or mutated; an order-breaking destination is rejected rather than re-sequenced | VERIFIED | Resolver guard only reads; `loopGuards.test.ts:305-308` asserts the input loop collection is unchanged |
| 37 | In key-rail-create, Enter calls `confirm()` exactly once despite the stale `'Maximum available count is 0.'` frames error, and the primary button is enabled | VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:150-157`, `:302`, `:579`; test `PhysicsPaintPlayScriptDialog.test.ts:984-995` |
| 38 | The Enter guard and primary disabled share one `confirmBlocked`; repeatError blocks both; the merged Standard reduced form also confirms; full apply, Reveal, and stack-collision surfaces keep their prior gating; Escape/canCancel precedence unchanged | VERIFIED | Dialog tests `:997-1007` (repeatError), `:1009` (merged Standard), `:1032` (Escape/canCancel) |
| 39 | Group override records never survive outside every referencing clip's surviving extent; the empty-trim fail-safe leaves the clip byte-identical | VERIFIED | `reconcilePhysicPaintRotoGroupFrames` `model:1062`; coordinator `:2349`; `groupParity.test.ts` rows `:548`, `:586`, `:624`; `loopGuards.test.ts` G-01 pins |
| 40 | A finite lifecycle clip's derived range never ends past `phaseOrigin + cycleLength * repeat` from current source-key positions (capacity-clamped); frames beyond resolve empty | VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent` `model:1003-1031`; `boundedNaturalEnd` `resolver:6396`; reveal exemption `model:1009`; `groupParity.test.ts` |
| 41 | Deleting a real key inside a lifecycle clip's surviving extent is refused with the locked copy, and a key past that bound deletes normally while its stale paint sheet is pruned whenever trimmed ranges stay non-empty | VERIFIED | `isGroupOwnedKeyFrame` `resolver:1135`; fail calls `:4893`, `:4942`, `:5032` with `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT:934` |
| 42 | Repeat contraction filters the rebuilt clip's `frameOverrides` to frames strictly before the source-derived surviving end; an override inside the surviving end but past the new end still raises the unchanged copy | VERIFIED | `updateLoop` `controller:2269-2309`; bridge staged-document parse; controller tests `:2522`, `:2537` |
| 43 | After the first accepted write on an already-stale document, the persisted clip extent and override collection are canonical in one undo step that also restores the deleted key | VERIFIED | Named tests `useRotoPhysicalEditCoordinator.test.ts:4541`, `:4576`, `:4603`, `:4626`, `:4640` |
| 44 | A stale document whose `sourceKeyIds` all still exist loads and resolves without "Source missing"; a genuinely dangling source id keeps today's result; no load-time migration and no revision churn | VERIFIED | `loopGuards.test.ts` G-01 rows `:1218-1440`; `resolvePhysicPaintRotoLoopSourceExtent` non-mutating with input-ref return when unchanged |
| 45 | No `.mce` field, parser shape, storage mode, or persisted schema changes; D-08..D-11 conversion semantics, D-15 guard surfaces, D-16 copy, and D-17 locking are preserved, with the one added G-01 ownership-parity refusal | VERIFIED | No `.mce`/parser/Rust/storage change in the phase diff; the G-01 refusal and UAT-approved rail-local delete/insert extensions are additive and regression-pinned |
| 46 | An order-preserving partial-cycle group move stays accepted: A,B 10-11 -> 8-9 under loop(10,5) yields A:8, B:9, C:12, D:13, E:14, `nextLoopClips` null, `placementStart` 10, unresolved null | VERIFIED | `loopGuards.test.ts:765-781`; named test passes |
| 47 | An order-breaking partial-cycle group move is rejected: A,B -> cell 20 projects A:20, B:21, C:12 and fails with `loop-source-key-move-rejected`, `operationKind move-key-group`, verbatim D-16 copy | VERIFIED | `resolver:5782`; `loopGuards.test.ts:782-793`; named test passes |
| 48 | The order proof reads the final candidate mapping, so a moved key landing past a non-moved source key is caught, and a clip source key absent from the mapping fails closed | VERIFIED | `loopSourceOrderIsProvable` `resolver:2198`; guard `:5782`; `loopGuards.test.ts:831-838` |
| 49 | Every clip whose `sourceKeyIds` intersect the moved key set is projected; a clip the move does not touch keeps today's behavior even when already unresolved | VERIFIED | `loopGuards.test.ts:820-829`, `:851-858` |
| 50 | `move-key` and `move-key-group` share one order helper and one failure call, so CR-02's behavior is byte-identical and its existing tests stay unedited and green | VERIFIED | `resolver:2198`, `:5264`, `:5782`; CR-02 pins `loopGuards.test.ts:311-356` unchanged and green |
| 51 | On the UI path an order-breaking partial-cycle group drag prepares as `ok:false` carrying the locked copy and never calls `executePhysicalEdit`, while the order-preserving drag commits exactly once | VERIFIED | `useRotoTimelineActions.test.ts:1810-1838`; both named tests pass |
| 52 | Whole-cycle rigid group moves and the two-loop D-04 `placementStart` follow, no-change drags, one-element cycles, and ordinary moves behave as before; no `.mce`, parser, failure-union, or copy changes | VERIFIED | `loopGuards.test.ts:721-760`, `:802-849`; no `.mce`/parser change; the only failure union reuse is `loop-source-key-move-rejected` |

**Score:** 52/52 truths verified (49 VERIFIED + 3 PASSED (override); 0 behavior-unverified).

### Post-Report UAT-Driven Changes (factored into this verdict)

These commits landed after the stale report and were verified in the live tree. They extend behavior beyond the ten original plans; the user approved each in live UAT on 2026-11-03, and `58-UAT.md` records 10/10 rows passing.

| Commit | Change | Pins |
| ------ | ------ | ---- |
| `eb576f1cf` | Generate-mode rail delete contracts the source cycle: deleted phase leaves `sourceKeyIds`, later source keys ripple left, overrides shift, extent follows; static/hold and reveal keep gap semantics; shared/collision cases fail closed | `resolveGenerateModeContraction` `physicsPaintRotoGroupLifecycle.ts:634`; `resolveGenerateModeContraction:642` excludes static/reveal; pins `resolver.test.ts:5511-5596` |
| `2d2105897` | Spaced source cycles (generated in-betweens) supported by delete contraction and insert extension | `resolver.test.ts:5565`, `:4387`; bridge spec updated |
| `b9691ea03` | Static rails accept insert with held frames; rail band retimes on key drag | `resolver.test.ts:4430`, `:4460-4496` |
| `bdc5928ac` | Cell drag gate admits rail source keys; canonical rail drag free-repositions and retimes the band at both ends | `PhysicsPaintWorkflowStrip.tsx:4982`; pins `resolver.test.ts:4460-4644` |
| `e41c2f6a4` | +Key/paint inside a rail inserts a source phase instead of splitting the rail; every repeat grows; overrides move; paint promotion accepts an in-between | `resolvePhysicPaintRotoRailKeyInsertTarget:4482`, `resolvePhysicPaintRotoRailInsertPlan:4596`; paste-key `railInsertGroupId` (`types/physicPaint.ts:476`, validator `:644-652`, serializer `:935`); pins `resolver.test.ts:4819-5038`, `useRotoTimelineActions.test.ts:1388-1431` |
| `9507de221` | Insert accepts Reveal rails and rails with painted overrides; overridden rail without override authority still fails closed | `resolver.test.ts:4676`, `:4705-4749`; `useRotoTimelineActions.test.ts:1062-1112` |
| `02e6556f9` | UAT completion: 10 passed, 0 issues; G-01 retested after the G-02 contraction fix | `58-UAT.md` |

The goal's second clause is now observable in the live path: before `bdc5928ac` the drag gate excluded spacing proxies, so the goal could not be exercised. That is fixed and pinned.

### Overrides / Accepted Deviations

Three planned truth statements are marked PASSED (override) because the user approved a superseding behavior during UAT on 2026-11-03:

1. **Truth 18 (D-13 no-emit).** G-04 approved retiming the rail band on a single-key drag. An accepted rail move may now emit `nextLoopClips` and move `placementStart` for the first source key. The resolver still rejects when two or more loops reference the key, so linked-cycle ownership is not silently relaxed.
2. **Truth 19 (Delete/Insert guards unchanged).** G-02/G-03/G-05/G-06 approved rail-local Delete contraction, Insert extension, and +Key/paint source-phase insertion. All guarded refusals and the locked copy remain for non-canonical, shared-source, overlapping, and collision cases.
3. **Truth 20 (WorkflowStrip untouched).** The drag gate changed to admit rail source keys, which is the mechanism the goal requires. `prepareRotoKeyDrag` / `commitRotoKeyDrag` remain unchanged and the resolver remains the acceptance authority.

### Prohibitions

| Plan Prohibition | Status | Evidence |
| ---------------- | ------ | -------- |
| No `.mce`, parser-shape, Rust, storage-device, or persisted-schema change; no load-time migration; no revision bump on an unchanged canonical document (58-09) | VERIFIED | Phase diff has no `.mce`, parser, or `src-tauri` path; reconcile is applied at the write choke point, not load; canonical pass-through pinned `useRotoPhysicalEditCoordinator.test.ts:4603` |
| No re-sort, rewrite, or mutation of `sourceKeyIds`; no change to `countLoopsReferencingSourceKey`, D-07, D-11, or D-13/D-16 copy (58-09) | VERIFIED | `loopSourceOrderIsProvable` only reads; `loopGuards.test.ts:305-308` asserts input unchanged; copy `resolver:925` verbatim |
| No change to `buildDeleteCandidate` ripple suppression or keyless-gap behavior (58-09) | VERIFIED | Existing pins green; G-02 contraction is scoped to generate-mode canonical rails |
| No change to 58-06/58-07/58-08 behavior; no change to `unlinkLoop`, `linkLoop`, `repairLoop`, relink semantics (58-09) | VERIFIED | Controller and loop-guard suites green; no link/unlink code touched |
| No new module for the shared helper; no auto-grow of `originalEndExclusive`; no synthetic source keys (58-09) | VERIFIED | Helper lives in `physicsPaintRotoPhysicalModel.ts:1003`; G-01 clamp only shrinks; no synthetic identities |
| No re-sort/rewrite/clone of `sourceKeyIds`; no mutation of input `loopClips`; no new failure code/copy (58-10) | VERIFIED | Shared helper `:2198`; reuses `loop-source-key-move-rejected` and `LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT`; CR-02 pins unchanged |
| No change to `buildMoveGroupCandidate`, `countLoopsReferencingSourceKey`, the >= 2 guard, Force Spacing, or D-07/D-11/D-13/D-16 behaviors (58-10) | VERIFIED | Guard/copy untouched; D-13 single-key no-emit is superseded by UAT G-04 (override 1), while the >= 2 guard remains |
| No change to 58-06/58-07/58-08/58-09 reconcile work (58-10) | VERIFIED | The UAT fixes are additive rail-local behavior; all prior pins remain green |
| No `.mce`, schema, parser, Rust, storage, **or app/src/types change** (58-10) | DEVIATED — user-approved | `app/src/types/physicPaint.ts` gained transient intent field `railInsertGroupId` (`:476`, validator `:644-652`, serializer `:935`) and semantic-delta fields `railInsert` / `trailingShift` (`:1076-1082`, `:1572-1582`). These are in-memory edit-contract types, not persisted `.mce` schema. Required by the UAT-approved G-05/G-06 rail insert behavior; accepted by Laurent Marques on 2026-11-03 |
| No auto-unlink, auto-repair, or loop removal on rejection (58-10) | VERIFIED | All rejection paths `return fail(...)` before any proposal; no loop-clip mutation |

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Per-frame cells, cycle grays, and the rail colour dot on Standard rails | Phase 58 v7 timeline-rails quick | ROADMAP SC2: these belong to the v7 quick, not Phase 58 |
| 2 | Motion channels | v2.1.0 | ROADMAP v7 timeline rails: Motion channels stay in v2.1.0 |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Reduced Cycle dialog leaves ~376px vertical / ~478px horizontal dead space | other | Visual composition only; D-05 reduced form is contract-correct; no screenshots/evidence provided |
| 2 | Edit Rail / Create Cycle refusal reasons are not rendered; `rejectLoopOp` sets error null | other | UX feedback polish outside the RAIL acceptance; refusal paths write nothing |
| 3 | During `'committing'`, Cancel and primary look enabled while both no-op | other | UX polish; WR-01 deliberately makes the window a no-op |
| 4 | Pasting a rail-set copy from an already-stale finite lifecycle rail can be rejected fail-closed (reconcile vs paste semantic-delta recompute) | other | Source-derived, no failing test run; rejection writes nothing and is retryable after source repair |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `physicsPaintRotoPhysicalResolver.ts` | Law A guard, CR-02 final-mapping order guard, move-key-group order guard, rail reposition/retime, rail insert plan, Group ownership, G-01 bounded derivation | VERIFIED | `loopSourceOrderIsProvable:2198`; move-key `:5232-5288`; force-spacing `:5290-5328`; move-key-group `:5782`; `isGroupOwnedKeyFrame:1135`; `boundedNaturalEnd:6396`; rail helpers `:2155`, `:4482`, `:4596` |
| `physicsPaintRotoPhysicalModel.ts` | Shared source-extent helper, reconcile, override pruning | VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent:1003` (reveal null `:1009`); `reconcilePhysicPaintRotoGroupFrames:1062`; non-mutating, returns input refs when unchanged |
| `useRotoPhysicalEditCoordinator.ts` | Reconcile at the write choke point before revision/payload | VERIFIED | `:2349` feeds the staged revision, staged parse, and payload `loopClips` / `groupOverrideRecords` |
| `physicsPaintRotoGroupLifecycle.ts` | Source-extent bound; G-02 generate-mode contraction | VERIFIED | `resolveGroupBoundedEnd:321`; `resolveGenerateModeContraction:634`; `proposePhysicPaintRotoDeleteGroupFrame:815` |
| `physicsPaintRotoPlayScriptController.ts` | Update Rail surviving end, override pruning, generation-fenced conversion, busy-phase cancel | VERIFIED | `confirmKeyRailCycle:1823-1897`; `buildLoopOnlyPublication:2140`; `updateLoop:2269-2309`; `cancel()` busy early return `:3659-3660` |
| `physicsPaintRotoRailSetCopy.ts` | Ceil cycle count for a frozen Infinity span | VERIFIED | `Math.max(1, Math.ceil(...))`; both pinned whole-multiple expectations unchanged |
| `useRotoTimelineActions.ts` | Group-owned delete routing, rail key insert target, +Key/paint rail insert | VERIFIED | `addEmptyKey` rail insert path `:2461-2542`; rail target `:2513`; repeat rail option `:2470`; `prepareRotoKeyDrag` unchanged |
| `physicsPaintRotoLoopGuards.test.ts` | Law A boundary pair, CR-02 rejection, G-01 extent/ownership, CR-03 edge pins | VERIFIED | 63 tests green; G-01 `:1218-1440`; CR-03 `:762-869`; WR-01 gap pin `:1374-1410` |
| `physicsPaintRotoGroupParity.test.ts` | Extent agreement across derivation/proposers/regenerate | VERIFIED | 50 tests green; surviving-extent rows `:548`, `:586`, `:624` |
| `physicsPaintRotoPlayScriptController.test.ts` | In-flight cancel, retry, busy cancel, override contraction | VERIFIED | 275 tests green; `:2522` refusal preserved; `:2537` stale-override pruning |
| `useRotoPhysicalEditCoordinator.test.ts` | Stale-cycle repair, one undo step, canonical pass-through, infinity untouched | VERIFIED | 96 tests green; `:4541`, `:4576`, `:4603`, `:4626`, `:4640` |
| `useRotoTimelineActions.test.ts` | Delete classifier parity, CR-03 UI dispatch pins, G-06 rail insert/Insert rows | VERIFIED | 147 tests green; CR-03 `:1810-1838`; G-06 `:1062`, `:1112`, `:1388`, `:1431` |
| `physicsPaintRotoRailSetCopy.test.ts` | CR-01 non-whole-cycle paste regression | VERIFIED | 26 tests green; pin `:710-745` |
| `buildKeyRailStandardLoopClip` (`physicsPaintRotoRunScriptStacking.ts`) | Strict whitelist, provenance-free | VERIFIED | `:597-613` |
| `KeyRailCycleEditTarget`, `openKeyRailCycleEdit`, `confirmKeyRailCycle` | Frozen target, zero writes on open, generation-fenced confirm | VERIFIED | `controller:1764-1897` |
| `SelectedKeyRailInspectorPresentation`, `projectSelectedKeyRailInspector` | Frames/Keys/Type, disabled reason | VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:129-143` |
| `PhysicsPaintScriptsPanel` takeover props | Edit Rail and Close | VERIFIED | `:147-160`; 61 tests green |
| `PhysicsPaintKeyRail` open-intent prop | Double-click + Enter | VERIFIED | `:277-307`, `:417`; 17 tests green |
| `PhysicsPaintWorkflowStrip` open-intent prop and drag gate | Forwarding; rail keys arm a drag | VERIFIED | `:447`, `:4868`, `:4982`; 151 tests green |
| `ReducedCycleCard` | Cycle stepper + Infinity switch only | VERIFIED | `PhysicsPaintPlayScriptCards.tsx:561` |
| `reducedForm`, `confirmBlocked`, reduced branch | Reduced surface + shared confirm gate | VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:72`, `:150-157`, `:302`, `:377-380`, `:579` |
| `PhysicsPaintStudio.tsx` inspector memo, anchor, handlers, paint promotion | D-01/D-03 + G-05 wiring | VERIFIED | `:1781`, `:4816-4833`, `:4882-4888`, `:7202`; paint promotion `:4987`; 336 tests green |
| `app/src/types/physicPaint.ts` | Rail insert intent/semantic-delta contract | VERIFIED (documented deviation) | `railInsertGroupId:476`; `railInsert`/`trailingShift` `:1076-1082`; validators/serializer `:644-652`, `:935`, `:1572-1582`; transient only |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Key Rails segment derivation | `projectSelectedKeyRailInspector` | `keyRailSegmentByFirstKeyId` -> inspector memo | WIRED | `Studio:1152`, `:4882-4888` |
| `railSetAnchorKeyRailId` | inspector memo and WorkflowStrip bundle | one shared const | WIRED | `Studio:1781`, `:4888` |
| Scripts panel Edit Rail onClick | `handleOpenRotoKeyRailCycleEdit` | `onOpenKeyRailEdit` prop | WIRED | `ScriptsPanel:153`; `Studio:7202`, `:4816-4824` |
| `handleOpenRotoKeyRailCycleEdit` | `rotoPlayScript.openKeyRailCycleEdit` | select-then-open, Promise on every path | WIRED | `Studio:4816-4824`; `controller:1764` |
| `PhysicsPaintKeyRail` double-click / Enter | Studio handler | `onOpenKeyRailCycleEdit` -> WorkflowStrip -> Studio | WIRED | `KeyRail:277-307`; strip `:447`, `:4868` |
| `dialogMode === 'key-rail-create'` | `confirmKeyRailCycle` | `confirm()` routing | WIRED | `controller:2390`, `:1823` |
| `confirmKeyRailCycle` | `buildKeyRailStandardLoopClip` -> `buildLoopOnlyPublication` -> `ports.commit` | one loop-only transaction | WIRED | `controller:1861-1870`, `:2140-2177` |
| `cancel()` / Escape during `'preparing'` | `confirmKeyRailCycle` generation guard | `acceptedGeneration` + `assertCurrent` | WIRED | `controller:1835`, `:1842`, `:1874`, `:3659-3660`; test `:4066` |
| `prepareRotoKeyDrag` | move-key single-reference order guard | resolver intent path | WIRED | `useRotoTimelineActions.ts` drag dispatch; `resolver:5232-5288` |
| Cell drag gate | rail source-key drag | `dragEligible` in WorkflowStrip | WIRED | `PhysicsPaintWorkflowStrip.tsx:4982`; G-04 pins `resolver.test.ts:4460-4644` |
| `prepareRotoKeyGroupDrag` | move-key-group final-mapping order guard | resolver intent path | WIRED | `resolver:5782`; UI pins `useRotoTimelineActions.test.ts:1810-1838` |
| `buildMoveCandidate` / `buildMoveGroupCandidate` final mapping | `loopSourceOrderIsProvable` | shared helper | WIRED | `resolver:2198`, `:5264`, `:5782` |
| `resolvePhysicPaintRotoLoopSourceExtent` | derivation clamp | `boundedNaturalEnd` | WIRED | `resolver:6396`; effective-end truncation `:6451`, `:6469` |
| `resolvePhysicPaintRotoLoopSourceExtent` | Group classifier and proposers | `resolveGroupBoundedEnd` | WIRED | `GroupLifecycle:321`, used at `:367`, `:396`, `:822`, `:983` |
| Reconcile | staged revision, staged parse, payload clips/records | coordinator choke point | WIRED | `useRotoPhysicalEditCoordinator.ts:2349` |
| `updateLoop` surviving end | rebuilt `frameOverrides` | filter before staging | WIRED | `controller:2269-2309` |
| `isGroupOwnedKeyFrame` | delete-key / delete-key-group / delete-key-rail refusals | `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` | WIRED | `resolver:4893`, `:4942`, `:5032` |
| `classifyRotoDeleteTarget` | group-frame delete proposer | `resolveGroupOwnedDeleteFrame` | WIRED | `useRotoTimelineActions.ts`; G-02 pins `resolver.test.ts:5511-5596` |
| `classifyRotoInsertTarget` / `readRotoInsertTargetInput` | rail insert plan | `resolvePhysicPaintRotoRailInsertPlan` | WIRED | `useRotoTimelineActions.ts`; pins `resolver.test.ts:4116-4430`, `:4705-4749` |
| `resolvePhysicPaintRotoRailKeyInsertTarget` | +Key/paint rail insertion | `addEmptyKey` + paste-key intent | WIRED | `Studio:4987`; `useRotoTimelineActions.ts:2513`; `resolver:4482`, `:5123-5148`; pins `resolver.test.ts:4819-5038` |
| `resolvePhysicPaintRotoRailInsertPlan` rejection | `loop-source-key-insert-rejected` | resolver fail-closed | WIRED | `resolver:4788`, `:5134`; overridden rail without authority `resolver.test.ts:4749` |
| Reconcile | G-02 contraction / extent follow | `resolveGenerateModeContraction` -> lifecycle proposal | WIRED | `GroupLifecycle:855`; pins `resolver.test.ts:5511-5596` |
| `resolveLoopCopyExtent` ceil repeat | `buildDuplicatedLoopClip` stored end | `originalEndExclusive` = preserved duration | WIRED | `RailSetCopy.ts`; pin `RailSetCopy.test.ts:710-745` |
| `reducedForm` -> `framesValidationError` -> `confirmBlocked` | Enter guard and primary disabled | one render-local value | WIRED | `dialog:150-157`, `:302`, `:579` |

### Data-Flow Trace (Level 4)

These are interaction and derivation surfaces, not data-fetching surfaces; no DB or network query is involved.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Scripts panel inspector | `selectedKeyRailInspector` | `deriveKeyRailSegments` over `orderedRealKeys` | Yes | FLOWING |
| Key Rail strip | segment `keyIds` / frames | same derivation, loop-owned keys excluded | Yes | FLOWING |
| Cycle dialog repeat | `repeatText` -> `parsedRepeat` | `keyRailCycleEditTarget.cycleFrameCount` | Yes | FLOWING |
| Reduced dialog readout | `loopReadout` | creation-branch signals not primed for key-rail-create | Stale for this mode (cosmetic; previously recorded info) | STALE |
| Loop clip presentation | lifecycle label | `derivePhysicPaintRotoLoopRanges` over live records | Yes | FLOWING |
| Finite lifecycle extent | `boundedNaturalEnd` | `resolvePhysicPaintRotoLoopSourceExtent` over live source-key frames | Yes | FLOWING |
| Group frame content | classifier bound | same source extent via `resolveGroupBoundedEnd` | Yes | FLOWING |
| Persisted lifecycle extent | reconciled clip + override records | `reconcilePhysicPaintRotoGroupFrames` at the staged write | Yes | FLOWING |
| Pasted Infinity span | `effectiveEndExclusive` -> `repeat` -> stored end | copy payload from the live rail set | Yes | FLOWING |
| Rail drag destination | `moveResult.candidate.mapping` -> reposition/retime | resolver over live real-key identities | Yes | FLOWING |
| Rail insert plan | `loopClips` / override records / trailing shift | `resolvePhysicPaintRotoRailInsertPlan` over live records | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted phase 58 specs (fresh run on the verified tree) | `pnpm exec vitest run` on resolver, timeline actions, controller, loop guards, key-rail cycle | 5 files passed; 722 passed | PASS |
| Full workspace suite | `pnpm --filter efx-motion-editor exec vitest run` | 7143 passed, 1 skipped, 96 todo | PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit`, exit 0 | PASS |
| G-01 coordinator repair | named coordinator tests `:4541`, `:4576` | passed | PASS |
| G-01 extent parity | `physicsPaintRotoGroupParity.test.ts` surviving rows | passed | PASS |
| G-02 contraction | `resolver.test.ts` G-02 rows `:5511-5596` | passed | PASS |
| G-03/G-05/G-06 insert and drag | `resolver.test.ts` G-03/G-05/G-06 rows `:4116-5038` | passed | PASS |
| G-06 UI dispatch | `useRotoTimelineActions.test.ts` rows `:1062`, `:1112`, `:1388`, `:1431` | passed | PASS |
| CR-03 order-preserving + order-breaking group move | `loopGuards.test.ts` rows `:765-793` | passed | PASS |
| Fingerprint regeneration | `gsd-tools verification fingerprint ...` | exit 0; digest recorded in frontmatter | PASS |

### Probe Execution

None. No `scripts/*/tests/probe-*.sh` files exist and the phase declares no executable probes; its verification is spec-bound. Not applicable.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintRotoLoopGuards.test.ts` | RAIL-03, RAIL-06, RAIL-07 | 63 | 0 | No | Value + behavioral (mapping, failure code/copy, derived `unresolved`, effectiveEnd) | PASS |
| `physicsPaintRotoGroupParity.test.ts` | RAIL-03, RAIL-07 | 50 | 0 | No | Value (extent agreement across derivation/proposers/regenerate) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | RAIL-03, RAIL-04, RAIL-05 | 275 | 0 | No | Behavioral (real history, deferred authority/commit interleavings, commit counts) | PASS |
| `useRotoPhysicalEditCoordinator.test.ts` | RAIL-03, RAIL-05, RAIL-07 | 96 | 0 | No | Behavioral (real coordinator -> history, byte-identical canonical pass-through) | PASS |
| `useRotoTimelineActions.test.ts` | RAIL-01, RAIL-06 | 147 | 0 | No | Behavioral (prepare/commit dispatch counts, classifier routing, rail insert) | PASS |
| `physicsPaintRotoRailSetCopy.test.ts` | RAIL-06, RAIL-07 | 26 | 0 | No | Value (copy payload, paste extent, stored end) | PASS |
| `physicsPaintRotoKeyRailCycle.test.ts` | RAIL-03, RAIL-07 | 8 | 0 | No | Value (record shape, extents, classification) | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | RAIL-02, RAIL-04 | 108 | 0 | No | Behavioral (rendered vnode gates + handler dispatch) | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | RAIL-01 | 61 | 0 | No | Behavioral + source anchors | PASS |
| `PhysicsPaintKeyRail.test.tsx` (via launcher) | RAIL-01 | 17 | 0 | No | Behavioral (click timing, keyboard) | PASS |
| `PhysicsPaintStudio.test.ts` | RAIL-01 | 336 | 0 | No | Behavioral + source anchors (memo/anchor/handlers/paint promotion) | PASS |

**Disabled tests on requirements:** 0 -> no blocker.
**Circular patterns detected:** 0 -> no blocker.
**Insufficient assertions:** 0 -> no warning.
**Debt markers:** 0 `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/PLACEHOLDER in the changed implementation and test files.
**Skipped/only markers in phase files:** 0.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RAIL-01 | 58-03, 58-04, 58-05 | Open Edit Rail for a normal Key Rail from the sidebar using the same entry point loop clips use | SATISFIED | Truths 1-4, 21-24; all wiring verified; UAT rows 1, 3 pass |
| RAIL-02 | 58-04, 58-08 | Modal shows only cycle count and Infinity, prefilled at 1, no script/motion/reveal controls | SATISFIED | Truths 4, 6, 37, 38; UAT rows 2, 6 pass |
| RAIL-03 | 58-02, 58-03, 58-09 | Confirm converts the segment into a provenance-free Standard clip and the rail presents as Standard; the converted cycle follows the surviving source extent | SATISFIED | Truths 7, 9-12, 39-45; UAT rows 2, 7 pass |
| RAIL-04 | 58-02, 58-06, 58-08 | Cancelling performs zero writes (no store mutation, revision bump, or undo entry) | SATISFIED | Truths 5, 15, 26-30, 38; UAT row 4 pass |
| RAIL-05 | 58-02, 58-06 | Conversion is exactly one undo step; cancel and refusal leave the ledger untouched | SATISFIED | Truths 13, 14, 27-31, 43 |
| RAIL-06 | 58-01, 58-07, 58-10 | Single-key drag under Law A; keys referenced by more than one loop keep D-11; shared linked-cycle behavior never silently relaxed, including the group move | SATISFIED | Truths 8, 16-20, 32-36, 46-52; truth 18/19/20 are user-approved overrides; UAT rows 5, 10 pass |
| RAIL-07 | 58-01, 58-02, 58-07, 58-09, 58-10 | Regression-locked behavior, existing D-11 tests green, no `.mce` schema change | SATISFIED | Truths 25, 32-52; no `.mce`/parser/Rust change; full suite green; UAT rows 7-10 pass |

No orphaned requirements: all seven IDs appear in plan frontmatter, and `.planning/REQUIREMENTS.md` maps exactly these seven to Phase 58 (all `[x]`, Phase 58 Complete).

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (17/17 honored; gate returned `{skipped: false, blocking: false, total: 17, honored: 17, not_honored: []}`). The UAT-approved G-02..G-06 behaviors are additional user decisions recorded in `58-UAT.md`; they supersede three plan-level assertions (truths 18-20) but do not weaken the D-11/D-16 ownership law or any RAIL acceptance criterion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `physicsPaintRotoGroupLifecycle.ts` | 321-337 | `capacity === undefined` fallback unreachable from typed callers — IN-01 | Info | Dead defensive branch; every caller holds a required `number` capacity |
| `physicsPaintStudio.css` | 2840 | Dead `.physics-paint-play-script-standard-rail-value` rule — IN-02 | Info | Dead CSS only |
| `physicsPaintRotoPlayScriptController.ts` | 1781-1783 | Open-time `loopClipsOwnAnyKey` unreachable from production — IN-03 | Info | Redundant guard; the confirm-time check at `:1846` remains reachable |
| `physicsPaintRotoPlayScriptController.ts` | 1870-1872 | Post-commit comment still implies a cancel can land during `'committing'` — IN-04 | Info | Comment-only; `cancel()` no-ops while busy (`:3659-3660`) |

No blocking anti-patterns. CR-01 and WR-01 were fixed in `e50af31c0`; CR-02, CR-03, and WR-02 were closed by 58-07, 58-10, and 58-08. The four info findings are `open` in `58-REVIEW-DISPOSITION.md` and do not affect a must-have truth.

### Documented Deviations

1. **Reveal rails are exempt from the G-01 source-extent clamp (58-09 deviation 4, `b25482a9c`).** `resolvePhysicPaintRotoLoopSourceExtent` returns null when `clip.railKind === 'reveal'` (`model:1009`), and `loopGuards.test.ts:1293-1305` pins the reveal stretch. Deliberate: the reveal stretch law owns the reveal extent, and clamping would break WR-01 reveal behavior.
2. **Transient `app/src/types/physicPaint.ts` fields (`e41c2f6a4`).** `railInsertGroupId` on the paste-key intent and `railInsert`/`trailingShift` on the semantic delta were added for the UAT-approved G-05/G-06 rail insert. These are in-memory edit-contract types; no `.mce` field, parser shape, Rust, storage, or persisted schema changed. This is the only plan-prohibition deviation and is user-approved (2026-11-03).
3. **Plan truths 18-20 are superseded by UAT G-02..G-06** (see Overrides). The goal-level laws they protect remain enforced: exactly-one-loop acceptance, two-or-more-loop rejection, verbatim D-16 copy, and no silent source-key rewrites.

### Human Verification Required

None. All ten `human_needed` items from the previous report were exercised live in the packaged app and passed (`58-UAT.md`: 10 passed, 0 issues, updated 2026-11-03T19:14:48Z). The UAT also directly exercised the new rail Delete/Insert/drag behavior (G-02..G-05) and re-tested G-01 after the contraction fix.

### Gaps Summary

No must-have gaps. The phase goal is achieved in the current codebase:

- A normal Key Rail exposes the Edit Rail action and converts to a provenance-free Standard cycle with a reduced Cycle/Infinity modal, zero-write cancel, and one-command undo/redo.
- A single key on a Motion/Static/Reveal rail can be dragged to choose its spacing, including band retiming at both ends; two-or-more-loop ownership still rejects with the locked rigid-group copy and never silently moves.
- The six post-report UAT fixes are additive, regression-pinned, and user-approved. The only deviations are the three user-approved truth supersessions and the transient types addition, none of which relaxes linked-cycle ownership or changes `.mce` persisted schema.

---

_Verified: 2026-11-03T20:20:01Z_
_Verifier: Claude (gsd-verifier)_
