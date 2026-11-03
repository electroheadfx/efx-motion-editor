---
phase: 58-rail-editing-regressions
verified: 2026-11-03T14:22:10Z
status: human_needed
score: 38/38 must-haves verified
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
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
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
covered_digest: "v4:sha256:b243ed3cc460b5017f2e4e69d12f7e229950b4f69d4d10bb16be06fe0b509c10"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 22/25
  gaps_closed:
    - "Cancel performs zero writes: no store mutation, no revision bump, no undo entry"
    - "Cancel and every refusal perform zero commits and zero history entries"
    - "Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent 'Source missing' clip with no in-UI repair"
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
  - test: "Decision required — CR-03: with a partial source-cycle selection (e.g. A and B of a cycle A..E), drag the group past later source keys so the cycle's stored source order becomes non-increasing"
    expected: "Today the move is accepted, the cycle derives as unresolved ('Source missing') and export is blocked. The deep review classifies this CR-03 (open, critical). Decide whether to fix it before phase acceptance or explicitly defer it; it is pre-existing and outside the D-15 list of guards this phase changed"
    why_human: "Product/scope decision plus a live gesture check; no must-have truth of Phase 58 covers the pre-existing move-key-group path"
---

# Phase 58: Rail editing regressions Verification Report

**Phase Goal:** A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Verified:** 2026-11-03T14:22:10Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (58-06 CR-01/WR-01, 58-07 CR-02, 58-08 WR-02)

## Goal Achievement

The phase goal is achieved in the codebase. The Key Rail → Standard cycle pipeline is complete end to end: selection surfaces, the reduced Cycle/Infinity modal, the provenance-free Standard record, a single loop-only commit, one-command undo/redo, and a cancel path that now participates in the controller's generation contract. The Law A single-key drag is accepted only when the final mapping preserves the single referencing cycle's source order, and the two-or-more D-11 rejection is unchanged and verbatim.

The three prior must-have gaps are closed in code and by tests: CR-01 (in-flight cancel committed anyway), CR-02 (single-reference move could silently invalidate its cycle), and WR-01 / WR-02 (dialog cancellation and Enter/click gate parity). The only open critical code-review finding, CR-03, is a pre-existing partial-cycle *group* move hole in a sibling intent that Phase 58 explicitly left untouched (D-15). It deserves a human scope decision and is recorded below, but it does not falsify any Phase 58 must-have.

The status is `human_needed` because the phase includes live-only UAT rows (selection/modal/gesture/timing) recorded by the plans and `58-VALIDATION.md`, plus the CR-03 scope decision.

### Observable Truths

| # | Truth | Requirement | Status | Evidence |
|---|-------|-------------|--------|----------|
| 1 | Selecting a normal Key Rail exposes the sidebar Edit Rail action: the Scripts panel is replaced by an inspector with Edit Rail and Close | RAIL-01, SC1 | ✓ VERIFIED | `PhysicsPaintScriptsPanel.tsx:151-160` takeover branch precedes the loop branch; `PhysicsPaintStudio.tsx:7183-7185` passes `selectedKeyRail` and both handlers; ScriptsPanel spec 61/61, Studio spec 336/336 |
| 2 | Double-clicking a Key Rail invokes the open intent: plain second click within 220 ms, never a move member, never while busy | RAIL-01, D-02 | ✓ VERIFIED | `PhysicsPaintKeyRail.tsx:31`, `:277-283`, `:305`; `PhysicsPaintWorkflowStrip.tsx:447`, `:4868`; KeyRail spec 17/17 |
| 3 | Enter on a focused Key Rail selects it then invokes the same open intent; Space still plain-selects; Escape still hides the tooltip | RAIL-01, D-02 | ✓ VERIFIED | `PhysicsPaintKeyRail.tsx:300-307`; KeyRail spec 17/17 |
| 4 | The conversion modal shows only the Cycle stepper and Infinity switch, prefilled at 1 and unchecked, with no tabs, rail type, frames-per-cycle, Motion, source cycle, seed, or Regenerate | RAIL-02, SC1, D-05 | ✓ VERIFIED | `ReducedCycleCard` `PhysicsPaintPlayScriptCards.tsx:561`; `PhysicsPaintPlayScriptDialog.tsx:64-72`, `:377-380`; dialog spec 108/108 |
| 5 | Cancel performs zero writes: no store mutation, no revision bump, no undo entry | RAIL-04, SC3 | ✓ VERIFIED (was FAILED) | CR-01 closed: `acceptedGeneration = ++generation` before `'preparing'` (`controller:1834`), `assertCurrent` after authority (`:1841`) and after commit (`:1873`), AbortError → `'cancelled'` without `fail()` (`:1882-1892`); test `controller.test.ts:4066-4115` asserts `commit` never called, phase `'cancelled'`, error null, zero history |
| 6 | The primary action labels Create Cycle for a first conversion and Update Rail for an existing Standard clip, and both route through `playScript.confirm()` | RAIL-02, D-05 | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:582-587`; dialog spec 108/108 |
| 7 | Confirming creates one provenance-free Standard clip: `sourceKeyIds` in segment order, `placementStart` = first key frame, repeat from the reduced form, no `scriptId` / `railKind` / `motion` | RAIL-03, SC2 | ✓ VERIFIED | `buildKeyRailStandardLoopClip` `physicsPaintRotoRunScriptStacking.ts:597`; `controller.test.ts:3980-4025` asserts the exact record and absent provenance members |
| 8 | Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent "Source missing" clip with no in-UI repair | Goal clause: without silently relaxing linked-cycle ownership | ✓ VERIFIED (was FAILED) | CR-02 closed: `physicsPaintRotoPhysicalResolver.ts:4482-4491` projects the single clip's `sourceKeyIds` through the FINAL candidate mapping and rejects non-increasing/missing positions; the Law A test `loopGuards.test.ts:283-309` moves A 10 → 9 and asserts the derived L1 range `unresolved` is null |
| 9 | The clip classifies as Standard and presents via the existing `.rail-kind-standard` pill; the existing Edit Rail dialog owns Repeat/Infinity afterwards | RAIL-03, SC2 | ✓ VERIFIED | `classifyLoopClipRailKind(clip) === 'standard'` pinned `KeyRailCycle.test.ts:104`; CSS `physicsPaintStudio.css:4935-4936`; merged-Standard loop-edit renders the reduced form with Update Rail |
| 10 | A gapped segment keeps its span: cycle length = last - first + 1, extent clamped to capacity, infinity lifecycle-less | RAIL-03, D-09 | ✓ VERIFIED | `controller:1850` passes `cycleFrameCount` into `buildNewLoopLifecycle`; `KeyRailCycle.test.ts` (8 tests) covers the 6-frame cycle, repeat-2 extent 22, repeat-1 extent 16, infinity |
| 11 | A single-key segment converts to a 1-frame cycle | RAIL-03, D-08 | ✓ VERIFIED | `KeyRailCycle.test.ts` single-key case |
| 12 | A second conversion over already loop-owned keys is refused before any commit | RAIL-03 | ✓ VERIFIED | open-time `controller:1780-1782`, confirm-time `:1845-1846`; tests `controller.test.ts` owned via `sourceKeyIds` and via `frameOverrides` |
| 13 | Undo restores the pre-conversion Key Rail and Redo re-applies the conversion as one command | RAIL-05, SC3 | ✓ VERIFIED | `controller.test.ts:4026-4046` drives the real history hook: availability 1/0, undo restores an empty loop collection, redo restores the clip with `originalEndExclusive` 16 |
| 14 | The conversion is exactly one `ports.commit` with `semanticDelta.kind 'play-script'`, `loopOnly: true`, `affectedEndAppFrame = anchor - 1`, `freshKeyIds: []` | RAIL-05 | ✓ VERIFIED | `buildLoopOnlyPublication` `controller:2118-2154`; `confirmKeyRailCycle:1860-1869`; test `controller.test.ts:3980-4025` asserts one commit and the exact delta |
| 15 | Cancel and every refusal perform zero commits and zero history entries | RAIL-04, RAIL-05 | ✓ VERIFIED (was FAILED) | CR-01 closed by the generation fence; cancel-after-open still pinned `controller.test.ts:4049`; refusals return before commit (`controller:1843-1846`); in-flight cancel test asserts zero history |
| 16 | A single-key drag on a key referenced by exactly one loop is accepted and lands on the requested frame (Law A) | RAIL-06, SC4, D-12 | ✓ VERIFIED | `resolver:4469-4472` comparator `> 1`; `loopGuards.test.ts:283-309` (A 10 → 9) |
| 17 | A key referenced by two or more loops is rejected, never moves silently, with `loop-source-key-move-rejected`, `move-key`, and the verbatim D-16 copy | RAIL-06, SC4, D-11 | ✓ VERIFIED | `resolver:4469-4472`; locked copy `:863-864`; `loopGuards.test.ts:366` |
| 18 | An accepted single-key move never emits `nextLoopClips`, so `placementStart` stays put | RAIL-06, D-13 | ✓ VERIFIED | `loopGuards.test.ts:295` (`proposal.nextLoopClips` null) |
| 19 | Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy | RAIL-06, D-14, D-15 | ✓ VERIFIED | `resolver:4497-4523` still `> 0`; `loopGuards.test.ts:684-707` no-leak pins; Force Spacing describes untouched and green |
| 20 | The acceptance is entirely inside the resolver: `prepareRotoKeyDrag` / `commitRotoKeyDrag` and the WorkflowStrip drag dispatch are untouched | RAIL-06 | ✓ VERIFIED | Gap-closure diff touches only resolver, controller, dialog and their specs; `useRotoTimelineActions.ts:2424-2433` and strip drag dispatch unchanged |
| 21 | Edit Rail and double-click/Enter reach one Studio handler that selects the rail first, then delegates to `openKeyRailCycleEdit`, returning a Promise on every path | RAIL-01, D-01 | ✓ VERIFIED | `PhysicsPaintStudio.tsx:4814-4824`; Studio spec `selects before opening and returns a Promise on the missing-segment refusal` |
| 22 | A 2+ rail set whose anchor is a Key Rail projects with setSize >= 2, Edit Rail visible and disabled with "Select a single rail to edit it.", and no bulk conversion | RAIL-01, D-03 | ✓ VERIFIED | `Studio:4882-4888`, shared anchor `:1781`; `physicsPaintKeyRailPresentation.ts:111`, `:129-143`; Studio and ScriptsPanel specs |
| 23 | Close clears both `selectedRotoKeyRail` and `railSetSelection`, so the takeover dismisses in the plain and rail-set states | RAIL-01, D-01, D-03 | ✓ VERIFIED | `Studio:4830-4833`; Studio spec `clears BOTH selection layers on Close` |
| 24 | The inspector shows exactly Frames F{first}-F{last}, Keys n, Type Standard, and keeps one object identity across unrelated renders | RAIL-01, D-04 | ✓ VERIFIED | `physicsPaintKeyRailPresentation.ts:129-143`; memo deps `Studio:4882-4888`; `reconcileRotoKeyRailSelection:453-463` returns the same object while valid |
| 25 | No `.mce` schema field is added or changed; resolver, undo, and existing D-11 guard tests are green or deliberately updated | RAIL-07, SC5 | ✓ VERIFIED | Phase diff contains no `.mce`, schema, parser, `src-tauri`, or `app/src/types` path; 329 + 684 tests green; `tsc --noEmit` exit 0 |
| 26 | Cancelling while the conversion is still awaiting authority never calls `ports.commit`, lands in `'cancelled'`, leaves error null, and produces no accepted output | RAIL-04, RAIL-05 (58-06) | ✓ VERIFIED | `controller:1841` assertCurrent before ack; test `controller.test.ts:4066-4115` |
| 27 | A cancelled conversion keeps `keyRailCycleEditTarget` and the open dialog, so a later confirm retries and commits exactly once | RAIL-04 (58-06) | ✓ VERIFIED | `controller:1882-1892` (target untouched); test asserts target non-null, `confirmationOpen` true, retry returns true and commit called once |
| 28 | Cancelling while the phase is `'committing'` neither clears the target nor closes the dialog; after that commit fails, Create Cycle retries and commits | RAIL-05 (58-06, WR-01) | ✓ VERIFIED | `cancel()` busy early return `controller:3639-3643`; test `controller.test.ts:4117-4164` asserts dialog/target/phase unchanged, failed commit, retry commits twice total |
| 29 | A cancel before confirm still closes the dialog with zero writes | RAIL-04 (58-06) | ✓ VERIFIED | Existing test `controller.test.ts:4049` unchanged and passing in the 274-test controller suite |
| 30 | An AbortError is never routed through `fail()`: no `'Play Script failed'` phase, no error text, no error-level log | RAIL-04 (58-06) | ✓ VERIFIED | `controller:1882-1892`; test asserts status `'Key Rail cycle cancelled'`, error null, and no `log(..., true)` call |
| 31 | The successful conversion path still commits exactly once, clears the target, and closes the dialog | RAIL-05 (58-06) | ✓ VERIFIED | `controller.test.ts:3980-4025`: one commit, phase `'complete'`, target null, `confirmationOpen` false |
| 32 | With exactly one referencing loop, a move-key whose final mapping breaks strict increase is rejected with `loop-source-key-move-rejected`, `operationKind move-key`, and the verbatim D-16 copy | RAIL-06 (58-07, CR-02) | ✓ VERIFIED | `resolver:4482-4491`; `loopGuards.test.ts:311-317` pins C 12 → 22 |
| 33 | The order check reads the FINAL candidate mapping (ripple-proof) and fails closed when a referenced source key is absent from the mapping | RAIL-06 (58-07) | ✓ VERIFIED | `resolver:4478-4490` reads `moveResult.candidate.mapping`; `loopGuards.test.ts:337-344` dangling-source rejection |
| 34 | A one-element source cycle is always order-preserving and its only key can move | RAIL-06 (58-07) | ✓ VERIFIED | `loopGuards.test.ts:319` one-element acceptance with a resolved derivation |
| 35 | A key referenced by no loop, and a no-change drag back to its own cell, are accepted | RAIL-06 (58-07) | ✓ VERIFIED | `loopGuards.test.ts:346` (unreferenced) and `:356` (no-change dangling exemption) |
| 36 | `sourceKeyIds` is never re-sorted or mutated; an order-breaking destination is rejected rather than re-sequenced | RAIL-06 (58-07) | ✓ VERIFIED | Resolver guard only reads; `loopGuards.test.ts:305-308` asserts the input loop collection is unchanged |
| 37 | In key-rail-create, Enter calls `confirm()` exactly once despite the stale `'Maximum available count is 0.'` frames error, and the primary button is enabled | RAIL-02 (58-08, WR-02) | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:150-157`, `:302`, `:579`; test `PhysicsPaintPlayScriptDialog.test.ts:984-995` |
| 38 | The Enter guard and primary disabled share one `confirmBlocked`; repeatError blocks both; the merged Standard reduced form also confirms; full apply, Reveal, and stack-collision surfaces keep their prior gating; Escape/canCancel precedence unchanged | RAIL-02, RAIL-04 (58-08, WR-02) | ✓ VERIFIED | Dialog tests `:997-1007` (repeatError), `:1009` (merged Standard), `:1032` (Escape/canCancel), `:1050-1078` (apply/Reveal), `:1079-1092` (stack collision truncate) |

**Score:** 38/38 truths verified (0 present, behavior-unverified)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-frame cells, cycle grays, and the rail colour dot on Standard rails | v7 timeline rails (in-milestone quick) | ROADMAP Phase 58 SC2: "Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58." |
| 2 | Motion channels | v2.1.0 | ROADMAP v7 timeline rails: "Motion channels stay in v2.1.0." |

### Advisory (New Scope, Unevidenced)

New-scope findings from the UI review with no deterministic evidence — reported, not blocking, and they do not revert a completed must-have. CR-03 is deliberately NOT listed here: it carries deterministic evidence (source trace plus an existing test pin) but is not a Phase 58 must-have; it is recorded under Human Verification for a scope decision.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Reduced Cycle dialog composition leaves ~376px vertical / ~478px horizontal dead space | other | 58-UI-REVIEW.md priority 1; CSS-derived geometry, no screenshots |
| 2 | Refusal reasons are dropped; `rejectLoopOp` nulls `error`, so refused actions leave "Ready" | other | 58-UI-REVIEW.md priority 2; source-derived UX gap, not a write-path defect |
| 3 | Footer Cancel/primary stay enabled-looking during `'committing'` while both are no-ops | other | 58-UI-REVIEW.md priority 3; UX polish of the deliberate WR-01 no-op window |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | Law A guard, CR-02 final-mapping order guard, D-11/D-13/D-14/D-15 unchanged | ✓ VERIFIED | `:4463-4494`; only the move-key branch gained `referencingClips` and the order proof |
| `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` | Law A boundary pair, CR-02 rejection, edge pins, no-leak pins | ✓ VERIFIED | 47 tests green; C 12 → 22 rejection, A 10 → 9 acceptance, single-source/dangling/unreferenced/no-change pins |
| `app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts` | Standard record, span, single-key, infinity | ✓ VERIFIED | 8 tests green |
| `buildKeyRailStandardLoopClip` (`physicsPaintRotoRunScriptStacking.ts`) | Strict whitelist, provenance-free | ✓ VERIFIED | `:597` |
| `KeyRailCycleEditTarget`, signal, `openKeyRailCycleEdit`, `confirmKeyRailCycle` (`physicsPaintRotoPlayScriptController.ts`) | Frozen target, zero writes on open, generation-fenced confirm | ✓ VERIFIED | `:1766-1896`; `acceptedGeneration` `:1834`, `assertCurrent` `:1841`, `:1873`, AbortError branch `:1882-1892` |
| `cancel()` busy-phase guard (`physicsPaintRotoPlayScriptController.ts`) | No target clear while busy (WR-01) | ✓ VERIFIED | `:3639-3643` |
| New controller specs | In-flight cancel, retry, busy-phase cancel, failed-commit retry | ✓ VERIFIED | `controller.test.ts:4066`, `:4117`; suite 274/274 |
| `SelectedKeyRailInspectorPresentation`, `projectSelectedKeyRailInspector` | Frames/Keys/Type, disabled reason | ✓ VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:129-143` |
| `PhysicsPaintScriptsPanel` props `selectedKeyRail` / `onOpenKeyRailEdit` / `onCloseKeyRail` | Takeover branch with Edit Rail and Close | ✓ VERIFIED | `:147-160`; 61 tests green |
| `PhysicsPaintKeyRail` prop `onOpenKeyRailCycleEdit` | Double-click + Enter intent | ✓ VERIFIED | `:277-307`, `:417`; 17 tests green |
| `PhysicsPaintWorkflowStrip` prop `onOpenKeyRailCycleEdit` | Forwarding without drag changes | ✓ VERIFIED | `:447`, `:4868`; 151 tests green |
| `ReducedCycleCard` | Cycle stepper + Infinity switch only | ✓ VERIFIED | `PhysicsPaintPlayScriptCards.tsx:561` |
| `reducedForm`, `framesValidationError`, `confirmBlocked` and reduced branch | Mode-gated reduced surface + shared confirm gate (WR-02) | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:64-72`, `:150-157`, `:302`, `:377-380`, `:579` |
| `PhysicsPaintStudio.tsx` inspector memo, shared anchor, handlers, prop bundles | D-01/D-03 wiring | ✓ VERIFIED | `:1781`, `:4814-4833`, `:4882-4888`, `:7093`, `:7183-7185`, `:11011`; 336 tests green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Key Rails segment derivation | `projectSelectedKeyRailInspector` | `keyRailSegmentByFirstKeyId` → `selectedKeyRailInspector` memo | ✓ WIRED | `Studio:1152`, `:4882-4888` |
| `railSetAnchorKeyRailId` | inspector memo and WorkflowStrip bundle | one shared const | ✓ WIRED | `Studio:1781`, `:4888`, `:11011` |
| Scripts panel Edit Rail onClick | `handleOpenRotoKeyRailCycleEdit` | `onOpenKeyRailEdit` prop | ✓ WIRED | `ScriptsPanel:153`; `Studio:7183-7185`, `:4814-4824` |
| `handleOpenRotoKeyRailCycleEdit` | `rotoPlayScript.openKeyRailCycleEdit` | select-then-open, Promise on every path | ✓ WIRED | `Studio:4814-4824` |
| `PhysicsPaintKeyRail` double-click / Enter | Studio handler | `onOpenKeyRailCycleEdit` → WorkflowStrip → Studio | ✓ WIRED | `KeyRail:277-307`; strip `:447`, `:4868` |
| `dialogMode === 'key-rail-create'` | `confirmKeyRailCycle` | `confirm()` routing | ✓ WIRED | `controller:2368`, `:1822` |
| `confirmKeyRailCycle` | `buildKeyRailStandardLoopClip` → `buildLoopOnlyPublication` → `ports.commit` | one loop-only transaction | ✓ WIRED | `controller:1852-1869` |
| `cancel()` / Escape during `'preparing'` | `confirmKeyRailCycle` generation guard | `acceptedGeneration` + `assertCurrent` | ✓ WIRED (was NOT_WIRED) | `controller:1834`, `:1841`, `:1873`, `:3651`; test `:4066` |
| `cancel()` during `'committing'` | busy-phase early return before target clear | `isBusyPhase(phase.peek())` | ✓ WIRED | `controller:3639-3643`; test `:4117` |
| `prepareRotoKeyDrag` | move-key branch single-reference order guard | resolver intent path | ✓ WIRED | `useRotoTimelineActions.ts:2424-2433`; `resolver:4469-4491` |
| `buildMoveCandidate` final mapping | strict-increase proof | `moveResult.candidate.mapping` | ✓ WIRED | `resolver:4476-4491`; derivation law `:5548-5552` |
| `reducedForm` → `framesValidationError` → `confirmBlocked` | Enter guard and primary disabled | one render-local value | ✓ WIRED | `dialog:150-157`, `:302`, `:579` |

### Data-Flow Trace (Level 4)

These are interaction and derivation surfaces, not data-fetching surfaces; no DB or network query is involved.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Scripts panel inspector | `selectedKeyRailInspector` | `deriveKeyRailSegments` over `orderedRealKeys` (physical key records) | Yes | ✓ FLOWING |
| Key Rail strip | segment `keyIds` / frames | same derivation, loop-owned keys excluded | Yes | ✓ FLOWING |
| Cycle dialog repeat | `repeatText` → `parsedRepeat` | `keyRailCycleEditTarget.cycleFrameCount` for key-rail-create | Yes | ✓ FLOWING |
| Reduced dialog readout | `loopReadout` | creation-branch signals not primed for key-rail-create | Stale for this mode | ℹ️ STALE (IN-01, info only) |
| Loop clip presentation | lifecycle label | `derivePhysicPaintRotoLoopRanges` over live records | Yes | ✓ FLOWING (single-key path now guarded; group-move path exposes CR-03) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Resolver Law A, CR-02, D-11, and loop guards | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | 329 passed (47 + 8 + 274) | ✓ PASS |
| Dialog, inspector, panel, rail, strip, Studio | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | 684 passed (108 + 11 + 61 + 17 + 151 + 336) | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| Gap-closure commits are ancestors of HEAD | `git merge-base --is-ancestor` over the ten 58-06/07/08 commits | 10/10 ok | ✓ PASS |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintRotoLoopGuards.test.ts` | RAIL-06, RAIL-07 | 47 | 0 | No | Value + behavioral (mapping, failure code/copy, derive `unresolved`) | PASS |
| `physicsPaintRotoKeyRailCycle.test.ts` | RAIL-03, RAIL-07 | 8 | 0 | No | Value (record shape, extents, classification) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | RAIL-03, RAIL-04, RAIL-05 | 274 | 0 | No | Behavioral (real history hook, deferred authority/commit interleavings, commit counts) | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | RAIL-02, RAIL-04 | 108 | 0 | No | Behavioral (rendered vnode gates + handler dispatch) | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | RAIL-01 | 61 | 0 | No | Behavioral + source anchors | PASS |
| `PhysicsPaintKeyRail.test.tsx.test.ts` | RAIL-01 | 17 | 0 | No | Behavioral (click timing, keyboard) | PASS |
| `PhysicsPaintStudio.test.ts` | RAIL-01 | 336 | 0 | No | Behavioral + source anchors (memo/anchor/handlers) | PASS |

**Disabled tests on requirements:** 0 → no blocker.
**Circular patterns detected:** 0 → no blocker.
**Insufficient assertions:** 0 → no warning.

### Probe Execution

None. No `scripts/*/tests/probe-*.sh` files exist and the phase declares no executable probes; its verification is spec-bound. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RAIL-01 | 58-03, 58-04, 58-05 | Open Edit Rail for a normal Key Rail from the sidebar using the same entry point loop clips use | ✓ SATISFIED | Truths 1-4, 21-24; all wiring verified |
| RAIL-02 | 58-04, 58-08 | Modal shows only cycle count and Infinity, prefilled at 1, no script/motion/reveal controls | ✓ SATISFIED | Truths 4, 6, 37, 38; reduced card and dialog spec |
| RAIL-03 | 58-02, 58-03 | Confirm converts the segment into a provenance-free Standard clip and the rail presents as Standard | ✓ SATISFIED | Truths 7, 9-12 |
| RAIL-04 | 58-02, 58-06, 58-08 | Cancelling performs zero writes (no store mutation, revision bump, or undo entry) | ✓ SATISFIED | Truths 5, 15, 26-30, 38; CR-01 closed |
| RAIL-05 | 58-02, 58-06 | Conversion is exactly one undo step; cancel and refusal leave the ledger untouched | ✓ SATISFIED | Truths 13, 14, 27-31; CR-01 closed |
| RAIL-06 | 58-01, 58-07 | Single-key drag under Law A; keys referenced by more than one loop keep D-11; shared linked-cycle behavior never silently relaxed | ✓ SATISFIED | Truths 8, 16-20, 32-36; CR-02 closed for `move-key` |
| RAIL-07 | 58-01, 58-02, 58-07 | Regression-locked behavior, existing D-11 tests green, no `.mce` schema change | ✓ SATISFIED | Truth 25, truths 32-36; the uncovered sibling is recorded as CR-03 below |

No orphaned requirements: all seven IDs appear in plan frontmatter, and REQUIREMENTS.md maps exactly these seven to Phase 58.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. (17/17 honored; gate returned `{skipped: false, blocking: false, total: 17, honored: 17, not_honored: []}`.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | 4945-4977 | `move-key-group` lacks the source-order proof added to `move-key` | ⚠️ Warning — open CR-03 | A partial-cycle group move can persist a non-increasing source order, presenting "Source missing" and blocking export. Pre-existing; `move-key-group` is outside the D-15 guards this phase changed, so it is not a Phase 58 must-have failure. Human scope decision requested |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | 1870-1873 | Post-commit comment says a cancel can reach the commit, but WR-01 made that impossible via `cancel()` | ℹ️ Info — IN-04 | Comment-only; could mislead a future maintainer into removing the WR-01 guard |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | 885-931 | `loopReadout` has no `key-rail-create` branch and shows stale creation state | ℹ️ Info — IN-01 | Cosmetic readout; the reduced surface's confirm path reads the frozen target |
| `app/src/components/physic-paint/physicsPaintStudio.css` | 2840 | Dead `.physics-paint-play-script-standard-rail-value` rule after the read-only Standard value was removed | ℹ️ Info — IN-02 | Dead code only |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | 1780-1782 | Open-time `loopClipsOwnAnyKey` is unreachable from production (segments exclude loop-owned keys) | ℹ️ Info — IN-03 | Redundant guard; the confirm-time check remains reachable |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or PLACEHOLDER debt markers exist in any changed implementation or test file. The only "placeholder" matches are the pre-existing `loop-placeholder` domain concept and `AQUARELLE_PLACEHOLDER_MAX_BYTES`.

### Known Open Findings (not must-haves)

**CR-03 — partial-cycle group move bypasses the source-order invariant (open, critical, pre-existing).**
The 58-07 order proof is attached only to `move-key`. The sibling `move-key-group` branch builds a candidate and finalizes it without consulting the loop clips (`resolver:4945-4977`); `buildMoveGroupCandidate` rejects duplicate destinations and capacity only (`:1836-1958`), and the loop follow runs only when the moved set contains the ENTIRE cycle (`:1950-1955`). A partial selection therefore leaves `nextLoopClips === null` and the clip pointing at its original source list.

Deterministic evidence:
- The phase's own D-04 test pins the destructive case: source keys A..E at 10..14, cycle `[A,B,C,D,E]`, partial group move `{A,B}` to physical-cell 20 → mapping `A:20, B:21, C:12, D:13, E:14`, `nextLoopClips` null (`physicsPaintRotoLoopGuards.test.ts:761-771`).
- The derivation requires strictly increasing source positions (`resolver:5548-5552`) and marks the clip `unresolved.invalidSourceTiming` (`:5650-5653`), which presents as "Source missing" (`physicsPaintLoopClipPresentation.ts:341`, `:352`) and blocks export (`lib/exportEngine.ts:117`).
- Reachability is direct: `PhysicsPaintWorkflowStrip.tsx:4375` dispatches `prepareRotoKeyGroupDrag` whenever two or more real keys are selected, and `useRotoTimelineActions.ts:2521` sends the `move-key-group` intent.

Why it is not a Phase 58 must-have failure: the phase goal and ROADMAP SC4 concern the *single-key* drag law; D-15 explicitly keeps every other guard — including group-move behavior — at its current behavior. `move-key-group` was not relaxed by this phase. It is therefore recorded for a human scope decision rather than silently resolved, and it does not trigger `gaps_found` for the must-have contract.

### Human Verification Required

1. **Key Rail inspector takeover**
   **Test:** In the Studio, select a normal Key Rail; then double-click one; then focus one and press Enter; then Close.
   **Expected:** The Scripts pane is replaced by the inspector with exactly Frames, Keys, Type Standard, Edit Rail, and Close; each entry surface opens the reduced modal; Close restores the normal Scripts content.
   **Why human:** Live Preact render, focus, and pointer timing in the WKWebView; the node harness mocks `useEffect`.

2. **Reduced Cycle modal**
   **Test:** Open Edit Rail and inspect the surface; set a repeat and confirm.
   **Expected:** Only the Cycle stepper (prefilled 1) and Infinity switch, no tabs or source controls; Create Cycle commits a gray Standard cycle.
   **Why human:** Visual surface and modal round-trip.

3. **Rail-set anchor**
   **Test:** Modifier-select two or more rails whose first member is a Key Rail.
   **Expected:** The anchor Key Rail's inspector shows Edit Rail visibly disabled with "Select a single rail to edit it." and no bulk conversion.
   **Why human:** Live selection behavior and disabled tooltip.

4. **Cancel during the in-flight window and during committing**
   **Test:** Open the reduced Cycle modal, press Create Cycle, then press Cancel or Escape while the authority request is in flight; then repeat and cancel during committing; after a failed commit, press Create Cycle again.
   **Expected:** Zero writes, no undo entry, the modal remains usable, and the retry commits exactly once. The controller contract is unit-pinned; the live timing is the residual risk.
   **Why human:** Real in-flight timing and live dialog usability (58-06 D3 / 58-VALIDATION manual row).

5. **Single-key drag under Law A on a Motion/Static/Reveal rail**
   **Test:** With exactly one loop referencing a source cycle, drag a single key to an order-preserving frame, then to an order-breaking frame.
   **Expected:** The safe move is accepted and the cycle re-derives; the order-breaking move is rejected with the locked rigid-group copy and never shows "Source missing".
   **Why human:** Pointer gesture and rail rendering in the packaged app (58-01 D5 / 58-VALIDATION manual row).

6. **Enter in the Cycle field**
   **Test:** In the reduced Cycle form, press Enter inside the Cycle field; then press Escape.
   **Expected:** Enter confirms exactly once (same as clicking Create Cycle); Escape cancels with zero writes.
   **Why human:** Keyboard routing on the live surface; the node spec dispatches Enter at the dialog root.

7. **CR-03 scope decision — partial-cycle group move**
   **Test:** With a partial source-cycle selection (e.g. A and B of a cycle A..E), drag the group past later source keys so the stored source order becomes non-increasing.
   **Expected:** Today the move is accepted and the cycle becomes unresolved ("Source missing", export blocked). Decide whether to fix this before phase acceptance (the review's fix sketch applies the final-mapping proof to `move-key-group`) or explicitly defer it as pre-existing, out-of-D-15 scope.
   **Why human:** Product/scope decision plus a live gesture check; no Phase 58 must-have truth covers the pre-existing `move-key-group` path.

### Gaps Summary

No must-have gaps remain. All 38 truths are verified, every required artifact is present, substantive, and wired, every key link is connected, and the five ROADMAP success criteria are satisfied — including the previously failing cancel-ledger and single-reference-order clauses.

- **CR-01 closed:** `confirmKeyRailCycle` now captures an accepted generation before `'preparing'`, checks it after authority and after commit, and routes AbortError to `'cancelled'` without `fail()`. Tests prove an in-flight cancel never commits, writes no history, preserves the frozen target, and retries exactly once.
- **CR-02 closed:** the `move-key` branch projects the single referencing clip's `sourceKeyIds` through the FINAL candidate mapping and rejects missing or non-increasing positions with the unchanged code and verbatim D-16 copy. The destructive C 12 → 22 move now rejects; the safe A 10 → 9 move derives with `unresolved: null`.
- **WR-01 / WR-02 closed:** a busy-phase cancel is a true no-op that preserves the retry target, and Enter and the primary now share one `confirmBlocked` gate so the reduced form confirms despite the stale frames validation while repeatError and every non-reduced surface keep their prior gating.

The status is `human_needed`, not `passed`, because the phase carries live-only UAT rows (takeover, modal surface, rail-set anchor, in-flight cancel timing, Law A gesture, Enter routing). One open critical finding, CR-03, is recorded for a human scope decision: it is a real defect with deterministic evidence, but it lives in the pre-existing `move-key-group` path that Phase 58 and D-15 deliberately did not change, so it does not falsify a Phase 58 must-have. Fixing it (or explicitly deferring it) is the human's call before the phase is accepted.

---

_Verified: 2026-11-03T14:22:10Z_
_Verifier: Claude (gsd-verifier)_
