---
phase: quick-261018-jlb
plan: 261018-jlb
subsystem: physic-paint studio ui
tags: [preact, watercolor, brush-tab, paper-tab, css, uat]

# Dependency graph
requires:
  - phase: "261018-ias"
    provides: "Fourth UAT round CSS baseline (Brush #c8c8c8 borders, Paper #c4c4c4 fill, flat 0 14px 14px panel padding)"
provides:
  - "Brush response section title removed; bare-rule toggle keeps D-04 collapse"
  - "Brush-only 14px top padding; Paper / generic -flat unchanged at 0 14px 14px"
  - "Brush card borders #777777"
  - "Paper cell fill rgb(218, 218, 218), name padding 3px 4px"
  - "Paper 2-column grids stretch to the panel row at ~2:1 landscape thumbs (CSS-only)"
affects: [phase-56, watercolor-studio-ui, brush-tab, paper-tab, physic-paint-chrome]

# Actuals (#2632)
actuals:
  tokens: 2820
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Display stretch is CSS-only: paperThumb paint/cache constants stay 112x64; the thumb window scales via aspectRatio"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/BrushResponsePanel.tsx
    - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx

key-decisions:
  - "Item 1 vs item 3 (locked in plan, recorded here): generic .physics-paint-options-tab-panel-flat keeps padding 0 14px 14px (Paper unchanged); Brush panel alone gets a more specific .physics-paint-options-tab-panel-brush { padding: 14px 14px 14px } so removing the response title does not jam content against the tab strip."
  - "Remove that title = delete the visible rule-and-label section title only. The toggle button stays (same data-testid=brush-response-toggle, same brushResponseOpen signal, collapsed-by-default) with a bare rgb(205, 201, 201) 1px rule as its click target plus aria-label=\"Brush response\" — no chevron, no label text. D-04 collapse intact."
  - "Paper thumbs fill the row width without re-painting: gridTemplateColumns repeat(2, 1fr) + PaperCard width 100% + thumb window aspectRatio `${CARD_WIDTH} / ${THUMB_HEIGHT}` (112/64). CARD_WIDTH / THUMB_HEIGHT / GRID_GAP stay the paperThumb paint/cache sizes; no toDataURL, no cache-key change."

patterns-established:
  - "Brush tab top-padding override lives on a Brush-only panel class placed after -flat; Paper keeps the generic 0 top"

requirements-completed: [UAT-5R-BRUSH, UAT-5R-PAPER]

coverage:
  - id: UAT-5R-BRUSH
    description: "Brush tab: no rule-and-label response section title (bare-rule toggle keeps D-04 collapse + 8 multiplier rows); panel 14px top padding; every brush card border 1px solid #777777"
    requirement: UAT-5R-BRUSH
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/BrushResponsePanel.test.ts#renders the brush-response toggle with no section title, collapsed by default"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#every card border is #777777; selected keeps the accent tint (261018-jlb)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts#mount-order pin (BrushResponsePanel before WatercolorBrushLibrary)"
        status: pass
    human_judgment: true
    rationale: "Padding rhythm, bare-rule hit target, and border contrast against the sidebar need live Studio screenshots to judge"
  - id: UAT-5R-PAPER
    description: "Paper tab: cell fill rgb(218, 218, 218), name padding 3px 4px, 2-column grid stretches to the full panel row at ~2:1 landscape thumbs (name stays below)"
    requirement: UAT-5R-PAPER
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PaperPicker.test.tsx.test.ts#uses the oracle landscape card constants (112×64, 2 columns); name stays below"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/paperThumb.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts"
        status: pass
    human_judgment: true
    rationale: "Full-row-width stretch and the landscape look are a visual UAT checklist; only live Studio screenshots can judge the row fill"

# Metrics
duration: 8min
completed: 2026-10-18
status: complete
plan_head_before: ea67705eec037469f5cc3ea9d2878c6da6102e04
plan_head_after: 60f331cbab2e5795bee98c021c7712945449ed49
---

# Quick 261018-jlb: Fifth UAT Round on the Watercolor Brush Summary

**Six locked cosmetic UAT moves applied as two atomic commits — Brush response title removed to a bare-rule toggle, Brush-only 14px top padding, #777 brush borders, and Paper cells filled/expanded to the full row at 112/64 landscape.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-18T14:17:00Z
- **Completed:** 2026-10-18T14:25:00Z
- **Tasks:** 2/2
- **Files modified:** 8
- **Commits:** 2

## Accomplishments

- Brush response block no longer shows a rule-and-label section title; the same `brush-response-toggle` stays as a bare `rgb(205, 201, 201)` 1px rule with `aria-label="Brush response"`, keeping D-04 collapse, the placeholder, and the 8 multiplier rows unchanged.
- Brush tab panel alone gets 14px top padding via a new `.physics-paint-options-tab-panel-brush` class; generic `-flat` and the Paper tab stay at `0 14px 14px`.
- Every watercolor brush card border is `1px solid #777777`; selected still uses the accent background tint.
- Paper cells fill `rgb(218, 218, 218)` with name padding `3px 4px`; both paper grids use `repeat(2, 1fr)` so thumbs stretch to the full panel row at the locked 112/64 landscape aspect (CSS-only — `paperThumb` paint/cache constants untouched).

## Task Commits

Each task was committed atomically:

1. **Task 1: Brush-tab title removal + panel padding + card border (moves 1, 2, 3)** - `375e1dd3` (style)
2. **Task 2: Paper-tab cell chrome + full-row-width thumbs (moves 4, 5, 6)** - `60f331cb` (style)

## Files Created/Modified

- `app/src/components/physic-paint/view/BrushResponsePanel.tsx` - RuleSectionHeader removed; bare-rule toggle + aria-label
- `app/src/components/physic-paint/view/BrushResponsePanel.test.ts` - title pin retargeted (no visible title text, toggle named + collapsed)
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - Brush panel gets `physics-paint-options-tab-panel-brush`
- `app/src/components/physic-paint/physicsPaintStudio.css` - Brush-only 14px top padding override after `-flat`
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` - card border `#777777`
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` - border pin retargeted to `#777777`
- `app/src/components/physic-paint/view/PaperPicker.tsx` - cell fill, name padding, 1fr grids, aspectRatio thumb window
- `app/src/components/physic-paint/view/PaperPicker.test.tsx` - landscape pin retargeted to the fill law + aspectRatio

## Decisions Made

- **Item 1 vs item 3 (plan-locked, recorded here):** generic `.physics-paint-options-tab-panel-flat` stays `padding: 0 14px 14px` (Paper unchanged). The Brush panel alone gets a more specific `.physics-paint-options-tab-panel-brush { padding: 14px 14px 14px }` because removing the response title would otherwise jam content against the tab strip.
- **"Remove that title (keep the collapsible body/content)":** delete the visible rule-and-label section title, KEEP the collapsible and its body. The title was the toggle's only content, so the toggle button stays (same `data-testid="brush-response-toggle"`, same `brushResponseOpen` signal, same collapsed-by-default) with a bare horizontal rule as its click target (the header's existing `rgb(205, 201, 201)` 1px line) plus `aria-label` for a11y — no label text, no chevron. D-04 collapse not dropped.
- **Paper thumbs fill the row width without re-painting:** `CARD_WIDTH = 112` / `THUMB_HEIGHT = 64` / `GRID_GAP = 8` stay the `paperThumb` paint/cache sizes (`getPaperThumb(id, CARD_WIDTH, THUMB_HEIGHT)` and the procedural `<canvas width={CARD_WIDTH} height={THUMB_HEIGHT}>` bitmap unchanged). Display stretch is CSS-only via `aspectRatio: \`${CARD_WIDTH} / ${THUMB_HEIGHT}\`` — never `toDataURL`, never a cache-key change.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

After both commits, from the checkout root:

`pnpm --filter efx-motion-editor exec vitest run`

- **Full suite:** 305 test files passed | 2 skipped (307); 5271 tests passed | 1 skipped | 96 todo (5368). viteBuild production bundle green (under the 2 MO ceiling).
- **Pin suites green:** `BrushResponsePanel.test.ts` (6), `WatercolorBrushLibrary.test.ts` (10), `panelSplitShell.test.tsx.test.ts` (13), `AquarelleParamsPanel.test.tsx.test.ts` (9), `PaperPicker.test.tsx.test.ts` (23), `paperThumb.test.ts` (3), `physicsPaintRightPanelPaperSingleHome.test.ts` (6), `physicsPaintRightPanelModuleGate.test.ts` (7), `PhysicsPaintTopBar.test.ts` (16).
- **Scope fence:** no `SPECS/` diff, no package.json / lockfile diff, no `phase-55-issues/index.md` row ticks, no `RightPanelBrushTab` child reorder, no `physicPaintStore.ts` `getImageData|putImageData`.

## Self-Check: PASSED

- All 8 modified source/test files found on disk; SUMMARY.md written.
- Commits `375e1dd3` and `60f331cb` are ancestors of HEAD.
- Truth spot-checks: no RuleSectionHeader in BrushResponsePanel; bare `rgb(205, 201, 201)` rule + `aria-label="Brush response"` on the toggle; brush border `1px solid #777777`; `.physics-paint-options-tab-panel-brush` on the Brush panel + CSS after `-flat`; paper fill `rgb(218, 218, 218)`, name padding `3px 4px`, both grids `repeat(2, 1fr)`, thumb window `aspectRatio: \`${CARD_WIDTH} / ${THUMB_HEIGHT}\``.
