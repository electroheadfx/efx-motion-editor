# Quick 261116-qhm Summary: Painted-stroke path edit is a plain vector session

Entering path edit on an anchorless painted stroke now commits the conversion
ON ENTRY through the shipped ONE writer (`commitAquarelleVectorPathEdit`) and
opens the path-edit latch only when that write resolves an edit id. The first
vertex drag therefore takes the Live rebake route like every later drag. The
painted-curve machinery behind the old differing path — the entry
wireframe/Draft bracket, the held fit, the original-spine ghost, the path-edit
exit hook — is deleted.

**Status: complete — Tasks 1–3 implemented; automated gates green. Live UAT
(7 rows) is PENDING user execution; the executor never launched the app or the
server. No live behaviour is claimed verified here.**

---

## Frontmatter

```yaml
phase: quick/261116-qhm
plan: 01
subsystem: physic-paint / vector path editing
tags: [path-edit, vector, painted-stroke, preact, signals, vitest]
status: complete
requires:
  - commitAquarelleVectorPathEdit (the shipped ONE conversion writer, unchanged)
  - fitVectorPathAnchors in view/vectorPathFit.ts (KEPT)
  - aquarellePathEditCommitRef TDZ seam (261111-wd6 convention)
provides:
  - entry-time conversion for an anchorless painted stroke's path edit
  - fail-closed entry (DRAFT_ARM_REFUSAL_MESSAGE / PATH_EDIT_DEGENERATE_DISABLED_REASON / VECTOR_PATH_REJECTION_MESSAGE; no latch on a null id)
  - WR-03 re-read + re-verdict after the durable-base await
  - removal of vectorPathCurveBracket.ts, its test, the path-edit exit hook, the held fit and the curve ghost
affects:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx (.test.ts)
  - app/src/components/physic-paint/view/vectorPathLatches.ts (.test.ts)
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx (.test.ts)
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts (comment retarget)
tech-stack:
  added: []
  patterns:
    - conversion commits at entry through the ONE writer; fail closed on a null id
    - re-read-after-await (WR-03): a concurrent owner ends the entry silently
    - record anchors are the overlay's ONLY edit-target source
key-files:
  created:
    - .planning/quick/261116-qhm-painted-stroke-path-edit-is-a-plain-vect/261116-qhm-CONTEXT.md
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/vectorPathLatches.ts
    - app/src/components/physic-paint/view/vectorPathLatches.test.ts
    - app/src/components/physic-paint/view/vectorPathSession.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  deleted:
    - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
    - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
decisions:
  - D-03 reversed for this entry: the conversion commits ON ENTRY; enter+leave with no gesture still leaves ONE undoable conversion
  - D-06's automatic wireframe on entry removed: no wireframe, no Draft, no spine ghost
  - D-14 scoped to the MANUAL wireframe/Draft latch only: the deferred route is kept for a session the user armed
  - Fail closed on a null writer result with the shipped copy only; the writer's own failure copy is never overwritten (scriptApplyRefusalOwnedRef)
  - Overlay edit anchors come from the record only; no display-only anchor list can reach a commit
metrics:
  duration: "~10m"
  completed: 2026-11-16
actuals:
  tokens: 21450
  tasks: 3
  commits: 2
  plan_head_before: 161e3425267721d7c99331afb4ce2b73aeb7d451
  plan_head_after: 8686ef88c96a9fcc543067fee0553cb239dc824f
```

`commits` is MEASURED: `git rev-list --count 161e34252..HEAD` = 2 (the two
code tasks; Task 1's CONTEXT.md is a docs artifact intentionally left
uncommitted for the orchestrator's docs commit). `actuals.tokens` is chars/4
over the realized diff (`git diff 161e34252..HEAD` = 85,800 chars → 21,450),
on the same scale as the plan's 90,000-token estimate.

---

## Tasks and commits

| Task | Name | Commit | Gate result at commit |
|------|------|--------|-----------------------|
| 1 | Record the three amended laws in the quick's CONTEXT | not committed (docs artifact) | verify grep trio passed |
| 2 | Reproduce the first-session deferred route at the source level | `6af786908` | PhysicsPaintStudio + vectorPathCurveBracket suites green at HEAD (451 tests) |
| 3 | Convert at entry and delete the painted-curve machinery | `8686ef88c` | typecheck clean; 8-suite boundary 839/839 passed |

Task 3 stat: 10 files changed, 181 insertions(+), 1224 deletions(-), including
`delete mode 100644` for both `vectorPathCurveBracket` files.

---

## Step-1 reproduction evidence (the bug, pinned before the fix)

The plan's verified chain at HEAD (pre-fix), closed by Task 2's permanent-at-the-
time source pin (`6af786908`, passing alongside the bracket module's own pins):

1. `enterPaintedCurve` called `beginPaintedCurveSession(stroke)` →
   `beginCurveWireframeBracket()` → `vectorPathSession.enterPathEdit(...)`.
2. `beginCurveWireframeBracket` captured the pre-entry view and called
   `setWireframeMode(true)`.
3. `setWireframeMode(true)` first forced `setDraftMode(true)`, then flipped
   `wireframeMode`.
4. `commitAquarelleVectorPathEdit` read `draftMode.peek()` /
   `wireframeMode.peek()` after the durable-base await and took the
   `if (draft || wireframe)` deferred branch: record the edit + mark pixels
   dirty, no bake.
5. The only re-render was the exit settle through `registerPathEditExitHook` →
   `endCurveBracket({ settle: settleDraftScript })`.

Deduction pinned: the entry itself forced both latches, so every vertex commit
on a FIRST session deferred and nothing repainted while dragging; only the exit
settle rendered.

**The live confirmation is UAT row 2, which the user runs.** Nobody launched
the app in this run (constraint), so this summary claims automated/source
evidence only — never live behaviour.

Task 3 then deleted the whole chain: the bracket module, its test, the exit
hook, the held fit and the ghost; the commit's deferred branch now only runs
when the USER's own wireframe/Draft is on.

---

## Verification

- `pnpm --filter efx-motion-editor run typecheck` — clean.
- Task 2 boundary: `PhysicsPaintStudio.test.ts` + `vectorPathCurveBracket.test.ts`
  — green at the pre-fix HEAD (451 tests); the repro pin was then replaced by
  the permanent "entry writes no wireframe or Draft latch" pin in Task 3.
- Task 3 boundary (8 suites: PhysicsPaintStudio, VectorPathOverlay,
  vectorPathSession, vectorPathLatches, vectorPathFit, aquarelleRecordState.path,
  strokeSettingsModel, PhysicsPaintStrokeSettingsDialog) — **839 passed, 0 failed**.
- Deletion gates: `vectorPathCurveBracket.ts` and `.test.ts` both absent;
  `vectorPathFit.ts` present and still exporting `fitVectorPathAnchors` (KEPT).
- Dead-reference scan: no production reference to `vectorPathCurveBracket`,
  `registerPathEditExitHook`, `curveGhostPoints` or `getHeldFit`.

### Full-suite baseline caveat (documented in the plan — not a regression)

`pnpm --filter efx-motion-editor exec vitest run` at HEAD:
**1 failed / 9461 passed / 1 skipped / 96 todo.** The single failure is the
plan-documented pre-existing flake:

`src/lib/physicPaintBridge.test.ts > 63-05 brush-tip realm channels > catalog pull > removes its one-shot listener when no receiver answers (bounded wait)`

Running that file alone passes (186 passed / 1 skipped), confirming it is
environmental and unrelated to this quick. Any OTHER failing file would be a
regression; none exists.

---

## Kept invariants (evidence)

- `commitAquarelleVectorPathEdit` body untouched except the removed temporary
  debug log: anchorless-stroke detection, `DEFAULT_VECTOR_PATH_CURVE_MODE`,
  single bake, ONE `aquarelle-script` ledger entry, rollback, and the
  `if (draft || wireframe)` deferred route for the user's own latches.
- `resolvePaintedCurveEligibility` / `admitsPathEditWrite` (lift, degenerate,
  malformed anchors) untouched; lift and degenerate refusal copy ships.
- `settleDraftScript` single-flight and the Draft leave-guard untouched.
- Capture, save, export, undo/redo of a path edit untouched — the conversion is
  an ordinary script edit with its ONE ledger entry.
- Overlay `showStructure`, selection/drag/commit paths untouched; only the
  anchor source changed (record only).
- No engine math, payload, schema, anchors or hit-test change. No new module,
  option, flag or shim.

---

## Deviations from Plan

### 1. [Plan internal contradiction] Ordering-test assertion order

**Found during:** Task 3E.
**Issue:** Task 3E's wording said the ordering test asserts `readCurveEntry` →
`commitAquarelleVectorPathEdit` → `enterPaintedCurve`, but the design
constraints say the entry keeps its current position BEFORE the commit and
"Do NOT reorder callbacks".
**Fix:** Preserved the shipped order and asserted `readCurveEntry` <
`enterPaintedCurve` < `commitAquarelleVectorPathEdit` (READ < ENTER < COMMIT),
which is the actual committed source. No callback moved.

### 2. [Rule 1 — consequence of the removals] Adjacent pins updated beyond the literal list

**Found during:** Task 3.
**Issue:** Deleting the held fit/ghost invalidated three pins not named
explicitly in Task 3E:
- the overlay palette hex-set pin (the ghost's two colours left the palette);
- the G-20 curve-mode pins, which asserted the held-fit/anchorless default-mode
  expression, now `resolveAquarelleCurveMode(candidate.curveMode)` in the
  resolution and `resolveAquarelleCurveMode(stroke.curveMode)` in the recorded
  loop, with `DEFAULT_VECTOR_PATH_CURVE_MODE` absent from both;
- the pressure-band envelope test's pre-commit half, retargeted to a
  record-anchored stroke (`pressureStroke(EDIT_ID, { anchors: [...] })`).
**Fix:** Each pin rewritten at the new contract in the same commit. A slice
anchor in the G-20 pin was tightened to `let editTargetMutationId: number | null = null;`
after the previous start marker matched the Delete-handler occurrence first and
spanned into the draft path.

### 3. [Rule 2 — missing critical coverage] New fail-closed and no-wireframe pins

**Found during:** Task 3E.
**Fix:** Added the permanent "writes no wireframe or Draft latch from the entry"
pin (asserts no `setWireframeMode`/`setDraftMode`/`beginCurveWireframeBracket`
in the entry and that the manual deferred branch still returns before
`beginPathEditApply`) and the latch-leaf absence pin for
`registerPathEditExitHook`. `exitPathEdit` now only writes the latch (compare-
then-write) and clears the anchor selection.

### 4. Docs artifact intentionally uncommitted

Task 1's `261116-qhm-CONTEXT.md` (and this SUMMARY) are docs artifacts; per the
dispatch the orchestrator owns the docs commit. The working tree carries only
the untracked qhm directory.

---

## Auth gates

None.

## Known Stubs

None. No placeholder values, no unwired data sources, no skipped or todo tests
were introduced by this plan.

## Threat Flags

None beyond the plan's `<threat_model>`. T-261116-01's mitigation is the
implemented contract (reuse of the ONE writer; null id publishes a refusal and
opens no session — pinned). T-261116-02 remains accepted as recorded: two
concurrent entries inside the durable-base await converge on the writer's
unchanged check; exactly one conversion and one ledger entry survive, the
second entry ends with the shipped rejection copy.

---

## Live UAT — PENDING user execution (executor never launched the app)

| # | Row | Status | Why live |
|---|-----|--------|----------|
| 1 | Entering path edit on a painted stroke converts it (one undo entry) and shows anchors with no ghost and no wireframe | pending | live Studio visual |
| 2 | The FIRST vertex drag updates the paint immediately; later drags live — **this is the Step-1 chain's live confirmation** | pending | live repaint timing |
| 3 | Entering and leaving path edit with no drags keeps the conversion (anchors stay; no rollback, no second entry) | pending | live undo/session check |
| 4 | A re-entered session is unchanged | pending | live re-entry check |
| 5 | One undo restores the painted stroke | pending | live undo check |
| 6 | Manual wireframe ON still defers (record + dirty, no bake) | pending | live latch check |
| 7 | Lift strokes and degenerate strokes are still refused with their shipped copy | pending | live refusal copy |

---

## Self-Check

- Created files: `.planning/quick/261116-qhm-.../261116-qhm-CONTEXT.md` FOUND
  (untracked by design).
- Deleted files: both `vectorPathCurveBracket` files verified absent.
- Kept file: `view/vectorPathFit.ts` present, `fitVectorPathAnchors` exported.
- Commits: `6af786908` and `8686ef88c` FOUND as ancestors of HEAD
  (`8686ef88c96a9fcc543067fee0553cb239dc824f`).
- Working tree: only the qhm `.planning/` directory is untracked (docs
  artifacts intentionally not committed by the executor).

## Self-Check: PASSED
