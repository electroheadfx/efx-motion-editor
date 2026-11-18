---
phase: 64-medium-engine
plan: 18
subsystem: ui
tags: [watercolor, emboss-light, document-light, undo-ledger, gesture-coalescing, slider-stepper, preact-signals, tdd]

# Dependency graph
requires:
  - phase: 64-05
    provides: the durable per-document `light` member on the paint-layer record and the ONE `setDocumentLight` mutation (wrap/clamp bands, null descriptor on a canonical no-op)
  - phase: 64-07
    provides: `lightSignature` (the canonical absent/DEFAULT_LIGHT normalizer), the Studio's `documentLight()` render-time getter and the package `DEFAULT_LIGHT` threading
  - phase: 64-09
    provides: the three controlled light rows in the `Paper & Light` tab and the `light` / `onLightChange` prop pair through `PhysicsPaintRightPanel`
provides:
  - the pure `coalesceLightGesture` beside `lightSignature` — a drag is one span or nothing, never a stream of entries
  - the `onLightCommit` release seam through RightPanelPaperTab and PhysicsPaintRightPanel (optional props; every existing literal still compiles)
  - the Studio's track-on-write / record-on-commit handler pair around ONE `setDocumentLight` call site, with the parked gesture as a descriptor ref
  - ledger regression rows — one drag = one undo step that restores the previous light; a same-value gesture leaves redo intact
affects: [64-19, 64-20, 64-UAT]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 9322
  tasks: 2
  commits: 3
plan_head_before: e78dcfb240ad0b2383de64d5b670b9488c71e7cc
plan_head_after: ff1ba2f548a3099ed58009f5ab9d46e6c90b935a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gesture span coalescing: the FIRST descriptor of a continuous change stream is parked in a ref and closed at the release boundary against the live document — the per-move path writes the document and records nothing"
    - "Canonical equality: the coalescer delegates 'same light' to `lightSignature`, the one normalizer the render cache already uses — an absent light and the explicit `DEFAULT_LIGHT` are one picture"
    - "Seam preservation: splitting one handler into write/record added no `setDocumentLight` call site — both handlers share `writeDocumentLight`, so the existing one-writer pin stays at 1 instead of being relaxed"

key-files:
  created:
    - app/src/components/physic-paint/engine/documentLightGesture.ts
    - app/src/components/physic-paint/engine/documentLightGesture.test.ts
  modified:
    - app/src/components/physic-paint/view/RightPanelPaperTab.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The coalescer lives beside `lightSignature` and delegates equality to it — the light normalization is never retyped (D-09's one-source law); only the `operationId` is minted (`crypto.randomUUID()`, the shipped span idiom's call)"
  - "The parked gesture is a `BackgroundEditDescriptor` ref — a descriptor, never a light mirror: the document stays the only light state and the no-second-light-state pin still holds"
  - "One `setDocumentLight` call site is preserved by extracting `writeDocumentLight`: the per-move and release handlers both call the helper, so the 64-09 whole-file pin stays at exactly 1 rather than being loosened to 2"
  - "The commit rows take the SliderStepper callback ARGUMENT (`next`), never the render-time `value` prop — keyboard/AT step and typed Enter/blur fire onChange + onCommit in one synchronous handler with no re-render between them, so a `value` closure would revert the light and coalesce to null"
  - "64-09's per-move-record pin was repointed to the handler that now owns it: the change handler must contain NO `recordBackgroundEdit`, and the commit handler exactly ONE recording of the coalesced descriptor — the same assertion shape, scoped by the plan's mandated contract change, not deleted or weakened"
  - "The coalescer and the record path are proven over the real store primitives (`registerDocument` + `setDocumentLight` + the real history hook), not mocks; the Studio wiring is source-pinned because the node vitest env collects only `*.test.ts` and never imports the 12k-line component"

requirements-completed: [MED-17]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The pure coalescer: a gesture's first descriptor plus the release document yields ONE descriptor spanning first.before -> release with the first kind and a fresh id; a same-light span (including absent vs explicit DEFAULT_LIGHT) yields null; a null first or null release yields null"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/documentLightGesture.test.ts#64-18 coalesceLightGesture"
        status: pass
    human_judgment: false
  - id: D2
    description: "One drag records exactly one ledger entry ({undo:1, redo:0}), undo restores the pre-gesture light, and a same-value gesture records nothing and leaves redo intact while a real change clears it"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#64-18 coalesced light gesture rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "The onLightCommit seam: all three rows emit onChange + onCommit with one-field patches, the panel threads the commit port into the single tab mount, and the Studio's change handler records nothing while the commit handler records exactly one coalesced span"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#64-18: every light row emits onCommit with the same one-field patch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#64-18: the commit handler records exactly ONE coalesced span and clears the gesture"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT (64-UAT row 4, the ledger clause): one slider gesture is one undo step that restores the previous light, and the live sheet still re-lights during the drag"
    verification: []
    human_judgment: true
    rationale: "Whether the live aquarelle sheet re-lights during a drag and whether a gesture reads as one undo step to the user are visual/interaction judgements over the WebGL2 canvas. The node vitest env never mounts PhysicsPaintStudio.tsx or the canvas layer, so no automated row can prove the visible re-light; the live sheet is run by the user."

# Metrics
duration: 48min
completed: 2026-11-18
status: complete
---

# Phase 64 Plan 18: One Light Gesture, One Ledger Entry Summary

**A light-slider drag now writes the document on every move (the live sheet keeps re-lighting) but lands exactly ONE coalesced undo entry at release — and records nothing when the gesture ends where it started**

## Performance

- **Duration:** 48 min
- **Started:** 2026-11-18T19:57:50Z
- **Completed:** 2026-11-18T20:46:35Z
- **Tasks:** 2
- **Files modified:** 9 (7 modified, 2 created, plus the RED-evidence JSON)

## Accomplishments
- The pure `coalesceLightGesture` closes CR-02's ledger half: given the gesture's first descriptor and the document at release, it returns one span (first `before` → release, first kind, fresh operation id) or null — with equality decided by the canonical `lightSignature`, so a drag out and back, or an absent light landing on explicit `DEFAULT_LIGHT`, records nothing.
- The `onLightCommit` release seam runs from the three rows through `PhysicsPaintRightPanel` into the Studio; `SliderStepper` guarantees exactly one commit per gesture on every release path (pointer, stepper press/hold, keyboard/AT, typed Enter/blur), and the rows carry the callback's reached value, never the stale `value` prop.
- The Studio's one light handler became a track/close pair around a single `writeDocumentLight` call site: the per-move path writes the document and parks the gesture's first descriptor recording NOTHING (no redo clear, no trim per move); the commit path lands the final idempotent patch, coalesces against the live document and records exactly one entry.
- Regression rows prove the ledger behaviour end to end: one 30-write drag → `{undo:1, redo:0}`, undo restores the pre-gesture light, availability flips to `{undo:0, redo:1}`; a same-value gesture leaves redo intact and a subsequent real gesture records one entry and clears it.

## Task Commits

Each task was committed atomically (Task 1 as the required RED/GREEN pair):

1. **Task 1a (RED): the failing coalescer and the ledger regression rows** - `bc7b295a3` (test)
2. **Task 1b (GREEN): the pure light-gesture coalescer** - `61dd3da8c` (feat)
3. **Task 2: the onLightCommit release seam** - `ff1ba2f54` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified
- `app/src/components/physic-paint/engine/documentLightGesture.ts` - the pure span-or-nothing coalescer beside `lightSignature`
- `app/src/components/physic-paint/engine/documentLightGesture.test.ts` - 5 store-driven rows: the thirty-write span, the back-to-start null, absent-vs-DEFAULT_LIGHT, the null arms, purity/fresh id
- `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` - `onLightCommit` prop; the three rows emit `onCommit={(next) => props.onLightCommit?.(...) }` beside `onChange`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - optional `onLightCommit` threaded beside `onLightChange` into the single tab mount
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `writeDocumentLight` (the one `setDocumentLight` call site), `documentLightGestureRef`, the change handler (park, record nothing) and the commit handler (land, coalesce, record once), wired into `rightPanelProps`
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` - two ledger regression rows added beside the background-descriptor block
- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` - two 64-18 rows: rows commit one-field patches with the reached value; the panel declares/forwards the commit port
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - the 64-09 block extended: `onLightCommit` in `rightPanelProps`, the per-move handler records nothing, the commit handler records exactly one coalesced span and clears the gesture before coalescing
- `.planning/phases/64-medium-engine/64-18-red-evidence-task1.json` - the Task 1 RED evidence (classifier: RED_EVIDENCE_OK)

## Decisions Made
- The coalescer delegates equality to `lightSignature`; only the `operationId` is minted (`crypto.randomUUID()`). No light normalization is retyped anywhere.
- The parked gesture is a `BackgroundEditDescriptor` ref — no signal, no light mirror, no render-body write. The document remains the only light state.
- One `setDocumentLight` call site is kept by sharing `writeDocumentLight` between both handlers, so the existing whole-file pin stays at exactly 1 (not relaxed to 2).
- Commit rows use the SliderStepper callback argument (`next`), never the render-time `value` — the synchronous keyboard/AT and typed Enter/blur paths would otherwise revert the light and coalesce to null.
- 64-09's per-move-record assertion was repointed to the handler that now owns the record: change handler zero `recordBackgroundEdit`, commit handler exactly one, recording the coalesced descriptor. The plan's own fails_when conditions mandate this contract change; no other pin was touched.

## TDD Gate Compliance

- Task 1 is behaviour-adding (`tdd="true"` + `<behavior>` + source files), so the RED gate applied. Evidence was captured before the GREEN edit at `.planning/phases/64-medium-engine/64-18-red-evidence-task1.json`; `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with the target row "coalesces a thirty-write drag into ONE descriptor spanning the pre-gesture document".
- RED (`bc7b295a3`): the coalescer existed as a type-correct stub returning null (a static import of a missing module would have killed collection → INVALID_RED), so the span and purity rows failed on real assertions while the null-arm rows passed; the two new history rows failed on the planned absent entry (`2 failed | 79 passed` in the history file).
- GREEN (`61dd3da8c`, `ff1ba2f54`): `pnpm --filter efx-motion-editor exec vitest run` over the plan's five files — `580 passed`; `tsc --noEmit` exit 0.
- Task 2 carries no `tdd` attribute and no `<behavior>` block, so `task.is-behavior-adding` is false; its tests and implementation landed together in one commit, as the plan prescribes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The RED phase required a stub module rather than a bare failing test: importing a non-existent `documentLightGesture.ts` would fail collection and read as an invalid RED. The stub returns `null` (the "nothing recorded" arm), which is exactly the RED behavior the planned assertions target.
- The vitest TAP capture was split by stream: sourcemap warnings go to stderr, so only stdout was recorded into the evidence JSON (clean `TAP version 13` report).
- `task.is-behavior-adding` was scoped to Task 1's own XML (passing the whole PLAN.md would have inherited Task 1's `tdd="true"` for Task 2).
- Pre-existing working-tree edits (`.planning/STATE.md`, `.planning/phases/64-medium-engine/64-BEADS.md` — orchestrator dispatch metadata) were deliberately left out of every task commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-02's ledger clause is closed and pinned at all four layers (coalescer, history hook, both view layers, Studio).
- The live UAT row this plan makes runnable is 64-UAT row 4's ledger clause: one slider gesture = one undo step restoring the previous light, with the sheet still re-lighting mid-drag.
- 64-19's re-bake/render work was deliberately untouched: `getContentSignature` still carries `lightSignature(documentLight())` unchanged.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-18*

## Self-Check: PASSED

- Files present: the SUMMARY itself, `documentLightGesture.ts` + its test, and `64-18-red-evidence-task1.json`
- Commits present and ancestors of HEAD: `bc7b295a3`, `61dd3da8c`, `ff1ba2f54`
- Measured plan span: `e78dcfb240ad0b2383de64d5b670b9488c71e7cc..ff1ba2f548a3099ed58009f5ab9d46e6c90b935a` = 3 commits (frontmatter `commits: 3`)
- Suites: the five plan test files ran 580 passed; `tsc --noEmit` exit 0
