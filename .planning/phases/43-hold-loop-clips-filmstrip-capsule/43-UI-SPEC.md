---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-06
---

# Phase 43 — UI Design Contract

> Visual and interaction contract for the linked Loop Clip filmstrip capsule (main editor timeline), the Play Script dialog loop-edit and source-edit modes, the apply-time Link/Create choice, and the additive Studio workflow-strip link badge.
> Preact + Tauri desktop app. No new design system: the capsule draws on the existing canvas `TimelineRenderer` physic-paint FX row; the dialog modes reuse the Phase 42 approved `--ps-*` modal token set verbatim; the Studio strip badge extends the Phase 36.15 cell palette additively (D-18).

**Sources:** 43-CONTEXT.md D-01..D-32 (locked user decisions — all capsule presentation semantics, dialog modes, copy, and guard rails), `.planning/REQUIREMENTS.md` HOLD-01..06, `.planning/ROADMAP.md` §"Phase 43" (capsule ships WITH the resolver — never split), `42-UI-SPEC.md` (approved modal tokens/typography/metrics, reused verbatim), `app/src/index.css` theme tokens, `TimelineRenderer.ts` canvas conventions (`getThemeColors()`, hardcoded functional colors, `600 10px system-ui` marker labels, `#F5A623` real-key diamonds), `physicsPaintStudio.css` roto-cell palette. No open design questions remain; no user input was required beyond 43-CONTEXT.

**Inheritance guard:** every Play Script dialog rule from `42-UI-SPEC.md` (modal architecture D-19, compact fit, token set, typography scale, spacing metrics, focus trap, APG radiogroup pattern, generation lifecycle) applies unchanged to the loop-edit and source-edit modes. This file declares ONLY what Phase 43 adds or narrows. Where the two files would conflict, 43-CONTEXT.md D-xx decisions win.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled; shadcn not applicable — Preact, not React; no `components.json`) |
| Preset | not applicable |
| Component library | none (in-repo Preact components; canvas capsule is pure Canvas 2D paint calls in `TimelineRenderer`, zero DOM nodes per D-32) |
| Icon library | lucide-preact ^0.577.0 (existing panel convention; capsule and band use drawn glyphs only — no icon font on canvas) |
| Font | `system-ui, sans-serif` |

---

## Surfaces

| ID | Surface | Host |
|----|---------|------|
| S1 | Loop Clip filmstrip capsule (source-cycle thumbnails, repetition band/ghost cells, badge, truncation diagonal, zero-effective anchor flag) | `TimelineRenderer` physic-paint FX row (Canvas 2D) |
| S2 | Play Script dialog — loop-edit mode (Repeat + Infinity + Requested/Effective readout, `Update loop`) | `PhysicsPaintPlayScriptDialog.tsx` reusing Phase 42 `--ps-*` modal |
| S3 | Play Script dialog — source-edit mode (full dialog prefilled, affected-loop count, `Regenerate source cycle`) | same modal shell |
| S4 | Apply-time source-cycle choice (`Link to existing cycle` / `Create new cycle`) | inside the Phase 42 modal, shown only when an identical source cycle exists (D-05) |
| S5 | Studio workflow strip — additive link badge on linked repetition cells | `PhysicsPaintWorkflowStrip.tsx` / `physicsPaintStudio.css` |
| S6 | Guarded rejection / preflight surfaces (Delete-key rejection, source-key deletion rejection, single-key drag + Force Spacing rejection, batch preflight shorten warning, export-blocked error) | existing guarded-operation + dialog/preflight idioms (Phase 36.15 guarded-icon, Phase 42 footer/preflight conventions) |

---

## Color

### S1 — Timeline canvas capsule (Canvas 2D)

Canvas colors follow the existing `TimelineRenderer` split: theme-derived via `getThemeColors()` where a CSS variable exists, hardcoded functional constants where the color is a high-visibility functional signal. New additive entries only; no existing token or cell color changes.

| Element | Value | Source / Notes |
|---------|-------|----------------|
| Source-cycle cell border | `rgba(255, 255, 255, 0.22)` | matches existing inactive Play Script marker outline |
| Source-cycle real-key diamond | `#F5A623` fill, no stroke | existing convention (C-04) — unchanged; ONLY source keys keep diamonds (D-23) |
| Repetition band base | `rgba(255, 255, 255, 0.05)` over `colors.fxTrackBg` | new constant `LOOP_BAND_BASE` |
| Repetition band hatch | `rgba(255, 255, 255, 0.14)`, 45° diagonal, 4px period, 1px lines | new constant `LOOP_BAND_HATCH` (perforated/hatched band, D-16 default zoom) |
| Ghost cell fill (high zoom) | `rgba(255, 255, 255, 0.06)` | new constant `LOOP_GHOST_FILL` — visually lighter than source cells, no thumbnails (D-16) |
| Ghost cell border | `rgba(255, 255, 255, 0.24)`, 1px dashed | new constant `LOOP_GHOST_BORDER`; ghost cells never show diamonds, never key-selectable (D-23) |
| Capsule outline (idle) | `rgba(255, 255, 255, 0.22)`, 1px, radius = half row-height pill | matches existing marker outline idiom |
| Capsule outline (hover raise) | `rgba(255, 255, 255, 0.50)`, 1.5px | D-23 hover = raise + tooltip |
| Capsule outline (selected) | `colors.accent` (`--color-accent` `#2D5BE3`), 2px around the WHOLE capsule | D-23 selection unit = the loop object |
| Keyboard focus ring | `colors.accent`, 2px with 2px offset | matches dialog `:focus-visible` convention |
| Disabled / stale | whole capsule at 55% opacity + reason tooltip | D-23 |
| Error (unresolvable source refs) | `--color-usage-badge-red` `#FF4444` (canvas fallback `#FF4444`), 2px outline + error tooltip | D-23/D-31; existing semantic red; capsule NEVER silently disappears |
| Truncation diagonal | `#FFB020`, 1.5px | new hardcoded functional constant `LOOP_TRUNCATION_COLOR` — amber/warning tone (D-21); deliberately distinct from playhead `#E55A2B`, real-key diamond `#F5A623`, accent `#2D5BE3`, and all cell fills |
| Badge pill fill | `rgba(13, 13, 13, 0.85)` | derived from `colors.fxHeaderBg` family |
| Badge text | `rgba(255, 255, 255, 0.85)` | matches inactive marker label tone |
| Zero-effective anchor flag | fill `--color-text-muted` `#666666`, `0f` text `--color-text-primary` `#E8E8E8` | D-22 greyed pill; always visible, never invisible |
| Placeholder frame (unavailable source, preview/playback) | existing `PLACEHOLDER_BG_A #1A1A2A` / `PLACEHOLDER_BG_B #1A2A1A` pattern | D-28 marked, visible, non-blocking |

### S2/S3/S4 — Play Script dialog modes

Reuse the Phase 42 `--ps-*` oklch token set **verbatim and complete** (`42-UI-SPEC.md` §Color): `--ps-surface/raised/inset/foot/fg/muted/faint/border/accent/accent-hi/ok/error/radius`. No new dialog tokens. Accent remains reserved for exactly the Phase 42 list PLUS the loop-edit primary action `Update loop` and the source-edit confirmation `Regenerate source cycle` (both render as the same accent primary button style as `Generate`). The apply-time Link/Create choice (S4) renders as a segmented control using the existing `.physics-paint-play-script-mode-group` pattern — checked segment in `--ps-accent`, no new color.

### S5 — Studio workflow strip link badge (additive, D-18)

| Element | Value |
|---------|-------|
| Link border | `box-shadow: inset 0 0 0 1px rgba(45, 91, 227, 0.9)` (accent-derived) on linked repetition cells — inset only, zero geometry change |
| Link corner dot | 4px filled circle, `--color-accent #2D5BE3`, positioned top-right inside the cell with 2px offset |
| Cell palette | UNCHANGED — empty `#4d535a`, cached `#2d6f48`, generated `#365ed6`, background-only hatch (Phase 36.15 legend). The badge is strictly additive; no new first-class cell state, no palette redefinition |

**60/30/10:** dark FX-track surfaces dominate (~60%); capsule structure (band base/hatch, ghost cells, outlines) forms the secondary layer (~30%); accent and functional signal colors (selection outline, focus ring, truncation amber, error red, link badge) are the ~10% — each reserved to its declared element only.

---

## Typography

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Capsule badge / `0f` marker | 10px | 600 | n/a (canvas, `textBaseline: middle`) | `Cycle 5f × 5 = 25f` family; `system-ui, sans-serif`, `font-variant-numeric: tabular-nums` — matches existing `600 10px system-ui` marker label convention |
| Tooltip body | existing tooltip scale | 400 | flat-multiline (Phase 38 convention — one fact per line, no rich formatting) | repeat-occurrence, truncation, zero-effective, and error tooltips |
| Dialog (S2/S3/S4) | Phase 42 scale verbatim | 400/600/650 | Phase 42 | modal title 15px/650, section title 12px/650, buttons 12.5px/650, field label 11.5px/600, body/helper 12px/400, hint 11px/400, note 10.5px/400 |

No new type sizes or weights are introduced anywhere in this phase.

---

## Spacing Scale

Global 8-point scale (4/8/16/24/32/48/64) confirmed; dialog metrics reuse the locked Phase 42 compact metrics verbatim. Canvas capsule geometry is frame-grid-derived (frameWidth × frames), not token-driven.

Declared capsule metrics (multiples of 4 unless noted):

| Element | Value |
|---------|-------|
| Capsule pill radius | half of the FX-row marker band height (existing marker idiom — `roundRect` with `rangeH / 2`) |
| Badge pill | height 16px, horizontal padding 8px, corner radius 8px, 4px inset from capsule start; clipped to the visible capsule range like existing marker labels |
| Badge text inset | 4px left minimum, matching existing `labelX` clamp convention |
| Band hatch period | 4px |
| Ghost cell border dash | 4px dash / 4px gap |
| Truncation diagonal | spans the full capsule band height; 1.5px stroke |
| Zero-effective anchor flag | ~6px-high slim pill (locked D-22 approximate marker — declared exception to the multiples-of-4 rule, matching the playhead-triangle marker exception), width 24px, `0f` text centered; pinned at the loop's canonical start frame |
| Studio link dot | 4px diameter, 2px top-right inset |

Exceptions: anchor-flag ~6px height (D-22, approximate marker glyph, not layout spacing); Phase 42 dialog metrics (locked, inherited).

**Zoom-adaptive repetition rendering (D-16, prescriptive thresholds):**

| Zoom band | frameWidth | Rendering |
|-----------|-----------|-----------|
| High | ≥ 16px | Repetitions expand into ghost linked cells (fill `LOOP_GHOST_FILL`, dashed border, no thumbnails, no diamonds) |
| Default | 8px – 15px | Compact perforated/hatched band (`LOOP_BAND_BASE` + `LOOP_BAND_HATCH`) + badge |
| Low | < 8px | Solid band + badge only; badge text truncates via the existing `truncateText` path and hides below the existing 18px label minimum |

The truncation diagonal draws at every zoom: at high/default zoom it lands mid-ghost-cell for a partial cycle and exactly on a cycle boundary for complete cycles; at low zoom it still draws on the band end (D-21).

---

## Copywriting Contract

English only. All capsule/badge/tooltip copy locked verbatim by 43-CONTEXT D-13/D-17/D-19/D-20/D-22; the earlier French truncation label is SUPERSEDED and must not ship; `clip bloquant` never appears in any language (D-20).

| Element | Copy |
|---------|------|
| Badge — finite | `Cycle {N}f × {R} = {D}f` (e.g. `Cycle 5f × 5 = 25f`; single cycle `Cycle 5f × 1 = 5f`) |
| Badge — infinity | `Cycle {N}f × ∞` (never `Infinityf`) |
| Truncation label | `Loop shortened by next clip` |
| Capsule tooltip — truncated | `{Badge} · Requested {R}f · Effective {E}f · Loop shortened by next clip ({partial cycle \| complete cycles}) · {Progressive \| Static / Hold}` |
| Repeat-occurrence tooltip | `Repeat {n} · Source frame {i} of {N}` (e.g. `Repeat 3 · Source frame 2 of 5`) — plus a separate seek action that moves to the modulo-resolved source frame (D-17) |
| Zero-effective tooltip | `Cycle {N}f × {R} = {D}f · Effective 0f — fully shortened by the next clip` |
| Error tooltip (unresolved refs) | lists the missing source references, one per line, then: `Repair, relink, unlink, or delete the loop.` |
| Disabled/stale tooltip | `{reason}` — one plain sentence |
| Loop-edit dialog title | `Edit Loop Clip` (range readout right: `F{start} · Cycle {N}f`) |
| Loop-edit primary CTA | `Update loop` |
| Loop-edit secondary action | `Edit source cycle…` |
| Source-edit dialog title | `Edit Source Cycle` |
| Source-edit notice | `Confirming regenerates the source cycle and updates every linked Loop Clip referencing it.` — when shared: `This source cycle is shared by {N} loops.` |
| Source-edit confirmation CTA | `Regenerate source cycle` |
| Apply-time choice (S4) | `Link to existing cycle` / `Create new cycle` |
| Capsule action | `Duplicate linked loop` |
| Capsule action | `Unlink loop` |
| Capsule action | `Delete loop` |
| Delete-key rejection (verbatim, D-13) | `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.` |
| Source-key deletion rejection (D-07) | `This key belongs to a source cycle used by {N} linked loop(s). Unlink the loop(s) before deleting it.` |
| Single-key drag / Force Spacing rejection (D-11) | `Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.` |
| Batch preflight warning (D-06, verbatim pattern) | `This operation will shorten {N} linked loop(s), starting at frame {F}.` |
| Export-blocked error (D-28) | `Export blocked — Loop Clip at frame {S} references a missing source frame ({F}). Repair or unlink the loop, then export again.` |
| Empty state | none — a timeline without Loop Clips renders no capsule and no placeholder; the Scripts panel is unchanged from Phase 42 |
| Destructive confirmation | none — `Delete loop` is unlink-only and non-destructive by construction (D-03); `Update loop`, `Unlink loop`, and `Duplicate linked loop` are each one atomic undoable operation (D-10, D-05) |

---

## Interaction Contract

| Control | Contract |
|---------|----------|
| Capsule badge click | Reopens the Play Script dialog in loop-edit mode targeting that loop (D-01). Loop-edit mode exposes ONLY Repeat + Infinity plus the Requested/Effective readout; Frames-per-cycle and all source fields are locked (rendered disabled at reduced opacity, values preserved). Primary `Update loop`, secondary `Edit source cycle…` |
| Source-edit mode | Full Play Script dialog prefilled with the source cycle's current mode, Frames per cycle, color, and Motion values; shows the affected-loop notice (and shared count); confirmation `Regenerate source cycle` reuses the existing staged atomic commit, capacity, authority, cancellation, Undo/Redo path (D-02). Cancel changes nothing; after success all linked loops re-resolve requested/effective duration and truncation |
| `Duplicate linked loop` | Prompts for a destination start frame, validates same-start collision and overlap per D-14, creates a new Loop Clip sharing the source cycle with NO regeneration; one atomic undoable operation (D-05) |
| `Delete loop` | Unlink-only: the loop record is removed; source-cycle real keys remain as ordinary Roto keys (D-03) |
| Loop movement | No independent loop drag (D-04). The existing Phase 37 rigid group drag on source keys moves the loop. Single-key drag and Force Spacing on linked source keys are rejected with the locked reason (D-11) |
| Same-start collision | Rejected, or routed through an explicit replace/update flow — never resolved by hidden creation-order priority (D-14) |
| Hover | Outline raise + tooltip (D-23) |
| Selection | 2px accent outline around the whole capsule; the loop object is the selection unit (D-23) |
| Keyboard | Capsule is keyboard-focusable in timeline keyboard nav with the visible accent focus ring (D-23); in dialogs, Phase 42 focus-trap and `Escape`/`Enter` conventions apply unchanged |
| Paint/erase on a linked repetition frame | Materializes a local real key (loop-resolved pixels + new stroke); the new key becomes the next-clip boundary and the loop shortens; canvas and playhead stay put; one Undo removes the key and the loop re-expands (D-12). No confirmation UI |
| Clear vs Delete on a linked repetition frame | Clear materializes a local empty real key (loop shortens, atomic undoable); Delete-key is rejected with the verbatim D-13 message (D-13) |
| Re-expansion | Moving/removing blocking content or a later loop re-expands the capsule automatically with no regeneration and no UI prompt (D-08, D-14, D-25) |
| Generation lifecycle (S3) | Identical to Phase 42: inputs disabled during regeneration, `Cancel generation` replaces `Cancel`, footer progress, failure shows `--ps-error` inline and leaves no partial state |

---

## UI Considerations

> State coverage across 6 surfaces: S1 capsule, S2 loop-edit dialog, S3 source-edit dialog, S4 Link/Create choice, S5 Studio link badge, S6 guard/preflight/export surfaces.

Applicable state considerations resolved: 14 covered, 0 backstops, 6 dismissed, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | S1 capsule | ✅ covered | No Loop Clips → nothing rendered; no placeholder, no legend change. Zero-effective loop (Effective = 0f) renders the D-22 greyed anchor flag with `0f` marker — never invisible |
| empty / first-open | S2 loop-edit dialog | ✅ covered | Opens prefilled from the loop record (Repeat, Infinity); readout derived from the canonical resolver — never blank |
| populated | S1 source-cycle cells | ✅ covered | Real thumbnails from the existing downscaled cache path (D-15); diamonds per existing convention |
| partial | S1 truncation | ✅ covered | Amber diagonal + tooltip `(partial cycle)` vs `(complete cycles)` (D-21); badge never changes on truncation (D-19) |
| partial | S6 preflight | ✅ covered | Batch operations that will shorten loops surface the locked preflight line before confirm (D-06); commit + derived shrink stay one undoable outcome |
| overflow / zoom | S1 capsule | ✅ covered | Three zoom bands with declared frameWidth thresholds (high/default/low, D-16); badge truncates via `truncateText` below 18px minimum; diagonal draws at every zoom |
| overflow | S2/S3 dialogs | ✅ covered | Phase 42 compact-fit contract inherited: all rows visible at minimum window size, no scrollbars, no clipped content |
| long-text | S1 badge, tooltips | ✅ covered | Badge copy is fixed compact math forms; canvas label truncation reuses `truncateText`; tooltips are flat-multiline with fixed forms |
| error | S1 capsule, S6 export | ✅ covered | Unresolvable source refs → red outline + error tooltip listing missing refs; records preserved verbatim, repair/relink/unlink/delete-loop offered (D-23/D-31); preview shows marked placeholders (non-blocking), export BLOCKED with the locked error naming loop and frame (D-28) |
| error | S6 guarded operations | ✅ covered | Delete-key, source-key deletion, single-key drag, and Force Spacing rejections are fail-closed with locked reason copy (D-07/D-11/D-13) — existing guarded-operation idiom |
| disabled | S2 locked fields, S6 guarded actions | ✅ covered | Locked source fields render disabled at reduced opacity with values preserved; guarded actions follow the Phase 36.15 guarded-icon convention with reason tooltips |
| stale | S1 capsule | ✅ covered | Missing/stale source keyIds keep the capsule visible (error outline or zero/error marker) with the unresolved record intact across save/reopen (D-31) — never silently dropped |
| loading / busy | S3 regeneration | ✅ covered | Reuses the Phase 42 generation-in-progress lifecycle verbatim (disabled inputs, `Cancel generation`, footer progress) |
| zero-one-many | S3 affected-loop notice | ✅ covered | Shared-source count shown only when N > 1 (`This source cycle is shared by {N} loops.`); single-loop case shows the base notice |
| loading | S1, S2, S4, S5 | ✖ dismissed | Capsule and badge render synchronously from resolver output and cache thumbnails; dialogs render from controller signals — no async load path on these surfaces |
| empty | S4 | ✖ dismissed | The Link/Create choice renders only when an identical source cycle exists — it is never an empty surface |
| error | S2 | ✖ dismissed | Loop-edit mode has no invalid-input path beyond the inherited Repeat validation (`Enter a positive integer.`) |
| long-text | S3, S4 | ✖ dismissed | All copy is locked short fixed strings with `{N}`/`{F}` numeric slots |
| partial | S2 | ✖ dismissed | Requested/Effective readout always fully derivable from the loop record + resolver |
| overflow | S5 | ✖ dismissed | Badge is inset-only on fixed 18px×24px cells — no layout impact |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized (Preact project; no `components.json`) |
| third-party | none | not applicable — zero new dependencies in this phase |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
