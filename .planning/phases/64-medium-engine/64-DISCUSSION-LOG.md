# Phase 64: Medium Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-17
**Phase:** 64-Medium Engine
**Areas discussed:** Medium selector surface, Light & emboss surface, Heavy-paint feel, Scattering calibration, Brush library sections

---

## Medium selector surface

### Where should the five-medium picker live?

| Option | Description | Selected |
|--------|-------------|----------|
| Paint tab, above the globals | Medium row directly above Water/Pigment/Flow… so picking a medium visibly jumps the rows below it; matches spec 04's "the globals panel stays the fine tuning"; only visible on the Paint tool | ✓ |
| Top bar, next to the brush dropdown | Always visible while painting, same family as the brush picker; denser top bar, medium away from the params it writes | |
| Brush tab, above the texture strip | Groups paint with the brush catalog; splits medium from the globals panel, Brush tab becomes 5 sections + texture strip + medium row | |

**User's choice:** Paint tab, above the globals.
**Notes:** None.

### Which keys does a medium write?

| Option | Description | Selected |
|--------|-------------|----------|
| The 10 table keys only | water, load, flow, bleed, dry, edge, granulation, viscosity, body, emboss; Size stays the shared slider (D-05), Lift stays the eraser popover | ✓ |
| Also size | Each medium ships its own default size; competes with the shared Size slider and the new preset sizes | |
| All 12 canonical keys | Full `AquarelleGlobalParams`; medium records would carry an eraser strength and a brush size they have no business owning | |

**User's choice:** The 10 table keys only.
**Notes:** None.

### How is a manual tweak after a medium pick shown?

| Option | Description | Selected |
|--------|-------------|----------|
| No marker; re-pick re-applies | Medium stays selected, nothing new drawn; clicking the selected medium re-applies its record — the reset path with zero extra UI | ✓ |
| An "edited" dot on the selected medium | Visible drift at a glance; costs a 10-key comparison and one more indicator | |
| An explicit "Reset to \<medium\>" action | Conditional button when drifted; duplicates what re-picking does | |

**User's choice:** No marker; re-pick re-applies.
**Notes:** None.

### What should the medium control look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Compact dropdown row | One row in the panel's row rhythm, shows the selected name, opens a 5-item menu | ✓ |
| Segmented strip of five chips | All five visible, one click each; five long names wrap or truncate in the narrow panel | |
| Five cards with painted swatches | Richest preview; costs vertical space above 10 sliders and needs a swatch generator | |

**User's choice:** Compact dropdown row.
**Notes:** None.

---

## Light & emboss surface

### Where should the three light controls live?

| Option | Description | Selected |
|--------|-------------|----------|
| Paper tab, below the grain rows | Paper relief and paint thickness are lit by the same light; the Paper tab is already the per-document render-settings home; heading becomes "Paper & Light" | ✓ |
| Paint tab, under the Emboss row | One stack for "how thick paint renders"; mixes a document scope into a session-wide panel and grows the tab past 13 controls | |
| A dedicated Light sheet | Room for a proper azimuth/elevation dial; another surface to discover, hides a live control behind a modal | |

**User's choice:** Paper tab, below the grain rows.
**Notes:** None.

### Where does the `emboss` strength control live?

| Option | Description | Selected |
|--------|-------------|----------|
| Paint tab, with the globals | Canonical per-stroke param carried by the medium and snapshotted (MED-16); tab grows to 10 rows | ✓ |
| Paper tab, next to the light | Groups relief rendering; but emboss is snapshotted per stroke, so it would sit in a per-document tab and feel global when it is not | |

**User's choice:** Paint tab, with the globals.
**Notes:** None.

### What scope does the light have?

| Option | Description | Selected |
|--------|-------------|----------|
| Per paint-layer document | Each document carries its own `light` next to its paper; matches the `.mce` carrier shape (`efx_paint_documents` keyed by layer) | ✓ |
| Project-wide, one light for all paint layers | One "scene light"; needs a different carrier than the spec names, and invalidates every layer's cache at once | |

**User's choice:** Per paint-layer document.
**Notes:** None.

### Should the light be on by default?

| Option | Description | Selected |
|--------|-------------|----------|
| On, matching the paper's upper-left | Azimuth/elevation from `paperLightFS`'s fixed direction, intensity 1.0; acrylic reads with body out of the box; watercolor still bit-identical because zero thickness lights to exactly 1.0 | ✓ |
| Off (intensity 0) | Safest default, but every new medium ships visually flat until the user finds the light control | |
| On but gentle (custom default) | Upper-left at ~0.6; calmer first impression, but "today's light" becomes an approximation | |

**User's choice:** On, matching the paper's upper-left.
**Notes:** None.

---

## Heavy-paint feel

### What should the deposited thickness be proportional to?

| Option | Description | Selected |
|--------|-------------|----------|
| The dab's own ink amount | Thickness = what that dab deposited × emboss; contour, roughness and stampJitter become real ridges; relief always agrees with the trace | ✓ |
| A separate load/capacity term | Thickness keyed off brush loading, independent of pigment concentration; a second law to keep in sync, relief can disagree with the trace | |

**User's choice:** The dab's own ink amount.
**Notes:** None.

### Should the cover (erase) pass respect the paper's tooth?

| Option | Description | Selected |
|--------|-------------|----------|
| No gate — erase uniformly | Removes everything under the footprint; cannot leave dark speckles in the valleys; gouache/acrylic say "no tooth" | ✓ |
| Gate by paper tooth | Chalk-like patchy erase; pigment that reached the valleys by bleed survives as speckles; needs the grain gate added to `liftFS` | |

**User's choice:** No gate — erase uniformly.
**Notes:** Settles spec 06's "chalk says yes / acrylic says no" as **no**.

### Should pen strokes deposit thickness?

| Option | Description | Selected |
|--------|-------------|----------|
| Brush strokes only | Matches "through each dab's own tip" literally; pen renders flat at emboss > 0, declared in the plan | ✓ |
| Pen deposits too, through its splat | A smooth round raised line; a second deposit site, no tip contour, a profile unrelated to the pen's shape | |

**User's choice:** Brush strokes only.
**Notes:** Verified `case 'pen'` splats through `splatInk` (Engine.ts:1968) — no dab loop, no tip footprint.

### How wide should the emboss's gradient sample be?

| Option | Description | Selected |
|--------|-------------|----------|
| One document texel | Same as `paperLightFS`; captures bristle striations, roughness and stampJitter grooves; document-space means no zoom shimmer | ✓ |
| Two to three texels | Broader, rounder bevel at fit-to-window zoom; washes out the finest bristle detail and departs from the paper's lighting | |
| Scale with the stroke's radius | Per-stroke ridge width; cannot be re-derived at render time from the stored field | |

**User's choice:** One document texel.
**Notes:** None.

---

## Scattering calibration

### How should `Body` map to strength?

| Option | Description | Selected |
|--------|-------------|----------|
| One shared perceptual curve | `S = S_MAX × f(body)` and erase = `f(body)`; low-mid Body stays a glaze, only high Body covers — makes UAT 3 literal | ✓ |
| One shared curve, linear | Body 50 = half scatter + half erase; the glaze band narrows and UAT 3 becomes borderline | |
| Independent curves | Separate scatter and erase tuning; breaks the physical-coherence claim, two curves to document | |

**User's choice:** One shared perceptual curve.
**Notes:** Exact `f`, `S_MAX` and epsilon recorded in the plan.

### Should fully covering paint still show the paper's tint and tooth?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — `paperCol` stays a final multiply | Paper tint, mottling and relief read through; every uMode path keeps its structure, protecting the byte-identical gates | ✓ |
| No — scattering attenuates the paper | More physical (real acrylic hides paper); touches the paper term on every uMode path | |

**User's choice:** Yes — `paperCol` stays a final multiply.
**Notes:** None.

### Should the granulation/edge modulation also scale `S`?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, scale `S` too | Grain pools opacity as well as colour; otherwise the grainiest paint looks the flattest | ✓ |
| No, leave `S` alone | Simpler KM expression; grain pools colour but not opacity, visible on chalk and pastel | |

**User's choice:** Yes, scale `S` too.
**Notes:** None.

### How should the watercolor path be protected from the KM cost?

| Option | Description | Selected |
|--------|-------------|----------|
| Early-out when `S ≈ 0` | Today's exact exponential arithmetic runs for non-scattering texels; only paint carrying `S` pays the KM cost | ✓ |
| Always run the KM form | One code path, easiest to verify band by band; every watercolor frame pays 7 × tanh + divisions per fragment | |

**User's choice:** Early-out when `S ≈ 0`.
**Notes:** None.

---

## Brush library sections

### What should the five section headers say?

| Option | Description | Selected |
|--------|-------------|----------|
| Short names: Watercolor, Gouache, Chalk, Graphite, Acrylic | Uppercase, matches the existing "BRUSHES" style and the medium dropdown names | ✓ |
| Spec verbatim: "Chalk / pastel", "Acrylic / oil" | Carries group intent; longer headers that wrap, and two headers no longer match their medium | |
| Short name plus a muted qualifier | Both label and intent; a two-tone header and more vertical space | |

**User's choice:** Short names.
**Notes:** Amends spec 07's header copy.

### Should the sections be collapsible?

| Option | Description | Selected |
|--------|-------------|----------|
| No collapse — always expanded | Fixed order, one click away, scrolling is the only navigation; matches spec 07's no-filter/no-search law | ✓ |
| Session-only collapse, all expanded by default | Folds away unused groups in a 23-card library; a new interaction and a second hidden state | |

**User's choice:** No collapse — always expanded.
**Notes:** None.

### Should the active group be indicated beyond the selected card's highlight?

| Option | Description | Selected |
|--------|-------------|----------|
| No — card highlight only | The card shows the response, the medium dropdown shows the paint | ✓ |
| Highlight the active section header | Identifiable when scrolled; a third indicator, and a lit header reads as a control | |
| A count per section header | Tells you how much is behind each group; extra text in every header | |

**User's choice:** No — card highlight only.
**Notes:** None.

---

## Claude's Discretion

- Exact `S_MAX`, the perceptual curve's exponent, the scattering epsilon, and the stable small-argument KM form.
- The exact tuned medium numbers (spec 04's amendment table is the starting point).
- The thickness deposit's proportionality constant and half-float ceiling; whether the thickness channel joins the paper-grain fingerprint and memory gauge (measured cost reported).
- `uMode == 4` handling: emboss on the premultiplied colour, alpha untouched.
- Cover-pass falloff: reuse `liftFS`'s `exp(-(q·q)²)` unchanged; tune `uAmount` if a lip appears, never the shader's support.
- Light control shape and the exact azimuth/elevation reproducing `paperLightFS`.
- The acrylic bristle striation is a procedural tip, not a texture.
- Plan decomposition across the six specs (the chain 03 → 04 → 05 → 06 → 07 → 08 is fixed).

## Deferred Ideas

- **MED-F01** — real paint height field (true impasto geometry).
- **MED-F02** — additional medium presets.
- **Pen-tool thickness** — excluded this phase; a second deposit law if ever needed.
- **Collapsible brush sections** — considered and rejected; session-only collapse if the 23-card library proves long.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing.md` — matched only on `compositing`/`export`/`watercolor` (score 0.6); unrelated to the Medium Engine.

---

# Phase 64: Medium Engine - Discussion Log (extension)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-19
**Phase:** 64-Medium Engine
**Areas discussed:** Cover under bristles, Live pickup, Wetness and dry, Reach: which brushes, Trails and smear, Sequencing vs pending UAT

**Trigger:** spike 002 (`acrylic-bristle-deposit`, VALIDATED with three conditional legs) and the user's three asks in `SPECS/v2.2.0-medium-engine/better-acrylic.md`. The phase's existing D-01…D-20 were treated as locked and not re-litigated.

---

## Cover under bristles

### At Body 100 with a hairy bristle brush, what should happen in the gaps between bristles?

| Option | Description | Selected |
|--------|-------------|----------|
| Gaps show underlayer | Cover mask from the same gather that deposits; where the brush left no paint the old paint stays. Authentic dry-brush; needs its own cost gate (the spike measured footprint cover only) | ✓ |
| Gaps stay covered | Keep the shipping footprint mask; solid opaque band, texture only from the deposit; already measured at 675.5 ms / 1.17 s | |
| Hybrid: covered core | Bristle mask with a footprint floor; core covers fully, rim breaks up; a third law nobody measured | |

**User's choice:** Gaps show underlayer.
**Notes:** Bristle-modulated cover adopted. The spike's Body-100 numbers become a reference point, not the acceptance bar — 64-22 must re-measure.

### With bristles defining the cover edge, do you still want an explicit softness control?

| Option | Description | Selected |
|--------|-------------|----------|
| Feather global row | One 0..100 control softening the cover edge and (64-24) the acrylic water edge; new canonical param, Paint tab 10 → 11 rows | ✓ |
| Bristles define the edge | No new control; profile + hairy rim are the blend; add the knob only if UAT says too sharp | |
| Reuse Edges global | Existing Edges row also drives cover softness; one control does two jobs | |

**User's choice:** Feather global row.
**Notes:** The user's original "réglage de type feather" is promoted to a canonical global shared by the cover and the water edge.

---

## Live pickup

### Pickup works live within a session but not over a frame's previously committed paint, until Apply re-bakes. How should we handle that?

| Option | Description | Selected |
|--------|-------------|----------|
| Declare the boundary | Live strokes pick up current-session paint; committed paint is picked up on Apply/replay; UAT judges pickup on the applied result | ✓ |
| Hydrate the base | Decode the committed raster into the engine at stroke start (12 B/px + decode); approximate because the base is 8-bit sRGB | |
| Replay on frame entry | Replay the frame's script into a live engine on frame open; live = applied by construction, but a re-bake per frame entry and a full engine sheet in memory | |

**User's choice:** Declare the boundary.
**Notes:** No architecture change this phase. Both rejected alternatives are recorded as deferred ideas and would be their own phase.

---

## Wetness and dry

### How should acrylic know how wet a pixel is?

| Option | Description | Selected |
|--------|-------------|----------|
| Real last-touch pair | Reference §3.4: paint stays wet for a set time, a re-touch refreshes the timer, Dry ends it; +26.1 MB at 1080² / +67.1 MB at 2K, +103 ms bake, 0 B frame cache | ✓ |
| wet × cover proxy | Free, no new layer; measures water amount, not age; re-wetting adds water instead of resetting a timer | |
| Proxy now, channel queued | Ship the Dry/pickup gate on the proxy, record the channel as a measured follow-up | |

**User's choice:** Real last-touch pair.
**Notes:** The channel joins pool 0 as one `FLOAT_R` layer with a one-week-old sentinel (a cleared 0 would read as freshly touched).

### Where should the "little water in acrylic" come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Retune the acrylic record | Raise the existing water/bleed/flow; the fluid transport gives the irregular edges; no new engine term | ✓ |
| Picked-up moisture | The carrier injects water proportional to pickup; new term with its own cost and calibration | |
| Both | Record baseline plus picked-up moisture; largest calibration surface | |

**User's choice:** Retune the acrylic record.
**Notes:** None.

---

## Reach: which brushes

### Which responses should use the per-bristle gather instead of a stamped tip?

| Option | Description | Selected |
|--------|-------------|----------|
| The two bristle presets | bristle-flat and bristle-round become geometric carriers; everything else keeps its tip; gather follows the response, not the medium | ✓ |
| Every acrylic response | Whole acrylic group gets hairs; every acrylic look changes at once | |
| Every brush | Universal deposit law; breaks the neutral bit-identity law unless gated off | |

**User's choice:** The two bristle presets.
**Notes:** A bristle response carrying the watercolor medium still gets hairs — the gather is a response property.

### What happens when a texture is picked on a bristle response?

| Option | Description | Selected |
|--------|-------------|----------|
| Texture wins | Gather turns off and the texture stamps, exactly as MED-31 reads today; clean escape hatch | ✓ |
| Geometry wins | Bristle response ignores the texture; contradicts MED-31 and leaves the picker looking broken | |
| Texture masks bristles | Texture alpha modulates each bristle profile; new law with no measurement | |

**User's choice:** Texture wins.
**Notes:** MED-31 stands unamended.

---

## Trails and smear

### Do we need a separate smear term for trails?

| Option | Description | Selected |
|--------|-------------|----------|
| Pickup is the trail | The reservoir picks up underlying colour and lays it down further along — that is the trail; no new term | ✓ |
| Add a coefficient smear | Port §3.3 in coefficient space; a new law with its own calibration and cost | |
| Smear driven by Feather | Add the smear and let Feather set its strength; couples two behaviours to one knob | |

**User's choice:** Pickup is the trail.
**Notes:** The §3.3 deposit-time smear mixes straight RGB the spectral field does not store, so it is not a port. Escalate only if UAT says the crossing does not trail enough.

---

## Sequencing vs pending UAT

### When should the pending UAT run relative to plans 64-21…64-24?

| Option | Description | Selected |
|--------|-------------|----------|
| Split the rows | Rows 1, 3, 4, 5 now against the 20-plan build; rows 2 (undo/cover) and 6 (emboss/zoom) deferred to the post-bristle UAT | ✓ |
| UAT now, then extend | Validate all 6 rows first, then extend, then re-check affected rows; a second pass | |
| Extend first, one UAT | Plan and execute first, one UAT over the whole phase; longest unvalidated stretch | |

**User's choice:** Split the rows.
**Notes:** Rows 2 and 6 are exactly what the new cover mask and the last-touch layer change; no other row is tested against a build it no longer describes.

---

## Claude's Discretion

- **Params surface:** `feather`, `pickup` and `refill` join the canonical global set and the Paint tab (13 rows); `wetSeconds` stays a medium-record value with no row.
- **Paper seed:** recorded as an additive optional document field on the light's precedent (TS + Rust in the same pass); absent reads as derived from the document id.
- The bristle slicing constants (count clamp, spacing, radius floor, reservoir layout, sentinel age, `wetSeconds` default, §6 defaults, Feather falloff shape) — each must cite its notes section.
- The seed call order for the bristle set (one `traceSeed` RNG, one draw per field even when a run is clipped).
- The existing discretion items from the 2026-11-17 log stand.

## Deferred Ideas

- **§3.3 coefficient-space smear** — rejected this phase; returns as its own measured term if pickup does not trail enough.
- **Exact live pickup parity** — base hydration and replay-on-frame-entry rejected; either is its own architecture phase.
- **Picked-up moisture feeding the fluid** — rejected; the acrylic record retune is the answer this phase.
- **Half-resolution or compressed last-touch channel** — a memory lever if +26.1 / +67.1 MB proves heavy; needs its own measurement.
- **The gather on more responses** — deferred by the reach decision; adding a response that carries it is additive.
- Prior deferred ideas (MED-F01, MED-F02, pen-tool thickness, collapsible sections) stand unchanged.
