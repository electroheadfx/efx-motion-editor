---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/layout/Toolbar.tsx
  - Application/src/components/layout/CanvasArea.tsx
  - Application/src/lib/shortcuts.ts
  - Application/src/components/overlay/ShortcutsOverlay.tsx
autonomous: true
requirements: [quick-2]

must_haves:
  truths:
    - "Toolbar no longer shows zoom percentage, minus, or plus buttons"
    - "Bottom canvas bar shows minus/plus buttons flanking the zoom percentage, next to the Fit button"
    - "Pressing F key triggers Fit to window"
    - "Shortcuts overlay lists F key under Canvas group"
  artifacts:
    - path: "Application/src/components/layout/Toolbar.tsx"
      provides: "Toolbar without zoom controls"
    - path: "Application/src/components/layout/CanvasArea.tsx"
      provides: "Bottom bar with zoom in/out buttons"
    - path: "Application/src/lib/shortcuts.ts"
      provides: "F key shortcut for fit-to-window"
    - path: "Application/src/components/overlay/ShortcutsOverlay.tsx"
      provides: "F shortcut listed in Canvas group"
  key_links:
    - from: "Application/src/components/layout/CanvasArea.tsx"
      to: "canvasStore.zoomIn/zoomOut/zoomPercent/isAtMinZoom/isAtMaxZoom"
      via: "import and signal reads"
      pattern: "canvasStore\\.(zoomIn|zoomOut|zoomPercent|isAtMin|isAtMax)"
    - from: "Application/src/lib/shortcuts.ts"
      to: "canvasStore.fitToWindow"
      via: "F key binding"
      pattern: "KeyF.*fitToWindow"
---

<objective>
Move zoom +/- controls from the top toolbar down to the bottom canvas bar (next to the Fit button), remove the toolbar zoom percentage display, and add an F key shortcut for Fit to window.

Purpose: Consolidate all zoom controls in one location near the canvas for better UX.
Output: Cleaner toolbar, enriched bottom bar with full zoom controls, new F shortcut.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/layout/Toolbar.tsx
@Application/src/components/layout/CanvasArea.tsx
@Application/src/lib/shortcuts.ts
@Application/src/components/overlay/ShortcutsOverlay.tsx
@Application/src/stores/canvasStore.ts
</context>

<interfaces>
<!-- canvasStore signals and methods used by zoom controls -->
From Application/src/stores/canvasStore.ts:
- canvasStore.zoomPercent — computed signal, read-only display value
- canvasStore.zoomIn() — increment zoom by step
- canvasStore.zoomOut() — decrement zoom by step
- canvasStore.fitToWindow() — reset zoom to fit canvas in container
- canvasStore.isAtMinZoom — computed signal, boolean
- canvasStore.isAtMaxZoom — computed signal, boolean
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Remove zoom controls from Toolbar, add zoom buttons to bottom canvas bar</name>
  <files>Application/src/components/layout/Toolbar.tsx, Application/src/components/layout/CanvasArea.tsx</files>
  <action>
In Toolbar.tsx:
- Remove lines 108-134 entirely (the spacer div, zoom percentage span, minus button, plus button, and the separator div before Export).
- Replace with just a spacer: `<div class="flex-1" />` so the Export button still floats to the right.
- Remove the `canvasStore` import since it will no longer be used in this file.

In CanvasArea.tsx, in the bottom "Preview Controls" bar (the div at line 167), restructure the zoom area (currently lines 203-216) to add minus/plus buttons flanking the percentage. The new layout for the zoom cluster should be (all in a row, after the timecode/duration):

```
[  -  ]  36%  [  +  ]  [ Fit ]
```

Specifically, replace lines 203-216 with:
1. A zoom-out button (minus) styled identically to how it was in Toolbar.tsx — `rounded-[5px] px-2.5 py-1` with `bg-[var(--color-bg-settings)]`, opacity-40 when `canvasStore.isAtMinZoom.value` is true, otherwise `hover:bg-[var(--color-bg-input)]`. onClick calls `canvasStore.zoomOut()`. Title "Zoom out (Cmd+-)".
2. The existing zoom percentage span: `<span class="text-[11px] text-[var(--color-text-dim)]">{canvasStore.zoomPercent.value}%</span>`
3. A zoom-in button (plus) styled the same way, opacity-40 when `canvasStore.isAtMaxZoom.value`, onClick calls `canvasStore.zoomIn()`. Title "Zoom in (Cmd+=)".
4. The existing Fit button (unchanged, keep it as-is). Update its title to "Fit to window (F)".
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Toolbar has no zoom controls or percentage. Bottom canvas bar shows [ - ] percentage [ + ] [ Fit ] cluster. TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add F key shortcut for Fit and update shortcuts overlay</name>
  <files>Application/src/lib/shortcuts.ts, Application/src/components/overlay/ShortcutsOverlay.tsx</files>
  <action>
In shortcuts.ts, add a new binding inside the tinykeys() call, in the "Canvas zoom" section (after the $mod+Digit0 binding):

```typescript
'KeyF': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  canvasStore.fitToWindow();
},
```

In ShortcutsOverlay.tsx, add a new entry to the Canvas group's entries array:

```typescript
{keys: 'F', description: 'Fit to window'},
```

Add it after the existing "Fit to window" entry (Cmd+0) so both shortcuts are listed.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>F key triggers fitToWindow. Shortcuts overlay shows F in Canvas group alongside existing Cmd+0 entry.</done>
</task>

</tasks>

<verification>
1. `cd Application && npx tsc --noEmit` — no type errors
2. Visual check: toolbar has no zoom controls, bottom bar has [ - ] 36% [ + ] [ Fit ]
3. Press F key — canvas fits to window
4. Press ? — shortcuts overlay shows F under Canvas group
</verification>

<success_criteria>
- Toolbar shows only: New, Open, Save, dirty dot, FPS toggle, Theme switcher, spacer, Export
- Bottom canvas bar shows playback controls, timecode, [ - ] zoom% [ + ] [ Fit ]
- F key shortcut works for fit-to-window
- Shortcuts overlay updated with F entry
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-move-zoom-controls-from-toolbar-to-botto/2-SUMMARY.md`
</output>
