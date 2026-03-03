# Phase 5: Editing Infrastructure - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix v1.0 store bugs (data bleed on new project, auto-save leak, timeline/playback not reset), implement undo/redo with command pattern, and wire all keyboard shortcuts. This phase delivers the editing foundation that every later phase builds on — undo/redo and shortcuts must exist before layers, FX, and audio are added.

</domain>

<decisions>
## Implementation Decisions

### Undo scope & behavior
- Undoable actions: sequence edits only — add/remove/reorder key photos, change hold duration, sequence create/delete/reorder
- Project settings (fps, name, resolution) are NOT undoable — they're rare, deliberate changes
- Global undo stack across all sequences — Cmd+Z undoes the last action regardless of which sequence it was in
- No undo UI indicator — no visible undo button or counter, just Cmd+Z/Cmd+Shift+Z works
- Fresh undo stack per project — clear on New/Open/Close project
- Slider coalescing: mousedown-to-mouseup on any slider = one undo entry

### JKL scrub behavior
- J and L counter each other on a shared speed axis — pressing opposite key decelerates before reversing (DaVinci Resolve model)
- K stops playback AND resets speed tier to zero — next L or J starts fresh at 1x
- Brief speed badge near playback controls — shows "2x", "4x" etc for ~1 second when speed changes, then fades out
- Speed tiers: Claude's discretion, tuned for stop-motion frame rates (15/24fps)

### Unsaved changes flow
- macOS-style "Save / Don't Save / Cancel" dialog when user clicks New, Open, or quits with unsaved changes
- Guard on all exit paths: New Project, Open Project, Cmd+Q, window close
- If project was never saved and user picks "Save" — open Save As file picker; if they cancel the picker, return to editor
- Use native OS dialog via Tauri's dialog API — not a custom in-app modal

### Shortcuts help overlay
- Centered dark-themed modal triggered by ? key
- Shortcuts grouped by action type: Playback (Space, arrows, JKL), File (⌘S/⌘N/⌘O), Editing (⌘Z, ⌫), Navigation
- 2-column layout for scanability
- macOS key symbols throughout: ⌘, ⇧, ⌥, ⌫ (not text labels)
- Dismiss with Escape, click outside, or ? again (toggle)

### Claude's Discretion
- JKL speed tier values (how many tiers, exact multipliers)
- Speed badge visual design and fade animation
- Shortcuts overlay typography and spacing
- Exact implementation of keyboard event suppression in input fields
- How to handle undo stack memory (100+ levels, but implementation detail)

</decisions>

<specifics>
## Specific Ideas

- Shortcuts overlay should feel like GitHub's ? overlay or Figma's shortcuts panel — centered, clean, grouped
- JKL should feel like DaVinci Resolve shuttle control — J/L counter each other, K resets
- Unsaved changes dialog should feel like any native macOS app — "Save / Don't Save / Cancel" sheet

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- historyStore (stub): Already has stack/pointer signals and HistoryEntry type with undo/redo callbacks — needs command pattern logic
- timelineStore.reset(): Exists but not called from projectStore.closeProject() — just needs wiring
- PlaybackEngine: Singleton with start/stop/toggle/seek/step — needs stop() called on project close
- autoSave.ts: startAutoSave/stopAutoSave exist — stopAutoSave just needs to be called from closeProject/openProject

### Established Patterns
- Preact Signals for all reactive state (6 stores + computed values)
- batch() for multi-signal updates (projectStore uses this extensively)
- markDirty callback pattern to avoid circular imports between stores
- snake_case TypeScript types matching Rust serde serialization

### Integration Points
- projectStore.closeProject(): Needs to call timelineStore.reset(), playbackEngine.stop(), stopAutoSave(), historyStore reset
- projectStore.openProject(): Needs unsaved-changes guard before loading, then call closeProject first
- Toolbar.tsx: New/Open/Save buttons need unsaved-changes guards wired in
- app.tsx / main.tsx: Keyboard shortcut listener mounts here (global tinykeys binding)
- EditorShell.tsx: Shortcuts overlay modal renders here

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-editing-infrastructure*
*Context gathered: 2026-03-03*
