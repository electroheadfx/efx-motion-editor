# Phase 4: Drying & Persistence - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Paint dries from wet to dry over time following a Rebelle-style LUT-based drying curve, and strokes serialize/deserialize to JSON for replay. Includes drying LUT system (PHYS-04), stroke serialization (STROKE-03), and stroke replay demo (DEMO-04). Work continues in single HTML file (efx-paint-physic-v1.html).

</domain>

<decisions>
## Implementation Decisions

### Drying curve & LUT (PHYS-04)
- **D-01:** Port Rebelle's two-table LUT system: `dL` (cumulative exponential curve: `dL[c] = 0.002 + dL[c-1] * 0.998`) and `ao` (inverse lookup mapping density back to time). Replace current simple percentage drain in `dryStep()`
- **D-02:** Drying speed is user-adjustable via slider. Default ~15 seconds for a medium-wet stroke. Existing DRY_DRAIN slider repurposed to control LUT traversal speed
- **D-03:** Wet/dry brush tools integrate with the LUT system: dry tool force-dries using accelerated LUT traversal, wet tool rehydrates by reversing LUT position. Consistent with physics model rather than raw array manipulation

### Serialization format (STROKE-03)
- **D-04:** Strokes-only serialization — JSON contains stroke list + canvas settings, no physics state. Replay re-executes all strokes with simulated physics. Small file sizes (~KB)
- **D-05:** JSON format matches efx-motion-editor's PaintStroke structure: points as `[x, y, pressure][]` with extended fields (tiltX, tiltY, twist, speed) and metadata per stroke (tool type, color, brush params, timestamp)
- **D-06:** Canvas settings included in JSON header: paper type, canvas dimensions, background mode. Replay restores the exact canvas environment before re-executing strokes

### Replay fidelity
- **D-07:** Record timestamps per stroke. During replay, fast-forward physics simulation for elapsed time between strokes. Deterministic and faithful reproduction
- **D-08:** Target: visually identical replay. Same visual result with acceptable floating-point drift. Not pixel-perfect (too hard to guarantee with float physics), not approximate (too loose)

### Replay UI (DEMO-04)
- **D-09:** Simple save/load buttons with browser file dialog. Save downloads `.json` file, Load opens file picker to import. Minimal UI that proves the feature works
- **D-10:** Instant load only — load JSON, fast-forward physics, show final result. No animated stroke-by-stroke playback (defer to Phase 5 polish if desired)

### Claude's Discretion
- LUT array size (cT parameter from Rebelle — determines curve resolution)
- How to fast-forward physics during replay (batch dryStep/flowStep calls vs time-scaled single step)
- Exact JSON schema field names and nesting structure within PaintStroke constraints
- How `redrawAll()` is updated to handle all 8+1 brush types (was only 4 old types)
- File extension choice (.json vs .efxpaint or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files
- `efx-paint-physic-v1.html` — THE implementation file. Contains: current `dryStep()` (line 821), `dryStep` physics (DRY_DRAIN=0.03), `flowStep()` (line 889), `allActions[]` stroke recording (line 115, 1206), `redrawAll()` replay (line 1064), `clearWetLayer()` (line 1080), wet layer arrays, all brush type implementations
- `js/rebelle-paint.js` — Original Rebelle code with drying LUT: `dL`/`ao` arrays (line 225-226), LUT initialization function `cZ()` (line 842-861), LUT usage throughout brush code (20+ references at lines 1711, 1786, 2092, 2240, etc.)

### Project requirements
- `.planning/ROADMAP.md` §Phase 4 — Phase goal, success criteria, requirements (PHYS-04, STROKE-03, DEMO-04)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for PHYS-04, STROKE-03, DEMO-04

### Prior phase context
- `.planning/phases/01-algorithm-port-foundation/01-CONTEXT.md` — D-04: single HTML file, D-10: Canvas 2D
- `.planning/phases/02-rendering-pipeline/02-CONTEXT.md` — D-07/D-08: density-weighted transparency model
- `.planning/phases/03-brush-system-tools/03-CONTEXT.md` — D-15/D-16/D-17: PaintStroke format, allActions refactoring

### efx-motion-editor reference
- efx-motion-editor `PaintStroke` type uses `[x, y, pressure][]` point format — JSON must be interoperable (see PROJECT.md §Context)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dryStep()` (line 821): Current drying simulation with paper texture modulation — structure reusable, drain logic replaced by LUT
- `allActions[]` (line 115): Stroke recording array with `{tool, pts, color, opts}` — refactoring target for PaintStroke type
- `redrawAll()` (line 1064): Replay loop iterating allActions — needs extension for all 8+1 brush types
- `clearWetLayer()` (line 1080): Wet layer reset for fresh replay
- `getOpts()`: Brush parameter collection — opts shape informs serialization schema
- `extractPenPoint()` (line 1120): Pen data model `{x, y, p, tx, ty, tw, spd}` — maps to PaintStroke extended fields

### Established Patterns
- Physics at 10fps via `setInterval` independent of paint framerate — replay must account for this timing model
- Wet layer as Float32Array (wetR, wetG, wetB, wetAlpha, wetness) — physics state rebuilt during replay
- Paper heightmap influences drying modulation (line 836-839 in `dryStep()`) — preserved in LUT system
- Undo via ImageData snapshots (`undoStack`) — separate from stroke-level persistence

### Integration Points
- All 8+1 brush types from Phase 3 must be replayable: paint, erase, water, smear, blend, blow, wet, dry, liquify
- Paper texture loading (`paperTextures[currentPaper]`) — canvas settings in JSON must reference paper by name
- Background mode (`bgMode`) — included in canvas settings for faithful replay
- `drawBg()` — called during replay setup to restore canvas environment

</code_context>

<specifics>
## Specific Ideas

- Rebelle's dL/ao LUT produces natural-looking drying (slow initial phase then accelerating) — this specific curve shape is what we want
- Fast-forward physics during replay means calling dryStep/flowStep for the simulated elapsed time between strokes — not real-time waiting
- The JSON should be small enough to paste in a chat or attach to a bug report (KB range, not MB)

</specifics>

<deferred>
## Deferred Ideas

- Animated stroke-by-stroke playback with play/pause/speed controls — Phase 5 polish
- LocalStorage auto-save for session persistence — future enhancement
- 24-slider Kontrol panel (original Rebelle style) — Phase 5

</deferred>

---

*Phase: 04-drying-persistence*
*Context gathered: 2026-03-30*
