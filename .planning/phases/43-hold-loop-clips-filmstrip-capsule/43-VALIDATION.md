---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-06
revised: 2026-08-07
revision_reason: integrated Loop Rail and contextual Scripts inspector correction
---

# Phase 43 — Validation Strategy

> Canonical validation map for the current Phase 43 branch. Plans 43-01 through 43-09 remain accepted automated substrate; 43-10 remains the sole native checkpoint with only its bounded stale-checkpoint correction; correction Plans 43-11 through 43-15 replace the rejected lane/capsule/main-timeline presentation. No row below reports a new native pass.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Vitest ^2.1.9 |
| Focused command | `pnpm --dir app exec vitest run <files>` |
| Full suite | `pnpm --dir app exec vitest run` |
| Typecheck | `pnpm --dir app run typecheck` |
| Build | `pnpm build` |
| Native oracle | User-run EFX Paint/Roto UAT through existing Plan 43-10 |

Rules: one-shot `vitest run` only; do not start the server; do not alter test configuration; do not install dependencies.

## Correction Wave Model

| Wave | Plan | Gate |
|---|---|---|
| 8 | 43-11 integrated rail/sidebar production tracer | One named RED→GREEN sentinel, then blocking-human approval of all nine checks together |
| 9 | 43-12 rail/popover/sidebar state expansion | Cannot begin until 43-11 native approval; each TDD task uses one exact named sentinel |
| 10 | 43-13 active Motion Editor removal | Removes projection/render/input/tooltip mount after the complete EFX replacement is green |
| 11 | 43-14 specialized EFX residue and child-listener cleanup | Deletes stale tooltip/geometry/lane/style residue and removes specialized child listeners |
| 12 | 43-15 public transport cleanup and full evidence | Removes specialized protocol after all callers are gone; runs the full matrix and updates UAT evidence |
| 13 | 43-10 Task 2 | Sole final native UAT checkpoint; executes only the current corrected 43-UAT.md |

## Nine-Check Tracer Gate — Plan 43-11

| # | Required observable | Automated evidence | Native evidence | Status |
|---|---|---|---|---|
| 1 | No extra row/height: strip 161px, physical row 38px, no canvas jump | WorkflowStrip/CSS contract | User measures loop and no-loop fixtures | pending |
| 2 | No cell or toolbar clipping | cell/toolbar geometry and event regressions | User inspects cells, outlines, drag feedback, 34px toolbar | pending |
| 3 | Conditional rail: 3px visible, 12px target, no-loop DOM absent | Rail/WorkflowStrip component tests | User verifies both fixtures | pending |
| 4 | Tooltip above rail with name, Cycle, Effective, status | presentation/rail tooltip tests | User hovers after existing delay | pending |
| 5 | Single click selects loop only | rail integration tests assert no playhead/cell/multi-select/drag dispatch | User confirms selection isolation | pending |
| 6 | Double-click and Enter open Edit Loop Clip exactly once | action-call count and popover suppression tests | User performs both routes | pending |
| 7 | Scripts Play→Edit swap plus seven facts | ScriptsPanel tests | User checks normal script and selected loop contexts | pending |
| 8 | Blue linked indicators preserved | WorkflowStrip CSS/source behavior tests | User checks normal/current/selected/drag states | pending |
| 9 | Zero Motion Editor Loop Clip UI | renderer/interaction/canvas absence tests | User inspects drawing, hit, tooltip, keyboard, actions | pending |

Plan 43-12 is blocked unless every row receives one explicit user approval in the same build.

## Covered UI Consideration Map

All 32 covered rows from `43-UI-SPEC.md` are mandatory; the 8 dismissed rows remain legitimate exclusions.

| Surface | Covered states | Plan / verification |
|---|---|---|
| S1 Integrated Loop Rail | empty, loading, error, populated, partial, overflow, zero-one-many | 43-11/43-12 rail, presentation, CSS, and native tracer |
| S1a Rail tooltip | overflow, long-text | 43-11/43-12 tooltip placement/copy/accessibility tests |
| S1b Local actions popover | loading, error, populated, partial, overflow, zero-one-many, long-text | 43-12 popover/controller/history tests |
| S1c Contextual Scripts sidebar | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | 43-11/43-12 ScriptsPanel tests and native tracer |
| S2 Edit Loop Clip modal | loading, error, partial, overflow, long-text | 43-12 existing modal regression suite |
| S5 Linked physical-cell indicator | empty, populated | 43-11/43-13 WorkflowStrip and selection/drag regressions |
| M1 Motion Editor exclusion | overflow | 43-11 entry-point absence, 43-13 structural deletion, native tracer |

## Requirement and Decision Coverage

| Requirement | Correction verification |
|---|---|
| HOLD-01 | 43-15 reruns complete static/hold stroke-set tests |
| HOLD-02 | 43-15 reruns deterministic regeneration/save-reopen tests |
| HOLD-03 | 43-15 reruns cancellation/failure/atomic Undo/Redo tests |
| HOLD-04 | 43-15 reruns one-raster composite and preview/export parity tests |
| HOLD-05 | 43-11/12 retain canonical resolver/controller paths; 43-15 reruns persistence, boundary, guards, history, unresolved, preview/export suites |
| HOLD-06 | 43-11/12 integrated rail/tooltip/sidebar/popover; 43-13 active main-timeline removal; 43-14 residue/listener cleanup; native checks in rewritten UAT |

Decision groups:

- D-01 through D-14: existing Loop/Source Edit, Link/Create, unlink-only deletion, placement/source identity, guards, materialization, loop priority, and atomic history are rerun in 43-12/43-15.
- D-15 through D-23: retained status/copy/accessibility/truncation/unresolved/zero-effective semantics move to the rail/tooltip/sidebar/popover; superseded persistent filmstrip details are removed in 43-14.
- D-24 through D-32: resolver algebra, dynamic parent end, preview/export parity, additive persistence, derived Effective duration, verbatim unresolved references, and lazy modulo remain unchanged and are rerun in 43-15.
- D-33 through D-49: mapped directly to Plans 43-11 through 43-15 and the nine-check gate above.
- D-41 horizontal placement drag is excluded; only compatible non-capturing pointer geometry is reserved.

## Focused Automated Commands

### Plan 43-11

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx -t "integrates Loop Clip ownership through all nine tracer checks"`

After GREEN only:

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.tsx src/lib/frameMap.test.ts src/components/timeline/TimelineRenderer.test.ts src/components/timeline/TimelineInteraction.test.ts`

### Plan 43-12

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts -t "projects exhaustive rail states without changing accepted geometry"`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintLoopClipPopover.test.tsx -t "keeps rejected local actions open and restores accepted focus deterministically"`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.tsx -t "preserves contextual loop facts through busy rejection and text-only rename"`

After each corresponding GREEN only, run the broader command declared in 43-12-PLAN.md.

### Plan 43-13

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/lib/frameMap.test.ts -t "omits Loop Clip projection from the Motion Editor frame map"`

`pnpm --dir app exec vitest run src/components/timeline/TimelineInteraction.test.ts -t "ignores former Loop Clip coordinates and keys in the Motion Editor"`

After each corresponding GREEN only, run the broader command declared in 43-13-PLAN.md.

### Plan 43-14 specialized EFX/timeline residue and child-listener cleanup

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/components/timeline/TimelineCapsuleTooltip.test.ts -t "has no Motion Editor Loop Clip tooltip module after ownership removal"`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts -t "keeps only the integrated rail inside the unchanged physical row"`

`pnpm --dir app exec vitest run src/lib/physicPaintLoopOperationBridge.test.ts -t "routes Loop Clip operations locally without specialized child listeners"`

After each corresponding GREEN only, run the broader command declared in 43-14-PLAN.md.

### Plan 43-15 public transport cleanup

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts -t "exposes only generic Physics Paint transport after the local Loop Clip cutover"`

After GREEN only:

`pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts`

### Plan 43-15 full correction matrix

`pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/stores/physicPaintStore.rotoHoldComposite.test.ts src/components/physic-paint/hooks/useRotoTimelineModel.test.ts src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx src/components/physic-paint/view/PhysicsPaintLoopClipPopover.test.tsx src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.tsx src/lib/frameMap.test.ts src/components/timeline/TimelineRenderer.test.ts src/components/timeline/TimelineInteraction.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts src/lib/exportEngine.loops.test.ts src/lib/previewRenderer.loops.test.ts`

Then, on the final correction state:

1. `pnpm --dir app exec vitest run`
2. `pnpm --dir app run typecheck`
3. `pnpm build`
4. `git diff --quiet $(git log --format="%H" --grep="(43-01)" | tail -1)^ HEAD -- app/package.json pnpm-lock.yaml`

All four must exit 0. Record actual outputs in `43-UAT.md`; do not fabricate test counts or build sizes.

## Native-Only Verification

The rewritten `43-UAT.md` is the executable oracle. It covers:

- the nine tracer checks;
- normal, selected, focus, truncation, unresolved, busy, rejected, and 0f rail states;
- tooltip/sidebar/popover copy and accessibility;
- Duplicate/Repair/Relink/Unlink/Delete accepted-only behavior and Undo/Redo;
- physical-cell guards/materialization/linked indicators;
- save/reopen, unresolved placeholder/export block, valid PNG parity, Infinity, truncation/re-expansion;
- unsigned packaged smoke without signing-material access.

No native result is pre-approved. The old Step 1 failure remains historical evidence only.

## Sign-Off Conditions

- [ ] Plan 43-11 RED and GREEN commits exist in order.
- [ ] All nine tracer checks are approved together by the user.
- [ ] Plans 43-12 through 43-15 focused commands pass, with one exact named RED/GREEN sentinel per TDD task.
- [ ] Full Vitest, typecheck, build, and dependency-diff gates pass on the final correction state.
- [ ] Plans 43-01 through 43-09 remain byte-identical; 43-10 contains only the bounded corrected-checkpoint revision.
- [ ] `43-UAT.md` records automated evidence separately, requires summaries through 43-15, and leaves native results pending.
- [ ] Plan 43-10 Task 2 resumes as the sole human checkpoint and executes only the current corrected 43-UAT.md.

**Approval:** pending user native UAT.
