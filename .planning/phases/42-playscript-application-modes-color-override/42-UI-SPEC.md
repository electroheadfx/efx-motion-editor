---
phase: 42
slug: playscript-application-modes-color-override
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-05
---

# Phase 42 — UI Design Contract

> Visual and interaction contract for the Play Script confirmation dialog expansion and Scripts panel summary.
> Preact + Tauri desktop app; shadcn is not applicable (React-only). The design contract is the existing hand-rolled Physics Paint design system in `physicsPaintStudio.css`, extended inside the verified isolated dialog scope only.

**Sources:** 42-CONTEXT.md D-04..D-15 (locked user decisions), 42-RESEARCH.md (verified code seams + pitfalls), existing `physicsPaintStudio.css:1216-1309` (dialog tokens, read verbatim), `PhysicsPaintPlayScriptDialog.tsx` (current copy, read verbatim). No open design questions remain; every value below is either locked upstream or an inherited existing token.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled system; shadcn not applicable — Preact, not React) |
| Preset | not applicable |
| Component library | none (in-repo components; `InlineColorPicker` reused per D-08) |
| Icon library | lucide-preact ^0.577.0 (existing panel convention) |
| Font | `system-ui, sans-serif` (Physics Paint Studio scope, `physicsPaintStudio.css:11`) |

**Scope discipline (Phase 36.14 regression lesson, D-04):** all new markup stays inside `.physics-paint-play-script-dialog` / `-surface` / `-content`; every new class uses the `physics-paint-play-script-*` prefix. The dialog remains mounted directly in the Studio grid (grid-row 2 / grid-column 2, stretch) with the light full-height surface. The two-line panel summary lives in the dark Scripts panel and follows existing panel tokens — no new panel color is introduced.

---

## Spacing Scale

Declared values (multiples of 4). New controls added in this phase MUST use these:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Swatch gap inside the override row; content `padding-right` (existing) |
| sm | 8px | Actions-row gap (existing); gap between label/helper groups; repeat field ↔ Infinity toggle gap |
| md | 16px | Default vertical rhythm between dialog control groups |
| lg | 24px | Minimum surface padding (existing clamp floor) |
| xl | 32px | Gap between major dialog sections (mode block / options block / loop block) |
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
| Body | 16px | 400 | 1.5 | Inputs, helper lines, loop readout, panel summary line 2 values |
| Label | 12px | 700 | 1.2 | Section labels — uppercase, `letter-spacing: 0.06em`, color `#343a42` (existing `content label` rule) |
| Secondary | 12px | 400 | 1.5 | Helper line under the segmented control, inline errors, panel summary line 1 (dark panel: `#aeb5be` at 10px per existing `physics-paint-script-provenance` convention — see note) |
| Display | clamp(24px, 3vw, 36px) | 700 | 1.1 | Dialog title `Play Script` (existing `content strong` rule) |

**Notes:**
- Weights are exactly 400 and 700. No 500/600 anywhere in new markup.
- Numeric fields and the requested/effective readout use `font-variant-numeric: tabular-nums` (existing input rule) so durations do not jitter while values change.
- Panel summary typography follows the existing dark-panel scale (10px metadata at `#aeb5be`, matching `physics-paint-script-provenance`/`physics-paint-scripts-status`); it does NOT import the dialog's light-surface label style into the dark pane.

---

## Color

Two surfaces, both already approved — the contract is to stay inside them.

### Dialog surface (light, `.physics-paint-play-script-surface`)

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f7f5ef` | Dialog surface background |
| Secondary (30%) | `#ffffff` | Input fields, picker well, segmented-control track |
| Text primary | `#20242a` (headings `#171a1f`) | All dialog copy |
| Text muted | `#343a42` | Labels |
| Border | `#d8d4ca` (surface), `#a9afb7` (inputs) | Structure |
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
2. Checked state of the `Progressive` | `Static / Hold` segmented control.
3. Progress bar during generation (existing `accent-color: #365ed6` on `progress`).
4. `:focus-visible` outlines on dialog controls (2px solid, 2px offset, matching existing row convention).

Accent is NEVER used for: helper text, the loop readout, the override swatch border, disabled states, or the panel summary. The override swatch shows the USER'S PICKED COLOR — it is data, not accent.

**State colors:** disabled repeat field under Infinity-on uses reduced opacity (0.5) on the existing input style — no new grey token. No hover-state color inventions beyond existing transitions.

---

## Copywriting Contract

All mode/loop/override copy is locked verbatim by CONTEXT D-05/D-06/D-08/D-12/D-13. English only in Phase 42 (French capsule labels are Phase 43 scope; `clip bloquant` never appears).

| Element | Copy |
|---------|------|
| Dialog title | `Play Script` (existing, unchanged) |
| Mode option 1 | `Progressive` |
| Mode option 1 helper | `The drawing builds stroke by stroke across frames.` |
| Mode option 2 | `Static / Hold` |
| Mode option 2 helper | `The complete drawing is applied to every cycle frame.` |
| Frames field label | `Frames` (existing; IS the cycle frame count in Static / Hold per D-03 — same label, no second field) |
| Frames field help | `Enter a positive integer or Max.` (existing, unchanged) |
| Color default state | `Original colors` |
| Color reset action | Explicit control returning to `Original colors` (e.g. a small text button beside the swatch labeled `Original colors`); picker opens directly on first enable, no seed color (D-09) |
| Motion reset action | `Reset to Motion defaults` (D-06; NO `Save as defaults` in Phase 42) |
| Repeat field label | `Repeat` |
| Infinity toggle label | `Infinity` (or `∞` with `aria-label="Infinity"`) |
| Infinity-on requested form | `Cycle {N}f × ∞` (D-12, verbatim; repeat field disabled/greyed, value preserved) |
| Loop readout form | `Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip` (D-13, verbatim pattern) |
| Loop readout untruncated form | `Requested: {R}f ({C}f × {n}) · Effective: {R}f` (no truncation clause when effective equals requested) |
| Primary CTA | `Generate` (existing dialog confirm, unchanged — verb + implied noun) |
| Cancel (idle) | `Cancel` |
| Cancel (generating) | `Cancel generation` (existing) |
| Empty state (color) | `Original colors` shown as the default state — no separate empty copy needed |
| Error state (frames/repeat) | Existing inline-error pattern: `{problem}` in `#a12f37` 12px directly under the field, e.g. `Enter a positive integer up to Max {N}.` (strict-regex validation mirroring `parseCount`, RESEARCH Pitfall: numeric parsing) |
| Panel summary line 1 | `{Mode} · {Original colors | Override #rrggbb} · Motion {deformation}/{position}` (D-07; exact separator formatting is planner discretion within this content) |
| Panel summary line 2 | `{destination range} · {generated-frame count/status}` (D-07) |
| Destructive confirmation | None in this phase — generation is a staged, authority-checked, undo-able operation; no destructive action is added |

**Tooltip update (RESEARCH Pitfall 8):** the Play Script toolbar tooltip currently reads `Play Script — Generate progressive real Roto keys` and MUST be updated to cover both modes, e.g. `Play Script — Generate real Roto keys (progressive or static/hold)`. The panel summary must reflect CURRENT session options, not the last generation.

---

## Interaction Contract (accessibility-critical, from D-05/D-12 + RESEARCH)

| Control | Contract |
|---------|----------|
| Mode segmented control | `role="radiogroup"` with two `role="radio"` children, `aria-checked`, roving `tabindex` (checked = `0`, unchecked = `-1`), Left/Right arrows move focus AND check with wrap-around, one Tab stop for the group (W3C APG radio pattern; integrates with the dialog's existing Tab focus-trap selector). Helper line directly below, linked via `aria-describedby`, updates on selection change. No additional radio rows or duplicated descriptions. |
| Override swatch | Compact button showing `Original colors` by default; opens `InlineColorPicker` (Box/TSL/RVB/CMYK) rendered INLINE inside the dialog content column (RESEARCH Open Question 3 recommendation — preserves the focus trap and CSS isolation; no popover). |
| Picker pick semantics | Opening the picker MUST NOT create an override (RESEARCH Pitfall 3: `InlineColorPicker` fires `onChange` on mount). The "override exists" boolean is owned by controller signals and flips only on a genuine user pick; close-without-interaction leaves `Original colors` intact. Contract test locks this. |
| Infinity toggle | Separate control beside the Repeat field. On: repeat input disabled/greyed (NOT cleared), readout shows `Cycle {N}f × ∞`. Off: restores the last finite repeat value (D-12). Never render `Infinityf` from naive multiplication (RESEARCH Pitfall 7). |
| During generation | Existing `canCancel` behavior: inputs disabled, `Cancel generation` replaces `Cancel`, progress bar shown. New controls follow the same disabled rule. |
| Dialog Motion controls | Editable position/deformation inputs initialized from Motion panel defaults on open; edits are application-time only (never write back, D-06). `Reset to Motion defaults` re-reads the defaults port. |
| Keyboard | Existing dialog shortcuts preserved: `Escape` cancels, `Enter` confirms when valid. New controls must not break the Tab trap query (`input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])`). |
| First-time Static / Hold defaults | Frames = 1, Repeat = 1, Infinity = off (D-15). Progressive defaults untouched. |

---

## UI Considerations

> State coverage for the dialog + panel summary. Empty/error COPY lives in `## Copywriting Contract` above.

Applicable state considerations resolved: 7 covered, 1 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty / first-open | Dialog options (Static / Hold) | ✅ covered | D-15 first-time defaults: Frames 1, Repeat 1, Infinity off; session memory via controller signals thereafter (D-10) |
| empty / default | Color override | ✅ covered | `Original colors` default state; override exists only after a deliberate pick (D-08/D-09, Pitfall 3 contract test) |
| disabled | Repeat field under Infinity-on | ✅ covered | Disabled/greyed at 0.5 opacity, value preserved and restored on toggle-off (D-12) |
| populated / partial | Hold Loop readout | ✅ covered | Requested/effective/truncation derived from retained `layerEndExclusive`/`canonicalStart` signals (RESEARCH Pitfall 5); untruncated form omits the truncation clause (D-13) |
| loading / busy | Generation in progress | ✅ covered | Existing `canCancel` + progress bar pattern extends to all new controls (disabled while generating) |
| error | Frames/Repeat numeric fields | ✅ covered | Inline error under field, `#a12f37` 12px, strict-regex validation mirroring `parseCount`; confirm disabled while invalid (existing pattern) |
| long-text | Script name / summary in panel | ✅ covered | Existing ellipsis convention (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on panel copy) applies to the two-line summary |
| overflow | Dialog content with all options visible | 🧪 backstop | Dialog content column is `overflow-y: auto` (existing); verify at native UAT that mode + override + Motion + Hold Loop + readout all fit/scroll cleanly at minimum window size |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized (Preact project; no `components.json`) |
| third-party | none | not applicable — no third-party registries declared; zero new dependencies in this phase |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
