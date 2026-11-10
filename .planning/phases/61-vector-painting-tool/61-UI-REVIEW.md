# Phase 61 — UI Review

**Audited:** 2026-11-10
**Baseline:** `61-UI-SPEC.md` (approved 2026-11-10) — audited section by section against the Copywriting Contract, Typography, Color, Spacing and Interaction Contract
**Screenshots:** not captured — no dev server reachable on ports 3000 / 5173 / 8080; static code review only per the orchestrator constraint (the user owns the dev server; Playwright capture is unavailable for this app)
**Interaction captures:** off (`workflow.ui_interaction_capture: false`)

> This is a code-derived audit. No rendered pixels were inspected. Every visual claim below is traced to source (inline style, CSS rule, or SVG attribute). The UI-SPEC's held-out visual rows (E5 overflow, E6 loading, E7 loading/populated, E8 thumb) and the plans' live UAT rows remain unverified by construction.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 15 of 16 contract strings are verbatim; the primary CTA's `title` drops the mandated draw-gesture grammar, the one surface that teaches Alt-corner / Enter / double-click / first-anchor finish |
| 2. Visuals | 3/4 | Rail entry, separator, header order, overlay draw order and zoom law all match; the wireframe-only view suppresses the serial badge and bounds chrome the contract keeps "on top", and handle/envelope styling deviates |
| 3. Color | 3/4 | Chrome palette and accent discipline are exact; three canvas alpha/stroke values deviate from the declared band/handle law (`0.12` vs `0.14/0.07`, `strokeOpacity 0.5`, handles at `fillOpacity 0.6` + white stroke) |
| 4. Typography | 2/4 | Sheet type is otherwise exact, but the only new numeric readout loses `font-variant-numeric: tabular-nums` and the mandated `BrushResponsePanel` span grammar, and two new 400-weight strings are undeclared |
| 5. Spacing | 4/4 | Every new gap, padding and dimension is on the declared scale or a declared shipped exception; the rail separator matches its derived geometry exactly |
| 6. Experience Design | 2/4 | State coverage is strong, but the mandated live rubber-band spine to the cursor is absent from the draw state, and the picker is fully disabled (not merely disarmed) under wireframe; four live backstops unverified |

**Overall: 17/24**

Finding classification: **no BLOCKERs** — no pillar scored 1 and no defect prevents completing a draw, edit, save or reopen flow. Six WARNING-level defects are listed below, one per affected pillar (Spacing has none).

---

## Top 3 Priority Fixes

1. **The draw state has no live rubber-band spine to the cursor** — `vectorDrawDraft.cursor` is written (`view/vectorPathSession.ts:31-34,137-156`) but never read, and `VectorPathOverlay` binds `onPointerMove` only for edit drags (`engine/VectorPathOverlay.tsx:889`); the draft renders placed anchors only (`:633-638`). UI-SPEC Interaction Contract §2 requires "anchors placed so far + a live rubber-band spine to the cursor". A user drawing a path gets no preview of the next segment or the curve it will produce — the phase's headline gesture feels blind. Fix: track the pointer in the draft and append the cursor station to the drawn draft path (plus the derived handle preview if feasible), or amend the contract explicitly.

2. **The Vector pen `title` omits the mandated interaction grammar** — shipped `title="Vector pen — draw a vector path (V)"` (`view/PhysicsPaintToolRail.tsx:176`) vs contract `Vector pen (V) — click to place a smooth anchor · hold Alt for a corner · Enter or double-click to finish · click the first anchor to finish there` (`61-UI-SPEC.md:180`). UI-SPEC E1 long-text coverage deliberately parks the entire grammar in this native title; with it removed, nothing in the UI teaches Alt-corner, Enter/double-click finish, or first-anchor finish (grep confirms no other surface carries it). Fix: use the contract string verbatim.

3. **The Anchor width `→ n px` readout loses the mandated numeric-readout grammar** — the dialog passes a plain interpolated string (`view/PhysicsPaintStrokeSettingsDialog.tsx:1698-1700`) into `SliderStepper`'s `below` slot, whose `BELOW_STYLE` sets no font size, weight, colour or `tabular-nums` (`shared/SliderStepper.tsx:158-164,600-602`). The contract requires `below={<span …>→ {effectivePx} px</span>} — the exact BrushResponsePanel multiplier grammar` (`61-UI-SPEC.md:312`) and states numeric readouts set `font-variant-numeric: tabular-nums` (`:125`). The reference span sets `10px / 600 / var(--sidebar-text-secondary) / tabular-nums` (`view/BrushResponsePanel.tsx:61-73`). The value itself is correct (Size x factor, never `scriptScale`); only its presentation is wrong, and a proportional readout jitters while the value steps.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified verbatim against the Copywriting Contract:
- Wireframe `aria-label` and `title` — `PhysicsPaintToolRail.tsx:248-249` vs spec `:194`.
- Paint-row wireframe reasons — `PhysicsPaintToolRail.tsx:136-138`; Dry `:261`; matches the contract's shape (`:188`).
- Draft reason — `PhysicsPaintStrokeSettingsDialog.tsx:1079-1081` vs spec `:190`.
- `Edit path` label, and both disabled reasons in native `title` — `strokeSettingsModel.ts:813,816,819,839-852`; matches `:181,189`.
- Empty width caption — `PhysicsPaintStrokeSettingsDialog.tsx:1708-1715` vs spec `:183`.
- Render label, `Watercolor` / `Ribbon`, red italic `Mixed` — `PhysicsPaintStrokeSettingsDialog.tsx:1588-1596,1604-1622`; model `strokeSettingsModel.ts:153-156`; matches `:191`.
- `Advanced — wet globals` and the note — `PhysicsPaintStrokeSettingsDialog.tsx:1779,1814`; note constant `strokeSettingsModel.ts:114-115`; matches `:193`.
- Rejection copy — `PhysicsPaintStudio.tsx:365`, published through the existing status capsule at `:10044-10056`; matches `:185`.
- `Simple ribbon` name and hint — `packages/efx-watercolor/src/playground/brushes.ts:355-356` vs spec `:195`.

**WARNING — primary CTA title.** `PhysicsPaintToolRail.tsx:176` ships `Vector pen — draw a vector path (V)`. The contract string (`61-UI-SPEC.md:180`) carries four interaction rules in one native tooltip; that tooltip is the only teaching surface for the nonstandard draw law. The aria-label (`Vector pen`) and the `(V)` shortcut hint are correct, so the button is identifiable but the gesture set is undiscoverable. This is the only copy deviation found in the phase.

**Contract ambiguity (no action):** the no-vector-stroke copy appears twice in the spec — with a trailing period at `:184` and without at `:189`; the implementation follows the more specific disabled-reason row.

### Pillar 2: Visuals (3/4)

Matches:
- Rail structure: separator `PhysicsPaintToolRail.tsx:170` + CSS `.physics-paint-rail-separator` (21px x 1px, `margin: 1px 0`, `#5a5e63`, `physicsPaintStudio.css:701-707`) exactly matches the derived value (`61-UI-SPEC.md:166`); pen button 35x35 with `PenTool size={18}` and one-active-surface precedence (`:132,171-182`); wireframe latch mounted after Motion boundaries and before Dry (`:243-254`) with the declared icon and active amber (`physicsPaintStudio.css:616-621`).
- Header order and chrome: delete-selection, preview-stroke-size, spline-pointer, view-toggle, close (`PhysicsPaintStrokeSettingsDialog.tsx:942-1006`); 22x22, opacity 0.4 disabled and blue `#2d5be3` pressed state (`physicsPaintStudio.css:6219-6248,6272-6276`); `SplinePointer size={12}`, `onPointerDown` stopPropagation, `aria-pressed` from the gate (`:377-391`).
- Overlay draw order is exactly envelope, spine, rungs, anchors, handles (`VectorPathOverlay.tsx:300-310,333-534`); marker extents counter-scaled by the effective zoom (`:323-325`); wireframe two-pass spine and rungs match the shipped polyline law (`:356-464`). Hand-painted bands in wireframe use the shipped `buildStrokeBand` and the declared `0.14/0.07` fill and `3.5/1.5` edges (`ScriptStrokeOverlay.tsx:375-449`).
- Every icon-only control audited carries both `aria-label` and a `title` (pen, wireframe, picker, Dry, Re-read, Trash, all header buttons).

**WARNING — wireframe-only chrome suppression.** With wireframe on and no selection surface active, the overlay deliberately skips the bounds box and the serial badge (`ScriptStrokeOverlay.tsx:488,506`; comment `:152-155`). Contract draw-order item 6 requires the existing transform box / serial badge / lift ribbon to remain "unchanged, on top" (`61-UI-SPEC.md:338`). Chrome does return once Select is entered, so the surface is usable, but the construction view silently drops the serial identity the contract keeps.

**WARNING — marker styling.** Bézier handles render as `#f59e0b` at `fillOpacity 0.6` with a 1px white stroke (`VectorPathOverlay.tsx:518-528`, `HANDLE_OPACITY 0.6` at `:98`), while contract item 5 declares solid `#f59e0b` circles joined by a `0.6` connector (`61-UI-SPEC.md:337`). The connectors are correct; the dots read softer than declared.

### Pillar 3: Color (3/4)

Matches:
- Chrome: rail active amber `#f59e0b` / border `#fbbf24` / icon `#241a05` (`physicsPaintStudio.css:616-621`); pressed header `#2d5be3` (`:6272-6276`); sheet surface `rgba(28,30,34,0.9)` (`PhysicsPaintStrokeSettingsDialog.tsx:257`); destructive/Mixed `#ef4444` (`:294`); segmented active uses the token `var(--color-accent)` (`:349-350`; `index.css:25`), not a second literal.
- Canvas palette constants are the declared set: `#38bdf8`, `#f59e0b`, `#111111`, `#ffffff`, lift `#ef4444` (`VectorPathOverlay.tsx:93-100`; `ScriptStrokeOverlay.tsx:68-73`).
- Accent discipline holds: amber only on the active rail button, blue only on pressed header / active segment / stepper progress, `#38bdf8` only on selected structure and auto anchors, `#f59e0b` only on owned control points. No new accent use was added to any dialog control.

**WARNING — three canvas alpha/stroke deviations from the declared band and handle law:**
1. Editing envelope fill `#38bdf8` at `0.12` (`VectorPathOverlay.tsx:349`, `ENVELOPE_FILL_OPACITY 0.12` at `:100`) vs the declared band fill "stroke colour @0.14 selected / @0.07 unselected" (`61-UI-SPEC.md:152`). The wireframe branch correctly uses `0.14/0.07` (`:338`); only the editing envelope is off.
2. The wireframe envelope edge adds `strokeOpacity={0.5}` (`VectorPathOverlay.tsx:340`) while the declared edge is "stroke colour, 1.5px / 3.5px" (`61-UI-SPEC.md:168`) — the vector envelope edge is half-transparent where the hand-painted band edge is not (`ScriptStrokeOverlay.tsx:445-446`), so the two envelope types do not read identically.
3. Handle fill opacity / white stroke as described under Visuals.

### Pillar 4: Typography (2/4)

Matches:
- Labels reuse `PAINT_ROW_LABEL_STYLE` 11px/600 (`PhysicsPaintStrokeSettingsDialog.tsx:277-281`); no new size class was introduced; segmented Render buttons keep the global uppercase rule with no opt-out (`FILTER_SEGMENT_*` opt-out applies only to the filter row, `:354-367`); the advanced note alone uses line-height 1.5 (`:322-329`) as declared (`61-UI-SPEC.md:124`); chevrons are 12px and the row 24px (`:309-320`, `:1776-1779`).

**WARNING — the anchor-width readout is unstyled.** `below` receives a plain string (`:1698-1700`), so it renders at the sheet's inherited size/weight/colour instead of the mandated 10px/600/secondary span with `font-variant-numeric: tabular-nums` (`61-UI-SPEC.md:125,312`; reference implementation `BrushResponsePanel.tsx:61-73`; unstyled slot `SliderStepper.tsx:158-164,600-602`). This is the phase's only new numeric readout and the contract names it explicitly.

**WARNING — two new 400-weight strings.** `ANCHOR_WIDTH_CAPTION_STYLE` (`:297-303`) and `ADVANCED_WET_NOTE_STYLE` (`:322-329`) set no `font-weight`, so both render at 400 — outside the declared "two weights 600/700" table whose only 400 exception is the italic `Mixed` caption (`61-UI-SPEC.md:113-121`). The file's only `fontWeight` declaration is 600 (`:279`). If the 400 explanation weight is intentional, the contract's exception list should say so; otherwise set 600.

### Pillar 5: Spacing (4/4)

No issues found. Evidence:
- New vertical rhythm uses the declared scale and shipped exceptions only: `SCROLL_CONTENT_STYLE` gap 10px / padding `10px 12px 0` (`:263-268`; declared exception), `SECTION_STYLE` gap 15px (`:271-275`; declared exception), `SEGMENT_LABEL_ROW_STYLE` gap 6px / marginBottom 4px (`:283-288`; 6px declared exception, 4px = xs), `ADVANCED_ROW_STYLE` 24px row / 4px gap / zero padding (`:309-320`; declared component dimension), `ADVANCED_WET_NOTE_STYLE` marginTop 4px (`:326`), `ANCHOR_WIDTH_CAPTION_STYLE` marginTop 4px (`:300`).
- Component dimensions match their declared sources: 35x35 rail buttons, 22x22 header buttons, 20px segment height (`:336-338`), 46x17 stepper value box (`SliderStepper.tsx`), 21px separator width with `1px 0` margin declared as component geometry (`61-UI-SPEC.md:98`).
- No arbitrary `[..px]` Tailwind values exist (the project styles with CSS custom properties and inline style objects); no off-scale new gap was found in the phase's added styles.

### Pillar 6: Experience Design (2/4)

Matches:
- Draw law is complete on input: click places an auto anchor, Alt+click a corner (`VectorPathOverlay.tsx:697-705`), first-anchor finish (`:680-691`), duplicate-adjacency refusal (`:693-696`), double-click finish (`:709-713`), Enter finishes / Escape cancels (`:214-229`), Delete/Backspace removes selected anchors (`:244-271`).
- Keyboard host shortcut: bare `V` (`physicsPaintStudioKeyboard.ts:386-388`), gated by the existing paint-edit mode guards.
- Disabled reasons and opacity: spline-pointer opacity 0.4 with the reason in `title` (`PhysicsPaintStrokeSettingsDialog.tsx:982-990`); Draft is `role="switch"`, `aria-checked`, forced on and `disabled` under wireframe with the exact reason (`:1073-1109`); rail paint/picker/dry controls state why they are inert (`PhysicsPaintToolRail.tsx:136-147,191-194,259-262`).
- Loading: the wireframe OFF path disables every rail control for the single-flight settle (`PhysicsPaintToolRail.tsx:120,247`; `scriptStrokeEdition.ts:196-215`), and the latch clears before the re-bake so no overlay is half-drawn.
- Empty/error/partial: empty width caption, Mixed captions on Render / width / wet globals, press-active writes nothing, unreadable paths are refused whole through the fixed error line (`PhysicsPaintStudio.tsx:10044-10056`), and a closed gate exits path edit through the shipped lifecycle effect (`strokeSettingsModel.ts:864-866`).
- Undo granularity is pinned one entry per finished path and per edit gesture (61-09/61-10/61-11/61-12 summaries and their tests).

**WARNING — missing live rubber-band preview.** As detailed in Top Fix 1: the spec's draw-state canvas column requires a live rubber-band spine to the cursor (`61-UI-SPEC.md:287`), but the draft's `cursor` station is never read and no pointer-move updates it. The user sees only committed segments and a crosshair until the next click.

**WARNING — the Picker is disabled rather than disarmed under wireframe.** Contract §5 says "the picker is disarmed" (`61-UI-SPEC.md:323`); the implementation exits the latch on wireframe ON (`PhysicsPaintStudio.tsx:5443-5444`) and additionally disables the picker button with a new reason (`PhysicsPaintToolRail.tsx:191-194`). Colour sampling is non-depositing and harmless while the bake is suspended, so the stricter gate removes a function the contract did not remove. This is a small interaction divergence, not a task blocker.

**Unverified live backstops (recorded, not scored):** E5 disclosure overflow, E6 settle-window disabled state, E7 dense-overlay usability (the contract's one unresolved assumption — no stroke cap; Wave 0 reference is 10 strokes at 1920x1080), and the E8 crisp-sweep thumb. The code contains the crisp branch (`watercolorStrokeThumb.ts:82-101,165-190`) and the preset row carries name/hint/thumb (`PhysicsPaintBrushMenu.tsx:173-198`; `brushMenuPresets.ts:26-29` imports the preset through the brush branch while the lift branch filters it out), but the pixels were not inspected. The plans' human-judgment UAT rows (61-11 D3, 61-12 D2/D4, 61-13 D2/D5, 61-14 D5) remain open.

---

## Minor Recommendations

1. Align the canvas overlay with the declared colour law: editing envelope `0.14` selected / `0.07` unselected (or amend the contract to `0.12`), drop `strokeOpacity 0.5` on the wireframe envelope edge, and render handle dots solid `#f59e0b` per §6 item 5.
2. Render the serial badge and bounds chrome under wireframe-only as the contract's draw-order item 6 states, or record the suppression as an approved contract amendment (the `Select` surface already restores them).
3. Re-enable the Picker under wireframe (keep only the disarm) to match §5, or document the stricter gate.
4. Decide the 400-weight explanation voice: set the two new captions to 600, or add them to the Typography exception table.
5. Resolve the spec-side inconsistency on rung thickness — §6 item 3 says 1px, the derived table says `#111111` 1.5px under `#ffffff` 1px; the code follows the derived table, which appears to be the intended law.
6. Exercise the four held-out visual rows live when the Studio is next open; this audit could not capture screenshots or interaction states.

---

## Files Audited

- `.planning/phases/61-vector-painting-tool/61-UI-SPEC.md`
- `.planning/phases/61-vector-painting-tool/61-CONTEXT.md`
- `.planning/phases/61-vector-painting-tool/61-01-SUMMARY.md` through `61-14-SUMMARY.md`
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`
- `app/src/components/physic-paint/view/strokeSettingsModel.ts`
- `app/src/components/physic-paint/view/vectorPathSession.ts`
- `app/src/components/physic-paint/view/vectorPathHandles.ts`
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts`
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx`
- `app/src/components/physic-paint/view/brushMenuPresets.ts`
- `app/src/components/physic-paint/view/watercolorStrokeThumb.ts`
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx`
- `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` (referenced by the wireframe band law)
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx`
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (record seams, refusal copy, wireframe toggle handler)
- `app/src/components/shared/SliderStepper.tsx`
- `app/src/components/physic-paint/physicsPaintStudio.css`
- `app/src/index.css`
- `packages/efx-watercolor/src/playground/brushes.ts`
