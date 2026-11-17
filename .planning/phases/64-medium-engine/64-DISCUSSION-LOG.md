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
