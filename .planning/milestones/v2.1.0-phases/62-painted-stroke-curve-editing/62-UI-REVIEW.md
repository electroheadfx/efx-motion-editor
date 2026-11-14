# Phase 62 — UI Review

**Audited:** 2026-11-14
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists for Phase 62)
**Screenshots:** Not captured — no dev server answered on localhost:3000/5173/8080 and the Tauri app is human-run live UAT. Code-only audit; visual conclusions are source-derived.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

> **Supersedes the 2026-11-14 16:09 pass (18/24).** This pass covers UI that landed after it: `e6ba5b8b9` (double-click entry + select-then-move), `84f544d60` (vector provenance + read-only Vertex colour), `a07baf51b` (settling-teardown capture fix). The three fixes the previous pass prioritized were re-checked: none were implemented.
>
> **Severity:** BLOCKER = pillar score 1 or a defect that breaks user task completion. No pillar scored 1 and no single defect strictly prevents task completion, so this pass records **0 BLOCKER / 13 WARNING**. That is not a clean bill — priority fix 1 (entry feedback) and priority fix 2 (Mixed contradiction) are must-fix before shipping.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Pressing "Edit path" can surface a message about Draft; new filter categories are hyphenated internal jargon ("Brush-Vector") with no legend; "Eraser-Vector" is unreachable dead copy |
| 2. Visuals | 2/4 | In the Mixed state the Vertex colour row shows one swatch + hex AND a red "Mixed" caption, contradicting the Curve/Corner rows; header icon sizes now mix 12/15/16px |
| 3. Color | 3/4 | "Mixed" stays destructive red on a third row; the new swatch border hardcodes rgba instead of the `--sidebar-border-unselected` token the same file uses |
| 4. Typography | 3/4 | 9-10px readouts dominate the panel; the new hex readout is 10px/600 — consistent but below comfortable minimum |
| 5. Spacing | 3/4 | New block reuses the established 6px/4px/18px pattern; spacing remains inline pixel literals with no scale |
| 6. Experience Design | 2/4 | Curve entry still has no pending state across `armDraftBase()`, three paths fail silently, and none of the new gestures appear in shortcuts help |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Curve entry gives no pending or failure signal** — pressing "Edit path" (or double-clicking a stroke) awaits a durable-base recovery with the button still enabled and unpressed; a fit-null, a missing entrance host, or a rejected promise produces literally nothing on screen, so users cannot tell "working" from "broken". (WARNING, must fix) — Fix: expose an `entryPending` signal set before `await armDraftBase()` and cleared in `finally`, and render the Edit path button disabled/`aria-busy` while set (`PhysicsPaintStudio.tsx:10317-10336`, `PhysicsPaintStrokeSettingsDialog.tsx:1028-1065`); replace the reused Draft refusal with entry-specific copy — the user pressed Edit path, not Draft (`PhysicsPaintStudio.tsx:380,10327`); give `beginPaintedCurveSession` null and the missing-entrance-host branch an explicit refusal line instead of a bare `return false` (`PhysicsPaintStudio.tsx:10332`, `AquarelleStrokeOverlay.tsx:52-59`, `vectorPathLatches.ts:131`).

2. **The new Vertex colour row contradicts itself in the Mixed state** — with a multi-vertex selection of differing colours the row renders the first anchor's colour as an 18×18 swatch plus a monospace hex readout, next to a red "Mixed" caption; the Curve and Corner rows in the same dialog correctly render no active value when mixed. Users see a colour that is then denied. (WARNING, must fix) — Fix: when `anchorColorReading.mixed`, render no swatch/hex (or a neutral multi-colour chip) and only the Mixed caption; keep swatch+hex for agreed values (`PhysicsPaintStrokeSettingsDialog.tsx:1482-1508` vs `1521-1526`, `1564-1595`).

3. **Curve editing is undiscoverable and the new category copy is opaque** — shortcuts help (`physicsPaintShortcutsHelp.ts`) lists Playback/Roto/Paint/Move-Edit/Editing/Canvas groups but has zero entries for Edit path, curve entry, double-click entry, Alt+click corner toggle or select-then-move; the stroke list and filter now say "Brush-Vector", "Water-Vector", "Pen-Vector" with no legend distinguishing a drawn "Vector" from a converted one; "Eraser-Vector" is declared but can never render; the double-click entrance has no hint anywhere. (WARNING, must fix) — Fix: add the five curve gestures to the help catalog; add a `title` legend for the `<Tool>-Vector` categories (e.g. "Brush-Vector — a brush stroke converted to an editable path") and consider "Vector (converted Brush)"; remove `'lift-vector'` or wire it, since `ScriptStrokeFilterValue` excludes it, `strokeRowFilterValue` maps lift to its tool, and `STROKE_FILTER_ORDER` omits it (`scriptStrokeEdition.ts:64`, `strokeSettingsModel.ts:326-330,338-353,414`); surface the double-click affordance via cursor or hint.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

- **[WARNING] Wrong-noun refusal on the primary new entrance.** `enterPaintedCurve` reuses `DRAFT_ARM_REFUSAL_MESSAGE` — "Could not prepare this frame for Draft — the watercolor base could not be recovered." (`PhysicsPaintStudio.tsx:380`, republished at `10327`). The user pressed "Edit path"; nothing named Draft was touched. Previous audit's priority fix #1, unchanged.
- **[WARNING] Silent failure copy gaps.** `beginPaintedCurveSession(stroke)` returning null falls through a bare `return false` (`PhysicsPaintStudio.tsx:10332`) with no capsule. `requestAquarellePathEdit` returns `false` with no signal when eligibility or the entrance host is missing (`AquarelleStrokeOverlay.tsx:52-59`). `requestPaintedCurveEntrance` catches a rejected entrance and only `console.error`s it (`vectorPathLatches.ts:131`). Previous audit's priority fix #2, unchanged.
- **[WARNING] Hyphenated internal jargon as user-facing categories.** `STROKE_VECTOR_FILTER_LABELS` renders "Brush-Vector", "Water-Vector", "Pen-Vector", "Eraser-Vector" (`strokeSettingsModel.ts:324-331`), surfaced in the filter `<select>` (`PhysicsPaintStrokeSettingsDialog.tsx:1170-1196`), in the row type at 11px/600 (`1210-1222`), and read aloud in the row aria-label (`1212-1213`). Nothing explains that "Vector" means drawn and "Brush-Vector" means a converted brush stroke.
- **[WARNING] Dead label.** "Eraser-Vector" is declared (`strokeSettingsModel.ts:330`) but `ScriptStrokeFilterValue` excludes `'lift-vector'` (`scriptStrokeEdition.ts:64`), `strokeRowFilterValue` maps lift to its tool (`strokeSettingsModel.ts:350-351`), and `STROKE_FILTER_ORDER` omits it (`414`) — it can never appear in either the filter or a row.
- **[INFO] Stale contract comment.** `AquarelleStrokeOverlay.tsx:35` still calls the double-click entry "a VECTOR-ONLY gate"; the file now routes painted strokes into the painted curve session (`52-59`).
- **Positive:** empty copy is specific ("No strokes on this frame." / "No strokes match this filter.", `PhysicsPaintStrokeSettingsDialog.tsx:1201-1207`), and row aria-labels carry serial, tip and stack position.

### Pillar 2: Visuals (2/4)

- **[WARNING] Mixed-state contradiction in the new row.** When `anchorColorReading.mixed` is true the block still renders `ANCHOR_COLOR_SWATCH_STYLE` coloured with the first anchor's colour and `anchorColorReading.color.toUpperCase()` beside the red Mixed caption (`PhysicsPaintStrokeSettingsDialog.tsx:1482-1508`). The neighbouring Curve row computes `active = !curveModeReading.mixed && …` (`1521-1541`) and the Corner row does the same (`1564-1595`), so the dialog demonstrates one Mixed grammar and breaks it one row above.
- **[WARNING] Three icon scales in one header strip.** The new action toggles (Edit path / Preview stroke size / cache eye) are 16px inside 22×22 buttons (`1064`, `1080`, `1101-1102`), while the header glyph is 15px (`937`), header delete and close stay 12px (`958`, `973`), and the row trash is 15px (`1303`). Close and Delete now read as underweight glyphs beside the new actions.
- **[WARNING] No visual affordance for select-then-move.** The overlay cursor is a uniform `crosshair` for the whole interactive surface (`VectorPathOverlay.tsx:1458`); handle dots start dragging on the first press (`1271-1291`) while vertices require a press that does not change membership (`1323-1326`). Nothing on screen distinguishes "this press will select" from "this press will drag".
- **[WARNING] Decorative overlay SVG is not hidden from assistive tech.** `VectorPathOverlay.tsx:1471` exposes the pure display chrome (`pointerEvents: 'none'`) as an unnamed graphic; no `aria-hidden` exists anywhere in the file. Previous audit's minor recommendation, unchanged.
- **Positive:** selection chrome (glow/halo/ring), ghost spine and anchor/handle rendering reuse the Phase 61 surface; every icon-only header button carries both `aria-label` and `title`.

### Pillar 3: Color (3/4)

- **[WARNING] Red is doing double duty.** `MIXED_CAPTION_STYLE` is `#ef4444` at 10px italic (`PhysicsPaintStrokeSettingsDialog.tsx:270-275`) — the same hue the app uses for errors and refusals — and the new Vertex colour row extends the Mixed caption to a third control (`1484-1492`). Mixed values are neutral state, not an error.
- **[WARNING] Token bypass in the new swatch.** `ANCHOR_COLOR_SWATCH_STYLE` hardcodes `rgba(159,165,174,0.55)` (`304-310`) while `SEGMENT_STYLE` uses `var(--sidebar-border-unselected, rgba(159,165,174,0.55))` (`324-334`). The swatch will not follow a theme override of that variable.
- **Positive:** data colours (stroke colour on the list dot, anchor colour on the new swatch) are correctly surfaced raw; the Phase 61 accent set (cyan spine `#38bdf8`, amber handles `#f59e0b`, orange selection `#f97316`, slate ghost at 0.45) is unchanged and no new accent was introduced.

### Pillar 4: Typography (3/4)

- **[WARNING] Readouts are 9-10px.** The panel's inline type set is 9/10/11/13px; 10px is used 17 times (`PhysicsPaintStrokeSettingsDialog.tsx:257-431`, plus the new `ANCHOR_COLOR_READOUT_STYLE` at `312-317`). The hex readout is monospace 10px/600 — the right family, but at the small end for a value users compare at a glance.
- **[INFO] Long category tokens at 11px in a narrow row.** "Water-Vector"/"Brush-Vector" render at 11px/600 inside the list row's `10px minmax(0,1fr)` grid beside position and tip meta (`1210-1240`, list CSS). Truncation is plausible but unverified without screenshots.
- **Positive:** the new row follows the established pairing exactly — `PAINT_ROW_LABEL_STYLE` 11px/600 label plus a 10px/600 tabular/monospace readout — and four distinct sizes is at, not over, the audit threshold.

### Pillar 5: Spacing (3/4)

- **[INFO] Inline pixel literals, no scale.** Spacing remains inline style objects (`SCROLL_CONTENT_STYLE` gap 10 / pad `10px 12px 0`, `SECTION_STYLE` gap 15, `SEGMENT_LABEL_ROW_STYLE` gap 6 / marginBottom 4). The new block adds `ANCHOR_COLOR_ROW_STYLE` gap 6 and an 18×18 swatch (`298-310`) — consistent with neighbours, but another untokenized value in a file with no spacing scale.
- **Positive:** the Vertex colour block slots into the Curve tab between Vertex size and Curve with the same segment spacing; header buttons stay 22×22; no arbitrary one-off spacing was introduced beyond the established pattern.

### Pillar 6: Experience Design (2/4)

- **[WARNING] No pending state on entry.** `enterPaintedCurve` awaits `armDraftBase()` — a durable-base recovery that can take seconds on a heavy frame — while `pathEditGate.pressed` stays false and the button stays enabled (`PhysicsPaintStudio.tsx:10317-10336`; `PhysicsPaintStrokeSettingsDialog.tsx:1028-1065`). The double-click entrance shares the same await. Previous audit's priority fix #3, unchanged.
- **[WARNING] Three silent fail-closed paths** (fit null, missing entrance host, rejected entrance promise) — described under Pillar 1. None produces user-visible feedback.
- **[WARNING] Zero discoverability for the new gestures.** `physicsPaintShortcutsHelp.ts` contains no mention of path, curve, anchor, vertex or double-click editing; the select surface cursor is `default` (`ScriptStrokeOverlay.tsx:731`) and the path overlay's is `crosshair` (`VectorPathOverlay.tsx:1458`); nothing hints that a stroke is double-clickable.
- **[WARNING] Inconsistent drag grammar inside one overlay.** Handle dots begin a drag on the first press (`VectorPathOverlay.tsx:1271-1291`); vertices require a second press (`1323-1326`). UAT row B records select-then-move as intentional, so the defect is the lack of communication, not the behaviour.
- **[INFO] Vertex-scoped controls have no empty state.** Vertex size and the new Vertex colour block unmount entirely when no vertex is selected; only the Corner block carries a "Select vertices on the canvas…" caption (`PhysicsPaintStrokeSettingsDialog.tsx:1596-1605`). A user looking for vertex colour with no selection sees nothing and gets no signpost.
- **Positive:** the double-click entrance is correctly bound only on the interactive select surface (`ScriptStrokeOverlay.tsx:701-737`), so it cannot hijack painting; disabled Edit path states its reason in `title`; the bracket restores pre-entry wireframe/Draft, and in-flight undo cancellation is sound per the 62-04 outcomes.

---

## Minor Recommendations

1. Replace the swatch's hardcoded `rgba(159,165,174,0.55)` with `var(--sidebar-border-unselected, rgba(159,165,174,0.55))`, matching `SEGMENT_STYLE` (`PhysicsPaintStrokeSettingsDialog.tsx:304-334`).
2. Give "Mixed" a neutral/muted treatment (or reserve `#ef4444` for errors and refusals) across all three rows.
3. Add `aria-hidden="true"` to the overlay `<svg>` (`VectorPathOverlay.tsx:1471`).
4. Update the stale "VECTOR-ONLY gate" comment at `AquarelleStrokeOverlay.tsx:35`.
5. Raise the hex readout (and ideally all 10px readouts) to 11px; keep monospace.
6. Differentiate selected-anchor hover/press cursor (`grab`/`grabbing`) or allow a first-press drag on an already-selected vertex, so the two-press rule is legible.
7. Give Vertex colour (and Vertex size) a "Select a vertex on the canvas" caption when no anchor is selected, mirroring the Corner block's count-0 caption.

---

## Registry Safety

Not applicable: no `components.json` in the repository root or `app/`, so shadcn is not initialized and no third-party registry blocks are installed. Registry audit skipped.

---

## Files Audited

- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`
- `app/src/components/physic-paint/view/strokeSettingsModel.ts`
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts`
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`
- `app/src/components/physic-paint/view/vectorPathLatches.ts`
- `app/src/components/physic-paint/view/vectorPathCurveBracket.ts`
- `app/src/components/physic-paint/view/vectorPathHandles.ts`
- `app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts`
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx`
- `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx`
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (curve seams: `:380`, `:10300-10345`, `:11525-11535`)
- `app/src/components/physic-paint/physicsPaintStudio.css`
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts`
- `packages/efx-watercolor/src/payload/codec.ts`, `toStudioStroke.ts`
- Planning: `62-CONTEXT.md`, `62-UAT.md`, `62-0x-PLAN.md`, `62-0x-SUMMARY.md`, prior `62-UI-REVIEW.md`

Screenshot storage safety: `.planning/ui-reviews/.gitignore` verified with `*.png *.webp *.jpg *.jpeg *.gif *.bmp *.tiff` and `interaction/` before any capture was attempted.
