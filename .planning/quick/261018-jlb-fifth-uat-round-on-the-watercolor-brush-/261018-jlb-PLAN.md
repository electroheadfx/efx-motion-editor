---
phase: quick-261018-jlb
plan: 261018-jlb
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/BrushResponsePanel.tsx
  - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/PaperPicker.tsx
  - app/src/components/physic-paint/view/PaperPicker.test.tsx
autonomous: true
requirements:
  - UAT-5R-BRUSH
  - UAT-5R-PAPER

estimate:
  tokens: 22000
  raw_tokens: 14000
  tasks: 2
  confidence: med

must_haves:
  truths:
    - "Brush tab no longer shows a rule-and-label section title above the response block; the response body (placeholder or the 8 multiplier rows) is unchanged and still expands from the same toggle."
    - "Brush tab panel has 14px top padding; Paper tab (and the generic -flat rule) keeps 0px top padding."
    - "Every watercolor brush card has a #777777 1px border; selected still uses the accent background tint."
    - "Paper cells use rgb(218, 218, 218) fill and name padding 3px 4px."
    - "Paper tab 2-column grid stretches to the full panel row width (1fr columns); each card keeps its ~2:1 landscape thumb; name stays below."
  artifacts:
    - app/src/components/physic-paint/view/BrushResponsePanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/PaperPicker.tsx
  key_links:
    - "Pin suites move in the same commits as the behavior: BrushResponsePanel.test.ts title pin, WatercolorBrushLibrary.test.ts border pin, PaperPicker.test.tsx landscape-grid pin."
    - "panelSplitShell.test.tsx.test.ts mount-order pin (BrushResponsePanel before WatercolorBrushLibrary in RightPanelBrushTab) must stay green — do not reorder RightPanelBrushTab."
    - "paperThumb getPaperThumb(id, w, h) cache stays keyed on the paint size (112x64); display stretch is CSS-only, never re-paint or toDataURL."
    - "Generic .physics-paint-options-tab-panel-flat stays 0 14px 14px (Paper); only the Brush panel gets the 14px top override (item 1 vs item 3 interpretation)."
---

<objective>
Fifth UAT round on the watercolor/brush Studio UI (261018-jlb). Six cosmetic moves locked by the user's live UAT feedback. Two atomic commits (Brush-tab then Paper-tab) so the six rows can still be judged in two visual groups.

1. **Remove the response section title** (`RuleSectionHeader` in `BrushResponsePanel.tsx:108`) — keep the collapsible body/content.
2. **Brush card border** → `#777777`.
3. **Panel padding split** — generic `.physics-paint-options-tab-panel-flat` stays `0 14px 14px`; Brush tab alone gets `14px 14px 14px`.
4. **`.paper-picker-cell-name` padding** → `3px 4px`.
5. **`.paper-picker-cell` background** → `rgb(218, 218, 218)` (replaces prior `#c4c4c4`).
6. **Paper thumbs fill the row width** — 2-column grid stretches to 100% of the panel row; keep the ~2:1 landscape aspect.

Purpose: match the UAT screenshots without reopening I-01..I-10 / PAPER-01..04 / AQUA-04 contracts.
Output: two local commits, pin suites green after each.

**Item 1 vs item 3 interpretation (locked for the executor; record in SUMMARY):**
- Both Brush and Paper tab panels carry `physics-paint-options-tab-panel-flat`. The generic rule keeps `padding: 0 14px 14px` (Paper unchanged). The Brush panel alone gets a more specific `padding: 14px 14px 14px` because removing the response title would otherwise jam content against the tab strip.
- "Remove that title (keep the collapsible body/content)" = delete the visible rule-and-label section title, KEEP the collapsible and its body. The title was the toggle's only content, so the toggle button stays (same `data-testid="brush-response-toggle"`, same `brushResponseOpen` signal, same collapsed-by-default) with a bare horizontal rule as its click target (the header's existing `rgb(205, 201, 201)` 1px line) plus `aria-label` for a11y — no label text. Do not drop D-04 collapse; do not invent a chevron/label UI.

Scope fence (locked):
- Do NOT edit `SPECS/`. Oracle is read-only.
- Do NOT tick rows in `phase-55-issues/index.md`.
- Preact + `@preact/signals`. No NEW `useState`. Narrow signal reads; selection in click handlers (never `useEffect`); store setters stay compare-then-write. Consult `efx-preact-reactivity` before any component edit.
- `physicPaintStore.ts` must contain ZERO `getImageData|putImageData`.
- No new dependencies (viteBuild 2 MO ceiling). Local commits only, never push.
- Tests: `pnpm vitest run` from `app/` (or `pnpm --filter efx-motion-editor exec vitest run` from root). Never watch. Vitest collects `src/**/*.test.ts` only — edit the real assertions in `*.test.tsx` and let the existing `*.test.tsx.test.ts` import launcher pick them up.
- Do not reorder `RightPanelBrushTab` children (`panelSplitShell` mount-order pin).

</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@app/src/components/physic-paint/view/BrushResponsePanel.tsx
@app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
@app/src/components/physic-paint/view/PaperPicker.tsx
@app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
@app/src/components/physic-paint/physicsPaintStudio.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Brush-tab title removal + panel padding + card border (moves 1, 2, 3)</name>
  <files>app/src/components/physic-paint/view/BrushResponsePanel.tsx, app/src/components/physic-paint/view/BrushResponsePanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx, app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts</files>
  <action>
One atomic commit (Brush-tab group). Three moves, one commit so the user UATs the Brush rows together.

**Move 1 — drop the response section title (keep the collapsible body).**
In `app/src/components/physic-paint/view/BrushResponsePanel.tsx`, the toggle button currently wraps `<RuleSectionHeader text="..." />` (line ~108). <!-- planner-discipline-allow: Brush response -->
- Remove that `RuleSectionHeader` element and its `RuleSectionHeader` import if unused.
- KEEP the toggle button, `data-testid="brush-response-toggle"`, `aria-expanded`, the `brushResponseOpen` signal, collapsed-by-default, and the body branches (placeholder when `selectedTipId === null`, the 8 `MultiplierSlider` rows when open). D-04 collapse stays.
- The button needs a non-zero hit target now that the title is gone: give it a bare 1px full-width horizontal rule (same `rgb(205, 201, 201)` line the section header used) as its only child, keep the existing button inline styles, and put `aria-label="Brush response"` on the button so the control stays named without visible title text. <!-- planner-discipline-allow: Brush response -->
- Do not add a chevron, a new label, or any other chrome. Do not change the multiplier band / effective-value formula.

**Move 3 — Brush-only top padding (the item-1 vs item-3 resolution).**
- `physicsPaintStudio.css`: keep `.physics-paint-options-tab-panel-flat { padding: 0 14px 14px; }` exactly as-is (Paper tab unchanged).
- Add a Brush-specific override placed AFTER that rule so it wins: target the Brush panel only. Preferred: add class `physics-paint-options-tab-panel-brush` next to the two existing classes on the Brush `role="tabpanel"` in `PhysicsPaintRightPanel.tsx` (~line 325) and add `.physics-paint-options-tab-panel-brush { padding: 14px 14px 14px; }`. Do NOT touch the Paper panel element (~line 329). Do NOT change the shared `.physics-paint-options-tab-panel` 20px top.

**Move 2 — brush card border hex.**
In `WatercolorBrushLibrary.tsx` the card button border is `1px solid #c8c8c8` (set in 261018-ias). Replace that hex with `#777777` (keep `1px solid`, keep the selected accent background tint, keep `#fff` thumb canvas background).

**Pin retargets in the same commit:**
- `BrushResponsePanel.test.ts`: the case that asserts the titled header is present must retarget — assert the visible title text is NOT in `textContent`, while `brush-response-toggle` still exists and stays collapsed by default (no `Tip` multiplier label in the tree until toggled). Keep the placeholder + 8-row reveal + D-08 band tests as-is.
- `WatercolorBrushLibrary.test.ts`: the "light gray border" case pins `'1px solid #c8c8c8'` — retarget to `'1px solid #777777'`. Keep the "no white border / no sidebar-border / selected accent tint" predicates.
</action>
<verify>
<automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/BrushResponsePanel.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/AquarelleParamsPanel.test.ts</automated>
</verify>
<done>
BrushResponsePanel renders no rule-and-label section title; the toggle (same testid) still expands the 8 multiplier rows and stays collapsed by default. Brush tab panel has 14px top padding while Paper keeps 0 14px 14px. Every brush card border is `1px solid #777777`. panelSplitShell mount-order pin (BrushResponsePanel before WatercolorBrushLibrary) and AquarelleParamsPanel "no response block" pin stay green.</done>
</task>

<task type="auto">
  <name>Task 2: Paper-tab cell chrome + full-row-width thumbs (moves 4, 5, 6)</name>
  <files>app/src/components/physic-paint/view/PaperPicker.tsx, app/src/components/physic-paint/view/PaperPicker.test.tsx</files>
  <action>
One atomic commit (Paper-tab group). Three cosmetic moves on `PaperCard` / the two `paper-picker-grid` blocks in `app/src/components/physic-paint/view/PaperPicker.tsx`.

**Move 5 — cell fill.** In `PaperCard`'s button inline style, replace the `background: '#c4c4c4'` value with `rgb(218, 218, 218)`. Applies to every paper cell and both background-arm cells (shared `PaperCard`).

**Move 4 — name padding.** On the `.paper-picker-cell-name` span inline style, replace `padding: '2px 1px'` with `padding: '3px 4px'`. Keep the 9px / 0.14em uppercase name styling and the name-below-thumb layout.

**Move 6 — thumbs fill the row width (keep ~2:1 landscape).**
Current geometry is fixed 112px columns (`gridTemplateColumns: repeat(2, ${CARD_WIDTH}px)` + `PaperCard` `width: ${CARD_WIDTH}px`) which leaves a visible gap on the right of the row (UAT image 79). Stretch to the panel width without re-painting thumbs:
- Both grids (`data-paper-group-grid="real"` and `data-paper-group-grid="procedural"`): `gridTemplateColumns: 'repeat(2, 1fr)'`, keep `gap: ${GRID_GAP}px` (8).
- `PaperCard` button: drop the fixed `width: ${CARD_WIDTH}px`; use `width: '100%'` (grid `1fr` columns already size the track). Keep `boxSizing: 'border-box'`, column flex, borders, radius.
- Thumb window (the div wrapping `props.thumb`): keep `width: '100%'`, replace fixed `height: ${THUMB_HEIGHT}px` with `aspectRatio: '${CARD_WIDTH} / ${THUMB_HEIGHT}'` (112/64 ≈ 1.75:1, the locked landscape look) and `height: 'auto'` so the thumb scales with the cell.
- KEEP `const CARD_WIDTH = 112` / `const THUMB_HEIGHT = 64` / `const GRID_GAP = 8` as the `paperThumb` paint/cache sizes (`getPaperThumb(id, CARD_WIDTH, THUMB_HEIGHT)` and the procedural `<canvas width={CARD_WIDTH} height={THUMB_HEIGHT}>` bitmap stay). Display stretch is CSS-only — never `toDataURL`, never re-paint, never change the cache key shape.
- Procedural / real / background-arm thumbs already use `width: '100%', height: '100%'` inside the window — they inherit the new aspect box unchanged.

**Pin retarget in the same commit (`PaperPicker.test.tsx`, the landscape-constants case ~line 412):**
- Keep asserting `const CARD_WIDTH = 112`, `const THUMB_HEIGHT = 64`, `const GRID_GAP = 8`, and that the square `CELL_SIZE` idiom is gone.
- Retarget the column-template assertion from the fixed `repeat(2, ${CARD_WIDTH}px)` form to the fill law (`repeat(2, 1fr)` / equivalent literal in source), and assert the thumb window carries the landscape `aspectRatio` (or equivalent) so the ~2:1 look is pinned. Name-stays-below and the oracle-ten-names cases stay as-is.
</action>
<verify>
<automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PaperPicker.test.tsx.test.ts src/components/physic-paint/view/paperThumb.test.ts src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts</automated>
</verify>
<done>
Paper cells are filled `rgb(218, 218, 218)` with name padding `3px 4px`. Both paper grids use 1fr two-column tracks that stretch to the full panel row; each card keeps the 112/64 landscape thumb aspect and name below. `paperThumb` cache/paint constants are unchanged. PaperPicker + paperThumb + paper-single-home pin suites green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio UI (trusted) → no new IO | Cosmetic CSS/TSX only; no new inputs, stores, or IPC |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261018-JLB-01 | Tampering | paperThumb cache | low | mitigate | paint-size constants (112x64) and cache key unchanged; display stretch is CSS-only; no toDataURL/toBlob |
| T-261018-JLB-02 | Information Disclosure | none | low | accept | no new data surfaces; pure presentational chrome |
| T-261018-JLB-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new packages this quick; package-legitimacy gate N/A (no install tasks) |
</threat_model>

<verification>
After both commits, from the checkout root:

`pnpm --filter efx-motion-editor exec vitest run`

Expect at least: `BrushResponsePanel.test.ts`, `WatercolorBrushLibrary.test.ts`, `PaperPicker.test.tsx.test.ts`, `paperThumb.test.ts`, `panelSplitShell.test.tsx.test.ts`, `AquarelleParamsPanel.test.ts`, `physicsPaintRightPanelPaperSingleHome.test.ts`, `physicsPaintRightPanelModuleGate.test.ts`, `PhysicsPaintTopBar.test.ts` green.

Scope fence: no `SPECS/` diff, no package.json / lockfile diff, no `phase-55-issues/index.md` row ticks, no `RightPanelBrushTab` child reorder, no `physicPaintStore.ts` `getImageData|putImageData`.
</verification>

<success_criteria>
- Two commits (C1 Brush-tab moves 1–3, C2 Paper-tab moves 4–6).
- No visible rule-and-label response section title; collapsible body + D-04 collapse intact via a bare-rule toggle.
- Brush tab top padding 14px; Paper tab / generic `-flat` stays `0 14px 14px`.
- Brush card borders `#777777`.
- Paper cell fill `rgb(218, 218, 218)`; name padding `3px 4px`.
- Paper thumbs fill the row width in 2 columns at ~2:1 landscape.
- Pin suites green after each commit; mount-order pin untouched.
</success_criteria>

<output>
Create `.planning/quick/261018-jlb-fifth-uat-round-on-the-watercolor-brush-/261018-jlb-SUMMARY.md` when done
</output>
