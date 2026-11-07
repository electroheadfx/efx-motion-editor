# Phase 59 — UI Review

**Audited:** 2026-11-07
**Baseline:** No UI-SPEC.md. Audited against abstract 6-pillar standards with `SPECS/v2.1.0-motion-channels/README.md` §2/§3 (the phase's designated visual authority) plus the phase plans as the interface contract.
**Screenshots:** not captured — no dev server on localhost:3000/5173/8080/1420; code-only audit (the server is user-owned per CLAUDE.md).
**Interaction captures:** off (`workflow.ui_interaction_capture` is false).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 36 specific command sentences and honest merge/undo copy; "Wiggle" ships with no unit or explanation and the lane duplicates a second, punctuationally inconsistent reason vocabulary. |
| 2. Visuals | 1/4 | The motion lane is anchored at frame 0 instead of the rail start, the channel header sits inside the scrolling lane (covering the first ~9 cells) instead of the pinned header column, and the selection outline spans the whole timeline row instead of the rail. |
| 3. Color | 2/4 | Palette architecture is token-driven, but the "N keys" meta uses the bright key-rim token instead of the specified neutral `#8A939C`, and the sole entry point to Scale/Rotation/Opacity renders at ~2.6:1 (~1.4:1 when disabled). |
| 4. Typography | 2/4 | Sizes and weights match the mockup (9px/600, 8px) but live as TSX literals with no type tokens, and 8px meta text over an 18px lane is below any legible floor. |
| 5. Spacing | 2/4 | Fixed mockup coordinates (x=10/24/84/120/135/147) were replaced by flex+gap, so nav clusters shift per lane and do not align vertically; interactive targets are 6×6, 8×8 and 10×10 px. |
| 6. Experience Design | 2/4 | Excellent disabled/refusal coverage in principle, but reasons on native-`disabled` controls are unreachable, the `role="menu"` has no name/arrow keys/Escape/outside-dismiss, and the block emits an unvirtualized node per frame per lane. |

**Overall: 12/24**

---

## Top 3 Priority Fixes

1. **Anchor the lane and outline to the rail's own extent** — `TimelineMotionChannels.tsx:230` computes `laneWidth = frameCount × 18` but never offsets by the rail's `startFrame`; every cell (`:317`), key (`:301-303`) and curve (`:344-364`) is drawn from the row's x=0, while `railMotionIdentity.ts:251,265` supplies real app-frame starts. `timelineRailDesign.ts:197` returns `width: '100%'` and `TimelineMotionChannels.tsx:493-496` pins `left: 0`, so the "selected rail outline" wraps the entire timeline row. User impact: for any Key Rail or Loop Clip starting after frame 0, motion keys/curves render under the wrong frames and a click selects a key the user believes belongs to another frame — the phase's central feature is visually lying about timing. Fix: pass `view.startFrame` into the lane/block, set the block's `left = startFrame × 18`, and resolve the outline to `left = railStart + 0.75`, `width = frameCount × 18 − 3.5`, `height = rowHeight + lanes × 18` as the spec states.
2. **Move the channel header cluster into the pinned header column** — `physicsPaintTrackHeaderColumn.tsx:261-273` renders blank `aria-hidden` spacers for the lane rows, while `TimelineMotionChannels.tsx:383-444` renders the icon/label/"N keys"/nav cluster as an absolutely-positioned, opaque (`#1B2026`) 160px panel inside the scrolling lane. User impact: the first ~9 frames of every lane — including the very first motion key and the start of every curve — are covered and unclickable, and once the rows region scrolls past 160px the channel labels and the only key-navigation affordances disappear completely. Fix: render the cluster in the header column's lane spacer slots (x=10 icon, x=24 label, x=84 count, x=120/135/147 nav per the spec) and remove the in-lane header panel.
3. **Constrain the add-channel row, menu and reasons to the block** — `PhysicsPaintTrackRow.tsx:548` (`width: '100%'` inside a stretch-width flex column) and `:660-682` (`left: 0; right: 0` overlay) make the `+` row and its menu full-timeline-width hit targets; the menu surface is `TIMELINE_SURFACE.rows` (`#1E2125`, `TimelineMotionChannels.tsx:588`), which is exactly `.physics-paint-rows-region`'s background (`physicsPaintStudio.css:6973`), so it reads as an extra track row and swallows clicks on the tracks beneath it. The menu also has `role="menu"` with no accessible name, no arrow-key navigation, no Escape and no outside-click dismissal. Fix: size both to the rail/block width, add border/shadow separation, an `aria-label`, Escape + arrow handling and an outside-pointer dismissal; and keep the 59-23 disabled-with-reason contract by using `aria-disabled` + a no-op click (as the chevron already does) instead of native `disabled`, so the reason stays reachable.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Strengths:
- The command layer carries 36 distinct, specific sentences with consistent terminal periods and no generic labels (`railMotionCommands.ts:587-627`, `:911-918`). There is no "Submit"/"OK"/"Click here"/"No data" anywhere in the phase surface (grep across the four view modules returned zero hits).
- Refusals name the remedy, not just the failure: `'Animate this rail before adding a Motion channel.'`, `'Move the playhead inside this rail first.'`, `'Position must be between -1,000,000 and 1,000,000 px.'`
- Empty/absent state copy is deliberate: per-field `not added` markers plus one section note (`PhysicsPaintScriptsPanel.tsx:216-218`, `:243-247`) rather than one note per field.
- Merge-drop copy is truthful about undoability (`railMotionMergeNotice.ts:107-116`): `'Merged rails — motion on frames N–M was removed. Undo restores it.'` / `'… This change cannot be undone.'`
- Guarded actions consistently render `unavailable: {reason}` (`PhysicsPaintWorkflowStrip.tsx:902-904`).

Warnings:
- **Wiggle has no meaning.** `PhysicsPaintWorkflowStrip.tsx:962-975` renders a bare "Wiggle" label plus a numeric stepper with `ariaLabel="Motion key wiggle"`; the accepted range is `Wiggle must be between 0 and 1,000,000.` (`railMotionCommands.ts`) with no unit, no tooltip and no explanation of what the number controls. A user cannot predict the effect of 0 vs 1 vs 100.
- **Two vocabularies for the same condition.** The lane authors its own reasons (`TimelineMotionChannels.tsx:247-271`): `'No earlier motion key in this rail'`, `'Cursor is outside this rail'`, `'Motion key editing is unavailable'` — no terminal period, and "cursor" where the rest of the product says "playhead" (`'Move the playhead inside this rail first.'`). The strip only overrides the diamond (`PhysicsPaintWorkflowStrip.tsx:3313-3322`), so prev/next always show the view's wording.
- `'The drag did not change a Motion channel.'` is a defensive developer message rendered to users.
- The merge notice promises "Undo restores it." but the notice's only control is "Dismiss"; the affordance is the global undo shortcut, which the sentence does not name.

### Pillar 2: Visuals (1/4)

Blockers:
- **Lane geometry ignores the rail's horizontal origin.** `TimelineMotionChannels.tsx:230`, `:298-324`, `:340-342` place cells, keys and curves at rail-local frame × 18 from the row's left edge. `RailMotionRailView.startFrame` is a real app frame (`railMotionIdentity.ts:251,265`), and the strip converts the playhead to rail-local space (`PhysicsPaintWorkflowStrip.tsx:2853-2855`), proving the distinction is live. No `startFrame` offset exists anywhere in the block (grep for `marginLeft|paddingLeft|translate` in the lane files returns zero). The spec is explicit: "Lane: background `#1B2026`, x = rail start, width = `frameCount × 18`."
- **The channel header overlays the lane content.** `TimelineMotionChannels.tsx:383-444` is the last child of the lane, absolutely positioned at `left: 0` with `width: 160` and an opaque `#1B2026` background, so it paints over the first 8.9 cell columns — the spec's own keyed example puts the first key at cell 0. Keys at rail-local frames 0–8 and the first 160px of every curve are invisible and unclickable.
- **The channel header is in the wrong container.** The spec's §1 item 3 and §2 coordinates describe the channel header living in the pinned header column (x=10/24/84/120/135/147 within that column). `physicsPaintTrackHeaderColumn.tsx:261-273` renders only blank spacers there (`aria-hidden`), so the pinned column shows four unlabeled 18px bars and the real header scrolls away with the timeline.
- **The selection outline does not trace the rail.** `timelineRailDesign.ts:181-199` returns `width: '100%'` and the view pins `left: 0` (`TimelineMotionChannels.tsx:493-496`); the spec requires `left = railStart + 0.75`, `width = frameCount × 18 − 3.5`, `height = 30 + 18 × channels`. On a 30-frame rail the outline is roughly 2.4× too wide (1290px card vs the spec's 536.5px), and it always starts at the row edge rather than at the rail.
- **The `+` row and menu are full-width.** `PhysicsPaintTrackRow.tsx:611-615` is a stretch-width flex column, so the add row's `width: '100%'` (`TimelineMotionChannels.tsx:548`) and the overlay's `left: 0; right: 0` (`PhysicsPaintTrackRow.tsx:664-674`) span the whole timeline, far past the lanes they belong to.

Warnings:
- **No hover feedback anywhere in the new surface.** `TimelineMotionChannels.tsx` contains zero `:hover` rules, `onPointerEnter` handlers or CSS class definitions — grep for `physics-paint-motion` in `physicsPaintStudio.css` returns 0 matches, so every Phase 59 motion class is styled only by inline styles. Keys, the three nav buttons, the `+` row and every menu row are dead to the pointer until clicked.
- **The "N keys" meta is visually louder than it should be.** `TimelineMotionChannels.tsx:412` colours it with `palette.keyRim` — the same family as the channel label (`:406`) — instead of the spec's neutral `#8A939C`, flattening the label/meta hierarchy.
- **Header cluster compression.** Icon at x=0 (spec x=10), label at x≈14 (spec x=24), count at x≈58 (spec x=84); the nav cluster therefore starts well left of x=120 and the remaining header box is empty opaque paint covering frames 5–8.
- **Outline includes the 2px post-block gap** (`timelineRailDesign.ts:192-194`), so the outline overshoots by 2px versus the spec's `30 + 18 × channels`. The add-row inclusion is a phase decision; the gap is not.

### Pillar 3: Color (2/4)

Strengths:
- `TimelineMotionChannels.tsx` contains zero hardcoded hex colours: cells use `TIMELINE_SURFACE.emptyCellFill/emptyCellBorder`, the lane `motionLane`, the outline `accentFallback`, the menu `rows`/`trackName` (`:322-323`, `:335`, `:394`, `:500`, `:553`, `:588`, `:606`).
- The four rail types × three tiers are a single palette authority (`timelineRailDesign.ts:46-67`), and the type rims are derived from the selected tier rather than re-typed (`:145-150`).

Warnings:
- **Wrong token for the meta count.** Spec `#8A939C`; implementation `palette.keyRim` = `#A6D334` (Standard), `#FFD18A` (Motion), `#C3A6FF` (Static), `#9AD4FF` (Reveal). The neutral/secondary semantic is lost.
- **The `+` row fails contrast on the only path to most channels.** `TIMELINE_SURFACE.motionToggleInactive` `#58616B` on `#1B2026` is ~2.6:1; the disabled `opacity: 0.4` (`TimelineMotionChannels.tsx:556`) drops it to ~1.4:1. 59-17 records that this row is "the only way Scale, Rotation and Opacity become reachable." The 9px label at 1.4–2.6:1 fails both the 4.5:1 text and 3:1 UI thresholds; `#8A939C` would reach ~5.3:1.
- **Hardcoded, un-themed colours in a new component.** The merge notice row hardcodes fallbacks `#2a3a4a`, `#0f0f0f`, `#e5edf8` (`PhysicsPaintWorkflowStrip.tsx:1335-1338`) instead of the v7 tokens used by everything else in the block.
- **The focus ring is unrelated to the rail palette.** The global `button:focus-visible` ring is `#2d5be3` (`physicsPaintStudio.css:158-162`); the motion surface is orange/violet/blue/green, so the ring reads as a foreign accent on every key and nav button.
- The gizmo keeps the older `#4A90D9` handle colour (`PhysicsPaintReferenceTransformHandles.tsx:600,610,636`) for a rail-motion target whose rail colour is a different hue — the third gizmo instance inherits the photo-reference palette rather than the selected rail's.

### Pillar 4: Typography (2/4)

Findings:
- Only two sizes and one weight are used in the motion surface — `fontSize: 9, fontWeight: 600` for the lane label (`TimelineMotionChannels.tsx:406`), `fontSize: 8` for the key count (`:412`), `fontSize: 9, fontWeight: 600` for the add row (`:554-555`) — matching the mockup's 9px/600 and 8px values.
- All four are TSX literals. `TIMELINE_MOTION` (`timelineRailDesign.ts:121-151`) owns geometry only: there are no font-size or font-weight tokens, so the type scale is not part of the token contract the module advertises. 59-10's own acceptance criterion ("no numeric literal that duplicates a token") is met only because no type token exists.
- The 8px "N keys" text sits in an 18px lane; combined with a 2.6–5.3:1 contrast range and no letter-spacing adjustment, it is below any practical legibility floor. It is mockup-mandated, but the audit still flags it as a usability risk at the mockup's own 1x density.
- The add row reuses the channel label's 9px/600, so "Add channel" reads with the same weight as a channel name rather than as a secondary action.
- The merge notice introduces an 11px size (`PhysicsPaintWorkflowStrip.tsx:1339`) — a fourth type size inside one 18px-rhythm block.
- The inspector labels compose text + unit in the view (`PhysicsPaintScriptsPanel.tsx:213`: `{field.label} ({field.unit})`) rather than in the projection, so a future locale or unit change is a component edit; the projection already owns a unit type (`physicsPaintKeyRailPresentation.ts:161,203-209`).

### Pillar 5: Spacing (2/4)

Findings:
- **The mockup's fixed header coordinates are gone.** The spec fixes icon x=10, label x=24, count x=84, previous x=120, diamond x=135, next x=147. `TimelineMotionChannels.tsx:383-415` instead uses `display: flex`, `gap: 6` and an unconstrained 160px box, so the cluster is left-compressed and, worse, the nav cluster's absolute position depends on the rendered width of the label and count strings. Across the four lanes ("Position"/"0 keys" vs "Rotation"/"12 keys") the chevrons therefore do not line up vertically — the mockup's whole reason for fixed coordinates.
- **No horizontal inset.** The lane icon is the first child with no padding (x=0), the add-row plus icon is at x=0 and the menu row icons are at x=0; the spec's rail-chrome inset is 10px. Every Phase 59 left-edge element is flush against the lane/rail boundary.
- **The header cluster constant is under-filled.** `headerClusterWidth: 160` paints 8.9 opaque frame columns while the content occupies roughly the first 90px, so extra frames are hidden for no visual gain.
- **Target sizes far below the 24×24 minimum.** Keys are 6×6 (`:305-306`), diamond 8×8 (`:432`), chevrons 10×10 (`:424`, `:442`) with `padding: 0`; the two chevrons are 15px apart with 10px glyphs, leaving a 5px gap between hit areas. Even with the mockup's glyph sizes, the hit boxes need padding.
- Strengths: the rhythm itself is token-exact — 18px lane height (`TIMELINE_MOTION.laneHeight`), 18px cell pitch, 16×18 footprint, 2px post-block gap, 1.5px curve, radius 3/1.5, and header spacer rows derive from the same token (`physicsPaintTrackHeaderColumn.tsx:46-47,261-272`).
- `HEADER_ROW_HEIGHT_PX = 31` (`physicsPaintTrackHeaderColumn.tsx:41`) vs the spec's 30px rail row: the phase deliberately keeps the v2.0.1 31px row pitch, so the outline is 1px taller than the mockup's `30 + 18 × channels`. Documented, not double-counted.

### Pillar 6: Experience Design (2/4)

Strengths:
- Three-state chevron with a truthful reason chain (`PhysicsPaintTrackRow.tsx:1499-1524`) and `aria-disabled` (not native disabled) so the button stays focusable.
- The 59-23 always-visible, authority-gated `+` row resolves availability once per render and renders the authority's sentence verbatim (`PhysicsPaintTrackRow.tsx:596-604`, `TimelineMotionChannels.tsx:538-543`).
- Scope-gated controls: Hold/Ease/Wiggle exist only in the motion-key scope and render nothing elsewhere (`PhysicsPaintWorkflowStrip.tsx:925-984`).
- Refusals are surfaced, never silently clamped: the numeric inspector shows `role="alert"` and remounts the field at the projected value (`PhysicsPaintScriptsPanel.tsx:248-250`, `:220-222`).
- Absent channels are disabled with `aria-disabled`, `aria-describedby`, a `not added` marker and one section note.
- Loading/empty/error coverage is otherwise complete for a local model: no async states to design, and the merge notice is `role="status" aria-live="polite"` with a Dismiss control.

Warnings and blockers:
- **Reasons on native-`disabled` controls are unreachable.** The `+` row sets `disabled={disabled}` with `title`/`aria-description` (`TimelineMotionChannels.tsx:541-543`) and the three nav buttons set `disabled: state.disabled` with the same pair (`:288-295`). A natively disabled button is removed from the tab order and cannot be focused, so keyboard and screen-reader users never receive the reason — the exact affordance 59-23 claims ("disabled with the authority's reason, never a silent no-op"). The chevron already models the correct pattern (`aria-disabled` + no `onClick`).
- **The `role="menu"` popover violates the ARIA menu pattern.** `TimelineMotionChannels.tsx:582-589` has no `aria-label`/`aria-labelledby`; there is no arrow-key handling, no Escape, no focus move into the menu and no outside-click dismissal. `dismissRailMotionChannelMenu` is only called by the toggle, a menu row, or a collapse, so an open menu persists across unrelated interactions.
- **The full-width overlay steals clicks.** Because the overlay is `left: 0; right: 0` and its buttons stretch, clicking any track row that the menu happens to cover triggers "add channel" instead of selecting that track; the menu background is indistinguishable from the rows-region background.
- **Horizontal scroll destroys the lane's affordances.** The header lives inside `.physics-paint-timeline-scroll`, so past ~160px of scroll the channel name, key count and the only prev/diamond/next controls are off-screen, with no equivalent in the pinned column.
- **Unvirtualized lane DOM.** `TimelineMotionChannels.tsx:340-342` emits one absolutely positioned `<div>` per frame per lane; 59-19 sizes the lane to the rail's resolved boundary, which for an infinite loop is the compositor boundary. A 2,000-frame rail × 4 lanes is 8,000 nodes before any curve work, and each curve's `d` can carry up to 4,096 points (`railMotionEvaluator.ts:218`) per model channel (two for grouped Position).
- **Curves are polylines, not the specified "cubic path"** (`railMotionEvaluator.ts:334-344` emits `M`/` L`). Visually acceptable at an 18px pitch but it is a contract deviation and it inflates the path string for long rails.
- No loading indicator is needed, but there is also no feedback that an Animate click succeeded beyond the chevron colour change (D-01 intends exactly this, so recorded, not scored against).

---

## Minor Recommendations

1. Add type/spacing tokens (`labelFontSize`, `labelFontWeight`, `metaFontSize`, `headerIconInset`, `headerLabelX`, `headerCountX`, `navX`) to `TIMELINE_MOTION` so the header cluster is token-driven like every other measure.
2. Use the chevron's `aria-disabled` + no-op pattern on the `+` row and lane nav buttons so disabled reasons stay reachable.
3. Give the add row and menu rows real horizontal padding and a `:hover` / `:focus-visible` treatment (a CSS block for the `physics-paint-motion-*` classes instead of inline-only styling).
4. Add an `aria-label="Add Motion channel"` (or `aria-labelledby`) and arrow-key/Escape navigation to the channel menu, plus a document-level outside-pointer dismissal.
5. Replace the `N keys` colour with `#8A939C`, or add a dedicated neutral meta token.
6. Give Wiggle a unit or a tooltip sentence (e.g. amplitude in px) and a short helper line in the inspector.
7. Retire the stale `.physics-paint-track-row-motion-toggle` CSS comment that still calls the slot "inert … never receives pointer input" (`physicsPaintStudio.css:7365-7368`).
8. Replace the merge-notice hardcoded hexes with the v7 surface tokens and drop the 11px size back into the existing scale.
9. Remove the dead `selected ? 1 : 0.55` branch in `TimelineMotionBlockOutline` — both call sites pass `selected`.

---

## Files Audited

- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` (622 lines, fully read)
- `app/src/components/physic-paint/view/timelineRailDesign.ts` (344 lines, fully read)
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (motion block, chevron, rail-line and outline regions)
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` (320 lines, fully read)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (motion key controls, merge notice, Animate, rows region, block host, lane reasons)
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` (motion inspector section)
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` (motion inspector projection)
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` (rail-motion gizmo)
- `app/src/components/physic-paint/roto/railMotionCommands.ts` (availability authority, refusal copy, domain reasons)
- `app/src/components/physic-paint/roto/railMotionMergeNotice.ts` (116 lines, fully read)
- `app/src/components/physic-paint/roto/railMotionEvaluator.ts` (curve path construction, sample budget)
- `app/src/components/physic-paint/roto/railMotionIdentity.ts` (rail view start/end semantics)
- `app/src/components/physic-paint/physicsPaintStudio.css` (header column, rows region, row height, focus ring, motion toggle)
- `SPECS/v2.1.0-motion-channels/README.md` §1-§5
- All 25 `59-*-SUMMARY.md` files and the relevant `59-*-PLAN.md` contracts (59-10, 59-11, 59-17, 59-23)
- `59-CONTEXT.md`, `59-UAT.md` (13 rows still pending live UAT), `59-VERIFICATION.md`

**Registry audit:** skipped — `app/components.json` does not exist (no shadcn registries).
