---
phase: quick-261022-o2a
plan: 261022-o2a
subsystem: ui
tags: [preact, signals, dialog, script-picker, tools-popover, sidebar, focus-restoration]

# Dependency graph
requires:
  - phase: quick-261022-ne3
    provides: Tools popover Scripts clones and the shared styled-tooltip toolbar idioms
provides:
  - Floating Script picker with load-apply and create-rail intents
  - Tools popover split into Scripts (Save / Load + Apply / Create Rail) and Living Script (Copy / Apply / Clear)
  - Four-label sidebar Scripts toolbar
  - Per-row hover/focus trash with trigger focus restoration
affects: [physic-paint, scripts-sidebar, tools-popover]

# Actuals (#2632) — chars/4 over the realized diff (133895 / 4).
actuals:
  tokens: 33474
  tasks: 3
  commits: 3

plan_head_before: 1453a4406588b64854e7b59cad7771a49e2237fd
plan_head_after: 47e7ee26c2d4446b8de75733f2b8d94614727fc9

tech-stack:
  added: []
  patterns:
    - "Intent-scoped floating picker: scene-level signal + single-entry createIdentityMemo bundle"
    - "Toolbox dismissal exemption via data-toolbox-dismiss-exempt for nested floating dialogs"
    - "Per-row destructive intent that selects then routes through the shared confirmation"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/physicsPaintToolboxPopover.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx

key-decisions:
  - "The picker calls only rotoScriptLibrary.select(id); Create Rail then checks rotoPlayScript.disabledReason.peek() and routes refusals to the existing error channel."
  - "The Tools popover steps aside for the picker through a data-toolbox-dismiss-exempt selector, so Escape closes one layer at a time and outside clicks still close both."
  - "The sidebar per-row trash is gated only by actionMutationDisabledReason, never availability.canDelete, because that flag requires an existing selection."
  - "The trash records its row id before selecting; focus restoration resolves the same row's trash by CSS.escape and falls back to the nearest surviving row."

requirements-completed: []

# Metrics
duration: ~53min
completed: 2026-10-22
status: complete
---

# Quick Task 261022-o2a: Tools Scripts modal and Scripts sidebar regroup Summary

**Script picker reached from the Tools popover, a Scripts / Living Script split, and a four-label sidebar toolbar with per-row hover deletion that keeps the shared confirmation as the only commit surface**

## Performance

- **Duration:** ~53 min
- **Started:** 2026-10-22T14:45:36Z
- **Completed:** 2026-10-22T15:38:00Z
- **Tasks:** 3
- **Files modified:** 13 (2 created, 11 modified)

## Accomplishments

- Added `PhysicsPaintScriptPickerDialog`: a floating, unfiltered project-Script picker with focus capture/restore, outside-pointerdown dismissal, capture-phase Escape that closes before the Tools popover, provenance rows and an empty state.
- Studio gained `scriptPickerIntent`, an identity-stable `scriptPickerDialogPropsMemo`, and pick handling that selects the Script then runs `load-apply` or `create-rail`; Right-panel handlers still act on the current sidebar selection.
- Regrouped the Tools popover into **Scripts** (Save / Load + Apply / Create Rail) and a divider + **Living Script** (Copy / Apply / Clear), removing the Delete and Refresh clones together with their ports, handlers and derivations.
- Sidebar Scripts toolbar now renders exactly four labeled actions with no top Delete/Copy, and each row reveals an icon-only trash on hover/focus-within; cancel and confirm return focus to the trigger trash, or the nearest surviving row when the trigger was deleted.
- Targeted suites green: 458 tests across 7 files. Touched-file typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route Tools Create Rail through the shared Script picker** - `af831001` (feat)
2. **Task 2: Regroup the Tools popover into Scripts and Living Script** - `88fcfba2` (feat)
3. **Task 3: Per-row trash and four labeled toolbar actions** - `47e7ee26` (feat)

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx` — floating picker with focus/dismissal handling and provenance rows.
- `app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.ts` — 8 source-contract tests for intents, dismissal, focus and empty state.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — picker intents, dismissal exemption, Scripts / Living Script regroup, four surviving ports.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — regroup and port-removal contracts.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — four labeled toolbar buttons, per-row trash, trigger focus restoration, `onCopyScript` removed.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` — per-row trash contract, four-label toolbar pins, CSS reveal pins.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — picker dialog prop and memoized rendering beside the Play Script dialog.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — parent-modal accounting includes the picker.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — picker intent signal/memo/handlers; removed sidebar Delete/Refresh/Copy wiring; workflow ports trimmed.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — memo slot count and superseded entry-point contract.
- `app/src/components/physic-paint/physicsPaintStudio.css` — picker styles, one-row four-action toolbar, three-column rows, trash reveal/disabled styles.
- `app/src/components/physic-paint/view/physicsPaintToolboxPopover.test.ts` — dismissal-exemption contract.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` — fake props no longer declare `onCopyScript`.

## Decisions Made

- The picker never duplicates controller logic: it selects, then the intent handler reads `rotoPlayScript.disabledReason.peek()` and surfaces refusals on the existing error channel (threat T-261022-O2A-02).
- `data-toolbox-dismiss-exempt` lets the popover own only its own dismissal; the picker handles Escape first and outside clicks still close both layers.
- Per-row trash uses native `disabled` from the mutation lock only; `availability.canDelete` is deliberately not consulted so unselected rows stay deletable.
- Keyboard activation on the per-row trash stops propagation and prevents default explicitly, because suppressing the native click would otherwise make Enter/Space non-functional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Picker prevented default on Enter as well as Space**
- **Found during:** Task 1 verification
- **Issue:** The plan requires only Space's page-scroll default to be suppressed, but the initial handler called `preventDefault()` for both Enter and Space; the test contract caught the double call.
- **Fix:** `preventDefault()` now runs only for `event.key === ' '`; Enter remains activation-only on the non-native option row.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx
- **Verification:** PhysicsPaintScriptPickerDialog.test.ts green.
- **Committed in:** af831001

**2. [Rule 3 - Blocking] Removed an unused local that failed `noUnusedLocals`**
- **Found during:** Task 1 typecheck
- **Issue:** The plan's regrouping left `scriptPlayDisabledReason` unused, and `app/tsconfig.json` sets `noUnusedLocals`.
- **Fix:** Removed the local and inlined the existing derivation at its use site.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- **Verification:** Touched-file typecheck clean.
- **Committed in:** af831001

**3. [Rule 3 - Blocking] Removed two dead test helpers exposed by the regroup**
- **Found during:** Task 3 typecheck
- **Issue:** `getGuardedToolbarBlock` and `getScriptsPanelPropsInterface` became unused when the Copy-toolbar contracts were replaced; `noUnusedLocals` failed the touched file.
- **Fix:** Deleted both helper declarations.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
- **Verification:** Touched-file typecheck clean.
- **Committed in:** 47e7ee26

**Plan-note deviation:** the guardrail audit `grep -c data-script-delete` returns 2, not 1 — one JSX attribute (`data-script-delete`) and one query selector (`[data-script-delete]`) required by the plan's own focus-restoration step.

## Issues Encountered

- `developing-preact/SKILL.md` was listed as required reading but does not exist in the project; consulted `.claude/skills/efx-preact-reactivity/SKILL.md` and the local Preact conventions instead.
- `pnpm --dir app typecheck` is not clean at HEAD: 16 pre-existing errors in untouched files (`AquarelleCanvasLayer.tsx`, `usePhysicsPaintEngineActions.test.ts`, `physicsPaintRotoBackgroundValidatorParity.test.ts`, `PaperPicker.tsx`, `PhysicsPaintPalette.test.ts`, `physicPaintBridge.ts`, `projectPaperRaster.test.ts`). None of the touched files report errors.
- `PhysicsPaintLoopClipRail.test.tsx` is collected through the `PhysicsPaintLoopClipRail.test.tsx.test.ts` launcher (Vitest collects only `.test.ts` here).

## Known Stubs

None.

## UAT Follow-up (2026-10-22, commit a765d8e6)

Live review asked for tighter label treatment and a content-aware Save:

- Sidebar toolbar: Save and Refresh are now icon-only; the Load + Apply label reads **Apply**; the column gap widened so the four actions breathe.
- Tools Scripts row: Save is icon-only, Load + Apply reads **Apply**, and the three actions stay on ONE line (`flex-wrap: nowrap`).
- Tools Save now mirrors the Living Script **Copy** gate: it greys out until the current real Roto key holds strokes in memory, and activates during/after painting. Disabled copy falls back to the Copy reason ("Paint at least one brush on a real Roto key.").

## Live UAT (PENDING — user-run)

Status stays automated-ready; these rows are not validated until the user runs them live.

| # | Row | Status |
|---|-----|--------|
| 1 | Tools -> Scripts shows Save (icon-only), Apply, Create Rail on ONE line; a divider and "Living Script" heading follow with Copy, Apply, Clear; Delete and Refresh clones gone. | PENDING |
| 2 | Tools -> Apply (Load + Apply) with NO sidebar selection opens the picker listing every project Script; picking one applies it to the current frame. | PENDING |
| 3 | Tools -> Create Rail with no sidebar selection opens the same picker; picking a Script closes it and opens the existing Create Rail / Play Script dialog for that Script. | PENDING |
| 4 | Picker Cancel, Escape and outside click close it without acting; focus returns to the Tools button; Escape closes the picker before the Tools popover. | PENDING |
| 5 | Zero project Scripts: Tools Load + Apply and Create Rail are greyed with the "No project Scripts yet." reason; the picker shows its empty state if opened another way. | PENDING |
| 6 | Sidebar Scripts toolbar shows Save (icon-only), Apply, Create Rail (label), Refresh (icon-only), uncrowded; top Delete and Copy are gone. | PENDING |
| 7 | Hover or focus a script row: icon-only trash appears; clicking opens the delete confirmation for THAT Script; cancel restores focus to its trash; confirm removes it and focus lands on the nearest surviving row. | PENDING |
| 8 | Right-panel Load + Apply and Create Rail still act on the currently selected Script (no picker from the sidebar). | PENDING |
| 9 | The Tools popover still dismisses on outside click and its tooltip copy reads accurately. | PENDING |
| 10 | The bottom action row (Key, Rail, Insert, Trash, Push, Duplicate, Copy, Paste, Cut, Scissor) is unchanged from 261022-ne3. | PENDING |
| 11 | Tools Save is greyed with no strokes on the current real key; painting a stroke activates it and it stays active after painting, matching the Living Script Copy gate. | PENDING |

## Next Phase Readiness

- Code and source-contract tests are complete; the quick is **automated-ready**, not done.
- Next step is the user's live UAT of the ten rows above; any failure reopens Tasks 1-3 by surface.

---
*Phase: quick-261022-o2a*
*Completed: 2026-10-22 (automated-ready; UAT pending)*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.ts
- FOUND: .planning/quick/261022-o2a-tools-modal-and-scripts-sidebar-regroup-/261022-o2a-SUMMARY.md
- FOUND: af831001
- FOUND: 88fcfba2
- FOUND: 47e7ee26
