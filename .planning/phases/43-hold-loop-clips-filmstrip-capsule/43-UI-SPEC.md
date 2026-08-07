---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
status: approved
reviewed_at: 2026-08-07
shadcn_initialized: false
preset: none
created: 2026-08-06
revised: 2026-08-07
revision_reason: native UAT host-surface correction
---

# Phase 43 — UI Design Contract

> Visual and interaction contract for linked Loop Clips inside the EFX Paint/Roto physical-frame workflow, plus the existing Play Script loop/source edit modes, Link/Create choice, linked-cell badge, guards, and export errors.
> This revision supersedes the approved 2026-08-06 contract wherever that contract placed Loop Clip authoring on the Motion Editor main timeline.

**Primary source:** `43-CONTEXT.md` D-33..D-40 and its carried-forward D-01..D-32 decisions. Supporting sources: `.planning/REQUIREMENTS.md` HOLD-01..06, `.planning/ROADMAP.md` Phase 43, `43-UAT.md` Step 1 failure evidence, `42-UI-SPEC.md` for the approved Play Script dialog, and the existing EFX Paint workflow-strip palette and geometry.

**Ownership boundary:** EFX Paint/Roto is the only Loop Clip visualization and authoring surface. The Motion Editor main timeline renders no Loop Clip capsule, tooltip, selection target, keyboard target, badge, or loop action. It remains a preview/playback/save/export consumer of the canonical physical-frame document only.

**Inheritance guard:** every valid Play Script dialog rule from `42-UI-SPEC.md` remains unchanged for S2–S4: compact fixed dark modal, `--ps-*` token set, typography, spacing, focus trap, APG segmented controls, validation, progress, cancellation, and atomic failure behavior. This file specifies only Phase 43 additions and the corrected EFX host.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — hand-rolled in-repo Preact UI; no `components.json` |
| Preset | not applicable |
| Component library | none; reuse the existing EFX Paint workflow strip, styled tooltip/popover idiom, and Play Script modal |
| Icon library | `lucide-preact` ^0.577.0 for local popover actions where an icon is already used; filmstrip capsule meaning must not depend on icons |
| Font | `system-ui, sans-serif` |

No new UI dependency, registry, global token family, or parallel dialog/tooltip system is introduced.

---

## Surfaces

| ID | Surface | Host and responsibility |
|----|---------|-------------------------|
| S1 | Dedicated Loop Clip lane with filmstrip capsules | Inside the EFX Paint workflow strip, immediately above the existing physical-frame cells, sharing their horizontal frame grid and scroll position |
| S1a | Local Loop Clip occurrence popover | EFX Paint-local anchored popover opened from a capsule body; shows occurrence facts and applicable loop actions |
| S2 | Play Script dialog — Loop Edit mode | Existing EFX Paint Play Script modal; Repeat, Infinity, Requested/Effective, `Update loop`, `Edit source cycle…` |
| S3 | Play Script dialog — Source Edit / Repair mode | Existing EFX Paint Play Script modal, prefilled from source provenance; `Regenerate source cycle` |
| S4 | Apply-time source-cycle choice | Existing Play Script modal; `Link to existing cycle` / `Create new cycle` when a compatible source exists |
| S5 | Additive linked-occurrence treatment on Roto cells | Existing EFX Paint physical-frame cells retain their palette and geometry, with the already-defined inset link border and corner dot |
| S6 | Guard, preflight, placeholder, and export-error surfaces | Existing EFX Paint guarded-action/status idioms, preview placeholder, Play Script preflight, and export error path |

### S1 placement and geometry

- The Loop Clip lane is a separate range-object lane. It is never merged into the Roto cell row and never overlays the cells' pointer targets.
- The lane appears only when at least one Loop Clip record exists, including unresolved and zero-effective records.
- With zero Loop Clips, the lane has no DOM/layout footprint and the current workflow-strip geometry remains exactly unchanged: 161px total strip height, 28px ruler, 38px physical lane, 34px action row, and 14px scrollbar.
- With one or more Loop Clips, insert a 32px lane between the ruler and the 38px physical lane and expand the workflow-strip region by exactly 32px to 193px. The canvas region yields this space; no content overlaps, clips, or becomes internally scrollable vertically.
- Lane background is `#303335`, separated from the physical lane by a 1px bottom border `#5c6066`. Capsule visual height is 24px with 4px top and bottom clearance.
- Frame pitch and origin are identical to the Roto cells. At the current EFX strip pitch, one frame is 18px. The lane and cells move through the same horizontal scroller; there is one scrollbar and one scroll position.
- The lane has no visible fixed label that would offset frame 0 or cover a capsule. Its accessible name is `Loop Clips`.
- The playhead/current-frame alignment, if visually projected through the strip, crosses both lanes at the same x-coordinate. The Loop Clip lane must not create a second cursor or independent scroll state.

### S1 capsule composition

From left to right, every non-zero capsule contains:

1. **Source-cycle region:** one frame-aligned thumbnail cell per ordered source frame. Original source cells backed by real keys may show the existing real-key diamond. A duplicated loop placed away from its source uses the shared thumbnails with linked/dashed treatment and no diamond.
2. **Linked-repetition region:** every destination after the first cycle is virtual and visually subordinate. It never receives a real-key diamond or independent durable thumbnail asset.
3. **Compact math badge:** overlays the capsule near its visible leading edge without changing frame geometry.
4. **Trailing truncation edge:** amber forward-leaning diagonal when Effective is shorter than Requested.

A zero-effective record renders a visible anchor flag at `placementStart` instead of the full capsule.

### Responsive/zoom behavior

The capsule responds to the host's effective frame pitch; this phase adds no new zoom control.

| Zoom band | Effective frame pitch | Linked-repetition rendering |
|-----------|-----------------------|-----------------------------|
| High | ≥16px/frame | Individual lighter ghost cells, 1px dashed borders, no thumbnails, no diamonds |
| Default | 8–15px/frame | Compact perforated/hatched band plus badge |
| Low | <8px/frame | Solid compact band plus badge; badge truncates or hides cleanly when it cannot fit |

The existing 18px EFX frame pitch therefore uses the High presentation by default. The source-cycle thumbnails remain the first visual anchor where space permits. The truncation diagonal remains visible in every zoom band.

---

## Spacing Scale

Declared global values: 4, 8, 16, 24, 32, 48, 64px. Existing Phase 42 modal metrics remain inherited exceptions.

| Token / metric | Value | Usage |
|----------------|-------|-------|
| xs | 4px | Lane vertical clearance, capsule internal micro-gaps |
| sm | 8px | Badge horizontal padding, popover action spacing |
| md | 16px | Popover content padding, section separation |
| lg | 24px | Capsule visual height; minimum interactive height for the zero-effective anchor |
| xl | 32px | Added Loop Clip lane height |
| 2xl | 48px | Major layout separation only; not introduced inside the compact strip |
| 3xl | 64px | Page-level spacing only; not introduced inside the strip |
| Frame pitch | 18px currently | Shared Loop Clip and Roto frame grid; not independently adjustable by the lane |
| Capsule radius | 6px | Compact rounded range object; not a full-height pill |
| Badge | 16px height, 8px horizontal padding, 8px radius | Compact math badge, clipped to the visible capsule bounds |
| Truncation diagonal | 1.5px stroke | Full 24px capsule height |
| Popover | 8px gap from anchor, 8px radius, 16px padding, 8px row gap | Reuse compact EFX floating-surface rhythm |
| Popover min/max width | 260px / 320px | Facts remain readable without covering excessive timeline width |
| Zero-effective visible flag | 6px high × 24px wide | Visual marker centered in a 24×24px interactive control |

**Exceptions:** 1px borders, 1.5px truncation stroke, 2px focus offset, 6px visible zero-effective glyph, and the existing 18px frame pitch are functional geometry, not layout-spacing tokens.

---

## Typography

Exactly four size roles and two normal weights are used by the new EFX lane/popover. The inherited Phase 42 modal retains its already-approved scoped type scale.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Micro | 10px | 600 | 1.2 | Capsule badge, `0f`, compact metadata |
| Label | 11px | 600 | 1.2 | Popover labels and action text |
| Body | 12px | 400 | 1.5 | Popover values, helper/error detail |
| Heading | 14px | 600 | 1.2 | Popover title `Loop Clip` |

- Font is `system-ui, sans-serif`.
- Badge, frame, duration, repeat, and source-index values use `font-variant-numeric: tabular-nums`.
- Badge text is single-line. Popover detail and error reference lists may wrap; action labels do not wrap.
- No uppercase body copy. If implementation needs a visually hidden lane label, its accessible copy remains title case: `Loop Clips`.

---

## Color

### 60/30/10 contract

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#37393A` / surrounding `#3E3F41` | Existing workflow-strip and physical-lane surfaces |
| Secondary (30%) | Loop lane `#303335`, popover `#20262D`, band/ghost neutrals | Separate Loop Clip range layer, capsule structure, floating details |
| Accent (10%) | `#2D5BE3` | Selected capsule outline, keyboard focus ring, badge-active affordance, existing linked-cell border/dot only |
| Warning | `#FFB020` | Truncation diagonal and truncation emphasis only |
| Error | `#FF4444` | Unresolved capsule outline and error emphasis only |
| Destructive | existing EFX destructive red family (`#FF9999` text / red border treatment) | `Delete loop` action only; not the capsule's idle state |

**Accent reserved for:** selected Loop Clip outline, focus-visible ring, badge hover/focus affordance, and the existing additive linked-cell border/dot. Accent is not used for every popover action, ordinary body text, thumbnails, or the truncation state.

### S1 capsule palette

| Element | Value | Contract |
|---------|-------|----------|
| Source thumbnail border | `rgba(255,255,255,0.22)` | Neutral cell separation |
| Real source-key diamond | `#F5A623` | Existing real-key convention; source-backed cells only |
| Duplicated first-cycle border | `rgba(255,255,255,0.24)`, 1px dashed | Shared source image at a virtual placement; no diamond |
| Repetition band base | `rgba(255,255,255,0.05)` | Secondary structure over the loop lane |
| Repetition hatch | `rgba(255,255,255,0.14)`, 45°, 4px period | Default zoom only |
| High-zoom ghost fill | `rgba(255,255,255,0.06)` | Repeated linked cells |
| High-zoom ghost border | `rgba(255,255,255,0.24)`, 1px dashed | Repeated linked cells |
| Idle capsule outline | `rgba(255,255,255,0.22)`, 1px | Quiet range boundary |
| Hover outline | `rgba(255,255,255,0.50)`, 1.5px | Paint-only hover raise |
| Selected outline | `#2D5BE3`, 2px | Whole Loop Clip object |
| Focus ring | `#2D5BE3`, 2px with 2px offset | Focus-visible only |
| Badge fill | `rgba(13,13,13,0.88)` | Math badge surface |
| Badge text | `rgba(255,255,255,0.88)` | Compact math |
| Truncation | `#FFB020`, 1.5px | Forward diagonal across full capsule height |
| Unresolved | `#FF4444`, 2px outline | Never hidden by selection or hover |
| Stale/temporarily unavailable | whole capsule 55% opacity | Reason remains available in popover |
| Zero-effective flag | `#666666` fill, `#E8E8E8` text | Visible `0f` anchor |

### S1a popover palette

- Surface `#20262D`; border `#69727C`; primary text `#E5EDF8`; secondary text `#AEB5BE`.
- Ordinary actions use the existing neutral compact-button treatment. `Edit source frame` is the first action but not a large accent button.
- `Delete loop` uses the existing destructive action treatment. `Unlink loop` remains neutral because it is unlink-only and source-preserving.
- Unresolved reference lines use `#FF9999`; repair/relink actions remain actionable neutral controls rather than red-filled buttons.

### S2/S3/S4

Reuse the complete Phase 42 `--ps-*` token set verbatim. Accent adds only `Update loop` and `Regenerate source cycle` as primary modal actions. No new dialog colors are introduced.

### S5 linked-cell treatment

Retain the existing inset accent border `rgba(45,91,227,0.9)` and 4px top-right dot. Existing empty/cached/generated/background-only fills and all current/selected/drag outlines remain unchanged.

---

## Copywriting Contract

English only. The earlier French truncation copy is superseded. The term `clip bloquant` must not appear in any language.

| Element | Copy |
|---------|------|
| Badge — finite | `Cycle {N}f × {R} = {D}f` |
| Badge — infinity | `Cycle {N}f × ∞` |
| Truncation label | `Loop shortened by next clip` |
| Local popover title | `Loop Clip` |
| Popover placement fact | `Starts at F{start}` |
| Popover requested/effective fact | `Requested {R}f · Effective {E}f` |
| Popover mode fact | `{Progressive | Static / Hold}` |
| Occurrence fact | `Repeat {n} · Source frame {i} of {N}` |
| Truncation fact | `Loop shortened by next clip ({partial cycle | complete cycles})` |
| Zero-effective fact | `Cycle {N}f × {R} = {D}f · Effective 0f — fully shortened by the next clip` |
| Unresolved fact | Missing source references, one per line, followed by `Repair, relink, unlink, or delete the loop.` |
| Popover action | `Edit source frame` |
| Popover action | `Duplicate linked loop` |
| Popover action | `Unlink loop` |
| Popover action | `Delete loop` |
| Popover action — unresolved only | `Repair loop…` |
| Popover action — unresolved with compatible source | `Relink loop…` |
| Loop-edit dialog title | `Edit Loop Clip` |
| Loop-edit primary CTA | `Update loop` |
| Loop-edit secondary action | `Edit source cycle…` |
| Source-edit dialog title | `Edit Source Cycle` |
| Source-edit notice | `Confirming regenerates the source cycle and updates every linked Loop Clip referencing it.` |
| Shared-source notice | `This source cycle is shared by {N} loops.` |
| Source-edit primary CTA | `Regenerate source cycle` |
| Apply-time choices | `Link to existing cycle` / `Create new cycle` |
| Link helper | `Reuses the existing source cycle. Future source edits update every linked loop.` |
| Create helper | `Creates an independent source cycle. Future edits do not affect the existing loops.` |
| Source-key deletion rejection | `This key belongs to a source cycle used by {N} linked loop(s). Unlink the loop(s) before deleting it.` |
| Single-key drag / Force Spacing rejection | `Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.` |
| Linked-frame Delete rejection | `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.` |
| Batch preflight | `This operation will shorten {N} linked loop(s), starting at frame {F}.` |
| Preview placeholder | `Loop source missing` |
| Export-blocked error | `Export blocked — Loop Clip at frame {S} references a missing source frame ({F}). Repair or unlink the loop, then export again.` |
| Empty state | None. With no Loop Clips, the lane is absent and existing EFX geometry remains unchanged. |
| Destructive confirmation | None. `Delete loop` and `Unlink loop` remove only the link record, preserve source keys, and remain atomic Undo/Redo operations. |

---

## Interaction Contract

### Ownership and selection separation

- Capsule interaction occurs only in the dedicated EFX Loop Clip lane.
- A Loop Clip selection is a lane-local range-object selection. It does not mutate, collapse, extend, or replace the existing real-key selection set.
- Existing Roto cells below retain their exact contracts: plain click navigates; real-key modifier clicks select; Shift extends selection; multi-select and single/group drag remain unchanged.
- Linked Roto cells remain navigation cells with additive link styling. They never become Loop Clip selection targets and never expose loop actions.
- Opening or closing a Loop Clip popover does not move the playhead. Only `Edit source frame` intentionally navigates to and selects the modulo-resolved real source key.

### Capsule controls

| Control | Contract |
|---------|----------|
| Capsule body | Selects the whole Loop Clip object and opens the local occurrence popover anchored to the clicked capsule segment. The popover reports the clicked occurrence/source index when derivable. No automatic frame navigation. |
| Compact badge | Opens the existing Play Script dialog directly in Loop Edit mode for that Loop Clip. It does not first open the occurrence popover. |
| Truncation edge | Part of the capsule-body target; opens the popover with truncation fact and partial/complete-cycle wording. |
| Zero-effective anchor | Same body behavior as a normal capsule; visible glyph 6px high, interactive target 24×24px inside the dedicated lane. |
| Outside click | Closes the popover and clears lane-local selection emphasis; Roto key selection remains unchanged. |
| Escape | Closes the local popover and returns focus to the capsule body. If the Play Script modal is open, the inherited modal Escape contract applies. |
| Tab | Uses ordinary DOM order among visible capsule body controls and their badge controls, then continues through the existing EFX strip. No virtual canvas focus model is introduced. |
| Enter / Space | Activates the focused body or badge exactly like pointer click. |
| Delete / Backspace while capsule focused | No Loop Clip shortcut. Do not intercept these keys for the lane; deletion is available through the explicit `Delete loop` popover action so Roto keyboard semantics are not overloaded. |

Each visible capsule exposes two keyboard-reachable controls: body and badge. The body accessible name includes badge math plus Requested/Effective status; the badge accessible name is `Edit Loop Clip — {badge}`. Ghost cells are visual subdivisions, not separate Tab stops.

### Local occurrence popover (S1a)

- Popover is inside EFX Paint, anchored within the workflow strip viewport, and repositions horizontally to stay visible.
- It opens on body click or body Enter/Space. Hover alone may show a short styled tooltip, but hover never opens the actionable popover.
- Facts appear before actions in this order: badge math; start; Requested/Effective; mode; clicked occurrence; truncation or unresolved detail.
- Action order is prescriptive:
  1. `Edit source frame`
  2. `Duplicate linked loop`
  3. `Repair loop…` when unresolved and provenance supports repair
  4. `Relink loop…` when unresolved and a compatible source exists
  5. `Unlink loop`
  6. `Delete loop`
- Inapplicable actions are omitted rather than shown disabled. Busy/mutation-locked actions may remain visible with `aria-disabled="true"` and the existing styled reason tooltip; they must not silently no-op.
- After an accepted Duplicate/Repair/Relink/Unlink/Delete operation, close the popover and update the lane from accepted authority state. On rejection, keep it open, retain selection/focus, and show the controller-provided reason.
- `Duplicate linked loop` requests a destination start using the existing local EFX interaction/dialog idiom; same-start collision and invalid overlap reject explicitly. It never regenerates source assets.
- `Unlink loop` and `Delete loop` are equivalent in data effect (unlink-only) but retain their locked visible labels and atomic Undo/Redo behavior.

### Loop Edit and Source Edit (S2/S3)

| Mode | Contract |
|------|----------|
| Loop Edit | Exposes Repeat, Infinity, and canonical Requested/Effective readout. Frames per cycle and source-generation fields remain visible only where required for context, locked at reduced opacity with values preserved. Primary `Update loop`; secondary `Edit source cycle…`. |
| Source Edit | Full Play Script modal prefilled from source provenance. Shows the affected-loop notice and shared count when N > 1. `Regenerate source cycle` uses the existing staged progress/cancel/failure lifecycle. |
| Repair | Opens the Source Edit flow prefilled from retained provenance. Successful regeneration recreates/retargets in one atomic operation; failure leaves the unresolved record unchanged. |
| Relink | Chooses a compatible existing source cycle without regeneration. Successful relink resolves the lane and preview in one atomic operation. |

Repeat validation remains inherited: positive integer, safe product, invalid CTA disabled, Infinity preserves the last valid finite value, and the readout never shows NaN or overflow.

### Materialization, guards, and re-expansion

- Painting or erasing on a linked occurrence materializes a local real key from the resolved pixels plus the new stroke. The loop shortens at that frame; playhead and canvas remain there; one Undo removes the local key and re-expands the loop.
- Clear on a linked occurrence materializes a local empty real key and shortens the loop. Delete/Backspace rejects with the locked linked-frame copy and never touches the source or loop.
- Source-key deletion, single-key linked-source drag, and Force Spacing remain fail-closed with the locked copy.
- Moving/removing later blocking content re-expands the capsule immediately with no regeneration or prompt.
- The range lane updates Requested/Effective, truncation, unresolved state, and source thumbnails only from canonical accepted state. No optimistic geometry that disagrees with preview/export is allowed.

### Visual-state precedence

When states coincide, higher entries remain visible:

1. Unresolved/error red outline and missing-reference content
2. Keyboard focus ring
3. Selected accent outline
4. Truncation amber diagonal
5. Hover raise
6. Idle

State changes affect paint only, never frame position, width, lane height, or Roto-cell geometry. The truncation diagonal remains visible under focus and selection. Error is never replaced by selected or hover styling.

---

## UI Considerations

> State coverage across S1 Loop Clip lane/capsules, S1a local popover, S2 Loop Edit, S3 Source Edit/Repair, S4 Link/Create, S5 linked Roto cells, and S6 guard/placeholder/export surfaces.

Applicable state considerations resolved: 17 covered, 5 dismissed, 0 backstops, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | S1 lane | ✅ covered | Zero Loop Clips removes the lane's complete layout footprint; the existing 161px workflow strip and Roto geometry remain exactly unchanged |
| zero-one-many | S1 lane | ✅ covered | One or many Loop Clips share one 32px lane; capsules use frame ranges and may be clipped only by the horizontal viewport, never stacked into extra lane rows |
| populated | S1 capsule | ✅ covered | Source thumbnails lead, repetitions recede, badge remains readable, and accepted resolver geometry aligns to the same frame grid as Roto cells |
| partial | S1 truncation | ✅ covered | Amber diagonal encodes effective end; popover states partial vs complete cycles; badge continues to show Requested math |
| partial | S6 preflight | ✅ covered | Batch content operations report the locked shorten warning before confirm; accepted content plus derived shrink is one Undo outcome |
| overflow / zoom | S1 capsule | ✅ covered | Three declared frame-pitch bands; low zoom collapses detail cleanly; badge truncates/hides rather than overlapping unrelated content |
| overflow | S1a popover | ✅ covered | 260–320px floating surface repositions within the workflow viewport; body detail wraps, actions remain single-line |
| long-text | S1a unresolved detail | ✅ covered | Missing references render one per line and wrap/break safely; popover stays bounded and vertically scrolls only if the reference list exceeds the available application height |
| error | S1/S1a unresolved loop | ✅ covered | Loop remains visible with red outline; popover lists missing refs and applicable Repair/Relink/Unlink/Delete actions; no silent disappearance |
| error | S6 preview/export | ✅ covered | Preview shows the marked `Loop source missing` placeholder and continues; export fails before output with the locked actionable error |
| stale / disabled | S1/S1a | ✅ covered | Capsule stays visible at 55% opacity with reason; busy actions use `aria-disabled` plus reason and preserve focus on rejection |
| zero-effective | S1 anchor | ✅ covered | Record renders a visible `0f` flag in a 24×24px control at placement start and re-expands when the blocker moves |
| loading / busy | S3 regeneration | ✅ covered | Inherited Phase 42 progress lifecycle: inputs disabled, `Cancel generation`, no partial state, retry after failure |
| loading / busy | S1/S1a accepted operations | ✅ covered | Existing mutation lock prevents duplicate actions; lane updates from accepted authority state, not optimistic final geometry |
| zero-one-many | S3 shared count | ✅ covered | Base notice for one loop; `This source cycle is shared by {N} loops.` only when N > 1 |
| error | S2 Repeat | ✅ covered | Inherited positive-integer and safe-product validation; `Update loop` disabled while invalid; Infinity preserves/restores finite value |
| interaction separation | S1 versus S5 | ✅ covered | Loop selection/actions stay in the dedicated lane; Roto navigation, key selection, multi-select, and drag semantics remain unchanged below |
| empty | S4 Link/Create | ✖ dismissed | The choice exists only when a compatible source cycle exists; otherwise no choice surface is rendered |
| loading | S2/S4/S5 | ✖ dismissed | These surfaces render synchronously from controller/resolver state; no independent loading path |
| long-text | S2/S3/S4 | ✖ dismissed | Copy uses locked short strings and bounded numeric slots; inherited Phase 42 compact-fit rules apply |
| overflow | S5 linked-cell badge | ✖ dismissed | Inset border and 4px dot do not affect the fixed 18×24px cell geometry |
| destructive confirmation | S1a Delete/Unlink | ✖ dismissed | Both are unlink-only, preserve real source keys, and are atomically undoable; explicit action labels are sufficient |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn is not initialized |
| third-party | none | not applicable — zero new dependencies or registry blocks |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** APPROVED — independently re-verified 2026-08-07 after the native UAT host-surface correction. The Motion Editor main timeline is excluded; S1 is the hidden-when-empty dedicated EFX Paint/Roto Loop Clip lane. No recommendations remain.
