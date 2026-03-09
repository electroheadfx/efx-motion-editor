---
status: resolved
trigger: "Pressing ? key doesn't open shortcuts overlay on macOS with non-US keyboard"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: tinykeys binding uses physical key code "Slash" which only works on US keyboard layout
test: trace tinykeys matching logic for Shift+Slash against non-US keyboard event
expecting: mismatch between event.code and "Slash" on non-US layouts
next_action: confirmed - return diagnosis

## Symptoms

expected: Pressing ? opens shortcuts overlay
actual: Nothing happens when pressing ? on non-US keyboard (e.g., Shift+comma on ABNT2/FR layouts)
errors: none (silent failure)
reproduction: Press Shift+, (or whatever produces ? on non-US layout) -- overlay does not open
started: always broken on non-US keyboard layouts

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-09
  checked: shortcuts.ts line 171 binding key string
  found: binding is 'Shift+Slash' -- uses physical key code
  implication: only works when ? is on the / (Slash) physical key

- timestamp: 2026-03-09
  checked: tinykeys matchKeyBindingPress source code
  found: matching logic tries event.key (case-insensitive) then event.code (exact) against the key string
  implication: "Slash" matches event.code="Slash" on US layout but fails when event.code="Comma" on non-US

- timestamp: 2026-03-09
  checked: tinykeys extra-modifier guard
  found: all active modifiers must be declared in binding or match the key name
  implication: cannot use bare "?" -- must use "Shift+?" to declare the Shift modifier

- timestamp: 2026-03-09
  checked: tinykeys parseKeybinding regex split on \b\+
  found: "Shift+?" correctly parses to modifiers=["Shift"], key="?"
  implication: "Shift+?" is valid tinykeys syntax and will match event.key="?" on any layout

## Resolution

root_cause: The tinykeys binding 'Shift+Slash' matches against event.code="Slash" (the physical key), which only exists on US-style keyboard layouts. On non-US layouts (ABNT2, AZERTY, etc.), the ? character is produced by a different physical key (e.g., Shift+Comma), so event.code is "Comma" and the binding never fires.
fix: Change 'Shift+Slash' to 'Shift+?' in shortcuts.ts line 171. This matches against event.key="?" which is layout-independent.
verification: empty
files_changed: []
