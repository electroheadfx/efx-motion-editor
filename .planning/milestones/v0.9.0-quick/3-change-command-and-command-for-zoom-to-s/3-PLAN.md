---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/lib/shortcuts.ts
  - Application/src-tauri/src/lib.rs
  - Application/src/components/layout/CanvasArea.tsx
  - Application/src/components/overlay/ShortcutsOverlay.tsx
  - Application/src/main.tsx
autonomous: true
requirements: [QUICK-3]
must_haves:
  truths:
    - "Pressing bare = key zooms in on the canvas"
    - "Pressing bare - key zooms out on the canvas"
    - "Cmd+= and Cmd+- no longer trigger canvas zoom"
    - "Tooltips and shortcuts overlay show the new key bindings"
  artifacts:
    - path: "Application/src/lib/shortcuts.ts"
      provides: "Bare = and - key bindings for zoom"
      contains: "'Equal'"
    - path: "Application/src-tauri/src/lib.rs"
      provides: "View menu items without Cmd accelerators for zoom in/out"
    - path: "Application/src/components/layout/CanvasArea.tsx"
      provides: "Updated tooltip strings"
    - path: "Application/src/components/overlay/ShortcutsOverlay.tsx"
      provides: "Updated shortcut labels"
  key_links:
    - from: "Application/src/lib/shortcuts.ts"
      to: "canvasStore.zoomIn/zoomOut"
      via: "tinykeys bare key binding"
      pattern: "'Equal'.*zoomIn|'Minus'.*zoomOut"
---

<objective>
Change canvas zoom shortcuts from Cmd+= / Cmd+- to bare = / - keys (remove the Cmd modifier).

Purpose: User wants simpler, single-key zoom controls without needing to hold Cmd.
Output: Updated keyboard shortcuts, Tauri menu accelerators, tooltips, and help overlay.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/lib/shortcuts.ts
@Application/src-tauri/src/lib.rs
@Application/src/components/layout/CanvasArea.tsx
@Application/src/components/overlay/ShortcutsOverlay.tsx
@Application/src/main.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update zoom key bindings and Tauri menu accelerators</name>
  <files>Application/src/lib/shortcuts.ts, Application/src-tauri/src/lib.rs, Application/src/main.tsx</files>
  <action>
1. In `shortcuts.ts`, change the two zoom key bindings:
   - `'$mod+Equal'` -> `'Equal'` (zoom in)
   - `'$mod+Minus'` -> `'Minus'` (zoom out)
   - Keep `'$mod+Digit0'` unchanged (fit-to-window stays Cmd+0)
   - Keep `'KeyF'` unchanged

2. In `src-tauri/src/lib.rs`, remove the accelerator parameters from the zoom in/out menu items since bare `=`/`-` are not valid native menu accelerators on macOS. Change:
   - `MenuItem::with_id(app, "zoom-in", "Zoom In", true, Some("CmdOrCtrl+="))` -> `MenuItem::with_id(app, "zoom-in", "Zoom In", true, None::<&str>)`
   - `MenuItem::with_id(app, "zoom-out", "Zoom Out", true, None::<&str>)`
   - Keep `fit-to-window` accelerator `Some("CmdOrCtrl+0")` unchanged
   - The View menu items remain for discoverability but no longer show accelerator hints (bare keys cannot be menu accelerators)

3. In `main.tsx`, update the comment on line 29-31 to reflect that zoom in/out now use bare = / - keys via tinykeys, and the menu:zoom-in / menu:zoom-out listeners are kept only for the View menu click path (not for intercepting native accelerators). Keep the `listen('menu:zoom-in', ...)` and `listen('menu:zoom-out', ...)` calls as they handle clicks on the View menu items.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Bare = and - keys are wired to zoomIn/zoomOut in shortcuts.ts; Tauri menu items have no accelerator for zoom in/out; TypeScript compiles without errors</done>
</task>

<task type="auto">
  <name>Task 2: Update tooltips and shortcuts overlay labels</name>
  <files>Application/src/components/layout/CanvasArea.tsx, Application/src/components/overlay/ShortcutsOverlay.tsx</files>
  <action>
1. In `CanvasArea.tsx`, update the two tooltip title attributes:
   - Line 211: `title="Zoom out (Cmd+-)"` -> `title="Zoom out (-)"`
   - Line 225: `title="Zoom in (Cmd+=)"` -> `title="Zoom in (=)"`

2. In `ShortcutsOverlay.tsx`, update the Canvas group shortcut labels:
   - `{keys: '\u2318=', description: 'Zoom in'}` -> `{keys: '=', description: 'Zoom in'}`
   - `{keys: '\u2318\u2212', description: 'Zoom out'}` -> `{keys: '\u2212', description: 'Zoom out'}` (use the minus sign character \u2212 for visual consistency, or plain `-`)
   - Keep `{keys: '\u23180', description: 'Fit to window'}` unchanged (Cmd+0 stays)
   - Keep `{keys: 'F', description: 'Fit to window'}` unchanged
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Tooltip hover text shows bare key shortcuts; shortcuts overlay shows = and - without Cmd symbol for zoom in/out</done>
</task>

</tasks>

<verification>
1. `cd Application && npx tsc --noEmit` -- TypeScript compiles
2. `cd Application/src-tauri && cargo check` -- Rust compiles
3. Manual: Launch app, press `=` key -> canvas zooms in; press `-` key -> canvas zooms out; Cmd+= and Cmd+- should NOT zoom; hover over zoom buttons shows updated tooltips; press `?` shows updated shortcut labels
</verification>

<success_criteria>
- Bare `=` key triggers canvas zoom in
- Bare `-` key triggers canvas zoom out
- Cmd+= and Cmd+- no longer trigger zoom (Cmd+0 fit-to-window unchanged)
- Tooltips on zoom buttons reflect new shortcuts
- Shortcuts overlay (?) shows updated key labels
- Both TypeScript and Rust compile without errors
</success_criteria>

<output>
After completion, create `.planning/quick/3-change-command-and-command-for-zoom-to-s/3-SUMMARY.md`
</output>
