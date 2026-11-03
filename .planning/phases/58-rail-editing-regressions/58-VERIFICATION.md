---
phase: 58-rail-editing-regressions
verified: 2026-11-03T12:53:05Z
status: gaps_found
score: 22/25 must-haves verified
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
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
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
covered_digest: "v4:sha256:e10a2160845cb12792d94463c2033656f546c5f0cb8b926ff872d827b257d961"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Cancel performs zero writes: no store mutation, no revision bump, no undo entry"
    status: failed
    reason: "CR-01 confirmed. confirmKeyRailCycle never participates in the controller's generation/cancel contract. It sets phase 'preparing' and awaits requestAuthority, but it never captures an accepted generation, never calls assertCurrent, and never touches abortController. cancel() during 'preparing' bumps generation and aborts a controller this path never assigned, so the awaited authority resolves and the conversion commits anyway."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
        issue: "confirmKeyRailCycle (:1822-1875) sets phase 'preparing' (:1833), awaits requestAuthority (:1835), then proceeds unconditionally to phase 'committing' (:1862) and await ports.commit (:1863). canCancel is true during 'preparing' (:830) and cancel() only bumps generation (:3609-3613). assertCurrent exists (:3625) and is used by the render/bake paths (:2809, :3179, :3246, :3277) but not here."
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts"
        issue: "The only cancel pin (:4049-4059) cancels after open and asserts requestAuthority was never called — the in-flight (post-confirm, pre-authority) cancel case is untested."
    missing:
      - "Capture an accepted generation before setting phase 'preparing'; call assertCurrent after requestAuthority and after ports.commit; treat AbortError as the 'cancelled' phase without calling fail()"
      - "Add a controller test that calls confirm() then cancel() while requestAuthority is still pending and asserts ports.commit was never called"
  - truth: "Cancel and every refusal perform zero commits and zero history entries"
    status: failed
    reason: "Same CR-01 root cause as the previous truth: an in-flight Cancel still reaches ports.commit (:1863), so a history entry is created after the user pressed Cancel or Escape. The refusal paths themselves are correct — stale-key revalidation (:1837-1838) and already-owned-key checks (:1839-1841) return before any commit."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
        issue: "The commit at :1863 is guarded only by the awaited result, not by the generation. cancel() cannot stop it because the key-rail-create path assigns no abortController."
    missing:
      - "The generation guard and abort handling described in CR-01 make both cancel and refusal paths zero-commit and zero-history"
  - truth: "Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent 'Source missing' clip with no in-UI repair"
    status: failed
    reason: "CR-02 confirmed. The Law A guard only counts referencing loops; it never checks that the moved key's destination keeps the single referencing clip's sourceKeyIds positions strictly increasing. The phase's own Law A test pins the destructive case as accepted: C at 12 moved to 22 with source keys A..E at 10..14, which yields positions 10, 11, 22, 13, 14."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
        issue: "Guard at :4463-4469 checks only countLoopsReferencingSourceKey(...) > 1. derivePhysicPaintRotoLoopRanges requires strictly increasing source positions (:5533-5536) and otherwise emits unresolved.invalidSourceTiming (:5633-5637)."
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts"
        issue: "The Law A test (:281-298) accepts movedKeyId 'C' with target appFrame 22 against SOURCE_RECORDS A@10..E@14 and loop(10,5), asserting mapping.get('C') === 22 and nextLoopClips === null — the exact order-breaking move."
      - path: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts"
        issue: "unresolved clips present as 'Source missing' (:321, :341, :352), and the presentation carries no in-UI repair for a Standard clip."
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
        issue: "Every source-repair entry refuses a Standard clip: groupRegenerateReason (:1926), openSourceEdit (:2040), repairLoop (:2073). unlinkLoop (:2280) has no production UI consumer anywhere in app/src."
    missing:
      - "When exactly one clip references the moved key, substitute the destination frame into that clip's sourceKeyIds order and reject with the existing loop-source-key-move-rejected copy unless the sequence stays strictly increasing"
      - "Update the Law A test to an order-preserving destination and add a rejection test for C 12 to 22"
deferred:
  - truth: "Standard rails present with per-frame cells, cycle grays, and the rail colour dot"
    addressed_in: "v7 timeline rails (in-milestone quick)"
    evidence: "ROADMAP Phase 58 SC2: 'Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58.'"
  - truth: "Motion channels on the v7 timeline rails"
    addressed_in: "v2.1.0"
    evidence: "ROADMAP v7 timeline rails: 'Motion channels stay in v2.1.0.'"
---

# Phase 58: Rail editing regressions Verification Report

**Phase Goal:** A normal Key Rail becomes a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged to choose its spacing — without silently relaxing linked-cycle ownership.
**Verified:** 2026-11-03T12:53:05Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The Key Rail to Standard-cycle pipeline is present, substantive, and wired end to end: selection surfaces, the reduced Cycle/Infinity modal, the provenance-free record, the single loop-only commit, and the one-command undo/redo. The Law A single-reference move is also in place and the two-loop D-11 guard still holds.

Two blocker-class defects falsify parts of the phase contract:

1. **Cancel during `'preparing'` still commits (CR-01).** The new `confirmKeyRailCycle` path ignores the controller's generation contract, so the footer's "Cancel generation" and Escape do not stop the conversion.
2. **A Law A move can silently invalidate its single referencing cycle (CR-02).** Moving a source key past a sibling is accepted, the clip derives as unresolved and presents "Source missing", and no in-UI repair path exists for a Standard clip.

The practical outcome: the primary conversion path works, but "cancel writes nothing" is false in the in-flight window and "without silently relaxing linked-cycle ownership" is false for the single-reference move.

### Observable Truths

| # | Truth | Requirement | Status | Evidence |
|---|-------|-------------|--------|----------|
| 1 | Selecting a normal Key Rail exposes the sidebar Edit Rail action: the Scripts panel is replaced by an inspector with Edit Rail and Close | RAIL-01, SC1 | ✓ VERIFIED | `PhysicsPaintScriptsPanel.tsx:147-160` takeover branch precedes the loop branch; `PhysicsPaintStudio.tsx:7183-7185` passes `selectedKeyRail` and both handlers; ScriptsPanel spec 61/61, Studio spec 336/336 |
| 2 | Double-clicking a Key Rail invokes the open intent: plain second click within 220 ms, never a move member, never while busy | RAIL-01, D-02 | ✓ VERIFIED | `PhysicsPaintKeyRail.tsx:31` (220 ms), `:255-285` (gesture gate), `:417` (prop forwarded); `PhysicsPaintWorkflowStrip.tsx:447`, `:4868`; KeyRail spec 17/17 |
| 3 | Enter on a focused Key Rail selects it then invokes the same open intent; Space still plain-selects; Escape still hides the tooltip | RAIL-01, D-02 | ✓ VERIFIED | `PhysicsPaintKeyRail.tsx:300-307`; KeyRail spec 17/17 |
| 4 | The conversion modal shows only the Cycle stepper and Infinity switch, prefilled at 1 and unchecked, with no tabs, rail type, frames-per-cycle, Motion, source cycle, seed, or Regenerate | RAIL-02, SC1, D-05 | ✓ VERIFIED | `ReducedCycleCard` `PhysicsPaintPlayScriptCards.tsx:561-600`; `PhysicsPaintPlayScriptDialog.tsx:64`, `:72`, `:145`, `:315-317`, `:366-369`; dialog spec 100/100 |
| 5 | Cancel performs zero writes: no store mutation, no revision bump, no undo entry | RAIL-04, SC3 | ✗ FAILED | CR-01: `confirmKeyRailCycle` (`physicsPaintRotoPlayScriptController.ts:1822-1875`) never captures or checks a generation; `cancel()` during `'preparing'` (`:3609-3613`, `canCancel` `:830`) only bumps `generation`; the awaited `requestAuthority` and `commit` still run. The only cancel test (`:4049-4059`) cancels before any authority request |
| 6 | The primary action labels Create Cycle for a first conversion and Update Rail for an existing Standard clip, and both route through `playScript.confirm()` | RAIL-02, D-05 | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:574-577`; dialog spec 100/100 |
| 7 | Confirming creates one provenance-free Standard clip: `sourceKeyIds` in segment order, `placementStart` = first key frame, repeat from the reduced form, no `scriptId` / `railKind` / `motion` | RAIL-03, SC2 | ✓ VERIFIED | `buildKeyRailStandardLoopClip` `physicsPaintRotoRunScriptStacking.ts:597-614` strict whitelist; `physicsPaintRotoKeyRailCycle.test.ts:92-151` |
| 8 | Goal qualifier: an accepted single-key move under Law A leaves the single referencing cycle resolvable — no silent "Source missing" clip with no in-UI repair | Goal clause: without silently relaxing linked-cycle ownership | ✗ FAILED | CR-02: guard `physicsPaintRotoPhysicalResolver.ts:4463-4469` counts loops only; `derivePhysicPaintRotoLoopRanges` requires strictly increasing source positions (`:5533-5536`) and marks `invalidSourceTiming` (`:5633-5637`); Law A test `loopGuards.test.ts:281-298` accepts C 12 to 22 (order 10, 11, 22, 13, 14); presentation `physicsPaintLoopClipPresentation.ts:341`, `:352` renders "Source missing"; Standard repair refusals `controller:1926`, `:2040`, `:2073`; `unlinkLoop` has no production UI consumer |
| 9 | The clip classifies as Standard and presents via the existing `.rail-kind-standard` pill; the existing Edit Rail dialog owns Repeat/Infinity afterwards | RAIL-03, SC2 | ✓ VERIFIED | `classifyLoopClipRailKind(clip) === 'standard'` pinned `KeyRailCycle.test.ts:101`; CSS `physicsPaintStudio.css:4935-4936`; merged-Standard loop-edit renders the reduced form with Update Rail |
| 10 | A gapped segment keeps its span: cycle length = last - first + 1, extent clamped to capacity, infinity lifecycle-less | RAIL-03, D-09 | ✓ VERIFIED | `controller:1845` passes `cycleFrameCount` into `buildNewLoopLifecycle`; `KeyRailCycle.test.ts:152-227` (6-frame cycle, repeat-2 extent 22, repeat-1 extent 16, infinity no lifecycle) |
| 11 | A single-key segment converts to a 1-frame cycle | RAIL-03, D-08 | ✓ VERIFIED | `KeyRailCycle.test.ts:189-205` |
| 12 | A second conversion over already loop-owned keys is refused before any commit | RAIL-03 | ✓ VERIFIED | open-time `controller:1780-1782`, confirm-time `:1839-1841`; tests `controller.test.ts:4078-4094` (owned via sourceKeyIds and via frameOverrides) |
| 13 | Undo restores the pre-conversion Key Rail and Redo re-applies the conversion as one command | RAIL-05, SC3 | ✓ VERIFIED | `controller.test.ts:4026-4046` drives the real history hook: availability 1/0, undo restores an empty loop collection, redo restores the clip with `originalEndExclusive` 16 |
| 14 | The conversion is exactly one `ports.commit` with `semanticDelta.kind 'play-script'`, `loopOnly: true`, `affectedEndAppFrame = anchor - 1`, `freshKeyIds: []` | RAIL-05 | ✓ VERIFIED | `buildLoopOnlyPublication` `controller:2118-2154`; `confirmKeyRailCycle:1854-1863` calls commit once; test asserts one commit call |
| 15 | Cancel and every refusal perform zero commits and zero history entries | RAIL-04, RAIL-05 | ✗ FAILED | CR-01 root cause: a cancel while `requestAuthority` is pending still reaches `ports.commit` (`:1863`), creating the loop clip and its history entry. Refusal paths (`:1837-1838`, `:1839-1841`) do return before commit |
| 16 | A single-key drag on a key referenced by exactly one loop is accepted and lands on the requested frame (Law A) | RAIL-06, SC4, D-12 | ✓ VERIFIED | `physicsPaintRotoPhysicalResolver.ts:4467` comparator `> 1` with the D-12 comment; test `loopGuards.test.ts:283-298` |
| 17 | A key referenced by two or more loops is rejected, never moves silently, with `loop-source-key-move-rejected`, `move-key`, and the verbatim D-16 copy | RAIL-06, SC4, D-11 | ✓ VERIFIED | `resolver:4467-4469`; locked copy `:863-864`; two-loop test `loopGuards.test.ts:300-308` |
| 18 | An accepted single-key move never emits `nextLoopClips`, so `placementStart` stays put | RAIL-06, D-13 | ✓ VERIFIED | test `loopGuards.test.ts:294-296` (`proposal.nextLoopClips` null) |
| 19 | Force Spacing and the Delete / Insert / Duplicate / move-key-rail guards keep their current guards and copy | RAIL-06, D-14, D-15 | ✓ VERIFIED | `resolver:4491`, `:4501` still `> 0`; `git diff` of the resolver shows only the move-key comparator and its comment; Force Spacing describes byte-identical; new no-leak pins `loopGuards.test.ts:607-645` |
| 20 | The acceptance is entirely inside the resolver: `prepareRotoKeyDrag` / `commitRotoKeyDrag` and the WorkflowStrip drag dispatch are untouched | RAIL-06 | ✓ VERIFIED | `git diff` resolver = 2 changed lines plus comment; `useRotoTimelineActions.ts:2424-2433` still passes `loopClips`; strip `:4376` unchanged |
| 21 | Edit Rail and double-click/Enter reach one Studio handler that selects the rail first, then delegates to `openKeyRailCycleEdit`, returning a Promise on every path | RAIL-01, D-01 | ✓ VERIFIED | `PhysicsPaintStudio.tsx:4814-4824`; Studio spec `selects before opening and returns a Promise on the missing-segment refusal` |
| 22 | A 2+ rail set whose anchor is a Key Rail projects with setSize >= 2, Edit Rail visible and disabled with "Select a single rail to edit it.", and no bulk conversion | RAIL-01, D-03 | ✓ VERIFIED | `Studio:4882-4888` and shared anchor `:1781`; `physicsPaintKeyRailPresentation.ts:111`, `:129-143`; Studio and ScriptsPanel specs |
| 23 | Close clears both `selectedRotoKeyRail` and `railSetSelection`, so the takeover dismisses in the plain and rail-set states | RAIL-01, D-01, D-03 | ✓ VERIFIED | `Studio:4830-4833`; Studio spec `clears BOTH selection layers on Close` |
| 24 | The inspector shows exactly Frames F{first}-F{last}, Keys n, Type Standard, and keeps one object identity across unrelated renders | RAIL-01, D-04 | ✓ VERIFIED | `physicsPaintKeyRailPresentation.ts:129-143`; memo deps `Studio:4882-4888` (selection object, segment map, primitive anchor, member count); `reconcileRotoKeyRailSelection:453-463` returns the same object while valid |
| 25 | No `.mce` schema field is added or changed; resolver, undo, and existing D-11 guard tests are green or deliberately updated | RAIL-07, SC5 | ✓ VERIFIED | `git diff --name-only` contains no `.mce`, schema, parser, `src-tauri`, or `app/src/types` path; 322 + 340 + 336 tests green; `tsc --noEmit` clean |

**Score:** 22/25 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-frame cells, cycle grays, and the rail colour dot on Standard rails | v7 timeline rails (in-milestone quick) | ROADMAP Phase 58 SC2: "Per D-10, per-frame cells, cycle grays, and the rail colour dot belong to the v7 quick, not Phase 58." |
| 2 | Motion channels | v2.1.0 | ROADMAP v7 timeline rails: "Motion channels stay in v2.1.0." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | Law A guard, D-11/D-13/D-14/D-15 unchanged | ✓ VERIFIED | Exists, substantive, wired; only the move-key comparator and comment changed |
| `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` | Law A boundary pair and no-leak pins | ✓ VERIFIED | Exists, substantive; 42 tests green |
| `app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts` | Standard record, span, single-key, infinity | ✓ VERIFIED | Exists, substantive; 8 tests green |
| `buildKeyRailStandardLoopClip` (`physicsPaintRotoRunScriptStacking.ts`) | Strict whitelist, provenance-free | ✓ VERIFIED | `:597-614` |
| `KeyRailCycleEditTarget`, signal, `openKeyRailCycleEdit` (`physicsPaintRotoPlayScriptController.ts`) | Frozen target, zero writes on open | ✓ VERIFIED | `:1766-1808` |
| `SelectedKeyRailInspectorPresentation`, `projectSelectedKeyRailInspector` | Frames/Keys/Type, disabled reason | ✓ VERIFIED | `physicsPaintKeyRailPresentation.ts:111`, `:129-143` |
| `PhysicsPaintScriptsPanel` props `selectedKeyRail` / `onOpenKeyRailEdit` / `onCloseKeyRail` | Takeover branch with Edit Rail and Close | ✓ VERIFIED | `:147-160`; 61 tests green |
| `PhysicsPaintKeyRail` prop `onOpenKeyRailCycleEdit` | Double-click + Enter intent | ✓ VERIFIED | `:255-307`, `:417`; 17 tests green |
| `PhysicsPaintWorkflowStrip` prop `onOpenKeyRailCycleEdit` | Forwarding without drag changes | ✓ VERIFIED | `:447`, `:4868`; 151 tests green |
| `ReducedCycleCard` | Cycle stepper + Infinity switch only | ✓ VERIFIED | `PhysicsPaintPlayScriptCards.tsx:561-600` |
| `keyRailCreate` / `reducedForm` locals and reduced branch | Mode-gated reduced surface | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:64`, `:72`, `:82`, `:90-91`, `:145`, `:366-369`, `:568-581` |
| `PhysicsPaintStudio.tsx` inspector memo, shared anchor, handlers, prop bundles | D-01/D-03 wiring | ✓ VERIFIED | `:1152`, `:1781`, `:4814-4833`, `:4882-4888`, `:7093`, `:7183-7185`, `:11011`; 336 tests green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Key Rails segment derivation | `projectSelectedKeyRailInspector` | `keyRailSegmentByFirstKeyId` -> `selectedKeyRailInspector` memo | ✓ WIRED | `Studio:1152`, `:4882-4888` |
| `railSetAnchorKeyRailId` | inspector memo and WorkflowStrip bundle | one shared const | ✓ WIRED | `Studio:1781`, `:4888`, `:11011`; exactly one anchor expression |
| Scripts panel Edit Rail onClick | `handleOpenRotoKeyRailCycleEdit` | `onOpenKeyRailEdit` prop | ✓ WIRED | `ScriptsPanel:147-160`; `Studio:7183-7185`, `:4814-4824` |
| `handleOpenRotoKeyRailCycleEdit` | `rotoPlayScript.openKeyRailCycleEdit` | select-then-open, Promise on every path | ✓ WIRED | `Studio:4814-4824` |
| `PhysicsPaintKeyRail` double-click / Enter | Studio handler | `onOpenKeyRailCycleEdit` -> WorkflowStrip -> Studio | ✓ WIRED | `KeyRail:255-307`; strip `:447`, `:4868` |
| `dialogMode === 'key-rail-create'` | `confirmKeyRailCycle` | `confirm()` routing | ✓ WIRED | `controller:2347`, `:1822` |
| `confirmKeyRailCycle` | `buildKeyRailStandardLoopClip` -> `buildLoopOnlyPublication` -> `ports.commit` | one loop-only transaction | ✓ WIRED | `controller:1846-1863` |
| `cancel()` / Escape during `'preparing'` | `confirmKeyRailCycle` generation guard | generation check | ✗ NOT_WIRED | CR-01: no generation capture or `assertCurrent` in the key-rail-create path |

### Data-Flow Trace (Level 4)

These surfaces are interaction and derivation surfaces, not data-fetching surfaces; no DB or network query is involved.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Scripts panel inspector | `selectedKeyRailInspector` | `deriveKeyRailSegments` over `orderedRealKeys` (physical key records) | Yes | ✓ FLOWING |
| Key Rail strip | segment `keyIds` / frames | same derivation, loop-owned keys excluded | Yes | ✓ FLOWING |
| Cycle dialog repeat | `repeatText` -> `parsedRepeat` | `keyRailCycleEditTarget.cycleFrameCount` for key-rail-create | Yes | ✓ FLOWING |
| Reduced dialog readout | `loopReadout` | creation-branch signals (`activeParsedCount`, `canonicalStart`, `layerEndExclusive`) not primed for key-rail-create | Stale for this mode | ℹ️ STALE (IN-01) |
| Loop clip presentation | lifecycle label | `derivePhysicPaintRotoLoopRanges` over live records | Yes (reaches "Source missing" when order breaks) | ✓ FLOWING (exposes CR-02) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Resolver Law A, D-11, and loop guards | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | 322 passed (42 + 8 + 272) | ✓ PASS |
| Key Rail presentation, panel, strip, dialog | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx.test.ts app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | 340 passed (11 + 61 + 17 + 151 + 100) | ✓ PASS |
| Studio wiring | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/PhysicsPaintStudio.test.ts` | 336 passed | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| In-flight cancel behavior | Source inspection — no test exists that cancels while `requestAuthority` is pending | Test gap confirmed | ✗ FAIL (CR-01) |
| Single-reference order-breaking move | Source inspection plus the accepted Law A test at `loopGuards.test.ts:281-298` | Destructive acceptance confirmed | ✗ FAIL (CR-02) |

### Probe Execution

None. The phase declares test-boundary probes in its must-haves (not executable scripts), and `find scripts -path '*/tests/probe-*.sh'` returns nothing. Not applicable to this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RAIL-01 | 58-03, 58-04, 58-05 | Open Edit Rail for a normal Key Rail from the sidebar using the same entry point loop clips use | ✓ SATISFIED | Truths 1-4, 21-24; all wiring verified |
| RAIL-02 | 58-02, 58-04 | Modal shows only cycle count and Infinity, prefilled at 1, no script/motion/reveal controls | ✓ SATISFIED | Truths 4, 6; reduced card and dialog spec |
| RAIL-03 | 58-02, 58-03 | Confirm converts the segment into a provenance-free Standard clip and the rail presents as Standard | ✓ SATISFIED | Truths 7, 9-12 |
| RAIL-04 | 58-02, 58-04 | Cancelling performs zero writes (no store mutation, revision bump, or undo entry) | ✗ BLOCKED | Truths 5, 15; CR-01 |
| RAIL-05 | 58-02 | Conversion is exactly one undo step; cancel and refusal leave the ledger untouched | ✗ BLOCKED | One-commit and undo/redo clauses verified (truths 13-14); the cancel-ledger clause fails via CR-01 (truth 15) |
| RAIL-06 | 58-01, 58-03 | Single-key drag under Law A; keys referenced by more than one loop keep D-11; shared linked-cycle behavior never silently relaxed | ✗ BLOCKED | Law A and D-11 clauses verified (truths 16-20); the "never silently relaxed" clause fails via CR-02 (truth 8) |
| RAIL-07 | 58-01, 58-02, 58-04 | Regression-locked behavior, existing D-11 tests green, no `.mce` schema change | ✓ SATISFIED | Truth 25; note the regression lock has the in-flight cancel hole called out in CR-01 and the destructive Law A acceptance called out in CR-02 |

No orphaned requirements: all seven IDs appear in plan frontmatter, and REQUIREMENTS.md maps exactly these seven to Phase 58.

### Code Review Findings Verification

All seven findings in `58-REVIEW.md` were reproduced independently from source; none are refuted. All remain `open` in `58-REVIEW-DISPOSITION.md`.

| Finding | Severity | Claim | Verdict | Evidence |
|---------|----------|-------|---------|----------|
| CR-01 | critical | Cancel during `'preparing'` does not cancel the Key Rail conversion | CONFIRMED | `controller:1822-1875` has no generation capture, `assertCurrent`, or abort; `:830` canCancel; `:3609-3613` cancel; test `:4049-4059` covers only pre-authority cancel |
| CR-02 | critical | Law A single-loop move can invalidate the loop's source order | CONFIRMED | `resolver:4463-4469` counts only; `:5533-5536` strict-increase requirement; `:5633-5637` invalidSourceTiming; `loopGuards.test.ts:281-298` pins C 12 to 22 as accepted; `physicsPaintLoopClipPresentation.ts:341`, `:352`; repair refusals `controller:1926`, `:2040`, `:2073`; `unlinkLoop` no UI |
| WR-01 | warning | Cancel/Close during `'committing'` nulls the target while the dialog stays open | CONFIRMED | `cancel()` else branch `:3617-3621` nulls `keyRailCycleEditTarget`; `closeConfirmation` `:3603-3604` returns while busy; `isBusyPhase` `:4270` includes `'committing'`; dialog Escape `:276-280` |
| WR-02 | warning | Enter-to-confirm in the reduced form is blocked by an unrelated stale frames error | CONFIRMED | Dialog Enter guard `:290-291` reads `validationError`; defaults `countText '3'` / `capacity 0` (`controller:715`, `:718`) produce "Maximum available count is 0."; `openKeyRailCycleEdit` `:1786-1806` primes neither; reduced primary is gated only on `repeatError` (`dialog:570-572`) |
| IN-01 | info | "Run details" readout in the reduced modal is stale dialog state | CONFIRMED | `loopReadout` `:885-931` has no `key-rail-create` branch and falls through to the creation branch reading `activeParsedCount`, `canonicalStart`, `layerEndExclusive` |
| IN-02 | info | Dead CSS rule after the Standard read-only value was removed | CONFIRMED | `physicsPaintStudio.css:2840`; the only non-CSS reference is the dialog test at `PhysicsPaintPlayScriptDialog.test.ts:1406`, which pins its absence |
| IN-03 | info | Open-time `loopClipsOwnAnyKey` is unreachable from production call sites | CONFIRMED | `controller:1780-1782`; segments exclude loop-owned keys (`physicsPaintKeyRailPresentation.ts:53-57`); owned set built at `Studio:1134-1141`; only the confirm-time check `:1839-1841` is reachable |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/components/physic-paint/physicsPaintStudio.css` | 2840 | Dead CSS rule `.physics-paint-play-script-standard-rail-value` after its only consumer was removed this phase | ℹ️ Info | Dead code only; IN-02 |
| `app/src/components/physic-paint/physicsPaintStudio.css` | 2838-2839 | Stale comment describing the removed read-only Standard value | ℹ️ Info | Same as IN-02 |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | 3609-3622 | `cancel()` mutates the key-rail target before a close that no-ops while busy | ⚠️ Warning | WR-01; the reduced dialog can be left with a dead Create Cycle button |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | 290-293 | Enter guard and primary-button gate use different validation sources in the reduced form | ⚠️ Warning | WR-02; click confirms, Enter silently does not |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or PLACEHOLDER debt markers exist in any changed implementation or test file. The only "placeholder" matches are the pre-existing `loop-placeholder` domain concept and `AQUARELLE_PLACEHOLDER_MAX_BYTES`. No skipped, todo, or pending tests exist in the requirement-linked specs. No stub components, handlers, or API routes were added.

### Human Verification Required

These live-Studio items are the plan-deferred human checks (58-04 D5, 58-05 D6). They are recorded here for phase UAT after the gaps close; they do not change the automated verdict.

1. **Key Rail inspector takeover**
   **Test:** In the Studio, select a normal Key Rail; then double-click one; then focus one and press Enter.
   **Expected:** The Scripts panel is replaced by the inspector with exactly Frames, Keys, Type Standard, Edit Rail, and Close; each entry surface opens the reduced modal.
   **Why human:** Live Preact render and focus behavior; the node harness mocks `useEffect`.

2. **Reduced Cycle modal**
   **Test:** Open Edit Rail and inspect the surface; set a repeat and confirm.
   **Expected:** Only the Cycle stepper (prefilled 1) and Infinity switch, no tabs or source controls; Create Cycle commits a gray Standard cycle.
   **Why human:** Visual surface and modal round-trip.

3. **Rail-set anchor**
   **Test:** Modifier-select two or more rails whose first member is a Key Rail.
   **Expected:** The anchor Key Rail's inspector shows Edit Rail visibly disabled with "Select a single rail to edit it." and no bulk conversion.
   **Why human:** Live selection behavior and disabled tooltip.

4. **Cancel during generation (post-fix regression check)**
   **Test:** Open the reduced Cycle modal, press Create Cycle, then press "Cancel generation" or Escape while the authority request is in flight; also cancel via Close during committing.
   **Expected:** Zero writes, no undo entry, dialog remains usable. Current code fails this row until CR-01 and WR-01 are fixed.
   **Why human:** Real timing of the in-flight window.

5. **Law A order guard (post-fix regression check)**
   **Test:** With exactly one loop referencing a source cycle, drag a middle source key past a later sibling.
   **Expected:** The move is rejected with the locked rigid-group copy and the loop stays resolvable. Current code accepts it and shows "Source missing" until CR-02 is fixed.
   **Why human:** Drag gesture in the live timeline.

### Gaps Summary

Two blocker-class root causes account for all three failed truths.

**CR-01 (truths 5 and 15) — in-flight cancel still commits.** `confirmKeyRailCycle` is the only asynchronous write path that ignores the controller's generation contract. During `'preparing'` the footer advertises "Cancel generation" and Escape routes to `cancel()`, but `cancel()` merely bumps `generation` and aborts an `abortController` this path never assigns. The conversion therefore creates a Loop Clip and an undo entry after the user pressed Cancel. The existing cancel test stops before any authority request, so it cannot catch this. The fix is the standard `acceptedGeneration` + `assertCurrent` pattern already used by the render and bake paths, plus a test that cancels while `requestAuthority` is pending.

**CR-02 (truth 8) — the single-reference move can silently break its cycle.** The Law A guard checks how many loops reference the key, not whether the destination keeps the referencing clip's source order valid. The phase's own test pins the destructive case as correct: A..E at 10..14 with C moved to 22 leaves source positions 10, 11, 22, 13, 14, which the derivation rejects as `invalidSourceTiming`; the clip presents as "Source missing". Because Standard clips refuse regenerate, source-edit, and repair, and `unlinkLoop` has no production consumer, the only recovery is Undo. The fix is to reject the move unless substituting the destination frame keeps the single referencing clip's `sourceKeyIds` positions strictly increasing, and to correct the Law A test destination.

**Warnings to fix in the same pass:** WR-01 (cancel during `'committing'` nulls the target and strands the reduced dialog) and WR-02 (the reduced form's Enter path is blocked by an unrelated stale frames validation while the primary button is enabled). Both are confirmed with exact evidence above; neither independently falsifies a must-have, but both degrade the phase's own surface and should be closed with the blockers.

**Info items:** IN-01 (stale "Run details" readout for key-rail-create), IN-02 (dead CSS rule and comment), IN-03 (open-time ownership check unreachable from production). These do not block the goal.

**Passing core:** the Key Rail to Standard conversion (record shape, span law, single key, infinity, ownership refusal, one-commit publication, one-command undo/redo) and the Law A two-loop boundary are fully implemented and regression-locked. The missing pieces are the cancel contract and the order-preservation guard, exactly as the two critical review findings state.

---

_Verified: 2026-11-03T12:53:05Z_
_Verifier: Claude (gsd-verifier)_
