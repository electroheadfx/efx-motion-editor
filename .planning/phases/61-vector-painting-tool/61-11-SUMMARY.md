---
phase: 61-vector-painting-tool
plan: 11
subsystem: ui
tags:
  - watercolor
  - vector-path
  - path-edit
  - stroke-settings
  - preact-signals
  - tdd
  - undo

# Dependency graph
requires:
  - phase: 61-05
    provides: "The sparse per-anchor width field — absent width reads 1.0, width 1.0 is never stored"
  - phase: 61-08
    provides: "vectorPathSession — pathEditMutationId, enterPathEdit/exitPathEdit and vectorAnchorSelection"
  - phase: 61-09
    provides: "VectorPathOverlay — the canvas surface a path edit opens onto"
  - phase: 61-10
    provides: "beginAquarellePathEdit (the one-undo-entry seam), buildAnchorWidthCommit and the anchor selection actions"
provides:
  - "strokeSettingsModel.ts — resolvePathEditGate, shouldExitPathEdit, AQUARELLE_ANCHOR_WIDTH_MIN/MAX/STEP/DEFAULT (0.2/2/0.1/1), readAnchorWidthReading, anchorWidthEffectivePx, anchorWidthPatchValue, and the readVectorAnchors/applyAnchorWidths bundle members"
  - "PhysicsPaintStrokeSettingsDialog.tsx — the SplinePointer Edit path header button (aria-pressed, disabled reasons in title, safe exit) and the Anchor width stepper under Size"
  - "PhysicsPaintStudio.tsx — readVectorAnchors and applyAnchorWidths, the record-seam reads the dialog consumes"
affects:
  - 61-12..61-14 (the dialogs and exports that read the per-anchor width)
  - Any later Paint-tab row that must stay outside the appearance-field registry

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 12634
  tasks: 3
  commits: 5
plan_head_before: 8d8de2525e08eb631f80758139bdefb30dde3707
plan_head_after: b64f0ecbf4300344bedf6eae0312d6b0ef44d3ea

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A frozen header button resolves its whole state from one pure gate: enabled / title / pressed decided in the model, the leaf only binds"
    - "Leaving a session mode is a plain render-body marker consumed by the shipped lifecycle effect — no signal write from a render body, no new useEffect"
    - "A non-appearance control mounts as the Size row's sibling from the registry map and commits through its own bundle member, never buildAppearancePatch"
    - "One stepper change = one buildAnchorWidthCommit list = one beginAquarellePathEdit call = one undo entry"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The gate reads vector-ness through ONE bundle member (readVectorAnchors): the dialog never touches the record store, and the same read feeds the gate, the width reading and the px readout."
  - "A closed gate or a close both request exitPathEdit through the shipped lifecycle effect; the render body only sets a plain module marker, so no signal is written during render and the sheet keeps exactly two effects."
  - "The Anchor width factor is a per-anchor multiplier, not an appearance param: the block mounts as the Size row's sibling and never enters WATERCOLOR_SETTINGS_FIELDS or readNumericField/buildAppearancePatch."
  - "The px readout is Size x the anchor factor rounded to one decimal and is hidden for an empty anchor selection, where the caption owns the message instead."
  - "The anchor band (0.2-2.0) is its own constant set; MULTIPLIER_MIN stays the shipped 0.5 and is never reused."

patterns-established:
  - "Gate-then-leaf: a header button's enabled/title/pressed state is a pure model function, pinned by literals in the model test"
  - "Marker-then-effect: render bodies never write session signals; a plain module flag is consumed by the one lifecycle effect"
  - "Per-vertex width is read by index from the overlay's selection and committed whole in one call"

requirements-completed: [VEC-02, VEC-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The Edit path header button is enabled only for exactly one vector stroke, explains each disabled state in its native title, reports aria-pressed from the session, and close or a closed gate exits path edit without stranding the overlay"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-11 path-edit gate (Edit path header button); app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 Edit path header button (E2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Anchor width stepper reads the selected anchors (empty at 1.0 disabled with its caption, mixed across differing factors), shows Size x factor in px, clamps typed values to 0.2-2.0, and commits every selected anchor in one undo entry"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-11 Anchor width reading (Paint tab) and #61-11 E4 error, partial and long-text rows; app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-11 Anchor width bundle wiring in the Studio"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live UAT: select one vector stroke, press Edit path, drag an anchor, press it again and watch the mode leave; select two anchors and raise Anchor width to 1.8 — the envelope thickens at those anchors only"
    requirement: VEC-03
    verification: []
    human_judgment: true
    rationale: "Stepper feel, the on-canvas envelope response and the pressed header state are visual surface checks; unit tests prove the recorded data, not the on-screen result"

# Metrics
duration: 13min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 11: Edit Path Entrance and Anchor Width Summary

**An `Edit path` header button whose enabled/pressed/reason state is one pure gate and which cannot strand a path edit on close or deselection, plus an `Anchor width` stepper that reads the selected anchors, shows the honest Size x factor px readout, clamps typed values to 0.2-2.0, and commits a multi-anchor change as one undo entry**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-10T15:31:01Z
- **Completed:** 2026-11-10T15:44:13Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `resolvePathEditGate` decides the whole header button state from `selectionSize`, `vectorStrokeCount`, the selected id and the active path-edit id; the two disabled reasons are model constants (`Edit path — select one vector stroke` / `Edit path — select a single vector stroke`), so the sheet can never inline its own copy.
- The `SplinePointer` button sits between the preview-stroke-size and view-toggle neighbours with the shipped 22x22 chrome, a fixed `aria-label`, `aria-pressed` from the session and stop-propagation on the press; pressing enters `enterPathEdit`, pressing again leaves.
- Leaving the mode is safe on every route: `closeSurface` calls `exitPathEdit()`, and a render-body guard sets a plain module marker consumed by the shipped lifecycle effect when the gate closes (deletion, re-selection, filter-empty, rail-toggle close) — no new `useEffect`, no signal write during render.
- `readAnchorWidthReading` reports the first selected anchor's factor, the mixed state, and how many listed indices the path carries (an absent `width` is 1.0); `anchorWidthEffectivePx` multiplies the real Size by the factor and rounds to one decimal (`20 x 1.8 -> 36`), so the readout never lies via `scriptScale`.
- The `Anchor width` block mounts directly under Size, outside the appearance-field registry: disabled at 1.0 with `Select anchors on the canvas to set their width.` when no anchor is selected, the shipped `mixed` caption when the factors differ, and a `→ {n} px` readout otherwise.
- `applyAnchorWidths` builds the whole next anchor list with `buildAnchorWidthCommit` over the live `vectorAnchorSelection` and drives it through exactly ONE `beginAquarellePathEdit` call — a three-anchor change is one undo entry (T-61-38).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end Edit path header button (tracer, TDD)** - `9097b8339` (test), `955c3f925` (feat)
2. **Task 2: Anchor width stepper and one-edit commit (TDD)** - `183aedad0` (test), `d27e6502d` (feat)
3. **Task 3: Close the E2 and E4 rows** - `b64f0ecbf` (test)

**Plan metadata:** see the final docs commit (SUMMARY/STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - The path-edit gate and exit predicate, the anchor-width band constants and the three pure width helpers, plus the two optional bundle members
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - Six gate cases and the width reading / clamp / effective-px / mixed cases with their E4 error and long-text rows
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - The `Edit path` header button, the render-body exit marker, the lifecycle-effect consumption, `exitPathEdit()` on close, and the `Anchor width` block under Size
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - Source pins on the button mount, ordering, chrome, bindings and exit paths; the Anchor width mount, band bindings, empty branch and the E2/E4 row ledger
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `readVectorAnchors` (single vector stroke or null) and `applyAnchorWidths` (one path edit), plus the `buildAnchorWidthCommit` import
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Pins that both bundle members are supplied and that the width commit calls `beginAquarellePathEdit` exactly once

## Decisions Made
- The dialog's vector-ness read is ONE bundle member (`readVectorAnchors`); the gate, the width reading and the px readout share it, so the dialog never touches the record store.
- Exit safety uses the shipped marker-then-effect pattern (`strokeSettingsViewInvalidated` precedent) rather than a new effect or a render-body session write.
- The block mounts as the Size row's sibling *from* the registry map (returning `[row, block]`) so it is visually directly under Size, but it is deliberately NOT a registry entry and never routes through `readNumericField`/`buildAppearancePatch`; the test pins both facts.
- The px readout is hidden while the anchor selection is empty — the caption owns that state, and `→ Size px` would restate the Size row above.
- The band is its own constant set; `MULTIPLIER_MIN` remains 0.5 and is untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `readVectorAnchors` bundle member landed in Task 1, not Task 2**
- **Found during:** Task 1 (Edit path gate)
- **Issue:** The gate's `vectorStrokeCount` input cannot be resolved from the shipped bundle (no member exposes vector-ness) and the dialog must not read the record seam itself. Without the read, the tracer's entrance could never be enabled for any stroke.
- **Fix:** Added the optional `readVectorAnchors(ids)` member to `StrokeSettingsDialogBundle` and implemented it in the Studio in Task 1 (`normaliseAquarelleAnchors(stroke.anchors) ?? null` for a single selection); Task 2 then added only `applyAnchorWidths`.
- **Files modified:** `app/src/components/physic-paint/view/strokeSettingsModel.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** Task 1 file set green (157 tests) and `tsc --noEmit` clean; the Task 2 Studio pin for `readVectorAnchors` already passed at RED.
- **Committed in:** `955c3f925` (Task 1 GREEN)

**2. [Rule 1 - Bug] Corrected the committed Task-1 pin on the session import line**
- **Found during:** Task 1 (GREEN) and again in Task 2
- **Issue:** The RED pin asserted `import { clearVectorAnchorSelection, enterPathEdit, exitPathEdit, pathEditMutationId, vectorAnchorSelection }`. `exitPathEdit()` already owns the anchor-selection clear, so `clearVectorAnchorSelection` would be an unused import (`noUnusedLocals` fails), and `vectorAnchorSelection` had no Task-1 consumer.
- **Fix:** The pin now asserts the truthful line: the three Task-1 symbols, then all four once Task 2's block reads the anchor selection.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** `tsc --noEmit` clean; the dialog test passes in both task states.
- **Committed in:** `955c3f925` (Task 1 GREEN), final line in `d27e6502d` (Task 2 GREEN)

**3. [Rule 1 - Bug] Removed an unused source constant that broke the TypeScript gate**
- **Found during:** Task 1 (GREEN verification)
- **Issue:** The new dialog test declared `studioSource` but never read it; `tsc --noEmit` failed with TS6133 under `noUnusedLocals`.
- **Fix:** Removed the unused read (the Studio pins live in `PhysicsPaintStudio.test.ts`).
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** `tsc --noEmit` clean.
- **Committed in:** `955c3f925` (Task 1 GREEN)

**4. [Rule 1 - Bug] E2 long-text assertion matched the button's own arrow handlers**
- **Found during:** Task 3 (verify run)
- **Issue:** `expect(button).not.toMatch(/>\s*[A-Za-z]/)` also matched `onPointerDown={(event) => event.stopPropagation()}` and `onClick={() => {`, so it failed on correct markup.
- **Fix:** Replaced it with the truthful claim for the same row: the whole child list is the glyph (`> <SplinePointer ... /> </button>`) and the copy rides the native `title`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** Task 3 file set green (174 tests).
- **Committed in:** `b64f0ecbf` (Task 3)

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3)
**Impact on plan:** No scope creep. The Rule 3 member is required for the gate to be truthful; the three Rule 1 fixes are test-pin corrections caused by this plan's own wiring and the TypeScript gate.

## Issues Encountered
- RED for Task 1 needed a shape-only scratch stub in `strokeSettingsModel.ts` so the new imports resolved and the failures were assertions, not load errors; the stub was replaced during GREEN and never committed.
- The tracer feedback gate re-ran the plan's automated `<verify>` after the Task 1 commit (interactive mode, end-of-phase human verify): 523/523 across the three files, no checkpoint.
- Full app suite at the wave gate: 418 files passed / 2 skipped; 8662 tests passed, 1 skipped, 96 todo, 0 failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VEC-02 and VEC-03 are implemented and pinned: the entrance refuses cleanly, cannot strand a path edit, and the width control commits one undo entry per change.
- End-of-phase live UAT remains (D3): one vector stroke + Edit path + drag + press again; two anchors + `Anchor width` 1.8 and the envelope thickens at those anchors only.
- `MULTIPLIER_MIN` and every shipped Paint-tab field are unchanged (`grep -n "MULTIPLIER_MIN = "` -> 0.5).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All key files exist on disk (`PhysicsPaintStrokeSettingsDialog.test.ts` created; the six modified files present).
- All five plan commits (`9097b8339`, `955c3f925`, `183aedad0`, `d27e6502d`, `b64f0ecbf`) are ancestors of HEAD.
