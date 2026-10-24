---
phase: quick-261024-vga
verified: 2026-10-24T22:13:26Z
status: human_needed
score: 10/12 must-haves verified
covered_files: [".planning/quick/261024-vga-stack-order-control-for-brush-move-and-w/261024-vga-PLAN.md", ".planning/quick/261024-vga-stack-order-control-for-brush-move-and-w/261024-vga-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts", "app/src/components/physic-paint/view/brushScriptEditionPort.ts", "app/src/components/physic-paint/view/stackOrder.ts", "app/src/components/physic-paint/view/strokeSettingsModel.ts", "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts", "packages/efx-physic-paint/src/engine/stackOrder.ts"]
covered_digest: "v3:sha256:80f2182d362bbe47ff87763f859a0fe28353acf089d0e21698e9e2a2021b42db"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Every Stack commit attempt (accepted or refused) re-keys the `Stack position` SliderStepper so Preact remounts the input at the live stackPosition; the typed text never survives a refusal and never feeds the next +/- step."
    test: "In Brush Move and Water color Select, type a different position and press Enter on a commit that is refused (physical lock, or an in-flight watercolor re-bake). Then type into the same field again and press +/-."
    expected: "After the refused commit the input snaps back to the live position and stays editable at that value; the next +/- step starts from the live position, never from the typed text."
    why_human: "The unit harness (strokeSettingsModel.test.ts) invokes the dialog as a plain function and can only observe the vnode key and the value prop; the actual DOM input rewrite on a keyed Preact remount is framework runtime behaviour no project test exercises."
  - truth: "The watercolor Studio handler performs one placement as exactly one in-memory edit plus one awaited re-bake: sheet reset, await applyAquarelleTimeline, record ONE aquarelle-script edit on success, undo-restore the previous order plus a refusal message on failure, and clear the in-flight flag in finally."
    test: "In Water color Select, place a stroke with the Stack control (accepted and then with a forced re-bake failure / physical lock), then Undo and Redo."
    expected: "Accepted: the sheet re-bakes once in the new order and Undo/Redo move through exactly one script edit each way. Failure/lock: the order is restored, the refusal capsule/message shows, no edit is recorded, and the control is usable again (in-flight cleared)."
    why_human: "PhysicsPaintStudio.test.ts pins the handler source order and guards statically; the async apply/rollback/in-flight transition is orchestration no runtime test exercises (the Studio test file reads source as a string)."
human_verification:
  - test: "Brush: one stroke selected in Move — compare the Stack dot/#serial/position with the Move badge; check Above/Below and their em dashes at the stack edges."
    expected: "Position law matches the badge (1 = topmost); Above/Below name the correct neighbours and show an em dash at the ends."
    why_human: "Visible parity with the overlay badge and dialog chrome is a native rendering check."
  - test: "Brush: type 1 then stackTotal into Position (1 = top); commit the current position once."
    expected: "Stroke moves to top then bottom; badge and Above/Below update; exactly one re-bake per commit; committing the current position changes nothing."
    why_human: "Requires live paint re-bake and the real SliderStepper Enter/blur path."
  - test: "Water color: same Stack section; type 1 then stackTotal."
    expected: "The sheet re-bakes in the new order and badges/Above/Below update."
    why_human: "Requires the live aquarelle re-bake pipeline."
  - test: "Water color: Undo then Redo after one placement; then trigger a refused placement (in-flight/lock) and a rapid Top-then-Bottom."
    expected: "Undo/Redo move exactly one script edit each way; a refused placement leaves the readout and control at the live order (typed value never persists or feeds the next step); the second rapid commit is refused cleanly and the control settles on the real order."
    why_human: "Async re-bake, rollback, in-flight guard and DOM remount can only be observed natively."
  - test: "Both modules: select 2+ strokes; then use '<' / '>' with a single stroke."
    expected: "Stack section shows only the hint 'Select one stroke to change stack order' with disabled Top/Bottom; '<' / '>' still step one stroke and Stack follows without changing the step behaviour."
    why_human: "Selection UI state and keyboard/UI parity are native interactions."
  - test: "Both modules: save the project, reopen it."
    expected: "The placed order persists and matches the badges/Stack readouts after reopen."
    why_human: "Round-trip persistence through the packaged app cannot be proven by the targeted unit suites."
  - test: "Both modules: hold the physical mutation lock and attempt a placement."
    expected: "Placement is refused, the order is unchanged, and the Stack position readout snaps back to the live position instead of keeping the typed text."
    why_human: "Physical lock and DOM snap-back are native runtime behaviours."
---

# Quick 261024-vga: Stack-order control for Brush Move and Water color Select — Verification Report

**Goal:** Exact paint-order placement for the selected stroke from the shared Stroke Settings dialog (Brush Move + Water color Select), with one shared index law and thin adapters.

**Verified:** 2026-10-24T22:13:26Z
**Status:** human_needed (automated gates all green; native UAT pending and deliberately not claimed)
**Mode:** Initial verification (no prior VERIFICATION.md in the task directory)

## Must-Haves

| # | Must-have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | One stack-position implementation (`clampStackPosition`, `targetIndexForStackPosition`, `reorderForStackPosition`) with bottom->top arrays and position 1 = topmost; exported by the package; app-facing re-export; no adapter re-derives the math. | ✓ VERIFIED | `packages/efx-physic-paint/src/engine/stackOrder.ts:21,33,44` (readonly in/out, same-reference no-op); `packages/efx-physic-paint/src/index.ts:8-9`; `app/src/components/physic-paint/view/stackOrder.ts:8-13`. Repo-wide grep for `function reorderForStackPosition` finds exactly one implementation. Engine imports it at `EfxPaintEngine.ts:54`; watercolor at `aquarelleRecordState.ts:36`; dialog clamps with it at `PhysicsPaintStrokeSettingsDialog.tsx:390`. Truth table `stackOrder.test.ts:24-103` (7 tests). |
| 2 | Dialog Stack section renders between Geometry and Paint whenever `bundle.reorderStroke` exists: colour dot, `#serial`, `position/total`, release-commit `Position (1 = top)` stepper (min 1 / max stackTotal / step 1 / freeEntry / commitOnRelease, NO `allowOutOfRangeEntry`), Above/Below with em dashes, Top/Bottom; 2+ or an unlisted id renders the exact hint `Select one stroke to change stack order` with disabled Top/Bottom and no stepper. Only one hoisted `bundle.listStrokes` read. | ✓ VERIFIED | `PhysicsPaintStrokeSettingsDialog.tsx:365` (single `listStrokes` call, reused for selection box and Stack); `:377-385` single-stroke/neighbour resolution; `:686-762` section placement between Geometry (`:573-684`) and Paint (`:764`); `:709-720` stepper props (no `allowOutOfRangeEntry`); `:723-728` Above/Below em dash; `:732-734` hint; `:737-759` Top/Bottom disabled on `!stackStroke`. Behaviour pinned in `strokeSettingsModel.test.ts:1090-1322` (both modules, readouts, edges, props, disabled multi-select and missing-id cells). |
| 3 | Gesture discipline: a typed commit, +/- press, slider release, Top and Bottom each call `bundle.reorderStroke` at most once with the clamped position; the Enter+blur pair collapses to one call via the ref-held last-emitted value cleared on the next microtask; a later gesture is not swallowed; Top commits 1, Bottom stackTotal, Above is position-1/Below position+1 (readout only); committing the current position calls nothing. | ✓ VERIFIED | `PhysicsPaintStrokeSettingsDialog.tsx:387-403` (`clampStackPosition`, live-slot early return, `lastStackEmitRef`, `queueMicrotask` clear, single `void reorderStroke(...)`); Top `:743`, Bottom `:753-756`. Behavioural cells: `strokeSettingsModel.test.ts:1226-1268` (one call per distinct gesture, current-position no-call, coalescing then freed next microtask). |
| 4 | Every commit attempt re-syncs the control at the live `stackPosition`: refused commits never leave the typed text in the input nor feed the next +/- step; mechanism is the ref-held nonce signal bumped inside `commitStackPosition` plus the `Stack position` SliderStepper keyed by that nonce (Preact remount), with no useState and no render-body signal write. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mechanism present and wired: refs at `PhysicsPaintStrokeSettingsDialog.tsx:281-284`, nonce read at `:292`, bump at `:401`, keyed stepper at `:709-720`, no `useState`, only signal write inside the handler. Unit evidence is vnode-level only (`strokeSettingsModel.test.ts:1270-1310` reads `slider.key` and the mounted input vnode's value for both a `false` return and a `void` return; same-position cell `:1312-1322`). The actual DOM rewrite on remount is not exercised by any test → human verification. |
| 5 | Engine `moveStrokeToStackPosition` obeys the listing's group boundary (every points-bearing entry regardless of tool starts a row; zero-point continuations travel; a leading zero-point entry is pinned and not a row), reorders `strokeStack` through the shared law, applies the `stepStrokeInStack` commit contract (drain first, no undo checkpoint, redo cleared, history availability notified, composite dirty, redraw, render request, ONE `move` notification) and never touches `allActions`. | ✓ VERIFIED | `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:4059-4110` (group walk `:4074-4089`, reorder `:4093-4094`, materialize `:4098`, commit contract `:4100-4106`; no ledger/serial write). Behavioural suite `EfxPaintEngine.strokeReorder.test.ts:654-889` (12 cells: positions, ledger immutability, single notification/redo cleared/no new checkpoint, same-position no-op, clamping, continuation travel, erase-own-row, placeholder, pinned leading tail, save/load + undo/redo, tool/unknown refusals, drained finalization). |
| 6 | Brush adapter `placeBrushScriptStroke` is lock-gated, declares the edit base, calls the engine ONCE and flushes the frame ONCE only on `true`. | ✓ VERIFIED | `app/src/components/physic-paint/view/brushScriptEditionPort.ts:367-380`; engine interface member at `:66`. Behavioural cells `brushScriptEditionPort.test.ts:624-690` (accepted → one engine call + one `getStrokes` flush + edit base; refused → no flush, returns false; locked → no engine/base/flush; no context/engine → false). |
| 7 | Watercolor adapter `placeAquarelleStrokeInScript` collects same-frame non-dry entries, reorders via the shared helper, replaces entries at the same absolute indices, re-stamps `recordedOrder`/`engine.timestamp` across the travelled window in ascending order, updates `recordedStrokeEntries`+`recordedStrokes`, bumps the revision ONCE; dry and other-frame entries keep identity and index; refusals change nothing and bump nothing. | ✓ VERIFIED | `app/src/components/physic-paint/view/aquarelleRecordState.ts:790-841` (collection `:799-810`, shared reorder `:814-819`, window slots `:821-837`, single bump `:839`). Behavioural suite `aquarelleRecordState.reorder.test.ts:288-471` (position table, clamp, Dry/other-frame identity+index, slot monotonicity and field preservation, registry order + top-relative listing, exactly-one bump and refusal cells, deleted/absent refusals). |
| 8 | `beginAquarellePlaceEdit` mirrors `beginAquarelleReorderEdit`: clear drag, in-flight refusal, before snapshot, placement, after snapshot, one stored edit; undo/redo restore previous/new order and the selection is kept. | ✓ VERIFIED | `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:567-578`. Behavioural cell `aquarelleRecordState.reorder.test.ts:441-470` (undo/redo orders, selection kept, in-flight guard, single-stroke frame → null with no revision bump). |
| 9 | Both Studio dialog bundles carry `reorderStroke` and `handleAquarellePlaceStroke` is in the `strokeSettingsDialogPropsMemo` dependency list. | ✓ VERIFIED | `PhysicsPaintStudio.tsx:7411` (watercolor bundle), `:7427` (brush bundle via `placeBrushScriptStroke`), `:7393` (memo dependency), import at `:230`/`:256`. Structural pins `PhysicsPaintStudio.test.ts:4162-4174`; brush bundle verified by reading the source (no dedicated pin, wiring is literal). |
| 10 | `handleAquarellePlaceStroke` runtime orchestration mirrors `handleAquarelleStepStroke`: four peek-only guards, begin, in-flight set, sheet reset, await the shared apply, record on success, undo-restore + refusal message on failure, finally clears the in-flight flag. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Implementation present verbatim at `PhysicsPaintStudio.tsx:5978-6023`. Structural pins only (`PhysicsPaintStudio.test.ts:4126-4160`: ordered edit sites, four guards, `finally` clear, no engineRef/clipboard/applyCurrentScript). No runtime test exercises the async apply/rollback/in-flight transition → human verification. |
| 11 | Automated gates pass: package build; five named app suites; engine suite; app typecheck. | ✓ VERIFIED | Ran from the checkout root: `pnpm --dir packages/efx-physic-paint build` → ESM + DTS build success; `pnpm --dir app exec vitest run <5 files>` → 5 files, 376 tests passed; `pnpm --dir app exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.strokeReorder.test.ts` → 29 tests passed; `pnpm --dir app typecheck` → `tsc --noEmit`, exit 0. No watch mode, no server. |
| 12 | Guardrails: no `useState` added in the dialog; no render-body signal write; no new persisted field; no version bump; no change to '<' / '>'; no debug logs; the unrelated `WelcomeScreen.tsx` modification untouched and not in the three commits. | ✓ VERIFIED | Dialog imports only `useEffect, useRef` (`PhysicsPaintStrokeSettingsDialog.tsx:1`); the sole signal write is `stackSyncRef.current!.value += 1` at `:401` inside `commitStackPosition`; test also asserts `not.toContain('useState')`. `git diff --numstat 8d8bded5^..475a3816` shows pure additions for every production file (only deletions: the two hoisted `listStrokes` lines in the dialog and two authorized test-count pins); no package.json/manifest/schema file in the three commits; grep for `console.log`/`debugger` in changed files → none; `git diff 8d8bded5^..475a3816 -- app/src/components/project/WelcomeScreen.tsx` → 0 lines. `<`/`>` paths (`stepStrokeInStack`, `stepBrushScriptStroke`, `stepAquarelleStrokeInScript`) have zero deleted lines. |

**Score:** 10/12 must-haves verified; 2 present-but-behavior-unverified (rows 4 and 10).

## Behavioral Spot-Checks (gates)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Package exposes the new law through dist | `pnpm --dir packages/efx-physic-paint build` | ESM + DTS build success | ✓ PASS |
| App suites (stack law, dialog, port, watercolor record, Studio pins) | `pnpm --dir app exec vitest run src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/brushScriptEditionPort.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | 5 files, 376 tests passed | ✓ PASS |
| Engine exact-placement + existing reorder suite | `pnpm --dir app exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.strokeReorder.test.ts` | 29 tests passed | ✓ PASS |
| App typecheck | `pnpm --dir app typecheck` | `tsc --noEmit`, exit 0 | ✓ PASS |

## Probe Execution

No probes are declared by the plan and none are conventional for this UI/engine quick task. Not applicable.

## Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Dialog Stack commit | `bundle.reorderStroke` | `commitStackPosition` | ✓ WIRED | Single call per gesture, clamped (`PhysicsPaintStrokeSettingsDialog.tsx:387-403`). |
| Brush bundle | `placeBrushScriptStroke` | arrow member | ✓ WIRED | `PhysicsPaintStudio.tsx:7427`. |
| `placeBrushScriptStroke` | `engine.moveStrokeToStackPosition` → `strokeStack` reorder → flush → revision bump | port | ✓ WIRED | Port `:367-380`; `move` completion law marks the frame dirty (`brushScriptHydration.ts:213-228`, wired at `PhysicsPaintStudio.tsx:3576`), so the flush recaptures and `listBrushScriptStrokes` re-reads `brushScriptRevision` (`brushScriptEditionPort.ts:155`). Behaviourally exercised in the port suite. |
| Watercolor bundle | `handleAquarellePlaceStroke` | arrow member | ✓ WIRED | `PhysicsPaintStudio.tsx:7411`. |
| `handleAquarellePlaceStroke` | `beginAquarellePlaceEdit` → `placeAquarelleStrokeInScript` → revision bump → `applyAquarelleTimeline` → `recordAquarelleScriptEdit` | handler | ✓ WIRED (structural; runtime unverified) | `PhysicsPaintStudio.tsx:5978-6023`; record state `aquarelleRecordState.ts:790-841`; listing re-reads `aquarelleStrokesRevision` (`aquarelleStrokeSelection.ts:262`). |
| Both adapters | `stackOrder.reorderForStackPosition` | shared module | ✓ WIRED | `EfxPaintEngine.ts:4093`; `aquarelleRecordState.ts:814`; dialog clamps via `clampStackPosition`. No second index law exists. |
| Stack readout | `bundle.listStrokes` | single hoisted read | ✓ WIRED | `PhysicsPaintStrokeSettingsDialog.tsx:365`, used by both the selection box and the Stack section; no stroke-list state stored. |

## Requirements Coverage

The plan declares `requirements: []` (no roadmap requirement IDs for this quick task). No orphaned requirements.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER markers, no empty implementations, no debug logs, no skipped tests in the changed files (`EfxPaintEngine.strokeReorder.test.ts`, `stackOrder.test.ts`, `strokeSettingsModel.test.ts`, `brushScriptEditionPort.test.ts`, `aquarelleRecordState.reorder.test.ts`, `PhysicsPaintStudio.test.ts`). |

## Notes (non-gap deviations)

- The plan's illustrative engine cell claimed ledger `[A(paint), X(erase), B(paint)]` + `moveStrokeToStackPosition(A, 1)` → `[B, A, X]`. The executor implemented the locked law stated in the same plan/must-have (every points-bearing entry starts a row, position 1 = topmost) and pinned `[X, B, A]`; X remains its own row and A reads position 1. This is consistent with check #3 and is documented in the SUMMARY; not a gap.
- `strokeSettingsModel.test.ts`'s pre-existing `allowOutOfRangeEntry` count was deliberately re-scoped to `sliders.length - 1` (the plan explicitly authorized this because the Stack stepper clamps instead of bypassing range). The Stack cell asserts the prop is absent.
- Two pre-existing Studio count pins were raised (flush sites 5→6, refusal-mapper mentions 9→10) because the new path reuses the same flush and refusal surfaces. Test-only edits in the same commit.

## Human Verification Required

1. **Brush — Stack parity with the Move badge**
   Test: Select one stroke in Move; compare dot/#serial/position with the badge; check Above/Below at both edges.
   Expected: 1 = topmost; neighbours correct; em dash at the stack ends.
   Why human: visual parity with the overlay badge.

2. **Brush — exact placement and re-bake**
   Test: type 1, then stackTotal; separately commit the current position.
   Expected: top/bottom placement, badge/Above/Below update, one re-bake per commit, no-op on the current position.
   Why human: live paint re-bake and the real Enter/blur slider path.

3. **Water color — exact placement and re-bake**
   Test: same Stack section; type 1 then stackTotal.
   Expected: the sheet re-bakes in the new order and the badges/Above/Below follow.
   Why human: live aquarelle pipeline.

4. **Water color — one-edit undo/redo and refusals**
   Test: Undo/Redo one placement; force a refused placement (in-flight/lock); rapid Top then Bottom.
   Expected: one script edit each way; refused placement snaps back to the live order and never feeds the next step; the second rapid commit is refused cleanly.
   Why human: async apply/rollback/in-flight plus DOM remount.

5. **Both — multi-select disabled state and '<'/'>' parity**
   Test: select 2+ strokes; use '<'/'>' with one stroke.
   Expected: hint `Select one stroke to change stack order` with disabled Top/Bottom; stepping still works and Stack follows.
   Why human: native selection state and keyboard/UI parity.

6. **Both — save/reopen persistence**
   Test: save, reopen.
   Expected: the placed order persists and matches badges/readouts.
   Why human: packaged-app round trip.

7. **Both — physical lock refusal and snap-back**
   Test: hold the physical mutation lock and attempt a placement.
   Expected: refused, order unchanged, readout snaps back to the live position.
   Why human: physical lock and DOM snap-back are native runtime behaviours.

## Gaps Summary

None. Every automated must-have is verified against the actual codebase and every gate passes. Two must-have truths are mechanisms whose runtime effect (Preact remount rewriting the input DOM; the Studio's async apply/rollback/in-flight transition) is only statically/vnode-level evidenced; they are recorded above as behavior-unverified and folded into the native UAT rows. Native UAT is user-driven and is deliberately not claimed here.

---

_Verified: 2026-10-24T22:13:26Z_
_Verifier: Claude (gsd-verifier)_
