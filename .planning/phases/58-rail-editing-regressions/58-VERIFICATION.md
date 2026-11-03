---
phase: 58-rail-editing-regressions
verified: 2026-11-03T16:59:06Z
status: human_needed
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
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
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
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
covered_digest: "v4:sha256:b849d4b65cd5962c166a166000ac14f2e68c06e9ca93726c044cedd16a7e8a4c"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 38/38
  gaps_closed:
    - "G-01: a finite lifecycle cycle now stops at the surviving source extent on read and repairs itself on the next accepted write; groupOverrideRecords cannot survive outside every referencing clip's extent (58-09)"
    - "CR-03: a partial-cycle group move now shares the move-key final-mapping source-order proof and rejects an order-breaking drag with the existing locked copy (58-10)"
    - "CR-01 (deep review): a pasted Infinity rail whose frozen span is not a whole cycle multiple keeps its full visible duration — the ceil cycle count makes G-01's source extent inert on the pasted clip (e50af31c0)"
    - "WR-01 (deep review): a real key inside a lifecycle gap is deletable; the resolver's Group-ownership predicate and the UI classifier now agree that a gap frame renders no Group content (e50af31c0)"
  gaps_remaining: []
  regressions: []
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
    reason: "Narrow residual of combining G-01's lazy repair with the paste semantic-delta recompute; source-derived, no failing test run. The rejection writes nothing and the paste can be retried after the source rail is repaired. Would be resolved by building the paste impact from the post-reconcile document (the CR-01 review's second recommendation) or canonicalizing at copy time."
    evidence_status: "none provided — source-derived, no failing test run"
deferred:
  - truth: "Per-frame cells, cycle grays, and the rail colour dot on Standard rails"
    addressed_in: "v7 timeline rails (in-milestone quick)"
    evidence: "ROADMAP Phase 58 SC2: 'Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58.'"
  - truth: "Motion channels"
    addressed_in: "v2.1.0"
    evidence: "ROADMAP v7 timeline rails: 'Motion channels stay in v2.1.0.'"
human_verification:
  - test: "In the Studio, select a normal Key Rail; then double-click one; then focus one and press Enter; then Close"
    expected: "The Scripts pane is replaced by the Selected Key Rail inspector with exactly Frames F{first}–F{last}, Keys n, Type Standard, Edit Rail and Close; each entry surface opens the reduced modal; Close restores the normal Scripts content"
    why_human: "Live Preact render, focus and pointer timing in the WKWebView; the node harness mocks useEffect and cannot observe the real surface"
  - test: "Open Edit Rail and inspect the reduced modal; set a repeat and confirm"
    expected: "Only the Cycle stepper (prefilled 1) and Infinity switch; Create Cycle commits a gray Standard cycle; no tabs, rail type, frames-per-cycle, Motion, source-cycle, seed, or Regenerate controls appear"
    why_human: "Visual surface and modal round-trip"
  - test: "Modifier-select two or more rails whose first member is a Key Rail"
    expected: "The anchor Key Rail's inspector shows Edit Rail visibly disabled with 'Select a single rail to edit it.' and no bulk conversion is offered"
    why_human: "Live selection behavior and disabled tooltip"
  - test: "Open the reduced Cycle modal, press Create Cycle, then press Cancel or Escape while the authority request is in flight; then repeat and cancel during committing"
    expected: "Zero writes, no undo entry, the modal remains usable, and a later Create Cycle commits exactly once. The controller contract is unit-pinned; the visible in-flight timing needs a live check"
    why_human: "Real timing of the in-flight window and live dialog usability (58-06 D3 / 58-VALIDATION manual row)"
  - test: "With exactly one loop referencing a source cycle, drag a single key in the live Studio to an order-preserving frame and then to an order-breaking frame"
    expected: "The safe move is accepted and the cycle re-derives; the order-breaking move is rejected with the locked rigid-group copy and never shows 'Source missing'"
    why_human: "Pointer gesture and rail rendering in the packaged app (58-01 D5 / 58-VALIDATION manual row)"
  - test: "In the reduced Cycle form, press Enter inside the Cycle field; then press Escape"
    expected: "Enter confirms exactly once (same as clicking Create Cycle); Escape cancels with zero writes"
    why_human: "Keyboard routing on the live surface; the node spec dispatches Enter at the dialog root"
  - test: "G-01 live repro: convert a Motion rail to a Standard (grey) cycle, delete the end keys and change the Cycle count, then close and reopen the Studio"
    expected: "The cycle stops at the surviving source extent: frames whose keys were deleted render empty (no cached paint), stale paint sheets are gone, and the repaired extent survives reopen. A genuinely dangling source id still presents 'Source missing'."
    why_human: "Requires the live Studio, the per-key pixel cache, and a close/reopen round-trip; 58-UAT.md Gaps G-01"
  - test: "CR-01 live: copy an Infinity rail whose visible span is not a whole multiple of its cycle length (e.g. keys at 10 and 14, cycle 5, next unowned key at 27), paste it elsewhere, commit, then reopen"
    expected: "The pasted rail renders the full copied visible duration (its 17-frame tail included) and survives the commit and reopen byte-identically; no tail frames are trimmed"
    why_human: "Live copy/paste and pixel rendering; the invariant is unit-pinned but the visible tail needs a live check"
  - test: "WR-01 live: reach a lifecycle gap (a rendered Group frame that later leaves visibleRanges) and press Delete on the real key now sitting on the gap frame; separately press Delete on a visible Group frame"
    expected: "The gap-frame key deletes normally (no impossible 'Delete the Rail frame instead' instruction); the visible Group-frame key stays refused with the locked copy"
    why_human: "Requires the live rail-set paste/delete sequence and pointer/keyboard delete routing"
  - test: "CR-03 live: select a partial source-cycle set (e.g. A and B of A..E) and drag the group to an order-preserving destination, then to an order-breaking one"
    expected: "The order-preserving drag is accepted and commits exactly once with the cycle still resolvable; the order-breaking drag is rejected with the locked rigid-group copy, never commits, and never shows 'Source missing'"
    why_human: "Pointer gesture and rail rendering in the packaged app (58-UAT.md row 7, now resolved in code)"
---

# Phase 58: Rail editing regressions Verification Report

**Phase Goal:** A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Verified:** 2026-11-03T16:59:06Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (58-09 G-01, 58-10 CR-03, e50af31c0 CR-01/WR-01)

## Goal Achievement

The phase goal is achieved in the codebase, and the two gap-closure waves plus the post-review fixes are verified against the live tree rather than the summaries.

- The Key Rail → Standard pipeline (RAIL-01..RAIL-05) is unchanged and still verified end to end: inspector takeover, reduced Cycle/Infinity modal, provenance-free Standard record, one loop-only commit, one-command undo/redo, and a cancel path that participates in the generation contract.
- The single-key drag law (RAIL-06) is verified for both branches: `move-key` keeps the CR-02 final-mapping order proof, and `move-key-group` now shares the same `loopSourceOrderIsProvable` helper at `physicsPaintRotoPhysicalResolver.ts:1878`, `:4554`, `:5054`.
- G-01 (58-09) is closed: `resolvePhysicPaintRotoLoopSourceExtent` (`physicsPaintRotoPhysicalModel.ts:1003`) bounds a finite lifecycle clip to the surviving source extent; `derivePhysicPaintRotoLoopRanges` clamps at `physicsPaintRotoPhysicalResolver.ts:5666-5671`; the Group lifecycle proposers/classifier use the same bound; `reconcilePhysicPaintRotoGroupFrames` (`:1062`) prunes stale ranges and override records at the coordinator write choke point (`useRotoPhysicalEditCoordinator.ts:2346-2355`); `updateLoop` prunes overrides past the surviving end before staging (`physicsPaintRotoPlayScriptController.ts:2269-2309`).
- CR-03 (58-10) is closed: the `move-key-group` guard reads the final candidate mapping, is intersection-scoped, and reuses `loop-source-key-move-rejected` plus the verbatim D-16 copy.
- CR-01 (review) is closed: `resolveLoopCopyExtent` uses `Math.ceil` (`physicsPaintRotoRailSetCopy.ts:313`), so a pasted Infinity rail's frozen cycle count always covers its stored span; the regression pin asserts repeat 4, stored end 57, and extent 60 >= 57 (`physicsPaintRotoRailSetCopy.test.ts:710-745`).
- WR-01 (review) is closed: `isGroupOwnedKeyFrame` requires `visibleRanges` containment (`physicsPaintRotoPhysicalResolver.ts:1057-1075`), so a real key on a lifecycle gap frame deletes normally while a visible Group frame still refuses with the locked copy; the pin covers both sides (`physicsPaintRotoLoopGuards.test.ts:1374-1410`).

The status is `human_needed`, not `passed`, because ten live-only checks remain (the six original UAT rows plus live rows for G-01, CR-01, WR-01, and CR-03). No must-have truth is FAILED, no artifact is missing or a stub, every key link is wired, and no blocker anti-pattern was found.

### Observable Truths

| # | Truth | Requirement | Status | Evidence |
|---|-------|-------------|--------|----------|
| 1 | Selecting a normal Key Rail exposes the sidebar Edit Rail action: the Scripts panel is replaced by an inspector with Edit Rail and Close | RAIL-01, SC1 | ✓ VERIFIED | `PhysicsPaintScriptsPanel.tsx:151-160` takeover branch precedes the loop branch; `PhysicsPaintStudio.tsx:7183-7185`; ScriptsPanel spec 61/61, Studio spec 336/336 |
| 2 | Double-clicking a Key Rail invokes the open intent: plain second click within 220 ms, never a move member, never while busy | RAIL-01, D-02 | ✓ VERIFIED | `PhysicsPaintKeyRail.tsx:31`, `:277-283`, `:305`; `PhysicsPaintWorkflowStrip.tsx:447`, `:4868`; KeyRail launcher 17/17 |
| 3 | Enter on a focused Key Rail selects it then invokes the same open intent; Space still plain-selects; Escape still hides the tooltip | RAIL-01, D-02 | ✓ VERIFIED | `PhysicsPaintKeyRail.tsx:300-307`; KeyRail launcher 17/17 |
| 4 | The conversion modal shows only the Cycle stepper and Infinity switch, prefilled at 1 and unchecked, with no tabs, rail type, frames-per-cycle, Motion, source cycle, seed, or Regenerate | RAIL-02, SC1, D-05 | ✓ VERIFIED | `ReducedCycleCard` `PhysicsPaintPlayScriptCards.tsx:561`; `PhysicsPaintPlayScriptDialog.tsx:64-72`, `:377-380`; dialog spec 108/108 |
| 5 | Cancel performs zero writes: no store mutation, no revision bump, no undo entry | RAIL-04, SC3 | ✓ VERIFIED | `acceptedGeneration = ++generation` before `'preparing'` (`controller:1835`), `assertCurrent` after authority (`:1842`) and after commit (`:1874`), AbortError → `'cancelled'` without `fail()` (`:1878-1893`); test `controller.test.ts:4066-4115` |
| 6 | The primary action labels Create Cycle for a first conversion and Update Rail for an existing Standard clip, and both route through `playScript.confirm()` | RAIL-02, D-05 | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:582-587`; dialog spec 108/108 |
| 7 | Confirming creates one provenance-free Standard clip: `sourceKeyIds` in segment order, `placementStart` = first key frame, repeat from the reduced form, no `scriptId` / `railKind` / `motion` | RAIL-03, SC2 | ✓ VERIFIED | `buildKeyRailStandardLoopClip` `physicsPaintRotoRunScriptStacking.ts:597`; `controller.test.ts:3980-4025` |
| 8 | Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent "Source missing" clip with no in-UI repair | Goal clause: without silently relaxing linked-cycle ownership | ✓ VERIFIED | `resolver:4540-4556`; `loopGuards.test.ts:283-309` moves A 10 → 9 and asserts the derived L1 range `unresolved` is null |
| 9 | The clip classifies as Standard and presents via the existing `.rail-kind-standard` pill; the existing Edit Rail dialog owns Repeat/Infinity afterwards | RAIL-03, SC2 | ✓ VERIFIED | `classifyLoopClipRailKind(clip) === 'standard'` pinned `KeyRailCycle.test.ts:104`; CSS `physicsPaintStudio.css:4935-4936` |
| 10 | A gapped segment keeps its span: cycle length = last - first + 1, extent clamped to capacity, infinity lifecycle-less | RAIL-03, D-09 | ✓ VERIFIED | `controller:1850` passes `cycleFrameCount`; `KeyRailCycle.test.ts` (8 tests) covers 6-frame cycle, repeat-2 extent 22, repeat-1 extent 16, infinity |
| 11 | A single-key segment converts to a 1-frame cycle | RAIL-03, D-08 | ✓ VERIFIED | `KeyRailCycle.test.ts` single-key case |
| 12 | A second conversion over already loop-owned keys is refused before any commit | RAIL-03 | ✓ VERIFIED | open-time `controller:1781`, confirm-time `:1846`; tests `controller.test.ts` owned via `sourceKeyIds` and via `frameOverrides` |
| 13 | Undo restores the pre-conversion Key Rail and Redo re-applies the conversion as one command | RAIL-05, SC3 | ✓ VERIFIED | `controller.test.ts:4026-4046` drives the real history hook: availability 1/0, redo restores `originalEndExclusive` 16 |
| 14 | The conversion is exactly one `ports.commit` with `semanticDelta.kind 'play-script'`, `loopOnly: true`, `affectedEndAppFrame = anchor - 1`, `freshKeyIds: []` | RAIL-05 | ✓ VERIFIED | `buildLoopOnlyPublication` `controller:2140-2177`; `confirmKeyRailCycle:1861-1870`; test `controller.test.ts:3980-4025` |
| 15 | Cancel and every refusal perform zero commits and zero history entries | RAIL-04, RAIL-05 | ✓ VERIFIED | Generation fence (truth 5); cancel-after-open pinned `controller.test.ts:4049`; refusals return before commit (`controller:1843-1846`); in-flight cancel asserts zero history |
| 16 | A single-key drag on a key referenced by exactly one loop is accepted and lands on the requested frame (Law A) | RAIL-06, SC4, D-12 | ✓ VERIFIED | `resolver:4540-4542` comparator `> 1`; `loopGuards.test.ts:283-309` |
| 17 | A key referenced by two or more loops is rejected, never moves silently, with `loop-source-key-move-rejected`, `move-key`, and the verbatim D-16 copy | RAIL-06, SC4, D-11 | ✓ VERIFIED | `resolver:4540-4542`; locked copy `resolver:864-865`; `loopGuards.test.ts:366` |
| 18 | An accepted single-key move never emits `nextLoopClips`, so `placementStart` stays put | RAIL-06, D-13 | ✓ VERIFIED | `loopGuards.test.ts:295` (`proposal.nextLoopClips` null) |
| 19 | Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy | RAIL-06, D-14, D-15 | ✓ VERIFIED | `resolver:4563-4589` linked-source `> 0` guard; `loopGuards.test.ts:684-707` no-leak pins; Force Spacing test suite green |
| 20 | The acceptance is entirely inside the resolver: `prepareRotoKeyDrag` / `commitRotoKeyDrag` and the WorkflowStrip drag dispatch are untouched | RAIL-06 | ✓ VERIFIED | Gap-closure diff touches only resolver, controller, coordinator, model, lifecycle, dialog and specs; `useRotoTimelineActions.ts:2424-2433` drag dispatch unchanged |
| 21 | Edit Rail and double-click/Enter reach one Studio handler that selects the rail first, then delegates to `openKeyRailCycleEdit`, returning a Promise on every path | RAIL-01, D-01 | ✓ VERIFIED | `PhysicsPaintStudio.tsx:4814-4824`; Studio spec `selects before opening and returns a Promise on the missing-segment refusal` |
| 22 | A 2+ rail set whose anchor is a Key Rail projects with setSize >= 2, Edit Rail visible and disabled with "Select a single rail to edit it.", and no bulk conversion | RAIL-01, D-03 | ✓ VERIFIED | `Studio:4882-4888`, shared anchor `:1781`; `physicsPaintKeyRailPresentation.ts:111`, `:129-143` |
| 23 | Close clears both `selectedRotoKeyRail` and `railSetSelection`, so the takeover dismisses in the plain and rail-set states | RAIL-01, D-01, D-03 | ✓ VERIFIED | `Studio:4830-4833`; Studio spec `clears BOTH selection layers on Close` |
| 24 | The inspector shows exactly Frames F{first}-F{last}, Keys n, Type Standard, and keeps one object identity across unrelated renders | RAIL-01, D-04 | ✓ VERIFIED | `physicsPaintKeyRailPresentation.ts:129-143`; memo deps `Studio:4882-4888`; `reconcileRotoKeyRailSelection:453-463` |
| 25 | No `.mce` schema field is added or changed; resolver, undo, and existing D-11 guard tests are green or deliberately updated | RAIL-07, SC5 | ✓ VERIFIED | Phase diff contains no `.mce`, schema, parser, `src-tauri`, or `app/src/types` path; full suite 7113 passed; `tsc --noEmit` exit 0 |
| 26 | Cancelling while the conversion is still awaiting authority never calls `ports.commit`, lands in `'cancelled'`, leaves error null, and produces no accepted output | RAIL-04, RAIL-05 (58-06) | ✓ VERIFIED | `controller:1842` assertCurrent before ack; test `controller.test.ts:4066-4115` |
| 27 | A cancelled conversion keeps `keyRailCycleEditTarget` and the open dialog, so a later confirm retries and commits exactly once | RAIL-04 (58-06) | ✓ VERIFIED | `controller:1878-1893`; test asserts target non-null, `confirmationOpen` true, retry returns true and commit called once |
| 28 | Cancelling while the phase is `'committing'` neither clears the target nor closes the dialog; after that commit fails, Create Cycle retries and commits | RAIL-05 (58-06, WR-01) | ✓ VERIFIED | `cancel()` busy early return `controller:3659-3660`; test `controller.test.ts:4117-4164` |
| 29 | A cancel before confirm still closes the dialog with zero writes | RAIL-04 (58-06) | ✓ VERIFIED | Existing test `controller.test.ts:4049` unchanged and passing |
| 30 | An AbortError is never routed through `fail()`: no `'Play Script failed'` phase, no error text, no error-level log | RAIL-04 (58-06) | ✓ VERIFIED | `controller:1878-1893`; test asserts status `'Key Rail cycle cancelled'`, error null, no error-level log |
| 31 | The successful conversion path still commits exactly once, clears the target, and closes the dialog | RAIL-05 (58-06) | ✓ VERIFIED | `controller.test.ts:3980-4025`: one commit, phase `'complete'`, target null, `confirmationOpen` false |
| 32 | With exactly one referencing loop, a move-key whose final mapping breaks strict increase is rejected with `loop-source-key-move-rejected`, `operationKind move-key`, and the verbatim D-16 copy | RAIL-06 (58-07, CR-02) | ✓ VERIFIED | `resolver:4553-4556`; `loopGuards.test.ts:311-317` pins C 12 → 22 |
| 33 | The order check reads the FINAL candidate mapping (ripple-proof) and fails closed when a referenced source key is absent from the mapping | RAIL-06 (58-07) | ✓ VERIFIED | `resolver:4553-4556` reads `moveResult.candidate.mapping`; `loopGuards.test.ts:337-344` dangling-source rejection |
| 34 | A one-element source cycle is always order-preserving and its only key can move | RAIL-06 (58-07) | ✓ VERIFIED | `loopGuards.test.ts:319` one-element acceptance with a resolved derivation |
| 35 | A key referenced by no loop, and a no-change drag back to its own cell, are accepted | RAIL-06 (58-07) | ✓ VERIFIED | `loopGuards.test.ts:346` (unreferenced) and `:356` (no-change dangling exemption) |
| 36 | `sourceKeyIds` is never re-sorted or mutated; an order-breaking destination is rejected rather than re-sequenced | RAIL-06 (58-07) | ✓ VERIFIED | Resolver guard only reads; `loopGuards.test.ts:305-308` asserts the input loop collection is unchanged |
| 37 | In key-rail-create, Enter calls `confirm()` exactly once despite the stale `'Maximum available count is 0.'` frames error, and the primary button is enabled | RAIL-02 (58-08, WR-02) | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:150-157`, `:302`, `:579`; test `PhysicsPaintPlayScriptDialog.test.ts:984-995` |
| 38 | The Enter guard and primary disabled share one `confirmBlocked`; repeatError blocks both; the merged Standard reduced form also confirms; full apply, Reveal, and stack-collision surfaces keep their prior gating; Escape/canCancel precedence unchanged | RAIL-02, RAIL-04 (58-08, WR-02) | ✓ VERIFIED | Dialog tests `:997-1007` (repeatError), `:1009` (merged Standard), `:1032` (Escape/canCancel), `:1050-1078` (apply/Reveal), `:1079-1092` (stack collision) |
| 39 | Group override records never survive outside every referencing clip's surviving extent: a delete or repeat change that retires the frame removes the `frameOverrides` reference and the `groupOverrideRecords` record in the same accepted write — except the empty-trim fail-safe, which leaves the clip byte-identical, overrides included | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | `reconcilePhysicPaintRotoGroupFrames` `physicsPaintRotoPhysicalModel.ts:1062-1130`; coordinator choke point `useRotoPhysicalEditCoordinator.ts:2346-2355`; tests `useRotoPhysicalEditCoordinator.test.ts:4541`, `:4603`, `:4640`; `physicsPaintRotoGroupParity.test.ts` (50 tests) |
| 40 | A finite lifecycle clip's derived range never ends past `phaseOrigin + cycleLength * repeat` computed from the clip's current source-key positions (capacity-clamped); frames beyond that bound resolve empty and never classify as Group content | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent` `model:1003-1031`; `boundedNaturalEnd` `resolver:5666-5671`; `classifyPhysicPaintRotoGroupFrameTarget` `GroupLifecycle:384` + `resolveGroupBoundedEnd:320-337` used at `:102`, `:366`, `:395`, `:621`, `:747`; `loopGuards.test.ts:1249-1270` asserts effectiveEnd 16 vs requested 20, frames 16/17 empty, `unresolved` null |
| 41 | Deleting a real key whose frame sits inside a lifecycle clip's surviving extent is refused with the locked copy, and a key past that bound deletes normally while its stale paint sheet is pruned in the same write whenever the trimmed ranges stay non-empty | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | `isGroupOwnedKeyFrame` `resolver:1057-1075`; fail calls `:4235`, `:4284`, `:4374` with `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` `:874`; pins `loopGuards.test.ts:1350-1440`; prune in the coordinator reconcile (truth 39) |
| 42 | Repeat contraction filters the rebuilt clip's `frameOverrides` to frames strictly before the source-derived surviving end before staging, so the accepted clip persists at the bounded end and passes the bridge staged-document parser; an override inside the surviving end but past the new end still raises the unchanged "Cycle count cannot remove locally painted Rail frames. Regenerate the Rail first." copy | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | `updateLoop` `physicsPaintRotoPlayScriptController.ts:2269-2309`; refusal preserved `controller.test.ts:2522-2535`; pruning `:2537-2570` |
| 43 | After the first accepted write on an already-stale document whose clip can be trimmed non-empty, the persisted clip extent and override collection are canonical (extent equals the source-derived bound, no orphan override), in one undo step that also restores the deleted key | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | Named tests pass: `useRotoPhysicalEditCoordinator.test.ts:4541` (repair on delete), `:4576` (undo one command), `:4603` (byte-identical when canonical) |
| 44 | A stale document whose `sourceKeyIds` all still exist loads, derives, and resolves without an unresolved range, "Source missing" label, or export block (a genuinely dangling source id keeps today's `{ missingSourceKeyIds }` result and presentation); no load-time migration and no revision churn on an already-canonical document | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | `loopGuards.test.ts:1249-1285` (stale → unresolved null; dangling → `missingSourceKeyIds ['C']`; non-lifecycle keeps stored behavior; infinity to capacity); `useRotoPhysicalEditCoordinator.test.ts:4603` (canonical pass-through), `:4626` (infinity untouched); no parser/migration file changed |
| 45 | No `.mce` field, parser shape, storage mode, or persisted schema changes; D-08..D-11 conversion semantics, every existing D-15 guard surface, D-16 copy, and D-17 regression locking are preserved — the one added refusal is the G-01 ownership-parity guard for `frameOverrides`-owned frames, which closes a gap D-15 never covered and leaves existing Delete/Insert/Duplicate/Key-Rail-move outcomes unchanged | RAIL-03, RAIL-07 (58-09) | ✓ VERIFIED | Plan diff confined to the listed model/resolver/lifecycle/controller/coordinator/hooks + specs; no `.mce`/parser/Rust/types change; full suite 7113 passed; `loopGuards.test.ts:1411-1440` pins D-07 precedence and past-extent deletes |
| 46 | An order-preserving partial-cycle group move stays accepted: moving the A,B pair from frames 10-11 to physical cells 8-9 under loop(10,5) yields A:8, B:9, C:12, D:13, E:14, leaves `nextLoopClips` null and `placementStart` 10, and the derived clip reports `unresolved` null | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `loopGuards.test.ts:765-781`; named test passes |
| 47 | An order-breaking partial-cycle group move is rejected: the same A,B pair to physical cell 20 projects A:20, B:21 and C:12 at the clip's third source position and fails with `loop-source-key-move-rejected`, `operationKind move-key-group`, and the verbatim D-16 copy | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `resolver:5054-5056`; `loopGuards.test.ts:782-793`; named test passes |
| 48 | The order proof reads the final candidate mapping, so a moved key landing past a non-moved source key is caught, and a clip source key absent from the mapping fails closed | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `loopSourceOrderIsProvable` `resolver:1878-1890`; guard `:5054`; `loopGuards.test.ts:831-838` (touched dangling clip rejects) |
| 49 | Every clip whose `sourceKeyIds` intersect the moved key set is projected; a clip the move does not touch keeps today's behavior even when it is already unresolved | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `loopGuards.test.ts:820-829` (unreferenced move beside a dangling clip accepted); `:851-858` (one touched clip breaks → whole move rejected) |
| 50 | `move-key` and `move-key-group` share one order helper and one failure call, so CR-02's behavior is byte-identical and its existing tests stay unedited and green | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `resolver:1878`, `:4554`, `:5054`; CR-02 pins `loopGuards.test.ts:311-356` unchanged and green in the 63-test file |
| 51 | On the UI path an order-breaking partial-cycle group drag prepares as `ok:false` carrying the locked copy and never calls `executePhysicalEdit`, while the order-preserving drag commits exactly once | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `useRotoTimelineActions.test.ts:1810-1838`; both named tests pass |
| 52 | Whole-cycle rigid group moves and the two-loop D-04 `placementStart` follow, no-change drags, one-element cycles, and ordinary moves behave exactly as before; no `.mce`, parser, failure-union (beyond reusing `loop-source-key-move-rejected`), or copy changes | RAIL-06, RAIL-07 (58-10) | ✓ VERIFIED | `loopGuards.test.ts:721-760` (whole-cycle follow), `:802-849` (no-change exemption, one-element cycle, unreferenced move); no new failure code; full suite green |

**Score:** 52/52 truths verified (0 present, behavior-unverified)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-frame cells, cycle grays, and the rail colour dot on Standard rails | v7 timeline rails (in-milestone quick) | ROADMAP Phase 58 SC2: "Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58." |
| 2 | Motion channels | v2.1.0 | ROADMAP v7 timeline rails: "Motion channels stay in v2.1.0." |

### Advisory (New Scope, Unevidenced)

New-scope findings with no deterministic evidence — reported, not blocking, and they do not revert a completed must-have.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Reduced Cycle dialog composition leaves ~376px vertical / ~478px horizontal dead space | other | 58-UI-REVIEW.md priority 1; CSS-derived geometry, no screenshots |
| 2 | Refusal reasons are dropped; `rejectLoopOp` nulls `error`, so refused actions leave "Ready" | other | 58-UI-REVIEW.md priority 2; source-derived UX gap, not a write-path defect |
| 3 | Footer Cancel/primary stay enabled-looking during `'committing'` while both are no-ops | other | 58-UI-REVIEW.md priority 3; UX polish of the deliberate WR-01 no-op window |
| 4 | Paste of a copy taken from an already-stale finite lifecycle rail can be rejected fail-closed by the bridge's canonical recomputation | other | G-01 reconcile trims the child clip while the paste delta is untrimmed; source-derived, no failing test run; rejection writes nothing |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `physicsPaintRotoPhysicalResolver.ts` | Law A guard, CR-02 final-mapping order guard, move-key-group order guard, visibility-based Group ownership, G-01 bounded derivation | ✓ VERIFIED | `loopSourceOrderIsProvable:1878`; move-key `:4540-4556`; force-spacing `:4563-4589`; move-key-group `:5054-5056`; `isGroupOwnedKeyFrame:1057-1075`; derivation `:5591`, clamp `:5666-5671` |
| `physicsPaintRotoPhysicalModel.ts` | Shared source-extent helper, reconcile, override pruning | ✓ VERIFIED | `resolvePhysicPaintRotoLoopSourceExtent:1003`; `reconcilePhysicPaintRotoGroupFrames:1062`; non-mutating, returns input refs when unchanged |
| `useRotoPhysicalEditCoordinator.ts` | Reconcile at the write choke point before revision/payload | ✓ VERIFIED | `:2346-2355` feeds `stagedRevision`, staged parse, payload `loopClips`/`groupOverrideRecords` `:2360-2430` |
| `physicsPaintRotoGroupLifecycle.ts` | Source-extent bound in classify/proposers/regenerate | ✓ VERIFIED | `resolveGroupBoundedEnd:320-337`; used `:102`, `:366`, `:395`, `:621`, `:747`; `classifyPhysicPaintRotoGroupFrameTarget:384` |
| `physicsPaintRotoPlayScriptController.ts` | Update Rail surviving end, override pruning, generation-fenced conversion, busy-phase cancel | ✓ VERIFIED | `confirmKeyRailCycle:1823-1893`; `buildLoopOnlyPublication:2140`; `updateLoop:2269-2309`; `cancel():3652-3669` |
| `physicsPaintRotoRailSetCopy.ts` | Ceil cycle count for a frozen Infinity span | ✓ VERIFIED | `:313` `Math.max(1, Math.ceil(...))`; both pinned whole-multiple expectations unchanged |
| `useRotoTimelineActions.ts` | Frame-aware Group-owned delete routing | ✓ VERIFIED | `resolveGroupOwnedDeleteFrame:734-745`; `classifyRotoDeleteTarget:775-940`; multi/rail selections fail closed |
| `physicsPaintRotoLoopGuards.test.ts` | Law A boundary pair, CR-02 rejection, G-01 extent/ownership, CR-03 edge pins | ✓ VERIFIED | 63 tests green; G-01 `:1218-1440`; CR-03 `:762-869`; WR-01 gap pin `:1374-1410` |
| `physicsPaintRotoGroupParity.test.ts` | Extent agreement across derivation/proposers/regenerate | ✓ VERIFIED | 50 tests green; surviving-extent rows `:548`, `:586`, `:624` |
| `physicsPaintRotoPlayScriptController.test.ts` | In-flight cancel, retry, busy cancel, override contraction | ✓ VERIFIED | 275 tests green; `:2522` refusal preserved; `:2537` stale-override pruning |
| `useRotoPhysicalEditCoordinator.test.ts` | Stale-cycle repair, one undo step, canonical pass-through, infinity untouched | ✓ VERIFIED | 96 tests green; `:4541`, `:4576`, `:4603`, `:4626`, `:4640` |
| `useRotoTimelineActions.test.ts` | Delete classifier parity, CR-03 UI dispatch pins | ✓ VERIFIED | 143 tests green; CR-03 pins `:1810-1838` |
| `physicsPaintRotoRailSetCopy.test.ts` | CR-01 non-whole-cycle paste regression | ✓ VERIFIED | 26 tests green; pin `:710-745` asserts repeat 4, stored end 57, extent 60 >= 57 |
| `buildKeyRailStandardLoopClip` (`physicsPaintRotoRunScriptStacking.ts`) | Strict whitelist, provenance-free | ✓ VERIFIED | `:597` |
| `KeyRailCycleEditTarget`, `openKeyRailCycleEdit`, `confirmKeyRailCycle` | Frozen target, zero writes on open, generation-fenced confirm | ✓ VERIFIED | `controller:1766-1896` |
| `SelectedKeyRailInspectorPresentation`, `projectSelectedKeyRailInspector` | Frames/Keys/Type, disabled reason | ✓ VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:129-143` |
| `PhysicsPaintScriptsPanel` takeover props | Edit Rail and Close | ✓ VERIFIED | `:147-160`; 61 tests green |
| `PhysicsPaintKeyRail` open-intent prop | Double-click + Enter | ✓ VERIFIED | `:277-307`, `:417`; 17 tests green |
| `PhysicsPaintWorkflowStrip` open-intent prop | Forwarding without drag changes | ✓ VERIFIED | `:447`, `:4868`; 151 tests green |
| `ReducedCycleCard` | Cycle stepper + Infinity switch only | ✓ VERIFIED | `PhysicsPaintPlayScriptCards.tsx:561` |
| `reducedForm`, `confirmBlocked`, reduced branch | Reduced surface + shared confirm gate | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:64-72`, `:150-157`, `:302`, `:377-380`, `:579` |
| `PhysicsPaintStudio.tsx` inspector memo, anchor, handlers | D-01/D-03 wiring | ✓ VERIFIED | `:1781`, `:4814-4833`, `:4882-4888`, `:7183-7185`; 336 tests green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Key Rails segment derivation | `projectSelectedKeyRailInspector` | `keyRailSegmentByFirstKeyId` → inspector memo | ✓ WIRED | `Studio:1152`, `:4882-4888` |
| `railSetAnchorKeyRailId` | inspector memo and WorkflowStrip bundle | one shared const | ✓ WIRED | `Studio:1781`, `:4888` |
| Scripts panel Edit Rail onClick | `handleOpenRotoKeyRailCycleEdit` | `onOpenKeyRailEdit` prop | ✓ WIRED | `ScriptsPanel:153`; `Studio:7183-7185`, `:4814-4824` |
| `handleOpenRotoKeyRailCycleEdit` | `rotoPlayScript.openKeyRailCycleEdit` | select-then-open, Promise on every path | ✓ WIRED | `Studio:4814-4824` |
| `PhysicsPaintKeyRail` double-click / Enter | Studio handler | `onOpenKeyRailCycleEdit` → WorkflowStrip → Studio | ✓ WIRED | `KeyRail:277-307`; strip `:447`, `:4868` |
| `dialogMode === 'key-rail-create'` | `confirmKeyRailCycle` | `confirm()` routing | ✓ WIRED | `controller:2368`, `:1823` |
| `confirmKeyRailCycle` | `buildKeyRailStandardLoopClip` → `buildLoopOnlyPublication` → `ports.commit` | one loop-only transaction | ✓ WIRED | `controller:1861-1870` |
| `cancel()` / Escape during `'preparing'` | `confirmKeyRailCycle` generation guard | `acceptedGeneration` + `assertCurrent` | ✓ WIRED | `controller:1835`, `:1842`, `:1874`, `:3652-3669`; test `:4066` |
| `prepareRotoKeyDrag` | move-key single-reference order guard | resolver intent path | ✓ WIRED | `useRotoTimelineActions.ts:2424-2433`; `resolver:4540-4556` |
| `prepareRotoKeyGroupDrag` | move-key-group final-mapping order guard | resolver intent path | ✓ WIRED | `useRotoTimelineActions.ts` group drag path; `resolver:5054-5056`; UI pins `useRotoTimelineActions.test.ts:1810-1838` |
| `buildMoveGroupCandidate` final mapping | `loopSourceOrderIsProvable` | shared helper | ✓ WIRED | `resolver:1878`, `:5054` |
| `buildMoveCandidate` final mapping | `loopSourceOrderIsProvable` | shared helper | ✓ WIRED | `resolver:4554` |
| `resolvePhysicPaintRotoLoopSourceExtent` | derivation clamp | `boundedNaturalEnd` | ✓ WIRED | `resolver:5666-5671`, effective end `:5724`, `truncated` `:5742` |
| `resolvePhysicPaintRotoLoopSourceExtent` | Group classifier and proposers | `resolveGroupBoundedEnd` | ✓ WIRED | `GroupLifecycle:320-337` used at `:102`, `:366`, `:395`, `:621`, `:747` |
| Reconcile | staged revision, staged parse, payload clips/records | coordinator choke point | ✓ WIRED | `useRotoPhysicalEditCoordinator.ts:2346-2355`, `:2360-2430` |
| `updateLoop` surviving end | rebuilt `frameOverrides` | filter `appFrame < survivingEnd` before staging | ✓ WIRED | `controller:2271-2309` |
| `isGroupOwnedKeyFrame` | delete-key / delete-key-group / delete-key-rail refusals | `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` | ✓ WIRED | `resolver:4235`, `:4284`, `:4374` |
| `classifyRotoDeleteTarget` | group-frame delete proposer | `resolveGroupOwnedDeleteFrame` | ✓ WIRED | `useRotoTimelineActions.ts:734-745`, `:775-940` |
| `resolveLoopCopyExtent` ceil repeat | `buildDuplicatedLoopClip` stored end | `originalEndExclusive` = preserved duration | ✓ WIRED | `RailSetCopy.ts:307-313`, `:440-451`; pin `RailSetCopy.test.ts:710-745` |
| `reducedForm` → `framesValidationError` → `confirmBlocked` | Enter guard and primary disabled | one render-local value | ✓ WIRED | `dialog:150-157`, `:302`, `:579` |

### Data-Flow Trace (Level 4)

These are interaction and derivation surfaces, not data-fetching surfaces; no DB or network query is involved.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Scripts panel inspector | `selectedKeyRailInspector` | `deriveKeyRailSegments` over `orderedRealKeys` | Yes | ✓ FLOWING |
| Key Rail strip | segment `keyIds` / frames | same derivation, loop-owned keys excluded | Yes | ✓ FLOWING |
| Cycle dialog repeat | `repeatText` → `parsedRepeat` | `keyRailCycleEditTarget.cycleFrameCount` | Yes | ✓ FLOWING |
| Reduced dialog readout | `loopReadout` | creation-branch signals not primed for key-rail-create | Stale for this mode | ℹ️ STALE (previously recorded cosmetic info; not in the current review disposition) |
| Loop clip presentation | lifecycle label | `derivePhysicPaintRotoLoopRanges` over live records | Yes | ✓ FLOWING (both move branches now guarded) |
| Finite lifecycle extent | `boundedNaturalEnd` | `resolvePhysicPaintRotoLoopSourceExtent` over live source-key frames | Yes | ✓ FLOWING |
| Group frame content | classifier bound | same source extent via `resolveGroupBoundedEnd` | Yes | ✓ FLOWING |
| Persisted lifecycle extent | reconciled clip + override records | `reconcilePhysicPaintRotoGroupFrames` at the staged write | Yes | ✓ FLOWING (canonical after the first accepted write) |
| Pasted Infinity span | `effectiveEndExclusive` → `repeat` → stored end | copy payload from the live rail set | Yes | ✓ FLOWING (ceil covers the frozen span) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full workspace suite | `pnpm --filter efx-motion-editor exec vitest run` | 367 files passed \| 2 skipped; 7113 passed \| 1 skipped \| 96 todo (12.0s) | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit`, exit 0 | ✓ PASS |
| CR-01 paste invariant | `vitest run physicsPaintRotoRailSetCopy.test.ts -t "rounds a non-whole-cycle infinity span UP"` | 1 passed | ✓ PASS |
| WR-01 gap-frame delete | `vitest run physicsPaintRotoLoopGuards.test.ts -t "allows deleting a real key in a lifecycle gap"` | 1 passed | ✓ PASS |
| CR-03 order-preserving + order-breaking group move | `vitest run physicsPaintRotoLoopGuards.test.ts -t "partial-cycle group move"` | 2 passed | ✓ PASS |
| G-01 coordinator repair | `vitest run useRotoPhysicalEditCoordinator.test.ts -t "stale finite cycle"` and `-t "undoes the stale-cycle repair in one command"` | 1 + 1 passed | ✓ PASS |
| G-01 updateLoop override pruning | `vitest run physicsPaintRotoPlayScriptController.test.ts -t "drops stale out-of-extent overrides on Repeat contraction"` | 1 passed | ✓ PASS |
| G-01 extent parity | `vitest run physicsPaintRotoGroupParity.test.ts -t "surviving"` | 2 passed | ✓ PASS |
| CR-03 UI dispatch pins | Full file run `useRotoTimelineActions.test.ts` | 143 passed | ✓ PASS |
| Targeted requirement-linked specs (batch 1, 8 files) | vitest on resolver guards, controller, cycle, group parity, coordinator, timeline actions | 865 passed | ✓ PASS |
| Targeted UI specs (batch 2, 6 files) | vitest on dialog, presentation, panel, key rail launcher, strip, Studio | 684 passed | ✓ PASS |

### Probe Execution

None. No `scripts/*/tests/probe-*.sh` files exist and the phase declares no executable probes; its verification is spec-bound. Not applicable.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintRotoLoopGuards.test.ts` | RAIL-03, RAIL-06, RAIL-07 | 63 | 0 | No | Value + behavioral (mapping, failure code/copy, derive `unresolved`, effectiveEnd) | PASS |
| `physicsPaintRotoGroupParity.test.ts` | RAIL-03, RAIL-07 | 50 | 0 | No | Value (extent agreement across derivation/proposers/regenerate) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | RAIL-03, RAIL-04, RAIL-05 | 275 | 0 | No | Behavioral (real history, deferred authority/commit interleavings, commit counts) | PASS |
| `useRotoPhysicalEditCoordinator.test.ts` | RAIL-03, RAIL-05, RAIL-07 | 96 | 0 | No | Behavioral (real coordinator→history, byte-identical canonical pass-through) | PASS |
| `useRotoTimelineActions.test.ts` | RAIL-01, RAIL-06 | 143 | 0 | No | Behavioral (prepare/commit dispatch counts, classifier routing) | PASS |
| `physicsPaintRotoRailSetCopy.test.ts` | RAIL-06, RAIL-07 | 26 | 0 | No | Value (copy payload, paste extent, stored end) | PASS |
| `physicsPaintRotoKeyRailCycle.test.ts` | RAIL-03, RAIL-07 | 8 | 0 | No | Value (record shape, extents, classification) | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | RAIL-02, RAIL-04 | 108 | 0 | No | Behavioral (rendered vnode gates + handler dispatch) | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | RAIL-01 | 61 | 0 | No | Behavioral + source anchors | PASS |
| `PhysicsPaintKeyRail.test.tsx.test.ts` | RAIL-01 | 17 | 0 | No | Behavioral (click timing, keyboard) | PASS |
| `PhysicsPaintStudio.test.ts` | RAIL-01 | 336 | 0 | No | Behavioral + source anchors (memo/anchor/handlers) | PASS |

**Disabled tests on requirements:** 0 → no blocker.
**Circular patterns detected:** 0 → no blocker.
**Insufficient assertions:** 0 → no warning.
**Debt markers:** 0 `TBD`/`FIXME`/`XXX` in the changed implementation files.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RAIL-01 | 58-03, 58-04, 58-05 | Open Edit Rail for a normal Key Rail from the sidebar using the same entry point loop clips use | ✓ SATISFIED | Truths 1-4, 21-24; all wiring verified |
| RAIL-02 | 58-04, 58-08 | Modal shows only cycle count and Infinity, prefilled at 1, no script/motion/reveal controls | ✓ SATISFIED | Truths 4, 6, 37, 38 |
| RAIL-03 | 58-02, 58-03, 58-09 | Confirm converts the segment into a provenance-free Standard clip and the rail presents as Standard; the converted cycle follows the surviving source extent | ✓ SATISFIED | Truths 7, 9-12, 39-45 |
| RAIL-04 | 58-02, 58-06, 58-08 | Cancelling performs zero writes (no store mutation, revision bump, or undo entry) | ✓ SATISFIED | Truths 5, 15, 26-30, 38 |
| RAIL-05 | 58-02, 58-06 | Conversion is exactly one undo step; cancel and refusal leave the ledger untouched | ✓ SATISFIED | Truths 13, 14, 27-31, 43 |
| RAIL-06 | 58-01, 58-07, 58-10 | Single-key drag under Law A; keys referenced by more than one loop keep D-11; shared linked-cycle behavior never silently relaxed, including the group move | ✓ SATISFIED | Truths 8, 16-20, 32-36, 46-52 |
| RAIL-07 | 58-01, 58-02, 58-07, 58-09, 58-10 | Regression-locked behavior, existing D-11 tests green, no `.mce` schema change | ✓ SATISFIED | Truth 25, truths 32-52; full suite green |

No orphaned requirements: all seven IDs appear in plan frontmatter, and REQUIREMENTS.md maps exactly these seven to Phase 58 (all marked `[x]`, Phase 58 Complete).

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. (17/17 honored; gate returned `{skipped: false, blocking: false, total: 17, honored: 17, not_honored: []}`.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `physicsPaintRotoGroupLifecycle.ts` | 320-337 | `capacity === undefined` fallback unreachable from typed callers — open IN-01 | ℹ️ Info | Dead defensive branch; every caller holds a required `number` capacity |
| `physicsPaintStudio.css` | 2840 | Dead `.physics-paint-play-script-standard-rail-value` rule — open IN-02 | ℹ️ Info | Dead CSS only |
| `physicsPaintRotoPlayScriptController.ts` | 1781-1783 | Open-time `loopClipsOwnAnyKey` unreachable from production — open IN-03 | ℹ️ Info | Redundant guard; the confirm-time check at `:1846` remains reachable |
| `physicsPaintRotoPlayScriptController.ts` | 1870-1872 | Post-commit comment still implies a cancel can land during `'committing'` — open IN-04 | ℹ️ Info | Comment-only; `cancel()` now no-ops while busy (`:3659-3660`) |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or PLACEHOLDER debt markers exist in any changed implementation or test file. The four info findings above are recorded as `open` in `58-REVIEW-DISPOSITION.md`; none affects a must-have truth. CR-01 and WR-01 were fixed in `e50af31c0` and are verified above; CR-02, CR-03, and WR-02 were closed by 58-07, 58-10, and 58-08 respectively.

### Documented Deviations

**Reveal rails are exempt from the G-01 source-extent clamp (58-09 deviation 4, b25482a9c).** `resolvePhysicPaintRotoLoopSourceExtent` returns null for a `railKind: 'reveal'` clip, and `loopGuards.test.ts:1293-1305` pins the reveal stretch (requested 15, cycle 13) surviving. This is deliberate: the reveal stretch law owns the reveal extent, the phase goal explicitly includes single-key drag on Reveal rails, and clamping would break the WR-01 reveal behavior. The exemption does not weaken the finite Standard-cycle guarantee the G-01 report described.

### Human Verification Required

1. **Key Rail inspector takeover**
   **Test:** Select, double-click, and Enter a normal Key Rail; then Close.
   **Expected:** The inspector shows exactly Frames, Keys, Type Standard, Edit Rail, Close; each entry opens the reduced modal; Close restores Scripts.
   **Why human:** Live Preact render, focus, and pointer timing in the WKWebView.

2. **Reduced Cycle modal**
   **Test:** Open Edit Rail, set a repeat, confirm.
   **Expected:** Only the Cycle stepper (prefilled 1) and Infinity switch; Create Cycle commits a gray Standard cycle.
   **Why human:** Visual surface and modal round-trip.

3. **Rail-set anchor**
   **Test:** Modifier-select two or more rails whose first member is a Key Rail.
   **Expected:** Edit Rail is visibly disabled with "Select a single rail to edit it." and no bulk conversion is offered.
   **Why human:** Live selection behavior and disabled tooltip.

4. **Cancel during the in-flight window and during committing**
   **Test:** Cancel while authority is in flight; cancel during committing; after a failed commit, retry.
   **Expected:** Zero writes, no undo entry, modal usable, retry commits exactly once.
   **Why human:** Real in-flight timing and live dialog usability.

5. **Single-key drag under Law A**
   **Test:** With one referencing loop, drag a single key to an order-preserving frame, then an order-breaking frame.
   **Expected:** Safe move accepted and re-derives; order-breaking move rejected with the locked copy, never "Source missing".
   **Why human:** Pointer gesture and rail rendering.

6. **Enter in the Cycle field**
   **Test:** Press Enter inside the Cycle field; then Escape.
   **Expected:** Enter confirms exactly once; Escape cancels with zero writes.
   **Why human:** Keyboard routing on the live surface.

7. **G-01 live repro**
   **Test:** Convert a Motion rail to Standard, delete end keys and change the Cycle count, then close and reopen the Studio.
   **Expected:** The cycle stops at the surviving source extent; retired frames render empty with no cached paint; repaired extent survives reopen; a genuinely dangling source still shows "Source missing".
   **Why human:** Requires the live Studio, per-key pixel cache, and close/reopen round-trip (58-UAT.md Gaps G-01).

8. **CR-01 live paste**
   **Test:** Copy an Infinity rail whose span is not a whole cycle multiple (keys 10 and 14, cycle 5, next key 27), paste elsewhere, commit, reopen.
   **Expected:** The full copied visible duration (17 frames) renders and survives byte-identically; no tail trim.
   **Why human:** Live copy/paste and pixel rendering.

9. **WR-01 live gap-frame delete**
   **Test:** Reach a lifecycle gap and press Delete on the real key on the gap frame; separately press Delete on a visible Group frame.
   **Expected:** The gap key deletes normally; the visible Group-frame key stays refused with the locked copy.
   **Why human:** Requires the live rail-set paste/delete sequence and delete routing.

10. **CR-03 live partial-cycle group drag**
    **Test:** Select A,B of A..E and drag to an order-preserving destination, then an order-breaking one.
    **Expected:** The first commits exactly once and stays resolvable; the second is rejected with the locked copy, never commits, never "Source missing".
    **Why human:** Pointer gesture and rail rendering in the packaged app (58-UAT.md row 7).

### Gaps Summary

No must-have gaps remain. All 52 truths are verified, every required artifact is present, substantive, and wired, every key link is connected, and the five ROADMAP success criteria are satisfied.

- **G-01 closed (58-09):** one shared source-extent helper bounds derivation, Group classification, proposers, and regenerate; the coordinator reconcile prunes stale ranges and override records at the write choke point; `updateLoop` prunes overrides past the surviving end before staging; the add-only ownership-parity refusal is pinned. Named tests prove the stale clip derives `unresolved: null`, retired frames resolve empty, the repair is one undo step, and a dangling source keeps today's `missingSourceKeyIds` behavior.
- **CR-03 closed (58-10):** `move-key-group` now reads the final candidate mapping through the same `loopSourceOrderIsProvable` helper as `move-key`; the guard is intersection-scoped, fails closed on a touched dangling clip, exempts no-change drags, and reuses the existing failure code and verbatim copy. The order-preserving partial move remains legal and derives cleanly.
- **CR-01 closed (e50af31c0):** `Math.ceil` makes the frozen cycle count cover the pasted span, so G-01's bound is inert on a pasted non-whole-cycle Infinity rail. The regression pin asserts the full 17-frame span.
- **WR-01 closed (e50af31c0):** the resolver's ownership predicate now requires `visibleRanges` containment, matching the UI classifier; a gap-frame key deletes normally while a visible Group frame still refuses.

The status is `human_needed`, not `passed`, because ten live-only checks remain (inspector takeover, reduced modal, rail-set anchor, in-flight/committing cancel, Law A gesture, Enter routing, G-01 repro, CR-01 paste, WR-01 gap delete, CR-03 group drag). Four info-level review findings remain open by disposition; none is a must-have failure, and one narrow source-derived advisory (paste from an already-stale finite rail rejects fail-closed) is recorded without deterministic evidence.

---

_Verified: 2026-11-03T16:59:06Z_
_Verifier: Claude (gsd-verifier)_
