---
phase: 37-multi-select-physical-roto-keys
verified: 2026-07-27T09:35:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 37: Multi-Select Physical Roto Keys Verification Report

**Phase Goal:** Multi-select physical Roto keys — select multiple real Physics Paint Roto keys (including Select All) and drag/drop, delete, and Force-Space them as one group, with the Phase 36.14 canonical physical-frame model and Phase 36.15 final timeline UI as the only authorities.
**Verified:** 2026-07-27T09:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 1-8)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Multi-select + Select All over real keys; keyId-only identity; generated/empty cells can never be selected; selection survives retiming | ✓ VERIFIED | `physicsPaintRotoMultiSelection.ts` pure module (zero imports, verified) exports `selectAllRotoKeyIds`, `toggleRotoKeySelection`, `extendRotoKeySelectionRange`, `collapseRotoKeySelection`, `resolvePostAcceptanceRotoSelection`; Studio signals `selectedKeyIds`/`selectionAnchorKeyId` (PhysicsPaintStudio.tsx:63); 18 passing reducer tests (incl. D-17 aftermath for all operation kinds); native UAT S7 passed with Q1/Q2 rulings confirmed |
| 2 | Group drag as one operation with complete-mapping preview, D-29 occupied-boundary behavior, atomic rejection, selection/focus follow | ✓ VERIFIED | `move-key-group` intent in resolver (lines 114, 121, 1318, 1449) resolved through the one `finalizeProposal`; `prepareRotoKeyGroupDrag`/`commitRotoKeyGroupDrag` in useRotoTimelineActions.ts:517/605; GD-1/GD-2/GD-3 locked mappings pass as vitest assertions (11/11 resolver tests green) and were confirmed natively (UAT S1-S3 with exact maps A@1,B@7,D@8,C@9 / atomic reject / A@1,B@10,D@11,C@12) |
| 3 | Group delete atomic with deterministic survivor, one Undo/Redo entry, shared transaction across all delete routes | ✓ VERIFIED | `delete-key-group` intent (resolver:114, 864, 1908); group-aware `deleteRotoFrame` routes ≥2 selection to one transaction (useRotoTimelineActions.ts:363-367); GDel-1/GDel-2 tests pass (survivor rule, delete-to-empty with selectedKeyId null); UAT S4/S5 confirmed both toolbar and Backspace routes produce A@1,D@8 with one Undo restoring baseline |
| 4 | Force Spacing scoped vs full-timeline per locked decision; invalid/negative/fractional/over-capacity rejected atomically; one history action | ✓ VERIFIED | `scopeKeyIds` on force-spacing intent (resolver:131, 1497-1535); hook branch `selectedKeyIds.length >= 2 ? scopeKeyIds : null` (useRotoTimelineActions.ts:661-679); GFS-1/GFS-2/GFS-3 tests pass; UAT S6 confirmed A@1,B@3,C@6,D@10 (scoped), atomic reject at N=6, A@1,B@4,C@7,D@10 (full-timeline), and no-op rejections for invalid N |
| 5 | Every multi-key operation is one acknowledged transaction; no partial mutation; accepted-only history | ✓ VERIFIED | Lockstep allowlist admission: resolver kind union (:152-154) + `isResolverOperationKind` (:594-596), wire union in types/physicPaint.ts:56-58 + validator :202-204, history `isOrdinaryOperationKind` in useRotoPhysicalEditHistory.ts:130-132; all group ops flow through the generic `executePhysicalEdit` coordinator (no direct bridge sends — verified no `selectedKeyIds`/`selectionAnchorKeyId` in physicPaintBridge.ts or types/physicPaint.ts); atomic-reject tests assert `ok === false` + exact failure codes (zero proposal = zero mutation possible); UAT S1-S6 each confirmed exactly one history entry and exact Undo/Redo round-trips |
| 6 | Downstream parity: save/reopen preserves map + keyId ownership; caches/playback/preview/export derive from accepted map; Basic/FX unchanged | ✓ VERIFIED | UAT S9 (save/close/reopen preserved accepted map; live pixel caches, dirty state, cached playback, onion/reference, parent preview, exported PNG sequence, background rendering, timeline extent all derive from accepted map; interpolation re-derivation regression class did not recur) and S10 (Basic perfect-freehand and FX p5.brush unchanged) — user-approved; covered by approved UAT per verification scope note |
| 7 | 36.15 UI gains multi-select affordances: distinct selected state, tooltips, Select All in compact strip, group preview, guarded disabled actions with reasons, one capsule message | ✓ VERIFIED | `.physics-paint-roto-cell.selected` CSS (physicsPaintStudio.css:2228 — 2px #F2F5F7 outline, z-index lift, geometry unchanged); `roto-drag-target-blocked` CSS (:2266) + `cursor: not-allowed`; `aria-selected` on cells (strip:299); `getRotoCellSelectedTooltipCopy` returns exact UI-SPEC copy (presentation:250-253); guarded Select All icon with ListChecks glyph at end of key-utilities pill (strip:1295-1301) consuming `canSelectAllKeys`/`selectAllKeysDisabledReason` computeds; status copy `Keys moved`/`Keys deleted` in resolver:1908/1918; all 3 UI backstops visually confirmed by user (UAT S2, S8) |
| 8 | Production first; native UAT blocking; only after explicit approval do regression tests + typecheck + build follow | ✓ VERIFIED | D-18 ordering honored in commit history: feat(37-01/37-02) commits precede UAT; UAT approval recorded verbatim (`"approved — s2-s10 pass; q1-q4 confirmed"`, user, 2026-07-27, 37-UAT.md status: resolved); test commits (test(37-06)) came after; 3 phase test files pass 49/49 via `vitest run`; full suite green (849 passed / 0 failed, user-reported) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | Group intents resolved through finalizeProposal | ✓ VERIFIED | 97KB substantive; move-key-group/delete-key-group/scoped force-spacing intents, conflictingAppFrames, status copy |
| `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts` | Pure keyId-only selection reducers | ✓ VERIFIED | Zero import statements (purity confirmed); 5 exported reducers + D-17 aftermath |
| `app/src/types/physicPaint.ts` | Wire union admits group kinds, no multi-selection fields | ✓ VERIFIED | Union extended (:56-58, :202-204); no selectedKeyIds/selectionAnchorKeyId present (persistence prohibition holds) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | Ordinary-kind guard admits group kinds | ✓ VERIFIED | :130-132 |
| `app/src/lib/physicPaintBridge.ts` | Generic ordinary path, zero edits needed | ✓ VERIFIED | No multi-selection fields; group kinds ride the generic acknowledged transaction |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Group prepare/commit, group-aware delete, scoped force-spacing, Select All computeds | ✓ VERIFIED | 42KB; all symbols present and exported in bundle (:730-743) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Selection signals, callbacks, port wiring, D-17 application | ✓ VERIFIED | Signals (:63), getSelectedKeyIds port (:473), publishDiagnostic console channel (:480), resolvePostAcceptanceRotoSelection at accepted-output seam (:836), strip callback wiring (:1092-1127) |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | Escape-collapse, strip-scoped Cmd/Ctrl+A | ✓ VERIFIED | :106-130 with mutationLocked + focus guards |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Selection gestures, group drag session, Select All icon | ✓ VERIFIED | Modifier-branch click handling (:496-504), group prepare/commit (:615, :828), release-reject publication (:803), guarded ListChecks icon (:1295-1301) |
| `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` | Moved-set preview roles, selected tooltip copy | ✓ VERIFIED | :246-253, :427-428 |
| `app/src/components/physic-paint/physicsPaintStudio.css` | .selected and blocked-target treatments | ✓ VERIFIED | :2228, :2266 |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` | Locked GD/GDel/GFS mapping assertions | ✓ VERIFIED | NEW; 11/11 pass |
| `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts` | Selection reducer + D-17 coverage | ✓ VERIFIED | NEW; 18/18 pass |
| `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts` | Group moved-set + tooltip describe blocks appended | ✓ VERIFIED | EXTENDED; 20/20 pass; new describes at :269, :316; existing blocks intact |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Resolver group intent branches | finalizeProposal | buildMoveGroupCandidate / buildDeleteGroupCandidate / scoped force-spacing | ✓ WIRED | Single finalizer; GD/GDel/GFS tests prove end-to-end resolution |
| types/physicPaint.ts validator | physicPaintBridge generic path | isPhysicPaintRotoPhysicalEditOperationKind | ✓ WIRED | Group kinds admitted; no bridge edits required |
| useRotoPhysicalEditHistory guard | accepted-only effect | isOrdinaryOperationKind | ✓ WIRED | Exactly one history entry per group op (UAT-confirmed) |
| Studio selectedKeyIds signal | getSelectedKeyIds port | Hook input (PhysicsPaintStudio.tsx:473) | ✓ WIRED | Read-only port; hook never mutates/persists selection |
| Strip gesture props | 37-02 reducers | onToggle/onExtend/onCollapse callbacks (:1092-1122) | ✓ WIRED | Signals round-trip through controller |
| Group gesture session | prepare/commit pair | Frozen publication retention | ✓ WIRED | :615 prepare during gesture, :828 commit unchanged at release |
| canSelectAllKeys computeds | Guarded Select All icon | selectAllRotoKeys callback | ✓ WIRED | Shared with Cmd/Ctrl+A route; one 'All keys selected' entry per invocation |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| WorkflowStrip selected cells | rotoSelectedKeyIds prop | Studio selectedKeyIds signal ← pure reducers ← real-key identity list | Yes (reducers operate on store-ordered records) | ✓ FLOWING |
| Group drag preview | drag.movedKeyIds | Resolver proposal metadata | Yes (real resolver output, not view-derived) | ✓ FLOWING |
| Select All availability | canSelectAllKeys computed | launch presence + pending op + record count | Yes (reactive computeds over live signals) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Locked group mappings + selection reducers + presentation pass | `pnpm vitest run` on 3 phase test files | 49/49 passed (11 resolver + 18 selection + 20 presentation) | ✓ PASS |
| Full suite green | user-reported post-37-06 gate | 849 passed / 0 failed | ✓ PASS (per scope note) |
| Module purity (no Preact/store imports) | `grep "^import"` on multiSelection.ts | 0 matches | ✓ PASS |
| Persistence prohibition | grep selectedKeyIds/selectionAnchorKeyId in bridge + types | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| 37-MULTI-SELECT-IDENTITY | 37-02, 37-04, 37-06 | keyId-only multi-select; generated/empty never selected; survives retiming | ✓ SATISFIED | Pure reducer module + 18 tests + UAT S7 |
| 37-SELECT-ALL | 37-02, 37-03, 37-04 | Select All real keys, discoverable in 155px strip | ✓ SATISFIED | Reducer + guarded icon + Cmd/Ctrl+A route + UAT S5/S7 + Q3 ruling |
| 37-GROUP-DRAG | 37-01, 37-03, 37-04, 37-06 | Group drag preserving relative distances, atomic reject | ✓ SATISFIED | GD-1..GD-3 tests + UAT S1-S3 |
| 37-GROUP-DELETE | 37-01, 37-03, 37-06 | Atomic group delete, survivor rule, one Undo action | ✓ SATISFIED | GDel-1/GDel-2 tests + UAT S4/S5 |
| 37-GROUP-FORCE-SPACING | 37-01, 37-03, 37-06 | Scoped vs full-timeline Force Spacing | ✓ SATISFIED | GFS-1..GFS-3 tests + UAT S6 |
| 37-ATOMIC-TRANSACTIONS | 37-01, 37-03, 37-06 | One acknowledged transaction, accepted-only history | ✓ SATISFIED | Lockstep allowlists + atomic-reject tests + UAT Undo/Redo round-trips |
| 37-DOWNSTREAM-PARITY | 37-05 | Save/reopen + downstream derivation + Basic/FX unchanged | ✓ SATISFIED | UAT S9/S10 (user-approved) |
| 37-UI-INTEGRATION | 37-04, 37-05 | 36.15 UI affordances, selected state, tooltips, guarded actions | ✓ SATISFIED | Strip/CSS/presentation wiring + 3 backstops confirmed |
| 37-UAT-THEN-REGRESSION | 37-05, 37-06 | UAT blocking before tests | ✓ SATISFIED | Commit ordering + approval record + 49 post-UAT tests |

All 9 requirement IDs accounted for. No orphaned requirements (REQUIREMENTS.md maps exactly these 9 to Phase 37).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER markers in phase-touched files; no stub returns; no hardcoded empty data flowing to render |

### Human Verification Required

None. All human-verification items (3 UI backstops, 4 flagged-assumption rulings, downstream parity, Basic/FX non-regression) were covered by the approved native UAT (37-UAT.md, status: resolved, ruling: "approved — s2-s10 pass; q1-q4 confirmed") and are treated as verified per the verification scope note.

### Gaps Summary

None. All ROADMAP success criteria verified in the codebase with behavioral evidence (49 passing phase tests + user-approved native UAT covering every locked mapping, backstop, and parity item).

---

_Verified: 2026-07-27T09:35:00Z_
_Verifier: Claude (gsd-verifier)_
