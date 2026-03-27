# Phase 25: Paint Compositing Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 25-paint-compositing-pipeline
**Areas discussed:** Luma matte strategy, Paper texture approach, Gray background mode, UI placement

---

## Luma Matte Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-layer toggle | Each paint layer has 'Enable Luma Matte' checkbox | |
| Always on | Luma matte always applied | |
| Blend mode | Treat luma matte as a blend mode alongside normal/screen/multiply | ✓ |

**User's choice:** Blend mode approach — Luma Key as a blend mode option

---

## Existing Workflow Discussion

**Key clarification from user:**
- "Show Seq BG" is just a guide while painting (photo overlay at transparency)
- When done painting, uncheck "Show Seq BG" to composite paint on top of photo
- Standard compositing IS working for final result

**User's workflow:**
1. Paint with "Show Seq BG" ON → photo overlays paint (guide)
2. Done painting → uncheck "Show Seq BG" → paint composites on top of photo (final)

---

## Original COMP-01 Clarification

**User described desired behavior:**
- Paint strokes appear on top of photo, fully colored
- Photo visible in unpainted areas
- Standard compositing (what already exists)

**Decision:** Luma Key replaces Show Seq BG with real-time compositing

---

## Key Color vs Luma Invert

**User's insight:**
- Original COMP-01 description ("luma matte extraction") didn't match what user wanted
- White paint can't be achieved with white-as-key (white = transparent)
- **New idea:** Paint black on white → extract luma → grayscale → invert → white strokes!

**Result:** Luma Key + Luma Invert options

---

## Paper Texture Discussion

**Initial assumption:** Paper texture would be applied inside paint layer with blend mode

**User's correction:**
- White-as-key is fundamental to paint rendering, not just watercolor
- ALL brush styles have this issue — near-white semi-transparent pixels become visible on non-white backgrounds
- Paper texture NOT in paint layer
- **Correct approach:** Paper as separate image layer underneath paint

**Final decisions:**
- Paper texture removed from this phase
- User adds paper as image layer underneath paint layer for physical media look
- COMP-03, COMP-04, COMP-05 deferred or addressed via layer composition

---

## Gray Background (COMP-02)

**User:** Gray background suggestion might not work — replaced by key color approach

**Final:** COMP-02 obsolete. White is always the luma key.

---

## Watercolor Constraint

**User explained:**
- Watercolor is subtractive medium — white isn't a pigment you add
- White = paper showing through
- Renderer simulates this by fading edges to white
- Works ONLY on white background

**Constraint captured:** Watercolor requires white background; white paint = transparent

---

## UI Placement

| Option | Selected |
|--------|----------|
| PaintProperties panel | ✓ |
| Separate compositing section | |
| Extend existing sections | |

**Final:** One COMPOSITING section in PaintProperties

---

## Final Scope Decisions

**What was removed:**
- Background color setting (white is always the key)
- Key color picker (white is fixed)
- Paper texture in paint layer
- Gray background option

**What was added:**
- Luma Key toggle (replaces Show Seq BG)
- Luma Invert option (black → white strokes)
- Non-destructive exit/entry to composite mode
- Watercolor constraint documentation

---

## Claude's Discretion

- Exact luma extraction algorithm (not discussed)
- Whether luma invert preview is live during paint or only on exit
- Flatten/cache trigger timing
- Specific UI layout within COMPOSITING section

---

*End of discussion log*
