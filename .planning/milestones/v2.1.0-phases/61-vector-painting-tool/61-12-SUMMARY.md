---
phase: 61-vector-painting-tool
plan: 12
subsystem: ui
tags:
  - watercolor
  - render-mode
  - simple-ribbon
  - stroke-settings
  - preact-signals
  - tdd
  - undo

# Dependency graph
requires:
  - phase: 61-03
    provides: "AquarelleRenderMode, AQUARELLE_RENDER_MODES, isAquarelleRenderMode, resolveAquarelleRenderMode and the sparse renderMode stroke field"
  - phase: 61-05
    provides: "AQTL v2 / SNAP v5 — the render mode round-trips through save and reopen"
  - phase: 61-07
    provides: "The simple-ribbon BrushPreset (renderMode: 'simple-ribbon') and its crisp thumb"
  - phase: 61-11
    provides: "readVectorAnchors/applyAnchorWidths — the bundle pattern and the dialog's ref-held-signal + source-scan test grammar"
provides:
  - "strokeSettingsModel.ts — RENDER_MODE_OPTIONS, readRenderMode, SIMPLE_RIBBON_GLOBALS (the seven Water color rows minus Size), SIMPLE_RIBBON_WET_NOTE and readSimpleRibbonGlobal"
  - "PhysicsPaintStrokeSettingsDialog.tsx — the Render row (first Paint child, above Color) and the collapsed Advanced — wet globals disclosure (24px row, 12px chevrons, seven SliderSteppers, UI-SPEC note)"
  - "aquarelleRecordState.ts — updateAquarelleRenderModeInScript (one batch law), AQUARELLE_WET_KEYS, setAquarelleWetGlobals, aquarelleSimpleRibbonWetMemory and the ribbon pick law inside selectAquarelleTip"
  - "aquarelleStrokeSelection.ts — beginAquarelleRenderModeEdit (one undo entry for the whole selection)"
  - "PhysicsPaintStudio.tsx — the renderMode appearance hydration and the ONE applyRenderMode commit path"
affects:
  - 61-13 (wireframe/Draft row now shares the Paint tab with the disclosure)
  - 61-14 (export parity for a per-stroke render mode)
  - Any later Paint-tab control that must sit outside the appearance-field registry

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 19092
  tasks: 3
  commits: 5
plan_head_before: f9dc021ffba624bb9526a2f496cbffb390801d21
plan_head_after: 5368c45317d21ba19101af5c4620c6bf39e96189

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A string discriminator mounts as its own Paint-tab block and never rides readNumericField / buildAppearancePatch / segmentedFields"
    - "A batch field write resolves and de-duplicates targets BEFORE mutating, replaces the stroke and its payload entry at the SAME index, bumps once and returns the count"
    - "already-matching is judged through resolveAquarelleRenderMode, so an absent mode equals watercolor and a pre-phase stroke never gains a key for a value it already has"
    - "A preset pick is a render-mode pick: the law runs BEFORE the identity early-return, so a re-pick re-establishes the state"
    - "setAquarelleWetGlobals is the one-write batch form of setAquarelleParam — one bag build, one signal assignment, one render"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.renderMode.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.simpleRibbonWet.test.ts
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The mode is a STROKE property: the mutator reads no anchors, so a malformed anchor list can never refuse a mode change and no write creates, drops, copies or normalises an anchor list (D-12/D-14 / T-61-40)."
  - "An unknown mode refuses the WHOLE batch via the strict isAquarelleRenderMode membership test — never a silent fall back to the watercolor default (T-61-42)."
  - "The Render row is gated on the Paint tab and the watercolor engine only — never on readVectorAnchors, which is the 61-11 gate and would have hidden the row from hand-painted strokes."
  - "The wet-globals law lives inside selectAquarelleTip BEFORE the currentId === nextId early return, so re-picking simple-ribbon re-zeroes the bag instead of returning (D-13)."
  - "The memory is snapshotted only when empty: raising a wet term while the ribbon is active can never overwrite the pre-ribbon origin."
  - "The Studio takes a separate `import type { AquarelleRenderMode }` line because the existing payload import statement is verbatim-pinned by a shipped source-scan test."

requirements-completed:
  - VEC-04

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The Paint tab opens on a Render row above Color with exactly the Watercolor and Ribbon options, the shipped Mixed caption, and no anchor read gating it."
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-12 Render mode reading (Paint tab)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-12 Render row (E3)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-12 Render mode bundle wiring in the Studio"
        status: pass
    human_judgment: false
  - id: D2
    description: "Switching one vector stroke and one hand-painted stroke to Ribbon produces the same crisp sweep without a path ever being drawn, and two different modes show Mixed."
    requirement: VEC-04
    verification: []
    human_judgment: true
    rationale: "The deposited pixels and the visible Mixed caption need a live Studio selection; no unit probe renders the engine deposit."
  - id: D3
    description: "A render-mode change is one undo entry for the whole selection, one revision bump, and leaves every anchor list byte-identical while an anchorless stroke gains no anchors key."
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.renderMode.test.ts#61-12 aquarelle render-mode batch write"
        status: pass
    human_judgment: false
  - id: D4
    description: "A stroke created with the ribbon preset carries seven zero wet globals; the Advanced disclosure is reachable, raising Water blends physics back in, and leaving the preset restores the pre-ribbon bag."
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.simpleRibbonWet.test.ts#61-12 simple-ribbon wet-global pick law"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-12 Advanced wet globals (E5)"
        status: pass
    human_judgment: true
    rationale: "The blend-back law (raise Water -> the bloom returns) and the restore-on-leaving flow are pixel outcomes that only live painting can confirm."
  - id: D5
    description: "The disclosure is a collapsed 24px row with 12px chevrons, seven rows and the verbatim note, and watercolor mode keeps today's Paint tab unchanged."
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-12 Advanced wet-globals disclosure (E5)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-12 Advanced wet globals (E5)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 12: Render mode and the Advanced wet-globals disclosure Summary

**A per-stroke Render row (Watercolor / Ribbon) commits the whole Paint selection as one undoable edit without touching any anchor list, and the ribbon preset genuinely zeroes the seven wet globals behind a collapsed Advanced disclosure that restores them when the preset is left**

## Performance

- **Duration:** 17 min
- **Started:** 2026-11-10T15:49:55Z
- **Completed:** 2026-11-10T16:06:37Z
- **Tasks:** 3
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- The Paint tab opens on a `Render` row above `Color`: two segments (`Watercolor`, `Ribbon`), the shipped red italic `Mixed` for a split selection, and a press of the active mode writing nothing.
- `updateAquarelleRenderModeInScript` is one batch law: strict union validation, de-duplication, a pure `renderMode` field replacement reprojected through `toStudioStroke`, the same timeline index, one bump and one undo entry for the whole selection.
- The mode is a stroke property, never a path property — the batch test pins the hand-painted entry's continued ABSENCE of an `anchors` key and the byte-identical anchor lists of the vector strokes.
- `SIMPLE_RIBBON_GLOBALS` is exactly the Water color rows minus `Size`; the disclosure mounts only for a `simple-ribbon` selection, collapsed by default, and renders the seven `SliderStepper`s plus the UI-SPEC note at line-height 1.5.
- Picking the `simple-ribbon` preset snapshots the seven wet values and zeroes them in ONE `aquarelleParams` write, so `snapshotAquarelleRecord()` reports real zeros; any later non-ribbon pick restores the remembered bag and clears the memory.

## Task Commits

Each task was committed atomically:

1. **Task 1: The Render row, its reading and the one-edit commit seam** (tracer, tdd) - `344f396ce` (test) + `8bfa53068` (feat)
2. **Task 2: The batch commit — one undo entry for the whole selection** (tdd) - `b768da04c` (test) + `282154cad` (feat)
3. **Task 3: The Advanced wet-globals disclosure and the ribbon pick law** - `5368c4531` (feat)

**Plan metadata:** `docs(61-12)` commit (this SUMMARY + STATE/ROADMAP)

_Note: TDD tasks carry a separate `test(...)` commit for the RED evidence and a `feat(...)` commit for the GREEN implementation._

## Files Created/Modified

- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - `RENDER_MODE_OPTIONS`, `RenderModeReading`/`RenderModeOption`, `readRenderMode`, the `applyRenderMode` bundle member, `SIMPLE_RIBBON_GLOBALS`, `SIMPLE_RIBBON_WET_NOTE`, `readSimpleRibbonGlobal`
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - the Render block (first Paint child) and the Advanced disclosure (ref-held open signal, 24px row, chevron swap, seven steppers, note)
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - `updateAquarelleRenderModeInScript`, `AquarelleWetKey`/`AQUARELLE_WET_KEYS`, `aquarelleSimpleRibbonWetMemory`, `setAquarelleWetGlobals` and the pick law in `selectAquarelleTip`
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - `beginAquarelleRenderModeEdit` (ghost clear, in-flight guard, snapshot pair, no paint-seed bump)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `handleAquarelleRenderModeStrokes`, the hydrated `readAppearance`, `applyRenderMode(ids, mode)`, the memo dep and the separate `AquarelleRenderMode` type import
- `app/src/components/physic-paint/view/aquarelleRecordState.renderMode.test.ts` - five batch-law cases (vector + hand-painted, anchor preservation, bump/repeat/dedupe, one history entry, malformed + skipped ids)
- `app/src/components/physic-paint/view/aquarelleRecordState.simpleRibbonWet.test.ts` - six pick-law cases (one write, recorded zeros, restore, re-pick, null pick, no-op batch)
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - the seven-label/zero/mixed/long-text model cases
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - the E5 source-scan pins (mount point, gate, collapsed default, chevrons, note, seven rows)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - the 61-12 wiring block plus two widened shipped count pins

## Decisions Made

- **`already-matching` reads through `resolveAquarelleRenderMode`.** An absent mode IS watercolor (D-12), so writing Watercolor on a pre-phase stroke is a no-op: no key is materialised and no revision is bumped (REL-02 byte shape preserved).
- **Strict membership, not coercion.** `isAquarelleRenderMode` guards the whole batch, so an unknown mode writes nothing instead of silently landing `watercolor` (T-61-42).
- **The disclosure's open state is a ref-held local signal written only from the click handler.** No third `useEffect(...)` was added — the dialog's exactly-two-effects pin still holds (T-61-43).
- **`readSimpleRibbonGlobal` reuses `NumericFieldReading`.** Same `{ value, mixed }` shape as the numeric rows, with a 0 fallback instead of the canonical default: zero is a real stored value for the ribbon preset, never a display fallback.
- **The wet law runs before the identity early-return in `selectAquarelleTip`,** mirroring where `setAquarelleTool('brush')` already runs, so a re-pick re-establishes the zeros.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 landed the minimal mutator and wrapper that Task 2 owns**
- **Found during:** Task 1 (the tracer)
- **Issue:** `PhysicsPaintStudio.test.ts` pins `applyRenderMode` to call `beginAquarelleRenderModeEdit` exactly once, and the Studio must compile before Task 2 lands. Without a callable wrapper the Task-1 pin would have to be committed failing (`fixture_or_load_failure`), not RED.
- **Fix:** a deliberately minimal `updateAquarelleRenderModeInScript` (write + count, no law) and the full `beginAquarelleRenderModeEdit` wrapper landed in the Task-1 GREEN commit; Task 2 replaced the body with the full batch law and its RED genuinely failed on no-op/unknown-mode/out-of-timeline cases.
- **Files modified:** `aquarelleRecordState.ts`, `aquarelleStrokeSelection.ts`
- **Verification:** Task 2's RED returned `RED_EVIDENCE_OK` with `expected 2 to be +0`; both verify targets green after the GREEN commit.
- **Committed in:** `8bfa53068` (seam) and `282154cad` (law)

**2. [Rule 1 - Bug] Relaxed the `Mixed` caption assertion to the JSX line shape**
- **Found during:** Task 1 (dialog source-scan test)
- **Issue:** `expect(block).toContain('>Mixed</span>')` failed because the JSX renders `>`, `Mixed` and `</span>` on separate lines.
- **Fix:** `expect(block).toMatch(/>\s*Mixed\s*<\/span>/)` — still pins the single word, no value and no second sentence.
- **Files modified:** `PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** the retargeted pin passes; `renderBlock()` still contains the `MIXED_CAPTION_STYLE` binding.
- **Committed in:** `8bfa53068`

**3. [Rule 1 - Bug] Widened two shipped Studio source-scan counts**
- **Found during:** Task 1 (Studio wiring)
- **Issue:** the new render-mode handler adds a twelfth refusal-route mention (pin expected 11) and a ninth durable-base recovery site (pin expected 8).
- **Fix:** raised the counts to 12 and 9, updated the failure messages, and added `handleAquarelleRenderModeStrokes` to the recovery-loop list.
- **Files modified:** `PhysicsPaintStudio.test.ts`
- **Verification:** the full 373-test Studio contract passes.
- **Committed in:** `8bfa53068`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** No scope creep. The seam deviation is the 61-11 `readVectorAnchors` precedent (a wrapper the plan assigns to a later task must exist for an earlier task's pinned call site); the two test-count corrections describe real new code.

## Issues Encountered

- **RED evidence adapter:** the TDD classifier rejects vitest's TAP output in this repo (pnpm's `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` banner on stdout, then malformed nested TAP/YAML diagnostics, and `tap-flat`'s diagnostic blocks). Both tasks captured RED with `--reporter=junit --outputFile=...` into `.planning/phases/61-vector-painting-tool/.red-evidence/61-12-tN/` (the phase's existing untracked convention) and each returned `RED_EVIDENCE_OK` on the first attempt.
- No git hooks are installed (`core.hooksPath` = `.git/hooks`, no non-sample hooks); `tsc --noEmit` exit 0 after every task.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. No hardcoded empty values flow to the UI, no placeholder copy, and no component receives mock data: the disclosure reads the live recorded params through `readSimpleRibbonGlobal`, and the Render row reads the hydrated appearances.

## Threat Flags

None beyond the plan's threat model. T-61-40 (anchor tampering), T-61-41 (one undo entry), T-61-42 (unknown mode) and T-61-43 (disclosure re-render) are each pinned by a named test case; T-61-SC holds — no dependency was added.

## Next Phase Readiness

- VEC-04 is complete: any paint stroke's render mode — vector or hand-painted — is readable and safely editable, and the ribbon preset's wet globals are genuinely zeroed and restored.
- Visual UAT is still pending for the three pixel-level rows (crisp sweep on both stroke families, `Mixed`, and raise-Water/leave-preset blend-back).
- Wave 8 continues; the full app suite is green (420 files, 8699 tests) and the bundle stays under the 2 MB chunk ceiling.

## Self-Check: PASSED

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*
