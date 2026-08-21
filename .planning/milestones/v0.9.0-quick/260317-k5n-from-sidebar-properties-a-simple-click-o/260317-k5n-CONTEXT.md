# Quick Task 260317-k5n: Sidebar property clicks losing layer focus - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Task Boundary

From sidebar properties a simple click outside a field or a slider inside the properties window makes lost focus on the layer or fx layer. The deselection logic in EditorShell.tsx fires on "dead space" clicks that don't match the INTERACTIVE_SELECTOR, and areas within the sidebar (labels, gaps, panel background, slider tracks) are not protected.

</domain>

<decisions>
## Implementation Decisions

### Fix Scope
- Apply fix to the entire sidebar panel container, not individual elements
- Add a data attribute to the sidebar container so any click inside it never triggers layer deselection
- This is the simplest and most robust approach

### Click Behavior
- Clicking anywhere in the sidebar properties panel preserves the current layer selection
- No additional side effects (no blur of active inputs)
- Dropdowns and menus continue to close via their own independent handlers

### Affected Panels
- Bug affects both content layer properties (SidebarProperties) AND FX layer properties (SidebarFxProperties)
- Fix must cover both panels

### Claude's Discretion
- Implementation detail: whether to extend INTERACTIVE_SELECTOR or add a separate container-level check in handleShellPointerDown

</decisions>

<specifics>
## Specific Ideas

- EditorShell.tsx handleShellPointerDown is the deselection handler (lines ~40-56)
- INTERACTIVE_SELECTOR currently: 'button, input, textarea, select, [role="button"], [data-interactive], [contenteditable]'
- Could add a `[data-no-deselect]` attribute to sidebar containers and check `target.closest('[data-no-deselect]')` in the handler

</specifics>
