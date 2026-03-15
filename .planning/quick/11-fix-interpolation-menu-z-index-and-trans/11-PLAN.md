---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/timeline/KeyframePopover.tsx
autonomous: true
must_haves:
  truths:
    - "Interpolation menu renders on top of timeline canvas, timeline controls bar, and properties bottom bar"
    - "Interpolation menu has a solid opaque background matching the app theme (not transparent)"
  artifacts:
    - path: "Application/src/components/timeline/KeyframePopover.tsx"
      provides: "Fixed popover with portal rendering and correct background"
  key_links:
    - from: "KeyframePopover.tsx"
      to: "document.body"
      via: "createPortal"
      pattern: "createPortal"
---

<objective>
Fix two bugs in the keyframe interpolation (easing) popover menu:
1. Z-index issue: menu renders behind the timeline controls bar and properties panel (bottom bar) instead of floating on top
2. Transparency issue: menu background is transparent because it references `--color-bg-panel` which is not a defined CSS variable

Purpose: Make the interpolation menu usable -- currently it is partially obscured and hard to read.
Output: A properly layered, opaque popover menu.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/timeline/KeyframePopover.tsx
@Application/src/components/timeline/TimelineCanvas.tsx
@Application/src/index.css (CSS variable definitions for themes)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix KeyframePopover z-index via portal and fix transparent background</name>
  <files>Application/src/components/timeline/KeyframePopover.tsx</files>
  <action>
Two fixes in KeyframePopover.tsx:

**Fix 1 -- Z-index (portal rendering):**
The popover currently renders inside the TimelineCanvas component hierarchy, which is nested inside TimelinePanel. The PropertiesPanel (bottom bar) renders later in the DOM and paints on top. Using `position: fixed` alone does not guarantee stacking above sibling subtrees.

Wrap the entire popover return (both the backdrop div and the menu div) in a `createPortal(...)` call targeting `document.body`. Import `createPortal` from `preact/compat`.

This ensures the popover DOM nodes are appended directly to `<body>`, outside all layout containers, so the `z-[999]` / `z-[1000]` values work against the root stacking context.

Keep the existing `z-[999]` on the backdrop and `z-[1000]` on the menu div -- those values are fine once portaled.

**Fix 2 -- Transparent background:**
Replace `bg-[var(--color-bg-panel)]` with `bg-[var(--color-bg-menu)]` on the popover menu div (line 45). The variable `--color-bg-panel` does not exist in index.css. The correct theme-aware variable is `--color-bg-menu` which is defined in all three themes (dark: #1E1E1E, medium: #4A4A4A, light: #FFFFFF).
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && npx tsc --noEmit --project Application/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
    - KeyframePopover renders via portal to document.body
    - Background uses --color-bg-menu (opaque, theme-aware)
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit` passes
2. Manual: Open project with keyframed layers, double-click a keyframe diamond on timeline, verify the interpolation menu appears ON TOP of both the timeline area and the bottom properties panel
3. Manual: Verify the menu has a solid opaque background (not see-through), and it matches the current theme
</verification>

<success_criteria>
- Interpolation popover floats above all UI panels including the bottom properties bar
- Popover background is solid/opaque in all three themes (dark, medium, light)
- Clicking outside the popover still closes it (backdrop behavior preserved)
- Selecting an easing option still works and closes the popover
</success_criteria>

<output>
After completion, create `.planning/quick/11-fix-interpolation-menu-z-index-and-trans/11-SUMMARY.md`
</output>
