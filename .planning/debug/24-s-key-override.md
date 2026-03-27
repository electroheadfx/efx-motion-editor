---
status: resolved
trigger: "S key is overridden by 'hide paint layer from timeline' instead of selecting select tool"
created: 2026-03-27T16:35:00Z
updated: 2026-03-27T16:35:00Z
---

## Current Focus

hypothesis: S key shortcut in shortcuts.ts is bound to soloStore.toggleSolo() instead of paintStore.setTool('select')
test: Search for S key binding in shortcuts.ts and compare with expected behavior
expecting: S key should activate select tool in paint mode
next_action: Document root cause and suggest fix

## Symptoms

expected: S key switches to select tool (paintStore.setTool('select')) and shows STROKES section
actual: S key triggers soloStore.toggleSolo() which toggles solo mode affecting overlay sequence visibility
errors: None (the S key binding exists, it's just the wrong function)
reproduction: Press S key while in paint edit mode
started: Unknown - appears to be a pre-existing bug in shortcuts binding

## Eliminated

## Evidence

- timestamp: 2026-03-27T16:35:00Z
  checked: "Application/src/lib/shortcuts.ts"
  found: "Line 445-449: 's': (e: KeyboardEvent) => { ... soloStore.toggleSolo(); }"
  implication: "S key is bound to solo toggle, not select tool"

- timestamp: 2026-03-27T16:35:00Z
  checked: "Application/src/components/overlay/PaintToolbar.tsx"
  found: "Line 51: onClick={() => paintStore.setTool(type)} - toolbar buttons correctly call setTool"
  implication: "paintStore.setTool() is the correct way to activate tools"

- timestamp: 2026-03-27T16:35:00Z
  checked: "24-02-PLAN.md Task 3 step 3"
  found: "'Switch to select tool (S key) -- verify STROKES section appears'"
  implication: "Plan explicitly expects S key to activate select tool"

## Resolution

root_cause: "The S key shortcut in shortcuts.ts (line 445) is bound to soloStore.toggleSolo() instead of paintStore.setTool('select'). This is a wrong binding that pre-dates or was introduced during Phase 24 development. When user presses S expecting select tool, solo mode toggles instead."

fix: "Change the S key binding in shortcuts.ts from soloStore.toggleSolo() to paintStore.setTool('select'). Note: The solo toggle button in TimelinePanel still needs a keyboard shortcut - it should be reassigned to a different key (not S) to avoid conflicts."

verification: "User confirms S key now activates select tool and STROKES section appears"

files_changed: []
