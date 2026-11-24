---
phase: quick/261124-gfy
plan: 01
subsystem: paint / Living Script UI routing
tags: [roto, clipboard, living-script, workflow-strip, preact-signals]
requires:
  - 261023-cxc script-aware Duplicate (duplicateWithScript port)
  - handleCopyScript / handleApplyScript Living Script seams
  - 0l5 record-first/bake-second paste law
provides:
  - Roto Duplicate scriptAware bypass (raster mode keeps the pixel path)
  - Grouped Roto clipboard section with a Raster|Script segmented toggle
  - runRotoCutWithScript pure orchestration (fail-closed Cut with clipboard restore)
affects:
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
actuals:
  tokens: 19743
  tasks: 3
  commits: 3
plan_head_before: 6c7095bd6bd73dfba046f4a59694f8df640dfdc3
plan_head_after: b11368da7151076692a765b6348ab1321ed2b09d
commits: 3
tech-stack:
  added: []
  patterns:
    - pure orchestration module over ports (modeled on physicsPaintRotoDuplicateScript.ts)
    - grouped icon-action row with aria-pressed segmented toggle
    - guarded icon-action tooltip copy via buildGuardedActionTooltipCopy
key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
key-decisions:
  - Duplicate stays a pixel/script dispatch point gated by scriptAware; raster mode never touches the script port.
  - The clipboard kind is session-local (Studio-owned signal, defaults to raster, resets on every Studio open, never persisted).
  - Script-mode Cut is a new pure module (runRotoCutWithScript) with a locked order and snapshot restore on failed delete.
  - Copy/Paste/Cut in script mode route exclusively through the shipped handleCopyScript/handleApplyScript seams (no new copy/apply implementation).
metrics:
  duration: ~9 min
  completed: 2026-11-24
status: complete
---

# Quick 261124-gfy: Roto key-actions group + Duplicate/Copy/Paste/Cut Raster|Script toggle Summary

Roto's key-actions row grew a grouped clipboard section (Duplicate, Copy, Paste, Cut) with a Raster|Script segmented toggle that re-points all four actions at the shipped Living Script seams; script-mode Cut is a new fail-closed orchestration that restores the previous script clipboard when the delete half fails.

## Performance

- Full app suite: 466 test files, 9859 passed | 4 skipped | 96 todo.
- Targeted suites: 721 passed across the 4 touched test files (strip 214, hook 37, module 10, Studio 460).
- `pnpm --dir app exec tsc --noEmit` exits 0.
- Diff footprint for the nine files: 78,970 chars (~19,743 tokens at chars/4).

## Accomplishments

- **Task 1** — `duplicateKey` accepts `{ scriptAware?: boolean }` (default true). Raster mode bypasses the `duplicateWithScript` port entirely, so a raster Duplicate keeps the pixel path; three new hook pins cover bypass, bypass-with-settle, and default/explicit-true.
- **Task 2** — The four clipboard actions moved into `physics-paint-roto-key-clipboard-group` (right after Delete, before Scissor) with a `Raster|Script` `aria-pressed` toggle at the end of the group. Derivation literals (`isScriptClipboardMode`, `clipboardActionLabel`, plus per-action can/reason pairs) keep every guard and reason span wired to the active mode; the group carries its own CSS surface (background, inset shadow, divider) and the identity/layer/context spans gained bounded flex footprints so the row still fits.
- **Task 3** — New `physicsPaintRotoScriptClipboardActions.ts` owns Script-mode Cut: multi-key refusal → delete availability → copy availability → snapshot → copy → delete, restoring the pre-copy snapshot on a false delete or a throw. The Studio gained the session-local `rotoClipboardMode` signal with an idempotent setter, a hoisted `handleCopyScript`, four mode-aware wrappers, and the strip wiring. Pins assert the seam counts (copyAquarelleScriptToFrame=1, recordAquarelleEventsOnFrame=3, runRotoCutWithScript=1, 'wet'=2, applyScript('wet', { paste: true })=1).

## Task Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | `9756c4a57` | feat(quick-261124-gfy): gate Roto Duplicate's script port behind scriptAware |
| 2 | `5a6de3916` | feat(quick-261124-gfy): group the Roto clipboard actions with a Raster\|Script toggle |
| 3 | `b11368da7` | feat(quick-261124-gfy): dispatch the Roto clipboard mode from the Studio |

## Files Created

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts` — message constants, `RotoScriptCutPorts`, `RotoScriptCutOutcome`, `runRotoCutWithScript`.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts` — 10 pins (constants, refusal order, copy/delete failure paths, restore-on-throw reference identity, successful cut).

## Files Modified

- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — `duplicateKey(options?: { scriptAware?: boolean })`.
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts` — scriptAware describe (3 tests).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — clipboard group, mode toggle, mode-aware derivations, tooltips.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — 6 new pins + retargeted label/guard helpers.
- `app/src/components/physic-paint/physicsPaintStudio.css` — group/toggle rules; bounded identity/layer/context flex footprints.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — clipboard mode signal, idempotent setter, hoisted `handleCopyScript`, four mode-aware wrappers, strip props.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — 8 new pins (signal, routing order, Cut module call, hoisted copy seam, wiring, seam counts).

## Decisions Made

- Raster remains the default clipboard kind and the reset value on every Studio open; the mode is session-local and never persisted.
- Script-mode Copy/Cut refuse a 2+ key selection with explicit messages (the script clipboard is single-key); Paste additionally requires `hasCopiedScript` before `canApply`.
- Script-mode Cut keeps the raster branch byte-identical and fails closed (both delete and copy availability checked before any side effect).

## Deviations from Plan

None - plan executed exactly as written.

The only in-flight correction was test authoring: one toggle pin initially counted `PhysicsPaintStyledTooltip` occurrences and got 4 from the open/close tags; the pin now matches `<PhysicsPaintStyledTooltip` and expects 2.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Automated gates are green. The plan's seven live UAT rows (Studio-only, artist-performed) remain pending: default Raster state, toggle persistence within a session, raster Duplicate/Copy/Paste/Cut parity, script Duplicate/Copy/Paste, script Cut success, script Cut delete-failure restore, and the multi-key refusals. Status is automated-ready only until those rows pass.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts
- FOUND: 9756c4a57
- FOUND: 5a6de3916
- FOUND: b11368da7
