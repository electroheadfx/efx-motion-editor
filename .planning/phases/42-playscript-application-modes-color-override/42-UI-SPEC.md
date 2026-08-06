---
phase: 42
slug: playscript-application-modes-color-override
status: revised
shadcn_initialized: false
preset: none
created: 2026-08-05
reviewed_at: 2026-08-06
revision: 2026-08-06 (2) — final visual correction: compact independent DARK modal overlay (Image #153 approved target; Image #154 light full-canvas implementation REJECTED); Timing-left / Color-over-Motion-right main grid; no-scroll compact fit
revision_sources:
  - SPECS/playscript-proposal/playscript-panel.html
  - SPECS/playscript-proposal/ui-play-script-specs.md
  - 42-UI-REVISION-DELTA.md
  - Image #153 (approved target visual) / Image #154 (rejected implementation)
---

# Phase 42 — UI Design Contract (revised 2026-08-06, final visual direction)

> Visual and interaction contract for the Play Script confirmation modal and Scripts panel summary.
> Preact + Tauri desktop app. The Play Script modal uses its OWN dialog-scoped dark token set derived verbatim from the approved proposal — the previous light Physics Paint dialog tokens do NOT apply to this modal. The Scripts panel summary keeps the existing dark panel tokens.

**Sources:** 42-CONTEXT.md D-01..D-19 (locked user decisions), `SPECS/playscript-proposal/playscript-panel.html` (dialog export block + dialog CSS — visual authority, tokens/metrics read verbatim), `SPECS/playscript-proposal/ui-play-script-specs.md` (color-behavior + modal semantics authority), Image #153 (approved target). No open design questions remain.

**Visual verdict (locked 2026-08-06):** Image #153 (compact dark modal) is the APPROVED target. Image #154 (large light page replacing the central canvas — wrong palette, density, dimensions, placement, container architecture) is REJECTED. Do not reinterpret the proposal through the previous light dialog tokens.

**Architecture guard (unchanged):** Phase 42 generates exactly ONE source cycle — `Frames` (Progressive) or `Frames per cycle` (Static / Hold) real destination frames. Repeat/Infinity are session-level loop intent consumed ONLY by the Requested/Effective readout; they never multiply `frameCount`. Phase 43 repeats the source cycle by reference via linked Loop Clips (a repeated Progressive cycle restarts the build). No UI copy may describe Repeat as immediately generative.

---

## Modal Architecture (D-19)

| Property | Contract |
|----------|----------|
| Placement | Compact modal overlay ABOVE the existing Paint interface, centered over the canvas region; the Paint canvas and Studio layout stay in their normal location behind it |
| Trigger | Sole trigger: the existing Scripts-panel Play Script toolbar action with its existing selection/availability guards (D-17). No demo trigger, no auto-open, no second action |
| Never | Never replaces/occupies the canvas grid cell; never a full-page or full-height editor surface; never resizes the Paint layout; never copies the proposal's demo shell |
| Close | Cancel, Escape, or successful completion — closing never changes the Paint layout |
| Scope | All selectors scoped to the Play Script modal (`.physics-paint-play-script-*`) — surrounding Paint UI is never restyled |
| Fit | The complete modal fits at the minimum supported application window size with ALL rows visible — no vertical/horizontal scrollbar, no body scrolling region, no clipped card/helper/summary/footer. Compact layout, not overflow scrolling, solves the height constraint |

**Layout (D-16, final):**

```
┌──────────────────────────────────────────────┐
│ Row 1  Play Script          Max N · F0–F72   │  compact header
├──────────────────────────────────────────────┤
│ Row 2  Mode  [ Progressive | Static · Hold ] │  full-width card
│        helper line                           │
├──────────────────────┬───────────────────────┤
│ Row 3  Timing        │  Color                │  two-column main grid;
│        (full height) ├───────────────────────┤  right stack height ==
│                      │  Motion wiggle        │  Timing card height
├──────────────────────┴───────────────────────┤
│ Row 4  Requested: …          Effective: …    │  full-width summary bar
├──────────────────────────────────────────────┤
│ Row 5  [progress/status]      Cancel Generate│  footer INSIDE modal
└──────────────────────────────────────────────┘
```

- Motion wiggle is NEVER a separate full-width row and NEVER above Color.
- Right-column stack (Color + gap + Motion wiggle) total height EQUALS the Timing card height; individual card heights may differ. If the stack needs more room, grow the shared row height for BOTH columns — never scroll.
- Motion wiggle card: `Motion wiggle` heading with compact `Reset defaults` heading link; Deformation and Position as compact slider rows with visible numeric values; no unused vertical space.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled; shadcn not applicable — Preact, not React) |
| Preset | not applicable |
| Component library | none (in-repo; color control is a segmented toggle reading the live brush color per D-08R — the dialog does NOT mount `InlineColorPicker`) |
| Icon library | lucide-preact ^0.577.0 (existing panel convention) |
| Font | `system-ui, sans-serif` |

---

## Color — dialog-scoped dark tokens (verbatim from the approved proposal)

Declared as CSS custom properties inside the Play Script modal scope only.

| Token | Value | Usage |
|-------|-------|-------|
| `--ps-surface` | `oklch(0.215 0.008 260)` | Modal surface |
| `--ps-raised` | `oklch(0.255 0.009 260)` | Hover raise (segmented/ghost hover) |
| `--ps-inset` | `oklch(0.165 0.006 260)` | Inputs, segmented tracks, custom-color row, summary bar, progress track |
| `--ps-foot` | `oklch(0.295 0.010 260)` | Footer surface |
| `--ps-fg` | `oklch(0.93 0.005 260)` | Primary text, slider thumbs, active checkmark |
| `--ps-muted` | `oklch(0.62 0.012 260)` | Secondary text, labels, inactive segmented options, ghost button |
| `--ps-faint` | `oklch(0.47 0.012 260)` | Hints, slider-row micro-labels |
| `--ps-border` | `oklch(0.32 0.009 260)` | All structural borders (modal, cards, inputs, tracks) |
| `--ps-accent` | `oklch(0.60 0.19 262)` | Checked segmented state, Generate, progress fill, focus outlines, checked checkbox |
| `--ps-accent-hi` | `oklch(0.66 0.19 262)` | Hover on accent surfaces |
| `--ps-ok` | `oklch(0.72 0.15 150)` | Progress-done fill/status |
| `--ps-error` | `oklch(0.70 0.19 25)` | Inline validation + generation-error text on the dark surface (replaces the light-surface `#a12f37` inside this modal only) |
| `--ps-radius` | `10px` | Cards/segmented tracks (modal shell 14px; inputs/custom row/summary/buttons 8px; segmented buttons 7px; checkbox 4px; chip 6px; dots 3px) |

**Accent reserved for (explicit, exhaustive):** checked segmented state (Mode + Color), `Generate` button, progress fill, `:focus-visible` outlines (2px solid, 2px offset), checked Infinity checkbox. NEVER for helper text, the summary bar text, or the Custom color chip — the chip shows the USER'S CURRENT BRUSH COLOR (data, not accent).

**Scripts panel summary (unchanged):** existing dark panel tokens (`#292b2d` background, `#eef1f4` values, `#aeb5be` metadata) — the modal token set does not leak into the panel.

---

## Typography — dialog-scoped compact scale (verbatim from the approved proposal)

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Modal title | 15px | 650 | `Play Script` in the compact header |
| Section title | 12px | 650 | Card headings (`Mode`, `Timing`, `Color`, `Motion wiggle`) |
| Segmented option | 12.5px | 600 | Mode/Color segmented buttons |
| Input / button | 12.5px | 650 (buttons) | Text inputs, `Cancel`/`Generate` |
| Field label | 11.5px | 600 | `Frames`/`Frames per cycle`, `Repeat`, slider-row labels, checkbox label |
| Body/helper | 12px | 400 | Mode helper line, color panes, summary bar |
| Hint | 11px | 400 | Field hints (`Positive integer or Max.`) |
| Note | 10.5px | 400 | Custom color note (`Picked from the app's brush color panel`), range readout 11.5px |

Weights 600/650 are the proposal's dialog scale — declared here as the dialog-scoped exception to the studio-wide 400/700 rule; they stay inside the modal scope. Numeric fields, the range readout, slider outputs, and the summary bar use `font-variant-numeric: tabular-nums`.

**Panel summary typography (unchanged):** existing dark-panel scale (10px metadata at `#aeb5be`, inherited exception predating this phase).

---

## Spacing — dialog-scoped compact metrics (verbatim from the approved proposal)

| Element | Value |
|---------|-------|
| Modal shell | width 700px, max-width 94%, max-height 96%, radius 14px, border 1px `--ps-border`, shadow `0 24px 64px oklch(0 0 0 / 0.6), 0 2px 8px oklch(0 0 0 / 0.4)` |
| Header | padding `15px 20px 13px`, baseline-aligned, 1px bottom border |
| Body | padding `14px 20px 16px`, two-column grid, gap `14px 24px` |
| Card | padding `11px 13px 12px`, radius 10px, 1px `--ps-border` |
| Section title | margin-bottom 9px; `Reset defaults` link auto-left-margin inside the title row |
| Segmented track | padding 3px, gap 3px; buttons padding `7px 10px`, radius 7px |
| Field | internal gap 6px; field + field margin-top 12px |
| Text input | padding `7px 10px`, radius 8px, inset background |
| Repeat row | input + Infinity checkbox gap 10px; checkbox box 15px |
| Color custom row | padding `7px 10px`, gap 10px; chip 26px; original dots 12px with 3px gap |
| Slider rows | grid `88px 1fr 26px` (label/track/output), row gap 10px; track height 4px; thumb 14px |
| Summary bar | padding `8px 12px`, radius 8px, space-between, gap 12px |
| Footer | padding `10px 20px`, `--ps-foot` background, 1px top border, gap 14px; buttons padding `8px 18px`, min-height 34px, min-width removed (compact) |
| Progress | track height 10px radius 5px; status min-width 148px right-aligned |

**Compactness prohibitions (locked):** no oversized `Play Script` heading; no large outer margins; no large card padding; no excessive vertical gaps; no tall segmented controls or inputs (no 42px touch target in this modal); no large helper-text spacing; no large empty areas; footer never attached to the canvas/window bottom. The Color card must not reserve a large empty area — the color pane centers its compact content.

---

## Copywriting Contract

All mode/loop/color copy is locked verbatim by CONTEXT D-05/D-06/D-08R/D-12/D-13. English only in Phase 42 (French capsule labels are Phase 43 scope; `clip bloquant` never appears).

| Element | Copy |
|---------|------|
| Modal title | `Play Script` |
| Header range (right) | `Max {N} · F{start}–F{end}` (existing status composition, moved into the header row) |
| Mode option 1 | `Progressive` |
| Mode option 1 helper | `The drawing builds stroke by stroke across frames.` |
| Mode option 2 | `Static / Hold` (D-05 locked wording wins over the proposal's `Static · Hold` glyph) |
| Mode option 2 helper | `The complete drawing is applied to every cycle frame.` |
| Frame field label (mode-dependent) | Progressive: `Frames` · Static / Hold: `Frames per cycle` — ONE shared numeric field whose visible label changes with the selected mode; switching to Static / Hold with `Max` in the field normalizes it to `1` (D-03) |
| Frames field help | `Positive integer or Max.` |
| Color card title | `Color` |
| Color option 1 | `Original colors` (default state) |
| Color option 1 pane | Original-color dots + `Keep each stroke's original paint color.` |
| Color option 2 | `Custom color` |
| Color option 2 pane | Live brush-color chip + hex + note `Picked from the app's brush color panel` |
| Motion card title | `Motion wiggle` |
| Motion reset action | `Reset defaults` — compact link inside the Motion wiggle section heading (calls ONLY the controller `resetDialogMotion()`; NO `Save as defaults`, D-06) |
| Repeat field label | `Repeat` (Timing card, both modes — loop intent, see Architecture guard) |
| Repeat field help | `Positive integer.` |
| Infinity toggle label | `Infinity` |
| Infinity-on requested form | `Cycle {N}f × ∞` (D-12, verbatim; repeat field disabled at reduced opacity, value preserved) |
| Summary-bar truncated form | `Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip` (D-13, verbatim pattern) |
| Summary-bar untruncated form | `Requested: {R}f ({C}f × {n}) · Effective: {R}f` |
| Primary CTA | `Generate` |
| Cancel (idle) | `Cancel` |
| Cancel (generating) | `Cancel generation` |
| Empty state (color) | `Original colors` selected by default |
| Error state (frames/repeat) | `{problem}` in `--ps-error` 12px directly under the field, e.g. `Enter a positive integer up to Max {N}.`; Repeat copies: `Enter a positive integer.` / `Repeat is too large for this cycle length.` |
| Panel summary line 1 | `{Mode} · {Original colors | Override #rrggbb} · Motion {deformation}/{position}` (D-07; Generate-time snapshot — later brush changes never rewrite it) |
| Panel summary line 2 | `{destination range} · {generated-frame count/status}` (D-07) |
| Destructive confirmation | None — generation is staged, authority-checked, undo-able |

**Tooltip (landed in 42-04 Task 1):** `Play Script — Generate real Roto keys (progressive or static/hold)`.

**Panel summary update contract (locked):** reflects the last options successfully confirmed and applied by Generate; unsaved dialog edits, cancellation, and failure preserve the previous summary; before the first successful Generate it shows the locked defaults; read-only and signal-driven.

---

## Interaction Contract (accessibility-critical, from D-05/D-08R/D-12/D-16/D-17/D-18/D-19)

| Control | Contract |
|---------|----------|
| Mode segmented control | `role="radiogroup"`, two `role="radio"` children, `aria-checked`, roving `tabindex`, Left/Right arrows move focus AND check with wrap, one Tab stop. Helper line directly below, `aria-describedby`, updates on selection. |
| Color segmented control | Same APG radiogroup pattern: `Original colors` / `Custom color`. Selecting `Original colors` disables the override; selecting `Custom color` immediately resolves the override from the CURRENT right-panel brush color. |
| Custom color live link (D-08R/D-18) | The modal receives the Studio brush color (`settings.color`, sole writer `setBrushColor`) as a live prop; the Custom pane chip + hex render it directly — no copied dialog-side color state, no DOM queries, no new store, no new global event. READ-ONLY: selecting `Custom color` never writes/seeds/normalizes `settings.color`; `Original colors` only disables the override. While open and Custom-selected, right-panel picks re-render the chip/hex live. Generate snapshots via the controller `getBrushColor` port; later brush changes never retroactively change generated frames, remembered options, or the success-only panel summary. |
| Infinity toggle | Checkbox beside the Repeat field in the Timing card. On: repeat input disabled (opacity per proposal), value preserved, summary bar shows `Cycle {N}f × ∞`. Off: restores the last finite repeat (D-12). Never render `Infinityf`. |
| Repeat/Infinity loop intent | Repeat + Infinity render in the Timing card in BOTH modes as session-level loop intent ONLY. Phase 42 always generates exactly one source cycle; Phase 43 repeats it by reference. No copy or control may imply Repeat materializes extra real keys. |
| Summary bar | Full-width bar (Row 4) rendering the controller `loopReadout` verbatim (D-13 forms), `tabular-nums`, Requested left / Effective right. Informational only — never gates, blocks, or alters generation (D-14). |
| During generation | Existing `canCancel` behavior: inputs disabled, `Cancel generation` replaces `Cancel`, footer progress shown. All controls follow the same disabled rule. |
| Generation failure | Progress stops and hides; inputs/actions re-enable; modal stays open; failure reason shown in `--ps-error` inline style above the footer actions; retry or cancel normally; no partial frames/mutations; remembered options and panel summary untouched. |
| Generation cancellation | Idle `Cancel` or mid-run `Cancel generation` returns to idle WITHOUT an error; remembered options/summary untouched; no partial mutations. |
| Compact fit (D-19) | The complete modal fits at the minimum supported application window size with all rows visible: no vertical/horizontal scrollbar, no body scrolling region, no clipped card/helper/summary/footer. The compact layout — not overflow scrolling — solves the height constraint. Native UAT verifies at minimum window size. |
| Dialog Motion wiggle controls | Sliders initialized from Motion panel defaults on open; edits application-time only (D-06). `Reset defaults` (heading link) re-reads the defaults port through the controller. |
| Keyboard | `Escape` cancels/closes, `Enter` confirms when valid; focus trap inside the modal while open (`input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])`). |
| First-time Static / Hold defaults | Frames per cycle = 1, Repeat = 1, Infinity = off (D-15). Progressive defaults untouched. |
| Dialog trigger (D-17) | The existing Scripts-panel Play Script toolbar action remains the SOLE trigger — no demo trigger copied, never auto-opens, no second action, existing guards preserved. Closing (Cancel/Escape/success) never changes the Paint layout. |

---

## UI Considerations

> State coverage across 6 surfaces: E1 Play Script modal, E2 color segmented control + live chip, E3 Motion wiggle controls, E4 Timing card (Frames / Repeat / Infinity), E5 generation-in-progress, E6 Scripts panel summary.

Applicable state considerations resolved: 13 covered, 0 backstops, 16 dismissed, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty / first-open | E1 modal options, E4 Timing card | ✅ covered | D-15 first-time defaults: Frames per cycle 1, Repeat 1, Infinity off (Static / Hold; Progressive defaults untouched); session memory via controller signals (D-10) |
| empty / default | E3 Motion wiggle controls | ✅ covered | Initialized from Motion panel defaults on open — never blank; `Reset defaults` re-reads the defaults port (D-06) |
| empty / first-open | E2 color control | ✅ covered | `Original colors` selected by default; override exists only while `Custom color` is selected and resolves live from the brush color (D-08R) |
| live-update | E2 Custom color pane | ✅ covered | Chip + hex render the live Studio brush-color prop; right-panel picks re-render instantly while open and Custom-selected; Generate snapshots (D-08R/D-18) |
| error | E1 frame field, E3 Motion inputs, E4 Repeat field | ✅ covered | Inline error under field, `--ps-error` 12px, strict-regex validation mirroring `parseCount`; confirm disabled while invalid |
| error | E5 generation failure | ✅ covered | Progress stops/hides; inputs/actions re-enable; modal stays open; `--ps-error` inline error shows the reason; retry/cancel allowed; no partial frames/mutations; remembered options and panel summary untouched. Normal cancellation shows no error and is equally atomic |
| loading / busy | E5 generation in progress | ✅ covered | `canCancel` + footer progress pattern extends to all controls (disabled while generating; `Cancel generation` replaces `Cancel`) |
| partial | E4/E1 summary bar | ✅ covered | Requested/effective/truncation derived from retained `layerEndExclusive`/`canonicalStart` signals; untruncated form omits the clause (D-13); readout is loop intent only (D-14) |
| overflow | E1 modal at minimum window size | ✅ covered | Compact-fit contract (locked, D-19): all rows visible, no scrollbars, no body scrolling region, no clipped content — solved by the compact layout, not scrolling. Native UAT verifies |
| overflow | E6 panel summary | ✅ covered | Fixed two-line block in the existing dark panel layout — no new panel surface |
| long-text | E6 panel summary | ✅ covered | Existing ellipsis convention applies to the two-line summary |
| disabled | E4 Repeat field under Infinity-on | ✅ covered | Disabled at reduced opacity, value preserved and restored on toggle-off (D-12) |
| loading | E1, E2, E3, E4, E6 | ✖ dismissed | All surfaces render synchronously from controller signals / defaults port / live brush-color prop — no async load path |
| partial | E1, E3, E5 | ✖ dismissed | Fields always fully initialized (E1/E3); generation is a staged atomic operation (E5) |
| long-text | E1, E2, E3, E4, E5 | ✖ dismissed | Copy is locked short strings; numeric inputs bounded by Max validation with `tabular-nums`; Custom pane shows only chip + `#rrggbb` + fixed note; helper/summary text has fixed compact forms |
| error | E2, E6 | ✖ dismissed | The color toggle has no invalid-input path (no picker, live signal only); summary is a read-only projection with no load path |
| overflow | E3 | ✖ dismissed | Two compact slider rows inside the shared main grid — covered by the E1 compact-fit contract |
| empty | E5 | ✖ dismissed | Progress state only exists during generation |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized (Preact project; no `components.json`) |
| third-party | none | not applicable — zero new dependencies in this phase |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending re-check (2026-08-06 final visual correction)
- [ ] Dimension 2 Visuals: pending re-check (2026-08-06 final visual correction)
- [ ] Dimension 3 Color: pending re-check (2026-08-06 final visual correction)
- [ ] Dimension 4 Typography: pending re-check (2026-08-06 final visual correction)
- [ ] Dimension 5 Spacing: pending re-check (2026-08-06 final visual correction)
- [ ] Dimension 6 Registry Safety: pending re-check (2026-08-06 final visual correction)

**Approval history:** approved 2026-08-05; re-approved 2026-08-06 (proposal layout + live color, 6/6 PASS). **2026-08-06 (2):** final visual correction — compact dark modal overlay (Image #153 target / Image #154 rejected), Timing-left / Color-over-Motion-right grid, no-scroll compact fit (D-16 final / D-19) — pending gsd-ui-checker re-approval.
