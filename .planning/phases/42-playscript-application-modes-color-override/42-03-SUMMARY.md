---
phase: 42-playscript-application-modes-color-override
plan: 03
subsystem: physic-paint-roto
tags: [play-script, dialog, color-override, hold-loop, segmented-control, a11y, tdd, vitest]

requires:
  - phase: 42-playscript-application-modes-color-override
    plan: 02
    provides: controller option signals (mode/overrideColor/overrideEnabled/dialogMotion/repeatText/infinity/repeatError/loopReadout/setInfinity/resetDialogMotion/error) consumed by the dialog
provides:
  - "Full PLAY-03 option surface in the confirmation dialog: W3C APG mode radiogroup, mode-dependent Frames/Cycle frames field, color override swatch + inline picker with pick guard, application-time Motion sliders, Hold Loop block with readout (PLAY-03, PLAY-04)"
  - "Node-environment component test harness for the dialog (mocked preact/hooks + vnode walker + fake controller) locking the D-05/D-09/D-12/E5 contracts"
affects: [42-04 panel summary UI (renders appliedSummary only — no dialog coupling)]

actuals:
  tokens: 10365
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "W3C APG radiogroup as segmented control: roving tabindex, arrow keys move focus AND check with wrap, helper line via aria-describedby (no in-repo analog)"
    - "Pitfall 3 pick guard: capture-phase arming (onPointerDownCapture/onKeyDownCapture on the picker well) — mount-time onChange is ignored, override exists only after a deliberate pick"
    - "Node component test: invoke the function component directly with a cursor-based preact/hooks mock, walk the vnode tree, invoke handler props with fake events; InlineColorPicker module-mocked (its paintPreferences import instantiates a Tauri LazyStore)"
    - "Dialog-level generation error relocated above the action row through the shared physics-paint-script-inline-error class plus a dialog-error placement class"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "42-03: picker pick guard implemented as capture-phase arming on the picker well (plan offered arming OR dropping the first invocation) — the picker's root stops pointer propagation, so capture-phase handlers on the wrapper are the only reliable interception point"
  - "42-03: picker open/armed state kept as dialog-local useState/useRef — ephemeral view state with a clear locality reason (CLAUDE.md hook-retention clause); all option state stays on controller signals"
  - "42-03: dialog title/mode context moved into a new .physics-paint-play-script-header outside the scroll region (UI-SPEC E1 locked overflow structure); pre-existing CSS rules untouched — all additions are new .physics-paint-play-script-* rules"
  - "42-03: deliberate pick closes the picker immediately (plan: 'on pick set override + close'); reset keeps overrideColor for session memory and only flips overrideEnabled"

requirements-completed: [PLAY-03, PLAY-04]

coverage:
  - id: D1
    description: "Mode radiogroup semantics with arrow-key wrap; mode-dependent Frames/Cycle frames label; Hold Loop repeat/repeatError/setInfinity/readout bindings; D-15 first-time static defaults render"
    requirement: PLAY-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts (18 tests)"
        status: pass
  - id: D2
    description: "Color override: Original colors default, picker-open creates no override (Pitfall 3 contract), deliberate pick sets override + swatch hex + reset; Motion sliders write dialogMotion with 0-100 clamp; reset only via resetDialogMotion; E5 failure/cancellation rendering contract"
    requirement: PLAY-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts (18 tests)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-05
status: complete
---

# Phase 42 Plan 03: PlayScript Dialog Application Options Summary

**The Play Script confirmation dialog now renders the complete PLAY-03/PLAY-04 option surface as thin projections of the 42-02 controller signals: a W3C APG Progressive | Static / Hold segmented radiogroup with arrow-key wrap and helper line, the mode-dependent Frames/Cycle frames field, a color override swatch with an inline-mounted picker whose mount-time onChange can never create an override, application-time Motion sliders with a controller-only reset, the Hold Loop block with Infinity preserve/restore and requested/effective readout, and the E5 generation-failure error surface — all inside the verified isolated .physics-paint-play-script-* scope.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-05T19:28:53Z
- **Completed:** 2026-08-05T19:37:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created)

## Accomplishments

- Mode segmented control (D-05): `role="radiogroup"` + two `role="radio"` options with exact locked labels, `aria-checked`, roving tabindex (checked = 0), ArrowLeft/ArrowRight move focus AND check with wrap-around, helper line via `aria-describedby` updating on selection — integrates with the existing Tab focus-trap query as a single Tab stop
- Mode-dependent frame field (D-03): one shared input whose label switches `Frames` / `Cycle frames`; help copy unchanged
- Hold Loop block (D-12/D-13): Repeat input bound to `repeatText` with `aria-invalid`/error span on the controller `repeatError` channel, Infinity toggle wired exclusively through `setInfinity` (repeat input disabled with value intact while on), loop readout rendering `loopReadout` verbatim with `tabular-nums`
- Color override (D-08/D-09): `Original colors` default; swatch shows the picked `#rrggbb` as data (never accent); explicit `Original colors` reset; `InlineColorPicker` mounted INLINE in the content column with a capture-phase pick guard so the mount-time `onChange` never flips `overrideEnabled` (Pitfall 3 contract test)
- Application-time Motion (D-06): Deformation/Position sliders (0-100 clamp) writing `dialogMotion` only; `Reset to Motion defaults` calls ONLY `resetDialogMotion()`; no `Save as defaults` anywhere
- E5 contract: generation failure renders verbatim through the shared `physics-paint-script-inline-error` style (#a12f37, 12px) above the action row with no progress bar and re-enabled controls; normal cancellation renders no error element; all new controls disable under the existing `canCancel` rule
- Overflow structure (UI-SPEC E1): title/mode context moved into a header outside the scroll region; only the content column scrolls (overflow-y auto, overflow-x hidden); action row always visible
- Wave gates: targeted suites 73/73, full app suite 1148 passed, package animation suites 67/67, `pnpm --dir app typecheck` clean, CSS diff purely additive inside `.physics-paint-play-script-*` selectors

## Task Commits

Each task was committed atomically (TDD RED then GREEN for Task 2):

1. **Task 1: mode segmented control, mode-dependent frame field, and Hold Loop block** — `0a003a0d` (feat)
2. **Task 2 (RED): failing dialog component test for color override, Motion controls, and E5 states** — `b98a4a85` (test)
3. **Task 2 (GREEN): color override picker, application-time Motion controls, generation-error surface** — `e85754fb` (feat)

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — mode radiogroup block, mode-dependent label, override swatch row + inline picker with pick guard, Motion slider group + controller-only reset, Hold Loop block, header/scroll restructure, generation-error relocation
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` — NEW: 18-case component test (vnode-walking harness over a fake 42-02 controller; mocked `preact/hooks` and `InlineColorPicker`)
- `app/src/components/physic-paint/physicsPaintStudio.css` — additive rules only, all under the `.physics-paint-play-script-*` prefix (segmented track/checked accent, header, sections, repeat row/toggle, readout, swatch/chip/reset, picker well, slider rows, motion reset, dialog-error, focus outlines)

## Decisions Made

- **Pick guard mechanism:** capture-phase arming on the picker well (`onPointerDownCapture`/`onKeyDownCapture`). The plan offered "arm on first interaction OR drop the first invocation"; `InlineColorPicker`'s root stops pointer-event propagation, so capture-phase handlers on the wrapper are the only reliable interception point.
- **Dialog-local picker state:** `useState`/`useRef` for picker open/armed — ephemeral view state with a clear locality reason (CLAUDE.md hook-retention clause); every piece of option state remains on controller signals.
- **Overflow restructure:** the title/mode context moved into a new `.physics-paint-play-script-header` outside the scroll region per the locked E1 structure; pre-existing CSS rules were left untouched (new header rules duplicate the strong styling additively).
- **Pick closes the picker; reset keeps the color:** a deliberate pick sets `overrideColor` + `overrideEnabled` and closes the picker (plan wording); the `Original colors` reset only flips `overrideEnabled`, retaining `overrideColor` as session memory (D-10) so re-opening is seeded.

## Deviations from Plan

None - plan executed exactly as written. (Task 1's verify was scoped to the controller suite per the plan-checker revision; the new dialog test belongs to Task 2's verify and ran there.)

## Authentication Gates

None.

## Known Stubs

None — every control is wired to the 42-02 controller signals and exercised by the 18-case component test; no placeholder data flows to the UI.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes beyond the plan's threat model (T-42-03-01: the dialog mirrors controller validation state only, never parses; T-42-03-02 accepted: user's own session values rendered with framework escaping; zero new dependencies).

## Issues Encountered

None beyond the documented decisions. The RED run failed exactly the 8 intended Task 2 cases (10 Task 1 surface cases already green); GREEN passed 18/18 on the first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 42-04 renders `appliedSummary.line1/line2` verbatim in the Scripts panel — no dialog coupling needed; the dialog surface this plan ships is the write path that the 42-02 controller already composes into the summary on successful Generate.
- PLAY-03/PLAY-04 marked complete; the remaining UI-SPEC tooltip update (Pitfall 8: `Play Script — Generate progressive real Roto keys` → both modes) is 42-04 panel scope.
- Native UAT of the expanded dialog (overflow at minimum window size, picker interaction, focus outlines) remains the human verification layer per the E1 contract.

## TDD Gate Compliance

- RED commit `b98a4a85` (`test(42-03)`) precedes GREEN commit `e85754fb` (`feat(42-03)`) for the only `tdd="true"` task; the RED run failed exactly the 8 new-feature cases before any implementation.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx (role="radiogroup", 'Original colors', 'Reset to Motion defaults', InlineColorPicker inline mount, physics-paint-play-script-dialog-error)
- FOUND: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts (18 tests, Pitfall 3 contract case)
- FOUND: commit 0a003a0d (Task 1), b98a4a85 (Task 2 RED), e85754fb (Task 2 GREEN)
- Task 2 verify exits 0 (73/73 across dialog/panel/controller suites); full app suite 1148 passed; package animation suites 67/67; typecheck clean; CSS diff additive-only within the dialog scope

---
*Phase: 42-playscript-application-modes-color-override*
*Completed: 2026-08-05*
