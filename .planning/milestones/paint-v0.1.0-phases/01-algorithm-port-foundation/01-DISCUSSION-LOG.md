# Phase 1: Algorithm Port Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28 (original), 2026-03-29 (updated)
**Phase:** 01-algorithm-port-foundation
**Areas discussed:** Source approach, Implementation target, Physics scope for P1, efx-paint/ cleanup

---

## Original Discussion (2026-03-28)

### Demo scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep full demo | Keep existing Toolbar with all 8 brushes. | ✓ |
| Minimal (2-3 brushes) | Strip to paint, water, wet brushes only. | |
| Just canvas | No toolbar — raw physics canvas. | |

**User's choice:** Keep full demo

### Verification approach

| Option | Description | Selected |
|--------|-------------|----------|
| Manual side-by-side | Run both demos side-by-side in browser. | ✓ |
| Automated pixel diff | Canvas pixel diff. | |
| Expert judgment | Judge by eye. | |

**User's choice:** Manual side-by-side

### BrushEngine completeness

| Option | Description | Selected |
|--------|-------------|----------|
| All 8 brushes | All brush types must work. | ✓ |
| Core 3 first | paint, water, wet only. | |
| Just paint + water | Minimal physics proof. | |

**User's choice:** All 8 brushes and wet/dry physics

---

## Updated Discussion (2026-03-29)

**Reason for update:** Approach changed — abandoned Processing.js port in favor of building from paint-studio-v9.html with watercolor physics added.

### Source Approach

| Option | Description | Selected |
|--------|-------------|----------|
| paint-studio-v9 + physics concepts | Build from working v9 brush engine, add physics as new code. rebelle-paint.js conceptual only. | |
| efx-paint-physic-v1.html as-is | Standalone HTML file already has physics infrastructure. Continue iterating on it. | ✓ |
| Hybrid: v1.html informs TS port | Use v1.html as prototype, port proven physics into clean TypeScript modules. | |

**User's choice:** efx-paint-physic-v1.html as-is

---

### Implementation Target

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in single HTML | Keep iterating on monolithic file. Get physics perfect first. | ✓ |
| Port to TS modules later | Phase 1 in HTML, future phase extracts to TypeScript for npm package. | |
| Move to TS modules now | Phase 1 includes porting to TypeScript modules (new clean directory). | |

**User's choice:** Stay in single HTML

---

### Physics Scope for P1

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 from the notes | Wet deposit, wet compositing, drying, diffusion flow, paper texture modulation. | ✓ |
| Wet + drying only | Focus on wet layer deposit + drying. Diffusion and paper texture are Phase 2. | |
| You decide the split | Claude determines Phase 1 vs later based on dependencies. | |

**User's choice:** All 5 from the notes
**Notes:** Current state is partially working. Rendering flow needs redesign per efx-paint-physic-v1.md notes.

---

### efx-paint/ Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | Remove efx-paint/ entirely. Approach abandoned. | |
| Keep as reference | Leave for reference. | |
| Archive to branch | Move to git branch. | |

**User's choice:** "I delete from my side" (custom response)
**Notes:** User will handle deletion of efx-paint/ directory themselves.

---

## Claude's Discretion

- Physics tuning constants (drying rate, diffusion strength, flow speed)
- Rendering pipeline implementation details
- Bug fix prioritization within the 5 features

## Deferred Ideas

- TypeScript modularization — Phase 5
- npm package export — Phase 5
- Brush texture mask — Phase 3
- Tablet stroke data model — Phase 3
