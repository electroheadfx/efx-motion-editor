# Phase 20: Paint Brush FX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 20-Paint Brush FX
**Areas discussed:** Brush style selector UX, FX parameter exposure, Spectral mixing fidelity, Watercolor rendering approach

---

## Brush Style Selector UX

### How should users pick brush styles?

| Option | Description | Selected |
|--------|-------------|----------|
| Icon strip with labels | Horizontal row of small icons, one-click selection | |
| Dropdown selector | Standard dropdown menu, text-only labels | |
| Visual preview strip | Rendered stroke preview thumbnail per style, like Procreate | ✓ |

**User's choice:** Visual preview strip
**Notes:** None

### Should the style list be always visible or collapsible?

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | No extra click to access, takes ~90px | |
| Collapsible, open by default | Has collapse arrow, starts expanded | ✓ |
| You decide | Claude picks | |

**User's choice:** Collapsible, open by default
**Notes:** None

### When switching style mid-session, affect only new strokes or re-render existing?

| Option | Description | Selected |
|--------|-------------|----------|
| New strokes only (Recommended) | Each stroke remembers style at draw time, like Procreate/Photoshop | ✓ |
| Re-render all strokes | Changing style re-renders every stroke on current frame | |

**User's choice:** New strokes only
**Notes:** None

### Static or live preview thumbnails?

| Option | Description | Selected |
|--------|-------------|----------|
| Static previews (Recommended) | Pre-rendered thumbnails, zero runtime cost | ✓ |
| Live previews | Re-render with current color/size | |

**User's choice:** Static previews
**Notes:** None

---

## FX Parameter Exposure

### How should FX parameters be exposed?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-style relevant sliders (Recommended) | Each style shows only its relevant params | ✓ |
| All sliders always visible | Show all 5 FX params regardless of style | |
| Preset-only, no sliders | Fixed built-in values, no user adjustment | |

**User's choice:** Per-style relevant sliders
**Notes:** None

### Where should FX sliders appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate "BRUSH FX" section | New collapsible section below BRUSH, matches Tablet/Onion Skin pattern | ✓ |
| Inline in BRUSH section | FX sliders directly below size/color/opacity | |
| You decide | Claude picks | |

**User's choice:** Separate "BRUSH FX" section
**Notes:** None

### Should styles have sensible defaults or neutral defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Sensible defaults, tweak later (Recommended) | Tuned defaults per style, draw immediately | ✓ |
| Neutral defaults, user tunes | All params start at 0.5 midpoint | |

**User's choice:** Sensible defaults
**Notes:** None

### Should flat style show FX sliders?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide for flat (Recommended) | BRUSH FX section only appears for non-flat styles | ✓ |
| Show disabled for flat | Section visible but grayed out | |

**User's choice:** Hide for flat
**Notes:** None

---

## Spectral Mixing Fidelity

### Which spectral mixing approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Full Kubelka-Munk 38-band (Recommended) | Port from spectral.js, physically-correct pigment mixing | ✓ |
| Simplified 3-band approximation | RGB-space subtractive mixing, cheaper but less accurate | |
| You decide | Claude evaluates | |

**User's choice:** Full Kubelka-Munk 38-band
**Notes:** None

### Should spectral mixing apply to all non-flat styles?

| Option | Description | Selected |
|--------|-------------|----------|
| All non-flat styles (Recommended) | Consistent physically-correct blending across all styled brushes | ✓ |
| Watercolor and ink only | Other styles use standard alpha blending | |
| You decide | Claude evaluates | |

**User's choice:** All non-flat styles
**Notes:** None

---

## Watercolor Rendering Approach

### Which watercolor bleed technique?

| Option | Description | Selected |
|--------|-------------|----------|
| Tyler Hobbs polygon deformation | CPU-side, 20 overlapping layers, high fidelity | |
| GPU shader bleed effect | Fragment shader bleed, faster but less organic | |
| Hybrid — simplified polygon + GPU post-pass | 5-10 polygon layers for shape + GPU shader for fine detail | ✓ |
| You decide | Claude evaluates | |

**User's choice:** Hybrid approach
**Notes:** None

### Should watercolor bleed animate or appear instantly?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant final form (Recommended) | Computed once on stroke complete, deterministic for export | ✓ |
| Animated spread on draw | Bleed spreads over ~200-500ms, more visceral | |
| You decide | Claude picks | |

**User's choice:** Instant final form
**Notes:** None

### Paper texture: procedural noise or bundled texture?

| Option | Description | Selected |
|--------|-------------|----------|
| Procedural noise in shader (Recommended) | Perlin/simplex noise, resolution-independent, no asset dependency | ✓ |
| Bundled texture image | Pre-made paper texture PNG, more realistic, tiling seams | |
| You decide | Claude picks | |

**User's choice:** Procedural noise by default
**Notes:** User noted: "Procedural noise in shader by default but I can add bundled texture image" — architecture should support both, procedural is the default.

---

## Claude's Discretion

- Exact default FX parameter values per brush style
- WebGL2 offscreen context management strategy
- Point stamping vs textured quad technique
- Flow field preset patterns
- Shader optimization strategies
- Polygon deformation layer count (5-10)

## Deferred Ideas

None — discussion stayed within phase scope
