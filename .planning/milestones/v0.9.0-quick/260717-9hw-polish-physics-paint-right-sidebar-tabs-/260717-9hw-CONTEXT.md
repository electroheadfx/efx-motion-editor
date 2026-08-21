# Quick Task 260717-9hw: Polish Physics Paint right sidebar tabs and Scripts interactions - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Task Boundary

Polish the existing Physics Paint right sidebar and durable Scripts UI without redesigning persistence, replay, Motion, history, cache behavior, script schema, project discovery, native filesystem authority, or approved timeline Copy/Apply behavior.

Move the existing Tool/Onion/Motion/Scripts tab navigation immediately after Brush color; use the exact mixed-case labels Brush color, Tool, Onion, Motion, and Scripts; make complete script rows pointer- and keyboard-activatable; make row activation select and load only; change the toolbar load action to paintBrush-driven selected-preset Load + Apply through the existing Apply Script controller; and replace disabled Import with a disabled Play placeholder.

Implementation must stop after production changes, type checking, and minimum build-focused checks so the user can perform native visible UAT. Regression tests and final verification are explicitly deferred until the user approves UAT.

</domain>

<decisions>
## Implementation Decisions

### Script-row load failure
- If a newly activated durable preset fails to load, keep the last successfully loaded row selected and preserve its clipboard content.
- Surface the attempted load error through the established Scripts status/error and LOG routes.
- Never present the failed row as successfully selected or loaded.

### Repeated row activation
- Every pointer or keyboard activation reloads the durable preset into the transient immutable clipboard, including activation of the already-selected row.
- Row activation remains load-only and must never invoke Apply.

### Locked toolbar behavior
- The paintBrush toolbar action reloads the currently selected durable preset as authoritative clipboard content, then invokes the existing approved Apply Script path exactly once.
- If selected-preset loading fails, Apply must not start.
- If the current destination is ineligible for Apply, the combined action is disabled rather than performing only the load half.
- The clipboard remains loaded and reusable after Apply.
- The disabled Play control immediately follows paintBrush, has no callback, and communicates that playback is not yet available.

### Locked validation order
- Research and plan first.
- Implement only production UI/controller integration changes.
- Run type checking and the minimum existing focused checks needed to establish that production code builds.
- Stop for native visible UAT; do not add or modify regression tests before explicit approval.
- After approval, add focused regression coverage, run tests with `vitest run`, broader existing gates, code review, and final verification.
- Plan validation must not reorder automated regression tests before native UAT.

### Claude's Discretion
- Exact internal event-handler composition, focus styling, responsive CSS adjustments, and controller method naming, provided existing Preact-native Signals/controller boundaries and accessible interaction patterns are preserved.

</decisions>

<specifics>
## Specific Ideas

- Preserve Tool as the first tab, followed by Onion, Motion, and Scripts.
- Move rather than duplicate the current tab UI.
- Preserve compact thumbnail, preset name, provenance, selected-row styling, Save, Rename, Delete, Refresh, clipboard Discard, and timeline script actions.
- Explicit nested row actions must not trigger the row load action.
- Use existing paintBrush and play icons; add no icon dependency.
- Verify normal desktop, narrow desktop/right-panel, and stacked mobile layouts without horizontal overflow or clipped toolbar content.
- Do not run the development server; native visual UAT is performed by the user.

</specifics>

<canonical_refs>
## Canonical References

- Existing durable project-scoped script library implementation and its approved controllers are authoritative.
- Existing transient immutable script clipboard and approved Apply Script path are authoritative.
- Project `CLAUDE.md` Preact and testing constraints apply.

</canonical_refs>
