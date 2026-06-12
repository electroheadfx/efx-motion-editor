# Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 36-Physics Paint UI Rebuild, Session Persistence, and Output Proof
**Areas discussed:** UI fidelity cutline, Output proof shape, Timeline lanes, Warning/edge copy, Timeline controls/onion/shortcuts

---

## UI fidelity cutline

| Option | Description | Selected |
|--------|-------------|----------|
| Full redesign | Rebuild around the Pencil groups and move existing controls into top bar, left sidebar, right sidebar, and bottom timeline; old toolbar structure should disappear. | ✓ |
| Hybrid shell | Use the new overall layout, but keep chunks of the old toolbar internally or visually if that reduces risk. | |
| Mostly rename | Only rename/reposition the most important buttons and leave most old layout intact; fastest but less production-grade. | |

**User's choice:** Full redesign.
**Notes:** User clarified that the bottom diagnostics grid was intentionally removed. The UI should use existing EFX Motion styling/components/buttons, the Pencil file for placement, and provided icons. Grain strength keeps None/Soft/Med/Hard. FPS is removed because Play uses project FPS. Top bar can hold compact status/log/error information. Save buttons should use matching EFX Motion button styles. Mini blend/color preview should be lightweight; do not add a heavy second engine/canvas unless unavoidable.

---

## Output proof shape

| Option | Description | Selected |
|--------|-------------|----------|
| Both file + inspect | User can export/download PNG still or frame sequence/manifest, and the UI also shows an inspectable summary of what was produced. | ✓ |
| Download only | The proof is files on disk/download: PNG still plus sequence/manifest artifact, with minimal UI feedback. | |
| Inspect only | The proof is in-app visible output metadata and rendered frames; file export can stay limited to current PNG/state. | |

**User's choice:** Both file + inspect, with debug/dev-only visibility for PNG+manifest export.
**Notes:** User clarified that PNGs + manifest are for debugging/dev inspection, not final user workflow. It should appear only in dev mode, not in the final app. It should live in the top bar status area, collapsed by default. Normal Save play should remain in Physics Paint and show a summary rather than closing the standalone window.

---

## Timeline lanes

| Option | Description | Selected |
|--------|-------------|----------|
| Deux lignes visibles | One Roto frames row with cells per frame, and one Script/Play row with start square + range bar. | ✓ |
| Une ligne mixte | One combined row with different marker styles. | |
| Mode focus | Only show the lane for the active focus/mode. | |

**User's choice:** Two visible rows, but Phase 36 uses exclusive Roto and Play modes.
**Notes:** User clarified that Phase 36 should simplify to either Roto frame-by-frame mode or Play canvas mode. Phase 38 can later mix the two together. User selected workflow tabs for switching between Roto canvas and Play canvas, with the inactive lane visible but subdued.

---

## Warning/edge copy

| Option | Description | Selected |
|--------|-------------|----------|
| Clear mode actif | Clear only the active workflow source; roto clears current roto frame, play clears/annuls play range with warning. | ✓ |
| Clear tout | Clear all output on the current frame regardless of mode. | |
| Toujours demander | Always ask before clear, even for simple roto frames. | |

**User's choice:** Clear active mode only.
**Notes:** User selected a confirmation dialog for clearing Play canvas range. Same-mode save replaces existing output with feedback. Cross-mode switching is destructive conversion: Play→Roto converts the whole rendered Play range into roto images and loses the Play script; Roto→Play replaces roto images from current frame to current+frameCount and loses those roto frames. Confirm always before conversion/loss.

---

## Timeline controls/onion/shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Marker + explicit conversion | Play range displays current-position marker; conversion happens via tabs with confirmation. | ✓ |
| Auto-switch on lane click | Clicking lane content can switch modes directly. | |
| No mode switch on timeline | Timeline only changes frame position and never changes workflow. | |

**User's choice:** Marker + explicit conversion.
**Notes:** User wanted the Play range to show interpolation/current-state marker, e.g. `[0]----•---[50]`. Clicking inside the Play range moves the current frame/marker, not conversion. Conversion to Roto happens by clicking the Roto tab and confirming. User accepted proposed shortcuts. Onion should have on/off plus previous and next checkboxes, can preview Play canvas frames, and is temporarily disabled during live Play preview. Previous/next should sync EFX Motion frame and EFX Physics Paint frame. Save roto frame should save-and-next.

---

## Claude's Discretion

- Planner/researcher may choose the safest technical implementation for lightweight color blending, dev-mode detection, exact unsaved-change guard placement, and exact styling details, while preserving the decisions in CONTEXT.md.

## Deferred Ideas

- Phase 38: true source-lane data model.
- Phase 38: hybrid source mixing of script play base plus roto corrections.
- Phase 38: auto-save/auto-publish policy.
- Phase 38: conflict and overlap handling.
- Phase 38/later: editing script source from any frame in its range.
- Later if needed: second full engine/canvas for the mini blend preview if lightweight preview is insufficient.
