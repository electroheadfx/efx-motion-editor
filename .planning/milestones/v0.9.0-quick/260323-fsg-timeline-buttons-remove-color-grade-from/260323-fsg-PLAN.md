---
phase: quick
plan: 260323-fsg
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/timeline/AddFxMenu.tsx
  - Application/src/components/layout/TimelinePanel.tsx
  - Application/src/components/timeline/AddAudioButton.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Color Grade entry no longer appears in the Layer dropdown menu"
    - "Browse Shaders entry no longer appears in the Layer dropdown menu"
    - "Timeline bar shader button reads 'Shader' instead of 'GLSL'"
    - "Audio button in timeline bar shows 'Audio' text label next to icon"
  artifacts:
    - path: "Application/src/components/timeline/AddFxMenu.tsx"
      provides: "Layer dropdown without Color Grade or Browse Shaders"
    - path: "Application/src/components/layout/TimelinePanel.tsx"
      provides: "Shader button with renamed label"
    - path: "Application/src/components/timeline/AddAudioButton.tsx"
      provides: "Audio button with text label"
  key_links: []
---

<objective>
Clean up timeline toolbar buttons: remove unused menu items, rename label, and add missing label.

Purpose: Streamline the timeline toolbar UI by removing Color Grade and Browse Shaders from the Layer dropdown, renaming the GLSL button to Shader, and adding an Audio text label to the audio button.
Output: Three updated component files with cleaner, more consistent timeline controls.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/timeline/AddFxMenu.tsx
@Application/src/components/layout/TimelinePanel.tsx
@Application/src/components/timeline/AddAudioButton.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Color Grade and Browse Shaders from Layer menu, rename GLSL to Shader, add Audio label</name>
  <files>Application/src/components/timeline/AddFxMenu.tsx, Application/src/components/layout/TimelinePanel.tsx, Application/src/components/timeline/AddAudioButton.tsx</files>
  <action>
In AddFxMenu.tsx:
- Remove the "Color Grade" button (lines 133-139) from the ADJUSTMENTS section. Keep the "Blur" entry and the ADJUSTMENTS section header.
- Remove the entire GLSL section at the bottom of the menu: the separator (line 147), the "GLSL" section header (line 150), and the "Browse Shaders..." button (lines 151-161). The menu should end after Blur with the closing div tags.

In TimelinePanel.tsx:
- On line 154, change the button label text from "GLSL" to "Shader". The Sparkles icon stays.
- Update the title attribute on line 152 from "GLSL Shader Browser" to "Shader Browser".

In AddAudioButton.tsx:
- Change the button content from just `<Music size={14} />` to match the style of adjacent buttons: `<span class="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-1"><Music size={11} /> Audio</span>`. This matches the pattern used by the Shader and Layer buttons in the toolbar.
- Remove the existing text styling classes from the button element (text-[var(--color-text-secondary)] and hover:text-white) since the span handles text color. Keep the background/padding/cursor/transition classes.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && npx tsc --noEmit --project Application/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
- Layer dropdown no longer shows "Color Grade" or "Browse Shaders..." entries
- Layer dropdown still shows all content, generator, and blur adjustment items
- Timeline bar shader button reads "Shader" with Sparkles icon
- Audio button shows "Audio" text label next to Music icon, styled consistently with Shader and Layer buttons
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Visual inspection: timeline toolbar buttons show correct labels and menus
</verification>

<success_criteria>
Timeline toolbar is cleaned up: Color Grade and Browse Shaders removed from Layer menu, GLSL renamed to Shader, Audio button has text label matching sibling button style.
</success_criteria>

<output>
After completion, create `.planning/quick/260323-fsg-timeline-buttons-remove-color-grade-from/260323-fsg-SUMMARY.md`
</output>
