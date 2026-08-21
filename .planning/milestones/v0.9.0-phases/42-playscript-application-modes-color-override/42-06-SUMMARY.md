---
phase: 42-playscript-application-modes-color-override
plan: 06
subsystem: ui
tags: [preact, signals, playscript, dialog, modal-overlay, css-grid, dark-tokens]

# Dependency graph
requires:
  - phase: 42-playscript-application-modes-color-override (42-05)
    provides: D-16 card-grid dialog, live brush-color control, getBrushColor port, controller option surface
provides:
  - Play Script dialog as a compact independent DARK modal overlay (D-19): fixed inset overlay + dimmed backdrop above an untouched Paint layout — never occupies the canvas grid cell, never resizes the Studio
  - Proposal-derived --ps-* dark token set declared on the modal scope only; old light Play Script palette fully removed from the scope
  - D-16 final grid: Mode (span-2) → Timing LEFT full height | Color-over-Motion right stack (equal combined height) → Requested/Effective summary bar (span-2) → compact in-modal footer
  - No-scroll compact fit: zero overflow regions anywhere in the modal scope (CSS contract test)
affects: [42-04 Task 2 native UAT (visual target is now Image #153), phase-43 loop clips]

# Actuals (#2632) — pairs with the plan's `estimate` (80000 tokens) to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 13641
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Out-of-flow modal re-mount without markup relocation: position:fixed inset:0 grid-child leaves the Studio layout untouched, so PhysicsPaintStudioView needed zero edits (CSS contract test pins 'no grid-row/grid-column on the dialog root')"
    - "CSS source-contract tests in the Node vnode harness: comment-stripped rule extraction asserts tokens, palette removal, fixed positioning, and the no-scroll sweep without a browser"
    - "Equal-height two-column row via grid stretch: right side-stack flex column fills the shared row track; the Motion wiggle card absorbs the remainder (Color + gap + Motion == Timing height)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "PhysicsPaintStudioView.tsx left byte-identical: the plan's re-mount goal (dialog out of the canvas grid cell, canvas mounted behind) is satisfied by out-of-flow fixed positioning — a fixed-position grid child is removed from grid layout, so no markup move was needed; the CSS contract test pins this"
  - "Backdrop is a separate aria-hidden sibling layer with NO click handler — close stays Cancel/Escape/success only (D-17/D-19)"
  - "Summary bar splits the controller loopReadout on ' · Effective: ' into Requested-left / Effective-right spans; the controller composition (all three D-13 forms) is unchanged and byte-untouched"
  - "Modal z-index 70 chosen above the Studio's maximum (60) so the overlay sits on top of every existing Paint surface"

patterns-established:
  - "Dialog-scoped dark token set (--ps-*) declared on the modal root class; inherited by every modal descendant and unable to leak into surrounding Paint UI"

requirements-completed: [PLAY-03, PLAY-04]

# Coverage metadata (#1602) — deterministic UAT routing for verify-work.
coverage:
  - id: D1
    description: "Modal overlay shell (D-19): backdrop presence/non-wired, header title-left/range-right, footer inside surface, fixed inset positioning with no grid-cell placement, --ps-* token declaration + old light palette removal, no-scroll scope sweep"
    requirement: PLAY-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#modal overlay shell (D-19) (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-16 final grid: Timing LEFT beside Color-over-Motion right stack, Motion never span-2/never above Color, summary bar Requested-left/Effective-right split, infinity readout split, null-readout renders nothing, 1fr 1fr body grid + side-stack flex CSS contract"
    requirement: PLAY-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#final grid (D-16 final / D-19) (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 42-02/42-05 behavioral contracts preserved (radiogroups, live chip, labels, Max→1, loop intent, E5) and controller/renderer byte-untouched"
    requirement: PLAY-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts (29 tests) + physicsPaintRotoPlayScriptController.test.ts — all green"
        status: pass
      - kind: other
        ref: "git diff 0d480d7b~1..HEAD -- app/ → dialog tsx/test + physicsPaintStudio.css only; no controller/renderer/StudioView/InlineColorPicker file in the plan diff"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native visual UAT: compact dark modal recognizably Image #153, equal left/right main-row heights, complete modal fits at minimum window size with no scrollbars and no clipped rows"
    requirement: PLAY-03
    verification: []
    human_judgment: true
    rationale: "Layout, equal-height, and minimum-window compact-fit are visual judgments; the automated CSS contract (fixed metrics, no overflow regions) is the structural guarantee, but only native UAT confirms the fit at the real minimum window size"

# Metrics
duration: 18min
completed: 2026-08-06
status: complete
---

# Phase 42 Plan 06: Play Script Modal Overlay — Compact Dark Restyle and Final Grid Summary

**Rejected light full-canvas implementation (Image #154) replaced with the approved compact independent DARK modal overlay (Image #153): fixed-position overlay + dimmed backdrop above an untouched Paint layout, proposal-derived --ps-* tokens, D-16 final Timing-left / Color-over-Motion-right grid, no-scroll compact fit — controller/renderer byte-untouched**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-06T10:04:18Z
- **Completed:** 2026-08-06T10:22:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **Modal overlay re-mount (D-19):** `.physics-paint-play-script-dialog` is now `position: fixed; inset: 0` (z-index 70, above the Studio maximum of 60) with a dimmed `oklch(0 0 0 / 0.55)` backdrop layer — the dialog no longer occupies the canvas grid cell, the canvas and Studio layout stay mounted and unresized behind it, and closing never changes the layout. Backdrop click is NOT wired (Cancel/Escape/success only, D-17/D-19). `PhysicsPaintStudioView.tsx` needed zero edits: a fixed-position grid child is out of flow, so the re-mount is a pure CSS change pinned by a source-contract test (no `grid-row`/`grid-column` on the dialog root).
- **Full dark restyle:** the entire `.physics-paint-play-script-*` rule set was rewritten around the proposal's verbatim `--ps-*` token set (surface/raised/inset/foot/fg/muted/faint/border/accent/accent-hi/ok/error/radius, oklch values from UI-SPEC) declared on the modal root scope. Old light palette fully removed from the scope — `#f7f5ef` surface, white cards, 42px inputs, clamp paddings/headings, `#365ed6`/`#a12f37` accents — asserted gone by a CSS contract test.
- **Compact shell (D-16 Rows 1/5):** 700px modal (max-width 94%, max-height 96%, radius 14, proposal shadow, flex column, overflow hidden); compact header `Play Script` (15px/650) left + `Max {N} · F{start}–F{end}` (11.5px muted tabular-nums) right with 1px bottom border; compact footer INSIDE the modal (`--ps-foot`, 1px top border, progress track + status left, ghost Cancel + accent Generate right, buttons 12.5px/650 min-height 34px); generation failure renders the reason in `--ps-error` above the footer (E5 contract restyled).
- **D-16 final grid (Row 3):** Mode card span-2 → main-options row with the Timing card LEFT spanning the full row height (Frames / Frames per cycle + helper/validation, Repeat + Infinity + helper/validation in proposal `.field` structure) and a RIGHT side-stack column — Color card on top, Motion wiggle directly underneath — that stretches to the shared row track so Color + gap + Motion wiggle combined height EQUALS the Timing height. Motion wiggle is never span-2 and never above Color; its card absorbs the remaining space with the two compact slider rows (grid 88px 1fr 26px, 4px track, 14px thumb, visible outputs) centered — no inner dead area. Color pane centers its compact content (original dots row OR inset custom chip/hex row).
- **Summary bar (Row 4):** full-width inset bar rendering the controller `loopReadout` split into Requested-left / Effective-right spans (truncation clause preserved on the right; Infinity form `Cycle {N}f × ∞` left) — informational only, controller composition untouched.
- **No-scroll compact fit:** zero `overflow: auto/scroll` regions anywhere in the modal scope (full-scope CSS sweep in tests); compact metrics replace the 42-03 body-scroll contract per D-19.
- **Wave gate green:** full app suite 1169 passed, package animation tests 17 passed, `pnpm --dir app typecheck` clean; plan diff confined to the dialog component, its test, and `physicsPaintStudio.css` — controller, renderer, StudioView, Scripts panel summary block, and InlineColorPicker byte-untouched.

## Task Commits

Each task was committed atomically (TDD: RED test gate → GREEN implementation):

1. **Task 1 RED: modal overlay shell + dark token CSS contract tests** — `0d480d7b` (test)
2. **Task 1 GREEN: compact dark modal overlay re-mount** — `de5bab59` (feat)
3. **Task 2 RED: D-16 final grid structural tests** — `b86a1003` (test)
4. **Task 2 GREEN: final grid — timing left, color over motion right, no-scroll fit** — `38288499` (feat)

**Plan metadata:** recorded in the final docs commit (SUMMARY/STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — backdrop layer + header-range class; proposal `.field` wrappers in the Timing card; centered color pane; side-stack wrapping Color-over-Motion; motion-rows wrapper; split summary bar; typed ghost/primary footer buttons with progress-line status
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` — comment-stripped CSS rule extraction helpers; modal overlay shell describe (5 tests); D-16 final grid describe (3 tests); all prior behavioral describes preserved green
- `app/src/components/physic-paint/physicsPaintStudio.css` — full `.physics-paint-play-script-*` rewrite: --ps-* token declaration, fixed overlay + backdrop, compact shell/header/body/cards/segmented/fields/color/sliders/summary/footer/buttons/progress; side-stack + motion-rows equal-height rules; every old light-palette dialog rule inside the scope deleted

## Decisions Made

- `PhysicsPaintStudioView.tsx` intentionally byte-identical: the plan's re-mount goal is achieved by out-of-flow fixed positioning (a fixed grid child is removed from grid layout), so no markup relocation was needed; the "canvas stays mounted / dialog out of the grid cell" acceptance criterion is enforced by the CSS source-contract test instead of a view test.
- Backdrop implemented as a separate `aria-hidden` sibling with no `onClick` — close semantics stay exactly Cancel/Escape/success (D-17/D-19); the structural test asserts the handler's absence.
- Summary-bar split lives in the dialog (pure presentation): the controller's three locked D-13 readout forms are unchanged; split key is the literal ` · Effective: ` separator, with a single-span fallback if the separator is absent.
- Modal z-index 70 selected after inventorying the Studio stylesheet (existing maximum 60) so the overlay is guaranteed top-most within the Studio stacking context.

## Deviations from Plan

None - plan executed exactly as written. (The plan listed `PhysicsPaintStudioView.tsx` under `files_modified`, but its own action text defines the re-mount as out-of-flow positioning with the canvas staying mounted — satisfied with zero view edits; recorded as a decision above rather than a deviation since the behavior contract is met and pinned by tests.)

## Issues Encountered

- Two test-harness alignments during Task 1 GREEN (not plan deviations): Preact vnode props carry ARIA attributes as strings (`'true'`), and the CSS rule extractor needed comment stripping before selector matching. Both fixed inside the RED→GREEN loop before commit.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
- FOUND: app/src/components/physic-paint/physicsPaintStudio.css
- FOUND: commit 0d480d7b (Task 1 RED)
- FOUND: commit de5bab59 (Task 1 GREEN)
- FOUND: commit b86a1003 (Task 2 RED)
- FOUND: commit 38288499 (Task 2 GREEN)
- Plan app diff confined to the three files above (controller/renderer/StudioView/InlineColorPicker untouched)
- CSS diff confined to `.physics-paint-play-script-*` selectors (only descendant reference to the shared `.physics-paint-script-inline-error` inside the scope)
- Full app suite (1169 passed), package animation tests (17 passed), typecheck — all exit 0

## Next Phase Readiness

- 42-04 Task 2 (native UAT, wave 6) now targets the final surface: compact dark modal over a dimmed, untouched Paint layout; equal-height Timing | Color-over-Motion row; Requested/Effective summary bar; compact in-modal footer; no-scroll fit at minimum window size (D4 coverage entry, human judgment).
- Dialog trigger guards unchanged (D-17): Scripts-panel toolbar action remains the sole entry point; no auto-open, no demo trigger.
- No blockers.

---
*Phase: 42-playscript-application-modes-color-override*
*Completed: 2026-08-06*
