# Phase 63 — UI Review

**Audited:** 2026-11-15
**Baseline:** abstract 6-pillar standards (no UI-SPEC.md in `.planning/phases/63-brush-tip-pipeline/`); cross-checked against ROADMAP success criteria 1, 3 and 4 and CONTEXT decisions D-03, D-05, D-19
**Screenshots:** not captured — no dev server on ports 3000/5173/8080; project instruction is "do not run the server" (code-only audit)
**Interaction captures:** off (`workflow.ui_interaction_capture=false`)
**Registry audit:** skipped — no `components.json` (shadcn not initialized)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Section labels and refusal copy are specific, but one copy string misdiagnoses 3 of the 4 refusal reasons |
| 2. Visuals | 2/4 | The top-bar pill shows "Brushes" + an empty swatch for every built-in/imported tip; right-panel thumbnails are horizontally squashed 17–35% |
| 3. Color | 2/4 | New text fails WCAG AA on the hardcoded Studio surfaces: section titles 2.56:1, error copy 3.69:1; light theme collapses to 1.06–1.62:1 |
| 4. Typography | 3/4 | Consistent 10px / weights 600–700, but section titles and body labels share one size, so hierarchy rests on case and weight alone |
| 5. Spacing | 3/4 | Consistent 6/8px rhythm, but 3px control radius vs 6px card radius, 24px vs 30px control heights, and 9 inline style objects where the file's convention is CSS classes |
| 6. Experience Design | 2/4 | A successful import produces no visible or announced feedback in the viewport; the failure line is never reset and is not a live region |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Active-tip pill cannot resolve built-in/imported tips** — `TopBarBrushTrigger` looks the id up only in `BRUSH_PRESETS` (`app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:112-114`), so selecting `wc/builtin-sponge` or a `wc/custom-*` tip leaves the Studio's primary brush surface showing the generic name "Brushes" (:118) and the empty-swatch branch (:133-138). User impact: after importing an image, the one surface that names the active brush never confirms the import exists — the exact "label didn't change" failure the phase's own specifics call out. Fix: resolve via `resolveCatalogTip` + `BRUSH_PRESETS` and render `<WatercolorBrushThumb presetId={selectedTipId} />` for any non-null id (the thumb module already handles mask-backed ids).
2. **Import success is invisible; import failure is sticky and unannounced** — `onImportFile` only handles the failure branch (`app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx:247-268`); nothing selects, scrolls to, highlights, or announces the new Custom card, which renders at the bottom of an 11+ card grid (Custom section :378-393) roughly a screen below the control. The failure line (:342-355) has no `role="alert"`/`aria-live` (unlike the warning at :328 which uses `role="status"`) and `importFailed` is a module signal with no other writer, so it survives project open/close. Fix: on `result.ok`, call `pickAquarelleBrush(result.tip.id)` (or scroll the card into view), and reset `importFailed` from the catalog reset path; add `role="alert"` to the failure div.
3. **New text colors fail contrast and are theme-unsafe** — Section titles use `var(--sidebar-text-secondary, #9aa5b1)` (:206) and error copy uses `var(--color-error-text, #FF6666)` (:334, :350) on surfaces that hardcode their backgrounds (`.physics-paint-right-panel` = `#3e3f41`, `physicsPaintStudio.css:1264-1273`; modal = `rgba(28,30,34,0.55)` over `#222529`). Measured WCAG ratios: section titles 2.56:1 (dark theme, right panel) and 3.92:1 (modal); error copy 3.69:1 (right panel) — both below 4.5:1 for 10px text. In the light theme `--sidebar-text-primary` resolves to `#1A1A2E`, giving the import-button label 1.62:1 and 1.06:1. Fix: use a fixed Studio-local title color at ≥4.5:1 (e.g. `#AEB6C2`) and a lighter error red (`#FF8A8A`), and stop reading app-theme tokens on fixed-palette surfaces.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING — one copy string covers four distinct refusal reasons.** `ImportTipFailureReason` has four members (`too-large`, `too-many-pixels`, `unreadable-image`, `registration-refused`, `packages/efx-watercolor/src/brushes/importTip.ts:42-46`) but the UI renders `IMPORT_TIP_FAILURE_COPY` ("this file is not a readable PNG or JPG. Nothing changed.", :54-55) for every `!result.ok` (`WatercolorBrushLibrary.tsx:262`). A 65 MB PNG, a 70 MP JPEG, or a main-realm registration refusal all get a factually wrong diagnosis and no actionable path. Fix: branch the copy, or name the limits ("PNG/JPG up to 64 MB and 64 megapixels").
- **WARNING — the only route to the new tips is labeled "Open modal"** (`app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx:154-167`), while the dropdown itself lists shipped presets only (`brushMenuPresets`, `brushMenuPresets.ts:17-19`). After the phase that made textured/imported tips first-class, the entry point to them is implementation jargon. Fix: "All brushes…" / "Browse & import…".
- Good: no generic `Submit`/`OK`/`Cancel`/"went wrong" strings anywhere in the phase's UI files (greps empty). Section labels are concrete ("Presets", "Texture", "Custom"). The aggregate warning handles singular/plural correctly and names scope ("in this project", `WatercolorBrushLibrary.tsx:337-339`).
- **Minor — the aggregate warning names a count, not the tips, and the greyed card's tooltip is only `title={tip.name}`** (:154, :389). A user must correlate a distant line with greyed cards to learn which brush broke.
- **Minor — the imported label is the raw file name** (`efxPaintBrushImport.ts:133`, `name: fileName` with only `.trim()` at :119). Extensions and underscores reach the grid (`Paint_Brush_sb4tebyp_1K_Brush.jpg`). 63-VALIDATION row 63-06.1 claims "truncated at import"; no truncation exists — the wire guard only refuses file names over 512 chars (`types/physicPaint.ts:2943,3028`).

### Pillar 2: Visuals (2/4)

- **BLOCKER-level finding — the primary brush surface misreports the active tip.** `TopBarBrushTrigger` resolves `presetId` only against `BRUSH_PRESETS` (`PhysicsPaintTopBar.tsx:112-114`); built-in and custom ids fall through to `name = 'Brushes'` (:118) and the `is-empty` swatch (:138). This is the exact surface the file header calls the place the "live tip reads at a glance". The new ids are introduced by this phase, so the seam was left unwired.
- **WARNING — card thumbnails are horizontally compressed in the right-panel Brush tab.** `.watercolor-brush-thumb` is `width:150px; height:44px; max-width:100%` (`physicsPaintStudio.css:2118-2126`). In the right panel the card content box is ~125px at a 1440px window (340 col − 20 panel padding − 6 pane padding − 28 tab padding = 286; 2 columns − 8 gap − 14 card chrome) and ~98px below 1180px (`physicsPaintStudio.css:8984`), so the 150×44 preview is squeezed to 125×44 / 98×44 — 17–35% distortion of the very previews D-05 added. It renders correctly in the floating modal (348px content → 156px card box, 150px fits).
- **WARNING — imported labels can break the card grid.** `.watercolor-brush-name` (`physicsPaintStudio.css:2128-2135`) has no `overflow`/`text-overflow`/`line-clamp`, and the card sets no `overflow: hidden` (`:2096-2109`). A long unbroken file name wraps unevenly or overflows, changing row heights in a 2-column grid of otherwise uniform cards.
- Good: sectioned grid in delivered order (Presets → Texture → Custom only when non-empty, `WatercolorBrushLibrary.tsx:356-393`); per-tip painted thumbs computed through the same `buildBrushForStroke` binding as the engine (`watercolorStrokeThumb.ts:190-196`), so a preview cannot drift; selected state is a visible orange tint + border (`physicsPaintStudio.css:2113-2116`); unavailable cards are greyed at opacity 0.45 with `not-allowed` (:163-167). Icon-only controls in the new surface: none (the import button carries icon + label; the modal close carries `aria-label`/`title`).

### Pillar 3: Color (2/4)

- **WARNING — measured contrast failures on the new text** (10px, weight 600/700 = normal-size text, AA needs 4.5:1):
  - section titles `--sidebar-text-secondary` = `#7B7B94` on the right panel `#3e3f41`: **2.56:1**; on the modal's effective `#1f2125`: **3.92:1**.
  - error copy `--color-error-text` = `#FF6666` on `#3e3f41`: **3.69:1** (medium theme `#FF7777`: 4.09:1; light `#CC3333`: 2.05:1).
- **WARNING — theme-scoped tokens on fixed-palette surfaces.** The import button label uses `var(--sidebar-text-primary, #eceff2)` (`WatercolorBrushLibrary.tsx:307`) and section titles use `--sidebar-text-secondary` (:206), while the Studio surfaces hardcode their backgrounds. In the light theme these resolve to `#1A1A2E` / `#5B5B74` (`app/src/index.css:286-290`), giving **1.62:1** and **1.60:1** on the right panel, and **1.06:1** / **2.45:1** on the modal — effectively invisible.
- **Minor — fallback hexes do not match the tokens they back**: `#eceff2` vs `#E0E0EE`, `#9aa5b1` vs `#7B7B94` (:206, :307). Inert today because the vars are defined, misleading tomorrow.
- Good: accent discipline holds — the new surface adds no `text-primary`/`bg-primary` usage; orange stays on selection only (`physicsPaintStudio.css:2113`), the import control is neutral-bordered, and red is reserved for error states. No new background colors were introduced.

### Pillar 4: Typography (3/4)

- **Distribution in the new surface:** one size — `fontSize: '10px'` appears 4× in `WatercolorBrushLibrary.tsx` (:202 section title, :308 button, :330 warning, :348 failure); weights `600` (×3) and `700` (×1). Plus the existing 10px/600 `.watercolor-brush-name` and 14px icon. That is inside the abstract thresholds (≤4 sizes, ≤2 weights) and matches the Studio's 10–11px label scale.
- **WARNING — hierarchy is thin**: the section title (10px/700 uppercase, secondary color) and the card name (10px/600, primary color) differ only by weight/case/color, and the error copy reuses the same 10px/600 as the warning and the card label. Nothing in the new surface reads as a heading at a glance.
- **Minor — semantics**: `BrushSection` renders `<section>` with a `<div>` title (:190-209) and no `aria-labelledby`, so the sections are unnamed regions for assistive tech. Fix: `<h3 id>` + `aria-labelledby`.

### Pillar 5: Spacing (3/4)

- **Values used in the new surface:** `gap: 6px` (×2), `gap: 8px` (×2), `gap: 4px`, `padding: 0 8px`, `height: 24px`, `borderRadius: 3px`. The 6/8px rhythm is consistent with the file's card rules (`padding: 6px`, `gap: 4px`, `physicsPaintStudio.css:2096-2109`) and the root grid's 8px gap.
- **WARNING — mixed radii and control heights inside one panel**: the import button is `height: 24px` / `radius 3px` (:300-303) while the same Brush tab's Settings button is `height: 30px` (`physicsPaintStudio.css:1882-1892`) and the cards use `radius 6px` (:2103). Three radii/heights for three controls stacked in one column.
- **WARNING — inline styles contradict the file's own styling convention**: the CSS block at `physicsPaintStudio.css:2092-2095` records that these card styles were "moved out of WatercolorBrushLibrary inline style objects (261018-l05 move 2)". Phase 63 adds 9 new inline style objects (`WatercolorBrushLibrary.tsx:192, 201, 212, 273, 282, 296, 329, 345, 395`), leaves `.watercolor-brush-section-title` as a class with no CSS rule, and duplicates the existing disabled convention (`.physics-paint-*-button:disabled { opacity: 0.45; cursor: not-allowed }`, `physicsPaintStudio.css:747-753`) inline at :163-167. Fix: move the section/import-row/warning rules into `physicsPaintStudio.css` and style the greyed state via `[data-unavailable="true"]`.
- **WARNING — placement deviation from the phase contract**: D-19 requires the one aggregate warning "inline in the brush library, next to the greyed card(s)". It renders between the import row and the Presets section (:325-341), while the greyed cards live in the Custom section at the bottom (:378-393) — several rows below, and off-screen in the 560px modal. Fix: render it at the top of the Custom section (one state, one line stays literal).

### Pillar 6: Experience Design (2/4)

- **WARNING — no success feedback after an import.** `onImportFile` (:247-268) handles only failure; the catalog push appends the card at the bottom of the grid and the selection is unchanged. In the floating modal that card is below the fold (8 presets + 3 textures = 6 rows ≈ 484px before the Custom section; the scroll viewport is ~490px). Nothing scrolls, highlights, selects, or announces. User impact: "I picked a file and nothing happened."
- **WARNING — failure state lifecycle**: `importFailed` is a module signal (`:82-96`) written only in `onImportFile` (`setImportFailure(false)` at :253, `true` at :262/:264). No project-open/close/new-project path resets it, so a failure banner from project A persists into project B.
- **WARNING — not announced**: the failure div (:342-355) has no `role`/`aria-live`; the sibling warning does (`role="status"`, :328). Also no dismiss control on either line.
- **Minor — in-flight state is only a dimmed button** (opacity 0.5, cursor default, :294-306) with the label unchanged for a wait bounded at 15 s (`physicPaintBridge.ts:170`); no "Importing…" text, spinner, or `aria-busy`.
- **Minor — degraded cards are unreachable by keyboard**: native `disabled` (:153) removes them from the tab order, and `title={tip.name}` (:154) never says why they are greyed.
- **Minor — the primary dropdown surfaces none of the new tips** (`brushMenuPresets` returns `BRUSH_PRESETS` always), so a user who imports must know to use "Open modal" to find the result; the pill's aria-label likewise degrades to "Choose a brush".
- Good: busy control is disabled (T-63-17) and the refusal path leaves the catalog untouched (pinned at `WatercolorBrushLibrary.test.ts:715-736`); unavailable tips are greyed, disabled and guarded in the click handler (`:155-157`); one aggregate warning state rather than per-tip lines (`:325-341`); every derived preview/footprint cache is keyed on `maskGeneration()` (`watercolorStrokeThumb.ts:56,178-180`, `aquarelleFootprint.ts`), so a replaced mask cannot serve stale pixels; cards expose `aria-pressed`, `aria-disabled`, and a `disabled` attribute; focus-visible is inherited from the global `button:focus-visible` rule (`physicsPaintStudio.css:158-162`), so the `all: unset` card reset does not kill the ring.

---

## Recommendation Count

- Priority fixes (BLOCKER/WARNING class): 9
- Minor recommendations: 6

---

## Files Audited

- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts`
- `app/src/components/physic-paint/view/watercolorStrokeThumb.ts`
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` (active-tip pill seam)
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx`
- `app/src/components/physic-paint/view/brushMenuPresets.ts`
- `app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx`
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` (Brush tab wrapper)
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` (`selectAquarelleTip`, catalog resolution)
- `app/src/components/physic-paint/physicsPaintStudio.css` (brush card, right panel, tab panel, focus, media query)
- `app/src/index.css` (theme token values)
- `app/src/lib/themeManager.ts`
- `app/src/stores/aquarelleBrushCatalog.ts`
- `app/src/lib/efxPaintBrushImport.ts`
- `app/src/lib/physicPaintBridge.ts` (brush import request/timeout)
- `app/src/types/physicPaint.ts` (brush import wire guard)
- `packages/efx-watercolor/src/brushes/importTip.ts`
- `packages/efx-watercolor/src/brushes/builtinTips.ts`
- `packages/efx-watercolor/src/playground/brushes.ts` (`BRUSH_PRESETS`)
- Phase artifacts: `63-01..63-09-SUMMARY.md`, `63-06-PLAN.md`, `63-CONTEXT.md`, `63-VALIDATION.md`, `.planning/ROADMAP.md` §Phase 63
