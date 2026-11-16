---
phase: quick/261116-qhm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/vectorPathLatches.ts
  - app/src/components/physic-paint/view/vectorPathLatches.test.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 90000
  raw_tokens: 45000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Entering path edit on an anchorless painted stroke writes the conversion immediately: the record for that stroke carries fitted anchors, the aquarelle-script ledger holds exactly ONE entry, and one undo restores the painted stroke.
    - The FIRST vertex drag after entry takes the Live rebake route and the paint updates before the gesture is released; every later drag behaves identically.
    - Entering and leaving path edit with no gesture keeps the conversion (the anchors stay on the record; no rollback, no second entry).
    - Entering path edit no longer forces wireframe or Draft on, and no ghost of the original spine is drawn; the stroke's anchors come from the record.
    - A session entered while the user's own wireframe or Draft is ON keeps today's deferred behaviour: every gesture records the script edit and marks the pixels dirty, and no bake runs.
    - A conversion that does not resolve an edit id opens no path edit and publishes the shipped path-edit refusal copy.
    - Lift strokes and degenerate strokes are still refused with their shipped copy; malformed anchors still fail closed.
    - The painted-curve module, its test, the path-edit exit hook, the held fit and the curve ghost are gone with no dangling import, and typecheck is clean.
  artifacts:
    - app/src/components/physic-paint/view/vectorPathCurveBracket.ts and its .test.ts do not exist
    - app/src/components/physic-paint/view/vectorPathFit.ts still exports fitVectorPathAnchors (KEPT)
    - PhysicsPaintStudio.tsx enterPaintedCurve fits the stroke's own samples and awaits the ONE writer before opening the latch
    - vectorPathLatches.ts exports no path-edit exit hook and exitPathEdit only writes the latch plus the selection
    - VectorPathOverlay.tsx resolves edit anchors from the record only (no held fit, no ghost polyline)
    - .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md records the three amended laws
  key_links:
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/view/vectorPathFit.ts
      via: fitVectorPathAnchors(stroke.points) in the entry
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: aquarellePathEditCommitRef.current(id, fitted) → the ONE writer's conversion write
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/view/vectorPathLatches.ts
      via: registerPaintedCurveEntrance(enterPaintedCurve) kept; the exit hook registration removed
    - from: app/src/components/physic-paint/engine/VectorPathOverlay.tsx
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: recorded anchors as the ONLY edit-target source after conversion
---

<objective>
Make entering path edit on an anchorless painted stroke exactly a vector edit session from entry: fit the stroke's own recorded samples, commit the conversion through the existing ONE writer at entry, then open the shipped path-edit latch only when that write resolved. Delete the now-dead painted-curve machinery (held fit, original-spine ghost, entry wireframe/Draft bracket, path-edit exit hook) and its pins.

Purpose: the first path-edit session of a painted stroke currently shows no pigment update while vertices are dragged, because the entry bracket forces the wireframe/Draft latches and every vertex commit therefore takes the deferred route; the only render is the exit settle. Committing at entry removes the entire differing code path instead of special-casing it.

Output: one atomic change set — the entry rewrite, the module/hook/ghost removal, the pin fallout — plus the quick's CONTEXT recording the three amended laws and the pre-fix reproduction evidence.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/view/vectorPathCurveBracket.ts
@app/src/components/physic-paint/view/vectorPathLatches.ts
@app/src/components/physic-paint/engine/VectorPathOverlay.tsx
@app/src/components/physic-paint/view/vectorPathFit.ts

## Amended laws (recorded in this quick's CONTEXT; historical phase artifacts are NOT edited)

- **D-03 is REVERSED for this entry.** The conversion commits ON ENTRY. Entering and leaving path edit without a gesture still leaves ONE undoable conversion. (Phase 62 recorded "entry holds, nothing commits".)
- **D-06's automatic wireframe on entry is REMOVED.** Entering a painted stroke's path edit no longer turns wireframe or Draft on.
- **D-14 now scopes to the MANUAL wireframe latch only.** A session entered while the user's own wireframe or Draft is ON keeps today's deferred behaviour. Nothing settles because a path edit closed.

## Why the entry is a plain vector session

`commitAquarelleVectorPathEdit` already owns the entire conversion: it detects the anchorless stroke, writes through `beginAquarellePathEdit` with `DEFAULT_VECTOR_PATH_CURVE_MODE`, bakes once, records exactly ONE `aquarelle-script` ledger entry on success, publishes its own failure copy and rolls back on failure. The entry therefore only needs to fit the stroke's own samples, hand them to that writer, and refuse to open the latch when it returns null.

## Verified reproduction chain at HEAD (evidence for Task 2)

1. `enterPaintedCurve` calls `beginPaintedCurveSession(stroke)` then `beginCurveWireframeBracket()` then `vectorPathSession.enterPathEdit(...)` (PhysicsPaintStudio.tsx:10385-10388).
2. `beginCurveWireframeBracket` (view/vectorPathCurveBracket.ts:173-184) captures the pre-entry view state and calls `setWireframeMode(true)`.
3. `setWireframeMode(true)` first calls `setDraftMode(true)` and then flips `wireframeMode` (view/scriptStrokeEdition.ts:235-237).
4. `commitAquarelleVectorPathEdit` reads `draftMode.peek()` and `wireframeMode.peek()` after the durable-base await and takes the `if (draft || wireframe)` deferred branch, which records the edit and marks the pixels dirty without baking (PhysicsPaintStudio.tsx:10406-10431).
5. The only re-render is the exit settle wired through `registerPathEditExitHook` → `endCurveBracket({ settle: settleDraftScript })` (PhysicsPaintStudio.tsx:11572-11581).

Nobody may launch the app in this run, so the temporary log proves the path only when the user runs the live UAT row; the source/test pin above is the deterministic, permanent equivalent.

## Design constraints (do not drift)

- The entry keeps its current position in the Studio body (before `commitAquarelleVectorPathEdit`) and reaches the writer through the existing `aquarellePathEditCommitRef` — the file's shipped TDZ convention (see `aquarelleAppearanceCommitRef` and the 261111-wd6 comment at the ref declaration). Do NOT reorder callbacks: every shipped region slice in `PhysicsPaintStudio.test.ts` must keep its exact boundaries.
- Fail closed on the writer's `null`, publishing only the existing copy: `DRAFT_ARM_REFUSAL_MESSAGE` for a refused arm, `PATH_EDIT_DEGENERATE_DISABLED_REASON` for fewer than two fitted anchors, `VECTOR_PATH_REJECTION_MESSAGE` for a null edit id — and the last one only when `scriptApplyRefusalOwnedRef.current` is false, so the writer's own, more specific failure copy is never overwritten.
- Re-read the recorded stroke after the durable-base await and re-require the `painted` verdict (the WR-03 precedent): a concurrent entry or another edit that converted the stroke ends this entry silently, with no refusal copy.
- The entry still arms the durable base FIRST (`await armDraftBase()`), preserving the shipped pre-edit base contract and its fixed refusal copy.

## Invariants that must survive (guardrails)

- The manual wireframe/Draft deferred route in `commitAquarelleVectorPathEdit` (record + dirty, no bake) is untouched.
- The settle remains single-flight (`settleDraftScript`) and the Draft leave-guard (`setDraftMode(false)` refusal while dirty or wireframe) is untouched.
- Capture, save, export, and undo/redo of a path edit are untouched; the conversion is an ordinary script edit with its ONE ledger entry.
- The eligibility/refusal law in `resolvePaintedCurveEligibility` / `admitsPathEditWrite` (lift, degenerate, malformed anchors) is untouched, and `view/vectorPathFit.ts` with `fitVectorPathAnchors` is KEPT.
- No engine math, payload, schema, anchors, hit-test or overlay selection/drag/commit change.

## Testing note

`tdd_mode` is on, but this is a live UI bug: the native fix is validated behaviourally first and the regression pins land in the SAME task, not as a RED-first sequence. No task therefore carries `tdd="true"`, and no tracer task is used — the surface is already proven and the first task is the thinnest possible path (a source-level reproduction).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Record the three amended laws in the quick's CONTEXT</name>
  <files>.planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md</files>
  <action>
Create the quick's CONTEXT file (discussion-phase was excluded for this run, so no CONTEXT exists). Follow the recent quick convention: a `# Quick Task 261116-qhm: ... - Context` heading, a `**Gathered:** 2026-11-16` / `**Status:** Ready for planning` line, then `<domain>`, `<decisions>`, `<specifics>` and `<canonical_refs>` sections.

`<decisions>` must record exactly these laws, in this order, and state that they amend the Phase 62 record for THIS entry without editing historical artifacts:
1. D-03 is REVERSED: the conversion now commits ON ENTRY through the existing ONE writer, so entering and leaving path edit with no gesture still leaves ONE undoable conversion.
2. D-06's automatic wireframe on entry is REMOVED: entering a painted stroke's path edit no longer turns wireframe or Draft on.
3. D-14 now scopes to the MANUAL wireframe latch only: a session entered while the user's own wireframe or Draft is ON keeps today's deferred behaviour, and closing a path edit no longer settles anything.
4. Fail-closed entry: path edit opens ONLY when the conversion resolves an edit id; a null resolution publishes the existing refusal copy and opens nothing.
5. Kept: `fitVectorPathAnchors`, the eligibility/refusal law (lift, degenerate, malformed anchors), the manual deferred route, the settle single-flight, the Draft leave-guard, capture/save/export and undo/redo of a path edit.

`<specifics>` should name the shipped writer (`commitAquarelleVectorPathEdit`, which detects the anchorless stroke, mints `DEFAULT_VECTOR_PATH_CURVE_MODE`, bakes once, records ONE ledger entry and rolls back on failure), the existing `aquarellePathEditCommitRef` route, and the entry's kept `armDraftBase` step.

`<canonical_refs>` should point at `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `view/vectorPathCurveBracket.ts` (deleted by this quick), `view/vectorPathLatches.ts`, `engine/VectorPathOverlay.tsx`, `view/vectorPathFit.ts` (kept) and `.planning/milestones/v2.1.0-phases/62-painted-stroke-curve-editing/62-CONTEXT.md` (historical, superseded here, not edited).

Do NOT edit any file under `.planning/phases/` or `.planning/milestones/`.
  </action>
  <verify>
    <automated>test -f .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md && grep -q "D-03 is REVERSED" .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md && grep -q "D-06" .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md && grep -q "D-14 now scopes to the MANUAL wireframe latch only" .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md</automated>
  </verify>
  <done>The quick's CONTEXT.md exists and carries the three amended laws, the fail-closed entry law and the kept-invariants list; no historical phase artifact was edited.</done>
</task>

<task type="auto">
  <name>Task 2: Reproduce the first-session deferred route at the source level</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <action>
No behaviour change in this task. Two additions only.

1. Add ONE temporary targeted log inside the deferred branch of `commitAquarelleVectorPathEdit` — the branch that begins `if (draft || wireframe) {`, after the two latch reads. Use `console.debug('[261116-qhm] path-edit deferred route', { mutationId, draft, wireframe })` so the quick id makes it trivially findable. This log is removed in Task 3 with the fix.

2. Add ONE test to the existing `describe('62-02 painted-curve entry and conversion admission in the Studio', ...)` block in PhysicsPaintStudio.test.ts, titled with the quick id so Task 3 can remove it: assert the closed chain that makes the FIRST session deferred. Using the describe's existing `regionOf`, `ENTER_START` and `COMMIT_START` helpers, read the entry region (`ENTER_START` to `COMMIT_START`) and the commit region (`COMMIT_START` to `const handleAquarelleVectorPathEdit = useCallback(`), plus the bracket module source read with `readFileSync(fileURLToPath(new URL('./view/vectorPathCurveBracket.ts', import.meta.url)), 'utf8')` (mirror the file-reading idiom already used by the entry's neighbours in that file). Assert: the entry contains `beginCurveWireframeBracket();` and it precedes `vectorPathSession.enterPathEdit(`; the bracket module contains `setWireframeMode(true);` after its capture; the commit region contains `if (draft || wireframe) {` and a `return editId;` inside that branch before `beginPathEditApply(`. Add a comment naming the deduction: the bracket forces wireframe (which forces Draft), so the commit reads `draft || wireframe` true and every vertex commit defers; only the exit settle renders.

Run both files and record the result in the SUMMARY as the Step-1 evidence (the chain closes at HEAD; the live confirmation is UAT row 2, which the user runs).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/vectorPathCurveBracket.test.ts</automated>
  </verify>
  <done>The temporary log is present in the deferred branch, the new reproduction pin passes at HEAD alongside the bracket module's own pins, and the SUMMARY records the closed chain (entry → wireframe latch → deferred commit → exit-only render) as the Step-1 evidence.</done>
</task>

<task type="auto">
  <name>Task 3: Convert at entry and delete the painted-curve machinery</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/vectorPathLatches.ts, app/src/components/physic-paint/view/vectorPathLatches.test.ts, app/src/components/physic-paint/view/vectorPathSession.test.ts, app/src/components/physic-paint/view/vectorPathCurveBracket.ts, app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts, app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts, app/src/components/physic-paint/engine/VectorPathOverlay.tsx, app/src/components/physic-paint/engine/VectorPathOverlay.test.ts</files>
  <action>
Land the rewrite and the removal as ONE atomic change: deleting the module while its four pin files still reference it cannot pass typecheck, so this task's boundary is the whole fix.

**A. Studio entry (`PhysicsPaintStudio.tsx`).** Keep `enterPaintedCurve` where it is; rewrite its body and its doc comment to the new law. Order: single-id guard; `getRecordedAquarelleStroke`; refuse unless `resolvePaintedCurveEligibility(stroke).kind === 'painted'`; `await armDraftBase()` with the shipped `DRAFT_ARM_REFUSAL_MESSAGE` + `setApplyStatus('error')` refusal and `return false`; re-read the stroke with `getRecordedAquarelleStroke` and silently `return false` unless the painted verdict still holds (the WR-03 precedent — a concurrent entry or another edit already owns it); `const fitted = fitVectorPathAnchors(liveStroke.points);` and `return false` with `PATH_EDIT_DEGENERATE_DISABLED_REASON` published through `setApplyMessage` + `setApplyStatus('error')` + `setLastError` when fewer than two anchors come back; read `aquarellePathEditCommitRef.current` and `return false` when it is null; `const editId = await commit(ids[0]!, fitted);`; when `editId === null`, publish `VECTOR_PATH_REJECTION_MESSAGE` through `setApplyMessage` + `setApplyStatus('error')` + `setLastError` ONLY if `scriptApplyRefusalOwnedRef.current` is false, then `return false` — and in every case do NOT call `vectorPathSession.enterPathEdit`; on a resolved id, call `vectorPathSession.enterPathEdit(String(ids[0]!))` and `return true`. Dependency array: `[armDraftBase, setApplyMessage, setApplyStatus, setLastError]`.

Imports: add `PATH_EDIT_DEGENERATE_DISABLED_REASON` to the existing `./view/strokeSettingsModel` import block; add `import { fitVectorPathAnchors } from './view/vectorPathFit';` beside the other `./view/` imports; drop `registerPathEditExitHook` from the `./view/vectorPathLatches` import (keep `registerPaintedCurveEntrance`); delete the whole `./view/vectorPathCurveBracket` import line.

Studio removals: delete the entire `useEffect` that registers the exit hook and its comment (`registerPathEditExitHook(() => { void endCurveBracket({ settle: settleDraftScript }).catch(...) })` plus the `return () => registerPathEditExitHook(null)` cleanup) — `settleDraftScript` stays used elsewhere, so nothing becomes unused. Keep the entrance registration effect (`registerPaintedCurveEntrance(enterPaintedCurve)`) byte-identical. Remove the temporary debug log from Task 2. Leave `readCurveEntry`, the `commitAquarelleVectorPathEdit` body, the bundle wiring and its deps untouched.

**B. Latch leaf (`view/vectorPathLatches.ts`).** Delete the `pathEditExitHook` slot, the `registerPathEditExitHook` function and its doc block. In `exitPathEdit`, drop the `const transitioned = ...` binding and the hook firing, keeping the compare-then-write null write and `clearVectorAnchorSelection()`. Keep `registerPaintedCurveEntrance`, `hasPaintedCurveEntrance`, `requestPaintedCurveEntrance`, `writeIfChanged` and every latch signal untouched.

**C. Overlay (`engine/VectorPathOverlay.tsx`).** Delete: the `curveFitSession`/`PaintedCurveSession` import; the 62-03 header paragraph; the three `CURVE_GHOST_*` constants; the `getHeldFit` member of `VectorPathEditKeyHandlers` and both of its implementations (the initial ref object and the render-tail assignment); the held-fit fallback in the Delete handler (a stroke with no record anchors simply ends the loop, keeping the `break`); `curveGhostPointsOf`; the `curveFit` render-body read; the held-fit branch of the edit-target resolution (record anchors only, and `resolveAquarelleCurveMode(candidate.curveMode)` directly); the `heldFitAnchors` term and the `converting` mode expression in the recorded loop (`resolveAquarelleCurveMode(stroke.curveMode)` directly, anchors from `editDrag` or `recordAnchors`); the `curveGhostPoints` derivation; and the `vector-path-curve-ghost` polyline element. Keep `showStructure`, the drag/selection/commit paths and every other chrome constant untouched. No ghost CSS exists anywhere in the app (verified), so no stylesheet change is expected — confirm with a search while editing.

**D. Delete** `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` and `app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts`. Keep `view/vectorPathFit.ts` and `view/vectorPathFit.test.ts`.

**E. Pin fallout.** In `PhysicsPaintStudio.test.ts`: rename/replace the four tests of `describe('62-02 painted-curve entry and conversion admission in the Studio', ...)` — the ordering/import test now asserts `readCurveEntry` then `commitAquarelleVectorPathEdit` then `enterPaintedCurve` boundaries with the `fitVectorPathAnchors` import present and NO bracket import; the classification test stays; the entry test becomes the new contract (arm, re-read, fit, awaited writer, fail-closed publication, latch only on a resolved id, deps list); the bundle test and the writer-seam/default-mode tests stay. Delete the temporary repro pin from Task 2 and replace it with a permanent pin that the entry contains no wireframe/Draft write. In the `describe('62-04 the pending path-edit apply epoch and the ONE exit-hook registration', ...)` block, drop the exit-hook registration from the title and replace its last test with one asserting the Studio holds no exit-hook registration and still registers the painted entrance exactly once with its `(null)` cleanup. In `VectorPathOverlay.test.ts`: remove the bracket import, delete the held-fit and ghost tests of `describe('62-03 — the armed held fit in the ONE overlay', ...)` (the ~13 tests from the armed-fit spine test through the non-finite ghost test), retarget the pressure-band envelope test to a record-anchored stroke only (its pre-commit half is gone), keep the remaining envelope tests, and drop `clearCurveFitSession` from the `afterEach`. In `vectorPathSession.test.ts`: delete the `describe('62-02 the ONE path-edit exit funnel', ...)` block, the `vectorPathLatchesSurface` namespace plumbing, the `VectorPathLatchesSurface` type and the `registerPathEditExitHook` extraction, and its `afterEach` call. In `vectorPathLatches.test.ts`: add the absence pin for the removed hook. In `aquarelleRecordState.path.test.ts`: retarget the comment that names `vectorPathCurveBracket.test.ts` to `vectorPathFit.test.ts`.

Respect the project reactivity rules (`efx-preact-reactivity`): no render-body signal writes, `.peek()` in handlers, compare-then-write setters. Do not add any new module, option, flag or compatibility shim.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/engine/VectorPathOverlay.test.ts src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/view/vectorPathLatches.test.ts src/components/physic-paint/view/vectorPathFit.test.ts src/components/physic-paint/view/aquarelleRecordState.path.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts</automated>
  </verify>
  <done>Entering path edit on an anchorless painted stroke fits its samples, awaits the ONE writer, and opens the latch only on a resolved edit id; a null resolution publishes the shipped copy and opens nothing. The bracket module, its test, the exit hook, the held fit, the ghost constants and the ghost polyline are gone; typecheck and the eight touched suites are green; the temporary log and the temporary repro pin are removed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio entry action → the ONE path-edit writer | Fitted anchors produced from recorded samples cross into the shipped conversion write; the writer owns the document/revision/ledger transaction. |
| Overlay → session latches | The overlay reads the path-edit latch and the record; after the rewrite it has no second anchor source. |
| Deleted module → its pin files | Removing a module whose test and three consumer pin files reference it; no runtime boundary crosses. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261116-01 | Tampering | entry conversion write | medium | mitigate | The entry reuses the shipped ONE writer and adds no document/payload path: `commitAquarelleVectorPathEdit` keeps its guards, its anchorless-stroke detection, its single bake and its rollback. A null id publishes a refusal and opens no session. |
| T-261116-02 | Tampering | concurrent entries | low | accept | Two entries inside the durable-base await can both fit; the second write is the same anchors, so the writer's unchanged check returns null and the entry publishes the shipped rejection copy. The first session stays open and the stroke keeps exactly ONE conversion and ONE ledger entry. |
| T-261116-03 | Availability | deferred pixels under the user's own Draft | low | accept | Removing the exit bracket means a session entered with the user's own Draft ON no longer settles on close; its dirty pixels settle through the shipped Draft OFF / frame / flush routes, and the Draft leave-guard is unchanged. Accepted by the amended D-14 scope. |
| T-261116-04 | Tampering | deleted held fit / ghost | low | mitigate | The overlay's only anchor source becomes the record, so no display-only anchor list can reach a commit; the removal is covered by the deleted-module existence check and the overlay pins. |
| T-261116-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package-manager install in this plan; every dependency already ships. Any future install requires the package-legitimacy gate and a blocking human checkpoint. |
</threat_model>

<verification>
- Repo-root commands (cwd at the checkout root):
  - `pnpm --filter efx-motion-editor run typecheck` (clean at HEAD; must stay clean).
  - Task 2 boundary: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/vectorPathCurveBracket.test.ts`.
  - Task 3 boundary: the eight-suite command in Task 3's `<verify>`.
- Full app suite: `pnpm --filter efx-motion-editor exec vitest run`. Baseline at HEAD: [HEAD=1 failed/9493 passed/1 skipped EXPECT=1 failed and no new failure] — the single pre-existing failure is `src/lib/physicPaintBridge.test.ts > 63-05 brush-tip realm channels > catalog pull > removes its one-shot listener when no receiver answers (bounded wait)` (a 20s bound, unrelated to this quick). Do not treat it as a regression; any OTHER failing file is one.
- Deletion gates: `test ! -e app/src/components/physic-paint/view/vectorPathCurveBracket.ts` and `test ! -e app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts`.
- Kept-invariant evidence: the untouched suites `vectorPathFit.test.ts`, `aquarelleRecordState.path.test.ts`, `strokeSettingsModel.test.ts` and `PhysicsPaintStrokeSettingsDialog.test.ts` are green in Task 3's boundary run.
- Live UAT rows for the user (the executor never launches the app or the server): (1) entering path edit on a painted stroke converts it (one undo entry) and shows anchors with no ghost and no wireframe; (2) the FIRST vertex drag updates the paint immediately, later drags live; (3) entering and leaving with no drags keeps the conversion; (4) a re-entered session is unchanged; (5) one undo restores the painted stroke; (6) manual wireframe ON still defers; (7) Lift and degenerate strokes are still refused.
- Step-1 evidence: the SUMMARY records Task 2's closed chain and its passing pin as the deterministic reproduction, with UAT row 2 as the live confirmation.
</verification>

<success_criteria>
- Entering path edit on an anchorless painted stroke produces exactly ONE conversion write, ONE `aquarelle-script` ledger entry and ONE undo entry, and opens the latch only on a resolved edit id.
- From entry onward the session is the shipped vector session: anchors come from the record and every gesture takes the Live rebake route unless the user's own wireframe or Draft is ON.
- `view/vectorPathCurveBracket.ts` and its test are deleted; the exit hook, the held fit, the ghost constants and the ghost polyline no longer exist; `fitVectorPathAnchors` and the eligibility/refusal law are kept.
- The manual deferred route, the settle single-flight, the Draft leave-guard, capture/save/export, undo/redo of a path edit and the overlay's selection/drag/commit path are byte-unchanged in behaviour.
- Every pin that asserted the removed chain is rewritten at the new contract in the same task; no pin is deleted except the ones pinning deleted code.
- The quick's CONTEXT records the three amended laws and the fail-closed entry law without editing historical phase artifacts.
- No dependency install, no server launch, no app launch by the executor.
</success_criteria>

<output>
Create `.planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-SUMMARY.md` when done.
</output>
