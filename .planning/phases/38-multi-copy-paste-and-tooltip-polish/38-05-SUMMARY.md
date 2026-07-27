---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 05
subsystem: ui
tags: [physics-paint, roto, tooltip, viewport-positioning, preact, css]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 03
    provides: capsule ambient feed in PhysicsPaintWorkflowStrip.tsx (sequencing reason only — both plans modify the strip file)
provides:
  - computeTooltipPlacement(anchorRect, region, pillSize) pure exported utility + TooltipRegion/TooltipDirection types + TOOLTIP_VIEWPORT_MARGIN=8 / TOOLTIP_PILL_MAX_WIDTH=280 constants (D-11/D-12/D-13); 38-08 unit-test target
  - Viewport-positioned PhysicsPaintStyledTooltip: show-time anchor getBoundingClientRect(), fixed left/top written pre-paint in a layout effect, direction modifier class, notch custom properties; useStyledTooltip controller byte-identical
  - Required region prop replacing the legacy per-mount placement prop (deleted permanently — per-mount hand placement is a locked anti-pattern)
  - CSS direction + notch API: .physics-paint-styled-tooltip--above/--below/--left/--right + .physics-paint-styled-tooltip-notch (10x6 same-fill viewport-fixed triangle at --tooltip-notch-x/--tooltip-notch-y)
  - 15 converted mounts: 12 strip (9 bottom + 3 top) + 3 Scripts panel (right-edge)
affects: [38-06 native UAT, 38-08 post-UAT regression tests]

tech-stack:
  added: []
  patterns:
    - "Viewport tooltip placement: read anchor getBoundingClientRect() at show time (absorbs strip horizontal scroll), compute via one pure utility, write fixed left/top + direction class + notch custom properties straight onto the element in a no-deps layout effect — no state copied into a render cycle, no scroll/resize listeners (recompute per show)"
    - "Notch escapes the pill's locked overflow clip via position: fixed (sanctioned by the containing-block audit); its edge point is the anchor-center projection on the pill's control-facing edge, computed after viewport clamping"
    - "Measure-then-position without a state chain: pill mounts with inline visibility:hidden, the layout effect positions and reveals it before paint"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx

key-decisions:
  - "CONTAINING-BLOCK AUDIT VERDICT (RESEARCH Open Question 1, D-12 mechanism): FIXED, pill rendered in place — NO portal. No ancestor of any tooltip mount (mount wrapper -> action row/header band/cell lane -> .physics-paint-workflow-strip -> .physics-paint-studio -> body; Scripts panel sidebar chain) carries transform, filter, perspective, will-change, or layout/paint contain; all CSS hits are leaf rules on the controls themselves and the pill is a sibling of the control. 38-06 UAT and 38-08 tests MUST use this fixed-in-place mechanism verbatim."
  - "Notch positioning deviates from the plan's suggested absolute+var(--tooltip-notch-offset) mechanism: the pill's locked overflow clipping would hide an absolutely positioned notch child, so the notch is viewport-fixed at --tooltip-notch-x/--tooltip-notch-y derived from the post-clamp placement (Rule 3). The cross-axis position still tracks the anchor center after clamping, never the pill center (D-13 preserved)."
  - "region is a REQUIRED prop after Task 2 — the Task 1 conversion default ('bottom') was removed once every mount declared its region; the legacy placement prop is deleted and must never be reintroduced."
  - "Tracer feedback gate resolved as automated per the 38-01/38-02/38-04 precedent: plan frontmatter autonomous:true, no checkpoint tasks, fully automated <verify> grep gates (all green on re-run after the tracer commit), live visible UAT owned by plan 38-06 (D-15)."

requirements-completed: [38-TOOLTIP-VIEWPORT-PLACEMENT, 38-TOOLTIP-NOTCH-MULTILINE]

metrics:
  duration: 7min
  tasks: 3
  files: 4
  completed: 2026-07-27

status: complete
---

# Phase 38 Plan 05: Viewport-Positioned Styled Tooltip Summary

One shared pure placement utility drives all 15 styled-tooltip mounts: opposite-of-region direction, flip-on-insufficient-room, 8px viewport clamp, 10x6 same-fill notch tracking the anchor center after clamping, and the locked 280x96px multiline clamp — with the useStyledTooltip controller contract byte-identical.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Containing-block audit, computeTooltipPlacement, component + CSS rework, header mounts + Copy tracer mount converted | 3d7fc193 | PhysicsPaintStyledTooltip.tsx, physicsPaintStudio.css, PhysicsPaintWorkflowStrip.tsx |
| 2 | Remaining strip mounts to explicit regions; region made required | 7f432f8a | PhysicsPaintWorkflowStrip.tsx, PhysicsPaintStyledTooltip.tsx |
| 3 | Scripts panel mounts to right-edge + final sweep | 734d6616 | PhysicsPaintScriptsPanel.tsx |

## Containing-Block Audit Verdict (recorded for 38-06 / 38-08)

**FIXED, pill rendered in place — no portal.** Grepped `physicsPaintStudio.css` for `transform`, `filter`, `perspective`, `will-change`, `contain` and inspected every hit: `.physics-paint-icon-button img` filter, canvas-toast/resizer-svg/swatch-remove/color-cursor/key-button transforms, `.physics-paint-roto-cell.*` drag-state filters, play-marker transform — all leaf rules on the controls or unrelated surfaces. No ancestor of any tooltip mount (mount wrapper -> action row/header band/cell lane -> `.physics-paint-workflow-strip` -> `.physics-paint-studio` -> body; Scripts panel sidebar chain) triggers a containing block for fixed positioning. Inline-style sweep of the three consumer TSX files plus PhysicsPaintStudioView.tsx found no triggers either.

## Verification Results

All plan grep gates green:

- `computeTooltipPlacement` and `getBoundingClientRect` present in the component; `STYLED_TOOLTIP_DELAY_MS = 1000` count = 1; `useStyledTooltip` body byte-identical (diff shows changes only in imports, props interface, pill component, and the new utility/types/constants).
- Strip mounts: `region="` = 12 (9 `region="bottom"` + 3 `region="top"`); Scripts panel `region="right-edge"` = 3; legacy `placement=` = 0 in both consumers; `region?:` = 0 (required prop).
- CSS base block (awk-extracted): `max-width: 280px` = 1, `max-height: 96px` = 1, zero single-line/truncation declarations; four direction modifiers + notch rules exist; `white-space: normal`; `position: fixed`.
- `role="tooltip"` = 1 with the `id` prop on the pill; no HTML-injection API in the component (T-38-04); guarded `aria-describedby` wiring untouched at every mount (T-38-05); exactly 2 consumer files.
- D-15: whole-plan diff touches exactly the four `files_modified` entries; no `*.test.*` file created/modified/renamed/executed; no vitest invocation; typecheck/build gate deferred to 38-08 per the D-15 sequence.

State is **automated-ready** — native visible UAT (both UI-SPEC backstop rows) happens in 38-06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Notch positioning mechanism changed to viewport-fixed custom properties**
- **Found during:** Task 1, Step C/D
- **Issue:** The plan's suggested notch mechanism (absolutely positioned child at `var(--tooltip-notch-offset)`) is incompatible with the locked pill CSS: `overflow: hidden` on the pill clips any absolutely positioned notch child placed on the pill's outer edge — the notch would never render.
- **Fix:** The notch remains a child of the pill in the DOM (plan requirement) but is `position: fixed` — sanctioned by the containing-block audit — at `--tooltip-notch-x`/`--tooltip-notch-y` custom properties computed from the post-clamp placement (anchor-center projection on the pill's control-facing edge). Cross-axis position still derives from the post-clamp notchOffset (D-13 preserved); per-direction modifiers orient the 10x6 triangle around that point.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx, app/src/components/physic-paint/physicsPaintStudio.css
- **Commit:** 3d7fc193

### Process Notes (not defects)

- **Tracer feedback gate:** resolved as automated per the 38-01/38-02/38-04 precedent — plan is `autonomous: true` with fully automated `<verify>` and D-15 explicitly defers all native visible verification to 38-06; the tracer's automated gates were re-run end-to-end after the tracer commit and passed before expansion.
- **Per-task commits kept (3 total)** rather than the plan-sanctioned combined Task 2+3 commit: the intermediate required-prop type inconsistency in the Scripts panel exists only between two adjacent commits and no typecheck runs in this plan (deferred to 38-08).

## Authentication Gates

None.

## Known Stubs

None — every mount renders live controller-supplied copy through the shared computation.

## Threat Flags

None — no new network endpoints, auth paths, file access, or trust-boundary schema changes. Portal mounting was NOT chosen, so no content moved outside the strip's DOM subtree; T-38-04 (text-children-only rendering, no injection API) and T-38-05 (id/aria-describedby association intact under viewport positioning) verified by the Task 3 sweeps.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
- FOUND: app/src/components/physic-paint/physicsPaintStudio.css
- FOUND: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
- FOUND: commit 3d7fc193 (Task 1)
- FOUND: commit 7f432f8a (Task 2)
- FOUND: commit 734d6616 (Task 3)
