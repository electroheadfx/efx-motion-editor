---
phase: 42
slug: playscript-application-modes-color-override
status: revised
shadcn_initialized: false
preset: none
created: 2026-08-05
reviewed_at: 2026-08-06
revision: 2026-08-06 — approved playscript-proposal adopted (dialog layout + two-state live brush-color control; inline picker superseded); Repeat/Infinity clarified as session-level loop intent
revision_sources:
  - SPECS/playscript-proposal/playscript-panel.html
  - SPECS/playscript-proposal/ui-play-script-specs.md
  - 42-UI-REVISION-DELTA.md
---

# Phase 42 — UI Design Contract (revised 2026-08-06)

> Visual and interaction contract for the Play Script confirmation dialog expansion and Scripts panel summary.
> Preact + Tauri desktop app; shadcn is not applicable (React-only). The design contract is the existing hand-rolled Physics Paint design system in `physicsPaintStudio.css`, extended inside the verified isolated dialog scope only.

**Sources:** 42-CONTEXT.md D-01..D-16 (locked user decisions, incl. D-08R live-color contract and D-16 layout revision), `SPECS/playscript-proposal/playscript-panel.html` + `ui-play-script-specs.md` (approved structure/layout/interaction source — its dark app mockup is out of scope), 42-RESEARCH.md (verified code seams), existing `physicsPaintStudio.css:1216-1309` (dialog tokens, read verbatim). No open design questions remain.

**Architecture guard (locked, reiterated after UAT question 2026-08-06):** Phase 42 generates exactly ONE source cycle — `Frames` (Progressive) or `Frames per cycle` (Static / Hold) real destination frames. Repeat/Infinity are session-level loop intent consumed ONLY by the Requested/Effective readout; they never multiply `frameCount` or materialize repeated keys. Phase 43 repeats the source cycle by reference via linked Loop Clips (a repeated Progressive cycle restarts the build: `A|AB|ABC|A|AB|ABC`). No UI copy in this phase may describe Repeat as immediately generative.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled system; shadcn not applicable — Preact, not React) |
| Preset | not applicable |
| Component library | none (in-repo components; color control is a segmented toggle reading the live brush color per D-08R — the dialog does NOT mount `InlineColorPicker`) |
| Icon library | lucide-preact ^0.577.0 (existing panel convention) |
| Font | `system-ui, sans-serif` (Physics Paint Studio scope, `physicsPaintStudio.css:11`) |

**Scope discipline (Phase 36.14 regression lesson, D-04):** all new markup stays inside `.physics-paint-play-script-dialog` / `-surface` / `-content`; every new class uses the `physics-paint-play-script-*` prefix. The dialog remains mounted directly in the Studio grid (grid-row 2 / grid-column 2, stretch) with the light full-height surface. The two-line panel summary lives in the dark Scripts panel and follows existing panel tokens — no new panel color is introduced.

**Layout (D-16, approved proposal):** the dialog body is a two-column card grid:
1. **Mode** card — spans full width (segmented control + helper line).
2. **Timing** card | **Color** card — side by side.
3. **Motion wiggle** card — spans full width, `Reset defaults` link in the section heading.
4. **Summary bar** — Requested/Effective readout, spans full width at the bottom of the body.
5. **Fixed footer** — progress line + status, `Cancel` / `Generate` actions; outside the scroll region.

The proposal's dark theme is NOT adopted — the dialog keeps the existing light-surface tokens below. The viewport-bounded, body-only scrolling contract is unchanged: only the dialog body scrolls; title/mode context and the footer stay visible.

**Visual hierarchy:** the `Progressive` | `Static / Hold` segmented control is the first-read element (Mode card, top); `Generate` is the terminal action anchor (footer). Timing, Color, and Motion wiggle cards read as secondary groups; the summary bar closes the body.

---

## Spacing Scale

Declared values (multiples of 4). New controls added in this phase MUST use these:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Chip/dot gaps inside the Color card; content `padding-right` (existing) |
| sm | 8px | Actions-row gap (existing); gap between label/helper groups; repeat field ↔ Infinity toggle gap; card internal gaps |
| md | 16px | Default vertical rhythm between dialog control groups; card grid gap |
| lg | 24px | Minimum surface padding (existing clamp floor) |
| xl | 32px | Not used in this phase (card grid supersedes the 32px major-section gaps) |
| 2xl | 48px | Not used in this phase |
| 3xl | 64px | Not used in this phase |

**Inherited exceptions (preserved verbatim — do NOT "fix" to the 4-point scale):**

| Value | Where | Why kept |
|-------|-------|----------|
| 18px | `.physics-paint-play-script-surface` gap | Existing approved dialog rhythm |
| 12px | `.physics-paint-play-script-content` gap | Existing approved dialog rhythm |
| clamp(24px, 4vw, 52px) | Surface padding | Existing responsive padding |
| 42px | Input `min-height` | Existing touch target |
| 10px | Input horizontal padding (`8px 10px`) | Existing input inset |
| 112px | Action button `min-width` | Existing button sizing |
| 6px / 7px | Border radii (inputs 6px; panel confirmation 7px) | Existing radii |

---

## Typography

Exactly 4 sizes, 2 weights (matches existing dialog):

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 16px | 400 | 1.5 | Inputs, helper lines, summary-bar readout, panel summary line 2 values |
| Label | 12px | 700 | 1.2 | Card section titles — uppercase, `letter-spacing: 0.06em`, color `#343a42` (existing `content label` rule) |
| Secondary | 12px | 400 | 1.5 | Helper line under the segmented control, inline errors, Color card note (`Picked from the app's brush color panel`), Motion wiggle `Reset defaults` link, panel summary line 1 (dark panel: `#aeb5be` at 10px per existing `physics-paint-script-provenance` convention — see note) |
| Display | clamp(24px, 3vw, 36px) | 700 | 1.1 | Dialog title `Play Script` (existing `content strong` rule) |

**Notes:**
- Weights are exactly 400 and 700. No 500/600 anywhere in new markup.
- Numeric fields and the Requested/Effective summary bar use `font-variant-numeric: tabular-nums` (existing input rule) so durations do not jitter while values change.
- Panel summary typography follows the existing dark-panel scale (10px metadata at `#aeb5be`, matching `physics-paint-script-provenance`/`physics-paint-scripts-status`); it does NOT import the dialog's light-surface label style into the dark pane.

---

## Color

Two surfaces, both already approved — the contract is to stay inside them.

### Dialog surface (light, `.physics-paint-play-script-surface`)

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f7f5ef` | Dialog surface background |
| Secondary (30%) | `#ffffff` | Input fields, card backgrounds, segmented-control tracks |
| Text primary | `#20242a` (headings `#171a1f`) | All dialog copy |
| Text muted | `#343a42` | Labels |
| Border | `#d8d4ca` (surface/cards), `#a9afb7` (inputs) | Structure |
| Accent (10%) | `#365ed6` | See reserved list below |
| Destructive / error | `#a12f37` | Inline validation errors only (existing `.physics-paint-script-inline-error` in dialog scope) |

### Scripts panel surface (dark, existing — summary block only)

| Role | Value | Usage |
|------|-------|-------|
| Dominant | `#292b2d` | Panel background (existing) |
| Text primary | `#eef1f4` | Summary values |
| Text muted | `#aeb5be` | Summary labels/metadata |
| Accent | `var(--color-accent, #2d5be3)` | Focus outlines only (existing row convention) |

**Accent reserved for (explicit, exhaustive):**
1. Primary `Generate` action button.
2. Checked state of the `Progressive` | `Static / Hold` segmented control and the `Original colors` | `Custom color` segmented control.
3. Progress bar during generation (existing `accent-color: #365ed6` on `progress`).
4. `:focus-visible` outlines on dialog controls (2px solid, 2px offset, matching existing row convention).

Accent is NEVER used for: helper text, the summary-bar readout, the Custom color chip border, disabled states, or the panel summary. The Custom color chip shows the USER'S CURRENT BRUSH COLOR — it is data, not accent.

**State colors:** disabled repeat field under Infinity-on uses reduced opacity (0.5) on the existing input style — no new grey token. No hover-state color inventions beyond existing transitions.

---

## Copywriting Contract

All mode/loop/color copy is locked verbatim by CONTEXT D-05/D-06/D-08R/D-12/D-13/D-16. English only in Phase 42 (French capsule labels are Phase 43 scope; `clip bloquant` never appears).

| Element | Copy |
|---------|------|
| Dialog title | `Play Script` (existing, unchanged) |
| Mode option 1 | `Progressive` |
| Mode option 1 helper | `The drawing builds stroke by stroke across frames.` |
| Mode option 2 | `Static / Hold` |
| Mode option 2 helper | `The complete drawing is applied to every cycle frame.` |
| Frame field label (mode-dependent) | Progressive: `Frames` (existing) · Static / Hold: `Frames per cycle` (D-03 revised 2026-08-06) — ONE shared numeric field whose visible label changes with the selected mode (no second field); switching to Static / Hold with `Max` in the field normalizes it to `1` (D-03/D-15) |
| Frames field help | `Enter a positive integer or Max.` (existing, unchanged) |
| Color card title | `Color` |
| Color option 1 | `Original colors` (default state) |
| Color option 1 pane | Original-color dots + `Keep each stroke's original paint color.` |
| Color option 2 | `Custom color` |
| Color option 2 pane | Live brush-color chip + hex + note `Picked from the app's brush color panel` |
| Motion card title | `Motion wiggle` |
| Motion reset action | `Reset defaults` — link/action inside the Motion wiggle section heading (D-16; calls ONLY the controller `resetDialogMotion()`; NO `Save as defaults` in Phase 42, D-06) |
| Repeat field label | `Repeat` (Timing card, both modes — loop intent, see Architecture guard) |
| Infinity toggle label | `Infinity` (or `∞` with `aria-label="Infinity"`) |
| Infinity-on requested form | `Cycle {N}f × ∞` (D-12, verbatim; repeat field disabled/greyed, value preserved) |
| Summary-bar truncated form | `Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip` (D-13, verbatim pattern) |
| Summary-bar untruncated form | `Requested: {R}f ({C}f × {n}) · Effective: {R}f` (no truncation clause when effective equals requested) |
| Primary CTA | `Generate` (existing dialog confirm, unchanged — verb + implied noun) |
| Cancel (idle) | `Cancel` |
| Cancel (generating) | `Cancel generation` (existing) |
| Empty state (color) | `Original colors` selected by default — no separate empty copy needed |
| Error state (frames/repeat) | Existing inline-error pattern: `{problem}` in `#a12f37` 12px directly under the field, e.g. `Enter a positive integer up to Max {N}.` (strict-regex validation mirroring `parseCount`, RESEARCH Pitfall: numeric parsing) |
| Panel summary line 1 | `{Mode} · {Original colors | Override #rrggbb} · Motion {deformation}/{position}` (D-07; the override hex is the Generate-time snapshot — later brush-color changes never rewrite it, D-08R) |
| Panel summary line 2 | `{destination range} · {generated-frame count/status}` (D-07) |
| Destructive confirmation | None in this phase — generation is a staged, authority-checked, undo-able operation; no destructive action is added |

**Tooltip update (RESEARCH Pitfall 8):** the Play Script toolbar tooltip currently reads `Play Script — Generate progressive real Roto keys` and MUST be updated to cover both modes, e.g. `Play Script — Generate real Roto keys (progressive or static/hold)`. (Landed in 42-04 Task 1.)

**Panel summary update contract (locked):**
- The two-line Scripts-panel summary reflects the last options successfully confirmed and applied by Generate.
- Unsaved edits inside an open dialog MUST NOT update the panel summary.
- A successful Generate atomically updates the remembered session options and the summary together.
- Cancel, user cancellation during generation, and generation failure preserve the previously successful summary and remembered options.
- Before the first successful Generate, the summary shows the locked first-time/session defaults.
- The summary remains read-only and signal-driven.

---

## Interaction Contract (accessibility-critical, from D-05/D-08R/D-12/D-16 + RESEARCH)

| Control | Contract |
|---------|----------|
| Mode segmented control | `role="radiogroup"` with two `role="radio"` children, `aria-checked`, roving `tabindex` (checked = `0`, unchecked = `-1`), Left/Right arrows move focus AND check with wrap-around, one Tab stop for the group (W3C APG radio pattern; integrates with the dialog's existing Tab focus-trap selector). Helper line directly below, linked via `aria-describedby`, updates on selection change. No additional radio rows or duplicated descriptions. |
| Color segmented control | Same APG radiogroup pattern as the Mode control: two options `Original colors` / `Custom color`, `aria-checked`, roving tabindex, arrow-key navigation with wrap, one Tab stop. Selecting `Original colors` disables the override. Selecting `Custom color` immediately resolves the override color from the CURRENT right-panel brush color. |
| Custom color live link (D-08R) | The dialog receives the Studio brush color (`settings.color`, single writer `setBrushColor`) as a live prop; the Custom pane chip + hex render it directly — no copied dialog-side color state, no DOM queries, no new store, no new global event. While the dialog is open and Custom color is selected, right-panel brush-color changes re-render the chip/hex live. Generate snapshots the resolved color for that application (controller `getBrushColor` port at confirm time); later brush-color changes never retroactively change generated frames, the remembered options, or the success-only panel summary. |
| Infinity toggle | Separate control beside the Repeat field in the Timing card. On: repeat input disabled/greyed (NOT cleared), summary bar shows `Cycle {N}f × ∞`. Off: restores the last finite repeat value (D-12). Never render `Infinityf` from naive multiplication (RESEARCH Pitfall 7). |
| Repeat/Infinity loop intent | Repeat + Infinity render in the Timing card in BOTH modes. They express session-level loop intent ONLY (Requested/Effective duration, truncation, Infinity state, success-only remembered options). Phase 42 always generates exactly one source cycle (`Frames` / `Frames per cycle` real frames); Phase 43 repeats it by reference via linked Loop Clips. No copy or control may imply Repeat materializes extra real keys. |
| Summary bar | Full-width bar at the bottom of the dialog body rendering the controller `loopReadout` verbatim (D-13 forms), `tabular-nums`. Informational only — never gates, blocks, or alters generation (D-14). |
| During generation | Existing `canCancel` behavior: inputs disabled, `Cancel generation` replaces `Cancel`, progress bar shown in the fixed footer. New controls follow the same disabled rule. |
| Generation failure | Generation progress stops; the progress bar hides; inputs and actions re-enable; the dialog stays open; the existing inline-error pattern displays the failure reason; the user may retry or cancel normally; the pre-generation canvas/timeline state is untouched. A failed generation does NOT update the remembered session options or the Scripts-panel summary, and leaves no partial generated frames or timeline mutations. |
| Generation cancellation | Normal user cancellation (idle `Cancel`, or `Cancel generation` mid-run) returns to the idle dialog WITHOUT displaying an error; it does NOT update the remembered session options or the Scripts-panel summary, and leaves no partial generated frames or timeline mutations. |
| Dialog overflow structure | The dialog surface is constrained to the height available from its Studio grid/viewport container with a viewport-bounded max-height; ONLY the dialog body scrolls vertically while the dialog title/mode context and the fixed footer (progress + actions) remain visible; horizontal scrolling is prevented; helper and validation text wraps; keyboard-focused controls are scrolled into view with visible focus outlines preserved. Native UAT at the minimum supported window size verifies this structure (verification only — not the primary resolution). |
| Dialog Motion wiggle controls | Editable position/deformation sliders initialized from Motion panel defaults on open; edits are application-time only (never write back, D-06). `Reset defaults` (heading link) re-reads the defaults port through the controller. |
| Keyboard | Existing dialog shortcuts preserved: `Escape` cancels, `Enter` confirms when valid. New controls must not break the Tab trap query (`input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])`). |
| First-time Static / Hold defaults | Frames per cycle = 1, Repeat = 1, Infinity = off (D-15). Progressive defaults untouched. |

---

## UI Considerations

> State coverage resolved across 6 surfaces: E1 Play Script dialog, E2 color segmented control + live chip, E3 Motion wiggle controls, E4 Timing card (Frames / Repeat / Infinity), E5 generation-in-progress, E6 Scripts panel summary. Empty/error COPY lives in `## Copywriting Contract` above — rows below reference it. (E2 revised 2026-08-06: inline-picker states removed — no picker exists.)

Applicable state considerations resolved: 13 covered, 0 backstops, 16 dismissed, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty / first-open | E1 dialog options, E4 Timing card | ✅ covered | D-15 first-time defaults: Frames per cycle 1, Repeat 1, Infinity off (Static / Hold; Progressive defaults untouched); session memory via controller signals thereafter (D-10) |
| empty / default | E3 Motion wiggle controls | ✅ covered | Inputs initialized from Motion panel defaults on open — never blank; `Reset defaults` re-reads the defaults port (D-06) |
| empty / first-open | E2 color control | ✅ covered | `Original colors` selected by default; the override exists only while `Custom color` is selected and resolves live from the brush color — no seed, no pick-guard problem (D-08R) |
| live-update | E2 Custom color pane | ✅ covered | Chip + hex render the live Studio brush color prop; right-panel picks re-render instantly while the dialog is open and Custom is selected; Generate snapshots (D-08R) |
| error | E1 frame field (Frames / Frames per cycle), E3 Motion inputs, E4 Repeat field | ✅ covered | Inline error under field, `#a12f37` 12px, strict-regex validation mirroring `parseCount` (`Enter a positive integer up to Max {N}.`); confirm disabled while invalid |
| error | E5 generation failure | ✅ covered | On generation failure (distinct from user cancel): generation progress stops, the progress bar hides, inputs and actions re-enable, the dialog stays open, and the existing inline-error pattern shows the failure reason; retry or normal cancellation allowed; pre-generation canvas/timeline state untouched; the remembered session options and Scripts-panel summary are NOT updated; no partial generated frames or timeline mutations are left behind. Normal user cancellation returns to the idle dialog with no error shown and likewise leaves remembered options/summary untouched with no partial mutations |
| loading / busy | E5 generation in progress | ✅ covered | Existing `canCancel` + footer progress bar pattern extends to all new controls (disabled while generating; `Cancel generation` replaces `Cancel`) |
| partial | E4/E1 summary bar | ✅ covered | Requested/effective/truncation derived from retained `layerEndExclusive`/`canonicalStart` signals (RESEARCH Pitfall 5); untruncated form omits the truncation clause (D-13); readout is loop intent only, never generation input (D-14) |
| overflow | E6 panel summary | ✅ covered | Fixed two-line block in the existing dark panel layout — no new panel surface |
| long-text | E6 panel summary | ✅ covered | Existing ellipsis convention (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on panel copy) applies to the two-line summary |
| disabled | E4 Repeat field under Infinity-on | ✅ covered | Disabled/greyed at 0.5 opacity, value preserved and restored on toggle-off (D-12) |
| overflow | E1 dialog with all options visible | ✅ covered | Structural contract (locked): the dialog surface is constrained to the height available from its viewport/grid container with a viewport-bounded max-height; ONLY the dialog body scrolls vertically; the dialog title/mode context and the fixed footer stay visible while the body scrolls; horizontal scrolling is prevented; helper and validation text wraps; keyboard-focused controls are scrolled into view with visible focus outlines preserved. Native UAT at the minimum supported window size is retained as verification only, not as the primary resolution |
| loading | E1, E2, E3, E4, E6 | ✖ dismissed | All surfaces render synchronously from controller signals / defaults port / live brush-color prop — no async load path exists |
| partial | E1, E3, E5 | ✖ dismissed | Form fields always fully initialized (E1/E3); generation is a staged atomic operation with cancel restoring pre-generation state (E5) |
| long-text | E1, E2, E3, E4, E5 | ✖ dismissed | Dialog copy is locked short strings; numeric inputs bounded by Max validation with `tabular-nums`; the Custom pane shows only a chip + `#rrggbb` + fixed note |
| error | E2, E6 | ✖ dismissed | The color toggle has no invalid-input path (E2 — no picker, live signal only); summary is a read-only signal-driven projection of the last successfully applied options with no load path (E6) |
| overflow | E3 | ✖ dismissed | Two sliders in a full-width card — covered by the E1 dialog-level overflow contract |
| empty | E5 | ✖ dismissed | Progress state only exists during generation — no zero-data case |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized (Preact project; no `components.json`) |
| third-party | none | not applicable — no third-party registries declared; zero new dependencies in this phase |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending re-check (2026-08-06 revision)
- [ ] Dimension 2 Visuals: pending re-check (2026-08-06 revision)
- [ ] Dimension 3 Color: pending re-check (2026-08-06 revision)
- [ ] Dimension 4 Typography: pending re-check (2026-08-06 revision)
- [ ] Dimension 5 Spacing: pending re-check (2026-08-06 revision)
- [ ] Dimension 6 Registry Safety: pending re-check (2026-08-06 revision)

**Approval history:** approved 2026-08-05 (gsd-ui-checker); re-verified 2026-08-05 after user-locked revision (E1 overflow, mode-dependent frame label, summary-updates-after-success, E5 failure/cancellation). **2026-08-06:** revised per the approved playscript-proposal (D-08R/D-16; inline-picker contract superseded; loop-intent clarification) — pending gsd-ui-checker re-approval.
