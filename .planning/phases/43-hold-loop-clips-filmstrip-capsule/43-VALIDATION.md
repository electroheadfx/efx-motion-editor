---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-06
revised: 2026-08-08
revision_reason: validate rail-owned multi-capsule spacing, selection exclusivity, cumulative ripple, atomic placement history, unchanged interpolation, and Play Script background parity
---

# Phase 43 — Validation Strategy

> Canonical validation map for the current Phase 43 branch. Plans 43-01 through 43-09 remain accepted automated substrate; 43-10 remains the sole native checkpoint with only its bounded stale-checkpoint correction; correction Plans 43-11 through 43-15 replace the rejected lane/capsule/main-timeline presentation. The user approved the complete native matrix on 2026-08-08.

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
| 8 | 43-11 integrated rail/sidebar plus recovery production tracer | Named RED→GREEN ownership, creation, rail-selection, ordered-ripple, atomic coordinator/history, and background sentinels, then one blocking-human checkpoint covering all nine ownership checks plus Issue #0 and the corrected Issue #2 matrix |
| 9 | 43-12 rail/popover/sidebar state expansion | Cannot begin until 43-11 native approval; each TDD task uses one exact named sentinel |
| 10 | 43-13 passive-marker cutover and interaction removal | Retains minimal interval projection/paint while removing rich capsule types/rendering and every Loop Clip-specific input/tooltip route after the complete EFX replacement is green |
| 11 | 43-14 specialized EFX residue and child-listener cleanup | Deletes stale tooltip/geometry/lane/style residue and removes specialized child listeners |
| 12 | 43-15 public transport cleanup and full evidence | Removes specialized protocol after all callers are gone; runs the full matrix and updates UAT evidence |
| 13 | 43-10 Task 2 | Sole final native UAT checkpoint; executes only the current corrected 43-UAT.md |

## Nine-Check Tracer Gate — Plan 43-11

| # | Required observable | Automated evidence | Native evidence | Status |
|---|---|---|---|---|
| 1 | No extra row/height: strip 161px, physical row 38px, no canvas jump | WorkflowStrip/CSS contract | User measures loop and no-loop fixtures | pass |
| 2 | No cell or toolbar clipping | cell/toolbar geometry and event regressions | User inspects cells, outlines, drag feedback, 34px toolbar | pass |
| 3 | Conditional rail: 3px visible, 12px target, no-loop DOM absent | Rail/WorkflowStrip component tests | User verifies both fixtures | pass |
| 4 | Tooltip above rail with name, Cycle, Effective, status | presentation/rail tooltip tests | User hovers after existing delay | pass |
| 5 | Single click selects the loop line only; no source frame becomes selected | rail/workflow integration tests assert no playhead/cell/multi-select/drag dispatch and no rail-derived frame class, `aria-selected`, or selected-source tooltip | User confirms only the 3px rail changes appearance while Key Spacing still uses the complete cycle | pass |
| 6 | Double-click and Enter open Edit Loop Clip exactly once | action-call count and popover suppression tests | User performs both routes | pass |
| 7 | Scripts Play→Edit swap plus seven facts | ScriptsPanel tests | User checks normal script and selected loop contexts | pass |
| 8 | Blue linked indicators preserved | WorkflowStrip CSS/source behavior tests | User checks normal/current/selected/drag states | pass |
| 9 | Passive Motion Editor marker only | frame-map/renderer tests prove `{startFrame, frameCount, mode}` only, exact purple/cyan 3px PPaint FX-bar paint, and white actual endpoint cuts; interaction/canvas tests prove no Loop Clip-specific hit, tooltip, hover/focus, keyboard, navigation, Edit, drag, context menu, or mutation | User confirms marker visibility/geometry and absence of Loop Clip-specific interaction | pass |

The user approved every tracer row together on 2026-08-08, including Issue #0 plus the corrected Issue #2 matrix: plain/range/toggle rail selection of complete cycles; mutually exclusive physical selection; exact Select All scope; partial physical spacing within one cycle only; multi-cycle physical rejection with Loop Rail guidance; selected cycles processed left-to-right with cumulative ripple; source-attached placement follow; Interpolation Off/On preserved unchanged; generated/gap/unresolved navigation-only behavior; no drag/materialization/persisted scope; atomic records-plus-Loop-Clips rollback/history; fresh/existing Play Script background parity; line-only rail selection; and the accepted three-state repeat-zone presentation.

## Covered UI Consideration Map

All 40 covered rows from `43-UI-SPEC.md` are mandatory; the 8 dismissed rows remain legitimate exclusions.

| Surface | Covered states | Plan / verification |
|---|---|---|
| S1 Integrated Loop Rail | empty, loading, error, populated, partial, overflow, zero-one-many | 43-11/43-12 rail, presentation, CSS, and native tracer |
| S1a Rail tooltip | overflow, long-text | 43-11/43-12 tooltip placement/copy/accessibility tests |
| S1b Local actions popover | loading, error, populated, partial, overflow, zero-one-many, long-text | 43-12 popover/controller/history tests |
| S1c Contextual Scripts sidebar | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | 43-11/43-12 ScriptsPanel tests and native tracer |
| S2 Edit Loop Clip modal | loading, error, partial, overflow, long-text | 43-12 existing modal regression suite |
| S5 Linked physical-cell indicator | empty, populated | WorkflowStrip/LoopClipRail render regressions prove darkest repeat, lighter mirrored-key rhythm, distinct slate selected mirror with no orange duplicate ring, plus unchanged selection/drag behavior |
| S7 Key Spacing selection modes | empty, loading, error, populated, partial, zero-one-many | spacing-selection/Studio/rail/action/resolver/coordinator/history focused tests plus Issue #2 native matrix |
| M1 Motion Editor passive marker | populated, overflow, zero-one-many | 43-11 marker-visible tracer; 43-13 paint-only mode projection, endpoint painter, viewport clipping, and zero-interaction contracts; native tracer |

## Requirement and Decision Coverage

| Requirement | Correction verification |
|---|---|
| HOLD-01 | 43-15 reruns complete static/hold stroke-set tests |
| HOLD-02 | 43-15 reruns deterministic regeneration/save-reopen tests |
| HOLD-03 | Recovery matrix covers cancellation/failure/transport/settlement rollback, complete records-plus-Loop-Clips Undo/Redo, first-document Play Script creation, and current-frame reconciliation |
| HOLD-04 | Recovery matrix reruns one-raster composite plus accepted Play Script background parity in main Studio, preview, export, and save/reopen |
| HOLD-05 | D-57 replaces D-50 selection/movement with rail-owned complete cycles, exact one-cycle physical scope, cumulative ripple, source-attached placement follow, unchanged Interpolation, and atomic history; D-56 retains every-Apply Loop Clip creation; focused/full suites rerun persistence, boundary, guards, timed repeat, unresolved, and parity |
| HOLD-06 | 43-11/12 integrated rail/tooltip/sidebar/popover plus passive main-timeline marker tracer; 43-13 interval-only marker cutover and zero-interaction removal; 43-14 obsolete rich residue/listener cleanup with passive marker protection; native checks in rewritten UAT |

Decision groups:

- D-01 through D-14: existing Loop/Source Edit, Link/Create, unlink-only deletion, placement/source identity, guards, materialization, loop priority, and atomic history are rerun in 43-12/43-15.
- D-15 through D-23: retained status/copy/accessibility/truncation/unresolved/zero-effective semantics move to the rail/tooltip/sidebar/popover; superseded persistent filmstrip details are removed in 43-14.
- D-24 through D-32: resolver algebra, dynamic parent end, preview/export parity, additive persistence, derived Effective duration, verbatim unresolved references, and lazy modulo remain unchanged and are rerun in 43-15.
- D-33R through D-49: mapped directly to Plans 43-11 through 43-15 and the nine-check gate above.
- D-50: superseded by D-57. Retain only its source-key timing, exact linked-position provenance, fail-closed validation, and non-materialization guarantees.
- D-51: superseded by D-56 after Progressive Repeat-1 native UAT exposed the remaining missing-rail threshold.
- D-56: mapped to the Progressive and Static/Hold Repeat-1 controller RED→GREEN sentinels plus Issue #0 native checks. Every Apply persists one Loop Clip in the same atomic generation commit; Repeat controls duration only.
- D-52: mapped to the Loop Rail RED→GREEN tests and Issue #0 native check. Progressive purple / Static-Hold cyan rails, orange selection, actual start/end cuts, matching cell borders, viewport-clipping guards, and tooltip mode copy are required together.
- D-53: mapped to `frameMap.test.ts` and `TimelineRenderer.test.ts`. The main marker carries only start/count/mode, paints purple/cyan with white actual endpoint cuts, and remains textless and non-interactive.
- D-54: mapped to `PhysicsPaintPlayScriptDialog.test.ts`, ScriptsPanel/Studio source contracts, and native Custom-color palette UAT. No backdrop, pointer pass-through outside the card, draggable surface pointer ownership, no Tab trap, and focused Escape/Enter containment are required together.
- D-55: mapped to the PhysicsPaintStudio coordinator source sentinel and native empty-start generation check. Accepted `play-script` settlement must call current-frame reconciliation immediately.
- D-57: mapped to `physicsPaintRotoSpacingSelection.test.ts`, `PhysicsPaintStudio.test.ts`, `PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintWorkflowStrip.test.ts`, `useRotoTimelineActions.test.ts`, `physicsPaintRotoLoopGuards.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, and `physicsPaintRotoLoopHistory.test.ts`. The matrix covers rail plain/range/toggle selection, line-only rail presentation with no rail-derived frame selection, visible explicit physical same-cycle proxy selection, mutual exclusion, exact Select All, same-cycle physical partial scope, multi-cycle rejection, cumulative ripple, placement follow, unchanged interpolation, rollback, and one history command.
- D-58: mapped to Play Script controller/hook/coordinator tests, strict payload guards, fresh-layer bridge acceptance, and preview/export background composites. Valid Play Script background is required; ordinary physical injection is rejected.
- D-41 horizontal placement drag is excluded; only compatible non-capturing pointer geometry is reserved.

## Focused Automated Commands

### Plan 43-11

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx -t "integrates Loop Clip ownership through all nine tracer checks"`

Issue #0 RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts -t "persists a repeat-1 Progressive cycle as a Loop Clip so its 15-frame purple rail is visible"`

`pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts -t "persists a repeat-1 Static / Hold cycle as a Loop Clip so its 10-frame capsule is visible"`

`pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts -t "accepts the first Progressive Play Script and Loop Clip on a fresh layer"`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx -t "uses a cyan Static/Hold rail theme with visible cuts at both capsule endpoints"`

`pnpm --dir app exec vitest run src/lib/frameMap.test.ts src/components/timeline/TimelineRenderer.test.ts`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts -t "renders a non-modal floating surface with no blocking backdrop"`

Recovery RED and GREEN use the same focused command:

`pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoSpacingSelection.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/lib/physicPaintBridge.test.ts src/types/physicPaint.test.ts src/lib/previewRenderer.loops.test.ts src/lib/exportEngine.loops.test.ts`

This command must prove the complete rail-selection, physical-selection, ripple, placement, coordinator/history, background payload, and composite contract before broader verification.

### Plan 43-12

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts -t "projects exhaustive rail states without changing accepted geometry"`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintLoopClipPopover.test.tsx -t "keeps rejected local actions open and restores accepted focus deterministically"`

`pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.tsx -t "preserves contextual loop facts through busy rejection and text-only rename"`

After each corresponding GREEN only, run the broader command declared in 43-12-PLAN.md.

### Plan 43-13

RED and GREEN, byte-for-byte identical:

`pnpm --dir app exec vitest run src/lib/frameMap.test.ts -t "projects only passive Loop Clip intervals to the Motion Editor frame map"`

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

`pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoSpacingSelection.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/lib/physicPaintBridge.test.ts src/types/physicPaint.test.ts src/lib/previewRenderer.loops.test.ts src/lib/exportEngine.loops.test.ts`

Then, on the final correction state:

1. `pnpm --dir app exec vitest run`
2. `pnpm --dir app run typecheck`
3. `pnpm build`
4. `git diff --quiet $(git log --format="%H" --grep="(43-01)" | tail -1)^ HEAD -- app/package.json pnpm-lock.yaml`

All four must exit 0. Record actual outputs in `43-UAT.md`; do not fabricate test counts or build sizes.

## Native-Only Verification

The rewritten `43-UAT.md` is the executable oracle. It covers:

- the nine tracer checks;
- Issue #1 playback confirmation as a separate native result;
- Issue #2 rail-owned Key Spacing: plain/range/toggle complete-cycle selection, physical/rail mutual exclusion, exact Select All, one-cycle physical partial scope, cross-cycle physical rejection, cumulative ripple, source-attached placement follow, unchanged Interpolation, generated/gap/unresolved navigation-only behavior, no drag/materialization/persisted scope, one atomic records-plus-Loop-Clips commit, and Undo/Redo;
- first and later Play Script background parity across Physics Paint, main Studio, preview, export, and save/reopen;
- normal, selected, focus, truncation, unresolved, busy, rejected, and 0f rail states;
- tooltip/sidebar/popover copy and accessibility;
- exact passive Motion Editor marker geometry/color/data minimization plus zero Loop Clip-specific interaction;
- Duplicate/Repair/Relink/Unlink/Delete accepted-only behavior and Undo/Redo;
- physical-cell guards/materialization/linked indicators;
- save/reopen, unresolved placeholder/export block, valid PNG parity, Infinity, truncation/re-expansion;
- unsigned packaged smoke without signing-material access.

All native results were explicitly approved by the user on 2026-08-08. The old Step 1 failure remains historical evidence only.

## Sign-Off Conditions

- [ ] Plan 43-11 RED and GREEN commits exist in order.
- [x] All nine tracer checks are approved together by the user.
- [x] The same checkpoint records separate Issue #1 playback confirmation and passes the corrected Issue #2 rail-owned Key Spacing plus Play Script background native matrix; no later checkpoint is created.
- [ ] Plans 43-12 through 43-15 focused commands pass, with one exact named RED/GREEN sentinel per TDD task.
- [x] Full Vitest, typecheck, build, and dependency-diff gates pass on the final correction state.
- [x] Plans 43-01 through 43-09 remain byte-identical; 43-10 contains only the bounded corrected-checkpoint revision.
- [x] `43-UAT.md` records automated evidence separately and records the explicit complete native approval; plan summaries remain plan-close records rather than acceptance evidence.
- [x] Plan 43-10 Task 2 executed the current corrected `43-UAT.md` as the sole human checkpoint.

**Approval:** user approved all Phase 43 native UAT on 2026-08-08. Commit-dependent RED/GREEN and plan-summary sign-offs remain pending.
