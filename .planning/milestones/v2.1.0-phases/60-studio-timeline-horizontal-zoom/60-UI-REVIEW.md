# Phase 60 — UI Review

**Audited:** 2026-11-09
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists for Phase 60)
**Screenshots:** not captured (no dev server on 3000/5173/8080 — code-only audit)
**Interaction captures:** off (workflow.ui_interaction_capture is false)

**Test verification:** `physicsPaintTimelineZoom.test.ts` + `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` re-run for this audit — 99/99 pass. The defects below are CSS/DOM-composition gaps that the node-environment matrix cannot see.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Specific labels, but the pill is visually anonymous and the Cmd/Ctrl+wheel path has no discoverable copy anywhere |
| 2. Visuals | 2/4 | **BLOCKER:** non-active track-row cells never receive the cell-width custom property, so they stay 16px at every zoom while their grid columns scale |
| 3. Color | 3/4 | Palette-correct and neutral (no accent misuse); the new modifier hardcodes a second copy of the navigation pill's colors |
| 4. Typography | 3/4 | Percent readout (400) is lighter than the secondary "Fit" label (600) at the same 11px — emphasis is inverted |
| 5. Spacing | 2/4 | Ruler label and tick mark are pinned at `left: 8px` (half of the 1× cell) and drift off the cell centre at every scale except 100% |
| 6. Experience Design | 3/4 | Strong state coverage (disabled ends, one-shot Fit, safe no-op ports, reset-on-open); zoom-level changes are not announced, and mandatory scroll-snap vs. programmatic anchored writes is unverified |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Non-active row cells do not scale with zoom** — every non-active track row and the Bg row paint 16px cells inside pitch-scaled grid columns (`PhysicsPaintTrackRow.tsx:1159` vs `physicsPaintStudio.css:7896`). At 400% each 72px frame slot contains a 16px cell, so cells stop reading as frames and 56px of every slot has no `data-roto-app-frame` hit target (`PhysicsPaintTrackRow.tsx:1126-1138`); at 25% the 16px cells overlap three to four columns and the lane clips them. This breaks the phase's central promise that every frame→pixel consumer agrees at every level. — Fix: set `'--timeline-cell-width': \`${framePitch - frameGap}px\`` on `.physics-paint-track-row-cells` in `PhysicsPaintTrackRow.tsx`, or (better, one source) hoist the property to the scroller in `PhysicsPaintWorkflowStrip.tsx` and delete the per-lane inline value at `:5822`; add a source pin so a row can never lose it.
2. **Ruler labels and tick marks drift off the frame cell at every zoom level except 100%** — `.physics-paint-ruler-label { left: 8px }` and `.physics-paint-ruler-tick::after { left: 8px }` (`physicsPaintStudio.css:5177-5194`) are the hardcoded half of the 1× 16px cell. At 400% the cell is 64px wide, so the number sits 24px left of its cell centre; at 25% it is 6px off. The tick span itself (flex basis) was converted, so the labels visibly desynchronise from the ruler grid. — Fix: `left: calc(var(--timeline-cell-width, 16px) / 2)` on both rules once the custom property is available on a shared ancestor, and assert the computed basis in the zoom matrix.
3. **The continuous zoom input and the new zoom level are invisible to some users** — no string in `PhysicsPaintTimelineZoomBar.tsx` or the strip tells the user that Cmd/Ctrl+wheel (or trackpad pinch) performs fine zoom; the only copy is "Zoom out", "Zoom in", "Fit the whole frame range", "Timeline zoom", "Zoom level". The percent `<span aria-label="Zoom level">{percent}%</span>` also has no live-region role, so button steps change the level silently for screen-reader users. — Fix: add a group `title`/tooltip such as "Timeline zoom — Cmd/Ctrl+scroll to zoom freely", drop the masking `aria-label` and give the percent `role="status"` (or include the value in each step button's label) so the new level is announced.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Passes**
- All control labels are specific and action-oriented: "Zoom out"/"Zoom in" (`PhysicsPaintTimelineZoomBar.tsx:28,41`), "Fit" with `title="Fit the whole frame range"` (`:51`), group label "Timeline zoom" (`:24`). No generic Submit/OK/Cancel vocabulary.
- The display-only percent is correctly non-interactive (no button role), matching D-02.

**WARNING — undiscoverable fine-zoom gesture.** Grep of the pill and strip finds no mention of Cmd/Ctrl+wheel or pinch (`PhysicsPaintTimelineZoomBar.tsx` entire file; `PhysicsPaintWorkflowStrip.tsx:1943-1945`). The feature's headline continuous input can only be found by trying a conventional shortcut. A title/tooltip on the group closes this at no layout cost.

**WARNING — anonymous control.** The pill has no visible "Timeline" text and is iconographically identical to the floating canvas zoom pill (`PhysicsPaintCanvasZoomBar.tsx:110-159`): same minus/percent/plus/Fit grammar in the same product. Only the ARIA group name distinguishes them; sighted users get placement as the sole cue. A short `title` on the group is the minimum fix.

### Pillar 2: Visuals (2/4)

**BLOCKER — track-row cells keep the 1× width.** `PhysicsPaintTrackRow.tsx:1159` scales `grid-template-columns` with `framePitch`, but each cell is the shared `.physics-paint-roto-cell` whose width is `var(--timeline-cell-width, 16px)` (`physicsPaintStudio.css:7896`). That custom property is set in exactly one place — the active lane's grid (`PhysicsPaintWorkflowStrip.tsx:5818-5822`) — and never on `.physics-paint-track-row-cells` (`:1155`) or the row root. Both non-active Paint rows and the Bg row (rendered through `PhysicsPaintTrackRow` at `PhysicsPaintWorkflowStrip.tsx:6479-6514`) therefore paint 16px cells in pitch-scaled columns:
  - 400%: 16px cell in a 72px slot — cells no longer read as frames, rails in the same row (correctly pitch-scaled) visibly overhang their cells, and 56px of each slot has no `data-roto-app-frame` hit target, so frame navigation from a non-active row only works on a narrow sliver.
  - 25%: 16px cell in a 4.5px slot — cells overlap three to four columns; `.physics-paint-track-row-lane { overflow: hidden }` (`:7171-7183`) clips the overflow at the lane end.
  This directly contradicts ZOOM-05's "non-active row cells/rails align with the active lane" and 60-04's deferred human-judgment row D5. It is not exercised by any node test because it is CSS inheritance, not source text.

**WARNING — mixed control vocabulary inside one pill.** The minus/plus buttons use `.physics-paint-nav-button` (24px wide, `border-radius: 4px`, `#f2f5f7`, disabled opacity 0.35 — `physicsPaintStudio.css:4179-4201`), while Fit uses the canvas-zoom text button (26px high, `border-radius: 999px`, `#b9c3ce`, disabled opacity 0.38 — `:1045-1096`). Two radii, two colors and two disabled treatments inside a single 32px pill read as two different control systems.

**Passes**
- Icon-only buttons carry both `aria-label` and `title` (`PhysicsPaintTimelineZoomBar.tsx:28-30, 41-43`).
- The pill is intentionally neutral (no accent) and sits in static chrome between playback and live status (`PhysicsPaintWorkflowStrip.tsx:1943-1946`), so it does not compete with the timeline as the focal surface.
- Vertical geometry genuinely does not scale: `TimelineMetrics` has exactly four horizontal fields (`physicsPaintTimelineZoom.ts:42-47`) and the CSS diff touches no height.

### Pillar 3: Color (3/4)

- No accent misuse: `#f59e0b` (the canvas-zoom pressed accent, `physicsPaintStudio.css:1075-1080`) never appears in the timeline pill because Fit deliberately sets no `aria-pressed` — correct for a one-shot action.
- No new palette color is introduced; the modifier is dark translucent chrome like the other header pills.
- **Minor:** `.physics-paint-pill--timeline-zoom` (`:4006-4009`) hardcodes `#575e66` / `#34383c`, a literal duplicate of `.physics-paint-pill--navigation` (`:3993-3996`). Two copies of the same intent drift independently; a shared rule or custom property would keep the header palette single-source.
- Contrast is adequate for enabled controls (`#b9c3ce` and `#dfe5ec` on `#34383c`); disabled 0.35 opacity is only used on the clamped ends, which is expected.

### Pillar 4: Typography (3/4)

- Sizes stay within the existing header scale: percent 11px (`physicsPaintStudio.css:1088-1096`), Fit 11px (`:1045-1058`), matching the 11px live status capsule (`:3918-3935`). No new 9px/13px/14px tier leaks in.
- **Minor:** at the same 11px, the percent readout inherits a 400 weight (plain span) while "Fit" inherits `font-weight: 600` and uppercase from the global `button` rule (`:174-186`). The primary number is visually lighter than a secondary action. Give the percent `font-weight: 600` (or a dedicated value style) so the zoom level is the loudest element in the pill.
- The nav buttons declare `font-size: 18px; font-weight: 700` (`:4179-4193`) but render only 14px lucide icons, so that declaration is dead style that will mislead the next text control added to this class.

### Pillar 5: Spacing (2/4)

**WARNING — ruler half-cell offset is still a 1× literal.** The ruler tick span now takes its flex basis inline from `rotoRulerStep * pitch` (`PhysicsPaintWorkflowStrip.tsx:6361-6362`, step resolved at `physicsPaintTimelineZoom.ts:92-99`), but the label and the `::after` mark inside that span are absolutely positioned at `left: 8px` (`physicsPaintStudio.css:5177-5184, 5186-5194`). Expected centre is `cellWidth / 2`: 2px at 25%, 8px at 100%, 16px at 200%, 32px at 400%. Actual is 8px at every level. 60-01's SUMMARY explicitly deferred this; in the built UI it is visible at every non-1× level, which is most of the feature's range.

**Minor — inconsistent inner sizing.** `gap: 4px`, `padding: 0 8px` (`:3979-3991`) are fine, but the 24px nav buttons and 26px Fit button inside a 32px pill give the controls unequal optical weight and two disabled opacities (0.35 vs 0.38).

### Pillar 6: Experience Design (3/4)

**Passes**
- End states are enforced at the source: `isAtMin`/`isAtMax` with an epsilon (`physicsPaintTimelineZoom.ts:225-226`), native `disabled` on the buttons (`PhysicsPaintTimelineZoomBar.tsx:30,43`).
- Fit is genuinely one-shot — no `aria-pressed`, no resize re-fit (`PhysicsPaintTimelineZoomBar.tsx:48-55`, store `fit()` at `physicsPaintTimelineZoom.ts:329-343`).
- Every write is guarded: epsilon no-op (`:241-248`), safe behavior with no registered scroll port (`:251-259`), reset to 1× on Studio open (`:346-348`), port unregistered on unmount (`PhysicsPaintWorkflowStrip.tsx:2777-2791`).
- Wheel branch ordering is correct and non-regressive: modifier branch first with `preventDefault`, then the untouched Shift/horizontal guards, then plain-wheel horizontal scroll (`PhysicsPaintWorkflowStrip.tsx:5525-5547`). The rAF coalescer accumulates from the queued target and cancels on cleanup (`:5512-5523, 5540-5547`).
- Anchoring math is pitch-derived end to end: playhead bar `6 + f×pitch + pitch/2 − 1` (`:1186-1192`), open/reveal positioning peek the live pitch with unchanged dep arrays (`:5073-5077, 5099-5103`), viewport frames divide by the live pitch (`:2739-2750`).

**WARNING — no accessible feedback for level changes.** The percent span is not a live region and its static `aria-label="Zoom level"` (`PhysicsPaintTimelineZoomBar.tsx:35`) can mask the numeric value depending on the AT. A user operating the step buttons by keyboard hears nothing after pressing them.

**WARNING (unverified interaction risk) — mandatory scroll-snap vs. programmatic anchored scroll.** The scroller is `scroll-snap-type: x mandatory` (`physicsPaintStudio.css:5111`) and every roto cell is `scroll-snap-align: start` (`:7914`). Phase 60 is the first caller that writes `scrollLeft` on every wheel frame (`physicsPaintTimelineZoom.ts:316`, `:267`). The browser may re-snap each anchored write to the nearest cell start, quantizing the anchor by up to half a pitch and potentially jittering during a continuous wheel gesture. 60-06 lists "scroll-snap interaction after an anchored zoom" as pending manual UAT; no code or test resolves it. Verify live; if it jitters, switch to `proximity` during a zoom gesture or compensate the target to a snap point.

**Minor — header density.** The header is `flex-wrap: nowrap` (`:3907-3916`) and the new ~148px pill takes space from the flexible live-status capsule, which truncates with ellipsis (`:3948-3956`). This degrades gracefully rather than breaking, but the status text gets measurably shorter whenever the Studio is narrow. Not verifiable without screenshots.

---

## Additional Issues (beyond the top 3)

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 4 | WARNING | Percent level changes are silent for AT; static `aria-label` can mask the value | `PhysicsPaintTimelineZoomBar.tsx:35` |
| 5 | WARNING | Mandatory scroll-snap may fight per-frame anchored writes; unverified | `physicsPaintStudio.css:5111, 7914`; `physicsPaintTimelineZoom.ts:267, 316` |
| 6 | Minor | Mixed button geometry/disabled treatment inside one pill | `physicsPaintStudio.css:1045-1096, 4179-4201` |
| 7 | Minor | Percent (400) visually quieter than Fit (600) at the same size | `physicsPaintStudio.css:1088-1096` vs `:174-186` |
| 8 | Minor | Duplicated hardcoded pill palette (navigation vs timeline-zoom) | `physicsPaintStudio.css:3993-4009` |
| 9 | Minor | Header live-status text shrinks by the pill's width (nowrap header) | `physicsPaintStudio.css:3907-3956` |

---

## Files Audited

- `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts`
- `app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (header pill seam, zoom mount/port, wheel path, ruler markup, active lane, rows, playhead, positioning effects)
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (props, cells grid, background row, motion block)
- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx`
- `app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx`
- `app/src/components/physic-paint/view/timelineRailDesign.ts`
- `app/src/components/physic-paint/physicsPaintStudio.css` (pill, zoom buttons, ruler, cells, header, scroll snap)
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx` (shipped precedent)
- `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts` (shipped precedent)
- Phase 60 planning artifacts: `60-CONTEXT.md`, `60-01..06-SUMMARY.md`

**Registry audit:** not applicable — no `components.json` (shadcn not initialized).
