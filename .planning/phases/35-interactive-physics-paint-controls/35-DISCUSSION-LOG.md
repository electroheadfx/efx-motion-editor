# Phase 35: Interactive Physics Paint Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 35-Interactive Physics Paint Controls
**Areas discussed:** Core controls, Diagnostics panel, Save/load visibility, Simulation/apply workflow

---

## Core controls

| Option | Description | Selected |
|--------|-------------|----------|
| Focused core | Paint/erase, brush size/color/opacity, physics strength/mode, start/stop, reset. | |
| Full toolbar | Expose almost everything already present in the demo toolbar. | ✓ |
| Minimal smoke | Only paint/erase plus physics start/stop and diagnostics. | |

**User's choice:** Full toolbar.
**Notes:** User clarified that everything in the demo should be present in the standalone physics paint window. All tools primarily control the paint session.

---

## Unwired controls

| Option | Description | Selected |
|--------|-------------|----------|
| Visible disabled | Show controls but disable them clearly until connected. | ✓ |
| Hide until wired | Hide controls until implemented. | |
| Wire essentials | Connect only essentials now and leave the rest visible if reliable. | |

**User's choice:** Visible disabled.
**Notes:** Keep the complete target surface visible while avoiding broken controls.

---

## Diagnostics panel

| Option | Description | Selected |
|--------|-------------|----------|
| Render readiness | Engine/canvas state, image ready, frames ready, import/export errors, last imported states. | ✓ |
| Full debug state | Stroke count, canvas size, physics running, current settings, and full debug state. | |
| Minimal errors | Only errors and ready/not ready. | |

**User's choice:** Ready/not ready plus apply buttons.
**Notes:** User specified diagnostics should show ready/not ready and expose `[send image]` / `[send frames]`, later clarified as `[apply canvas]` and `[apply play canvas]` in the app workflow.

---

## Frame application

| Option | Description | Selected |
|--------|-------------|----------|
| Frame count | User provides a frame count; standalone generates that sequence. | ✓ |
| Duration + fps | User chooses duration and fps. | |
| Current animation | Send frames corresponding to the current animation without extra parameters. | |

**User's choice:** Frame count.
**Notes:** The generated sequence starts from the current frame in the application.

---

## Import/export scope

| Option | Description | Selected |
|--------|-------------|----------|
| Paint state file | Import/export saves and reloads editable standalone paint state. | ✓ |
| Image files too | Import/export also handles images/renders directly. | |
| Defer export | Import states only now; export later. | |

**User's choice:** Paint state file.
**Notes:** Import/export is useful to save a painting as a file and import states. The app receives rendered image/frames through apply actions, not through import/export.

---

## Simulation/apply workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Target + disabled | Capture app-to-standalone flow as target but leave apply buttons disabled if bridge is out of scope. | |
| Implement now | Include `[open fx paint canvas]`, `[apply canvas]`, and `[apply play canvas]` in Phase 35. | ✓ |
| Document only | Document this flow only for later phases. | |

**User's choice:** Implement now.
**Notes:** User clarified the intended workflow: in EFX Motion Editor, create/select a `physic-paint` layer, position on a frame, click `[open fx paint canvas]`, paint in standalone, then `[apply canvas]` writes the current rendered image or `[apply play canvas]` writes generated frames into the app starting from the current frame.

---

## Claude's Discretion

Planner/researcher may choose the technical seam for opening/applying, but not alter the user-facing flow or labels.

## Deferred Ideas

None.
