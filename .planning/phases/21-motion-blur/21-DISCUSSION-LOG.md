# Phase 21: Motion Blur - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 21-motion-blur
**Areas discussed:** Blur controls UX, Preview quality tiers, Export settings, Visual behavior

---

## Blur Controls UX

| Option | Description | Selected |
|--------|-------------|----------|
| Preview toolbar toggle + sidebar | Toggle in toolbar, shutter angle slider in sidebar section | |
| Preview toolbar only | Toggle + inline popover with shutter angle and quality controls | ✓ |
| Sidebar section only | All controls in sidebar, no toolbar button | |

**User's choice:** Preview toolbar only — click toggles on/off, dropdown popover opens with shutter angle slider + quality tier selector.
**Notes:** Keeps settings close to the toggle, like a camera HUD. No sidebar section needed.

---

## Preview Quality Tiers

| Option | Description | Selected |
|--------|-------------|----------|
| Off / Low / Medium | Off=no blur, Low=4 samples, Medium=8 samples. No High for preview. | ✓ |
| Off / On (simple toggle) | Single quality level (8 samples), simpler UX | |
| Off / Low / Medium / High | Include High (16 samples) in preview | |

**User's choice:** Off / Low / Medium — three tiers with no High quality in preview. High quality is export-only via sub-frame accumulation.
**Notes:** None

---

## Export Settings

| Option | Description | Selected |
|--------|-------------|----------|
| Export dialog section | Motion Blur section in export dialog: toggle, sub-frame count, shutter angle override | ✓ |
| Inherit from preview only | No separate export settings, auto-select sub-frames | |
| Separate export store | Fully independent export blur settings | |

**User's choice:** Export dialog section — dedicated Motion Blur section within the existing export dialog.
**Notes:** Shows enabled toggle, sub-frame count dropdown (4/8/16), and shutter angle that defaults to project value but can be overridden.

---

## Visual Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Position only first | Blur from X/Y translation only, no rotation/scale blur | |
| Position + rotation + scale | Full transform-based blur: directional streak, radial smear, zoom blur | ✓ |
| You decide | Claude picks best approach | |

**User's choice:** Position + rotation + scale — full transform-based blur covering all motion types.
**Notes:** Position creates directional streak, rotation creates circular/radial smear, scale creates zoom blur outward.

---

## Claude's Discretion

- Velocity threshold for stationary layer detection
- Rotation/scale blur shader implementation (per-pixel velocity field vs approximation)
- WebGL2 context sharing strategy
- Export sub-frame count default
- Toolbar icon and popover styling
- Performance auto-bailout strategy

## Deferred Ideas

- Per-layer motion blur override (MBLR-10) — future phase
- Adaptive preview quality (MBLR-11) — future phase
- Velocity vector visualization (MBLR-12) — future phase

## Canonical Reference Added During Discussion

- `SPECS/motion-blur.md` — User referenced this spec; read in full (326 lines). Architecture spec covering GLSL shader, velocity computation, sub-frame accumulation, combined pipeline.
