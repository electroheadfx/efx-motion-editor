---
quick: 260715-kgf
plan: 04
type: gap-closure-validation
status: ready
gap_ids:
  - G-260715-kgf-1
  - G-260715-kgf-2
  - G-260715-kgf-3
---

# Quick 260715-kgf Plan 04 Validation Architecture

## Validation Objective

Prove that gap-closure Plan 04 repairs the mounted Physics Paint Roto Copy Script / Apply Script workflow without changing the accepted cooperative engine, history, timing, persistence, or Phase 36.14 presentation boundaries. Automation establishes `automated-ready / awaiting native UAT`; it does not complete the quick.

## Plan Task and Gap Coverage

| Plan 04 task | Gap coverage | Concrete automated checks | Primary test ownership |
|---|---|---|---|
| Task 1 — Preserve the copied script across mounted launch traffic with stable provenance | `G-260715-kgf-1`, `G-260715-kgf-2` | Copy on a valid real source, navigate to an eligible empty frame, deliver frame-sync and same-session launch echoes, and assert clipboard identity/count/provenance and Apply eligibility remain intact. Deliver delayed stored context, refocus, same-size update, and a different-layer context using the same numeric frame; assert none can refresh, clear, or rebind the immutable clipboard. Return to the exact mounted-session/layer/source binding and assert accepted source changes refresh it. Make that exact source empty and assert clear. Dispose the controller and assert session state clears. | `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts`; `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts`; mounted proof in `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` |
| Task 2 — Claim the selected absolute empty frame without an Insert-style key transaction | `G-260715-kgf-3` plus preservation checks for `G-260715-kgf-1` | Assert the accepted target is exactly `sourceFrame === displayFrame === selectedFrame`; occupancy and publication begin only after first acceptance. Assert no Insert path, `frameMappings`, neighboring shift, duplicate target, selected-frame-plus-one target, or foreign publication identity. Assert zero acceptance leaves the selection empty, later failure retains accepted partial work at the selected identity, generated targets reject, and existing painted real keys remain additive. | `app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts`; `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts`; controller and mounted proofs in `physicsPaintRotoScriptClipboard.test.ts` and `PhysicsPaintStudio.test.ts`; durable publication proof in `app/src/lib/physicPaintRotoDurableCore.test.ts` |
| Task 3 — Lock diagnosed behavior and rerun release gates | `G-260715-kgf-1`, `G-260715-kgf-2`, `G-260715-kgf-3` | Run the focused suites after each corresponding production task, then the combined focused matrix. Only after all production repairs and focused checks pass, run the Physics Paint subtree, two consecutive full app suites, app typecheck, package check/build, root build, and diff check. Verify the quick summary names all three gaps and remains `automated-ready / awaiting native UAT`. | All focused files below plus the existing Physics Paint subtree and full app suite |

### Gap-to-Check Index

| Gap ID | Required proof |
|---|---|
| `G-260715-kgf-1` | Mounted Copy → navigation → frame-sync/same-session launch echo retains clipboard and enables Apply on the eligible empty selection; empty Apply then targets that selected absolute frame. |
| `G-260715-kgf-2` | Clipboard lifetime is tied to the mounted controller session and exact session/layer/source provenance, not routine launch traffic or numeric frame equality; exact bound-source empty and disposal are the clearing boundaries. |
| `G-260715-kgf-3` | First accepted replay brush claims and publishes only the selected absolute frame without Insert-style metadata mutation; zero acceptance, partial failure, generated rejection, and existing-key additivity follow the corrected contract. |

## Explicit Behavior Matrix

| ID | Scenario | Automated setup/action | Required assertions | Test owner |
|---|---|---|---|---|
| B1 | Copy → navigation → frame-sync/same-session launch echo | Copy a non-empty immutable script from a valid real source; navigate to a true empty/free selected frame; deliver both navigation context and equivalent launch/frame-sync echo while Studio remains mounted. | The same clipboard payload, copied count, and bound provenance remain; Apply is eligible on the empty selection; no routine context calls the disposal clear boundary. | Clipboard controller, launch integration, Studio |
| B2 | Delayed stored context | Establish clipboard, navigate, then deliver the previously stored launch context after the current emitted context. | Clipboard content and provenance remain immutable; delayed delivery cannot refresh, clear, retarget, or invalidate Apply eligibility solely because its frame number matches. | Launch integration, clipboard controller |
| B3 | Refocus and same-size update | Deliver equivalent same-window refocus and same-size context updates after Copy. | Clipboard object/content/count remain stable; no destructive replacement lifecycle runs. | Launch integration |
| B4 | Different layer with same numeric frame | Bind clipboard to layer A/frame N, then deliver layer B/frame N and source updates from B. | Layer B cannot refresh or clear layer A's clipboard; provenance remains session + layer A + source N. | Clipboard controller, launch integration |
| B5 | Return to bound source | Navigate away, mutate the exact bound source through accepted completion/Undo/Redo semantics as applicable, then return to its layer/source. | Clipboard resumes source-bound refresh from the exact source and remains an immutable deep snapshot. | Clipboard controller, Studio baseline |
| B6 | Bound-source empty and disposal | Observe the exact bound source with no logical brushes; separately dispose the mounted controller after accepted work settles. | Exact bound-source empty clears clipboard; disposal clears session clipboard/state. Foreign empty sources and routine launch traffic do not clear it. | Clipboard controller |
| B7 | Empty Apply first acceptance | Start Apply on selected absolute empty frame S with at least one accepted replay brush. | Before acceptance the cell remains empty. On first acceptance, target identity is exactly `sourceFrame: S`, `displayFrame: S`; normal edit ownership starts and accepted pixels belong to S. | Clipboard controller, key transaction, Studio |
| B8 | No Insert-style timeline mutation | Apply to empty S with neighboring real keys and Phase 36.13 spacing/custom overrides present. | No Insert command, generic save/upsert target, `frameMappings`, neighbor shift, duplicate source, S+1 target, or extra target occurs; neighboring identities and spacing remain unchanged. | Key transaction, source-display model, durable core |
| B9 | Zero acceptance | Cause replay submission to accept zero brushes. | No ownership, cache/timeline publication, real-key occupancy, or target identity is published; selected frame remains truly empty. | Clipboard controller, Studio |
| B10 | Partial failure | Accept one or more brushes, then fail a later enqueue. | Accepted partial paint remains at selected identity and independently Undoable/Redoable; operation reports failure rather than full success; no unaccepted work is published. | Clipboard controller, Studio and existing engine history baselines |
| B11 | Generated rejection | Attempt Apply on a generated interpolation display. | Apply remains rejected/render-only and cannot promote, mutate, or publish generated ownership. | Clipboard controller, source-display model |
| B12 | Existing real-key additivity | Apply to an existing painted real key with cached alpha base and live overlay. | Existing pixels remain and replay is additive; no clear/replacement transaction occurs. | Clipboard controller, Studio, live cache baseline |
| B13 | Cache/timeline/parent identity | Complete accepted empty-target replay at selected S and allow normal asynchronous publication to settle. | Cache/store timeline occupancy and parent payload all use captured S for source/display identity, independent of later navigation. | Studio, durable core, live cache baselines |
| B14 | Reopen/preview/export identity | Reopen or reload the accepted target and inspect preview/export-facing durable identity. | Reopen, preview, and export resolve the accepted paint at S only; no S+1 or foreign identity appears. | Studio, durable core, existing persistence tests |
| B15 | Phase 36.13 spacing invariants | Seed distant/custom key positions and interpolation settings around selected S, then Apply. | Existing absolute key positions, generated ownership, interpolation count/spacing overrides, and source/display projection remain unchanged except selected S becoming occupied after acceptance. | `rotoSourceDisplayModel.test.ts`, `rotoKeyTransactions.test.ts`, durable core |

## Wave 0 and Test Ownership

Plan 04 is production-first. No failing test scaffold may delay or replace the mounted production repairs in Tasks 1–2. The validation ownership below is the Wave 0 architecture inventory: it identifies where new cases belong before execution, while the cases themselves are finalized immediately after their corresponding production task and run before moving onward.

### New or Expanded Focused Ownership

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts`
  - Clipboard immutability, mounted session/layer/source provenance, navigation freeze, exact-source refresh/clear, disposal, empty-target acceptance, zero acceptance, partial failure, generated rejection, and real-key additivity.
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts`
  - Navigation echo, delayed stored context, same-window refocus, same-size update, cross-layer delivery, and preservation across mounted context changes.
- `app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts`
  - Pure selected-frame claim identity and absence of key upsert/remap/neighbor mutation.
- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts`
  - Phase 36.13 absolute source/display positions, distant/custom spacing, generated ownership, and unchanged mappings.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
  - Mounted Apply eligibility, first-accept ownership, captured cache/timeline/parent identity, additivity, and integration-boundary behavior.
- `app/src/lib/physicPaintRotoDurableCore.test.ts`
  - Durable selected-frame identity across persistence, reopen, preview, and export-facing flows without extra target creation.

### Existing Immutable Baseline Files

- `packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts`
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts`
- `packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts`
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts`
- `app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts`
- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts`
- `app/src/components/physic-paint/roto/rotoTimelineSelectors.test.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`

These baselines preserve cooperative finalization, queued outlines, per-brush Undo/Redo and Redo invalidation, deterministic Motion, generated-frame ownership, cached-base/live-overlay additivity, latest-write-wins persistence, and Phase 36.13 source/display spacing.

## Production-First Execution and Sampling Continuity

1. Implement Task 1 in production before expanding its regression cases.
2. Run Task 1's focused command immediately after its production repair. Do not continue if it fails.
3. Implement Task 2 in production before expanding its regression cases.
4. Run Task 2's focused command immediately after its production repair. Do not continue if it fails.
5. Add or finalize Task 3's focused behavior matrix against the mounted production path, then run the combined focused command.
6. Only after Tasks 1–2 production work and all focused checks pass, run the entire Physics Paint subtree.
7. Only after the subtree passes, run the full app suite twice consecutively.
8. Only after both full suites pass, run app typecheck, Physics Paint package check/build, root build, and diff check.
9. Record exact results in the English quick summary as `automated-ready / awaiting native UAT`.

This ordering preserves sampling continuity: each production slice receives an immediate focused signal, while broad regression gates sample the complete integrated repair only after all focused behavior is green.

## Exact Commands

### Task 1 Focused Check

```sh
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts -x
```

### Task 2 Focused Check

```sh
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/roto/rotoKeyTransactions.test.ts src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/lib/physicPaintRotoDurableCore.test.ts -x
```

### Combined Plan 04 Focused Matrix

```sh
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts src/components/physic-paint/roto/rotoKeyTransactions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/lib/physicPaintRotoDurableCore.test.ts -x
```

### Physics Paint Subtree

```sh
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint src/lib/physicPaintRotoDurableCore.test.ts
```

### Two Consecutive Full App Suites

```sh
pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor exec vitest run
```

### App Typecheck, Package Check/Build, Root Build, and Diff Check

```sh
pnpm --filter efx-motion-editor typecheck && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build && pnpm -C /Users/lmarques/Dev/efx-motion-editor build && git -C /Users/lmarques/Dev/efx-motion-editor diff --check
```

### Summary Status and Gap Evidence

```sh
grep -F "automated-ready / awaiting native UAT" /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-SUMMARY.md && grep -F "G-260715-kgf-1" /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-SUMMARY.md && grep -F "G-260715-kgf-2" /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-SUMMARY.md && grep -F "G-260715-kgf-3" /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-SUMMARY.md
```

## Execution Constraints

- Use the repository's existing pnpm workspace and Vitest configuration.
- Do not run a development server, preview server, or any watch process.
- Do not create a one-off Vitest or test configuration.
- Do not install packages.
- Do not use synchronous paint finalization to make tests pass.
- Keep Plan 04 within its existing under-15-file execution scope and do not add production files outside the listed repair seams.
- Preserve the Phase 36.14 UI boundary; this validation covers functional repair only.

## Completion Boundary

All automated checks must pass before resuming native testing. Native UAT remains required for the repaired Copy → navigation → empty Apply workflow, clipboard reuse/lifetime, direct selected-frame ownership, partial/zero acceptance, generated rejection, existing-key additivity, and visible timeline/reopen/preview/export behavior. Automation alone must not mark quick 260715-kgf complete.
