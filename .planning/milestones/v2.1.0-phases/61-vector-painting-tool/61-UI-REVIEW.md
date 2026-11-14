# Phase 61 — UI Review

**Audited:** 2026-11-11 (re-audit after gap-closure plans 61-21 → 61-31)
**Baseline:** `61-UI-SPEC.md` (approved 2026-11-10) — audited section by section against the Copywriting Contract, Typography, Color, Spacing and Interaction Contract, plus the post-contract surfaces added by 61-21…61-31
**Screenshots:** not captured — no dev server reachable on ports 3000 / 5173 / 8080 (`curl` returned `000`); code-only audit per the orchestrator constraint (the project owner runs the server)
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

> This is a code-derived audit. No rendered pixels were inspected. Every visual claim below is traced to source (inline style, CSS rule, or SVG attribute). The plans' native UAT rows remain the only acceptance evidence for the rendered frame.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | All 21 declared strings are verbatim; the post-contract Curve row ships with no declared copy or explanatory hint, and one new refusal breaks the contract's `X rejected — …` grammar |
| 2. Visuals | 3/4 | All five prior visual warnings are closed (band law, solid dots, chrome on top of wireframe, rubber band); the vector construction layer at `z=41` paints over the serial badge / transform box / lift ribbon at `z=40`, contradicting §6 item 6 "unchanged, on top" |
| 3. Color | 4/4 | Canvas band, handle and anchor law now matches the declared palette exactly; chrome accent discipline holds; no undeclared color was introduced |
| 4. Typography | 3/4 | The readout span, 600-weight explanation strings and 400-only-italic-Mixed are correct; the Render and Curve segments render 10px/600 where the Typography table declares segmented-button text at 700 |
| 5. Spacing | 4/4 | Every new gap, padding and dimension is on the declared scale or a declared shipped exception; no off-scale value found |
| 6. Experience Design | 3/4 | Rubber band, picker disarm, refusal channel, empty states and gesture guards are all verified; the edit-state canvas gives no pre-press affordance across three different press outcomes |

**Overall: 20/24**

Finding classification: **no BLOCKERs** — no pillar scored 1 and no defect prevents completing a draw, edit, mode switch, save or reopen flow. Five WARNING-level defects are listed below (Copywriting ×2, Visuals ×1, Typography ×1, Experience ×1).

### Prior review closure (61-20 gap set)

| Prior WARNING (17/24 review) | Status | Evidence |
|---|---|---|
| Vector pen `title` omits the draw grammar | **CLOSED** | `PhysicsPaintToolRail.tsx:59-60` defines the contract string verbatim and `:184` applies it |
| Draw state has no live rubber-band spine | **CLOSED** | `VectorPathOverlay.tsx:395-420` projects the cursor station; `:1177-1189` draws `vector-path-draft-preview` dashed 1px before the committed draft; `:1149-1151` binds the move only in the draw state |
| Anchor-width readout unstyled | **CLOSED** | `ANCHOR_WIDTH_READOUT_STYLE` `PhysicsPaintStrokeSettingsDialog.tsx:319-324` is exactly 10px / 600 / secondary / `tabular-nums`; `BELOW_STYLE` `SliderStepper.tsx:158-164` is layout-only |
| Two 400-weight explanation strings | **CLOSED** | Caption `:306-312` and advanced note `:344-351` are 600; the only unset weight is the italic `Mixed` caption `:299-303` (declared exception) |
| Wireframe suppresses bounds box and serial badge | **CLOSED** | `ScriptStrokeOverlay.tsx:489-502` and `:503-540` render unconditionally; `wireframeOnly` no longer exists |
| Canvas alpha/stroke deviations | **CLOSED** | Envelope `fillOpacity 0.14/0.07`, edge `3.5/1.5`, no `strokeOpacity` (`VectorPathOverlay.tsx:462-477`); handles solid `#f59e0b` (`:680-690`) |
| Picker disabled rather than disarmed | **CLOSED** | Picker is `disabled={railDisabled}` only (`PhysicsPaintToolRail.tsx:195-215`); no wireframe term in its title |

---

## Top 3 Priority Fixes

1. **Vector construction chrome paints over the existing chrome the contract keeps on top** — in wireframe — the only state where both overlays render — `VectorPathOverlay` sits at `zIndex: 41` (`VectorPathOverlay.tsx:111,1140`) above `ScriptStrokeOverlay` at `zIndex: 40` (`ScriptStrokeOverlay.tsx:614,630`), so vector spines, anchors and envelopes cross hand-painted strokes' serial badges, bounds boxes, transform box and lift ribbon. UI-SPEC §6 item 6 requires the transform box / serial badge / lift ribbon to be "unchanged, on top" (`61-UI-SPEC.md:342`). Fix: split the z stack so the display chrome stays above the construction layer (e.g. paint the script overlay's chrome at `z=42` while its pointer surface remains gated by `interactive`, or seat the vector layer at `z=40` and keep its pointer ownership through `pointerEvents`).
2. **The Curve row ships with no declared copy and no explanation** — `BÉZIER` / `SPLINE` is the newest user-visible control and appears nowhere in the UI-SPEC (`grep` over `61-UI-SPEC.md` finds no Curve row); its only teaching surface does not exist (no `title`, no hint in `CURVE_MODE_OPTIONS`, `strokeSettingsModel.ts:208-211`; render `PhysicsPaintStrokeSettingsDialog.tsx:1701-1747`). A user cannot learn what the switch changes. Fix: add the row to the Copywriting Contract and give the switch a native hint in the pen-tooltip voice (e.g. "Curve — Bézier keeps your authored handles · Spline derives smooth tangents from the same anchors").
3. **The edit-state canvas gives no pre-press affordance** — the overlay's cursor is `crosshair` while drawing and `default` while editing (`VectorPathOverlay.tsx:1144`), and there is no hover hit-test. A press can do three different things — drag a handle, drag/promote an anchor, or insert an anchor on the spine — with no signal before the press. Fix: hit-test on pointer move in the edit state and set `grab` / `move` / `copy` cursors (plus a hover halo on the element that would be claimed), using the existing `hitTestVectorPath` call the press already makes.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified verbatim against the Copywriting Contract (`61-UI-SPEC.md:174-200`):
- Primary CTA tooltip — `PhysicsPaintToolRail.tsx:59-60` vs spec `:180`; `aria-label="Vector pen"` `:185`.
- Secondary CTA — `PATH_EDIT_LABEL = 'Edit path'` (`strokeSettingsModel.ts:885`) rendered as `aria-label` and the enabled `title` (`:1042-1043`, `:915-919`).
- Empty states — `No strokes on this frame.` `:1306`; `Select anchors on the canvas to set their width.` `:2006`; `Edit path — select one vector stroke` / `… a single vector stroke` (`strokeSettingsModel.ts:888,891`).
- Error states — vector rejection `PhysicsPaintStudio.tsx:376`; Script-off rejection `aquarelleVectorPathCommit.ts:13`; Draft recompute refusal `scriptStrokeEdition.ts:193`.
- Disabled reasons — paint row `PhysicsPaintToolRail.tsx:147-150`, Select `:223-224`, Dry `:271-274`, Draft `:1139`, Anchor width no-edit `strokeSettingsModel.ts:1006-1007`; every one matches spec `:190-194`.
- Render row `Render` / `Watercolor` / `Ribbon` (`strokeSettingsModel.ts:166-169`); `Anchor width` + `→ {n} px` (`:1952-2011`); `Advanced — wet globals` + note (`:116-117`); Wireframe title `PhysicsPaintToolRail.tsx:259`; `Simple ribbon` + hint (`packages/efx-watercolor/src/playground/brushes.ts:355-356`).

**WARNING — the Curve row is undeclared and unexplained.** The Paint tab now mounts a second segmented row — label `Curve`, options `Bézier` / `Spline`, red italic `Mixed` on disagreement (`PhysicsPaintStrokeSettingsDialog.tsx:1701-1747`; labels `strokeSettingsModel.ts:208-211`). None of this copy exists in the contract, and the row carries no `title`, caption or hint. Since switching changes the drawn shape of every selected vector stroke, this is the one new control whose consequence is stated nowhere in the UI.

**WARNING — a new refusal breaks the declared grammar.** `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE = 'Anchor width not applied — the path edit is no longer open on this stroke.'` (`strokeSettingsModel.ts:1016`) is published through the status capsule (`PhysicsPaintStudio.tsx:11708-11712`). The contract declares the refusal grammar `X rejected — <problem>. Nothing changed.` and uses it for the vector rejection (`61-UI-SPEC.md:185`). This message says "not applied" instead of "rejected" and never states that nothing changed.

**Minor (undeclared, low severity):** `DRAFT_SETTLE_BUSY_MESSAGE = 'Another edit is settling — try again.'` (`scriptStrokeEdition.ts:202`) — an actionable but undeclared, generic "try again" string. `No strokes match this filter.` (`:1310`) is likewise undeclared and pre-existing.

### Pillar 2: Visuals (3/4)

Matches:
- Draw order within the vector overlay is envelope → spine → rungs → anchors → selection ring → handles (`VectorPathOverlay.tsx:462-695`), matching §6 items 1-5 in order.
- Marker extents are zoom-fixed: square 9×9 (`ANCHOR_BODY_PX`, `vectorPathHandles.ts:51`), circle r 3.5 (`:57`), handle r 3.5 (`:60`), divided by `scale` (`VectorPathOverlay.tsx:455-457`) with `vectorEffect="non-scaling-stroke"` on every stroke.
- Under Spline the whole handle block returns nothing and every anchor renders as the auto circle (`ownsHandles = !spline && anchor.kind === 'bezier'` `:450`; handles `:657-695`), so no square or dot implies a control the mode does not own.
- Hand-painted wireframe: shipped band plus centreline, with bounds box and serial badge now drawn unconditionally (`ScriptStrokeOverlay.tsx:437-540`).
- The rail separator (21×1, `margin: 1px 0`, `#5a5e63`) matches the derived geometry (`physicsPaintStudio.css:701-707`; spec `:166`); rail order is paint row → separator → pen, and the wireframe latch sits between Motion boundaries and Dry (`PhysicsPaintToolRail.tsx:134-279`).
- Every icon-only control carries both `aria-label` and `title` (rail, header, list-row trash).

**WARNING — the construction layer is above the chrome the contract keeps on top.** `VECTOR_PATH_Z_INDEX = 41` with the comment "Immediately above the stroke overlay (40), below the brush cursor (50)" (`VectorPathOverlay.tsx:110-111`); the script overlay mounts at `zIndex: 40` (`ScriptStrokeOverlay.tsx:614,630`). Under wireframe both overlays draw at once, so a vector stroke's translucent envelope, two-pass spine and markers sit over the serial badges (white chip at `fillOpacity 0.82`), the dashed bounds boxes and the transform box of hand-painted strokes. The contract's wireframe law lists "Existing transform box / serial badge / lift ribbon — unchanged, on top" as item 6 (`61-UI-SPEC.md:342`). The badge text keeps its white halo and stays legible, so this is not a readability blocker — but the declared stack order is inverted.

**Minor:** the 61-22 selected-anchor ring (`VectorPathOverlay.tsx:617-653`) is a seventh canvas element not present in the declared draw order; it is visually coherent (accent `#38bdf8`, 1.5px, mirrors the marker's shape) but the contract was not amended. The 61-22 list-view Anchor width mount (`PhysicsPaintStrokeSettingsDialog.tsx:1422-1432`) is appended inside the row list with only the list's 6px gap and no divider, so it reads as another list row rather than a separate control.

### Pillar 3: Color (4/4)

No deviations found. Evidence:
- Envelope law: `fillOpacity={selected ? 0.14 : 0.07}`, `stroke={strokeColour}`, `strokeWidth={selected ? 3.5 : 1.5}`, non-scaling, no `strokeOpacity` (`VectorPathOverlay.tsx:462-477`); identical law on the hand-painted band (`ScriptStrokeOverlay.tsx:437-449`). This is the exact declared band fill/edge (`61-UI-SPEC.md:152,168`).
- Rungs: `#111111` 1.5 @0.55 under `#ffffff` 1 @0.9 (`VectorPathOverlay.tsx:562-583`) — the declared derived value (`spec :167`).
- Anchors: Bézier square `#f59e0b`, auto circle `#38bdf8`, both 1px `#111111` under wireframe (`:590-615`); handles `#f59e0b` solid dots joined by a 1px @0.6 connector (`:670-690`) — §6 items 4-5 exactly.
- Chrome: rail active amber `#f59e0b` / border `#fbbf24` / icon `#241a05` (`physicsPaintStudio.css:616-626`); header on-state `#2d5be3` (`:6272-6276`); sheet `rgba(28,30,34,0.9)` (`PhysicsPaintStrokeSettingsDialog.tsx:261`); destructive `#ef4444` confined to Mixed, trash and the lift ribbon.
- Accent discipline: blue only on pressed header buttons, active segmented options and the stepper fill; rail amber only on the one active rail button; `#38bdf8` only on selected structure and auto anchors; `#f59e0b` only on user-owned control points. No new accent use was added to any dialog control by 61-21…61-31.
- 60/30/10 holds: dominant sheet/rail/canvas surfaces, secondary control faces, accent only on active state.

Minor observation (no action required): outside wireframe the anchor markers' 1px stroke is `#ffffff` (`markerStroke = wireframe ? OUTLINE_DARK : OUTLINE_LIGHT`, `VectorPathOverlay.tsx` render scope), which the contract only spells out as `#111111` for the wireframe law; the white two-pass outline is the shipped idiom and reads correctly.

### Pillar 4: Typography (3/4)

Matches:
- `ANCHOR_WIDTH_READOUT_STYLE` (`PhysicsPaintStrokeSettingsDialog.tsx:319-324`) is exactly `10px / 600 / var(--sidebar-text-secondary) / fontVariantNumeric: 'tabular-nums'`, matching the `BrushResponsePanel` reference (`view/BrushResponsePanel.tsx:61-73`) and spec `:125,196`. `BELOW_STYLE` (`SliderStepper.tsx:158-164`) overrides only layout, so the span's type survives.
- `ANCHOR_WIDTH_CAPTION_STYLE` (`:306-312`) and `ADVANCED_WET_NOTE_STYLE` (`:344-351`) carry `fontWeight: 600`; the advanced note alone sets `lineHeight: 1.5`.
- The only unset weight is `MIXED_CAPTION_STYLE` (`:299-303`, italic, `#ef4444`) — the declared 400 exception (`spec :120`).
- The Render and Curve rows use the declared `SEGMENT_GROUP_STYLE` + `SEGMENT_STYLE` / `SEGMENT_ACTIVE_STYLE` constants (`:353-374`, `:1676,1686,1723,1733`), keep the global uppercase rule with no opt-out (`spec :126`), and the filter row alone keeps its sentence-case opt-out (`FILTER_SEGMENT_STYLE` `:381-390`).

**WARNING — segmented rows render 600 where the table declares 700.** The Typography table's weight row says "700 — Segmented-button text and the pinned tab row only" (`61-UI-SPEC.md:116`). `SEGMENT_STYLE` (`PhysicsPaintStrokeSettingsDialog.tsx:358-369`) sets no `font-weight`, and the global `button` rule is `font-weight: 600` (`physicsPaintStudio.css:174-190`), so BOTH the 61-12 `Render` row and the 61-31 `Curve` row render 10px/600. The spec's own parenthetical ("SEGMENT_STYLE inherits the global button weight rules") contradicts its 700 line — the implementation follows the constants but misses the declared weight. Either set `fontWeight: 700` on the segments or amend the table to 600.

### Pillar 5: Spacing (4/4)

No issues found. Evidence:
- New vertical rhythm uses only declared values: `SCROLL_CONTENT_STYLE` gap 10px / padding `10px 12px 0` (`PhysicsPaintStrokeSettingsDialog.tsx:271-276`; 10px exception), `SECTION_STYLE` gap 15px (`:279-284`; 15px exception), `SEGMENT_LABEL_ROW_STYLE` gap 6px / marginBottom 4px (`:292-297`; 6px exception + xs), `ANCHOR_WIDTH_CAPTION_STYLE` marginTop 4px (`:308`), `ADVANCED_ROW_STYLE` 24px row / 4px gap / zero padding (`:331-341`; declared component dimension), `ADVANCED_WET_NOTE_STYLE` marginTop 4px (`:346`), `SEGMENT_GROUP_STYLE` gap 4px (`:353-356`).
- Rail: column `gap: 7px`, padding `10px` (`physicsPaintStudio.css:667-677`); separator 21×1 with `margin: 1px 0` declared as component geometry (`:701-707`; spec `:98`); the footer group's `marginTop: 8px` (`PhysicsPaintToolRail.tsx:316`) is sm.
- Component dimensions match their declared sources: rail buttons 35×35 (`:694-697`), unscoped icon buttons 32×32 (`:679-690`), header buttons 22×22 (`:6219-6237`), segmented height 20px (`:358-369`), canvas anchors 9 / radius 3.5 / hit pad 8.
- No arbitrary `[..px]` values exist (the project styles with CSS custom properties and inline style objects); no off-scale gap was introduced by 61-21…61-31.

### Pillar 6: Experience Design (3/4)

Matches:
- Draw law is complete: click places an auto anchor, Alt+click a corner (`VectorPathOverlay.tsx:917-926`), first-anchor finish (`:899-911`), duplicate-adjacency refusal (`:913-916`), double-click finish (`:929-933`), Enter finishes / Escape cancels (`:288-294`), Delete/Backspace removes selected anchors (`:303-336`). A zero/one-anchor finish drops the draft without committing (`:251-267`).
- Live rubber band in the draw state (`:395-420`, `:1149-1151`, `:1177-1189`), display-only — a move never places an anchor (D-06).
- Keyboard: bare `V` latches the pen (`physicsPaintStudioKeyboard.ts:383-390`); the window dispatcher stands down for text-entry targets (`VectorPathOverlay.tsx:356`), so Enter/Delete in a dialog field are untouched.
- Refusal and busy channels: anchor-width commit publishes a reason through the shared capsule (`PhysicsPaintStudio.tsx:11708-11712`); Draft settle refusals publish `DRAFT_SETTLE_BUSY_MESSAGE` / `WIREFRAME_SETTLE_REFUSED_MESSAGE` (`:5418,5439-5441`); the vector rejection publishes to both the capsule and `lastError` (`:10316-10318`). The capsule carries `aria-live="polite"` (`PhysicsPaintWorkflowStrip.tsx:1227`).
- Disabled coverage is complete and reasoned: spline-pointer opacity 0.4 with the reason in `title` (`PhysicsPaintStrokeSettingsDialog.tsx:1044-1047`; CSS `:6245-6248`), Draft forced on and disabled under wireframe with the exact copy (`:1132-1146`), rail paint row / Select / Dry under wireframe (`PhysicsPaintToolRail.tsx:147-154,223-224,271-274`).
- Empty/partial: list empty states, Anchor width empty caption, red italic Mixed on Render/Curve/width/wet globals, active-option press writes nothing (`:1687-1691,1734-1738`), the Curve row writes only vector ids so hand-painted strokes in a mixed selection are never touched (`strokeSettingsModel.ts:222-260`).
- Gesture robustness (61-28): a press always ends the previous gesture and releases its pointer (`VectorPathOverlay.tsx:966-979`); continue/finish refuse a drag whose target is no longer the open edit (`:1068,1107`); the edit-lifetime effect clears and releases when the edit closes or retargets (`:787-804`).
- Undo granularity: one snapshot pair per path, per edit gesture and per mode switch; a curve-mode write never bumps the seed salt (61-30/61-31 summaries; `beginAquarelleCurveModeEdit`).

**WARNING — no pre-press affordance on the canvas.** In the edit state the overlay's cursor is `default` and its only interactive feedback happens after `pointerdown` (`VectorPathOverlay.tsx:1144,1146`). The same press can start a handle drag, promote-and-drag an anchor, or insert an anchor on the spine (`hitTestVectorPath` priority at `:987-1056`), yet nothing under the pointer changes to say which. On a dense path (handles near anchors, anchors near the spine) the user commits a gesture before learning what it was. The contract's hit-priority law exists (`spec :343`) but no hover law does; the interaction surface is the phase's headline and this is its main remaining feedback gap.

**Unverified live backstops (recorded, not scored):** the native UAT rows 61-21 A/B (rubber band), 61-22 A-C (list Anchor width, selection ring), 61-26/61-27 (Shift+A refusal, refusal copy), 61-28 (drag lifetime) and 61-31 A-F (Curve row shape change, one-undo round trip, authored-handle restoration, Mixed conversion, hand-painted absence, spline insert, save/reopen parity) were not exercised — they require the real engine frame and the Studio window.

---

## Minor Recommendations

1. Align `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` with the declared refusal grammar (`Anchor width rejected — the path edit is no longer open on this stroke. Nothing changed.`) or record the new string in the Copywriting Contract.
2. Record `DRAFT_SETTLE_BUSY_MESSAGE` in the contract, and prefer naming the action ("Another edit is still settling — wait for it, then set the width again") over the generic "try again".
3. Resolve the Typography contradiction: set `fontWeight: 700` on `SEGMENT_STYLE`, or amend the table's segmented-button row to 600 (which is what the shipped global `button` rule and `SEGMENT_STYLE` currently produce).
4. Amend `61-UI-SPEC.md` §6 to add the elements shipped after the contract: the 61-21 rubber band (now the second item in the draw order), the 61-22 selected-anchor ring (between anchors and handles), and the 61-22 list-view Anchor width mount.
5. Consider giving the list-view Anchor width slider a separating rule or its own section header; today it inherits only the list's 6px gap and visually joins the row stack while it is inert until Edit path opens.
6. Exercise the native UAT rows listed above when the Studio is next open; this audit could not capture screenshots or interaction states, and the Z-order finding in particular deserves one live frame with a mixed vector + hand-painted sheet under wireframe.

---

## Files Audited

- `.planning/phases/61-vector-painting-tool/61-UI-SPEC.md` (design contract / baseline)
- `.planning/phases/61-vector-painting-tool/61-CONTEXT.md`
- `.planning/phases/61-vector-painting-tool/61-UI-REVIEW.md` (superseded 17/24 review — continuity)
- `.planning/phases/61-vector-painting-tool/61-21-SUMMARY.md` through `61-31-SUMMARY.md`
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`
- `app/src/components/physic-paint/view/strokeSettingsModel.ts`
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts`
- `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts`
- `app/src/components/physic-paint/view/vectorPathHandles.ts`
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (status capsule)
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx`
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (record seams, refusal publish, settle messages)
- `app/src/components/shared/SliderStepper.tsx`
- `app/src/components/physic-paint/physicsPaintStudio.css`
- `app/src/index.css`
- `packages/efx-watercolor/src/playground/brushes.ts`

Registry Safety: not applicable — no `components.json` exists (shadcn is not initialized) and `61-UI-SPEC.md:358-360` declares no registry blocks; the audit was skipped per the gate.
