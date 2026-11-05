---
phase: 58-rail-editing-regressions
verified: 2026-11-05T11:31:32Z
status: gaps_found
score: 52/56 must-haves verified
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
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/types/physicPaint.test.ts
  - app/src/types/physicPaint.ts
covered_digest: "v4:sha256:82e7db3d7e1052c59ce40a6ca18a90c523725ddfceac92527f5964f1af59e9f5"
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
  previous_status: passed
  previous_score: 52/52
  gaps_closed: []
  gaps_remaining:
    - "RAIL-06: a single-key move that ripples another clip's referenced source keys can push them outside every visible range; the guard only scans the moved key's own referencing clip (CR-04a/b)"
    - "RAIL-06: a whole-cycle group drag updates placementStart but leaves phaseOrigin/originalEndExclusive/visibleRanges stale, hiding a moved source key (CR-04c)"
    - "UAT-approved G-03 insert rejects every insert at or left of a spaced source cycle because the plan compares a key count with a cycle span (CR-01)"
    - "Post-phase v2.0.1 append accepts scripted and Reveal rails, mutating their sourceKeyIds and lifecycle (CR-05)"
  regressions:
    - "CR-05 introduced by post-phase quick bcbdecb71 (v2.0.1) in the covered resolver surface"
gaps:
  - truth: "The UAT-approved Insert extension (G-03) accepts a canonical spaced source cycle at any destination, including at or left of its phase origin"
    status: failed
    reason: "resolvePhysicPaintRotoRailInsertPlan counts source keys whose frame is >= the destination (`moved`) but compares that count with the cycle SPAN (`cycleLength = lastSourceFrame - phaseOrigin + 1`). The whole-shift branch therefore only runs for a contiguous cycle; a spaced cycle falls through to `insertOffset <= 0` and rejects. The plan is all-or-nothing across every clip, so one spaced rail to the right makes a global Insert at frame 0 fail."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
        issue: "`moved === cycleLength` at :4944 compares like units; spaced source keys (offsets 0/2/4: count 3, span 5) never match, and :4957-4958 rejects a destination at the phase origin."
    missing:
      - "Compare `moved` with `typed.sourceKeyIds.length` at :4944; keep `cycleLength` for `insertOffset` and `extendLoopClipCycle`"
      - "Regression tests: insert-slot at frame 0 with a spaced rail to the right, and at the spaced rail's phase origin"
  - truth: "A single-key move that ripples another clip's referenced source keys keeps them inside that clip's visible ranges; the guard checks every referencing clip, not only the moved key's clip"
    status: failed
    reason: "The v2.0.1 ghost-source guard runs only when the moved key itself is referenced by exactly one clip and scans only that clip's sourceKeyIds. A move of an unowned key still ripples survivors through cutSource/openAndInsert; a rippled survivor owned by another clip is never checked, `nextLoopClips` stays null, and the source key lands outside every visible fragment. Presentation then paints it as an empty ghost cell and removes it from ordinary key rails, so the real key becomes invisible and unselectable while the edit reports success."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
        issue: "Guard at :5630-5648 is scoped to `referencingClips.length === 1` and `referencingClips[0].sourceKeyIds`; move-key-group has no equivalent coverage."
      - path: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
        issue: "`resolveGhostSourceKeyIds` (:240-263) hides out-of-range sources as empty cells (:716-720); Studio excludes group-owned source keys from ordinary key rails."
    missing:
      - "After the final mapping, iterate every clip in `moveCandidate.nextLoopClips ?? loopClips` and every source key; reject when a key covered before the move is not covered after it"
      - "Apply the same check after the move-key-group guard (:6153-6161)"
      - "Regression tests for the two probe scenarios (unowned-key move into a gapped rail; unowned-key cut that shifts a canonical cycle)"
  - truth: "A whole-cycle group drag retimes every following lifecycle band so no moved source key lands outside its visible ranges (or refuses)"
    status: failed
    reason: "buildMoveGroupCandidate calls `computeSourceAttachedLoopPlacementFollow` without `retimeFiniteLifecycle`, so a canonical lifecycle rail follows the new placementStart while phaseOrigin, originalEndExclusive, and visibleRanges stay at the old band. Every moved source key beyond the stale end is hidden as a ghost, and no guard exists on the group branch."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
        issue: "Group branch :2363-2368 omits the single-key branch's `true` retime argument (:5617-5628); move-key-group :6153-6161 only proves source order."
    missing:
      - "Retime every lifecycle clip that follows the whole-cycle group drag (`retimeFiniteLifecycle = true`), or reject when a moved source key would leave its visible ranges"
      - "Regression test: whole-cycle group drag +2 on a canonical spaced rail leaves every source key covered"
  - truth: "The v2.0.1 post-end +Key/paint append is restricted to the Standard merged rail (no scriptId, not Reveal); Playscript and Reveal rails keep the detached-key behavior"
    status: failed
    reason: "The append branch qualifies any single-range repeat-1 rail with painted overrides. It never applies `isStandardMergedLoopClip`, while the dissolve authority it preempts requires a complete Standard rail and rejects scripted/Reveal clips. An overridden Playscript or Reveal rail therefore takes the append: originalEndExclusive/visibleRanges are rewritten and the new key is spliced into sourceKeyIds with scriptId/railKind intact."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
        issue: "Append qualification :4678-4692 lacks `isStandardMergedLoopClip`; buildAppendedRailClip :4536-4548 rewrites the lifecycle; the sourceKeyIds splice runs in the paste path."
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts"
        issue: "`isStandardMergedLoopClip` (:536-540) is the discriminator the append should use, as the dissolve authority does at resolver :4838-4847."
    missing:
      - "Gate the append with `isStandardMergedLoopClip(clip)` (rejects scriptId and railKind 'reveal')"
      - "Regression tests: overridden scripted rail and overridden Reveal rail keep the detached-key behavior"
deferred:
  - truth: "Motion channels"
    addressed_in: "v2.1.0"
    evidence: "ROADMAP v7 timeline rails: 'Motion channels stay in v2.1.0.'"
advisory:
  - finding: "Reduced Cycle dialog keeps the fixed 700x660 shell around one ~150px card, leaving roughly 376px vertical / 478px horizontal dead space"
    category: other
    reason: "58-UI-REVIEW.md priority fix 1. Visual composition only; the D-05 reduced form is contract-correct."
    evidence_status: "none provided — source/CSS-derived, no live capture"
  - finding: "Edit Rail / Create Cycle refusal reasons are returned or logged but never rendered; rejectLoopOp sets error to null, so a refused action leaves the footer on 'Ready'"
    category: other
    reason: "58-UI-REVIEW.md priority fix 2. UX feedback polish outside the RAIL behavior; refusal paths write nothing."
    evidence_status: "none provided — source-derived, no live capture"
  - finding: "During the 'committing' phase the footer Cancel and primary remain enabled-looking while cancel() no-ops and the primary silently refuses"
    category: other
    reason: "58-UI-REVIEW.md priority fix 3. UX polish; the WR-01 fix deliberately makes this window a no-op so no state is stranded."
    evidence_status: "none provided — source-derived, no live capture"
  - finding: "Pasting a rail-set copy taken from an already-stale finite lifecycle rail can be rejected fail-closed: the child coordinator's G-01 reconcile trims the pasted clip while the paste semantic delta was built from the untrimmed proposal"
    category: other
    reason: "Narrow residual of combining lazy repair with the paste semantic-delta recompute; rejection writes nothing and is retryable after the source rail is repaired."
    evidence_status: "none provided — source-derived, no failing test run"
  - finding: "17 further review findings remain open in 58-REVIEW-DISPOSITION.md (WR-01, WR-02, WR-03, WR-05, IN-01..IN-10)"
    category: other
    reason: "New-scope source analysis from 58-REVIEW.md; not independently reproduced with a deterministic failing test in this verification. The four critical findings are reproduced and scored above."
    evidence_status: "source analysis only — no named failing test"
---

# Phase 58: Rail editing regressions Verification Report

**Phase Goal:** A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Verified:** 2026-11-05T11:31:32Z (current tree `51e6db05a`, working tree clean)
**Status:** gaps_found
**Re-verification:** Yes — after post-verification commits `02de1ecc5` and `bcbdecb71`

## Goal Achievement

The first clause of the goal is achieved. The Key Rail → Standard conversion path (RAIL-01..RAIL-05) is intact and verifiable end to end: inspector takeover, reduced Cycle/Infinity modal, provenance-free Standard record, one loop-only commit, one-command undo/redo, and a generation-fenced cancel path. The 14 targeted suites are green (1513 tests) and typecheck is clean.

The second clause is not achieved. The qualifier "without silently relaxing linked-cycle ownership" is falsified on the current tree. The v2.0.1 ghost-source guard added by `02de1ecc5` only inspects the moved key's own referencing clip. A single-key drag of an **unowned** key still ripples other clips' source keys; when a rippled source key leaves every visible fragment, no clip follows the change (`nextLoopClips` stays null) and the presentation hides the real key as an empty ghost cell while the resolver reports success. The same defect appears in the group branch: a whole-cycle group drag updates `placementStart` but leaves `phaseOrigin`/`originalEndExclusive`/`visibleRanges` at the old band, hiding a moved source key. Both are reproduced through the real resolver with temporary probes (see Behavioral Spot-Checks).

Two further failures were verified on the current tree: the UAT-approved G-03 spaced-rail insert (CR-01) rejects every insert at or left of a spaced source cycle, and the post-phase v2.0.1 append (CR-05, `bcbdecb71`) accepts scripted and Reveal rails, mutating their `sourceKeyIds` and lifecycle. CR-01 and CR-04 predate the two post-verification commits but were not exercised by the previous verification; CR-05 is a regression introduced after the phase by a v2.0.1 quick in the covered resolver surface.

### Observable Truths

Status vocabulary: VERIFIED = code + tests support it; PASSED (override) = the planned assertion is superseded by explicitly user-approved UAT behavior; FAILED = falsified on the current tree.

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Selecting a normal Key Rail exposes the sidebar Edit Rail action: the Scripts panel is replaced by an inspector with Edit Rail and Close | VERIFIED | `PhysicsPaintScriptsPanel.tsx:147-160` takeover branch; Edit Rail `:153`, Close `:154`, Frames/Keys/Type `:157-159`; `PhysicsPaintStudio.tsx:7247`; ScriptsPanel spec green |
| 2 | Double-clicking a Key Rail invokes the open intent: plain second click within 220 ms, never a move member, never while busy | VERIFIED | `PhysicsPaintKeyRail.tsx:32` constant, `:272-294` gesture/elapsed/plain gate; `PhysicsPaintWorkflowStrip.tsx:5235`; `PhysicsPaintStudio.tsx:11075`; KeyRail launcher green |
| 3 | Enter on a focused Key Rail selects it then invokes the same open intent; Space still plain-selects; Escape still hides the tooltip | VERIFIED | `PhysicsPaintKeyRail.tsx:315-316`; same wiring path as truth 2; KeyRail launcher green |
| 4 | The conversion modal shows only the Cycle stepper and Infinity switch, prefilled at 1 and unchecked, with no tabs, rail type, frames-per-cycle, Motion, source cycle, seed, or Regenerate | VERIFIED | `reducedForm` `PhysicsPaintPlayScriptDialog.tsx:72`, `surfaceCompact :149`, reduced card `:384`; dialog spec (108 tests) green |
| 5 | Cancel performs zero writes: no store mutation, no revision bump, no undo entry | VERIFIED | `acceptedGeneration = ++generation` :1835, `assertCurrent` :1842/:1874, AbortError → `'cancelled'` without `fail()` :1882-1893; controller spec green |
| 6 | The primary action labels Create Cycle for a first conversion and Update Rail for an existing Standard clip, and both route through `playScript.confirm()` | VERIFIED | Dialog labels near `:574-598`; controller routing `:2390`; dialog/controller specs green |
| 7 | Confirming creates one provenance-free Standard clip: `sourceKeyIds` in segment order, `placementStart` = first key frame, repeat from the reduced form, no `scriptId` / `railKind` / `motion` | VERIFIED | `buildKeyRailStandardLoopClip` `physicsPaintRotoRunScriptStacking.ts:597-611`; `confirmKeyRailCycle` `controller:1849-1861`; KeyRailCycle/controller specs green |
| 8 | Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent "Source missing" clip with no in-UI repair | VERIFIED | Law A comparator `resolver:5575-5577`; order guard `:5607-5611`; G-04 retime `:5617-5628`; ghost guard `:5630-5648`; loopGuards spec green (scope: the moved key's own clip; cross-clip is truth 54) |
| 9 | The clip classifies as Standard and presents via the existing `.rail-kind-standard` pill; the existing Edit Rail dialog owns Repeat/Infinity afterwards | VERIFIED | `isStandardMergedLoopClip` `stacking:536-540`; `KeyRailCycle` spec green; CSS `.rail-kind-standard` |
| 10 | A gapped segment keeps its span: cycle length = last - first + 1, extent clamped to capacity, infinity lifecycle-less | VERIFIED | `cycleFrameCount` `controller:1850-1853`; KeyRailCycle spec green |
| 11 | A single-key segment converts to a 1-frame cycle | VERIFIED | KeyRailCycle spec single-key case green |
| 12 | A second conversion over already loop-owned keys is refused before any commit | VERIFIED | Open-time target build `controller:1781-1793`; confirm-time `loopClipsOwnAnyKey` `:1846`; controller spec green |
| 13 | Undo restores the pre-conversion Key Rail and Redo re-applies the conversion as one command | VERIFIED | Controller history spec green; one-command publication `:2140-2177` |
| 14 | The conversion is exactly one `ports.commit` with `semanticDelta.kind 'play-script'`, `loopOnly: true`, `affectedEndAppFrame = anchor - 1`, `freshKeyIds: []` | VERIFIED | `buildLoopOnlyPublication` `controller:2140-2177`; confirm `:1861-1870`; controller spec green |
| 15 | Cancel and every refusal perform zero commits and zero history entries | VERIFIED | Generation fence truth 5; refusals return before commit `:1843-1846`; controller spec green |
| 16 | A single-key drag on a key referenced by exactly one loop is accepted and lands on the requested frame (Law A) | VERIFIED | `resolver:5575-5577` comparator; loopGuards Law A tests green |
| 17 | A key referenced by two or more loops is rejected, never moves silently, with `loop-source-key-move-rejected`, `move-key`, and the verbatim D-16 copy | VERIFIED | `resolver:5575-5577`; locked copy `:937`; loopGuards spec green |
| 18 | An accepted single-key move never emits `nextLoopClips`, so `placementStart` stays put | PASSED (override) | Superseded by UAT G-04: single-key branch retimes the band `resolver:5617-5628` via `computeSourceAttachedLoopPlacementFollow` (`:1045`); two-or-more guard untouched (truth 17) |
| 19 | Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy | PASSED (override) | Force Spacing guard `resolver:5654-5680`; D-11/D-16 copy `:937`; guard paths intact. Note: G-02 delete contraction was later retired (hole semantics, truth 41 unchanged); the spaced-rail insert gap is scored as truth 53 |
| 20 | The acceptance is entirely inside the resolver: `prepareRotoKeyDrag` / `commitRotoKeyDrag` and the WorkflowStrip drag dispatch are untouched | PASSED (override) | UAT G-04 required arming rail keys: `PhysicsPaintWorkflowStrip.tsx:5355` drag gate; prepare/commit untouched; resolver remains the acceptance authority |
| 21 | Edit Rail and double-click/Enter reach one Studio handler that selects the rail first, then delegates to `openKeyRailCycleEdit`, returning a Promise on every path | VERIFIED | `PhysicsPaintStudio.tsx:4831-4841` select-then-open, Promise on every branch |
| 22 | A 2+ rail set whose anchor is a Key Rail projects with setSize >= 2, Edit Rail visible and disabled with "Select a single rail to edit it.", and no bulk conversion | VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:127-143`; Studio memo `:4900-4907`; Studio spec green |
| 23 | Close clears both `selectedRotoKeyRail` and `railSetSelection`, so the takeover dismisses in the plain and rail-set states | VERIFIED | `PhysicsPaintStudio.tsx:4846-4849`; Studio spec green |
| 24 | The inspector shows exactly Frames F{first}-F{last}, Keys n, Type Standard, and keeps one object identity across unrelated renders | VERIFIED | `physicsPaintKeyRailPresentation.ts:127-143`; stable memo deps `Studio:4900-4907` |
| 25 | No `.mce` schema field is added or changed; resolver, undo, and existing D-11 guard tests are green or deliberately updated | VERIFIED | Phase diff contains no `.mce`, schema, parser, or `src-tauri` path; the only `app/src/types` change is transient intent/semantic-delta typing; 14 targeted suites green; `tsc --noEmit` exit 0 |
| 26 | Cancelling while the conversion is still awaiting authority never calls `ports.commit`, lands in `'cancelled'`, leaves error null, and produces no accepted output | VERIFIED | `controller:1842` assertCurrent before ack; controller spec green |
| 27 | A cancelled conversion keeps `keyRailCycleEditTarget` and the open dialog, so a later confirm retries and commits exactly once | VERIFIED | `controller:1882-1893`; controller spec green |
| 28 | Cancelling while the phase is `'committing'` neither clears the target nor closes the dialog; after that commit fails, Create Cycle retries and commits | VERIFIED | `cancel()` busy early return `controller:3659-3660`; controller spec green |
| 29 | A cancel before confirm still closes the dialog with zero writes | VERIFIED | Controller spec green |
| 30 | An AbortError is never routed through `fail()`: no `'Play Script failed'` phase, no error text, no error-level log | VERIFIED | `controller:1882-1893`; controller spec green |
| 31 | The successful conversion path still commits exactly once, clears the target, and closes the dialog | VERIFIED | `controller:1861-1893`; controller spec green |
| 32 | With exactly one referencing loop, a move-key whose final mapping breaks strict increase is rejected with `loop-source-key-move-rejected`, `operationKind move-key`, and the verbatim D-16 copy | VERIFIED | `resolver:5607-5611`; loopGuards spec green |
| 33 | The order check reads the FINAL candidate mapping (ripple-proof) and fails closed when a referenced source key is absent from the mapping | VERIFIED | `loopSourceOrderIsProvable` `resolver:2235-2247`; move branch reads `moveCandidate.mapping`; loopGuards spec green |
| 34 | A one-element source cycle is always order-preserving and its only key can move | VERIFIED | LoopGuards spec green |
| 35 | A key referenced by no loop, and a no-change drag back to its own cell, are accepted | VERIFIED | LoopGuards spec green |
| 36 | `sourceKeyIds` is never re-sorted or mutated; an order-breaking destination is rejected rather than re-sequenced | VERIFIED | Guard only reads `sourceKeyIds`; loopGuards preservation pin green. The v2.0.1 append splices a NEW key by design (not a re-sort); see truth 56 |
| 37 | In key-rail-create, Enter calls `confirm()` exactly once despite the stale frames error, and the primary button is enabled | VERIFIED | Dialog `confirmBlocked` `:159`, Enter guard `:306`; dialog spec green |
| 38 | The Enter guard and primary disabled share one `confirmBlocked`; repeatError blocks both; the merged Standard reduced form also confirms; full apply, Reveal, and stack-collision surfaces keep their prior gating; Escape/canCancel precedence unchanged | VERIFIED | Dialog `:159`, `:306`, primary near `:574`; dialog spec green |
| 39 | Group override records never survive outside every referencing clip's surviving extent; the empty-trim fail-safe leaves the clip byte-identical | VERIFIED | `reconcilePhysicPaintRotoGroupFrames` `model:1062`; coordinator spec green |
| 40 | A finite lifecycle clip's derived range never ends past `phaseOrigin + cycleLength * repeat` from current source-key positions (capacity-clamped); frames beyond resolve empty | VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent` `model:1003-1031`; `resolveGroupBoundedEnd` `GroupLifecycle:320-337`; groupParity spec green |
| 41 | Deleting a real key inside a lifecycle clip's surviving extent is refused with the locked copy, and a key past that bound deletes normally while its stale paint sheet is pruned whenever trimmed ranges stay non-empty | VERIFIED | `isGroupOwnedKeyFrame` `resolver:1170`; copy `:946`; fail calls `:5205`, `:5254`, `:5344`; specs green |
| 42 | Repeat contraction filters the rebuilt clip's `frameOverrides` to frames strictly before the source-derived surviving end; an override inside the surviving end but past the new end still raises the unchanged copy | VERIFIED | `updateLoop` `controller:2269-2309`; controller spec green |
| 43 | After the first accepted write on an already-stale document, the persisted clip extent and override collection are canonical in one undo step that also restores the deleted key | VERIFIED | Coordinator spec green (`useRotoPhysicalEditCoordinator.test.ts`) |
| 44 | A stale document whose `sourceKeyIds` all still exist loads and resolves without "Source missing"; a genuinely dangling source id keeps today's result; no load-time migration and no revision churn | VERIFIED | `loopGuards` G-01 rows green; extent helper non-mutating |
| 45 | No `.mce` field, parser shape, storage mode, or persisted schema changes; D-08..D-11 conversion semantics, D-15 guard surfaces, D-16 copy, and D-17 locking are preserved, with the one added G-01 ownership-parity refusal | VERIFIED | Phase diff has no `.mce`/parser/Rust/storage change; G-01 refusal additive; specs green |
| 46 | An order-preserving partial-cycle group move stays accepted: A,B 10-11 → 8-9 under loop(10,5) yields A:8, B:9, C:12, D:13, E:14, `nextLoopClips` null, `placementStart` 10, unresolved null | VERIFIED | `loopGuards` CR-03 rows green |
| 47 | An order-breaking partial-cycle group move is rejected: A,B → cell 20 projects A:20, B:21, C:12 and fails with `loop-source-key-move-rejected`, `operationKind move-key-group`, verbatim D-16 copy | VERIFIED | `resolver:6153-6161`; `loopGuards` CR-03 rows green |
| 48 | The order proof reads the final candidate mapping, so a moved key landing past a non-moved source key is caught, and a clip source key absent from the mapping fails closed | VERIFIED | `loopSourceOrderIsProvable` `resolver:2235-2247`; group guard `:6156`; specs green |
| 49 | Every clip whose `sourceKeyIds` intersect the moved key set is projected; a clip the move does not touch keeps today's behavior even when already unresolved | VERIFIED | Intersection-scoped loop `resolver:6154-6157`; specs green |
| 50 | `move-key` and `move-key-group` share one order helper and one failure call, so CR-02's behavior is byte-identical and its existing tests stay unedited and green | VERIFIED | Shared helper `resolver:2235`; calls `:5607`, `:6156`; specs green |
| 51 | On the UI path an order-breaking partial-cycle group drag prepares as `ok:false` carrying the locked copy and never calls `executePhysicalEdit`, while the order-preserving drag commits exactly once | VERIFIED | `useRotoTimelineActions` spec green; drag dispatch `WorkflowStrip:4675-4676` |
| 52 | Whole-cycle rigid group moves and the two-loop D-04 `placementStart` follow, no-change drags, one-element cycles, and ordinary moves behave as before; no `.mce`, parser, failure-union, or copy changes | VERIFIED | `loopGuards` D-04 rows green; no schema/failure-union change. The canonical-band retime gap is scored separately as truth 55 |
| 53 | The UAT-approved Insert extension (G-03) accepts a canonical spaced source cycle at any destination, including at or left of its phase origin | FAILED | Probe: spaced rail 10/12/14, `insert-slot @ 0` → `loop-source-key-insert-rejected`; `@ 11` ok; contiguous rail `@ 0` ok. Cause: `moved === cycleLength` `resolver:4944`, reject `:4957-4958` |
| 54 | A single-key move that ripples another clip's referenced source keys keeps them inside that clip's visible ranges; the guard checks every referencing clip, not only the moved key's clip | FAILED | Probe CR-04a: move X 16→13 with gapped rail → `ok:true`, mapping `{S1:10,S2:15,X:13}`, `nextLoopClips:null`; S2@15 outside `[13,15)`. Probe CR-04b: move X 8→20 with canonical rail → `ok:true`, mapping `{X:20,S1:9,S2:13}`, sources outside `[10,15)`. Guard scope `resolver:5630-5648` |
| 55 | A whole-cycle group drag retimes every following lifecycle band so no moved source key lands outside its visible ranges (or refuses) | FAILED | Probe CR-04c: move K1/K3/K5 +2 → `ok:true`, mapping `{K1:3,K3:5,K5:7}`; clip `placementStart:3, phaseOrigin:1, originalEndExclusive:6, visibleRanges:[{1,6}]`; K5@7 outside. Group branch `resolver:2363-2368` omits `retimeFiniteLifecycle` |
| 56 | The v2.0.1 post-end +Key/paint append is restricted to the Standard merged rail (no scriptId, not Reveal); Playscript and Reveal rails keep the detached-key behavior | FAILED | Probe CR-05: both scripted and Reveal overridden rails return a target `{loopId:'rail-1',cycleOffset:5,insertionAppFrame:6}`; the edit returns `ok:true` with `sourceKeyIds:['K1','K3','K5','NEW']`, `originalEndExclusive:7`, `scriptId:'action-1'` intact. Append `resolver:4678-4692`; discriminant authority `stacking:536-540`, dissolve `resolver:4838-4847` |

**Score:** 52/56 truths verified (49 VERIFIED + 3 PASSED (override); 4 FAILED; 0 behavior-unverified).

### Later User-Approved Supersessions (not phase failures)

| Change | Date / Commit | Effect on this report |
| ------ | ------------- | --------------------- |
| G-02 delete contraction retired in favor of hole semantics | 2026-11-04, `1bfbf2672` (quick 261104-bop) | `physicsPaintRotoGroupLifecycle.ts:560-563`, `:663-680`: a deleted Rail phase leaves the visible ranges EMPTY; later source keys never ripple. This supersedes the 2026-11-03 UAT-approved contraction. It is a later user-approved law, not a Phase 58 regression; truth 41 (group-owned delete refusal) and truth 19's override are unaffected |
| v7 timeline rails quick delivered | v2.0.1, VIS-01..VIS-08 all `[x]` | The previously deferred per-frame cells, cycle grays, and rail colour dot are shipped; the item is no longer deferred |

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Motion channels | v2.1.0 | ROADMAP v7 timeline rails: "Motion channels stay in v2.1.0." |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Reduced Cycle dialog dead space (~376px vertical / ~478px horizontal) | other | 58-UI-REVIEW.md priority fix 1; visual composition only; no live capture |
| 2 | Refusal reasons not rendered; `rejectLoopOp` sets error null | other | 58-UI-REVIEW.md priority fix 2; refusal paths write nothing |
| 3 | During `'committing'`, Cancel and primary look enabled while both no-op | other | 58-UI-REVIEW.md priority fix 3; deliberate no-op window |
| 4 | Pasting a rail-set copy from an already-stale finite lifecycle rail can be rejected fail-closed (reconcile vs paste semantic-delta recompute) | other | Source-derived, no failing test run; rejection writes nothing and is retryable |
| 5 | 17 open review findings in 58-REVIEW-DISPOSITION.md (WR-01/02/03/05, IN-01..IN-10) | other | New-scope source analysis, not independently reproduced; the four critical findings are scored above |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `physicsPaintRotoPhysicalResolver.ts` | Law A guard, final-mapping order guards, rail reposition/retime, rail insert plan, Group ownership, G-01 bounded derivation | VERIFIED (behavior gaps) | Exists, substantive, wired. `loopSourceOrderIsProvable:2235`; move-key `:5575-5648`; force-spacing `:5654-5680`; move-key-group `:6153-6161`; `isGroupOwnedKeyFrame:1170`; rail helpers `:2192`, `:4536`, `:4616`, `:4891`; extent derivation `:6396+`. Gaps: truths 53-56 |
| `physicsPaintRotoPhysicalModel.ts` | Shared source-extent helper, reconcile, override pruning | VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent:1003-1031` (reveal null `:1009`); `reconcilePhysicPaintRotoGroupFrames:1062+`; non-mutating |
| `useRotoPhysicalEditCoordinator.ts` | Reconcile at the write choke point before revision/payload | VERIFIED | Reconcile feeds staged revision, staged parse, and payload clips/records; coordinator spec green |
| `physicsPaintRotoGroupLifecycle.ts` | Source-extent bound; delete hole law | VERIFIED | `resolveGroupBoundedEnd:320`; `proposePhysicPaintRotoDeleteGroupFrame:626`; hole semantics `:663-680` (later user-approved law) |
| `physicsPaintRotoPlayScriptController.ts` | Update Rail surviving end, override pruning, generation-fenced conversion, busy-phase cancel | VERIFIED | `confirmKeyRailCycle:1823-1897`; `buildLoopOnlyPublication:2140`; `updateLoop:2269-2309`; `cancel()` busy early return `:3659-3660` |
| `physicsPaintRotoRailSetCopy.ts` | Ceil cycle count for a frozen Infinity span | VERIFIED | RailSetCopy spec green |
| `useRotoTimelineActions.ts` | Group-owned delete routing, rail key insert target, +Key/paint rail insert, drag dispatch | VERIFIED (downstream gaps) | Rail insert target `:2513`; `addEmptyKey` rail path `:2461-2542`; drag intent `:2563`, `:2638`; passes `loopClips` straight to the resolver, so truths 54/55 are reachable |
| `physicsPaintRotoLoopGuards.test.ts` | Law A boundary pair, CR-02 rejection, G-01 extent/ownership, CR-03 edge pins | VERIFIED | Green; does not cover the CR-04 cross-clip scenarios (IN-10) |
| `physicsPaintRotoGroupParity.test.ts` | Extent agreement across derivation/proposers/regenerate | VERIFIED | Green |
| `physicsPaintRotoPlayScriptController.test.ts` | In-flight cancel, retry, busy cancel, override contraction | VERIFIED | Green |
| `useRotoPhysicalEditCoordinator.test.ts` | Stale-cycle repair, one undo step, canonical pass-through, infinity untouched | VERIFIED | Green |
| `useRotoTimelineActions.test.ts` | Delete classifier parity, CR-03 UI dispatch pins, rail insert rows | VERIFIED | Green; append scripted/Reveal fixtures absent (truth 56) |
| `physicsPaintRotoRailSetCopy.test.ts` | Non-whole-cycle paste regression | VERIFIED | Green |
| `buildKeyRailStandardLoopClip` (`physicsPaintRotoRunScriptStacking.ts`) | Strict whitelist, provenance-free | VERIFIED | `:597-611`; discriminator `:536-540` |
| `KeyRailCycleEditTarget`, `openKeyRailCycleEdit`, `confirmKeyRailCycle` | Frozen target, zero writes on open, generation-fenced confirm | VERIFIED | `controller:1781-1897` |
| `SelectedKeyRailInspectorPresentation`, `projectSelectedKeyRailInspector` | Frames/Keys/Type, disabled reason | VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:127-143` |
| `PhysicsPaintScriptsPanel` takeover props | Edit Rail and Close | VERIFIED | `:147-160`; spec green |
| `PhysicsPaintKeyRail` open-intent prop | Double-click + Enter | VERIFIED | `:272-316`; launcher green |
| `PhysicsPaintWorkflowStrip` open-intent prop and drag gate | Forwarding; rail keys arm a drag | VERIFIED | `:468`, `:5235`, `:5355`, `:4675-4676`; spec green |
| `ReducedCycleCard` | Cycle stepper + Infinity switch only | VERIFIED | `PhysicsPaintPlayScriptCards.tsx`; dialog spec green |
| `reducedForm`, `confirmBlocked`, reduced branch | Reduced surface + shared confirm gate | VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:72`, `:159`, `:306`, `:384` |
| `PhysicsPaintStudio.tsx` inspector memo, anchor, handlers | D-01/D-03 wiring | VERIFIED | `:4831-4849`, `:4900-4907`, `:7247`, `:11075`; Studio spec green |
| `PhysicsPaintTrackRow.tsx` ghost presentation | Source keys outside every visible range render as empty | VERIFIED (mechanism) | `resolveGhostSourceKeyIds:240-263`; empty-cell render `:716-720`; this is why truth 54 is user-visible |
| `app/src/types/physicPaint.ts` | Rail insert intent/semantic-delta contract | VERIFIED (documented deviation) | Transient edit-contract only; no persisted `.mce` schema change |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Scripts panel Edit Rail onClick | `handleOpenRotoKeyRailCycleEdit` | `onOpenKeyRailEdit` prop | WIRED | `ScriptsPanel:153`; `Studio:7247`, `:4831-4841` |
| `handleOpenRotoKeyRailCycleEdit` | `rotoPlayScript.openKeyRailCycleEdit` | select-then-open, Promise on every path | WIRED | `Studio:4831-4841` |
| `PhysicsPaintKeyRail` double-click / Enter | Studio handler | `onOpenKeyRailCycleEdit` → WorkflowStrip → Studio | WIRED | `KeyRail:294`, `:316`; `WorkflowStrip:5235`; `Studio:11075` |
| `dialogMode === 'key-rail-create'` | `confirmKeyRailCycle` | `confirm()` routing | WIRED | `controller:2390`, `:1823` |
| `confirmKeyRailCycle` | `buildKeyRailStandardLoopClip` → `buildLoopOnlyPublication` → `ports.commit` | one loop-only transaction | WIRED | `controller:1849-1870`, `:2140-2177` |
| `cancel()` / Escape during `'preparing'` | `confirmKeyRailCycle` generation guard | `acceptedGeneration` + `assertCurrent` | WIRED | `controller:1835`, `:1842`, `:1874`, `:3659-3660` |
| Cell drag gate | rail source-key drag | `dragEligible` in WorkflowStrip | WIRED | `PhysicsPaintWorkflowStrip.tsx:5355`; `prepareRotoKeyDrag:2563` |
| `prepareRotoKeyDrag` | move-key guard + retime + ghost guard | resolver intent path | WIRED (gap) | `useRotoTimelineActions.ts:2588-2596`; `resolver:5575-5648`; cross-clip scope gap = truth 54 |
| `prepareRotoKeyGroupDrag` | move-key-group order guard + placement follow | resolver intent path | WIRED (gap) | `useRotoTimelineActions.ts:2683-2698`; `resolver:6153-6161`, `:2363-2368`; no band retime = truth 55 |
| `resolvePhysicPaintRotoRailInsertPlan` | insert-slot rail extension | resolver `insert-slot` branch | WIRED (gap) | `resolver:5092-5101`; count-vs-span comparison `:4944`, `:4957-4958` = truth 53 |
| `resolvePhysicPaintRotoRailKeyInsertTarget` append | `buildAppendedRailClip` → paste rail splice | +Key/paint rail insert | WIRED (gap) | `resolver:4678-4692`, `:4536-4548`; `useRotoTimelineActions.ts:2513-2541`; missing Standard gate = truth 56 |
| `resolvePhysicPaintRotoRailDissolveTarget` | Standard-only dissolve | `isCompleteStandardRailClip` | WIRED | `resolver:4838-4847`; `isStandardMergedLoopClip` `stacking:536-540` |
| `resolvePhysicPaintRotoLoopSourceExtent` | derivation clamp and Group proposers | `boundedNaturalEnd` / `resolveGroupBoundedEnd` | WIRED | `resolver:6396+`; `GroupLifecycle:320-337` |
| Reconcile | staged revision, staged parse, payload clips/records | coordinator choke point | WIRED | `useRotoPhysicalEditCoordinator.ts`; spec green |
| `isGroupOwnedKeyFrame` | delete-key / delete-key-group / delete-key-rail refusals | `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` | WIRED | `resolver:5205`, `:5254`, `:5344` |
| `classifyRotoInsertTarget` / `readRotoInsertTargetInput` | rail insert plan | `resolvePhysicPaintRotoRailInsertPlan` | WIRED | `useRotoTimelineActions.ts`; resolver spec green |
| `resolvePhysicPaintRotoRailKeyInsertTarget` | +Key/paint rail insertion | `addEmptyKey` + paste-key intent | WIRED | `Studio:4987`; `useRotoTimelineActions.ts:2513`; resolver spec green |
| `resolveGhostSourceKeyIds` | empty-cell render and key-rail exclusion | TrackRow props / Studio group-owned ids | WIRED | `PhysicsPaintTrackRow.tsx:240-263`, `:716-720`; `Studio:1134-1148` |
| `reducedForm` → `framesValidationError` → `confirmBlocked` | Enter guard and primary disabled | one render-local value | WIRED | `dialog:159`, `:306`, `:574+` |

### Data-Flow Trace (Level 4)

These are interaction and derivation surfaces, not data-fetching surfaces; no DB or network query is involved.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Scripts panel inspector | `selectedKeyRailInspector` | `deriveKeyRailSegments` over `orderedRealKeys` | Yes | FLOWING |
| Key Rail strip | segment `keyIds` / frames | same derivation, loop-owned keys excluded | Yes | FLOWING |
| Cycle dialog repeat | `repeatText` -> `parsedRepeat` | `keyRailCycleEditTarget.cycleFrameCount` | Yes | FLOWING |
| Loop clip presentation | lifecycle label | `derivePhysicPaintRotoLoopRanges` over live records | Yes | FLOWING |
| Finite lifecycle extent | `boundedNaturalEnd` | `resolvePhysicPaintRotoLoopSourceExtent` over live source-key frames | Yes | FLOWING |
| Group frame content | classifier bound | same source extent via `resolveGroupBoundedEnd` | Yes | FLOWING |
| Persisted lifecycle extent | reconciled clip + override records | `reconcilePhysicPaintRotoGroupFrames` at the staged write | Yes | FLOWING |
| Rail drag destination | `moveResult.candidate.mapping` -> reposition/retime | resolver over live real-key identities | Yes | FLOWING (band follow incomplete for group drag — truth 55) |
| Ghost source keys | `resolveGhostSourceKeyIds` over store clips | store `getRotoPhysicalLoopClips` + real key records | Yes | FLOWING — this is why cross-clip source keys disappear from the UI |
| Rail insert plan | `loopClips` / override records / trailing shift | `resolvePhysicPaintRotoRailInsertPlan` over live records | Yes | FLOWING (spaced-cycle branch fails — truth 53) |
| Append target | `insertionAppFrame` / `cycleOffset` | `resolvePhysicPaintRotoRailKeyInsertTarget` over live records | Yes | FLOWING (no Standard discriminator — truth 56) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted phase 58 suites (current tree) | `pnpm --filter efx-motion-editor exec vitest run` on 14 phase specs | 14 files passed, 1513 tests passed | PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit`, exit 0 | PASS |
| CR-01 spaced-rail insert | temporary resolver probe (removed after run) | `insert-slot @0` fails `loop-source-key-insert-rejected`; `@11` ok; contiguous `@0` ok | REPRODUCED |
| CR-04a unowned-key move into gapped rail | temporary resolver probe | `ok:true`, mapping `{S1:10,S2:15,X:13}`, `nextLoopClips:null`; S2 outside `[13,15)` | REPRODUCED |
| CR-04b unowned-key cut across canonical rail | temporary resolver probe | `ok:true`, mapping `{X:20,S1:9,S2:13}`, `nextLoopClips:null`; both sources outside `[10,15)` | REPRODUCED |
| CR-04c whole-cycle group drag band | temporary resolver probe | `ok:true`, mapping `{K1:3,K3:5,K5:7}`; clip `phaseOrigin:1`, `originalEndExclusive:6`, ranges `[1,6)`; K5 outside | REPRODUCED |
| CR-05 append on scripted/Reveal rails | temporary resolver probe | both targets return append; edit `ok:true` with `NEW` in `sourceKeyIds`, `originalEndExclusive:7`, `scriptId` intact | REPRODUCED |
| Probe cleanup | `git status --short` | clean after removing the temporary spec | PASS |

The temporary probe spec imported the real `resolvePhysicPaintRotoPhysicalEdit`, `resolvePhysicPaintRotoRailKeyInsertTarget`, `testWebpBytes`, and `PHYSIC_PAINT_MAX_APPLY_FRAMES`; it was deleted after the run and is not part of the phase artifacts.

### Probe Execution

None. `find scripts -path '*/tests/probe-*.sh'` returned no files, and the phase declares no executable probes. Its verification is spec- and probe-bound through vitest.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RAIL-01 | 58-03, 58-04, 58-05 | Open Edit Rail for a normal Key Rail from the sidebar using the same entry point loop clips use | SATISFIED | Truths 1-3, 21-24; wiring `ScriptsPanel:153` → `Studio:7247` → `:4831`; KeyRail `:294`/`:316` → `WorkflowStrip:5235` → `Studio:11075`; UAT rows 1, 3 pass |
| RAIL-02 | 58-04, 58-08 | Modal shows only cycle count and Infinity, prefilled at 1, no script/motion/reveal controls | SATISFIED | Truths 4, 6, 37, 38; dialog spec green; UAT rows 2, 6 pass |
| RAIL-03 | 58-02, 58-03, 58-09 | Confirm converts the segment into a provenance-free Standard clip and the rail presents as Standard; the converted cycle follows the surviving source extent | SATISFIED | Truths 7, 9-12, 39-45; stacking `:597-611`; controller `:1849-1870`; specs green; UAT rows 2, 7 pass |
| RAIL-04 | 58-02, 58-06, 58-08 | Cancelling performs zero writes (no store mutation, revision bump, or undo entry) | SATISFIED | Truths 5, 15, 26-30, 38; controller `:1835-1893`; specs green; UAT row 4 pass |
| RAIL-05 | 58-02, 58-06 | Conversion is exactly one undo step; cancel and refusal leave the ledger untouched | SATISFIED | Truths 13, 14, 27-31, 43; controller `:1861-1870`, `:2140-2177`; specs green |
| RAIL-06 | 58-01, 58-07, 58-10 | Single-key drag under Law A; keys referenced by more than one loop keep D-11; shared linked-cycle behavior never silently relaxed, including the group move | FAILED | Law A accept/reject and order guards hold (truths 8, 16-20, 32-36, 46-52). The qualifier fails: cross-clip ripples hide referenced source keys (truth 54) and a whole-cycle group drag leaves a source key outside its band (truth 55). UAT rows 5 and 10 exercised only the moved key's own cycle |
| RAIL-07 | 58-01, 58-02, 58-07, 58-09, 58-10 | Regression-locked behavior, existing D-11 tests green, no `.mce` schema change | SATISFIED | Truths 25, 32-52; 14 suites / 1513 tests green; `tsc --noEmit` exit 0; no `.mce`/parser/Rust change. Coverage gaps for the defective branches are IN-09/IN-10 |

No orphaned requirements: all seven IDs appear in the ten plan frontmatter blocks, and `.planning/REQUIREMENTS.md` maps exactly these seven to Phase 58.

### Test Quality Audit

| Test File | Linked Req | Assertion Level | Verdict |
|-----------|-----------|-----------------|---------|
| `physicsPaintRotoLoopGuards.test.ts` | RAIL-03, RAIL-06, RAIL-07 | Value + behavioral (mapping, failure code/copy, derived `unresolved`, effectiveEnd) | PASS — but no cross-clip ghost scenario (IN-10) |
| `physicsPaintRotoGroupParity.test.ts` | RAIL-03, RAIL-07 | Value (extent agreement) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | RAIL-03, RAIL-04, RAIL-05 | Behavioral (real history, interleavings, commit counts) | PASS |
| `useRotoPhysicalEditCoordinator.test.ts` | RAIL-03, RAIL-05, RAIL-07 | Behavioral (coordinator -> history, byte-identical pass-through) | PASS |
| `useRotoTimelineActions.test.ts` | RAIL-01, RAIL-06 | Behavioral (dispatch counts, classifier routing, rail insert) | PASS — append fixtures use `frameOverrides: []`, so scripted/Reveal append is untested (truth 56) |
| `physicsPaintRotoRailSetCopy.test.ts` | RAIL-06, RAIL-07 | Value (copy payload, extent) | PASS |
| `physicsPaintRotoKeyRailCycle.test.ts` | RAIL-03, RAIL-07 | Value (record shape, extents, classification) | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | RAIL-02, RAIL-04 | Behavioral (rendered vnode gates + handler dispatch) | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | RAIL-01 | Behavioral + source anchors | PASS |
| `PhysicsPaintKeyRail.test.tsx` (via launcher) | RAIL-01 | Behavioral (click timing, keyboard) | PASS |
| `PhysicsPaintStudio.test.ts` | RAIL-01 | Behavioral + source anchors | PASS |
| `physicsPaintRotoPhysicalResolver.test.ts` | RAIL-03, RAIL-06, RAIL-07 | Value/behavioral (resolver proposals) | PASS — no spaced insert-at-zero case (IN-09) |
| `physicsPaintRotoRunScriptStacking.test.ts` | RAIL-03 | Value | PASS |
| `physicsPaintRotoPhysicalModel.test.ts` | RAIL-03 | Value | PASS |

**Disabled tests on requirements:** 0. **Circular patterns:** 0. **Debt markers:** 0 `TBD`/`FIXME`/`XXX` in the phase-modified implementation and test files.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `physicsPaintRotoPhysicalResolver.ts` | 4944, 4957-4958 | Count (`moved`) compared with span (`cycleLength`) | Blocker | CR-01 / truth 53: spaced-rail insert at/left rejected |
| `physicsPaintRotoPhysicalResolver.ts` | 5630-5648 | Ghost guard scoped to the moved key's single referencing clip | Blocker | CR-04a/b / truth 54: cross-clip source keys silently ghosted |
| `physicsPaintRotoPhysicalResolver.ts` | 2363-2368 | Group branch omits `retimeFiniteLifecycle`; no group ghost guard | Blocker | CR-04c / truth 55: whole-cycle drag hides a source key |
| `physicsPaintRotoPhysicalResolver.ts` | 4678-4692 | Append lacks `isStandardMergedLoopClip` | Blocker | CR-05 / truth 56: scripted and Reveal rails mutated |
| `physicsPaintRotoPhysicalResolver.ts` | 5499, 1671-1672, 1754-1771 | Rail insert never grows capacity (WR-01, review) | Warning | Tail insert can fail `over-capacity` while insert-slot grows |
| `physicsPaintRotoPhysicalResolver.ts` | 5617-5628 | Retime dropped silently when the band exceeds capacity (WR-02, review) | Warning | Half-applied move possible on the capacity boundary |
| `physicsPaintRotoPhysicalResolver.ts` | 5091-5140 | Insert growth swallows trailing content for repeat > 1 (WR-03, review) | Warning | Trailing content inside the grown band |
| `physicsPaintRotoPhysicalResolver.ts` | 2363 | Append ripples every trailing key/clip by the full growth (WR-05, review) | Warning | Content beyond the destination shifts |
| `physicsPaintRotoPhysicalResolver.ts` | 4628-4632 | Dead `frameOwners` map; unused exports (IN-01/IN-02, review) | Info | Dead code only |

No `TBD`/`FIXME`/`XXX` debt markers were found. The warnings and info rows above are tracked in `58-REVIEW-DISPOSITION.md`; they are not independently reproduced by a failing test in this verification and do not by themselves drive the verdict.

### Human Verification Required

None required for this round's verdict: the four failures are deterministic resolver probes that reproduce without a running app. After gap closure, live UAT is required for the user-visible rows — spaced-rail Insert, a cross-clip source-key ghost after an unowned-key drag, a whole-cycle group drag on a canonical rail, and +Key/paint on an overridden Playscript/Reveal rail — because those surfaces are presentation-dependent.

### Gaps Summary

Four must-have failures block phase completion, all on the current tree:

1. **RAIL-06 / truth 54 — cross-clip ghost erasure.** An accepted `move-key` of an unowned key can ripple another clip's source keys outside every visible range. `nextLoopClips` stays null, and `resolveGhostSourceKeyIds` paints the real key as an empty cell, removing it from ordinary key rails. The guard added by `02de1ecc5` checks only the moved key's own referencing clip and only when there is exactly one.
2. **RAIL-06 / truth 55 — whole-cycle group drag band staleness.** `buildMoveGroupCandidate` follows the new placement without retiming the lifecycle band (`phaseOrigin`/`originalEndExclusive`/`visibleRanges` stay), so a moved source key beyond the old end is hidden. The group branch has no ghost guard.
3. **Truth 53 — spaced-rail Insert (UAT G-03).** The rail insert plan compares a source-key count with a cycle span; a spaced rail at frames 10/12/14 rejects `insert-slot @ 0` with `loop-source-key-insert-rejected` while an interior insert and a contiguous rail succeed. One spaced rail to the right makes a global Insert at frame 0 fail.
4. **Truth 56 — post-phase append (CR-05, `bcbdecb71`).** The new post-end +Key/paint append accepts overridden Playscript (`scriptId`) and Reveal (`railKind: 'reveal'`) rails, rewriting `originalEndExclusive`/`visibleRanges` and splicing the new key into `sourceKeyIds`, while the dissolve law it preempts correctly rejects those rail kinds.

The conversion path (RAIL-01..RAIL-05), undo/redo, cancel fencing, inspector surfaces, and the existing order guards remain verified. The G-02 delete-contraction retirement is a later user-approved law change (`1bfbf2672`, 2026-11-04), not a phase failure.

---

_Verified: 2026-11-05T11:31:32Z_
_Verifier: Claude (gsd-verifier)_
