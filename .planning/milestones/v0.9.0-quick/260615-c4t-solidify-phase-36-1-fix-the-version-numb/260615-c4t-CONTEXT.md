# Quick Task 260615-c4t: solidify phase 36.1 - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Task Boundary

solidify phase 36.1
- Fix the app version number on the opening page. The version should be set in the right source of truth, likely package.json, and should match the current GSD milestone: 0.8.
- Fix the engine ready indicator so it does not turn red after the second update when the engine is ready. First ready state currently shows green correctly.
- Add a dev log tab in the right sidebar near Brush Color with the existing/export action "export png + manifest" inside it.

</domain>

<decisions>
## Implementation Decisions

### Dev Log Scope
- The log tab and its content must appear only when running from `pnpm tauri dev`.
- The log tab and its content must not exist when the app is built or run from a packaged binary.

### Claude's Discretion
- Choose the safest package/build metadata source for displaying version 0.8 on the opening page.
- Choose the engine status coloring fix that preserves green for ready state and reserves red for actual not-ready/error state.
- Place the dev log tab adjacent to the Brush Color tab as shown in the provided screenshot, without adding extra production UI.

</decisions>

<specifics>
## Specific Ideas

- User screenshot shows splash/opening page currently displaying `EFX Motion Editor v0.1.0`; expected milestone version is `0.8`.
- User screenshot shows `Engine ready` pill in red after a later update; expected ready state should remain green.
- User screenshot marks the current top-right export/log area and asks to move/add this dev log in a right-sidebar tab near Brush Color.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
