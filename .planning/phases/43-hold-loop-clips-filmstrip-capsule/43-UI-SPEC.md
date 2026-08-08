---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-07
revised: 2026-08-07
reviewed_at: 2026-08-07T21:03:55Z
revision_reason: replace rejected dedicated lane with integrated Loop Rail and contextual Scripts sidebar
---

# Phase 43 — UI Design Contract

> Canonical visual, interaction, accessibility, copy, and state contract for linked Loop Clips inside EFX Paint/Roto. This file fully replaces the rejected dedicated-lane baseline; it is not an incremental amendment.

**Primary authority:** `43-CONTEXT.md` D-33R..D-49, gathered 2026-08-07. Supporting authority: `.planning/REQUIREMENTS.md` HOLD-01..06, accepted Phase 42 Play Script modal contracts, and the existing EFX Paint workflow strip/right sidebar implementation.

**Supersession rule:** stale ROADMAP/HOLD-06 wording that requires a persistent full-filmstrip capsule, repetition band, separate Loop Clips row, permanent Cycle badge, identity-bearing main-timeline projection, or raw Loop Clip UUID is rejected. HOLD-06 authoring information remains in the compact integrated rail tooltip, local actions popover, and contextual Scripts sidebar; the Motion Editor receives only passive effective-interval visibility.

**Product ownership boundary:** Physics Paint Studio Loop Rail and Scripts inspector remain the exclusive interactive Loop Clip surfaces. The Motion Editor main timeline may paint one passive Repeat-duration marker per canonical effective interval inside the existing PPaint FX bar from interval-only data `{startFrame, frameCount}`. It receives no `loopId`, source keys, repeat metadata, status, selection state, callbacks, or commands. The marker has no Loop Clip-specific hit target, tooltip, hover/focus state, selection, keyboard target, context action, Edit, drag, navigation, or mutation; generic FX-track behavior may continue beneath the paint.

**Carried-forward guard:** all still-valid Phase 43 S2–S6 contracts remain in force: the existing `Edit Loop Clip` and `Edit Source Cycle` modal modes; Link/Create choice; blue linked-frame indicators; guarded materialization and source-key operations; unresolved preview placeholder; export block; canonical resolver; accepted-only authority updates; atomic Undo/Redo. Only the rejected persistent capsule/lane presentation and main-timeline ownership are replaced.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — existing hand-rolled Preact UI; no `components.json` |
| Preset | not applicable |
| Component library | none; reuse in-repo EFX Paint components and interaction idioms |
| Icon library | `lucide-preact`; use `Pencil` for contextual `Edit Loop Clip` |
| Font | `system-ui, sans-serif` |
| Reactive model | existing Preact Signals/controller state; no mirrored hook state or new state library |

No new design system, persisted schema, registry, UI dependency, tooltip system, modal system, or mutation path is introduced.

---

## Surfaces

**Studio focal hierarchy:** the existing canvas and current physical-frame selection remain the primary visual and interaction focus. The selected Loop Rail is the timing anchor that identifies the active linked interval without displacing that primary focus. The contextual Scripts inspector is the secondary information surface for the selected Loop Clip.

| ID | Surface | Contract |
|----|---------|----------|
| S1 | Integrated Loop Rail | 3px visible rail inside the top edge of the existing 38px physical-frame row; no new row and zero added height |
| S1a | Rail tooltip | Existing styled-tooltip idiom, placed above the rail, with name, Cycle math, Effective duration, and status |
| S1b | Local Loop Clip actions popover | EFX-local non-modal anchored surface for facts and applicable Duplicate/Unlink/Delete/Repair/Relink actions |
| S1c | Contextual Scripts sidebar | Existing Scripts tab becomes the persistent Loop Clip inspector while a loop is selected; Play slot becomes Edit |
| S2 | Edit Loop Clip modal | Existing Studio-local Play Script modal opened through `openLoopEdit(loopId)` |
| S3 | Edit Source Cycle / Repair modal | Existing source-edit/repair mode and atomic generation lifecycle |
| S4 | Apply-time Link/Create choice | Existing `Link to existing cycle` / `Create new cycle` contract |
| S5 | Linked physical-cell treatment | Preserve the accepted blue inset border and 4px top-right dot without changing cell semantics or geometry |
| S6 | Guard, placeholder, and export surfaces | Preserve accepted fail-closed guards, preview placeholder, export block, and atomic accepted-only updates |
| M1 | Motion Editor passive Repeat marker | One 3px `#8B5CF6` strip per canonical effective interval inside the existing PPaint FX bar; interval-only, textless, and non-interactive |

---

## Geometry and Layering Contract

### Existing strip geometry is immutable

The workflow strip remains exactly **161px** high:

| Existing band | Height | Phase 43 rule |
|---------------|--------|---------------|
| Workflow header | 46px | unchanged |
| Timeline top border | 1px | unchanged |
| Ruler | 28px | unchanged |
| Physical-frame row | 38px | Loop Rail is overlaid inside this existing height |
| Physical-cell action row | 34px | unchanged and unobstructed |
| Horizontal scrollbar | 14px | unchanged |

The integrated Loop Rail must not change `grid-template-rows`, workflow-strip height, timeline height, ruler height, physical-row height, action-row height, scrollbar height, frame pitch, scroll width, or canvas allocation. Removing the rejected 32px lane restores the original 161px strip in both loop and no-loop states.

### S1 rail geometry

- The rail host is an absolutely positioned child of the existing `.physics-paint-lane` or an equivalent focused wrapper that shares its containing block.
- The host spans the same **2160px** timeline content width and uses the existing **18px/frame** pitch and the same 4px scroll-leading offset as the ruler and cells.
- The visible rail is exactly **3px high**, with its top edge at `y: 0` of the 38px physical-frame row.
- Each Loop Clip segment uses canonical half-open geometry: `left = placementStart × framePitch`; `width = max(1px, (effectiveEnd - placementStart) × framePitch)` after visible-window clipping. Geometry is derived from canonical accepted ranges only.
- Each segment's transparent pointer/focus target is exactly **12px high**, positioned `top: 0`, with no visible fill outside the 3px rail.
- The target width equals the visible effective range, except an Effective `0f` loop uses a **12×12px** target centered on its placement x-coordinate.
- The target uses `cursor: pointer`. It must never use `grab`, `grabbing`, resize cursors, or pointer-capture. Future horizontal placement drag may reuse this geometry, but no drag threshold, preview, drop target, pointer capture, or placement mutation exists in this phase.
- The visible segment has a 1px end radius. It is a compact timing line, never a capsule or pill.
- The rail is absent from the DOM when the canonical Loop Clip collection is empty. No empty placeholder, label, reserved blank space, or hidden focus target remains.

### Effective 0f marker

- Effective `0f` remains visible and selectable at `placementStart`.
- Visible glyph: **8px wide × 6px high**, fully contained in the physical row's top clearance. Use a 2px vertical stem with a 6px horizontal cap aligned to the rail start, forming a compact flag rather than a capsule.
- Interactive target: **12×12px**.
- The marker participates in normal, selected, focus, warning, and unresolved styling and exposes `Effective 0f` in its accessible name and tooltip.

### Layer order and clipping

| Layer | z-index | Contract |
|-------|---------|----------|
| Physical cells and their existing fills | 0 | unchanged |
| Existing cell overlays, current/selection outlines, linked indicators | existing 1–5 local order | unchanged; the blue linked indicator remains visible |
| Transparent rail hit targets | 6 | receives events only inside the top 12px rail band |
| Visible 3px rail and 0f glyph | 7 | paint-only; `pointer-events: none` so the target owns interaction |
| Rail focus ring | 8 | visible above rail paint; must not be clipped by the timeline container |
| Local actions popover | 61 | above existing styled tooltip and below modal |
| Styled tooltip | existing 60 | viewport-fixed and above the rail |
| Play Script / Edit Loop Clip modal | existing 70 | unchanged highest Phase 43 surface |

- The rail host must use `overflow: visible`; the existing timeline viewport may continue clipping horizontally at its outer boundary.
- The rail must not set overflow on `.physics-paint-lane`, `.physics-paint-roto-cells`, `.physics-paint-roto-cell`, or the action row.
- No rail paint may extend below 6px from the physical row's top edge. The 24px cells, current-frame outline, multi-selection outline, drag previews, and action toolbar remain visually uncut.
- The 12px interaction band may structurally sit above the cell layer, but only in the defined top-edge rail band. Every point below `y: 12px` preserves the existing physical-cell pointer target. Cell keyboard focus and all full-cell programmatic activation remain unchanged.
- The rail and each rail target stop `pointerdown`, `click`, `dblclick`, and relevant keyboard activation propagation before physical-cell handlers. They must not call the physical-cell navigation, selection, multi-select, drag, or playhead routes.

### M1 Motion Editor passive marker geometry

- Paint one compact strip per canonical Loop Clip effective interval inside the existing PPaint FX bar.
- Visible height is exactly **3px** and color is exactly **`#8B5CF6`**.
- Horizontal geometry is derived only from `{startFrame, frameCount}` using the existing timeline frame-to-x mapping and viewport clipping.
- The marker adds no row, lane, track height, label, text, badge, capsule, end cap, tooltip, hover treatment, focus treatment, or visible status variant.
- The marker creates no DOM or Canvas hit region of its own and is not returned by hit testing. Generic FX-track pointer behavior may continue at the same coordinates beneath the paint.
- The main timeline must not receive `loopId`, source keys, repeat count, infinity, requested duration, status, selection state, callbacks, or commands.
- Multiple markers share the existing FX bar and never stack into a separate lane. The painter is pure and paint-only.

### Responsive contract at 1280×720 minimum

- The app keeps the existing three-column Studio layout and **161px** strip height. The rail never creates vertical scrolling or reduces canvas height beyond the existing fixed strip.
- The right sidebar remains within the existing **316–340px** desktop column. At the existing narrower breakpoint it may use the established **286px** column; Loop Clip facts must still fit without horizontal scrolling.
- Sidebar fact labels use a fixed **88px** column and values use `minmax(0, 1fr)`. Long names ellipsize on one line; the full value is available through the styled tooltip and accessible name.
- Rail and cells continue sharing one horizontal scroller and one scrollbar. Long loops clip only at the viewport edge and reappear during horizontal scroll; they do not wrap or stack.
- Tooltip and popover clamp to an 8px viewport margin. Tooltip remains above when space permits and uses the existing placement flip only when required by the viewport.
- The action row remains 34px and horizontally scrollable under pressure. The rail cannot overlap it.

---

## Spacing Scale

Declared project scale: **4, 8, 16, 24, 32, 48, 64px**.

| Token / metric | Value | Usage |
|----------------|-------|-------|
| xs | 4px | icon/fact gaps, tooltip line gap |
| sm | 8px | popover row gap, viewport clamp, section gap |
| md | 16px | popover horizontal padding, sidebar inspector section spacing |
| lg | 24px | major local separation only |
| xl | 32px | existing sidebar resizer band; not a new rail height |
| 2xl | 48px | existing script thumbnail/cell-scale references only |
| 3xl | 64px | not introduced inside the strip/sidebar |
| Visible rail | 3px | functional geometry exception |
| Rail hit target | 12px | functional accessibility exception |
| 0f glyph | 8×6px | functional state marker exception |
| Cell pitch | 18px | existing physical-frame grid exception |
| Focus ring | 2px, 1px offset | keyboard visibility exception |
| Popover anchor gap | 8px | spacing-scale-compliant separation from the rail target |
| Popover width | 272px default; max 304px | fits existing sidebar/timeline context |

Exceptions are functional geometry, not additions to the spacing token family.

---

## Typography

Exactly four size roles and two weights apply to new rail/sidebar/popover content. Existing modal typography remains inherited.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Micro | 10px | 600 | 1.2 | compact status, frame and duration metadata |
| Label | 11px | 600 | 1.2 | sidebar fact labels, popover action labels |
| Body | 12px | 400 | 1.5 | tooltip/popover values and rejection text |
| Heading | 14px | 600 | 1.2 | Loop Clip display name in sidebar/popover |

- Use `system-ui, sans-serif` and only weights **400** and **600** for new content.
- Frame, cycle, repeat, requested, and effective values use `font-variant-numeric: tabular-nums`.
- Rail itself contains no persistent text.
- Tooltip and popover content may wrap by line; action labels and sidebar fact labels do not wrap.

---

## Color

### 60/30/10 contract

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#37393A` with surrounding `#3E3F41` | existing timeline, strip, and sidebar surfaces |
| Secondary (30%) | `#20262D`, `#343638`, `#62666D` | inspector card, popover, existing tooltip |
| Accent (10%) | normal `#5F83FF`; selected `#8FAEFF` | Loop Rail normal/selected line, selected fact accent, existing linked-cell border/dot |
| Focus | `#F2F5F7` | 2px focus-visible ring only |
| Warning | `#FFB020` | truncated end treatment and shortened status only |
| Error | `#FF6B6B` | unresolved rail/marker and missing-source status only |
| Destructive | existing EFX red treatment (`#FF9999` text / red border family) | `Delete` action only |

**Accent reserved for:** normal and selected Loop Rail paint, selected-loop inspector accent, the contextual Edit button's active/hover affordance, and the existing linked-frame inset border/dot. It is not used for every sidebar fact, every popover action, ordinary text, or destructive/warning states.

### Rail visual states

| State | Exact treatment |
|-------|-----------------|
| Normal | 3px solid `#5F83FF`; no fill, badge, label, shadow, thumbnail, or repetition pattern |
| Hover | same geometry; color `#7596FF`; no translation or height growth |
| Selected | 3px solid `#8FAEFF` plus a 1px outer glow `rgba(143,174,255,.45)`; sidebar enters Loop Clip context |
| Focused | selected/normal paint remains; add 2px `#F2F5F7` focus ring with 1px offset around the 12px target |
| Truncated | final **6px** of the visible rail becomes `#FFB020`; if Effective is 0f, the 0f flag uses warning color |
| Unresolved | full visible rail or 0f flag becomes `#FF6B6B`; error color has precedence over selected and truncation paint |
| Busy | retain state color at 55% opacity; no animated shimmer or spinner on the rail |
| Rejected operation | retain selected state; do not flash/move the rail; expose reason in popover/sidebar status |

### State precedence

Highest visible state wins:

1. Unresolved/error red
2. Keyboard focus ring
3. Selected accent/glow
4. Truncated amber terminal 6px
5. Hover color
6. Normal accent

Focus never hides error. Selection never replaces the amber end treatment. State changes alter paint only, never geometry.

### Existing linked cells

Preserve the accepted linked-cell treatment verbatim: inset `rgba(45,91,227,0.9)` border and 4px top-right dot. Do not change cell fill, border, height, frame text behavior, current outline, selected outline, generated/cached/background semantics, or drag styling.

---

## Copywriting Contract

English product copy only. Never display a raw Loop Clip UUID, raw script UUID, raw keyId, or the term `clip bloquant` in any language.

### Display-name derivation

Use this non-persisted order:

1. Existing non-empty loop-specific display name, if the current model already exposes one.
2. Existing source script display name formatted as **`{sourceScriptName} Loop`**.
3. Fallback **`Loop Clip at F{placementStart}`**.

Do not add a persisted naming field. Diagnostic logs may retain internal IDs, but product UI, tooltip, popover, sidebar, ARIA labels, errors, and confirmations must use the derived display name or placement fallback.

### Cycle and status forms

| Element | Exact form |
|---------|------------|
| Finite Cycle math | `Cycle {N}f × {R} = {T}f` |
| Infinity Cycle math | `Cycle {N}f × ∞` |
| Effective fact | `Effective {E}f` |
| Normal status | `Linked` |
| Truncated by next content/loop | `Loop shortened by next clip` |
| Truncated by parent boundary, when canonically distinct | `Loop shortened by parent end` |
| Unresolved status | `Source missing` |
| Zero-effective status | `Effective 0f — Loop shortened by next clip` |
| Mode | `Progressive` or `Static / Hold` |
| Placement | `Starts at F{start}` |

### Rail tooltip

Tooltip is multiline in this exact order:

1. `{displayName}`
2. `{Cycle math}`
3. `Effective {E}f`
4. `Status: {Linked | Loop shortened by next clip | Loop shortened by parent end | Source missing}`

For Effective `0f`, line 3 remains `Effective 0f` and line 4 states the canonical shortened status. Do not include UUIDs or a permanent on-rail Cycle badge.

### Local popover and sidebar facts

| Element | Copy |
|---------|------|
| Popover accessible name | `{displayName} actions` |
| Popover heading | `{displayName}` |
| Source script label | `Source script` |
| Missing source script value | `Source script unavailable` |
| Placement label | `Placement` |
| Cycle label | `Cycle` |
| Effective label | `Effective` |
| Mode label | `Mode` |
| Status label | `Status` |
| Applicable actions | `Duplicate`, `Unlink`, `Delete`, `Repair`, `Relink` |
| Busy inline status | `Updating Loop Clip…` |
| Generic accepted status | `Loop Clip updated.` |
| Generic rejected status | `Loop Clip was not changed. {reason}` |

`Delete` and `Unlink` remove only the link record and preserve source keys. No extra confirmation is required because both remain atomically undoable; the popover must not imply source-frame deletion.

### Sidebar primary action and rename distinction

| Context | Primary action slot | Accessible label / tooltip |
|---------|---------------------|----------------------------|
| Normal selected script | existing Play icon/action | `Play Script` |
| Selected Loop Clip | Lucide `Pencil` in the same slot | `Edit Loop Clip — {displayName}` |

- The Edit button always opens `openLoopEdit(loopId)`; it never begins script rename.
- The source script name is a separate text button. Its accessible label is `Rename source script {sourceScriptName}` and clicking it begins the existing inline rename flow.
- In normal script rows, clicking the selected script name also begins inline rename. The row body outside the name retains script selection/loading behavior.
- Do not add or retain a dedicated Pencil icon solely for script renaming. The visible Pencil icon is reserved for `Edit Loop Clip` while a Loop Clip is selected.
- Enter commits rename; Escape cancels rename; neither action opens Edit Loop Clip.

### Carried-forward S2–S6 copy

| Element | Copy |
|---------|------|
| Loop modal title | `Edit Loop Clip` |
| Loop modal primary CTA | `Update loop` |
| Loop modal secondary action | `Edit source cycle…` |
| Source modal title | `Edit Source Cycle` |
| Source notice | `Confirming regenerates the source cycle and updates every linked Loop Clip referencing it.` |
| Shared-source notice | `This source cycle is shared by {N} loops.` |
| Source primary CTA | `Regenerate source cycle` |
| Link/Create | `Link to existing cycle` / `Create new cycle` |
| Batch preflight | `This operation will shorten {N} linked loop(s), starting at frame {F}.` |
| Preview placeholder | `Loop source missing` |
| Export block | `Export blocked — Loop Clip at frame {S} references a missing source frame ({F}). Repair or unlink the loop, then export again.` |
| Source-key delete rejection | `This key belongs to a source cycle used by {N} linked loop(s). Unlink the loop(s) before deleting it.` |
| Rigid source drag rejection | `Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.` |
| Linked-frame Delete rejection | `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip rail to delete the loop.` |

### Empty state

There is no visual empty state for Loop Clips. With zero loops:

- the rail is absent;
- the Scripts panel remains in its normal script context;
- the primary action remains `Play Script`;
- existing `No project scripts yet.` copy remains unchanged when the script library itself is empty.

---

## Interaction Contract

### Selection ownership

- Loop Clip selection is a separate Studio/session selection from physical real-key selection.
- Selecting a loop does not navigate the playhead, change current frame, select/deselect a physical cell, collapse/extend the real-key selection set, start multi-select, or alter a drag session.
- Existing physical-cell click, modifier-click, Shift range selection, keyboard navigation, single-key drag, group drag, and action toolbar behavior remain unchanged below the rail.
- Selected Loop Clip identity drives the rail highlight and contextual Scripts sidebar. Closing a tooltip/popover does not clear Loop Clip selection.
- Selecting a normal script or explicitly selecting a physical key may return the sidebar to normal script context according to existing Studio selection policy; this transition must not mutate the Loop Clip record.

### Mouse and pointer behavior

| Input | Result |
|-------|--------|
| Hover rail target | after existing 1000ms styled-tooltip delay, show tooltip above the rail |
| Single click rail | stop propagation; select only the Loop Clip; focus the rail target; open the local actions popover |
| Double-click rail | stop propagation; close tooltip/popover; call existing local `openLoopEdit(loopId)` once |
| Click sidebar Edit | call the same `openLoopEdit(loopId)` path |
| Click outside popover | close popover only; retain loop selection and sidebar context |
| Pointer down on rail | no physical-cell navigation and no drag session; no pointer capture |
| Wheel/trackpad horizontal scroll | existing timeline scroll behavior remains available; rail geometry moves with the same scroller |

Double-click handling must suppress the second single-click side effect from reopening the popover after the modal request. No parent-to-child Loop Clip open request is used; the Studio-local controller is authoritative.

### Keyboard behavior

- Each visible Loop Clip range exposes exactly one tab stop: a native button or equivalent `role="button"` with `tabIndex=0`.
- Tab order follows canonical `placementStart`, then existing strip controls. Rail subdivisions are not separate focus targets.
- **Enter** on a focused rail target closes tooltip/popover and opens `Edit Loop Clip` through `openLoopEdit(loopId)`.
- **Space** prevents page scroll, selects the loop, and opens the local actions popover.
- **Escape** closes the popover and restores focus to its rail trigger. If only the tooltip is open, Escape hides it without changing selection.
- Arrow keys are not intercepted by the rail in this phase; existing physical-frame navigation shortcuts remain unchanged when focus is not on a rail action.
- Delete/Backspace do not delete or unlink a Loop Clip from rail focus. Destructive actions remain explicit popover controls.
- No keyboard shortcut for horizontal Loop Clip movement is introduced.

### Focus restoration

- Closing the local popover restores focus to the invoking rail target.
- Closing `Edit Loop Clip` restores focus to the exact invoking control: rail target for rail Enter/double-click, or sidebar Edit button for sidebar activation.
- After accepted Duplicate/Repair/Relink/Unlink, focus returns to the selected surviving loop target when visible.
- After accepted Delete/Unlink removes the selected record, focus moves to the nearest visible Loop Clip by placement order; if none remains, focus moves to the Scripts tab and normal script context is restored.
- After any rejected operation, popover/modal remains available, loop selection remains, and focus stays on the action that produced the rejection.

### Local actions popover

- Use a non-modal `role="dialog"` with `aria-modal="false"` and accessible name `{displayName} actions`; do not introduce a menu-only surface because the popover includes read-only facts and status.
- Anchor it 8px above the clicked rail target when space allows; clamp to 8px viewport margins and flip below only when required.
- Default width 272px, maximum 304px; maximum height is available viewport space minus 16px. Overflow scrolls vertically inside the popover, never the physical row.
- Facts appear first in this order: Source script, Placement, Cycle, Effective, Mode, Status.
- Actions appear after facts in this order when applicable: `Duplicate`, `Repair`, `Relink`, `Unlink`, `Delete`.
- Inapplicable actions are omitted. Temporarily blocked/busy actions remain visible only when their reason must be discoverable; use `aria-disabled="true"`, a described reason, and no silent no-op.
- Pointer-open keeps focus on the rail trigger so double-click remains deterministic; Tab moves into the first action. Space-open moves focus directly to the first applicable action.
- Accepted operations close the popover only after accepted authority state arrives. Rejections keep it open and show `Loop Clip was not changed. {reason}` with `role="alert"`.

### Contextual Scripts sidebar

- The existing Scripts tab remains the host; do not add a Loop Clip tab or separate inspector pane.
- Selecting a Loop Clip automatically presents Loop Clip context inside the already-open Scripts panel. It must not change the active tab away from Scripts.
- The existing Play slot is replaced in place by the contextual Pencil/Edit control. Toolbar grid height and row count remain unchanged.
- The inspector appears directly below the toolbar, replacing the normal Play Script summary while the loop is selected.
- Inspector order is exact: display name heading; source script; placement; Cycle math; Effective; mode; status.
- Long display/source names use ellipsis; hover/focus exposes the full value via the styled tooltip.
- Source script name is an inline text button for rename. It is visually distinct from the primary Edit control: text underline/contrast on hover and focus, no Pencil icon.
- Rename input replaces only the script-name text. It does not replace the Loop Clip heading or Edit button.
- Other existing script-library actions retain their current availability semantics. The contextual primary-slot swap must not reorder Save, Load/Apply, Delete Script, Refresh, Copy, Apply, or Clear controls.

### Busy and rejected-operation behavior

- During controller preparation/commit, selected rail and sidebar inspector remain visible.
- Rail target exposes `aria-busy="true"`; mutation actions use `aria-disabled="true"` with the current controller reason.
- Sidebar Edit action may remain focusable with an unavailable reason when the controller is busy; it must not silently no-op.
- Use existing status text `Preparing Loop Clip…`/controller status where already supplied; local generic busy copy is `Updating Loop Clip…`.
- No optimistic rail width, status, Cycle math, or sidebar fact changes. Update only from accepted canonical authority state.
- On rejection, preserve prior geometry, selection, focus, modal/popover inputs, and source references. Announce the reason in the nearest `role="alert"` and through the existing status channel.

### Carried-forward S2–S6 behavior

- `Edit Loop Clip`, `Edit Source Cycle`, Repair, Relink, Duplicate, Unlink, and Delete continue through the existing controller, physical-edit coordinator, authority request, atomic commit, and Undo/Redo paths.
- Painting/erasing on a linked occurrence materializes a local real key and shortens the loop; Clear materializes an empty real key; Delete/Backspace on a purely linked frame rejects.
- Moving/removing the next boundary re-expands the rail immediately from canonical accepted state without regeneration.
- Unresolved loops remain selectable, repairable/relinkable/unlinkable/deletable, show preview placeholders, and block export with the carried-forward copy.
- Source thumbnails, repetition bands, ghost cells as a first-class rail surface, permanent Cycle badges, and occurrence-seek controls are not part of S1.

---

## Accessibility Contract

### Roles and names

- Rail group: `role="group"`, `aria-label="Loop Clips"`; render only when loops exist.
- Rail target: native `button` preferred. Accessible name exact form: `{displayName}. {Cycle math}. Effective {E} frames. Status: {status}.`
- Selected rail target: `aria-pressed="true"`; unselected targets `aria-pressed="false"`.
- Busy rail target: `aria-busy="true"`.
- Tooltip: existing `role="tooltip"`; connect with `aria-describedby` while visible or with a stable tooltip id.
- Popover: `role="dialog"`, `aria-modal="false"`, labelled by its heading.
- Sidebar inspector: `role="region"`, `aria-label="Selected Loop Clip"`.
- Sidebar facts: semantic definition list (`dl`, `dt`, `dd`) or equivalent labelled pairs.
- Sidebar Edit: `aria-label="Edit Loop Clip — {displayName}"`.
- Source-name rename trigger: `aria-label="Rename source script {sourceScriptName}"`.
- Status updates use existing `aria-live="polite"`; rejected operations additionally use `role="alert"`.

### Focus visibility and target size

- Rail target is 12px high by the range width. Because the rail is a precision desktop timeline control, the 12px target is an explicit compact-editor exception; tooltip, keyboard access, and the persistent sidebar provide equivalent larger action access.
- Focus ring is 2px solid `#F2F5F7` with 1px offset and must remain visible at the timeline top and horizontal viewport edges.
- Sidebar Edit button retains the existing 30px toolbar button geometry and visible focus treatment.
- Popover action buttons are at least 30px high and expose text labels, not icon-only meaning.

### Reduced motion

- Rail hover, selection, truncation, unresolved, busy, and geometry changes are immediate paint changes; no slide, scale, shimmer, pulse, width tween, or spring animation.
- The popover may appear/disappear without animation. The existing tooltip delay remains 1000ms, but no fade/translation is added.
- Under `prefers-reduced-motion: reduce`, disable the existing 120ms color/background transitions for any newly touched rail, inspector, rename, and popover controls. Do not alter controller timing or tooltip delay.

### Contrast and non-color cues

- Selected state uses both stronger color and glow.
- Focus uses a separate white ring.
- Truncation uses the terminal 6px treatment plus explicit tooltip/sidebar text.
- Unresolved uses red plus `Source missing` text and repair/relink actions.
- Effective `0f` uses a distinct flag shape plus explicit `Effective 0f` text.
- No status relies on color alone.

---

## UI Considerations

Compiled probe coverage resolved with user-confirmed authored element kinds: **34 covered, 8 dismissed, 0 backstops, 0 unresolved**.

| Element | Category | Status | Resolution / Reason |
|---------|----------|--------|---------------------|
| S1 Integrated Loop Rail | empty | ✅ covered | Zero Loop Clips removes the rail DOM, focus targets, and layout footprint; the strip remains exactly 161px. |
| S1 Integrated Loop Rail | loading | ✅ covered | During controller preparation/commit, accepted geometry remains visible at 55% opacity with `aria-busy`; no optimistic width or facts. |
| S1 Integrated Loop Rail | error | ✅ covered | Unresolved ranges use red treatment and remain selectable; rejected operations preserve prior geometry, selection, and actionable error copy. |
| S1 Integrated Loop Rail | populated | ✅ covered | Canonical ranges render as compact 3px segments in one overlay with no stacking, extra row, or repeated-frame materialization. |
| S1 Integrated Loop Rail | partial | ✅ covered | Truncated loops use the amber terminal treatment and expose `Loop shortened by next clip` with canonical Effective duration. |
| S1 Integrated Loop Rail | overflow | ✅ covered | Long ranges clip at the shared horizontal viewport and return on scroll; they never wrap, stack, or add a scrollbar. |
| S1 Integrated Loop Rail | zero-one-many | ✅ covered | Zero hides the rail; one renders one target; many follow placement order and canonical non-overlapping Effective ranges. |
| S1 Integrated Loop Rail | long-text | ✖ dismissed | The rail contains no persistent product text; names and Cycle copy live in the tooltip/sidebar, and raw UUID text is prohibited. |
| S1a Rail tooltip | overflow | ✅ covered | Tooltip clamps to 8px viewport margins, stays above when space permits, and uses the existing flip behavior only when required. |
| S1a Rail tooltip | long-text | ✅ covered | Long display/source names wrap within the tooltip; full values remain accessible and never fall back to a UUID. |
| S1b Local actions popover | empty | ✖ dismissed | The popover only opens for a selected existing Loop Clip and always has facts plus at least Unlink/Delete when not busy. |
| S1b Local actions popover | loading | ✅ covered | Busy actions remain visible only when their reason must be discoverable, use `aria-disabled`, and wait for accepted authority state. |
| S1b Local actions popover | error | ✅ covered | Rejection keeps the popover open, preserves focus/selection, and announces `Loop Clip was not changed. {reason}`. |
| S1b Local actions popover | populated | ✅ covered | Facts appear in the locked order followed by applicable Duplicate, Repair, Relink, Unlink, and Delete actions. |
| S1b Local actions popover | partial | ✅ covered | Inapplicable actions are omitted; partially available/busy actions expose an explicit unavailable reason instead of silently no-oping. |
| S1b Local actions popover | overflow | ✅ covered | Width is 272–304px, clamped to the viewport; only the popover body may scroll vertically. |
| S1b Local actions popover | zero-one-many | ✅ covered | The action set varies deterministically by loop state while retaining one labelled non-modal dialog anchored to one selected rail target. |
| S1b Local actions popover | long-text | ✅ covered | Fact values wrap or ellipsize within the clamped surface and expose the full accessible value. |
| S1c Contextual Scripts sidebar | empty | ✅ covered | With no selected Loop Clip, the existing normal Scripts context and Play action remain unchanged. |
| S1c Contextual Scripts sidebar | loading | ✅ covered | The inspector stays visible during preparation/commit; Edit remains focusable only with a discoverable unavailable reason. |
| S1c Contextual Scripts sidebar | error | ✅ covered | Unresolved/rejected state keeps prior facts and selection, shows status/recovery copy, and exposes Repair/Relink through existing flows. |
| S1c Contextual Scripts sidebar | populated | ✅ covered | Selected Loop Clip replaces Play with Edit and shows name, source, placement, Cycle, Effective, mode, and status in exact order. |
| S1c Contextual Scripts sidebar | partial | ✅ covered | Missing source data is represented explicitly as unresolved; no field silently disappears and no UUID becomes product copy. |
| S1c Contextual Scripts sidebar | overflow | ✅ covered | The fixed 88px label column plus `minmax(0, 1fr)` values avoid horizontal scrolling at the 1280×720 minimum. |
| S1c Contextual Scripts sidebar | zero-one-many | ✅ covered | Zero loop selection shows normal script context; exactly one current loop drives the inspector even when many loops exist. |
| S1c Contextual Scripts sidebar | long-text | ✅ covered | Display/source names ellipsize on one line; tooltip/accessibility text exposes the full value and rename remains text-only. |
| S2 Edit Loop Clip modal | empty | ✖ dismissed | `openLoopEdit` rejects a missing Loop Clip before opening, so an empty modal state cannot occur. |
| S2 Edit Loop Clip modal | loading | ✅ covered | Existing `Preparing Loop Clip…` and commit progress remain visible without optimistic values or layout replacement. |
| S2 Edit Loop Clip modal | error | ✅ covered | Validation/authority rejection preserves inputs, keeps the modal available, and announces the exact controller reason. |
| S2 Edit Loop Clip modal | partial | ✅ covered | Unresolved references route to the existing repair/relink-capable mode instead of presenting silently missing fields. |
| S2 Edit Loop Clip modal | overflow | ✅ covered | The carried-forward compact modal remains contained at the minimum application window without changing the Studio layout. |
| S2 Edit Loop Clip modal | long-text | ✅ covered | Existing modal wrapping/ellipsis and accessible labels handle long script/loop values without exposing UUID copy. |
| S5 Linked physical-cell indicator | empty | ✅ covered | Unlinked physical cells render no blue inset border/dot and retain their existing state palette. |
| S5 Linked physical-cell indicator | loading | ✖ dismissed | The indicator derives synchronously from accepted in-memory resolver state and has no independent loading lifecycle. |
| S5 Linked physical-cell indicator | error | ✖ dismissed | Unresolved/error communication belongs to the rail, tooltip, sidebar, and preview/export surfaces; the linked-cell indicator has no separate error state. |
| S5 Linked physical-cell indicator | populated | ✅ covered | Linked cells preserve the accepted blue inset border and 4px dot across normal/current/selected/drag states without becoming selectable loop UI. |
| M1 Motion Editor passive marker | loading | ✖ dismissed | The marker derives synchronously from accepted interval data and has no independent loading state. |
| M1 Motion Editor passive marker | error | ✖ dismissed | The marker exposes no status variant; unresolved authoring status remains exclusively inside EFX Paint and shared preview/export behavior. |
| M1 Motion Editor passive marker | populated | ✅ covered | Each effective interval paints one exact 3px `#8B5CF6` strip inside the existing PPaint FX bar from `{startFrame, frameCount}` only. |
| M1 Motion Editor passive marker | overflow | ✅ covered | At every zoom/scroll boundary, paint clips correctly while no Loop Clip-specific hit region, tooltip mount, hover/focus state, keyboard target, or action exists. |
| M1 Motion Editor passive marker | zero-one-many | ✅ covered | Zero intervals paint nothing; one or many paint in the existing FX bar without stacking, a new row, or identity-bearing nodes. |
| M1 Motion Editor passive marker | long-text | ✖ dismissed | The marker contains no text, label, badge, name, metadata, or raw identifier. |

---

## Visual Tracer Acceptance Matrix

All nine checks are mandatory before implementation expands beyond the revised tracer.

| # | User-visible tracer check | Required visual/interaction evidence | Automatic rejection |
|---|---------------------------|--------------------------------------|--------------------|
| 1 | No extra row or height change | Workflow strip measures 161px with loops and without loops; physical row remains 38px; canvas allocation does not jump | Any 32px lane, second row, track expansion, or vertical scrollbar |
| 2 | No cell or toolbar clipping | 24px cells, current/selected outlines, drag feedback, and 34px action toolbar remain fully visible and operable | Rail paint/overflow clips cells, linked dot, outline, or toolbar |
| 3 | Conditional 3px rail | Loops show exactly 3px visible rail with 12px target; zero loops show no rail DOM/space | Persistent empty rail, badge, capsule, label, or height reservation |
| 4 | Correct hover tooltip | After existing delay, tooltip appears above rail with display name, Cycle math, Effective, and status | Tooltip below by default, missing required facts, UUID copy, or permanent on-rail text |
| 5 | Loop-only single-click selection | Single click selects loop, opens local actions, updates sidebar, and leaves playhead/physical selection unchanged | Any frame navigation, real-key selection change, multi-select collapse, or drag start |
| 6 | Double-click and Enter edit | Double-click and focused Enter each call Studio-local `openLoopEdit(loopId)` once and open existing modal | Parent/main-timeline bridge ownership, duplicate calls, or popover reopening over modal |
| 7 | Contextual sidebar swap and details | Normal script shows Play; selected loop shows Pencil/Edit in same slot plus name, source, placement, Cycle, Effective, mode, status | Separate inspector pane/tab, missing facts, Edit button starting rename, or dedicated rename Pencil |
| 8 | Blue linked indicators preserved | Linked physical cells retain existing blue inset border and 4px dot across normal/current/selected/drag states | Indicator removed, recolored to rail state, or promoted to a new cell state |
| 9 | Passive main-timeline marker only | Motion Editor PPaint FX bar paints one exact 3px `#8B5CF6` strip per effective interval from `{startFrame, frameCount}` only, with no text, badge, capsule, own hit target, tooltip, hover/focus, selection, keyboard route, navigation, Edit, drag, context menu, callback, command, or mutation | Missing/incorrect marker; new row/height; `loopCapsules`, `loopClips`, raw IDs, metadata, status, selection, or any Loop Clip-specific interaction route |

The tracer is accepted only when all nine checks pass together in the same EFX Paint/Roto build. Passing renderer/model tests without this visible ownership proof is insufficient.

---

## Implementation Boundaries

- Replace `PhysicsPaintLoopClipLane` and its extra-row mount with a focused integrated rail component/presentation helper. Do not add more presentation logic directly to the already-large `PhysicsPaintStudio.tsx`.
- Selected Loop Clip state must be shared through the existing Studio Signal/view-model boundary so the rail and Scripts panel consume one identity; do not keep a strip-local selection that the sidebar cannot observe.
- Rail geometry derives only visible ranges from the existing lazy resolver context. No destination-frame list, repeated DOM nodes per frame, or per-repetition cache assets.
- All edit/actions converge on existing controller methods and accepted-only commits. Do not create a second local mutation implementation.
- Replace specialized main-timeline Loop Clip capsule/open/action ownership with a minimal interval-only marker projection and pure Canvas painter. Protect the passive `{startFrame, frameCount}` marker path while removing `loopCapsules`, `loopClips`, IDs, metadata, status, selection, callbacks, commands, and every Loop Clip-specific interaction route; generic project/context/save/frame-sync bridges remain.
- Do not add a persisted Loop Clip name, rename operation, schema field, or migration.
- Do not implement horizontal Loop Clip placement drag in this phase.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn is not initialized |
| third-party | none | not applicable — no registry blocks or new UI dependencies |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-07T21:03:55Z after one bounded spacing revision. UI consideration probe: 34 covered, 8 dismissed, 0 backstops, 0 unresolved.
