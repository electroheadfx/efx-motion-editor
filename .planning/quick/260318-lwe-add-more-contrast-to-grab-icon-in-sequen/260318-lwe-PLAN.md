---
phase: quick-260318-lwe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/index.css
  - Application/src/components/sequence/SequenceList.tsx
autonomous: true
requirements: [quick-260318-lwe]

must_haves:
  truths:
    - "Grab icon in sequence row is clearly visible in dark theme"
    - "Grab icon in sequence row is clearly visible in medium theme"
    - "Grab icon in sequence row is clearly visible in light theme"
  artifacts:
    - path: "Application/src/index.css"
      provides: "Higher-contrast --sidebar-resizer-icon values per theme"
      contains: "--sidebar-resizer-icon"
    - path: "Application/src/components/sequence/SequenceList.tsx"
      provides: "Improved grab handle opacity"
      contains: "seq-drag-handle"
  key_links:
    - from: "Application/src/components/sequence/SequenceList.tsx"
      to: "Application/src/index.css"
      via: "var(--sidebar-resizer-icon)"
      pattern: "sidebar-resizer-icon"
---

<objective>
Improve the grab (drag handle) icon contrast in the Sequence row for better visibility across all themes.

Purpose: The GripVertical icon currently uses low-contrast `--sidebar-resizer-icon` colors combined with `opacity-60`, making it nearly invisible especially in the dark theme. Users need to clearly see the drag handle to know they can reorder sequences.

Output: Updated CSS variables and component opacity for a visibly distinct grab icon across dark, medium, and light themes.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/index.css (CSS theme variables -- lines 86, 171, 256 for --sidebar-resizer-icon)
@Application/src/components/sequence/SequenceList.tsx (line 236-238 -- drag handle with GripVertical)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Increase grab icon contrast across all themes</name>
  <files>Application/src/index.css, Application/src/components/sequence/SequenceList.tsx</files>
  <action>
1. In `Application/src/index.css`, update `--sidebar-resizer-icon` to higher-contrast values:
   - Dark theme (root): change `#4A4A64` to `#7A7A9E` (brighter against `#252539` panel bg)
   - Medium theme: change `#5A5A74` to `#8A8AAE` (brighter against `#343449` panel bg)
   - Light theme: change `#AAAAC4` to `#7070A0` (darker against `#D5D5E9` panel bg)

2. In `Application/src/components/sequence/SequenceList.tsx` line 236, change the drag handle div from:
   `opacity-60 hover:opacity-100`
   to:
   `opacity-80 hover:opacity-100`

   This raises the resting opacity so the icon is visible without hovering, while still providing a subtle hover feedback boost.

Note: Do NOT change the LayerList.tsx grab handle -- the task description specifically says "Sequence row left thumb". If both need updating the user will request it separately.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && grep -n "sidebar-resizer-icon" Application/src/index.css && grep -n "seq-drag-handle" Application/src/components/sequence/SequenceList.tsx</automated>
  </verify>
  <done>
    - --sidebar-resizer-icon values updated to higher-contrast colors in all three theme blocks
    - Grab handle base opacity changed from 60 to 80
    - Icon is clearly distinguishable from its background in dark, medium, and light themes
  </done>
</task>

</tasks>

<verification>
- Run `grep "sidebar-resizer-icon" Application/src/index.css` confirms all three themes have updated color values
- Run `grep "opacity-80" Application/src/components/sequence/SequenceList.tsx` confirms increased base opacity
- Visual: grab icon should be clearly visible without hovering in all themes
</verification>

<success_criteria>
The GripVertical drag handle icon in the sequence row is clearly visible at rest (without hover) across dark, medium, and light themes, providing enough contrast to signal drag-reorder affordance.
</success_criteria>

<output>
After completion, create `.planning/quick/260318-lwe-add-more-contrast-to-grab-icon-in-sequen/260318-lwe-SUMMARY.md`
</output>
