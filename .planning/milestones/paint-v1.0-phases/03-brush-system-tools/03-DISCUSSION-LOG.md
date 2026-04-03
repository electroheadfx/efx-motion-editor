# Phase 3: Brush System & Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 03-brush-system-tools
**Areas discussed:** Tool/brush mapping, Brush texture mask, Parameter controls, Stroke data model

---

## Tool/brush mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Rename + add 4 new | Rename smudge->smear, keep liquify. Add erase, water, blend, blow, wet, dry. | |
| Replace with Rebelle set | Drop liquify and mix. Build all 8 from scratch. | |
| Keep current + extend | Keep all 4 existing + add missing = 10+ tools. | |

**User's choice:** Rename + add 4 new (with modifications)
**Notes:** Smudge doesn't work anymore — remove it. Mix is essentially custom paint — merge into paint tool. Build smear from scratch. Liquify stays as bonus tool. Paint brush has edge artifacts (strokeEdge) that need fixing.

### Follow-up: Smudge and mix handling

| Option | Description | Selected |
|--------|-------------|----------|
| Drop smudge, mix->paint | Remove smudge, merge mix into paint. | |
| Fix smudge->smear, keep mix | Fix and rename smudge, keep mix separate. | |
| Drop both, rebuild | Remove smudge and mix, build smear from scratch. | |

**User's choice:** Hybrid — Remove smudge. Build smear from scratch. Merge mix into paint (pickup blending). Liquify stays as bonus.

---

## Brush texture mask

| Option | Description | Selected |
|--------|-------------|----------|
| Modulate paint amount | Brush texture varies paint deposit per pixel. Quadrant mirroring for seamless tiling. | |
| Modulate + emboss grain | Same modulation + per-stroke 3D emboss grain effect on paint surface. | ✓ |
| You decide | Claude picks based on original Rebelle behavior. | |

**User's choice:** Modulate + emboss grain
**Notes:** Dual purpose: paint deposit variation AND emboss grain effect.

---

## Parameter controls

| Option | Description | Selected |
|--------|-------------|----------|
| Universal + per-type | Universal sliders (size, opacity, water, dry, pressure) always visible. Per-type extras contextual. | ✓ |
| Minimal universal | Only size and opacity universal. Each tool defines own params. | |
| Match original Rebelle | Full 24-slider Kontrol panel. All params visible at once. | |

**User's choice:** Universal + per-type
**Notes:** Edge slider removed (fix artifacts instead). Mix-specific sliders removed (mix merging into paint).

### Follow-up: Pressure interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Multiplier | Slider x penPressure. Mouse gets slider value directly. | ✓ |
| Sensitivity curve | Slider controls pressure response curve shape. | |
| You decide | Claude picks based on natural media behavior. | |

**User's choice:** Multiplier
**Notes:** final = slider value x penPressure. Low slider = light touch even with full pen pressure.

---

## Stroke data model

| Option | Description | Selected |
|--------|-------------|----------|
| Formalize now | Define Stroke type with points + metadata. Phase 4 adds serialization on top. | |
| Keep informal, Phase 4 | Keep allActions[] as-is. Phase 4 formalizes. | |
| Match efx-motion-editor now | Match PaintStroke format ([x, y, pressure][]) for early library compatibility. | ✓ |

**User's choice:** Match efx-motion-editor now
**Notes:** Ensures Phase 4 serialization is trivial and library compatibility is established early.

---

## Claude's Discretion

- Implementation details for each new brush type (erase, water, blend, blow, wet, dry)
- Quadrant mirroring implementation approach
- Pressure curve shape within multiplier model
- Per-type contextual parameter selection
- strokeEdge() bug fix approach

## Deferred Ideas

- 24-slider Kontrol panel — Phase 5 if desired
- Stroke persistence/replay — Phase 4
