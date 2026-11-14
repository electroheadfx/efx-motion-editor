---
phase: 61-vector-painting-tool
plan: 08
subsystem: ui
tags:
  - watercolor
  - vector-pen
  - session-state
  - preact-signals
  - rail
  - keyboard
  - tdd

# Dependency graph
requires:
  - phase: 61-01
    provides: "Wave-0 verdict and the phase laws D-05 (fifth separated rail entry) / D-06 (draw and edit are distinct states), corrected by C-01 to WATERCOLOR_RAIL_TOOLS in PhysicsPaintToolRail.tsx"
  - phase: 61-02
    provides: "VectorAnchor shape re-declared locally as VectorDraftAnchor (the package has no ./vector export until 61-03)"
provides:
  - "vectorPathSession.ts — vectorPenActive / pathEditMutationId / vectorDrawDraft with compare-then-write setters, the mutual-exclusion matrix and resetForStudioOpen"
  - "The rail's fifth, visually separated PenTool host button (data-testid aquarelle-vector-pen-toggle) and the .physics-paint-rail-separator rule"
  - "Bare V latches the pen; Cmd/Ctrl+V keeps owning paste; the Studio action bundle wires the same module action the rail calls"
  - "A negative source scan proving the session module imports nothing from the document, payload, codec or save path, and a pinned Studio mount reset"
affects:
  - 61-09 (reads vectorPenActive to gate the overlay; pathEditMutationId is the edit handle)
  - 61-10 (path-edit entry points reuse enterPathEdit/exitPathEdit and their exclusion matrix)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 10012
  tasks: 3
  commits: 5
plan_head_before: ac3093cabbd9435847b9578f89c42416d956e50b
plan_head_after: 090e96f990085bf670606652af1df2fdbaa1e820

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Host-tool latch: a session signal outside the paint-tool union, with every enter action clearing sibling input surfaces through their own setters"
  - "Compare-then-write signal setters (writeIfChanged) so identical calls notify zero effects — the idempotency law is asserted with effect() run counts"
  - "Session-only module pinned by an exact import allowlist plus a forbidden-symbol scan, and by a Studio mount effect counted as one literal"
  - "Plain .test.ts vnode walk (materialize/walk/directChildren) for a Preact component, because the vitest config collects only src/**/*.test.ts in the node environment"

key-files:
  created:
  - app/src/components/physic-paint/view/vectorPathSession.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
  modified:
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts
  - app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "WatercolorRail is exported so the plain .test.ts can call it as a function; the vitest config only collects src/**/*.test.ts, so a .test.tsx launcher would have been invisible."
  - "Paint-tool presses clear the pen and end path edit at the two input seams (the rail paint onClick and the Studio's handleSelectAquarelleTool) instead of inside setAquarelleTool, which would add a new import cycle aquarelleRecordState -> vectorPathSession -> aquarelleStrokeSelection -> aquarelleRecordState."
  - "The pen joins the existing one-active-surface law (!penActive in the paint row's isActive) because it is a host tool like the picker, Select and Motion boundaries."
  - "The idempotency pin measures one signal at a time: entering path edit legitimately clears a latched pen, so a single effect over both signals would count that exclusion write as a second pen write."
  - "VectorDraftAnchor is declared locally, structurally identical to 61-02's VectorAnchor, because @efxlab/efx-watercolor exposes no ./vector subpath until 61-03."

patterns-established:
  - "A session tool module owns its exclusion matrix; components call the module's actions, never write a sibling module's signal."
  - "A negative persistence scan asserts the import allowlist exactly, so a later document import cannot slip in silently."

requirements-completed: [VEC-01, VEC-02]

coverage:
  - id: D1
    description: "The watercolor rail renders a fifth, separated PenTool host button after the four paint tools, with the approved label/title/grammar, aria-pressed bound to the session, and a 1px #5a5e63 separator before it; latching never changes aquarelleActiveTool."
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#WatercolorRail — the fifth entry (D-05 / C-01)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts#the rail separator rule (physicsPaintStudio.css)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bare V latches the vector pen and is consumed; Cmd+V/Ctrl+V stay paste; Shift/Alt, text fields and key repeat are inert; the Studio action bundle uses the same session action as the rail button."
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#61-08 (D-05) vector pen shortcut (V)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The session is session-only: pen/path-edit/draft signals with compare-then-write setters, the exclusion matrix in every direction, idempotent setters, an explicit draft-survival policy, an exact import allowlist, a forbidden-symbol scan and exactly one Studio mount reset."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#vectorPathSession — the vector pen and path-edit session"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#the session module is session-only (T-61-53)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live Studio UAT: pressing V highlights the fifth entry and pressing B releases it."
    verification: []
    human_judgment: true
    rationale: "The plan records this as an end-of-phase manual UAT row; the unit pins prove aria-pressed binding and the host-tool law but not the rendered highlight in the running Studio window."

duration: 9min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 08: Vector Pen Rail Entry and Session Summary

**The vector pen is now reachable from a separated fifth rail entry and from bare V, backed by a session-only signal module whose exclusion matrix keeps it out of the four paint tools and entirely out of the document.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-10T12:42:36Z
- **Completed:** 2026-11-10T12:51:19Z
- **Tasks:** 3
- **Files created/modified:** 11 (3 created, 8 modified)

## Accomplishments

- `vectorPathSession.ts` lands with the three session signals (`vectorPenActive`, `pathEditMutationId`, `vectorDrawDraft`), compare-then-write setters and the full exclusion matrix: the pen clears Select, the picker and path edit; path edit clears the pen; neither ever touches `aquarelleActiveTool`.
- The rail renders exactly one separated `PenTool` host button after the four paint tools, with the approved `Vector pen` label, the plan's title literal, the `physics-paint-icon-button` grammar and `data-testid="aquarelle-vector-pen-toggle"`; the derived 1px `#5a5e63` separator sits immediately before it.
- Bare `v` toggles the pen through the same module action the button calls; Cmd/Ctrl+V still routes to paste, and Shift/Alt, text-field focus and key repeat are each pinned inert.
- The module is proven session-only by an exact three-line import allowlist plus a forbidden-symbol scan (`.mce`, document store, revision, cache key, exporter, serialize), and `PhysicsPaintStudio.tsx` carries exactly one mount-time `vectorPathSession.resetForStudioOpen()` call pinned by source read.
- The draft policy is explicit: a draft survives a tool toggle and is cleared only by Escape, by finishing, and by the Studio reset.

## Task Commits

Each task was committed atomically; both TDD tasks carry a RED then a GREEN commit:

1. **Task 1 RED: failing tests for the rail entry and the session** - `437c60a84` (test)
2. **Task 1 GREEN: the session module, the fifth rail entry and the separator** - `33cb62d73` (feat)
3. **Task 2 RED: failing tests for bare V** - `99cff393f` (test)
4. **Task 2 GREEN: the bare-V branch and the Studio action-bundle wiring** - `7bed2eee9` (feat)
5. **Task 3: session-only proofs and the pinned Studio mount reset** - `090e96f99` (feat)

**Plan metadata:** included in the `docs(61-08)` completion commit.

## TDD Gate Compliance

| Gate | Evidence |
|------|----------|
| Task 1 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `vectorPathSession — the vector pen and path-edit session > starts clean and clears every sibling surface on entry`. 19 tests ran, 14 failed on assertions (7 rail-entry + 7 session). |
| Task 1 GREEN | `vitest run vectorPathSession.test.ts PhysicsPaintToolRail.test.ts` → 19/19 passed; committed as `feat`. |
| Task 2 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `61-08 (D-05) vector pen shortcut (V) > latches the vector pen on a bare v key and consumes it`. 157 tests ran, 2 failed on assertions. |
| Task 2 GREEN | `vitest run physicsPaintStudioKeyboard.test.ts` → 157/157 passed; committed as `feat`. |
| Task 3 | `type="auto"` — no RED gate required by the plan. |
| REFACTOR | Not needed — no cleanup beyond the in-cycle fixes recorded below. |

The commit order is RED → GREEN for both TDD cycles.

## Files Created/Modified

- `app/src/components/physic-paint/view/vectorPathSession.ts` - the session module: types, three signals, a private compare-then-write setter, the nine actions and the documented draft policy
- `app/src/components/physic-paint/view/vectorPathSession.test.ts` - 16 pins: exclusion matrix, idempotency, draft lifecycle, reset, import allowlist, forbidden symbols, mount-reset source pin
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` - 7 pins: fifth entry, separator, button grammar, aria-pressed binding, host-tool law, disabled state and the CSS rule
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - `PenTool` import, the separator + fifth host button, `penActive` in the one-active-surface law, `exitVectorPen()`/`exitPathEdit()` on paint presses, `WatercolorRail` exported
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` - the `toggleVectorPen` action member and the bare-`v` branch beside the picker/select arms
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` - the six new shortcut cases
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - namespace import, the one mount reset effect, the action-bundle entry, and the paint-tool seam clearing both session states
- `app/src/components/physic-paint/physicsPaintStudio.css` - the `.physics-paint-rail-separator` rule
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`, `view/physicsPaintHandToolWiring.test.ts`, `view/railMotionBoundaryTool.test.ts` - pre-existing rail source pins updated for the intended fifth tool (see Deviations)

## Verification Run

- `pnpm exec vitest run src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/view/PhysicsPaintToolRail.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` → 180 passed
- `pnpm exec vitest run` (full app suite) → 411 files passed | 2 skipped, 8466 tests passed | 1 skipped | 96 todo
- `pnpm run typecheck` (tsc --noEmit) → clean
- `grep "AquarelleTool" PhysicsPaintToolRail.tsx` → union import unchanged at four members; `grep "AquarelleToolRow"` → no match (dead component untouched, C-01)
- `grep -c "vectorPathSession.resetForStudioOpen()" PhysicsPaintStudio.tsx` → 1

## Decisions Made

- **Export `WatercolorRail`.** The repo's vitest collects only `src/**/*.test.ts`, so the plan's plain `.test.ts` vnode walk needs the component callable as a function; exporting it keeps the existing Studio source slice (`indexOf('function WatercolorRail')`) intact.
- **Wire the exclusion at the input seams.** `exitVectorPen()`/`exitPathEdit()` run in the rail paint `onClick` and the Studio's `handleSelectAquarelleTool`; putting them inside `setAquarelleTool` would create the cycle `aquarelleRecordState → vectorPathSession → aquarelleStrokeSelection → aquarelleRecordState`.
- **The pen is a one-active-surface participant.** The paint row deselects while the pen is latched, matching the picker, Select and Motion boundaries.
- **Draft anchors are declared locally.** `VectorDraftAnchor` mirrors 61-02's `VectorAnchor` because the watercolor package exposes no `./vector` subpath until 61-03.
- **Idempotency measured per signal.** The exclusion law legitimately writes the pen signal when path edit opens; the pin measures each signal's effect separately so the test proves setter idempotence rather than miscounting a cross-write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The idempotency pin miscounted the exclusion law's legitimate cross-write**
- **Found during:** Task 1 GREEN
- **Issue:** The RED test asserted `penRuns === 2` after `enterVectorPen()` ×3 followed by `enterPathEdit('m7')`, but entering path edit clears the latched pen by design (the same law the file asserts two tests earlier), so the effect ran a third time. The expectation contradicted the plan's mutual-exclusion requirement.
- **Fix:** The test measures one signal at a time — pen idempotence before path edit, then path-edit idempotence — with a comment explaining why. The production behavior is unchanged and matches the plan.
- **Files modified:** `app/src/components/physic-paint/view/vectorPathSession.test.ts`
- **Verification:** the whole session suite passes 16/16; the exclusion directions remain asserted.
- **Committed in:** `33cb62d73` (Task 1 GREEN)

**2. [Rule 1 - Bug] Four pre-existing rail source pins rejected the intended fifth tool**
- **Found during:** full-suite verification after Task 3
- **Issue:** Three test files pinned the rail's exclusivity expression and lucide import list as exact strings. Adding `!penActive` and `PenTool` broke those pins even though the laws they protect (one active surface, no Hand control) still hold.
- **Fix:** Updated the four assertions to include `!penActive` / `PenTool` while keeping every negative Hand assertion; both changed literals keep the originally protected law explicit.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`, `app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts`, `app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts`
- **Verification:** the three files pass 361/361; the full app suite is green (411 files, 8466 tests).
- **Committed in:** `090e96f99` (Task 3)

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both are test-expectation corrections; no product scope change, no behavior outside the plan, and every planned behavior is asserted by the committed tests.

## Issues Encountered

- A brand-new module cannot produce valid RED on a load failure, so Task 1 followed the 61-02 precedent: a shape-only stub (never committed) let the target tests execute and fail on their assertions, and Vitest's JUnit reporter fed the classifier untouched. Task 2 needed no stub because the keyboard module already existed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The scratch RED stub was replaced by the committed module before a GREEN commit; no placeholder branch or hardcoded empty data remains.

## Threat Surface

- T-61-51 (bare-V stealing a modifier chord): the branch sits inside the existing bare-key block after the Cmd/Ctrl branch; Cmd+V/Ctrl+V, Shift, Alt, repeat and text-field cases are each asserted.
- T-61-52 (a tool state stranding the editor): every enter action clears its siblings, the same button exits the pen, and the pinned Studio mount reset clears all three signals.
- T-61-53 (session state leaking into the document): the module's import allowlist is exact (signals + two sibling session surfaces) and a forbidden-symbol scan covers `.mce`, the document store, revision, cache key, exporter and serialize.
- No new network endpoint, auth path, file access pattern or dependency was introduced.

## Next Phase Readiness

- 61-09 can read `vectorPenActive` to gate the overlay and call `beginVectorDraft`/`appendVectorDraftAnchor`/`clearVectorDraft` from its pointer handlers.
- 61-10 can enter path edit through `enterPathEdit(mutationId)` knowing the pen, Select and the picker are already cleared.
- The Studio mount resets the session per open, so later plans can add per-session state without re-implementing the reset.
- The end-of-phase manual UAT row remains: pressing V highlights the fifth entry; pressing B releases it.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All three created files exist on disk.
- All five task commits (`437c60a84`, `33cb62d73`, `99cff393f`, `7bed2eee9`, `090e96f99`) are ancestors of HEAD.
- No commit deletes a tracked file.
