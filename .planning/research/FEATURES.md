# Feature Research

**Domain:** v2.1.0 — rail motion channels, timeline horizontal zoom, vector painting tool, painted-stroke curve editing
**Researched:** 2026-11-06
**Confidence:** MEDIUM overall — HIGH on local codebase facts (read directly), MEDIUM on official-documentation claims (Toon Boom, Adobe, Krita, Inkscape, TVPaint, Premiere, Dragonframe docs), LOW on knowledge-tier comparisons where no doc was fetched (marked).

**Evidence tiers (quality gate):**
- **[CODE]** — verified in this repository (HIGH).
- **[DOC]** — official vendor documentation or manual fetched during this research (MEDIUM; single-source web tier per the seam).
- **[X]** — cross-checked across two or more independent sources (MEDIUM).
- **[K]** — knowledge-tier general industry behaviour, not fetched (LOW; never used alone to justify a requirement).

**Scope rule:** only the four *new* capabilities. Existing features (multi-track paint document, paint keys, Loop Clips, compositor, per-stroke script replay, playback/export, undo/redo) are treated as dependencies, not re-researched.

---

## Capability 1 — Per-rail 2D transform animation with independent animation keys

### 1.1 What "correct" looks like, concretely

The rail is the animated object. Position, scale, rotation, opacity are rail channels. Motion keys are authored on those channels and are *independent of drawing keys* — Toon Boom Harmony's peg/drawing split is the exact precedent: a peg carries position, rotation, scale, skew, pivot and matrix, while drawing keys decide **which drawing is exposed** (F5 exposure, F6 keyframe, F7 delete) [DOC: Harmony 20 "Animating with Keyframes", Harmony 24 PegNode]. Harmony even ships a script to rescue users who accidentally keyed transforms on drawings instead of pegs — the failure mode is real and common.

Behaviours that make the model feel professional:

1. **Independent key tracks.** A Motion key exists on a channel at a rail-local frame with no drawing key present. [context]
2. **Value at frame.** Adding a key captures the channel's current evaluated value; editing the value at a frame where a key exists updates that key; editing at a frame without a key while the channel is already animated creates a key (After Effects stopwatch semantics) [DOC: AE reference]. Harmony's alternative — transform only in "Animate" mode, otherwise the whole peg gets a global offset — ships a dedicated preference to disable accidental key creation [DOC: Harmony 25 "Disabling Animation Keyframe Creation When Transforming Elements"]. Pick one, make it visible.
3. **Endpoint hold.** Before the first key the value holds at the first key; after the last key it holds at the last key. This is standard AE/Harmony behaviour and is what makes a rail with one key simply "offset" rather than "animated." [X]
4. **Unbounded rotation.** Rotation is not normalised: 0°, 360°, 720° are three different keys and interpolate linearly through the turns. After Effects rotation is multi-turn by default; normalising to 0..360 is what produces the classic "spins backwards" bug. [X]
5. **Pivot exists and is time-invariant.** Scale and rotation need an anchor. Harmony requires pivots to be set before animating; the default is canvas centre (0,0), with Advanced Animation tools to move it [DOC: Harmony 20]. The pivot must be defined in the **rail's coordinate frame**, never recomputed from each frame's tight raster bounds — otherwise a cycling drawing makes the pivot jitter and the rail wobbles. Gate D's "scale/rotation resample the raster" is the quality consequence of a raster compositor [context].
6. **Transform at the compositor.** Motion is applied when resolving the track raster, so a cycled rail keeps cycling its drawing content while the transform interpolates across the whole occurrence; no re-bake. [context; matches AE precomp "transform outside, content inside"]
7. **Preview equals export.** One evaluator used by Studio preview and export (the project's existing preview/export parity law). Seeded wiggle must produce identical frame values at export. [context]
8. **Position modes.** Default grouped (one Position lane), with a split X/Y mode for per-axis timing. Precedents: AE "Separate Dimensions" (right-click Position, or the Graph Editor button) [DOC: AE reference]; Harmony "Separate Positions" and "Separate Scales" checkboxes, with separate scales explicitly recommended for squash/stretch [DOC: Harmony docs]. Note that the project's existing `PhotoReferenceTransform` already carries `x, y, scaleX, scaleY, rotation` [CODE: `app/src/efx-paint/document/efxPaintDocument.ts:144`], so split scale is a naming question, not a new concept.
9. **Repeat semantics.** "hold" vs "fit-to-span" correspond to the two classic ways of putting a motion inside a repeated block: the motion plays per authored span and holds at its end value for the remaining repeats (a precomp whose own timeline stops advancing), or the whole motion is time-scaled across the full repeated occurrence (AE time-remap stretch). The exact interpretation must be settled by Gate C in Phase 59; do not ship both silently.

### 1.2 Table stakes

| Feature | Why Expected | Complexity | Notes / dependency |
|---|---|---|---|
| Motion keys independent of drawing keys | The milestone's core semantic; keying a transform must not require a drawing | HIGH | Needs per-rail motion data keyed by stable rail identity (Gate B), plus `.mce` TS+Rust declaration |
| Key at current frame via lane nav diamond | The only way to add a key without touching the canvas | MEDIUM | README §4: routes through store/controller seam, else disabled with a real reason |
| Add/edit Motion key from the on-canvas gizmo | Animators expect to move the thing, not type numbers | MEDIUM | Reuse `canvas/transformHandles.ts` + `PhysicsPaintReferenceTransformHandles.tsx` pattern [CODE] |
| Numeric channel entry (per channel, at cursor frame) | Precision on a 6 px timeline key is impossible otherwise | MEDIUM | Route through the same upsert path; one undo command |
| Position grouped, split X/Y optional | Per-axis timing is how arcs, bounces, and holds are made | MEDIUM | AE Separate Dimensions / Harmony Separate Positions [DOC] |
| Scale, Rotation, Opacity channels | The v3 transform set; Scale is missing from the v7 mockup and must be added | MEDIUM | Per-channel lane + header row; v7 geometry is `30 + 18 × channels` |
| Endpoint hold outside the keyed range | Otherwise a one-key rail does nothing visible | LOW | Evaluator clamp |
| Hold (constant) segment | Step motion is fundamental to stop-motion | LOW | AE hold keyframe; Harmony stop-motion keyframe (red) [DOC]; Spine `CURVE_STEPPED` [X] |
| Ease on a Motion key | The default reason to touch interpolation | MEDIUM | AE Easy Ease sets speed 0 / influence 33.33% on both sides [DOC] |
| Prev/next Motion key navigation per channel | Required by the v7 nav cluster | LOW | Needs a key navigator in the store, not view-local scanning |
| Delete Motion key, one undo step | Basic edit law | LOW | Existing history command pattern |
| Collapsed-state "this rail is animated" signal | Explicit v3 requirement: animated without opening lanes | LOW | Chevron state + colour (v7). See §1.4 |
| Pivot default and correctness | Rotation/scale are wrong or jittery without it | MEDIUM | Time-invariant pivot in rail space; document or expose offset |
| Compositor-applied transform (no re-bake) | Content cycles, motion continues; re-baking per frame would be O(frames × bake) | HIGH | `getFlattenedFrame` is the only content path [CODE]; the transform must apply there and in export |
| Preview = export transform | A drift here is a silent delivery bug | MEDIUM | One evaluator; pin with a parity test |
| Motion persistence in `.mce` | Motion is document data | MEDIUM | Every field declared in TS **and** Rust under `mceFieldContract.test.ts` |
| Undo/redo per key operation | Existing product law | MEDIUM | One atomic command per add/delete/move/ease |

### 1.3 Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Seeded Wiggle on a Motion key | The "alive" quality stop-motion needs, deterministic at export | MEDIUM | See §2.4; AE `wiggle(freq, amp)` + `seedRandom` is the reference [DOC] |
| Stepped wiggle (held poses, not per-frame jitter) | Matches the stop-motion look and the project's established held-pose determinism | LOW–MEDIUM | AE `posterizeTime` / quantised-time wiggle is the analogue [DOC]; expose a "step" in frames |
| Split position with per-axis key counts in one lane header | Compact, v7-shaped, better than two full lanes | MEDIUM | Lane sparkline can overlay X and Y |
| Lane sparkline of the actual curve | Makes interpolation legible without a graph editor | MEDIUM | v7 already draws 1.5 px curves; must be data-driven, never decorative [README §6.3] |
| Copy/paste Motion keys across rails | Duplicating a camera move or a float pattern | MEDIUM | Frame-relative paste, fresh identity, one undo |
| Motion path on canvas (spatial Bezier) | Curved arcs without faking them with split X/Y | HIGH | AE spatial vs temporal independence [DOC]; defer past v1 |
| Ease preset intensity (0–100%) | Faster than handle editing for "a bit more ease" | LOW | Superset of AE influence |

### 1.4 Discoverability — what "one lane per channel, opened on demand" implies

This is the highest-risk usability decision in the milestone, because the v3/v7 model deliberately hides lanes by default.

1. **Collapsed rails must self-announce animation.** The only in-row signals are the chevron glyph (`minus` / `right` / `down`) and its colour [README §3]. That is defensible **only** because v3 explicitly requires "a rail must read as animated without opening its lanes" [CONTEXT §3.5]. Do not copy After Effects here: in AE, collapsing a property group hides every keyframe, and the only remaining cue is the motion path in the Composition panel — a recurring complaint in graph-editor guides [X].
2. **Harmony is the better model:** peg keyframes are visible on the peg row whether or not the Function view is open [DOC]. Our equivalent is the rail row's chevron colour plus a key count that becomes discoverable after one click.
3. **The empty state needs an action, not a passive chevron.** A grey `minus` that "does nothing" [README §3] teaches users the feature does not exist. The v3 action bar had `Animate`; AE has the property stopwatch; Harmony has Animate mode + F6. Recommendation: keep one rail-scope **Animate** command that (a) creates the first Motion key at the cursor frame on the channel(s) the user is about to touch, or (b) at minimum opens the lane block with an armed empty state. Without this, "opened on demand" equals "never opened."
4. **One control, two scopes.** The chevron lives in the **track** header, but expansion belongs to the **selected rail** [README §3]. When no rail is selected, the meaning of "expand" is undefined; the control must either select the track's active rail first or be disabled with a real reason — never act on an invisible subject.
5. **Lanes never change selection scope** [CONTEXT §3.4] is correct and should be stated in the empty state copy: clicking a lane adds/edits a Motion key, it does not turn the rail into a motion selection.
6. **One open block at a time** (selection-owned expansion) is a deliberate simplification. AE and Harmony allow many groups open at once; the tradeoff is losing cross-rail comparison. Ship one, but the store shape should not make "several expanded" impossible later.
7. **Header/lane lockstep must be exact.** Pinned header rows and lane rows scroll independently; any 18 px drift reads as a broken feature and makes the nav cluster target the wrong channel [README §4].
8. **Target asymmetry.** Drawing cells are 16×22, Motion keys are 6×6 [README §2]. v2 already recorded the lesson: "the rail is a big target, keys are 8 px targets — no group drag when aiming at a key." Add hover affordances and never let a rail-body drag start inside a key/handle hit radius.
9. **The action bar is the teaching surface.** Three scopes with three distinct command sets (rail: Animate/Transform/Edit/Delete; drawing key: Edit drawing/Duplicate/Delete; motion key: Ease/Wiggle/Hold/Delete) [CONTEXT §3.2]. Ease/Wiggle/Hold appearing **only** in the motion-key scope is itself the rule made visible — do not also expose them on the rail body "for convenience."

### 1.5 The Ease / Wiggle / Hold ownership rule (locked, and why it is right)

| Command | Attaches to | Applies to | Segment semantics | Real-tool precedent |
|---|---|---|---|---|
| **Ease** | Motion key | The rail transform | Eases the segment(s) adjacent to the key; symmetric by default, per-side later | AE Easy Ease + influence; Harmony velocity/bezier handles [DOC] |
| **Hold** | Motion key (outgoing) | The rail transform | Value stays constant from this key to the next (a step), then jumps | AE hold keyframe; Harmony stop-motion keyframe; Spine stepped [DOC/X] |
| **Wiggle** | Motion key | The rail transform | Deterministic noise added to the interpolated baseline for that segment | AE `wiggle()` + `seedRandom`; AE stepped wiggle via `posterizeTime` [DOC] |

Why they must not sit on drawing keys or the rail body: a drawing key changes *which drawing is shown*; a rail body is a group-move target. Attaching interpolation commands to either produces exactly the v2 confusion the v3 model was written to end [CONTEXT §3.7]. It also keeps the three selection scopes disjoint: each scope's commands change only its own subject.

### 1.6 Anti-features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Baking motion into drawing keys / frame caches | "Simpler to render" | Breaks cycles, costs a re-bake per frame, contradicts v3, destroys determinism economics | Apply the transform at the compositor; cache content only |
| Motion keys constrained to existing drawing keys | The initial notes said so | v3 superseded it; forces fake drawings to animate; Harmony/AE both allow independent keys | Independent Motion keys |
| A full graph/curve editor in v1 | "Pro tools have one" | Large surface (handles, value vs speed graph, zoom, selection) and the frame-strip timeline has no natural home for it; TVPaint keeps easing in a separate speed-curve editor, Harmony in a separate Function view [DOC] | Lane sparkline + key commands (Ease/Hold/Wiggle) + numeric entry |
| Silent auto-key on every transform | "Always animated" | Harmony ships a preference to disable exactly this; silent keys make ordinary layout edits undo-resistant [DOC] | Explicit Animate/armed state, visible indicator |
| Pivot derived from per-frame raster bounds | "Easy" | Pivot drifts when the drawing changes per frame; rotation appears to wobble | Time-invariant pivot in rail space |
| Normalising rotation to 0..360 | "Clean data" | Kills multi-turn spins; interpolation reverses at the wrap | Unbounded rotation values |
| Skew / 3D / perspective channels | "Harmony has skew" | Adds channels to every lane, header, schema and export path for a rarely used transform; not in v3 | Position, Scale, Rotation, Opacity only |
| Merging with `PhysicPaintRotoScriptMotionSettings` or the Roto in-between interpolation controls | Reuse | Three different systems: generated in-between drawings, per-stroke script wiggle, and rail transform channels [PROJECT.md constraint; CONTEXT §6.12] | Separate model, separate persistence, separate UI |
| Animating per drawing key as the unit | v2 draft | Duplicates transform state per drawing; the v3 model made the occurrence the unit | One transform per rail |

---

## Capability 2 — Interpolation model

### 2.1 What 2D animation tools actually expose

| Curve / type | Where it really appears | What it buys the animator | Keep / drop here |
|---|---|---|---|
| **Cubic Bézier (user handles)** | Universal: Harmony Function view handles; AE Graph Editor (speed or value); TVPaint "Spline"; Spine Bezier runtime data [DOC/X] | Direct control of acceleration and overshoot; the only representation that covers all others | **KEEP** as the one editable representation |
| **Linear** | Every tool; Harmony's default between motion keys; Spine `CURVE_LINEAR` [DOC] | Constant-rate moves; predictable spacing | **KEEP** as a preset |
| **Hold / step / constant** | AE hold keyframes; Harmony stop-motion keyframes (red); Spine `CURVE_STEPPED`; TVPaint expresses holds as a flat speed curve [DOC/X] | Stop-motion timing; snaps; mechanical holds | **KEEP** as a preset (and a candidate default for a stop-motion product) |
| **Catmull-Rom / auto-smooth** | Rarely named in 2D timelines; exposed as "Smooth"/"Auto" tangent modes (TVPaint Smooth, AE auto bezier) [DOC/K] | Smooth motion through many keys with zero handle work | **KEEP as a preset** that generates Bézier handles; do not expose the name |
| **Hermite** | Not a user-facing curve type; the math under Catmull-Rom/TCB/Bézier | Nothing a user chooses | **DROP from UI** (it is the implementation) |
| **B-Spline** | Path/shape design (Illustrator/Inkscape-class curves, path effects), not animation timelines; approximating, so it misses its control points and reduces wiggle on dense point sets [X] | Smooth flowing paths, local control | **DROP from animation channels**; optionally a path-smoothing option in the vector tool with an explicit "does not pass through points" warning |
| **TCB (Kochanek-Bartels)** | 3ds Max TCB controllers; Harmony exposes Bias/Tension/Continuity as advanced function-curve parameters; t=c=b=0 reduces exactly to Catmull-Rom [DOC/X] | Overshoot/settle control and asymmetric tangents — all reproducible with Bézier handles | **DROP as a type** for v1; revisit as per-key tension/bias only if animators ask |

The pattern across shipped 2D tools is consistent: **one editable representation (cubic Bézier) plus a small set of automatic tangent presets and a step mode.** Spine's runtime ships exactly three curve types — linear, stepped, Bezier [X]. After Effects stores Bézier plus hold; Harmony stores motion vs stop-motion keyframes and edits velocity/bezier [DOC]. None of them ask the animator to pick "Hermite vs Catmull-Rom vs B-Spline vs TCB" per key.

### 2.2 Recommendation for this product

Expose **three segment behaviours plus two per-key modifiers**:

1. **Linear** — for transforms that should not ease.
2. **Ease** — symmetric auto-smooth (ease-in-out) plus an intensity; internally generated Bézier handles.
3. **Hold** — step.
4. **Wiggle** (per Motion key) — additive deterministic noise on the segment (see §2.4).
5. **Per-key curve handles** — deferred; the lane sparkline shows the resulting curve, numeric/key commands set it.

Reject the a-la-carte spline picker. It is not what 2D animation tools ship, it multiplies QA (five evaluators), and it makes the document schema carry per-key curve-type unions forever.

### 2.3 Interpolation is key-based, and on frames — not on drawing frames

The user's law is correct and matches the industry: interpolate between **Motion keys**, and let ordinary frames repeat the previous drawing (that is the content cycle, not interpolation) [CONTEXT §4]. Two distinct mechanisms must not be conflated:

- **Content repetition** (the `-` frames in `x1--x2`) — the rail's drawing exposure.
- **Transform interpolation** (the same `-` frames evaluate a moving transform) — Motion channels.

A frame may be both: content repeated from the previous drawing key, transform interpolated in real time. That is exactly what "content cycles, motion continues" means, and it is why the transform cannot be baked into the content raster.

### 2.4 Wiggle — concrete parameters and determinism

| Parameter | Meaning | Unit | Default |
|---|---|---|---|
| Amplitude | Peak deviation from the interpolated value | Channel units (px, %, degrees, opacity points) | small (e.g. 2 px) |
| Frequency | Cycles per second, or cycles per segment | Hz or cycles/segment | 1–2 |
| Step / posterize | How many frames each noise sample is held | integer frames | 2 (stop-motion look) |
| Seed | Deterministic noise seed | integer or derived | derived from stable rail + channel + key identity (FNV-1a, matching the project's traceSeed law) [CODE] |
| Re-roll | Bumps the seed | button | optional |

Grounding: AE exposes frequency and amplitude as `wiggle(freq, amp)` and determinism via `seedRandom`; stepped wiggle is achieved with quantised time or `posterizeTime` [DOC]. Storing a derived seed rather than a user-visible number keeps the UI clean while guaranteeing export determinism; an explicit re-roll is the escape hatch (AE's own escape hatch is the expression text rather than a seed field [K]).

Do **not** evaluate wiggle at sub-frame time. The paint time law is an integer 60 Hz tick grid and the product's stop-motion stance is held poses, not per-frame jitter [PROJECT.md].

---

## Capability 3 — Timeline horizontal zoom (frame-strip timeline)

### 3.1 What the minimum actually is

| Tool | Zoom-in / out | Fit / reset | Wheel | Visible control | Notes |
|---|---|---|---|---|---|
| Premiere Pro | `=`, `-` | `\` zoom to fit sequence | Alt/Option+wheel; pinch | Bottom horizontal zoom scrollbar | Documented as expanding around the playhead; no user-selectable anchor found [DOC] |
| After Effects | `=`, `-` | `Shift+/` zoom to fit in viewer panels | — | Scrollbar | Timeline anchor behaviour not documented in the fetched material [DOC/LOW] |
| Toon Boom Harmony | `2`, `1` | **Reset Zoom** icon | Cmd/Ctrl+wheel over timeline | Timeline Zoom slider | Thumbnails appear only once frames are wide enough; **no Fit command** documented [DOC] |
| Dragonframe | — | — | — | "M. Scale" control + scrollbar | Stop-motion comparator; no shortcut documented [DOC] |
| This product (locked scope) | Cmd/Ctrl+wheel (cursor-anchored) | Fit (clamped) | Plain wheel stays horizontal scroll | Zoom pill: minus / percent / plus / Fit | 0.25×–4×, 100% = 18 px pitch, session-only [CONTEXT §5.6] |

The consistent floor across tools: **a modifier+wheel gesture, a visible scale readout, and an escape back to a sane view.** "Fit" is an NLE expectation (Premiere `\`); Harmony does not have one, so Fit is table stakes **for this product's NLE-class bar**, not a universal.

### 3.2 Table stakes

| Feature | Why Expected | Complexity | Notes / dependency |
|---|---|---|---|
| Cursor-anchored Cmd/Ctrl+wheel zoom | The only gesture that keeps the frame you are looking at under the pointer | MEDIUM | Anchor = frame under cursor at wheel time; recompute scroll after scale |
| Zoom pill: minus / percent / plus / Fit | A visible, clickable authority; no hidden state | LOW | Mirror the shipped Studio **canvas** zoom pill conventions [CODE: `PhysicsPaintCanvasZoomViewport.tsx`] — but keep the two systems independent |
| Presets 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 | Predictable stops; Harmony ships graded zoom keys, Premiere graded steps | LOW | 100% = base 18 px pitch |
| Fit computes and clamps, with overflow allowed at 0.25× | Escape hatch from 4×; a long document may still overflow | LOW | Never silently violate the min |
| One scale authority feeding every frame→px mapping | 56 direct `ROTO_CELL_WIDTH_PX` uses plus v7 tokens; a second source of truth guarantees drift | HIGH | Ruler ticks, playhead, cells, ghosts, sound stains, scroll-to-frame, hit-testing, drag math, `frameCount × pitch − gap` rail rule [CODE/CONTEXT §5.6] |
| Row, lane, and cell **heights** stay fixed | The milestone explicitly scopes zoom to frame density | LOW | Prevents reflow of motion lanes |
| Session-only, no document/schema/export change | A view preference is not document data | LOW | Reset on Studio close, like canvas zoom |
| Instant transition | Zooming is navigation, not an animation | LOW | No tweening |

### 3.3 Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Keyboard presets (Harmony `1`/`2`, Premiere `=`/`-`) | Fast, discoverable, no pointer travel | LOW | Map to the same preset ladder |
| Double-click the percent readout resets to 100% | One-gesture escape from any zoom | LOW | Cheap and expected of a pill |
| Zoom anchored on selection / playhead as explicit commands | "Look at what I care about" | LOW–MEDIUM | Distinct from wheel anchoring (cursor) |
| Thumbnails at high zoom | Harmony's payoff for zooming in; aids key timing | HIGH | Out of scope for Phase 60 (cells stay 16×22); note as future |
| Adaptive ruler labels (ticks every N frames) | Readable ruler at 0.25× and 4× | MEDIUM | Without it the ruler becomes noise; one label-step function |
| "Previous zoom" toggle | Comparing two densities | LOW | Session-only memory |

### 3.4 Anti-features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Vertical/row-height zoom bundled with horizontal zoom | "NLEs do it" | Reflows motion lanes, violates locked scope, doubles the gesture surface | Horizontal only; row height is a separate future feature if ever needed |
| Persisting zoom in `.mce` | "Remember my view" | Turns a display preference into document churn and a schema field; the product already treats canvas zoom as session-only | Session-only signal |
| Wheel zoom anchored to the playhead | "Keep the playhead visible" | The playhead can be off-screen; users aim with the pointer | Cursor anchor for wheel; playhead/centre anchor for pill and Fit |
| Animated/tweened zoom | "Feels smooth" | Breaks scrub-drag math during the tween; disorienting in a frame strip | Instant |
| Integer cell width but fractional pitch (or vice versa) | Sloppy rounding | At 0.25× the 18 px pitch is 4.5 px: cells, gaps, and playhead drift apart by up to a frame over a long document | One rounding rule: compute pitch as a float, derive cell width and gap from it, rasterise once |
| Patching `ROTO_CELL_WIDTH_PX` at call sites with ad-hoc multipliers | Fastest local fix | Guarantees a missed site (drag ghosts, sound stains, scroll-to-frame) | A single `pitch = base × zoom` authority consumed everywhere |
| Zoom during an active drag | Continuous input | Drags capture a start pitch; live rescale desynchronises ghost and target | Ignore wheel while a drag gesture is active |
| Auto-zoom on scrub/playhead follow | "Always in view" | Steals control from the animator; fights the manual viewport law already shipped | Manual only |

---

## Capability 4 — Vector painting tool

### 4.1 What a vector stroke tool has to do

**Creation (pen-tool).**
- Click = corner vertex; click-drag = smooth vertex with symmetric out-handle (Illustrator/Krita/Inkscape/AE convention) [DOC/X].
- Rubber-band preview of the segment from the last vertex to the pointer.
- Close the path by clicking the first vertex; finish open with Enter or double-click; cancel with Esc; Backspace removes the last placed vertex while still drawing [K — near-universal, not separately fetched].
- Width can come from pressure at creation (the project already captures `pressure` per anchor and preserves it: `BezierAnchor.pressure` [CODE: `app/src/types/paint.ts:46`]).

**Editing (spline-pointer).**
- Drag an anchor; drag a handle with the opposite handle coupled; Alt/Option breaks coupling into a corner (the project already models this as `cornerMode` and `updateCoupledHandle` [CODE: `app/src/lib/bezierPath.ts`]).
- Click a segment to insert a vertex there (`insertAnchorOnSegment` exists [CODE]).
- Delete selected vertices (`deleteAnchor` exists [CODE]); delete the whole path from the path/objects surface.
- Shift-click and marquee multi-select vertices; move several at once; one undo per gesture.
- Cursor feedback per zone (anchor / handle / segment / body), with screen-pixel-sized hit targets.

**Per-vertex paint properties.**

| Property | Industry reality | Recommendation here |
|---|---|---|
| **Width / size per vertex** | Standard: Illustrator Width tool (width points, Alt for one-sided, Shift multi-select, numeric Side1/Side2, lockable to anchors) [DOC]; Moho Line Width tool keys per-point width [DOC]; Inkscape PowerStroke width points [DOC]; CSP Adjust Line Width / Object tool [DOC] | **BUILD** — table stakes for a "vector painting" tool |
| **Color per vertex** | Rare: Illustrator cannot vary color along one path (LPEs change geometry, not style) [DOC]; Inkscape single-style paths, workarounds require duplicates/flatten [DOC]; Moho outline color is shape-style level [DOC] | **BUILD WITH A SEGMENT MODEL, or defer** — either color applies from vertex *i* to *i+1* with a hard/gradient transition, or ship stroke-level color in v1; see §4.4 |
| **Brush type per vertex** | Not offered by any tool surveyed; a stroke belongs to one brush | **DO NOT BUILD** — per-stroke brush identity; per-vertex brush mixing has no reference implementation and breaks stroke rendering |
| **Opacity/pressure response per vertex** | Common as a by-product of width or of stylus pressure | Optional; cheap if width exists |

The architectural constraint that decides this: `StudioStroke` carries **one** `color` per stroke and an opaque engine payload [CODE: `packages/efx-paint-host/src/animation/types.ts:34`]. Per-vertex color therefore forces either segmented rendering (N sub-strokes) or a new vector stroke kind that owns its own color ramp. That is a Phase-61 planning decision, not a UI toggle.

**Curve-type choice.** Recommendation: the editable representation is cubic Bézier only, matching every mainstream vector drawing app [DOC: Krita "Edit Shapes"; Illustrator and Inkscape pen/path tools; Figma on knowledge tier]. Offer **auto-smooth (Catmull-Rom-equivalent)** as a creation/convert preset that generates handles. Do not offer Hermite (implementation), B-Spline (misses points), or TCB (superseded by handles) as per-vertex types. If a "curve type" selector is required by the milestone, implement it as a **smoothing preset** (Corner / Smooth / Auto), not as separate math per vertex.

**Wireframe preview.** The real precedent is a *display mode*, not a geometry mode: Illustrator Outline view shows paths only for fast editing [K, high confidence]; Harmony's OpenGL view is the fast low-fidelity mode against Render view [DOC]; Harmony "Show Strokes" draws strokes as blue lines to inspect intersections [DOC]. Concretely: a canvas toggle that renders every stroke of the active vector layer as a 1 px line with visible anchors/handles, skipping paint fill/sim. This is not cosmetic in this product — it is the drag-time mode that makes vertex editing interactive (see §4.4).

### 4.2 Table stakes

| Feature | Why Expected | Complexity | Notes / dependency |
|---|---|---|---|
| pen-tool create: click corner, drag smooth, rubber band | The definition of a pen tool | MEDIUM | New tool in the Studio edit surface; must respect `isPaintEditMode()` shortcut guards [PROJECT.md] |
| Finish / cancel gestures; close path | Without them every path is trapped | LOW | Enter, double-click, Esc, Backspace-last-vertex |
| spline-pointer edit mode with visible anchors and handles | Locked by the milestone (two icons in the modal) | MEDIUM | Reuse `bezierPath.ts` math + hit-testing |
| Coupled handles + Alt-break to corner | Industry-standard corner editing | LOW–MEDIUM | `cornerMode`, `updateCoupledHandle` exist [CODE] |
| Add vertex on a segment; delete vertex; delete path | Basic topology editing | LOW–MEDIUM | `insertAnchorOnSegment`, `deleteAnchor` exist [CODE] |
| Multi-select vertices and move them together | Required for real editing | MEDIUM | Marquee + shift-click; one undo |
| Per-vertex width | The feature that makes it "painting", not "shapes" | MEDIUM | Width profile along the path, not just anchor marks |
| Per-vertex value inspection and numeric entry (at least width) | Precision | LOW–MEDIUM | Inspector row per selected vertex |
| Wireframe toggle | Locked by the milestone; also the performance escape | MEDIUM | Renders paths only; must not change the stored document |
| Per-stroke brush + color baseline | A vector stroke is still a painted stroke | LOW | Existing brush/color surface |
| Undo/redo per operation | Existing law | MEDIUM | One command per add/move/delete/insert |
| Distinguishable stroke kind in the document and export | Must exist in `.mce` and in the flattened raster | HIGH | New stroke kind + TS/Rust fields under the field-diff pin |

### 4.3 Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Per-vertex color with segment semantics | Artists ask for it; few tools deliver it | HIGH | Segment color (vertex i to i+1), hard or interpolated; segmented rendering |
| Per-vertex width keyframable on playback | A stroke that thickens as it draws | MEDIUM | Reuses the script envelope; deterministic replay |
| Width profile presets (Illustrator-style) | Reusable tapered ends | LOW | Store a named profile, apply at creation |
| Live cheap preview while dragging, exact on release | Best of both: responsive + faithful | HIGH | Requires a fast path renderer distinct from the sim |
| Convert an existing freehand/fitted stroke into an editable vector path | Removes the "redo it with the pen" tax | MEDIUM | `pointsToBezierAnchors` already exists [CODE] |
| Curve-type as smoothing presets (Corner/Smooth/Auto) | Satisfies the "curve choice" ask without five engines | LOW–MEDIUM | Generates handles; one evaluator |
| Vertex-level snap/align guides | Clean shapes | MEDIUM | Defer |

### 4.4 Anti-features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Five independent curve engines (Bézier + Hermite + Catmull-Rom + B-Spline + TCB) selectable per vertex | The milestone names them | Five evaluators, five schemas, five QA surfaces; no 2D vector app ships this; mixed curve types inside one path are unpredictable | Bézier + smoothing presets |
| B-Spline as a default creation type | "Smoother curves" | The path no longer passes through where the user clicked; every handle edit becomes indirect | Auto-smooth (interpolating) default |
| Per-vertex brush *type* | "Maximum control" | No reference implementation; strokes are one brush; rendering and the sim cannot blend arbitrary brush engines mid-stroke | Per-vertex width/color, per-stroke brush |
| Re-running the watercolor simulation on every pointer move | "WYSIWYG while dragging" | The engine replays a fluid sim; a per-drag bake cannot hold 60 fps and would flood the cache | Wireframe during drag, exact render on release (the milestone's own Gate 4) |
| Auto-vectorising every existing paint stroke | "Make everything editable" | Destroys the baked watercolor look, inflates `.mce`, changes determinism economics | Explicit convert action on the selected stroke only |
| Editing through a modal that blocks the canvas | "A clean editor" | Vertex editing is a direct-manipulation task; the milestone already places the toggles in the modal, but the canvas must stay live | Movable modal (the product's PlayScript dialog pattern) |
| Reusing the main editor's motion-path UI for stroke paths | "There is already a Bezier editor" | The editor path edits a layer's spatial position keys; the vector tool edits stroke geometry with paint properties. Same math, different model | Share `bezierPath.ts`, never the store/UI |

### 4.5 Gate answers (the milestone's five vector gates)

| Gate | Answer from research |
|---|---|
| 1. Reuse the editor's existing Bezier / animation-path editing | Reuse the **math** (`bezierPath.ts`: evaluate, fit, insert, delete, couple, drag, hit-test) and the `BezierAnchor` type; do **not** reuse the motion-path store or overlay — different subject (stroke geometry vs layer position keys) |
| 2. Per-vertex paint properties, and which | Width (standard, build), color (rare, segment model or defer), brush type (no precedent, do not build). Pressure already exists per anchor [CODE] |
| 3. Add Hermite / Catmull-Rom / B-Spline / TCB | No — as curve types. Catmull-Rom-equivalent ships as "Auto/Smooth"; the others are either implementation (Hermite) or harmful defaults (B-Spline) or redundant (TCB). Revisit tension/bias only if asked |
| 4. Wireframe preview | Yes — path-only display mode; also the drag-time performance mode. Precedent: Illustrator Outline, Harmony OpenGL vs Render, Harmony Show Strokes |
| 5. Interpolation wiggle in the animation | Yes, but it belongs to **Motion keys** (Capability 1 / §2.4), not to vector vertices |

---

## Feature dependencies

```
[Rail identity: loopId / railId]
    └──requires──> [Motion keys per rail]
                        ├──requires──> [Motion evaluator (rail-local time, channels)]
                        │                  ├──requires──> [Compositor transform in getFlattenedFrame]
                        │                  └──requires──> [Export parity + deterministic wiggle]
                        ├──requires──> [.mce motion persistence, TS+Rust field-diff]
                        └──requires──> [v7 lane UI + 3 selection scopes + action bar]

[Timeline zoom]
    └──requires──> [Single frame→px authority over ROTO_CELL_WIDTH_PX + v7 tokens]
    └──enhances──> [Motion lanes] (frame-level precision when editing Motion keys)

[Vector tool]
    ├──requires──> [bezierPath.ts math + BezierAnchor]
    ├──requires──> [New vector stroke kind + render path (wireframe / paint)]
    ├──requires──> [Per-vertex property model + .mce persistence]
    └──requires──> [Undo command integration + tool mode switching]

[Painted-stroke curve editing (Phase 62)]
    ├──requires──> [Vector tool's path editing surface]
    ├──requires──> [Deterministic re-bake of the edited stroke]
    └──conflicts──> [Live sim-on-drag] (re-bake is bounded: diffusionFrames ≤ 600)
```

### Dependency notes

- **Motion channels require rail identity.** Loop clips already have a stable `loopId`; a bare key rail needs a `railId` plus split/delete rules, or v1 ships loop clips only (Gate B) [CONTEXT §3.6]. Motion persistence hangs off that identity.
- **Motion channels require the compositor to be the transform owner.** `getFlattenedFrame` is the sole content path for preview and export [PROJECT.md]. The transform must be applied there, once, or preview/export diverge.
- **Motion channels require `.mce` dual-language declarations** for every new field [PROJECT.md constraint; `mceFieldContract.test.ts`].
- **Zoom requires collapsing 56 hard-coded `ROTO_CELL_WIDTH_PX` sites and the CSS custom properties onto one scale authority** [CODE; CONTEXT §5.6]. It is mechanical but wide; that is why it is a phase.
- **Vector tool requires a rendering decision before UI work.** The watercolor engine bakes a simulation; a live-editable vector stroke needs a cheap path renderer. The vector stroke kind and its renderer are the real Phase-61 scope risk, not the pen tool.
- **Phase 62 depends on Phase 61's editing surface and on a bounded, deterministic re-bake.** Editing a painted stroke is a script edit followed by a bake, not a live sim drag.
- **Texture/quality trade-off (Gate D).** Scale/rotation resample the raster; a 2× bake or a vector source is the mitigation [CONTEXT §3.6]. This is a compositor cost, not a UI feature.

---

## MVP definition

### Phase 59 — rail motion (launch set)

- [ ] Independent Motion keys on Position / Scale / Rotation / Opacity
- [ ] Grouped Position with split X/Y mode; pivot defined and time-invariant
- [ ] Unbounded rotation; endpoint hold; Hold segment
- [ ] Ease command on a Motion key (symmetric, one undo)
- [ ] Seeded, stepped Wiggle on a Motion key (deterministic at export)
- [ ] Prev/next key navigation, add/remove key from the lane nav cluster and from numeric entry
- [ ] Collapsed-rail animated signal (chevron state/colour) and an explicit rail-scope Animate empty state
- [ ] Three selection scopes with disjoint action-bar command sets; Ease/Wiggle/Hold only on Motion keys
- [ ] Compositor-applied transform; content cycles, motion continues; preview equals export
- [ ] `.mce` persistence (TS + Rust) and undo/redo per key operation

### Phase 60 — timeline zoom (launch set)

- [ ] Cursor-anchored Cmd/Ctrl+wheel
- [ ] Zoom pill (minus / percent / plus / Fit), presets 0.25×–4×, 100% = 18 px
- [ ] Fit computed and clamped; playhead-anchored pill, centre fallback
- [ ] One pitch authority across every frame→px mapping; fixed heights; instant; session-only

### Phase 61 — vector tool (launch set)

- [ ] pen-tool creation (corner/smooth, rubber band, close/finish/cancel, backspace)
- [ ] spline-pointer editing (anchors, coupled handles, Alt-break, insert, delete, multi-select)
- [ ] Per-vertex width; per-stroke brush and color
- [ ] Wireframe display toggle that also serves as the drag-time mode
- [ ] New vector stroke kind persisted and exported; undo per operation
- [ ] Curve behavior: Bézier + smoothing presets (Corner / Smooth / Auto)

### Add after validation (v1.x)

- Per-vertex color (segment model) — after measuring the render cost per segment
- Per-key ease intensity; per-key tension/bias only if requested
- Copy/paste Motion keys across rails
- Motion path on canvas (spatial Bézier)
- Zoom-to-selection / keyboard zoom presets / adaptive ruler labels
- Width-profile presets; convert freehand stroke to vector path
- Multiple simultaneously expanded motion blocks

### Future consideration (v2+)

- Graph/curve editor for motion channels
- Skew/3D/perspective channels
- Thumbnails in the timeline at high zoom
- Vertex constraints/snapping for vector paths

---

## Feature prioritization matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Independent Motion keys per channel | HIGH | HIGH | P1 |
| Compositor-applied transform (no re-bake) | HIGH | HIGH | P1 |
| Position grouped + split X/Y | HIGH | MEDIUM | P1 |
| Pivot correctness | HIGH | MEDIUM | P1 |
| Hold / Ease on Motion keys | HIGH | MEDIUM | P1 |
| Collapsed-rail animated signal + Animate empty state | HIGH | LOW | P1 |
| Prev/next nav cluster | MEDIUM | LOW | P1 |
| Seeded stepped Wiggle | HIGH | MEDIUM | P1 |
| `.mce` motion persistence + dual-language pin | HIGH | MEDIUM | P1 |
| Cursor-anchored wheel zoom + pill + Fit | HIGH | MEDIUM | P1 |
| Single pitch authority (all mappings) | HIGH | HIGH | P1 |
| Pen tool create/edit | HIGH | HIGH | P1 |
| Per-vertex width | HIGH | MEDIUM | P1 |
| Wireframe toggle | HIGH | MEDIUM | P1 |
| Per-vertex color | MEDIUM | HIGH | P2 |
| Motion path on canvas | MEDIUM | HIGH | P2 |
| Ease intensity | MEDIUM | LOW | P2 |
| Copy/paste Motion keys | MEDIUM | MEDIUM | P2 |
| Zoom keyboard presets / zoom-to-selection | MEDIUM | LOW | P2 |
| Width profile presets | MEDIUM | LOW | P2 |
| Graph editor | LOW | HIGH | P3 |
| Thumbnails at zoom | LOW–MEDIUM | HIGH | P3 |
| Extra curve engines (B-Spline/TCB) | LOW | HIGH | P3 (reject) |

---

## Competitor feature analysis

| Feature | Toon Boom Harmony | After Effects | TVPaint | Moho / Illustrator | This product |
|---|---|---|---|---|---|
| Transform keys separate from content keys | Peg vs drawing exposure (F5/F6/F7) [DOC] | Transform properties vs source [DOC] | Keyframer FX vs drawing keys [DOC] | Layer transform vs switch/point data [DOC] | Motion keys vs drawing keys (v3) |
| Split channels | Separate Positions / Separate Scales [DOC] | Separate Dimensions (X/Y/Z) [DOC] | Per-axis not documented | Point/line-width per point (Moho) [DOC] | Position split X/Y; Scale single lane |
| Hold / step | Stop-motion keyframe (red) [DOC] | Hold keyframe [DOC] | Flat speed curve [DOC] | Stepped keyframe (K) | Hold on Motion key |
| Ease | Velocity + Bezier handles in Function view; Bias/Tension/Continuity advanced params [DOC] | Easy Ease + influence/velocity [DOC] | Spline / Smooth + speed curve [DOC] | Bezier channels | Ease command + intensity (P2) |
| Wiggle | Not a documented transform feature | `wiggle()` + `seedRandom`, stepped via `posterizeTime` [DOC] | Not documented | Noise/deformer (K) | Seeded, stepped, deterministic at export |
| Timeline horizontal zoom | Slider + Reset + `1`/`2` + Cmd/Ctrl+wheel; no Fit [DOC] | `=`/`-`, fit in viewers [DOC] | Zoom via timeline UI (K) | — | Wheel + pill + Fit (locked) |
| Per-vertex width | Variable line thickness exists; per-point keyed width is Moho's model [DOC] | Shape-path only (no paint) | N/A | Moho Line Width tool; Illustrator Width tool [DOC] | Yes (P1) |
| Per-vertex color | Not on a shape stroke [DOC/K] | N/A | N/A | Not on one path (Illustrator/Inkscape) [DOC] | Segment model (P2) |
| Wireframe / fast display | OpenGL vs Render; Show Strokes [DOC] | — | — | Illustrator Outline view (K) | Toggle (P1) |

Legend: "—" = not documented in the fetched material; "(K)" = knowledge-tier.

---

## Gaps to close at phase-plan time

- **Gate C semantics** of repeat = hold vs fit-to-span: research gives the two industry analogues (per-span motion that stops, vs time-remapped stretch) but the milestone has not fixed which reading is intended. Phase 59 must decide before schema.
- **Gate B identity** (loopId vs new railId) decides whether bare key rails can animate in v1 and how motion is stored.
- **Harmony peg opacity** could not be confirmed as a peg channel from the fetched docs; opacity is a standard AE/Spine/Moho channel, so the feature stands, but do not cite Harmony for it.
- **AE timeline zoom anchor** (playhead vs pointer) is not in the fetched reference; treat any "AE zooms around the playhead" claim as LOW.
- **Spine 4.x curve presets** are not documented in the fetched material; only the runtime's linear/stepped/Bezier data model is confirmed.
- **6×6 Motion keys** are smaller than the industry's typical 8–10 px key markers; no source supports 6 px as a comfortable target. The v7 spec locks it, so plan a hover affordance rather than reopening the visual.
- **Per-vertex color rendering cost** on this engine is unmeasured; it is the deciding factor between P1 and P2.

## Sources

**Official documentation (MEDIUM per single-source web tier):**
- Toon Boom Harmony 20 Advanced — "Animating with Keyframes" (peg vs drawing keys, F5/F6/F7, Separate Positions/Scales)
- Toon Boom Harmony 24 — PegNode class reference (transform channels, pivot)
- Toon Boom Harmony 24 — Function view / About keyframes (bezier, velocity, stop-motion keyframes, Bias/Tension/Continuity)
- Toon Boom Harmony 25 Premium — "Disabling Animation Keyframe Creation When Transforming Elements"
- Toon Boom Harmony 27 — "Displaying Drawing Thumbnails in the Timeline View" (zoom slider, reset zoom, `1`/`2`, Cmd/Ctrl+wheel, no Fit)
- Adobe After Effects reference — keyframes, Separate Dimensions, Graph Editor speed vs value, Easy Ease/influence, Keyframe Velocity, hold keyframes, `wiggle`/`seedRandom`/`posterizeTime`, timeline zoom keys
- Adobe Illustrator — Width tool (width points, one-sided, multi-select, numeric, profiles)
- Adobe Premiere Pro reference — timeline zoom `=`/`-`/`\`, Alt/Option+wheel, playhead-centred zoom
- Krita — Vector Graphics manual (Path/Polyline/Bezier, style-defined uniform outline width, Edit Shapes)
- Inkscape — Live Path Effects / PowerStroke (width points, geometry-not-style limitation, no color along one path)
- TVPaint — Camera Speed Curves, FX Stack keyframes/additional operations (Linear/Spline/Smooth, flat curve = hold)
- Dragonframe 2025 guide — timeline Scale control

**Cross-checked / runtime sources (MEDIUM):**
- EsotericSoftware spine-runtimes `Animation.c` / `spine-core` — `CURVE_LINEAR`, `CURVE_STEPPED`, Bezier segments per property timeline

**Local codebase (HIGH):**
- `app/src/lib/bezierPath.ts` — pure Bezier math, fit-curve conversion, insert/delete/couple/drag/hit-test
- `app/src/types/paint.ts:46` — `BezierAnchor` with per-anchor pressure and corner mode
- `app/src/types/layer.ts:63` — existing editor `EasingType` (linear / ease-in / ease-out / ease-in-out) — a separate, coarser model
- `app/src/efx-paint/document/efxPaintDocument.ts:144` — `PhotoReferenceTransform` (x, y, scaleX, scaleY, rotation) as the existing 2D transform shape
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` + `app/src/components/canvas/transformHandles.ts` — reusable gizmo pattern
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx` — shipped canvas zoom/pill conventions (separate system)
- `packages/efx-paint-host/src/animation/types.ts:34` — `StudioStroke` (single `color`, per-point pressure, opaque engine payload)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` and `view/timelineRailDesign.ts` — `ROTO_CELL_WIDTH_PX = 18` and v7 tokens
- `SPECS/v2.1.0-motion-channels/CONTEXT.md`, `README.md` — the v3 model and v7 lane contract

---
*Feature research for: v2.1.0 rail motion, timeline zoom, vector painting, curve editing*
*Researched: 2026-11-06*
