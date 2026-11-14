# Phase 59: Rail Motion Channels & v7 Interface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-06
**Phase:** 59-Rail Motion Channels & v7 Interface
**Areas discussed:** First Motion key, Value authoring, Channel lanes, Motion semantics

---

## First Motion key

**Why this area:** v7 makes the grey `minus` `aria-disabled` and the nav diamond exists only inside an expanded block, which needs motion to exist — so the shipped contract had no live path to create motion at all.

| Option | Description | Selected |
|--------|-------------|----------|
| Action-bar Animate button | Appears when a rail is selected (v3's rail-scope command set). Discoverable; keeps the grey minus truthful. | ✓ |
| Right-click rail → Animate | No new action-bar chrome, but right-click is not established on the rail body. | |
| Click the grey minus | Fewest steps, but contradicts MUI-01's aria-disabled rule. | |
| Keyboard shortcut only | Fast once learned, invisible to a first-time user. | |

**User's choice:** Action-bar Animate button, rail scope only.
**Notes:** Selecting a drawing key or motion key hides Animate, matching MOTN-11's disjoint scopes.

| Option | Description | Selected |
|--------|-------------|----------|
| One identity key at the playhead | Rail becomes animated; nothing moves until a second key. | ✓ |
| Two keys: rail start + playhead | Visible movement immediately, but invents a key the user never asked for. | |
| One key at the rail start | Predictable anchor, but ignores a deliberately parked playhead. | |

**User's choice:** One identity key at the playhead.

| Option | Description | Selected |
|--------|-------------|----------|
| Position, expanded | First key visible immediately. | |
| All four lanes expanded | Whole transform at once; 72px per block, contradicts "no lane by default". | |
| Stay collapsed | Chevron flips to right; user expands manually. | ✓ |

**User's choice:** Stay collapsed — the glyph changing from grey `minus` to bright `chevron-right` is the only feedback.

| Option | Description | Selected |
|--------|-------------|----------|
| Position only | Least invented data; each channel animates independently. | ✓ |
| All four channels | One click writes four keys. | |
| Position + Opacity | Arbitrary split; no reference tool works this way. | |

**User's choice:** Position only.

---

## Value authoring

**Why this area:** The requirements say "add, edit, remove Motion keys" but never say how a *value* is set, and the v7 mockup shows no value editor.

| Option | Description | Selected |
|--------|-------------|----------|
| Gizmo + numeric fields | Reuses the 519-line reference-transform handle pattern and shared hit-testing. | ✓ |
| Numeric fields only | Smallest surface, but nothing can be eyeballed. | |
| On-canvas handles only | Direct manipulation, but no exact entry. | |

**User's choice:** Gizmo + numeric fields.

| Option | Description | Selected |
|--------|-------------|----------|
| Right-panel inspector | Follows the existing `selectedKeyRailInspector` projection. | ✓ |
| Inline on the lane header | Closest to the key, but the 180px header is already full. | |
| On-canvas HUD | Zero travel, but floats over artwork and needs placement rules. | |
| Floating dialog | Precedent exists, but heavy for per-key entry. | |

**User's choice:** Right-panel inspector.

| Option | Description | Selected |
|--------|-------------|----------|
| Position, Scale, Rotation | Spatial channels get handles; Opacity stays numeric. | ✓ |
| Position only | Cheapest gizmo; scale/rotation numeric-only. | |
| All four incl. opacity | Uniform, but an opacity handle is invented UI. | |

**User's choice:** Position, Scale, Rotation.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-key in animated channels | Dragging at a frameless position keys, but only on a channel that already has motion. | ✓ |
| No auto-key at all | Strictest; friction on every second key. | |
| Explicit auto-key toggle | Powerful, but new session state and a new failure mode. | |

**User's choice:** Auto-key inside already-animated channels only.

| Option | Description | Selected |
|--------|-------------|----------|
| px / % / ° / % | Matches the v7 frame-based mockup and the rest of the Studio. | ✓ |
| px / factor / ° / % | Module-friendly, reads worse in a panel. | |
| You decide | Lock semantics, let the planner pick display. | |

**User's choice:** Position px, Scale %, Rotation degrees, Opacity %.

---

## Channel lanes

**Why this area:** MOTN-04 says "open on demand, one at a time, no lane by default", while the v7 mockup shows three lanes and the outline formula is `30 + 18 × channels`.

| Option | Description | Selected |
|--------|-------------|----------|
| Only keyed channels + add-channel | Reconciles MOTN-04 with the mockup, whose three lanes each carry keys. | ✓ |
| All four channels every time | Predictable, but a 72px block on every animated rail. | |
| Per-rail remembered subset | Closest to a literal "one at a time", but adds state and a second toggle. | |

**User's choice:** Only channels that carry keys, plus an add-channel affordance.

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped lane, two model channels | v7 shows one lane; two model channels keep Split X/Y a no-migration follow-up. | ✓ |
| Grouped lane, one model channel | Simplest persistence; split later becomes a schema change. | |
| Grouped + Split X/Y toggle | Full Separate Dimensions now; not required by the milestone. | |

**User's choice:** Grouped lane backed by `position-x` and `position-y`.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — shared key frames | One key at a frame carries both axes. | ✓ |
| No — independent, lane shows union | More flexible, but "grouped" loses its meaning. | |

**User's choice:** Shared key frames.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed order | Position, Scale, Rotation, Opacity; no new state. | ✓ |
| User-reorderable lanes | Flexible, but reordering inside a block with an outline and a 2px gap rule. | |

**User's choice:** Fixed order.

| Option | Description | Selected |
|--------|-------------|----------|
| A '+' row in the block | Same 18px rhythm, opens a menu of unkeyed channels. | ✓ |
| Action bar, next to Animate | Reuses the bar, but competes with Animate. | |
| Right-panel inspector | Keeps the timeline clean; discovery suffers. | |
| Right-click the rail body | No chrome, but hidden. | |

**User's choice:** `+` row at the end of the expanded block.

| Option | Description | Selected |
|--------|-------------|----------|
| Lane disappears | Keeps "only keyed channels" consistent; last channel returns the grey minus. | ✓ |
| Empty lane stays open | Preserves context, but breaks the keyed-only rule. | |

**User's choice:** Lane disappears.

---

## Motion semantics

**Why this area:** Repeat behaviour and the pivot both land in the persisted schema and in how every saved rail will animate.

| Option | Description | Selected |
|--------|-------------|----------|
| Hold only in v1 | Rail-local time, holds past the last key; matches MOTN-09. | ✓ |
| Per-rail Hold / Fit toggle | Fit stretches to the occurrence; adds a persisted field and a control. | |
| Fit only | Always normalise; contradicts the hold-outside-range law. | |

**User's choice:** Hold only. MOTN-06 is satisfied through its hold branch; fit-to-span is deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Rail content centre | Union of the rail's key bounds, computed once per revision; local to the object. | ✓ |
| Composite canvas centre | Trivially stable, but a small rail swings in a wide arc. | |
| User-placeable pivot | Most control, but a handle plus a persisted pivot and its own undo. | |

**User's choice:** Rail content centre.

| Option | Description | Selected |
|--------|-------------|----------|
| No blur on rail motion | Documented limitation; REL-04 still holds. | ✓ |
| Blur the combined transform | Visually correct, but one draw per sub-frame. | |
| Blur Position only | Arbitrary and hard to pin. | |

**User's choice:** No motion blur on rail motion in v1.

| Option | Description | Selected |
|--------|-------------|----------|
| Multiply | Final alpha = track opacity × motion opacity. | ✓ |
| Motion opacity replaces track | The track's opacity control would stop mattering. | |

**User's choice:** Multiply.

---

## Claude's Discretion

- Undo granularity: one state change per completed gesture; every Motion key operation is one undo/redo step.
- Exact gizmo visibility across the three scopes, provided the scopes stay disjoint.
- Visual form of the `+` row and its channel menu within the 18px rhythm and locked palette.
- Whether the inspector shows all channels or only animated ones, provided Opacity is always numeric.

## Deferred Ideas

- Fit-to-span repeat — deferred by the hold-only decision.
- Split X/Y Position toggle — model kept split-ready, no schema change needed later.
- On-canvas spatial motion-path editing, Motion-key copy/paste, full graph editor, skew/3D/perspective, multiple simultaneously expanded blocks — already future requirements.
- Motion blur on rail motion — locked off in v1.
- User-placeable pivot — rejected for v1.

## Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — matched on frame/export/opacity but is a composite-time crossfade, not rail motion. Left pending.
