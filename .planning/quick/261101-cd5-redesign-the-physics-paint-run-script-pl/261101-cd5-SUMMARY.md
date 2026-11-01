---
phase: 261101-cd5-redesign-the-physics-paint-run-script-pl
plan: 01
subsystem: ui
tags: [preact, signals, dialog, css, physics-paint, play-script]

requires: []
provides:
  - "fixed 700 × 660 Run Script dialog shell: header, folder tabs, tab-owned panel, footer"
  - "footer Requested/Effective tooltip, persistent progress track and status-slot generation failure"
  - "static -surface-tall rule for loop edit, source edit and every stack kind"
affects: [physics-paint, play-script, uat]

actuals:
  tokens: 36680
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "CSS-only hover/focus tooltip: no useState, no effect, no measurement"
    - "Static mode-flag sizing modifier (loopEdit || sourceEdit || stacking) instead of runtime measurement"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts

key-decisions:
  - "Vertical spacer implemented as margin-top: auto on the GLOBAL OPTIONS label (plan checker advisory 1)"
  - "Source cycle renders as a fourth equal-width compact card inside the global row, with short Link/Create labels"
  - "-surface-tall is driven only by loopEdit || sourceEdit || stacking; regenerate inherits it through sourceEdit"
  - "The global row grows to height: auto; min-height: 80px under -surface-tall so the stack-only Use brush color row can never clip"
  - "Tooltip visibility is pure CSS (:hover / :focus-within), keeping the 56px footer and the info control stationary"

requirements-completed: [QUICK-261101-CD5]

coverage:
  - id: D1
    description: "Fixed 700 × 660 surface across Paint/Reveal × Motion/Static with header, folder tabs, tab-owned panel and footer; no scroll container"
    requirement: QUICK-261101-CD5
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#composes header → workspace (folder tabs then tab-owned panel) → footer inside the fixed surface"
        status: pass
    human_judgment: true
    rationale: "Pixel fidelity to the approved HTML design and the absence of clipping are visual judgments live UAT must confirm."
  - id: D2
    description: "Rail Type subheader, timing hero, 2×2 Motion grid and one compact global options row (swatch+hex Color, mini Link/Create Source cycle)"
    requirement: QUICK-261101-CD5
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#261101-cd5: renders the compact Link/Create segmented control with a one-line helper, Link selected by default with the source range and linked count"
        status: pass
    human_judgment: true
    rationale: "Card fit, density and copy truncation at 700px are visual judgments."
  - id: D3
    description: "Footer reads progress track → info control → status → actions; Requested/Effective open in a borderless tooltip on hover and keyboard focus; a failure renders role=alert in the status slot and never as a surface row"
    requirement: QUICK-261101-CD5
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#261101-cd5: opens Requested/Effective in a footer tooltip with the display prefixes stripped, and renders no info control when the readout is null"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#renders a generation failure through the shared inline-error element with no progress bar and enabled controls"
        status: pass
    human_judgment: true
    rationale: "Tooltip anchoring above the footer and focus behaviour need a live keyboard/mouse check."
  - id: D4
    description: "Preserved modes (loop edit, source edit/regenerate, Paint/Reveal/Reveal-run stacks, collision) keep their copy, laws and action labels and take -surface-tall with no clipping"
    requirement: QUICK-261101-CD5
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#261101-cd5: assigns -surface-tall from the mode flags for every preserved mode and never for a creation view"
        status: pass
    human_judgment: true
    rationale: "No-clip and layout of the taller modes is a visual check."
  - id: D5
    description: "No controller/port/timing/stacking behavior change; Studio integration and keyboard containment unchanged"
    requirement: QUICK-261101-CD5
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts (454 passed)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-01
status: complete
plan_head_before: 04893293deaf833e3827ed7ce34a3439883f0933
plan_head_after: 50fb2c9753caa076c39173a2eab6f178e9b6d421
---

# Quick 261101-cd5: Run Script dialog redesign Summary

**The Physics Paint Run Script dialog now renders on the approved fixed 700 × 660 design across all four creation variants, with folder tabs owning the panel, a timing hero, a single compact global row and a footer that hides Requested/Effective in a keyboard-reachable tooltip.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-11-01T07:53:44Z
- **Completed:** 2026-11-01T08:38:20Z
- **Tasks:** 3
- **Files modified:** 4
- **Commits:** 3 (measured: `git rev-list --count 04893293d..HEAD`)

## Accomplishments

- Rebuilt the dialog chrome: 48px header with badge/title/range/Close, 38px folder tabs that merge into the tab-owned panel, and a 56px footer — all inside one `overflow: hidden` surface with no scroll container.
- Recomposed the panel: compact RAIL TYPE subheader with the Reveal reference chip, 150px timing hero, 2×2 Motion wiggle grid, and a single equal-height global row where Key Script / Paint Seed / Color (+ conditional Source cycle) or Paint Seed / Photo Wiggle / Colorize render.
- Replaced the bordered summary bar with a footer Requested/Effective tooltip (CSS-only, hover and focus) whose display prefixes are stripped; the real `<progress>` mounts only while generating and idle reads Ready.
- Moved a generation failure into the footer status slot as `role="alert"` with the full text in `title`, so it can never be a direct child of the surface.
- Kept every preserved mode intact and gave loop edit, source edit/regenerate and all stack kinds a static `-surface-tall` modifier so they size to content without clipping.
- Preserved every stable id, role, roving tabindex, `aria-describedby`, progress label and Escape/Enter path; Studio integration and keyboard containment suites still pass unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fixed 660 shell, tab-owned panel and rail-type subheader** — `1fbc2b3a7` (feat)
2. **Task 2: Timing hero, 2x2 motion grid, compact global options row** — `9a35cc0d2` (feat)
3. **Task 3: Footer progress, info tooltip, status slot and tall modifier** — `50fb2c975` (feat)

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — new shell composition, footer tooltip/status slot, static `-surface-tall`, Play icon on the creation primary action.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` — restyled extracted cards: RailTypeCard subheader, timing heroes, 2×2 Motion grid, compact global cards, swatch+hex Color, mini Link/Create Source cycle.
- `app/src/components/physic-paint/physicsPaintStudio.css` — rewritten `.physics-paint-play-script-*` block (tokens, shell, tabs, panel, cards, footer, tooltip, tall modifier); no global rules.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` — structural tests rewritten to the new composition, every behavioral assertion kept at its previous strength.

## Decisions Made

- **Spacer via `margin-top: auto`** on the GLOBAL OPTIONS label (plan checker advisory 1), so the creation views distribute the ~11px slack without a magic spacer element.
- **Source cycle as a fourth compact card** in the global row with short Link/Create labels, the active helper as a one-line subline and the full copy in `title` plus a visually-hidden `aria-describedby` node.
- **Tall modifier is a render-time mode decision** (`loopEdit || sourceEdit || stacking`); regenerate inherits it because `regenerateImpact` is only reachable under source edit. Nothing measures content.
- **Global row is `height: auto; min-height: 80px` under `-surface-tall`** so preserved modes that add the stack-only “Use brush color” line never clip inside the hidden-overflow surface.
- **Tooltip stays CSS-only**: `:hover` and `:focus-within` toggle visibility, `pointer-events: none` keeps the Studio behind the dialog clickable, and the absolutely positioned tooltip never changes the 56px footer.

## Deviations from Plan

None of the deviation-rule kinds (Rule 1–4) applied; no architectural decision, missing functionality or bug surfaced during execution. Two implementation-level adjustments were made inside the declared files:

1. **ColorizeCard row structure corrected to match the design HTML** — the subline and Mix control were rendering in one flex row; they now stack (head / subline / Mix row with a fixed 90px range) and the dead `-card-subline-row` rules were replaced by `-slider-row-colorize`.
2. **Footer test lookups filter by `vnode.type === 'button'`** when matching the creation action text, because the new Play icon fragment also matches the same `textOf`; this is a harness disambiguation, not a coverage reduction.

## Issues Encountered

- Task 2's copy renames (color labels, Link/Create, Source cycle, Paint seed) produced nine expected assertion failures; each was rewritten to the new surface while keeping the behavioral invocation.
- Task 3 moved the readout out of the panel, producing eight expected failures; all were resolved by asserting the footer tooltip and the new panel order (`GLOBAL OPTIONS` row last).
- The CSS file keeps the dialog shell block and the footer block in their pre-existing separate locations; no reorganisation was done, keeping the diff scoped.

## Tests Run

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` — **92/92 passed**.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` — **454/454 passed**.
- `pnpm --filter efx-motion-editor run typecheck` — clean.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated evidence is complete; the redesign is **automated-ready**.
- **Live UAT remains with the user**: visual match to the four design HTMLs at 700 × 660, tooltip on hover and keyboard focus, and the preserved modes in the live Studio.
- No server was run, no branch was created and nothing was pushed.

---
*Quick: 261101-cd5-redesign-the-physics-paint-run-script-pl*
*Completed: 2026-11-01*

## Self-Check: PASSED

- Files: dialog.tsx, Cards.tsx, physicsPaintStudio.css, dialog.test.ts and this SUMMARY all exist
- Commits: 1fbc2b3a7, 9a35cc0d2, 50fb2c975 all ancestors of HEAD
