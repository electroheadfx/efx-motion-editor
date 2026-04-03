# Phase 2: Rendering Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 02-rendering-pipeline
**Areas discussed:** Compositing model, Paper texture role, Density-weighted transparency, Paper selector scope, Paper grain on transparent background

---

## Compositing Model

| Option | Description | Selected |
|--------|-------------|----------|
| Single-canvas pixel merge | Merge wet+dry in one compositing pass via ImageData pixel math | |
| Keep dual-canvas overlay | Main canvas = dry + background, displayCanvas = wet overlay via CSS | |
| Offscreen compositing buffer | Render wet+dry to offscreen canvas | |

**User's choice:** Discussion pivoted — user asked about wet paint behavior first.

**Key finding:** User reported that flow/diffusion does NOT visibly change stroke shape. Wet paint doesn't spread, drip, or change form. Only color blending and paper grain emboss are visible on drying. This is a critical gap.

**Follow-up decision:** Include flow fix in Phase 2 scope (not just compositing).

**Final compositing decision:** Current dual-canvas overlay works, keep it. Focus effort on flow fix + transparency.

---

## Paper Texture Role

| Option | Description | Selected |
|--------|-------------|----------|
| Paper emboss looks doubled | Paper texture applied twice during rendering | |
| Paper background + physics is fine | Two uses are separate and correct | ✓ |
| Not sure — investigate | Claude analyzes code for double-application | |

**User's choice:** "No, it looks ok" — paper texture is not being double-applied.

---

## Density-Weighted Transparency

| Option | Description | Selected |
|--------|-------------|----------|
| Density-driven | Alpha from accumulated pigment density per pixel | ✓ |
| Current approach good enough | Keep simple wetAlpha/2000 mapping | |
| Match paint-studio-v9 exactly | Port specific transparency from v9 | |

**User's choice:** Density-driven transparency.

**Follow-up: Paper through washes?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — paper shows through washes | Thin deposits semi-transparent, paper visible underneath | ✓ |
| Paper visible only where no paint | Paint always covers paper | |
| You decide | Claude determines best approach | |

**User's choice:** Paper shows through washes — classic watercolor look.

---

## Paper Selector Scope (DEMO-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Just verify with new pipeline | Paper selector exists, just ensure it works | ✓ |
| Needs visual improvements | UI polish needed | |
| Add more paper options | More textures or custom upload | |

**User's choice:** Just verify it works with the new pipeline.

---

## Paper Grain on Transparent Background (User-Initiated)

User raised a new requirement: when painting on transparent background, paper grain should still influence the paint (flow, drying, emboss). This decouples paper grain from background visibility.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate controls (recommended) | Paper selector = grain, Background toggle = visibility | ✓ |
| Paper always active, background auto | Single selector + transparency toggle | |

**User's choice:** Separate controls. Additional details:
- Default state: paper background visible
- Can change paper before painting
- Toggle between transparent or paper background
- Changing mid-session: new strokes use new paper, old dried strokes unchanged
- No visual reset when switching

---

## Claude's Discretion

- Density-to-alpha mapping curve
- Flow/diffusion tuning constants
- Implementation details for paper heightmap/background decoupling
- Procedural heightmap fallback adjustments
