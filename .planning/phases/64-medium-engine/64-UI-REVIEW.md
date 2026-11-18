# Phase 64 — UI Review

**Audited:** 2026-11-18
**Baseline:** Abstract 6-pillar standards — no UI-SPEC.md exists for this phase. The de facto contract is `64-CONTEXT.md` D-01..D-20 plus the UAT rows in `64-UAT.md`.
**Screenshots:** Not captured — no dev server on localhost:3000 / 5173 / 8080 (all answered `000`), and Playwright's chromium headless shell is not installed. The user's server on 5173 stopped mid-session; per CLAUDE.md the auditor does not start it. Code-only audit.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

**Scope note:** Phase 64 is almost entirely engine and probe work. The visible delta is: (a) the medium dropdown row at the top of the Paint tab's globals panel and its five always-expanded brush-library sections, (b) three light rows under a renamed "Paper & Light" tab, (c) the Studio paint surface, which has no new chrome. Everything else (17 plans, ~60 commits) has no UI.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Specific, non-generic labels and an excellent import-failure string; "Reset" is both generic and untruthful — it returns all ten globals to defaults but leaves the dropdown claiming the old medium name. |
| 2. Visuals | 3/4 | Contract layout met (dropdown first, five expanded sections, texture strip above), but the phase's primary control is styled identically to Reset and carries no menu affordance (no chevron). |
| 3. Color | 3/4 | No new hardcoded colors in the phase's own UI; two undocumented accent hues coexist (orange `#f08a24` selection vs blue `#2f67e8` progress/focus) and two error reds (`#ef4444`, `#FF6666`). |
| 4. Typography | 3/4 | D-18's 10px/700 uppercase section headers are correct; four sizes inside a 2px band (9 / 10 / 10.5 / 11px) for sibling labels produce no hierarchy step. |
| 5. Spacing | 3/4 | Coherent 3/4/6/8/10/15px rhythm, but the medium menu reuses a popover tuned for 34px thumbs — 15px dead top padding and 46px rows for a five-word list. |
| 6. Experience Design | 2/4 | `role="menu"` without arrow-key roving or focus-on-open, no scroll/resize dismissal or re-anchor, stale `aria-label="Paper"` on the renamed tabpanel, Reset silently desyncs the medium selection. |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **Medium menu is not keyboard-operable as a menu, and detaches from its anchor** — `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx:190-228` opens a `role="menu"` with `role="menuitemradio"` items but implements no roving tabindex, no arrow-key/Home/End handling, and no focus-on-open (focus stays on the trigger; every item is a natively tabbable button, so Tab walks them — usable but non-conforming, and mashing Tab through a menu is not the WAI-ARIA menu contract the role promises). The captured listeners (lines 113-114) close on outside pointerdown and Escape only — nothing closes or repositions on scroll or resize while the panel around it scrolls (`PhysicsPaintRightPanel` content scrolls), and the anchor is computed once at toggle (`toggleMediumMenu`, lines 148-155). **Impact:** keyboard and screen-reader users get a broken menu interaction; any user who scrolls the Paint panel with the menu open gets a popover floating away from its trigger. **Fix:** move focus to the checked item on open, `tabIndex={-1}` on items with ArrowUp/Down/Home/End + Enter/Space, return focus to the trigger on close, and add a `scroll`/`resize` listener (capture-phase, like the existing pair) that either closes the menu or re-anchors it from the trigger's rect.

2. **The phase's primary new control has no visual affordance and is indistinguishable from Reset** — the medium trigger (`AquarelleGlobalsPanel.tsx:169-187`) uses `class="physics-paint-text-button"`, the same 11px/700 `#505255` grey capsule as the Reset button at line 243 (CSS `physicsPaintStudio.css:607-616`), and shows no chevron/caret to say "this opens a menu". Its popover is the brush popover's shell verbatim: 212px wide, `padding: 15px 6px 6px` (CSS 1056-1075 — the 15px exists to clear the brush popover's "Open modal" button, which the medium menu does not have) and 46px-tall rows tuned for a 34px thumb (CSS 1119-1144) that the medium items never render — so five text-only names float in ~265px of mostly empty card. **Impact:** users do not discover the medium switch (the phase's headline feature), and the menu reads as an oversized brush menu with the thumbs missing. **Fix:** add an explicit caret and a distinct treatment for the trigger (e.g. outlined/raised row rather than the flat grey text-button, or a labelled value chip with a chevron); add a compact menu variant (`padding-top: 6px`, 30-32px row height, full-width name) or scope the 15px padding to `.physics-paint-brush-menu-open-modal`'s presence.

3. **Reset is a lie about the medium** — `onReset` (`AquarelleGlobalsPanel.tsx:136-144`, button at 240-252) loops all ten `GLOBAL_ROWS` back to `DEFAULT_PARAMS × 100` and commits one bag, but never writes `aquarelleSelectedMediumId`. After Reset the dropdown still reads e.g. "Acrylic" while Water/Pigment/Flow/…/Body/Emboss are all neutral. D-03 deliberately allows the medium record and the params to diverge with no "edited" marker, so the UI has no honest state to fall back on when the divergence is total. The `DEFAULT_MEDIUM_ID` fallback at line 158 is only reachable if the id is null, which Reset never makes it. **Impact:** the user presses Reset expecting a clean slate but the panel claims a medium whose entire definition (including Viscosity and Body, the phase's headline parameters) has been zeroed — the exact "which medium am I in?" ambiguity D-03 accepted at a 5% divergence, now at 100%. **Fix:** either (a) have Reset also call `applyAquarelleMedium(DEFAULT_MEDIUM_ID)`-equivalent state so the label matches the values, or (b) relabel the button to what it does ("Reset globals") so the label stops implying the medium resets too.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Good:**
- The ten globals labels are specific and domain-true: `Water`, `Pigment`, `Flow`, `Bleed`, `Edges`, `Grain`, `Dry speed`, `Viscosity`, `Body`, `Emboss` (`AquarelleGlobalsPanel.tsx:48-59`). No "Strength"/"Amount"/"Intensity 2" filler; "Dry speed" is a sentence-shaped label where "Speed" would have been ambiguous.
- The import-failure copy is a model of its kind: `IMPORT_TIP_FAILURE_COPY = 'Import failed — this file is not a readable PNG or JPG. Nothing changed.'` (`packages/efx-watercolor/src/brushes/importTip.ts:55-56`), rendered in the error color as a full-width row (`WatercolorBrushLibrary.tsx:212-219`). Names the cause, the accepted formats, and the blast radius in one line.
- The tab was renamed to `Paper & Light` (`PhysicsPaintRightPanel.tsx:141`), matching D-06 and UAT row 4's expected reading.

**Findings (WARNING):**
- `Reset` (`AquarelleGlobalsPanel.tsx:251`) is the only generic verb in the panel, and it under-describes its action (see Top 3 #3). A phase whose whole thesis is "named mediums own their parameter records" should not ship a button that says "reset" while leaving the medium name untouched.
- `Medium` / `Medium <name>` trigger copy (`AquarelleGlobalsPanel.tsx:185-186`) is correct but bare; the value gets no verb or state word ("Medium — Acrylic" reads the same whether the record was ever applied or hand-drifted, which is D-03's accepted cost rather than a copy defect).

### Pillar 2: Visuals (3/4)

**Good:**
- Layout contract is met: the medium row is the first row of the globals panel (`AquarelleGlobalsPanel.tsx:168` precedes `GLOBAL_ROWS` at 230), matching D-01; the five brush sections sit below the import row and `WatercolorTextureStrip` (`WatercolorBrushLibrary.tsx:361-370`), matching D-19's "texture strip above"; every section renders without a collapse control.
- The active medium row uses the established orange selection language (`physicsPaintStudio.css:1134-1138`, border `#f08a24` / fill `rgba(240,138,36,0.3)`) consistent with the brush cards (`:2349-2369`) — one selection vocabulary across the popovers, per D-20.

**Findings (WARNING):**
- Trigger has no caret and shares `physics-paint-text-button` with Reset (see Top 3 #2). `aria-haspopup="menu"` is the only signal that anything opens, and it is invisible.
- Menu items carry only a name span (`AquarelleGlobalsPanel.tsx:222`) inside a 46px thumb-sized row (CSS 1119-1124) — five names in a column of empty slots. The brush popover's visual system assumes a thumbnail that these items do not have.
- `BrushSection` headers are visually subordinate in the right way (10px/700 uppercase secondary), but the section header and its first row have only `gap: 6px` (inline, `WatercolorBrushLibrary.tsx:306-318`) against `8px` between cards — the grouping boundary is barely stronger than the intra-group rhythm, so five always-expanded sections read as one long grid with occasional bold captions.

### Pillar 3: Color (3/4)

**Good:**
- No new hardcoded colors in the phase's own components: the medium UI relies on existing classes and `var(--sidebar-text-secondary, #9aa5b1)` / `var(--color-error-text, #FF6666)` tokens with fallbacks (`WatercolorBrushLibrary.tsx:216, 318`). `RightPanelPaperTab.tsx` introduces no color at all. The three light rows inherit `SliderStepper`'s token set.
- The 60/30/10 split of the Studio's dark chrome is untouched by this phase — no new surface color, no new border color.

**Findings (WARNING):**
- Two accent hues coexist with no declared rule: orange `#f08a24` marks selection (medium item, brush card) while blue `var(--color-accent, #2f67e8)` drives slider progress (`SliderStepper.tsx:247`) and `var(--color-accent, #2d5be3)` drives focus rings (`physicsPaintStudio.css:758-776`) — three accents if the two blues are counted as distinct. Within one popover the checked row is orange and, one row below, slider fills are blue. Not introduced by Phase 64, but the phase's new surfaces sit across both systems.
- Two error reds: `#ef4444` for a mixed slider value (`SliderStepper.tsx:160`) and `#FF6666` for the import failure (`WatercolorBrushLibrary.tsx:216`). The phase added the second surface without reconciling the first.
- Active selection is conveyed by color plus a 1px border only (`physicsPaintStudio.css:1134-1138`) — `aria-checked` covers assistive tech, but for color-vision-deficient users the single hue difference (orange border + 30% orange fill) is the sole visual marker on an otherwise identical row.

### Pillar 4: Typography (3/4)

**Good:**
- D-18 is implemented exactly: section titles are 10px / 700 / `letterSpacing: 0.06em` / uppercase / secondary-text (`WatercolorBrushLibrary.tsx:313-318`).
- Font weights stay at 600/700 across the phase UI — no four-weight soup; labels and values use the same weight as their siblings in `SliderStepper` (11px/600 per the component contract).

**Findings (WARNING):**
- Four distinct sizes inside a 2px band: 9px texture chip names (`.watercolor-texture-chip-name`, CSS ~2369 block), 10px section headers and brush names, 10.5px menu item names (`.physics-paint-brush-menu-name`, CSS 1157-1166), 11px trigger/Reset labels (`.physics-paint-text-button`, CSS 607-616). A 9/10/10.5/11 ladder is four steps of visual noise masquerading as hierarchy — at these sizes the steps are nearly invisible, so the medium name in the trigger does not read as more important than the section headers it labels.
- The menu item name (10.5px/600) and the trigger value (11px/700) are near-twins, so the selected row inside the menu and the collapsed trigger look the same weight — no "this is the current value" reinforcement.

### Pillar 5: Spacing (3/4)

**Good:**
- Consistent rhythm across the new UI: `physics-paint-option-group` gap 15px / padding-top 2px (CSS 1761-1766), `physics-paint-option-row` gap 10px / min-height 28px (CSS 1752-1759), `BrushSection` outer gap 6px with an inner 8px card grid (`WatercolorBrushLibrary.tsx:297-318`), texture strip and import row spanning `1 / -1` (lines 212, 361).
- No arbitrary spacing values were introduced by this phase outside the existing component contract.

**Findings (WARNING):**
- The medium menu inherits the brush popover's geometry wholesale: `padding: 15px 6px 6px` (CSS 1067) where the 15px exists for a button the medium menu does not render, and 46px item height (CSS 1124) where the items have no thumb. Five items → roughly 245px of list plus 15px dead air in a 212px column, for content that is five words.
- Trigger row uses only the `physics-paint-option-row` minimum (28px) while the trigger is a full-width button with 6px/10px padding — the row reads tighter than the menu it opens, inverting the usual "control is lighter than its surface" expectation.
- Menu `maxHeight` is computed from the anchor to the viewport bottom (`AquarelleGlobalsPanel.tsx:163-164`) — correct math, but because the anchor is captured once, a scroll of the panel leaves the clamped height sized for a position the menu no longer occupies.

### Pillar 6: Experience Design (2/4)

**Good:**
- Dialog-adjacent state management is careful where the phase touched it: outside-pointerdown and Escape close (`AquarelleGlobalsPanel.tsx:96-119`), with the trigger excluded from the outside-click test (line 104) so the toggle does not fight its own close; `aria-haspopup`/`aria-expanded`/`aria-checked` all present and correct; picking a medium closes the menu (line 219).
- The light rows are properly controlled and one-undo-per-gesture: `props.light ?? DEFAULT_LIGHT` keeps the panel truthful when the document has no stored light (`RightPanelPaperTab.tsx:37-40`), each row emits a one-field patch (lines 63/76/89), `disabled={props.disabled}` is forwarded, and the slider's `startCoalescing/stopCoalescing` gives row 4's "one slider gesture is one undo step" its mechanism.
- Import exposes a busy state and a specific failure state rather than a silent no-op (`WatercolorBrushLibrary.tsx:186-219`).
- Empty groups are omitted (`brushSections` returns only populated sections), so no header ever renders over an empty grid.

**Findings (WARNING / one BLOCKER-adjacent):**
- **Menu keyboard semantics are incomplete** (see Top 3 #1): role promises roving arrow-key navigation and focus management; the implementation provides neither. A screen-reader user hears "menu, medium" and then finds ordinary Tab order inside it, and closing with Escape does not restore focus to the trigger. Classification: WARNING (a keyboard path exists, so no flow is impossible — but the declared role is not honoured).
- **No positional stability while open:** no `scroll`/`resize` listener and a single anchor capture (`AquarelleGlobalsPanel.tsx:113-114, 148-155`). The Paint tab scrolls (`PhysicsPaintRightPanel` content scroller); with the menu open, scrolling the panel slides the trigger away while the fixed popover stays put. Classification: WARNING.
- **Stale accessible name on the renamed panel:** the tab list renders the visible label `Paper & Light` (`PhysicsPaintRightPanel.tsx:141`) but the tabpanel keeps `aria-label="Paper"` (line 349). 64-09's plan explicitly left the `'paper'` id and the panel's `aria-label` untouched — a deliberate scope call that now ships a visible-name / accessible-name mismatch. Classification: WARNING; fix is one attribute.
- **Reset has no confirmation, no undo affordance, and desyncs the medium label** (see Top 3 #3). It is one undo step by construction (single `commitAquarelleSelectionParams`), so recovery exists — but nothing on the control or near it says so, and the trigger keeps displaying a medium the values no longer match. Classification: WARNING.
- The trigger's mixed state (medium record ≠ current params, per D-03) is rendered as if it were the medium record — there is no neutral/"custom" affordance even when every parameter has been hand-zeroed. D-03 accepted the drift; combined with Reset it produces a state where the label is maximally wrong. Classification: WARNING (design-decision debt surfacing in the UI).

---

## Registry Safety

Skipped — no `components.json` in the repository; shadcn is not initialized and no third-party registry blocks exist.

---

## Files Audited

- `.planning/phases/64-medium-engine/64-CONTEXT.md` (D-01..D-20, the de facto design contract)
- `.planning/phases/64-medium-engine/64-UAT.md` (all 10 rows)
- `.planning/phases/64-medium-engine/64-01-PLAN.md` … `64-17-PLAN.md` (all 17)
- `.planning/phases/64-medium-engine/64-01-SUMMARY.md` … `64-17-SUMMARY.md` (all 17)
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx`
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`
- `app/src/components/physic-paint/view/RightPanelPaperTab.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- `app/src/components/physic-paint/physicsPaintStudio.css` (menu, option-row/group, text-button, focus-visible, brush-card blocks)
- `app/src/components/shared/SliderStepper.tsx` (value/track/stepper interaction and typography)
- `packages/efx-watercolor/src/brushes/importTip.ts` (failure copy)
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`, `AquarelleCachedBaseLayer.tsx`, `PhysicsPaintCanvasMount.tsx`, `aquarelleEnginePort.ts` (paint surface; no new chrome)
