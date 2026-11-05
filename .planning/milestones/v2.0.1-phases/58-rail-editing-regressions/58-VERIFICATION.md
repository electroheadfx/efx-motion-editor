---
phase: 58-rail-editing-regressions
verified: 2026-11-05T12:14:30Z
status: passed
score: 57/57 must-haves verified
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
  - .planning/phases/58-rail-editing-regressions/58-REVIEW-DISPOSITION.md
  - .planning/phases/58-rail-editing-regressions/58-REVIEW.md
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
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts
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
  - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
  - app/src/types/physicPaint.test.ts
  - app/src/types/physicPaint.ts
covered_digest: "v4:sha256:85867d3252d32dc374c652369eaac2c653c1eb6b478a96dc9c87ab500df51591"
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
  previous_status: gaps_found
  previous_score: 56/57
  gaps_closed:
    - "RAIL-06 / truth 57: Force Spacing and spacing-on-set on a non-canonical lifecycle rail now retime the band and keep every referenced source key inside a visible range (commit 2c0f22ce0)"
  gaps_remaining: []
  regressions: []
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
  - finding: "15 review findings remain open in 58-REVIEW-DISPOSITION.md (WR-01, WR-02, WR-03, WR-04, WR-05, IN-01..IN-10)"
    category: other
    reason: "New-scope source analysis from 58-REVIEW.md; not independently reproduced with a deterministic failing test in this verification. CR-01, CR-04, CR-05 and CR-02/CR-03 are fixed and scored above."
    evidence_status: "source analysis only — no named failing test"
  - finding: "A Force Spacing that SHRINKS an overridden lifecycle rail retimes the band below a surviving tail frameOverride, so the clip fails the loop-clip parser at commit (pre-existing shrink edge, outside phase 58 scope)"
    category: other
    reason: "Reproduced by verifier probe: overridden rail K1@1/K3@3/K5@5, band [1,6), frameOverrides O1@5, emptyFrames 0 -> mapping {K1:1,K3:2,K5:3}, retimed band [1,4) with O1@5 retained; parsePhysicPaintRotoLoopClips rejects it ('PhysicPaintRotoLoopClips: malformed Loop Clip record.'). The same helper on the pre-phase-58 tree (bdc5928ac^) retimed and preserved frameOverrides verbatim, so this is pre-existing behavior restored by the truth 57 fix, not a phase-58 regression. It is outside truth 39's planned delete/repeat trigger; a product decision is needed (prune/relocate overrides on shrink, or refuse the shrink)."
    evidence_status: "deterministic verifier probe — pre-existing, out of phase scope, no phase truth failed"
---

# Phase 58: Rail editing regressions Verification Report

**Phase Goal:** A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Verified:** 2026-11-05T12:14:30Z (current tree `2c0f22ce0`, working tree clean apart from this report)
**Status:** passed
**Re-verification:** Yes — round 3, after gap-closure commit `2c0f22ce0`

## Goal Achievement

Both clauses of the goal now hold on the current tree.

The conversion path (RAIL-01..RAIL-05) is unchanged and remains verified end to end: inspector takeover, reduced Cycle/Infinity modal, provenance-free Standard record, one loop-only commit, one-command undo/redo, and a generation-fenced cancel path. The 15 targeted phase suites are green (1554 tests) and typecheck is clean.

The qualifier "without silently relaxing linked-cycle ownership" is restored. Round 2's regression — commit `98f0b14dc` narrowed the shared placement-follow helper to canonical rails, which also reached Force Spacing and spacing-on-set — is closed by `2c0f22ce0`. The fix adds an optional `retimeNonCanonical` flag (default `false`) to `computeSourceAttachedLoopPlacementFollow` (`resolver:1069-1075`); only the authorized spacing branches pass it (`force-spacing` `resolver:3791`, `spacing-on-set` `resolver:6128`), while `move-key` (`:5656`) and `move-key-group` (`:2396`) keep the canonical narrowing that protects their ghost guard.

Independently re-verified with a temporary resolver probe spec (11 probes, all passing; the spec was deleted after the run):

- **Truth 57 — Force Spacing on an overridden rail.** Overridden rail K1@1/K3@3/K5@5, band `[1,6)`, `frameOverrides:[{keyId:'O1',appFrame:4}]`, `emptyFrames:2`: `ok:true`, mapping `{K1:1,K3:4,K5:7}`, band retimed to `{placementStart:1, phaseOrigin:1, originalEndExclusive:8, visibleRanges:[1,8)}`, override retained at 4 (inside the new band), `uncoveredSourceKeys` empty, derived `effectiveEnd:8`, `unresolved:null`.
- **Truth 57 — spacing-on-set on the same rail.** Same mapping and retimed band; override retained; no uncovered source key; derived end 8.
- **Truths 53-56 — not regressed by `2c0f22ce0`.** CR-01 spaced-rail insert at 0/10/11 and contiguous at 0; CR-04a/b cross-clip rejections (`loop-source-key-move-rejected` / `move-key`); CR-04c canonical group retime `{K1:3,K3:5,K5:7}` with band `[3,8)` plus non-canonical group rejection; CR-05 Standard append target kept and scripted/Reveal targets null, forged ids rejected with `loop-source-key-insert-rejected`.

The two new regression tests that pin truth 57 pass by name: "retimes an overridden non-canonical rail during authorized Force Spacing — D-14" (`physicsPaintRotoLoopGuards.test.ts`) and "retimes an overridden non-canonical rail during set spacing (D-24)" (`physicsPaintRotoPhysicalResolver.test.ts`).

One out-of-scope observation is recorded as an advisory, not a phase failure: a Force Spacing that SHRINKS an overridden rail can leave a tail `frameOverride` outside the retimed band, and the clip then fails the loop-clip parser at commit. The probe reproduces it (`emptyFrames:0` → band `[1,4)` with `O1@5` retained, parser throws). The pre-phase-58 helper (`bdc5928ac^`) retimed and preserved `frameOverrides` identically, so this is pre-existing behavior restored verbatim, outside truth 39's planned delete/repeat trigger, and not reachable from any RAIL requirement. It needs a product decision in a follow-up.

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
| 8 | Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent "Source missing" clip with no in-UI repair | VERIFIED | Law A comparator `resolver:5608-5612`; order guard `:5643-5644`; G-04 retime `:5653-5668`; global ghost guard `:5671-5672`; loopGuards spec green |
| 9 | The clip classifies as Standard and presents via the existing `.rail-kind-standard` pill; the existing Edit Rail dialog owns Repeat/Infinity afterwards | VERIFIED | `isStandardMergedLoopClip` `stacking:536-540`; `KeyRailCycle` spec green; CSS `.rail-kind-standard` |
| 10 | A gapped segment keeps its span: cycle length = last - first + 1, extent clamped to capacity, infinity lifecycle-less | VERIFIED | `cycleFrameCount` `controller:1850-1853`; KeyRailCycle spec green |
| 11 | A single-key segment converts to a 1-frame cycle | VERIFIED | KeyRailCycle spec single-key case green |
| 12 | A second conversion over already loop-owned keys is refused before any commit | VERIFIED | Open-time target build `controller:1781-1793`; confirm-time `loopClipsOwnAnyKey` `:1846`; controller spec green |
| 13 | Undo restores the pre-conversion Key Rail and Redo re-applies the conversion as one command | VERIFIED | Controller history spec green; one-command publication `:2140-2177` |
| 14 | The conversion is exactly one `ports.commit` with `semanticDelta.kind 'play-script'`, `loopOnly: true`, `affectedEndAppFrame = anchor - 1`, `freshKeyIds: []` | VERIFIED | `buildLoopOnlyPublication` `controller:2140-2177`; confirm `:1861-1870`; controller spec green |
| 15 | Cancel and every refusal perform zero commits and zero history entries | VERIFIED | Generation fence truth 5; refusals return before commit `:1843-1846`; controller spec green |
| 16 | A single-key drag on a key referenced by exactly one loop is accepted and lands on the requested frame (Law A) | VERIFIED | `resolver:5608-5612` comparator; loopGuards Law A tests green |
| 17 | A key referenced by two or more loops is rejected, never moves silently, with `loop-source-key-move-rejected`, `move-key`, and the verbatim D-16 copy | VERIFIED | `resolver:5608-5612`; locked copy `:937`; loopGuards spec green |
| 18 | An accepted single-key move never emits `nextLoopClips`, so `placementStart` stays put | PASSED (override) | Superseded by UAT G-04: single-key branch retimes the band `resolver:5653-5668` via `computeSourceAttachedLoopPlacementFollow`; two-or-more guard untouched (truth 17) |
| 19 | Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy | PASSED (override) | Force Spacing D-11 guard `resolver:5690-5705`; D-11/D-16 copy `:937`; guard paths intact. Note: G-02 delete contraction was retired (hole semantics, truth 41 unchanged); the spaced-rail insert gap is closed as truth 53 |
| 20 | The acceptance is entirely inside the resolver: `prepareRotoKeyDrag` / `commitRotoKeyDrag` and the WorkflowStrip drag dispatch are untouched | PASSED (override) | UAT G-04 required arming rail keys: `PhysicsPaintWorkflowStrip.tsx:5355` drag gate; prepare/commit untouched; resolver remains the acceptance authority |
| 21 | Edit Rail and double-click/Enter reach one Studio handler that selects the rail first, then delegates to `openKeyRailCycleEdit`, returning a Promise on every path | VERIFIED | `PhysicsPaintStudio.tsx:4831-4841` select-then-open, Promise on every branch |
| 22 | A 2+ rail set whose anchor is a Key Rail projects with setSize >= 2, Edit Rail visible and disabled with "Select a single rail to edit it.", and no bulk conversion | VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:127-143`; Studio memo `:4900-4907`; Studio spec green |
| 23 | Close clears both `selectedRotoKeyRail` and `railSetSelection`, so the takeover dismisses in the plain and rail-set states | VERIFIED | `PhysicsPaintStudio.tsx:4846-4849`; Studio spec green |
| 24 | The inspector shows exactly Frames F{first}-F{last}, Keys n, Type Standard, and keeps one object identity across unrelated renders | VERIFIED | `physicsPaintKeyRailPresentation.ts:127-143`; stable memo deps `Studio:4900-4907` |
| 25 | No `.mce` schema field is added or changed; resolver, undo, and existing D-11 guard tests are green or deliberately updated | VERIFIED | Phase diff contains no `.mce`, schema, parser, or `src-tauri` path; the only `app/src/types` change is transient intent/semantic-delta typing; 15 targeted suites / 1554 tests green; `tsc --noEmit` exit 0 |
| 26 | Cancelling while the conversion is still awaiting authority never calls `ports.commit`, lands in `'cancelled'`, leaves error null, and produces no accepted output | VERIFIED | `controller:1842` assertCurrent before ack; controller spec green |
| 27 | A cancelled conversion keeps `keyRailCycleEditTarget` and the open dialog, so a later confirm retries and commits exactly once | VERIFIED | `controller:1882-1893`; controller spec green |
| 28 | Cancelling while the phase is `'committing'` neither clears the target nor closes the dialog; after that commit fails, Create Cycle retries and commits | VERIFIED | `cancel()` busy early return `controller:3659-3660`; controller spec green |
| 29 | A cancel before confirm still closes the dialog with zero writes | VERIFIED | Controller spec green |
| 30 | An AbortError is never routed through `fail()`: no `'Play Script failed'` phase, no error text, no error-level log | VERIFIED | `controller:1882-1893`; controller spec green |
| 31 | The successful conversion path still commits exactly once, clears the target, and closes the dialog | VERIFIED | `controller:1861-1893`; controller spec green |
| 32 | With exactly one referencing loop, a move-key whose final mapping breaks strict increase is rejected with `loop-source-key-move-rejected`, `operationKind move-key`, and the verbatim D-16 copy | VERIFIED | `resolver:5643-5644`; loopGuards spec green |
| 33 | The order check reads the FINAL candidate mapping (ripple-proof) and fails closed when a referenced source key is absent from the mapping | VERIFIED | `loopSourceOrderIsProvable` `resolver:2264-2276`; move branch reads `moveCandidate.mapping`; loopGuards spec green |
| 34 | A one-element source cycle is always order-preserving and its only key can move | VERIFIED | LoopGuards spec green |
| 35 | A key referenced by no loop, and a no-change drag back to its own cell, are accepted | VERIFIED | LoopGuards spec green |
| 36 | `sourceKeyIds` is never re-sorted or mutated; an order-breaking destination is rejected rather than re-sequenced | VERIFIED | Guard only reads `sourceKeyIds`; loopGuards preservation pin green. The v2.0.1 append splices a NEW key by design (not a re-sort); see truth 56 |
| 37 | In key-rail-create, Enter calls `confirm()` exactly once despite the stale frames error, and the primary button is enabled | VERIFIED | Dialog `confirmBlocked` `:159`, Enter guard `:306`; dialog spec green after `a21f36c45` |
| 38 | The Enter guard and primary disabled share one `confirmBlocked`; repeatError blocks both; the merged Standard reduced form also confirms; full apply, Reveal, and stack-collision surfaces keep their prior gating; Escape/canCancel precedence unchanged | VERIFIED | Dialog `:159`, `:306`, primary near `:574`; dialog spec green after `a21f36c45` |
| 39 | Group override records never survive outside every referencing clip's surviving extent; the empty-trim fail-safe leaves the clip byte-identical | VERIFIED | `reconcilePhysicPaintRotoGroupFrames` `model:1062`; coordinator spec green. The pre-existing Force Spacing shrink edge that can strand a tail override is outside this truth's planned delete/repeat trigger and is listed as an advisory |
| 40 | A finite lifecycle clip's derived range never ends past `phaseOrigin + cycleLength * repeat` from current source-key positions (capacity-clamped); frames beyond resolve empty | VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent` `model:1003-1031`; `resolveGroupBoundedEnd` `GroupLifecycle:320-337`; groupParity spec green |
| 41 | Deleting a real key inside a lifecycle clip's surviving extent is refused with the locked copy, and a key past that bound deletes normally while its stale paint sheet is pruned whenever trimmed ranges stay non-empty | VERIFIED | `isGroupOwnedKeyFrame` `resolver:1199`; copy `:946`; fail calls `:5239`, `:5288`, `:5378`; specs green |
| 42 | Repeat contraction filters the rebuilt clip's `frameOverrides` to frames strictly before the source-derived surviving end; an override inside the surviving end but past the new end still raises the unchanged copy | VERIFIED | `updateLoop` `controller:2269-2309`; controller spec green |
| 43 | After the first accepted write on an already-stale document, the persisted clip extent and override collection are canonical in one undo step that also restores the deleted key | VERIFIED | Coordinator spec green (`useRotoPhysicalEditCoordinator.test.ts`) |
| 44 | A stale document whose `sourceKeyIds` all still exist loads and resolves without "Source missing"; a genuinely dangling source id keeps today's result; no load-time migration and no revision churn | VERIFIED | `loopGuards` G-01 rows green; extent helper non-mutating |
| 45 | No `.mce` field, parser shape, storage mode, or persisted schema changes; D-08..D-11 conversion semantics, D-15 guard surfaces, D-16 copy, and D-17 locking are preserved, with the one added G-01 ownership-parity refusal | VERIFIED | Phase diff has no `.mce`/parser/Rust/storage change; G-01 refusal additive; specs green |
| 46 | An order-preserving partial-cycle group move stays accepted: A,B 10-11 → 8-9 under loop(10,5) yields A:8, B:9, C:12, D:13, E:14, `nextLoopClips` null, `placementStart` 10, unresolved null | VERIFIED | `loopGuards` CR-03 rows green |
| 47 | An order-breaking partial-cycle group move is rejected: A,B → cell 20 projects A:20, B:21, C:12 and fails with `loop-source-key-move-rejected`, `operationKind move-key-group`, verbatim D-16 copy | VERIFIED | `resolver:6182-6183`; `loopGuards` CR-03 rows green |
| 48 | The order proof reads the final candidate mapping, so a moved key landing past a non-moved source key is caught, and a clip source key absent from the mapping fails closed | VERIFIED | `loopSourceOrderIsProvable` `resolver:2264-2276`; group guard `:6182`; specs green |
| 49 | Every clip whose `sourceKeyIds` intersect the moved key set is projected; a clip the move does not touch keeps today's behavior even when already unresolved | VERIFIED | Intersection-scoped loop `resolver:6178-6181`; specs green |
| 50 | `move-key` and `move-key-group` share one order helper and one failure call, so CR-02's behavior is byte-identical and its existing tests stay unedited and green | VERIFIED | Shared helper `resolver:2264`; calls `:5643`, `:6182`; specs green |
| 51 | On the UI path an order-breaking partial-cycle group drag prepares as `ok:false` carrying the locked copy and never calls `executePhysicalEdit`, while the order-preserving drag commits exactly once | VERIFIED | `useRotoTimelineActions` spec green; drag dispatch `WorkflowStrip:4675-4676` |
| 52 | Whole-cycle rigid group moves and the two-loop D-04 `placementStart` follow, no-change drags, one-element cycles, and ordinary moves behave as before; no `.mce`, parser, failure-union, or copy changes | VERIFIED | `loopGuards` D-04 rows green; no schema/failure-union change; canonical group retime and non-canonical rejection are truth 55 |
| 53 | The UAT-approved Insert extension (G-03) accepts a canonical spaced source cycle at any destination, including at or left of its phase origin | VERIFIED | Re-confirmed on `2c0f22ce0` with the verifier probe: spaced rail 10/12/14, `insert-slot @ 0` ok with mapping `{S1:11,S2:13,S3:15}` and band `[11,16)`; `@ 10` ok; interior `@ 11` ok; contiguous `@ 0` ok. Count comparison `resolver:4979`; interior reject `:4995`. CR-01 test green |
| 54 | A single-key move that ripples another clip's referenced source keys keeps them inside that clip's visible ranges; the guard checks every referencing clip, not only the moved key's clip | VERIFIED | Re-confirmed on `2c0f22ce0`: CR-04a move X 16→13 with gapped rail → rejected `loop-source-key-move-rejected`/`move-key`; CR-04b move X 8→20 with canonical rail → rejected. Helper `resolver:1040-1057`; guard calls `:5671` (move-key) and `:6188` (move-key-group); CR-04 loopGuards rows green |
| 55 | A whole-cycle group drag retimes every following lifecycle band so no moved source key lands outside its visible ranges (or refuses) | VERIFIED | Re-confirmed on `2c0f22ce0`: CR-04c canonical K1/K3/K5 at 1/3/5 `[1,6)`, group +2 → ok `{K1:3,K3:5,K5:7}` band `{placementStart:3, phaseOrigin:3, end:8, ranges:[3,8)}`; non-canonical band group move → rejected. Group branch `resolver:2394-2400`; guards `:6182-6189`. The truth 57 fix did not widen the move branches |
| 56 | The v2.0.1 post-end +Key/paint append is restricted to the Standard merged rail (no scriptId, not Reveal); Playscript and Reveal rails keep the detached-key behavior | VERIFIED | Re-confirmed on `2c0f22ce0`: Standard overridden rail keeps target `{loopId:'rail-1', cycleOffset:5, insertionAppFrame:6}`; scripted and Reveal rails return null; forged `railInsertGroupId` fails closed with `loop-source-key-insert-rejected`. Gate `resolver:4714`; discriminator `stacking:536-540`; CR-05 tests green |
| 57 | Force Spacing and spacing-on-set on a non-canonical lifecycle rail keep every referenced source key inside a visible range (or refuse) | VERIFIED | Probe on `2c0f22ce0`: overridden rail K1@1/K3@3/K5@5, band `[1,6)`, `frameOverrides:[{appFrame:4,keyId:'O1'}]`, `emptyFrames:2`; force-spacing linked scope and spacing-on-set loop member both return ok with mapping `{K1:1,K3:4,K5:7}` and retimed band `{placementStart:1, phaseOrigin:1, originalEndExclusive:8, ranges:[1,8)}`; override retained at 4; `uncoveredSourceKeys` empty; derived `effectiveEnd:8`, `unresolved:null`. Fix `resolver:1098` (`retimeNonCanonical || isCanonicalLifecycleRailClip`), passed only at `:3791` and `:6128`; named D-14 and D-24 tests green |

**Score:** 57/57 truths verified (54 VERIFIED + 3 PASSED (override); 0 FAILED; 0 behavior-unverified).

### Later User-Approved Supersessions (not phase failures)

| Change | Date / Commit | Effect on this report |
| ------ | ------------- | --------------------- |
| G-02 delete contraction retired in favor of hole semantics | 2026-11-04, `1bfbf2672` (quick 261104-bop) | `physicsPaintRotoGroupLifecycle.ts:560-563`, `:663-680`: a deleted Rail phase leaves the visible ranges EMPTY; later source keys never ripple. This supersedes the 2026-11-03 UAT-approved contraction. It is a later user-approved law, not a Phase 58 regression; truth 41 (group-owned delete refusal) and truth 19's override are unaffected |
| v7 timeline rails quick delivered | v2.0.1, VIS-01..VIS-08 all `[x]` | The previously deferred per-frame cells, cycle grays, and rail colour dot are shipped; the item is no longer deferred |

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Motion channels | v2.1.0 | ROADMAP v7 timeline rails: "Motion channels stay in v2.1.0." |

### Advisory (Out of Phase Scope)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Reduced Cycle dialog dead space (~376px vertical / ~478px horizontal) | other | 58-UI-REVIEW.md priority fix 1; visual composition only; no live capture |
| 2 | Refusal reasons not rendered; `rejectLoopOp` sets error null | other | 58-UI-REVIEW.md priority fix 2; refusal paths write nothing |
| 3 | During `'committing'`, Cancel and primary look enabled while both no-op | other | 58-UI-REVIEW.md priority fix 3; deliberate no-op window |
| 4 | Pasting a rail-set copy from an already-stale finite lifecycle rail can be rejected fail-closed (reconcile vs paste semantic-delta recompute) | other | Source-derived, no failing test run; rejection writes nothing and is retryable |
| 5 | 15 open review findings in 58-REVIEW-DISPOSITION.md (WR-01, WR-02, WR-03, WR-04, WR-05, IN-01..IN-10) | other | New-scope source analysis, not independently reproduced; CR-01/CR-04/CR-05 and CR-02/CR-03 are fixed and scored above |
| 6 | A SHRINKING Force Spacing on an overridden rail retimes the band below a tail `frameOverride`; the clip then fails the parser at commit | other | Deterministic verifier probe (`emptyFrames:0` → band `[1,4)`, `O1@5` retained, `parsePhysicPaintRotoLoopClips` throws). Pre-existing at `bdc5928ac^` (same retime + verbatim override spread), restored by the truth 57 fix; outside truth 39's planned delete/repeat trigger; no RAIL requirement failed. Needs a product decision (prune/relocate overrides on shrink, or refuse) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `physicsPaintRotoPhysicalResolver.ts` | Law A guard, final-mapping order guards, rail reposition/retime, rail insert plan, Group ownership, G-01 bounded derivation, global ghost guard, Standard-only append, authorized non-canonical spacing retime | VERIFIED | Exists, substantive, wired. `loopSourceOrderIsProvable:2264`; move-key `:5608-5672`; force-spacing D-11 `:5690-5705`; move-key-group `:6178-6189`; `isGroupOwnedKeyFrame:1199`; rail helpers `:4648`, `:4873`, `:4979`; append gate `:4714`; global ghost helper `:1040-1057`; retime helper `:1069-1129` with `retimeNonCanonical` `:1075`/`:1098`; authorized spacing calls `:3791`, `:6128` |
| `physicsPaintRotoPhysicalModel.ts` | Shared source-extent helper, reconcile, override pruning | VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent:1003-1031` (reveal null `:1009`); `reconcilePhysicPaintRotoGroupFrames:1062+`; non-mutating |
| `useRotoPhysicalEditCoordinator.ts` | Reconcile at the write choke point before revision/payload | VERIFIED | Reconcile feeds staged revision, staged parse, and payload clips/records; coordinator spec green |
| `physicsPaintRotoGroupLifecycle.ts` | Source-extent bound; delete hole law | VERIFIED | `resolveGroupBoundedEnd:320`; `proposePhysicPaintRotoDeleteGroupFrame:626`; hole semantics `:663-680` (later user-approved law) |
| `physicsPaintRotoPlayScriptController.ts` | Update Rail surviving end, override pruning, generation-fenced conversion, busy-phase cancel | VERIFIED | `confirmKeyRailCycle:1823-1897`; `buildLoopOnlyPublication:2140`; `updateLoop:2269-2309`; `cancel()` busy early return `:3659-3660` |
| `physicsPaintRotoRunScriptStacking.ts` | Standard discriminator for dissolve and append | VERIFIED | `buildKeyRailStandardLoopClip:597-611`; `isStandardMergedLoopClip:536-540` (rejects `railKind:'reveal'` and any `scriptId`) |
| `physicsPaintRotoRailSetCopy.ts` | Ceil cycle count for a frozen Infinity span | VERIFIED | RailSetCopy spec green |
| `useRotoTimelineActions.ts` | Group-owned delete routing, rail key insert target, +Key/paint rail insert, drag dispatch, force-spacing scope derivation | VERIFIED | Rail insert target `:2513`; `addEmptyKey` rail path `:2461-2542`; drag intent `:2563`, `:2638`; `deriveForceSpacingScope:1712-1925` builds linked scopes from any selected Loop Rail and rail-set loop members without a canonical filter; spacing dispatch `:3428`, spacing-on-set `:3460`, force-spacing `:3508`; reached path now retimes |
| `physicsPaintRotoLoopGuards.test.ts` | Law A boundary pair, CR-02 rejection, G-01 extent/ownership, CR-03 edge pins, CR-04 cross-clip/group pins, truth 57 non-canonical Force Spacing pin | VERIFIED | Green, including "retimes an overridden non-canonical rail during authorized Force Spacing — D-14", plus the four CR-04 rows |
| `physicsPaintRotoPhysicalResolver.test.ts` | Resolver proposals, CR-01 spaced insert, CR-05 append, CR-03, truth 57 spacing-on-set pin | VERIFIED | Green, including "retimes an overridden non-canonical rail during set spacing (D-24)" |
| `physicsPaintRotoGroupParity.test.ts` | Extent agreement across derivation/proposers/regenerate | VERIFIED | Green |
| `physicsPaintRotoPlayScriptController.test.ts` | In-flight cancel, retry, busy cancel, override contraction | VERIFIED | Green |
| `useRotoPhysicalEditCoordinator.test.ts` | Stale-cycle repair, one undo step, canonical pass-through, infinity untouched | VERIFIED | Green |
| `useRotoTimelineActions.test.ts` | Delete classifier parity, CR-03 UI dispatch pins, rail insert rows, CR-05 scripted/Reveal detached-key rows | VERIFIED | Green, including "an overridden scripted rail keeps the detached key — CR-05" and "an overridden Reveal rail keeps the detached key — CR-05" |
| `physicsPaintRotoRailSetCopy.test.ts` | Non-whole-cycle paste regression | VERIFIED | Green |
| `KeyRailCycleEditTarget`, `openKeyRailCycleEdit`, `confirmKeyRailCycle` | Frozen target, zero writes on open, generation-fenced confirm | VERIFIED | `controller:1781-1897` |
| `SelectedKeyRailInspectorPresentation`, `projectSelectedKeyRailInspector` | Frames/Keys/Type, disabled reason | VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:127-143` |
| `PhysicsPaintScriptsPanel` takeover props | Edit Rail and Close | VERIFIED | `:147-160`; spec green |
| `PhysicsPaintKeyRail` open-intent prop | Double-click + Enter | VERIFIED | `:272-316`; launcher green |
| `PhysicsPaintWorkflowStrip` open-intent prop and drag gate | Forwarding; rail keys arm a drag | VERIFIED | `:468`, `:5235`, `:5355`, `:4675-4676`; spec green |
| `ReducedCycleCard` | Cycle stepper + Infinity switch only | VERIFIED | `PhysicsPaintPlayScriptCards.tsx`; dialog spec green |
| `reducedForm`, `confirmBlocked`, reduced branch | Reduced surface + shared confirm gate | VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:72`, `:159`, `:306`, `:384`; dialog spec green after `a21f36c45` |
| `PhysicsPaintStudio.tsx` inspector memo, anchor, handlers | D-01/D-03 wiring | VERIFIED | `:4831-4849`, `:4900-4907`, `:7247`, `:11075`; Studio spec green |
| `PhysicsPaintTrackRow.tsx` ghost presentation | Source keys outside every visible range render as empty | VERIFIED (mechanism) | `resolveGhostSourceKeyIds:240-263`; empty-cell render `:716-720` |
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
| `prepareRotoKeyDrag` | move-key guard + retime + global ghost guard | resolver intent path | WIRED | `useRotoTimelineActions.ts:2588-2596`; `resolver:5608-5672`; CR-04 closed |
| `prepareRotoKeyGroupDrag` | move-key-group order guard + band retime/ghost guard | resolver intent path | WIRED | `useRotoTimelineActions.ts:2683-2698`; `resolver:2394-2400`, `:6178-6189`; CR-04 closed |
| `resolvePhysicPaintRotoRailInsertPlan` | insert-slot rail extension | resolver `insert-slot` branch | WIRED | `resolver:5092-5101`; count comparison `:4979`; CR-01 closed |
| `resolvePhysicPaintRotoRailKeyInsertTarget` append | `buildAppendedRailClip` → paste rail splice | +Key/paint rail insert | WIRED | `resolver:4648-4720`; `useRotoTimelineActions.ts:2513-2541`; Standard gate `:4714`; CR-05 closed |
| `resolvePhysicPaintRotoRailDissolveTarget` | Standard-only dissolve | `isCompleteStandardRailClip` | WIRED | `resolver:4838-4847`; `isStandardMergedLoopClip` `stacking:536-540` |
| `deriveForceSpacingScope` | force-spacing linked scopes / spacing-on-set members | `useRotoTimelineActions` dispatch | WIRED | `useRotoTimelineActions.ts:1712-1925`; dispatch `:3428`, `:3460`, `:3508`; reaches truth 57's now-retiming path |
| force-spacing / spacing-on-set | `computeSourceAttachedLoopPlacementFollow` | shared band retime with `retimeNonCanonical = true` | WIRED | `resolver:3791`, `:6128`; helper `:1069-1129`, bypass `:1098`; move branches still canonical (`:2396`, `:5656`) |
| `resolvePhysicPaintRotoLoopSourceExtent` | derivation clamp and Group proposers | `boundedNaturalEnd` / `resolveGroupBoundedEnd` | WIRED | `resolver:6396+`; `GroupLifecycle:320-337` |
| Reconcile | staged revision, staged parse, payload clips/records | coordinator choke point | WIRED | `useRotoPhysicalEditCoordinator.ts`; spec green |
| `isGroupOwnedKeyFrame` | delete-key / delete-key-group / delete-key-rail refusals | `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` | WIRED | `resolver:5239`, `:5288`, `:5378` |
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
| Rail drag destination | `moveResult.candidate.mapping` -> reposition/retime | resolver over live real-key identities | Yes | FLOWING |
| Force Spacing / spacing-on-set band | `nextLoopClips` from `computeSourceAttachedLoopPlacementFollow` | resolver over live records and selected rails | Yes | FLOWING — non-canonical rails retime to cover the moved source keys (truth 57 fixed); the pre-existing shrink edge is advisory 6 |
| Ghost source keys | `resolveGhostSourceKeyIds` over store clips | store `getRotoPhysicalLoopClips` + real key records | Yes | FLOWING — no phase-58 path produces an uncovered source key on the covered operations |
| Rail insert plan | `loopClips` / override records / trailing shift | `resolvePhysicPaintRotoRailInsertPlan` over live records | Yes | FLOWING (spaced-cycle branch fixed) |
| Append target | `insertionAppFrame` / `cycleOffset` | `resolvePhysicPaintRotoRailKeyInsertTarget` over live records | Yes | FLOWING (Standard-only gate fixed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted phase 58 suites (current tree) | `pnpm --filter efx-motion-editor exec vitest run` on the 15 phase specs | 15 files passed, 1554 tests passed | PASS |
| Named truth 57 tests | same runner, `-t "retimes an overridden non-canonical rail"` over loopGuards + resolver specs | 2 passed, 313 skipped | PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` (`tsc --noEmit`), reported by orchestrator and re-confirmed in this tree | exit 0 | PASS |
| Full workspace suite | orchestrator run on `2c0f22ce0` (not independently re-run by the verifier) | 7293 passed / 0 failed | PASS |
| Decision coverage | `gsd_run query check.decision-coverage-verify` (17 CONTEXT.md decisions) | `honored: 17/17`, `blocking: false`, exit 0 | PASS |
| CR-01 spaced-rail insert | temporary resolver probe (removed after run) | `insert-slot @0`/`@10` ok `{S1:11,S2:13,S3:15}` band `[11,16)`; interior `@11` ok; contiguous `@0` ok | PASS — no regression |
| CR-04a unowned-key move into gapped rail | temporary resolver probe | rejected `loop-source-key-move-rejected` / `move-key` | PASS — no regression |
| CR-04b unowned-key cut across canonical rail | temporary resolver probe | rejected `loop-source-key-move-rejected` / `move-key` | PASS — no regression |
| CR-04c whole-cycle group drag band | temporary resolver probe | ok `{K1:3,K3:5,K5:7}` band `{placementStart:3, phaseOrigin:3, end:8, ranges:[3,8)}`; non-canonical group move rejected | PASS — no regression |
| CR-05 append on scripted/Reveal rails | temporary resolver probe | Standard target kept; scripted/Reveal targets null; forged id rejected `loop-source-key-insert-rejected` | PASS — no regression |
| Truth 57 Force Spacing over an overridden rail | temporary resolver probe | `ok:true`, mapping `{K1:1,K3:4,K5:7}`, band retimed `{placementStart:1, phaseOrigin:1, originalEndExclusive:8, ranges:[1,8)}`, `uncovered:[]`, derived `effectiveEnd:8`, `unresolved:null` | PASS — gap closed |
| Truth 57 spacing-on-set over an overridden rail | temporary resolver probe | identical mapping and retimed band; `uncovered:[]`; derived end 8 | PASS — gap closed |
| Shrink edge observation | temporary resolver probe | retimed band `[1,4)` with `O1@5` retained; `parsePhysicPaintRotoLoopClips` throws "malformed Loop Clip record" | RECORDED — advisory 6 (pre-existing, out of scope) |
| Probe cleanup | `git status --short` | only `.planning/.../58-VERIFICATION.md` modified; probe spec deleted | PASS |

The temporary probe spec imported the real `resolvePhysicPaintRotoPhysicalEdit`, the real loop-clip/record types, `getPhysicsPaintRotoSourceCycleId`, `PHYSIC_PAINT_MAX_APPLY_FRAMES`, and `testWebpBytes`; it was deleted after the run and is not part of the phase artifacts. The pre-phase-58 comparison used `git show bdc5928ac^:...physicsPaintRotoPhysicalResolver.ts`, which contains the same retime arithmetic without the canonical narrowing and spreads `frameOverrides` verbatim.

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
| RAIL-06 | 58-01, 58-07, 58-10 | Single-key drag under Law A; keys referenced by more than one loop keep D-11; shared linked-cycle behavior never silently relaxed, including the group move | SATISFIED | Truths 8, 16-20, 32-36, 46-57; all four prior RAIL-06 gaps (CR-01/CR-04a-b/CR-04c/CR-05) and the round-2 truth 57 regression are closed and re-confirmed by probes; the authorized spacing branches retime non-canonical rails while the move branches keep the canonical narrowing |
| RAIL-07 | 58-01, 58-02, 58-07, 58-09, 58-10 | Regression-locked behavior, existing D-11 tests green, no `.mce` schema change | SATISFIED | Truths 25, 32-56; 15 suites / 1554 tests green; decisions 17/17; `tsc --noEmit` exit 0; no `.mce`/parser/Rust change; new D-14/D-24 regression tests added by `2c0f22ce0` |

No orphaned requirements: all seven IDs appear in the ten plan frontmatter blocks (`RAIL-01..RAIL-07`), and `.planning/REQUIREMENTS.md` maps exactly these seven to Phase 58.

### Test Quality Audit

| Test File | Linked Req | Assertion Level | Verdict |
|-----------|-----------|-----------------|---------|
| `physicsPaintRotoLoopGuards.test.ts` | RAIL-03, RAIL-06, RAIL-07 | Value + behavioral (mapping, failure code/copy, derived `unresolved`, effectiveEnd, CR-04 coverage, Force Spacing non-canonical retime) | PASS — the round-2 coverage omission is closed by the D-14 test |
| `physicsPaintRotoPhysicalResolver.test.ts` | RAIL-03, RAIL-06, RAIL-07 | Value/behavioral (resolver proposals, CR-01 spaced insert, CR-05 append, CR-03, spacing-on-set non-canonical retime) | PASS — the round-2 coverage omission is closed by the D-24 test |
| `physicsPaintRotoGroupParity.test.ts` | RAIL-03, RAIL-07 | Value (extent agreement) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | RAIL-03, RAIL-04, RAIL-05 | Behavioral (real history, interleavings, commit counts) | PASS |
| `useRotoPhysicalEditCoordinator.test.ts` | RAIL-03, RAIL-05, RAIL-07 | Behavioral (coordinator -> history, byte-identical pass-through) | PASS |
| `useRotoTimelineActions.test.ts` | RAIL-01, RAIL-06 | Behavioral (dispatch counts, classifier routing, rail insert, CR-05 detached-key rows) | PASS |
| `physicsPaintRotoRailSetCopy.test.ts` | RAIL-06, RAIL-07 | Value (copy payload, extent) | PASS |
| `physicsPaintRotoKeyRailCycle.test.ts` | RAIL-03, RAIL-07 | Value (record shape, extents, classification) | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | RAIL-02, RAIL-04 | Behavioral (rendered vnode gates + handler dispatch) | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | RAIL-01 | Behavioral + source anchors | PASS |
| `PhysicsPaintKeyRail.test.tsx` (via launcher) | RAIL-01 | Behavioral (click timing, keyboard) | PASS |
| `PhysicsPaintStudio.test.ts` | RAIL-01 | Behavioral + source anchors | PASS |
| `physicsPaintRotoRunScriptStacking.test.ts` | RAIL-03 | Value | PASS |
| `physicsPaintRotoPhysicalModel.test.ts` | RAIL-03 | Value | PASS |
| `physicPaintStore.rotoLoopClips.test.ts` | RAIL-06, RAIL-07 | Behavioral (persisted clip normalization) | PASS |

**Disabled tests on requirements:** 0. **Circular patterns:** 0. **Debt markers:** 0 `TBD`/`FIXME`/`XXX` in the phase-modified implementation and test files.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `physicsPaintRotoPhysicalResolver.ts` | review WR-01 (`resolvePhysicPaintRotoRailKeyInsertTarget`) | Paint/+Key rail insert never grows capacity | Warning | Tail insert can fail `over-capacity` while insert-slot grows |
| `physicsPaintRotoPhysicalResolver.ts` | review WR-02 (`:5653-5668`) | Retime dropped silently when the band exceeds capacity | Warning | Half-applied move possible on the capacity boundary |
| `physicsPaintRotoPhysicalResolver.ts` | review WR-03 (insert growth branch) | Insert growth swallows trailing content for repeat > 1 | Warning | Trailing content inside the grown band |
| `physicsPaintRotoPhysicalResolver.ts` | review WR-04 (rail delete) | Deleting the first phase of a spaced source cycle degrades to hole semantics | Warning | Semantic drift, tracked in the disposition |
| `physicsPaintRotoPhysicalResolver.ts` | review WR-05 (`:2394`) | Append ripples every trailing key/clip by the full growth | Warning | Content beyond the destination shifts |
| `physicsPaintRotoPhysicalResolver.ts` | review IN-01..IN-10 | Dead `frameOwners` map, unused exports, insert/classifier divergences, test gaps | Info | Tracked in 58-REVIEW-DISPOSITION.md |
| `physicsPaintRotoPhysicalResolver.ts` | `:1104-1128` retime spread | Authorized shrink retime preserves `frameOverrides` verbatim, so an override can land past the retimed end | Warning (out of phase scope, pre-existing) | Probe: `emptyFrames:0` → band `[1,4)` with `O1@5`; parser rejects the clip. Present identically at `bdc5928ac^`; needs a product decision (advisory 6) |

No `TBD`/`FIXME`/`XXX` debt markers were found. The round-2 blocker row (canonical-only retime in the shared helper) is closed: the canonical check is now bypassable only by the two authorized spacing branches, and the move-branch narrowing plus global ghost guard remain intact. The warnings and info rows above are tracked in `58-REVIEW-DISPOSITION.md`; they are not independently reproduced by a failing test in this verification and do not by themselves drive the verdict.

### Human Verification Required

None required for this round's verdict. Every truth is deterministic in the resolver/controller/UI projection and is covered by passing specs or the verifier probe. Live UAT remains the user's option; the user-visible rows already approved (Edit Rail, Cycle/Infinity, Cancel, Law A drag, spaced-rail Insert, cross-clip ghost, whole-cycle group drag, +Key/paint on scripted/Reveal rails) are unchanged, and the new path to spot-check manually is a Force Spacing / Key Spacing on an overridden rail, where the last respaced key must stay visible.

### Gaps Summary

No gaps remain. All 57 must-haves are verified on `2c0f22ce0` (54 VERIFIED + 3 PASSED override).

The single round-2 regression — RAIL-06 / truth 57, Force Spacing and spacing-on-set ghosting their last respaced source key on a non-canonical rail — is closed by `2c0f22ce0`. The fix is correctly scoped: `retimeNonCanonical` defaults to `false` and is passed only by the two authorized spacing branches (`resolver:3791`, `:6128`), so the move branches keep the canonical narrowing that protects the CR-04c rejection (re-confirmed by probe). The same probe that previously falsified the truth now shows the band retimed to `[1,8)`, the mapping `{K1:1,K3:4,K5:7}`, the override retained inside the band, and zero uncovered source keys for both operations; a derived-range check confirms `effectiveEnd:8` and `unresolved:null`.

The four gaps closed in round 2 (spaced-rail Insert CR-01, cross-clip ghost guard CR-04a/b, whole-cycle group retime/refusal CR-04c, Standard-only append CR-05) remain closed and were independently re-confirmed. The conversion path (RAIL-01..RAIL-05), undo/redo, cancel fencing, inspector surfaces, and the existing order guards remain verified. One pre-existing shrink edge in the authorized spacing retime is recorded as advisory 6 with deterministic evidence; it is outside truth 39's planned trigger, outside every RAIL requirement, and requires a product decision rather than a phase-58 fix.

---

_Verified: 2026-11-05T12:14:30Z_
_Verifier: Claude (gsd-verifier)_
