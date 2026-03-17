---
phase: quick-260317-mqr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/sequence/SequenceList.tsx
  - Application/src/components/layer/LayerList.tsx
autonomous: true
requirements: [QUICK-hover-text]
must_haves:
  truths:
    - "Sequence names in SequenceList appear muted by default and restore to full text color on row hover"
    - "Layer names in LayerList appear muted by default and restore to full text color on row hover"
    - "The muted default color matches the grip icon color (--sidebar-collapse-line)"
    - "The hover color matches the normal text color (--sidebar-text-primary)"
    - "Transition is smooth, matching the grip icon transition (duration-150)"
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      provides: "Sequence name with hover color effect"
      contains: "sidebar-collapse-line"
    - path: "Application/src/components/layer/LayerList.tsx"
      provides: "Layer name with hover color effect"
      contains: "sidebar-collapse-line"
  key_links:
    - from: "SequenceList.tsx sequence row div"
      to: "sequence name span"
      via: "Tailwind group/group-hover pattern"
      pattern: "group.*group-hover"
    - from: "LayerList.tsx layer row div"
      to: "layer name span"
      via: "Tailwind group/group-hover pattern"
      pattern: "group.*group-hover"
---

<objective>
Add hover effect to sequence and layer name text matching the grip icon pattern.

Purpose: Visual consistency -- names should use the same muted-to-vivid hover pattern as the CollapseHandle and PanelResizer grip icons.
Output: Updated SequenceList.tsx and LayerList.tsx with text color hover transitions.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/sequence/SequenceList.tsx
@Application/src/components/layer/LayerList.tsx
@Application/src/components/sidebar/CollapseHandle.tsx (reference pattern)
@Application/src/components/sidebar/PanelResizer.tsx (reference pattern)

<interfaces>
The grip icon hover pattern (from CollapseHandle.tsx):
- Parent div has class `group`
- Child has `opacity-70 transition-opacity duration-150 group-hover:opacity-100`
- Color set via `style={{ color: 'var(--sidebar-collapse-line)' }}`

For text, the user wants a COLOR change (not opacity), specifically:
- Default: color = var(--sidebar-collapse-line) (muted, same as grip icons)
- On row hover: color = var(--sidebar-text-primary) (full text color, near-white in dark theme)

CSS variables (from index.css):
- --sidebar-collapse-line: #C0C0D0 (dark) / #3A3A50 (light)
- --sidebar-text-primary: #E0E0EE (dark) / #1A1A2E (light)

IMPORTANT: Inline `style` overrides Tailwind classes. The current sequence name (line 250)
and layer name (line 155) both use inline `style={{ color: 'var(--sidebar-text-primary)' }}`.
This MUST be moved to Tailwind classes so that `group-hover:` can override it.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add hover color transition to sequence and layer name text</name>
  <files>Application/src/components/sequence/SequenceList.tsx, Application/src/components/layer/LayerList.tsx</files>
  <action>
Apply the muted-to-vivid hover effect to sequence names and layer names. The approach:
use a named Tailwind group (`group/row`) on the row container and `group-hover/row:` on the
name span to swap colors. Since inline `style` overrides Tailwind classes, the color must be
set via Tailwind arbitrary value classes, not inline style.

**SequenceList.tsx -- SequenceItem component:**

1. On the sequence row div (line 194, the `flex items-center gap-2 h-10 w-full px-3 cursor-pointer` div),
   add `group/row` to the class string:
   ```
   class="group/row flex items-center gap-2 h-10 w-full px-3 cursor-pointer"
   ```

2. On the sequence NAME span (line 248-257, the non-editing span showing `{seq.name}`),
   change from inline style to Tailwind classes for color with hover transition:
   - Remove `color: 'var(--sidebar-text-primary)'` from the inline style object
   - Add Tailwind classes for the color behavior:
   ```tsx
   <span
     class="truncate text-[var(--sidebar-collapse-line)] group-hover/row:text-[var(--sidebar-text-primary)] transition-colors duration-150"
     style={{fontSize: '14px', fontWeight: 600}}
     onDblClick={...}
   >
   ```
   Keep fontSize and fontWeight in the inline style (they have no hover variant).

3. Do NOT modify the editing input field (line 231-246) -- that stays --sidebar-text-primary always.

**LayerList.tsx -- LayerRow component:**

1. On the layer row div (line 114-115, the `flex items-center gap-2 rounded-md px-2.5 py-1.5 h-[44px] cursor-pointer select-none` div),
   add `group/row` to the class string:
   ```
   class={`${isBase ? 'layer-base' : ''} group/row flex items-center gap-2 rounded-md px-2.5 py-1.5 h-[44px] cursor-pointer select-none`}
   ```

2. On the layer NAME span (line 153-157, the span showing `{layer.name}`),
   change from inline style to Tailwind classes for color with hover transition:
   - Remove `color: 'var(--sidebar-text-primary)'` from the inline style object
   - Add Tailwind classes:
   ```tsx
   <span
     class="truncate leading-tight text-[var(--sidebar-collapse-line)] group-hover/row:text-[var(--sidebar-text-primary)] transition-colors duration-150"
     style={{fontSize: '13px', fontWeight: 500}}
   >
   ```

3. Do NOT change the type label span (line 159-165, showing "Sequence" / "Image" / etc.) --
   that stays --sidebar-text-secondary as-is.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Sequence name text in SequenceList defaults to var(--sidebar-collapse-line) and transitions to var(--sidebar-text-primary) on row hover
    - Layer name text in LayerList defaults to var(--sidebar-collapse-line) and transitions to var(--sidebar-text-primary) on row hover
    - Both use transition-colors duration-150 for smooth animation matching grip icons
    - Editing input in SequenceList is unchanged (always full color)
    - Type label in LayerList is unchanged (stays secondary color)
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `cd Application && npx tsc --noEmit`
2. Visual check: Hover over sequence names in the sidebar -- text should brighten from muted to full color
3. Visual check: Hover over layer names in the sidebar -- text should brighten from muted to full color
4. Visual check: The transition should be smooth (150ms) matching the grip icon transitions
5. Visual check: When NOT hovering, names should appear in the same muted color as the grip icons
</verification>

<success_criteria>
- Sequence names and layer names use --sidebar-collapse-line as default color
- On row hover, names transition to --sidebar-text-primary
- Transition is smooth (duration-150) matching grip icon hover behavior
- No regression: editing input, type labels, and other text elements unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/260317-mqr-sequence-and-layer-names-hover-effect-ma/260317-mqr-SUMMARY.md`
</output>
