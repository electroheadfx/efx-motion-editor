---
phase: 261112-hfk-fix-cr-01-from-planning-phases-61-vector
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: [QUICK-261112-HFK]
user_setup: []

estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "An UNCHANGED per-vertex colour commit publishes nothing: releasing an unmoved colour box, re-picking the same swatch, retyping the same hex in another case, or releasing with a listed anchor already carrying the colour produces no apply banner, no `applyStatus='error'` and no `lastError`."
    - "A GENUINE refusal still publishes exactly as today: a null edit id for a forwardable change still calls `setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)`, `setApplyStatus('error')` and `setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)`."
    - "An UNCOLOURED anchor that receives a colour — including its own stroke's colour — is a real change and is committed, never skipped as a no-op (explicit wins over inherit)."
    - "The stroke-level colour fallback (`aquarelleAppearanceCommitRef.current?.(ids, { color })` and its reachability) and `buildAnchorColorCommit`'s explicit-colour law (a fresh list for the anchor's existing colour) are byte-identical to HEAD."
    - "The no-op decision is a pure, exported, behaviourally tested predicate in `vectorPathHandles.ts`; the Studio wiring is pinned by the existing source-scan suite."
  artifacts:
    - path: "app/src/components/physic-paint/view/vectorPathHandles.ts"
      provides: "`anchorColorCommitIsNoOp(anchors, next)` — the pure unchanged-gesture predicate beside `buildAnchorColorCommit`"
    - path: "app/src/components/physic-paint/view/vectorPathHandles.test.ts"
      provides: "The behavioural pins: same colour, canonical re-pick, uncoloured anchor gaining a colour, one differing listed anchor, non-targeted anchors irrelevant"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "The CR-01 guard between `buildAnchorColorCommit` and `commit(target, next)`; the refusal publication stays unchanged for real refusals"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "The wiring ordering pin (build → guard → commit) with the refusal strings still present, plus the repointed shared-module import literal"
  key_links:
    - from: "app/src/components/physic-paint/view/RightPanelColorTab.tsx"
      to: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      via: "pointer-up / blur / swatch `onColorCommit` (no upstream equality check) → `handleRightPanelColorCommit` → `buildAnchorColorCommit` → `anchorColorCommitIsNoOp` returns BEFORE `commit(target, next)`, so the unchanged gesture never reaches `beginAquarellePathEdit` and never publishes the refusal banner (CR-01)"
---

<objective>
Stop an unchanged per-vertex colour commit from publishing the false "Vertex colour not applied" banner (CR-01 from `.planning/phases/61-vector-painting-tool/61-REVIEW.md`): add one pure `anchorColorCommitIsNoOp` predicate to the handle module, guard the Studio's anchor-colour branch with it before the commit, and pin all three behaviours — unchanged publishes nothing, genuine refusal still publishes, an uncoloured anchor gaining a colour is a real change.

Purpose: the commit chain returns the same `null` edit id for "in flight/unchanged" as for "refused" (`updateAquarellePathInScript` returns 0 via `anchorsEqual` → `beginAquarellePathEdit` returns null → `commitAquarelleVectorPathEdit` returns null), while the Color tab emits on pointer-up/blur with no equality check. The commit's own docstring says a readable-path null "must publish nothing"; the handler currently violates it on the most common gesture (release without moving).

Output: `anchorColorCommitIsNoOp` + its behavioural suite in `vectorPathHandles.test.ts`; the guard + comment in `handleRightPanelColorCommit`; the repointed import-literal pin and a new ordering pin in `PhysicsPaintStudio.test.ts`.

Scope boundary (explicit, user guardrails): do NOT change the stroke-level colour fallback or its reachability; do NOT change `buildAnchorColorCommit`'s law (it must keep returning a fresh list for the anchor's existing colour — already pinned at `vectorPathHandles.test.ts:471-478`); no new config; `vitest run` only, never watch.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Anchors verified at HEAD `71a2dcc5e` on `gsd/phase-61-vector-painting-tool`; working tree clean.

`app/src/components/physic-paint/view/vectorPathHandles.ts`
- 598-617 `buildAnchorColorCommit`: normalises through `normaliseAnchorColor` (imported at 34), maps every anchor; targeted indices get `{ ...anchor, color: next }` (a NEW object even for an equal colour), others stay reference-identical; returns null only for a malformed colour, empty selection, or a selection naming no existing anchor.
- 619-620: the `// --- The commit's stroke half ---` section header — the predicate goes between the builder and this header, in its own `// --- The colour commit ---` family.
- The module is pure (no Preact, no signals, no DOM, no engine import) — `VectorAnchor` and `normaliseAnchorSelection` are already in scope.

`app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- 114 `import { buildAnchorColorCommit, buildAnchorWidthCommit } from './view/vectorPathHandles';`
- 7463-7499 `handleRightPanelColorCommit`; the anchor branch is 7478-7498:
  - 7480 `const anchors = stroke ? normaliseAquarelleAnchors(stroke.anchors) : undefined;`
  - 7483 `const next = buildAnchorColorCommit(anchors, anchorSelection, color);`
  - 7484 `if (next !== null) {`
  - 7487-7493 `void commit(target, next).then((editId) => { if (editId !== null) return; … setApplyMessage/ setApplyStatus('error')/ setLastError }`
  - 7498 `void aquarelleAppearanceCommitRef.current?.(ids, { color });` — the shipped stroke-level fallback.

`app/src/components/physic-paint/view/vectorPathHandles.test.ts`
- 36 `buildAnchorColorCommit` in the import list.
- 425-486 `describe('buildAnchorColorCommit — one explicit per-vertex colour (261111-wd6)')` with the local `shaped` fixture (an auto anchor with `width: 1.8`, a bezier, an auto); the new describe goes immediately after it, before `describe('projectVectorPath'` at 487.

`app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- This is a SOURCE-SCAN suite (reads the .tsx as text); there is no mount harness — keep the new wiring pin in that style. Vitest collects only `.test.ts` files.
- 6866-6870 pins the EXACT import literal `"import { buildAnchorColorCommit, buildAnchorWidthCommit } from './view/vectorPathHandles';"` — it MUST be repointed (never deleted) once the predicate is imported.
- 6873-6920 `describe('261111-wd6 — the Color tab per-vertex branch')` with `colorHandlerRegion()` (slices from `const handleRightPanelColorCommit = useCallback(` to `const rightPanel = rightPanelPropsMemo.resolve(`); the new pin joins this describe.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The pure unchanged-gesture predicate — `anchorColorCommitIsNoOp` beside the colour builder, proven by behaviour</name>
  <files>
    app/src/components/physic-paint/view/vectorPathHandles.ts
    app/src/components/physic-paint/view/vectorPathHandles.test.ts
  </files>
  <behavior>
    - Same colour re-emitted on the same list → true: build a coloured list with `buildAnchorColorCommit(shaped, [0, 2], '#ff0000')`, re-build with the same colour and indices, expect true.
    - Canonical re-pick → true: a list stored as `#ff0000` re-committed with `#FF0000` (the normaliser lands `#ff0000`) is a no-op.
    - Uncoloured anchor gaining a colour → false, including when the picked colour equals nothing stored: `anchorColorCommitIsNoOp(shaped, buildAnchorColorCommit(shaped, [0], '#ff0000')!)` is false because `shaped[0].color` is `undefined` (explicit wins over inherit — a REAL change).
    - One listed anchor differing → false: a half-coloured list committed on `[0, 2]` is a change for index 2.
    - Non-targeted anchors stay irrelevant: a differing colour on an anchor OUTSIDE the selection never flips the verdict to false, and non-targeted anchors stay reference-identical across the build.
    - Different pick on an already-coloured list → false (`#ff0000` list re-committed with `#00ff00`).
  </behavior>
  <action>
    RED first, then GREEN.

    `app/src/components/physic-paint/view/vectorPathHandles.test.ts` — add `anchorColorCommitIsNoOp` to the existing import list (line 36 area) and a new `describe('anchorColorCommitIsNoOp — the unchanged colour gesture (261112-hfk CR-01)')` immediately after the `buildAnchorColorCommit` describe (after line 486, before `describe('projectVectorPath'`). Reuse the `shaped` fixture shape locally (an auto anchor with `width: 1.8`, a bezier, an auto) and cover every `<behavior>` bullet; assert the non-targeted anchors are reference-identical (`next[1]).toBe(colored[1])`) to document that only listed indices can differ. Run the suite and confirm it fails because the export does not exist yet (RED evidence).

    `app/src/components/physic-paint/view/vectorPathHandles.ts` — add the predicate directly after `buildAnchorColorCommit` (line 617), before the `// --- The commit's stroke half ---` header, inside the existing `// --- The colour commit (261111-wd6) ---` family. Export `anchorColorCommitIsNoOp(anchors: readonly VectorAnchor[], next: readonly VectorAnchor[]): boolean` implemented exactly as `next.every((anchor, index) => anchor.color === anchors[index]?.color)`. Docstring: `next` must be the list built from these very `anchors` (same length, same order — every non-targeted anchor is reference-identical, so only listed indices can differ); an uncoloured anchor that gains a colour, including its stroke's colour, is a real change (explicit wins over inherit); a null edit id after a true verdict means in flight, never refused (CR-01). No new import; the module stays pure.

    Do NOT touch `buildAnchorColorCommit` (its fresh-list law for an existing colour is pinned at lines 471-478 and is a user guardrail), and do NOT touch `RightPanelColorTab.tsx` (the emission side keeps its no-equality-check contract — the guard belongs at the commit decision).

    Then re-run the suite (GREEN) and the app typecheck.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts</automated>
    <automated>pnpm --prefix app run typecheck</automated>
  </verify>
  <done>
    `anchorColorCommitIsNoOp` is exported from the pure handle module and returns the six documented verdicts; the new describe covers every `<behavior>` bullet with exact `toBe` assertions; the existing `buildAnchorColorCommit` suite is untouched and green; typecheck is green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Guard the Studio branch — skip the commit on a no-op, keep the refusal publication byte-identical</name>
  <files>
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
    `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (line 114) — extend the existing import to `import { anchorColorCommitIsNoOp, buildAnchorColorCommit, buildAnchorWidthCommit } from './view/vectorPathHandles';`.

    In `handleRightPanelColorCommit`'s anchor branch, insert the guard IMMEDIATELY after `if (next !== null) {` (currently line 7484) and BEFORE `void commit(target, next)`:
    `if (anchorColorCommitIsNoOp(anchors, next)) return;`
    with a one-line comment citing CR-01: an unchanged gesture produces the same null edit id as a refusal (in flight/unchanged, per the commit's own docstring), so the no-op must return before the commit and publish nothing; a genuine refusal still publishes through the untouched block below. The comment must state the reason without repeating the predicate call literal, so the source pin's `indexOf` is unambiguous.

    Leave byte-identical: the `setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)` / `setApplyStatus('error')` / `setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)` block (this is the genuine-refusal path), and the trailing `void aquarelleAppearanceCommitRef.current?.(ids, { color });` stroke-level fallback with its reachability conditions (`ids.length === 0` and `!aquarelleSelectMode.peek()` returns, anchor selection empty, target/commit null, anchors undefined). No new config, no new signal.

    `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`:
    1. REPOINT (never delete) the exact import literal at 6866-6870 to `"import { anchorColorCommitIsNoOp, buildAnchorColorCommit, buildAnchorWidthCommit } from './view/vectorPathHandles';"`.
    2. Inside `describe('261111-wd6 — the Color tab per-vertex branch')`, add `it('skips an unchanged colour before committing (261112-hfk CR-01)', …)` using the existing `colorHandlerRegion()` helper:
       - `region.indexOf('anchorColorCommitIsNoOp(anchors, next)')` is greater than `region.indexOf('buildAnchorColorCommit(')` and less than `region.indexOf('commit(target, next)')` — all three `toBeGreaterThan(-1)` first so an absent marker fails with a named assertion;
       - the guard literal appears exactly once in the region (`split(...).length - 1` is 1);
       - the refusal publication strings are still present: `setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)`, `setApplyStatus('error')`, `setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)`, and `if (editId !== null) return;`.
  </action>
  <verify>
    <automated>pnpm --prefix app run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>
    The anchor-colour branch returns before `commit(target, next)` when the built list changes no listed colour; the refusal block and the stroke-level fallback are unchanged; the import literal pin is repointed and the new ordering pin proves build → guard → commit with the refusal strings intact; both suites and typecheck are green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No new trust boundary and no new input surface. The change is one pure string-equality predicate over two local in-memory anchor lists plus one early return inside an existing picker commit path. No user-supplied data reaches a new sink, no persistence format changes, no IPC or file I/O is touched.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261112-hfk-01 | Tampering | `anchorColorCommitIsNoOp` guard in `handleRightPanelColorCommit` | low | accept | The only integrity risk is a misclassified gesture: a no-op incorrectly treated as a change re-introduces only the false banner (nuisance, not data loss), and a change treated as a no-op would suppress a legitimate edit — ruled out by the behavioural suite (uncoloured anchor gaining a colour → false; one differing listed anchor → false) and by the predicate comparing the exact built list, with the genuine-refusal publication untouched. |
| T-261112-hfk-SC | Tampering | npm/pip/cargo installs | high | mitigate | Not applicable — no package is added, upgraded or installed; no dependency edge changes. The package-legitimacy gate has no new subject. |
</threat_model>

<verification>
Automated (cwd = repo root; `vitest run` only, never watch):
- `pnpm --prefix app run typecheck`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint` (broader regression gate for the handle module's consumers)

Scope checks (grep/diff, not behaviour):
- `git diff --stat` names exactly the four `files_modified` paths; `RightPanelColorTab.tsx`, `aquarelleRecordState.ts`, `aquarelleStrokeSelection.ts` and `strokeSettingsModel.ts` are untouched.
- `grep -c "anchorColorCommitIsNoOp(" app/src/components/physic-paint/PhysicsPaintStudio.tsx` counts 2 (the import and the one guard) — one guard, never a second.
- `buildAnchorColorCommit`'s body is byte-identical to HEAD; the `still yields a new list for the anchor's existing colour` pin remains green.

Native UAT rows (the user's side — do not claim these from CI):
1. Draw a vector stroke, open Edit path, select two anchors (leave them colourless), open the Color tab and click the colour box then release WITHOUT moving → no "Vertex colour not applied" banner, and the anchors stay as they were.
2. With those anchors now coloured once (a real pick), re-pick the SAME swatch and retype the same hex in upper case → still no banner, and the vertex colours do not change.
3. Make a real change (a different swatch) → the vertices recolour in ONE undo step with no banner; then undo and redo → the same colours return.
4. Trigger a genuine refusal (commit while a path-edit commit is in flight / on an unreadable path edit) → the "Vertex colour not applied" banner and the error status still appear.
5. With NO anchors selected, a colour pick still recolours the whole selected stroke exactly as before.
</verification>

<success_criteria>
- A pure `anchorColorCommitIsNoOp` exists in `vectorPathHandles.ts` and reports the six documented verdicts, including the explicit-wins-over-inherit case (an uncoloured anchor gaining a colour is a change).
- The Studio's anchor-colour branch returns before `commit(target, next)` only when no listed colour moves, so an unchanged gesture publishes nothing (no message, no error status, no `lastError`).
- A genuine refusal still publishes `ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE` through all three writers, byte-identical to HEAD.
- The stroke-level convenience fallback, `buildAnchorColorCommit`'s explicit-colour law and the Color tab's emission sites are unchanged.
- Every automated command in `<verification>` is green, and the five native UAT rows are handed to the user rather than claimed.
</success_criteria>

<output>
Create `.planning/quick/261112-hfk-fix-cr-01-from-planning-phases-61-vector/261112-hfk-SUMMARY.md` when done
</output>
