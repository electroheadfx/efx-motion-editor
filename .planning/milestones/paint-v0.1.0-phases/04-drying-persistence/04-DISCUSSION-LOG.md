# Phase 4: Drying & Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 04-drying-persistence
**Areas discussed:** Drying curve & LUT, Serialization format, Replay fidelity, Replay UI

---

## Drying curve & LUT

| Option | Description | Selected |
|--------|-------------|----------|
| Rebelle-style two-table LUT | Port the dL/ao exponential curve from Rebelle. Natural-looking drying: slow start then accelerating. Already proven. | ✓ |
| Keep simple percentage drain | Current DRY_DRAIN=0.03 approach. Simpler but linear/less natural drying. | |
| Custom easing curve | Design a new curve (CSS-like ease-in-out) without Rebelle's specific math. | |

**User's choice:** Rebelle-style two-table LUT

| Option | Description | Selected |
|--------|-------------|----------|
| 10-15 seconds (fast) | Quick feedback loop. Strokes dry before painting the next one. | |
| 20-30 seconds (slow, cinematic) | Classic watercolor pacing. Watch paint spread and settle. | |
| User-adjustable via slider | Dry speed slider with default ~15 seconds. | ✓ |

**User's choice:** User-adjustable via slider

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, integrate with LUT | Dry tool force-dries via accelerated LUT. Wet tool rehydrates by reversing LUT. | ✓ |
| Keep tools as-is | Bypass LUT, directly manipulate arrays. Simpler, already working. | |
| You decide | Claude picks best integration approach. | |

**User's choice:** Yes, integrate with LUT

---

## Serialization format

| Option | Description | Selected |
|--------|-------------|----------|
| Strokes only, replay physics | Serialize stroke list + canvas settings. Replay re-executes + physics. Small files (~KB). | ✓ |
| Strokes + final canvas snapshot | Strokes AND base64 PNG export. Larger (~MB) but guaranteed fidelity. | |
| Full state dump | Strokes + wet layer arrays + dry canvas ImageData. Complete state restoration. | |

**User's choice:** Strokes only, replay physics

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, match PaintStroke | Same JSON shape as efx-motion-editor. Points as [x,y,pressure][] with metadata. | ✓ |
| Custom format, convert later | Easiest now, add converter in Phase 5. | |
| You decide | Claude picks best balance of compatibility and simplicity. | |

**User's choice:** Yes, match PaintStroke format

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include canvas settings | Paper type, canvas dimensions, background mode in JSON header. | ✓ |
| Strokes only, assume current canvas | Just stroke data, replay uses current settings. | |

**User's choice:** Yes, include canvas settings

---

## Replay fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Record timestamps, simulate elapsed time | Store timestamp per stroke. Fast-forward physics for elapsed time during replay. Deterministic. | ✓ |
| Instant replay, skip physics | Replay all strokes instantly like redrawAll(). No physics between strokes. | |
| Real-time replay with physics | Replay at original speed with live physics. Faithful but slow. | |

**User's choice:** Record timestamps, simulate elapsed time

| Option | Description | Selected |
|--------|-------------|----------|
| Visually identical | Same visual result with acceptable float drift. | ✓ |
| Pixel-perfect | Bit-exact match. Very hard with float physics. | |
| Approximate is fine | Same strokes, roughly same shape. Physics drift OK. | |

**User's choice:** Visually identical

---

## Replay UI (DEMO-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Simple buttons + file dialog | Save downloads .json, Load opens file picker. Minimal UI. | ✓ |
| Copy/paste JSON | Clipboard-based. No file system interaction. | |
| LocalStorage auto-save | Browser storage, restore on reload. No export. | |

**User's choice:** Simple buttons + file dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Instant load only | Load JSON, fast-forward physics, show final result. No animation. | ✓ |
| Animated playback with controls | Watch strokes draw one by one with play/pause/speed. | |
| Both | Default instant, optional animation button. | |

**User's choice:** Instant load only

---

## Claude's Discretion

- LUT array size (cT parameter)
- Physics fast-forward implementation (batch calls vs time-scaled)
- Exact JSON schema field names within PaintStroke constraints
- redrawAll() extension for all 8+1 brush types
- File extension (.json vs custom)

## Deferred Ideas

- Animated stroke-by-stroke playback — Phase 5 polish
- LocalStorage auto-save — future enhancement
